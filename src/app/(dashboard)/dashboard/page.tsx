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
  ArrowUpRight,
  ArrowRight,
  FileText,
  Loader2,
  Building2,
  X,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface DashboardData {
  user: {
    name: string;
    plan: string;
    aiCredits: number;
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
}

// Animation variants for staggered children
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

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
    earnings: 0,
    postsCount: 0,
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      {/* Brand Setup Banner */}
      {showBrandBanner && (!data?.brandKit || !data.brandKit.isComplete) && (
        <motion.div variants={itemVariants}>
          <Card className="border-amber-500/50 bg-gradient-to-r from-amber-500/10 to-orange-500/10">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                  <Building2 className="h-6 w-6 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    Set Up Your Brand Identity
                    <Wand2 className="h-4 w-4 text-amber-500" />
                  </h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    Help our AI understand your brand better! Configure your brand voice, colors, and style to get personalized content recommendations that match your unique identity.
                  </p>
                  <div className="flex items-center gap-3 mt-4">
                    <Button asChild size="sm">
                      <Link href="/brand">
                        <Sparkles className="h-4 w-4 mr-2" />
                        Configure Brand
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowBrandBanner(false)}
                      className="text-muted-foreground"
                    >
                      Remind me later
                    </Button>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowBrandBanner(false)}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Welcome Section */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back, {data?.user.name || "User"}! Here&apos;s what&apos;s happening with your content.
          </p>
        </div>
        <Button asChild>
          <Link href="/studio">
            <Sparkles className="h-4 w-4 mr-2" />
            Create Content
          </Link>
        </Button>
      </motion.div>

      {/* Stats Grid */}
      <motion.div variants={itemVariants} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Views"
          value={stats.totalViews.toLocaleString()}
          icon={Eye}
        />
        <StatCard
          title="Engagement"
          value={stats.engagement.toLocaleString()}
          icon={Heart}
        />
        <StatCard
          title="Followers"
          value={stats.followers.toLocaleString()}
          icon={Users}
        />
        <StatCard
          title="Earnings"
          value={`$${stats.earnings.toFixed(2)}`}
          icon={DollarSign}
        />
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick Actions */}
        <motion.div variants={itemVariants} className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <QuickActionButton
                icon={Sparkles}
                label="Generate Post"
                description="Create AI-powered content"
                href="/studio"
                color="brand"
              />
              <QuickActionButton
                icon={FileText}
                label="Brand Identity"
                description="Set up your brand voice"
                href="/brand"
                color="purple"
              />
              <QuickActionButton
                icon={TrendingUp}
                label="View Analytics"
                description="Check your performance"
                href="/analytics"
                color="green"
              />
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Activity */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Recent Posts</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/feed">
                  View all
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {data?.recentActivity && data.recentActivity.length > 0 ? (
                <div className="space-y-4">
                  {data.recentActivity.map((activity, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-brand-500/10">
                        <FileText className="h-5 w-5 text-brand-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{activity.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(activity.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" /> {activity.views}
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart className="h-3 w-3" /> {activity.likes}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" /> {activity.comments}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No posts yet</p>
                  <p className="text-sm">Create your first post in the AI Studio!</p>
                  <Button asChild className="mt-4" size="sm">
                    <Link href="/studio">
                      <Sparkles className="h-4 w-4 mr-2" />
                      Create Post
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* AI Credits Banner */}
      <motion.div variants={itemVariants}>
        <Card className="bg-gradient-to-r from-brand-500 to-accent-purple text-white overflow-hidden">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">
                  AI Credits: {data?.user.aiCredits?.toLocaleString() || 0} remaining
                </h3>
                <p className="text-white/80 text-sm">
                  You&apos;re on the {data?.user.plan || "STARTER"} plan.
                  {data?.user.plan === "STARTER" && " Upgrade for more credits."}
                </p>
              </div>
            </div>
            {data?.user.plan === "STARTER" && (
              <Button variant="secondary" className="bg-white text-brand-600 hover:bg-white/90">
                Upgrade Plan
              </Button>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

// Stat Card Component
function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-brand-500" />
          </div>
        </div>
        <div className="mt-4">
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// Quick Action Button
function QuickActionButton({
  icon: Icon,
  label,
  description,
  href,
  color,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  href: string;
  color: "brand" | "purple" | "green";
}) {
  const colorClasses = {
    brand: "bg-brand-500/10 text-brand-500",
    purple: "bg-accent-purple/10 text-accent-purple",
    green: "bg-success/10 text-success",
  };

  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors group"
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium group-hover:text-brand-500 transition-colors">
          {label}
        </p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-brand-500 group-hover:translate-x-1 transition-all" />
    </Link>
  );
}
