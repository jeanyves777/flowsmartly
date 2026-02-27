"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Eraser,
  Wand2,
  Paintbrush,
  Sparkles,
  Loader2,
  Info,
  Minus,
  Plus,
  Undo2,
  Redo2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useCanvasStore } from "../hooks/use-canvas-store";
import { useCanvasHistory } from "../hooks/use-canvas-history";

type ToolMode = "erase" | "restore" | "magic";

const BRUSH_MIN = 5;
const BRUSH_MAX = 150;
const MAX_ERASER_HISTORY = 20;

export function EraserPanel() {
  const { toast } = useToast();
  const canvas = useCanvasStore((s) => s.canvas);
  const setActiveTool = useCanvasStore((s) => s.setActiveTool);
  const setDirty = useCanvasStore((s) => s.setDirty);
  const refreshLayers = useCanvasStore((s) => s.refreshLayers);
  const { pushState } = useCanvasHistory();

  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [toolMode, setToolMode] = useState<ToolMode>("erase");
  const [brushSize, setBrushSize] = useState(30);
  const [tolerance, setTolerance] = useState(32);
  const [isEditing, setIsEditing] = useState(false);

  // Pixel-level editing state
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const originalImageDataRef = useRef<ImageData | null>(null);
  const targetObjectRef = useRef<any>(null);
  const eraserHistoryRef = useRef<ImageData[]>([]);
  const eraserHistoryIndexRef = useRef(-1);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Get the selected image object from the canvas
  const getSelectedImage = useCallback((): any | null => {
    if (!canvas) return null;
    const obj = canvas.getActiveObject();
    if (!obj || obj.type !== "image") return null;
    return obj;
  }, [canvas]);

  // Initialize off-screen canvas from selected image
  const initOffscreenCanvas = useCallback((imgObj: any) => {
    const el = imgObj._element || imgObj.getElement?.();
    if (!el) return false;

    const w = imgObj.width || el.naturalWidth || el.width;
    const h = imgObj.height || el.naturalHeight || el.height;
    if (!w || !h) return false;

    const offscreen = document.createElement("canvas");
    offscreen.width = w;
    offscreen.height = h;
    const ctx = offscreen.getContext("2d", { willReadFrequently: true });
    if (!ctx) return false;

    ctx.drawImage(el, 0, 0, w, h);

    offscreenCanvasRef.current = offscreen;
    offscreenCtxRef.current = ctx;
    originalImageDataRef.current = ctx.getImageData(0, 0, w, h);
    targetObjectRef.current = imgObj;

    // Initialize eraser history
    const initial = ctx.getImageData(0, 0, w, h);
    eraserHistoryRef.current = [initial];
    eraserHistoryIndexRef.current = 0;

    return true;
  }, []);

  // Push eraser history snapshot
  const pushEraserHistory = useCallback(() => {
    const ctx = offscreenCtxRef.current;
    const offscreen = offscreenCanvasRef.current;
    if (!ctx || !offscreen) return;

    const snapshot = ctx.getImageData(0, 0, offscreen.width, offscreen.height);
    const trimmed = eraserHistoryRef.current.slice(0, eraserHistoryIndexRef.current + 1);
    eraserHistoryRef.current = [...trimmed, snapshot].slice(-MAX_ERASER_HISTORY);
    eraserHistoryIndexRef.current = Math.min(
      eraserHistoryIndexRef.current + 1,
      MAX_ERASER_HISTORY - 1
    );
  }, []);

  // Eraser undo/redo
  const eraserUndo = useCallback(() => {
    if (eraserHistoryIndexRef.current <= 0) return;
    eraserHistoryIndexRef.current--;
    const ctx = offscreenCtxRef.current;
    if (!ctx) return;
    ctx.putImageData(eraserHistoryRef.current[eraserHistoryIndexRef.current], 0, 0);
    applyOffscreenToFabric();
  }, []);

  const eraserRedo = useCallback(() => {
    if (eraserHistoryIndexRef.current >= eraserHistoryRef.current.length - 1) return;
    eraserHistoryIndexRef.current++;
    const ctx = offscreenCtxRef.current;
    if (!ctx) return;
    ctx.putImageData(eraserHistoryRef.current[eraserHistoryIndexRef.current], 0, 0);
    applyOffscreenToFabric();
  }, []);

  // Apply off-screen canvas back to the Fabric.js image
  const applyOffscreenToFabric = useCallback(() => {
    const offscreen = offscreenCanvasRef.current;
    const target = targetObjectRef.current;
    if (!offscreen || !target || !canvas) return;

    const dataUrl = offscreen.toDataURL("image/png");
    const img = new Image();
    img.onload = () => {
      target.setElement(img);
      canvas.renderAll();
    };
    img.src = dataUrl;
  }, [canvas]);

  // Convert screen coords to offscreen canvas coords
  const screenToOffscreen = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      if (!canvas || !targetObjectRef.current || !offscreenCanvasRef.current) return null;

      const target = targetObjectRef.current;
      const offscreen = offscreenCanvasRef.current;

      // Get the canvas element's bounding rect
      const canvasEl = canvas.getElement();
      const rect = canvasEl.getBoundingClientRect();

      // Account for CSS zoom (the canvas is scaled via CSS transform)
      const zoom = useCanvasStore.getState().zoom;

      // Convert screen coords to fabric canvas coords
      const fabricX = (clientX - rect.left) / zoom;
      const fabricY = (clientY - rect.top) / zoom;

      // Convert fabric coords to object-local coords
      const objLeft = target.left || 0;
      const objTop = target.top || 0;
      const scaleX = target.scaleX || 1;
      const scaleY = target.scaleY || 1;
      const angle = target.angle || 0;

      // Handle origin offset
      let originOffsetX = 0;
      let originOffsetY = 0;
      if (target.originX === "center") {
        originOffsetX = (target.width * scaleX) / 2;
      }
      if (target.originY === "center") {
        originOffsetY = (target.height * scaleY) / 2;
      }

      // Translate relative to object position
      let relX = fabricX - objLeft + originOffsetX;
      let relY = fabricY - objTop + originOffsetY;

      // Handle rotation
      if (angle !== 0) {
        const rad = (-angle * Math.PI) / 180;
        const cx = relX;
        const cy = relY;
        relX = cx * Math.cos(rad) - cy * Math.sin(rad);
        relY = cx * Math.sin(rad) + cy * Math.cos(rad);
      }

      // Scale to offscreen canvas coords
      const x = relX / scaleX;
      const y = relY / scaleY;

      if (x < 0 || x >= offscreen.width || y < 0 || y >= offscreen.height) return null;
      return { x, y };
    },
    [canvas]
  );

  // Drawing operations
  const drawEraseStroke = useCallback(
    (from: { x: number; y: number }, to: { x: number; y: number }) => {
      const ctx = offscreenCtxRef.current;
      if (!ctx) return;
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = brushSize;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.restore();
    },
    [brushSize]
  );

  const drawEraseDot = useCallback(
    (point: { x: number; y: number }) => {
      const ctx = offscreenCtxRef.current;
      if (!ctx) return;
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(point.x, point.y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
    [brushSize]
  );

  const drawRestoreDot = useCallback(
    (point: { x: number; y: number }) => {
      const ctx = offscreenCtxRef.current;
      const offscreen = offscreenCanvasRef.current;
      const original = originalImageDataRef.current;
      if (!ctx || !offscreen || !original) return;

      const radius = brushSize / 2;
      const current = ctx.getImageData(0, 0, offscreen.width, offscreen.height);
      const { data: currentData } = current;
      const { data: originalData } = original;

      for (let y = Math.floor(point.y - radius); y < Math.ceil(point.y + radius); y++) {
        for (let x = Math.floor(point.x - radius); x < Math.ceil(point.x + radius); x++) {
          if (x < 0 || x >= offscreen.width || y < 0 || y >= offscreen.height) continue;
          const dx = x - point.x;
          const dy = y - point.y;
          if (Math.sqrt(dx * dx + dy * dy) <= radius) {
            const pos = (y * offscreen.width + x) * 4;
            currentData[pos] = originalData[pos];
            currentData[pos + 1] = originalData[pos + 1];
            currentData[pos + 2] = originalData[pos + 2];
            currentData[pos + 3] = originalData[pos + 3];
          }
        }
      }
      ctx.putImageData(current, 0, 0);
    },
    [brushSize]
  );

  const drawRestoreStroke = useCallback(
    (from: { x: number; y: number }, to: { x: number; y: number }) => {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const steps = Math.max(1, Math.ceil(dist / (brushSize / 8)));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        drawRestoreDot({ x: from.x + dx * t, y: from.y + dy * t });
      }
    },
    [brushSize, drawRestoreDot]
  );

  const magicRemove = useCallback(
    (point: { x: number; y: number }) => {
      const ctx = offscreenCtxRef.current;
      const offscreen = offscreenCanvasRef.current;
      if (!ctx || !offscreen) return;

      const x = Math.floor(point.x);
      const y = Math.floor(point.y);
      const imageData = ctx.getImageData(0, 0, offscreen.width, offscreen.height);
      const { data, width, height } = imageData;

      const startPos = (y * width + x) * 4;
      const startR = data[startPos];
      const startG = data[startPos + 1];
      const startB = data[startPos + 2];
      const startA = data[startPos + 3];

      if (startA < 10) return;

      const matches = (pos: number): boolean => {
        const r = data[pos];
        const g = data[pos + 1];
        const b = data[pos + 2];
        const a = data[pos + 3];
        if (a < 10) return false;
        return (
          Math.abs(r - startR) <= tolerance &&
          Math.abs(g - startG) <= tolerance &&
          Math.abs(b - startB) <= tolerance &&
          Math.abs(a - startA) <= tolerance
        );
      };

      const stack: Array<[number, number]> = [[x, y]];
      const visited = new Set<number>();

      while (stack.length > 0) {
        const [px, py] = stack.pop()!;
        const key = py * width + px;
        if (visited.has(key)) continue;
        if (px < 0 || px >= width || py < 0 || py >= height) continue;
        const pos = (py * width + px) * 4;
        if (!matches(pos)) continue;
        visited.add(key);
        data[pos + 3] = 0; // Make transparent
        stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
      }

      ctx.putImageData(imageData, 0, 0);
    },
    [tolerance]
  );

  // Start editing the selected image
  const startEditing = useCallback(() => {
    const img = getSelectedImage();
    if (!img) {
      toast({
        title: "Select an image first",
        description: "Click on an image on the canvas to edit it",
        variant: "destructive",
      });
      return;
    }

    if (!initOffscreenCanvas(img)) {
      toast({ title: "Failed to load image data", variant: "destructive" });
      return;
    }

    setIsEditing(true);
    setActiveTool("draw"); // canvas-editor sync sets skipTargetFind, crosshair cursor, etc.
    canvas.discardActiveObject();
    canvas.renderAll();

    toast({
      title: "Eraser mode active",
      description: "Draw on the image to erase. Press Done when finished.",
    });
  }, [getSelectedImage, initOffscreenCanvas, setActiveTool, canvas, toast]);

  // Finish editing
  const finishEditing = useCallback(() => {
    applyOffscreenToFabric();
    setIsEditing(false);
    setActiveTool("select"); // canvas-editor sync restores cursor, selection, skipTargetFind

    // Push canvas history for undo
    pushState();
    refreshLayers();
    setDirty(true);

    // Cleanup
    offscreenCanvasRef.current = null;
    offscreenCtxRef.current = null;
    originalImageDataRef.current = null;
    targetObjectRef.current = null;
    eraserHistoryRef.current = [];
    eraserHistoryIndexRef.current = -1;
  }, [applyOffscreenToFabric, setActiveTool, canvas, pushState, refreshLayers, setDirty]);

  // Mouse event handlers (attached to the canvas element)
  useEffect(() => {
    if (!canvas || !isEditing) return;

    const handleMouseDown = (opt: any) => {
      const e = opt.e as MouseEvent;
      if (e.button !== 0) return;
      const point = screenToOffscreen(e.clientX, e.clientY);
      if (!point) return;

      if (toolMode === "magic") {
        magicRemove(point);
        pushEraserHistory();
        applyOffscreenToFabric();
      } else {
        isDrawingRef.current = true;
        lastPointRef.current = point;
        if (toolMode === "erase") {
          drawEraseDot(point);
        } else {
          drawRestoreDot(point);
        }
        applyOffscreenToFabric();
      }
    };

    const handleMouseMove = (opt: any) => {
      if (!isDrawingRef.current || !lastPointRef.current) return;
      const e = opt.e as MouseEvent;
      const point = screenToOffscreen(e.clientX, e.clientY);
      if (!point) return;

      if (toolMode === "erase") {
        drawEraseStroke(lastPointRef.current, point);
      } else if (toolMode === "restore") {
        drawRestoreStroke(lastPointRef.current, point);
      }
      lastPointRef.current = point;
      applyOffscreenToFabric();
    };

    const handleMouseUp = () => {
      if (isDrawingRef.current) {
        isDrawingRef.current = false;
        lastPointRef.current = null;
        pushEraserHistory();
      }
    };

    canvas.on("mouse:down", handleMouseDown);
    canvas.on("mouse:move", handleMouseMove);
    canvas.on("mouse:up", handleMouseUp);

    return () => {
      canvas.off("mouse:down", handleMouseDown);
      canvas.off("mouse:move", handleMouseMove);
      canvas.off("mouse:up", handleMouseUp);
    };
  }, [
    canvas,
    isEditing,
    toolMode,
    screenToOffscreen,
    magicRemove,
    pushEraserHistory,
    applyOffscreenToFabric,
    drawEraseDot,
    drawRestoreDot,
    drawEraseStroke,
    drawRestoreStroke,
  ]);

  // Keyboard shortcuts for eraser modes
  useEffect(() => {
    if (!isEditing) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key.toLowerCase() === "e") setToolMode("erase");
      if (e.key.toLowerCase() === "r") setToolMode("restore");
      if (e.key.toLowerCase() === "m") setToolMode("magic");

      if (e.key === "[") {
        if (toolMode === "magic") {
          setTolerance((t) => Math.max(0, t - 5));
        } else {
          setBrushSize((s) => Math.max(BRUSH_MIN, s - 5));
        }
      }
      if (e.key === "]") {
        if (toolMode === "magic") {
          setTolerance((t) => Math.min(100, t + 5));
        } else {
          setBrushSize((s) => Math.min(BRUSH_MAX, s + 5));
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        eraserUndo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        eraserRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isEditing, toolMode, eraserUndo, eraserRedo]);

  // Cleanup on unmount or panel switch
  useEffect(() => {
    return () => {
      if (isEditing) {
        // Apply any pending changes
        if (offscreenCanvasRef.current && targetObjectRef.current && canvas) {
          const dataUrl = offscreenCanvasRef.current.toDataURL("image/png");
          const img = new Image();
          img.onload = () => {
            targetObjectRef.current?.setElement(img);
            canvas?.renderAll();
          };
          img.src = dataUrl;
        }
      }
    };
  }, [isEditing, canvas]);

  // AI Remove Background on selected image
  const handleAIRemove = async () => {
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (!obj || obj.type !== "image") {
      toast({ title: "Select an image on the canvas first", variant: "destructive" });
      return;
    }
    const src = obj.getSrc?.() || obj._element?.src;
    if (!src) {
      toast({ title: "Cannot read image source", variant: "destructive" });
      return;
    }

    setIsProcessingAI(true);
    try {
      let imageUrl = src;

      // If data URL or blob URL, upload first
      if (src.startsWith("data:") || src.startsWith("blob:")) {
        const blob = await fetch(src).then((r) => r.blob());
        const formData = new FormData();
        formData.append("file", blob, "bg-remove-input.png");
        formData.append("tags", JSON.stringify(["studio-bg-remove"]));
        const uploadRes = await fetch("/api/media", { method: "POST", body: formData });
        const uploadData = await uploadRes.json();
        if (!uploadData.success) throw new Error("Upload failed");
        imageUrl = uploadData.data.file.url;
      }

      const res = await fetch("/api/image-tools/remove-background", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || "Failed");

      if (data.data?.imageUrl) {
        const fabric = await import("fabric");
        const proxyUrl =
          data.data.imageUrl.startsWith("http") &&
          !data.data.imageUrl.startsWith(window.location.origin)
            ? `/api/image-proxy?url=${encodeURIComponent(data.data.imageUrl)}`
            : data.data.imageUrl;
        const newImg = await fabric.FabricImage.fromURL(proxyUrl, { crossOrigin: "anonymous" });
        if (newImg) {
          newImg.set({
            left: obj.left,
            top: obj.top,
            originX: obj.originX || "left",
            originY: obj.originY || "top",
            scaleX: obj.scaleX,
            scaleY: obj.scaleY,
            angle: obj.angle,
          });
          (newImg as any).id = (obj as any).id;
          (newImg as any).customName = "Image (No BG)";
          canvas.remove(obj);
          canvas.add(newImg);
          canvas.setActiveObject(newImg);
          canvas.renderAll();
          pushState();
          refreshLayers();
          setDirty(true);
        }
        toast({ title: "Background removed!" });
      }
    } catch (e) {
      toast({
        title: "Background removal failed",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setIsProcessingAI(false);
    }
  };

  const canEraserUndo = eraserHistoryIndexRef.current > 0;
  const canEraserRedo =
    eraserHistoryIndexRef.current < eraserHistoryRef.current.length - 1;

  return (
    <div className="p-3 space-y-4 text-sm">
      <h3 className="text-sm font-semibold flex items-center gap-1.5">
        <Eraser className="h-4 w-4 text-brand-500" />
        Background Removal
      </h3>

      {/* AI Remove section */}
      <div className="space-y-2">
        <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/50">
          <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Select an image on the canvas, then use AI to auto-remove background or manually edit
            with eraser tools.
          </p>
        </div>

        <Button
          onClick={handleAIRemove}
          disabled={isProcessingAI}
          className="w-full gap-2 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700"
          size="sm"
        >
          {isProcessingAI ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {isProcessingAI ? "Removing..." : "AI Remove Background"}
        </Button>
      </div>

      <div className="border-t pt-3">
        <p className="text-xs font-medium mb-2">Manual Editing</p>

        {!isEditing ? (
          <Button onClick={startEditing} variant="outline" className="w-full gap-2" size="sm">
            <Eraser className="h-4 w-4" />
            Start Manual Editing
          </Button>
        ) : (
          <div className="space-y-3">
            {/* Tool mode toggle (matches main page) */}
            <div className="flex gap-0.5 border border-border/50 rounded-lg p-0.5 bg-muted/30">
              <Button
                variant={toolMode === "erase" ? "default" : "ghost"}
                size="sm"
                onClick={() => setToolMode("erase")}
                className={`flex-1 h-8 text-xs ${
                  toolMode === "erase"
                    ? "bg-brand-500 hover:bg-brand-600 text-white shadow-sm"
                    : ""
                }`}
              >
                <Eraser className="w-3.5 h-3.5 mr-1.5" />
                Erase
              </Button>
              <Button
                variant={toolMode === "restore" ? "default" : "ghost"}
                size="sm"
                onClick={() => setToolMode("restore")}
                className={`flex-1 h-8 text-xs ${
                  toolMode === "restore"
                    ? "bg-brand-500 hover:bg-brand-600 text-white shadow-sm"
                    : ""
                }`}
              >
                <Paintbrush className="w-3.5 h-3.5 mr-1.5" />
                Restore
              </Button>
              <Button
                variant={toolMode === "magic" ? "default" : "ghost"}
                size="sm"
                onClick={() => setToolMode("magic")}
                className={`flex-1 h-8 text-xs ${
                  toolMode === "magic"
                    ? "bg-brand-500 hover:bg-brand-600 text-white shadow-sm"
                    : ""
                }`}
              >
                <Wand2 className="w-3.5 h-3.5 mr-1.5" />
                Magic
              </Button>
            </div>

            {/* Brush size / Tolerance controls */}
            {toolMode === "magic" ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Tolerance</span>
                  <span className="text-xs font-mono font-semibold">{tolerance}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setTolerance((t) => Math.max(0, t - 5))}
                    className="p-1 rounded-md hover:bg-muted transition-colors"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={tolerance}
                    onChange={(e) => setTolerance(Number(e.target.value))}
                    className="flex-1 h-1.5 accent-brand-500"
                  />
                  <button
                    onClick={() => setTolerance((t) => Math.min(100, t + 5))}
                    className="p-1 rounded-md hover:bg-muted transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Click on a color area to remove similar pixels
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Brush Size</span>
                  <span className="text-xs font-mono font-semibold">{brushSize}px</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setBrushSize((s) => Math.max(BRUSH_MIN, s - 5))}
                    className="p-1 rounded-md hover:bg-muted transition-colors"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="range"
                    min={BRUSH_MIN}
                    max={BRUSH_MAX}
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="flex-1 h-1.5 accent-brand-500"
                  />
                  <button
                    onClick={() => setBrushSize((s) => Math.min(BRUSH_MAX, s + 5))}
                    className="p-1 rounded-md hover:bg-muted transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            {/* Undo/Redo for eraser */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={eraserUndo}
                disabled={!canEraserUndo}
                title="Undo eraser (Ctrl+Z)"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={eraserRedo}
                disabled={!canEraserRedo}
                title="Redo eraser (Ctrl+Shift+Z)"
              >
                <Redo2 className="h-3.5 w-3.5" />
              </Button>
              <span className="text-[10px] text-muted-foreground ml-1">
                {toolMode === "erase" && "E"}
                {toolMode === "restore" && "R"}
                {toolMode === "magic" && "M"} · [ ] resize
              </span>
            </div>

            {/* Done button */}
            <Button onClick={finishEditing} className="w-full gap-2" size="sm">
              <Check className="h-4 w-4" />
              Done Editing
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
