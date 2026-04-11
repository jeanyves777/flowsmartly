"use client";

import { useState, useEffect } from "react";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import {
  Globe, Users, Eye, Clock, TrendingUp, Monitor, Smartphone,
  Tablet, BarChart3, ExternalLink, MapPin, Zap, Target, ShoppingBag,
} from "lucide-react";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const COUNTRY_COORDS: Record<string, [number, number]> = {
  US: [-98.58, 39.83], GB: [-3.44, 55.38], FR: [2.21, 46.23], DE: [10.45, 51.17],
  CA: [-96.82, 56.13], AU: [133.78, -25.27], IN: [78.96, 20.59], BR: [-51.93, -14.24],
  NG: [8.68, 9.08], GH: [-1.02, 7.95], KE: [37.91, -0.02], ZA: [22.94, -30.56],
  JP: [138.25, 36.2], CN: [104.2, 35.86], MX: [-102.55, 23.63], CI: [-5.55, 7.54],
  ES: [-3.75, 40.46], IT: [12.57, 41.87], NL: [5.29, 52.13], SE: [18.64, 60.13],
  KR: [127.77, 35.91], PH: [121.77, 12.88], EG: [30.06, 26.82], TR: [35.24, 38.96],
  RU: [105.32, 61.52], AR: [-63.62, -38.42], CL: [-71.54, -35.68], CO: [-74.30, 4.57],
  ID: [113.92, -0.79], SA: [45.08, 23.89], PK: [69.35, 30.38], BD: [90.36, 23.68],
  TH: [100.99, 15.87], VN: [108.28, 14.06], MA: [-7.09, 31.79], TN: [9.54, 33.89],
  DZ: [1.66, 28.03], SN: [-14.45, 14.50], CM: [12.35, 3.85], ET: [40.49, 9.15],
  PL: [19.15, 51.92], UA: [31.17, 48.38], NZ: [174.89, -40.90], SG: [103.82, 1.35],
};

const FLAG_MAP: Record<string, string> = {
  US: "🇺🇸", GB: "🇬🇧", FR: "🇫🇷", DE: "🇩🇪", CA: "🇨🇦", AU: "🇦🇺", IN: "🇮🇳", BR: "🇧🇷",
  NG: "🇳🇬", GH: "🇬🇭", KE: "🇰🇪", ZA: "🇿🇦", JP: "🇯🇵", CN: "🇨🇳", MX: "🇲🇽", CI: "🇨🇮",
  ES: "🇪🇸", IT: "🇮🇹", NL: "🇳🇱", SE: "🇸🇪", KR: "🇰🇷", PH: "🇵🇭", EG: "🇪🇬", TR: "🇹🇷",
  RU: "🇷🇺", AR: "🇦🇷", CL: "🇨🇱", CO: "🇨🇴", ID: "🇮🇩", SA: "🇸🇦", PK: "🇵🇰", BD: "🇧🇩",
  TH: "🇹🇭", VN: "🇻🇳", MA: "🇲🇦", SN: "🇸🇳", CM: "🇨🇲", ET: "🇪🇹", PL: "🇵🇱", UA: "🇺🇦",
  NZ: "🇳🇿", SG: "🇸🇬", DZ: "🇩🇿", TN: "🇹🇳",
};

interface AnalyticsData {
  store: { name: string };
  overview: { totalViews: number; periodViews: number; uniqueVisitors: number; realtimeVisitors: number; storeAge: number };
  geo: { countries: Array<{ name: string; count: number; code: string }>; cities: Array<{ name: string; count: number }> };
  devices: { types: Array<{ name: string; count: number }>; browsers: Array<{ name: string; count: number }>; os: Array<{ name: string; count: number }> };
  pages: Array<{ name: string; count: number }>;
  referrers: Array<{ name: string; count: number }>;
  daily: Array<{ date: string; views: number }>;
}

export default function StoreVisitorAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [range, setRange] = useState("30d");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/ecommerce/visitor-analytics?range=${range}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [range]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const o = data?.overview;
  const maxDaily = Math.max(...(data?.daily?.map((d) => d.views) || [1]));
  const maxCountry = Math.max(...(data?.geo?.countries?.map((c) => c.count) || [1]));

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ShoppingBag className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Store Visitor Analytics</h1>
            <p className="text-sm text-muted-foreground">
              {data?.store?.name ? `Track visitors to ${data.store.name}` : "Track store visitors, locations, and behaviour"}
            </p>
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
        <StatCard icon={Clock} label="Store Age" value={`${o?.storeAge || 0}d`} />
      </div>

      {/* World Map + Top Countries */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 mb-6">
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-semibold flex items-center gap-2"><Globe className="w-5 h-5 text-primary" /> Visitor Map</h2>
          </div>
          <div className="relative bg-gradient-to-b from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-b-xl overflow-hidden">
            <ComposableMap
              projectionConfig={{ scale: 147, center: [0, 10] }}
              style={{ width: "100%", height: "auto" }}
            >
              <Geographies geography={GEO_URL}>
                {({ geographies }) =>
                  geographies.map((geo) => (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill="#CBD5E1"
                      stroke="#94A3B8"
                      strokeWidth={0.3}
                      style={{
                        default: { outline: "none" },
                        hover: { fill: "#94A3B8", outline: "none" },
                        pressed: { outline: "none" },
                      }}
                      className="dark:fill-slate-700 dark:stroke-slate-600"
                    />
                  ))
                }
              </Geographies>
              {(data?.geo?.countries || []).slice(0, 10).map((country, i) => {
                const coords = COUNTRY_COORDS[country.code];
                if (!coords) return null;
                const size = Math.max(5, Math.min(18, 5 + (country.count / maxCountry) * 13));
                return (
                  <Marker key={i} coordinates={coords}>
                    <circle r={size} fill="rgb(16 185 129 / 0.7)" stroke="white" strokeWidth={1.5} />
                    {size > 10 && (
                      <text textAnchor="middle" dy={4} fontSize={8} fill="white" fontWeight="bold">
                        {country.count}
                      </text>
                    )}
                  </Marker>
                );
              })}
            </ComposableMap>
            {(!data?.geo?.countries || data.geo.countries.length === 0) && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-sm text-muted-foreground bg-background/80 backdrop-blur-sm px-4 py-2 rounded-full">Visitor locations will appear here</p>
              </div>
            )}
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
                  <span className="text-lg">{FLAG_MAP[c.code] || "🌍"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(c.count / maxCountry) * 100}%` }} />
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
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Daily Visits</h2>
        <div className="flex items-end gap-1 h-32">
          {(data?.daily || []).map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
              <div className="w-full bg-emerald-500/20 hover:bg-emerald-500/40 rounded-t transition-colors" style={{ height: `${(d.views / maxDaily) * 100}%`, minHeight: 2 }}>
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-popover border border-border rounded px-1.5 py-0.5 text-[10px] hidden group-hover:block whitespace-nowrap z-10">
                  {d.date}: {d.views} visits
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

      {/* Store Insights */}
      <div className="bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border border-emerald-500/20 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Target className="w-5 h-5 text-emerald-500" /> Store Insights</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {generateStoreInsights(data).map((insight, i) => (
            <div key={i} className="bg-background/60 backdrop-blur rounded-lg p-3 border border-border/50">
              <p className="text-sm">{insight}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, highlight }: { icon: React.ElementType; label: string; value: number | string; highlight?: boolean }) {
  return (
    <div className={`p-4 rounded-xl border ${highlight ? "bg-emerald-500/10 border-emerald-500/30" : "bg-card border-border"}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${highlight ? "text-emerald-500" : "text-muted-foreground"}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</p>
    </div>
  );
}

function generateStoreInsights(data: AnalyticsData | null): string[] {
  if (!data || data.overview.periodViews === 0) {
    return [
      "Share your store link on social media, WhatsApp, and email to drive first visitors.",
      "Add your store URL to your website and email signature.",
      "Consider running promotions to attract your first customers.",
      "Make sure your store has great product photos and descriptions.",
    ];
  }
  const insights: string[] = [];
  const { devices, geo, referrers } = data;
  if (devices?.types?.length) {
    const mobile = devices.types.find((d) => d.name === "mobile");
    const total = devices.types.reduce((s, d) => s + d.count, 0);
    if (mobile && total > 0) {
      const pct = Math.round((mobile.count / total) * 100);
      if (pct > 60) insights.push(`📱 ${pct}% of shoppers are on mobile — ensure your checkout is mobile-friendly.`);
      else insights.push(`🖥️ ${100 - pct}% of shoppers use desktop — both layouts matter.`);
    }
  }
  if (geo?.countries?.length) {
    const top = geo.countries[0];
    insights.push(`🌍 ${FLAG_MAP[top.code] || ""} ${top.name} is your top market — consider adding local payment methods.`);
    if (geo.countries.length > 3) insights.push(`🌐 Visitors from ${geo.countries.length}+ countries — enable international shipping to capture more sales.`);
  }
  if (referrers?.length) {
    insights.push(`🔗 Top traffic source: ${referrers[0].name} — double down on this channel.`);
  } else {
    insights.push(`🔍 Most visitors arrive directly — grow discoverability with SEO and social media.`);
  }
  if (data.overview.uniqueVisitors > 0 && data.overview.periodViews > 0) {
    const pagesPerVisitor = (data.overview.periodViews / data.overview.uniqueVisitors).toFixed(1);
    insights.push(`📊 Visitors browse ${pagesPerVisitor} pages on average — higher is better for conversion.`);
  }
  return insights.length > 0 ? insights : ["Keep sharing your store to grow your audience!"];
}
