"use client";

import { useState } from "react";
import type { WebsiteBlock, WebsiteTheme, FAQContent } from "@/types/website-builder";
import { ChevronDown } from "lucide-react";

interface Props { block: WebsiteBlock; theme: WebsiteTheme; isEditing?: boolean; }

export function FAQBlock({ block }: Props) {
  const content = block.content as FAQContent;
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  if (content.layout === "two-column") {
    const mid = Math.ceil(content.items.length / 2);
    return (
      <div className="py-16 sm:py-24">
        {content.headline && <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">{content.headline}</h2>}
        {content.subheadline && <p className="text-lg text-[var(--wb-text-muted)] text-center mb-12 max-w-2xl mx-auto">{content.subheadline}</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {[content.items.slice(0, mid), content.items.slice(mid)].map((col, ci) => (
            <div key={ci} className="space-y-6">
              {col.map((item, i) => (
                <div key={i}>
                  <h3 className="font-semibold mb-2">{item.question}</h3>
                  <p className="text-[var(--wb-text-muted)] text-sm">{item.answer}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (content.layout === "simple") {
    return (
      <div className="py-16 sm:py-24 max-w-3xl mx-auto">
        {content.headline && <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">{content.headline}</h2>}
        {content.subheadline && <p className="text-lg text-[var(--wb-text-muted)] text-center mb-12 max-w-2xl mx-auto">{content.subheadline}</p>}
        <div className="space-y-8">
          {content.items.map((item, i) => (
            <div key={i}>
              <h3 className="text-lg font-semibold mb-2">{item.question}</h3>
              <p className="text-[var(--wb-text-muted)]">{item.answer}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Accordion (default)
  return (
    <div className="py-16 sm:py-24 max-w-3xl mx-auto">
      {content.headline && <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">{content.headline}</h2>}
      {content.subheadline && <p className="text-lg text-[var(--wb-text-muted)] text-center mb-12 max-w-2xl mx-auto">{content.subheadline}</p>}
      <div className="divide-y divide-[var(--wb-border)]">
        {content.items.map((item, i) => {
          const isOpen = openIndex === i;
          return (
            <div key={i} className="py-4">
              <button
                onClick={() => setOpenIndex(isOpen ? null : i)}
                className="flex items-center justify-between w-full text-left"
              >
                <span className="text-lg font-medium pr-4">{item.question}</span>
                <ChevronDown className={`w-5 h-5 text-[var(--wb-text-muted)] flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              <div className={`overflow-hidden transition-all duration-300 ${isOpen ? "max-h-96 mt-3" : "max-h-0"}`}>
                <p className="text-[var(--wb-text-muted)] leading-relaxed">{item.answer}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
