"use client";

import {
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  ArrowUpToLine,
  ArrowDownToLine,
  ArrowUp,
  ArrowDown,
  FlipHorizontal2,
  FlipVertical2,
  Copy,
  Trash2,
  Group,
  Ungroup,
  Pipette,
  PaintBucket,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { copyStyle, pasteStyle, hasCopiedStyle } from "../utils/style-clipboard";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCanvasStore } from "../hooks/use-canvas-store";
import { useCanvasHistory } from "../hooks/use-canvas-history";

interface ToolAction {
  icon: React.ElementType;
  label: string;
  action: () => void;
}

export function BottomToolbar() {
  const canvas = useCanvasStore((s) => s.canvas);
  const canvasWidth = useCanvasStore((s) => s.canvasWidth);
  const canvasHeight = useCanvasStore((s) => s.canvasHeight);
  const zoom = useCanvasStore((s) => s.zoom);
  const selectedObjectIds = useCanvasStore((s) => s.selectedObjectIds);
  const refreshLayers = useCanvasStore((s) => s.refreshLayers);
  const setDirty = useCanvasStore((s) => s.setDirty);
  const isReadOnly = useCanvasStore((s) => s.isReadOnly);
  const { pushState } = useCanvasHistory();
  const { toast } = useToast();
  // Re-render the paste button when clipboard state changes (selection-driven)
  const [, forceTick] = useState(0);
  useEffect(() => { forceTick((n) => n + 1); }, [selectedObjectIds]);

  const hasSelection = !isReadOnly && selectedObjectIds.length > 0;

  const getActiveObject = () => canvas?.getActiveObject?.();

  // Alignment
  const alignLeft = () => {
    const obj = getActiveObject();
    if (!obj) return;
    obj.set("left", 0);
    obj.setCoords();
    canvas.renderAll();
    pushState();
  };
  const alignCenterH = () => {
    const obj = getActiveObject();
    if (!obj) return;
    obj.set("left", (canvasWidth - (obj.width || 0) * (obj.scaleX || 1)) / 2);
    obj.setCoords();
    canvas.renderAll();
    pushState();
  };
  const alignRight = () => {
    const obj = getActiveObject();
    if (!obj) return;
    obj.set("left", canvasWidth - (obj.width || 0) * (obj.scaleX || 1));
    obj.setCoords();
    canvas.renderAll();
    pushState();
  };
  const alignTop = () => {
    const obj = getActiveObject();
    if (!obj) return;
    obj.set("top", 0);
    obj.setCoords();
    canvas.renderAll();
    pushState();
  };
  const alignCenterV = () => {
    const obj = getActiveObject();
    if (!obj) return;
    obj.set("top", (canvasHeight - (obj.height || 0) * (obj.scaleY || 1)) / 2);
    obj.setCoords();
    canvas.renderAll();
    pushState();
  };
  const alignBottom = () => {
    const obj = getActiveObject();
    if (!obj) return;
    obj.set("top", canvasHeight - (obj.height || 0) * (obj.scaleY || 1));
    obj.setCoords();
    canvas.renderAll();
    pushState();
  };

  // Distribute — evenly space the selected objects so the gap between
  // their centers (or edges) is constant. Requires 3+ objects, otherwise
  // there's nothing to distribute.
  // Reads centers from the parent activeSelection's child objects, which
  // give us each child's position relative to the selection origin; we
  // translate those to absolute canvas coords before computing the spread.
  const getSelectedObjectsAbsolute = (): Array<{
    obj: any;
    centerX: number;
    centerY: number;
    width: number;
    height: number;
  }> | null => {
    const active = getActiveObject();
    if (!active || active.type !== "activeSelection") return null;
    const items = (active as any).getObjects?.() ?? [];
    if (items.length < 3) return null;

    // Selection origin in absolute canvas coords (Fabric uses center origin
    // by default for activeSelection, so the children's left/top are
    // *relative* to the selection's center).
    const selW = (active.width || 0) * (active.scaleX || 1);
    const selH = (active.height || 0) * (active.scaleY || 1);
    const selOriginX = (active.left || 0) + (active.originX === "center" ? 0 : selW / 2);
    const selOriginY = (active.top || 0) + (active.originY === "center" ? 0 : selH / 2);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return items.map((o: any) => {
      const w = (o.width || 0) * (o.scaleX || 1);
      const h = (o.height || 0) * (o.scaleY || 1);
      // Each child's left/top is relative to selection center.
      const childLeft = (o.left || 0) + (o.originX === "center" ? -w / 2 : 0);
      const childTop = (o.top || 0) + (o.originY === "center" ? -h / 2 : 0);
      // Absolute top-left of the child on the canvas
      const absLeft = selOriginX + childLeft;
      const absTop = selOriginY + childTop;
      return {
        obj: o,
        centerX: absLeft + w / 2,
        centerY: absTop + h / 2,
        width: w,
        height: h,
      };
    });
  };

  const distributeHorizontally = () => {
    const items = getSelectedObjectsAbsolute();
    if (!items) {
      toast({
        title: "Select 3 or more objects to distribute",
        description: "Distribute spaces objects evenly between the leftmost and rightmost.",
        variant: "destructive",
      });
      return;
    }
    // Sort by current center X, then redistribute centers between min and max.
    const sorted = [...items].sort((a, b) => a.centerX - b.centerX);
    const first = sorted[0].centerX;
    const last = sorted[sorted.length - 1].centerX;
    const step = (last - first) / (sorted.length - 1);
    sorted.forEach((entry, idx) => {
      const targetCenter = first + step * idx;
      const delta = targetCenter - entry.centerX;
      // Each child's `left` is relative to the selection origin, so we
      // shift by the delta directly.
      entry.obj.set("left", (entry.obj.left || 0) + delta);
      entry.obj.setCoords();
    });
    canvas.requestRenderAll();
    refreshLayers();
    pushState();
    setDirty(true);
  };

  const distributeVertically = () => {
    const items = getSelectedObjectsAbsolute();
    if (!items) {
      toast({
        title: "Select 3 or more objects to distribute",
        description: "Distribute spaces objects evenly between the topmost and bottommost.",
        variant: "destructive",
      });
      return;
    }
    const sorted = [...items].sort((a, b) => a.centerY - b.centerY);
    const first = sorted[0].centerY;
    const last = sorted[sorted.length - 1].centerY;
    const step = (last - first) / (sorted.length - 1);
    sorted.forEach((entry, idx) => {
      const targetCenter = first + step * idx;
      const delta = targetCenter - entry.centerY;
      entry.obj.set("top", (entry.obj.top || 0) + delta);
      entry.obj.setCoords();
    });
    canvas.requestRenderAll();
    refreshLayers();
    pushState();
    setDirty(true);
  };

  // Z-order
  const bringToFront = () => {
    const obj = getActiveObject();
    if (!obj) return;
    canvas.bringObjectToFront(obj);
    canvas.renderAll();
    refreshLayers();
    pushState();
  };
  const bringForward = () => {
    const obj = getActiveObject();
    if (!obj) return;
    canvas.bringObjectForward(obj);
    canvas.renderAll();
    refreshLayers();
    pushState();
  };
  const sendBackward = () => {
    const obj = getActiveObject();
    if (!obj) return;
    canvas.sendObjectBackwards(obj);
    canvas.renderAll();
    refreshLayers();
    pushState();
  };
  const sendToBack = () => {
    const obj = getActiveObject();
    if (!obj) return;
    canvas.sendObjectToBack(obj);
    canvas.renderAll();
    refreshLayers();
    pushState();
  };

  // Flip
  const flipH = () => {
    const obj = getActiveObject();
    if (!obj) return;
    obj.set("flipX", !obj.flipX);
    canvas.renderAll();
    pushState();
  };
  const flipV = () => {
    const obj = getActiveObject();
    if (!obj) return;
    obj.set("flipY", !obj.flipY);
    canvas.renderAll();
    pushState();
  };

  // Duplicate
  const duplicate = async () => {
    const obj = getActiveObject();
    if (!obj) return;
    const cloned = await obj.clone();
    cloned.set({ left: (obj.left || 0) + 20, top: (obj.top || 0) + 20 });
    canvas.add(cloned);
    canvas.setActiveObject(cloned);
    canvas.renderAll();
    refreshLayers();
    pushState();
  };

  // Delete
  const deleteObj = () => {
    const obj = getActiveObject();
    if (!obj) return;
    canvas.remove(obj);
    canvas.discardActiveObject();
    canvas.renderAll();
    refreshLayers();
    pushState();
  };

  // Group selected objects into a single Fabric Group (Ctrl+G)
  const groupSelection = async () => {
    const obj = getActiveObject();
    if (!obj || obj.type !== "activeSelection") return;
    const fabric = await import("fabric");
    const items = (obj as any).getObjects?.() ?? [];
    if (items.length < 2) return;
    // Fabric v6: use toGroup() if available, otherwise build manually
    if (typeof (obj as any).toGroup === "function") {
      (obj as any).toGroup();
    } else {
      const group = new fabric.Group(items.map((o: any) => o));
      items.forEach((o: any) => canvas.remove(o));
      canvas.add(group);
      canvas.setActiveObject(group);
    }
    canvas.requestRenderAll();
    refreshLayers();
    pushState();
  };

  // Break a Group back into its component objects (Ctrl+Shift+G)
  const ungroupSelection = async () => {
    const obj = getActiveObject();
    if (!obj || obj.type !== "group") return;
    if (typeof (obj as any).toActiveSelection === "function") {
      (obj as any).toActiveSelection();
    } else {
      const items = (obj as any).getObjects?.() ?? [];
      canvas.remove(obj);
      items.forEach((o: any) => canvas.add(o));
    }
    canvas.requestRenderAll();
    refreshLayers();
    pushState();
  };

  // Detect what we can do with the current selection
  const activeObj = getActiveObject();
  const canGroup = activeObj?.type === "activeSelection";
  const canUngroup = activeObj?.type === "group";

  // Style copy/paste — Canva paint-bucket UX
  const copyObjectStyle = () => {
    const obj = getActiveObject();
    if (!obj) return;
    if (copyStyle(obj)) {
      toast({ title: "Style copied", description: "Select another object and press the paint bucket." });
    }
  };
  const pasteObjectStyle = () => {
    const obj = getActiveObject();
    if (!obj) return;
    if (pasteStyle(obj)) {
      canvas?.requestRenderAll?.();
      pushState();
      refreshLayers();
      toast({ title: "Style pasted" });
    } else {
      toast({ title: "Nothing to paste", description: "Copy a style first.", variant: "destructive" });
    }
  };
  const canPasteStyle = hasCopiedStyle();

  const alignActions: ToolAction[] = [
    { icon: AlignStartVertical, label: "Align Left", action: alignLeft },
    { icon: AlignCenterVertical, label: "Align Center", action: alignCenterH },
    { icon: AlignEndVertical, label: "Align Right", action: alignRight },
    { icon: AlignStartHorizontal, label: "Align Top", action: alignTop },
    { icon: AlignCenterHorizontal, label: "Align Middle", action: alignCenterV },
    { icon: AlignEndHorizontal, label: "Align Bottom", action: alignBottom },
  ];

  const orderActions: ToolAction[] = [
    { icon: ArrowUpToLine, label: "Bring to Front", action: bringToFront },
    { icon: ArrowUp, label: "Bring Forward", action: bringForward },
    { icon: ArrowDown, label: "Send Backward", action: sendBackward },
    { icon: ArrowDownToLine, label: "Send to Back", action: sendToBack },
  ];

  const transformActions: ToolAction[] = [
    { icon: FlipHorizontal2, label: "Flip Horizontal", action: flipH },
    { icon: FlipVertical2, label: "Flip Vertical", action: flipV },
  ];

  const quickActions: ToolAction[] = [
    { icon: Copy, label: "Duplicate", action: duplicate },
    { icon: Trash2, label: "Delete", action: deleteObj },
  ];

  const renderGroup = (actions: ToolAction[]) => (
    <div className="flex items-center gap-0.5">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Tooltip key={action.label}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={action.action}
                disabled={!hasSelection}
                aria-label={action.label}
              >
                <Icon className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {action.label}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className="h-9 border-t bg-background flex items-center justify-between px-3 shrink-0"
        role="toolbar"
        aria-label="Object actions"
      >
        {/* Left: Object tools */}
        <div className="flex items-center gap-1">
          {hasSelection && (
            <>
              {renderGroup(alignActions)}
              {/* Distribute — visible when 3+ objects are selected so users
                  discover it; tooltip explains why it's needed when active. */}
              {selectedObjectIds.length >= 3 && (
                <>
                  <div className="w-px h-4 bg-border mx-1" />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={distributeHorizontally}
                        aria-label="Distribute horizontally — even spacing left to right"
                      >
                        <AlignHorizontalDistributeCenter className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      Distribute horizontally
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={distributeVertically}
                        aria-label="Distribute vertically — even spacing top to bottom"
                      >
                        <AlignVerticalDistributeCenter className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      Distribute vertically
                    </TooltipContent>
                  </Tooltip>
                </>
              )}
              <div className="w-px h-4 bg-border mx-1" />
              {renderGroup(orderActions)}
              <div className="w-px h-4 bg-border mx-1" />
              {renderGroup(transformActions)}
              <div className="w-px h-4 bg-border mx-1" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={copyObjectStyle}
                    aria-label="Copy style"
                  >
                    <Pipette className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Copy style
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={pasteObjectStyle}
                    disabled={!canPasteStyle}
                    aria-label="Paste style"
                  >
                    <PaintBucket className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Paste style
                </TooltipContent>
              </Tooltip>
              {(canGroup || canUngroup) && (
                <>
                  <div className="w-px h-4 bg-border mx-1" />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={canGroup ? groupSelection : ungroupSelection}
                        aria-label={canGroup ? "Group selected (Ctrl+G)" : "Ungroup (Ctrl+Shift+G)"}
                      >
                        {canGroup ? (
                          <Group className="h-3.5 w-3.5" />
                        ) : (
                          <Ungroup className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {canGroup ? "Group (Ctrl+G)" : "Ungroup (Ctrl+Shift+G)"}
                    </TooltipContent>
                  </Tooltip>
                </>
              )}
              <div className="w-px h-4 bg-border mx-1" />
              {renderGroup(quickActions)}
            </>
          )}
          {!hasSelection && (
            <span className="text-[11px] text-muted-foreground">
              Select an object to see tools
            </span>
          )}
        </div>

        {/* Right: Canvas info */}
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
          <span>{canvasWidth} x {canvasHeight}</span>
          <span className="text-border">\u2022</span>
          <span>{Math.round(zoom * 100)}%</span>
        </div>
      </div>
    </TooltipProvider>
  );
}
