import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "flowsmartly_whatsapp_verify";

/**
 * GET - Webhook verification for WhatsApp Cloud API
 * Meta sends a GET request with hub.mode, hub.challenge, and hub.verify_token
 */
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  // Verify the token matches
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ WhatsApp webhook verified!");
    return new NextResponse(challenge, { status: 200 });
  }

  console.error("❌ WhatsApp webhook verification failed");
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * POST - Handle incoming WhatsApp webhooks
 * Receives messages, status updates, and other events
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // WhatsApp sends an entry array with changes
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value) {
      return NextResponse.json({ received: true });
    }

    // Handle different webhook types
    if (value.messages) {
      await handleIncomingMessages(value);
    }

    if (value.statuses) {
      await handleMessageStatuses(value);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("WhatsApp webhook error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

/**
 * Handle incoming messages from customers
 */
async function handleIncomingMessages(value: any) {
  const messages = value.messages;
  const metadata = value.metadata;

  for (const message of messages) {
    try {
      const phoneNumberId = metadata.phone_number_id;
      const from = message.from; // Customer's phone number
      const messageId = message.id;
      const timestamp = new Date(parseInt(message.timestamp) * 1000);

      // Find the social account (WhatsApp Business number)
      const socialAccount = await prisma.socialAccount.findFirst({
        where: {
          platform: "whatsapp",
          platformUserId: phoneNumberId,
          isActive: true,
        },
      });

      if (!socialAccount) {
        console.error(`No social account found for phone number ID: ${phoneNumberId}`);
        continue;
      }

      // Find or create conversation
      let conversation = await prisma.whatsAppConversation.findFirst({
        where: {
          socialAccountId: socialAccount.id,
          customerPhone: from,
        },
      });

      if (!conversation) {
        // Get customer name from contacts if available
        const customerName = value.contacts?.[0]?.profile?.name || from;

        conversation = await prisma.whatsAppConversation.create({
          data: {
            socialAccountId: socialAccount.id,
            userId: socialAccount.userId,
            customerPhone: from,
            customerName,
            lastMessageAt: timestamp,
            unreadCount: 1,
          },
        });
      } else {
        // Update conversation
        await prisma.whatsAppConversation.update({
          where: { id: conversation.id },
          data: {
            lastMessageAt: timestamp,
            unreadCount: { increment: 1 },
          },
        });
      }

      // Determine message type and content
      const messageType = message.type;
      let messageBody = "";
      let mediaUrl = null;

      switch (messageType) {
        case "text":
          messageBody = message.text?.body || "";
          break;
        case "image":
          messageBody = message.image?.caption || "[Image]";
          mediaUrl = message.image?.id;
          break;
        case "video":
          messageBody = message.video?.caption || "[Video]";
          mediaUrl = message.video?.id;
          break;
        case "audio":
          messageBody = "[Audio]";
          mediaUrl = message.audio?.id;
          break;
        case "document":
          messageBody = message.document?.filename || "[Document]";
          mediaUrl = message.document?.id;
          break;
        case "location":
          messageBody = `[Location: ${message.location?.latitude}, ${message.location?.longitude}]`;
          break;
        default:
          messageBody = `[${messageType}]`;
      }

      // Store the message
      await prisma.whatsAppMessage.create({
        data: {
          conversationId: conversation.id,
          whatsappMessageId: messageId,
          direction: "inbound",
          messageType: messageType,
          content: messageBody,
          mediaUrl,
          status: "delivered",
          timestamp,
        },
      });

      console.log(`📥 Received WhatsApp message from ${from}: ${messageBody}`);

      // TODO: Check for automations and auto-reply if configured
      // await checkAndTriggerAutomations(conversation.id, messageBody);

    } catch (error) {
      console.error("Error processing message:", error);
    }
  }
}

/**
 * Handle message status updates (sent, delivered, read, failed)
 */
async function handleMessageStatuses(value: any) {
  const statuses = value.statuses;

  for (const status of statuses) {
    try {
      const messageId = status.id;
      const newStatus = status.status; // sent, delivered, read, failed

      // Update message status in database
      await prisma.whatsAppMessage.updateMany({
        where: { whatsappMessageId: messageId },
        data: { status: newStatus },
      });

      console.log(`📊 Message ${messageId} status: ${newStatus}`);
    } catch (error) {
      console.error("Error updating message status:", error);
    }
  }
}
