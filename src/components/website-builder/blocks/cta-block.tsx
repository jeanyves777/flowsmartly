"use client";

import type { WebsiteBlock, WebsiteTheme, CTAContent } from "@/types/website-builder";

interface Props { block: WebsiteBlock; theme: WebsiteTheme; isEditing?: boolean; }

export function CTABlock({ block, isEditing }: Props) {
  const content = block.content as CTAContent;
  const isSplit = block.variant === "split";

  const bgClass = content.bgStyle === "gradient"
    ? "bg-gradient-to-r from-[var(--wb-primary)] to-[var(--wb-secondary)] text-white"
    : content.bgStyle === "image"
      ? "bg-[var(--wb-surface)]"
      : "bg-[var(--wb-primary)] text-white";

  return (
    <div className={`py-16 sm:py-20 px-8 rounded-2xl ${bgClass}`}>
      <div className={`${isSplit ? "flex flex-col md:flex-row items-center justify-between gap-8" : "text-center max-w-3xl mx-auto"}`}>
        <div className={isSplit ? "flex-1" : ""}>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">{content.headline}</h2>
          {content.description && <p className="text-lg opacity-90">{content.description}</p>}
        </div>
        <div className={`flex flex-wrap gap-4 ${isSplit ? "" : "justify-center mt-8"}`}>
          {content.primaryCta && (
            <a
              href={isEditing ? undefined : content.primaryCta.href}
              className={`px-8 py-3 rounded-[var(--wb-button-radius)] font-medium transition-all ${
                content.bgStyle === "gradient" || content.bgStyle === "solid"
                  ? "bg-white text-[var(--wb-primary)] hover:bg-white/90"
                  : "bg-[var(--wb-primary)] text-white hover:opacity-90"
              }`}
            >
              {content.primaryCta.text}
            </a>
          )}
          {content.secondaryCta && (
            <a
              href={isEditing ? undefined : content.secondaryCta.href}
              className="px-8 py-3 rounded-[var(--wb-button-radius)] font-medium border-2 border-current hover:opacity-80 transition-all"
            >
              {content.secondaryCta.text}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
