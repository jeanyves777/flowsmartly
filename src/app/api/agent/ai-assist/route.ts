import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { ai } from "@/lib/ai/client";

const INDUSTRY_OPTIONS = [
  "E-commerce",
  "SaaS",
  "Healthcare",
  "Real Estate",
  "Restaurant & Food",
  "Fitness & Wellness",
  "Education",
  "Fashion & Beauty",
  "Finance",
  "Travel & Tourism",
  "Entertainment",
  "Non-Profit",
  "Local Business",
  "B2B Services",
];

const aiAssistSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("display_names"),
    specialties: z.array(z.string()).min(1),
  }),
  z.object({
    type: z.literal("bio"),
    displayName: z.string().min(1),
    specialties: z.array(z.string()).min(1),
    industries: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal("industries"),
    specialties: z.array(z.string()).min(1),
  }),
]);

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: { message: "Not authenticated" } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const validation = aiAssistSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid request" } },
        { status: 400 }
      );
    }

    const data = validation.data;

    switch (data.type) {
      case "display_names": {
        const existing = await prisma.agentProfile.findMany({
          select: { displayName: true },
        });
        const takenNames = existing.map((p) => p.displayName.toLowerCase());
        const userName = session.user.name || "Agent";

        const result = await ai.generateJSON<{ names: string[] }>(
          `Generate 5 creative, professional display names for a marketing agent on FlowSmartly.

AGENT INFO:
- Real name: ${userName}
- Specialties: ${data.specialties.join(", ")}

ALREADY TAKEN NAMES (do NOT suggest these or very similar ones):
${takenNames.join(", ") || "None yet"}

REQUIREMENTS:
- Professional and memorable
- Can incorporate the agent's first name creatively, or be brand-style names
- Short (2-5 words)
- Mix styles: some name-based (e.g., "Sarah's Digital Lab"), some brand-style (e.g., "Pixel Growth Agency")
- Each must be unique and not already taken

Return JSON: { "names": ["Name 1", "Name 2", "Name 3", "Name 4", "Name 5"] }`,
          {
            maxTokens: 300,
            temperature: 0.9,
            systemPrompt:
              "You are a creative branding expert. Return only valid JSON.",
          }
        );

        const available = (result?.names || []).filter(
          (n) => !takenNames.includes(n.toLowerCase())
        );

        return NextResponse.json({
          success: true,
          data: { names: available.slice(0, 5) },
        });
      }

      case "bio": {
        const content = await ai.generate(
          `Write a professional, engaging bio for a marketing agent on FlowSmartly.

AGENT INFO:
- Display Name: ${data.displayName}
- Specialties: ${data.specialties.join(", ")}
${data.industries?.length ? `- Industries: ${data.industries.join(", ")}` : ""}

REQUIREMENTS:
- 2-3 paragraphs, 150-250 words total
- Professional but personable tone
- Highlight expertise in the selected specialties
- Include a compelling value proposition
- End with what clients can expect
- Do NOT include placeholder names, emails, or phone numbers
- Mix first-person and professional third-person

Return ONLY the bio text, no labels or markdown.`,
          {
            maxTokens: 500,
            temperature: 0.7,
            systemPrompt:
              "You are a professional copywriter specializing in marketing professional bios. Write compelling, trust-building bios. Return only the bio text.",
          }
        );

        return NextResponse.json({
          success: true,
          data: { bio: content.trim() },
        });
      }

      case "industries": {
        const result = await ai.generateJSON<{
          industries: { name: string; reason: string }[];
        }>(
          `Based on these marketing specialties, suggest the most relevant industries to target.

SPECIALTIES: ${data.specialties.join(", ")}

AVAILABLE INDUSTRIES (choose ONLY from this exact list):
${INDUSTRY_OPTIONS.join(", ")}

REQUIREMENTS:
- Select 3-6 industries that best match the specialties
- Rank by relevance (most relevant first)
- Brief reason for each (10-15 words max)

Return JSON: { "industries": [{ "name": "Industry Name", "reason": "Why this matches" }] }`,
          {
            maxTokens: 400,
            temperature: 0.5,
            systemPrompt:
              "You are a marketing industry analyst. Return only valid JSON.",
          }
        );

        const validIndustries = (result?.industries || []).filter((i) =>
          INDUSTRY_OPTIONS.includes(i.name)
        );

        return NextResponse.json({
          success: true,
          data: { industries: validIndustries },
        });
      }
    }
  } catch (error) {
    console.error("Agent AI assist error:", error);
    return NextResponse.json(
      { success: false, error: { message: "AI generation failed" } },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: { message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const value = searchParams.get("value");

  if (!value?.trim()) {
    return NextResponse.json(
      { success: false, error: { message: "Value required" } },
      { status: 400 }
    );
  }

  try {
    // SQLite doesn't support mode: "insensitive", so fetch all and compare lowercase
    const existing = await prisma.agentProfile.findMany({
      where: { displayName: { not: "" } },
      select: { displayName: true },
    });

    const taken = existing.some(
      (p) => p.displayName.toLowerCase() === value.trim().toLowerCase()
    );

    return NextResponse.json({
      success: true,
      data: { available: !taken },
    });
  } catch (error) {
    console.error("Name availability check error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Check failed" } },
      { status: 500 }
    );
  }
}
