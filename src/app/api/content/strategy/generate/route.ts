import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { ai } from "@/lib/ai/client";
import { getDynamicCreditCost } from "@/lib/credits/costs";

interface GeneratedTask {
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  category: string;
  startDate: string;
  dueDate: string;
}

interface GeneratedStrategy {
  name: string;
  description: string;
  tasks: GeneratedTask[];
}

function parseJSON(str: string, fallback: unknown = []): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

// POST /api/content/strategy/generate - AI generates a marketing strategy from brand identity
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
    const {
      goals,
      timeframe,
      focusAreas,
      platforms,
      additionalContext,
      competitorInfo,
      budget,
    } = body;

    if (!goals?.trim()) {
      return NextResponse.json(
        { success: false, error: { message: "Goals are required" } },
        { status: 400 }
      );
    }

    // Check credits
    const creditCost = await getDynamicCreditCost("AI_POST");
    if (session.user.aiCredits < creditCost) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: `Not enough credits. Required: ${creditCost}, Available: ${session.user.aiCredits}`,
          },
        },
        { status: 402 }
      );
    }

    // Auto-load user's brand kit
    let brandKit = await prisma.brandKit.findFirst({
      where: { userId: session.userId, isDefault: true },
    });
    if (!brandKit) {
      brandKit = await prisma.brandKit.findFirst({
        where: { userId: session.userId },
      });
    }

    // Build brand context
    const brandContext = brandKit
      ? [
          `Brand name: ${brandKit.name}`,
          brandKit.tagline ? `Tagline: ${brandKit.tagline}` : null,
          brandKit.description ? `Description: ${brandKit.description}` : null,
          brandKit.industry ? `Industry: ${brandKit.industry}` : null,
          brandKit.niche ? `Niche: ${brandKit.niche}` : null,
          brandKit.targetAudience ? `Target audience: ${brandKit.targetAudience}` : null,
          brandKit.audienceAge ? `Audience age: ${brandKit.audienceAge}` : null,
          brandKit.audienceLocation ? `Audience location: ${brandKit.audienceLocation}` : null,
          brandKit.voiceTone ? `Brand voice/tone: ${brandKit.voiceTone}` : null,
          brandKit.uniqueValue ? `Unique value proposition: ${brandKit.uniqueValue}` : null,
          (() => {
            const kw = parseJSON(brandKit.keywords) as string[];
            return kw.length > 0 ? `Keywords: ${kw.join(", ")}` : null;
          })(),
          (() => {
            const pr = parseJSON(brandKit.products) as string[];
            return pr.length > 0 ? `Products/services: ${pr.join(", ")}` : null;
          })(),
          (() => {
            const ht = parseJSON(brandKit.hashtags) as string[];
            return ht.length > 0 ? `Brand hashtags: ${ht.join(", ")}` : null;
          })(),
          (() => {
            const pe = parseJSON(brandKit.personality) as string[];
            return pe.length > 0 ? `Brand personality: ${pe.join(", ")}` : null;
          })(),
          (() => {
            const handles = parseJSON(brandKit.handles, {}) as Record<string, string>;
            const active = Object.entries(handles)
              .filter(([, v]) => v)
              .map(([k, v]) => `${k}: ${v}`);
            return active.length > 0 ? `Social handles: ${active.join(", ")}` : null;
          })(),
          brandKit.guidelines ? `Brand guidelines: ${brandKit.guidelines}` : null,
        ]
          .filter(Boolean)
          .join("\n")
      : "No brand identity set up.";

    const today = new Date().toISOString().split("T")[0];
    const timeframeText =
      timeframe === "1_MONTH"
        ? "1 month"
        : timeframe === "6_MONTHS"
        ? "6 months"
        : "3 months";

    // Build focus areas instruction
    const validCategories = ["content", "social", "ads", "email", "analytics"];
    const selectedAreas: string[] = Array.isArray(focusAreas)
      ? focusAreas.filter((a: string) => validCategories.includes(a))
      : validCategories;
    const focusInstruction =
      selectedAreas.length < validCategories.length
        ? `Focus primarily on these areas: ${selectedAreas.join(", ")}. You may include a few tasks from other areas if relevant.`
        : `Generate tasks across all areas: ${validCategories.join(", ")}.`;

    // Build optional sections
    const optionalSections = [
      platforms?.length ? `Target platforms: ${platforms.join(", ")}` : null,
      competitorInfo?.trim() ? `Competitor context: ${competitorInfo}` : null,
      budget?.trim() ? `Budget context: ${budget}` : null,
      additionalContext?.trim() ? `Additional context: ${additionalContext}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    // Generate strategy via AI
    const generated = await ai.generateJSON<GeneratedStrategy>(
      `Create a comprehensive, personalized marketing strategy based on the following brand identity and goals.

--- BRAND IDENTITY ---
${brandContext}

--- GOALS ---
${goals}

--- PARAMETERS ---
Timeframe: ${timeframeText} starting from ${today}
${focusInstruction}
${optionalSections ? `\n${optionalSections}` : ""}

--- INSTRUCTIONS ---
Generate 15-25 actionable, specific tasks tailored to this brand.
Each task should reference the brand's actual products, audience, tone, or niche where possible.
Distribute tasks across the timeframe with realistic start and due dates.
Prioritize tasks that directly support the stated goals.

For each task provide:
- title: Short, actionable task title (specific to this brand, not generic)
- description: Detailed description of what to do, with specific recommendations for this brand
- priority: LOW, MEDIUM, or HIGH
- category: One of "content", "social", "ads", "email", "analytics"
- startDate: ISO date string (YYYY-MM-DD)
- dueDate: ISO date string (YYYY-MM-DD)

Return JSON with this structure:
{
  "name": "Strategy name based on the brand and goals",
  "description": "Brief strategy overview explaining the approach",
  "tasks": [{ "title", "description", "priority", "category", "startDate", "dueDate" }]
}`,
      {
        maxTokens: 8192,
        systemPrompt:
          "You are an expert marketing strategist who creates highly personalized, brand-specific strategies. Every task you generate should be tailored to the specific brand, its audience, products, and goals. Avoid generic advice. Return ONLY valid JSON.",
      }
    );

    if (!generated || !generated.tasks || !Array.isArray(generated.tasks)) {
      console.error("AI returned invalid strategy:", JSON.stringify(generated));
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "AI failed to generate a valid strategy. Please try again.",
          },
        },
        { status: 500 }
      );
    }

    // Validate and sanitize tasks
    const validPriorities = ["LOW", "MEDIUM", "HIGH"];

    const sanitizedTasks = generated.tasks
      .filter((t) => t.title?.trim())
      .map((t, index) => ({
        title: t.title.trim(),
        description: t.description || null,
        priority: validPriorities.includes(t.priority) ? t.priority : "MEDIUM",
        category: validCategories.includes(t.category) ? t.category : "content",
        startDate: t.startDate ? new Date(t.startDate) : null,
        dueDate: t.dueDate ? new Date(t.dueDate) : null,
        sortOrder: index,
        aiSuggested: true,
      }));

    // Archive any current ACTIVE strategies before creating new one
    await prisma.marketingStrategy.updateMany({
      where: { userId: session.userId, status: "ACTIVE" },
      data: { status: "ARCHIVED" },
    });

    // Create strategy and tasks in a transaction, plus deduct credits
    const [strategy] = await prisma.$transaction([
      prisma.marketingStrategy.create({
        data: {
          userId: session.userId,
          name: generated.name || "AI Marketing Strategy",
          description: generated.description || null,
          aiGenerated: true,
          status: "ACTIVE",
          totalTasks: sanitizedTasks.length,
          completedTasks: 0,
          tasks: {
            create: sanitizedTasks.map((t) => ({
              title: t.title,
              description: t.description,
              priority: t.priority,
              category: t.category,
              startDate:
                t.startDate && !isNaN(t.startDate.getTime())
                  ? t.startDate
                  : null,
              dueDate:
                t.dueDate && !isNaN(t.dueDate.getTime()) ? t.dueDate : null,
              sortOrder: t.sortOrder,
              aiSuggested: true,
            })),
          },
        },
        include: {
          tasks: {
            orderBy: { sortOrder: "asc" },
          },
        },
      }),
      prisma.user.update({
        where: { id: session.userId },
        data: { aiCredits: { decrement: creditCost } },
      }),
      prisma.creditTransaction.create({
        data: {
          userId: session.userId,
          type: "USAGE",
          amount: -creditCost,
          balanceAfter: session.user.aiCredits - creditCost,
          referenceType: "ai_usage",
          description: "AI marketing strategy generation",
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        strategy: {
          id: strategy.id,
          name: strategy.name,
          description: strategy.description,
          aiGenerated: strategy.aiGenerated,
          status: strategy.status,
          totalTasks: strategy.totalTasks,
          completedTasks: strategy.completedTasks,
          tasks: strategy.tasks.map((task) => ({
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            category: task.category,
            startDate: task.startDate?.toISOString() || null,
            dueDate: task.dueDate?.toISOString() || null,
            completedAt: null,
            sortOrder: task.sortOrder,
            aiSuggested: task.aiSuggested,
            createdAt: task.createdAt.toISOString(),
            updatedAt: task.updatedAt.toISOString(),
          })),
          createdAt: strategy.createdAt.toISOString(),
          updatedAt: strategy.updatedAt.toISOString(),
        },
        creditsUsed: creditCost,
      },
    });
  } catch (error) {
    console.error("Generate strategy error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { message: "Failed to generate strategy" },
      },
      { status: 500 }
    );
  }
}
