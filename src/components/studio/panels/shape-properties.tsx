"use client";

import { useState, useEffect, useCallback } from "react";
import { Minus, Plus, Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCanvasStore } from "../hooks/use-canvas-store";
import { ColorInput } from "./color-input";

export function ShapeProperties() {
  const canvas = useCanvasStore((s) => s.canvas);
  const selectedObjectIds = useCanvasStore((s) => s.selectedObjectIds);
  const selectedObjectType = useCanvasStore((s) => s.selectedObjectType);

  const [fillColor, setFillColor] = useState("#3b82f6");
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [strokeWidth, setStrokeWidth] = useState(0);
  const [opacity, setOpacity] = useState(100);
  const [posX, setPosX] = useState(0);
  const [posY, setPosY] = useState(0);
  const [width, setWidth] = useState(200);
  const [height, setHeight] = useState(200);
  const [borderRadius, setBorderRadius] = useState(0);
  const [lockAspect, setLockAspect] = useState(false);
  const [shadowEnabled, setShadowEnabled] = useState(false);
  const [shadowColor, setShadowColor] = useState("#000000");
  const [shadowBlur, setShadowBlur] = useState(8);
  const [shadowOffsetX, setShadowOffsetX] = useState(2);
  const [shadowOffsetY, setShadowOffsetY] = useState(2);

  const getActiveObject = useCallback(() => {
    if (!canvas) return null;
    return canvas.getActiveObject();
  }, [canvas]);

  // Sync state from selected object
  useEffect(() => {
    const obj = getActiveObject();
    if (!obj) return;
    setFillColor(obj.fill || "#3b82f6");
    setStrokeColor(obj.stroke || "#000000");
    setStrokeWidth(obj.strokeWidth || 0);
    setOpacity(Math.round((obj.opacity || 1) * 100));
    setPosX(Math.round(obj.left || 0));
    setPosY(Math.round(obj.top || 0));
    setWidth(Math.round((obj.width || 0) * (obj.scaleX || 1)));
    setHeight(Math.round((obj.height || 0) * (obj.scaleY || 1)));
    if (obj.rx !== undefined) setBorderRadius(obj.rx || 0);

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
  }, [selectedObjectIds, getActiveObject]);

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
    const obj = getActiveObject();
    if (!obj || !canvas) return;
    if (!enabled) {
      obj.set("shadow", null);
    } else {
      const fabric = await import("fabric");
      obj.set("shadow", new fabric.Shadow({ color, blur, offsetX, offsetY }));
    }
    canvas.renderAll();
  };

  const updateProp = (prop: string, value: any) => {
    const obj = getActiveObject();
    if (!obj) return;
    obj.set(prop, value);
    obj.setCoords();
    canvas?.renderAll();
  };

  const isRect = selectedObjectType === "rect";

  return (
    <div className="p-3 space-y-4">
      <h3 className="text-sm font-semibold capitalize">
        {selectedObjectType === "activeSelection" ? "Selection" : selectedObjectType || "Shape"}
      </h3>

      {/* Position */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Position</label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-[10px] text-muted-foreground">X</span>
            <Input
              type="number"
              value={posX}
              onChange={(e) => {
                const v = parseInt(e.target.value) || 0;
                setPosX(v);
                updateProp("left", v);
              }}
              className="h-8 text-xs"
            />
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground">Y</span>
            <Input
              type="number"
              value={posY}
              onChange={(e) => {
                const v = parseInt(e.target.value) || 0;
                setPosY(v);
                updateProp("top", v);
              }}
              className="h-8 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Size */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Size</label>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <span className="text-[10px] text-muted-foreground">W</span>
            <Input
              type="number"
              value={width}
              onChange={(e) => {
                const obj = getActiveObject();
                if (!obj) return;
                const v = parseInt(e.target.value) || 1;
                setWidth(v);
                const scaleX = v / (obj.width || 1);
                obj.set("scaleX", scaleX);
                if (lockAspect) {
                  obj.set("scaleY", scaleX);
                  setHeight(Math.round((obj.height || 0) * scaleX));
                }
                obj.setCoords();
                canvas?.renderAll();
              }}
              className="h-8 text-xs"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setLockAspect(!lockAspect)}
          >
            {lockAspect ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
          </Button>
          <div className="flex-1">
            <span className="text-[10px] text-muted-foreground">H</span>
            <Input
              type="number"
              value={height}
              onChange={(e) => {
                const obj = getActiveObject();
                if (!obj) return;
                const v = parseInt(e.target.value) || 1;
                setHeight(v);
                const scaleY = v / (obj.height || 1);
                obj.set("scaleY", scaleY);
                if (lockAspect) {
                  obj.set("scaleX", scaleY);
                  setWidth(Math.round((obj.width || 0) * scaleY));
                }
                obj.setCoords();
                canvas?.renderAll();
              }}
              className="h-8 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Fill Color */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Fill</label>
        <ColorInput
          label="Fill color"
          value={fillColor}
          onChange={(hex) => {
            setFillColor(hex);
            updateProp("fill", hex);
          }}
        />
      </div>

      {/* Stroke */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Stroke</label>
        <div className="mb-2">
          <ColorInput
            label="Stroke color"
            value={strokeColor}
            onChange={(hex) => {
              setStrokeColor(hex);
              updateProp("stroke", hex);
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-12">Width</span>
          <input
            type="range"
            min={0}
            max={20}
            value={strokeWidth}
            onChange={(e) => {
              const v = parseInt(e.target.value);
              setStrokeWidth(v);
              updateProp("strokeWidth", v);
            }}
            className="flex-1 h-1.5 accent-brand-500"
            aria-label="Stroke width"
          />
          <span className="text-xs w-6 text-right">{strokeWidth}</span>
        </div>
      </div>

      {/* Border Radius (rect only) */}
      {isRect && (
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            Border Radius: {borderRadius}
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={borderRadius}
            onChange={(e) => {
              const v = parseInt(e.target.value);
              setBorderRadius(v);
              const obj = getActiveObject();
              if (obj) {
                obj.set({ rx: v, ry: v });
                canvas?.renderAll();
              }
            }}
            className="w-full h-1.5 accent-brand-500"
          />
        </div>
      )}

      {/* Shadow */}
      <div className="border-t pt-3 space-y-2">
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
                <span className="text-[10px] text-muted-foreground">Blur</span>
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
                  <span className="text-[10px] text-muted-foreground">Offset X</span>
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
                  <span className="text-[10px] text-muted-foreground">Offset Y</span>
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
