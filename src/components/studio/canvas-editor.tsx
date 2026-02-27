"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useCanvasStore } from "./hooks/use-canvas-store";
import { useCanvasHistory } from "./hooks/use-canvas-history";
import { useCanvasShortcuts } from "./hooks/use-canvas-shortcuts";
import { lockViewportTransform, safeLoadFromJSON } from "./utils/canvas-helpers";

export function CanvasEditor() {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fabricRef = useRef<any>(null);
  const prevPageIndexRef = useRef<number>(0);
  const thumbnailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    canvas,
    setCanvas,
    canvasWidth,
    canvasHeight,
    zoom,
    setZoom,
    setSelection,
    setIsEditingText,
    refreshLayers,
    setDirty,
    activeTool,
    activePageIndex,
  } = useCanvasStore();

  const { pushState } = useCanvasHistory();
  useCanvasShortcuts();

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (!canvasElRef.current) return;

    let fabricCanvas: any = null;

    (async () => {
      const fabric = await import("fabric");
      fabricRef.current = fabric;

      fabricCanvas = new fabric.Canvas(canvasElRef.current!, {
        width: canvasWidth,
        height: canvasHeight,
        backgroundColor: "#ffffff",
        preserveObjectStacking: true,
        selection: true,
        stopContextMenu: true,
        fireRightClick: true,
      });

      // Selection events
      fabricCanvas.on("selection:created", (e: any) => {
        handleSelection(e.selected);
      });
      fabricCanvas.on("selection:updated", (e: any) => {
        handleSelection(e.selected);
      });
      fabricCanvas.on("selection:cleared", () => {
        setSelection([], null);
      });

      // Object modification events (trigger history + layers)
      fabricCanvas.on("object:modified", () => {
        pushState();
        refreshLayers();
        setDirty(true);
      });
      fabricCanvas.on("object:added", () => {
        pushState();
        refreshLayers();
        setDirty(true);
      });
      fabricCanvas.on("object:removed", () => {
        pushState();
        refreshLayers();
        setDirty(true);
      });

      // Text editing events
      fabricCanvas.on("text:editing:entered", () => {
        setIsEditingText(true);
      });
      fabricCanvas.on("text:editing:exited", () => {
        setIsEditingText(false);
        pushState();
      });

      // Lock viewport to identity — zoom/pan is handled by CSS only
      lockViewportTransform(fabricCanvas);

      setCanvas(fabricCanvas);

      // Push initial state + auto-fit zoom
      setTimeout(() => {
        pushState();
        // Auto zoom-to-fit on initial load
        if (containerRef.current) {
          const availW = containerRef.current.clientWidth - 80;
          const availH = containerRef.current.clientHeight - 80;
          if (availW > 0 && availH > 0) {
            const fitZoom = Math.min(availW / canvasWidth, availH / canvasHeight, 1);
            useCanvasStore.getState().setZoom(Math.max(0.1, fitZoom));
          }
        }

        // Initialize pages array if empty (first load or single-page designs)
        const store = useCanvasStore.getState();
        if (store.pages.length === 0) {
          const initialJSON = JSON.stringify(
            fabricCanvas.toJSON(["id", "customName", "selectable", "visible"])
          );
          store.setPages([
            {
              id: `page-${Date.now()}`,
              canvasJSON: initialJSON,
              thumbnailDataUrl: null,
              width: canvasWidth,
              height: canvasHeight,
            },
          ]);
        }
      }, 100);
    })();

    return () => {
      if (fabricCanvas) {
        fabricCanvas.dispose();
        setCanvas(null);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto zoom-to-fit: calculate zoom so canvas fits in container with padding
  const zoomToFit = useCallback(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const availW = container.clientWidth - 80; // 40px padding each side
    const availH = container.clientHeight - 80;
    if (availW <= 0 || availH <= 0) return;

    const fitZoom = Math.min(availW / canvasWidth, availH / canvasHeight, 1);
    setZoom(Math.max(0.1, fitZoom));
  }, [canvasWidth, canvasHeight, setZoom]);

  // Update canvas dimensions when they change + auto zoom-to-fit
  useEffect(() => {
    if (!canvas) return;
    canvas.setDimensions({ width: canvasWidth, height: canvasHeight });
    canvas.renderAll();
    // Auto-fit after dimensions change
    requestAnimationFrame(() => zoomToFit());
  }, [canvas, canvasWidth, canvasHeight, zoomToFit]);

  // Switch canvas content when activePageIndex changes
  useEffect(() => {
    if (!canvas) return;
    const prevIndex = prevPageIndexRef.current;
    if (prevIndex === activePageIndex) return;

    const store = useCanvasStore.getState();
    const { pages } = store;
    const targetPage = pages[activePageIndex];
    if (!targetPage) return;

    // Save current page snapshot before switching (in case it wasn't saved yet)
    if (pages[prevIndex]) {
      try {
        const json = JSON.stringify(
          canvas.toJSON(["id", "customName", "selectable", "visible"])
        );
        const thumbnail = canvas.toDataURL({ format: "png", multiplier: 0.15, quality: 0.5 });
        const newPages = [...pages];
        newPages[prevIndex] = { ...newPages[prevIndex], canvasJSON: json, thumbnailDataUrl: thumbnail };
        store.setPages(newPages);
      } catch {
        // silently fail
      }
    }

    // Load target page JSON into canvas (strip viewport from saved data)
    safeLoadFromJSON(canvas, targetPage.canvasJSON).then(() => {
      refreshLayers();
      pushState();
    });

    prevPageIndexRef.current = activePageIndex;
  }, [canvas, activePageIndex, refreshLayers, pushState]);

  // Debounced thumbnail update on canvas modifications
  useEffect(() => {
    if (!canvas) return;

    const debouncedThumbnailUpdate = () => {
      if (thumbnailTimerRef.current) {
        clearTimeout(thumbnailTimerRef.current);
      }
      thumbnailTimerRef.current = setTimeout(() => {
        useCanvasStore.getState().updateCurrentPageSnapshot();
      }, 1000);
    };

    canvas.on("object:modified", debouncedThumbnailUpdate);
    canvas.on("object:added", debouncedThumbnailUpdate);
    canvas.on("object:removed", debouncedThumbnailUpdate);

    return () => {
      canvas.off("object:modified", debouncedThumbnailUpdate);
      canvas.off("object:added", debouncedThumbnailUpdate);
      canvas.off("object:removed", debouncedThumbnailUpdate);
      if (thumbnailTimerRef.current) {
        clearTimeout(thumbnailTimerRef.current);
      }
    };
  }, [canvas]);

  // Handle selection helper
  const handleSelection = useCallback(
    (selected: any[]) => {
      if (!selected || selected.length === 0) {
        setSelection([], null);
        return;
      }
      const ids = selected.map((obj: any) => obj.id || "unknown");
      const type =
        selected.length > 1
          ? "activeSelection"
          : selected[0]?.type || null;
      setSelection(ids, type);
    },
    [setSelection]
  );

  // Listen for zoom-to-fit events from toolbar
  useEffect(() => {
    const handleZoomToFit = () => zoomToFit();
    document.addEventListener("studio:zoom-to-fit", handleZoomToFit);
    return () => document.removeEventListener("studio:zoom-to-fit", handleZoomToFit);
  }, [zoomToFit]);

  // Zoom with mouse wheel (Ctrl + scroll) — CSS-only, no Fabric.js viewport changes
  useEffect(() => {
    if (!canvas) return;

    const handleWheel = (opt: any) => {
      const e = opt.e as WheelEvent;
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      e.stopPropagation();

      const delta = e.deltaY;
      let newZoom = zoom * (1 - delta / 500);
      newZoom = Math.max(0.1, Math.min(5, newZoom));
      setZoom(newZoom);
    };

    canvas.on("mouse:wheel", handleWheel);
    return () => {
      canvas.off("mouse:wheel", handleWheel);
    };
  }, [canvas, zoom, setZoom]);

  // Re-lock viewport when canvas reference changes (belt-and-suspenders)
  useEffect(() => {
    if (!canvas) return;
    lockViewportTransform(canvas);
    canvas.renderAll();
  }, [canvas]);

  // Sync canvas state with activeTool — ensures drawing mode / cursor reset properly
  useEffect(() => {
    if (!canvas) return;

    if (activeTool === "select") {
      canvas.isDrawingMode = false;
      canvas.defaultCursor = "default";
      canvas.hoverCursor = "move";
      canvas.selection = true;
      canvas.skipTargetFind = false;
    } else if (activeTool === "pan") {
      canvas.isDrawingMode = false;
      canvas.defaultCursor = "grab";
      canvas.hoverCursor = "grab";
      canvas.selection = false;
      canvas.skipTargetFind = false;
    } else if (activeTool === "draw") {
      // Eraser editing mode — crosshair cursor, prevent object interaction
      canvas.isDrawingMode = false;
      canvas.defaultCursor = "crosshair";
      canvas.hoverCursor = "crosshair";
      canvas.selection = false;
      canvas.skipTargetFind = true;
    }
    canvas.renderAll();
  }, [canvas, activeTool]);

  // Pan with space + drag — uses CSS transform, not Fabric.js viewport
  const isEditingText = useCanvasStore((s) => s.isEditingText);
  const panRef = useRef({ x: 0, y: 0 });
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Reset pan when zoom changes via toolbar (zoom-to-fit)
  useEffect(() => {
    const handleZoomReset = () => {
      panRef.current = { x: 0, y: 0 };
      setPan({ x: 0, y: 0 });
    };
    document.addEventListener("studio:zoom-to-fit", handleZoomReset);
    return () => document.removeEventListener("studio:zoom-to-fit", handleZoomReset);
  }, []);

  useEffect(() => {
    if (!canvas) return;
    let isPanning = false;
    let lastX = 0;
    let lastY = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditingText) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.code === "Space" && activeTool === "select") {
        e.preventDefault();
        canvas.defaultCursor = "grab";
        canvas.selection = false;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isEditingText) {
        // Restore cursor based on current activeTool
        const tool = useCanvasStore.getState().activeTool;
        if (tool === "pan") {
          canvas.defaultCursor = "grab";
        } else if (tool === "draw") {
          canvas.defaultCursor = "crosshair";
        } else {
          canvas.defaultCursor = "default";
        }
        canvas.selection = tool === "select";
        isPanning = false;
      }
    };

    const handleMouseDown = (opt: any) => {
      const e = opt.e as MouseEvent;
      // Pan if: holding Alt, or cursor is grab (space held / pan tool), or activeTool is pan
      if (e.altKey || canvas.defaultCursor === "grab" || activeTool === "pan") {
        isPanning = true;
        lastX = e.clientX;
        lastY = e.clientY;
        canvas.defaultCursor = "grabbing";
        canvas.hoverCursor = "grabbing";
      }
    };

    const handleMouseMove = (opt: any) => {
      if (!isPanning) return;
      const e = opt.e as MouseEvent;
      panRef.current = {
        x: panRef.current.x + (e.clientX - lastX),
        y: panRef.current.y + (e.clientY - lastY),
      };
      setPan({ ...panRef.current });
      lastX = e.clientX;
      lastY = e.clientY;
    };

    const handleMouseUp = () => {
      if (isPanning) {
        isPanning = false;
        // Restore cursor based on current activeTool
        const tool = useCanvasStore.getState().activeTool;
        if (tool === "pan") {
          canvas.defaultCursor = "grab";
          canvas.hoverCursor = "grab";
        } else if (tool === "draw") {
          canvas.defaultCursor = "crosshair";
          canvas.hoverCursor = "crosshair";
        } else {
          canvas.defaultCursor = "default";
          canvas.hoverCursor = "move";
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    canvas.on("mouse:down", handleMouseDown);
    canvas.on("mouse:move", handleMouseMove);
    canvas.on("mouse:up", handleMouseUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      canvas.off("mouse:down", handleMouseDown);
      canvas.off("mouse:move", handleMouseMove);
      canvas.off("mouse:up", handleMouseUp);
    };
  }, [canvas, activeTool, isEditingText]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900 flex items-center justify-center relative"
      style={{ minHeight: 0 }}
    >
      <div
        className="relative shadow-2xl ring-1 ring-gray-300 dark:ring-gray-600"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "center center",
          transition: "none",
        }}
      >
        {/* Checkerboard for transparency */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(45deg, #e5e7eb 25%, transparent 25%),
              linear-gradient(-45deg, #e5e7eb 25%, transparent 25%),
              linear-gradient(45deg, transparent 75%, #e5e7eb 75%),
              linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)`,
            backgroundSize: "20px 20px",
            backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
          }}
        />
        <canvas ref={canvasElRef} />
      </div>
    </div>
  );
}
