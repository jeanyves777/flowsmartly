/**
 * Cloudflare API client for DNS zone and record management.
 *
 * Used during custom domain setup to create zones, configure DNS records
 * (A + CNAME pointing to our server), and check SSL provisioning status.
 */

import dns from "dns";

// Force IPv4 for all DNS lookups — Cloudflare API tokens may have IPv4-only restrictions
dns.setDefaultResultOrder("ipv4first");

const CF_BASE = "https://api.cloudflare.com/client/v4";
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN || "";
const SERVER_IP = process.env.DOMAIN_SERVER_IP || "187.77.29.88";

const MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 1000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CfError {
  code: number;
  message: string;
}

interface CfResponse<T> {
  success: boolean;
  result?: T;
  errors?: CfError[];
  messages?: Array<{ code: number; message: string }>;
}

interface CfZone {
  id: string;
  name: string;
  status: string;
  name_servers: string[];
  original_name_servers?: string[];
  paused: boolean;
  type: string;
  activated_on?: string;
}

interface CfDnsRecord {
  id: string;
  zone_id: string;
  zone_name: string;
  name: string;
  type: string;
  content: string;
  proxiable: boolean;
  proxied: boolean;
  ttl: number;
  locked: boolean;
  created_on: string;
  modified_on: string;
}

interface CfSslVerification {
  certificate_status: string;
  brand_check: boolean;
  hostname: string;
  validation_type: string;
  cert_pack_uuid?: string;
}

// ---------------------------------------------------------------------------
// Generic request helper with retry logic
// ---------------------------------------------------------------------------

async function cfRequest<T>(
  path: string,
  options?: RequestInit
): Promise<CfResponse<T>> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${CF_BASE}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${CF_TOKEN}`,
          "Content-Type": "application/json",
          ...options?.headers,
        },
      });

      // Retry on rate-limit or server errors
      if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        console.error(
          `Cloudflare API error: ${res.status} on ${path}, retrying in ${backoff}ms (attempt ${attempt + 1}/${MAX_RETRIES})`
        );
        await sleep(backoff);
        continue;
      }

      const data: CfResponse<T> = await res.json();

      if (!data.success && data.errors?.length) {
        console.error("Cloudflare API error:", data.errors);
      }

      return data;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < MAX_RETRIES) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        console.error(
          `Cloudflare API network error on ${path}: ${lastError.message}, retrying in ${backoff}ms (attempt ${attempt + 1}/${MAX_RETRIES})`
        );
        await sleep(backoff);
        continue;
      }
    }
  }

  console.error("Cloudflare API error: all retries exhausted for", path);
  return {
    success: false,
    errors: [
      {
        code: 0,
        message: lastError?.message || "All retries exhausted",
      },
    ],
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether the Cloudflare API token is configured.
 */
export function isAvailable(): boolean {
  return CF_TOKEN.length > 0;
}

/**
 * Create a new Cloudflare zone for the given domain.
 * `jump_start: true` imports existing DNS records automatically.
 */
export async function createZone(
  domain: string
): Promise<{ zoneId: string; nameservers: string[]; status: string } | null> {
  const resp = await cfRequest<CfZone>("/zones", {
    method: "POST",
    body: JSON.stringify({ name: domain, jump_start: true }),
  });

  if (!resp.success || !resp.result) {
    console.error("Cloudflare API error: failed to create zone for", domain, resp.errors);
    return null;
  }

  return {
    zoneId: resp.result.id,
    nameservers: resp.result.name_servers,
    status: resp.result.status,
  };
}

/**
 * Get zone details by zone ID, including status, nameservers, and activation info.
 */
export async function getZone(zoneId: string): Promise<CfZone | null> {
  const resp = await cfRequest<CfZone>(`/zones/${zoneId}`);

  if (!resp.success || !resp.result) {
    console.error("Cloudflare API error: failed to get zone", zoneId, resp.errors);
    return null;
  }

  return resp.result;
}

/**
 * Look up a zone by domain name. Returns the zone if it exists, null otherwise.
 */
export async function getZoneByDomain(domain: string): Promise<CfZone | null> {
  const resp = await cfRequest<CfZone[]>(
    `/zones?name=${encodeURIComponent(domain)}`
  );

  if (!resp.success || !resp.result || resp.result.length === 0) {
    return null;
  }

  return resp.result[0];
}

/**
 * Delete a zone by zone ID.
 */
export async function deleteZone(zoneId: string): Promise<boolean> {
  const resp = await cfRequest<{ id: string }>(`/zones/${zoneId}`, {
    method: "DELETE",
  });

  if (!resp.success) {
    console.error("Cloudflare API error: failed to delete zone", zoneId, resp.errors);
  }

  return resp.success;
}

/**
 * Add a DNS record to a zone.
 */
export async function addDnsRecord(
  zoneId: string,
  record: {
    type: string;
    name: string;
    content: string;
    proxied?: boolean;
    ttl?: number;
  }
): Promise<{ recordId: string } | null> {
  const resp = await cfRequest<CfDnsRecord>(`/zones/${zoneId}/dns_records`, {
    method: "POST",
    body: JSON.stringify({
      type: record.type,
      name: record.name,
      content: record.content,
      proxied: record.proxied ?? false,
      ttl: record.ttl ?? 1, // 1 = automatic
    }),
  });

  if (!resp.success || !resp.result) {
    console.error(
      "Cloudflare API error: failed to add DNS record",
      record,
      resp.errors
    );
    return null;
  }

  return { recordId: resp.result.id };
}

/**
 * List all DNS records for a zone.
 */
export async function listDnsRecords(
  zoneId: string
): Promise<CfDnsRecord[]> {
  const resp = await cfRequest<CfDnsRecord[]>(
    `/zones/${zoneId}/dns_records`
  );

  if (!resp.success || !resp.result) {
    console.error("Cloudflare API error: failed to list DNS records for zone", zoneId, resp.errors);
    return [];
  }

  return resp.result;
}

/**
 * Delete a DNS record from a zone.
 */
export async function deleteDnsRecord(
  zoneId: string,
  recordId: string
): Promise<boolean> {
  const resp = await cfRequest<{ id: string }>(
    `/zones/${zoneId}/dns_records/${recordId}`,
    { method: "DELETE" }
  );

  if (!resp.success) {
    console.error(
      "Cloudflare API error: failed to delete DNS record",
      recordId,
      "in zone",
      zoneId,
      resp.errors
    );
  }

  return resp.success;
}

/**
 * Get SSL/TLS verification status for a zone.
 */
export async function getSslStatus(
  zoneId: string
): Promise<CfSslVerification[] | null> {
  const resp = await cfRequest<CfSslVerification[]>(
    `/zones/${zoneId}/ssl/verification`
  );

  if (!resp.success || !resp.result) {
    console.error("Cloudflare API error: failed to get SSL status for zone", zoneId, resp.errors);
    return null;
  }

  return resp.result;
}

/**
 * Set the SSL/TLS encryption mode for a zone.
 * "full" = encrypts between browser↔CF and CF↔origin (self-signed OK)
 * "strict" = same but requires valid origin cert
 * "flexible" = only browser↔CF encrypted (not recommended)
 */
export async function setSslMode(
  zoneId: string,
  mode: "off" | "flexible" | "full" | "strict" = "full"
): Promise<boolean> {
  const resp = await cfRequest<{ value: string }>(
    `/zones/${zoneId}/settings/ssl`,
    {
      method: "PATCH",
      body: JSON.stringify({ value: mode }),
    }
  );

  if (!resp.success) {
    console.error("Cloudflare API error: failed to set SSL mode for zone", zoneId, resp.errors);
    return false;
  }

  return true;
}

/**
 * Enable "Always Use HTTPS" for a zone — redirects all HTTP to HTTPS.
 */
export async function setAlwaysUseHttps(
  zoneId: string,
  enabled: boolean = true
): Promise<boolean> {
  const resp = await cfRequest<{ value: string }>(
    `/zones/${zoneId}/settings/always_use_https`,
    {
      method: "PATCH",
      body: JSON.stringify({ value: enabled ? "on" : "off" }),
    }
  );

  if (!resp.success) {
    console.error("Cloudflare API error: failed to set always_use_https for zone", zoneId, resp.errors);
    return false;
  }

  return true;
}

/**
 * Enable automatic HTTPS rewrites — fixes mixed content by rewriting HTTP URLs to HTTPS.
 */
export async function setAutoHttpsRewrites(
  zoneId: string,
  enabled: boolean = true
): Promise<boolean> {
  const resp = await cfRequest<{ value: string }>(
    `/zones/${zoneId}/settings/automatic_https_rewrites`,
    {
      method: "PATCH",
      body: JSON.stringify({ value: enabled ? "on" : "off" }),
    }
  );

  if (!resp.success) {
    console.error("Cloudflare API error: failed to set automatic_https_rewrites for zone", zoneId, resp.errors);
    return false;
  }

  return true;
}

/**
 * Set minimum TLS version for a zone (default: 1.2).
 */
export async function setMinTlsVersion(
  zoneId: string,
  version: "1.0" | "1.1" | "1.2" | "1.3" = "1.2"
): Promise<boolean> {
  const resp = await cfRequest<{ value: string }>(
    `/zones/${zoneId}/settings/min_tls_version`,
    {
      method: "PATCH",
      body: JSON.stringify({ value: version }),
    }
  );

  if (!resp.success) {
    console.error("Cloudflare API error: failed to set min_tls_version for zone", zoneId, resp.errors);
    return false;
  }

  return true;
}

/**
 * Apply recommended SSL/security settings to a zone.
 * Called after zone creation to ensure domains are properly secured.
 */
export async function configureZoneSecurity(zoneId: string): Promise<void> {
  await Promise.all([
    setSslMode(zoneId, "full"),
    setAlwaysUseHttps(zoneId, true),
    setAutoHttpsRewrites(zoneId, true),
    setMinTlsVersion(zoneId, "1.2"),
  ]);
}

/**
 * Convenience function to configure DNS records for a store/site domain.
 *
 * Creates:
 *   - A record:     `domain` -> SERVER_IP (proxied, automatic TTL)
 *   - CNAME record: `www.domain` -> `domain` (proxied, automatic TTL)
 *
 * Returns an array of created record IDs, or null if any creation failed.
 */
export async function configureStoreDns(
  zoneId: string,
  domain: string
): Promise<string[] | null> {
  const aRecord = await addDnsRecord(zoneId, {
    type: "A",
    name: domain,
    content: SERVER_IP,
    proxied: true,
    ttl: 1,
  });

  if (!aRecord) {
    console.error(
      "Cloudflare API error: failed to create A record for",
      domain
    );
    return null;
  }

  const cnameRecord = await addDnsRecord(zoneId, {
    type: "CNAME",
    name: `www.${domain}`,
    content: domain,
    proxied: true,
    ttl: 1,
  });

  if (!cnameRecord) {
    console.error(
      "Cloudflare API error: failed to create CNAME record for",
      `www.${domain}`
    );
    return null;
  }

  return [aRecord.recordId, cnameRecord.recordId];
}
