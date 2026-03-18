"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Sparkles, Zap, Briefcase, Crown, Heart, Check, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

const PLANS = [
  {
    id: "STARTER",
    name: "Starter",
    price: 0,
    yearlyPrice: 0,
    credits: 100,
    icon: Sparkles,
    color: "from-gray-400 to-gray-600",
    borderColor: "border-gray-200 dark:border-gray-700",
    features: [
      "100 credits/month",
      "Email marketing",
      "Basic design tools",
      "Feed access",
      "Data collection forms",
    ],
  },
  {
    id: "NON_PROFIT",
    name: "Non-Profit",
    price: 9,
    yearlyPrice: 99,
    credits: 300,
    icon: Heart,
    color: "from-emerald-500 to-teal-600",
    borderColor: "border-emerald-200 dark:border-emerald-800",
    badge: "For Orgs",
    features: [
      "300 credits/month",
      "FlowAI assistant",
      "Logo generator & brand kit",
      "Campaigns & surveys",
      "Social analytics",
      "Events management",
    ],
  },
  {
    id: "PRO",
    name: "Pro",
    price: 19.99,
    yearlyPrice: 199.90,
    credits: 500,
    icon: Zap,
    color: "from-violet-500 to-purple-600",
    borderColor: "border-violet-300 dark:border-violet-700",
    badge: "Popular",
    isPopular: true,
    features: [
      "500 credits/month",
      "All AI creative tools",
      "SMS & WhatsApp marketing",
      "Ad campaigns & landing pages",
      "E-commerce store",
      "Agent marketplace",
    ],
  },
  {
    id: "BUSINESS",
    name: "Business",
    price: 49.99,
    yearlyPrice: 499.90,
    credits: 1500,
    icon: Briefcase,
    color: "from-amber-500 to-orange-600",
    borderColor: "border-amber-200 dark:border-amber-800",
    features: [
      "1,500 credits/month",
      "Everything in Pro",
      "Team collaboration",
      "Store analytics & AI intelligence",
      "Priority support",
    ],
  },
  {
    id: "ENTERPRISE",
    name: "Enterprise",
    price: 149.99,
    yearlyPrice: 1499.90,
    credits: 5000,
    icon: Crown,
    color: "from-red-500 to-rose-600",
    borderColor: "border-red-200 dark:border-red-800",
    features: [
      "5,000 credits/month",
      "Everything in Business",
      "White-label support",
      "Custom integrations",
      "Dedicated support",
    ],
  },
];

export default function SelectPlanPage() {
  const router = useRouter();
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleContinue = async () => {
    const plan = selectedPlan || "STARTER";
    setIsProcessing(true);

    if (plan === "STARTER") {
      // Free plan — go straight to feature selection
      router.push("/onboarding/features");
      return;
    }

    // Paid plan — redirect to Stripe checkout, then return to feature selection
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "subscription",
          planId: plan,
          interval: billing === "yearly" ? "yearly" : "monthly",
          successUrl: `${window.location.origin}/onboarding/features`,
          cancelUrl: `${window.location.origin}/select-plan`,
        }),
      });
      const data = await res.json();
      if (data.success && data.data?.url) {
        window.location.href = data.data.url;
      } else {
        // If checkout creation fails, still allow feature selection
        router.push("/onboarding/features");
      }
    } catch {
      router.push("/onboarding/features");
    }
  };

  return (
    <div className="text-center">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center text-sm font-bold">
            1
          </div>
          <span className="text-sm font-medium">Choose Plan</span>
        </div>
        <div className="w-12 h-px bg-border" />
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm font-bold">
            2
          </div>
          <span className="text-sm text-muted-foreground">Select Features</span>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
          Choose the right plan for you
        </h1>
        <p className="text-muted-foreground text-lg mb-6 max-w-2xl mx-auto">
          Start free and scale as you grow. All plans include core features — upgrade anytime.
        </p>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <button
            onClick={() => setBilling("monthly")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              billing === "monthly" ? "bg-brand-500 text-white" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling("yearly")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              billing === "yearly" ? "bg-brand-500 text-white" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Yearly
            <Badge variant="secondary" className="ml-2 text-xs">Save ~17%</Badge>
          </button>
        </div>
      </motion.div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
        {PLANS.map((plan, idx) => {
          const Icon = plan.icon;
          const isSelected = selectedPlan === plan.id;
          const price = billing === "yearly"
            ? (plan.yearlyPrice / 12).toFixed(2)
            : plan.price.toFixed(2);

          return (
            <motion.button
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => setSelectedPlan(plan.id)}
              className={cn(
                "relative flex flex-col rounded-2xl border-2 p-5 text-left transition-all hover:shadow-lg",
                isSelected
                  ? "border-brand-500 bg-brand-50/50 dark:bg-brand-950/20 shadow-md ring-2 ring-brand-500/20"
                  : plan.borderColor + " bg-card hover:border-brand-300 dark:hover:border-brand-700"
              )}
            >
              {plan.badge && (
                <Badge
                  className={cn(
                    "absolute -top-2.5 left-1/2 -translate-x-1/2 text-xs",
                    plan.isPopular ? "bg-brand-500 text-white" : "bg-emerald-500 text-white"
                  )}
                >
                  {plan.badge}
                </Badge>
              )}

              {/* Icon */}
              <div className={cn("w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center mb-3", plan.color)}>
                <Icon className="w-5 h-5 text-white" />
              </div>

              {/* Name + Price */}
              <h3 className="font-bold text-lg">{plan.name}</h3>
              <div className="mt-1 mb-3">
                {plan.price === 0 ? (
                  <span className="text-2xl font-bold">Free</span>
                ) : (
                  <>
                    <span className="text-2xl font-bold">${price}</span>
                    <span className="text-muted-foreground text-sm">/mo</span>
                  </>
                )}
              </div>

              <p className="text-xs text-muted-foreground mb-4">
                {plan.credits.toLocaleString()} credits/month
              </p>

              {/* Features */}
              <ul className="space-y-2 flex-1">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {/* Selection indicator */}
              <div className={cn(
                "mt-4 pt-4 border-t text-center text-sm font-medium",
                isSelected ? "text-brand-600 dark:text-brand-400" : "text-muted-foreground"
              )}>
                {isSelected ? "Selected" : "Select"}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Continue button */}
      <div className="flex flex-col items-center gap-3">
        <Button
          size="lg"
          className="px-10 text-base"
          onClick={handleContinue}
          disabled={isProcessing}
        >
          {isProcessing ? (
            "Processing..."
          ) : selectedPlan && selectedPlan !== "STARTER" ? (
            <>Continue to Payment <ArrowRight className="ml-2 h-4 w-4" /></>
          ) : (
            <>Continue with Free Plan <ArrowRight className="ml-2 h-4 w-4" /></>
          )}
        </Button>
        <button
          onClick={() => router.push("/onboarding/features")}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip — I already have a plan
        </button>
      </div>
    </div>
  );
}
