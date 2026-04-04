"use client";

import type { WebsiteBlock, WebsiteTheme, GalleryContent } from "@/types/website-builder";
import { ImageIcon } from "lucide-react";

interface Props { block: WebsiteBlock; theme: WebsiteTheme; isEditing?: boolean; }

export function GalleryBlock({ block }: Props) {
  const content = block.content as GalleryContent;
  const colClass = content.columns === 2 ? "sm:grid-cols-2" : content.columns === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3";

  return (
    <div className="py-16 sm:py-24">
      {content.headline && <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">{content.headline}</h2>}
      {content.subheadline && <p className="text-lg text-[var(--wb-text-muted)] text-center mb-12 max-w-2xl mx-auto">{content.subheadline}</p>}
      <div className={content.layout === "masonry" ? `columns-1 ${colClass.replace("grid-cols", "columns")} gap-4 space-y-4` : `grid grid-cols-1 ${colClass} gap-4`}>
        {content.items.map((item, i) => (
          <div key={i} className={`group relative overflow-hidden rounded-lg ${content.layout === "masonry" ? "break-inside-avoid" : "aspect-square"}`}>
            {item.imageUrl ? (
              <img src={item.imageUrl} alt={item.caption || ""} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
            ) : (
              <div className="w-full h-full min-h-[200px] bg-[var(--wb-surface)] border border-[var(--wb-border)] flex items-center justify-center">
                <ImageIcon className="w-12 h-12 text-[var(--wb-text-muted)]/30" />
              </div>
            )}
            {item.caption && (
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                <p className="text-white text-sm font-medium">{item.caption}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
