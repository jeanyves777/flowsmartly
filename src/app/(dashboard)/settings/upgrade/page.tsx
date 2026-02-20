"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { emitPlanUpdate } from "@/lib/utils/plan-event";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Crown,
  Zap,
  Building2,
  Rocket,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Shield,
  CreditCard,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useStripe } from "@stripe/react-stripe-js";
import { StripeProvider } from "@/components/providers/stripe-provider";
import { AddCardForm } from "@/components/payments/add-card-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface PlanData {
  id: string;
  name: string;
  monthlyCredits: number;
  priceCentsMonthly: number;
  priceCentsYearly: number;
  features: string[];
}

interface UserData {
  plan: string;
}

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

const planIcons: Record<string, React.ElementType> = {
  STARTER: Sparkles,
  PRO: Zap,
  BUSINESS: Building2,
  ENTERPRISE: Rocket,
};

const planColors: Record<string, string> = {
  STARTER: "from-gray-500 to-gray-700",
  PRO: "from-brand-500 to-purple-600",
  BUSINESS: "from-blue-500 to-indigo-600",
  ENTERPRISE: "from-orange-500 to-red-600",
};

const planAccentColors: Record<string, string> = {
  STARTER: "from-gray-400 to-gray-600",
  PRO: "from-brand-400 to-purple-500",
  BUSINESS: "from-blue-400 to-indigo-500",
  ENTERPRISE: "from-orange-400 to-red-500",
};

const planDescriptions: Record<string, string> = {
  STARTER: "Perfect for getting started with AI-powered content creation",
  PRO: "For creators who want more power and professional tools",
  BUSINESS: "For teams and businesses scaling their marketing efforts",
  ENTERPRISE: "Full-featured solution for large organizations",
};

const planCreditBg: Record<string, string> = {
  STARTER: "bg-gray-500/5",
  PRO: "bg-purple-500/5",
  BUSINESS: "bg-blue-500/5",
  ENTERPRISE: "bg-orange-500/5",
};

const faqItems = [
  {
    question: "Can I change plans anytime?",
    answer:
      "Yes! You can upgrade or downgrade your plan at any time. When upgrading, you\u2019ll be charged the prorated difference. When downgrading, the change takes effect at the end of your billing cycle.",
  },
  {
    question: "What happens to unused credits?",
    answer:
      "Monthly credits reset at the beginning of each billing cycle. Purchased credit packages never expire and remain in your account until used.",
  },
  {
    question: "Is there a free trial?",
    answer:
      "Our Starter plan is free forever with 500 credits per month. You can upgrade to a paid plan anytime to access more features and credits.",
  },
  {
    question: "How do I cancel my subscription?",
    answer:
      "You can cancel your subscription anytime from your billing settings. You\u2019ll continue to have access until the end of your current billing period.",
  },
];

export default function UpgradePage() {
  return (
    <StripeProvider>
      <UpgradeContent />
    </StripeProvider>
  );
}

function UpgradeContent() {
  const router = useRouter();
  const { toast } = useToast();
  const stripeInstance = useStripe();
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  // Confirmation dialog state
  const [confirmPlan, setConfirmPlan] = useState<PlanData | null>(null);
  const [confirmPaymentMethod, setConfirmPaymentMethod] = useState<PaymentMethod | null>(null);
  // Use a ref for pendingPlanId to avoid closure issues with callbacks
  const pendingPlanIdRef = useRef<string | null>(null);
  // FAQ accordion state
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const fetchPaymentMethods = useCallback(async () => {
    try {
      const response = await fetch("/api/payments/methods");
      const data = await response.json();
      if (data.success) {
        setPaymentMethods(data.data.paymentMethods || []);
        return data.data.paymentMethods || [];
      }
    } catch {
      // Non-critical
    }
    return [];
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [packagesRes, profileRes] = await Promise.all([
        fetch("/api/payments/packages"),
        fetch("/api/users/profile"),
      ]);

      const packagesData = await packagesRes.json();
      const profileData = await profileRes.json();

      if (packagesData.success) {
        setPlans(packagesData.data.plans);
      }

      if (profileData.success) {
        setUser({ plan: profileData.data.user.plan });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchPaymentMethods();
  }, [fetchData, fetchPaymentMethods]);

  const processSubscription = useCallback(async (planId: string, paymentMethodId: string) => {
    setIsCheckingOut(true);
    setSelectedPlan(planId);

    try {
      const response = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "subscription",
          planId,
          interval: billingInterval,
          paymentMethodId,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to create subscription");
      }

      // Handle 3DS authentication if needed
      if (data.data.requiresAction && data.data.clientSecret && stripeInstance) {
        const { error: confirmError } = await stripeInstance.confirmCardPayment(data.data.clientSecret);
        if (confirmError) {
          throw new Error(confirmError.message || "Payment authentication failed");
        }
      }

      // Confirm subscription and update plan in DB immediately (don't wait for webhook)
      if (data.data.subscriptionId) {
        await fetch("/api/payments/confirm-subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscriptionId: data.data.subscriptionId }),
        });
      }

      // Notify layout/nav of plan change
      emitPlanUpdate(planId);

      toast({
        title: "Subscription activated!",
        description: "Your plan has been upgraded successfully.",
      });
      router.push("/settings?tab=billing&payment=success&type=subscription");
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create subscription",
        variant: "destructive",
      });
    } finally {
      setIsCheckingOut(false);
      setSelectedPlan(null);
      setConfirmPlan(null);
      setConfirmPaymentMethod(null);
    }
  }, [billingInterval, stripeInstance, toast, router]);

  // Show confirmation dialog (or add card first if needed)
  const handleSelectPlan = (planId: string) => {
    if (planId === "STARTER") {
      toast({
        title: "Downgrade to Starter",
        description: "Please contact support to downgrade to the free plan.",
      });
      return;
    }

    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;

    // Check if user has a payment method
    const defaultMethod = paymentMethods.find((m) => m.isDefault) || paymentMethods[0];
    if (!defaultMethod) {
      // No payment method — show add card modal, store pending plan in ref
      pendingPlanIdRef.current = planId;
      setShowAddCardModal(true);
      return;
    }

    // Show confirmation dialog
    setConfirmPlan(plan);
    setConfirmPaymentMethod(defaultMethod);
  };

  // Confirm and process the upgrade
  const handleConfirmUpgrade = async () => {
    if (!confirmPlan || !confirmPaymentMethod) return;
    await processSubscription(confirmPlan.id, confirmPaymentMethod.id);
  };

  // After card is added, show the confirmation dialog for the pending plan
  const handleCardAdded = useCallback(async () => {
    toast({ title: "Card saved", description: "Your payment method has been added." });

    // Fetch updated payment methods
    const methods: PaymentMethod[] = await fetchPaymentMethods();
    const method = methods.find((m: PaymentMethod) => m.isDefault) || methods[0];

    // If there was a pending plan, show confirmation dialog
    const pendingId = pendingPlanIdRef.current;
    pendingPlanIdRef.current = null;

    if (pendingId && method) {
      const plan = plans.find((p) => p.id === pendingId);
      if (plan) {
        setConfirmPlan(plan);
        setConfirmPaymentMethod(method);
      }
    }
  }, [fetchPaymentMethods, toast, plans]);

  const getPlanStatus = (planId: string) => {
    if (!user) return "available";

    const planOrder = ["STARTER", "PRO", "BUSINESS", "ENTERPRISE"];
    const currentIndex = planOrder.indexOf(user.plan || "STARTER");
    const targetIndex = planOrder.indexOf(planId);

    if (targetIndex === currentIndex) return "current";
    if (targetIndex > currentIndex) return "upgrade";
    return "downgrade";
  };

  const getPrice = (plan: PlanData) => {
    if (billingInterval === "yearly") {
      const yearlyPrice = plan.priceCentsYearly / 100;
      const monthlyEquivalent = yearlyPrice / 12;
      return {
        display: monthlyEquivalent.toFixed(2),
        total: yearlyPrice.toFixed(2),
        savings: ((plan.priceCentsMonthly * 12 - plan.priceCentsYearly) / 100).toFixed(2),
      };
    }
    return {
      display: (plan.priceCentsMonthly / 100).toFixed(2),
      total: null,
      savings: null,
    };
  };

  if (error && !plans.length) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={fetchData} variant="outline">
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
      className="flex-1 flex flex-col space-y-8 p-6"
    >
      {/* Back Button */}
      <div className="flex items-center">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/settings?tab=billing">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
      </div>

      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-500/10 to-purple-500/10 border border-brand-500/10 px-8 py-10 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-purple-600 shadow-lg shadow-purple-500/25">
          <Crown className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-2">Choose Your Plan</h1>
        <p className="text-muted-foreground max-w-md mx-auto mb-6">
          Unlock powerful AI tools and grow your business faster
        </p>

        {/* Billing Toggle */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 p-1 rounded-xl bg-background/80 backdrop-blur-sm border shadow-sm">
            <button
              onClick={() => setBillingInterval("monthly")}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                billingInterval === "monthly"
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingInterval("yearly")}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                billingInterval === "yearly"
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Yearly
              <Badge variant="secondary" className="bg-green-500/15 text-green-600 dark:text-green-400 text-xs border-0">
                Save 17%
              </Badge>
            </button>
          </div>
        </div>
      </div>

      {/* Plans Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[520px] rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
          {plans.map((plan) => {
            const Icon = planIcons[plan.id] || Sparkles;
            const colorClass = planColors[plan.id] || "from-gray-500 to-gray-700";
            const accentColor = planAccentColors[plan.id] || "from-gray-400 to-gray-600";
            const creditBg = planCreditBg[plan.id] || "bg-gray-500/5";
            const description = planDescriptions[plan.id] || "";
            const status = getPlanStatus(plan.id);
            const price = getPrice(plan);
            const isPopular = plan.id === "PRO";
            const isCurrent = status === "current";

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border bg-card text-card-foreground overflow-hidden transition-all duration-200 hover:shadow-lg ${
                  isCurrent
                    ? "ring-2 ring-green-500/50 shadow-md"
                    : isPopular
                    ? "shadow-xl ring-2 ring-purple-500/50 scale-[1.02]"
                    : "hover:shadow-md"
                }`}
              >
                {/* Top Accent Strip */}
                <div className={`h-1 w-full bg-gradient-to-r ${accentColor}`} />

                {/* Popular Badge */}
                {isPopular && !isCurrent && (
                  <div className="absolute top-1 right-0 z-10">
                    <div className="bg-gradient-to-r from-brand-500 to-purple-600 text-white text-xs font-semibold px-3.5 py-1.5 rounded-bl-xl shadow-md">
                      Most Popular
                    </div>
                  </div>
                )}

                {/* Current Plan Badge */}
                {isCurrent && (
                  <div className="absolute top-1 right-0 z-10">
                    <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs font-semibold px-3.5 py-1.5 rounded-bl-xl shadow-md flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Current Plan
                    </div>
                  </div>
                )}

                <div className="flex flex-col flex-1 p-6 pt-5">
                  {/* Icon & Title */}
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${colorClass} flex items-center justify-center mb-4 shadow-sm`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground min-h-[40px] mb-5">
                    {description}
                  </p>

                  {/* Pricing */}
                  <div className="mb-5">
                    {plan.priceCentsMonthly === 0 ? (
                      <div className="text-4xl font-bold">Free</div>
                    ) : (
                      <>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-4xl font-bold">${price.display}</span>
                          <span className="text-sm text-muted-foreground">/month</span>
                        </div>
                        {billingInterval === "yearly" && price.total && (
                          <div className="mt-1.5 space-y-0.5">
                            <p className="text-sm text-muted-foreground">
                              ${price.total} billed annually
                            </p>
                            {price.savings && (
                              <p className="text-sm font-medium text-green-600 dark:text-green-400">
                                You save ${price.savings}/year
                              </p>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Credits */}
                  <div className={`flex items-center gap-2.5 p-3.5 rounded-xl ${creditBg} mb-5`}>
                    <Sparkles className="w-4.5 h-4.5 text-brand-500 shrink-0" />
                    <span className="font-semibold text-sm">
                      {plan.monthlyCredits.toLocaleString()} credits/month
                    </span>
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-6 flex-1">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2.5 text-[13px] leading-relaxed">
                        <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Action Button */}
                  <div className="pt-2 mt-auto">
                    {isCurrent ? (
                      <Button
                        variant="outline"
                        className="w-full border-green-500/30 text-green-600 dark:text-green-400 hover:bg-green-500/5"
                        disabled
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Current Plan
                      </Button>
                    ) : status === "upgrade" ? (
                      <Button
                        className={`w-full bg-gradient-to-r ${colorClass} hover:opacity-90 text-white shadow-sm transition-all`}
                        onClick={() => handleSelectPlan(plan.id)}
                        disabled={isCheckingOut}
                      >
                        {isCheckingOut && selectedPlan === plan.id ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Zap className="w-4 h-4 mr-2" />
                        )}
                        Upgrade to {plan.name}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => handleSelectPlan(plan.id)}
                        disabled={isCheckingOut}
                      >
                        {isCheckingOut && selectedPlan === plan.id ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : null}
                        Downgrade to {plan.name}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Trust Indicators */}
      {!isLoading && (
        <div className="flex flex-wrap items-center justify-center gap-8 py-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="w-4 h-4 text-green-500" />
            <span>Secure payment</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="w-4 h-4 text-blue-500" />
            <span>Cancel anytime</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Zap className="w-4 h-4 text-amber-500" />
            <span>Instant access</span>
          </div>
        </div>
      )}

      {/* Payment Method Indicator */}
      {!isLoading && paymentMethods.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-500/5 border border-green-500/20">
          <CreditCard className="w-4 h-4 text-green-600 shrink-0" />
          <span className="text-sm text-green-700 dark:text-green-400">
            Payment method: <span className="capitalize">{paymentMethods[0].brand}</span> ending in {paymentMethods[0].last4}
          </span>
        </div>
      )}

      {/* FAQ Section - Accordion */}
      <div className="max-w-2xl mx-auto w-full">
        <h2 className="text-lg font-semibold mb-4 text-center">Frequently Asked Questions</h2>
        <div className="divide-y rounded-xl border overflow-hidden">
          {faqItems.map((item, index) => (
            <div key={index} className="bg-card">
              <button
                onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/50 transition-colors"
              >
                <span className="font-medium text-sm pr-4">{item.question}</span>
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 ${
                    expandedFaq === index ? "rotate-180" : ""
                  }`}
                />
              </button>
              <AnimatePresence initial={false}>
                {expandedFaq === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <p className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">
                      {item.answer}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>

      {/* Add Card Modal */}
      <AddCardForm
        open={showAddCardModal}
        onClose={() => {
          setShowAddCardModal(false);
          // Don't clear pendingPlanIdRef here — handleCardAdded reads it
        }}
        onSuccess={handleCardAdded}
      />

      {/* Upgrade Confirmation Dialog */}
      <AnimatePresence>
        {confirmPlan && confirmPaymentMethod && (
          <Dialog
            open={!!confirmPlan}
            onOpenChange={(open) => {
              if (!open && !isCheckingOut) {
                setConfirmPlan(null);
                setConfirmPaymentMethod(null);
              }
            }}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${planColors[confirmPlan.id] || "from-gray-500 to-gray-700"} flex items-center justify-center`}>
                    <Crown className="w-4 h-4 text-white" />
                  </div>
                  Confirm Upgrade
                </DialogTitle>
                <DialogDescription>
                  Review your upgrade details before proceeding
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Plan Details */}
                <div className="p-4 rounded-xl bg-muted/50 border space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Plan</span>
                    <span className="font-semibold">{confirmPlan.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Billing</span>
                    <span className="font-medium capitalize">{billingInterval}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Monthly Credits</span>
                    <span className="font-medium">{confirmPlan.monthlyCredits.toLocaleString()}</span>
                  </div>

                  <div className="border-t pt-3 mt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {billingInterval === "yearly" ? "Annual Total" : "Monthly Total"}
                      </span>
                      <span className="text-lg font-bold">
                        ${billingInterval === "yearly"
                          ? (confirmPlan.priceCentsYearly / 100).toFixed(2)
                          : (confirmPlan.priceCentsMonthly / 100).toFixed(2)
                        }
                      </span>
                    </div>
                    {billingInterval === "yearly" && (
                      <p className="text-xs text-green-600 text-right mt-1">
                        ${((confirmPlan.priceCentsYearly / 100) / 12).toFixed(2)}/month — Save ${((confirmPlan.priceCentsMonthly * 12 - confirmPlan.priceCentsYearly) / 100).toFixed(2)}/year
                      </p>
                    )}
                  </div>
                </div>

                {/* Payment Method */}
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-background">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
                    <CreditCard className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      <span className="capitalize">{confirmPaymentMethod.brand}</span> ending in {confirmPaymentMethod.last4}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Expires {confirmPaymentMethod.expMonth}/{confirmPaymentMethod.expYear}
                    </p>
                  </div>
                  <Check className="w-4 h-4 text-green-500 shrink-0" />
                </div>

                {/* Security Note */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Shield className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  <span>Your payment is securely processed by Stripe. You can cancel anytime.</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setConfirmPlan(null);
                    setConfirmPaymentMethod(null);
                  }}
                  disabled={isCheckingOut}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-brand-500 to-purple-600 hover:from-brand-600 hover:to-purple-700"
                  onClick={handleConfirmUpgrade}
                  disabled={isCheckingOut}
                >
                  {isCheckingOut ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      Confirm Upgrade
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
