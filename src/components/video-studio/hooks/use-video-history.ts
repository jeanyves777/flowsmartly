import { useCallback, useEffect, useRef } from "react";
import { useVideoStore } from "./use-video-store";

/**
 * Undo/redo history for the video editor.
 * Stores snapshots of { tracks, clips } as JSON strings.
 * Module-level singletons to persist across component re-mounts.
 */

const MAX_HISTORY = 50;

let historyStack: string[] = [];
let historyIndex = -1;
let isRestoring = false;

function getCurrentSnapshot(): string {
  const { tracks, clips } = useVideoStore.getState();
  return JSON.stringify({ tracks, clips });
}

export function pushState() {
  if (isRestoring) return;

  const snapshot = getCurrentSnapshot();

  // Don't push if identical to current
  if (historyIndex >= 0 && historyStack[historyIndex] === snapshot) return;

  // Clear redo states when new action taken after undo
  historyStack = historyStack.slice(0, historyIndex + 1);
  historyStack.push(snapshot);

  // Enforce max history
  if (historyStack.length > MAX_HISTORY) {
    historyStack = historyStack.slice(historyStack.length - MAX_HISTORY);
  }

  historyIndex = historyStack.length - 1;
  useVideoStore.getState().setHistoryState(historyIndex > 0, false);
}

export function undo() {
  if (historyIndex <= 0) return;
  historyIndex--;
  restoreFromIndex(historyIndex);
  useVideoStore
    .getState()
    .setHistoryState(historyIndex > 0, historyIndex < historyStack.length - 1);
}

export function redo() {
  if (historyIndex >= historyStack.length - 1) return;
  historyIndex++;
  restoreFromIndex(historyIndex);
  useVideoStore
    .getState()
    .setHistoryState(historyIndex > 0, historyIndex < historyStack.length - 1);
}

function restoreFromIndex(index: number) {
  const snapshot = historyStack[index];
  if (!snapshot) return;

  isRestoring = true;
  try {
    const { tracks, clips } = JSON.parse(snapshot);
    useVideoStore.setState({ tracks, clips, isDirty: true });
    useVideoStore.getState().refreshDuration();
  } finally {
    isRestoring = false;
  }
}

export function resetHistory() {
  historyStack = [];
  historyIndex = -1;
  isRestoring = false;
  // Push initial state
  pushState();
}

/**
 * Hook to wire up history tracking.
 * Call this once in the video studio layout.
 */
export function useVideoHistory() {
  const tracks = useVideoStore((s) => s.tracks);
  const clips = useVideoStore((s) => s.clips);
  const canUndo = useVideoStore((s) => s.canUndo);
  const canRedo = useVideoStore((s) => s.canRedo);

  const lastSnapshotRef = useRef("");

  // Auto-push state when tracks/clips change (debounced)
  useEffect(() => {
    if (isRestoring) return;
    const snapshot = JSON.stringify({ tracks, clips });
    if (snapshot !== lastSnapshotRef.current) {
      lastSnapshotRef.current = snapshot;
      // Small delay to batch rapid changes
      const timer = setTimeout(() => pushState(), 100);
      return () => clearTimeout(timer);
    }
  }, [tracks, clips]);

  return {
    undo: useCallback(undo, []),
    redo: useCallback(redo, []),
    canUndo,
    canRedo,
    resetHistory: useCallback(resetHistory, []),
  };
}
