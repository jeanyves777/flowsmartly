import { prisma } from "@/lib/db/client";
import { generateUsername } from "@/lib/utils/username";
import { notifyWelcome } from "@/lib/notifications";

/**
 * Create a brand-new account directly from an OAuth profile (Google / Facebook)
 * and grant the standard welcome bundle.
 *
 * Used by the NATIVE mobile signup path: when a user taps "Sign up with Google /
 * Facebook" in the app and has no existing account, the web flow would punt to
 * the web `/register` page (which the app can't show). Instead we create the
 * account server-side here — mirroring `/api/auth/complete-oauth` — so the
 * callback can hand JWTs back to the app via the deep link.
 *
 * Web register mode is unchanged: it still collects username + country in a
 * modal via complete-oauth.
 */
export async function createOAuthUser(profile: {
  provider: "google" | "facebook";
  oauthId: string;
  name: string;
  email: string | null;
  avatar: string | null;
}) {
  const email = profile.email || `${profile.provider}_${profile.oauthId}@flowsmartly.local`;
  const hasRealEmail = !!profile.email;

  // Derive a unique username from the email/name (no manual step on mobile).
  const username = await generateUsername(profile.name || email);

  const user = await prisma.user.create({
    data: {
      email,
      name: profile.name || email.split("@")[0],
      username,
      region: "worldwide",
      oauthProvider: profile.provider,
      oauthId: profile.oauthId,
      oauthAvatarUrl: profile.avatar,
      avatarUrl: profile.avatar,
      // OAuth providers verify the email before releasing it.
      emailVerified: hasRealEmail,
      emailVerifiedAt: hasRealEmail ? new Date() : null,
      lastLoginAt: new Date(),
      aiCredits: 100,
      freeCredits: 100,
    },
  });

  await prisma.creditTransaction.create({
    data: {
      userId: user.id,
      amount: 100,
      type: "BONUS",
      description: "Welcome credits for new account",
      balanceAfter: 100,
    },
  });

  // Fire-and-forget welcome email (email already verified → no verify link).
  notifyWelcome({ userId: user.id, email: user.email, name: user.name, verificationUrl: "" }).catch(
    (err) => console.error("OAuth signup welcome email failed:", err),
  );

  return user;
}
