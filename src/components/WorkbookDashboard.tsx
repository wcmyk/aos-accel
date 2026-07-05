import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth-store';
import { AccelEngine } from '../engine/engine';
import { serializeEngine } from '../engine/serialization';
import { createWorkbook, deleteWorkbook, listWorkbooks, WorkbookSummary } from '../lib/workbooks-api';

export function WorkbookDashboard() {
  const navigate = useNavigate();
  const { user, signOut } = useAuthStore();
  const [workbooks, setWorkbooks] = useState<WorkbookSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    setIsLoading(true);
    setError(null);
    listWorkbooks()
      .then(setWorkbooks)
      .catch((e) => setError((e as Error).message))
      .finally(() => setIsLoading(false));
  };

  useEffect(refresh, []);

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const blank = serializeEngine(new AccelEngine());
      const workbook = await createWorkbook('Untitled workbook', blank);
      navigate(`/w/${workbook.id}`);
    } catch (e) {
      setError((e as Error).message);
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this workbook? This cannot be undone.')) return;
    setError(null);
    try {
      await deleteWorkbook(id);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <h1>Radix</h1>
        <div className="dashboard__user">
          <span>{user?.email}</span>
          <button onClick={() => signOut()}>Sign out</button>
        </div>
      </header>

      <div className="dashboard__actions">
        <button className="primary" onClick={handleCreate} disabled={creating}>
          {creating ? 'Creating…' : '+ New workbook'}
        </button>
      </div>

      {error && <div className="auth-error">{error}</div>}

      {isLoading ? (
        <p>Loading workbooks…</p>
      ) : workbooks.length === 0 ? (
        <p className="dashboard__empty">No workbooks yet. Create one to get started.</p>
      ) : (
        <ul className="dashboard__list">
          {workbooks.map((wb) => (
            <li key={wb.id} className="dashboard__item">
              <button className="dashboard__item-open" onClick={() => navigate(`/w/${wb.id}`)}>
                <strong>{wb.title}</strong>
                <span>{new Date(wb.updatedAt).toLocaleString()}</span>
              </button>
              <button className="dashboard__item-delete" onClick={() => handleDelete(wb.id)}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
