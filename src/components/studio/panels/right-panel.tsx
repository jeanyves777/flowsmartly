"use client";

import { useCanvasStore } from "../hooks/use-canvas-store";
import { TextProperties } from "./text-properties";
import { ShapeProperties } from "./shape-properties";
import { ImageProperties } from "./image-properties";
import { CanvasProperties } from "./canvas-properties";
import { LayersPanel } from "./layers-panel";

export function RightPanel() {
  const selectedObjectType = useCanvasStore((s) => s.selectedObjectType);

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
