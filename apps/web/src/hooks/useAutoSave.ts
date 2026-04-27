"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AutoSaveStatus = "idle" | "saving" | "saved" | "error";

interface Options {
  /** Whether auto-save is active. */
  enabled: boolean;
  /** Debounce delay in ms (default 2000). */
  delay?: number;
  /** Called when the debounce fires — should persist state and resolve/reject. */
  onSave: () => Promise<void>;
  /** Dependency array — auto-save triggers whenever any value here changes. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deps: any[];
}

interface Result {
  status: AutoSaveStatus;
  lastSaved: string | null;
  /** Trigger a manual save immediately (bypasses debounce). */
  saveNow: () => Promise<void>;
}

export function useAutoSave({ enabled, delay = 2000, onSave, deps }: Options): Result {
  const [status, setStatus]     = useState<AutoSaveStatus>("idle");
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSaveRef = useRef(onSave);

  // Keep ref current so the timeout closure always calls the latest version
  useEffect(() => { onSaveRef.current = onSave; });

  const run = useCallback(async () => {
    setStatus("saving");
    try {
      await onSaveRef.current();
      setLastSaved(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }, []);

  // Debounce on deps change
  useEffect(() => {
    if (!enabled) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(run, delay);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, delay, run, ...deps]);

  return { status, lastSaved, saveNow: run };
}
