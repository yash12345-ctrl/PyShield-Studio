import React, { useState, useRef, useEffect } from 'react';
import {
  FolderTree,
  ChevronDown,
  ChevronRight,
  FileCode,
  Folder,
  Plus,
  Check,
  X,
  Trash2,
  Pencil
} from 'lucide-react';
import './file_explore.css';

export interface FileExploreProps {
  files?: string[];
  activeFileName?: string;
  notebookFileName?: string;
  selectedFolder?: string;
  onSelectFile?: (fileName: string) => void;
  onCreateFile?: (fileName: string) => void;
  onRenameFile?: (oldFileName: string, newFileName: string) => void;
  onDeleteFile?: (fileName: string) => void;
  onSelectNotebook?: () => void;
}

export const FileExplore: React.FC<FileExploreProps> = ({
  files,
  activeFileName,
  notebookFileName = 'notebook.ipynb',
  selectedFolder,
  onSelectFile,
  onCreateFile,
  onRenameFile,
  onDeleteFile,
  onSelectNotebook
}) => {
  const [activeNotebookExpanded, setActiveNotebookExpanded] = useState<boolean>(true);
  const [librariesExpanded, setLibrariesExpanded] = useState<boolean>(true);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [newFileName, setNewFileName] = useState<string>('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [editingFileName, setEditingFileName] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  const fileList = files && files.length > 0 ? files : [notebookFileName];
  const currentActiveFile = activeFileName || fileList[0];

  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreating]);

  useEffect(() => {
    if (editingFileName && renameInputRef.current) {
      renameInputRef.current.focus();
      const dotIdx = renameValue.lastIndexOf('.');
      if (dotIdx > 0) {
        renameInputRef.current.setSelectionRange(0, dotIdx);
      } else {
        renameInputRef.current.select();
      }
    }
  }, [editingFileName]);

  const handleStartCreate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveNotebookExpanded(true);
    setIsCreating(true);
    setNewFileName('');
  };

  const handleConfirmCreate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = newFileName.trim();
    if (!clean) {
      setIsCreating(false);
      return;
    }
    const finalName = clean.endsWith('.ipynb') ? clean : `${clean}.ipynb`;
    if (onCreateFile) {
      onCreateFile(finalName);
    }
    setIsCreating(false);
    setNewFileName('');
  };

  const handleCancelCreate = () => {
    setIsCreating(false);
    setNewFileName('');
  };

  const handleStartRename = (fileName: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setEditingFileName(fileName);
    setRenameValue(fileName);
  };

  const handleConfirmRename = (oldName: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = renameValue.trim();
    if (!clean || clean === oldName) {
      setEditingFileName(null);
      return;
    }
    const finalName = clean.endsWith('.ipynb') ? clean : `${clean}.ipynb`;
    if (onRenameFile) {
      onRenameFile(oldName, finalName);
    }
    setEditingFileName(null);
  };

  const handleCancelRename = () => {
    setEditingFileName(null);
  };

  const handleFileClick = (fileName: string) => {
    if (editingFileName === fileName) return;
    if (onSelectFile) {
      onSelectFile(fileName);
    } else if (onSelectNotebook) {
      onSelectNotebook();
    }
  };

  return (
    <div className="sidebar-tab-content file-explore-pane">
      <div className="sidebar-pane-header">
        <span>EXPLORER & LAB FILES</span>
        <FolderTree size={14} color="var(--text-muted)" />
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-title">
          <div
            className="sidebar-title-left"
            onClick={() => setActiveNotebookExpanded(prev => !prev)}
            title={activeNotebookExpanded ? 'Collapse' : 'Expand'}
          >
            {activeNotebookExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>{selectedFolder ? `FOLDER: ${selectedFolder.toUpperCase()}` : 'ACTIVE NOTEBOOK'}</span>
          </div>

          <button
            type="button"
            className="file-explore-plus-btn"
            onClick={handleStartCreate}
            title="Create New Notebook File in this Folder"
          >
            <Plus size={14} />
          </button>
        </div>

        {activeNotebookExpanded && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {selectedFolder && (
              <div
                className="file-tree-item"
                style={{ color: 'var(--text-muted)', fontSize: '11.5px', padding: '4px 8px' }}
              >
                <Folder size={13} color="#2563eb" />
                <span className="file-name" style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {selectedFolder}/
                </span>
              </div>
            )}

            {/* Inline New File Creator */}
            {isCreating && (
              <form
                className="file-explore-new-file-form"
                onSubmit={handleConfirmCreate}
                onClick={(e) => e.stopPropagation()}
              >
                <FileCode size={13} color="#2563eb" />
                <input
                  ref={inputRef}
                  type="text"
                  className="file-explore-new-file-input"
                  placeholder="name.ipynb"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') handleCancelCreate();
                  }}
                />
                <button
                  type="submit"
                  className="file-explore-form-btn submit"
                  title="Confirm"
                >
                  <Check size={12} />
                </button>
                <button
                  type="button"
                  className="file-explore-form-btn cancel"
                  onClick={handleCancelCreate}
                  title="Cancel"
                >
                  <X size={12} />
                </button>
              </form>
            )}

            {/* List of files */}
            {fileList.map((fileName) => {
              const isActive = fileName === currentActiveFile;
              const isRenaming = editingFileName === fileName;

              if (isRenaming) {
                return (
                  <form
                    key={fileName}
                    className="file-explore-rename-form"
                    onSubmit={(e) => handleConfirmRename(fileName, e)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <FileCode size={13} color="var(--primary)" />
                    <input
                      ref={renameInputRef}
                      type="text"
                      className="file-explore-rename-input"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') handleCancelRename();
                      }}
                      onBlur={() => handleConfirmRename(fileName)}
                    />
                    <button
                      type="submit"
                      className="file-explore-form-btn submit"
                      title="Save name"
                    >
                      <Check size={12} />
                    </button>
                    <button
                      type="button"
                      className="file-explore-form-btn cancel"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleCancelRename();
                      }}
                      title="Cancel"
                    >
                      <X size={12} />
                    </button>
                  </form>
                );
              }

              return (
                <div
                  key={fileName}
                  className={`file-tree-item ${isActive ? 'active' : ''}`}
                  style={selectedFolder ? { paddingLeft: '20px' } : undefined}
                  onClick={() => handleFileClick(fileName)}
                  onDoubleClick={(e) => handleStartRename(fileName, e)}
                  title={`Open ${fileName} (Double-click or click pencil to rename)`}
                >
                  <FileCode size={14} color={isActive ? 'var(--primary)' : 'var(--text-muted)'} />
                  <span className="file-name">{fileName}</span>

                  {isActive && <span className="file-tag">Live</span>}

                  <div className="file-item-actions">
                    {onRenameFile && (
                      <button
                        type="button"
                        className="file-tree-action-btn edit"
                        onClick={(e) => handleStartRename(fileName, e)}
                        title={`Rename ${fileName}`}
                      >
                        <Pencil size={11} />
                      </button>
                    )}

                    {onDeleteFile && fileList.length > 1 && (
                      <button
                        type="button"
                        className="file-tree-action-btn delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Delete ${fileName}?`)) {
                            onDeleteFile(fileName);
                          }
                        }}
                        title={`Delete ${fileName}`}
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="sidebar-section">
        <div
          className="sidebar-section-title"
          style={{ cursor: 'pointer' }}
          onClick={() => setLibrariesExpanded(prev => !prev)}
        >
          <div className="sidebar-title-left">
            {librariesExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>PRE-LOADED ML LIBRARIES</span>
          </div>
        </div>
        {librariesExpanded && (
          <div className="env-pill-list">
            <span className="env-tag">NumPy 1.26</span>
            <span className="env-tag">Pandas 2.2</span>
            <span className="env-tag">Scikit-Learn 1.4</span>
            <span className="env-tag">Matplotlib 3.8</span>
            <span className="env-tag">PyTorch CPU</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileExplore;
