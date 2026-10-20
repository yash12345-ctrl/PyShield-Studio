import sys
import os
import json
from typing import Dict, Any

# Ensure local directories are in python search path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)
sys.path.insert(0, PROJECT_ROOT)

from backend.kernel import NotebookKernel
from backend.network_watchdog import check_network_connectivity
from database.db import db

class BackendService:
    def __init__(self):
        self.kernel = NotebookKernel()
        self.active_session_id: str = None

    def handle_request(self, req: Dict[str, Any]) -> Dict[str, Any]:
        req_id = req.get("id")
        method = req.get("method")
        params = req.get("params", {})

        try:
            if method == "ping":
                return {"id": req_id, "status": "ok", "message": "pong"}

            elif method == "check_network":
                is_online, ifaces = check_network_connectivity()
                return {
                    "id": req_id,
                    "status": "ok",
                    "is_online": is_online,
                    "active_interfaces": ifaces
                }

            elif method == "auth_candidate":
                reg_no = params.get("registration_number", "")
                password = params.get("password", "")
                res = db.verify_candidate(reg_no, password)
                return {"id": req_id, "status": "ok", "data": res}

            elif method == "create_candidate":
                reg_no = params.get("registration_number", "")
                password = params.get("password", "")
                res = db.create_candidate(reg_no, password)
                return {"id": req_id, "status": "ok", "data": res}

            elif method == "create_experiment":
                title = params.get("title", "")
                course_code = params.get("course_code", "")
                created_by = params.get("created_by", "Faculty")
                exp_id = db.create_experiment(title, course_code, created_by)
                return {"id": req_id, "status": "ok", "experiment_id": exp_id}

            elif method == "start_session":
                reg_no = params.get("registration_number", "")
                exp_id = params.get("experiment_id")
                workstation_id = params.get("workstation_id", "LAB-03 / SEAT-18")
                session_id = db.start_session(reg_no, exp_id, workstation_id)
                self.active_session_id = session_id
                return {"id": req_id, "status": "ok", "session_id": session_id}

            elif method == "execute_cell":
                cell_id = params.get("cell_id", "cell-0")
                code = params.get("code", "")
                exec_res = self.kernel.execute_cell(cell_id, code)

                # Audit in database if a session is active
                if self.active_session_id:
                    db.log_cell_execution(
                        session_id=self.active_session_id,
                        cell_id=cell_id,
                        execution_index=exec_res["execution_count"],
                        code=code,
                        output=exec_res["stdout"] or exec_res["stderr"] or exec_res["result_repr"] or "",
                        status=exec_res["status"],
                        execution_time_ms=exec_res["execution_time_ms"],
                        has_plot=len(exec_res["images"]) > 0
                    )

                return {"id": req_id, "status": "ok", "result": exec_res}

            elif method == "record_violation":
                violation_type = params.get("type", "unknown")
                details = params.get("details", "")
                if self.active_session_id:
                    db.record_violation(self.active_session_id, violation_type, details)
                return {"id": req_id, "status": "ok", "recorded": True}

            else:
                return {"id": req_id, "status": "error", "error": f"Unknown method '{method}'"}

        except Exception as e:
            return {"id": req_id, "status": "error", "error": str(e)}

    def run_stdio_loop(self):
        """Continuously reads newline-delimited JSON commands from stdin and outputs JSON responses."""
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            try:
                req = json.loads(line)
                response = self.handle_request(req)
                print(json.dumps(response), flush=True)
            except Exception as e:
                err_resp = {"status": "error", "error": f"Malformed JSON: {str(e)}"}
                print(json.dumps(err_resp), flush=True)

if __name__ == "__main__":
    service = BackendService()
    service.run_stdio_loop()
