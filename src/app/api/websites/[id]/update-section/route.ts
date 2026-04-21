import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { getSiteDir } from "@/lib/website/site-builder";
import { runSectionUpdateAgent } from "@/lib/ai/section-update-agent";

/** Parse @/components/* imports from a TSX file and return existing file paths */
function resolveComponentImports(fileContent: string, siteDir: string): string[] {
  const matches = fileContent.matchAll(/from\s+['"]@\/components\/([^'"]+)['"]/g);
  const result: string[] = [];
  for (const m of matches) {
    const candidates = [
      join(siteDir, "src", "components", m[1] + ".tsx"),
      join(siteDir, "src", "components", m[1] + ".ts"),
      join(siteDir, "src", "components", m[1], "index.tsx"),
    ];
    for (const c of candidates) {
      if (existsSync(c) && !result.includes(c)) {
        result.push(c);
        break;
      }
    }
  }
  return result;
}

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

    // For homepage: also load component files it imports so Claude can edit them directly
    const primaryFile = files[0];
    const primaryContent = readFileSync(primaryFile, "utf-8");
    const extraComponentFiles = section === "homepage"
      ? resolveComponentImports(primaryContent, siteDir)
      : [];

    // All writable files: primary + imported components (homepage only)
    const allWritableFiles = [primaryFile, ...extraComponentFiles];

    // Read the current section file(s)
    const fileContents = allWritableFiles.map((f) => ({
      path: f.replace(siteDir, "").replace(/\\/g, "/"),
      absPath: f,
      content: readFileSync(f, "utf-8"),
    }));

    // Also read data.ts for context (company info, etc.)
    const dataPath = join(siteDir, "src", "lib", "data.ts");
    let dataContent = "";
    try {
      dataContent = readFileSync(dataPath, "utf-8");
    } catch {}

    // Run the section-update agent. The agent has tools to list and read
    // existing components, which prevents the ghost-import problem we kept
    // hitting with the raw single-shot prompt.
    const basePath = `/sites/${website.slug}`;
    const agentResult = await runSectionUpdateAgent({
      siteDir,
      section,
      prompt,
      basePath,
      kind: "website",
      dataContent,
      files: fileContents,
    });

    // Persist each update the agent decided to make
    for (const update of agentResult.updates) {
      writeFileSync(update.absPath, update.content, "utf-8");
    }

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
