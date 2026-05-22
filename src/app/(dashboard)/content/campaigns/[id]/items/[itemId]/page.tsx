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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/shared/page-loader";
import { confirmDialog } from "@/components/shared/confirm-dialog";

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

function parseJsonSafe<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
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

  const save = async () => {
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
    const res = await fetch(
      `/api/content/campaigns/${id}/automations/${itemId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const json = await res.json();
    setSaving(false);
    if (!json?.success) {
      setError(json?.error?.message ?? "Save failed");
      return;
    }
    load();
  };

  const review = async (action: "approve" | "skip" | "revert") => {
    await fetch(
      `/api/content/campaigns/${id}/automations/${itemId}/review`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      },
    );
    load();
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
    await fetch(
      `/api/content/campaigns/${id}/automations/${itemId}/cancel`,
      { method: "POST" },
    );
    load();
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
    <div className="max-w-4xl mx-auto space-y-6">
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
              <Button onClick={() => review("approve")}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Approve
              </Button>
            )}
            {a.reviewStatus === "APPROVED" && (
              <Button variant="outline" onClick={() => review("revert")}>
                Unapprove
              </Button>
            )}
            <Button variant="destructive" onClick={cancel}>
              <XCircle className="w-4 h-4 mr-2" />
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

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
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
            <Label>
              Topic
              {locked && (
                <span className="ml-2 text-xs text-amber-600">locked</span>
              )}
            </Label>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={canceled || locked}
            />
          </div>

          <div className="space-y-2">
            <Label>
              Copy (pre-written caption — overrides AI)
              {locked && (
                <span className="ml-2 text-xs text-amber-600">locked</span>
              )}
            </Label>
            <Textarea
              value={copy}
              onChange={(e) => setCopy(e.target.value)}
              rows={4}
              disabled={canceled || locked}
            />
          </div>

          <div className="space-y-2">
            <Label>
              AI prompt (when copy is empty)
              {locked && (
                <span className="ml-2 text-xs text-amber-600">locked</span>
              )}
            </Label>
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
              <Label>Hashtags (comma-separated)</Label>
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

          <div className="space-y-2">
            <Label>
              Media mode
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
              <option value="FOLDER">From a folder (round-robin)</option>
              <option value="SPECIFIC_FILE">Specific file</option>
              <option value="UPLOAD">Direct URL</option>
              <option value="NONE">No media (text only)</option>
            </select>
            {mediaMode === "UPLOAD" && (
              <Input
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="https://..."
                disabled={canceled}
              />
            )}
            {(mediaMode === "FOLDER" || mediaMode === "SPECIFIC_FILE") && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Open the Media library to pick a folder/file. Field-level pickers
                are coming next iteration.
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
            <Button onClick={save} disabled={saving || canceled}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {a.logs && a.logs.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold mb-3 text-sm">Recent activity</h3>
            <div className="space-y-2 text-xs">
              {a.logs.slice(0, 10).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-1"
                >
                  <span className="flex items-center gap-2">
                    {log.status === "TRIGGERED" && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                    {log.status === "SKIPPED" && <ImageIcon className="w-3 h-3 text-amber-600" />}
                    {log.status === "FAILED" && <XCircle className="w-3 h-3 text-rose-600" />}
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
  );
}
