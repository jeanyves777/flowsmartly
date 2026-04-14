import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { stripe } from "@/lib/stripe";

const updateBankSchema = z.object({
  bankRouting: z.string().min(9).max(9).regex(/^\d{9}$/),
  bankAccount: z.string().min(4).max(17).regex(/^\d+$/),
  accountHolderName: z.string().min(1),
});

/**
 * POST - Update/replace the store owner's bank account on Stripe Connect
 */
export async function POST(request: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json({ error: "Stripe is not configured" }, { status: 500 });
    }

    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const store = await prisma.store.findFirst({
      where: { userId: session.userId },
      select: { stripeConnectAccountId: true, id: true },
    });

    if (!store?.stripeConnectAccountId) {
      return NextResponse.json(
        { error: "No payout account found." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = updateBankSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { bankRouting, bankAccount, accountHolderName } = validation.data;

    // List existing external accounts and delete them
    const existing = await stripe.accounts.listExternalAccounts(
      store.stripeConnectAccountId,
      { object: "bank_account", limit: 10 }
    );

    // Add new bank account first (so account always has one)
    const newBank = await stripe.accounts.createExternalAccount(
      store.stripeConnectAccountId,
      {
        external_account: {
          object: "bank_account",
          country: "US",
          currency: "usd",
          routing_number: bankRouting,
          account_number: bankAccount,
          account_holder_name: accountHolderName,
          account_holder_type: "individual",
        },
      }
    );

    // Remove old bank accounts (not the one we just added)
    for (const ext of existing.data) {
      if (ext.id !== newBank.id) {
        try {
          await stripe.accounts.deleteExternalAccount(
            store.stripeConnectAccountId,
            ext.id
          );
        } catch {
          // May fail if it's the only default — that's fine since we added new one first
        }
      }
    }

    return NextResponse.json({
      success: true,
      bankLast4: (newBank as any).last4 || "",
      bankName: (newBank as any).bank_name || "",
    });
  } catch (error: any) {
    console.error("Update bank account error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update bank account" },
      { status: 500 }
    );
  }
}
