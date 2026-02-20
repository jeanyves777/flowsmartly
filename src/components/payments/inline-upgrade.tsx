"use client";

import { useState, useCallback, useRef } from "react";
import { emitPlanUpdate } from "@/lib/utils/plan-event";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Crown,
  Zap,
  Building2,
  Rocket,
  Loader2,
  Sparkles,
  Shield,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

interface InlineUpgradeProps {
  plans: PlanData[];
  currentPlan: string;
  paymentMethods: PaymentMethod[];
  onUpgradeSuccess: () => void;
  onPaymentMethodsChanged: () => Promise<PaymentMethod[]>;
}

const planIcons: Record<string, React.ElementType> = {
  STARTER: Sparkles,
  PRO: Zap,
  BUSINESS: Building2,
  ENTERPRISE: Rocket,
};

const planColors: Record<string, string> = {
  STARTER: "from-gray-400 to-gray-600",
  PRO: "from-brand-500 to-purple-600",
  BUSINESS: "from-blue-500 to-indigo-600",
  ENTERPRISE: "from-orange-500 to-red-600",
};

const planBtnColors: Record<string, string> = {
  PRO: "bg-gradient-to-r from-brand-500 to-purple-600 hover:from-brand-600 hover:to-purple-700",
  BUSINESS: "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700",
  ENTERPRISE: "bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700",
};

function InlineUpgradeInner({
  plans,
  currentPlan,
  paymentMethods,
  onUpgradeSuccess,
  onPaymentMethodsChanged,
}: InlineUpgradeProps) {
  const { toast } = useToast();
  const stripeInstance = useStripe();
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [confirmPlan, setConfirmPlan] = useState<PlanData | null>(null);
  const [confirmPaymentMethod, setConfirmPaymentMethod] = useState<PaymentMethod | null>(null);
  const pendingPlanIdRef = useRef<string | null>(null);
  // Keep a local copy of methods that can be updated after adding a card
  const [localMethods, setLocalMethods] = useState<PaymentMethod[]>(paymentMethods);

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
      onUpgradeSuccess();
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
  }, [billingInterval, stripeInstance, toast, onUpgradeSuccess]);

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

    const methods = localMethods.length > 0 ? localMethods : paymentMethods;
    const defaultMethod = methods.find((m) => m.isDefault) || methods[0];
    if (!defaultMethod) {
      pendingPlanIdRef.current = planId;
      setShowAddCardModal(true);
      return;
    }

    setConfirmPlan(plan);
    setConfirmPaymentMethod(defaultMethod);
  };

  const handleConfirmUpgrade = async () => {
    if (!confirmPlan || !confirmPaymentMethod) return;
    await processSubscription(confirmPlan.id, confirmPaymentMethod.id);
  };

  const handleCardAdded = useCallback(async () => {
    toast({ title: "Card saved", description: "Your payment method has been added." });

    const methods = await onPaymentMethodsChanged();
    setLocalMethods(methods);
    const method = methods.find((m: PaymentMethod) => m.isDefault) || methods[0];

    const pendingId = pendingPlanIdRef.current;
    pendingPlanIdRef.current = null;

    if (pendingId && method) {
      const plan = plans.find((p) => p.id === pendingId);
      if (plan) {
        setConfirmPlan(plan);
        setConfirmPaymentMethod(method);
      }
    }
  }, [onPaymentMethodsChanged, toast, plans]);

  const getPlanStatus = (planId: string) => {
    const planOrder = ["STARTER", "PRO", "BUSINESS", "ENTERPRISE"];
    const currentIndex = planOrder.indexOf(currentPlan || "STARTER");
    const targetIndex = planOrder.indexOf(planId);
    if (targetIndex === currentIndex) return "current";
    if (targetIndex > currentIndex) return "upgrade";
    return "downgrade";
  };

  const getPrice = (plan: PlanData) => {
    if (billingInterval === "yearly") {
      const yearlyPrice = plan.priceCentsYearly / 100;
      const monthlyEquivalent = yearlyPrice / 12;
      return { display: monthlyEquivalent.toFixed(2), savings: ((plan.priceCentsMonthly * 12 - plan.priceCentsYearly) / 100).toFixed(2) };
    }
    return { display: (plan.priceCentsMonthly / 100).toFixed(2), savings: null };
  };

  // Filter plans: show all including STARTER
  const allPlans = plans.length > 0 ? plans : [];

  return (
    <>
      {/* Monthly/Yearly Toggle */}
      <div className="flex justify-center mb-4">
        <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-muted">
          <button
            onClick={() => setBillingInterval("monthly")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              billingInterval === "monthly"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingInterval("yearly")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
              billingInterval === "yearly"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Yearly
            <Badge variant="secondary" className="bg-green-500/10 text-green-600 text-[10px] px-1.5 py-0">
              -17%
            </Badge>
          </button>
        </div>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {allPlans.map((plan) => {
          const Icon = planIcons[plan.id] || Sparkles;
          const colorClass = planColors[plan.id] || "from-gray-400 to-gray-600";
          const status = getPlanStatus(plan.id);
          const price = getPrice(plan);
          const isPopular = plan.id === "PRO";

          return (
            <div
              key={plan.id}
              className={`relative rounded-xl border overflow-hidden transition-all ${
                status === "current"
                  ? "ring-2 ring-green-500/50 border-green-500/30"
                  : isPopular
                  ? "ring-2 ring-purple-500/50 border-purple-500/30"
                  : "hover:border-brand-500/30 hover:shadow-sm"
              }`}
            >
              {/* Color accent strip */}
              <div className={`h-1 bg-gradient-to-r ${colorClass}`} />

              {/* Popular badge */}
              {isPopular && status !== "current" && (
                <div className="absolute top-1 right-0">
                  <div className="bg-gradient-to-r from-brand-500 to-purple-600 text-white text-[10px] font-medium px-2 py-0.5 rounded-l-md">
                    Popular
                  </div>
                </div>
              )}

              {/* Current badge */}
              {status === "current" && (
                <div className="absolute top-1 right-0">
                  <div className="bg-green-500 text-white text-[10px] font-medium px-2 py-0.5 rounded-l-md flex items-center gap-1">
                    <Check className="w-2.5 h-2.5" /> Current
                  </div>
                </div>
              )}

              <div className="p-4 space-y-3">
                {/* Icon + Name */}
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${colorClass} flex items-center justify-center shadow-sm`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <h4 className="font-semibold">{plan.name}</h4>
                </div>

                {/* Price */}
                <div>
                  {plan.priceCentsMonthly === 0 ? (
                    <p className="text-2xl font-bold">Free</p>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-0.5">
                        <span className="text-2xl font-bold">${price.display}</span>
                        <span className="text-xs text-muted-foreground">/mo</span>
                      </div>
                      {billingInterval === "yearly" && price.savings && (
                        <p className="text-[11px] text-green-600 mt-0.5">Save ${price.savings}/year</p>
                      )}
                    </>
                  )}
                </div>

                {/* Credits */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Sparkles className="w-3 h-3 text-brand-500" />
                  {plan.monthlyCredits.toLocaleString()} credits/mo
                </div>

                {/* Features */}
                <ul className="space-y-1.5">
                  {plan.features.slice(0, 4).map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <Check className="w-3 h-3 text-green-500 shrink-0 mt-0.5" />
                      <span className="line-clamp-1">{feature}</span>
                    </li>
                  ))}
                  {plan.features.length > 4 && (
                    <li className="text-[11px] text-muted-foreground pl-4">+{plan.features.length - 4} more</li>
                  )}
                </ul>

                {/* CTA */}
                <div className="pt-1">
                  {status === "current" ? (
                    <Button variant="outline" size="sm" className="w-full text-xs border-green-500/30 text-green-600" disabled>
                      <Check className="w-3 h-3 mr-1" /> Current Plan
                    </Button>
                  ) : status === "upgrade" ? (
                    <Button
                      size="sm"
                      className={`w-full text-xs text-white ${planBtnColors[plan.id] || "bg-gradient-to-r from-brand-500 to-purple-600"}`}
                      onClick={() => handleSelectPlan(plan.id)}
                      disabled={isCheckingOut}
                    >
                      {isCheckingOut && selectedPlan === plan.id ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Zap className="w-3 h-3 mr-1" />
                      )}
                      Upgrade
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => handleSelectPlan(plan.id)}
                      disabled={isCheckingOut}
                    >
                      Downgrade
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Card Modal */}
      <AddCardForm
        open={showAddCardModal}
        onClose={() => setShowAddCardModal(false)}
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

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Shield className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  <span>Securely processed by Stripe. Cancel anytime.</span>
                </div>
              </div>

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
    </>
  );
}

/**
 * Self-contained inline upgrade component with StripeProvider.
 * Drop into any page — handles plan selection, payment, and 3DS.
 */
export function InlineUpgrade(props: InlineUpgradeProps) {
  return (
    <StripeProvider>
      <InlineUpgradeInner {...props} />
    </StripeProvider>
  );
}
