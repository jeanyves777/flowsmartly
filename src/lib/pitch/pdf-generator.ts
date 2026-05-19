import type { PitchContent } from "./generator";
import type { ServiceProposalContent } from "./proposal-agent";
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

async function resolvePdfImageDataUri(src: string | undefined | null): Promise<string | null> {
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

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = 297;
  const pageH = 210;
  const margin = 16;
  const contentW = pageW - margin * 2;
  const design = proposal.design || {};
  const colors = design.colorPalette || {};
  const primaryHex = normalizeHex(colors.primary || brand.primaryColor, "#0ea5e9");
  const secondaryHex = normalizeHex(colors.secondary || brand.secondaryColor, "#8b5cf6");
  const accentHex = normalizeHex(colors.accent || brand.accentColor, "#f59e0b");
  const bgHex = normalizeHex(colors.background, "#f8fafc");
  const inkHex = normalizeHex(colors.ink, "#0f172a");
  const primary = hexToRgb(primaryHex);
  const secondary = hexToRgb(secondaryHex);
  const accent = hexToRgb(accentHex);
  const ink = hexToRgb(inkHex);
  const softPrimary = mixRgb(primaryHex, 0.9);
  const softSecondary = mixRgb(secondaryHex, 0.9);
  const softAccent = mixRgb(accentHex, 0.82);

  const visual = (kind: "cover" | "about" | "impact") =>
    proposal.visualAssets?.images?.find((asset) => asset.kind === kind)?.url;
  const [coverImage, aboutImage, impactImage] = await Promise.all([
    resolvePdfImageDataUri(visual("cover")),
    resolvePdfImageDataUri(visual("about")),
    resolvePdfImageDataUri(visual("impact")),
  ]);

  const addImage = (image: string | null, x: number, y: number, w: number, h: number) => {
    if (!image) return false;
    try {
      doc.addImage(image, imageFormat(image), x, y, w, h);
      return true;
    } catch (error) {
      console.warn("[proposal pdf] Could not place image:", error);
      return false;
    }
  };

  const logo = (x: number, y: number, maxW = 42, maxH = 16, light = false) => {
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
    doc.setFontSize(10);
    doc.setTextColor(light ? 255 : ink.r, light ? 255 : ink.g, light ? 255 : ink.b);
    doc.text(brand.name.toUpperCase(), x, y + 8);
  };

  const background = () => {
    const bg = hexToRgb(bgHex);
    doc.setFillColor(bg.r, bg.g, bg.b);
    doc.rect(0, 0, pageW, pageH, "F");
    doc.setFillColor(softPrimary.r, softPrimary.g, softPrimary.b);
    doc.circle(pageW - 24, 24, 45, "F");
    doc.setFillColor(softSecondary.r, softSecondary.g, softSecondary.b);
    doc.circle(28, pageH - 16, 38, "F");
    doc.setFillColor(softAccent.r, softAccent.g, softAccent.b);
    doc.roundedRect(pageW - 92, pageH - 18, 74, 6, 3, 3, "F");
    doc.setDrawColor(primary.r, primary.g, primary.b);
    doc.setLineWidth(0.6);
    doc.line(margin, 22, pageW - margin, 22);
  };

  const footer = (page: number, label: string) => {
    doc.setFillColor(primary.r, primary.g, primary.b);
    doc.rect(0, pageH - 10, pageW, 10, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.text(`${brand.name}  |  ${label}`, margin, pageH - 4);
    doc.text(String(page).padStart(2, "0"), pageW - margin, pageH - 4, { align: "right" });
  };

  const title = (text: string, subtitle?: string) => {
    background();
    logo(margin, 8, 38, 13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(ink.r, ink.g, ink.b);
    doc.setFontSize(24);
    doc.text(doc.splitTextToSize(text, 158), margin, 45);
    if (subtitle) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(70, 82, 104);
      doc.text(doc.splitTextToSize(subtitle, 155), margin, 66);
    }
  };

  const pill = (text: string, x: number, y: number, w: number, fill = accent) => {
    doc.setFillColor(fill.r, fill.g, fill.b);
    doc.roundedRect(x, y, w, 12, 6, 6, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(text, x + w / 2, y + 7.8, { align: "center" });
  };

  const para = (text: string | undefined, x: number, y: number, w: number, size = 9, color = { r: 51, g: 65, b: 85 }) => {
    if (!text) return y;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(color.r, color.g, color.b);
    const lines = doc.splitTextToSize(text, w);
    doc.text(lines, x, y);
    return y + lines.length * (size * 0.55) + 4;
  };

  const bulletList = (items: string[], x: number, y: number, w: number, limit = 8) => {
    doc.setDrawColor(primary.r, primary.g, primary.b);
    doc.setLineWidth(0.55);
    doc.line(x + 2, y - 4, x + 2, y + Math.min(items.length, limit) * 11);
    items.slice(0, limit).forEach((item, index) => {
      const cy = y + index * 11;
      doc.setFillColor(primary.r, primary.g, primary.b);
      doc.circle(x + 2, cy - 2.2, 1.5, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.4);
      doc.setTextColor(35, 45, 66);
      doc.text(doc.splitTextToSize(item, w - 10).slice(0, 2), x + 9, cy);
    });
  };

  const card = (x: number, y: number, w: number, h: number, fill = { r: 255, g: 255, b: 255 }) => {
    doc.setFillColor(fill.r, fill.g, fill.b);
    doc.setDrawColor(223, 230, 242);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, y, w, h, 5, 5, "FD");
  };

  // Page 1: cover
  doc.setFillColor(primary.r, primary.g, primary.b);
  doc.rect(0, 0, pageW, pageH, "F");
  doc.setFillColor(secondary.r, secondary.g, secondary.b);
  doc.triangle(pageW, 0, pageW, pageH, 112, pageH, "F");
  logo(margin, 16, 48, 18, true);
  pill("SERVICE PROPOSAL", margin, 45, 44, accent);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  doc.text(doc.splitTextToSize(proposal.title, 118), margin, 74);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(226, 240, 255);
  doc.text(doc.splitTextToSize(proposal.subtitle, 112), margin, 108);
  doc.setFontSize(8.5);
  doc.text(`Prepared for ${proposal.preparedFor}`, margin, 135);
  doc.text(new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }), margin, 143);
  const price = proposal.pricing?.amount;
  if (typeof price === "number") {
    card(margin, 154, 74, 29, { r: 255, g: 255, b: 255 });
    doc.setTextColor(primary.r, primary.g, primary.b);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(19);
    doc.text(`$${price.toLocaleString()}`, margin + 8, 168);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text(`per ${proposal.pricing.interval || "project"}`, margin + 8, 176);
    if (proposal.pricing.originalAmount) {
      doc.text(`Promo from $${proposal.pricing.originalAmount.toLocaleString()}`, margin + 33, 176);
    }
  }
  if (coverImage && addImage(coverImage, 152, 32, 122, 118)) {
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(1.2);
    doc.roundedRect(152, 32, 122, 118, 9, 9, "S");
  }
  doc.setFontSize(8);
  doc.setTextColor(230, 245, 255);
  doc.text(proposal.contact.website || brand.name, margin, pageH - 20);

  // Page 2: about and need
  doc.addPage();
  title(`About ${proposal.preparedBy || brand.name}`, design.themeName);
  card(margin, 78, 122, 75);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(primary.r, primary.g, primary.b);
  doc.text("Our Vision", margin + 8, 94);
  para(proposal.aboutBrand, margin + 8, 108, 106, 9.2);
  card(margin, 160, 122, 24, softAccent);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(ink.r, ink.g, ink.b);
  doc.text("Prepared for", margin + 8, 171);
  doc.setFontSize(13);
  doc.text(proposal.preparedFor, margin + 8, 179);
  addImage(aboutImage, 158, 50, 112, 92);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(ink.r, ink.g, ink.b);
  doc.text("Why This Matters", 158, 159);
  para(proposal.clientNeed, 158, 172, 112, 8.8);
  footer(2, "About and vision");

  // Page 3: commitments
  doc.addPage();
  title("Our Commitments", `Perks and benefits of ${proposal.preparedBy || brand.name}`);
  bulletList(proposal.commitments, margin, 82, 132, 10);
  card(172, 76, 94, 70, softPrimary);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(primary.r, primary.g, primary.b);
  doc.text("Offer Snapshot", 182, 95);
  doc.setTextColor(ink.r, ink.g, ink.b);
  doc.setFontSize(11);
  doc.text(doc.splitTextToSize(proposal.pricing?.name || proposal.serviceTitle, 72), 182, 108);
  if (typeof price === "number") {
    doc.setTextColor(primary.r, primary.g, primary.b);
    doc.setFontSize(24);
    doc.text(`$${price.toLocaleString()}`, 182, 130);
    doc.setFontSize(9);
    doc.text(`/${proposal.pricing.interval || "project"}`, 221, 130);
  }
  if (proposal.pricing?.note) para(proposal.pricing.note, 172, 158, 94, 8.2);
  footer(3, "Commitments");

  // Page 4: benefits and deliverables
  doc.addPage();
  title("Benefits and Scope", "What the client receives and why it matters.");
  bulletList(proposal.benefits, margin, 78, 118, 9);
  const dX = 152;
  const deliverables = proposal.deliverables.slice(0, 6);
  deliverables.forEach((item, index) => {
    const y = 66 + index * 20;
    card(dX, y, 118, 15, index % 2 === 0 ? { r: 255, g: 255, b: 255 } : softPrimary);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2);
    doc.setTextColor(ink.r, ink.g, ink.b);
    doc.text(item.title, dX + 6, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.7);
    doc.setTextColor(72, 84, 104);
    doc.text(doc.splitTextToSize(item.description, 104).slice(0, 2), dX + 6, y + 11);
  });
  footer(4, "Benefits and scope");

  // Page 5: proof and timeline
  doc.addPage();
  title("Expected Impact", "Realistic outcome ranges, not guaranteed results.");
  addImage(impactImage, margin, 63, 112, 88);
  const points = proposal.proofPoints.slice(0, 6);
  points.forEach((point, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = 144 + col * 43;
    const y = 68 + row * 42;
    card(x, y, 36, 32, row === 0 ? softSecondary : { r: 255, g: 255, b: 255 });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(primary.r, primary.g, primary.b);
    doc.text(pdfSafeText(point.metric), x + 5, y + 11);
    doc.setFontSize(7);
    doc.setTextColor(ink.r, ink.g, ink.b);
    doc.text(doc.splitTextToSize(point.label, 27).slice(0, 2), x + 5, y + 19);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.8);
    doc.setTextColor(86, 98, 116);
    doc.text(doc.splitTextToSize(point.note, 27).slice(0, 2), x + 5, y + 27);
  });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(ink.r, ink.g, ink.b);
  doc.text("Launch Timeline", margin, 168);
  (proposal.timeline || []).slice(0, 4).forEach((step, index) => {
    const x = margin + index * 65;
    card(x, 176, 56, 17, { r: 255, g: 255, b: 255 });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.7);
    doc.setTextColor(primary.r, primary.g, primary.b);
    doc.text(pdfSafeText(step.label), x + 5, 183);
    doc.setTextColor(ink.r, ink.g, ink.b);
    doc.text(doc.splitTextToSize(step.title, 45).slice(0, 1), x + 5, 189);
  });
  footer(5, "Proof and timeline");

  // Page 6: terms and next steps
  doc.addPage();
  title("Terms and Next Steps", "Clear expectations before work begins.");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(ink.r, ink.g, ink.b);
  doc.text("Terms", margin, 74);
  bulletList(proposal.terms, margin, 88, 132, 7);
  doc.text("Next Steps", 166, 74);
  (proposal.nextSteps || []).slice(0, 5).forEach((step, index) => {
    const y = 86 + index * 18;
    doc.setFillColor(primary.r, primary.g, primary.b);
    doc.circle(170, y - 2, 4, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(String(index + 1), 170, y, { align: "center" });
    doc.setTextColor(45, 55, 75);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.4);
    doc.text(doc.splitTextToSize(step, 98).slice(0, 2), 180, y);
  });
  card(166, 166, 104, 22, softAccent);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(ink.r, ink.g, ink.b);
  doc.text("Contact", 174, 177);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.4);
  doc.text(
    [proposal.contact?.email, proposal.contact?.phone, proposal.contact?.website].filter(Boolean).join("  |  "),
    174,
    185,
  );
  footer(6, "Terms and next steps");

  return Buffer.from(doc.output("arraybuffer"));
}
