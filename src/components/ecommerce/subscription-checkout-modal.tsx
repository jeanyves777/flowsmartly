"use client";

import { useState, useEffect } from "react";
import {
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  CreditCard,
  Shield,
  AlertCircle,
  Check,
  ShoppingBag,
  Plus,
  Gift,
  Crown,
} from "lucide-react";
import Link from "next/link";
import {
  ECOM_PLAN_FEATURES,
  ECOM_BASIC_PRICE_CENTS,
  ECOM_PRO_PRICE_CENTS,
  ECOM_PLAN_NAMES,
  type EcomPlan,
} from "@/lib/domains/pricing";

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

interface SubscriptionCheckoutModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialPlan?: EcomPlan;
}

export function SubscriptionCheckoutModal({
  open,
  onClose,
  onSuccess,
  initialPlan,
}: SubscriptionCheckoutModalProps) {
  const stripe = useStripe();
  const elements = useElements();

  const [step, setStep] = useState<"plan" | "terms" | "payment">(initialPlan ? "terms" : "plan");
  const [selectedPlan, setSelectedPlan] = useState<EcomPlan>(initialPlan || "pro");
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPmId, setSelectedPmId] = useState<string | null>(null);
  const [addingCard, setAddingCard] = useState(false);
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [loadingMethods, setLoadingMethods] = useState(false);
  const [savingCard, setSavingCard] = useState(false);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load payment methods when modal opens
  useEffect(() => {
    if (!open) {
      setStep(initialPlan ? "terms" : "plan");
      setSelectedPlan(initialPlan || "pro");
      setAgreedTerms(false);
      setSelectedPmId(null);
      setAddingCard(false);
      setSetupSecret(null);
      setError(null);
      return;
    }
    loadPaymentMethods();
  }, [open, initialPlan]);

  async function loadPaymentMethods() {
    setLoadingMethods(true);
    try {
      const res = await fetch("/api/payments/methods");
      const data = await res.json();
      if (data.success && data.data.paymentMethods) {
        setPaymentMethods(data.data.paymentMethods);
        const defaultPm = data.data.paymentMethods.find(
          (pm: PaymentMethod) => pm.isDefault
        );
        if (defaultPm) setSelectedPmId(defaultPm.id);
        else if (data.data.paymentMethods.length > 0)
          setSelectedPmId(data.data.paymentMethods[0].id);
      }
    } catch {
      // silent
    } finally {
      setLoadingMethods(false);
    }
  }

  async function startAddCard() {
    setAddingCard(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.success && data.data.clientSecret) {
        setSetupSecret(data.data.clientSecret);
      } else {
        setError("Failed to initialize card form");
        setAddingCard(false);
      }
    } catch {
      setError("Failed to connect to payment service");
      setAddingCard(false);
    }
  }

  async function handleSaveCard() {
    if (!stripe || !elements || !setupSecret) return;

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) return;

    setSavingCard(true);
    setError(null);

    try {
      const result = await stripe.confirmCardSetup(setupSecret, {
        payment_method: { card: cardElement },
      });

      if (result.error) {
        setError(result.error.message || "Failed to save card");
        setSavingCard(false);
        return;
      }

      // Get the new payment method ID
      const pmId =
        typeof result.setupIntent.payment_method === "string"
          ? result.setupIntent.payment_method
          : result.setupIntent.payment_method?.id;

      if (pmId) {
        // Fire-and-forget notification
        fetch("/api/payments/methods/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentMethodId: pmId }),
        }).catch(() => {});

        // Reload payment methods and select the new one
        await loadPaymentMethods();
        setSelectedPmId(pmId);
        setAddingCard(false);
        setSetupSecret(null);
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setSavingCard(false);
    }
  }

  async function handleActivate() {
    if (!selectedPmId) {
      setError("Please select a payment method or add a new card.");
      return;
    }

    setActivating(true);
    setError(null);

    try {
      const res = await fetch("/api/ecommerce/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethodId: selectedPmId, plan: selectedPlan }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message || "Failed to activate FlowShop");
        return;
      }

      onSuccess();
    } catch {
      setError("Failed to activate. Please try again.");
    } finally {
      setActivating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className={`max-h-[90vh] overflow-hidden flex flex-col ${step === "plan" ? "sm:max-w-2xl" : "sm:max-w-lg"}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-violet-500" />
            {step === "plan"
              ? "Choose Your Plan"
              : step === "terms"
              ? "FlowShop Terms & Agreement"
              : "Payment & Activation"}
          </DialogTitle>
          <DialogDescription>
            {step === "plan"
              ? "Select the plan that fits your business. Both include a 14-day free trial."
              : step === "terms"
              ? "Please review and accept the terms to continue."
              : "Add a card to start your 14-day free trial."}
          </DialogDescription>
        </DialogHeader>

        {step === "plan" ? (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Plan cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              {/* Basic Plan */}
              <div
                className={`relative rounded-xl border-2 p-5 transition-all cursor-pointer ${
                  selectedPlan === "basic"
                    ? "border-violet-500 bg-violet-50/50 dark:bg-violet-950/20"
                    : "border-border hover:border-violet-300"
                }`}
                onClick={() => setSelectedPlan("basic")}
              >
                {/* Trial badge */}
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-xs font-medium mb-3">
                  <Gift className="w-3 h-3" />
                  14-Day Free Trial
                </div>

                <h3 className="text-lg font-semibold mb-1">
                  {ECOM_PLAN_NAMES.basic}
                </h3>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-3xl font-bold">
                    ${(ECOM_BASIC_PRICE_CENTS / 100).toFixed(0)}
                  </span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </div>

                <ul className="space-y-2 mb-5">
                  {ECOM_PLAN_FEATURES.basic.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPlan("basic");
                    setStep("terms");
                  }}
                >
                  Select Basic
                </Button>
              </div>

              {/* Pro Plan */}
              <div
                className={`relative rounded-xl border-2 p-5 transition-all cursor-pointer ${
                  selectedPlan === "pro"
                    ? "border-violet-500 bg-violet-50/50 dark:bg-violet-950/20"
                    : "border-violet-300 dark:border-violet-700 hover:border-violet-500"
                }`}
                onClick={() => setSelectedPlan("pro")}
              >
                {/* Best value badge */}
                <div className="absolute -top-3 right-4 inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-gradient-to-r from-violet-500 to-indigo-600 text-white text-xs font-semibold shadow-sm">
                  <Crown className="w-3 h-3" />
                  BEST VALUE
                </div>

                {/* Trial badge */}
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-xs font-medium mb-3">
                  <Gift className="w-3 h-3" />
                  14-Day Free Trial
                </div>

                <h3 className="text-lg font-semibold mb-1">
                  {ECOM_PLAN_NAMES.pro}
                </h3>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-3xl font-bold">
                    ${(ECOM_PRO_PRICE_CENTS / 100).toFixed(0)}
                  </span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </div>

                <ul className="space-y-2 mb-5">
                  {ECOM_PLAN_FEATURES.pro.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <Check className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPlan("pro");
                    setStep("terms");
                  }}
                >
                  Select Pro
                </Button>
              </div>
            </div>

            {/* Cancel */}
            <div className="flex justify-end">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </div>
        ) : step === "terms" ? (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Selected plan banner */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 mb-2">
              <ShoppingBag className="w-5 h-5 text-violet-600 dark:text-violet-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-violet-800 dark:text-violet-300">
                  {ECOM_PLAN_NAMES[selectedPlan]} &mdash; ${((selectedPlan === "pro" ? ECOM_PRO_PRICE_CENTS : ECOM_BASIC_PRICE_CENTS) / 100).toFixed(0)}/month
                </p>
                {selectedPlan === "pro" && (
                  <p className="text-xs text-violet-600 dark:text-violet-400">
                    1 FREE domain included &mdash; claim after setup
                  </p>
                )}
              </div>
              <button
                onClick={() => setStep("plan")}
                className="ml-auto text-xs text-violet-600 hover:text-violet-800 dark:text-violet-400 dark:hover:text-violet-200 underline underline-offset-2"
              >
                Change
              </button>
            </div>

            {/* Trial banner */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 mb-4">
              <Gift className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                  14-Day Free Trial
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  Your card will not be charged for 14 days. Cancel anytime.
                </p>
              </div>
            </div>

            {/* Scrollable terms */}
            <div className="flex-1 overflow-y-auto border rounded-lg p-4 mb-4 text-sm text-muted-foreground leading-relaxed space-y-4 max-h-[300px]">
              <h3 className="font-semibold text-foreground">
                FlowShop E-Commerce Terms Summary
              </h3>
              <p>
                By activating FlowShop, you agree to the following:
              </p>

              <div>
                <h4 className="font-medium text-foreground mb-1">
                  Subscription & Billing
                </h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    14-day free trial, then ${((selectedPlan === "pro" ? ECOM_PRO_PRICE_CENTS : ECOM_BASIC_PRICE_CENTS) / 100).toFixed(2)} USD/month ({ECOM_PLAN_NAMES[selectedPlan]}) billed automatically.
                  </li>
                  <li>A valid payment card is required but will not be charged during the trial.</li>
                  <li>Cancel anytime from your dashboard — no partial refunds for unused time.</li>
                  <li>
                    Stripe processing fees (2.9% + $0.30) apply to each customer payment.
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-foreground mb-1">
                  Merchant Responsibilities
                </h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li>You are responsible for your products, pricing, fulfillment, and customer service.</li>
                  <li>All product listings must be accurate and not misleading.</li>
                  <li>Prohibited items include illegal goods, weapons, drugs, counterfeit products, and adult content.</li>
                  <li>Customer data may only be used for order fulfillment — never sold or shared.</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-foreground mb-1">
                  Customer Data & Privacy
                </h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Customer payment data is processed by Stripe — FlowSmartly never stores card numbers.</li>
                  <li>You must comply with GDPR, CCPA, and applicable privacy laws.</li>
                  <li>FlowSmartly acts as data processor on your behalf.</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-foreground mb-1">
                  Liability & Disputes
                </h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li>FlowSmartly is the platform provider, not the merchant of record.</li>
                  <li>You agree to indemnify FlowSmartly against claims from your store operations.</li>
                  <li>Excessive chargebacks (&gt;1%) may result in store suspension.</li>
                </ul>
              </div>

              <p className="text-xs border-t pt-3">
                Read the full{" "}
                <Link
                  href="/ecommerce-terms"
                  target="_blank"
                  className="text-violet-600 hover:underline"
                >
                  E-Commerce Terms & Conditions
                </Link>
                ,{" "}
                <Link
                  href="/privacy"
                  target="_blank"
                  className="text-violet-600 hover:underline"
                >
                  Privacy Policy
                </Link>
                , and{" "}
                <Link
                  href="/terms"
                  target="_blank"
                  className="text-violet-600 hover:underline"
                >
                  Terms of Service
                </Link>
                .
              </p>
            </div>

            {/* Agreement checkbox */}
            <label className="flex items-start gap-3 mb-4 cursor-pointer group">
              <div className="relative mt-0.5">
                <input
                  type="checkbox"
                  checked={agreedTerms}
                  onChange={(e) => setAgreedTerms(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="h-5 w-5 rounded border-2 border-muted-foreground/30 peer-checked:border-violet-500 peer-checked:bg-violet-500 transition-colors flex items-center justify-center">
                  {agreedTerms && (
                    <Check className="h-3 w-3 text-white" />
                  )}
                </div>
              </div>
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                I have read and agree to the{" "}
                <Link
                  href="/ecommerce-terms"
                  target="_blank"
                  className="text-violet-600 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  E-Commerce Terms & Conditions
                </Link>
                ,{" "}
                <Link
                  href="/privacy"
                  target="_blank"
                  className="text-violet-600 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  Privacy Policy
                </Link>
                , and{" "}
                <Link
                  href="/terms"
                  target="_blank"
                  className="text-violet-600 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  Terms of Service
                </Link>
                .
              </span>
            </label>

            {/* Continue button */}
            <div className="flex justify-between gap-3">
              <Button variant="ghost" onClick={() => setStep("plan")}>
                Back
              </Button>
              <div className="flex gap-3">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  disabled={!agreedTerms}
                  onClick={() => setStep("payment")}
                  className="bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700"
                >
                  Continue to Payment
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col flex-1">
            {/* Trial reminder */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 mb-4">
              <Gift className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                  14-Day Free Trial &mdash; {ECOM_PLAN_NAMES[selectedPlan]} (${((selectedPlan === "pro" ? ECOM_PRO_PRICE_CENTS : ECOM_BASIC_PRICE_CENTS) / 100).toFixed(0)}/mo) after
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  Your card will not be charged today. Cancel anytime during the trial.
                </p>
              </div>
            </div>

            {/* Payment methods */}
            <div className="space-y-3 mb-4">
              <p className="text-sm font-medium">Payment Method</p>

              {loadingMethods ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* Existing cards */}
                  {paymentMethods.map((pm) => (
                    <label
                      key={pm.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedPmId === pm.id && !addingCard
                          ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30"
                          : "border-border hover:border-violet-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="payment_method"
                        checked={selectedPmId === pm.id && !addingCard}
                        onChange={() => {
                          setSelectedPmId(pm.id);
                          setAddingCard(false);
                        }}
                        className="sr-only"
                      />
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          selectedPmId === pm.id && !addingCard
                            ? "border-violet-500"
                            : "border-muted-foreground/30"
                        }`}
                      >
                        {selectedPmId === pm.id && !addingCard && (
                          <div className="w-2 h-2 rounded-full bg-violet-500" />
                        )}
                      </div>
                      <CreditCard className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium capitalize">
                        {pm.brand}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        ****{pm.last4}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {pm.expMonth}/{pm.expYear}
                      </span>
                    </label>
                  ))}

                  {/* Add new card */}
                  {!addingCard ? (
                    <button
                      onClick={startAddCard}
                      className="flex items-center gap-3 w-full p-3 rounded-lg border border-dashed border-muted-foreground/30 hover:border-violet-400 text-muted-foreground hover:text-violet-600 transition-colors text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Add new card
                    </button>
                  ) : (
                    <div className="p-4 rounded-lg border border-violet-500 bg-violet-50/50 dark:bg-violet-950/20 space-y-3">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-violet-500" />
                        New Card
                      </p>

                      {setupSecret ? (
                        <>
                          <div className="p-3 border rounded-lg bg-background">
                            <CardElement
                              options={{
                                style: {
                                  base: {
                                    fontSize: "16px",
                                    color: "#1a1a1a",
                                    "::placeholder": { color: "#a3a3a3" },
                                    fontFamily:
                                      "system-ui, -apple-system, sans-serif",
                                  },
                                  invalid: { color: "#ef4444" },
                                },
                              }}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={handleSaveCard}
                              disabled={savingCard || !stripe}
                              className="bg-violet-600 hover:bg-violet-700"
                            >
                              {savingCard ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                  Saving...
                                </>
                              ) : (
                                "Save Card"
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setAddingCard(false);
                                setSetupSecret(null);
                              }}
                              disabled={savingCard}
                            >
                              Cancel
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 mb-4">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              </div>
            )}

            {/* Security badge */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
              <Shield className="w-3.5 h-3.5 text-green-500" />
              <span>
                Secured with 256-bit SSL encryption by Stripe. Your card will not
                be charged today.
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex justify-between gap-3">
              <Button
                variant="ghost"
                onClick={() => setStep("terms")}
                disabled={activating}
              >
                Back
              </Button>
              <div className="flex gap-3">
                <Button variant="outline" onClick={onClose} disabled={activating}>
                  Cancel
                </Button>
                <Button
                  onClick={handleActivate}
                  disabled={
                    !selectedPmId || addingCard || activating || loadingMethods
                  }
                  className="bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700"
                >
                  {activating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Activating...
                    </>
                  ) : (
                    "Start Free Trial"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
