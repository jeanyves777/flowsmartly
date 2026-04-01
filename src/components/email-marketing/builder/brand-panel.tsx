"use client";

import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";
import type { EmailBrand } from "@/lib/marketing/email-renderer";

interface BrandPanelProps {
  brand: EmailBrand | null;
  showLogo: boolean;
  showBrandName: boolean;
  logoSize: "normal" | "large" | "big";
  onToggleLogo: (v: boolean) => void;
  onToggleBrandName: (v: boolean) => void;
  onLogoSize: (v: "normal" | "large" | "big") => void;
}

export function BrandPanel({ brand, showLogo, showBrandName, logoSize, onToggleLogo, onToggleBrandName, onLogoSize }: BrandPanelProps) {
  if (!brand || (!brand.name && !brand.logo)) return null;

  return (
    <div className="border rounded-lg p-3 space-y-3 bg-card">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold">Brand Identity</Label>
        <Badge variant="secondary" className="text-[10px]">{brand.name || "Brand"}</Badge>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {brand.logo && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showLogo} onChange={(e) => onToggleLogo(e.target.checked)} className="rounded border-gray-300" />
            <span className="text-xs">Logo</span>
          </label>
        )}
        {brand.name && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showBrandName} onChange={(e) => onToggleBrandName(e.target.checked)} className="rounded border-gray-300" />
            <span className="text-xs">Name</span>
          </label>
        )}
        {brand.logo && showLogo && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">Size:</span>
            {(["normal", "large", "big"] as const).map((sz) => (
              <button
                key={sz}
                onClick={() => onLogoSize(sz)}
                className={cn(
                  "px-2 py-0.5 text-[10px] rounded-full font-medium transition-colors capitalize",
                  logoSize === sz ? "bg-brand-500 text-white" : "bg-muted text-muted-foreground hover:bg-muted-foreground/20"
                )}
              >
                {sz}
              </button>
            ))}
          </div>
        )}
      </div>

      {brand.colors && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">Colors:</span>
          <div className="flex gap-1">
            <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: brand.colors.primary }} title="Primary" />
            <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: brand.colors.secondary }} title="Secondary" />
            <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: brand.colors.accent }} title="Accent" />
          </div>
        </div>
      )}
    </div>
  );
}
