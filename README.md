# PyShield Studio 🛡️

**PyShield Studio** is a secure, high-performance offline proctored Python Notebook IDE. It features isolated Jupyter `ipykernel` subprocess execution with a ZeroMQ-to-WebSocket bridge, real-time variable inspection, offline dataset streaming, and an automated background patch and release manager.

---

## 🚀 Key Features

- **Isolated Kernel Execution**: Runs user Python code in supervised, isolated subprocesses on dynamic ephemeral OS ports.
- **WebSocket Streaming**: Real-time terminal output (`stdout`, `stderr`), execution counters, and variable inspection.
- **Offline Proctored Security**: Offline candidate authentication (SQLite), clipboard lockdown, network interface watchdog, and exam violation tracking.
- **Modern IDE Workspace**: VS Code / JupyterLab-inspired aesthetics with Monaco Editor, cell reordering, and `.ipynb` notebook persistence.
- **Automated Update Engine**: Built-in version checker and background auto-updater with live manifest verification (`v1.0.0`).

---

## 🛠️ Getting Started

### 1. Prerequisites
- **Python**: `>= 3.10`
- **Node.js**: `>= 18` and `npm`

### 2. Backend Setup
```bash
# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install backend dependencies
pip install -r backend/requirements.txt

# Start the ZeroMQ WebSocket & REST Bridge Server
python backend/run_backend.py
```
*Backend runs on `http://127.0.0.1:5001` (WebSocket: `ws://127.0.0.1:5001/ws`).*

### 3. Frontend Setup
```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```
*Frontend runs on `http://localhost:5173`.*

---

## 📁 Project Structure

```
python_notebook/
├── backend/
│   ├── kernel_manager.py     # Supervises isolated Python kernels & ephemeral ports
│   ├── zmq_bridge_server.py  # Tornado REST & WebSocket bridge server
│   ├── network_watchdog.py   # Offline lockdown monitor
│   └── requirements.txt      # Backend Python dependencies
├── database/
│   ├── schema.sql            # SQLite candidate & session schema
│   ├── db.py                 # SQLite database manager
│   └── seed_data.py          # Offline laboratory datasets
├── frontend/
│   ├── src/
│   │   ├── components/       # Monaco notebook workspace, login, datasets
│   │   ├── update_window/    # Auto-update manager and release changelog
│   │   └── select_folder/    # Project and workspace selection
│   ├── public/version.json   # Release manifest
│   └── package.json
├── version.json              # Canonical release version manifest (v1.0.0)
└── .gitignore                # Excludes .venv, node_modules, and database files
```

---

## 📄 License
MIT License.
