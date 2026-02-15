"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  ArrowLeft,
  Star,
  Users,
  DollarSign,
  Loader2,
  Briefcase,
  Globe,
  CheckCircle,
  ExternalLink,
  TrendingUp,
  Calendar,
  Shield,
  Sparkles,
  Heart,
  Award,
  Target,
  BarChart3,
  MessageSquare,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";

interface AgentDetail {
  id: string;
  displayName: string;
  bio: string | null;
  specialties: string[];
  industries: string[];
  portfolioUrls: string[];
  minPricePerMonth: number;
  performanceScore: number;
  clientCount: number;
  completedClients: number;
  approvedAt: string;
  user: {
    id: string;
    name: string;
    avatarUrl: string | null;
    bio: string | null;
    website: string | null;
    createdAt: string;
  };
}

function RatingStars({ score, size = "md" }: { score: number; size?: "sm" | "md" | "lg" }) {
  const stars = Math.round(score / 20);
  const sizeClass = size === "lg" ? "h-5 w-5" : size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${sizeClass} ${
            i <= stars ? "fill-amber-400 text-amber-400" : "fill-muted text-muted"
          }`}
        />
      ))}
    </div>
  );
}

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#94a3b8";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={4}
          className="text-muted/20"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - progress }}
          transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold" style={{ color }}>{score}</span>
        <span className="text-[10px] text-muted-foreground">score</span>
      </div>
    </div>
  );
}

function ProfileBannerSVG() {
  return (
    <svg viewBox="0 0 800 200" fill="none" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
      <rect width="800" height="200" fill="url(#bannerGrad)" />
      <motion.circle cx="100" cy="100" r="60" fill="white" fillOpacity="0.03"
        animate={{ r: [60, 70, 60] }} transition={{ duration: 4, repeat: Infinity }} />
      <motion.circle cx="700" cy="80" r="40" fill="white" fillOpacity="0.03"
        animate={{ r: [40, 50, 40] }} transition={{ duration: 3, repeat: Infinity, delay: 1 }} />
      <motion.circle cx="400" cy="150" r="80" fill="white" fillOpacity="0.02"
        animate={{ r: [80, 90, 80] }} transition={{ duration: 5, repeat: Infinity, delay: 0.5 }} />
      {/* Decorative dots */}
      {[150, 250, 350, 450, 550, 650].map((x, i) => (
        <motion.circle key={x} cx={x} cy={30 + (i % 3) * 20} r="2" fill="white" fillOpacity="0.15"
          animate={{ opacity: [0.15, 0.3, 0.15] }}
          transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }} />
      ))}
      <defs>
        <linearGradient id="bannerGrad" x1="0" y1="0" x2="800" y2="200" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7c3aed" />
          <stop offset="0.5" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#6d28d9" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const agentId = params.agentId as string;

  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [relationship, setRelationship] = useState<{
    id: string;
    status: string;
    monthlyPriceCents: number;
    startDate: string;
  } | null>(null);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isHiring, setIsHiring] = useState(false);

  useEffect(() => {
    const fetchAgent = async () => {
      try {
        const res = await fetch(`/api/marketplace/agents/${agentId}`);
        const data = await res.json();

        if (data.success) {
          setAgent(data.data.agent);
          setRelationship(data.data.relationship);
          setIsOwnProfile(data.data.isOwnProfile);
        } else {
          router.push("/hire-agent");
        }
      } catch {
        router.push("/hire-agent");
      }
      setIsLoading(false);
    };
    fetchAgent();
  }, [agentId, router]);

  const handleHire = async () => {
    setIsHiring(true);
    try {
      const res = await fetch("/api/marketplace/hire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });
      const data = await res.json();

      if (data.success) {
        setRelationship({
          id: data.data.client.id,
          status: "ACTIVE",
          monthlyPriceCents: data.data.client.monthlyPriceCents,
          startDate: data.data.client.startDate,
        });
        toast({
          title: "Agent Hired!",
          description: `You've successfully hired ${agent?.displayName}. They can now manage your account.`,
        });
      } else {
        toast({
          title: "Error",
          description: data.error?.message || "Failed to hire agent",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "An error occurred. Please try again.",
        variant: "destructive",
      });
    }
    setIsHiring(false);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        >
          <Loader2 className="h-8 w-8 text-violet-500" />
        </motion.div>
        <p className="text-sm text-muted-foreground">Loading agent profile...</p>
      </div>
    );
  }

  if (!agent) return null;

  const totalClients = agent.clientCount + agent.completedClients;
  const scoreLabel = agent.performanceScore >= 80 ? "Excellent" : agent.performanceScore >= 60 ? "Good" : "New";

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
        <Link href="/hire-agent">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to Marketplace
          </Button>
        </Link>
      </motion.div>

      {/* Profile Header Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="overflow-hidden">
          {/* Banner */}
          <div className="h-32 md:h-40 relative overflow-hidden">
            <ProfileBannerSVG />
            {agent.performanceScore >= 80 && (
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5, type: "spring" }}
                className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm text-white text-sm font-medium"
              >
                <Award className="h-4 w-4" />
                Top Performer
              </motion.div>
            )}
          </div>

          <CardContent className="p-6 md:p-8 -mt-12 relative">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Avatar */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
              >
                <Avatar className="h-24 w-24 ring-4 ring-background shadow-xl">
                  <AvatarImage src={agent.user.avatarUrl || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-white font-bold text-3xl">
                    {agent.displayName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              </motion.div>

              {/* Info */}
              <div className="flex-1">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div>
                    <motion.h1
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="text-2xl md:text-3xl font-bold flex items-center gap-2"
                    >
                      {agent.displayName}
                      {agent.performanceScore >= 80 && (
                        <CheckCircle className="h-6 w-6 text-emerald-500" />
                      )}
                    </motion.h1>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.35 }}
                      className="text-muted-foreground mt-1"
                    >
                      {agent.user.name}
                    </motion.p>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="flex items-center gap-3 mt-2"
                    >
                      <RatingStars score={agent.performanceScore} size="md" />
                      <span className="text-sm text-muted-foreground">
                        {scoreLabel} ({agent.performanceScore}/100)
                      </span>
                    </motion.div>
                  </div>

                  {/* CTA */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 }}
                    className="flex flex-col items-end gap-2"
                  >
                    <div className="text-right mb-1">
                      <p className="text-2xl font-bold text-violet-600">
                        ${(agent.minPricePerMonth / 100).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">per month (starting)</p>
                    </div>
                    {isOwnProfile ? (
                      <Badge variant="secondary" className="text-sm px-4 py-1.5">
                        <Briefcase className="h-3.5 w-3.5 mr-1.5" />
                        This is your profile
                      </Badge>
                    ) : relationship ? (
                      <Badge className="text-sm px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600">
                        <Heart className="h-3.5 w-3.5 mr-1.5 fill-current" />
                        {relationship.status === "ACTIVE" ? "Currently Hired" : relationship.status}
                      </Badge>
                    ) : (
                      <Button
                        size="lg"
                        className="bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-500/20"
                        onClick={handleHire}
                        disabled={isHiring}
                      >
                        {isHiring ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Hiring...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Hire This Agent
                          </>
                        )}
                      </Button>
                    )}
                  </motion.div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        {[
          {
            icon: Users,
            label: "Active Clients",
            value: agent.clientCount.toString(),
            color: "text-blue-600",
            bg: "bg-blue-500/10",
          },
          {
            icon: CheckCircle,
            label: "Completed Projects",
            value: agent.completedClients.toString(),
            color: "text-emerald-600",
            bg: "bg-emerald-500/10",
          },
          {
            icon: TrendingUp,
            label: "Performance",
            value: `${agent.performanceScore}%`,
            color: "text-amber-600",
            bg: "bg-amber-500/10",
          },
          {
            icon: Calendar,
            label: "Agent Since",
            value: agent.approvedAt ? format(new Date(agent.approvedAt), "MMM yyyy") : "New",
            color: "text-violet-600",
            bg: "bg-violet-500/10",
          },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + i * 0.08 }}
          >
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-lg font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          {/* About */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-violet-500" />
                  About
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {agent.bio || "This agent hasn't added a bio yet."}
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Specialties */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4 text-violet-500" />
                  Specialties
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {agent.specialties.map((s, i) => (
                    <motion.div
                      key={s}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.6 + i * 0.05 }}
                    >
                      <Badge className="bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-200/50 hover:bg-violet-500/20 px-3 py-1.5 text-sm">
                        {s}
                      </Badge>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Industries */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-violet-500" />
                  Industries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {agent.industries.map((ind, i) => (
                    <motion.div
                      key={ind}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.65 + i * 0.05 }}
                      className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 text-sm"
                    >
                      <Globe className="h-4 w-4 text-brand-500 shrink-0" />
                      {ind}
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Portfolio */}
          {agent.portfolioUrls.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ExternalLink className="h-4 w-4 text-violet-500" />
                    Portfolio & Links
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {agent.portfolioUrls.map((url) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-3 rounded-lg border hover:border-violet-300 hover:bg-violet-500/5 transition-all group"
                    >
                      <Globe className="h-4 w-4 text-muted-foreground group-hover:text-violet-500" />
                      <span className="text-sm truncate flex-1 group-hover:text-violet-600">{url}</span>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>

        {/* Right Column - 1/3 */}
        <div className="space-y-6">
          {/* Performance Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Performance Rating</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                <ScoreRing score={agent.performanceScore} size={100} />
                <div className="text-center">
                  <RatingStars score={agent.performanceScore} size="lg" />
                  <p className="text-sm text-muted-foreground mt-1">
                    {scoreLabel} Performance
                  </p>
                </div>
                <div className="w-full space-y-2 pt-2 border-t">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Clients Served</span>
                    <span className="font-medium">{totalClients}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Currently Active</span>
                    <span className="font-medium">{agent.clientCount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Projects Completed</span>
                    <span className="font-medium">{agent.completedClients}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Pricing Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
          >
            <Card className="border-violet-200/50">
              <CardContent className="p-6 text-center">
                <div className="h-12 w-12 rounded-2xl bg-violet-500/10 flex items-center justify-center mx-auto mb-3">
                  <DollarSign className="h-6 w-6 text-violet-500" />
                </div>
                <p className="text-3xl font-bold text-violet-600">
                  ${(agent.minPricePerMonth / 100).toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground mb-4">per month starting rate</p>
                {!isOwnProfile && !relationship && (
                  <Button
                    className="w-full bg-violet-600 hover:bg-violet-700"
                    onClick={handleHire}
                    disabled={isHiring}
                  >
                    {isHiring ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    {isHiring ? "Hiring..." : "Hire This Agent"}
                  </Button>
                )}
                {relationship?.status === "ACTIVE" && (
                  <Badge className="bg-emerald-500 text-sm px-4 py-1.5">
                    <Heart className="h-3.5 w-3.5 mr-1.5 fill-current" />
                    Currently Hired
                  </Badge>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Trust Badges */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Shield className="h-5 w-5 text-emerald-500 shrink-0" />
                  <span>Verified by FlowSmartly</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                  <span>Background checked</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Shield className="h-5 w-5 text-emerald-500 shrink-0" />
                  <span>Financial actions restricted</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <TrendingUp className="h-5 w-5 text-emerald-500 shrink-0" />
                  <span>Performance monitored</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
