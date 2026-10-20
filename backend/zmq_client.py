import os
import sys
import zmq
import json
import time
import queue
from typing import Dict, Any, Callable, Optional, List

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_ROOT)

from backend.zmq_protocol import serialize_message, deserialize_message

DEFAULT_CONFIG = {
    "ip": "127.0.0.1",
    "shell_port": 5555,
    "iopub_port": 5556,
    "control_port": 5557,
    "hb_port": 5558,
    "stdin_port": 5559,
    "transport": "tcp"
}

class ZMQKernelClient:
    """
    Client connecting to the ZeroMQ Python Kernel Server.
    Provides methods to execute code, stream output live, send interactive input, and check heartbeats.
    """
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or DEFAULT_CONFIG
        self.context = zmq.Context()
        self.session_id = f"client-{int(time.time())}"
        self.input_reply_queue = queue.Queue()

        # Initialize Sockets
        self.shell_socket = self.context.socket(zmq.DEALER)
        self.iopub_socket = self.context.socket(zmq.SUB)
        self.control_socket = self.context.socket(zmq.DEALER)
        self.hb_socket = self.context.socket(zmq.REQ)
        if hasattr(zmq, "REQ_RELAXED"):
            self.hb_socket.setsockopt(zmq.REQ_RELAXED, 1)
        if hasattr(zmq, "REQ_CORRELATE"):
            self.hb_socket.setsockopt(zmq.REQ_CORRELATE, 1)
        self.stdin_socket = self.context.socket(zmq.DEALER)
        self.stdin_socket.setsockopt(zmq.IDENTITY, b"pyshield_client")

        self._connect_sockets()

    def _connect_sockets(self):
        ip = self.config["ip"]
        transport = self.config["transport"]

        shell_addr = f"{transport}://{ip}:{self.config['shell_port']}"
        iopub_addr = f"{transport}://{ip}:{self.config['iopub_port']}"
        control_addr = f"{transport}://{ip}:{self.config['control_port']}"
        hb_addr = f"{transport}://{ip}:{self.config['hb_port']}"
        stdin_addr = f"{transport}://{ip}:{self.config['stdin_port']}"

        self.shell_socket.connect(shell_addr)
        self.iopub_socket.connect(iopub_addr)
        self.iopub_socket.subscribe(b"") # Listen to all IOPub channels
        self.control_socket.connect(control_addr)
        self.hb_socket.connect(hb_addr)
        self.stdin_socket.connect(stdin_addr)

    def send_input_reply(self, value: str):
        """Sends input_reply on ZeroMQ stdin channel."""
        content = {"value": value}
        frames = serialize_message(
            msg_type="input_reply",
            content=content,
            session_id=self.session_id
        )
        self.stdin_socket.send_multipart(frames)

    def submit_input_reply(self, value: str):
        """Thread-safe submission of input reply to be dispatched to the kernel."""
        self.input_reply_queue.put(value)

    def ping_heartbeat(self, timeout_ms: int = 1000) -> bool:
        """Pings the kernel heartbeat socket to verify it is responsive."""
        try:
            poller = zmq.Poller()
            poller.register(self.hb_socket, zmq.POLLIN)

            ping_payload = b"PING"
            self.hb_socket.send(ping_payload)

            events = dict(poller.poll(timeout_ms))
            if self.hb_socket in events:
                reply = self.hb_socket.recv()
                return reply == ping_payload
        except Exception:
            pass
        return False

    def execute(
        self,
        code: str,
        cell_id: str = "cell-1",
        on_stream_callback: Optional[Callable[[str, str], None]] = None,
        on_input_request_callback: Optional[Callable[[str, bool, str], None]] = None,
        timeout_sec: float = 120.0,
        is_alive_check: Optional[Callable[[], bool]] = None
    ) -> Dict[str, Any]:
        """
        Sends an execute_request over ZeroMQ Shell socket and listens to IOPub
        for live stdout, stderr, rich display data, and execution results,
        while handling 2-way interactive stdin requests and monitoring kernel liveness.
        """
        content = {
            "code": code,
            "cell_id": cell_id,
            "silent": False,
            "store_history": True,
            "user_expressions": {}
        }

        # 1. Send execute_request on Shell socket
        req_frames = serialize_message(
            msg_type="execute_request",
            content=content,
            session_id=self.session_id
        )
        self.shell_socket.send_multipart(req_frames)

        # 2. Poll for replies on Shell, broadcasts on IOPub, and input requests on Stdin
        poller = zmq.Poller()
        poller.register(self.shell_socket, zmq.POLLIN)
        poller.register(self.iopub_socket, zmq.POLLIN)
        poller.register(self.stdin_socket, zmq.POLLIN)

        stdout_chunks = []
        stderr_chunks = []
        result_repr = None
        html_table = None
        images = []
        result_data: Dict[str, Any] = {}
        display_items: List[Dict[str, Any]] = []
        svg_items: List[str] = []
        latex_items: List[str] = []
        json_items: List[Any] = []
        error_info = None
        execution_count = None
        shell_reply_received = False
        kernel_idle_received = False

        start_time = time.time()

        while time.time() - start_time < timeout_sec:
            # Check if kernel process died (e.g. segfault / abort)
            if is_alive_check and not is_alive_check():
                error_info = {
                    "ename": "KernelCrashError",
                    "evalue": "Kernel process terminated unexpectedly (e.g. Segmentation fault / C extension crash).",
                    "traceback": [
                        f"KernelCrashError: The Python kernel process died unexpectedly while executing cell '{cell_id}'.\n"
                        + "PyShield process isolation prevented the server from crashing.\n"
                        + ("Captured partial output before crash:\n" + "".join(stdout_chunks) if stdout_chunks else "No output before crash.")
                    ]
                }
                break

            # Dispatch any pending input replies to the kernel
            while not self.input_reply_queue.empty():
                try:
                    reply_val = self.input_reply_queue.get_nowait()
                    self.send_input_reply(reply_val)
                except queue.Empty:
                    break

            events = dict(poller.poll(timeout=50))

            # Read Stdin socket (interactive input_request)
            if self.stdin_socket in events:
                stdin_frames = self.stdin_socket.recv_multipart()
                _, header, _, _, stdin_content = deserialize_message(stdin_frames)
                if header.get("msg_type") == "input_request":
                    prompt = stdin_content.get("prompt", "")
                    password = stdin_content.get("password", False)
                    cid = stdin_content.get("cell_id", cell_id)
                    if on_input_request_callback:
                        on_input_request_callback(prompt, password, cid)

            # Read IOPub socket
            if self.iopub_socket in events:
                iopub_frames = self.iopub_socket.recv_multipart()
                _, header, _, _, iopub_content = deserialize_message(iopub_frames)
                msg_type = header.get("msg_type")

                if msg_type == "status":
                    state = iopub_content.get("execution_state")
                    if state == "idle" and shell_reply_received:
                        kernel_idle_received = True

                elif msg_type == "stream":
                    name = iopub_content.get("name")
                    text = iopub_content.get("text", "")
                    if name == "stdout":
                        stdout_chunks.append(text)
                    elif name == "stderr":
                        stderr_chunks.append(text)

                    if on_stream_callback:
                        on_stream_callback(name, text)

                elif msg_type == "display_data":
                    data = iopub_content.get("data", {})
                    metadata = iopub_content.get("metadata", {})
                    display_items.append({"data": data, "metadata": metadata})

                    if "text/html" in data and not html_table:
                        html_table = data["text/html"]
                    if "image/png" in data:
                        images.append(data["image/png"])
                    if "image/jpeg" in data:
                        images.append(data["image/jpeg"])
                    if "image/svg+xml" in data:
                        svg_items.append(data["image/svg+xml"])
                    if "text/latex" in data:
                        latex_items.append(data["text/latex"])
                    if "application/json" in data:
                        json_items.append(data["application/json"])

                elif msg_type == "execute_result":
                    data = iopub_content.get("data", {})
                    result_data = data
                    if "text/plain" in data:
                        result_repr = data["text/plain"]
                    if "text/html" in data and not html_table:
                        html_table = data["text/html"]
                    if "image/png" in data:
                        images.append(data["image/png"])
                    if "image/jpeg" in data:
                        images.append(data["image/jpeg"])
                    if "image/svg+xml" in data:
                        svg_items.append(data["image/svg+xml"])
                    if "text/latex" in data:
                        latex_items.append(data["text/latex"])
                    if "application/json" in data:
                        json_items.append(data["application/json"])

                elif msg_type == "error":
                    error_info = {
                        "ename": iopub_content.get("ename"),
                        "evalue": iopub_content.get("evalue"),
                        "traceback": iopub_content.get("traceback")
                    }

            # Read Shell socket
            if self.shell_socket in events:
                shell_frames = self.shell_socket.recv_multipart()
                _, header, _, _, shell_content = deserialize_message(shell_frames)
                if header.get("msg_type") == "execute_reply":
                    shell_reply_received = True
                    execution_count = shell_content.get("execution_count")
                    status = shell_content.get("status")

            # Break once both Shell reply and IOPub idle status are verified
            if shell_reply_received and (kernel_idle_received or not events):
                break

        total_time_ms = round((time.time() - start_time) * 1000, 2)

        # Handle execution timeout
        if not shell_reply_received and error_info is None:
            error_info = {
                "ename": "TimeoutError",
                "evalue": f"Execution timed out after {int(timeout_sec)} seconds.",
                "traceback": [
                    f"TimeoutError: Cell execution exceeded the {int(timeout_sec)}s timeout limit.\n"
                    + ("Captured partial output before timeout:\n" + "".join(stdout_chunks) if stdout_chunks else "No output was captured before timeout.")
                ]
            }

        formatted_error = None
        if error_info:
            ename = error_info.get("ename") or error_info.get("type", "ExecutionError")
            evalue = error_info.get("evalue") or error_info.get("message", "Cell execution failed")
            tb = error_info.get("traceback", "")
            if isinstance(tb, list):
                tb = "\n".join(tb)
            formatted_error = {
                "type": ename,
                "message": evalue,
                "ename": ename,
                "evalue": evalue,
                "traceback": tb
            }

        return {
            "status": "success" if formatted_error is None else "error",
            "execution_count": execution_count,
            "stdout": "".join(stdout_chunks),
            "stderr": "".join(stderr_chunks),
            "result_repr": result_repr,
            "html_table": html_table,
            "images": images,
            "data": result_data,
            "displays": display_items,
            "svg": svg_items[0] if svg_items else None,
            "latex": latex_items[0] if latex_items else None,
            "json_data": json_items[0] if json_items else None,
            "error": formatted_error,
            "execution_time_ms": total_time_ms
        }

    def restart_kernel(self, timeout_sec: float = 5.0) -> Dict[str, Any]:
        """Sends restart_request over ZeroMQ Control socket."""
        req_frames = serialize_message(
            msg_type="restart_request",
            content={},
            session_id=self.session_id
        )
        self.control_socket.send_multipart(req_frames)
        poller = zmq.Poller()
        poller.register(self.control_socket, zmq.POLLIN)
        events = dict(poller.poll(int(timeout_sec * 1000)))
        if self.control_socket in events:
            frames = self.control_socket.recv_multipart()
            _, header, _, _, content = deserialize_message(frames)
            return content
        return {"status": "ok", "message": "Kernel restarted successfully"}

    def interrupt_kernel(self, timeout_sec: float = 3.0) -> Dict[str, Any]:
        """Sends interrupt_request over ZeroMQ Control socket to halt running execution."""
        req_frames = serialize_message(
            msg_type="interrupt_request",
            content={},
            session_id=self.session_id
        )
        self.control_socket.send_multipart(req_frames)
        poller = zmq.Poller()
        poller.register(self.control_socket, zmq.POLLIN)
        events = dict(poller.poll(int(timeout_sec * 1000)))
        if self.control_socket in events:
            frames = self.control_socket.recv_multipart()
            _, header, _, _, content = deserialize_message(frames)
            return content
        return {"status": "ok", "message": "Interrupt signal dispatched"}

    def complete(self, code: str, cursor_pos: Optional[int] = None, timeout_sec: float = 3.0) -> Dict[str, Any]:
        """Sends complete_request over ZeroMQ Shell socket and returns complete_reply content."""
        if cursor_pos is None:
            cursor_pos = len(code)
        req_frames = serialize_message(
            msg_type="complete_request",
            content={"code": code, "cursor_pos": cursor_pos},
            session_id=self.session_id
        )
        self.shell_socket.send_multipart(req_frames)
        poller = zmq.Poller()
        poller.register(self.shell_socket, zmq.POLLIN)
        events = dict(poller.poll(int(timeout_sec * 1000)))
        if self.shell_socket in events:
            frames = self.shell_socket.recv_multipart()
            _, header, _, _, content = deserialize_message(frames)
            return content
        return {"status": "error", "matches": [], "cursor_start": cursor_pos, "cursor_end": cursor_pos}

    def inspect(self, code: str, cursor_pos: Optional[int] = None, detail_level: int = 0, timeout_sec: float = 3.0) -> Dict[str, Any]:
        """Sends inspect_request over ZeroMQ Shell socket and returns inspect_reply content."""
        if cursor_pos is None:
            cursor_pos = len(code)
        req_frames = serialize_message(
            msg_type="inspect_request",
            content={"code": code, "cursor_pos": cursor_pos, "detail_level": detail_level},
            session_id=self.session_id
        )
        self.shell_socket.send_multipart(req_frames)
        poller = zmq.Poller()
        poller.register(self.shell_socket, zmq.POLLIN)
        events = dict(poller.poll(int(timeout_sec * 1000)))
        if self.shell_socket in events:
            frames = self.shell_socket.recv_multipart()
            _, header, _, _, content = deserialize_message(frames)
            return content
        return {"status": "error", "found": False, "data": {}}

    def close(self):
        try:
            for s in [self.shell_socket, self.iopub_socket, self.control_socket, self.hb_socket, self.stdin_socket]:
                try:
                    s.close(linger=0)
                except Exception:
                    pass
            self.context.term()
        except Exception:
            pass

if __name__ == "__main__":
    client = ZMQKernelClient()
    print("Testing Heartbeat...")
    alive = client.ping_heartbeat(timeout_ms=500)
    print(f"Kernel is {'ALIVE' if alive else 'UNREACHABLE'}")
