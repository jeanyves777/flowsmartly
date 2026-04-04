"use client";

import type { WebsiteBlock, WebsiteTheme, SpacerContent } from "@/types/website-builder";

interface Props { block: WebsiteBlock; theme: WebsiteTheme; isEditing?: boolean; }

export function SpacerBlock({ block, isEditing }: Props) {
  const content = block.content as SpacerContent;
  return (
    <div
      style={{ height: content.height }}
      className={`${isEditing ? "border border-dashed border-[var(--wb-border)] bg-[var(--wb-surface)]/30 flex items-center justify-center" : ""}`}
    >
      {isEditing && <span className="text-xs text-[var(--wb-text-muted)]">{content.height}px</span>}
    </div>
  );
}
