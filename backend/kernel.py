import sys
import os
import io
import re
import time
import base64
import traceback
import builtins
from typing import Dict, Any, List, Optional, Callable

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# Try importing IPython / ipykernel core interactive shell
try:
    from IPython.core.interactiveshell import InteractiveShell
    from IPython.utils.capture import capture_output
    from IPython.core.completer import provisionalcompleter
    from ipykernel.ipkernel import _rectify_completions, line_at_cursor, token_at_cursor
    HAS_IPYKERNEL = True
except ImportError:
    HAS_IPYKERNEL = False


class StreamCallbackReader(io.TextIOBase):
    """
    Custom TextIO stream that intercepts sys.stdin reads,
    invoking an interactive input callback to prompt the user.
    """
    def __init__(self, input_callback: Optional[Callable[[str, bool], str]]):
        self.input_callback = input_callback
        self._buf = ""

    def readable(self) -> bool:
        return True

    def readline(self, size: int = -1) -> str:
        if self._buf:
            line = self._buf
            self._buf = ""
            return line
        if self.input_callback:
            val = self.input_callback("", False)
            if not val.endswith("\n"):
                val += "\n"
            return val
        raise EOFError("Interactive stdin is not connected or input was aborted")

    def read(self, size: int = -1) -> str:
        return self.readline(size)


class StreamCallbackWriter(io.TextIOBase):
    """
    Custom TextIO stream that intercepts stdout/stderr writes,
    forwards them immediately to a real-time callback, and collects
    the full output string buffer.
    """
    def __init__(self, callback: Optional[Callable[[str, str], None]], stream_name: str = "stdout"):
        self.callback = callback
        self.stream_name = stream_name
        self.buf: List[str] = []

    def write(self, s: str) -> int:
        if s:
            self.buf.append(s)
            if self.callback:
                try:
                    self.callback(self.stream_name, s)
                except Exception:
                    pass
        return len(s)

    def flush(self):
        pass

    def getvalue(self) -> str:
        return "".join(self.buf)


def clean_terminal_output(text: str) -> str:
    """
    Cleans ANSI escape sequences (colors, cursor control, private modes)
    and resolves carriage returns (\r) line-by-line just like Jupyter/terminal.
    """
    if not text:
        return ""
    # Strip all 7-bit and 8-bit ANSI / VT100 control sequences
    ansi_regex = re.compile(r'\x1b(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
    cleaned = ansi_regex.sub('', text)

    # Resolve \r (carriage returns) per line for clean progress bar output (tqdm, pip, keras)
    lines = cleaned.split('\n')
    resolved_lines = []
    for line in lines:
        if '\r' in line:
            parts = [p for p in line.split('\r') if p]
            resolved_lines.append(parts[-1] if parts else '')
        else:
            resolved_lines.append(line)

    return '\n'.join(resolved_lines)


class NotebookKernel:
    """
    Offline execution engine powered by ipykernel (IPython.core.interactiveshell)
    and custom stdio IPC. Provides:
    - Real-time streaming of stdout/stderr directly into ZeroMQ / WebSocket
    - Code compilation & cell execution via ipykernel
    - Cross-cell state persistence in user namespace
    - Headless Matplotlib plot capture (base64 PNG)
    - Pandas DataFrame rich HTML table rendering
    - Jupyter-style Kernel Restart (namespace reset & import cache invalidation)
    - Jupyter-style Kernel Interruption (SIGINT / KeyboardInterrupt)
    """
    def __init__(self):
        self.execution_count: int = 0
        self.has_ipykernel = HAS_IPYKERNEL

        try:
            os.chdir(PROJECT_ROOT)
        except Exception:
            pass

        if self.has_ipykernel:
            self.shell = InteractiveShell.instance()
            self.shell.colors = 'NoColor' # Clean plain text tracebacks
        else:
            self.shell = None
            self.globals_dict: Dict[str, Any] = {
                "__name__": "__main__",
                "__doc__": None,
                "__package__": None,
            }

        self._setup_matplotlib_hook()

    def _setup_matplotlib_hook(self):
        """Sets headless rendering backend for matplotlib."""
        try:
            import matplotlib
            matplotlib.use('Agg')
        except ImportError:
            pass

    def restart(self) -> Dict[str, Any]:
        """
        Restarts kernel execution engine, resets user namespace,
        and invalidates import caches just like Jupyter.
        """
        self.execution_count = 0
        try:
            os.chdir(PROJECT_ROOT)
        except Exception:
            pass
        if self.has_ipykernel and self.shell:
            try:
                self.shell.reset(new_session=True)
            except Exception:
                pass
            try:
                import importlib
                importlib.invalidate_caches()
            except Exception:
                pass
        else:
            self.globals_dict = {
                "__name__": "__main__",
                "__doc__": None,
                "__package__": None,
            }

        # Clear any open figures
        try:
            import matplotlib.pyplot as plt
            plt.close('all')
        except Exception:
            pass

        self._setup_matplotlib_hook()
        return {"status": "ok", "message": "Kernel restarted successfully. User namespace reset."}

    def interrupt(self) -> Dict[str, Any]:
        """Interrupts currently running execution on the main thread via real POSIX SIGINT."""
        try:
            import signal
            import threading
            main_thread = threading.main_thread()
            if main_thread.ident:
                signal.pthread_kill(main_thread.ident, signal.SIGINT)
            else:
                import _thread
                _thread.interrupt_main()
            return {"status": "ok", "message": "Kernel execution interrupted"}
        except Exception as e:
            try:
                import _thread
                _thread.interrupt_main()
                return {"status": "ok", "message": "Kernel interrupted"}
            except Exception as e2:
                return {"status": "error", "message": str(e2)}

    def _capture_matplotlib_figures(self) -> List[Dict[str, Any]]:
        """
        Grabs any open Matplotlib figures, captures both PNG and SVG vector formats,
        and returns them as rich MIME display items.
        """
        displays = []
        try:
            import matplotlib.pyplot as plt
            fig_nums = plt.get_fignums()
            for num in fig_nums:
                fig = plt.figure(num)
                # 1. Base64 PNG
                buf_png = io.BytesIO()
                fig.savefig(buf_png, format='png', bbox_inches='tight', dpi=120)
                buf_png.seek(0)
                png_b64 = base64.b64encode(buf_png.read()).decode('utf-8')

                # 2. SVG Vector XML
                buf_svg = io.StringIO()
                fig.savefig(buf_svg, format='svg', bbox_inches='tight')
                svg_str = buf_svg.getvalue()

                size_desc = f"<Figure size {fig.get_size_inches()[0]*fig.dpi:.0f}x{fig.get_size_inches()[1]*fig.dpi:.0f} with {len(fig.axes)} Axes>"
                displays.append({
                    "data": {
                        "image/png": png_b64,
                        "image/svg+xml": svg_str,
                        "text/plain": size_desc
                    },
                    "metadata": {
                        "needs_background": "light"
                    }
                })
                plt.close(fig)
        except Exception:
            pass
        return displays

    def execute_cell(
        self,
        cell_id: str,
        code: str,
        stream_callback: Optional[Callable[[str, str], None]] = None,
        input_callback: Optional[Callable[[str, bool], str]] = None
    ) -> Dict[str, Any]:
        """
        Compiles and executes code using ipykernel / IPython,
        streaming stdout/stderr chunks and capturing full rich output MIME bundles.
        """
        self.execution_count += 1
        start_time = time.perf_counter()

        status = "success"
        stdout_text = ""
        stderr_text = ""
        result_repr: Optional[str] = None
        html_table: Optional[str] = None
        svg_content: Optional[str] = None
        latex_content: Optional[str] = None
        json_content: Optional[Any] = None
        result_data: Dict[str, Any] = {}
        result_metadata: Dict[str, Any] = {}
        displays: List[Dict[str, Any]] = []
        images: List[str] = []
        error_info: Optional[Dict[str, str]] = None

        writer_out = StreamCallbackWriter(stream_callback, "stdout")
        writer_err = StreamCallbackWriter(stream_callback, "stderr")

        def custom_input(prompt: Any = "", password: bool = False) -> str:
            prompt_str = str(prompt) if prompt is not None else ""
            if prompt_str:
                writer_out.write(prompt_str)
                writer_out.flush()
            if input_callback:
                val = input_callback(prompt_str, password)
                # Echo entered value followed by newline to stdout (matching standard terminal/Jupyter behavior)
                writer_out.write(str(val) + "\n")
                writer_out.flush()
                return str(val)
            raise EOFError("Interactive stdin is not connected or input was aborted")

        old_stdout = sys.stdout
        old_stderr = sys.stderr
        old_stdin = sys.stdin
        old_input = builtins.input
        old_raw_input = getattr(self.shell, "raw_input", None) if (self.has_ipykernel and self.shell) else None

        if self.has_ipykernel:
            try:
                sys.stdout = writer_out
                sys.stderr = writer_err
                sys.stdin = StreamCallbackReader(lambda p, pwd: custom_input(p, pwd))
                builtins.input = custom_input
                if self.shell:
                    self.shell.raw_input = custom_input

                # Capture displays while streaming stdout/err in real time
                with capture_output(stdout=False, stderr=False, display=True) as cap:
                    exec_result = self.shell.run_cell(code, store_history=True)

                stdout_text = clean_terminal_output(writer_out.getvalue())
                stderr_text = clean_terminal_output(writer_err.getvalue())

                # Collect rich display objects generated via display(...)
                for out in getattr(cap, "outputs", []):
                    if hasattr(out, "data") and isinstance(out.data, dict):
                        disp_item = {
                            "data": out.data,
                            "metadata": getattr(out, "metadata", {}) or {}
                        }
                        displays.append(disp_item)
                        # Extract shortcuts
                        if "image/png" in out.data:
                            images.append(out.data["image/png"])
                        if "image/jpeg" in out.data:
                            images.append(out.data["image/jpeg"])
                        if "image/svg+xml" in out.data and not svg_content:
                            svg_content = out.data["image/svg+xml"]
                        if "text/html" in out.data and not html_table:
                            html_table = out.data["text/html"]
                        if "text/latex" in out.data and not latex_content:
                            latex_content = out.data["text/latex"]
                        if "application/json" in out.data and json_content is None:
                            json_content = out.data["application/json"]

                # Check for execution errors
                if not exec_result.success:
                    status = "error"
                    exc = exec_result.error_in_exec or exec_result.error_before_exec
                    if exc:
                        tb_str = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))
                        error_info = {
                            "type": type(exc).__name__,
                            "message": str(exc),
                            "traceback": clean_terminal_output(tb_str)
                        }
                    else:
                        error_info = {
                            "type": "ExecutionError",
                            "message": "Cell execution failed",
                            "traceback": clean_terminal_output(stderr_text or stdout_text or "Execution failed without traceback")
                        }
                else:
                    res = exec_result.result
                    if res is not None:
                        # Full MIME bundle formatting via IPython display_formatter
                        if self.shell:
                            try:
                                fmt_dict, md_dict = self.shell.display_formatter.format(res)
                                if isinstance(fmt_dict, dict) and fmt_dict:
                                    result_data = fmt_dict
                                    result_metadata = md_dict or {}
                            except Exception:
                                pass

                        # Fallback repr hooks if display_formatter didn't populate
                        if not result_data:
                            if hasattr(res, "_repr_mimebundle_") and callable(getattr(res, "_repr_mimebundle_")):
                                try:
                                    mb = res._repr_mimebundle_()
                                    if isinstance(mb, tuple):
                                        result_data, result_metadata = mb
                                    elif isinstance(mb, dict):
                                        result_data = mb
                                except Exception:
                                    pass
                            if not result_data and hasattr(res, "_repr_html_") and callable(getattr(res, "_repr_html_")):
                                try:
                                    result_data["text/html"] = res._repr_html_()
                                except Exception:
                                    pass
                            if not result_data and hasattr(res, "to_html") and callable(getattr(res, "to_html")):
                                try:
                                    result_data["text/html"] = res.to_html(classes="pyshield-dataframe-table", max_rows=15)
                                except Exception:
                                    pass
                            if not result_data and hasattr(res, "_repr_svg_") and callable(getattr(res, "_repr_svg_")):
                                try:
                                    result_data["image/svg+xml"] = res._repr_svg_()
                                except Exception:
                                    pass
                            if not result_data and hasattr(res, "_repr_latex_") and callable(getattr(res, "_repr_latex_")):
                                try:
                                    result_data["text/latex"] = res._repr_latex_()
                                except Exception:
                                    pass
                            if not result_data and hasattr(res, "_repr_json_") and callable(getattr(res, "_repr_json_")):
                                try:
                                    result_data["application/json"] = res._repr_json_()
                                except Exception:
                                    pass
                            if "text/plain" not in result_data:
                                result_data["text/plain"] = repr(res)

                        # Extract convenient shortcuts for frontend
                        result_repr = result_data.get("text/plain")
                        if "text/html" in result_data and not html_table:
                            html_table = result_data["text/html"]
                        if "image/png" in result_data:
                            images.append(result_data["image/png"])
                        if "image/jpeg" in result_data:
                            images.append(result_data["image/jpeg"])
                        if "image/svg+xml" in result_data and not svg_content:
                            svg_content = result_data["image/svg+xml"]
                        if "text/latex" in result_data and not latex_content:
                            latex_content = result_data["text/latex"]
                        if "application/json" in result_data and json_content is None:
                            json_content = result_data["application/json"]

            except Exception as e:
                status = "error"
                error_info = {
                    "type": type(e).__name__,
                    "message": str(e),
                    "traceback": clean_terminal_output(traceback.format_exc())
                }
            finally:
                sys.stdout = old_stdout
                sys.stderr = old_stderr
                sys.stdin = old_stdin
                builtins.input = old_input
                if self.shell and old_raw_input is not None:
                    self.shell.raw_input = old_raw_input

        else:
            # Fallback to standard Python exec/eval if ipykernel not found
            try:
                sys.stdout = writer_out
                sys.stderr = writer_err
                sys.stdin = StreamCallbackReader(lambda p, pwd: custom_input(p, pwd))
                builtins.input = custom_input

                exec(code, self.globals_dict)
                stdout_text = writer_out.getvalue()
                stderr_text = writer_err.getvalue()
            except Exception as e:
                status = "error"
                error_info = {
                    "type": type(e).__name__,
                    "message": str(e),
                    "traceback": traceback.format_exc()
                }
            finally:
                sys.stdout = old_stdout
                sys.stderr = old_stderr
                sys.stdin = old_stdin
                builtins.input = old_input

        # Append any headless matplotlib figures
        fig_displays = self._capture_matplotlib_figures()
        for fd in fig_displays:
            displays.append(fd)
            if "image/png" in fd["data"]:
                images.append(fd["data"]["image/png"])
            if "image/svg+xml" in fd["data"] and not svg_content:
                svg_content = fd["data"]["image/svg+xml"]

        execution_time_ms = round((time.perf_counter() - start_time) * 1000, 2)

        return {
            "cell_id": cell_id,
            "execution_count": self.execution_count,
            "status": status,
            "engine": "ipykernel" if self.has_ipykernel else "builtin_python",
            "stdout": stdout_text,
            "stderr": stderr_text,
            "result_repr": result_repr,
            "html_table": html_table,
            "images": images,
            "data": result_data,           # Full MIME bundle for execute_result
            "metadata": result_metadata,   # Metadata for execute_result
            "displays": displays,          # Full list of display_data MIME bundles
            "svg": svg_content,            # Convenient SVG string
            "latex": latex_content,        # Convenient LaTeX formula string
            "json_data": json_content,     # Convenient structured JSON object
            "error": error_info,
            "execution_time_ms": execution_time_ms
        }

    def complete(self, code: str, cursor_pos: Optional[int] = None) -> Dict[str, Any]:
        """
        Calculates code completions at the given cursor position using IPython
        runtime memory and Jedi introspection.
        """
        if cursor_pos is None or cursor_pos > len(code):
            cursor_pos = len(code)
        else:
            cursor_pos = max(0, cursor_pos)

        if self.has_ipykernel and self.shell is not None:
            try:
                with provisionalcompleter():
                    raw_completions = self.shell.Completer.completions(code, cursor_pos)
                    completions = list(_rectify_completions(code, raw_completions))

                    comps = [
                        {
                            "text": comp.text,
                            "type": getattr(comp, "type", "unknown"),
                            "signature": getattr(comp, "signature", "")
                        }
                        for comp in completions
                    ]

                if completions:
                    s = completions[0].start
                    e = completions[0].end
                    matches = [c.text for c in completions]
                else:
                    s = cursor_pos
                    e = cursor_pos
                    matches = []

                return {
                    "status": "ok",
                    "matches": matches,
                    "cursor_start": s,
                    "cursor_end": e,
                    "metadata": {"_jupyter_types_experimental": comps}
                }
            except Exception:
                try:
                    line, offset = line_at_cursor(code, cursor_pos)
                    line_cursor = cursor_pos - offset
                    txt, matches = self.shell.complete("", line, line_cursor)
                    return {
                        "status": "ok",
                        "matches": matches or [],
                        "cursor_start": cursor_pos - len(txt),
                        "cursor_end": cursor_pos,
                        "metadata": {}
                    }
                except Exception:
                    pass

        # Builtin python fallback
        token = code[:cursor_pos].split()[-1] if code[:cursor_pos].split() else ""
        if "." in token:
            obj_name, prefix = token.rsplit(".", 1)
            target_obj = self.globals_dict.get(obj_name, getattr(builtins, obj_name, None))
            matches = [attr for attr in dir(target_obj) if attr.startswith(prefix)] if target_obj else []
            s = cursor_pos - len(prefix)
        else:
            prefix = token
            all_names = list(self.globals_dict.keys()) + dir(builtins)
            matches = [name for name in all_names if name.startswith(prefix)]
            s = cursor_pos - len(prefix)

        return {
            "status": "ok",
            "matches": matches,
            "cursor_start": s,
            "cursor_end": cursor_pos,
            "metadata": {}
        }

    def inspect(self, code: str, cursor_pos: Optional[int] = None, detail_level: int = 0) -> Dict[str, Any]:
        """
        Inspects an object / token at the cursor position (docstrings, signatures, type info)
        for real-time tooltips and Shift+Tab documentation.
        """
        if cursor_pos is None or cursor_pos > len(code):
            cursor_pos = len(code)
        else:
            cursor_pos = max(0, cursor_pos)

        if self.has_ipykernel and self.shell is not None:
            try:
                name = token_at_cursor(code, cursor_pos)
                if not name:
                    return {"status": "ok", "found": False, "data": {}, "metadata": {}}

                bundle = self.shell.object_inspect_mime(name, detail_level=detail_level)
                return {
                    "status": "ok",
                    "found": bool(bundle),
                    "name": name,
                    "data": bundle or {},
                    "metadata": {}
                }
            except Exception:
                pass

        # Builtin fallback
        token = code[:cursor_pos].replace("(", " ").split()[-1] if code[:cursor_pos] else ""
        obj = self.globals_dict.get(token, getattr(builtins, token, None))
        if obj is not None:
            import inspect as py_inspect
            doc = py_inspect.getdoc(obj) or ""
            sig = ""
            try:
                sig = str(py_inspect.signature(obj))
            except Exception:
                pass
            text_repr = f"Signature: {token}{sig}\nDocstring:\n{doc}"
            return {
                "status": "ok",
                "found": True,
                "name": token,
                "data": {"text/plain": text_repr},
                "metadata": {}
            }

        return {"status": "ok", "found": False, "data": {}, "metadata": {}}

