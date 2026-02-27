"use client";

import { useState, useEffect, useCallback } from "react";
import { Paintbrush, ImageIcon, Upload, Loader2, FolderOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useCanvasStore } from "../hooks/use-canvas-store";

interface MediaItem {
  id: string;
  url: string;
  filename: string;
  type: string;
}

const SOLID_COLORS = [
  "#ffffff", "#f8f9fa", "#e9ecef", "#dee2e6", "#ced4da", "#adb5bd",
  "#6c757d", "#495057", "#343a40", "#212529", "#000000",
  "#ff6b6b", "#ee5a24", "#f0932b", "#f9ca24", "#6ab04c", "#badc58",
  "#22a6b3", "#0984e3", "#6c5ce7", "#a29bfe", "#fd79a8", "#e84393",
  "#d63031", "#e17055", "#fdcb6e", "#00b894", "#00cec9", "#0984e3",
  "#6c5ce7", "#e84393", "#2d3436", "#636e72",
];

const GRADIENT_PRESETS = [
  { name: "Sunset", colors: ["#ff6b6b", "#feca57"] },
  { name: "Ocean", colors: ["#0984e3", "#00cec9"] },
  { name: "Forest", colors: ["#00b894", "#55efc4"] },
  { name: "Purple", colors: ["#6c5ce7", "#a29bfe"] },
  { name: "Rose", colors: ["#e84393", "#fd79a8"] },
  { name: "Night", colors: ["#2d3436", "#636e72"] },
  { name: "Fire", colors: ["#d63031", "#f0932b"] },
  { name: "Sky", colors: ["#74b9ff", "#a29bfe"] },
  { name: "Mint", colors: ["#00cec9", "#81ecec"] },
  { name: "Warm", colors: ["#fdcb6e", "#e17055"] },
  { name: "Cool", colors: ["#74b9ff", "#0984e3"] },
  { name: "Candy", colors: ["#fd79a8", "#fdcb6e"] },
];

export function BackgroundsPanel() {
  const canvas = useCanvasStore((s) => s.canvas);
  const setDirty = useCanvasStore((s) => s.setDirty);
  const refreshLayers = useCanvasStore((s) => s.refreshLayers);
  const [customColor, setCustomColor] = useState("#ffffff");
  const [libraryImages, setLibraryImages] = useState<MediaItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [settingBgId, setSettingBgId] = useState<string | null>(null);

  // Auto-load user's media library
  const fetchLibrary = useCallback(async () => {
    setLibraryLoading(true);
    try {
      const res = await fetch("/api/media?type=image&limit=20");
      const data = await res.json();
      if (data.success) {
        setLibraryImages(data.data?.files || []);
      }
    } catch {
      // silently fail
    }
    setLibraryLoading(false);
  }, []);

  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  const setBackgroundColor = (color: string) => {
    if (!canvas) return;
    // Remove existing background image
    const existing = canvas.getObjects().find((o: any) => o.id === "background-image");
    if (existing) canvas.remove(existing);
    canvas.backgroundColor = color;
    canvas.renderAll();
    setDirty(true);
  };

  const setBackgroundGradient = async (colors: string[]) => {
    if (!canvas) return;
    // Remove existing background image
    const existing = canvas.getObjects().find((o: any) => o.id === "background-image");
    if (existing) canvas.remove(existing);
    const fabric = await import("fabric");
    const gradient = new fabric.Gradient({
      type: "linear",
      coords: { x1: 0, y1: 0, x2: canvas.width, y2: canvas.height },
      colorStops: [
        { offset: 0, color: colors[0] },
        { offset: 1, color: colors[1] },
      ],
    });
    canvas.backgroundColor = gradient as any;
    canvas.renderAll();
    setDirty(true);
  };

  // Shared helper: load an image URL as canvas background
  const setImageBackground = async (imageUrl: string) => {
    if (!canvas) return;
    try {
      const fabric = await import("fabric");
      // Proxy external URLs
      const url = imageUrl.startsWith("http") && !imageUrl.startsWith(window.location.origin)
        ? `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`
        : imageUrl;
      const fabricImg = await fabric.FabricImage.fromURL(url, { crossOrigin: "anonymous" });
      if (!fabricImg || !fabricImg.width || !fabricImg.height) return;

      // Use design dimensions from store (not viewport size)
      const store = useCanvasStore.getState();
      const cw = store.canvasWidth;
      const ch = store.canvasHeight;

      // Scale to exactly fill canvas (stretches to fit, no overflow)
      // Fabric.js v6 defaults originX/originY to 'center' — we need 'left'/'top'
      // so that left:0, top:0 places the image's top-left corner at canvas origin
      fabricImg.set({
        left: 0,
        top: 0,
        originX: "left",
        originY: "top",
        scaleX: cw / fabricImg.width,
        scaleY: ch / fabricImg.height,
        selectable: false,
        evented: false,
      });
      (fabricImg as any).id = "background-image";
      (fabricImg as any).customName = "Background";

      // Remove existing background image if any
      const existing = canvas.getObjects().find((o: any) => o.id === "background-image");
      if (existing) canvas.remove(existing);

      // Reset canvas backgroundColor when using image
      canvas.backgroundColor = "#ffffff";

      // Add at bottom of stack
      canvas.add(fabricImg);
      canvas.sendObjectToBack(fabricImg);
      canvas.renderAll();
      refreshLayers();
      setDirty(true);
    } catch {
      // silently fail
    }
  };

  const handleImageBackground = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !canvas) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      await setImageBackground(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleLibraryImageClick = async (item: MediaItem) => {
    setSettingBgId(item.id);
    await setImageBackground(item.url);
    setSettingBgId(null);
  };

  return (
    <div className="p-3">
      <h3 className="text-sm font-semibold mb-3">Background</h3>

      {/* Solid Colors */}
      <div className="mb-4">
        <div className="flex items-center gap-1.5 mb-2">
          <Paintbrush className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">Solid Colors</span>
        </div>
        <div className="grid grid-cols-8 gap-1.5">
          {SOLID_COLORS.map((color, i) => (
            <button
              key={`${color}-${i}`}
              onClick={() => setBackgroundColor(color)}
              className="w-7 h-7 rounded border border-border hover:scale-110 transition-transform"
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <input
            type="color"
            value={customColor}
            onChange={(e) => {
              setCustomColor(e.target.value);
              setBackgroundColor(e.target.value);
            }}
            className="w-8 h-8 rounded cursor-pointer border border-border"
          />
          <Input
            value={customColor}
            onChange={(e) => {
              setCustomColor(e.target.value);
              if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
                setBackgroundColor(e.target.value);
              }
            }}
            className="h-8 text-xs font-mono flex-1"
            placeholder="#000000"
          />
        </div>
      </div>

      {/* Gradients */}
      <div className="mb-4">
        <div className="flex items-center gap-1.5 mb-2">
          <Paintbrush className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">Gradients</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {GRADIENT_PRESETS.map((gradient) => (
            <button
              key={gradient.name}
              onClick={() => setBackgroundGradient(gradient.colors)}
              className="aspect-square rounded-lg border border-border hover:scale-105 transition-transform"
              style={{
                background: `linear-gradient(135deg, ${gradient.colors[0]}, ${gradient.colors[1]})`,
              }}
              title={gradient.name}
            />
          ))}
        </div>
      </div>

      {/* Image Background Upload */}
      <div className="mb-4">
        <div className="flex items-center gap-1.5 mb-2">
          <Upload className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">Upload Image</span>
        </div>
        <label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageBackground}
            className="hidden"
          />
          <div className="w-full h-14 rounded-lg border-2 border-dashed border-border hover:border-brand-500 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors">
            <Upload className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Upload image</span>
          </div>
        </label>
      </div>

      {/* From Library */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">From Library</span>
        </div>
        {libraryLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : libraryImages.length === 0 ? (
          <div className="text-center py-4 text-xs text-muted-foreground">
            <ImageIcon className="h-6 w-6 mx-auto mb-1 opacity-50" />
            <p>No images in library</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {libraryImages.map((item) => (
              <button
                key={item.id}
                onClick={() => handleLibraryImageClick(item)}
                disabled={settingBgId === item.id}
                className="relative aspect-square rounded-lg overflow-hidden border border-border hover:border-brand-500 transition-all group"
              >
                <img
                  src={item.url}
                  alt={item.filename}
                  className="w-full h-full object-cover"
                />
                {settingBgId === item.id && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
