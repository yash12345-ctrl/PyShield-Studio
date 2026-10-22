import sqlite3
import os
import hashlib
import uuid
from typing import Optional, Dict, Any, List

from database.seed_data import seed_all_datasets

DB_PATH = os.environ.get("PYSHIELD_DB_PATH", os.path.join(os.path.dirname(__file__), "pyshield.db"))
SCHEMA_PATH = os.path.join(os.path.dirname(__file__), "schema.sql")

def hash_password(password: str, salt: str = "pyshield_offline_salt") -> str:
    """Hash a password using SHA-256 with salt."""
    return hashlib.sha256((password + salt).encode('utf-8')).hexdigest()

class DatabaseManager:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        os.makedirs(os.path.dirname(os.path.abspath(self.db_path)), exist_ok=True)
        self.init_db()

    def get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def init_db(self):
        """Initializes database tables from schema.sql and seeds offline lab datasets."""
        with self.get_connection() as conn:
            with open(SCHEMA_PATH, 'r') as f:
                schema_sql = f.read()
            conn.executescript(schema_sql)
            conn.commit()
            seed_all_datasets(conn)

    # 1. Candidate Authentication & Registration
    def create_candidate(self, reg_no: str, password: str) -> Dict[str, Any]:
        """
        Creates a new candidate account.
        Safely hashes password using SHA-256 with salt.
        Returns error if the registration number is already in use.
        """
        reg_clean = reg_no.strip().upper()
        if not reg_clean:
            return {"status": "error", "message": "Registration number is required"}
        if not password or len(password) < 4:
            return {"status": "error", "message": "Password must be at least 4 characters"}

        p_hash = hash_password(password)

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM candidates WHERE registration_number = ?", (reg_clean,))
            candidate = cursor.fetchone()

            if candidate:
                return {
                    "status": "error",
                    "action": "already_exists",
                    "registration_number": reg_clean,
                    "message": f"Registration number '{reg_clean}' is already registered. Please log in."
                }

            cursor.execute(
                "INSERT INTO candidates (registration_number, password_hash) VALUES (?, ?)",
                (reg_clean, p_hash)
            )
            conn.commit()
            return {
                "status": "success",
                "action": "registered",
                "registration_number": reg_clean,
                "message": f"Account for '{reg_clean}' created successfully."
            }

    def verify_candidate(self, reg_no: str, password: str) -> Dict[str, Any]:
        """Verifies candidate login credentials."""
        reg_clean = reg_no.strip().upper()
        p_hash = hash_password(password)

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM candidates WHERE registration_number = ?", (reg_clean,))
            candidate = cursor.fetchone()

            if not candidate:
                return {
                    "status": "error",
                    "action": "not_found",
                    "registration_number": reg_clean,
                    "message": f"Registration number '{reg_clean}' not found. Please create an account first."
                }

            if candidate["password_hash"] == p_hash:
                return {
                    "status": "success",
                    "action": "authenticated",
                    "registration_number": reg_clean,
                    "message": "Authenticated successfully"
                }
            else:
                return {
                    "status": "error",
                    "action": "failed",
                    "registration_number": reg_clean,
                    "message": "Invalid password. Please check your credentials."
                }

    def register_or_verify_candidate(self, reg_no: str, password: str) -> Dict[str, Any]:
        """
        If the candidate doesn't exist, registers them.
        If they exist, verifies password.
        """
        reg_clean = reg_no.strip().upper()
        p_hash = hash_password(password)

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM candidates WHERE registration_number = ?", (reg_clean,))
            candidate = cursor.fetchone()

            if not candidate:
                # Register new candidate
                cursor.execute(
                    "INSERT INTO candidates (registration_number, password_hash) VALUES (?, ?)",
                    (reg_clean, p_hash)
                )
                conn.commit()
                return {
                    "status": "success",
                    "action": "registered",
                    "registration_number": reg_clean,
                    "message": "Candidate registered successfully"
                }
            else:
                # Verify existing password
                if candidate["password_hash"] == p_hash:
                    return {
                        "status": "success",
                        "action": "authenticated",
                        "registration_number": reg_clean,
                        "message": "Authenticated successfully"
                    }
                else:
                    return {
                        "status": "error",
                        "action": "failed",
                        "registration_number": reg_clean,
                        "message": "Invalid password for this registration number"
                    }

    # 2. Experiment Management
    def create_experiment(self, title: str, course_code: str, created_by: str = "Instructor", config_json: str = "{}") -> int:
        """Creates a new laboratory experiment and returns its ID."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO experiments (title, course_code, created_by, config_json) VALUES (?, ?, ?, ?)",
                (title.strip(), course_code.strip(), created_by.strip(), config_json)
            )
            conn.commit()
            return cursor.lastrowid if cursor.lastrowid is not None else 0

    def list_experiments(self) -> List[Dict[str, Any]]:
        """Returns all created experiments."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM experiments ORDER BY created_at DESC")
            return [dict(row) for row in cursor.fetchall()]

    # 3. Session Tracking
    def start_session(self, reg_no: str, experiment_id: Optional[int] = None, workstation_id: str = "LAB-03 / SEAT-18") -> str:
        """Starts a new proctored exam session and returns session UUID."""
        session_id = str(uuid.uuid4())
        reg_clean = reg_no.strip().upper()

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO sessions (id, registration_number, experiment_id, workstation_id, status)
                VALUES (?, ?, ?, ?, 'in_progress')
                """,
                (session_id, reg_clean, experiment_id, workstation_id)
            )
            conn.commit()
            return session_id

    def end_session(self, session_id: str, status: str = "submitted"):
        """Marks a session as finished."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE sessions SET end_time = CURRENT_TIMESTAMP, status = ? WHERE id = ?",
                (status, session_id)
            )
            conn.commit()

    # 4. Cell Execution Audit Logging
    def log_cell_execution(
        self,
        session_id: str,
        cell_id: str,
        execution_index: int,
        code: str,
        output: str,
        status: str,
        execution_time_ms: float,
        has_plot: bool = False
    ):
        """Audits every cell executed by the user."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO cell_executions 
                (session_id, cell_id, execution_index, code_content, output_text, has_plot, status, execution_time_ms)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (session_id, cell_id, execution_index, code, output, 1 if has_plot else 0, status, execution_time_ms)
            )
            conn.commit()

    # 5. Security Violations
    def record_violation(self, session_id: str, violation_type: str, details: str):
        """Logs a proctoring security violation (e.g., internet detected or clipboard used)."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO security_violations (session_id, violation_type, details) VALUES (?, ?, ?)",
                (session_id, violation_type, details)
            )
            cursor.execute(
                "UPDATE sessions SET violations_count = violations_count + 1 WHERE id = ?",
                (session_id,)
            )
            conn.commit()

    # 6. Offline Laboratory Datasets (Labs 6-10)
    def list_datasets(self, lab_number: Optional[int] = None, category: Optional[str] = None) -> List[Dict[str, Any]]:
        """Returns catalog entries for all offline laboratory datasets."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            query = "SELECT * FROM datasets WHERE 1=1"
            params = []
            if lab_number is not None:
                query += " AND lab_number = ?"
                params.append(lab_number)
            if category and category != 'all':
                query += " AND category = ?"
                params.append(category)
            query += " ORDER BY lab_number ASC, id ASC"
            cursor.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]

    def get_dataset(self, name_or_id: str):
        """
        Loads an offline dataset as a pandas DataFrame or dict directly from SQLite.
        Usage:
            from database.db import get_dataset
            df = get_dataset('airline_passengers')
        """
        import pandas as pd  # type: ignore
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM datasets WHERE id = ? OR name LIKE ? OR table_name = ?",
                (name_or_id, f"%{name_or_id}%", name_or_id)
            )
            meta = cursor.fetchone()
            table_name = meta["table_name"] if meta and meta["table_name"] else f"dataset_{name_or_id}"
            try:
                df = pd.read_sql(f"SELECT * FROM {table_name}", conn)
                if 'id' in df.columns:
                    df = df.drop(columns=['id'])
                return df
            except Exception:
                if meta:
                    return dict(meta)
                raise ValueError(f"Dataset '{name_or_id}' table '{table_name}' not found in database.")

    # 6. Candidate Folder / Project Management
    def get_user_folders(self, reg_no: str) -> List[Dict[str, Any]]:
        """Retrieves all project/lab folders created by this candidate."""
        reg_clean = reg_no.strip().upper()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id, registration_number, folder_name, description, created_at, updated_at "
                "FROM user_folders WHERE registration_number = ? ORDER BY created_at DESC",
                (reg_clean,)
            )
            return [dict(row) for row in cursor.fetchall()]

    def create_user_folder(self, reg_no: str, folder_name: str, description: str = "") -> Dict[str, Any]:
        """Creates a new folder for the candidate. Fails if folder already exists."""
        reg_clean = reg_no.strip().upper()
        folder_clean = folder_name.strip()

        if not folder_clean:
            return {"status": "error", "message": "Folder name is required."}

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id FROM user_folders WHERE registration_number = ? AND folder_name = ?",
                (reg_clean, folder_clean)
            )
            existing = cursor.fetchone()
            if existing:
                return {
                    "status": "error",
                    "action": "already_exists",
                    "message": f"Folder '{folder_clean}' already exists for candidate {reg_clean}."
                }

            cursor.execute(
                "INSERT INTO user_folders (registration_number, folder_name, description) VALUES (?, ?, ?)",
                (reg_clean, folder_clean, description.strip())
            )
            folder_id = cursor.lastrowid
            conn.commit()

            cursor.execute("SELECT * FROM user_folders WHERE id = ?", (folder_id,))
            created_folder = cursor.fetchone()
            return {
                "status": "success",
                "folder": dict(created_folder)
            }

    def delete_user_folder(self, reg_no: str, folder_name: str) -> Dict[str, Any]:
        """Deletes a candidate folder."""
        reg_clean = reg_no.strip().upper()
        folder_clean = folder_name.strip()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "DELETE FROM user_folders WHERE registration_number = ? AND folder_name = ?",
                (reg_clean, folder_clean)
            )
            conn.commit()
            return {"status": "success", "message": f"Folder '{folder_clean}' deleted."}

# Global default instance
db = DatabaseManager()

def get_dataset(name_or_id: str):
    """Global helper to load an offline dataset directly: get_dataset('airline_passengers')"""
    return db.get_dataset(name_or_id)
