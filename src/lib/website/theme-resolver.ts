/**
 * Theme Resolver — merges BrandKit + Website theme + block style overrides
 * into CSS custom properties for rendering.
 */

import type { WebsiteTheme, WebsiteThemeColors, WebsiteThemeFonts, BlockStyle } from "@/types/website-builder";

// --- Default Theme ---

export const DEFAULT_THEME: WebsiteTheme = {
  colors: {
    primary: "#3b82f6",
    secondary: "#6366f1",
    accent: "#f59e0b",
    background: "#ffffff",
    surface: "#f8fafc",
    text: "#0f172a",
    textMuted: "#64748b",
    border: "#e2e8f0",
  },
  fonts: {
    heading: "Inter",
    body: "Inter",
    headingWeight: "700",
    bodyWeight: "400",
  },
  borderRadius: 8,
  spacing: "normal",
  maxWidth: "lg",
  headerStyle: "solid",
  footerStyle: "columns",
  buttonStyle: "rounded",
};

// --- Parse BrandKit colors into theme colors ---

interface BrandKitColors {
  primary?: string;
  secondary?: string;
  accent?: string;
}

interface BrandKitFonts {
  heading?: string;
  body?: string;
}

export function brandKitToTheme(brandKit: {
  colors?: string;
  fonts?: string;
  logo?: string | null;
  name?: string | null;
}): Partial<WebsiteTheme> {
  const theme: Partial<WebsiteTheme> = {};

  if (brandKit.colors) {
    try {
      const parsed: BrandKitColors = typeof brandKit.colors === "string" ? JSON.parse(brandKit.colors) : brandKit.colors;
      theme.colors = {
        ...DEFAULT_THEME.colors,
        ...(parsed.primary && { primary: parsed.primary }),
        ...(parsed.secondary && { secondary: parsed.secondary }),
        ...(parsed.accent && { accent: parsed.accent }),
      };
    } catch {}
  }

  if (brandKit.fonts) {
    try {
      const parsed: BrandKitFonts = typeof brandKit.fonts === "string" ? JSON.parse(brandKit.fonts) : brandKit.fonts;
      theme.fonts = {
        ...DEFAULT_THEME.fonts,
        ...(parsed.heading && { heading: parsed.heading }),
        ...(parsed.body && { body: parsed.body }),
      };
    } catch {}
  }

  return theme;
}

// --- Merge themes: base < brandKit < website overrides ---

export function resolveTheme(
  websiteThemeJson?: string,
  brandKit?: { colors?: string; fonts?: string; logo?: string | null; name?: string | null } | null
): WebsiteTheme {
  let theme = { ...DEFAULT_THEME, colors: { ...DEFAULT_THEME.colors }, fonts: { ...DEFAULT_THEME.fonts } };

  // Layer 1: BrandKit overrides
  if (brandKit) {
    const bkTheme = brandKitToTheme(brandKit);
    if (bkTheme.colors) theme.colors = { ...theme.colors, ...bkTheme.colors };
    if (bkTheme.fonts) theme.fonts = { ...theme.fonts, ...bkTheme.fonts };
  }

  // Layer 2: Website-level overrides
  if (websiteThemeJson) {
    try {
      const parsed = typeof websiteThemeJson === "string" ? JSON.parse(websiteThemeJson) : websiteThemeJson;
      if (parsed.colors) theme.colors = { ...theme.colors, ...parsed.colors };
      if (parsed.fonts) theme.fonts = { ...theme.fonts, ...parsed.fonts };
      if (parsed.borderRadius !== undefined) theme.borderRadius = parsed.borderRadius;
      if (parsed.spacing) theme.spacing = parsed.spacing;
      if (parsed.maxWidth) theme.maxWidth = parsed.maxWidth;
      if (parsed.headerStyle) theme.headerStyle = parsed.headerStyle;
      if (parsed.footerStyle) theme.footerStyle = parsed.footerStyle;
      if (parsed.buttonStyle) theme.buttonStyle = parsed.buttonStyle;
    } catch {}
  }

  return theme;
}

// --- Convert hex to RGB for rgba() usage ---

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "59,130,246";
  return `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`;
}

// --- Generate CSS custom properties ---

export function themeToCSS(theme: WebsiteTheme): string {
  const spacingMap = { compact: "16px", normal: "24px", relaxed: "32px" };
  const maxWidthMap = { sm: "640px", md: "768px", lg: "1024px", xl: "1280px", full: "100%" };
  const borderRadiusMap: Record<string, string> = { rounded: `${theme.borderRadius}px`, pill: "9999px", square: "0px" };

  let css = `
:root {
  --wb-primary: ${theme.colors.primary};
  --wb-primary-rgb: ${hexToRgb(theme.colors.primary)};
  --wb-secondary: ${theme.colors.secondary};
  --wb-secondary-rgb: ${hexToRgb(theme.colors.secondary)};
  --wb-accent: ${theme.colors.accent};
  --wb-accent-rgb: ${hexToRgb(theme.colors.accent)};
  --wb-background: ${theme.colors.background};
  --wb-surface: ${theme.colors.surface};
  --wb-text: ${theme.colors.text};
  --wb-text-muted: ${theme.colors.textMuted};
  --wb-border: ${theme.colors.border};
  --wb-font-heading: '${theme.fonts.heading}', system-ui, sans-serif;
  --wb-font-body: '${theme.fonts.body}', system-ui, sans-serif;
  --wb-font-heading-weight: ${theme.fonts.headingWeight || "700"};
  --wb-font-body-weight: ${theme.fonts.bodyWeight || "400"};
  --wb-border-radius: ${theme.borderRadius}px;
  --wb-spacing: ${spacingMap[theme.spacing]};
  --wb-max-width: ${maxWidthMap[theme.maxWidth]};
  --wb-button-radius: ${borderRadiusMap[theme.buttonStyle] || `${theme.borderRadius}px`};
}

body {
  font-family: var(--wb-font-body);
  font-weight: var(--wb-font-body-weight);
  color: var(--wb-text);
  background-color: var(--wb-background);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--wb-font-heading);
  font-weight: var(--wb-font-heading-weight);
  line-height: 1.2;
}

a { color: var(--wb-primary); }
::selection { background: rgba(var(--wb-primary-rgb), 0.15); }
`;

  // Dark mode CSS if dark colors exist
  if (theme.darkColors) {
    css += `
[data-theme="dark"] {
  --wb-primary: ${theme.darkColors.primary || theme.colors.primary};
  --wb-primary-rgb: ${hexToRgb(theme.darkColors.primary || theme.colors.primary)};
  --wb-secondary: ${theme.darkColors.secondary || theme.colors.secondary};
  --wb-accent: ${theme.darkColors.accent || theme.colors.accent};
  --wb-background: ${theme.darkColors.background || "#0f172a"};
  --wb-surface: ${theme.darkColors.surface || "#1e293b"};
  --wb-text: ${theme.darkColors.text || "#f1f5f9"};
  --wb-text-muted: ${theme.darkColors.textMuted || "#94a3b8"};
  --wb-border: ${theme.darkColors.border || "#334155"};
}
`;
  }

  return css;
}

// --- Block-Level Style Overrides → inline style ---

export function blockStyleToInline(style: BlockStyle): React.CSSProperties {
  const css: React.CSSProperties = {};

  if (style.bgColor) css.backgroundColor = style.bgColor;
  if (style.bgImage) {
    css.backgroundImage = style.bgOverlay
      ? `linear-gradient(${style.bgOverlay}, ${style.bgOverlay}), url(${style.bgImage})`
      : `url(${style.bgImage})`;
    css.backgroundSize = "cover";
    css.backgroundPosition = "center";
  }
  if (style.bgGradient) css.backgroundImage = style.bgGradient;
  if (style.textColor) css.color = style.textColor;
  if (style.padding) {
    css.paddingTop = style.padding.top;
    css.paddingBottom = style.padding.bottom;
    css.paddingLeft = style.padding.left;
    css.paddingRight = style.padding.right;
  }
  if (style.margin) {
    css.marginTop = style.margin.top;
    css.marginBottom = style.margin.bottom;
  }
  if (style.borderRadius !== undefined) css.borderRadius = style.borderRadius;
  if (style.border) css.border = style.border;
  if (style.shadow) css.boxShadow = style.shadow;

  return css;
}

// --- Max-Width utility ---

export function getMaxWidthClass(maxWidth?: BlockStyle["maxWidth"]): string {
  const map = {
    sm: "max-w-screen-sm",
    md: "max-w-screen-md",
    lg: "max-w-screen-lg",
    xl: "max-w-screen-xl",
    full: "max-w-full",
  };
  return map[maxWidth || "lg"] || "max-w-screen-lg";
}

// --- Typography style helpers ---

export function headlineStyleFromBlock(style: BlockStyle): React.CSSProperties {
  const css: React.CSSProperties = {};
  if (style.headlineFont) css.fontFamily = `'${style.headlineFont}', system-ui, sans-serif`;
  if (style.headlineFontSize) css.fontSize = style.headlineFontSize;
  if (style.headlineFontWeight) css.fontWeight = style.headlineFontWeight;
  if (style.headlineColor) css.color = style.headlineColor;
  if (style.headlineTransform && style.headlineTransform !== "none") css.textTransform = style.headlineTransform;
  if (style.headlineLetterSpacing) css.letterSpacing = style.headlineLetterSpacing;
  return css;
}

export function bodyStyleFromBlock(style: BlockStyle): React.CSSProperties {
  const css: React.CSSProperties = {};
  if (style.bodyFont) css.fontFamily = `'${style.bodyFont}', system-ui, sans-serif`;
  if (style.bodyFontSize) css.fontSize = style.bodyFontSize;
  if (style.bodyColor) css.color = style.bodyColor;
  if (style.bodyLineHeight) css.lineHeight = style.bodyLineHeight;
  return css;
}

export function buttonStyleFromCTA(cta: { bgColor?: string; textColor?: string; borderRadius?: number; fontSize?: number; fontWeight?: string; paddingH?: number; paddingV?: number; borderColor?: string; borderWidth?: number; style?: string }): React.CSSProperties {
  const css: React.CSSProperties = {};
  if (cta.bgColor) css.backgroundColor = cta.bgColor;
  if (cta.textColor) css.color = cta.textColor;
  if (cta.borderRadius !== undefined) css.borderRadius = cta.borderRadius;
  if (cta.fontSize) css.fontSize = cta.fontSize;
  if (cta.fontWeight) css.fontWeight = cta.fontWeight;
  if (cta.paddingH || cta.paddingV) {
    css.padding = `${cta.paddingV || 12}px ${cta.paddingH || 24}px`;
  }
  if (cta.borderColor) css.borderColor = cta.borderColor;
  if (cta.borderWidth) css.borderWidth = cta.borderWidth;
  return css;
}

// --- Google Fonts URL ---

export function getGoogleFontsUrl(theme: WebsiteTheme): string {
  const families = new Set<string>();
  if (theme.fonts.heading && theme.fonts.heading !== "Inter") {
    families.add(`${theme.fonts.heading}:wght@400;500;600;700;800`);
  }
  if (theme.fonts.body && theme.fonts.body !== "Inter" && theme.fonts.body !== theme.fonts.heading) {
    families.add(`${theme.fonts.body}:wght@300;400;500;600;700`);
  }
  if (families.size === 0) return "";
  const params = Array.from(families).map((f) => `family=${f.replace(/ /g, "+")}`).join("&");
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}
