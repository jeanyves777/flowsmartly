import { ImageResponse } from "next/og";
import { prisma } from "@/lib/db/client";
import { presignAllUrls } from "@/lib/utils/s3-client";

export const runtime = "nodejs";
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
      // Use fallback below.
    }
  }
  return mediaUrl ? [mediaUrl] : [];
}

function isVideoUrl(value: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(value);
}

function truncate(value: string | null | undefined, length: number): string {
  const cleaned = (value || "").replace(/\s+/g, " ").trim();
  if (cleaned.length <= length) return cleaned;
  return `${cleaned.slice(0, length - 1).trim()}...`;
}

function absoluteUrl(value: string | null): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return `${APP_URL}${value}`;
  return value;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;
  const post = await prisma.post.findFirst({
    where: {
      id: postId,
      status: "PUBLISHED",
      deletedAt: null,
      moderationStatus: { not: "removed" },
    },
    select: {
      caption: true,
      mediaUrl: true,
      mediaMeta: true,
      mediaType: true,
      likeCount: true,
      commentCount: true,
      viewCount: true,
      user: {
        select: {
          name: true,
          username: true,
          avatarUrl: true,
        },
      },
    },
  });

  if (!post) {
    return new Response("Not found", { status: 404 });
  }

  const authorName = post.user.name || post.user.username || "FlowSmartly creator";
  const mediaUrls = await presignAllUrls(parseMediaUrls(post.mediaMeta, post.mediaUrl));
  const firstImage = absoluteUrl(
    mediaUrls.find((url) => !isVideoUrl(url) && !post.mediaType?.toLowerCase().includes("video")) || null
  );
  const avatarUrl = absoluteUrl(post.user.avatarUrl ? await presignAllUrls(post.user.avatarUrl) : null);

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          background: "linear-gradient(135deg, #07111f 0%, #0b2538 45%, #19112f 100%)",
          color: "white",
          fontFamily: "Inter, Arial, sans-serif",
          padding: "54px",
          gap: "36px",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minWidth: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
            {avatarUrl ? (
              <img
                src={avatarUrl}
                width="72"
                height="72"
                style={{ borderRadius: "22px", objectFit: "cover", border: "3px solid rgba(255,255,255,.24)" }}
                alt=""
              />
            ) : (
              <div
                style={{
                  width: "72px",
                  height: "72px",
                  borderRadius: "22px",
                  background: "linear-gradient(135deg,#06b6d4,#8b5cf6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "30px",
                  fontWeight: 900,
                }}
              >
                {authorName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "32px", fontWeight: 800 }}>{authorName}</div>
              <div style={{ fontSize: "22px", color: "rgba(255,255,255,.68)" }}>Shared on FlowSmartly</div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div style={{ fontSize: "48px", lineHeight: 1.08, fontWeight: 900, letterSpacing: "-1px" }}>
              {truncate(post.caption, firstImage ? 118 : 168) || "View this FlowSmartly post"}
            </div>
            <div style={{ display: "flex", gap: "16px", fontSize: "22px", color: "rgba(255,255,255,.78)" }}>
              <span>{post.viewCount.toLocaleString()} views</span>
              <span>·</span>
              <span>{post.likeCount.toLocaleString()} likes</span>
              <span>·</span>
              <span>{post.commentCount.toLocaleString()} comments</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "12px",
                background: "linear-gradient(135deg,#0ea5e9,#7c3aed)",
              }}
            />
            <div style={{ fontSize: "28px", fontWeight: 900 }}>FlowSmartly</div>
          </div>
        </div>

        <div
          style={{
            width: "430px",
            height: "522px",
            borderRadius: "34px",
            overflow: "hidden",
            border: "2px solid rgba(255,255,255,.18)",
            background: "rgba(255,255,255,.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 24px 80px rgba(0,0,0,.35)",
          }}
        >
          {firstImage ? (
            <img src={firstImage} width="430" height="522" style={{ width: "430px", height: "522px", objectFit: "cover" }} alt="" />
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                height: "100%",
                background: "linear-gradient(160deg, rgba(14,165,233,.35), rgba(124,58,237,.35))",
                gap: "22px",
              }}
            >
              <div style={{ fontSize: "92px", fontWeight: 900 }}>FS</div>
              <div style={{ fontSize: "28px", color: "rgba(255,255,255,.78)" }}>Public post preview</div>
            </div>
          )}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
