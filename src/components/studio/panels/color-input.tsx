"use client";

import { useEffect, useState } from "react";
import { Pipette } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { pickScreenColor, isEyeDropperSupported } from "../utils/eyedropper";

interface ColorInputProps {
  value: string;
  onChange: (hex: string) => void;
  /** Optional accessible label for screen readers */
  label?: string;
}

/**
 * Themed color picker row used across the studio property panels:
 * native swatch + hex input + EyeDropper button (Chromium-only).
 *
 * Single source of truth so future changes (palette popover, recent colors,
 * brand swatches) only need to land in one place.
 */
export function ColorInput({ value, onChange, label }: ColorInputProps) {
  const [hex, setHex] = useState(value);
  const [supportsEyeDropper, setSupportsEyeDropper] = useState(false);

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

  return (
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
  );
}
