import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// POST /api/ecommerce/customers/[customerId]/add-to-contacts
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { customerId } = await params;

    // Verify the store customer belongs to this user's store
    const store = await prisma.store.findFirst({ where: { userId: session.userId }, select: { id: true } });
    if (!store) return NextResponse.json({ error: "No store found" }, { status: 404 });

    const storeCustomer = await prisma.storeCustomer.findFirst({
      where: { id: customerId, storeId: store.id },
      select: { id: true, name: true, email: true, phone: true },
    });
    if (!storeCustomer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

    // Split name into first/last
    const nameParts = storeCustomer.name.trim().split(/\s+/);
    const firstName = nameParts[0] || storeCustomer.name;
    const lastName = nameParts.slice(1).join(" ") || undefined;

    // Upsert contact (by userId + email)
    const existing = await prisma.contact.findFirst({
      where: { userId: session.userId, email: storeCustomer.email },
      select: { id: true },
    });

    let contact;
    if (existing) {
      contact = await prisma.contact.update({
        where: { id: existing.id },
        data: {
          firstName,
          lastName,
          phone: storeCustomer.phone ?? undefined,
        },
        select: { id: true },
      });
    } else {
      contact = await prisma.contact.create({
        data: {
          userId: session.userId,
          email: storeCustomer.email,
          firstName,
          lastName,
          phone: storeCustomer.phone ?? undefined,
          emailOptedIn: true,
          emailOptedInAt: new Date(),
          status: "ACTIVE",
        },
        select: { id: true },
      });
    }

    return NextResponse.json({ success: true, data: { contactId: contact.id, isNew: !existing } });
  } catch (err) {
    console.error("Add to contacts error:", err);
    return NextResponse.json({ error: "Failed to add contact" }, { status: 500 });
  }
}
