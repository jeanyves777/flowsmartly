"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  Store,
  Package,
  Truck,
  CreditCard,
  BarChart3,
  Loader2,
  Check,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface StoreData {
  id: string;
  ecomSubscriptionStatus: string;
  setupComplete: boolean;
  isActive: boolean;
}

const FEATURES = [
  { icon: Store, label: "Online store with custom domain" },
  { icon: Package, label: "Product management with variants & inventory" },
  { icon: BarChart3, label: "Order tracking & analytics" },
  { icon: Truck, label: "Delivery driver management" },
  { icon: CreditCard, label: "Multiple payment methods by region" },
];

export default function EcommercePage() {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [store, setStore] = useState<StoreData | null>(null);

  useEffect(() => {
    fetchStore();
  }, []);

  async function fetchStore() {
    try {
      const res = await fetch("/api/ecommerce/store");
      const json = await res.json();

      if (json.success && json.data.hasStore) {
        const s = json.data.store;
        setStore(s);

        // Redirect based on state
        if (s.ecomSubscriptionStatus === "active" && s.setupComplete) {
          router.replace("/ecommerce/dashboard");
          return;
        }
        if (s.ecomSubscriptionStatus === "active" && !s.setupComplete) {
          router.replace("/ecommerce/onboarding");
          return;
        }
      }
    } catch (error) {
      console.error("Failed to fetch store:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleActivate() {
    if (!agreed) {
      toast({
        title: "Agreement required",
        description: "Please agree to the FlowShop Terms of Service to continue.",
        variant: "destructive",
      });
      return;
    }

    setActivating(true);
    try {
      const res = await fetch("/api/ecommerce/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const json = await res.json();

      if (!json.success) {
        toast({
          title: "Activation failed",
          description: json.error?.message || "Something went wrong",
          variant: "destructive",
        });
        return;
      }

      if (json.data.flow === "checkout" && json.data.url) {
        // Redirect to Stripe Checkout
        window.location.href = json.data.url;
      } else {
        // Inline subscription created — redirect to onboarding
        toast({
          title: "FlowShop activated!",
          description: "Let's set up your store.",
        });
        router.push("/ecommerce/onboarding");
      }
    } catch (error) {
      console.error("Activation error:", error);
      toast({
        title: "Error",
        description: "Failed to activate FlowShop. Please try again.",
        variant: "destructive",
      });
    } finally {
      setActivating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading FlowShop...</p>
        </div>
      </div>
    );
  }

  // Show activation page if no store or subscription not active
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <Card className="w-full max-w-lg">
        <CardContent className="pt-8 pb-8 px-8">
          {/* Branding */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <ShoppingBag className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">FlowShop</h1>
            <p className="text-muted-foreground mt-1">
              Your all-in-one e-commerce solution
            </p>
          </div>

          {/* Features */}
          <div className="space-y-3 mb-8">
            {FEATURES.map((feature) => (
              <div key={feature.label} className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-green-50 dark:bg-green-950/30 flex items-center justify-center flex-shrink-0">
                  <feature.icon className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-sm">{feature.label}</span>
              </div>
            ))}
          </div>

          {/* Pricing */}
          <div className="text-center mb-6">
            <div className="inline-flex items-baseline gap-1">
              <span className="text-3xl font-bold">$5</span>
              <span className="text-muted-foreground">/month</span>
            </div>
          </div>

          {/* Agreement */}
          <label className="flex items-start gap-3 mb-6 cursor-pointer group">
            <div className="relative mt-0.5">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="sr-only peer"
              />
              <div className="h-5 w-5 rounded border-2 border-muted-foreground/30 peer-checked:border-primary peer-checked:bg-primary transition-colors flex items-center justify-center">
                {agreed && <Check className="h-3 w-3 text-primary-foreground" />}
              </div>
            </div>
            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
              I agree to the FlowShop Terms of Service
            </span>
          </label>

          {/* Activate Button */}
          <Button
            onClick={handleActivate}
            disabled={!agreed || activating}
            className="w-full h-12 text-base"
            size="lg"
          >
            {activating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Activating...
              </>
            ) : (
              <>
                Activate FlowShop — $5/month
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
