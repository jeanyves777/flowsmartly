"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Eraser,
  Minus,
  Plus,
  Undo2,
  Redo2,
  Check,
  Loader2,
  ZoomIn,
  ZoomOut,
  Wand2,
  Paintbrush,
} from "lucide-react";

// ─── Checkerboard CSS for transparency visualization ───
const checkerboardStyle: React.CSSProperties = {
  backgroundImage: `
    linear-gradient(45deg, hsl(var(--muted)) 25%, transparent 25%),
    linear-gradient(-45deg, hsl(var(--muted)) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, hsl(var(--muted)) 75%),
    linear-gradient(-45deg, transparent 75%, hsl(var(--muted)) 75%)
  `,
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
};

// ─── Props ───
export interface BrushRefineCanvasProps {
  imageUrl: string;
  onSave: (newUrl: string) => void;
  onCancel: () => void;
  maxDisplaySize?: number;
}

// ─── Constants ───
const MAX_CANVAS_DIM = 2048;
const MAX_HISTORY = 20;
const BRUSH_MIN = 2;
const BRUSH_MAX = 100;
const BRUSH_STEP = 5;

export default function BrushRefineCanvas({
  imageUrl,
  onSave,
  onCancel,
  maxDisplaySize = 800,
}: BrushRefineCanvasProps) {
  const { toast } = useToast();

  // ─── Refs ───
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const isDrawingRef = useRef(false);

  // ─── State ───
  const [toolMode, setToolMode] = useState<"brush" | "magic" | "restore">("brush");
  const [brushSize, setBrushSize] = useState(24);
  const [tolerance, setTolerance] = useState(32);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [zoom, setZoom] = useState(1);

  // ─── Animation frame for smooth cursor ───
  const rafRef = useRef<number | null>(null);

  // ─── Original image for restore ───
  const originalImageDataRef = useRef<ImageData | null>(null);

  // ─── Image loading ───
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctxRef.current = ctx;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // Cap resolution
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > MAX_CANVAS_DIM || h > MAX_CANVAS_DIM) {
        const scale = MAX_CANVAS_DIM / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }

      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);

      // Save original image data for restore
      const initial = ctx.getImageData(0, 0, w, h);
      originalImageDataRef.current = ctx.getImageData(0, 0, w, h);
      setHistory([initial]);
      setHistoryIndex(0);
      setIsLoaded(true);
    };
    img.onerror = () => {
      toast({ title: "Failed to load image for refinement", variant: "destructive" });
    };
    img.src = imageUrl;
  }, [imageUrl, toast]);

  // ─── Coordinate translation ───
  const getCanvasPoint = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      // Account for CSS transform zoom
      const scaleX = canvas.width / (rect.width / zoom);
      const scaleY = canvas.height / (rect.height / zoom);
      return {
        x: ((clientX - rect.left) / zoom) * scaleX,
        y: ((clientY - rect.top) / zoom) * scaleY,
      };
    },
    [zoom]
  );

  // Display-space cursor position relative to container
  const getDisplayPoint = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    },
    []
  );

  // ─── History management ───
  const pushHistory = useCallback(() => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory((prev) => {
      const trimmed = prev.slice(0, historyIndex + 1);
      const next = [...trimmed, snapshot].slice(-MAX_HISTORY);
      return next;
    });
    setHistoryIndex((prev) => Math.min(prev + 1, MAX_HISTORY - 1));
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.putImageData(history[newIndex], 0, 0);
    setHistoryIndex(newIndex);
  }, [historyIndex, history]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.putImageData(history[newIndex], 0, 0);
    setHistoryIndex(newIndex);
  }, [historyIndex, history]);

  // ─── Brush drawing ───
  const drawEraserStroke = useCallback(
    (from: { x: number; y: number }, to: { x: number; y: number }) => {
      const ctx = ctxRef.current;
      const canvas = canvasRef.current;
      if (!ctx || !canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaledBrush = brushSize * (canvas.width / rect.width);

      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = scaledBrush;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.restore();
    },
    [brushSize]
  );

  const drawDot = useCallback(
    (point: { x: number; y: number }) => {
      const ctx = ctxRef.current;
      const canvas = canvasRef.current;
      if (!ctx || !canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaledBrush = brushSize * (canvas.width / rect.width);

      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(point.x, point.y, scaledBrush / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
    [brushSize]
  );

  // ─── Restore brush drawing ───
  const drawRestoreStroke = useCallback(
    (from: { x: number; y: number }, to: { x: number; y: number }) => {
      const ctx = ctxRef.current;
      const canvas = canvasRef.current;
      const original = originalImageDataRef.current;
      if (!ctx || !canvas || !original) return;

      const rect = canvas.getBoundingClientRect();
      const scaledBrush = brushSize * (canvas.width / rect.width);

      // Create a temporary canvas for the restore brush
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext("2d")!;
      tempCtx.putImageData(original, 0, 0);

      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = scaledBrush;

      // Create circular clipping path for the stroke
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = ctx.createPattern(tempCanvas, "no-repeat") as CanvasPattern;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.restore();
    },
    [brushSize]
  );

  const drawRestoreDot = useCallback(
    (point: { x: number; y: number }) => {
      const ctx = ctxRef.current;
      const canvas = canvasRef.current;
      const original = originalImageDataRef.current;
      if (!ctx || !canvas || !original) return;

      const rect = canvas.getBoundingClientRect();
      const scaledBrush = brushSize * (canvas.width / rect.width);
      const radius = scaledBrush / 2;

      // Get pixels from original in the brush area
      const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const { data: currentData } = current;
      const { data: originalData } = original;

      for (let y = Math.floor(point.y - radius); y < Math.ceil(point.y + radius); y++) {
        for (let x = Math.floor(point.x - radius); x < Math.ceil(point.x + radius); x++) {
          if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) continue;

          const dx = x - point.x;
          const dy = y - point.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist <= radius) {
            const pos = (y * canvas.width + x) * 4;
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

  // ─── Magic wand flood fill ───
  const magicRemove = useCallback(
    (point: { x: number; y: number }) => {
      const ctx = ctxRef.current;
      const canvas = canvasRef.current;
      if (!ctx || !canvas) return;

      const x = Math.floor(point.x);
      const y = Math.floor(point.y);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const { data, width, height } = imageData;

      // Get start pixel color
      const startPos = (y * width + x) * 4;
      const startR = data[startPos];
      const startG = data[startPos + 1];
      const startB = data[startPos + 2];
      const startA = data[startPos + 3];

      // Skip if already transparent
      if (startA < 10) return;

      // Color matching function
      const matches = (pos: number): boolean => {
        const r = data[pos];
        const g = data[pos + 1];
        const b = data[pos + 2];
        const a = data[pos + 3];

        // Must have some opacity
        if (a < 10) return false;

        // Check color distance
        const dr = Math.abs(r - startR);
        const dg = Math.abs(g - startG);
        const db = Math.abs(b - startB);
        const da = Math.abs(a - startA);

        return dr <= tolerance && dg <= tolerance && db <= tolerance && da <= tolerance;
      };

      // Flood fill with stack
      const stack: Array<[number, number]> = [[x, y]];
      const visited = new Set<number>();
      const getKey = (px: number, py: number) => py * width + px;

      while (stack.length > 0) {
        const [px, py] = stack.pop()!;
        const key = getKey(px, py);

        if (visited.has(key)) continue;
        if (px < 0 || px >= width || py < 0 || py >= height) continue;

        const pos = (py * width + px) * 4;
        if (!matches(pos)) continue;

        visited.add(key);

        // Make transparent
        data[pos + 3] = 0;

        // Add neighbors
        stack.push([px + 1, py]);
        stack.push([px - 1, py]);
        stack.push([px, py + 1]);
        stack.push([px, py - 1]);
      }

      ctx.putImageData(imageData, 0, 0);
    },
    [tolerance]
  );

  // ─── Mouse event handlers ───
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return; // Left click only
      const point = getCanvasPoint(e.clientX, e.clientY);

      if (toolMode === "magic") {
        // Magic wand: single click removes area
        magicRemove(point);
        pushHistory();
      } else if (toolMode === "restore") {
        // Restore mode: start drawing
        isDrawingRef.current = true;
        lastPointRef.current = point;
        drawRestoreDot(point);
      } else {
        // Brush mode: start drawing
        isDrawingRef.current = true;
        lastPointRef.current = point;
        drawDot(point);
      }
    },
    [getCanvasPoint, drawDot, drawRestoreDot, magicRemove, pushHistory, toolMode]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // Use RAF for smooth cursor updates (avoid lag)
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = requestAnimationFrame(() => {
        const displayPt = getDisplayPoint(e.clientX, e.clientY);
        setCursorPos(displayPt);
      });

      // Only draw if in drawing mode
      if (toolMode === "magic" || !isDrawingRef.current || !lastPointRef.current) return;

      const point = getCanvasPoint(e.clientX, e.clientY);
      if (toolMode === "restore") {
        drawRestoreStroke(lastPointRef.current, point);
      } else {
        drawEraserStroke(lastPointRef.current, point);
      }
      lastPointRef.current = point;
    },
    [getCanvasPoint, getDisplayPoint, drawEraserStroke, drawRestoreStroke, toolMode]
  );

  const handleMouseUp = useCallback(() => {
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      lastPointRef.current = null;
      pushHistory();
    }
  }, [pushHistory]);

  const handleMouseLeave = useCallback(() => {
    setCursorPos(null);
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      lastPointRef.current = null;
      pushHistory();
    }
  }, [pushHistory]);

  // ─── Touch event handlers ───
  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const touch = e.touches[0];
      const point = getCanvasPoint(touch.clientX, touch.clientY);

      if (toolMode === "magic") {
        magicRemove(point);
        pushHistory();
      } else if (toolMode === "restore") {
        isDrawingRef.current = true;
        lastPointRef.current = point;
        drawRestoreDot(point);
      } else {
        isDrawingRef.current = true;
        lastPointRef.current = point;
        drawDot(point);
      }
    },
    [getCanvasPoint, drawDot, drawRestoreDot, magicRemove, pushHistory, toolMode]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (toolMode === "magic" || !isDrawingRef.current || !lastPointRef.current) return;
      const touch = e.touches[0];
      const point = getCanvasPoint(touch.clientX, touch.clientY);
      if (toolMode === "restore") {
        drawRestoreStroke(lastPointRef.current, point);
      } else {
        drawEraserStroke(lastPointRef.current, point);
      }
      lastPointRef.current = point;
    },
    [getCanvasPoint, drawEraserStroke, drawRestoreStroke, toolMode]
  );

  const handleTouchEnd = useCallback(() => {
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      lastPointRef.current = null;
      pushHistory();
    }
  }, [pushHistory]);

  // ─── Cleanup RAF on unmount ───
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // ─── Keyboard shortcuts ───
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo: Ctrl+Z / Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Redo: Ctrl+Shift+Z / Cmd+Shift+Z
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      }
      // Tool mode: B for brush, M for magic, R for restore
      if (e.key.toLowerCase() === "b") {
        setToolMode("brush");
      }
      if (e.key.toLowerCase() === "m") {
        setToolMode("magic");
      }
      if (e.key.toLowerCase() === "r") {
        setToolMode("restore");
      }
      // Brush size: [ and ]
      if (e.key === "[") {
        if (toolMode === "brush") {
          setBrushSize((s) => Math.max(BRUSH_MIN, s - BRUSH_STEP));
        } else {
          setTolerance((t) => Math.max(0, t - 5));
        }
      }
      if (e.key === "]") {
        if (toolMode === "brush") {
          setBrushSize((s) => Math.min(BRUSH_MAX, s + BRUSH_STEP));
        } else {
          setTolerance((t) => Math.min(100, t + 5));
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, toolMode]);

  // ─── Zoom controls ───
  const zoomIn = () => setZoom((z) => Math.min(3, z + 0.25));
  const zoomOut = () => setZoom((z) => Math.max(0.5, z - 0.25));

  // ─── Save handler ───
  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsSaving(true);

    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Canvas export failed"))),
          "image/png"
        );
      });

      const formData = new FormData();
      formData.append("file", blob, `bg-refined-${Date.now()}.png`);

      const res = await fetch("/api/media", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Upload failed");
      }

      const newUrl = data.data?.file?.url || data.data?.url;
      if (!newUrl) throw new Error("No URL returned from upload");

      toast({ title: "Refinement saved!" });
      onSave(newUrl);
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = historyIndex > 0;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-brand-500/10">
          {toolMode === "brush" ? (
            <Eraser className="w-4 h-4 text-brand-500" />
          ) : toolMode === "restore" ? (
            <Paintbrush className="w-4 h-4 text-brand-500" />
          ) : (
            <Wand2 className="w-4 h-4 text-brand-500" />
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold">Refine Background</h3>
          <p className="text-[11px] text-muted-foreground">
            {toolMode === "brush"
              ? "Paint over areas to erase them"
              : toolMode === "restore"
              ? "Paint to restore original pixels"
              : "Click similar areas to remove them"}
          </p>
        </div>
      </div>

      {/* Canvas container */}
      <div
        ref={containerRef}
        className="relative rounded-xl overflow-auto border border-border bg-background"
        style={{ maxHeight: "60vh" }}
      >
        <div
          className="relative inline-block"
          style={{
            ...checkerboardStyle,
            transformOrigin: "top left",
          }}
          onMouseLeave={() => setCursorPos(null)}
        >
          <canvas
            ref={canvasRef}
            className="block"
            style={{
              cursor: "none",
              maxWidth: `${maxDisplaySize}px`,
              maxHeight: "55vh",
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
              touchAction: "none",
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />
          {/* Cursor preview */}
          {cursorPos && (
            <div
              className="absolute pointer-events-none"
              style={{
                left: toolMode === "magic" ? cursorPos.x - 12 : cursorPos.x - brushSize / 2,
                top: toolMode === "magic" ? cursorPos.y - 12 : cursorPos.y - brushSize / 2,
                width: toolMode === "magic" ? 24 : brushSize,
                height: toolMode === "magic" ? 24 : brushSize,
                border: toolMode === "restore" ? "2px solid #10b981" : "2px solid white",
                borderRadius: toolMode === "magic" ? "0%" : "50%",
                boxShadow: "0 0 0 1px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(0,0,0,0.15)",
                transition: "width 0.1s, height 0.1s",
                backgroundColor: toolMode === "restore" ? "rgba(16, 185, 129, 0.1)" : undefined,
              }}
            >
              {toolMode === "magic" && (
                <Wand2 className="w-full h-full p-1 text-white drop-shadow-md" />
              )}
            </div>
          )}

          {/* Loading overlay */}
          {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Tool mode toggle */}
        <div className="flex gap-1 border border-border rounded-lg p-0.5">
          <Button
            variant={toolMode === "brush" ? "default" : "ghost"}
            size="sm"
            onClick={() => setToolMode("brush")}
            className="h-7 px-3"
          >
            <Eraser className="w-3.5 h-3.5 mr-1.5" />
            Erase
          </Button>
          <Button
            variant={toolMode === "restore" ? "default" : "ghost"}
            size="sm"
            onClick={() => setToolMode("restore")}
            className="h-7 px-3"
          >
            <Paintbrush className="w-3.5 h-3.5 mr-1.5" />
            Restore
          </Button>
          <Button
            variant={toolMode === "magic" ? "default" : "ghost"}
            size="sm"
            onClick={() => setToolMode("magic")}
            className="h-7 px-3"
          >
            <Wand2 className="w-3.5 h-3.5 mr-1.5" />
            Magic
          </Button>
        </div>

        {/* Brush size (for brush and restore modes) */}
        {(toolMode === "brush" || toolMode === "restore") && (
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <span className="text-xs text-muted-foreground shrink-0">Size</span>
            <button
              onClick={() => setBrushSize((s) => Math.max(BRUSH_MIN, s - BRUSH_STEP))}
              className="p-1 rounded hover:bg-muted"
            >
              <Minus className="w-3 h-3 text-muted-foreground" />
            </button>
            <input
              type="range"
              min={BRUSH_MIN}
              max={BRUSH_MAX}
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="flex-1 h-1.5 bg-muted rounded-lg appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-brand-500
                [&::-webkit-slider-thumb]:shadow-md
                [&::-webkit-slider-thumb]:cursor-pointer
                [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4
                [&::-moz-range-thumb]:rounded-full
                [&::-moz-range-thumb]:bg-brand-500
                [&::-moz-range-thumb]:border-0
                [&::-moz-range-thumb]:shadow-md
                [&::-moz-range-thumb]:cursor-pointer"
            />
            <button
              onClick={() => setBrushSize((s) => Math.min(BRUSH_MAX, s + BRUSH_STEP))}
              className="p-1 rounded hover:bg-muted"
            >
              <Plus className="w-3 h-3 text-muted-foreground" />
            </button>
            <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">
              {brushSize}px
            </span>
          </div>
        )}

        {/* Tolerance (only in magic mode) */}
        {toolMode === "magic" && (
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <span className="text-xs text-muted-foreground shrink-0">Tolerance</span>
            <button
              onClick={() => setTolerance((t) => Math.max(0, t - 5))}
              className="p-1 rounded hover:bg-muted"
            >
              <Minus className="w-3 h-3 text-muted-foreground" />
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={tolerance}
              onChange={(e) => setTolerance(Number(e.target.value))}
              className="flex-1 h-1.5 bg-muted rounded-lg appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-brand-500
                [&::-webkit-slider-thumb]:shadow-md
                [&::-webkit-slider-thumb]:cursor-pointer
                [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4
                [&::-moz-range-thumb]:rounded-full
                [&::-moz-range-thumb]:bg-brand-500
                [&::-moz-range-thumb]:border-0
                [&::-moz-range-thumb]:shadow-md
                [&::-moz-range-thumb]:cursor-pointer"
            />
            <button
              onClick={() => setTolerance((t) => Math.min(100, t + 5))}
              className="p-1 rounded hover:bg-muted"
            >
              <Plus className="w-3 h-3 text-muted-foreground" />
            </button>
            <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">
              {tolerance}
            </span>
          </div>
        )}

        {/* Zoom */}
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={zoomOut} disabled={zoom <= 0.5}>
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={zoomIn} disabled={zoom >= 3}>
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Undo/Redo */}
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={undo}
            disabled={historyIndex <= 0}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Actions */}
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="bg-brand-500 hover:bg-brand-600 text-white"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Check className="w-4 h-4 mr-1.5" />
            )}
            Save
          </Button>
        </div>
      </div>

      {/* Keyboard hints */}
      <p className="text-[11px] text-muted-foreground text-center space-x-2">
        <span>
          <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">B</kbd> erase
        </span>
        <span>
          <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">R</kbd> restore
        </span>
        <span>
          <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">M</kbd> magic
        </span>
        <span>
          <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">Ctrl+Z</kbd> undo
        </span>
        <span>
          <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">[</kbd>{" "}
          <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">]</kbd>{" "}
          {toolMode === "magic" ? "tolerance" : "size"}
        </span>
      </p>
    </div>
  );
}
