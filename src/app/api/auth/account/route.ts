import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { verifyPassword } from "@/lib/auth/password";
import {
  getSession,
  invalidateAllUserSessions,
  clearSessionCookies,
} from "@/lib/auth/session";
import { stripe } from "@/lib/stripe";

/**
 * DELETE /api/auth/account
 *
 * Self-service account deletion (GDPR "right to erasure" / Google Play
 * account-deletion requirement). Implements the flow promised on /gdpr:
 * Settings → Account → Delete My Account.
 *
 * We do NOT hard-delete the User row — it has ~130 relations without cascade
 * rules, so prisma.user.delete() would throw on foreign keys. Instead we:
 *   1. Verify the user (password for email accounts, "DELETE" phrase for OAuth).
 *   2. Best-effort cancel any active Stripe subscription so we stop billing.
 *   3. Anonymize all personal data (email, name, username, avatar, bio, OAuth
 *      identifiers, 2FA secrets, Stripe customer id) — true erasure of PII.
 *   4. Set deletedAt — the session layer (session.ts) already rejects any
 *      user with deletedAt set, so the account is immediately inaccessible
 *      everywhere (web cookies AND mobile bearer tokens).
 *   5. Invalidate all sessions + clear this device's cookies.
 *
 * Financial/aggregate rows (invoices, earnings) keep their foreign key for
 * legal/accounting retention, but no longer point at identifiable data.
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    // Don't allow deletion from an admin-preview or agent-impersonation context —
    // those are not the real account owner acting on their own account.
    if (session.adminId || session.agentId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Account deletion is only available to the account owner.",
          },
        },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const password: string = typeof body?.password === "string" ? body.password : "";
    const confirmation: string =
      typeof body?.confirmation === "string" ? body.confirmation.trim() : "";

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        passwordHash: true,
        stripeCustomerId: true,
        deletedAt: true,
      },
    });

    if (!user || user.deletedAt) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Account not found" } },
        { status: 404 }
      );
    }

    // Verify ownership. Email accounts re-enter their password; OAuth-only
    // accounts (no password set) type the word DELETE to confirm.
    if (user.passwordHash) {
      const ok = !!password && (await verifyPassword(password, user.passwordHash));
      if (!ok) {
        return NextResponse.json(
          {
            success: false,
            error: { code: "INVALID_PASSWORD", message: "Incorrect password" },
          },
          { status: 401 }
        );
      }
    } else if (confirmation.toUpperCase() !== "DELETE") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CONFIRMATION_REQUIRED",
            message: 'Type "DELETE" to confirm account deletion.',
          },
        },
        { status: 400 }
      );
    }

    // Best-effort: cancel any active Stripe subscriptions so a deleted user is
    // never billed again. Failures here must not block the deletion.
    if (stripe && user.stripeCustomerId) {
      try {
        const subs = await stripe.subscriptions.list({
          customer: user.stripeCustomerId,
          status: "active",
          limit: 100,
        });
        for (const sub of subs.data) {
          await stripe.subscriptions.cancel(sub.id).catch(() => {});
        }
      } catch (err) {
        console.error("Stripe subscription cancel on account delete failed:", err);
      }
    }

    const now = new Date();

    // Anonymize PII + soft-delete. email/username are unique, so we key the
    // tombstone values off the immutable user id to guarantee uniqueness.
    await prisma.user.update({
      where: { id: user.id },
      data: {
        deletedAt: now,
        email: `deleted-${user.id}@deleted.flowsmartly.com`,
        username: `deleted_${user.id}`,
        name: "Deleted User",
        passwordHash: null,
        oauthProvider: null,
        oauthId: null,
        oauthAvatarUrl: null,
        avatarUrl: null,
        coverImageUrl: null,
        bio: null,
        website: null,
        links: "{}",
        country: null,
        region: null,
        referralCode: null,
        stripeCustomerId: null,
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorEnabledAt: null,
        twoFactorRecoveryCodes: "[]",
        notificationPrefs: "{}",
      },
    });

    // Kill every session for this user, then clear this device's cookies.
    await invalidateAllUserSessions(user.id);
    await clearSessionCookies();

    return NextResponse.json({
      success: true,
      message: "Your account and personal data have been deleted.",
    });
  } catch (error) {
    console.error("Account deletion error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An error occurred" } },
      { status: 500 }
    );
  }
}
