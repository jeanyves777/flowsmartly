"use client";

import { useState, useEffect } from "react";
import { Megaphone, Rss, BarChart3, Loader2, Copy, Check, RefreshCw, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils/cn";
import { PageLoader } from "@/components/shared/page-loader";
import ROASDashboard from "@/components/ecommerce/roas-dashboard";

type TabId = "ads" | "feeds" | "performance";

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "ads", label: "Product Ads", icon: Megaphone },
  { id: "feeds", label: "Product Feeds", icon: Rss },
  { id: "performance", label: "Performance", icon: BarChart3 },
];

interface Feed {
  id: string;
  platform: string;
  feedUrl: string | null;
  feedFormat: string;
  productCount: number;
  lastSyncedAt: string | null;
  status: string;
  errorMessage: string | null;
}

const FEED_PLATFORMS = [
  {
    key: "google_shopping",
    name: "Google Shopping",
    description: "XML feed for Google Merchant Center",
    color: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    key: "facebook_catalog",
    name: "Facebook Catalog",
    description: "JSON feed for Meta Commerce Manager",
    color: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  {
    key: "tiktok",
    name: "TikTok Shop",
    description: "CSV feed for TikTok Commerce",
    color: "bg-pink-50 text-pink-700 border-pink-200",
  },
];

function FeedsTab() {
  const { toast } = useToast();
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetchFeeds();
  }, []);

  async function fetchFeeds() {
    try {
      const res = await fetch("/api/ecommerce/feeds");
      if (res.ok) {
        const data = await res.json();
        setFeeds(data.feeds || []);
      }
    } catch {} finally {
      setLoading(false);
    }
  }

  async function generateFeed(platform: string) {
    setGenerating(platform);
    try {
      const res = await fetch("/api/ecommerce/feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });

      if (res.ok) {
        toast({ title: "Feed generated successfully!" });
        fetchFeeds();
      } else {
        const data = await res.json();
        toast({ title: data.error || "Failed to generate feed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to generate feed", variant: "destructive" });
    } finally {
      setGenerating(null);
    }
  }

  function copyUrl(url: string, platform: string) {
    navigator.clipboard.writeText(url);
    setCopied(platform);
    toast({ title: "Feed URL copied!" });
    setTimeout(() => setCopied(null), 2000);
  }

  if (loading) {
    return <PageLoader tips={["Loading product feeds..."]} />;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Generate product feeds to submit to ad platforms. They will automatically include all your active products.
      </p>
      <div className="grid gap-4">
        {FEED_PLATFORMS.map((platform) => {
          const feed = feeds.find((f) => f.platform === platform.key);
          const isGenerating = generating === platform.key;

          return (
            <div key={platform.key} className="rounded-xl border bg-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{platform.name}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">{platform.description}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                  feed?.status === "synced"
                    ? "bg-green-50 text-green-700 border-green-200"
                    : feed?.status === "error"
                    ? "bg-red-50 text-red-700 border-red-200"
                    : "bg-gray-50 text-gray-600 border-gray-200"
                }`}>
                  {feed?.status === "synced" ? "Synced" : feed?.status === "error" ? "Error" : "Not generated"}
                </span>
              </div>

              {feed?.status === "synced" && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">{feed.productCount} products</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">
                      Last synced {feed.lastSyncedAt ? new Date(feed.lastSyncedAt).toLocaleDateString() : "never"}
                    </span>
                  </div>
                  {feed.feedUrl && (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={feed.feedUrl}
                        readOnly
                        className="flex-1 px-3 py-1.5 text-xs rounded-md border bg-muted font-mono"
                      />
                      <button
                        onClick={() => copyUrl(feed.feedUrl!, platform.key)}
                        className="p-1.5 rounded-md border hover:bg-muted transition-colors"
                      >
                        {copied === platform.key ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {feed?.status === "error" && feed.errorMessage && (
                <p className="mt-2 text-sm text-red-600">{feed.errorMessage}</p>
              )}

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => generateFeed(platform.key)}
                  disabled={isGenerating}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {feed?.status === "synced" ? "Regenerate" : "Generate Feed"}
                </button>
                {feed?.feedUrl && (
                  <a
                    href={feed.feedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border hover:bg-muted transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Preview
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function EcommerceAdsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("ads");

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ads & Feeds</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Promote products, manage feeds, and track ad performance.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg bg-muted">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "ads" && <ROASDashboard />}
      {activeTab === "feeds" && <FeedsTab />}
      {activeTab === "performance" && <ROASDashboard />}
    </div>
  );
}
