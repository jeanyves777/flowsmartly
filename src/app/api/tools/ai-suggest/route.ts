import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { geminiText } from "@/lib/ai/gemini-text-client";
import { creditService } from "@/lib/credits";
import { getDynamicCreditCost, checkCreditsForFeature } from "@/lib/credits/costs";
import { getUserPreferredLanguage, languageDirective } from "@/lib/ai/user-language";

/**
 * POST /api/tools/ai-suggest — shared "✨ Suggest / AI-fill" helper for the
 * Tools surfaces (surveys, data-collection forms, events, follow-ups).
 *
 * It is intentionally GENERIC: the frontend describes the task in plain
 * language and the backend supplies the three things a button can't:
 *   1. the account's Brand Kit (name / description / industry) as context,
 *   2. the account's preferred output language (HARD RULE — see
 *      feedback_ai_respects_user_language memory),
 *   3. a credit check + deduction via the admin-set dynamic price
 *      (AI_CHAT_MESSAGE) — never a hardcoded number.
 *
 * Request:
 *   {
 *     task: string,                 // e.g. "Write a short, friendly survey description"
 *     context?: Record<string,any>, // arbitrary extra context merged into the prompt
 *     format?: "text" | "json",     // default "text"
 *     jsonHint?: string             // when format=json: describes the expected shape
 *   }
 *
 * Response:
 *   text → { success: true, result: string, data: { value: string } }
 *          (the `data.value` mirror keeps it compatible with the shared
 *           <AISuggestButton> component, which reads `data.value`).
 *   json → { success: true, result: <parsed value> }
 *   error → { success: false, error: { message }, code?, required? }
 */

const COST_KEY = "AI_CHAT_MESSAGE" as const;

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const task = typeof body?.task === "string" ? body.task.trim() : "";
    const format = body?.format === "json" ? "json" : "text";
    const jsonHint = typeof body?.jsonHint === "string" ? body.jsonHint.trim() : "";
    const context =
      body?.context && typeof body.context === "object" ? body.context : {};

    if (!task) {
      return NextResponse.json(
        { success: false, error: { message: "A task description is required." } },
        { status: 400 },
      );
    }

    // Credit gate (admin-set price; structured-result errors, never a hard refusal).
    const cost = await getDynamicCreditCost(COST_KEY);
    const creditCheck = await checkCreditsForFeature(
      session.userId,
      COST_KEY,
      !!session.adminId,
    );
    if (creditCheck) {
      return NextResponse.json(
        { success: false, error: { message: creditCheck.message }, code: creditCheck.code, required: cost },
        { status: 402 },
      );
    }

    // Brand context (best-effort — never blocks the suggestion).
    const brandKit = await prisma.brandKit
      .findFirst({
        where: { userId: session.userId },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
        select: { name: true, description: true, industry: true },
      })
      .catch(() => null);

    const lang = await getUserPreferredLanguage(session.userId);

    const brandLines = brandKit
      ? [
          `Business name: ${brandKit.name}`,
          brandKit.industry ? `Industry: ${brandKit.industry}` : "",
          brandKit.description ? `About: ${brandKit.description}` : "",
        ].filter(Boolean)
      : [];

    const contextLines = Object.entries(context)
      .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
      .map(([k, v]) => `- ${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`);

    const systemPrompt = [
      "You are FlowAI, a senior marketing copywriter and forms specialist embedded in a business tools dashboard.",
      "Produce concise, polished, ready-to-use output. No preamble, no explanations, no markdown fences.",
      languageDirective(lang),
    ].join("\n");

    const userPrompt = [
      `Task: ${task}`,
      brandLines.length ? `\nBusiness context:\n${brandLines.join("\n")}` : "",
      contextLines.length ? `\nAdditional context:\n${contextLines.join("\n")}` : "",
      format === "json"
        ? `\nReturn ONLY valid JSON${jsonHint ? ` matching this shape: ${jsonHint}` : ""}. No commentary.`
        : `\nReturn ONLY the requested text, with no surrounding quotes or labels.`,
    ]
      .filter(Boolean)
      .join("\n");

    let result: string | unknown;
    if (format === "json") {
      const parsed = await geminiText.generateJSON(userPrompt, {
        systemPrompt,
        temperature: 0.6,
        maxTokens: 1200,
      });
      if (parsed === null) {
        return NextResponse.json(
          { success: false, error: { message: "The AI couldn't produce a usable result. Try again." } },
          { status: 502 },
        );
      }
      result = parsed;
    } else {
      const text = await geminiText.generate(userPrompt, {
        systemPrompt,
        temperature: 0.7,
        maxTokens: 600,
      });
      const cleaned = text.trim().replace(/^["']|["']$/g, "").trim();
      if (!cleaned) {
        return NextResponse.json(
          { success: false, error: { message: "The AI couldn't produce a usable result. Try again." } },
          { status: 502 },
        );
      }
      result = cleaned;
    }

    // Deduct only after we have a usable result.
    await creditService
      .deductCredits({
        userId: session.userId,
        amount: cost,
        type: "USAGE",
        description: "Tools AI suggestion",
        referenceType: "tools_ai_suggest",
        referenceId: session.userId,
      })
      .catch((e) => console.error("[tools/ai-suggest] credit deduct failed:", e));

    // `data.value` mirror keeps the shared <AISuggestButton> (text mode) working.
    if (format === "text") {
      return NextResponse.json({ success: true, result, data: { value: result } });
    }
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("[tools/ai-suggest] error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to generate a suggestion." } },
      { status: 500 },
    );
  }
}
