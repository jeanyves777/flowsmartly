"use client";

import type { WebsiteBlock, WebsiteTheme, FeaturesContent } from "@/types/website-builder";
import * as LucideIcons from "lucide-react";

interface Props { block: WebsiteBlock; theme: WebsiteTheme; isEditing?: boolean; }

function DynamicIcon({ name, className }: { name?: string; className?: string }) {
  if (!name) return null;
  const Icon = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name];
  if (!Icon) return null;
  return <Icon className={className} />;
}

export function FeaturesBlock({ block, theme }: Props) {
  const content = block.content as FeaturesContent;
  const colClass = content.columns === 2 ? "sm:grid-cols-2" : content.columns === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3";

  if (content.layout === "alternating") {
    return (
      <div className="py-16 sm:py-24">
        {content.headline && <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">{content.headline}</h2>}
        {content.subheadline && <p className="text-lg text-[var(--wb-text-muted)] text-center mb-16 max-w-2xl mx-auto">{content.subheadline}</p>}
        <div className="space-y-20">
          {content.items.map((item, i) => (
            <div key={i} className={`flex flex-col lg:flex-row gap-12 items-center ${i % 2 === 1 ? "lg:flex-row-reverse" : ""}`}>
              {item.imageUrl ? (
                <div className="flex-1"><img src={item.imageUrl} alt={item.title} className="rounded-xl shadow-lg w-full" /></div>
              ) : (
                <div className="flex-1 flex items-center justify-center p-12 bg-[var(--wb-surface)] rounded-xl">
                  <DynamicIcon name={item.icon} className="w-24 h-24 text-[var(--wb-primary)]" />
                </div>
              )}
              <div className="flex-1 space-y-4">
                <h3 className="text-2xl font-bold">{item.title}</h3>
                <p className="text-lg text-[var(--wb-text-muted)]">{item.description}</p>
                {item.link && <a href={item.link.href} className="text-[var(--wb-primary)] font-medium hover:underline">{item.link.text} &rarr;</a>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="py-16 sm:py-24">
      {content.headline && <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">{content.headline}</h2>}
      {content.subheadline && <p className="text-lg text-[var(--wb-text-muted)] text-center mb-16 max-w-2xl mx-auto">{content.subheadline}</p>}
      <div className={`grid grid-cols-1 ${colClass} gap-8`}>
        {content.items.map((item, i) => (
          <div key={i} className={`p-6 rounded-xl ${block.variant === "cards" ? "bg-[var(--wb-surface)] border border-[var(--wb-border)] shadow-sm hover:shadow-md transition-shadow" : ""}`}>
            {item.imageUrl ? (
              <img src={item.imageUrl} alt={item.title} className="w-full h-48 object-cover rounded-lg mb-4" />
            ) : item.icon ? (
              <div className="w-12 h-12 rounded-lg bg-[var(--wb-primary)]/10 flex items-center justify-center mb-4">
                <DynamicIcon name={item.icon} className="w-6 h-6 text-[var(--wb-primary)]" />
              </div>
            ) : null}
            <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
            <p className="text-[var(--wb-text-muted)]">{item.description}</p>
            {item.link && <a href={item.link.href} className="mt-3 inline-block text-[var(--wb-primary)] font-medium hover:underline">{item.link.text} &rarr;</a>}
          </div>
        ))}
      </div>
    </div>
  );
}
