"use client";

import type { WebsiteBlock, WebsiteTheme, TestimonialsContent } from "@/types/website-builder";
import { Star, Quote } from "lucide-react";

interface Props { block: WebsiteBlock; theme: WebsiteTheme; isEditing?: boolean; }

export function TestimonialsBlock({ block }: Props) {
  const content = block.content as TestimonialsContent;
  const colClass = content.layout === "single" ? "max-w-2xl mx-auto" : content.layout === "masonry" ? "columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6";

  return (
    <div className="py-16 sm:py-24">
      {content.headline && <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">{content.headline}</h2>}
      {content.subheadline && <p className="text-lg text-[var(--wb-text-muted)] text-center mb-12 max-w-2xl mx-auto">{content.subheadline}</p>}
      <div className={colClass}>
        {content.items.map((item, i) => (
          <div key={i} className={`p-6 rounded-xl bg-[var(--wb-surface)] border border-[var(--wb-border)] ${content.layout === "masonry" ? "break-inside-avoid" : ""}`}>
            <Quote className="w-8 h-8 text-[var(--wb-primary)]/30 mb-4" />
            {item.rating && (
              <div className="flex gap-1 mb-3">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star key={j} className={`w-4 h-4 ${j < item.rating! ? "fill-[var(--wb-accent)] text-[var(--wb-accent)]" : "text-[var(--wb-border)]"}`} />
                ))}
              </div>
            )}
            <p className="text-base mb-6 leading-relaxed italic">&ldquo;{item.quote}&rdquo;</p>
            <div className="flex items-center gap-3">
              {item.avatarUrl ? (
                <img src={item.avatarUrl} alt={item.author} className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[var(--wb-primary)]/10 flex items-center justify-center text-[var(--wb-primary)] font-bold text-sm">
                  {item.author.charAt(0)}
                </div>
              )}
              <div>
                <p className="font-semibold text-sm">{item.author}</p>
                {(item.role || item.company) && (
                  <p className="text-xs text-[var(--wb-text-muted)]">
                    {item.role}{item.role && item.company ? " at " : ""}{item.company}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
