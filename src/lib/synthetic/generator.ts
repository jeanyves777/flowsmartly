import crypto from "crypto";
import { prisma } from "@/lib/db/client";
import { SYNTHETIC_EMAIL_DOMAIN } from "./config";
import { NICHE_KEYS } from "./niches";
import { randomName, buildUsername, buildBio } from "./names";

/**
 * Creates synthetic personas: real `User` rows flagged isSynthetic with a
 * matching `SyntheticPersona`. Persona creation is FAST and never blocks on the
 * (rate-limited) AI-face source — avatars are filled in afterwards by
 * `backfillAvatars()` (see avatars.ts), which self-throttles. Accounts are aged
 * (staggered createdAt) so they don't all appear at once.
 */

// Timezone pool → staggers each persona's daily active window across the globe.
// Paired with a default content language.
const TZ_POOL: Array<{ tz: string; lang: string }> = [
  { tz: "America/New_York", lang: "en" },
  { tz: "America/Los_Angeles", lang: "en" },
  { tz: "America/Chicago", lang: "en" },
  { tz: "America/Sao_Paulo", lang: "en" },
  { tz: "Europe/London", lang: "en" },
  { tz: "Europe/Paris", lang: "fr" },
  { tz: "Europe/Berlin", lang: "en" },
  { tz: "Africa/Lagos", lang: "en" },
  { tz: "Africa/Abidjan", lang: "fr" },
  { tz: "Asia/Kolkata", lang: "en" },
  { tz: "Asia/Dubai", lang: "en" },
  { tz: "Asia/Tokyo", lang: "en" },
  { tz: "Australia/Sydney", lang: "en" },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

async function uniqueUsername(first: string, last: string): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const candidate = buildUsername(first, last);
    const exists = await prisma.user.findUnique({ where: { username: candidate } });
    if (!exists) return candidate;
  }
  // last resort: append random hex
  return `${buildUsername(first, last)}${crypto.randomBytes(2).toString("hex")}`;
}

export interface GenerateResult {
  created: number;
  byNiche: Record<string, number>;
}

/**
 * Generate `count` personas, evenly distributed across `niches` (defaults to all).
 * Fast — no avatar fetching here. Avatars are backfilled separately.
 */
export async function createPersonas(
  count: number,
  niches: string[] = NICHE_KEYS
): Promise<GenerateResult> {
  const pool = niches.length ? niches : NICHE_KEYS;
  const result: GenerateResult = { created: 0, byNiche: {} };

  for (let i = 0; i < count; i++) {
    const niche = pool[i % pool.length];
    const { first, last, name } = randomName();
    const username = await uniqueUsername(first, last);
    const tzEntry = pick(TZ_POOL);
    const bio = buildBio(niche);

    // Unique non-routable email (email send is hard-blocked for this domain).
    const email = `${username}.${crypto.randomBytes(3).toString("hex")}@${SYNTHETIC_EMAIL_DOMAIN}`;

    // Account aging: spread createdAt across the last ~75 days.
    const ageDays = randInt(0, 75);
    const createdAt = new Date(Date.now() - ageDays * 24 * 3600 * 1000 - randInt(0, 86400) * 1000);

    // Active window in the persona's own timezone (mostly daytime/evening).
    const activeStartHour = randInt(6, 11);
    const activeEndHour = randInt(19, 23);

    let user;
    try {
      user = await prisma.user.create({
        data: {
          email,
          name,
          username,
          bio,
          isSynthetic: true,
          emailVerified: true,
          emailVerifiedAt: createdAt,
          plan: "STARTER",
          timezone: tzEntry.tz,
          language: tzEntry.lang,
          country: null,
          createdAt,
          onboardingComplete: true,
          syntheticPersona: {
            create: {
              niche,
              bio,
              language: tzEntry.lang,
              activeStartHour,
              activeEndHour,
              dailyLikes: randInt(4, 14),
              dailyComments: randInt(1, 4),
              dailyFollows: randInt(0, 2),
              postChance: randInt(8, 25),
              enabled: true,
            },
          },
        },
      });
    } catch {
      continue; // collision or transient error — skip this one
    }

    result.created++;
    result.byNiche[niche] = (result.byNiche[niche] || 0) + 1;
  }

  return result;
}

/** Count existing synthetic personas, broken down by niche. */
export async function personaStats(): Promise<{
  total: number;
  enabled: number;
  byNiche: Record<string, number>;
}> {
  const [total, enabled, grouped] = await Promise.all([
    prisma.syntheticPersona.count(),
    prisma.syntheticPersona.count({ where: { enabled: true } }),
    prisma.syntheticPersona.groupBy({ by: ["niche"], _count: { _all: true } }),
  ]);
  const byNiche: Record<string, number> = {};
  for (const g of grouped) byNiche[g.niche] = g._count._all;
  return { total, enabled, byNiche };
}
