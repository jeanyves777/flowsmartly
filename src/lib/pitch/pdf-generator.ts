import type { PitchContent } from "./generator";
import type { ResearchData } from "./researcher";

interface BrandInfo {
  name: string;
  primaryColor?: string;
}

// Wrap text to fit within a max width, returns array of lines
function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length <= maxCharsPerLine) {
      current = (current + " " + word).trim();
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function generatePitchPDF(
  pitch: PitchContent,
  research: ResearchData,
  businessName: string,
  brand: BrandInfo
): Promise<Buffer> {
  // Dynamic import for server-side usage (jsPDF uses browser APIs by default,
  // but jspdf@4+ supports Node.js via the "node" export)
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageW = 210;
  const pageH = 297;
  const margin = 20;
  const contentW = pageW - margin * 2;
  const primaryHex = brand.primaryColor || "#2563eb";

  // Parse hex to RGB
  const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  };
  const primary = hexToRgb(primaryHex);

  // ─── PAGE 1 ───────────────────────────────────────────────────────
  // Header bar
  doc.setFillColor(primary.r, primary.g, primary.b);
  doc.rect(0, 0, pageW, 22, "F");

  // FlowSmartly name in header
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("FLOWSMARTLY", margin, 14);

  // Confidential tag on right
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("CONFIDENTIAL PROPOSAL", pageW - margin, 14, { align: "right" });

  // Headline
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");

  let y = 38;
  const headlineLines = wrapText(pitch.headline, 55);
  for (const line of headlineLines) {
    doc.text(line, margin, y);
    y += 9;
  }

  // Prepared for
  y += 3;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`Prepared exclusively for: ${businessName}`, margin, y);
  y += 5;
  doc.text(`Date: ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`, margin, y);

  // Divider
  y += 8;
  doc.setDrawColor(primary.r, primary.g, primary.b);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);

  // Personalized hook
  y += 10;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("Dear " + (businessName || "Business Owner") + ",", margin, y);

  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  const hookLines = doc.splitTextToSize(pitch.personalizedHook, contentW);
  doc.text(hookLines, margin, y);
  y += hookLines.length * 5.5 + 5;

  // Section: What We Found
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(margin, y, contentW, 8 + pitch.keyFindings.length * 9 + (pitch.hiddenFindingsCount > 0 ? 9 : 0) + 4, 3, 3, "F");
  y += 6;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(primary.r, primary.g, primary.b);
  doc.text("WHAT WE DISCOVERED", margin + 5, y);
  y += 7;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40, 40, 40);
  for (const finding of pitch.keyFindings) {
    doc.setTextColor(primary.r, primary.g, primary.b);
    doc.text("▸", margin + 5, y);
    doc.setTextColor(40, 40, 40);
    const fLines = doc.splitTextToSize(finding, contentW - 15);
    doc.text(fLines, margin + 11, y);
    y += fLines.length * 5.5 + 2;
  }

  if (pitch.hiddenFindingsCount > 0) {
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 100, 100);
    doc.text(`+ ${pitch.hiddenFindingsCount} more opportunities we'd love to discuss with you.`, margin + 5, y);
    y += 9;
  }

  // Section: The Opportunity
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(primary.r, primary.g, primary.b);
  doc.text("THE OPPORTUNITY", margin, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  const oppLines = doc.splitTextToSize(pitch.opportunityParagraph, contentW);
  doc.text(oppLines, margin, y);
  y += oppLines.length * 5.5 + 6;

  // Section: How We Help
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(primary.r, primary.g, primary.b);
  doc.text("HOW FLOWSMARTLY CAN HELP", margin, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (const bullet of pitch.solutionBullets) {
    doc.setTextColor(primary.r, primary.g, primary.b);
    doc.circle(margin + 2, y - 1.5, 1.2, "F");
    doc.setTextColor(40, 40, 40);
    const bLines = doc.splitTextToSize(bullet, contentW - 10);
    doc.text(bLines, margin + 7, y);
    y += bLines.length * 5.5 + 3;
  }

  // Impact paragraph
  y += 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(primary.r, primary.g, primary.b);
  doc.text("EXPECTED IMPACT", margin, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  const impLines = doc.splitTextToSize(pitch.impactParagraph, contentW);
  doc.text(impLines, margin, y);
  y += impLines.length * 5.5 + 8;

  // ─── CTA BOX ────────────────────────────────────────────────────────
  const ctaBoxH = 28;
  if (y + ctaBoxH > pageH - 30) {
    doc.addPage();
    y = 30;
  }
  doc.setFillColor(primary.r, primary.g, primary.b);
  doc.roundedRect(margin, y, contentW, ctaBoxH, 4, 4, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(pitch.ctaText, pageW / 2, y + 10, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(pitch.ctaSubtext, pageW / 2, y + 19, { align: "center" });

  y += ctaBoxH + 8;

  // Closing line
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(10);
  doc.setFont("helvetica", "italic");
  const closingLines = doc.splitTextToSize(pitch.closingLine, contentW);
  doc.text(closingLines, margin, y);

  // Footer
  doc.setFillColor(primary.r, primary.g, primary.b);
  doc.rect(0, pageH - 12, pageW, 12, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("flowsmartly.com  •  Powered by FlowSmartly AI", pageW / 2, pageH - 4.5, { align: "center" });

  // Return as Node.js Buffer
  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
