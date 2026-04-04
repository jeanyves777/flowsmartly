"use client";

import { useState } from "react";
import { useWebsiteEditorStore } from "@/stores/website-editor-store";
import { ColorPickerPopover } from "./color-picker-popover";

interface GradientBuilderProps {
  value: string;
  onChange: (gradient: string) => void;
  label?: string;
}

const DIRECTIONS = [
  { label: "→", value: "to right", css: "90deg" },
  { label: "↘", value: "to bottom right", css: "135deg" },
  { label: "↓", value: "to bottom", css: "180deg" },
  { label: "↙", value: "to bottom left", css: "225deg" },
  { label: "←", value: "to left", css: "270deg" },
  { label: "↖", value: "to top left", css: "315deg" },
  { label: "↑", value: "to top", css: "0deg" },
  { label: "↗", value: "to top right", css: "45deg" },
];

export function GradientBuilder({ value, onChange, label }: GradientBuilderProps) {
  const theme = useWebsiteEditorStore((s) => s.theme);

  const [color1, setColor1] = useState(theme.colors.primary);
  const [color2, setColor2] = useState(theme.colors.secondary);
  const [direction, setDirection] = useState("135deg");

  const buildGradient = (c1: string, c2: string, dir: string) => {
    const g = `linear-gradient(${dir}, ${c1}, ${c2})`;
    onChange(g);
    return g;
  };

  // Brand gradient presets
  const presets = [
    { label: "Primary → Secondary", c1: theme.colors.primary, c2: theme.colors.secondary },
    { label: "Primary → Accent", c1: theme.colors.primary, c2: theme.colors.accent },
    { label: "Secondary → Accent", c1: theme.colors.secondary, c2: theme.colors.accent },
    { label: "Dark → Primary", c1: theme.colors.text, c2: theme.colors.primary },
  ];

  return (
    <div>
      {label && <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>}

      {/* Preview */}
      <div className="h-12 rounded-lg border border-border mb-3" style={{ background: value || `linear-gradient(${direction}, ${color1}, ${color2})` }} />

      {/* Presets */}
      <div className="grid grid-cols-2 gap-1.5 mb-3">
        {presets.map((p, i) => (
          <button
            key={i}
            onClick={() => {
              setColor1(p.c1);
              setColor2(p.c2);
              buildGradient(p.c1, p.c2, direction);
            }}
            className="h-8 rounded-md border border-border hover:ring-1 hover:ring-primary transition-all text-[10px] font-medium text-white flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${p.c1}, ${p.c2})` }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Direction */}
      <div className="mb-3">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Direction</p>
        <div className="flex gap-1">
          {DIRECTIONS.map((d) => (
            <button
              key={d.css}
              onClick={() => {
                setDirection(d.css);
                buildGradient(color1, color2, d.css);
              }}
              className={`w-7 h-7 rounded text-xs flex items-center justify-center transition-colors ${direction === d.css ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Color stops */}
      <div className="grid grid-cols-2 gap-2">
        <ColorPickerPopover label="Start" value={color1} onChange={(c) => { setColor1(c); buildGradient(c, color2, direction); }} />
        <ColorPickerPopover label="End" value={color2} onChange={(c) => { setColor2(c); buildGradient(color1, c, direction); }} />
      </div>

      {/* Clear */}
      {value && (
        <button onClick={() => onChange("")} className="mt-2 text-xs text-muted-foreground hover:text-foreground">
          Remove gradient
        </button>
      )}
    </div>
  );
}
