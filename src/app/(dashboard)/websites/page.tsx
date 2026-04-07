"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Globe, Edit3, Trash2, ExternalLink, RefreshCw, Loader2, Check,
  BarChart3, Eye, Users, TrendingUp, Zap, ArrowRight, Settings, Link2,
  AlertTriangle, Flag,
} from "lucide-react";

interface Website {
  id: string; name: string; slug: string; status: string; buildStatus: string;
  pageCount: number; totalViews: number; customDomain?: string; updatedAt: string;
  lastBuildAt?: string; lastBuildError?: string;
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
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildResult, setRebuildResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

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

  const handleRebuild = async (siteId: string) => {
    setRebuilding(true);
    setRebuildResult(null);
    await fetch(`/api/websites/${siteId}/rebuild`, { method: "POST" });
    // Poll for completion
    const iv = setInterval(async () => {
      try {
        const res = await fetch("/api/websites");
        const d = await res.json();
        const updated = d.websites?.[0];
        if (updated) setWebsites(d.websites);
        if (updated && updated.buildStatus !== "building") {
          clearInterval(iv);
          setRebuilding(false);
          if (updated.buildStatus === "built") {
            setRebuildResult({ type: "success", message: "Website rebuilt successfully!" });
            setTimeout(() => setRebuildResult(null), 5000);
          } else {
            setRebuildResult({ type: "error", message: updated.lastBuildError?.substring(0, 200) || "Build failed." });
          }
        }
      } catch { /* keep polling */ }
    }, 3000);
  };

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
          {/* Rebuild Result Toast */}
          {rebuildResult && (
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${rebuildResult.type === "success" ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300" : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"}`}>
              {rebuildResult.type === "success" ? <Check className="w-5 h-5 flex-shrink-0" /> : <AlertTriangle className="w-5 h-5 flex-shrink-0" />}
              <p className="text-sm font-medium flex-1">{rebuildResult.message}</p>
              <button onClick={() => setRebuildResult(null)} className="p-1 hover:opacity-70"><span className="text-lg leading-none">&times;</span></button>
            </div>
          )}

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
                  (site.buildStatus === "building" || rebuilding)
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    : site.buildStatus === "built" && site.status === "PUBLISHED"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : site.buildStatus === "error"
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                }`}>
                  {(site.buildStatus === "building" || rebuilding) ? <><Loader2 className="w-3 h-3 animate-spin" /> Building...</> :
                   site.buildStatus === "built" && site.status === "PUBLISHED" ? <><Check className="w-3 h-3" /> Live</> :
                   site.buildStatus === "error" ? <><AlertTriangle className="w-3 h-3" /> Error</> : "Draft"}
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

            {/* Build Error Banner */}
            {site.buildStatus === "error" && (
              <div className="mx-6 mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-red-800 dark:text-red-300">Your website failed to build</p>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      {site.lastBuildError?.substring(0, 150) || "An error occurred during the build process."}
                      {(site.lastBuildError?.length || 0) > 150 && "..."}
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={() => router.push(`/websites/${site.id}/edit?tab=build`)}
                        className="px-3 py-1.5 text-xs font-medium bg-red-100 dark:bg-red-800/40 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-800/60 transition-colors"
                      >
                        View Details
                      </button>
                      <ReportErrorButton websiteId={site.id} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <ActionButton icon={Edit3} label="Edit Website" primary onClick={() => router.push(`/websites/${site.id}/edit`)} />
                <ActionButton icon={BarChart3} label="Analytics" onClick={() => router.push(`/websites/${site.id}/analytics`)} />
                <ActionButton icon={ExternalLink} label="View Site" onClick={() => window.open(`/sites/${site.slug}/`, "_blank")} />
                <ActionButton icon={Link2} label="Domains" onClick={() => router.push(`/websites/${site.id}/edit?tab=domains`)} />
                <ActionButton icon={rebuilding ? Loader2 : RefreshCw} label={rebuilding ? "Building..." : "Rebuild"} onClick={() => !rebuilding && handleRebuild(site.id)} spin={rebuilding} />
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

function ActionButton({ icon: Icon, label, primary, onClick, spin }: { icon: any; label: string; primary?: boolean; onClick: () => void; spin?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
        primary
          ? "bg-primary text-primary-foreground border-primary hover:opacity-90"
          : "bg-card border-border hover:border-primary/50 hover:bg-primary/5"
      }`}
    >
      <Icon className={`w-5 h-5 ${spin ? "animate-spin" : ""}`} />
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

function ReportErrorButton({ websiteId }: { websiteId: string }) {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const report = async () => {
    setSending(true);
    try {
      await fetch(`/api/websites/${websiteId}/report-error`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      setSent(true);
    } catch {}
    setSending(false);
  };

  if (sent) return <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400"><Check className="w-3 h-3" /> Reported</span>;

  return (
    <button
      onClick={report}
      disabled={sending}
      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-800/40 rounded-lg transition-colors disabled:opacity-50"
    >
      {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Flag className="w-3 h-3" />}
      Report to Admin
    </button>
  );
}
