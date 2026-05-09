import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Eye, Heart, MessageCircle, Share2, ShieldCheck, type LucideIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/db/client";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { PublicPostActions } from "@/components/feed/public-post-actions";
import { PublicPostViewTracker } from "@/components/feed/public-post-view-tracker";

export const dynamic = "force-dynamic";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://flowsmartly.com").replace(/\/$/, "");

function parseMediaUrls(mediaMeta?: string | null, mediaUrl?: string | null): string[] {
  if (mediaMeta) {
    try {
      const parsed = JSON.parse(mediaMeta);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => {
            if (typeof item === "string") return item;
            if (item && typeof item === "object" && typeof item.url === "string") return item.url;
            return null;
          })
          .filter((item): item is string => !!item);
      }
    } catch {
      // Fall back to mediaUrl below.
    }
  }
  return mediaUrl ? [mediaUrl] : [];
}

function parseJsonArray(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function isVideoUrl(value: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(value);
}

function truncate(value: string | null | undefined, length: number): string {
  const cleaned = (value || "").replace(/\s+/g, " ").trim();
  if (cleaned.length <= length) return cleaned;
  return `${cleaned.slice(0, length - 1).trim()}...`;
}

function formatCount(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(value >= 10000000 ? 0 : 1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K`;
  return value.toString();
}

async function getPost(postId: string) {
  const post = await prisma.post.findFirst({
    where: {
      id: postId,
      status: "PUBLISHED",
      deletedAt: null,
      moderationStatus: { not: "removed" },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          avatarUrl: true,
          plan: true,
        },
      },
      adCampaign: {
        select: {
          destinationUrl: true,
          ctaText: true,
        },
      },
      comments: {
        where: { parentId: null, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 6,
        include: {
          user: {
            select: {
              name: true,
              username: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
  });

  if (!post) return null;

  const mediaUrls = await presignAllUrls(parseMediaUrls(post.mediaMeta, post.mediaUrl));
  const avatarUrl = post.user.avatarUrl ? await presignAllUrls(post.user.avatarUrl) : null;
  const comments = await presignAllUrls(
    post.comments.map((comment) => ({
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      author: comment.user,
    }))
  );

  return {
    ...post,
    mediaUrls,
    signedAvatarUrl: avatarUrl,
    publicComments: comments,
    hashtags: parseJsonArray(post.hashtags),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ postId: string }>;
}): Promise<Metadata> {
  const { postId } = await params;
  const post = await prisma.post.findFirst({
    where: {
      id: postId,
      status: "PUBLISHED",
      deletedAt: null,
      moderationStatus: { not: "removed" },
    },
    select: {
      id: true,
      caption: true,
      createdAt: true,
      user: { select: { name: true, username: true } },
    },
  });

  if (!post) {
    return { title: "Post not found | FlowSmartly" };
  }

  const authorName = post.user.name || post.user.username || "FlowSmartly creator";
  const title = `${authorName} on FlowSmartly`;
  const description = truncate(post.caption, 180) || "View this shared FlowSmartly post.";
  const canonicalUrl = `${APP_URL}/post/${post.id}`;
  const imageUrl = `${APP_URL}/api/og/post/${post.id}`;

  return {
    title,
    description,
    robots: { index: true, follow: true },
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      type: "article",
      url: canonicalUrl,
      siteName: "FlowSmartly",
      publishedTime: post.createdAt.toISOString(),
      images: [{ url: imageUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function PublicPostPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  const post = await getPost(postId);

  if (!post) notFound();

  const postUrl = `${APP_URL}/post/${post.id}`;
  const authorName = post.user.name || post.user.username || "FlowSmartly creator";
  const initials = authorName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.10),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(124,58,237,0.10),transparent_34%)]">
      <PublicPostViewTracker postId={post.id} />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:px-6 lg:py-12">
        <article className="overflow-hidden rounded-3xl border bg-card shadow-sm">
          <div className="border-b p-4 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="h-12 w-12 border">
                  <AvatarImage src={post.signedAvatarUrl || undefined} alt={authorName} />
                  <AvatarFallback>{initials || "FS"}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="truncate text-lg font-semibold">{authorName}</h1>
                    {post.user.plan !== "STARTER" && (
                      <Badge variant="secondary" className="gap-1">
                        <ShieldCheck className="h-3 w-3 text-brand-500" />
                        Verified
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    @{post.user.username || "creator"} · Shared on FlowSmartly
                  </p>
                </div>
              </div>
              <Button asChild variant="outline" className="hidden sm:inline-flex">
                <Link href="/login">Log in</Link>
              </Button>
            </div>
          </div>

          {post.mediaUrls.length > 0 && (
            <div className="grid gap-3 border-b bg-muted/30 p-3 sm:p-4">
              {post.mediaUrls.map((url, index) => (
                <div key={url} className="overflow-hidden rounded-2xl border bg-background">
                  {isVideoUrl(url) || post.mediaType?.toLowerCase().includes("video") ? (
                    <video
                      src={url}
                      controls
                      playsInline
                      preload="metadata"
                      className="max-h-[720px] w-full bg-black object-contain"
                    />
                  ) : (
                    <Image
                      src={url}
                      alt={`${authorName} post media ${index + 1}`}
                      width={1200}
                      height={900}
                      className="max-h-[720px] w-full object-contain"
                      unoptimized
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="space-y-5 p-4 sm:p-6">
            {post.caption && (
              <p className="whitespace-pre-wrap text-base leading-7 sm:text-lg">{post.caption}</p>
            )}
            {post.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {post.hashtags.slice(0, 12).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-brand-600">
                    {tag.startsWith("#") ? tag : `#${tag}`}
                  </Badge>
                ))}
              </div>
            )}

            <div className="grid grid-cols-4 gap-2 rounded-2xl border bg-muted/30 p-3 text-center text-sm">
              <Stat icon={Eye} label="Views" value={formatCount(post.viewCount)} />
              <Stat icon={Heart} label="Likes" value={formatCount(post.likeCount)} />
              <Stat icon={MessageCircle} label="Comments" value={formatCount(post.commentCount)} />
              <Stat icon={Share2} label="Shares" value={formatCount(post.shareCount)} />
            </div>

            <PublicPostActions
              postId={post.id}
              postUrl={postUrl}
              destinationUrl={post.adCampaign?.destinationUrl}
              ctaText={post.adCampaign?.ctaText}
            />
          </div>
        </article>

        <aside className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CalendarDays className="h-4 w-4 text-brand-500" />
              Public shared post
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              You can view this post without an account. Log in when you want to like, comment, or share it.
            </p>
            <div className="mt-4 rounded-2xl bg-brand-500/10 p-3 text-sm text-brand-700">
              Views and clicks from this public link are tracked for the creator's analytics.
            </div>
          </Card>

          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">Recent comments</h2>
              <Badge variant="outline">{post.publicComments.length}</Badge>
            </div>
            {post.publicComments.length > 0 ? (
              <div className="space-y-3">
                {post.publicComments.map((comment) => {
                  const commentAuthor = comment.author.name || comment.author.username || "FlowSmartly user";
                  return (
                    <div key={comment.id} className="rounded-2xl border bg-background p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={comment.author.avatarUrl || undefined} alt={commentAuthor} />
                          <AvatarFallback className="text-[10px]">
                            {commentAuthor.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <p className="truncate text-xs font-semibold">{commentAuthor}</p>
                      </div>
                      <p className="line-clamp-4 text-sm text-muted-foreground">{comment.content}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                No comments yet.
              </p>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-background p-2">
      <Icon className="mx-auto mb-1 h-4 w-4 text-brand-500" />
      <p className="text-base font-bold">{value}</p>
      <p className="truncate text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
