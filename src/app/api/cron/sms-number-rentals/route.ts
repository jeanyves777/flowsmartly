import { NextRequest, NextResponse } from "next/server";

import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { prisma } from "@/lib/db/client";

/**
 * GET /api/cron/sms-number-rentals
 *
 * Charges the monthly SMS-line fee (number + A2P 10DLC campaign) for every
 * active SMS sender — the same amount whether the business runs its own campaign
 * or routes under our default system campaign. Runs daily (idempotent): a line
 * is due when it's never been charged or its last charge is ≥ ~30 days old; each
 * charge stamps `smsRentalChargedAt`, so a daily run bills a line once a month.
 * Insufficient balance leaves it due (retried next run). Protected by CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret") || request.nextUrl.searchParams.get("secret");
  const expected = process.env.CRON_SECRET || "flowsmartly-cron-2026";
  if (secret !== expected) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const amount = await getDynamicCreditCost("SMS_LINE_MONTHLY").catch(() => 1500);
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const due = await prisma.marketingConfig.findMany({
      where: {
        smsEnabled: true,
        smsPhoneNumber: { not: null },
        OR: [{ smsRentalChargedAt: null }, { smsRentalChargedAt: { lte: cutoff } }],
      },
      select: { id: true, userId: true, smsPhoneNumber: true },
    });

    let charged = 0;
    let skipped = 0;
    for (const cfg of due) {
      try {
        const r = await creditService.deductCredits({
          userId: cfg.userId,
          type: TRANSACTION_TYPES.USAGE,
          amount,
          description: `SMS line rental · ${cfg.smsPhoneNumber || "number"} · monthly`,
          referenceType: "sms_line_rental",
          referenceId: cfg.id,
        });
        if (r.success) {
          await prisma.marketingConfig.update({ where: { id: cfg.id }, data: { smsRentalChargedAt: new Date() } });
          charged++;
        } else {
          skipped++; // not enough credits — leave it due, retried next run
        }
      } catch (e) {
        console.error("[cron/sms-number-rentals] charge failed for", cfg.id, e);
        skipped++;
      }
    }

    console.log(`[Cron] SMS line rentals: ${charged} charged, ${skipped} skipped, of ${due.length} due (@ ${amount} cr).`);
    return NextResponse.json({ success: true, due: due.length, charged, skipped, amount, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("[Cron] sms-number-rentals error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
