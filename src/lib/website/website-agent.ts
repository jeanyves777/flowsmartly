/**
 * Website Builder Agent — Claude autonomously builds sites using tools
 *
 * Agent loop pattern: Claude gets tools, calls them step by step to:
 * 1. Fetch brand identity
 * 2. Set theme with brand colors
 * 3. Search & download stock images from Pexels
 * 4. Create pages with personalized content + real images
 * 5. Set navigation
 * 6. Finish
 */

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db/client";
import { searchPexels, downloadToMediaLibrary } from "./image-search";
import { DEFAULT_THEME } from "./theme-resolver";
import type { SiteQuestionnaire, WebsiteTheme, WebsiteNavigation } from "@/types/website-builder";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// --- Tool Definitions (JSON Schema for Claude) ---

const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_brand_identity",
    description: "Retrieve the user's complete brand identity including business name, description, industry, colors, fonts, logo, products, voice tone, target audience, and guidelines. Call this FIRST to understand the business before building anything.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "search_stock_images",
    description: "Search Pexels for stock photos matching a query. Returns up to 6 image results with preview URLs. Use descriptive queries related to the business and section context.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query for images (e.g. 'modern office team meeting', 'restaurant food plating')" },
        count: { type: "number", description: "Number of images to return (1-6)", default: 3 },
        orientation: { type: "string", enum: ["landscape", "portrait"], description: "Image orientation preference" },
      },
      required: ["query"],
    },
  },
  {
    name: "download_image",
    description: "Download a stock image and save it to the user's media library. Returns the permanent S3 URL to use in website blocks. Call this for each image you want to include in the website.",
    input_schema: {
      type: "object" as const,
      properties: {
        imageUrl: { type: "string", description: "The download URL of the image from search results" },
        filename: { type: "string", description: "A descriptive filename (e.g. 'hero-team-photo', 'service-consulting')" },
        alt: { type: "string", description: "Alt text description for the image" },
      },
      required: ["imageUrl", "filename"],
    },
  },
  {
    name: "set_website_theme",
    description: "Set the website's visual theme including colors, fonts, border radius, spacing, and button style. Use the brand's colors. Include dark mode colors for automatic dark/light mode support.",
    input_schema: {
      type: "object" as const,
      properties: {
        theme: {
          type: "object",
          description: "Complete theme object",
          properties: {
            colors: {
              type: "object",
              properties: {
                primary: { type: "string", description: "Primary brand color (hex)" },
                secondary: { type: "string", description: "Secondary color (hex)" },
                accent: { type: "string", description: "Accent/highlight color (hex)" },
                background: { type: "string", description: "Page background color (hex)" },
                surface: { type: "string", description: "Card/section surface color (hex)" },
                text: { type: "string", description: "Main text color (hex)" },
                textMuted: { type: "string", description: "Muted/secondary text color (hex)" },
                border: { type: "string", description: "Border color (hex)" },
              },
            },
            fonts: {
              type: "object",
              properties: {
                heading: { type: "string", description: "Heading font family (Google Font name)" },
                body: { type: "string", description: "Body font family (Google Font name)" },
              },
            },
            borderRadius: { type: "number", description: "Default border radius in px (e.g. 8, 12, 16)" },
            spacing: { type: "string", enum: ["compact", "normal", "relaxed"] },
            maxWidth: { type: "string", enum: ["md", "lg", "xl"] },
            buttonStyle: { type: "string", enum: ["rounded", "pill", "square"] },
          },
        },
        darkColors: {
          type: "object",
          description: "Dark mode color overrides",
          properties: {
            background: { type: "string" },
            surface: { type: "string" },
            text: { type: "string" },
            textMuted: { type: "string" },
            border: { type: "string" },
          },
        },
      },
      required: ["theme"],
    },
  },
  {
    name: "create_page",
    description: "Create a website page with blocks. Each block has a type, variant, content, style overrides, and animation settings. Use downloaded image S3 URLs for imageUrl fields. Apply brand colors in style overrides: gradient heroes, colored CTA backgrounds, tinted section backgrounds. Make ALL text content specific to THIS business.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Page title (e.g. 'Home', 'About Us', 'Services')" },
        slug: { type: "string", description: "URL slug (empty string for home page, e.g. 'about', 'services')" },
        isHomePage: { type: "boolean", description: "Whether this is the home page" },
        blocks: {
          type: "array",
          description: "Array of content blocks for this page",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["hero", "features", "pricing", "testimonials", "gallery", "contact", "text", "team", "faq", "stats", "cta", "blog", "portfolio", "logo-cloud", "video", "divider", "spacer", "image"] },
              variant: { type: "string", description: "Visual variant (e.g. 'centered', 'split-left', 'grid-icons')" },
              content: { type: "object", description: "Block-specific content (headlines, items, CTAs, imageUrls, etc.)" },
              style: {
                type: "object",
                description: "Visual overrides: bgColor, bgGradient, textColor, padding {top,bottom,left,right}, shadow, borderRadius",
              },
              animation: {
                type: "object",
                description: "Animation settings: entrance (fade-in, slide-up, zoom-in, none), entranceDuration, entranceDelay",
              },
            },
            required: ["type", "content"],
          },
        },
      },
      required: ["title", "slug", "isHomePage", "blocks"],
    },
  },
  {
    name: "set_navigation",
    description: "Set the website's header and footer navigation. Include the brand logo, nav links matching the created pages, CTA button, and footer with social links and columns.",
    input_schema: {
      type: "object" as const,
      properties: {
        header: {
          type: "object",
          properties: {
            logo: { type: "string", description: "Logo URL (use brand logo if available)" },
            logoText: { type: "string", description: "Text logo fallback (brand name)" },
            logoPosition: { type: "string", enum: ["left", "center"] },
            items: { type: "array", items: { type: "object", properties: { label: { type: "string" }, href: { type: "string" } } } },
            cta: { type: "object", properties: { text: { type: "string" }, href: { type: "string" }, style: { type: "string" } } },
            sticky: { type: "boolean" },
            transparent: { type: "boolean" },
            style: { type: "string", enum: ["solid", "transparent", "glass"] },
          },
        },
        footer: {
          type: "object",
          properties: {
            logo: { type: "string" },
            description: { type: "string" },
            columns: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  links: { type: "array", items: { type: "object", properties: { label: { type: "string" }, href: { type: "string" } } } },
                },
              },
            },
            copyright: { type: "string" },
            socials: { type: "array", items: { type: "object", properties: { platform: { type: "string" }, url: { type: "string" } } } },
          },
        },
      },
      required: ["header", "footer"],
    },
  },
  {
    name: "finish_website",
    description: "Call this when you have finished creating all pages, setting the theme and navigation. This finalizes the website.",
    input_schema: {
      type: "object" as const,
      properties: {
        summary: { type: "string", description: "Brief summary of what was created" },
      },
      required: ["summary"],
    },
  },
];

// --- System Prompt ---

const SYSTEM_PROMPT = `You are a professional website builder agent. You build complete, beautiful websites by calling tools step by step.

## Your Process:
1. FIRST: Call get_brand_identity to learn everything about the business
2. THEN: Call set_website_theme with colors derived from the brand (or choose perfect colors for the industry)
3. THEN: For each page the user wants, search for relevant stock images and download them
4. THEN: Create each page with create_page, using the downloaded image URLs and personalized content
5. THEN: Set navigation with set_navigation (matching all created pages)
6. FINALLY: Call finish_website

## CRITICAL RULES:

### Content Personalization (MOST IMPORTANT):
- EVERY piece of text must be written specifically for THIS business. NEVER use generic text.
- Headlines must mention the business name or its core value proposition
- Feature descriptions must describe THIS business's actual services/products
- Testimonials must reference the specific industry and services
- Stats/numbers must be realistic for the industry
- CTA text must be specific: "Book a Consultation", "Order Now", "Get a Free Quote" — not just "Get Started"
- FAQ answers must address real questions about THIS business
- The about/text sections must tell THIS company's story

### Visual Design Quality:
- Hero section: ALWAYS use a gradient background (bgGradient) with the brand's primary→secondary colors, white text
- Hero padding: at least 96px top and bottom
- Alternate section backgrounds: white → surface → primary at 5% opacity → white
- CTA blocks: gradient background (primary→secondary) with white text
- Feature cards: add shadow "0 1px 3px rgba(0,0,0,0.1)" and rounded corners
- Stats numbers: should appear in the primary color
- Generous section padding: 80px top/bottom minimum
- Use the brand fonts for a unique look

### Images:
- Search for images relevant to each section's content
- For hero: search for images matching the industry/business
- For team: search "professional headshot" or "business team"
- For features: search images matching each feature/service
- For testimonials: search "professional portrait"
- Download each image you want to use, then use the S3 URL in the block content

### Animations:
- Hero: entrance "fade-in" with duration 800ms
- Features: entrance "slide-up" with staggered delays (0, 100, 200ms)
- Stats: entrance "zoom-in"
- CTA: entrance "fade-in"
- Other sections: "fade-in" or "slide-up" with delay
- Keep most sections "none" — don't over-animate

### Block Counts:
- Home page: 5-8 blocks (hero, features/services, stats, testimonials, CTA minimum)
- About page: 3-5 blocks (text intro, team, stats)
- Services page: 4-6 blocks (hero, feature list, pricing, CTA)
- Contact page: 2-3 blocks (contact form, map/info)
- Other pages: 3-5 blocks each`;

// --- Tool Execution ---

interface AgentContext {
  websiteId: string;
  userId: string;
  questionnaire: SiteQuestionnaire;
  onProgress?: (step: string, detail?: string) => void;
}

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: AgentContext
): Promise<string> {
  switch (name) {
    case "get_brand_identity": {
      ctx.onProgress?.("Analyzing your brand identity...");
      const brandKit = await prisma.brandKit.findFirst({
        where: { userId: ctx.userId },
        orderBy: { isDefault: "desc" },
      });

      if (!brandKit) {
        // Return questionnaire data as fallback
        return JSON.stringify({
          name: ctx.questionnaire.businessName,
          description: ctx.questionnaire.description,
          industry: ctx.questionnaire.industry,
          targetAudience: ctx.questionnaire.targetAudience,
          contentTone: ctx.questionnaire.contentTone,
          noExistingBrandKit: true,
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
        personality: JSON.parse(brandKit.personality || "[]"),
        keywords: JSON.parse(brandKit.keywords || "[]"),
        products: JSON.parse(brandKit.products || "[]"),
        uniqueValue: brandKit.uniqueValue,
        colors: JSON.parse(brandKit.colors || "{}"),
        fonts: JSON.parse(brandKit.fonts || "{}"),
        logo: brandKit.logo,
        handles: JSON.parse(brandKit.handles || "{}"),
        guidelines: brandKit.guidelines,
        email: brandKit.email,
        phone: brandKit.phone,
        website: brandKit.website,
        address: brandKit.address,
        city: brandKit.city,
        state: brandKit.state,
        country: brandKit.country,
      });
    }

    case "search_stock_images": {
      const query = input.query as string;
      const count = (input.count as number) || 3;
      const orientation = input.orientation as "landscape" | "portrait" | undefined;
      ctx.onProgress?.("Searching images...", query);

      const results = await searchPexels(query, count, orientation);
      return JSON.stringify(results.map((r) => ({
        downloadUrl: r.downloadUrl,
        thumbnailUrl: r.thumbnailUrl,
        photographer: r.photographer,
        alt: r.alt,
      })));
    }

    case "download_image": {
      const imageUrl = input.imageUrl as string;
      const filename = input.filename as string;
      const alt = input.alt as string | undefined;
      ctx.onProgress?.("Downloading image...", filename);

      const s3Url = await downloadToMediaLibrary(imageUrl, ctx.userId, filename, alt);
      if (!s3Url) return JSON.stringify({ error: "Failed to download image", fallback: "" });
      return JSON.stringify({ s3Url });
    }

    case "set_website_theme": {
      const theme = input.theme as Record<string, unknown>;
      const darkColors = input.darkColors as Record<string, unknown> | undefined;
      ctx.onProgress?.("Applying brand theme...");

      const mergedTheme = {
        ...DEFAULT_THEME,
        ...theme,
        colors: { ...DEFAULT_THEME.colors, ...(theme.colors as Record<string, unknown> || {}) },
        fonts: { ...DEFAULT_THEME.fonts, ...(theme.fonts as Record<string, unknown> || {}) },
        ...(darkColors && { darkColors }),
      };

      await prisma.website.update({
        where: { id: ctx.websiteId },
        data: { theme: JSON.stringify(mergedTheme) },
      });

      return JSON.stringify({ success: true, theme: mergedTheme });
    }

    case "create_page": {
      const title = input.title as string;
      const slug = input.slug as string;
      const isHomePage = input.isHomePage as boolean;
      const blocks = input.blocks as Array<Record<string, unknown>>;
      ctx.onProgress?.("Creating page...", title);

      // Sanitize blocks: ensure IDs, required fields
      const sanitizedBlocks = (blocks || []).map((block, i) => ({
        id: Math.random().toString(36).substring(2, 10),
        type: block.type || "text",
        variant: block.variant || "default",
        content: block.content || {},
        style: block.style || {},
        animation: block.animation || { entrance: "none", scroll: "none", hover: "none" },
        responsive: {},
        visibility: { enabled: true },
        sortOrder: i,
      }));

      // Delete existing page with same slug if exists
      await prisma.websitePage.deleteMany({
        where: { websiteId: ctx.websiteId, slug },
      });

      const page = await prisma.websitePage.create({
        data: {
          websiteId: ctx.websiteId,
          title,
          slug,
          isHomePage,
          sortOrder: isHomePage ? 0 : 99,
          blocks: JSON.stringify(sanitizedBlocks),
          status: "DRAFT",
        },
      });

      return JSON.stringify({ success: true, pageId: page.id, blockCount: sanitizedBlocks.length });
    }

    case "set_navigation": {
      ctx.onProgress?.("Setting up navigation...");
      const nav = { header: input.header, footer: input.footer };

      await prisma.website.update({
        where: { id: ctx.websiteId },
        data: { navigation: JSON.stringify(nav) },
      });

      return JSON.stringify({ success: true });
    }

    case "finish_website": {
      ctx.onProgress?.("Finalizing website...", input.summary as string);

      // Update page count
      const pageCount = await prisma.websitePage.count({ where: { websiteId: ctx.websiteId } });

      // Fix sort orders
      const pages = await prisma.websitePage.findMany({
        where: { websiteId: ctx.websiteId },
        orderBy: [{ isHomePage: "desc" }, { sortOrder: "asc" }],
      });
      for (let i = 0; i < pages.length; i++) {
        await prisma.websitePage.update({
          where: { id: pages[i].id },
          data: { sortOrder: i },
        });
      }

      await prisma.website.update({
        where: { id: ctx.websiteId },
        data: { pageCount },
      });

      return JSON.stringify({ success: true, pageCount, summary: input.summary });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

// --- Agent Loop ---

export interface AgentProgress {
  step: string;
  detail?: string;
  toolCalls: number;
  done: boolean;
}

export async function runWebsiteAgent(
  websiteId: string,
  userId: string,
  questionnaire: SiteQuestionnaire,
  onProgress?: (progress: AgentProgress) => void
): Promise<{ success: boolean; error?: string }> {
  const ctx: AgentContext = {
    websiteId,
    userId,
    questionnaire,
    onProgress: (step, detail) => {
      onProgress?.({ step, detail, toolCalls, done: false });
    },
  };

  let toolCalls = 0;
  const maxIterations = 30; // Safety limit

  // Build the user prompt from questionnaire
  const userPrompt = buildUserPrompt(questionnaire);

  // Start the conversation
  let messages: Anthropic.MessageParam[] = [
    { role: "user", content: userPrompt },
  ];

  try {
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      console.log(`[WebsiteAgent] Iteration ${iteration + 1}, sending ${messages.length} messages`);

      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      });

      // Process response content
      const assistantContent = response.content;
      const toolUseBlocks = assistantContent.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      const textBlocks = assistantContent.filter((b): b is Anthropic.TextBlock => b.type === "text");

      // If no tool calls, Claude is done
      if (toolUseBlocks.length === 0) {
        console.log("[WebsiteAgent] No more tool calls, agent finished");
        onProgress?.({ step: "Website ready!", toolCalls, done: true });
        return { success: true };
      }

      // Execute all tool calls
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        toolCalls++;
        console.log(`[WebsiteAgent] Tool call #${toolCalls}: ${toolUse.name}`);

        try {
          const result = await executeTool(toolUse.name, toolUse.input as Record<string, unknown>, ctx);

          // Check if finish_website was called
          if (toolUse.name === "finish_website") {
            onProgress?.({ step: "Website ready!", toolCalls, done: true });

            // Still need to add to messages for proper completion
            messages.push({ role: "assistant", content: assistantContent });
            messages.push({
              role: "user",
              content: [{ type: "tool_result", tool_use_id: toolUse.id, content: result }],
            });

            return { success: true };
          }

          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: result,
          });
        } catch (err) {
          console.error(`[WebsiteAgent] Tool ${toolUse.name} failed:`, err);
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify({ error: `Tool failed: ${(err as Error).message}` }),
            is_error: true,
          });
        }
      }

      // Add assistant response and tool results to conversation
      messages.push({ role: "assistant", content: assistantContent });
      messages.push({ role: "user", content: toolResults });
    }

    console.warn("[WebsiteAgent] Reached max iterations");
    onProgress?.({ step: "Website ready!", toolCalls, done: true });
    return { success: true };
  } catch (err) {
    console.error("[WebsiteAgent] Agent failed:", err);
    return { success: false, error: (err as Error).message };
  }
}

// --- Build User Prompt ---

function buildUserPrompt(q: SiteQuestionnaire): string {
  const parts: string[] = [
    `Build a professional website for this business:`,
    ``,
    `Business Name: ${q.businessName}`,
    `Industry: ${q.industry}`,
    `Description: ${q.description}`,
  ];

  if (q.targetAudience) parts.push(`Target Audience: ${q.targetAudience}`);
  parts.push(`Goals: ${q.goals.join(", ")}`);
  parts.push(`Pages to create: ${q.pages.join(", ")}`);
  parts.push(`Visual Style: ${q.stylePreference}`);
  parts.push(`Content Tone: ${q.contentTone}`);
  parts.push(`Features: ${q.features.join(", ")}`);
  if (q.existingContent) parts.push(`\nExisting Content:\n${q.existingContent}`);

  parts.push(`\nStart by calling get_brand_identity, then build the complete website step by step.`);

  return parts.join("\n");
}
