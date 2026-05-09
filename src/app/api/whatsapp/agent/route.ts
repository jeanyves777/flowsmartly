import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import {
  normalizeWhatsAppAgentSettings,
  parseWhatsAppAgentSettings,
  WHATSAPP_AGENT_ACTION_TYPE,
  WHATSAPP_AGENT_AUTOMATION_NAME,
} from "@/lib/whatsapp/agent-config";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const socialAccountId = request.nextUrl.searchParams.get("socialAccountId");
    if (!socialAccountId) {
      return NextResponse.json({ error: "socialAccountId is required" }, { status: 400 });
    }

    const socialAccount = await getOwnedWhatsAppAccount(session.userId, socialAccountId);
    if (!socialAccount) {
      return NextResponse.json({ error: "WhatsApp account not found" }, { status: 404 });
    }

    const automation = await prisma.whatsAppAutomation.findFirst({
      where: {
        userId: session.userId,
        socialAccountId,
        actionType: WHATSAPP_AGENT_ACTION_TYPE,
      },
      orderBy: { updatedAt: "desc" },
    });

    const settings = automation
      ? { ...parseWhatsAppAgentSettings(automation.actionConfig), enabled: automation.isActive }
      : normalizeWhatsAppAgentSettings(null);

    return NextResponse.json({
      success: true,
      settings,
      automation: automation ? { id: automation.id, isActive: automation.isActive, updatedAt: automation.updatedAt } : null,
    });
  } catch (error) {
    console.error("Get WhatsApp agent settings error:", error);
    return NextResponse.json({ error: "Failed to fetch WhatsApp agent settings" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const socialAccountId = body.socialAccountId;
    if (!socialAccountId) {
      return NextResponse.json({ error: "socialAccountId is required" }, { status: 400 });
    }

    const socialAccount = await getOwnedWhatsAppAccount(session.userId, socialAccountId);
    if (!socialAccount) {
      return NextResponse.json({ error: "WhatsApp account not found" }, { status: 404 });
    }

    const settings = normalizeWhatsAppAgentSettings(body.settings);
    const existingAutomation = await prisma.whatsAppAutomation.findFirst({
      where: {
        userId: session.userId,
        socialAccountId,
        actionType: WHATSAPP_AGENT_ACTION_TYPE,
      },
      orderBy: { updatedAt: "desc" },
    });

    const automationData = {
      name: WHATSAPP_AGENT_AUTOMATION_NAME,
      description: "AI agent that replies to inbound WhatsApp conversations with business context, lead qualification, and handoff guardrails.",
      triggerType: "inbound_message",
      triggerConfig: JSON.stringify({ source: "whatsapp_webhook", allInboundMessages: true }),
      actionType: WHATSAPP_AGENT_ACTION_TYPE,
      actionValue: "generate_reply",
      actionConfig: JSON.stringify(settings),
      isActive: settings.enabled,
      priority: 100,
    };

    const automation = existingAutomation
      ? await prisma.whatsAppAutomation.update({
          where: { id: existingAutomation.id },
          data: automationData,
        })
      : await prisma.whatsAppAutomation.create({
          data: {
            userId: session.userId,
            socialAccountId,
            ...automationData,
          },
        });

    return NextResponse.json({
      success: true,
      settings: { ...settings, enabled: automation.isActive },
      automation: { id: automation.id, isActive: automation.isActive, updatedAt: automation.updatedAt },
    });
  } catch (error) {
    console.error("Save WhatsApp agent settings error:", error);
    return NextResponse.json({ error: "Failed to save WhatsApp agent settings" }, { status: 500 });
  }
}

async function getOwnedWhatsAppAccount(userId: string, socialAccountId: string) {
  return prisma.socialAccount.findFirst({
    where: {
      id: socialAccountId,
      userId,
      platform: "whatsapp",
      isActive: true,
    },
    select: { id: true },
  });
}
