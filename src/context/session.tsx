import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { uid, type OutputFile } from '../lib/files';

/**
 * In-memory session state. Nothing here is persisted: closing or reloading the
 * tab discards every file reference.
 */
export interface RecentFile {
  id: string;
  name: string;
  size: number;
  blob: Blob;
  toolId: string;
  createdAt: number;
}

interface SessionApi {
  recent: RecentFile[];
  addRecent: (toolId: string, files: OutputFile[]) => void;
  clearRecent: () => void;
  /** Files dropped on the homepage, waiting to be picked up by a tool page. */
  setHandoff: (files: File[]) => void;
  takeHandoff: () => File[];
}

const SessionContext = createContext<SessionApi | null>(null);
const MAX_RECENT = 20;

export function SessionProvider({ children }: { children: ReactNode }) {
  const [recent, setRecent] = useState<RecentFile[]>([]);
  const handoff = useRef<File[]>([]);

  const addRecent = useCallback((toolId: string, files: OutputFile[]) => {
    const now = Date.now();
    setRecent((r) =>
      [...files.map((f) => ({ id: uid(), name: f.name, size: f.blob.size, blob: f.blob, toolId, createdAt: now })), ...r].slice(0, MAX_RECENT),
    );
  }, []);

  const clearRecent = useCallback(() => setRecent([]), []);
  const setHandoff = useCallback((files: File[]) => {
    handoff.current = files;
  }, []);
  const takeHandoff = useCallback(() => {
    const f = handoff.current;
    handoff.current = [];
    return f;
  }, []);

  const api = useMemo(() => ({ recent, addRecent, clearRecent, setHandoff, takeHandoff }), [recent, addRecent, clearRecent, setHandoff, takeHandoff]);
  return <SessionContext.Provider value={api}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}

/** Calls `onFiles` once on mount with any files handed off from the homepage. */
export function useHandoff(onFiles: (files: File[]) => void) {
  const { takeHandoff } = useSession();
  const cb = useRef(onFiles);
  cb.current = onFiles;
  useEffect(() => {
    // Deferred so the files are only consumed once the page has fully mounted
    // (React StrictMode mounts, unmounts and remounts components in development).
    const t = setTimeout(() => {
      const files = takeHandoff();
      if (files.length) cb.current(files);
    }, 0);
    return () => clearTimeout(t);
  }, [takeHandoff]);
}
