"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  Globe2,
  GlobeLock,
  LayoutTemplate,
  MoreVertical,
  MousePointerClick,
  Plus,
  Rocket,
  Search,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AISpinner } from "@/components/shared/ai-generation-loader";
import { confirmDialog } from "@/components/shared/confirm-dialog";

type PageStatus = "PUBLISHED" | "DRAFT";
type FilterTab = "all" | PageStatus;

interface LandingPage {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  pageType: string;
  status: PageStatus;
  thumbnailUrl: string | null;
  views: number;
  submissions: number;
  conversionRate: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface LandingPageStats {
  total: number;
  published: number;
  draft: number;
  totalViews: number;
  totalSubmissions: number;
  averageConversionRate: number;
  recentlyPublished: number;
}

interface WorkflowStep {
  id: string;
  label: string;
  description: string;
  completed: boolean;
}

const pageTypeLabels: Record<string, string> = {
  product: "Product Launch",
  service: "Service",
  event: "Event",
  webinar: "Webinar",
  ebook: "E-book",
  newsletter: "Newsletter",
  waitlist: "Waitlist",
  coming_soon: "Coming Soon",
  portfolio: "Portfolio",
  app: "App Download",
};

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function getPublicUrl(slug: string): string {
  if (typeof window === "undefined") return `/p/${slug}`;
  return `${window.location.origin}/p/${slug}`;
}

export default function LandingPagesPage() {
  const { toast } = useToast();

  const [pages, setPages] = useState<LandingPage[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [stats, setStats] = useState<LandingPageStats | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowStep[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchPages = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (activeFilter !== "all") params.set("status", activeFilter);
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      params.set("page", "1");
      params.set("limit", "24");

      const response = await fetch(`/api/landing-pages?${params}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to fetch landing pages");
      }

      setPages(data.data.pages || []);
      setPagination(data.data.pagination || null);
      setStats(data.data.stats || null);
      setWorkflow(data.data.workflow || []);
    } catch (err) {
      toast({
        title: "Landing pages could not load",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [activeFilter, searchQuery, toast]);

  useEffect(() => {
    const timer = window.setTimeout(fetchPages, searchQuery ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [fetchPages, searchQuery]);

  const handleDelete = async (pageId: string, pageTitle: string) => {
    const ok = await confirmDialog({
      title: `Delete "${pageTitle}"?`,
      description: "This removes the page and its public URL. This cannot be undone.",
      confirmText: "Delete page",
      variant: "destructive",
    });
    if (!ok) return;

    setDeletingId(pageId);
    try {
      const response = await fetch(`/api/landing-pages/${pageId}`, { method: "DELETE" });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to delete page");
      }

      setPages((prev) => prev.filter((p) => p.id !== pageId));
      toast({ title: "Page deleted", description: `"${pageTitle}" has been deleted.` });
      fetchPages();
    } catch (err) {
      toast({
        title: "Delete failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleTogglePublish = async (page: LandingPage) => {
    setTogglingId(page.id);
    try {
      const response = await fetch(`/api/landing-pages/${page.id}/publish`, { method: "POST" });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to update page");
      }

      const updatedPage = data.data.page;
      setPages((prev) =>
        prev.map((p) =>
          p.id === page.id
            ? { ...p, status: updatedPage.status, publishedAt: updatedPage.publishedAt }
            : p
        )
      );

      toast({
        title: updatedPage.status === "PUBLISHED" ? "Page published" : "Page unpublished",
        description:
          updatedPage.status === "PUBLISHED"
            ? `"${page.title}" is now live.`
            : `"${page.title}" has been unpublished.`,
      });
      fetchPages();
    } catch (err) {
      toast({
        title: "Publish update failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setTogglingId(null);
    }
  };

  const handleCopyUrl = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(getPublicUrl(slug));
      toast({ title: "URL copied", description: "Landing page URL copied to clipboard." });
    } catch {
      toast({
        title: "Copy failed",
        description: "Could not copy URL to clipboard.",
        variant: "destructive",
      });
    }
  };

  const filterTabs = useMemo(
    () => [
      { id: "all" as FilterTab, label: "All", count: stats?.total ?? 0 },
      { id: "PUBLISHED" as FilterTab, label: "Published", count: stats?.published ?? 0 },
      { id: "DRAFT" as FilterTab, label: "Drafts", count: stats?.draft ?? 0 },
    ],
    [stats]
  );

  const topPages = useMemo(
    () => [...pages].sort((a, b) => b.views - a.views).slice(0, 4),
    [pages]
  );

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl">
          <div className="mb-1.5 hidden items-center gap-2 rounded-full border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground xl:inline-flex">
            <SparkLineIcon />
            AI landing page builder
          </div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Landing Pages</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={fetchPages} disabled={isLoading} className="gap-1.5">
            {isLoading ? <AISpinner className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button asChild size="sm" className="gap-1.5">
            <Link href="/landing-pages/create">
              <Plus className="h-4 w-4" />
              <span>Create</span>
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={LayoutTemplate} label="Total pages" value={formatNumber(stats?.total ?? 0)} detail={`${formatNumber(stats?.published ?? 0)} published`} />
        <MetricCard icon={Eye} label="Total views" value={formatNumber(stats?.totalViews ?? 0)} detail="All landing pages" />
        <MetricCard icon={ClipboardCheck} label="Leads captured" value={formatNumber(stats?.totalSubmissions ?? 0)} detail={`${stats?.averageConversionRate ?? 0}% average conversion`} />
        <MetricCard icon={TrendingUp} label="Recent launches" value={formatNumber(stats?.recentlyPublished ?? 0)} detail="Published in 30 days" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          <div className="rounded-lg border bg-card p-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-lg">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search pages"
                  className="h-9 pl-9"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {filterTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveFilter(tab.id)}
                    className={cn(
                      "inline-flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors",
                      activeFilter === tab.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab.label}
                    <span className={cn(
                      "rounded-full px-1.5 py-0.5 text-[11px]",
                      activeFilter === tab.id ? "bg-primary-foreground/20" : "bg-muted"
                    )}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="space-y-4 p-5">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-7 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : pages.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center px-4 py-10 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Globe2 className="h-6 w-6" />
                </div>
                <h2 className="text-lg font-semibold">
                  {searchQuery || activeFilter !== "all" ? "No matching pages" : "No landing pages yet"}
                </h2>
                <Button asChild className="mt-4 gap-2">
                  <Link href="/landing-pages/create">
                    <Rocket className="h-4 w-4" />
                    Create Page
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {pages.map((page) => (
                <LandingPageCard
                  key={page.id}
                  page={page}
                  isToggling={togglingId === page.id}
                  isDeleting={deletingId === page.id}
                  onTogglePublish={handleTogglePublish}
                  onDelete={handleDelete}
                  onCopy={handleCopyUrl}
                />
              ))}
            </div>
          )}

          {pagination && pagination.total > 0 && (
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Showing {formatNumber(pages.length)} of {formatNumber(pagination.total)} page{pagination.total === 1 ? "" : "s"}.
            </div>
          )}
        </div>

        <aside className="space-y-3">
          <Card>
            <CardContent className="space-y-3 p-4">
              <div>
                <h2 className="font-semibold">Launch steps</h2>
              </div>
              <div className="space-y-2">
                {workflow.map((step, index) => (
                  <div key={step.id} className="flex items-center gap-2.5 rounded-lg border bg-background p-2.5">
                    <div className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      step.completed ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
                    )}>
                      {step.completed ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                    </div>
                    <p className="text-sm font-medium">{step.label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <MousePointerClick className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="font-semibold">Next best action</h2>
                </div>
              </div>
              {stats?.draft ? (
                <Button variant="outline" className="w-full justify-between" onClick={() => setActiveFilter("DRAFT")}>
                  Review drafts
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button asChild variant="outline" className="w-full justify-between">
                  <Link href="/landing-pages/create">
                    Start a new page
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-4">
              <div>
                <h2 className="font-semibold">Top pages</h2>
              </div>
              {topPages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data yet.</p>
              ) : (
                <div className="space-y-2">
                  {topPages.map((page) => (
                    <Link
                      key={page.id}
                      href={`/landing-pages/${page.id}/edit`}
                      className="block rounded-lg border bg-background p-2.5 transition-colors hover:border-primary/50"
                    >
                      <p className="truncate text-sm font-medium">{page.title}</p>
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{formatNumber(page.views)} views</span>
                        <span>{page.conversionRate}% conv.</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-3 sm:p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground sm:text-sm">{label}</p>
          <p className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{value}</p>
          <p className="hidden truncate text-xs text-muted-foreground 2xl:block">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function LandingPageCard({
  page,
  isToggling,
  isDeleting,
  onTogglePublish,
  onDelete,
  onCopy,
}: {
  page: LandingPage;
  isToggling: boolean;
  isDeleting: boolean;
  onTogglePublish: (page: LandingPage) => void;
  onDelete: (pageId: string, pageTitle: string) => void;
  onCopy: (slug: string) => void;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="h-full">
        <CardContent className="flex h-full flex-col p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <Badge
              variant="secondary"
              className={cn(
                "gap-1.5",
                page.status === "PUBLISHED"
                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                  : "bg-muted text-muted-foreground hover:bg-muted"
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", page.status === "PUBLISHED" ? "bg-emerald-500" : "bg-muted-foreground")} />
              {page.status === "PUBLISHED" ? "Published" : "Draft"}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  {isToggling ? <AISpinner className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => onTogglePublish(page)} disabled={isToggling}>
                  {page.status === "PUBLISHED" ? (
                    <>
                      <GlobeLock className="mr-2 h-4 w-4" />
                      Unpublish
                    </>
                  ) : (
                    <>
                      <Globe className="mr-2 h-4 w-4" />
                      Publish
                    </>
                  )}
                </DropdownMenuItem>
                {page.status === "PUBLISHED" && (
                  <DropdownMenuItem asChild>
                    <a href={`/p/${page.slug}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View live page
                    </a>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onCopy(page.slug)}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy URL
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(page.id, page.title)}
                  disabled={isDeleting}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Link href={`/landing-pages/${page.id}/edit`} className="line-clamp-2 text-base font-semibold leading-tight hover:text-primary">
            {page.title}
          </Link>
          <p className="mt-1.5 line-clamp-1 text-sm text-muted-foreground">
            {page.description || "No description yet."}
          </p>

          <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-2.5 text-center text-xs">
            <div>
              <p className="font-semibold">{formatNumber(page.views)}</p>
              <p className="text-muted-foreground">Views</p>
            </div>
            <div>
              <p className="font-semibold">{formatNumber(page.submissions)}</p>
              <p className="text-muted-foreground">Leads</p>
            </div>
            <div>
              <p className="font-semibold">{page.conversionRate}%</p>
              <p className="text-muted-foreground">Conv.</p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
              <FileText className="h-3.5 w-3.5" />
              {pageTypeLabels[page.pageType] || page.pageType}
            </span>
            <span>{formatRelativeDate(page.updatedAt)}</span>
          </div>

          <div className="mt-auto flex gap-2 pt-4">
            <Button variant="outline" size="sm" className="flex-1 gap-1.5" asChild>
              <Link href={`/landing-pages/${page.id}/edit`}>
                <Edit3 className="h-3.5 w-3.5" />
                Edit
              </Link>
            </Button>
            {page.status === "PUBLISHED" ? (
              <Button variant="outline" size="sm" className="flex-1 gap-1.5" asChild>
                <a href={`/p/${page.slug}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Live
                </a>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => onTogglePublish(page)}
                disabled={isToggling}
              >
                {isToggling ? <AISpinner className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
                Publish
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function SparkLineIcon() {
  return (
    <span className="inline-flex h-2.5 w-8 items-end gap-0.5">
      <span className="h-1.5 w-1 rounded-full bg-primary/40" />
      <span className="h-2 w-1 rounded-full bg-primary/60" />
      <span className="h-1 w-1 rounded-full bg-primary/40" />
      <span className="h-2.5 w-1 rounded-full bg-primary" />
    </span>
  );
}
