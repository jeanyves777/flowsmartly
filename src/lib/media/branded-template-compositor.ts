import sharp from "sharp";
import { compositeBrandLogoOnImageBuffer } from "@/lib/media/brand-logo-compositor";

export type BrandedTemplate = "minimal" | "footer_bar";

interface BrandKitLike {
  name: string;
  logo: string | null;
  iconLogo: string | null;
  colors: string; // JSON: { primary, secondary, accent }
  website: string | null;
  email: string | null;
  phone: string | null;
}

interface CompositeParams {
  imageBuffer: Buffer;
  brandKit: BrandKitLike;
  template: BrandedTemplate;
  /** Short headline drawn over the image — falls back to brand name. */
  postTitle?: string | null;
  /** Optional sub-line under the title. */
  postSubtitle?: string | null;
}

interface BrandColors {
  primary: string;
  secondary: string;
  accent: string;
}

function parseColors(raw: string): BrandColors {
  try {
    const parsed = JSON.parse(raw) as Partial<BrandColors>;
    return {
      primary: parsed.primary || "#1f2937",
      secondary: parsed.secondary || "#ef4444",
      accent: parsed.accent || "#fbbf24",
    };
  } catch {
    return { primary: "#1f2937", secondary: "#ef4444", accent: "#fbbf24" };
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function clipText(value: string, max: number): string {
  return value.length > max ? value.slice(0, max - 1) + "…" : value;
}

/**
 * Footer-bar template:
 *   - Bottom 16% of the image is a band in the brand primary color
 *   - A white rounded card on the left of the footer holds the real logo
 *     (placed via compositeBrandLogoOnImageBuffer afterwards)
 *   - Website + email rendered as pills on the right of the footer
 *   - A title strap rendered near the top in a brand-accent ribbon, falls back
 *     to skipped when no postTitle is provided
 */
// Returns SVG dimensions for the white logo card on the bottom-left so the
// real logo can be composited directly inside it after the SVG layer.
interface FooterLayout {
  footerH: number;
  footerY: number;
  logoCardX: number;
  logoCardY: number;
  logoCardW: number;
  logoCardH: number;
}

function computeFooterLayout(width: number, height: number): FooterLayout {
  const footerH = Math.round(height * 0.16);
  const footerY = height - footerH;
  const logoCardW = Math.round(width * 0.24);
  const logoCardH = footerH + Math.round(height * 0.03);
  const logoCardX = Math.round(width * 0.02);
  // Card sits straddling the top of the footer band by ~3% of height.
  const logoCardY = footerY - Math.round(height * 0.03);
  return { footerH, footerY, logoCardX, logoCardY, logoCardW, logoCardH };
}

function buildFooterBarSvg(params: {
  width: number;
  height: number;
  colors: BrandColors;
  brandName: string;
  website: string | null;
  email: string | null;
  postTitle: string | null;
  layout: FooterLayout;
}): string {
  const { width, height, colors, brandName, website, postTitle, layout } = params;
  const { footerH, footerY, logoCardX, logoCardY, logoCardW, logoCardH } = layout;

  // Title strap — short, conservative width so it never clips.
  const titleSvg = postTitle
    ? (() => {
        const txt = clipText(postTitle, 28);
        const fontPx = Math.round(height * 0.04);
        // Approximate width: 0.6em per char + padding, capped to 78% of width
        const approxW = Math.min(
          Math.round(width * 0.78),
          Math.round(txt.length * fontPx * 0.6 + 64),
        );
        const ribbonH = Math.round(fontPx * 1.7);
        const ribbonX = Math.round(width * 0.5 - approxW / 2);
        const ribbonY = Math.round(height * 0.05);
        return `
          <g>
            <rect x="${ribbonX}" y="${ribbonY}" rx="${ribbonH / 2}" ry="${ribbonH / 2}" width="${approxW}" height="${ribbonH}" fill="${colors.secondary}" opacity="0.95"/>
            <text x="${ribbonX + approxW / 2}" y="${ribbonY + ribbonH * 0.68}" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="${fontPx}" font-weight="700" fill="${colors.primary}">${escapeXml(txt)}</text>
          </g>
        `;
      })()
    : "";

  const websiteText = website
    ? clipText(website.replace(/^https?:\/\//, "").replace(/^www\./, ""), 36)
    : null;

  // ONE contact pill (website) on the right of the footer. Email is fine but
  // keeps the footer clean — caller can request additional pills later.
  const handleY = footerY + Math.round(footerH * 0.3);
  const handleH = Math.round(footerH * 0.45);
  const pillSvg = websiteText
    ? (() => {
        const fontPx = Math.round(handleH * 0.5);
        const approxW = Math.min(
          Math.round(width * 0.5),
          Math.round(websiteText.length * fontPx * 0.55 + 64),
        );
        const pillX = width - approxW - Math.round(width * 0.02);
        return `
          <g>
            <rect x="${pillX}" y="${handleY}" rx="${handleH / 2}" ry="${handleH / 2}" width="${approxW}" height="${handleH}" fill="#ffffff" opacity="0.96"/>
            <text x="${pillX + approxW / 2}" y="${handleY + handleH * 0.68}" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="${fontPx}" font-weight="600" fill="${colors.primary}">${escapeXml(websiteText)}</text>
          </g>
        `;
      })()
    : "";

  // Subtle brand name above the website pill if present, else as a fallback
  // when no website is set so the footer is never empty.
  const brandText = clipText(brandName, 36);
  const brandNameSvg = !websiteText
    ? (() => {
        const fontPx = Math.round(handleH * 0.55);
        return `
          <text x="${width - Math.round(width * 0.03)}" y="${footerY + footerH * 0.62}" text-anchor="end" font-family="Inter, system-ui, sans-serif" font-size="${fontPx}" font-weight="600" fill="#ffffff">${escapeXml(brandText)}</text>
        `;
      })()
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    ${titleSvg}
    <rect x="0" y="${footerY}" width="${width}" height="${footerH}" fill="${colors.primary}"/>
    <rect x="${logoCardX}" y="${logoCardY}" rx="${Math.round(footerH * 0.18)}" ry="${Math.round(footerH * 0.18)}" width="${logoCardW}" height="${logoCardH}" fill="#ffffff"/>
    ${pillSvg}
    ${brandNameSvg}
  </svg>`;
}

export async function compositeBrandedTemplate(
  params: CompositeParams,
): Promise<Buffer> {
  const { imageBuffer, brandKit, template, postTitle } = params;

  // Minimal template = just the legacy small-logo composite, untouched.
  if (template === "minimal") {
    const logoSource = brandKit.iconLogo || brandKit.logo;
    if (!logoSource) return imageBuffer;
    try {
      return await compositeBrandLogoOnImageBuffer({
        imageBuffer,
        logoSource,
      });
    } catch {
      return imageBuffer;
    }
  }

  // Footer bar template — branded band + title ribbon + contact pills + logo card.
  const meta = await sharp(imageBuffer).metadata();
  const width = meta.width || 1024;
  const height = meta.height || 1024;
  const colors = parseColors(brandKit.colors);
  const layout = computeFooterLayout(width, height);

  const svg = buildFooterBarSvg({
    width,
    height,
    colors,
    brandName: brandKit.name,
    website: brandKit.website,
    email: brandKit.email,
    postTitle: postTitle ?? null,
    layout,
  });

  // Layer the SVG over the photo first.
  const withFooter = await sharp(imageBuffer)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();

  // Logo lands inside the white card on the bottom-left of the footer.
  // The base compositor's placement.x/y are 0–1 fractions of image dims
  // (the TOP-LEFT corner of the logo). sizePercent is clamped to 8–28 of
  // image width.
  const logoSource = brandKit.iconLogo || brandKit.logo;
  if (!logoSource) return withFooter;

  try {
    const { logoCardX, logoCardY, logoCardW, logoCardH } = layout;
    const padding = Math.round(Math.min(logoCardW, logoCardH) * 0.14);
    // Target size: fit inside the card with padding; sizePercent is width-based.
    const targetW = logoCardW - padding * 2;
    const sizePercent = Math.max(
      8,
      Math.min(28, Math.round((targetW / width) * 100)),
    );
    // Logo top-left = card top-left + padding, as 0–1 fractions.
    // The base compositor will resize so the actual rendered W may be < targetW;
    // it still anchors to top-left so this lands inside the card.
    const xFrac = (logoCardX + padding) / width;
    const yFrac = (logoCardY + padding) / height;

    return await compositeBrandLogoOnImageBuffer({
      imageBuffer: withFooter,
      logoSource,
      placement: { x: xFrac, y: yFrac, sizePercent },
    });
  } catch (err) {
    console.warn(
      "[branded-template] Logo composite failed; returning footer-only image:",
      err instanceof Error ? err.message : err,
    );
    return withFooter;
  }
}
