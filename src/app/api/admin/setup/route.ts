import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminExists, createAdminUser, AdminRole } from "@/lib/admin/auth";

const setupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(2),
});

export async function GET() {
  try {
    const exists = await adminExists();
    return NextResponse.json({
      success: true,
      data: { setupRequired: !exists },
    });
  } catch (error) {
    console.error("Admin check error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Check failed" } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check if admin already exists
    const exists = await adminExists();
    if (exists) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "Admin already exists. Setup not allowed." },
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = setupSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Invalid input",
            details: validation.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { email, password, name } = validation.data;

    // Create super admin
    const result = await createAdminUser({
      email,
      password,
      name,
      role: AdminRole.SUPER_ADMIN,
      isSuperAdmin: true,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: { message: result.error },
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { admin: result.admin },
    });
  } catch (error) {
    console.error("Admin setup error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Setup failed" } },
      { status: 500 }
    );
  }
}
