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
 * Custom domain server block for a website. Proxies to the main Next.js
 * app (port 3000) which has middleware that detects the Host header and
 * rewrites the URL to /sites/{slug}/... before the /sites/[...path]/route.ts
 * serves the static file from sites-output/{slug}/.
 *
 * This preserves the basePath-baked URLs in the built site AND supports
 * internal links like /sites/{slug}/about being clicked from within the
 * served HTML on the custom domain.
 */
function customWebsiteDomainServerBlock(domain: string, _slug: string): string {
  return `# Custom domain: ${domain} → main app (middleware rewrites by Host)
server {
    listen 80;
    listen 443 ssl;
    server_name ${domain} www.${domain};

    # Use flowsmartly.com cert — Cloudflare 'Full' mode doesn't require hostname match
    ssl_certificate /etc/letsencrypt/live/flowsmartly.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/flowsmartly.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_read_timeout 60s;
        proxy_buffering off;
        client_max_body_size 50M;
    }
}`;
}

/**
 * Custom domain server block for an SSR STORE app. Store has basePath
 * /stores/{slug}/ so nginx rewrites the incoming URL to prepend that
 * basePath before proxying to the store's PM2 process.
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

function websiteLocationBlock(slug: string, _port: number): string {
  // Websites proxy to the main Next.js app (port 3000). The main app's
  // src/app/sites/[...path]/route.ts serves files from
  // /var/www/flowsmartly/sites-output/{slug}/ and also honors the
  // middleware's Host-header rewrites for custom domains. Doing this
  // inside the main app (instead of nginx direct serve) keeps a single
  // source of truth for basePath + trailingSlash + MIME types + rewrites.
  return `# Website: ${slug} -> main app /sites/[...path] route
location /sites/${slug}/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_http_version 1.1;
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
        status: "PUBLISHED",
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
  // Websites are static-export served by nginx directly — no upstream needed.
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
    const content = header + websiteLocationBlock(website.slug, 0);
    writeFileSync(join(LOCATIONS_DIR, `site-${website.slug}.conf`), content, "utf-8");
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
  // Website custom domains are static-file served (no PM2 proxy needed).
  for (const site of websites) {
    if (!site.customDomain) continue;
    domainBlocks.push(customWebsiteDomainServerBlock(site.customDomain, site.slug));
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
