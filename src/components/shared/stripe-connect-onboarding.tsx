"use client";

import { useState, useEffect, useCallback } from "react";
import { useTheme } from "next-themes";
import {
  ConnectComponentsProvider,
  ConnectAccountOnboarding,
} from "@stripe/react-connect-js";
import { loadConnectAndInitialize, type StripeConnectInstance } from "@stripe/connect-js";
import {
  CheckCircle,
  AlertCircle,
  Banknote,
  ExternalLink,
  Loader2,
  RefreshCw,
  Shield,
} from "lucide-react";

type OnboardingState = "loading" | "idle" | "creating" | "onboarding" | "complete" | "error";

interface StripeConnectOnboardingProps {
  compact?: boolean;
  onComplete?: () => void;
  onExit?: () => void;
  className?: string;
}

export function StripeConnectOnboarding({
  compact = false,
  onComplete,
  onExit,
  className = "",
}: StripeConnectOnboardingProps) {
  const { resolvedTheme } = useTheme();
  const [state, setState] = useState<OnboardingState>("loading");
  const [error, setError] = useState("");
  const [connectInstance, setConnectInstance] = useState<StripeConnectInstance | null>(null);

  // Check the current Connect status on mount
  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/ecommerce/stripe-connect");
      const data = await res.json();

      if (data.onboardingComplete) {
        setState("complete");
        onComplete?.();
      } else if (data.connected) {
        initEmbeddedOnboarding();
      } else {
        setState("idle");
      }
    } catch {
      setState("idle");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const handleStartConnect = async () => {
    setState("creating");
    setError("");

    try {
      const res = await fetch("/api/ecommerce/stripe-connect", {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok || !data.accountId) {
        throw new Error(data.error || "Failed to set up payout account");
      }

      initEmbeddedOnboarding();
    } catch (err: any) {
      setError(err.message || "Failed to set up payout account");
      setState("error");
    }
  };

  const initEmbeddedOnboarding = () => {
    setState("onboarding");

    const isDark = resolvedTheme === "dark";
    const instance = loadConnectAndInitialize({
      publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
      fetchClientSecret: async () => {
        const res = await fetch("/api/ecommerce/stripe-connect/session", {
          method: "POST",
        });
        const data = await res.json();
        if (!data.client_secret) {
          throw new Error("Failed to fetch client secret");
        }
        return data.client_secret;
      },
      appearance: {
        overlays: "dialog",
        variables: {
          colorPrimary: "#6366f1",
          colorBackground: isDark ? "#1e293b" : "#ffffff",
          colorText: isDark ? "#e2e8f0" : "#1e293b",
          colorDanger: "#ef4444",
          borderRadius: "8px",
          fontFamily: "Inter, system-ui, sans-serif",
          colorSecondaryText: isDark ? "#94a3b8" : "#64748b",
          colorBorder: isDark ? "#334155" : "#e2e8f0",
        },
      },
    });

    setConnectInstance(instance);
  };

  const handleOnboardingExit = async () => {
    try {
      const res = await fetch("/api/ecommerce/stripe-connect");
      const data = await res.json();

      if (data.onboardingComplete) {
        setState("complete");
        onComplete?.();
      } else {
        onExit?.();
        setState("idle");
      }
    } catch {
      onExit?.();
      setState("idle");
    }
  };

  const handleOpenDashboard = async () => {
    try {
      const res = await fetch("/api/ecommerce/stripe-connect/login-link", {
        method: "POST",
      });
      const data = await res.json();
      if (data.url) {
        window.open(data.url, "_blank");
      }
    } catch {
      // Silently fail
    }
  };

  // ── Render States ──

  if (state === "loading") {
    return (
      <div className={`flex items-center justify-center py-8 ${className}`}>
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state === "complete") {
    return (
      <div className={`${className}`}>
        <div className={`rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30 ${compact ? "p-4" : "p-5"}`}>
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className={`font-semibold text-green-800 dark:text-green-300 ${compact ? "text-sm" : "text-base"}`}>
                Payouts Active
              </h3>
              <p className="text-sm text-green-700 dark:text-green-400 mt-0.5">
                Your bank account is verified. You will receive automatic payouts from customer purchases.
              </p>
              {!compact && (
                <button
                  onClick={handleOpenDashboard}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-green-700 dark:text-green-300 hover:text-green-800 dark:hover:text-green-200"
                >
                  View Payout Dashboard <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className={`${className}`}>
        <div className={`rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 ${compact ? "p-4" : "p-5"}`}>
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className={`font-semibold text-red-800 dark:text-red-300 ${compact ? "text-sm" : "text-base"}`}>
                Setup Failed
              </h3>
              <p className="text-sm text-red-700 dark:text-red-400 mt-0.5">{error}</p>
              <button
                onClick={handleStartConnect}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state === "onboarding" && connectInstance) {
    return (
      <div className={`${className}`}>
        {!compact && (
          <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="w-4 h-4" />
            <span>Your bank details are encrypted and securely processed. FlowSmartly never stores your banking information.</span>
          </div>
        )}
        <div className="rounded-lg border border-border overflow-hidden">
          <ConnectComponentsProvider connectInstance={connectInstance}>
            <ConnectAccountOnboarding
              onExit={handleOnboardingExit}
            />
          </ConnectComponentsProvider>
        </div>
      </div>
    );
  }

  if (state === "creating") {
    return (
      <div className={`flex items-center justify-center gap-2 py-8 ${className}`}>
        <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
        <span className="text-sm text-muted-foreground">Setting up your payout account...</span>
      </div>
    );
  }

  // ── Idle: Show CTA ──
  return (
    <div className={`${className}`}>
      <div className={`rounded-lg border border-border bg-card ${compact ? "p-4" : "p-6"}`}>
        {!compact && (
          <>
            <div className="flex items-center gap-2 mb-3">
              <Banknote className="w-5 h-5 text-brand-500" />
              <h3 className="text-base font-semibold text-foreground">Set Up Payouts</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-1">
              Add your bank account to receive automatic payouts from customer purchases.
              FlowSmartly handles all payment processing for you.
            </p>
            <ul className="text-sm text-muted-foreground mb-4 space-y-1">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                Automatic payouts to your bank account
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                Real-time earnings dashboard
              </li>
              <li className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                Bank-level encryption for your financial data
              </li>
            </ul>
          </>
        )}
        {compact && (
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-foreground mb-1">Set Up Payouts</h3>
            <p className="text-xs text-muted-foreground">
              Add your bank account to receive automatic payouts from sales.
            </p>
          </div>
        )}
        <button
          onClick={handleStartConnect}
          className={`inline-flex items-center gap-2 font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors ${
            compact ? "px-3 py-1.5 text-sm" : "px-4 py-2 text-sm"
          }`}
        >
          <Banknote className="w-4 h-4" />
          Set Up Bank Account
        </button>
      </div>
    </div>
  );
}
