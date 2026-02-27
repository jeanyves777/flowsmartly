"use client";

import { useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useCanvasStore } from "@/components/studio/hooks/use-canvas-store";
import { safeLoadFromJSON } from "@/components/studio/utils/canvas-helpers";
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
          const store = useCanvasStore.getState();
          const design = data.data.design;
          const rawData = design.canvasData;

          // Restore canvas dimensions from saved size (e.g. "1080x1350")
          if (design.size) {
            const [w, h] = design.size.split("x").map(Number);
            if (w && h) {
              store.setCanvasDimensions(w, h);
            }
          }

          // Parse the stored data to check if it's multi-page
          let parsed: Record<string, unknown> | null = null;
          try {
            parsed = typeof rawData === "string" ? JSON.parse(rawData) : rawData;
          } catch {
            parsed = rawData;
          }

          if (parsed && (parsed as any)._multiPage === true) {
            // Multi-page design: restore pages array and load the active page
            const multiPageData = parsed as {
              pages: Array<{ id: string; canvasJSON: string; width: number; height: number }>;
              activePageIndex: number;
            };
            const restoredPages = multiPageData.pages.map((p) => ({
              id: p.id,
              canvasJSON: typeof p.canvasJSON === "string" ? p.canvasJSON : JSON.stringify(p.canvasJSON),
              thumbnailDataUrl: null as string | null,
              width: p.width,
              height: p.height,
            }));

            const activeIdx = Math.min(
              multiPageData.activePageIndex || 0,
              restoredPages.length - 1
            );

            // Restore per-page dimensions from the active page
            const activePage = restoredPages[activeIdx];
            if (activePage?.width && activePage?.height) {
              store.setCanvasDimensions(activePage.width, activePage.height);
            }

            store.setPages(restoredPages);
            store.setActivePageIndex(activeIdx);

            // Load the active page canvas content
            if (activePage) {
              await safeLoadFromJSON(canvas, activePage.canvasJSON);
            }
          } else {
            // Single-page design (backward compatible): load directly
            const canvasJSON = typeof rawData === "string" ? rawData : JSON.stringify(rawData);
            await safeLoadFromJSON(canvas, canvasJSON);

            // Initialize single-page pages array using the restored dimensions
            const currentW = store.canvasWidth;
            const currentH = store.canvasHeight;
            const initialJSON = JSON.stringify(
              canvas.toJSON(["id", "customName", "selectable", "visible"])
            );
            store.setPages([
              {
                id: `page-${Date.now()}`,
                canvasJSON: initialJSON,
                thumbnailDataUrl: null,
                width: currentW,
                height: currentH,
              },
            ]);
            store.setActivePageIndex(0);
          }

          setDesignId(designId);
          store.setDesignName(design.name || "Untitled Design");
          store.refreshLayers();
          store.setDirty(false);
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
        // Snapshot current page before saving
        store.updateCurrentPageSnapshot();

        let canvasData: string;

        if (store.pages.length > 1) {
          // Multi-page: save all pages in a wrapper object
          canvasData = JSON.stringify({
            _multiPage: true,
            pages: store.pages.map((p) => ({
              id: p.id,
              canvasJSON: p.canvasJSON,
              width: p.width,
              height: p.height,
            })),
            activePageIndex: store.activePageIndex,
          });
        } else {
          // Single page: save canvas JSON directly (backward compatible)
          canvasData = JSON.stringify(
            store.canvas.toJSON(["id", "customName", "selectable", "visible"])
          );
        }

        // Generate a small thumbnail for the designs listing page
        let thumbnailDataUrl: string | null = null;
        try {
          // Ensure viewport is at identity before capturing thumbnail
          store.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
          thumbnailDataUrl = store.canvas.toDataURL({
            format: "jpeg",
            multiplier: 0.15,
            quality: 0.6,
          });
        } catch {
          // thumbnail generation can fail silently
        }

        const body: Record<string, unknown> = {
          prompt: store.designName,
          name: store.designName,
          category: "social_post",
          size: `${store.canvasWidth}x${store.canvasHeight}`,
          canvasData,
          ...(thumbnailDataUrl && { imageUrl: thumbnailDataUrl }),
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

  // Auto-save: debounced 30s after last change + 2-min periodic safety net
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const periodicTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSaving = useRef(false);

  const triggerAutoSave = useCallback(() => {
    if (isSaving.current) return;
    const store = useCanvasStore.getState();
    if (!store.isDirty || !store.canvas) return;
    isSaving.current = true;
    document.dispatchEvent(new Event("studio:save"));
    // Reset saving flag after a short delay so save can complete
    setTimeout(() => { isSaving.current = false; }, 3000);
  }, []);

  // Debounced auto-save: when isDirty changes to true, wait 30s then save
  useEffect(() => {
    if (isDirty) {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(triggerAutoSave, 30000);
    }
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [isDirty, triggerAutoSave]);

  // Periodic safety-net auto-save every 2 minutes
  useEffect(() => {
    periodicTimer.current = setInterval(() => {
      triggerAutoSave();
    }, 120000);
    return () => {
      if (periodicTimer.current) clearInterval(periodicTimer.current);
    };
  }, [triggerAutoSave]);

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
