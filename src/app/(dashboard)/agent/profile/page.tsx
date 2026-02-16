"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Loader2,
  User,
  Briefcase,
  Star,
  Globe,
  DollarSign,
  Users,
  Pencil,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface AgentProfile {
  id: string;
  displayName: string;
  bio: string | null;
  specialties: string;
  industries: string;
  portfolioUrls: string;
  minPricePerMonth: number;
  performanceScore: number;
  status: string;
  landingPageSlug: string | null;
  approvedAt: string | null;
  _count: { clients: number; warnings: number };
}

export default function AgentProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/agent/profile");
        const data = await res.json();
        if (data.success && data.data?.profile) {
          setProfile(data.data.profile);
        } else {
          router.push("/agent/apply");
        }
      } catch {
        router.push("/agent/apply");
      }
      setIsLoading(false);
    }
    fetchProfile();
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  if (!profile) return null;

  const specialties: string[] = (() => {
    try { return JSON.parse(profile.specialties); } catch { return []; }
  })();
  const industries: string[] = (() => {
    try { return JSON.parse(profile.industries); } catch { return []; }
  })();
  const portfolioUrls: string[] = (() => {
    try { return JSON.parse(profile.portfolioUrls); } catch { return []; }
  })();

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
            <User className="h-5 w-5 text-violet-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">My Agent Profile</h1>
            <p className="text-sm text-muted-foreground">
              Manage your agent profile and marketplace presence
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/hire-agent/agents/${profile.id}`}>
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4 mr-2" />
              View Public Profile
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* Status Banner */}
      {profile.status !== "APPROVED" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className={
            profile.status === "PENDING"
              ? "border-amber-200 bg-amber-50/50 dark:bg-amber-900/10"
              : profile.status === "REJECTED"
              ? "border-red-200 bg-red-50/50 dark:bg-red-900/10"
              : "border-zinc-200 bg-zinc-50/50 dark:bg-zinc-900/10"
          }>
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className={`h-5 w-5 shrink-0 ${
                profile.status === "PENDING" ? "text-amber-500" : "text-red-500"
              }`} />
              <p className="text-sm">
                {profile.status === "PENDING" && "Your application is under review. You'll be notified once it's approved."}
                {profile.status === "REJECTED" && "Your application was not approved. You can update and reapply."}
                {profile.status === "SUSPENDED" && "Your agent profile has been suspended. Contact support for assistance."}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{profile._count.clients}</p>
              <p className="text-xs text-muted-foreground">Clients</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Star className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{profile.performanceScore}%</p>
              <p className="text-xs text-muted-foreground">Performance</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">${(profile.minPricePerMonth / 100).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Min Price/mo</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <Briefcase className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <Badge className={
                profile.status === "APPROVED" ? "bg-emerald-500" :
                profile.status === "PENDING" ? "bg-amber-500" :
                "bg-red-500"
              }>
                {profile.status}
              </Badge>
              <p className="text-xs text-muted-foreground mt-0.5">Status</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Profile Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2 space-y-6"
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">About</CardTitle>
              <Link href="/agent/apply">
                <Button variant="ghost" size="sm">
                  <Pencil className="h-3 w-3 mr-1" />
                  Edit
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Display Name</p>
                <p className="font-semibold text-lg">{profile.displayName}</p>
              </div>
              {profile.bio && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Bio</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{profile.bio}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Specialties</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {specialties.map((s) => (
                  <Badge
                    key={s}
                    variant="secondary"
                    className="bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-200/50"
                  >
                    {s}
                  </Badge>
                ))}
                {specialties.length === 0 && (
                  <p className="text-sm text-muted-foreground">No specialties selected</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Industries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {industries.map((i) => (
                  <Badge key={i} variant="outline">
                    {i}
                  </Badge>
                ))}
                {industries.length === 0 && (
                  <p className="text-sm text-muted-foreground">No industries selected</p>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Sidebar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="space-y-6"
        >
          {/* Links */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {profile.landingPageSlug && (
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-violet-500 shrink-0" />
                  <span className="text-sm text-violet-600 font-medium truncate">
                    flowsmartly.com/agents/{profile.landingPageSlug}
                  </span>
                </div>
              )}
              {portfolioUrls.map((url, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-brand-500 hover:underline truncate"
                  >
                    {url}
                  </a>
                </div>
              ))}
              {!profile.landingPageSlug && portfolioUrls.length === 0 && (
                <p className="text-sm text-muted-foreground">No links added</p>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/agent/clients" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <Users className="h-4 w-4 mr-2" />
                  View My Clients
                </Button>
              </Link>
              <Link href={`/hire-agent/agents/${profile.id}`} className="block">
                <Button variant="outline" className="w-full justify-start">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Public Profile
                </Button>
              </Link>
              <Link href="/hire-agent" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <Star className="h-4 w-4 mr-2" />
                  Browse Marketplace
                </Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
