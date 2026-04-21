import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { runSectionUpdateAgent } from "@/lib/ai/section-update-agent";

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
      absPath: f,
      content: readFileSync(f, "utf-8"),
    }));

    const dataPath = join(storeDir, "src", "lib", "data.ts");
    let dataContent = "";
    try { dataContent = readFileSync(dataPath, "utf-8"); } catch {}

    // Run the section-update agent — same pattern as websites route.
    // Agent has tools to list/read existing components which prevents the
    // ghost-import bug + uses Opus 4.7 with adaptive thinking by default.
    const basePath = `/stores/${store.slug}`;
    const agentResult = await runSectionUpdateAgent({
      siteDir: storeDir,
      section,
      prompt,
      basePath,
      kind: "store",
      dataContent,
      files: fileContents,
    });

    for (const update of agentResult.updates) {
      writeFileSync(update.absPath, update.content, "utf-8");
    }

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
