import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export interface DesignTemplate {
  id: string;
  name: string;
  category: string;
  preset: string;
  thumbnail: string;
  image: string;
  tags: string[];
}

interface TemplateManifest {
  templates: DesignTemplate[];
}

let cachedManifest: TemplateManifest | null = null;

async function loadManifest(): Promise<TemplateManifest> {
  if (cachedManifest && process.env.NODE_ENV === "production") return cachedManifest;

  const manifestPath = path.join(process.cwd(), "public", "templates", "manifest.json");
  if (!existsSync(manifestPath)) {
    return { templates: [] };
  }

  const data = await readFile(manifestPath, "utf-8");
  cachedManifest = JSON.parse(data);
  return cachedManifest!;
}

/**
 * GET /api/design-templates — List available visual design templates
 * Query params:
 *   - category: Filter by design category (e.g., "social_post", "ad", "flyer")
 *   - search: Search by name or tags
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const search = searchParams.get("search")?.toLowerCase();

  const manifest = await loadManifest();
  let templates = manifest.templates;

  if (category) {
    templates = templates.filter((t) => t.category === category);
  }

  if (search) {
    templates = templates.filter(
      (t) =>
        t.name.toLowerCase().includes(search) ||
        t.tags.some((tag) => tag.toLowerCase().includes(search))
    );
  }

  return NextResponse.json({
    success: true,
    templates,
    total: templates.length,
  });
}
