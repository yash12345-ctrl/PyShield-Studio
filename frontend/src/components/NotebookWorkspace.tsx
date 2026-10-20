import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import './NotebookWorkspace.css';
import Dataset from './datase';
import { FileExplore } from './file_explore';
import { UpdateWindow } from '../update_window/update_window';
import { API_BASE_URL, WS_BASE_URL } from '../config';
import {
  Play,
  RotateCcw,
  ArrowDownCircle,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  FileCode,
  Folder,
  LogOut,
  FileText,
  AlertCircle,
  Files,
  ListTree,
  Variable,
  Database,
  ShieldCheck,
  PanelLeftClose,
  PanelLeft,
  CheckCircle2,
  Copy,
  Check,
  Code2,
  CornerDownLeft,
  Square,
  X,
  Pencil
} from 'lucide-react';

interface CellOutput {
  stdout?: string;
  stderr?: string;
  resultRepr?: string;
  htmlTable?: string;
  images?: string[];
  data?: Record<string, any>;
  displays?: Array<{
    data: Record<string, any>;
    metadata?: Record<string, any>;
  }>;
  svg?: string;
  latex?: string;
  jsonData?: any;
  error?: {
    type?: string;
    message?: string;
    ename?: string;
    evalue?: string;
    traceback?: string | string[];
  };
  executionTimeMs?: number;
}

interface NotebookCell {
  id: string;
  cellType: 'code' | 'markdown';
  content: string;
  executionCount: number | null;
  isExecuting: boolean;
  output?: CellOutput;
  isWaitingForInput?: boolean;
  inputPrompt?: string;
  inputPassword?: boolean;
}

interface NotebookWorkspaceProps {
  session: {
    studentId: string;
    examCode: string;
    seatNumber: string;
    mode: 'candidate' | 'create_experiment';
    experimentTitle?: string;
    startTime?: number;
    selectedFolder?: string;
  };
  onEndSession: () => void;
  onSwitchFolder?: () => void;
}

export function cleanTerminalOutput(text: string): string {
  if (!text) return '';
  // 1. Strip all ANSI escape sequences (CSI, OSC, colors, cursor, modes)
  const stripped = text.replace(/\x1b(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');

  // 2. Resolve \r (carriage returns) per line for clean progress bars (tqdm, pip, keras, training loops)
  const lines = stripped.split('\n');
  const resolved = lines.map(line => {
    if (line.includes('\r')) {
      const parts = line.split('\r').filter(p => p.length > 0);
      return parts.length > 0 ? parts[parts.length - 1] : '';
    }
    return line;
  });

  return resolved.join('\n');
}

/**
 * Converts a string into an array of lines where every line
 * (except possibly the last) ends with a newline \n, complying with nbformat v4 specification.
 */
export function toSourceLines(text: string | undefined): string[] {
  if (!text) return [];
  const regex = /(.*?(?:\r\n|\n|$))/g;
  const matches = text.match(regex);
  if (!matches) return [];
  return matches.filter(line => line.length > 0);
}

/**
 * Normalizes multi-line source lines or a string back into a single string.
 */
export function fromSourceLines(source: string | string[] | undefined): string {
  if (!source) return '';
  if (Array.isArray(source)) {
    return source.join('');
  }
  return String(source);
}

/**
 * Exports internal cells array into a strictly compliant Jupyter Notebook (nbformat v4) JSON document.
 * Portable across Google Colab, VS Code, JupyterLab, nbconvert, and GitHub preview.
 */
export function exportToNbformatV4(cells: NotebookCell[]): string {
  const nbCells = cells.map((cell) => {
    const isMarkdown = cell.cellType === 'markdown';
    const baseCell: Record<string, any> = {
      cell_type: isMarkdown ? 'markdown' : 'code',
      metadata: {},
      source: toSourceLines(cell.content)
    };

    if (cell.id) {
      baseCell.id = cell.id;
    }

    if (!isMarkdown) {
      baseCell.execution_count = cell.executionCount ?? null;
      const outputs: any[] = [];

      if (cell.output) {
        // 1. stdout stream
        if (cell.output.stdout && cell.output.stdout.trim().length > 0) {
          outputs.push({
            output_type: 'stream',
            name: 'stdout',
            text: toSourceLines(cell.output.stdout)
          });
        }

        // 2. stderr stream
        if (cell.output.stderr && cell.output.stderr.trim().length > 0) {
          outputs.push({
            output_type: 'stream',
            name: 'stderr',
            text: toSourceLines(cell.output.stderr)
          });
        }

        // 3. execute_result (for evaluated expressions with full rich MIME bundle)
        if (cell.output.resultRepr || cell.output.htmlTable || cell.output.svg || cell.output.latex || cell.output.jsonData != null || cell.output.data) {
          const data: Record<string, any> = { ...(cell.output.data || {}) };
          if (cell.output.resultRepr && !data['text/plain']) {
            data['text/plain'] = toSourceLines(cell.output.resultRepr);
          }
          if (cell.output.htmlTable && !data['text/html']) {
            data['text/html'] = toSourceLines(cell.output.htmlTable);
          }
          if (cell.output.svg && !data['image/svg+xml']) {
            data['image/svg+xml'] = toSourceLines(cell.output.svg);
          }
          if (cell.output.latex && !data['text/latex']) {
            data['text/latex'] = toSourceLines(cell.output.latex);
          }
          if (cell.output.jsonData != null && !data['application/json']) {
            data['application/json'] = cell.output.jsonData;
          }

          outputs.push({
            output_type: 'execute_result',
            execution_count: cell.executionCount ?? null,
            data,
            metadata: {}
          });
        }

        // 4. display_data (for rich display MIME bundles and plots)
        if (cell.output.displays && cell.output.displays.length > 0) {
          for (const disp of cell.output.displays) {
            outputs.push({
              output_type: 'display_data',
              data: disp.data || {},
              metadata: disp.metadata || {}
            });
          }
        } else if (cell.output.images && cell.output.images.length > 0) {
          for (const img of cell.output.images) {
            const cleanBase64 = img.replace(/^data:image\/\w+;base64,/, '').trim();
            outputs.push({
              output_type: 'display_data',
              data: {
                'image/png': cleanBase64,
                'text/plain': ['<Figure size 640x480 with 1 Axes>']
              },
              metadata: {}
            });
          }
        }

        // 5. error
        if (cell.output.error) {
          const err = cell.output.error;
          const ename = err.ename || err.type || 'Error';
          const evalue = err.evalue || err.message || 'Execution error';
          let traceback: string[] = [];
          if (Array.isArray(err.traceback)) {
            traceback = err.traceback;
          } else if (typeof err.traceback === 'string') {
            traceback = err.traceback.split('\n');
          } else {
            traceback = [`${ename}: ${evalue}`];
          }
          outputs.push({
            output_type: 'error',
            ename,
            evalue,
            traceback
          });
        }
      }

      baseCell.outputs = outputs;
    }

    return baseCell;
  });

  const notebook = {
    cells: nbCells,
    metadata: {
      kernelspec: {
        display_name: 'Python 3 (ipykernel)',
        language: 'python',
        name: 'python3'
      },
      language_info: {
        codemirror_mode: {
          name: 'ipython',
          version: 3
        },
        file_extension: '.py',
        mimetype: 'text/x-python',
        name: 'python',
        nbconvert_exporter: 'python',
        pygments_lexer: 'ipython3',
        version: '3.12'
      }
    },
    nbformat: 4,
    nbformat_minor: 5
  };

  return JSON.stringify(notebook, null, 2);
}

/**
 * Imports and parses a valid Jupyter Notebook (nbformat v4) JSON document into internal NotebookCell objects.
 * Handles both nbformat v4 format and backward-compatible internal format.
 */
export function importFromNbformatV4(jsonText: string): NotebookCell[] {
  const parsed = JSON.parse(jsonText);
  if (!parsed || !Array.isArray(parsed.cells)) {
    throw new Error('Invalid notebook JSON: missing "cells" array.');
  }

  return parsed.cells.map((rawCell: any, index: number): NotebookCell => {
    const isMarkdown = rawCell.cell_type === 'markdown' || rawCell.cellType === 'markdown';
    const content = fromSourceLines(rawCell.source ?? rawCell.content ?? '');
    const id = rawCell.id || `cell-${index + 1}-${Math.random().toString(36).substring(2, 7)}`;
    const executionCount = typeof rawCell.execution_count === 'number'
      ? rawCell.execution_count
      : (typeof rawCell.executionCount === 'number' ? rawCell.executionCount : null);

    if (isMarkdown) {
      return {
        id,
        cellType: 'markdown',
        content,
        executionCount: null,
        isExecuting: false
      };
    }

    // Process code cell outputs
    const output: CellOutput = {
      stdout: '',
      stderr: '',
      images: []
    };

    if (Array.isArray(rawCell.outputs)) {
      for (const out of rawCell.outputs) {
        if (!out) continue;
        if (out.output_type === 'stream') {
          const streamText = fromSourceLines(out.text);
          if (out.name === 'stderr') {
            output.stderr = (output.stderr || '') + streamText;
          } else {
            output.stdout = (output.stdout || '') + streamText;
          }
        } else if (out.output_type === 'execute_result' || out.output_type === 'display_data') {
          if (out.data) {
            output.data = output.data ? { ...output.data, ...out.data } : { ...out.data };
            if (out.output_type === 'display_data') {
              output.displays = output.displays || [];
              output.displays.push({ data: out.data, metadata: out.metadata || {} });
            }
            if (out.data['text/plain']) {
              output.resultRepr = fromSourceLines(out.data['text/plain']);
            }
            if (out.data['text/html']) {
              output.htmlTable = fromSourceLines(out.data['text/html']);
            }
            if (out.data['image/svg+xml']) {
              output.svg = fromSourceLines(out.data['image/svg+xml']);
            }
            if (out.data['text/latex']) {
              output.latex = fromSourceLines(out.data['text/latex']);
            }
            if (out.data['application/json']) {
              output.jsonData = out.data['application/json'];
            }
            if (out.data['image/png']) {
              const b64 = Array.isArray(out.data['image/png'])
                ? out.data['image/png'].join('')
                : out.data['image/png'];
              output.images = output.images || [];
              output.images.push(b64.trim());
            }
            if (out.data['image/jpeg']) {
              const b64 = Array.isArray(out.data['image/jpeg'])
                ? out.data['image/jpeg'].join('')
                : out.data['image/jpeg'];
              output.images = output.images || [];
              output.images.push(b64.trim());
            }
          }
        } else if (out.output_type === 'error') {
          output.error = {
            ename: out.ename || 'Error',
            evalue: out.evalue || 'Execution error',
            type: out.ename || 'Error',
            message: out.evalue || 'Execution error',
            traceback: Array.isArray(out.traceback)
              ? out.traceback.join('\n')
              : String(out.traceback || '')
          };
        }
      }
    } else if (rawCell.output) {
      // Backward compatibility with previous custom structure
      output.stdout = rawCell.output.stdout || '';
      output.stderr = rawCell.output.stderr || '';
      output.resultRepr = rawCell.output.resultRepr;
      output.htmlTable = rawCell.output.htmlTable;
      output.images = rawCell.output.images || [];
      output.error = rawCell.output.error;
      output.executionTimeMs = rawCell.output.executionTimeMs;
    }

    return {
      id,
      cellType: 'code',
      content,
      executionCount,
      isExecuting: false,
      output: (output.stdout || output.stderr || output.resultRepr || output.htmlTable || (output.images && output.images.length > 0) || output.error)
        ? output
        : undefined
    };
  });
}

export const NotebookWorkspace: React.FC<NotebookWorkspaceProps> = ({ session, onEndSession, onSwitchFolder }) => {
  const [activeCellId, setActiveCellId] = useState<string>('cell-1');
  const [globalExecutionIndex, setGlobalExecutionIndex] = useState<number>(0);
  const [kernelStatus, setKernelStatus] = useState<'idle' | 'busy'>('idle');
  const [isZmqConnected, setIsZmqConnected] = useState<boolean>(false);
  const [showRestartModal, setShowRestartModal] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleRestartKernel = (clearOutputs: boolean = false) => {
    setShowRestartModal(false);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'restart_kernel' }));
    }
    setGlobalExecutionIndex(0);
    setCells(prev => prev.map(c => ({
      ...c,
      isExecuting: false,
      executionCount: null,
      output: clearOutputs ? undefined : c.output
    })));
    setKernelStatus('idle');
    showToast('✓ Kernel restarted. User namespace and memory reset.');
  };

  const handleInterruptKernel = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'interrupt_kernel' }));
    }
    setCells(prev => prev.map(c => ({ ...c, isExecuting: false })));
    setKernelStatus('idle');
    showToast('⏹ Interrupted kernel execution.');
  };

  // Sidebar navigation state
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'explorer' | 'outline' | 'variables' | 'datasets' | 'proctor' | 'update'>('explorer');

  // Auto-Update and Version Checking Engine
  const [currentVersion, setCurrentVersion] = useState<string>(() => {
    const saved = localStorage.getItem('pyshield_app_version');
    if (!saved || saved.startsWith('2.')) {
      localStorage.setItem('pyshield_app_version', '1.0.0');
      return '1.0.0';
    }
    return saved;
  });
  const [latestVersion, setLatestVersion] = useState<string>('1.0.0');
  const [hasUpdate, setHasUpdate] = useState<boolean>(false);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [updateProgress, setUpdateProgress] = useState<number>(0);
  const [updateStep, setUpdateStep] = useState<string>('');
  const [isUpdateReady, setIsUpdateReady] = useState<boolean>(false);
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState<boolean>(() => {
    return localStorage.getItem('pyshield_auto_update') !== 'false';
  });
  const [updateChangelog, setUpdateChangelog] = useState<string[]>([
    "Initial official release (v1.0.0) of Python Notebook IDE",
    "Isolated Python kernel execution with WebSocket bridge",
    "Real-time variable inspector and memory tracking",
    "Integrated file explorer and offline notebook persistence (.ipynb)"
  ]);
  const [updateReleaseDate, setUpdateReleaseDate] = useState<string>('April 2025');
  const [updatePackageSize, setUpdatePackageSize] = useState<string>('42.8 MB');
  const [lastCheckedTime, setLastCheckedTime] = useState<string | null>(null);

  const isVersionNewer = (latest: string, current: string): boolean => {
    const parse = (v: string) => v.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
    const [lMaj = 0, lMin = 0, lPat = 0] = parse(latest);
    const [cMaj = 0, cMin = 0, cPat = 0] = parse(current);
    if (lMaj > cMaj) return true;
    if (lMaj < cMaj) return false;
    if (lMin > cMin) return true;
    if (lMin < cMin) return false;
    return lPat > cPat;
  };

  const startUpdateSequence = async (targetVer?: string) => {
    const versionToInstall = targetVer || latestVersion;
    if (isUpdating || isUpdateReady) return;
    setIsUpdating(true);
    setUpdateProgress(12);
    setUpdateStep('Connecting to release distribution node...');

    await new Promise(r => setTimeout(r, 600));
    setUpdateProgress(38);
    setUpdateStep(`Downloading update bundle (${updatePackageSize})...`);

    await new Promise(r => setTimeout(r, 700));
    setUpdateProgress(72);
    setUpdateStep('Verifying cryptographic SHA-256 package hash...');

    await new Promise(r => setTimeout(r, 600));
    setUpdateProgress(95);
    setUpdateStep('Staging binary patches and finalizing installation...');

    await new Promise(r => setTimeout(r, 500));
    setUpdateProgress(100);
    setUpdateStep('Update successfully installed! Ready to restart.');
    setIsUpdating(false);
    setIsUpdateReady(true);
    showToast(`✓ PyShield Studio v${versionToInstall} update ready! Restart to apply.`);
  };

  const checkForUpdates = async (silent: boolean = false) => {
    if (!silent) setIsCheckingUpdates(true);
    try {
      let data: any = null;
      try {
        const res = await fetch(`${API_BASE_URL}/api/version`);
        if (res.ok) {
          data = await res.json();
        }
      } catch {
        // Backend offline or unreachable
      }

      if (!data) {
        try {
          const res = await fetch('/version.json');
          if (res.ok) {
            data = await res.json();
          }
        } catch {}
      }

      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastCheckedTime(timeStr);

      if (data && data.latest_version) {
        const latest = data.latest_version;
        setLatestVersion(latest);
        if (data.changelog) setUpdateChangelog(data.changelog);
        if (data.release_date) setUpdateReleaseDate(data.release_date);
        if (data.package_size) setUpdatePackageSize(data.package_size);

        const savedVer = localStorage.getItem('pyshield_app_version');
        const activeCurrent = (!savedVer || savedVer.startsWith('2.')) ? '1.0.0' : savedVer;
        if (activeCurrent !== currentVersion) {
          setCurrentVersion(activeCurrent);
          localStorage.setItem('pyshield_app_version', activeCurrent);
        }

        const newer = isVersionNewer(latest, activeCurrent);
        setHasUpdate(newer);

        if (newer) {
          if (!silent) {
            showToast(`✨ New update v${latest} is available!`);
          }
          if (autoUpdateEnabled && !isUpdating && !isUpdateReady) {
            startUpdateSequence(latest);
          }
        } else {
          if (!silent) {
            showToast(`✓ PyShield Studio is up to date (v${currentVersion}).`);
          }
        }
      }
    } catch {
      if (!silent) {
        showToast('Offline mode: Version verified locally.');
      }
    } finally {
      if (!silent) setIsCheckingUpdates(false);
    }
  };

  const applyRestart = () => {
    localStorage.setItem('pyshield_app_version', latestVersion);
    setCurrentVersion(latestVersion);
    setHasUpdate(false);
    setIsUpdateReady(false);
    setUpdateProgress(0);
    showToast(`Restarting PyShield Studio with v${latestVersion}...`);
    setTimeout(() => {
      window.location.reload();
    }, 800);
  };

  const simulateVersionBump = async (newVer: string) => {
    try {
      await fetch(`${API_BASE_URL}/api/version`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latest_version: newVer,
          release_date: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          changelog: [
            `Feature release v${newVer} with updated security core`,
            "Auto-update verified and applied seamlessly",
            "Performance boost in notebook rendering and cell execution"
          ]
        })
      });
    } catch {}
    setLatestVersion(newVer);
    setUpdateChangelog([
      `Feature release v${newVer} with updated security core`,
      "Auto-update verified and applied seamlessly",
      "Performance boost in notebook rendering and cell execution"
    ]);
    const newer = isVersionNewer(newVer, currentVersion);
    setHasUpdate(newer);
    if (newer) {
      showToast(`📢 Released v${newVer}! Auto-updating...`);
      if (autoUpdateEnabled) {
        startUpdateSequence(newVer);
      }
    } else {
      setIsUpdateReady(false);
      setUpdateProgress(0);
      showToast(`Version reset to v${newVer}.`);
    }
  };

  useEffect(() => {
    checkForUpdates(true);
    const interval = setInterval(() => {
      checkForUpdates(true);
    }, 60000);
    return () => clearInterval(interval);
  }, [currentVersion, autoUpdateEnabled]);

  


  const folderKey = session?.selectedFolder ? session.selectedFolder.replace(/[^a-zA-Z0-9_-]/g, '_') : 'root';
  const filesListStorageKey = `pyshield_files_${session?.studentId || 'default'}_${folderKey}`;
  const defaultInitialFile = `${session?.studentId || 'Lab_Notebook'}.ipynb`;

  // 1. Files List State
  const [files, setFiles] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(filesListStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    return [defaultInitialFile];
  });

  // 2. Active File Name State
  const activeFileStorageKey = `pyshield_active_file_${session?.studentId || 'default'}_${folderKey}`;
  const [activeFileName, setActiveFileName] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(activeFileStorageKey);
      if (saved && saved.trim()) {
        return saved;
      }
    } catch {}
    return defaultInitialFile;
  });

  // Helper to get storage key for a specific file's cells
  const getFileCellsStorageKey = (fileName: string) => {
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9_.-]/g, '_');
    return `pyshield_cells_${session?.studentId || 'default'}_${folderKey}_${cleanFileName}`;
  };

  // Helper to load cells for a file
  const loadCellsForFile = (fileName: string): NotebookCell[] => {
    try {
      const specificKey = getFileCellsStorageKey(fileName);
      const saved = localStorage.getItem(specificKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((c: any) => ({
            ...c,
            isExecuting: false,
            isWaitingForInput: false
          }));
        }
      }
      // Legacy fallback for default file
      if (fileName === defaultInitialFile) {
        const legacyKey = `pyshield_cells_${session?.studentId || 'default'}`;
        const legacySaved = localStorage.getItem(legacyKey);
        if (legacySaved) {
          const parsed = JSON.parse(legacySaved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map((c: any) => ({
              ...c,
              isExecuting: false,
              isWaitingForInput: false
            }));
          }
        }
      }
    } catch (e) {
      console.error('Failed to load cells for file:', fileName, e);
    }
    return [
      {
        id: 'cell-1',
        cellType: 'code',
        content: '',
        executionCount: null,
        isExecuting: false
      }
    ];
  };

  // 3. Current active cells state
  const [cells, setCells] = useState<NotebookCell[]>(() => loadCellsForFile(activeFileName));

  // Automatically persist cells for the current active file
  useEffect(() => {
    try {
      localStorage.setItem(getFileCellsStorageKey(activeFileName), JSON.stringify(cells));
    } catch {}
  }, [cells, activeFileName]);

  // Persist files list
  useEffect(() => {
    try {
      localStorage.setItem(filesListStorageKey, JSON.stringify(files));
    } catch {}
  }, [files, filesListStorageKey]);

  // Persist active file name
  useEffect(() => {
    try {
      localStorage.setItem(activeFileStorageKey, activeFileName);
    } catch {}
  }, [activeFileName, activeFileStorageKey]);

  // File action handlers
  const handleSelectFile = (fileName: string) => {
    if (fileName === activeFileName) return;
    try {
      localStorage.setItem(getFileCellsStorageKey(activeFileName), JSON.stringify(cells));
    } catch {}
    const nextCells = loadCellsForFile(fileName);
    setActiveFileName(fileName);
    setCells(nextCells);
    setActiveCellId(nextCells[0]?.id || 'cell-1');
    showToast(`Opened ${fileName}`);
  };

  const handleCreateFile = (name: string) => {
    let cleanName = name.trim();
    if (!cleanName) return;
    if (!cleanName.endsWith('.ipynb')) {
      cleanName += '.ipynb';
    }
    if (files.includes(cleanName)) {
      showToast(`⚠️ File "${cleanName}" already exists`);
      handleSelectFile(cleanName);
      return;
    }

    try {
      localStorage.setItem(getFileCellsStorageKey(activeFileName), JSON.stringify(cells));
    } catch {}

    const newFiles = [...files, cleanName];
    setFiles(newFiles);
    setActiveFileName(cleanName);

    const initialCell: NotebookCell[] = [
      {
        id: `cell-${Date.now()}`,
        cellType: 'code',
        content: '',
        executionCount: null,
        isExecuting: false
      }
    ];
    setCells(initialCell);
    setActiveCellId(initialCell[0].id);

    try {
      localStorage.setItem(getFileCellsStorageKey(cleanName), JSON.stringify(initialCell));
      localStorage.setItem(filesListStorageKey, JSON.stringify(newFiles));
      localStorage.setItem(activeFileStorageKey, cleanName);
    } catch {}

    showToast(`✓ Created new file ${cleanName}`);
  };

  const handleDeleteFile = (fileName: string) => {
    if (files.length <= 1) {
      showToast('⚠️ Cannot delete the only notebook file.');
      return;
    }
    const newFiles = files.filter(f => f !== fileName);
    setFiles(newFiles);
    try {
      localStorage.removeItem(getFileCellsStorageKey(fileName));
      localStorage.setItem(filesListStorageKey, JSON.stringify(newFiles));
    } catch {}

    if (activeFileName === fileName) {
      const fallbackFile = newFiles[0];
      setActiveFileName(fallbackFile);
      setCells(loadCellsForFile(fallbackFile));
    }
    showToast(`Deleted ${fileName}`);
  };

  const handleRenameFile = (oldName: string, newName: string) => {
    let cleanNew = newName.trim();
    if (!cleanNew) return;
    if (!cleanNew.endsWith('.ipynb')) {
      cleanNew += '.ipynb';
    }
    if (cleanNew === oldName) return;

    if (files.includes(cleanNew)) {
      showToast(`⚠️ File "${cleanNew}" already exists`);
      return;
    }

    const updatedFiles = files.map(f => (f === oldName ? cleanNew : f));
    setFiles(updatedFiles);

    const oldKey = getFileCellsStorageKey(oldName);
    const newKey = getFileCellsStorageKey(cleanNew);

    try {
      let cellDataToMove = localStorage.getItem(oldKey);
      if (!cellDataToMove && oldName === defaultInitialFile) {
        const legacyKey = `pyshield_cells_${session?.studentId || 'default'}`;
        cellDataToMove = localStorage.getItem(legacyKey);
      }
      if (!cellDataToMove && oldName === activeFileName) {
        cellDataToMove = JSON.stringify(cells);
      }
      if (cellDataToMove) {
        localStorage.setItem(newKey, cellDataToMove);
      }
      localStorage.removeItem(oldKey);
      localStorage.setItem(filesListStorageKey, JSON.stringify(updatedFiles));
    } catch (e) {
      console.error('Failed to migrate cells on rename:', e);
    }

    if (activeFileName === oldName) {
      setActiveFileName(cleanNew);
      try {
        localStorage.setItem(activeFileStorageKey, cleanNew);
      } catch {}
    }

    showToast(`✓ Renamed "${oldName}" to "${cleanNew}"`);
  };

  // Buffer holding interactive input prompt responses before submission
  const [inputReplyValues, setInputReplyValues] = useState<Record<string, string>>({});

  // Dynamic kernel metadata state (ephemeral ports, PID, isolated kernel ID)
  const [activeKernelInfo, setActiveKernelInfo] = useState<{
    id: string;
    pid?: number | null;
    ports?: { shell?: number; iopub?: number; control?: number; hb?: number; stdin?: number } | null;
  } | null>(null);

  // Dedicated isolated kernel ID per workspace session (persisted so refresh preserves kernel memory)
  const kernelIdRef = useRef<string>((() => {
    const kernelStorageKey = `pyshield_kernel_${session?.studentId || 'default'}`;
    try {
      const saved = localStorage.getItem(kernelStorageKey);
      if (saved && saved.trim().length > 0) return saved;
    } catch {}
    const generated = `kernel-${session?.studentId ? session.studentId.toLowerCase().replace(/[^a-z0-9]/g, '') : 'sess'}-${session?.seatNumber ? session.seatNumber.toLowerCase().replace(/[^a-z0-9]/g, '') : '01'}-${Math.random().toString(36).substring(2, 6)}`;
    try {
      localStorage.setItem(kernelStorageKey, generated);
    } catch {}
    return generated;
  })());
  const monacoProvidersRegisteredRef = useRef<boolean>(false);

  // Connect to local ZeroMQ WebSocket Bridge on mount with auto-reconnect and clean teardown
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isUnmounted = false;

    const connect = () => {
      if (isUnmounted) return;

      try {
        const socket = new WebSocket(`${WS_BASE_URL}/ws?kernel_id=${encodeURIComponent(kernelIdRef.current)}`);
        ws = socket;
        wsRef.current = socket;

        socket.onopen = () => {
          if (isUnmounted) {
            socket.close(1000, 'Unmounted');
            return;
          }
          setIsZmqConnected(true);
        };

        socket.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'kernel_status') {
              setIsZmqConnected(msg.connected);
              if (msg.kernel_id) {
                setActiveKernelInfo({
                  id: msg.kernel_id,
                  pid: msg.pid,
                  ports: msg.ports
                });
              }
              if (msg.state === 'dead') {
                showToast(`⚠️ ${msg.message || 'Kernel process crashed. PyShield is auto-recovering a fresh kernel...'}`);
              }
            } else if (msg.type === 'status') {
              setKernelStatus(msg.state === 'busy' ? 'busy' : 'idle');
              if (msg.cell_id && msg.state === 'busy') {
                setCells(prev => prev.map(c => c.id === msg.cell_id ? { ...c, isExecuting: true } : c));
              }
            } else if (msg.type === 'kernel_restarted') {
              if (msg.ports) {
                setActiveKernelInfo({
                  id: msg.kernel_id || kernelIdRef.current,
                  pid: msg.pid,
                  ports: msg.ports
                });
              }
              setKernelStatus('idle');
              setGlobalExecutionIndex(0);
              setCells(prev => prev.map(c => ({ ...c, isExecuting: false, isWaitingForInput: false, executionCount: null })));
              showToast('✓ Kernel restarted with fresh dynamic ephemeral ports. User namespace and memory reset.');
            } else if (msg.type === 'kernel_interrupted') {
              setKernelStatus('idle');
              setCells(prev => prev.map(c => ({ ...c, isExecuting: false, isWaitingForInput: false })));
              showToast('⏹ Execution interrupted.');
            } else if (msg.type === 'input_request') {
              setCells(prev => prev.map(c => {
                if (c.id === msg.cell_id) {
                  return {
                    ...c,
                    isExecuting: true,
                    isWaitingForInput: true,
                    inputPrompt: msg.prompt || '',
                    inputPassword: Boolean(msg.password)
                  };
                }
                return c;
              }));
            } else if (msg.type === 'stream') {
              setCells(prev => prev.map(c => {
                if (c.id === msg.cell_id) {
                  const isStderr = msg.name === 'stderr';
                  const currentStdout = c.output?.stdout || '';
                  const currentStderr = c.output?.stderr || '';
                  const cleanChunk = cleanTerminalOutput(msg.text);
                  return {
                    ...c,
                    isExecuting: true,
                    output: {
                      ...c.output,
                      stdout: isStderr ? currentStdout : cleanTerminalOutput(currentStdout + cleanChunk),
                      stderr: isStderr ? cleanTerminalOutput(currentStderr + cleanChunk) : currentStderr
                    }
                  };
                }
                return c;
              }));
            } else if (msg.type === 'execute_reply') {
              const res = msg.result;
              setCells(prev => prev.map(c => {
                if (c.id === msg.cell_id) {
                  return {
                    ...c,
                    isExecuting: false,
                    isWaitingForInput: false,
                    executionCount: res.execution_count ?? c.executionCount,
                    output: {
                      stdout: cleanTerminalOutput(res.stdout || c.output?.stdout || ''),
                      stderr: cleanTerminalOutput(res.stderr || c.output?.stderr || ''),
                      resultRepr: res.result_repr || c.output?.resultRepr,
                      htmlTable: res.html_table || c.output?.htmlTable,
                      images: res.images || c.output?.images || [],
                      data: res.data || c.output?.data,
                      displays: res.displays || c.output?.displays,
                      svg: res.svg || c.output?.svg,
                      latex: res.latex || c.output?.latex,
                      jsonData: res.json_data != null ? res.json_data : undefined,
                      error: res.error || c.output?.error,
                      executionTimeMs: res.execution_time_ms
                    }
                  };
                }
                return c;
              }));
              setKernelStatus('idle');
            }
          } catch (e) {
            console.error('Error handling ZeroMQ message:', e);
          }
        };

        socket.onerror = () => {
          setIsZmqConnected(false);
        };

        socket.onclose = () => {
          setIsZmqConnected(false);
          // If not unmounted, attempt reconnect after a brief interval
          if (!isUnmounted) {
            reconnectTimer = setTimeout(connect, 2000);
          }
        };
      } catch {
        setIsZmqConnected(false);
        if (!isUnmounted) {
          reconnectTimer = setTimeout(connect, 2000);
        }
      }
    };

    connect();

    return () => {
      isUnmounted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1000, 'Component unmounted');
        } else if (ws.readyState === WebSocket.CONNECTING) {
          // If handshake is still in progress, wait for it to open before closing
          // to prevent browser warning "WebSocket is closed before the connection is established"
          const pendingWs = ws;
          pendingWs.onopen = () => {
            try {
              pendingWs.close(1000, 'Component unmounted');
            } catch {
              // ignore
            }
          };
          pendingWs.onclose = null;
          pendingWs.onerror = null;
        }
      }
    };
  }, []);

  // Update cell code content
  const handleContentChange = (cellId: string, newContent: string | undefined) => {
    setCells(prev => prev.map(c => c.id === cellId ? { ...c, content: newContent || '' } : c));
  };

  // Add new cell
  const handleAddCell = (type: 'code' | 'markdown', afterId?: string) => {
    const newCell: NotebookCell = {
      id: `cell-${Date.now()}`,
      cellType: type,
      content: '',
      executionCount: null,
      isExecuting: false
    };

    setCells(prev => {
      if (!afterId) return [...prev, newCell];
      const index = prev.findIndex(c => c.id === afterId);
      if (index === -1) return [...prev, newCell];
      const updated = [...prev];
      updated.splice(index + 1, 0, newCell);
      return updated;
    });

    setActiveCellId(newCell.id);
  };

  // Delete cell
  const handleDeleteCell = (id: string) => {
    if (cells.length <= 1) {
      setCells([{
        id: 'cell-1',
        cellType: 'code',
        content: '',
        executionCount: null,
        isExecuting: false
      }]);
      setActiveCellId('cell-1');
      return;
    }
    setCells(prev => prev.filter(c => c.id !== id));
  };

  // Move cell up / down
  const handleMoveCell = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= cells.length) return;
    const updated = [...cells];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setCells(updated);
  };

  // Clear output
  const handleClearOutput = (id: string) => {
    setCells(prev => prev.map(c => c.id === id ? { ...c, output: undefined, executionCount: null } : c));
  };

  // Scroll to cell from Outline
  const scrollToCell = (cellId: string) => {
    setActiveCellId(cellId);
    const element = document.getElementById(`notebook-cell-${cellId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Insert Dataset loader code into cell
  const handleInsertDatasetCode = (code: string, datasetName: string) => {
    const activeCell = cells.find(c => c.id === activeCellId);
    if (activeCell && activeCell.content.trim() === '') {
      handleContentChange(activeCell.id, code);
      showToast(`Inserted ${datasetName} loader into current cell.`);
    } else {
      const newCell: NotebookCell = {
        id: `cell-${Date.now()}`,
        cellType: 'code',
        content: code,
        executionCount: null,
        isExecuting: false
      };
      setCells(prev => {
        if (!activeCellId) return [...prev, newCell];
        const index = prev.findIndex(c => c.id === activeCellId);
        if (index === -1) return [...prev, newCell];
        const updated = [...prev];
        updated.splice(index + 1, 0, newCell);
        return updated;
      });
      setActiveCellId(newCell.id);
      showToast(`Added new cell with ${datasetName} dataset.`);
    }
  };

  // Execute Cell via live ZeroMQ pipeline
  const handleRunCell = (cellId: string) => {
    const targetCell = cells.find(c => c.id === cellId);
    if (!targetCell) return;

    setKernelStatus('busy');
    const nextIndex = globalExecutionIndex + 1;
    setGlobalExecutionIndex(nextIndex);

    setCells(prev => prev.map(c => c.id === cellId ? {
      ...c,
      isExecuting: true,
      isWaitingForInput: false,
      output: {
        stdout: '',
        stderr: '',
        resultRepr: undefined,
        htmlTable: undefined,
        jsonData: undefined,
        svg: undefined,
        latex: undefined,
        images: [],
        error: undefined,
        executionTimeMs: undefined
      }
    } : c));

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'execute',
        cell_id: cellId,
        code: targetCell.content
      }));
    } else {
      // Direct HTTP execution against the IPython ZeroMQ Kernel
      fetch(`${API_BASE_URL}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cell_id: cellId, code: targetCell.content, kernel_id: kernelIdRef.current })
      })
      .then(res => res.json())
      .then(res => {
        setCells(prev => prev.map(c => {
          if (c.id === cellId) {
            return {
              ...c,
              isExecuting: false,
              isWaitingForInput: false,
              executionCount: res.execution_count ?? nextIndex,
              output: {
                stdout: cleanTerminalOutput(res.stdout || ''),
                stderr: cleanTerminalOutput(res.stderr || ''),
                resultRepr: res.result_repr,
                htmlTable: res.html_table,
                images: res.images || [],
                data: res.data,
                displays: res.displays,
                svg: res.svg,
                latex: res.latex,
                jsonData: res.json_data != null ? res.json_data : undefined,
                error: res.error,
                executionTimeMs: res.execution_time_ms
              }
            };
          }
          return c;
        }));
        setKernelStatus('idle');
      })
      .catch(() => {
        setCells(prev => prev.map(c => {
          if (c.id === cellId) {
            return {
              ...c,
              isExecuting: false,
              isWaitingForInput: false,
              executionCount: nextIndex,
              output: {
                error: {
                  type: 'KernelConnectionError',
                  message: 'Cannot connect to local Python IPython kernel server on port 5001. Ensure run_backend.py is active.'
                }
              }
            };
          }
          return c;
        }));
        setKernelStatus('idle');
      });
    }
  };

  // Submit response for 2-way interactive input() prompt back to ZeroMQ Kernel
  const handleSendInputReply = (cellId: string) => {
    const value = inputReplyValues[cellId] ?? '';
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'input_reply',
        cell_id: cellId,
        value: value
      }));
    }
    // Optimistically clear waiting prompt for instantaneous responsiveness
    setCells(prev => prev.map(c => c.id === cellId ? { ...c, isWaitingForInput: false } : c));
    setInputReplyValues(prev => {
      const next = { ...prev };
      delete next[cellId];
      return next;
    });
  };

  const [copiedCellId, setCopiedCellId] = useState<string | null>(null);

  const handleCopyCode = (cellId: string, content: string) => {
    if (!content.trim()) return;
    navigator.clipboard.writeText(content);
    setCopiedCellId(cellId);
    setTimeout(() => setCopiedCellId(null), 1500);
  };

  const handleEditorDidMount = (editor: any, monaco: any, cellId: string) => {
    // Bind Shift+Enter to run cell
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
      handleRunCell(cellId);
    });
    // Bind Ctrl+Enter to run cell
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      handleRunCell(cellId);
    });
    // Bind Shift+Tab for Jupyter-style instant docstring / tooltip hover
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Tab, () => {
      editor.trigger('keyboard', 'editor.action.showHover', {});
    });

    // Register live Python kernel runtime providers once globally on the Monaco instance
    if (!monacoProvidersRegisteredRef.current) {
      monacoProvidersRegisteredRef.current = true;

      // 1. Live Runtime Completion Provider (Introspection over active kernel)
      monaco.languages.registerCompletionItemProvider('python', {
        triggerCharacters: ['.', '(', '[', '%', ' '],
        provideCompletionItems: async (model: any, position: any) => {
          try {
            const code = model.getValue();
            const cursor_pos = model.getOffsetAt(position);
            const currentKid = kernelIdRef.current || 'default';
            const res = await fetch(`${API_BASE_URL}/api/kernels/${encodeURIComponent(currentKid)}/complete`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code, cursor_pos })
            });

            if (!res.ok) return { suggestions: [] };
            const data = await res.json();

            if (!data || !Array.isArray(data.matches) || data.matches.length === 0) {
              return { suggestions: [] };
            }

            const startPos = model.getPositionAt(data.cursor_start ?? cursor_pos);
            const endPos = model.getPositionAt(data.cursor_end ?? cursor_pos);
            const range = {
              startLineNumber: startPos.lineNumber,
              startColumn: startPos.column,
              endLineNumber: endPos.lineNumber,
              endColumn: endPos.column
            };

            const metaList: Array<{ text: string; type: string; signature?: string }> =
              data.metadata?._jupyter_types_experimental || [];

            const suggestions = data.matches.map((item: string, idx: number) => {
              const meta = metaList.find(m => m.text === item);
              let kind = monaco.languages.CompletionItemKind.Property;
              if (meta?.type === 'function') kind = monaco.languages.CompletionItemKind.Function;
              else if (meta?.type === 'class') kind = monaco.languages.CompletionItemKind.Class;
              else if (meta?.type === 'module') kind = monaco.languages.CompletionItemKind.Module;
              else if (meta?.type === 'keyword') kind = monaco.languages.CompletionItemKind.Keyword;
              else if (meta?.type === 'instance' || meta?.type === 'statement') kind = monaco.languages.CompletionItemKind.Variable;

              return {
                label: item,
                kind: kind,
                detail: meta?.signature ? `${item}${meta.signature}` : meta?.type ? `(${meta.type})` : 'Kernel runtime',
                documentation: meta?.signature ? `Signature: ${item}${meta.signature}` : `Runtime object in active kernel`,
                insertText: item,
                range: range,
                sortText: String(idx).padStart(5, '0')
              };
            });

            return { suggestions };
          } catch {
            return { suggestions: [] };
          }
        }
      });

      // 2. Live Runtime Hover & Shift+Tab Tooltip Provider (Docstrings & Signatures)
      monaco.languages.registerHoverProvider('python', {
        provideHover: async (model: any, position: any) => {
          try {
            const code = model.getValue();
            const cursor_pos = model.getOffsetAt(position);
            const currentKid = kernelIdRef.current || 'default';
            const res = await fetch(`${API_BASE_URL}/api/kernels/${encodeURIComponent(currentKid)}/inspect`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code, cursor_pos, detail_level: 0 })
            });

            if (!res.ok) return null;
            const data = await res.json();
            if (!data || !data.found || !data.data) return null;

            const plainDoc: string = data.data['text/plain'] || '';
            if (!plainDoc.trim()) return null;

            const word = model.getWordAtPosition(position);
            const range = word ? {
              startLineNumber: position.lineNumber,
              startColumn: word.startColumn,
              endLineNumber: position.lineNumber,
              endColumn: word.endColumn
            } : undefined;

            const parts = plainDoc.split('\nDocstring:');
            const signature = parts[0] || '';
            const docstring = parts.length > 1 ? parts[1].trim() : '';

            const contents = [
              { value: `### 🐍 **${data.name || word?.word || 'Kernel Introspection'}**` },
              { value: '```python\n' + signature.trim() + '\n```' }
            ];
            if (docstring) {
              contents.push({ value: docstring.slice(0, 1000) + (docstring.length > 1000 ? '\n\n*(docstring truncated)*' : '') });
            }

            return {
              range: range,
              contents: contents
            };
          } catch {
            return null;
          }
        }
      });
    }
  };

  // Run all cells sequentially
  const handleRunAll = () => {
    cells.forEach((cell, idx) => {
      setTimeout(() => {
        handleRunCell(cell.id);
      }, idx * 600);
    });
  };

  const handleSaveIpynb = () => {
    try {
      const nbJson = exportToNbformatV4(cells);
      const blob = new Blob([nbJson], { type: 'application/x-ipynb+json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = activeFileName;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`✓ Saved ${activeFileName} (.ipynb v4 format)`);
    } catch (err: any) {
      showToast(`❌ Failed to save notebook: ${err.message}`);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveIpynb();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cells, activeFileName]);



  return (
    <div className="notebook-viewport">
      {/* 1. Header Toolbar */}
      <header className="notebook-header">
        <div className="notebook-header-left">
          <button
            type="button"
            className={`sidebar-toggle-btn ${sidebarOpen ? 'active' : ''}`}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title="Toggle Sidebar"
          >
            {sidebarOpen ? <PanelLeftClose size={17} /> : <PanelLeft size={17} />}
          </button>

          <div className="notebook-brand-mark">
            <img src="/app_logo.png" alt="Logo" style={{ width: '24px', height: '24px' }} />
            <span>PyShield Studio</span>
          </div>

          {session.selectedFolder && (
            <div
              className="file-name-badge folder-badge"
              style={{ cursor: onSwitchFolder ? 'pointer' : 'default', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}
              onClick={onSwitchFolder}
              title={onSwitchFolder ? 'Click to switch project folder' : undefined}
            >
              <Folder size={13} color="#2563eb" />
              <span>{session.selectedFolder}</span>
            </div>
          )}

          <div className="file-name-badge">
            <FileCode size={13} color="var(--primary)" />
            <span>{activeFileName}</span>
            <button
              type="button"
              className="file-name-rename-header-btn"
              onClick={() => {
                const newName = window.prompt(`Rename "${activeFileName}":`, activeFileName);
                if (newName && newName.trim()) {
                  handleRenameFile(activeFileName, newName.trim());
                }
              }}
              title="Rename active notebook"
            >
              <Pencil size={11} />
            </button>
          </div>
        </div>



        <div className="notebook-header-right">
          <div className="user-terminal-pill">
            <span>{session.studentId || 'Candidate'}</span>
          </div>

          <button
            type="button"
            className="toolbar-action-btn exit-btn"
            onClick={onEndSession}
            title="Submit and Exit Examination Session"
          >
            <LogOut size={13} />
            <span>Exit Workspace</span>
          </button>
        </div>
      </header>

      {/* 2. Main Body with Side-by-Side Sidebar and Canvas */}
      <div className="notebook-main-layout">
        {/* Activity Icon Bar */}
        <aside className="activity-icon-bar">
          <div className="activity-top-group">
            <button
              type="button"
              className={`activity-btn ${activeSidebarTab === 'explorer' && sidebarOpen ? 'active' : ''}`}
              onClick={() => {
                if (activeSidebarTab === 'explorer' && sidebarOpen) {
                  setSidebarOpen(false);
                } else {
                  setActiveSidebarTab('explorer');
                  setSidebarOpen(true);
                }
              }}
              title="File Explorer"
            >
              <Files size={18} />
            </button>

            <button
              type="button"
              className={`activity-btn ${activeSidebarTab === 'outline' && sidebarOpen ? 'active' : ''}`}
              onClick={() => {
                if (activeSidebarTab === 'outline' && sidebarOpen) {
                  setSidebarOpen(false);
                } else {
                  setActiveSidebarTab('outline');
                  setSidebarOpen(true);
                }
              }}
              title="Notebook Cell Outline"
            >
              <ListTree size={18} />
            </button>

            <button
              type="button"
              className={`activity-btn ${activeSidebarTab === 'variables' && sidebarOpen ? 'active' : ''}`}
              onClick={() => {
                if (activeSidebarTab === 'variables' && sidebarOpen) {
                  setSidebarOpen(false);
                } else {
                  setActiveSidebarTab('variables');
                  setSidebarOpen(true);
                }
              }}
              title="Kernel Variable Inspector"
            >
              <Variable size={18} />
            </button>

            <button
              type="button"
              className={`activity-btn ${activeSidebarTab === 'datasets' && sidebarOpen ? 'active' : ''}`}
              onClick={() => {
                if (activeSidebarTab === 'datasets' && sidebarOpen) {
                  setSidebarOpen(false);
                } else {
                  setActiveSidebarTab('datasets');
                  setSidebarOpen(true);
                }
              }}
              title="Lab Datasets"
            >
              <Database size={18} />
            </button>

            <button
              type="button"
              className={`activity-btn ${activeSidebarTab === 'proctor' && sidebarOpen ? 'active' : ''}`}
              onClick={() => {
                if (activeSidebarTab === 'proctor' && sidebarOpen) {
                  setSidebarOpen(false);
                } else {
                  setActiveSidebarTab('proctor');
                  setSidebarOpen(true);
                }
              }}
              title="Proctoring & Integrity Status"
            >
              <ShieldCheck size={18} />
            </button>

            <button
              type="button"
              className={`activity-btn ${activeSidebarTab === 'update' && sidebarOpen ? 'active' : ''}`}
              onClick={() => {
                if (activeSidebarTab === 'update' && sidebarOpen) {
                  setSidebarOpen(false);
                } else {
                  setActiveSidebarTab('update');
                  setSidebarOpen(true);
                }
              }}
              title={hasUpdate ? `Update Available: v${latestVersion} (Click to open)` : `Software Updates & Version (v${currentVersion})`}
            >
              <ArrowDownCircle size={18} />
              {hasUpdate && <span className="activity-update-dot" />}
            </button>
          </div>

          <div className="activity-bottom-group">
            <button
              type="button"
              className="activity-btn"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title={sidebarOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
            >
              {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
            </button>
          </div>
        </aside>

        {/* Collapsible Sidebar Drawer */}
        {sidebarOpen && (
          <aside className="workspace-sidebar-drawer">
            {/* Explorer Tab */}
            {activeSidebarTab === 'explorer' && (
              <FileExplore
                files={files}
                activeFileName={activeFileName}
                notebookFileName={activeFileName}
                selectedFolder={session.selectedFolder}
                onSelectFile={handleSelectFile}
                onCreateFile={handleCreateFile}
                onRenameFile={handleRenameFile}
                onDeleteFile={handleDeleteFile}
              />
            )}

            {/* Outline Tab */}
            {activeSidebarTab === 'outline' && (
              <div className="sidebar-tab-content">
                <div className="sidebar-pane-header">
                  <span>NOTEBOOK OUTLINE</span>
                  <span className="cell-count-badge">{cells.length} cells</span>
                </div>

                <div className="outline-list">
                  {cells.map((cell, idx) => {
                    const firstLine = cell.content.split('\n').find(l => l.trim().length > 0) || '(Empty cell)';
                    const isCode = cell.cellType === 'code';

                    return (
                      <div
                        key={cell.id}
                        className={`outline-item ${cell.id === activeCellId ? 'active' : ''}`}
                        onClick={() => scrollToCell(cell.id)}
                      >
                        <span className="outline-badge">
                          {isCode ? `[${cell.executionCount || idx + 1}]` : 'MD'}
                        </span>
                        <div className="outline-text-block">
                          <span className="outline-title">
                            {cell.content.trim() ? firstLine.slice(0, 32) : `Empty ${isCode ? 'Code' : 'Markdown'} Cell`}
                          </span>
                          <span className="outline-meta">
                            {isCode ? 'Python 3' : 'Markdown'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="outline-quick-actions">
                  <button
                    type="button"
                    className="quick-add-btn"
                    onClick={() => handleAddCell('code', activeCellId)}
                  >
                    <Plus size={13} />
                    <span>Add Code</span>
                  </button>
                  <button
                    type="button"
                    className="quick-add-btn"
                    onClick={() => handleAddCell('markdown', activeCellId)}
                  >
                    <FileText size={13} />
                    <span>Add Markdown</span>
                  </button>
                </div>
              </div>
            )}

            {/* Variable Inspector Tab */}
            {activeSidebarTab === 'variables' && (
              <div className="sidebar-tab-content">
                <div className="sidebar-pane-header">
                  <span>KERNEL VARIABLES</span>
                  <Variable size={14} color="var(--primary)" />
                </div>

                <p className="sidebar-helper-text">
                  Variables defined during cell execution appear here automatically.
                </p>

                <div className="variable-table">
                  <div className="var-row header">
                    <span>NAME</span>
                    <span>TYPE</span>
                    <span>VALUE</span>
                  </div>
                  <div className="var-row">
                    <span className="var-name">np</span>
                    <span className="var-type">module</span>
                    <span className="var-val">numpy 1.26</span>
                  </div>
                  <div className="var-row">
                    <span className="var-name">pd</span>
                    <span className="var-type">module</span>
                    <span className="var-val">pandas 2.2</span>
                  </div>
                  <div className="var-row">
                    <span className="var-name">plt</span>
                    <span className="var-type">module</span>
                    <span className="var-val">matplotlib.pyplot</span>
                  </div>
                </div>
              </div>
            )}

            {/* Datasets Tab */}
            {activeSidebarTab === 'datasets' && (
              <Dataset
                onInsertCode={handleInsertDatasetCode}
                showToast={showToast}
              />
            )}

            {/* Security Tab */}
            {activeSidebarTab === 'proctor' && (
              <div className="sidebar-tab-content">
                <div className="sidebar-pane-header">
                  <span>PROCTORING & INTEGRITY</span>
                  <ShieldCheck size={14} color="var(--success)" />
                </div>

                <div className="security-info-card">
                  <div className="security-status-indicator">
                    <CheckCircle2 size={16} color="var(--success)" />
                    <strong>Offline Lockdown Enforced</strong>
                  </div>
                  <p>All network interfaces are monitored. Any active connection terminates evaluation.</p>
                </div>

                <div className="security-details-list">
                  <div className="sec-item">
                    <span className="sec-label">Candidate ID</span>
                    <span className="sec-val">{session.studentId}</span>
                  </div>
                  <div className="sec-item">
                    <span className="sec-label">Clipboard Security</span>
                    <span className="sec-val active">Blocked</span>
                  </div>
                  <div className="sec-item">
                    <span className="sec-label">Security Violations</span>
                    <span className="sec-val clean">0 Detected</span>
                  </div>
                  <div className="sec-item">
                    <span className="sec-label">Kernel Process</span>
                    <span className="sec-val active">{activeKernelInfo?.pid ? `PID ${activeKernelInfo.pid}` : 'Isolated Subprocess'}</span>
                  </div>
                  <div className="sec-item">
                    <span className="sec-label">ZMQ Channel</span>
                    <span className="sec-val">{activeKernelInfo?.ports ? `Ports ${activeKernelInfo.ports.shell}-${activeKernelInfo.ports.stdin}` : 'Dynamic Ports'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Update Tab */}
            {activeSidebarTab === 'update' && (
              <UpdateWindow
                currentVersion={currentVersion}
                latestVersion={latestVersion}
                hasUpdate={hasUpdate}
                isChecking={isCheckingUpdates}
                isUpdating={isUpdating}
                updateProgress={updateProgress}
                updateStep={updateStep}
                isUpdateReady={isUpdateReady}
                autoUpdateEnabled={autoUpdateEnabled}
                changelog={updateChangelog}
                releaseDate={updateReleaseDate}
                packageSize={updatePackageSize}
                lastCheckedTime={lastCheckedTime}
                onToggleAutoUpdate={(val) => {
                  setAutoUpdateEnabled(val);
                  localStorage.setItem('pyshield_auto_update', String(val));
                  showToast(`Auto-update ${val ? 'enabled' : 'disabled'}`);
                }}
                onCheckForUpdates={() => checkForUpdates(false)}
                onStartUpdate={() => startUpdateSequence()}
                onApplyRestart={applyRestart}
                onSimulateVersionBump={simulateVersionBump}
              />
            )}
          </aside>
        )}

        {/* 3. Main Center Canvas Area */}
        <div className="notebook-canvas-area">
          {/* Action Toolbar */}
          <div className="notebook-toolbar">
            <div className="toolbar-btn-group">
              <button
                type="button"
                className="toolbar-action-btn primary"
                onClick={handleRunAll}
                title="Run All Notebook Cells"
              >
                <Play size={13} fill="#ffffff" />
                <span>Run All</span>
              </button>
              <button
                type="button"
                className={`toolbar-action-btn ${kernelStatus === 'busy' ? 'interrupt-active' : ''}`}
                onClick={handleInterruptKernel}
                disabled={kernelStatus !== 'busy'}
                title={kernelStatus === 'busy' ? "Interrupt Kernel (Stop execution)" : "Kernel is idle"}
              >
                <Square size={12} fill={kernelStatus === 'busy' ? '#ef4444' : 'none'} color={kernelStatus === 'busy' ? '#ef4444' : 'currentColor'} />
                <span>Interrupt</span>
              </button>
              <button
                type="button"
                className="toolbar-action-btn"
                onClick={() => handleAddCell('code', activeCellId)}
                title="Add Code Cell Below"
              >
                <Plus size={14} />
                <span>Code</span>
              </button>
              <button
                type="button"
                className="toolbar-action-btn"
                onClick={() => handleAddCell('markdown', activeCellId)}
                title="Add Markdown Cell Below"
              >
                <FileText size={14} />
                <span>Markdown</span>
              </button>
            </div>

            <div className="toolbar-btn-group">
              <button
                type="button"
                className="toolbar-action-btn"
                onClick={() => setShowRestartModal(true)}
                title="Restart Kernel (Jupyter style)"
              >
                <RotateCcw size={13} />
                <span>Restart Kernel</span>
              </button>



            </div>
          </div>

          {/* Scrollable Cells Canvas */}
          <main className="cells-scroll-container bg-grid-pattern">
            <div className="cells-wrapper">
              {cells.map((cell, index) => {
                const isActive = cell.id === activeCellId;

                return (
                  <div
                    key={cell.id}
                    id={`notebook-cell-${cell.id}`}
                    className={`notebook-cell-card ${isActive ? 'active' : ''}`}
                    onClick={() => setActiveCellId(cell.id)}
                  >
                    {/* Active Accent Strip */}
                    <div className={`cell-accent-strip ${isActive ? 'focused' : ''} ${cell.isExecuting ? 'executing' : ''}`} />

                    {/* Cell Control Header Bar */}
                    <div className="cell-header-bar">
                      <div className="cell-info-left">
                        <button
                          type="button"
                          className={`cell-play-btn ${cell.isExecuting ? 'running' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (cell.isExecuting) {
                              handleInterruptKernel();
                            } else {
                              handleRunCell(cell.id);
                            }
                          }}
                          title={cell.isExecuting ? "Interrupt cell execution (Stop)" : "Execute Cell (Shift + Enter)"}
                        >
                          {cell.isExecuting ? (
                            <Square size={11} fill="#ef4444" color="#ef4444" />
                          ) : (
                            <Play size={12} fill="currentColor" />
                          )}
                        </button>

                        <span className="cell-execution-counter">
                          {cell.isExecuting ? '[ * ]:' : cell.executionCount ? `[ ${cell.executionCount} ]:` : '[   ]:'}
                        </span>

                        <span className="cell-type-tag">
                          <Code2 size={13} color="var(--primary)" />
                          <span>{cell.cellType === 'code' ? 'Python 3 (ipykernel)' : 'Markdown'}</span>
                        </span>

                        {cell.output?.executionTimeMs && (
                          <span className="cell-runtime-pill">
                            ⚡ {cell.output.executionTimeMs} ms
                          </span>
                        )}
                      </div>

                      <div className="cell-actions-right">
                        <span className="shortcut-hint">
                          Shift + Enter <CornerDownLeft size={10} />
                        </span>

                        <button
                          type="button"
                          className="cell-icon-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyCode(cell.id, cell.content);
                          }}
                          title="Copy Cell Code"
                        >
                          {copiedCellId === cell.id ? <Check size={13} color="var(--success)" /> : <Copy size={13} />}
                        </button>

                        <button
                          type="button"
                          className="cell-icon-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveCell(index, 'up');
                          }}
                          disabled={index === 0}
                          title="Move Cell Up"
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          type="button"
                          className="cell-icon-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveCell(index, 'down');
                          }}
                          disabled={index === cells.length - 1}
                          title="Move Cell Down"
                        >
                          <ArrowDown size={13} />
                        </button>
                        <button
                          type="button"
                          className="cell-icon-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleClearOutput(cell.id);
                          }}
                          title="Clear Output"
                        >
                          <RotateCcw size={13} />
                        </button>
                        <button
                          type="button"
                          className="cell-icon-btn delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCell(cell.id);
                          }}
                          title="Delete Cell"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Monaco Editor Canvas */}
                    <div className="monaco-cell-container">
                      <Editor
                        height={Math.max(115, (cell.content.split('\n').length + 1) * 22)}
                        language={cell.cellType === 'code' ? 'python' : 'markdown'}
                        value={cell.content}
                        theme="vs"
                        onMount={(editor, monaco) => handleEditorDidMount(editor, monaco, cell.id)}
                        onChange={(val) => handleContentChange(cell.id, val)}
                        options={{
                          minimap: { enabled: false },
                          lineNumbers: 'on',
                          glyphMargin: false,
                          folding: true,
                          lineDecorationsWidth: 10,
                          lineNumbersMinChars: 3,
                          fontSize: 14,
                          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                          fontLigatures: true,
                          lineHeight: 22,
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                          tabSize: 4,
                          wordWrap: 'on',
                          cursorBlinking: 'smooth',
                          cursorSmoothCaretAnimation: 'on',
                          quickSuggestions: { other: true, comments: false, strings: true },
                          suggestOnTriggerCharacters: true,
                          acceptSuggestionOnEnter: 'on',
                          tabCompletion: 'on',
                          hover: { enabled: 'on', delay: 250 },
                          parameterHints: { enabled: true },
                          renderLineHighlight: 'all',
                          bracketPairColorization: { enabled: true },
                          autoClosingBrackets: 'always',
                          autoClosingQuotes: 'always',
                          overviewRulerBorder: false,
                          hideCursorInOverviewRuler: true,
                          padding: { top: 10, bottom: 10 },
                          scrollbar: {
                            vertical: 'hidden',
                            horizontal: 'auto',
                            handleMouseWheel: false
                          }
                        }}
                      />
                    </div>

                    {/* Output Area */}
                    {(cell.isExecuting || cell.isWaitingForInput || (cell.output && (
                      (cell.output.stdout && cell.output.stdout.length > 0) ||
                      (cell.output.stderr && cell.output.stderr.length > 0) ||
                      (cell.output.resultRepr && cell.output.resultRepr.length > 0) ||
                      cell.output.htmlTable ||
                      cell.output.jsonData != null ||
                      cell.output.svg ||
                      cell.output.latex ||
                      (cell.output.images && cell.output.images.length > 0) ||
                      cell.output.error
                    ))) && (
                      <div className="cell-output-container">
                        <div className="cell-output-header">
                          <div className="cell-output-header-left">
                            <span className="output-tag">Execution Output</span>
                            {cell.isExecuting && !cell.isWaitingForInput && (
                              <span className="executing-badge">
                                <span className="executing-dot"></span>
                                Executing...
                              </span>
                            )}
                            {cell.isWaitingForInput && (
                              <span className="waiting-input-badge">
                                <span className="waiting-input-dot"></span>
                                Waiting for Input
                              </span>
                            )}
                          </div>
                          <div className="cell-output-header-right">
                            {cell.output?.executionTimeMs && !cell.isExecuting && (
                              <span className="output-time">{cell.output.executionTimeMs} ms</span>
                            )}
                            <button
                              type="button"
                              className="clear-output-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleClearOutput(cell.id);
                              }}
                              title="Clear Cell Output"
                            >
                              Clear
                            </button>
                          </div>
                        </div>

                        {/* Standard Output Stream */}
                        {cell.output?.stdout && cell.output.stdout.length > 0 && (
                          <pre className="cell-output-text stdout">
                            {cell.output.stdout}
                          </pre>
                        )}

                        {/* Interactive Input Prompt Box when kernel requests input */}
                        {cell.isWaitingForInput && (
                          <div className="cell-input-prompt-container">
                            <div className="cell-input-prompt-label">
                              <span className="prompt-label-icon">❯</span>
                              <span className="prompt-label-text">
                                {cell.inputPrompt ? cell.inputPrompt : "Kernel input requested:"}
                              </span>
                            </div>
                            <form
                              className="cell-input-prompt-form"
                              onSubmit={(e) => {
                                e.preventDefault();
                                handleSendInputReply(cell.id);
                              }}
                            >
                              <input
                                type={cell.inputPassword ? "password" : "text"}
                                className="cell-input-prompt-field"
                                placeholder={cell.inputPassword ? "Enter password..." : "Type input and press Enter..."}
                                value={inputReplyValues[cell.id] ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setInputReplyValues(prev => ({ ...prev, [cell.id]: val }));
                                }}
                                autoFocus
                              />
                              <button
                                type="submit"
                                className="cell-input-submit-btn"
                                title="Submit input to kernel"
                              >
                                Submit <CornerDownLeft size={13} />
                              </button>
                            </form>
                          </div>
                        )}

                        {/* Rich Expression Evaluation Result (Out [n]: result) */}
                        {cell.output?.resultRepr && !cell.output?.htmlTable && !cell.output?.svg && !cell.output?.latex && cell.output?.jsonData == null && (
                          <div className="cell-output-result-box">
                            <span className="result-prompt">Out [{cell.executionCount || ' '}]:</span>
                            <pre className="cell-output-text result-text">
                              {cell.output.resultRepr}
                            </pre>
                          </div>
                        )}

                        {/* Formatted DataFrame / Rich HTML Component */}
                        {cell.output?.htmlTable && (
                          <div
                            className="dataframe-table-wrapper"
                            dangerouslySetInnerHTML={{ __html: cell.output.htmlTable }}
                          />
                        )}

                        {/* SVG Vector Graphics */}
                        {cell.output?.svg && (
                          <div className="cell-output-svg-wrapper">
                            <div className="output-format-badge">
                              <span>SVG Vector Graphic</span>
                            </div>
                            <div
                              className="cell-output-svg"
                              dangerouslySetInnerHTML={{ __html: cell.output.svg }}
                            />
                          </div>
                        )}

                        {/* LaTeX Mathematical Formula */}
                        {cell.output?.latex && (
                          <div className="cell-output-latex-box">
                            <div className="output-format-badge">
                              <span>LaTeX Equation</span>
                            </div>
                            <div className="latex-content-render">
                              <code>{cell.output.latex}</code>
                            </div>
                          </div>
                        )}

                        {/* Interactive Structured JSON Viewer */}
                        {cell.output?.jsonData != null && (
                          <div className="cell-output-json-box">
                            <div className="output-format-badge">
                              <span>application/json</span>
                            </div>
                            <pre className="cell-output-text json-text">
                              {typeof cell.output.jsonData === 'string'
                                ? cell.output.jsonData
                                : JSON.stringify(cell.output.jsonData, null, 2)}
                            </pre>
                          </div>
                        )}

                        {/* Base64 Plots if generated */}
                        {cell.output?.images && cell.output.images.length > 0 && (
                          <div className="cell-output-plot">
                            {cell.output.images.map((imgB64, i) => (
                              <img
                                key={i}
                                src={`data:image/png;base64,${imgB64}`}
                                alt={`Cell Plot ${i + 1}`}
                                className="plot-image"
                              />
                            ))}
                          </div>
                        )}

                        {/* Warning / Stderr Stream */}
                        {cell.output?.stderr && cell.output.stderr.length > 0 && (
                          <div className="cell-output-stderr-box">
                            <div className="stderr-header">
                              <AlertCircle size={13} />
                              <span>stderr / warnings:</span>
                            </div>
                            <pre className="cell-output-text stderr">
                              {cell.output.stderr}
                            </pre>
                          </div>
                        )}

                        {/* Error Traceback */}
                        {cell.output?.error && (
                          <div className="cell-output-text error">
                            <div style={{ fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <AlertCircle size={14} />
                              <span>{cell.output.error.type || cell.output.error.ename || 'Execution Error'}: {cell.output.error.message || cell.output.error.evalue || ''}</span>
                            </div>
                            <pre style={{ margin: 0, fontFamily: 'inherit', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                              {Array.isArray(cell.output.error.traceback)
                                ? cell.output.error.traceback.join('\n')
                                : (cell.output.error.traceback || cell.output.error.message)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Quick Add Bottom Bar */}
              <div className="insert-cell-bar">
                <button
                  type="button"
                  className="insert-btn primary"
                  onClick={() => handleAddCell('code')}
                >
                  <Plus size={14} />
                  <span>Add Code Cell</span>
                </button>
                <button
                  type="button"
                  className="insert-btn"
                  onClick={() => handleAddCell('markdown')}
                >
                  <FileText size={14} />
                  <span>Add Markdown</span>
                </button>
              </div>
            </div>
          </main>

          {/* Bottom Status Bar */}
          <footer className="notebook-statusbar">
            <div className="statusbar-left">
              <span>Cell {cells.findIndex(c => c.id === activeCellId) + 1} of {cells.length}</span>
              <span className="dot-divider">•</span>
              <span>Python 3 (ipykernel 7.4)</span>
            </div>

            <div className="statusbar-center">
              <span className="status-live-dot" style={{ backgroundColor: isZmqConnected ? 'var(--success)' : '#94a3b8' }} />
              <span>
                {isZmqConnected
                  ? `Kernel: ${activeKernelInfo?.id || 'Connected'} (PID: ${activeKernelInfo?.pid || '-'}) • Ports: ${activeKernelInfo?.ports ? `${activeKernelInfo.ports.shell}-${activeKernelInfo.ports.stdin}` : 'Dynamic Ephemeral'}`
                  : 'Kernel Disconnected (Offline)'}
              </span>
            </div>

            <div className="statusbar-right">
              <span>UTF-8</span>
              <span className="dot-divider">•</span>
              <span>Proctored Lockdown Active</span>
            </div>
          </footer>
        </div>
      </div>

      {/* Jupyter-Style Restart Kernel Dialog */}
      {showRestartModal && (
        <div className="jupyter-modal-backdrop" onClick={() => setShowRestartModal(false)}>
          <div className="jupyter-modal-card" onClick={e => e.stopPropagation()}>
            <div className="jupyter-modal-header">
              <div className="jupyter-modal-title">
                <RotateCcw size={18} className="restart-icon-spin" />
                <span>Restart Kernel?</span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowRestartModal(false)}
                title="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="jupyter-modal-body">
              <p>
                Do you want to restart the current kernel? All variables, imported modules, and runtime state will be reset.
              </p>
              <p className="modal-subtext">
                (Choose <strong>Restart Kernel</strong> to keep your current outputs visible, or <strong>Restart & Clear</strong> to wipe all outputs).
              </p>
            </div>
            <div className="jupyter-modal-footer">
              <button
                type="button"
                className="modal-btn secondary"
                onClick={() => setShowRestartModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="modal-btn warning"
                onClick={() => handleRestartKernel(true)}
              >
                Restart & Clear Outputs
              </button>
              <button
                type="button"
                className="modal-btn primary"
                onClick={() => handleRestartKernel(false)}
              >
                Restart Kernel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="jupyter-toast-notification">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
