import json
import uuid
import time
from typing import Dict, Any, List, Tuple

DELIMITER = b"<IDS|MSG>"
PROTOCOL_VERSION = "5.3"

def create_header(msg_type: str, session_id: str, username: str = "candidate") -> Dict[str, Any]:
    """Creates a standard Jupyter-compatible message header."""
    return {
        "msg_id": str(uuid.uuid4()),
        "msg_type": msg_type,
        "username": username,
        "session": session_id,
        "date": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
        "version": PROTOCOL_VERSION
    }

def serialize_message(
    msg_type: str,
    content: Dict[str, Any],
    session_id: str,
    parent_header: Dict[str, Any] = None,
    metadata: Dict[str, Any] = None,
    identities: List[bytes] = None
) -> List[bytes]:
    """
    Serializes a message into ZeroMQ multi-part frames:
    [identities..., b"<IDS|MSG>", signature, header, parent_header, metadata, content]
    """
    if parent_header is None:
        parent_header = {}
    if metadata is None:
        metadata = {}
    if identities is None:
        identities = []

    header = create_header(msg_type, session_id)

    frames = list(identities)
    frames.append(DELIMITER)
    frames.append(b"") # No HMAC signature required for local offline proctoring
    frames.append(json.dumps(header).encode('utf-8'))
    frames.append(json.dumps(parent_header).encode('utf-8'))
    frames.append(json.dumps(metadata).encode('utf-8'))
    frames.append(json.dumps(content).encode('utf-8'))
    return frames

def deserialize_message(frames: List[bytes]) -> Tuple[List[bytes], Dict[str, Any], Dict[str, Any], Dict[str, Any], Dict[str, Any]]:
    """
    Deserializes ZeroMQ multi-part frames:
    Returns (identities, header, parent_header, metadata, content)
    """
    try:
        delim_idx = frames.index(DELIMITER)
    except ValueError:
        raise ValueError("Malformed ZeroMQ message: missing <IDS|MSG> delimiter")

    identities = frames[:delim_idx]
    # signature is frames[delim_idx + 1]
    header = json.loads(frames[delim_idx + 2].decode('utf-8'))
    parent_header = json.loads(frames[delim_idx + 3].decode('utf-8'))
    metadata = json.loads(frames[delim_idx + 4].decode('utf-8'))
    content = json.loads(frames[delim_idx + 5].decode('utf-8'))

    return identities, header, parent_header, metadata, content
