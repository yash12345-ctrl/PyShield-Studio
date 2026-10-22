import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Wifi, AlertTriangle, ShieldAlert, RefreshCw, Radio } from 'lucide-react';
import './detech.css';

/**
 * Detects whether the current environment is the PyShield Studio Desktop application
 * running natively on Windows or Linux (via Electron).
 * Returns FALSE when running in a normal web browser / website (e.g. Vercel, Chrome, Edge).
 */
export const isDesktopApp = (): boolean => {
  if (typeof window === 'undefined') return false;

  const hasElectronAPI = Boolean((window as any).electronAPI?.isDesktop);
  const isElectronUA = typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');
  const isElectronProcess = Boolean((window as any).process?.versions?.electron);
  const isFileProtocol = window.location.protocol === 'file:';

  return hasElectronAPI || isElectronUA || isElectronProcess || isFileProtocol;
};

/**
 * Probes external network reachability to verify actual internet connectivity.
 * Uses a 1200ms timeout with cache-busting to prevent false cached positives.
 */
async function probeExternalNetwork(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false;
  }

  // Fast probe against Google / Cloudflare zero-content endpoints
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1200);

  try {
    await fetch(`https://www.google.com/generate_204?_t=${Date.now()}`, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return true;
  } catch {
    clearTimeout(timeoutId);
    // If the network interface is up (Wi-Fi or LAN connected), navigator.onLine is true.
    // In a proctored exam, an active network adapter is considered an online risk.
    return typeof navigator !== 'undefined' ? navigator.onLine : false;
  }
}

export const InternetDetector: React.FC = () => {
  const isDesktop = isDesktopApp();

  const [isOnline, setIsOnline] = useState<boolean>(() => {
    // Only detect on desktop app; websites operate online by design
    if (!isDesktop) return false;
    return typeof navigator !== 'undefined' ? navigator.onLine : false;
  });
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [lastCheckTime, setLastCheckTime] = useState<string>('');
  const overlayRef = useRef<HTMLDivElement>(null);

  // Background verification probe
  const verifyConnection = useCallback(async () => {
    if (!isDesktop) return;

    setIsChecking(true);
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setIsOnline(false);
      } else {
        const hasInternet = await probeExternalNetwork();
        setIsOnline(hasInternet);
      }
    } catch {
      setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : false);
    } finally {
      setIsChecking(false);
      const now = new Date();
      setLastCheckTime(
        `${now.getHours().toString().padStart(2, '0')}:${now
          .getMinutes()
          .toString()
          .padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
      );
    }
  }, [isDesktop]);

  // 1. Instantaneous OS / Browser Network Events (Desktop Only)
  useEffect(() => {
    // Completely disable background monitoring when running on the website
    if (!isDesktop) return;

    const handleOnlineEvent = () => {
      setIsOnline(true);
      verifyConnection();
    };

    const handleOfflineEvent = () => {
      // Instantly dismiss banner when internet/Wi-Fi is turned off
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnlineEvent);
    window.addEventListener('offline', handleOfflineEvent);

    // Initial check on mount
    verifyConnection();

    // 2. High-frequency Background Heartbeat (every 1.5 seconds)
    const interval = setInterval(() => {
      // If browser reports offline, immediately set false without network overhead
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setIsOnline(false);
        const now = new Date();
        setLastCheckTime(
          `${now.getHours().toString().padStart(2, '0')}:${now
            .getMinutes()
            .toString()
            .padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
        );
      } else {
        verifyConnection();
      }
    }, 1500);

    return () => {
      window.removeEventListener('online', handleOnlineEvent);
      window.removeEventListener('offline', handleOfflineEvent);
      clearInterval(interval);
    };
  }, [isDesktop, verifyConnection]);

  // 3. Trap keyboard and focus when overlay is active (prevent Esc/Tab bypass)
  useEffect(() => {
    if (!isDesktop || !isOnline) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Block Escape, Tab navigation, or function keys
      if (e.key === 'Escape' || e.key === 'Tab' || e.key === 'F5' || e.key === 'F12') {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('contextmenu', handleContextMenu, { capture: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('contextmenu', handleContextMenu, { capture: true });
    };
  }, [isDesktop, isOnline]);

  // If running on website or if device is completely offline, do not render anything
  if (!isDesktop || !isOnline) {
    return null;
  }

  // Fullscreen Proctored Security Enforcement Screen
  return (
    <div
      ref={overlayRef}
      className="detech-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="detech-title"
      aria-describedby="detech-desc"
    >
      <div className="detech-scanline" />

      <div className="detech-card">
        {/* Top Security Pill */}
        <div className="detech-badge-pill">
          <span className="detech-pulse-dot" />
          <span>Proctoring Security • Strict Air-Gap Isolation</span>
        </div>

        {/* Hero Icon with Radar Rings */}
        <div className="detech-icon-wrapper">
          <div className="detech-icon-radar-1" />
          <div className="detech-icon-radar-2" />
          <div className="detech-icon-box">
            <Wifi size={44} strokeWidth={2.4} />
          </div>
          <div className="detech-warning-mini-badge">
            <AlertTriangle size={16} strokeWidth={2.8} />
          </div>
        </div>

        {/* Main Title & Description */}
        <h1 id="detech-title" className="detech-title">
          INTERNET CONNECTION DETECTED
        </h1>
        <p id="detech-desc" className="detech-subtitle">
          PyShield Studio requires a <span className="detech-subtitle-highlight">strictly offline environment</span>. 
          All active network interfaces, Wi-Fi connections, and Ethernet cables must be disconnected to continue.
        </p>

        {/* Highlighted Warning Action Callout */}
        <div className="detech-action-banner">
          <div className="detech-action-icon">
            <ShieldAlert size={22} />
          </div>
          <div>
            <div className="detech-action-text-bold">Turn off the internet to continue</div>
            <div className="detech-action-text-muted">
              This screen will automatically unlock the exact instant your device goes offline.
            </div>
          </div>
        </div>

        {/* Step-by-Step Candidate Instructions */}
        <div className="detech-instructions">
          <div className="detech-instructions-heading">Required Steps to Unlock Workspace</div>
          <div className="detech-step-list">
            <div className="detech-step-item">
              <span className="detech-step-num">1</span>
              <span><strong>Disconnect Wi-Fi:</strong> Open your system taskbar and turn Wi-Fi OFF or enable <strong>Airplane Mode</strong>.</span>
            </div>
            <div className="detech-step-item">
              <span className="detech-step-num">2</span>
              <span><strong>Unplug Ethernet:</strong> If using a wired connection, unplug the network cable from your machine.</span>
            </div>
            <div className="detech-step-item">
              <span className="detech-step-num">3</span>
              <span><strong>Instant Automatic Resume:</strong> PyShield will detect the offline state and restore your session instantly.</span>
            </div>
          </div>
        </div>

        {/* Real-time Telemetry & Manual Re-Check */}
        <div className="detech-footer-telemetry">
          <div className="detech-telemetry-left">
            {isChecking ? (
              <div className="detech-spinner-mini" />
            ) : (
              <Radio size={14} className="text-red-400" />
            )}
            <span>
              {isChecking ? 'Verifying network state...' : `Monitoring in background (last check: ${lastCheckTime || 'just now'})`}
            </span>
          </div>

          <button
            type="button"
            className="detech-recheck-btn"
            onClick={verifyConnection}
            disabled={isChecking}
          >
            <RefreshCw size={13} className={isChecking ? 'animate-spin' : ''} />
            <span>Check Now</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Also export as default and alias Detech
export const Detech = InternetDetector;
export default InternetDetector;
