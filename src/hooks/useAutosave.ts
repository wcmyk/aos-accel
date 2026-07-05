import { useEffect, useRef } from 'react';
import { useAccelStore } from '../store/accel-store';
import { serializeEngine, isValidWorkbook, SerializedWorkbook } from '../engine/serialization';
import { saveWorkbook } from '../lib/workbooks-api';
import { isCloudEnabled } from '../lib/supabase';

const AUTOSAVE_DELAY_MS = 1500;

// Local-only persistence -----------------------------------------------------
// Without cloud mode the workbook lives entirely in the browser. We mirror the
// serialized workbook into localStorage so a refresh doesn't lose work.
const LOCAL_KEY = 'radix:workbook:v1';
// localStorage is typically capped near 5 MB; stay well under so a large sheet
// never wedges the app or throws mid-save.
const LOCAL_MAX_CHARS = 4_000_000;

interface LocalSnapshot {
  title: string;
  data: SerializedWorkbook;
}

/** Read the persisted local workbook, rejecting corrupt/oversized payloads. */
export function loadLocalWorkbook(): LocalSnapshot | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw || raw.length > LOCAL_MAX_CHARS) return null;
    const parsed = JSON.parse(raw) as Partial<LocalSnapshot>;
    if (!parsed || !isValidWorkbook(parsed.data)) return null;
    const title = typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title : 'Untitled workbook';
    return { title, data: parsed.data };
  } catch {
    // Malformed JSON or unavailable storage (private mode) — start fresh.
    return null;
  }
}

/** Persist the workbook locally; silently no-ops on quota/oversize/errors. */
function saveLocalWorkbook(title: string, data: SerializedWorkbook): void {
  try {
    const raw = JSON.stringify({ title, data } satisfies LocalSnapshot);
    if (raw.length > LOCAL_MAX_CHARS) return;
    localStorage.setItem(LOCAL_KEY, raw);
  } catch {
    // Quota exceeded or storage disabled — non-fatal; the in-memory doc is intact.
  }
}

// Cloud persistence ----------------------------------------------------------
const CLOUD_MAX_RETRIES = 2;
const CLOUD_BACKOFF_MS = [800, 2500];

/**
 * Transient failures (offline, dropped connection, 5xx) are worth retrying;
 * permanent ones (auth/permission/validation) are surfaced immediately so the
 * user isn't left staring at a spinner.
 */
function isTransient(err: unknown): boolean {
  const status = (err as { status?: number; code?: string | number })?.status;
  if (typeof status === 'number') return status >= 500 || status === 429 || status === 408;
  const message = (err as { message?: string })?.message?.toLowerCase() ?? '';
  return /network|fetch|timeout|failed to fetch|connection/.test(message);
}

/**
 * Debounced autosave.
 *  - Local mode: mirrors the serialized workbook into localStorage.
 *  - Cloud mode: pushes to Supabase with retry/backoff and a stale-completion
 *    guard so a save that lands after newer edits doesn't falsely report
 *    "saved" or clobber the freshest state.
 * Read-only / shared views never write.
 */
export function useAutosave() {
  const docVersion = useAccelStore((s) => s.docVersion);
  const workbookId = useAccelStore((s) => s.workbookId);
  const workbookTitle = useAccelStore((s) => s.workbookTitle);
  const isReadOnly = useAccelStore((s) => s.isReadOnly);
  const setSaveStatus = useAccelStore((s) => s.setSaveStatus);
  const loadWorkbook = useAccelStore((s) => s.loadWorkbook);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const retryRef = useRef<ReturnType<typeof setTimeout>>();
  const loadedRef = useRef(false);

  // Restore a locally-persisted workbook once, on first mount, in local mode.
  useEffect(() => {
    if (isCloudEnabled || loadedRef.current) return;
    loadedRef.current = true;
    const restored = loadLocalWorkbook();
    if (restored) {
      loadWorkbook(restored.data, { id: null, title: restored.title, readOnly: false });
    }
    // loadWorkbook is a stable store action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // docVersion resets to 0 right after a load, so this also skips the
    // save-on-load case where there is nothing new to persist yet.
    if (isReadOnly || docVersion === 0) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (retryRef.current) clearTimeout(retryRef.current);

    // --- Local-only mode -------------------------------------------------
    if (!isCloudEnabled) {
      debounceRef.current = setTimeout(() => {
        const { engine, workbookTitle: title } = useAccelStore.getState();
        saveLocalWorkbook(title, serializeEngine(engine));
      }, AUTOSAVE_DELAY_MS);
      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
      };
    }

    // --- Cloud mode ------------------------------------------------------
    if (!workbookId) return;

    setSaveStatus('saving');

    const attemptSave = (versionAtFire: number, attempt: number) => {
      const { engine } = useAccelStore.getState();
      saveWorkbook(workbookId, serializeEngine(engine), workbookTitle)
        .then(() => {
          // If newer edits arrived while this save was in flight, leave the
          // status as 'saving' — the pending debounce cycle will finish them.
          if (useAccelStore.getState().docVersion === versionAtFire) {
            setSaveStatus('saved', Date.now());
          }
        })
        .catch((err) => {
          if (attempt < CLOUD_MAX_RETRIES && isTransient(err)) {
            retryRef.current = setTimeout(
              () => attemptSave(useAccelStore.getState().docVersion, attempt + 1),
              CLOUD_BACKOFF_MS[attempt] ?? 2500,
            );
          } else {
            setSaveStatus('error');
          }
        });
    };

    debounceRef.current = setTimeout(() => {
      attemptSave(useAccelStore.getState().docVersion, 0);
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (retryRef.current) clearTimeout(retryRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docVersion, workbookId, workbookTitle, isReadOnly]);
}
