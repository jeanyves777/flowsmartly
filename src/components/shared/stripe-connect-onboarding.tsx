"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle,
  AlertCircle,
  Banknote,
  Loader2,
  Shield,
  Lock,
  Building2,
  Calendar,
  KeyRound,
  ArrowRight,
  RefreshCw,
} from "lucide-react";

type OnboardingState = "loading" | "idle" | "form" | "submitting" | "complete" | "error" | "update-bank" | "updating";

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
  const router = useRouter();
  const [state, setState] = useState<OnboardingState>("loading");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  // Form fields
  const [dobMonth, setDobMonth] = useState("");
  const [dobDay, setDobDay] = useState("");
  const [dobYear, setDobYear] = useState("");
  const [ssnLast4, setSsnLast4] = useState("");
  const [bankRouting, setBankRouting] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankAccountConfirm, setBankAccountConfirm] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/ecommerce/stripe-connect");
      const data = await res.json();

      if (data.onboardingComplete) {
        setState("complete");
        onComplete?.();
      } else if (data.connected) {
        // Account exists but not fully onboarded — show the form
        setState("form");
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

  const handleStartSetup = () => {
    setState("form");
    setError("");
    setFieldErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    // Client-side validation
    if (bankAccount !== bankAccountConfirm) {
      setFieldErrors({ bankAccount: ["Account numbers do not match"] });
      return;
    }

    setState("submitting");

    try {
      // Step 1: Create the Custom account (or get existing one)
      const createRes = await fetch("/api/ecommerce/stripe-connect", {
        method: "POST",
      });
      const createData = await createRes.json();

      if (!createRes.ok || !createData.accountId) {
        throw new Error(createData.error || "Failed to create payout account");
      }

      // Step 2: Submit the missing fields
      const completeRes = await fetch("/api/ecommerce/stripe-connect/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dob: {
            day: parseInt(dobDay),
            month: parseInt(dobMonth),
            year: parseInt(dobYear),
          },
          ssnLast4,
          bankRouting,
          bankAccount,
          accountHolderName,
        }),
      });
      const completeData = await completeRes.json();

      if (!completeRes.ok) {
        if (completeData.details) {
          setFieldErrors(completeData.details);
          setState("form");
          return;
        }
        throw new Error(completeData.error || "Failed to complete payout setup");
      }

      setState("complete");
      onComplete?.();
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
      setState("form");
    }
  };

  const handleOpenDashboard = () => {
    router.push("/ecommerce/payouts");
  };

  const handleStartUpdateBank = () => {
    setBankRouting("");
    setBankAccount("");
    setBankAccountConfirm("");
    setAccountHolderName("");
    setError("");
    setFieldErrors({});
    setState("update-bank");
  };

  const handleUpdateBank = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    if (bankAccount !== bankAccountConfirm) {
      setFieldErrors({ bankAccount: ["Account numbers do not match"] });
      return;
    }

    setState("updating");

    try {
      const res = await fetch("/api/ecommerce/stripe-connect/update-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankRouting, bankAccount, accountHolderName }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.details) {
          setFieldErrors(data.details);
          setState("update-bank");
          return;
        }
        throw new Error(data.error || "Failed to update bank account");
      }

      setState("complete");
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
      setState("update-bank");
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
                <div className="mt-3 flex items-center gap-4">
                  <button
                    onClick={handleOpenDashboard}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 dark:text-green-300 hover:text-green-800 dark:hover:text-green-200"
                  >
                    View Payout Dashboard <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleStartUpdateBank}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 dark:text-green-300 hover:text-green-800 dark:hover:text-green-200"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Update Bank Account
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state === "updating") {
    return (
      <div className={`flex items-center justify-center gap-2 py-8 ${className}`}>
        <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
        <span className="text-sm text-muted-foreground">Updating your bank account...</span>
      </div>
    );
  }

  if (state === "update-bank") {
    return (
      <div className={`${className}`}>
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Shield className="w-4 h-4" />
          <span>Your information is encrypted and securely processed. FlowSmartly never stores your banking details.</span>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleUpdateBank} className="space-y-5">
          <div>
            <h4 className="flex items-center gap-1.5 text-sm font-medium text-foreground mb-3">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              New Bank Account Details
            </h4>

            <div className="space-y-3">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Account Holder Name</label>
                <input
                  type="text"
                  placeholder="Full name on the account"
                  value={accountHolderName}
                  onChange={(e) => setAccountHolderName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                {fieldErrors.accountHolderName && (
                  <p className="mt-1 text-xs text-red-500">{fieldErrors.accountHolderName[0]}</p>
                )}
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Routing Number</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={9}
                  placeholder="9-digit routing number"
                  value={bankRouting}
                  onChange={(e) => setBankRouting(e.target.value.replace(/\D/g, "").slice(0, 9))}
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                {fieldErrors.bankRouting && (
                  <p className="mt-1 text-xs text-red-500">{fieldErrors.bankRouting[0]}</p>
                )}
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Account Number</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={17}
                  placeholder="Account number"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value.replace(/\D/g, "").slice(0, 17))}
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                {fieldErrors.bankAccount && (
                  <p className="mt-1 text-xs text-red-500">{fieldErrors.bankAccount[0]}</p>
                )}
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Confirm Account Number</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={17}
                  placeholder="Re-enter account number"
                  value={bankAccountConfirm}
                  onChange={(e) => setBankAccountConfirm(e.target.value.replace(/\D/g, "").slice(0, 17))}
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              className="inline-flex items-center gap-2 font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors px-5 py-2.5 text-sm"
            >
              <Lock className="w-4 h-4" />
              Update Bank Account
            </button>
            <button
              type="button"
              onClick={() => setState("complete")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
            <Lock className="w-3 h-3" />
            <span>256-bit encryption &middot; Your data is sent directly to our payment processor and never stored on our servers.</span>
          </div>
        </form>
      </div>
    );
  }

  if (state === "submitting") {
    return (
      <div className={`flex items-center justify-center gap-2 py-8 ${className}`}>
        <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
        <span className="text-sm text-muted-foreground">Setting up your payouts...</span>
      </div>
    );
  }

  if (state === "form") {
    return (
      <div className={`${className}`}>
        {!compact && (
          <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="w-4 h-4" />
            <span>Your information is encrypted and securely processed. FlowSmartly never stores your banking details.</span>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Date of Birth */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-foreground mb-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              Date of Birth
            </label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <select
                  value={dobMonth}
                  onChange={(e) => setDobMonth(e.target.value)}
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Month</option>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(2000, i).toLocaleString("default", { month: "long" })}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <select
                  value={dobDay}
                  onChange={(e) => setDobDay(e.target.value)}
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Day</option>
                  {Array.from({ length: 31 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}</option>
                  ))}
                </select>
              </div>
              <div>
                <input
                  type="number"
                  placeholder="Year"
                  value={dobYear}
                  onChange={(e) => setDobYear(e.target.value)}
                  required
                  min={1900}
                  max={2010}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
            {fieldErrors.dob && (
              <p className="mt-1 text-xs text-red-500">{fieldErrors.dob[0]}</p>
            )}
          </div>

          {/* SSN Last 4 */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-foreground mb-2">
              <KeyRound className="w-4 h-4 text-muted-foreground" />
              Last 4 Digits of SSN
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="••••"
              value={ssnLast4}
              onChange={(e) => setSsnLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
              required
              className="w-full max-w-[120px] rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <p className="mt-1 text-xs text-muted-foreground">Required for identity verification</p>
            {fieldErrors.ssnLast4 && (
              <p className="mt-1 text-xs text-red-500">{fieldErrors.ssnLast4[0]}</p>
            )}
          </div>

          {/* Bank Account Section */}
          <div className="border-t border-border pt-5">
            <h4 className="flex items-center gap-1.5 text-sm font-medium text-foreground mb-3">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              Bank Account Details
            </h4>

            <div className="space-y-3">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Account Holder Name</label>
                <input
                  type="text"
                  placeholder="Full name on the account"
                  value={accountHolderName}
                  onChange={(e) => setAccountHolderName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                {fieldErrors.accountHolderName && (
                  <p className="mt-1 text-xs text-red-500">{fieldErrors.accountHolderName[0]}</p>
                )}
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Routing Number</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={9}
                  placeholder="9-digit routing number"
                  value={bankRouting}
                  onChange={(e) => setBankRouting(e.target.value.replace(/\D/g, "").slice(0, 9))}
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                {fieldErrors.bankRouting && (
                  <p className="mt-1 text-xs text-red-500">{fieldErrors.bankRouting[0]}</p>
                )}
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Account Number</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={17}
                  placeholder="Account number"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value.replace(/\D/g, "").slice(0, 17))}
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                {fieldErrors.bankAccount && (
                  <p className="mt-1 text-xs text-red-500">{fieldErrors.bankAccount[0]}</p>
                )}
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Confirm Account Number</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={17}
                  placeholder="Re-enter account number"
                  value={bankAccountConfirm}
                  onChange={(e) => setBankAccountConfirm(e.target.value.replace(/\D/g, "").slice(0, 17))}
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              className="inline-flex items-center gap-2 font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors px-5 py-2.5 text-sm"
            >
              <Lock className="w-4 h-4" />
              Complete Payout Setup
            </button>
            {state === "form" && !compact && (
              <button
                type="button"
                onClick={() => { setState("idle"); onExit?.(); }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            )}
          </div>

          {/* Trust footer */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
            <Lock className="w-3 h-3" />
            <span>256-bit encryption &middot; Your data is sent directly to our payment processor and never stored on our servers.</span>
          </div>
        </form>
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
                Only 3% platform fee
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
          onClick={handleStartSetup}
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
