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
  Sparkles,
  CheckCircle,
  Video,
  Camera,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { MediaUploader } from "@/components/shared/media-uploader";
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
  user?: { avatarUrl: string | null };
  _count: { clients: number; warnings: number };
}

interface ShowcaseProject {
  url: string;
  title: string;
  description: string;
  highlights?: string[];
  mediaType?: "image" | "video";
  additionalImages?: string[];
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

  // Collapse
  const [isAboutExpanded, setIsAboutExpanded] = useState(false);

  // Draft values
  const [draftDisplayName, setDraftDisplayName] = useState("");
  const [draftBio, setDraftBio] = useState("");
  const [draftSpecialties, setDraftSpecialties] = useState<string[]>([]);
  const [draftIndustries, setDraftIndustries] = useState<string[]>([]);
  const [draftMinPrice, setDraftMinPrice] = useState(0);
  const [draftPortfolioUrls, setDraftPortfolioUrls] = useState<string[]>([]);
  const [draftShowcase, setDraftShowcase] = useState<ShowcaseProject[]>([]);

  // AI generation
  const [generatingAIIndex, setGeneratingAIIndex] = useState<number | null>(null);

  // Showcase image replacement
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);

  // Lightbox
  const [selectedShowcase, setSelectedShowcase] = useState<ShowcaseProject | null>(null);

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
  const showcaseImages: ShowcaseProject[] = (() => { try { return JSON.parse(profile.showcaseImages); } catch { return []; } })();

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

  // Handle showcase URL changes from MediaUploader — map new URLs to ShowcaseProject objects
  const handleShowcaseUrlsChange = (urls: string[]) => {
    setDraftShowcase((prev) => {
      // Keep existing projects that are still in the URL list (preserves title/desc/highlights)
      const kept = prev.filter((p) => urls.includes(p.url));
      // Find newly added URLs
      const existingUrls = new Set(prev.map((p) => p.url));
      const added = urls.filter((u) => !existingUrls.has(u));
      // Create new ShowcaseProject entries for new URLs
      const newProjects: ShowcaseProject[] = added.map((url) => {
        const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(url);
        return { url, title: "", description: "", highlights: [], mediaType: isVideo ? "video" : "image" };
      });
      return [...kept, ...newProjects];
    });
  };

  const handleAIGenerate = async (index: number) => {
    const item = draftShowcase[index];
    if (!item?.title?.trim()) {
      toast({ title: "Add a project title first", description: "AI needs a title to generate the description.", variant: "destructive" });
      return;
    }
    setGeneratingAIIndex(index);
    try {
      const res = await fetch("/api/ai/project-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: item.title }),
      });
      const data = await res.json();
      if (data.success) {
        setDraftShowcase((d) =>
          d.map((p, j) =>
            j === index
              ? { ...p, description: data.data.description, highlights: data.data.highlights }
              : p
          )
        );
        toast({ title: "Description generated!" });
      } else {
        throw new Error(data.error?.message || "Generation failed");
      }
    } catch (error) {
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
    setGeneratingAIIndex(null);
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
      >
        <MediaUploader
          value={profile.coverImageUrl ? [profile.coverImageUrl] : []}
          onChange={(urls) => patchProfile({ coverImageUrl: urls[0] || null })}
          accept="image/png,image/jpeg,image/jpg,image/webp"
          maxSize={10 * 1024 * 1024}
          filterTypes={["image"]}
          variant="large"
          placeholder="Upload cover"
          libraryTitle="Select Cover Image"
        />
      </motion.div>

      {/* Profile Photo */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.13 }}
      >
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-full overflow-hidden bg-muted border-2 border-border shrink-0">
                {profile.user?.avatarUrl ? (
                  <img src={profile.user.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-violet-500/10">
                    <User className="h-8 w-8 text-violet-500" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <Camera className="h-4 w-4 text-muted-foreground" />
                  <p className="font-medium text-sm">Profile Photo</p>
                </div>
                <p className="text-xs text-muted-foreground mb-2">Shown on your marketplace listing and reviews</p>
                <MediaUploader
                  value={profile.user?.avatarUrl ? [profile.user.avatarUrl] : []}
                  onChange={(urls) => patchProfile({ avatarUrl: urls[0] || null })}
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  maxSize={5 * 1024 * 1024}
                  filterTypes={["image"]}
                  variant="small"
                  placeholder="Upload photo"
                  libraryTitle="Select Profile Photo"
                />
              </div>
            </div>
          </CardContent>
        </Card>
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

      {/* Main Content — Full Width */}
      <div className="space-y-6">
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

            {/* Preview when collapsed */}
            {!isAboutExpanded && !isEditingAbout && profile.bio && (
              <div className="px-6 pb-4 -mt-2">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {profile.bio}
                </p>
              </div>
            )}

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

          {/* ── Project Showcase Card ── */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-pink-500/20 to-violet-500/20 flex items-center justify-center">
                  <ImageIcon className="h-4 w-4 text-pink-500" />
                </div>
                Featured Projects
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
                  onClick={() => { setDraftShowcase(showcaseImages.map(p => ({ ...p, highlights: p.highlights || [], mediaType: p.mediaType || "image", additionalImages: p.additionalImages || [] }))); setIsEditingShowcase(true); }}
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
                    <p className="text-sm text-muted-foreground">No projects yet.</p>
                    <p className="text-xs text-muted-foreground mt-1">Showcase your best work to attract clients.</p>
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
                  /* View mode — presentation style */
                  <div className="space-y-6">
                    {showcaseImages.map((project, i) => (
                      <motion.div
                        key={project.url}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08 }}
                      >
                        {i > 0 && <div className="h-px bg-border mb-6" />}
                        <div className="flex flex-col md:flex-row gap-5 items-start">
                          {/* Media */}
                          <div
                            className="w-full md:w-1/2 shrink-0 cursor-pointer group"
                            onClick={() => setSelectedShowcase(project)}
                          >
                            <div className="aspect-[4/3] rounded-xl overflow-hidden bg-muted relative shadow-sm">
                              {project.mediaType === "video" ? (
                                <video
                                  src={project.url}
                                  className="w-full h-full object-cover"
                                  muted
                                  playsInline
                                  onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
                                  onMouseLeave={(e) => { (e.target as HTMLVideoElement).pause(); (e.target as HTMLVideoElement).currentTime = 0; }}
                                />
                              ) : (
                                <img src={project.url} alt={project.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                              )}
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  {project.mediaType === "video" ? <Video className="h-5 w-5 text-white" /> : <Eye className="h-5 w-5 text-white" />}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Details */}
                          <div className="flex-1 min-w-0 py-1">
                            <h3 className="text-lg font-bold">{project.title || "Untitled Project"}</h3>
                            {project.description && (
                              <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                                {project.description}
                              </p>
                            )}
                            {project.highlights && project.highlights.length > 0 && (
                              <ul className="mt-3 space-y-2">
                                {project.highlights.map((h, hi) => (
                                  <li key={hi} className="flex items-start gap-2 text-sm">
                                    <CheckCircle className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" />
                                    <span>{h}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )
              ) : (
                /* Edit mode */
                <div className="space-y-6">
                  {draftShowcase.map((project, i) => (
                    <div key={`${project.url}-${i}`} className="border rounded-xl p-4 space-y-3 relative">
                      {/* Action buttons */}
                      <div className="absolute top-3 right-3 flex items-center gap-1.5">
                        <button
                          className="h-7 w-7 rounded-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 flex items-center justify-center transition-colors"
                          title="Replace image"
                          onClick={() => setReplacingIndex(replacingIndex === i ? null : i)}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="h-7 w-7 rounded-full bg-destructive/10 hover:bg-destructive/20 text-destructive flex items-center justify-center transition-colors"
                          title="Remove project"
                          onClick={() => { setDraftShowcase((d) => d.filter((_, j) => j !== i)); if (replacingIndex === i) setReplacingIndex(null); }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Media preview */}
                      <div className="aspect-video rounded-lg overflow-hidden bg-muted max-w-xs relative group">
                        {project.mediaType === "video" ? (
                          <video src={project.url} className="w-full h-full object-cover" muted playsInline />
                        ) : (
                          <img src={project.url} alt={project.title} className="w-full h-full object-cover" />
                        )}
                        {/* Click to replace overlay */}
                        <button
                          className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center"
                          onClick={() => setReplacingIndex(replacingIndex === i ? null : i)}
                        >
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 text-xs font-medium text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                            <RefreshCw className="h-3 w-3" />
                            Replace
                          </div>
                        </button>
                      </div>

                      {/* Replace image uploader */}
                      {replacingIndex === i && (
                        <div className="border border-blue-200 rounded-lg p-3 bg-blue-50/50 dark:bg-blue-900/10">
                          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-2">Select a new image to replace this one:</p>
                          <MediaUploader
                            value={[]}
                            onChange={(urls) => {
                              if (urls.length > 0) {
                                const newUrl = urls[urls.length - 1];
                                const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(newUrl);
                                setDraftShowcase((d) =>
                                  d.map((item, j) => j === i ? { ...item, url: newUrl, mediaType: isVideo ? "video" : "image" } : item)
                                );
                                setReplacingIndex(null);
                              }
                            }}
                            accept="image/png,image/jpeg,image/jpg,image/webp,video/mp4,video/webm"
                            maxSize={100 * 1024 * 1024}
                            filterTypes={["image", "video"]}
                            variant="small"
                            placeholder="Upload replacement"
                            libraryTitle="Select Replacement Media"
                          />
                        </div>
                      )}

                      {/* Title */}
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Title</Label>
                        <Input
                          placeholder="Project title..."
                          value={project.title}
                          onChange={(e) =>
                            setDraftShowcase((d) =>
                              d.map((item, j) => (j === i ? { ...item, title: e.target.value } : item))
                            )
                          }
                          className="h-9"
                        />
                      </div>

                      {/* Description with AI button */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <Label className="text-xs text-muted-foreground">Description</Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-violet-600 hover:text-violet-700 hover:bg-violet-500/10"
                            onClick={() => handleAIGenerate(i)}
                            disabled={generatingAIIndex !== null}
                          >
                            {generatingAIIndex === i ? (
                              <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Generating...</>
                            ) : (
                              <><Sparkles className="h-3 w-3 mr-1" />AI Generate</>
                            )}
                          </Button>
                        </div>
                        <textarea
                          value={project.description}
                          onChange={(e) =>
                            setDraftShowcase((d) =>
                              d.map((item, j) => (j === i ? { ...item, description: e.target.value } : item))
                            )
                          }
                          placeholder="Describe what you delivered, the impact, and results..."
                          rows={3}
                          maxLength={500}
                          className="w-full p-2.5 rounded-lg border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50"
                        />
                      </div>

                      {/* Highlights */}
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Key Highlights</Label>
                        <div className="space-y-1.5">
                          {(project.highlights || []).map((h, hi) => (
                            <div key={hi} className="flex items-center gap-1.5">
                              <CheckCircle className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                              <Input
                                value={h}
                                onChange={(e) =>
                                  setDraftShowcase((d) =>
                                    d.map((item, j) =>
                                      j === i
                                        ? { ...item, highlights: (item.highlights || []).map((hl, hli) => (hli === hi ? e.target.value : hl)) }
                                        : item
                                    )
                                  )
                                }
                                placeholder="e.g. 250% engagement increase"
                                className="h-8 text-sm flex-1"
                              />
                              <button
                                className="h-6 w-6 rounded text-muted-foreground hover:text-destructive transition-colors flex items-center justify-center shrink-0"
                                onClick={() =>
                                  setDraftShowcase((d) =>
                                    d.map((item, j) =>
                                      j === i
                                        ? { ...item, highlights: (item.highlights || []).filter((_, hli) => hli !== hi) }
                                        : item
                                    )
                                  )
                                }
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                          {(project.highlights || []).length < 5 && (
                            <button
                              className="text-xs text-violet-600 hover:text-violet-700 flex items-center gap-1 mt-1"
                              onClick={() =>
                                setDraftShowcase((d) =>
                                  d.map((item, j) =>
                                    j === i
                                      ? { ...item, highlights: [...(item.highlights || []), ""] }
                                      : item
                                  )
                                )
                              }
                            >
                              <Plus className="h-3 w-3" />Add highlight
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Additional Images */}
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1.5 block">Additional Images</Label>
                        {(project.additionalImages || []).length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-2">
                            {(project.additionalImages || []).map((imgUrl, imgIdx) => (
                              <div key={imgIdx} className="relative w-20 h-20 rounded-lg overflow-hidden bg-muted group/thumb">
                                {/\.(mp4|webm|mov)(\?|$)/i.test(imgUrl) ? (
                                  <video src={imgUrl} className="w-full h-full object-cover" muted preload="metadata" />
                                ) : (
                                  <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                                )}
                                <button
                                  className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                                  onClick={() =>
                                    setDraftShowcase((d) =>
                                      d.map((item, j) =>
                                        j === i
                                          ? { ...item, additionalImages: (item.additionalImages || []).filter((_, k) => k !== imgIdx) }
                                          : item
                                      )
                                    )
                                  }
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <MediaUploader
                          value={project.additionalImages || []}
                          onChange={(urls) =>
                            setDraftShowcase((d) =>
                              d.map((item, j) => j === i ? { ...item, additionalImages: urls } : item)
                            )
                          }
                          multiple
                          maxFiles={8}
                          accept="image/png,image/jpeg,image/jpg,image/webp,video/mp4,video/webm"
                          maxSize={100 * 1024 * 1024}
                          filterTypes={["image", "video"]}
                          variant="small"
                          placeholder="Add images"
                          libraryTitle="Select Project Images"
                          showButtons={true}
                        />
                      </div>
                    </div>
                  ))}

                  {/* Add project media */}
                  {draftShowcase.length < 12 && (
                    <MediaUploader
                      value={draftShowcase.map((p) => p.url)}
                      onChange={handleShowcaseUrlsChange}
                      multiple
                      maxFiles={12}
                      accept="image/png,image/jpeg,image/jpg,image/webp,video/mp4,video/webm"
                      maxSize={100 * 1024 * 1024}
                      filterTypes={["image", "video"]}
                      variant="medium"
                      placeholder="Add work"
                      libraryTitle="Select Showcase Media"
                      showButtons={true}
                    />
                  )}
                  <p className="text-xs text-muted-foreground">
                    Up to 12 projects. Add a title then click AI Generate to create a description.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Specialties & Industries — Side by Side ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
          </div>

          {/* ── Pricing & Links — Side by Side ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
          </div>

          {/* ── Quick Actions — Horizontal ── */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Link href="/agent/clients">
                  <Button variant="outline" size="sm">
                    <Users className="h-4 w-4 mr-2" />
                    View My Clients
                  </Button>
                </Link>
                <Link href={`/hire-agent/agents/${profile.id}`}>
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Public Profile
                  </Button>
                </Link>
                <Link href="/hire-agent">
                  <Button variant="outline" size="sm">
                    <Star className="h-4 w-4 mr-2" />
                    Browse Marketplace
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
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
                <div className="p-5 border-t">
                  {selectedShowcase.title && (
                    <h3 className="text-lg font-bold">{selectedShowcase.title}</h3>
                  )}
                  {selectedShowcase.description && (
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{selectedShowcase.description}</p>
                  )}
                  {selectedShowcase.highlights && selectedShowcase.highlights.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {selectedShowcase.highlights.map((h, hi) => (
                        <li key={hi} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" />
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
