"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Sparkles,
  Wand2,
  Crop,
  MousePointerSquareDashed,
  Maximize2,
  X,
  Image as ImageIcon,
  ChevronRight,
} from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { handleCreditError } from "@/components/payments/credit-purchase-modal";
import { emitCreditsUpdate } from "@/lib/utils/credits-event";
import { useCanvasStore } from "../hooks/use-canvas-store";
import { addImageToCanvas } from "../utils/canvas-helpers";
import { useCanvasExport } from "../hooks/use-canvas-export";
import { AISpinner } from "@/components/shared/ai-generation-loader";
import { MediaLibraryPicker } from "@/components/shared/media-library-picker";

// ChatGPT-style Improve panel. The user can pinpoint the area they want
// changed (drag a rect on the canvas, or use whatever they've already
// selected), and we send those bounds to the backend along with the prompt.
// If they don't pinpoint anything, the backend edits the whole canvas
// (the original behaviour).
export function AiPanel() {
  const { toast } = useToast();
  const canvas = useCanvasStore((s) => s.canvas);
  const canvasWidth = useCanvasStore((s) => s.canvasWidth);
  const canvasHeight = useCanvasStore((s) => s.canvasHeight);
  const selectedObjectIds = useCanvasStore((s) => s.selectedObjectIds);
  const regionSelectMode = useCanvasStore((s) => s.regionSelectMode);
  const setRegionSelectMode = useCanvasStore((s) => s.setRegionSelectMode);
  const aiSelectedRegion = useCanvasStore((s) => s.aiSelectedRegion);
  const setAiSelectedRegion = useCanvasStore((s) => s.setAiSelectedRegion);
  const { getCanvasDataUrl } = useCanvasExport();

  const [isImproving, setIsImproving] = useState(false);
  const [creditsRemaining, setCreditsRemaining] = useState(0);
  const [improveInstruction, setImproveInstruction] = useState("");

  // Optional reference image for AI-driven swap. The user picks (or uploads)
  // an image they want the AI to incorporate into the design. We send the
  // URL to the backend, which routes the call to a multi-image-capable
  // provider (Gemini) so the AI can match lighting / perspective / style
  // when blending the reference into the pinpointed region.
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/ai/studio");
        const data = await res.json();
        if (data.success) setCreditsRemaining(data.data.stats?.creditsRemaining ?? 0);
      } catch { /* silently */ }
    })();
  }, []);

  // Bounding box of the user's currently-selected objects on the canvas.
  // Computed live so the "Use selected (NxM)" button always reflects what
  // they have highlighted — including multi-select via shift-click.
  const selectionRegion = useMemo(() => {
    if (!canvas || selectedObjectIds.length === 0) return null;
    const active = canvas.getActiveObject?.();
    if (!active) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b = (active as any).getBoundingRect?.();
    if (!b) return null;
    return {
      x: Math.max(0, Math.round(b.left)),
      y: Math.max(0, Math.round(b.top)),
      w: Math.min(canvasWidth, Math.round(b.width)),
      h: Math.min(canvasHeight, Math.round(b.height)),
      canvasW: canvasWidth,
      canvasH: canvasHeight,
    };
  }, [canvas, selectedObjectIds, canvasWidth, canvasHeight]);

  // Resolved region we'll actually send. Priority:
  //   1. Explicit drawn region (aiSelectedRegion)
  //   2. Selection bounding box (selectionRegion)
  //   3. null = whole canvas
  const effectiveRegion = aiSelectedRegion ?? selectionRegion ?? null;

  const regionLabel = effectiveRegion
    ? `${effectiveRegion.w}×${effectiveRegion.h}px region`
    : "Whole canvas";

  const handleImprove = async () => {
    if (!improveInstruction.trim()) {
      toast({ title: "Describe what to change", variant: "destructive" });
      return;
    }
    if (!canvas) return;

    // Region-select mode locks Fabric selection — bail out cleanly so the
    // user isn't stuck waiting on AI while their canvas is unresponsive.
    if (regionSelectMode) setRegionSelectMode(false);

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
          editRegion: effectiveRegion,
          // When the user picks a reference image, the backend routes the
          // call to a multi-image-capable provider (Gemini) so the AI can
          // intelligently swap it into the pinpointed area instead of us
          // doing a mechanical paste.
          referenceImageUrl: referenceImageUrl || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (handleCreditError(data.error || {}, "AI design")) return;
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
      // Clear the pinpoint AND the reference image after a successful improve
      // so the next prompt starts from a clean slate — keeping them would
      // silently re-target the same area / re-use the same reference and
      // surprise the user.
      setAiSelectedRegion(null);
      setReferenceImageUrl(null);
      toast({ title: "Design improved!" });
    } catch (e) {
      toast({
        title: "Improvement failed",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setIsImproving(false);
    }
  };

  const presets = [
    "Make it more professional",
    "Improve colors",
    "Fix the layout",
    "Add visual flair",
    "Make text more readable",
    "Use a brighter palette",
  ];

  return (
    <div className="p-3 space-y-4 text-sm flex flex-col h-full overflow-y-auto">
      <div>
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-brand-500" />
          AI Design
        </h3>
        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
          Pinpoint an area on the canvas (or pick an object) and tell the AI what to change. Leave the area blank to edit the whole canvas.
        </p>
      </div>

      {/* Region picker */}
      <div className="space-y-2">
        <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          Edit area
        </div>

        {/* Active region card */}
        <div
          className={`flex items-center gap-2 rounded-md border p-2 ${
            effectiveRegion
              ? "border-brand-500/50 bg-brand-500/5"
              : "border-border bg-muted/30"
          }`}
        >
          {effectiveRegion ? (
            <Crop className="h-4 w-4 text-brand-500 shrink-0" />
          ) : (
            <Maximize2 className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate">{regionLabel}</div>
            {effectiveRegion ? (
              <div className="text-[10px] text-muted-foreground truncate">
                at ({effectiveRegion.x}, {effectiveRegion.y}) on{" "}
                {effectiveRegion.canvasW}×{effectiveRegion.canvasH}
              </div>
            ) : (
              <div className="text-[10px] text-muted-foreground">
                AI will edit the entire design
              </div>
            )}
          </div>
          {aiSelectedRegion && (
            <button
              type="button"
              onClick={() => setAiSelectedRegion(null)}
              className="p-1 -mr-1 rounded hover:bg-muted text-muted-foreground"
              title="Clear pinpoint"
              aria-label="Clear pinpoint region"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Region action buttons */}
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={regionSelectMode ? "default" : "outline"}
            className="h-8 text-[11px] gap-1.5"
            onClick={() => {
              setAiSelectedRegion(null);
              setRegionSelectMode(!regionSelectMode);
            }}
            title="Drag a rectangle on the canvas to pinpoint the area to edit"
          >
            <Crop className="h-3.5 w-3.5" />
            {regionSelectMode ? "Drawing… (click)" : "Pinpoint area"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-[11px] gap-1.5"
            disabled={!selectionRegion}
            onClick={() => {
              // Promote the current selection bounding box into an explicit
              // pinpoint so the chosen region survives even after the user
              // clicks elsewhere.
              if (selectionRegion) setAiSelectedRegion(selectionRegion);
            }}
            title={
              selectionRegion
                ? "Pin the bounds of your currently selected object(s)"
                : "Select one or more objects on the canvas first"
            }
          >
            <MousePointerSquareDashed className="h-3.5 w-3.5" />
            Use selected
          </Button>
        </div>
        {regionSelectMode && (
          <div className="text-[10px] text-brand-600 bg-brand-500/10 rounded px-2 py-1.5 leading-relaxed">
            Click and drag on the canvas to draw the area to edit. Press the button again or click outside to cancel.
          </div>
        )}
      </div>

      {/* Reference image — optional. The AI receives this alongside the
          canvas and your prompt, then intelligently swaps/blends it into
          the pinpointed area (matches lighting, perspective, style). When
          provided, the call is routed to a multi-image-capable provider
          (Gemini) on the backend. */}
      <div className="space-y-2">
        <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide flex items-center justify-between">
          <span>Reference image (optional)</span>
          {referenceImageUrl && (
            <span className="text-[9px] font-normal text-brand-600 normal-case">
              AI will swap with this
            </span>
          )}
        </div>
        {referenceImageUrl ? (
          <div className="flex items-center gap-2 rounded-md border border-brand-500/50 bg-brand-500/5 p-2">
            <div className="relative w-12 h-12 rounded overflow-hidden border bg-muted shrink-0">
              <Image
                src={referenceImageUrl}
                alt="Reference"
                fill
                sizes="48px"
                className="object-cover"
                unoptimized
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">Reference selected</div>
              <div className="text-[10px] text-muted-foreground">
                Tell the AI what to do with it in the prompt below.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setReferenceImageUrl(null)}
              className="p-1 rounded hover:bg-muted text-muted-foreground"
              title="Remove reference image"
              aria-label="Remove reference image"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsPickerOpen(true)}
            className="w-full flex items-center gap-2 rounded-md border border-dashed border-border/80 hover:border-brand-500/50 hover:bg-muted/30 transition-colors p-3 text-left"
          >
            <div className="w-10 h-10 rounded bg-muted/60 flex items-center justify-center shrink-0">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium">Pick a reference image</div>
              <div className="text-[10px] text-muted-foreground">
                Library or upload — AI will swap/blend it into the design
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
        )}
      </div>

      {/* Preset chips */}
      <div className="space-y-2">
        <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          Quick prompts
        </div>
        <div className="flex flex-wrap gap-1">
          {presets.map((q) => (
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
      </div>

      {/* Big prompt textarea — the focal point of this panel */}
      <div className="flex-1 flex flex-col gap-2 min-h-0">
        <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          Your instruction
        </div>
        <textarea
          value={improveInstruction}
          onChange={(e) => setImproveInstruction(e.target.value)}
          placeholder={
            referenceImageUrl
              ? effectiveRegion
                ? "e.g. Replace the photo in the pinpointed area with the reference — keep lighting and angle natural"
                : "e.g. Use the reference image to replace the main photo in this design"
              : effectiveRegion
                ? "Describe what to change in the pinpointed area…"
                : "Describe how to improve your design…"
          }
          className="w-full flex-1 min-h-[140px] p-3 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 bg-background leading-relaxed"
        />

        <Button
          onClick={handleImprove}
          disabled={isImproving || !improveInstruction.trim()}
          className="w-full gap-2 h-10"
          size="default"
        >
          {isImproving ? (
            <AISpinner className="h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="h-4 w-4" />
          )}
          {isImproving ? "Improving…" : "Improve Design"}
        </Button>
        <p className="text-[10px] text-muted-foreground text-center">
          {creditsRemaining} credits remaining
        </p>
      </div>

      {/* Shared media picker — Library tab + Upload tab built in. Single
          select: one reference image at a time gets sent to the AI. */}
      <MediaLibraryPicker
        open={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        filterTypes={["image"]}
        title="Pick a reference image"
        onSelect={(url) => {
          setReferenceImageUrl(url);
          setIsPickerOpen(false);
        }}
      />
    </div>
  );
}
