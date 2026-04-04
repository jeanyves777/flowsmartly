"use client";

import { useState, useRef, useEffect } from "react";
import { useWebsiteEditorStore } from "@/stores/website-editor-store";

interface ColorPickerPopoverProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
  allowTransparent?: boolean;
}

const PRESET_COLORS = [
  "#000000", "#374151", "#6b7280", "#9ca3af", "#d1d5db", "#f3f4f6", "#ffffff",
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#22c55e", "#14b8a6", "#06b6d4",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899", "#f43f5e",
];

export function ColorPickerPopover({ value, onChange, label, allowTransparent }: ColorPickerPopoverProps) {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(value || "");
  const ref = useRef<HTMLDivElement>(null);
  const theme = useWebsiteEditorStore((s) => s.theme);

  const brandColors = [
    { label: "Primary", color: theme.colors.primary },
    { label: "Secondary", color: theme.colors.secondary },
    { label: "Accent", color: theme.colors.accent },
    { label: "Background", color: theme.colors.background },
    { label: "Surface", color: theme.colors.surface },
    { label: "Text", color: theme.colors.text },
  ];

  useEffect(() => {
    setHex(value || "");
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const applyColor = (color: string) => {
    setHex(color);
    onChange(color);
  };

  return (
    <div className="relative" ref={ref}>
      {label && <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(!open)}
          className="w-8 h-8 rounded-md border border-border shadow-sm cursor-pointer flex-shrink-0 relative overflow-hidden"
          style={{ backgroundColor: value || "transparent" }}
        >
          {!value && (
            <div className="absolute inset-0 bg-[repeating-conic-gradient(#e5e7eb_0%_25%,transparent_0%_50%)] bg-[length:8px_8px]" />
          )}
        </button>
        <input
          type="text"
          value={hex}
          onChange={(e) => {
            setHex(e.target.value);
            if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) onChange(e.target.value);
          }}
          onBlur={() => {
            if (/^#[0-9a-fA-F]{6}$/.test(hex)) onChange(hex);
          }}
          placeholder="#000000"
          className="flex-1 text-sm px-2 py-1.5 border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary min-w-0"
        />
        {value && (
          <button onClick={() => applyColor("")} className="text-xs text-muted-foreground hover:text-foreground px-1">
            Clear
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-2 w-64 bg-popover border border-border rounded-xl shadow-xl p-3 space-y-3">
          {/* Native color input */}
          <input
            type="color"
            value={value || "#000000"}
            onChange={(e) => applyColor(e.target.value)}
            className="w-full h-8 rounded cursor-pointer border-0"
          />

          {/* Brand colors */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Brand Colors</p>
            <div className="flex gap-1.5">
              {brandColors.map((bc) => (
                <button
                  key={bc.label}
                  onClick={() => applyColor(bc.color)}
                  title={bc.label}
                  className={`w-7 h-7 rounded-md border-2 transition-all hover:scale-110 ${value === bc.color ? "border-primary ring-1 ring-primary" : "border-border"}`}
                  style={{ backgroundColor: bc.color }}
                />
              ))}
            </div>
          </div>

          {/* Preset colors */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Presets</p>
            <div className="grid grid-cols-7 gap-1">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => applyColor(color)}
                  className={`w-7 h-7 rounded-md border transition-all hover:scale-110 ${value === color ? "border-primary ring-1 ring-primary" : "border-border/50"}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Transparent */}
          {allowTransparent && (
            <button
              onClick={() => applyColor("")}
              className="w-full text-xs text-center py-1.5 border border-dashed border-border rounded-md hover:bg-muted transition-colors"
            >
              Transparent
            </button>
          )}
        </div>
      )}
    </div>
  );
}
