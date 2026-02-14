import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";

// Configuration for password hashing
const SALT_LENGTH = 32;
const KEY_LENGTH = 64;
const SCRYPT_PARAMS = {
  N: 16384, // CPU/memory cost
  r: 8,     // Block size
  p: 1,     // Parallelization
};

/**
 * Hash a password using scrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const hash = scryptSync(password, salt, KEY_LENGTH, SCRYPT_PARAMS);

  // Return salt:hash in base64
  return `${salt.toString("base64")}:${hash.toString("base64")}`;
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  try {
    const [saltB64, hashB64] = storedHash.split(":");
    if (!saltB64 || !hashB64) return false;

    const salt = Buffer.from(saltB64, "base64");
    const storedHashBuffer = Buffer.from(hashB64, "base64");

    const hash = scryptSync(password, salt, KEY_LENGTH, SCRYPT_PARAMS);

    // Use timing-safe comparison to prevent timing attacks
    return timingSafeEqual(hash, storedHashBuffer);
  } catch {
    return false;
  }
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  score: number;
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  // Length check
  if (password.length >= 12) {
    score += 2;
  } else if (password.length >= 8) {
    score += 1;
  } else {
    feedback.push("Password should be at least 8 characters");
  }

  // Character variety
  if (/[a-z]/.test(password)) {
    score += 1;
  } else {
    feedback.push("Include lowercase letters");
  }

  if (/[A-Z]/.test(password)) {
    score += 1;
  } else {
    feedback.push("Include uppercase letters");
  }

  if (/[0-9]/.test(password)) {
    score += 1;
  } else {
    feedback.push("Include numbers");
  }

  if (/[^a-zA-Z0-9]/.test(password)) {
    score += 1;
  } else {
    feedback.push("Include special characters");
  }

  // Common password patterns to avoid
  const commonPatterns = [
    "password",
    "123456",
    "qwerty",
    "admin",
    "letmein",
    "welcome",
  ];

  if (commonPatterns.some((p) => password.toLowerCase().includes(p))) {
    score = Math.max(0, score - 2);
    feedback.push("Avoid common password patterns");
  }

  return {
    valid: score >= 4 && password.length >= 8,
    score,
    feedback,
  };
}

/**
 * Generate a secure random token
 */
export function generateToken(length: number = 32): string {
  return randomBytes(length).toString("hex");
}

/**
 * Hash a token for storage (for reset tokens, etc.)
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
