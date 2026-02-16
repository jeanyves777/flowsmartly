"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Store,
  Star,
  Users,
  DollarSign,
  Filter,
  Loader2,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Globe,
  Award,
  ArrowUpDown,
  Sparkles,
  TrendingUp,
  Heart,
  ExternalLink,
  CheckCircle,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Agent {
  id: string;
  displayName: string;
  bio: string | null;
  specialties: string[];
  industries: string[];
  portfolioUrls: string[];
  minPricePerMonth: number;
  performanceScore: number;
  clientCount: number;
  approvedAt: string;
  user: {
    id: string;
    name: string;
    avatarUrl: string | null;
    createdAt: string;
  };
  relationship: string | null;
}

function RatingStars({ score }: { score: number }) {
  const stars = Math.round(score / 20);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
            i <= stars
              ? "fill-amber-400 text-amber-400"
              : "fill-muted text-muted"
          }`}
        />
      ))}
    </div>
  );
}

function ScoreRing({ score, size = 48 }: { score: number; size?: number }) {
  const radius = (size - 6) / 2;
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
          strokeWidth={3}
          className="text-muted/30"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - progress }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold" style={{ color }}>
          {score}
        </span>
      </div>
    </div>
  );
}

function HeroIllustration() {
  return (
    <svg viewBox="0 0 200 120" fill="none" className="w-full max-w-[200px]">
      <motion.rect
        x="20" y="30" width="60" height="70" rx="8"
        fill="url(#card1)"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      />
      <motion.rect
        x="70" y="20" width="60" height="70" rx="8"
        fill="url(#card2)"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15 }}
      />
      <motion.rect
        x="120" y="30" width="60" height="70" rx="8"
        fill="url(#card3)"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
      />
      {/* People icons */}
      <motion.circle cx="50" cy="52" r="10" fill="white" fillOpacity="0.3"
        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5 }} />
      <motion.circle cx="100" cy="42" r="10" fill="white" fillOpacity="0.3"
        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.6 }} />
      <motion.circle cx="150" cy="52" r="10" fill="white" fillOpacity="0.3"
        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.7 }} />
      {/* Stars */}
      <motion.path
        d="M50 68 l2 4 4 0.5 -3 3 0.7 4.5 -3.7-2 -3.7 2 0.7-4.5 -3-3 4-0.5z"
        fill="#fbbf24"
        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.8 }}
      />
      <motion.path
        d="M100 58 l2 4 4 0.5 -3 3 0.7 4.5 -3.7-2 -3.7 2 0.7-4.5 -3-3 4-0.5z"
        fill="#fbbf24"
        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.9 }}
      />
      <motion.path
        d="M150 68 l2 4 4 0.5 -3 3 0.7 4.5 -3.7-2 -3.7 2 0.7-4.5 -3-3 4-0.5z"
        fill="#fbbf24"
        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1 }}
      />
      <defs>
        <linearGradient id="card1" x1="20" y1="30" x2="80" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#6d28d9" />
        </linearGradient>
        <linearGradient id="card2" x1="70" y1="20" x2="130" y2="90" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a78bfa" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id="card3" x1="120" y1="30" x2="180" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#6d28d9" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function MarketplacePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [industry, setIndustry] = useState("");
  const [sort, setSort] = useState("rating");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [availableSpecialties, setAvailableSpecialties] = useState<string[]>([]);
  const [availableIndustries, setAvailableIndustries] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [isAgent, setIsAgent] = useState(false);

  useEffect(() => {
    fetch("/api/agent/profile")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data?.profile?.status === "APPROVED") {
          setIsAgent(true);
        }
      })
      .catch(() => {});
  }, []);

  const fetchAgents = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (specialty) params.set("specialty", specialty);
      if (industry) params.set("industry", industry);
      if (sort) params.set("sort", sort);
      params.set("page", page.toString());

      const res = await fetch(`/api/marketplace/agents?${params}`);
      const data = await res.json();

      if (data.success) {
        setAgents(data.data.agents);
        setTotal(data.data.total);
        setTotalPages(data.data.totalPages);
        setAvailableSpecialties(data.data.filters.specialties);
        setAvailableIndustries(data.data.filters.industries);
      }
    } catch {
      // silently fail
    }
    setIsLoading(false);
  }, [search, specialty, industry, sort, page]);

  useEffect(() => {
    const timeout = setTimeout(fetchAgents, 300);
    return () => clearTimeout(timeout);
  }, [fetchAgents]);

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="overflow-hidden border-violet-200/50 bg-gradient-to-br from-violet-500/5 via-purple-500/5 to-brand-500/5">
          <CardContent className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="flex-1">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-600 text-sm font-medium mb-3"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Agent Marketplace
                </motion.div>
                <motion.h1
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-2xl md:text-3xl font-bold mb-2"
                >
                  Find Your Perfect Marketing Agent
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-muted-foreground max-w-lg"
                >
                  Browse verified professionals who will manage your social media,
                  content strategy, and marketing campaigns.
                </motion.p>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="flex items-center gap-4 mt-4 text-sm text-muted-foreground"
                >
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    <span>Verified Agents</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    <span>Secure Payments</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    <span>Performance Tracked</span>
                  </div>
                </motion.div>
              </div>
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, type: "spring" }}
                className="hidden md:block"
              >
                <HeroIllustration />
              </motion.div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Search & Sort Bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="flex flex-col sm:flex-row gap-3"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search agents by name, bio, specialty..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 h-11"
          />
        </div>
        <Button
          variant={showFilters ? "default" : "outline"}
          onClick={() => setShowFilters(!showFilters)}
          className={showFilters ? "bg-violet-600 hover:bg-violet-700" : ""}
        >
          <Filter className="h-4 w-4 mr-2" />
          Filters
          {(specialty || industry) && (
            <Badge variant="secondary" className="ml-2 text-xs bg-white/20">
              {[specialty, industry].filter(Boolean).length}
            </Badge>
          )}
        </Button>
        <Select value={sort} onValueChange={(v) => { setSort(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[180px] h-11">
            <ArrowUpDown className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="rating">Top Rated</SelectItem>
            <SelectItem value="clients">Most Clients</SelectItem>
            <SelectItem value="price_low">Price: Low to High</SelectItem>
            <SelectItem value="price_high">Price: High to Low</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Expandable Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">
                      Specialty
                    </label>
                    <Select value={specialty} onValueChange={(v) => { setSpecialty(v === "all" ? "" : v); setPage(1); }}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Specialties" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Specialties</SelectItem>
                        {availableSpecialties.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">
                      Industry
                    </label>
                    <Select value={industry} onValueChange={(v) => { setIndustry(v === "all" ? "" : v); setPage(1); }}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Industries" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Industries</SelectItem>
                        {availableIndustries.map((i) => (
                          <SelectItem key={i} value={i}>{i}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {(specialty || industry) && (
                  <div className="mt-3 flex items-center gap-2">
                    {specialty && (
                      <Badge variant="secondary" className="gap-1">
                        {specialty}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => setSpecialty("")} />
                      </Badge>
                    )}
                    {industry && (
                      <Badge variant="secondary" className="gap-1">
                        {industry}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => setIndustry("")} />
                      </Badge>
                    )}
                    <Button variant="ghost" size="sm" className="text-xs h-6" onClick={() => { setSpecialty(""); setIndustry(""); }}>
                      Clear All
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results count */}
      {!isLoading && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-muted-foreground"
        >
          Showing {agents.length} of {total} agent{total !== 1 ? "s" : ""}
        </motion.p>
      )}

      {/* Agent Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 className="h-8 w-8 text-violet-500" />
          </motion.div>
          <p className="text-sm text-muted-foreground">Finding agents...</p>
        </div>
      ) : agents.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card>
            <CardContent className="p-12 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.1 }}
                className="h-20 w-20 rounded-full bg-violet-500/10 flex items-center justify-center mx-auto mb-4"
              >
                <Store className="h-10 w-10 text-violet-400" />
              </motion.div>
              <h3 className="text-lg font-semibold mb-2">No agents found</h3>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                {search || specialty || industry
                  ? "Try adjusting your search or filters to find agents"
                  : "No agents are available at the moment. Check back soon!"}
              </p>
              {(search || specialty || industry) && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => { setSearch(""); setSpecialty(""); setIndustry(""); }}
                >
                  Clear All Filters
                </Button>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {agents.map((agent, index) => (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.06, type: "spring", stiffness: 100 }}
            >
              <Link href={`/hire-agent/agents/${agent.id}`}>
                <Card className="h-full hover:border-violet-300 hover:shadow-lg hover:shadow-violet-500/5 transition-all duration-300 cursor-pointer group overflow-hidden relative">
                  {/* Top gradient accent */}
                  <div className="h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-brand-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                  <CardContent className="p-5">
                    {/* Agent Header */}
                    <div className="flex items-start gap-3 mb-4">
                      <div className="relative">
                        <Avatar className="h-14 w-14 ring-2 ring-violet-500/10 group-hover:ring-violet-500/30 transition-all">
                          <AvatarImage src={agent.user.avatarUrl || undefined} />
                          <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-white font-bold text-lg">
                            {agent.displayName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        {agent.performanceScore >= 80 && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.3 + index * 0.06 }}
                            className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center ring-2 ring-background"
                          >
                            <CheckCircle className="h-3 w-3 text-white" />
                          </motion.div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base truncate group-hover:text-violet-600 transition-colors">
                          {agent.displayName}
                        </h3>
                        <p className="text-xs text-muted-foreground truncate mb-1.5">
                          {agent.user.name}
                        </p>
                        <RatingStars score={agent.performanceScore} />
                      </div>
                      <ScoreRing score={agent.performanceScore} />
                    </div>

                    {/* Bio */}
                    {agent.bio && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
                        {agent.bio}
                      </p>
                    )}

                    {/* Specialties */}
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {agent.specialties.slice(0, 3).map((s) => (
                        <Badge
                          key={s}
                          variant="secondary"
                          className="text-xs font-normal bg-violet-500/5 text-violet-700 dark:text-violet-300 border-violet-200/50"
                        >
                          {s}
                        </Badge>
                      ))}
                      {agent.specialties.length > 3 && (
                        <Badge variant="secondary" className="text-xs font-normal">
                          +{agent.specialties.length - 3} more
                        </Badge>
                      )}
                    </div>

                    {/* Industries */}
                    <div className="flex flex-wrap gap-1 mb-4">
                      {agent.industries.slice(0, 2).map((i) => (
                        <span key={i} className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                          {i}
                        </span>
                      ))}
                      {agent.industries.length > 2 && (
                        <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                          +{agent.industries.length - 2}
                        </span>
                      )}
                    </div>

                    {/* Stats Bar */}
                    <div className="flex items-center justify-between pt-3 border-t">
                      <div className="flex items-center gap-1.5">
                        <div className="h-7 w-7 rounded-full bg-emerald-500/10 flex items-center justify-center">
                          <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">
                            ${(agent.minPricePerMonth / 100).toLocaleString()}
                          </p>
                          <p className="text-[10px] text-muted-foreground leading-none">per month</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="h-7 w-7 rounded-full bg-blue-500/10 flex items-center justify-center">
                          <Users className="h-3.5 w-3.5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{agent.clientCount}</p>
                          <p className="text-[10px] text-muted-foreground leading-none">clients</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="h-7 w-7 rounded-full bg-amber-500/10 flex items-center justify-center">
                          <TrendingUp className="h-3.5 w-3.5 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{agent.performanceScore}%</p>
                          <p className="text-[10px] text-muted-foreground leading-none">score</p>
                        </div>
                      </div>
                    </div>

                    {/* Relationship Badge */}
                    {agent.relationship && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-3 pt-3 border-t flex items-center justify-between"
                      >
                        <Badge className={agent.relationship === "ACTIVE" ? "bg-emerald-500 hover:bg-emerald-600" : ""}>
                          <Heart className="h-3 w-3 mr-1 fill-current" />
                          {agent.relationship === "ACTIVE" ? "Currently Hired" : agent.relationship}
                        </Badge>
                        <span className="text-xs text-muted-foreground">View Details →</span>
                      </motion.div>
                    )}

                    {/* Hover CTA */}
                    {!agent.relationship && (
                      <div className="mt-3 pt-3 border-t opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-violet-600 font-medium">View Profile</span>
                          <ExternalLink className="h-3.5 w-3.5 text-violet-600" />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center gap-3 pt-4"
        >
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const pageNum = i + 1;
              return (
                <Button
                  key={pageNum}
                  variant={page === pageNum ? "default" : "ghost"}
                  size="sm"
                  className={`w-8 h-8 ${page === pageNum ? "bg-violet-600 hover:bg-violet-700" : ""}`}
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </motion.div>
      )}

      {/* Become an Agent CTA — hidden for existing agents */}
      {!isAgent && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="border-violet-200/50 bg-gradient-to-r from-violet-500/5 via-purple-500/5 to-brand-500/5 overflow-hidden">
            <CardContent className="p-6 md:p-8 flex flex-col sm:flex-row items-center gap-6">
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0 shadow-lg shadow-violet-500/20"
              >
                <Briefcase className="h-8 w-8 text-white" />
              </motion.div>
              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-lg font-bold mb-1">Are you a marketing professional?</h3>
                <p className="text-muted-foreground">
                  Join the marketplace and start earning by managing clients on FlowSmartly.
                  Get access to all tools for free.
                </p>
              </div>
              <Link href="/agent/apply">
                <Button size="lg" className="bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-500/20">
                  <Award className="h-4 w-4 mr-2" />
                  Apply as Agent
                </Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
