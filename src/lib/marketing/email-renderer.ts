// ---------------------------------------------------------------------------
// Brand-Aware Email Renderer
// Renders EmailSection[] into responsive HTML with inline styles.
// Sections are the source of truth — HTML is always rendered, never directly edited.
// ---------------------------------------------------------------------------

export type EmailSectionType =
  | "header"    // Brand logo + name bar
  | "hero"      // Full-width hero image with optional overlay
  | "heading"   // H1/H2 heading
  | "text"      // Paragraph
  | "button"    // CTA button
  | "divider"   // Horizontal rule
  | "highlight" // Callout box
  | "image"     // Inline image
  | "columns"   // 2–3 column layout
  | "coupon"    // Styled coupon code
  | "social"    // Social links bar
  | "footer";   // Unsubscribe + contact info

export interface EmailSection {
  id: string;
  type: EmailSectionType;
  content: string;
  href?: string;
  imageUrl?: string;
  imageAlt?: string;
  align?: "left" | "center" | "right";
  columns?: EmailSection[][];
  couponCode?: string;
  overlayText?: string;
  level?: "h1" | "h2";
}

export interface EmailBrand {
  name?: string;
  logo?: string;
  iconLogo?: string;
  colors: { primary: string; secondary: string; accent: string };
  fonts: { heading: string; body: string };
  website?: string;
  email?: string;
  phone?: string;
  address?: string;
  socials?: Record<string, string>;
}

export interface RenderOptions {
  showLogo?: boolean;
  showBrandName?: boolean;
  logoSize?: "normal" | "large" | "big";
  footerText?: string;
}

const DEFAULT_BRAND: EmailBrand = {
  colors: { primary: "#6366f1", secondary: "#f3f4f6", accent: "#f59e0b" },
  fonts: { heading: "Georgia, serif", body: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" },
};

const LOGO_SIZES = { normal: 48, large: 64, big: 96 };

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Render a single section to an HTML table row.
 */
function renderSection(section: EmailSection, brand: EmailBrand): string {
  const { primary, secondary, accent } = brand.colors;
  const headingFont = brand.fonts.heading;
  const bodyFont = brand.fonts.body;
  const align = section.align || "left";

  switch (section.type) {
    case "header": {
      const logoHtml = brand.logo
        ? `<img src="${brand.logo}" alt="${esc(brand.name || "")}" style="max-height: 48px; max-width: 200px; display: block; margin: 0 auto 8px;" />`
        : "";
      const nameHtml = brand.name
        ? `<p style="margin: 0; font-size: 18px; font-weight: 700; color: ${primary}; text-align: center; font-family: ${headingFont};">${esc(brand.name)}</p>`
        : "";
      return `<tr><td style="padding: 24px 40px 0; text-align: center;">${logoHtml}${nameHtml}</td></tr>
        <tr><td style="padding: 8px 40px 0;"><hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0;" /></td></tr>`;
    }

    case "hero": {
      const overlayStyle = section.overlayText
        ? `position: relative;`
        : "";
      const overlayHtml = section.overlayText
        ? `<div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 20px 24px; background: linear-gradient(transparent, rgba(0,0,0,0.7));">
            <p style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; font-family: ${headingFont};">${section.overlayText}</p>
          </div>`
        : "";
      return `<tr><td style="padding: 0;">
        <div style="width: 100%; ${overlayStyle} overflow: hidden;">
          <img src="${section.imageUrl || ""}" alt="${esc(section.imageAlt || "")}" style="display: block; width: 100%; max-width: 600px; height: auto;" />
          ${overlayHtml}
        </div>
      </td></tr>`;
    }

    case "heading": {
      const tag = section.level === "h2" ? "h2" : "h1";
      const size = tag === "h1" ? "24px" : "20px";
      return `<tr><td style="padding: 8px 40px;">
        <${tag} style="margin: 0; font-size: ${size}; font-weight: 700; color: #111827; line-height: 1.3; text-align: ${align}; font-family: ${headingFont};">${section.content}</${tag}>
      </td></tr>`;
    }

    case "text":
      return `<tr><td style="padding: 8px 40px;">
        <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #374151; text-align: ${align}; font-family: ${bodyFont};">${section.content}</p>
      </td></tr>`;

    case "button":
      return `<tr><td style="padding: 12px 40px; text-align: ${align};">
        <table role="presentation" style="border-collapse: collapse;${align === "center" ? " margin: 0 auto;" : ""}"><tr>
          <td style="border-radius: 8px; background-color: ${primary};">
            <a href="${section.href || "#"}" style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px; font-family: ${bodyFont};">${section.content}</a>
          </td>
        </tr></table>
      </td></tr>`;

    case "divider":
      return `<tr><td style="padding: 12px 40px;">
        <hr style="margin: 0; border: none; border-top: 1px solid #e5e7eb;" />
      </td></tr>`;

    case "highlight":
      return `<tr><td style="padding: 8px 40px;">
        <div style="padding: 16px 20px; background-color: ${secondary}; border-radius: 8px; border-left: 4px solid ${accent};">
          <p style="margin: 0; font-size: 15px; line-height: 1.5; color: #374151; font-family: ${bodyFont};">${section.content}</p>
        </div>
      </td></tr>`;

    case "image":
      return `<tr><td style="padding: 8px 40px; text-align: ${align};">
        ${section.href ? `<a href="${section.href}" style="text-decoration: none;">` : ""}
        <img src="${section.imageUrl || ""}" alt="${esc(section.imageAlt || "")}" style="display: block; max-width: 100%; height: auto; border-radius: 8px;${align === "center" ? " margin: 0 auto;" : ""}" />
        ${section.href ? "</a>" : ""}
      </td></tr>`;

    case "columns": {
      if (!section.columns || section.columns.length === 0) return "";
      const colCount = section.columns.length;
      const colWidth = Math.floor(100 / colCount);
      const colsHtml = section.columns
        .map(
          (col) =>
            `<td style="width: ${colWidth}%; vertical-align: top; padding: 0 8px;">
              ${col.map((s) => renderSectionInner(s, brand)).join("")}
            </td>`
        )
        .join("");
      return `<tr><td style="padding: 8px 32px;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;"><tr>${colsHtml}</tr></table>
      </td></tr>`;
    }

    case "coupon": {
      const code = section.couponCode || section.content || "CODE";
      return `<tr><td style="padding: 12px 40px; text-align: center;">
        <div style="display: inline-block; padding: 16px 32px; background-color: ${secondary}; border: 2px dashed ${accent}; border-radius: 8px;">
          <p style="margin: 0 0 4px; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; font-family: ${bodyFont};">Use code</p>
          <p style="margin: 0; font-size: 24px; font-weight: 700; color: ${primary}; letter-spacing: 2px; font-family: ${headingFont};">${esc(code)}</p>
        </div>
      </td></tr>`;
    }

    case "social": {
      const socials = brand.socials || {};
      const links: string[] = [];
      const socialMap: [string, string, string][] = [
        ["instagram", "Instagram", "https://instagram.com/"],
        ["twitter", "Twitter", "https://twitter.com/"],
        ["facebook", "Facebook", "https://facebook.com/"],
        ["linkedin", "LinkedIn", "https://linkedin.com/in/"],
        ["youtube", "YouTube", "https://youtube.com/"],
        ["tiktok", "TikTok", "https://tiktok.com/@"],
      ];
      for (const [key, label, prefix] of socialMap) {
        if (socials[key]) {
          links.push(
            `<a href="${prefix}${socials[key]}" style="color: ${primary}; text-decoration: none; margin: 0 6px; font-family: ${bodyFont};">${label}</a>`
          );
        }
      }
      if (links.length === 0) return "";
      return `<tr><td style="padding: 8px 40px; text-align: center;">
        <p style="margin: 0; font-size: 12px;">${links.join(" &middot; ")}</p>
      </td></tr>`;
    }

    case "footer": {
      const parts: string[] = [];
      if (brand.website) parts.push(`<a href="${brand.website}" style="color: ${primary}; text-decoration: none;">${brand.website.replace(/^https?:\/\//, "")}</a>`);
      if (brand.email) parts.push(brand.email);
      if (brand.phone) parts.push(brand.phone);
      const contactHtml = parts.length > 0
        ? `<p style="margin: 0 0 8px; font-size: 11px; line-height: 1.5; color: #9ca3af; text-align: center; font-family: ${bodyFont};">${parts.join(" &middot; ")}</p>`
        : "";
      const addressHtml = brand.address
        ? `<p style="margin: 0 0 8px; font-size: 11px; color: #9ca3af; text-align: center; font-family: ${bodyFont};">${esc(brand.address)}</p>`
        : "";
      const footerContent = section.content || "You received this email because you are a valued customer. {{unsubscribeLink}}";
      return `<tr><td style="padding: 20px 40px; background-color: #f9fafb; border-radius: 0 0 12px 12px;">
        ${contactHtml}
        ${addressHtml}
        <p style="margin: 0; font-size: 11px; line-height: 1.5; color: #9ca3af; text-align: center; font-family: ${bodyFont};">${footerContent}</p>
      </td></tr>`;
    }

    default:
      return "";
  }
}

/**
 * Render a section for use inside columns (no outer <tr> wrapper, just content).
 */
function renderSectionInner(section: EmailSection, brand: EmailBrand): string {
  const { primary, accent, secondary } = brand.colors;
  const bodyFont = brand.fonts.body;
  const headingFont = brand.fonts.heading;

  switch (section.type) {
    case "heading": {
      const tag = section.level === "h2" ? "h2" : "h1";
      const size = tag === "h1" ? "20px" : "17px";
      return `<${tag} style="margin: 0 0 8px; font-size: ${size}; font-weight: 700; color: #111827; font-family: ${headingFont};">${section.content}</${tag}>`;
    }
    case "text":
      return `<p style="margin: 0 0 8px; font-size: 14px; line-height: 1.5; color: #374151; font-family: ${bodyFont};">${section.content}</p>`;
    case "button":
      return `<table role="presentation" style="margin: 8px 0; border-collapse: collapse;"><tr><td style="border-radius: 6px; background-color: ${primary};"><a href="${section.href || "#"}" style="display: inline-block; padding: 10px 20px; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 6px; font-family: ${bodyFont};">${section.content}</a></td></tr></table>`;
    case "image":
      return `<img src="${section.imageUrl || ""}" alt="${esc(section.imageAlt || "")}" style="display: block; max-width: 100%; height: auto; border-radius: 6px; margin: 8px 0;" />`;
    case "highlight":
      return `<div style="padding: 12px 16px; background-color: ${secondary}; border-radius: 6px; border-left: 3px solid ${accent}; margin: 8px 0;"><p style="margin: 0; font-size: 13px; line-height: 1.4; color: #374151; font-family: ${bodyFont};">${section.content}</p></div>`;
    default:
      return "";
  }
}

/**
 * Render a complete email from sections + brand data.
 */
export function renderEmailHtml(
  sections: EmailSection[],
  brand?: Partial<EmailBrand>,
  options?: RenderOptions
): string {
  const b: EmailBrand = {
    ...DEFAULT_BRAND,
    ...brand,
    colors: { ...DEFAULT_BRAND.colors, ...(brand?.colors || {}) },
    fonts: { ...DEFAULT_BRAND.fonts, ...(brand?.fonts || {}) },
  };

  // Auto-inject header if showLogo/showBrandName and no header section exists
  const hasHeader = sections.some((s) => s.type === "header");
  const showLogo = options?.showLogo !== false;
  const showBrandName = options?.showBrandName !== false;

  // Apply logo size
  const logoSize = LOGO_SIZES[options?.logoSize || "normal"];
  const brandWithLogoSize = {
    ...b,
    _logoMaxHeight: logoSize,
  };

  // Build section HTML
  const sectionRows: string[] = [];

  // Auto-add header if brand has logo/name and no explicit header section
  if (!hasHeader && (b.logo || b.name) && (showLogo || showBrandName)) {
    const headerBrand = {
      ...b,
      logo: showLogo ? b.logo : undefined,
      name: showBrandName ? b.name : undefined,
    };
    // Render header with custom logo size
    const logoHtml = headerBrand.logo
      ? `<img src="${headerBrand.logo}" alt="${esc(headerBrand.name || "")}" style="max-height: ${logoSize}px; max-width: 200px; display: block; margin: 0 auto 8px;" />`
      : "";
    const nameHtml = headerBrand.name
      ? `<p style="margin: 0; font-size: 18px; font-weight: 700; color: ${b.colors.primary}; text-align: center; font-family: ${b.fonts.heading};">${esc(headerBrand.name)}</p>`
      : "";
    if (logoHtml || nameHtml) {
      sectionRows.push(
        `<tr><td style="padding: 24px 40px 0; text-align: center;">${logoHtml}${nameHtml}</td></tr>
         <tr><td style="padding: 8px 40px 0;"><hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0;" /></td></tr>`
      );
    }
  }

  for (const section of sections) {
    if (section.type === "header" && !showLogo && !showBrandName) continue;
    sectionRows.push(renderSection(section, b));
  }

  // Auto-add social + footer if not present
  const hasSocial = sections.some((s) => s.type === "social");
  const hasFooter = sections.some((s) => s.type === "footer");
  if (!hasSocial && b.socials) {
    sectionRows.push(renderSection({ id: "_social", type: "social", content: "" }, b));
  }
  if (!hasFooter) {
    sectionRows.push(
      renderSection(
        { id: "_footer", type: "footer", content: options?.footerText || "You received this email because you are a valued customer. {{unsubscribeLink}}" },
        b
      )
    );
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: ${b.fonts.body};">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          ${sectionRows.join("\n          ")}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Extract plain text from sections (for the text-only email fallback).
 */
export function sectionsToPlainText(sections: EmailSection[]): string {
  return sections
    .filter((s) => ["heading", "text", "highlight", "coupon"].includes(s.type))
    .map((s) => {
      if (s.type === "coupon") return `Use code: ${s.couponCode || s.content}`;
      return s.content;
    })
    .join("\n\n");
}

/**
 * Create a blank template with default sections for a fresh email.
 */
export function createBlankSections(): EmailSection[] {
  return [
    { id: "1", type: "heading", content: "Your Headline Here" },
    { id: "2", type: "text", content: "Write your email content here. Use the toolbar to add more sections, and drag to reorder." },
    { id: "3", type: "button", content: "Call to Action", href: "https://", align: "center" },
  ];
}

/**
 * Generate a unique section ID.
 */
export function generateSectionId(): string {
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
