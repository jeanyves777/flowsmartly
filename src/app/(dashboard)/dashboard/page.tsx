"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  TrendingUp,
  Users,
  DollarSign,
  Eye,
  Heart,
  MessageCircle,
  ArrowRight,
  FileText,
  Loader2,
  Building2,
  X,
  Wand2,
  Star,
  Briefcase,
  Award,
  Megaphone,
  ExternalLink,
  Zap,
  BarChart3,
  PenTool,
  Image as ImageIcon,
  Palette,
  Hash,
  Activity,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface SidebarPost {
  id: string;
  content: string;
  mediaUrl: string | null;
  destinationUrl: string | null;
  authorName: string;
  authorAvatar: string | null;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
}

interface SidebarAd {
  id: string;
  name: string;
  headline: string | null;
  description: string | null;
  mediaUrl: string | null;
  destinationUrl: string | null;
  ctaText: string | null;
}

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
    type: string;
    title: string;
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
  sidebar: {
    sponsoredAds: SidebarAd[];
    promotedPosts: SidebarPost[];
    trendingPosts: SidebarPost[];
    trendingTopics: Array<{ tag: string; postCount: number }>;
  };
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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Full-page Loader ─────────────────────────────────────────────────────────

function DashboardLoader() {
  const tips = [
    "Loading your dashboard...",
    "Crunching your numbers...",
    "Fetching latest stats...",
  ];
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((i) => (i + 1) % tips.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [tips.length]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      {/* Logo pulse */}
      <motion.div
        className="relative"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div
          className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-500/30 to-violet-500/30 blur-xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center shadow-lg shadow-brand-500/25">
          <Image src="/logo.svg" alt="FlowSmartly" width={32} height={32} className="invert" />
        </div>
      </motion.div>

      {/* Animated dots */}
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-brand-500"
            animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </div>

      {/* Rotating tips */}
      <AnimatePresence mode="wait">
        <motion.p
          key={tipIndex}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="text-sm text-muted-foreground"
        >
          {tips[tipIndex]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBrandBanner, setShowBrandBanner] = useState(true);
  const [selectedPost, setSelectedPost] = useState<SidebarPost | null>(null);

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

  if (loading) {
    return <DashboardLoader />;
  }

  const stats = data?.stats || {
    totalViews: 0,
    engagement: 0,
    followers: 0,
    following: 0,
    earnings: 0,
    postsCount: 0,
  };

  // Only show ads that have media (images/video), unless they're promoted posts (always show those)
  const adsWithMedia = data?.sidebar.sponsoredAds.filter(ad => ad.mediaUrl) || [];
  const hasSponsored = adsWithMedia.length > 0 || (data?.sidebar.promotedPosts.length || 0) > 0;

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
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-violet-500/30 text-violet-600">
                  <Briefcase className="w-2.5 h-2.5 mr-0.5" /> Agent
                </Badge>
              )}
            </div>
          </div>
        </div>
        <Button asChild size="sm" className="w-full sm:w-auto">
          <Link href="/studio">
            <Sparkles className="h-4 w-4 mr-2" />
            Create Content
          </Link>
        </Button>
      </motion.div>

      {/* Main grid with sidebar */}
      <div className="grid lg:grid-cols-[1fr_300px] gap-6">
        {/* Left Column — Main Content */}
        <div className="space-y-5">
          {/* Stats Grid */}
          <motion.div variants={itemVariants} className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <StatCard title="Total Views" value={formatCount(stats.totalViews)} icon={Eye} color="blue" />
            <StatCard title="Engagement" value={formatCount(stats.engagement)} icon={Heart} color="rose" />
            <StatCard title="Followers" value={formatCount(stats.followers)} icon={Users} color="violet" />
            <StatCard title="Earnings" value={`$${stats.earnings.toFixed(2)}`} icon={DollarSign} color="emerald" />
          </motion.div>

          {/* Agent Stats (if user is an agent) */}
          {data?.agentStats && (
            <motion.div variants={itemVariants}>
              <Card className="border-violet-500/30 bg-gradient-to-r from-violet-500/5 to-purple-500/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-violet-500" />
                    Agent Performance
                    {data.agentStats.isApproved && (
                      <Badge className="bg-green-100 text-green-700 text-[10px] ml-auto">Approved</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="text-center p-2.5 rounded-lg bg-background/60">
                      <div className="flex items-center justify-center gap-1 text-amber-500 mb-0.5">
                        <Star className="w-3.5 h-3.5 fill-amber-500" />
                        <span className="text-base font-bold">{data.agentStats.avgRating || "—"}</span>
                      </div>
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

          {/* Recent Posts + Performance — Side by Side on Desktop, Stacked on Mobile */}
          <motion.div variants={itemVariants} className="grid gap-4 md:grid-cols-2">
            {/* Recent Posts */}
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-brand-500/10 flex items-center justify-center">
                    <FileText className="h-3.5 w-3.5 text-brand-500" />
                  </div>
                  Recent Posts
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-xs h-7 px-2" asChild>
                  <Link href="/feed">
                    View all <ArrowRight className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="pt-1">
                {data?.recentActivity && data.recentActivity.length > 0 ? (
                  <div className="divide-y">
                    {data.recentActivity.slice(0, 4).map((activity, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + index * 0.08 }}
                        className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                      >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-muted shrink-0 text-xs font-bold text-muted-foreground">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate leading-tight">{activity.title}</p>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3" /> {formatCount(activity.views)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Heart className="h-3 w-3" /> {formatCount(activity.likes)}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageCircle className="h-3 w-3" /> {formatCount(activity.comments)}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                          {timeAgo(activity.createdAt)}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No posts yet</p>
                    <Button asChild className="mt-3" size="sm" variant="outline">
                      <Link href="/studio">
                        <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Create Post
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Performance + Credits */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-violet-500/10 flex items-center justify-center">
                    <Activity className="h-3.5 w-3.5 text-violet-500" />
                  </div>
                  Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-1">
                <div className="space-y-1">
                  <PerformanceRow label="Posts" value={stats.postsCount} icon={FileText} color="text-blue-500" />
                  <PerformanceRow label="Views" value={stats.totalViews} icon={Eye} color="text-sky-500" />
                  <PerformanceRow label="Engagement" value={stats.engagement} icon={Heart} color="text-rose-500" />
                  <PerformanceRow label="Followers" value={stats.followers} icon={Users} color="text-violet-500" />
                  <PerformanceRow label="Following" value={stats.following} icon={Users} color="text-indigo-400" />
                </div>

                {/* Credits section */}
                <div className="mt-3 pt-3 border-t space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm flex items-center gap-2 text-muted-foreground">
                      <Sparkles className="w-3.5 h-3.5 text-brand-500" />
                      AI Credits
                    </span>
                    <span className="font-bold text-brand-600 text-sm">{(data?.user.aiCredits || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm flex items-center gap-2 text-muted-foreground">
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      Used This Month
                    </span>
                    <span className="font-bold text-sm">{data?.aiUsage.thisMonth || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Credits Banner */}
          <motion.div variants={itemVariants}>
            <Card className="bg-gradient-to-r from-brand-500 to-accent-purple text-white overflow-hidden">
              <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm sm:text-base">
                      {(data?.user.aiCredits || 0).toLocaleString()} AI Credits
                    </h3>
                    <p className="text-white/80 text-xs sm:text-sm">
                      {data?.user.plan || "STARTER"} plan
                      {data?.user.plan === "STARTER" && " · Upgrade for more"}
                    </p>
                  </div>
                </div>
                <Button variant="secondary" size="sm" className="bg-white text-brand-600 hover:bg-white/90 w-full sm:w-auto" asChild>
                  <Link href={data?.user.plan === "STARTER" ? "/settings/upgrade" : "/buy-credits"}>
                    {data?.user.plan === "STARTER" ? "Upgrade" : "Buy Credits"}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Right Sidebar — Hidden on mobile, scrollable on desktop */}
        <div className="hidden lg:flex lg:flex-col gap-4">
          {/* Sponsored ads — clicking navigates to /feed for view-to-earn */}
          {hasSponsored && (
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center">
                      <Megaphone className="w-3.5 h-3.5 text-amber-500" />
                    </div>
                    <h3 className="font-semibold text-sm">Sponsored</h3>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {adsWithMedia.map((ad) => (
                    <div
                      key={ad.id}
                      className="block border rounded-lg p-2.5 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => router.push("/feed")}
                    >
                      <div className="w-full aspect-video rounded-md overflow-hidden bg-muted mb-2">
                        <img src={ad.mediaUrl!} alt={ad.headline || ad.name} className="w-full h-full object-cover" />
                      </div>
                      <p className="text-sm font-medium line-clamp-1">{ad.headline || ad.name}</p>
                      {ad.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{ad.description}</p>}
                      <span className="text-xs text-brand-500 mt-1 inline-flex items-center gap-1">
                        {ad.ctaText || "Watch & Earn"} <ExternalLink className="w-3 h-3" />
                      </span>
                    </div>
                  ))}
                  {data?.sidebar.promotedPosts.map((post) => (
                    <div
                      key={post.id}
                      className="block border rounded-lg p-2.5 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => router.push("/feed")}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Avatar className="w-5 h-5">
                          <AvatarImage src={post.authorAvatar || undefined} />
                          <AvatarFallback className="text-[8px]">{post.authorName?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-medium truncate">{post.authorName}</span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0 bg-amber-500/10 text-amber-600 border-amber-500/20 ml-auto">Boosted</Badge>
                      </div>
                      {post.mediaUrl && (
                        <div className="w-full aspect-video rounded-md overflow-hidden bg-muted mb-2">
                          <img src={post.mediaUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                        </div>
                      )}
                      <p className="text-xs line-clamp-2">{post.content}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Trending posts — only show when NO sponsored content */}
          {!hasSponsored && data?.sidebar.trendingPosts && data.sidebar.trendingPosts.length > 0 && (
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-brand-500/10 flex items-center justify-center">
                      <TrendingUp className="w-3.5 h-3.5 text-brand-500" />
                    </div>
                    <h3 className="font-semibold text-sm">Trending Posts</h3>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {data.sidebar.trendingPosts.map((post, i) => (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 + i * 0.1 }}
                      className="border rounded-lg p-2.5 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setSelectedPost(post)}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Avatar className="w-5 h-5">
                          <AvatarImage src={post.authorAvatar || undefined} />
                          <AvatarFallback className="text-[8px]">{post.authorName?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-medium truncate">{post.authorName}</span>
                      </div>
                      {post.mediaUrl && (
                        <div className="w-full aspect-video rounded-md overflow-hidden bg-muted mb-2">
                          <img src={post.mediaUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                        </div>
                      )}
                      <p className="text-xs line-clamp-2">{post.content}</p>
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" /> {formatCount(post.viewCount || 0)}</span>
                        <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" /> {formatCount(post.likeCount || 0)}</span>
                        <span className="flex items-center gap-0.5"><MessageCircle className="w-3 h-3" /> {formatCount(post.commentCount || 0)}</span>
                      </div>
                    </motion.div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Trending Topics — Redesigned */}
          {data?.sidebar.trendingTopics && data.sidebar.trendingTopics.length > 0 && (
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-violet-500/10 flex items-center justify-center">
                      <Hash className="w-3.5 h-3.5 text-violet-500" />
                    </div>
                    <h3 className="font-semibold text-sm">Trending Topics</h3>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-1.5">
                    {data.sidebar.trendingTopics.map((topic, i) => {
                      // Find max postCount for relative bar width
                      const maxCount = Math.max(...data.sidebar.trendingTopics.map(t => t.postCount), 1);
                      const barWidth = Math.max((topic.postCount / maxCount) * 100, 12);
                      const colors = [
                        "from-brand-500/20 to-brand-500/5",
                        "from-violet-500/20 to-violet-500/5",
                        "from-blue-500/20 to-blue-500/5",
                        "from-emerald-500/20 to-emerald-500/5",
                        "from-amber-500/20 to-amber-500/5",
                      ];
                      const textColors = [
                        "text-brand-600",
                        "text-violet-600",
                        "text-blue-600",
                        "text-emerald-600",
                        "text-amber-600",
                      ];

                      return (
                        <motion.div
                          key={topic.tag}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.5 + i * 0.08 }}
                          className="relative rounded-lg overflow-hidden"
                        >
                          {/* Background bar */}
                          <motion.div
                            className={`absolute inset-y-0 left-0 bg-gradient-to-r ${colors[i % colors.length]} rounded-lg`}
                            initial={{ width: 0 }}
                            animate={{ width: `${barWidth}%` }}
                            transition={{ duration: 0.6, delay: 0.6 + i * 0.1, ease: "easeOut" }}
                          />
                          <div className="relative flex items-center justify-between px-3 py-2.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`text-xs font-bold ${textColors[i % textColors.length]} w-4 shrink-0`}>
                                {i + 1}
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{topic.tag}</p>
                              </div>
                            </div>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0 ml-2">
                              {topic.postCount} {topic.postCount === 1 ? "post" : "posts"}
                            </Badge>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>

      {/* Mobile-only: Trending Topics (shown below main content on small screens) */}
      <div className="lg:hidden mt-5 space-y-4">
        {data?.sidebar.trendingTopics && data.sidebar.trendingTopics.length > 0 && (
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-violet-500/10 flex items-center justify-center">
                    <Hash className="w-3.5 h-3.5 text-violet-500" />
                  </div>
                  <h3 className="font-semibold text-sm">Trending Topics</h3>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2">
                  {data.sidebar.trendingTopics.map((topic, i) => {
                    const colors = [
                      "bg-brand-500/10 text-brand-600 border-brand-500/20",
                      "bg-violet-500/10 text-violet-600 border-violet-500/20",
                      "bg-blue-500/10 text-blue-600 border-blue-500/20",
                      "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
                      "bg-amber-500/10 text-amber-600 border-amber-500/20",
                    ];
                    return (
                      <motion.div
                        key={topic.tag}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 + i * 0.06 }}
                      >
                        <Badge variant="outline" className={`${colors[i % colors.length]} px-2.5 py-1 text-xs font-medium`}>
                          <Hash className="w-3 h-3 mr-0.5" />
                          {topic.tag}
                          <span className="ml-1.5 text-[10px] opacity-70">{topic.postCount}</span>
                        </Badge>
                      </motion.div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Mobile: Sponsored — link to feed */}
        {hasSponsored && (
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center">
                    <Megaphone className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                  <h3 className="font-semibold text-sm">Sponsored</h3>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {adsWithMedia.slice(0, 2).map((ad) => (
                    <div
                      key={ad.id}
                      className="border rounded-lg p-2.5 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => router.push("/feed")}
                    >
                      <div className="w-full aspect-video rounded-md overflow-hidden bg-muted mb-2">
                        <img src={ad.mediaUrl!} alt={ad.headline || ad.name} className="w-full h-full object-cover" />
                      </div>
                      <p className="text-sm font-medium line-clamp-1">{ad.headline || ad.name}</p>
                      {ad.description && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{ad.description}</p>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Mobile: Trending Posts — only when no sponsored */}
        {!hasSponsored && data?.sidebar.trendingPosts && data.sidebar.trendingPosts.length > 0 && (
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-brand-500/10 flex items-center justify-center">
                    <TrendingUp className="w-3.5 h-3.5 text-brand-500" />
                  </div>
                  <h3 className="font-semibold text-sm">Trending Posts</h3>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.sidebar.trendingPosts.slice(0, 2).map((post) => (
                    <div
                      key={post.id}
                      className="border rounded-lg p-2.5 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => setSelectedPost(post)}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Avatar className="w-5 h-5">
                          <AvatarImage src={post.authorAvatar || undefined} />
                          <AvatarFallback className="text-[8px]">{post.authorName?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-medium truncate">{post.authorName}</span>
                      </div>
                      {post.mediaUrl && (
                        <div className="w-full aspect-video rounded-md overflow-hidden bg-muted mb-2">
                          <img src={post.mediaUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                        </div>
                      )}
                      <p className="text-xs line-clamp-2">{post.content}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" /> {formatCount(post.viewCount || 0)}</span>
                        <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" /> {formatCount(post.likeCount || 0)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      {/* Post Detail Modal */}
      <Dialog open={!!selectedPost} onOpenChange={() => setSelectedPost(null)}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          {selectedPost && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
            >
              {/* Media */}
              {selectedPost.mediaUrl && (
                <div className="w-full aspect-video bg-muted">
                  <img
                    src={selectedPost.mediaUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Content */}
              <div className="p-5 space-y-4">
                {/* Author */}
                <div className="flex items-center gap-3">
                  <Avatar className="w-9 h-9">
                    <AvatarImage src={selectedPost.authorAvatar || undefined} />
                    <AvatarFallback className="text-sm font-semibold bg-gradient-to-br from-brand-500 to-violet-600 text-white">
                      {selectedPost.authorName?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-sm">{selectedPost.authorName}</p>
                    <p className="text-xs text-muted-foreground">Post</p>
                  </div>
                </div>

                {/* Caption */}
                {selectedPost.content && (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{selectedPost.content}</p>
                )}

                {/* Stats */}
                <div className="flex items-center gap-4 pt-3 border-t">
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Eye className="h-4 w-4" />
                    <span>{formatCount(selectedPost.viewCount || 0)} views</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Heart className="h-4 w-4" />
                    <span>{formatCount(selectedPost.likeCount || 0)} likes</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MessageCircle className="h-4 w-4" />
                    <span>{formatCount(selectedPost.commentCount || 0)}</span>
                  </div>
                </div>

                {/* View in Feed button */}
                <Button className="w-full" size="sm" asChild>
                  <Link href="/feed">
                    <ArrowRight className="h-4 w-4 mr-2" />
                    View in Feed
                  </Link>
                </Button>
              </div>
            </motion.div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

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
    brand: "bg-brand-500/10 text-brand-500 group-hover:bg-brand-500/20",
    purple: "bg-purple-500/10 text-purple-500 group-hover:bg-purple-500/20",
    amber: "bg-amber-500/10 text-amber-500 group-hover:bg-amber-500/20",
    green: "bg-green-500/10 text-green-500 group-hover:bg-green-500/20",
  };

  return (
    <Link
      href={href}
      className="group flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl border hover:border-brand-500/30 hover:shadow-sm transition-all text-center"
    >
      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center transition-colors ${colorMap[color]}`}>
        <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
      </div>
      <p className="text-xs font-medium">{label}</p>
    </Link>
  );
}

// ─── Performance Row ──────────────────────────────────────────────────────────

function PerformanceRow({
  label,
  value,
  icon: Icon,
  color = "text-muted-foreground",
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-muted-foreground flex items-center gap-2">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        {label}
      </span>
      <span className="font-semibold text-sm">{formatCount(value)}</span>
    </div>
  );
}
