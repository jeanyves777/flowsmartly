import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { getSiteDir } from "@/lib/website/site-builder";
import Anthropic from "@anthropic-ai/sdk";

// Default credit cost — can be overridden by admin via SystemSetting key: "section_update_credit_cost"
const DEFAULT_CREDIT_COST = 50;

async function getSectionCreditCost(): Promise<number> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "section_update_credit_cost" },
    });
    if (setting?.value) return parseInt(setting.value, 10) || DEFAULT_CREDIT_COST;
  } catch {}
  return DEFAULT_CREDIT_COST;
}

// Map section names to file paths relative to the site's src directory
function getSectionFiles(siteDir: string, section: string): string[] {
  const map: Record<string, string[]> = {
    hero: ["src/components/Hero.tsx"],
    header: ["src/components/Header.tsx"],
    footer: ["src/components/Footer.tsx"],
    about: ["src/app/about/page.tsx"],
    services: ["src/app/services/page.tsx", "src/components/Services.tsx"],
    team: ["src/app/team/page.tsx", "src/components/Team.tsx"],
    faq: ["src/app/faq/page.tsx", "src/components/FAQ.tsx"],
    blog: ["src/app/blog/page.tsx"],
    gallery: ["src/app/gallery/page.tsx", "src/components/Gallery.tsx"],
    contact: ["src/app/contact/page.tsx", "src/components/Contact.tsx"],
    testimonials: ["src/app/testimonials/page.tsx", "src/components/Testimonials.tsx"],
    homepage: ["src/app/page.tsx"],
    layout: ["src/app/layout.tsx"],
    data: ["src/lib/data.ts"],
  };

  const candidates = map[section] || [];
  return candidates
    .map((f) => join(siteDir, f))
    .filter((f) => existsSync(f));
}

// Detect which sections exist in the site
function detectSections(siteDir: string): Array<{ id: string; label: string }> {
  const sections: Array<{ id: string; label: string }> = [];
  const checks: Array<[string, string, string[]]> = [
    ["hero", "Hero Section", ["src/components/Hero.tsx"]],
    ["header", "Header / Navigation", ["src/components/Header.tsx"]],
    ["footer", "Footer", ["src/components/Footer.tsx"]],
    ["homepage", "Home Page", ["src/app/page.tsx"]],
    ["about", "About Page", ["src/app/about/page.tsx"]],
    ["services", "Services", ["src/app/services/page.tsx", "src/components/Services.tsx"]],
    ["team", "Team", ["src/app/team/page.tsx", "src/components/Team.tsx"]],
    ["contact", "Contact", ["src/app/contact/page.tsx", "src/components/Contact.tsx"]],
    ["faq", "FAQ", ["src/app/faq/page.tsx", "src/components/FAQ.tsx"]],
    ["blog", "Blog", ["src/app/blog/page.tsx"]],
    ["gallery", "Gallery", ["src/app/gallery/page.tsx", "src/components/Gallery.tsx"]],
    ["testimonials", "Testimonials", ["src/app/testimonials/page.tsx", "src/components/Testimonials.tsx"]],
    ["data", "Site Data (company info, stats)", ["src/lib/data.ts"]],
  ];

  for (const [id, label, files] of checks) {
    if (files.some((f) => existsSync(join(siteDir, f)))) {
      sections.push({ id, label });
    }
  }

  // Also detect any custom pages in src/app/
  try {
    const appDir = join(siteDir, "src", "app");
    const dirs = readdirSync(appDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("_") && !d.name.startsWith("("))
      .map((d) => d.name);
    for (const dir of dirs) {
      const existing = sections.find((s) => s.id === dir);
      if (!existing && existsSync(join(appDir, dir, "page.tsx"))) {
        sections.push({ id: dir, label: dir.charAt(0).toUpperCase() + dir.slice(1).replace(/-/g, " ") });
      }
    }
  } catch {}

  return sections;
}

/**
 * GET /api/websites/[id]/update-section
 * Returns available sections for this website
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const website = await prisma.website.findFirst({
      where: { id, userId: session.userId, deletedAt: null },
      select: { id: true, generatedPath: true },
    });
    if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const siteDir = website.generatedPath || getSiteDir(id);
    const sections = detectSections(siteDir);
    const cost = await getSectionCreditCost();

    return NextResponse.json({
      sections,
      creditCost: cost,
    });
  } catch (err) {
    console.error("GET update-section error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * POST /api/websites/[id]/update-section
 * AI-powered section update
 * Body: { section: string, prompt: string }
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const body = await request.json();
    const { section, prompt } = body;

    if (!section || !prompt) {
      return NextResponse.json({ error: "Section and prompt are required" }, { status: 400 });
    }

    const creditCost = await getSectionCreditCost();

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { aiCredits: true },
    });

    if (!user || user.aiCredits < creditCost) {
      return NextResponse.json({
        error: `Not enough credits. You need ${creditCost} credits. Current balance: ${user?.aiCredits || 0}`,
      }, { status: 402 });
    }

    const website = await prisma.website.findFirst({
      where: { id, userId: session.userId, deletedAt: null },
      select: { id: true, slug: true, generatedPath: true, name: true },
    });
    if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const siteDir = website.generatedPath || getSiteDir(id);
    const files = getSectionFiles(siteDir, section);

    if (files.length === 0) {
      return NextResponse.json({ error: `Section "${section}" not found in this site` }, { status: 404 });
    }

    // Read the current section file(s)
    const fileContents = files.map((f) => ({
      path: f.replace(siteDir, "").replace(/\\/g, "/"),
      content: readFileSync(f, "utf-8"),
    }));

    // Also read data.ts for context (company info, etc.)
    const dataPath = join(siteDir, "src", "lib", "data.ts");
    let dataContent = "";
    try {
      dataContent = readFileSync(dataPath, "utf-8");
    } catch {}

    // Call Claude to update the section
    const anthropic = new Anthropic();
    const basePath = `/sites/${website.slug}`;

    const systemPrompt = `You are a web developer updating a specific section of a Next.js website.

RULES:
- Return ONLY the updated file content, nothing else (no markdown, no explanations)
- Keep the same imports, exports, and component structure
- Use Tailwind CSS for styling (v4 syntax — no tailwind.config needed)
- The site uses basePath "${basePath}" — all image src paths must start with "${basePath}/images/"
- All internal href links must start with "${basePath}/"
- Keep "use client" directive if present
- Keep existing functionality (animations, responsive design)
- Support BOTH light and dark modes — use Tailwind "dark:" prefix for all color/background classes. NEVER hardcode dark-only backgrounds (bg-black, bg-neutral-900) without a light-mode default. Example: bg-white dark:bg-neutral-950
- Make the requested change while preserving everything else
- Use the brand data from data.ts for company info, colors, etc.
- If the section has a slideshow/carousel with images, preserve all image src paths exactly as they are
- For slideshows: render ALL slides with z-0 (NEVER negative z-index), use opacity-100/opacity-0 + transition-opacity, first slide must be visible without JS

SITE DATA (data.ts) for context:
\`\`\`typescript
${dataContent.substring(0, 3000)}
\`\`\``;

    const userMessage = fileContents.map((f) =>
      `FILE: ${f.path}\n\`\`\`tsx\n${f.content}\n\`\`\``
    ).join("\n\n") + `\n\nUSER REQUEST: ${prompt}\n\nReturn the updated content for ${fileContents[0].path}. Return ONLY the code, no markdown fences.`;

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 16000,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    let updatedContent = response.content
      .filter((c) => c.type === "text")
      .map((c) => c.type === "text" ? c.text : "")
      .join("")
      .replace(/^```(?:tsx|typescript|ts|javascript|jsx)?\n?/, "")
      .replace(/\n?```$/, "")
      .replace(/^(?:javascript|tsx?|jsx)\s*\n/i, "")
      .trim();

    // Preserve 'use client' directive
    const originalContent = fileContents[0].content;
    if (originalContent.includes("'use client'") && !updatedContent.startsWith("'use client'") && !updatedContent.startsWith('"use client"')) {
      updatedContent = "'use client'\n\n" + updatedContent;
    }

    if (!updatedContent || updatedContent.length < 50) {
      return NextResponse.json({ error: "AI returned empty or invalid content" }, { status: 500 });
    }

    // Write the updated file
    writeFileSync(files[0], updatedContent, "utf-8");

    // Deduct credits
    await prisma.user.update({
      where: { id: session.userId },
      data: { aiCredits: { decrement: creditCost } },
    });

    // Log the transaction
    await prisma.creditTransaction.create({
      data: {
        userId: session.userId,
        type: "USAGE",
        amount: -creditCost,
        description: `Section update: ${section} — ${website.name}`,
        balanceAfter: user.aiCredits - creditCost,
      },
    });

    return NextResponse.json({
      success: true,
      message: `${section} section updated! Click Rebuild to apply changes.`,
      creditCost: creditCost,
      file: fileContents[0].path,
    });
  } catch (err: any) {
    console.error("POST update-section error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
