import { createHash } from "crypto";

// ── Configuration ──

const OPENSRS_URL =
  process.env.NODE_ENV === "production"
    ? "https://rr-n1-tor.opensrs.net:55443"
    : "https://horizon.opensrs.net:55443";

const OPENSRS_USERNAME = process.env.OPENSRS_USERNAME || "";
const OPENSRS_API_KEY = process.env.OPENSRS_API_KEY || "";

const MAX_RETRIES = 2;
const BASE_DELAY_MS = 1000;

// ── Default contact info (FlowSmartly as registrant/reseller) ──

const DEFAULT_CONTACT = {
  first_name: "FlowSmartly",
  last_name: "Inc",
  org_name: "FlowSmartly Inc",
  address1: "FlowSmartly Platform",
  city: "New York",
  state: "NY",
  postal_code: "10001",
  country: "US",
  phone: "+1.0000000000",
  email: "domains@flowsmartly.com",
};

// ── Types ──

export interface DomainSearchResult {
  domain: string;
  tld: string;
  available: boolean;
}

export interface RegisterDomainParams {
  domain: string;
  period?: number;
  regUsername: string;
  regPassword: string;
  nameservers?: string[];
  contact?: Partial<typeof DEFAULT_CONTACT>;
  whoisPrivacy?: boolean;
}

export interface RegisterDomainResult {
  orderId: string;
  domain: string;
  status: string;
}

export interface DomainInfo {
  domain: string;
  status: string;
  expiryDate: string;
  nameservers: string[];
  registrant: Record<string, unknown>;
  autoRenew: boolean;
  whoisPrivacy: boolean;
  attributes: Record<string, unknown>;
}

export interface RenewDomainResult {
  orderId: string;
  domain: string;
  expiryDate: string;
  status: string;
}

export interface OpenSrsResponse {
  responseCode: number;
  responseText: string;
  attributes: Record<string, unknown>;
}

// ── XML Helpers ──

function md5(input: string): string {
  return createHash("md5").update(input).digest("hex");
}

function generateSignature(xml: string): string {
  return md5(md5(xml + OPENSRS_API_KEY) + OPENSRS_API_KEY);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Recursively convert a JS value into OpenSRS XML elements.
 * - Objects become `<dt_assoc>` with `<item key="...">` children
 * - Arrays become `<dt_array>` with `<item key="N">` children (0-indexed)
 * - Primitives become text content
 */
function valueToXml(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (Array.isArray(value)) {
    const items = value
      .map((item, index) => `<item key="${index}">${valueToXml(item)}</item>`)
      .join("");
    return `<dt_array>${items}</dt_array>`;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const items = Object.entries(record)
      .map(
        ([key, val]) =>
          `<item key="${escapeXml(key)}">${valueToXml(val)}</item>`
      )
      .join("");
    return `<dt_assoc>${items}</dt_assoc>`;
  }

  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }

  return escapeXml(String(value));
}

/**
 * Build an OpenSRS XML request envelope.
 */
function buildXmlRequest(
  action: string,
  object: string,
  attributes: Record<string, unknown>
): string {
  const attrXml = valueToXml(attributes);

  return [
    `<?xml version='1.0' encoding='UTF-8' standalone='no' ?>`,
    `<!DOCTYPE OPS_envelope SYSTEM 'ops.dtd'>`,
    `<OPS_envelope>`,
    `<header><version>0.9</version></header>`,
    `<body>`,
    `<data_block>`,
    `<dt_assoc>`,
    `<item key="protocol">XCP</item>`,
    `<item key="action">${escapeXml(action)}</item>`,
    `<item key="object">${escapeXml(object)}</item>`,
    `<item key="attributes">${attrXml}</item>`,
    `</dt_assoc>`,
    `</data_block>`,
    `</body>`,
    `</OPS_envelope>`,
  ].join("");
}

// ── XML Response Parser ──

/**
 * Minimal regex-based parser for OpenSRS XML responses.
 * Handles dt_assoc, dt_array, and text items recursively.
 */
function parseXmlResponse(xml: string): OpenSrsResponse {
  // Parse items from a parent element's inner content
  function parseItems(content: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    let pos = 0;

    while (pos < content.length) {
      // Find next <item key="...">
      const itemStart = content.indexOf("<item ", pos);
      if (itemStart === -1) break;

      // Extract key
      const keyMatch = content
        .substring(itemStart)
        .match(/^<item\s+key="([^"]*)">/);
      if (!keyMatch) {
        pos = itemStart + 1;
        continue;
      }

      const key = keyMatch[1];
      const valueStart = itemStart + keyMatch[0].length;

      // Find the matching </item> — handle nesting
      let depth = 1;
      let searchPos = valueStart;
      while (depth > 0 && searchPos < content.length) {
        const nextOpen = content.indexOf("<item ", searchPos);
        const nextClose = content.indexOf("</item>", searchPos);

        if (nextClose === -1) break;

        if (nextOpen !== -1 && nextOpen < nextClose) {
          depth++;
          searchPos = nextOpen + 6;
        } else {
          depth--;
          if (depth === 0) {
            const innerContent = content.substring(valueStart, nextClose);
            result[key] = parseValue(innerContent.trim());
            pos = nextClose + 7; // length of "</item>"
          } else {
            searchPos = nextClose + 7;
          }
        }
      }

      if (depth !== 0) {
        // Couldn't find matching close, skip
        pos = valueStart;
      }
    }

    return result;
  }

  // Parse a single value — could be dt_assoc, dt_array, or text
  function parseValue(content: string): unknown {
    const trimmed = content.trim();

    // Check for dt_assoc
    const assocMatch = trimmed.match(
      /^<dt_assoc>([\s\S]*)<\/dt_assoc>$/
    );
    if (assocMatch) {
      return parseItems(assocMatch[1]);
    }

    // Check for dt_array
    const arrayMatch = trimmed.match(
      /^<dt_array>([\s\S]*)<\/dt_array>$/
    );
    if (arrayMatch) {
      const items = parseItems(arrayMatch[1]);
      // Convert numeric-keyed object to array
      const arr: unknown[] = [];
      const keys = Object.keys(items)
        .map(Number)
        .filter((n) => !isNaN(n))
        .sort((a, b) => a - b);
      for (const k of keys) {
        arr.push(items[String(k)]);
      }
      return arr;
    }

    // Plain text — unescape XML entities
    return unescapeXml(trimmed);
  }

  function unescapeXml(text: string): string {
    return text
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  }

  // Extract the body data_block content
  const bodyMatch = xml.match(
    /<body>\s*<data_block>([\s\S]*?)<\/data_block>\s*<\/body>/
  );
  if (!bodyMatch) {
    throw new Error("Invalid OpenSRS response: missing data_block");
  }

  const bodyContent = bodyMatch[1].trim();

  // The top-level should be a dt_assoc
  const topAssocMatch = bodyContent.match(
    /^<dt_assoc>([\s\S]*)<\/dt_assoc>$/
  );
  if (!topAssocMatch) {
    throw new Error("Invalid OpenSRS response: missing top-level dt_assoc");
  }

  const topItems = parseItems(topAssocMatch[1]);

  const responseCode = Number(topItems.response_code ?? topItems.is_success ?? -1);
  const responseText = String(topItems.response_text ?? "");
  const attributes =
    (topItems.attributes as Record<string, unknown>) ?? {};

  return { responseCode, responseText, attributes };
}

// ── HTTP Transport with Retry ──

async function sendRequest(
  action: string,
  object: string,
  attributes: Record<string, unknown>
): Promise<OpenSrsResponse> {
  const xml = buildXmlRequest(action, object, attributes);
  const signature = generateSignature(xml);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      const response = await fetch(OPENSRS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/xml",
          "X-Username": OPENSRS_USERNAME,
          "X-Signature": signature,
        },
        body: xml,
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        const statusText = response.statusText || "Unknown";
        // Retry on 429 (rate limit) and 5xx (server errors)
        if (response.status === 429 || response.status >= 500) {
          lastError = new Error(
            `OpenSRS HTTP ${response.status}: ${statusText}`
          );
          continue;
        }
        throw new Error(`OpenSRS HTTP ${response.status}: ${statusText}`);
      }

      const text = await response.text();
      return parseXmlResponse(text);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));

      // Retry on network/timeout errors
      const isTransient =
        error.name === "TimeoutError" ||
        error.name === "AbortError" ||
        error.message.includes("ECONNRESET") ||
        error.message.includes("ETIMEDOUT") ||
        error.message.includes("fetch failed");

      if (isTransient && attempt < MAX_RETRIES) {
        lastError = error;
        continue;
      }

      throw error;
    }
  }

  throw lastError || new Error("OpenSRS request failed after retries");
}

// ── Public API ──

/**
 * Check if OpenSRS API credentials are configured.
 */
export function isAvailable(): boolean {
  return Boolean(OPENSRS_USERNAME && OPENSRS_API_KEY);
}

/**
 * Search for domain availability across one or more TLDs.
 * Performs a LOOKUP for each TLD variant in parallel.
 */
export async function searchDomain(
  sld: string,
  tlds: string[] = ["com", "net", "org", "io", "co", "app", "dev"]
): Promise<DomainSearchResult[]> {
  const lookups = tlds.map(async (tld): Promise<DomainSearchResult> => {
    const domain = `${sld}.${tld}`;
    try {
      const result = await sendRequest("LOOKUP", "DOMAIN", { domain });

      // Response code 210 = available, 211 = not available
      const available = result.responseCode === 210;

      return { domain, tld, available };
    } catch {
      // On error, mark as unavailable rather than crashing the whole search
      return { domain, tld, available: false };
    }
  });

  return Promise.all(lookups);
}

/**
 * Register a new domain through OpenSRS.
 * Uses Cloudflare nameservers by default and FlowSmartly as registrant.
 */
export async function registerDomain(
  params: RegisterDomainParams
): Promise<RegisterDomainResult> {
  const {
    domain,
    period = 1,
    regUsername,
    regPassword,
    nameservers = ["ns1.cloudflare.com", "ns2.cloudflare.com"],
    contact = {},
    whoisPrivacy = true,
  } = params;

  const mergedContact = { ...DEFAULT_CONTACT, ...contact };

  // Build contact set — same contact for all roles
  const contactSet: Record<string, unknown> = {};
  for (const role of ["owner", "admin", "billing", "tech"]) {
    contactSet[role] = mergedContact;
  }

  // Custom nameservers flag
  const customNameservers = nameservers.length > 0 ? 1 : 0;

  const attributes: Record<string, unknown> = {
    domain,
    period,
    reg_username: regUsername,
    reg_password: regPassword,
    custom_nameservers: customNameservers,
    nameserver_list: nameservers,
    contact_set: contactSet,
    handle: "process",
    reg_type: "new",
    custom_tech_contact: 0,
  };

  if (whoisPrivacy) {
    attributes.whois_privacy_state = "enable";
  }

  const result = await sendRequest("SW_REGISTER", "DOMAIN", attributes);

  if (result.responseCode !== 200 && result.responseCode !== 1) {
    throw new Error(
      `Domain registration failed: ${result.responseText} (code: ${result.responseCode})`
    );
  }

  return {
    orderId: String(result.attributes.id ?? result.attributes.order_id ?? ""),
    domain,
    status: result.responseText,
  };
}

/**
 * Get full information about a registered domain.
 */
export async function getDomainInfo(domain: string): Promise<DomainInfo> {
  const result = await sendRequest("GET", "DOMAIN", {
    domain,
    type: "all_info",
  });

  if (result.responseCode !== 200) {
    throw new Error(
      `Failed to get domain info: ${result.responseText} (code: ${result.responseCode})`
    );
  }

  const attrs = result.attributes;

  // Extract nameservers from the response
  let nameservers: string[] = [];
  if (attrs.nameserver_list) {
    if (Array.isArray(attrs.nameserver_list)) {
      nameservers = (attrs.nameserver_list as Array<Record<string, unknown>>).map(
        (ns) => String(ns.name || ns)
      );
    } else if (typeof attrs.nameserver_list === "object") {
      const nsList = attrs.nameserver_list as Record<string, unknown>;
      nameservers = Object.values(nsList)
        .filter((v) => typeof v === "object" && v !== null)
        .map((ns) => String((ns as Record<string, unknown>).name || ns));
    }
  }

  return {
    domain,
    status: String(attrs.status ?? attrs.sponsoring_rsp ?? "unknown"),
    expiryDate: String(attrs.expiredate ?? attrs.registry_expiredate ?? ""),
    nameservers,
    registrant: (attrs.contact_set as Record<string, unknown>)?.owner as Record<string, unknown> ?? {},
    autoRenew: attrs.auto_renew === "1" || attrs.auto_renew === 1,
    whoisPrivacy:
      attrs.whois_privacy_state === "enable" ||
      attrs.whois_privacy_state === "enabled",
    attributes: attrs,
  };
}

/**
 * Renew a domain registration.
 */
export async function renewDomain(
  domain: string,
  period: number = 1
): Promise<RenewDomainResult> {
  // First get current expiry to set as currentexpiryear
  let currentExpiryYear: number | undefined;
  try {
    const info = await getDomainInfo(domain);
    if (info.expiryDate) {
      const year = new Date(info.expiryDate).getFullYear();
      if (!isNaN(year)) {
        currentExpiryYear = year;
      }
    }
  } catch {
    // If we can't get the info, proceed without it — the API may still accept
  }

  const attributes: Record<string, unknown> = {
    domain,
    period,
    handle: "process",
    auto_renew: 0,
  };

  if (currentExpiryYear) {
    attributes.currentexpiryear = currentExpiryYear;
  }

  const result = await sendRequest("RENEW", "DOMAIN", attributes);

  if (result.responseCode !== 200 && result.responseCode !== 1) {
    throw new Error(
      `Domain renewal failed: ${result.responseText} (code: ${result.responseCode})`
    );
  }

  return {
    orderId: String(result.attributes.id ?? result.attributes.order_id ?? ""),
    domain,
    expiryDate: String(
      result.attributes.registration_expiration_date ??
        result.attributes.expiredate ??
        ""
    ),
    status: result.responseText,
  };
}

/**
 * Update nameservers for a domain.
 */
export async function setNameservers(
  domain: string,
  nameservers: string[]
): Promise<{ success: boolean; message: string }> {
  const result = await sendRequest(
    "ADVANCED_UPDATE_NAMESERVERS",
    "DOMAIN",
    {
      domain,
      op_type: "assign",
      assign_ns: nameservers,
    }
  );

  if (result.responseCode !== 200 && result.responseCode !== 1) {
    throw new Error(
      `Nameserver update failed: ${result.responseText} (code: ${result.responseCode})`
    );
  }

  return {
    success: true,
    message: result.responseText,
  };
}
