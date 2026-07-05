import { useEffect, useState } from 'react';
import { getWorkbook, setWorkbookPublic, regenerateShareToken } from '../lib/workbooks-api';
import './ShareButton.css';

/** Copy text to the clipboard with a legacy fallback for insecure contexts. */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

export function ShareButton({ workbookId }: { workbookId: string }) {
  const [open, setOpen] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getWorkbook(workbookId)
      .then((wb) => {
        if (cancelled) return;
        setIsPublic(wb.isPublic);
        setShareToken(wb.shareToken);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, workbookId]);

  const shareUrl = shareToken
    ? `${window.location.origin}${window.location.pathname}#/share/${shareToken}`
    : '';

  const togglePublic = async () => {
    const next = !isPublic;
    setError(null);
    setBusy(true);
    setIsPublic(next); // optimistic
    try {
      await setWorkbookPublic(workbookId, next);
    } catch (e) {
      setIsPublic(!next); // revert on failure
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    if (!confirm('Revoke the current link? Anyone using it will lose access.')) return;
    setError(null);
    setBusy(true);
    try {
      const newToken = await regenerateShareToken(workbookId);
      setShareToken(newToken);
      setCopied(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    const ok = await copyToClipboard(shareUrl);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } else {
      setError('Could not copy automatically — select the link and copy it manually.');
    }
  };

  return (
    <div className="share-widget">
      <button className="link-button" onClick={() => setOpen((o) => !o)}>Share</button>
      {open && (
        <div className="share-popover">
          {loading ? (
            <span className="share-status">Loading share settings…</span>
          ) : (
            <>
              <label className="share-toggle">
                <input type="checkbox" checked={isPublic} onChange={togglePublic} disabled={busy} />
                Anyone with the link can view
              </label>
              {isPublic && shareToken && (
                <>
                  <div className="share-url-row">
                    <input readOnly value={shareUrl} onFocus={(e) => e.target.select()} />
                    <button onClick={copyLink} disabled={busy}>{copied ? 'Copied!' : 'Copy'}</button>
                  </div>
                  <button className="link-button" onClick={revoke} disabled={busy}>
                    Revoke link (generate a new one)
                  </button>
                </>
              )}
            </>
          )}
          {error && <div className="share-error">{error}</div>}
        </div>
      )}
    </div>
  );
}
