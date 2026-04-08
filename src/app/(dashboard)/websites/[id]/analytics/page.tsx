"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, Globe, Users, Eye, Clock, TrendingUp, Monitor, Smartphone,
  Tablet, BarChart3, ExternalLink, MapPin, Zap, Target,
} from "lucide-react";

interface AnalyticsData {
  overview: { totalViews: number; periodViews: number; uniqueVisitors: number; realtimeVisitors: number; siteAge: number };
  geo: { countries: Array<{ name: string; count: number }>; cities: Array<{ name: string; count: number }> };
  devices: { types: Array<{ name: string; count: number }>; browsers: Array<{ name: string; count: number }>; os: Array<{ name: string; count: number }> };
  pages: Array<{ name: string; count: number }>;
  referrers: Array<{ name: string; count: number }>;
  daily: Array<{ date: string; views: number }>;
}

const FLAG_MAP: Record<string, string> = {
  US: "🇺🇸", GB: "🇬🇧", FR: "🇫🇷", DE: "🇩🇪", CA: "🇨🇦", AU: "🇦🇺", IN: "🇮🇳", BR: "🇧🇷",
  NG: "🇳🇬", GH: "🇬🇭", KE: "🇰🇪", ZA: "🇿🇦", JP: "🇯🇵", CN: "🇨🇳", MX: "🇲🇽", CI: "🇨🇮",
  ES: "🇪🇸", IT: "🇮🇹", NL: "🇳🇱", SE: "🇸🇪", KR: "🇰🇷", PH: "🇵🇭", EG: "🇪🇬", TR: "🇹🇷",
};

export default function WebsiteAnalyticsPage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [range, setRange] = useState("30d");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/websites/${id}/analytics?range=${range}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id, range]);

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  const o = data?.overview;
  const maxDaily = Math.max(...(data?.daily?.map((d) => d.views) || [1]));

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/websites")} className="p-2 rounded-lg hover:bg-muted"><ArrowLeft className="w-4 h-4" /></button>
          <div>
            <h1 className="text-2xl font-bold">Website Analytics</h1>
            <p className="text-sm text-muted-foreground">Track visitors, performance, and engagement</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {["today", "7d", "30d", "90d"].map((r) => (
            <button key={r} onClick={() => setRange(r)} className={`px-3 py-1.5 text-sm rounded-lg ${range === r ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80 text-muted-foreground"}`}>
              {r === "today" ? "Today" : r}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard icon={Eye} label="Total Views" value={o?.totalViews || 0} />
        <StatCard icon={Users} label="Period Views" value={o?.periodViews || 0} />
        <StatCard icon={Users} label="Unique Visitors" value={o?.uniqueVisitors || 0} />
        <StatCard icon={Zap} label="Real-time" value={o?.realtimeVisitors || 0} highlight />
        <StatCard icon={Clock} label="Site Age" value={`${o?.siteAge || 0}d`} />
      </div>

      {/* Globe + Top Countries */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 mb-6">
        {/* Animated Globe */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-semibold flex items-center gap-2"><Globe className="w-5 h-5 text-primary" /> Visitor Map</h2>
          </div>
          <div className="relative h-[400px] bg-gradient-to-b from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center overflow-hidden rounded-b-xl">
            {/* SVG World Map with grid */}
            <div className="relative w-full h-full flex items-center justify-center">
              <svg viewBox="0 0 800 400" className="w-full h-full">
                {/* Latitude/longitude grid */}
                {Array.from({ length: 12 }).map((_, i) => (
                  <line key={`h${i}`} x1="50" y1={33 * i + 16} x2="750" y2={33 * i + 16} stroke="currentColor" className="text-blue-200 dark:text-blue-900" strokeWidth="0.5" />
                ))}
                {Array.from({ length: 16 }).map((_, i) => (
                  <line key={`v${i}`} x1={50 * i + 50} y1="16" x2={50 * i + 50} y2="384" stroke="currentColor" className="text-blue-200 dark:text-blue-900" strokeWidth="0.5" />
                ))}
                {/* Globe outline */}
                <ellipse cx="400" cy="200" rx="350" ry="180" fill="none" stroke="currentColor" className="text-blue-300 dark:text-blue-700" strokeWidth="1" />
                <ellipse cx="400" cy="200" rx="250" ry="130" fill="none" stroke="currentColor" className="text-blue-200 dark:text-blue-800" strokeWidth="0.75" />
                <ellipse cx="400" cy="200" rx="150" ry="80" fill="none" stroke="currentColor" className="text-blue-200 dark:text-blue-800" strokeWidth="0.5" />
                {/* Continent silhouettes (simplified) */}
                {/* North America */}
                <path d="M150,80 Q170,60 200,70 Q230,65 250,80 Q260,100 250,130 Q240,150 220,160 Q200,155 180,140 Q160,120 150,100Z" fill="currentColor" className="text-blue-200/60 dark:text-blue-700/40" />
                {/* South America */}
                <path d="M220,180 Q240,170 250,190 Q260,220 255,260 Q245,290 230,300 Q215,295 210,270 Q205,240 210,210Z" fill="currentColor" className="text-blue-200/60 dark:text-blue-700/40" />
                {/* Europe */}
                <path d="M370,70 Q390,60 410,65 Q430,70 440,85 Q435,100 420,105 Q400,100 380,95 Q365,85 370,70Z" fill="currentColor" className="text-blue-200/60 dark:text-blue-700/40" />
                {/* Africa */}
                <path d="M380,130 Q400,120 420,125 Q440,140 445,170 Q440,210 430,240 Q415,260 400,255 Q385,240 375,210 Q370,170 380,130Z" fill="currentColor" className="text-blue-200/60 dark:text-blue-700/40" />
                {/* Asia */}
                <path d="M450,60 Q500,50 550,55 Q600,65 630,90 Q640,120 620,150 Q590,160 550,155 Q500,145 470,120 Q450,95 450,60Z" fill="currentColor" className="text-blue-200/60 dark:text-blue-700/40" />
                {/* Australia */}
                <path d="M580,230 Q610,220 640,230 Q655,245 650,265 Q635,275 610,270 Q585,260 580,245Z" fill="currentColor" className="text-blue-200/60 dark:text-blue-700/40" />
              </svg>
              {/* Visitor dots */}
              {(data?.geo?.countries || []).slice(0, 8).map((country, i) => {
                const angle = (i / 8) * Math.PI * 2;
                const r = 100 + Math.random() * 80;
                const x = 400 + Math.cos(angle) * r;
                const y = 200 + Math.sin(angle) * (r * 0.5);
                const size = Math.min(20, 6 + (country.count / (data?.overview?.periodViews || 1)) * 40);
                return (
                  <div key={i} className="absolute" style={{ left: `${(x / 800) * 100}%`, top: `${(y / 400) * 100}%`, transform: "translate(-50%, -50%)" }}>
                    <div className="relative">
                      <div className="rounded-full bg-primary/40 animate-ping absolute" style={{ width: size * 2, height: size * 2 }} />
                      <div className="rounded-full bg-primary shadow-lg relative z-10 flex items-center justify-center" style={{ width: size, height: size }}>
                        <span className="text-[8px] text-white font-bold">{country.count}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {/* Empty state */}
              {(!data?.geo?.countries || data.geo.countries.length === 0) && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-sm text-muted-foreground bg-background/80 backdrop-blur-sm px-4 py-2 rounded-full">Visitor locations will appear here</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Top Countries */}
        <div className="bg-card border border-border rounded-xl">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-semibold flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> Top Countries</h2>
          </div>
          <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
            {(data?.geo?.countries || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No visitor data yet</p>
            ) : (
              data?.geo?.countries.map((c, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-lg">{FLAG_MAP[c.name] || "🌍"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${(c.count / (data?.overview?.periodViews || 1)) * 100}%` }} />
                    </div>
                  </div>
                  <span className="text-sm font-bold text-muted-foreground">{c.count}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Daily Views Chart */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Daily Views</h2>
        <div className="flex items-end gap-1 h-32">
          {(data?.daily || []).map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
              <div className="w-full bg-primary/20 hover:bg-primary/40 rounded-t transition-colors" style={{ height: `${(d.views / maxDaily) * 100}%`, minHeight: 2 }}>
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-popover border border-border rounded px-1.5 py-0.5 text-[10px] hidden group-hover:block whitespace-nowrap z-10">
                  {d.date}: {d.views} views
                </div>
              </div>
            </div>
          ))}
        </div>
        {(data?.daily || []).length > 0 && (
          <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
            <span>{data?.daily[0]?.date}</span>
            <span>{data?.daily[data.daily.length - 1]?.date}</span>
          </div>
        )}
      </div>

      {/* Grid: Devices + Pages + Referrers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Devices */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Monitor className="w-4 h-4" /> Devices</h2>
          {(data?.devices?.types || []).map((d, i) => (
            <div key={i} className="flex items-center justify-between py-1.5">
              <span className="text-sm flex items-center gap-2">
                {d.name === "mobile" ? <Smartphone className="w-3.5 h-3.5" /> : d.name === "tablet" ? <Tablet className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />}
                {d.name}
              </span>
              <span className="text-sm font-medium">{d.count}</span>
            </div>
          ))}
          {(data?.devices?.types || []).length === 0 && <p className="text-sm text-muted-foreground">No data</p>}
        </div>

        {/* Top Pages */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Top Pages</h2>
          {(data?.pages || []).slice(0, 8).map((p, i) => (
            <div key={i} className="flex items-center justify-between py-1.5">
              <span className="text-sm truncate flex-1 mr-2">{p.name || "/"}</span>
              <span className="text-sm font-medium">{p.count}</span>
            </div>
          ))}
          {(data?.pages || []).length === 0 && <p className="text-sm text-muted-foreground">No data</p>}
        </div>

        {/* Referrers */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><ExternalLink className="w-4 h-4" /> Traffic Sources</h2>
          {(data?.referrers || []).slice(0, 8).map((r, i) => (
            <div key={i} className="flex items-center justify-between py-1.5">
              <span className="text-sm truncate flex-1 mr-2">{r.name}</span>
              <span className="text-sm font-medium">{r.count}</span>
            </div>
          ))}
          {(data?.referrers || []).length === 0 && <p className="text-sm text-muted-foreground">Direct traffic</p>}
        </div>
      </div>

      {/* Marketing Recommendations */}
      <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Target className="w-5 h-5 text-primary" /> Marketing Insights</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {generateInsights(data).map((insight, i) => (
            <div key={i} className="bg-background/60 backdrop-blur rounded-lg p-3 border border-border/50">
              <p className="text-sm">{insight}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, highlight }: { icon: any; label: string; value: number | string; highlight?: boolean }) {
  return (
    <div className={`p-4 rounded-xl border ${highlight ? "bg-primary/10 border-primary/30" : "bg-card border-border"}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${highlight ? "text-primary" : "text-muted-foreground"}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</p>
    </div>
  );
}

function generateInsights(data: AnalyticsData | null): string[] {
  if (!data || data.overview.periodViews === 0) {
    return [
      "Your site is new — share it on social media to get your first visitors!",
      "Add your website link to your email signature and social profiles.",
      "Consider running a small ad campaign to drive initial traffic.",
      "Make sure your site is indexed by Google — submit your sitemap.",
    ];
  }

  const insights: string[] = [];
  const { devices, geo, pages, referrers } = data;

  // Device insights
  if (devices?.types?.length) {
    const mobile = devices.types.find((d) => d.name === "mobile");
    const total = devices.types.reduce((s, d) => s + d.count, 0);
    if (mobile && total > 0) {
      const pct = Math.round((mobile.count / total) * 100);
      if (pct > 60) insights.push(`📱 ${pct}% of visitors are on mobile — great mobile optimization is critical!`);
      else if (pct < 30) insights.push(`🖥️ Most visitors use desktop (${100 - pct}%) — consider desktop-first design optimizations.`);
    }
  }

  // Country insights
  if (geo?.countries?.length) {
    const top = geo.countries[0];
    insights.push(`🌍 ${FLAG_MAP[top.name] || ""} ${top.name} is your top market with ${top.count} visits — consider localized content.`);
    if (geo.countries.length > 3) {
      insights.push(`🌐 You have visitors from ${geo.countries.length}+ countries — your reach is growing internationally.`);
    }
  }

  // Page insights
  if (pages?.length > 1) {
    const topPage = pages[0];
    insights.push(`📄 "${topPage.name || "Home"}" is your most viewed page with ${topPage.count} views.`);
  }

  // Referrer insights
  if (referrers?.length) {
    insights.push(`🔗 Top traffic source: ${referrers[0].name} — invest more in this channel.`);
  } else {
    insights.push(`🔍 Most traffic is direct — improve SEO and social sharing to diversify sources.`);
  }

  // Daily trend
  if (data.daily?.length > 7) {
    const recent = data.daily.slice(-7).reduce((s, d) => s + d.views, 0);
    const prior = data.daily.slice(-14, -7).reduce((s, d) => s + d.views, 0);
    if (prior > 0) {
      const change = Math.round(((recent - prior) / prior) * 100);
      if (change > 0) insights.push(`📈 Traffic is up ${change}% compared to last week — great momentum!`);
      else if (change < -20) insights.push(`📉 Traffic dropped ${Math.abs(change)}% this week — consider promoting your site more.`);
    }
  }

  return insights.length > 0 ? insights : ["Keep sharing your website to grow your audience!"];
}
