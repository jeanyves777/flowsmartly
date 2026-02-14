"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
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
import { US_HOLIDAYS, getHolidayDate } from "@/lib/marketing/holidays";
import type { Holiday } from "@/lib/marketing/holidays";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AutomationType = "BIRTHDAY" | "HOLIDAY" | "WELCOME" | "CUSTOM";
type CampaignType = "EMAIL" | "SMS";
type StepId = "trigger" | "content" | "audience";

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

const EMAIL_TEMPLATES: Record<
  string,
  { name: string; description: string; icon: string }
> = {
  promotional: {
    name: "Promotional",
    description: "Highlight sales, discounts, and offers",
    icon: "\uD83C\uDF81",
  },
  welcome: {
    name: "Welcome Email",
    description: "Greet new subscribers and set expectations",
    icon: "\uD83D\uDC4B",
  },
  announcement: {
    name: "Announcement",
    description: "Share important news or updates",
    icon: "\uD83D\uDCE2",
  },
  "thank-you": {
    name: "Thank You",
    description: "Show appreciation to customers",
    icon: "\uD83D\uDE4F",
  },
};

const SMS_TEMPLATES: Record<
  string,
  { name: string; description: string; icon: string }
> = {
  promotional: {
    name: "Promotional",
    description: "Sales and special offers",
    icon: "\uD83C\uDF81",
  },
  welcome: {
    name: "Welcome",
    description: "Welcome new subscribers",
    icon: "\uD83D\uDC4B",
  },
  announcement: {
    name: "Announcement",
    description: "Important notifications",
    icon: "\uD83D\uDCE2",
  },
  "thank-you": {
    name: "Thank You",
    description: "Appreciation messages",
    icon: "\uD83D\uDE4F",
  },
};

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
  { id: "content", label: "Content", icon: Sparkles },
  { id: "audience", label: "Audience & Activate", icon: Users },
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

export default function CreateAutomationPage() {
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
  const [campaignType, setCampaignType] = useState<CampaignType>("EMAIL");

  // --- Step 2: Content ---
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [contentHtml, setContentHtml] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [selectedTone, setSelectedTone] = useState("professional");
  const [customPrompt, setCustomPrompt] = useState("");
  const [brandInfo, setBrandInfo] = useState<{
    hasBrandKit: boolean;
    brandName?: string;
    brandTone?: string;
  } | null>(null);

  // --- Step 3: Audience & Activate ---
  const [selectedContactList, setSelectedContactList] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [enabled, setEnabled] = useState(true);

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

  // -------------------------------------------------------------------------
  // Derived values
  // -------------------------------------------------------------------------

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);
  const templates = campaignType === "EMAIL" ? EMAIL_TEMPLATES : SMS_TEMPLATES;
  const selectedList = contactLists.find((l) => l.id === selectedContactList);
  const currentYear = new Date().getFullYear();

  // Build the trigger object for submission
  const buildTrigger = () => {
    const trigger: Record<string, unknown> = { type: automationType };
    if (automationType === "HOLIDAY" && selectedHoliday) {
      trigger.holidayId = selectedHoliday;
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
      case "content":
        if (campaignType === "EMAIL") {
          return subject.trim().length > 0 && content.trim().length > 0;
        }
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
    if (!selectedTemplate) {
      toast({
        title: "Please select a template first",
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
          type: campaignType.toLowerCase(),
          templateType: selectedTemplate,
          tone: selectedTone,
          customPrompt,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to generate content");
      }

      const result = data.data as GeneratedContent;

      if (campaignType === "EMAIL") {
        setSubject(result.subject || "");
        setContent(result.content);
        setContentHtml(result.htmlContent || "");
      } else {
        setContent(result.content);
      }

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
          subject: campaignType === "EMAIL" ? subject : undefined,
          content,
          contentHtml: campaignType === "EMAIL" ? contentHtml : undefined,
          sendTime,
          daysOffset,
          timezone,
          contactListId: selectedContactList || undefined,
          enabled,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to create automation");
      }

      toast({ title: "Automation created successfully!" });
      router.push("/automations");
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
          <Link href="/automations">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Create Automation</h1>
          <p className="text-muted-foreground">
            Set up an automated campaign triggered by events
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <Card>
        <CardContent className="p-4">
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
                      "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
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
                        "w-8 h-8 rounded-full flex items-center justify-center",
                        isActive && "bg-brand-500 text-white",
                        isCompleted && !isActive && "bg-green-500 text-white",
                        !isActive && !isCompleted && "bg-muted"
                      )}
                    >
                      {isCompleted ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <StepIcon className="w-4 h-4" />
                      )}
                    </div>
                    <span className="hidden sm:inline font-medium">
                      {step.label}
                    </span>
                  </button>
                  {index < STEPS.length - 1 && (
                    <ChevronRight className="w-5 h-5 mx-2 text-muted-foreground" />
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
                    Define when this automation should fire
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
                              onClick={() => setSelectedHoliday(holiday.id)}
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
                      <Label htmlFor="days-offset">
                        Days Offset
                      </Label>
                      <Input
                        id="days-offset"
                        type="number"
                        value={daysOffset}
                        onChange={(e) =>
                          setDaysOffset(parseInt(e.target.value, 10) || 0)
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Days before (negative) or after (positive)
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

                  {/* Campaign Type (EMAIL / SMS) */}
                  <div className="space-y-3">
                    <Label>Campaign Type</Label>
                    <div className="grid grid-cols-2 gap-4">
                      {(
                        [
                          {
                            type: "EMAIL" as const,
                            label: "Email",
                            icon: Mail,
                            color: "blue",
                          },
                          {
                            type: "SMS" as const,
                            label: "SMS",
                            icon: MessageSquare,
                            color: "green",
                          },
                        ] as const
                      ).map((option) => (
                        <button
                          key={option.type}
                          onClick={() => {
                            setCampaignType(option.type);
                            setSelectedTemplate("");
                          }}
                          className={cn(
                            "p-4 rounded-xl border-2 transition-all",
                            campaignType === option.type
                              ? option.type === "EMAIL"
                                ? "border-blue-500 bg-blue-500/10"
                                : "border-green-500 bg-green-500/10"
                              : "border-border hover:border-muted-foreground/50"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "w-12 h-12 rounded-lg flex items-center justify-center",
                                campaignType === option.type
                                  ? option.type === "EMAIL"
                                    ? "bg-blue-500/20"
                                    : "bg-green-500/20"
                                  : "bg-muted"
                              )}
                            >
                              <option.icon
                                className={cn(
                                  "w-6 h-6",
                                  campaignType === option.type
                                    ? option.type === "EMAIL"
                                      ? "text-blue-500"
                                      : "text-green-500"
                                    : "text-muted-foreground"
                                )}
                              />
                            </div>
                            <div className="text-left">
                              <p className="font-semibold">{option.label}</p>
                              <p className="text-sm text-muted-foreground">
                                {option.type === "EMAIL"
                                  ? "Rich content with images & HTML"
                                  : "Short, impactful text messages"}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ============================================================= */}
            {/* STEP 2: CONTENT                                               */}
            {/* ============================================================= */}
            {currentStep === "content" && (
              <div className="grid lg:grid-cols-2 gap-6 h-full">
                {/* Left: Template Selection & AI Generation */}
                <div className="space-y-6">
                  {/* Template Selection */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-brand-500" />
                        AI Templates
                      </CardTitle>
                      <CardDescription>
                        Select a template to generate content with AI
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(templates).map(([key, template]) => (
                          <button
                            key={key}
                            onClick={() => setSelectedTemplate(key)}
                            className={cn(
                              "p-3 rounded-lg border text-left transition-all",
                              selectedTemplate === key
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
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* AI Generation Options */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Wand2 className="w-5 h-5 text-purple-500" />
                        Generation Options
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Tone</Label>
                        <Select
                          value={selectedTone}
                          onValueChange={setSelectedTone}
                        >
                          <SelectTrigger>
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
                        <Label>Additional Instructions</Label>
                        <Textarea
                          placeholder="Any specific requirements or style preferences..."
                          value={customPrompt}
                          onChange={(e) => setCustomPrompt(e.target.value)}
                          rows={2}
                        />
                      </div>

                      <Button
                        onClick={handleGenerateContent}
                        disabled={isGenerating || !selectedTemplate}
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
                </div>

                {/* Right: Content Editor */}
                <Card className="h-full flex flex-col">
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
                    {campaignType === "EMAIL" ? (
                      <>
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
                          <Label htmlFor="email-content">Email Body *</Label>
                          <Textarea
                            id="email-content"
                            placeholder="Enter your email content..."
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="min-h-[200px] font-mono text-sm"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="sms-content">SMS Message *</Label>
                            <div className="text-sm">
                              <span
                                className={
                                  content.length > 160
                                    ? "text-yellow-500"
                                    : "text-muted-foreground"
                                }
                              >
                                {content.length}
                              </span>
                              <span className="text-muted-foreground">
                                /160
                              </span>
                              {content.length > 160 && (
                                <span className="ml-2 text-xs text-yellow-500">
                                  ({Math.ceil(content.length / 160)} segments)
                                </span>
                              )}
                            </div>
                          </div>
                          <Textarea
                            id="sms-content"
                            placeholder="Enter your SMS message..."
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="min-h-[150px]"
                            maxLength={320}
                          />
                        </div>

                        {/* SMS Preview */}
                        <div className="p-4 bg-muted/50 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-2">
                            Preview
                          </p>
                          <div className="bg-green-500 text-white p-3 rounded-2xl rounded-bl-sm max-w-[80%] text-sm">
                            {content || "Your message will appear here..."}
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ============================================================= */}
            {/* STEP 3: AUDIENCE & ACTIVATE                                   */}
            {/* ============================================================= */}
            {currentStep === "audience" && (
              <div className="grid lg:grid-cols-2 gap-6 h-full">
                {/* Left: Contact list, Timezone, Enable toggle */}
                <div className="space-y-6">
                  {/* Contact List */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-500" />
                        Contact List
                      </CardTitle>
                      <CardDescription>
                        Optionally select a contact list for this automation
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
                                  selectedContactList === list.id
                                    ? ""
                                    : list.id
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
                                      {list.activeCount.toLocaleString()} active
                                      contacts
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
                                enabled
                                  ? "text-green-500"
                                  : "text-muted-foreground"
                              )}
                            />
                          </div>
                          <div className="text-left">
                            <p className="font-semibold">
                              {enabled
                                ? "Automation Enabled"
                                : "Automation Disabled"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {enabled
                                ? "Will start running immediately after creation"
                                : "Create as draft, activate later"}
                            </p>
                          </div>
                        </div>
                        {/* Toggle switch (pure CSS) */}
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

                {/* Right: Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle>Automation Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Name</span>
                        <span className="font-medium truncate max-w-[200px]">
                          {automationName || "\u2014"}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Trigger</span>
                        <Badge variant="secondary">
                          {automationType === "BIRTHDAY" && "Birthday"}
                          {automationType === "HOLIDAY" && (
                            <>
                              {US_HOLIDAYS.find(
                                (h) => h.id === selectedHoliday
                              )?.icon || ""}{" "}
                              {US_HOLIDAYS.find(
                                (h) => h.id === selectedHoliday
                              )?.name || "Holiday"}
                            </>
                          )}
                          {automationType === "WELCOME" && "Welcome"}
                          {automationType === "CUSTOM" && "Custom"}
                        </Badge>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Type</span>
                        <Badge variant="secondary">
                          {campaignType === "EMAIL" ? (
                            <>
                              <Mail className="w-3 h-3 mr-1" /> Email
                            </>
                          ) : (
                            <>
                              <MessageSquare className="w-3 h-3 mr-1" /> SMS
                            </>
                          )}
                        </Badge>
                      </div>
                      {campaignType === "EMAIL" && subject && (
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-muted-foreground">Subject</span>
                          <span className="font-medium truncate max-w-[200px]">
                            {subject}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Send Time</span>
                        <span className="font-medium">{sendTime}</span>
                      </div>
                      {daysOffset !== 0 && (
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-muted-foreground">
                            Days Offset
                          </span>
                          <span className="font-medium">
                            {daysOffset > 0 ? `+${daysOffset}` : daysOffset}{" "}
                            {Math.abs(daysOffset) === 1 ? "day" : "days"}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Timezone</span>
                        <span className="font-medium">
                          {TIMEZONES.find((tz) => tz.value === timezone)
                            ?.label || timezone}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Audience</span>
                        <span className="font-medium">
                          {selectedList
                            ? `${selectedList.name} (${selectedList.activeCount.toLocaleString()})`
                            : "All contacts"}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Status</span>
                        <Badge
                          variant={enabled ? "default" : "secondary"}
                          className={
                            enabled
                              ? "bg-green-500 hover:bg-green-600"
                              : ""
                          }
                        >
                          {enabled ? "Enabled" : "Disabled"}
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

                    <div className="pt-4">
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
