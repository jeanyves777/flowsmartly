"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Crop,
  ImagePlus,
  Maximize2,
  MousePointerSquareDashed,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { handleCreditError } from "@/components/payments/credit-purchase-modal";
import { AISpinner } from "@/components/shared/ai-generation-loader";
import { MediaUploader } from "@/components/shared/media-uploader";
import { useToast } from "@/hooks/use-toast";
import { emitCreditsUpdate } from "@/lib/utils/credits-event";
import { useCanvasExport } from "../hooks/use-canvas-export";
import { useCanvasStore } from "../hooks/use-canvas-store";
import { addImageToCanvas } from "../utils/canvas-helpers";

const promptPresets = [
  "Make the design cleaner and more premium",
  "Replace the selected subject using my reference",
  "Remove the extra object and blend the background",
  "Match the style of my reference images",
  "Make the text more readable",
  "Blend the subject naturally into the flyer",
];

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
  const [visualCreditCost, setVisualCreditCost] = useState(15);
  const [qualityCheckEnabled, setQualityCheckEnabled] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [referenceUrls, setReferenceUrls] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [studioRes, costsRes] = await Promise.all([
          fetch("/api/ai/studio"),
          fetch("/api/credits/costs?keys=AI_VISUAL_DESIGN"),
        ]);
        const studioData = await studioRes.json();
        const costsData = await costsRes.json();
        if (studioData.success) setCreditsRemaining(studioData.data.stats?.creditsRemaining ?? 0);
        if (costsData.success && costsData.data?.costs?.AI_VISUAL_DESIGN) {
          setVisualCreditCost(costsData.data.costs.AI_VISUAL_DESIGN);
        }
      } catch {
        // Credit count is helpful but should never block the editor.
      }
    })();
  }, []);

  const selectionRegion = useMemo(() => {
    if (!canvas || selectedObjectIds.length === 0) return null;
    const active = canvas.getActiveObject?.();
    if (!active) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bounds = (active as any).getBoundingRect?.();
    if (!bounds) return null;
    return {
      x: Math.max(0, Math.round(bounds.left)),
      y: Math.max(0, Math.round(bounds.top)),
      w: Math.min(canvasWidth, Math.round(bounds.width)),
      h: Math.min(canvasHeight, Math.round(bounds.height)),
      canvasW: canvasWidth,
      canvasH: canvasHeight,
    };
  }, [canvas, canvasHeight, canvasWidth, selectedObjectIds]);

  const effectiveRegion = aiSelectedRegion ?? selectionRegion ?? null;
  const regionLabel = effectiveRegion
    ? `${effectiveRegion.w}x${effectiveRegion.h}px region`
    : "Whole canvas";

  const handleApplyEdit = async () => {
    const cleanInstruction = instruction.trim();
    if (!cleanInstruction) {
      toast({ title: "Describe what to change", variant: "destructive" });
      return;
    }
    if (!canvas) return;

    if (regionSelectMode) setRegionSelectMode(false);

    setIsImproving(true);
    try {
      const dataUrl = getCanvasDataUrl("png", 1);
      if (!dataUrl) throw new Error("Failed to export canvas");

      const blob = await fetch(dataUrl).then((res) => res.blob());
      const formData = new FormData();
      formData.append("file", blob, "canvas-export.png");
      formData.append("tags", JSON.stringify(["studio-export"]));

      const uploadRes = await fetch("/api/media", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadData.success) throw new Error("Upload failed");

      const res = await fetch("/api/ai/visual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: cleanInstruction,
          category: "social_post",
          size: `${canvasWidth}x${canvasHeight}`,
          style: "modern",
          provider: "openai",
          heroType: "people",
          textMode: "exact",
          editImageUrl: uploadData.data.file.url,
          editRegion: effectiveRegion,
          editIntent: "auto",
          editReferenceMode: referenceUrls.length > 0 ? "keep_face" : "adapt",
          editReferenceImageUrls: referenceUrls,
          qualityCheckEnabled,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (handleCreditError(data.error || {}, "AI design")) return;
        throw new Error(data.error?.message || "AI edit failed");
      }

      if (data.data?.design?.imageUrl && canvas) {
        const fabric = await import("fabric");
        await addImageToCanvas(canvas, data.data.design.imageUrl, fabric);
      }

      if (data.data?.creditsRemaining !== undefined) {
        setCreditsRemaining(data.data.creditsRemaining);
        emitCreditsUpdate(data.data.creditsRemaining);
      }

      setInstruction("");
      setAiSelectedRegion(null);
      toast({ title: "Edit applied" });
    } catch (error) {
      toast({
        title: "AI edit failed",
        description: error instanceof Error ? error.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setIsImproving(false);
    }
  };

  return (
    <div className="flex h-full flex-col text-sm">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-brand-500" />
          AI Design
        </h3>
        <span className="text-[10px] text-muted-foreground">{creditsRemaining} credits</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="space-y-3">
          <textarea
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            placeholder="Tell FlowAI what to change, remove, improve, replace, or match..."
            className="min-h-[150px] w-full resize-none rounded-md border bg-background p-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-500"
          />

          <Accordion type="multiple" defaultValue={["reference"]} className="space-y-2">
            <AccordionItem value="reference" className="rounded-md border bg-muted/15 px-3">
              <AccordionTrigger className="py-3 text-[11px] font-semibold uppercase tracking-wide hover:no-underline">
                <span className="flex min-w-0 items-center gap-1.5">
                  <ImagePlus className="h-3.5 w-3.5" />
                  Reference media
                  <span className="normal-case tracking-normal text-muted-foreground">
                    {referenceUrls.length ? `${referenceUrls.length}/4` : "optional"}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <MediaUploader
                  value={referenceUrls}
                  onChange={setReferenceUrls}
                  multiple
                  maxFiles={4}
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  filterTypes={["image"]}
                  variant="small"
                  placeholder="Add references"
                  libraryTitle="Pick reference images"
                  className="rounded-md border bg-background/80 p-2"
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="quality" className="rounded-md border bg-muted/15 px-3">
              <AccordionTrigger className="py-3 text-[11px] font-semibold uppercase tracking-wide hover:no-underline">
                <span className="flex min-w-0 items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  Quality check
                  <span className="normal-case tracking-normal text-muted-foreground">
                    {qualityCheckEnabled ? "on" : "optional"}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <div className="flex items-center justify-between gap-3 rounded-md border bg-background/80 p-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold">Review and retry</div>
                    <div className="text-[10px] text-muted-foreground">
                      Runs a quality pass before applying, {visualCreditCost * 3} credits.
                    </div>
                  </div>
                  <Switch
                    checked={qualityCheckEnabled}
                    onCheckedChange={setQualityCheckEnabled}
                    aria-label="Enable quality check"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="area" className="rounded-md border bg-muted/15 px-3">
              <AccordionTrigger className="py-3 text-[11px] font-semibold uppercase tracking-wide hover:no-underline">
                <span className="flex min-w-0 items-center gap-1.5">
                  <Crop className="h-3.5 w-3.5" />
                  Edit area
                  <span className="truncate normal-case tracking-normal text-muted-foreground">{regionLabel}</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-2 pb-3">
                <div
                  className={`flex items-center gap-2 rounded-md border p-2 ${
                    effectiveRegion ? "border-brand-500/50 bg-brand-500/5" : "border-border bg-background/80"
                  }`}
                >
                  {effectiveRegion ? (
                    <Crop className="h-4 w-4 shrink-0 text-brand-500" />
                  ) : (
                    <Maximize2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium">{regionLabel}</div>
                    {effectiveRegion ? (
                      <div className="truncate text-[10px] text-muted-foreground">
                        at ({effectiveRegion.x}, {effectiveRegion.y}) on {effectiveRegion.canvasW}x{effectiveRegion.canvasH}
                      </div>
                    ) : (
                      <div className="text-[10px] text-muted-foreground">AI will read the full design</div>
                    )}
                  </div>
                  {aiSelectedRegion && (
                    <button
                      type="button"
                      onClick={() => setAiSelectedRegion(null)}
                      className="-mr-1 rounded p-1 text-muted-foreground hover:bg-muted"
                      title="Clear pinpoint"
                      aria-label="Clear pinpoint region"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={regionSelectMode ? "default" : "outline"}
                    className="h-8 gap-1.5 text-[11px]"
                    onClick={() => {
                      setAiSelectedRegion(null);
                      setRegionSelectMode(!regionSelectMode);
                    }}
                  >
                    <Crop className="h-3.5 w-3.5" />
                    {regionSelectMode ? "Drawing..." : "Pinpoint area"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-[11px]"
                    disabled={!selectionRegion}
                    onClick={() => {
                      if (selectionRegion) setAiSelectedRegion(selectionRegion);
                    }}
                  >
                    <MousePointerSquareDashed className="h-3.5 w-3.5" />
                    Use selected
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="prompts" className="rounded-md border bg-muted/15 px-3">
              <AccordionTrigger className="py-3 text-[11px] font-semibold uppercase tracking-wide hover:no-underline">
                <span className="flex min-w-0 items-center gap-1.5">
                  <Wand2 className="h-3.5 w-3.5" />
                  Quick prompts
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <div className="flex flex-wrap gap-1">
                  {promptPresets.map((preset) => (
                    <Badge
                      key={preset}
                      variant="outline"
                      className="cursor-pointer text-[10px] hover:bg-brand-500/10"
                      onClick={() => setInstruction(preset)}
                    >
                      {preset}
                    </Badge>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>

      <div className="shrink-0 border-t bg-background/95 p-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
        <Button
          onClick={handleApplyEdit}
          disabled={isImproving || !instruction.trim()}
          className="h-11 w-full gap-2"
        >
          {isImproving ? <AISpinner className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {isImproving ? "Applying edit..." : "Apply AI edit"}
        </Button>
      </div>
    </div>
  );
}
