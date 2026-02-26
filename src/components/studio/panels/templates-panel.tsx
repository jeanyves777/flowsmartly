"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Loader2,
  LayoutGrid,
  Image as ImageIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import { useCanvasStore } from "../hooks/use-canvas-store";
import { DESIGN_CATEGORIES } from "@/lib/constants/design-presets";
import { addImageToCanvas } from "../utils/canvas-helpers";

interface DesignTemplate {
  id: string;
  name: string;
  category: string;
  preset: string;
  thumbnail: string;
  image: string;
  tags: string[];
  canvasData?: string;
}

export function TemplatesPanel() {
  const canvas = useCanvasStore((s) => s.canvas);
  const setCanvasDimensions = useCanvasStore((s) => s.setCanvasDimensions);

  const [templates, setTemplates] = useState<DesignTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory) params.set("category", selectedCategory);
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`/api/design-templates?${params}`);
      const data = await res.json();
      if (data.success) {
        setTemplates(data.data?.templates || []);
      }
    } catch {
      // fail silently
    }
    setLoading(false);
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleApplyTemplate = async (template: DesignTemplate) => {
    if (!canvas) return;

    // If template has canvas JSON data, load it
    if (template.canvasData) {
      try {
        await canvas.loadFromJSON(template.canvasData);
        canvas.renderAll();
        useCanvasStore.getState().refreshLayers();
        return;
      } catch {
        // Fall through to image approach
      }
    }

    // Otherwise, add the template image as a background
    const imageUrl = template.image || template.thumbnail;
    if (!imageUrl) return;

    // Parse preset size
    const presetMatch = template.preset?.match(/(\d+)\s*x\s*(\d+)/i);
    if (presetMatch) {
      const w = parseInt(presetMatch[1]);
      const h = parseInt(presetMatch[2]);
      setCanvasDimensions(w, h);
    }

    const fabric = await import("fabric");
    await addImageToCanvas(canvas, imageUrl, fabric, {
      left: 0,
      top: 0,
      selectable: true,
    });
  };

  return (
    <div className="p-3">
      <h3 className="text-sm font-semibold mb-3">Templates</h3>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <Badge
          variant={selectedCategory === null ? "default" : "outline"}
          className="cursor-pointer text-[10px]"
          onClick={() => setSelectedCategory(null)}
        >
          <LayoutGrid className="h-3 w-3 mr-1" />
          All
        </Badge>
        {DESIGN_CATEGORIES.map((cat) => (
          <Badge
            key={cat.id}
            variant={selectedCategory === cat.id ? "default" : "outline"}
            className="cursor-pointer text-[10px]"
            onClick={() =>
              setSelectedCategory(selectedCategory === cat.id ? null : cat.id)
            }
          >
            {cat.name}
          </Badge>
        ))}
      </div>

      {/* Templates grid */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No templates found</p>
          <p className="text-xs mt-1">Try a different category or search</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {templates.map((template) => (
            <button
              key={template.id}
              onClick={() => handleApplyTemplate(template)}
              className="relative aspect-[3/4] rounded-lg overflow-hidden border border-border hover:border-brand-500 transition-colors group"
            >
              <img
                src={template.thumbnail || template.image}
                alt={template.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="absolute bottom-0 left-0 right-0 p-2">
                  <p className="text-white text-xs font-medium truncate">
                    {template.name}
                  </p>
                  <p className="text-white/70 text-[10px]">{template.preset}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
