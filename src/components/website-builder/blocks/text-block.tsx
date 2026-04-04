"use client";

import type { WebsiteBlock, WebsiteTheme, TextContent } from "@/types/website-builder";

interface Props { block: WebsiteBlock; theme: WebsiteTheme; isEditing?: boolean; }

export function TextBlock({ block }: Props) {
  const content = block.content as TextContent;
  const align = content.alignment || "left";
  const level = content.headingLevel || "h2";

  return (
    <div className={`py-12 sm:py-16 text-${align}`}>
      {content.heading && (
        level === "h1" ? <h1 className={`text-3xl sm:text-4xl font-bold mb-6 ${align === "center" ? "mx-auto" : ""}`}>{content.heading}</h1> :
        level === "h3" ? <h3 className={`text-3xl sm:text-4xl font-bold mb-6 ${align === "center" ? "mx-auto" : ""}`}>{content.heading}</h3> :
        level === "h4" ? <h4 className={`text-3xl sm:text-4xl font-bold mb-6 ${align === "center" ? "mx-auto" : ""}`}>{content.heading}</h4> :
        <h2 className={`text-3xl sm:text-4xl font-bold mb-6 ${align === "center" ? "mx-auto" : ""}`}>{content.heading}</h2>
      )}
      <div className={`${content.columns === 2 ? "columns-1 sm:columns-2 gap-8" : "max-w-3xl"} ${align === "center" ? "mx-auto" : ""}`}>
        {content.body.split("\n\n").map((para, i) => (
          <p key={i} className={`text-lg text-[var(--wb-text-muted)] leading-relaxed mb-4 ${content.dropcap && i === 0 ? "first-letter:text-5xl first-letter:font-bold first-letter:float-left first-letter:mr-2 first-letter:text-[var(--wb-primary)]" : ""}`}>
            {para}
          </p>
        ))}
      </div>
    </div>
  );
}
