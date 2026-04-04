"use client";

import type { WebsiteBlock, WebsiteTheme, TeamContent } from "@/types/website-builder";
import { User } from "lucide-react";

interface Props { block: WebsiteBlock; theme: WebsiteTheme; isEditing?: boolean; }

export function TeamBlock({ block }: Props) {
  const content = block.content as TeamContent;
  const colClass = content.columns === 2 ? "sm:grid-cols-2" : content.columns === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3";
  const isCircular = block.variant === "circular";

  return (
    <div className="py-16 sm:py-24">
      {content.headline && <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">{content.headline}</h2>}
      {content.subheadline && <p className="text-lg text-[var(--wb-text-muted)] text-center mb-12 max-w-2xl mx-auto">{content.subheadline}</p>}
      <div className={`grid grid-cols-1 ${colClass} gap-8`}>
        {content.members.map((member, i) => (
          <div key={i} className="text-center group">
            <div className={`mx-auto mb-4 overflow-hidden ${isCircular ? "w-32 h-32 rounded-full" : "w-full aspect-[3/4] rounded-xl"}`}>
              {member.imageUrl ? (
                <img src={member.imageUrl} alt={member.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
              ) : (
                <div className="w-full h-full bg-[var(--wb-surface)] flex items-center justify-center border border-[var(--wb-border)]">
                  <User className="w-12 h-12 text-[var(--wb-text-muted)]/30" />
                </div>
              )}
            </div>
            <h3 className="text-lg font-bold">{member.name}</h3>
            <p className="text-sm text-[var(--wb-primary)] font-medium">{member.role}</p>
            {content.showBio && member.bio && <p className="text-sm text-[var(--wb-text-muted)] mt-2">{member.bio}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
