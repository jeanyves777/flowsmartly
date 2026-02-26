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
import { POPULAR_FONTS, loadGoogleFont } from "../utils/font-loader";

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

  const getActiveText = useCallback(() => {
    if (!canvas) return null;
    const obj = canvas.getActiveObject();
    if (!obj || (obj.type !== "textbox" && obj.type !== "text" && obj.type !== "i-text"))
      return null;
    return obj;
  }, [canvas]);

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

  const filteredFonts = POPULAR_FONTS.filter((f) =>
    f.toLowerCase().includes(fontSearch.toLowerCase())
  );

  return (
    <div className="p-3 space-y-4">
      <h3 className="text-sm font-semibold">Text</h3>

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
            <div className="overflow-y-auto max-h-[200px]">
              {filteredFonts.map((font) => (
                <button
                  key={font}
                  onClick={() => handleFontChange(font)}
                  onMouseEnter={() => loadGoogleFont(font)}
                  className={cn(
                    "w-full text-left px-2 py-1.5 text-sm hover:bg-muted transition-colors",
                    font === fontFamily && "bg-brand-500/10 text-brand-600"
                  )}
                  style={{ fontFamily: font }}
                >
                  {font}
                </button>
              ))}
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
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={fillColor}
            onChange={(e) => {
              setFillColor(e.target.value);
              updateProp("fill", e.target.value);
            }}
            className="w-8 h-8 rounded cursor-pointer border"
          />
          <Input
            value={fillColor}
            onChange={(e) => {
              setFillColor(e.target.value);
              if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
                updateProp("fill", e.target.value);
              }
            }}
            className="h-8 text-xs font-mono flex-1"
          />
        </div>
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
