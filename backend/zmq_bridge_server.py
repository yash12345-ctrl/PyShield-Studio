# pyright: reportIncompatibleMethodOverride=false
import os
import sys
import time
import json
import signal
import asyncio
import uuid
import tornado.ioloop  # type: ignore
import tornado.web  # type: ignore
import tornado.websocket  # type: ignore
from typing import Set, Dict, Optional, Any

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_ROOT)

from backend.kernel_manager import MappingKernelManager
from database.db import db

PORT = 5001
kernel_manager = MappingKernelManager()

class BaseApiHandler(tornado.web.RequestHandler):
    def set_default_headers(self) -> None:
        self.set_header("Access-Control-Allow-Origin", "*")
        self.set_header("Access-Control-Allow-Headers", "x-requested-with, content-type")
        self.set_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")

    def options(self, *args: Any, **kwargs: Any) -> None:
        self.set_status(204)
        self.finish()

    def post(self, *args: Any, **kwargs: Any) -> Any:  # type: ignore[override]
        pass

class RegisterHandler(BaseApiHandler):
    def post(self, *args: Any, **kwargs: Any) -> None:
        try:
            data = json.loads(self.request.body.decode('utf-8'))
            reg_no = data.get("registration_number", "").strip()
            password = data.get("password", "").strip()

            if not reg_no or not password:
                self.set_status(400)
                self.set_header("Content-Type", "application/json")
                self.write(json.dumps({
                    "status": "error",
                    "message": "Registration number and password are required"
                }))
                return

            res = db.create_candidate(reg_no, password)
            self.set_header("Content-Type", "application/json")
            if res.get("status") == "error":
                self.set_status(400)
            else:
                self.set_status(200)
            self.write(json.dumps(res))
        except Exception as e:
            self.set_status(500)
            self.set_header("Content-Type", "application/json")
            self.write(json.dumps({"status": "error", "message": str(e)}))

class LoginHandler(BaseApiHandler):
    def post(self, *args: Any, **kwargs: Any) -> None:
        try:
            data = json.loads(self.request.body.decode('utf-8'))
            reg_no = data.get("registration_number", "").strip()
            password = data.get("password", "").strip()

            if not reg_no or not password:
                self.set_status(400)
                self.set_header("Content-Type", "application/json")
                self.write(json.dumps({
                    "status": "error",
                    "message": "Registration number and password are required"
                }))
                return

            res = db.verify_candidate(reg_no, password)
            self.set_header("Content-Type", "application/json")
            if res.get("status") == "error":
                self.set_status(401)
            else:
                self.set_status(200)
                res["session_token"] = str(uuid.uuid4())
            self.write(json.dumps(res))
        except Exception as e:
            self.set_status(500)
            self.set_header("Content-Type", "application/json")
            self.write(json.dumps({"status": "error", "message": str(e)}))

class UserFoldersHandler(BaseApiHandler):
    def get(self, *args: Any, **kwargs: Any) -> None:
        try:
            reg_no = self.get_argument("registration_number", "").strip().upper()
            if not reg_no:
                self.set_status(400)
                self.set_header("Content-Type", "application/json")
                self.write(json.dumps({"status": "error", "message": "registration_number is required"}))
                return

            folders = db.get_user_folders(reg_no)
            self.set_header("Content-Type", "application/json")
            self.set_status(200)
            self.write(json.dumps({
                "status": "success",
                "registration_number": reg_no,
                "folders": folders
            }))
        except Exception as e:
            self.set_status(500)
            self.set_header("Content-Type", "application/json")
            self.write(json.dumps({"status": "error", "message": str(e)}))

    def post(self, *args: Any, **kwargs: Any) -> None:
        try:
            data = json.loads(self.request.body.decode('utf-8'))
            reg_no = data.get("registration_number", "").strip().upper()
            folder_name = data.get("folder_name", "").strip()
            description = data.get("description", "").strip()

            if not reg_no or not folder_name:
                self.set_status(400)
                self.set_header("Content-Type", "application/json")
                self.write(json.dumps({
                    "status": "error",
                    "message": "registration_number and folder_name are required"
                }))
                return

            res = db.create_user_folder(reg_no, folder_name, description)
            self.set_header("Content-Type", "application/json")
            if res.get("status") == "error":
                self.set_status(400)
            else:
                self.set_status(200)
            self.write(json.dumps(res))
        except Exception as e:
            self.set_status(500)
            self.set_header("Content-Type", "application/json")
            self.write(json.dumps({"status": "error", "message": str(e)}))

class HealthHandler(BaseApiHandler):
    def get(self, *args: Any, **kwargs: Any) -> None:
        self.set_header("Content-Type", "application/json")
        self.write(json.dumps({
            "status": "ok",
            "service": "PyShield Studio Local Bridge",
            "port": PORT
        }))

class VersionHandler(BaseApiHandler):
    def get(self, *args: Any, **kwargs: Any) -> None:
        self.set_header("Content-Type", "application/json")
        version_file = os.path.join(PROJECT_ROOT, "version.json")
        if not os.path.exists(version_file):
            version_file = os.path.join(PROJECT_ROOT, "frontend", "public", "version.json")

        if os.path.exists(version_file):
            try:
                with open(version_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.write(json.dumps(data))
                    return
            except Exception:
                pass

        self.write(json.dumps({
            "current_version": "1.0.0",
            "latest_version": "1.0.0",
            "release_date": "2025-04-15",
            "channel": "stable",
            "mandatory": False,
            "changelog": [
                "Initial official release (v1.0.0) of Python Notebook IDE",
                "Isolated Python kernel execution with WebSocket bridge",
                "Real-time variable inspector and memory tracking",
                "Integrated file explorer and offline notebook persistence (.ipynb)"
            ],
            "download_url": "/updates/latest",
            "status": "success"
        }))

    def post(self, *args: Any, **kwargs: Any) -> None:
        self.set_header("Content-Type", "application/json")
        try:
            payload = json.loads(self.request.body.decode('utf-8'))
            version_file = os.path.join(PROJECT_ROOT, "version.json")
            data = {}
            if os.path.exists(version_file):
                try:
                    with open(version_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                except Exception:
                    data = {}
            data.update(payload)
            with open(version_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            
            pub_file = os.path.join(PROJECT_ROOT, "frontend", "public", "version.json")
            try:
                with open(pub_file, "w", encoding="utf-8") as pf:
                    json.dump(data, pf, indent=2)
            except Exception:
                pass

            self.write(json.dumps({"status": "success", "version_data": data}))
        except Exception as e:
            self.set_status(500)
            self.write(json.dumps({"status": "error", "message": str(e)}))


class ExecuteHandler(BaseApiHandler):
    async def post(self, *args: Any, **kwargs: Any) -> Any:  # type: ignore[override]
        try:
            data = json.loads(self.request.body.decode('utf-8'))
            cell_id = data.get("cell_id", "cell-1")
            code = data.get("code", "")
            kernel_id = data.get("kernel_id", "default")

            kernel = kernel_manager.get_or_create_kernel(kernel_id)
            result = await asyncio.to_thread(
                kernel.execute,
                code=code,
                cell_id=cell_id
            )
            self.set_header("Content-Type", "application/json")
            self.set_status(200)
            self.write(json.dumps(result))
        except Exception as e:
            self.set_status(500)
            self.set_header("Content-Type", "application/json")
            self.write(json.dumps({
                "status": "error",
                "message": str(e),
                "error": {
                    "type": type(e).__name__,
                    "message": str(e)
                }
            }))

class KernelsListHandler(BaseApiHandler):
    def get(self, *args: Any, **kwargs: Any) -> None:
        """GET /api/kernels - Lists all active kernels matching Jupyter specification."""
        self.set_header("Content-Type", "application/json")
        self.write(json.dumps(kernel_manager.list_kernels()))

    def post(self, *args: Any, **kwargs: Any) -> None:
        """POST /api/kernels - Spawns a fresh kernel on dynamic ephemeral ports."""
        try:
            body = json.loads(self.request.body.decode('utf-8')) if self.request.body else {}
        except Exception:
            body = {}
        kid = body.get("name") or body.get("kernel_id")
        km = kernel_manager.start_new_kernel(kernel_id=kid)
        self.set_header("Content-Type", "application/json")
        self.set_status(201)
        self.write(json.dumps(km.get_info()))

class KernelDetailHandler(BaseApiHandler):
    def get(self, kernel_id: str = "", *args: Any, **kwargs: Any) -> None:
        """GET /api/kernels/<kernel_id> - Gets details of specific kernel."""
        info = kernel_manager.get_kernel_info(kernel_id)
        if not info:
            self.set_status(404)
            self.set_header("Content-Type", "application/json")
            self.write(json.dumps({"status": "error", "message": f"Kernel '{kernel_id}' not found"}))
            return
        self.set_header("Content-Type", "application/json")
        self.write(json.dumps(info))

    def delete(self, kernel_id: str = "", *args: Any, **kwargs: Any) -> None:
        """DELETE /api/kernels/<kernel_id> - Shuts down and cleans up specific kernel."""
        success = kernel_manager.shutdown_kernel(kernel_id)
        if not success:
            self.set_status(404)
            self.set_header("Content-Type", "application/json")
            self.write(json.dumps({"status": "error", "message": f"Kernel '{kernel_id}' not found"}))
            return
        self.set_status(204)

class KernelRestartHandler(BaseApiHandler):
    async def post(self, kernel_id: str = "", *args: Any, **kwargs: Any) -> Any:  # type: ignore[override]
        """POST /api/kernels/<kernel_id>/restart - Restarts specific kernel with dynamic ports."""
        res = await asyncio.to_thread(kernel_manager.restart_kernel, kernel_id, True)
        self.set_header("Content-Type", "application/json")
        self.write(json.dumps(res))

class KernelInterruptHandler(BaseApiHandler):
    async def post(self, kernel_id: str = "", *args: Any, **kwargs: Any) -> Any:  # type: ignore[override]
        """POST /api/kernels/<kernel_id>/interrupt - Interrupts specific kernel."""
        res = await asyncio.to_thread(kernel_manager.interrupt_kernel, kernel_id)
        self.set_header("Content-Type", "application/json")
        self.write(json.dumps(res))

class KernelCompleteHandler(BaseApiHandler):
    async def post(self, kernel_id: str = "", *args: Any, **kwargs: Any) -> Any:  # type: ignore[override]
        """POST /api/kernels/<kernel_id>/complete - Code completion via IPython runtime."""
        try:
            data = json.loads(self.request.body.decode('utf-8'))
            code = data.get("code", "")
            cursor_pos = data.get("cursor_pos", len(code))
            res = await asyncio.to_thread(kernel_manager.complete, kernel_id, code, cursor_pos)
            self.set_header("Content-Type", "application/json")
            self.write(json.dumps(res))
        except Exception as e:
            self.set_status(500)
            self.set_header("Content-Type", "application/json")
            self.write(json.dumps({"status": "error", "message": str(e)}))

class KernelInspectHandler(BaseApiHandler):
    async def post(self, kernel_id: str = "", *args: Any, **kwargs: Any) -> Any:  # type: ignore[override]
        """POST /api/kernels/<kernel_id>/inspect - Object documentation / tooltip."""
        try:
            data = json.loads(self.request.body.decode('utf-8'))
            code = data.get("code", "")
            cursor_pos = data.get("cursor_pos", len(code))
            detail_level = data.get("detail_level", 0)
            res = await asyncio.to_thread(kernel_manager.inspect, kernel_id, code, cursor_pos, detail_level)
            self.set_header("Content-Type", "application/json")
            self.write(json.dumps(res))
        except Exception as e:
            self.set_status(500)
            self.set_header("Content-Type", "application/json")
            self.write(json.dumps({"status": "error", "message": str(e)}))

class DatasetsHandler(BaseApiHandler):
    def get(self, *args: Any, **kwargs: Any) -> None:
        try:
            lab = self.get_query_argument("lab", None)
            category = self.get_query_argument("category", None)
            lab_num = int(lab) if lab and lab.isdigit() else None
            datasets = db.list_datasets(lab_number=lab_num, category=category)
            self.set_header("Content-Type", "application/json")
            self.set_status(200)
            self.write(json.dumps({
                "status": "success",
                "total": len(datasets),
                "datasets": datasets
            }))
        except Exception as e:
            self.set_status(500)
            self.set_header("Content-Type", "application/json")
            self.write(json.dumps({"status": "error", "message": str(e)}))

class KernelWebSocketHandler(tornado.websocket.WebSocketHandler):
    # Mapping from kernel_id to active WebSocket instances
    kernel_clients: Dict[str, Set['KernelWebSocketHandler']] = {}
    all_clients: Set['KernelWebSocketHandler'] = set()

    def check_origin(self, origin: str) -> bool:
        # Allow connections from local frontend (Vite/Electron)
        return True

    def open(self, kernel_id_path: Optional[str] = None, *args: Any, **kwargs: Any) -> None:
        # Extract kernel_id from URL path (/api/kernels/<id>/channels) or query param (?kernel_id=xyz)
        kid = kernel_id_path or self.get_query_argument("kernel_id", None) or self.get_query_argument("session_id", None) or "default"
        self.kernel_id = kid

        KernelWebSocketHandler.all_clients.add(self)
        if self.kernel_id not in KernelWebSocketHandler.kernel_clients:
            KernelWebSocketHandler.kernel_clients[self.kernel_id] = set()
        KernelWebSocketHandler.kernel_clients[self.kernel_id].add(self)

        kernel = kernel_manager.get_or_create_kernel(self.kernel_id)

        loop = tornado.ioloop.IOLoop.current()

        def on_death(kid, exit_code):
            sig_name = " (Segmentation Fault / SIGSEGV)" if exit_code == -11 else f" (Signal {-exit_code})" if exit_code and exit_code < 0 else f" (Exit code {exit_code})"
            msg = json.dumps({
                "type": "kernel_status",
                "kernel_id": kid,
                "connected": False,
                "state": "dead",
                "message": f"Kernel process crashed{sig_name}. PyShield server is auto-recovering a fresh kernel..."
            })
            clients = KernelWebSocketHandler.kernel_clients.get(kid, set())
            for c in list(clients):
                loop.add_callback(lambda client=c: client.write_message(msg) if client.ws_connection else None)

        kernel.add_death_callback(on_death)

        is_alive = kernel.is_alive()
        ports_dict = {
            "shell": kernel.config.get("shell_port"),
            "iopub": kernel.config.get("iopub_port"),
            "control": kernel.config.get("control_port"),
            "hb": kernel.config.get("hb_port"),
            "stdin": kernel.config.get("stdin_port")
        } if kernel.config else None

        self.write_message(json.dumps({
            "type": "kernel_status",
            "kernel_id": self.kernel_id,
            "connected": is_alive,
            "pid": kernel.process.pid if kernel.process else None,
            "ports": ports_dict,
            "message": "Connected to isolated Python ipykernel" if is_alive else "Kernel unreachable"
        }))

    async def _handle_execute(self, cell_id: str, code: str):
        # Notify start of execution
        if self.ws_connection:
            self.write_message(json.dumps({
                "type": "status",
                "cell_id": cell_id,
                "kernel_id": self.kernel_id,
                "state": "busy"
            }))

        loop = tornado.ioloop.IOLoop.current()

        def stream_callback(stream_name, text):
            def send():
                try:
                    if self.ws_connection:
                        self.write_message(json.dumps({
                            "type": "stream",
                            "cell_id": cell_id,
                            "kernel_id": self.kernel_id,
                            "name": stream_name,
                            "text": text
                        }))
                except Exception:
                    pass
            loop.add_callback(send)

        def input_request_callback(prompt, password, cid):
            def send_input_req():
                try:
                    if self.ws_connection:
                        self.write_message(json.dumps({
                            "type": "input_request",
                            "cell_id": cid,
                            "kernel_id": self.kernel_id,
                            "prompt": prompt,
                            "password": password
                        }))
                except Exception:
                    pass
            loop.add_callback(send_input_req)

        try:
            kernel = kernel_manager.get_or_create_kernel(self.kernel_id)
            result = await asyncio.to_thread(
                kernel.execute,
                code=code,
                cell_id=cell_id,
                on_stream_callback=stream_callback,
                on_input_request_callback=input_request_callback
            )

            # Send final execution payload
            if self.ws_connection:
                self.write_message(json.dumps({
                    "type": "execute_reply",
                    "cell_id": cell_id,
                    "kernel_id": self.kernel_id,
                    "result": result
                }))

                # Notify status
                self.write_message(json.dumps({
                    "type": "status",
                    "cell_id": cell_id,
                    "kernel_id": self.kernel_id,
                    "state": "idle" if kernel.is_alive() else "dead"
                }))
        except Exception as e:
            if self.ws_connection:
                self.write_message(json.dumps({
                    "type": "error",
                    "kernel_id": self.kernel_id,
                    "message": str(e)
                }))

    async def _handle_restart(self):
        try:
            kernel = kernel_manager.get_or_create_kernel(self.kernel_id)
            result = await asyncio.to_thread(kernel.restart_kernel, True)
            ports_dict = {
                "shell": kernel.config.get("shell_port"),
                "iopub": kernel.config.get("iopub_port"),
                "control": kernel.config.get("control_port"),
                "hb": kernel.config.get("hb_port"),
                "stdin": kernel.config.get("stdin_port")
            } if kernel.config else None

            if self.ws_connection:
                self.write_message(json.dumps({
                    "type": "kernel_restarted",
                    "kernel_id": self.kernel_id,
                    "status": "ok",
                    "pid": kernel.process.pid if kernel.process else None,
                    "ports": ports_dict,
                    "message": "Kernel restarted successfully with fresh process isolation and dynamic ports."
                }))
                self.write_message(json.dumps({
                    "type": "status",
                    "kernel_id": self.kernel_id,
                    "state": "idle"
                }))
        except Exception as e:
            if self.ws_connection:
                self.write_message(json.dumps({"type": "error", "kernel_id": self.kernel_id, "message": str(e)}))

    async def _handle_interrupt(self):
        try:
            kernel = kernel_manager.get_or_create_kernel(self.kernel_id)
            result = await asyncio.to_thread(kernel.interrupt_kernel)
            if self.ws_connection:
                self.write_message(json.dumps({
                    "type": "kernel_interrupted",
                    "kernel_id": self.kernel_id,
                    "status": "ok",
                    "message": "Kernel execution interrupted."
                }))
        except Exception as e:
            if self.ws_connection:
                self.write_message(json.dumps({"type": "error", "kernel_id": self.kernel_id, "message": str(e)}))

    async def _handle_complete(self, msg_id: str, code: str, cursor_pos: int, cell_id: Optional[str] = None):
        try:
            res = await asyncio.to_thread(kernel_manager.complete, self.kernel_id, code, cursor_pos)
            if self.ws_connection:
                self.write_message(json.dumps({
                    "type": "complete_reply",
                    "msg_id": msg_id,
                    "cell_id": cell_id,
                    "kernel_id": self.kernel_id,
                    **res
                }))
        except Exception as e:
            if self.ws_connection:
                self.write_message(json.dumps({
                    "type": "complete_reply",
                    "msg_id": msg_id,
                    "cell_id": cell_id,
                    "kernel_id": self.kernel_id,
                    "status": "error",
                    "matches": [],
                    "message": str(e)
                }))

    async def _handle_inspect(self, msg_id: str, code: str, cursor_pos: int, detail_level: int = 0, cell_id: Optional[str] = None):
        try:
            res = await asyncio.to_thread(kernel_manager.inspect, self.kernel_id, code, cursor_pos, detail_level)
            if self.ws_connection:
                self.write_message(json.dumps({
                    "type": "inspect_reply",
                    "msg_id": msg_id,
                    "cell_id": cell_id,
                    "kernel_id": self.kernel_id,
                    **res
                }))
        except Exception as e:
            if self.ws_connection:
                self.write_message(json.dumps({
                    "type": "inspect_reply",
                    "msg_id": msg_id,
                    "cell_id": cell_id,
                    "kernel_id": self.kernel_id,
                    "status": "error",
                    "found": False,
                    "data": {},
                    "message": str(e)
                }))

    def on_message(self, message):
        try:
            data = json.loads(message)
            msg_type = data.get("type")

            if msg_type == "ping":
                kernel = kernel_manager.get_or_create_kernel(self.kernel_id)
                is_alive = kernel.is_alive()
                self.write_message(json.dumps({
                    "type": "pong",
                    "kernel_id": self.kernel_id,
                    "alive": is_alive
                }))

            elif msg_type == "execute":
                cell_id = data.get("cell_id", "cell-1")
                code = data.get("code", "")
                asyncio.create_task(self._handle_execute(cell_id, code))

            elif msg_type == "input_reply":
                val = data.get("value", "")
                kernel = kernel_manager.get_or_create_kernel(self.kernel_id)
                if kernel.client:
                    kernel.client.submit_input_reply(val)

            elif msg_type == "restart_kernel":
                asyncio.create_task(self._handle_restart())

            elif msg_type == "interrupt_kernel":
                asyncio.create_task(self._handle_interrupt())

            elif msg_type in ("complete_request", "complete"):
                msg_id = data.get("msg_id") or str(time.time())
                code = data.get("code", "")
                cursor_pos = data.get("cursor_pos", len(code))
                cell_id = data.get("cell_id")
                asyncio.create_task(self._handle_complete(msg_id, code, cursor_pos, cell_id))

            elif msg_type in ("inspect_request", "inspect"):
                msg_id = data.get("msg_id") or str(time.time())
                code = data.get("code", "")
                cursor_pos = data.get("cursor_pos", len(code))
                detail_level = data.get("detail_level", 0)
                cell_id = data.get("cell_id")
                asyncio.create_task(self._handle_inspect(msg_id, code, cursor_pos, detail_level, cell_id))

        except Exception as e:
            try:
                if self.ws_connection:
                    self.write_message(json.dumps({
                        "type": "error",
                        "kernel_id": getattr(self, "kernel_id", "unknown"),
                        "message": str(e)
                    }))
            except Exception:
                pass

    def on_close(self):
        KernelWebSocketHandler.all_clients.discard(self)
        if hasattr(self, "kernel_id") and self.kernel_id in KernelWebSocketHandler.kernel_clients:
            KernelWebSocketHandler.kernel_clients[self.kernel_id].discard(self)
            if not KernelWebSocketHandler.kernel_clients[self.kernel_id]:
                del KernelWebSocketHandler.kernel_clients[self.kernel_id]

def make_app():
    return tornado.web.Application([
        (r"/ws", KernelWebSocketHandler),
        (r"/api/kernels/([^/]+)/channels", KernelWebSocketHandler),
        (r"/api/kernels", KernelsListHandler),
        (r"/api/kernels/([^/]+)/restart", KernelRestartHandler),
        (r"/api/kernels/([^/]+)/interrupt", KernelInterruptHandler),
        (r"/api/kernels/([^/]+)/complete", KernelCompleteHandler),
        (r"/api/kernels/([^/]+)/inspect", KernelInspectHandler),
        (r"/api/kernels/([^/]+)", KernelDetailHandler),
        (r"/api/execute", ExecuteHandler),
        (r"/api/datasets", DatasetsHandler),
        (r"/api/register", RegisterHandler),
        (r"/api/login", LoginHandler),
        (r"/api/user-folders", UserFoldersHandler),
        (r"/api/health", HealthHandler),
        (r"/api/version", VersionHandler),
    ])

def start_bridge_server():
    app = make_app()
    app.listen(PORT)
    print(f"✓ ZeroMQ-to-Frontend WebSocket Bridge listening on ws://127.0.0.1:{PORT}/ws")
    print(f"✓ Candidate DB REST API listening on http://127.0.0.1:{PORT}/api/register")

    # Pre-spawn supervised isolated kernel subprocess
    try:
        kernel_manager.get_or_create_kernel("default")
    except Exception as e:
        print(f"Initial kernel startup notice: {e}")

    def shutdown(sig, frame):
        print("\nShutting down bridge server and cleaning up isolated kernels...")
        kernel_manager.shutdown_all()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    tornado.ioloop.IOLoop.current().start()

if __name__ == "__main__":
    start_bridge_server()
