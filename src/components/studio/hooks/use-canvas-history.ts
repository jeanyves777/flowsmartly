"use client";

import { useCallback, useEffect } from "react";
import { useCanvasStore } from "./use-canvas-store";
import { safeLoadFromJSON } from "../utils/canvas-helpers";

const MAX_HISTORY = 50;

// Module-level singletons so all useCanvasHistory() instances share the same stack
let historyStack: string[] = [];
let historyIndex = -1;
let isRestoring = false;

export function useCanvasHistory() {
  const canvas = useCanvasStore((s) => s.canvas);
  const setHistoryState = useCanvasStore((s) => s.setHistoryState);

  const updateHistoryState = useCallback(() => {
    setHistoryState(historyIndex > 0, historyIndex < historyStack.length - 1);
  }, [setHistoryState]);

  const pushState = useCallback(() => {
    if (!canvas || isRestoring) return;

    const json = JSON.stringify(canvas.toJSON(["id", "customName", "selectable", "visible"]));

    // Remove any redo states
    historyStack = historyStack.slice(0, historyIndex + 1);

    // Push new state
    historyStack.push(json);

    // Trim if over limit
    if (historyStack.length > MAX_HISTORY) {
      historyStack.shift();
    } else {
      historyIndex++;
    }

    updateHistoryState();
  }, [canvas, updateHistoryState]);

  const undo = useCallback(async () => {
    if (!canvas || historyIndex <= 0) return;

    isRestoring = true;
    historyIndex--;
    const json = historyStack[historyIndex];

    await safeLoadFromJSON(canvas, json);

    isRestoring = false;
    updateHistoryState();
    useCanvasStore.getState().refreshLayers();
  }, [canvas, updateHistoryState]);

  const redo = useCallback(async () => {
    if (!canvas || historyIndex >= historyStack.length - 1) return;

    isRestoring = true;
    historyIndex++;
    const json = historyStack[historyIndex];

    await safeLoadFromJSON(canvas, json);

    isRestoring = false;
    updateHistoryState();
    useCanvasStore.getState().refreshLayers();
  }, [canvas, updateHistoryState]);

  // Reset history when canvas changes
  useEffect(() => {
    historyStack = [];
    historyIndex = -1;
    updateHistoryState();
  }, [canvas, updateHistoryState]);

  return { pushState, undo, redo };
}
