"use client";

import { useEffect } from "react";

/**
 * Listens for postMessage from the design editor and applies
 * real-time theme updates via CSS variables.
 * Only rendered in preview mode (?preview=true).
 */
export function PreviewListener() {
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type !== "flowshop-preview-update") return;

      const root = document.documentElement;

      // Instant color updates via CSS vars
      if (event.data.colors) {
        const colorMap: Record<string, string> = {
          primary: "--store-primary",
          secondary: "--store-secondary",
          accent: "--store-accent",
          background: "--store-background",
          text: "--store-text",
        };

        for (const [key, value] of Object.entries(event.data.colors)) {
          const cssVar = colorMap[key];
          if (cssVar && typeof value === "string") {
            root.style.setProperty(cssVar, value);
          }
        }

        // Also update inline color references on the body
        if (event.data.colors.background) {
          document.body.style.backgroundColor = event.data.colors.background as string;
        }
        if (event.data.colors.text) {
          document.body.style.color = event.data.colors.text as string;
        }
      }

      // Instant font updates
      if (event.data.fonts) {
        if (event.data.fonts.heading) {
          root.style.setProperty("--store-font-heading", event.data.fonts.heading);
          // Load the font dynamically
          loadGoogleFont(event.data.fonts.heading);
        }
        if (event.data.fonts.body) {
          root.style.setProperty("--store-font-body", event.data.fonts.body);
          document.body.style.fontFamily = `${event.data.fonts.body}, sans-serif`;
          loadGoogleFont(event.data.fonts.body);
        }
      }

      // Layout/structural changes require reload
      if (event.data.requiresReload) {
        window.location.reload();
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}

/** Dynamically load a Google Font */
function loadGoogleFont(fontName: string) {
  const id = `gfont-${fontName.replace(/\s+/g, "-").toLowerCase()}`;
  if (document.getElementById(id)) return;

  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(
    / /g,
    "+"
  )}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);
}
