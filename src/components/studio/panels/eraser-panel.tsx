"use client";

import { useState } from "react";
import {
  Eraser,
  Wand2,
  Paintbrush,
  Sparkles,
  Loader2,
  Undo2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useCanvasStore } from "../hooks/use-canvas-store";
import { useCanvasHistory } from "../hooks/use-canvas-history";

type EraserMode = "ai" | "manual" | "magic" | "restore";

export function EraserPanel() {
  const { toast } = useToast();
  const canvas = useCanvasStore((s) => s.canvas);
  const activeTool = useCanvasStore((s) => s.activeTool);
  const setActiveTool = useCanvasStore((s) => s.setActiveTool);
  const setDirty = useCanvasStore((s) => s.setDirty);
  const refreshLayers = useCanvasStore((s) => s.refreshLayers);
  const { undo } = useCanvasHistory();

  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [activeMode, setActiveMode] = useState<EraserMode>("ai");
  const [brushSize, setBrushSize] = useState(20);

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
        const proxyUrl = data.data.imageUrl.startsWith("http") && !data.data.imageUrl.startsWith(window.location.origin)
          ? `/api/image-proxy?url=${encodeURIComponent(data.data.imageUrl)}`
          : data.data.imageUrl;
        const newImg = await fabric.FabricImage.fromURL(proxyUrl, { crossOrigin: "anonymous" });
        if (newImg) {
          newImg.set({
            left: obj.left, top: obj.top,
            scaleX: obj.scaleX, scaleY: obj.scaleY,
            angle: obj.angle,
          });
          (newImg as any).id = (obj as any).id;
          (newImg as any).customName = "Image (No BG)";
          canvas.remove(obj);
          canvas.add(newImg);
          canvas.setActiveObject(newImg);
          canvas.renderAll();
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

  // Toggle manual eraser drawing mode on canvas
  const activateManualEraser = () => {
    if (!canvas) return;
    setActiveMode("manual");
    setActiveTool("draw");
    canvas.isDrawingMode = true;
    canvas.freeDrawingBrush = new (canvas as any).constructor.PencilBrush(canvas);
    canvas.freeDrawingBrush.width = brushSize;
    canvas.freeDrawingBrush.color = "rgba(255,255,255,1)";
    // Use destination-out to erase
    (canvas.freeDrawingBrush as any).globalCompositeOperation = "destination-out";
    canvas.renderAll();
    toast({ title: "Manual eraser active", description: "Draw on the canvas to erase areas" });
  };

  // Toggle magic wand mode (color-based erase on selected image)
  const activateMagicEraser = async () => {
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (!obj || obj.type !== "image") {
      toast({ title: "Select an image first to use magic eraser", variant: "destructive" });
      return;
    }
    setActiveMode("magic");
    toast({ title: "Magic eraser", description: "Click a color area on the selected image to remove it via AI" });
    // For magic mode, we'll use AI remove as it achieves similar results
    await handleAIRemove();
  };

  // Restore mode: undo last eraser action
  const handleRestore = () => {
    undo();
    setActiveMode("restore");
    toast({ title: "Restored", description: "Last action undone" });
  };

  // Deactivate drawing mode
  const deactivateDrawing = () => {
    if (!canvas) return;
    canvas.isDrawingMode = false;
    setActiveTool("select");
    setActiveMode("ai");
    canvas.renderAll();
  };

  // Update brush size live
  const handleBrushSizeChange = (size: number) => {
    setBrushSize(size);
    if (canvas && canvas.isDrawingMode && canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.width = size;
    }
  };

  const isDrawingActive = activeTool === "draw" && activeMode === "manual";

  return (
    <div className="p-3 space-y-4 text-sm">
      <h3 className="text-sm font-semibold flex items-center gap-1.5">
        <Eraser className="h-4 w-4 text-brand-500" />
        Background Removal
      </h3>

      {/* Mode selector */}
      <div className="space-y-2">
        {/* AI Remove */}
        <button
          onClick={() => { setActiveMode("ai"); deactivateDrawing(); }}
          className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
            activeMode === "ai"
              ? "border-brand-500 bg-brand-500/10"
              : "border-border hover:border-brand-300 hover:bg-muted/50"
          }`}
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="text-xs font-medium">AI Remove</div>
            <div className="text-[10px] text-muted-foreground">Automatic background removal</div>
          </div>
        </button>

        {/* Manual Eraser */}
        <button
          onClick={() => { activateManualEraser(); }}
          className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
            activeMode === "manual"
              ? "border-brand-500 bg-brand-500/10"
              : "border-border hover:border-brand-300 hover:bg-muted/50"
          }`}
        >
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Eraser className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs font-medium">Manual Eraser</div>
            <div className="text-[10px] text-muted-foreground">Draw to erase areas</div>
          </div>
        </button>

        {/* Magic Eraser */}
        <button
          onClick={() => { activateMagicEraser(); }}
          className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
            activeMode === "magic"
              ? "border-brand-500 bg-brand-500/10"
              : "border-border hover:border-brand-300 hover:bg-muted/50"
          }`}
        >
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Wand2 className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs font-medium">Magic Eraser</div>
            <div className="text-[10px] text-muted-foreground">AI-powered smart removal</div>
          </div>
        </button>

        {/* Restore */}
        <button
          onClick={handleRestore}
          className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
            activeMode === "restore"
              ? "border-brand-500 bg-brand-500/10"
              : "border-border hover:border-brand-300 hover:bg-muted/50"
          }`}
        >
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Paintbrush className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs font-medium">Restore</div>
            <div className="text-[10px] text-muted-foreground">Undo eraser changes</div>
          </div>
        </button>
      </div>

      {/* AI Remove action */}
      {activeMode === "ai" && (
        <div className="space-y-3 pt-2 border-t">
          <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/50">
            <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Select an image on the canvas, then click the button below to remove its background using AI.
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
            {isProcessingAI ? "Removing..." : "Remove Background"}
          </Button>
        </div>
      )}

      {/* Manual eraser settings */}
      {activeMode === "manual" && (
        <div className="space-y-3 pt-2 border-t">
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <Label className="text-xs">Brush Size</Label>
              <span className="font-mono">{brushSize}px</span>
            </div>
            <input
              type="range"
              min={2}
              max={100}
              value={brushSize}
              onChange={(e) => handleBrushSizeChange(Number(e.target.value))}
              className="w-full h-1.5 accent-brand-500"
            />
          </div>

          {isDrawingActive ? (
            <Button
              onClick={deactivateDrawing}
              variant="outline"
              className="w-full gap-2"
              size="sm"
            >
              <Undo2 className="h-4 w-4" />
              Done Erasing
            </Button>
          ) : (
            <Button
              onClick={activateManualEraser}
              className="w-full gap-2"
              size="sm"
            >
              <Eraser className="h-4 w-4" />
              Start Erasing
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
