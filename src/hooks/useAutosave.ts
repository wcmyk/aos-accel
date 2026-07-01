import { useEffect, useRef } from 'react';
import { useAccelStore } from '../store/accel-store';
import { serializeEngine } from '../engine/serialization';
import { saveWorkbook } from '../lib/workbooks-api';
import { isCloudEnabled } from '../lib/supabase';

const AUTOSAVE_DELAY_MS = 1500;

/** Debounced autosave: fires after docVersion changes, skipped for read-only/shared views. */
export function useAutosave() {
  const docVersion = useAccelStore((s) => s.docVersion);
  const workbookId = useAccelStore((s) => s.workbookId);
  const workbookTitle = useAccelStore((s) => s.workbookTitle);
  const isReadOnly = useAccelStore((s) => s.isReadOnly);
  const setSaveStatus = useAccelStore((s) => s.setSaveStatus);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    // docVersion is reset to 0 right after load, so this also skips the
    // save-on-load case where there's nothing new to persist yet.
    if (!isCloudEnabled || !workbookId || isReadOnly || docVersion === 0) {
      return;
    }

    setSaveStatus('saving');
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      const { engine } = useAccelStore.getState();
      saveWorkbook(workbookId, serializeEngine(engine), workbookTitle)
        .then(() => setSaveStatus('saved', Date.now()))
        .catch(() => setSaveStatus('error'));
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docVersion, workbookId, workbookTitle, isReadOnly]);
}
