import { prisma } from "@/lib/db/client";
import { getSyntheticConfig } from "./config";
import { generateComment, generateReply, generateCaption } from "./content";
import { pickMediaAsset } from "./media-pool";

/**
 * The daily engagement engine. A cron fires this every ~20 min. Each tick it:
 *  1. finds personas whose LOCAL time is inside their active window,
 *  2. smooths each one's remaining daily quota across the rest of the window,
 *  3. performs weighted actions (view ≫ like ≫ comment ≫ follow ≫ post),
 *  4. prioritises REAL users' posts so real people get fast likes/comments
 *     (and real in-app notifications — the actual retention payoff),
 *  5. logs everything to SyntheticActivityLog for the admin dashboard + dedup.
 *
 * Closed-loop: only touches FlowSmartly's own Post/Like/Comment/Follow/PostView.
 */

const TICK_MINUTES = 10;
const TICKS_PER_HOUR = 60 / TICK_MINUTES;
// Per-tick DB-write ceiling scales with intensity (slider 0–100). At 100% this
// allows ~2000 actions/tick; the per-persona daily quotas are the real limiter.
const BASE_MAX_ACTIONS_PER_TICK = 2000;

type ActionCounts = { like: number; comment: number; reply: number; follow: number; share: number; post: number };

const SHARE_PLATFORMS = ["feed", "copy_link", "whatsapp", "message", "story"];

interface PersonaRow {
  id: string;
  userId: string;
  niche: string;
  language: string;
  activeStartHour: number;
  activeEndHour: number;
  dailyLikes: number;
  dailyComments: number;
  dailyFollows: number;
  dailyShares: number;
  postChance: number;
  user: { id: string; name: string; username: string; timezone: string };
}

function rand(): number {
  return Math.random();
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function localHour(tz: string, now: Date): number {
  try {
    const s = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      hour12: false,
    }).format(now);
    return parseInt(s, 10) % 24;
  } catch {
    return now.getUTCHours();
  }
}

function startOfUTCDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export interface TickResult {
  skipped?: string;
  activePersonas: number;
  processed: number;
  actions: { likes: number; comments: number; replies: number; follows: number; views: number; shares: number; posts: number };
}

export async function runEngagementTick(): Promise<TickResult> {
  const config = await getSyntheticConfig();
  const stats: TickResult = {
    activePersonas: 0,
    processed: 0,
    actions: { likes: 0, comments: 0, replies: 0, follows: 0, views: 0, shares: 0, posts: 0 },
  };

  if (!config.enabled) return { ...stats, skipped: "disabled" };
  const intensity = Math.max(0, Math.min(100, config.intensity)) / 100;
  if (intensity <= 0) return { ...stats, skipped: "intensity-zero" };
  const maxActions = Math.max(200, Math.round(BASE_MAX_ACTIONS_PER_TICK * intensity));

  const now = new Date();

  // 1. Load enabled personas (optionally limited to configured niches).
  const nicheFilter = config.niches.length ? { niche: { in: config.niches } } : {};
  const personas = (await prisma.syntheticPersona.findMany({
    where: { enabled: true, ...nicheFilter, user: { isSynthetic: true, deletedAt: null } },
    select: {
      id: true,
      userId: true,
      niche: true,
      language: true,
      activeStartHour: true,
      activeEndHour: true,
      dailyLikes: true,
      dailyComments: true,
      dailyFollows: true,
      dailyShares: true,
      postChance: true,
      user: { select: { id: true, name: true, username: true, timezone: true } },
    },
  })) as PersonaRow[];

  // 2. Keep only personas currently inside their active window.
  const active = personas.filter((p) => {
    const h = localHour(p.user.timezone, now);
    return h >= p.activeStartHour && h <= p.activeEndHour;
  });
  stats.activePersonas = active.length;
  if (active.length === 0) return { ...stats, skipped: "no-active-personas" };

  // 3. Today's per-persona action counts (one grouped query, not N queries).
  const dayStart = startOfUTCDay(now);
  const grouped = await prisma.syntheticActivityLog.groupBy({
    by: ["actorId", "action"],
    where: { createdAt: { gte: dayStart } },
    _count: { _all: true },
  });
  const doneMap = new Map<string, ActionCounts>();
  for (const g of grouped) {
    const c = doneMap.get(g.actorId) ?? { like: 0, comment: 0, reply: 0, follow: 0, share: 0, post: 0 };
    if (g.action === "like") c.like = g._count._all;
    else if (g.action === "comment") c.comment = g._count._all;
    else if (g.action === "reply") c.reply = g._count._all;
    else if (g.action === "follow") c.follow = g._count._all;
    else if (g.action === "share") c.share = g._count._all;
    else if (g.action === "post") c.post = g._count._all;
    doneMap.set(g.actorId, c);
  }

  // 4. Candidate target pools — fetched ONCE and shared across personas.
  const [realPosts, synthPosts, realUsers] = await Promise.all([
    prisma.post.findMany({
      where: {
        status: "PUBLISHED",
        deletedAt: null,
        moderationStatus: { not: "removed" },
        user: { isSynthetic: false, deletedAt: null },
        createdAt: { gte: new Date(now.getTime() - 21 * 24 * 3600 * 1000) },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, userId: true, user: { select: { username: true } } },
    }),
    prisma.post.findMany({
      where: { status: "PUBLISHED", deletedAt: null, user: { isSynthetic: true } },
      orderBy: { createdAt: "desc" },
      take: 150,
      select: { id: true, userId: true, user: { select: { username: true } } },
    }),
    prisma.user.findMany({
      where: { isSynthetic: false, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 60,
      select: { id: true, username: true },
    }),
  ]);

  const allPosts = [...realPosts, ...synthPosts];
  const realPostIds = new Set(realPosts.map((p) => p.id));

  type TargetPost = { id: string; userId: string; user: { username: string } };
  function chooseTargetPost(): TargetPost | null {
    // 70% lean toward real-user posts so real people get the engagement.
    if (realPosts.length && (rand() < 0.7 || synthPosts.length === 0)) return pick(realPosts);
    if (synthPosts.length) return pick(synthPosts);
    return allPosts.length ? pick(allPosts) : null;
  }

  let actionBudget = maxActions;

  // Process personas in random order so the per-tick cap doesn't always favour
  // the same accounts.
  for (const p of shuffle(active)) {
    if (actionBudget <= 0) break;
    const h = localHour(p.user.timezone, now);
    const ticksLeft = Math.max(1, Math.ceil((p.activeEndHour - h + 1) * TICKS_PER_HOUR));
    const done = doneMap.get(p.userId) ?? { like: 0, comment: 0, reply: 0, follow: 0, share: 0, post: 0 };
    let acted = false;

    // ── VIEWS (cheap, high volume) — 0–2 per tick while active ──
    const viewTarget = 1 + Math.floor(rand() * 2);
    for (let v = 0; v < viewTarget && actionBudget > 0; v++) {
      const tp = chooseTargetPost();
      if (!tp || tp.userId === p.userId) continue;
      const ok = await doView(tp.id, p.userId);
      if (ok) {
        stats.actions.views++;
        actionBudget--;
        acted = true;
      }
    }

    // ── LIKES ──
    const likeRemaining = Math.max(0, p.dailyLikes - done.like);
    if (likeRemaining > 0 && rand() < clampProb((likeRemaining / ticksLeft) * intensity)) {
      const tp = chooseTargetPost();
      if (tp && tp.userId !== p.userId) {
        const ok = await doLike(tp.id, tp.userId, p, realPostIds.has(tp.id));
        if (ok) {
          stats.actions.likes++;
          actionBudget--;
          acted = true;
        }
      }
    }

    // ── COMMENTS & REPLIES ──
    const commentRemaining = Math.max(0, p.dailyComments - done.comment - done.reply);
    if (commentRemaining > 0 && rand() < clampProb((commentRemaining / ticksLeft) * intensity)) {
      const tp = chooseTargetPost();
      if (tp && tp.userId !== p.userId) {
        // ~40% reply to an existing comment (contextual + optional @mention);
        // otherwise a top-level comment that sometimes @mentions the author.
        let ok = false;
        if (rand() < 0.4) {
          ok = await doReply(tp, p);
          if (ok) stats.actions.replies++;
        }
        if (!ok) {
          ok = await doComment(tp, p, realPostIds.has(tp.id));
          if (ok) stats.actions.comments++;
        }
        if (ok) {
          actionBudget--;
          acted = true;
        }
      }
    }

    // ── SHARES ──
    const shareRemaining = Math.max(0, p.dailyShares - done.share);
    if (shareRemaining > 0 && rand() < clampProb((shareRemaining / ticksLeft) * intensity)) {
      const tp = chooseTargetPost();
      if (tp && tp.userId !== p.userId) {
        const ok = await doShare(tp.id, p.userId);
        if (ok) {
          stats.actions.shares++;
          actionBudget--;
          acted = true;
        }
      }
    }

    // ── FOLLOWS ──
    const followRemaining = Math.max(0, p.dailyFollows - done.follow);
    if (followRemaining > 0 && rand() < clampProb((followRemaining / ticksLeft) * intensity)) {
      const target = pickFollowTarget(realUsers, synthPosts, p.userId);
      if (target) {
        const ok = await doFollow(p, target);
        if (ok) {
          stats.actions.follows++;
          actionBudget--;
          acted = true;
        }
      }
    }

    // ── POST (at most one per day) ──
    if (done.post === 0 && rand() < clampProb((p.postChance / 100 / ticksLeft) * intensity)) {
      const ok = await doPost(p);
      if (ok) {
        stats.actions.posts++;
        actionBudget--;
        acted = true;
      }
    }

    if (acted) {
      stats.processed++;
      prisma.syntheticPersona
        .update({ where: { id: p.id }, data: { lastActiveAt: now } })
        .catch(() => {});
    }
  }

  return stats;
}

// ── Action primitives (mirror the real feed routes' Prisma writes) ──────────

async function doView(postId: string, actorId: string): Promise<boolean> {
  try {
    await prisma.$transaction([
      prisma.postView.create({
        data: { postId, viewerUserId: actorId, viewDuration: 2 + Math.floor(rand() * 8), deviceType: "mobile" },
      }),
      prisma.post.update({ where: { id: postId }, data: { viewCount: { increment: 1 } } }),
    ]);
    await logAction(actorId, "view", { postId });
    return true;
  } catch {
    return false; // already viewed (unique constraint) or gone
  }
}

async function doLike(
  postId: string,
  authorId: string,
  p: PersonaRow,
  isRealTarget: boolean
): Promise<boolean> {
  try {
    await prisma.$transaction([
      prisma.like.create({ data: { postId, userId: p.userId } }),
      prisma.post.update({ where: { id: postId }, data: { likeCount: { increment: 1 } } }),
    ]);
  } catch {
    return false; // already liked
  }
  await logAction(p.userId, "like", { postId, targetUserId: authorId });
  if (isRealTarget) {
    await prisma.notification
      .create({
        data: {
          userId: authorId,
          type: "LIKE",
          title: "New Like",
          message: `${p.user.name} liked your post`,
          data: JSON.stringify({ postId, userId: p.userId }),
          actionUrl: `/feed?post=${postId}`,
        },
      })
      .catch(() => {});
  }
  return true;
}

async function doComment(
  tp: { id: string; userId: string; user: { username: string } },
  p: PersonaRow,
  isRealTarget: boolean
): Promise<boolean> {
  const postId = tp.id;
  const authorId = tp.userId;
  // Avoid the same persona top-level-commenting twice on one post (replies are
  // tracked separately via parentId).
  const existing = await prisma.comment.findFirst({
    where: { postId, userId: p.userId, parentId: null, deletedAt: null },
    select: { id: true },
  });
  if (existing) return false;

  // ~40% of comments @mention the post author (then the generator decides ~50%).
  const mention = rand() < 0.4 ? tp.user?.username : undefined;
  const content = generateComment({ niche: p.niche, language: p.language, mention });
  try {
    await prisma.$transaction([
      prisma.comment.create({ data: { postId, userId: p.userId, content } }),
      prisma.post.update({ where: { id: postId }, data: { commentCount: { increment: 1 } } }),
    ]);
  } catch {
    return false;
  }
  await logAction(p.userId, "comment", { postId, targetUserId: authorId });
  if (isRealTarget) {
    await prisma.notification
      .create({
        data: {
          userId: authorId,
          type: "COMMENT",
          title: "New Comment",
          message: `${p.user.name} commented on your post`,
          data: JSON.stringify({ postId, userId: p.userId }),
          actionUrl: `/feed?post=${postId}`,
        },
      })
      .catch(() => {});
  }
  return true;
}

/** Reply to an existing comment on the post — threaded (parentId) + contextual,
 * often @mentioning the comment's author. Notifies that author if they're real. */
async function doReply(
  tp: { id: string; userId: string },
  p: PersonaRow
): Promise<boolean> {
  const postId = tp.id;
  const parents = await prisma.comment.findMany({
    where: { postId, deletedAt: null, parentId: null, userId: { not: p.userId } },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: { id: true, userId: true, user: { select: { username: true, isSynthetic: true } } },
  });
  if (!parents.length) return false;
  const parent = pick(parents);

  // Don't reply twice to the same comment.
  const dup = await prisma.comment.findFirst({
    where: { postId, userId: p.userId, parentId: parent.id, deletedAt: null },
    select: { id: true },
  });
  if (dup) return false;

  const content = generateReply({ language: p.language, mention: parent.user?.username });
  try {
    await prisma.$transaction([
      prisma.comment.create({ data: { postId, userId: p.userId, parentId: parent.id, content } }),
      prisma.post.update({ where: { id: postId }, data: { commentCount: { increment: 1 } } }),
    ]);
  } catch {
    return false;
  }
  await logAction(p.userId, "reply", { postId, targetUserId: parent.userId });
  // Real-user payoff: "X replied to your comment" (in-app only).
  if (parent.user && !parent.user.isSynthetic && parent.userId !== p.userId) {
    await prisma.notification
      .create({
        data: {
          userId: parent.userId,
          type: "COMMENT",
          title: "New Reply",
          message: `${p.user.name} replied to your comment`,
          data: JSON.stringify({ postId, userId: p.userId }),
          actionUrl: `/feed?post=${postId}`,
        },
      })
      .catch(() => {});
  }
  return true;
}

async function doShare(postId: string, actorId: string): Promise<boolean> {
  try {
    await prisma.$transaction([
      prisma.share.create({ data: { postId, platform: pick(SHARE_PLATFORMS) } }),
      prisma.post.update({ where: { id: postId }, data: { shareCount: { increment: 1 } } }),
    ]);
  } catch {
    return false;
  }
  await logAction(actorId, "share", { postId });
  return true;
}

async function doFollow(
  p: PersonaRow,
  target: { id: string; username: string; isReal: boolean }
): Promise<boolean> {
  if (target.id === p.userId) return false;
  try {
    await prisma.follow.create({ data: { followerId: p.userId, followingId: target.id } });
  } catch {
    return false; // already following
  }
  await logAction(p.userId, "follow", { targetUserId: target.id });
  if (target.isReal) {
    await prisma.notification
      .create({
        data: {
          userId: target.id,
          type: "FOLLOW",
          title: "New Follower",
          message: `${p.user.name} started following you`,
          data: JSON.stringify({ userId: p.userId }),
          actionUrl: `/profile/${p.user.username}`,
        },
      })
      .catch(() => {});
  }
  return true;
}

async function doPost(p: PersonaRow): Promise<boolean> {
  const { caption, hashtags } = generateCaption({ niche: p.niche, language: p.language });
  // ~55% of posts carry a free pool image; the rest are text-only (very real).
  let mediaUrl: string | null = null;
  if (rand() < 0.55) {
    mediaUrl = await pickMediaAsset(p.niche);
  }
  try {
    const post = await prisma.post.create({
      data: {
        userId: p.userId,
        caption,
        hashtags: JSON.stringify(hashtags),
        mediaUrl: mediaUrl ?? undefined,
        mediaType: mediaUrl ? "image" : undefined,
        status: "PUBLISHED",
        publishedAt: new Date(),
        platforms: JSON.stringify(["feed"]),
      },
      select: { id: true },
    });
    await logAction(p.userId, "post", { postId: post.id });
    return true;
  } catch {
    return false;
  }
}

// ── helpers ──────────────────────────────────────────────────────────────

function pickFollowTarget(
  realUsers: Array<{ id: string; username: string }>,
  synthPosts: Array<{ id: string; userId: string }>,
  selfId: string
): { id: string; username: string; isReal: boolean } | null {
  // 75% follow real users (gives them a real "new follower" ping).
  if (realUsers.length && (rand() < 0.75 || synthPosts.length === 0)) {
    const u = pick(realUsers.filter((u) => u.id !== selfId));
    return u ? { id: u.id, username: u.username, isReal: true } : null;
  }
  const sp = synthPosts.filter((s) => s.userId !== selfId);
  if (!sp.length) return null;
  const target = pick(sp);
  return { id: target.userId, username: "", isReal: false };
}

async function logAction(
  actorId: string,
  action: string,
  opts: { postId?: string; targetUserId?: string } = {}
): Promise<void> {
  await prisma.syntheticActivityLog
    .create({
      data: {
        actorId,
        action,
        targetPostId: opts.postId ?? null,
        targetUserId: opts.targetUserId ?? null,
      },
    })
    .catch(() => {});
}

function clampProb(p: number): number {
  if (!isFinite(p) || p < 0) return 0;
  return Math.min(0.92, p);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Aggregate activity stats for the admin dashboard. */
export async function engagementStats(): Promise<{
  today: Record<string, number>;
  total: Record<string, number>;
}> {
  const dayStart = startOfUTCDay(new Date());
  const [todayRows, totalRows] = await Promise.all([
    prisma.syntheticActivityLog.groupBy({
      by: ["action"],
      where: { createdAt: { gte: dayStart } },
      _count: { _all: true },
    }),
    prisma.syntheticActivityLog.groupBy({ by: ["action"], _count: { _all: true } }),
  ]);
  const toMap = (rows: typeof todayRows) => {
    const m: Record<string, number> = { like: 0, comment: 0, reply: 0, follow: 0, view: 0, share: 0, post: 0 };
    for (const r of rows) m[r.action] = r._count._all;
    return m;
  };
  return { today: toMap(todayRows), total: toMap(totalRows) };
}
