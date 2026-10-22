import os
import sys
import json
import uuid
import time
import socket
import signal
import re
import threading
import subprocess
from typing import Dict, Any, Optional, List, Callable

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.zmq_client import ZMQKernelClient

CONNECTION_DIR = os.environ.get("PYSHIELD_CONNECTIONS_DIR", os.path.join(PROJECT_ROOT, ".kernel_connections"))
os.makedirs(CONNECTION_DIR, exist_ok=True)
KERNEL_SERVER_SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "zmq_kernel_server.py")
PYTHON_EXE = os.environ.get("PYSHIELD_PYTHON_EXE", sys.executable)

def find_available_ports(count: int = 5, ip: str = "127.0.0.1") -> List[int]:
    """
    Finds `count` available TCP ports on loopback IP using dynamic OS allocation.
    """
    sockets = []
    ports = []
    try:
        for _ in range(count):
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            s.bind((ip, 0))
            ports.append(s.getsockname()[1])
            sockets.append(s)
    finally:
        for s in sockets:
            s.close()
    return ports


class SubprocessKernelManager:
    """
    Manages the lifecycle of a dedicated, isolated Python ipykernel subprocess
    mirroring the official Jupyter Notebook KernelManager architecture.

    Key Features:
    - Dedicated OS process per kernel (complete fault isolation).
    - C/C++ segmentation faults (SIGSEGV), aborts (SIGABRT), or memory violations
      only terminate the child kernel subprocess without affecting the server.
    - Automatic crash detection, rich KernelCrashError diagnostic reporting, and auto-recovery.
    - Real POSIX SIGINT interruption via process PID.
    - Dynamic port allocation with connection files.
    """
    def __init__(self, kernel_id: Optional[str] = None, ip: str = "127.0.0.1"):
        self.kernel_id = kernel_id or f"kernel-{uuid.uuid4().hex[:8]}"
        self.ip = ip
        self.config: Dict[str, Any] = {}
        # Ensure connection file is a safe filename (no slashes, spaces, or illegal path chars)
        safe_kid = re.sub(r'[^a-zA-Z0-9_\-]', '-', self.kernel_id)
        self.connection_file = os.path.join(CONNECTION_DIR, f"{safe_kid}.json")
        self.process: Optional[subprocess.Popen] = None
        self.client: Optional[ZMQKernelClient] = None
        self.status: str = "idle"  # starting, idle, busy, dead, restarting, shutdown
        self.last_exit_code: Optional[int] = None
        self.on_death_callbacks: List[Callable[[str, int], None]] = []
        self._monitor_thread: Optional[threading.Thread] = None
        self._stopping: bool = False
        self._lock = threading.RLock()

    def add_death_callback(self, cb: Callable[[str, int], None]):
        """Registers a callback when kernel process unexpectedly dies."""
        self.on_death_callbacks.append(cb)

    def is_alive(self) -> bool:
        """Returns True if the kernel subprocess is currently running."""
        if self.process is None:
            return False
        return self.process.poll() is None

    def start_kernel(self, ports: Optional[List[int]] = None) -> Dict[str, Any]:
        """
        Allocates ports, writes a connection file, and launches the isolated
        ZeroMQ Kernel Server as a supervised child subprocess.
        """
        with self._lock:
            self._stopping = False
            self.status = "starting"

            os.makedirs(CONNECTION_DIR, exist_ok=True)

            if ports and len(ports) >= 5:
                p_shell, p_iopub, p_ctrl, p_hb, p_stdin = ports[:5]
            else:
                p_shell, p_iopub, p_ctrl, p_hb, p_stdin = find_available_ports(5, self.ip)

            self.config = {
                "ip": self.ip,
                "shell_port": p_shell,
                "iopub_port": p_iopub,
                "control_port": p_ctrl,
                "hb_port": p_hb,
                "stdin_port": p_stdin,
                "transport": "tcp",
                "kernel_id": self.kernel_id
            }

            with open(self.connection_file, "w", encoding="utf-8") as f:
                json.dump(self.config, f, indent=2)

            # Launch isolated subprocess
            cmd = [
                PYTHON_EXE,
                KERNEL_SERVER_SCRIPT,
                "--connection-file",
                self.connection_file
            ]

            self.process = subprocess.Popen(
                cmd,
                cwd=PROJECT_ROOT,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                preexec_fn=os.setsid if hasattr(os, "setsid") else None
            )

            # Connect client once kernel server binds
            self.client = ZMQKernelClient(self.config)

            # Verify heartbeat liveness
            alive = False
            for _ in range(30):
                if not self.is_alive():
                    break
                if self.client.ping_heartbeat(timeout_ms=150):
                    alive = True
                    break
                time.sleep(0.1)

            if not self.is_alive():
                self.status = "dead"
                raise RuntimeError(f"Kernel subprocess failed to start. Process exit code: {self.process.poll()}")

            self.status = "idle"
            self.last_exit_code = None

            # Start real-time process supervisor thread
            self._monitor_thread = threading.Thread(target=self._monitor_loop, daemon=True)
            self._monitor_thread.start()

            print(f"✓ Isolated Kernel [{self.kernel_id}] started (PID: {self.process.pid}) on ports {p_shell}-{p_stdin}")
            return self.config

    def _monitor_loop(self):
        """Supervises the child process and immediately detects any unhandled crash."""
        if not self.process:
            return

        returncode = self.process.wait()
        self.last_exit_code = returncode

        if not self._stopping:
            self.status = "dead"
            signal_name = ""
            if returncode < 0:
                sig_num = -returncode
                try:
                    signal_name = f" ({signal.Signals(sig_num).name})"
                except Exception:
                    signal_name = f" (Signal {sig_num})"

            print(f"⚠️ Kernel [{self.kernel_id}] process crashed with exit code {returncode}{signal_name}!")

            # Notify listeners of kernel crash
            for cb in list(self.on_death_callbacks):
                try:
                    cb(self.kernel_id, returncode)
                except Exception as e:
                    print(f"Error in death callback: {e}")

    def interrupt_kernel(self) -> Dict[str, Any]:
        """
        Interrupts running execution. First attempts direct POSIX SIGINT
        to the subprocess PID, then dispatches interrupt_request over Control socket.
        """
        if not self.is_alive():
            return {"status": "error", "message": "Kernel is not running."}

        # 1. Send direct POSIX SIGINT signal to subprocess (Jupyter standard)
        try:
            if hasattr(os, "kill"):
                os.kill(self.process.pid, signal.SIGINT)
        except Exception:
            pass

        # 2. Also send Control socket interrupt_request for redundancy
        try:
            if self.client:
                return self.client.interrupt_kernel()
        except Exception:
            pass

        return {"status": "ok", "message": "Interrupt signal dispatched to kernel process"}

    def restart_kernel(self, now: bool = False, ports: Optional[List[int]] = None) -> Dict[str, Any]:
        """
        Restarts the kernel.
        If `now` is True or the process is dead, cleanly terminates the old process
        and spawns a fresh subprocess.
        If alive and `now` is False, requests soft restart via ZeroMQ Control socket.
        """
        with self._lock:
            # If process is alive and soft restart is requested
            if self.is_alive() and not now:
                try:
                    res = self.client.restart_kernel()
                    if res.get("status") == "ok":
                        self.status = "idle"
                        return res
                except Exception:
                    pass

            # Hard restart: kill old process & start fresh
            self.status = "restarting"
            self._stopping = True

            if self.process and self.process.poll() is None:
                try:
                    self.process.terminate()
                    self.process.wait(timeout=1.0)
                except Exception:
                    try:
                        self.process.kill()
                        self.process.wait(timeout=0.5)
                    except Exception:
                        pass

            if self.client:
                try:
                    self.client.close()
                except Exception:
                    pass
                self.client = None

            time.sleep(0.05)

            # Start fresh kernel with fresh dynamic ports
            self.start_kernel(ports=ports)
            return {"status": "ok", "message": "Kernel restarted successfully with fresh process isolation."}

    def execute(
        self,
        code: str,
        cell_id: str = "cell-1",
        on_stream_callback: Optional[Callable[[str, str], None]] = None,
        on_input_request_callback: Optional[Callable[[str, bool, str], None]] = None,
        timeout_sec: float = 120.0
    ) -> Dict[str, Any]:
        """
        Executes code on the isolated kernel subprocess with real-time crash protection.
        If code triggers a C/C++ segmentation fault, SIGABRT, or crash:
        - The server survives unharmed.
        - Returns a structured KernelCrashError.
        - The next execution or restart cleanly revives a fresh replacement kernel.
        """
        # Auto-recover if kernel is currently dead
        if not self.is_alive():
            print(f"Reviving dead kernel [{self.kernel_id}] before executing cell...")
            self.restart_kernel(now=True)

        self.status = "busy"
        start_time = time.time()

        try:
            result = self.client.execute(
                code=code,
                cell_id=cell_id,
                on_stream_callback=on_stream_callback,
                on_input_request_callback=on_input_request_callback,
                timeout_sec=timeout_sec,
                is_alive_check=self.is_alive
            )

            # Check if process crashed during execution
            if not self.is_alive():
                exit_code = self.process.poll() if self.process else -11
                signal_desc = "Segmentation Fault (SIGSEGV)" if exit_code == -11 else f"Signal {-exit_code}" if exit_code and exit_code < 0 else f"Exit code {exit_code}"

                result = {
                    "status": "error",
                    "execution_count": None,
                    "stdout": result.get("stdout", ""),
                    "stderr": f"\n[PyShield Process Isolation] Kernel process terminated unexpectedly: {signal_desc}\n",
                    "result_repr": None,
                    "html_table": None,
                    "images": [],
                    "data": {},
                    "displays": [],
                    "svg": None,
                    "latex": None,
                    "json_data": None,
                    "error": {
                        "type": "KernelCrashError",
                        "message": f"Kernel process terminated unexpectedly ({signal_desc}).",
                        "traceback": (
                            f"KernelCrashError: The Python kernel process died while executing cell '{cell_id}'.\n"
                            f"Cause: Native fault / {signal_desc}.\n\n"
                            f"🛡️ PyShield Process Isolation protected the server from crashing.\n"
                            f"✓ A fresh replacement kernel is automatically spawned on your next execution."
                        )
                    },
                    "execution_time_ms": round((time.time() - start_time) * 1000, 2)
                }

            return result

        finally:
            if self.is_alive():
                self.status = "idle"

    def complete(self, code: str, cursor_pos: Optional[int] = None) -> Dict[str, Any]:
        """Queries kernel for code completions at the given cursor position."""
        if not self.is_alive():
            self.start_kernel()
        if self.client:
            return self.client.complete(code, cursor_pos)
        return {"status": "error", "matches": [], "cursor_start": cursor_pos or 0, "cursor_end": cursor_pos or 0}

    def inspect(self, code: str, cursor_pos: Optional[int] = None, detail_level: int = 0) -> Dict[str, Any]:
        """Queries kernel for object inspection / documentation at the given cursor position."""
        if not self.is_alive():
            self.start_kernel()
        if self.client:
            return self.client.inspect(code, cursor_pos, detail_level)
        return {"status": "error", "found": False, "data": {}}

    def shutdown(self):
        """Cleanly shuts down the child process and frees all resources."""
        self._stopping = True
        self.status = "shutdown"

        if self.client:
            try:
                self.client.close()
            except Exception:
                pass

        if self.process and self.process.poll() is None:
            try:
                self.process.terminate()
                self.process.wait(timeout=1.0)
            except Exception:
                try:
                    self.process.kill()
                except Exception:
                    pass

        if os.path.exists(self.connection_file):
            try:
                os.remove(self.connection_file)
            except Exception:
                pass

    def get_info(self) -> Dict[str, Any]:
        """Returns structured metadata about this kernel subprocess."""
        return {
            "id": self.kernel_id,
            "name": "python3",
            "pid": self.process.pid if self.process else None,
            "execution_state": self.status,
            "status": self.status,
            "alive": self.is_alive(),
            "ports": {
                "shell": self.config.get("shell_port"),
                "iopub": self.config.get("iopub_port"),
                "control": self.config.get("control_port"),
                "hb": self.config.get("hb_port"),
                "stdin": self.config.get("stdin_port")
            } if self.config else None,
            "connection_file": self.connection_file
        }


class MappingKernelManager:
    """
    Orchestrates multiple isolated kernel subprocesses across notebook sessions,
    matching Jupyter's MappingKernelManager architecture.
    Provides 100% ephemeral dynamic port allocation and concurrency for unlimited kernels.
    """
    def __init__(self, ip: str = "127.0.0.1"):
        self.ip = ip
        self.kernels: Dict[str, SubprocessKernelManager] = {}
        self._lock = threading.RLock()

    def get_or_create_kernel(self, kernel_id: Optional[str] = None) -> SubprocessKernelManager:
        """Retrieves an active kernel or launches a new isolated subprocess with dynamic ephemeral ports."""
        with self._lock:
            kid = kernel_id or f"kernel-{uuid.uuid4().hex[:8]}"
            if kid not in self.kernels or not self.kernels[kid].is_alive():
                # If existing is dead, clean it up
                if kid in self.kernels:
                    self.kernels[kid].shutdown()

                # Always use 100% dynamic ephemeral ports allocated by the OS
                km = SubprocessKernelManager(kernel_id=kid, ip=self.ip)
                km.start_kernel(ports=None)
                self.kernels[kid] = km

            return self.kernels[kid]

    def start_new_kernel(self, kernel_id: Optional[str] = None) -> SubprocessKernelManager:
        """Explicitly starts a new isolated kernel with dynamic ephemeral ports."""
        with self._lock:
            kid = kernel_id or f"kernel-{uuid.uuid4().hex[:8]}"
            if kid in self.kernels and self.kernels[kid].is_alive():
                return self.kernels[kid]

            km = SubprocessKernelManager(kernel_id=kid, ip=self.ip)
            km.start_kernel(ports=None)
            self.kernels[kid] = km
            return km

    def get_kernel(self, kernel_id: str) -> Optional[SubprocessKernelManager]:
        """Retrieves a kernel if it exists and is alive."""
        with self._lock:
            km = self.kernels.get(kernel_id)
            if km and km.is_alive():
                return km
            return None

    def get_kernel_info(self, kernel_id: str) -> Optional[Dict[str, Any]]:
        """Returns structured metadata for a specific kernel."""
        with self._lock:
            km = self.kernels.get(kernel_id)
            if km:
                return km.get_info()
            return None

    def list_kernels(self) -> List[Dict[str, Any]]:
        """Returns a list of all currently active kernels matching Jupyter's schema."""
        with self._lock:
            # Clean up dead kernels from tracking
            active = []
            for kid, km in list(self.kernels.items()):
                if km.is_alive():
                    active.append(km.get_info())
            return active

    def shutdown_kernel(self, kernel_id: str) -> bool:
        """Terminates and unregisters a specific kernel subprocess."""
        with self._lock:
            km = self.kernels.pop(kernel_id, None)
            if km:
                km.shutdown()
                return True
            return False

    def restart_kernel(self, kernel_id: str = "default", now: bool = False) -> Dict[str, Any]:
        """Restarts a specified kernel subprocess with fresh ephemeral ports."""
        km = self.get_or_create_kernel(kernel_id)
        return km.restart_kernel(now=now, ports=None)

    def interrupt_kernel(self, kernel_id: str = "default") -> Dict[str, Any]:
        """Interrupts a specified kernel subprocess via POSIX signal."""
        km = self.get_or_create_kernel(kernel_id)
        return km.interrupt_kernel()

    def complete(self, kernel_id: str, code: str, cursor_pos: Optional[int] = None) -> Dict[str, Any]:
        """Queries kernel for code completions at the given cursor position."""
        km = self.get_or_create_kernel(kernel_id)
        return km.complete(code, cursor_pos)

    def inspect(self, kernel_id: str, code: str, cursor_pos: Optional[int] = None, detail_level: int = 0) -> Dict[str, Any]:
        """Queries kernel for object inspection / documentation at the given cursor position."""
        km = self.get_or_create_kernel(kernel_id)
        return km.inspect(code, cursor_pos, detail_level)

    def shutdown_all(self):
        """Terminates all managed kernel subprocesses cleanly."""
        with self._lock:
            for kid, km in list(self.kernels.items()):
                try:
                    km.shutdown()
                except Exception:
                    pass
            self.kernels.clear()
            print("✓ All isolated kernel subprocesses terminated cleanly.")
