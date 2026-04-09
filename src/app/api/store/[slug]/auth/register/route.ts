import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { hashPassword, createCustomerToken, setCustomerCookie } from "@/lib/store/customer-auth";
import { verifyTurnstile } from "@/lib/auth/turnstile";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  turnstileToken: z.string().optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message || "Invalid input" }, { status: 400 });
    }

    const { name, email, password, turnstileToken } = parsed.data;

    // Turnstile CAPTCHA verification
    if (turnstileToken) {
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || undefined;
      const valid = await verifyTurnstile(turnstileToken, ip);
      if (!valid) {
        return NextResponse.json({ error: "CAPTCHA verification failed" }, { status: 400 });
      }
    }

    // Find the store
    const store = await prisma.store.findUnique({
      where: { slug },
      select: { id: true, isActive: true },
    });
    if (!store || !store.isActive) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    // Check if email already registered for this store
    const existing = await prisma.storeCustomer.findUnique({
      where: { storeId_email: { storeId: store.id, email: email.toLowerCase() } },
    });
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }

    // Create customer
    const passwordHash = await hashPassword(password);
    const customer = await prisma.storeCustomer.create({
      data: {
        storeId: store.id,
        email: email.toLowerCase(),
        name,
        passwordHash,
      },
    });

    // Set session cookie
    const token = await createCustomerToken(customer.id, store.id, customer.email);
    await setCustomerCookie(token);

    return NextResponse.json({
      success: true,
      customer: { id: customer.id, name: customer.name, email: customer.email },
    });
  } catch (err) {
    console.error("Store customer register error:", err);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
