import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { ai } from "@/lib/ai/client";
import { aiHub } from "@/lib/ai/hub";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { validateSampleMessages } from "@/lib/sms/compliance-validator";

type AssistResponse = {
  useCaseDescription: string;
  sampleMessages: string[];
  optInChecklist: string[];
};

function fallbackDraft(input: {
  businessName: string;
  useCase: string;
  website?: string;
}): AssistResponse {
  const businessName = input.businessName || "Your business";
  const useCase = input.useCase || "marketing";
  const website = input.website || "your website";

  return {
    useCaseDescription: `${businessName} sends ${useCase.replace(/_/g, " ")} text messages only to customers who have opted in through ${website}. Messages may include offers, updates, reminders, and useful customer information. Recipients can expect a limited number of messages each month and can reply STOP to opt out or HELP for support at any time.`,
    sampleMessages: [
      `${businessName}: Thanks for joining our SMS list. Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to opt out.`,
      `Hi {{firstName}}, ${businessName} has an update for you: {{offerOrUpdate}}. Visit ${website}. Reply STOP to unsubscribe.`,
    ],
    optInChecklist: [
      "Use an unchecked SMS consent box near the phone number field.",
      "Disclose message type, frequency, data rates, HELP, and STOP instructions.",
      "Keep the privacy policy and terms links visible beside the opt-in action.",
    ],
  };
}

function cleanAssistResult(result: AssistResponse, businessName: string, useCase: string, website?: string): AssistResponse {
  const fallback = fallbackDraft({ businessName, useCase, website });
  const sampleMessages = Array.isArray(result.sampleMessages)
    ? result.sampleMessages.map((sample) => String(sample || "").trim()).filter(Boolean).slice(0, 5)
    : [];

  const validSamples = validateSampleMessages(sampleMessages, { businessName }).valid
    ? sampleMessages
    : fallback.sampleMessages;

  return {
    useCaseDescription: String(result.useCaseDescription || fallback.useCaseDescription).trim(),
    sampleMessages: validSamples,
    optInChecklist: Array.isArray(result.optInChecklist) && result.optInChecklist.length > 0
      ? result.optInChecklist.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 5)
      : fallback.optInChecklist,
  };
}

// POST /api/sms/compliance/assist - AI draft helper for compliance applications
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
    const businessName = String(body.businessName || "").trim();
    const useCase = String(body.smsUseCase || body.useCase || "marketing").trim();
    const businessWebsite = String(body.businessWebsite || "").trim();
    const existingDescription = String(body.smsUseCaseDescription || "").trim();

    if (!businessName) {
      return NextResponse.json(
        { success: false, error: { message: "Business name is required for AI compliance drafting" } },
        { status: 400 }
      );
    }

    const creditCost = await getDynamicCreditCost("AI_CAPTION");
    const balance = await creditService.getBalance(session.userId);
    if (balance < creditCost) {
      return NextResponse.json(
        { success: false, error: { message: `Insufficient credits. You need ${creditCost} credits.` } },
        { status: 402 }
      );
    }

    const brandContext = await aiHub.getBrandContext(session.userId);
    const prompt = `Draft SMS/MMS compliance application text for this business.

Business name: ${businessName}
Website: ${businessWebsite || "not provided"}
Use case: ${useCase}
Existing description: ${existingDescription || "none"}
Brand context: ${brandContext ? JSON.stringify(brandContext) : "none"}

Return JSON with:
{
  "useCaseDescription": "80-180 words. Explain message types, audience, opt-in flow, frequency, customer value, STOP and HELP support.",
  "sampleMessages": ["2-3 realistic SMS samples. Each identifies the brand. At least one includes Msg & data rates may apply, HELP, and STOP. Keep each under 320 characters."],
  "optInChecklist": ["3 short checklist items for what the opt-in screenshot must prove"]
}

Do not invent legal advice. Keep language practical, carrier-review friendly, and specific to the provided business.`;

    let result = await ai.generateJSON<AssistResponse>(prompt, {
      maxTokens: 900,
      systemPrompt: "You are FlowSmartly's SMS compliance drafting assistant. Produce concise, accurate, carrier-review friendly application drafts.",
    });

    if (!result) {
      result = fallbackDraft({ businessName, useCase, website: businessWebsite });
    }

    const cleaned = cleanAssistResult(result, businessName, useCase, businessWebsite);

    await creditService.deductCredits({
      userId: session.userId,
      type: TRANSACTION_TYPES.USAGE,
      amount: creditCost,
      description: `AI SMS compliance draft (${creditCost} credits)`,
      referenceType: "sms_compliance_ai",
    });

    await prisma.aIUsage.create({
      data: {
        userId: session.userId,
        feature: "sms_compliance_assist",
        model: "claude-opus-4-7",
        inputTokens: ai.estimateTokens(prompt),
        outputTokens: ai.estimateTokens(JSON.stringify(cleaned)),
        costCents: creditCost,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...cleaned,
        creditsUsed: creditCost,
      },
    });
  } catch (error) {
    console.error("SMS compliance assist error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to draft SMS compliance content" } },
      { status: 500 }
    );
  }
}
