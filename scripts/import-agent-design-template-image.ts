import { copyFile, mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import {
  AGENT_DESIGN_TEMPLATES,
  getAgentDesignTemplateById,
} from "../src/lib/ai/flow-agent/design-templates";

const OUT_ROOT = path.join(process.cwd(), "public", "agent-design-templates");
const IMAGE_DIR = path.join(OUT_ROOT, "images");
const THUMB_DIR = path.join(OUT_ROOT, "thumbs");
const META_DIR = path.join(OUT_ROOT, "meta");

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const templateId = args.template || args.id;
  const source = args.source;

  if (!templateId || !source) {
    throw new Error("Usage: npx tsx scripts/import-agent-design-template-image.ts --template <id> --source <generated-png> [--prompt-file <txt>]");
  }

  const template = getAgentDesignTemplateById(templateId);
  if (!template) throw new Error(`Unknown agent design template: ${templateId}`);

  await Promise.all([
    mkdir(IMAGE_DIR, { recursive: true }),
    mkdir(THUMB_DIR, { recursive: true }),
    mkdir(META_DIR, { recursive: true }),
  ]);

  const imagePath = path.join(IMAGE_DIR, `${template.id}.png`);
  const thumbPath = path.join(THUMB_DIR, `${template.id}.png`);
  const metaPath = path.join(META_DIR, `${template.id}.json`);

  await copyFile(source, imagePath);
  await sharp(imagePath)
    .resize({ width: 480, withoutEnlargement: true })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(thumbPath);

  const prompt = args["prompt-file"]
    ? await readFile(path.resolve(args["prompt-file"]), "utf8")
    : args.prompt || "";

  await writeFile(
    metaPath,
    `${JSON.stringify(buildMeta(template, prompt.trim(), source), null, 2)}\n`,
    "utf8",
  );

  await refreshManifest();

  console.log(JSON.stringify({
    imported: template.id,
    imagePath,
    thumbPath,
    metaPath,
  }, null, 2));
}

function buildMeta(
  template: NonNullable<ReturnType<typeof getAgentDesignTemplateById>>,
  sourcePrompt: string,
  sourcePath: string,
) {
  return {
    id: template.id,
    name: template.name,
    industry: template.industry,
    industryLabel: template.industryLabel,
    useCase: template.useCase,
    audience: template.audience,
    format: template.format,
    palette: template.palette,
    copySlots: template.copySlots,
    industryTags: template.industryTags,
    styleTags: template.styleTags,
    metaTags: template.metaTags,
    imageUrl: template.imageUrl,
    thumbnailUrl: template.thumbnailUrl,
    promptGuidance: template.promptGuidance,
    assetSource: "codex-imagegen",
    assetKind: "ai-generated-raster-template",
    generatedBy: "Codex built-in image generator",
    generatedSourcePath: sourcePath,
    sourcePrompt,
    importedAt: new Date().toISOString(),
  };
}

async function refreshManifest() {
  const templates = await Promise.all(AGENT_DESIGN_TEMPLATES.map(async (template) => {
    const metaPath = path.join(META_DIR, `${template.id}.json`);
    let assetSource = "pending";
    let importedAt: string | null = null;

    try {
      const meta = JSON.parse(await readFile(metaPath, "utf8"));
      assetSource = meta.assetSource || "legacy";
      importedAt = meta.importedAt || null;
    } catch {
      assetSource = "pending";
    }

    return {
      id: template.id,
      name: template.name,
      industry: template.industry,
      industryLabel: template.industryLabel,
      imageUrl: template.imageUrl,
      thumbnailUrl: template.thumbnailUrl,
      metaUrl: template.metaUrl,
      metaTags: template.metaTags,
      assetSource,
      importedAt,
    };
  }));

  const manifest = {
    generatedAt: new Date().toISOString(),
    count: AGENT_DESIGN_TEMPLATES.length,
    codexImagegenCount: templates.filter((template) => template.assetSource === "codex-imagegen").length,
    templates,
  };

  await writeFile(path.join(OUT_ROOT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function parseArgs(args: string[]) {
  const parsed: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const value = args[i + 1] && !args[i + 1].startsWith("--") ? args[++i] : "true";
    parsed[key] = value;
  }
  return parsed;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
