"use client";

import { useState, useRef, useEffect } from "react";
import {
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Download,
  Share2,
  Save,
  FileImage,
  File,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useCanvasStore } from "../hooks/use-canvas-store";
import { useCanvasHistory } from "../hooks/use-canvas-history";
import { useCanvasExport } from "../hooks/use-canvas-export";
import { ShareDialog } from "../share-dialog";

export function TopToolbar() {
  const {
    designName,
    setDesignName,
    canvasWidth,
    canvasHeight,
    zoom,
    setZoom,
    canUndo,
    canRedo,
    canvas,
    isDirty,
  } = useCanvasStore();

  const { undo, redo } = useCanvasHistory();
  const { exportPNG, exportJPG, exportSVG, exportPDF } = useCanvasExport();

  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingZoom, setIsEditingZoom] = useState(false);
  const [zoomInputValue, setZoomInputValue] = useState("");
  const [showShareDialog, setShowShareDialog] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const zoomInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  useEffect(() => {
    if (isEditingZoom && zoomInputRef.current) {
      zoomInputRef.current.focus();
      zoomInputRef.current.select();
    }
  }, [isEditingZoom]);

  const handleNameSubmit = () => {
    setIsEditingName(false);
    if (!designName.trim()) {
      setDesignName("Untitled Design");
    }
  };

  const zoomPercent = Math.round(zoom * 100);

  const handleZoomIn = () => setZoom(Math.min(zoom + 0.1, 5));
  const handleZoomOut = () => setZoom(Math.max(zoom - 0.1, 0.1));
  const handleZoomFit = () => {
    if (!canvas) return;
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    document.dispatchEvent(new CustomEvent("studio:zoom-to-fit"));
  };

  const handleZoomInputSubmit = () => {
    setIsEditingZoom(false);
    const parsed = parseInt(zoomInputValue, 10);
    if (!isNaN(parsed) && parsed >= 10 && parsed <= 500) {
      setZoom(parsed / 100);
    }
  };

  const startEditingZoom = () => {
    setZoomInputValue(String(zoomPercent));
    setIsEditingZoom(true);
  };

  const handleSave = () => {
    document.dispatchEvent(new CustomEvent("studio:save"));
  };

  return (
    <div className="flex items-center justify-between h-12 px-3 border-b bg-background shrink-0">
      {/* Left: Design name + save */}
      <div className="flex items-center gap-2 min-w-0">
        {isEditingName ? (
          <input
            ref={nameInputRef}
            type="text"
            value={designName}
            onChange={(e) => setDesignName(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleNameSubmit();
              if (e.key === "Escape") {
                setIsEditingName(false);
              }
            }}
            className="text-sm font-medium bg-transparent border-b border-brand-500 outline-none px-1 max-w-[200px]"
          />
        ) : (
          <button
            onClick={() => setIsEditingName(true)}
            className="text-sm font-medium truncate max-w-[200px] hover:text-brand-600 transition-colors"
          >
            {designName}
            {isDirty && <span className="text-muted-foreground ml-1">*</span>}
          </button>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleSave}
          title="Save (Ctrl+S)"
        >
          <Save className="h-4 w-4" />
        </Button>
      </div>

      {/* Center: Undo/Redo + Canvas Size + Zoom */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 className="h-4 w-4" />
        </Button>

        <div className="h-4 w-px bg-border mx-1" />

        <span className="text-xs text-muted-foreground font-mono px-2">
          {canvasWidth} x {canvasHeight}
        </span>

        <div className="h-4 w-px bg-border mx-1" />

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleZoomOut}
          title="Zoom Out (-10%)"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>

        {isEditingZoom ? (
          <div className="flex items-center">
            <input
              ref={zoomInputRef}
              type="text"
              value={zoomInputValue}
              onChange={(e) => setZoomInputValue(e.target.value.replace(/[^0-9]/g, ""))}
              onBlur={handleZoomInputSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleZoomInputSubmit();
                if (e.key === "Escape") setIsEditingZoom(false);
              }}
              className="w-12 h-8 text-xs font-mono text-center bg-muted border rounded outline-none focus:ring-1 focus:ring-brand-500"
            />
            <span className="text-xs text-muted-foreground ml-0.5">%</span>
          </div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs font-mono min-w-[60px]"
                onDoubleClick={(e) => {
                  e.preventDefault();
                  startEditingZoom();
                }}
              >
                {zoomPercent}%
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              {[10, 25, 50, 75, 100, 125, 150, 200, 300].map((z) => (
                <DropdownMenuItem key={z} onClick={() => setZoom(z / 100)}>
                  {z}%
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleZoomFit}>Fit to Screen</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={startEditingZoom}>Custom...</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleZoomIn}
          title="Zoom In (+10%)"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>

      {/* Right: Export + Share */}
      <div className="flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5">
              <Download className="h-4 w-4" />
              Export
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => exportPNG()}>
              <FileImage className="h-4 w-4 mr-2" />
              PNG (High Quality)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportJPG()}>
              <FileImage className="h-4 w-4 mr-2" />
              JPG
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportSVG()}>
              <File className="h-4 w-4 mr-2" />
              SVG (Vector)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => exportPDF()}>
              <File className="h-4 w-4 mr-2" />
              PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="default"
          size="sm"
          className="h-8 gap-1.5 bg-gradient-to-r from-brand-500 to-purple-600 hover:from-brand-600 hover:to-purple-700"
          onClick={() => setShowShareDialog(true)}
        >
          <Share2 className="h-4 w-4" />
          Share
        </Button>
      </div>

      {/* Share Dialog */}
      <ShareDialog open={showShareDialog} onOpenChange={setShowShareDialog} />
    </div>
  );
}
