"use client";

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Sparkles,
  Wand2,
  ChevronRight,
  ChevronLeft,
  Check,
  Users,
  Clock,
  Send,
  Eye,
  Calendar,
  Loader2,
  AlertCircle,
  Info,
  Copy,
  RefreshCw,
  Zap,
  Target,
  FileText,
  Settings,
  Smartphone,
  Tag,
  ChevronDown,
  Image,
  Upload,
  FolderOpen,
  Wand,
  UserCircle,
  X,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils/cn";
import { MediaLibraryPicker } from "@/components/shared/media-library-picker";
import { getEmailTemplates, getTemplatesByCategory, TEMPLATE_CATEGORIES } from "@/lib/marketing/templates";
import type { MarketingTemplate, TemplateCategory } from "@/lib/marketing/templates";
import { MERGE_TAGS, type MergeTagCategory } from "@/lib/email/merge-tags";
import { buildEmailHtml, type EmailBrandInfo } from "@/lib/marketing/templates/email-html";

// Types
type StepType = "details" | "template" | "editor" | "audience" | "schedule";

interface MarketingConfig {
  emailProvider: string;
  emailVerified: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  smsPhoneNumber: string | null;
  smsVerified: boolean;
}

// Tone options
const TONE_OPTIONS = [
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "friendly", label: "Friendly" },
  { value: "humorous", label: "Humorous" },
  { value: "inspirational", label: "Inspirational" },
  { value: "educational", label: "Educational" },
  { value: "authoritative", label: "Authoritative" },
  { value: "playful", label: "Playful" },
];

interface ContactList {
  id: string;
  name: string;
  totalCount: number;
  activeCount: number;
}

interface GeneratedContent {
  subject?: string;
  preheader?: string;
  content: string;
  htmlContent?: string;
  hasBrandKit?: boolean;
  brandName?: string;
  brandTone?: string;
}

const STEPS: { id: StepType; label: string; icon: React.ElementType }[] = [
  { id: "details", label: "Campaign Details", icon: FileText },
  { id: "template", label: "Template & AI", icon: Sparkles },
  { id: "editor", label: "Edit & Preview", icon: Eye },
  { id: "audience", label: "Audience", icon: Users },
  { id: "schedule", label: "Schedule & Send", icon: Send },
];

export default function CreateEmailCampaignPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-brand-500" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <CreateEmailCampaignContent />
    </Suspense>
  );
}

function CreateEmailCampaignContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Edit mode
  const editCampaignId = searchParams.get("edit");
  const isEditMode = !!editCampaignId;
  const [loadingCampaign, setLoadingCampaign] = useState(!!editCampaignId);

  // Marketing config state
  const [marketingConfig, setMarketingConfig] = useState<MarketingConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // State
  const [currentStep, setCurrentStep] = useState<StepType>("details");
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<MarketingTemplate | null>(null);
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);

  // Campaign type is always EMAIL
  const campaignType = "EMAIL";

  // Campaign data
  const [campaignName, setCampaignName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [selectedTone, setSelectedTone] = useState("professional");
  const [selectedContactList, setSelectedContactList] = useState<string>("");

  // Content fields (Email only)
  const [subject, setSubject] = useState("");
  const [preheader, setPreheader] = useState("");
  const [emailContent, setEmailContent] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [rawHtmlContent, setRawHtmlContent] = useState(""); // Before brand injection

  // Generation options
  const [topic, setTopic] = useState("");
  const [productName, setProductName] = useState("");
  const [discount, setDiscount] = useState("");
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");

  // Brand info (from AI generation response)
  const [brandInfo, setBrandInfo] = useState<{ hasBrandKit: boolean; brandName?: string; brandTone?: string } | null>(null);

  // Brand kit (fetched from API for email signature/footer)
  const [emailBrand, setEmailBrand] = useState<EmailBrandInfo | undefined>(undefined);

  // Brand display controls
  const [showBrandLogo, setShowBrandLogo] = useState(true);
  const [showBrandName, setShowBrandName] = useState(true);
  const [logoSize, setLogoSize] = useState<"normal" | "large" | "big">("normal");

  // CTA button controls
  const [ctaText, setCtaText] = useState("");
  const [ctaLink, setCtaLink] = useState("");

  // Coupon controls
  const [showCoupon, setShowCoupon] = useState(true);
  const [couponCode, setCouponCode] = useState("");

  // Image / attachment
  const [emailImageUrl, setEmailImageUrl] = useState("");
  const [imageSource, setImageSource] = useState<"upload" | "media" | "ai" | "contact_photo" | "">("");
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imageOverlayText, setImageOverlayText] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Build preview HTML with image injected after greeting paragraph
  const previewHtml = useMemo(() => {
    if (!htmlContent) return "";
    const imgUrl = emailImageUrl || (imageSource === "contact_photo" ? "" : "");
    if (!imgUrl && imageSource !== "contact_photo") return htmlContent;

    // Build image HTML block — sized naturally within email flow
    let imageBlock = "";
    if (imgUrl) {
      imageBlock = `<div style="text-align:center;margin:20px 0;padding:0;">
        <img src="${imgUrl}" alt="" style="max-width:100%;height:auto;display:block;margin:0 auto;border-radius:8px;" />
        ${imageOverlayText ? `<p style="margin:10px 0 0;font-size:15px;color:#374151;text-align:center;font-style:italic;">${imageOverlayText}</p>` : ""}
      </div>`;
    } else if (imageSource === "contact_photo") {
      // Inline SVG avatar placeholder — looks like a real contact photo
      const avatarSvg = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="280" height="280" viewBox="0 0 280 280"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#c084fc"/><stop offset="100%" stop-color="#7c3aed"/></linearGradient><clipPath id="circle"><circle cx="140" cy="140" r="140"/></clipPath></defs><rect width="280" height="280" rx="12" fill="url(#bg)"/><g clip-path="url(#circle)"><circle cx="140" cy="110" r="50" fill="#e9d5ff"/><ellipse cx="140" cy="260" rx="80" ry="80" fill="#e9d5ff"/></g><text x="140" y="275" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#f5f3ff" opacity="0.8">Contact Photo</text></svg>`)}`;
      imageBlock = `<div style="text-align:center;margin:20px 0;">
        <img src="${avatarSvg}" alt="Contact photo placeholder" style="width:180px;height:180px;display:block;margin:0 auto;border-radius:12px;" />
        <p style="margin:8px 0 0;font-size:12px;color:#7c3aed;">Each recipient's photo will appear here</p>
        ${imageOverlayText ? `<p style="margin:6px 0 0;font-size:15px;color:#374151;font-style:italic;">${imageOverlayText}</p>` : ""}
      </div>`;
    }

    if (!imageBlock) return htmlContent;

    // Insert after the first paragraph (greeting line like "Hi {{firstName}},")
    // Look for the first </p> after content starts
    const firstPClose = htmlContent.indexOf("</p>");
    if (firstPClose !== -1) {
      const insertAt = firstPClose + 4;
      return htmlContent.slice(0, insertAt) + imageBlock + htmlContent.slice(insertAt);
    }

    // Fallback: insert after <body> tag
    if (htmlContent.includes("<body")) {
      return htmlContent.replace(/(<body[^>]*>)/i, `$1${imageBlock}`);
    }
    return imageBlock + htmlContent;
  }, [htmlContent, emailImageUrl, imageSource, imageOverlayText]);

  // Dynamic credit costs
  const [creditCosts, setCreditCosts] = useState<Record<string, number>>({});

  // Template library
  const [templateMode, setTemplateMode] = useState<"templates" | "ai">("templates");
  const [templateCategory, setTemplateCategory] = useState<TemplateCategory | "all">("all");
  const emailTemplates = getEmailTemplates();
  const filteredTemplates = templateCategory === "all" ? emailTemplates : emailTemplates.filter(t => t.category === templateCategory);

  // Rebuild HTML with brand info injected into footer/header
  const rebuildHtmlWithBrand = useCallback((rawHtml: string, brand?: EmailBrandInfo, opts?: { showLogo?: boolean; showName?: boolean; logoSz?: "normal" | "large" | "big" }): string => {
    if (!brand?.name && !brand?.logo) return rawHtml;
    const brandColor = "#6366f1";
    const wantLogo = opts?.showLogo ?? true;
    const wantName = opts?.showName ?? true;
    const sz = opts?.logoSz ?? "normal";
    const logoMaxH = sz === "big" ? "120px" : sz === "large" ? "80px" : "48px";
    const logoMaxW = sz === "big" ? "400px" : sz === "large" ? "300px" : "200px";

    // Build brand header
    let headerBlock = "";
    if ((wantName && brand.name) || (wantLogo && brand.logo)) {
      const logoTag = (wantLogo && brand.logo)
        ? `<img src="${brand.logo}" alt="${brand.name || ""}" style="max-height:${logoMaxH};max-width:${logoMaxW};display:block;margin:0 auto 8px;" />`
        : "";
      const nameTag = (wantName && brand.name)
        ? `<p style="margin:0;font-size:18px;font-weight:700;color:${brandColor};text-align:center;">${brand.name}</p>`
        : "";
      headerBlock = `<tr><td style="padding:24px 40px 0;text-align:center;">${logoTag}${nameTag}</td></tr><tr><td style="padding:8px 40px 0;"><hr style="border:none;border-top:1px solid #e5e7eb;margin:0;"/></td></tr>`;
    }

    // Build brand footer parts
    const footerParts: string[] = [];
    if (brand.socials) {
      const links: string[] = [];
      const s = brand.socials;
      if (s.instagram) links.push(`<a href="https://instagram.com/${s.instagram}" style="color:${brandColor};text-decoration:none;">Instagram</a>`);
      if (s.twitter) links.push(`<a href="https://twitter.com/${s.twitter}" style="color:${brandColor};text-decoration:none;">Twitter</a>`);
      if (s.facebook) links.push(`<a href="https://facebook.com/${s.facebook}" style="color:${brandColor};text-decoration:none;">Facebook</a>`);
      if (s.linkedin) links.push(`<a href="https://linkedin.com/in/${s.linkedin}" style="color:${brandColor};text-decoration:none;">LinkedIn</a>`);
      if (s.youtube) links.push(`<a href="https://youtube.com/${s.youtube}" style="color:${brandColor};text-decoration:none;">YouTube</a>`);
      if (s.tiktok) links.push(`<a href="https://tiktok.com/@${s.tiktok}" style="color:${brandColor};text-decoration:none;">TikTok</a>`);
      if (links.length > 0) {
        footerParts.push(`<p style="margin:0 0 8px;font-size:12px;text-align:center;">${links.join(" &middot; ")}</p>`);
      }
    }
    const contactParts: string[] = [];
    if (brand.website) contactParts.push(`<a href="${brand.website}" style="color:${brandColor};text-decoration:none;">${brand.website.replace(/^https?:\/\//, "")}</a>`);
    if (brand.email) contactParts.push(brand.email);
    if (brand.phone) contactParts.push(brand.phone);
    if (contactParts.length > 0) {
      footerParts.push(`<p style="margin:0 0 8px;font-size:11px;color:#9ca3af;text-align:center;">${contactParts.join(" &middot; ")}</p>`);
    }
    if (brand.address) {
      footerParts.push(`<p style="margin:0 0 8px;font-size:11px;color:#9ca3af;text-align:center;">${brand.address}</p>`);
    }

    let result = rawHtml;
    if (headerBlock) {
      result = result.replace(
        /(<table[^>]*style="[^"]*background-color:\s*#ffffff[^"]*"[^>]*>)/i,
        `$1${headerBlock}`
      );
    }
    if (footerParts.length > 0) {
      const footerHtml = footerParts.join("\n              ");
      result = result.replace(
        /(<td[^>]*style="[^"]*background-color:\s*#f9fafb[^"]*"[^>]*>)\s*/i,
        `$1\n              ${footerHtml}\n              `
      );
    }
    return result;
  }, []);

  // Post-process HTML: apply CTA + coupon overrides
  const applyEmailOptions = useCallback((html: string, opts: { ctaText?: string; ctaLink?: string; showCoupon?: boolean; couponCode?: string }): string => {
    let result = html;
    if (opts.ctaText) {
      result = result.replace(
        /(<a\s+href="[^"]*"\s+style="[^"]*display:\s*inline-block[^"]*"[^>]*>)([\s\S]*?)(<\/a>)/i,
        `$1${opts.ctaText}$3`
      );
    }
    if (opts.ctaLink) {
      result = result.replace(
        /(<a\s+)href="[^"]*"(\s+style="[^"]*display:\s*inline-block[^"]*")/i,
        `$1href="${opts.ctaLink}"$2`
      );
    }
    if (opts.showCoupon === false) {
      result = result.replace(
        /<div[^>]*style="[^"]*border-left:[^"]*"[^>]*>[\s\S]*?\{\{couponCode\}\}[\s\S]*?<\/div>/gi,
        ""
      );
    }
    if (opts.couponCode && opts.showCoupon !== false) {
      result = result.replace(/\{\{couponCode\}\}/g, opts.couponCode);
    }
    return result;
  }, []);

  // Full HTML rebuild pipeline
  const buildFinalHtml = useCallback((raw: string) => {
    const withBrand = rebuildHtmlWithBrand(raw, emailBrand, { showLogo: showBrandLogo, showName: showBrandName, logoSz: logoSize });
    return applyEmailOptions(withBrand, { ctaText, ctaLink, showCoupon, couponCode });
  }, [rebuildHtmlWithBrand, applyEmailOptions, emailBrand, showBrandLogo, showBrandName, logoSize, ctaText, ctaLink, showCoupon, couponCode]);

  const handleTemplateSelect = (template: MarketingTemplate) => {
    setSelectedTemplate(template.id);
    setEditHtmlLoaded(false); // Re-enable HTML processing pipeline
    if (template.defaultEmail) {
      setSubject(template.defaultEmail.subject);
      setPreheader(template.defaultEmail.preheader || "");
      setEmailContent(template.defaultEmail.content);
      setRawHtmlContent(template.defaultEmail.htmlContent);
      // Extract CTA text from template HTML
      const ctaMatch = template.defaultEmail.htmlContent.match(/<a\s+href="[^"]*"\s+style="[^"]*display:\s*inline-block[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
      if (ctaMatch) setCtaText(ctaMatch[1]);
      // Check if template has coupon
      setShowCoupon(template.defaultEmail.htmlContent.includes("{{couponCode}}"));
      setCtaLink("");
      setHtmlContent(buildFinalHtml(template.defaultEmail.htmlContent));
    }
  };

  // Merge tags
  const [showMergeTags, setShowMergeTags] = useState(false);
  const emailContentRef = useRef<HTMLTextAreaElement>(null);

  const insertMergeTag = (tag: string) => {
    const el = emailContentRef.current;
    if (el) {
      const start = el.selectionStart ?? emailContent.length;
      const end = el.selectionEnd ?? emailContent.length;
      const newValue = emailContent.slice(0, start) + tag + emailContent.slice(end);
      setEmailContent(newValue);
      setTimeout(() => {
        el.focus();
        el.selectionStart = el.selectionEnd = start + tag.length;
      }, 0);
    } else {
      setEmailContent(emailContent + tag);
    }
    setShowMergeTags(false);
  };

  // Schedule
  const [scheduleType, setScheduleType] = useState<"now" | "later">("now");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");

  // Fetch marketing config
  const fetchMarketingConfig = useCallback(async () => {
    try {
      setLoadingConfig(true);
      const response = await fetch("/api/marketing-config");
      const data = await response.json();
      if (data.success) {
        setMarketingConfig(data.data.config);
      }
    } catch (error) {
      console.error("Failed to fetch marketing config:", error);
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  // Fetch contact lists
  const fetchContactLists = useCallback(async () => {
    try {
      setLoadingLists(true);
      const response = await fetch("/api/contact-lists");
      const data = await response.json();
      if (data.success) {
        setContactLists(data.data.lists);
      }
    } catch (error) {
      console.error("Failed to fetch contact lists:", error);
    } finally {
      setLoadingLists(false);
    }
  }, []);

  // Fetch brand kit for email signature/footer
  const fetchBrandKit = useCallback(async () => {
    try {
      const response = await fetch("/api/brand");
      const data = await response.json();
      if (data.success && data.data.brandKit) {
        const bk = data.data.brandKit;
        const colors = typeof bk.colors === "string" ? JSON.parse(bk.colors) : bk.colors;
        const handles = typeof bk.handles === "string" ? JSON.parse(bk.handles) : bk.handles;
        setEmailBrand({
          name: bk.name || undefined,
          logo: bk.logo || undefined,
          website: bk.website || undefined,
          email: bk.email || undefined,
          phone: bk.phone || undefined,
          address: bk.address || undefined,
          socials: handles && Object.values(handles).some(Boolean)
            ? handles
            : undefined,
        });
      }
    } catch (error) {
      console.error("Failed to fetch brand kit:", error);
    }
  }, []);

  useEffect(() => {
    fetchMarketingConfig();
    fetchContactLists();
    fetchBrandKit();
    // Fetch dynamic credit costs from admin-controlled pricing
    fetch("/api/credits/costs?keys=AI_POST,AI_MARKETING_IMAGE")
      .then((r) => r.json())
      .then((d) => { if (d.success) setCreditCosts(d.data.costs); })
      .catch(() => {});
  }, [fetchMarketingConfig, fetchContactLists, fetchBrandKit]);

  // Track whether we've loaded from DB to skip re-processing
  const [editHtmlLoaded, setEditHtmlLoaded] = useState(false);

  // Load existing campaign data when editing
  useEffect(() => {
    if (!editCampaignId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoadingCampaign(true);
        const res = await fetch(`/api/campaigns/${editCampaignId}`);
        const data = await res.json();
        if (cancelled) return;
        if (!data.success) {
          toast({ title: "Campaign not found", variant: "destructive" });
          router.push("/email-marketing");
          return;
        }
        const c = data.data.campaign;
        setCampaignName(c.name || "");
        setSubject(c.subject || "");
        setPreheader(c.preheaderText || "");
        setEmailContent(c.content || "");
        if (c.contentHtml) {
          // contentHtml from DB is already the final processed HTML
          // Set it directly without re-processing through buildFinalHtml
          setHtmlContent(c.contentHtml);
          setEditHtmlLoaded(true);
          // Extract CTA text from loaded HTML
          const ctaMatch = c.contentHtml.match(/<a\s+href="[^"]*"\s+style="[^"]*display:\s*inline-block[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
          if (ctaMatch) setCtaText(ctaMatch[1]);
          setShowCoupon(c.contentHtml.includes("{{couponCode}}"));
        }
        if (c.imageUrl) setEmailImageUrl(c.imageUrl);
        if (c.imageSource) setImageSource(c.imageSource);
        if (c.imageOverlayText) setImageOverlayText(c.imageOverlayText);
        if (c.contactList?.id) {
          setSelectedContactList(c.contactList.id);
        }
      } catch {
        if (!cancelled) {
          toast({ title: "Failed to load campaign", variant: "destructive" });
        }
      } finally {
        if (!cancelled) setLoadingCampaign(false);
      }
    })();
    return () => { cancelled = true; };
  }, [editCampaignId, router, toast]);

  // Re-apply all HTML transformations when any control changes
  // Skip if we just loaded pre-processed HTML from DB (editHtmlLoaded)
  useEffect(() => {
    if (editHtmlLoaded) return;
    if (rawHtmlContent) {
      setHtmlContent(buildFinalHtml(rawHtmlContent));
    }
  }, [rawHtmlContent, buildFinalHtml, editHtmlLoaded]);

  // Check if setup is required
  const isEmailConfigured = marketingConfig?.emailProvider !== "NONE" && marketingConfig?.emailVerified;

  // Get current step index
  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);

  // Navigation
  const canGoNext = () => {
    switch (currentStep) {
      case "details":
        return campaignName.trim().length > 0;
      case "template":
        return selectedTemplate.length > 0 || (subject.trim().length > 0 && emailContent.trim().length > 0);
      case "editor":
        return subject.trim().length > 0 && emailContent.trim().length > 0;
      case "audience":
        return selectedContactList.length > 0;
      default:
        return true;
    }
  };

  const goNext = () => {
    const idx = currentStepIndex;
    if (idx < STEPS.length - 1) {
      setCurrentStep(STEPS[idx + 1].id);
    }
  };

  const goBack = () => {
    const idx = currentStepIndex;
    if (idx > 0) {
      setCurrentStep(STEPS[idx - 1].id);
    }
  };

  // Advanced options toggle for AI generation
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // Generate AI content
  const handleGenerateContent = async () => {
    if (!customPrompt.trim() && !selectedTemplate) {
      toast({ title: "Please describe your email or select a template", variant: "destructive" });
      return;
    }

    setEditHtmlLoaded(false); // Re-enable HTML processing pipeline
    setIsGenerating(true);
    try {
      const response = await fetch("/api/campaigns/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "email",
          templateType: selectedTemplate || undefined,
          tone: selectedTone,
          topic,
          productName,
          discount,
          eventName,
          eventDate,
          customPrompt,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to generate content");
      }

      const result = data.data as GeneratedContent;

      setSubject(result.subject || "");
      setPreheader(result.preheader || "");
      setEmailContent(result.content);
      const generatedHtml = result.htmlContent || "";
      setRawHtmlContent(generatedHtml);
      if (generatedHtml) {
        const ctaMatch = generatedHtml.match(/<a\s+href="[^"]*"\s+style="[^"]*display:\s*inline-block[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
        if (ctaMatch) setCtaText(ctaMatch[1]);
        setShowCoupon(generatedHtml.includes("{{couponCode}}"));
      }
      setHtmlContent(generatedHtml ? buildFinalHtml(generatedHtml) : "");

      setBrandInfo({
        hasBrandKit: result.hasBrandKit || false,
        brandName: result.brandName,
        brandTone: result.brandTone,
      });

      const toneLabel = TONE_OPTIONS.find(t => t.value === selectedTone)?.label || selectedTone;
      const templateLabel = selectedTemplate
        ? emailTemplates.find(t => t.id === selectedTemplate)?.name || selectedTemplate
        : "custom prompt";
      toast({
        title: "Content generated successfully!",
        description: `Generated ${templateLabel} with ${toneLabel} tone${result.hasBrandKit ? ` for ${result.brandName}` : ""}`,
      });

      // Auto-advance to editor step
      setCurrentStep("editor");
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Failed to generate content",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Create campaign
  const handleCreateCampaign = async (action: "draft" | "send" | "schedule") => {
    if (!campaignName.trim()) {
      toast({ title: "Campaign name is required", variant: "destructive" });
      return;
    }

    if (!selectedContactList) {
      toast({ title: "Please select a contact list", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      let campaignId: string;

      if (isEditMode && editCampaignId) {
        // Update existing campaign
        const updateResponse = await fetch(`/api/campaigns/${editCampaignId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: campaignName,
            subject,
            preheaderText: preheader,
            content: emailContent,
            contentHtml: htmlContent,
            contactListId: selectedContactList,
            imageUrl: emailImageUrl || null,
            imageSource: imageSource || null,
            imageOverlayText: imageOverlayText || null,
          }),
        });

        const updateData = await updateResponse.json();
        if (!updateData.success) {
          throw new Error(updateData.error?.message || "Failed to update campaign");
        }
        campaignId = editCampaignId;
      } else {
        // Create new campaign
        const createResponse = await fetch("/api/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: campaignName,
            type: "EMAIL",
            subject,
            preheaderText: preheader,
            content: emailContent,
            contentHtml: htmlContent,
            contactListId: selectedContactList,
            status: "DRAFT",
            imageUrl: emailImageUrl || null,
            imageSource: imageSource || null,
            imageOverlayText: imageOverlayText || null,
          }),
        });

        const createData = await createResponse.json();
        if (!createData.success) {
          throw new Error(createData.error?.message || "Failed to create campaign");
        }
        campaignId = createData.data.campaign.id;
      }

      // If send or schedule, call the send endpoint
      if (action === "send" || action === "schedule") {
        let scheduledAt: string | undefined;
        if (action === "schedule" && scheduledDate && scheduledTime) {
          scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
        }

        const sendResponse = await fetch(`/api/campaigns/${campaignId}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: action === "schedule" ? "schedule" : "send",
            scheduledAt,
          }),
        });

        const sendData = await sendResponse.json();

        if (!sendData.success) {
          throw new Error(sendData.error?.message || "Failed to send campaign");
        }
      }

      toast({
        title: action === "draft"
          ? isEditMode ? "Campaign updated" : "Campaign saved as draft"
          : action === "send"
          ? "Campaign sent successfully!"
          : "Campaign scheduled successfully!",
      });

      router.push("/email-marketing");
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Failed to create campaign",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Get selected contact list details
  const selectedList = contactLists.find(l => l.id === selectedContactList);

  // Loading state
  if (loadingConfig || loadingCampaign) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-brand-500" />
          <p className="text-muted-foreground">Loading configuration...</p>
        </div>
      </div>
    );
  }

  // Setup Required Screen
  if (!isEmailConfigured) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-lg w-full"
        >
          <Card className="border-2 border-dashed">
            <CardContent className="pt-8 pb-8 text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-orange-500/10 flex items-center justify-center">
                <Mail className="w-8 h-8 text-orange-500" />
              </div>

              <h2 className="text-2xl font-bold mb-2">Email Setup Required</h2>

              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                You need to configure an email provider before creating email campaigns. Set up SMTP, SendGrid, Mailgun, or another provider.
              </p>

              <div className="space-y-3">
                <Button size="lg" asChild className="w-full max-w-xs">
                  <Link href="/settings/marketing">
                    <Settings className="w-4 h-4 mr-2" />
                    Configure Email Settings
                  </Link>
                </Button>

                <div className="flex items-center justify-center gap-4">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/email-marketing">
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back to Email Marketing
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="mt-8 p-4 rounded-lg bg-muted/50 text-left">
                <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-500" />
                  Supported Email Providers
                </h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>SMTP (Custom server)</li>
                  <li>SendGrid</li>
                  <li>Mailgun</li>
                  <li>Amazon SES</li>
                  <li>Resend</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 flex flex-col space-y-6 pb-8"
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/email-marketing">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{isEditMode ? "Edit Email Campaign" : "Create Email Campaign"}</h1>
          <p className="text-muted-foreground">
            {isEditMode ? "Update and send your email campaign" : "Build and send your email marketing campaign"}
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <Card>
        <CardContent className="px-3 py-2">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const isActive = step.id === currentStep;
              const isCompleted = index < currentStepIndex;
              const StepIcon = step.icon;

              return (
                <div key={step.id} className="flex items-center">
                  <button
                    onClick={() => index <= currentStepIndex && setCurrentStep(step.id)}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-colors text-sm ${
                      isActive
                        ? "bg-brand-500/10 text-brand-500"
                        : isCompleted
                        ? "text-green-600 hover:bg-green-500/10"
                        : "text-muted-foreground"
                    }`}
                    disabled={index > currentStepIndex}
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                        isActive
                          ? "bg-brand-500 text-white"
                          : isCompleted
                          ? "bg-green-500 text-white"
                          : "bg-muted"
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <StepIcon className="w-3 h-3" />
                      )}
                    </div>
                    <span className="hidden md:inline font-medium text-xs">{step.label}</span>
                  </button>
                  {index < STEPS.length - 1 && (
                    <ChevronRight className="w-4 h-4 mx-1 text-muted-foreground/50" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      <div className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {/* Step 1: Campaign Details */}
            {currentStep === "details" && (
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Campaign Details</CardTitle>
                  <CardDescription>
                    Set the basic information for your email campaign
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Campaign Name */}
                  <div className="space-y-2">
                    <Label htmlFor="name">Campaign Name *</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Summer Sale Announcement"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      className="text-lg"
                    />
                    <p className="text-xs text-muted-foreground">
                      This name is for internal use only
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Template & AI */}
            {currentStep === "template" && (
              <div className="space-y-6">
                  {/* Mode Toggle */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant={templateMode === "templates" ? "default" : "outline"}
                      onClick={() => setTemplateMode("templates")}
                      className={cn(
                        "flex-1",
                        templateMode === "templates" && "bg-brand-500 hover:bg-brand-600"
                      )}
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Templates
                      {selectedTemplate && templateMode !== "templates" && (
                        <Badge variant="secondary" className="ml-2 text-[10px]">1 selected</Badge>
                      )}
                    </Button>
                    <Button
                      variant={templateMode === "ai" ? "default" : "outline"}
                      onClick={() => setTemplateMode("ai")}
                      className={cn(
                        "flex-1",
                        templateMode === "ai" && "bg-gradient-to-r from-brand-500 to-purple-500 hover:from-brand-600 hover:to-purple-600"
                      )}
                    >
                      <Wand2 className="w-4 h-4 mr-2" />
                      AI Generation
                    </Button>
                  </div>

                  {/* Template Selection */}
                  {templateMode === "templates" && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-brand-500" />
                          Choose a Template
                        </CardTitle>
                        <CardDescription>
                          Select a template to pre-fill your email content, or switch to AI Generation to create custom content
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex gap-1 flex-wrap mb-3">
                          <button
                            onClick={() => setTemplateCategory("all")}
                            className={cn(
                              "px-3 py-1 text-xs rounded-full",
                              templateCategory === "all" ? "bg-brand-500 text-white" : "bg-muted"
                            )}
                          >
                            All
                          </button>
                          {(Object.entries(TEMPLATE_CATEGORIES) as [TemplateCategory, { label: string; icon: string }][]).map(([key, cat]) => (
                            <button
                              key={key}
                              onClick={() => setTemplateCategory(key)}
                              className={cn(
                                "px-3 py-1 text-xs rounded-full",
                                templateCategory === key ? "bg-brand-500 text-white" : "bg-muted"
                              )}
                            >
                              {cat.icon} {cat.label}
                            </button>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 max-h-[400px] overflow-y-auto">
                          {filteredTemplates.map((template) => (
                            <div
                              key={template.id}
                              className={`relative p-3 rounded-lg border text-left transition-all cursor-pointer group ${
                                selectedTemplate === template.id
                                  ? "border-brand-500 bg-brand-500/10"
                                  : "border-border hover:border-brand-500/50"
                              }`}
                              onClick={() => handleTemplateSelect(template)}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg">{template.icon}</span>
                                <span className="font-medium text-sm truncate flex-1">
                                  {template.name}
                                </span>
                                {template.defaultEmail?.htmlContent && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPreviewTemplate(template);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
                                    title="Preview template"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                                  </button>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {template.description}
                              </p>
                              {selectedTemplate === template.id && (
                                <div className="absolute top-1.5 right-1.5">
                                  <div className="w-4 h-4 rounded-full bg-brand-500 flex items-center justify-center">
                                    <Check className="w-2.5 h-2.5 text-white" />
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* AI Generation Options */}
                  {templateMode === "ai" && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Wand2 className="w-5 h-5 text-purple-500" />
                          AI Content Generator
                        </CardTitle>
                        <CardDescription>
                          Describe the email you want to create and AI will generate it for you
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Primary: Prompt input */}
                        <div className="space-y-2">
                          <Label>Describe your email *</Label>
                          <Textarea
                            placeholder="e.g., Write a welcome email for new subscribers that introduces our brand, highlights key features, and offers a 10% discount on their first purchase..."
                            value={customPrompt}
                            onChange={(e) => setCustomPrompt(e.target.value)}
                            rows={4}
                            className="text-sm"
                          />
                          <p className="text-xs text-muted-foreground">
                            Be specific about the purpose, tone, and any details you want included
                          </p>
                        </div>

                        {/* Optional: Template reference */}
                        {selectedTemplate ? (
                          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-brand-500/5 border border-brand-500/20">
                            <Sparkles className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                            <span className="text-xs flex-1">
                              Using <strong>{emailTemplates.find(t => t.id === selectedTemplate)?.name}</strong> as reference template
                            </span>
                            <button
                              onClick={() => setSelectedTemplate("")}
                              className="text-muted-foreground hover:text-foreground text-xs px-1.5"
                            >
                              &times;
                            </button>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Optionally <button onClick={() => setTemplateMode("templates")} className="underline text-brand-500 font-medium">pick a template</button> as a reference for structure and styling
                          </p>
                        )}

                        {/* Collapsible: Advanced Options */}
                        <button
                          type="button"
                          onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
                        >
                          <ChevronDown className={cn("w-4 h-4 transition-transform", showAdvancedOptions && "rotate-180")} />
                          <span>Advanced Options</span>
                          {(topic || productName || discount || eventName || selectedTone !== "professional") && (
                            <Badge variant="secondary" className="text-[10px] ml-auto">customized</Badge>
                          )}
                        </button>

                        {showAdvancedOptions && (
                          <div className="space-y-4 p-4 rounded-lg bg-muted/30 border">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-xs">Tone</Label>
                                <Select value={selectedTone} onValueChange={setSelectedTone}>
                                  <SelectTrigger className="h-9">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {TONE_OPTIONS.map((tone) => (
                                      <SelectItem key={tone.value} value={tone.value}>
                                        {tone.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">Topic</Label>
                                <Input
                                  placeholder="e.g., New feature release"
                                  value={topic}
                                  onChange={(e) => setTopic(e.target.value)}
                                  className="h-9"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-xs">Product/Service</Label>
                                <Input
                                  placeholder="e.g., Premium Plan"
                                  value={productName}
                                  onChange={(e) => setProductName(e.target.value)}
                                  className="h-9"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">Discount/Offer</Label>
                                <Input
                                  placeholder="e.g., 20% off"
                                  value={discount}
                                  onChange={(e) => setDiscount(e.target.value)}
                                  className="h-9"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-xs">Event Name</Label>
                                <Input
                                  placeholder="e.g., Product Launch Webinar"
                                  value={eventName}
                                  onChange={(e) => setEventName(e.target.value)}
                                  className="h-9"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">Event Date</Label>
                                <Input
                                  type="date"
                                  value={eventDate}
                                  onChange={(e) => setEventDate(e.target.value)}
                                  className="h-9"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        <Button
                          onClick={handleGenerateContent}
                          disabled={isGenerating || (!customPrompt.trim() && !selectedTemplate)}
                          className="w-full bg-gradient-to-r from-brand-500 to-purple-500 hover:from-brand-600 hover:to-purple-600"
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 mr-2" />
                              Generate with AI
                            </>
                          )}
                        </Button>

                        <p className="text-xs text-center text-muted-foreground">
                          Uses {creditCosts.AI_POST || "..."} credits per generation
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {brandInfo?.hasBrandKit && (
                    <div className="flex items-center gap-2 text-xs text-green-600 bg-green-500/10 px-3 py-2 rounded-lg">
                      <Check className="w-3.5 h-3.5" />
                      <span>Brand detected: <strong>{brandInfo.brandName}</strong>{brandInfo.brandTone ? ` (${brandInfo.brandTone} tone)` : ""}</span>
                    </div>
                  )}
              </div>
            )}

            {/* Step 3: Edit & Preview */}
            {currentStep === "editor" && (
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Left: Editor */}
                <div className="space-y-4">
                  {/* Missing HTML notice for old drafts */}
                  {isEditMode && !htmlContent && emailContent && (
                    <Card className="border-amber-500/30 bg-amber-500/5">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-amber-700">HTML formatting not available</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              This draft was saved without HTML content. Select a template or generate with AI to restore the formatted email preview.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Brand Identity Controls */}
                  {emailBrand && (emailBrand.name || emailBrand.logo) && (
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-semibold">Brand Identity</p>
                          <Badge variant="secondary" className="text-[10px]">
                            {emailBrand.name || "Brand"}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-4">
                          {emailBrand.logo && (
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={showBrandLogo}
                                onChange={(e) => setShowBrandLogo(e.target.checked)}
                                className="rounded border-gray-300"
                              />
                              <span className="text-xs">Show Logo</span>
                            </label>
                          )}
                          {emailBrand.name && (
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={showBrandName}
                                onChange={(e) => setShowBrandName(e.target.checked)}
                                className="rounded border-gray-300"
                              />
                              <span className="text-xs">Show Name</span>
                            </label>
                          )}
                          {emailBrand.logo && showBrandLogo && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-muted-foreground">Logo Size:</span>
                              {(["normal", "large", "big"] as const).map((sz) => (
                                <button
                                  key={sz}
                                  onClick={() => setLogoSize(sz)}
                                  className={cn(
                                    "px-2 py-0.5 text-[10px] rounded-full font-medium transition-colors capitalize",
                                    logoSize === sz
                                      ? "bg-brand-500 text-white"
                                      : "bg-muted text-muted-foreground hover:bg-muted-foreground/20"
                                  )}
                                >
                                  {sz}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* CTA & Coupon Controls */}
                  {rawHtmlContent && (
                    <Card>
                      <CardContent className="p-4 space-y-3">
                        <p className="text-sm font-semibold">Email Options</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Button Text</Label>
                            <Input
                              placeholder="e.g., Shop Now"
                              value={ctaText}
                              onChange={(e) => setCtaText(e.target.value)}
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Button Link</Label>
                            <Input
                              placeholder="https://yoursite.com/shop"
                              value={ctaLink}
                              onChange={(e) => setCtaLink(e.target.value)}
                              className="h-8 text-xs"
                            />
                          </div>
                        </div>
                        {rawHtmlContent.includes("{{couponCode}}") && (
                          <div className="space-y-2 pt-1">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={showCoupon}
                                onChange={(e) => setShowCoupon(e.target.checked)}
                                className="rounded border-gray-300"
                              />
                              <span className="text-xs">Include Coupon Section</span>
                            </label>
                            {showCoupon && (
                              <div className="space-y-1 pl-5">
                                <Label className="text-xs">Coupon Code</Label>
                                <Input
                                  placeholder="e.g., SAVE20"
                                  value={couponCode}
                                  onChange={(e) => setCouponCode(e.target.value)}
                                  className="h-8 text-xs"
                                />
                                <p className="text-[10px] text-muted-foreground">Leave empty to use {"{{couponCode}}"} merge tag for per-contact codes</p>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Content Editor */}
                  <Card className="flex flex-col">
                    <CardHeader>
                      <CardTitle>Content Editor</CardTitle>
                      {brandInfo && (
                        brandInfo.hasBrandKit ? (
                          <div className="flex items-center gap-2 text-xs text-green-600 bg-green-500/10 px-3 py-1.5 rounded-lg">
                            <Check className="w-3.5 h-3.5" />
                            <span>Powered by your brand: <strong>{brandInfo.brandName}</strong>{brandInfo.brandTone ? ` (${brandInfo.brandTone} tone)` : ""}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-500/10 px-3 py-1.5 rounded-lg">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Set up your <a href="/settings" className="underline font-medium">brand identity</a> for personalized AI content</span>
                          </div>
                        )
                      )}
                    </CardHeader>
                    <CardContent className="flex-1 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="subject">Subject Line *</Label>
                        <Input
                          id="subject"
                          placeholder="Enter email subject..."
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          {subject.length}/60 characters recommended
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="preheader">Preheader Text</Label>
                        <Input
                          id="preheader"
                          placeholder="Preview text shown in inbox..."
                          value={preheader}
                          onChange={(e) => setPreheader(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          {preheader.length}/100 characters recommended
                        </p>
                      </div>

                      <div className="space-y-2 flex-1">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="content">Email Body *</Label>
                          <div className="relative">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setShowMergeTags(!showMergeTags)}
                            >
                              <Tag className="w-3 h-3 mr-1" />
                              Merge Tags
                              <ChevronDown className="w-3 h-3 ml-1" />
                            </Button>
                            {showMergeTags && (
                              <div className="absolute right-0 top-8 z-50 bg-popover border rounded-lg shadow-lg p-1 min-w-[220px] max-h-[320px] overflow-y-auto">
                                {(["Contact", "Dates", "Business", "Links"] as MergeTagCategory[]).map(category => {
                                  const categoryTags = MERGE_TAGS.filter(t => t.category === category);
                                  if (categoryTags.length === 0) return null;
                                  return (
                                    <div key={category}>
                                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase">{category}</div>
                                      {categoryTags.map(tag => (
                                        <button
                                          key={tag.tag}
                                          type="button"
                                          onClick={() => insertMergeTag(tag.tag)}
                                          className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted rounded"
                                        >
                                          {tag.label} <span className="text-muted-foreground">{tag.tag}</span>
                                        </button>
                                      ))}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                        <Textarea
                          ref={emailContentRef}
                          id="content"
                          placeholder="Enter your email content... Use merge tags like {{firstName}} to personalize."
                          value={emailContent}
                          onChange={(e) => setEmailContent(e.target.value)}
                          className="min-h-[200px] font-mono text-sm"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Image / Inline Image */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Image className="w-4 h-4 text-brand-500" />
                        Email Image
                        <Badge variant="secondary" className="text-[10px]">Optional</Badge>
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Embed an image in your email for visual impact
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Image source tabs */}
                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          { id: "upload" as const, label: "Upload", icon: Upload },
                          { id: "media" as const, label: "Library", icon: FolderOpen },
                          { id: "ai" as const, label: "AI Gen", icon: Wand },
                          { id: "contact_photo" as const, label: "Contact", icon: UserCircle },
                        ].map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => {
                              if (tab.id === "contact_photo") {
                                setImageSource("contact_photo");
                                setEmailImageUrl("");
                              } else if (tab.id === "media") {
                                setShowMediaLibrary(true);
                              } else {
                                setImageSource(tab.id);
                              }
                            }}
                            className={cn(
                              "flex flex-col items-center gap-1 p-2 rounded-lg border text-[10px] transition-all",
                              imageSource === tab.id
                                ? "border-brand-500 bg-brand-500/10 text-brand-500"
                                : "border-border hover:border-brand-500/50 text-muted-foreground"
                            )}
                          >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      {/* Upload area */}
                      {imageSource === "upload" && !emailImageUrl && (
                        <label className="flex flex-col items-center gap-2 p-6 border-2 border-dashed rounded-lg cursor-pointer hover:border-brand-500/50 transition-colors">
                          {isUploadingImage ? (
                            <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
                          ) : (
                            <Upload className="w-6 h-6 text-muted-foreground" />
                          )}
                          <span className="text-xs text-muted-foreground">
                            {isUploadingImage ? "Uploading..." : "Click to upload (PNG, JPG, max 5MB)"}
                          </span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (file.size > 5 * 1024 * 1024) {
                                toast({ title: "Image must be under 5MB", variant: "destructive" });
                                return;
                              }
                              setIsUploadingImage(true);
                              try {
                                const formData = new FormData();
                                formData.append("file", file);
                                const res = await fetch("/api/media", { method: "POST", body: formData });
                                const data = await res.json();
                                if (data.success && data.data?.file?.url) {
                                  setEmailImageUrl(data.data.file.url);
                                  setImageSource("upload");
                                }
                              } catch {
                                toast({ title: "Upload failed", variant: "destructive" });
                              } finally {
                                setIsUploadingImage(false);
                              }
                            }}
                          />
                        </label>
                      )}

                      {/* AI Generate */}
                      {imageSource === "ai" && !emailImageUrl && (
                        <div className="space-y-2">
                          <Textarea
                            placeholder="Describe the image you want to generate..."
                            value={imagePrompt}
                            onChange={(e) => setImagePrompt(e.target.value)}
                            rows={2}
                            className="text-xs"
                          />
                          <Button
                            size="sm"
                            className="w-full"
                            disabled={isGeneratingImage || !imagePrompt.trim()}
                            onClick={async () => {
                              setIsGeneratingImage(true);
                              try {
                                const res = await fetch("/api/media/generate-image", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ prompt: imagePrompt }),
                                });
                                const data = await res.json();
                                if (data.success && data.data?.url) {
                                  setEmailImageUrl(data.data.url);
                                  setImageSource("ai");
                                  toast({ title: "Image generated successfully" });
                                } else {
                                  throw new Error(data.error || "Generation failed");
                                }
                              } catch (err) {
                                toast({ title: err instanceof Error ? err.message : "Generation failed", variant: "destructive" });
                              } finally {
                                setIsGeneratingImage(false);
                              }
                            }}
                          >
                            {isGeneratingImage ? (
                              <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Generating...</>
                            ) : (
                              <><Sparkles className="w-3 h-3 mr-1" /> Generate ({creditCosts.AI_MARKETING_IMAGE || "..."} credits)</>
                            )}
                          </Button>
                        </div>
                      )}

                      {/* Contact Photo mode */}
                      {imageSource === "contact_photo" && (
                        <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
                          <div className="flex items-center gap-2 mb-2">
                            <UserCircle className="w-4 h-4 text-purple-500" />
                            <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
                              Contact Photo Mode
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            Each recipient&apos;s photo will be embedded inline in their email.
                            Contacts without a photo will receive the email without an image.
                          </p>
                        </div>
                      )}

                      {/* Image preview */}
                      {emailImageUrl && (
                        <div className="relative group">
                          <img
                            src={emailImageUrl}
                            alt="Email image"
                            className="w-full h-40 object-cover rounded-lg border"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setEmailImageUrl("");
                              setImageSource("");
                            }}
                            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3 text-white" />
                          </button>
                        </div>
                      )}

                      {/* Text overlay (for contact photos or any image) */}
                      {(imageSource === "contact_photo" || emailImageUrl) && (
                        <div className="space-y-1.5">
                          <Label className="text-xs flex items-center gap-1.5">
                            <Type className="w-3 h-3" />
                            Text Overlay
                            <span className="text-muted-foreground">(optional)</span>
                          </Label>
                          <Input
                            placeholder='e.g., "Happy Birthday, {{firstName}}!"'
                            value={imageOverlayText}
                            onChange={(e) => setImageOverlayText(e.target.value)}
                            className="h-8 text-xs"
                          />
                          <p className="text-[10px] text-muted-foreground">
                            Merge tags like {"{{firstName}}"} are supported. Text is composited onto the image.
                          </p>
                        </div>
                      )}

                      {/* Info */}
                      {imageSource === "contact_photo" && (
                        <div className="flex items-center gap-2 text-[10px] p-2 rounded-lg bg-amber-500/10 text-amber-600">
                          <Info className="w-3.5 h-3.5 shrink-0" />
                          Personalized per recipient — each contact gets their own photo embedded
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Right: Live Preview */}
                <div className="space-y-4 lg:sticky lg:top-6 self-start">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Eye className="w-5 h-5 text-brand-500" />
                        Live Preview
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Tabs defaultValue="desktop">
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="desktop">Desktop</TabsTrigger>
                          <TabsTrigger value="mobile">
                            <Smartphone className="w-3.5 h-3.5 mr-1.5" />
                            Mobile
                          </TabsTrigger>
                        </TabsList>
                        <TabsContent value="desktop" className="mt-4">
                          <div className="border rounded-lg overflow-hidden">
                            <div className="bg-muted p-3 border-b">
                              <p className="text-sm font-medium">{subject || "Subject line"}</p>
                              <p className="text-xs text-muted-foreground">{preheader || "Preheader text"}</p>
                            </div>
                            {htmlContent ? (
                              <iframe
                                srcDoc={previewHtml}
                                className="w-full h-[500px] border-0"
                                title="Email preview"
                              />
                            ) : (
                              <div className="p-6 bg-background h-[500px] flex items-center justify-center text-muted-foreground text-sm">
                                Your email content will appear here...
                              </div>
                            )}
                          </div>
                        </TabsContent>
                        <TabsContent value="mobile" className="mt-4">
                          <div className="flex justify-center">
                            <div className="w-[375px] border-[3px] border-foreground/20 rounded-[2.5rem] overflow-hidden shadow-lg bg-background">
                              {/* Phone notch */}
                              <div className="bg-foreground/10 h-7 flex items-center justify-center">
                                <div className="w-20 h-4 bg-foreground/20 rounded-full" />
                              </div>
                              {/* Email header */}
                              <div className="bg-muted px-3 py-2 border-b">
                                <p className="text-xs font-medium truncate">{subject || "Subject line"}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{preheader || "Preheader text"}</p>
                              </div>
                              {/* Email body */}
                              {htmlContent ? (
                                <iframe
                                  srcDoc={`<meta name="viewport" content="width=375,initial-scale=1"><style>body{margin:0;overflow-x:hidden}table{max-width:100%!important;width:100%!important}td{word-break:break-word!important}img{max-width:100%!important;height:auto!important}h1{font-size:20px!important}p{font-size:14px!important}</style>${previewHtml}`}
                                  className="w-full h-[480px] border-0 bg-white"
                                  title="Email mobile preview"
                                />
                              ) : (
                                <div className="bg-background p-3 h-[480px] flex items-center justify-center text-muted-foreground text-xs">
                                  Your email content will appear here...
                                </div>
                              )}
                              {/* Phone bottom bar */}
                              <div className="bg-foreground/10 h-5 flex items-center justify-center">
                                <div className="w-28 h-1 bg-foreground/30 rounded-full" />
                              </div>
                            </div>
                          </div>
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>

                  {/* Image attachment indicator */}
                  {(emailImageUrl || imageSource === "contact_photo") && (
                    <Card className="border-brand-500/20 bg-brand-500/5">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          {emailImageUrl ? (
                            <img src={emailImageUrl} alt="" className="w-12 h-12 rounded object-cover border" />
                          ) : (
                            <div className="w-12 h-12 rounded bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                              <UserCircle className="w-6 h-6 text-purple-500" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium">
                              {imageSource === "contact_photo" ? "Contact Photo (per recipient)" : "Image attached"}
                            </p>
                            {imageOverlayText && (
                              <p className="text-[10px] text-muted-foreground truncate">
                                Overlay: {imageOverlayText}
                              </p>
                            )}
                          </div>
                          <Badge variant="secondary" className="text-[9px] shrink-0">
                            <Image className="w-3 h-3 mr-1" />
                            Inline
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Copy HTML Button */}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      navigator.clipboard.writeText(htmlContent || emailContent);
                      toast({ title: "Copied to clipboard" });
                    }}
                    disabled={!htmlContent && !emailContent}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy HTML
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4: Audience */}
            {currentStep === "audience" && (
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-500" />
                    Select Your Audience
                  </CardTitle>
                  <CardDescription>
                    Choose which contact list to send this campaign to
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {loadingLists ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-20 w-full" />
                      ))}
                    </div>
                  ) : contactLists.length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                      <p className="font-medium text-lg">No contact lists yet</p>
                      <p className="text-sm text-muted-foreground mb-6">
                        Create a contact list to start sending campaigns
                      </p>
                      <Button asChild size="lg">
                        <Link href="/contacts?tab=lists">Create Contact List</Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {contactLists.map((list) => (
                        <button
                          key={list.id}
                          onClick={() => setSelectedContactList(list.id)}
                          className={`p-4 rounded-xl border-2 text-left transition-all ${
                            selectedContactList === list.id
                              ? "border-brand-500 bg-brand-500/10"
                              : "border-border hover:border-brand-500/50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                  selectedContactList === list.id
                                    ? "bg-brand-500/20"
                                    : "bg-muted"
                                }`}
                              >
                                <Users
                                  className={`w-5 h-5 ${
                                    selectedContactList === list.id
                                      ? "text-brand-500"
                                      : "text-muted-foreground"
                                  }`}
                                />
                              </div>
                              <div>
                                <p className="font-semibold">{list.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {list.activeCount.toLocaleString()} active contacts
                                </p>
                              </div>
                            </div>
                            <div
                              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                selectedContactList === list.id
                                  ? "border-brand-500 bg-brand-500"
                                  : "border-muted-foreground/30"
                              }`}
                            >
                              {selectedContactList === list.id && (
                                <Check className="w-4 h-4 text-white" />
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {selectedList && (
                    <Card className="bg-brand-500/5 border-brand-500/20">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">
                              This campaign will be sent to
                            </p>
                            <p className="text-lg font-semibold text-brand-500">
                              {selectedList.activeCount.toLocaleString()} contacts
                            </p>
                          </div>
                          <Target className="w-8 h-8 text-brand-500/50" />
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Step 5: Schedule & Send */}
            {currentStep === "schedule" && (
              <div className="grid lg:grid-cols-2 gap-6 h-full">
                {/* Left: Schedule Options */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-purple-500" />
                      When to Send
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { id: "now" as const, label: "Send Now", icon: Zap, desc: "Send immediately" },
                        { id: "later" as const, label: "Schedule", icon: Clock, desc: "Pick a date & time" },
                      ].map((option) => (
                        <button
                          key={option.id}
                          onClick={() => setScheduleType(option.id)}
                          className={`p-4 rounded-xl border-2 transition-all ${
                            scheduleType === option.id
                              ? "border-brand-500 bg-brand-500/10"
                              : "border-border hover:border-brand-500/50"
                          }`}
                        >
                          <option.icon
                            className={`w-8 h-8 mx-auto mb-2 ${
                              scheduleType === option.id
                                ? "text-brand-500"
                                : "text-muted-foreground"
                            }`}
                          />
                          <p className="font-semibold">{option.label}</p>
                          <p className="text-xs text-muted-foreground">{option.desc}</p>
                        </button>
                      ))}
                    </div>

                    {scheduleType === "later" && (
                      <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                        <div className="space-y-2">
                          <Label>Date</Label>
                          <Input
                            type="date"
                            value={scheduledDate}
                            onChange={(e) => setScheduledDate(e.target.value)}
                            min={new Date().toISOString().split("T")[0]}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Time</Label>
                          <Input
                            type="time"
                            value={scheduledTime}
                            onChange={(e) => setScheduledTime(e.target.value)}
                          />
                        </div>
                        {scheduledDate && scheduledTime && (
                          <div className="text-sm text-muted-foreground">
                            Campaign will be sent on{" "}
                            <span className="font-medium">
                              {new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Right: Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle>Campaign Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Campaign Name</span>
                        <span className="font-medium">{campaignName}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Type</span>
                        <Badge variant="secondary">
                          <Mail className="w-3 h-3 mr-1" /> Email
                        </Badge>
                      </div>
                      {subject && (
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-muted-foreground">Subject</span>
                          <span className="font-medium truncate max-w-[200px]">{subject}</span>
                        </div>
                      )}
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Audience</span>
                        <span className="font-medium">
                          {selectedList?.activeCount.toLocaleString() || 0} contacts
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Delivery</span>
                        <span className="font-medium">
                          {scheduleType === "now" ? "Send immediately" : "Scheduled"}
                        </span>
                      </div>
                      {(emailImageUrl || imageSource === "contact_photo") && (
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-muted-foreground">Image</span>
                          <Badge variant="secondary" className="text-[10px]">
                            <Image className="w-3 h-3 mr-1" />
                            {imageSource === "contact_photo" ? "Contact Photo" : imageSource === "ai" ? "AI Generated" : imageSource === "media" ? "Media Library" : "Uploaded"}
                          </Badge>
                        </div>
                      )}
                    </div>

                    <div className="pt-4 space-y-3">
                      <Button
                        className="w-full"
                        size="lg"
                        onClick={() => handleCreateCampaign(scheduleType === "now" ? "send" : "schedule")}
                        disabled={
                          isLoading ||
                          !selectedContactList ||
                          (scheduleType === "later" && (!scheduledDate || !scheduledTime))
                        }
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : scheduleType === "now" ? (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            Send Campaign
                          </>
                        ) : (
                          <>
                            <Clock className="w-4 h-4 mr-2" />
                            Schedule Campaign
                          </>
                        )}
                      </Button>

                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => handleCreateCampaign("draft")}
                        disabled={isLoading}
                      >
                        Save as Draft
                      </Button>

                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-card px-2 text-muted-foreground">or</span>
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        className="w-full border-dashed"
                        asChild
                      >
                        <Link href="/email-marketing/automations/create">
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Create as Automation Instead
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button
          variant="outline"
          onClick={goBack}
          disabled={currentStepIndex === 0}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        {currentStepIndex < STEPS.length - 1 && (
          <Button onClick={goNext} disabled={!canGoNext()}>
            Continue
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>

      {/* Template Preview Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={(open) => !open && setPreviewTemplate(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-lg">{previewTemplate?.icon}</span>
              {previewTemplate?.name}
            </DialogTitle>
          </DialogHeader>
          {previewTemplate?.defaultEmail && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Subject: </span>
                  <span className="font-medium">{previewTemplate.defaultEmail.subject}</span>
                </div>
                {previewTemplate.defaultEmail.preheader && (
                  <div>
                    <span className="text-muted-foreground">Preheader: </span>
                    <span>{previewTemplate.defaultEmail.preheader}</span>
                  </div>
                )}
              </div>
              <Tabs defaultValue="desktop">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="desktop">Desktop</TabsTrigger>
                  <TabsTrigger value="mobile">
                    <Smartphone className="w-3.5 h-3.5 mr-1.5" />
                    Mobile
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="desktop" className="mt-4">
                  <div className="border rounded-lg overflow-hidden">
                    <iframe
                      srcDoc={previewTemplate.defaultEmail.htmlContent}
                      className="w-full h-[500px] border-0"
                      title="Template preview"
                    />
                  </div>
                </TabsContent>
                <TabsContent value="mobile" className="mt-4">
                  <div className="flex justify-center">
                    <div className="w-[375px] border-[3px] border-foreground/20 rounded-[2.5rem] overflow-hidden shadow-lg bg-background">
                      <div className="bg-foreground/10 h-7 flex items-center justify-center">
                        <div className="w-20 h-4 bg-foreground/20 rounded-full" />
                      </div>
                      <iframe
                        srcDoc={`<meta name="viewport" content="width=375,initial-scale=1"><style>body{margin:0;overflow-x:hidden}table{max-width:100%!important;width:100%!important}td{word-break:break-word!important}img{max-width:100%!important;height:auto!important}h1{font-size:20px!important}p{font-size:14px!important}</style>${previewTemplate.defaultEmail.htmlContent}`}
                        className="w-full h-[480px] border-0 bg-white"
                        title="Template mobile preview"
                      />
                      <div className="bg-foreground/10 h-5 flex items-center justify-center">
                        <div className="w-28 h-1 bg-foreground/30 rounded-full" />
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
              <div className="flex gap-3">
                <Button
                  className="flex-1"
                  onClick={() => {
                    handleTemplateSelect(previewTemplate);
                    setPreviewTemplate(null);
                  }}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Use This Template
                </Button>
                <Button variant="outline" onClick={() => setPreviewTemplate(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Media Library Picker */}
      <MediaLibraryPicker
        open={showMediaLibrary}
        onOpenChange={setShowMediaLibrary}
        onSelect={(url) => {
          setEmailImageUrl(url);
          setImageSource("media");
          setShowMediaLibrary(false);
        }}
      />
    </motion.div>
  );
}
