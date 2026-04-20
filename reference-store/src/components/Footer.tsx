"use client";

import Link from "next/link";
import { Instagram, Facebook, Twitter } from "lucide-react";
import { storeInfo, footerLinks } from "@/lib/data";

function hideOnError(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  img.style.display = "none";
  const fallback = img.nextElementSibling as HTMLElement | null;
  if (fallback) fallback.style.display = "block";
}

/**
 * Internal-link normalizer: footerLinks come from data.ts where the agent
 * may have written either bare "/about" or "/stores/{slug}/about". If the
 * value already includes a scheme we treat it as external; otherwise we
 * strip any "/stores/{slug}" prefix so Next.js <Link> can re-apply basePath.
 */
function normalizeFooterHref(href: string): { href: string; external: boolean } {
  if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return { href, external: true };
  }
  const stripped = href.replace(/^\/stores\/[^/]+/, "");
  return { href: stripped || "/", external: false };
}

function FooterLink({ href, label }: { href: string; label: string }) {
  const { href: resolved, external } = normalizeFooterHref(href);
  const className = "text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors";
  return external ? (
    <a href={resolved} className={className} target="_blank" rel="noopener noreferrer">{label}</a>
  ) : (
    <Link href={resolved} className={className}>{label}</Link>
  );
}

export default function Footer() {
  const currentYear = new Date().getFullYear();
  // Defensive filter — data.ts can ship malformed entries (bare commas that
  // parse as undefined, missing href, etc.). Guard so the build never crashes
  // on a single bad link.
  const safeLinks = (Array.isArray(footerLinks) ? footerLinks : []).filter(
    (l): l is { href: string; label: string } => !!l && typeof l.href === "string"
  );
  const navLinksList = safeLinks.filter(
    (l) => !l.href.includes("policy") && !l.href.includes("terms")
  );
  const legalLinks = safeLinks.filter(
    (l) => l.href.includes("policy") || l.href.includes("terms")
  );

  return (
    <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
      {/* ─── Mobile footer — compact single-column ─── */}
      <div className="md:hidden max-w-7xl mx-auto px-4 py-10 pb-24">
        <Link href="/" className="inline-block mb-4">
          {storeInfo.logoUrl ? (
            <img
              src={storeInfo.logoUrl}
              alt={`${storeInfo.name} logo`}
              className="h-12 max-w-[160px] object-contain"
              onError={hideOnError}
            />
          ) : null}
          <span className={`text-lg font-bold text-gray-900 dark:text-white ${storeInfo.logoUrl ? "hidden" : ""}`}>
            {storeInfo.name}
          </span>
        </Link>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5 leading-relaxed">
          {storeInfo.tagline}
        </p>
        <div className="flex gap-3 mb-6">
          {storeInfo.socialLinks.instagram && (
            <a href={storeInfo.socialLinks.instagram} target="_blank" rel="noopener noreferrer"
              className="p-2 text-gray-400 hover:text-primary-600 transition-colors" aria-label="Instagram">
              <Instagram size={18} />
            </a>
          )}
          {storeInfo.socialLinks.facebook && (
            <a href={storeInfo.socialLinks.facebook} target="_blank" rel="noopener noreferrer"
              className="p-2 text-gray-400 hover:text-primary-600 transition-colors" aria-label="Facebook">
              <Facebook size={18} />
            </a>
          )}
          {storeInfo.socialLinks.twitter && (
            <a href={storeInfo.socialLinks.twitter} target="_blank" rel="noopener noreferrer"
              className="p-2 text-gray-400 hover:text-primary-600 transition-colors" aria-label="Twitter">
              <Twitter size={18} />
            </a>
          )}
        </div>

        {/* Link groups as inline chips */}
        <div className="flex flex-wrap gap-x-4 gap-y-2 mb-5">
          {navLinksList.map((link) => (
            <FooterLink key={link.href} href={link.href} label={link.label} />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 mb-6 text-xs">
          {legalLinks.map((link) => (
            <FooterLink key={link.href} href={link.href} label={link.label} />
          ))}
        </div>

        {/* Contact — compact */}
        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 mb-4">
          {storeInfo.emails[0] && <div><a href={`mailto:${storeInfo.emails[0]}`} className="hover:text-primary-600">{storeInfo.emails[0]}</a></div>}
          {storeInfo.phones[0] && <div><a href={`tel:${storeInfo.phones[0]}`} className="hover:text-primary-600">{storeInfo.phones[0]}</a></div>}
        </div>

        <div className="pt-4 border-t border-gray-200 dark:border-gray-800 flex flex-col gap-1">
          <p className="text-[11px] text-gray-400">&copy; {currentYear} {storeInfo.name}</p>
          <p className="text-[11px] text-gray-400">Powered by <a href="https://flowsmartly.com" className="hover:text-primary-600">FlowSmartly</a></p>
        </div>
      </div>

      {/* ─── Desktop footer — full 4-column grid ─── */}
      <div className="hidden md:block max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-4 gap-10">
          {/* Brand */}
          <div>
            <Link href="/" className="inline-block mb-4">
              {storeInfo.logoUrl ? (
                <img
                  src={storeInfo.logoUrl}
                  alt={`${storeInfo.name} logo`}
                  className="h-20 max-w-[200px] object-contain"
                  onError={hideOnError}
                />
              ) : null}
              <span className={`text-xl font-bold text-gray-900 dark:text-white ${storeInfo.logoUrl ? "hidden" : ""}`}>
                {storeInfo.name}
              </span>
            </Link>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">
              {storeInfo.tagline}
            </p>
            <div className="flex gap-3">
              {storeInfo.socialLinks.instagram && (
                <a href={storeInfo.socialLinks.instagram} target="_blank" rel="noopener noreferrer"
                  className="p-2 text-gray-400 hover:text-primary-600 transition-colors" aria-label="Instagram">
                  <Instagram size={18} />
                </a>
              )}
              {storeInfo.socialLinks.facebook && (
                <a href={storeInfo.socialLinks.facebook} target="_blank" rel="noopener noreferrer"
                  className="p-2 text-gray-400 hover:text-primary-600 transition-colors" aria-label="Facebook">
                  <Facebook size={18} />
                </a>
              )}
              {storeInfo.socialLinks.twitter && (
                <a href={storeInfo.socialLinks.twitter} target="_blank" rel="noopener noreferrer"
                  className="p-2 text-gray-400 hover:text-primary-600 transition-colors" aria-label="Twitter">
                  <Twitter size={18} />
                </a>
              )}
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Quick Links</h3>
            <ul className="space-y-3">
              {navLinksList.map((link) => (
                <li key={link.href}>
                  <FooterLink href={link.href} label={link.label} />
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Legal</h3>
            <ul className="space-y-3">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <FooterLink href={link.href} label={link.label} />
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Contact</h3>
            <ul className="space-y-3 text-sm text-gray-500 dark:text-gray-400">
              {storeInfo.emails.map((email) => (
                <li key={email}>
                  <a href={`mailto:${email}`} className="hover:text-primary-600 transition-colors">{email}</a>
                </li>
              ))}
              {storeInfo.phones.map((phone) => (
                <li key={phone}>
                  <a href={`tel:${phone}`} className="hover:text-primary-600 transition-colors">{phone}</a>
                </li>
              ))}
              <li>{storeInfo.address}</li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between gap-4">
          <p className="text-xs text-gray-400">
            &copy; {currentYear} {storeInfo.name}. All rights reserved.
          </p>
          <p className="text-xs text-gray-400">
            Powered by <a href="https://flowsmartly.com" className="hover:text-primary-600 transition-colors">FlowSmartly</a>
          </p>
        </div>
      </div>
    </footer>
  );
}
