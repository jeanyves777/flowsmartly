"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Scissors,
  Download,
  Sparkles,
  Coins,
  ImageIcon,
  Trash2,
  Eraser,
  Upload,
  X,
  Wand2,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MediaUploader } from "@/components/shared/media-uploader";
import { AIGenerationLoader } from "@/components/shared/ai-generation-loader";
import BrushRefineCanvas from "@/components/shared/brush-refine-canvas";

// ── Types ──────────────────────────────────────────────────────────────────────

interface GalleryImage {
  id: string;
  originalUrl: string;
  processedUrl?: string;
  createdAt: Date;
}

// ── Checkerboard ───────────────────────────────────────────────────────────────

const checkerboardStyle = {
  backgroundImage: `linear-gradient(45deg, hsl(var(--muted)) 25%, transparent 25%),
    linear-gradient(-45deg, hsl(var(--muted)) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, hsl(var(--muted)) 75%),
    linear-gradient(-45deg, transparent 75%, hsl(var(--muted)) 75%)`,
  backgroundSize: "20px 20px",
  backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
};

// ── Page Component ─────────────────────────────────────────────────────────────

export default function BackgroundRemoverStudio() {
  const { toast } = useToast();

  // Gallery
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);

  // Upload state
  const [uploadUrls, setUploadUrls] = useState<string[]>([]);
  const [showUploader, setShowUploader] = useState(false);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState("");

  // Canvas state
  const [canvasMode, setCanvasMode] = useState<"view" | "refine">("view");
  const [currentImage, setCurrentImage] = useState<string | null>(null);

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

  // Handle upload
  const handleUploadComplete = useCallback((urls: string[]) => {
    if (urls.length === 0) return;

    const newImages: GalleryImage[] = urls.map((url) => ({
      id: `${Date.now()}-${Math.random()}`,
      originalUrl: url,
      createdAt: new Date(),
    }));

    setGallery((prev) => [...newImages, ...prev]);
    setUploadUrls([]);
    setShowUploader(false);

    // Auto-select first uploaded image
    if (newImages.length > 0) {
      setSelectedImage(newImages[0]);
      setCurrentImage(newImages[0].originalUrl);
      setCanvasMode("view");
    }

    toast({ title: `${urls.length} image(s) uploaded!` });
  }, [toast]);

  // Select image from gallery
  const handleSelectImage = useCallback((img: GalleryImage) => {
    setSelectedImage(img);
    setCurrentImage(img.processedUrl || img.originalUrl);
    setCanvasMode("view");
  }, []);

  // Delete from gallery
  const handleDeleteImage = useCallback((id: string) => {
    setGallery((prev) => prev.filter((img) => img.id !== id));
    if (selectedImage?.id === id) {
      setSelectedImage(null);
      setCurrentImage(null);
    }
  }, [selectedImage]);

  // AI Remove Background
  const handleAIRemove = async () => {
    if (!selectedImage) return;

    setIsProcessing(true);
    setStep("Analyzing image...");

    try {
      const t1 = setTimeout(() => setStep("Detecting foreground..."), 2000);
      const t2 = setTimeout(() => setStep("Removing background..."), 4000);
      const t3 = setTimeout(() => setStep("Refining edges..."), 7000);

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

      // Update gallery with processed image
      setGallery((prev) =>
        prev.map((img) =>
          img.id === selectedImage.id
            ? { ...img, processedUrl: data.data.imageUrl }
            : img
        )
      );

      setCurrentImage(data.data.imageUrl);
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

  // Manual refine
  const handleManualRefine = () => {
    if (!currentImage) return;
    setCanvasMode("refine");
  };

  // Save refined image
  const handleRefineSave = (newUrl: string) => {
    if (!selectedImage) return;

    setGallery((prev) =>
      prev.map((img) =>
        img.id === selectedImage.id ? { ...img, processedUrl: newUrl } : img
      )
    );

    setCurrentImage(newUrl);
    setCanvasMode("view");
    toast({ title: "Changes saved!" });
  };

  // Download
  const handleDownload = () => {
    if (!currentImage) return;
    const link = document.createElement("a");
    link.href = currentImage;
    link.download = "background-removed.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Image downloaded!" });
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0 bg-muted/30">
      {/* ═══ LEFT SIDEBAR ═══ */}
      <div className="w-80 bg-background border-r border-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-brand-500 flex items-center justify-center shadow-md">
              <Scissors className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Background Studio</h1>
              <p className="text-xs text-muted-foreground">AI-powered editing</p>
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
          <div className="p-4 border-b border-border">
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

        {/* Gallery */}
        <div className="flex-1 overflow-y-auto p-4">
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
                onClick={() => setGallery([])}
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
              <p className="text-xs text-muted-foreground">
                Upload images to get started
              </p>
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
                        Processed
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

        {/* Credit info */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">AI Removal Cost:</span>
            <Badge variant="outline" className="gap-1">
              <Coins className="w-3 h-3" />
              {creditCost} credit
            </Badge>
          </div>
        </div>
      </div>

      {/* ═══ RIGHT CANVAS AREA ═══ */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="bg-background border-b border-border p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {selectedImage && (
              <>
                <Button
                  onClick={handleAIRemove}
                  disabled={isProcessing || !selectedImage}
                  className="bg-brand-500 hover:bg-brand-600 text-white"
                  size="sm"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  AI Remove
                </Button>
                <Button
                  onClick={handleManualRefine}
                  disabled={!currentImage || canvasMode === "refine"}
                  variant="outline"
                  size="sm"
                >
                  <Eraser className="w-4 h-4 mr-2" />
                  Manual Edit
                </Button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {currentImage && canvasMode === "view" && (
              <Button onClick={handleDownload} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            )}
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-auto p-6 flex items-center justify-center">
          <AnimatePresence mode="wait">
            {isProcessing ? (
              <motion.div
                key="processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="max-w-md"
              >
                <AIGenerationLoader
                  currentStep={step}
                  subtitle="This usually takes 5-15 seconds"
                />
              </motion.div>
            ) : !selectedImage ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-center"
              >
                <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Scissors className="w-12 h-12 text-muted-foreground/50" />
                </div>
                <h2 className="text-xl font-semibold mb-2">
                  Select or Upload an Image
                </h2>
                <p className="text-muted-foreground text-sm mb-6">
                  Choose an image from the gallery or upload new images to get
                  started
                </p>
                <Button
                  onClick={() => setShowUploader(true)}
                  className="bg-brand-500 hover:bg-brand-600 text-white"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Images
                </Button>
              </motion.div>
            ) : canvasMode === "refine" && currentImage ? (
              <motion.div
                key="refine"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-5xl"
              >
                <BrushRefineCanvas
                  imageUrl={currentImage}
                  onSave={handleRefineSave}
                  onCancel={() => setCanvasMode("view")}
                />
              </motion.div>
            ) : currentImage ? (
              <motion.div
                key="view"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative"
              >
                <div
                  className="rounded-xl overflow-hidden border-2 border-border shadow-2xl max-w-4xl max-h-[calc(100vh-16rem)]"
                  style={
                    selectedImage?.processedUrl ? checkerboardStyle : undefined
                  }
                >
                  <img
                    src={currentImage}
                    alt="Current"
                    className="max-w-full max-h-[calc(100vh-16rem)] object-contain"
                  />
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
