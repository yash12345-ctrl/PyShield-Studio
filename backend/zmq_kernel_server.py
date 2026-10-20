import os
import sys
import zmq
import json
import time
import threading
from typing import Dict, Any, List

# Add project root to sys.path and set CWD
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_ROOT)
os.chdir(PROJECT_ROOT)

from backend.kernel import NotebookKernel, clean_terminal_output
from backend.zmq_protocol import serialize_message, deserialize_message

# Default ZeroMQ Port Configuration (matching Jupyter architecture)
DEFAULT_CONFIG = {
    "ip": "127.0.0.1",
    "shell_port": 5555,
    "iopub_port": 5556,
    "control_port": 5557,
    "hb_port": 5558,
    "stdin_port": 5559,
    "transport": "tcp"
}

class ZMQKernelServer:
    """
    ZeroMQ-based Python Kernel Server implementing the Jupyter messaging protocol:
    - Shell Socket (ROUTER): Handles execute_request and replies with execute_reply
    - IOPub Socket (PUB): Broadcasts live streams, display data, plots, and kernel state
    - Control Socket (ROUTER): High priority commands (interrupt, shutdown)
    - Heartbeat Socket (REP): Echoes bytes for liveness detection
    - Stdin Socket (ROUTER): Handles 2-way interactive input() requests
    """
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or DEFAULT_CONFIG
        self.context = zmq.Context()
        self.session_id = f"kernel-{int(time.time())}"
        self.running = False

        # Internal execution engine (powered by ipykernel InteractiveShell)
        self.kernel = NotebookKernel()

        # Initialize Sockets
        self.shell_socket = self.context.socket(zmq.ROUTER)
        self.iopub_socket = self.context.socket(zmq.PUB)
        self.control_socket = self.context.socket(zmq.ROUTER)
        self.hb_socket = self.context.socket(zmq.REP)
        self.stdin_socket = self.context.socket(zmq.ROUTER)
        self.last_stdin_identity = b"pyshield_client"

        self._bind_sockets()

    def _bind_sockets(self):
        ip = self.config["ip"]
        transport = self.config["transport"]

        shell_addr = f"{transport}://{ip}:{self.config['shell_port']}"
        iopub_addr = f"{transport}://{ip}:{self.config['iopub_port']}"
        control_addr = f"{transport}://{ip}:{self.config['control_port']}"
        hb_addr = f"{transport}://{ip}:{self.config['hb_port']}"
        stdin_addr = f"{transport}://{ip}:{self.config['stdin_port']}"

        self.shell_socket.bind(shell_addr)
        self.iopub_socket.bind(iopub_addr)
        self.control_socket.bind(control_addr)
        self.hb_socket.bind(hb_addr)
        self.stdin_socket.bind(stdin_addr)

        print(f"✓ ZeroMQ Kernel Server bound to:")
        print(f"  • Shell:   {shell_addr}")
        print(f"  • IOPub:   {iopub_addr}")
        print(f"  • Control: {control_addr}")
        print(f"  • HB:      {hb_addr}")
        print(f"  • Stdin:   {stdin_addr}")

    def publish_status(self, execution_state: str, parent_header: Dict[str, Any]):
        """Publishes kernel status (busy / idle) on IOPub channel."""
        frames = serialize_message(
            msg_type="status",
            content={"execution_state": execution_state},
            session_id=self.session_id,
            parent_header=parent_header,
            identities=[b"status"]
        )
        self.iopub_socket.send_multipart(frames)

    def handle_execute_request(self, identities: List[bytes], header: Dict[str, Any], content: Dict[str, Any]):
        """Executes code via NotebookKernel and publishes results on IOPub and Shell."""
        code = content.get("code", "")
        cell_id = content.get("cell_id", f"cell-{self.kernel.execution_count + 1}")

        # 1. Broadcast busy status
        self.publish_status("busy", header)

        # Define live streaming callback to publish chunks to IOPub immediately
        def live_stream_callback(stream_name: str, chunk: str):
            try:
                cleaned = clean_terminal_output(chunk)
                if cleaned:
                    stream_frames = serialize_message(
                        msg_type="stream",
                        content={"name": stream_name, "text": cleaned},
                        session_id=self.session_id,
                        parent_header=header,
                        identities=[f"stream.{stream_name}".encode()]
                    )
                    self.iopub_socket.send_multipart(stream_frames)
            except Exception:
                pass

        # Define interactive stdin callback for input() calls
        def live_input_callback(prompt: str, password: bool) -> str:
            """
            Sends input_request on Stdin ROUTER socket to the client,
            and waits for input_reply with 120s timeout.
            """
            input_req_frames = serialize_message(
                msg_type="input_request",
                content={
                    "prompt": prompt,
                    "password": password,
                    "cell_id": cell_id
                },
                session_id=self.session_id,
                parent_header=header,
                identities=[self.last_stdin_identity]
            )
            self.stdin_socket.send_multipart(input_req_frames)

            poller = zmq.Poller()
            poller.register(self.stdin_socket, zmq.POLLIN)

            timeout_limit = 120.0
            wait_start = time.time()

            while self.running and (time.time() - wait_start < timeout_limit):
                events = dict(poller.poll(timeout=100))
                if self.stdin_socket in events:
                    rep_frames = self.stdin_socket.recv_multipart()
                    rep_ids, rep_hdr, _, _, rep_content = deserialize_message(rep_frames)
                    if rep_ids:
                        self.last_stdin_identity = rep_ids[0]
                    if rep_hdr.get("msg_type") == "input_reply":
                        return str(rep_content.get("value", ""))

            raise TimeoutError("Interactive input timed out after 120 seconds")

        try:
            # 2. Execute code in ipykernel engine with real-time streaming and interactive stdin
            res = self.kernel.execute_cell(
                cell_id,
                code,
                stream_callback=live_stream_callback,
                input_callback=live_input_callback
            )
        except KeyboardInterrupt:
            res = {
                "cell_id": cell_id,
                "execution_count": self.kernel.execution_count,
                "status": "error",
                "engine": "ipykernel",
                "stdout": "",
                "stderr": "\nKeyboardInterrupt: Cell execution was interrupted by user.\n",
                "result_repr": None,
                "html_table": None,
                "images": [],
                "error": {
                    "type": "KeyboardInterrupt",
                    "message": "Cell execution was interrupted by user",
                    "traceback": "KeyboardInterrupt: Interrupted by user"
                },
                "execution_time_ms": 0.0
            }

        # 5. Publish rich display MIME bundles (SVG, HTML, Images, LaTeX, JSON, Audio, Video)
        for disp in res.get("displays", []):
            disp_data = disp.get("data", {})
            if disp_data:
                display_frames = serialize_message(
                    msg_type="display_data",
                    content={
                        "data": disp_data,
                        "metadata": disp.get("metadata", {})
                    },
                    session_id=self.session_id,
                    parent_header=header,
                    identities=[b"display_data"]
                )
                self.iopub_socket.send_multipart(display_frames)

        # 6. Publish expression result MIME bundle
        result_data = res.get("data", {})
        if not result_data and res.get("result_repr") is not None:
            result_data = {"text/plain": res["result_repr"]}

        if result_data:
            result_frames = serialize_message(
                msg_type="execute_result",
                content={
                    "execution_count": res["execution_count"],
                    "data": result_data,
                    "metadata": res.get("metadata", {})
                },
                session_id=self.session_id,
                parent_header=header,
                identities=[b"execute_result"]
            )
            self.iopub_socket.send_multipart(result_frames)

        # 7. Publish error if occurred
        if res["status"] == "error" and res["error"]:
            err_frames = serialize_message(
                msg_type="error",
                content={
                    "ename": res["error"]["type"],
                    "evalue": res["error"]["message"],
                    "traceback": [res["error"]["traceback"]]
                },
                session_id=self.session_id,
                parent_header=header,
                identities=[b"error"]
            )
            self.iopub_socket.send_multipart(err_frames)

        # 8. Send final execute_reply on Shell socket
        reply_content = {
            "status": "ok" if res["status"] == "success" else "error",
            "execution_count": res["execution_count"],
            "execution_time_ms": res["execution_time_ms"],
            "user_expressions": {}
        }
        reply_frames = serialize_message(
            msg_type="execute_reply",
            content=reply_content,
            session_id=self.session_id,
            parent_header=header,
            identities=identities
        )
        self.shell_socket.send_multipart(reply_frames)

        # 9. Broadcast idle status
        self.publish_status("idle", header)

    def _heartbeat_loop(self):
        """Dedicated thread to echo heartbeat pings."""
        while self.running:
            try:
                msg = self.hb_socket.recv(flags=zmq.NOBLOCK)
                self.hb_socket.send(msg)
            except zmq.Again:
                time.sleep(0.01)
            except Exception:
                break

    def _control_loop(self):
        """Dedicated thread for high-priority Control messages (interrupt, restart, shutdown)."""
        poller = zmq.Poller()
        poller.register(self.control_socket, zmq.POLLIN)
        while self.running:
            try:
                events = dict(poller.poll(timeout=100))
                if self.control_socket in events:
                    ctrl_frames = self.control_socket.recv_multipart()
                    identities, header, _, _, content = deserialize_message(ctrl_frames)
                    msg_type = header.get("msg_type")

                    if msg_type == "interrupt_request":
                        res = self.kernel.interrupt()
                        reply_frames = serialize_message(
                            msg_type="interrupt_reply",
                            content=res,
                            session_id=self.session_id,
                            parent_header=header,
                            identities=identities
                        )
                        self.control_socket.send_multipart(reply_frames)

                    elif msg_type == "restart_request":
                        res = self.kernel.restart()
                        reply_frames = serialize_message(
                            msg_type="restart_reply",
                            content=res,
                            session_id=self.session_id,
                            parent_header=header,
                            identities=identities
                        )
                        self.control_socket.send_multipart(reply_frames)

                    elif msg_type == "shutdown_request":
                        self.running = False
                        reply_frames = serialize_message(
                            msg_type="shutdown_reply",
                            content={"status": "ok"},
                            session_id=self.session_id,
                            parent_header=header,
                            identities=identities
                        )
                        self.control_socket.send_multipart(reply_frames)
                        break
            except Exception as e:
                if self.running:
                    print(f"Control thread error: {e}")

    def start(self):
        """Starts the ZeroMQ poller event loop."""
        self.running = True

        # Start heartbeat worker in background thread
        hb_thread = threading.Thread(target=self._heartbeat_loop, daemon=True)
        hb_thread.start()

        # Start control worker in background thread
        ctrl_thread = threading.Thread(target=self._control_loop, daemon=True)
        ctrl_thread.start()

        poller = zmq.Poller()
        poller.register(self.shell_socket, zmq.POLLIN)

        print("⚡ ZeroMQ Kernel Poller running. Listening for requests...")

        while self.running:
            try:
                events = dict(poller.poll(timeout=100))

                # Handle Shell Socket messages
                if self.shell_socket in events:
                    frames = self.shell_socket.recv_multipart()
                    identities, header, _, _, content = deserialize_message(frames)
                    msg_type = header.get("msg_type")

                    if msg_type == "execute_request":
                        self.handle_execute_request(identities, header, content)
                    elif msg_type == "restart_request":
                        res = self.kernel.restart()
                        reply_frames = serialize_message(
                            msg_type="restart_reply",
                            content=res,
                            session_id=self.session_id,
                            parent_header=header,
                            identities=identities
                        )
                        self.shell_socket.send_multipart(reply_frames)
                    elif msg_type == "kernel_info_request":
                        info_reply = serialize_message(
                            msg_type="kernel_info_reply",
                            content={
                                "protocol_version": "5.3",
                                "implementation": "pyshield_ipykernel",
                                "language_info": {"name": "python", "version": "3.12"}
                            },
                            session_id=self.session_id,
                            parent_header=header,
                            identities=identities
                        )
                        self.shell_socket.send_multipart(info_reply)
                    elif msg_type == "complete_request":
                        code = content.get("code", "")
                        cursor_pos = content.get("cursor_pos", len(code))
                        res = self.kernel.complete(code, cursor_pos)
                        reply_frames = serialize_message(
                            msg_type="complete_reply",
                            content=res,
                            session_id=self.session_id,
                            parent_header=header,
                            identities=identities
                        )
                        self.shell_socket.send_multipart(reply_frames)
                    elif msg_type == "inspect_request":
                        code = content.get("code", "")
                        cursor_pos = content.get("cursor_pos", len(code))
                        detail_level = content.get("detail_level", 0)
                        res = self.kernel.inspect(code, cursor_pos, detail_level)
                        reply_frames = serialize_message(
                            msg_type="inspect_reply",
                            content=res,
                            session_id=self.session_id,
                            parent_header=header,
                            identities=identities
                        )
                        self.shell_socket.send_multipart(reply_frames)

            except KeyboardInterrupt:
                # Execution was interrupted by user; keep kernel server running
                continue
            except Exception as e:
                print(f"Kernel loop error: {e}")

    def stop(self):
        self.running = False
        self.shell_socket.close()
        self.iopub_socket.close()
        self.control_socket.close()
        self.hb_socket.close()
        self.stdin_socket.close()
        self.context.term()

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="PyShield ZeroMQ Kernel Server")
    parser.add_argument("--connection-file", "-f", type=str, help="Path to JSON connection file")
    parser.add_argument("--ip", type=str, default=None)
    parser.add_argument("--shell-port", type=int, default=None)
    parser.add_argument("--iopub-port", type=int, default=None)
    parser.add_argument("--control-port", type=int, default=None)
    parser.add_argument("--hb-port", type=int, default=None)
    parser.add_argument("--stdin-port", type=int, default=None)
    args = parser.parse_args()

    cfg = dict(DEFAULT_CONFIG)
    if args.connection_file and os.path.exists(args.connection_file):
        with open(args.connection_file, "r", encoding="utf-8") as f:
            cfg.update(json.load(f))
    else:
        if args.ip: cfg["ip"] = args.ip
        if args.shell_port: cfg["shell_port"] = args.shell_port
        if args.iopub_port: cfg["iopub_port"] = args.iopub_port
        if args.control_port: cfg["control_port"] = args.control_port
        if args.hb_port: cfg["hb_port"] = args.hb_port
        if args.stdin_port: cfg["stdin_port"] = args.stdin_port

    server = ZMQKernelServer(config=cfg)
    server.start()
