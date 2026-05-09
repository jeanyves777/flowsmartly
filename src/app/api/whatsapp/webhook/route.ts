import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { generateWhatsAppAgentReply } from "@/lib/whatsapp/agent-runtime";

/**
 * WhatsApp Webhook - Receive incoming messages
 * Webhook verification and message handling
 */

// GET: Webhook verification
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "flowsmartly_whatsapp_2024";

  if (mode === "subscribe" && token === verifyToken) {
    console.log("WhatsApp webhook verified");
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

// POST: Handle incoming messages
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // WhatsApp sends webhook in this format
    if (body.object === "whatsapp_business_account") {
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          if (change.field === "messages") {
            const value = change.value;

            // Process incoming messages
            if (value.messages && value.messages.length > 0) {
              for (const message of value.messages) {
                await processIncomingMessage(message, value.metadata);
              }
            }

            // Process message status updates
            if (value.statuses && value.statuses.length > 0) {
              for (const status of value.statuses) {
                await updateMessageStatus(status);
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("WhatsApp webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

async function processIncomingMessage(message: any, metadata: any) {
  try {
    const phoneNumberId = metadata.phone_number_id;
    const customerPhone = message.from;
    const messageId = message.id;
    const timestamp = new Date(parseInt(message.timestamp) * 1000);

    // Find the social account for this phone number
    const socialAccount = await prisma.socialAccount.findFirst({
      where: {
        platform: "whatsapp",
        platformUserId: phoneNumberId,
        isActive: true,
      },
    });

    if (!socialAccount) {
      console.error(`No WhatsApp account found for phone number ID: ${phoneNumberId}`);
      return;
    }

    // Get or create conversation
    let conversation = await prisma.whatsAppConversation.findFirst({
      where: {
        userId: socialAccount.userId,
        socialAccountId: socialAccount.id,
        customerPhone,
      },
    });

    if (!conversation) {
      // Get customer name from contacts if available
      const customerName = message.contacts?.[0]?.profile?.name || customerPhone;

      conversation = await prisma.whatsAppConversation.create({
        data: {
          userId: socialAccount.userId,
          socialAccountId: socialAccount.id,
          customerPhone,
          customerName,
          lastMessageAt: timestamp,
          unreadCount: 1,
          status: "open",
        },
      });
    } else {
      // Update conversation
      await prisma.whatsAppConversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: timestamp,
          unreadCount: { increment: 1 },
          status: "open",
        },
      });
    }

    // Extract message content based on type
    let content = "";
    let messageType = "text";
    let mediaUrl = null;

    if (message.text) {
      content = message.text.body;
      messageType = "text";
    } else if (message.image) {
      content = message.image.caption || "Image";
      messageType = "image";
      mediaUrl = message.image.id;
    } else if (message.video) {
      content = message.video.caption || "Video";
      messageType = "video";
      mediaUrl = message.video.id;
    } else if (message.audio) {
      content = "Audio message";
      messageType = "audio";
      mediaUrl = message.audio.id;
    } else if (message.document) {
      content = message.document.filename || "Document";
      messageType = "document";
      mediaUrl = message.document.id;
    } else if (message.sticker) {
      content = "Sticker";
      messageType = "sticker";
      mediaUrl = message.sticker.id;
    } else if (message.location) {
      content = `Location: ${message.location.latitude}, ${message.location.longitude}`;
      messageType = "location";
    } else if (message.contacts) {
      content = `Contact: ${message.contacts[0]?.name?.formatted_name}`;
      messageType = "contacts";
    }

    // Save message to database
    await prisma.whatsAppMessage.create({
      data: {
        conversationId: conversation.id,
        whatsappMessageId: messageId,
        direction: "inbound",
        messageType,
        content,
        mediaUrl,
        status: "received",
        timestamp,
      },
    });

    // Check for automations before the AI agent so existing explicit flows keep priority.
    const automationHandled = await checkAutomations(socialAccount.userId, conversation.id, content, messageType);
    if (!automationHandled) {
      await maybeRunWhatsAppAgent(socialAccount, conversation.id, content, messageType, customerPhone);
    }

  } catch (error) {
    console.error("Error processing incoming message:", error);
  }
}

async function maybeRunWhatsAppAgent(
  socialAccount: any,
  conversationId: string,
  content: string,
  messageType: string,
  customerPhone: string
) {
  try {
    if (!socialAccount.accessToken || !socialAccount.platformUserId) return;

    const reply = await generateWhatsAppAgentReply({
      socialAccountId: socialAccount.id,
      conversationId,
      inboundMessage: content,
      messageType,
    });

    if (!reply) return;

    const whatsappResponse = await sendWhatsAppMessage(
      socialAccount.accessToken,
      socialAccount.platformUserId,
      customerPhone,
      reply
    );

    const sentMessageId = whatsappResponse?.messages?.[0]?.id || null;
    const failedMessage = whatsappResponse?.error?.message || whatsappResponse?.error?.error_user_msg || null;
    const now = new Date();

    await prisma.whatsAppMessage.create({
      data: {
        conversationId,
        whatsappMessageId: sentMessageId,
        direction: "outbound",
        messageType: "text",
        content: reply,
        status: sentMessageId ? "sent" : "failed",
        errorMessage: failedMessage,
        metadata: JSON.stringify({ source: "whatsapp_agent" }),
        timestamp: now,
      },
    });

    await prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: now,
        lastMessageText: reply,
      },
    });
  } catch (error) {
    console.error("WhatsApp agent reply error:", error);
  }
}

async function updateMessageStatus(status: any) {
  try {
    const messageId = status.id;
    const newStatus = status.status; // sent, delivered, read, failed

    await prisma.whatsAppMessage.updateMany({
      where: {
        whatsappMessageId: messageId,
      },
      data: {
        status: newStatus,
        errorMessage: status.errors?.[0]?.message || null,
      },
    });
  } catch (error) {
    console.error("Error updating message status:", error);
  }
}

async function checkAutomations(userId: string, conversationId: string, content: string, messageType: string): Promise<boolean> {
  try {
    const automations = await prisma.whatsAppAutomation.findMany({
      where: {
        userId,
        isActive: true,
      },
    });

    let handled = false;

    for (const automation of automations) {
      let shouldTrigger = false;

      // Check trigger conditions
      if (automation.triggerType === "keyword") {
        const keywords = JSON.parse(automation.triggerConfig || "[]");
        shouldTrigger = keywords.some((keyword: string) =>
          content.toLowerCase().includes(keyword.toLowerCase())
        );
      } else if (automation.triggerType === "new_conversation") {
        const conversation = await prisma.whatsAppConversation.findUnique({
          where: { id: conversationId },
          include: {
            messages: {
              take: 1,
              orderBy: { timestamp: "asc" },
            },
          },
        });
        // Trigger if this is the first message in conversation
        shouldTrigger = conversation?.messages.length === 1;
      }

      if (shouldTrigger) {
        // Execute automation action
        const actionHandled = await executeAutomation(automation, conversationId);
        handled = handled || actionHandled;
      }
    }

    return handled;
  } catch (error) {
    console.error("Error checking automations:", error);
    return false;
  }
}

async function executeAutomation(automation: any, conversationId: string): Promise<boolean> {
  try {
    if (automation.actionType === "send_message") {
      const config = JSON.parse(automation.actionConfig || "{}");
      const conversation = await prisma.whatsAppConversation.findUnique({
        where: { id: conversationId },
        include: {
          socialAccount: true,
        },
      });

      if (!conversation) return false;

      // Send message via WhatsApp API
      await sendWhatsAppMessage(
        conversation.socialAccount.accessToken!,
        conversation.socialAccount.platformUserId!,
        conversation.customerPhone,
        config.message || automation.actionValue
      );
      return true;
    }
    // Additional action types can be added here (send_template, etc.)
    return false;
  } catch (error) {
    console.error("Error executing automation:", error);
    return false;
  }
}

async function sendWhatsAppMessage(accessToken: string, phoneNumberId: string, to: string, message: string) {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: message },
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      console.error("WhatsApp API error:", data);
    }
    return data;
  } catch (error) {
    console.error("Error sending WhatsApp message:", error);
  }
}
