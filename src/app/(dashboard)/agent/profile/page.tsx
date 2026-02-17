"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
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
  ChevronDown,
  Camera,
  Trash2,
  Check,
  X,
  Plus,
  Target,
  BarChart3,
  MessageSquare,
  FileText,
  Calendar,
  Image as ImageIcon,
  Eye,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { MediaLibraryPicker } from "@/components/shared/media-library-picker";
import { SPECIALTY_OPTIONS, INDUSTRY_OPTIONS } from "@/lib/agent/constants";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentProfile {
  id: string;
  displayName: string;
  bio: string | null;
  coverImageUrl: string | null;
  showcaseImages: string;
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

interface ShowcaseImage {
  url: string;
  title: string;
  description: string;
}

// ─── Banner SVG ───────────────────────────────────────────────────────────────

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgentProfilePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Section edit toggles
  const [isEditingAbout, setIsEditingAbout] = useState(false);
  const [isEditingSpecialties, setIsEditingSpecialties] = useState(false);
  const [isEditingIndustries, setIsEditingIndustries] = useState(false);
  const [isEditingShowcase, setIsEditingShowcase] = useState(false);
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [isEditingLinks, setIsEditingLinks] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Cover upload
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [showCoverLibrary, setShowCoverLibrary] = useState(false);

  // Showcase upload
  const [isUploadingShowcase, setIsUploadingShowcase] = useState(false);
  const [showShowcaseLibrary, setShowShowcaseLibrary] = useState(false);

  // Collapse
  const [isAboutExpanded, setIsAboutExpanded] = useState(true);

  // Draft values
  const [draftDisplayName, setDraftDisplayName] = useState("");
  const [draftBio, setDraftBio] = useState("");
  const [draftSpecialties, setDraftSpecialties] = useState<string[]>([]);
  const [draftIndustries, setDraftIndustries] = useState<string[]>([]);
  const [draftMinPrice, setDraftMinPrice] = useState(0);
  const [draftPortfolioUrls, setDraftPortfolioUrls] = useState<string[]>([]);
  const [draftShowcase, setDraftShowcase] = useState<ShowcaseImage[]>([]);

  // Lightbox
  const [selectedShowcase, setSelectedShowcase] = useState<ShowcaseImage | null>(null);

  // ─── Fetch ────────────────────────────────────────────────────────────────

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

  // ─── Parse JSON ───────────────────────────────────────────────────────────

  const specialties: string[] = (() => { try { return JSON.parse(profile.specialties); } catch { return []; } })();
  const industries: string[] = (() => { try { return JSON.parse(profile.industries); } catch { return []; } })();
  const portfolioUrls: string[] = (() => { try { return JSON.parse(profile.portfolioUrls); } catch { return []; } })();
  const showcaseImages: ShowcaseImage[] = (() => { try { return JSON.parse(profile.showcaseImages); } catch { return []; } })();

  // ─── Save Helper ──────────────────────────────────────────────────────────

  const patchProfile = async (updates: Record<string, unknown>) => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/agent/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (data.success) {
        setProfile(data.data.profile);
        toast({ title: "Profile updated!" });
        return true;
      } else {
        throw new Error(data.error?.message || "Update failed");
      }
    } catch (error) {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Cover Image Handlers ────────────────────────────────────────────────

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingCover(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/media", { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) {
        await patchProfile({ coverImageUrl: data.data.file.url });
      }
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    }
    setIsUploadingCover(false);
    e.target.value = "";
  };

  const handleCoverFromLibrary = async (url: string) => {
    setShowCoverLibrary(false);
    setIsUploadingCover(true);
    await patchProfile({ coverImageUrl: url });
    setIsUploadingCover(false);
  };

  const handleRemoveCover = async () => {
    await patchProfile({ coverImageUrl: null });
  };

  // ─── About Handlers ──────────────────────────────────────────────────────

  const startEditAbout = () => {
    setDraftDisplayName(profile.displayName);
    setDraftBio(profile.bio || "");
    setIsEditingAbout(true);
    setIsAboutExpanded(true);
  };

  const handleSaveAbout = async () => {
    if (!draftDisplayName.trim()) {
      toast({ title: "Display name is required", variant: "destructive" });
      return;
    }
    const ok = await patchProfile({ displayName: draftDisplayName.trim(), bio: draftBio.trim() || null });
    if (ok) setIsEditingAbout(false);
  };

  // ─── Specialties Handlers ────────────────────────────────────────────────

  const handleSaveSpecialties = async () => {
    const ok = await patchProfile({ specialties: draftSpecialties });
    if (ok) setIsEditingSpecialties(false);
  };

  // ─── Industries Handlers ─────────────────────────────────────────────────

  const handleSaveIndustries = async () => {
    const ok = await patchProfile({ industries: draftIndustries });
    if (ok) setIsEditingIndustries(false);
  };

  // ─── Showcase Handlers ───────────────────────────────────────────────────

  const handleAddShowcaseFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingShowcase(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/media", { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) {
        setDraftShowcase((d) => [...d, { url: data.data.file.url, title: "", description: "" }]);
      }
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    }
    setIsUploadingShowcase(false);
    e.target.value = "";
  };

  const handleAddShowcaseFromLibrary = (url: string) => {
    setShowShowcaseLibrary(false);
    setDraftShowcase((d) => [...d, { url, title: "", description: "" }]);
  };

  const handleSaveShowcase = async () => {
    const ok = await patchProfile({ showcaseImages: draftShowcase });
    if (ok) setIsEditingShowcase(false);
  };

  // ─── Pricing Handler ─────────────────────────────────────────────────────

  const handleSavePrice = async () => {
    if (draftMinPrice < 10000) {
      toast({ title: "Minimum is $100/month", variant: "destructive" });
      return;
    }
    const ok = await patchProfile({ minPricePerMonth: draftMinPrice });
    if (ok) setIsEditingPrice(false);
  };

  // ─── Links Handler ───────────────────────────────────────────────────────

  const handleSaveLinks = async () => {
    const cleaned = draftPortfolioUrls.filter((u) => u.trim());
    const ok = await patchProfile({ portfolioUrls: cleaned });
    if (ok) setIsEditingLinks(false);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

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
        <Link href={`/hire-agent/agents/${profile.id}`}>
          <Button variant="outline" size="sm">
            <ExternalLink className="h-4 w-4 mr-2" />
            View Public Profile
          </Button>
        </Link>
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

      {/* Cover Image */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="relative w-full h-40 md:h-56 rounded-2xl overflow-hidden group"
      >
        {profile.coverImageUrl ? (
          <img
            src={profile.coverImageUrl}
            alt="Cover"
            className="w-full h-full object-cover"
          />
        ) : (
          <ProfileBannerSVG />
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
          <label htmlFor="cover-upload" className="cursor-pointer">
            <Button variant="secondary" size="sm" disabled={isUploadingCover} asChild>
              <span>
                {isUploadingCover ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading...</>
                ) : (
                  <><Camera className="h-4 w-4 mr-2" />Upload Cover</>
                )}
              </span>
            </Button>
          </label>
          <Button variant="secondary" size="sm" onClick={() => setShowCoverLibrary(true)} disabled={isUploadingCover}>
            <FolderOpen className="h-4 w-4 mr-2" />
            Media Library
          </Button>
          {profile.coverImageUrl && (
            <Button variant="destructive" size="sm" onClick={handleRemoveCover}>
              <Trash2 className="h-4 w-4 mr-2" />Remove
            </Button>
          )}
        </div>

        <input
          id="cover-upload"
          type="file"
          className="hidden"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleCoverUpload}
        />
      </motion.div>

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

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2 space-y-6"
        >
          {/* ── About Card (Collapsible) ── */}
          <Card className="overflow-hidden">
            <CardHeader
              className="cursor-pointer select-none"
              onClick={() => !isEditingAbout && setIsAboutExpanded(!isAboutExpanded)}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                    <MessageSquare className="h-4 w-4 text-violet-500" />
                  </div>
                  About Me
                </CardTitle>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {!isEditingAbout ? (
                    <>
                      <Button variant="ghost" size="sm" onClick={startEditAbout}>
                        <Pencil className="h-3.5 w-3.5 mr-1" />Edit
                      </Button>
                      <motion.div animate={{ rotate: isAboutExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </motion.div>
                    </>
                  ) : (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => setIsEditingAbout(false)}>
                        <X className="h-3.5 w-3.5 mr-1" />Cancel
                      </Button>
                      <Button size="sm" onClick={handleSaveAbout} disabled={isSaving}>
                        {isSaving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                        Save
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>

            <AnimatePresence initial={false}>
              {isAboutExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <CardContent className="space-y-4 pt-0">
                    {isEditingAbout ? (
                      <div className="space-y-4">
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
                            Display Name
                          </Label>
                          <Input
                            value={draftDisplayName}
                            onChange={(e) => setDraftDisplayName(e.target.value)}
                            placeholder="Your professional name"
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
                            Bio
                          </Label>
                          <textarea
                            value={draftBio}
                            onChange={(e) => setDraftBio(e.target.value)}
                            placeholder="Tell clients about yourself, your experience, and what makes you unique..."
                            rows={6}
                            maxLength={1000}
                            className="w-full p-3 rounded-lg border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50"
                          />
                          <p className="text-xs text-muted-foreground text-right mt-1">
                            {draftBio.length} / 1,000
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Display Name */}
                        <div className="flex items-start gap-3">
                          <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                            <User className="h-4 w-4 text-blue-500" />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Display Name</p>
                            <p className="font-semibold text-lg">{profile.displayName}</p>
                          </div>
                        </div>

                        {/* Bio */}
                        {profile.bio && (
                          <>
                            <div className="h-px bg-border" />
                            <div className="flex items-start gap-3">
                              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                                <FileText className="h-4 w-4 text-emerald-500" />
                              </div>
                              <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Bio</p>
                                <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                                  {profile.bio}
                                </p>
                              </div>
                            </div>
                          </>
                        )}

                        {/* Agent Since */}
                        {profile.approvedAt && (
                          <>
                            <div className="h-px bg-border" />
                            <div className="flex items-start gap-3">
                              <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
                                <Calendar className="h-4 w-4 text-amber-500" />
                              </div>
                              <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Agent Since</p>
                                <p className="font-medium">{format(new Date(profile.approvedAt), "MMMM yyyy")}</p>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </CardContent>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>

          {/* ── Specialties Card ── */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <Target className="h-4 w-4 text-violet-500" />
                </div>
                Specialties
              </CardTitle>
              {isEditingSpecialties ? (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setIsEditingSpecialties(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleSaveSpecialties} disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                    Save
                  </Button>
                </div>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => { setDraftSpecialties([...specialties]); setIsEditingSpecialties(true); }}>
                  <Pencil className="h-3.5 w-3.5 mr-1" />Edit
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {isEditingSpecialties ? (
                <div className="flex flex-wrap gap-2">
                  {SPECIALTY_OPTIONS.map((s) => (
                    <Badge
                      key={s}
                      variant={draftSpecialties.includes(s) ? "default" : "outline"}
                      className={`cursor-pointer transition-all ${
                        draftSpecialties.includes(s)
                          ? "bg-violet-500 hover:bg-violet-600 text-white"
                          : "hover:border-violet-400 hover:text-violet-600"
                      }`}
                      onClick={() =>
                        setDraftSpecialties((d) =>
                          d.includes(s) ? d.filter((x) => x !== s) : [...d, s]
                        )
                      }
                    >
                      {draftSpecialties.includes(s) && <Check className="h-3 w-3 mr-1" />}
                      {s}
                    </Badge>
                  ))}
                </div>
              ) : (
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
              )}
            </CardContent>
          </Card>

          {/* ── Industries Card ── */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <BarChart3 className="h-4 w-4 text-blue-500" />
                </div>
                Industries
              </CardTitle>
              {isEditingIndustries ? (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setIsEditingIndustries(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleSaveIndustries} disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                    Save
                  </Button>
                </div>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => { setDraftIndustries([...industries]); setIsEditingIndustries(true); }}>
                  <Pencil className="h-3.5 w-3.5 mr-1" />Edit
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {isEditingIndustries ? (
                <div className="flex flex-wrap gap-2">
                  {INDUSTRY_OPTIONS.map((ind) => (
                    <Badge
                      key={ind}
                      variant={draftIndustries.includes(ind) ? "default" : "outline"}
                      className={`cursor-pointer transition-all ${
                        draftIndustries.includes(ind)
                          ? "bg-blue-500 hover:bg-blue-600 text-white"
                          : "hover:border-blue-400 hover:text-blue-600"
                      }`}
                      onClick={() =>
                        setDraftIndustries((d) =>
                          d.includes(ind) ? d.filter((x) => x !== ind) : [...d, ind]
                        )
                      }
                    >
                      {draftIndustries.includes(ind) && <Check className="h-3 w-3 mr-1" />}
                      {ind}
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {industries.map((ind) => (
                    <Badge key={ind} variant="outline">{ind}</Badge>
                  ))}
                  {industries.length === 0 && (
                    <p className="text-sm text-muted-foreground">No industries selected</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Project Showcase Card ── */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-pink-500/10 flex items-center justify-center">
                  <ImageIcon className="h-4 w-4 text-pink-500" />
                </div>
                Project Showcase
                {showcaseImages.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">{showcaseImages.length}</Badge>
                )}
              </CardTitle>
              {isEditingShowcase ? (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setIsEditingShowcase(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleSaveShowcase} disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                    Save
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setDraftShowcase([...showcaseImages]); setIsEditingShowcase(true); }}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" />Manage
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {!isEditingShowcase ? (
                showcaseImages.length === 0 ? (
                  <div className="border-2 border-dashed rounded-xl p-8 text-center">
                    <ImageIcon className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No showcase images yet.</p>
                    <p className="text-xs text-muted-foreground mt-1">Add images of your past projects to attract clients.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => { setDraftShowcase([]); setIsEditingShowcase(true); }}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />Add Projects
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-4 overflow-x-auto pb-3 -mx-1 px-1 snap-x snap-mandatory">
                    {showcaseImages.map((img, i) => (
                      <motion.div
                        key={img.url}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className="shrink-0 w-52 snap-start cursor-pointer group"
                        onClick={() => setSelectedShowcase(img)}
                      >
                        <div className="aspect-video rounded-lg overflow-hidden bg-muted relative">
                          <img src={img.url} alt={img.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                            <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                        <p className="text-xs font-medium mt-1.5 truncate">{img.title || "Untitled Project"}</p>
                        {img.description && (
                          <p className="text-xs text-muted-foreground truncate">{img.description}</p>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {draftShowcase.map((img, i) => (
                      <div key={`${img.url}-${i}`} className="relative group">
                        <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                          <img src={img.url} alt={img.title} className="w-full h-full object-cover" />
                        </div>
                        <button
                          className="absolute top-1 right-1 h-6 w-6 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => setDraftShowcase((d) => d.filter((_, j) => j !== i))}
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <input
                          className="mt-1.5 w-full text-xs border rounded-md px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-violet-500/30"
                          placeholder="Project title..."
                          value={img.title}
                          onChange={(e) =>
                            setDraftShowcase((d) =>
                              d.map((item, j) => (j === i ? { ...item, title: e.target.value } : item))
                            )
                          }
                        />
                      </div>
                    ))}

                    {/* Add buttons */}
                    {draftShowcase.length < 12 && (
                      <div className="aspect-video rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2">
                        {isUploadingShowcase ? (
                          <Loader2 className="h-6 w-6 text-violet-500 animate-spin" />
                        ) : (
                          <>
                            <label className="cursor-pointer flex flex-col items-center gap-1 hover:text-violet-500 transition-colors">
                              <Plus className="h-5 w-5" />
                              <span className="text-xs">Upload</span>
                              <input
                                type="file"
                                className="hidden"
                                accept="image/png,image/jpeg,image/webp"
                                onChange={handleAddShowcaseFile}
                                disabled={isUploadingShowcase}
                              />
                            </label>
                            <button
                              className="text-xs text-muted-foreground hover:text-violet-500 transition-colors flex items-center gap-1"
                              onClick={() => setShowShowcaseLibrary(true)}
                            >
                              <FolderOpen className="h-3.5 w-3.5" />
                              Library
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Up to 12 images. Hover to remove, click title to rename.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Right Column */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="space-y-6"
        >
          {/* ── Pricing Card ── */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-emerald-500" />
                </div>
                Pricing
              </CardTitle>
              {isEditingPrice ? (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setIsEditingPrice(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleSavePrice} disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                    Save
                  </Button>
                </div>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => { setDraftMinPrice(profile.minPricePerMonth); setIsEditingPrice(true); }}>
                  <Pencil className="h-3.5 w-3.5 mr-1" />Edit
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {isEditingPrice ? (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Minimum monthly rate</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground font-medium">$</span>
                    <Input
                      type="number"
                      min={100}
                      value={draftMinPrice / 100}
                      onChange={(e) => setDraftMinPrice(Math.round(parseFloat(e.target.value || "0") * 100))}
                      className="h-9"
                    />
                    <span className="text-sm text-muted-foreground">/mo</span>
                  </div>
                  {draftMinPrice < 10000 && (
                    <p className="text-xs text-destructive">Minimum is $100/month</p>
                  )}
                </div>
              ) : (
                <div className="text-center py-2">
                  <p className="text-3xl font-bold text-violet-600">
                    ${(profile.minPricePerMonth / 100).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">per month starting rate</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Links Card ── */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Globe className="h-4 w-4 text-blue-500" />
                </div>
                Links
              </CardTitle>
              {isEditingLinks ? (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setIsEditingLinks(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleSaveLinks} disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                    Save
                  </Button>
                </div>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => { setDraftPortfolioUrls([...portfolioUrls]); setIsEditingLinks(true); }}>
                  <Pencil className="h-3.5 w-3.5 mr-1" />Edit
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {isEditingLinks ? (
                <div className="space-y-2">
                  {draftPortfolioUrls.map((url, i) => (
                    <div key={i} className="flex gap-1">
                      <Input
                        value={url}
                        onChange={(e) =>
                          setDraftPortfolioUrls((d) =>
                            d.map((u, j) => (j === i ? e.target.value : u))
                          )
                        }
                        placeholder="https://..."
                        className="text-sm h-8"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => setDraftPortfolioUrls((d) => d.filter((_, j) => j !== i))}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  {draftPortfolioUrls.length < 5 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setDraftPortfolioUrls((d) => [...d, ""])}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />Add URL
                    </Button>
                  )}
                </div>
              ) : (
                <>
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
                </>
              )}
            </CardContent>
          </Card>

          {/* ── Quick Actions ── */}
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

      {/* ── Showcase Lightbox ── */}
      <Dialog open={!!selectedShowcase} onOpenChange={() => setSelectedShowcase(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          {selectedShowcase && (
            <>
              <div className="relative bg-black/90">
                <img
                  src={selectedShowcase.url}
                  alt={selectedShowcase.title}
                  className="w-full max-h-[70vh] object-contain"
                />
                {/* Navigation arrows */}
                {showcaseImages.length > 1 && (
                  <>
                    <button
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                      onClick={() => {
                        const idx = showcaseImages.findIndex((i) => i.url === selectedShowcase.url);
                        setSelectedShowcase(showcaseImages[(idx - 1 + showcaseImages.length) % showcaseImages.length]);
                      }}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                      onClick={() => {
                        const idx = showcaseImages.findIndex((i) => i.url === selectedShowcase.url);
                        setSelectedShowcase(showcaseImages[(idx + 1) % showcaseImages.length]);
                      }}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}
              </div>
              {(selectedShowcase.title || selectedShowcase.description) && (
                <div className="p-4 border-t">
                  {selectedShowcase.title && (
                    <h3 className="font-semibold">{selectedShowcase.title}</h3>
                  )}
                  {selectedShowcase.description && (
                    <p className="text-sm text-muted-foreground mt-1">{selectedShowcase.description}</p>
                  )}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Media Library Pickers ── */}
      <MediaLibraryPicker
        open={showCoverLibrary}
        onClose={() => setShowCoverLibrary(false)}
        onSelect={handleCoverFromLibrary}
        title="Select Cover Image"
        filterTypes={["image"]}
      />
      <MediaLibraryPicker
        open={showShowcaseLibrary}
        onClose={() => setShowShowcaseLibrary(false)}
        onSelect={handleAddShowcaseFromLibrary}
        title="Select Showcase Image"
        filterTypes={["image"]}
      />
    </div>
  );
}
