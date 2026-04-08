"use client";

import { useState, useEffect } from "react";
import { Sparkles, Rocket, Loader2, X, ArrowRight, Package, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AIGenerationLoader } from "@/components/shared/ai-generation-loader";
import { useToast } from "@/hooks/use-toast";

interface StoreUpgradeBannerProps {
  storeId: string;
  storeName: string;
  generatorVersion: string;
  buildStatus: string;
}

/**
 * Banner shown on the ecommerce dashboard for V1 store owners.
 * Prompts them to migrate to V2 (agent-built static store) with one click.
 */
export function StoreUpgradeBanner({
  storeId,
  storeName,
  generatorVersion,
  buildStatus,
}: StoreUpgradeBannerProps) {
  const { toast } = useToast();
  const [dismissed, setDismissed] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrationInfo, setMigrationInfo] = useState<{
    productCount: number;
    categoryCount: number;
    creditCost: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  // Don't show for V2 stores or if dismissed
  const isV1 = generatorVersion === "v1" || !generatorVersion;

  useEffect(() => {
    if (!isV1) return;

    // Check if user dismissed this session
    const key = `flowshop-upgrade-dismissed-${storeId}`;
    if (sessionStorage.getItem(key)) {
      setDismissed(true);
      setLoading(false);
      return;
    }

    // Fetch migration info
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

  // If currently building, show progress
  if (migrating || buildStatus === "building") {
    return (
      <div className="mb-6 p-6 rounded-2xl bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 border border-purple-200 dark:border-purple-800">
        <AIGenerationLoader
          compact
          steps={[
            "Reading your brand identity...",
            "Collecting products and images...",
            "Designing your new storefront...",
            "Building and deploying...",
          ]}
          title="Upgrading your store"
          subtitle="This takes 1-2 minutes. Your existing products and orders are safe."
        />
      </div>
    );
  }

  const handleMigrate = async () => {
    setMigrating(true);
    try {
      const res = await fetch(`/api/ecommerce/store/${storeId}/migrate`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        toast({
          title: "Migration failed",
          description: data.error || "Please try again",
          variant: "destructive",
        });
        setMigrating(false);
        return;
      }

      toast({
        title: "Migration started!",
        description: `Collecting ${data.productsCollected} products. Your store will be rebuilt in 1-2 minutes.`,
      });

      // Poll for completion
      const pollInterval = setInterval(async () => {
        const statusRes = await fetch(`/api/ecommerce/store/${storeId}/generate`);
        if (statusRes.ok) {
          const status = await statusRes.json();
          if (status.buildStatus === "built" && status.storeVersion === "static") {
            clearInterval(pollInterval);
            setMigrating(false);
            toast({ title: "Store upgraded successfully!", description: "Refresh to see your new store." });
            window.location.reload();
          } else if (status.buildStatus === "error") {
            clearInterval(pollInterval);
            setMigrating(false);
            toast({
              title: "Build failed",
              description: status.lastBuildError?.substring(0, 200) || "Please try again",
              variant: "destructive",
            });
          }
        }
      }, 5000);

      // Safety timeout
      setTimeout(() => {
        clearInterval(pollInterval);
        if (migrating) setMigrating(false);
      }, 180000);
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
            Upgrade to FlowShop V2
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
            Get a stunning AI-designed storefront with custom animations, modern layouts, and faster loading.
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
