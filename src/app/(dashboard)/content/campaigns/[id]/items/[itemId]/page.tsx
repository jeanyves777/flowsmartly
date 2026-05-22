"use client";

import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Save,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Image as ImageIcon,
  CalendarDays,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/shared/page-loader";
import { AISpinner } from "@/components/shared/ai-generation-loader";
import { AILoaderOverlay } from "@/components/shared/ai-loader-overlay";
import { confirmDialog } from "@/components/shared/confirm-dialog";
import { MediaUploader } from "@/components/shared/media-uploader";

interface Automation {
  id: string;
  name: string;
  description: string | null;
  triggerType: string;
  status: string;
  reviewStatus: string;
  enabled: boolean;
  topic: string | null;
  aiPrompt: string | null;
  aiTone: string | null;
  copy: string | null;
  hashtags: string;
  platforms: string;
  mediaMode: string;
  mediaUrl: string | null;
  mediaFolderId: string | null;
  mediaFileId: string | null;
  calendarSourceType: string | null;
  calendarSourceId: string | null;
  calendarSourceLabel: string | null;
  calendarOffsets: string;
  startDate: string | null;
  endDate: string | null;
  aiMediaConfig: string | null;
  firstPostCreatedAt: string | null;
  totalGenerated: number;
  logs?: { id: string; status: string; reason: string | null; triggeredAt: string }[];
  _count?: { posts: number };
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

type SuggestField =
  | "item_name"
  | "item_topic"
  | "item_copy"
  | "item_hashtags"
  | "item_ai_prompt";

function parseJsonSafe<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function aiSuggest(
  field: SuggestField,
  campaignId: string,
  itemId: string,
  hint: string,
  overrides: Record<string, unknown> = {},
) {
  const res = await fetch("/api/content/campaigns/ai-suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ field, hint, campaignId, itemId, overrides }),
  });
  const json = await res.json();
  if (!json?.success) throw new Error(json?.error?.message ?? "AI suggestion failed");
  return json.data.value as string;
}

interface SuggestButtonProps {
  field: SuggestField;
  busy: boolean;
  onClick: () => void;
  disabled?: boolean;
}

function SuggestButton({ field: _field, busy, onClick, disabled }: SuggestButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={busy || disabled}
      className="h-7 text-xs"
    >
      {busy ? (
        <AISpinner className="w-3.5 h-3.5 mr-1" />
      ) : (
        <Sparkles className="w-3.5 h-3.5 mr-1" />
      )}
      Suggest
    </Button>
  );
}

export default function ItemEditorPage({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const { id, itemId } = use(params);
  const router = useRouter();
  const [a, setA] = useState<Automation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiHint, setAiHint] = useState("");
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [headerBusy, setHeaderBusy] = useState<"approve" | "revert" | "skip" | "cancel" | null>(null);
  const [mediaTier, setMediaTier] = useState<"standard" | "premium">("standard");
  const [mediaAppliesTo, setMediaAppliesTo] = useState<string>("all");
  const [mediaStyle, setMediaStyle] = useState<"realistic" | "3d">("realistic");
  const [mediaTemplate, setMediaTemplate] = useState<"footer_bar" | "minimal">("footer_bar");

  // editable fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [topic, setTopic] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiTone, setAiTone] = useState("");
  const [copy, setCopy] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [mediaMode, setMediaMode] = useState("AI_AT_POST_TIME");
  const [mediaUrl, setMediaUrl] = useState("");
  const [endDate, setEndDate] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/content/campaigns/${id}/automations/${itemId}`);
    const json = await res.json();
    if (json?.success) {
      const auto: Automation = json.data.automation;
      setA(auto);
      setName(auto.name);
      setDescription(auto.description ?? "");
      setTopic(auto.topic ?? "");
      setAiPrompt(auto.aiPrompt ?? "");
      setAiTone(auto.aiTone ?? "");
      setCopy(auto.copy ?? "");
      const tags = parseJsonSafe<string[]>(auto.hashtags, []);
      setHashtags(tags.join(", "));
      setPlatforms(parseJsonSafe<string[]>(auto.platforms, []));
      setMediaMode(auto.mediaMode);
      setMediaUrl(auto.mediaUrl ?? "");
      setEndDate(auto.endDate ? auto.endDate.slice(0, 10) : "");
      // Restore persisted tier + apply-to scope + style from aiMediaConfig
      const cfg = parseJsonSafe<{
        tier?: string;
        appliesTo?: string;
        style?: string;
        template?: string;
      }>(auto.aiMediaConfig, {});
      setMediaTier(cfg.tier === "premium" ? "premium" : "standard");
      setMediaAppliesTo(cfg.appliesTo ?? "all");
      setMediaStyle(cfg.style === "3d" ? "3d" : "realistic");
      setMediaTemplate(cfg.template === "minimal" ? "minimal" : "footer_bar");
    }
    setLoading(false);
  }, [id, itemId]);

  useEffect(() => {
    load();
  }, [load]);

  const togglePlatform = (p: string) => {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  };

  const runSuggest = async (field: SuggestField) => {
    setAiBusy(field);
    setError(null);
    try {
      const overrides: Record<string, unknown> = {
        itemName: name || undefined,
        itemTopic: topic || undefined,
        platforms: platforms.length ? platforms : undefined,
      };
      const value = await aiSuggest(field, id, itemId, aiHint, overrides);
      if (field === "item_name") setName(value);
      else if (field === "item_topic") setTopic(value);
      else if (field === "item_copy") setCopy(value);
      else if (field === "item_hashtags") setHashtags(value);
      else if (field === "item_ai_prompt") setAiPrompt(value);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI suggestion failed");
    } finally {
      setAiBusy(null);
    }
  };

  // Auto-persist the Premium/Standard tier on click so it sticks across reloads.
  // Stored inside the existing aiMediaConfig JSON column.
  const changeMediaTier = async (next: "standard" | "premium") => {
    if (next === mediaTier) return;
    setMediaTier(next); // optimistic
    try {
      const existing = parseJsonSafe<Record<string, unknown>>(
        a?.aiMediaConfig ?? null,
        {},
      );
      const merged = { ...existing, tier: next, type: existing.type ?? "image" };
      await fetch(
        `/api/content/campaigns/${id}/automations/${itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ aiMediaConfig: merged }),
        },
      );
      // Reflect new value in the local automation snapshot so subsequent
      // changes merge cleanly.
      if (a) {
        setA({ ...a, aiMediaConfig: JSON.stringify(merged) });
      }
    } catch {
      // Revert on failure
      setMediaTier(mediaTier);
    }
  };

  const preGenerateMedia = async () => {
    setAiBusy("pregen_media");
    setError(null);
    try {
      const res = await fetch(
        `/api/content/campaigns/${id}/automations/${itemId}/generate-media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tier: mediaTier,
            appliesTo: mediaAppliesTo,
            style: mediaStyle,
          }),
        },
      );
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error?.message ?? "Generation failed");
      // Refresh from server so mediaUrl + mediaMode reflect the new state
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pre-generation failed");
    } finally {
      setAiBusy(null);
    }
  };

  // Auto-persist template (footer_bar / minimal) on change, same pattern as tier.
  const changeMediaTemplate = async (next: "footer_bar" | "minimal") => {
    if (next === mediaTemplate) return;
    setMediaTemplate(next);
    try {
      const existing = parseJsonSafe<Record<string, unknown>>(
        a?.aiMediaConfig ?? null,
        {},
      );
      const merged = { ...existing, template: next, type: existing.type ?? "image" };
      await fetch(`/api/content/campaigns/${id}/automations/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiMediaConfig: merged }),
      });
      if (a) setA({ ...a, aiMediaConfig: JSON.stringify(merged) });
    } catch {
      setMediaTemplate(mediaTemplate);
    }
  };

  // Auto-persist style (realistic / 3d) on change, same pattern as tier.
  const changeMediaStyle = async (next: "realistic" | "3d") => {
    if (next === mediaStyle) return;
    setMediaStyle(next);
    try {
      const existing = parseJsonSafe<Record<string, unknown>>(
        a?.aiMediaConfig ?? null,
        {},
      );
      const merged = { ...existing, style: next, type: existing.type ?? "image" };
      await fetch(`/api/content/campaigns/${id}/automations/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiMediaConfig: merged }),
      });
      if (a) {
        setA({ ...a, aiMediaConfig: JSON.stringify(merged) });
      }
    } catch {
      setMediaStyle(mediaStyle);
    }
  };

  // Auto-persist apply-to scope on change, same pattern as tier.
  const changeAppliesTo = async (next: string) => {
    if (next === mediaAppliesTo) return;
    setMediaAppliesTo(next);
    try {
      const existing = parseJsonSafe<Record<string, unknown>>(
        a?.aiMediaConfig ?? null,
        {},
      );
      const merged = {
        ...existing,
        appliesTo: next,
        type: existing.type ?? "image",
      };
      await fetch(`/api/content/campaigns/${id}/automations/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiMediaConfig: merged }),
      });
      if (a) {
        setA({ ...a, aiMediaConfig: JSON.stringify(merged) });
      }
    } catch {
      setMediaAppliesTo(mediaAppliesTo);
    }
  };

  const runFullFill = async () => {
    if (!aiHint.trim() && !topic.trim() && !name.trim()) {
      setError("Type a quick idea above (or set a name/topic) so AI knows what to fill.");
      return;
    }
    setAiBusy("full");
    setError(null);
    try {
      const overrides: Record<string, unknown> = {
        itemName: name || undefined,
        itemTopic: topic || undefined,
        platforms: platforms.length ? platforms : undefined,
      };
      // Topic first (gives copy/hashtags better context), then the rest in parallel
      const newTopic = topic || (await aiSuggest("item_topic", id, itemId, aiHint, overrides));
      if (!topic) setTopic(newTopic);
      const enriched = { ...overrides, itemTopic: newTopic };
      const [newCopy, newHashtags, newPrompt] = await Promise.all([
        aiSuggest("item_copy", id, itemId, aiHint, enriched),
        aiSuggest("item_hashtags", id, itemId, aiHint, enriched),
        aiSuggest("item_ai_prompt", id, itemId, aiHint, enriched),
      ]);
      setCopy(newCopy);
      setHashtags(newHashtags);
      setAiPrompt(newPrompt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI fill failed");
    } finally {
      setAiBusy(null);
    }
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    const tags = hashtags
      .split(",")
      .map((s) => s.trim().replace(/^#/, ""))
      .filter(Boolean);
    const body = {
      name,
      description: description || null,
      topic: topic || null,
      aiPrompt: aiPrompt || null,
      aiTone: aiTone || null,
      copy: copy || null,
      hashtags: tags,
      platforms,
      mediaMode,
      mediaUrl: mediaMode === "UPLOAD" ? mediaUrl : null,
      endDate: endDate || null,
    };
    try {
      const res = await fetch(
        `/api/content/campaigns/${id}/automations/${itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const json = await res.json();
      if (!json?.success) {
        setError(json?.error?.message ?? "Save failed");
        return;
      }
      await load();
    } finally {
      setSaving(false);
    }
  };

  const review = async (action: "approve" | "skip" | "revert") => {
    if (headerBusy) return;
    setHeaderBusy(action);
    try {
      await fetch(
        `/api/content/campaigns/${id}/automations/${itemId}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      await load();
    } finally {
      setHeaderBusy(null);
    }
  };

  const cancel = async () => {
    const ok = await confirmDialog({
      title: "Cancel this automation?",
      description:
        "Future scheduled posts will be removed from the calendar. This cannot be undone.",
      confirmText: "Cancel automation",
      variant: "destructive",
    });
    if (!ok) return;
    setHeaderBusy("cancel");
    try {
      await fetch(
        `/api/content/campaigns/${id}/automations/${itemId}/cancel`,
        { method: "POST" },
      );
      await load();
    } finally {
      setHeaderBusy(null);
    }
  };

  if (loading || !a) return <PageLoader />;

  const locked = !!a.firstPostCreatedAt;
  const canceled = a.status === "CANCELED";
  let offsets: { days: number; time: string }[] = [];
  try {
    offsets = JSON.parse(a.calendarOffsets ?? "[]");
  } catch {
    offsets = [];
  }

  return (
    <div className="space-y-6">
      <AILoaderOverlay
        open={aiBusy === "pregen_media"}
        currentStep={
          mediaTier === "premium"
            ? "Generating premium-quality media..."
            : "Generating media..."
        }
        subtitle="Creating a brand-aware image — the real brand logo is composited on top"
      />
      <AILoaderOverlay
        open={aiBusy === "full"}
        currentStep="Filling this item with AI..."
        subtitle="Generating topic, caption, hashtags, and prompt"
      />
      <div className="flex items-center gap-2">
        <Link
          href={`/content/campaigns/${id}`}
          className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to campaign
        </Link>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Edit item</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline">{a.triggerType.replace("_", " ")}</Badge>
            <Badge>{a.status}</Badge>
            <Badge>{a.reviewStatus.replace("_", " ")}</Badge>
            {locked && (
              <Badge variant="outline" className="text-amber-600">
                content locked (posts scheduled)
              </Badge>
            )}
          </div>
        </div>
        {!canceled && (
          <div className="flex gap-2">
            {a.reviewStatus === "PENDING_REVIEW" && (
              <Button
                onClick={() => review("approve")}
                disabled={!!headerBusy}
              >
                {headerBusy === "approve" ? (
                  <AISpinner className="w-4 h-4 mr-2" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                )}
                Approve
              </Button>
            )}
            {a.reviewStatus === "APPROVED" && (
              <Button
                variant="outline"
                onClick={() => review("revert")}
                disabled={!!headerBusy}
              >
                {headerBusy === "revert" && (
                  <AISpinner className="w-4 h-4 mr-2" />
                )}
                Unapprove
              </Button>
            )}
            <Button
              variant="destructive"
              onClick={cancel}
              disabled={!!headerBusy}
            >
              {headerBusy === "cancel" ? (
                <AISpinner className="w-4 h-4 mr-2" />
              ) : (
                <XCircle className="w-4 h-4 mr-2" />
              )}
              Cancel
            </Button>
          </div>
        )}
      </div>

      {a.triggerType === "CALENDAR_EVENT" && a.calendarSourceLabel && (
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CalendarDays className="w-5 h-5 text-blue-600" />
            <div className="text-sm">
              <div className="font-medium">{a.calendarSourceLabel}</div>
              <div className="text-xs text-zinc-500">
                {a.calendarSourceType} · {offsets.length} offset(s)
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Name</Label>
                <SuggestButton
                  field="item_name"
                  busy={aiBusy === "item_name"}
                  onClick={() => runSuggest("item_name")}
                  disabled={canceled}
                />
              </div>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={canceled}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                disabled={canceled}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>
                  Topic
                  {locked && (
                    <span className="ml-2 text-xs text-amber-600">locked</span>
                  )}
                </Label>
                <SuggestButton
                  field="item_topic"
                  busy={aiBusy === "item_topic"}
                  onClick={() => runSuggest("item_topic")}
                  disabled={canceled || locked}
                />
              </div>
              <Textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                rows={2}
                disabled={canceled || locked}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>
                  Copy (pre-written caption — overrides AI)
                  {locked && (
                    <span className="ml-2 text-xs text-amber-600">locked</span>
                  )}
                </Label>
                <SuggestButton
                  field="item_copy"
                  busy={aiBusy === "item_copy"}
                  onClick={() => runSuggest("item_copy")}
                  disabled={canceled || locked}
                />
              </div>
              <Textarea
                value={copy}
                onChange={(e) => setCopy(e.target.value)}
                rows={4}
                disabled={canceled || locked}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>
                  AI prompt (when copy is empty)
                  {locked && (
                    <span className="ml-2 text-xs text-amber-600">locked</span>
                  )}
                </Label>
                <SuggestButton
                  field="item_ai_prompt"
                  busy={aiBusy === "item_ai_prompt"}
                  onClick={() => runSuggest("item_ai_prompt")}
                  disabled={canceled || locked}
                />
              </div>
              <Textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                rows={3}
                disabled={canceled || locked}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tone</Label>
                <Input
                  value={aiTone}
                  onChange={(e) => setAiTone(e.target.value)}
                  placeholder="friendly, professional..."
                  disabled={canceled}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Hashtags (comma-separated)</Label>
                  <SuggestButton
                    field="item_hashtags"
                    busy={aiBusy === "item_hashtags"}
                    onClick={() => runSuggest("item_hashtags")}
                    disabled={canceled}
                  />
                </div>
                <Input
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                  placeholder="summer, sale, promo"
                  disabled={canceled}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Platforms</Label>
              <div className="flex flex-wrap gap-2">
                {ALL_PLATFORMS.map((p) => (
                  <Badge
                    key={p}
                    onClick={() => !canceled && togglePlatform(p)}
                    className={`cursor-pointer capitalize ${
                      platforms.includes(p)
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    } ${canceled ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    {p}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label>
                Media
                {locked && (
                  <span className="ml-2 text-xs text-amber-600">locked</span>
                )}
              </Label>
              <select
                value={mediaMode}
                onChange={(e) => setMediaMode(e.target.value)}
                disabled={canceled || locked}
                className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-zinc-900 dark:border-zinc-700"
              >
                <option value="AI_AT_POST_TIME">AI generated at post time</option>
                <option value="UPLOAD">Upload / pick from library / pre-generated</option>
                <option value="FOLDER">From a folder (round-robin)</option>
                <option value="SPECIFIC_FILE">Specific file (advanced)</option>
                <option value="NONE">No media (text only)</option>
              </select>

              {mediaMode === "UPLOAD" && (
                <div className="space-y-2 rounded-md border bg-zinc-50 dark:bg-zinc-900/40 p-3">
                  <MediaUploader
                    value={mediaUrl ? [mediaUrl] : []}
                    onChange={(urls) => setMediaUrl(urls[0] ?? "")}
                    multiple={false}
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                    filterTypes={["image", "video"]}
                    libraryTitle="Pick media for this item"
                    variant="gallery"
                    disabled={canceled || locked}
                    description="Upload your own image / video or pick from your media library."
                  />
                </div>
              )}

              {mediaMode === "AI_AT_POST_TIME" && (
                <div className="rounded-md border bg-gradient-to-br from-blue-50 to-violet-50 dark:from-blue-950/30 dark:to-violet-950/30 border-blue-200 dark:border-blue-900 p-3 space-y-3">
                  <div>
                    <p className="text-sm font-medium">AI media at post time</p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-300">
                      Media is generated fresh just before the scheduler emits
                      the post. Pre-generate now to lock a specific image.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Label className="text-xs">Quality:</Label>
                    <div className="flex rounded-md border bg-white dark:bg-zinc-950 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => changeMediaTier("standard")}
                        disabled={canceled || locked || aiBusy === "pregen_media"}
                        className={`px-3 py-1.5 text-xs font-medium ${
                          mediaTier === "standard"
                            ? "bg-blue-600 text-white"
                            : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        }`}
                      >
                        Standard
                      </button>
                      <button
                        type="button"
                        onClick={() => changeMediaTier("premium")}
                        disabled={canceled || locked || aiBusy === "pregen_media"}
                        className={`px-3 py-1.5 text-xs font-medium border-l ${
                          mediaTier === "premium"
                            ? "bg-blue-600 text-white"
                            : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        }`}
                      >
                        Premium
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Label className="text-xs">Style:</Label>
                    <div className="flex rounded-md border bg-white dark:bg-zinc-950 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => changeMediaStyle("realistic")}
                        disabled={canceled || locked || aiBusy === "pregen_media"}
                        className={`px-3 py-1.5 text-xs font-medium ${
                          mediaStyle === "realistic"
                            ? "bg-blue-600 text-white"
                            : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        }`}
                      >
                        Realistic
                      </button>
                      <button
                        type="button"
                        onClick={() => changeMediaStyle("3d")}
                        disabled={canceled || locked || aiBusy === "pregen_media"}
                        className={`px-3 py-1.5 text-xs font-medium border-l ${
                          mediaStyle === "3d"
                            ? "bg-blue-600 text-white"
                            : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        }`}
                      >
                        3D
                      </button>
                    </div>
                  </div>
                  {a.triggerType === "CALENDAR_EVENT" && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Label className="text-xs">Apply to:</Label>
                      <select
                        value={mediaAppliesTo}
                        onChange={(e) => changeAppliesTo(e.target.value)}
                        disabled={canceled || locked || aiBusy === "pregen_media"}
                        className="text-xs border rounded px-2 py-1.5 bg-white dark:bg-zinc-950 dark:border-zinc-700"
                      >
                        <option value="all">All future years (reuse every year)</option>
                        <option value={String(new Date().getFullYear())}>
                          This year only ({new Date().getFullYear()})
                        </option>
                        <option value={String(new Date().getFullYear() + 1)}>
                          Next year only ({new Date().getFullYear() + 1})
                        </option>
                      </select>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 w-full">
                        Holidays repeat yearly. Pick &quot;this year only&quot; if
                        you want a different image generated next year.
                      </p>
                    </div>
                  )}
                  <div className="flex">
                    <Button
                      type="button"
                      onClick={preGenerateMedia}
                      disabled={canceled || locked || aiBusy === "pregen_media"}
                      className="bg-blue-600 hover:bg-blue-700 text-white ml-auto"
                    >
                      {aiBusy === "pregen_media" ? (
                        <AISpinner className="w-4 h-4 mr-2" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-2" />
                      )}
                      {aiBusy === "pregen_media"
                        ? "Generating..."
                        : "Pre-generate media now"}
                    </Button>
                  </div>
                </div>
              )}

              {(mediaMode === "FOLDER" || mediaMode === "SPECIFIC_FILE") && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Folder / specific-file pickers are coming next iteration. Use
                  Upload mode for now.
                </p>
              )}

              {mediaUrl && mediaMode !== "UPLOAD" && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Current stored URL: {mediaUrl}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>End date (optional)</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={canceled}
              />
            </div>

            {error && (
              <div className="text-sm text-rose-600 dark:text-rose-400 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button onClick={save} disabled={saving || canceled || !!aiBusy}>
                {saving ? (
                  <AISpinner className="w-4 h-4 mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {saving ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="bg-gradient-to-br from-blue-50 to-violet-50 dark:from-blue-950/30 dark:to-violet-950/30 border-blue-200 dark:border-blue-900">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-semibold">AI assist</h3>
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                Type a quick idea — AI fills topic, caption, hashtags, and prompt
                using your brand context.
              </p>
              <Textarea
                value={aiHint}
                onChange={(e) => setAiHint(e.target.value)}
                placeholder="e.g. Black Friday teaser — 50% off our top product, urgency angle"
                rows={4}
                className="bg-white dark:bg-zinc-950 border-blue-200 dark:border-blue-900"
              />
              <Button
                type="button"
                onClick={runFullFill}
                disabled={canceled || locked || !!aiBusy}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {aiBusy === "full" ? (
                  <AISpinner className="w-4 h-4 mr-2" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                {aiBusy === "full" ? "Filling..." : "Fill in the blanks"}
              </Button>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Or use the small Suggest button beside any field to fill only
                that one.
              </p>
            </CardContent>
          </Card>

          {a.logs && a.logs.length > 0 && (
            <Card>
              <CardContent className="p-5">
                <h3 className="font-semibold mb-3 text-sm">Recent activity</h3>
                <div className="space-y-2 text-xs">
                  {a.logs.slice(0, 10).map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-1"
                    >
                      <span className="flex items-center gap-2">
                        {log.status === "TRIGGERED" && (
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        )}
                        {log.status === "SKIPPED" && (
                          <ImageIcon className="w-3 h-3 text-amber-600" />
                        )}
                        {log.status === "FAILED" && (
                          <XCircle className="w-3 h-3 text-rose-600" />
                        )}
                        {log.status}
                        {log.reason && (
                          <span className="text-zinc-500">— {log.reason}</span>
                        )}
                      </span>
                      <span className="text-zinc-400">
                        {new Date(log.triggeredAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
