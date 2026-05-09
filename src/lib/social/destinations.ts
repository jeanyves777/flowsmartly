export const SOCIAL_ACCOUNT_DESTINATION_PREFIX = "account:";

export function socialAccountDestinationId(accountId: string): string {
  return `${SOCIAL_ACCOUNT_DESTINATION_PREFIX}${accountId}`;
}

export function isSocialAccountDestination(destination: string | null | undefined): boolean {
  return typeof destination === "string" && destination.startsWith(SOCIAL_ACCOUNT_DESTINATION_PREFIX);
}

export function socialAccountIdFromDestination(destination: string | null | undefined): string | null {
  if (!isSocialAccountDestination(destination)) return null;
  const accountId = String(destination).slice(SOCIAL_ACCOUNT_DESTINATION_PREFIX.length).trim();
  return accountId || null;
}

export function baseSocialPlatform(platform: string | null | undefined): string {
  const normalized = String(platform || "").trim().toLowerCase();
  if (normalized.startsWith("facebook_")) return "facebook";
  if (normalized.startsWith("instagram_")) return "instagram";
  return normalized;
}
