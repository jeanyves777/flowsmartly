"use client";

import type { WebsiteBlock, WebsiteTheme, DividerContent } from "@/types/website-builder";

interface Props { block: WebsiteBlock; theme: WebsiteTheme; isEditing?: boolean; }

export function DividerBlock({ block }: Props) {
  const content = block.content as DividerContent;
  const color = content.color || "var(--wb-border)";
  const h = content.height || 1;

  if (content.style === "wave") {
    return (
      <div className={`${content.flip ? "rotate-180" : ""}`}>
        <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full" style={{ height: Math.max(h * 20, 40) }}>
          <path d="M0 30C240 0 480 60 720 30C960 0 1200 60 1440 30V60H0V30Z" fill={color} />
        </svg>
      </div>
    );
  }

  if (content.style === "angle") {
    return (
      <div className={`${content.flip ? "rotate-180" : ""}`}>
        <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full" style={{ height: Math.max(h * 20, 40) }}>
          <polygon points="0,60 1440,0 1440,60" fill={color} />
        </svg>
      </div>
    );
  }

  if (content.style === "dots") {
    return (
      <div className="py-6 flex justify-center gap-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        ))}
      </div>
    );
  }

  if (content.style === "zigzag") {
    return (
      <div className="py-4">
        <svg viewBox="0 0 1440 30" className="w-full" style={{ height: Math.max(h * 10, 20) }}>
          <path d={`M0 15 ${Array.from({ length: 48 }, (_, i) => `L${i * 30 + 15} ${i % 2 === 0 ? 0 : 30}`).join(" ")} L1440 15`} stroke={color} strokeWidth="2" fill="none" />
        </svg>
      </div>
    );
  }

  if (content.style === "gradient") {
    return (
      <div className="py-4">
        <div className="h-px bg-gradient-to-r from-transparent via-[var(--wb-border)] to-transparent" style={{ height: h }} />
      </div>
    );
  }

  // Default: line
  return (
    <div className="py-4">
      <hr style={{ borderColor: color, borderTopWidth: h }} className="border-0 border-t" />
    </div>
  );
}
