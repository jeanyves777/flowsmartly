import { prisma } from "@/lib/db/client";

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

interface CreateInvoiceParams {
  userId: string;
  type: "credit_purchase" | "subscription" | "sms_rental";
  items: InvoiceItem[];
  totalCents: number;
  paymentMethod?: string; // e.g. "visa ****1234"
  paymentId?: string; // Stripe PaymentIntent ID
  customerName?: string;
  customerEmail?: string;
}

/**
 * Generate next invoice number: INV-YYYY-NNNN
 */
async function getNextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  const lastInvoice = await prisma.invoice.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });

  let nextNum = 1;
  if (lastInvoice) {
    const lastNum = parseInt(lastInvoice.invoiceNumber.replace(prefix, ""), 10);
    if (!isNaN(lastNum)) nextNum = lastNum + 1;
  }

  return `${prefix}${String(nextNum).padStart(4, "0")}`;
}

/**
 * Create an invoice record for a purchase.
 */
export async function createInvoice(params: CreateInvoiceParams) {
  const invoiceNumber = await getNextInvoiceNumber();

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      userId: params.userId,
      type: params.type,
      status: "PAID",
      items: JSON.stringify(params.items),
      subtotalCents: params.totalCents,
      taxCents: 0,
      totalCents: params.totalCents,
      paymentMethod: params.paymentMethod || null,
      paymentId: params.paymentId || null,
      customerName: params.customerName || null,
      customerEmail: params.customerEmail || null,
    },
  });

  return invoice;
}

/**
 * Get invoices for a user.
 */
export async function getUserInvoices(
  userId: string,
  options?: { limit?: number; offset?: number }
) {
  const { limit = 50, offset = 0 } = options ?? {};

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.invoice.count({ where: { userId } }),
  ]);

  return {
    invoices,
    total,
    hasMore: offset + invoices.length < total,
  };
}
