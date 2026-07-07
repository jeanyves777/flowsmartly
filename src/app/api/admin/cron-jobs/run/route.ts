import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, hasPermission } from "@/lib/admin/auth";

const ALLOWED_CRON_ENDPOINTS = new Set([
  "/api/cron/subscriptions",
  "/api/cron/credits",
  "/api/cron/domain-renewals",
  "/api/cron/reengagement",
  "/api/cron/publish-scheduled-posts",
  "/api/cron/recover-tasks",
  "/api/cron/engagement",
  "/api/content/automation/scheduler",
  "/api/content/strategy/reminders",
  "/api/content/strategy/weekly-digest",
  "/api/cron/intelligence-weekly",
  "/api/cron/listsmartly-monthly",
  "/api/cron/listsmartly-autopilot",
  "/api/ecommerce/trial-check",
  "/api/admin/stripe-sync",
  "/api/sequences/run",
]);

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 }
    );
  }

  if (!hasPermission(session, "EDIT_SETTINGS")) {
    return NextResponse.json(
      { success: false, error: { message: "Insufficient permissions" } },
      { status: 403 }
    );
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { success: false, error: { message: "CRON_SECRET is not configured" } },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  const method = body.method === "POST" ? "POST" : "GET";

  if (!ALLOWED_CRON_ENDPOINTS.has(endpoint)) {
    return NextResponse.json(
      { success: false, error: { message: "Cron endpoint is not allowed" } },
      { status: 400 }
    );
  }

  const targetUrl = new URL(endpoint, request.nextUrl.origin);
  const startedAt = Date.now();
  const response = await fetch(targetUrl, {
    method,
    headers: {
      "x-cron-secret": cronSecret,
      authorization: `Bearer ${cronSecret}`,
    },
    cache: "no-store",
  });

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    data = { message: await response.text().catch(() => "") };
  }

  return NextResponse.json({
    success: response.ok && (typeof data !== "object" || data === null || !("success" in data) || (data as { success?: boolean }).success !== false),
    status: response.status,
    duration: Date.now() - startedAt,
    data,
  });
}
