"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Globe, Edit3, Trash2, ExternalLink, RefreshCw, Loader2, Check,
  BarChart3, Eye, Users, TrendingUp, Zap, ArrowRight, Settings, Link2,
} from "lucide-react";

interface Website {
  id: string; name: string; slug: string; status: string; buildStatus: string;
  pageCount: number; totalViews: number; customDomain?: string; updatedAt: string;
  lastBuildAt?: string;
}

interface QuickStats {
  periodViews: number; uniqueVisitors: number; realtimeVisitors: number;
  topCountry?: string; topDevice?: string;
}

export default function WebsitesPage() {
  const router = useRouter();
  const [websites, setWebsites] = useState<Website[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<QuickStats | null>(null);

  useEffect(() => {
    fetch("/api/websites")
      .then((r) => r.json())
      .then((d) => {
        setWebsites(d.websites || []);
        setLoading(false);
        // Fetch quick stats for the first (only) website
        if (d.websites?.[0]?.id) {
          fetch(`/api/websites/${d.websites[0].id}/analytics?range=30d`)
            .then((r) => r.json())
            .then((a) => setStats({
              periodViews: a.overview?.periodViews || 0,
              uniqueVisitors: a.overview?.uniqueVisitors || 0,
              realtimeVisitors: a.overview?.realtimeVisitors || 0,
              topCountry: a.geo?.countries?.[0]?.name,
              topDevice: a.devices?.types?.[0]?.name,
            }))
            .catch(() => {});
        }
      })
      .catch(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure? This will permanently delete your website and all its files.")) return;
    await fetch(`/api/websites/${id}`, { method: "DELETE" });
    setWebsites([]);
  };

  const site = websites[0];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Website Builder</h1>
          <p className="text-muted-foreground text-sm mt-1">Your professional website powered by AI</p>
        </div>
      </div>

      {loading ? (
        <div className="h-64 rounded-2xl bg-muted animate-pulse" />
      ) : !site ? (
        /* No website — create CTA */
        <div className="text-center py-20 bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl border border-primary/20">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Globe className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Create Your Website</h2>
          <p className="text-muted-foreground max-w-md mx-auto mb-8">
            Build a professional website with AI in minutes. Real Next.js site with animations, dark mode, and responsive design.
          </p>
          <button onClick={() => router.push("/websites/create")} className="px-8 py-3 bg-primary text-primary-foreground rounded-xl text-base font-semibold hover:opacity-90 transition-all inline-flex items-center gap-2">
            <Plus className="w-5 h-5" /> Create Your Website
          </button>
          <p className="text-xs text-muted-foreground mt-4">Costs 500 credits ($5.00) — includes hosting for paid plans</p>
        </div>
      ) : (
        /* Has website — full dashboard card */
        <div className="space-y-6">
          {/* Hero Card */}
          <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card to-card/50">
            {/* Top bar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{site.name}</h2>
                  <p className="text-xs text-muted-foreground">{site.customDomain || `flowsmartly.com/sites/${site.slug}`}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                  site.buildStatus === "built" && site.status === "PUBLISHED"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : site.buildStatus === "building"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                }`}>
                  {site.buildStatus === "built" && site.status === "PUBLISHED" ? <><Check className="w-3 h-3" /> Live</> :
                   site.buildStatus === "building" ? <><Loader2 className="w-3 h-3 animate-spin" /> Building</> : "Draft"}
                </span>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border/30">
              <QuickStat icon={Eye} label="Total Views" value={site.totalViews} />
              <QuickStat icon={TrendingUp} label="Last 30 Days" value={stats?.periodViews || 0} />
              <QuickStat icon={Users} label="Unique Visitors" value={stats?.uniqueVisitors || 0} />
              <QuickStat icon={Zap} label="Live Now" value={stats?.realtimeVisitors || 0} highlight />
            </div>

            {/* Action Buttons */}
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <ActionButton icon={Edit3} label="Edit Website" primary onClick={() => router.push(`/websites/${site.id}/edit`)} />
                <ActionButton icon={BarChart3} label="Analytics" onClick={() => router.push(`/websites/${site.id}/analytics`)} />
                <ActionButton icon={ExternalLink} label="View Site" onClick={() => window.open(`/sites/${site.slug}/`, "_blank")} />
                <ActionButton icon={Link2} label="Domains" onClick={() => router.push(`/websites/${site.id}/edit?tab=domains`)} />
                <ActionButton icon={RefreshCw} label="Rebuild" onClick={async () => {
                  await fetch(`/api/websites/${site.id}/rebuild`, { method: "POST" });
                  const res = await fetch("/api/websites");
                  const data = await res.json();
                  setWebsites(data.websites || []);
                }} />
              </div>

              {/* Bottom info */}
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/50">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{site.pageCount} pages</span>
                  {site.lastBuildAt && <span>Last built {new Date(site.lastBuildAt).toLocaleDateString()}</span>}
                  {stats?.topCountry && <span>Top country: {stats.topCountry}</span>}
                </div>
                <button onClick={() => handleDelete(site.id)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors">
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function QuickStat({ icon: Icon, label, value, highlight }: { icon: any; label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`px-6 py-4 ${highlight ? "bg-primary/5" : "bg-card"}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${highlight ? "text-primary" : "text-muted-foreground"}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${highlight ? "text-primary" : ""}`}>{value.toLocaleString()}</p>
    </div>
  );
}

function ActionButton({ icon: Icon, label, primary, onClick }: { icon: any; label: string; primary?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
        primary
          ? "bg-primary text-primary-foreground border-primary hover:opacity-90"
          : "bg-card border-border hover:border-primary/50 hover:bg-primary/5"
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}
