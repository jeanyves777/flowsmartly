"use client";

import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { useCanvasStore } from "../hooks/use-canvas-store";
import { TextProperties } from "./text-properties";
import { ShapeProperties } from "./shape-properties";
import { ImageProperties } from "./image-properties";
import { CanvasProperties } from "./canvas-properties";
import { LayersPanel } from "./layers-panel";

export function RightPanel() {
  const selectedObjectType = useCanvasStore((s) => s.selectedObjectType);
  const isRightPanelCollapsed = useCanvasStore((s) => s.isRightPanelCollapsed);
  const toggleRightPanel = useCanvasStore((s) => s.toggleRightPanel);

  if (isRightPanelCollapsed) {
    return (
      <div className="shrink-0 border-l bg-background flex flex-col items-center py-2">
        <button
          onClick={toggleRightPanel}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="Expand properties panel"
        >
          <PanelRightOpen className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const renderProperties = () => {
    switch (selectedObjectType) {
      case "textbox":
      case "text":
      case "i-text":
        return <TextProperties />;
      case "image":
        return <ImageProperties />;
      case "rect":
      case "circle":
      case "triangle":
      case "polygon":
      case "line":
      case "path":
        return <ShapeProperties />;
      case "group":
      case "activeSelection":
        return <ShapeProperties />;
      default:
        return <CanvasProperties />;
    }
  };

  return (
    <div className="w-[280px] border-l bg-background flex flex-col shrink-0 overflow-hidden">
      {/* Header with collapse button */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b shrink-0">
        <span className="text-xs font-medium text-muted-foreground">Properties</span>
        <button
          onClick={toggleRightPanel}
          className="flex items-center justify-center w-6 h-6 rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="Collapse panel"
        >
          <PanelRightClose className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Properties section */}
      <div className="flex-1 overflow-y-auto">
        {renderProperties()}
      </div>

      {/* Layers section (bottom) */}
      <div className="border-t">
        <LayersPanel />
      </div>
    </div>
  );
}
