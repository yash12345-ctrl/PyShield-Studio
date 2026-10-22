import os
import sys
import subprocess
import time
import signal

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_ROOT)
os.chdir(PROJECT_ROOT)

PYTHON_EXE = os.environ.get("PYSHIELD_PYTHON_EXE", sys.executable)

def free_ports(ports=(5001,)):
    """Automatically frees the HTTP/WS bridge port if occupied by stale processes."""
    try:
        import psutil
        current_pid = os.getpid()
        for conn in psutil.net_connections(kind='inet'):
            if conn.laddr and conn.laddr.port in ports and conn.pid and conn.pid != current_pid:
                try:
                    p = psutil.Process(conn.pid)
                    p.terminate()
                except Exception:
                    pass
    except Exception:
        for port in ports:
            try:
                subprocess.run(
                    ["fuser", "-k", f"{port}/tcp"],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
            except Exception:
                pass
    time.sleep(0.3)

def cleanup_stale_connections():
    """Removes any stale .kernel_connections left from previous runs."""
    conn_dir = os.environ.get("PYSHIELD_CONNECTIONS_DIR", os.path.join(PROJECT_ROOT, ".kernel_connections"))
    if os.path.exists(conn_dir):
        for f in os.listdir(conn_dir):
            if f.endswith(".json"):
                try:
                    os.remove(os.path.join(conn_dir, f))
                except Exception:
                    pass

def main():
    print("=" * 60)
    print("  PyShield Studio - Backend Services (Dynamic Port Concurrency)")
    print("=" * 60)

    # Free port 5001 and cleanup stale connection files
    free_ports()
    cleanup_stale_connections()

    # Start WebSocket & REST Bridge Server (Tornado with MappingKernelManager supervisor)
    bridge_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "zmq_bridge_server.py")
    print("\nStarting PyShield Server with Ephemeral Dynamic Kernel Concurrency...")
    bridge_proc = subprocess.Popen([PYTHON_EXE, bridge_script])

    print("\n✓ Backend successfully initialized with Dynamic Port Allocation!")
    print("  • REST API:    http://127.0.0.1:5001/api/register & /api/kernels")
    print("  • WebSocket:   ws://127.0.0.1:5001/ws?kernel_id=<id>")
    print("  • Database:    database/pyshield.db")
    print("  • Concurrency: Unlimited isolated kernels on ephemeral dynamic OS ports")
    print("\nPress Ctrl+C to terminate all backend services.\n")

    def signal_handler(sig, frame):
        print("\nShutting down backend services...")
        try:
            bridge_proc.terminate()
            bridge_proc.wait(timeout=2)
        except Exception:
            try:
                bridge_proc.kill()
            except Exception:
                pass
        free_ports()
        print("✓ All backend services stopped.")
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    try:
        bridge_proc.wait()
    except KeyboardInterrupt:
        signal_handler(None, None)

if __name__ == "__main__":
    main()
