"use client";

import type { WebsiteBlock, WebsiteTheme, ImageContent } from "@/types/website-builder";
import { ImageIcon } from "lucide-react";

interface Props { block: WebsiteBlock; theme: WebsiteTheme; isEditing?: boolean; }

export function ImageBlock({ block, isEditing }: Props) {
  const content = block.content as ImageContent;
  const aspectMap: Record<string, string> = {
    "1:1": "aspect-square",
    "16:9": "aspect-video",
    "4:3": "aspect-[4/3]",
    "3:2": "aspect-[3/2]",
    "21:9": "aspect-[21/9]",
    auto: "",
  };
  const aspectClass = aspectMap[content.aspectRatio || "auto"] || "";
  const isContained = block.variant === "contained";
  const isParallax = block.variant === "parallax";

  const imgElement = content.imageUrl ? (
    <img
      src={content.imageUrl}
      alt={content.alt || ""}
      className={`w-full ${aspectClass ? `${aspectClass} object-${content.objectFit || "cover"}` : ""} ${content.rounded ? "rounded-xl" : ""} ${content.shadow ? "shadow-xl" : ""}`}
    />
  ) : (
    <div className={`w-full ${aspectClass || "aspect-video"} bg-[var(--wb-surface)] border border-dashed border-[var(--wb-border)] ${content.rounded ? "rounded-xl" : ""} flex items-center justify-center`}>
      <ImageIcon className="w-16 h-16 text-[var(--wb-text-muted)]/20" />
    </div>
  );

  const linked = content.link && !isEditing ? (
    <a href={content.link} className="block">{imgElement}</a>
  ) : imgElement;

  return (
    <div className={`py-8 ${isContained ? "max-w-4xl mx-auto" : ""}`}>
      {isParallax && content.imageUrl ? (
        <div
          className={`${aspectClass || "h-[400px]"} bg-fixed bg-cover bg-center ${content.rounded ? "rounded-xl" : ""}`}
          style={{ backgroundImage: `url(${content.imageUrl})` }}
        />
      ) : (
        linked
      )}
      {content.caption && (
        <p className="text-sm text-[var(--wb-text-muted)] text-center mt-3 italic">{content.caption}</p>
      )}
    </div>
  );
}
