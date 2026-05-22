"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  Save,
  Sparkles,
  Wand2,
  CalendarDays,
  Plus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AISpinner } from "@/components/shared/ai-generation-loader";
import { AILoaderOverlay } from "@/components/shared/ai-loader-overlay";
import { US_HOLIDAYS, getHolidayDate } from "@/lib/marketing/holidays";
import { Check } from "lucide-react";

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

const MEDIA_MODES = [
  { value: "AI_AT_POST_TIME", label: "AI media at post time" },
  { value: "NONE", label: "Text only" },
];

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

function holidayDateLabel(holidayId: string) {
  const h = US_HOLIDAYS.find((x) => x.id === holidayId);
  if (!h) return "";
  const year = new Date().getFullYear();
  const date = getHolidayDate(h, year);
  return new Date(year, date.month - 1, date.day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function NewCampaignPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [savingStep, setSavingStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiHint, setAiHint] = useState("");
  const [aiBusy, setAiBusy] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [defaultTone, setDefaultTone] = useState("friendly");
  const [platforms, setPlatforms] = useState<string[]>(["instagram", "facebook"]);

  // Calendar events (optional bulk-add at creation time)
  const [eventIds, setEventIds] = useState<Set<string>>(new Set());
  const [eventOffsets, setEventOffsets] = useState([
    { days: -1, time: "09:00" },
    { days: 0, time: "09:00" },
  ]);
  const [eventAiFill, setEventAiFill] = useState(true);
  const [eventMediaMode, setEventMediaMode] = useState("AI_AT_POST_TIME");
  const [eventStyleStrategy, setEventStyleStrategy] = useState<"ai" | "variant" | "same">("ai");
  const [eventSameTier, setEventSameTier] = useState<"standard" | "premium">("standard");
  const [eventSameStyle, setEventSameStyle] = useState<"realistic" | "3d">("realistic");

  const sortedHolidays = useMemo(
    () =>
      [...US_HOLIDAYS].sort((a, b) => {
        const year = new Date().getFullYear();
        const da = getHolidayDate(a, year);
        const db = getHolidayDate(b, year);
        return da.month - db.month || da.day - db.day;
      }),
    [],
  );

  const togglePlatform = (p: string) => {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  };

  const toggleEvent = (id: string) => {
    setEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectAllEvents = () => setEventIds(new Set(sortedHolidays.map((h) => h.id)));
  const clearAllEvents = () => setEventIds(new Set());

  const updateOffset = (idx: number, key: "days" | "time", value: string) => {
    setEventOffsets((prev) =>
      prev.map((o, i) =>
        i === idx ? { ...o, [key]: key === "days" ? Number(value) : value } : o,
      ),
    );
  };
  const addOffset = () =>
    setEventOffsets((prev) => [...prev, { days: 0, time: "09:00" }]);
  const removeOffset = (idx: number) =>
    setEventOffsets((prev) => prev.filter((_, i) => i !== idx));

  const runSuggest = async (field: SuggestField) => {
    setAiBusy(field);
    setError(null);
    try {
      const value = await aiSuggest(field, aiHint, { campaignName: name || undefined });
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
    setSavingStep("Creating campaign...");
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
        setSavingStep(null);
        return;
      }
      const campaignId = json.data.campaign.id;

      if (eventIds.size > 0) {
        setSavingStep(
          eventAiFill
            ? `AI-filling ${eventIds.size} calendar item${eventIds.size === 1 ? "" : "s"}...`
            : `Creating ${eventIds.size} calendar item${eventIds.size === 1 ? "" : "s"}...`,
        );
        const bulkRes = await fetch(
          `/api/content/campaigns/${campaignId}/automations/bulk-calendar`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              holidayIds: [...eventIds],
              offsets: eventOffsets,
              platforms,
              mediaMode: eventMediaMode,
              tone: defaultTone,
              aiFill: eventAiFill,
              styleStrategy: eventStyleStrategy,
              sameTier: eventSameTier,
              sameStyle: eventSameStyle,
            }),
          },
        );
        const bulkJson = await bulkRes.json();
        if (!bulkJson?.success) {
          // Campaign exists — soft-warn and continue to detail page
          console.warn("Bulk calendar create failed", bulkJson?.error);
        }
      }

      router.push(`/content/campaigns/${campaignId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create campaign");
      setSaving(false);
      setSavingStep(null);
    }
  };

  return (
    <div className="space-y-6">
      <AILoaderOverlay
        open={saving && !!savingStep}
        currentStep={savingStep ?? ""}
        subtitle={
          eventIds.size > 0 && eventAiFill
            ? "Brand-aware captions are being generated for each event"
            : "Almost there"
        }
      />
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
          every field has an AI helper. You can also bulk-add calendar events
          right here.
        </p>
      </div>

      <form onSubmit={submit} className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-6">
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
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    <CalendarDays className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    Calendar events (optional)
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    Bulk-create one automation per selected event. Skip this if
                    you want to add items manually later.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={selectAllEvents}>
                    Select all
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={clearAllEvents}>
                    Clear
                  </Button>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 max-h-[340px] overflow-y-auto pr-1">
                {sortedHolidays.map((h) => {
                  const checked = eventIds.has(h.id);
                  return (
                    <div
                      key={h.id}
                      role="button"
                      aria-pressed={checked}
                      tabIndex={0}
                      onClick={() => toggleEvent(h.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleEvent(h.id);
                        }
                      }}
                      className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors cursor-pointer select-none ${
                        checked
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-500"
                          : "bg-white border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-700 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`mt-0.5 h-4 w-4 shrink-0 rounded-sm border flex items-center justify-center ${
                          checked
                            ? "bg-blue-600 border-blue-600 text-white"
                            : "border-zinc-300 dark:border-zinc-600"
                        }`}
                      >
                        {checked && <Check className="h-3.5 w-3.5" />}
                      </span>
                      <span className="text-lg leading-none">{h.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {h.name}
                        </span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          {holidayDateLabel(h.id)} · {h.category}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>

              {eventIds.size > 0 && (
                <div className="space-y-3 rounded-lg border bg-zinc-50 dark:bg-zinc-900/40 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">
                      {eventIds.size} event{eventIds.size === 1 ? "" : "s"} selected
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      Each event creates {eventOffsets.length} post
                      {eventOffsets.length === 1 ? "" : "s"} ·{" "}
                      <strong>{eventIds.size * eventOffsets.length} total</strong>
                    </span>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Offsets per event</Label>
                    {eventOffsets.map((o, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={o.days}
                          onChange={(e) => updateOffset(idx, "days", e.target.value)}
                          className="w-20 text-sm"
                        />
                        <span className="text-xs text-zinc-500">days at</span>
                        <Input
                          type="time"
                          value={o.time}
                          onChange={(e) => updateOffset(idx, "time", e.target.value)}
                          className="w-32 text-sm"
                        />
                        {eventOffsets.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeOffset(idx)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={addOffset}>
                      <Plus className="w-3 h-3 mr-1" />
                      Add offset
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {MEDIA_MODES.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setEventMediaMode(m.value)}
                        className={`text-left px-3 py-2 rounded-md border text-sm ${
                          eventMediaMode === m.value
                            ? "bg-blue-50 border-blue-500 dark:bg-blue-900/20"
                            : "bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-700"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Style strategy</Label>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Pick once for the whole batch — applied to all selected
                      events so you don&apos;t need to set Quality / Style on
                      each one individually.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {(
                        [
                          { v: "ai", label: "AI picks best fit", hint: "Recommended — commercial → realistic, cultural → 3D" },
                          { v: "variant", label: "Variety per event", hint: "Alternate realistic and 3D" },
                          { v: "same", label: "Same for all", hint: "Pick one Quality + Style for every event" },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.v}
                          type="button"
                          onClick={() => setEventStyleStrategy(opt.v)}
                          className={`text-left px-3 py-2 rounded-md border text-sm ${
                            eventStyleStrategy === opt.v
                              ? "bg-blue-50 border-blue-500 dark:bg-blue-900/20"
                              : "bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-700"
                          }`}
                        >
                          <div className="font-medium">{opt.label}</div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">{opt.hint}</div>
                        </button>
                      ))}
                    </div>
                    {eventStyleStrategy === "same" && (
                      <div className="space-y-2 rounded-md border bg-white dark:bg-zinc-950 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Label className="text-xs w-16">Quality:</Label>
                          <div className="flex rounded-md border overflow-hidden">
                            {(["standard", "premium"] as const).map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setEventSameTier(t)}
                                className={`px-3 py-1.5 text-xs font-medium ${t !== "standard" ? "border-l" : ""} ${eventSameTier === t ? "bg-blue-600 text-white" : "text-zinc-600 dark:text-zinc-300"}`}
                              >
                                {t === "standard" ? "Standard" : "Premium"}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Label className="text-xs w-16">Style:</Label>
                          <div className="flex rounded-md border overflow-hidden">
                            {(["realistic", "3d"] as const).map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => setEventSameStyle(s)}
                                className={`px-3 py-1.5 text-xs font-medium ${s !== "realistic" ? "border-l" : ""} ${eventSameStyle === s ? "bg-blue-600 text-white" : "text-zinc-600 dark:text-zinc-300"}`}
                              >
                                {s === "realistic" ? "Realistic" : "3D"}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <label className="flex items-start gap-3 cursor-pointer rounded-md border bg-gradient-to-br from-blue-50 to-violet-50 dark:from-blue-950/30 dark:to-violet-950/30 border-blue-200 dark:border-blue-900 p-3">
                    <Checkbox
                      checked={eventAiFill}
                      onCheckedChange={(c) => setEventAiFill(c === true)}
                      className="mt-0.5"
                    />
                    <span className="flex-1">
                      <span className="flex items-center gap-2">
                        <Wand2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span className="font-medium text-sm">Fill each item with AI</span>
                      </span>
                      <span className="text-xs text-zinc-600 dark:text-zinc-300 mt-1 block">
                        AI writes a unique topic + caption + hashtags for each
                        event using your brand context.
                      </span>
                    </span>
                  </label>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              {error && (
                <div className="text-sm text-rose-600 dark:text-rose-400 mb-3">
                  {error}
                </div>
              )}
              {saving && savingStep && (
                <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300 mb-3">
                  <AISpinner className="w-4 h-4" />
                  {savingStep}
                </div>
              )}
              <div className="flex justify-end gap-2">
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
                  {saving
                    ? "Creating..."
                    : eventIds.size > 0
                    ? `Create + add ${eventIds.size} event${eventIds.size === 1 ? "" : "s"}`
                    : "Create campaign"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-gradient-to-br from-blue-50 to-violet-50 dark:from-blue-950/30 dark:to-violet-950/30 border-blue-200 dark:border-blue-900 h-fit lg:sticky lg:top-4">
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
                {[
                  ["Black Friday — promote our top 3 products with a 7-day teaser, day-of, and follow-up", "· Black Friday week"],
                  ["Product launch — build hype with a 2-week countdown, hero post on launch day, and 1-week follow-up testimonials", "· Product launch"],
                  ["Holiday content series — every major US holiday for the next 3 months", "· Holiday content series"],
                  ["Brand awareness — weekly evergreen posts about who we are, what we do, and customer stories", "· Brand awareness drumbeat"],
                ].map(([hint, label]) => (
                  <li key={label}>
                    <button
                      type="button"
                      onClick={() => setAiHint(hint)}
                      className="text-left hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
