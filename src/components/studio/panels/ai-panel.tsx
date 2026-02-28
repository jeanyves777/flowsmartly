"use client";

import { useState, useEffect } from "react";
import {
  Sparkles,
  Wand2,
  Loader2,
  Eraser,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { handleCreditError } from "@/components/payments/credit-purchase-modal";
import { emitCreditsUpdate } from "@/lib/utils/credits-event";
import { useCanvasStore } from "../hooks/use-canvas-store";
import { addImageToCanvas } from "../utils/canvas-helpers";
import { useCanvasExport } from "../hooks/use-canvas-export";
import { AiGeneratorModal } from "../ai-generator-modal";

export function AiPanel() {
  const { toast } = useToast();
  const canvas = useCanvasStore((s) => s.canvas);
  const canvasWidth = useCanvasStore((s) => s.canvasWidth);
  const canvasHeight = useCanvasStore((s) => s.canvasHeight);
  const { getCanvasDataUrl } = useCanvasExport();

  // Modal state
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  // Loading states
  const [isImproving, setIsImproving] = useState(false);
  const [removingBg, setRemovingBg] = useState(false);
  const [creditsRemaining, setCreditsRemaining] = useState(0);

  // Improve design
  const [improveInstruction, setImproveInstruction] = useState("");

  // Active section
  const [activeSection, setActiveSection] = useState<"generate" | "improve" | "bgremove">("generate");

  // Fetch credits
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/ai/studio");
        const data = await res.json();
        if (data.success) setCreditsRemaining(data.data.stats?.creditsRemaining ?? 0);
      } catch { /* silently */ }
    })();
  }, []);

  // AI Improve (export canvas → edit)
  const handleImprove = async () => {
    if (!improveInstruction.trim()) {
      toast({ title: "Please describe how to improve the design", variant: "destructive" });
      return;
    }
    if (!canvas) return;

    setIsImproving(true);
    try {
      const dataUrl = getCanvasDataUrl("png", 1);
      if (!dataUrl) throw new Error("Failed to export canvas");

      const blob = await fetch(dataUrl).then((r) => r.blob());
      const formData = new FormData();
      formData.append("file", blob, "canvas-export.png");
      formData.append("tags", JSON.stringify(["studio-export"]));

      const uploadRes = await fetch("/api/media", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadData.success) throw new Error("Upload failed");

      const imageUrl = uploadData.data.file.url;

      const res = await fetch("/api/ai/visual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: improveInstruction.trim(),
          category: "social_post",
          size: `${canvasWidth}x${canvasHeight}`,
          style: "modern",
          provider: "xai",
          heroType: "people",
          textMode: "exact",
          editImageUrl: imageUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (handleCreditError(data.error || {}, "visual design")) return;
        throw new Error(data.error?.message || "Improvement failed");
      }

      if (data.data?.design?.imageUrl && canvas) {
        const fabric = await import("fabric");
        await addImageToCanvas(canvas, data.data.design.imageUrl, fabric);
      }

      if (data.data?.creditsRemaining !== undefined) {
        setCreditsRemaining(data.data.creditsRemaining);
        emitCreditsUpdate(data.data.creditsRemaining);
      }

      setImproveInstruction("");
      toast({ title: "Design improved!" });
    } catch (e) {
      toast({ title: "Improvement failed", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
    } finally {
      setIsImproving(false);
    }
  };

  // Remove BG from selected image
  const handleRemoveBg = async () => {
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (!obj || obj.type !== "image") {
      toast({ title: "Select an image first", variant: "destructive" });
      return;
    }
    const src = obj.getSrc?.() || obj._element?.src;
    if (!src) {
      toast({ title: "Cannot read image source", variant: "destructive" });
      return;
    }

    setRemovingBg(true);
    try {
      let imageUrl = src;

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
        const newImg = await fabric.FabricImage.fromURL(data.data.imageUrl, { crossOrigin: "anonymous" });
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
      setRemovingBg(false);
    }
  };

  return (
    <>
      <div className="p-3 space-y-4 text-sm">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-brand-500" />
          AI Tools
        </h3>

        {/* Section tabs */}
        <div className="flex gap-1 bg-muted/50 rounded-lg p-0.5">
          {[
            { id: "generate" as const, label: "Generate", icon: Sparkles },
            { id: "improve" as const, label: "Improve", icon: Wand2 },
            { id: "bgremove" as const, label: "BG Remove", icon: Eraser },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                activeSection === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="h-3 w-3" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* SECTION A: AI Generate - Opens Modal */}
        {activeSection === "generate" && (
          <div className="space-y-4">
            {/* CTA to open modal */}
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-400/20 to-brand-600/20 flex items-center justify-center">
                <Sparkles className="h-7 w-7 text-brand-500" />
              </div>
              <div className="text-center">
                <h4 className="text-sm font-semibold">AI Design Generator</h4>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                  Create designs with AI. Smart Layout generates editable elements, or use AI Image for a flat design.
                </p>
              </div>
              <Button
                onClick={() => setShowGenerateModal(true)}
                className="w-full gap-2"
                size="sm"
              >
                <Sparkles className="h-4 w-4" />
                Open AI Generator
                <ArrowUpRight className="h-3.5 w-3.5 ml-auto" />
              </Button>
              <p className="text-[10px] text-muted-foreground">
                {creditsRemaining} credits remaining
              </p>
            </div>
          </div>
        )}

        {/* SECTION B: AI Improve */}
        {activeSection === "improve" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Export your canvas and let AI improve it. The result will be added as a new layer.
            </p>

            <div className="flex flex-wrap gap-1">
              {["Make it more professional", "Improve colors", "Fix layout", "Add visual flair"].map((q) => (
                <Badge
                  key={q}
                  variant="outline"
                  className="cursor-pointer text-[10px] hover:bg-brand-500/10"
                  onClick={() => setImproveInstruction(q)}
                >
                  {q}
                </Badge>
              ))}
            </div>

            <textarea
              value={improveInstruction}
              onChange={(e) => setImproveInstruction(e.target.value)}
              placeholder="Describe how to improve your design..."
              className="w-full min-h-[60px] p-2 text-xs border rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-brand-500 bg-background"
            />

            <Button
              onClick={handleImprove}
              disabled={isImproving || !improveInstruction.trim()}
              className="w-full gap-2"
              size="sm"
            >
              {isImproving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              {isImproving ? "Improving..." : "Improve Design"}
            </Button>
          </div>
        )}

        {/* SECTION C: BG Remove */}
        {activeSection === "bgremove" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Select an image on the canvas, then click the button to remove its background.
            </p>
            <Button
              onClick={handleRemoveBg}
              className="w-full gap-2"
              size="sm"
              variant="outline"
              disabled={removingBg}
            >
              {removingBg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eraser className="h-4 w-4" />}
              {removingBg ? "Removing..." : "Remove Background"}
            </Button>
          </div>
        )}
      </div>

      {/* AI Generator Modal */}
      <AiGeneratorModal
        open={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
      />
    </>
  );
}
