import { getTemplateById, type StoreTemplateConfig } from "@/lib/constants/store-templates";

export interface ResolvedTheme {
  template: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
  layout: {
    productGrid: string;
    headerStyle: string;
    heroStyle: string;
    cardStyle: string;
    spacing: string;
  };
}

/**
 * Resolve a store's theme by merging template defaults with user overrides.
 * Falls back to "minimal" template defaults if no template specified.
 */
export function resolveTheme(themeJson: string | null | undefined): ResolvedTheme {
  const defaults: ResolvedTheme = {
    template: "minimal",
    colors: { primary: "#111827", secondary: "#6b7280", accent: "#111827", background: "#ffffff", text: "#111827" },
    fonts: { heading: "Inter", body: "Inter" },
    layout: { productGrid: "4", headerStyle: "minimal", heroStyle: "banner", cardStyle: "minimal", spacing: "spacious" },
  };

  if (!themeJson) return defaults;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(themeJson);
  } catch {
    return defaults;
  }

  // Get template defaults if a template is selected
  const templateId = (parsed.template as string) || "minimal";
  const template = getTemplateById(templateId);

  const base = template
    ? {
        template: template.id,
        colors: { ...template.colors },
        fonts: { ...template.fonts },
        layout: { ...template.layout },
      }
    : defaults;

  // Merge user overrides on top of template defaults
  return {
    template: templateId,
    colors: {
      ...base.colors,
      ...(parsed.colors && typeof parsed.colors === "object" ? (parsed.colors as Record<string, string>) : {}),
    },
    fonts: {
      ...base.fonts,
      ...(parsed.fonts && typeof parsed.fonts === "object" ? (parsed.fonts as Record<string, string>) : {}),
    },
    layout: {
      ...base.layout,
      ...(parsed.layout && typeof parsed.layout === "object" ? (parsed.layout as Record<string, string>) : {}),
    },
  };
}

/**
 * Generate Google Fonts URL for the resolved theme fonts.
 */
export function getGoogleFontsUrl(theme: ResolvedTheme): string {
  const fonts = new Set<string>();
  if (theme.fonts.heading) fonts.add(theme.fonts.heading);
  if (theme.fonts.body && theme.fonts.body !== theme.fonts.heading) fonts.add(theme.fonts.body);

  if (fonts.size === 0) return "";

  const families = Array.from(fonts)
    .map((f) => `family=${f.replace(/ /g, "+")}:wght@400;500;600;700`)
    .join("&");

  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

/**
 * Get CSS variable style object for a theme.
 */
export function getThemeCSSVars(theme: ResolvedTheme): Record<string, string> {
  return {
    "--store-primary": theme.colors.primary,
    "--store-secondary": theme.colors.secondary,
    "--store-accent": theme.colors.accent,
    "--store-background": theme.colors.background,
    "--store-text": theme.colors.text,
    "--store-font-heading": theme.fonts.heading,
    "--store-font-body": theme.fonts.body,
  };
}
