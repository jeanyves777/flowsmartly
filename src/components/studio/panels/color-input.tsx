"use client";

import { useEffect, useState } from "react";
import { Pipette } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { pickScreenColor, isEyeDropperSupported } from "../utils/eyedropper";
import { useBrandColors } from "../hooks/use-brand-colors";

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
export function ColorInput({ value, onChange, label, hideSwatches }: ColorInputProps) {
  const [hex, setHex] = useState(value);
  const [supportsEyeDropper, setSupportsEyeDropper] = useState(false);
  const brandColors = useBrandColors();

  useEffect(() => setHex(value), [value]);
  useEffect(() => setSupportsEyeDropper(isEyeDropperSupported()), []);

  const commit = (next: string) => {
    setHex(next);
    if (/^#[0-9a-fA-F]{6}$/.test(next)) onChange(next);
  };

  const handlePick = async () => {
    const picked = await pickScreenColor();
    if (picked) {
      setHex(picked);
      onChange(picked);
    }
  };

  const applySwatch = (swatch: string) => {
    setHex(swatch);
    onChange(swatch);
  };

  // Highlight the swatch that matches the current value (case-insensitive)
  const activeSwatch = hex.toLowerCase();

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
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
    </div>
  );
}
