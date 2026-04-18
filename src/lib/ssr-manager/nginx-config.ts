/**
 * Nginx Config Generator — generates reverse proxy configs for independent SSR apps.
 *
 * Architecture:
 *  - /etc/nginx/conf.d/flowsmartly-upstreams.conf  — upstream blocks (valid at http level)
 *  - /etc/nginx/flowsmartly-locations/             — per-app location files (included inside server block)
 *  - /etc/nginx/sites-enabled/flowsmartly          — main server block, includes flowsmartly-locations/
 *
 * On dev (Windows), this is a no-op — apps are accessed directly by port.
 */

import { execSync } from "child_process";
import { writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";
import { prisma } from "@/lib/db/client";

const IS_PRODUCTION = process.platform === "linux";
const UPSTREAMS_CONF = "/etc/nginx/conf.d/flowsmartly-upstreams.conf";
const LOCATIONS_DIR = "/etc/nginx/flowsmartly-locations";

// ─── Upstream block (http context) ───────────────────────────────────────────

function upstreamBlock(name: string, port: number): string {
  return `upstream ${name} {\n    server 127.0.0.1:${port};\n}\n`;
}

// ─── Location block (server context) ─────────────────────────────────────────

function storeLocationBlock(slug: string, port: number): string {
  const safeName = `store_${slug.replace(/[^a-z0-9_-]/gi, "_")}`;
  const proxyHeaders = `    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 60s;
    proxy_buffering off;`;
  return `# Store: ${slug} -> port ${port}
# Redirect no-trailing-slash → trailing-slash (trailingSlash:true in store next.config)
location = /stores/${slug} {
    return 301 /stores/${slug}/;
}
location /stores/${slug}/ {
    proxy_pass http://${safeName};
    proxy_set_header X-Store-Slug ${slug};
${proxyHeaders}
}
`;
}

/**
 * Generate a dedicated nginx server block for a custom domain pointing to an SSR app.
 * The app has a basePath of /stores/{slug}/ or /sites/{slug}/, so we rewrite the
 * incoming request path (which lacks the basePath) before proxying upstream.
 */
function customDomainServerBlock(
  domain: string,
  upstreamName: string,
  basePath: string
): string {
  return `# Custom domain: ${domain} → ${upstreamName} (basePath ${basePath})
# Cloudflare terminates SSL from client; origin serves HTTP+HTTPS.
# Path is rewritten to add the app's basePath so upstream routes resolve.
server {
    listen 80;
    listen 443 ssl;
    server_name ${domain} www.${domain};

    # Use flowsmartly.com cert — Cloudflare 'Full' mode doesn't require hostname match
    ssl_certificate /etc/letsencrypt/live/flowsmartly.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/flowsmartly.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    # Root → basePath/ (trailingSlash:true requires the slash)
    location = / {
        proxy_pass http://${upstreamName}${basePath}/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 60s;
        proxy_buffering off;
    }

    # Everything else → basePath + original path
    location / {
        proxy_pass http://${upstreamName}${basePath}$request_uri;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 60s;
        proxy_buffering off;
    }
}`;
}

function websiteLocationBlock(slug: string, port: number): string {
  const safeName = `site_${slug.replace(/[^a-z0-9_-]/gi, "_")}`;
  return `# Website: ${slug} -> port ${port}
location /sites/${slug}/ {
    proxy_pass http://${safeName}/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Site-Slug ${slug};
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 60s;
    proxy_buffering off;
}
`;
}

// ─── Regenerate the entire nginx config and reload ───────────────────────────

export async function regenerateAndReload(): Promise<void> {
  if (!IS_PRODUCTION) {
    console.log("[nginx-config] Skipping on non-Linux (dev mode)");
    return;
  }

  // Ensure locations directory exists
  if (!existsSync(LOCATIONS_DIR)) {
    mkdirSync(LOCATIONS_DIR, { recursive: true });
  }

  // Remove legacy flowsmartly-apps.conf if it exists (V2 artifact — had location blocks at http level)
  const legacyAppsConf = "/etc/nginx/conf.d/flowsmartly-apps.conf";
  if (existsSync(legacyAppsConf)) {
    try { unlinkSync(legacyAppsConf); } catch {}
    console.log("[nginx-config] Removed legacy flowsmartly-apps.conf");
  }

  // Fetch all running SSR apps + their linked custom domains
  const [stores, websites, storeDomains] = await Promise.all([
    prisma.store.findMany({
      where: {
        ssrPort: { not: null },
        ssrStatus: { in: ["running", "starting"] },
        storeVersion: "independent",
      },
      select: { id: true, slug: true, ssrPort: true, customDomain: true },
    }),
    prisma.website.findMany({
      where: {
        ssrPort: { not: null },
        ssrStatus: { in: ["running", "starting"] },
      },
      select: { id: true, slug: true, ssrPort: true, customDomain: true },
    }),
    // All active domains linked to a store, for per-domain server blocks
    prisma.storeDomain.findMany({
      where: {
        storeId: { not: null },
        registrarStatus: { in: ["active", "registered", "ok"] },
      },
      select: { domainName: true, storeId: true },
    }),
  ]);

  const header = `# Auto-generated by FlowSmartly SSR Manager\n# DO NOT EDIT - regenerated on every deploy/start/stop\n# Generated: ${new Date().toISOString()}\n\n`;

  // 1. Write upstream blocks to conf.d (http context - valid here)
  let upstreams = header;
  for (const store of stores) {
    if (store.ssrPort) {
      const safeName = `store_${store.slug.replace(/[^a-z0-9_-]/gi, "_")}`;
      upstreams += upstreamBlock(safeName, store.ssrPort);
    }
  }
  for (const website of websites) {
    if (website.ssrPort) {
      const safeName = `site_${website.slug.replace(/[^a-z0-9_-]/gi, "_")}`;
      upstreams += upstreamBlock(safeName, website.ssrPort);
    }
  }
  writeFileSync(UPSTREAMS_CONF, upstreams, "utf-8");

  // 2. Write per-app location files (included inside the server block)
  // Remove stale location files first
  try {
    for (const f of readdirSync(LOCATIONS_DIR)) {
      unlinkSync(join(LOCATIONS_DIR, f));
    }
  } catch {}

  for (const store of stores) {
    if (store.ssrPort) {
      const content = header + storeLocationBlock(store.slug, store.ssrPort);
      writeFileSync(join(LOCATIONS_DIR, `store-${store.slug}.conf`), content, "utf-8");
    }
  }
  for (const website of websites) {
    if (website.ssrPort) {
      const content = header + websiteLocationBlock(website.slug, website.ssrPort);
      writeFileSync(join(LOCATIONS_DIR, `site-${website.slug}.conf`), content, "utf-8");
    }
  }

  // Build store-id → (slug, port) lookup for custom-domain server blocks
  const storeById = new Map(stores.map((s) => [s.id, s]));

  // Collect all (domain, upstreamName) pairs for per-domain server blocks
  const domainBlocks: string[] = [];
  for (const sd of storeDomains) {
    const store = storeById.get(sd.storeId!);
    if (!store?.ssrPort) continue;
    const safeName = `store_${store.slug.replace(/[^a-z0-9_-]/gi, "_")}`;
    const basePath = `/stores/${store.slug}`;
    domainBlocks.push(customDomainServerBlock(sd.domainName, safeName, basePath));
  }
  // Also handle website customDomain (set directly on Website.customDomain)
  for (const site of websites) {
    if (!site.customDomain || !site.ssrPort) continue;
    const safeName = `site_${site.slug.replace(/[^a-z0-9_-]/gi, "_")}`;
    const basePath = `/sites/${site.slug}`;
    domainBlocks.push(customDomainServerBlock(site.customDomain, safeName, basePath));
  }

  // Write one custom-domains.conf with all per-domain server blocks
  // (server blocks must be at http/top level — NOT inside flowsmartly-locations/
  // which is included inside a server block)
  const domainsConf = "/etc/nginx/conf.d/flowsmartly-custom-domains.conf";
  if (domainBlocks.length > 0) {
    writeFileSync(domainsConf, header + domainBlocks.join("\n\n"), "utf-8");
  } else if (existsSync(domainsConf)) {
    // No domains — remove the file so we don't have stale blocks
    unlinkSync(domainsConf);
  }

  console.log(`[nginx-config] Wrote ${stores.length} store + ${websites.length} website locations + ${domainBlocks.length} custom-domain server blocks`);

  // 3. Test and reload
  try {
    execSync("nginx -t", { stdio: "pipe", timeout: 10_000 });
    execSync("nginx -s reload", { stdio: "pipe", timeout: 10_000 });
    console.log("[nginx-config] Nginx reloaded successfully");
  } catch (err: any) {
    console.error("[nginx-config] Failed to reload nginx:", err.message);
    throw new Error(`Nginx config error: ${err.message}`);
  }
}

/**
 * Generate nginx upstream config for a custom domain pointing to an SSR app.
 * This is added to the main nginx server block for the custom domain.
 */
export function generateCustomDomainProxy(port: number): string {
  return `
    proxy_pass http://127.0.0.1:${port};
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 60s;
    proxy_buffering off;
`;
}
