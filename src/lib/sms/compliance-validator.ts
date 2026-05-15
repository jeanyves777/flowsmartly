export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

const OPT_OUT_PATTERN = /\b(STOP|UNSUBSCRIBE|CANCEL|END|QUIT|HALT)\b/i;
const HELP_PATTERN = /\b(HELP|INFO|SUPPORT)\b/i;

export function includesOptOutLanguage(text: string): boolean {
  return OPT_OUT_PATTERN.test(text);
}

export function includesHelpLanguage(text: string): boolean {
  return HELP_PATTERN.test(text);
}

export function validateSampleMessages(
  samples: unknown,
  options: { businessName?: string } = {},
): { valid: boolean; error?: string } {
  if (!Array.isArray(samples)) return { valid: false, error: "Sample messages must be an array" };

  const trimmedSamples = samples
    .filter((msg): msg is string => typeof msg === "string")
    .map((msg) => msg.trim())
    .filter(Boolean);

  if (trimmedSamples.length < 2) return { valid: false, error: "At least 2 sample messages are required" };
  if (trimmedSamples.length > 5) return { valid: false, error: "Maximum 5 sample messages allowed" };

  for (const msg of trimmedSamples) {
    if (msg.length < 20) return { valid: false, error: "Each sample message must be at least 20 characters" };
    if (msg.length > 320) return { valid: false, error: "Each sample message must be under 320 characters" };
  }

  const hasOptOut = trimmedSamples.some(includesOptOutLanguage);
  if (!hasOptOut) {
    return { valid: false, error: "At least one sample message must include opt-out language such as Reply STOP to unsubscribe" };
  }

  const brand = options.businessName?.trim().toLowerCase();
  if (brand) {
    const brandTokens = brand.split(/[^a-z0-9]+/i).filter((token) => token.length >= 3);
    const hasBrandName = trimmedSamples.every((msg) => {
      const normalized = msg.toLowerCase();
      return (
        normalized.includes(brand) ||
        normalized.includes("{{businessname}}") ||
        brandTokens.some((token) => normalized.includes(token))
      );
    });
    if (!hasBrandName) {
      return { valid: false, error: "Each sample message must identify your business name or {{businessName}}" };
    }
  }

  return { valid: true };
}
