"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Users,
  Eye,
  Heart,
  MessageCircle,
  ArrowRight,
  FileText,
  Building2,
  X,
  Wand2,
  Briefcase,
  Award,
  BarChart3,
  PenTool,
  Image as ImageIcon,
  Palette,
  Play,
  ExternalLink,
  MapPin,
  Quote,
  SearchCheck,
  ShieldCheck,
  Star,
  GripVertical,
  Pin,
  PinOff,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { TrendingTopics, type TrendingTopic } from "@/components/shared/trending-topics";
import { SponsoredSidebar, type SponsoredAd, type PromotedPost } from "@/components/shared/sponsored-sidebar";
import { TrendingPosts, type TrendingPost } from "@/components/shared/trending-posts";
import { PageLoader } from "@/components/shared/page-loader";

interface DashboardData {
  user: {
    name: string;
    plan: string;
    aiCredits: number;
    avatarUrl: string | null;
  };
  brandKit: {
    id: string;
    name: string;
    isComplete: boolean;
  } | null;
  stats: {
    totalViews: number;
    engagement: number;
    followers: number;
    following: number;
    earnings: number;
    postsCount: number;
  };
  aiUsage: {
    thisMonth: number;
  };
  recentActivity: Array<{
    id: string;
    type: string;
    title: string;
    content: string;
    mediaUrl: string | null;
    mediaType: string | null;
    views: number;
    likes: number;
    comments: number;
    createdAt: string;
  }>;
  agentStats: {
    isApproved: boolean;
    status: string;
    totalClients: number;
    totalReviews: number;
    avgRating: number;
    minPricePerMonth: number;
    performanceScore: number;
    totalEarnings: string;
    specialties: string | null;
  } | null;
  googleListing: DashboardGoogleListing;
  sidebar: {
    sponsoredAds: SponsoredAd[];
    premierVideos: DashboardPremierVideo[];
    promotedPosts: Array<{
      id: string;
      content: string;
      mediaUrl: string | null;
      destinationUrl: string | null;
      authorName: string;
      authorAvatar: string | null;
    }>;
    trendingPosts: Array<{
      id: string;
      content: string;
      mediaUrl: string | null;
      authorName: string;
      authorAvatar: string | null;
      viewCount?: number;
      likeCount?: number;
      commentCount?: number;
    }>;
    trendingTopics: TrendingTopic[];
  };
}

interface DashboardGoogleListing {
  connected: boolean;
  profileId: string | null;
  businessName: string;
  address: string | null;
  website: string | null;
  phone: string | null;
  listingUrl: string | null;
  status: string;
  rating: number | null;
  reviewCount: number;
  seoHealthScore: number;
  citationScore: number;
  coverageScore: number;
  reviewScore: number;
  consistencyScore: number;
  responseRate: number | null;
  lastCheckedAt: string | null;
  reviews: Array<{
    id: string;
    authorName: string;
    authorAvatarUrl: string | null;
    rating: number;
    text: string | null;
    sentiment: string | null;
    reviewUrl: string | null;
    publishedAt: string | null;
  }>;
  recommendations: string[];
  connectHref: string;
}

interface DashboardPremierVideo {
  id: string;
  postId?: string;
  title: string;
  description: string;
  videoUrl: string;
  posterUrl: string | null;
  destinationUrl: string;
  ctaText: string;
  authorName: string;
  authorAvatar: string | null;
  source: string;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
}

interface DashboardVisualPost {
  id: string;
  content: string;
  title: string;
  mediaUrl: string | null;
  mediaType: string | null;
  views: number;
  likes: number;
  comments: number;
  createdAt: string;
  authorName: string;
  authorAvatar: string | null;
  sourceLabel: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

const dashboardTips = [
  "Loading your dashboard...",
  "Crunching your numbers...",
  "Fetching latest stats...",
];

const FLOWSMARTLY_PREMIER_VIDEOS: DashboardPremierVideo[] = [
  {
    id: "flowsmartly-premier-creative",
    title: "FlowCreative turns ideas into campaign-ready media",
    description: "A premium FlowSmartly showcase for brands that need posts, ads, and creative assets moving fast.",
    videoUrl: "/marketing/videos/flowsmartly-premier-creative.mp4",
    posterUrl: "/marketing/flowsmartly-studio-team.jpg",
    destinationUrl: "/ads/create",
    ctaText: "Create a campaign",
    authorName: "FlowSmartly",
    authorAvatar: "/icon.png",
    source: "FlowSmartly premier",
  },
  {
    id: "flowsmartly-premier-growth",
    title: "Launch, promote, and track in one workspace",
    description: "A quick look at the operating system behind smarter content, automation, and performance.",
    videoUrl: "/marketing/videos/flowsmartly-premier-growth.mp4",
    posterUrl: "/marketing/transparent/flowsmartly-dashboard-cutout.png",
    destinationUrl: "/ads/create",
    ctaText: "Create a campaign",
    authorName: "FlowSmartly",
    authorAvatar: "/icon.png",
    source: "FlowSmartly premier",
  },
];

function feedTrendHref(tag: string): string {
  const normalized = tag.trim().replace(/^#/, "").toLowerCase();
  return `/feed?trend=${encodeURIComponent(normalized)}`;
}

function isVideoMedia(url?: string | null, mediaType?: string | null): boolean {
  if (mediaType?.toLowerCase().includes("video")) return true;
  return !!url?.match(/\.(mp4|webm|mov|m4v)(\?|#|$)/i);
}

type DashboardWorkspaceSectionId = "google" | "recent" | "premier";

const DASHBOARD_WORKSPACE_STORAGE_KEY = "flowsmartly.dashboard.workspace.v1";
const DEFAULT_DASHBOARD_WORKSPACE_ORDER: DashboardWorkspaceSectionId[] = ["google", "recent", "premier"];
const DASHBOARD_WORKSPACE_LABELS: Record<DashboardWorkspaceSectionId, string> = {
  google: "Google listing and SEO health",
  recent: "Recent posts showcase",
  premier: "Premier video spotlight",
};

function normalizeDashboardWorkspaceOrder(value: unknown): DashboardWorkspaceSectionId[] {
  const valid = new Set<DashboardWorkspaceSectionId>(DEFAULT_DASHBOARD_WORKSPACE_ORDER);
  const incoming = Array.isArray(value)
    ? value.filter((item): item is DashboardWorkspaceSectionId => valid.has(item as DashboardWorkspaceSectionId))
    : [];
  return [
    ...incoming,
    ...DEFAULT_DASHBOARD_WORKSPACE_ORDER.filter((item) => !incoming.includes(item)),
  ];
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBrandBanner, setShowBrandBanner] = useState(true);
  const [postShowcaseIndex, setPostShowcaseIndex] = useState(0);
  const [isPostShowcasePaused, setIsPostShowcasePaused] = useState(false);
  const [workspaceOrder, setWorkspaceOrder] = useState<DashboardWorkspaceSectionId[]>(DEFAULT_DASHBOARD_WORKSPACE_ORDER);
  const [pinnedWorkspaceSection, setPinnedWorkspaceSection] = useState<DashboardWorkspaceSectionId | null>(null);
  const [workspacePrefsLoaded, setWorkspacePrefsLoaded] = useState(false);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch("/api/dashboard");
        const json = await res.json();
        if (json.success) {
          setData(json.data);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(DASHBOARD_WORKSPACE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as {
          order?: unknown;
          pinned?: DashboardWorkspaceSectionId | null;
        };
        setWorkspaceOrder(normalizeDashboardWorkspaceOrder(parsed.order));
        setPinnedWorkspaceSection(
          DEFAULT_DASHBOARD_WORKSPACE_ORDER.includes(parsed.pinned as DashboardWorkspaceSectionId)
            ? (parsed.pinned as DashboardWorkspaceSectionId)
            : null
        );
      }
    } catch (error) {
      console.warn("Could not load dashboard workspace preferences", error);
    } finally {
      setWorkspacePrefsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!workspacePrefsLoaded) return;
    window.localStorage.setItem(
      DASHBOARD_WORKSPACE_STORAGE_KEY,
      JSON.stringify({ order: workspaceOrder, pinned: pinnedWorkspaceSection })
    );
  }, [workspaceOrder, pinnedWorkspaceSection, workspacePrefsLoaded]);

  const showcasePostCount = data?.recentActivity.length || data?.sidebar.trendingPosts.length || 0;

  useEffect(() => {
    setPostShowcaseIndex(0);
  }, [showcasePostCount]);

  useEffect(() => {
    if (loading || isPostShowcasePaused || showcasePostCount <= 1) return;
    const timer = window.setInterval(() => {
      setPostShowcaseIndex((current) => (current + 1) % showcasePostCount);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [isPostShowcasePaused, loading, showcasePostCount]);

  if (loading) {
    return <PageLoader tips={dashboardTips} />;
  }

  const stats = data?.stats || {
    totalViews: 0,
    engagement: 0,
    followers: 0,
    following: 0,
    earnings: 0,
    postsCount: 0,
  };

  // Only show ads that have media
  const adsWithMedia = data?.sidebar.sponsoredAds.filter(ad => ad.videoUrl || ad.mediaUrl) || [];
  const hasSponsored = adsWithMedia.length > 0 || (data?.sidebar.promotedPosts.length || 0) > 0;
  const premierVideos = data?.sidebar.premierVideos?.length
    ? data.sidebar.premierVideos
    : FLOWSMARTLY_PREMIER_VIDEOS;

  // Map sidebar data to shared component types
  const promotedPosts: PromotedPost[] = (data?.sidebar.promotedPosts || []).map(p => ({
    id: p.id,
    content: p.content,
    mediaUrl: p.mediaUrl,
    authorName: p.authorName,
    authorAvatar: p.authorAvatar,
    destinationUrl: p.destinationUrl,
  }));

  const trendingPosts: TrendingPost[] = (data?.sidebar.trendingPosts || []).map(p => ({
    id: p.id,
    content: p.content,
    mediaUrl: p.mediaUrl,
    authorName: p.authorName,
    authorAvatar: p.authorAvatar,
    viewCount: p.viewCount,
    likeCount: p.likeCount,
    commentCount: p.commentCount,
  }));

  const visualPosts: DashboardVisualPost[] = data?.recentActivity.length
    ? data.recentActivity.map((post) => ({
        id: post.id,
        content: post.content || post.title,
        title: post.title,
        mediaUrl: post.mediaUrl,
        mediaType: post.mediaType,
        views: post.views,
        likes: post.likes,
        comments: post.comments,
        createdAt: post.createdAt,
        authorName: data.user.name,
        authorAvatar: data.user.avatarUrl,
        sourceLabel: "Your latest post",
      }))
    : trendingPosts.map((post) => ({
        id: post.id,
        content: post.content,
        title: post.content,
        mediaUrl: post.mediaUrl,
        mediaType: null,
        views: post.viewCount || 0,
        likes: post.likeCount || 0,
        comments: post.commentCount || 0,
        createdAt: "",
        authorName: post.authorName,
        authorAvatar: post.authorAvatar,
        sourceLabel: "Trending now",
      }));

  const visibleShowcasePosts = visualPosts.length
    ? Array.from({ length: Math.min(3, visualPosts.length) }, (_, offset) => visualPosts[(postShowcaseIndex + offset) % visualPosts.length])
    : [];

  const openDestination = (url: string) => {
    if (/^https?:\/\//i.test(url)) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    router.push(url);
  };

  const moveWorkspaceSection = (source: DashboardWorkspaceSectionId, target: DashboardWorkspaceSectionId) => {
    if (source === target) return;
    setWorkspaceOrder((current) => {
      const next = normalizeDashboardWorkspaceOrder(current);
      const sourceIndex = next.indexOf(source);
      const targetIndex = next.indexOf(target);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const toggleWorkspacePin = (sectionId: DashboardWorkspaceSectionId) => {
    setPinnedWorkspaceSection((current) => (current === sectionId ? null : sectionId));
    setWorkspaceOrder((current) => {
      const next = normalizeDashboardWorkspaceOrder(current).filter((item) => item !== sectionId);
      return [sectionId, ...next];
    });
  };

  const orderedWorkspaceSections = [
    ...(pinnedWorkspaceSection ? [pinnedWorkspaceSection] : []),
    ...workspaceOrder.filter((sectionId) => sectionId !== pinnedWorkspaceSection),
  ];

  const workspaceSections: Record<DashboardWorkspaceSectionId, React.ReactNode> = {
    google: data?.googleListing ? (
      <GoogleListingShowcase
        listing={data.googleListing}
        onConnect={() => router.push(data.googleListing.connectHref || "/social-accounts?section=google-business")}
        onOpenListing={() => {
          if (data.googleListing.listingUrl) openDestination(data.googleListing.listingUrl);
        }}
      />
    ) : null,
    recent: (
      <Card
        className="overflow-hidden"
        onMouseEnter={() => setIsPostShowcasePaused(true)}
        onMouseLeave={() => setIsPostShowcasePaused(false)}
      >
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-brand-500/15 to-violet-500/15 flex items-center justify-center">
              <FileText className="h-3.5 w-3.5 text-brand-500" />
            </div>
            Recent posts showcase
            {visualPosts.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                {data?.recentActivity.length ? "Your work" : "Trending fallback"}
              </Badge>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" className="text-xs h-7 px-2" asChild>
            <Link href="/feed">
              View all <ArrowRight className="h-3 w-3 ml-1" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="pt-1">
          {visibleShowcasePosts.length > 0 ? (
            <div className="grid gap-3 xl:grid-cols-[1.18fr_0.82fr]">
              <DashboardPostCard
                post={visibleShowcasePosts[0]}
                featured
                onClick={() => router.push(`/feed?post=${visibleShowcasePosts[0].id}`)}
              />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                {visibleShowcasePosts.slice(1).map((post) => (
                  <DashboardPostCard
                    key={post.id}
                    post={post}
                    onClick={() => router.push(`/feed?post=${post.id}`)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No posts or trends yet</p>
              <Button asChild className="mt-3" size="sm" variant="outline">
                <Link href="/studio">
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Create Post
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    ),
    premier: (
      <PremierVideoShowcase
        videos={premierVideos}
        onSelect={(video) => openDestination(video.destinationUrl || (video.postId ? `/feed?post=${video.postId}` : "/feed"))}
      />
    ),
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="pb-8"
    >
      {/* Brand Setup Banner */}
      <AnimatePresence>
        {showBrandBanner && (!data?.brandKit || !data.brandKit.isComplete) && (
          <motion.div
            variants={itemVariants}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            className="mb-5"
          >
            <Card className="border-amber-500/50 bg-gradient-to-r from-amber-500/10 to-orange-500/10">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                    <Building2 className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold flex items-center gap-2">
                      Set Up Your Brand Identity
                      <Wand2 className="h-4 w-4 text-amber-500" />
                    </h3>
                    <p className="text-muted-foreground text-sm mt-1">
                      Configure your brand voice, colors, and style for personalized AI content.
                    </p>
                    <div className="flex items-center gap-3 mt-3">
                      <Button asChild size="sm">
                        <Link href="/brand">
                          <Sparkles className="h-4 w-4 mr-2" />
                          Configure Brand
                        </Link>
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setShowBrandBanner(false)} className="text-muted-foreground">
                        Later
                      </Button>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setShowBrandBanner(false)} className="shrink-0 text-muted-foreground">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Avatar className="w-11 h-11 ring-2 ring-brand-500/20">
            <AvatarImage src={data?.user.avatarUrl || undefined} />
            <AvatarFallback className="bg-gradient-to-br from-brand-500 to-violet-600 text-white font-bold">
              {data?.user.name?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-bold leading-tight">
              Welcome back, {data?.user.name?.split(" ")[0] || "there"}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {data?.user.plan || "STARTER"}
              </Badge>
              {data?.agentStats && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-violet-500/10 text-violet-600 border-violet-500/20">
                  <Briefcase className="w-2.5 h-2.5 mr-0.5" /> Agent
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs h-8" asChild>
            <Link href="/studio">
              <PenTool className="h-3.5 w-3.5 mr-1.5" />
              Create
            </Link>
          </Button>
          <Button size="sm" className="text-xs h-8" asChild>
            <Link href="/feed">
              <ArrowRight className="h-3.5 w-3.5 mr-1.5" />
              My Feed
            </Link>
          </Button>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div variants={itemVariants} className="grid gap-3 grid-cols-2 sm:grid-cols-4 mb-5">
        <StatCard title="Total Views" value={formatCount(stats.totalViews)} icon={Eye} color="blue" />
        <StatCard title="Engagement" value={formatCount(stats.engagement)} icon={Heart} color="rose" />
        <StatCard title="Followers" value={formatCount(stats.followers)} icon={Users} color="violet" />
        <StatCard title="Earnings" value={`$${stats.earnings.toFixed(2)}`} icon={Sparkles} color="emerald" />
      </motion.div>

      {/* Main Grid: Content + Sidebar */}
      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        {/* Left Column */}
        <div className="space-y-5">
          {/* Agent Stats */}
          {data?.agentStats && (
            <motion.div variants={itemVariants}>
              <Card className="bg-gradient-to-r from-violet-500/5 to-brand-500/5 border-violet-500/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-violet-500/10 flex items-center justify-center">
                      <Briefcase className="h-3.5 w-3.5 text-violet-500" />
                    </div>
                    Agent Dashboard
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ml-auto ${data.agentStats.isApproved ? "bg-green-500/10 text-green-600 border-green-500/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20"}`}>
                      {data.agentStats.status}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-1">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="text-center p-2.5 rounded-lg bg-background/60">
                      <p className="text-base font-bold text-amber-600">{data.agentStats.avgRating > 0 ? `${data.agentStats.avgRating}` : "—"}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Rating</p>
                    </div>
                    <div className="text-center p-2.5 rounded-lg bg-background/60">
                      <p className="text-base font-bold text-violet-600">{data.agentStats.totalClients}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Clients</p>
                    </div>
                    <div className="text-center p-2.5 rounded-lg bg-background/60">
                      <p className="text-base font-bold">{data.agentStats.totalReviews}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Reviews</p>
                    </div>
                    <div className="text-center p-2.5 rounded-lg bg-background/60">
                      <p className="text-base font-bold text-emerald-600">${data.agentStats.totalEarnings}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Earned</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <Button variant="outline" size="sm" className="text-xs h-8" asChild>
                      <Link href="/agent/profile">
                        <Award className="w-3 h-3 mr-1" /> Profile
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs h-8" asChild>
                      <Link href="/agent/clients">
                        <Users className="w-3 h-3 mr-1" /> Clients
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Quick Actions */}
          <motion.div variants={itemVariants} className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            <QuickActionCard icon={PenTool} label="Write Post" href="/studio" color="brand" />
            <QuickActionCard icon={ImageIcon} label="Image Studio" href="/studio" color="purple" />
            <QuickActionCard icon={Palette} label="Brand Kit" href="/brand" color="amber" />
            <QuickActionCard icon={BarChart3} label="Analytics" href="/analytics" color="green" />
          </motion.div>

          {orderedWorkspaceSections.map((sectionId) => {
            const content = workspaceSections[sectionId];
            if (!content) return null;
            return (
              <motion.div variants={itemVariants} key={sectionId}>
                <MovableDashboardSection
                  sectionId={sectionId}
                  label={DASHBOARD_WORKSPACE_LABELS[sectionId]}
                  pinned={pinnedWorkspaceSection === sectionId}
                  onMove={moveWorkspaceSection}
                  onPin={() => toggleWorkspacePin(sectionId)}
                >
                  {content}
                </MovableDashboardSection>
              </motion.div>
            );
          })}

        </div>

        {/* Right Sidebar — Hidden on mobile */}
        <div className="hidden lg:flex lg:flex-col gap-4">
          {/* Sponsored OR Trending Posts */}
          {hasSponsored ? (
            <motion.div variants={itemVariants}>
              <SponsoredSidebar ads={adsWithMedia} promotedPosts={promotedPosts} onPostClick={(postId) => router.push(`/feed#post-${postId}`)} />
            </motion.div>
          ) : trendingPosts.length > 0 ? (
            <motion.div variants={itemVariants}>
              <TrendingPosts posts={trendingPosts} />
            </motion.div>
          ) : null}

          {/* Trending Topics */}
          {data?.sidebar.trendingTopics && data.sidebar.trendingTopics.length > 0 && (
            <motion.div variants={itemVariants}>
              <TrendingTopics
                topics={data.sidebar.trendingTopics}
                onTopicClick={(tag) => router.push(feedTrendHref(tag))}
              />
            </motion.div>
          )}
        </div>
      </div>

      {/* Mobile-only sections */}
      <div className="lg:hidden mt-5 space-y-4">
        {/* Trending Topics — badges on mobile */}
        {data?.sidebar.trendingTopics && data.sidebar.trendingTopics.length > 0 && (
          <motion.div variants={itemVariants}>
            <TrendingTopics
              topics={data.sidebar.trendingTopics}
              variant="badges"
              onTopicClick={(tag) => router.push(feedTrendHref(tag))}
            />
          </motion.div>
        )}

        {/* Sponsored OR Trending Posts */}
        {hasSponsored ? (
          <motion.div variants={itemVariants}>
            <SponsoredSidebar ads={adsWithMedia} promotedPosts={promotedPosts} grid limit={2} onPostClick={(postId) => router.push(`/feed#post-${postId}`)} />
          </motion.div>
        ) : trendingPosts.length > 0 ? (
          <motion.div variants={itemVariants}>
            <TrendingPosts posts={trendingPosts} grid limit={2} />
          </motion.div>
        ) : null}
      </div>

    </motion.div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function MovableDashboardSection({
  sectionId,
  label,
  pinned,
  onMove,
  onPin,
  children,
}: {
  sectionId: DashboardWorkspaceSectionId;
  label: string;
  pinned: boolean;
  onMove: (source: DashboardWorkspaceSectionId, target: DashboardWorkspaceSectionId) => void;
  onPin: () => void;
  children: React.ReactNode;
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div
      className={`rounded-2xl transition ${
        isDragOver ? "ring-2 ring-brand-500/60 ring-offset-2 ring-offset-background" : ""
      }`}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragOver(false);
        const source = event.dataTransfer.getData("application/x-dashboard-section") as DashboardWorkspaceSectionId;
        if (source) onMove(source, sectionId);
      }}
    >
      <div className="mb-2 flex items-center justify-end gap-2">
        <button
          type="button"
          draggable
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("application/x-dashboard-section", sectionId);
          }}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-background px-2.5 text-xs font-medium text-muted-foreground shadow-sm transition hover:border-brand-500/40 hover:text-foreground"
          title={`Drag ${label}`}
        >
          <GripVertical className="h-3.5 w-3.5" />
          Move
        </button>
        <button
          type="button"
          onClick={onPin}
          className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium shadow-sm transition ${
            pinned
              ? "border-brand-500/40 bg-brand-500/10 text-brand-700"
              : "bg-background text-muted-foreground hover:border-brand-500/40 hover:text-foreground"
          }`}
          title={pinned ? `Unpin ${label}` : `Pin ${label} to top`}
        >
          {pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          {pinned ? "Pinned" : "Pin top"}
        </button>
      </div>
      {children}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  color: "blue" | "rose" | "violet" | "emerald";
}) {
  const colorMap = {
    blue: "bg-blue-500/10 text-blue-500",
    rose: "bg-rose-500/10 text-rose-500",
    violet: "bg-violet-500/10 text-violet-500",
    emerald: "bg-emerald-500/10 text-emerald-500",
  };

  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${colorMap[color]}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-base sm:text-lg font-bold leading-none truncate">{value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{title}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Dashboard Post Card ───────────────────────────────────────────────────────

function DashboardPostCard({
  post,
  featured = false,
  onClick,
}: {
  post: DashboardVisualPost;
  featured?: boolean;
  onClick: () => void;
}) {
  const hasVideo = isVideoMedia(post.mediaUrl, post.mediaType);
  const fallbackTitle = post.content || "Post preview";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl border text-left transition-all hover:-translate-y-0.5 hover:border-brand-500/40 hover:shadow-md ${
        featured ? "min-h-[310px]" : "min-h-[148px]"
      }`}
    >
      {post.mediaUrl ? (
        <div className="absolute inset-0 bg-muted">
          {hasVideo ? (
            <video
              src={post.mediaUrl}
              className="h-full w-full object-cover"
              muted
              playsInline
              loop
              autoPlay
              preload="metadata"
              onCanPlay={(event) => {
                event.currentTarget.play().catch(() => undefined);
              }}
            />
          ) : (
            <img
              src={post.mediaUrl}
              alt=""
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              loading="lazy"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/5" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.28),transparent_35%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(88,28,135,0.88),rgba(13,148,136,0.84))]" />
      )}

      <div className="relative flex h-full min-h-[inherit] flex-col justify-between p-4 text-white">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="h-7 w-7 border border-white/30">
              <AvatarImage src={post.authorAvatar || undefined} />
              <AvatarFallback className="bg-white/20 text-[10px] text-white">
                {post.authorName?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">{post.authorName}</p>
              <p className="truncate text-[10px] text-white/70">{post.sourceLabel}</p>
            </div>
          </div>
          {hasVideo ? (
            <span className="rounded-full bg-white/20 p-1.5 backdrop-blur">
              <Play className="h-3.5 w-3.5 fill-white" />
            </span>
          ) : (
            <span className="rounded-full bg-white/20 p-1.5 backdrop-blur">
              <ImageIcon className="h-3.5 w-3.5" />
            </span>
          )}
        </div>

        <div className="space-y-3">
          <p className={`${featured ? "text-xl" : "text-sm"} font-semibold leading-tight line-clamp-3`}>
            {fallbackTitle}
          </p>
          <div className="grid grid-cols-3 gap-2">
            <MetricPill icon={Eye} value={post.views} label="Views" />
            <MetricPill icon={Heart} value={post.likes} label="Likes" />
            <MetricPill icon={MessageCircle} value={post.comments} label="Comments" />
          </div>
        </div>
      </div>
    </button>
  );
}

function PremierVideoShowcase({
  videos,
  onSelect,
}: {
  videos: DashboardPremierVideo[];
  onSelect: (video: DashboardPremierVideo) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeVideo = videos[Math.min(activeIndex, Math.max(videos.length - 1, 0))];

  useEffect(() => {
    setActiveIndex(0);
  }, [videos.length]);

  if (!activeVideo) return null;

  return (
    <Card className="overflow-hidden border-brand-500/20 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(124,58,237,0.14),transparent_36%)]">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600">
              <Play className="h-3.5 w-3.5 fill-current" />
            </span>
            Premier video spotlight
            <Badge variant="secondary" className="text-[10px]">
              {videos.some((video) => !video.source.toLowerCase().includes("flowsmartly")) ? "Client boosted" : "FlowSmartly premier"}
            </Badge>
          </CardTitle>
          <Button
            type="button"
            size="sm"
            className="h-8 bg-brand-500 text-xs text-white hover:bg-brand-600"
            onClick={() => onSelect(activeVideo)}
          >
            {activeVideo.ctaText || "Watch now"}
            <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-1">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_260px]">
          <button
            type="button"
            onClick={() => onSelect(activeVideo)}
            className="group relative min-h-[300px] overflow-hidden rounded-2xl border bg-black text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <video
              key={activeVideo.videoUrl}
              src={activeVideo.videoUrl}
              poster={activeVideo.posterUrl || undefined}
              className="absolute inset-0 h-full w-full object-cover"
              muted
              playsInline
              loop
              autoPlay
              preload="metadata"
              onCanPlay={(event) => {
                event.currentTarget.play().catch(() => undefined);
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/10" />
            <div className="relative flex min-h-[300px] flex-col justify-between p-4 text-white sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar className="h-8 w-8 border border-white/30">
                    <AvatarImage src={activeVideo.authorAvatar || undefined} />
                    <AvatarFallback className="bg-white/20 text-[10px] text-white">
                      {activeVideo.authorName?.charAt(0) || "F"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">{activeVideo.authorName}</p>
                    <p className="truncate text-[10px] text-white/70">{activeVideo.source}</p>
                  </div>
                </div>
                <span className="rounded-full bg-white/20 px-2 py-1 text-[10px] font-semibold backdrop-blur">
                  Premier
                </span>
              </div>
              <div className="max-w-2xl space-y-2">
                <p className="text-2xl font-bold leading-tight sm:text-3xl">{activeVideo.title}</p>
                <p className="line-clamp-2 text-sm text-white/82">{activeVideo.description}</p>
                <div className="flex flex-wrap gap-2 pt-1 text-[11px] text-white/75">
                  {typeof activeVideo.viewCount === "number" && <span>{formatCount(activeVideo.viewCount)} views</span>}
                  {typeof activeVideo.likeCount === "number" && <span>{formatCount(activeVideo.likeCount)} likes</span>}
                  {typeof activeVideo.commentCount === "number" && <span>{formatCount(activeVideo.commentCount)} comments</span>}
                </div>
              </div>
            </div>
          </button>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {videos.slice(0, 4).map((video, index) => (
              <button
                key={video.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`group grid grid-cols-[88px_minmax(0,1fr)] gap-2 rounded-xl border p-2 text-left transition hover:border-brand-500/40 hover:bg-background/70 ${
                  index === activeIndex ? "border-brand-500 bg-background/85 shadow-sm" : "bg-background/55"
                }`}
              >
                <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                  <video
                    src={video.videoUrl}
                    poster={video.posterUrl || undefined}
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                    loop
                    autoPlay
                    preload="metadata"
                  />
                  <span className="absolute inset-0 grid place-items-center bg-black/10 text-white opacity-0 transition group-hover:opacity-100">
                    <Play className="h-4 w-4 fill-current" />
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-xs font-semibold">{video.title}</p>
                  <p className="mt-1 truncate text-[10px] text-muted-foreground">{video.authorName}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function GoogleListingShowcase({
  listing,
  onConnect,
  onOpenListing,
}: {
  listing: DashboardGoogleListing;
  onConnect: () => void;
  onOpenListing: () => void;
}) {
  const connected = listing.connected;
  const score = Math.max(0, Math.min(100, listing.seoHealthScore || 0));
  const displayRating = listing.rating ? listing.rating.toFixed(1) : connected ? "0.0" : "4.8";
  const displayReviews = listing.reviewCount || (connected ? 0 : 128);
  const reviews = listing.reviews.length
    ? listing.reviews.slice(0, 3)
    : [
        {
          id: "preview-1",
          authorName: "Google customer",
          authorAvatarUrl: null,
          rating: 5,
          text: "The service was clear, fast, and easy to trust. This review preview shows what FlowSmartly can monitor once Google is connected.",
          sentiment: "positive",
          reviewUrl: null,
          publishedAt: null,
        },
        {
          id: "preview-2",
          authorName: "Local buyer",
          authorAvatarUrl: null,
          rating: 5,
          text: "Great communication and a professional experience from start to finish.",
          sentiment: "positive",
          reviewUrl: null,
          publishedAt: null,
        },
      ];

  return (
    <Card className="overflow-hidden border-emerald-500/20 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.13),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.12),transparent_34%)]">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <SearchCheck className="h-3.5 w-3.5" />
            </span>
            Google listing and SEO health
            <Badge
              variant="secondary"
              className={`text-[10px] ${connected ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"}`}
            >
              {connected ? "Live profile" : "Preview only"}
            </Badge>
          </CardTitle>
          <Button
            type="button"
            size="sm"
            className="h-8 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
            onClick={connected && listing.listingUrl ? onOpenListing : onConnect}
          >
            {connected && listing.listingUrl ? "Open listing" : "Connect Google"}
            <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-1">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="rounded-2xl border bg-background/78 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-white shadow-sm">
                    <span className="text-lg font-black text-blue-600">G</span>
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold">{listing.businessName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {listing.address || listing.website || "Google Business Profile"}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <div className="rounded-xl bg-amber-500/10 px-3 py-2">
                    <div className="flex items-center gap-1">
                      <span className="text-xl font-bold text-amber-600">{displayRating}</span>
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    </div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {formatCount(displayReviews)} reviews
                    </p>
                  </div>
                  <div className="rounded-xl bg-blue-500/10 px-3 py-2">
                    <p className="text-xl font-bold text-blue-600">{score || (connected ? 0 : 82)}</p>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">SEO health</p>
                  </div>
                  <div className="rounded-xl bg-emerald-500/10 px-3 py-2">
                    <p className="text-xl font-bold text-emerald-600">{listing.coverageScore || (connected ? 0 : 76)}</p>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Coverage</p>
                  </div>
                </div>
              </div>

              <div
                className="grid h-24 w-24 shrink-0 place-items-center rounded-full p-2"
                style={{
                  background: `conic-gradient(rgb(16 185 129) ${(score || (connected ? 0 : 82)) * 3.6}deg, rgb(229 231 235) 0deg)`,
                }}
              >
                <div className="grid h-full w-full place-items-center rounded-full bg-background text-center">
                  <p className="text-lg font-black">{score || (connected ? 0 : 82)}</p>
                  <p className="-mt-1 text-[9px] uppercase text-muted-foreground">score</p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <GoogleMetric icon={ShieldCheck} label="Citations" value={listing.citationScore || (connected ? 0 : 74)} />
              <GoogleMetric icon={SearchCheck} label="Reviews" value={listing.reviewScore || (connected ? 0 : 88)} />
              <GoogleMetric icon={MapPin} label="Consistency" value={listing.consistencyScore || (connected ? 0 : 79)} />
            </div>

            {!connected && (
              <div className="mt-4 rounded-xl border border-dashed border-amber-500/45 bg-amber-500/10 p-3">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  Google Business Profile is not connected yet. These numbers are a preview, not your real stats.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Connect Google to pull your real reviews, listing health, local SEO signals, and monthly visibility recommendations into this space.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-2xl border bg-background/78 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold">Google reviews</p>
                <p className="text-xs text-muted-foreground">
                  {connected ? "Recent customer proof from the connected listing." : "Sample display only until your Google account is connected."}
                </p>
              </div>
              <Quote className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="grid gap-2">
              {reviews.map((review) => (
                <a
                  key={review.id}
                  href={review.reviewUrl || listing.listingUrl || "#"}
                  onClick={(event) => {
                    if (!connected || (!review.reviewUrl && !listing.listingUrl)) event.preventDefault();
                  }}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border bg-background/70 p-3 transition hover:border-emerald-500/40 hover:bg-emerald-500/5"
                >
                  <div className="flex items-start gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={review.authorAvatarUrl || undefined} />
                      <AvatarFallback className="bg-emerald-500/10 text-[10px] text-emerald-700">
                        {review.authorName?.charAt(0) || "G"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-xs font-semibold">{review.authorName}</p>
                        <span className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, index) => (
                            <Star
                              key={index}
                              className={`h-3 w-3 ${index < review.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                            />
                          ))}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {review.text || "Rating-only Google review"}
                      </p>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function GoogleMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl bg-background/80 p-2.5">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-emerald-600" />
        <span className="text-sm font-bold">{Math.round(value)}</span>
      </div>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function MetricPill({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ElementType;
  value: number;
  label: string;
}) {
  return (
    <div className="rounded-xl bg-white/14 px-2 py-1.5 backdrop-blur">
      <div className="flex items-center gap-1">
        <Icon className="h-3 w-3 text-white/75" />
        <span className="text-xs font-bold">{formatCount(value)}</span>
      </div>
      <p className="mt-0.5 text-[9px] uppercase tracking-wide text-white/55">{label}</p>
    </div>
  );
}

// ─── Quick Action Card ────────────────────────────────────────────────────────

function QuickActionCard({
  icon: Icon,
  label,
  href,
  color,
}: {
  icon: React.ElementType;
  label: string;
  href: string;
  color: "brand" | "purple" | "amber" | "green";
}) {
  const colorMap = {
    brand: "bg-brand-500/10 text-brand-600 group-hover:bg-brand-500/20",
    purple: "bg-purple-500/10 text-purple-600 group-hover:bg-purple-500/20",
    amber: "bg-amber-500/10 text-amber-600 group-hover:bg-amber-500/20",
    green: "bg-emerald-500/10 text-emerald-600 group-hover:bg-emerald-500/20",
  };

  return (
    <Link
      href={href}
      className="group flex items-center gap-2.5 p-3 rounded-xl border hover:border-brand-500/30 hover:shadow-sm transition-all"
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${colorMap[color]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-xs font-medium">{label}</span>
    </Link>
  );
}
