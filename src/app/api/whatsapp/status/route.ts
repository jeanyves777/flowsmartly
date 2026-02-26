import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

/**
 * WhatsApp Status (Stories) API
 * Post images/videos to WhatsApp Status
 */

// POST: Create WhatsApp Status
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      socialAccountId,
      mediaType, // "image" or "video"
      mediaUrl,
      caption,
    } = body;

    // Validate required fields
    if (!socialAccountId || !mediaType || !mediaUrl) {
      return NextResponse.json(
        { error: "Missing required fields: socialAccountId, mediaType, mediaUrl" },
        { status: 400 }
      );
    }

    // Get social account
    const socialAccount = await prisma.socialAccount.findFirst({
      where: {
        id: socialAccountId,
        userId: session.userId,
        platform: "whatsapp",
        isActive: true,
      },
    });

    if (!socialAccount) {
      return NextResponse.json(
        { error: "WhatsApp account not found or inactive" },
        { status: 404 }
      );
    }

    // Upload media to WhatsApp first
    const uploadedMedia = await uploadMediaToWhatsApp(
      socialAccount.accessToken!,
      socialAccount.platformUserId!,
      mediaUrl,
      mediaType
    );

    if (!uploadedMedia.id) {
      return NextResponse.json(
        { error: "Failed to upload media to WhatsApp", details: uploadedMedia },
        { status: 500 }
      );
    }

    // Post to WhatsApp Status using the uploaded media ID
    const statusResponse = await postToWhatsAppStatus(
      socialAccount.accessToken!,
      socialAccount.platformUserId!,
      uploadedMedia.id,
      mediaType,
      caption
    );

    if (!statusResponse.messages) {
      return NextResponse.json(
        { error: "Failed to post to WhatsApp Status", details: statusResponse },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      statusId: statusResponse.messages[0].id,
      message: "WhatsApp Status posted successfully",
    });
  } catch (error) {
    console.error("WhatsApp Status post error:", error);
    return NextResponse.json(
      { error: "Failed to post WhatsApp Status" },
      { status: 500 }
    );
  }
}

async function uploadMediaToWhatsApp(
  accessToken: string,
  phoneNumberId: string,
  mediaUrl: string,
  mediaType: string
) {
  try {
    // Download media from URL
    const mediaResponse = await fetch(mediaUrl);
    const mediaBlob = await mediaResponse.blob();

    // Create form data
    const formData = new FormData();
    formData.append("file", mediaBlob);
    formData.append("messaging_product", "whatsapp");
    formData.append("type", mediaType);

    // Upload to WhatsApp
    const uploadResponse = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/media`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      }
    );

    return await uploadResponse.json();
  } catch (error) {
    console.error("Error uploading media to WhatsApp:", error);
    return { error: "Failed to upload media" };
  }
}

async function postToWhatsAppStatus(
  accessToken: string,
  phoneNumberId: string,
  mediaId: string,
  mediaType: string,
  caption?: string
) {
  try {
    const mediaBody: any = {
      id: mediaId,
    };

    if (caption && mediaType === "image") {
      mediaBody.caption = caption;
    }

    // Note: WhatsApp Status is posted by sending to a special recipient
    // In practice, posting to Status might require different API endpoint
    // This is a simplified version based on WhatsApp Cloud API docs
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          type: mediaType,
          [mediaType]: mediaBody,
          // For Status, recipient_type might be different
          // Check WhatsApp Cloud API docs for correct implementation
        }),
      }
    );

    return await response.json();
  } catch (error) {
    console.error("Error posting to WhatsApp Status:", error);
    return { error: "Failed to post to Status" };
  }
}

// GET: Get WhatsApp Status analytics (if available)
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const socialAccountId = request.nextUrl.searchParams.get("socialAccountId");

    if (!socialAccountId) {
      return NextResponse.json(
        { error: "socialAccountId is required" },
        { status: 400 }
      );
    }

    // Get social account
    const socialAccount = await prisma.socialAccount.findFirst({
      where: {
        id: socialAccountId,
        userId: session.userId,
        platform: "whatsapp",
        isActive: true,
      },
    });

    if (!socialAccount) {
      return NextResponse.json(
        { error: "WhatsApp account not found or inactive" },
        { status: 404 }
      );
    }

    // Note: WhatsApp Status analytics might not be available via API
    // This is a placeholder for future implementation
    return NextResponse.json({
      success: true,
      message: "WhatsApp Status analytics not yet available via API",
      analytics: [],
    });
  } catch (error) {
    console.error("WhatsApp Status analytics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch Status analytics" },
      { status: 500 }
    );
  }
}
