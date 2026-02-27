"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Loader2,
  LayoutGrid,
  Image as ImageIcon,
  Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import { useCanvasStore } from "../hooks/use-canvas-store";
import { addImageToCanvas, createTextbox, safeLoadFromJSON } from "../utils/canvas-helpers";
import { DESIGN_CATEGORIES } from "@/lib/constants/design-presets";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

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

interface StarterTemplate {
  id: string;
  name: string;
  category: string;
  width: number;
  height: number;
  bgColor: string;
  gradient: string;
  elements: Array<{
    type: string;
    text: string;
    fontSize: number;
    fontWeight?: string;
    fontStyle?: string;
    fontFamily?: string;
    fill: string;
    textAlign: string;
    top: number;
    left: number;
    width: number;
    charSpacing?: number;
  }>;
}

const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: "t-bold-statement",
    name: "Bold Statement",
    category: "social_post",
    width: 1080, height: 1080, bgColor: "#6366f1",
    gradient: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
    elements: [
      { type: "textbox", text: "YOUR BIG\nIDEA HERE", fontSize: 80, fontWeight: "bold", fill: "#ffffff", textAlign: "center", top: 350, left: 90, width: 900 },
      { type: "textbox", text: "Share your message with the world", fontSize: 24, fill: "rgba(255,255,255,0.7)", textAlign: "center", top: 570, left: 190, width: 700 },
    ],
  },
  {
    id: "t-flash-sale",
    name: "Flash Sale",
    category: "social_post",
    width: 1080, height: 1080, bgColor: "#dc2626",
    gradient: "linear-gradient(135deg, #dc2626 0%, #f97316 100%)",
    elements: [
      { type: "textbox", text: "FLASH SALE", fontSize: 96, fontWeight: "bold", fill: "#ffffff", textAlign: "center", top: 300, left: 90, width: 900 },
      { type: "textbox", text: "UP TO 50% OFF", fontSize: 48, fontWeight: "bold", fill: "#fef08a", textAlign: "center", top: 450, left: 140, width: 800 },
      { type: "textbox", text: "Limited time only \u2022 Shop now", fontSize: 22, fill: "rgba(255,255,255,0.8)", textAlign: "center", top: 550, left: 240, width: 600 },
    ],
  },
  {
    id: "t-elegant-quote",
    name: "Elegant Quote",
    category: "social_post",
    width: 1080, height: 1080, bgColor: "#f8f5f0",
    gradient: "linear-gradient(135deg, #f8f5f0 0%, #e8e0d5 100%)",
    elements: [
      { type: "textbox", text: "\u201C", fontSize: 200, fill: "#c4b5a3", textAlign: "center", top: 150, left: 90, width: 900, fontFamily: "Georgia" },
      { type: "textbox", text: "The best way to predict\nthe future is to create it.", fontSize: 40, fontStyle: "italic", fill: "#2d2419", textAlign: "center", top: 370, left: 140, width: 800, fontFamily: "Georgia" },
      { type: "textbox", text: "\u2014 Peter Drucker", fontSize: 20, fill: "#8b7355", textAlign: "center", top: 530, left: 290, width: 500 },
    ],
  },
  {
    id: "t-dark-promo",
    name: "Dark Premium",
    category: "social_post",
    width: 1080, height: 1080, bgColor: "#0f172a",
    gradient: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    elements: [
      { type: "textbox", text: "PREMIUM\nCOLLECTION", fontSize: 72, fontWeight: "bold", fill: "#e2e8f0", textAlign: "center", top: 340, left: 90, width: 900, charSpacing: 200 },
      { type: "textbox", text: "Discover what\u2019s new", fontSize: 24, fill: "#94a3b8", textAlign: "center", top: 550, left: 290, width: 500 },
    ],
  },
  {
    id: "t-event-invite",
    name: "Event Invite",
    category: "social_post",
    width: 1080, height: 1350, bgColor: "#0d9488",
    gradient: "linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)",
    elements: [
      { type: "textbox", text: "YOU\u2019RE INVITED", fontSize: 28, fontWeight: "bold", fill: "rgba(255,255,255,0.7)", textAlign: "center", top: 350, left: 190, width: 700, charSpacing: 400 },
      { type: "textbox", text: "Event Name\nGoes Here", fontSize: 64, fontWeight: "bold", fill: "#ffffff", textAlign: "center", top: 430, left: 90, width: 900 },
      { type: "textbox", text: "Saturday, March 15th\n7:00 PM \u2022 Main Hall", fontSize: 24, fill: "rgba(255,255,255,0.8)", textAlign: "center", top: 620, left: 190, width: 700 },
    ],
  },
  {
    id: "t-thank-you",
    name: "Thank You",
    category: "social_post",
    width: 1080, height: 1080, bgColor: "#f472b6",
    gradient: "linear-gradient(135deg, #f472b6 0%, #c084fc 100%)",
    elements: [
      { type: "textbox", text: "Thank You!", fontSize: 80, fontWeight: "bold", fontStyle: "italic", fill: "#ffffff", textAlign: "center", top: 380, left: 90, width: 900, fontFamily: "Georgia" },
      { type: "textbox", text: "We truly appreciate your support", fontSize: 24, fill: "rgba(255,255,255,0.8)", textAlign: "center", top: 510, left: 190, width: 700 },
    ],
  },
  {
    id: "t-story-bold",
    name: "Story Bold",
    category: "social_post",
    width: 1080, height: 1920, bgColor: "#f97316",
    gradient: "linear-gradient(180deg, #f97316 0%, #ef4444 100%)",
    elements: [
      { type: "textbox", text: "YOUR\nSTORY\nHERE", fontSize: 120, fontWeight: "bold", fill: "#ffffff", textAlign: "center", top: 600, left: 90, width: 900 },
      { type: "textbox", text: "Swipe up for more \u2192", fontSize: 22, fill: "rgba(255,255,255,0.7)", textAlign: "center", top: 1400, left: 290, width: 500 },
    ],
  },
  {
    id: "t-youtube-thumb",
    name: "YouTube Thumb",
    category: "banner",
    width: 1280, height: 720, bgColor: "#1a1a2e",
    gradient: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #e94560 100%)",
    elements: [
      { type: "textbox", text: "WATCH\nTHIS", fontSize: 120, fontWeight: "bold", fill: "#ffffff", textAlign: "left", top: 150, left: 60, width: 700 },
      { type: "textbox", text: "You won\u2019t believe what happens!", fontSize: 28, fill: "#e94560", textAlign: "left", top: 480, left: 60, width: 700 },
    ],
  },
  {
    id: "t-facebook-cover",
    name: "Facebook Cover",
    category: "banner",
    width: 820, height: 312, bgColor: "#1e40af",
    gradient: "linear-gradient(90deg, #1e40af 0%, #7c3aed 100%)",
    elements: [
      { type: "textbox", text: "Your Brand Name", fontSize: 48, fontWeight: "bold", fill: "#ffffff", textAlign: "center", top: 100, left: 110, width: 600 },
      { type: "textbox", text: "Tagline goes here", fontSize: 20, fill: "rgba(255,255,255,0.7)", textAlign: "center", top: 180, left: 210, width: 400 },
    ],
  },
  {
    id: "t-product-feature",
    name: "Product Feature",
    category: "social_post",
    width: 1080, height: 1080, bgColor: "#ffffff",
    gradient: "linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)",
    elements: [
      { type: "textbox", text: "NEW ARRIVAL", fontSize: 18, fontWeight: "bold", fill: "#6366f1", textAlign: "center", top: 300, left: 290, width: 500, charSpacing: 500 },
      { type: "textbox", text: "Product Name", fontSize: 56, fontWeight: "bold", fill: "#1e293b", textAlign: "center", top: 350, left: 140, width: 800 },
      { type: "textbox", text: "$99.00", fontSize: 36, fill: "#6366f1", textAlign: "center", top: 450, left: 340, width: 400 },
      { type: "textbox", text: "The perfect addition to your collection.\nOrder now and get free shipping.", fontSize: 18, fill: "#64748b", textAlign: "center", top: 530, left: 190, width: 700 },
    ],
  },
  {
    id: "t-announcement",
    name: "Announcement",
    category: "social_post",
    width: 1080, height: 1080, bgColor: "#059669",
    gradient: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
    elements: [
      { type: "textbox", text: "BIG NEWS!", fontSize: 72, fontWeight: "bold", fill: "#ffffff", textAlign: "center", top: 380, left: 90, width: 900 },
      { type: "textbox", text: "Share your exciting announcement here.\nYour audience is waiting to hear from you.", fontSize: 22, fill: "rgba(255,255,255,0.8)", textAlign: "center", top: 510, left: 140, width: 800 },
    ],
  },
  {
    id: "t-linkedin-banner",
    name: "LinkedIn Banner",
    category: "banner",
    width: 1584, height: 396, bgColor: "#1e293b",
    gradient: "linear-gradient(90deg, #1e293b 0%, #334155 100%)",
    elements: [
      { type: "textbox", text: "Your Name | Professional Title", fontSize: 40, fontWeight: "bold", fill: "#ffffff", textAlign: "left", top: 130, left: 80, width: 800 },
      { type: "textbox", text: "Helping companies grow \u2022 Speaker \u2022 Author", fontSize: 20, fill: "#94a3b8", textAlign: "left", top: 210, left: 80, width: 800 },
    ],
  },
];

export function TemplatesPanel() {
  const canvas = useCanvasStore((s) => s.canvas);
  const setCanvasDimensions = useCanvasStore((s) => s.setCanvasDimensions);
  const refreshLayers = useCanvasStore((s) => s.refreshLayers);
  const { toast } = useToast();

  const [templates, setTemplates] = useState<DesignTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory) params.set("category", selectedCategory);
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`/api/design-templates?${params}`);
      const data = await res.json();
      if (data.success) {
        setTemplates(data.templates || []);
      }
    } catch {
      // fail silently
    }
    setLoading(false);
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const filteredStarters = STARTER_TEMPLATES.filter((t) => {
    if (selectedCategory && t.category !== selectedCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return t.name.toLowerCase().includes(q) || t.category.includes(q);
    }
    return true;
  });

  const handleApplyStarter = async (template: StarterTemplate) => {
    if (!canvas) return;
    setApplyingId(template.id);
    try {
      canvas.clear();
      canvas.backgroundColor = template.bgColor;
      setCanvasDimensions(template.width, template.height);

      const fabric = await import("fabric");
      for (const el of template.elements) {
        if (el.type === "textbox") {
          const obj = createTextbox(fabric, {
            text: el.text,
            fontSize: el.fontSize,
            fontWeight: el.fontWeight || "normal",
            fontStyle: el.fontStyle || "normal",
            fontFamily: el.fontFamily || "Inter",
            fill: el.fill,
            textAlign: el.textAlign,
            top: el.top,
            left: el.left,
            width: el.width,
            ...(el.charSpacing ? { charSpacing: el.charSpacing } : {}),
          });
          canvas.add(obj);
        }
      }
      canvas.renderAll();
      refreshLayers();
      toast({ title: "Template applied!" });
    } catch {
      toast({ title: "Failed to apply template", variant: "destructive" });
    } finally {
      setApplyingId(null);
    }
  };

  const handleApplyTemplate = async (template: DesignTemplate) => {
    if (!canvas) return;
    setApplyingId(template.id);
    try {
      if (template.canvasData) {
        await safeLoadFromJSON(canvas, template.canvasData);
        refreshLayers();
        setApplyingId(null);
        return;
      }
      const imageUrl = template.image || template.thumbnail;
      if (!imageUrl) return;

      const presetMatch = template.preset?.match(/(\d+)\s*x\s*(\d+)/i);
      if (presetMatch) {
        setCanvasDimensions(parseInt(presetMatch[1]), parseInt(presetMatch[2]));
      }
      const fabric = await import("fabric");
      await addImageToCanvas(canvas, imageUrl, fabric, { left: 0, top: 0, selectable: true });
      toast({ title: "Template applied!" });
    } catch {
      toast({ title: "Failed to apply template", variant: "destructive" });
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <div className="p-3">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
        <Sparkles className="h-4 w-4 text-brand-500" />
        Templates
      </h3>

      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        <Badge
          variant={selectedCategory === null ? "default" : "outline"}
          className="cursor-pointer text-[10px] transition-all hover:scale-105"
          onClick={() => setSelectedCategory(null)}
        >
          <LayoutGrid className="h-3 w-3 mr-1" />
          All
        </Badge>
        {DESIGN_CATEGORIES.map((cat) => (
          <Badge
            key={cat.id}
            variant={selectedCategory === cat.id ? "default" : "outline"}
            className="cursor-pointer text-[10px] transition-all hover:scale-105"
            onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
          >
            {cat.name}
          </Badge>
        ))}
      </div>

      {filteredStarters.length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
            Starter Templates
          </div>
          <div className="grid grid-cols-2 gap-2">
            {filteredStarters.map((template, i) => (
              <motion.button
                key={template.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.2 }}
                onClick={() => handleApplyStarter(template)}
                disabled={applyingId === template.id}
                className={cn(
                  "relative rounded-lg overflow-hidden border border-border hover:border-brand-500 transition-all group",
                  template.width > template.height ? "aspect-video" : template.height > template.width * 1.5 ? "aspect-[9/16]" : "aspect-square"
                )}
              >
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center p-3"
                  style={{ background: template.gradient }}
                >
                  {applyingId === template.id ? (
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  ) : (
                    <span className={cn(
                      "font-bold text-center leading-tight",
                      template.bgColor === "#ffffff" || template.bgColor === "#f8f5f0" ? "text-gray-800" : "text-white",
                      template.width > template.height ? "text-[10px]" : "text-xs"
                    )}>
                      {template.elements[0]?.text.split("\n")[0]}
                    </span>
                  )}
                </div>
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1.5 translate-y-full group-hover:translate-y-0 transition-transform">
                  <p className="text-white text-[10px] font-medium truncate">{template.name}</p>
                  <p className="text-white/60 text-[9px]">{template.width}x{template.height}</p>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length > 0 ? (
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Gallery</div>
          <div className="grid grid-cols-2 gap-2">
            {templates.map((template, i) => (
              <motion.button
                key={template.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.2 }}
                onClick={() => handleApplyTemplate(template)}
                disabled={applyingId === template.id}
                className="relative aspect-[3/4] rounded-lg overflow-hidden border border-border hover:border-brand-500 transition-all group"
              >
                {applyingId === template.id ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted">
                    <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
                  </div>
                ) : (
                  <img src={template.thumbnail || template.image} alt={template.name} className="w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-0 left-0 right-0 p-2">
                    <p className="text-white text-xs font-medium truncate">{template.name}</p>
                    <p className="text-white/70 text-[10px]">{template.preset}</p>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      ) : null}

      {filteredStarters.length === 0 && !loading && templates.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No templates found</p>
          <p className="text-xs mt-1">Try a different category or search</p>
        </div>
      )}
    </div>
  );
}
