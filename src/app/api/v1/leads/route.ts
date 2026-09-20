import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";

/**
 * POST /api/v1/leads — the V5 public lead-capture contract.
 *
 * ============================================================================
 * THIS FILE IS A TEMPORARY COMPATIBILITY ADAPTER. IT IS NOT THE V5 API.
 * ============================================================================
 *
 * The V5 public site is live before the V5 backend is deployed. Rather than
 * have the V5 frontend post to a V4 endpoint — which would leak a retiring
 * system's contract into the new one and make the eventual migration a
 * frontend change — the V5-native contract is defined here, now, and served by
 * the V4 process. nginx routes /api/v1/* to V4 today (see
 * deploy/nginx-flowsmartly-v5.conf section 1).
 *
 * The V5 frontend knows only:
 *   - the path            /api/v1/leads
 *   - the request shape   LeadRequest below
 *   - the response shape  LeadResponse / ErrorResponse below
 *
 * It does not know that a DemoRequest row is written, that Prisma is involved,
 * or that V4 exists at all.
 *
 * TO RETIRE THIS ADAPTER, in order:
 *   1. Implement the SAME contract in the V5 API (d:\flowsmartly-v5/apps/api).
 *      The shapes below are the specification — match them exactly.
 *   2. Repoint the /api/v1/ proxy_pass in deploy/nginx-flowsmartly-v5.conf at
 *      the V5 API upstream.
 *   3. Migrate existing rows: DemoRequest where source LIKE 'v5-%'.
 *   4. Delete src/app/api/v1/ from this repo.
 *
 * None of those steps touches the V5 frontend or requires a static redeploy.
 *
 * Storage note: leads land in DemoRequest with a `v5-` source prefix, so they
 * appear in the existing admin surface at /admin/demo-requests from day one
 * and are trivially separable at migration time. No schema change was needed,
 * which keeps the bridge free of migration risk on a live database.
 */

/** What the V5 site can ask for. The `kind` drives the stored source tag. */
const LEAD_KINDS = ["early-access", "contact", "demo", "partner"] as const;
type LeadKind = (typeof LEAD_KINDS)[number];

const leadSchema = z.object({
  kind: z.enum(LEAD_KINDS),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  message: z.string().trim().max(1200).optional().or(z.literal("")),
  /** Free-form campaign/page attribution, e.g. "v5-early-access". */
  source: z.string().trim().max(80).optional(),
});

/**
 * The V5 source tag for each kind. The `v5-` prefix is the migration handle —
 * it is what separates V5-era leads from V4 book-demo rows in one query.
 */
const SOURCE_BY_KIND: Record<LeadKind, string> = {
  "early-access": "v5-early-access",
  contact: "v5-contact",
  demo: "v5-demo",
  partner: "v5-partner",
};

/** A second submission of the same email+kind inside this window is a duplicate. */
const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;

function emptyToNull(value?: string) {
  return value && value.trim().length > 0 ? value.trim() : null;
}

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || null;
  return request.headers.get("x-real-ip");
}

type ErrorCode =
  | "invalid_request"
  | "duplicate"
  | "server_error";

function errorResponse(
  code: ErrorCode,
  message: string,
  status: number,
  fields?: Record<string, string>
) {
  return NextResponse.json(
    { error: { code, message, ...(fields ? { fields } : {}) } },
    { status }
  );
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("invalid_request", "Send a JSON body.", 400);
  }

  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    // Field-level messages so the form can mark the offending input rather
    // than showing one generic banner.
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fields[key]) fields[key] = issue.message;
    }
    return errorResponse(
      "invalid_request",
      "Please check the highlighted fields and try again.",
      400,
      fields
    );
  }

  const data = parsed.data;
  const email = data.email.toLowerCase();
  const source = data.source?.trim() || SOURCE_BY_KIND[data.kind];

  try {
    // Same person, same kind, same day — tell them it already landed instead of
    // filing a second row. A duplicate is a normal outcome, not an error state.
    const existing = await prisma.demoRequest.findFirst({
      where: {
        email,
        source,
        createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
      },
      select: { id: true },
    });

    if (existing) {
      return errorResponse(
        "duplicate",
        "You are already on the list — we have your details and will be in touch.",
        409
      );
    }

    const lead = await prisma.demoRequest.create({
      data: {
        name: data.name,
        email,
        company: emptyToNull(data.company),
        phone: emptyToNull(data.phone),
        message: emptyToNull(data.message),
        source,
        ipAddress: getClientIp(request),
        userAgent: request.headers.get("user-agent"),
      },
      select: { id: true },
    });

    return NextResponse.json(
      { lead: { id: lead.id, status: "received" } },
      { status: 201 }
    );
  } catch (error) {
    // Never surface the underlying error to a public caller.
    console.error("[api/v1/leads] create failed:", error);
    return errorResponse(
      "server_error",
      "We could not save your details right now. Please try again in a moment.",
      500
    );
  }
}

/**
 * The static V5 site is served from the same origin as this route in
 * production, so no CORS headers are needed there. Local V5 development runs on
 * a different origin (expo start, :8081), so the preflight is answered only
 * outside production.
 */
export async function OPTIONS() {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 405 });
  }
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
