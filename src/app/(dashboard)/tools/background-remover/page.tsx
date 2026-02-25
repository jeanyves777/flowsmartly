"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Scissors,
  Download,
  Sparkles,
  ImageIcon,
  Upload,
  X,
  Wand2,
  Eraser,
  Paintbrush,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Loader2,
  Plus,
  Minus,
  Layers,
  Check,
  Clapperboard,
  Mic,
  Palette,
  Film,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MediaUploader } from "@/components/shared/media-uploader";
import { AIGenerationLoader } from "@/components/shared/ai-generation-loader";

// ── Types ──────────────────────────────────────────────────────────────────────

interface GalleryImage {
  id: string;
  originalUrl: string;
  processedUrl?: string;
  createdAt: Date;
}

type ToolMode = "erase" | "restore" | "magic";

// ── Constants ──────────────────────────────────────────────────────────────────

const MAX_CANVAS_DIM = 2048;
const MAX_HISTORY = 20;
const BRUSH_MIN = 5;
const BRUSH_MAX = 150;

// ── Checkerboard ───────────────────────────────────────────────────────────────

const checkerboardStyle: React.CSSProperties = {
  backgroundImage: `linear-gradient(45deg, hsl(var(--muted)) 25%, transparent 25%),
    linear-gradient(-45deg, hsl(var(--muted)) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, hsl(var(--muted)) 75%),
    linear-gradient(-45deg, transparent 75%, hsl(var(--muted)) 75%)`,
  backgroundSize: "20px 20px",
  backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
};

// ── AI Creative Tools ──────────────────────────────────────────────────────────

const AI_TOOLS = [
  {
    name: "AI Studio",
    href: "/studio",
    icon: Palette,
  },
  {
    name: "Cartoon Maker",
    href: "/cartoon-maker",
    icon: Clapperboard,
  },
  {
    name: "Video Studio",
    href: "/video-studio",
    icon: Film,
  },
  {
    name: "Voice Studio",
    href: "/voice-studio",
    icon: Mic,
  },
  {
    name: "Background Remover",
    href: "/tools/background-remover",
    icon: Scissors,
    active: true,
  },
];

// ── Main Component ─────────────────────────────────────────────────────────────

export default function BackgroundRemoverStudio() {
  const { toast } = useToast();

  // ─── Gallery state ───
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
  const [uploadUrls, setUploadUrls] = useState<string[]>([]);
  const [showUploader, setShowUploader] = useState(false);

  // ─── Canvas refs ───
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const originalImageDataRef = useRef<ImageData | null>(null);

  // ─── Canvas state ───
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toolMode, setToolMode] = useState<ToolMode>("erase");
  const [brushSize, setBrushSize] = useState(30);
  const [tolerance, setTolerance] = useState(32);
  const [zoom, setZoom] = useState(1);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  // ─── Drawing state ───
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  // ─── AI processing state ───
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [aiStep, setAiStep] = useState("");

  // ─── Load image into canvas - SIMPLIFIED ───
  useEffect(() => {
    if (!selectedImage) {
      setIsLoaded(false);
      setLoadError(null);
      return;
    }

    // Wait for canvas to be available
    const waitForCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        console.log("[Canvas] Waiting for canvas ref...");
        setTimeout(waitForCanvas, 50);
        return;
      }

      console.log("[Canvas] Canvas ref available!");

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        console.error("[Canvas] Canvas context not available");
        setLoadError("Canvas context failed");
        return;
      }
      ctxRef.current = ctx;

      // Start loading image
      loadImage(canvas, ctx);
    };

    const loadImage = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {

      let isCancelled = false;

      setIsLoaded(false);
      setLoadError(null);

      const imageUrl = selectedImage.processedUrl || selectedImage.originalUrl;
      console.log("[Load] Starting image load:", imageUrl);
      console.log("[Load] Image ID:", selectedImage.id);

      const img = new Image();

      // Simple CORS handling
      img.crossOrigin = "anonymous";

      const loadTimeout = setTimeout(() => {
        if (!isCancelled) {
          console.error("[Load] Timeout after 30s");
          setLoadError("Image load timeout");
          toast({
            title: "Load timeout",
            description: "Image took too long to load",
            variant: "destructive",
          });
        }
      }, 30000);

      img.onload = () => {
        if (isCancelled) return;
        clearTimeout(loadTimeout);

        console.log("[Load] ✓ Image loaded successfully");
        console.log("[Load] Natural size:", img.naturalWidth, "x", img.naturalHeight);

        try {
          // Calculate size
          let w = img.naturalWidth;
          let h = img.naturalHeight;

          if (w > MAX_CANVAS_DIM || h > MAX_CANVAS_DIM) {
            const scale = MAX_CANVAS_DIM / Math.max(w, h);
            w = Math.round(w * scale);
            h = Math.round(h * scale);
            console.log("[Load] Scaled to:", w, "x", h);
          }

          // Set canvas size
          canvas.width = w;
          canvas.height = h;
          console.log("[Load] Canvas size set");

          // Clear and draw
          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          console.log("[Load] Image drawn to canvas");

          // Save original
          const initial = ctx.getImageData(0, 0, w, h);
          originalImageDataRef.current = ctx.getImageData(0, 0, w, h);
          setHistory([initial]);
          setHistoryIndex(0);
          setZoom(1);
          setIsLoaded(true);
          setLoadError(null);

          console.log("[Load] ✓✓✓ CANVAS READY ✓✓✓");
        } catch (error) {
          console.error("[Load] Error processing image:", error);
          setLoadError(error instanceof Error ? error.message : "Processing failed");
        }
      };

      img.onerror = (e) => {
        if (isCancelled) return;
        clearTimeout(loadTimeout);

        console.error("[Load] ✗ Image load error:", e);
        console.error("[Load] Failed URL:", imageUrl);

        setLoadError("Failed to load image");
        toast({
          title: "Failed to load image",
          description: "Please try another image or check the URL",
          variant: "destructive",
        });
      };

      // Set src LAST
      console.log("[Load] Setting img.src...");
      img.src = imageUrl;

      return () => {
        isCancelled = true;
      };
    };

    // Start waiting for canvas
    waitForCanvas();
  }, [selectedImage, toast]);

  // ─── Coordinate translation ───
  const getCanvasPoint = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / (rect.width / zoom);
      const scaleY = canvas.height / (rect.height / zoom);
      return {
        x: ((clientX - rect.left) / zoom) * scaleX,
        y: ((clientY - rect.top) / zoom) * scaleY,
      };
    },
    [zoom]
  );

  const getDisplayPoint = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }, []);

  // ─── History management ───
  const pushHistory = useCallback(() => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory((prev) => {
      const trimmed = prev.slice(0, historyIndex + 1);
      return [...trimmed, snapshot].slice(-MAX_HISTORY);
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

  // ─── Drawing functions ───
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

  const drawEraserDot = useCallback(
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

  const drawRestoreDot = useCallback(
    (point: { x: number; y: number }) => {
      const ctx = ctxRef.current;
      const canvas = canvasRef.current;
      const original = originalImageDataRef.current;
      if (!ctx || !canvas || !original) return;

      const rect = canvas.getBoundingClientRect();
      const scaledBrush = brushSize * (canvas.width / rect.width);
      const radius = scaledBrush / 2;

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

  const drawRestoreStroke = useCallback(
    (from: { x: number; y: number }, to: { x: number; y: number }) => {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const steps = Math.max(1, Math.ceil(dist / (brushSize / 8)));

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        drawRestoreDot({
          x: from.x + dx * t,
          y: from.y + dy * t,
        });
      }
    },
    [brushSize, drawRestoreDot]
  );

  const magicRemove = useCallback(
    (point: { x: number; y: number }) => {
      const ctx = ctxRef.current;
      const canvas = canvasRef.current;
      if (!ctx || !canvas) return;

      const x = Math.floor(point.x);
      const y = Math.floor(point.y);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
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
        data[pos + 3] = 0;
        stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
      }

      ctx.putImageData(imageData, 0, 0);
    },
    [tolerance]
  );

  // ─── Mouse handlers ───
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return;
      const point = getCanvasPoint(e.clientX, e.clientY);

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
        drawEraserDot(point);
      }
    },
    [getCanvasPoint, toolMode, magicRemove, pushHistory, drawRestoreDot, drawEraserDot]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setCursorPos(getDisplayPoint(e.clientX, e.clientY));
      });

      if (toolMode === "magic" || !isDrawingRef.current || !lastPointRef.current) return;

      const point = getCanvasPoint(e.clientX, e.clientY);
      if (toolMode === "restore") {
        drawRestoreStroke(lastPointRef.current, point);
      } else {
        drawEraserStroke(lastPointRef.current, point);
      }
      lastPointRef.current = point;
    },
    [getDisplayPoint, getCanvasPoint, toolMode, drawRestoreStroke, drawEraserStroke]
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

  // ─── Upload handler ───
  const handleUploadComplete = useCallback(
    (urls: string[]) => {
      if (urls.length === 0) return;

      const newImages: GalleryImage[] = urls.map((url) => ({
        id: `${Date.now()}-${Math.random()}`,
        originalUrl: url,
        createdAt: new Date(),
      }));

      setGallery((prev) => [...newImages, ...prev]);
      setUploadUrls([]);
      setShowUploader(false);

      if (newImages.length > 0) {
        setSelectedImage(newImages[0]);
      }

      toast({ title: `${urls.length} image(s) uploaded!` });
    },
    [toast]
  );

  // ─── Gallery handlers ───
  const handleSelectImage = useCallback((img: GalleryImage) => {
    console.log("[Select] Selected image:", img.id, img.originalUrl);
    setSelectedImage(img);
  }, []);

  const handleDeleteImage = useCallback(
    (id: string) => {
      setGallery((prev) => prev.filter((img) => img.id !== id));
      if (selectedImage?.id === id) {
        setSelectedImage(null);
      }
    },
    [selectedImage]
  );

  // ─── AI Remove Background ───
  const handleAIRemove = async () => {
    if (!selectedImage) return;

    setIsProcessingAI(true);
    setAiStep("Analyzing image...");

    try {
      const t1 = setTimeout(() => setAiStep("Detecting foreground..."), 2000);
      const t2 = setTimeout(() => setAiStep("Removing background..."), 4000);
      const t3 = setTimeout(() => setAiStep("Refining edges..."), 7000);

      const res = await fetch("/api/image-tools/remove-background", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: selectedImage.originalUrl }),
      });
      const data = await res.json();

      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Background removal failed");
      }

      setGallery((prev) =>
        prev.map((img) =>
          img.id === selectedImage.id
            ? { ...img, processedUrl: data.data.imageUrl }
            : img
        )
      );

      setSelectedImage((prev) =>
        prev ? { ...prev, processedUrl: data.data.imageUrl } : null
      );

      toast({ title: "Background removed successfully!" });
    } catch (error) {
      toast({
        title: "AI removal failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsProcessingAI(false);
      setAiStep("");
    }
  };

  // ─── Download ───
  const handleDownload = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Export failed"))),
          "image/png"
        );
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `background-removed-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({ title: "Image downloaded!" });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  // ─── Save to gallery ───
  const handleSaveToGallery = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedImage) return;

    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Export failed"))),
          "image/png"
        );
      });

      const formData = new FormData();
      formData.append("file", blob, `edited-${Date.now()}.png`);

      const res = await fetch("/api/media", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Upload failed");
      }

      const newUrl = data.data?.file?.url || data.data?.url;
      if (!newUrl) throw new Error("No URL returned");

      setGallery((prev) =>
        prev.map((img) =>
          img.id === selectedImage.id ? { ...img, processedUrl: newUrl } : img
        )
      );

      setSelectedImage((prev) => (prev ? { ...prev, processedUrl: newUrl } : null));

      toast({ title: "Changes saved!" });
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    }
  };

  // ─── Keyboard shortcuts ───
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      }
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
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, toolMode]);

  // ─── Cleanup RAF ───
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const hasChanges = historyIndex > 0;

  return (
    <div className="fixed inset-0 top-16 flex flex-col bg-muted/30">
      {/* ═══ TOP AI TOOLS NAVIGATION - STICKY ═══ */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-6 py-3 shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto">
          {AI_TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.href}
                href={tool.href}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all whitespace-nowrap ${
                  tool.active
                    ? "bg-brand-500 text-white shadow-md"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{tool.name}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ═══ MAIN CONTENT - FIXED HEIGHT NO SCROLL ═══ */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ═══ LEFT SIDEBAR ═══ */}
        <div className="w-80 bg-background border-r border-border flex flex-col shrink-0">
          {/* Header */}
          <div className="p-4 border-b border-border shrink-0">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-brand-500 flex items-center justify-center shadow-md">
                <Scissors className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-lg">Background Studio</h1>
                <p className="text-xs text-muted-foreground">Professional canvas editor</p>
              </div>
            </div>
            <Button
              onClick={() => setShowUploader(!showUploader)}
              className="w-full bg-brand-500 hover:bg-brand-600 text-white"
              size="sm"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Images
            </Button>
          </div>

          {/* Uploader */}
          {showUploader && (
            <div className="p-4 border-b border-border shrink-0">
              <MediaUploader
                value={uploadUrls}
                onChange={handleUploadComplete}
                accept="image/png,image/jpeg,image/jpg,image/webp"
                maxSize={10 * 1024 * 1024}
                filterTypes={["image"]}
                variant="small"
                label="Select Images"
                placeholder="Drop images here"
                libraryTitle="Select from Library"
              />
            </div>
          )}

          {/* Gallery - SCROLLABLE */}
          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Gallery</span>
                <Badge variant="secondary" className="text-xs">
                  {gallery.length}
                </Badge>
              </div>
              {gallery.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setGallery([]);
                    setSelectedImage(null);
                  }}
                  className="h-7 text-xs"
                >
                  Clear All
                </Button>
              )}
            </div>

            {gallery.length === 0 ? (
              <div className="text-center py-12">
                <Layers className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No images yet</p>
                <p className="text-xs text-muted-foreground">Upload images to get started</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {gallery.map((img) => (
                  <div key={img.id} className="relative group">
                    <button
                      onClick={() => handleSelectImage(img)}
                      className={`relative w-full aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                        selectedImage?.id === img.id
                          ? "border-brand-500 shadow-lg shadow-brand-500/20"
                          : "border-border hover:border-brand-500/50"
                      }`}
                      style={img.processedUrl ? checkerboardStyle : undefined}
                    >
                      <img
                        src={img.processedUrl || img.originalUrl}
                        alt="Gallery item"
                        className="w-full h-full object-cover"
                      />
                      {img.processedUrl && (
                        <Badge className="absolute bottom-1 right-1 text-[10px] bg-green-500 text-white border-0">
                          Edited
                        </Badge>
                      )}
                    </button>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteImage(img.id);
                      }}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ═══ RIGHT CANVAS AREA - NO SCROLL ═══ */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Editing Toolbar */}
          <div className="bg-background border-b border-border p-3 shrink-0">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              {/* Left: Tools */}
              <div className="flex items-center gap-2 flex-wrap">
                {isLoaded && (
                  <>
                    <div className="flex gap-1 border border-border rounded-lg p-0.5">
                      <Button
                        variant={toolMode === "erase" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setToolMode("erase")}
                        className="h-8 px-3"
                      >
                        <Eraser className="w-3.5 h-3.5 mr-1.5" />
                        Erase
                      </Button>
                      <Button
                        variant={toolMode === "restore" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setToolMode("restore")}
                        className="h-8 px-3"
                      >
                        <Paintbrush className="w-3.5 h-3.5 mr-1.5" />
                        Restore
                      </Button>
                      <Button
                        variant={toolMode === "magic" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setToolMode("magic")}
                        className="h-8 px-3"
                      >
                        <Wand2 className="w-3.5 h-3.5 mr-1.5" />
                        Magic
                      </Button>
                    </div>

                    {toolMode === "magic" ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Tolerance</span>
                        <button
                          onClick={() => setTolerance((t) => Math.max(0, t - 5))}
                          className="p-1 rounded hover:bg-muted"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={tolerance}
                          onChange={(e) => setTolerance(Number(e.target.value))}
                          className="w-24 h-1.5"
                        />
                        <button
                          onClick={() => setTolerance((t) => Math.min(100, t + 5))}
                          className="p-1 rounded hover:bg-muted"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <span className="text-xs text-muted-foreground tabular-nums w-8">
                          {tolerance}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Size</span>
                        <button
                          onClick={() => setBrushSize((s) => Math.max(BRUSH_MIN, s - 5))}
                          className="p-1 rounded hover:bg-muted"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="range"
                          min={BRUSH_MIN}
                          max={BRUSH_MAX}
                          value={brushSize}
                          onChange={(e) => setBrushSize(Number(e.target.value))}
                          className="w-24 h-1.5"
                        />
                        <button
                          onClick={() => setBrushSize((s) => Math.min(BRUSH_MAX, s + 5))}
                          className="p-1 rounded hover:bg-muted"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <span className="text-xs text-muted-foreground tabular-nums w-8">
                          {brushSize}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Center: AI & History */}
              <div className="flex items-center gap-2">
                {isLoaded && !isProcessingAI && (
                  <>
                    <Button
                      onClick={handleAIRemove}
                      className="bg-gradient-to-r from-brand-500 to-purple-600 hover:from-brand-600 hover:to-purple-700 text-white"
                      size="sm"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      AI Remove
                    </Button>

                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={undo}
                        disabled={historyIndex <= 0}
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={redo}
                        disabled={historyIndex >= history.length - 1}
                      >
                        <Redo2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-1 border border-border rounded-lg p-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
                        disabled={zoom <= 0.25}
                      >
                        <ZoomOut className="w-3 h-3" />
                      </Button>
                      <span className="text-xs text-muted-foreground tabular-nums w-10 text-center">
                        {Math.round(zoom * 100)}%
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
                        disabled={zoom >= 4}
                      >
                        <ZoomIn className="w-3 h-3" />
                      </Button>
                    </div>
                  </>
                )}
              </div>

              {/* Right: Save & Download */}
              <div className="flex items-center gap-2">
                {isLoaded && !isProcessingAI && (
                  <>
                    {hasChanges && (
                      <Button
                        onClick={handleSaveToGallery}
                        variant="outline"
                        size="sm"
                        className="border-brand-500 text-brand-500"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Save
                      </Button>
                    )}
                    <Button onClick={handleDownload} variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Canvas Area - FIXED NO SCROLL */}
          <div className="flex-1 flex items-center justify-center p-6 overflow-hidden min-h-0">
            <AnimatePresence mode="wait">
              {isProcessingAI ? (
                <AIGenerationLoader
                  currentStep={aiStep}
                  subtitle="AI is processing"
                />
              ) : !selectedImage ? (
                <div className="text-center">
                  <Scissors className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                  <h2 className="text-xl font-semibold mb-2">Select or Upload an Image</h2>
                  <p className="text-muted-foreground text-sm mb-6">
                    Choose from gallery or upload new images
                  </p>
                  <Button
                    onClick={() => setShowUploader(true)}
                    className="bg-brand-500 hover:bg-brand-600 text-white"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Images
                  </Button>
                </div>
              ) : (
                <div className="relative w-full h-full flex items-center justify-center">
                  <div
                    className="relative inline-block rounded-xl overflow-hidden border-2 border-border shadow-2xl"
                    style={checkerboardStyle}
                    onMouseLeave={() => setCursorPos(null)}
                  >
                    <canvas
                      ref={canvasRef}
                      className="block"
                      style={{
                        cursor: "none",
                        maxWidth: "calc(100vw - 400px)",
                        maxHeight: "calc(100vh - 250px)",
                        transform: `scale(${zoom})`,
                        transformOrigin: "center",
                      }}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseLeave}
                    />

                    {/* Custom cursor */}
                    {cursorPos && isLoaded && (
                      <div
                        className="absolute pointer-events-none"
                        style={{
                          left:
                            toolMode === "magic"
                              ? cursorPos.x - 12
                              : cursorPos.x - brushSize / 2,
                          top:
                            toolMode === "magic"
                              ? cursorPos.y - 12
                              : cursorPos.y - brushSize / 2,
                          width: toolMode === "magic" ? 24 : brushSize,
                          height: toolMode === "magic" ? 24 : brushSize,
                          border:
                            toolMode === "restore"
                              ? "2px solid #10b981"
                              : "2px solid white",
                          borderRadius: toolMode === "magic" ? "0%" : "50%",
                          boxShadow:
                            "0 0 0 1px rgba(0,0,0,0.3)",
                        }}
                      >
                        {toolMode === "magic" && (
                          <Wand2 className="w-full h-full p-1 text-white" />
                        )}
                      </div>
                    )}

                    {/* Loading/Error overlay */}
                    {(!isLoaded || loadError) && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/95 backdrop-blur-sm">
                        <div className="text-center p-8">
                          {loadError ? (
                            <>
                              <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
                              <p className="text-sm font-medium text-destructive mb-2">
                                {loadError}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Check browser console for details
                              </p>
                            </>
                          ) : (
                            <>
                              <Loader2 className="w-12 h-12 animate-spin text-brand-500 mx-auto mb-3" />
                              <p className="text-sm text-muted-foreground">
                                Loading image...
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
