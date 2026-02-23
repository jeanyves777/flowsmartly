"use client";

import { useState } from "react";
import Link from "next/link";

interface MobileNavProps {
  storeSlug: string;
  textColor?: string;
  bgColor?: string;
}

export function MobileNav({ storeSlug, textColor, bgColor }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg transition-colors hover:opacity-70"
        aria-label="Toggle navigation menu"
        aria-expanded={open}
      >
        {open ? (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 top-full border-b shadow-lg z-50"
          style={{ backgroundColor: bgColor || "#ffffff" }}
        >
          <nav className="flex flex-col px-4 py-3 gap-1">
            <Link
              href={`/store/${storeSlug}`}
              onClick={() => setOpen(false)}
              className="px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:opacity-70"
              style={{ color: textColor }}
            >
              Home
            </Link>
            <Link
              href={`/store/${storeSlug}/products`}
              onClick={() => setOpen(false)}
              className="px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:opacity-70"
              style={{ color: textColor }}
            >
              Products
            </Link>
            <Link
              href={`/store/${storeSlug}/checkout`}
              onClick={() => setOpen(false)}
              className="px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:opacity-70"
              style={{ color: textColor }}
            >
              Cart
            </Link>
          </nav>
        </div>
      )}
    </div>
  );
}
