import React, { useState, useEffect } from 'react';
import './LoginScreen.css';
import { API_BASE_URL } from '../config';
import appLogo from '../assets/app_logo.png';
import {
  ShieldCheck,
  Wifi,
  WifiOff,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  FileCode2,
  Terminal,
  Activity,
  X,
  ClipboardX,
  Flame,
  GraduationCap,
  Lock,
  UserPlus
} from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (sessionData: {
    studentId: string;
    examCode: string;
    seatNumber: string;
    mode: 'candidate' | 'create_experiment';
    experimentTitle?: string;
    sessionToken?: string;
  }) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<'candidate' | 'create_experiment'>('candidate');
  const [studentId, setStudentId] = useState('');
  const [examCode, setExamCode] = useState('');
  const seatNumber = 'LAB-03 / SEAT-18';
  const [regNumber, setRegNumber] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [createdAccountSuccess, setCreatedAccountSuccess] = useState<string | null>(null);

  // Security features state
  const [isInternetConnected, setIsInternetConnected] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  // Intercept Copy and Paste attempts in proctored mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        showToast('🔒 Proctored Environment: Clipboard actions (Copy/Cut/Paste) are blocked.');
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      showToast('🔒 Right-click context menu is restricted.');
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isInternetConnected) {
      showToast('❌ Cannot perform action while an active internet connection is detected.');
      return;
    }

    if (!agreed) {
      showToast('⚠️ Please accept the offline exam integrity agreement.');
      return;
    }

    // 1. Create Account Mode
    if (mode === 'create_experiment') {
      const trimmedReg = regNumber.trim().toUpperCase();
      if (!trimmedReg) {
        showToast('⚠️ Please enter your registration number.');
        return;
      }
      if (!createPassword) {
        showToast('⚠️ Please create a secure password.');
        return;
      }
      if (createPassword.length < 4) {
        showToast('⚠️ Password must be at least 4 characters long.');
        return;
      }
      if (createPassword !== confirmPassword) {
        showToast('❌ Passwords do not match. Please verify your password.');
        return;
      }

      setIsLoading(true);

      try {
        const response = await fetch(`${API_BASE_URL}/api/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            registration_number: trimmedReg,
            password: createPassword,
          }),
        });

        const data = await response.json();
        setIsLoading(false);

        if (response.ok && data.status === 'success') {
          showToast(`✅ Account for ${trimmedReg} created successfully! You can now log in.`);
          setCreatedAccountSuccess(trimmedReg);
          setStudentId(trimmedReg);
          setExamCode(createPassword);
          setCreatePassword('');
          setConfirmPassword('');

          // Automatically switch tab to Candidate Session so candidate can see their ID pre-filled
          setTimeout(() => {
            setMode('candidate');
          }, 1600);
        } else {
          showToast(`❌ ${data.message || 'Failed to create account.'}`);
        }
      } catch {
        setIsLoading(false);
        showToast('⚠️ Backend server unreachable. Ensure bridge server is running.');
      }
      return;
    }

    // 2. Candidate Session Authentication Mode
    if (mode === 'candidate') {
      const trimmedId = studentId.trim().toUpperCase();
      if (!trimmedId) {
        showToast('⚠️ Please enter your Candidate ID / Registration Number.');
        return;
      }

      setIsLoading(true);

      let token = 'offline-' + Date.now();
      if (examCode.trim()) {
        try {
          const resp = await fetch(`${API_BASE_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              registration_number: trimmedId,
              password: examCode.trim(),
            }),
          });
          const authData = await resp.json();
          if (!resp.ok && resp.status === 401) {
            setIsLoading(false);
            showToast(`❌ ${authData.message || 'Invalid credentials for this candidate.'}`);
            return;
          }
          if (authData.session_token) {
            token = authData.session_token;
          }
        } catch {
          // If bridge server is offline, continue with local offline mode
        }
      }

      setTimeout(() => {
        setIsLoading(false);
        onLoginSuccess({
          studentId: trimmedId,
          examCode: examCode.trim() || 'LAB-OFFLINE',
          seatNumber: seatNumber.trim(),
          mode: 'candidate',
          experimentTitle: `Candidate Session: ${trimmedId}`,
          sessionToken: token,
        });
      }, 900);
    }
  };

  return (
    <div className="desktop-container bg-grid-pattern">
      {/* 1. Desktop Window Frame Header */}
      <header className="window-titlebar">
        <div className="titlebar-left">
          <div className="window-dots">
            <span className="window-dot close" title="Proctored: Close disabled" />
            <span className="window-dot minimize" title="Proctored: Minimize disabled" />
            <span className="window-dot maximize" title="Windowed Mode" />
          </div>
          <div className="app-title-badge">
            <ShieldCheck size={18} color="var(--primary)" />
            <span>PyShield Studio</span>
            <span style={{ color: 'var(--border-strong)', margin: '0 4px' }}>|</span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
              Offline Proctored Python Notebook
            </span>
          </div>
        </div>

        <div className="titlebar-center">
          <div className={`proctor-status-pill ${isInternetConnected ? 'warning' : ''}`}>
            <span className={`status-dot ${isInternetConnected ? '' : 'animate-pulse-subtle'}`} />
            {isInternetConnected ? 'SECURITY ALERT: INTERNET DETECTED' : 'OFFLINE LOCKDOWN ACTIVE'}
          </div>
          <div className="proctor-status-pill" style={{ background: '#f8fafc', borderColor: '#e2e8f0', color: '#475569' }}>
            <ClipboardX size={13} color="#64748b" />
            <span>Clipboard Blocked</span>
          </div>
        </div>

        <div className="titlebar-right">
          {/* Interactive Network Simulator Switch */}
          <button
            type="button"
            className={`network-toggle-btn ${isInternetConnected ? 'active-online' : ''}`}
            onClick={() => setIsInternetConnected(!isInternetConnected)}
            title="Toggle to simulate network state changes"
          >
            {isInternetConnected ? (
              <>
                <Wifi size={14} color="var(--danger)" />
                <span>Internet: ON (Violation)</span>
              </>
            ) : (
              <>
                <WifiOff size={14} color="var(--success)" />
                <span>Internet: OFF (Secured)</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* 2. Full-Screen Split Workstation */}
      <main className="login-main-fullscreen">
        {/* LEFT PANEL: Branding & Security Pre-Flight Status */}
        <section className="left-branding-panel">
          <div>
            <div className="panel-header-badge">
              <GraduationCap size={14} />
              <span>ACADEMIC EXAMINATION & MODEL TRAINING ENVIRONMENT</span>
            </div>

            <div className="branding-hero">
              <img
                src={appLogo}
                alt="PyShield 3D Logo"
                className="brand-logo-img-large"
              />
              <div className="hero-text-block">
                <h1>PyShield Studio</h1>
                <p>Autonomous Offline Python & Machine Learning Lab</p>
              </div>
            </div>

            {/* Live Security & Integrity Matrix */}
            <div className="security-status-grid">
              <div className="status-card">
                <div className="status-card-icon success">
                  <ShieldCheck size={18} />
                </div>
                <div className="status-card-content">
                  <h4>Anti-Cheat Active</h4>
                  <p>Copy-paste & external clipboard access strictly restricted.</p>
                </div>
              </div>

              <div className="status-card">
                <div className="status-card-icon success">
                  <WifiOff size={18} />
                </div>
                <div className="status-card-content">
                  <h4>Network Killswitch</h4>
                  <p>Automatic terminal lock upon active Wi-Fi or Ethernet.</p>
                </div>
              </div>

              <div className="status-card">
                <div className="status-card-icon">
                  <Terminal size={18} />
                </div>
                <div className="status-card-content">
                  <h4>Native REPL Engine</h4>
                  <p>Local Python 3.10 kernel running over secure stdio pipes.</p>
                </div>
              </div>

              <div className="status-card">
                <div className="status-card-icon">
                  <Cpu size={18} />
                </div>
                <div className="status-card-content">
                  <h4>Pre-bundled ML Stack</h4>
                  <p>NumPy, Pandas, Scikit-Learn, PyTorch CPU & Matplotlib.</p>
                </div>
              </div>
            </div>

            {/* Exam Guidelines Box */}
            <div className="exam-rules-box">
              <div className="rules-box-title">
                <Flame size={15} color="var(--primary)" />
                <span>Examination Protocol & Integrity Rules</span>
              </div>
              <ul className="rules-list">
                <li>Internet access is strictly barred. Do not connect to mobile hotspots.</li>
                <li>All cell code execution is recorded and evaluated on the local machine.</li>
                <li>Plots and figures generated via <code>matplotlib</code> render directly in cells.</li>
              </ul>
            </div>
          </div>


        </section>

        {/* RIGHT PANEL: Authentication Form */}
        <section className="right-auth-panel">
          <div className="auth-card-inner">
            <div className="auth-panel-heading">
              <h2>{mode === 'candidate' ? 'Session Authentication' : 'Create Candidate Account'}</h2>
              <p>
                {mode === 'candidate'
                  ? 'Enter your registration number and password to start your session'
                  : 'Register your registration number and create a secure password to activate your account'}
              </p>
            </div>

            {/* Mode Switcher */}
            <div className="login-tabs">
              <button
                type="button"
                className={`tab-btn ${mode === 'candidate' ? 'active' : ''}`}
                onClick={() => setMode('candidate')}
              >
                <User size={15} />
                <span>Candidate Session</span>
              </button>
              <button
                type="button"
                className={`tab-btn ${mode === 'create_experiment' ? 'active' : ''}`}
                onClick={() => setMode('create_experiment')}
              >
                <UserPlus size={15} />
                <span>Create Account</span>
              </button>
            </div>

            {createdAccountSuccess && (
              <div className="account-created-banner">
                <CheckCircle2 size={16} color="var(--success)" />
                <span>Account for <strong>{createdAccountSuccess}</strong> created successfully. You can now launch your session!</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} noValidate>
              {mode === 'candidate' ? (
                <>
                  <div className="form-group">
                    <div className="form-label-row">
                      <label htmlFor="studentId" className="form-label">
                        <User size={14} />
                        Enter Registration Number
                      </label>
                      <span className="form-label-tag">Required</span>
                    </div>
                    <div className="input-container">
                      <User size={16} className="input-icon" />
                      <input
                        id="studentId"
                        type="text"
                        className="form-input"
                        placeholder="e.g. REG-2026-CS-0841"
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        required
                        autoComplete="off"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <div className="form-label-row">
                      <label htmlFor="examCode" className="form-label">
                        <Lock size={14} />
                        Password
                      </label>
                      <span className="form-label-tag">Required</span>
                    </div>
                    <div className="input-container">
                      <Lock size={16} className="input-icon" />
                      <input
                        id="examCode"
                        type={showKey ? 'text' : 'password'}
                        className="form-input mono"
                        placeholder="Enter your password"
                        value={examCode}
                        onChange={(e) => setExamCode(e.target.value)}
                        required
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        className="input-right-btn"
                        onClick={() => setShowKey(!showKey)}
                        aria-label="Toggle password visibility"
                      >
                        {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <div className="form-label-row">
                      <label htmlFor="regNumber" className="form-label">
                        <User size={14} />
                        Enter Registration Number
                      </label>
                      <span className="form-label-tag">Required</span>
                    </div>
                    <div className="input-container">
                      <User size={16} className="input-icon" />
                      <input
                        id="regNumber"
                        type="text"
                        className="form-input"
                        placeholder="e.g. REG-2026-CS-0841"
                        value={regNumber}
                        onChange={(e) => setRegNumber(e.target.value)}
                        required
                        autoComplete="off"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <div className="form-label-row">
                      <label htmlFor="createPassword" className="form-label">
                        <Lock size={14} />
                        Create Password
                      </label>
                      <span className="form-label-tag">Required</span>
                    </div>
                    <div className="input-container">
                      <Lock size={16} className="input-icon" />
                      <input
                        id="createPassword"
                        type={showCreatePassword ? 'text' : 'password'}
                        className="form-input mono"
                        placeholder="Create a secure lab password"
                        value={createPassword}
                        onChange={(e) => setCreatePassword(e.target.value)}
                        required
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        className="input-right-btn"
                        onClick={() => setShowCreatePassword(!showCreatePassword)}
                        aria-label="Toggle password visibility"
                      >
                        {showCreatePassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <div className="form-label-row">
                      <label htmlFor="confirmPassword" className="form-label">
                        <Lock size={14} />
                        Confirm Password
                      </label>
                      <span className="form-label-tag">Required</span>
                    </div>
                    <div className="input-container">
                      <Lock size={16} className="input-icon" />
                      <input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        className="form-input mono"
                        placeholder="Re-enter your lab password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        className="input-right-btn"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        aria-label="Toggle confirm password visibility"
                      >
                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>

                    {createPassword && confirmPassword && (
                      <div className={`password-match-indicator ${createPassword === confirmPassword ? 'match' : 'mismatch'}`}>
                        {createPassword === confirmPassword ? (
                          <>
                            <CheckCircle2 size={13} />
                            <span>Passwords match</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle size={13} />
                            <span>Passwords do not match</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Checkbox */}
              <label className="notice-checkbox-row">
                <input
                  type="checkbox"
                  className="notice-checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                />
                <span className="checkbox-label">
                  {mode === 'candidate'
                    ? 'I agree to the offline assessment & code integrity rules.'
                    : 'Initialize with strict offline enforcement & local kernel sandbox.'}
                </span>
              </label>

              {/* Action Button: Launch or Create Account */}
              <button
                type="submit"
                className="submit-btn"
                disabled={
                  isLoading ||
                  !agreed ||
                  (mode === 'candidate'
                    ? !studentId.trim()
                    : (!regNumber.trim() || !createPassword.trim() || !confirmPassword.trim())) ||
                  isInternetConnected
                }
              >
                {isLoading ? (
                  <>
                    <Activity size={18} className="animate-spin" />
                    <span>{mode === 'candidate' ? 'Authenticating & Launching...' : 'Creating Account...'}</span>
                  </>
                ) : mode === 'candidate' ? (
                  <>
                    <span>Launch Proctored Notebook</span>
                    <ArrowRight size={17} />
                  </>
                ) : (
                  <>
                    <UserPlus size={17} />
                    <span>Create Account</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </section>
      </main>

      {/* 3. Bottom Status Bar */}
      <footer className="window-statusbar">
        <div className="statusbar-item">
          <Terminal size={13} color="var(--primary)" />
          <span>Standalone REPL Kernel Ready (stdio pipes)</span>
        </div>
        <div className="statusbar-item">
          <FileCode2 size={13} color="var(--primary)" />
          <span>ML Stack: NumPy, Pandas, Scikit-Learn, PyTorch (CPU)</span>
        </div>
        <div className="statusbar-item">
          <span>OS: Linux x86_64 • Electron Shell</span>
        </div>
      </footer>

      {/* 4. Security Toast Notification */}
      {toastMessage && (
        <div className="security-toast">
          <AlertTriangle size={16} color="#f59e0b" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 5. INTERNET DETECTED: Fullscreen Lockdown Modal */}
      {isInternetConnected && (
        <div className="lockdown-overlay">
          <div className="lockdown-card modal-enter">
            <div className="lockdown-icon-circle">
              <Wifi size={36} />
            </div>
            <h2 className="lockdown-title">SECURITY VIOLATION: INTERNET DETECTED</h2>
            <p className="lockdown-description">
              An active network adapter (Wi-Fi or Ethernet) was detected on this terminal.
              Under examination protocols, external networking is strictly prohibited.
            </p>

            <div className="lockdown-steps">
              <strong>Required Actions to Unlock:</strong>
              <ol>
                <li>Disconnect from any Wi-Fi networks.</li>
                <li>Unplug any Ethernet cables or USB tethering devices.</li>
                <li>Turn off Airplane Mode or disable all network adapters.</li>
              </ol>
            </div>

            <button
              type="button"
              className="lockdown-resume-btn"
              onClick={() => {
                setIsInternetConnected(false);
                showToast('✅ Network disconnected. Offline environment restored.');
              }}
            >
              <WifiOff size={16} />
              <span>Simulate Disconnect & Resume</span>
            </button>
          </div>
        </div>
      )}

      {/* 6. Diagnostics Modal */}
      {showDiagnostics && (
        <div className="diagnostics-modal-overlay">
          <div className="diagnostics-card modal-enter">
            <div className="diag-header">
              <div className="diag-title">
                <Terminal size={18} color="var(--primary)" />
                <span>Pre-Flight ML Environment Diagnostics</span>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setShowDiagnostics(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="diag-list">
              <div className="diag-row">
                <span className="diag-pkg-name">
                  <Cpu size={14} /> Python Runtime
                </span>
                <span className="diag-status-ok">
                  <CheckCircle2 size={14} /> v3.10.12 (Embedded)
                </span>
              </div>

              <div className="diag-row">
                <span className="diag-pkg-name">NumPy & SciPy</span>
                <span className="diag-status-ok">
                  <CheckCircle2 size={14} /> v1.26.4 (Ready)
                </span>
              </div>

              <div className="diag-row">
                <span className="diag-pkg-name">Pandas DataFrames</span>
                <span className="diag-status-ok">
                  <CheckCircle2 size={14} /> v2.2.1 (Ready)
                </span>
              </div>

              <div className="diag-row">
                <span className="diag-pkg-name">Scikit-Learn (ML Models)</span>
                <span className="diag-status-ok">
                  <CheckCircle2 size={14} /> v1.4.1 (Ready)
                </span>
              </div>

              <div className="diag-row">
                <span className="diag-pkg-name">Matplotlib & Seaborn</span>
                <span className="diag-status-ok">
                  <CheckCircle2 size={14} /> v3.8.3 (Plot Hook Active)
                </span>
              </div>

              <div className="diag-row">
                <span className="diag-pkg-name">PyTorch Engine (CPU)</span>
                <span className="diag-status-ok">
                  <CheckCircle2 size={14} /> v2.2.0+cpu (Ready)
                </span>
              </div>

              <div className="diag-row">
                <span className="diag-pkg-name">Clipboard & Drag Security</span>
                <span className="diag-status-ok">
                  <CheckCircle2 size={14} /> Strict Interceptor Hooked
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
