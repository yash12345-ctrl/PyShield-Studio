import React, { useState, useEffect, useMemo } from 'react';
import {
  Folder,
  FolderPlus,
  ArrowRight,
  User,
  Shield,
  LogOut,
  Calendar,
  CheckCircle2,
  Plus,
  Sparkles,
  AlertCircle,
  Search,
  LayoutGrid,
  List,
  FileCode,
  Terminal,
  Cpu,
  Trash2,
  Clock,
  X,
  ChevronRight
} from 'lucide-react';
import './select_folder.css';

export interface UserFolder {
  id?: number;
  folder_name: string;
  description?: string;
  created_at?: string;
}

export interface SelectFolderProps {
  session: {
    studentId: string;
    examCode: string;
    seatNumber: string;
    mode: 'candidate' | 'create_experiment';
    experimentTitle?: string;
  };
  onSelectFolder: (folderName: string) => void;
  onLogout: () => void;
}



export const SelectFolder: React.FC<SelectFolderProps> = ({
  session,
  onSelectFolder,
  onLogout
}) => {
  const [folders, setFolders] = useState<UserFolder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState<'workspaces' | 'recent'>('workspaces');

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [newFolderDesc, setNewFolderDesc] = useState<string>('');
  const [selectedCategoryTag, setSelectedCategoryTag] = useState<string>('Lab Experiment');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const storageKey = `pyshield_user_folders_${session.studentId || 'default'}`;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Helper to read notebook files stored inside a folder
  const getFolderNotebooks = (folderName: string): string[] => {
    const folderKey = folderName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filesKey = `pyshield_files_${session.studentId || 'default'}_${folderKey}`;
    try {
      const raw = localStorage.getItem(filesKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [`${session.studentId || 'Lab_Notebook'}.ipynb`];
  };

  // 1. Fetch folders for this user from SQLite database (with localStorage fallback)
  useEffect(() => {
    let isMounted = true;

    const fetchFolders = async () => {
      setLoading(true);
      try {
        const resp = await fetch(
          `http://127.0.0.1:5001/api/user-folders?registration_number=${encodeURIComponent(session.studentId)}`
        );
        if (resp.ok) {
          const data = await resp.json();
          if (isMounted && data.status === 'success' && Array.isArray(data.folders)) {
            setFolders(data.folders);
            // Sync with local storage
            try {
              localStorage.setItem(storageKey, JSON.stringify(data.folders));
            } catch {}
            if (data.folders.length > 0) {
              setSelectedFolder(data.folders[0].folder_name);
            } else {
              setShowCreateModal(true);
            }
            setLoading(false);
            return;
          }
        }
      } catch {
        // Fallback to local storage if bridge server offline or not updated yet
      }

      // Local storage fallback
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed: UserFolder[] = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            if (isMounted) {
              setFolders(parsed);
              setSelectedFolder(parsed[0].folder_name);
              setLoading(false);
              return;
            }
          }
        }
      } catch {}

      if (isMounted) {
        setFolders([]);
        setShowCreateModal(true);
        setLoading(false);
      }
    };

    fetchFolders();

    return () => {
      isMounted = false;
    };
  }, [session.studentId, storageKey]);

  // Keyboard shortcut listener: Enter to launch selected folder
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && selectedFolder && !showCreateModal) {
        e.preventDefault();
        onSelectFolder(selectedFolder);
      }
      if (e.key === 'Escape' && showCreateModal) {
        setShowCreateModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFolder, showCreateModal, onSelectFolder]);

  // 2. Handle creating a new workspace folder
  const handleCreateFolder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanName = newFolderName.trim();
    if (!cleanName) {
      showToast('⚠️ Please enter a valid folder name.');
      return;
    }

    // Check if duplicate exists locally
    if (folders.some(f => f.folder_name.toLowerCase() === cleanName.toLowerCase())) {
      showToast(`⚠️ Workspace "${cleanName}" already exists.`);
      return;
    }

    setIsSubmitting(true);
    const finalDesc = newFolderDesc.trim() || `${selectedCategoryTag} Workspace`;
    const newFolderObj: UserFolder = {
      folder_name: cleanName,
      description: finalDesc,
      created_at: new Date().toISOString()
    };

    // Try persisting to SQLite database via backend API
    try {
      const resp = await fetch('http://127.0.0.1:5001/api/user-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registration_number: session.studentId,
          folder_name: cleanName,
          description: finalDesc
        })
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data.status === 'success') {
          console.log('Folder saved to SQLite DB successfully:', data);
        }
      }
    } catch {
      // Backend offline: continue with local persistence
    }

    const updatedFolders = [newFolderObj, ...folders];
    setFolders(updatedFolders);
    setSelectedFolder(cleanName);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updatedFolders));
    } catch {}

    setNewFolderName('');
    setNewFolderDesc('');
    setShowCreateModal(false);
    setIsSubmitting(false);
    showToast(`✓ Workspace "${cleanName}" initialized and saved!`);
  };

  // 3. Handle folder deletion
  const handleDeleteFolder = async (folderName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete workspace "${folderName}" and its notebooks?`)) {
      return;
    }

    try {
      await fetch(
        `http://127.0.0.1:5001/api/user-folders?registration_number=${encodeURIComponent(session.studentId)}&folder_name=${encodeURIComponent(folderName)}`,
        { method: 'DELETE' }
      );
    } catch {}

    const updatedFolders = folders.filter(f => f.folder_name !== folderName);
    setFolders(updatedFolders);

    try {
      localStorage.setItem(storageKey, JSON.stringify(updatedFolders));
      const folderKey = folderName.replace(/[^a-zA-Z0-9_-]/g, '_');
      localStorage.removeItem(`pyshield_files_${session.studentId}_${folderKey}`);
      localStorage.removeItem(`pyshield_active_file_${session.studentId}_${folderKey}`);
    } catch {}

    if (selectedFolder === folderName) {
      setSelectedFolder(updatedFolders[0]?.folder_name || '');
    }
    showToast(`Deleted workspace "${folderName}"`);
  };



  // 5. Aggregate all recent notebooks across user's folders
  const allRecentNotebooks = useMemo(() => {
    const list: { folderName: string; notebookName: string }[] = [];
    folders.forEach(f => {
      const nbs = getFolderNotebooks(f.folder_name);
      nbs.forEach(nb => {
        list.push({ folderName: f.folder_name, notebookName: nb });
      });
    });
    return list;
  }, [folders]);

  // Filtered folders based on search query
  const filteredFolders = useMemo(() => {
    if (!searchQuery.trim()) return folders;
    const q = searchQuery.toLowerCase();
    return folders.filter(
      f =>
        f.folder_name.toLowerCase().includes(q) ||
        (f.description && f.description.toLowerCase().includes(q))
    );
  }, [folders, searchQuery]);

  return (
    <div className="select-folder-viewport ide-layout">
      {/* 1. Sleek IDE Top Navigation & Telemetry Bar */}
      <header className="sf-header ide-header">
        <div className="sf-header-left">
          <div className="sf-brand">
            <div className="sf-brand-icon">
              <Shield size={18} />
            </div>
            <div>
              <div className="sf-brand-title">
                PyShield Studio
              </div>
              <div className="sf-brand-subtitle">Interactive Data Science & Examination Workbench</div>
            </div>
          </div>

          <div className="sf-header-divider" />

          {/* Breadcrumb Path */}
          <div className="sf-breadcrumb">
            <span className="sf-crumb-dim">Workspace Hub</span>
            <ChevronRight size={13} className="sf-crumb-arrow" />
            <span className="sf-crumb-active">
              {activeTab === 'workspaces' && 'Project Workspaces'}
              {activeTab === 'recent' && 'Recent Notebooks'}
            </span>
          </div>
        </div>

        {/* Center / Right Telemetry Status */}
        <div className="sf-header-right">
          <div className="sf-telemetry-badge" title="Isolated ZeroMQ IPC execution socket">
            <span className="sf-pulse-dot" />
            <Cpu size={13} color="#2563eb" />
            <span>Python 3.12 Sandboxed Kernel</span>
          </div>

          <div className="sf-user-badge" title="Authenticated Candidate">
            <User size={13} color="#2563eb" />
            <span className="sf-user-reg">{session.studentId || 'Candidate'}</span>
          </div>

          <button
            type="button"
            className="sf-btn-logout"
            onClick={onLogout}
            title="Log out and return to candidate login"
          >
            <LogOut size={13} />
            <span>Switch User</span>
          </button>
        </div>
      </header>

      {/* 2. Main Workbench Body (Sidebar + Content Workspace) */}
      <div className="sf-workbench-body">
        {/* Left IDE Navigation Drawer */}
        <aside className="sf-workbench-sidebar">
          <div className="sf-sidebar-section">
            <div className="sf-sidebar-heading">WORKSPACES & LABS</div>
            <button
              type="button"
              className={`sf-sidebar-nav-btn ${activeTab === 'workspaces' ? 'active' : ''}`}
              onClick={() => setActiveTab('workspaces')}
            >
              <Folder size={15} />
              <span>Project Workspaces</span>
              <span className="sf-sidebar-count">{folders.length}</span>
            </button>

            <button
              type="button"
              className={`sf-sidebar-nav-btn ${activeTab === 'recent' ? 'active' : ''}`}
              onClick={() => setActiveTab('recent')}
            >
              <Clock size={15} />
              <span>Recent Notebooks</span>
              <span className="sf-sidebar-count">{allRecentNotebooks.length}</span>
            </button>
          </div>

          <div className="sf-sidebar-section">
            <div className="sf-sidebar-heading">PRE-LOADED LIBRARIES</div>
            <div className="sf-lib-pill-list">
              <span className="sf-lib-tag">NumPy 1.26</span>
              <span className="sf-lib-tag">Pandas 2.2</span>
              <span className="sf-lib-tag">Scikit-Learn 1.4</span>
              <span className="sf-lib-tag">Matplotlib 3.8</span>
              <span className="sf-lib-tag">PyTorch CPU</span>
            </div>
          </div>


        </aside>

        {/* Right Main Workspace Canvas */}
        <main className="sf-workbench-main">
          {/* Top Control Bar: Search + View Toggles + New Folder CTA */}
          <div className="sf-control-toolbar">
            <div className="sf-toolbar-title-group">
              <h1 className="sf-toolbar-heading">
                {activeTab === 'workspaces' && 'Workspace Project Hub'}
                {activeTab === 'recent' && 'All Recent Notebooks'}
              </h1>
              <p className="sf-toolbar-subtext">
                {activeTab === 'workspaces' && 'Select an active laboratory workspace to open your Jupyter notebooks, or initialize a new project.'}
                {activeTab === 'recent' && 'All Jupyter notebooks detected across your laboratory workspace folders.'}
              </p>
            </div>

            <div className="sf-toolbar-actions">
              {activeTab === 'workspaces' && (
                <>
                  <div className="sf-search-box">
                    <Search size={14} className="sf-search-icon" />
                    <input
                      type="text"
                      className="sf-search-input"
                      placeholder="Filter workspaces..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        className="sf-search-clear"
                        onClick={() => setSearchQuery('')}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  <div className="sf-view-toggle">
                    <button
                      type="button"
                      className={`sf-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                      onClick={() => setViewMode('grid')}
                      title="Grid View"
                    >
                      <LayoutGrid size={15} />
                    </button>
                    <button
                      type="button"
                      className={`sf-view-btn ${viewMode === 'list' ? 'active' : ''}`}
                      onClick={() => setViewMode('list')}
                      title="List View"
                    >
                      <List size={15} />
                    </button>
                  </div>
                </>
              )}

              <button
                type="button"
                className="sf-btn-primary sf-new-folder-cta"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus size={14} />
                <span>New Project Folder</span>
              </button>
            </div>
          </div>

          {/* Tab 1: Workspaces Content Area */}
          {activeTab === 'workspaces' && (
            <div className="sf-canvas-scroll">
              {loading && (
                <div className="sf-loading-state">
                  <div className="sf-spinner" />
                  <span>Loading candidate project registry from SQLite...</span>
                </div>
              )}

              {/* Empty State: No Folders Yet */}
              {!loading && folders.length === 0 && (
                <div className="sf-empty-state-ide">
                  <div className="sf-empty-icon-ring">
                    <FolderPlus size={32} />
                  </div>
                  <h3>No Workspace Folders Initialized</h3>
                  <p>
                    No laboratory project folders exist for candidate{' '}
                    <strong>{session.studentId}</strong>. Create a new folder to launch your interactive Jupyter workspace.
                  </p>
                  <button
                    type="button"
                    className="sf-btn-primary"
                    onClick={() => setShowCreateModal(true)}
                  >
                    <Plus size={14} />
                    <span>Create First Project Folder</span>
                  </button>
                </div>
              )}

              {/* No Matching Search Results */}
              {!loading && folders.length > 0 && filteredFolders.length === 0 && (
                <div className="sf-empty-state-ide search-empty">
                  <Search size={28} color="#94a3b8" />
                  <h3>No workspaces match "{searchQuery}"</h3>
                  <p>Try searching with another keyword or clear the filter query.</p>
                  <button
                    type="button"
                    className="sf-btn-secondary"
                    onClick={() => setSearchQuery('')}
                  >
                    Clear Filter
                  </button>
                </div>
              )}

              {/* Grid View of Project Folders */}
              {!loading && filteredFolders.length > 0 && viewMode === 'grid' && (
                <div className="sf-folder-grid-ide">
                  {filteredFolders.map((f, idx) => {
                    const isSelected = selectedFolder === f.folder_name;
                    const notebooks = getFolderNotebooks(f.folder_name);
                    const colorVariants = ['#2563eb', '#4f46e5', '#0891b2', '#059669', '#7c3aed'];
                    const accentColor = colorVariants[idx % colorVariants.length];

                    return (
                      <div
                        key={f.folder_name}
                        className={`sf-folder-card-ide ${isSelected ? 'selected' : ''}`}
                        onClick={() => setSelectedFolder(f.folder_name)}
                        onDoubleClick={() => onSelectFolder(f.folder_name)}
                        title="Click to select · Double-click to launch"
                      >
                        <div className="sf-card-top-bar">
                          <div
                            className="sf-folder-pill-icon"
                            style={{ background: `${accentColor}18`, color: accentColor }}
                          >
                            <Folder size={18} />
                          </div>

                          <div className="sf-card-top-right">
                            {isSelected && (
                              <span className="sf-active-target-badge">
                                <CheckCircle2 size={11} />
                                Active Target
                              </span>
                            )}
                            <button
                              type="button"
                              className="sf-card-delete-btn"
                              onClick={(e) => handleDeleteFolder(f.folder_name, e)}
                              title={`Delete workspace "${f.folder_name}"`}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        <div className="sf-card-content">
                          <h3 className="sf-card-title">{f.folder_name}</h3>
                          <p className="sf-card-description">
                            {f.description || 'JupyterLab & VS Code compatible workspace directory.'}
                          </p>
                        </div>

                        {/* Files Preview Tag */}
                        <div className="sf-card-notebooks-preview">
                          <div className="sf-preview-header">
                            <FileCode size={12} color="#64748b" />
                            <span>
                              {notebooks.length} {notebooks.length === 1 ? 'Notebook' : 'Notebooks'} Inside:
                            </span>
                          </div>
                          <div className="sf-notebook-tags">
                            {notebooks.slice(0, 3).map((nb) => (
                              <span key={nb} className="sf-nb-tag">
                                {nb}
                              </span>
                            ))}
                            {notebooks.length > 3 && (
                              <span className="sf-nb-tag-more">+{notebooks.length - 3} more</span>
                            )}
                          </div>
                        </div>

                        <div className="sf-card-footer">
                          <div className="sf-card-date">
                            <Calendar size={12} />
                            <span>
                              {f.created_at
                                ? new Date(f.created_at).toLocaleDateString()
                                : 'Created Today'}
                            </span>
                          </div>

                          <div className="sf-card-quick-launch">
                            <span>Double-click to open</span>
                            <ArrowRight size={12} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* List / Table View of Project Folders */}
              {!loading && filteredFolders.length > 0 && viewMode === 'list' && (
                <div className="sf-folder-table-container">
                  <table className="sf-folder-table">
                    <thead>
                      <tr>
                        <th>Workspace Name</th>
                        <th>Description</th>
                        <th>Notebooks</th>
                        <th>Created</th>
                        <th style={{ textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFolders.map((f) => {
                        const isSelected = selectedFolder === f.folder_name;
                        const notebooks = getFolderNotebooks(f.folder_name);

                        return (
                          <tr
                            key={f.folder_name}
                            className={`sf-table-row ${isSelected ? 'selected' : ''}`}
                            onClick={() => setSelectedFolder(f.folder_name)}
                            onDoubleClick={() => onSelectFolder(f.folder_name)}
                          >
                            <td>
                              <div className="sf-table-name-cell">
                                <Folder size={15} color="#2563eb" />
                                <span className="sf-table-folder-name">{f.folder_name}</span>
                                {isSelected && (
                                  <span className="sf-table-active-pill">Target</span>
                                )}
                              </div>
                            </td>
                            <td className="sf-table-desc-cell">
                              {f.description || 'Candidate workspace'}
                            </td>
                            <td>
                              <span className="sf-table-nb-count">
                                <FileCode size={12} />
                                {notebooks.length} .ipynb
                              </span>
                            </td>
                            <td className="sf-table-date-cell">
                              {f.created_at
                                ? new Date(f.created_at).toLocaleDateString()
                                : 'Today'}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                className="sf-table-action-delete"
                                onClick={(e) => handleDeleteFolder(f.folder_name, e)}
                                title="Delete workspace"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}



          {/* Tab 3: Recent Notebooks Aggregator */}
          {activeTab === 'recent' && (
            <div className="sf-canvas-scroll">
              <div className="sf-folder-table-container">
                <table className="sf-folder-table">
                  <thead>
                    <tr>
                      <th>Notebook Name</th>
                      <th>Workspace Folder</th>
                      <th>Format</th>
                      <th style={{ textAlign: 'right' }}>Launch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allRecentNotebooks.map((item, idx) => (
                      <tr
                        key={`${item.folderName}-${item.notebookName}-${idx}`}
                        className="sf-table-row"
                        onClick={() => {
                          setSelectedFolder(item.folderName);
                          onSelectFolder(item.folderName);
                        }}
                      >
                        <td>
                          <div className="sf-table-name-cell">
                            <FileCode size={15} color="#2563eb" />
                            <span className="sf-table-folder-name">{item.notebookName}</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b' }}>
                            <Folder size={13} color="#4f46e5" />
                            <span>{item.folderName}</span>
                          </div>
                        </td>
                        <td>
                          <span className="sf-nb-tag">Jupyter v4 (.ipynb)</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="sf-btn-primary"
                            style={{ padding: '4px 10px', fontSize: '11.5px' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFolder(item.folderName);
                              onSelectFolder(item.folderName);
                            }}
                          >
                            <span>Open</span>
                            <ArrowRight size={11} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* 3. Docked Bottom Status & Action Launch Bar (VS Code & JupyterLab Style) */}
      <footer className="sf-docked-footer">
        <div className="sf-docked-left">
          <span className="sf-docked-label">Target Workspace:</span>
          {selectedFolder ? (
            <div className="sf-docked-path-pill">
              <Folder size={13} color="#2563eb" />
              <span>/workspaces/{selectedFolder}/</span>
            </div>
          ) : (
            <span className="sf-docked-none">No folder selected</span>
          )}
        </div>

        <div className="sf-docked-center">
          <Terminal size={13} color="#64748b" />
          <span>Kernel: Python 3.12 64-bit · ZeroMQ IPC · Isolated Sandboxed Process</span>
        </div>

        <div className="sf-docked-right">
          <span className="sf-key-hint">Press ↵ Enter to launch</span>
          <button
            type="button"
            className="sf-btn-launch-master"
            onClick={() => {
              if (selectedFolder) onSelectFolder(selectedFolder);
            }}
            disabled={!selectedFolder}
          >
            <span>Launch Notebook Workspace</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </footer>

      {/* 4. Sleek New Folder Modal Dialog */}
      {showCreateModal && (
        <div className="sf-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="sf-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="sf-modal-header">
              <div className="sf-modal-title-group">
                <div className="sf-modal-icon-badge">
                  <FolderPlus size={18} />
                </div>
                <div>
                  <h3 className="sf-modal-title">Initialize New Workspace</h3>
                  <p className="sf-modal-subtitle">
                    Creates an isolated directory for candidate {session.studentId}.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="sf-modal-close-btn"
                onClick={() => setShowCreateModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateFolder}>
              <div className="sf-modal-body">
                <div className="sf-form-group">
                  <label className="sf-label">Workspace Folder Name *</label>
                  <input
                    type="text"
                    className="sf-input"
                    placeholder="e.g. Lab_07_Neural_Networks or Assignment_2"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    autoFocus
                    required
                  />
                  <span className="sf-input-hint">
                    Path preview: ~/workspaces/{newFolderName.trim() || '<name>'}/
                  </span>
                </div>

                <div className="sf-form-group">
                  <label className="sf-label">Category Tag</label>
                  <div className="sf-category-pills">
                    {['Lab Experiment', 'Lab Exam', 'Assignment', 'Model Project', 'Scratchpad'].map(
                      (tag) => (
                        <button
                          key={tag}
                          type="button"
                          className={`sf-cat-pill ${selectedCategoryTag === tag ? 'active' : ''}`}
                          onClick={() => setSelectedCategoryTag(tag)}
                        >
                          {tag}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div className="sf-form-group">
                  <label className="sf-label">Description (Optional)</label>
                  <input
                    type="text"
                    className="sf-input"
                    placeholder="e.g. Implementation of convolution layers and evaluation benchmarks"
                    value={newFolderDesc}
                    onChange={(e) => setNewFolderDesc(e.target.value)}
                  />
                </div>
              </div>

              <div className="sf-modal-footer">
                <button
                  type="button"
                  className="sf-btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="sf-btn-primary"
                  disabled={isSubmitting}
                >
                  <Sparkles size={14} />
                  <span>{isSubmitting ? 'Initializing...' : 'Create & Select Workspace'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Toast Notification Pill */}
      {toastMessage && (
        <div className="sf-toast">
          <AlertCircle size={15} color="#38bdf8" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default SelectFolder;
