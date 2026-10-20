# Jupyter Notebook (v7+) Reverse-Engineered Architecture & System Implementation Guide

> **Educational Technical Report**  
> **Target Analyzed:** Jupyter Notebook (v7.x+ main branch) & Jupyter Ecosystem Components (`jupyter_server`, `jupyter_client`, `ipykernel`, `ipython`, `nbformat`, `@jupyterlab/*`)  
> **Workspace Root:** `/home/yash/Documents/python_notebook`  
> **Source Inspected:** `/home/yash/Documents/python_notebook/jupyternotebook/notebook` and `.venv/lib/python3.12/site-packages/`  
> **Analysis Methodology:** Direct source code reverse-engineering combined with REA static application graph and AST semantic analysis tools.

---

## Analysis Methodologies & Evidence Distinctions

In accordance with strict reverse-engineering principles, this report distinguishes:
1. **REA Tool Projections:** 
   - **`analyze_javascript_application`** on `jupyternotebook/notebook/app` generated static application graph and bundle analysis evidence:
     - Evidence ID: `ev_c65bbfe3b0d6f0cf45d0668ef4aedd1dadeccadd1a59a68b8e6ee1e3926037a8`
     - Root SHA256: `bc45b7ca5588c04be42fb696ce339466140f9e4e5fc1785f2a938bcadbeed228`
     - Examined files: 15 relevant files, 8 parsed JS files, 1,254 AST nodes, 481 data-flow relations, 60 object-flow relations.
   - **`analyze_javascript_application`** on `jupyternotebook/notebook/packages/application` generated modular frontend package evidence:
     - Evidence ID: `ev_80181a73f7d177c287513d6116d5d55f6ac2d5b6fff2b32ca21645a61bcdf30f`
     - Root SHA256: `f51a9262a7a85230f202dc4246307bbb3109d976126b4b9e81df0e0aa02d6b44`
     - Examined files: 14 relevant files, 11 parsed JS files, 6,111 AST nodes, 2,069 data-flow relations, 231 closure relations, 240 object-flow relations.
2. **Direct Source Inspection:**
   - Examined Python modules: `notebook/notebook/app.py`, `ipykernel_launcher.py`, `ipykernel/kernelapp.py`, `ipykernel/ipkernel.py`, `ipykernel/kernelbase.py`, `jupyter_client/manager.py`, `jupyter_client/session.py`.
   - Examined TypeScript/JS modules: `app/index.template.js`, `packages/application/src/app.ts`, `packages/application/src/shell.ts`, `packages/application-extension/src/index.ts`, `packages/notebook-extension/src/index.ts`, `packages/docmanager-extension/src/index.ts`.
   - Inspected JSON document schemas: `binder/example.ipynb`.

---

## 1. Overall Architecture: Frontend, Backend, Server, and Kernel

Jupyter Notebook v7 is a distributed, modular client-server web application with a 4-tier interactive computing architecture:

```
+-----------------------------------------------------------------------------------+
| 1. Frontend (Browser SPA)                                                         |
|    - Lumino Widgets (NotebookShell, SplitPanel, Menu, Toolbar)                    |
|    - JupyterLab Components (NotebookPanel, CodeCell, MarkdownCell, OutputArea)    |
|    - CodeMirror 6 Editor & Markdown-it Renderer                                    |
|    - ServiceManager (REST API client + WebSocket KernelConnection)                 |
+------------------------------------------^----------------------------------------+
                                           | HTTP / REST (API calls, HTML, JSON)
                                           | WebSocket (Jupyter Wire Protocol)
+------------------------------------------v----------------------------------------+
| 2. Server / Backend (jupyter_server & notebook extension)                         |
|    - JupyterNotebookApp (subclasses LabServerApp / ServerApp on Tornado Web)      |
|    - Jinja2 Template Handlers: TreeHandler (/tree), NotebookHandler (/notebooks)  |
|    - REST APIs: /api/contents (Files/Notebooks), /api/sessions, /api/kernels      |
|    - WebSocket Handler: ZMQChannelsHandler (/api/kernels/<id>/channels)           |
+------------------------------------------^----------------------------------------+
| 3. Kernel Management & Communication Layer                                        |
|    - MappingKernelManager & MultiKernelManager                                    |
|    - KernelManager (launches subprocess, generates connection_file, restarter)     |
|    - ZeroMQ Sockets (Shell, IOPub, Stdin, Control, Heartbeat)                     |
+------------------------------------------^----------------------------------------+
                                           | 5 ZeroMQ Channels over TCP/IPC
+------------------------------------------v----------------------------------------+
| 4. Kernel Execution Engine (ipykernel)                                            |
|    - Entrypoint: ipykernel_launcher.py -> IPKernelApp.launch_new_instance()       |
|    - IPythonKernel (extends KernelBase)                                           |
|    - InteractiveShell (IPython execution engine, magics, caching compiler)        |
|    - Streams & Hooks: IOPubThread (sys.stdout/stderr), ZMQDisplayHook (outputs)   |
+-----------------------------------------------------------------------------------+
```

### Component Roles & Responsibilities:
1. **Frontend (Browser UI):** A Single Page Application (SPA) loaded inside the browser. It manages user keyboard interaction, cell focus, command/edit modes, text editing, and delegates execution commands to the backend via WebSockets.
2. **Backend Server (`jupyter_server`):** A Tornado-based asynchronous HTTP & WebSocket server. It authenticates users, serves static assets and HTML templates, persists files on disk (`/api/contents`), manages notebook-to-kernel associations (`/api/sessions`), and acts as a bidirectional bridge between browser WebSockets and backend ZeroMQ sockets.
3. **Kernel Manager (`jupyter_client`):** Resides inside the server process. It discovers kernelspecs, allocates OS ports, writes cryptographic connection files, launches the kernel OS process, monitors heartbeats, interrupts via signals or messages, and terminates kernels.
4. **Kernel (`ipykernel`):** An independent Python subprocess. It runs an event loop, maintains the stateful execution namespace (`user_ns`), receives execution requests, compiles and evaluates Python code, redirects standard I/O streams, and publishes results back over ZeroMQ.

---

## 2. Notebook Document Format (.ipynb)

A notebook document (`.ipynb`) is a UTF-8 JSON file strictly validated against the `nbformat` schema (current standard: format v4, minor version 4 or 5).

### 2.1 Top-Level JSON Structure
```json
{
  "nbformat": 4,
  "nbformat_minor": 5,
  "metadata": {
    "kernelspec": {
      "name": "python3",
      "display_name": "Python 3 (ipykernel)",
      "language": "python"
    },
    "language_info": {
      "name": "python",
      "version": "3.12.3",
      "mimetype": "text/x-python",
      "file_extension": ".py",
      "pygments_lexer": "ipython3"
    }
  },
  "cells": [ ... ]
}
```

### 2.2 Cell Types and Data Structures
There are three standard cell types:
1. **`code` cells:**
   - `id`: Unique string identifier (e.g. `"212ecd19-156e-48dd-99c7-e2ee7457de6f"`).
   - `cell_type`: `"code"`
   - `source`: List of strings (lines of code) or a single string.
   - `execution_count`: Integer counter indicating execution sequence order (`null` if unexecuted).
   - `metadata`: Object containing cell settings (`collapsed`, `scrolled`, `tags`, `trusted`).
   - `outputs`: Ordered array of output objects.
2. **`markdown` cells:**
   - `cell_type`: `"markdown"`
   - `source`: Markdown formatted text (including LaTeX math syntax `$e^{i\pi} + 1 = 0$`).
   - `attachments`: Embedded binary assets (e.g. dragged/pasted images) stored as base64-encoded MIME bundles.
3. **`raw` cells:**
   - `cell_type`: `"raw"`
   - Unformatted text passed directly to nbconvert (e.g. raw LaTeX or raw HTML).

### 2.3 Output Data Types
Inside a `code` cell's `outputs` array:
- **`stream`:** Intercepted standard output/error:
  ```json
  {
    "output_type": "stream",
    "name": "stdout",
    "text": ["Hello, World!\n"]
  }
  ```
- **`execute_result`:** Return value of the final expression in a cell (intercepted by `sys.displayhook`):
  ```json
  {
    "output_type": "execute_result",
    "execution_count": 1,
    "data": {
      "text/plain": ["42"],
      "text/html": ["<b>42</b>"]
    },
    "metadata": {}
  }
  ```
- **`display_data`:** Explicit output created via `display(obj)` or Matplotlib `plt.show()`:
  ```json
  {
    "output_type": "display_data",
    "data": {
      "image/png": "iVBORw0KGgoAAAANSUhEUgAA...",
      "text/plain": ["<Figure size 640x480 with 1 Axes>"]
    },
    "metadata": {}
  }
  ```
- **`error`:** Uncaught exception traceback:
  ```json
  {
    "output_type": "error",
    "ename": "ZeroDivisionError",
    "evalue": "division by zero",
    "traceback": [
      "\u001b[0;31m---------------------------------------------------------------------------\u001b[0m",
      "\u001b[0;31mZeroDivisionError\u001b[0m: division by zero"
    ]
  }
  ```

---

## 3. Frontend Architecture: Rendering Cells and Editing

### 3.1 Class Hierarchy and Responsibilities
- **Source Files:**
  - `packages/application/src/app.ts` -> `NotebookApp`
  - `packages/application/src/shell.ts` -> `NotebookShell`
  - `packages/notebook-extension/src/index.ts` -> Core notebook plugins
  - `@jupyterlab/notebook` -> `NotebookPanel`, `Notebook`, `NotebookModel`
  - `@jupyterlab/cells` -> `Cell`, `CodeCell`, `MarkdownCell`
  - `@jupyterlab/outputarea` -> `OutputArea`

```
NotebookApp (extends JupyterFrontEnd<INotebookShell>)
  │
  ├── NotebookShell (Lumino Widget root)
  │     ├── top-panel (Banner)
  │     ├── menu-panel (Navigation)
  │     ├── main-panel (Work area)
  │     │     └── NotebookPanel (extends DocumentWidget<Notebook, INotebookModel>)
  │     │           ├── Toolbar (Run, Stop, Restart, CellType, KernelStatus)
  │     │           └── content: Notebook (extends StaticNotebook)
  │     │                 ├── Cell 0: MarkdownCell
  │     │                 │     ├── InputArea (CodeMirror Editor - hidden when rendered)
  │     │                 │     └── RenderedHTML (Markdown-it + MathJax)
  │     │                 └── Cell 1: CodeCell
  │     │                       ├── InputArea
  │     │                       │     ├── InputPrompt ("[1]:")
  │     │                       │     └── CodeEditor (CodeMirror 6)
  │     │                       └── OutputArea
  │     │                             └── OutputPrompt + RenderedMime
  │     └── left-panel / right-panel (Sidebars: TOC, Debugger, Settings)
```

### 3.2 Cell Rendering & Editing Lifecycle
1. **Document Loading:** 
   `router:tree` in `packages/application-extension/src/index.ts` captures `/notebooks/<path>`. It invokes `docManager.openOrReveal(file, factory)`.
2. **Widget Instantiation:**
   `NotebookWidgetFactory` creates a `NotebookPanel`. The panel initializes a `NotebookModel` and a `Notebook` widget.
3. **Cell Layout Synchronization:**
   The `Notebook` widget observes changes in `model.cells` (an `IObservableList<ICellModel>`). When cells are added, moved, or deleted, Lumino creates/destroys `Cell` DOM nodes.
4. **Command Mode vs. Edit Mode:**
   - **Command Mode (`mode === 'command'`):** Keyboard focus is captured by the `Notebook` widget. Key events trigger commands: `Shift+Enter` (run), `B` (insert below), `A` (insert above), `D,D` (delete), `M` (change to markdown), `Y` (change to code).
   - **Edit Mode (`mode === 'edit'`):** Focus shifts inside the CodeMirror 6 editor instance (`cell.editor.focus()`). All keypresses insert and modify text. Pressing `Escape` emits a signal that returns the notebook to Command Mode.

---

## 4. Backend: Requests, Sessions, Kernels, and WebSockets

### 4.1 Server App Initialization
- **Source File:** `notebook/notebook/app.py`
- **Class:** `JupyterNotebookApp(NotebookConfigShimMixin, LabServerApp)`
- **Execution Flow:**
  1. `jupyter-notebook = "notebook.app:main"` calls `JupyterNotebookApp.launch_instance()`.
  2. Subclasses `jupyterlab_server.LabServerApp` which instantiates `jupyter_server.serverapp.ServerApp`.
  3. Registers Tornado web handlers:
     - `/tree(.*)` -> `TreeHandler`: File directory browser.
     - `/notebooks(.*)` -> `NotebookHandler`: Serves `notebooks.html` with bootstrap JSON config.
     - `/api/contents(.*)` -> `ContentsHandler`: File CRUD operations.
     - `/api/sessions(.*)` -> `SessionRootHandler`: Kernel-to-document session tracking.
     - `/api/kernels(.*)` -> `KernelRootHandler`: Kernel REST control.
     - `/api/kernels/(.*)/channels` -> `ZMQChannelsHandler`: WebSocket communications bridge.

### 4.2 Session Management
- **Source:** `jupyter_server.services.sessions.sessionmanager.SessionManager`
- When a notebook tab opens in the browser, the frontend calls `POST /api/sessions`:
  ```json
  {
    "path": "notebooks/analysis.ipynb",
    "name": "analysis.ipynb",
    "type": "notebook",
    "kernel": { "name": "python3" }
  }
  ```
- The `SessionManager` checks if a kernel is already associated with that document path. If not, it requests `MappingKernelManager.start_kernel(kernel_name="python3")`.
- It stores a SQLite/in-memory record associating `session_id`, `path`, and `kernel_id`.

### 4.3 WebSocket to ZeroMQ Multiplexing
- **Source:** `jupyter_server.services.kernels.handlers.ZMQChannelsHandler`
- When the frontend receives the `kernel_id`, it opens a WebSocket:
  `ws://<host>:<port>/api/kernels/<kernel_id>/channels?session_id=<session_id>`
- **Bridge Mechanics:**
  - `ZMQChannelsHandler.open()` creates a `KernelClient` subscribed to the kernel's ZeroMQ sockets.
  - When the browser sends a message over the WebSocket, `on_message(data)` deserializes the JSON string and routes it to the ZeroMQ `shell` or `control` socket.
  - When messages arrive on ZeroMQ `iopub` from the kernel, `ZMQChannelsHandler` packages them and calls `write_message()` over the WebSocket to the browser.

---

## 5. Python Execution Flow: From Cell to Kernel and Back

Here is the exact message sequence when a user runs a Python code cell:

```
[ Frontend: Browser ]       [ Backend: jupyter_server ]         [ Execution: ipykernel ]
        │                               │                                 │
        │ 1. Shift+Enter pressed        │                                 │
        │    execute_request (WS)       │                                 │
        ├──────────────────────────────>│                                 │
        │                               │ 2. ZMQChannelsHandler routes    │
        │                               │    to ZeroMQ Shell ROUTER socket│
        │                               ├────────────────────────────────>│
        │                               │                                 │ 3. KernelBase receives request
        │                               │                                 │    Publishes status: busy (iopub)
        │                               │    status: busy (ZMQ IOPub)     │
        │                               │<────────────────────────────────┤
        │ 4. Kernel status: Busy (*)    │                                 │
        │<──────────────────────────────┤                                 │
        │                               │    execute_input (iopub)        │
        │                               │<────────────────────────────────┤
        │ 5. Cell marked running        │                                 │
        │<──────────────────────────────┤                                 │
        │                               │                                 │ 6. do_execute() runs code in user_ns
        │                               │                                 │    sys.stdout.write() intercepts prints
        │                               │    stream (stdout) (iopub)      │
        │                               │<────────────────────────────────┤
        │ 7. Append stdout to cell      │                                 │
        │<──────────────────────────────┤                                 │
        │                               │                                 │ 8. Final expression evaluated
        │                               │                                 │    displayhook generates MIME bundle
        │                               │    execute_result (iopub)       │
        │                               │<────────────────────────────────┤
        │ 9. Render output (PNG/HTML)   │                                 │
        │<──────────────────────────────┤                                 │
        │                               │                                 │ 10. Code execution finishes
        │                               │    status: idle (iopub)         │
        │                               │<────────────────────────────────┤
        │ 11. Kernel status: Idle       │                                 │
        │<──────────────────────────────┤                                 │
        │                               │    execute_reply (ZMQ Shell)    │
        │                               │<────────────────────────────────┤
        │ 12. Execution counter [1] set │                                 │
        │<──────────────────────────────┤                                 │
```

### 5.1 Step-by-Step Code References
1. **Frontend Initiation (`@jupyterlab/notebook`):**
   - Command `notebook:run-cell` fetches code from `cell.model.sharedModel.getSource()`.
   - Clears cell output model: `cell.outputArea.model.clear()`.
   - Calls `sessionContext.session.kernel.requestExecute({ code })`.
2. **Wire Message Construction (`jupyter_client/session.py`):**
   - Function `Session.msg("execute_request", content={"code": code, "silent": False, "store_history": True})` creates header with a unique `msg_id` and timestamp.
3. **Kernel Dispatch (`.venv/.../ipykernel/kernelbase.py`):**
   - Method `KernelBase.execute_request(stream, ident, parent)`:
     - Extracts `code = content["code"]`.
     - Increments `self.execution_count += 1`.
     - Publishes `_publish_execute_input(code, parent, self.execution_count)` on `iopub`.
4. **Execution in Namespace (`.venv/.../ipykernel/ipkernel.py`):**
   - Method `IPythonKernel.do_execute(code, ...)`:
     - Calls `shell.run_cell_async(code)` or `shell.run_cell(code)` on `ZMQInteractiveShell`.
     - Transforms code (expands IPython magics `%time`, `?`, `!ls`).
     - Compiles code with `XCachingCompiler` into AST/code objects.
     - Evaluates code in `self.shell.user_ns` (a persistent dictionary acting as `globals()`).
5. **Output Capture (`.venv/.../ipykernel/iostream.py`):**
   - `sys.stdout` and `sys.stderr` are wrapped by `OutStream` / `IOPubThread`. Calls to `print()` are formatted into `stream` messages and published to `iopub`.
   - If an expression produces an object, `ZMQDisplayHook` inspects its formatters (`_repr_html_()`, `_repr_png_()`, `_repr_mimebundle_()`, or standard `__repr__`) and emits `execute_result` on `iopub`.
6. **Output Delivery (`@jupyterlab/outputarea`):**
   - The frontend's `KernelConnection` receives messages, filters by `parent_header.msg_id == request_msg_id`, and appends each output to `cell.outputArea.model`.
   - `RenderMimeRegistry` resolves the highest priority renderer (e.g. `image/png` > `text/html` > `text/plain`) and mounts the DOM element.
7. **Completion:**
   - Kernel returns `execute_reply` with `status: "ok"` and `execution_count`. Cell prompt changes from `[*]` to `[N]`.

---

## 6. Kernel Lifecycle: Start, Interrupt, Restart, Shutdown

The kernel lifecycle is managed by `jupyter_client.manager.KernelManager` and orchestrated by `MappingKernelManager`.

### 6.1 Starting a Kernel
- **Class & Methods:** `KernelManager._async_pre_start_kernel()`, `_async_start_kernel()`, `_async_post_start_kernel()`.
- **Execution Flow:**
  1. **Locate Kernel Spec:** Reads `kernels/python3/kernel.json` containing:
     ```json
     {
       "argv": ["python", "-m", "ipykernel_launcher", "-f", "{connection_file}"],
       "display_name": "Python 3 (ipykernel)",
       "language": "python"
     }
     ```
  2. **Port Allocation:** Selects 5 random, unused TCP ports on localhost:
     - `shell_port`: ROUTER socket for requests/replies.
     - `iopub_port`: PUB socket for broadcasting outputs and statuses.
     - `stdin_port`: ROUTER socket for interactive `input()` prompts.
     - `control_port`: ROUTER socket for high-priority shutdown/interrupt.
     - `hb_port`: REP socket for heartbeat echo ping/pong.
  3. **Connection File:** Writes a secure JSON file to a runtime directory:
     ```json
     {
       "ip": "127.0.0.1",
       "transport": "tcp",
       "shell_port": 54321,
       "iopub_port": 54322,
       "stdin_port": 54323,
       "control_port": 54324,
       "hb_port": 54325,
       "key": "b6a8d7c4-...",
       "signature_scheme": "hmac-sha256"
     }
     ```
  4. **Subprocess Launch:** Calls `asyncio.create_subprocess_exec()` with the command line, passing the connection file path via `-f`.
  5. **Heartbeat Restarter:** Starts `KernelRestarter` thread/task. It sends periodic ping bytes to `hb_port`. If the kernel does not respond within `restart_timeout` (default 5s), it flags the kernel as dead and initiates auto-restart.

### 6.2 Interrupting a Kernel
- **Class & Method:** `KernelManager._async_interrupt_kernel()`
- **Execution Flow:**
  1. Inspects `kernel_spec.interrupt_mode`.
  2. **Signal Mode (`signal`)** (Unix/Linux/macOS):
     - Calls `os.kill(self.provisioner.pid, signal.SIGINT)`.
     - In Python, `SIGINT` raises `KeyboardInterrupt` in the main execution thread, stopping loops or blocking operations without killing the process or losing variables.
  3. **Message Mode (`message`)** (Windows):
     - Because POSIX signals are unavailable on Windows, sends an `interrupt_request` message directly over the `control` ZeroMQ channel.
     - In `ipykernel`, a dedicated `ControlThread` monitors the `control` socket and injects an async interrupt into the main execution thread.

### 6.3 Restarting a Kernel
- **Class & Method:** `KernelManager._async_restart_kernel(now=False, newports=False)`
- **Execution Flow:**
  1. Calls `_async_shutdown_kernel(now=now, restart=True)`.
  2. When `restart=True`, the connection file and ports are preserved.
  3. Re-launches the subprocess using the existing connection file.
  4. Emits `status: restarting` -> `status: starting` -> `status: idle` over WebSocket to reset the frontend UI. All memory state in the old kernel is discarded.

### 6.4 Shutting Down a Kernel
- **Class & Method:** `KernelManager._async_shutdown_kernel(now=False, restart=False)`
- **Execution Flow:**
  1. **Graceful Request:** Sends a `shutdown_request` message (`{"restart": False}`) over the `control` socket.
  2. **Timeout & Escalation:** Calls `_async_finish_shutdown()`:
     - Waits up to `shutdown_wait_time / 2` (approx 2.5s).
     - If the process is still running, issues `SIGTERM`.
     - If still unresponsive after another interval, issues `SIGKILL`.
  3. **Cleanup:** Deletes the temporary connection file from disk, closes all ZeroMQ sockets, and destroys the ZeroMQ context (`context.destroy(linger=100)`).

---

## 7. Save and Load: Reading and Writing Notebooks

File storage is handled by `jupyter_server.services.contents.filemanager.FileContentsManager`.

### 7.1 Loading a Notebook
- **Handler & Method:** `ContentsHandler.get(path)` -> `FileContentsManager.get(path, content=True, type='notebook')`
- **Execution Flow:**
  1. **Path Resolution:** Converts the virtual notebook path into an absolute OS path (`os_path = self._get_os_path(path)`), verifying root containment to prevent directory traversal attacks.
  2. **Reading File:** Opens the `.ipynb` file with UTF-8 encoding.
  3. **Validation & Migration:**
     - Calls `nbformat.read(f, as_version=4)`.
     - Runs `nbformat.validate(nb)` against the v4 schema.
     - If the notebook was created in an older format (v2 or v3), `nbformat.v4.convert` dynamically upgrades the structure.
  4. **Model Assembly:** Wraps the notebook object in a standard contents dictionary:
     ```json
     {
       "name": "Untitled.ipynb",
       "path": "Untitled.ipynb",
       "type": "notebook",
       "format": "json",
       "mimetype": null,
       "writable": true,
       "created": "2026-10-20T08:00:00Z",
       "last_modified": "2026-10-20T08:05:00Z",
       "content": { ... nbformat JSON ... }
     }
     ```
  5. **Client Deserialization:** The browser receives the JSON payload. `NotebookModel.fromJSON(model.content)` populates the cell array and renders the UI.

### 7.2 Saving a Notebook
- **Handler & Method:** `ContentsHandler.put(path)` -> `FileContentsManager.save(model, path)`
- **Execution Flow:**
  1. **Frontend Serialization:** User triggers Save (`Ctrl+S` or autosave). `NotebookModel.toJSON()` dumps the current cells, outputs, and metadata into a JSON object and sends HTTP PUT to `/api/contents/<path>`.
  2. **Schema Verification:** `FileContentsManager._save_notebook(os_path, nb)` calls `nbformat.validate(nb)`.
  3. **Pre-Save Hooks:** Runs any configured `pre_save_hook(model, path)`.
  4. **Atomic Write Guarantee:**
     - Rather than overwriting the file directly, it writes to a temporary file in the same directory: `.<filename>.ipynb.tmp`.
     - Flushes the buffer and executes `os.fsync(fd)` to guarantee bytes are committed to the physical storage device.
     - Calls `os.replace(temp_path, os_path)` (an atomic POSIX operation). If the server loses power during writing, the original notebook file remains uncorrupted.
  5. **Checkpoints:** Automatically copies the saved state into `.ipynb_checkpoints/<filename>-checkpoint.ipynb` via `Checkpoints.create_checkpoint()`.
  6. **Post-Save Hooks:** Runs `post_save_hook(model, os_path)`.
  7. **Frontend Sync:** Returns the updated `last_modified` timestamp. The frontend clears the "dirty" unsaved dot on the tab.

---

## 8. Dependencies, Repository Boundaries, and Key Source Files

| Flow / Subsystem | Primary Repository | Key Source Files | Key Classes / Functions | Primary Responsibility |
| :--- | :--- | :--- | :--- | :--- |
| **App Shell & Server Extension** | `jupyter/notebook` | `notebook/notebook/app.py`<br>`packages/application/src/app.ts`<br>`packages/application/src/shell.ts` | `JupyterNotebookApp`<br>`NotebookApp`<br>`NotebookShell` | Server CLI, template rendering, Lumino shell layout, extension registration. |
| **Frontend Routing & Document Init** | `jupyter/notebook` | `packages/application-extension/src/index.ts`<br>`packages/docmanager-extension/src/index.ts` | `router:tree`<br>`opener` | URL pattern matching (`/notebooks/(.*)`), opening `.ipynb` via DocumentManager. |
| **Notebook UI & Cell Interaction** | `jupyterlab/jupyterlab` | `@jupyterlab/notebook`<br>`@jupyterlab/cells`<br>`@jupyterlab/outputarea` | `NotebookPanel`<br>`Notebook`<br>`CodeCell`<br>`OutputArea` | Command/Edit mode state machine, CodeMirror 6 integration, MIME rendering. |
| **Backend REST & WebSocket Server** | `jupyter-server/jupyter_server` | `jupyter_server/serverapp.py`<br>`jupyter_server/services/kernels/handlers.py` | `ServerApp`<br>`ZMQChannelsHandler` | HTTP request routing, token authentication, WebSocket-to-ZeroMQ message proxying. |
| **File Persistence & Checkpoints** | `jupyter-server/jupyter_server` | `jupyter_server/services/contents/filemanager.py` | `FileContentsManager`<br>`Checkpoints` | Atomic disk writes, checkpoint management, security path validation. |
| **Document Schema & Validation** | `jupyter/nbformat` | `nbformat/validator.py`<br>`nbformat/v4/` | `read()`, `write()`, `validate()` | `.ipynb` JSON schema specification, version upgrades. |
| **Kernel Subprocess & Sockets** | `jupyter/jupyter_client` | `jupyter_client/manager.py`<br>`jupyter_client/session.py`<br>`jupyter_client/restarter.py` | `KernelManager`<br>`Session`<br>`KernelRestarter` | Port assignment, HMAC signing, subprocess execution, heartbeat monitoring. |
| **Python Execution Engine** | `ipython/ipykernel` | `ipykernel_launcher.py`<br>`ipykernel/kernelapp.py`<br>`ipykernel/ipkernel.py`<br>`ipykernel/kernelbase.py` | `IPKernelApp`<br>`IPythonKernel`<br>`ZMQInteractiveShell`<br>`OutStream` | ZeroMQ message dispatching, code compilation, `user_ns` evaluation, output streams. |

---

## Key Takeaways for Building an Offline Custom Notebook Engine

For your project requirements (e.g. offline proctored environment with React, Monaco, and local Python execution as outlined in your TRD):
1. **Separation of Concerns:** Keep the UI (editor, prompt, renderers) strictly separated from the execution engine via a clear message contract (like the Jupyter Wire Protocol or standard JSON-RPC over IPC).
2. **Stateful Namespace:** Variables must remain alive across cell runs by holding a persistent global scope dictionary (`globals_dict = {}`) passed to `exec(code, globals_dict)`.
3. **Stream Interception:** Standard output and errors must be intercepted by replacing `sys.stdout` and `sys.stderr` with thread-safe queue buffers during execution.
4. **Non-blocking Execution & Cancellation:** Code must execute in a worker thread or separate process so the main loop can listen for interrupts (`KeyboardInterrupt` / SIGINT) without freezing the UI.
5. **Atomic Saving:** Always write notebook files to a temporary file first and atomically rename/replace it to prevent file corruption during unexpected termination.
