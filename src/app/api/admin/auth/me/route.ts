import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getAdminSession, cleanExpiredSessions } from "@/lib/admin/auth";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import { auditAdmin, AuditAction } from "@/lib/audit/logger";

export async function GET() {
  try {
    const session = await getAdminSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Not authenticated" } },
        { status: 401 }
      );
    }

    // Fetch full admin data for profile page
    const admin = await prisma.adminUser.findUnique({
      where: { id: session.adminId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isSuperAdmin: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    // Clean expired sessions in the background (fire-and-forget)
    cleanExpiredSessions().catch(() => {});

    return NextResponse.json({
      success: true,
      data: {
        admin: {
          ...session.admin,
          lastLoginAt: admin?.lastLoginAt?.toISOString() || null,
          createdAt: admin?.createdAt?.toISOString() || null,
        },
      },
    });
  } catch (error) {
    console.error("Admin me error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to get session" } },
      { status: 500 }
    );
  }
}

/** PUT /api/admin/auth/me — Update admin profile (name, email) */
export async function PUT(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, email } = body;

    if (!name?.trim() && !email?.trim()) {
      return NextResponse.json(
        { success: false, error: { message: "Name or email is required" } },
        { status: 400 }
      );
    }

    const updateData: Record<string, string> = {};
    if (name?.trim()) updateData.name = name.trim();
    if (email?.trim()) {
      const normalizedEmail = email.trim().toLowerCase();
      // Check for duplicate email
      const existing = await prisma.adminUser.findUnique({
        where: { email: normalizedEmail },
      });
      if (existing && existing.id !== session.adminId) {
        return NextResponse.json(
          { success: false, error: { message: "Email already in use" } },
          { status: 409 }
        );
      }
      updateData.email = normalizedEmail;
    }

    await prisma.adminUser.update({
      where: { id: session.adminId },
      data: updateData,
    });

    await auditAdmin(
      AuditAction.ADMIN_ACTION,
      session.adminId,
      "AdminUser",
      session.adminId,
      { action: "profile_updated", fields: Object.keys(updateData) }
    );

    return NextResponse.json({ success: true, message: "Profile updated" });
  } catch (error) {
    console.error("Admin profile update error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update profile" } },
      { status: 500 }
    );
  }
}

/** POST /api/admin/auth/me — Change password */
export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: { message: "Current and new password are required" } },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: { message: "New password must be at least 8 characters" } },
        { status: 400 }
      );
    }

    // Verify current password
    const admin = await prisma.adminUser.findUnique({
      where: { id: session.adminId },
    });

    if (!admin) {
      return NextResponse.json(
        { success: false, error: { message: "Admin not found" } },
        { status: 404 }
      );
    }

    const isValid = await verifyPassword(currentPassword, admin.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: { message: "Current password is incorrect" } },
        { status: 401 }
      );
    }

    // Update password
    const newHash = await hashPassword(newPassword);
    await prisma.adminUser.update({
      where: { id: session.adminId },
      data: { passwordHash: newHash },
    });

    await auditAdmin(
      AuditAction.ADMIN_ACTION,
      session.adminId,
      "AdminUser",
      session.adminId,
      { action: "password_changed" }
    );

    return NextResponse.json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("Admin password change error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to change password" } },
      { status: 500 }
    );
  }
}
