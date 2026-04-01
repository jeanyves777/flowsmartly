"use client";

import { Eye, Sparkles, Copy, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TemplateItem } from "./template-gallery";

interface TemplateCardProps {
  template: TemplateItem;
  onSelect: () => void;
  onPreview: () => void;
}

const SOURCE_BADGES: Record<string, { label: string; color: string }> = {
  ai_generated: { label: "AI", color: "text-purple-600 bg-purple-100 dark:bg-purple-900/30" },
  system_default: { label: "Default", color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30" },
  cloned: { label: "Cloned", color: "text-amber-600 bg-amber-100 dark:bg-amber-900/30" },
  manual: { label: "Custom", color: "text-green-600 bg-green-100 dark:bg-green-900/30" },
};

export function TemplateCard({ template, onSelect, onPreview }: TemplateCardProps) {
  const sourceBadge = SOURCE_BADGES[template.source] || SOURCE_BADGES.manual;

  return (
    <div className="group border rounded-lg overflow-hidden hover:border-brand-300 hover:shadow-sm transition-all bg-card">
      {/* Thumbnail area */}
      <div className="h-24 bg-gradient-to-br from-muted to-muted/50 relative flex items-center justify-center">
        {template.thumbnailUrl ? (
          <img src={template.thumbnailUrl} alt={template.name} className="w-full h-full object-cover" />
        ) : (
          <div className="text-center px-3">
            <p className="text-xs font-medium text-muted-foreground line-clamp-2">{template.subject || template.name}</p>
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={onSelect}>
            Use
          </Button>
          <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={onPreview}>
            <Eye className="w-3 h-3 mr-1" />
            Preview
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className="p-2.5 space-y-1.5">
        <div className="flex items-start justify-between gap-1">
          <p className="text-xs font-semibold line-clamp-1 flex-1">{template.name}</p>
          <Badge variant="secondary" className={`text-[9px] shrink-0 ${sourceBadge.color}`}>
            {template.source === "ai_generated" && <Sparkles className="w-2.5 h-2.5 mr-0.5" />}
            {sourceBadge.label}
          </Badge>
        </div>
        {template.description && (
          <p className="text-[10px] text-muted-foreground line-clamp-1">{template.description}</p>
        )}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <Badge variant="outline" className="text-[9px] capitalize">{template.category}</Badge>
          {template.usageCount > 0 && (
            <span className="flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" /> Used {template.usageCount}x
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
