"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Sparkles, CalendarClock, CheckCircle2, FileEdit, Link2, Plug, Image as ImageIcon } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * Publish — a deep new-design content surface (the Publish workspace canvas):
 * the user's posts by status + connected social accounts, with agent-driven
 * compose. Real data (GET /api/content/posts, GET /api/social-accounts); no
 * legacy links — creation + connection drive the agent. [[new-design-no-legacy]]
 */

type Status = "ALL" | "SCHEDULED" | "PUBLISHED" | "DRAFT";

interface Post {
  id: string;
  caption: string | null;
  mediaUrls?: string[];
  platforms?: string[];
  status: string;
  scheduledAt?: string | null;
  publishedAt?: string | null;
  likeCount?: number;
  commentCount?: number;
  viewCount?: number;
}
interface PlatformAcc {
  platform: string;
  name?: string;
  connected?: boolean;
  connectedCount?: number;
  username?: string | null;
  avatarUrl?: string | null;
}

const TABS: { id: Status; label: string }[] = [
  { id: "ALL", label: "All" },
  { id: "SCHEDULED", label: "Scheduled" },
  { id: "PUBLISHED", label: "Published" },
  { id: "DRAFT", label: "Drafts" },
];

function fmt(iso?: string | null): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch { return ""; }
}

export function FocusedPublish({ onConnect, refreshKey }: { onConnect: () => void; refreshKey?: number }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("ALL");
  const [posts, setPosts] = useState<Post[]>([]);
  const [accounts, setAccounts] = useState<PlatformAcc[]>([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/social-accounts")
      .then((r) => r.json())
      .then((j) => { if (alive && j?.success && Array.isArray(j.data?.platforms)) setAccounts(j.data.platforms); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [refreshKey]);

  useEffect(() => {
    let alive = true;
    setPostsLoading(true);
    fetch(`/api/content/posts?status=${status}&limit=30`)
      .then((r) => r.json())
      .then((j) => { if (alive && j?.success && Array.isArray(j.data?.posts)) setPosts(j.data.posts); })
      .catch(() => {})
      .finally(() => { if (alive) setPostsLoading(false); });
    return () => { alive = false; };
  }, [status, refreshKey]);

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading your content…" /></div>;
  }

  const connected = accounts.filter((a) => a.connected || (a.connectedCount ?? 0) > 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card/30 px-4 py-2.5">
        <div className="inline-flex rounded-[10px] border border-border p-0.5">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setStatus(t.id)} className={cn("rounded-lg px-3 py-1.5 text-[12px] font-semibold transition", status === t.id ? "bg-brand-500/10 text-brand-500" : "text-muted-foreground hover:text-foreground")}>{t.label}</button>
          ))}
        </div>
        <button onClick={() => router.push("/content/schedule")} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-1.5 text-[12.5px] font-semibold text-white shadow-sm">
          <Sparkles className="h-3.5 w-3.5" /> New post
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-4">
          {/* connected accounts */}
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <Plug className="h-4 w-4 text-brand-500" />
              <h3 className="text-[13px] font-bold">Connected accounts</h3>
            </div>
            {connected.length ? (
              <div className="flex flex-wrap gap-2">
                {connected.map((a) => (
                  <span key={a.platform} className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-[12.5px]">
                    {a.avatarUrl ? <Image src={a.avatarUrl} alt="" width={18} height={18} className="h-[18px] w-[18px] rounded-full object-cover" unoptimized /> : <Link2 className="h-3.5 w-3.5 text-muted-foreground" />}
                    <span className="font-medium capitalize">{a.name || a.platform}</span>
                    {a.username && <span className="text-muted-foreground">@{a.username}</span>}
                  </span>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border px-4 py-4">
                <p className="text-[12.5px] text-muted-foreground">No social accounts connected — you can still post to your in-app feed. Connect Instagram, Facebook, X… to cross-post.</p>
                <button onClick={onConnect} className="shrink-0 rounded-[10px] border border-border px-3 py-1.5 text-[12.5px] font-semibold hover:border-brand-500/60 hover:text-foreground">Connect</button>
              </div>
            )}
          </section>

          {/* posts */}
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <h3 className="text-[13px] font-bold">{status === "ALL" ? "Your posts" : TABS.find((t) => t.id === status)?.label}</h3>
              {postsLoading && <FlowLoader size={14} className="ms-1" />}
            </div>
            {posts.length ? (
              <div className="space-y-2.5">
                {posts.map((p) => <PostRow key={p.id} post={p} />)}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
                <p className="text-[13px] font-medium">{status === "SCHEDULED" ? "Nothing scheduled yet" : status === "DRAFT" ? "No drafts" : "No posts yet"}</p>
                <p className="mt-1 text-[12px] text-muted-foreground">Create your first post and the agent will write, design, and schedule it.</p>
                <button onClick={() => router.push("/content/schedule")} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30">
                  <Sparkles className="h-4 w-4" /> Create a post
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function PostRow({ post }: { post: Post }) {
  const st = post.status?.toUpperCase();
  const media = post.mediaUrls?.[0];
  const when = st === "PUBLISHED" ? `Published ${fmt(post.publishedAt)}` : st === "SCHEDULED" ? `Scheduled · ${fmt(post.scheduledAt)}` : "Draft";
  const Badge = st === "PUBLISHED" ? CheckCircle2 : st === "SCHEDULED" ? CalendarClock : FileEdit;
  const badgeColor = st === "PUBLISHED" ? "text-emerald-500" : st === "SCHEDULED" ? "text-brand-500" : "text-muted-foreground";
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-3">
      <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-background">
        {media ? <Image src={media} alt="" width={48} height={48} className="h-full w-full object-cover" unoptimized /> : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[13px]">{post.caption || "Untitled post"}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-muted-foreground">
          <span className={cn("inline-flex items-center gap-1 font-medium", badgeColor)}><Badge className="h-3.5 w-3.5" /> {when}</span>
          {(post.platforms ?? []).length > 0 && <span className="capitalize">{(post.platforms ?? []).join(" · ")}</span>}
          {st === "PUBLISHED" && <span>{(post.viewCount ?? 0).toLocaleString()} views · {(post.likeCount ?? 0).toLocaleString()} likes</span>}
        </div>
      </div>
    </div>
  );
}
