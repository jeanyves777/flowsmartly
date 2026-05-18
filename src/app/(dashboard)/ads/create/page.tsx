"use client";

import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  Check,
  CheckCircle2,
  ExternalLink,
  FileText,
  Globe,
  Heart,
  Image as ImageIcon,
  Link2,
  Lock,
  Megaphone,
  MessageCircle,
  Play,
  Rocket,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Target,
  Users,
  Video,
  Wand2,
  X,
} from "lucide-react";
import { emitCreditsUpdate } from "@/lib/utils/credits-event";
import { cn } from "@/lib/utils/cn";
import { REGIONS } from "@/lib/constants/regions";
import { isVideoLikeUrl, PREMIER_SPOTLIGHT_CHANNEL_ID, PREMIER_SPOTLIGHT_FEE_CREDITS } from "@/lib/ads/spotlight";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MediaUploader } from "@/components/shared/media-uploader";
import { AIIdeasHistory } from "@/components/shared/ai-ideas-history";
import { StoreProductPicker } from "@/components/ads/store-product-picker";
import { AIAdCreativePanel } from "@/components/ecommerce/ai-ad-creative-panel";
import { AISpinner } from "@/components/shared/ai-generation-loader";
import { useToast } from "@/hooks/use-toast";

type AdType = "POST" | "PRODUCT_LINK" | "LANDING_PAGE" | "EXTERNAL_URL";
type TagCategory = "age" | "gender" | "interest" | "behavior" | "location" | "income" | "device";

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

interface LandingPageOption {
  id: string;
  title: string;
  slug: string;
  thumbnailUrl: string | null;
  description: string | null;
}

interface AudienceTag {
  label: string;
  category: TagCategory;
}

interface AdProvider {
  id: string;
  name: string;
  enabled: boolean;
  description?: string;
  feeCredits?: number;
}

const AD_TYPES: Array<{
  id: AdType;
  label: string;
  shortLabel: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  {
    id: "POST",
    label: "Boost a post",
    shortLabel: "Post",
    description: "Turn an existing post into an active FlowSmartly ad.",
    icon: ImageIcon,
  },
  {
    id: "PRODUCT_LINK",
    label: "Promote a product",
    shortLabel: "Product",
    description: "Pick a FlowShop product and let AI shape the ad copy.",
    icon: ShoppingBag,
  },
  {
    id: "LANDING_PAGE",
    label: "Send traffic to a page",
    shortLabel: "Landing page",
    description: "Promote a published landing page.",
    icon: FileText,
  },
  {
    id: "EXTERNAL_URL",
    label: "Promote any link",
    shortLabel: "Link",
    description: "Create a focused ad for an outside website.",
    icon: ExternalLink,
  },
];

const OBJECTIVES = [
  { value: "AWARENESS", label: "Awareness", icon: Megaphone },
  { value: "ENGAGEMENT", label: "Engagement", icon: Heart },
  { value: "TRAFFIC", label: "Traffic", icon: Globe },
  { value: "CONVERSIONS", label: "Sales", icon: Target },
  { value: "LEADS", label: "Leads", icon: Users },
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

const DEFAULT_TAGS: AudienceTag[] = [
  { label: "25-34 years old", category: "age" },
  { label: "35-44 years old", category: "age" },
  { label: "Online shoppers", category: "behavior" },
  { label: "Engaged users", category: "behavior" },
  { label: "Business owners", category: "interest" },
  { label: "Technology", category: "interest" },
  { label: "Health & Fitness", category: "interest" },
  { label: "Food & Dining", category: "interest" },
  { label: "Worldwide", category: "location" },
  ...REGIONS.slice(0, 16).map((region) => ({ label: region.name, category: "location" as const })),
];

const CREDIT_TO_CENTS = 1;

const PROVIDER_META: Record<string, { icon: ComponentType<{ className?: string }>; tone: string }> = {
  feed: {
    icon: Megaphone,
    tone: "border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  google_ads: {
    icon: Target,
    tone: "border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  meta_ads: {
    icon: Users,
    tone: "border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  tiktok_ads: {
    icon: Sparkles,
    tone: "border-neutral-500 bg-neutral-500/10 text-neutral-700 dark:text-neutral-300",
  },
  spotlight: {
    icon: Video,
    tone: "border-cyan-500 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  },
};

const DEFAULT_PROVIDERS: AdProvider[] = [
  {
    id: "feed",
    name: "FlowSmartly Feed",
    enabled: true,
    description: "Shows approved ads inside FlowSmartly.",
  },
];

const DEFAULT_SPOTLIGHT_PROVIDER: AdProvider = {
  id: PREMIER_SPOTLIGHT_CHANNEL_ID,
  name: "Premier video spotlight",
  enabled: true,
  description: "Feature an eligible video in the dashboard spotlight.",
  feeCredits: PREMIER_SPOTLIGHT_FEE_CREDITS,
};

const CTA_OPTIONS = ["Shop Now", "Learn More", "Get Started", "Sign Up", "Visit Site"];

function todayInputValue() {
  return new Date().toISOString().split("T")[0];
}

function addDaysInputValue(startDate: string, days: number) {
  const next = new Date(startDate || todayInputValue());
  next.setDate(next.getDate() + days);
  return next.toISOString().split("T")[0];
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function CreateCampaignPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const requestedType = searchParams.get("type")?.toUpperCase();
  const preSelectedPostId = searchParams.get("postId");
  const initialType = AD_TYPES.some((type) => type.id === requestedType) ? requestedType as AdType : "POST";

  const [adType, setAdType] = useState<AdType>(initialType);
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("AWARENESS");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [posts, setPosts] = useState<UserPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postSearch, setPostSearch] = useState("");
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set());

  const [providers, setProviders] = useState<AdProvider[]>(DEFAULT_PROVIDERS);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [selectedProviderIds, setSelectedProviderIds] = useState<Set<string>>(new Set(["feed"]));

  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [headline, setHeadline] = useState("");
  const [description, setDescription] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [ctaText, setCtaText] = useState("Learn More");

  const [landingPages, setLandingPages] = useState<LandingPageOption[]>([]);
  const [landingPagesLoading, setLandingPagesLoading] = useState(false);
  const [selectedLandingPageId, setSelectedLandingPageId] = useState("");

  const [budget, setBudget] = useState("50");
  const [costPerView, setCostPerView] = useState("0.01");
  const [startDate, setStartDate] = useState(todayInputValue());
  const [durationDays, setDurationDays] = useState("7");
  const [endDate, setEndDate] = useState(addDaysInputValue(todayInputValue(), 7));

  const [selectedTags, setSelectedTags] = useState<AudienceTag[]>([]);
  const [aiSuggestedTags, setAiSuggestedTags] = useState<AudienceTag[]>([]);
  const [isGeneratingAudience, setIsGeneratingAudience] = useState(false);
  const [isGeneratingName, setIsGeneratingName] = useState(false);
  const [suggestedNames, setSuggestedNames] = useState<string[]>([]);
  const [adCategory, setAdCategory] = useState("E-commerce / Shopping");
  const [contentPolicyAgreed, setContentPolicyAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedType = AD_TYPES.find((type) => type.id === adType) || AD_TYPES[0];
  const SelectedTypeIcon = selectedType.icon;
  const selectedObjective = OBJECTIVES.find((item) => item.value === objective) || OBJECTIVES[0];
  const selectedLandingPage = landingPages.find((page) => page.id === selectedLandingPageId);

  const budgetCredits = Math.round(parseFloat(budget) || 0);
  const spotlightSelected = selectedProviderIds.has(PREMIER_SPOTLIGHT_CHANNEL_ID);
  const spotlightFeeCredits = spotlightSelected ? PREMIER_SPOTLIGHT_FEE_CREDITS : 0;
  const totalChargeCredits = budgetCredits + spotlightFeeCredits;
  const budgetCents = budgetCredits * CREDIT_TO_CENTS;
  const budgetDollars = budgetCents / 100;
  const cpvDollars = parseFloat(costPerView) || 0.01;
  const cpvCents = Math.max(1, Math.round(cpvDollars * 100));
  const estimatedViews = budgetCents > 0 ? Math.floor(budgetCents / cpvCents) : 0;
  const campaignDays = startDate && endDate
    ? Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000))
    : Math.max(1, parseInt(durationDays) || 1);

  const filteredPosts = useMemo(() => {
    const query = postSearch.trim().toLowerCase();
    if (!query) return posts;
    return posts.filter((post) => (post.content || "").toLowerCase().includes(query));
  }, [postSearch, posts]);

  const selectedProviders = useMemo(
    () => providers.filter((provider) => selectedProviderIds.has(provider.id)),
    [providers, selectedProviderIds]
  );
  const availableProviders = providersLoading ? DEFAULT_PROVIDERS : providers;
  const standardProviders = availableProviders.filter((provider) => provider.id !== PREMIER_SPOTLIGHT_CHANNEL_ID);
  const spotlightProvider = availableProviders.find((provider) => provider.id === PREMIER_SPOTLIGHT_CHANNEL_ID) || DEFAULT_SPOTLIGHT_PROVIDER;
  const selectedPosts = useMemo(
    () => posts.filter((post) => selectedPostIds.has(post.id)),
    [posts, selectedPostIds]
  );
  const selectedVideoPostCount = selectedPosts.filter((post) => (
    post.mediaType?.toLowerCase().includes("video") || post.mediaUrls.some(isVideoLikeUrl)
  )).length;
  const hasVideoCreative = adType === "POST"
    ? selectedVideoPostCount > 0
    : isVideoLikeUrl(videoUrl) || isVideoLikeUrl(mediaUrl);

  useEffect(() => {
    async function loadBasics() {
      try {
        const [meRes, brandRes, providerRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/brand"),
          fetch("/api/ads/providers"),
        ]);

        const meData = await meRes.json();
        if (meData.success && meData.data?.user) {
          setCurrentUserId(meData.data.user.id);
        }

        const providerData = await providerRes.json();
        if (providerData.success && providerData.data?.providers?.length) {
          setProviders(providerData.data.providers);
        }

        if (preSelectedPostId) {
          const brandData = await brandRes.json();
          const website = brandData?.data?.brandKit?.website;
          if (website) setDestinationUrl(website);
        }
      } catch {
        setProviders(DEFAULT_PROVIDERS);
      } finally {
        setProvidersLoading(false);
      }
    }

    loadBasics();
  }, [preSelectedPostId]);

  useEffect(() => {
    if (!currentUserId) return;

    async function loadPosts() {
      setPostsLoading(true);
      try {
        const response = await fetch(`/api/posts?userId=${currentUserId}&limit=100`);
        const data = await response.json();
        if (data.success) {
          setPosts((data.data.posts || []).map((post: Record<string, unknown>) => ({
            id: post.id as string,
            content: post.content as string | null,
            mediaUrls: (post.mediaUrls as string[]) || [],
            mediaType: (post.mediaType as string | null) || null,
            likesCount: (post.likesCount as number) || 0,
            commentsCount: (post.commentsCount as number) || 0,
            isPromoted: Boolean(post.isPromoted),
            createdAt: post.createdAt as string,
          })));
        }
      } catch {
        toast({ title: "Failed to load posts", variant: "destructive" });
      } finally {
        setPostsLoading(false);
      }
    }

    loadPosts();
  }, [currentUserId, toast]);

  useEffect(() => {
    if (!preSelectedPostId || posts.length === 0) return;
    if (posts.some((post) => post.id === preSelectedPostId)) {
      setSelectedPostIds(new Set([preSelectedPostId]));
    }
  }, [preSelectedPostId, posts]);

  useEffect(() => {
    if (adType !== "LANDING_PAGE") return;

    setLandingPagesLoading(true);
    fetch("/api/landing-pages?status=PUBLISHED&limit=50")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setLandingPages(data.data.pages || []);
      })
      .catch(() => setLandingPages([]))
      .finally(() => setLandingPagesLoading(false));
  }, [adType]);

  function changeType(nextType: AdType) {
    setAdType(nextType);
    setSuggestedNames([]);
    setAiSuggestedTags([]);
    if (nextType === "POST") {
      setSelectedProviderIds(new Set(["feed"]));
    } else if (nextType === "LANDING_PAGE") {
      setSelectedProviderIds((current) => {
        const next = new Set(current);
        next.delete(PREMIER_SPOTLIGHT_CHANNEL_ID);
        next.add("feed");
        return next;
      });
    }
  }

  function handleStartDateChange(value: string) {
    setStartDate(value);
    const days = Math.max(1, parseInt(durationDays) || 7);
    setEndDate(addDaysInputValue(value, days));
  }

  function handleDurationChange(value: string) {
    setDurationDays(value);
    const days = Math.max(1, parseInt(value) || 1);
    setEndDate(addDaysInputValue(startDate, days));
  }

  function togglePost(postId: string) {
    setSelectedPostIds((current) => {
      const next = new Set(current);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  }

  function toggleProvider(provider: AdProvider) {
    if (!provider.enabled) return;
    setSelectedProviderIds((current) => {
      const next = new Set(current);
      if (provider.id === PREMIER_SPOTLIGHT_CHANNEL_ID) {
        if (next.has(PREMIER_SPOTLIGHT_CHANNEL_ID)) next.delete(PREMIER_SPOTLIGHT_CHANNEL_ID);
        else next.add(PREMIER_SPOTLIGHT_CHANNEL_ID);
        next.add("feed");
        return next;
      }
      if (provider.id === "feed") {
        next.add("feed");
        return next;
      }
      if (next.has(provider.id)) next.delete(provider.id);
      else next.add(provider.id);
      next.add("feed");
      return next;
    });
  }

  function toggleTag(tag: AudienceTag) {
    setSelectedTags((current) => {
      const exists = current.some((item) => item.label === tag.label && item.category === tag.category);
      if (exists) return current.filter((item) => !(item.label === tag.label && item.category === tag.category));
      return [...current, tag];
    });
  }

  const handleProductSelect = useCallback((product: {
    productId: string;
    storeId: string;
    headline: string;
    description: string;
    destinationUrl: string;
    mediaUrl: string | null;
    ctaText: string;
    adCategory: string;
    name: string;
  }) => {
    setSelectedProductId(product.productId);
    setSelectedStoreId(product.storeId);
    setHeadline(product.headline);
    setDescription(product.description);
    setDestinationUrl(product.destinationUrl);
    if (product.mediaUrl) setMediaUrl(product.mediaUrl);
    setCtaText(product.ctaText);
    setAdCategory(product.adCategory);
    if (!name.trim()) setName(product.name);
  }, [name]);

  const handleProductClear = useCallback(() => {
    setSelectedProductId(null);
    setSelectedStoreId(null);
  }, []);

  async function handleGenerateName() {
    setIsGeneratingName(true);
    try {
      const postSummaries = Array.from(selectedPostIds)
        .map((id) => posts.find((post) => post.id === id))
        .filter(Boolean)
        .map((post) => post!.content?.slice(0, 120) || "Visual post")
        .slice(0, 5);

      const response = await fetch("/api/ai/generate/campaign-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objective,
          platforms: Array.from(selectedProviderIds),
          postSummaries: postSummaries.length ? postSummaries : undefined,
          currentName: name.trim() || headline.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error?.message || "Failed to generate names");

      setSuggestedNames(data.data.names || []);
      emitCreditsUpdate(data.data.creditsRemaining);
      toast({ title: "AI names ready" });
    } catch (error) {
      toast({
        title: "AI name failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingName(false);
    }
  }

  async function handleGenerateAudience() {
    setIsGeneratingAudience(true);
    try {
      const response = await fetch("/api/ai/generate/audience", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignName: name.trim() || headline.trim() || selectedType.label,
          objective,
          platforms: Array.from(selectedProviderIds),
          postSummaries: adType === "POST"
            ? Array.from(selectedPostIds)
              .map((id) => posts.find((post) => post.id === id)?.content?.slice(0, 120))
              .filter(Boolean)
            : [headline, description].filter(Boolean),
          existingTags: selectedTags.map((tag) => tag.label),
        }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error?.message || "Failed to generate audience");

      setAiSuggestedTags(data.data.tags || []);
      emitCreditsUpdate(data.data.creditsRemaining);
      toast({ title: "Audience suggestions ready" });
    } catch (error) {
      toast({
        title: "AI audience failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingAudience(false);
    }
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast({ title: "Name your campaign", variant: "destructive" });
      return;
    }
    if (adType === "POST" && selectedPostIds.size === 0) {
      toast({ title: "Choose at least one post", variant: "destructive" });
      return;
    }
    if ((adType === "PRODUCT_LINK" || adType === "EXTERNAL_URL") && !headline.trim()) {
      toast({ title: "Add a headline", variant: "destructive" });
      return;
    }
    if ((adType === "PRODUCT_LINK" || adType === "EXTERNAL_URL") && !destinationUrl.trim()) {
      toast({ title: "Add a destination URL", variant: "destructive" });
      return;
    }
    if (adType === "LANDING_PAGE" && !selectedLandingPageId) {
      toast({ title: "Choose a landing page", variant: "destructive" });
      return;
    }
    if (budgetCredits < 1) {
      toast({ title: "Budget must be at least 1 credit", variant: "destructive" });
      return;
    }
    if (spotlightSelected && !hasVideoCreative) {
      toast({
        title: "Choose a video for spotlight",
        description: adType === "POST" ? "Select at least one video post." : "Upload a video creative first.",
        variant: "destructive",
      });
      return;
    }
    if (adType !== "POST" && !contentPolicyAgreed) {
      toast({ title: "Confirm the content policy", variant: "destructive" });
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
          endDate,
          adType,
          headline: headline.trim() || undefined,
          description: description.trim() || undefined,
          destinationUrl: destinationUrl.trim() || undefined,
          mediaUrl: mediaUrl || undefined,
          videoUrl: videoUrl || undefined,
          ctaText: ctaText || "Learn More",
          adCategory: adType === "POST" ? undefined : adCategory,
          landingPageId: selectedLandingPageId || undefined,
          postIds: adType === "POST" ? Array.from(selectedPostIds) : undefined,
          targeting: {
            providers: Array.from(selectedProviderIds),
            placementChannels: Array.from(selectedProviderIds),
            tags: selectedTags,
          },
          sourceProductId: selectedProductId || undefined,
          sourceStoreId: selectedStoreId || undefined,
        }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error?.message || "Failed to create campaign");

      toast({
        title: adType === "POST" ? "Campaign created" : "Ad sent for review",
        description: adType === "POST" ? "Your post boost is active." : "You will see it in Ads once it is approved.",
      });
      router.push("/ads");
    } catch (error) {
      toast({
        title: "Could not create campaign",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-24 lg:pb-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" asChild className="mt-1 shrink-0">
            <Link href="/ads">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <Badge variant="secondary" className="mb-2 gap-1.5">
              <Bot className="h-3.5 w-3.5" />
              AI launch assistant
            </Badge>
            <h1 className="text-2xl font-semibold tracking-tight">Create an ad</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Pick what to promote, let AI sharpen the message, then launch through the providers that are ready.
            </p>
          </div>
        </div>
        <Button onClick={handleSubmit} disabled={isSubmitting} size="lg" className="gap-2">
          {isSubmitting ? <AISpinner className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
          {adType === "POST" ? "Launch ad" : "Send for review"}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-5 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Wand2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-semibold">What are we launching?</h2>
                  <p className="text-sm text-muted-foreground">Choose the simplest path for this campaign.</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {AD_TYPES.map((type) => {
                  const Icon = type.icon;
                  const selected = adType === type.id;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => changeType(type.id)}
                      className={cn(
                        "rounded-lg border p-4 text-left transition hover:border-primary/50 hover:bg-muted/40",
                        selected && "border-primary bg-primary/5 ring-1 ring-primary/20"
                      )}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <span className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground",
                          selected && "bg-primary text-primary-foreground"
                        )}>
                          <Icon className="h-4 w-4" />
                        </span>
                        {selected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                      </div>
                      <p className="text-sm font-medium">{type.label}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{type.description}</p>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-5 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-semibold">Campaign message</h2>
                  <p className="text-sm text-muted-foreground">Keep the setup short. AI can fill in the first draft.</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleGenerateName} disabled={isGeneratingName} className="gap-2">
                  {isGeneratingName ? <AISpinner className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Name ideas
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="campaign-name">Campaign name</Label>
                    <AIIdeasHistory contentType="campaign_names" onSelect={(value) => setName(value)} />
                  </div>
                  <Input
                    id="campaign-name"
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      setSuggestedNames([]);
                    }}
                    placeholder="Summer sale, new service launch, client promo..."
                  />
                  {suggestedNames.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {suggestedNames.slice(0, 4).map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => {
                            setName(suggestion);
                            setSuggestedNames([]);
                          }}
                          className="rounded-full border bg-background px-3 py-1 text-xs font-medium hover:border-primary hover:text-primary"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Goal</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {OBJECTIVES.map((item) => {
                      const Icon = item.icon;
                      const active = objective === item.value;
                      return (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => setObjective(item.value)}
                          className={cn(
                            "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-medium hover:border-primary/50",
                            active && "border-primary bg-primary/5 text-primary"
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {adType === "POST" && (
                <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-sm font-medium">Choose posts</h3>
                      <p className="text-xs text-muted-foreground">Selected posts become the promoted creative.</p>
                    </div>
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={postSearch}
                        onChange={(event) => setPostSearch(event.target.value)}
                        placeholder="Search posts"
                        className="pl-9"
                      />
                    </div>
                  </div>

                  {postsLoading ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {[1, 2, 3].map((item) => <Skeleton key={item} className="h-44 rounded-lg" />)}
                    </div>
                  ) : filteredPosts.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                      No posts found.
                    </div>
                  ) : (
                    <div className="grid max-h-[460px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                      {filteredPosts.map((post) => {
                        const selected = selectedPostIds.has(post.id);
                        const primaryMediaUrl = post.mediaUrls[0] || null;
                        const isVideoPost = post.mediaType?.toLowerCase().includes("video") || isVideoLikeUrl(primaryMediaUrl);
                        return (
                          <button
                            key={post.id}
                            type="button"
                            onClick={() => togglePost(post.id)}
                            className={cn(
                              "overflow-hidden rounded-lg border bg-background text-left transition hover:border-primary/40",
                              selected && "border-primary ring-1 ring-primary/30"
                            )}
                          >
                            <div className="relative aspect-[4/3] bg-muted">
                              {primaryMediaUrl ? (
                                isVideoPost ? (
                                  <>
                                    <video
                                      src={primaryMediaUrl}
                                      className="h-full w-full object-cover"
                                      muted
                                      playsInline
                                      preload="metadata"
                                    />
                                    <span className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white">
                                      <Play className="h-3.5 w-3.5 fill-current" />
                                    </span>
                                  </>
                                ) : (
                                  <img src={primaryMediaUrl} alt="" className="h-full w-full object-cover" />
                                )
                              ) : (
                                <div className="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
                                  {post.content || "Text post"}
                                </div>
                              )}
                              {selected && (
                                <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                  <Check className="h-4 w-4" />
                                </span>
                              )}
                              {post.isPromoted && (
                                <Badge className="absolute left-2 top-2 text-[10px]">Boosted</Badge>
                              )}
                            </div>
                            <div className="space-y-2 p-3">
                              <p className="line-clamp-2 text-sm">{post.content || "No caption"}</p>
                              <div className="flex gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Heart className="h-3.5 w-3.5" />
                                  {post.likesCount}
                                </span>
                                <span className="flex items-center gap-1">
                                  <MessageCircle className="h-3.5 w-3.5" />
                                  {post.commentsCount}
                                </span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {adType === "PRODUCT_LINK" && (
                <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
                  <div>
                    <h3 className="text-sm font-medium">Pick a product</h3>
                    <p className="text-xs text-muted-foreground">Product details will prefill the ad.</p>
                  </div>
                  <StoreProductPicker
                    selectedProductId={selectedProductId}
                    onSelect={handleProductSelect}
                    onClear={handleProductClear}
                  />
                  {selectedProductId && (
                    <AIAdCreativePanel
                      productId={selectedProductId}
                      onSelect={(variant) => {
                        setHeadline(variant.headline);
                        setDescription(variant.description);
                        setCtaText(variant.ctaText);
                      }}
                    />
                  )}
                </div>
              )}

              {adType === "LANDING_PAGE" && (
                <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
                  <div>
                    <h3 className="text-sm font-medium">Choose a landing page</h3>
                    <p className="text-xs text-muted-foreground">Only published pages can be promoted.</p>
                  </div>
                  {landingPagesLoading ? (
                    <div className="grid gap-3 sm:grid-cols-3">
                      {[1, 2, 3].map((item) => <Skeleton key={item} className="h-36 rounded-lg" />)}
                    </div>
                  ) : landingPages.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-8 text-center">
                      <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                      <p className="text-sm font-medium">No published landing pages</p>
                      <Button asChild variant="outline" size="sm" className="mt-3">
                        <Link href="/landing-pages">Open landing pages</Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-3">
                      {landingPages.map((page) => {
                        const selected = selectedLandingPageId === page.id;
                        return (
                          <button
                            key={page.id}
                            type="button"
                            onClick={() => {
                              setSelectedLandingPageId(page.id);
                              setHeadline(page.title);
                              if (page.description) setDescription(page.description);
                            }}
                            className={cn(
                              "overflow-hidden rounded-lg border bg-background text-left hover:border-primary/40",
                              selected && "border-primary ring-1 ring-primary/30"
                            )}
                          >
                            <div className="flex aspect-[4/3] items-center justify-center bg-muted">
                              {page.thumbnailUrl ? (
                                <img src={page.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <FileText className="h-8 w-8 text-muted-foreground" />
                              )}
                            </div>
                            <div className="p-3">
                              <p className="line-clamp-1 text-sm font-medium">{page.title}</p>
                              <p className="text-xs text-muted-foreground">/{page.slug}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {(adType === "PRODUCT_LINK" || adType === "EXTERNAL_URL") && (
                <div className="grid gap-4 rounded-lg border bg-muted/20 p-4 md:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="headline">Headline</Label>
                      <Input
                        id="headline"
                        value={headline}
                        onChange={(event) => setHeadline(event.target.value)}
                        placeholder="Clear benefit or offer"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="destination">Destination URL</Label>
                      <div className="relative">
                        <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="destination"
                          value={destinationUrl}
                          onChange={(event) => setDestinationUrl(event.target.value)}
                          placeholder="https://..."
                          className="pl-9"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Short description</Label>
                      <Textarea
                        id="description"
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        rows={3}
                        placeholder="What should the customer know before clicking?"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Image</Label>
                      <MediaUploader
                        value={mediaUrl ? [mediaUrl] : []}
                        onChange={(urls) => setMediaUrl(urls[0] || "")}
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        maxSize={10 * 1024 * 1024}
                        filterTypes={["image"]}
                        variant="gallery"
                        placeholder="Add image"
                        libraryTitle="Select ad image"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Video</Label>
                      <MediaUploader
                        value={videoUrl ? [videoUrl] : []}
                        onChange={(urls) => setVideoUrl(urls[0] || "")}
                        accept="video/mp4,video/webm,video/quicktime"
                        maxSize={120 * 1024 * 1024}
                        filterTypes={["video"]}
                        variant="gallery"
                        placeholder="Add video"
                        libraryTitle="Select ad video"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Call to action</Label>
                      <div className="flex flex-wrap gap-2">
                        {CTA_OPTIONS.map((cta) => (
                          <button
                            key={cta}
                            type="button"
                            onClick={() => setCtaText(cta)}
                            className={cn(
                              "rounded-full border px-3 py-1 text-xs font-medium hover:border-primary",
                              ctaText === cta && "border-primary bg-primary/5 text-primary"
                            )}
                          >
                            {cta}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-5 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Globe className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-semibold">Providers and budget</h2>
                  <p className="text-sm text-muted-foreground">Only ready providers are selectable.</p>
                </div>
              </div>

              <TooltipProvider delayDuration={0}>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {standardProviders.map((provider) => {
                    const meta = PROVIDER_META[provider.id] || PROVIDER_META.feed;
                    const Icon = meta.icon;
                    const selected = selectedProviderIds.has(provider.id);
                    const locked = !provider.enabled;
                    return (
                      <Tooltip key={provider.id}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            disabled={locked}
                            onClick={() => toggleProvider(provider)}
                            className={cn(
                              "rounded-lg border p-4 text-left transition",
                              selected && meta.tone,
                              !selected && "bg-background hover:border-primary/40",
                              locked && "cursor-not-allowed opacity-55"
                            )}
                          >
                            <div className="mb-3 flex items-center justify-between gap-2">
                              <Icon className="h-5 w-5" />
                              {locked ? <Lock className="h-4 w-4" /> : selected ? <Check className="h-4 w-4" /> : null}
                            </div>
                            <p className="text-sm font-medium">{provider.name}</p>
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{provider.description}</p>
                            <Badge variant="outline" className="mt-3 text-[10px]">
                              {provider.id === "feed" ? "Included" : provider.enabled ? "Ready" : "Setup needed"}
                            </Badge>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {locked ? "Ask an admin to connect this provider." : provider.name}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </TooltipProvider>

              <div className={cn(
                "flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between",
                spotlightSelected ? "border-cyan-500/45 bg-cyan-500/10" : "bg-background"
              )}>
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-600">
                    <Video className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{spotlightProvider.name}</p>
                      <Badge variant="outline" className="text-[10px]">
                        +{spotlightProvider.feeCredits || PREMIER_SPOTLIGHT_FEE_CREDITS} credits
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Feature a video post or video ad in the Premier spotlight.
                    </p>
                    {spotlightSelected && !hasVideoCreative && (
                      <p className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-300">
                        Add a video before launch.
                      </p>
                    )}
                  </div>
                </div>
                <Switch
                  checked={spotlightSelected}
                  disabled={adType === "LANDING_PAGE"}
                  onCheckedChange={() => toggleProvider(spotlightProvider)}
                  aria-label="Toggle Premier video spotlight"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="budget">Total credits</Label>
                  <Input
                    id="budget"
                    type="number"
                    min="1"
                    step="1"
                    value={budget}
                    onChange={(event) => setBudget(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cpv">Cost per view</Label>
                  <Input
                    id="cpv"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={costPerView}
                    onChange={(event) => setCostPerView(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="start-date">Start</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    min={todayInputValue()}
                    onChange={(event) => handleStartDateChange(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration">Days</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="1"
                    value={durationDays}
                    onChange={(event) => handleDurationChange(event.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Spend</p>
                  <p className="text-lg font-semibold">{budgetCredits} credits</p>
                  <p className="text-xs text-muted-foreground">${budgetDollars.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Views</p>
                  <p className="text-lg font-semibold">{estimatedViews.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">estimated</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Daily pace</p>
                  <p className="text-lg font-semibold">{Math.ceil(budgetCredits / campaignDays)}</p>
                  <p className="text-xs text-muted-foreground">credits/day</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total charge</p>
                  <p className="text-lg font-semibold">{totalChargeCredits} credits</p>
                  <p className="text-xs text-muted-foreground">
                    {spotlightSelected ? `includes ${spotlightFeeCredits} spotlight` : `${formatDate(startDate)} to ${formatDate(endDate)}`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-5 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-semibold">Audience</h2>
                    <p className="text-sm text-muted-foreground">Use a few strong signals instead of a crowded setup.</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleGenerateAudience} disabled={isGeneratingAudience} className="gap-2">
                  {isGeneratingAudience ? <AISpinner className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Suggest audience
                </Button>
              </div>

              {aiSuggestedTags.length > 0 && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium">AI suggestions</p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTags((current) => {
                          const next = aiSuggestedTags.filter(
                            (tag) => !current.some((item) => item.label === tag.label && item.category === tag.category)
                          );
                          return [...current, ...next];
                        });
                        setAiSuggestedTags([]);
                      }}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Add all
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {aiSuggestedTags.map((tag) => (
                      <button
                        key={`${tag.category}-${tag.label}`}
                        type="button"
                        onClick={() => {
                          toggleTag(tag);
                          setAiSuggestedTags((current) => current.filter((item) => !(item.label === tag.label && item.category === tag.category)));
                        }}
                        className="rounded-full border bg-background px-3 py-1 text-xs hover:border-primary"
                      >
                        {tag.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedTags.map((tag) => (
                    <span
                      key={`${tag.category}-${tag.label}`}
                      className="inline-flex items-center gap-1 rounded-full border bg-background px-3 py-1 text-xs font-medium"
                    >
                      {tag.label}
                      <button type="button" onClick={() => toggleTag(tag)}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {DEFAULT_TAGS.map((tag) => {
                  const selected = selectedTags.some((item) => item.label === tag.label && item.category === tag.category);
                  return (
                    <button
                      key={`${tag.category}-${tag.label}`}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium hover:border-primary",
                        selected && "border-primary bg-primary/5 text-primary"
                      )}
                    >
                      {tag.label}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardContent className="space-y-5 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Preview</p>
                  <h2 className="mt-1 text-lg font-semibold">{name || "Untitled ad"}</h2>
                </div>
                <Badge variant="secondary">{selectedType.shortLabel}</Badge>
              </div>

              <div className="overflow-hidden rounded-lg border bg-muted/30">
                {adType === "POST" && selectedPostIds.size > 0 ? (
                  Array.from(selectedPostIds).slice(0, 1).map((id) => {
                    const post = posts.find((item) => item.id === id);
                    const selectedMediaUrl = post?.mediaUrls[0] || null;
                    const selectedIsVideo = post?.mediaType?.toLowerCase().includes("video") || isVideoLikeUrl(selectedMediaUrl);
                    return selectedMediaUrl ? (
                      selectedIsVideo ? (
                        <video key={id} src={selectedMediaUrl} className="aspect-video w-full object-cover" muted playsInline controls />
                      ) : (
                        <img key={id} src={selectedMediaUrl} alt="" className="aspect-video w-full object-cover" />
                      )
                    ) : (
                      <div key={id} className="flex aspect-video items-center justify-center p-6 text-center text-sm text-muted-foreground">
                        {post?.content || "Selected post"}
                      </div>
                    );
                  })
                ) : videoUrl ? (
                  <video src={videoUrl} className="aspect-video w-full object-cover" muted playsInline controls />
                ) : mediaUrl ? (
                  <img src={mediaUrl} alt="" className="aspect-video w-full object-cover" />
                ) : (
                  <div className="flex aspect-video items-center justify-center">
                    <SelectedTypeIcon className="h-10 w-10 text-muted-foreground" />
                  </div>
                )}
                <div className="space-y-2 p-4">
                  <p className="font-medium">{headline || selectedLandingPage?.title || selectedObjective.label}</p>
                  <p className="line-clamp-3 text-sm text-muted-foreground">
                    {description || selectedLandingPage?.description || "AI-ready creative will appear here as you fill the campaign."}
                  </p>
                  {adType !== "POST" && (
                    <Button size="sm" variant="outline" className="mt-2 w-full gap-2">
                      <ExternalLink className="h-4 w-4" />
                      {ctaText}
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Goal</span>
                  <span className="font-medium">{selectedObjective.label}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Budget</span>
                  <span className="font-medium">{totalChargeCredits} credits</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Estimate</span>
                  <span className="font-medium">{estimatedViews.toLocaleString()} views</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Schedule</span>
                  <span className="font-medium">{formatDate(startDate)} - {formatDate(endDate)}</span>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Providers</p>
                <div className="flex flex-wrap gap-2">
                  {(selectedProviders.length ? selectedProviders : [DEFAULT_PROVIDERS[0]]).map((provider) => {
                    const meta = PROVIDER_META[provider.id] || PROVIDER_META.feed;
                    const Icon = meta.icon;
                    return (
                      <span key={provider.id} className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-xs">
                        <Icon className="h-3.5 w-3.5" />
                        {provider.name}
                      </span>
                    );
                  })}
                </div>
              </div>

              {adType !== "POST" && (
                <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                  <div className="flex gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 text-amber-600" />
                    <div>
                      <p className="text-sm font-medium">Review required</p>
                      <p className="text-xs text-muted-foreground">External ads go live after admin approval.</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <select
                      value={adCategory}
                      onChange={(event) => setAdCategory(event.target.value)}
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    >
                      {AD_CATEGORIES.map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>
                  <label className="flex cursor-pointer items-start gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={contentPolicyAgreed}
                      onChange={(event) => setContentPolicyAgreed(event.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-border"
                    />
                    This ad is accurate, safe, and allowed for review.
                  </label>
                </div>
              )}

              <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full gap-2" size="lg">
                {isSubmitting ? <AISpinner className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                {adType === "POST" ? "Launch ad" : "Send for review"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-4 text-sm">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
                <span>Feed delivery is always included.</span>
              </div>
              <div className="flex items-start gap-2">
                <Settings className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <span>Google, Meta, and TikTok appear when provider credentials are configured.</span>
              </div>
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                <span>Credits are reserved when the campaign is created.</span>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background p-3 shadow-lg lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">{budgetCredits} credits</p>
            <p className="text-xs text-muted-foreground">{selectedType.shortLabel} - {estimatedViews.toLocaleString()} views</p>
          </div>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2">
            {isSubmitting ? <AISpinner className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            Launch
          </Button>
        </div>
      </div>
    </div>
  );
}
