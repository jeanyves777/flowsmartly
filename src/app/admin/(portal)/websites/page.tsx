"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Globe,
  Search,
  RefreshCw,
  ExternalLink,
  Eye,
  Hammer,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { confirmDialog } from "@/components/shared/confirm-dialog";

interface Website {
  id: string;
  name: string;
  slug: string;
  customDomain: string | null;
  status: string;
  buildStatus: string;
  lastBuildAt: string | null;
  lastBuildError: string | null;
  generatorVersion: string;
  pageCount: number;
  totalViews: number;
  publishedAt: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string };
  _count: { pages: number; domains: number; formSubmissions: number };
}

interface Stats {
  total: number;
  published: number;
  errors: number;
  customDomains: number;
  totalViews: number;
}

export default function AdminWebsitesPage() {
  const [websites, setWebsites] = useState<Website[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [buildFilter, setBuildFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [viewingSite, setViewingSite] = useState<Website | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "20",
      });
      if (searchQuery) params.set("search", searchQuery);
      if (statusFilter) params.set("status", statusFilter);
      if (buildFilter) params.set("buildStatus", buildFilter);

      const res = await fetch(`/api/admin/websites?${params}`);
      const data = await res.json();
      if (data.success) {
        setWebsites(data.data.websites);
        setStats(data.data.stats);
        setTotalPages(data.data.pagination.totalPages);
      }
    } catch (error) {
      console.error("Failed to fetch websites:", error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, statusFilter, buildFilter, currentPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRebuild = async (siteId: string) => {
    setActionLoading(siteId);
    try {
      const res = await fetch(`/api/websites/${siteId}/rebuild`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        fetchData();
      }
    } catch (error) {
      console.error("Rebuild failed:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (siteId: string) => {
    const ok = await confirmDialog({
      title: "Delete this website?",
      confirmText: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    setActionLoading(siteId);
    try {
      const res = await fetch("/api/admin/websites", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: siteId }),
      });
      const data = await res.json();
      if (data.success) fetchData();
    } catch (error) {
      console.error("Delete failed:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PUBLISHED":
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20"><CheckCircle2 className="w-3 h-3 mr-1" />Published</Badge>;
      case "DRAFT":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Draft</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getBuildBadge = (buildStatus: string) => {
    switch (buildStatus) {
      case "built":
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Built</Badge>;
      case "building":
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Building</Badge>;
      case "error":
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20"><XCircle className="w-3 h-3 mr-1" />Error</Badge>;
      default:
        return <Badge variant="outline">{buildStatus}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="w-6 h-6" />
            Website Management
          </h1>
          <p className="text-muted-foreground mt-1">View, manage, and rebuild user websites</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchData()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Sites</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Published</p>
              <p className="text-2xl font-bold text-green-500">{stats.published}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Build Errors</p>
              <p className="text-2xl font-bold text-red-500">{stats.errors}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Custom Domains</p>
              <p className="text-2xl font-bold text-blue-500">{stats.customDomains}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Views</p>
              <p className="text-2xl font-bold">{stats.totalViews.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, slug, or domain..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              />
            </div>
            <select
              className="px-3 py-2 border rounded-lg bg-background text-sm"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            >
              <option value="">All Status</option>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
            </select>
            <select
              className="px-3 py-2 border rounded-lg bg-background text-sm"
              value={buildFilter}
              onChange={(e) => { setBuildFilter(e.target.value); setCurrentPage(1); }}
            >
              <option value="">All Builds</option>
              <option value="built">Built</option>
              <option value="building">Building</option>
              <option value="error">Error</option>
              <option value="idle">Idle</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : websites.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No websites found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Website</th>
                    <th className="text-left p-3 font-medium">Owner</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Build</th>
                    <th className="text-left p-3 font-medium">Pages</th>
                    <th className="text-left p-3 font-medium">Views</th>
                    <th className="text-left p-3 font-medium">Created</th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {websites.map((site) => (
                    <tr key={site.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="p-3">
                        <div>
                          <p className="font-medium">{site.name}</p>
                          <p className="text-xs text-muted-foreground">/{site.slug}</p>
                          {site.customDomain && (
                            <p className="text-xs text-blue-500 flex items-center gap-1">
                              <Link2 className="w-3 h-3" />{site.customDomain}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <p className="font-medium text-xs">{site.user.name}</p>
                        <p className="text-xs text-muted-foreground">{site.user.email}</p>
                      </td>
                      <td className="p-3">{getStatusBadge(site.status)}</td>
                      <td className="p-3">
                        {getBuildBadge(site.buildStatus)}
                        {site.lastBuildError && (
                          <p className="text-xs text-red-400 mt-1 max-w-[200px] truncate" title={site.lastBuildError}>
                            {site.lastBuildError}
                          </p>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{site._count.pages}</span>
                      </td>
                      <td className="p-3">
                        <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{site.totalViews.toLocaleString()}</span>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {new Date(site.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setViewingSite(site)}
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => window.open(`/websites/${site.id}/edit`, "_blank")}
                            title="Edit website"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-blue-500"
                            onClick={() => handleRebuild(site.id)}
                            disabled={actionLoading === site.id}
                            title="Rebuild"
                          >
                            <Hammer className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500"
                            onClick={() => handleDelete(site.id)}
                            disabled={actionLoading === site.id}
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Detail Modal */}
      {viewingSite && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setViewingSite(null)}>
          <div className="bg-card border rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{viewingSite.name}</h2>
              <Button variant="ghost" size="sm" onClick={() => setViewingSite(null)}>Close</Button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Slug:</span> <span className="font-medium">/{viewingSite.slug}</span></div>
              <div><span className="text-muted-foreground">Version:</span> <span className="font-medium">{viewingSite.generatorVersion}</span></div>
              <div><span className="text-muted-foreground">Status:</span> {getStatusBadge(viewingSite.status)}</div>
              <div><span className="text-muted-foreground">Build:</span> {getBuildBadge(viewingSite.buildStatus)}</div>
              <div><span className="text-muted-foreground">Pages:</span> <span className="font-medium">{viewingSite._count.pages}</span></div>
              <div><span className="text-muted-foreground">Domains:</span> <span className="font-medium">{viewingSite._count.domains}</span></div>
              <div><span className="text-muted-foreground">Views:</span> <span className="font-medium">{viewingSite.totalViews.toLocaleString()}</span></div>
              <div><span className="text-muted-foreground">Submissions:</span> <span className="font-medium">{viewingSite._count.formSubmissions}</span></div>
              <div className="col-span-2"><span className="text-muted-foreground">Owner:</span> <span className="font-medium">{viewingSite.user.name} ({viewingSite.user.email})</span></div>
              {viewingSite.customDomain && (
                <div className="col-span-2"><span className="text-muted-foreground">Custom Domain:</span> <span className="font-medium text-blue-500">{viewingSite.customDomain}</span></div>
              )}
              {viewingSite.lastBuildError && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Build Error:</span>
                  <p className="text-red-400 text-xs mt-1 bg-red-500/5 p-2 rounded">{viewingSite.lastBuildError}</p>
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={() => window.open(`/websites/${viewingSite.id}/edit`, "_blank")}>
                <ExternalLink className="w-4 h-4 mr-2" />Edit Site
              </Button>
              <Button size="sm" variant="outline" onClick={() => { handleRebuild(viewingSite.id); setViewingSite(null); }}>
                <Hammer className="w-4 h-4 mr-2" />Rebuild
              </Button>
              <Button size="sm" variant="outline" onClick={() => window.open(`/sites/${viewingSite.slug}`, "_blank")}>
                <Eye className="w-4 h-4 mr-2" />Preview
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
