"use client";

import { useEffect, useRef, useCallback } from "react";
import { useCanvasStore } from "./hooks/use-canvas-store";
import { useCanvasHistory } from "./hooks/use-canvas-history";
import { useCanvasShortcuts } from "./hooks/use-canvas-shortcuts";

export function CanvasEditor() {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fabricRef = useRef<any>(null);

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

      setCanvas(fabricCanvas);

      // Push initial state
      setTimeout(() => pushState(), 100);
    })();

    return () => {
      if (fabricCanvas) {
        fabricCanvas.dispose();
        setCanvas(null);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update canvas dimensions when they change
  useEffect(() => {
    if (!canvas) return;
    canvas.setDimensions({ width: canvasWidth, height: canvasHeight });
    canvas.renderAll();
  }, [canvas, canvasWidth, canvasHeight]);

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

  // Zoom with mouse wheel (Ctrl + scroll)
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

      // Zoom toward mouse position
      const point = canvas.getScenePoint(e);
      canvas.zoomToPoint(point, newZoom);
      setZoom(newZoom);
    };

    canvas.on("mouse:wheel", handleWheel);
    return () => {
      canvas.off("mouse:wheel", handleWheel);
    };
  }, [canvas, zoom, setZoom]);

  // Pan with space + drag
  useEffect(() => {
    if (!canvas) return;
    let isPanning = false;
    let lastX = 0;
    let lastY = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && activeTool === "select") {
        e.preventDefault();
        canvas.defaultCursor = "grab";
        canvas.selection = false;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        canvas.defaultCursor = "default";
        canvas.selection = true;
        isPanning = false;
      }
    };

    const handleMouseDown = (opt: any) => {
      const e = opt.e as MouseEvent;
      if (e.altKey || (canvas.defaultCursor === "grab")) {
        isPanning = true;
        lastX = e.clientX;
        lastY = e.clientY;
        canvas.defaultCursor = "grabbing";
      }
    };

    const handleMouseMove = (opt: any) => {
      if (!isPanning) return;
      const e = opt.e as MouseEvent;
      const vpt = canvas.viewportTransform;
      if (vpt) {
        vpt[4] += e.clientX - lastX;
        vpt[5] += e.clientY - lastY;
        canvas.requestRenderAll();
        lastX = e.clientX;
        lastY = e.clientY;
      }
    };

    const handleMouseUp = () => {
      if (isPanning) {
        isPanning = false;
        canvas.defaultCursor = "default";
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
  }, [canvas, activeTool]);

  // Calculate scale to fit canvas in viewport
  const containerPadding = 40;

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900 flex items-center justify-center relative"
      style={{ minHeight: 0 }}
    >
      <div
        className="relative shadow-2xl"
        style={{
          transform: `scale(${zoom})`,
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
