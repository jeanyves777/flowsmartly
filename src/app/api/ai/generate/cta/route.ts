import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { ai } from "@/lib/ai/client";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { description, category } = await request.json();

    if (!description || typeof description !== "string") {
      return NextResponse.json(
        { success: false, error: { message: "Description is required" } },
        { status: 400 }
      );
    }

    const prompt = `Based on this design description, suggest 5 short call-to-action (CTA) button texts.

Design description: "${description.slice(0, 300)}"
${category ? `Design type: ${category.replace("_", " ")}` : ""}

Rules:
- Each CTA must be 1-4 words
- Action-oriented and compelling
- Relevant to the design description
- Varied styles (urgency, benefit, direct, curiosity, etc.)

Return ONLY a JSON array of 5 strings. Example: ["Shop Now", "Get Started", "Learn More", "Claim Your Spot", "Try It Free"]`;

    const result = await ai.generateJSON<string[]>(prompt, {
      maxTokens: 150,
      temperature: 0.9,
      systemPrompt: "Return only a valid JSON array of short CTA strings.",
    });

    const suggestions = Array.isArray(result)
      ? result.filter((s) => typeof s === "string" && s.trim()).slice(0, 5)
      : [];

    return NextResponse.json({ success: true, data: { suggestions } });
  } catch (error) {
    console.error("CTA suggestion error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to generate suggestions" } },
      { status: 500 }
    );
  }
}
