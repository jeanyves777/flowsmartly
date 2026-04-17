"use client";

import { Instagram, Facebook, Twitter } from "lucide-react";
import { storeInfo, footerLinks, storeUrl } from "@/lib/data";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  // Split links: nav links vs legal links (NEVER use .slice() — render ALL links)
  const navLinksList = footerLinks.filter(
    l => !l.href.includes("policy") && !l.href.includes("terms")
  );
  const legalLinks = footerLinks.filter(
    l => l.href.includes("policy") || l.href.includes("terms")
  );

  return (
    <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-1">
            <a href={storeUrl("/")} className="inline-block mb-4">
              {storeInfo.logoUrl ? (
                <img
                  src={storeInfo.logoUrl}
                  alt={`${storeInfo.name} logo`}
                  className="h-20 max-w-[200px] object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).nextElementSibling && ((e.target as HTMLImageElement).nextElementSibling as HTMLElement).style.display = "block"; }}
                />
              ) : null}
              <span className={`text-xl font-bold text-gray-900 dark:text-white ${storeInfo.logoUrl ? "hidden" : ""}`}>
                {storeInfo.name}
              </span>
            </a>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">
              {storeInfo.tagline}
            </p>

            {/* Social links */}
            <div className="flex gap-3">
              {storeInfo.socialLinks.instagram && (
                <a
                  href={storeInfo.socialLinks.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-gray-400 hover:text-primary-600 transition-colors"
                  aria-label="Instagram"
                >
                  <Instagram size={18} />
                </a>
              )}
              {storeInfo.socialLinks.facebook && (
                <a
                  href={storeInfo.socialLinks.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-gray-400 hover:text-primary-600 transition-colors"
                  aria-label="Facebook"
                >
                  <Facebook size={18} />
                </a>
              )}
              {storeInfo.socialLinks.twitter && (
                <a
                  href={storeInfo.socialLinks.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-gray-400 hover:text-primary-600 transition-colors"
                  aria-label="Twitter"
                >
                  <Twitter size={18} />
                </a>
              )}
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Quick Links</h3>
            <ul className="space-y-3">
              {navLinksList.map(link => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Legal</h3>
            <ul className="space-y-3">
              {legalLinks.map(link => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Contact</h3>
            <ul className="space-y-3 text-sm text-gray-500 dark:text-gray-400">
              {storeInfo.emails.map(email => (
                <li key={email}>
                  <a href={`mailto:${email}`} className="hover:text-primary-600 transition-colors">
                    {email}
                  </a>
                </li>
              ))}
              {storeInfo.phones.map(phone => (
                <li key={phone}>
                  <a href={`tel:${phone}`} className="hover:text-primary-600 transition-colors">
                    {phone}
                  </a>
                </li>
              ))}
              <li>{storeInfo.address}</li>
            </ul>
          </div>
        </div>

        {/* Newsletter */}
        <div className="mt-10 pt-8 border-t border-gray-200 dark:border-gray-800">
          <div className="max-w-md mx-auto text-center sm:text-left sm:mx-0">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Stay in the loop</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Get updates on new products and exclusive offers.</p>
            <form className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 px-4 py-2.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                type="submit"
                className="px-5 py-2.5 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors shrink-0"
              >
                Subscribe
              </button>
            </form>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
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
