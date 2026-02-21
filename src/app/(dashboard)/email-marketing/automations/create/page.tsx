"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
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
  Loader2,
  AlertCircle,
  Cake,
  Calendar,
  UserPlus,
  Star,
  Zap,
  Power,
  Globe,
  Tag,
  ChevronDown,
  Eye,
  Smartphone,
  Info,
  RefreshCw,
  Image,
  Wand,
  UserCircle,
  X,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils/cn";
import { MediaUploader } from "@/components/shared/media-uploader";
import { US_HOLIDAYS, getHolidayDate } from "@/lib/marketing/holidays";
import type { Holiday } from "@/lib/marketing/holidays";
import { getEmailTemplates, TEMPLATE_CATEGORIES } from "@/lib/marketing/templates";
import type { MarketingTemplate, TemplateCategory } from "@/lib/marketing/templates";
import { MERGE_TAGS, type MergeTagCategory } from "@/lib/email/merge-tags";
import { type EmailBrandInfo } from "@/lib/marketing/templates/email-html";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AutomationType = "BIRTHDAY" | "HOLIDAY" | "WELCOME" | "CUSTOM";
type StepId = "trigger" | "template" | "editor" | "audience";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AUTOMATION_TYPES: {
  type: AutomationType;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
}[] = [
  {
    type: "BIRTHDAY",
    label: "Birthday",
    description: "Send on contact birthdays",
    icon: Cake,
    color: "pink",
  },
  {
    type: "HOLIDAY",
    label: "Holiday",
    description: "Send on holidays",
    icon: Calendar,
    color: "orange",
  },
  {
    type: "WELCOME",
    label: "Welcome",
    description: "Welcome new contacts",
    icon: UserPlus,
    color: "green",
  },
  {
    type: "CUSTOM",
    label: "Custom",
    description: "Custom trigger",
    icon: Star,
    color: "purple",
  },
];

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

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern (ET)" },
  { value: "America/Chicago", label: "Central (CT)" },
  { value: "America/Denver", label: "Mountain (MT)" },
  { value: "America/Los_Angeles", label: "Pacific (PT)" },
  { value: "America/Anchorage", label: "Alaska (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii (HT)" },
  { value: "UTC", label: "UTC" },
];

const STEPS: { id: StepId; label: string; icon: React.ElementType }[] = [
  { id: "trigger", label: "Trigger", icon: Zap },
  { id: "template", label: "Template & AI", icon: Sparkles },
  { id: "editor", label: "Edit & Preview", icon: Eye },
  { id: "audience", label: "Audience & Activate", icon: Users },
];

// ---------------------------------------------------------------------------
// Template filtering by trigger type
// ---------------------------------------------------------------------------

function getFilteredTemplates(
  templates: MarketingTemplate[],
  triggerType: AutomationType,
  categoryFilter: TemplateCategory | "all"
): MarketingTemplate[] {
  let filtered: MarketingTemplate[];
  switch (triggerType) {
    case "BIRTHDAY":
      filtered = templates.filter(
        (t) => t.category === "birthday" || (t.automatable && t.triggerEvent?.includes("birthday"))
      );
      break;
    case "HOLIDAY":
      filtered = templates.filter((t) => t.category === "holiday");
      break;
    case "WELCOME":
      filtered = templates.filter((t) => t.category === "lifecycle");
      break;
    case "CUSTOM":
    default:
      filtered = templates;
      break;
  }
  if (categoryFilter !== "all") {
    filtered = filtered.filter((t) => t.category === categoryFilter);
  }
  return filtered;
}

const DAYS_OFFSET_OPTIONS = [
  { value: "-3", label: "3 days before" },
  { value: "-2", label: "2 days before" },
  { value: "-1", label: "Day before" },
  { value: "0", label: "Same day" },
  { value: "1", label: "Day after" },
  { value: "2", label: "2 days after" },
  { value: "3", label: "3 days after" },
];

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CreateEmailAutomationPage() {
  const router = useRouter();
  const { toast } = useToast();

  // Wizard step
  const [currentStep, setCurrentStep] = useState<StepId>("trigger");

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingLists, setLoadingLists] = useState(true);

  // Contact lists
  const [contactLists, setContactLists] = useState<ContactList[]>([]);

  // --- Step 1: Trigger ---
  const [automationName, setAutomationName] = useState("");
  const [automationType, setAutomationType] =
    useState<AutomationType>("BIRTHDAY");
  const [selectedHoliday, setSelectedHoliday] = useState<string>("");
  const [daysOffset, setDaysOffset] = useState(0);
  const [sendTime, setSendTime] = useState("09:00");

  // Campaign type is always EMAIL
  const campaignType = "EMAIL";

  // --- Step 2: Content ---
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [contentHtml, setContentHtml] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [selectedTone, setSelectedTone] = useState("professional");
  const [customPrompt, setCustomPrompt] = useState("");
  const [templateCategory, setTemplateCategory] = useState<TemplateCategory | "all">("all");
  const [showMergeTagDropdown, setShowMergeTagDropdown] = useState(false);
  const [templateMode, setTemplateMode] = useState<"ai" | "templates">("ai");
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [topic, setTopic] = useState("");
  const [productName, setProductName] = useState("");
  const [discount, setDiscount] = useState("");
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [brandInfo, setBrandInfo] = useState<{
    hasBrandKit: boolean;
    brandName?: string;
    brandTone?: string;
  } | null>(null);

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

  // Raw HTML before brand injection
  const [rawHtmlContent, setRawHtmlContent] = useState("");

  // Image / attachment
  const [emailImageUrl, setEmailImageUrl] = useState("");
  const [imageSource, setImageSource] = useState<"upload" | "media" | "ai" | "contact_photo" | "">("");
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imageOverlayText, setImageOverlayText] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const hasImage = !!emailImageUrl || imageSource === "contact_photo";

  // Build preview HTML with image injected after greeting paragraph
  const previewHtml = useMemo(() => {
    if (!contentHtml) return "";
    const imgUrl = emailImageUrl || (imageSource === "contact_photo" ? "" : "");
    if (!imgUrl && imageSource !== "contact_photo") return contentHtml;

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

    if (!imageBlock) return contentHtml;

    // Insert after the first paragraph (greeting line like "Hi {{firstName}},")
    const firstPClose = contentHtml.indexOf("</p>");
    if (firstPClose !== -1) {
      const insertAt = firstPClose + 4;
      return contentHtml.slice(0, insertAt) + imageBlock + contentHtml.slice(insertAt);
    }

    // Fallback: insert after <body> tag
    if (contentHtml.includes("<body")) {
      return contentHtml.replace(/(<body[^>]*>)/i, `$1${imageBlock}`);
    }
    return imageBlock + contentHtml;
  }, [contentHtml, emailImageUrl, imageSource, imageOverlayText]);

  // --- Step 3: Audience & Activate ---
  const [selectedContactList, setSelectedContactList] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [enabled, setEnabled] = useState(true);

  // Birthday stats (for BIRTHDAY type validation)
  const [birthdayStats, setBirthdayStats] = useState<{
    withBirthday: number;
    withoutBirthday: number;
    total: number;
  } | null>(null);
  const [loadingBirthdayStats, setLoadingBirthdayStats] = useState(false);

  // Frequency settings (for CUSTOM type)
  const [frequency, setFrequency] = useState<"one-time" | "daily" | "weekly" | "monthly">("one-time");
  const [frequencyDay, setFrequencyDay] = useState(1);

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  // Rebuild HTML with brand info injected into footer/header
  const rebuildHtmlWithBrand = useCallback((rawHtml: string, brand?: EmailBrandInfo, opts?: { showLogo?: boolean; showName?: boolean; logoSz?: "normal" | "large" | "big" }): string => {
    if (!brand?.name && !brand?.logo) return rawHtml;
    const brandColor = "#6366f1";
    const wantLogo = opts?.showLogo ?? true;
    const wantName = opts?.showName ?? true;
    const sz = opts?.logoSz ?? "normal";
    const logoMaxH = sz === "big" ? "120px" : sz === "large" ? "80px" : "48px";
    const logoMaxW = sz === "big" ? "400px" : sz === "large" ? "300px" : "200px";

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
    fetchContactLists();
    fetchBrandKit();
  }, [fetchContactLists, fetchBrandKit]);

  // Re-apply all HTML transformations when any control changes
  useEffect(() => {
    if (rawHtmlContent) {
      setContentHtml(buildFinalHtml(rawHtmlContent));
    }
  }, [rawHtmlContent, buildFinalHtml]);

  // Fetch birthday stats when entering audience step with BIRTHDAY type
  const fetchBirthdayStats = useCallback(async () => {
    if (automationType !== "BIRTHDAY") return;
    setLoadingBirthdayStats(true);
    try {
      const listParam = selectedContactList ? `&listId=${selectedContactList}` : "";
      const response = await fetch(`/api/contacts/birthday-stats?${listParam}`);
      const data = await response.json();
      if (data.success) setBirthdayStats(data.data);
    } catch (error) {
      console.error("Failed to fetch birthday stats:", error);
    } finally {
      setLoadingBirthdayStats(false);
    }
  }, [automationType, selectedContactList]);

  useEffect(() => {
    if (currentStep === "audience" && automationType === "BIRTHDAY") {
      fetchBirthdayStats();
    }
  }, [currentStep, automationType, selectedContactList, fetchBirthdayStats]);

  // -------------------------------------------------------------------------
  // Derived values
  // -------------------------------------------------------------------------

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);
  const selectedList = contactLists.find((l) => l.id === selectedContactList);
  const currentYear = new Date().getFullYear();

  // Build the trigger object for submission
  const buildTrigger = () => {
    const trigger: Record<string, unknown> = { type: automationType };
    if (automationType === "HOLIDAY" && selectedHoliday) {
      trigger.holidayId = selectedHoliday;
    }
    if (automationType === "CUSTOM") {
      trigger.frequency = frequency;
      if ((frequency === "weekly" || frequency === "monthly") && frequencyDay) {
        trigger.frequencyDay = frequencyDay;
      }
    }
    return trigger;
  };

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  const canGoNext = (): boolean => {
    switch (currentStep) {
      case "trigger":
        if (!automationName.trim()) return false;
        if (automationType === "HOLIDAY" && !selectedHoliday) return false;
        return true;
      case "template":
        return selectedTemplate.length > 0 || (subject.trim().length > 0 && content.trim().length > 0);
      case "editor":
        return subject.trim().length > 0 && content.trim().length > 0;
      default:
        return true;
    }
  };

  // -------------------------------------------------------------------------
  // Navigation
  // -------------------------------------------------------------------------

  const goNext = () => {
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentStepIndex + 1].id);
    }
  };

  const goBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(STEPS[currentStepIndex - 1].id);
    }
  };

  // -------------------------------------------------------------------------
  // AI Content Generation
  // -------------------------------------------------------------------------

  const handleGenerateContent = async () => {
    if (!customPrompt.trim() && !selectedTemplate) {
      toast({
        title: "Please describe your email or select a template",
        variant: "destructive",
      });
      return;
    }

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
      setContent(result.content);
      setRawHtmlContent(result.htmlContent || "");
      if (result.htmlContent) {
        const ctaMatch = result.htmlContent.match(/<a\s+href="[^"]*"\s+style="[^"]*display:\s*inline-block[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
        if (ctaMatch) setCtaText(ctaMatch[1]);
        setShowCoupon(result.htmlContent.includes("{{couponCode}}"));
      }
      setContentHtml(result.htmlContent ? buildFinalHtml(result.htmlContent) : "");

      setBrandInfo({
        hasBrandKit: result.hasBrandKit || false,
        brandName: result.brandName,
        brandTone: result.brandTone,
      });

      toast({ title: "Content generated successfully!" });
    } catch (error) {
      toast({
        title:
          error instanceof Error
            ? error.message
            : "Failed to generate content",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // -------------------------------------------------------------------------
  // Create automation
  // -------------------------------------------------------------------------

  const handleCreateAutomation = async () => {
    if (!automationName.trim()) {
      toast({
        title: "Automation name is required",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: automationName,
          type: automationType,
          trigger: buildTrigger(),
          campaignType: "EMAIL",
          subject,
          content,
          contentHtml,
          sendTime,
          daysOffset,
          timezone,
          contactListId: selectedContactList || undefined,
          enabled,
          imageUrl: emailImageUrl || null,
          imageSource: imageSource || null,
          imageOverlayText: imageOverlayText || null,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to create automation");
      }

      toast({ title: "Automation created successfully!" });
      router.push("/email-marketing/automations");
    } catch (error) {
      toast({
        title:
          error instanceof Error
            ? error.message
            : "Failed to create automation",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /** Format a holiday date for display. */
  const formatHolidayDate = (holiday: Holiday): string => {
    const { month, day } = getHolidayDate(holiday, currentYear);
    const date = new Date(currentYear, month - 1, day);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  /** Color map for automation type buttons. */
  const typeColorClasses = (
    type: AutomationType,
    isActive: boolean
  ): string => {
    if (!isActive) return "border-border hover:border-muted-foreground/50";
    switch (type) {
      case "BIRTHDAY":
        return "border-pink-500 bg-pink-500/10";
      case "HOLIDAY":
        return "border-orange-500 bg-orange-500/10";
      case "WELCOME":
        return "border-green-500 bg-green-500/10";
      case "CUSTOM":
        return "border-purple-500 bg-purple-500/10";
    }
  };

  const typeIconClasses = (
    type: AutomationType,
    isActive: boolean
  ): string => {
    if (!isActive) return "bg-muted";
    switch (type) {
      case "BIRTHDAY":
        return "bg-pink-500/20";
      case "HOLIDAY":
        return "bg-orange-500/20";
      case "WELCOME":
        return "bg-green-500/20";
      case "CUSTOM":
        return "bg-purple-500/20";
    }
  };

  const typeIconTextClasses = (
    type: AutomationType,
    isActive: boolean
  ): string => {
    if (!isActive) return "text-muted-foreground";
    switch (type) {
      case "BIRTHDAY":
        return "text-pink-500";
      case "HOLIDAY":
        return "text-orange-500";
      case "WELCOME":
        return "text-green-500";
      case "CUSTOM":
        return "text-purple-500";
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 flex flex-col space-y-6 pb-8"
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/email-marketing/automations">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Create Email Automation</h1>
          <p className="text-muted-foreground">
            Set up an automated email campaign triggered by events
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
                    onClick={() =>
                      index <= currentStepIndex && setCurrentStep(step.id)
                    }
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm transition-colors",
                      isActive && "bg-brand-500/10 text-brand-500",
                      isCompleted &&
                        !isActive &&
                        "text-green-600 hover:bg-green-500/10",
                      !isActive &&
                        !isCompleted &&
                        "text-muted-foreground"
                    )}
                    disabled={index > currentStepIndex}
                  >
                    <div
                      className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center shrink-0",
                        isActive && "bg-brand-500 text-white",
                        isCompleted && !isActive && "bg-green-500 text-white",
                        !isActive && !isCompleted && "bg-muted"
                      )}
                    >
                      {isCompleted ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <StepIcon className="w-3 h-3" />
                      )}
                    </div>
                    <span className="hidden md:inline font-medium text-xs">
                      {step.label}
                    </span>
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
            {/* ============================================================= */}
            {/* STEP 1: TRIGGER                                               */}
            {/* ============================================================= */}
            {currentStep === "trigger" && (
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Trigger Settings</CardTitle>
                  <CardDescription>
                    Define when this email automation should fire
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Automation Name */}
                  <div className="space-y-2">
                    <Label htmlFor="automation-name">Automation Name *</Label>
                    <Input
                      id="automation-name"
                      placeholder="e.g., Birthday Discount Email"
                      value={automationName}
                      onChange={(e) => setAutomationName(e.target.value)}
                      className="text-lg"
                    />
                    <p className="text-xs text-muted-foreground">
                      A descriptive name for internal reference
                    </p>
                  </div>

                  {/* Automation Type */}
                  <div className="space-y-3">
                    <Label>Trigger Type</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {AUTOMATION_TYPES.map((opt) => {
                        const isActive = automationType === opt.type;
                        const Icon = opt.icon;
                        return (
                          <button
                            key={opt.type}
                            onClick={() => {
                              setAutomationType(opt.type);
                              if (opt.type !== "HOLIDAY") {
                                setSelectedHoliday("");
                              }
                              // Reset template selection when trigger changes
                              setTemplateCategory("all");
                              setSelectedTemplate("");
                              // Auto-fill automation name based on trigger type
                              if (opt.type === "BIRTHDAY") {
                                setAutomationName("Birthday Email");
                              } else if (opt.type === "WELCOME") {
                                setAutomationName("Welcome Email");
                              } else if (opt.type === "CUSTOM") {
                                setAutomationName("Custom Automation");
                              } else if (opt.type === "HOLIDAY") {
                                setAutomationName("Holiday Email");
                              }
                            }}
                            className={cn(
                              "p-4 rounded-xl border-2 transition-all text-center",
                              typeColorClasses(opt.type, isActive)
                            )}
                          >
                            <div
                              className={cn(
                                "w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-2",
                                typeIconClasses(opt.type, isActive)
                              )}
                            >
                              <Icon
                                className={cn(
                                  "w-6 h-6",
                                  typeIconTextClasses(opt.type, isActive)
                                )}
                              />
                            </div>
                            <p className="font-semibold text-sm">{opt.label}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {opt.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Holiday Selection (shown when HOLIDAY type is selected) */}
                  {automationType === "HOLIDAY" && (
                    <div className="space-y-3">
                      <Label>Select Holiday *</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[320px] overflow-y-auto pr-1">
                        {US_HOLIDAYS.map((holiday) => {
                          const isSelected = selectedHoliday === holiday.id;
                          return (
                            <button
                              key={holiday.id}
                              onClick={() => {
                                setSelectedHoliday(holiday.id);
                                setAutomationName(`${holiday.name} Email`);
                              }}
                              className={cn(
                                "p-3 rounded-lg border-2 text-left transition-all",
                                isSelected
                                  ? "border-orange-500 bg-orange-500/10"
                                  : "border-border hover:border-orange-500/50"
                              )}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg">{holiday.icon}</span>
                                <span className="font-medium text-sm truncate">
                                  {holiday.name}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {formatHolidayDate(holiday)}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Timing */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Days Offset</Label>
                      <Select
                        value={String(daysOffset)}
                        onValueChange={(val) => setDaysOffset(parseInt(val, 10))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DAYS_OFFSET_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Relative to the trigger date
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="send-time">Send Time</Label>
                      <Input
                        id="send-time"
                        type="time"
                        value={sendTime}
                        onChange={(e) => setSendTime(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Local time the email is sent
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ============================================================= */}
            {/* STEP 2: TEMPLATE & AI                                         */}
            {/* ============================================================= */}
            {currentStep === "template" && (
              <div className="space-y-6">
                  {/* Mode Toggle */}
                  <div className="flex gap-2 p-1 bg-muted rounded-lg">
                    <button
                      onClick={() => setTemplateMode("ai")}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                        templateMode === "ai"
                          ? "bg-background shadow-sm text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Wand2 className="w-4 h-4" />
                      AI Generate
                    </button>
                    <button
                      onClick={() => setTemplateMode("templates")}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                        templateMode === "templates"
                          ? "bg-background shadow-sm text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Sparkles className="w-4 h-4" />
                      Templates
                    </button>
                  </div>

                  {/* AI Generation Mode */}
                  {templateMode === "ai" && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Wand2 className="w-5 h-5 text-purple-500" />
                          AI Content Generator
                        </CardTitle>
                        <CardDescription>
                          Describe the email you want and AI will generate it for you
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Primary: Prompt input */}
                        <div className="space-y-2">
                          <Label>Describe your email *</Label>
                          <Textarea
                            placeholder="e.g., Write a birthday discount email that wishes the customer happy birthday and offers 20% off their next purchase..."
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
                              Using <strong>{getEmailTemplates().find(t => t.id === selectedTemplate)?.name}</strong> as reference template
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
                                  placeholder="e.g., Birthday celebration"
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
                                  placeholder="e.g., Product Launch"
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
                          Uses 1 credit per generation
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Template Selection Mode */}
                  {templateMode === "templates" && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-brand-500" />
                          Template Library
                        </CardTitle>
                        <CardDescription>
                          Choose a template to pre-fill content
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Trigger-based filter info */}
                        {automationType !== "CUSTOM" && (
                          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/20">
                            <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <span className="text-xs flex-1">
                              Showing templates for <strong>{automationType.toLowerCase()}</strong> automations
                            </span>
                          </div>
                        )}

                        {/* Category Filter Tabs */}
                        {(() => {
                          const triggerTemplates = getFilteredTemplates(getEmailTemplates(), automationType, "all");
                          const availableCategories = [...new Set(triggerTemplates.map((t) => t.category))];
                          return (
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                onClick={() => setTemplateCategory("all")}
                                className={cn(
                                  "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                                  templateCategory === "all"
                                    ? "bg-brand-500 text-white"
                                    : "bg-muted text-muted-foreground hover:bg-muted-foreground/20"
                                )}
                              >
                                All ({triggerTemplates.length})
                              </button>
                              {availableCategories.map((cat) => (
                                <button
                                  key={cat}
                                  onClick={() => setTemplateCategory(cat)}
                                  className={cn(
                                    "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                                    templateCategory === cat
                                      ? "bg-brand-500 text-white"
                                      : "bg-muted text-muted-foreground hover:bg-muted-foreground/20"
                                  )}
                                >
                                  {TEMPLATE_CATEGORIES[cat].icon}{" "}
                                  {TEMPLATE_CATEGORIES[cat].label}
                                </button>
                              ))}
                            </div>
                          );
                        })()}

                        {/* Template Grid */}
                        <div className="grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto pr-1">
                          {getFilteredTemplates(getEmailTemplates(), automationType, templateCategory)
                            .map((template) => (
                              <button
                                key={template.id}
                                onClick={() => {
                                  setSelectedTemplate(template.id);
                                  if (template.defaultEmail) {
                                    setSubject(template.defaultEmail.subject);
                                    setContent(template.defaultEmail.content);
                                    setRawHtmlContent(template.defaultEmail.htmlContent);
                                    const ctaMatch = template.defaultEmail.htmlContent.match(/<a\s+href="[^"]*"\s+style="[^"]*display:\s*inline-block[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
                                    if (ctaMatch) setCtaText(ctaMatch[1]);
                                    setShowCoupon(template.defaultEmail.htmlContent.includes("{{couponCode}}"));
                                    setCtaLink("");
                                    setContentHtml(buildFinalHtml(template.defaultEmail.htmlContent));
                                  }
                                }}
                                className={cn(
                                  "p-3 rounded-lg border text-left transition-all",
                                  selectedTemplate === template.id
                                    ? "border-brand-500 bg-brand-500/10"
                                    : "border-border hover:border-brand-500/50"
                                )}
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-lg">{template.icon}</span>
                                  <span className="font-medium text-sm truncate">
                                    {template.name}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {template.description}
                                </p>
                                <div className="flex items-center gap-1 mt-1.5">
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] px-1.5 py-0"
                                  >
                                    {TEMPLATE_CATEGORIES[template.category].label}
                                  </Badge>
                                  {template.automatable && (
                                    <Badge
                                      variant="secondary"
                                      className="text-[10px] px-1.5 py-0 bg-green-500/10 text-green-600"
                                    >
                                      Auto
                                    </Badge>
                                  )}
                                </div>
                              </button>
                            ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
            )}

            {/* ============================================================= */}
            {/* STEP 3: EDIT & PREVIEW                                        */}
            {/* ============================================================= */}
            {currentStep === "editor" && (
              <div className="grid lg:grid-cols-2 gap-6 h-full">
                {/* Left: Editor */}
                <div className="space-y-4">
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
                      {brandInfo &&
                        (brandInfo.hasBrandKit ? (
                          <div className="flex items-center gap-2 text-xs text-green-600 bg-green-500/10 px-3 py-1.5 rounded-lg">
                            <Check className="w-3.5 h-3.5" />
                            <span>
                              Powered by your brand:{" "}
                              <strong>{brandInfo.brandName}</strong>
                              {brandInfo.brandTone
                                ? ` (${brandInfo.brandTone} tone)`
                                : ""}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-500/10 px-3 py-1.5 rounded-lg">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>
                              Set up your{" "}
                              <a
                                href="/settings"
                                className="underline font-medium"
                              >
                                brand identity
                              </a>{" "}
                              for personalized AI content
                            </span>
                          </div>
                        ))}
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

                      <div className="space-y-2 flex-1">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="email-content">Email Body *</Label>
                          {/* Merge Tag Dropdown */}
                          <div className="relative">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1.5"
                              onClick={() =>
                                setShowMergeTagDropdown(!showMergeTagDropdown)
                              }
                            >
                              <Tag className="w-3 h-3" />
                              Insert Merge Tag
                            </Button>
                            {showMergeTagDropdown && (
                              <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded-lg border bg-popover shadow-lg">
                                <div className="p-2 max-h-[280px] overflow-y-auto">
                                  {(
                                    [
                                      "Contact",
                                      "Dates",
                                      "Business",
                                      "Links",
                                    ] as MergeTagCategory[]
                                  ).map((category) => {
                                    const tagsInCategory = MERGE_TAGS.filter(
                                      (t) => t.category === category
                                    );
                                    if (tagsInCategory.length === 0) return null;
                                    return (
                                      <div key={category} className="mb-2 last:mb-0">
                                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
                                          {category}
                                        </p>
                                        {tagsInCategory.map((mt) => (
                                          <button
                                            key={mt.tag}
                                            type="button"
                                            className="w-full flex items-center justify-between px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors"
                                            onClick={() => {
                                              setContent(
                                                (prev) => prev + mt.tag
                                              );
                                              setShowMergeTagDropdown(false);
                                            }}
                                          >
                                            <span>{mt.label}</span>
                                            <code className="text-[10px] text-muted-foreground">
                                              {mt.tag}
                                            </code>
                                          </button>
                                        ))}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <Textarea
                          id="email-content"
                          placeholder="Enter your email content..."
                          value={content}
                          onChange={(e) => setContent(e.target.value)}
                          className="min-h-[200px] font-mono text-sm"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Email Image Card */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Image className="w-4 h-4 text-purple-500" />
                        Email Image
                        <Badge variant="secondary" className="text-[10px] ml-auto">Optional</Badge>
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Add a header image or personalized image to your email
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Image source tabs */}
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { id: "ai" as const, label: "AI Generate", icon: Wand },
                          { id: "contact_photo" as const, label: "Contact Photo", icon: UserCircle },
                        ].map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => {
                              if (tab.id === "contact_photo") {
                                setImageSource("contact_photo");
                                setEmailImageUrl("");
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

                      {/* Upload / Media Library */}
                      {imageSource !== "ai" && imageSource !== "contact_photo" && (
                        <MediaUploader
                          value={emailImageUrl ? [emailImageUrl] : []}
                          onChange={(urls) => {
                            setEmailImageUrl(urls[0] || "");
                            setImageSource(urls[0] ? "upload" : "");
                          }}
                          accept="image/png,image/jpeg,image/jpg,image/webp"
                          maxSize={10 * 1024 * 1024}
                          filterTypes={["image"]}
                          variant="medium"
                          placeholder="Add image"
                          libraryTitle="Select Image"
                        />
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
                              <><Sparkles className="w-3 h-3 mr-1" /> Generate Image</>
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
                            Each recipient will receive a personalized email with their own photo.
                            Contacts without a photo will receive the email without an image.
                          </p>
                        </div>
                      )}

                      {/* Image preview (AI-generated only — MediaUploader handles its own preview) */}
                      {emailImageUrl && imageSource === "ai" && (
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
                            Merge tags like {"{{firstName}}"} are supported
                          </p>
                        </div>
                      )}

                      {/* Info */}
                      {hasImage && (
                        <div className="flex items-center gap-2 text-[10px] p-2 rounded-lg bg-blue-500/10 text-blue-600">
                          <Info className="w-3.5 h-3.5 shrink-0" />
                          {imageSource === "contact_photo"
                            ? "Personalized image per recipient"
                            : "Same image for all recipients"}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Right: Live Preview */}
                <div className="sticky top-6 space-y-4">
                  <Card className="h-full">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2">
                        <Eye className="w-5 h-5 text-brand-500" />
                        Live Preview
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {contentHtml ? (
                        <Tabs defaultValue="desktop">
                          <TabsList className="grid w-full grid-cols-2 mb-4">
                            <TabsTrigger value="desktop">Desktop</TabsTrigger>
                            <TabsTrigger value="mobile" className="flex items-center gap-1.5">
                              <Smartphone className="w-3.5 h-3.5" />
                              Mobile
                            </TabsTrigger>
                          </TabsList>
                          <TabsContent value="desktop">
                            {subject && (
                              <div className="mb-3 p-3 bg-muted/50 rounded-lg text-sm">
                                <p className="font-medium">{subject}</p>
                              </div>
                            )}
                            <div className="border rounded-lg overflow-hidden">
                              <iframe
                                srcDoc={previewHtml}
                                className="w-full h-[500px] border-0"
                                title="Email preview"
                              />
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
                                </div>
                                {/* Email body */}
                                <iframe
                                  srcDoc={`<meta name="viewport" content="width=375,initial-scale=1"><style>body{margin:0;overflow-x:hidden}table{max-width:100%!important;width:100%!important}td{word-break:break-word!important}img{max-width:100%!important;height:auto!important}h1{font-size:20px!important}p{font-size:14px!important}</style>${previewHtml}`}
                                  className="w-full h-[480px] border-0 bg-white"
                                  title="Email preview mobile"
                                />
                                {/* Phone bottom bar */}
                                <div className="bg-foreground/10 h-5 flex items-center justify-center">
                                  <div className="w-28 h-1 bg-foreground/30 rounded-full" />
                                </div>
                              </div>
                            </div>
                          </TabsContent>
                        </Tabs>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                          <Eye className="w-12 h-12 text-muted-foreground/30 mb-4" />
                          <p className="text-sm font-medium text-muted-foreground">No preview available</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Generate content with AI or select a template to see a preview
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Image attachment indicator */}
                  {hasImage && (
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
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* STEP 4: AUDIENCE & ACTIVATE                                   */}
            {/* ============================================================= */}
            {currentStep === "audience" && (
              <div className="grid lg:grid-cols-2 gap-6 h-full">
                {/* Left: Contact list, Frequency, Timezone, Enable toggle */}
                <div className="space-y-6">
                  {/* Contact List */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-500" />
                        Contact List
                      </CardTitle>
                      <CardDescription>
                        {automationType === "BIRTHDAY"
                          ? "Select contacts to receive birthday emails"
                          : "Optionally select a contact list for this automation"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {loadingLists ? (
                        <div className="space-y-3">
                          {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-16 w-full" />
                          ))}
                        </div>
                      ) : contactLists.length === 0 ? (
                        <div className="text-center py-8">
                          <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                          <p className="font-medium">No contact lists yet</p>
                          <p className="text-sm text-muted-foreground mb-4">
                            Create a contact list to target specific audiences
                          </p>
                          <Button variant="outline" size="sm" asChild>
                            <Link href="/contacts?tab=lists">
                              Create Contact List
                            </Link>
                          </Button>
                        </div>
                      ) : (
                        <div className="grid gap-3 max-h-[280px] overflow-y-auto pr-1">
                          {contactLists.map((list) => (
                            <button
                              key={list.id}
                              onClick={() =>
                                setSelectedContactList(
                                  selectedContactList === list.id ? "" : list.id
                                )
                              }
                              className={cn(
                                "p-4 rounded-xl border-2 text-left transition-all",
                                selectedContactList === list.id
                                  ? "border-brand-500 bg-brand-500/10"
                                  : "border-border hover:border-brand-500/50"
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div
                                    className={cn(
                                      "w-10 h-10 rounded-lg flex items-center justify-center",
                                      selectedContactList === list.id
                                        ? "bg-brand-500/20"
                                        : "bg-muted"
                                    )}
                                  >
                                    <Users
                                      className={cn(
                                        "w-5 h-5",
                                        selectedContactList === list.id
                                          ? "text-brand-500"
                                          : "text-muted-foreground"
                                      )}
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
                                  className={cn(
                                    "w-6 h-6 rounded-full border-2 flex items-center justify-center",
                                    selectedContactList === list.id
                                      ? "border-brand-500 bg-brand-500"
                                      : "border-muted-foreground/30"
                                  )}
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

                      {/* Birthday Validation */}
                      {automationType === "BIRTHDAY" && (
                        <div className="mt-2">
                          {loadingBirthdayStats ? (
                            <Skeleton className="h-20 w-full" />
                          ) : birthdayStats ? (
                            <div
                              className={cn(
                                "p-4 rounded-lg border",
                                birthdayStats.withoutBirthday > 0
                                  ? "border-amber-500/50 bg-amber-500/5"
                                  : "border-green-500/50 bg-green-500/5"
                              )}
                            >
                              <div className="flex items-start gap-3">
                                <div
                                  className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                                    birthdayStats.withoutBirthday > 0
                                      ? "bg-amber-500/20"
                                      : "bg-green-500/20"
                                  )}
                                >
                                  {birthdayStats.withoutBirthday > 0 ? (
                                    <AlertCircle className="w-4 h-4 text-amber-500" />
                                  ) : (
                                    <Check className="w-4 h-4 text-green-500" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium text-sm">
                                    {birthdayStats.withoutBirthday > 0
                                      ? "Some contacts are missing birthday dates"
                                      : "All contacts have birthday dates set"}
                                  </p>
                                  <div className="flex items-center gap-4 mt-2">
                                    <div className="flex items-center gap-1.5">
                                      <Cake className="w-3.5 h-3.5 text-green-500" />
                                      <span className="text-xs font-medium text-green-600">
                                        {birthdayStats.withBirthday} with birthday
                                      </span>
                                    </div>
                                    {birthdayStats.withoutBirthday > 0 && (
                                      <div className="flex items-center gap-1.5">
                                        <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                                        <span className="text-xs font-medium text-amber-600">
                                          {birthdayStats.withoutBirthday} missing
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  {/* Progress bar */}
                                  {birthdayStats.total > 0 && (
                                    <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                                      <div
                                        className={cn(
                                          "h-full rounded-full transition-all",
                                          birthdayStats.withoutBirthday > 0
                                            ? "bg-amber-500"
                                            : "bg-green-500"
                                        )}
                                        style={{
                                          width: `${Math.round((birthdayStats.withBirthday / birthdayStats.total) * 100)}%`,
                                        }}
                                      />
                                    </div>
                                  )}
                                  {birthdayStats.withoutBirthday > 0 && (
                                    <Button
                                      variant="link"
                                      size="sm"
                                      className="mt-2 h-auto p-0 text-xs"
                                      asChild
                                    >
                                      <Link href="/contacts">
                                        Update missing birthdays
                                      </Link>
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Frequency */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <RefreshCw className="w-5 h-5 text-blue-500" />
                        Frequency
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {automationType === "BIRTHDAY" && (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-pink-500/5 border border-pink-500/20">
                          <Cake className="w-5 h-5 text-pink-500 shrink-0" />
                          <div>
                            <p className="font-medium text-sm">Runs annually</p>
                            <p className="text-xs text-muted-foreground">
                              Triggers once per year for each contact on their birthday
                            </p>
                          </div>
                        </div>
                      )}
                      {automationType === "HOLIDAY" && (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-500/5 border border-orange-500/20">
                          <Calendar className="w-5 h-5 text-orange-500 shrink-0" />
                          <div>
                            <p className="font-medium text-sm">Runs every year</p>
                            <p className="text-xs text-muted-foreground">
                              Triggers annually on{" "}
                              {selectedHoliday
                                ? US_HOLIDAYS.find((h) => h.id === selectedHoliday)?.name || "the selected holiday"
                                : "the selected holiday"}
                            </p>
                          </div>
                        </div>
                      )}
                      {automationType === "WELCOME" && (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                          <UserPlus className="w-5 h-5 text-green-500 shrink-0" />
                          <div>
                            <p className="font-medium text-sm">Once per contact</p>
                            <p className="text-xs text-muted-foreground">
                              Triggers once when a new contact joins
                            </p>
                          </div>
                        </div>
                      )}
                      {automationType === "CUSTOM" && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            {([
                              { value: "one-time" as const, label: "One-time", desc: "Manual trigger" },
                              { value: "daily" as const, label: "Daily", desc: "Runs every day" },
                              { value: "weekly" as const, label: "Weekly", desc: "Pick a day" },
                              { value: "monthly" as const, label: "Monthly", desc: "Pick a date" },
                            ]).map((opt) => (
                              <button
                                key={opt.value}
                                onClick={() => setFrequency(opt.value)}
                                className={cn(
                                  "p-3 rounded-lg border-2 text-left transition-all",
                                  frequency === opt.value
                                    ? "border-purple-500 bg-purple-500/10"
                                    : "border-border hover:border-purple-500/50"
                                )}
                              >
                                <p className="font-medium text-sm">{opt.label}</p>
                                <p className="text-xs text-muted-foreground">{opt.desc}</p>
                              </button>
                            ))}
                          </div>
                          {frequency === "weekly" && (
                            <Select
                              value={String(frequencyDay)}
                              onValueChange={(v) => setFrequencyDay(parseInt(v, 10))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select day of week" />
                              </SelectTrigger>
                              <SelectContent>
                                {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(
                                  (d, i) => (
                                    <SelectItem key={i} value={String(i)}>
                                      {d}
                                    </SelectItem>
                                  )
                                )}
                              </SelectContent>
                            </Select>
                          )}
                          {frequency === "monthly" && (
                            <Select
                              value={String(frequencyDay)}
                              onValueChange={(v) => setFrequencyDay(parseInt(v, 10))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select day of month" />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                                  <SelectItem key={d} value={String(d)}>
                                    {d === 1 ? "1st" : d === 2 ? "2nd" : d === 3 ? "3rd" : `${d}th`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Timezone */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Globe className="w-5 h-5 text-indigo-500" />
                        Timezone
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Select value={timezone} onValueChange={setTimezone}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIMEZONES.map((tz) => (
                            <SelectItem key={tz.value} value={tz.value}>
                              {tz.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </CardContent>
                  </Card>

                  {/* Enable Toggle */}
                  <Card>
                    <CardContent className="p-4">
                      <button
                        onClick={() => setEnabled(!enabled)}
                        className="w-full flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "w-10 h-10 rounded-lg flex items-center justify-center",
                              enabled ? "bg-green-500/20" : "bg-muted"
                            )}
                          >
                            <Power
                              className={cn(
                                "w-5 h-5",
                                enabled ? "text-green-500" : "text-muted-foreground"
                              )}
                            />
                          </div>
                          <div className="text-left">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold">
                                {enabled ? "Automation Enabled" : "Automation Disabled"}
                              </p>
                              {enabled && (
                                <span className="relative flex h-2.5 w-2.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {enabled
                                ? "Will start running immediately after creation"
                                : "Create as draft, activate later"}
                            </p>
                          </div>
                        </div>
                        <div
                          className={cn(
                            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                            enabled ? "bg-green-500" : "bg-muted-foreground/30"
                          )}
                        >
                          <span
                            className={cn(
                              "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                              enabled ? "translate-x-6" : "translate-x-1"
                            )}
                          />
                        </div>
                      </button>
                    </CardContent>
                  </Card>
                </div>

                {/* Right: Enhanced Summary */}
                <Card className="h-fit sticky top-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-brand-500" />
                      Automation Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1">
                      {/* Name */}
                      <div className="flex justify-between py-2.5 border-b">
                        <span className="text-sm text-muted-foreground">Name</span>
                        <span className="font-medium text-sm truncate max-w-[200px]">
                          {automationName || "\u2014"}
                        </span>
                      </div>
                      {/* Trigger */}
                      <div className="flex justify-between py-2.5 border-b">
                        <span className="text-sm text-muted-foreground">Trigger</span>
                        <Badge variant="secondary" className="text-xs">
                          {automationType === "BIRTHDAY" && (
                            <><Cake className="w-3 h-3 mr-1" />Birthday</>
                          )}
                          {automationType === "HOLIDAY" && (
                            <>
                              {US_HOLIDAYS.find((h) => h.id === selectedHoliday)?.icon || ""}{" "}
                              {US_HOLIDAYS.find((h) => h.id === selectedHoliday)?.name || "Holiday"}
                            </>
                          )}
                          {automationType === "WELCOME" && (
                            <><UserPlus className="w-3 h-3 mr-1" />Welcome</>
                          )}
                          {automationType === "CUSTOM" && (
                            <><Star className="w-3 h-3 mr-1" />Custom</>
                          )}
                        </Badge>
                      </div>
                      {/* Type */}
                      <div className="flex justify-between py-2.5 border-b">
                        <span className="text-sm text-muted-foreground">Campaign</span>
                        <Badge variant="secondary" className="text-xs">
                          <Mail className="w-3 h-3 mr-1" /> Email
                        </Badge>
                      </div>
                      {/* Subject */}
                      {subject && (
                        <div className="flex justify-between py-2.5 border-b">
                          <span className="text-sm text-muted-foreground">Subject</span>
                          <span className="font-medium text-sm truncate max-w-[200px]">
                            {subject}
                          </span>
                        </div>
                      )}
                      {/* Image */}
                      {hasImage && (
                        <div className="flex justify-between py-2.5 border-b">
                          <span className="text-sm text-muted-foreground">Image</span>
                          <Badge variant="secondary" className="text-[10px]">
                            <Image className="w-3 h-3 mr-1" />
                            {imageSource === "contact_photo" ? "Personalized" : "Attached"}
                          </Badge>
                        </div>
                      )}
                      {/* Send Time */}
                      <div className="flex justify-between py-2.5 border-b">
                        <span className="text-sm text-muted-foreground">Send Time</span>
                        <span className="font-medium text-sm">{sendTime}</span>
                      </div>
                      {/* Days Offset */}
                      <div className="flex justify-between py-2.5 border-b">
                        <span className="text-sm text-muted-foreground">Days Offset</span>
                        <span className="font-medium text-sm">
                          {DAYS_OFFSET_OPTIONS.find((o) => o.value === String(daysOffset))?.label || `${daysOffset} days`}
                        </span>
                      </div>
                      {/* Timezone */}
                      <div className="flex justify-between py-2.5 border-b">
                        <span className="text-sm text-muted-foreground">Timezone</span>
                        <span className="font-medium text-sm">
                          {TIMEZONES.find((tz) => tz.value === timezone)?.label || timezone}
                        </span>
                      </div>
                      {/* Frequency */}
                      <div className="flex justify-between py-2.5 border-b">
                        <span className="text-sm text-muted-foreground">Frequency</span>
                        <span className="font-medium text-sm">
                          {automationType === "BIRTHDAY" && "Annually (per birthday)"}
                          {automationType === "HOLIDAY" && "Annually"}
                          {automationType === "WELCOME" && "Once per contact"}
                          {automationType === "CUSTOM" && (
                            frequency === "one-time" ? "One-time" :
                            frequency === "daily" ? "Daily" :
                            frequency === "weekly" ? `Weekly on ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][frequencyDay]}` :
                            `Monthly on the ${frequencyDay === 1 ? "1st" : frequencyDay === 2 ? "2nd" : frequencyDay === 3 ? "3rd" : `${frequencyDay}th`}`
                          )}
                        </span>
                      </div>
                      {/* Audience */}
                      <div className="flex justify-between py-2.5 border-b">
                        <span className="text-sm text-muted-foreground">Audience</span>
                        <span className="font-medium text-sm">
                          {selectedList
                            ? `${selectedList.name} (${selectedList.activeCount.toLocaleString()})`
                            : "All contacts"}
                        </span>
                      </div>
                      {/* Estimated Reach */}
                      {automationType === "BIRTHDAY" && birthdayStats && (
                        <div className="flex justify-between py-2.5 border-b">
                          <span className="text-sm text-muted-foreground">Estimated Reach</span>
                          <span className="font-medium text-sm text-green-600">
                            {birthdayStats.withBirthday} contacts
                          </span>
                        </div>
                      )}
                      {/* Birthday Coverage */}
                      {automationType === "BIRTHDAY" && birthdayStats && birthdayStats.total > 0 && (
                        <div className="py-2.5 border-b">
                          <div className="flex justify-between mb-1.5">
                            <span className="text-sm text-muted-foreground">Birthday Coverage</span>
                            <span className="text-xs font-medium">
                              {birthdayStats.withBirthday}/{birthdayStats.total} ({Math.round((birthdayStats.withBirthday / birthdayStats.total) * 100)}%)
                            </span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full"
                              style={{ width: `${Math.round((birthdayStats.withBirthday / birthdayStats.total) * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {/* Status */}
                      <div className="flex justify-between py-2.5">
                        <span className="text-sm text-muted-foreground">Status</span>
                        <Badge
                          variant={enabled ? "default" : "secondary"}
                          className={cn("text-xs", enabled && "bg-green-500 hover:bg-green-600")}
                        >
                          {enabled ? "Enabled" : "Draft"}
                        </Badge>
                      </div>
                    </div>

                    {/* Content preview */}
                    {content && (
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Content Preview
                        </p>
                        <p className="text-sm line-clamp-4">{content}</p>
                      </div>
                    )}

                    <div className="pt-2">
                      <Button
                        className="w-full"
                        size="lg"
                        onClick={handleCreateAutomation}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4 mr-2" />
                            Create Automation
                          </>
                        )}
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

    </motion.div>
  );
}
