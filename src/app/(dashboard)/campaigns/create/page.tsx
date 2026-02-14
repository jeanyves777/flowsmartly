"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  AlertTriangle,
  Phone,
  Server,
  Smartphone,
  Tag,
  ChevronDown,
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

// Types
type CampaignType = "EMAIL" | "SMS";
type StepType = "details" | "template" | "audience" | "schedule";

interface MarketingConfig {
  emailProvider: string;
  emailVerified: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  smsPhoneNumber: string | null;
  smsVerified: boolean;
  smsTollfreeVerifyStatus: string | null;
}

// Email templates
const EMAIL_TEMPLATES = {
  welcome: { name: "Welcome Email", description: "Greet new subscribers and set expectations", icon: "👋" },
  newsletter: { name: "Newsletter", description: "Share updates, news, and valuable content", icon: "📰" },
  promotional: { name: "Promotional", description: "Highlight sales, discounts, and offers", icon: "🎁" },
  announcement: { name: "Announcement", description: "Share important news or updates", icon: "📢" },
  "abandoned-cart": { name: "Abandoned Cart", description: "Recover lost sales with cart reminders", icon: "🛒" },
  "re-engagement": { name: "Re-engagement", description: "Win back inactive subscribers", icon: "💫" },
  "thank-you": { name: "Thank You", description: "Show appreciation to customers", icon: "🙏" },
  feedback: { name: "Feedback Request", description: "Ask customers for reviews or feedback", icon: "⭐" },
  "event-invite": { name: "Event Invitation", description: "Invite subscribers to events or webinars", icon: "📅" },
  "product-launch": { name: "Product Launch", description: "Announce new products or services", icon: "🚀" },
};

// SMS templates
const SMS_TEMPLATES = {
  promotional: { name: "Promotional", description: "Sales and special offers", icon: "🎁" },
  reminder: { name: "Reminder", description: "Event or appointment reminders", icon: "⏰" },
  confirmation: { name: "Confirmation", description: "Order or booking confirmations", icon: "✅" },
  "flash-sale": { name: "Flash Sale", description: "Limited-time urgent offers", icon: "⚡" },
  appointment: { name: "Appointment", description: "Schedule reminders and updates", icon: "📅" },
  "shipping-update": { name: "Shipping Update", description: "Delivery status notifications", icon: "📦" },
  welcome: { name: "Welcome", description: "Welcome new subscribers", icon: "👋" },
  feedback: { name: "Feedback", description: "Request reviews and feedback", icon: "⭐" },
  loyalty: { name: "Loyalty Rewards", description: "Points and rewards notifications", icon: "🏆" },
  alert: { name: "Alert", description: "Important notifications", icon: "🔔" },
};

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
  characterCount?: number;
  segmentCount?: number;
  hasBrandKit?: boolean;
  brandName?: string;
  brandTone?: string;
}

const STEPS: { id: StepType; label: string; icon: React.ElementType }[] = [
  { id: "details", label: "Campaign Details", icon: FileText },
  { id: "template", label: "Template & Content", icon: Sparkles },
  { id: "audience", label: "Audience", icon: Users },
  { id: "schedule", label: "Schedule & Send", icon: Send },
];

const MERGE_TAGS = [
  { tag: "{{firstName}}", label: "First Name" },
  { tag: "{{lastName}}", label: "Last Name" },
  { tag: "{{email}}", label: "Email" },
  { tag: "{{name}}", label: "Full Name" },
];

export default function CreateCampaignPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Get type from URL
  const typeFromUrl = searchParams.get("type")?.toUpperCase() as CampaignType | null;

  // Marketing config state
  const [marketingConfig, setMarketingConfig] = useState<MarketingConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // State
  const [currentStep, setCurrentStep] = useState<StepType>("details");
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);

  // Campaign data
  const [campaignType, setCampaignType] = useState<CampaignType>(typeFromUrl || "EMAIL");
  const [campaignName, setCampaignName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [selectedTone, setSelectedTone] = useState("professional");
  const [selectedContactList, setSelectedContactList] = useState<string>("");

  // Content fields (Email)
  const [subject, setSubject] = useState("");
  const [preheader, setPreheader] = useState("");
  const [emailContent, setEmailContent] = useState("");
  const [htmlContent, setHtmlContent] = useState("");

  // Content fields (SMS)
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
  const emailContentRef = useRef<HTMLTextAreaElement>(null);
  const smsContentRef = useRef<HTMLTextAreaElement>(null);

  const insertMergeTag = (tag: string) => {
    if (campaignType === "EMAIL") {
      const el = emailContentRef.current;
      if (el) {
        const start = el.selectionStart ?? emailContent.length;
        const end = el.selectionEnd ?? emailContent.length;
        const newValue = emailContent.slice(0, start) + tag + emailContent.slice(end);
        setEmailContent(newValue);
        // Restore cursor position after React re-render
        setTimeout(() => {
          el.focus();
          el.selectionStart = el.selectionEnd = start + tag.length;
        }, 0);
      } else {
        setEmailContent(emailContent + tag);
      }
    } else {
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

  useEffect(() => {
    fetchMarketingConfig();
    fetchContactLists();
  }, [fetchMarketingConfig, fetchContactLists]);

  // Update SMS character count
  useEffect(() => {
    const count = smsContent.length;
    setCharacterCount(count);
    setSegmentCount(Math.max(1, Math.ceil(count / 160)));
  }, [smsContent]);

  // Check if setup is required
  const isEmailConfigured = marketingConfig?.emailProvider !== "NONE" && marketingConfig?.emailVerified;
  const isSmsConfigured = marketingConfig?.smsEnabled && marketingConfig?.smsPhoneNumber;
  const isTollfreeVerificationPending = marketingConfig?.smsTollfreeVerifyStatus != null &&
    marketingConfig.smsTollfreeVerifyStatus !== "TWILIO_APPROVED";
  const isTollfreeRejected = marketingConfig?.smsTollfreeVerifyStatus === "TWILIO_REJECTED";

  const needsSetup = (type: CampaignType) => {
    if (type === "EMAIL") return !isEmailConfigured;
    return !isSmsConfigured || isTollfreeVerificationPending;
  };

  // Get templates based on type
  const templates = campaignType === "EMAIL" ? EMAIL_TEMPLATES : SMS_TEMPLATES;

  // Get current step index
  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);

  // Navigation
  const canGoNext = () => {
    switch (currentStep) {
      case "details":
        return campaignName.trim().length > 0;
      case "template":
        if (campaignType === "EMAIL") {
          return subject.trim().length > 0 && emailContent.trim().length > 0;
        }
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
    if (!selectedTemplate) {
      toast({ title: "Please select a template first", variant: "destructive" });
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

      if (campaignType === "EMAIL") {
        setSubject(result.subject || "");
        setPreheader(result.preheader || "");
        setEmailContent(result.content);
        setHtmlContent(result.htmlContent || "");
      } else {
        setSmsContent(result.content);
      }

      setBrandInfo({
        hasBrandKit: result.hasBrandKit || false,
        brandName: result.brandName,
        brandTone: result.brandTone,
      });

      const toneLabel = TONE_OPTIONS.find(t => t.value === selectedTone)?.label || selectedTone;
      const templateLabel = templates[selectedTemplate as keyof typeof templates]?.name || selectedTemplate;
      toast({
        title: "Content generated successfully!",
        description: `Generated ${templateLabel} with ${toneLabel} tone${result.hasBrandKit ? ` for ${result.brandName}` : ""}`,
      });
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
      // Create the campaign
      const createResponse = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: campaignName,
          type: campaignType,
          subject: campaignType === "EMAIL" ? subject : undefined,
          preheaderText: campaignType === "EMAIL" ? preheader : undefined,
          content: campaignType === "EMAIL" ? emailContent : smsContent,
          contentHtml: campaignType === "EMAIL" ? htmlContent : undefined,
          contactListId: selectedContactList,
          status: "DRAFT",
        }),
      });

      const createData = await createResponse.json();

      if (!createData.success) {
        throw new Error(createData.error?.message || "Failed to create campaign");
      }

      const campaignId = createData.data.campaign.id;

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
          ? "Campaign saved as draft"
          : action === "send"
          ? "Campaign sent successfully!"
          : "Campaign scheduled successfully!",
      });

      router.push("/campaigns");
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
  if (loadingConfig) {
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
  if (needsSetup(campaignType)) {
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
                {campaignType === "EMAIL" ? (
                  <Server className="w-8 h-8 text-orange-500" />
                ) : (
                  <Phone className="w-8 h-8 text-orange-500" />
                )}
              </div>

              <h2 className="text-2xl font-bold mb-2">
                {campaignType === "EMAIL"
                  ? "Email Setup Required"
                  : isTollfreeVerificationPending
                    ? "Toll-Free Verification Pending"
                    : "SMS Setup Required"}
              </h2>

              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                {campaignType === "EMAIL"
                  ? "You need to configure an email provider before creating email campaigns. Set up SMTP, SendGrid, Mailgun, or another provider."
                  : isTollfreeRejected
                    ? "Your toll-free number verification was rejected. Please contact support or submit a new verification before creating SMS campaigns."
                    : isTollfreeVerificationPending
                      ? "Your toll-free number is under carrier review. You'll be able to create SMS campaigns once verification is approved (typically 1-5 business days)."
                      : "You need to rent a phone number before creating SMS campaigns. Get a dedicated number for your business."}
              </p>

              <div className="space-y-3">
                <Button size="lg" asChild className="w-full max-w-xs">
                  <Link href={campaignType === "SMS" && isTollfreeVerificationPending ? "/settings/sms-marketing" : "/settings/marketing"}>
                    <Settings className="w-4 h-4 mr-2" />
                    {campaignType === "SMS" && isTollfreeVerificationPending
                      ? "Check Verification Status"
                      : `Configure ${campaignType === "EMAIL" ? "Email" : "SMS"} Settings`}
                  </Link>
                </Button>

                <div className="flex items-center justify-center gap-4">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/campaigns">
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back to Campaigns
                    </Link>
                  </Button>

                  {campaignType === "EMAIL" && isSmsConfigured && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCampaignType("SMS")}
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Create SMS Instead
                    </Button>
                  )}

                  {campaignType === "SMS" && isEmailConfigured && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCampaignType("EMAIL")}
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      Create Email Instead
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-8 p-4 rounded-lg bg-muted/50 text-left">
                <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-500" />
                  {campaignType === "EMAIL" ? "Supported Email Providers" : "SMS Pricing"}
                </h4>
                {campaignType === "EMAIL" ? (
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• SMTP (Custom server)</li>
                    <li>• SendGrid</li>
                    <li>• Mailgun</li>
                    <li>• Amazon SES</li>
                    <li>• Resend</li>
                  </ul>
                ) : (
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• $5/month phone number rental</li>
                    <li>• $0.03 per SMS message sent</li>
                    <li>• US numbers available</li>
                    <li>• Instant setup</li>
                  </ul>
                )}
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
          <Link href="/campaigns">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Create Campaign</h1>
          <p className="text-muted-foreground">
            Build and send your {campaignType === "EMAIL" ? "email" : "SMS"} marketing campaign
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
                    onClick={() => index <= currentStepIndex && setCurrentStep(step.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                      isActive
                        ? "bg-brand-500/10 text-brand-500"
                        : isCompleted
                        ? "text-green-600 hover:bg-green-500/10"
                        : "text-muted-foreground"
                    }`}
                    disabled={index > currentStepIndex}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isActive
                          ? "bg-brand-500 text-white"
                          : isCompleted
                          ? "bg-green-500 text-white"
                          : "bg-muted"
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <StepIcon className="w-4 h-4" />
                      )}
                    </div>
                    <span className="hidden sm:inline font-medium">{step.label}</span>
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
            {/* Step 1: Campaign Details */}
            {currentStep === "details" && (
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Campaign Details</CardTitle>
                  <CardDescription>
                    Set the basic information for your campaign
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Campaign Type */}
                  <div className="space-y-3">
                    <Label>Campaign Type</Label>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { type: "EMAIL" as const, label: "Email Campaign", icon: Mail, color: "blue", configured: isEmailConfigured },
                        { type: "SMS" as const, label: "SMS Campaign", icon: MessageSquare, color: "green", configured: isSmsConfigured },
                      ].map((option) => (
                        <button
                          key={option.type}
                          onClick={() => {
                            if (option.configured) {
                              setCampaignType(option.type);
                              setSelectedTemplate("");
                            }
                          }}
                          disabled={!option.configured}
                          className={`p-4 rounded-xl border-2 transition-all ${
                            !option.configured
                              ? "opacity-50 cursor-not-allowed border-border"
                              : campaignType === option.type
                              ? `border-${option.color}-500 bg-${option.color}-500/10`
                              : "border-border hover:border-muted-foreground/50"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                                campaignType === option.type && option.configured
                                  ? `bg-${option.color}-500/20`
                                  : "bg-muted"
                              }`}
                            >
                              <option.icon
                                className={`w-6 h-6 ${
                                  campaignType === option.type && option.configured
                                    ? `text-${option.color}-500`
                                    : "text-muted-foreground"
                                }`}
                              />
                            </div>
                            <div className="text-left">
                              <p className="font-semibold">{option.label}</p>
                              <p className="text-sm text-muted-foreground">
                                {!option.configured
                                  ? "Setup required"
                                  : option.type === "EMAIL"
                                  ? "Rich content with images & HTML"
                                  : "Short, impactful text messages"}
                              </p>
                            </div>
                          </div>
                          {!option.configured && (
                            <Badge variant="outline" className="mt-2 text-orange-500 border-orange-500/30">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Not configured
                            </Badge>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

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

            {/* Step 2: Template & Content */}
            {currentStep === "template" && (
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
                      <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
                        {Object.entries(templates).map(([key, template]) => (
                          <button
                            key={key}
                            onClick={() => setSelectedTemplate(key)}
                            className={`p-3 rounded-lg border text-left transition-all ${
                              selectedTemplate === key
                                ? "border-brand-500 bg-brand-500/10"
                                : "border-border hover:border-brand-500/50"
                            }`}
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
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Tone</Label>
                          <Select value={selectedTone} onValueChange={setSelectedTone}>
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
                          <Label>Topic (optional)</Label>
                          <Input
                            placeholder="e.g., New feature release"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Product/Service</Label>
                          <Input
                            placeholder="e.g., Premium Plan"
                            value={productName}
                            onChange={(e) => setProductName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Discount/Offer</Label>
                          <Input
                            placeholder="e.g., 20% off"
                            value={discount}
                            onChange={(e) => setDiscount(e.target.value)}
                          />
                        </div>
                      </div>

                      {(selectedTemplate === "event-invite" || selectedTemplate === "appointment") && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Event Name</Label>
                            <Input
                              placeholder="e.g., Product Launch Webinar"
                              value={eventName}
                              onChange={(e) => setEventName(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Event Date</Label>
                            <Input
                              type="date"
                              value={eventDate}
                              onChange={(e) => setEventDate(e.target.value)}
                            />
                          </div>
                        </div>
                      )}

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
                    <CardTitle className="flex items-center justify-between">
                      <span>Content Editor</span>
                      {campaignType === "EMAIL" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowPreview(true)}
                          disabled={!emailContent}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Preview
                        </Button>
                      )}
                    </CardTitle>
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
                                <div className="absolute right-0 top-8 z-50 bg-popover border rounded-lg shadow-lg p-1 min-w-[160px]">
                                  {MERGE_TAGS.map((mt) => (
                                    <button
                                      key={mt.tag}
                                      type="button"
                                      className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-accent transition-colors"
                                      onClick={() => insertMergeTag(mt.tag)}
                                    >
                                      <span className="font-mono text-xs text-brand-500">{mt.tag}</span>
                                      <span className="ml-2 text-muted-foreground">{mt.label}</span>
                                    </button>
                                  ))}
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
                      </>
                    ) : (
                      <>
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
                                  <div className="absolute right-0 top-8 z-50 bg-popover border rounded-lg shadow-lg p-1 min-w-[160px]">
                                    {MERGE_TAGS.map((mt) => (
                                      <button
                                        key={mt.tag}
                                        type="button"
                                        className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-accent transition-colors"
                                        onClick={() => insertMergeTag(mt.tag)}
                                      >
                                        <span className="font-mono text-xs text-brand-500">{mt.tag}</span>
                                        <span className="ml-2 text-muted-foreground">{mt.label}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="text-sm">
                                <span className={characterCount > 160 ? "text-yellow-500" : "text-muted-foreground"}>
                                  {characterCount}
                                </span>
                                <span className="text-muted-foreground">/160</span>
                                {segmentCount > 1 && (
                                  <span className="ml-2 text-xs text-yellow-500">
                                    ({segmentCount} segments)
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <Textarea
                            ref={smsContentRef}
                            id="sms"
                            placeholder="Enter your SMS message... Use {{firstName}} to personalize."
                            value={smsContent}
                            onChange={(e) => setSmsContent(e.target.value)}
                            className="min-h-[150px]"
                            maxLength={320}
                          />
                          {segmentCount > 1 && (
                            <div className="flex items-center gap-2 text-xs text-yellow-500 bg-yellow-500/10 p-2 rounded-lg">
                              <Info className="w-4 h-4" />
                              Messages over 160 characters will be sent as {segmentCount} segments
                            </div>
                          )}
                        </div>

                        {/* SMS Preview */}
                        <div className="p-4 bg-muted/50 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-2">Preview</p>
                          <div className="bg-green-500 text-white p-3 rounded-2xl rounded-bl-sm max-w-[80%] text-sm">
                            {smsContent || "Your message will appear here..."}
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Step 3: Audience */}
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

            {/* Step 4: Schedule & Send */}
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
                          {campaignType === "EMAIL" ? (
                            <><Mail className="w-3 h-3 mr-1" /> Email</>
                          ) : (
                            <><MessageSquare className="w-3 h-3 mr-1" /> SMS</>
                          )}
                        </Badge>
                      </div>
                      {campaignType === "EMAIL" && subject && (
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

      {/* Email Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="desktop">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="desktop">Desktop</TabsTrigger>
              <TabsTrigger value="mobile">
                <Smartphone className="w-3.5 h-3.5 mr-1.5" />
                Mobile
              </TabsTrigger>
              <TabsTrigger value="html">HTML Source</TabsTrigger>
            </TabsList>
            <TabsContent value="desktop" className="mt-4">
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted p-3 border-b">
                  <p className="text-sm font-medium">{subject}</p>
                  <p className="text-xs text-muted-foreground">{preheader}</p>
                </div>
                <div className="p-6 bg-background max-h-[400px] overflow-y-auto">
                  {htmlContent ? (
                    <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
                  ) : (
                    <div className="whitespace-pre-wrap">{emailContent}</div>
                  )}
                </div>
              </div>
            </TabsContent>
            <TabsContent value="mobile" className="mt-4">
              <div className="flex justify-center">
                <div className="w-[320px] border-[3px] border-foreground/20 rounded-[2rem] overflow-hidden shadow-lg">
                  {/* Phone notch */}
                  <div className="bg-foreground/20 h-6 flex items-center justify-center">
                    <div className="w-20 h-3 bg-foreground/30 rounded-full" />
                  </div>
                  {/* Email header */}
                  <div className="bg-muted px-3 py-2 border-b">
                    <p className="text-xs font-medium truncate">{subject}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{preheader}</p>
                  </div>
                  {/* Email body */}
                  <div className="bg-background p-3 max-h-[400px] overflow-y-auto text-sm">
                    {htmlContent ? (
                      <div
                        className="[&_*]:!max-width-full [&_table]:!w-full [&_img]:!max-w-full"
                        dangerouslySetInnerHTML={{ __html: htmlContent }}
                      />
                    ) : (
                      <div className="whitespace-pre-wrap text-xs">{emailContent}</div>
                    )}
                  </div>
                  {/* Phone bottom bar */}
                  <div className="bg-foreground/20 h-5 flex items-center justify-center">
                    <div className="w-24 h-1 bg-foreground/30 rounded-full" />
                  </div>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="html" className="mt-4">
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute right-2 top-2"
                  onClick={() => {
                    navigator.clipboard.writeText(htmlContent || emailContent);
                    toast({ title: "Copied to clipboard" });
                  }}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </Button>
                <pre className="p-4 bg-muted rounded-lg overflow-auto max-h-[400px] text-xs">
                  {htmlContent || emailContent}
                </pre>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
