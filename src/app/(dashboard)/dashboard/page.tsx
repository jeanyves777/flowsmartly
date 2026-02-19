"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
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
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

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
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBrandBanner, setShowBrandBanner] = useState(true);

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
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const stats = data?.stats || {
    totalViews: 0,
    engagement: 0,
    followers: 0,
    following: 0,
    earnings: 0,
    postsCount: 0,
  };

  const hasSponsored = (data?.sidebar.sponsoredAds.length || 0) > 0 || (data?.sidebar.promotedPosts.length || 0) > 0;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* Brand Setup Banner */}
      {showBrandBanner && (!data?.brandKit || !data.brandKit.isComplete) && (
        <motion.div variants={itemVariants} className="mb-6">
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

      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10">
            <AvatarImage src={data?.user.avatarUrl || undefined} />
            <AvatarFallback>{data?.user.name?.charAt(0) || "U"}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-bold">Welcome back, {data?.user.name?.split(" ")[0] || "there"}</h1>
            <p className="text-sm text-muted-foreground">
              {data?.user.plan || "STARTER"} Plan
              {data?.agentStats ? " · Agent" : ""}
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href="/studio">
            <Sparkles className="h-4 w-4 mr-2" />
            Create Content
          </Link>
        </Button>
      </motion.div>

      {/* Main grid with sidebar */}
      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        {/* Left Column — Main Content */}
        <div className="space-y-6">
          {/* Stats Grid */}
          <motion.div variants={itemVariants} className="grid gap-3 grid-cols-2 lg:grid-cols-4">
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
                  <CardTitle className="text-base flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-violet-500" />
                    Agent Performance
                    {data.agentStats.isApproved && (
                      <Badge className="bg-green-100 text-green-700 text-[10px]">Approved</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="text-center p-3 rounded-lg bg-background/60">
                      <div className="flex items-center justify-center gap-1 text-amber-500 mb-1">
                        <Star className="w-4 h-4 fill-amber-500" />
                        <span className="text-lg font-bold">{data.agentStats.avgRating || "—"}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Rating</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-background/60">
                      <p className="text-lg font-bold text-violet-600">{data.agentStats.totalClients}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Clients</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-background/60">
                      <p className="text-lg font-bold">{data.agentStats.totalReviews}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Reviews</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-background/60">
                      <p className="text-lg font-bold text-emerald-600">
                        ${data.agentStats.totalEarnings}
                      </p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Earned</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/agent/profile">
                        <Award className="w-3.5 h-3.5 mr-1.5" />
                        Agent Profile
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/agent/clients">
                        <Users className="w-3.5 h-3.5 mr-1.5" />
                        My Clients
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Quick Actions + Content Stats */}
          <motion.div variants={itemVariants} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <QuickActionCard
              icon={PenTool}
              label="Write Post"
              href="/studio"
              color="brand"
            />
            <QuickActionCard
              icon={ImageIcon}
              label="Image Studio"
              href="/studio"
              color="purple"
            />
            <QuickActionCard
              icon={Palette}
              label="Brand Kit"
              href="/brand"
              color="amber"
            />
            <QuickActionCard
              icon={BarChart3}
              label="Analytics"
              href="/analytics"
              color="green"
            />
          </motion.div>

          {/* Content Overview */}
          <motion.div variants={itemVariants} className="grid gap-4 sm:grid-cols-2">
            {/* Recent Posts */}
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Recent Posts</CardTitle>
                <Button variant="ghost" size="sm" className="text-xs" asChild>
                  <Link href="/feed">
                    View all <ArrowRight className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                {data?.recentActivity && data.recentActivity.length > 0 ? (
                  <div className="space-y-2">
                    {data.recentActivity.slice(0, 4).map((activity, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-brand-500/10 shrink-0">
                          <FileText className="h-4 w-4 text-brand-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{activity.title}</p>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                            <span className="flex items-center gap-0.5"><Eye className="h-2.5 w-2.5" /> {activity.views}</span>
                            <span className="flex items-center gap-0.5"><Heart className="h-2.5 w-2.5" /> {activity.likes}</span>
                            <span className="flex items-center gap-0.5"><MessageCircle className="h-2.5 w-2.5" /> {activity.comments}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No posts yet</p>
                    <Button asChild className="mt-3" size="sm" variant="outline">
                      <Link href="/studio">
                        <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                        Create Post
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Performance Summary */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Performance</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <PerformanceRow label="Posts" value={stats.postsCount} icon={FileText} />
                  <PerformanceRow label="Views" value={stats.totalViews} icon={Eye} />
                  <PerformanceRow label="Likes + Comments" value={stats.engagement} icon={Heart} />
                  <PerformanceRow label="Followers" value={stats.followers} icon={Users} />
                  <PerformanceRow label="Following" value={stats.following} icon={Users} />
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-sm flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-brand-500" />
                        AI Credits
                      </span>
                      <span className="font-bold text-brand-600">{(data?.user.aiCredits || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-500" />
                        AI Used This Month
                      </span>
                      <span className="font-bold">{data?.aiUsage.thisMonth || 0}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Credits Banner */}
          <motion.div variants={itemVariants}>
            <Card className="bg-gradient-to-r from-brand-500 to-accent-purple text-white overflow-hidden">
              <CardContent className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">
                      {(data?.user.aiCredits || 0).toLocaleString()} AI Credits
                    </h3>
                    <p className="text-white/80 text-sm">
                      {data?.user.plan || "STARTER"} plan
                      {data?.user.plan === "STARTER" && " · Upgrade for more"}
                    </p>
                  </div>
                </div>
                <Button variant="secondary" size="sm" className="bg-white text-brand-600 hover:bg-white/90" asChild>
                  <Link href={data?.user.plan === "STARTER" ? "/settings/upgrade" : "/buy-credits"}>
                    {data?.user.plan === "STARTER" ? "Upgrade" : "Buy Credits"}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4 hidden lg:block">
          {/* Sponsored / Trending Posts */}
          {hasSponsored ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-amber-500" />
                  <h3 className="font-semibold text-sm">Sponsored</h3>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {data?.sidebar.sponsoredAds.map((ad) => {
                  const Wrapper = ad.destinationUrl ? "a" : "div";
                  const linkProps = ad.destinationUrl ? { href: ad.destinationUrl, target: "_blank" as const, rel: "noopener noreferrer" } : {};
                  return (
                    <Wrapper key={ad.id} {...linkProps} className="block border rounded-lg p-3 hover:bg-muted/30 transition-colors cursor-pointer">
                      {ad.mediaUrl && (
                        <div className="w-full aspect-video rounded-lg overflow-hidden bg-muted mb-2">
                          <img src={ad.mediaUrl} alt={ad.headline || ad.name} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <p className="text-sm font-medium line-clamp-1">{ad.headline || ad.name}</p>
                      {ad.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{ad.description}</p>}
                      {ad.destinationUrl && (
                        <span className="text-xs text-brand-500 mt-1 inline-flex items-center gap-1">
                          {ad.ctaText || "Learn more"} <ExternalLink className="w-3 h-3" />
                        </span>
                      )}
                    </Wrapper>
                  );
                })}
                {data?.sidebar.promotedPosts.map((post) => {
                  const Wrapper = post.destinationUrl ? "a" : "div";
                  const linkProps = post.destinationUrl ? { href: post.destinationUrl, target: "_blank" as const, rel: "noopener noreferrer" } : {};
                  return (
                    <Wrapper key={post.id} {...linkProps} className="block border rounded-lg p-3 hover:bg-muted/30 transition-colors cursor-pointer">
                      <div className="flex items-center gap-2 mb-2">
                        <Avatar className="w-5 h-5">
                          <AvatarImage src={post.authorAvatar || undefined} />
                          <AvatarFallback className="text-[8px]">{post.authorName?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-medium truncate">{post.authorName}</span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0 bg-amber-500/10 text-amber-600 border-amber-500/20 ml-auto">Boosted</Badge>
                      </div>
                      {post.mediaUrl && (
                        <div className="w-full aspect-video rounded-lg overflow-hidden bg-muted mb-2">
                          <img src={post.mediaUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                        </div>
                      )}
                      <p className="text-xs line-clamp-2">{post.content}</p>
                    </Wrapper>
                  );
                })}
              </CardContent>
            </Card>
          ) : data?.sidebar.trendingPosts && data.sidebar.trendingPosts.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-brand-500" />
                  <h3 className="font-semibold text-sm">Trending Posts</h3>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {data.sidebar.trendingPosts.map((post) => (
                  <div key={post.id} className="border rounded-lg p-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <Avatar className="w-5 h-5">
                        <AvatarImage src={post.authorAvatar || undefined} />
                        <AvatarFallback className="text-[8px]">{post.authorName?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-medium truncate">{post.authorName}</span>
                    </div>
                    {post.mediaUrl && (
                      <div className="w-full aspect-video rounded-lg overflow-hidden bg-muted mb-2">
                        <img src={post.mediaUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                      </div>
                    )}
                    <p className="text-xs line-clamp-2">{post.content}</p>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" /> {post.viewCount}</span>
                      <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" /> {post.likeCount}</span>
                      <span className="flex items-center gap-0.5"><MessageCircle className="w-3 h-3" /> {post.commentCount}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {/* Trending Topics */}
          {data?.sidebar.trendingTopics && data.sidebar.trendingTopics.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-brand-500" />
                  <h3 className="font-semibold text-sm">Trending Topics</h3>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {data.sidebar.trendingTopics.map((topic, i) => (
                    <div key={topic.tag} className="flex items-center justify-between py-1.5">
                      <div>
                        <p className="text-sm font-medium">{topic.tag}</p>
                        <p className="text-[10px] text-muted-foreground">{topic.postCount} posts</p>
                      </div>
                      <span className="text-xs text-muted-foreground">#{i + 1}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Links */}
          <Card>
            <CardHeader className="pb-3">
              <h3 className="font-semibold text-sm">Quick Links</h3>
            </CardHeader>
            <CardContent className="pt-0 space-y-1">
              {[
                { label: "Feed", href: "/feed", icon: FileText },
                { label: "Content Automation", href: "/content/posts", icon: Zap },
                { label: "Image Studio", href: "/studio", icon: ImageIcon },
                { label: "Buy Credits", href: "/buy-credits", icon: Sparkles },
                { label: "Settings", href: "/settings", icon: Building2 },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                >
                  <link.icon className="w-4 h-4" />
                  {link.label}
                  <ArrowRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100" />
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}

// Stat Card with color
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
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-lg font-bold leading-none">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{title}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Quick Action Card
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
      className="group flex flex-col items-center gap-2 p-4 rounded-xl border hover:border-brand-500/30 hover:shadow-sm transition-all text-center"
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${colorMap[color]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-xs font-medium">{label}</p>
    </Link>
  );
}

// Performance Row
function PerformanceRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground flex items-center gap-2">
        <Icon className="w-4 h-4" />
        {label}
      </span>
      <span className="font-semibold">{formatCount(value)}</span>
    </div>
  );
}
