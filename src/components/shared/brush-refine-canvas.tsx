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
  const [brushSize, setBrushSize] = useState(24);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [zoom, setZoom] = useState(1);

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

      // Initial history snapshot
      const initial = ctx.getImageData(0, 0, w, h);
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
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    },
    []
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

  // ─── Mouse event handlers ───
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return; // Left click only
      isDrawingRef.current = true;
      const point = getCanvasPoint(e.clientX, e.clientY);
      lastPointRef.current = point;
      drawDot(point);
    },
    [getCanvasPoint, drawDot]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // Always update cursor position
      const displayPt = getDisplayPoint(e.clientX, e.clientY);
      setCursorPos(displayPt);

      if (!isDrawingRef.current || !lastPointRef.current) return;
      const point = getCanvasPoint(e.clientX, e.clientY);
      drawEraserStroke(lastPointRef.current, point);
      lastPointRef.current = point;
    },
    [getCanvasPoint, getDisplayPoint, drawEraserStroke]
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
      isDrawingRef.current = true;
      const point = getCanvasPoint(touch.clientX, touch.clientY);
      lastPointRef.current = point;
      drawDot(point);
    },
    [getCanvasPoint, drawDot]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (!isDrawingRef.current || !lastPointRef.current) return;
      const touch = e.touches[0];
      const point = getCanvasPoint(touch.clientX, touch.clientY);
      drawEraserStroke(lastPointRef.current, point);
      lastPointRef.current = point;
    },
    [getCanvasPoint, drawEraserStroke]
  );

  const handleTouchEnd = useCallback(() => {
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      lastPointRef.current = null;
      pushHistory();
    }
  }, [pushHistory]);

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
      // Brush size: [ and ]
      if (e.key === "[") {
        setBrushSize((s) => Math.max(BRUSH_MIN, s - BRUSH_STEP));
      }
      if (e.key === "]") {
        setBrushSize((s) => Math.min(BRUSH_MAX, s + BRUSH_STEP));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

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
          <Eraser className="w-4 h-4 text-brand-500" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">Refine Edges</h3>
          <p className="text-[11px] text-muted-foreground">
            Paint over leftover areas to erase them
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
          style={checkerboardStyle}
          onMouseLeave={() => setCursorPos(null)}
        >
          <canvas
            ref={canvasRef}
            className="block"
            style={{
              cursor: "none",
              maxWidth: zoom === 1 ? `${maxDisplaySize}px` : "none",
              maxHeight: zoom === 1 ? "55vh" : "none",
              width: zoom !== 1 ? `${zoom * 100}%` : undefined,
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
          {/* Brush cursor preview */}
          {cursorPos && (
            <div
              className="absolute rounded-full border-2 border-white pointer-events-none"
              style={{
                left: cursorPos.x - brushSize / 2,
                top: cursorPos.y - brushSize / 2,
                width: brushSize,
                height: brushSize,
                boxShadow: "0 0 0 1px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(0,0,0,0.15)",
                transition: "width 0.1s, height 0.1s, left 0.02s, top 0.02s",
              }}
            />
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
        {/* Brush size */}
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Eraser className="w-4 h-4 text-muted-foreground shrink-0" />
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
          <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">Ctrl+Z</kbd> undo
        </span>
        <span>
          <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">Ctrl+Shift+Z</kbd> redo
        </span>
        <span>
          <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">[</kbd>{" "}
          <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">]</kbd> brush size
        </span>
      </p>
    </div>
  );
}
