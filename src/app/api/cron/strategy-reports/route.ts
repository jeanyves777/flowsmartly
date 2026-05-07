import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = request.headers.get("authorization");
  const secretHeader = request.headers.get("x-cron-secret");
  return authHeader === `Bearer ${cronSecret}` || secretHeader === cronSecret;
}

function getAppOrigin(request: NextRequest) {
  const configuredOrigin =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL;
  if (configuredOrigin) return configuredOrigin.replace(/\/$/, "");

  const forwardedHost =
    request.headers.get("x-forwarded-host") || request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;

  return request.nextUrl.origin;
}

async function runMonthlyReportJob(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const cronSecret = process.env.CRON_SECRET!;
  const calculateUrl = new URL(
    "/api/content/strategy/score/calculate",
    getAppOrigin(request)
  );
  let body: string | undefined;

  if (request.method === "GET") {
    const payload: Record<string, string> = {};
    for (const key of ["month", "year", "userId", "userEmail"]) {
      const value = request.nextUrl.searchParams.get(key);
      if (value) payload[key] = value;
    }
    body = Object.keys(payload).length > 0 ? JSON.stringify(payload) : undefined;
  } else {
    const requestBody = await request.text();
    body = requestBody.trim() ? requestBody : undefined;
  }

  const response = await fetch(calculateUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${cronSecret}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body,
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);
  return NextResponse.json(data || { success: response.ok }, { status: response.status });
}

// GET and POST are both supported so external cron providers can call this route easily.
export async function GET(request: NextRequest) {
  return runMonthlyReportJob(request);
}

export async function POST(request: NextRequest) {
  return runMonthlyReportJob(request);
}
