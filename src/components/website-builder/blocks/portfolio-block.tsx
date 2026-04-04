"use client";

import { useState } from "react";
import type { WebsiteBlock, WebsiteTheme, PortfolioContent } from "@/types/website-builder";
import { ExternalLink, ImageIcon } from "lucide-react";

interface Props { block: WebsiteBlock; theme: WebsiteTheme; isEditing?: boolean; }

export function PortfolioBlock({ block, isEditing }: Props) {
  const content = block.content as PortfolioContent;
  const categories = content.filterable ? [...new Set(content.projects.map((p) => p.category).filter(Boolean))] : [];
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const filtered = activeCategory ? content.projects.filter((p) => p.category === activeCategory) : content.projects;
  const colClass = content.columns === 2 ? "sm:grid-cols-2" : content.columns === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3";

  return (
    <div className="py-16 sm:py-24">
      {content.headline && <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">{content.headline}</h2>}
      {content.subheadline && <p className="text-lg text-[var(--wb-text-muted)] text-center mb-8 max-w-2xl mx-auto">{content.subheadline}</p>}
      {content.filterable && categories.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          <button onClick={() => setActiveCategory(null)} className={`px-4 py-1.5 text-sm rounded-full transition-colors ${!activeCategory ? "bg-[var(--wb-primary)] text-white" : "bg-[var(--wb-surface)] text-[var(--wb-text-muted)] hover:bg-[var(--wb-border)]"}`}>All</button>
          {categories.map((cat) => (
            <button key={cat} onClick={() => setActiveCategory(cat!)} className={`px-4 py-1.5 text-sm rounded-full transition-colors ${activeCategory === cat ? "bg-[var(--wb-primary)] text-white" : "bg-[var(--wb-surface)] text-[var(--wb-text-muted)] hover:bg-[var(--wb-border)]"}`}>{cat}</button>
          ))}
        </div>
      )}
      <div className={`grid grid-cols-1 ${colClass} gap-6`}>
        {filtered.map((project, i) => (
          <a key={i} href={isEditing ? undefined : project.link} className="group block">
            <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-[var(--wb-surface)] border border-[var(--wb-border)]">
              {project.imageUrl ? (
                <img src={project.imageUrl} alt={project.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-12 h-12 text-[var(--wb-text-muted)]/30" /></div>
              )}
              {block.variant === "hover-reveal" && (
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white p-4">
                  <h3 className="text-lg font-bold">{project.title}</h3>
                  {project.description && <p className="text-sm mt-1 opacity-80">{project.description}</p>}
                  {project.link && <ExternalLink className="w-5 h-5 mt-3" />}
                </div>
              )}
            </div>
            {block.variant !== "hover-reveal" && (
              <div className="mt-3">
                <h3 className="font-semibold group-hover:text-[var(--wb-primary)] transition-colors">{project.title}</h3>
                {project.description && <p className="text-sm text-[var(--wb-text-muted)] mt-1">{project.description}</p>}
                {project.tags && project.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {project.tags.map((tag, j) => <span key={j} className="text-xs px-2 py-0.5 rounded-full bg-[var(--wb-surface)] text-[var(--wb-text-muted)]">{tag}</span>)}
                  </div>
                )}
              </div>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
