import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { nanoid } from "nanoid";

// Secret keys from environment variables
const ACCESS_TOKEN_SECRET = new TextEncoder().encode(
  process.env.JWT_ACCESS_SECRET || "dev-access-secret-change-in-production"
);

const REFRESH_TOKEN_SECRET = new TextEncoder().encode(
  process.env.JWT_REFRESH_SECRET || "dev-refresh-secret-change-in-production"
);

// Token expiration times
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

export interface TokenPayload extends JWTPayload {
  userId: string;
  sessionId: string;
  type: "access" | "refresh";
}

/**
 * Generate an access token
 */
export async function generateAccessToken(
  userId: string,
  sessionId: string
): Promise<string> {
  return new SignJWT({
    userId,
    sessionId,
    type: "access",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .setJti(nanoid())
    .sign(ACCESS_TOKEN_SECRET);
}

/**
 * Generate a refresh token
 */
export async function generateRefreshToken(
  userId: string,
  sessionId: string
): Promise<string> {
  return new SignJWT({
    userId,
    sessionId,
    type: "refresh",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .setJti(nanoid())
    .sign(REFRESH_TOKEN_SECRET);
}

/**
 * Verify an access token
 */
export async function verifyAccessToken(
  token: string
): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, ACCESS_TOKEN_SECRET);
    return payload as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Verify a refresh token
 */
export async function verifyRefreshToken(
  token: string
): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, REFRESH_TOKEN_SECRET);
    return payload as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Generate a new pair of tokens (access + refresh)
 */
export async function generateTokenPair(
  userId: string,
  sessionId: string
): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const [accessToken, refreshToken] = await Promise.all([
    generateAccessToken(userId, sessionId),
    generateRefreshToken(userId, sessionId),
  ]);

  return { accessToken, refreshToken };
}

/**
 * Rotate tokens - generate new pair with new session
 */
export async function rotateTokens(
  userId: string
): Promise<{
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}> {
  const sessionId = nanoid();
  const { accessToken, refreshToken } = await generateTokenPair(
    userId,
    sessionId
  );

  return { accessToken, refreshToken, sessionId };
}
