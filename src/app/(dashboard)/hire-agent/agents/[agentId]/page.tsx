"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Video,
  ZoomIn,
  FileText,
  Clock,
  XCircle,
  AlertTriangle,
  Quote,
  Send,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface ShowcaseProject {
  url: string;
  title: string;
  description: string;
  highlights?: string[];
  mediaType?: "image" | "video";
}

interface AgentReview {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  reviewer: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
}

interface AgentDetail {
  id: string;
  displayName: string;
  bio: string | null;
  coverImageUrl: string | null;
  showcaseImages: ShowcaseProject[];
  specialties: string[];
  industries: string[];
  portfolioUrls: string[];
  minPricePerMonth: number;
  performanceScore: number;
  clientCount: number;
  completedClients: number;
  approvedAt: string;
  reviews: AgentReview[];
  avgRating: number;
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
  const [isAboutExpanded, setIsAboutExpanded] = useState(false);
  const [selectedShowcase, setSelectedShowcase] = useState<ShowcaseProject | null>(null);
  const [currentProjectIndex, setCurrentProjectIndex] = useState(0);

  // Hire dialog state
  const [showHireDialog, setShowHireDialog] = useState(false);
  const [hireMessage, setHireMessage] = useState("");
  const [hireAgreed, setHireAgreed] = useState(false);

  // Unhire dialog state
  const [showUnhireDialog, setShowUnhireDialog] = useState(false);
  const [unhireReason, setUnhireReason] = useState("");
  const [unhireAgreed, setUnhireAgreed] = useState(false);
  const [isUnhiring, setIsUnhiring] = useState(false);

  // Review state
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [isReviewsPaused, setIsReviewsPaused] = useState(false);

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
    if (!hireAgreed) return;
    setIsHiring(true);
    try {
      const res = await fetch("/api/marketplace/hire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          message: hireMessage.trim() || undefined,
          agreedToTerms: true,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setRelationship({
          id: data.data.client.id,
          status: "PENDING",
          monthlyPriceCents: data.data.client.monthlyPriceCents,
          startDate: data.data.client.startDate,
        });
        setShowHireDialog(false);
        setHireMessage("");
        setHireAgreed(false);
        toast({
          title: "Request Sent!",
          description: `Your hire request has been sent to ${agent?.displayName}. They will review and accept your request.`,
        });
      } else {
        toast({
          title: "Error",
          description: data.error?.message || "Failed to send hire request",
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

  const handleUnhire = async () => {
    if (!unhireAgreed || !relationship) return;
    setIsUnhiring(true);
    try {
      const res = await fetch("/api/marketplace/hire/terminate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: relationship.id,
          reason: unhireReason.trim() || undefined,
          agreedToRelease: true,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setRelationship(null);
        setShowUnhireDialog(false);
        setUnhireReason("");
        setUnhireAgreed(false);
        toast({
          title: relationship.status === "PENDING" ? "Request Cancelled" : "Agent Unhired",
          description: data.data.message,
        });
      } else {
        toast({
          title: "Error",
          description: data.error?.message || "Failed to unhire agent",
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
    setIsUnhiring(false);
  };

  const handleSubmitReview = async () => {
    if (reviewComment.trim().length < 10) {
      toast({ title: "Review too short", description: "Please write at least 10 characters.", variant: "destructive" });
      return;
    }
    setIsSubmittingReview(true);
    try {
      const res = await fetch(`/api/marketplace/agents/${agentId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: reviewRating, comment: reviewComment.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        // Refresh agent data to get updated reviews
        const agentRes = await fetch(`/api/marketplace/agents/${agentId}`);
        const agentData = await agentRes.json();
        if (agentData.success) {
          setAgent(agentData.data.agent);
        }
        setShowReviewDialog(false);
        setReviewComment("");
        setReviewRating(5);
        toast({ title: "Review submitted!", description: "Thank you for your feedback." });
      } else {
        toast({ title: "Error", description: data.error?.message || "Failed to submit review", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "An error occurred. Please try again.", variant: "destructive" });
    }
    setIsSubmittingReview(false);
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
          <div className="h-32 md:h-48 relative overflow-hidden">
            {agent.coverImageUrl ? (
              <motion.img
                src={agent.coverImageUrl}
                alt="Cover"
                className="w-full h-full object-cover"
                initial={{ scale: 1.05 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.8 }}
              />
            ) : (
              <ProfileBannerSVG />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-card/60 via-transparent to-transparent" />
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
                    ) : relationship?.status === "ACTIVE" ? (
                      <div className="flex flex-col items-end gap-2">
                        <Badge className="text-sm px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600">
                          <Heart className="h-3.5 w-3.5 mr-1.5 fill-current" />
                          Currently Hired
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                          onClick={() => setShowUnhireDialog(true)}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1.5" />
                          Unhire Agent
                        </Button>
                      </div>
                    ) : relationship?.status === "PENDING" ? (
                      <div className="flex flex-col items-end gap-2">
                        <Badge className="text-sm px-4 py-1.5 bg-amber-500 hover:bg-amber-600">
                          <Clock className="h-3.5 w-3.5 mr-1.5" />
                          Pending Approval
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setShowUnhireDialog(true)}
                        >
                          Cancel Request
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="lg"
                        className="bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-500/20"
                        onClick={() => setShowHireDialog(true)}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Hire This Agent
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

      {/* Trust & Pricing Bar — Compact */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              {/* Trust badges inline */}
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Shield className="h-4 w-4 text-emerald-500" />
                <span>Verified</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <span>Background Checked</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Shield className="h-4 w-4 text-emerald-500" />
                <span>Financials Restricted</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <span>Performance Monitored</span>
              </div>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Pricing + CTA inline */}
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-lg font-bold text-violet-600">${(agent.minPricePerMonth / 100).toLocaleString()}<span className="text-xs font-normal text-muted-foreground">/mo</span></p>
                </div>
                {isOwnProfile ? (
                  <Badge variant="secondary" className="text-xs px-3 py-1">Your Profile</Badge>
                ) : relationship?.status === "ACTIVE" ? (
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-500 text-xs px-3 py-1">
                      <Heart className="h-3 w-3 mr-1 fill-current" />Hired
                    </Badge>
                    <Button variant="outline" size="sm" className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setShowUnhireDialog(true)}>
                      Unhire
                    </Button>
                  </div>
                ) : relationship?.status === "PENDING" ? (
                  <div className="flex items-center gap-2">
                    <Badge className="bg-amber-500 text-xs px-3 py-1">
                      <Clock className="h-3 w-3 mr-1" />Pending
                    </Badge>
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowUnhireDialog(true)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" className="h-8 bg-violet-600 hover:bg-violet-700" onClick={() => setShowHireDialog(true)}>
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />Hire Agent
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* About Section — Full Width */}
      <div className="space-y-6">
          {/* About — Rich Collapsible */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="overflow-hidden">
              <CardHeader
                className="cursor-pointer"
                onClick={() => setIsAboutExpanded(!isAboutExpanded)}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                      <Sparkles className="h-4 w-4 text-violet-500" />
                    </div>
                    About {agent.displayName}
                  </CardTitle>
                  <motion.div animate={{ rotate: isAboutExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  </motion.div>
                </div>
              </CardHeader>

              {/* Preview when collapsed */}
              {!isAboutExpanded && agent.bio && (
                <div className="px-6 pb-4 -mt-2">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {agent.bio}
                  </p>
                </div>
              )}

              <AnimatePresence initial={false}>
                {isAboutExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.35, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <CardContent className="pt-0 space-y-0 divide-y">
                      {/* Bio */}
                      <div className="py-4 flex items-start gap-4">
                        <div className="h-9 w-9 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                          <FileText className="h-4 w-4 text-blue-500" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">Professional Summary</p>
                          <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap text-sm">
                            {agent.bio || "This agent hasn't added a bio yet."}
                          </p>
                        </div>
                      </div>

                      {/* Track Record */}
                      <div className="py-4 flex items-start gap-4">
                        <div className="h-9 w-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                          <Award className="h-4 w-4 text-emerald-500" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">Track Record</p>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="text-center p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-200/30 dark:border-emerald-800/30">
                              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{agent.clientCount}</p>
                              <p className="text-xs text-muted-foreground">Active Now</p>
                            </div>
                            <div className="text-center p-2.5 rounded-lg bg-blue-500/5 border border-blue-200/30 dark:border-blue-800/30">
                              <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{agent.completedClients}</p>
                              <p className="text-xs text-muted-foreground">Completed</p>
                            </div>
                            <div className="text-center p-2.5 rounded-lg bg-violet-500/5 border border-violet-200/30 dark:border-violet-800/30">
                              <p className="text-xl font-bold text-violet-600 dark:text-violet-400">{agent.performanceScore}%</p>
                              <p className="text-xs text-muted-foreground">Performance</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Agent Since */}
                      <div className="py-4 flex items-start gap-4">
                        <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                          <Calendar className="h-4 w-4 text-amber-500" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1">Agent Since</p>
                          <p className="font-medium">
                            {agent.approvedAt ? format(new Date(agent.approvedAt), "MMMM yyyy") : "Recently joined"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </motion.div>

      </div>

      {/* Featured Projects — Full Width, Single Project View */}
      {agent.showcaseImages && agent.showcaseImages.length > 0 && (() => {
        const project = agent.showcaseImages[currentProjectIndex] || agent.showcaseImages[0];
        const isVideo = project.mediaType === "video" || /\.(mp4|webm|mov)$/i.test(project.url);
        const hasDetails = project.description || (project.highlights && project.highlights.length > 0);
        const total = agent.showcaseImages.length;

        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.52 }}
          >
            <Card className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-pink-500/15 to-violet-500/15 flex items-center justify-center">
                      <Briefcase className="h-4 w-4 text-violet-500" />
                    </div>
                    Featured Projects
                  </CardTitle>
                  {total > 1 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground font-medium">
                        {currentProjectIndex + 1} / {total}
                      </span>
                      <button
                        className="h-8 w-8 rounded-lg border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-30"
                        onClick={() => setCurrentProjectIndex((currentProjectIndex - 1 + total) % total)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        className="h-8 w-8 rounded-lg border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-30"
                        onClick={() => setCurrentProjectIndex((currentProjectIndex + 1) % total)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentProjectIndex}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                  >
                    {/* Title — full width above media & details */}
                    {project.title && (
                      <h3 className="text-xl font-bold tracking-tight mb-3">{project.title}</h3>
                    )}

                    <div className={`flex flex-col ${hasDetails ? "md:flex-row md:items-stretch" : ""} gap-6`}>
                      {/* Media */}
                      <div
                        className={`${hasDetails ? "md:w-[55%]" : "w-full"} cursor-pointer group shrink-0`}
                        onClick={() => setSelectedShowcase(project)}
                      >
                        <div className="h-full min-h-[240px] rounded-2xl overflow-hidden bg-muted relative shadow-sm">
                          {isVideo ? (
                            <video
                              src={project.url}
                              className="w-full h-full object-cover"
                              muted
                              playsInline
                              onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
                              onMouseLeave={(e) => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
                            />
                          ) : (
                            <img
                              src={project.url}
                              alt={project.title}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 flex items-center justify-center">
                            <div className="h-11 w-11 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 scale-75 group-hover:scale-100">
                              {isVideo ? (
                                <Video className="h-5 w-5 text-white" />
                              ) : (
                                <ZoomIn className="h-5 w-5 text-white" />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Details */}
                      {hasDetails && (
                        <div className="flex-1 flex flex-col justify-center py-1">
                          {project.description && (
                            <p className="text-muted-foreground leading-relaxed text-[15px] line-clamp-2 mb-4">
                              {project.description}
                            </p>
                          )}
                          {project.highlights && project.highlights.length > 0 && (
                            <div className="space-y-3">
                              {project.highlights.map((h, hi) => (
                                <div key={hi} className="flex items-start gap-3">
                                  <div className="h-5 w-5 rounded-full bg-violet-500/10 flex items-center justify-center shrink-0 mt-0.5">
                                    <CheckCircle className="h-3.5 w-3.5 text-violet-500" />
                                  </div>
                                  <span className="text-[14px] leading-snug">{h}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Thumbnail strip — clickable project previews */}
                    {total > 1 && (
                      <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
                        {agent.showcaseImages.map((p, i) => {
                          const thumbIsVideo = p.mediaType === "video" || /\.(mp4|webm|mov)$/i.test(p.url);
                          return (
                            <button
                              key={`thumb-${i}`}
                              onClick={() => setCurrentProjectIndex(i)}
                              className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                                i === currentProjectIndex
                                  ? "border-violet-500 ring-2 ring-violet-500/20 opacity-100"
                                  : "border-transparent opacity-50 hover:opacity-90 hover:border-muted-foreground/30"
                              }`}
                            >
                              {thumbIsVideo ? (
                                <div className="w-full h-full bg-muted flex items-center justify-center relative">
                                  <video src={p.url} className="w-full h-full object-cover" muted preload="metadata" />
                                  <Video className="h-4 w-4 text-white absolute drop-shadow-md" />
                                </div>
                              ) : (
                                <img src={p.url} alt={p.title || `Project ${i + 1}`} className="w-full h-full object-cover" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        );
      })()}

      {/* Customer Reviews — Auto-scrolling Marquee */}
      {agent.reviews && agent.reviews.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.54 }}
        >
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-500/15 to-orange-500/15 flex items-center justify-center">
                    <MessageSquare className="h-4 w-4 text-amber-500" />
                  </div>
                  Customer Reviews
                  <Badge variant="secondary" className="text-xs ml-1">
                    {agent.reviews.length}
                  </Badge>
                </CardTitle>
                <div className="flex items-center gap-3">
                  {agent.avgRating > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${
                              i <= Math.round(agent.avgRating)
                                ? "fill-amber-400 text-amber-400"
                                : "fill-muted text-muted"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm font-semibold">{agent.avgRating}</span>
                    </div>
                  )}
                  {!isOwnProfile && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => setShowReviewDialog(true)}
                    >
                      <Star className="h-3.5 w-3.5 mr-1.5" />
                      Write Review
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 pb-5">
              {/* Scrolling container */}
              <div
                className="relative overflow-hidden"
                onMouseEnter={() => setIsReviewsPaused(true)}
                onMouseLeave={() => setIsReviewsPaused(false)}
              >
                {/* Fade edges */}
                <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-card to-transparent z-10 pointer-events-none" />
                <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-card to-transparent z-10 pointer-events-none" />

                <motion.div
                  className="flex gap-4"
                  animate={{
                    x: isReviewsPaused ? undefined : [0, -(agent.reviews.length * 320)],
                  }}
                  transition={
                    isReviewsPaused
                      ? { duration: 0 }
                      : {
                          x: {
                            duration: agent.reviews.length * 6,
                            repeat: Infinity,
                            ease: "linear",
                          },
                        }
                  }
                  style={{ width: "max-content" }}
                >
                  {/* Duplicate reviews for seamless loop */}
                  {[...agent.reviews, ...agent.reviews].map((review, i) => (
                    <div
                      key={`${review.id}-${i}`}
                      className="w-[300px] shrink-0 rounded-xl border bg-muted/30 p-4 hover:bg-muted/50 transition-colors"
                    >
                      {/* Quote icon */}
                      <Quote className="h-5 w-5 text-violet-400/40 mb-2" />

                      {/* Review text */}
                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 min-h-[3.75rem]">
                        {review.comment}
                      </p>

                      {/* Stars */}
                      <div className="flex items-center gap-0.5 mt-3 mb-3">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`h-3.5 w-3.5 ${
                              s <= review.rating
                                ? "fill-amber-400 text-amber-400"
                                : "fill-muted text-muted"
                            }`}
                          />
                        ))}
                      </div>

                      {/* Reviewer */}
                      <div className="flex items-center gap-2.5 pt-3 border-t">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={review.reviewer.avatarUrl || undefined} />
                          <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-white text-xs font-semibold">
                            {review.reviewer.name?.charAt(0) || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{review.reviewer.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(review.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Write Review button if no reviews yet */}
      {(!agent.reviews || agent.reviews.length === 0) && !isOwnProfile && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.54 }}
        >
          <Card>
            <CardContent className="p-6 text-center">
              <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="h-6 w-6 text-amber-500" />
              </div>
              <h3 className="font-semibold mb-1">No Reviews Yet</h3>
              <p className="text-sm text-muted-foreground mb-4">Be the first to review {agent.displayName}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowReviewDialog(true)}
              >
                <Star className="h-3.5 w-3.5 mr-1.5" />
                Write a Review
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Content — Full Width */}
      <div className="space-y-6">
          {/* Specialties & Industries */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.56 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
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
                  {agent.specialties.map((s) => (
                    <Badge key={s} className="bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-200/50 hover:bg-violet-500/20 px-3 py-1.5 text-sm">
                      {s}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-violet-500" />
                  Industries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {agent.industries.map((ind) => (
                    <div key={ind} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 text-sm">
                      <Globe className="h-3.5 w-3.5 text-brand-500 shrink-0" />
                      {ind}
                    </div>
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
              transition={{ delay: 0.58 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ExternalLink className="h-4 w-4 text-violet-500" />
                    Portfolio & Links
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {agent.portfolioUrls.map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border hover:border-violet-300 hover:bg-violet-500/5 transition-all group"
                      >
                        <Globe className="h-4 w-4 text-muted-foreground group-hover:text-violet-500" />
                        <span className="text-sm truncate group-hover:text-violet-600">{url}</span>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
      </div>

      {/* Hire Confirmation Dialog */}
      <Dialog open={showHireDialog} onOpenChange={(open) => { if (!open) { setShowHireDialog(false); setHireMessage(""); setHireAgreed(false); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-500" />
              Hire {agent.displayName}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Pricing summary */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-violet-500/5 border border-violet-200/50">
              <span className="text-sm font-medium">Monthly Rate</span>
              <span className="text-lg font-bold text-violet-600">
                ${(agent.minPricePerMonth / 100).toLocaleString()}/mo
              </span>
            </div>

            {/* Message to agent */}
            <div>
              <Label className="text-sm font-medium">Message to Agent (optional)</Label>
              <Textarea
                value={hireMessage}
                onChange={(e) => setHireMessage(e.target.value)}
                placeholder="Tell the agent about your business and what you need help with..."
                className="mt-1.5"
                rows={3}
              />
            </div>

            {/* Service Agreement */}
            <div className="rounded-lg border p-4 bg-muted/30 space-y-3">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-500" />
                Service Agreement
              </h4>
              <div className="text-xs text-muted-foreground space-y-2 max-h-40 overflow-y-auto pr-2">
                <p><strong>1. Agent Access & Management</strong><br />
                By hiring this agent, you authorize them to access and manage your FlowSmartly account on your behalf. The agent can create, edit, and schedule content, manage campaigns, and perform marketing tasks within the platform. Financial actions (purchases, billing changes) remain restricted to you.</p>
                <p><strong>2. Plan Conversion</strong><br />
                Your current subscription plan will be converted to an agent-managed plan. The agent&apos;s monthly fee (${(agent.minPricePerMonth / 100).toLocaleString()}/mo) is paid directly to the agent. There are no additional platform fees from FlowSmartly for agent-managed accounts.</p>
                <p><strong>3. Performance Monitoring</strong><br />
                FlowSmartly monitors agent performance and activity. Agents are subject to performance reviews, and you can view all actions taken on your account. You may terminate the relationship at any time.</p>
                <p><strong>4. Approval Process</strong><br />
                Your hire request will be sent to the agent for review. The agent must accept and sign the service agreement before the relationship is activated. Until accepted, no account access is granted.</p>
                <p><strong>5. Termination</strong><br />
                Either party may end the relationship at any time. Upon termination, all agent access is immediately revoked and your account returns to self-managed mode.</p>
              </div>
            </div>

            {/* Agreement checkbox */}
            <div className="flex items-start gap-3">
              <Checkbox
                id="hire-agree"
                checked={hireAgreed}
                onCheckedChange={(checked) => setHireAgreed(checked === true)}
                className="mt-0.5"
              />
              <Label htmlFor="hire-agree" className="text-sm leading-relaxed cursor-pointer">
                I have read and agree to the Service Agreement. I understand that my request will be reviewed by the agent and that no access is granted until accepted.
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowHireDialog(false); setHireMessage(""); setHireAgreed(false); }}>
              Cancel
            </Button>
            <Button
              className="bg-violet-600 hover:bg-violet-700"
              onClick={handleHire}
              disabled={!hireAgreed || isHiring}
            >
              {isHiring ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending Request...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Send Hire Request
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unhire / Cancel Request Dialog */}
      <Dialog open={showUnhireDialog} onOpenChange={(open) => { if (!open) { setShowUnhireDialog(false); setUnhireReason(""); setUnhireAgreed(false); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {relationship?.status === "PENDING" ? "Cancel Hire Request" : "Unhire Agent"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {relationship?.status === "PENDING" ? (
              <p className="text-sm text-muted-foreground">
                Your hire request to <strong>{agent.displayName}</strong> is still pending their approval. You can cancel it now.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                You are about to end your relationship with <strong>{agent.displayName}</strong>. Their access to your account will be immediately revoked.
              </p>
            )}

            {/* Reason */}
            <div>
              <Label className="text-sm font-medium">
                Reason {relationship?.status !== "PENDING" ? "(required)" : "(optional)"}
              </Label>
              <Textarea
                value={unhireReason}
                onChange={(e) => setUnhireReason(e.target.value)}
                placeholder={relationship?.status === "PENDING"
                  ? "Why are you cancelling the request?"
                  : "Please share why you're ending this relationship..."
                }
                className="mt-1.5"
                rows={3}
              />
            </div>

            {/* Termination Release Agreement */}
            {relationship?.status !== "PENDING" && (
              <div className="rounded-lg border p-4 bg-muted/30 space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Shield className="h-4 w-4 text-amber-500" />
                  Termination Release Agreement
                </h4>
                <div className="text-xs text-muted-foreground space-y-2 max-h-32 overflow-y-auto pr-2">
                  <p><strong>1. Immediate Effect</strong><br />
                  Upon confirmation, the agent&apos;s access to your account will be immediately revoked. All active agent sessions will be terminated.</p>
                  <p><strong>2. Content & Work Product</strong><br />
                  All content created by the agent on your behalf remains in your account and is fully owned by you. The agent retains no rights to your account data or content.</p>
                  <p><strong>3. Billing</strong><br />
                  The agent&apos;s monthly fee will cease immediately. No prorated refunds are issued for partial months. Your account will revert to your current subscription plan with standard platform features.</p>
                  <p><strong>4. No Platform Fees</strong><br />
                  FlowSmartly does not charge any termination or early cancellation fees.</p>
                </div>
              </div>
            )}

            {/* Agreement checkbox */}
            <div className="flex items-start gap-3">
              <Checkbox
                id="unhire-agree"
                checked={unhireAgreed}
                onCheckedChange={(checked) => setUnhireAgreed(checked === true)}
                className="mt-0.5"
              />
              <Label htmlFor="unhire-agree" className="text-sm leading-relaxed cursor-pointer">
                {relationship?.status === "PENDING"
                  ? "I confirm I want to cancel this hire request."
                  : "I have read the Termination Release Agreement and confirm I want to end this agent relationship."}
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowUnhireDialog(false); setUnhireReason(""); setUnhireAgreed(false); }}>
              Go Back
            </Button>
            <Button
              variant="destructive"
              onClick={handleUnhire}
              disabled={!unhireAgreed || isUnhiring || (relationship?.status !== "PENDING" && !unhireReason.trim())}
            >
              {isUnhiring ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  {relationship?.status === "PENDING" ? "Cancel Request" : "Confirm Unhire"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Showcase Lightbox */}
      <Dialog open={!!selectedShowcase} onOpenChange={() => setSelectedShowcase(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          {selectedShowcase && (() => {
            const isVideo = selectedShowcase.mediaType === "video" || /\.(mp4|webm|mov)$/i.test(selectedShowcase.url);
            return (
              <>
                <div className="relative bg-black/90">
                  {isVideo ? (
                    <video
                      src={selectedShowcase.url}
                      controls
                      autoPlay
                      className="w-full max-h-[75vh]"
                    />
                  ) : (
                    <img
                      src={selectedShowcase.url}
                      alt={selectedShowcase.title}
                      className="w-full max-h-[75vh] object-contain"
                    />
                  )}
                  {agent.showcaseImages.length > 1 && (
                    <>
                      <button
                        className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                        onClick={() => {
                          const idx = agent.showcaseImages.findIndex((i) => i.url === selectedShowcase.url);
                          setSelectedShowcase(agent.showcaseImages[(idx - 1 + agent.showcaseImages.length) % agent.showcaseImages.length]);
                        }}
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                        onClick={() => {
                          const idx = agent.showcaseImages.findIndex((i) => i.url === selectedShowcase.url);
                          setSelectedShowcase(agent.showcaseImages[(idx + 1) % agent.showcaseImages.length]);
                        }}
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </>
                  )}
                </div>
                {(selectedShowcase.title || selectedShowcase.description || (selectedShowcase.highlights && selectedShowcase.highlights.length > 0)) && (
                  <div className="p-5 border-t">
                    {selectedShowcase.title && (
                      <h3 className="text-lg font-bold">{selectedShowcase.title}</h3>
                    )}
                    {selectedShowcase.description && (
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{selectedShowcase.description}</p>
                    )}
                    {selectedShowcase.highlights && selectedShowcase.highlights.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {selectedShowcase.highlights.map((h, hi) => (
                          <div key={hi} className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-violet-500 mt-0.5 shrink-0" />
                            <span className="text-sm">{h}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Write Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={(open) => { if (!open) { setShowReviewDialog(false); setReviewComment(""); setReviewRating(5); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500" />
              Review {agent.displayName}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Star rating picker */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Rating</Label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="p-0.5 transition-transform hover:scale-110"
                    onClick={() => setReviewRating(s)}
                  >
                    <Star
                      className={`h-7 w-7 transition-colors ${
                        s <= reviewRating
                          ? "fill-amber-400 text-amber-400"
                          : "fill-muted text-muted-foreground/30 hover:text-amber-300"
                      }`}
                    />
                  </button>
                ))}
                <span className="ml-2 text-sm text-muted-foreground">
                  {reviewRating === 5 ? "Excellent" : reviewRating === 4 ? "Great" : reviewRating === 3 ? "Good" : reviewRating === 2 ? "Fair" : "Poor"}
                </span>
              </div>
            </div>

            {/* Comment */}
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Your Review</Label>
              <Textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share your experience working with this agent..."
                rows={4}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground text-right mt-1">
                {reviewComment.length} / 500
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowReviewDialog(false); setReviewComment(""); setReviewRating(5); }}>
              Cancel
            </Button>
            <Button
              className="bg-violet-600 hover:bg-violet-700"
              onClick={handleSubmitReview}
              disabled={isSubmittingReview || reviewComment.trim().length < 10}
            >
              {isSubmittingReview ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting...</>
              ) : (
                <><Send className="h-4 w-4 mr-2" />Submit Review</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
