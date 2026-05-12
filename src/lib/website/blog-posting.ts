import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { prisma } from "@/lib/db/client";
import {
  buildSite,
  buildSiteV3,
  deploySite,
  deploySiteV3,
  getSiteDir,
} from "@/lib/website/site-builder";

export interface ActiveBlogWebsite {
  id: string;
  name: string;
  slug: string;
  status: string;
  buildStatus: string;
  generatedPath: string | null;
  generatorVersion: string;
  ssrStatus: string | null;
  siteData: string;
}

export interface BlogReadiness {
  ready: boolean;
  website: ActiveBlogWebsite | null;
  blockers: string[];
}

export interface AutomationBlogPostInput {
  userId: string;
  website: ActiveBlogWebsite;
  automationId?: string | null;
  strategyTaskId?: string | null;
  title: string;
  excerpt?: string | null;
  content: string;
  category?: string | null;
  image?: string | null;
  author?: string | null;
  source?: "AUTOMATION" | "MANUAL";
}

function safeJson(value: string | null | undefined, fallback: Record<string, unknown> = {}) {
  try {
    const parsed = JSON.parse(value || "");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, any> : fallback;
  } catch {
    return fallback;
  }
}

export function isBlogAutomationPlatform(platforms: string[]) {
  return platforms.some((platform) => platform.toLowerCase() === "blog");
}

export function taskLooksLikeBlogPost(task: { title?: string | null; description?: string | null }) {
  const text = `${task.title || ""} ${task.description || ""}`;
  return /\b(blog|article|blog post|website post|long-form|long form)\b/i.test(text);
}

function slugify(value: string) {
  const base = value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base || `post-${Date.now()}`;
}

function escapeDataString(value: string | null | undefined) {
  return (value || "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, "\\n");
}

function getSiteDirectory(website: Pick<ActiveBlogWebsite, "id" | "generatedPath">) {
  return website.generatedPath || getSiteDir(website.id);
}

function hasGeneratedBlogPage(website: Pick<ActiveBlogWebsite, "id" | "generatedPath">) {
  const siteDir = getSiteDirectory(website);
  return existsSync(join(siteDir, "src", "app", "blog", "page.tsx"));
}

export async function getBlogReadinessForUser(userId: string): Promise<BlogReadiness> {
  const websites = await prisma.website.findMany({
    where: { userId, deletedAt: null },
    orderBy: [
      { status: "desc" },
      { updatedAt: "desc" },
    ],
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      buildStatus: true,
      generatedPath: true,
      generatorVersion: true,
      ssrStatus: true,
      siteData: true,
    },
  });

  if (websites.length === 0) {
    return {
      ready: false,
      website: null,
      blockers: ["Create and publish a website with a Blog page before automating blog posts"],
    };
  }

  const published = websites.filter((website) => website.status === "PUBLISHED");
  if (published.length === 0) {
    return {
      ready: false,
      website: websites[0],
      blockers: ["Publish your website before automating blog posts"],
    };
  }

  const withBlog = published.find(hasGeneratedBlogPage);
  if (!withBlog) {
    return {
      ready: false,
      website: published[0],
      blockers: ["Add a Blog page to your website before automating blog posts"],
    };
  }

  if (withBlog.buildStatus === "building" || withBlog.buildStatus === "deploying") {
    return {
      ready: false,
      website: withBlog,
      blockers: ["Your website is currently rebuilding. Try the blog automation after it finishes"],
    };
  }

  return { ready: true, website: withBlog, blockers: [] };
}

async function makeUniqueSlug(websiteId: string, title: string, siteData: Record<string, any>) {
  const existingSlugs = new Set<string>(
    Array.isArray(siteData.blogPosts)
      ? siteData.blogPosts.map((post: any) => String(post.slug || post.id || "")).filter(Boolean)
      : []
  );
  const base = slugify(title);
  let candidate = base;
  let index = 2;

  while (
    existingSlugs.has(candidate) ||
    await prisma.websiteBlogPost.findFirst({ where: { websiteId, slug: candidate }, select: { id: true } })
  ) {
    candidate = `${base}-${index}`;
    index += 1;
  }

  return candidate;
}

function formatDataBlogPosts(posts: Array<Record<string, any>>) {
  return `export const blogPosts = [\n${posts.map((post) => `  {
    id: '${escapeDataString(post.id)}',
    slug: '${escapeDataString(post.slug || post.id)}',
    title: '${escapeDataString(post.title)}',
    excerpt: '${escapeDataString(post.excerpt)}',
    content: '${escapeDataString(post.content)}',
    category: '${escapeDataString(post.category)}',
    date: '${escapeDataString(post.date)}',
    author: '${escapeDataString(post.author)}',
    image: '${escapeDataString(post.image)}',
    source: '${escapeDataString(post.source)}',
    automationId: '${escapeDataString(post.automationId)}',
  }`).join(",\n")}\n]`;
}

function syncBlogPostsToGeneratedData(website: ActiveBlogWebsite, blogPosts: Array<Record<string, any>>) {
  const dataPath = join(getSiteDirectory(website), "src", "lib", "data.ts");
  if (!existsSync(dataPath)) return;

  let content = readFileSync(dataPath, "utf-8");
  const replacement = formatDataBlogPosts(blogPosts);
  if (/export const blogPosts\s*=\s*\[[\s\S]*?\n\]/.test(content)) {
    content = content.replace(/export const blogPosts\s*=\s*\[[\s\S]*?\n\]/, replacement);
  } else {
    content = `${content.trim()}\n\n${replacement}\n`;
  }
  writeFileSync(dataPath, content, "utf-8");
}

export async function enqueueWebsiteBlogRebuild(websiteId: string) {
  const website = await prisma.website.findUnique({
    where: { id: websiteId },
    select: {
      id: true,
      slug: true,
      buildStatus: true,
      generatorVersion: true,
    },
  });
  if (!website || website.buildStatus === "building" || website.buildStatus === "deploying") return;

  void (async () => {
    try {
      if (website.generatorVersion === "v3") {
        const build = await buildSiteV3(website.id);
        if (build.success) await deploySiteV3(website.id, website.slug);
      } else {
        const build = await buildSite(website.id);
        if (build.success) await deploySite(website.id, website.slug);
      }
    } catch (error) {
      console.error("[WebsiteBlog] Rebuild failed:", error);
    }
  })();
}

export async function publishAutomationBlogPost(input: AutomationBlogPostInput) {
  const siteData = safeJson(input.website.siteData);
  const existingPosts = Array.isArray(siteData.blogPosts) ? siteData.blogPosts : [];
  const slug = await makeUniqueSlug(input.website.id, input.title, siteData);
  const now = new Date();

  const saved = await prisma.websiteBlogPost.create({
    data: {
      websiteId: input.website.id,
      userId: input.userId,
      automationId: input.automationId || null,
      strategyTaskId: input.strategyTaskId || null,
      title: input.title,
      slug,
      excerpt: input.excerpt || null,
      content: input.content,
      category: input.category || "Blog",
      image: input.image || null,
      author: input.author || null,
      status: "PUBLISHED",
      source: input.source || "AUTOMATION",
      publishedAt: now,
    },
  });

  const postForSite = {
    id: saved.id,
    slug: saved.slug,
    title: saved.title,
    excerpt: saved.excerpt || "",
    content: saved.content,
    category: saved.category || "Blog",
    date: now.toISOString().slice(0, 10),
    author: saved.author || "FlowSmartly",
    image: saved.image || "",
    source: saved.source,
    automationId: saved.automationId || "",
    strategyTaskId: saved.strategyTaskId || "",
  };
  const nextPosts = [postForSite, ...existingPosts.filter((post: any) => post.id !== saved.id)];
  const nextSiteData = { ...siteData, blogPosts: nextPosts };

  await prisma.website.update({
    where: { id: input.website.id },
    data: { siteData: JSON.stringify(nextSiteData) },
  });

  syncBlogPostsToGeneratedData(input.website, nextPosts);
  await enqueueWebsiteBlogRebuild(input.website.id);

  return saved;
}
