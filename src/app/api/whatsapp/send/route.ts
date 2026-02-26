import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

/**
 * WhatsApp Send Message API
 * Send text, media, or template messages
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      conversationId,
      socialAccountId,
      to,
      message,
      messageType = "text",
      mediaUrl,
      templateId,
    } = body;

    console.log("[WhatsApp Send] Request:", { conversationId, socialAccountId, to, messageType, hasMessage: !!message });

    // Validate required fields
    if (!socialAccountId || (!conversationId && !to)) {
      return NextResponse.json(
        { error: "Missing required fields" },
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

    let conversation;
    let recipientPhone;

    // Get or create conversation
    if (conversationId) {
      conversation = await prisma.whatsAppConversation.findFirst({
        where: {
          id: conversationId,
          userId: session.userId,
        },
      });

      if (!conversation) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 }
        );
      }

      recipientPhone = conversation.customerPhone;
    } else {
      // Create new conversation
      recipientPhone = to;
      conversation = await prisma.whatsAppConversation.create({
        data: {
          userId: session.userId,
          socialAccountId,
          customerPhone: recipientPhone,
          customerName: recipientPhone,
          lastMessageAt: new Date(),
          unreadCount: 0,
          status: "open",
        },
      });
    }

    // Send message via WhatsApp API
    let whatsappResponse;

    if (templateId) {
      // Send template message
      const template = await prisma.whatsAppTemplate.findFirst({
        where: {
          id: templateId,
          userId: session.userId,
        },
      });

      if (!template) {
        return NextResponse.json(
          { error: "Template not found" },
          { status: 404 }
        );
      }

      whatsappResponse = await sendTemplateMessage(
        socialAccount.accessToken!,
        socialAccount.platformUserId!,
        recipientPhone,
        template
      );
    } else if (messageType === "text") {
      // Send text message
      whatsappResponse = await sendTextMessage(
        socialAccount.accessToken!,
        socialAccount.platformUserId!,
        recipientPhone,
        message
      );
    } else if (["image", "video", "audio", "document"].includes(messageType)) {
      // Send media message
      whatsappResponse = await sendMediaMessage(
        socialAccount.accessToken!,
        socialAccount.platformUserId!,
        recipientPhone,
        messageType,
        mediaUrl,
        message // caption
      );
    } else {
      return NextResponse.json(
        { error: "Invalid message type" },
        { status: 400 }
      );
    }

    if (!whatsappResponse.messages) {
      const waError = whatsappResponse.error;
      const errorDetail = waError
        ? `WhatsApp API error: ${waError.message || waError.error_user_msg || JSON.stringify(waError)}`
        : "WhatsApp did not return a message ID";
      console.error("WhatsApp send failed:", JSON.stringify(whatsappResponse, null, 2));
      return NextResponse.json(
        { error: errorDetail, details: whatsappResponse },
        { status: 500 }
      );
    }

    // Save message to database
    const dbMessage = await prisma.whatsAppMessage.create({
      data: {
        conversationId: conversation.id,
        whatsappMessageId: whatsappResponse.messages[0].id,
        direction: "outbound",
        messageType,
        content: message || "",
        mediaUrl: mediaUrl || null,
        status: "sent",
        timestamp: new Date(),
      },
    });

    // Update conversation
    await prisma.whatsAppConversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: dbMessage,
      whatsappMessageId: whatsappResponse.messages[0].id,
    });
  } catch (error: any) {
    console.error("WhatsApp send message error:", error);
    const msg = error?.message || "Failed to send message";
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}

async function sendTextMessage(
  accessToken: string,
  phoneNumberId: string,
  to: string,
  message: string
) {
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
        recipient_type: "individual",
        to,
        type: "text",
        text: {
          preview_url: true,
          body: message,
        },
      }),
    }
  );

  return await response.json();
}

async function sendMediaMessage(
  accessToken: string,
  phoneNumberId: string,
  to: string,
  mediaType: string,
  mediaId: string,
  caption?: string
) {
  const mediaBody: any = {
    id: mediaId,
  };

  if (caption && ["image", "video", "document"].includes(mediaType)) {
    mediaBody.caption = caption;
  }

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
        recipient_type: "individual",
        to,
        type: mediaType,
        [mediaType]: mediaBody,
      }),
    }
  );

  return await response.json();
}

async function sendTemplateMessage(
  accessToken: string,
  phoneNumberId: string,
  to: string,
  template: any
) {
  const templateConfig = JSON.parse(template.templateConfig || "{}");

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
        to,
        type: "template",
        template: {
          name: template.name,
          language: {
            code: template.language || "en",
          },
          components: templateConfig.components || [],
        },
      }),
    }
  );

  return await response.json();
}
