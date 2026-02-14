export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function validateSampleMessages(samples: unknown): { valid: boolean; error?: string } {
  if (!Array.isArray(samples)) return { valid: false, error: "Sample messages must be an array" };
  if (samples.length < 2) return { valid: false, error: "At least 2 sample messages are required" };
  if (samples.length > 5) return { valid: false, error: "Maximum 5 sample messages allowed" };
  for (const msg of samples) {
    if (typeof msg !== "string" || msg.trim().length === 0) return { valid: false, error: "All sample messages must be non-empty strings" };
    if (msg.length > 320) return { valid: false, error: "Each sample message must be under 320 characters" };
  }
  return { valid: true };
}
