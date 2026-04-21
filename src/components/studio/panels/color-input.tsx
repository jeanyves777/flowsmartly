"use client";

import { useEffect, useState } from "react";
import { Pipette } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { pickScreenColor, isEyeDropperSupported } from "../utils/eyedropper";
import { useBrandColors } from "../hooks/use-brand-colors";
import { useRecentColors, pushRecentColor } from "../hooks/use-recent-colors";

interface ColorInputProps {
  value: string;
  onChange: (hex: string) => void;
  /** Optional accessible label for screen readers */
  label?: string;
  /** Hide the brand swatches row (e.g. for nested compact uses). */
  hideSwatches?: boolean;
}

/**
 * Themed color picker row used across the studio property panels:
 * native swatch + hex input + EyeDropper button (Chromium-only).
 *
 * Single source of truth so future changes (palette popover, recent colors,
 * brand swatches) only need to land in one place.
 */
// Defend against non-string `value` props — fills on fabric objects can be
// Gradient or Pattern instances (fill: new fabric.Gradient({...})) which
// serialize to "[object Object]" and crash any `.toLowerCase()` / regex
// call. Panels sometimes pass these through unchanged; we coerce here.
function normalizeHex(v: unknown): string {
  if (typeof v !== "string") return "";
  // Things that aren't a representable solid hex: empty, transparent,
  // rgba(...), hsl(...), object-shaped strings. The <input type="color">
  // only accepts "#rrggbb" — anything else triggers the browser warning
  // we were seeing, and our activeSwatch comparison would compare garbage.
  if (!v || v === "transparent" || v.startsWith("rgba(") || v.startsWith("rgb(") || v.startsWith("hsl(") || v === "[object Object]") {
    return "";
  }
  return v;
}

export function ColorInput({ value, onChange, label, hideSwatches }: ColorInputProps) {
  const safeValue = normalizeHex(value);
  const [hex, setHex] = useState(safeValue);
  const [supportsEyeDropper, setSupportsEyeDropper] = useState(false);
  const brandColors = useBrandColors();
  const recentColors = useRecentColors();

  useEffect(() => setHex(normalizeHex(value)), [value]);
  useEffect(() => setSupportsEyeDropper(isEyeDropperSupported()), []);

  // Wrapper around onChange that also records the color in recents.
  // We push at commit time (not while dragging the native picker) to avoid
  // 200+ entries from a single hue-slider drag.
  const handleChange = (next: string) => {
    onChange(next);
    pushRecentColor(next);
  };

  const commit = (next: string) => {
    setHex(next);
    if (/^#[0-9a-fA-F]{6}$/.test(next)) handleChange(next);
  };

  const handlePick = async () => {
    const picked = await pickScreenColor();
    if (picked) {
      setHex(picked);
      handleChange(picked);
    }
  };

  const applySwatch = (swatch: string) => {
    setHex(swatch);
    handleChange(swatch);
  };

  // Highlight the swatch that matches the current value (case-insensitive)
  const activeSwatch = typeof hex === "string" ? hex.toLowerCase() : "";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <input
          type="color"
          // <input type="color"> will emit a DOMException for any value
          // that isn't "#rrggbb". Coerce via safeValue so gradients /
          // transparents / rgba strings fall back to a neutral default.
          value={safeValue && /^#[0-9a-fA-F]{6}$/.test(safeValue) ? safeValue : "#000000"}
          onChange={(e) => {
            setHex(e.target.value);
            onChange(e.target.value);
          }}
          aria-label={label ? `${label} swatch` : "Color swatch"}
          className="w-8 h-8 rounded cursor-pointer border"
        />
        <Input
          value={hex}
          onChange={(e) => commit(e.target.value)}
          aria-label={label ? `${label} hex value` : "Hex color value"}
          className="h-8 text-xs font-mono flex-1"
        />
        {supportsEyeDropper && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handlePick}
            title="Pick color from screen"
            aria-label="Pick color from screen"
          >
            <Pipette className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Brand swatches row — only renders when the user has a brand kit
          with colors. Each swatch is a one-click apply; the active one
          (matching the current hex) gets a brand-colored ring. */}
      {!hideSwatches && brandColors.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80 w-12 shrink-0">
            Brand
          </span>
          {brandColors.map((swatch) => (
            <button
              key={swatch}
              type="button"
              onClick={() => applySwatch(swatch)}
              title={swatch}
              aria-label={`Apply brand color ${swatch}`}
              className={
                "h-5 w-5 rounded border transition-shadow " +
                (activeSwatch === swatch
                  ? "ring-2 ring-brand-500 ring-offset-1 ring-offset-background"
                  : "border-border hover:scale-110")
              }
              style={{ background: swatch }}
            />
          ))}
        </div>
      )}

      {/* Recent colors — populated as the user picks colors anywhere in
          the studio. Persists in localStorage across reloads but stays
          local to the device. */}
      {!hideSwatches && recentColors.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80 w-12 shrink-0">
            Recent
          </span>
          {recentColors.map((swatch) => (
            <button
              key={`recent-${swatch}`}
              type="button"
              onClick={() => applySwatch(swatch)}
              title={swatch}
              aria-label={`Apply recent color ${swatch}`}
              className={
                "h-5 w-5 rounded border transition-shadow " +
                (activeSwatch === swatch
                  ? "ring-2 ring-brand-500 ring-offset-1 ring-offset-background"
                  : "border-border hover:scale-110")
              }
              style={{ background: swatch }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
