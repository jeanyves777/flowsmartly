"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Palette,
  Building2,
  Users,
  MessageSquare,
  Hash,
  Save,
  Loader2,
  CheckCircle,
  Upload,
  Sparkles,
  Target,
  Globe,
  Package,
  Plus,
  X,
  ImageIcon,
  Paintbrush,
  Trash2,
  Mail,
  Phone,
  MapPin,
  Link,
  FolderOpen,
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
import { MediaLibraryPicker } from "@/components/shared/media-library-picker";

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
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingIconLogo, setIsUploadingIconLogo] = useState(false);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [showIconMediaLibrary, setShowIconMediaLibrary] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const iconLogoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchBrandIdentity();
  }, []);

  const fetchBrandIdentity = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/brand");
      const data = await response.json();

      if (data.success && data.data.brandKit) {
        setFormData(data.data.brandKit);
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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate on client side
    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];
    if (!allowed.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Please upload PNG, JPEG, WebP, or SVG", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 5MB", variant: "destructive" });
      return;
    }

    try {
      setIsUploadingLogo(true);
      const uploadData = new FormData();
      uploadData.append("file", file);
      uploadData.append("type", "logo");

      const response = await fetch("/api/upload", {
        method: "POST",
        body: uploadData,
      });

      const data = await response.json();

      if (data.success) {
        setFormData((prev) => ({ ...prev, logo: data.data.url }));
        toast({ title: "Logo uploaded successfully!" });
      } else {
        throw new Error(data.error?.message || "Upload failed");
      }
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsUploadingLogo(false);
      // Reset input so the same file can be re-uploaded
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const removeLogo = () => {
    setFormData((prev) => ({ ...prev, logo: "" }));
  };

  const handleIconLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];
    if (!allowed.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Please upload PNG, JPEG, WebP, or SVG", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 5MB", variant: "destructive" });
      return;
    }

    try {
      setIsUploadingIconLogo(true);
      const uploadData = new FormData();
      uploadData.append("file", file);
      uploadData.append("type", "logo");

      const response = await fetch("/api/upload", {
        method: "POST",
        body: uploadData,
      });

      const data = await response.json();

      if (data.success) {
        setFormData((prev) => ({ ...prev, iconLogo: data.data.url }));
        toast({ title: "Icon logo uploaded successfully!" });
      } else {
        throw new Error(data.error?.message || "Upload failed");
      }
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsUploadingIconLogo(false);
      if (iconLogoInputRef.current) iconLogoInputRef.current.value = "";
    }
  };

  const removeIconLogo = () => {
    setFormData((prev) => ({ ...prev, iconLogo: "" }));
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
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-accent-purple flex items-center justify-center">
              <Palette className="w-6 h-6 text-white" />
            </div>
            Brand Identity
          </h1>
          <p className="text-muted-foreground mt-2">
            Set up your brand details so AI can create personalized content for you
          </p>
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
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Icon Logo</p>
                    <p className="text-xs text-muted-foreground">Square format, used as your social avatar</p>
                    <div
                      className={`relative w-20 h-20 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden transition-colors ${
                        formData.iconLogo ? "border-brand-500/30 bg-white" : "border-muted-foreground/25 bg-muted/50 hover:border-brand-500/50 hover:bg-muted"
                      }`}
                    >
                      {formData.iconLogo ? (
                        <>
                          <img
                            src={formData.iconLogo}
                            alt="Icon logo"
                            className="w-full h-full object-contain p-1"
                          />
                          <button
                            onClick={removeIconLogo}
                            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center hover:bg-destructive/80"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => iconLogoInputRef.current?.click()}
                          className="flex flex-col items-center gap-1 text-muted-foreground"
                          disabled={isUploadingIconLogo}
                        >
                          {isUploadingIconLogo ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <>
                              <ImageIcon className="w-5 h-5" />
                              <span className="text-[10px]">Upload</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    <input
                      ref={iconLogoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={handleIconLogoUpload}
                    />
                    <div className="flex flex-wrap gap-1.5">
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => iconLogoInputRef.current?.click()} disabled={isUploadingIconLogo}>
                        {isUploadingIconLogo ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Upload className="w-3 h-3 mr-1" />}
                        Upload
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowIconMediaLibrary(true)}>
                        <FolderOpen className="w-3 h-3 mr-1" />
                        Library
                      </Button>
                    </div>
                    {formData.iconLogo && (
                      <button onClick={removeIconLogo} className="text-xs text-destructive hover:underline flex items-center gap-1">
                        <Trash2 className="w-3 h-3" />
                        Remove
                      </button>
                    )}
                  </div>

                  {/* Full Logo */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Full Logo</p>
                    <p className="text-xs text-muted-foreground">Wide format, used in designs & emails</p>
                    <div
                      className={`relative w-20 h-20 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden transition-colors ${
                        formData.logo ? "border-brand-500/30 bg-white" : "border-muted-foreground/25 bg-muted/50 hover:border-brand-500/50 hover:bg-muted"
                      }`}
                    >
                      {formData.logo ? (
                        <>
                          <img
                            src={formData.logo}
                            alt="Full logo"
                            className="w-full h-full object-contain p-1"
                          />
                          <button
                            onClick={removeLogo}
                            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center hover:bg-destructive/80"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => logoInputRef.current?.click()}
                          className="flex flex-col items-center gap-1 text-muted-foreground"
                          disabled={isUploadingLogo}
                        >
                          {isUploadingLogo ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <>
                              <ImageIcon className="w-5 h-5" />
                              <span className="text-[10px]">Upload</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={handleLogoUpload}
                    />
                    <div className="flex flex-wrap gap-1.5">
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => logoInputRef.current?.click()} disabled={isUploadingLogo}>
                        {isUploadingLogo ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Upload className="w-3 h-3 mr-1" />}
                        Upload
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowMediaLibrary(true)}>
                        <FolderOpen className="w-3 h-3 mr-1" />
                        Library
                      </Button>
                    </div>
                    {formData.logo && (
                      <button onClick={removeLogo} className="text-xs text-destructive hover:underline flex items-center gap-1">
                        <Trash2 className="w-3 h-3" />
                        Remove
                      </button>
                    )}
                  </div>
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
              <div className="grid gap-3">
                {["instagram", "twitter", "linkedin", "facebook", "youtube", "tiktok"].map((platform) => (
                  <div key={platform} className="flex items-center gap-2">
                    <Label className="w-24 capitalize">{platform}</Label>
                    <Input
                      placeholder={`@your${platform}`}
                      value={formData.handles?.[platform] || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          handles: { ...formData.handles, [platform]: e.target.value },
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Save Button - Bottom */}
      <motion.div variants={itemVariants} className="flex justify-end pt-4">
        <Button onClick={handleSave} disabled={isSaving} size="lg">
          {isSaving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save Brand Identity
        </Button>
      </motion.div>

      {/* Media Library Picker - Full Logo */}
      <MediaLibraryPicker
        open={showMediaLibrary}
        onClose={() => setShowMediaLibrary(false)}
        onSelect={(url) => {
          setFormData({ ...formData, logo: url });
          setShowMediaLibrary(false);
          toast({ title: "Full logo selected from library" });
        }}
        title="Select Full Logo from Library"
        filterTypes={["image", "png", "jpg", "jpeg", "webp", "svg"]}
      />

      {/* Media Library Picker - Icon Logo */}
      <MediaLibraryPicker
        open={showIconMediaLibrary}
        onClose={() => setShowIconMediaLibrary(false)}
        onSelect={(url) => {
          setFormData({ ...formData, iconLogo: url });
          setShowIconMediaLibrary(false);
          toast({ title: "Icon logo selected from library" });
        }}
        title="Select Icon Logo from Library"
        filterTypes={["image", "png", "jpg", "jpeg", "webp", "svg"]}
      />
    </motion.div>
  );
}
