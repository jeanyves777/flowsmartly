"use client";

import { useEffect, useState } from "react";
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
  Star,
  Briefcase,
  Award,
  Zap,
  BarChart3,
  PenTool,
  Image as ImageIcon,
  Palette,
  Activity,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { TrendingTopics, type TrendingTopic } from "@/components/shared/trending-topics";
import { SponsoredSidebar, type SponsoredAd, type PromotedPost } from "@/components/shared/sponsored-sidebar";
import { TrendingPosts, type TrendingPost } from "@/components/shared/trending-posts";

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
    sponsoredAds: SponsoredAd[];
    promotedPosts: SidebarPost[];
    trendingPosts: SidebarPost[];
    trendingTopics: TrendingTopic[];
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

  // Only show ads that have media
  const adsWithMedia = data?.sidebar.sponsoredAds.filter(ad => ad.mediaUrl) || [];
  const hasSponsored = adsWithMedia.length > 0 || (data?.sidebar.promotedPosts.length || 0) > 0;

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

          {/* Recent Posts — Full width */}
          <motion.div variants={itemVariants}>
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
                    {data.recentActivity.slice(0, 5).map((activity, index) => (
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
          </motion.div>

          {/* Overview — Full width */}
          <motion.div variants={itemVariants}>
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
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <OverviewItem label="Posts" value={stats.postsCount} icon={FileText} color="text-blue-500" />
                  <OverviewItem label="Views" value={stats.totalViews} icon={Eye} color="text-sky-500" />
                  <OverviewItem label="Engagement" value={stats.engagement} icon={Heart} color="text-rose-500" />
                  <OverviewItem label="Followers" value={stats.followers} icon={Users} color="text-violet-500" />
                  <OverviewItem label="Following" value={stats.following} icon={Users} color="text-indigo-400" />
                </div>

                {/* Credits section */}
                <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-brand-500 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">AI Credits</p>
                      <p className="font-bold text-brand-600">{(data?.user.aiCredits || 0).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Used This Month</p>
                      <p className="font-bold">{data?.aiUsage.thisMonth || 0}</p>
                    </div>
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

        {/* Right Sidebar — Hidden on mobile */}
        <div className="hidden lg:flex lg:flex-col gap-4">
          {/* Sponsored OR Trending Posts */}
          {hasSponsored ? (
            <motion.div variants={itemVariants}>
              <SponsoredSidebar ads={adsWithMedia} promotedPosts={promotedPosts} />
            </motion.div>
          ) : trendingPosts.length > 0 ? (
            <motion.div variants={itemVariants}>
              <TrendingPosts
                posts={trendingPosts}
                onPostClick={(post) => setSelectedPost({
                  id: post.id,
                  content: post.content,
                  mediaUrl: post.mediaUrl,
                  destinationUrl: null,
                  authorName: post.authorName,
                  authorAvatar: post.authorAvatar,
                  viewCount: post.viewCount,
                  likeCount: post.likeCount,
                  commentCount: post.commentCount,
                })}
              />
            </motion.div>
          ) : null}

          {/* Trending Topics */}
          {data?.sidebar.trendingTopics && data.sidebar.trendingTopics.length > 0 && (
            <motion.div variants={itemVariants}>
              <TrendingTopics topics={data.sidebar.trendingTopics} />
            </motion.div>
          )}
        </div>
      </div>

      {/* Mobile-only sections */}
      <div className="lg:hidden mt-5 space-y-4">
        {/* Trending Topics — badges on mobile */}
        {data?.sidebar.trendingTopics && data.sidebar.trendingTopics.length > 0 && (
          <motion.div variants={itemVariants}>
            <TrendingTopics topics={data.sidebar.trendingTopics} variant="badges" />
          </motion.div>
        )}

        {/* Sponsored OR Trending Posts */}
        {hasSponsored ? (
          <motion.div variants={itemVariants}>
            <SponsoredSidebar ads={adsWithMedia} promotedPosts={promotedPosts} grid limit={2} />
          </motion.div>
        ) : trendingPosts.length > 0 ? (
          <motion.div variants={itemVariants}>
            <TrendingPosts
              posts={trendingPosts}
              grid
              limit={2}
              onPostClick={(post) => setSelectedPost({
                id: post.id,
                content: post.content,
                mediaUrl: post.mediaUrl,
                destinationUrl: null,
                authorName: post.authorName,
                authorAvatar: post.authorAvatar,
                viewCount: post.viewCount,
                likeCount: post.likeCount,
                commentCount: post.commentCount,
              })}
            />
          </motion.div>
        ) : null}
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
              {selectedPost.mediaUrl && (
                <div className="w-full aspect-video bg-muted">
                  <img
                    src={selectedPost.mediaUrl}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              )}
              <div className="p-5 space-y-4">
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
                {selectedPost.content && (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{selectedPost.content}</p>
                )}
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

// ─── Overview Item ─────────────────────────────────────────────────────────────

function OverviewItem({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
      <Icon className={`h-4 w-4 shrink-0 ${color}`} />
      <div className="min-w-0">
        <p className="text-sm font-bold leading-tight">{formatCount(value)}</p>
        <p className="text-[10px] text-muted-foreground">{label}</p>
      </div>
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
