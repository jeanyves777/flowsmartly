import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

type BlogRouteMode = "static" | "ssr";

const BLOG_TYPES = `type BlogPost = {
  id?: string;
  slug?: string;
  title?: string;
  excerpt?: string | null;
  content?: string | null;
  category?: string | null;
  date?: string | null;
  publishedAt?: string | null;
  author?: string | null;
  image?: string | null;
};

function normalizePost(post: BlogPost): BlogPost {
  return {
    ...post,
    slug: post.slug || post.id || "",
    excerpt: post.excerpt || (post.content || "").slice(0, 180),
    date: post.date || (post.publishedAt ? post.publishedAt.slice(0, 10) : ""),
    author: post.author || companyInfo?.name || "FlowSmartly",
    category: post.category || "Blog",
  };
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
`;

function loadPostsHelper(mode: BlogRouteMode) {
  if (mode === "static") {
    return `async function loadBlogPosts(): Promise<BlogPost[]> {
  return fallbackBlogPosts.map(normalizePost);
}
`;
  }

  return `async function loadBlogPosts(): Promise<BlogPost[]> {
  const websiteId = process.env.WEBSITE_ID;
  const apiBase = process.env.API_GATEWAY_URL || "https://flowsmartly.com";
  if (websiteId) {
    try {
      const res = await fetch(\`\${apiBase}/api/websites/\${websiteId}/blog-posts?public=1\`, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        const posts = Array.isArray(json.posts) ? json.posts : Array.isArray(json.data?.posts) ? json.data.posts : [];
        return posts.map(normalizePost);
      }
    } catch {}
  }
  return fallbackBlogPosts.map(normalizePost);
}
`;
}

function blogIndexPage(mode: BlogRouteMode) {
  const dynamicExports = mode === "ssr"
    ? `export const dynamic = "force-dynamic";\nexport const revalidate = 0;\n\n`
    : "";

  return `import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { blogPosts as fallbackBlogPosts, companyInfo } from "@/lib/data";
import { ArrowRight } from "lucide-react";

${dynamicExports}${BLOG_TYPES}
${loadPostsHelper(mode)}
export default async function BlogPage() {
  const posts = await loadBlogPosts();

  return (
    <>
      <Header />
      <main className="min-h-screen bg-white dark:bg-neutral-950">
        <section className="pt-28 pb-16 md:pt-36 md:pb-20 bg-neutral-950 text-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-sm uppercase tracking-[0.24em] text-white/60 mb-4">{companyInfo?.shortName || companyInfo?.name || "Blog"}</p>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Blog</h1>
            <p className="mt-5 max-w-2xl text-lg text-white/75">
              Updates, stories, and resources from {companyInfo?.name || "our team"}.
            </p>
          </div>
        </section>

        <section className="py-14 md:py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            {posts.length === 0 ? (
              <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-10 text-center">
                <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">No posts yet</h2>
                <p className="mt-2 text-neutral-600 dark:text-neutral-400">New articles will appear here when they are published.</p>
              </div>
            ) : (
              <div className="grid gap-7 md:grid-cols-2 lg:grid-cols-3">
                {posts.map((post) => (
                  <article key={post.slug || post.id || post.title} className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900">
                    {post.image ? (
                      <img src={post.image} alt={post.title || "Blog post"} className="h-52 w-full object-cover" />
                    ) : (
                      <div className="h-52 w-full bg-neutral-100 dark:bg-neutral-800" />
                    )}
                    <div className="p-6">
                      <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                        <span>{post.category}</span>
                        <span>{formatDate(post.date || post.publishedAt)}</span>
                      </div>
                      <h2 className="mt-4 text-xl font-semibold leading-snug text-neutral-950 dark:text-white">{post.title}</h2>
                      {post.excerpt ? <p className="mt-3 line-clamp-3 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{post.excerpt}</p> : null}
                      <div className="mt-6 flex items-center justify-between gap-4">
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">By {post.author}</span>
                        <Link href={\`/blog/\${post.slug || post.id}\`} className="inline-flex items-center gap-1 text-sm font-medium text-neutral-950 hover:gap-2 dark:text-white">
                          Read <ArrowRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
`;
}

function blogDetailPage(mode: BlogRouteMode) {
  const routeExports = mode === "ssr"
    ? `export const dynamic = "force-dynamic";\nexport const revalidate = 0;\n\n`
    : `export function generateStaticParams() {
  return fallbackBlogPosts.map((post: BlogPost) => ({ slug: post.slug || post.id })).filter((item) => item.slug);
}\n\n`;

  return `import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { blogPosts as fallbackBlogPosts, companyInfo } from "@/lib/data";
import { ArrowLeft } from "lucide-react";

${routeExports}${BLOG_TYPES.replace("month: \"short\"", "month: \"long\"")}
${loadPostsHelper(mode)}
export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const posts = await loadBlogPosts();
  const post = posts.find((item) => item.slug === slug || item.id === slug);
  if (!post) notFound();
  const paragraphs = (post.content || post.excerpt || "").split(/\\n{2,}/).map((line) => line.trim()).filter(Boolean);

  return (
    <>
      <Header />
      <main className="min-h-screen bg-white dark:bg-neutral-950">
        <article>
          <section className="pt-28 pb-10 md:pt-36 bg-neutral-950 text-white">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
              <Link href="/blog" className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white">
                <ArrowLeft className="h-4 w-4" /> Back to blog
              </Link>
              <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-white/60">
                <span>{post.category}</span>
                <span aria-hidden="true">/</span>
                <span>{formatDate(post.date || post.publishedAt)}</span>
              </div>
              <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight md:text-5xl">{post.title}</h1>
              {post.excerpt ? <p className="mt-5 text-lg leading-8 text-white/75">{post.excerpt}</p> : null}
              <p className="mt-5 text-sm text-white/60">By {post.author}</p>
            </div>
          </section>

          {post.image ? (
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-2 md:-mt-6">
              <img src={post.image} alt={post.title || "Blog post"} className="max-h-[520px] w-full rounded-lg object-cover shadow-xl" />
            </div>
          ) : null}

          <section className="py-12 md:py-16">
            <div className="prose prose-neutral mx-auto max-w-3xl px-4 dark:prose-invert sm:px-6 lg:px-8">
              {paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </section>
        </article>
      </main>
      <Footer />
    </>
  );
}
`;
}

export function ensureWebsiteBlogRoutes(siteDir: string, mode: BlogRouteMode = "ssr"): void {
  const appDir = join(siteDir, "src", "app");
  const dataPath = join(siteDir, "src", "lib", "data.ts");
  if (!existsSync(appDir) || !existsSync(dataPath)) return;

  const data = readFileSync(dataPath, "utf-8");
  if (!/export const blogPosts\s*=/.test(data)) return;

  const blogDir = join(appDir, "blog");
  const detailDir = join(blogDir, "[slug]");
  mkdirSync(detailDir, { recursive: true });
  writeFileSync(join(blogDir, "page.tsx"), blogIndexPage(mode), "utf-8");
  writeFileSync(join(detailDir, "page.tsx"), blogDetailPage(mode), "utf-8");
}
