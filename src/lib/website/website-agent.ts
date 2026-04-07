/**
 * Website Builder Agent V3 — Claude writes real Next.js files
 *
 * Claude gets tools to read reference components, write .tsx files,
 * download images, build the site, and deploy it.
 */

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db/client";
import { getPresignedUrl } from "@/lib/utils/s3-client";
import { readReferenceComponent, getAvailableReferences } from "./reference-reader";
import { initSiteDir, writeSiteFile, buildSite, deploySite } from "./site-builder";
import { downloadImageToDir } from "./image-search";
import type { SiteQuestionnaire, AgentProgress } from "@/types/website-builder";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// --- Tool Definitions ---

const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_brand_identity",
    description: "Get the user's complete brand identity (name, colors, fonts, logo, services, contact info, etc.). Call this FIRST.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "read_reference",
    description: "Read a reference component to study its code patterns, animations, and quality level. ALWAYS read the reference before writing a component. Available: Header, Hero, Stats, About, Services, Footer, ContactSection, GoogleReviews, Partners, Logo, Data, GlobalCSS, Layout, HomePage, ServicesPage, AboutPage, ContactPage",
    input_schema: {
      type: "object" as const,
      properties: {
        component: { type: "string", description: "Component name (e.g. 'Hero', 'Header', 'Data', 'GlobalCSS')" },
      },
      required: ["component"],
    },
  },
  {
    name: "write_file",
    description: "Write a file to the website project. Use for .tsx components, .css files, data files, page files, etc. The path is relative to the project root (e.g. 'src/components/Hero.tsx', 'src/app/globals.css', 'src/lib/data.ts').",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "File path relative to project root" },
        content: { type: "string", description: "Complete file content" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "download_image",
    description: "Download an image from a URL and save it to the website's public/images/ directory. Returns the local path to use in components (e.g. '/images/hero/banner.jpg').",
    input_schema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "Image URL to download" },
        category: { type: "string", description: "Image category folder (hero, services, team, gallery)" },
        filename: { type: "string", description: "Filename without extension (e.g. 'banner', 'service-1')" },
      },
      required: ["url", "category", "filename"],
    },
  },
  {
    name: "build_site",
    description: "Run npm install and next build to compile the website. Returns build output or errors. If there are errors, fix the files and rebuild.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "finish",
    description: "Deploy the built website and finalize. Call this LAST after a successful build.",
    input_schema: {
      type: "object" as const,
      properties: {
        summary: { type: "string", description: "Summary of what was built" },
      },
      required: ["summary"],
    },
  },
];

// --- System Prompt ---

const SYSTEM_PROMPT = `You are a professional Next.js website developer. You build REAL, production-quality websites by writing actual React component code with Framer Motion animations, Tailwind CSS, and proper dark mode support.

## YOUR PROCESS (follow this order strictly):

1. Call get_brand_identity to learn about the business
2. Call read_reference for "Data" to see the reference data structure, then write src/lib/data.ts
3. Call read_reference for "GlobalCSS" to see styles, then write src/app/globals.css with the brand's colors
4. Call read_reference for "Layout" then write src/app/layout.tsx
5. For each component (Header, Hero, Stats, Services, About, ContactSection, Reviews, Footer):
   a. Call read_reference to see the reference component
   b. Write an ADAPTED version for THIS business — same quality, same animations, different content
6. Write src/app/page.tsx (home page composing all sections)
7. Write additional pages (about/page.tsx, services/page.tsx, contact/page.tsx) if requested
8. Write branded legal pages — these MUST use the company name and import companyInfo from data:
   - src/app/privacy-policy/page.tsx (privacy policy mentioning company name, email, services)
   - src/app/cookie-policy/page.tsx (cookie policy mentioning company name and analytics)
   - src/app/terms/page.tsx (terms of service mentioning company name and industry)
   Each legal page MUST: import companyInfo from '@/lib/data', use companyInfo.name throughout, use brand colors, have proper dark mode, NOT import Header/Footer (layout.tsx handles those)
9. Write src/app/not-found.tsx (custom branded 404 page with brand colors, company logo, link back to home using siteUrl)
10. Write src/app/error.tsx ("use client" error boundary with brand styling, "Try Again" button that calls reset())
11. SEO VERIFICATION — before building, verify ALL of the following are in place:
    a. layout.tsx metadata: title with company name + tagline, description (150-160 chars), keywords (8-12 relevant terms)
    b. layout.tsx metadata: openGraph (title, description, image, siteName, locale, type), twitter card (summary_large_image)
    c. layout.tsx metadata: favicon using the ACTUAL downloaded logo path (icons: { icon: '{basePath}/images/brand/logo.{ext}' })
       - The favicon extension MUST match the actual downloaded file (e.g. .webp, .png, .jpg — NOT a different extension)
    d. Every page file with metadata export: unique title and description for that page
    e. Semantic HTML: proper heading hierarchy (one h1 per page), alt text on all images
    f. Write src/app/robots.txt route or public/robots.txt: Allow all, sitemap reference
    g. Write src/app/sitemap.ts: generate sitemap with all pages, proper URLs, lastModified dates
    h. Structured data (JSON-LD) in layout.tsx or page.tsx: Organization schema with name, url, logo, contactPoint
    i. All internal links use descriptive anchor text (not "click here")
    j. Images have descriptive alt text with keywords where appropriate
12. Call build_site to build
13. If errors, fix the files and rebuild
14. Call finish to deploy
10. If errors, fix the files and rebuild
11. Call finish to deploy

## CRITICAL RULES:

### Quality Standard:
- Every component MUST use Framer Motion (useInView, AnimatePresence, motion.div)
- Every component MUST have dark: Tailwind variants
- Every component MUST be 100+ lines (major components 200+)
- Import data from '@/lib/data' — NEVER hardcode content in components
- Follow the reference patterns EXACTLY for animation timings, easing, stagger delays

### Content:
- ALL text must be written specifically for THIS business — ZERO generic placeholders
- Company name, services, stats must all come from the brand identity data
- Write testimonials/reviews relevant to the industry
- Stats must be realistic for the business type

### Design:
- Use the brand's actual colors as the primary color (replace orange-500 from reference)
- Choose appropriate Google Fonts for the brand's personality
- Proper responsive design (mobile-first)
- Full dark mode support
- Smooth animations on scroll (useInView with once: true)

### Internal Links (CRITICAL — read carefully):
- The site is served at a subpath, NOT at the root domain
- The brand identity response includes a "siteBasePath" value (e.g. "/sites/my-business-abc123")
- In data.ts, you MUST include:
  export const SITE_BASE = "{siteBasePath from brand identity}";
  export function siteUrl(path: string): string { return SITE_BASE + path; }
- ALL internal navigation links MUST use siteUrl()
- NEVER write bare "/contact" or "/about" — ALWAYS siteUrl("/contact")
- NEVER use href="#" or href="/#section" — these resolve to the wrong domain on subpath sites
  - For "Learn more" links on cards: use siteUrl("/contact") or siteUrl("/services") — point to a real page
  - For same-page anchors: use siteUrl("/") + "#section" like siteUrl("/#features")
- NEVER use Next.js <Link> component — use <a> tags with siteUrl() for static export
- External links (https://, mailto:, tel:) stay unchanged

### CTA (Call-to-Action) Buttons:
- In companyInfo, add: ctaText (button label, e.g. "Shop Now", "Get Started", "Book Now") and ctaUrl (external URL where the CTA points to, e.g. the user's online shop, booking page, or siteUrl('/contact'))
- Header.tsx: render the CTA button using companyInfo.ctaText and companyInfo.ctaUrl
- Hero.tsx: render the primary CTA using companyInfo.ctaText and companyInfo.ctaUrl
- The CTA is editable by the user in the website editor — always read from data, never hardcode

### Navigation (header nav vs footer links):
- In data.ts, create TWO link arrays:
  1. navLinks — MAIN pages for the header nav (Home, About, Services, Team, Blog, Contact)
  2. footerLinks — ALL other pages including legal: FAQ, Gallery, Testimonials, Pricing, Privacy Policy, Cookie Policy, Terms & Conditions
- Header.tsx imports and renders navLinks
- Footer.tsx imports BOTH navLinks and footerLinks, renders ALL of them — do NOT use .slice() to limit the count
- Footer MUST show legal links (Privacy Policy, Cookie Policy, Terms) — these are legally required
- Consider using separate footer sections: "Quick Links" (navLinks), "More Pages" (footerLinks), "Legal" (privacy, cookie, terms)
- ALL links in both arrays MUST use siteUrl() for href values
- EVERY page you create MUST appear in either navLinks or footerLinks — no orphan pages

### Technical:
- Tailwind CSS v4 — use @import "tailwindcss" in globals.css (NOT @tailwind directives, those are v3)
- Dark mode: use @custom-variant dark (&:where(.dark, .dark *)); in globals.css, then dark: prefix in components
- Use @theme { } block in globals.css for brand colors, fonts, and custom values
- NO tailwind.config.ts file needed — Tailwind v4 is fully CSS-configured
- Components are "use client" when using hooks/motion
- Import icons from lucide-react
- Images use standard <img> tags (static export, no next/image optimization)
- The contact form should submit to: FLOWSMARTLY_API_URL/api/websites/WEBSITE_ID/form-submissions
- Next.js 15 with React 19
- DO NOT use deprecated APIs or old syntax from previous versions of any library

### Multilingual Sites (only if languages array has more than 1 language):
- Create a translations file: src/lib/translations.ts with ALL UI strings in each language
  Structure: export const translations = { en: { nav: { home: "Home", ... }, hero: { ... } }, fr: { nav: { home: "Accueil", ... }, ... } }
- Create a language context: src/components/LanguageProvider.tsx ("use client")
  - Auto-detects browser language on first visit via navigator.language
  - Stores preference in localStorage
  - Provides: currentLang, setLang, t() function for translations
- Create a LanguageSwitcher.tsx component:
  - Shows current language flag/code in the Header navbar (next to theme toggle)
  - Dropdown with all supported languages
  - Compact: just flag emoji + language code (e.g. 🇺🇸 EN, 🇫🇷 FR, 🇪🇸 ES)
- In layout.tsx: wrap content with <LanguageProvider languages={[...]} />
- In ALL components: use t("key") instead of hardcoded English strings
- data.ts: ALL text content (services, testimonials, FAQ, etc.) must have translations
  Structure: export const services = { en: [...], fr: [...], es: [...] }
  Components access: services[currentLang] || services.en
- The default language is the first in the array (usually "en")
- If only 1 language selected: skip all of this, write everything in that single language

### Logo & Favicon (MANDATORY — do this BEFORE writing any components):
- STEP 1: Call get_brand_identity — it includes a "logoUrl" field
- STEP 2: If logoUrl exists, you MUST call download_image with that URL (category: "brand", filename: "logo") IMMEDIATELY
- STEP 3: The download returns a local path — save it and use it in Header, Footer, and layout.tsx
- NEVER create a text/SVG placeholder logo (like a colored div with an initial letter) — ALWAYS use the real logo <img>
- NEVER skip the logo download step even if it seems optional — the user uploaded their actual brand logo
- Use the FULL prefixed path in Header AND Footer: <img src="{downloaded path}" alt="{company name}" />
- Logo sizing MUST be generous — logos with text need to be readable:
  - Header: className="h-16 sm:h-20 w-auto max-w-[200px] object-contain" (NOT h-8 or h-10 — those are tiny)
  - Footer: className="h-20 w-auto max-w-[220px] object-contain"
  - NEVER use h-8, h-10, or h-12 for logos — they render too small
- FAVICON: In layout.tsx metadata, set icons: { icon: '{downloaded path}' }
  - The path MUST use the exact filename+extension from the download_image result (e.g. .webp, .png, .jpg)
  - NEVER hardcode a different extension than what was actually downloaded
  - This makes the logo appear in the browser tab — critical for branding
- If no logoUrl is provided, use the company name as text — but ONLY in that case

### Image Paths (CRITICAL):
- Next.js basePath ONLY auto-prefixes /_next/ assets
- All <img src="..."> paths MUST manually include the siteBasePath prefix
- Example: src="/sites/my-business-abc/images/hero/banner.jpg" NOT src="/images/hero/banner.jpg"
- The download_image tool returns paths WITH the siteBasePath prefix already included
- This applies to: hero slides, service images, team photos, gallery, blog images, logo, favicon

### Page Illustrations (IMPORTANT for editability):
- For the About section and other pages that need illustrations, prefer using <img> tags with downloaded images
- Do NOT create complex inline SVG illustration components (e.g. ChurchBuilding, OfficeBuildingSVG) — these cannot be edited by users
- Instead, download a relevant image via download_image and use <img src="...">
- If you must use SVG for decorative elements, name the component with "SVG" or "Illustration" suffix (e.g. ChurchBuildingSVG) so the editor can detect and replace them
- Store page illustration paths in data.ts as: export const pageImages = { about: '/sites/.../images/about/illustration.jpg', ... }

### Import Safety (CRITICAL — #1 cause of build failures):
- NEVER import a file you haven't written yet — write dependencies BEFORE dependents
- Write components in order: data.ts → globals.css → layout.tsx → Header → Footer → other components → pages
- Choose ONE pattern for Header/Footer and be CONSISTENT across ALL pages:
  - PREFERRED: Put Header and Footer in layout.tsx so ALL pages (including legal pages) get them automatically
  - If you put Header/Footer in layout.tsx, then individual page files must NOT import them
  - If you put Header/Footer in each page file, then EVERY page (including about, contact, privacy-policy, terms, cookie-policy) MUST import and render them
- Before importing @/components/SomeName, make sure you have ALREADY called write_file to create that exact file
- If you reference a component, the filename must match EXACTLY (case-sensitive): Header.tsx for @/components/Header

### String Escaping in data.ts (CRITICAL — causes syntax errors):
- data.ts uses JavaScript strings — ALL apostrophes/single quotes MUST be escaped
- If using single-quoted strings: escape every apostrophe with backslash: 'What\\'s Trending'
- PREFERRED: Use double-quoted strings for any text containing apostrophes: "What's Trending"
- This applies to: taglines, descriptions, about text, testimonials, FAQ answers, blog content
- Company names with apostrophes: "Lenny's Pizza" NOT 'Lenny's Pizza'
- Test mentally: can JavaScript parse this string without error?

### File Writing:
- Write COMPLETE files — never partial content
- Include all imports at the top
- Include proper TypeScript types
- Use @/ path alias for imports
- DO NOT write package.json, tsconfig.json, postcss.config.mjs — these are already provided
- DO NOT write next.config.ts — already provided
- DO NOT write tailwind.config.ts — Tailwind v4 uses CSS config via globals.css (@theme block)
- DO NOT write ThemeProvider.tsx or ThemeToggle.tsx — already provided as templates
- DO NOT write Analytics.tsx or CookieConsent.tsx — already provided as templates
- You MUST write privacy-policy, cookie-policy, terms, not-found, and error pages — use the brand identity
- DO NOT write a Logo.tsx component — use the real brand logo image instead
- In layout.tsx, MUST import and render <Analytics /> and <CookieConsent /> components:
  import Analytics from '@/components/Analytics'
  import CookieConsent from '@/components/CookieConsent'
  Then add <Analytics /> and <CookieConsent /> inside the body
- footerLinks MUST include privacy-policy, cookie-policy, and terms pages
- Footer.tsx MUST render ALL footerLinks without slicing — never use .slice() to cut off links
- The real brand logo MUST be downloaded and used as <img> in Header AND Footer — never create a fake text/SVG logo`;

// --- Tool Execution ---

interface AgentContext {
  websiteId: string;
  websiteSlug: string;
  userId: string;
  questionnaire: SiteQuestionnaire;
  siteDir: string;
  onProgress?: (step: string, detail?: string) => void;
}

async function executeTool(name: string, input: Record<string, unknown>, ctx: AgentContext): Promise<string> {
  switch (name) {
    case "get_brand_identity": {
      ctx.onProgress?.("Reading brand identity...");
      const brandKit = await prisma.brandKit.findFirst({
        where: { userId: ctx.userId },
        orderBy: { isDefault: "desc" },
      });

      if (!brandKit) {
        return JSON.stringify({
          name: ctx.questionnaire.businessName,
          description: ctx.questionnaire.description,
          industry: ctx.questionnaire.industry,
          targetAudience: ctx.questionnaire.targetAudience,
          contentTone: ctx.questionnaire.contentTone,
          goals: ctx.questionnaire.goals,
          pages: ctx.questionnaire.pages,
          noBrandKit: true,
        });
      }

      return JSON.stringify({
        name: brandKit.name,
        tagline: brandKit.tagline,
        description: brandKit.description,
        industry: brandKit.industry,
        niche: brandKit.niche,
        targetAudience: brandKit.targetAudience,
        voiceTone: brandKit.voiceTone,
        personality: safeParseJSON(brandKit.personality),
        keywords: safeParseJSON(brandKit.keywords),
        products: safeParseJSON(brandKit.products),
        uniqueValue: brandKit.uniqueValue,
        colors: safeParseJSON(brandKit.colors),
        fonts: safeParseJSON(brandKit.fonts),
        logoUrl: brandKit.logo ? await getPresignedUrl(brandKit.logo) : null,
        logoInstructions: brandKit.logo
          ? "IMPORTANT: Download this logo using download_image with the logoUrl above, category 'brand' and filename 'logo'. Then use /images/brand/logo.png (or .jpg) in the Header — do NOT create an SVG Logo component. Also download it again as favicon with filename 'favicon'."
          : "No logo available — use the brand name as text in the header.",
        handles: safeParseJSON(brandKit.handles),
        guidelines: brandKit.guidelines,
        email: brandKit.email,
        phone: brandKit.phone,
        website: brandKit.website,
        address: brandKit.address,
        city: brandKit.city,
        state: brandKit.state,
        country: brandKit.country,
        // From questionnaire
        questionnaire: {
          goals: ctx.questionnaire.goals,
          pages: ctx.questionnaire.pages,
          stylePreference: ctx.questionnaire.stylePreference,
          contentTone: ctx.questionnaire.contentTone,
          features: ctx.questionnaire.features,
          existingContent: ctx.questionnaire.existingContent,
        },
        // Constants for the generated site
        websiteId: ctx.websiteId,
        siteBasePath: `/sites/${ctx.websiteSlug}`,
        apiBaseUrl: process.env.NEXT_PUBLIC_APP_URL || "https://flowsmartly.com",
        // Languages
        languages: ctx.questionnaire.languages || ["en"],
        isMultilingual: (ctx.questionnaire.languages?.length || 1) > 1,
      });
    }

    case "read_reference": {
      const component = input.component as string;
      ctx.onProgress?.("Reading reference...", component);
      const source = readReferenceComponent(component);
      if (!source) return JSON.stringify({ error: `Could not read reference: ${component}` });
      return source;
    }

    case "write_file": {
      const path = input.path as string;
      const content = input.content as string;
      ctx.onProgress?.("Writing file...", path);

      // Prevent overwriting template files
      const protectedFiles = ["package.json", "tsconfig.json", "postcss.config.mjs", "next.config.ts", "src/components/ThemeProvider.tsx", "src/components/ThemeToggle.tsx", "src/components/Logo.tsx"];
      if (protectedFiles.includes(path)) {
        return JSON.stringify({ skipped: true, reason: `${path} is a template file — already provided, do not overwrite` });
      }

      try {
        writeSiteFile(ctx.websiteId, path, content);
        return JSON.stringify({ success: true, path });
      } catch (err: any) {
        return JSON.stringify({ error: err.message });
      }
    }

    case "download_image": {
      const url = input.url as string;
      const category = input.category as string;
      const filename = input.filename as string;
      ctx.onProgress?.("Downloading image...", filename);

      try {
        const localPath = await downloadImageToDir(url, ctx.siteDir, category, filename);
        const fullPath = `/sites/${ctx.websiteSlug}${localPath}`;
        return JSON.stringify({ success: true, localPath: fullPath });
      } catch (err: any) {
        return JSON.stringify({ error: err.message, localPath: `/sites/${ctx.websiteSlug}/images/${category}/placeholder.jpg` });
      }
    }

    case "build_site": {
      ctx.onProgress?.("Building website...");
      const result = await buildSite(ctx.websiteId);
      if (result.success) {
        return JSON.stringify({ success: true, message: "Build succeeded" });
      }
      return JSON.stringify({ success: false, error: result.error?.substring(0, 3000) });
    }

    case "finish": {
      ctx.onProgress?.("Deploying website...");
      const deployResult = await deploySite(ctx.websiteId, ctx.websiteSlug);
      if (!deployResult.success) {
        return JSON.stringify({ error: deployResult.error });
      }

      // Update page count
      const pageCount = await prisma.websitePage.count({ where: { websiteId: ctx.websiteId } });
      await prisma.website.update({
        where: { id: ctx.websiteId },
        data: { pageCount, generatedPath: ctx.siteDir },
      });

      return JSON.stringify({ success: true, url: `/sites/${ctx.websiteSlug}`, summary: input.summary });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

// --- Agent Loop ---

export async function runWebsiteAgent(
  websiteId: string,
  websiteSlug: string,
  userId: string,
  questionnaire: SiteQuestionnaire,
  onProgress?: (progress: AgentProgress) => void
): Promise<{ success: boolean; error?: string }> {
  // Initialize site directory with template files
  const siteDir = initSiteDir(websiteId, websiteSlug);

  const ctx: AgentContext = {
    websiteId,
    websiteSlug,
    userId,
    questionnaire,
    siteDir,
    onProgress: (step, detail) => {
      onProgress?.({ step, detail, toolCalls, done: false });
    },
  };

  let toolCalls = 0;
  const maxIterations = 50; // Agent needs many iterations to write all files

  const userPrompt = buildUserPrompt(questionnaire);
  let messages: Anthropic.MessageParam[] = [{ role: "user", content: userPrompt }];

  try {
    await prisma.website.update({
      where: { id: websiteId },
      data: { buildStatus: "building", generatedPath: siteDir },
    });

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      console.log(`[Agent] Iteration ${iteration + 1}, messages: ${messages.length}, tools: ${toolCalls}`);

      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      });

      const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");

      if (toolUseBlocks.length === 0) {
        console.log("[Agent] No more tool calls, done");
        onProgress?.({ step: "Website ready!", toolCalls, done: true });
        return { success: true };
      }

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        toolCalls++;
        console.log(`[Agent] Tool #${toolCalls}: ${toolUse.name}${toolUse.name === "write_file" ? ` (${(toolUse.input as any).path})` : ""}`);

        try {
          const result = await executeTool(toolUse.name, toolUse.input as Record<string, unknown>, ctx);

          if (toolUse.name === "finish") {
            onProgress?.({ step: "Website deployed!", toolCalls, done: true });
            messages.push({ role: "assistant", content: response.content });
            messages.push({ role: "user", content: [{ type: "tool_result", tool_use_id: toolUse.id, content: result }] });
            return { success: true };
          }

          toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: result });
        } catch (err: any) {
          console.error(`[Agent] Tool ${toolUse.name} failed:`, err.message);
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify({ error: err.message }),
            is_error: true,
          });
        }
      }

      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });
    }

    console.warn("[Agent] Max iterations reached");
    onProgress?.({ step: "Website ready!", toolCalls, done: true });
    return { success: true };
  } catch (err: any) {
    console.error("[Agent] Fatal error:", err.message);
    await prisma.website.update({
      where: { id: websiteId },
      data: { buildStatus: "error", lastBuildError: err.message },
    });
    return { success: false, error: err.message };
  }
}

// --- Helpers ---

function buildUserPrompt(q: SiteQuestionnaire): string {
  const langs = q.languages && q.languages.length > 1
    ? `Languages: ${q.languages.join(", ")} — This is a MULTILINGUAL site. You MUST implement the language system described in the system prompt.`
    : q.languages?.[0] && q.languages[0] !== "en"
      ? `Language: ${q.languages[0]} — ALL content must be written in this language.`
      : "";

  return [
    `Build a complete, production-quality website for:`,
    ``,
    `Business: ${q.businessName}`,
    `Industry: ${q.industry}`,
    `Description: ${q.description}`,
    q.targetAudience && `Target Audience: ${q.targetAudience}`,
    `Goals: ${q.goals.join(", ")}`,
    `Pages needed: ${q.pages.join(", ")}`,
    `Style: ${q.stylePreference}`,
    `Tone: ${q.contentTone}`,
    `Features: ${q.features.join(", ")}`,
    langs,
    q.existingContent && `\nExisting content:\n${q.existingContent}`,
    ``,
    `Start by calling get_brand_identity, then read the reference components, then build the site step by step.`,
  ].filter(Boolean).join("\n");
}

function safeParseJSON(str: string | null): unknown {
  if (!str) return null;
  try { return JSON.parse(str); } catch { return str; }
}
