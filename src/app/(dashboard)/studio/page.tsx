"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useCanvasStore } from "@/components/studio/hooks/use-canvas-store";
import { Loader2 } from "lucide-react";

// Dynamic import to avoid SSR issues with Fabric.js
const StudioLayout = dynamic(
  () => import("@/components/studio/studio-layout").then((m) => ({ default: m.StudioLayout })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[calc(100vh-64px)] bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
          <p className="text-sm text-muted-foreground">Loading Design Studio...</p>
        </div>
      </div>
    ),
  }
);

function StudioPageInner() {
  const searchParams = useSearchParams();
  const designId = searchParams.get("id");
  const preset = searchParams.get("preset");

  const setDesignId = useCanvasStore((s) => s.setDesignId);
  const setCanvasDimensions = useCanvasStore((s) => s.setCanvasDimensions);
  const isDirty = useCanvasStore((s) => s.isDirty);
  const canvas = useCanvasStore((s) => s.canvas);

  // Set canvas dimensions from preset param
  useEffect(() => {
    if (preset) {
      const [w, h] = preset.split("x").map(Number);
      if (w && h) setCanvasDimensions(w, h);
    }
  }, [preset, setCanvasDimensions]);

  // Load existing design if ID provided
  useEffect(() => {
    if (!designId || !canvas) return;

    (async () => {
      try {
        const res = await fetch(`/api/designs/${designId}`);
        const data = await res.json();
        if (data.success && data.data?.design?.canvasData) {
          await canvas.loadFromJSON(data.data.design.canvasData);
          canvas.renderAll();
          setDesignId(designId);
          useCanvasStore.getState().setDesignName(data.data.design.name || "Untitled Design");
          useCanvasStore.getState().refreshLayers();
          useCanvasStore.getState().setDirty(false);
        }
      } catch {
        // silently
      }
    })();
  }, [designId, canvas, setDesignId]);

  // Unsaved changes warning
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Save handler (Ctrl+S from shortcuts)
  useEffect(() => {
    const handleSave = async () => {
      const store = useCanvasStore.getState();
      if (!store.canvas) return;

      try {
        const canvasData = JSON.stringify(
          store.canvas.toJSON(["id", "customName", "selectable", "visible"])
        );

        const body: Record<string, unknown> = {
          prompt: store.designName,
          name: store.designName,
          category: "social_post",
          size: `${store.canvasWidth}x${store.canvasHeight}`,
          canvasData,
        };

        let method = "POST";
        const url = "/api/designs";

        if (store.designId) {
          method = "PUT";
          body.id = store.designId;
        }

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const data = await res.json();
        if (data.success) {
          const id = data.data?.design?.id;
          if (id && !store.designId) {
            store.setDesignId(id);
          }
          store.setDirty(false);
        }
      } catch {
        // silently
      }
    };

    document.addEventListener("studio:save", handleSave);
    return () => document.removeEventListener("studio:save", handleSave);
  }, []);

  return <StudioLayout />;
}

export default function StudioPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
        </div>
      }
    >
      <StudioPageInner />
    </Suspense>
  );
}
