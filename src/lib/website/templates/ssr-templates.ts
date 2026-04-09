/**
 * SSR-specific templates for V3 independent website apps.
 *
 * Websites are simpler than stores — they need API proxy for:
 * - Contact form submissions
 * - Analytics
 * - Newsletter signup
 * - Member auth (if gated content enabled)
 */

// ─── next.config.ts (SSR — NO output: 'export', NO basePath) ────────────────

export const TEMPLATE_SSR_NEXT_CONFIG = `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
`;

// ─── .env.local ──────────────────────────────────────────────────────────────

export function getWebsiteEnvLocal(
  websiteId: string,
  slug: string,
  apiGatewayUrl: string = "https://flowsmartly.com"
): string {
  return `# FlowSmartly API Gateway — change this to self-host with your own backend
API_GATEWAY_URL=${apiGatewayUrl}

# Website identifier
WEBSITE_ID=${websiteId}
WEBSITE_SLUG=${slug}
`;
}

// ─── API Gateway Client (src/lib/api-client.ts) ─────────────────────────────

export const TEMPLATE_WEBSITE_API_CLIENT = `/**
 * API Gateway Client — routes all backend calls to FlowSmartly.
 *
 * Backend operations (form submissions, analytics, newsletter) go through this client.
 * To self-host: change API_GATEWAY_URL in .env.local to point to your own backend.
 */

const API_BASE = process.env.API_GATEWAY_URL || "https://flowsmartly.com";
const WEBSITE_ID = process.env.WEBSITE_ID || "";

/**
 * Make a request to the FlowSmartly API gateway.
 * @param path - API path after /api/websites/{id}/, e.g. "/form-submissions", "/subscribe"
 * @param init - Fetch options
 */
export async function gateway(path: string, init?: RequestInit): Promise<Response> {
  const url = \`\${API_BASE}/api/websites/\${WEBSITE_ID}\${path}\`;
  return fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

export async function gatewayJSON<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await gateway(path, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(\`API error \${res.status}: \${text}\`);
  }
  return res.json();
}

export const API_URL = "/api";
export const GATEWAY_BASE = API_BASE;
export const WEBSITE_SLUG = process.env.WEBSITE_SLUG || "";
`;

// ─── API Proxy Route (src/app/api/[...path]/route.ts) ────────────────────────

export const TEMPLATE_WEBSITE_API_PROXY = `/**
 * API Proxy — forwards /api/* requests to the FlowSmartly gateway.
 *
 * Routes:
 *   /api/contact         → /api/websites/{id}/form-submissions
 *   /api/subscribe       → /api/websites/{id}/subscribe
 *   /api/members/login   → /api/websites/{id}/members/login
 *   /api/members/register→ /api/websites/{id}/members/register
 *   /api/analytics/*     → /api/analytics/*
 */

import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_GATEWAY_URL || "https://flowsmartly.com";
const WEBSITE_ID = process.env.WEBSITE_ID || "";

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, await params);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, await params);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, await params);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, await params);
}

async function proxyRequest(req: NextRequest, params: { path: string[] }) {
  const path = params.path.join("/");

  // Map local API paths to gateway paths
  let gatewayPath: string;
  if (path === "contact") {
    gatewayPath = \`/api/websites/\${WEBSITE_ID}/form-submissions\`;
  } else if (path === "subscribe") {
    gatewayPath = \`/api/websites/\${WEBSITE_ID}/subscribe\`;
  } else if (path.startsWith("members")) {
    gatewayPath = \`/api/websites/\${WEBSITE_ID}/\${path}\`;
  } else if (path.startsWith("analytics")) {
    gatewayPath = \`/api/\${path}\`;
  } else {
    gatewayPath = \`/api/websites/\${WEBSITE_ID}/\${path}\`;
  }

  const targetUrl = \`\${API_BASE}\${gatewayPath}\`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!["host", "connection", "transfer-encoding"].includes(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  headers.set("X-Website-Id", WEBSITE_ID);
  headers.set("X-Forwarded-Host", req.headers.get("host") || "");

  try {
    let body: BodyInit | null = null;
    if (req.method !== "GET" && req.method !== "HEAD") {
      body = await req.text();
    }

    const res = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    });

    const responseHeaders = new Headers();
    res.headers.forEach((value, key) => {
      if (!["transfer-encoding", "connection"].includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    return new NextResponse(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
    });
  } catch (err: any) {
    console.error(\`[api-proxy] Error forwarding \${req.method} \${path}:\`, err.message);
    return NextResponse.json(
      { error: "Gateway error", message: err.message },
      { status: 502 }
    );
  }
}
`;

// ─── SSR Analytics (uses local proxy) ────────────────────────────────────────

export function getWebsiteSSRTrackingScript(websiteId: string): string {
  return `"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function Analytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const consent = localStorage.getItem("cookie-consent");
    if (consent === "declined") return;

    fetch("/api/analytics/collect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "pageview",
        websiteId: "${websiteId}",
        path: pathname || window.location.pathname,
        title: document.title,
        referrer: document.referrer,
        userAgent: navigator.userAgent,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        language: navigator.language,
        url: window.location.href,
      }),
    }).catch(() => {});
  }, [pathname]);

  return null;
}
`;
}
