"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  Loader2,
  AlertCircle,
  Cake,
  Calendar,
  UserPlus,
  Star,
  Zap,
  Power,
  Globe,
  Info,
  RefreshCw,
  Hash,
  ChevronDown,
  Eye,
  Settings,
  Image,
  Upload,
  FolderOpen,
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
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils/cn";
import { MediaLibraryPicker } from "@/components/shared/media-library-picker";
import { US_HOLIDAYS, getHolidayDate } from "@/lib/marketing/holidays";
import type { Holiday } from "@/lib/marketing/holidays";
import { getSmsTemplates, TEMPLATE_CATEGORIES } from "@/lib/marketing/templates";
import type { MarketingTemplate, TemplateCategory } from "@/lib/marketing/templates";
import { MERGE_TAGS, type MergeTagCategory } from "@/lib/email/merge-tags";

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

const SMS_TEMPLATES = getSmsTemplates();

const MERGE_TAG_CATEGORIES: MergeTagCategory[] = ["Contact", "Dates", "Business", "Links"];

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
  content: string;
  hasBrandKit?: boolean;
  brandName?: string;
  brandTone?: string;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CreateSmsAutomationPage() {
  const router = useRouter();
  const { toast } = useToast();

  // Hardcoded SMS campaign type
  const campaignType = "SMS";

  // Wizard step
  const [currentStep, setCurrentStep] = useState<StepId>("trigger");

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingLists, setLoadingLists] = useState(true);

  // SMS readiness
  const [smsReady, setSmsReady] = useState(false);

  // Contact lists
  const [contactLists, setContactLists] = useState<ContactList[]>([]);

  // --- Step 1: Trigger ---
  const [automationName, setAutomationName] = useState("");
  const [automationType, setAutomationType] =
    useState<AutomationType>("BIRTHDAY");
  const [selectedHoliday, setSelectedHoliday] = useState<string>("");
  const [daysOffset, setDaysOffset] = useState(0);
  const [sendTime, setSendTime] = useState("09:00");

  // --- Step 2: Content ---
  const [content, setContent] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [templateCategory, setTemplateCategory] = useState<TemplateCategory | "all">("all");
  const [showMergeTags, setShowMergeTags] = useState(false);
  const [selectedTone, setSelectedTone] = useState("professional");
  const [customPrompt, setCustomPrompt] = useState("");
  const [templateMode, setTemplateMode] = useState<"ai" | "templates">("ai");
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [topic, setTopic] = useState("");
  const [productName, setProductName] = useState("");
  const [discount, setDiscount] = useState("");

  // MMS Image
  const [mmsImageUrl, setMmsImageUrl] = useState("");
  const [imageSource, setImageSource] = useState<"upload" | "media" | "ai" | "contact_photo" | "">("");
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imageOverlayText, setImageOverlayText] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const isMMS = !!mmsImageUrl || imageSource === "contact_photo";

  const [brandInfo, setBrandInfo] = useState<{
    hasBrandKit: boolean;
    brandName?: string;
    brandTone?: string;
  } | null>(null);

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
  // Derived values
  // -------------------------------------------------------------------------

  const characterCount = content.length;
  const segmentCount = Math.max(1, Math.ceil(characterCount / 160));

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

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
    fetchContactLists();
  }, [fetchContactLists]);

  // Check if SMS is fully ready (compliance + number + registration approved)
  useEffect(() => {
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
        if (!phone) return;

        const complianceOk = compData?.data?.status === "APPROVED";
        const isTollFree = /^\+1(800|833|844|855|866|877|888)/.test(phone);
        const regOk = isTollFree
          ? (tfData?.data?.status === "TWILIO_APPROVED" || tfData?.data?.status === "APPROVED")
          : a2pData?.data?.isApproved === true;

        setSmsReady(complianceOk && regOk);
      } catch {
        // Non-critical — button stays disabled by default
      }
    })();
  }, []);

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
  // More derived values
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
        return selectedTemplate.length > 0 || content.trim().length > 0;
      case "editor":
        return content.trim().length > 0;
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
        title: "Please describe your SMS or select a template",
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
          type: "sms",
          templateType: selectedTemplate || undefined,
          tone: selectedTone,
          topic,
          productName,
          discount,
          customPrompt,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to generate content");
      }

      const result = data.data as GeneratedContent;
      setContent(result.content);

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
          campaignType,
          content,
          sendTime,
          daysOffset,
          timezone,
          contactListId: selectedContactList || undefined,
          enabled,
          imageUrl: mmsImageUrl || null,
          imageSource: imageSource || null,
          imageOverlayText: imageOverlayText || null,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to create automation");
      }

      toast({ title: "SMS automation created successfully!" });
      router.push("/sms-marketing/automations");
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
          <Link href="/sms-marketing/automations">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Create SMS Automation</h1>
          <p className="text-muted-foreground">
            Set up an automated SMS campaign triggered by events
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
                    Define when this SMS automation should fire
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Automation Name */}
                  <div className="space-y-2">
                    <Label htmlFor="automation-name">Automation Name *</Label>
                    <Input
                      id="automation-name"
                      placeholder="e.g., Birthday SMS Discount"
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
                                setAutomationName("Birthday SMS");
                              } else if (opt.type === "WELCOME") {
                                setAutomationName("Welcome SMS");
                              } else if (opt.type === "CUSTOM") {
                                setAutomationName("Custom Automation");
                              } else if (opt.type === "HOLIDAY") {
                                setAutomationName("Holiday SMS");
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
                                setAutomationName(`${holiday.name} SMS`);
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
                        Local time the message is sent
                      </p>
                    </div>
                  </div>

                  {/* SMS type indicator */}
                  <div className="p-4 rounded-xl border-2 border-green-500 bg-green-500/10">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-green-500/20">
                        <MessageSquare className="w-6 h-6 text-green-500" />
                      </div>
                      <div className="text-left">
                        <p className="font-semibold">SMS Campaign</p>
                        <p className="text-sm text-muted-foreground">
                          Short, impactful text messages
                        </p>
                      </div>
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
                          Describe the SMS you want and AI will generate it for you
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Primary: Prompt input */}
                        <div className="space-y-2">
                          <Label>Describe your SMS *</Label>
                          <Textarea
                            placeholder="e.g., Write a birthday SMS that wishes the customer happy birthday and offers 15% off their next purchase. Keep it short and friendly..."
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
                              Using <strong>{SMS_TEMPLATES.find(t => t.id === selectedTemplate)?.name}</strong> as reference template
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
                            Optionally <button onClick={() => setTemplateMode("templates")} className="underline text-brand-500 font-medium">pick a template</button> as a reference
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
                          {(topic || productName || discount || selectedTone !== "professional") && (
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
                                  placeholder="e.g., Flash sale"
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
                          SMS Templates
                        </CardTitle>
                        <CardDescription>
                          Select a template to pre-fill content
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
                          const triggerTemplates = getFilteredTemplates(SMS_TEMPLATES, automationType, "all");
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
                          {getFilteredTemplates(SMS_TEMPLATES, automationType, templateCategory)
                            .map((template) => (
                              <button
                                key={template.id}
                                onClick={() => {
                                  setSelectedTemplate(template.id);
                                  if (template.defaultSms) {
                                    setContent(template.defaultSms);
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
                {/* Left: Editor + MMS */}
                <div className="space-y-6">
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
                      <div className="flex items-center justify-between">
                        <Label htmlFor="sms-content">SMS Message *</Label>
                        <div className="text-sm">
                          <span
                            className={
                              characterCount > 160
                                ? "text-yellow-500"
                                : "text-muted-foreground"
                            }
                          >
                            {characterCount}
                          </span>
                          <span className="text-muted-foreground">
                            /160 characters
                          </span>
                          <span className="ml-1 text-muted-foreground">
                            ({segmentCount} segment{segmentCount !== 1 ? "s" : ""})
                          </span>
                        </div>
                      </div>
                      <Textarea
                        id="sms-content"
                        placeholder="Enter your SMS message..."
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className="min-h-[200px]"
                        maxLength={320}
                      />
                      {segmentCount > 1 && (
                        <div className="flex items-center gap-2 text-xs text-yellow-500 bg-yellow-500/10 p-2 rounded-lg">
                          <Info className="w-4 h-4" />
                          Messages over 160 characters will be sent as {segmentCount} segments
                        </div>
                      )}

                      {/* Merge Tags */}
                      <div className="relative">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowMergeTags(!showMergeTags)}
                          className="text-xs"
                        >
                          <Hash className="w-3.5 h-3.5 mr-1.5" />
                          Insert Merge Tag
                          <ChevronDown className={cn(
                            "w-3.5 h-3.5 ml-1.5 transition-transform",
                            showMergeTags && "rotate-180"
                          )} />
                        </Button>
                        {showMergeTags && (
                          <div className="absolute z-10 mt-1 w-72 bg-popover border rounded-lg shadow-lg p-2 max-h-[280px] overflow-y-auto">
                            {MERGE_TAG_CATEGORIES.map((category) => {
                              const tagsInCategory = MERGE_TAGS.filter(
                                (t) => t.category === category
                              );
                              if (tagsInCategory.length === 0) return null;
                              return (
                                <div key={category} className="mb-2 last:mb-0">
                                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1">
                                    {category}
                                  </p>
                                  {tagsInCategory.map((mt) => (
                                    <button
                                      key={mt.tag}
                                      type="button"
                                      onClick={() => {
                                        setContent((prev) => prev + mt.tag);
                                        setShowMergeTags(false);
                                      }}
                                      className="w-full flex items-center justify-between px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors"
                                    >
                                      <span>{mt.label}</span>
                                      <code className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                        {mt.tag}
                                      </code>
                                    </button>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
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
                            ? "MMS rate: 10 credits per recipient (personalized image)"
                            : "MMS rate: 10 credits/msg (same image for all)"}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Right: Live Preview */}
                <div className="sticky top-6">
                  <Card className="h-full">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2">
                        <Eye className="w-5 h-5 text-brand-500" />
                        Live Preview
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {/* Phone mockup */}
                      <div className="flex justify-center">
                        <div className="w-[320px] border-[3px] border-foreground/20 rounded-[2.5rem] overflow-hidden shadow-lg bg-background">
                          <div className="bg-foreground/10 h-7 flex items-center justify-center">
                            <div className="w-20 h-4 bg-foreground/20 rounded-full" />
                          </div>
                          <div className="p-4 min-h-[400px] bg-muted/30">
                            <p className="text-[10px] text-muted-foreground text-center mb-4">
                              {isMMS ? "MMS Message" : "SMS Message"}
                            </p>
                            <div className="space-y-2">
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
                                    <div className="w-full h-[120px] rounded-2xl rounded-tl-md bg-purple-500/10 flex items-center justify-center">
                                      <UserCircle className="w-12 h-12 text-purple-500/40" />
                                    </div>
                                  )}
                                  {imageOverlayText && (
                                    <div className="mt-0.5 px-2 py-1 bg-black/60 text-white text-[10px] rounded-md text-center truncate -mt-6 relative mx-2 backdrop-blur-sm">
                                      {imageOverlayText}
                                    </div>
                                  )}
                                </div>
                              )}
                              <div className="bg-green-500 text-white p-3 rounded-2xl rounded-bl-sm max-w-[85%] text-sm leading-relaxed">
                                {content || "Your message will appear here..."}
                              </div>
                              {content && (
                                <p className="text-[10px] text-muted-foreground pl-1">
                                  {characterCount} chars &middot; {segmentCount} segment{segmentCount !== 1 ? "s" : ""}
                                  {isMMS && (
                                    <>
                                      {" "}&middot;{" "}
                                      <Badge variant="secondary" className="text-[10px] py-0 h-4">
                                        <Image className="w-3 h-3 mr-1" />
                                        MMS
                                      </Badge>
                                    </>
                                  )}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* STEP 4: AUDIENCE & ACTIVATE                                   */}
            {/* ============================================================= */}
            {currentStep === "audience" && (
              <div className="grid lg:grid-cols-2 gap-6 h-full">
                {/* SMS setup warning */}
                {!smsReady && (
                  <div className="lg:col-span-2">
                    <Card className="border-orange-500/30 bg-orange-500/5">
                      <CardContent className="p-4 flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-orange-500 shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-orange-600 dark:text-orange-400">SMS setup incomplete</p>
                          <p className="text-xs text-muted-foreground">
                            Complete compliance verification and number registration in SMS Settings before creating automations.
                          </p>
                        </div>
                        <Button size="sm" variant="outline" asChild>
                          <Link href="/settings/sms-marketing">
                            <Settings className="w-4 h-4 mr-1" />
                            Settings
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                )}

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
                          ? "Select contacts to receive birthday SMS"
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
                          <MessageSquare className="w-3 h-3 mr-1" /> SMS
                        </Badge>
                      </div>
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
                      {/* Message */}
                      <div className="flex justify-between py-2.5 border-b">
                        <span className="text-sm text-muted-foreground">Message</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {characterCount} chars ({segmentCount} segment{segmentCount !== 1 ? "s" : ""})
                          </span>
                          {isMMS && (
                            <Badge variant="secondary" className="text-[10px]">
                              <Image className="w-3 h-3 mr-1" />
                              MMS
                            </Badge>
                          )}
                        </div>
                      </div>
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
                        disabled={isLoading || !smsReady}
                        title={!smsReady ? "Complete SMS setup (compliance + registration) before creating automations" : undefined}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4 mr-2" />
                            Create SMS Automation
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
