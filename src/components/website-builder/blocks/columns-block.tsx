"use client";

import type { WebsiteBlock, WebsiteTheme, ColumnsContent } from "@/types/website-builder";
import { BlockRenderer } from "./block-renderer";

interface Props { block: WebsiteBlock; theme: WebsiteTheme; isEditing?: boolean; siteSlug?: string; }

export function ColumnsBlock({ block, theme, isEditing, siteSlug }: Props) {
  const content = block.content as ColumnsContent;
  const gap = content.gap || 24;

  const getWidths = () => {
    switch (content.layout) {
      case "sidebar-left": return ["33.33%", "66.67%"];
      case "sidebar-right": return ["66.67%", "33.33%"];
      default: return content.columns.map((c) => c.width || `${100 / content.columns.length}%`);
    }
  };

  const widths = getWidths();

  return (
    <div className="py-8">
      <div className="flex flex-col md:flex-row" style={{ gap }}>
        {content.columns.map((col, i) => (
          <div key={i} className="min-w-0" style={{ width: widths[i] || "auto", flex: `0 0 ${widths[i] || "auto"}` }}>
            {col.blocks.length > 0 ? (
              col.blocks.map((childBlock) => (
                <BlockRenderer key={childBlock.id} block={childBlock} theme={theme} isEditing={isEditing} siteSlug={siteSlug} />
              ))
            ) : isEditing ? (
              <div className="min-h-[100px] border-2 border-dashed border-[var(--wb-border)] rounded-lg flex items-center justify-center text-sm text-[var(--wb-text-muted)]">
                Drop blocks here
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
