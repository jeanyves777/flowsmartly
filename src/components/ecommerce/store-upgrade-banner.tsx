"use client";

import { useState, useEffect } from "react";
import { Sparkles, Rocket, X, ArrowRight, Package, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AIGenerationLoader } from "@/components/shared/ai-generation-loader";
import { useToast } from "@/hooks/use-toast";

interface StoreUpgradeBannerProps {
  storeId: string;
  storeName: string;
  generatorVersion: string;
  buildStatus: string;
}

export function StoreUpgradeBanner({
  storeId,
  storeName,
  generatorVersion,
  buildStatus,
}: StoreUpgradeBannerProps) {
  const { toast } = useToast();
  const [dismissed, setDismissed] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrationStep, setMigrationStep] = useState("");
  const [migrationInfo, setMigrationInfo] = useState<{
    productCount: number;
    categoryCount: number;
    creditCost: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const isV1 = generatorVersion === "v1" || !generatorVersion;

  useEffect(() => {
    if (!isV1) { setLoading(false); return; }

    const key = `flowshop-upgrade-dismissed-${storeId}`;
    if (sessionStorage.getItem(key)) {
      setDismissed(true);
      setLoading(false);
      return;
    }

    fetch(`/api/ecommerce/store/${storeId}/migrate`)
      .then(res => res.json())
      .then(data => {
        if (data.eligible) {
          setMigrationInfo({
            productCount: data.productCount,
            categoryCount: data.categoryCount,
            creditCost: data.creditCost,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [storeId, isV1]);

  if (!isV1 || dismissed || loading || !migrationInfo) return null;

  // Building state — use the shared AIGenerationLoader
  if (migrating || buildStatus === "building") {
    return (
      <div className="mb-6 p-6 rounded-2xl bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 border border-purple-200 dark:border-purple-800">
        <AIGenerationLoader
          compact
          currentStep={migrationStep || "Upgrading your store..."}
          subtitle="This takes 2-3 minutes. Your existing products and orders are safe."
        />
      </div>
    );
  }

  const handleMigrate = async () => {
    setMigrating(true);
    setMigrationStep("Starting migration...");

    try {
      const res = await fetch(`/api/ecommerce/store/${storeId}/migrate`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        toast({ title: "Migration failed", description: data.error || "Please try again", variant: "destructive" });
        setMigrating(false);
        return;
      }

      setMigrationStep("Collecting your products and brand data...");

      // Poll for completion — keep polling until done, no premature timeout
      const poll = async () => {
        let elapsed = 0;
        const maxWait = 600; // 10 minutes max

        while (elapsed < maxWait) {
          await new Promise(r => setTimeout(r, 5000));
          elapsed += 5;

          // Update step text based on time
          if (elapsed < 20) setMigrationStep("AI agent is reading your brand identity...");
          else if (elapsed < 40) setMigrationStep("Writing store components...");
          else if (elapsed < 60) setMigrationStep("Downloading product images...");
          else if (elapsed < 90) setMigrationStep("Building your store...");
          else if (elapsed < 120) setMigrationStep("Compiling pages...");
          else if (elapsed < 150) setMigrationStep("Deploying...");
          else setMigrationStep("Almost done...");

          try {
            const statusRes = await fetch(`/api/ecommerce/store/${storeId}/generate`);
            if (statusRes.ok) {
              const status = await statusRes.json();

              if (status.buildStatus === "built") {
                setMigrationStep("Store upgraded successfully!");
                toast({ title: "Store upgraded to V3!" });
                // Hard reload to reflect V3 state everywhere
                setTimeout(() => window.location.reload(), 1000);
                return;
              }

              if (status.buildStatus === "error") {
                toast({
                  title: "Build failed",
                  description: status.lastBuildError?.substring(0, 200) || "Please try again",
                  variant: "destructive",
                });
                setMigrating(false);
                return;
              }
            }
          } catch {
            // Network error — keep polling
          }
        }

        // Timed out — check one final time
        try {
          const finalRes = await fetch(`/api/ecommerce/store/${storeId}/generate`);
          if (finalRes.ok) {
            const final = await finalRes.json();
            if (final.buildStatus === "built") {
              window.location.reload();
              return;
            }
          }
        } catch {}

        toast({ title: "Migration is still running", description: "Refresh the page in a minute to check." });
        setMigrating(false);
      };

      poll();
    } catch {
      toast({ title: "Migration failed", variant: "destructive" });
      setMigrating(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem(`flowshop-upgrade-dismissed-${storeId}`, "1");
  };

  return (
    <div className="mb-6 p-6 rounded-2xl bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 border border-purple-200 dark:border-purple-800 relative">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-white" />
        </div>

        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
            Upgrade to FlowShop V3
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
            Get a stunning AI-designed storefront with custom animations, modern layouts, and full SSR performance.
            Your existing products, orders, and settings are preserved.
          </p>
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <Package size={12} />
              {migrationInfo.productCount} products will be migrated
            </span>
            <span className="flex items-center gap-1">
              <ShoppingBag size={12} />
              {migrationInfo.categoryCount} categories
            </span>
            <span className="flex items-center gap-1">
              <Sparkles size={12} />
              {migrationInfo.creditCost} credits
            </span>
          </div>
        </div>

        <Button
          onClick={handleMigrate}
          className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white flex-shrink-0"
        >
          <Rocket className="w-4 h-4 mr-2" />
          Upgrade Now
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
