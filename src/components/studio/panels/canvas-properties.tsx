"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useCanvasStore } from "../hooks/use-canvas-store";
import { DESIGN_CATEGORIES } from "@/lib/constants/design-presets";

export function CanvasProperties() {
  const { canvasWidth, canvasHeight, setCanvasDimensions, canvas } = useCanvasStore();
  const [customW, setCustomW] = useState(canvasWidth);
  const [customH, setCustomH] = useState(canvasHeight);

  const applySize = (w: number, h: number) => {
    setCustomW(w);
    setCustomH(h);
    setCanvasDimensions(w, h);
  };

  return (
    <div className="p-3 space-y-4">
      <h3 className="text-sm font-semibold">Canvas</h3>

      {/* Custom Size */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Size</label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-[10px] text-muted-foreground">Width</span>
            <Input
              type="number"
              value={customW}
              onChange={(e) => setCustomW(parseInt(e.target.value) || 1)}
              onBlur={() => applySize(customW, customH)}
              onKeyDown={(e) => { if (e.key === "Enter") applySize(customW, customH); }}
              className="h-8 text-xs"
            />
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground">Height</span>
            <Input
              type="number"
              value={customH}
              onChange={(e) => setCustomH(parseInt(e.target.value) || 1)}
              onBlur={() => applySize(customW, customH)}
              onKeyDown={(e) => { if (e.key === "Enter") applySize(customW, customH); }}
              className="h-8 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Presets */}
      <div>
        <label className="text-xs text-muted-foreground mb-2 block">Presets</label>
        <div className="space-y-3">
          {DESIGN_CATEGORIES.map((cat) => (
            <div key={cat.id}>
              <div className="text-xs font-medium mb-1">{cat.name}</div>
              <div className="space-y-0.5">
                {cat.presets.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => applySize(preset.width, preset.height)}
                    className={`w-full text-left px-2 py-1 rounded text-xs hover:bg-muted transition-colors flex justify-between ${
                      canvasWidth === preset.width && canvasHeight === preset.height
                        ? "bg-brand-500/10 text-brand-600"
                        : "text-muted-foreground"
                    }`}
                  >
                    <span>{preset.name}</span>
                    <span className="font-mono">{preset.width}x{preset.height}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Background Color */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Background Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={(typeof canvas?.backgroundColor === "string" ? canvas.backgroundColor : "#ffffff")}
            onChange={(e) => {
              if (!canvas) return;
              canvas.backgroundColor = e.target.value;
              canvas.renderAll();
            }}
            className="w-8 h-8 rounded cursor-pointer border"
          />
          <Input
            value={(typeof canvas?.backgroundColor === "string" ? canvas.backgroundColor : "#ffffff")}
            onChange={(e) => {
              if (!canvas) return;
              if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
                canvas.backgroundColor = e.target.value;
                canvas.renderAll();
              }
            }}
            className="h-8 text-xs font-mono flex-1"
          />
        </div>
      </div>
    </div>
  );
}
