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
function buildFooterBarSvg(params: {
  width: number;
  height: number;
  colors: BrandColors;
  brandName: string;
  website: string | null;
  email: string | null;
  postTitle: string | null;
}): string {
  const { width, height, colors, brandName, website, email, postTitle } = params;
  const footerH = Math.round(height * 0.16);
  const footerY = height - footerH;
  const logoCardW = Math.round(width * 0.26);
  const logoCardH = footerH + Math.round(height * 0.04);
  const logoCardY = height - logoCardH + Math.round(footerH * 0.1);

  // Header ribbon for the title (only when title present)
  const titleSvg = postTitle
    ? (() => {
        const txt = clipText(postTitle, 56);
        const ribbonH = Math.round(height * 0.13);
        const ribbonY = Math.round(height * 0.04);
        return `
          <g>
            <rect x="${Math.round(width * 0.55)}" y="${ribbonY}" rx="${ribbonH / 2}" ry="${ribbonH / 2}" width="${Math.round(width * 0.4)}" height="${ribbonH}" fill="${colors.secondary}" opacity="0.94"/>
            <text x="${Math.round(width * 0.75)}" y="${ribbonY + ribbonH * 0.66}" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="${Math.round(ribbonH * 0.4)}" font-weight="700" fill="#ffffff">${escapeXml(txt)}</text>
          </g>
        `;
      })()
    : "";

  const websiteText = website ? clipText(website.replace(/^https?:\/\//, ""), 32) : null;
  const emailText = email ? clipText(email, 32) : null;
  const handleSvg: string[] = [];
  let handleX = Math.round(width * 0.42);
  const handleY = footerY + Math.round(footerH * 0.32);
  const handleH = Math.round(footerH * 0.4);
  if (websiteText) {
    const pillW = Math.max(140, websiteText.length * Math.round(handleH * 0.42) + 40);
    handleSvg.push(`
      <g>
        <rect x="${handleX}" y="${handleY}" rx="${handleH / 2}" ry="${handleH / 2}" width="${pillW}" height="${handleH}" fill="#ffffff" opacity="0.96"/>
        <text x="${handleX + pillW / 2}" y="${handleY + handleH * 0.66}" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="${Math.round(handleH * 0.42)}" font-weight="600" fill="${colors.primary}">🌐 ${escapeXml(websiteText)}</text>
      </g>
    `);
    handleX += pillW + 12;
  }
  if (emailText) {
    const pillW = Math.max(140, emailText.length * Math.round(handleH * 0.42) + 40);
    handleSvg.push(`
      <g>
        <rect x="${handleX}" y="${handleY}" rx="${handleH / 2}" ry="${handleH / 2}" width="${pillW}" height="${handleH}" fill="#ffffff" opacity="0.96"/>
        <text x="${handleX + pillW / 2}" y="${handleY + handleH * 0.66}" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="${Math.round(handleH * 0.42)}" font-weight="500" fill="${colors.primary}">✉ ${escapeXml(emailText)}</text>
      </g>
    `);
  }

  const brandText = clipText(brandName, 28);

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <!-- Optional title ribbon -->
      ${titleSvg}
      <!-- Footer bar -->
      <rect x="0" y="${footerY}" width="${width}" height="${footerH}" fill="${colors.primary}"/>
      <!-- Logo card (white) -->
      <rect x="${Math.round(width * 0.02)}" y="${logoCardY}" rx="${Math.round(footerH * 0.15)}" ry="${Math.round(footerH * 0.15)}" width="${logoCardW}" height="${logoCardH}" fill="#ffffff"/>
      <!-- Brand name text below the logo card (fallback in case logo composite fails) -->
      <text x="${Math.round(width * 0.02) + logoCardW / 2}" y="${logoCardY + logoCardH - Math.round(footerH * 0.18)}" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="${Math.round(footerH * 0.22)}" font-weight="600" fill="${colors.primary}" opacity="0">${escapeXml(brandText)}</text>
      <!-- Contact pills on the right of the footer -->
      ${handleSvg.join("\n")}
    </svg>
  `;
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

  const svg = buildFooterBarSvg({
    width,
    height,
    colors,
    brandName: brandKit.name,
    website: brandKit.website,
    email: brandKit.email,
    postTitle: postTitle ?? null,
  });

  // Layer the SVG over the photo first.
  const withFooter = await sharp(imageBuffer)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();

  // Then overlay the REAL logo inside the white card on the bottom-left.
  // We use the existing compositor and a placement that targets the card area.
  const logoSource = brandKit.iconLogo || brandKit.logo;
  if (!logoSource) return withFooter;

  try {
    const footerH = Math.round(height * 0.16);
    const logoCardW = Math.round(width * 0.26);
    const logoCardH = footerH + Math.round(height * 0.04);
    const logoCardX = Math.round(width * 0.02);
    const logoCardY = height - logoCardH + Math.round(footerH * 0.1);
    // Place the logo within the card with some padding.
    const padded = Math.round(Math.min(logoCardW, logoCardH) * 0.18);
    const targetW = logoCardW - padded * 2;
    const targetH = logoCardH - padded * 2;
    const logoCenterX = logoCardX + logoCardW / 2;
    const logoCenterY = logoCardY + logoCardH / 2;
    // The base compositor expects sizePercent + x/y as a percentage of image
    // dimensions; we approximate by sizing to the card and centering inside it.
    const sizePercent = Math.round(((targetW + targetH) / 2 / width) * 100);
    const xPct = Math.round((logoCenterX / width) * 100);
    const yPct = Math.round((logoCenterY / height) * 100);

    return await compositeBrandLogoOnImageBuffer({
      imageBuffer: withFooter,
      logoSource,
      placement: { x: xPct, y: yPct, sizePercent },
    });
  } catch (err) {
    console.warn(
      "[branded-template] Logo composite failed; returning footer-only image:",
      err instanceof Error ? err.message : err,
    );
    return withFooter;
  }
}
