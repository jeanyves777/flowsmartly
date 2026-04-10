"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Palette,
  ExternalLink,
  Settings,
  Sparkles,
  RefreshCw,
  Eye,
  BarChart2,
} from "lucide-react";
import { PageLoader } from "@/components/shared/page-loader";

interface StoreInfo {
  id: string;
  name: string;
  slug: string;
  storeUrl?: string;
  ssrStatus?: string;
  buildStatus?: string;
}

export default function EcommerceDesignPage() {
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/ecommerce/store")
      .then((r) => r.json())
      .then((data) => {
        setStore(data.store || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;

  const storeUrl = store?.storeUrl || (store?.slug ? `/stores/${store.slug}/` : null);

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Palette className="h-6 w-6 text-primary" />
          Store Design
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Your V3 store is an independently deployed AI-generated app. Use the
          tools below to manage and customize it.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {storeUrl && (
          <a
            href={storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-4 rounded-xl border p-5 hover:bg-accent transition-colors"
          >
            <Eye className="h-6 w-6 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">View Live Store</p>
              <p className="text-sm text-muted-foreground">
                Open your storefront in a new tab
              </p>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground ml-auto mt-0.5 shrink-0" />
          </a>
        )}

        <Link
          href="/ecommerce/settings"
          className="flex items-start gap-4 rounded-xl border p-5 hover:bg-accent transition-colors"
        >
          <Settings className="h-6 w-6 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Store Settings</p>
            <p className="text-sm text-muted-foreground">
              Edit name, theme, colors, and branding
            </p>
          </div>
        </Link>

        <Link
          href="/ecommerce/intelligence"
          className="flex items-start gap-4 rounded-xl border p-5 hover:bg-accent transition-colors"
        >
          <Sparkles className="h-6 w-6 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">AI Intelligence</p>
            <p className="text-sm text-muted-foreground">
              Use AI to improve your store copy and layout
            </p>
          </div>
        </Link>

        <Link
          href="/ecommerce/analytics"
          className="flex items-start gap-4 rounded-xl border p-5 hover:bg-accent transition-colors"
        >
          <BarChart2 className="h-6 w-6 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Analytics</p>
            <p className="text-sm text-muted-foreground">
              Track visits, conversions, and revenue
            </p>
          </div>
        </Link>
      </div>

      {store?.buildStatus === "error" && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-5 flex items-start gap-3">
          <RefreshCw className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-destructive">Build Error</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Your store encountered a build error. Contact support or try
              regenerating.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
