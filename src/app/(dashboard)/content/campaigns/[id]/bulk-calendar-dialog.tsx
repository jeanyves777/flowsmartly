"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarDays, Plus, Sparkles, Wand2, X } from "lucide-react";
import { AISpinner } from "@/components/shared/ai-generation-loader";
import {
  US_HOLIDAYS,
  getHolidayDate,
  type Holiday,
} from "@/lib/marketing/holidays";

interface Props {
  campaignId: string;
  defaultPlatforms: string[];
  defaultTone: string | null;
  onClose: () => void;
  onCreated: (created: string[]) => void;
}

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

const MEDIA_MODES: { value: string; label: string }[] = [
  { value: "AI_AT_POST_TIME", label: "AI generated at post time" },
  { value: "FOLDER", label: "From campaign folder (round-robin)" },
  { value: "NONE", label: "Text only" },
];

function holidayDateLabel(holiday: Holiday) {
  const year = new Date().getFullYear();
  const date = getHolidayDate(holiday, year);
  return new Date(year, date.month - 1, date.day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function BulkCalendarDialog({
  campaignId,
  defaultPlatforms,
  defaultTone,
  onClose,
  onCreated,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiFill, setAiFill] = useState(true);
  const [mediaMode, setMediaMode] = useState("AI_AT_POST_TIME");
  const [platforms, setPlatforms] = useState<string[]>(
    defaultPlatforms.length > 0 ? defaultPlatforms : ["instagram", "facebook"],
  );
  const [offsets, setOffsets] = useState([
    { days: -1, time: "09:00" },
    { days: 0, time: "09:00" },
  ]);

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

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () =>
    setSelected(new Set(sortedHolidays.map((h) => h.id)));
  const clearAll = () => setSelected(new Set());

  const togglePlatform = (p: string) =>
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );

  const updateOffset = (idx: number, key: "days" | "time", value: string) => {
    setOffsets((prev) =>
      prev.map((o, i) =>
        i === idx ? { ...o, [key]: key === "days" ? Number(value) : value } : o,
      ),
    );
  };
  const addOffset = () =>
    setOffsets((prev) => [...prev, { days: 0, time: "09:00" }]);
  const removeOffset = (idx: number) =>
    setOffsets((prev) => prev.filter((_, i) => i !== idx));

  const submit = async () => {
    if (selected.size === 0) {
      setError("Pick at least one calendar event");
      return;
    }
    if (platforms.length === 0) {
      setError("Pick at least one platform");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/content/campaigns/${campaignId}/automations/bulk-calendar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            holidayIds: [...selected],
            offsets,
            platforms,
            mediaMode,
            tone: defaultTone ?? undefined,
            aiFill,
          }),
        },
      );
      const json = await res.json();
      if (!json?.success) {
        setError(json?.error?.message ?? "Bulk create failed");
        setSaving(false);
        return;
      }
      onCreated(json.data.created ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk create failed");
      setSaving(false);
    }
  };

  const allSelected = selected.size === sortedHolidays.length;

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-blue-600" />
            Bulk-create from calendar events
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Each selected event becomes its own automation with the offsets,
          platforms, and media mode you set below. Each gets its own AI-fresh
          caption.
        </p>

        {/* Pick events */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Pick the calendar events</Label>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={selectAll}>
                Select all
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
                Clear
              </Button>
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3 max-h-[340px] overflow-y-auto pr-1">
            {sortedHolidays.map((h) => {
              const checked = selected.has(h.id);
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => toggle(h.id)}
                  className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                    checked
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-500"
                      : "bg-white border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  }`}
                >
                  <Checkbox
                    checked={checked}
                    onClick={(e) => e.stopPropagation()}
                    onCheckedChange={() => toggle(h.id)}
                  />
                  <span className="text-lg leading-none">{h.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {h.name}
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {holidayDateLabel(h)} · {h.category}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between rounded-lg border bg-zinc-50 dark:bg-zinc-900/40 p-3 text-sm">
            <span className="font-semibold">
              {selected.size} of {sortedHolidays.length} selected
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {allSelected
                ? "Full calendar — one automation per event"
                : "Only the selected events will be automated"}
            </span>
          </div>
        </div>

        {/* Offsets */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Offsets per event</Label>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Each event creates a post at each offset (negative = before, 0 = day of, positive = after).
          </p>
          {offsets.map((o, idx) => (
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
              {offsets.length > 1 && (
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

        {/* Platforms */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Platforms</Label>
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

        {/* Media mode */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Media</Label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {MEDIA_MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMediaMode(m.value)}
                className={`text-left px-3 py-2 rounded-md border text-sm ${
                  mediaMode === m.value
                    ? "bg-blue-50 border-blue-500 dark:bg-blue-900/20"
                    : "bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-700"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* AI fill */}
        <div className="rounded-lg border bg-gradient-to-br from-blue-50 to-violet-50 dark:from-blue-950/30 dark:to-violet-950/30 border-blue-200 dark:border-blue-900 p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox
              checked={aiFill}
              onCheckedChange={(c) => setAiFill(c === true)}
              className="mt-0.5"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="font-semibold text-sm">Fill each item with AI</span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1">
                Generate a unique topic, caption, and hashtags for each selected
                event using your brand context. Items will still arrive
                PENDING_REVIEW so you can edit before they go live.
              </p>
            </div>
          </label>
        </div>

        {error && (
          <div className="text-sm text-rose-600 dark:text-rose-400">{error}</div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={saving || selected.size === 0}
          >
            {saving ? (
              <AISpinner className="w-4 h-4 mr-2" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            {saving
              ? aiFill
                ? `Creating ${selected.size} items with AI...`
                : `Creating ${selected.size} items...`
              : `Create ${selected.size || 0} item${selected.size === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
