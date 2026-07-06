import { randomInt } from "crypto";
import { prisma } from "@/lib/db/client";
import { sendEmail, baseTemplate } from "@/lib/email/core";

/**
 * Visitor email-verification gate for public portfolios. When an owner sets
 * viewAccess or downloadAccess to "email", a visitor must confirm a 6-digit
 * code before viewing/downloading. Every verified visitor is also upserted as
 * a Contact (lead capture) for the owner.
 *
 * Access is granted via an httpOnly cookie whose value is the verified
 * PortfolioVisitor id; the server page re-checks it against the DB.
 */

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 6;

export function accessCookieName(portfolioId: string): string {
  return `pf_v_${portfolioId}`;
}

function generateCode(): string {
  return String(randomInt(100000, 1000000)); // always 6 digits
}

function normalizeEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const e = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

export interface GatePortfolio {
  id: string;
  userId: string;
  name: string;
  slug: string;
}

/** Issue (or refresh) a code for this email and send it. Returns ok even in
 * dev where SMTP is off — the code is logged so local testing works. */
export async function requestVisitorCode(args: {
  portfolio: GatePortfolio;
  email: unknown;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const email = normalizeEmail(args.email);
  if (!email) return { ok: false, error: "Enter a valid email address." };

  const code = generateCode();
  const codeExpiresAt = new Date(Date.now() + CODE_TTL_MS);

  await prisma.portfolioVisitor.upsert({
    where: { portfolioId_email: { portfolioId: args.portfolio.id, email } },
    create: {
      portfolioId: args.portfolio.id,
      email,
      code,
      codeExpiresAt,
      ipAddress: args.ip || null,
      userAgent: args.userAgent || null,
    },
    update: { code, codeExpiresAt, attempts: 0 },
  });

  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log(`[portfolio] verification code for ${email} on "${args.portfolio.slug}": ${code}`);
  }

  const html = baseTemplate(
    `<h2>Your access code</h2>
     <p>Use this code to open <strong>${escapeHtml(args.portfolio.name)}</strong>:</p>
     <div class="code">${code}</div>
     <p>The code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>`,
    `Your access code is ${code}`,
  );
  try {
    await sendEmail({
      to: email,
      subject: `${code} is your access code`,
      html,
      text: `Your access code for ${args.portfolio.name}: ${code} (expires in 10 minutes).`,
    });
  } catch {
    // Non-fatal — the code is stored; in dev it's also logged above.
  }

  return { ok: true };
}

/** Verify a code. On success, mark verified + upsert a Contact and return the
 * visitor id (which the caller stores as the access cookie). */
export async function verifyVisitorCode(args: {
  portfolio: GatePortfolio;
  email: unknown;
  code: unknown;
}): Promise<{ ok: boolean; visitorId?: string; error?: string }> {
  const email = normalizeEmail(args.email);
  const code = typeof args.code === "string" ? args.code.trim() : "";
  if (!email) return { ok: false, error: "Enter a valid email address." };
  if (!/^\d{6}$/.test(code)) return { ok: false, error: "Enter the 6-digit code." };

  const visitor = await prisma.portfolioVisitor.findUnique({
    where: { portfolioId_email: { portfolioId: args.portfolio.id, email } },
  });
  if (!visitor || !visitor.code || !visitor.codeExpiresAt) {
    return { ok: false, error: "Request a code first." };
  }
  if (visitor.attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: "Too many attempts — request a new code." };
  }
  if (visitor.codeExpiresAt.getTime() < Date.now()) {
    return { ok: false, error: "That code expired — request a new one." };
  }
  if (visitor.code !== code) {
    await prisma.portfolioVisitor.update({
      where: { id: visitor.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, error: "Incorrect code." };
  }

  await prisma.portfolioVisitor.update({
    where: { id: visitor.id },
    data: { verified: true, verifiedAt: new Date(), code: null, codeExpiresAt: null, attempts: 0 },
  });

  // Lead capture: upsert a Contact for the owner (don't clobber an existing one).
  try {
    await prisma.contact.upsert({
      where: { userId_email: { userId: args.portfolio.userId, email } },
      create: {
        userId: args.portfolio.userId,
        email,
        tags: JSON.stringify(["portfolio-visitor"]),
        customFields: JSON.stringify({ source: "portfolio", portfolioSlug: args.portfolio.slug }),
        status: "ACTIVE",
      },
      update: {},
    });
  } catch {
    // A duplicate/edge Contact write must never fail the verification.
  }

  return { ok: true, visitorId: visitor.id };
}

/** True if this cookie value corresponds to a verified visitor of this portfolio. */
export async function hasVerifiedAccess(portfolioId: string, cookieValue: string | undefined): Promise<boolean> {
  if (!cookieValue) return false;
  const visitor = await prisma.portfolioVisitor.findFirst({
    where: { id: cookieValue, portfolioId, verified: true },
    select: { id: true },
  });
  return !!visitor;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
}
