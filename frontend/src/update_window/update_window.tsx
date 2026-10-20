import React, { useState } from 'react';
import './update_window.css';
import {
  Sparkles,
  RefreshCw,
  CheckCircle2,
  ArrowDownCircle,
  ShieldCheck,
  DownloadCloud,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Cpu,
  Terminal,
  Layers,
  Copy,
  Check,
  ExternalLink
} from 'lucide-react';

export interface VersionManifest {
  current_version: string;
  latest_version: string;
  release_date?: string;
  channel?: string;
  mandatory?: boolean;
  changelog?: string[];
  download_url?: string;
  package_size?: string;
  checksum?: string;
  downloads?: {
    windows?: {
      name?: string;
      url?: string;
      size?: string;
      filename?: string;
    };
    linux?: {
      appimage?: {
        name?: string;
        url?: string;
        size?: string;
        filename?: string;
      };
      deb?: {
        name?: string;
        url?: string;
        size?: string;
        filename?: string;
      };
    };
  };
}

export interface UpdateWindowProps {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  isChecking: boolean;
  isUpdating: boolean;
  updateProgress: number;
  updateStep: string;
  isUpdateReady: boolean;
  autoUpdateEnabled: boolean;
  changelog: string[];
  releaseDate?: string;
  packageSize?: string;
  lastCheckedTime: string | null;
  downloads?: any;
  onToggleAutoUpdate: (enabled: boolean) => void;
  onCheckForUpdates: () => Promise<void>;
  onStartUpdate: (platform?: 'linux' | 'windows') => Promise<void>;
  onApplyRestart: () => void;
  onSimulateVersionBump?: (newVer: string) => Promise<void>;
}

export const UpdateWindow: React.FC<UpdateWindowProps> = ({
  currentVersion,
  latestVersion,
  hasUpdate,
  isChecking,
  isUpdating,
  updateProgress,
  updateStep,
  isUpdateReady,
  autoUpdateEnabled,
  changelog,
  releaseDate = 'October 2026',
  packageSize = '95 MB - 156 MB',
  lastCheckedTime,
  downloads,
  onToggleAutoUpdate,
  onCheckForUpdates,
  onStartUpdate,
  onApplyRestart,
  onSimulateVersionBump
}) => {
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Auto-detect host operating system
  const detectedOs: 'linux' | 'windows' = (() => {
    if (typeof window !== 'undefined') {
      const electronPlat = (window as any).electronAPI?.platform;
      if (electronPlat === 'win32') return 'windows';
      if (electronPlat === 'linux') return 'linux';
      const ua = navigator.userAgent.toLowerCase();
      if (ua.includes('win')) return 'windows';
      if (ua.includes('linux')) return 'linux';
    }
    return 'linux';
  })();

  const [selectedOs, setSelectedOs] = useState<'linux' | 'windows'>(detectedOs);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getStatusBadge = () => {
    if (isUpdating) {
      return (
        <span className="update-badge downloading">
          <RefreshCw size={11} className="spin-icon" />
          Updating ({updateProgress}%)
        </span>
      );
    }
    if (isUpdateReady) {
      return (
        <span className="update-badge ready">
          <CheckCircle2 size={11} />
          Ready to Install
        </span>
      );
    }
    if (hasUpdate) {
      return (
        <span className="update-badge available">
          <Sparkles size={11} />
          v{latestVersion} Available
        </span>
      );
    }
    return (
      <span className="update-badge up-to-date">
        <CheckCircle2 size={11} />
        Up to Date
      </span>
    );
  };

  const handleSimulate = async (ver: string) => {
    if (!onSimulateVersionBump) return;
    setIsSimulating(true);
    try {
      await onSimulateVersionBump(ver);
    } finally {
      setIsSimulating(false);
    }
  };

  // Release URLs
  const githubReleaseBase = `https://github.com/yash12345-ctrl/PyShield-Studio/releases/tag/v${latestVersion}`;
  const winZipUrl = downloads?.windows?.url || `https://github.com/yash12345-ctrl/PyShield-Studio/releases/download/v${latestVersion}/PyShield-Studio-v${latestVersion}-Windows.zip`;
  const linuxAppImageUrl = downloads?.linux?.appimage?.url || `https://github.com/yash12345-ctrl/PyShield-Studio/releases/download/v${latestVersion}/PyShield-Studio-${latestVersion}.AppImage`;
  const linuxDebUrl = downloads?.linux?.deb?.url || `https://github.com/yash12345-ctrl/PyShield-Studio/releases/download/v${latestVersion}/pyshield-studio_${latestVersion}_amd64.deb`;

  return (
    <div className="update-drawer-container">
      {/* Drawer Header */}
      <div className="update-drawer-header">
        <div className="update-header-title-group">
          <div className="update-header-icon-box">
            <ArrowDownCircle size={17} />
          </div>
          <div className="update-header-text">
            <h3>Update Manager</h3>
            <span>Multi-Platform Release & Auto-Patcher</span>
          </div>
        </div>
        {getStatusBadge()}
      </div>

      {/* Drawer Body */}
      <div className="update-drawer-body">
        {/* OS Platform Switcher Tabs */}
        <div className="os-selector-container">
          <div className="os-selector-tabs">
            <button
              type="button"
              className={`os-tab-btn ${selectedOs === 'linux' ? 'active' : ''}`}
              onClick={() => setSelectedOs('linux')}
            >
              <Terminal size={13} />
              <span>Linux</span>
              {detectedOs === 'linux' && <span className="os-detected-tag">Current</span>}
            </button>
            <button
              type="button"
              className={`os-tab-btn ${selectedOs === 'windows' ? 'active' : ''}`}
              onClick={() => setSelectedOs('windows')}
            >
              <Layers size={13} />
              <span>Windows</span>
              {detectedOs === 'windows' && <span className="os-detected-tag">Current</span>}
            </button>
          </div>
        </div>

        {/* Update Banner Card */}
        {hasUpdate && !isUpdateReady && (
          <div className="update-card update-card-banner">
            <div className="update-banner-header">
              <Sparkles size={16} color="#2563eb" />
              <h4>New Version v{latestVersion} Available</h4>
            </div>
            <p className="update-banner-desc">
              {autoUpdateEnabled
                ? `Automatic update is active. The latest ${selectedOs === 'linux' ? 'Linux' : 'Windows'} packages are being prepared.`
                : `A new release is available for ${selectedOs === 'linux' ? 'Linux (.deb / AppImage)' : 'Windows (x64)'} with bug fixes and cloud features.`}
            </p>

            {isUpdating && (
              <div className="update-progress-section">
                <div className="update-progress-label">
                  <span>{updateStep || `Downloading ${selectedOs === 'linux' ? 'Linux' : 'Windows'} bundle...`}</span>
                  <span>{updateProgress}%</span>
                </div>
                <div className="update-progress-track">
                  <div
                    className="update-progress-bar"
                    style={{ width: `${updateProgress}%` }}
                  />
                </div>

                <div className="update-steps-pipeline">
                  <div className={`update-step-item ${updateProgress > 10 ? 'done' : 'active'}`}>
                    <span className="update-step-dot" />
                    <span>Fetch {selectedOs === 'linux' ? 'Linux' : 'Windows'} manifest</span>
                  </div>
                  <div className={`update-step-item ${updateProgress >= 65 ? 'done' : updateProgress > 10 ? 'active' : ''}`}>
                    <span className="update-step-dot" />
                    <span>Download package bundle ({selectedOs === 'linux' ? '95 MB' : '156 MB'})</span>
                  </div>
                  <div className={`update-step-item ${updateProgress >= 90 ? 'done' : updateProgress >= 65 ? 'active' : ''}`}>
                    <span className="update-step-dot" />
                    <span>Cryptographic SHA-256 verification</span>
                  </div>
                  <div className={`update-step-item ${updateProgress >= 100 ? 'done' : updateProgress >= 90 ? 'active' : ''}`}>
                    <span className="update-step-dot" />
                    <span>Staging binary patches & applying update</span>
                  </div>
                </div>
              </div>
            )}

            {!isUpdating && (
              <button
                type="button"
                className="update-btn-primary"
                onClick={() => onStartUpdate(selectedOs)}
              >
                <DownloadCloud size={14} />
                Download & Update ({selectedOs === 'linux' ? 'Linux' : 'Windows'})
              </button>
            )}
          </div>
        )}

        {/* Update Ready to Apply Banner */}
        {isUpdateReady && (
          <div className="update-card update-card-banner update-ready">
            <div className="update-banner-header">
              <CheckCircle2 size={16} color="#059669" />
              <h4>Update v{latestVersion} Ready to Apply</h4>
            </div>
            <p className="update-banner-desc">
              The {selectedOs === 'linux' ? 'Linux' : 'Windows'} update bundle has been downloaded and verified. Restart the application to finalize the upgrade.
            </p>
            <button
              type="button"
              className="update-btn-primary success-restart"
              onClick={onApplyRestart}
            >
              <RotateCcw size={14} />
              Restart & Apply v{latestVersion}
            </button>
          </div>
        )}

        {/* Platform-Specific Packages Card */}
        <div className="update-card">
          <div className="changelog-title" style={{ marginBottom: '10px' }}>
            {selectedOs === 'linux' ? <Terminal size={14} color="#2563eb" /> : <Layers size={14} color="#2563eb" />}
            <span>{selectedOs === 'linux' ? 'Linux Packages (v' + latestVersion + ')' : 'Windows Packages (v' + latestVersion + ')'}</span>
          </div>

          <div className="platform-packages-list">
            {selectedOs === 'linux' ? (
              <>
                {/* Linux Debian Package */}
                <div className="platform-pkg-card">
                  <div className="pkg-header">
                    <div className="pkg-title-group">
                      <span>Debian / Ubuntu (.deb)</span>
                    </div>
                    <span className="pkg-size-badge">95 MB</span>
                  </div>
                  <div className="pkg-command-box">
                    <span className="pkg-command-text">sudo dpkg -i pyshield-studio_{latestVersion}_amd64.deb</span>
                    <button
                      type="button"
                      className="pkg-copy-btn"
                      title="Copy install command"
                      onClick={() => copyToClipboard(`sudo dpkg -i frontend/dist-electron/linux/pyshield-studio_${latestVersion}_amd64.deb`, 'deb')}
                    >
                      {copiedKey === 'deb' ? <Check size={12} color="#4ade80" /> : <Copy size={12} />}
                    </button>
                  </div>
                  <div className="pkg-actions-row">
                    <a
                      href={linuxDebUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="pkg-dl-btn"
                    >
                      <DownloadCloud size={12} />
                      Download .deb
                    </a>
                  </div>
                </div>

                {/* Linux AppImage */}
                <div className="platform-pkg-card">
                  <div className="pkg-header">
                    <div className="pkg-title-group">
                      <span>Standalone AppImage (Universal)</span>
                    </div>
                    <span className="pkg-size-badge">125 MB</span>
                  </div>
                  <div className="pkg-command-box">
                    <span className="pkg-command-text">chmod +x "PyShield Studio-{latestVersion}.AppImage"</span>
                    <button
                      type="button"
                      className="pkg-copy-btn"
                      title="Copy run command"
                      onClick={() => copyToClipboard(`chmod +x "frontend/dist-electron/linux/PyShield Studio-${latestVersion}.AppImage" && ./"frontend/dist-electron/linux/PyShield Studio-${latestVersion}.AppImage"`, 'appimage')}
                    >
                      {copiedKey === 'appimage' ? <Check size={12} color="#4ade80" /> : <Copy size={12} />}
                    </button>
                  </div>
                  <div className="pkg-actions-row">
                    <a
                      href={linuxAppImageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="pkg-dl-btn"
                    >
                      <DownloadCloud size={12} />
                      Download AppImage
                    </a>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Windows Portable Zip */}
                <div className="platform-pkg-card">
                  <div className="pkg-header">
                    <div className="pkg-title-group">
                      <span>Windows Portable ZIP (x64)</span>
                    </div>
                    <span className="pkg-size-badge">156 MB</span>
                  </div>
                  <div className="pkg-command-box">
                    <span className="pkg-command-text">Extract zip & launch "PyShield Studio.exe"</span>
                    <button
                      type="button"
                      className="pkg-copy-btn"
                      title="Copy filename"
                      onClick={() => copyToClipboard(`PyShield-Studio-v${latestVersion}-Windows.zip`, 'win')}
                    >
                      {copiedKey === 'win' ? <Check size={12} color="#4ade80" /> : <Copy size={12} />}
                    </button>
                  </div>
                  <div className="pkg-actions-row">
                    <a
                      href={winZipUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="pkg-dl-btn"
                    >
                      <DownloadCloud size={12} />
                      Download Windows ZIP
                    </a>
                    <a
                      href={githubReleaseBase}
                      target="_blank"
                      rel="noreferrer"
                      className="pkg-dl-btn"
                    >
                      <ExternalLink size={12} />
                      Release Assets
                    </a>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Version Information Card */}
        <div className="update-card">
          <div className="update-info-grid">
            <div className="update-info-cell">
              <span className="cell-label">Current Version</span>
              <span className="cell-value">v{currentVersion}</span>
            </div>
            <div className="update-info-cell">
              <span className="cell-label">Latest Release</span>
              <span className="cell-value">v{latestVersion}</span>
            </div>
            <div className="update-info-cell">
              <span className="cell-label">Release Date</span>
              <span className="cell-value" style={{ fontSize: '11px' }}>{releaseDate}</span>
            </div>
            <div className="update-info-cell">
              <span className="cell-label">Package Size</span>
              <span className="cell-value" style={{ fontSize: '11px' }}>{packageSize}</span>
            </div>
            <div className="update-info-cell">
              <span className="cell-label">Active Channel</span>
              <span className="cell-value" style={{ fontSize: '11px', color: '#16a34a' }}>Stable ({selectedOs})</span>
            </div>
          </div>
        </div>

        {/* Auto-Update Settings Toggle */}
        <div className="update-card auto-update-toggle-card">
          <div className="auto-update-text-group">
            <h5>Always Auto-Update</h5>
            <p>Automatically download and apply updates for {selectedOs === 'linux' ? 'Linux' : 'Windows'} in the background</p>
          </div>
          <label className="switch-label" title="Toggle automatic updates">
            <input
              type="checkbox"
              checked={autoUpdateEnabled}
              onChange={(e) => onToggleAutoUpdate(e.target.checked)}
            />
            <span className="switch-slider" />
          </label>
        </div>

        {/* What's New / Changelog Card */}
        {changelog && changelog.length > 0 && (
          <div className="update-card">
            <div className="changelog-title">
              <ShieldCheck size={14} color="#2563eb" />
              <span>What's New in v{latestVersion}</span>
            </div>
            <ul className="changelog-list">
              {changelog.map((note, idx) => (
                <li key={idx} className="changelog-item">
                  <span className="changelog-bullet" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Manual Check Button */}
        <button
          type="button"
          className="update-btn-secondary"
          onClick={onCheckForUpdates}
          disabled={isChecking || isUpdating}
        >
          <RefreshCw size={13} className={isChecking ? 'spin-icon' : ''} />
          {isChecking ? 'Checking for Updates...' : 'Check for Updates Now'}
        </button>

        {lastCheckedTime && (
          <div style={{ textAlign: 'center', fontSize: '10.5px', color: '#94a3b8' }}>
            Last checked: {lastCheckedTime}
          </div>
        )}

        {/* Developer / Simulation Tool (Collapsible) */}
        <div className="dev-simulation-box">
          <div
            className="dev-simulation-title"
            onClick={() => setShowDevPanel(!showDevPanel)}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Cpu size={12} />
              Developer Release Simulator
            </span>
            {showDevPanel ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </div>

          {showDevPanel && (
            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <p style={{ margin: 0, fontSize: '10.5px', color: '#64748b' }}>
                Test how the multi-platform updater behaves when a new release is published:
              </p>
              <div className="dev-buttons-row">
                <button
                  type="button"
                  className="dev-sim-btn"
                  disabled={isSimulating}
                  onClick={() => handleSimulate('1.0.1')}
                >
                  Publish v1.0.1
                </button>
                <button
                  type="button"
                  className="dev-sim-btn"
                  disabled={isSimulating}
                  onClick={() => handleSimulate('1.1.0')}
                >
                  Publish v1.1.0
                </button>
                <button
                  type="button"
                  className="dev-sim-btn"
                  disabled={isSimulating}
                  onClick={() => handleSimulate('1.0.0')}
                >
                  Reset v1.0.0
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpdateWindow;
