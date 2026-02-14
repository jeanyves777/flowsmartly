"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  MessageSquare,
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
  RefreshCw,
  Zap,
  Target,
  FileText,
  Settings,
  Phone,
  Smartphone,
  Tag,
  ChevronDown,
  Plus,
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
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils/cn";
import { getSmsTemplates, TEMPLATE_CATEGORIES } from "@/lib/marketing/templates";
import type { MarketingTemplate, TemplateCategory } from "@/lib/marketing/templates";
import { MERGE_TAGS, type MergeTagCategory } from "@/lib/email/merge-tags";
import { MediaLibraryPicker } from "@/components/shared/media-library-picker";
import { NumberStatusBanner } from "@/components/sms/number-status-banner";

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
  content: string;
  characterCount?: number;
  segmentCount?: number;
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

export default function CreateSmsCampaignPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-brand-500" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <CreateSmsCampaignContent />
    </Suspense>
  );
}

function CreateSmsCampaignContent() {
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
  const [smsReady, setSmsReady] = useState(true); // assume ready, disable if not

  // State
  const [currentStep, setCurrentStep] = useState<StepType>("details");
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);

  // Template library
  const [templateMode, setTemplateMode] = useState<"templates" | "ai">("templates");
  const [templateCategory, setTemplateCategory] = useState<TemplateCategory | "all">("all");
  const smsTemplates = getSmsTemplates();
  const filteredTemplates = templateCategory === "all"
    ? smsTemplates
    : smsTemplates.filter(t => t.category === templateCategory);

  // Campaign data
  const [campaignName, setCampaignName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [selectedTone, setSelectedTone] = useState("professional");
  const [selectedContactList, setSelectedContactList] = useState<string>("");

  // Content fields (SMS only)
  const [smsContent, setSmsContent] = useState("");
  const [characterCount, setCharacterCount] = useState(0);
  const [segmentCount, setSegmentCount] = useState(1);

  // Generation options
  const [topic, setTopic] = useState("");
  const [productName, setProductName] = useState("");
  const [discount, setDiscount] = useState("");
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");

  // Brand info (from AI generation response)
  const [brandInfo, setBrandInfo] = useState<{ hasBrandKit: boolean; brandName?: string; brandTone?: string } | null>(null);

  // Merge tags
  const [showMergeTags, setShowMergeTags] = useState(false);
  const smsContentRef = useRef<HTMLTextAreaElement>(null);

  // Advanced options toggle for AI generation
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // MMS Image
  const [mmsImageUrl, setMmsImageUrl] = useState("");
  const [imageSource, setImageSource] = useState<"upload" | "media" | "ai" | "contact_photo" | "">("");
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imageOverlayText, setImageOverlayText] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const isMMS = !!mmsImageUrl || imageSource === "contact_photo";

  // Dynamic credit costs
  const [creditCosts, setCreditCosts] = useState<Record<string, number>>({});

  const insertMergeTag = (tag: string) => {
    const el = smsContentRef.current;
    if (el) {
      const start = el.selectionStart ?? smsContent.length;
      const end = el.selectionEnd ?? smsContent.length;
      const newValue = smsContent.slice(0, start) + tag + smsContent.slice(end);
      setSmsContent(newValue);
      setTimeout(() => {
        el.focus();
        el.selectionStart = el.selectionEnd = start + tag.length;
      }, 0);
    } else {
      setSmsContent(smsContent + tag);
    }
    setShowMergeTags(false);
  };

  const handleTemplateSelect = (template: MarketingTemplate) => {
    setSelectedTemplate(template.id);
    if (template.defaultSms) {
      setSmsContent(template.defaultSms);
    }
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

  useEffect(() => {
    fetchMarketingConfig();
    fetchContactLists();
    // Fetch dynamic credit costs
    fetch("/api/credits/costs?keys=AI_CAPTION,AI_MARKETING_IMAGE,SMS_SEND,MMS_SEND")
      .then(r => r.json())
      .then(d => { if (d.success) setCreditCosts(d.data.costs); })
      .catch(() => {});
    // Check SMS readiness (compliance + number + registration)
    (async () => {
      try {
        const [numRes, compRes, a2pRes, tfRes] = await Promise.all([
          fetch("/api/sms/numbers?action=current"),
          fetch("/api/sms/compliance"),
          fetch("/api/sms/numbers/a2p-status"),
          fetch("/api/sms/numbers/verify"),
        ]);
        const numData = await numRes.json();
        const compData = compRes.ok ? await compRes.json() : null;
        const a2pData = a2pRes.ok ? await a2pRes.json() : null;
        const tfData = tfRes.ok ? await tfRes.json() : null;
        const phone = numData.data?.phoneNumber as string | undefined;
        if (!phone) { setSmsReady(false); return; }
        const ok = compData?.data?.status === "APPROVED";
        const tf = /^\+1(800|833|844|855|866|877|888)/.test(phone);
        const regOk = tf
          ? (tfData?.data?.status === "TWILIO_APPROVED" || tfData?.data?.status === "APPROVED")
          : a2pData?.data?.isApproved === true;
        setSmsReady(ok && regOk);
      } catch { setSmsReady(false); }
    })();
  }, [fetchMarketingConfig, fetchContactLists]);

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
          router.push("/sms-marketing");
          return;
        }
        const c = data.data.campaign;
        setCampaignName(c.name || "");
        setSmsContent(c.content || "");
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

  // Update SMS character count
  useEffect(() => {
    const count = smsContent.length;
    setCharacterCount(count);
    setSegmentCount(Math.max(1, Math.ceil(count / 160)));
  }, [smsContent]);

  // Check if SMS setup is required
  const isSmsConfigured = marketingConfig?.smsEnabled && marketingConfig?.smsPhoneNumber;

  // Get current step index
  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);

  // Navigation
  const canGoNext = () => {
    switch (currentStep) {
      case "details":
        return campaignName.trim().length > 0;
      case "template":
        return selectedTemplate.length > 0 || smsContent.trim().length > 0;
      case "editor":
        return smsContent.trim().length > 0;
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

  // Generate AI content
  const handleGenerateContent = async () => {
    if (!customPrompt.trim() && !selectedTemplate) {
      toast({ title: "Please describe your SMS or select a template", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch("/api/campaigns/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "sms",
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
      setSmsContent(result.content);

      setBrandInfo({
        hasBrandKit: result.hasBrandKit || false,
        brandName: result.brandName,
        brandTone: result.brandTone,
      });

      const toneLabel = TONE_OPTIONS.find(t => t.value === selectedTone)?.label || selectedTone;
      const templateLabel = selectedTemplate
        ? smsTemplates.find(t => t.id === selectedTemplate)?.name || selectedTemplate
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
            content: smsContent,
            contactListId: selectedContactList,
            imageUrl: mmsImageUrl || null,
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
            type: "SMS",
            content: smsContent,
            contactListId: selectedContactList,
            imageUrl: mmsImageUrl || null,
            imageSource: imageSource || null,
            imageOverlayText: imageOverlayText || null,
            status: "DRAFT",
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

      router.push("/sms-marketing");
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
  if (!isSmsConfigured) {
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
                <Phone className="w-8 h-8 text-orange-500" />
              </div>

              <h2 className="text-2xl font-bold mb-2">SMS Setup Required</h2>

              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                You need to rent a phone number before creating SMS campaigns. Get a dedicated number for your business.
              </p>

              <div className="space-y-3">
                <Button size="lg" asChild className="w-full max-w-xs">
                  <Link href="/settings/marketing">
                    <Settings className="w-4 h-4 mr-2" />
                    Configure SMS Settings
                  </Link>
                </Button>

                <div className="flex items-center justify-center gap-4">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/sms-marketing">
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back to SMS Marketing
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="mt-8 p-4 rounded-lg bg-muted/50 text-left">
                <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-500" />
                  SMS Pricing
                </h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>- $5/month phone number rental</li>
                  <li>- $0.03 per SMS message sent</li>
                  <li>- US numbers available</li>
                  <li>- Instant setup</li>
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
          <Link href="/sms-marketing">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{isEditMode ? "Edit SMS Campaign" : "Create SMS Campaign"}</h1>
          <p className="text-muted-foreground">
            {isEditMode ? "Update and send your SMS campaign" : "Build and send your SMS marketing campaign"}
          </p>
        </div>
      </div>

      {/* Number Registration Status Banner */}
      <NumberStatusBanner />

      {/* Progress Steps — compact style matching email */}
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
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-colors text-sm",
                      isActive
                        ? "bg-brand-500/10 text-brand-500"
                        : isCompleted
                        ? "text-green-600 hover:bg-green-500/10"
                        : "text-muted-foreground"
                    )}
                    disabled={index > currentStepIndex}
                  >
                    <div
                      className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center shrink-0",
                        isActive
                          ? "bg-brand-500 text-white"
                          : isCompleted
                          ? "bg-green-500 text-white"
                          : "bg-muted"
                      )}
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
                    Set the basic information for your SMS campaign
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Campaign Name */}
                  <div className="space-y-2">
                    <Label htmlFor="name">Campaign Name *</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Summer Sale SMS Blast"
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
                        Select a template to pre-fill your SMS content, or switch to AI Generation to create custom content
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
                            className={cn(
                              "relative p-3 rounded-lg border text-left transition-all cursor-pointer group",
                              selectedTemplate === template.id
                                ? "border-brand-500 bg-brand-500/10"
                                : "border-border hover:border-brand-500/50"
                            )}
                            onClick={() => handleTemplateSelect(template)}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">{template.icon}</span>
                              <span className="font-medium text-sm truncate flex-1">
                                {template.name}
                              </span>
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
                        {filteredTemplates.length === 0 && (
                          <div className="col-span-full py-8 text-center text-sm text-muted-foreground">
                            No SMS templates in this category
                          </div>
                        )}
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
                        Describe the SMS you want to create and AI will generate it for you
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Primary: Prompt input */}
                      <div className="space-y-2">
                        <Label>Describe your SMS *</Label>
                        <Textarea
                          placeholder="e.g., Write a flash sale SMS announcing 50% off all items this weekend only, with urgency and a link to shop..."
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
                            Using <strong>{smsTemplates.find(t => t.id === selectedTemplate)?.name}</strong> as reference template
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
                          Optionally <button onClick={() => setTemplateMode("templates")} className="underline text-brand-500 font-medium">pick a template</button> as a reference for structure and tone
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
                        Uses {creditCosts.AI_CAPTION || "..."} credits per generation
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
                {/* Left: Content Editor */}
                <div className="space-y-4">
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
                        <div className="flex items-center justify-between">
                          <Label htmlFor="sms">SMS Message *</Label>
                          <div className="flex items-center gap-3">
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
                                  {(["Contact", "Dates", "Business", "Links"] as MergeTagCategory[]).map((category) => {
                                    const categoryTags = MERGE_TAGS.filter((mt) => mt.category === category);
                                    if (categoryTags.length === 0) return null;
                                    return (
                                      <div key={category}>
                                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase">
                                          {category}
                                        </div>
                                        {categoryTags.map((mt) => (
                                          <button
                                            key={mt.tag}
                                            type="button"
                                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted rounded"
                                            onClick={() => insertMergeTag(mt.tag)}
                                          >
                                            {mt.label} <span className="text-muted-foreground">{mt.tag}</span>
                                          </button>
                                        ))}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            <div className="text-sm">
                              <span className={characterCount > 160 ? "text-yellow-500" : "text-muted-foreground"}>
                                {characterCount}
                              </span>
                              <span className="text-muted-foreground">/160</span>
                              <span className="ml-1 text-muted-foreground">
                                ({segmentCount} seg{segmentCount !== 1 ? "s" : ""})
                              </span>
                            </div>
                          </div>
                        </div>
                        <Textarea
                          ref={smsContentRef}
                          id="sms"
                          placeholder="Enter your SMS message... Use {{firstName}} to personalize."
                          value={smsContent}
                          onChange={(e) => setSmsContent(e.target.value)}
                          className="min-h-[200px]"
                          maxLength={320}
                        />
                        {segmentCount > 1 && (
                          <div className="flex items-center gap-2 text-xs text-yellow-500 bg-yellow-500/10 p-2 rounded-lg">
                            <Info className="w-4 h-4" />
                            Messages over 160 characters will be sent as {segmentCount} segments
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* MMS Image Card */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Image className="w-4 h-4 text-purple-500" />
                        MMS Image
                        <Badge variant="secondary" className="text-[10px] ml-auto">Optional</Badge>
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Add an image to send as MMS instead of SMS
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
                                setMmsImageUrl("");
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
                      {imageSource === "upload" && !mmsImageUrl && (
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
                                  setMmsImageUrl(data.data.file.url);
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
                      {imageSource === "ai" && !mmsImageUrl && (
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
                                  setMmsImageUrl(data.data.url);
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
                            Each recipient will receive their own photo as the MMS image.
                            Contacts without a photo will receive text-only SMS.
                          </p>
                        </div>
                      )}

                      {/* Image preview */}
                      {mmsImageUrl && (
                        <div className="relative group">
                          <img
                            src={mmsImageUrl}
                            alt="MMS attachment"
                            className="w-full h-40 object-cover rounded-lg border"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setMmsImageUrl("");
                              setImageSource("");
                            }}
                            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3 text-white" />
                          </button>
                        </div>
                      )}

                      {/* Text overlay (for contact photos or any image) */}
                      {(imageSource === "contact_photo" || mmsImageUrl) && (
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

                      {/* Cost info */}
                      {isMMS && (
                        <div className={cn(
                          "flex items-center gap-2 text-[10px] p-2 rounded-lg",
                          imageSource === "contact_photo"
                            ? "bg-amber-500/10 text-amber-600"
                            : "bg-blue-500/10 text-blue-600"
                        )}>
                          <Info className="w-3.5 h-3.5 shrink-0" />
                          {imageSource === "contact_photo"
                            ? `MMS rate: ${creditCosts.MMS_SEND || "..."} credits per recipient (personalized image)`
                            : `MMS rate: ${creditCosts.MMS_SEND || "..."} credits/msg (same image for all)`}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Right: Phone Preview */}
                <div className="lg:sticky lg:top-6 self-start">
                  <Card className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Smartphone className="w-4 h-4 text-brand-500" />
                        Live Preview
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-6">
                      <div className="flex justify-center">
                        {/* Phone shell */}
                        <div className="w-[320px] border-[3px] border-foreground/15 rounded-[2.5rem] overflow-hidden shadow-xl bg-background relative">
                          {/* Status bar */}
                          <div className="bg-foreground/5 px-6 pt-2 pb-1 flex items-center justify-between">
                            <span className="text-[9px] font-medium text-muted-foreground">
                              {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            {/* Dynamic island */}
                            <div className="w-[76px] h-[22px] bg-foreground rounded-full" />
                            <div className="flex items-center gap-0.5">
                              {/* Signal bars */}
                              <div className="flex items-end gap-[1px]">
                                {[3, 5, 7, 9].map((h, i) => (
                                  <div key={i} className="w-[3px] rounded-sm bg-foreground/70" style={{ height: `${h}px` }} />
                                ))}
                              </div>
                              {/* Battery */}
                              <div className="ml-1 w-[18px] h-[9px] border border-foreground/50 rounded-[2px] relative">
                                <div className="absolute inset-[1px] bg-green-500 rounded-[1px]" style={{ width: "70%" }} />
                              </div>
                            </div>
                          </div>

                          {/* Conversation header */}
                          <div className="bg-muted/60 backdrop-blur px-4 py-2.5 border-b border-border/50 flex items-center gap-3">
                            <ChevronLeft className="w-4 h-4 text-brand-500 shrink-0" />
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-sm">
                              <MessageSquare className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-semibold truncate">
                                {marketingConfig?.smsPhoneNumber || "Your Business"}
                              </p>
                              <p className="text-[9px] text-muted-foreground">SMS</p>
                            </div>
                            <Phone className="w-4 h-4 text-brand-500 shrink-0" />
                          </div>

                          {/* Message area */}
                          <div className="h-[420px] flex flex-col bg-background">
                            {smsContent ? (
                              <div className="flex-1 flex flex-col justify-end p-4 gap-1.5">
                                {/* Date chip */}
                                <div className="text-center mb-2">
                                  <span className="text-[9px] bg-muted/80 text-muted-foreground px-2.5 py-0.5 rounded-full">
                                    Today {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                </div>
                                {/* MMS image preview */}
                                {(mmsImageUrl || imageSource === "contact_photo") && (
                                  <div className="max-w-[85%] mb-1">
                                    {mmsImageUrl ? (
                                      <img
                                        src={mmsImageUrl}
                                        alt="MMS"
                                        className="w-full rounded-2xl rounded-tl-md object-cover max-h-[160px]"
                                      />
                                    ) : (
                                      <div className="w-full h-[120px] rounded-2xl rounded-tl-md bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 flex flex-col items-center justify-center gap-1">
                                        <UserCircle className="w-8 h-8 text-purple-400" />
                                        <span className="text-[9px] text-purple-500 font-medium">Contact Photo</span>
                                      </div>
                                    )}
                                    {imageOverlayText && (
                                      <div className="mt-0.5 px-2 py-1 bg-black/60 text-white text-[10px] rounded-md text-center truncate -mt-6 relative mx-2 backdrop-blur-sm">
                                        {imageOverlayText}
                                      </div>
                                    )}
                                  </div>
                                )}
                                {/* Message bubble */}
                                <div className="max-w-[85%]">
                                  <div className="bg-muted px-3.5 py-2.5 rounded-2xl rounded-tl-md text-[13px] leading-[1.45] whitespace-pre-wrap break-words">
                                    {smsContent}
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-1 pl-1">
                                    <span className="text-[9px] text-muted-foreground">
                                      {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                    {segmentCount > 1 && (
                                      <span className="text-[9px] text-yellow-500 font-medium">
                                        {segmentCount} segments
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6">
                                <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center">
                                  <MessageSquare className="w-6 h-6 text-muted-foreground/40" />
                                </div>
                                <div className="text-center">
                                  <p className="text-xs text-muted-foreground font-medium">No message yet</p>
                                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                                    Write or generate your SMS to preview
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Input bar */}
                            <div className="px-3 pb-3 pt-1">
                              <div className="flex items-center gap-2 bg-muted/50 border border-border/50 rounded-full px-3 py-2">
                                <div className="w-5 h-5 rounded-full bg-brand-500/20 flex items-center justify-center shrink-0">
                                  <Plus className="w-3 h-3 text-brand-500" />
                                </div>
                                <span className="text-[11px] text-muted-foreground/60 flex-1">Text Message</span>
                                <Send className="w-3.5 h-3.5 text-brand-500/40" />
                              </div>
                            </div>
                          </div>

                          {/* Home indicator */}
                          <div className="bg-background pb-1.5 pt-0.5 flex items-center justify-center">
                            <div className="w-28 h-1 bg-foreground/20 rounded-full" />
                          </div>
                        </div>
                      </div>

                      {/* Stats below phone */}
                      {(smsContent || isMMS) && (
                        <div className="mt-4 space-y-2">
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="p-2 rounded-lg bg-muted/50">
                              <p className={cn("text-sm font-semibold", characterCount > 160 ? "text-yellow-500" : "text-foreground")}>
                                {characterCount}
                              </p>
                              <p className="text-[10px] text-muted-foreground">Characters</p>
                            </div>
                            <div className="p-2 rounded-lg bg-muted/50">
                              <p className={cn("text-sm font-semibold", segmentCount > 1 ? "text-yellow-500" : "text-foreground")}>
                                {segmentCount}
                              </p>
                              <p className="text-[10px] text-muted-foreground">Segment{segmentCount !== 1 ? "s" : ""}</p>
                            </div>
                            <div className="p-2 rounded-lg bg-muted/50">
                              <p className="text-sm font-semibold text-foreground">
                                {isMMS ? 10 : 5}
                              </p>
                              <p className="text-[10px] text-muted-foreground">Credits/msg</p>
                            </div>
                          </div>
                          {isMMS && (
                            <div className="text-center">
                              <Badge variant="secondary" className="text-[10px]">
                                <Image className="w-3 h-3 mr-1" />
                                MMS — {imageSource === "contact_photo" ? "Personalized" : "Image attached"}
                              </Badge>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
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
                {!smsReady && (
                  <div className="lg:col-span-2">
                    <Card className="border-orange-500/30 bg-orange-500/5">
                      <CardContent className="p-4 flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-orange-500 shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-orange-600 dark:text-orange-400">SMS setup incomplete</p>
                          <p className="text-xs text-muted-foreground">Complete compliance verification and number registration in SMS Settings before sending.</p>
                        </div>
                        <Button size="sm" variant="outline" asChild>
                          <Link href="/settings/sms-marketing">
                            <Settings className="w-3.5 h-3.5 mr-1" />
                            Settings
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                )}
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
                          className={cn(
                            "p-4 rounded-xl border-2 transition-all",
                            scheduleType === option.id
                              ? "border-brand-500 bg-brand-500/10"
                              : "border-border hover:border-brand-500/50"
                          )}
                        >
                          <option.icon
                            className={cn(
                              "w-8 h-8 mx-auto mb-2",
                              scheduleType === option.id
                                ? "text-brand-500"
                                : "text-muted-foreground"
                            )}
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
                          <MessageSquare className="w-3 h-3 mr-1" /> SMS
                        </Badge>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Message Length</span>
                        <span className="font-medium">
                          {characterCount} chars ({segmentCount} segment{segmentCount !== 1 ? "s" : ""})
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Audience</span>
                        <span className="font-medium">
                          {selectedList?.activeCount.toLocaleString() || 0} contacts
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Type</span>
                        <Badge variant={isMMS ? "default" : "secondary"} className="text-[10px]">
                          {isMMS ? "MMS (Image)" : "SMS (Text)"}
                        </Badge>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Cost per message</span>
                        <span className="font-medium">{isMMS ? (creditCosts.MMS_SEND || "...") : (creditCosts.SMS_SEND || "...")} credits</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Delivery</span>
                        <span className="font-medium">
                          {scheduleType === "now" ? "Send immediately" : "Scheduled"}
                        </span>
                      </div>
                    </div>

                    <div className="pt-4 space-y-3">
                      <Button
                        className="w-full"
                        size="lg"
                        onClick={() => handleCreateCampaign(scheduleType === "now" ? "send" : "schedule")}
                        disabled={
                          isLoading ||
                          !smsReady ||
                          !selectedContactList ||
                          (scheduleType === "later" && (!scheduledDate || !scheduledTime))
                        }
                        title={!smsReady ? "Complete SMS setup (compliance + registration) before sending" : undefined}
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
                        <Link href="/sms-marketing/automations/create">
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

      {/* Media Library Picker */}
      <MediaLibraryPicker
        open={showMediaLibrary}
        onClose={() => setShowMediaLibrary(false)}
        onSelect={(url) => {
          setMmsImageUrl(url);
          setImageSource("media");
          setShowMediaLibrary(false);
        }}
        title="Select MMS Image"
        filterTypes={["image"]}
      />
    </motion.div>
  );
}
