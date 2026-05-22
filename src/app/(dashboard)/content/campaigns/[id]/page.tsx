"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  Plus,
  CalendarDays,
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  Edit2,
  AlertCircle,
  Image as ImageIcon,
  FolderOpen,
  Trash2,
  Eye,
  EyeOff,
  RefreshCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/shared/page-loader";
import { AISpinner, AIGenerationLoader } from "@/components/shared/ai-generation-loader";
import { confirmDialog } from "@/components/shared/confirm-dialog";
import AddItemDialog from "./add-item-dialog";
import ImportStrategyDialog from "./import-strategy-dialog";
import BulkCalendarDialog from "./bulk-calendar-dialog";

interface Automation {
  id: string;
  name: string;
  description: string | null;
  triggerType: string;
  status: string;
  reviewStatus: string;
  enabled: boolean;
  startDate: string | null;
  endDate: string | null;
  calendarSourceLabel: string | null;
  calendarSourceType: string | null;
  calendarOffsets: string;
  platforms: string;
  mediaMode: string;
  topic: string | null;
  totalGenerated: number;
  lastTriggered: string | null;
  firstPostCreatedAt: string | null;
  _count?: { posts: number; logs: number };
}

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  defaultTone: string | null;
  defaultPlatforms: string;
  mediaFolderId: string | null;
  mediaFolder: { id: string; name: string; _count: { files: number } } | null;
  sourceStrategyId: string | null;
  automations: Automation[];
  strategyLinks: {
    strategyTaskId: string;
    strategyTask: {
      id: string;
      title: string;
      status: string;
      dueDate: string | null;
    } | null;
  }[];
}

function formatDate(value: string | null) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

const TRIGGER_LABEL: Record<string, string> = {
  RECURRING: "Recurring",
  CALENDAR_EVENT: "Calendar event",
  ONE_OFF: "One-off",
  AI_GENERATED: "AI generated",
};

const REVIEW_STYLES: Record<string, string> = {
  PENDING_REVIEW: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  APPROVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  SKIPPED: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  SCHEDULED: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  RUNNING: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  CANCELED: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  COMPLETED: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  FAILED: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

function parsePlatforms(value: string): string[] {
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [campaignBusy, setCampaignBusy] = useState<null | "cancel" | "delete">(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/content/campaigns/${id}`);
    const json = await res.json();
    if (json?.success) setCampaign(json.data.campaign);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Each per-automation action holds the busy state through the full request
  // AND the reload, so the AISpinner stays visible until the new state lands.
  const review = async (autoId: string, action: "approve" | "skip" | "revert") => {
    if (actioningId) return;
    setActioningId(autoId);
    setActionError(null);
    try {
      const res = await fetch(
        `/api/content/campaigns/${id}/automations/${autoId}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      const json = await res.json();
      if (!json?.success) {
        setActionError(json?.error?.message ?? "Review action failed");
        return;
      }
      await load();
    } finally {
      setActioningId(null);
    }
  };

  const cancelAutomation = async (autoId: string) => {
    const ok = await confirmDialog({
      title: "Cancel this automation?",
      description:
        "Future scheduled posts will be removed from the calendar. Past published posts are kept.",
      confirmText: "Cancel automation",
      variant: "destructive",
    });
    if (!ok) return;
    setActioningId(autoId);
    setActionError(null);
    try {
      const res = await fetch(
        `/api/content/campaigns/${id}/automations/${autoId}/cancel`,
        { method: "POST" },
      );
      const json = await res.json();
      if (!json?.success) {
        setActionError(json?.error?.message ?? "Cancel failed");
        return;
      }
      await load();
    } finally {
      setActioningId(null);
    }
  };

  const deleteAutomation = async (autoId: string) => {
    const ok = await confirmDialog({
      title: "Delete this draft?",
      description: "This will permanently remove the item.",
      confirmText: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    setActioningId(autoId);
    setActionError(null);
    try {
      const res = await fetch(
        `/api/content/campaigns/${id}/automations/${autoId}`,
        { method: "DELETE" },
      );
      const json = await res.json();
      if (!json?.success) {
        setActionError(json?.error?.message ?? "Delete failed");
        return;
      }
      await load();
    } finally {
      setActioningId(null);
    }
  };

  const cancelCampaign = async () => {
    const ok = await confirmDialog({
      title: "Cancel this campaign?",
      description:
        "All non-terminal automations and their future scheduled posts will be canceled. This cannot be undone.",
      confirmText: "Cancel campaign",
      variant: "destructive",
    });
    if (!ok) return;
    setCampaignBusy("cancel");
    setActionError(null);
    try {
      const res = await fetch(`/api/content/campaigns/${id}/cancel`, {
        method: "POST",
      });
      const json = await res.json();
      if (!json?.success) {
        setActionError(json?.error?.message ?? "Cancel campaign failed");
        return;
      }
      await load();
    } finally {
      setCampaignBusy(null);
    }
  };

  const deleteCampaign = async () => {
    const ok = await confirmDialog({
      title: "Delete this draft campaign?",
      description:
        "This will permanently remove the campaign and all its items.",
      confirmText: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    setCampaignBusy("delete");
    setActionError(null);
    try {
      const res = await fetch(`/api/content/campaigns/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json?.success) {
        router.push("/content/campaigns");
      } else {
        setActionError(json?.error?.message ?? "Cannot delete this campaign");
      }
    } finally {
      setCampaignBusy(null);
    }
  };

  if (loading || !campaign) return <PageLoader />;

  const pendingCount = campaign.automations.filter(
    (a) => a.reviewStatus === "PENDING_REVIEW" && a.status !== "CANCELED",
  ).length;
  const approvedCount = campaign.automations.filter(
    (a) => a.reviewStatus === "APPROVED" && a.status !== "CANCELED",
  ).length;
  const canceledCount = campaign.automations.filter(
    (a) => a.status === "CANCELED",
  ).length;

  const campaignCanceled = campaign.status === "CANCELED";
  const campaignDraft = campaign.status === "DRAFT";

  return (
    <div className="space-y-6">
      {campaignBusy === "cancel" && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur flex items-center justify-center">
          <AIGenerationLoader
            currentStep="Canceling campaign..."
            subtitle="Removing future scheduled posts from the calendar"
          />
        </div>
      )}
      {campaignBusy === "delete" && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur flex items-center justify-center">
          <AIGenerationLoader
            currentStep="Deleting draft campaign..."
            subtitle="Cleaning up"
          />
        </div>
      )}
      <div className="flex items-center gap-2">
        <Link
          href="/content/campaigns"
          className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1"
        >
          <ChevronLeft className="w-4 h-4" />
          Campaigns
        </Link>
      </div>

      {actionError && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300 flex items-center justify-between gap-3">
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-xs underline opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">{campaign.name}</h1>
            <Badge className={STATUS_STYLES[campaign.status] ?? STATUS_STYLES.DRAFT}>
              {campaign.status}
            </Badge>
          </div>
          {campaign.description && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-3xl">
              {campaign.description}
            </p>
          )}
          <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
            {formatDate(campaign.startDate) && (
              <span className="flex items-center gap-1">
                <CalendarDays className="w-3 h-3" />
                {formatDate(campaign.startDate)}
                {formatDate(campaign.endDate)
                  ? ` → ${formatDate(campaign.endDate)}`
                  : ""}
              </span>
            )}
            {campaign.mediaFolder && (
              <span className="flex items-center gap-1">
                <FolderOpen className="w-3 h-3" />
                {campaign.mediaFolder.name} ({campaign.mediaFolder._count.files}{" "}
                files)
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {!campaignCanceled && (
            <>
              <Button
                variant="outline"
                onClick={() => setShowImport(true)}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Import from strategy
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowBulk(true)}
              >
                <CalendarDays className="w-4 h-4 mr-2" />
                Bulk: calendar events
              </Button>
              <Button onClick={() => setShowAdd(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add item
              </Button>
            </>
          )}
          {campaignDraft && (
            <Button
              variant="outline"
              onClick={deleteCampaign}
              disabled={!!campaignBusy}
            >
              {campaignBusy === "delete" ? (
                <AISpinner className="w-4 h-4 mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete draft
            </Button>
          )}
          {!campaignCanceled && !campaignDraft && (
            <Button
              variant="destructive"
              onClick={cancelCampaign}
              disabled={!!campaignBusy}
            >
              {campaignBusy === "cancel" ? (
                <AISpinner className="w-4 h-4 mr-2" />
              ) : (
                <XCircle className="w-4 h-4 mr-2" />
              )}
              Cancel campaign
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Items</div>
            <div className="text-2xl font-semibold">
              {campaign.automations.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Pending review
            </div>
            <div className="text-2xl font-semibold text-amber-600 dark:text-amber-400">
              {pendingCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Approved
            </div>
            <div className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
              {approvedCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Canceled
            </div>
            <div className="text-2xl font-semibold text-rose-600 dark:text-rose-400">
              {canceledCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {campaign.automations.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <Sparkles className="w-12 h-12 mx-auto text-zinc-400 mb-3" />
            <h3 className="font-semibold mb-1">No items yet</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              Add a content item or import tasks from a marketing strategy.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={() => setShowImport(true)}>
                Import from strategy
              </Button>
              <Button variant="outline" onClick={() => setShowBulk(true)}>
                <CalendarDays className="w-4 h-4 mr-2" />
                Bulk: calendar events
              </Button>
              <Button onClick={() => setShowAdd(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add item
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {campaign.automations.map((a) => {
            const platforms = parsePlatforms(a.platforms);
            let offsets: { days: number; time: string }[] = [];
            try {
              offsets = JSON.parse(a.calendarOffsets ?? "[]");
            } catch {
              offsets = [];
            }
            const reviewClass = REVIEW_STYLES[a.reviewStatus] ?? REVIEW_STYLES.PENDING_REVIEW;
            const statusClass = STATUS_STYLES[a.status] ?? STATUS_STYLES.DRAFT;
            const isCanceled = a.status === "CANCELED";
            const inFlight = actioningId === a.id;

            return (
              <Card key={a.id} className={isCanceled ? "opacity-60" : ""}>
                <CardContent className="p-5">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold truncate">{a.name}</h3>
                        <Badge variant="outline">
                          {TRIGGER_LABEL[a.triggerType] ?? a.triggerType}
                        </Badge>
                        <Badge className={statusClass}>{a.status}</Badge>
                        <Badge className={reviewClass}>{a.reviewStatus.replace("_", " ")}</Badge>
                        {!a.enabled && (
                          <Badge variant="outline" className="text-zinc-500">
                            disabled
                          </Badge>
                        )}
                      </div>
                      {a.description && (
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
                          {a.description}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {a.calendarSourceLabel && (
                          <span className="flex items-center gap-1">
                            <CalendarDays className="w-3 h-3" />
                            {a.calendarSourceLabel}
                            {offsets.length > 0 &&
                              ` · ${offsets.length} offset${offsets.length > 1 ? "s" : ""}`}
                          </span>
                        )}
                        {platforms.length > 0 && (
                          <span className="flex items-center gap-1 capitalize">
                            {platforms.join(", ")}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" />
                          {a.mediaMode.replace(/_/g, " ").toLowerCase()}
                        </span>
                        {a.totalGenerated > 0 && (
                          <span>{a.totalGenerated} post(s) emitted</span>
                        )}
                        {a._count && a._count.posts > 0 && (
                          <span>{a._count.posts} post(s) tracked</span>
                        )}
                      </div>
                    </div>

                    {!isCanceled && (
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {a.reviewStatus === "PENDING_REVIEW" && (
                          <Button
                            size="sm"
                            onClick={() => review(a.id, "approve")}
                            disabled={inFlight}
                          >
                            {inFlight ? (
                              <AISpinner className="w-4 h-4 mr-1" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                            )}
                            Approve
                          </Button>
                        )}
                        {a.reviewStatus === "APPROVED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => review(a.id, "revert")}
                            disabled={inFlight}
                          >
                            {inFlight ? (
                              <AISpinner className="w-4 h-4 mr-1" />
                            ) : (
                              <RefreshCcw className="w-4 h-4 mr-1" />
                            )}
                            Unapprove
                          </Button>
                        )}
                        {a.reviewStatus !== "SKIPPED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => review(a.id, "skip")}
                            disabled={inFlight}
                          >
                            {inFlight ? (
                              <AISpinner className="w-4 h-4 mr-1" />
                            ) : (
                              <EyeOff className="w-4 h-4 mr-1" />
                            )}
                            Skip
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            router.push(
                              `/content/campaigns/${id}/items/${a.id}`,
                            )
                          }
                          disabled={inFlight}
                        >
                          <Edit2 className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                        {!a.firstPostCreatedAt ? (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteAutomation(a.id)}
                            disabled={inFlight}
                          >
                            {inFlight ? (
                              <AISpinner className="w-4 h-4" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => cancelAutomation(a.id)}
                            disabled={inFlight}
                          >
                            {inFlight ? (
                              <AISpinner className="w-4 h-4" />
                            ) : (
                              <XCircle className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {showAdd && (
        <AddItemDialog
          campaignId={id}
          defaultPlatforms={parsePlatforms(campaign.defaultPlatforms)}
          defaultTone={campaign.defaultTone}
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false);
            load();
          }}
        />
      )}

      {showImport && (
        <ImportStrategyDialog
          campaignId={id}
          onClose={() => setShowImport(false)}
          onImported={() => {
            setShowImport(false);
            load();
          }}
        />
      )}

      {showBulk && (
        <BulkCalendarDialog
          campaignId={id}
          defaultPlatforms={parsePlatforms(campaign.defaultPlatforms)}
          defaultTone={campaign.defaultTone}
          onClose={() => setShowBulk(false)}
          onCreated={() => {
            setShowBulk(false);
            load();
          }}
        />
      )}
    </div>
  );
}
