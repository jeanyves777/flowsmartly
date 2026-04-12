import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";
import { prisma } from "@/lib/db/client";
import { sendEmail } from "@/lib/email/index";
import { baseTemplate } from "@/lib/email/index";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * GET /api/admin/store-compliance/[id]
 * Get store compliance details and warning history.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const store = await prisma.store.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        complianceStatus: true,
        warningCount: true,
        lastWarningAt: true,
        lastWarningReason: true,
        suspendedAt: true,
        suspendedReason: true,
        isActive: true,
        user: { select: { email: true, name: true } },
      },
    });

    if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

    const warnings = await prisma.storeWarning.findMany({
      where: { storeId: id },
      orderBy: { createdAt: "desc" },
    });

    const feedbackStats = await prisma.orderFeedback.aggregate({
      where: { storeId: id },
      _avg: { rating: true },
      _count: { id: true },
    });

    const lowRatings = await prisma.orderFeedback.count({
      where: { storeId: id, rating: { lte: 2 } },
    });

    return NextResponse.json({
      success: true,
      data: {
        store,
        warnings,
        feedback: {
          avgRating: feedbackStats._avg.rating,
          totalReviews: feedbackStats._count.id,
          lowRatings,
        },
      },
    });
  } catch (err) {
    console.error("Store compliance GET error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/store-compliance/[id]
 * Issue a warning or suspend a store.
 * Body: { action: "warn" | "suspend" | "unsuspend", reason: string, details?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const { action, reason, details } = body;

    if (!action || !reason) {
      return NextResponse.json({ error: "action and reason required" }, { status: 400 });
    }

    const store = await prisma.store.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        warningCount: true,
        user: { select: { email: true, name: true } },
      },
    });

    if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

    const ownerEmail = store.user?.email;

    if (action === "warn") {
      const newCount = store.warningCount + 1;
      const severity = newCount >= 2 ? "final_warning" : "warning";

      // Create warning record
      await prisma.storeWarning.create({
        data: {
          storeId: id,
          reason,
          details,
          severity,
          issuedBy: session.adminId || "admin",
        },
      });

      // Update store compliance
      await prisma.store.update({
        where: { id },
        data: {
          warningCount: newCount,
          complianceStatus: newCount >= 2 ? "warning" : "warning",
          lastWarningAt: new Date(),
          lastWarningReason: reason,
        },
      });

      // Email store owner
      if (ownerEmail) {
        const isFinal = newCount >= 2;
        await sendEmail({
          to: ownerEmail,
          subject: `${isFinal ? "FINAL WARNING" : "Warning"}: Your store "${store.name}" requires attention`,
          html: baseTemplate(
            `<h2>${isFinal ? "Final Warning" : "Compliance Warning"}</h2>
             <p>Dear ${store.user?.name || "Store Owner"},</p>
             <p>We have identified an issue with your store <strong>${store.name}</strong> that requires your immediate attention:</p>
             <div class="highlight"><strong>Reason:</strong> ${reason}</div>
             ${details ? `<p style="margin-top:12px;">${details}</p>` : ""}
             ${isFinal
               ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;margin:16px 0;">
                    <strong style="color:#dc2626;">This is your final warning.</strong> Failure to resolve this issue may result in your store being suspended.
                  </div>`
               : `<p style="margin-top:12px;">This is warning <strong>${newCount}</strong>. Please resolve this issue to keep your store in good standing. After 2 warnings, your store may be suspended.</p>`
             }
             <a href="${APP_URL}/ecommerce/dashboard" class="button">Go to Store Dashboard</a>`,
            `Store compliance warning — ${store.name}`
          ),
        }).catch((e) => console.error("Warning email error:", e));
      }

      return NextResponse.json({ success: true, warningCount: newCount, severity });
    }

    if (action === "suspend") {
      await prisma.storeWarning.create({
        data: {
          storeId: id,
          reason,
          details,
          severity: "suspension",
          issuedBy: session.adminId || "admin",
        },
      });

      await prisma.store.update({
        where: { id },
        data: {
          complianceStatus: "suspended",
          suspendedAt: new Date(),
          suspendedReason: reason,
          isActive: false,
        },
      });

      if (ownerEmail) {
        await sendEmail({
          to: ownerEmail,
          subject: `Store Suspended: "${store.name}" has been suspended`,
          html: baseTemplate(
            `<h2>Store Suspended</h2>
             <p>Your store <strong>${store.name}</strong> has been suspended due to the following reason:</p>
             <div class="highlight"><strong>Reason:</strong> ${reason}</div>
             ${details ? `<p style="margin-top:12px;">${details}</p>` : ""}
             <p style="margin-top:16px;">To reinstate your store, please resolve the issues and contact our support team.</p>
             <a href="${APP_URL}/ecommerce/dashboard" class="button">Go to Store Dashboard</a>`,
            `Store suspended — ${store.name}`
          ),
        }).catch((e) => console.error("Suspension email error:", e));
      }

      return NextResponse.json({ success: true, status: "suspended" });
    }

    if (action === "unsuspend") {
      await prisma.store.update({
        where: { id },
        data: {
          complianceStatus: "good",
          suspendedAt: null,
          suspendedReason: null,
          warningCount: 0,
          isActive: true,
        },
      });

      if (ownerEmail) {
        await sendEmail({
          to: ownerEmail,
          subject: `Store Reinstated: "${store.name}" is active again`,
          html: baseTemplate(
            `<h2>Store Reinstated</h2>
             <p>Good news! Your store <strong>${store.name}</strong> has been reinstated and is now active again.</p>
             <p>Your warning count has been reset. Please ensure you continue to follow our guidelines.</p>
             <a href="${APP_URL}/ecommerce/dashboard" class="button">Go to Store Dashboard</a>`,
            `Store reinstated — ${store.name}`
          ),
        }).catch((e) => console.error("Reinstatement email error:", e));
      }

      return NextResponse.json({ success: true, status: "good" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("Store compliance POST error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
