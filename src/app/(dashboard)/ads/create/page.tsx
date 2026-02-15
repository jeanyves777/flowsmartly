"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  Megaphone,
  Search,
  Check,
  Eye,
  Heart,
  Globe,
  Target,
  Users,
  Calendar,
  DollarSign,
  Loader2,
  Image as ImageIcon,
  Video,
  Type,
  Rocket,
  MessageCircle,
  Sparkles,
  X,
  Lock,
  ShoppingBag,
  ExternalLink,
  Upload,
  ShieldCheck,
  AlertTriangle,
  Link2,
  FileText,
  Layout,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useSocialPlatforms } from "@/hooks/use-social-platforms";

// Platform SVG icons
function InstagramIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function FacebookIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function XIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedInIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function TikTokIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

function FeedIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="4" rx="1" />
      <rect x="14" y="10" width="7" height="7" rx="1" />
      <rect x="3" y="13" width="7" height="4" rx="1" />
      <rect x="3" y="20" width="18" height="1" rx="0.5" />
    </svg>
  );
}

type AdType = "POST" | "PRODUCT_LINK" | "LANDING_PAGE" | "EXTERNAL_URL";

const AD_TYPES: { id: AdType; label: string; icon: typeof ImageIcon; description: string; color: string }[] = [
  { id: "POST", label: "Promote Post", icon: ImageIcon, description: "Boost your existing feed posts", color: "from-blue-500 to-indigo-600" },
  { id: "PRODUCT_LINK", label: "Product Link", icon: ShoppingBag, description: "Promote a product with image/video", color: "from-emerald-500 to-teal-600" },
  { id: "LANDING_PAGE", label: "Landing Page", icon: FileText, description: "Promote a landing page you built", color: "from-purple-500 to-violet-600" },
  { id: "EXTERNAL_URL", label: "External URL", icon: ExternalLink, description: "Promote any website or link", color: "from-orange-500 to-red-600" },
];

const AD_CATEGORIES = [
  "E-commerce / Shopping",
  "SaaS / Technology",
  "Health & Wellness",
  "Education / Courses",
  "Entertainment",
  "Fashion & Beauty",
  "Food & Dining",
  "Finance / Crypto",
  "Real Estate",
  "Travel",
  "Non-profit",
  "Other",
];

const TEMPLATE_STYLES = [
  { id: "hero", label: "Hero", description: "Full-bleed image with overlay text" },
  { id: "minimal", label: "Minimal", description: "Clean centered layout" },
  { id: "split", label: "Split", description: "Image left, text right" },
  { id: "video", label: "Video", description: "Video player with text below" },
];

interface LandingPageOption {
  id: string;
  title: string;
  slug: string;
  thumbnailUrl: string | null;
  description: string | null;
}

// Static platform metadata (icons, brand colors). Connection status comes from DB.
const PLATFORM_META: Record<string, { name: string; icon: typeof FeedIcon; color: string; bgColor: string }> = {
  feed: { name: "Feed", icon: FeedIcon, color: "#8B5CF6", bgColor: "rgba(139,92,246,0.1)" },
  instagram: { name: "Instagram", icon: InstagramIcon, color: "#E4405F", bgColor: "rgba(228,64,95,0.1)" },
  facebook: { name: "Facebook", icon: FacebookIcon, color: "#1877F2", bgColor: "rgba(24,119,242,0.1)" },
  twitter: { name: "X (Twitter)", icon: XIcon, color: "#000000", bgColor: "rgba(0,0,0,0.06)" },
  linkedin: { name: "LinkedIn", icon: LinkedInIcon, color: "#0A66C2", bgColor: "rgba(10,102,194,0.1)" },
  tiktok: { name: "TikTok", icon: TikTokIcon, color: "#000000", bgColor: "rgba(0,0,0,0.06)" },
};

const OBJECTIVES = [
  { value: "AWARENESS", label: "Brand Awareness", icon: Eye, description: "Get more people to see your content" },
  { value: "ENGAGEMENT", label: "Engagement", icon: Heart, description: "Increase likes, comments, and shares" },
  { value: "TRAFFIC", label: "Website Traffic", icon: Globe, description: "Drive visitors to your website" },
  { value: "CONVERSIONS", label: "Conversions", icon: Target, description: "Turn viewers into customers" },
  { value: "LEADS", label: "Lead Generation", icon: Users, description: "Collect potential customer info" },
];

interface UserPost {
  id: string;
  content: string | null;
  mediaUrls: string[];
  mediaType: string | null;
  likesCount: number;
  commentsCount: number;
  isPromoted: boolean;
  createdAt: string;
}

type TagCategory = "age" | "gender" | "interest" | "behavior" | "location" | "income" | "device";

interface AudienceTag {
  label: string;
  category: TagCategory;
}

const TAG_CATEGORY_CONFIG: Record<TagCategory, { label: string; color: string; bg: string }> = {
  age: { label: "Age", color: "text-blue-600", bg: "bg-blue-500/10 border-blue-500/20" },
  gender: { label: "Gender", color: "text-pink-600", bg: "bg-pink-500/10 border-pink-500/20" },
  interest: { label: "Interest", color: "text-purple-600", bg: "bg-purple-500/10 border-purple-500/20" },
  behavior: { label: "Behavior", color: "text-amber-600", bg: "bg-amber-500/10 border-amber-500/20" },
  location: { label: "Location", color: "text-green-600", bg: "bg-green-500/10 border-green-500/20" },
  income: { label: "Income", color: "text-emerald-600", bg: "bg-emerald-500/10 border-emerald-500/20" },
  device: { label: "Device", color: "text-cyan-600", bg: "bg-cyan-500/10 border-cyan-500/20" },
};

const DEFAULT_TAGS: AudienceTag[] = [
  { label: "18-24 years old", category: "age" },
  { label: "25-34 years old", category: "age" },
  { label: "35-44 years old", category: "age" },
  { label: "Fashion & Style", category: "interest" },
  { label: "Technology", category: "interest" },
  { label: "Health & Fitness", category: "interest" },
  { label: "Food & Dining", category: "interest" },
  { label: "Travel", category: "interest" },
  { label: "Business & Finance", category: "interest" },
  { label: "Entertainment", category: "interest" },
  { label: "Online shoppers", category: "behavior" },
  { label: "Engaged users", category: "behavior" },
  { label: "Frequent travelers", category: "behavior" },
  { label: "United States", category: "location" },
  { label: "Europe", category: "location" },
  { label: "Worldwide", category: "location" },
  { label: "Mobile users", category: "device" },
  { label: "Female", category: "gender" },
  { label: "Male", category: "gender" },
  { label: "All genders", category: "gender" },
];

const CREDIT_TO_CENTS = 1;

export default function CreateCampaignPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { isConnected } = useSocialPlatforms();
  const preSelectedPostId = searchParams.get("postId");

  // Build dynamic platform list: "feed" always enabled, socials enabled if connected in DB
  const PLATFORMS = useMemo(() => {
    const platformOrder = ["feed", "instagram", "facebook", "twitter", "linkedin", "tiktok"];
    return platformOrder
      .filter((id) => PLATFORM_META[id])
      .map((id) => ({
        id,
        ...PLATFORM_META[id],
        enabled: id === "feed" || isConnected(id),
      }));
  }, [isConnected]);

  // Campaign info
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("AWARENESS");

  // Post selection
  const [userPosts, setUserPosts] = useState<UserPost[]>([]);
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set());
  const [postsLoading, setPostsLoading] = useState(true);
  const [postSearchQuery, setPostSearchQuery] = useState("");
  const [postFilter, setPostFilter] = useState<"all" | "image" | "video" | "text">("all");

  // Platform selection
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set(["feed"]));

  // Budget
  const [budget, setBudget] = useState("50");
  const [costPerView, setCostPerView] = useState("0.01");

  // Schedule
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [durationInput, setDurationInput] = useState("7");

  // Targeting
  const [selectedTags, setSelectedTags] = useState<AudienceTag[]>([]);
  const [aiSuggestedTags, setAiSuggestedTags] = useState<AudienceTag[]>([]);
  const [customTagInput, setCustomTagInput] = useState("");
  const [customTagCategory, setCustomTagCategory] = useState<TagCategory>("interest");
  const [isGeneratingAudience, setIsGeneratingAudience] = useState(false);

  // Ad type
  const [adType, setAdType] = useState<AdType>("POST");

  // Product link / External URL fields
  const [headline, setHeadline] = useState("");
  const [adDescription, setAdDescription] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState("");
  const [videoPreviewUrl, setVideoPreviewUrl] = useState("");
  const [ctaText, setCtaText] = useState("Learn More");
  const [templateStyle, setTemplateStyle] = useState("hero");
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  // Landing page selection
  const [landingPages, setLandingPages] = useState<LandingPageOption[]>([]);
  const [selectedLandingPageId, setSelectedLandingPageId] = useState("");
  const [landingPagesLoading, setLandingPagesLoading] = useState(false);

  // Content policy
  const [adCategory, setAdCategory] = useState("");
  const [contentPolicyAgreed, setContentPolicyAgreed] = useState(false);

  // AI campaign name
  const [isGeneratingName, setIsGeneratingName] = useState(false);
  const [suggestedNames, setSuggestedNames] = useState<string[]>([]);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Fetch current user
  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (data.success && data.data?.user) {
          setCurrentUserId(data.data.user.id);
        }
      } catch {
        console.error("Failed to fetch user");
      }
    }
    fetchUser();
  }, []);

  // Fetch user's posts
  useEffect(() => {
    if (!currentUserId) return;

    async function fetchPosts() {
      setPostsLoading(true);
      try {
        const res = await fetch(`/api/posts?userId=${currentUserId}&limit=100`);
        const data = await res.json();
        if (data.success) {
          setUserPosts(data.data.posts.map((p: Record<string, unknown>) => ({
            id: p.id as string,
            content: p.content as string | null,
            mediaUrls: (p.mediaUrls as string[]) || [],
            mediaType: (p.mediaUrls as string[])?.length > 0 ? "image" : null,
            likesCount: p.likesCount as number,
            commentsCount: p.commentsCount as number,
            isPromoted: p.isPromoted as boolean,
            createdAt: p.createdAt as string,
          })));
        }
      } catch {
        toast({ title: "Failed to load your posts", variant: "destructive" });
      } finally {
        setPostsLoading(false);
      }
    }
    fetchPosts();
  }, [currentUserId, toast]);

  // Fetch user's published landing pages (for LANDING_PAGE ad type)
  useEffect(() => {
    if (adType !== "LANDING_PAGE") return;
    setLandingPagesLoading(true);
    fetch("/api/landing-pages?status=PUBLISHED&limit=50")
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setLandingPages(data.data.pages || []);
        }
      })
      .catch(() => {})
      .finally(() => setLandingPagesLoading(false));
  }, [adType]);

  // Handle media upload
  const handleMediaUpload = async (file: File, type: "image" | "video") => {
    setIsUploadingMedia(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/media", { method: "POST", body: formData });
      const data = await res.json();
      if (data.success && data.data?.url) {
        if (type === "image") {
          setMediaPreviewUrl(data.data.url);
        } else {
          setVideoPreviewUrl(data.data.url);
        }
        toast({ title: `${type === "image" ? "Image" : "Video"} uploaded successfully` });
      } else {
        throw new Error(data.error?.message || "Upload failed");
      }
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsUploadingMedia(false);
    }
  };

  // Pre-select post from query parameter
  useEffect(() => {
    if (preSelectedPostId && userPosts.length > 0) {
      const exists = userPosts.some(p => p.id === preSelectedPostId);
      if (exists) {
        setSelectedPostIds(new Set([preSelectedPostId]));
      }
    }
  }, [preSelectedPostId, userPosts]);

  // Toggle post selection
  const togglePostSelection = useCallback((postId: string) => {
    setSelectedPostIds(prev => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
  }, []);

  // Toggle platform selection
  const togglePlatform = useCallback((platformId: string) => {
    const platform = PLATFORMS.find(p => p.id === platformId);
    if (!platform?.enabled) return;
    setSelectedPlatforms(prev => {
      const next = new Set(prev);
      if (next.has(platformId)) {
        next.delete(platformId);
      } else {
        next.add(platformId);
      }
      return next;
    });
  }, []);

  // Filtered posts
  const filteredPosts = useMemo(() => {
    return userPosts.filter(post => {
      // Search filter
      if (postSearchQuery) {
        const query = postSearchQuery.toLowerCase();
        if (!post.content?.toLowerCase().includes(query)) return false;
      }
      // Type filter
      if (postFilter === "image" && post.mediaUrls.length === 0) return false;
      if (postFilter === "video") return false; // TODO: detect video posts
      if (postFilter === "text" && post.mediaUrls.length > 0) return false;
      return true;
    });
  }, [userPosts, postSearchQuery, postFilter]);

  // Budget estimates — total cost multiplied by number of selected platforms
  const platformCount = Math.max(1, selectedPlatforms.size);
  const baseCredits = Math.round(parseFloat(budget) || 0);
  const budgetCredits = baseCredits * platformCount;
  const budgetCents = budgetCredits * CREDIT_TO_CENTS;
  const budgetDollars = budgetCents / 100;
  const cpvDollars = parseFloat(costPerView) || 0.01;
  const cpvCents = Math.round(cpvDollars * 100);
  const estimatedViews = cpvCents > 0 ? Math.floor(budgetCents / cpvCents) : 0;
  const durationDays = endDate && startDate
    ? Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000))
    : null;

  // Auto-compute end date when duration or start date changes
  const handleDurationChange = (days: string) => {
    setDurationInput(days);
    const numDays = parseInt(days);
    if (numDays > 0 && startDate) {
      const start = new Date(startDate);
      start.setDate(start.getDate() + numDays);
      setEndDate(start.toISOString().split("T")[0]);
    }
  };

  const handleStartDateChange = (date: string) => {
    setStartDate(date);
    const numDays = parseInt(durationInput);
    if (numDays > 0 && date) {
      const start = new Date(date);
      start.setDate(start.getDate() + numDays);
      setEndDate(start.toISOString().split("T")[0]);
    }
  };

  // Submit campaign
  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({ title: "Campaign name is required", variant: "destructive" });
      return;
    }

    // Ad-type-specific validation
    if (adType === "POST" && selectedPostIds.size === 0) {
      toast({ title: "Select at least one post", variant: "destructive" });
      return;
    }
    if ((adType === "PRODUCT_LINK" || adType === "EXTERNAL_URL") && !destinationUrl.trim()) {
      toast({ title: "Destination URL is required", variant: "destructive" });
      return;
    }
    if ((adType === "PRODUCT_LINK" || adType === "EXTERNAL_URL") && !headline.trim()) {
      toast({ title: "Headline is required", variant: "destructive" });
      return;
    }
    if (adType === "LANDING_PAGE" && !selectedLandingPageId) {
      toast({ title: "Select a landing page to promote", variant: "destructive" });
      return;
    }

    // Content policy
    if (adType !== "POST") {
      if (!adCategory) {
        toast({ title: "Select an ad category", variant: "destructive" });
        return;
      }
      if (!contentPolicyAgreed) {
        toast({ title: "You must agree to the content policy", variant: "destructive" });
        return;
      }
    }

    if (selectedPlatforms.size === 0) {
      toast({ title: "Select at least one platform", variant: "destructive" });
      return;
    }
    if (budgetCredits < 1) {
      toast({ title: "Budget must be at least 1 credit", variant: "destructive" });
      return;
    }
    if (!startDate) {
      toast({ title: "Start date is required", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          objective,
          budget: budgetCredits,
          costPerView: cpvDollars,
          startDate,
          endDate: endDate || undefined,
          // Ad type fields
          adType,
          headline: headline.trim() || undefined,
          description: adDescription.trim() || undefined,
          destinationUrl: destinationUrl.trim() || undefined,
          mediaUrl: mediaPreviewUrl || undefined,
          videoUrl: videoPreviewUrl || undefined,
          ctaText: ctaText || "Learn More",
          templateStyle,
          adCategory: adCategory || undefined,
          landingPageId: selectedLandingPageId || undefined,
          // Post promotion fields
          postIds: adType === "POST" ? Array.from(selectedPostIds) : undefined,
          targeting: {
            platforms: Array.from(selectedPlatforms),
            tags: selectedTags,
          },
        }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error?.message || "Failed to create campaign");

      const isReview = adType !== "POST";
      toast({
        title: isReview ? "Ad submitted for review!" : "Campaign created!",
        description: isReview
          ? "Your ad is under review. We'll notify you once it's approved."
          : "Your campaign is now active.",
      });
      router.push("/ads");
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create campaign",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Tag helpers
  const isTagSelected = useCallback(
    (tag: AudienceTag) => selectedTags.some(t => t.label === tag.label && t.category === tag.category),
    [selectedTags]
  );

  const toggleTag = useCallback((tag: AudienceTag) => {
    setSelectedTags(prev => {
      const exists = prev.some(t => t.label === tag.label && t.category === tag.category);
      if (exists) return prev.filter(t => !(t.label === tag.label && t.category === tag.category));
      return [...prev, tag];
    });
  }, []);

  const removeTag = useCallback((tag: AudienceTag) => {
    setSelectedTags(prev => prev.filter(t => !(t.label === tag.label && t.category === tag.category)));
  }, []);

  const addCustomTag = useCallback(() => {
    const label = customTagInput.trim();
    if (!label) return;
    const newTag: AudienceTag = { label, category: customTagCategory };
    if (!selectedTags.some(t => t.label === newTag.label && t.category === newTag.category)) {
      setSelectedTags(prev => [...prev, newTag]);
    }
    setCustomTagInput("");
  }, [customTagInput, customTagCategory, selectedTags]);

  // AI audience generation
  const handleGenerateAudience = async () => {
    setIsGeneratingAudience(true);
    try {
      const postSummaries = Array.from(selectedPostIds)
        .map(id => userPosts.find(p => p.id === id))
        .filter(Boolean)
        .map(p => p!.content?.substring(0, 100) || "Visual post")
        .slice(0, 5);

      const response = await fetch("/api/ai/generate/audience", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignName: name.trim() || undefined,
          objective,
          platforms: Array.from(selectedPlatforms),
          postSummaries: postSummaries.length > 0 ? postSummaries : undefined,
          existingTags: selectedTags.length > 0 ? selectedTags.map(t => t.label) : undefined,
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error?.message || "Failed to generate suggestions");
      }

      setAiSuggestedTags(data.data.tags);
      toast({
        title: "Suggestions ready",
        description: `${data.data.tags.length} tags suggested. ${data.data.creditsRemaining} credits remaining.`,
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to generate suggestions",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingAudience(false);
    }
  };

  // AI campaign name generation
  const handleGenerateName = async () => {
    setIsGeneratingName(true);
    try {
      const postSummaries = Array.from(selectedPostIds)
        .map(id => userPosts.find(p => p.id === id))
        .filter(Boolean)
        .map(p => p!.content?.substring(0, 100) || "Visual post")
        .slice(0, 5);

      const response = await fetch("/api/ai/generate/campaign-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objective,
          platforms: Array.from(selectedPlatforms),
          postSummaries: postSummaries.length > 0 ? postSummaries : undefined,
          currentName: name.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error?.message || "Failed to generate names");
      }

      setSuggestedNames(data.data.names);
      toast({
        title: "Names suggested",
        description: `${data.data.names.length} names generated. ${data.data.creditsRemaining} credits remaining.`,
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to generate names",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingName(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/ads">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Megaphone className="w-5 h-5 text-white" />
            </div>
            Create Campaign
          </h1>
          <p className="text-muted-foreground mt-1">
            Set up a new advertising campaign to promote your content
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column: Form Sections */}
        <div className="lg:col-span-2 space-y-6">

          {/* Section 0: Ad Type Selector */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Layout className="w-5 h-5 text-brand-500" />
                What do you want to promote?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {AD_TYPES.map((type) => {
                  const Icon = type.icon;
                  const isSelected = adType === type.id;
                  return (
                    <button
                      key={type.id}
                      onClick={() => setAdType(type.id)}
                      className={`relative flex flex-col items-center text-center gap-2 p-4 rounded-xl border-2 transition-all ${
                        isSelected
                          ? "border-brand-500 bg-brand-500/5 ring-2 ring-brand-500/20"
                          : "border-transparent bg-muted/50 hover:bg-muted hover:border-muted-foreground/20"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${type.color} flex items-center justify-center`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{type.label}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{type.description}</p>
                      </div>
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Section 1: Campaign Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="w-5 h-5 text-brand-500" />
                Campaign Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="campaign-name">Campaign Name *</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleGenerateName}
                    disabled={isGeneratingName}
                    className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                  >
                    {isGeneratingName ? (
                      <><Loader2 className="w-3 h-3 animate-spin" /> Generating...</>
                    ) : (
                      <><Sparkles className="w-3 h-3" /> AI Suggest (1 credit)</>
                    )}
                  </Button>
                </div>
                <Input
                  id="campaign-name"
                  placeholder="e.g., Summer Sale Promotion"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setSuggestedNames([]); }}
                  autoFocus
                />
                {suggestedNames.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {suggestedNames.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => { setName(suggestion); setSuggestedNames([]); }}
                        className="px-2.5 py-1 rounded-full text-xs font-medium border border-brand-500/20 bg-brand-500/5 text-brand-600 hover:bg-brand-500/10 transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Objective</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {OBJECTIVES.map((obj) => {
                    const Icon = obj.icon;
                    const isSelected = objective === obj.value;
                    return (
                      <button
                        key={obj.value}
                        onClick={() => setObjective(obj.value)}
                        className={`flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                          isSelected
                            ? "border-brand-500 bg-brand-500/5"
                            : "border-transparent bg-muted/50 hover:bg-muted"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected ? "bg-brand-500 text-white" : "bg-muted text-muted-foreground"
                        }`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-sm font-medium">{obj.label}</div>
                          <div className="text-xs text-muted-foreground">{obj.description}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Content — varies by ad type */}

          {/* Product Link / External URL Form */}
          {(adType === "PRODUCT_LINK" || adType === "EXTERNAL_URL") && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  {adType === "PRODUCT_LINK" ? (
                    <ShoppingBag className="w-5 h-5 text-brand-500" />
                  ) : (
                    <ExternalLink className="w-5 h-5 text-brand-500" />
                  )}
                  {adType === "PRODUCT_LINK" ? "Product Details" : "Link Details"}
                </CardTitle>
                <CardDescription>
                  {adType === "PRODUCT_LINK"
                    ? "Enter your product info. We'll create a quick ad page for you."
                    : "Enter the website URL you want to promote."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="headline">Headline *</Label>
                  <Input
                    id="headline"
                    placeholder="e.g., Premium Wireless Headphones - 50% Off"
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ad-description">Description</Label>
                  <Textarea
                    id="ad-description"
                    placeholder="Describe what you're promoting..."
                    value={adDescription}
                    onChange={(e) => setAdDescription(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="destination-url">Destination URL *</Label>
                  <div className="relative">
                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="destination-url"
                      type="url"
                      placeholder="https://example.com/product"
                      value={destinationUrl}
                      onChange={(e) => setDestinationUrl(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cta-text">Call to Action</Label>
                  <Input
                    id="cta-text"
                    placeholder="Learn More"
                    value={ctaText}
                    onChange={(e) => setCtaText(e.target.value)}
                  />
                  <div className="flex gap-1.5 flex-wrap">
                    {["Shop Now", "Learn More", "Get Started", "Sign Up", "Visit Site", "Download"].map(cta => (
                      <button
                        key={cta}
                        type="button"
                        onClick={() => setCtaText(cta)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                          ctaText === cta
                            ? "border-brand-500 bg-brand-500/10 text-brand-600"
                            : "border-transparent bg-muted/50 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {cta}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Image upload */}
                <div className="space-y-2">
                  <Label>Ad Image</Label>
                  {mediaPreviewUrl ? (
                    <div className="relative rounded-xl overflow-hidden border bg-muted">
                      <img src={mediaPreviewUrl} alt="Ad preview" className="w-full max-h-64 object-cover" />
                      <button
                        onClick={() => setMediaPreviewUrl("")}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed rounded-xl cursor-pointer hover:border-brand-500/50 hover:bg-muted/50 transition-colors">
                      <Upload className="w-8 h-8 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Click to upload an image</span>
                      <span className="text-xs text-muted-foreground">PNG, JPG, GIF up to 10MB</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleMediaUpload(file, "image");
                        }}
                        disabled={isUploadingMedia}
                      />
                    </label>
                  )}
                </div>

                {/* Video upload (optional) */}
                <div className="space-y-2">
                  <Label>Ad Video (Optional)</Label>
                  {videoPreviewUrl ? (
                    <div className="relative rounded-xl overflow-hidden border bg-muted">
                      <video src={videoPreviewUrl} controls className="w-full max-h-64" />
                      <button
                        onClick={() => setVideoPreviewUrl("")}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-xl cursor-pointer hover:border-brand-500/50 hover:bg-muted/50 transition-colors">
                      <Video className="w-6 h-6 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Click to upload a video</span>
                      <span className="text-xs text-muted-foreground">MP4 up to 100MB</span>
                      <input
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleMediaUpload(file, "video");
                        }}
                        disabled={isUploadingMedia}
                      />
                    </label>
                  )}
                </div>

                {isUploadingMedia && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </div>
                )}

                {/* Template style picker */}
                <div className="space-y-2">
                  <Label>Ad Page Style</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {TEMPLATE_STYLES.map(style => (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => setTemplateStyle(style.id)}
                        className={`p-3 rounded-xl border-2 text-center transition-all ${
                          templateStyle === style.id
                            ? "border-brand-500 bg-brand-500/5"
                            : "border-transparent bg-muted/50 hover:bg-muted"
                        }`}
                      >
                        <p className="text-xs font-medium">{style.label}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{style.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Landing Page Selector */}
          {adType === "LANDING_PAGE" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="w-5 h-5 text-brand-500" />
                  Select Landing Page
                </CardTitle>
                <CardDescription>
                  Choose a published landing page to promote
                </CardDescription>
              </CardHeader>
              <CardContent>
                {landingPagesLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[1, 2, 3].map(i => (
                      <Skeleton key={i} className="h-32 rounded-xl" />
                    ))}
                  </div>
                ) : landingPages.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p className="font-medium">No published landing pages</p>
                    <p className="text-sm mt-1">Create and publish a landing page first</p>
                    <Button variant="outline" size="sm" className="mt-3" asChild>
                      <Link href="/landing-pages">Go to Landing Pages</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {landingPages.map(lp => {
                      const isSelected = selectedLandingPageId === lp.id;
                      return (
                        <button
                          key={lp.id}
                          onClick={() => {
                            setSelectedLandingPageId(lp.id);
                            setHeadline(lp.title);
                            if (lp.description) setAdDescription(lp.description);
                          }}
                          className={`relative text-left rounded-xl border-2 overflow-hidden transition-all ${
                            isSelected
                              ? "border-brand-500 ring-2 ring-brand-500/20"
                              : "border-transparent hover:border-muted-foreground/30"
                          }`}
                        >
                          <div className="h-24 bg-gradient-to-br from-purple-500/10 to-violet-500/10 flex items-center justify-center">
                            {lp.thumbnailUrl ? (
                              <img src={lp.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Globe className="w-8 h-8 text-muted-foreground/40" />
                            )}
                          </div>
                          <div className="p-2">
                            <p className="text-xs font-medium line-clamp-1">{lp.title}</p>
                            <p className="text-[10px] text-muted-foreground">/{lp.slug}</p>
                          </div>
                          {isSelected && (
                            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {selectedLandingPageId && (
                  <div className="mt-4 space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="lp-cta">Call to Action Text</Label>
                      <Input
                        id="lp-cta"
                        placeholder="Visit Page"
                        value={ctaText}
                        onChange={(e) => setCtaText(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Post Selector (existing, only for POST type) */}
          {adType === "POST" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ImageIcon className="w-5 h-5 text-brand-500" />
                    Select Posts to Promote
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Choose which posts to include in this campaign
                  </CardDescription>
                </div>
                {selectedPostIds.size > 0 && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{selectedPostIds.size} selected</Badge>
                    <button
                      onClick={() => setSelectedPostIds(new Set())}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Search & Filter */}
              <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search posts..."
                    value={postSearchQuery}
                    onChange={(e) => setPostSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex gap-1">
                  {[
                    { value: "all" as const, label: "All" },
                    { value: "image" as const, label: "Images", icon: ImageIcon },
                    { value: "text" as const, label: "Text", icon: Type },
                  ].map((filter) => (
                    <Button
                      key={filter.value}
                      variant={postFilter === filter.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPostFilter(filter.value)}
                      className="text-xs"
                    >
                      {filter.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Post Grid */}
              {postsLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Skeleton key={i} className="aspect-square rounded-xl" />
                  ))}
                </div>
              ) : filteredPosts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ImageIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">No posts found</p>
                  <p className="text-sm mt-1">
                    {postSearchQuery ? "Try a different search" : "Create some posts first to promote them"}
                  </p>
                </div>
              ) : (
                <div className="max-h-[420px] overflow-y-auto pr-1 -mr-1">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {filteredPosts.map((post) => {
                      const isSelected = selectedPostIds.has(post.id);
                      const hasMedia = post.mediaUrls.length > 0;
                      return (
                        <button
                          key={post.id}
                          onClick={() => togglePostSelection(post.id)}
                          className={`relative group rounded-xl overflow-hidden border-2 transition-all text-left ${
                            isSelected
                              ? "border-brand-500 ring-2 ring-brand-500/20"
                              : "border-transparent hover:border-muted-foreground/30"
                          }`}
                        >
                          {/* Media / Placeholder */}
                          <div className="aspect-square bg-muted relative">
                            {hasMedia ? (
                              <img
                                src={post.mediaUrls[0]}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-brand-500/10 to-purple-500/10 flex items-center justify-center p-3">
                                <p className="text-xs text-muted-foreground line-clamp-4 text-center">
                                  {post.content || "No content"}
                                </p>
                              </div>
                            )}

                            {/* Selection overlay */}
                            {isSelected && (
                              <div className="absolute inset-0 bg-brand-500/20 flex items-center justify-center">
                                <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center">
                                  <Check className="w-5 h-5 text-white" />
                                </div>
                              </div>
                            )}

                            {/* Hover overlay */}
                            {!isSelected && (
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                            )}

                            {/* Promoted badge */}
                            {post.isPromoted && (
                              <Badge className="absolute top-2 left-2 bg-amber-500/90 text-white text-[10px] px-1.5 py-0.5">
                                Boosted
                              </Badge>
                            )}

                            {/* Multi-media indicator */}
                            {post.mediaUrls.length > 1 && (
                              <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-md">
                                +{post.mediaUrls.length - 1}
                              </div>
                            )}
                          </div>

                          {/* Footer */}
                          <div className="p-2 bg-card">
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {post.content || "No caption"}
                            </p>
                            <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                              <span className="flex items-center gap-0.5">
                                <Heart className="w-3 h-3" />
                                {post.likesCount}
                              </span>
                              <span className="flex items-center gap-0.5">
                                <MessageCircle className="w-3 h-3" />
                                {post.commentsCount}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {/* Content Policy Section (for non-POST ad types) */}
          {adType !== "POST" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ShieldCheck className="w-5 h-5 text-brand-500" />
                  Content Policy
                </CardTitle>
                <CardDescription>
                  All ads are reviewed before going live to ensure quality
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Ad Category */}
                <div className="space-y-2">
                  <Label>Ad Category *</Label>
                  <div className="flex flex-wrap gap-2">
                    {AD_CATEGORIES.map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setAdCategory(cat)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          adCategory === cat
                            ? "border-brand-500 bg-brand-500/10 text-brand-600"
                            : "border-transparent bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Content policy agreement */}
                <label className="flex items-start gap-3 p-3 rounded-xl border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={contentPolicyAgreed}
                    onChange={(e) => setContentPolicyAgreed(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                  />
                  <span className="text-sm">
                    I confirm this ad does not contain explicit, misleading, or prohibited content.
                    I understand that ads are subject to review and may be rejected.
                  </span>
                </label>

                {/* Prohibited content list */}
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Not Allowed</span>
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>- Explicit or adult content</li>
                    <li>- Misleading claims or false advertising</li>
                    <li>- Illegal products or services</li>
                    <li>- Hate speech or discrimination</li>
                    <li>- Weapons, drugs, or dangerous substances</li>
                    <li>- Counterfeit or copyrighted content</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Section 3: Platform Selector */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Globe className="w-5 h-5 text-brand-500" />
                Target Platforms
              </CardTitle>
              <CardDescription>
                Choose which platforms to promote your posts on. Social integrations coming soon.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TooltipProvider delayDuration={0}>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map((platform) => {
                    const Icon = platform.icon;
                    const isSelected = selectedPlatforms.has(platform.id);

                    if (!platform.enabled) {
                      return (
                        <Tooltip key={platform.id}>
                          <TooltipTrigger asChild>
                            <button
                              disabled
                              className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-dashed border-border/50 text-xs font-medium opacity-40 cursor-not-allowed text-muted-foreground"
                            >
                              <Icon className="w-3.5 h-3.5" />
                              {platform.name}
                              <Lock className="w-2.5 h-2.5 ml-0.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>{platform.name} — coming soon</TooltipContent>
                        </Tooltip>
                      );
                    }

                    return (
                      <Tooltip key={platform.id}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => togglePlatform(platform.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all text-xs font-medium ${
                              isSelected
                                ? "border-current"
                                : "border-muted bg-muted/50 hover:bg-muted text-muted-foreground"
                            }`}
                            style={isSelected ? { color: platform.color, borderColor: platform.color, backgroundColor: `${platform.color}10` } : undefined}
                          >
                            <Icon className="w-3.5 h-3.5"
                              style={isSelected ? { color: platform.color } : undefined}
                            />
                            {platform.name}
                            {isSelected && (
                              <Check className="w-3 h-3 ml-0.5" style={{ color: platform.color }} />
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{platform.name}</TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </TooltipProvider>
            </CardContent>
          </Card>

          {/* Section 4: Schedule */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="w-5 h-5 text-brand-500" />
                Schedule
              </CardTitle>
              <CardDescription>
                Set a start date and duration for your campaign
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-date">Start Date *</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration-days">Duration (days)</Label>
                  <Input
                    id="duration-days"
                    type="number"
                    min="1"
                    max="365"
                    value={durationInput}
                    onChange={(e) => handleDurationChange(e.target.value)}
                  />
                </div>
              </div>

              {/* Quick duration presets */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { days: "3", label: "3 days" },
                  { days: "7", label: "1 week" },
                  { days: "14", label: "2 weeks" },
                  { days: "30", label: "1 month" },
                  { days: "60", label: "2 months" },
                  { days: "90", label: "3 months" },
                ].map((preset) => (
                  <button
                    key={preset.days}
                    type="button"
                    onClick={() => handleDurationChange(preset.days)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                      durationInput === preset.days
                        ? "border-brand-500 bg-brand-500/10 text-brand-600"
                        : "border-transparent bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Computed end date display */}
              {endDate && startDate && (
                <div className="rounded-lg bg-muted/50 px-3 py-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">End date</span>
                  <span className="font-medium">
                    {new Date(endDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                    {durationDays && (
                      <span className="text-muted-foreground font-normal ml-2">({durationDays} day{durationDays !== 1 ? "s" : ""})</span>
                    )}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 5: Budget */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <DollarSign className="w-5 h-5 text-brand-500" />
                Budget
              </CardTitle>
              <CardDescription>
                Set credits per platform. Total cost = credits &times; {platformCount} platform{platformCount !== 1 ? "s" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="budget-credits">Credits per platform *</Label>
                  <Input
                    id="budget-credits"
                    type="number"
                    min="1"
                    step="1"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cpv">Cost per view ($)</Label>
                  <Input
                    id="cpv"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={costPerView}
                    onChange={(e) => setCostPerView(e.target.value)}
                  />
                </div>
              </div>

              <div className="rounded-xl bg-muted/50 p-4 space-y-2">
                {platformCount > 1 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Per platform</span>
                    <span className="font-medium">{baseCredits} credits &times; {platformCount} platforms</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total credits</span>
                  <span className="font-semibold">{budgetCredits} credits (${budgetDollars.toFixed(2)})</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cost per view</span>
                  <span className="font-medium">${cpvDollars.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Estimated views</span>
                  <span className="font-semibold text-brand-500">{estimatedViews.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Estimated reach</span>
                  <span className="font-medium">
                    {(estimatedViews * 2).toLocaleString()} - {(estimatedViews * 5).toLocaleString()} people
                  </span>
                </div>
                {durationDays && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Daily budget</span>
                    <span className="font-medium">
                      ~{Math.ceil(budgetCredits / durationDays)} credits/day
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Section 6: Targeting */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Target className="w-5 h-5 text-brand-500" />
                    Target Audience
                  </CardTitle>
                  <CardDescription className="mt-1.5">
                    Select tags or let AI suggest your ideal audience
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateAudience}
                  disabled={isGeneratingAudience}
                  className="shrink-0 gap-1.5"
                >
                  {isGeneratingAudience ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      AI Suggest (1 credit)
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Selected tags */}
              {selectedTags.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Selected ({selectedTags.length})</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTags.map((tag) => {
                      const config = TAG_CATEGORY_CONFIG[tag.category];
                      return (
                        <span
                          key={`${tag.category}-${tag.label}`}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${config.bg} ${config.color}`}
                        >
                          {tag.label}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="ml-0.5 hover:opacity-70"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setSelectedTags([])}
                      className="px-2 py-1 rounded-full text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Clear all
                    </button>
                  </div>
                </div>
              )}

              {/* AI suggested tags */}
              {aiSuggestedTags.length > 0 && (
                <div className="space-y-2 rounded-lg border border-brand-500/20 bg-brand-500/5 p-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-brand-500" />
                      AI Suggestions
                    </Label>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTags(prev => {
                          const newTags = aiSuggestedTags.filter(
                            st => !prev.some(t => t.label === st.label && t.category === st.category)
                          );
                          return [...prev, ...newTags];
                        });
                        setAiSuggestedTags([]);
                      }}
                      className="text-xs text-brand-500 hover:text-brand-600 font-medium"
                    >
                      Add all
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {aiSuggestedTags.map((tag) => {
                      const selected = isTagSelected(tag);
                      const config = TAG_CATEGORY_CONFIG[tag.category] || TAG_CATEGORY_CONFIG.interest;
                      return (
                        <button
                          key={`ai-${tag.category}-${tag.label}`}
                          type="button"
                          onClick={() => {
                            toggleTag(tag);
                            setAiSuggestedTags(prev => prev.filter(t => !(t.label === tag.label && t.category === tag.category)));
                          }}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                            selected
                              ? `${config.bg} ${config.color}`
                              : "bg-background border-border hover:border-brand-500/40 text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${config.color.replace("text-", "bg-")}`} />
                          {tag.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Browse default tags by category */}
              <div className="space-y-3">
                <Label className="text-xs text-muted-foreground">Browse tags</Label>
                {(Object.keys(TAG_CATEGORY_CONFIG) as TagCategory[]).map((category) => {
                  const config = TAG_CATEGORY_CONFIG[category];
                  const categoryTags = DEFAULT_TAGS.filter(t => t.category === category);
                  if (categoryTags.length === 0) return null;
                  return (
                    <div key={category}>
                      <p className={`text-xs font-medium mb-1.5 ${config.color}`}>{config.label}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {categoryTags.map((tag) => {
                          const selected = isTagSelected(tag);
                          return (
                            <button
                              key={`${tag.category}-${tag.label}`}
                              type="button"
                              onClick={() => toggleTag(tag)}
                              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                                selected
                                  ? `${config.bg} ${config.color}`
                                  : "bg-muted/50 border-transparent text-muted-foreground hover:text-foreground hover:bg-muted"
                              }`}
                            >
                              {selected && <Check className="w-3 h-3 inline mr-1" />}
                              {tag.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Custom tag input */}
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">Add custom tag</Label>
                  <Input
                    placeholder="e.g., Dog owners, Startup founders..."
                    value={customTagInput}
                    onChange={(e) => setCustomTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomTag(); } }}
                    className="h-9 text-sm"
                  />
                </div>
                <select
                  value={customTagCategory}
                  onChange={(e) => setCustomTagCategory(e.target.value as TagCategory)}
                  className="h-9 px-2 rounded-md border bg-background text-xs"
                >
                  {(Object.keys(TAG_CATEGORY_CONFIG) as TagCategory[]).map(cat => (
                    <option key={cat} value={cat}>{TAG_CATEGORY_CONFIG[cat].label}</option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={addCustomTag}
                  disabled={!customTagInput.trim()}
                >
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Sticky Summary */}
        <div className="hidden lg:block">
          <div className="sticky top-20 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Campaign Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Name */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Campaign Name</p>
                  <p className="text-sm font-medium">{name || "Untitled Campaign"}</p>
                </div>

                {/* Objective */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Objective</p>
                  <Badge variant="secondary">
                    {OBJECTIVES.find(o => o.value === objective)?.label || objective}
                  </Badge>
                </div>

                {/* Ad Type */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Ad Type</p>
                  <Badge variant="secondary">
                    {AD_TYPES.find(t => t.id === adType)?.label || adType}
                  </Badge>
                </div>

                {/* Content Summary — varies by ad type */}
                {adType === "POST" ? (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Posts</p>
                    {selectedPostIds.size === 0 ? (
                      <p className="text-sm text-muted-foreground">None selected</p>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {Array.from(selectedPostIds).slice(0, 4).map((id) => {
                          const post = userPosts.find(p => p.id === id);
                          return (
                            <div
                              key={id}
                              className="w-8 h-8 rounded-md bg-muted overflow-hidden"
                            >
                              {post?.mediaUrls[0] ? (
                                <img src={post.mediaUrls[0]} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Type className="w-3 h-3 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {selectedPostIds.size > 4 && (
                          <span className="text-xs text-muted-foreground">+{selectedPostIds.size - 4}</span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {headline && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Headline</p>
                        <p className="text-sm font-medium line-clamp-2">{headline}</p>
                      </div>
                    )}
                    {destinationUrl && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Destination</p>
                        <p className="text-xs text-brand-500 line-clamp-1 break-all">{destinationUrl}</p>
                      </div>
                    )}
                    {mediaPreviewUrl && (
                      <div className="w-full h-16 rounded-md overflow-hidden bg-muted">
                        <img src={mediaPreviewUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                    {adType === "LANDING_PAGE" && selectedLandingPageId && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Landing Page</p>
                        <p className="text-sm font-medium">{landingPages.find(lp => lp.id === selectedLandingPageId)?.title}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Approval Status Info */}
                {adType !== "POST" && (
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5">
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Requires admin approval
                    </p>
                  </div>
                )}

                {/* Platforms */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Platforms</p>
                  {selectedPlatforms.size === 0 ? (
                    <p className="text-sm text-muted-foreground">None selected</p>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      {Array.from(selectedPlatforms).map((id) => {
                        const platform = PLATFORMS.find(p => p.id === id);
                        if (!platform) return null;
                        const Icon = platform.icon;
                        return (
                          <div
                            key={id}
                            className="w-7 h-7 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: platform.bgColor }}
                          >
                            <Icon className="w-3.5 h-3.5" style={{ color: platform.color }} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Budget */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Budget</p>
                  <p className="text-sm font-medium">
                    {budgetCredits > 0
                      ? platformCount > 1
                        ? `${baseCredits} × ${platformCount} = ${budgetCredits} credits ($${budgetDollars.toFixed(2)})`
                        : `${budgetCredits} credits ($${budgetDollars.toFixed(2)})`
                      : "Not set"}
                  </p>
                  {estimatedViews > 0 && (
                    <p className="text-xs text-muted-foreground">~{estimatedViews.toLocaleString()} views</p>
                  )}
                </div>

                {/* Schedule */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Schedule</p>
                  <p className="text-sm font-medium">
                    {startDate
                      ? new Date(startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                      : "Not set"}
                    {endDate && ` — ${new Date(endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                  </p>
                  {durationDays && (
                    <p className="text-xs text-muted-foreground">{durationDays} day{durationDays !== 1 ? "s" : ""}</p>
                  )}
                </div>

                <div className="pt-2 space-y-2">
                  <Button
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {adType === "POST" ? "Creating..." : "Submitting..."}
                      </>
                    ) : (
                      <>
                        <Rocket className="w-4 h-4 mr-2" />
                        {adType === "POST" ? "Create Campaign" : "Submit for Review"}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Mobile Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 lg:hidden bg-background border-t p-4 z-50">
        <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
          <div className="text-sm text-muted-foreground">
            <Badge variant="outline" className="mr-2 text-[10px]">{AD_TYPES.find(t => t.id === adType)?.label}</Badge>
            <span className="font-medium text-foreground">{budgetCredits}</span> credits
          </div>
          <Button
            className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {adType === "POST" ? "Creating..." : "Submitting..."}
              </>
            ) : (
              <>
                <Rocket className="w-4 h-4 mr-2" />
                {adType === "POST" ? "Create Campaign" : "Submit for Review"}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Bottom padding for mobile sticky bar */}
      <div className="h-20 lg:hidden" />
    </motion.div>
  );
}
