"use client";

import type { WebsiteBlock, WebsiteTheme, LogoCloudContent } from "@/types/website-builder";
import { Building } from "lucide-react";

interface Props { block: WebsiteBlock; theme: WebsiteTheme; isEditing?: boolean; }

export function LogoCloudBlock({ block, isEditing }: Props) {
  const content = block.content as LogoCloudContent;

  if (content.layout === "scroll") {
    return (
      <div className="py-12 overflow-hidden">
        {content.headline && <h2 className="text-lg font-semibold text-center text-[var(--wb-text-muted)] mb-8">{content.headline}</h2>}
        <div className="flex animate-[scroll_30s_linear_infinite] gap-16 items-center">
          {[...content.logos, ...content.logos].map((logo, i) => (
            <div key={i} className="flex-shrink-0">
              {logo.imageUrl ? (
                <img src={logo.imageUrl} alt={logo.alt} className={`h-8 ${content.grayscale ? "grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all" : ""}`} />
              ) : (
                <div className="h-8 w-24 bg-[var(--wb-surface)] border border-[var(--wb-border)] rounded flex items-center justify-center">
                  <Building className="w-4 h-4 text-[var(--wb-text-muted)]/30" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="py-12">
      {content.headline && <h2 className="text-lg font-semibold text-center text-[var(--wb-text-muted)] mb-8">{content.headline}</h2>}
      {content.subheadline && <p className="text-sm text-[var(--wb-text-muted)] text-center mb-8">{content.subheadline}</p>}
      <div className={`flex flex-wrap items-center justify-center gap-8 sm:gap-12 ${content.layout === "grid" ? "grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6" : ""}`}>
        {content.logos.map((logo, i) => (
          <div key={i} className={content.layout === "grid" ? "flex items-center justify-center" : ""}>
            {logo.imageUrl ? (
              <a href={isEditing ? undefined : logo.link}>
                <img src={logo.imageUrl} alt={logo.alt} className={`h-8 sm:h-10 ${content.grayscale ? "grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all" : ""}`} />
              </a>
            ) : (
              <div className="h-10 w-28 bg-[var(--wb-surface)] border border-[var(--wb-border)] rounded flex items-center justify-center">
                <Building className="w-5 h-5 text-[var(--wb-text-muted)]/30" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
