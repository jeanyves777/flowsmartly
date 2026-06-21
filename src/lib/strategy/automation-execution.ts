import { geminiText } from "@/lib/ai/gemini-text-client";
import { currentDateContext } from "@/lib/ai/date-context";
import { getUserPreferredLanguage, languageDirective } from "@/lib/ai/user-language";

type Jsonish = string | null | undefined;

export interface AutomationExecutionBrand {
  userId?: string | null;
  name?: string | null;
  tagline?: string | null;
  description?: string | null;
  industry?: string | null;
  niche?: string | null;
  targetAudience?: string | null;
  voiceTone?: string | null;
  uniqueValue?: string | null;
  keywords?: Jsonish;
  products?: Jsonish;
  hashtags?: Jsonish;
  personality?: Jsonish;
  handles?: Jsonish;
  guidelines?: string | null;
  logo?: string | null;
  iconLogo?: string | null;
}

export interface AutomationExecutionTask {
  title?: string | null;
  description?: string | null;
  category?: string | null;
  dueDate?: Date | string | null;
  startDate?: Date | string | null;
}

export interface AutomationExecutionInput {
  topic?: string | null;
  aiPrompt?: string | null;
  aiTone?: string | null;
  platforms?: string[];
  includeMedia?: boolean;
  mediaType?: string | null;
  mediaStyle?: string | null;
  brand?: AutomationExecutionBrand | null;
  task?: AutomationExecutionTask | null;
}

export interface AutomationGeneratedAsset {
  caption: string;
  hashtags: string[];
  mentions: string[];
  mediaPrompt: string | null;
  qualityNotes: string[];
}

export interface AutomationGeneratedBlogPost {
  title: string;
  excerpt: string;
  content: string;
  category: string;
  imagePrompt: string | null;
  socialCaption: string;
  qualityNotes: string[];
}

interface GeneratedAssetJSON {
  caption?: string;
  hashtags?: string[];
  mentions?: string[];
  mediaPrompt?: string | null;
}

interface GeneratedBlogPostJSON {
  title?: string;
  excerpt?: string;
  content?: string;
  category?: string;
  imagePrompt?: string | null;
  socialCaption?: string;
}

const META_OUTPUT_PATTERNS = [
  /^\s*(here(?:'|\u2019)s|here are)\s+(?:a|an|\d+)\s+.+\b(?:plan|framework|ideas?|posts?|recommendations?|calendar)\b/i,
  /^\s*okay,\s*let(?:'|\u2019)s\s+(?:define|outline|plan|start)\b/i,
  /^\s*#+\s+/m,
  /\b(?:content plan|content pillar framework|framework outlines|campaign details first|platform-ready social media posts|post ideas?|recommendations?|strategy document)\b/i,
  /\b(?:this plan|the plan below|below is a plan|outline below)\b/i,
];

const PROMPT_LEAK_PATTERNS = [
  /\b(?:destination|audience|angle|cta|saved prompt|platforms?|media requested)\s*:/i,
  /\b(?:schedule|create|write|generate|draft|publish|repurpose|mirror(?:ed)?)\b.{0,90}\b(?:posts?|captions?|content calendar|instagram|facebook|linkedin|twitter|social)\b/i,
  /\b(?:same \d+\s+.+topics|stronger hook in the first line|first line|call to action)\b/i,
];

function parseStringArray(value: Jsonish): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    }
    if (parsed && typeof parsed === "object") {
      return Object.values(parsed).filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    }
  } catch {
    // Some older records store a plain string instead of JSON.
  }
  return value.trim() ? [value.trim()] : [];
}

function parseHandles(value: Jsonish): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return Object.entries(parsed)
        .filter(([, handle]) => typeof handle === "string" && handle.trim())
        .map(([platform, handle]) => `${platform}: ${String(handle).trim()}`);
    }
  } catch {
    // ignore
  }
  return [];
}

function asDateText(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function cleanCaption(value: string | null | undefined) {
  return (value || "")
    .replace(/```(?:json|text)?/gi, "")
    .replace(/```/g, "")
    .replace(/^\s*(caption|post|final caption|social post)\s*:\s*/i, "")
    .trim();
}

export function isMetaPlanningOutput(value: string | null | undefined) {
  const text = cleanCaption(value);
  if (!text) return true;
  if (META_OUTPUT_PATTERNS.some((pattern) => pattern.test(text))) return true;
  if (PROMPT_LEAK_PATTERNS.some((pattern) => pattern.test(text))) return true;

  const numberedIdeaLines = text
    .split(/\r?\n/)
    .filter((line) => /^\s*\d+[\).]\s+/.test(line)).length;
  return numberedIdeaLines >= 3;
}

function extractPublicTopic(value: string | null | undefined) {
  const source = cleanCaption(value);
  if (!source) return "";

  const quoted = source.match(/["']([^"']{4,90})["']/);
  if (quoted?.[1]) return quoted[1].trim();

  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^(destination|audience|angle|cta|platform|prompt)\s*:/i.test(line))
    .join(" ")
    .replace(/\b(?:schedule|create|write|generate|draft|publish|repurpose|mirror(?:ed)?)\b/gi, "")
    .replace(/\b(?:weekly|daily|monthly|instagram|facebook|linkedin|twitter|social media|posts?|captions?|content calendar)\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s:;,.|-]+|[\s:;,.|-]+$/g, "")
    .slice(0, 90)
    .trim();
}

function normalizeHashtag(tag: string) {
  const cleaned = tag.trim().replace(/[^\w#]/g, "");
  if (!cleaned) return null;
  return cleaned.startsWith("#") ? cleaned : `#${cleaned}`;
}

function uniqueStrings(values: Array<string | null | undefined>, limit: number) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
    if (result.length >= limit) break;
  }
  return result;
}

function formatBrandContext(brand?: AutomationExecutionBrand | null) {
  if (!brand) return "No saved brand kit was found. Use the automation brief only.";

  const keywords = parseStringArray(brand.keywords);
  const products = parseStringArray(brand.products);
  const hashtags = parseStringArray(brand.hashtags).map(normalizeHashtag).filter(Boolean);
  const personality = parseStringArray(brand.personality);
  const handles = parseHandles(brand.handles);

  return [
    brand.name ? `Brand name: ${brand.name}` : null,
    brand.tagline ? `Tagline: ${brand.tagline}` : null,
    brand.description ? `Description: ${brand.description}` : null,
    brand.industry ? `Industry: ${brand.industry}` : null,
    brand.niche ? `Niche: ${brand.niche}` : null,
    brand.targetAudience ? `Target audience: ${brand.targetAudience}` : null,
    brand.voiceTone ? `Voice/tone: ${brand.voiceTone}` : null,
    brand.uniqueValue ? `Unique value: ${brand.uniqueValue}` : null,
    products.length ? `Products/services: ${products.join(", ")}` : null,
    keywords.length ? `Keywords: ${keywords.join(", ")}` : null,
    hashtags.length ? `Preferred hashtags: ${hashtags.join(" ")}` : null,
    personality.length ? `Personality: ${personality.join(", ")}` : null,
    handles.length ? `Social handles: ${handles.join(", ")}` : null,
    brand.guidelines ? `Brand guidelines: ${brand.guidelines}` : null,
  ].filter(Boolean).join("\n") || "Brand kit is mostly empty.";
}

function formatTaskContext(task?: AutomationExecutionTask | null) {
  if (!task) return "No linked strategy item.";
  return [
    task.title ? `Task title: ${task.title}` : null,
    task.description ? `Task brief: ${task.description}` : null,
    task.category ? `Task category: ${task.category}` : null,
    asDateText(task.startDate) ? `Start date: ${asDateText(task.startDate)}` : null,
    asDateText(task.dueDate) ? `Due date: ${asDateText(task.dueDate)}` : null,
  ].filter(Boolean).join("\n") || "Linked strategy item has no details.";
}

export function buildStrategyAutomationPrompt(input: {
  taskTitle: string;
  taskDescription?: string | null;
  category?: string | null;
  platforms?: string[];
  brandContext?: string;
  customPrompt?: string;
  includeMedia?: boolean;
  mediaType?: string;
  mediaStyle?: string;
}) {
  const platforms = input.platforms?.length ? input.platforms.join(", ") : "connected publishing channels";
  const mediaLine = input.includeMedia
    ? `Media required: ${input.mediaType || "image"}${input.mediaStyle ? `, style: ${input.mediaStyle}` : ""}.`
    : "Media required: no, unless the execution run explicitly enables media.";

  return [
    "AUTOMATION EXECUTION BRIEF",
    `Create one final publish-ready ${input.category === "email" ? "email" : "social post"} every time this automation runs.`,
    `Primary task: ${input.taskTitle}`,
    input.taskDescription ? `Task details: ${input.taskDescription}` : null,
    input.customPrompt ? `User direction: ${input.customPrompt}` : null,
    `Publish destinations: ${platforms}.`,
    mediaLine,
    input.brandContext ? `Brand context:\n${input.brandContext}` : null,
    "Execution rule: write the customer-facing asset itself. Do not output a strategy, outline, plan, framework, recommendation list, options, or questions.",
  ].filter(Boolean).join("\n");
}

function buildFallbackCaption(input: AutomationExecutionInput) {
  const brandName = input.brand?.name?.trim();
  const topic =
    extractPublicTopic(input.task?.title) ||
    extractPublicTopic(input.topic) ||
    extractPublicTopic(input.task?.description) ||
    "a helpful update";
  const audience = input.brand?.targetAudience?.trim();
  const cta =
    input.platforms?.includes("linkedin")
      ? "Connect with us to learn more."
      : "Message us today to learn more.";
  const preferred = parseStringArray(input.brand?.hashtags).map(normalizeHashtag).filter(Boolean);
  const hashtags = uniqueStrings(preferred, 4);
  return cleanCaption(
    [
      brandName
        ? `${brandName} is sharing a practical reminder about ${topic}.`
        : `A practical reminder about ${topic}.`,
      audience
        ? `For ${audience}, small timely steps can make the next decision easier.`
        : "Small timely steps can make the next decision easier.",
      cta,
      hashtags.length ? hashtags.join(" ") : null,
    ].filter(Boolean).join("\n\n")
  );
}

function buildMediaPrompt(input: AutomationExecutionInput, caption: string, generatedPrompt?: string | null) {
  if (!input.includeMedia) return null;
  const prompt = generatedPrompt?.trim() || `Create a professional social media ${input.mediaType || "image"} that supports this caption: ${caption.slice(0, 280)}`;
  const style = input.mediaStyle ? ` Style direction: ${input.mediaStyle}.` : "";
  return `${prompt}${style} Do not invent, redraw, or fabricate brand logos. Do not draw a visible logo placeholder, blank logo box, dashed frame, white reserved rectangle, label, watermark, or logo-space indicator. Let the background and layout remain natural wherever a logo might later be overlaid. Do not invent real people's faces or create close resemblances unless exact source imagery is provided; use product, environment, symbolic, or design-led visuals instead.`;
}

export async function generateAutomationAsset(input: AutomationExecutionInput): Promise<AutomationGeneratedAsset> {
  const platforms = input.platforms?.length ? input.platforms : ["feed"];
  // Per feedback-ai-respects-user-language: lock output to the user's preferred language.
  const languageLine = input.brand?.userId
    ? `${languageDirective(await getUserPreferredLanguage(input.brand.userId))}\n\n`
    : "";
  const prompt = `You are the FlowSmartly Automation Hub. Turn this strategy automation into one executable marketing asset for the next scheduled run.

${languageLine}${currentDateContext()}

--- BRAND ---
${formatBrandContext(input.brand)}

--- LINKED STRATEGY ITEM ---
${formatTaskContext(input.task)}

--- AUTOMATION BRIEF ---
Topic: ${input.topic || input.task?.title || "Marketing update"}
Saved prompt: ${input.aiPrompt || "Create one engaging post for the linked strategy item."}
Tone: ${input.aiTone || input.brand?.voiceTone || "professional"}
Platforms: ${platforms.join(", ")}
Media requested: ${input.includeMedia ? `${input.mediaType || "image"}${input.mediaStyle ? `, ${input.mediaStyle}` : ""}` : "no"}

--- OUTPUT CONTRACT ---
Return one final customer-facing caption that can be stored directly in the Post table and published by the scheduler.
If the saved prompt asks for a plan, ideas, a framework, or multiple posts, choose the strongest next single post and write that post now.
Do not return planning notes, recommendations, an outline, a content calendar, a framework, a list of options, markdown headings, or questions.
Do not say "here is/are", "let's define", "this framework", or "content plan".
Include a concrete audience hook, brand-specific value, and clear call to action.
Use 2-6 hashtags when natural. Keep the caption concise and platform-ready.
For mediaPrompt, describe a usable creative direction. Do not fabricate logos or real-person faces, and do not ask for visible logo placeholders, blank boxes, dashed frames, or logo-space labels.

Return ONLY valid JSON:
{
  "caption": "exact caption text to publish",
  "hashtags": ["#tag"],
  "mentions": ["@handle"],
  "mediaPrompt": "image/video prompt or null"
}`;

  let asset = await geminiText.generateJSON<GeneratedAssetJSON>(prompt, {
    maxTokens: 1400,
    temperature: 0.35,
    systemPrompt:
      "You are a marketing automation execution agent. Return only valid JSON for one publishable asset. Never return strategies, notes, options, or plans.",
  });

  let caption = cleanCaption(asset?.caption);
  const qualityNotes: string[] = [];

  if (isMetaPlanningOutput(caption)) {
    qualityNotes.push("first_pass_meta_output_repaired");
    const repair = await geminiText.generateJSON<GeneratedAssetJSON>(
      `The previous automation output was rejected because it was planning/meta content instead of a publishable post.

Rejected output:
${caption || "(empty)"}

Rewrite it as exactly one final customer-facing social caption for this automation.
Brand:
${formatBrandContext(input.brand)}

Task:
${formatTaskContext(input.task)}

Automation prompt:
${input.aiPrompt || input.topic || ""}

Return ONLY JSON with caption, hashtags, mentions, and mediaPrompt. No markdown, no plan, no explanation.`,
      {
        maxTokens: 1200,
        temperature: 0.25,
        systemPrompt:
          "You repair automation outputs. Return one final publish-ready caption as JSON only.",
      }
    );
    caption = cleanCaption(repair?.caption);
    if (caption && !isMetaPlanningOutput(caption)) {
      asset = {
        ...(asset || {}),
        hashtags: repair?.hashtags || asset?.hashtags,
        mentions: repair?.mentions || asset?.mentions,
        mediaPrompt: repair?.mediaPrompt || asset?.mediaPrompt,
      };
    }
  }

  if (!caption || isMetaPlanningOutput(caption)) {
    qualityNotes.push("fallback_caption_used");
    caption = buildFallbackCaption(input);
  }

  const hashtagsFromCaption = caption.match(/#[\w]+/g) || [];
  const generatedHashtags = Array.isArray(asset?.hashtags)
    ? asset.hashtags.map(normalizeHashtag).filter(Boolean)
    : [];
  const hashtags = uniqueStrings([...hashtagsFromCaption, ...generatedHashtags], 8);
  const mentionsFromCaption = caption.match(/@[\w.]+/g) || [];
  const mentions = uniqueStrings(
    [...mentionsFromCaption, ...(Array.isArray(asset?.mentions) ? asset.mentions : [])],
    8
  );

  return {
    caption,
    hashtags,
    mentions,
    mediaPrompt: buildMediaPrompt(input, caption, asset?.mediaPrompt),
    qualityNotes,
  };
}

function cleanTitle(value: string | null | undefined, fallback: string) {
  return cleanCaption(value)
    .replace(/^["']|["']$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140) || fallback;
}

function cleanLongForm(value: string | null | undefined) {
  return (value || "")
    .replace(/```(?:markdown|md|text)?/gi, "")
    .replace(/```/g, "")
    .replace(/^\s*(blog post|article|content)\s*:\s*/i, "")
    .trim();
}

function fallbackBlogContent(input: AutomationExecutionInput) {
  const brandName = input.brand?.name?.trim() || "our team";
  const title = cleanTitle(input.task?.title || input.topic, `${brandName} update`);
  const detail = input.task?.description || input.aiPrompt || title;
  const content = [
    `${title}`,
    `${brandName} is sharing this update for the people we serve and the community around us.`,
    detail,
    "This article highlights the main idea, why it matters now, and how readers can take a practical next step. The goal is to make the message useful, clear, and easy to act on.",
    `To learn more, connect with ${brandName} or visit us for the latest updates.`,
  ].join("\n\n");

  return {
    title,
    excerpt: detail.replace(/\s+/g, " ").slice(0, 180),
    content,
    category: "Blog",
    imagePrompt: `Create a professional blog hero image for ${brandName}: ${title}. Use brand-relevant atmosphere. Do not draw a logo placeholder, blank logo box, dashed frame, label, or visible reserved logo area.`,
    socialCaption: `${brandName} published a new blog article: ${title}. Read the latest update on our website.`,
  };
}

export async function generateAutomationBlogPost(input: AutomationExecutionInput): Promise<AutomationGeneratedBlogPost> {
  const fallback = fallbackBlogContent(input);
  // Per feedback-ai-respects-user-language: lock output to the user's preferred language.
  const languageLine = input.brand?.userId
    ? `${languageDirective(await getUserPreferredLanguage(input.brand.userId))}\n\n`
    : "";
  const prompt = `You are the FlowSmartly website blog automation writer. Turn this strategy item into one complete blog article for the user's website blog.

${languageLine}${currentDateContext()}

--- BRAND ---
${formatBrandContext(input.brand)}

--- LINKED STRATEGY ITEM ---
${formatTaskContext(input.task)}

--- AUTOMATION BRIEF ---
Topic: ${input.topic || input.task?.title || "Website blog update"}
Saved prompt: ${input.aiPrompt || "Write one website blog post for the linked strategy item."}
Tone: ${input.aiTone || input.brand?.voiceTone || "professional"}

--- OUTPUT CONTRACT ---
Write the real blog article, not instructions, an outline, a draft note, a strategy, or a social caption only.
Personalize the article with the brand name, brand-specific value, audience, location/contact/service details when available in the brand context.
Use clear paragraphs. No markdown headings are required, but the content should read like a polished website blog post.
Do not include placeholder links like [Link to Blog Post Here].
For imagePrompt, describe a brand-relevant hero image. Do not request visible logo placeholders, blank logo boxes, dashed frames, labels, or reserved logo areas.

Return ONLY valid JSON:
{
  "title": "blog article title",
  "excerpt": "short teaser under 220 characters",
  "content": "complete blog article text",
  "category": "category",
  "imagePrompt": "hero image prompt or null",
  "socialCaption": "optional caption for sharing the article"
}`;

  const qualityNotes: string[] = [];

  try {
    const generated = await geminiText.generateJSON<GeneratedBlogPostJSON>(prompt, {
      maxTokens: 2600,
      temperature: 0.35,
      systemPrompt:
        "You write finished website blog articles for automation. Return only valid JSON and never return placeholders, instructions, or planning notes.",
    });

    const title = cleanTitle(generated?.title, fallback.title);
    const content = cleanLongForm(generated?.content);
    const excerpt = cleanCaption(generated?.excerpt).slice(0, 240) || fallback.excerpt;
    const looksPlaceholder =
      /\[(?:link|blog|insert|placeholder)[^\]]*\]/i.test(content) ||
      /\b(here is|outline|draft note|instructions?|plan below|content plan)\b/i.test(content.slice(0, 250));

    if (!content || content.length < 500 || looksPlaceholder) {
      qualityNotes.push("fallback_blog_content_used");
      return { ...fallback, qualityNotes };
    }

    return {
      title,
      excerpt,
      content,
      category: cleanTitle(generated?.category, "Blog").slice(0, 80),
      imagePrompt:
        typeof generated?.imagePrompt === "string" && generated.imagePrompt.trim()
          ? buildMediaPrompt(
              { ...input, includeMedia: true, mediaType: "image" },
              content,
              generated.imagePrompt
            )
          : fallback.imagePrompt,
      socialCaption: cleanCaption(generated?.socialCaption) || fallback.socialCaption,
      qualityNotes,
    };
  } catch (error) {
    qualityNotes.push("fallback_blog_content_used");
    console.warn("[AutomationExecution] Blog generation failed; using fallback:", error);
    return { ...fallback, qualityNotes };
  }
}
