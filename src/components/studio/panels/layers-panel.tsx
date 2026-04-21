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
  activeSelection: Group,
};

/**
 * Recursively walk the Fabric tree (canvas objects + nested groups) to find
 * an object by id. We can't rely on `canvas.getObjects()` alone because group
 * children aren't on the top-level list.
 */
function findObjectById(canvas: any, id: string): any | null {
  if (!canvas) return null;
  const queue: any[] = [...canvas.getObjects()];
  while (queue.length) {
    const obj = queue.shift();
    if (obj.id === id) return obj;
    if (typeof obj.getObjects === "function") {
      queue.push(...obj.getObjects());
    }
  }
  return null;
}

export function LayersPanel() {
  const { canvas, layers, refreshLayers } = useCanvasStore();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelect = (layer: LayerInfo) => {
    if (!canvas) return;
    const obj = findObjectById(canvas, layer.id);
    if (obj) {
      canvas.setActiveObject(obj);
      canvas.renderAll();
    }
  };

  const handleToggleVisibility = (layer: LayerInfo) => {
    if (!canvas) return;
    const obj = findObjectById(canvas, layer.id);
    if (obj) {
      obj.set("visible", !layer.visible);
      canvas.renderAll();
      refreshLayers();
    }
  };

  const handleToggleLock = (layer: LayerInfo) => {
    if (!canvas) return;
    const obj = findObjectById(canvas, layer.id);
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
    const obj = findObjectById(canvas, layer.id);
    if (obj) {
      canvas.remove(obj);
      canvas.renderAll();
      refreshLayers();
    }
  };

  const renderLayer = (layer: LayerInfo, depth: number) => {
    const Icon = TYPE_ICONS[layer.type] || Square;
    const isGroup = (layer.children?.length ?? 0) > 0;
    const isOpen = expandedGroups.has(layer.id);

    return (
      <div key={layer.id}>
        <div
          onClick={() => handleSelect(layer)}
          className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-muted/50 cursor-pointer group text-xs"
          style={{ paddingLeft: `${8 + depth * 14}px` }}
          role="treeitem"
          aria-expanded={isGroup ? isOpen : undefined}
        >
          {isGroup ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleGroup(layer.id);
              }}
              className="p-0.5 -ml-0.5 rounded hover:bg-muted shrink-0"
              aria-label={isOpen ? "Collapse group" : "Expand group"}
            >
              {isOpen ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}
          <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span
            className={cn(
              "truncate flex-1",
              !layer.visible && "opacity-40 line-through",
            )}
          >
            {layer.name}
            {isGroup && (
              <span className="ml-1 text-[10px] text-muted-foreground">
                ({layer.children!.length})
              </span>
            )}
          </span>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggleVisibility(layer);
              }}
              className="p-0.5 rounded hover:bg-muted"
              title={layer.visible ? "Hide" : "Show"}
              aria-label={layer.visible ? "Hide layer" : "Show layer"}
            >
              {layer.visible ? (
                <Eye className="h-3 w-3" />
              ) : (
                <EyeOff className="h-3 w-3 text-muted-foreground" />
              )}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggleLock(layer);
              }}
              className="p-0.5 rounded hover:bg-muted"
              title={layer.locked ? "Unlock" : "Lock"}
              aria-label={layer.locked ? "Unlock layer" : "Lock layer"}
            >
              {layer.locked ? (
                <Lock className="h-3 w-3 text-amber-500" />
              ) : (
                <Unlock className="h-3 w-3" />
              )}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(layer);
              }}
              className="p-0.5 rounded hover:bg-destructive/20 text-destructive"
              title="Delete"
              aria-label="Delete layer"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>

        {isGroup && isOpen && (
          <div role="group">
            {layer.children!.map((child) => renderLayer(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-h-[250px]">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
        aria-expanded={!collapsed}
        aria-controls="studio-layers-tree"
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

      {/* Layer tree */}
      {!collapsed && (
        <div
          id="studio-layers-tree"
          role="tree"
          className="overflow-y-auto max-h-[200px]"
        >
          {layers.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">
              No layers yet
            </div>
          ) : (
            layers.map((layer) => renderLayer(layer, 0))
          )}
        </div>
      )}
    </div>
  );
}
