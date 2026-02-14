"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Globe,
  Plus,
  Eye,
  Edit3,
  Trash2,
  ExternalLink,
  Copy,
  MoreVertical,
  Loader2,
  Globe2,
  Rocket,
  GlobeLock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type PageStatus = "PUBLISHED" | "DRAFT";
type FilterTab = "all" | "PUBLISHED" | "DRAFT";

interface LandingPage {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  pageType: string;
  status: PageStatus;
  thumbnailUrl: string | null;
  views: number;
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

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
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

export default function LandingPagesPage() {
  const { toast } = useToast();

  const [pages, setPages] = useState<LandingPage[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchPages = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (activeFilter !== "all") params.set("status", activeFilter);
      params.set("page", "1");
      params.set("limit", "12");

      const response = await fetch(`/api/landing-pages?${params}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to fetch landing pages");
      }

      setPages(data.data.pages);
      setPagination(data.data.pagination);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load landing pages",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [activeFilter, toast]);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  const handleDelete = async (pageId: string, pageTitle: string) => {
    if (!window.confirm(`Are you sure you want to delete "${pageTitle}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingId(pageId);
    try {
      const response = await fetch(`/api/landing-pages/${pageId}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to delete page");
      }

      setPages((prev) => prev.filter((p) => p.id !== pageId));
      toast({ title: "Page deleted", description: `"${pageTitle}" has been deleted.` });
    } catch (err) {
      toast({
        title: "Delete failed",
        description: err instanceof Error ? err.message : "Failed to delete page",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleTogglePublish = async (page: LandingPage) => {
    setTogglingId(page.id);
    try {
      const response = await fetch(`/api/landing-pages/${page.id}/publish`, {
        method: "POST",
      });
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
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update publish status",
        variant: "destructive",
      });
    } finally {
      setTogglingId(null);
    }
  };

  const handleCopyUrl = async (slug: string) => {
    const url = `${window.location.origin}/p/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "URL copied", description: "Landing page URL copied to clipboard." });
    } catch {
      toast({
        title: "Copy failed",
        description: "Could not copy URL to clipboard.",
        variant: "destructive",
      });
    }
  };

  const filterTabs: { id: FilterTab; label: string; count?: number }[] = [
    { id: "all", label: "All" },
    { id: "PUBLISHED", label: "Published" },
    { id: "DRAFT", label: "Drafts" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 flex flex-col space-y-6 p-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center">
              <Globe className="w-6 h-6 text-white" />
            </div>
            Landing Pages
          </h1>
          <p className="text-muted-foreground mt-2">
            Create, manage, and publish AI-generated landing pages
          </p>
        </div>
        <Button size="lg" asChild>
          <Link href="/landing-pages/create">
            <Plus className="w-4 h-4 mr-2" />
            Create New
          </Link>
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 border-b">
        {filterTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeFilter === tab.id
                ? "border-brand-500 text-brand-500"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-4 w-4 rounded-full" />
                  </div>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <div className="flex items-center justify-between pt-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : pages.length === 0 ? (
        /* Empty State */
        <Card>
          <CardContent className="py-16 px-6">
            <div className="flex flex-col items-center text-center max-w-md mx-auto">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-500/10 to-purple-500/10 flex items-center justify-center mb-6">
                <Globe2 className="w-10 h-10 text-brand-500" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No landing pages yet</h3>
              <p className="text-muted-foreground mb-6">
                Create your first AI-powered landing page in minutes. Just describe what you need
                and let our AI build it for you.
              </p>
              <Button size="lg" asChild>
                <Link href="/landing-pages/create">
                  <Rocket className="w-4 h-4 mr-2" />
                  Create Your First Page
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Page Grid */
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {pages.map((page) => (
            <motion.div key={page.id} variants={cardVariants}>
              <Card className="group hover:shadow-md transition-all duration-200 hover:border-brand-500/30">
                <CardContent className="p-5">
                  <div className="space-y-3">
                    {/* Status Badge & More Menu */}
                    <div className="flex items-center justify-between">
                      <Badge
                        variant="secondary"
                        className={
                          page.status === "PUBLISHED"
                            ? "bg-green-500/10 text-green-600 hover:bg-green-500/20"
                            : "bg-gray-500/10 text-gray-500 hover:bg-gray-500/20"
                        }
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                            page.status === "PUBLISHED" ? "bg-green-500" : "bg-gray-400"
                          }`}
                        />
                        {page.status === "PUBLISHED" ? "Published" : "Draft"}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            {togglingId === page.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <MoreVertical className="w-4 h-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            onClick={() => handleTogglePublish(page)}
                            disabled={togglingId === page.id}
                          >
                            {page.status === "PUBLISHED" ? (
                              <>
                                <GlobeLock className="w-4 h-4 mr-2" />
                                Unpublish
                              </>
                            ) : (
                              <>
                                <Globe className="w-4 h-4 mr-2" />
                                Publish
                              </>
                            )}
                          </DropdownMenuItem>
                          {page.status === "PUBLISHED" && (
                            <DropdownMenuItem asChild>
                              <a
                                href={`/p/${page.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="w-4 h-4 mr-2" />
                                View Live Page
                              </a>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleCopyUrl(page.slug)}>
                            <Copy className="w-4 h-4 mr-2" />
                            Copy URL
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(page.id, page.title)}
                            disabled={deletingId === page.id}
                            className="text-red-600 focus:text-red-600 focus:bg-red-500/10"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Title */}
                    <div>
                      <Link
                        href={`/landing-pages/${page.id}/edit`}
                        className="font-semibold text-lg leading-tight hover:text-brand-500 transition-colors line-clamp-2"
                      >
                        {page.title}
                      </Link>
                      {page.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {page.description}
                        </p>
                      )}
                    </div>

                    {/* Page Type */}
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5" />
                        {pageTypeLabels[page.pageType] || page.pageType}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5" />
                        {page.views.toLocaleString()} {page.views === 1 ? "view" : "views"}
                      </span>
                    </div>

                    {/* Date */}
                    <p className="text-xs text-muted-foreground">
                      Created {formatRelativeDate(page.createdAt)}
                    </p>

                    {/* Divider */}
                    <div className="border-t pt-3" />

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="flex-1" asChild>
                        <Link href={`/landing-pages/${page.id}/edit`}>
                          <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                          Edit
                        </Link>
                      </Button>

                      {page.status === "PUBLISHED" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          asChild
                        >
                          <a
                            href={`/p/${page.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                            View Live
                          </a>
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleTogglePublish(page)}
                          disabled={togglingId === page.id}
                        >
                          {togglingId === page.id ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <Globe className="w-3.5 h-3.5 mr-1.5" />
                          )}
                          Publish
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Pagination info */}
      {pagination && pagination.total > 0 && (
        <div className="flex items-center justify-center text-sm text-muted-foreground">
          Showing {pages.length} of {pagination.total} landing page{pagination.total !== 1 ? "s" : ""}
        </div>
      )}
    </motion.div>
  );
}
