"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Heart,
  MessageSquare,
  UserPlus,
  Eye,
  FileText,
  Play,
  Sparkles,
  Images,
  RefreshCw,
  Power,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AISpinner } from "@/components/shared/ai-generation-loader";

interface Snapshot {
  config: { enabled: boolean; intensity: number; niches: string[] };
  niches: { key: string; label: string }[];
  personas: { total: number; enabled: number; byNiche: Record<string, number> };
  media: Record<string, number>;
  activity: { today: Record<string, number>; total: Record<string, number> };
  recent: Array<{
    id: string;
    action: string;
    actor: { name: string; username: string; avatarUrl: string | null } | null;
    targetPostId: string | null;
    createdAt: string;
  }>;
}

const ACTION_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  like: Heart,
  comment: MessageSquare,
  follow: UserPlus,
  view: Eye,
  post: FileText,
};

export default function AdminEngagementPage() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [intensity, setIntensity] = useState(100);
  const [genCount, setGenCount] = useState(50);
  const [perNiche, setPerNiche] = useState(12);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/engagement");
      const data = await res.json();
      if (data.success) {
        setSnap(data.data);
        setIntensity(data.data.config.intensity);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const post = async (payload: Record<string, unknown>, key: string) => {
    setBusy(key);
    try {
      const res = await fetch("/api/admin/engagement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.message) setToast(data.message);
      else if (data.success) setToast("Done");
      else setToast(data.error?.message || "Failed");
      await load();
    } catch {
      setToast("Request failed");
    } finally {
      setBusy(null);
      setTimeout(() => setToast(null), 4000);
    }
  };

  if (loading || !snap) {
    return (
      <div className="flex items-center justify-center py-32">
        <AISpinner size={32} />
      </div>
    );
  }

  const { config, personas, activity, media, niches, recent } = snap;
  const today = activity.today;

  const statCards = [
    { label: "Personas", value: personas.total, sub: `${personas.enabled} active`, icon: Users },
    { label: "Views today", value: today.view || 0, icon: Eye },
    { label: "Likes today", value: today.like || 0, icon: Heart },
    { label: "Comments today", value: today.comment || 0, icon: MessageSquare },
    { label: "Follows today", value: today.follow || 0, icon: UserPlus },
    { label: "Posts today", value: today.post || 0, icon: FileText },
  ];

  const totalMedia = Object.values(media).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-sky-500" />
            Feed Engagement
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Internal seed accounts that keep the native feed lively. Confidential — fully isolated
            from billing, payouts, email and real-user analytics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            className={
              config.enabled
                ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                : "bg-zinc-500/15 text-zinc-400 border-zinc-500/30"
            }
          >
            {config.enabled ? "RUNNING" : "PAUSED"}
          </Badge>
          <Button
            variant={config.enabled ? "outline" : "default"}
            onClick={() => post({ action: "set_config", enabled: !config.enabled }, "toggle")}
            disabled={busy === "toggle"}
          >
            {busy === "toggle" ? (
              <AISpinner size={16} className="mr-2" />
            ) : (
              <Power className="w-4 h-4 mr-2" />
            )}
            {config.enabled ? "Pause" : "Activate"}
          </Button>
        </div>
      </div>

      {toast && (
        <div className="rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-600 dark:text-sky-300 px-4 py-2 text-sm">
          {toast}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Icon className="w-4 h-4" />
                  {c.label}
                </div>
                <div className="text-2xl font-bold">{c.value.toLocaleString()}</div>
                {c.sub && <div className="text-xs text-muted-foreground">{c.sub}</div>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Controls */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Intensity */}
        <Card>
          <CardContent className="p-5 space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Activity intensity
            </h3>
            <p className="text-xs text-muted-foreground">
              Global multiplier on how much the fleet engages each tick.
            </p>
            <input
              type="range"
              min={0}
              max={100}
              value={intensity}
              onChange={(e) => setIntensity(parseInt(e.target.value))}
              className="w-full accent-sky-500"
            />
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{intensity}%</span>
              <Button
                size="sm"
                onClick={() => post({ action: "set_config", intensity }, "intensity")}
                disabled={busy === "intensity"}
              >
                {busy === "intensity" ? <AISpinner size={14} className="mr-1" /> : null}
                Save
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Generate personas */}
        <Card>
          <CardContent className="p-5 space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Users className="w-4 h-4" /> Generate personas
            </h3>
            <p className="text-xs text-muted-foreground">
              Creates accounts with AI-generated faces, distributed across niches. Runs in the
              background (max 250 per batch).
            </p>
            <input
              type="number"
              min={1}
              max={250}
              value={genCount}
              onChange={(e) => setGenCount(parseInt(e.target.value) || 0)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
            <Button
              className="w-full"
              onClick={() => post({ action: "generate", count: genCount }, "generate")}
              disabled={busy === "generate"}
            >
              {busy === "generate" ? (
                <AISpinner size={14} className="mr-2" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              Generate {genCount}
            </Button>
          </CardContent>
        </Card>

        {/* Seed media */}
        <Card>
          <CardContent className="p-5 space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Images className="w-4 h-4" /> Post image pool
            </h3>
            <p className="text-xs text-muted-foreground">
              Free, license-free images per niche stored on our S3. Bot posts pick from here — zero
              API cost. Currently {totalMedia.toLocaleString()} images.
            </p>
            <input
              type="number"
              min={1}
              max={40}
              value={perNiche}
              onChange={(e) => setPerNiche(parseInt(e.target.value) || 0)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
            <Button
              className="w-full"
              variant="outline"
              onClick={() => post({ action: "seed_media", perNiche }, "seed")}
              disabled={busy === "seed"}
            >
              {busy === "seed" ? (
                <AISpinner size={14} className="mr-2" />
              ) : (
                <Images className="w-4 h-4 mr-2" />
              )}
              Seed {perNiche}/niche
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Run-now + niche breakdown */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Niche breakdown</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => post({ action: "run_tick" }, "tick")}
                disabled={busy === "tick"}
              >
                {busy === "tick" ? (
                  <AISpinner size={14} className="mr-1" />
                ) : (
                  <Play className="w-4 h-4 mr-1" />
                )}
                Run tick now
              </Button>
            </div>
            <div className="space-y-1.5 max-h-72 overflow-auto">
              {niches.map((n) => (
                <div
                  key={n.key}
                  className="flex items-center justify-between text-sm py-1 border-b border-border/40 last:border-0"
                >
                  <span>{n.label}</span>
                  <span className="text-muted-foreground">
                    {personas.byNiche[n.key] || 0} personas · {media[n.key] || 0} imgs
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardContent className="p-5">
            <h3 className="font-semibold mb-3">Live activity</h3>
            <div className="space-y-2 max-h-72 overflow-auto">
              {recent.length === 0 && (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              )}
              {recent.map((r) => {
                const Icon = ACTION_ICON[r.action] || Eye;
                return (
                  <div key={r.id} className="flex items-center gap-2 text-sm">
                    <Icon className="w-4 h-4 text-sky-500 shrink-0" />
                    <span className="font-medium truncate">
                      {r.actor?.name || "—"}
                    </span>
                    <span className="text-muted-foreground">{r.action}ed</span>
                    <span className="text-xs text-muted-foreground ml-auto shrink-0">
                      {new Date(r.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
