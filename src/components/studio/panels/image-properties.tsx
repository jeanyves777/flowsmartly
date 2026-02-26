"use client";

import { useState, useEffect, useCallback } from "react";
import { Lock, Unlock, Eraser, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useCanvasStore } from "../hooks/use-canvas-store";

export function ImageProperties() {
  const canvas = useCanvasStore((s) => s.canvas);
  const selectedObjectIds = useCanvasStore((s) => s.selectedObjectIds);
  const { toast } = useToast();

  const [opacity, setOpacity] = useState(100);
  const [posX, setPosX] = useState(0);
  const [posY, setPosY] = useState(0);
  const [width, setWidth] = useState(200);
  const [height, setHeight] = useState(200);
  const [lockAspect, setLockAspect] = useState(true);
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [strokeWidth, setStrokeWidth] = useState(0);

  const [removingBg, setRemovingBg] = useState(false);

  // Filters
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [blur, setBlur] = useState(0);
  const [grayscale, setGrayscale] = useState(false);

  const getActiveImage = useCallback(() => {
    if (!canvas) return null;
    const obj = canvas.getActiveObject();
    if (!obj || obj.type !== "image") return null;
    return obj;
  }, [canvas]);

  useEffect(() => {
    const obj = getActiveImage();
    if (!obj) return;
    setOpacity(Math.round((obj.opacity || 1) * 100));
    setPosX(Math.round(obj.left || 0));
    setPosY(Math.round(obj.top || 0));
    setWidth(Math.round((obj.width || 0) * (obj.scaleX || 1)));
    setHeight(Math.round((obj.height || 0) * (obj.scaleY || 1)));
    setStrokeColor(obj.stroke || "#000000");
    setStrokeWidth(obj.strokeWidth || 0);
  }, [selectedObjectIds, getActiveImage]);

  const updateProp = (prop: string, value: any) => {
    const obj = getActiveImage();
    if (!obj) return;
    obj.set(prop, value);
    obj.setCoords();
    canvas?.renderAll();
  };

  const applyFilters = async () => {
    const obj = getActiveImage();
    if (!obj) return;
    const fabric = await import("fabric");

    const filters: any[] = [];
    if (brightness !== 0) {
      filters.push(new fabric.filters.Brightness({ brightness: brightness / 100 }));
    }
    if (contrast !== 0) {
      filters.push(new fabric.filters.Contrast({ contrast: contrast / 100 }));
    }
    if (saturation !== 0) {
      filters.push(new fabric.filters.Saturation({ saturation: saturation / 100 }));
    }
    if (blur > 0) {
      filters.push(new fabric.filters.Blur({ blur: blur / 100 }));
    }
    if (grayscale) {
      filters.push(new fabric.filters.Grayscale());
    }

    obj.filters = filters;
    obj.applyFilters();
    canvas?.renderAll();
  };

  const handleRemoveBackground = async () => {
    const obj = getActiveImage();
    if (!obj) return;

    const src = obj.getSrc?.() || obj._element?.src;
    if (!src) {
      toast({ title: "Cannot read image source", variant: "destructive" });
      return;
    }

    setRemovingBg(true);
    try {
      let imageUrl = src;

      // If data URL or blob URL, upload first
      if (src.startsWith("data:") || src.startsWith("blob:")) {
        const blob = await fetch(src).then((r) => r.blob());
        const formData = new FormData();
        formData.append("file", blob, "bg-remove-input.png");
        formData.append("tags", JSON.stringify(["studio-bg-remove"]));
        const uploadRes = await fetch("/api/media", { method: "POST", body: formData });
        const uploadData = await uploadRes.json();
        if (!uploadData.success) throw new Error("Upload failed");
        imageUrl = uploadData.data.file.url;
      }

      const res = await fetch("/api/image-tools/remove-background", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || "Failed");

      if (data.data?.imageUrl) {
        const fabric = await import("fabric");
        const newImg = await fabric.FabricImage.fromURL(data.data.imageUrl, { crossOrigin: "anonymous" });
        if (newImg) {
          // Preserve position/scale
          newImg.set({
            left: obj.left, top: obj.top,
            scaleX: obj.scaleX, scaleY: obj.scaleY,
            angle: obj.angle,
          });
          (newImg as any).id = (obj as any).id;
          (newImg as any).customName = "Image (No BG)";
          canvas?.remove(obj);
          canvas?.add(newImg);
          canvas?.setActiveObject(newImg);
          canvas?.renderAll();
        }
        toast({ title: "Background removed!" });
      }
    } catch (e) {
      toast({
        title: "Background removal failed",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setRemovingBg(false);
    }
  };

  return (
    <div className="p-3 space-y-4">
      <h3 className="text-sm font-semibold">Image</h3>

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
                const obj = getActiveImage();
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
                const obj = getActiveImage();
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

      {/* Border */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Border</label>
        <div className="flex items-center gap-2 mb-2">
          <input
            type="color"
            value={strokeColor}
            onChange={(e) => {
              setStrokeColor(e.target.value);
              updateProp("stroke", e.target.value);
            }}
            className="w-8 h-8 rounded cursor-pointer border"
          />
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
          />
          <span className="text-xs w-6 text-right">{strokeWidth}</span>
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

      {/* Filters */}
      <div>
        <label className="text-xs font-medium mb-2 block">Filters</label>
        <div className="space-y-2">
          <div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Brightness</span>
              <span>{brightness}</span>
            </div>
            <input
              type="range"
              min={-100}
              max={100}
              value={brightness}
              onChange={(e) => { setBrightness(parseInt(e.target.value)); applyFilters(); }}
              className="w-full h-1.5 accent-brand-500"
            />
          </div>
          <div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Contrast</span>
              <span>{contrast}</span>
            </div>
            <input
              type="range"
              min={-100}
              max={100}
              value={contrast}
              onChange={(e) => { setContrast(parseInt(e.target.value)); applyFilters(); }}
              className="w-full h-1.5 accent-brand-500"
            />
          </div>
          <div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Saturation</span>
              <span>{saturation}</span>
            </div>
            <input
              type="range"
              min={-100}
              max={100}
              value={saturation}
              onChange={(e) => { setSaturation(parseInt(e.target.value)); applyFilters(); }}
              className="w-full h-1.5 accent-brand-500"
            />
          </div>
          <div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Blur</span>
              <span>{blur}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={blur}
              onChange={(e) => { setBlur(parseInt(e.target.value)); applyFilters(); }}
              className="w-full h-1.5 accent-brand-500"
            />
          </div>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={grayscale}
              onChange={(e) => { setGrayscale(e.target.checked); applyFilters(); }}
              className="accent-brand-500"
            />
            Grayscale
          </label>
        </div>
      </div>

      {/* Remove Background */}
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-1.5"
        onClick={handleRemoveBackground}
        disabled={removingBg}
      >
        {removingBg ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Eraser className="h-4 w-4" />
        )}
        {removingBg ? "Removing..." : "Remove Background"}
      </Button>
    </div>
  );
}
