export interface NormalizedEmailRecipient {
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  label: string;
}

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export function isValidEmailAddress(value: unknown): value is string {
  return typeof value === "string" && EMAIL_PATTERN.test(value.trim());
}

function splitName(name: string): Pick<NormalizedEmailRecipient, "firstName" | "lastName"> {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { firstName: parts[0] };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

export function parseEmailRecipientEntry(entry: unknown): NormalizedEmailRecipient | null {
  if (typeof entry !== "string") return null;

  const raw = entry.trim();
  if (!raw) return null;

  const bracketMatch = raw.match(/^"?([^"<]+?)"?\s*<([^>]+)>$/);
  const name = bracketMatch?.[1]?.trim();
  const email = (bracketMatch?.[2] || raw).trim().toLowerCase();

  if (!isValidEmailAddress(email)) return null;

  const nameParts = name ? splitName(name) : {};
  return {
    email,
    ...(name ? { name } : {}),
    ...nameParts,
    label: name ? `${name} <${email}>` : email,
  };
}

export function normalizeEmailRecipients(value: unknown): NormalizedEmailRecipient[] {
  let entries: unknown[] = [];

  if (Array.isArray(value)) {
    entries = value;
  } else if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        entries = Array.isArray(parsed) ? parsed : [];
      } catch {
        entries = [];
      }
    } else {
      entries = trimmed.split(/[,\n;]+/);
    }
  }

  const byEmail = new Map<string, NormalizedEmailRecipient>();
  for (const entry of entries) {
    const parsed = parseEmailRecipientEntry(entry);
    if (parsed && !byEmail.has(parsed.email)) {
      byEmail.set(parsed.email, parsed);
    }
  }

  return Array.from(byEmail.values());
}

export function parseJsonStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value !== "string" || !value.trim()) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}
