"use client";

import { useState, useEffect } from "react";
import { Type, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useCanvasStore } from "../hooks/use-canvas-store";
import {
  createHeading,
  createSubheading,
  createBody,
  createTextbox,
  centerObject,
} from "../utils/canvas-helpers";
import { POPULAR_FONTS, loadGoogleFont, loadDefaultFonts } from "../utils/font-loader";

const TEXT_PRESETS = [
  {
    id: "heading",
    label: "Add a heading",
    preview: "Heading",
    style: "text-2xl font-bold",
    create: createHeading,
  },
  {
    id: "subheading",
    label: "Add a subheading",
    preview: "Subheading",
    style: "text-lg font-semibold",
    create: createSubheading,
  },
  {
    id: "body",
    label: "Add body text",
    preview: "Body text",
    style: "text-sm",
    create: createBody,
  },
];

export function TextPanel() {
  const canvas = useCanvasStore((s) => s.canvas);
  const [fontSearch, setFontSearch] = useState("");

  useEffect(() => {
    loadDefaultFonts();
  }, []);

  const filteredFonts = POPULAR_FONTS.filter((f) =>
    f.toLowerCase().includes(fontSearch.toLowerCase())
  );

  const handleAddPreset = async (preset: (typeof TEXT_PRESETS)[0]) => {
    if (!canvas) return;
    const fabric = await import("fabric");
    const obj = preset.create(fabric);
    centerObject(canvas, obj);
    canvas.add(obj);
    canvas.setActiveObject(obj);
    canvas.renderAll();
  };

  const handleAddFontText = async (fontFamily: string) => {
    if (!canvas) return;
    await loadGoogleFont(fontFamily);
    const fabric = await import("fabric");
    const obj = createTextbox(fabric, {
      fontFamily,
      text: fontFamily,
      fontSize: 36,
    });
    centerObject(canvas, obj);
    canvas.add(obj);
    canvas.setActiveObject(obj);
    canvas.renderAll();
  };

  return (
    <div className="p-3">
      <h3 className="text-sm font-semibold mb-3">Text</h3>

      {/* Text presets */}
      <div className="space-y-2 mb-6">
        {TEXT_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => handleAddPreset(preset)}
            className="w-full text-left px-3 py-3 rounded-lg border border-border hover:border-brand-500 hover:bg-brand-500/5 transition-colors"
          >
            <div className={preset.style}>{preset.preview}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {preset.label}
            </div>
          </button>
        ))}
      </div>

      {/* Font browser */}
      <h3 className="text-sm font-semibold mb-2">Fonts</h3>
      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search fonts..."
          value={fontSearch}
          onChange={(e) => setFontSearch(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>

      <div className="space-y-1 max-h-[400px] overflow-y-auto">
        {filteredFonts.map((font) => (
          <button
            key={font}
            onClick={() => handleAddFontText(font)}
            onMouseEnter={() => loadGoogleFont(font)}
            className="w-full text-left px-3 py-2 rounded hover:bg-muted transition-colors flex items-center gap-2"
          >
            <Type className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span
              className="text-sm truncate"
              style={{ fontFamily: font }}
            >
              {font}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
