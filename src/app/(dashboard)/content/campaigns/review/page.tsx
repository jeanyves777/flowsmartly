"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  CheckCircle2,
  EyeOff,
  CalendarDays,
  Sparkles,
  Edit2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/shared/page-loader";
import { AISpinner } from "@/components/shared/ai-generation-loader";

interface PendingItem {
  id: string;
  name: string;
  triggerType: string;
  calendarSourceLabel: string | null;
  campaign: { id: string; name: string };
  topic: string | null;
  platforms: string;
  createdAt: string;
}

function parsePlatforms(value: string): string[] {
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

export default function ReviewQueuePage() {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    // Fetch all campaigns, then expand to find pending items.
    const res = await fetch("/api/content/campaigns");
    const json = await res.json();
    if (!json?.success) {
      setLoading(false);
      return;
    }
    const campaigns = json.data.campaigns as { id: string; name: string }[];

    const pending: PendingItem[] = [];
    for (const c of campaigns) {
      const detailRes = await fetch(`/api/content/campaigns/${c.id}`);
      const detailJson = await detailRes.json();
      if (!detailJson?.success) continue;
      const automations = detailJson.data.campaign.automations as Array<{
        id: string;
        name: string;
        triggerType: string;
        reviewStatus: string;
        status: string;
        calendarSourceLabel: string | null;
        topic: string | null;
        platforms: string;
        createdAt: string;
      }>;
      for (const a of automations) {
        if (a.reviewStatus === "PENDING_REVIEW" && a.status !== "CANCELED") {
          pending.push({
            id: a.id,
            name: a.name,
            triggerType: a.triggerType,
            calendarSourceLabel: a.calendarSourceLabel,
            campaign: { id: c.id, name: c.name },
            topic: a.topic,
            platforms: a.platforms,
            createdAt: a.createdAt,
          });
        }
      }
    }

    pending.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    setItems(pending);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const action = async (
    item: PendingItem,
    type: "approve" | "skip",
  ) => {
    setActioning(item.id);
    await fetch(
      `/api/content/campaigns/${item.campaign.id}/automations/${item.id}/review`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: type }),
      },
    );
    setActioning(null);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  };

  if (loading) return <PageLoader />;

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
        <h1 className="text-2xl font-bold tracking-tight">Review queue</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Items waiting for your approval. Approved items go to the scheduler;
          skipped items are paused.
        </p>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <Sparkles className="w-12 h-12 mx-auto text-zinc-400 mb-3" />
            <h3 className="font-semibold mb-1">All caught up</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No items waiting for review.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const platforms = parsePlatforms(item.platforms);
            const inFlight = actioning === item.id;
            return (
              <Card key={item.id}>
                <CardContent className="p-5">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div className="flex-1 space-y-2 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">{item.name}</h3>
                        <Badge variant="outline">
                          {item.triggerType.replace("_", " ")}
                        </Badge>
                      </div>
                      <div className="text-xs text-zinc-500 flex items-center gap-3 flex-wrap">
                        <Link
                          href={`/content/campaigns/${item.campaign.id}`}
                          className="hover:underline"
                        >
                          {item.campaign.name}
                        </Link>
                        {item.calendarSourceLabel && (
                          <span className="flex items-center gap-1">
                            <CalendarDays className="w-3 h-3" />
                            {item.calendarSourceLabel}
                          </span>
                        )}
                        {platforms.length > 0 && (
                          <span className="capitalize">{platforms.join(", ")}</span>
                        )}
                      </div>
                      {item.topic && (
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
                          {item.topic}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => action(item, "approve")}
                        disabled={inFlight}
                      >
                        {inFlight ? (
                          <AISpinner className="w-4 h-4 mr-1" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                        )}
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => action(item, "skip")}
                        disabled={inFlight}
                      >
                        {inFlight ? (
                          <AISpinner className="w-4 h-4 mr-1" />
                        ) : (
                          <EyeOff className="w-4 h-4 mr-1" />
                        )}
                        Skip
                      </Button>
                      <Link
                        href={`/content/campaigns/${item.campaign.id}/items/${item.id}`}
                      >
                        <Button size="sm" variant="outline" disabled={inFlight}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
