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
  Cpu
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
  onToggleAutoUpdate: (enabled: boolean) => void;
  onCheckForUpdates: () => Promise<void>;
  onStartUpdate: () => Promise<void>;
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
  releaseDate = 'April 2025',
  packageSize = '42.8 MB',
  lastCheckedTime,
  onToggleAutoUpdate,
  onCheckForUpdates,
  onStartUpdate,
  onApplyRestart,
  onSimulateVersionBump
}) => {
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

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
            <span>Release Channel & Auto-Patcher</span>
          </div>
        </div>
        {getStatusBadge()}
      </div>

      {/* Drawer Body */}
      <div className="update-drawer-body">
        {/* Update Banner Card */}
        {hasUpdate && !isUpdateReady && (
          <div className="update-card update-card-banner">
            <div className="update-banner-header">
              <Sparkles size={16} color="#2563eb" />
              <h4>New Version v{latestVersion} Available</h4>
            </div>
            <p className="update-banner-desc">
              {autoUpdateEnabled
                ? 'Automatic update is enabled. The latest security patches and features are being installed in the background.'
                : 'A new release is available for download with performance enhancements and bug fixes.'}
            </p>

            {isUpdating && (
              <div className="update-progress-section">
                <div className="update-progress-label">
                  <span>{updateStep || 'Downloading update package...'}</span>
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
                    <span>Fetch release manifest</span>
                  </div>
                  <div className={`update-step-item ${updateProgress >= 65 ? 'done' : updateProgress > 10 ? 'active' : ''}`}>
                    <span className="update-step-dot" />
                    <span>Download package bundle ({packageSize})</span>
                  </div>
                  <div className={`update-step-item ${updateProgress >= 90 ? 'done' : updateProgress >= 65 ? 'active' : ''}`}>
                    <span className="update-step-dot" />
                    <span>Cryptographic SHA-256 verification</span>
                  </div>
                  <div className={`update-step-item ${updateProgress >= 100 ? 'done' : updateProgress >= 90 ? 'active' : ''}`}>
                    <span className="update-step-dot" />
                    <span>Staging files & applying update</span>
                  </div>
                </div>
              </div>
            )}

            {!isUpdating && (
              <button
                type="button"
                className="update-btn-primary"
                onClick={onStartUpdate}
              >
                <DownloadCloud size={14} />
                Download & Update Now
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
              The update package has been downloaded, verified, and staged. Restart the application to finalize the upgrade.
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
              <span className="cell-label">Release Channel</span>
              <span className="cell-value" style={{ fontSize: '11px', color: '#16a34a' }}>Stable</span>
            </div>
          </div>
        </div>

        {/* Auto-Update Settings Toggle */}
        <div className="update-card auto-update-toggle-card">
          <div className="auto-update-text-group">
            <h5>Always Auto-Update</h5>
            <p>Automatically download and apply new releases silently in the background</p>
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
                Test how the auto-update behaves when a new release is published in the future:
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
