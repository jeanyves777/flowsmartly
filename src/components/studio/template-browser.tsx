"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Image,
  Megaphone,
  FileText,
  Presentation,
  PanelTop,
  Signpost,
  Loader2,
  LayoutGrid,
  Search,
  Eye,
  Wand2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DESIGN_CATEGORIES } from "@/lib/constants/design-presets";

export interface DesignTemplate {
  id: string;
  name: string;
  category: string;
  preset: string;
  thumbnail: string;
  image: string;
  tags: string[];
}

interface TemplateBrowserProps {
  onSelectTemplate: (template: DesignTemplate) => void;
}

const categoryIcons: Record<string, React.ElementType> = {
  social_post: Image,
  ad: Megaphone,
  flyer: FileText,
  poster: Presentation,
  banner: PanelTop,
  signboard: Signpost,
};

export function TemplateBrowser({ onSelectTemplate }: TemplateBrowserProps) {
  const [templates, setTemplates] = useState<DesignTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [previewTemplate, setPreviewTemplate] = useState<DesignTemplate | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory) params.set("category", selectedCategory);
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`/api/design-templates?${params}`);
      const data = await res.json();
      if (data.success) {
        setTemplates(data.templates);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const getCategoryLabel = (catId: string) => {
    return DESIGN_CATEGORIES.find((c) => c.id === catId)?.name || catId;
  };

  return (
    <div className="space-y-5">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search templates..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50"
        />
      </div>

      {/* Category filter pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            !selectedCategory
              ? "bg-brand-500 text-white shadow-sm"
              : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          All
        </button>
        {DESIGN_CATEGORIES.map((cat) => {
          const CatIcon = categoryIcons[cat.id] || Image;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                selectedCategory === cat.id
                  ? "bg-brand-500 text-white shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <CatIcon className="w-3.5 h-3.5" />
              {cat.name}
            </button>
          );
        })}
      </div>

      {/* Templates grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <LayoutGrid className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-1">No templates yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            {selectedCategory
              ? `No templates found for ${getCategoryLabel(selectedCategory)}. Templates will appear here once added.`
              : "Design templates will appear here once added. You can download free templates from Canva.com and add them to the collection."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {templates.map((template) => {
            const CatIcon = categoryIcons[template.category] || Image;
            return (
              <div
                key={template.id}
                className="group relative rounded-2xl border bg-card overflow-hidden hover:border-brand-500/30 hover:shadow-lg transition-all cursor-pointer"
                onClick={() => setPreviewTemplate(template)}
              >
                {/* Thumbnail */}
                <div className="aspect-[4/5] relative bg-muted/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={template.thumbnail}
                    alt={template.name}
                    className="w-full h-full object-cover"
                  />
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="rounded-xl bg-white/90 text-black hover:bg-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewTemplate(template);
                        }}
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        Preview
                      </Button>
                      <Button
                        size="sm"
                        className="rounded-xl bg-brand-500 hover:bg-brand-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectTemplate(template);
                        }}
                      >
                        <Wand2 className="w-3.5 h-3.5 mr-1" />
                        Use
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="p-3">
                  <h4 className="text-sm font-medium truncate">{template.name}</h4>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Badge
                      variant="secondary"
                      className="text-[10px] bg-muted/50 gap-1"
                    >
                      <CatIcon className="w-3 h-3" />
                      {getCategoryLabel(template.category)}
                    </Badge>
                    {template.preset && (
                      <Badge variant="secondary" className="text-[10px] bg-muted/50">
                        {template.preset}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview Modal */}
      <Dialog open={!!previewTemplate} onOpenChange={(open) => !open && setPreviewTemplate(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {previewTemplate && (
                <>
                  {(() => {
                    const CatIcon = categoryIcons[previewTemplate.category] || Image;
                    return <CatIcon className="w-5 h-5 text-brand-500" />;
                  })()}
                  {previewTemplate.name}
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          {previewTemplate && (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden border bg-muted/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewTemplate.image}
                  alt={previewTemplate.name}
                  className="w-full h-auto max-h-[60vh] object-contain"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-brand-500/10 text-brand-500 border-brand-500/20">
                    {getCategoryLabel(previewTemplate.category)}
                  </Badge>
                  <Badge variant="secondary">{previewTemplate.preset}</Badge>
                  {previewTemplate.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <Button
                  className="bg-brand-500 hover:bg-brand-600 rounded-xl"
                  onClick={() => {
                    onSelectTemplate(previewTemplate);
                    setPreviewTemplate(null);
                  }}
                >
                  <Wand2 className="w-4 h-4 mr-2" />
                  Use This Template
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
