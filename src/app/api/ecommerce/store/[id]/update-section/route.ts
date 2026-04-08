import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import Anthropic from "@anthropic-ai/sdk";

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

const STORES_BASE = process.platform === "win32"
  ? "C:\\Users\\koffi\\Dev\\flowsmartly\\generated-stores"
  : "/var/www/flowsmartly/generated-stores";

function getStoreDir(storeId: string) {
  return join(STORES_BASE, storeId);
}

function getSectionFiles(storeDir: string, section: string): string[] {
  const map: Record<string, string[]> = {
    hero: ["src/components/Hero.tsx"],
    header: ["src/components/Header.tsx"],
    footer: ["src/components/Footer.tsx"],
    homepage: ["src/app/page.tsx"],
    products: ["src/app/products/page.tsx"],
    about: ["src/app/about/page.tsx"],
    contact: ["src/app/contact/page.tsx"],
    faq: ["src/app/faq/page.tsx"],
    policies: ["src/app/policies/page.tsx", "src/app/shipping-returns/page.tsx"],
    cart: ["src/app/cart/page.tsx", "src/components/Cart.tsx"],
    data: ["src/lib/data.ts"],
  };

  const candidates = map[section] || [];
  return candidates.map((f) => join(storeDir, f)).filter((f) => existsSync(f));
}

function detectSections(storeDir: string): Array<{ id: string; label: string }> {
  const sections: Array<{ id: string; label: string }> = [];
  const checks: Array<[string, string, string[]]> = [
    ["hero", "Hero Section", ["src/components/Hero.tsx"]],
    ["header", "Header / Navigation", ["src/components/Header.tsx"]],
    ["footer", "Footer", ["src/components/Footer.tsx"]],
    ["homepage", "Home Page", ["src/app/page.tsx"]],
    ["products", "Products Page", ["src/app/products/page.tsx"]],
    ["about", "About Page", ["src/app/about/page.tsx"]],
    ["contact", "Contact", ["src/app/contact/page.tsx"]],
    ["faq", "FAQ", ["src/app/faq/page.tsx"]],
    ["policies", "Policies", ["src/app/policies/page.tsx", "src/app/shipping-returns/page.tsx"]],
    ["data", "Store Data (company info, config)", ["src/lib/data.ts"]],
  ];

  for (const [id, label, files] of checks) {
    if (files.some((f) => existsSync(join(storeDir, f)))) {
      sections.push({ id, label });
    }
  }

  try {
    const appDir = join(storeDir, "src", "app");
    if (existsSync(appDir)) {
      const dirs = readdirSync(appDir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith("_") && !d.name.startsWith("(") && !d.name.startsWith("["))
        .map((d) => d.name);
      for (const dir of dirs) {
        if (!sections.find((s) => s.id === dir) && existsSync(join(appDir, dir, "page.tsx"))) {
          sections.push({ id: dir, label: dir.charAt(0).toUpperCase() + dir.slice(1).replace(/-/g, " ") });
        }
      }
    }
  } catch {}

  return sections;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const store = await prisma.store.findFirst({
      where: { id, userId: session.userId },
      select: { id: true, generatedPath: true },
    });
    if (!store) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const storeDir = store.generatedPath || getStoreDir(id);
    const sections = detectSections(storeDir);

    const cost = await getSectionCreditCost();
    return NextResponse.json({ sections, creditCost: cost });
  } catch (err) {
    console.error("GET store update-section error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

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
        error: `Not enough credits. Need ${creditCost}, have ${user?.aiCredits || 0}`,
      }, { status: 402 });
    }

    const store = await prisma.store.findFirst({
      where: { id, userId: session.userId },
      select: { id: true, slug: true, generatedPath: true, name: true },
    });
    if (!store) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const storeDir = store.generatedPath || getStoreDir(id);
    const files = getSectionFiles(storeDir, section);

    if (files.length === 0) {
      return NextResponse.json({ error: `Section "${section}" not found` }, { status: 404 });
    }

    const fileContents = files.map((f) => ({
      path: f.replace(storeDir, "").replace(/\\/g, "/"),
      content: readFileSync(f, "utf-8"),
    }));

    const dataPath = join(storeDir, "src", "lib", "data.ts");
    let dataContent = "";
    try { dataContent = readFileSync(dataPath, "utf-8"); } catch {}

    const anthropic = new Anthropic();
    const basePath = `/stores/${store.slug}`;

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 16000,
      system: `You are updating a section of a Next.js e-commerce store.

RULES:
- Return ONLY the updated file content (no markdown, no explanations)
- Keep imports, exports, component structure
- Tailwind CSS v4 for styling
- basePath is "${basePath}" — image src paths start with "${basePath}/images/"
- Internal href links start with "${basePath}/"
- Keep "use client" if present
- Preserve dark mode, responsive design, existing functionality

STORE DATA:\n\`\`\`\n${dataContent.substring(0, 3000)}\n\`\`\``,
      messages: [{
        role: "user",
        content: fileContents.map((f) => `FILE: ${f.path}\n\`\`\`tsx\n${f.content}\n\`\`\``).join("\n\n") +
          `\n\nREQUEST: ${prompt}\n\nReturn updated ${fileContents[0].path}. ONLY code, no fences.`,
      }],
    });

    const updatedContent = response.content
      .filter((c) => c.type === "text")
      .map((c) => c.type === "text" ? c.text : "")
      .join("")
      .replace(/^```(?:tsx|typescript|ts)?\n?/, "")
      .replace(/\n?```$/, "")
      .trim();

    if (!updatedContent || updatedContent.length < 50) {
      return NextResponse.json({ error: "AI returned invalid content" }, { status: 500 });
    }

    writeFileSync(files[0], updatedContent, "utf-8");

    await prisma.user.update({
      where: { id: session.userId },
      data: { aiCredits: { decrement: creditCost } },
    });

    await prisma.creditTransaction.create({
      data: {
        userId: session.userId,
        type: "USAGE",
        amount: -creditCost,
        description: `Store section update: ${section} — ${store.name}`,
        balanceAfter: user.aiCredits - creditCost,
      },
    });

    return NextResponse.json({
      success: true,
      message: `${section} section updated! Click Rebuild to apply.`,
      creditCost: creditCost,
    });
  } catch (err: any) {
    console.error("POST store update-section error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
