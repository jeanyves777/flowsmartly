"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Zap, Building2, Rocket, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface PlanData {
  id: string;
  name: string;
  monthlyCredits: number;
  priceCentsMonthly: number;
  priceCentsYearly: number;
  features: string[];
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

export default function SelectPlanPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await fetch("/api/payments/packages");
        const data = await response.json();
        if (data.success) {
          setPlans(data.data.plans || []);
        }
      } catch (error) {
        console.error("Failed to fetch plans:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPlans();
  }, []);

  const handleSelectPlan = (plan: PlanData) => {
    if (plan.name === "STARTER") {
      router.push("/dashboard");
    } else {
      router.push(`/settings/upgrade?plan=${plan.id}`);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Choose Your Plan</h1>
        <p className="text-muted-foreground mb-8">Loading available plans...</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="relative">
              <CardHeader>
                <Skeleton className="h-12 w-12 rounded-lg mx-auto mb-4" />
                <Skeleton className="h-6 w-24 mx-auto" />
                <Skeleton className="h-8 w-20 mx-auto mt-2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((j) => (
                    <Skeleton key={j} className="h-4 w-full" />
                  ))}
                </div>
                <Skeleton className="h-10 w-full mt-6" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="text-center">
      <h1 className="text-3xl font-bold mb-2">Choose Your Plan</h1>
      <p className="text-muted-foreground mb-8">
        Select the plan that fits your needs. You can always change it later.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {plans.map((plan) => {
          const Icon = planIcons[plan.name] || Sparkles;
          const gradient = planColors[plan.name] || "from-gray-500 to-gray-700";
          const isPopular = plan.name === "PRO";
          const isFree = plan.priceCentsMonthly === 0;

          return (
            <Card
              key={plan.id}
              className={`relative flex flex-col ${
                isPopular ? "border-brand-500 border-2 shadow-lg" : ""
              }`}
            >
              {isPopular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-500 text-white">
                  Popular
                </Badge>
              )}
              <CardHeader className="text-center pb-4">
                <div
                  className={`w-12 h-12 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center mx-auto mb-3`}
                >
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <div className="mt-2">
                  {isFree ? (
                    <span className="text-3xl font-bold">Free</span>
                  ) : (
                    <>
                      <span className="text-3xl font-bold">
                        ${(plan.priceCentsMonthly / 100).toFixed(2)}
                      </span>
                      <span className="text-muted-foreground">/mo</span>
                    </>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {plan.monthlyCredits.toLocaleString()} credits/month
                </p>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <ul className="space-y-2 text-sm text-left flex-1">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => handleSelectPlan(plan)}
                  className="w-full mt-6"
                  variant={isPopular ? "default" : "outline"}
                  size="lg"
                >
                  {isFree ? "Get Started Free" : `Choose ${plan.name}`}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground">
        <button
          onClick={() => router.push("/dashboard")}
          className="text-brand-500 hover:text-brand-600 font-medium hover:underline"
        >
          Continue with Starter (Free)
        </button>
      </p>
    </div>
  );
}
