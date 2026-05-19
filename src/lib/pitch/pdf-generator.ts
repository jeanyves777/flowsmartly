import type { PitchContent } from "./generator";
import type { ServiceProposalContent } from "./proposal-agent";
import type { ProposalDeckSlide, ProposalDeckSlideRole } from "./proposal-deck-types";
import type { ResearchData } from "./researcher";
import { computeDigitalScore, scoreHexColor } from "./scorer";
import { getPresignedUrl } from "@/lib/utils/s3-client";

interface BrandInfo {
  name: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  logo?: string;          // base64 data URI of the brand logo
  logoAspectRatio?: number; // width / height — needed for correct sizing in PDF
}

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length <= maxChars) {
      cur = (cur + " " + w).trim();
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function normalizeHex(value: unknown, fallback: string): string {
  const raw = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(raw) ? raw : fallback;
}

function mixRgb(hex: string, amount: number, target = { r: 255, g: 255, b: 255 }) {
  const rgb = hexToRgb(normalizeHex(hex, "#2563eb"));
  return {
    r: Math.round(rgb.r + (target.r - rgb.r) * amount),
    g: Math.round(rgb.g + (target.g - rgb.g) * amount),
    b: Math.round(rgb.b + (target.b - rgb.b) * amount),
  };
}

function imageFormat(dataUri: string): "PNG" | "JPEG" | "WEBP" {
  if (/^data:image\/jpe?g/i.test(dataUri)) return "JPEG";
  if (/^data:image\/webp/i.test(dataUri)) return "WEBP";
  return "PNG";
}

interface ResolvedPdfImage {
  dataUri: string;
  width?: number;
  height?: number;
  hasAlpha?: boolean;
}

function pdfSafeText(value: unknown): string {
  return String(value || "")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[★☆⭐]/g, "+")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function resolvePdfImage(src: string | undefined | null): Promise<ResolvedPdfImage | null> {
  if (!src) return null;

  try {
    const sharp = (await import("sharp")).default;
    let input: Buffer;
    let contentType = "image/png";

    if (src.startsWith("data:")) {
      const match = src.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return { dataUri: src };
      contentType = match[1];
      input = Buffer.from(match[2], "base64");
    } else if (src.startsWith("/")) {
      const { readFile } = await import("fs/promises");
      const { join } = await import("path");
      input = await readFile(join(process.cwd(), "public", src));
    } else {
      let response: Response | null = null;
      if (src.startsWith("http")) {
        response = await fetch(src);
        if (!response.ok) {
          response = await fetch(await getPresignedUrl(src));
        }
      } else {
        response = await fetch(await getPresignedUrl(src));
      }

      if (!response?.ok) return null;
      contentType = response.headers.get("content-type")?.split(";")[0] || "image/png";
      input = Buffer.from(await response.arrayBuffer());
    }

    const image = sharp(input);
    const metadata = await image.metadata();
    const hasAlpha = Boolean(metadata.hasAlpha);
    if (hasAlpha) {
      const png = await image
        .resize({ width: 980, withoutEnlargement: true })
        .png({ compressionLevel: 9, palette: true, quality: 92 })
        .toBuffer();
      const outMeta = await sharp(png).metadata();
      return {
        dataUri: `data:image/png;base64,${png.toString("base64")}`,
        width: outMeta.width,
        height: outMeta.height,
        hasAlpha: true,
      };
    }

    const jpeg = await image
      .resize({ width: 1200, withoutEnlargement: true })
      .jpeg({ quality: 86, mozjpeg: true })
      .toBuffer();
    const outMeta = await sharp(jpeg).metadata();
    return {
      dataUri: `data:image/jpeg;base64,${jpeg.toString("base64")}`,
      width: outMeta.width,
      height: outMeta.height,
      hasAlpha: false,
    };
  } catch (error) {
    console.warn("[proposal pdf] Could not resolve image asset:", error);
    return null;
  }
}

async function resolvePdfImageDataUri(src: string | undefined | null): Promise<string | null> {
  const image = await resolvePdfImage(src);
  if (image) return image.dataUri;

  if (!src) return null;
  if (src.startsWith("data:")) return src;

  try {
    let response: Response | null = null;
    if (src.startsWith("http")) {
      response = await fetch(src);
      if (!response.ok) {
        response = await fetch(await getPresignedUrl(src));
      }
    } else if (src.startsWith("/")) {
      const { readFile } = await import("fs/promises");
      const { join } = await import("path");
      const file = await readFile(join(process.cwd(), "public", src));
      return `data:image/png;base64,${file.toString("base64")}`;
    } else {
      response = await fetch(await getPresignedUrl(src));
    }

    if (!response?.ok) return null;
    const input = Buffer.from(await response.arrayBuffer());
    try {
      const sharp = (await import("sharp")).default;
      const jpeg = await sharp(input)
        .resize({ width: 1400, withoutEnlargement: true })
        .jpeg({ quality: 86, mozjpeg: true })
        .toBuffer();
      return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
    } catch {
      const type = response.headers.get("content-type")?.split(";")[0] || "image/png";
      return `data:${type};base64,${input.toString("base64")}`;
    }
  } catch (error) {
    console.warn("[proposal pdf] Could not resolve image asset:", error);
    return null;
  }
}

// Draw a horizontal score bar at position (x, y)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawScoreBar(doc: any, x: number, y: number, w: number, h: number, score: number, color: string) {
  const rgb = hexToRgb(color);
  // Track (gray background)
  doc.setFillColor(235, 237, 242);
  doc.roundedRect(x, y, w, h, h / 2, h / 2, "F");
  // Fill
  const fillW = Math.max(h, (score / 100) * w); // at least a dot
  doc.setFillColor(rgb.r, rgb.g, rgb.b);
  doc.roundedRect(x, y, fillW, h, h / 2, h / 2, "F");
}

// Draw a score badge (rounded square) with big number
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawScoreBadge(doc: any, x: number, y: number, size: number, score: number) {
  const color = scoreHexColor(score);
  const rgb = hexToRgb(color);
  const bgRgb = hexToRgb(color + "22"); // light tint — approximate with desaturated

  // Light background
  doc.setFillColor(rgb.r + Math.round((255 - rgb.r) * 0.85), rgb.g + Math.round((255 - rgb.g) * 0.85), rgb.b + Math.round((255 - rgb.b) * 0.85));
  doc.roundedRect(x, y, size, size, 4, 4, "F");

  // Colored border
  doc.setDrawColor(rgb.r, rgb.g, rgb.b);
  doc.setLineWidth(1.5);
  doc.roundedRect(x, y, size, size, 4, 4, "S");

  // Score number
  doc.setTextColor(rgb.r, rgb.g, rgb.b);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text(String(score), x + size / 2, y + size / 2 - 2, { align: "center" });

  // "/100" label
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(150, 150, 150);
  doc.text("/100", x + size / 2, y + size / 2 + 6, { align: "center" });
}

export async function generatePitchPDF(
  pitch: PitchContent,
  research: ResearchData,
  businessName: string,
  brand: BrandInfo
): Promise<Buffer> {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const pageH = 297;
  const margin = 18;
  const contentW = pageW - margin * 2;
  const primaryHex = brand.primaryColor || "#2563eb";
  const primary = hexToRgb(primaryHex);

  const score = computeDigitalScore(research);
  const gp = research.googlePlaces;

  // ══════════════════════════════════════════════════════════════════
  // PAGE 1 — Header + Score Card + Findings
  // ══════════════════════════════════════════════════════════════════

  // ── Header bar ─────────────────────────────────────────────────────
  doc.setFillColor(primary.r, primary.g, primary.b);
  doc.rect(0, 0, pageW, 20, "F");

  // Left side: brand logo image if available, otherwise brand name text
  if (brand.logo) {
    try {
      const logoH = 12; // mm — fits in 20mm header with 4mm padding top/bottom
      const logoW = logoH * (brand.logoAspectRatio || 3);
      const fmt = brand.logo.includes("jpeg") || brand.logo.includes("jpg") ? "JPEG"
        : brand.logo.includes("webp") ? "WEBP" : "PNG";
      doc.addImage(brand.logo, fmt, margin, 4, logoW, logoH);
    } catch {
      // Fall back to text if image fails
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(brand.name.toUpperCase(), margin, 13);
    }
  } else {
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(brand.name.toUpperCase(), margin, 13);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.text("CONFIDENTIAL PROPOSAL", pageW - margin, 13, { align: "right" });

  // ── Headline ─────────────────────────────────────────────────────
  let y = 30;
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(17);
  doc.setFont("helvetica", "bold");
  const headLines = wrapText(pitch.headline || `A Growth Strategy Built for ${businessName}`, 58);
  for (const line of headLines) {
    doc.text(line, margin, y);
    y += 8;
  }

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(110, 110, 110);
  doc.text(`Prepared for: ${businessName}  ·  ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`, margin, y);
  y += 4;

  // Divider
  doc.setDrawColor(primary.r, primary.g, primary.b);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // ── Digital Health Score Card ──────────────────────────────────────
  // Layout: badge (28x28) | label + main bar + 3 rows of category bars (2 cols)
  // Row heights: title(8) + top-pad(4) + badge area(28) + catRows(3×9=27) + bottom-pad(6) = 73
  const cardH = 76;
  doc.setFillColor(247, 249, 252);
  doc.roundedRect(margin, y, contentW, cardH, 4, 4, "F");
  doc.setDrawColor(220, 224, 235);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentW, cardH, 4, 4, "S");

  // Card title
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(primary.r, primary.g, primary.b);
  doc.text("DIGITAL PRESENCE SCORE", margin + 5, y + 8);

  // Score badge (left side of card, smaller to leave room for cats)
  const badgeX = margin + 5;
  const badgeY = y + 13;
  const badgeSize = 28;
  drawScoreBadge(doc, badgeX, badgeY, badgeSize, score.overall);

  // Score label + benchmark text (right of badge)
  const labelX = badgeX + badgeSize + 6;
  const scoreRgb = hexToRgb(score.hexColor);
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(scoreRgb.r, scoreRgb.g, scoreRgb.b);
  doc.text(`${score.label} Digital Presence`, labelX, badgeY + 7);

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(130, 130, 130);
  doc.text(`Industry avg: 52  ·  Top performers: 85`, labelX, badgeY + 14);

  // Main score bar
  const barW = contentW - (labelX - margin) - 5;
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text("Overall", labelX, badgeY + 21);
  doc.setTextColor(scoreRgb.r, scoreRgb.g, scoreRgb.b);
  doc.setFont("helvetica", "bold");
  doc.text(String(score.overall), labelX + barW, badgeY + 21, { align: "right" });
  doc.setFont("helvetica", "normal");
  drawScoreBar(doc, labelX, badgeY + 22.5, barW, 3.5, score.overall, score.hexColor);

  // Benchmark marker at 85
  doc.setDrawColor(140, 140, 140);
  doc.setLineWidth(0.4);
  const bmarkX = labelX + (85 / 100) * barW;
  doc.line(bmarkX, badgeY + 21.5, bmarkX, badgeY + 27);
  doc.setFontSize(5.5);
  doc.setTextColor(140, 140, 140);
  doc.text("85", bmarkX, badgeY + 30, { align: "center" });

  // Category bars: 2-column grid, 3 rows (5 cats: 2+2+1)
  const catStartY = badgeY + 33;
  const halfW = (barW - 6) / 2;
  const catRowH = 8.5;
  const catBarH = 3;

  score.categories.forEach((cat, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = labelX + col * (halfW + 6);
    const cy = catStartY + row * catRowH;
    const catRgb = hexToRgb(cat.hexColor);

    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(cat.name, cx, cy);
    doc.setTextColor(catRgb.r, catRgb.g, catRgb.b);
    doc.setFont("helvetica", "bold");
    doc.text(String(cat.score), cx + halfW - 2, cy, { align: "right" });
    doc.setFont("helvetica", "normal");
    drawScoreBar(doc, cx, cy + 1.5, halfW - 4, catBarH, cat.score, cat.hexColor);
  });

  y += cardH + 8;

  // ── Google Business Data (if available) ────────────────────────────
  if (gp) {
    // Layout (3 rows, no emoji — jsPDF Helvetica doesn't support them):
    //   Row 1 (y+7):  Title left  |  Phone right
    //   Row 2 (y+14): Rating stars+reviews left  |  Address right
    //   Row 3 (y+19): Full-width rating bar + benchmark marker
    const gpCardH = 24;
    doc.setFillColor(255, 251, 235);
    doc.roundedRect(margin, y, contentW, gpCardH, 3, 3, "F");
    doc.setDrawColor(251, 191, 36);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentW, gpCardH, 3, 3, "S");

    // Row 1 — title (left) + phone (right)
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(120, 80, 0);
    doc.text("GOOGLE BUSINESS PROFILE", margin + 4, y + 7);

    if (gp.phone) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 100, 100);
      doc.text(`Tel: ${gp.phone}`, pageW - margin - 4, y + 7, { align: "right" });
    }

    // Row 2 — stars + reviews (left) + address (right)
    const starStr = gp.rating !== undefined ? `${gp.rating}/5.0` : "No rating";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(180, 120, 0);
    doc.text(starStr, margin + 4, y + 14);

    if (gp.reviewCount !== undefined) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(120, 80, 0);
      doc.text(`(${gp.reviewCount} reviews)`, margin + 20, y + 14);
    }

    if (gp.address) {
      const shortAddr = gp.address.length > 55 ? gp.address.slice(0, 53) + "…" : gp.address;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(110, 110, 110);
      doc.text(shortAddr, pageW - margin - 4, y + 14, { align: "right" });
    }

    // Row 3 — rating bar (full width) with benchmark at 4.5/5
    if (gp.rating !== undefined) {
      const ratingColor = gp.rating >= 4.5 ? "#22c55e" : gp.rating >= 4.0 ? "#f59e0b" : "#ef4444";
      const ratingBarX = margin + 4;
      const ratingBarW = contentW - 8;
      drawScoreBar(doc, ratingBarX, y + 17, ratingBarW, 3.5, (gp.rating / 5) * 100, ratingColor);
      // Benchmark marker at 4.5/5
      const bx = ratingBarX + (4.5 / 5) * ratingBarW;
      doc.setDrawColor(140, 140, 140);
      doc.setLineWidth(0.4);
      doc.line(bx, y + 16, bx, y + 22);
      doc.setFontSize(5.5);
      doc.setTextColor(140, 140, 140);
      doc.text("4.5", bx, y + 24, { align: "center" });
    }

    y += gpCardH + 7;
  }

  // ── Personalized Hook ───────────────────────────────────────────────
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  doc.text(`Dear ${businessName},`, margin, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(55, 55, 55);
  const hookLines = doc.splitTextToSize(pitch.personalizedHook || "", contentW);
  doc.text(hookLines, margin, y);
  y += hookLines.length * 5 + 6;

  // ── What We Discovered ─────────────────────────────────────────────
  const findingsBgH = 8 + (pitch.keyFindings?.length || 0) * 9 + ((pitch.hiddenFindingsCount || 0) > 0 ? 9 : 0) + 4;
  if (y + findingsBgH > pageH - 40) {
    doc.addPage();
    y = 25;
  }

  doc.setFillColor(241, 245, 255);
  doc.roundedRect(margin, y, contentW, findingsBgH, 3, 3, "F");

  y += 6;
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(primary.r, primary.g, primary.b);
  doc.text("WHAT WE DISCOVERED", margin + 5, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  for (let i = 0; i < (pitch.keyFindings?.length || 0); i++) {
    const f = pitch.keyFindings![i];
    // Numbered circle
    doc.setFillColor(primary.r, primary.g, primary.b);
    doc.circle(margin + 6, y - 1.5, 2.5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6.5);
    doc.text(String(i + 1), margin + 6, y - 0.5, { align: "center" });

    doc.setTextColor(40, 40, 40);
    doc.setFontSize(9);
    const fLines = doc.splitTextToSize(f, contentW - 16);
    doc.text(fLines, margin + 12, y);
    y += fLines.length * 5 + 2.5;
  }

  if ((pitch.hiddenFindingsCount || 0) > 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`+ ${pitch.hiddenFindingsCount} more opportunities we'd love to discuss.`, margin + 5, y);
    y += 9;
  } else {
    y += 2;
  }

  // ── Opportunity ────────────────────────────────────────────────────
  y += 4;
  if (y > pageH - 50) { doc.addPage(); y = 25; }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(primary.r, primary.g, primary.b);
  doc.text("THE OPPORTUNITY", margin, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(55, 55, 55);
  const oppLines = doc.splitTextToSize(pitch.opportunityParagraph || "", contentW);
  doc.text(oppLines, margin, y);
  y += oppLines.length * 5 + 6;

  // ── How We Help ────────────────────────────────────────────────────
  if (y > pageH - 60) { doc.addPage(); y = 25; }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(primary.r, primary.g, primary.b);
  doc.text(`HOW ${brand.name.toUpperCase()} CAN HELP`, margin, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (const bullet of (pitch.solutionBullets || [])) {
    doc.setFillColor(primary.r, primary.g, primary.b);
    doc.circle(margin + 2, y - 1.5, 1.3, "F");
    doc.setTextColor(40, 40, 40);
    const bLines = doc.splitTextToSize(bullet, contentW - 9);
    doc.text(bLines, margin + 6, y);
    y += bLines.length * 5 + 3;
  }

  // ── Expected Impact ────────────────────────────────────────────────
  y += 2;
  if (y > pageH - 55) { doc.addPage(); y = 25; }

  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(191, 219, 254);
  doc.setLineWidth(0.3);
  const impactBlockH = 6 + doc.splitTextToSize(pitch.impactParagraph || "", contentW - 10).length * 5 + 4;
  doc.roundedRect(margin, y, contentW, impactBlockH, 3, 3, "FD");

  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(primary.r, primary.g, primary.b);
  doc.text("EXPECTED IMPACT", margin + 5, y);
  y += 5.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(50, 50, 80);
  const impLines = doc.splitTextToSize(pitch.impactParagraph || "", contentW - 10);
  doc.text(impLines, margin + 5, y);
  y += impLines.length * 5 + 6;

  // ── CTA Box ────────────────────────────────────────────────────────
  const ctaBoxH = 26;
  if (y + ctaBoxH > pageH - 22) { doc.addPage(); y = 25; }

  doc.setFillColor(primary.r, primary.g, primary.b);
  doc.roundedRect(margin, y, contentW, ctaBoxH, 4, 4, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(pitch.ctaText || "Let's Talk About Your Growth", pageW / 2, y + 10, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(210, 220, 255);
  doc.text(pitch.ctaSubtext || "No commitment. Just a quick 20-minute conversation.", pageW / 2, y + 19, { align: "center" });

  y += ctaBoxH + 7;

  // ── Closing ────────────────────────────────────────────────────────
  doc.setTextColor(70, 70, 70);
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  const closeLines = doc.splitTextToSize(pitch.closingLine || "", contentW);
  doc.text(closeLines, margin, y);

  // ── Footer (every page) ─────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFillColor(primary.r, primary.g, primary.b);
    doc.rect(0, pageH - 11, pageW, 11, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text(`${brand.name}  ·  Powered by FlowSmartly AI`, pageW / 2, pageH - 4, { align: "center" });
    if (totalPages > 1) {
      doc.text(`Page ${p} of ${totalPages}`, pageW - margin, pageH - 4, { align: "right" });
    }
  }

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

async function generateServiceProposalPDFLegacy(
  proposal: ServiceProposalContent,
  brand: BrandInfo
): Promise<Buffer> {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const pageH = 297;
  const margin = 18;
  const contentW = pageW - margin * 2;
  const primaryHex = brand.primaryColor || "#2563eb";
  const primary = hexToRgb(primaryHex);

  const ensureRoom = (y: number, needed = 28) => {
    if (y + needed <= pageH - 18) return y;
    doc.addPage();
    return 24;
  };

  const header = (label: string) => {
    doc.setFillColor(primary.r, primary.g, primary.b);
    doc.rect(0, 0, pageW, 16, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(brand.name.toUpperCase(), margin, 10);
    doc.setFont("helvetica", "normal");
    doc.text(label.toUpperCase(), pageW - margin, 10, { align: "right" });
  };

  const sectionTitle = (title: string, y: number) => {
    y = ensureRoom(y, 18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(primary.r, primary.g, primary.b);
    doc.text(title, margin, y);
    doc.setDrawColor(primary.r, primary.g, primary.b);
    doc.setLineWidth(0.35);
    doc.line(margin, y + 2, pageW - margin, y + 2);
    return y + 8;
  };

  const paragraph = (text: string | undefined, y: number, size = 9) => {
    if (!text) return y;
    y = ensureRoom(y, 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(55, 55, 55);
    const lines = doc.splitTextToSize(text, contentW);
    doc.text(lines, margin, y);
    return y + lines.length * (size * 0.55) + 5;
  };

  const bullets = (items: string[], y: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.7);
    for (const item of items.filter(Boolean)) {
      y = ensureRoom(y, 12);
      doc.setFillColor(primary.r, primary.g, primary.b);
      doc.circle(margin + 2, y - 1.7, 1.15, "F");
      doc.setTextColor(45, 45, 45);
      const lines = doc.splitTextToSize(item, contentW - 8);
      doc.text(lines, margin + 7, y);
      y += lines.length * 4.8 + 2.5;
    }
    return y + 2;
  };

  // Cover
  doc.setFillColor(primary.r, primary.g, primary.b);
  doc.rect(0, 0, pageW, pageH, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(brand.name.toUpperCase(), margin, 26);

  if (brand.logo) {
    try {
      const logoW = 44;
      const logoH = logoW / (brand.logoAspectRatio || 3);
      const fmt = brand.logo.includes("jpeg") || brand.logo.includes("jpg") ? "JPEG" : brand.logo.includes("webp") ? "WEBP" : "PNG";
      doc.addImage(brand.logo, fmt, margin, 32, logoW, Math.min(24, logoH));
    } catch {
      // Text logo above remains.
    }
  }

  doc.setFontSize(34);
  doc.text("Business", margin, 96);
  doc.text("Development", margin, 113);
  doc.text("Proposal", margin, 130);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(proposal.serviceTitle, margin, 148);
  doc.setFontSize(9);
  doc.text(`Prepared for ${proposal.preparedFor}`, margin, 159);
  doc.text(new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }), margin, 166);
  if (proposal.pricing.amount) {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin, 184, 74, 30, 5, 5, "F");
    doc.setTextColor(primary.r, primary.g, primary.b);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(`$${proposal.pricing.amount.toLocaleString()}`, margin + 8, 198);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`per ${proposal.pricing.interval || "project"}`, margin + 8, 206);
    if (proposal.pricing.originalAmount) {
      doc.text(`Promotional price from $${proposal.pricing.originalAmount.toLocaleString()}`, margin + 8, 211);
    }
  }
  doc.setFontSize(9);
  doc.setTextColor(230, 240, 255);
  doc.text(proposal.contact.website || brand.name, margin, pageH - 24);

  // About
  doc.addPage();
  header("About and vision");
  let y = 32;
  y = sectionTitle("About Us", y);
  y = paragraph(proposal.aboutBrand, y, 9.5);
  y = sectionTitle("Why This Matters", y + 4);
  y = paragraph(proposal.clientNeed, y, 9.5);
  y = sectionTitle("Executive Summary", y + 4);
  y = paragraph(proposal.executiveSummary, y, 9.5);

  // Commitments and benefits
  doc.addPage();
  header("Commitments");
  y = 32;
  y = sectionTitle("Our Commitments", y);
  y = bullets(proposal.commitments, y);
  y = sectionTitle("Business Benefits", y + 2);
  y = bullets(proposal.benefits, y);

  // Deliverables and timeline
  doc.addPage();
  header("Scope and timeline");
  y = 32;
  y = sectionTitle("What Is Included", y);
  for (const deliverable of proposal.deliverables) {
    y = ensureRoom(y, 24);
    doc.setFillColor(247, 249, 252);
    doc.roundedRect(margin, y - 5, contentW, 18, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(25, 25, 25);
    doc.text(deliverable.title, margin + 5, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.8);
    doc.setTextColor(80, 80, 80);
    doc.text(doc.splitTextToSize(deliverable.description, contentW - 10), margin + 5, y + 5);
    y += 21;
  }
  y = sectionTitle("Timeline", y + 3);
  for (const step of proposal.timeline) {
    y = ensureRoom(y, 18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(primary.r, primary.g, primary.b);
    doc.text(step.label, margin, y);
    doc.setTextColor(30, 30, 30);
    doc.text(step.title, margin + 28, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.8);
    doc.setTextColor(80, 80, 80);
    doc.text(doc.splitTextToSize(step.description, contentW - 28), margin + 28, y + 5);
    y += 17;
  }

  // Proof, terms, contact
  doc.addPage();
  header("Proof and next steps");
  y = 32;
  if (proposal.proofPoints.length) {
    y = sectionTitle("Expected Impact", y);
    const cardW = (contentW - 8) / 3;
    proposal.proofPoints.slice(0, 6).forEach((point, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = margin + col * (cardW + 4);
      const cy = y + row * 34;
      doc.setFillColor(247, 249, 252);
      doc.roundedRect(x, cy, cardW, 28, 3, 3, "F");
      doc.setTextColor(primary.r, primary.g, primary.b);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(point.metric, x + 4, cy + 10);
      doc.setTextColor(35, 35, 35);
      doc.setFontSize(7.5);
      doc.text(doc.splitTextToSize(point.label, cardW - 8), x + 4, cy + 16);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(110, 110, 110);
      doc.text(doc.splitTextToSize(point.note, cardW - 8).slice(0, 2), x + 4, cy + 22);
    });
    y += Math.ceil(Math.min(proposal.proofPoints.length, 6) / 3) * 34 + 6;
  }

  y = sectionTitle("Pricing", y);
  const pricing = proposal.pricing;
  const priceLine = pricing.amount
    ? `${pricing.name}: $${pricing.amount.toLocaleString()} / ${pricing.interval || "project"}`
    : pricing.name;
  y = paragraph(
    `${priceLine}${pricing.originalAmount ? ` (promotional price from $${pricing.originalAmount.toLocaleString()})` : ""}. ${pricing.note || ""}`,
    y,
    9.5,
  );

  y = sectionTitle("Terms and Conditions", y + 2);
  y = bullets(proposal.terms, y);
  y = sectionTitle("Next Steps", y + 2);
  y = bullets(proposal.nextSteps, y);

  y = sectionTitle("Contact", y + 2);
  y = paragraph(
    [
      proposal.contact.name || proposal.preparedBy,
      proposal.contact.email,
      proposal.contact.phone,
      proposal.contact.website,
      proposal.contact.address,
    ].filter(Boolean).join("  |  "),
    y,
    9,
  );

  const totalPages = doc.getNumberOfPages();
  for (let p = 2; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFillColor(primary.r, primary.g, primary.b);
    doc.rect(0, pageH - 10, pageW, 10, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.text(`${brand.name} - Service Proposal`, margin, pageH - 4);
    doc.text(`Page ${p} of ${totalPages}`, pageW - margin, pageH - 4, { align: "right" });
  }

  return Buffer.from(doc.output("arraybuffer"));
}

export async function generateServiceProposalPDF(
  proposal: ServiceProposalContent,
  brand: BrandInfo
): Promise<Buffer> {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: [1440, 810] });
  const pageW = 1440;
  const pageH = 810;
  const margin = 76;
  const design = proposal.design || {};
  const colors = design.colorPalette || {};
  const primaryHex = normalizeHex(colors.primary || brand.primaryColor, "#0ea5e9");
  const secondaryHex = normalizeHex(colors.secondary || brand.secondaryColor, "#8b5cf6");
  const accentHex = normalizeHex(colors.accent || brand.accentColor, "#ef4444");
  const inkHex = normalizeHex(colors.ink, "#0f172a");
  const primary = hexToRgb(primaryHex);
  const secondary = hexToRgb(secondaryHex);
  const accent = hexToRgb(accentHex);
  const ink = hexToRgb(inkHex);
  const navy = hexToRgb("#082f6f");
  const red = hexToRgb("#d90416");
  const softInk = { r: 31, g: 42, b: 64 };
  const softPrimary = mixRgb(primaryHex, 0.88);
  const softSecondary = mixRgb(secondaryHex, 0.88);
  const softAccent = mixRgb(accentHex, 0.82);

  const deckPlan = proposal.deckPlan;
  const slideFor = (role: ProposalDeckSlideRole): ProposalDeckSlide | undefined =>
    deckPlan?.slides?.find((slide) => slide.role === role);
  const visual = (kind: "cover" | "about" | "impact") =>
    proposal.visualAssets?.images?.find((asset) => asset.kind === kind)?.url;

  const fallbackByKind: Record<"cover" | "about" | "impact", string> = {
    cover: proposal.preset === "google-business-profile"
      ? "/proposal-assets/pregenerated/mobile-local-store-reviews.png"
      : "/proposal-assets/pregenerated/growth-leader-bars-wide.png",
    about: "/proposal-assets/pregenerated/dashboard-growth-consultant.png",
    impact: proposal.preset === "website-redesign"
      ? "/proposal-assets/pregenerated/strategy-dashboard-consultant.png"
      : "/proposal-assets/pregenerated/chart-growth-analytics.png",
  };

  const selectCutout = async (kind: "cover" | "about" | "impact") => {
    const generated = await resolvePdfImage(visual(kind));
    const fallback = await resolvePdfImage(fallbackByKind[kind]);
    if (generated?.hasAlpha) return generated;
    return fallback || generated;
  };

  const plannedVisualUrls = Array.from(new Set(
    (deckPlan?.slides || [])
      .flatMap((slide) => slide.visuals || [])
      .map((visualItem) => visualItem.url)
      .filter(Boolean),
  ));

  const [coverImage, aboutImage, impactImage, commerceImage, creatorImage, growthSceneImage, pricingTagImage, ...plannedImages] = await Promise.all([
    selectCutout("cover"),
    selectCutout("about"),
    selectCutout("impact"),
    resolvePdfImage("/proposal-assets/pregenerated/local-store-price-growth.png"),
    resolvePdfImage("/proposal-assets/pregenerated/strategy-dashboard-consultant.png"),
    resolvePdfImage("/proposal-assets/pregenerated/chart-growth-analytics.png"),
    resolvePdfImage("/proposal-assets/pregenerated/red-pricing-tag-blank.png"),
    ...plannedVisualUrls.map((url) => resolvePdfImage(url)),
  ]);

  const plannedImageByUrl = new Map<string, ResolvedPdfImage | null>(
    plannedVisualUrls.map((url, index) => [url, plannedImages[index] || null]),
  );

  const slideImages = (role: ProposalDeckSlideRole, fallbacks: Array<ResolvedPdfImage | null>) => {
    const slide = slideFor(role);
    const wantsTwo = slide?.layout === "two-visuals" && (role === "about" || role === "benefits");
    const planned = (slideFor(role)?.visuals || [])
      .map((visualItem) => plannedImageByUrl.get(visualItem.url))
      .filter(Boolean) as ResolvedPdfImage[];
    const unique = [...planned, ...fallbacks.filter(Boolean)].filter((image, index, images) => {
      if (!image) return false;
      return images.findIndex((candidate) => candidate?.dataUri === image.dataUri) === index;
    }) as ResolvedPdfImage[];
    return unique.slice(0, wantsTwo ? 2 : 1);
  };

  const addRawImage = (image: ResolvedPdfImage | null, x: number, y: number, w: number, h: number) => {
    if (!image) return false;
    try {
      doc.addImage(image.dataUri, imageFormat(image.dataUri), x, y, w, h);
      return true;
    } catch (error) {
      console.warn("[proposal pdf] Could not place image:", error);
      return false;
    }
  };

  const addFitImage = (
    image: ResolvedPdfImage | null,
    x: number,
    y: number,
    w: number,
    h: number,
    options: { alignX?: number; alignY?: number; shadow?: boolean } = {},
  ) => {
    if (!image) return false;
    const ratio = image.width && image.height ? image.width / image.height : w / h;
    let drawW = w;
    let drawH = w / ratio;
    if (drawH > h) {
      drawH = h;
      drawW = h * ratio;
    }
    const dx = x + (w - drawW) * (options.alignX ?? 0.5);
    const dy = y + (h - drawH) * (options.alignY ?? 0.5);
    if (options.shadow) {
      doc.setFillColor(224, 232, 244);
      doc.ellipse(dx + drawW / 2, dy + drawH - 18, Math.min(drawW * 0.32, 180), 18, "F");
    }
    return addRawImage(image, dx, dy, drawW, drawH);
  };

  const addHeroImage = (
    image: ResolvedPdfImage | null,
    x: number,
    y: number,
    w: number,
    h: number,
    options: { alignX?: number; alignY?: number; shadow?: boolean } = {},
  ) => addFitImage(image, x, y, w, h, { alignX: options.alignX, alignY: options.alignY, shadow: options.shadow ?? true });

  const visualPanel = (
    image: ResolvedPdfImage | null,
    x: number,
    y: number,
    w: number,
    h: number,
    options: { pad?: number; fill?: { r: number; g: number; b: number }; accent?: boolean; alignY?: number } = {},
  ) => {
    const pad = options.pad ?? 22;
    const fill = options.fill || { r: 248, g: 251, b: 255 };
    doc.setFillColor(fill.r, fill.g, fill.b);
    doc.setDrawColor(224, 232, 244);
    doc.setLineWidth(1.2);
    doc.roundedRect(x, y, w, h, 26, 26, "FD");
    if (options.accent) {
      doc.setFillColor(primary.r, primary.g, primary.b);
      doc.roundedRect(x + 24, y + 24, 96, 10, 5, 5, "F");
      doc.setFillColor(red.r, red.g, red.b);
      doc.circle(x + w - 38, y + 36, 8, "F");
    }
    return addFitImage(image, x + pad, y + pad, w - pad * 2, h - pad * 2, { alignY: options.alignY ?? 0.5 });
  };

  const logo = (x: number, y: number, maxW = 220, maxH = 70, light = false) => {
    if (brand.logo) {
      try {
        const ratio = brand.logoAspectRatio || 3;
        const w = Math.min(maxW, maxH * ratio);
        const h = Math.min(maxH, w / ratio);
        doc.addImage(brand.logo, imageFormat(brand.logo), x, y, w, h);
        return;
      } catch {
        // Fall through to text.
      }
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.setTextColor(light ? 255 : ink.r, light ? 255 : ink.g, light ? 255 : ink.b);
    doc.text(brand.name, x, y + 34);
  };

  const setColor = (color: { r: number; g: number; b: number }) => {
    doc.setTextColor(color.r, color.g, color.b);
  };

  const clean = (value: unknown) => pdfSafeText(value);
  const truncateClean = (value: unknown, max = 180) => {
    const text = clean(value);
    if (text.length <= max) return text;
    const cut = text.slice(0, max).trim();
    const sentenceEnd = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("!"), cut.lastIndexOf("?"));
    if (sentenceEnd > Math.floor(max * 0.45)) return cut.slice(0, sentenceEnd + 1);
    return `${cut.replace(/\s+\S*$/, "")}...`;
  };
  const shortText = (value: unknown, max = 105) => {
    const text = clean(value);
    if (text.length <= max) return text;
    return `${text.slice(0, max).replace(/\s+\S*$/, "")}...`;
  };
  const fitTextToLines = (value: unknown, w: number, size: number, maxLines: number) => {
    const maxChars = Math.max(48, Math.floor((w / Math.max(size, 1)) * maxLines * 2.15));
    let text = truncateClean(value, maxChars);
    let lines = doc.splitTextToSize(text, w);
    while (lines.length > maxLines && text.length > 48) {
      text = truncateClean(text.replace(/\.\.\.$/, ""), Math.floor(text.length * 0.86));
      lines = doc.splitTextToSize(text, w);
    }
    return text;
  };
  const coverServiceTitle = shortText(
    clean(slideFor("cover")?.subhead || proposal.serviceTitle || proposal.title)
      .replace(/\s*-\s*Monthly Growth Package$/i, "")
      .replace(/\s*Monthly Growth Package$/i, ""),
    74,
  );
  const imageRatio = (image: ResolvedPdfImage | null, fallback = 1.5) =>
    image?.width && image.height ? image.width / image.height : fallback;
  const aboutIsPortrait = imageRatio(aboutImage) < 0.95;

  const website = clean(proposal.contact.website || "www.flowsmartly.com");
  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const price = proposal.pricing?.amount;
  const priceText = typeof price === "number" ? `$${price.toLocaleString()}` : "Custom";
  const interval = clean(proposal.pricing?.interval || "month");

  const drawDots = (x: number, y: number, rows = 6, cols = 12, color = softPrimary) => {
    doc.setFillColor(color.r, color.g, color.b);
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        doc.circle(x + col * 18, y + row * 18, 3, "F");
      }
    }
  };

  const drawCityGhost = () => {
    doc.setDrawColor(238, 241, 246);
    doc.setLineWidth(2);
    for (let x = 120; x < pageW; x += 150) {
      const top = 40 + (x % 280);
      doc.line(x, top, x - 110, pageH - 80);
      doc.line(x + 58, top + 8, x - 38, pageH - 80);
      for (let y = top + 45; y < pageH - 120; y += 44) {
        doc.line(x - 24, y, x + 42, y);
      }
    }
  };

  const base = (page?: number, pageCorner: "tl" | "br" = "br") => {
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageW, pageH, "F");
    drawCityGhost();
    doc.setFillColor(246, 249, 252);
    doc.circle(1300, 62, 46, "F");
    drawDots(pageW - 250, pageH - 150, 6, 12, { r: 218, g: 229, b: 243 });
    doc.setDrawColor(navy.r, navy.g, navy.b);
    doc.setLineWidth(42);
    doc.circle(525, pageH + 120, 150, "S");
    if (page) {
      const label = String(page).padStart(2, "0");
      const x = pageCorner === "tl" ? 0 : pageW - 78;
      const y = pageCorner === "tl" ? 0 : pageH - 78;
      doc.setFillColor(red.r, red.g, red.b);
      doc.rect(x, y, 78, 78, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(34);
      doc.setTextColor(255, 255, 255);
      doc.text(label, x + 39, y + 50, { align: "center" });
    }
  };

  const footer = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(19);
    doc.setTextColor(softInk.r, softInk.g, softInk.b);
    doc.text(website, margin, pageH - 38);
  };

  const h1 = (text: string, x = margin, y = 150, w = 760, size = 64, maxLines = 3) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(ink.r, ink.g, ink.b);
    let actualSize = size;
    doc.setFontSize(actualSize);
    let lines = doc.splitTextToSize(clean(text), w);
    while (lines.length > maxLines && actualSize > 42) {
      actualSize -= 4;
      doc.setFontSize(actualSize);
      lines = doc.splitTextToSize(clean(text), w);
    }
    doc.setFontSize(actualSize);
    doc.text(lines, x, y);
    return y + lines.length * actualSize * 0.92;
  };

  const h2 = (text: string, x: number, y: number, color = ink, size = 42) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.setTextColor(color.r, color.g, color.b);
    doc.text(clean(text), x, y);
  };

  const button = (text: string, x: number, y: number, w: number, h: number, fill = red) => {
    doc.setFillColor(fill.r, fill.g, fill.b);
    doc.roundedRect(x, y, w, h, h / 2, h / 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(35);
    doc.text(clean(text), x + w / 2, y + h * 0.66, { align: "center" });
  };

  const para = (
    text: string | undefined,
    x: number,
    y: number,
    w: number,
    size = 27,
    color = softInk,
    leading = 1.3,
    maxLines?: number,
  ) => {
    if (!text) return y;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(color.r, color.g, color.b);
    const source = maxLines ? fitTextToLines(text, w, size, maxLines) : clean(text);
    const lines = doc.splitTextToSize(source, w).slice(0, maxLines || 99);
    doc.text(lines, x, y);
    return y + lines.length * size * leading;
  };

  const timelineBullets = (items: string[], x: number, y: number, w: number, limit = 5) => {
    const rowH = 68;
    doc.setDrawColor(navy.r, navy.g, navy.b);
    doc.setLineWidth(3);
    doc.line(x + 9, y - 12, x + 9, y + Math.min(items.length, limit) * rowH - 12);
    items.slice(0, limit).forEach((item, index) => {
      const cy = y + index * rowH;
      doc.setFillColor(red.r, red.g, red.b);
      doc.circle(x + 9, cy - 12, 7, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(21);
      doc.setTextColor(softInk.r, softInk.g, softInk.b);
      doc.text(doc.splitTextToSize(shortText(item, 86), w - 44).slice(0, 2), x + 42, cy);
    });
  };

  const cleanBullets = (items: Array<string | undefined | null>, fallback: string[] = []) =>
    (items.length ? items : fallback)
      .map((item) => clean(item))
      .filter(Boolean);

  const slideHeadline = (role: ProposalDeckSlideRole, fallback: string) =>
    clean(slideFor(role)?.headline) || fallback;

  const slideBody = (role: ProposalDeckSlideRole, fallback = "") =>
    clean(slideFor(role)?.body) || fallback;

  const slideBullets = (role: ProposalDeckSlideRole, fallback: string[] = []) =>
    cleanBullets(slideFor(role)?.bullets || [], fallback);

  const boldLead = (text: string) => {
    const parts = text.split(":");
    return parts.length > 1 ? { lead: parts[0], rest: parts.slice(1).join(":").trim() } : { lead: text, rest: "" };
  };

  const bigBulletList = (
    items: string[],
    x: number,
    y: number,
    w: number,
    options: { limit?: number; rowH?: number; size?: number; bold?: boolean; maxLines?: number } = {},
  ) => {
    const limit = options.limit ?? 7;
    const rowH = options.rowH ?? 50;
    const size = options.size ?? 25;
    const maxLines = options.maxLines ?? 2;
    const count = Math.min(items.length, limit);
    doc.setDrawColor(navy.r, navy.g, navy.b);
    doc.setLineWidth(3);
    doc.line(x + 8, y - 10, x + 8, y + count * rowH - 24);
    items.slice(0, limit).forEach((item, index) => {
      const cy = y + index * rowH;
      doc.setFillColor(red.r, red.g, red.b);
      doc.circle(x + 8, cy - 9, 7, "F");
      doc.setFont("helvetica", options.bold ? "bold" : "normal");
      doc.setFontSize(size);
      doc.setTextColor(softInk.r, softInk.g, softInk.b);
      const bulletText = fitTextToLines(item, w - 42, size, maxLines);
      doc.text(doc.splitTextToSize(bulletText, w - 42).slice(0, maxLines), x + 40, cy, { lineHeightFactor: 1.12 });
    });
  };

  const card = (x: number, y: number, w: number, h: number, fill = { r: 255, g: 255, b: 255 }) => {
    doc.setFillColor(fill.r, fill.g, fill.b);
    doc.setDrawColor(225, 231, 240);
    doc.setLineWidth(1.1);
    doc.roundedRect(x, y, w, h, 16, 16, "FD");
  };

  const titleBar = (text: string, x: number, y: number, w: number, h: number, fill = red, size = 38) => {
    doc.setFillColor(fill.r, fill.g, fill.b);
    doc.roundedRect(x, y, w, h, 24, 24, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    let actualSize = size;
    doc.setFontSize(actualSize);
    let fitted = fitTextToLines(text, w - 72, actualSize, 2);
    let lines = doc.splitTextToSize(fitted, w - 72).slice(0, 2);
    while ((lines.length > 2 || lines.length * actualSize * 1.02 > h - 18) && actualSize > 26) {
      actualSize -= 2;
      fitted = fitTextToLines(text, w - 72, actualSize, 2);
      doc.setFontSize(actualSize);
      lines = doc.splitTextToSize(fitted, w - 72).slice(0, 2);
    }
    const lineHeight = actualSize * 0.98;
    const startY = y + (h - (lines.length - 1) * lineHeight) / 2 + actualSize * 0.34;
    doc.text(lines, x + 36, startY, { lineHeightFactor: 0.98 });
  };

  const drawMetricCard = (
    x: number,
    y: number,
    w: number,
    h: number,
    metric: string,
    label: string,
    note: string,
  ) => {
    card(x, y, w, h);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(38);
    doc.setTextColor(primary.r, primary.g, primary.b);
    doc.text(clean(metric), x + 24, y + 52);
    doc.setFontSize(21);
    setColor(ink);
    doc.text(doc.splitTextToSize(clean(label), w - 48).slice(0, 2), x + 24, y + 86);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(14);
    doc.setTextColor(88, 99, 120);
    doc.text(doc.splitTextToSize(shortText(note, 54), w - 48).slice(0, 1), x + 24, y + 116);
  };

  const drawMetricRing = (x: number, y: number, metric: string, label: string, color: { r: number; g: number; b: number }) => {
    doc.setDrawColor(220, 226, 235);
    doc.setLineWidth(12);
    doc.circle(x, y, 52, "S");
    doc.setDrawColor(color.r, color.g, color.b);
    doc.setLineWidth(12);
    doc.circle(x, y, 52, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(clean(metric).length > 5 ? 22 : 26);
    doc.setTextColor(ink.r, ink.g, ink.b);
    doc.text(shortText(metric, 8), x, y + 8, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(14);
    doc.setTextColor(88, 99, 120);
    doc.text(doc.splitTextToSize(shortText(label, 40), 138).slice(0, 2), x, y + 76, { align: "center", lineHeightFactor: 1.08 });
  };

  const coverVisuals = slideImages("cover", [coverImage]);
  const aboutVisuals = slideImages("about", [aboutImage, impactImage || coverImage]);
  const commitmentVisuals = slideImages("commitments", [impactImage, coverImage]);
  const benefitVisuals = slideImages("benefits", [creatorImage || aboutImage, commerceImage || coverImage]);
  const proofVisuals = slideImages("proof", [growthSceneImage || impactImage, coverImage]);
  const termsVisuals = slideImages("terms", [pricingTagImage || impactImage, aboutImage]);
  const closingVisuals = slideImages("closing", [commerceImage || aboutImage, coverImage]);

  // Page 1: cover
  base();
  doc.setFillColor(primary.r, primary.g, primary.b);
  doc.circle(pageW - 40, -10, 230, "F");
  doc.setFillColor(secondary.r, secondary.g, secondary.b);
  doc.circle(pageW - 88, 62, 190, "F");
  logo(margin, 58, 250, 78);
  const coverTitleEnd = h1(slideHeadline("cover", "Business Development Proposal"), margin, 286, 610, 60, 3);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(34);
  setColor(softInk);
  const serviceLines = doc.splitTextToSize(coverServiceTitle, 570).slice(0, 2);
  doc.text(serviceLines, margin, Math.min(coverTitleEnd + 34, 550), { lineHeightFactor: 1.08 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(21);
  doc.setTextColor(88, 99, 120);
  doc.text(`Prepared for ${clean(proposal.preparedFor)}  |  ${today}`, margin, 170);
  button("Visit Us", margin, 666, 205, 64, red);
  footer();
  doc.setFillColor(navy.r, navy.g, navy.b);
  doc.circle(820, pageH + 115, 210, "F");
  addHeroImage(coverVisuals[0] || coverImage, 690, 140, 690, 520, { alignY: 0.52 });

  // Page 2: about and need
  doc.addPage();
  base(2);
  const aboutTitleEnd = h1(slideHeadline("about", "About Us"), margin, 135, 570, 56, 3);
  const aboutBarY = Math.max(265, aboutTitleEnd + 28);
  titleBar(clean(slideFor("about")?.subhead) || "Built to Grow Local Businesses", margin, aboutBarY, 610, 90, red, 33);
  para(slideBody("about", proposal.aboutBrand), margin, aboutBarY + 138, 820, 23, softInk, 1.28, 4);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(25);
  setColor(ink);
  doc.text("Client Need", margin, 606);
  para(proposal.clientNeed, margin, 644, 820, 21, softInk, 1.2, 2);
  if (aboutIsPortrait) {
    addHeroImage(aboutVisuals[0] || aboutImage, 760, 95, 335, 575, { alignY: 0.56 });
    addHeroImage(aboutVisuals[1] || impactImage || coverImage, 1080, 155, 300, 210, { shadow: false });
    addHeroImage(coverImage || impactImage, 1030, 405, 365, 250, { shadow: false });
  } else {
    addHeroImage(aboutVisuals[0] || aboutImage, 775, 78, 505, 338, { alignY: 0.55 });
    addHeroImage(aboutVisuals[1] || impactImage || coverImage, 810, 448, 500, 235, { shadow: false });
  }
  footer();

  // Page 3: commitments
  doc.addPage();
  base(3, "tl");
  const commitmentsTitleEnd = h1(slideHeadline("commitments", "Our Commitments"), margin + 10, 145, 740, 58, 3);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  setColor(softInk);
  const commitmentsSubY = Math.max(250, commitmentsTitleEnd + 22);
  doc.text(`Perks & Benefits of ${clean(proposal.preparedBy || brand.name)}`, margin + 10, commitmentsSubY);
  timelineBullets(slideBullets("commitments", proposal.commitments), margin + 10, commitmentsSubY + 74, 670, 5);
  addHeroImage(commitmentVisuals[0] || impactImage, 795, 95, 585, 330, { shadow: false });
  doc.setFillColor(red.r, red.g, red.b);
  doc.roundedRect(845, 452, 455, 132, 28, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  const commitmentCallout = clean(slideFor("commitments")?.emphasis) || "No Contract | No Automatic Billing";
  const calloutLines = doc.splitTextToSize(commitmentCallout.replace(/\s+\|\s+/g, "\n"), 380).slice(0, 2);
  doc.text(calloutLines, 1072, calloutLines.length > 1 ? 504 : 528, { align: "center", lineHeightFactor: 1.45 });
  doc.setFillColor(navy.r, navy.g, navy.b);
  doc.roundedRect(910, 635, 360, 108, 28, 28, "F");
  doc.setFontSize(25);
  doc.text("Pricing", 1090, 678, { align: "center" });
  doc.setFontSize(34);
  doc.text(`${priceText}/${interval}`, 1090, 724, { align: "center" });

  // Page 4: benefits and deliverables
  doc.addPage();
  base(4);
  const benefitsTitleEnd = h1(slideHeadline("benefits", `Benefits of ${clean(proposal.serviceTitle || "the Service")}`), margin, 132, 760, 50, 3);
  const benefitItems = cleanBullets(
    slideBullets("benefits", proposal.deliverables.map((item) => item.title)),
    ["More qualified local leads", "Better online trust", "Cleaner reporting", "Consistent follow-up"],
  );
  bigBulletList(benefitItems, margin, Math.max(315, benefitsTitleEnd + 30), 660, { limit: 4, rowH: 70, size: 22 });
  const scopeSummary = proposal.deliverables
    .slice(0, 2)
    .map((item) => clean(item.description))
    .filter(Boolean)
    .join(" ");
  para(slideBody("benefits", scopeSummary), margin, 660, 780, 21, softInk, 1.22, 2);
  addHeroImage(benefitVisuals[0] || creatorImage || aboutImage, 765, 88, 575, 335, { alignY: 0.52, shadow: false });
  addHeroImage(benefitVisuals[1] || commerceImage || coverImage, 845, 440, 500, 260, { alignY: 0.5, shadow: false });
  footer();

  // Page 5: proof and timeline
  doc.addPage();
  base(5, "tl");
  const proofTitleEnd = h1(slideHeadline("proof", "Expected Impact"), margin + 10, 125, 760, 54, 3);
  para(slideBody("proof", "Realistic outcome ranges, not guaranteed results. The goal is practical local growth the client can see in calls, views, directions, and booked work."), margin + 10, proofTitleEnd + 28, 760, 21, softInk, 1.22, 2);
  const clientInsightPoints = (proposal.clientProfile?.insights || []).map((insight) => ({
    metric: insight.metric,
    label: insight.label,
    note: insight.note,
  }));
  const points = [...clientInsightPoints, ...proposal.proofPoints]
    .filter((point, index, all) => all.findIndex((item) => `${item.metric}:${item.label}` === `${point.metric}:${point.label}`) === index)
    .slice(0, 4);
  points.forEach((point, index) => {
    drawMetricRing(margin + 110 + index * 155, 405, point.metric, point.label, [primary, secondary, accent, red][index] || primary);
  });
  addHeroImage(proofVisuals[0] || growthSceneImage || coverImage, 795, 145, 560, 400, { shadow: false });
  h2("Launch Timeline", margin + 10, 660, ink, 34);
  (proposal.timeline || []).slice(0, 4).forEach((step, index) => {
    const x = margin + 288 + index * 236;
    card(x, 628, 205, 86, { r: 255, g: 255, b: 255 });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(primary.r, primary.g, primary.b);
    doc.text(clean(step.label), x + 18, 662);
    doc.setTextColor(ink.r, ink.g, ink.b);
    doc.text(doc.splitTextToSize(clean(step.title), 165).slice(0, 1), x + 18, 691);
  });
  footer();

  // Page 6: terms and next steps
  doc.addPage();
  base(6);
  const termsTitleEnd = h1(slideHeadline("terms", "Clear Expectations"), margin, 130, 660, 56, 3);
  const termsBarY = Math.max(258, termsTitleEnd + 20);
  titleBar(clean(slideFor("terms")?.subhead) || "What Happens Next", margin, termsBarY, 585, 82, primary, 33);
  const termItems = cleanBullets(proposal.terms || [], [
    "Service begins after access and onboarding details are received",
    "Month-to-month agreement with no long-term contract",
    "Reporting is delivered monthly",
    "Client approvals keep launch timing on track",
  ]);
  bigBulletList(slideBullets("terms", termItems), margin, termsBarY + 138, 705, { limit: 4, rowH: 70, size: 22 });
  const nextItems = cleanBullets(proposal.nextSteps || [], [
    "Confirm proposal acceptance",
    "Complete onboarding",
    "Share brand assets",
    "Schedule kickoff",
  ]);
  h2("Next Steps", 940, 260, ink, 36);
  bigBulletList(nextItems, 940, 330, 360, { limit: 4, rowH: 78, size: 20, bold: true, maxLines: 3 });
  addHeroImage(termsVisuals[0] || pricingTagImage || aboutImage || creatorImage, 1025, 615, 245, 150, { alignY: 0.55, shadow: false });
  footer();

  let closingPage = 7;
  const customSections = (proposal.customSections || [])
    .filter((section) => clean(section.title))
    .slice(0, 4);

  customSections.forEach((section) => {
    doc.addPage();
    base(closingPage);
    const customTitleEnd = h1(clean(section.title), margin, 135, 760, 54, 3);
    para(clean(section.body), margin, customTitleEnd + 30, 780, 23, softInk, 1.25, 4);
    const customBullets = cleanBullets(section.bullets || [], []);
    if (customBullets.length) {
      bigBulletList(customBullets, margin, Math.max(390, customTitleEnd + 160), 720, { limit: 5, rowH: 62, size: 21, maxLines: 2 });
    }
    addHeroImage(
      closingPage % 2 === 0 ? aboutImage || impactImage || coverImage : impactImage || aboutImage || coverImage,
      850,
      140,
      470,
      440,
      { shadow: false },
    );
    footer();
    closingPage += 1;
  });

  // Closing CTA
  doc.addPage();
  base(closingPage);
  logo(margin, 64, 250, 78);
  h1(slideHeadline("closing", "Ready to get found, trusted, and chosen?"), margin, 255, 720, 64);
  para(slideBody("closing", proposal.executiveSummary), margin, 430, 760, 28, softInk, 1.35, 5);
  button("Get Started", margin, 640, 250, 68, red);
  addFitImage(closingVisuals[0] || commerceImage || aboutImage, 840, 120, 470, 420, { shadow: true });
  card(845, 585, 410, 110, softAccent);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  setColor(ink);
  doc.text(clean(proposal.contact?.name || proposal.preparedBy || brand.name), 875, 625);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(18);
  doc.setTextColor(softInk.r, softInk.g, softInk.b);
  const contactLines = doc.splitTextToSize(
    [proposal.contact?.email, proposal.contact?.phone, proposal.contact?.website].filter(Boolean).map(clean).join("  |  "),
    345,
  ).slice(0, 2);
  doc.text(contactLines, 875, 665, { lineHeightFactor: 1.15 });
  footer();

  return Buffer.from(doc.output("arraybuffer"));
}
