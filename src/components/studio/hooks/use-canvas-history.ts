"use client";

import { useRef, useCallback, useEffect } from "react";
import { useCanvasStore } from "./use-canvas-store";

const MAX_HISTORY = 50;

export function useCanvasHistory() {
  const canvas = useCanvasStore((s) => s.canvas);
  const setHistoryState = useCanvasStore((s) => s.setHistoryState);

  const historyRef = useRef<string[]>([]);
  const indexRef = useRef(-1);
  const isRestoringRef = useRef(false);

  const updateHistoryState = useCallback(() => {
    setHistoryState(indexRef.current > 0, indexRef.current < historyRef.current.length - 1);
  }, [setHistoryState]);

  const pushState = useCallback(() => {
    if (!canvas || isRestoringRef.current) return;

    const json = JSON.stringify(canvas.toJSON(["id", "customName", "selectable", "visible"]));

    // Remove any redo states
    historyRef.current = historyRef.current.slice(0, indexRef.current + 1);

    // Push new state
    historyRef.current.push(json);

    // Trim if over limit
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift();
    } else {
      indexRef.current++;
    }

    updateHistoryState();
  }, [canvas, updateHistoryState]);

  const undo = useCallback(async () => {
    if (!canvas || indexRef.current <= 0) return;

    isRestoringRef.current = true;
    indexRef.current--;
    const json = historyRef.current[indexRef.current];

    await canvas.loadFromJSON(json);
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    canvas.renderAll();

    isRestoringRef.current = false;
    updateHistoryState();
    useCanvasStore.getState().refreshLayers();
  }, [canvas, updateHistoryState]);

  const redo = useCallback(async () => {
    if (!canvas || indexRef.current >= historyRef.current.length - 1) return;

    isRestoringRef.current = true;
    indexRef.current++;
    const json = historyRef.current[indexRef.current];

    await canvas.loadFromJSON(json);
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    canvas.renderAll();

    isRestoringRef.current = false;
    updateHistoryState();
    useCanvasStore.getState().refreshLayers();
  }, [canvas, updateHistoryState]);

  // Reset history when canvas changes
  useEffect(() => {
    historyRef.current = [];
    indexRef.current = -1;
    updateHistoryState();
  }, [canvas, updateHistoryState]);

  return { pushState, undo, redo };
}
