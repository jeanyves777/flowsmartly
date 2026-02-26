"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Minus,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCanvasStore } from "../hooks/use-canvas-store";
import { loadGoogleFont, POPULAR_FONTS } from "../utils/font-loader";

export function TextToolbar() {
  const canvas = useCanvasStore((s) => s.canvas);
  const isEditingText = useCanvasStore((s) => s.isEditingText);
  const selectedObjectType = useCanvasStore((s) => s.selectedObjectType);
  const selectedObjectIds = useCanvasStore((s) => s.selectedObjectIds);

  const [fontSize, setFontSize] = useState(32);
  const [fontFamily, setFontFamily] = useState("Inter");
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [textAlign, setTextAlign] = useState("left");
  const [fillColor, setFillColor] = useState("#000000");

  const isTextSelected =
    selectedObjectType === "textbox" ||
    selectedObjectType === "text" ||
    selectedObjectType === "i-text";

  const getActiveText = useCallback(() => {
    if (!canvas) return null;
    const obj = canvas.getActiveObject();
    if (!obj || (obj.type !== "textbox" && obj.type !== "text" && obj.type !== "i-text")) return null;
    return obj;
  }, [canvas]);

  useEffect(() => {
    const obj = getActiveText();
    if (!obj) return;
    setFontSize(obj.fontSize || 32);
    setFontFamily(obj.fontFamily || "Inter");
    setIsBold(obj.fontWeight === "bold" || obj.fontWeight === 700);
    setIsItalic(obj.fontStyle === "italic");
    setIsUnderline(obj.underline || false);
    setTextAlign(obj.textAlign || "left");
    setFillColor(obj.fill || "#000000");
  }, [selectedObjectIds, getActiveText]);

  const updateProp = (prop: string, value: any) => {
    const obj = getActiveText();
    if (!obj) return;
    obj.set(prop, value);
    canvas?.renderAll();
  };

  if (!isTextSelected) return null;

  return (
    <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 bg-background border rounded-lg shadow-lg px-2 py-1">
      {/* Font family select */}
      <select
        value={fontFamily}
        onChange={async (e) => {
          const font = e.target.value;
          await loadGoogleFont(font);
          setFontFamily(font);
          updateProp("fontFamily", font);
        }}
        className="h-7 text-xs border rounded px-1 bg-background max-w-[120px]"
        style={{ fontFamily }}
      >
        {POPULAR_FONTS.slice(0, 20).map((f) => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>

      <div className="h-5 w-px bg-border mx-0.5" />

      {/* Font size */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => { const s = fontSize - 1; setFontSize(s); updateProp("fontSize", s); }}
      >
        <Minus className="h-3 w-3" />
      </Button>
      <input
        type="number"
        value={fontSize}
        onChange={(e) => { const s = parseInt(e.target.value) || 32; setFontSize(s); updateProp("fontSize", s); }}
        className="w-10 h-7 text-center text-xs border rounded bg-background"
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => { const s = fontSize + 1; setFontSize(s); updateProp("fontSize", s); }}
      >
        <Plus className="h-3 w-3" />
      </Button>

      <div className="h-5 w-px bg-border mx-0.5" />

      {/* Bold / Italic / Underline */}
      <Button
        variant={isBold ? "default" : "ghost"}
        size="icon"
        className="h-7 w-7"
        onClick={() => { setIsBold(!isBold); updateProp("fontWeight", !isBold ? "bold" : "normal"); }}
      >
        <Bold className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant={isItalic ? "default" : "ghost"}
        size="icon"
        className="h-7 w-7"
        onClick={() => { setIsItalic(!isItalic); updateProp("fontStyle", !isItalic ? "italic" : "normal"); }}
      >
        <Italic className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant={isUnderline ? "default" : "ghost"}
        size="icon"
        className="h-7 w-7"
        onClick={() => { setIsUnderline(!isUnderline); updateProp("underline", !isUnderline); }}
      >
        <Underline className="h-3.5 w-3.5" />
      </Button>

      <div className="h-5 w-px bg-border mx-0.5" />

      {/* Alignment */}
      {[
        { align: "left", Icon: AlignLeft },
        { align: "center", Icon: AlignCenter },
        { align: "right", Icon: AlignRight },
      ].map(({ align, Icon }) => (
        <Button
          key={align}
          variant={textAlign === align ? "default" : "ghost"}
          size="icon"
          className="h-7 w-7"
          onClick={() => { setTextAlign(align); updateProp("textAlign", align); }}
        >
          <Icon className="h-3.5 w-3.5" />
        </Button>
      ))}

      <div className="h-5 w-px bg-border mx-0.5" />

      {/* Color */}
      <input
        type="color"
        value={fillColor}
        onChange={(e) => { setFillColor(e.target.value); updateProp("fill", e.target.value); }}
        className="w-7 h-7 rounded cursor-pointer border"
      />
    </div>
  );
}
