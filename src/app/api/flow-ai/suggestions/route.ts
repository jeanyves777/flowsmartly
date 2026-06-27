import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { geminiText } from "@/lib/ai/gemini-text-client";
import { getUserPreferredLanguage, languageDirective } from "@/lib/ai/user-language";

/**
 * AI-generated starter suggestions for the agent home. Personalized to the
 * user's brand + preferred language — nothing hardcoded. Returns an empty list
 * on any failure so the client falls back to its localized starter chips.
 */
const ICONS = ["palette", "megaphone", "video", "bag", "calendar", "globe", "trending", "sparkles"];

interface Suggestion { label: string; hint: string; icon: string; prompt: string }

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }
  try {
    const brand = await prisma.brandKit.findFirst({
      where: { userId: session.userId },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      select: { name: true, industry: true, niche: true, targetAudience: true, description: true },
    });
    const lang = await getUserPreferredLanguage(session.userId);
    const ctx = brand
      ? `Brand: ${brand.name || "(unnamed)"}${brand.industry ? `, industry ${brand.industry}` : ""}${brand.niche ? `, niche ${brand.niche}` : ""}${brand.targetAudience ? `, audience ${brand.targetAudience}` : ""}.${brand.description ? ` About: ${brand.description.slice(0, 200)}` : ""}`
      : "No brand kit yet — keep suggestions generic but useful.";

    const prompt = `${languageDirective(lang)}

You are FlowSmartly's agent home screen. Suggest EXACTLY 4 short starter actions the user could ask the AI to do right now, personalized to their brand. ${ctx}

Each suggestion has:
- "label": an action, max 4 words
- "hint": one short benefit, max 8 words
- "icon": pick ONE of: ${ICONS.join(", ")}
- "prompt": a complete first message to send the agent (one natural sentence)

Vary the actions across design, posting/scheduling, advertising, video, store/website, and growth. Return ONLY JSON:
{"suggestions":[{"label":"","hint":"","icon":"","prompt":""}]}`;

    const out = await geminiText.generateJSON<{ suggestions: Suggestion[] }>(prompt, {
      maxTokens: 1400,
      temperature: 0.6,
      systemPrompt: "You return only valid JSON: 4 concise, brand-relevant starter actions for a marketing AI home screen.",
    });

    const suggestions = Array.isArray(out?.suggestions)
      ? out.suggestions
          .filter((s) => s && typeof s.label === "string" && s.label.trim())
          .slice(0, 4)
          .map((s) => ({
            label: String(s.label).trim().slice(0, 42),
            hint: String(s.hint ?? "").trim().slice(0, 70),
            icon: ICONS.includes(String(s.icon)) ? String(s.icon) : "sparkles",
            prompt: String(s.prompt || s.label).trim().slice(0, 240),
          }))
      : [];

    return NextResponse.json({ success: true, data: { suggestions } });
  } catch (err) {
    console.warn("[flow-ai/suggestions] failed, client will fall back:", err);
    return NextResponse.json({ success: true, data: { suggestions: [] } });
  }
}
