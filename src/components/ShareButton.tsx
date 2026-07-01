import { useEffect, useState } from 'react';
import { getWorkbook, setWorkbookPublic, regenerateShareToken } from '../lib/workbooks-api';

export function ShareButton({ workbookId }: { workbookId: string }) {
  const [open, setOpen] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    getWorkbook(workbookId).then((wb) => {
      setIsPublic(wb.isPublic);
      setShareToken(wb.shareToken);
    });
  }, [open, workbookId]);

  const shareUrl = shareToken
    ? `${window.location.origin}${window.location.pathname}#/share/${shareToken}`
    : '';

  const togglePublic = async () => {
    const next = !isPublic;
    setIsPublic(next);
    await setWorkbookPublic(workbookId, next);
  };

  const revoke = async () => {
    const newToken = await regenerateShareToken(workbookId);
    setShareToken(newToken);
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="share-widget">
      <button className="link-button" onClick={() => setOpen((o) => !o)}>Share</button>
      {open && (
        <div className="share-popover">
          <label className="share-toggle">
            <input type="checkbox" checked={isPublic} onChange={togglePublic} />
            Anyone with the link can view
          </label>
          {isPublic && shareToken && (
            <>
              <div className="share-url-row">
                <input readOnly value={shareUrl} onFocus={(e) => e.target.select()} />
                <button onClick={copyLink}>{copied ? 'Copied!' : 'Copy'}</button>
              </div>
              <button className="link-button" onClick={revoke}>Revoke link (generate a new one)</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
