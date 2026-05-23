"use client";

import { useEffect, useState } from "react";
import { FloatingPanel } from "@/components/ui/floating-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AISpinner } from "@/components/shared/ai-generation-loader";
import { AISuggestButton } from "@/components/shared/ai-suggest-button";
import { CalendarDays, Repeat, Zap, Sparkles, Plus, X, ListPlus, ChevronDown, ChevronUp } from "lucide-react";

interface CalendarSource {
  type: "EVENT" | "SCHEDULED_POST" | "HOLIDAY";
  id: string;
  label: string;
  date: string;
  meta?: { icon?: string; description?: string };
}

// AI_GENERATED is intentionally NOT in the new UI — it conflated content
// generation with schedule. Existing rows in the DB still keep that value;
// new items pick a schedule (CALENDAR_EVENT / RECURRING / ONE_OFF) and a
// separate content mode (AI / MANUAL) below.
type TriggerType = "RECURRING" | "CALENDAR_EVENT" | "ONE_OFF";

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

const MEDIA_MODES: { value: string; label: string; description: string }[] = [
  { value: "AI_AT_POST_TIME", label: "AI generated at post time", description: "Let AI create media when posting" },
  { value: "FOLDER", label: "From a folder", description: "Round-robin through a media folder" },
  { value: "SPECIFIC_FILE", label: "Specific file", description: "Use one chosen file" },
  { value: "UPLOAD", label: "Direct URL", description: "Paste a media URL" },
  { value: "NONE", label: "Text only", description: "No media attached" },
];

const DEFAULT_OFFSETS = [{ days: 0, time: "09:00" }];

interface Props {
  campaignId: string;
  defaultPlatforms: string[];
  defaultTone: string | null;
  onClose: () => void;
  onCreated: () => void;
}

export default function AddItemDialog({
  campaignId,
  defaultPlatforms,
  defaultTone,
  onClose,
  onCreated,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [triggerType, setTriggerType] = useState<TriggerType>("CALENDAR_EVENT");
  const [platforms, setPlatforms] = useState<string[]>(
    defaultPlatforms.length > 0 ? defaultPlatforms : ["instagram", "facebook"],
  );
  const [mediaMode, setMediaMode] = useState("AI_AT_POST_TIME");
  const [mediaUrl, setMediaUrl] = useState("");

  // Calendar-event state
  const [sources, setSources] = useState<CalendarSource[]>([]);
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>("");
  const [selectedSource, setSelectedSource] = useState<CalendarSource | null>(null);
  const [offsets, setOffsets] = useState(DEFAULT_OFFSETS);

  // Recurring state
  const [frequency, setFrequency] = useState<"DAILY" | "WEEKLY" | "MONTHLY">("WEEKLY");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [recurringTime, setRecurringTime] = useState("09:00");

  // One-off state
  const [oneOffStart, setOneOffStart] = useState("");

  // Content generation — independent of schedule. "AI" means the post copy
  // is generated at post time from the topic/brief. "MANUAL" means the user
  // types the exact copy below. Backend already supports the combination
  // (aiPrompt vs copy fields); the old AI_GENERATED triggerType is no
  // longer offered as a schedule.
  const [contentMode, setContentMode] = useState<"AI" | "MANUAL">("AI");
  const [manualCopy, setManualCopy] = useState("");

  // Picker UI — collapsed by default once a source is selected so the user
  // doesn't have to scroll past 12 months of entries every time. Opens
  // automatically while none is picked.
  const [pickerOpen, setPickerOpen] = useState(true);
  useEffect(() => {
    if (selectedSource) setPickerOpen(false);
  }, [selectedSource]);

  useEffect(() => {
    if (triggerType !== "CALENDAR_EVENT") return;
    fetch("/api/content/campaigns/calendar-sources")
      .then((r) => r.json())
      .then((json) => {
        if (json?.success) setSources(json.data.sources);
      });
  }, [triggerType]);

  const filteredSources = sourceTypeFilter
    ? sources.filter((s) => s.type === sourceTypeFilter)
    : sources;

  const togglePlatform = (p: string) => {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  };

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Item name is required");
      return;
    }
    if (triggerType === "CALENDAR_EVENT" && !selectedSource) {
      setError("Pick a calendar entry as the source");
      return;
    }
    setSaving(true);
    setError(null);

    const body: Record<string, unknown> = {
      name: name.trim(),
      topic: topic.trim() || null,
      triggerType,
      platforms,
      mediaMode,
      aiTone: defaultTone,
      // Content generation. AI mode passes the topic through as the
      // generation prompt and leaves copy null so the scheduler generates
      // fresh text at post time. Manual mode passes the exact copy and
      // leaves aiPrompt null.
      aiPrompt: contentMode === "AI" ? topic.trim() || null : null,
      copy: contentMode === "MANUAL" ? manualCopy.trim() || null : null,
    };

    if (triggerType === "CALENDAR_EVENT" && selectedSource) {
      body.calendarSourceType = selectedSource.type;
      body.calendarSourceId = selectedSource.id;
      body.calendarSourceLabel = selectedSource.label;
      body.calendarOffsets = offsets;
    }
    if (triggerType === "RECURRING") {
      body.triggerConfig = {
        frequency,
        dayOfWeek,
        time: recurringTime,
      };
    }
    if (triggerType === "ONE_OFF" && oneOffStart) {
      body.triggerConfig = {
        frequency: "ONCE",
        time: recurringTime,
        firstRunDate: oneOffStart,
      };
      body.startDate = oneOffStart;
    }
    if (mediaMode === "UPLOAD" && mediaUrl) {
      body.mediaUrl = mediaUrl;
    }
    if (mediaMode === "AI_AT_POST_TIME") {
      body.aiMediaConfig = { type: "image", style: "natural" };
    }

    const res = await fetch(`/api/content/campaigns/${campaignId}/automations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setSaving(false);
    if (!json?.success) {
      setError(json?.error?.message ?? "Failed to create item");
      return;
    }
    onCreated();
  };

  return (
    <FloatingPanel
      open
      onOpenChange={(next) => !next && onClose()}
      title="Add content item"
      description="Pick a trigger, set platforms and media, then create."
      icon={<ListPlus className="h-4 w-4" />}
      defaultSize={{ width: 720, height: 720 }}
      minSize={{ width: 360, height: 420 }}
    >
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="name">Item name</Label>
              <AISuggestButton
                endpoint="/api/content/campaigns/ai-suggest"
                payload={{
                  field: "item_name",
                  campaignId,
                  hint: selectedSource?.label || topic || undefined,
                  overrides: { itemTopic: topic || undefined },
                }}
                onResult={(v) => setName(v)}
                label="AI fill"
                size="sm"
              />
            </div>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Black Friday teaser"
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="topic">Topic / brief (optional)</Label>
              <AISuggestButton
                endpoint="/api/content/campaigns/ai-suggest"
                payload={{
                  field: "item_topic",
                  campaignId,
                  hint: selectedSource?.label || name || undefined,
                  overrides: { itemName: name || undefined },
                }}
                onResult={(v) => setTopic(v)}
                label="AI fill"
                size="sm"
              />
            </div>
            <Textarea
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="What is this post about?"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Schedule</Label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { v: "CALENDAR_EVENT", label: "Calendar event", icon: CalendarDays },
                  { v: "RECURRING", label: "Recurring", icon: Repeat },
                  { v: "ONE_OFF", label: "One-off", icon: Zap },
                ] as const
              ).map(({ v, label, icon: Icon }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setTriggerType(v)}
                  className={`text-left px-3 py-2 rounded-md border text-sm flex items-center gap-2 ${
                    triggerType === v
                      ? "bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                      : "bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-700"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {triggerType === "CALENDAR_EVENT" && (
            <div className="space-y-3 border rounded-md p-3 bg-zinc-50 dark:bg-zinc-900/40">
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                className="flex items-center justify-between w-full text-left"
              >
                <div className="flex items-center gap-2">
                  <Label className="cursor-pointer">Pick a calendar entry</Label>
                  {selectedSource && (
                    <span className="text-xs text-zinc-600 dark:text-zinc-300 flex items-center gap-1 truncate max-w-[280px]">
                      {selectedSource.meta?.icon && <span>{selectedSource.meta.icon}</span>}
                      <span className="truncate">{selectedSource.label}</span>
                      <span className="text-zinc-400">·</span>
                      <span>{new Date(selectedSource.date).toLocaleDateString()}</span>
                    </span>
                  )}
                </div>
                {pickerOpen ? (
                  <ChevronUp className="w-4 h-4 text-zinc-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-zinc-500" />
                )}
              </button>
              {pickerOpen && (
                <>
              <div className="flex items-center justify-end">
                <select
                  value={sourceTypeFilter}
                  onChange={(e) => setSourceTypeFilter(e.target.value)}
                  className="text-xs border rounded px-2 py-1 bg-white dark:bg-zinc-900 dark:border-zinc-700"
                >
                  <option value="">All</option>
                  <option value="EVENT">Events</option>
                  <option value="SCHEDULED_POST">Scheduled posts</option>
                  <option value="HOLIDAY">Holidays</option>
                </select>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {filteredSources.length === 0 ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    No calendar entries in the next 12 months.
                  </p>
                ) : (
                  filteredSources.map((s) => (
                    <button
                      key={`${s.type}-${s.id}`}
                      type="button"
                      onClick={() => setSelectedSource(s)}
                      className={`w-full text-left px-3 py-2 rounded text-sm border ${
                        selectedSource?.id === s.id && selectedSource?.type === s.type
                          ? "bg-blue-50 border-blue-500 dark:bg-blue-900/20"
                          : "bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 truncate">
                          {s.meta?.icon && <span>{s.meta.icon}</span>}
                          <span className="truncate">{s.label}</span>
                          <Badge variant="outline" className="text-xs">
                            {s.type === "SCHEDULED_POST" ? "post" : s.type.toLowerCase()}
                          </Badge>
                        </span>
                        <span className="text-xs text-zinc-500">
                          {new Date(s.date).toLocaleDateString()}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
                </>
              )}

              <div className="space-y-2">
                <Label className="text-xs">Offsets</Label>
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addOffset}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add offset
                </Button>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Negative = before the event (e.g. -7 = 7 days before). 0 = day of.
                </p>
              </div>
            </div>
          )}

          {triggerType === "RECURRING" && (
            <div className="space-y-2 border rounded-md p-3 bg-zinc-50 dark:bg-zinc-900/40">
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Frequency</Label>
                  <select
                    value={frequency}
                    onChange={(e) =>
                      setFrequency(e.target.value as "DAILY" | "WEEKLY" | "MONTHLY")
                    }
                    className="w-full border rounded px-2 py-1.5 text-sm bg-white dark:bg-zinc-900 dark:border-zinc-700"
                  >
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </div>
                {frequency === "WEEKLY" && (
                  <div className="space-y-1">
                    <Label className="text-xs">Day of week</Label>
                    <select
                      value={dayOfWeek}
                      onChange={(e) => setDayOfWeek(Number(e.target.value))}
                      className="w-full border rounded px-2 py-1.5 text-sm bg-white dark:bg-zinc-900 dark:border-zinc-700"
                    >
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
                        <option key={d} value={i}>{d}</option>
                      ))}
                    </select>
                  </div>
                )}
                {frequency === "MONTHLY" && (
                  <div className="space-y-1">
                    <Label className="text-xs">Day of month</Label>
                    <Input
                      type="number"
                      min={1}
                      max={28}
                      value={dayOfWeek}
                      onChange={(e) => setDayOfWeek(Number(e.target.value))}
                      className="text-sm"
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs">Time</Label>
                  <Input
                    type="time"
                    value={recurringTime}
                    onChange={(e) => setRecurringTime(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {triggerType === "ONE_OFF" && (
            <div className="space-y-2 border rounded-md p-3 bg-zinc-50 dark:bg-zinc-900/40">
              <Label className="text-xs">Run at</Label>
              <Input
                type="datetime-local"
                value={oneOffStart}
                onChange={(e) => setOneOffStart(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Content</Label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { v: "AI" as const, label: "AI generates each fire", icon: Sparkles, desc: "Uses the topic above to write fresh copy at post time" },
                  { v: "MANUAL" as const, label: "I'll write the copy", icon: Plus, desc: "Type the exact post text below" },
                ]
              ).map(({ v, label, icon: Icon, desc }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setContentMode(v)}
                  className={`text-left px-3 py-2 rounded-md border text-sm ${
                    contentMode === v
                      ? "bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                      : "bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center gap-2 font-medium">
                    <Icon className="w-4 h-4" />
                    {label}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{desc}</div>
                </button>
              ))}
            </div>
            {contentMode === "MANUAL" && (
              <Textarea
                value={manualCopy}
                onChange={(e) => setManualCopy(e.target.value)}
                placeholder="Type the exact caption to use for this post..."
                rows={3}
                className="mt-2"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>Platforms</Label>
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

          <div className="space-y-2">
            <Label>Media</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
                  <div className="font-medium">{m.label}</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {m.description}
                  </div>
                </button>
              ))}
            </div>
            {mediaMode === "UPLOAD" && (
              <Input
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="https://..."
              />
            )}
            {(mediaMode === "FOLDER" || mediaMode === "SPECIFIC_FILE") && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                You can attach a folder or file from the item editor after creation.
              </p>
            )}
          </div>

          {error && (
            <div className="text-sm text-rose-600 dark:text-rose-400">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t mt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <AISpinner className="w-4 h-4 mr-2" />}
              {saving ? "Creating..." : "Create item"}
            </Button>
          </div>
        </form>
    </FloatingPanel>
  );
}
