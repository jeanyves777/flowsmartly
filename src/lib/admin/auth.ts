import { prisma } from "@/lib/db/client";
import { cookies } from "next/headers";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { nanoid } from "nanoid";
import { auditAdmin, AuditAction, AuditCategory, AuditSeverity, auditLog } from "@/lib/audit/logger";

// Cookie name for admin session
const ADMIN_TOKEN_COOKIE = "admin_token";

// Cookie options
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: 8 * 60 * 60, // 8 hours
};

export interface AdminSession {
  adminId: string;
  sessionId: string;
  admin: {
    id: string;
    email: string;
    name: string;
    role: string;
    permissions: string[];
    isSuperAdmin: boolean;
  };
}

// Admin roles and permissions
export const AdminRole = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  MODERATOR: "MODERATOR",
  VIEWER: "VIEWER",
} as const;

export const AdminPermission = {
  // Users
  VIEW_USERS: "VIEW_USERS",
  EDIT_USERS: "EDIT_USERS",
  DELETE_USERS: "DELETE_USERS",
  BAN_USERS: "BAN_USERS",

  // Content
  VIEW_CONTENT: "VIEW_CONTENT",
  MODERATE_CONTENT: "MODERATE_CONTENT",
  DELETE_CONTENT: "DELETE_CONTENT",

  // Analytics
  VIEW_ANALYTICS: "VIEW_ANALYTICS",
  EXPORT_ANALYTICS: "EXPORT_ANALYTICS",

  // Audit
  VIEW_AUDIT_LOGS: "VIEW_AUDIT_LOGS",
  EXPORT_AUDIT_LOGS: "EXPORT_AUDIT_LOGS",

  // System
  VIEW_SETTINGS: "VIEW_SETTINGS",
  EDIT_SETTINGS: "EDIT_SETTINGS",

  // Admin management
  VIEW_ADMINS: "VIEW_ADMINS",
  MANAGE_ADMINS: "MANAGE_ADMINS",
} as const;

// Default permissions per role
export const RolePermissions: Record<string, string[]> = {
  [AdminRole.SUPER_ADMIN]: Object.values(AdminPermission),
  [AdminRole.ADMIN]: [
    AdminPermission.VIEW_USERS,
    AdminPermission.EDIT_USERS,
    AdminPermission.BAN_USERS,
    AdminPermission.VIEW_CONTENT,
    AdminPermission.MODERATE_CONTENT,
    AdminPermission.DELETE_CONTENT,
    AdminPermission.VIEW_ANALYTICS,
    AdminPermission.VIEW_AUDIT_LOGS,
    AdminPermission.VIEW_SETTINGS,
  ],
  [AdminRole.MODERATOR]: [
    AdminPermission.VIEW_USERS,
    AdminPermission.VIEW_CONTENT,
    AdminPermission.MODERATE_CONTENT,
    AdminPermission.VIEW_ANALYTICS,
  ],
  [AdminRole.VIEWER]: [
    AdminPermission.VIEW_USERS,
    AdminPermission.VIEW_CONTENT,
    AdminPermission.VIEW_ANALYTICS,
  ],
};

/**
 * Get current admin session
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_TOKEN_COOKIE)?.value;

    if (!token) {
      return null;
    }

    // Find session
    const session = await prisma.adminSession.findUnique({
      where: { token },
      include: {
        admin: true,
      },
    });

    if (!session || session.expiresAt < new Date()) {
      return null;
    }

    // Check if admin is still active
    if (!session.admin.isActive) {
      return null;
    }

    const permissions = session.admin.isSuperAdmin
      ? Object.values(AdminPermission)
      : JSON.parse(session.admin.permissions || "[]");

    return {
      adminId: session.admin.id,
      sessionId: session.id,
      admin: {
        id: session.admin.id,
        email: session.admin.email,
        name: session.admin.name,
        role: session.admin.role,
        permissions,
        isSuperAdmin: session.admin.isSuperAdmin,
      },
    };
  } catch (error) {
    console.error("Get admin session error:", error);
    return null;
  }
}

/**
 * Admin login
 */
export async function adminLogin(
  email: string,
  password: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ success: boolean; error?: string; admin?: AdminSession["admin"] }> {
  try {
    // Find admin
    const admin = await prisma.adminUser.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!admin) {
      await auditLog({
        action: AuditAction.LOGIN_FAILED,
        category: AuditCategory.ADMIN,
        severity: AuditSeverity.WARNING,
        metadata: { email, reason: "Admin not found" },
      });
      return { success: false, error: "Invalid credentials" };
    }

    if (!admin.isActive) {
      await auditLog({
        action: AuditAction.LOGIN_FAILED,
        category: AuditCategory.ADMIN,
        severity: AuditSeverity.WARNING,
        userId: admin.id,
        metadata: { reason: "Account deactivated" },
      });
      return { success: false, error: "Account is deactivated" };
    }

    // Verify password
    const isValid = await verifyPassword(password, admin.passwordHash);
    if (!isValid) {
      await auditLog({
        action: AuditAction.LOGIN_FAILED,
        category: AuditCategory.ADMIN,
        severity: AuditSeverity.WARNING,
        userId: admin.id,
        metadata: { reason: "Invalid password" },
      });
      return { success: false, error: "Invalid credentials" };
    }

    // Create session
    const token = nanoid(64);
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours

    await prisma.adminSession.create({
      data: {
        adminId: admin.id,
        token,
        ipAddress,
        userAgent,
        expiresAt,
      },
    });

    // Update last login
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
      },
    });

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set(ADMIN_TOKEN_COOKIE, token, COOKIE_OPTIONS);

    // Log successful login
    await auditAdmin(
      AuditAction.ADMIN_LOGIN,
      admin.id,
      "AdminUser",
      admin.id,
      { ipAddress }
    );

    const permissions = admin.isSuperAdmin
      ? Object.values(AdminPermission)
      : JSON.parse(admin.permissions || "[]");

    return {
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        permissions,
        isSuperAdmin: admin.isSuperAdmin,
      },
    };
  } catch (error) {
    console.error("Admin login error:", error);
    return { success: false, error: "Login failed" };
  }
}

/**
 * Admin logout
 */
export async function adminLogout(): Promise<void> {
  try {
    const session = await getAdminSession();
    const cookieStore = await cookies();

    if (session) {
      // Delete session from database
      await prisma.adminSession.delete({
        where: { id: session.sessionId },
      }).catch(() => {});

      // Log logout
      await auditAdmin(AuditAction.LOGOUT, session.adminId);
    }

    // Clear cookie
    cookieStore.delete(ADMIN_TOKEN_COOKIE);
  } catch (error) {
    console.error("Admin logout error:", error);
  }
}

/**
 * Create admin user (for setup)
 */
export async function createAdminUser(data: {
  email: string;
  password: string;
  name: string;
  role?: string;
  isSuperAdmin?: boolean;
  createdBy?: string;
}): Promise<{ success: boolean; admin?: { id: string; email: string }; error?: string }> {
  try {
    // Check if email already exists
    const existing = await prisma.adminUser.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (existing) {
      return { success: false, error: "Email already exists" };
    }

    const passwordHash = await hashPassword(data.password);
    const role = data.role || AdminRole.ADMIN;
    const permissions = RolePermissions[role] || [];

    const admin = await prisma.adminUser.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash,
        name: data.name,
        role,
        permissions: JSON.stringify(permissions),
        isSuperAdmin: data.isSuperAdmin || false,
        createdBy: data.createdBy,
      },
    });

    return {
      success: true,
      admin: { id: admin.id, email: admin.email },
    };
  } catch (error) {
    console.error("Create admin error:", error);
    return { success: false, error: "Failed to create admin" };
  }
}

/**
 * Check if admin has permission
 */
export function hasPermission(session: AdminSession | null, permission: string): boolean {
  if (!session) return false;
  if (session.admin.isSuperAdmin) return true;
  return session.admin.permissions.includes(permission);
}

/**
 * Check if any admin exists (for initial setup)
 */
export async function adminExists(): Promise<boolean> {
  const count = await prisma.adminUser.count();
  return count > 0;
}
