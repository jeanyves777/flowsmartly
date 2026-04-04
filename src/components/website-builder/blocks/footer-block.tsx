"use client";

import type { WebsiteBlock, WebsiteTheme, FooterContent } from "@/types/website-builder";

interface Props { block: WebsiteBlock; theme: WebsiteTheme; isEditing?: boolean; }

const SOCIAL_ICONS: Record<string, string> = {
  twitter: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
  instagram: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z",
  linkedin: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  facebook: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
  youtube: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z",
};

export function FooterBlock({ block, isEditing }: Props) {
  const content = block.content as FooterContent;

  if (block.variant === "simple") {
    return (
      <footer className="w-full py-8 border-t border-[var(--wb-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm text-[var(--wb-text-muted)]">{content.copyright}</span>
          <div className="flex items-center gap-4">
            {content.socials?.map((s, i) => (
              <a key={i} href={isEditing ? undefined : s.url} className="text-[var(--wb-text-muted)] hover:text-[var(--wb-text)] transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d={SOCIAL_ICONS[s.platform] || ""} /></svg>
              </a>
            ))}
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="w-full py-12 sm:py-16 border-t border-[var(--wb-border)] bg-[var(--wb-surface)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-1">
            {content.logo ? (
              <img src={content.logo} alt={content.logoText || ""} className="h-8 mb-4" />
            ) : content.logoText ? (
              <span className="text-xl font-bold block mb-4">{content.logoText}</span>
            ) : null}
            {content.description && <p className="text-sm text-[var(--wb-text-muted)]">{content.description}</p>}
            {content.socials && content.socials.length > 0 && (
              <div className="flex items-center gap-3 mt-4">
                {content.socials.map((s, i) => (
                  <a key={i} href={isEditing ? undefined : s.url} className="text-[var(--wb-text-muted)] hover:text-[var(--wb-text)] transition-colors">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d={SOCIAL_ICONS[s.platform] || ""} /></svg>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Link Columns */}
          {content.columns.map((col, i) => (
            <div key={i}>
              <h4 className="font-semibold mb-4 text-sm">{col.title}</h4>
              <ul className="space-y-2">
                {col.links.map((link, j) => (
                  <li key={j}>
                    <a href={isEditing ? undefined : link.href} className="text-sm text-[var(--wb-text-muted)] hover:text-[var(--wb-text)] transition-colors">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {content.copyright && (
          <div className="pt-8 border-t border-[var(--wb-border)]">
            <p className="text-sm text-[var(--wb-text-muted)] text-center">{content.copyright}</p>
          </div>
        )}
      </div>
    </footer>
  );
}
