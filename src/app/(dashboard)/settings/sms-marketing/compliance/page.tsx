"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Shield,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  ExternalLink,
  Globe,
  FileText,
  MessageSquare,
  Send,
  Loader2,
  Check,
  Info,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { MediaUploader } from "@/components/shared/media-uploader";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

type ComplianceStatus =
  | "NOT_STARTED"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "SUSPENDED";

interface ComplianceData {
  smsComplianceStatus: ComplianceStatus;
  complianceNotes?: string | null;
  businessName?: string;
  businessWebsite?: string;
  businessStreetAddress?: string;
  businessCity?: string;
  businessStateProvinceRegion?: string;
  businessPostalCode?: string;
  businessCountry?: string;
  privacyPolicyUrl?: string;
  termsOfServiceUrl?: string;
  useCase?: string;
  useCaseDescription?: string;
  sampleMessages?: string[];
  smsOptInImageUrl?: string;
}

type StepId = "business" | "privacy" | "usecase" | "samples" | "review";

const STEPS: { id: StepId; label: string; icon: React.ElementType }[] = [
  { id: "business", label: "Business Info", icon: Globe },
  { id: "privacy", label: "Privacy & Terms", icon: FileText },
  { id: "usecase", label: "Use Case", icon: MessageSquare },
  { id: "samples", label: "Sample Messages", icon: Send },
  { id: "review", label: "Review & Submit", icon: Shield },
];

const USE_CASE_OPTIONS = [
  { value: "marketing", label: "Marketing" },
  { value: "customer_support", label: "Customer Support" },
  { value: "notifications", label: "Notifications" },
  { value: "two_factor_auth", label: "Two-Factor Auth" },
  { value: "mixed", label: "Mixed" },
];

// ------------------------------------------------------------------
// URL verification helper
// ------------------------------------------------------------------

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------
// Component
// ------------------------------------------------------------------

export default function SmsCompliancePage() {
  const { toast } = useToast();

  // Status from server
  const [complianceData, setComplianceData] = useState<ComplianceData | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);

  // Wizard state
  const [currentStep, setCurrentStep] = useState<StepId>("business");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1 - Business Info
  const [businessName, setBusinessName] = useState("");
  const [businessWebsite, setBusinessWebsite] = useState("");
  const [businessStreetAddress, setBusinessStreetAddress] = useState("");
  const [businessCity, setBusinessCity] = useState("");
  const [businessStateProvinceRegion, setBusinessStateProvinceRegion] = useState("");
  const [businessPostalCode, setBusinessPostalCode] = useState("");
  const [businessCountry, setBusinessCountry] = useState("US");

  // Step 2 - Privacy & Terms
  const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState("");
  const [termsOfServiceUrl, setTermsOfServiceUrl] = useState("");
  const [privacyUrlStatus, setPrivacyUrlStatus] = useState<"idle" | "checking" | "ok" | "error">("idle");
  const [termsUrlStatus, setTermsUrlStatus] = useState<"idle" | "checking" | "ok" | "error">("idle");

  // Step 3 - Use Case
  const [useCase, setUseCase] = useState("");
  const [useCaseDescription, setUseCaseDescription] = useState("");

  // Step 4 - Sample Messages
  const [sampleMessages, setSampleMessages] = useState<string[]>(["", ""]);

  // Step 2b - Opt-In Screenshot
  const [smsOptInImageUrl, setSmsOptInImageUrl] = useState("");

  // Track whether fields were auto-filled from brand identity
  const [brandPrefilled, setBrandPrefilled] = useState(false);

  // ------------------------------------------------------------------
  // Fetch current compliance status + brand identity
  // ------------------------------------------------------------------

  const fetchComplianceStatus = useCallback(async () => {
    try {
      setIsLoadingStatus(true);
      const [complianceRes, brandRes] = await Promise.all([
        fetch("/api/sms/compliance"),
        fetch("/api/brand"),
      ]);

      const data = await complianceRes.json();
      const brandData = brandRes.ok ? await brandRes.json() : null;
      const brandKit = brandData?.success ? brandData.data?.brandKit : null;

      if (data.success && data.data) {
        // API returns { status, compliance: { businessName, smsUseCase, ... } }
        const apiStatus = data.data.status || "NOT_STARTED";
        const c = data.data.compliance;

        const cd: ComplianceData = {
          smsComplianceStatus: apiStatus,
          complianceNotes: c?.complianceNotes ?? null,
          businessName: c?.businessName,
          businessWebsite: c?.businessWebsite,
          businessStreetAddress: c?.businessStreetAddress,
          businessCity: c?.businessCity,
          businessStateProvinceRegion: c?.businessStateProvinceRegion,
          businessPostalCode: c?.businessPostalCode,
          businessCountry: c?.businessCountry,
          privacyPolicyUrl: c?.privacyPolicyUrl,
          termsOfServiceUrl: c?.termsOfServiceUrl,
          useCase: c?.smsUseCase,
          useCaseDescription: c?.smsUseCaseDescription,
          sampleMessages: c?.smsMessageSamples,
          smsOptInImageUrl: c?.smsOptInImageUrl,
        };
        setComplianceData(cd);

        // Pre-fill form fields if data exists from compliance
        if (cd.businessName) setBusinessName(cd.businessName);
        if (cd.businessWebsite) setBusinessWebsite(cd.businessWebsite);
        if (cd.businessStreetAddress) setBusinessStreetAddress(cd.businessStreetAddress);
        if (cd.businessCity) setBusinessCity(cd.businessCity);
        if (cd.businessStateProvinceRegion) setBusinessStateProvinceRegion(cd.businessStateProvinceRegion);
        if (cd.businessPostalCode) setBusinessPostalCode(cd.businessPostalCode);
        if (cd.businessCountry) setBusinessCountry(cd.businessCountry);
        if (cd.privacyPolicyUrl) setPrivacyPolicyUrl(cd.privacyPolicyUrl);
        if (cd.termsOfServiceUrl) setTermsOfServiceUrl(cd.termsOfServiceUrl);
        if (cd.smsOptInImageUrl) setSmsOptInImageUrl(cd.smsOptInImageUrl);
        if (cd.useCase) setUseCase(cd.useCase);
        if (cd.useCaseDescription) setUseCaseDescription(cd.useCaseDescription);
        if (cd.sampleMessages && cd.sampleMessages.length >= 2) {
          setSampleMessages(cd.sampleMessages);
        }

        // If compliance fields are empty, auto-fill from brand identity
        if (brandKit) {
          let didPrefill = false;
          if (!cd.businessName && brandKit.name) {
            setBusinessName(brandKit.name);
            didPrefill = true;
          }
          if (!cd.businessWebsite && brandKit.website) {
            setBusinessWebsite(brandKit.website);
            didPrefill = true;
          }
          if (didPrefill) setBrandPrefilled(true);
        }
      } else {
        // No compliance data yet — default to NOT_STARTED
        setComplianceData({ smsComplianceStatus: "NOT_STARTED" });

        // Auto-fill from brand identity for fresh start
        if (brandKit) {
          let didPrefill = false;
          if (brandKit.name) {
            setBusinessName(brandKit.name);
            didPrefill = true;
          }
          if (brandKit.website) {
            setBusinessWebsite(brandKit.website);
            didPrefill = true;
          }
          if (didPrefill) setBrandPrefilled(true);
        }
      }
    } catch {
      setComplianceData({ smsComplianceStatus: "NOT_STARTED" });
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    fetchComplianceStatus();
  }, [fetchComplianceStatus]);

  // ------------------------------------------------------------------
  // URL checker
  // ------------------------------------------------------------------

  const checkUrl = async (
    url: string,
    setStatus: React.Dispatch<React.SetStateAction<"idle" | "checking" | "ok" | "error">>,
  ) => {
    if (!isValidUrl(url)) {
      setStatus("error");
      return;
    }
    setStatus("checking");
    try {
      // Use our own proxy endpoint or direct fetch.
      // Since CORS may block HEAD from client, we try no-cors mode
      // which will at least confirm reachability (opaque response).
      const res = await fetch(url, { method: "HEAD", mode: "no-cors" });
      // no-cors gives opaque response (status 0), but if it doesn't throw it means network reached.
      // A real error (DNS, etc.) would reject the promise.
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  };

  // ------------------------------------------------------------------
  // Navigation helpers
  // ------------------------------------------------------------------

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);

  const canGoNext = (): boolean => {
    switch (currentStep) {
      case "business":
        return businessName.trim().length > 0 && isValidUrl(businessWebsite) && businessStreetAddress.trim().length > 0 && businessCity.trim().length > 0 && businessStateProvinceRegion.trim().length > 0 && businessPostalCode.trim().length > 0;
      case "privacy":
        return isValidUrl(privacyPolicyUrl) && smsOptInImageUrl.length > 0;
      case "usecase":
        return useCase.length > 0 && useCaseDescription.trim().length >= 50;
      case "samples": {
        const filledSamples = sampleMessages.filter((m) => m.trim().length > 0);
        return filledSamples.length >= 2;
      }
      default:
        return true;
    }
  };

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

  // ------------------------------------------------------------------
  // Sample message helpers
  // ------------------------------------------------------------------

  const updateSampleMessage = (index: number, value: string) => {
    const updated = [...sampleMessages];
    updated[index] = value.slice(0, 320);
    setSampleMessages(updated);
  };

  const addSampleMessage = () => {
    if (sampleMessages.length < 5) {
      setSampleMessages([...sampleMessages, ""]);
    }
  };

  const removeSampleMessage = (index: number) => {
    if (sampleMessages.length > 2) {
      setSampleMessages(sampleMessages.filter((_, i) => i !== index));
    }
  };

  // ------------------------------------------------------------------
  // Submit
  // ------------------------------------------------------------------

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/sms/compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: businessName.trim(),
          businessWebsite: businessWebsite.trim(),
          businessStreetAddress: businessStreetAddress.trim(),
          businessCity: businessCity.trim(),
          businessStateProvinceRegion: businessStateProvinceRegion.trim(),
          businessPostalCode: businessPostalCode.trim(),
          businessCountry: businessCountry.trim() || "US",
          privacyPolicyUrl: privacyPolicyUrl.trim(),
          termsOfServiceUrl: termsOfServiceUrl.trim() || undefined,
          smsUseCase: useCase,
          smsUseCaseDescription: useCaseDescription.trim(),
          smsMessageSamples: sampleMessages.filter((m) => m.trim().length > 0),
          smsOptInImageUrl: smsOptInImageUrl.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to submit compliance application");
      }

      toast({
        title: "Application submitted successfully",
        description: "Your SMS compliance application is now under review.",
      });

      // Refresh status to show PENDING_REVIEW
      fetchComplianceStatus();
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to submit application",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ------------------------------------------------------------------
  // Derived state
  // ------------------------------------------------------------------

  const status = complianceData?.smsComplianceStatus ?? "NOT_STARTED";
  const isMissingOptInImage = status === "APPROVED" && !complianceData?.smsOptInImageUrl;
  const isFormEnabled = status === "NOT_STARTED" || status === "REJECTED" || isMissingOptInImage;

  // ------------------------------------------------------------------
  // Loading state
  // ------------------------------------------------------------------

  if (isLoadingStatus) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-brand-500" />
          <p className="text-muted-foreground">Loading compliance status...</p>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 flex flex-col space-y-6 p-6 max-w-4xl mx-auto pb-8"
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/settings/sms-marketing">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            SMS Compliance
          </h1>
          <p className="text-muted-foreground mt-1">
            Complete your compliance application to start sending SMS messages
          </p>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Status Banner                                                     */}
      {/* ---------------------------------------------------------------- */}

      <StatusBanner
        status={status}
        complianceNotes={complianceData?.complianceNotes}
        isMissingOptInImage={isMissingOptInImage}
      />

      {/* ---------------------------------------------------------------- */}
      {/* APPROVED — done, show CTA to phone number page                   */}
      {/* ---------------------------------------------------------------- */}

      {status === "APPROVED" && !isMissingOptInImage && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="pt-6 pb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-green-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold">You are approved for SMS messaging</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  Your compliance application has been approved. You can now rent a phone number and start sending SMS campaigns.
                </p>
              </div>
              <Button asChild size="lg">
                <Link href="/settings/sms-marketing/phone-number">
                  Get a Phone Number
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isMissingOptInImage && (
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardContent className="pt-6 pb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-orange-500/20 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-orange-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold">Opt-in screenshot required</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  A new requirement has been added: you must upload a screenshot showing how your customers opt in to receive SMS messages.
                  Please upload the screenshot below and resubmit your application.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* SUSPENDED — contact support                                      */}
      {/* ---------------------------------------------------------------- */}

      {status === "SUSPENDED" && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="pt-6 pb-6 text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-lg font-semibold">SMS Access Suspended</h3>
            <p className="text-muted-foreground text-sm mt-2 max-w-md mx-auto">
              Your SMS messaging access has been suspended. Please contact support for more information and to resolve this issue.
            </p>
            <Button variant="outline" className="mt-4" asChild>
              <a href="mailto:info@flowsmartly.com">
                Contact Support
                <ExternalLink className="w-4 h-4 ml-2" />
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* PENDING_REVIEW — info only                                       */}
      {/* ---------------------------------------------------------------- */}

      {status === "PENDING_REVIEW" && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="pt-6 pb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Clock className="w-7 h-7 text-amber-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold">Your application is being reviewed</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  We typically review applications within 1-2 business days. You will be notified once a decision has been made.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Wizard Form (NOT_STARTED or REJECTED)                            */}
      {/* ---------------------------------------------------------------- */}

      {isFormEnabled && (
        <>
          {/* Step Progress Indicator */}
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
                        <span className="hidden sm:inline font-medium text-sm">
                          {step.label}
                        </span>
                      </button>
                      {index < STEPS.length - 1 && (
                        <ChevronRight className="w-5 h-5 mx-1 text-muted-foreground hidden sm:block" />
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
              >
                {/* ===== Step 1: Business Info ===== */}
                {currentStep === "business" && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Globe className="w-5 h-5 text-blue-500" />
                        Business Information
                      </CardTitle>
                      <CardDescription>
                        Provide your business details for compliance verification
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {brandPrefilled && (
                        <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20 flex items-center gap-3">
                          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                          <p className="text-sm text-muted-foreground">
                            Some fields were auto-filled from your{" "}
                            <Link href="/brand" className="text-brand-500 hover:underline font-medium">
                              Brand Identity
                            </Link>
                            . You can edit them if needed.
                          </p>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="businessName">Business Name *</Label>
                        <Input
                          id="businessName"
                          placeholder="e.g., Acme Corporation"
                          value={businessName}
                          onChange={(e) => setBusinessName(e.target.value)}
                          className="text-lg"
                        />
                        <p className="text-xs text-muted-foreground">
                          Your legal business name as registered
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="businessWebsite">Business Website URL *</Label>
                        <Input
                          id="businessWebsite"
                          type="url"
                          placeholder="https://www.example.com"
                          value={businessWebsite}
                          onChange={(e) => setBusinessWebsite(e.target.value)}
                          className="text-lg"
                        />
                        {businessWebsite && !isValidUrl(businessWebsite) && (
                          <p className="text-xs text-red-500 flex items-center gap-1">
                            <XCircle className="w-3 h-3" />
                            Please enter a valid URL starting with http:// or https://
                          </p>
                        )}
                        {businessWebsite && isValidUrl(businessWebsite) && (
                          <p className="text-xs text-green-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Valid URL format
                          </p>
                        )}
                      </div>

                      {/* Business Address */}
                      <div className="space-y-2">
                        <Label htmlFor="businessStreetAddress">Street Address *</Label>
                        <Input
                          id="businessStreetAddress"
                          placeholder="e.g., 123 Main Street, Suite 100"
                          value={businessStreetAddress}
                          onChange={(e) => setBusinessStreetAddress(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Required for toll-free number verification
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="businessCity">City *</Label>
                          <Input
                            id="businessCity"
                            placeholder="e.g., San Francisco"
                            value={businessCity}
                            onChange={(e) => setBusinessCity(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="businessState">State / Province *</Label>
                          <Input
                            id="businessState"
                            placeholder="e.g., CA"
                            value={businessStateProvinceRegion}
                            onChange={(e) => setBusinessStateProvinceRegion(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="businessPostalCode">Postal Code *</Label>
                          <Input
                            id="businessPostalCode"
                            placeholder="e.g., 94105"
                            value={businessPostalCode}
                            onChange={(e) => setBusinessPostalCode(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="businessCountry">Country</Label>
                          <Input
                            id="businessCountry"
                            placeholder="US"
                            value={businessCountry}
                            onChange={(e) => setBusinessCountry(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
                        <div className="flex items-start gap-3">
                          <Info className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                          <div className="text-sm text-muted-foreground">
                            <p className="font-medium text-foreground mb-1">Why do we need this?</p>
                            <p>
                              SMS regulations require business identification to prevent spam and
                              protect consumers. Your business name and address are required for
                              toll-free number verification with carriers.
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* ===== Step 2: Privacy & Terms ===== */}
                {currentStep === "privacy" && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-purple-500" />
                        Privacy & Terms
                      </CardTitle>
                      <CardDescription>
                        Links to your privacy policy and terms of service
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="privacyPolicy">Privacy Policy URL *</Label>
                        <div className="flex gap-2">
                          <Input
                            id="privacyPolicy"
                            type="url"
                            placeholder="https://www.example.com/privacy"
                            value={privacyPolicyUrl}
                            onChange={(e) => {
                              setPrivacyPolicyUrl(e.target.value);
                              setPrivacyUrlStatus("idle");
                            }}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            disabled={!isValidUrl(privacyPolicyUrl) || privacyUrlStatus === "checking"}
                            onClick={() => checkUrl(privacyPolicyUrl, setPrivacyUrlStatus)}
                          >
                            {privacyUrlStatus === "checking" ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : privacyUrlStatus === "ok" ? (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            ) : privacyUrlStatus === "error" ? (
                              <XCircle className="w-4 h-4 text-red-500" />
                            ) : (
                              <>
                                <ExternalLink className="w-4 h-4 mr-1" />
                                Check URL
                              </>
                            )}
                          </Button>
                        </div>
                        {privacyUrlStatus === "ok" && (
                          <p className="text-xs text-green-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            URL appears to be accessible
                          </p>
                        )}
                        {privacyUrlStatus === "error" && (
                          <p className="text-xs text-red-500 flex items-center gap-1">
                            <XCircle className="w-3 h-3" />
                            Could not reach this URL. Make sure it is publicly accessible.
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Your website must have a privacy policy that covers SMS data handling
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="termsOfService">Terms of Service URL (optional)</Label>
                        <div className="flex gap-2">
                          <Input
                            id="termsOfService"
                            type="url"
                            placeholder="https://www.example.com/terms"
                            value={termsOfServiceUrl}
                            onChange={(e) => {
                              setTermsOfServiceUrl(e.target.value);
                              setTermsUrlStatus("idle");
                            }}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            disabled={!isValidUrl(termsOfServiceUrl) || termsUrlStatus === "checking"}
                            onClick={() => checkUrl(termsOfServiceUrl, setTermsUrlStatus)}
                          >
                            {termsUrlStatus === "checking" ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : termsUrlStatus === "ok" ? (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            ) : termsUrlStatus === "error" ? (
                              <XCircle className="w-4 h-4 text-red-500" />
                            ) : (
                              <>
                                <ExternalLink className="w-4 h-4 mr-1" />
                                Check URL
                              </>
                            )}
                          </Button>
                        </div>
                        {termsUrlStatus === "ok" && (
                          <p className="text-xs text-green-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            URL appears to be accessible
                          </p>
                        )}
                        {termsUrlStatus === "error" && (
                          <p className="text-xs text-red-500 flex items-center gap-1">
                            <XCircle className="w-3 h-3" />
                            Could not reach this URL. Make sure it is publicly accessible.
                          </p>
                        )}
                      </div>

                      {/* Opt-In Screenshot Upload */}
                      <div className="space-y-2">
                        <Label>SMS Opt-In Screenshot *</Label>
                        <p className="text-xs text-muted-foreground">
                          Upload a screenshot of your website or app showing how customers consent to receive SMS messages (e.g., a signup form with an SMS checkbox).
                        </p>

                        <MediaUploader
                          value={smsOptInImageUrl ? [smsOptInImageUrl] : []}
                          onChange={(urls) => setSmsOptInImageUrl(urls[0] || "")}
                          accept="image/png,image/jpeg,image/jpg,image/webp"
                          maxSize={5 * 1024 * 1024}
                          filterTypes={["image"]}
                          variant="medium"
                          placeholder="Upload proof"
                          libraryTitle="Select Opt-in Proof"
                        />
                      </div>

                      <div className="p-4 rounded-lg bg-purple-500/5 border border-purple-500/20">
                        <div className="flex items-start gap-3">
                          <Shield className="w-5 h-5 text-purple-500 mt-0.5 shrink-0" />
                          <div className="text-sm text-muted-foreground">
                            <p className="font-medium text-foreground mb-1">Privacy Policy Requirements</p>
                            <ul className="list-disc list-inside space-y-1 mt-2">
                              <li>How phone numbers are collected</li>
                              <li>How SMS data is used and stored</li>
                              <li>Third-party data sharing disclosures</li>
                              <li>Opt-out instructions for subscribers</li>
                              <li>Screenshot of your SMS opt-in form (required for toll-free verification)</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* ===== Step 3: Use Case ===== */}
                {currentStep === "usecase" && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-green-500" />
                        Use Case
                      </CardTitle>
                      <CardDescription>
                        Tell us how you plan to use SMS messaging
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="useCase">Primary Use Case *</Label>
                        <Select value={useCase} onValueChange={setUseCase}>
                          <SelectTrigger id="useCase">
                            <SelectValue placeholder="Select a use case" />
                          </SelectTrigger>
                          <SelectContent>
                            {USE_CASE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="useCaseDesc">Description *</Label>
                          <span
                            className={`text-xs ${
                              useCaseDescription.length < 50
                                ? "text-red-500"
                                : "text-muted-foreground"
                            }`}
                          >
                            {useCaseDescription.length}/50 min characters
                          </span>
                        </div>
                        <Textarea
                          id="useCaseDesc"
                          placeholder="Describe how you plan to use SMS messaging. Include details about message frequency, audience type, and the value your messages provide to recipients..."
                          value={useCaseDescription}
                          onChange={(e) => setUseCaseDescription(e.target.value)}
                          rows={5}
                          className="resize-none"
                        />
                        {useCaseDescription.length > 0 && useCaseDescription.length < 50 && (
                          <p className="text-xs text-red-500 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Please provide at least 50 characters ({50 - useCaseDescription.length} more needed)
                          </p>
                        )}
                      </div>

                      <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/20">
                        <div className="flex items-start gap-3">
                          <Info className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                          <div className="text-sm text-muted-foreground">
                            <p className="font-medium text-foreground mb-1">Tips for a strong description</p>
                            <ul className="list-disc list-inside space-y-1 mt-2">
                              <li>Explain the type of messages you will send</li>
                              <li>Describe your target audience</li>
                              <li>Mention expected message frequency (e.g., 2-4 per month)</li>
                              <li>Clarify how recipients will opt in to receive messages</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* ===== Step 4: Sample Messages ===== */}
                {currentStep === "samples" && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Send className="w-5 h-5 text-orange-500" />
                        Sample Messages
                      </CardTitle>
                      <CardDescription>
                        Provide 2-5 examples of SMS messages you plan to send
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {sampleMessages.map((message, index) => (
                        <div key={index} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Sample Message {index + 1} *</Label>
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-xs ${
                                  message.length > 280
                                    ? "text-red-500"
                                    : message.length > 160
                                    ? "text-yellow-500"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {message.length}/320
                              </span>
                              {sampleMessages.length > 2 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                                  onClick={() => removeSampleMessage(index)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                          <Textarea
                            placeholder={
                              index === 0
                                ? "e.g., Hi {{firstName}}, don't miss our exclusive 20% off sale this weekend! Shop now at example.com/sale. Reply STOP to unsubscribe."
                                : index === 1
                                ? "e.g., {{businessName}}: Your order #{{orderId}} has shipped! Track it here: example.com/track. Reply STOP to opt out."
                                : "Enter another sample message..."
                            }
                            value={message}
                            onChange={(e) => updateSampleMessage(index, e.target.value)}
                            rows={3}
                            className="resize-none"
                            maxLength={320}
                          />
                        </div>
                      ))}

                      {sampleMessages.length < 5 && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={addSampleMessage}
                          className="w-full border-dashed"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Sample Message ({sampleMessages.length}/5)
                        </Button>
                      )}

                      <div className="p-4 rounded-lg bg-orange-500/5 border border-orange-500/20">
                        <div className="flex items-start gap-3">
                          <Info className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" />
                          <div className="text-sm text-muted-foreground">
                            <p className="font-medium text-foreground mb-1">Best practices for sample messages</p>
                            <ul className="list-disc list-inside space-y-1 mt-2">
                              <li>Include your business name in each message</li>
                              <li>Always include opt-out language (e.g., &quot;Reply STOP to unsubscribe&quot;)</li>
                              <li>Keep messages concise and to the point</li>
                              <li>Show a variety of message types you plan to send</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* ===== Step 5: Review & Submit ===== */}
                {currentStep === "review" && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-brand-500" />
                        Review & Submit
                      </CardTitle>
                      <CardDescription>
                        Review your compliance application before submitting
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Business Info Summary */}
                      <div className="p-4 rounded-lg border bg-muted/30">
                        <div className="flex items-center gap-2 mb-3">
                          <Globe className="w-4 h-4 text-blue-500" />
                          <h4 className="font-semibold text-sm">Business Information</h4>
                          <button
                            onClick={() => setCurrentStep("business")}
                            className="ml-auto text-xs text-brand-500 hover:underline"
                          >
                            Edit
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Business Name</p>
                            <p className="font-medium">{businessName}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Website</p>
                            <a
                              href={businessWebsite}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-brand-500 hover:underline inline-flex items-center gap-1"
                            >
                              {businessWebsite}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                          <div className="col-span-2">
                            <p className="text-muted-foreground">Address</p>
                            <p className="font-medium">
                              {businessStreetAddress}, {businessCity}, {businessStateProvinceRegion} {businessPostalCode}, {businessCountry}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Privacy & Terms Summary */}
                      <div className="p-4 rounded-lg border bg-muted/30">
                        <div className="flex items-center gap-2 mb-3">
                          <FileText className="w-4 h-4 text-purple-500" />
                          <h4 className="font-semibold text-sm">Privacy & Terms</h4>
                          <button
                            onClick={() => setCurrentStep("privacy")}
                            className="ml-auto text-xs text-brand-500 hover:underline"
                          >
                            Edit
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Privacy Policy</p>
                            <a
                              href={privacyPolicyUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-brand-500 hover:underline inline-flex items-center gap-1 break-all"
                            >
                              {privacyPolicyUrl}
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Terms of Service</p>
                            {termsOfServiceUrl ? (
                              <a
                                href={termsOfServiceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-brand-500 hover:underline inline-flex items-center gap-1 break-all"
                              >
                                {termsOfServiceUrl}
                                <ExternalLink className="w-3 h-3 shrink-0" />
                              </a>
                            ) : (
                              <p className="font-medium text-muted-foreground italic">Not provided</p>
                            )}
                          </div>
                        </div>
                        {smsOptInImageUrl && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-muted-foreground text-sm mb-2">Opt-In Screenshot</p>
                            <img
                              src={smsOptInImageUrl}
                              alt="Opt-in screenshot"
                              className="w-32 h-auto rounded-lg border"
                            />
                          </div>
                        )}
                      </div>

                      {/* Use Case Summary */}
                      <div className="p-4 rounded-lg border bg-muted/30">
                        <div className="flex items-center gap-2 mb-3">
                          <MessageSquare className="w-4 h-4 text-green-500" />
                          <h4 className="font-semibold text-sm">Use Case</h4>
                          <button
                            onClick={() => setCurrentStep("usecase")}
                            className="ml-auto text-xs text-brand-500 hover:underline"
                          >
                            Edit
                          </button>
                        </div>
                        <div className="text-sm space-y-2">
                          <div>
                            <p className="text-muted-foreground">Primary Use Case</p>
                            <Badge variant="secondary" className="mt-1">
                              {USE_CASE_OPTIONS.find((o) => o.value === useCase)?.label || useCase}
                            </Badge>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Description</p>
                            <p className="font-medium mt-1">{useCaseDescription}</p>
                          </div>
                        </div>
                      </div>

                      {/* Sample Messages Summary */}
                      <div className="p-4 rounded-lg border bg-muted/30">
                        <div className="flex items-center gap-2 mb-3">
                          <Send className="w-4 h-4 text-orange-500" />
                          <h4 className="font-semibold text-sm">
                            Sample Messages ({sampleMessages.filter((m) => m.trim()).length})
                          </h4>
                          <button
                            onClick={() => setCurrentStep("samples")}
                            className="ml-auto text-xs text-brand-500 hover:underline"
                          >
                            Edit
                          </button>
                        </div>
                        <div className="space-y-2">
                          {sampleMessages
                            .filter((m) => m.trim())
                            .map((message, index) => (
                              <div
                                key={index}
                                className="p-3 rounded-lg bg-background border text-sm"
                              >
                                <p className="text-xs text-muted-foreground mb-1">
                                  Message {index + 1}
                                </p>
                                <p>{message}</p>
                              </div>
                            ))}
                        </div>
                      </div>

                      {/* Submit */}
                      <div className="pt-2">
                        <Button
                          size="lg"
                          className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
                          disabled={isSubmitting}
                          onClick={handleSubmit}
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Submitting Application...
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4 mr-2" />
                              Submit Compliance Application
                            </>
                          )}
                        </Button>
                        <p className="text-xs text-center text-muted-foreground mt-3">
                          By submitting, you agree to comply with all applicable SMS regulations
                          including TCPA, CTIA guidelines, and carrier policies.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation Buttons */}
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
        </>
      )}
    </motion.div>
  );
}

// ------------------------------------------------------------------
// StatusBanner sub-component
// ------------------------------------------------------------------

function StatusBanner({
  status,
  complianceNotes,
  isMissingOptInImage,
}: {
  status: ComplianceStatus;
  complianceNotes?: string | null;
  isMissingOptInImage?: boolean;
}) {
  const config: Record<
    ComplianceStatus,
    {
      label: string;
      variant: "default" | "secondary" | "destructive" | "outline";
      className: string;
      icon: React.ElementType;
      iconColor: string;
    }
  > = {
    NOT_STARTED: {
      label: "Not Started",
      variant: "secondary",
      className: "bg-gray-500/10 text-gray-600 border-gray-500/30",
      icon: Shield,
      iconColor: "text-gray-500",
    },
    PENDING_REVIEW: {
      label: "Under Review",
      variant: "outline",
      className: "bg-amber-500/10 text-amber-600 border-amber-500/30",
      icon: Clock,
      iconColor: "text-amber-500",
    },
    APPROVED: {
      label: "Approved",
      variant: "default",
      className: "bg-green-500/10 text-green-600 border-green-500/30",
      icon: CheckCircle2,
      iconColor: "text-green-500",
    },
    REJECTED: {
      label: "Needs Revision",
      variant: "destructive",
      className: "bg-red-500/10 text-red-600 border-red-500/30",
      icon: AlertTriangle,
      iconColor: "text-red-500",
    },
    SUSPENDED: {
      label: "Suspended",
      variant: "destructive",
      className: "bg-red-500/10 text-red-600 border-red-500/30",
      icon: XCircle,
      iconColor: "text-red-500",
    },
  };

  const c = isMissingOptInImage
    ? {
        label: "Update Required",
        variant: "outline" as const,
        className: "bg-orange-500/10 text-orange-600 border-orange-500/30",
        icon: AlertTriangle,
        iconColor: "text-orange-500",
      }
    : config[status];
  const StatusIcon = c.icon;

  return (
    <Card className={`border ${c.className.split(" ").find((cls) => cls.startsWith("border-")) || ""}`}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-3">
          <StatusIcon className={`w-5 h-5 ${c.iconColor}`} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">Compliance Status:</span>
              <Badge className={c.className}>{c.label}</Badge>
            </div>
            {status === "REJECTED" && complianceNotes && (
              <div className="mt-2 p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-sm">
                <p className="font-medium text-red-600 mb-1 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Admin Notes:
                </p>
                <p className="text-muted-foreground">{complianceNotes}</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
