"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  MessageSquare,
  Phone,
  Check,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Send,
  Trash2,
  DollarSign,
  Zap,
  Shield,
  ShieldCheck,
  ShieldX,
  Clock,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface SmsConfig {
  smsEnabled: boolean;
  smsPhoneNumber: string | null;
  smsPhoneNumberSid: string | null;
  smsVerified: boolean;
  smsPricePerSend: number;
  smsMonthlyLimit: number;
  smsSentThisMonth: number;
  complianceStatus: string;
}

interface TollfreeVerification {
  hasVerification: boolean;
  verificationSid?: string;
  status: string | null;
  rejectionReason?: string | null;
}

interface A2pStatus {
  hasRegistration: boolean;
  brandSid?: string;
  brandStatus: string | null;
  brandFailureReason?: string | null;
  campaignSid?: string | null;
  campaignStatus: string | null;
  campaignFailureReason?: string | null;
  messagingServiceSid?: string | null;
  isApproved: boolean;
}

interface TwilioDetails {
  sid: string;
  phoneNumber: string;
  friendlyName: string;
  dateCreated: string;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
  };
}

// Pricing constants (should match backend)
const PHONE_NUMBER_RENTAL_COST = 500; // $5.00/month in cents
const SMS_COST = 5; // $0.05 per SMS in cents
const MMS_COST = 10; // $0.10 per MMS in cents

export default function SmsMarketingSettingsPage() {
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<SmsConfig | null>(null);
  const [twilioDetails, setTwilioDetails] = useState<TwilioDetails | null>(null);
  const [releasingNumber, setReleasingNumber] = useState(false);
  const [tollfreeVerification, setTollfreeVerification] = useState<TollfreeVerification | null>(null);
  const [submittingVerification, setSubmittingVerification] = useState(false);
  const [a2pStatus, setA2pStatus] = useState<A2pStatus | null>(null);
  const [submittingA2p, setSubmittingA2p] = useState(false);
  const [refreshingA2p, setRefreshingA2p] = useState(false);

  // Fetch SMS config + compliance status + toll-free verification
  const fetchConfig = useCallback(async () => {
    try {
      setIsLoading(true);
      const [numbersRes, complianceRes, verifyRes, a2pRes] = await Promise.all([
        fetch("/api/sms/numbers?action=current"),
        fetch("/api/sms/compliance"),
        fetch("/api/sms/numbers/verify"),
        fetch("/api/sms/numbers/a2p-status"),
      ]);
      const data = await numbersRes.json();
      const complianceData = complianceRes.ok ? await complianceRes.json() : null;
      const verifyData = verifyRes.ok ? await verifyRes.json() : null;
      const rawComplianceStatus = complianceData?.success
        ? complianceData.data.status
        : "NOT_STARTED";
      // If compliance is APPROVED but the opt-in screenshot is missing, override to ACTION_REQUIRED
      const hasOptInImage = !!complianceData?.data?.compliance?.smsOptInImageUrl;
      const complianceStatus =
        rawComplianceStatus === "APPROVED" && !hasOptInImage
          ? "ACTION_REQUIRED"
          : rawComplianceStatus;

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to fetch config");
      }

      if (data.data.hasNumber) {
        setConfig({
          smsEnabled: data.data.enabled,
          smsPhoneNumber: data.data.phoneNumber,
          smsPhoneNumberSid: data.data.sid,
          smsVerified: data.data.verified,
          smsPricePerSend: data.data.pricePerSend || SMS_COST,
          smsMonthlyLimit: data.data.monthlyLimit || 10000,
          smsSentThisMonth: 0,
          complianceStatus,
        });
        if (data.data.twilioDetails) {
          setTwilioDetails(data.data.twilioDetails);
        }
      } else {
        setConfig({
          smsEnabled: false,
          smsPhoneNumber: null,
          smsPhoneNumberSid: null,
          smsVerified: false,
          smsPricePerSend: SMS_COST,
          smsMonthlyLimit: 10000,
          smsSentThisMonth: 0,
          complianceStatus,
        });
      }

      // Set toll-free verification status
      if (verifyData?.success) {
        setTollfreeVerification(verifyData.data);
      }

      // Set A2P 10DLC status
      const a2pData = a2pRes.ok ? await a2pRes.json() : null;
      if (a2pData?.success) {
        setA2pStatus(a2pData.data);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load config");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Release phone number
  const handleReleaseNumber = async () => {
    if (!confirm("Are you sure you want to release this phone number? This action cannot be undone.")) {
      return;
    }

    setReleasingNumber(true);
    try {
      const response = await fetch("/api/sms/numbers", {
        method: "DELETE",
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to release number");
      }

      toast({ title: "Phone number released successfully" });
      fetchConfig();
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to release number",
        variant: "destructive",
      });
    } finally {
      setReleasingNumber(false);
    }
  };

  // Submit toll-free verification manually
  const handleSubmitVerification = async () => {
    setSubmittingVerification(true);
    try {
      const response = await fetch("/api/sms/numbers/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error?.message || "Failed to submit verification");
      }
      toast({
        title: "Toll-free verification submitted!",
        description: data.data.message,
      });
      fetchConfig();
    } catch (err) {
      toast({
        title: "Verification submission failed",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setSubmittingVerification(false);
    }
  };

  // Submit A2P 10DLC registration manually
  const handleSubmitA2p = async () => {
    setSubmittingA2p(true);
    try {
      const response = await fetch("/api/sms/numbers/a2p-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error?.message || "Failed to submit A2P registration");
      }
      toast({
        title: "A2P 10DLC registration submitted!",
        description: data.message,
      });
      fetchConfig();
    } catch (err) {
      toast({
        title: "A2P registration failed",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setSubmittingA2p(false);
    }
  };

  // Refresh A2P status from Twilio
  const handleRefreshA2p = async () => {
    setRefreshingA2p(true);
    try {
      const res = await fetch("/api/sms/numbers/a2p-status");
      const data = await res.json();
      if (data.success) {
        setA2pStatus(data.data);
        toast({ title: "A2P status refreshed" });
      }
    } catch {
      toast({ title: "Failed to refresh A2P status", variant: "destructive" });
    } finally {
      setRefreshingA2p(false);
    }
  };

  if (error && !config) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={fetchConfig} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 flex flex-col space-y-6 p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/settings">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              SMS Marketing Settings
            </h1>
            <p className="text-muted-foreground">
              Manage your SMS phone number and messaging
            </p>
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link href="/sms-marketing">
            <Send className="w-4 h-4 mr-2" />
            View Campaigns
          </Link>
        </Button>
      </div>

      {/* Quick Stats */}
      {!isLoading && config && (() => {
        // Compute true "ready to send" state
        const isTollFree = config.smsPhoneNumber ? /^\+1(800|833|844|855|866|877|888)/.test(config.smsPhoneNumber) : false;
        const registrationReady = isTollFree
          ? (tollfreeVerification?.status === "TWILIO_APPROVED" || tollfreeVerification?.status === "APPROVED")
          : a2pStatus?.isApproved === true;
        const isReady = config.smsEnabled && config.complianceStatus === "APPROVED" && registrationReady;
        const isPending = config.smsEnabled && !registrationReady && (
          isTollFree
            ? tollfreeVerification?.hasVerification && tollfreeVerification.status !== "TWILIO_REJECTED"
            : a2pStatus?.hasRegistration && a2pStatus.brandStatus !== "FAILED" && a2pStatus.campaignStatus !== "FAILED"
        );

        let statusLabel: string;
        let statusColor: string;
        let statusBg: string;
        let StatusIcon: React.ElementType;

        if (isReady) {
          statusLabel = "Ready";
          statusColor = "bg-green-500";
          statusBg = "bg-green-500/10";
          StatusIcon = Check;
        } else if (isPending) {
          statusLabel = "Pending Approval";
          statusColor = "bg-yellow-500 text-yellow-950";
          statusBg = "bg-yellow-500/10";
          StatusIcon = Clock;
        } else if (config.smsEnabled) {
          statusLabel = "Action Required";
          statusColor = "bg-orange-500";
          statusBg = "bg-orange-500/10";
          StatusIcon = AlertTriangle;
        } else {
          statusLabel = "Not Set Up";
          statusColor = "";
          statusBg = "bg-gray-500/10";
          StatusIcon = Phone;
        }

        return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="shadow-none">
            <CardContent className="p-3">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-md ${statusBg} flex items-center justify-center shrink-0`}>
                  <StatusIcon className={`w-4 h-4 ${isReady ? "text-green-500" : isPending ? "text-yellow-500" : config.smsEnabled ? "text-orange-500" : "text-gray-500"}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={isReady ? "default" : "secondary"} className={`text-[10px] px-1.5 py-0 ${statusColor}`}>
                    {statusLabel}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardContent className="p-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Phone className="w-4 h-4 text-blue-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="text-sm font-mono font-semibold truncate">
                    {config.smsPhoneNumber || "None"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardContent className="p-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-purple-500/10 flex items-center justify-center shrink-0">
                  <Send className="w-4 h-4 text-purple-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Sent</p>
                  <p className="text-sm font-semibold">{config.smsSentThisMonth.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardContent className="p-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-orange-500/10 flex items-center justify-center shrink-0">
                  <DollarSign className="w-4 h-4 text-orange-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Per SMS</p>
                  <p className="text-sm font-semibold">${(SMS_COST / 100).toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        );
      })()}

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-64" />
        </div>
      ) : (() => {
        // Compute status variables once
        const isTollFree = config?.smsPhoneNumber ? /^\+1(800|833|844|855|866|877|888)/.test(config.smsPhoneNumber) : false;
        const hasNumber = !!config?.smsPhoneNumber;
        const regOk = isTollFree
          ? (tollfreeVerification?.status === "TWILIO_APPROVED" || tollfreeVerification?.status === "APPROVED")
          : a2pStatus?.isApproved === true;
        const regFailed = isTollFree
          ? (tollfreeVerification?.status === "TWILIO_REJECTED")
          : (a2pStatus?.brandStatus === "FAILED" || a2pStatus?.campaignStatus === "FAILED");
        const regPending = hasNumber && !regOk && !regFailed && (
          isTollFree ? !!tollfreeVerification?.hasVerification : !!a2pStatus?.hasRegistration
        );
        const regNotStarted = hasNumber && !regOk && !regFailed && !regPending;
        const complianceOk = config?.complianceStatus === "APPROVED";

        return (
        <>
          {/* ── Setup Progress ── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="w-5 h-5" />
                Setup Progress
              </CardTitle>
              <CardDescription>
                Complete each step to start sending SMS campaigns
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-0">
              {/* Step 1: Compliance */}
              <div className={`flex items-start gap-4 p-4 rounded-lg ${
                complianceOk ? "bg-green-500/5" :
                config?.complianceStatus === "REJECTED" || config?.complianceStatus === "SUSPENDED" ? "bg-red-500/5" :
                config?.complianceStatus === "PENDING_REVIEW" ? "bg-yellow-500/5" :
                config?.complianceStatus === "ACTION_REQUIRED" ? "bg-orange-500/5" :
                "bg-muted/30"
              }`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  complianceOk ? "bg-green-500 text-white" :
                  config?.complianceStatus === "REJECTED" || config?.complianceStatus === "SUSPENDED" ? "bg-red-500 text-white" :
                  config?.complianceStatus === "PENDING_REVIEW" ? "bg-yellow-500 text-yellow-950" :
                  config?.complianceStatus === "ACTION_REQUIRED" ? "bg-orange-500 text-white" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {complianceOk ? <Check className="w-4 h-4" /> :
                   config?.complianceStatus === "REJECTED" || config?.complianceStatus === "SUSPENDED" ? <ShieldX className="w-4 h-4" /> :
                   config?.complianceStatus === "PENDING_REVIEW" ? <Clock className="w-4 h-4" /> :
                   <span className="text-sm font-bold">1</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium">SMS Compliance</h4>
                    <Badge variant={complianceOk ? "default" : config?.complianceStatus === "REJECTED" || config?.complianceStatus === "SUSPENDED" ? "destructive" : "secondary"}
                      className={
                        complianceOk ? "bg-green-500" :
                        config?.complianceStatus === "PENDING_REVIEW" ? "bg-yellow-500 text-yellow-950" :
                        config?.complianceStatus === "ACTION_REQUIRED" ? "bg-orange-500 text-white" :
                        ""
                      }>
                      {config?.complianceStatus === "APPROVED" ? "Approved" :
                       config?.complianceStatus === "PENDING_REVIEW" ? "Under Review" :
                       config?.complianceStatus === "ACTION_REQUIRED" ? "Update Required" :
                       config?.complianceStatus === "REJECTED" ? "Needs Revision" :
                       config?.complianceStatus === "SUSPENDED" ? "Suspended" :
                       "Not Started"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {complianceOk ? "Business compliance verified." :
                     config?.complianceStatus === "ACTION_REQUIRED" ? "Missing opt-in screenshot. Update your application." :
                     config?.complianceStatus === "PENDING_REVIEW" ? "Under review. We'll notify you once processed." :
                     config?.complianceStatus === "REJECTED" ? "Needs revision. Check reviewer notes and resubmit." :
                     config?.complianceStatus === "SUSPENDED" ? "SMS access suspended. Contact support." :
                     "Complete compliance verification to proceed."}
                  </p>
                </div>
                {config?.complianceStatus !== "APPROVED" && config?.complianceStatus !== "SUSPENDED" && (
                  <Button asChild size="sm" variant={config?.complianceStatus === "REJECTED" ? "destructive" : "default"}
                    className={`shrink-0 ${config?.complianceStatus === "ACTION_REQUIRED" ? "bg-orange-600 hover:bg-orange-700" : ""}`}>
                    <Link href="/settings/sms-marketing/compliance">
                      {config?.complianceStatus === "NOT_STARTED" ? "Start" :
                       config?.complianceStatus === "REJECTED" ? "Revise" :
                       config?.complianceStatus === "ACTION_REQUIRED" ? "Update" :
                       "View"}
                    </Link>
                  </Button>
                )}
              </div>

              <div className="ml-[26px] w-px h-3 bg-border" />

              {/* Step 2: Phone Number */}
              <div className={`flex items-start gap-4 p-4 rounded-lg ${
                hasNumber ? "bg-green-500/5" : "bg-muted/30"
              }`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  hasNumber ? "bg-green-500 text-white" :
                  complianceOk ? "bg-muted text-muted-foreground ring-2 ring-primary/20" :
                  "bg-muted text-muted-foreground/50"
                }`}>
                  {hasNumber ? <Check className="w-4 h-4" /> : <span className="text-sm font-bold">2</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium">Phone Number</h4>
                    {hasNumber ? (
                      <>
                        <Badge variant="default" className="bg-green-500">Acquired</Badge>
                        <Badge variant="outline" className="font-mono text-xs">{config?.smsPhoneNumber}</Badge>
                        <Badge variant="outline" className="text-xs">{isTollFree ? "Toll-Free" : "Local"}</Badge>
                      </>
                    ) : (
                      <Badge variant="secondary">Not Rented</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {hasNumber ? `Dedicated number for your SMS campaigns.` :
                     complianceOk ? "Rent a phone number to start sending." :
                     "Complete compliance first, then rent a number."}
                  </p>
                </div>
                {!hasNumber && complianceOk && (
                  <Button asChild size="sm" className="shrink-0">
                    <Link href="/settings/sms-marketing/phone-number">
                      Get Number
                    </Link>
                  </Button>
                )}
              </div>

              <div className="ml-[26px] w-px h-3 bg-border" />

              {/* Step 3: Registration (A2P or Toll-Free) */}
              <div className={`flex items-start gap-4 p-4 rounded-lg ${
                regOk ? "bg-green-500/5" :
                regFailed ? "bg-red-500/5" :
                regPending ? "bg-yellow-500/5" :
                regNotStarted ? "bg-orange-500/5" :
                "bg-muted/30"
              }`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  regOk ? "bg-green-500 text-white" :
                  regFailed ? "bg-red-500 text-white" :
                  regPending ? "bg-yellow-500 text-yellow-950" :
                  hasNumber ? "bg-muted text-muted-foreground ring-2 ring-primary/20" :
                  "bg-muted text-muted-foreground/50"
                }`}>
                  {regOk ? <Check className="w-4 h-4" /> :
                   regFailed ? <ShieldX className="w-4 h-4" /> :
                   regPending ? <Loader2 className="w-4 h-4 animate-spin" /> :
                   <span className="text-sm font-bold">3</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium">{isTollFree ? "Toll-Free Verification" : "A2P 10DLC Registration"}</h4>
                    {regOk ? (
                      <Badge variant="default" className="bg-green-500">
                        {isTollFree ? "Verified" : "Approved"}
                      </Badge>
                    ) : regFailed ? (
                      <Badge variant="destructive">
                        {isTollFree ? "Rejected" :
                         a2pStatus?.brandStatus === "FAILED" ? "Brand Failed" : "Campaign Failed"}
                      </Badge>
                    ) : regPending ? (
                      <Badge variant="secondary" className="bg-yellow-500 text-yellow-950">
                        {isTollFree
                          ? (tollfreeVerification?.status === "IN_REVIEW" ? "In Review" : "Pending Review")
                          : (a2pStatus?.brandStatus === "APPROVED" ? "Campaign In Review" :
                             a2pStatus?.brandStatus === "IN_REVIEW" ? "Brand In Review" : "Pending")}
                      </Badge>
                    ) : regNotStarted ? (
                      <Badge variant="secondary" className="bg-orange-500 text-white">Not Started</Badge>
                    ) : (
                      <Badge variant="secondary">Waiting</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {regOk ? (isTollFree
                      ? "Toll-free number verified. Ready to send messages."
                      : "A2P 10DLC approved. Ready to send messages."
                    ) : regFailed ? (isTollFree
                      ? `Verification rejected${tollfreeVerification?.rejectionReason ? `: ${tollfreeVerification.rejectionReason}` : ". Review info and resubmit."}`
                      : a2pStatus?.brandStatus === "FAILED"
                        ? `Brand failed${a2pStatus.brandFailureReason ? `: ${a2pStatus.brandFailureReason}` : ". Review info and retry."}`
                        : `Campaign failed${a2pStatus?.campaignFailureReason ? `: ${a2pStatus.campaignFailureReason}` : ". Retry registration."}`
                    ) : regPending ? (isTollFree
                      ? "Carrier review typically takes 1-5 business days."
                      : "Carrier review typically takes 1-7 business days."
                    ) : regNotStarted ? (isTollFree
                      ? "Submit verification to enable messaging."
                      : "Submit A2P registration to enable messaging."
                    ) : "Rent a phone number first."}
                  </p>

                  {/* A2P Brand + Campaign breakdown */}
                  {!isTollFree && a2pStatus?.hasRegistration && !a2pStatus.isApproved && (
                    <div className="mt-2 flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Brand:</span>
                        <Badge variant="outline" className={
                          a2pStatus.brandStatus === "APPROVED" ? "border-green-500 text-green-600" :
                          a2pStatus.brandStatus === "FAILED" ? "border-red-500 text-red-600" :
                          "border-yellow-500 text-yellow-600"
                        }>
                          {a2pStatus.brandStatus || "N/A"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Campaign:</span>
                        <Badge variant="outline" className={
                          a2pStatus.campaignStatus === "VERIFIED" || a2pStatus.campaignStatus === "SUCCESSFUL" ? "border-green-500 text-green-600" :
                          a2pStatus.campaignStatus === "FAILED" ? "border-red-500 text-red-600" :
                          a2pStatus.campaignStatus ? "border-yellow-500 text-yellow-600" :
                          ""
                        }>
                          {a2pStatus.campaignStatus || "Waiting for Brand"}
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Toll-free: submit verification */}
                  {isTollFree && !tollfreeVerification?.hasVerification && hasNumber && (
                    <Button onClick={handleSubmitVerification} disabled={submittingVerification} size="sm"
                      className="bg-orange-600 hover:bg-orange-700">
                      {submittingVerification && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                      Submit
                    </Button>
                  )}
                  {/* A2P: submit registration */}
                  {!isTollFree && !a2pStatus?.hasRegistration && hasNumber && (
                    <Button onClick={handleSubmitA2p} disabled={submittingA2p} size="sm"
                      className="bg-orange-600 hover:bg-orange-700">
                      {submittingA2p && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                      Submit
                    </Button>
                  )}
                  {/* Retry on failure */}
                  {regFailed && (
                    <Button onClick={isTollFree ? handleSubmitVerification : handleSubmitA2p}
                      disabled={isTollFree ? submittingVerification : submittingA2p}
                      size="sm" variant="destructive">
                      {(isTollFree ? submittingVerification : submittingA2p) && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                      Retry
                    </Button>
                  )}
                  {/* Refresh while pending */}
                  {regPending && (
                    <Button variant="outline" size="sm" onClick={handleRefreshA2p} disabled={refreshingA2p}>
                      <RefreshCw className={`w-4 h-4 ${refreshingA2p ? "animate-spin" : ""}`} />
                    </Button>
                  )}
                </div>
              </div>

              <div className="ml-[26px] w-px h-3 bg-border" />

              {/* Step 4: Ready */}
              <div className={`flex items-start gap-4 p-4 rounded-lg ${
                complianceOk && hasNumber && regOk ? "bg-green-500/5" : "bg-muted/30"
              }`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  complianceOk && hasNumber && regOk ? "bg-green-500 text-white" :
                  "bg-muted text-muted-foreground/50"
                }`}>
                  {complianceOk && hasNumber && regOk ? <Check className="w-4 h-4" /> : <span className="text-sm font-bold">4</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">Ready to Send</h4>
                    {complianceOk && hasNumber && regOk ? (
                      <Badge variant="default" className="bg-green-500">All Set</Badge>
                    ) : (
                      <Badge variant="secondary">Waiting</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {complianceOk && hasNumber && regOk
                      ? "You can send SMS/MMS campaigns to your audience."
                      : "Complete the steps above to start sending campaigns."}
                  </p>
                </div>
                {complianceOk && hasNumber && regOk && (
                  <Button asChild size="sm" className="shrink-0 bg-green-600 hover:bg-green-700">
                    <Link href="/sms-marketing/create">
                      <Send className="w-4 h-4 mr-1" />
                      Send Campaign
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Phone Number Details ── */}
          {hasNumber && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Phone className="w-5 h-5" />
                  Phone Number Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`p-5 rounded-xl border ${
                  regOk
                    ? "bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/20"
                    : "bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/20"
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${regOk ? "bg-green-500/20" : "bg-yellow-500/20"}`}>
                        <Phone className={`w-7 h-7 ${regOk ? "text-green-500" : "text-yellow-500"}`} />
                      </div>
                      <div>
                        <p className="text-2xl font-mono font-bold">{config?.smsPhoneNumber}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {regOk ? (
                            <Badge variant="default" className="bg-green-500">
                              <Check className="w-3 h-3 mr-1" /> Ready to Send
                            </Badge>
                          ) : regFailed ? (
                            <Badge variant="destructive">Registration Failed</Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-yellow-500 text-yellow-950">
                              <Clock className="w-3 h-3 mr-1" /> Pending Approval
                            </Badge>
                          )}
                          <Badge variant="outline">{isTollFree ? "Toll-Free" : "Local"}</Badge>
                          {twilioDetails?.capabilities.mms && <Badge variant="outline">MMS</Badge>}
                          {twilioDetails?.capabilities.voice && <Badge variant="outline">Voice</Badge>}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleReleaseNumber}
                      disabled={releasingNumber}
                      className="text-red-500 border-red-500/50 hover:bg-red-500/10"
                    >
                      {releasingNumber ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Trash2 className="w-4 h-4 mr-2" />
                      )}
                      Release
                    </Button>
                  </div>

                  {twilioDetails && (
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Friendly Name</p>
                          <p className="font-medium">{twilioDetails.friendlyName}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Created</p>
                          <p className="font-medium">{new Date(twilioDetails.dateCreated).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Monthly Cost</p>
                          <p className="font-medium">${(PHONE_NUMBER_RENTAL_COST / 100).toFixed(2)}/mo</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Number SID</p>
                          <p className="font-mono text-xs">{config?.smsPhoneNumberSid?.slice(0, 12)}...</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 mt-4">
                  {complianceOk && regOk ? (
                    <>
                      <Button asChild>
                        <Link href="/sms-marketing">
                          <Send className="w-4 h-4 mr-2" />
                          Send SMS Campaign
                        </Link>
                      </Button>
                      <Button variant="outline" asChild>
                        <Link href="/sms-marketing/create">
                          <Zap className="w-4 h-4 mr-2" />
                          Create Campaign
                        </Link>
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button disabled className="opacity-50" title="Complete all setup steps first">
                        <Send className="w-4 h-4 mr-2" />
                        Send SMS Campaign
                      </Button>
                      <Button variant="outline" disabled className="opacity-50" title="Complete all setup steps first">
                        <Zap className="w-4 h-4 mr-2" />
                        Create Campaign
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* No phone number yet */}
          {!hasNumber && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                    <Phone className="w-10 h-10 text-green-500/50" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No Phone Number Yet</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    {complianceOk
                      ? "Get a dedicated phone number to start sending SMS campaigns."
                      : "Complete compliance verification first, then rent a number."}
                  </p>
                  {complianceOk ? (
                    <Button size="lg" asChild>
                      <Link href="/settings/sms-marketing/phone-number">
                        <Phone className="w-4 h-4 mr-2" />
                        Get a Phone Number
                      </Link>
                    </Button>
                  ) : (
                    <Button size="lg" asChild>
                      <Link href="/settings/sms-marketing/compliance">
                        <Shield className="w-4 h-4 mr-2" />
                        Complete Compliance Verification
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Compact Pricing Info */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> Pricing:</span>
            <span>Number <strong className="text-foreground">${(PHONE_NUMBER_RENTAL_COST / 100).toFixed(2)}</strong>/mo</span>
            <span className="text-border">|</span>
            <span>SMS <strong className="text-foreground">${(SMS_COST / 100).toFixed(2)}</strong>/msg</span>
            <span className="text-border">|</span>
            <span>MMS <strong className="text-foreground">${(MMS_COST / 100).toFixed(2)}</strong>/msg</span>
            <span className="text-border">|</span>
            <span>1 credit = $0.05</span>
          </div>
        </>
        );
      })()}
    </motion.div>
  );
}
