"use client";

import { useState, useEffect } from "react";
import { Save, Loader2, Facebook, BarChart3, Music2, Image } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PixelData {
  facebookPixelId: string;
  googleTagId: string;
  tiktokPixelId: string;
  pinterestTagId: string;
}

const PIXEL_FIELDS = [
  {
    key: "facebookPixelId" as const,
    label: "Facebook Pixel ID",
    placeholder: "e.g., 123456789012345",
    icon: Facebook,
    description: "Track conversions from Facebook & Instagram ads",
    helpUrl: "https://www.facebook.com/business/help/952192354843755",
  },
  {
    key: "googleTagId" as const,
    label: "Google Tag ID",
    placeholder: "e.g., G-XXXXXXXXXX or AW-XXXXXXXXX",
    icon: BarChart3,
    description: "Track conversions from Google Ads & Analytics",
    helpUrl: "https://support.google.com/analytics/answer/9539598",
  },
  {
    key: "tiktokPixelId" as const,
    label: "TikTok Pixel ID",
    placeholder: "e.g., CXXXXXXXXXXXXXXXXX",
    icon: Music2,
    description: "Track conversions from TikTok ads",
    helpUrl: "https://ads.tiktok.com/help/article/get-started-pixel",
  },
  {
    key: "pinterestTagId" as const,
    label: "Pinterest Tag ID",
    placeholder: "e.g., 2612345678901",
    icon: Image,
    description: "Track conversions from Pinterest ads",
    helpUrl: "https://help.pinterest.com/en/business/article/install-the-pinterest-tag",
  },
];

export default function PixelSettings() {
  const [pixels, setPixels] = useState<PixelData>({
    facebookPixelId: "",
    googleTagId: "",
    tiktokPixelId: "",
    pinterestTagId: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchPixels();
  }, []);

  async function fetchPixels() {
    try {
      const res = await fetch("/api/ecommerce/pixels");
      if (res.ok) {
        const data = await res.json();
        setPixels({
          facebookPixelId: data.pixels?.facebookPixelId || "",
          googleTagId: data.pixels?.googleTagId || "",
          tiktokPixelId: data.pixels?.tiktokPixelId || "",
          pinterestTagId: data.pixels?.pinterestTagId || "",
        });
      }
    } catch {
      toast({ title: "Failed to load pixel settings", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/ecommerce/pixels", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pixels),
      });

      if (res.ok) {
        toast({ title: "Pixel settings saved" });
      } else {
        const data = await res.json();
        toast({ title: data.error || "Failed to save pixel settings", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to save pixel settings", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const hasAnyPixel = Object.values(pixels).some((v) => v.trim());

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Tracking Pixels</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Add retargeting pixels to track ad conversions on your store. Events like page views,
          add-to-cart, and purchases are automatically tracked.
        </p>
      </div>

      <div className="grid gap-4">
        {PIXEL_FIELDS.map((field) => {
          const Icon = field.icon;
          return (
            <div
              key={field.key}
              className="flex items-start gap-4 rounded-lg border p-4"
            >
              <div className="rounded-md bg-muted p-2">
                <Icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 space-y-2">
                <div>
                  <label className="text-sm font-medium">{field.label}</label>
                  <p className="text-xs text-muted-foreground">{field.description}</p>
                </div>
                <input
                  type="text"
                  placeholder={field.placeholder}
                  value={pixels[field.key]}
                  onChange={(e) =>
                    setPixels((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>
          );
        })}
      </div>

      {hasAnyPixel && (
        <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3">
          <p className="text-sm text-green-700 dark:text-green-400">
            Events automatically tracked: <strong>Page View</strong>, <strong>View Product</strong>,{" "}
            <strong>Add to Cart</strong>, <strong>Checkout</strong>, <strong>Purchase</strong>
          </p>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Pixel Settings
        </button>
      </div>
    </div>
  );
}
