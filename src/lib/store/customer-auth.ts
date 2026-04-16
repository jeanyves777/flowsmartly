/**
 * Store Customer Authentication
 *
 * Each store has its own customer accounts (separate from FlowSmartly user accounts).
 * Uses bcryptjs for password hashing and jose JWTs for stateless sessions.
 * Cookie is scoped per-store via the storeId in the JWT payload.
 */

import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/client";

const jwtSecretValue = process.env.STORE_CUSTOMER_JWT_SECRET || process.env.JWT_SECRET;
if (!jwtSecretValue) {
  console.error("FATAL: STORE_CUSTOMER_JWT_SECRET or JWT_SECRET must be set. Store customer auth will fail.");
}
const JWT_SECRET = new TextEncoder().encode(jwtSecretValue || "MISSING-SECRET-CHECK-ENV");

const COOKIE_NAME = "sc_session";
const SESSION_DURATION = 30 * 24 * 60 * 60; // 30 days in seconds

interface CustomerTokenPayload extends JWTPayload {
  customerId: string;
  storeId: string;
  email: string;
}

// ─── Password ────────────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── JWT ─────────────────────────────────────────────────────────────────────

export async function createCustomerToken(customerId: string, storeId: string, email: string): Promise<string> {
  return new SignJWT({ customerId, storeId, email } as CustomerTokenPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(JWT_SECRET);
}

export async function verifyCustomerToken(token: string): Promise<CustomerTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (!payload.customerId || !payload.storeId || !payload.email) return null;
    return payload as CustomerTokenPayload;
  } catch {
    return null;
  }
}

// ─── Cookie ──────────────────────────────────────────────────────────────────

export async function setCustomerCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION,
  });
}

export async function clearCustomerCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getCustomerToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value || null;
}

// ─── Session helper ──────────────────────────────────────────────────────────

/**
 * Get the authenticated store customer from the request cookie.
 * Returns null if not logged in or token invalid.
 * Verifies the customer belongs to the specified store.
 */
export async function getStoreCustomer(storeId: string) {
  const token = await getCustomerToken();
  if (!token) return null;

  const payload = await verifyCustomerToken(token);
  if (!payload || payload.storeId !== storeId) return null;

  const customer = await prisma.storeCustomer.findUnique({
    where: { id: payload.customerId },
  });

  if (!customer || customer.storeId !== storeId) return null;
  return customer;
}
