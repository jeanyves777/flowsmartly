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
} from "lucide-react";
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
  const isReadOnly = useCanvasStore((s) => s.isReadOnly);
  const { pushState } = useCanvasHistory();

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
      <div className="h-9 border-t bg-background flex items-center justify-between px-3 shrink-0">
        {/* Left: Object tools */}
        <div className="flex items-center gap-1">
          {hasSelection && (
            <>
              {renderGroup(alignActions)}
              <div className="w-px h-4 bg-border mx-1" />
              {renderGroup(orderActions)}
              <div className="w-px h-4 bg-border mx-1" />
              {renderGroup(transformActions)}
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
