"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { STORE_TEMPLATES_FULL, type StoreTemplateConfig } from "@/lib/constants/store-templates";

interface ThemePickerProps {
  selectedTemplateId: string;
  onSelect: (templateId: string) => void;
  brandTemplate?: StoreTemplateConfig | null;
}

export function ThemePicker({ selectedTemplateId, onSelect, brandTemplate }: ThemePickerProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Theme</label>
      <div className="grid grid-cols-2 gap-2">
        {brandTemplate && (
          <button
            type="button"
            onClick={() => onSelect(brandTemplate.id)}
            className={cn(
              "relative rounded-lg border-2 p-2 text-left transition-all hover:shadow-md col-span-2",
              selectedTemplateId === brandTemplate.id
                ? "border-primary ring-2 ring-primary/20"
                : "border-muted hover:border-muted-foreground/30"
            )}
          >
            <div className="flex gap-0.5 mb-1.5 rounded overflow-hidden h-4">
              <div className="flex-1" style={{ backgroundColor: brandTemplate.colors.primary }} />
              <div className="flex-1" style={{ backgroundColor: brandTemplate.colors.secondary }} />
              <div className="flex-1" style={{ backgroundColor: brandTemplate.colors.accent }} />
              <div className="flex-1" style={{ backgroundColor: brandTemplate.colors.background, border: "1px solid #e5e7eb" }} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">MY BRAND</span>
              <p className="text-xs font-semibold truncate">{brandTemplate.description || "My Brand"}</p>
            </div>
            {selectedTemplateId === brandTemplate.id && (
              <div className="absolute top-1 right-1 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                <Check className="h-2.5 w-2.5 text-primary-foreground" />
              </div>
            )}
          </button>
        )}
        {STORE_TEMPLATES_FULL.map((template) => (
          <ThemeCard
            key={template.id}
            template={template}
            isSelected={selectedTemplateId === template.id}
            onSelect={() => onSelect(template.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ThemeCard({
  template,
  isSelected,
  onSelect,
}: {
  template: StoreTemplateConfig;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative rounded-lg border-2 p-2 text-left transition-all hover:shadow-md",
        isSelected
          ? "border-primary ring-2 ring-primary/20"
          : "border-muted hover:border-muted-foreground/30"
      )}
    >
      {/* Color preview bar */}
      <div className="flex gap-0.5 mb-1.5 rounded overflow-hidden h-4">
        <div className="flex-1" style={{ backgroundColor: template.colors.primary }} />
        <div className="flex-1" style={{ backgroundColor: template.colors.secondary }} />
        <div className="flex-1" style={{ backgroundColor: template.colors.accent }} />
        <div className="flex-1" style={{ backgroundColor: template.colors.background, border: "1px solid #e5e7eb" }} />
      </div>

      <p className="text-xs font-semibold truncate">{template.name}</p>
      <p className="text-[10px] text-muted-foreground truncate">{template.category}</p>

      {isSelected && (
        <div className="absolute top-1 right-1 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
          <Check className="h-2.5 w-2.5 text-primary-foreground" />
        </div>
      )}
    </button>
  );
}
