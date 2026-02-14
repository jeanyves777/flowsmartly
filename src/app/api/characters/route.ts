import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export interface LibraryCharacter {
  id: string;
  name: string;
  category: string;
  tags: string[];
  thumbnail: string;
  texturePath: string;
  isPreRigged: boolean;
}

interface CharacterManifest {
  characters: LibraryCharacter[];
  categories: string[];
}

let cachedManifest: CharacterManifest | null = null;

async function loadManifest(): Promise<CharacterManifest> {
  // In development, always re-read from disk so changes are picked up immediately
  if (cachedManifest && process.env.NODE_ENV === "production") return cachedManifest;

  const manifestPath = path.join(process.cwd(), "public", "characters", "manifest.json");
  if (!existsSync(manifestPath)) {
    return { characters: [], categories: [] };
  }

  const data = await readFile(manifestPath, "utf-8");
  cachedManifest = JSON.parse(data);
  return cachedManifest!;
}

/**
 * GET /api/characters — List available library characters
 * Query params:
 *   - category: Filter by category (e.g., "boy", "girl", "animal")
 *   - search: Search by name or tags
 *   - page: Page number (1-based, default 1)
 *   - pageSize: Items per page (default 12, max 50)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const search = searchParams.get("search")?.toLowerCase();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") || "12", 10)));

  const manifest = await loadManifest();
  let characters = manifest.characters;

  if (category) {
    characters = characters.filter((c) => c.category === category);
  }

  if (search) {
    characters = characters.filter(
      (c) =>
        c.name.toLowerCase().includes(search) ||
        c.tags.some((t) => t.toLowerCase().includes(search))
    );
  }

  const total = characters.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const paginatedCharacters = characters.slice(start, start + pageSize);

  return NextResponse.json({
    characters: paginatedCharacters,
    categories: manifest.categories,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
    },
  });
}
