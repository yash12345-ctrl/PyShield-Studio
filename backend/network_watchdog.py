import socket
import os
from typing import Tuple, List

try:
    import psutil  # type: ignore
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False

def check_network_connectivity() -> Tuple[bool, List[str]]:
    """
    Checks if any active non-loopback network interface (Wi-Fi, Ethernet, Hotspot)
    or external gateway is active.
    
    Returns:
        (is_online: bool, active_interfaces: List[str])
    """
    detected_interfaces = []

    # 1. Check network interfaces via psutil if available
    if HAS_PSUTIL:
        interfaces = psutil.net_if_addrs()
        stats = psutil.net_if_stats()

        for iface_name, addrs in interfaces.items():
            # Skip loopback interface
            if iface_name.lower().startswith(('lo', 'loopback')):
                continue

            # Check if interface is UP
            stat = stats.get(iface_name)
            if stat and stat.isup:
                for addr in addrs:
                    # Check for active IPv4 or IPv6 (excluding local link-local)
                    if addr.family == socket.AF_INET and not addr.address.startswith("127."):
                        detected_interfaces.append(f"{iface_name} ({addr.address})")
                    elif addr.family == socket.AF_INET6 and not addr.address.startswith("::1"):
                        detected_interfaces.append(f"{iface_name} (IPv6)")

    # 2. Socket check: Probe standard DNS port (8.8.8.8:53 or 1.1.1.1:53) with 0.3s timeout
    socket_online = False
    for test_host in ("1.1.1.1", "8.8.8.8"):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(0.3)
            s.connect((test_host, 53))
            s.close()
            socket_online = True
            if "Internet Gateway Reachable" not in detected_interfaces:
                detected_interfaces.append("Internet Gateway Reachable")
            break
        except (socket.timeout, OSError):
            pass

    is_online = len(detected_interfaces) > 0 or socket_online
    return is_online, detected_interfaces

if __name__ == "__main__":
    online, ifaces = check_network_connectivity()
    print(f"Network Status: {'ONLINE (VIOLATION)' if online else 'OFFLINE (SECURED)'}")
    if ifaces:
        print(f"Active Interfaces: {', '.join(ifaces)}")
