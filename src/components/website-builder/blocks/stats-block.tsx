"use client";

import type { WebsiteBlock, WebsiteTheme, StatsContent } from "@/types/website-builder";
import * as LucideIcons from "lucide-react";

interface Props { block: WebsiteBlock; theme: WebsiteTheme; isEditing?: boolean; }

export function StatsBlock({ block }: Props) {
  const content = block.content as StatsContent;
  const colClass = content.columns === 2 ? "sm:grid-cols-2" : content.columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4";

  return (
    <div className="py-16 sm:py-24">
      {content.headline && <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">{content.headline}</h2>}
      {content.subheadline && <p className="text-lg text-[var(--wb-text-muted)] text-center mb-12 max-w-2xl mx-auto">{content.subheadline}</p>}
      <div className={`grid grid-cols-2 ${colClass} gap-8`}>
        {content.items.map((item, i) => {
          const Icon = item.icon ? (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[item.icon] : null;
          return (
            <div key={i} className={`text-center ${block.variant === "cards" ? "p-6 rounded-xl bg-[var(--wb-surface)] border border-[var(--wb-border)]" : ""}`}>
              {Icon && <Icon className="w-8 h-8 text-[var(--wb-primary)] mx-auto mb-3" />}
              <div className="text-3xl sm:text-4xl font-bold text-[var(--wb-primary)]">
                {item.prefix}{item.value}{item.suffix}
              </div>
              <p className="text-sm text-[var(--wb-text-muted)] mt-1 font-medium">{item.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
