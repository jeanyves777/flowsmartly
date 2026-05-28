/**
 * Generic branded PDF renderer. Reuses the same `jspdf` dependency the
 * pitch/proposal PDFs use, but for ARBITRARY documents (contracts, plans,
 * letters, briefs) the agent writes on the fly. The agent supplies the
 * already-written content as structured sections; this lays it out with the
 * user's brand header, colors, and contact footer.
 */

export interface BrandedDocSection {
  heading?: string;
  body: string;
}

export interface BrandedDocBrand {
  name: string;
  primaryColor?: string;
  accentColor?: string;
  /** base64 data URI of the logo, e.g. "data:image/png;base64,..." */
  logo?: string;
  /** width / height — for correct logo sizing */
  logoAspectRatio?: number;
  /** one-line contact string for the footer (e.g. "hello@x.com · x.com") */
  contactLine?: string;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return { r: 37, g: 99, b: 235 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export async function generateBrandedDocumentPDF(params: {
  title: string;
  subtitle?: string;
  sections: BrandedDocSection[];
  brand: BrandedDocBrand;
}): Promise<Buffer> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageW = 210;
  const pageH = 297;
  const margin = 18;
  const contentW = pageW - margin * 2;
  const bottomLimit = pageH - margin - 8; // leave room for footer
  const primary = hexToRgb(params.brand.primaryColor || "#2563eb");
  const accent = hexToRgb(params.brand.accentColor || params.brand.primaryColor || "#2563eb");

  let pageNum = 1;

  const drawHeaderBar = () => {
    doc.setFillColor(primary.r, primary.g, primary.b);
    doc.rect(0, 0, pageW, 20, "F");
    if (params.brand.logo) {
      try {
        const logoH = 12;
        const logoW = logoH * (params.brand.logoAspectRatio || 3);
        const fmt = params.brand.logo.includes("jpeg") || params.brand.logo.includes("jpg")
          ? "JPEG"
          : params.brand.logo.includes("webp")
            ? "WEBP"
            : "PNG";
        doc.addImage(params.brand.logo, fmt, margin, 4, logoW, logoH);
      } catch {
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(params.brand.name.toUpperCase(), margin, 13);
      }
    } else {
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(params.brand.name.toUpperCase(), margin, 13);
    }
  };

  const drawFooter = () => {
    const footerY = pageH - 10;
    doc.setDrawColor(225, 225, 225);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY - 4, pageW - margin, footerY - 4);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(140, 140, 140);
    const left = params.brand.contactLine || params.brand.name;
    doc.text(left.slice(0, 90), margin, footerY);
    doc.text(`Page ${pageNum}`, pageW - margin, footerY, { align: "right" });
  };

  const newPage = () => {
    drawFooter();
    doc.addPage();
    pageNum += 1;
    drawHeaderBar();
    return 32;
  };

  drawHeaderBar();

  // Title block
  let y = 34;
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  const titleLines = doc.splitTextToSize(params.title, contentW) as string[];
  for (const line of titleLines) {
    if (y > bottomLimit) y = newPage();
    doc.text(line, margin, y);
    y += 9;
  }

  if (params.subtitle) {
    doc.setFontSize(10.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(110, 110, 110);
    const subLines = doc.splitTextToSize(params.subtitle, contentW) as string[];
    for (const line of subLines) {
      if (y > bottomLimit) y = newPage();
      doc.text(line, margin, y);
      y += 6;
    }
  }

  y += 2;
  doc.setDrawColor(accent.r, accent.g, accent.b);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // Sections
  for (const section of params.sections) {
    if (section.heading) {
      if (y > bottomLimit - 6) y = newPage();
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(primary.r, primary.g, primary.b);
      const headLines = doc.splitTextToSize(section.heading, contentW) as string[];
      for (const line of headLines) {
        if (y > bottomLimit) y = newPage();
        doc.text(line, margin, y);
        y += 7;
      }
      y += 1;
    }

    doc.setFontSize(10.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(45, 45, 45);
    // Honor explicit paragraph breaks in the body.
    const paragraphs = section.body.split(/\n{2,}/);
    for (const para of paragraphs) {
      const lines = doc.splitTextToSize(para.replace(/\n/g, " ").trim(), contentW) as string[];
      for (const line of lines) {
        if (y > bottomLimit) y = newPage();
        doc.text(line, margin, y);
        y += 5.6;
      }
      y += 3; // paragraph gap
    }
    y += 4; // section gap
  }

  drawFooter();

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
