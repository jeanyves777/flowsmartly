"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Loader2,
  Globe,
  Rocket,
  UserPlus,
  Calendar,
  Clock,
  Briefcase,
  UtensilsCrossed,
  Layers,
  Building2,
  ChevronDown,
  ChevronUp,
  Monitor,
  Tablet,
  Smartphone,
  Eye,
  Edit3,
  Save,
  RefreshCw,
  Share2,
  Copy,
  Check,
  ExternalLink,
  Image,
  Video,
  Upload,
  FolderOpen,
  Link2,
  X,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils/cn";
import { MediaLibraryPicker } from "@/components/shared/media-library-picker";
import { PAGE_TYPE_TEMPLATES, TemplateVariant } from "@/lib/landing-pages/templates";
import { generateTemplatePreviewHtml } from "@/lib/landing-pages/template-preview";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_TYPES = [
  { id: "product", name: "Product Launch", icon: Rocket, description: "Showcase a new product" },
  { id: "lead-capture", name: "Lead Capture", icon: UserPlus, description: "Collect emails & leads" },
  { id: "event", name: "Event", icon: Calendar, description: "Promote an event" },
  { id: "coming-soon", name: "Coming Soon", icon: Clock, description: "Build anticipation" },
  { id: "portfolio", name: "Portfolio", icon: Briefcase, description: "Showcase your work" },
  { id: "restaurant", name: "Restaurant", icon: UtensilsCrossed, description: "Menu & reservations" },
  { id: "saas", name: "SaaS Product", icon: Layers, description: "Software product page" },
  { id: "agency", name: "Agency", icon: Building2, description: "Agency showcase" },
] as const;

const TONES = ["Professional", "Friendly", "Bold", "Elegant", "Playful"] as const;

type DeviceView = "desktop" | "tablet" | "mobile";

const DEVICE_CONFIG: Record<DeviceView, { icon: typeof Monitor; label: string; width: string }> = {
  desktop: { icon: Monitor, label: "Desktop", width: "100%" },
  tablet: { icon: Tablet, label: "Tablet", width: "768px" },
  mobile: { icon: Smartphone, label: "Mobile", width: "375px" },
};

interface GeneratedPage {
  id: string;
  title: string;
  slug: string;
  htmlContent: string;
  status: string;
  publicUrl?: string;
}

interface FormField {
  name: string;
  label: string;
  type: string;
  enabled: boolean;
  required: boolean;
}

const LEAD_CAPTURE_FIELDS: FormField[] = [
  { name: "email", label: "Email", type: "email", enabled: true, required: true },
  { name: "firstName", label: "First Name", type: "text", enabled: true, required: false },
  { name: "lastName", label: "Last Name", type: "text", enabled: true, required: false },
  { name: "phone", label: "Phone", type: "tel", enabled: false, required: false },
  { name: "company", label: "Company", type: "text", enabled: false, required: false },
];

const EVENT_FIELDS: FormField[] = [
  { name: "email", label: "Email", type: "email", enabled: true, required: true },
  { name: "firstName", label: "First Name", type: "text", enabled: true, required: true },
  { name: "lastName", label: "Last Name", type: "text", enabled: true, required: true },
  { name: "phone", label: "Phone", type: "tel", enabled: true, required: false },
  { name: "company", label: "Company", type: "text", enabled: false, required: false },
  { name: "message", label: "Notes / Message", type: "textarea", enabled: true, required: false },
];

type MediaTab = "library" | "upload" | "url";

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const stepVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
  }),
};

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CreateLandingPage() {
  const router = useRouter();
  const { toast } = useToast();

  // Wizard step: 1 = Input, 2 = Generating, 3 = Preview
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);

  // Brand prefill
  const [brandLoaded, setBrandLoaded] = useState(false);

  // Step 1 state
  const [pageType, setPageType] = useState("");
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [brandName, setBrandName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#6366f1");
  const [secondaryColor, setSecondaryColor] = useState("#8b5cf6");
  const [accentColor, setAccentColor] = useState("#f59e0b");
  const [tone, setTone] = useState<string>("");
  const [audience, setAudience] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [keywords, setKeywords] = useState("");

  // Media picker state
  const [imageTab, setImageTab] = useState<MediaTab>("library");
  const [videoTab, setVideoTab] = useState<MediaTab>("library");
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [videoPickerOpen, setVideoPickerOpen] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Template selection state
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<TemplateVariant | null>(null);

  // Form fields state
  const [formFields, setFormFields] = useState<FormField[]>([]);

  // Step 2 / 3 state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPage, setGeneratedPage] = useState<GeneratedPage | null>(null);
  const [deviceView, setDeviceView] = useState<DeviceView>("desktop");
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [publicUrl, setPublicUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");

  // ---------------------------------------------------------------------------
  // Brand Identity Prefill
  // ---------------------------------------------------------------------------

  useEffect(() => {
    fetch("/api/brand")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data?.brandKit) {
          const bk = data.data.brandKit;
          if (bk.name) setBrandName(bk.name);
          if (bk.logo) setLogoUrl(bk.logo);
          if (bk.colors?.primary) setPrimaryColor(bk.colors.primary);
          if (bk.colors?.secondary) setSecondaryColor(bk.colors.secondary);
          if (bk.colors?.accent) setAccentColor(bk.colors.accent);
          if (bk.voiceTone) {
            // Capitalize first letter to match TONES format
            const t = bk.voiceTone.charAt(0).toUpperCase() + bk.voiceTone.slice(1);
            if (TONES.includes(t as (typeof TONES)[number])) setTone(t);
          }
          if (bk.targetAudience) setAudience(bk.targetAudience);
          setBrandLoaded(true);
        }
      })
      .catch(() => {});
  }, []);

  // Update form fields and reset template when page type changes
  useEffect(() => {
    setSelectedTemplate(null);
    if (pageType === "lead-capture") {
      setFormFields(LEAD_CAPTURE_FIELDS.map((f) => ({ ...f })));
    } else if (pageType === "event") {
      setFormFields(EVENT_FIELDS.map((f) => ({ ...f })));
    } else {
      setFormFields([]);
    }
  }, [pageType]);

  // ---------------------------------------------------------------------------
  // Media Upload Handler
  // ---------------------------------------------------------------------------

  const handleFileUpload = useCallback(
    async (file: File, type: "image" | "video") => {
      const setter = type === "image" ? setImageUrl : setVideoUrl;
      const setUploading = type === "image" ? setUploadingImage : setUploadingVideo;

      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/media", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) throw new Error("Upload failed");

        const data = await res.json();
        const url = data.data?.file?.url || data.url;
        if (url) {
          setter(url);
          toast({ title: "Uploaded", description: `${type === "image" ? "Image" : "Video"} uploaded successfully.` });
        }
      } catch {
        toast({ title: "Upload failed", description: "Could not upload file.", variant: "destructive" });
      } finally {
        setUploading(false);
      }
    },
    [toast]
  );

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const canGenerate = prompt.trim().length > 0 && pageType.length > 0;

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return;

    setDirection(1);
    setStep(2);
    setIsGenerating(true);

    // Prepare form config for lead capture / event pages
    const enabledFields = formFields
      .filter((f) => f.enabled)
      .map(({ name, label, type, required }) => ({ name, label, type, required }));

    try {
      const response = await fetch("/api/landing-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          pageType,
          brandName: brandName || undefined,
          logoUrl: logoUrl || undefined,
          colors: {
            primary: primaryColor,
            secondary: secondaryColor,
            accent: accentColor,
          },
          tone: tone || undefined,
          audience: audience || undefined,
          ctaText: ctaText || undefined,
          ctaUrl: ctaUrl || undefined,
          keywords: keywords || undefined,
          imageUrl: imageUrl || undefined,
          videoUrl: videoUrl || undefined,
          formConfig: enabledFields.length > 0 ? enabledFields : undefined,
          templateId: selectedTemplate || undefined,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed to generate landing page");
      }

      const data = await response.json();
      const page: GeneratedPage = data.data?.page ?? data.page ?? data;

      setGeneratedPage(page);
      setEditTitle(page.title || "Untitled Page");
      setDirection(1);
      setStep(3);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Something went wrong";
      toast({ title: "Generation failed", description: message, variant: "destructive" });
      setDirection(-1);
      setStep(1);
    } finally {
      setIsGenerating(false);
    }
  }, [
    canGenerate, prompt, pageType, brandName, logoUrl, primaryColor, secondaryColor,
    accentColor, tone, audience, ctaText, ctaUrl, keywords, imageUrl, videoUrl, formFields, selectedTemplate, toast,
  ]);

  const handlePublish = useCallback(async () => {
    if (!generatedPage) return;
    setIsPublishing(true);

    try {
      const response = await fetch(`/api/landing-pages/${generatedPage.id}/publish`, {
        method: "POST",
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed to publish");
      }

      const data = await response.json();
      const url = data.data?.publicUrl ?? data.publicUrl ?? `/p/${generatedPage.slug}`;

      setPublicUrl(url);
      setIsPublished(true);
      toast({ title: "Published!", description: "Your landing page is now live." });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to publish";
      toast({ title: "Publish failed", description: message, variant: "destructive" });
    } finally {
      setIsPublishing(false);
    }
  }, [generatedPage, toast]);

  const handleCopyLink = useCallback(async () => {
    try {
      const fullUrl = publicUrl.startsWith("http")
        ? publicUrl
        : `${window.location.origin}${publicUrl}`;
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Copied!", description: "Link copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Could not copy to clipboard.", variant: "destructive" });
    }
  }, [publicUrl, toast]);

  const handleRegenerate = useCallback(() => {
    setGeneratedPage(null);
    setIsPublished(false);
    setPublicUrl("");
    setDirection(-1);
    setStep(1);
  }, []);

  const handleSaveDraft = useCallback(() => {
    toast({ title: "Saved", description: "Your landing page has been saved as a draft." });
    router.push("/landing-pages");
  }, [toast, router]);

  const handleTitleSave = useCallback(() => {
    setEditingTitle(false);
    if (generatedPage && editTitle.trim()) {
      setGeneratedPage({ ...generatedPage, title: editTitle.trim() });
    }
  }, [generatedPage, editTitle]);

  const toggleFormField = useCallback((fieldName: string) => {
    setFormFields((prev) =>
      prev.map((f) => (f.name === fieldName && f.name !== "email" ? { ...f, enabled: !f.enabled } : f))
    );
  }, []);

  const toggleFormFieldRequired = useCallback((fieldName: string) => {
    setFormFields((prev) =>
      prev.map((f) => (f.name === fieldName && f.name !== "email" ? { ...f, required: !f.required } : f))
    );
  }, []);

  // ---------------------------------------------------------------------------
  // Media Picker Component
  // ---------------------------------------------------------------------------

  function renderMediaPicker(
    type: "image" | "video",
    value: string,
    setValue: (v: string) => void,
    activeTab: MediaTab,
    setActiveTab: (t: MediaTab) => void,
    pickerOpen: boolean,
    setPickerOpen: (v: boolean) => void,
    uploading: boolean,
    inputRef: React.RefObject<HTMLInputElement | null>,
  ) {
    const isImage = type === "image";
    const IconComp = isImage ? Image : Video;
    const acceptTypes = isImage ? "image/*" : "video/mp4,video/webm,video/quicktime";
    const filterTypes = isImage ? ["image"] : ["video"];

    return (
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm">
          <IconComp className="h-4 w-4 text-muted-foreground" />
          Hero {isImage ? "Image" : "Video"}
          <span className="text-muted-foreground">(optional)</span>
        </Label>

        {/* Preview */}
        {value && (
          <div className="relative group">
            {isImage ? (
              <img
                src={value}
                alt="Selected"
                className="h-24 w-full rounded-lg border object-cover"
              />
            ) : (
              <div className="flex h-16 items-center gap-3 rounded-lg border bg-muted/30 px-3">
                <Video className="h-5 w-5 text-muted-foreground shrink-0" />
                <span className="text-sm truncate flex-1">{value}</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setValue("")}
              className="absolute top-1 right-1 rounded-full bg-background/80 p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {!value && (
          <>
            {/* Tab buttons */}
            <div className="flex gap-1 rounded-md border bg-muted/30 p-0.5">
              {([
                { key: "library" as MediaTab, icon: FolderOpen, label: "Library" },
                { key: "upload" as MediaTab, icon: Upload, label: "Upload" },
                { key: "url" as MediaTab, icon: Link2, label: "URL" },
              ]).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-all flex-1 justify-center",
                    activeTab === tab.key
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {activeTab === "library" && (
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={() => setPickerOpen(true)}
              >
                <FolderOpen className="h-4 w-4" />
                Browse Media Library
              </Button>
            )}

            {activeTab === "upload" && (
              <div
                className={cn(
                  "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 cursor-pointer transition-colors",
                  uploading ? "border-brand-500 bg-brand-500/5" : "border-border hover:border-muted-foreground/50"
                )}
                onClick={() => inputRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
                ) : (
                  <Upload className="h-5 w-5 text-muted-foreground" />
                )}
                <span className="text-xs text-muted-foreground">
                  {uploading ? "Uploading..." : `Click to upload ${type}`}
                </span>
                <input
                  ref={inputRef}
                  type="file"
                  accept={acceptTypes}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file, type);
                    e.target.value = "";
                  }}
                />
              </div>
            )}

            {activeTab === "url" && (
              <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={isImage ? "https://example.com/hero.jpg" : "https://youtube.com/watch?v=..."}
              />
            )}
          </>
        )}

        <MediaLibraryPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={(url) => {
            setValue(url);
            setPickerOpen(false);
          }}
          title={`Select ${isImage ? "Image" : "Video"}`}
          filterTypes={filterTypes}
        />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Step 1: Input Form
  // ---------------------------------------------------------------------------

  function renderInputStep() {
    const hasFormFields = pageType === "lead-capture" || pageType === "event";

    return (
      <motion.div
        key="step-input"
        custom={direction}
        variants={stepVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="w-full max-w-4xl mx-auto space-y-8"
      >
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/landing-pages">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Create Landing Page</h1>
            <p className="text-muted-foreground">
              Describe your page and let AI build it for you
            </p>
          </div>
          {brandLoaded && (
            <Badge variant="secondary" className="gap-1.5 text-xs">
              <Check className="h-3 w-3" />
              Brand loaded
            </Badge>
          )}
        </div>

        {/* Page Type Selector */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">Page Type</Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {PAGE_TYPES.map((pt) => {
              const Icon = pt.icon;
              const selected = pageType === pt.id;
              return (
                <button
                  key={pt.id}
                  type="button"
                  onClick={() => setPageType(pt.id)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-center transition-all hover:shadow-md",
                    selected
                      ? "border-brand-500 bg-brand-500/10 shadow-sm"
                      : "border-border bg-card hover:border-muted-foreground/30"
                  )}
                >
                  <Icon className={cn("h-6 w-6", selected ? "text-brand-500" : "text-muted-foreground")} />
                  <span className={cn("text-sm font-medium", selected ? "text-brand-500" : "text-foreground")}>
                    {pt.name}
                  </span>
                  <span className="text-xs text-muted-foreground">{pt.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Template Gallery — shown when a page type is selected */}
        <AnimatePresence>
          {pageType && PAGE_TYPE_TEMPLATES[pageType]?.variants?.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-3"
            >
              <div>
                <Label className="text-base font-semibold">Choose a Template</Label>
                <p className="text-sm text-muted-foreground">Select a starting design or describe your own below</p>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
                {/* Custom / No template card */}
                <button
                  type="button"
                  onClick={() => setSelectedTemplate(null)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-center transition-all shrink-0 w-[170px]",
                    selectedTemplate === null
                      ? "border-brand-500 bg-brand-500/10 shadow-sm"
                      : "border-border bg-card hover:border-muted-foreground/30"
                  )}
                >
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full",
                    selectedTemplate === null ? "bg-brand-500/20" : "bg-muted"
                  )}>
                    <Sparkles className={cn("h-5 w-5", selectedTemplate === null ? "text-brand-500" : "text-muted-foreground")} />
                  </div>
                  <span className={cn("text-sm font-medium", selectedTemplate === null ? "text-brand-500" : "text-foreground")}>
                    Custom
                  </span>
                  <span className="text-[11px] text-muted-foreground leading-tight">Describe your own design</span>
                  {selectedTemplate === null && (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-white">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                </button>

                {/* Template variant cards */}
                {PAGE_TYPE_TEMPLATES[pageType].variants.map((variant) => {
                  const isSelected = selectedTemplate === variant.id;
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => setSelectedTemplate(variant.id)}
                      className={cn(
                        "flex flex-col gap-2 rounded-lg border-2 p-3 text-left transition-all shrink-0 w-[190px] group relative",
                        isSelected
                          ? "border-brand-500 bg-brand-500/10 shadow-sm"
                          : "border-border bg-card hover:border-muted-foreground/30"
                      )}
                    >
                      {/* Color swatch strip */}
                      <div className="flex gap-1 w-full">
                        <div
                          className="h-2 flex-1 rounded-full"
                          style={{ backgroundColor: variant.colorScheme.primary }}
                        />
                        <div
                          className="h-2 flex-1 rounded-full"
                          style={{ backgroundColor: variant.colorScheme.secondary }}
                        />
                        <div
                          className="h-2 w-8 rounded-full"
                          style={{ backgroundColor: variant.colorScheme.bg, border: variant.colorScheme.bg === "#ffffff" || variant.colorScheme.bg === "#fafafa" || variant.colorScheme.bg === "#f8fafc" ? "1px solid #e5e7eb" : "none" }}
                        />
                      </div>
                      {/* Name & style */}
                      <span className={cn("text-sm font-semibold leading-tight", isSelected ? "text-brand-500" : "text-foreground")}>
                        {variant.name}
                      </span>
                      <span className="text-[11px] text-muted-foreground leading-tight line-clamp-2">
                        {variant.style}
                      </span>
                      {/* Section pills */}
                      <div className="flex flex-wrap gap-1">
                        {variant.previewSections.slice(0, 3).map((s) => (
                          <span key={s} className="text-[9px] bg-muted rounded px-1.5 py-0.5 text-muted-foreground truncate max-w-[80px]">
                            {s}
                          </span>
                        ))}
                        {variant.previewSections.length > 3 && (
                          <span className="text-[9px] bg-muted rounded px-1.5 py-0.5 text-muted-foreground">
                            +{variant.previewSections.length - 3}
                          </span>
                        )}
                      </div>
                      {/* Preview link */}
                      <span
                        role="link"
                        tabIndex={0}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setPreviewTemplate(variant);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.stopPropagation();
                            setPreviewTemplate(variant);
                          }
                        }}
                        className="text-[11px] text-brand-500 hover:underline font-medium mt-auto cursor-pointer"
                      >
                        Preview details
                      </span>
                      {/* Selected checkmark */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-white">
                          <Check className="h-3 w-3" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Template Preview Modal — Full Page Iframe */}
        <AnimatePresence>
          {previewTemplate && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex flex-col bg-black/60"
            >
              {/* Top bar */}
              <div className="flex items-center justify-between bg-card border-b px-4 py-3 shrink-0">
                <div className="flex items-center gap-3">
                  {/* Color swatches */}
                  <div className="flex gap-1">
                    <div className="h-4 w-4 rounded-full border" style={{ backgroundColor: previewTemplate.colorScheme.primary }} />
                    <div className="h-4 w-4 rounded-full border" style={{ backgroundColor: previewTemplate.colorScheme.secondary }} />
                    <div className="h-4 w-4 rounded-full border" style={{ backgroundColor: previewTemplate.colorScheme.bg }} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold leading-tight">{previewTemplate.name}</h3>
                    <p className="text-xs text-muted-foreground">{previewTemplate.style}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      setSelectedTemplate(previewTemplate.id);
                      setPreviewTemplate(null);
                    }}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Select Template
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setPreviewTemplate(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {/* Iframe preview */}
              <div className="flex-1 overflow-hidden">
                <iframe
                  srcDoc={generateTemplatePreviewHtml(previewTemplate, pageType)}
                  title={`${previewTemplate.name} preview`}
                  className="w-full h-full border-none bg-white"
                  sandbox="allow-scripts"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Prompt */}
        <div className="space-y-2">
          <Label htmlFor="prompt" className="text-base font-semibold">
            Describe Your Landing Page
          </Label>
          <Textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe your landing page... e.g., A modern landing page for my fitness app 'FitTrack' that helps users track their workouts and nutrition..."
            className="min-h-[120px] resize-y text-base"
          />
        </div>

        {/* Media: Image & Video */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderMediaPicker(
            "image", imageUrl, setImageUrl,
            imageTab, setImageTab,
            imagePickerOpen, setImagePickerOpen,
            uploadingImage, imageInputRef
          )}
          {renderMediaPicker(
            "video", videoUrl, setVideoUrl,
            videoTab, setVideoTab,
            videoPickerOpen, setVideoPickerOpen,
            uploadingVideo, videoInputRef
          )}
        </div>

        {/* Form Fields Config (for lead-capture / event types) */}
        <AnimatePresence>
          {hasFormFields && formFields.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Card>
                <CardContent className="pt-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-brand-500" />
                    <Label className="text-base font-semibold">Form Fields</Label>
                    <Badge variant="secondary" className="text-xs">
                      {formFields.filter((f) => f.enabled).length} active
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Choose which fields appear on your {pageType === "event" ? "registration" : "lead capture"} form. Submissions will be saved as contacts.
                  </p>
                  <div className="space-y-2">
                    {formFields.map((field) => (
                      <div
                        key={field.name}
                        className={cn(
                          "flex items-center justify-between rounded-lg border px-3 py-2 transition-colors",
                          field.enabled ? "bg-card" : "bg-muted/30 opacity-60"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => toggleFormField(field.name)}
                            disabled={field.name === "email"}
                            className={cn(
                              "h-5 w-5 rounded border flex items-center justify-center transition-colors",
                              field.enabled
                                ? "bg-brand-500 border-brand-500 text-white"
                                : "border-input bg-background",
                              field.name === "email" && "cursor-not-allowed"
                            )}
                          >
                            {field.enabled && <Check className="h-3 w-3" />}
                          </button>
                          <span className="text-sm font-medium">{field.label}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {field.type}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {field.enabled && (
                            <button
                              type="button"
                              onClick={() => toggleFormFieldRequired(field.name)}
                              disabled={field.name === "email"}
                              className={cn(
                                "text-xs px-2 py-0.5 rounded-full transition-colors",
                                field.required
                                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                  : "bg-muted text-muted-foreground hover:bg-muted/80"
                              )}
                            >
                              {field.required ? "Required" : "Optional"}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3">
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      Form submissions are automatically saved as contacts with the tag &quot;landing-page-lead&quot; for easy segmentation and follow-up campaigns.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Advanced Options */}
        <div className="rounded-lg border bg-card">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex w-full items-center justify-between p-4 text-left"
          >
            <div className="flex items-center gap-2">
              <span className="font-medium">Advanced Options</span>
              {brandLoaded && (
                <span className="text-xs text-muted-foreground">(prefilled from brand)</span>
              )}
            </div>
            {showAdvanced ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </button>

          <AnimatePresence>
            {showAdvanced && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="space-y-5 border-t px-4 pb-5 pt-4">
                  {/* Brand Name & Logo */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="brandName">Brand Name</Label>
                      <Input
                        id="brandName"
                        value={brandName}
                        onChange={(e) => setBrandName(e.target.value)}
                        placeholder="My Awesome Brand"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="logoUrl">Brand Logo URL</Label>
                      <div className="flex items-center gap-2">
                        {logoUrl && (
                          <img
                            src={logoUrl}
                            alt="Logo"
                            className="h-9 w-9 rounded border object-contain bg-white p-0.5"
                          />
                        )}
                        <Input
                          id="logoUrl"
                          value={logoUrl}
                          onChange={(e) => setLogoUrl(e.target.value)}
                          placeholder="https://example.com/logo.png"
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Colors */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {([
                      ["Primary Color", primaryColor, setPrimaryColor],
                      ["Secondary Color", secondaryColor, setSecondaryColor],
                      ["Accent Color", accentColor, setAccentColor],
                    ] as const).map(([label, value, setter]) => (
                      <div key={label} className="space-y-2">
                        <Label>{label}</Label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={value}
                            onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                            className="h-9 w-9 cursor-pointer rounded border border-input p-0.5"
                          />
                          <Input
                            value={value}
                            onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                            className="flex-1 font-mono text-sm"
                            maxLength={7}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Tone */}
                  <div className="space-y-2">
                    <Label>Tone</Label>
                    <div className="flex flex-wrap gap-2">
                      {TONES.map((t) => (
                        <Button
                          key={t}
                          type="button"
                          size="sm"
                          variant={tone === t ? "default" : "outline"}
                          onClick={() => setTone(tone === t ? "" : t)}
                          className={cn(
                            "transition-all",
                            tone === t && "bg-brand-500 hover:bg-brand-600 text-white"
                          )}
                        >
                          {t}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Target Audience */}
                  <div className="space-y-2">
                    <Label htmlFor="audience">Target Audience</Label>
                    <Input
                      id="audience"
                      value={audience}
                      onChange={(e) => setAudience(e.target.value)}
                      placeholder="e.g., Small business owners, fitness enthusiasts"
                    />
                  </div>

                  {/* CTA Text, CTA URL & Keywords */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="ctaText">CTA Text</Label>
                      <Input
                        id="ctaText"
                        value={ctaText}
                        onChange={(e) => setCtaText(e.target.value)}
                        placeholder="Get Started Free"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ctaUrl">CTA Link / Product URL</Label>
                      <Input
                        id="ctaUrl"
                        value={ctaUrl}
                        onChange={(e) => setCtaUrl(e.target.value)}
                        placeholder="https://yoursite.com/signup"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="keywords">SEO Keywords</Label>
                      <Input
                        id="keywords"
                        value={keywords}
                        onChange={(e) => setKeywords(e.target.value)}
                        placeholder="fitness app, workout tracker"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Credit display & Generate button */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <Badge variant="secondary" className="text-sm px-3 py-1">
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            This will use 50 credits
          </Badge>

          <Button
            size="lg"
            disabled={!canGenerate}
            onClick={handleGenerate}
            className="w-full sm:w-auto gap-2"
          >
            <Sparkles className="h-5 w-5" />
            Generate Landing Page
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    );
  }

  // ---------------------------------------------------------------------------
  // Step 2: Generating
  // ---------------------------------------------------------------------------

  function renderGeneratingStep() {
    return (
      <motion.div
        key="step-generating"
        custom={direction}
        variants={stepVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="flex min-h-[60vh] flex-col items-center justify-center gap-6"
      >
        <div className="relative">
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -inset-8 rounded-full bg-brand-500/10"
          />
          <motion.div
            animate={{ scale: [1, 1.08, 1], opacity: [0.8, 1, 0.8] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
            className="absolute -inset-4 rounded-full bg-brand-500/20"
          />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-brand-500/30">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            >
              <Globe className="h-10 w-10 text-brand-500" />
            </motion.div>
          </div>
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">Building your landing page...</h2>
          <p className="text-muted-foreground">This may take 15-30 seconds...</p>
        </div>

        <div className="flex gap-1.5 pt-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.div
              key={i}
              className="h-2 w-2 rounded-full bg-brand-500"
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
            />
          ))}
        </div>

        <div className="mt-6 w-64 space-y-3">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-3/5" />
        </div>
      </motion.div>
    );
  }

  // ---------------------------------------------------------------------------
  // Step 3: Preview & Edit
  // ---------------------------------------------------------------------------

  function renderPreviewStep() {
    if (!generatedPage) return null;

    const deviceWidth = DEVICE_CONFIG[deviceView].width;
    const iframeMaxWidth = deviceView === "desktop" ? "100%" : deviceWidth;

    return (
      <motion.div
        key="step-preview"
        custom={direction}
        variants={stepVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="w-full space-y-4"
      >
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3 shadow-sm">
          {/* Left: Back + title */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Link href="/landing-pages">
              <Button variant="ghost" size="icon" className="shrink-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>

            {editingTitle ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="h-8 max-w-[240px] text-sm font-semibold"
                  onKeyDown={(e) => e.key === "Enter" && handleTitleSave()}
                  autoFocus
                />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleTitleSave}>
                  <Check className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setEditTitle(generatedPage.title); setEditingTitle(true); }}
                className="flex items-center gap-1.5 truncate text-sm font-semibold hover:text-brand-500 transition-colors"
              >
                <span className="truncate">{generatedPage.title}</span>
                <Edit3 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Center: Device toggle */}
          <div className="flex items-center gap-1 rounded-md border bg-muted/50 p-0.5">
            {(Object.entries(DEVICE_CONFIG) as [DeviceView, typeof DEVICE_CONFIG[DeviceView]][]).map(
              ([key, config]) => {
                const Icon = config.icon;
                return (
                  <Button
                    key={key}
                    size="sm"
                    variant={deviceView === key ? "default" : "ghost"}
                    className={cn("h-7 gap-1.5 px-2 text-xs", deviceView === key && "shadow-sm")}
                    onClick={() => setDeviceView(key)}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{config.label}</span>
                  </Button>
                );
              }
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleRegenerate}>
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Regenerate</span>
            </Button>

            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSaveDraft}>
              <Save className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Save as Draft</span>
            </Button>

            {!isPublished ? (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={handlePublish}
                disabled={isPublishing}
              >
                {isPublishing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Globe className="h-3.5 w-3.5" />
                )}
                <span>{isPublishing ? "Publishing..." : "Publish"}</span>
              </Button>
            ) : (
              <Badge variant="default" className="gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3 py-1">
                <Check className="h-3.5 w-3.5" />
                Published
              </Badge>
            )}
          </div>
        </div>

        {/* Published share section */}
        <AnimatePresence>
          {isPublished && publicUrl && (
            <motion.div {...fadeIn} transition={{ duration: 0.3 }}>
              <Card className="border-green-500/30 bg-green-500/5">
                <CardContent className="flex flex-wrap items-center gap-3 p-4">
                  <Globe className="h-5 w-5 text-green-600 shrink-0" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">
                    Your page is live!
                  </span>
                  <code className="flex-1 min-w-0 truncate rounded bg-green-100 dark:bg-green-900/30 px-2 py-1 text-xs font-mono">
                    {publicUrl.startsWith("http") ? publicUrl : `${typeof window !== "undefined" ? window.location.origin : ""}${publicUrl}`}
                  </code>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={handleCopyLink}
                    >
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? "Copied" : "Copy Link"}
                    </Button>
                    <a
                      href={publicUrl.startsWith("http") ? publicUrl : publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button size="sm" variant="outline" className="gap-1.5">
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open
                      </Button>
                    </a>
                    <Button size="sm" variant="outline" className="gap-1.5">
                      <Share2 className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Share to Feed</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Preview iframe */}
        <div className="flex justify-center">
          <div
            className="relative rounded-lg border bg-white shadow-lg transition-all duration-300"
            style={{
              width: iframeMaxWidth,
              maxWidth: "100%",
            }}
          >
            {/* Browser chrome bar */}
            <div className="flex items-center gap-2 rounded-t-lg border-b bg-muted/50 px-4 py-2">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-red-400" />
                <div className="h-3 w-3 rounded-full bg-yellow-400" />
                <div className="h-3 w-3 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 rounded bg-background px-3 py-1 text-xs text-muted-foreground truncate">
                {publicUrl
                  ? (publicUrl.startsWith("http") ? publicUrl : `${typeof window !== "undefined" ? window.location.origin : ""}${publicUrl}`)
                  : `yoursite.com/${generatedPage.slug}`}
              </div>
              <Eye className="h-3.5 w-3.5 text-muted-foreground" />
            </div>

            <iframe
              srcDoc={generatedPage.htmlContent}
              title={generatedPage.title}
              className="w-full rounded-b-lg"
              style={{ height: "70vh", border: "none" }}
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </div>
      </motion.div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="container mx-auto px-4 py-6">
      <AnimatePresence mode="wait" custom={direction}>
        {step === 1 && renderInputStep()}
        {step === 2 && renderGeneratingStep()}
        {step === 3 && renderPreviewStep()}
      </AnimatePresence>
    </div>
  );
}
