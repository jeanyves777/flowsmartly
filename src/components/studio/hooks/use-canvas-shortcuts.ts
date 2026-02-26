"use client";

import { useEffect } from "react";
import { useCanvasStore } from "./use-canvas-store";
import { useCanvasHistory } from "./use-canvas-history";

export function useCanvasShortcuts() {
  const canvas = useCanvasStore((s) => s.canvas);
  const isEditingText = useCanvasStore((s) => s.isEditingText);
  const setActiveTool = useCanvasStore((s) => s.setActiveTool);
  const setDirty = useCanvasStore((s) => s.setDirty);
  const refreshLayers = useCanvasStore((s) => s.refreshLayers);

  const { undo, redo } = useCanvasHistory();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      // Don't handle single-key shortcuts when editing text on canvas
      const isModified = e.ctrlKey || e.metaKey;

      // Ctrl/Cmd shortcuts
      if (isModified) {
        switch (e.key.toLowerCase()) {
          case "z":
            e.preventDefault();
            if (e.shiftKey) {
              redo();
            } else {
              undo();
            }
            return;
          case "y":
            e.preventDefault();
            redo();
            return;
          case "c":
            if (!isEditingText) handleCopy();
            return;
          case "v":
            if (!isEditingText) handlePaste();
            return;
          case "d":
            e.preventDefault();
            handleDuplicate();
            return;
          case "a":
            if (!isEditingText) {
              e.preventDefault();
              handleSelectAll();
            }
            return;
          case "g":
            e.preventDefault();
            if (e.shiftKey) {
              handleUngroup();
            } else {
              handleGroup();
            }
            return;
          case "s":
            e.preventDefault();
            // Save will be handled by the parent
            document.dispatchEvent(new CustomEvent("studio:save"));
            return;
        }
      }

      // Single-key shortcuts (only when not editing text)
      if (!isEditingText && !isModified) {
        switch (e.key.toLowerCase()) {
          case "v":
            setActiveTool("select");
            return;
          case "t":
            setActiveTool("text");
            return;
          case "delete":
          case "backspace":
            e.preventDefault();
            handleDelete();
            return;
          case "[":
            handleSendBackward();
            return;
          case "]":
            handleBringForward();
            return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // Clipboard
  let clipboardData: any = null;

  function handleCopy() {
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (!active) return;
    active.clone((cloned: any) => {
      clipboardData = cloned;
    });
    // Fabric.js v6 clone is sync
    clipboardData = active.toObject(["id", "customName"]);
  }

  function handlePaste() {
    if (!canvas || !clipboardData) return;
    // Re-create from JSON
    import("fabric").then((fabric) => {
      fabric.util.enlivenObjects([clipboardData]).then((objects: any[]) => {
        objects.forEach((obj: any) => {
          obj.set({
            left: (obj.left || 0) + 20,
            top: (obj.top || 0) + 20,
          });
          obj.id = `obj-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          canvas.add(obj);
        });
        canvas.renderAll();
        setDirty(true);
      });
    });
  }

  function handleDuplicate() {
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (!active) return;

    active.clone().then((cloned: any) => {
      cloned.set({
        left: (active.left || 0) + 20,
        top: (active.top || 0) + 20,
      });
      cloned.id = `obj-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      canvas.add(cloned);
      canvas.setActiveObject(cloned);
      canvas.renderAll();
      setDirty(true);
    });
  }

  function handleDelete() {
    if (!canvas) return;
    const active = canvas.getActiveObjects();
    if (active.length === 0) return;
    active.forEach((obj: any) => canvas.remove(obj));
    canvas.discardActiveObject();
    canvas.renderAll();
    refreshLayers();
    setDirty(true);
  }

  function handleSelectAll() {
    if (!canvas) return;
    canvas.discardActiveObject();
    const objects = canvas.getObjects();
    if (objects.length === 0) return;
    const selection = new (canvas.constructor as any).ActiveSelection(objects, {
      canvas,
    });
    canvas.setActiveObject(selection);
    canvas.renderAll();
  }

  function handleGroup() {
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (!active || active.type !== "activeSelection") return;
    (active as any).toGroup();
    canvas.renderAll();
    refreshLayers();
  }

  function handleUngroup() {
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (!active || active.type !== "group") return;
    (active as any).toActiveSelection();
    canvas.renderAll();
    refreshLayers();
  }

  function handleSendBackward() {
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (!active) return;
    canvas.sendObjectBackwards(active);
    canvas.renderAll();
    refreshLayers();
  }

  function handleBringForward() {
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (!active) return;
    canvas.bringObjectForward(active);
    canvas.renderAll();
    refreshLayers();
  }
}
