"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Palette,
  Building2,
  Users,
  MessageSquare,
  Hash,
  Save,
  CheckCircle,
  Sparkles,
  Target,
  Globe,
  Package,
  Plus,
  X,
  Paintbrush,
  Mail,
  Phone,
  MapPin,
  Link,
  Instagram,
  Twitter,
  Linkedin,
  Facebook,
  Link2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { MediaUploader } from "@/components/shared/media-uploader";
import { AISpinner } from "@/components/shared/ai-generation-loader";

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.62a8.16 8.16 0 0 0 4.76 1.52v-3.4c0-.01-1-.05-1-1.05z"/></svg>
  );
}

function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 0 0 .5 6.19 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.81 3.02 3.02 0 0 0 2.12 2.14c1.84.55 9.38.55 9.38.55s7.54 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.81zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"/></svg>
  );
}

const socialPlatforms = [
  { id: "instagram", label: "Instagram", icon: Instagram, placeholder: "@username or URL" },
  { id: "twitter", label: "X / Twitter", icon: Twitter, placeholder: "@username or URL" },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin, placeholder: "URL or username" },
  { id: "facebook", label: "Facebook", icon: Facebook, placeholder: "URL or page name" },
  { id: "tiktok", label: "TikTok", icon: TikTokIcon, placeholder: "@username or URL" },
  { id: "youtube", label: "YouTube", icon: YouTubeIcon, placeholder: "Channel URL" },
];

const voiceTones = [
  { id: "professional", label: "Professional", description: "Formal, authoritative, expert" },
  { id: "casual", label: "Casual", description: "Relaxed, conversational, friendly" },
  { id: "playful", label: "Playful", description: "Fun, witty, humorous" },
  { id: "inspirational", label: "Inspirational", description: "Motivating, uplifting, empowering" },
  { id: "educational", label: "Educational", description: "Informative, helpful, teaching" },
  { id: "friendly", label: "Friendly", description: "Warm, approachable, personable" },
  { id: "authoritative", label: "Authoritative", description: "Confident, expert, trusted" },
];

const personalityTraits = [
  "Innovative", "Trustworthy", "Friendly", "Bold", "Creative",
  "Reliable", "Modern", "Traditional", "Luxury", "Accessible",
  "Eco-friendly", "Tech-savvy", "Community-focused", "Expert", "Authentic",
];

const industries = [
  "SaaS / Technology",
  "E-commerce / Retail",
  "Health & Wellness",
  "Finance / Fintech",
  "Education",
  "Marketing / Agency",
  "Food & Beverage",
  "Fashion & Beauty",
  "Travel & Hospitality",
  "Real Estate",
  "Entertainment / Media",
  "Non-profit",
  "Professional Services",
  "Manufacturing",
  "Other",
];

interface BrandKit {
  id: string;
  name: string;
  tagline: string | null;
  description: string | null;
  logo: string | null;
  iconLogo: string | null;
  industry: string | null;
  niche: string | null;
  targetAudience: string | null;
  audienceAge: string | null;
  audienceLocation: string | null;
  voiceTone: string | null;
  personality: string[];
  keywords: string[];
  avoidWords: string[];
  colors: { primary?: string; secondary?: string; accent?: string };
  fonts: { heading?: string; body?: string };
  guidelines: string | null;
  hashtags: string[];
  handles: Record<string, string>;
  products: string[];
  uniqueValue: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  isComplete: boolean;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function BrandIdentityPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSetup, setHasSetup] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [businessDescription, setBusinessDescription] = useState("");

  // Form state - ensure ALL fields from BrandKit are initialized
  const [formData, setFormData] = useState<Partial<BrandKit>>({
    name: "",
    tagline: "",
    description: "",
    logo: "",
    iconLogo: "",
    industry: "",
    niche: "",
    targetAudience: "",
    audienceAge: "",
    audienceLocation: "",
    voiceTone: "",
    personality: [],
    keywords: [],
    avoidWords: [],
    colors: { primary: "#0ea5e9", secondary: "#8b5cf6", accent: "#f59e0b" },
    fonts: { heading: "", body: "" },
    guidelines: "",
    hashtags: [],
    handles: {},
    products: [],
    uniqueValue: "",
    email: "",
    phone: "",
    website: "",
    address: "",
  });

  // Input states for adding items
  const [newKeyword, setNewKeyword] = useState("");
  const [newHashtag, setNewHashtag] = useState("");
  const [newProduct, setNewProduct] = useState("");

  useEffect(() => {
    fetchBrandIdentity();
  }, []);

  const fetchBrandIdentity = async () => {
    try {
      setIsLoading(true);
      const [brandRes, profileRes] = await Promise.all([
        fetch("/api/brand"),
        fetch("/api/users/profile"),
      ]);
      const data = await brandRes.json();
      const profileData = await profileRes.json();

      if (data.success && data.data.brandKit) {
        const kit = data.data.brandKit;
        // Sync social handles from user profile links if brand handles are empty
        if (profileData.success && profileData.data?.user?.links) {
          const userLinks = profileData.data.user.links;
          const currentHandles = kit.handles || {};
          const mergedHandles: Record<string, string> = { ...currentHandles };
          let needsSync = false;
          for (const p of ["instagram", "twitter", "linkedin", "facebook", "tiktok", "youtube"]) {
            if (!mergedHandles[p] && userLinks[p]) {
              mergedHandles[p] = userLinks[p];
              needsSync = true;
            }
          }
          if (needsSync) {
            kit.handles = mergedHandles;
          }
        }
        setFormData(kit);
        setHasSetup(data.data.hasSetup);
      }
    } catch (error) {
      console.error("Failed to fetch brand identity:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      // Clean up data - convert empty strings to null for optional fields
      const cleanData = {
        ...formData,
        tagline: formData.tagline || null,
        description: formData.description || null,
        logo: formData.logo || null,
        iconLogo: formData.iconLogo || null,
        industry: formData.industry || null,
        niche: formData.niche || null,
        targetAudience: formData.targetAudience || null,
        audienceAge: formData.audienceAge || null,
        audienceLocation: formData.audienceLocation || null,
        voiceTone: formData.voiceTone || null,
        guidelines: formData.guidelines || null,
        uniqueValue: formData.uniqueValue || null,
        email: formData.email || null,
        phone: formData.phone || null,
        website: formData.website || null,
        address: formData.address || null,
      };

      // Debug: Log what we're saving
      console.log("Saving brand data (cleaned):", {
        name: cleanData.name,
        description: cleanData.description,
        website: cleanData.website,
        logo: cleanData.logo,
        iconLogo: cleanData.iconLogo,
        industry: cleanData.industry,
        voiceTone: cleanData.voiceTone,
      });

      const response = await fetch("/api/brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanData),
      });

      const data = await response.json();
      console.log("Brand save response:", data);

      if (data.success) {
        setHasSetup(data.data.brandKit.isComplete);

        // Sync social handles to user profile links (fire-and-forget, merge with existing)
        if (formData.handles) {
          const newHandles: Record<string, string> = {};
          for (const p of ["instagram", "twitter", "linkedin", "facebook", "tiktok", "youtube"]) {
            if (formData.handles[p]) newHandles[p] = formData.handles[p];
          }
          if (Object.keys(newHandles).length > 0) {
            fetch("/api/users/profile").then(r => r.json()).then(profileData => {
              if (profileData.success) {
                const existingLinks = profileData.data?.user?.links || {};
                fetch("/api/users/profile", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ links: { ...existingLinks, ...newHandles } }),
                });
              }
            }).catch(() => {});
          }
        }

        toast({
          title: "Brand identity saved!",
          description: "Your brand settings have been updated. AI will now use these for content generation.",
        });
      } else {
        console.error("Brand save failed:", data.error);
        // Show validation errors if available
        if (data.error?.details) {
          console.error("Validation errors:", data.error.details);
          toast({
            title: "Validation Error",
            description: JSON.stringify(data.error.details),
            variant: "destructive",
          });
        }
        throw new Error(data.error?.message || "Failed to save");
      }
    } catch (error) {
      console.error("Brand save error:", error);
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAIGenerate = async () => {
    // For new setup, require a description
    // For improvement, use existing brand data if no description provided
    const description = businessDescription.trim() ||
      (hasSetup ? `Improve this brand: ${formData.name}. Industry: ${formData.industry}. ${formData.description || ""}` : "");

    if (!description) {
      toast({
        title: "Description required",
        description: "Please describe your business to generate brand identity",
        variant: "destructive",
      });
      return;
    }

    // Preserve the current logos before generation
    const currentLogo = formData.logo;
    const currentIconLogo = formData.iconLogo;

    try {
      setIsGenerating(true);
      const response = await fetch("/api/brand/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });

      const data = await response.json();

      if (data.success) {
        // Restore the logo if it existed before generation
        setFormData({
          ...data.data.brandKit,
          logo: currentLogo || data.data.brandKit.logo,
          iconLogo: currentIconLogo || data.data.brandKit.iconLogo,
        });
        toast({
          title: hasSetup ? "Brand improved!" : "Brand identity generated!",
          description: "Review the suggestions and edit as needed, then save.",
        });
      } else {
        throw new Error(data.error?.message || "Generation failed");
      }
    } catch (error) {
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const togglePersonality = (trait: string) => {
    setFormData((prev) => ({
      ...prev,
      personality: prev.personality?.includes(trait)
        ? prev.personality.filter((t) => t !== trait)
        : [...(prev.personality || []), trait],
    }));
  };

  const addKeyword = () => {
    if (newKeyword.trim() && !formData.keywords?.includes(newKeyword.trim())) {
      setFormData((prev) => ({
        ...prev,
        keywords: [...(prev.keywords || []), newKeyword.trim()],
      }));
      setNewKeyword("");
    }
  };

  const removeKeyword = (keyword: string) => {
    setFormData((prev) => ({
      ...prev,
      keywords: prev.keywords?.filter((k) => k !== keyword) || [],
    }));
  };

  const addHashtag = () => {
    let tag = newHashtag.trim();
    if (tag && !tag.startsWith("#")) tag = "#" + tag;
    if (tag && !formData.hashtags?.includes(tag)) {
      setFormData((prev) => ({
        ...prev,
        hashtags: [...(prev.hashtags || []), tag],
      }));
      setNewHashtag("");
    }
  };

  const removeHashtag = (hashtag: string) => {
    setFormData((prev) => ({
      ...prev,
      hashtags: prev.hashtags?.filter((h) => h !== hashtag) || [],
    }));
  };

  const addProduct = () => {
    if (newProduct.trim() && !formData.products?.includes(newProduct.trim())) {
      setFormData((prev) => ({
        ...prev,
        products: [...(prev.products || []), newProduct.trim()],
      }));
      setNewProduct("");
    }
  };

  const removeProduct = (product: string) => {
    setFormData((prev) => ({
      ...prev,
      products: prev.products?.filter((p) => p !== product) || [],
    }));
  };

  const updateColor = (key: "primary" | "secondary" | "accent", value: string) => {
    setFormData((prev) => ({
      ...prev,
      colors: { ...prev.colors, [key]: value },
    }));
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-64 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-accent-purple flex items-center justify-center">
              <Palette className="w-4 h-4 text-white" />
            </div>
            Brand Identity
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {hasSetup && (
            <Badge variant="secondary" className="bg-green-100 text-green-700">
              <CheckCircle className="w-3 h-3 mr-1" />
              Setup Complete
            </Badge>
          )}
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <AISpinner className="w-4 h-4 mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </motion.div>

      {/* AI Generation Section */}
      <motion.div variants={itemVariants}>
        {hasSetup ? (
          // Compact improvement bar when brand is already set up
          <Card className="bg-gradient-to-r from-brand-500/5 via-accent-purple/5 to-pink-500/5 border-brand-500/20">
            <CardContent className="py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-500 to-accent-purple flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">AI-Powered Improvement</p>
                    <p className="text-xs text-muted-foreground">
                      Regenerate brand details while keeping your logo
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleAIGenerate}
                  disabled={isGenerating}
                  className="bg-gradient-to-r from-brand-500 to-accent-purple hover:opacity-90"
                >
                  {isGenerating ? (
                    <>
                      <AISpinner className="w-4 h-4 mr-2" />
                      Improving...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Improve with AI
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          // Full generation view for new setup
          <Card className="bg-gradient-to-r from-brand-500/5 via-accent-purple/5 to-pink-500/5 border-brand-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-brand-500" />
                AI-Powered Setup
              </CardTitle>
              <CardDescription>
                Describe your business and let AI generate your complete brand identity
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Describe your business in detail... e.g., 'We are a SaaS company that provides AI-powered social media management tools for small businesses. Our target customers are marketing managers and entrepreneurs who want to save time creating content. We focus on being helpful, innovative, and easy to use.'"
                className="min-h-[120px]"
                value={businessDescription}
                onChange={(e) => setBusinessDescription(e.target.value)}
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  The more details you provide, the better the AI suggestions will be
                </p>
                <Button
                  onClick={handleAIGenerate}
                  disabled={isGenerating || !businessDescription.trim()}
                  className="bg-gradient-to-r from-brand-500 to-accent-purple hover:opacity-90"
                >
                  {isGenerating ? (
                    <>
                      <AISpinner className="w-4 h-4 mr-2" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Brand Identity
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* Info Banner */}
      {!hasSetup && !isGenerating && (
        <motion.div variants={itemVariants}>
          <Card className="bg-muted/50 border-dashed">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Target className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Tip:</span> Use the AI generator above for quick setup, or fill in the forms below manually. Fields marked with * are required for AI content generation.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        {/* Basic Info */}
        <motion.div variants={itemVariants} className="h-full">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-brand-500" />
                Basic Information
              </CardTitle>
              <CardDescription>Your brand's core identity</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Brand Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., FlowSmartly"
                  value={formData.name || ""}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tagline">Tagline</Label>
                <Input
                  id="tagline"
                  placeholder="e.g., Create smarter, grow faster"
                  value={formData.tagline || ""}
                  onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Brand Description</Label>
                <Textarea
                  id="description"
                  placeholder="Briefly describe what your brand does..."
                  className="min-h-[100px]"
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="industry">Industry *</Label>
                <Select
                  value={formData.industry || ""}
                  onValueChange={(value) => setFormData({ ...formData, industry: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {industries.map((industry) => (
                      <SelectItem key={industry} value={industry}>
                        {industry}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="niche">Specific Niche</Label>
                <Input
                  id="niche"
                  placeholder="e.g., AI-powered social media management"
                  value={formData.niche || ""}
                  onChange={(e) => setFormData({ ...formData, niche: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Contact Information */}
        <motion.div variants={itemVariants} className="h-full">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5 text-teal-500" />
                Contact Information
              </CardTitle>
              <CardDescription>Business contact details for AI-generated designs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="hello@yourbrand.com"
                  value={formData.email || ""}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  placeholder="+1 (555) 123-4567"
                  value={formData.phone || ""}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website" className="flex items-center gap-2">
                  <Link className="w-3.5 h-3.5 text-muted-foreground" />
                  Website
                </Label>
                <Input
                  id="website"
                  placeholder="https://yourbrand.com"
                  value={formData.website || ""}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address" className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                  Address
                </Label>
                <Input
                  id="address"
                  placeholder="123 Main St, City, State"
                  value={formData.address || ""}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                These details can be included in AI-generated visual designs from the Studio
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Visual Identity - Logo & Colors */}
        <motion.div variants={itemVariants} className="h-full">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Paintbrush className="w-5 h-5 text-pink-500" />
                Visual Identity
              </CardTitle>
              <CardDescription>Your brand&apos;s logo and color palette</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Dual Logo Upload */}
              <div className="space-y-4">
                <div>
                  <Label>Brand Logos</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    The icon logo is used for social media avatars and feeds. The full logo is used in designs, emails, and other places.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Icon Logo */}
                  <MediaUploader
                    value={formData.iconLogo ? [formData.iconLogo] : []}
                    onChange={(urls) => setFormData({ ...formData, iconLogo: urls[0] || "" })}
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                    maxSize={5 * 1024 * 1024}
                    filterTypes={["image", "png", "jpg", "jpeg", "webp", "svg"]}
                    label="Icon Logo"
                    description="Square format, used as your social avatar"
                    placeholder="Upload"
                    variant="medium"
                    libraryTitle="Select Icon Logo from Library"
                  />

                  {/* Full Logo */}
                  <MediaUploader
                    value={formData.logo ? [formData.logo] : []}
                    onChange={(urls) => setFormData({ ...formData, logo: urls[0] || "" })}
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                    maxSize={5 * 1024 * 1024}
                    filterTypes={["image", "png", "jpg", "jpeg", "webp", "svg"]}
                    label="Full Logo"
                    description="Wide format, used in designs & emails"
                    placeholder="Upload"
                    variant="medium"
                    libraryTitle="Select Full Logo from Library"
                  />
                </div>

                {/* Generate AI link for both */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/logo-generator")}
                  className="border-brand-500/30 text-brand-600 hover:bg-brand-500/5"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Logos with AI
                </Button>
              </div>

              {/* Brand Colors */}
              <div className="space-y-3">
                <Label>Brand Colors</Label>
                <div className="space-y-3">
                  {[
                    { key: "primary" as const, label: "Primary", description: "Main brand color" },
                    { key: "secondary" as const, label: "Secondary", description: "Supporting color" },
                    { key: "accent" as const, label: "Accent", description: "Highlight color" },
                  ].map(({ key, label, description }) => (
                    <div key={key} className="flex items-center gap-3">
                      <div className="relative">
                        <input
                          type="color"
                          value={formData.colors?.[key] || "#000000"}
                          onChange={(e) => updateColor(key, e.target.value)}
                          className="w-10 h-10 rounded-lg cursor-pointer border-2 border-muted bg-transparent p-0.5"
                          style={{ WebkitAppearance: "none" }}
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-xs text-muted-foreground">{description}</p>
                      </div>
                      <Input
                        value={formData.colors?.[key] || "#000000"}
                        onChange={(e) => updateColor(key, e.target.value)}
                        className="w-28 font-mono text-xs"
                        placeholder="#000000"
                      />
                    </div>
                  ))}
                </div>

                {/* Color Preview */}
                <div className="flex gap-2 mt-2">
                  <div
                    className="flex-1 h-12 rounded-lg shadow-sm border"
                    style={{ backgroundColor: formData.colors?.primary || "#0ea5e9" }}
                  />
                  <div
                    className="flex-1 h-12 rounded-lg shadow-sm border"
                    style={{ backgroundColor: formData.colors?.secondary || "#8b5cf6" }}
                  />
                  <div
                    className="flex-1 h-12 rounded-lg shadow-sm border"
                    style={{ backgroundColor: formData.colors?.accent || "#f59e0b" }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  These colors will be used in AI-generated designs and content
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Target Audience */}
        <motion.div variants={itemVariants} className="h-full">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-accent-purple" />
                Target Audience
              </CardTitle>
              <CardDescription>Who you're creating content for</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="targetAudience">Audience Description *</Label>
                <Textarea
                  id="targetAudience"
                  placeholder="e.g., Small business owners and marketing managers who want to save time on social media"
                  className="min-h-[100px]"
                  value={formData.targetAudience || ""}
                  onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="audienceAge">Age Range</Label>
                <Input
                  id="audienceAge"
                  placeholder="e.g., 25-45 years old"
                  value={formData.audienceAge || ""}
                  onChange={(e) => setFormData({ ...formData, audienceAge: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="audienceLocation">Geographic Focus</Label>
                <Input
                  id="audienceLocation"
                  placeholder="e.g., United States, English-speaking countries"
                  value={formData.audienceLocation || ""}
                  onChange={(e) => setFormData({ ...formData, audienceLocation: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="uniqueValue">Unique Value Proposition</Label>
                <Textarea
                  id="uniqueValue"
                  placeholder="What makes your brand different from competitors?"
                  className="min-h-[80px]"
                  value={formData.uniqueValue || ""}
                  onChange={(e) => setFormData({ ...formData, uniqueValue: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Brand Voice */}
        <motion.div variants={itemVariants} className="h-full">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-green-500" />
                Brand Voice & Personality
              </CardTitle>
              <CardDescription>How your brand communicates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Voice Tone *</Label>
                <div className="grid grid-cols-2 gap-2">
                  {voiceTones.map((tone) => (
                    <button
                      key={tone.id}
                      onClick={() => setFormData({ ...formData, voiceTone: tone.id })}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        formData.voiceTone === tone.id
                          ? "border-brand-500 bg-brand-500/5"
                          : "hover:bg-muted"
                      }`}
                    >
                      <p className="font-medium text-sm">{tone.label}</p>
                      <p className="text-xs text-muted-foreground">{tone.description}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Personality Traits (select multiple)</Label>
                <div className="flex flex-wrap gap-2">
                  {personalityTraits.map((trait) => (
                    <button
                      key={trait}
                      onClick={() => togglePersonality(trait)}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                        formData.personality?.includes(trait)
                          ? "bg-brand-500 text-white"
                          : "bg-muted hover:bg-muted/80"
                      }`}
                    >
                      {trait}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Keywords & Hashtags */}
        <motion.div variants={itemVariants} className="h-full">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hash className="w-5 h-5 text-orange-500" />
                Keywords & Hashtags
              </CardTitle>
              <CardDescription>Key terms for your content</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Brand Keywords</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a keyword..."
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword())}
                  />
                  <Button type="button" variant="outline" onClick={addKeyword}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.keywords?.map((keyword) => (
                    <Badge key={keyword} variant="secondary" className="pr-1">
                      {keyword}
                      <button
                        onClick={() => removeKeyword(keyword)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Brand Hashtags</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a hashtag..."
                    value={newHashtag}
                    onChange={(e) => setNewHashtag(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addHashtag())}
                  />
                  <Button type="button" variant="outline" onClick={addHashtag}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.hashtags?.map((hashtag) => (
                    <Badge key={hashtag} variant="secondary" className="pr-1 bg-brand-500/10 text-brand-600">
                      {hashtag}
                      <button
                        onClick={() => removeHashtag(hashtag)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Products/Services */}
        <motion.div variants={itemVariants} className="h-full">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-500" />
                Products & Services
              </CardTitle>
              <CardDescription>What you offer</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Main Products/Services</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a product or service..."
                    value={newProduct}
                    onChange={(e) => setNewProduct(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addProduct())}
                  />
                  <Button type="button" variant="outline" onClick={addProduct}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.products?.map((product) => (
                    <Badge key={product} variant="secondary" className="pr-1">
                      {product}
                      <button
                        onClick={() => removeProduct(product)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Social Handles */}
        <motion.div variants={itemVariants} className="h-full">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-pink-500" />
                Social Media Handles
              </CardTitle>
              <CardDescription>Your social media presence</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                {socialPlatforms.map((platform) => {
                  const Icon = platform.icon;
                  return (
                    <div key={platform.id} className="space-y-1.5">
                      <Label htmlFor={`brand-${platform.id}`} className="text-xs flex items-center gap-1.5">
                        <Icon className="w-3.5 h-3.5" /> {platform.label}
                      </Label>
                      <Input
                        id={`brand-${platform.id}`}
                        placeholder={platform.placeholder}
                        value={formData.handles?.[platform.id] || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            handles: { ...formData.handles, [platform.id]: e.target.value },
                          })
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Save Button - Bottom */}
      <motion.div variants={itemVariants} className="flex justify-end pt-4">
        <Button onClick={handleSave} disabled={isSaving} size="lg">
          {isSaving ? (
            <AISpinner className="w-4 h-4 mr-2" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save Brand Identity
        </Button>
      </motion.div>

    </motion.div>
  );
}
