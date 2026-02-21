"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Download,
  Check,
  Scissors,
  Eye,
  EyeOff,
  RotateCcw,
  Columns2,
  SlidersHorizontal,
  ToggleLeft,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { AIGenerationLoader } from "@/components/shared/ai-generation-loader";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface BackgroundRemoverProps {
  imageUrl: string;
  onComplete: (processedUrl: string) => void;
  open: boolean;
  onClose: () => void;
}

type ViewMode = "side-by-side" | "slider" | "toggle";

// ── Checkerboard background for transparency ────────────────────────────────

const checkerboardStyle = {
  backgroundImage: `linear-gradient(45deg, #e5e7eb 25%, transparent 25%),
    linear-gradient(-45deg, #e5e7eb 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #e5e7eb 75%),
    linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)`,
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
};

// ── Component ──────────────────────────────────────────────────────────────────

export function BackgroundRemover({
  imageUrl,
  onComplete,
  open,
  onClose,
}: BackgroundRemoverProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("side-by-side");
  const [showOriginal, setShowOriginal] = useState(false);
  const [sliderPos, setSliderPos] = useState(50);
  const [step, setStep] = useState("");
  const sliderRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setProcessedUrl(null);
      setIsProcessing(false);
      setShowOriginal(false);
      setSliderPos(50);
      setStep("");
    }
  }, [open]);

  const handleRemove = async () => {
    setIsProcessing(true);
    setProcessedUrl(null);
    setStep("Analyzing image...");

    try {
      // Simulate step progression for UX
      const stepTimer = setTimeout(() => setStep("Removing background..."), 2000);
      const stepTimer2 = setTimeout(() => setStep("Finalizing..."), 5000);

      const res = await fetch("/api/image-tools/remove-background", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });
      const data = await res.json();

      clearTimeout(stepTimer);
      clearTimeout(stepTimer2);

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Background removal failed");
      }

      setProcessedUrl(data.data.imageUrl);
      toast({ title: "Background removed successfully!" });
    } catch (error) {
      toast({
        title: "Background removal failed",
        description:
          error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setStep("");
    }
  };

  const handleDownload = () => {
    if (!processedUrl) return;
    const link = document.createElement("a");
    link.href = processedUrl;
    link.download = "background-removed.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Image downloaded!" });
  };

  const handleUse = () => {
    if (!processedUrl) return;
    onComplete(processedUrl);
    onClose();
  };

  // Slider drag handlers
  const handleSliderMove = useCallback((clientX: number) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(pct);
  }, []);

  const handleMouseDown = useCallback(() => {
    isDragging.current = true;
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging.current) handleSliderMove(e.clientX);
    },
    [handleSliderMove]
  );

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches[0]) handleSliderMove(e.touches[0].clientX);
    },
    [handleSliderMove]
  );

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl w-[90vw] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
              <Scissors className="w-4 h-4 text-white" />
            </div>
            Remove Background
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Processing state with premium loader */}
          {isProcessing && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-8"
            >
              <AIGenerationLoader
                currentStep={step}
                subtitle="This usually takes 5-15 seconds"
                compact
              />
            </motion.div>
          )}

          {/* Before/after comparison */}
          {!isProcessing && (
            <AnimatePresence mode="wait">
              {processedUrl ? (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  {/* View mode toggle */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      Comparison View
                    </span>
                    <div className="flex gap-1 bg-muted rounded-lg p-0.5">
                      <button
                        onClick={() => setViewMode("side-by-side")}
                        className={`p-1.5 rounded-md transition-colors ${
                          viewMode === "side-by-side"
                            ? "bg-background shadow-sm text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        title="Side by side"
                      >
                        <Columns2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setViewMode("slider")}
                        className={`p-1.5 rounded-md transition-colors ${
                          viewMode === "slider"
                            ? "bg-background shadow-sm text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        title="Slider comparison"
                      >
                        <SlidersHorizontal className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setViewMode("toggle");
                          setShowOriginal(false);
                        }}
                        className={`p-1.5 rounded-md transition-colors ${
                          viewMode === "toggle"
                            ? "bg-background shadow-sm text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        title="Toggle view"
                      >
                        <ToggleLeft className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Side-by-side view */}
                  {viewMode === "side-by-side" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <span className="text-xs font-medium text-muted-foreground">
                          Original
                        </span>
                        <div className="aspect-square rounded-lg overflow-hidden border bg-muted">
                          <img
                            src={imageUrl}
                            alt="Original"
                            className="w-full h-full object-contain"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <span className="text-xs font-medium text-brand-500">
                          Background Removed
                        </span>
                        <div
                          className="aspect-square rounded-lg overflow-hidden border"
                          style={checkerboardStyle}
                        >
                          <img
                            src={processedUrl}
                            alt="Processed"
                            className="w-full h-full object-contain"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Slider view */}
                  {viewMode === "slider" && (
                    <div
                      ref={sliderRef}
                      className="relative aspect-[4/3] rounded-lg overflow-hidden border cursor-col-resize select-none"
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                      onTouchMove={handleTouchMove}
                      onClick={(e) => handleSliderMove(e.clientX)}
                    >
                      {/* Processed (background, full) */}
                      <div
                        className="absolute inset-0"
                        style={checkerboardStyle}
                      >
                        <img
                          src={processedUrl}
                          alt="Processed"
                          className="w-full h-full object-contain"
                        />
                      </div>

                      {/* Original (foreground, clipped) */}
                      <div
                        className="absolute inset-0 bg-muted"
                        style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
                      >
                        <img
                          src={imageUrl}
                          alt="Original"
                          className="w-full h-full object-contain"
                        />
                      </div>

                      {/* Slider line */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-10"
                        style={{ left: `${sliderPos}%` }}
                      >
                        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center">
                          <SlidersHorizontal className="w-4 h-4 text-gray-600" />
                        </div>
                      </div>

                      {/* Labels */}
                      <span className="absolute top-2 left-2 text-[10px] font-bold bg-black/60 text-white rounded px-1.5 py-0.5">
                        ORIGINAL
                      </span>
                      <span className="absolute top-2 right-2 text-[10px] font-bold bg-brand-500/80 text-white rounded px-1.5 py-0.5">
                        REMOVED
                      </span>
                    </div>
                  )}

                  {/* Toggle view */}
                  {viewMode === "toggle" && (
                    <div
                      className="relative aspect-[4/3] rounded-lg overflow-hidden border cursor-pointer"
                      style={showOriginal ? undefined : checkerboardStyle}
                      onClick={() => setShowOriginal(!showOriginal)}
                    >
                      <AnimatePresence mode="wait">
                        <motion.img
                          key={showOriginal ? "original" : "processed"}
                          src={showOriginal ? imageUrl : processedUrl}
                          alt={showOriginal ? "Original" : "Processed"}
                          className="w-full h-full object-contain"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        />
                      </AnimatePresence>
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 text-white text-xs rounded-full px-3 py-1.5">
                        {showOriginal ? (
                          <Eye className="w-3 h-3" />
                        ) : (
                          <EyeOff className="w-3 h-3" />
                        )}
                        {showOriginal ? "Original" : "Background Removed"}
                        <span className="text-white/50">
                          Click to toggle
                        </span>
                      </div>
                    </div>
                  )}
                </motion.div>
              ) : (
                /* Initial state — show original image */
                <motion.div
                  key="preview"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="aspect-[4/3] rounded-lg overflow-hidden border bg-muted"
                >
                  <img
                    src={imageUrl}
                    alt="Original"
                    className="w-full h-full object-contain"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* Action buttons */}
          {!isProcessing && (
            <div className="space-y-2">
              {!processedUrl ? (
                <Button
                  onClick={handleRemove}
                  className="w-full bg-brand-500 hover:bg-brand-600 text-white"
                  size="lg"
                >
                  <Scissors className="w-4 h-4 mr-2" />
                  Remove Background
                  <span className="ml-2 text-xs opacity-80">(1 credit)</span>
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setProcessedUrl(null);
                      handleRemove();
                    }}
                    className="flex-1"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Retry
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleDownload}
                    className="flex-1"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download PNG
                  </Button>
                  <Button
                    onClick={handleUse}
                    className="flex-1 bg-brand-500 hover:bg-brand-600 text-white"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Use This Image
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
