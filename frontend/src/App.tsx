import { useState } from 'react';
import './App.css';
import { LoginScreen } from './components/LoginScreen';
import { NotebookWorkspace } from './components/NotebookWorkspace';
import { SelectFolder } from './select_folder/select_folder';

const SESSION_STORAGE_KEY = 'pyshield_active_session';

interface ActiveSession {
  studentId: string;
  examCode: string;
  seatNumber: string;
  mode: 'candidate' | 'create_experiment';
  experimentTitle?: string;
  startTime?: number;
  selectedFolder?: string;
  sessionToken?: string;
}

function App() {
  const [session, setSession] = useState<ActiveSession | null>(() => {
    try {
      // Read from sessionStorage first, fallback to localStorage so closing the app window does not log out
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY) || localStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed.studentId === 'string' && parsed.studentId.trim().length > 0) {
          // Keep sessionStorage in sync
          sessionStorage.setItem(SESSION_STORAGE_KEY, stored);
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load session from storage', e);
    }
    return null;
  });

  const handleLoginSuccess = (sessionData: ActiveSession) => {
    const sessionWithTime: ActiveSession = {
      ...sessionData,
      startTime: sessionData.startTime || Date.now(),
      selectedFolder: undefined,
    };
    try {
      const sessionStr = JSON.stringify(sessionWithTime);
      sessionStorage.setItem(SESSION_STORAGE_KEY, sessionStr);
      localStorage.setItem(SESSION_STORAGE_KEY, sessionStr);
    } catch (e) {
      console.error('Failed to save session to storage', e);
    }
    setSession(sessionWithTime);
  };

  const handleFolderSelect = (folderName: string) => {
    if (!session) return;
    const updated: ActiveSession = {
      ...session,
      selectedFolder: folderName || undefined,
    };
    try {
      const sessionStr = JSON.stringify(updated);
      sessionStorage.setItem(SESSION_STORAGE_KEY, sessionStr);
      localStorage.setItem(SESSION_STORAGE_KEY, sessionStr);
    } catch (e) {
      console.error('Failed to update session in storage', e);
    }
    setSession(updated);
  };

  const handleLogout = () => {
    try {
      if (session?.studentId) {
        sessionStorage.removeItem(`pyshield_cells_${session.studentId}`);
        sessionStorage.removeItem(`pyshield_kernel_${session.studentId}`);
        localStorage.removeItem(`pyshield_cells_${session.studentId}`);
        localStorage.removeItem(`pyshield_kernel_${session.studentId}`);
      }
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear session from storage', e);
    }
    setSession(null);
  };

  // Step 1: Login Screen
  if (!session) {
    return (
      <div className="app-viewport">
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  // Step 2: Select or Create Project Folder Screen
  if (!session.selectedFolder) {
    return (
      <div className="app-viewport">
        <SelectFolder
          session={session}
          onSelectFolder={handleFolderSelect}
          onLogout={handleLogout}
        />
      </div>
    );
  }

  // Step 3: Active Session View: Render the Interactive Monaco Editor Notebook Workspace
  return (
    <div className="app-viewport">
      <NotebookWorkspace
        session={session}
        onEndSession={handleLogout}
        onSwitchFolder={() => handleFolderSelect('')}
      />
    </div>
  );
}

export default App;
