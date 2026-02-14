import { cookies } from "next/headers";
import { prisma } from "@/lib/db/client";
import { verifyAccessToken, verifyRefreshToken, generateTokenPair } from "./tokens";
import { nanoid } from "nanoid";

// Cookie names
const ACCESS_TOKEN_COOKIE = "access_token";
const REFRESH_TOKEN_COOKIE = "refresh_token";
const ADMIN_TOKEN_COOKIE = "admin_token";

// Cookie options
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export interface Session {
  userId: string;
  sessionId: string;
  adminId?: string; // Present if this is an admin session
  user: {
    id: string;
    email: string;
    name: string;
    username: string;
    avatarUrl: string | null;
    plan: string;
    aiCredits: number;
    balanceCents: number;
    emailVerified: boolean;
  };
}

/**
 * Get the current session from cookies
 * Also checks for admin sessions to allow admin access to user features
 */
export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  // First, try regular user session via access token
  if (accessToken) {
    const payload = await verifyAccessToken(accessToken);
    if (payload) {
      // Get user from database
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          avatarUrl: true,
          plan: true,
          aiCredits: true,
          balanceCents: true,
          emailVerified: true,
          deletedAt: true,
        },
      });

      if (user && !user.deletedAt) {
        return {
          userId: payload.userId,
          sessionId: payload.sessionId,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            username: user.username,
            avatarUrl: user.avatarUrl,
            plan: user.plan,
            aiCredits: user.aiCredits,
            balanceCents: user.balanceCents,
            emailVerified: user.emailVerified,
          },
        };
      }
    }
  }

  // Access token missing or invalid - try to refresh using refresh token
  const refreshedSession = await tryRefreshSession();
  if (refreshedSession) {
    return refreshedSession;
  }

  // If no user session, check for admin session
  // This allows admins to access user features for testing/preview
  const adminToken = cookieStore.get(ADMIN_TOKEN_COOKIE)?.value;
  if (adminToken) {
    const adminSession = await getAdminAsUserSession(adminToken);
    if (adminSession) {
      return adminSession;
    }
  }

  return null;
}

/**
 * Get admin session as a user session (for admin preview mode)
 * Creates a linked User record if one doesn't exist so admins can use all features
 */
async function getAdminAsUserSession(token: string): Promise<Session | null> {
  try {
    // Find admin session
    const adminSession = await prisma.adminSession.findUnique({
      where: { token },
      include: {
        admin: true,
      },
    });

    if (!adminSession || adminSession.expiresAt < new Date()) {
      return null;
    }

    if (!adminSession.admin.isActive) {
      return null;
    }

    // Find or create a linked User record for this admin
    // This allows admins to use all platform features (brand identity, etc.)
    let linkedUser = await prisma.user.findUnique({
      where: { email: adminSession.admin.email },
    });

    if (!linkedUser) {
      // Create a User record linked to this admin
      const baseUsername = adminSession.admin.email.split("@")[0];
      let username = baseUsername + "_admin";

      // Check if username exists and make unique if needed
      const existingUsername = await prisma.user.findUnique({ where: { username } });
      if (existingUsername) {
        username = baseUsername + "_admin_" + Date.now();
      }

      linkedUser = await prisma.user.create({
        data: {
          email: adminSession.admin.email,
          passwordHash: adminSession.admin.passwordHash,
          name: adminSession.admin.name,
          username,
          plan: "PRO",
          aiCredits: 10000,
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      });
    }

    // Return a session using the linked User's ID
    return {
      userId: linkedUser.id,
      sessionId: adminSession.id,
      adminId: adminSession.admin.id, // Keep track that this is an admin
      user: {
        id: linkedUser.id,
        email: linkedUser.email,
        name: linkedUser.name,
        username: linkedUser.username,
        avatarUrl: linkedUser.avatarUrl,
        plan: linkedUser.plan,
        aiCredits: linkedUser.aiCredits,
        balanceCents: linkedUser.balanceCents,
        emailVerified: linkedUser.emailVerified,
      },
    };
  } catch (error) {
    console.error("Admin session error:", error);
    return null;
  }
}

/**
 * Try to refresh the session using the refresh token
 */
async function tryRefreshSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!refreshToken) {
    return null;
  }

  const payload = await verifyRefreshToken(refreshToken);
  if (!payload) {
    return null;
  }

  // Verify session exists in database
  const session = await prisma.session.findUnique({
    where: { id: payload.sessionId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          avatarUrl: true,
          plan: true,
          aiCredits: true,
          balanceCents: true,
          emailVerified: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!session || session.expiresAt < new Date() || session.user.deletedAt) {
    return null;
  }

  // Generate new tokens
  const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
    await generateTokenPair(payload.userId, payload.sessionId);

  // Set new cookies
  cookieStore.set(ACCESS_TOKEN_COOKIE, newAccessToken, {
    ...COOKIE_OPTIONS,
    maxAge: 15 * 60, // 15 minutes
  });

  cookieStore.set(REFRESH_TOKEN_COOKIE, newRefreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });

  return {
    userId: session.user.id,
    sessionId: payload.sessionId,
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      username: session.user.username,
      avatarUrl: session.user.avatarUrl,
      plan: session.user.plan,
      aiCredits: session.user.aiCredits,
      balanceCents: session.user.balanceCents,
      emailVerified: session.user.emailVerified,
    },
  };
}

/**
 * Create a new session for a user
 */
export async function createSession(
  userId: string,
  userAgent?: string,
  ipAddress?: string
): Promise<{
  sessionId: string;
  accessToken: string;
  refreshToken: string;
}> {
  const sessionId = nanoid();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // Create session in database
  await prisma.session.create({
    data: {
      id: sessionId,
      userId,
      token: nanoid(64),
      userAgent,
      ipAddress,
      expiresAt,
    },
  });

  // Generate tokens
  const { accessToken, refreshToken } = await generateTokenPair(
    userId,
    sessionId
  );

  return { sessionId, accessToken, refreshToken };
}

/**
 * Set session cookies after login
 */
export async function setSessionCookies(
  accessToken: string,
  refreshToken: string
): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(ACCESS_TOKEN_COOKIE, accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: 15 * 60, // 15 minutes
  });

  cookieStore.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
}

/**
 * Clear session cookies (logout)
 */
export async function clearSessionCookies(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.delete(ACCESS_TOKEN_COOKIE);
  cookieStore.delete(REFRESH_TOKEN_COOKIE);
}

/**
 * Invalidate a session
 */
export async function invalidateSession(sessionId: string): Promise<void> {
  await prisma.session.delete({
    where: { id: sessionId },
  }).catch(() => {
    // Session might already be deleted
  });
}

/**
 * Invalidate all sessions for a user
 */
export async function invalidateAllUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { userId },
  });
}
