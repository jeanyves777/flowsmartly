"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Type,
  Minus,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";
import { useCanvasStore } from "../hooks/use-canvas-store";
import { FONT_CATEGORIES, loadGoogleFont } from "../utils/font-loader";
import { TEXT_PRESETS } from "../utils/text-presets";
import { ColorInput } from "./color-input";

export function TextProperties() {
  const canvas = useCanvasStore((s) => s.canvas);
  const selectedObjectIds = useCanvasStore((s) => s.selectedObjectIds);

  const [fontFamily, setFontFamily] = useState("Inter");
  const [fontSize, setFontSize] = useState(32);
  const [fillColor, setFillColor] = useState("#000000");
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [textAlign, setTextAlign] = useState("left");
  const [letterSpacing, setLetterSpacing] = useState(0);
  const [lineHeight, setLineHeight] = useState(1.2);
  const [opacity, setOpacity] = useState(100);
  const [showFontDropdown, setShowFontDropdown] = useState(false);
  const [fontSearch, setFontSearch] = useState("");

  // Effects
  const [strokeWidth, setStrokeWidth] = useState(0);
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [shadowEnabled, setShadowEnabled] = useState(false);
  const [shadowColor, setShadowColor] = useState("#000000");
  const [shadowBlur, setShadowBlur] = useState(8);
  const [shadowOffsetX, setShadowOffsetX] = useState(2);
  const [shadowOffsetY, setShadowOffsetY] = useState(2);

  const getActiveText = useCallback(() => {
    if (!canvas) return null;
    const obj = canvas.getActiveObject();
    if (!obj || (obj.type !== "textbox" && obj.type !== "text" && obj.type !== "i-text"))
      return null;
    return obj;
  }, [canvas]);

  // Preload preset recommended fonts so the preview swatches render correctly
  useEffect(() => {
    const fonts = Array.from(
      new Set(TEXT_PRESETS.map((p) => p.recommendedFont).filter(Boolean) as string[]),
    );
    fonts.forEach((f) => loadGoogleFont(f));
  }, []);

  // Sync state from selected object
  useEffect(() => {
    const obj = getActiveText();
    if (!obj) return;
    setFontFamily(obj.fontFamily || "Inter");
    setFontSize(obj.fontSize || 32);
    setFillColor(obj.fill || "#000000");
    setIsBold(obj.fontWeight === "bold" || obj.fontWeight === 700);
    setIsItalic(obj.fontStyle === "italic");
    setIsUnderline(obj.underline || false);
    setIsStrikethrough(obj.linethrough || false);
    setTextAlign(obj.textAlign || "left");
    setLetterSpacing(obj.charSpacing || 0);
    setLineHeight(obj.lineHeight || 1.2);
    setOpacity(Math.round((obj.opacity || 1) * 100));

    // Effects sync
    setStrokeWidth(obj.strokeWidth || 0);
    setStrokeColor(obj.stroke || "#000000");
    const shadow = obj.shadow;
    if (shadow) {
      setShadowEnabled(true);
      setShadowColor(shadow.color || "#000000");
      setShadowBlur(shadow.blur ?? 8);
      setShadowOffsetX(shadow.offsetX ?? 2);
      setShadowOffsetY(shadow.offsetY ?? 2);
    } else {
      setShadowEnabled(false);
    }
  }, [selectedObjectIds, getActiveText]);

  const updateProp = (prop: string, value: any) => {
    const obj = getActiveText();
    if (!obj) return;
    obj.set(prop, value);
    canvas?.renderAll();
  };

  const handleFontChange = async (font: string) => {
    await loadGoogleFont(font);
    setFontFamily(font);
    updateProp("fontFamily", font);
    setShowFontDropdown(false);
    canvas?.renderAll();
  };

  const handleFontSizeChange = (size: number) => {
    const clamped = Math.max(1, Math.min(500, size));
    setFontSize(clamped);
    updateProp("fontSize", clamped);
  };

  const toggleBold = () => {
    const next = !isBold;
    setIsBold(next);
    updateProp("fontWeight", next ? "bold" : "normal");
  };

  const toggleItalic = () => {
    const next = !isItalic;
    setIsItalic(next);
    updateProp("fontStyle", next ? "italic" : "normal");
  };

  const toggleUnderline = () => {
    const next = !isUnderline;
    setIsUnderline(next);
    updateProp("underline", next);
  };

  const toggleStrikethrough = () => {
    const next = !isStrikethrough;
    setIsStrikethrough(next);
    updateProp("linethrough", next);
  };

  const setAlign = (align: string) => {
    setTextAlign(align);
    updateProp("textAlign", align);
  };

  const applyStroke = (width: number, color: string) => {
    setStrokeWidth(width);
    setStrokeColor(color);
    const obj = getActiveText();
    if (!obj) return;
    obj.set({
      strokeWidth: width,
      stroke: width > 0 ? color : null,
      paintFirst: "stroke",
      strokeUniform: true,
    });
    canvas?.renderAll();
  };

  const applyShadow = async (
    enabled: boolean,
    color: string,
    blur: number,
    offsetX: number,
    offsetY: number,
  ) => {
    setShadowEnabled(enabled);
    setShadowColor(color);
    setShadowBlur(blur);
    setShadowOffsetX(offsetX);
    setShadowOffsetY(offsetY);
    const obj = getActiveText();
    if (!obj || !canvas) return;
    if (!enabled) {
      obj.set("shadow", null);
    } else {
      const fabric = await import("fabric");
      obj.set(
        "shadow",
        new fabric.Shadow({ color, blur, offsetX, offsetY }),
      );
    }
    canvas.renderAll();
  };

  const filteredCategories = FONT_CATEGORIES.map((cat) => ({
    label: cat.label,
    fonts: cat.fonts.filter((f) =>
      f.toLowerCase().includes(fontSearch.toLowerCase()),
    ),
  })).filter((cat) => cat.fonts.length > 0);

  const applyPreset = async (presetId: string) => {
    const preset = TEXT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const obj = getActiveText();
    if (!obj || !canvas) return;
    if (preset.recommendedFont) {
      await loadGoogleFont(preset.recommendedFont);
      obj.set("fontFamily", preset.recommendedFont);
      setFontFamily(preset.recommendedFont);
    }
    await preset.apply(obj);
    canvas.renderAll();
    // Re-sync local state after preset applied
    setStrokeWidth(obj.strokeWidth || 0);
    setStrokeColor(typeof obj.stroke === "string" ? obj.stroke : "#000000");
    if (obj.shadow) {
      setShadowEnabled(true);
      setShadowColor(obj.shadow.color || "#000000");
      setShadowBlur(obj.shadow.blur ?? 8);
      setShadowOffsetX(obj.shadow.offsetX ?? 2);
      setShadowOffsetY(obj.shadow.offsetY ?? 2);
    } else {
      setShadowEnabled(false);
    }
  };

  return (
    <div className="p-3 space-y-4">
      <h3 className="text-sm font-semibold">Text</h3>

      {/* Style Presets — one-click looks (gold metallic, neon, 3D, etc.) */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Style Presets</label>
        <div className="grid grid-cols-3 gap-1.5">
          {TEXT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.id)}
              className="group relative aspect-[16/9] rounded-md border overflow-hidden hover:border-brand-500 hover:shadow-md transition-all"
              style={{ backgroundColor: preset.preview.background }}
              title={`${preset.name}${preset.recommendedFont ? ` · ${preset.recommendedFont}` : ""}`}
              aria-label={`Apply ${preset.name} text style`}
            >
              <span
                className="absolute inset-0 flex items-center justify-center text-[14px] font-bold leading-none px-1"
                style={{
                  fontFamily: preset.recommendedFont || "inherit",
                  color: preset.preview.color,
                  background: preset.preview.gradient
                    ? preset.preview.gradient
                    : undefined,
                  WebkitBackgroundClip: preset.preview.gradient ? "text" : undefined,
                  WebkitTextFillColor: preset.preview.gradient ? "transparent" : undefined,
                  textShadow: preset.preview.textShadow,
                }}
              >
                Aa
              </span>
              <span className="absolute bottom-0 left-0 right-0 text-[8px] py-0.5 bg-black/60 text-white text-center truncate">
                {preset.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Font Family */}
      <div className="relative">
        <label className="text-xs text-muted-foreground mb-1 block">Font</label>
        <button
          onClick={() => setShowFontDropdown(!showFontDropdown)}
          className="w-full h-8 px-2 text-sm text-left border rounded-md hover:border-brand-500 truncate"
          style={{ fontFamily }}
        >
          {fontFamily}
        </button>
        {showFontDropdown && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-[250px] overflow-hidden">
            <div className="p-1.5 border-b">
              <Input
                placeholder="Search fonts..."
                value={fontSearch}
                onChange={(e) => setFontSearch(e.target.value)}
                className="h-7 text-xs"
                autoFocus
              />
            </div>
            <div className="overflow-y-auto max-h-[260px]">
              {filteredCategories.map((cat) => (
                <div key={cat.label}>
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/40 sticky top-0">
                    {cat.label}
                  </div>
                  {cat.fonts.map((font) => (
                    <button
                      key={font}
                      onClick={() => handleFontChange(font)}
                      onMouseEnter={() => loadGoogleFont(font)}
                      className={cn(
                        "w-full text-left px-2 py-1.5 text-sm hover:bg-muted transition-colors",
                        font === fontFamily && "bg-brand-500/10 text-brand-600",
                      )}
                      style={{ fontFamily: font }}
                    >
                      {font}
                    </button>
                  ))}
                </div>
              ))}
              {filteredCategories.length === 0 && (
                <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                  No fonts match &ldquo;{fontSearch}&rdquo;
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Font Size */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Size</label>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => handleFontSizeChange(fontSize - 1)}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <Input
            type="number"
            value={fontSize}
            onChange={(e) => handleFontSizeChange(parseInt(e.target.value) || 32)}
            className="h-8 text-center text-sm w-16"
          />
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => handleFontSizeChange(fontSize + 1)}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Color */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Color</label>
        <ColorInput
          label="Text color"
          value={fillColor}
          onChange={(hex) => {
            setFillColor(hex);
            updateProp("fill", hex);
          }}
        />
      </div>

      {/* Style toggles */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Style</label>
        <div className="flex gap-1">
          <Button variant={isBold ? "default" : "outline"} size="icon" className="h-8 w-8" onClick={toggleBold}>
            <Bold className="h-4 w-4" />
          </Button>
          <Button variant={isItalic ? "default" : "outline"} size="icon" className="h-8 w-8" onClick={toggleItalic}>
            <Italic className="h-4 w-4" />
          </Button>
          <Button variant={isUnderline ? "default" : "outline"} size="icon" className="h-8 w-8" onClick={toggleUnderline}>
            <Underline className="h-4 w-4" />
          </Button>
          <Button variant={isStrikethrough ? "default" : "outline"} size="icon" className="h-8 w-8" onClick={toggleStrikethrough}>
            <Strikethrough className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Alignment */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Alignment</label>
        <div className="flex gap-1">
          {[
            { align: "left", Icon: AlignLeft },
            { align: "center", Icon: AlignCenter },
            { align: "right", Icon: AlignRight },
            { align: "justify", Icon: AlignJustify },
          ].map(({ align, Icon }) => (
            <Button
              key={align}
              variant={textAlign === align ? "default" : "outline"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setAlign(align)}
            >
              <Icon className="h-4 w-4" />
            </Button>
          ))}
        </div>
      </div>

      {/* Letter Spacing */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">
          Letter Spacing: {letterSpacing}
        </label>
        <input
          type="range"
          min={-200}
          max={800}
          value={letterSpacing}
          onChange={(e) => {
            const v = parseInt(e.target.value);
            setLetterSpacing(v);
            updateProp("charSpacing", v);
          }}
          className="w-full h-1.5 accent-brand-500"
        />
      </div>

      {/* Line Height */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">
          Line Height: {lineHeight.toFixed(1)}
        </label>
        <input
          type="range"
          min={0.5}
          max={3}
          step={0.1}
          value={lineHeight}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            setLineHeight(v);
            updateProp("lineHeight", v);
          }}
          className="w-full h-1.5 accent-brand-500"
        />
      </div>

      {/* Effects: Outline + Shadow */}
      <div className="border-t pt-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Effects</p>

        {/* Outline / Stroke */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">Outline</label>
            <span className="text-[10px] font-mono">{strokeWidth}px</span>
          </div>
          <input
            type="range"
            min={0}
            max={20}
            value={strokeWidth}
            onChange={(e) => applyStroke(parseInt(e.target.value), strokeColor)}
            className="w-full h-1.5 accent-brand-500"
            aria-label="Outline thickness"
          />
          {strokeWidth > 0 && (
            <ColorInput
              label="Outline color"
              value={strokeColor}
              onChange={(hex) => applyStroke(strokeWidth, hex)}
            />
          )}
        </div>

        {/* Shadow */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={shadowEnabled}
              onChange={(e) =>
                applyShadow(e.target.checked, shadowColor, shadowBlur, shadowOffsetX, shadowOffsetY)
              }
              className="accent-brand-500"
            />
            Drop shadow
          </label>
          {shadowEnabled && (
            <div className="space-y-2 pl-1">
              <ColorInput
                label="Shadow color"
                value={shadowColor}
                onChange={(hex) =>
                  applyShadow(true, hex, shadowBlur, shadowOffsetX, shadowOffsetY)
                }
              />
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-muted-foreground">Blur</label>
                  <span className="text-[10px] font-mono">{shadowBlur}px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={50}
                  value={shadowBlur}
                  onChange={(e) =>
                    applyShadow(true, shadowColor, parseInt(e.target.value), shadowOffsetX, shadowOffsetY)
                  }
                  className="w-full h-1.5 accent-brand-500"
                  aria-label="Shadow blur"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-muted-foreground">Offset X</label>
                    <span className="text-[10px] font-mono">{shadowOffsetX}px</span>
                  </div>
                  <input
                    type="range"
                    min={-30}
                    max={30}
                    value={shadowOffsetX}
                    onChange={(e) =>
                      applyShadow(true, shadowColor, shadowBlur, parseInt(e.target.value), shadowOffsetY)
                    }
                    className="w-full h-1.5 accent-brand-500"
                    aria-label="Shadow horizontal offset"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-muted-foreground">Offset Y</label>
                    <span className="text-[10px] font-mono">{shadowOffsetY}px</span>
                  </div>
                  <input
                    type="range"
                    min={-30}
                    max={30}
                    value={shadowOffsetY}
                    onChange={(e) =>
                      applyShadow(true, shadowColor, shadowBlur, shadowOffsetX, parseInt(e.target.value))
                    }
                    className="w-full h-1.5 accent-brand-500"
                    aria-label="Shadow vertical offset"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Opacity */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">
          Opacity: {opacity}%
        </label>
        <input
          type="range"
          min={0}
          max={100}
          value={opacity}
          onChange={(e) => {
            const v = parseInt(e.target.value);
            setOpacity(v);
            updateProp("opacity", v / 100);
          }}
          className="w-full h-1.5 accent-brand-500"
        />
      </div>
    </div>
  );
}
