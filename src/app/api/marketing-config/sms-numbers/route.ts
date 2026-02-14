import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// GET /api/marketing-config/sms-numbers - Get available phone numbers
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const areaCode = searchParams.get("areaCode");

    // Get user's current config
    const config = await prisma.marketingConfig.findUnique({
      where: { userId: session.userId },
    });

    // TODO: Integrate with SMS provider API to get available numbers
    // For now, SMS service is not yet configured
    const availableNumbers: Array<{
      phoneNumber: string;
      locality: string;
      region: string;
    }> = [];

    const areaCodes: Array<{
      code: string;
      region: string;
    }> = [];

    return NextResponse.json({
      success: true,
      data: {
        currentNumber: config?.smsPhoneNumber || null,
        areaCodes,
        availableNumbers,
        smsEnabled: config?.smsEnabled || false,
      },
    });
  } catch (error) {
    console.error("Get SMS numbers error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch SMS numbers" } },
      { status: 500 }
    );
  }
}

// POST /api/marketing-config/sms-numbers - Provision a phone number
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { phoneNumber } = body;

    if (!phoneNumber) {
      return NextResponse.json(
        { success: false, error: { message: "Phone number is required" } },
        { status: 400 }
      );
    }

    // Validate phone number format
    if (!phoneNumber.match(/^\+1\d{10}$/)) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid phone number format" } },
        { status: 400 }
      );
    }

    // TODO: Integrate with SMS provider API to provision the number
    // For now, return error that SMS service is not yet configured
    return NextResponse.json(
      { success: false, error: { message: "SMS service is not yet configured. Please contact support." } },
      { status: 400 }
    );
  } catch (error) {
    console.error("Provision SMS number error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to provision phone number" } },
      { status: 500 }
    );
  }
}

// DELETE /api/marketing-config/sms-numbers - Release a phone number
export async function DELETE() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const config = await prisma.marketingConfig.findUnique({
      where: { userId: session.userId },
    });

    if (!config?.smsPhoneNumber) {
      return NextResponse.json(
        { success: false, error: { message: "No phone number to release" } },
        { status: 400 }
      );
    }

    // TODO: Integrate with SMS provider API to release the number

    await prisma.marketingConfig.update({
      where: { userId: session.userId },
      data: {
        smsEnabled: false,
        smsPhoneNumber: null,
        smsPhoneNumberSid: null,
        smsVerified: false,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        message: "Phone number released successfully",
      },
    });
  } catch (error) {
    console.error("Release SMS number error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to release phone number" } },
      { status: 500 }
    );
  }
}
