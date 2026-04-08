/**
 * Base template files for generated stores.
 * Identical for every generated store — agent writes the rest.
 */

export const TEMPLATE_STORE_PACKAGE_JSON = `{
  "name": "generated-store",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "15.3.1",
    "react": "19.1.0",
    "react-dom": "19.1.0",
    "framer-motion": "12.6.3",
    "lucide-react": "0.475.0",
    "zustand": "5.0.3",
    "tailwindcss": "4.1.3",
    "@tailwindcss/postcss": "4.1.3",
    "@types/node": "22.14.1",
    "@types/react": "19.1.0",
    "@types/react-dom": "19.1.0",
    "typescript": "5.8.3"
  }
}`;

export const TEMPLATE_STORE_TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}`;

export const TEMPLATE_STORE_POSTCSS_CONFIG = `/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
`;

/**
 * Analytics script with ecommerce event tracking.
 * Tracks: pageview, view_item, add_to_cart, begin_checkout
 */
export function getStoreTrackingScript(storeId: string, apiBaseUrl: string): string {
  return `"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function Analytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const consent = localStorage.getItem("cookie-consent");
    if (consent === "declined") return;

    const data = {
      type: "pageview",
      storeId: "${storeId}",
      path: pathname || window.location.pathname,
      title: document.title,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      language: navigator.language,
      url: window.location.href,
    };

    fetch("${apiBaseUrl}/api/analytics/collect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      mode: "cors",
    }).catch(() => {});
  }, [pathname]);

  return null;
}

// Ecommerce event helpers — call these from product/cart components
export function trackEvent(eventType: string, data: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const consent = localStorage.getItem("cookie-consent");
  if (consent === "declined") return;

  fetch("${apiBaseUrl}/api/analytics/collect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: eventType,
      storeId: "${storeId}",
      ...data,
      url: window.location.href,
    }),
    mode: "cors",
  }).catch(() => {});
}
`;
}

export const TEMPLATE_STORE_COOKIE_CONSENT = `"use client";

import { useState, useEffect } from "react";

export default function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie-consent");
    if (!consent) setShow(true);
  }, []);

  const accept = () => {
    localStorage.setItem("cookie-consent", "accepted");
    setShow(false);
  };

  const decline = () => {
    localStorage.setItem("cookie-consent", "declined");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-lg">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          We use cookies to improve your experience. By continuing, you agree to our{" "}
          <a href="privacy-policy" className="underline hover:text-gray-900 dark:hover:text-white">Privacy Policy</a>.
        </p>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={decline} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            Decline
          </button>
          <button onClick={accept} className="px-4 py-2 text-sm bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:opacity-90">
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
`;

// Reuse ThemeProvider and ThemeToggle from website templates
export { TEMPLATE_THEME_PROVIDER, TEMPLATE_THEME_TOGGLE } from "../../website/templates";
