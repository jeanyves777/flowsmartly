"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Save, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AISpinner } from "@/components/shared/ai-generation-loader";

const ALL_PLATFORMS = [
  "instagram",
  "facebook",
  "twitter",
  "linkedin",
  "tiktok",
  "youtube",
  "threads",
  "pinterest",
];

const TONES = ["friendly", "professional", "playful", "bold", "inspirational"];

type SuggestField = "campaign_name" | "campaign_description";

async function aiSuggest(field: SuggestField, hint: string, overrides?: Record<string, unknown>) {
  const res = await fetch("/api/content/campaigns/ai-suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ field, hint, overrides }),
  });
  const json = await res.json();
  if (!json?.success) throw new Error(json?.error?.message ?? "AI suggestion failed");
  return json.data.value as string;
}

export default function NewCampaignPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiHint, setAiHint] = useState("");
  const [aiBusy, setAiBusy] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [defaultTone, setDefaultTone] = useState("friendly");
  const [platforms, setPlatforms] = useState<string[]>(["instagram", "facebook"]);

  const togglePlatform = (p: string) => {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  };

  const runSuggest = async (field: SuggestField) => {
    setAiBusy(field);
    setError(null);
    try {
      const value = await aiSuggest(field, aiHint, {
        campaignName: name || undefined,
      });
      if (field === "campaign_name") setName(value);
      else if (field === "campaign_description") setDescription(value);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI suggestion failed");
    } finally {
      setAiBusy(null);
    }
  };

  const runFullFill = async () => {
    if (!aiHint.trim()) {
      setError("Type a quick idea above so AI knows what to fill.");
      return;
    }
    setAiBusy("full");
    setError(null);
    try {
      const [nm, desc] = await Promise.all([
        aiSuggest("campaign_name", aiHint),
        aiSuggest("campaign_description", aiHint, { campaignName: name || undefined }),
      ]);
      setName(nm);
      setDescription(desc);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI fill failed");
    } finally {
      setAiBusy(null);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Campaign name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/content/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          startDate: startDate || null,
          endDate: endDate || null,
          defaultTone,
          defaultPlatforms: platforms,
        }),
      });
      const json = await res.json();
      if (!json?.success) {
        setError(json?.error?.message ?? "Failed to create campaign");
        setSaving(false);
        return;
      }
      router.push(`/content/campaigns/${json.data.campaign.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create campaign");
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/content/campaigns"
          className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1"
        >
          <ChevronLeft className="w-4 h-4" />
          Campaigns
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">New campaign</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Tell the AI what this campaign is about, or fill in fields manually —
          every field has an AI helper.
        </p>
      </div>

      <form onSubmit={submit} className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <Card>
          <CardContent className="p-6 space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="name">Campaign name</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => runSuggest("campaign_name")}
                  disabled={!!aiBusy}
                  className="h-7 text-xs"
                >
                  {aiBusy === "campaign_name" ? (
                    <AISpinner className="w-3.5 h-3.5 mr-1" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 mr-1" />
                  )}
                  Suggest
                </Button>
              </div>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Summer 2026 Promo"
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => runSuggest("campaign_description")}
                  disabled={!!aiBusy}
                  className="h-7 text-xs"
                >
                  {aiBusy === "campaign_description" ? (
                    <AISpinner className="w-3.5 h-3.5 mr-1" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 mr-1" />
                  )}
                  Suggest
                </Button>
              </div>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this campaign about?"
                rows={4}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start date (optional)</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End date (optional)</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Default tone</Label>
              <div className="flex flex-wrap gap-2">
                {TONES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setDefaultTone(t)}
                    className={`px-3 py-1.5 rounded-md text-sm border transition-colors capitalize ${
                      defaultTone === t
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-zinc-700 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Default platforms</Label>
              <div className="flex flex-wrap gap-2">
                {ALL_PLATFORMS.map((p) => (
                  <Badge
                    key={p}
                    onClick={() => togglePlatform(p)}
                    className={`cursor-pointer capitalize ${
                      platforms.includes(p)
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    }`}
                  >
                    {p}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Items inside this campaign default to these platforms; you can
                override per item.
              </p>
            </div>

            {error && (
              <div className="text-sm text-rose-600 dark:text-rose-400">{error}</div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/content/campaigns")}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !!aiBusy}>
                {saving ? (
                  <AISpinner className="w-4 h-4 mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {saving ? "Creating..." : "Create campaign"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-violet-50 dark:from-blue-950/30 dark:to-violet-950/30 border-blue-200 dark:border-blue-900">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="font-semibold">AI assist</h3>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Type a quick idea — AI fills name + description from your brand
              context.
            </p>
            <Textarea
              value={aiHint}
              onChange={(e) => setAiHint(e.target.value)}
              placeholder="e.g. Black Friday — push our top 3 products, 7 days lead-up + day-of"
              rows={4}
              className="bg-white dark:bg-zinc-950 border-blue-200 dark:border-blue-900"
            />
            <Button
              type="button"
              onClick={runFullFill}
              disabled={!!aiBusy}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {aiBusy === "full" ? (
                <AISpinner className="w-4 h-4 mr-2" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              {aiBusy === "full" ? "Filling..." : "Fill in the blanks"}
            </Button>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1 pt-2 border-t border-blue-200 dark:border-blue-900">
              <p className="font-semibold uppercase tracking-wider">Quick ideas</p>
              <ul className="space-y-1">
                <li>
                  <button
                    type="button"
                    onClick={() =>
                      setAiHint(
                        "Black Friday — promote our top 3 products with a 7-day teaser, day-of, and follow-up",
                      )
                    }
                    className="text-left hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    · Black Friday week
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() =>
                      setAiHint(
                        "Product launch — build hype with a 2-week countdown, hero post on launch day, and 1-week follow-up testimonials",
                      )
                    }
                    className="text-left hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    · Product launch
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() =>
                      setAiHint(
                        "Holiday content series — every major US holiday for the next 3 months",
                      )
                    }
                    className="text-left hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    · Holiday content series
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() =>
                      setAiHint(
                        "Brand awareness — weekly evergreen posts about who we are, what we do, and customer stories",
                      )
                    }
                    className="text-left hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    · Brand awareness drumbeat
                  </button>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
