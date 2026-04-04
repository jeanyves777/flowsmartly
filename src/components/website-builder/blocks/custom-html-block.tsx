"use client";

import type { WebsiteBlock, WebsiteTheme, CustomHtmlContent } from "@/types/website-builder";

interface Props { block: WebsiteBlock; theme: WebsiteTheme; isEditing?: boolean; }

export function CustomHtmlBlock({ block }: Props) {
  const content = block.content as CustomHtmlContent;
  return (
    <div className="py-4">
      {content.css && <style dangerouslySetInnerHTML={{ __html: content.css }} />}
      <div dangerouslySetInnerHTML={{ __html: content.html }} />
    </div>
  );
}
