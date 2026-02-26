"use client";

import { useState, useEffect, useCallback } from "react";
import { Upload, FolderOpen, Loader2, ImageIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useCanvasStore } from "../hooks/use-canvas-store";
import { addImageToCanvas } from "../utils/canvas-helpers";

interface MediaItem {
  id: string;
  url: string;
  filename: string;
  type: string;
  width?: number;
  height?: number;
}

export function UploadsPanel() {
  const canvas = useCanvasStore((s) => s.canvas);
  const { toast } = useToast();
  const [uploads, setUploads] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  const fetchUploads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/media?type=image&limit=30");
      const data = await res.json();
      if (data.success) {
        setUploads(data.data?.files || []);
      }
    } catch {
      // silently fail
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUploads();
  }, [fetchUploads]);

  const handleAddToCanvas = async (item: MediaItem) => {
    if (!canvas) return;
    setAddingId(item.id);
    try {
      const fabric = await import("fabric");
      await addImageToCanvas(canvas, item.url, fabric);
      toast({ title: "Image added to canvas" });
    } catch (err) {
      console.error("Failed to add image:", err);
      toast({ title: "Failed to add image", description: "The image could not be loaded", variant: "destructive" });
    } finally {
      setAddingId(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("tags", JSON.stringify(["studio-upload"]));

        const res = await fetch("/api/media", { method: "POST", body: formData });
        const data = await res.json();
        if (data.success && data.data?.file) {
          const newFile = data.data.file;
          setUploads((prev) => [newFile, ...prev]);

          // Add directly to canvas
          if (canvas) {
            const fabric = await import("fabric");
            await addImageToCanvas(canvas, newFile.url, fabric);
          }
        }
      }
    } catch {
      // error handled silently
    }
    setUploading(false);
    e.target.value = "";
  };

  return (
    <div className="p-3">
      <h3 className="text-sm font-semibold mb-3">Uploads</h3>

      {/* Upload button */}
      <div className="space-y-2 mb-4">
        <label className="w-full">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
          <div className="w-full h-20 rounded-lg border-2 border-dashed border-border hover:border-brand-500 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors">
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
            ) : (
              <>
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Upload images
                </span>
              </>
            )}
          </div>
        </label>

        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5"
          onClick={() => setShowLibrary(!showLibrary)}
        >
          <FolderOpen className="h-4 w-4" />
          Media Library
        </Button>
      </div>

      {/* Recent uploads grid */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : uploads.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No uploads yet</p>
          <p className="text-xs mt-1">Upload images to use in your designs</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {uploads.map((item) => (
            <button
              key={item.id}
              onClick={() => handleAddToCanvas(item)}
              disabled={addingId === item.id}
              className="relative aspect-square rounded-lg overflow-hidden border border-border hover:border-brand-500 transition-all group"
            >
              <img
                src={item.url}
                alt={item.filename}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                {addingId === item.id ? (
                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                ) : (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-full px-2.5 py-1">
                    <Plus className="h-3 w-3 text-white" />
                    <span className="text-white text-xs font-medium">Add</span>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
