"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Scissors,
  Download,
  RotateCcw,
  Sparkles,
  Columns2,
  SlidersHorizontal,
  ToggleLeft,
  Eye,
  EyeOff,
  ArrowRight,
  Lightbulb,
  Coins,
  ImageIcon,
  Trash2,
  Eraser,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MediaUploader } from "@/components/shared/media-uploader";
import { AIGenerationLoader } from "@/components/shared/ai-generation-loader";
import BrushRefineCanvas from "@/components/shared/brush-refine-canvas";

// ── Types ──────────────────────────────────────────────────────────────────────

type ViewMode = "side-by-side" | "slider" | "toggle";

interface ProcessedImage {
  originalUrl: string;
  processedUrl: string;
  createdAt: Date;
}

// ── Checkerboard ───────────────────────────────────────────────────────────────

const checkerboardStyle = {
  backgroundImage: `linear-gradient(45deg, #e5e7eb 25%, transparent 25%),
    linear-gradient(-45deg, #e5e7eb 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #e5e7eb 75%),
    linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)`,
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
};

// ── Stagger animations ─────────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

// ── Tips ───────────────────────────────────────────────────────────────────────

const tips = [
  {
    title: "Clear subjects",
    desc: "Photos with a clear foreground subject produce the best results.",
  },
  {
    title: "Product photos",
    desc: "Great for e-commerce — remove messy backgrounds from product shots.",
  },
  {
    title: "Logo cleanup",
    desc: "Clean up logo backgrounds for transparent PNGs ready for any design.",
  },
  {
    title: "Portrait mode",
    desc: "People and faces are detected with high precision for clean cutouts.",
  },
];

// ── Page Component ─────────────────────────────────────────────────────────────

export default function BackgroundRemoverPage() {
  const { toast } = useToast();

  // Upload state
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const imageUrl = imageUrls[0] || "";

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState("");
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);

  // Refine state
  const [isRefining, setIsRefining] = useState(false);
  const [isManualMode, setIsManualMode] = useState(false);

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>("slider");
  const [showOriginal, setShowOriginal] = useState(false);
  const [sliderPos, setSliderPos] = useState(50);
  const sliderRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  // Gallery
  const [gallery, setGallery] = useState<ProcessedImage[]>([]);

  // Credit cost
  const [creditCost, setCreditCost] = useState(1);

  // Fetch dynamic cost
  useEffect(() => {
    fetch("/api/credits/costs?keys=AI_BG_REMOVE")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data?.costs?.AI_BG_REMOVE) {
          setCreditCost(d.data.costs.AI_BG_REMOVE);
        }
      })
      .catch(() => {});
  }, []);

  // Process image
  const handleRemove = async () => {
    if (!imageUrl) return;
    setIsProcessing(true);
    setProcessedUrl(null);
    setStep("Analyzing image...");

    try {
      const t1 = setTimeout(() => setStep("Detecting foreground..."), 2000);
      const t2 = setTimeout(() => setStep("Removing background..."), 4000);
      const t3 = setTimeout(() => setStep("Refining edges..."), 7000);
      const t4 = setTimeout(() => setStep("Finalizing..."), 10000);

      const res = await fetch("/api/image-tools/remove-background", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });
      const data = await res.json();

      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);

      if (!res.ok || !data.success) {
        throw new Error(
          data.error?.message || "Background removal failed"
        );
      }

      setProcessedUrl(data.data.imageUrl);
      setGallery((prev) => [
        {
          originalUrl: imageUrl,
          processedUrl: data.data.imageUrl,
          createdAt: new Date(),
        },
        ...prev.slice(0, 9),
      ]);
      toast({ title: "Background removed!" });
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

  const handleProcessAnother = () => {
    setImageUrls([]);
    setProcessedUrl(null);
    setShowOriginal(false);
    setSliderPos(50);
    setIsRefining(false);
    setIsManualMode(false);
  };

  const handleManualRemove = () => {
    if (!imageUrl) return;
    setIsManualMode(true);
    setProcessedUrl(imageUrl); // Use original image for manual editing
    setIsRefining(true);
  };

  const handleRefineSave = (newUrl: string) => {
    setProcessedUrl(newUrl);
    if (isManualMode) {
      // For manual mode, add to gallery
      setGallery((prev) => [
        {
          originalUrl: imageUrl,
          processedUrl: newUrl,
          createdAt: new Date(),
        },
        ...prev.slice(0, 9),
      ]);
    } else {
      // For AI mode, update existing gallery entry
      setGallery((prev) => {
        if (prev.length === 0) return prev;
        const updated = [...prev];
        updated[0] = { ...updated[0], processedUrl: newUrl };
        return updated;
      });
    }
    setIsRefining(false);
    toast({ title: isManualMode ? "Manual removal saved!" : "Refinement saved!" });
  };

  // Slider drag
  const handleSliderMove = useCallback((clientX: number) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    setSliderPos(Math.max(0, Math.min(100, (x / rect.width) * 100)));
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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6 max-w-4xl mx-auto"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
              <Scissors className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Background Remover</h1>
              <p className="text-muted-foreground text-sm">
                Remove backgrounds from any image with AI precision
              </p>
            </div>
          </div>
        </div>
        <Badge
          variant="outline"
          className="gap-1.5 px-3 py-1.5 text-sm border-amber-500/30 text-amber-600"
        >
          <Coins className="w-3.5 h-3.5" />
          {creditCost} credit per image
        </Badge>
      </motion.div>

      {/* Main content */}
      <motion.div variants={itemVariants}>
        <Card className="overflow-hidden border-2">
          <CardContent className="p-6">
            {/* Processing state */}
            {isProcessing && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-12"
              >
                <AIGenerationLoader
                  currentStep={step}
                  subtitle="This usually takes 5-15 seconds"
                />
              </motion.div>
            )}

            {/* Refine mode */}
            {!isProcessing && processedUrl && isRefining && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <BrushRefineCanvas
                  imageUrl={processedUrl}
                  onSave={handleRefineSave}
                  onCancel={() => setIsRefining(false)}
                />
              </motion.div>
            )}

            {/* Result view */}
            {!isProcessing && processedUrl && !isRefining && (
              <AnimatePresence mode="wait">
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  {/* View mode selector */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-brand-500" />
                      <span className="text-sm font-semibold">
                        Background Removed
                      </span>
                    </div>
                    <div className="flex gap-1 bg-muted rounded-lg p-0.5">
                      {([
                        ["side-by-side", Columns2, "Side by side"],
                        ["slider", SlidersHorizontal, "Slider"],
                        ["toggle", ToggleLeft, "Toggle"],
                      ] as const).map(([mode, Icon, title]) => (
                        <button
                          key={mode}
                          onClick={() => {
                            setViewMode(mode);
                            if (mode === "toggle") setShowOriginal(false);
                          }}
                          className={`p-1.5 rounded-md transition-colors ${
                            viewMode === mode
                              ? "bg-background shadow-sm text-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                          title={title}
                        >
                          <Icon className="w-4 h-4" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Side-by-side */}
                  {viewMode === "side-by-side" && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Original
                        </span>
                        <div className="aspect-square rounded-xl overflow-hidden border-2 bg-muted">
                          <img
                            src={imageUrl}
                            alt="Original"
                            className="w-full h-full object-contain"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <span className="text-xs font-medium text-brand-500 uppercase tracking-wide">
                          Background Removed
                        </span>
                        <div
                          className="aspect-square rounded-xl overflow-hidden border-2 border-brand-500/30"
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

                  {/* Slider */}
                  {viewMode === "slider" && (
                    <div
                      ref={sliderRef}
                      className="relative aspect-[4/3] rounded-xl overflow-hidden border-2 cursor-col-resize select-none"
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                      onTouchMove={handleTouchMove}
                      onClick={(e) => handleSliderMove(e.clientX)}
                    >
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
                      <div
                        className="absolute inset-0 bg-muted"
                        style={{
                          clipPath: `inset(0 ${100 - sliderPos}% 0 0)`,
                        }}
                      >
                        <img
                          src={imageUrl}
                          alt="Original"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-10"
                        style={{ left: `${sliderPos}%` }}
                      >
                        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-white shadow-xl flex items-center justify-center border-2 border-brand-500/30">
                          <SlidersHorizontal className="w-5 h-5 text-brand-500" />
                        </div>
                      </div>
                      <span className="absolute top-3 left-3 text-[11px] font-bold bg-black/60 text-white rounded-md px-2 py-1">
                        ORIGINAL
                      </span>
                      <span className="absolute top-3 right-3 text-[11px] font-bold bg-brand-500 text-white rounded-md px-2 py-1">
                        REMOVED
                      </span>
                    </div>
                  )}

                  {/* Toggle */}
                  {viewMode === "toggle" && (
                    <div
                      className="relative aspect-[4/3] rounded-xl overflow-hidden border-2 cursor-pointer"
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
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/70 backdrop-blur-sm text-white text-xs rounded-full px-4 py-2">
                        {showOriginal ? (
                          <Eye className="w-3.5 h-3.5" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5" />
                        )}
                        {showOriginal
                          ? "Original"
                          : "Background Removed"}
                        <span className="text-white/50">
                          Click to toggle
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="outline"
                      onClick={handleProcessAnother}
                      className="flex-1"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Process Another
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setIsRefining(true)}
                      className="flex-1"
                    >
                      <Eraser className="w-4 h-4 mr-2" />
                      Refine Edges
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
                      onClick={() => {
                        window.open(
                          `/studio?exactImage=${encodeURIComponent(processedUrl)}`,
                          "_self"
                        );
                      }}
                      className="flex-1 bg-brand-500 hover:bg-brand-600 text-white"
                    >
                      <ArrowRight className="w-4 h-4 mr-2" />
                      Use in Studio
                    </Button>
                  </div>
                </motion.div>
              </AnimatePresence>
            )}

            {/* Upload state (no image or no result) */}
            {!isProcessing && !processedUrl && (
              <div className="space-y-4">
                <MediaUploader
                  value={imageUrls}
                  onChange={setImageUrls}
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  maxSize={10 * 1024 * 1024}
                  filterTypes={["image"]}
                  variant="large"
                  label="Upload Image"
                  description="Drag & drop or select an image to remove its background"
                  placeholder="Drop image here"
                  libraryTitle="Select Image"
                />

                {imageUrl && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        onClick={handleRemove}
                        size="lg"
                        className="bg-brand-500 hover:bg-brand-600 text-white shadow-lg shadow-brand-500/20"
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        AI Remove
                        <Badge
                          variant="secondary"
                          className="ml-2 bg-white/20 text-white border-0 text-xs"
                        >
                          {creditCost} credit
                        </Badge>
                      </Button>
                      <Button
                        onClick={handleManualRemove}
                        size="lg"
                        variant="outline"
                        className="border-2"
                      >
                        <Eraser className="w-4 h-4 mr-2" />
                        Manual Remove
                        <Badge
                          variant="secondary"
                          className="ml-2 bg-green-500/10 text-green-600 border-0 text-xs"
                        >
                          Free
                        </Badge>
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      Use AI for instant removal or manual tools for precise control
                    </p>
                  </motion.div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Tips section */}
      {!processedUrl && !isProcessing && (
        <motion.div variants={itemVariants}>
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-semibold">Tips for best results</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {tips.map((tip) => (
              <Card key={tip.title} className="bg-muted/30 border-dashed">
                <CardContent className="p-3">
                  <p className="text-xs font-semibold mb-1">{tip.title}</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {tip.desc}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>
      )}

      {/* Recent gallery */}
      {gallery.length > 0 && (
        <motion.div variants={itemVariants}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Recent Removals</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setGallery([])}
              className="text-xs text-muted-foreground"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Clear
            </Button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {gallery.map((item, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => {
                  setImageUrls([item.originalUrl]);
                  setProcessedUrl(item.processedUrl);
                }}
                className="aspect-square rounded-lg overflow-hidden border-2 hover:border-brand-500/50 transition-all group"
                style={checkerboardStyle}
              >
                <img
                  src={item.processedUrl}
                  alt={`Processed ${i + 1}`}
                  className="w-full h-full object-contain"
                />
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
