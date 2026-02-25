import { prisma } from "@/lib/db/client";

/**
 * Generates a unique username from a name or email
 * Handles duplicates by appending random numbers
 */
export async function generateUsername(nameOrEmail: string): Promise<string> {
  // Clean the input
  let base = nameOrEmail
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "") // Remove special chars
    .slice(0, 15); // Max 15 chars

  if (!base) {
    base = "user";
  }

  // Try the base username first
  const existing = await prisma.user.findUnique({
    where: { username: base },
  });

  if (!existing) {
    return base;
  }

  // If taken, append random numbers until we find a free one
  for (let i = 0; i < 10; i++) {
    const suffix = Math.floor(Math.random() * 10000);
    const candidate = `${base}${suffix}`;

    const exists = await prisma.user.findUnique({
      where: { username: candidate },
    });

    if (!exists) {
      return candidate;
    }
  }

  // Fallback: use timestamp
  return `${base}${Date.now()}`;
}
