"use client";

import { useState, useEffect } from "react";
import { Loader2, Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { REGIONS, getRegionForCountry } from "@/lib/constants/regions";
import {
  CURRENCIES_BY_REGION,
  PAYMENT_METHODS_BY_REGION,
  type PaymentMethodConfig,
} from "@/lib/constants/ecommerce";

interface StoreInfoStepProps {
  storeName: string;
  industry: string;
  niche: string;
  targetAudience: string;
  region: string;
  country: string;
  currency: string;
  onFieldChange: (field: string, value: string) => void;
  onRegionChange: (region: string, country: string, currency: string) => void;
}

export function StoreInfoStep({
  storeName,
  industry,
  niche,
  targetAudience,
  region,
  country,
  currency,
  onFieldChange,
  onRegionChange,
}: StoreInfoStepProps) {
  const [brandSyncing, setBrandSyncing] = useState(false);
  const [brandSynced, setBrandSynced] = useState(false);

  async function handleBrandSync() {
    setBrandSyncing(true);
    try {
      const res = await fetch("/api/ecommerce/store/brand-sync", {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        const bk = json.data.brandKit;
        setBrandSynced(true);
        if (bk.name) onFieldChange("storeName", bk.name);
        if (bk.industry) onFieldChange("industry", bk.industry);
      }
    } catch {}
    setBrandSyncing(false);
  }

  function handleRegionChange(newRegion: string) {
    const regionObj = REGIONS.find((r) => r.id === newRegion);
    const newCountry = regionObj?.countries[0]?.code || "";
    const regionCurrency = CURRENCIES_BY_REGION[newRegion];
    onRegionChange(newRegion, newCountry, regionCurrency?.code || "USD");
  }

  function handleCountryChange(newCountry: string) {
    const detectedRegion = getRegionForCountry(newCountry);
    if (detectedRegion && detectedRegion !== region) {
      const regionCurrency = CURRENCIES_BY_REGION[detectedRegion];
      onRegionChange(detectedRegion, newCountry, regionCurrency?.code || currency);
    } else {
      onFieldChange("country", newCountry);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold mb-1">Tell Us About Your Store</h2>
        <p className="text-sm text-muted-foreground">
          We'll use this info to build your store with AI.
        </p>
      </div>

      {/* Brand Sync */}
      <Button
        onClick={handleBrandSync}
        disabled={brandSyncing}
        variant={brandSynced ? "outline" : "default"}
        size="sm"
        className="w-full"
      >
        {brandSyncing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Syncing...
          </>
        ) : brandSynced ? (
          <>
            <Check className="h-4 w-4 mr-2" />
            Synced from Brand Kit
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-2" />
            Sync from Brand Kit
          </>
        )}
      </Button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Store Name */}
        <div>
          <label className="text-sm font-medium">Store Name *</label>
          <input
            type="text"
            value={storeName}
            onChange={(e) => onFieldChange("storeName", e.target.value)}
            placeholder="My Awesome Store"
            className="mt-1 w-full px-3 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Industry */}
        <div>
          <label className="text-sm font-medium">Industry *</label>
          <input
            type="text"
            value={industry}
            onChange={(e) => onFieldChange("industry", e.target.value)}
            placeholder="e.g. Fashion, Electronics, Food"
            className="mt-1 w-full px-3 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Niche */}
        <div>
          <label className="text-sm font-medium">Niche / Specialty</label>
          <input
            type="text"
            value={niche}
            onChange={(e) => onFieldChange("niche", e.target.value)}
            placeholder="e.g. Organic skincare, Handmade jewelry"
            className="mt-1 w-full px-3 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Target Audience */}
        <div>
          <label className="text-sm font-medium">Target Audience</label>
          <input
            type="text"
            value={targetAudience}
            onChange={(e) => onFieldChange("targetAudience", e.target.value)}
            placeholder="e.g. Women 25-45, Tech enthusiasts"
            className="mt-1 w-full px-3 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Region */}
        <div>
          <label className="text-sm font-medium">Region</label>
          <select
            value={region}
            onChange={(e) => handleRegionChange(e.target.value)}
            className="mt-1 w-full px-3 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">Select a region</option>
            {REGIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        {/* Country */}
        <div>
          <label className="text-sm font-medium">Country</label>
          <select
            value={country}
            onChange={(e) => handleCountryChange(e.target.value)}
            className="mt-1 w-full px-3 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">Select a country</option>
            {(
              REGIONS.find((r) => r.id === region)?.countries ||
              REGIONS.flatMap((r) => r.countries)
            ).map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Currency */}
        <div className="md:col-span-2">
          <label className="text-sm font-medium">Currency</label>
          <select
            value={currency}
            onChange={(e) => onFieldChange("currency", e.target.value)}
            className="mt-1 w-full px-3 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {Object.entries(CURRENCIES_BY_REGION).map(([rId, c]) => (
              <option key={rId} value={c.code}>
                {c.code} — {c.symbol} ({c.name})
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
