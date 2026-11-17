import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

import { prisma } from "@/lib/db/client";
import { reconcileReservations, sweepReservations } from "@/lib/flowbuild/sweep";

/**
 * GET /api/cron/flowbuild-reservations
 *
 * The compensation sweep, exposed so a scheduler can run it. It releases every
 * reservation whose submission failed or whose TTL has passed with nothing settled
 * against it, and then reports the R3/R4 invariants without repairing them.
 *
 * Replay-safe: every release goes through a conditional close whose row count is the
 * claim, so running this twice — or two of it at once — releases each reservation
 * exactly once.
 *
 * Auth is `CRON_SECRET` with NO literal fallback. The neighbouring cron routes read
 * `process.env.CRON_SECRET || "flowsmartly-cron-2026"`; this one returns credits to
 * balances, so a hardcoded fallback here is a public write to the credit ledger.
 */

function secretMatches(presented: string | null, expected: string): boolean {
  if (presented === null) return false;
  const actual = Buffer.from(presented, "utf8");
  const wanted = Buffer.from(expected, "utf8");
  if (actual.length !== wanted.length) return false;
  return timingSafeEqual(actual, wanted);
}

export async function GET(request: NextRequest) {
  const expected = (process.env.CRON_SECRET ?? "").trim();
  if (expected === "") {
    console.error(
      "[flowbuild/reservations] CRON_SECRET is not configured; refusing to run a sweep " +
        "that writes to the credit ledger on an unauthenticated route",
    );
    return NextResponse.json({ error: "Sweep is not configured" }, { status: 503 });
  }
  const presented =
    request.headers.get("x-cron-secret") ?? request.nextUrl.searchParams.get("secret");
  if (!secretMatches(presented, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const report = await sweepReservations(prisma);
    const findings = await reconcileReservations(prisma);
    return NextResponse.json({
      success: true,
      examined: report.examined,
      released: report.released,
      creditsReturned: report.creditsReturned,
      skipped: report.skipped,
      discrepancies: report.discrepancies,
      invariantFindings: findings,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[flowbuild/reservations] sweep failed", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
