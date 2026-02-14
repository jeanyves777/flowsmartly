"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Phone,
  Shield,
  Settings,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface A2pStatus {
  hasRegistration: boolean;
  brandStatus: string | null;
  campaignStatus: string | null;
  brandFailureReason: string | null;
  campaignFailureReason: string | null;
  isApproved: boolean;
}

interface TollfreeStatus {
  hasVerification: boolean;
  status: string | null;
  rejectionReason: string | null;
}

interface NumberInfo {
  phoneNumber: string | null;
  isTollFree: boolean;
}

type StepState = "completed" | "active" | "pending" | "failed";

interface ProgressStep {
  label: string;
  state: StepState;
  detail?: string;
}

function StepIndicator({ step, isLast }: { step: ProgressStep; isLast: boolean }) {
  const stateConfig: Record<StepState, { icon: React.ReactNode; color: string; lineColor: string }> = {
    completed: {
      icon: <CheckCircle2 className="w-5 h-5" />,
      color: "text-green-500",
      lineColor: "bg-green-500",
    },
    active: {
      icon: <Loader2 className="w-5 h-5 animate-spin" />,
      color: "text-yellow-500",
      lineColor: "bg-yellow-500/40",
    },
    pending: {
      icon: <Clock className="w-5 h-5" />,
      color: "text-muted-foreground/40",
      lineColor: "bg-muted-foreground/20",
    },
    failed: {
      icon: <XCircle className="w-5 h-5" />,
      color: "text-red-500",
      lineColor: "bg-red-500/40",
    },
  };

  const cfg = stateConfig[step.state];

  return (
    <div className="flex items-center gap-0 flex-1 min-w-0">
      <div className="flex flex-col items-center gap-1 shrink-0">
        <div className={cfg.color}>{cfg.icon}</div>
        <span className={`text-[10px] font-medium text-center leading-tight max-w-[80px] ${
          step.state === "pending" ? "text-muted-foreground/50" : step.state === "failed" ? "text-red-500" : ""
        }`}>
          {step.label}
        </span>
        {step.detail && (
          <span className={`text-[9px] text-center leading-tight max-w-[90px] ${
            step.state === "failed" ? "text-red-400" : "text-muted-foreground"
          }`}>
            {step.detail}
          </span>
        )}
      </div>
      {!isLast && (
        <div className={`h-0.5 flex-1 mx-1 mt-[-20px] rounded-full ${cfg.lineColor}`} />
      )}
    </div>
  );
}

export function NumberStatusBanner() {
  const [numberInfo, setNumberInfo] = useState<NumberInfo | null>(null);
  const [a2pStatus, setA2pStatus] = useState<A2pStatus | null>(null);
  const [tollfreeStatus, setTollfreeStatus] = useState<TollfreeStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStatus = async (refresh = false) => {
    try {
      if (refresh) setIsRefreshing(true);
      else setIsLoading(true);

      // First get the user's number info
      const numRes = await fetch("/api/sms/numbers?action=current");
      const numData = await numRes.json();

      if (!numData.success || !numData.data?.phoneNumber) {
        setNumberInfo(null);
        return;
      }

      const phone = numData.data.phoneNumber as string;
      const isTollFree = /^\+1(800|833|844|855|866|877|888)/.test(phone);
      setNumberInfo({ phoneNumber: phone, isTollFree });

      if (isTollFree) {
        const tfRes = await fetch("/api/sms/numbers/verify");
        const tfData = await tfRes.json();
        if (tfData.success) {
          setTollfreeStatus(tfData.data);
        }
      } else {
        const a2pRes = await fetch("/api/sms/numbers/a2p-status");
        const a2pData = await a2pRes.json();
        if (a2pData.success) {
          setA2pStatus(a2pData.data);
        }
      }
    } catch {
      // Silently fail — banner is non-critical
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  // Don't show banner if loading or no number
  if (isLoading) return null;
  if (!numberInfo?.phoneNumber) return null;

  // ── Toll-free: fully approved → hide ──
  if (numberInfo.isTollFree) {
    if (
      tollfreeStatus?.status === "TWILIO_APPROVED" ||
      tollfreeStatus?.status === "APPROVED"
    ) {
      return null;
    }
  } else {
    // ── Local: fully approved → hide ──
    if (a2pStatus?.isApproved) {
      return null;
    }
  }

  // ── Build progress steps ──
  let steps: ProgressStep[] = [];
  let overallTitle = "";
  let overallDescription = "";
  let overallType: "pending" | "error" | "warning" = "pending";

  if (numberInfo.isTollFree) {
    // Toll-free progress: Number Acquired → Verification Submitted → Carrier Review → Approved
    const hasVerif = tollfreeStatus?.hasVerification;
    const isRejected = tollfreeStatus?.status === "TWILIO_REJECTED" || tollfreeStatus?.status === "REJECTED";

    steps = [
      {
        label: "Number",
        state: "completed",
        detail: "Acquired",
      },
      {
        label: "Verification",
        state: hasVerif ? "completed" : "pending",
        detail: hasVerif ? "Submitted" : "Not submitted",
      },
      {
        label: "Carrier Review",
        state: isRejected ? "failed" : hasVerif ? "active" : "pending",
        detail: isRejected ? "Rejected" : hasVerif ? "In progress" : "Waiting",
      },
      {
        label: "Ready",
        state: "pending",
        detail: "Not yet",
      },
    ];

    if (!hasVerif) {
      overallType = "warning";
      overallTitle = "Toll-Free Verification Required";
      overallDescription = "Submit verification to start sending messages from your toll-free number.";
    } else if (isRejected) {
      overallType = "error";
      overallTitle = "Toll-Free Verification Rejected";
      overallDescription = tollfreeStatus?.rejectionReason
        ? `Reason: ${tollfreeStatus.rejectionReason}`
        : "Please update your compliance information and resubmit.";
    } else {
      overallType = "pending";
      overallTitle = "Toll-Free Verification In Progress";
      overallDescription = "Carrier review typically takes 1-5 business days. You cannot send campaigns until approved.";
    }
  } else {
    // A2P 10DLC progress: Number Acquired → Registration → Brand Review → Campaign Review → Ready
    const hasReg = a2pStatus?.hasRegistration;
    const brandApproved = a2pStatus?.brandStatus === "APPROVED";
    const brandFailed = a2pStatus?.brandStatus === "FAILED";
    const campaignStatus = a2pStatus?.campaignStatus;
    const campaignDone = campaignStatus === "VERIFIED" || campaignStatus === "SUCCESSFUL";
    const campaignFailed = campaignStatus === "FAILED";

    steps = [
      {
        label: "Number",
        state: "completed",
        detail: "Acquired",
      },
      {
        label: "Registration",
        state: hasReg ? "completed" : "pending",
        detail: hasReg ? "Submitted" : "Not started",
      },
      {
        label: "Brand",
        state: brandFailed
          ? "failed"
          : brandApproved
            ? "completed"
            : hasReg
              ? "active"
              : "pending",
        detail: brandFailed
          ? "Failed"
          : brandApproved
            ? "Approved"
            : hasReg
              ? a2pStatus?.brandStatus?.replace(/_/g, " ") || "In review"
              : "Waiting",
      },
      {
        label: "Campaign",
        state: campaignFailed
          ? "failed"
          : campaignDone
            ? "completed"
            : brandApproved && campaignStatus
              ? "active"
              : "pending",
        detail: campaignFailed
          ? "Failed"
          : campaignDone
            ? "Approved"
            : brandApproved && campaignStatus
              ? campaignStatus.replace(/_/g, " ")
              : "Waiting",
      },
      {
        label: "Ready",
        state: "pending",
        detail: "Not yet",
      },
    ];

    if (!hasReg) {
      overallType = "warning";
      overallTitle = "A2P Registration Required";
      overallDescription = "Your local number needs A2P 10DLC registration before you can send messages.";
    } else if (brandFailed || campaignFailed) {
      overallType = "error";
      const reason = a2pStatus?.brandFailureReason || a2pStatus?.campaignFailureReason;
      overallTitle = brandFailed ? "Brand Registration Failed" : "Campaign Registration Failed";
      overallDescription = reason
        ? `Reason: ${reason}. Contact support or retry from SMS Settings.`
        : "Please contact support or retry registration from SMS Settings.";
    } else if (brandApproved && campaignStatus) {
      overallType = "pending";
      overallTitle = "Campaign Under Carrier Review";
      overallDescription = "Your brand is approved. Campaign review typically takes 1-7 business days. You cannot send campaigns until complete.";
    } else {
      overallType = "pending";
      overallTitle = "A2P Registration In Progress";
      overallDescription = "Your registration is being processed. This can take a few minutes to a few days. You cannot send campaigns until approved.";
    }
  }

  const typeConfig = {
    pending: {
      border: "border-yellow-500/30",
      bg: "bg-yellow-500/5",
      iconBg: "bg-yellow-500/20",
      iconColor: "text-yellow-500",
      titleColor: "text-yellow-600 dark:text-yellow-400",
      descColor: "text-yellow-700/70 dark:text-yellow-300/70",
      Icon: Clock,
    },
    error: {
      border: "border-red-500/30",
      bg: "bg-red-500/5",
      iconBg: "bg-red-500/20",
      iconColor: "text-red-500",
      titleColor: "text-red-600 dark:text-red-400",
      descColor: "text-red-700/70 dark:text-red-300/70",
      Icon: XCircle,
    },
    warning: {
      border: "border-orange-500/30",
      bg: "bg-orange-500/5",
      iconBg: "bg-orange-500/20",
      iconColor: "text-orange-500",
      titleColor: "text-orange-600 dark:text-orange-400",
      descColor: "text-orange-700/70 dark:text-orange-300/70",
      Icon: AlertTriangle,
    },
  };

  const cfg = typeConfig[overallType];

  return (
    <Card className={`${cfg.border} ${cfg.bg}`}>
      <CardContent className="pt-5 pb-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${cfg.iconBg}`}>
              <cfg.Icon className={`w-5 h-5 ${cfg.iconColor}`} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className={`font-semibold ${cfg.titleColor}`}>{overallTitle}</h3>
                <Badge variant="outline" className="text-xs font-mono gap-1">
                  <Phone className="w-3 h-3" />
                  {numberInfo.phoneNumber}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {numberInfo.isTollFree ? "Toll-Free" : "Local"}
                </Badge>
              </div>
              <p className={`text-sm mt-0.5 ${cfg.descColor}`}>{overallDescription}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchStatus(true)}
              disabled={isRefreshing}
              className="gap-1"
            >
              {isRefreshing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            {overallType === "warning" && (
              <Button size="sm" asChild className="gap-1">
                <Link href="/settings/sms-marketing">
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">SMS Settings</span>
                </Link>
              </Button>
            )}
            {overallType === "error" && (
              <Button size="sm" variant="destructive" asChild className="gap-1">
                <Link href="/settings/sms-marketing">
                  <ArrowRight className="w-4 h-4" />
                  <span className="hidden sm:inline">Fix in Settings</span>
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Progress steps */}
        <div className="flex items-start justify-between px-2">
          {steps.map((step, i) => (
            <StepIndicator key={step.label} step={step} isLast={i === steps.length - 1} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
