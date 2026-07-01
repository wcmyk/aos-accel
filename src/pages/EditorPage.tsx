import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { EditorShell } from '../components/EditorShell';
import { useAccelStore } from '../store/accel-store';
import { useAutosave } from '../hooks/useAutosave';
import { getWorkbook, getWorkbookByShareToken } from '../lib/workbooks-api';

type Mode = 'local' | 'owner' | 'share';

export function EditorPage({ mode }: { mode: Mode }) {
  const { id, token } = useParams<{ id: string; token: string }>();
  const loadWorkbook = useAccelStore((state) => state.loadWorkbook);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(mode === 'local' ? 'ready' : 'loading');
  const [error, setError] = useState<string | null>(null);

  useAutosave();

  useEffect(() => {
    if (mode === 'local') return;

    setStatus('loading');
    const load =
      mode === 'owner'
        ? getWorkbook(id as string)
        : getWorkbookByShareToken(token as string);

    load
      .then((record) => {
        loadWorkbook(record.data, { id: record.id, title: record.title, readOnly: mode === 'share' });
        setStatus('ready');
      })
      .catch((e) => {
        setError((e as Error).message);
        setStatus('error');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, id, token]);

  if (status === 'loading') {
    return <div className="loading-screen">Loading workbook…</div>;
  }

  if (status === 'error') {
    return (
      <div className="loading-screen">
        <p>{error}</p>
        {mode === 'owner' ? (
          <Link to="/dashboard">Back to My workbooks</Link>
        ) : (
          <Link to="/">Back to Radix</Link>
        )}
      </div>
    );
  }

  return <EditorShell />;
}
