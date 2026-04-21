"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react";
import { useCanvasStore } from "../hooks/use-canvas-store";

const BLEND_MODES: Array<{ value: string; label: string }> = [
  { value: "source-over", label: "Normal" },
  { value: "multiply", label: "Multiply" },
  { value: "screen", label: "Screen" },
  { value: "overlay", label: "Overlay" },
  { value: "darken", label: "Darken" },
  { value: "lighten", label: "Lighten" },
  { value: "color-dodge", label: "Color Dodge" },
  { value: "color-burn", label: "Color Burn" },
  { value: "hard-light", label: "Hard Light" },
  { value: "soft-light", label: "Soft Light" },
  { value: "difference", label: "Difference" },
  { value: "exclusion", label: "Exclusion" },
  { value: "hue", label: "Hue" },
  { value: "saturation", label: "Saturation" },
  { value: "color", label: "Color" },
  { value: "luminosity", label: "Luminosity" },
];

/**
 * Drop-in blend-mode selector for any object that's currently active on the
 * Fabric canvas. Reads from `globalCompositeOperation` because that's what
 * Fabric stores per object — it serializes natively in toJSON, so saved
 * designs preserve the choice.
 */
export function BlendModeSelect() {
  const canvas = useCanvasStore((s) => s.canvas);
  const selectedObjectIds = useCanvasStore((s) => s.selectedObjectIds);
  const [value, setValue] = useState("source-over");

  useEffect(() => {
    const obj = canvas?.getActiveObject?.();
    if (!obj) return;
    setValue(obj.globalCompositeOperation || "source-over");
  }, [canvas, selectedObjectIds]);

  const handleChange = (next: string) => {
    setValue(next);
    const obj = canvas?.getActiveObject?.();
    if (!obj) return;
    obj.set("globalCompositeOperation", next);
    canvas.requestRenderAll();
  };

  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">
        Blend Mode
      </label>
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        aria-label="Blend mode"
        className="w-full h-8 px-2 text-xs border rounded-md bg-background hover:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        {BLEND_MODES.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
    </div>
  );
}
