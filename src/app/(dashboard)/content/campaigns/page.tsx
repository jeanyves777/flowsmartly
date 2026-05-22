"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Megaphone,
  CalendarDays,
  Users,
  Pause,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageLoader } from "@/components/shared/page-loader";

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { automations: number };
}

const STATUS_STYLES: Record<string, { className: string; icon: typeof Clock }> = {
  DRAFT: { className: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300", icon: Clock },
  ACTIVE: { className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", icon: CheckCircle2 },
  PAUSED: { className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", icon: Pause },
  CANCELED: { className: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300", icon: XCircle },
  COMPLETED: { className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", icon: CheckCircle2 },
};

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

export default function CampaignsListPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/content/campaigns?${params.toString()}`);
    const json = await res.json();
    if (json?.success) setCampaigns(json.data.campaigns);
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && campaigns.length === 0) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Content Campaigns</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Plan, schedule, and review social content. Pull in calendar events,
            holidays, or strategy tasks.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => router.push("/content/campaigns/review")} variant="outline">
            <Sparkles className="w-4 h-4 mr-2" />
            Review queue
          </Button>
          <Button onClick={() => router.push("/content/campaigns/new")}>
            <Plus className="w-4 h-4 mr-2" />
            New campaign
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <Input
            className="pl-9"
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm bg-white dark:bg-zinc-900 dark:border-zinc-700"
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="ACTIVE">Active</option>
          <option value="PAUSED">Paused</option>
          <option value="CANCELED">Canceled</option>
          <option value="COMPLETED">Completed</option>
        </select>
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <Megaphone className="w-12 h-12 mx-auto text-zinc-400 mb-3" />
            <h3 className="font-semibold mb-1">No campaigns yet</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              Create your first content campaign to start scheduling social
              posts.
            </p>
            <Button onClick={() => router.push("/content/campaigns/new")}>
              <Plus className="w-4 h-4 mr-2" />
              New campaign
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {campaigns.map((campaign) => {
            const style = STATUS_STYLES[campaign.status] ?? STATUS_STYLES.DRAFT;
            const StatusIcon = style.icon;
            return (
              <Link
                key={campaign.id}
                href={`/content/campaigns/${campaign.id}`}
                className="block group"
              >
                <Card className="h-full transition-all group-hover:shadow-md group-hover:border-blue-300 dark:group-hover:border-blue-700">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold leading-tight group-hover:text-blue-700 dark:group-hover:text-blue-400">
                        {campaign.name}
                      </h3>
                      <Badge className={style.className}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {campaign.status}
                      </Badge>
                    </div>
                    {campaign.description && (
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
                        {campaign.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {campaign._count?.automations ?? 0} items
                      </span>
                      {formatDate(campaign.startDate) && (
                        <span className="flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          {formatDate(campaign.startDate)}
                          {formatDate(campaign.endDate)
                            ? ` → ${formatDate(campaign.endDate)}`
                            : ""}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
