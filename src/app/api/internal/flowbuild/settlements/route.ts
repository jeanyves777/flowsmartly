import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

import { prisma } from "@/lib/db/client";
import {
  billingAccountRef,
  isManagedSpendRefused,
  MANAGED_BILLING_ACCOUNT_MISMATCH,
  MANAGED_NO_OPEN_RESERVATION,
} from "@/lib/flowbuild/billing-account";
import { settleManagedCharge } from "@/lib/flowbuild/settle";

/**
 * POST /api/internal/flowbuild/settlements
 *
 * FlowBuild settles per paid call, over its own outbox. This is the product end.
 *
 * ## Auth: a shared secret with NO fallback of any kind
 *
 * `src/app/api/cron/credits/route.ts` reads `process.env.CRON_SECRET || "flowsmartly-
 * cron-2026"`. That pattern must not be copied onto a money endpoint: a hardcoded
 * fallback here is a PUBLIC WRITE to the credit ledger. An absent variable makes this
 * route answer 503 and log a configuration refusal, which is a deployment fault with a
 * deployment remedy and is never mistaken for a caller error.
 *
 * The comparison is `timingSafeEqual` over equal-length buffers. `===` on a secret leaks
 * its length and its matching prefix to anyone who can time the endpoint.
 *
 * ## Unknown event types are answered 200, deliberately
 *
 * FlowBuild's outbox fans EVERY event to EVERY destination with no per-destination
 * filter. A 4xx or 5xx on an unrecognised `event_type` would turn every unrelated run
 * event into a delivery failure and a retry storm, so this endpoint ignores what it does
 * not settle and says so in the body.
 */

export const SETTLEMENT_SECRET_ENV = "FLOWBUILD_SETTLEMENT_SECRET";
export const SETTLEMENT_HEADER = "x-flowbuild-settlement-secret";

/** The two event types that carry a `billing` block. A failed paid call is still paid. */
const SETTLED_EVENT_TYPES = new Set(["model.call_completed", "model.call_failed"]);

function secretMatches(presented: string | null, expected: string): boolean {
  if (presented === null) return false;
  const actual = Buffer.from(presented, "utf8");
  const wanted = Buffer.from(expected, "utf8");
  // Length first, because timingSafeEqual throws on a mismatch. A length is not a prefix.
  if (actual.length !== wanted.length) return false;
  return timingSafeEqual(actual, wanted);
}

export async function POST(request: NextRequest) {
  const expected = (process.env[SETTLEMENT_SECRET_ENV] ?? "").trim();
  if (expected === "") {
    console.error(
      `[flowbuild/settlements] ${SETTLEMENT_SECRET_ENV} is not configured; refusing to ` +
        "serve a credit-ledger write on an unauthenticated route",
    );
    return NextResponse.json({ error: "Settlement endpoint is not configured" }, { status: 503 });
  }
  if (!secretMatches(request.headers.get(SETTLEMENT_HEADER), expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    event_type?: unknown;
    run_id?: unknown;
    payload?: {
      step_id?: unknown;
      usage_record_id?: unknown;
      billing_account_kind?: unknown;
      billing_account_id?: unknown;
      customer_charge_pico_usd?: unknown;
    };
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Malformed body" }, { status: 400 });
  }

  if (typeof body.event_type !== "string" || !SETTLED_EVENT_TYPES.has(body.event_type)) {
    // Not an error. See the header comment: the outbox fans everything here.
    return NextResponse.json({ ignored: true });
  }

  const payload = body.payload ?? {};
  const usageRecordId = payload.usage_record_id;
  const stepId = payload.step_id;
  const runId = body.run_id;
  const kind = payload.billing_account_kind;
  const accountId = payload.billing_account_id;
  const chargeRaw = payload.customer_charge_pico_usd;

  if (
    typeof usageRecordId !== "string" ||
    typeof stepId !== "string" ||
    typeof runId !== "string" ||
    typeof kind !== "string" ||
    typeof accountId !== "string" ||
    (typeof chargeRaw !== "number" && typeof chargeRaw !== "string")
  ) {
    return NextResponse.json({ error: "Settlement fields are incomplete" }, { status: 400 });
  }

  try {
    const outcome = await settleManagedCharge(prisma, {
      usageRecordId,
      billingAccount: billingAccountRef(kind, accountId),
      flowbuildRunId: runId,
      flowbuildStepId: stepId,
      chargePicoUsd: BigInt(chargeRaw),
    });
    if (!outcome.settled) {
      return NextResponse.json({ settled: false, reason: "replay" });
    }
    return NextResponse.json({
      settled: true,
      state: outcome.state,
      creditsCharged: outcome.creditsCharged,
      shortfallCredits: outcome.shortfallCredits,
    });
  } catch (error: unknown) {
    if (isManagedSpendRefused(error)) {
      // 409 is the case FlowBuild must be able to SEE: it holds an obligation this
      // product will not accept. Swallowing it as a 200 would make the spend disappear.
      if (
        error.code === MANAGED_NO_OPEN_RESERVATION ||
        error.code === MANAGED_BILLING_ACCOUNT_MISMATCH
      ) {
        return NextResponse.json({ settled: false, reason: error.code }, { status: 409 });
      }
      return NextResponse.json({ settled: false, reason: error.code }, { status: 400 });
    }
    console.error("[flowbuild/settlements] settlement failed", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
