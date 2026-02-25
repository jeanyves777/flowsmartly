"use client";

import { useState, useEffect } from "react";
import { DollarSign, TrendingUp, ShoppingCart, Megaphone, Loader2, ExternalLink } from "lucide-react";
import Link from "next/link";

interface CampaignROAS {
  id: string;
  name: string;
  status: string;
  spentCents: number;
  budgetCents: number;
  revenueCents: number;
  roas: number;
  orderCount: number;
  impressions: number;
  clicks: number;
  productName: string | null;
  productImage: string | null;
  createdAt: string;
}

interface ROASSummary {
  totalSpentCents: number;
  totalRevenueCents: number;
  overallRoas: number;
  totalOrders: number;
  activeCampaigns: number;
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function ROASDashboard() {
  const [summary, setSummary] = useState<ROASSummary | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignROAS[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/ecommerce/ads/roas")
      .then((res) => res.json())
      .then((data) => {
        if (data.summary) setSummary(data.summary);
        if (data.campaigns) setCampaigns(data.campaigns);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              Ad Spend
            </div>
            <p className="text-2xl font-bold mt-1">{formatMoney(summary.totalSpentCents)}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShoppingCart className="h-4 w-4" />
              Ad Revenue
            </div>
            <p className="text-2xl font-bold mt-1 text-green-600">{formatMoney(summary.totalRevenueCents)}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Overall ROAS
            </div>
            <p className="text-2xl font-bold mt-1">
              {summary.overallRoas > 0 ? `${summary.overallRoas}x` : "—"}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Megaphone className="h-4 w-4" />
              Active Ads
            </div>
            <p className="text-2xl font-bold mt-1">{summary.activeCampaigns}</p>
            <p className="text-xs text-muted-foreground">{summary.totalOrders} order{summary.totalOrders !== 1 ? "s" : ""} tracked</p>
          </div>
        </div>
      )}

      {/* Campaigns Table */}
      {campaigns.length === 0 ? (
        <div className="text-center py-12 rounded-xl border bg-card">
          <Megaphone className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium">No product ads yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Promote a product from your Products page to get started.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Campaign</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Spent</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Impressions</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Clicks</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Orders</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Revenue</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase">ROAS</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {campaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {c.productImage && (
                          <img
                            src={c.productImage}
                            alt=""
                            className="w-8 h-8 rounded object-cover"
                          />
                        )}
                        <div>
                          <p className="text-sm font-medium truncate max-w-[200px]">{c.name}</p>
                          {c.productName && (
                            <p className="text-xs text-muted-foreground">{c.productName}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        c.status === "ACTIVE" ? "bg-green-100 text-green-800" :
                        c.status === "PENDING_REVIEW" ? "bg-yellow-100 text-yellow-800" :
                        c.status === "PAUSED" ? "bg-gray-100 text-gray-600" :
                        "bg-red-100 text-red-800"
                      }`}>
                        {c.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm">{formatMoney(c.spentCents)}</td>
                    <td className="px-4 py-3 text-right text-sm">{c.impressions.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-sm">{c.clicks.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium">{c.orderCount}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-green-600">
                      {c.revenueCents > 0 ? formatMoney(c.revenueCents) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-bold ${
                        c.roas >= 2 ? "text-green-600" :
                        c.roas >= 1 ? "text-yellow-600" :
                        c.roas > 0 ? "text-red-600" : "text-gray-400"
                      }`}>
                        {c.roas > 0 ? `${c.roas}x` : "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Link to full ads manager */}
      <div className="text-center">
        <Link
          href="/ads"
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
        >
          View all campaigns in Ads Manager
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
