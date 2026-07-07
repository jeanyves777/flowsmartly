const US_STATES: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
  "district of columbia": "DC",
};

const STATE_CODES = new Set(Object.values(US_STATES));

export interface LocationSignal {
  city?: string;
  state?: string;
}

export interface LeadValidationIssue {
  field: string;
  severity: "block" | "warn";
  message: string;
}

export function normalizeForCompare(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function extractLocationSignal(value?: string | null): LocationSignal {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return {};

  const normalized = normalizeForCompare(raw);
  const state = extractState(raw, normalized);
  const city = extractCity(raw, state);
  return { city, state };
}

export function validateAddressAgainstLocation(address: string | null | undefined, expected: LocationSignal, field = "address"): LeadValidationIssue[] {
  const actual = extractLocationSignal(address);
  const issues: LeadValidationIssue[] = [];

  if (expected.state && actual.state && expected.state !== actual.state) {
    issues.push({
      field,
      severity: "block",
      message: `State mismatch: expected ${expected.state}, found ${actual.state}.`,
    });
  }

  if (expected.city && actual.city && !isRegionalLocation(expected.city) && normalizeForCompare(expected.city) !== normalizeForCompare(actual.city)) {
    issues.push({
      field,
      severity: "block",
      message: `City mismatch: expected ${expected.city}, found ${actual.city}.`,
    });
  }

  return issues;
}

function isRegionalLocation(value: string): boolean {
  return /\b(county|parish|borough|region|area|metro|greater|near|around)\b/i.test(value);
}

export function mergeLocationSignals(...signals: LocationSignal[]): LocationSignal {
  const merged: LocationSignal = {};
  for (const signal of signals) {
    if (!merged.city && signal.city) merged.city = signal.city;
    if (!merged.state && signal.state) merged.state = signal.state;
  }
  return merged;
}

export function sameRootDomain(a?: string | null, b?: string | null): boolean | null {
  const da = rootDomain(a);
  const db = rootDomain(b);
  if (!da || !db) return null;
  return da === db;
}

export function rootDomain(value?: string | null): string | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const host = new URL(withProtocol).hostname.toLowerCase().replace(/^www\./, "");
    const parts = host.split(".").filter(Boolean);
    if (parts.length <= 2) return host;
    return parts.slice(-2).join(".");
  } catch {
    return null;
  }
}

function extractState(raw: string, normalized: string): string | undefined {
  const codeMatches = raw.toUpperCase().match(/\b[A-Z]{2}\b/g) || [];
  for (const code of codeMatches) {
    if (STATE_CODES.has(code)) return code;
  }

  for (const [name, code] of Object.entries(US_STATES)) {
    if (normalized.includes(name)) return code;
  }
  return undefined;
}

function extractCity(raw: string, state?: string): string | undefined {
  const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const stateIndex = state ? parts.findIndex((part) => new RegExp(`\\b${state}\\b`, "i").test(part)) : -1;
    const candidate = stateIndex > 0 ? parts[stateIndex - 1] : parts[parts.length - 2];
    return stripStreetPrefix(candidate);
  }

  const normalized = normalizeForCompare(raw);
  const words = normalized.split(" ").filter(Boolean);
  if (words.length <= 4 && !words.some((word) => STATE_CODES.has(word.toUpperCase()))) {
    return raw.trim();
  }
  return undefined;
}

function stripStreetPrefix(value: string): string | undefined {
  const cleaned = value
    .replace(/^\d+\s+/, "")
    .replace(/\b(?:st|street|rd|road|ave|avenue|hwy|highway|us|route|blvd|drive|dr|lane|ln)\b.*$/i, "")
    .trim();
  return cleaned || value.trim() || undefined;
}
