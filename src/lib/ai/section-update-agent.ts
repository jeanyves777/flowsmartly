import { ai } from "@/lib/ai/client";
import { existsSync, readFileSync, readdirSync } from "fs";
import { join, sep } from "path";
import type { AgentTool } from "./client";

/**
 * Section-update agent — replaces the raw Claude call in
 * /api/websites/[id]/update-section + /api/ecommerce/store/[id]/update-section.
 *
 * The legacy implementation hand-rolled an Anthropic SDK call with a static
 * system prompt. Two recurring failures resulted:
 *   1. Ghost imports — the model invents component names like
 *      `ServicesWithImages` that don't exist as files. The validator then
 *      writes empty stubs and the section disappears on the live site.
 *   2. Brittle dark-mode classes — the model can't see other components in
 *      the site, so it can't match their styling vocabulary.
 *
 * The agent fixes both by exposing two read-only tools the model can call
 * before it commits to an answer:
 *   - `list_existing_components` — list of files actually present in
 *     src/components/, so any new import can be cross-checked.
 *   - `read_component(name)` — read the contents of a specific component
 *     so the model can mirror its conventions instead of guessing.
 *
 * Both tools have `siteDir` baked in via closure, never accepted from the
 * model — protects against path traversal.
 */

export type SiteKind = "website" | "store";

export interface SectionUpdateInput {
  /** Absolute path to the generated site (website OR store). */
  siteDir: string;
  /** Section identifier (hero, footer, homepage, etc.). */
  section: string;
  /** User's natural-language change request. */
  prompt: string;
  /** Path-prefix for hosted assets (e.g. "/sites/my-site" or "/stores/my-store"). */
  basePath: string;
  /** Files the agent is allowed to edit. */
  files: Array<{ path: string; absPath: string; content: string }>;
  /** Contents of src/lib/data.ts — site-wide brand data. */
  dataContent: string;
  /** Whether this is a website or a store — gates color/dark-mode rules. */
  kind: SiteKind;
}

export interface SectionUpdateResult {
  /** Files the agent decided to write, with their new contents. */
  updates: Array<{ absPath: string; content: string }>;
  /** Total Claude tokens consumed. */
  usage: { inputTokens: number; outputTokens: number };
  /** Iterations the agent loop executed. */
  iterations: number;
  /** Tools the agent called, in order. */
  toolsUsed: string[];
}

function buildTools(siteDir: string): AgentTool[] {
  const componentsDir = join(siteDir, "src", "components");

  return [
    {
      name: "list_existing_components",
      description:
        "List every component file currently in this site's src/components/ folder. Call this BEFORE adding any new @/components/* import so you can confirm the file actually exists. Returns an array of component names (without .tsx extension). If you want to add a 'ServicesWithImages' import, this will tell you whether it exists — if not, you must edit the existing Services.tsx instead.",
      input_schema: {
        type: "object",
        properties: {},
      },
      handler: async () => {
        try {
          if (!existsSync(componentsDir)) return { components: [], note: "No components directory" };
          const entries = readdirSync(componentsDir, { withFileTypes: true });
          const components: string[] = [];
          for (const e of entries) {
            if (e.isFile() && (e.name.endsWith(".tsx") || e.name.endsWith(".ts"))) {
              components.push(e.name.replace(/\.tsx?$/, ""));
            } else if (e.isDirectory()) {
              // Treat folder/index.tsx as a component named "folder"
              if (existsSync(join(componentsDir, e.name, "index.tsx"))) {
                components.push(e.name);
              }
            }
          }
          return { components: components.sort() };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to list components" };
        }
      },
    },
    {
      name: "read_component",
      description:
        "Read the full source of an existing component file by its name (without .tsx extension). Use this to understand a component's prop API and styling vocabulary BEFORE adding it as an import elsewhere. Only files inside src/components/ are accessible.",
      input_schema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Component name without .tsx (e.g. 'Hero', 'ProductCard'). No paths or '..' allowed.",
          },
        },
        required: ["name"],
      },
      handler: async (input) => {
        const raw = String(input.name || "").trim();
        // Reject anything with separators or relative paths — defense in depth
        if (!raw || raw.includes("..") || raw.includes("/") || raw.includes("\\") || raw.includes(sep)) {
          return { error: "Invalid component name" };
        }
        const candidates = [
          join(componentsDir, `${raw}.tsx`),
          join(componentsDir, `${raw}.ts`),
          join(componentsDir, raw, "index.tsx"),
        ];
        for (const c of candidates) {
          if (existsSync(c)) {
            try {
              const content = readFileSync(c, "utf-8");
              // Cap at 8K chars per read so a giant file doesn't blow context
              return { name: raw, content: content.slice(0, 8000), truncated: content.length > 8000 };
            } catch (err) {
              return { error: err instanceof Error ? err.message : "Read failed" };
            }
          }
        }
        return { error: `Component "${raw}" not found in src/components/` };
      },
    },
  ];
}

function buildSystemPrompt(input: SectionUpdateInput): string {
  const isStore = input.kind === "store";
  const colorRules = isStore
    ? `
COLORS (store theme system):
- Use ONLY these color families: primary-{50,100,200,400,500,600,700,900}, secondary-{500,600}, accent-{500,600}, gray-*, white, black.
- NEVER invent decorative palettes (emerald-600, purple-900, orange-400 etc.) — they clash with the store brand.
- Valid opacity modifiers: primary/10, primary/20, primary/30, primary/90. Never chain like primary/30/30 — Tailwind can't parse that.
- Every interactive element MUST pass contrast in BOTH light and dark modes. Write both variants explicitly.
- Solid primary buttons: "bg-primary-600 hover:bg-primary-700 text-white"
- Subtle primary chips: "bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
- NEVER use "bg-white text-white" or "bg-gray-900 text-gray-900" pairs.

SCOPE:
- The products page (src/app/products/page.tsx) MUST stay minimal: <main><ProductGrid /></main>. Do NOT add hero sections, CTAs, FAQ to it — ProductGrid already has search, category filter, and sort.
- Do not modify data files (src/lib/data.ts, src/lib/products.ts) — only components/pages.`
    : `
COLORS:
- Support BOTH light and dark modes — use the Tailwind "dark:" prefix on every color class.
- Use brand colors from data.ts where appropriate.`;

  const linkRules = isStore
    ? `
LINKS:
- Internal navigation: use <Link> from "next/link" with root-relative paths like "/about", "/products". Next.js Link handles basePath automatically. NEVER use a plain <a> for internal links.
- NEVER import a "storeUrl" helper — it does not exist; importing it will break the build.
- Image src in <img>: must be absolute including basePath, e.g. "${input.basePath}/images/foo.jpg" (Next.js does NOT auto-prefix <img> tags).`
    : `
LINKS:
- All image src paths must start with "${input.basePath}/images/".
- All internal href links must start with "${input.basePath}/".`;

  return `You are updating a specific section of a Next.js ${isStore ? "e-commerce store" : "marketing website"}.

You have TOOLS available — use them BEFORE writing any code that adds a new @/components/* import:
1. Call list_existing_components first to see what actually exists.
2. If you want to use an existing component, call read_component to confirm its props and styling.
3. NEVER add an import for a component that list_existing_components doesn't return — instead, EDIT the existing component (e.g. modify Services.tsx to add images, do not import a non-existent ServicesWithImages.tsx).

GENERAL RULES:
- Tailwind CSS v4 syntax (no tailwind.config needed).
- Keep "use client" directive if present in each file.
- Preserve existing functionality (animations, responsive design, slideshows).
- For slideshows: render ALL slides with z-0 (NEVER negative z-index), use opacity-100/opacity-0 + transition-opacity, preserve image src paths exactly.
${linkRules}
${colorRules}

RESPONSE FORMAT — your final answer (NOT tool calls — your final text response after you're done with tools):
- If updating a SINGLE file: return ONLY the file content, no markdown fences.
- If updating MULTIPLE files: wrap each one (no markdown fences inside):
<file path="/src/components/Services.tsx">
...updated content...
</file>
<file path="/src/app/page.tsx">
...updated content...
</file>

SITE DATA (data.ts, first 3000 chars) for context:
\`\`\`typescript
${input.dataContent.substring(0, 3000)}
\`\`\``;
}

function buildUserMessage(input: SectionUpdateInput): string {
  return (
    input.files
      .map((f) => `FILE: ${f.path}\n\`\`\`tsx\n${f.content}\n\`\`\``)
      .join("\n\n") +
    `\n\nUSER REQUEST: ${input.prompt}\n\nUpdate the relevant file(s) above. Use the tools to verify any new imports BEFORE writing code. Return ONLY code in your final answer using the format described in the system prompt — no commentary.`
  );
}

export async function runSectionUpdateAgent(
  input: SectionUpdateInput,
): Promise<SectionUpdateResult> {
  const tools = buildTools(input.siteDir);
  const run = await ai.runWithTools<unknown>(
    buildUserMessage(input),
    tools,
    {
      systemPrompt: buildSystemPrompt(input),
      maxTokens: 16000,
      temperature: 0.4,
      maxIterations: 8, // 1-2 tool calls + final answer; cap to keep latency reasonable
      thinkingBudget: 2000,
    },
  );

  const raw = run.text.trim();
  if (!raw) {
    throw new Error("Agent returned empty response");
  }

  const updates = parseUpdates(raw, input);
  if (updates.length === 0) {
    throw new Error("Agent returned content that didn't match any editable file");
  }

  return { updates, usage: run.usage, iterations: run.iterations, toolsUsed: run.toolsUsed };
}

function parseUpdates(
  raw: string,
  input: SectionUpdateInput,
): Array<{ absPath: string; content: string }> {
  // Multi-file response: <file path="..."> ... </file>
  const multiFileMatches = [...raw.matchAll(/<file path="([^"]+)">([\s\S]*?)<\/file>/g)];
  if (multiFileMatches.length > 0) {
    const result: Array<{ absPath: string; content: string }> = [];
    for (const [, relPath, content] of multiFileMatches) {
      const cleaned = relPath.replace(/\\/g, "/").replace(/^\//, "");
      const target = input.files.find(
        (f) => f.path.replace(/\\/g, "/").replace(/^\//, "") === cleaned,
      );
      const trimmed = content.trim();
      if (target && trimmed.length >= 50) {
        result.push({ absPath: target.absPath, content: stripFences(trimmed, target.content) });
      }
    }
    return result;
  }

  // Single-file response: write to the primary file
  const primary = input.files[0];
  if (!primary) return [];
  const cleaned = stripFences(raw, primary.content);
  if (cleaned.length < 50) return [];
  return [{ absPath: primary.absPath, content: cleaned }];
}

function stripFences(content: string, original: string): string {
  let out = content
    .replace(/^```(?:tsx|typescript|ts|javascript|jsx)?\n?/, "")
    .replace(/\n?```$/, "")
    .replace(/^(?:javascript|tsx?|jsx)\s*\n/i, "")
    .trim();
  // Preserve "use client" directive if it was on the original file
  if (
    (original.includes("'use client'") || original.includes('"use client"')) &&
    !out.startsWith("'use client'") &&
    !out.startsWith('"use client"')
  ) {
    out = "'use client'\n\n" + out;
  }
  return out;
}
