import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { verifyPassword, createCustomerToken } from "@/lib/store/customer-auth";
import { verifyTurnstile } from "@/lib/auth/turnstile";
import { safeCorsHeaders } from "@/lib/store/cors";
import { checkRateLimit } from "@/lib/store/rate-limit";
import { z } from "zod";

const SESSION_DURATION = 30 * 24 * 60 * 60;

const corsHeaders = safeCorsHeaders;

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
  turnstileToken: z.string().min(1, "CAPTCHA verification required"),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;

    // Rate limiting by IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
    const rateCheck = checkRateLimit(ip, "login");
    if (rateCheck.limited) {
      return NextResponse.json(
        { error: `Too many login attempts. Try again in ${rateCheck.retryAfterSeconds}s` },
        { status: 429, headers: { ...corsHeaders(request), "Retry-After": String(rateCheck.retryAfterSeconds) } },
      );
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message || "Invalid input" }, { status: 400 });
    }

    const { email, password, turnstileToken } = parsed.data;

    // Turnstile CAPTCHA — mandatory
    const turnstileValid = await verifyTurnstile(turnstileToken, ip);
    if (!turnstileValid) {
      return NextResponse.json({ error: "CAPTCHA verification failed" }, { status: 400 });
    }

    const store = await prisma.store.findUnique({
      where: { slug },
      select: { id: true, isActive: true },
    });
    if (!store || !store.isActive) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const customer = await prisma.storeCustomer.findUnique({
      where: { storeId_email: { storeId: store.id, email: email.toLowerCase() } },
    });
    if (!customer) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const valid = await verifyPassword(password, customer.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const token = await createCustomerToken(customer.id, store.id, customer.email);
    const res = NextResponse.json(
      { success: true, customer: { id: customer.id, name: customer.name, email: customer.email } },
      { headers: corsHeaders(request) },
    );
    res.cookies.set("sc_session", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: SESSION_DURATION,
    });
    return res;
  } catch (err) {
    console.error("Store customer login error:", err);
    return NextResponse.json({ error: "Login failed" }, { status: 500, headers: corsHeaders(request) });
  }
}
