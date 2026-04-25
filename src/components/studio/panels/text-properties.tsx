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
  Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";
import { useCanvasStore } from "../hooks/use-canvas-store";
import { FONT_CATEGORIES, loadGoogleFont } from "../utils/font-loader";
import { TEXT_PRESETS } from "../utils/text-presets";
import { ColorInput } from "./color-input";
import { BlendModeSelect } from "./blend-mode-select";

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
  // Curve text along an arc path. 0 = straight, range -100..100. Sign
  // controls direction (positive = curve down, negative = curve up).
  const [curveAmount, setCurveAmount] = useState(0);
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

  // Preload every font in every category when the font dropdown opens so
  // each picker row renders in its own typeface right away — previously
  // fonts only loaded on hover, so most appeared in the fallback font
  // and users couldn't tell what Playfair Display vs Cinzel vs Lora
  // actually looked like without clicking each.
  useEffect(() => {
    if (!showFontDropdown) return;
    const all = FONT_CATEGORIES.flatMap((cat) => cat.fonts);
    // Fire in sequence — loadGoogleFont is memoized so duplicates are free.
    // Microtask batching keeps the UI responsive while fonts stream in.
    Promise.all(all.map((f) => loadGoogleFont(f))).catch(() => {
      // ignore — missing fonts just fall back to the default
    });
  }, [showFontDropdown]);

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

    // Curve sync — recover the curve amount from the saved __curveAmount marker
    // (we store our own value rather than reverse-engineering Fabric's path)
    setCurveAmount(typeof obj.__curveAmount === "number" ? obj.__curveAmount : 0);
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

  // Shrink-to-fit: step the font size down in 1px ticks until the rendered
  // text height fits inside the textbox's current height (for textbox) or
  // its locked height (for text/i-text). Bounded by MIN_SIZE so we don't
  // produce microscopic text on absurdly small boxes.
  const MIN_SIZE = 8;
  const autoFitToBox = () => {
    const obj = getActiveText();
    if (!obj || !canvas) return;

    // Current font size is what we're tuning. `height` for a Fabric Textbox
    // is the laid-out text height; for plain Text it equals the glyph box.
    // `_textLines.length * _fontSizeMult * fontSize * lineHeight` approximates
    // the laid-out height but is internal; we read `height` after each set.
    let currentSize = obj.fontSize || 32;
    const targetHeight = (obj.height || 0) * (obj.scaleY || 1);
    if (targetHeight <= 0) return;

    // Try decreasing first. Fabric relays out on set(fontSize), so we can
    // measure obj.height post-set — but the height gets updated only after
    // initDimensions/renderAll on Textbox. Force by calling initDimensions
    // if available; otherwise trust the getBoundingRect after render.
    const renderAndMeasure = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyObj = obj as any;
      if (typeof anyObj.initDimensions === "function") {
        anyObj.initDimensions();
      }
      canvas.requestRenderAll();
      return obj.height || 0;
    };

    // Safety bound to avoid infinite loops from odd initial states
    let safety = 200;
    // Shrink while overflowing
    while (safety-- > 0) {
      const h = renderAndMeasure();
      if (h <= targetHeight || currentSize <= MIN_SIZE) break;
      currentSize -= 1;
      obj.set("fontSize", currentSize);
    }
    // Also try to grow: step up while still under the target height
    safety = 200;
    while (safety-- > 0) {
      const h = renderAndMeasure();
      if (h >= targetHeight) break;
      currentSize += 1;
      obj.set("fontSize", currentSize);
    }
    // One last step back if the grow-loop overshot
    if ((obj.height || 0) > targetHeight && currentSize > MIN_SIZE) {
      currentSize -= 1;
      obj.set("fontSize", currentSize);
      renderAndMeasure();
    }

    setFontSize(currentSize);
    canvas.requestRenderAll();
  };

  // Curve text along an arc path. amount in [-100, 100]:
  //   0    = no path (straight)
  //   +50  = mild downward curve
  //   +100 = tight half-circle, text reads top-to-bottom along the arc
  //   negatives mirror the curve upward
  const applyCurve = async (amount: number) => {
    setCurveAmount(amount);
    const obj = getActiveText();
    if (!obj || !canvas) return;
    if (amount === 0) {
      obj.set("path", null);
      obj.__curveAmount = 0;
      canvas.requestRenderAll();
      return;
    }
    const fabric = await import("fabric");
    // Width of a straight version of the text — scaled to its current width
    const width = (obj.width || 200) * (obj.scaleX || 1);
    // Map amount -> radius. Higher abs(amount) = smaller radius = tighter curve.
    const tightness = Math.abs(amount) / 100; // 0..1
    const radius = Math.max(width * 0.5, width / Math.max(tightness * 2, 0.5));
    const direction = amount >= 0 ? 1 : -1;

    // Build an SVG arc path: start at left edge, sweep to right edge through
    // the bottom (or top, when negative). The path is centered around the
    // text's local origin so the result looks balanced after Fabric attaches it.
    const halfW = width / 2;
    const sagitta = radius - Math.sqrt(Math.max(0, radius * radius - halfW * halfW));
    const sweep = direction === 1 ? 1 : 0;
    const yEnd = direction === 1 ? sagitta : -sagitta;
    const pathStr = `M ${-halfW} 0 A ${radius} ${radius} 0 0 ${sweep} ${halfW} ${yEnd}`;
    const path = new fabric.Path(pathStr, {
      visible: false, // Path itself stays invisible; only the text rides it
    });
    obj.set("path", path);
    obj.__curveAmount = amount;
    canvas.requestRenderAll();
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
          {TEXT_PRESETS.map((preset) => {
            // Default to a clean white card so the preset previews look
            // like the canvas the user is designing on. Only fall back to
            // the preset's original (dark) background when the text color
            // is so light it'd be invisible on white — neon glows, chalk,
            // etc. keep their dark backdrop so the effect reads.
            const colorIsLight = isLightColor(preset.preview.color);
            const bg = colorIsLight ? preset.preview.background : "#ffffff";
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset.id)}
                className="group relative aspect-[16/9] rounded-md border border-border overflow-hidden hover:border-brand-500 hover:shadow-md transition-all"
                style={{ backgroundColor: bg }}
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
                <span
                  className={`absolute bottom-0 left-0 right-0 text-[8px] py-0.5 text-center truncate ${
                    colorIsLight
                      ? "bg-black/60 text-white"
                      : "bg-white/85 text-gray-700 border-t border-gray-200"
                  }`}
                >
                  {preset.name}
                </span>
              </button>
            );
          })}
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
                        "w-full flex items-center gap-3 px-2 py-1.5 hover:bg-muted transition-colors text-left",
                        font === fontFamily && "bg-brand-500/10",
                      )}
                    >
                      {/* "Aa" sample rendered in the font itself — instantly
                          distinguishes display / script / mono at a glance */}
                      <span
                        className={cn(
                          "text-lg leading-none shrink-0 w-8 text-center",
                          font === fontFamily ? "text-brand-600" : "text-foreground",
                        )}
                        style={{ fontFamily: font }}
                      >
                        Aa
                      </span>
                      <span
                        className={cn(
                          "text-xs truncate",
                          font === fontFamily ? "text-brand-600 font-medium" : "text-muted-foreground",
                        )}
                      >
                        {font}
                      </span>
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
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 ml-1"
            onClick={autoFitToBox}
            title="Auto-fit text to box — finds the largest font size that fits"
            aria-label="Auto-fit text to box"
          >
            <Maximize2 className="h-3.5 w-3.5" />
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

      {/* Curve Text */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-xs text-muted-foreground">Curve</label>
          <button
            type="button"
            onClick={() => applyCurve(0)}
            disabled={curveAmount === 0}
            className="text-[10px] text-muted-foreground hover:text-brand-600 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Reset curve"
          >
            Reset
          </button>
        </div>
        <input
          type="range"
          min={-100}
          max={100}
          value={curveAmount}
          onChange={(e) => applyCurve(parseInt(e.target.value, 10))}
          className="w-full h-1.5 accent-brand-500"
          aria-label="Curve amount: negative curves up, positive curves down"
        />
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {curveAmount === 0 ? "Straight" : curveAmount > 0 ? `Curve down (${curveAmount})` : `Curve up (${Math.abs(curveAmount)})`}
        </p>
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
          aria-label="Opacity"
        />
      </div>

      {/* Blend Mode */}
      <BlendModeSelect />
    </div>
  );
}

// Returns true when the color is light enough that it'd be invisible on a
// white card — drives the preset preview's bg choice. Accepts hex, rgb(),
// rgba(), and 'white'/'transparent' literals. Falls back to false for
// gradient strings (gradient text is colored across hues so it generally
// reads OK on white anyway).
function isLightColor(c: string | undefined): boolean {
  if (!c) return false;
  const v = c.trim().toLowerCase();
  if (v === "white" || v === "#fff" || v === "#ffffff") return true;
  // Hex
  const hex = v.match(/^#([0-9a-f]{6})$/);
  if (hex) {
    const r = parseInt(hex[1].slice(0, 2), 16);
    const g = parseInt(hex[1].slice(2, 4), 16);
    const b = parseInt(hex[1].slice(4, 6), 16);
    return relativeLuminance(r, g, b) > 0.7;
  }
  // rgb / rgba
  const rgb = v.match(/^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (rgb) {
    return relativeLuminance(+rgb[1], +rgb[2], +rgb[3]) > 0.7;
  }
  return false;
}

function relativeLuminance(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
