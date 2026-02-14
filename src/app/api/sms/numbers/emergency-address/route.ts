import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { createAndAssignEmergencyAddress } from "@/lib/twilio";

// POST /api/sms/numbers/emergency-address - Set emergency address on existing number
export async function POST() {
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
      select: {
        smsPhoneNumberSid: true,
        smsPhoneNumber: true,
        businessName: true,
        businessStreetAddress: true,
        businessCity: true,
        businessStateProvinceRegion: true,
        businessPostalCode: true,
        businessCountry: true,
      },
    });

    if (!config?.smsPhoneNumberSid) {
      return NextResponse.json(
        { success: false, error: { message: "No phone number found. Rent a number first." } },
        { status: 400 }
      );
    }

    if (!config.businessStreetAddress || !config.businessCity || !config.businessStateProvinceRegion || !config.businessPostalCode) {
      return NextResponse.json(
        { success: false, error: { message: "Business address is incomplete. Update your address in compliance settings first." } },
        { status: 400 }
      );
    }

    const result = await createAndAssignEmergencyAddress({
      phoneNumberSid: config.smsPhoneNumberSid,
      customerName: config.businessName || session.user.name || "Business",
      street: config.businessStreetAddress,
      city: config.businessCity,
      region: config.businessStateProvinceRegion,
      postalCode: config.businessPostalCode,
      isoCountry: config.businessCountry || "US",
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: { message: result.error } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        addressSid: result.addressSid,
        message: "Emergency address has been set for your phone number.",
      },
    });
  } catch (error) {
    console.error("Set emergency address error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to set emergency address" } },
      { status: 500 }
    );
  }
}
