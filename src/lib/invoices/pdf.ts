import type { Invoice } from "@prisma/client";

/**
 * FlowSmartly-branded invoice PDF generator.
 *
 * Single-page A4 layout with brand header band, items table, totals block, and footer.
 * Uses jspdf only — no Puppeteer / no headless Chrome.
 */

interface InvoiceItemShape {
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

interface UserShape {
  name: string | null;
  email: string | null;
}

// ── Brand constants ──
const BRAND_NAME = "FlowSmartly";
const BRAND_TAGLINE = "AI-powered content for creators.";
const BRAND_SUPPORT_EMAIL = "support@flowsmartly.com";
const BRAND_PRIMARY_HEX = "#0ea5e9"; // sky-500
const BRAND_PRIMARY_RGB = { r: 14, g: 165, b: 233 };

// Status pill palette
const STATUS_COLORS: Record<string, { fill: { r: number; g: number; b: number }; text: { r: number; g: number; b: number } }> = {
  PAID: { fill: { r: 22, g: 163, b: 74 }, text: { r: 255, g: 255, b: 255 } },          // green-600
  REFUNDED: { fill: { r: 100, g: 116, b: 139 }, text: { r: 255, g: 255, b: 255 } },    // slate-500
  PENDING: { fill: BRAND_PRIMARY_RGB, text: { r: 255, g: 255, b: 255 } },              // sky-500
  OPEN: { fill: BRAND_PRIMARY_RGB, text: { r: 255, g: 255, b: 255 } },                 // sky-500
  FAILED: { fill: { r: 220, g: 38, b: 38 }, text: { r: 255, g: 255, b: 255 } },        // red-600
  VOID: { fill: { r: 220, g: 38, b: 38 }, text: { r: 255, g: 255, b: 255 } },
  UNCOLLECTIBLE: { fill: { r: 220, g: 38, b: 38 }, text: { r: 255, g: 255, b: 255 } },
};

const INVOICE_TYPE_LABELS: Record<string, string> = {
  credit_purchase: "Credit Purchase",
  subscription: "Subscription",
  sms_rental: "SMS Number Rental",
  domain_purchase: "Domain Purchase",
  domain_renewal: "Domain Renewal",
  store_order: "Store Order",
};

function formatMoney(cents: number, currency: string): string {
  const code = (currency || "USD").toUpperCase();
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents) / 100;
  if (code === "USD") return `${sign}$${abs.toFixed(2)}`;
  return `${sign}${abs.toFixed(2)} ${code}`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function parseItems(raw: unknown): InvoiceItemShape[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((it) => ({
        description: String(it?.description ?? ""),
        quantity: Number(it?.quantity ?? 1),
        unitPriceCents: Number(it?.unitPriceCents ?? 0),
        totalCents: Number(it?.totalCents ?? 0),
      }))
      .filter((it) => it.description);
  } catch {
    return [];
  }
}

export async function renderInvoicePdf(invoice: Invoice, user: UserShape): Promise<Buffer> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageW = 210;
  const pageH = 297;
  const margin = 18;
  const contentW = pageW - margin * 2;

  const items = parseItems(invoice.items);
  const currency = invoice.currency || "USD";
  const status = (invoice.status || "PAID").toUpperCase();
  const issuedDate = formatDate(new Date(invoice.createdAt));

  // ─────────────────────────────────────────────────────────
  // HEADER BAND (top color stripe)
  // ─────────────────────────────────────────────────────────
  doc.setFillColor(BRAND_PRIMARY_RGB.r, BRAND_PRIMARY_RGB.g, BRAND_PRIMARY_RGB.b);
  doc.rect(0, 0, pageW, 4, "F"); // thin top accent

  // Left: brand color block + brand name
  const headerY = 14;
  doc.setFillColor(BRAND_PRIMARY_RGB.r, BRAND_PRIMARY_RGB.g, BRAND_PRIMARY_RGB.b);
  doc.roundedRect(margin, headerY, 8, 8, 1.5, 1.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(BRAND_NAME, margin + 11, headerY + 6.5);

  // Right: "INVOICE" muted, then invoice number bold below
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(148, 163, 184); // slate-400
  const invoiceWordW = doc.getTextWidth("INVOICE");
  doc.text("INVOICE", pageW - margin - invoiceWordW, headerY + 1);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  const numW = doc.getTextWidth(invoice.invoiceNumber);
  doc.text(invoice.invoiceNumber, pageW - margin - numW, headerY + 7);

  // ─────────────────────────────────────────────────────────
  // META ROW (issued + status pill)
  // ─────────────────────────────────────────────────────────
  let cursorY = headerY + 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text("ISSUED", margin, cursorY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(issuedDate, margin, cursorY + 5);

  // Status pill (right side)
  const pillPalette = STATUS_COLORS[status] ?? STATUS_COLORS.PAID;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  const pillTextW = doc.getTextWidth(status);
  const pillPadX = 4;
  const pillH = 6.5;
  const pillW = pillTextW + pillPadX * 2;
  const pillX = pageW - margin - pillW;
  const pillY = cursorY - 1;
  doc.setFillColor(pillPalette.fill.r, pillPalette.fill.g, pillPalette.fill.b);
  doc.roundedRect(pillX, pillY, pillW, pillH, 2, 2, "F");
  doc.setTextColor(pillPalette.text.r, pillPalette.text.g, pillPalette.text.b);
  doc.text(status, pillX + pillPadX, pillY + 4.5);

  cursorY += 16;

  // ─────────────────────────────────────────────────────────
  // BILLED TO
  // ─────────────────────────────────────────────────────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("BILLED TO", margin, cursorY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  const customerName = invoice.customerName || user.name || "Customer";
  doc.text(customerName, margin, cursorY + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  const customerEmail = invoice.customerEmail || user.email || "";
  if (customerEmail) doc.text(customerEmail, margin, cursorY + 11);

  // Invoice type pill on the right of "Billed To"
  const invType = INVOICE_TYPE_LABELS[invoice.type] || invoice.type;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  const typeLabel = "TYPE";
  const typeLabelW = doc.getTextWidth(typeLabel);
  doc.text(typeLabel, pageW - margin - typeLabelW, cursorY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  const typeValW = doc.getTextWidth(invType);
  doc.text(invType, pageW - margin - typeValW, cursorY + 6);

  cursorY += 22;

  // ─────────────────────────────────────────────────────────
  // ITEMS TABLE
  // ─────────────────────────────────────────────────────────
  // Column layout (right edge of the table = pageW - margin)
  const colDescX = margin;
  const colQtyRight = pageW - margin - 70; // qty right edge
  const colUnitRight = pageW - margin - 35; // unit right edge
  const colTotalRight = pageW - margin;    // total right edge

  // Header row
  doc.setFillColor(241, 245, 249); // slate-100
  doc.rect(margin, cursorY, contentW, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text("DESCRIPTION", colDescX + 2, cursorY + 5.4);
  const qtyHdr = "QTY";
  doc.text(qtyHdr, colQtyRight - doc.getTextWidth(qtyHdr), cursorY + 5.4);
  const unitHdr = "UNIT";
  doc.text(unitHdr, colUnitRight - doc.getTextWidth(unitHdr), cursorY + 5.4);
  const totalHdr = "TOTAL";
  doc.text(totalHdr, colTotalRight - doc.getTextWidth(totalHdr), cursorY + 5.4);

  cursorY += 8;

  // Item rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59); // slate-800

  if (items.length === 0) {
    cursorY += 6;
    doc.setTextColor(148, 163, 184);
    doc.text("(no line items)", colDescX + 2, cursorY);
    cursorY += 6;
  } else {
    for (const item of items) {
      // wrap description if it's long
      const maxDescW = colQtyRight - colDescX - 12; // leave gap before qty col
      const descLines = doc.splitTextToSize(item.description, maxDescW) as string[];
      const rowH = Math.max(8, descLines.length * 5 + 2);

      // separator
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.2);
      doc.line(margin, cursorY, pageW - margin, cursorY);

      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "normal");
      descLines.forEach((line, idx) => {
        doc.text(line, colDescX + 2, cursorY + 5.4 + idx * 5);
      });

      const qtyStr = String(item.quantity);
      doc.text(qtyStr, colQtyRight - doc.getTextWidth(qtyStr), cursorY + 5.4);

      const unitStr = formatMoney(item.unitPriceCents, currency);
      doc.text(unitStr, colUnitRight - doc.getTextWidth(unitStr), cursorY + 5.4);

      const totStr = formatMoney(item.totalCents, currency);
      doc.text(totStr, colTotalRight - doc.getTextWidth(totStr), cursorY + 5.4);

      cursorY += rowH;
    }
  }

  // Bottom separator
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.4);
  doc.line(margin, cursorY, pageW - margin, cursorY);
  cursorY += 6;

  // ─────────────────────────────────────────────────────────
  // TOTALS BLOCK (right-aligned column)
  // ─────────────────────────────────────────────────────────
  const totalsLabelRight = pageW - margin - 40; // right edge of label col
  const totalsValueRight = pageW - margin;      // right edge of value col

  const drawTotalsRow = (label: string, value: string, opts?: { bold?: boolean; size?: number }) => {
    const size = opts?.size ?? 10;
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(opts?.bold ? 15 : 100, opts?.bold ? 23 : 116, opts?.bold ? 42 : 139);
    const labelW = doc.getTextWidth(label);
    const valueW = doc.getTextWidth(value);
    doc.text(label, totalsLabelRight - labelW, cursorY);
    doc.text(value, totalsValueRight - valueW, cursorY);
    cursorY += size * 0.5 + 2;
  };

  drawTotalsRow("Subtotal", formatMoney(invoice.subtotalCents, currency));
  if ((invoice.taxCents ?? 0) > 0) {
    drawTotalsRow("Tax", formatMoney(invoice.taxCents, currency));
  }

  // bold total row with top divider
  cursorY += 1;
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.5);
  doc.line(totalsLabelRight - 30, cursorY - 1, totalsValueRight, cursorY - 1);
  cursorY += 4;
  drawTotalsRow("Total", `${formatMoney(invoice.totalCents, currency)} ${currency}`, { bold: true, size: 13 });

  cursorY += 6;

  // ─────────────────────────────────────────────────────────
  // PAYMENT METHOD (if present)
  // ─────────────────────────────────────────────────────────
  if (invoice.paymentMethod) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("PAYMENT METHOD", margin, cursorY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(invoice.paymentMethod, margin, cursorY + 5);
    cursorY += 12;
  }

  // ─────────────────────────────────────────────────────────
  // FOOTER (anchored near page bottom)
  // ─────────────────────────────────────────────────────────
  const footerY = pageH - 22;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY, pageW - margin, footerY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Thanks for using ${BRAND_NAME} · Questions? ${BRAND_SUPPORT_EMAIL}`,
    margin,
    footerY + 6
  );
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(BRAND_TAGLINE, margin, footerY + 11);

  // Brand color stripe at bottom mirroring the top
  doc.setFillColor(BRAND_PRIMARY_RGB.r, BRAND_PRIMARY_RGB.g, BRAND_PRIMARY_RGB.b);
  doc.rect(0, pageH - 3, pageW, 3, "F");

  // Silence "unused" for the hex constant when treeshaken in future use:
  void BRAND_PRIMARY_HEX;

  const ab = doc.output("arraybuffer");
  return Buffer.from(ab);
}
