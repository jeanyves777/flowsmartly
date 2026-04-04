"use client";

import { useState } from "react";
import type { WebsiteBlock, WebsiteTheme, HeaderContent } from "@/types/website-builder";
import { Menu, X } from "lucide-react";

interface Props { block: WebsiteBlock; theme: WebsiteTheme; isEditing?: boolean; }

export function HeaderBlock({ block, isEditing }: Props) {
  const content = block.content as HeaderContent;
  const [mobileOpen, setMobileOpen] = useState(false);
  const isCentered = block.variant === "centered";

  return (
    <header className={`w-full ${content.sticky && !isEditing ? "sticky top-0 z-50" : ""} ${content.transparent ? "bg-transparent" : "bg-[var(--wb-background)] border-b border-[var(--wb-border)]"}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`flex items-center h-16 ${isCentered ? "justify-center" : "justify-between"}`}>
          {/* Logo */}
          <div className={`flex-shrink-0 ${isCentered ? "absolute left-4 sm:left-6 lg:left-8" : ""}`}>
            {content.logo ? (
              <img src={content.logo} alt={content.logoText || ""} className="h-8" />
            ) : (
              <span className="text-xl font-bold">{content.logoText || "Brand"}</span>
            )}
          </div>

          {/* Desktop Nav */}
          <nav className={`hidden md:flex items-center gap-6 ${isCentered ? "" : "ml-8"}`}>
            {content.items.map((item, i) => (
              <a key={i} href={isEditing ? undefined : item.href} className="text-sm font-medium text-[var(--wb-text-muted)] hover:text-[var(--wb-text)] transition-colors">
                {item.label}
              </a>
            ))}
          </nav>

          {/* CTA + Mobile Toggle */}
          <div className={`flex items-center gap-4 ${isCentered ? "absolute right-4 sm:right-6 lg:right-8" : ""}`}>
            {content.cta && (
              <a href={isEditing ? undefined : content.cta.href} className="hidden sm:inline-flex px-4 py-2 bg-[var(--wb-primary)] text-white text-sm font-medium rounded-[var(--wb-button-radius)] hover:opacity-90 transition-all">
                {content.cta.text}
              </a>
            )}
            <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2">
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <div className="md:hidden py-4 border-t border-[var(--wb-border)]">
            {content.items.map((item, i) => (
              <a key={i} href={isEditing ? undefined : item.href} className="block py-2 text-sm font-medium text-[var(--wb-text-muted)] hover:text-[var(--wb-text)]">
                {item.label}
              </a>
            ))}
            {content.cta && (
              <a href={isEditing ? undefined : content.cta.href} className="mt-2 block w-full text-center py-2 bg-[var(--wb-primary)] text-white text-sm font-medium rounded-[var(--wb-button-radius)]">
                {content.cta.text}
              </a>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
