"use client";

import { useState } from "react";
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  ChevronDown,
  ChevronRight,
  Trash2,
  Layers,
  Type,
  Image as ImageIcon,
  Square,
  Circle,
  Triangle,
  Minus,
  Star,
  Group,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { useCanvasStore, type LayerInfo } from "../hooks/use-canvas-store";

const TYPE_ICONS: Record<string, React.ElementType> = {
  textbox: Type,
  text: Type,
  "i-text": Type,
  image: ImageIcon,
  rect: Square,
  circle: Circle,
  triangle: Triangle,
  line: Minus,
  polygon: Star,
  group: Group,
};

export function LayersPanel() {
  const { canvas, layers, refreshLayers } = useCanvasStore();
  const [collapsed, setCollapsed] = useState(false);

  const handleSelect = (layer: LayerInfo) => {
    if (!canvas) return;
    const objects = canvas.getObjects();
    // Find the object by id (layers are reversed, so un-reverse index)
    const obj = objects.find((o: any) => o.id === layer.id);
    if (obj) {
      canvas.setActiveObject(obj);
      canvas.renderAll();
    }
  };

  const handleToggleVisibility = (layer: LayerInfo) => {
    if (!canvas) return;
    const obj = canvas.getObjects().find((o: any) => o.id === layer.id);
    if (obj) {
      obj.set("visible", !layer.visible);
      canvas.renderAll();
      refreshLayers();
    }
  };

  const handleToggleLock = (layer: LayerInfo) => {
    if (!canvas) return;
    const obj = canvas.getObjects().find((o: any) => o.id === layer.id);
    if (obj) {
      obj.set({
        selectable: layer.locked,
        evented: layer.locked,
      });
      canvas.renderAll();
      refreshLayers();
    }
  };

  const handleDelete = (layer: LayerInfo) => {
    if (!canvas) return;
    const obj = canvas.getObjects().find((o: any) => o.id === layer.id);
    if (obj) {
      canvas.remove(obj);
      canvas.renderAll();
      refreshLayers();
    }
  };

  return (
    <div className="max-h-[250px]">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
        <Layers className="h-3.5 w-3.5" />
        Layers
        <span className="text-xs text-muted-foreground ml-auto">
          {layers.length}
        </span>
      </button>

      {/* Layer list */}
      {!collapsed && (
        <div className="overflow-y-auto max-h-[200px]">
          {layers.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">
              No layers yet
            </div>
          ) : (
            layers.map((layer) => {
              const Icon = TYPE_ICONS[layer.type] || Square;
              return (
                <div
                  key={layer.id}
                  onClick={() => handleSelect(layer)}
                  className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-muted/50 cursor-pointer group text-xs"
                >
                  <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className={cn(
                    "truncate flex-1",
                    !layer.visible && "opacity-40 line-through"
                  )}>
                    {layer.name}
                  </span>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleVisibility(layer); }}
                      className="p-0.5 rounded hover:bg-muted"
                      title={layer.visible ? "Hide" : "Show"}
                    >
                      {layer.visible ? (
                        <Eye className="h-3 w-3" />
                      ) : (
                        <EyeOff className="h-3 w-3 text-muted-foreground" />
                      )}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleLock(layer); }}
                      className="p-0.5 rounded hover:bg-muted"
                      title={layer.locked ? "Unlock" : "Lock"}
                    >
                      {layer.locked ? (
                        <Lock className="h-3 w-3 text-amber-500" />
                      ) : (
                        <Unlock className="h-3 w-3" />
                      )}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(layer); }}
                      className="p-0.5 rounded hover:bg-destructive/20 text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
