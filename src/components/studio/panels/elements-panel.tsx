"use client";

import {
  Square,
  Circle,
  Triangle,
  Minus,
  ArrowRight,
  Star,
} from "lucide-react";
import { useCanvasStore } from "../hooks/use-canvas-store";
import {
  createRect,
  createCircle,
  createTriangle,
  createLine,
  createArrow,
  createStar,
  centerObject,
} from "../utils/canvas-helpers";

interface ShapeItem {
  id: string;
  icon: React.ElementType;
  label: string;
  create: (fabric: any, canvas: any) => any;
}

const SHAPES: ShapeItem[] = [
  {
    id: "rect",
    icon: Square,
    label: "Rectangle",
    create: (fabric, canvas) => {
      const obj = createRect(fabric);
      centerObject(canvas, obj);
      return obj;
    },
  },
  {
    id: "circle",
    icon: Circle,
    label: "Circle",
    create: (fabric, canvas) => {
      const obj = createCircle(fabric);
      centerObject(canvas, obj);
      return obj;
    },
  },
  {
    id: "triangle",
    icon: Triangle,
    label: "Triangle",
    create: (fabric, canvas) => {
      const obj = createTriangle(fabric);
      centerObject(canvas, obj);
      return obj;
    },
  },
  {
    id: "line",
    icon: Minus,
    label: "Line",
    create: (fabric) => createLine(fabric),
  },
  {
    id: "arrow",
    icon: ArrowRight,
    label: "Arrow",
    create: (fabric) => createArrow(fabric),
  },
  {
    id: "star",
    icon: Star,
    label: "Star",
    create: (fabric, canvas) => {
      const obj = createStar(fabric);
      centerObject(canvas, obj);
      return obj;
    },
  },
];

export function ElementsPanel() {
  const canvas = useCanvasStore((s) => s.canvas);

  const handleAddShape = async (shape: ShapeItem) => {
    if (!canvas) return;
    const fabric = await import("fabric");
    const obj = shape.create(fabric, canvas);
    canvas.add(obj);
    canvas.setActiveObject(obj);
    canvas.renderAll();
  };

  return (
    <div className="p-3">
      <h3 className="text-sm font-semibold mb-3">Shapes</h3>
      <div className="grid grid-cols-3 gap-2">
        {SHAPES.map((shape) => {
          const Icon = shape.icon;
          return (
            <button
              key={shape.id}
              onClick={() => handleAddShape(shape)}
              className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border border-border hover:border-brand-500 hover:bg-brand-500/5 transition-colors"
            >
              <Icon className="h-6 w-6 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">
                {shape.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold mb-3">Quick Add</h3>
        <div className="space-y-2">
          <button
            onClick={() => handleAddShape(SHAPES[0])}
            className="w-full h-16 rounded-lg border-2 border-dashed border-border hover:border-brand-500 flex items-center justify-center text-sm text-muted-foreground hover:text-brand-600 transition-colors"
          >
            + Add Shape to Canvas
          </button>
        </div>
      </div>
    </div>
  );
}
