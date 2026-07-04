/**
 * Main Accel Application
 * Full-featured Excel replacement
 */

import { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { isCloudEnabled } from './lib/supabase';
import { useAuthStore } from './store/auth-store';
import { AuthScreen } from './components/AuthScreen';
import { WorkbookDashboard } from './components/WorkbookDashboard';
import { EditorPage } from './pages/EditorPage';
import './App.css';

function CloudApp() {
  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);
  const init = useAuthStore((state) => state.init);

  useEffect(() => {
    init();
  }, [init]);

  if (isLoading) {
    return <div className="loading-screen">Loading…</div>;
  }

  return (
    <Routes>
      <Route path="/share/:token" element={<EditorPage mode="share" />} />
      {!user ? (
        <Route path="*" element={<AuthScreen />} />
      ) : (
        <>
          <Route path="/" element={<WorkbookDashboard />} />
          <Route path="/w/:id" element={<EditorPage mode="owner" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </>
      )}
    </Routes>
  );
}

function App() {
  // HashRouter avoids needing a server-side rewrite rule for deep links
  // like /w/:id, which plain GitHub Pages static hosting can't do.
  // Local mode still needs the Router: EditorPage/EditorShell call router
  // hooks (useParams, useNavigate, <Link>), which throw without a Router
  // ancestor and would crash the whole app to a blank page.
  if (!isCloudEnabled) {
    return (
      <HashRouter>
        <EditorPage mode="local" />
      </HashRouter>
    );
  }

  return (
    <HashRouter>
      <CloudApp />
    </HashRouter>
  );
}

export default App;
