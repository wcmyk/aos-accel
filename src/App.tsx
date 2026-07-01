/**
 * Main Radix Application
 * Full-featured Excel replacement
 */

import { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { isCloudEnabled } from './lib/supabase';
import { useAuthStore } from './store/auth-store';
import { LandingPage } from './components/LandingPage';
import { AuthScreen } from './components/AuthScreen';
import { WorkbookDashboard } from './components/WorkbookDashboard';
import { EditorPage } from './pages/EditorPage';
import './App.css';

function AppRoutes() {
  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);
  const init = useAuthStore((state) => state.init);

  useEffect(() => {
    init();
  }, [init]);

  if (isCloudEnabled && isLoading) {
    return <div className="loading-screen">Loading…</div>;
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      {isCloudEnabled ? (
        <>
          <Route path="/share/:token" element={<EditorPage mode="share" />} />
          <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <AuthScreen />} />
          <Route path="/dashboard" element={user ? <WorkbookDashboard /> : <Navigate to="/login" replace />} />
          <Route path="/w/:id" element={user ? <EditorPage mode="owner" /> : <Navigate to="/login" replace />} />
        </>
      ) : (
        <Route path="/app" element={<EditorPage mode="local" />} />
      )}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    // HashRouter avoids needing a server-side rewrite rule for deep links
    // like /w/:id, which plain GitHub Pages static hosting can't do.
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  );
}

export default App;
