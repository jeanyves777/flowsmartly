import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminLogin } from "@/lib/admin/auth";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = loginSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "Invalid input" },
        },
        { status: 400 }
      );
    }

    const { email, password } = validation.data;

    // Get IP and user agent
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      undefined;
    const userAgent = request.headers.get("user-agent") || undefined;

    const result = await adminLogin(email, password, ipAddress, userAgent);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: { message: result.error },
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { admin: result.admin },
    });
  } catch (error) {
    console.error("Admin login error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { message: "Login failed" },
      },
      { status: 500 }
    );
  }
}
