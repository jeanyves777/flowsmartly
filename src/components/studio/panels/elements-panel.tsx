"use client";

import {
  Square,
  Circle,
  Triangle,
  Minus,
  ArrowRight,
  ArrowLeftRight,
  Star,
  Hexagon,
  Pentagon,
  Octagon,
  Diamond,
  Heart,
  Plus,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { useCanvasStore } from "../hooks/use-canvas-store";
import {
  createRect,
  createCircle,
  createTriangle,
  createLine,
  createArrow,
  createStar,
  createPentagon,
  createHexagon,
  createOctagon,
  createDiamond,
  createHeart,
  createPlusIcon,
  createSpeechBubble,
  createBurst,
  createDoubleArrow,
  centerObject,
} from "../utils/canvas-helpers";

interface ShapeItem {
  id: string;
  icon: React.ElementType;
  label: string;
  create: (fabric: any, canvas: any) => any;
}

const SHAPES: ShapeItem[] = [
  { id: "rect", icon: Square, label: "Rectangle", create: (fabric, canvas) => { const o = createRect(fabric); centerObject(canvas, o); return o; } },
  { id: "circle", icon: Circle, label: "Circle", create: (fabric, canvas) => { const o = createCircle(fabric); centerObject(canvas, o); return o; } },
  { id: "triangle", icon: Triangle, label: "Triangle", create: (fabric, canvas) => { const o = createTriangle(fabric); centerObject(canvas, o); return o; } },
  { id: "diamond", icon: Diamond, label: "Diamond", create: (fabric, canvas) => { const o = createDiamond(fabric); centerObject(canvas, o); return o; } },
  { id: "pentagon", icon: Pentagon, label: "Pentagon", create: (fabric, canvas) => { const o = createPentagon(fabric); centerObject(canvas, o); return o; } },
  { id: "hexagon", icon: Hexagon, label: "Hexagon", create: (fabric, canvas) => { const o = createHexagon(fabric); centerObject(canvas, o); return o; } },
  { id: "octagon", icon: Octagon, label: "Octagon", create: (fabric, canvas) => { const o = createOctagon(fabric); centerObject(canvas, o); return o; } },
  { id: "star", icon: Star, label: "Star", create: (fabric, canvas) => { const o = createStar(fabric); centerObject(canvas, o); return o; } },
  { id: "burst", icon: Sparkles, label: "Burst", create: (fabric, canvas) => { const o = createBurst(fabric); centerObject(canvas, o); return o; } },
  { id: "heart", icon: Heart, label: "Heart", create: (fabric, canvas) => { const o = createHeart(fabric); centerObject(canvas, o); return o; } },
  { id: "plus", icon: Plus, label: "Plus", create: (fabric, canvas) => { const o = createPlusIcon(fabric); centerObject(canvas, o); return o; } },
  { id: "speech", icon: MessageCircle, label: "Speech", create: (fabric, canvas) => { const o = createSpeechBubble(fabric); centerObject(canvas, o); return o; } },
  { id: "line", icon: Minus, label: "Line", create: (fabric) => createLine(fabric) },
  { id: "arrow", icon: ArrowRight, label: "Arrow", create: (fabric) => createArrow(fabric) },
  { id: "double-arrow", icon: ArrowLeftRight, label: "Double Arrow", create: (fabric) => createDoubleArrow(fabric) },
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
