"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  ExternalLink,
  CheckCircle2,
  Clock,
  MousePointerClick,
  Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface LandingPageItem {
  id: string;
  title: string;
  slug: string;
  pageType: string;
  status: string;
  views: number;
  publishedAt: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string };
  submissionCount: number;
}

interface Stats { total: number; published: number; totalViews: number; totalSubmissions: number; }

export default function AdminLandingPagesPage() {
  const [pages, setPages] = useState<LandingPageItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({ page: currentPage.toString(), limit: "20" });
      if (searchQuery) params.set("search", searchQuery);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/admin/landing-pages?${params}`);
      const data = await res.json();
      if (data.success) {
        setPages(data.data.landingPages);
        setStats(data.data.stats);
        setTotalPages(data.data.pagination.totalPages);
      }
    } catch (error) {
      console.error("Failed to fetch landing pages:", error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, statusFilter, currentPage]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="w-6 h-6" />Landing Pages</h1>
          <p className="text-muted-foreground mt-1">View and manage all user landing pages</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchData()}><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Pages</p><p className="text-2xl font-bold">{stats.total}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Published</p><p className="text-2xl font-bold text-green-500">{stats.published}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Views</p><p className="text-2xl font-bold text-blue-500">{stats.totalViews.toLocaleString()}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Submissions</p><p className="text-2xl font-bold text-purple-500">{stats.totalSubmissions.toLocaleString()}</p></CardContent></Card>
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search by title or slug..." className="pl-10" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} />
            </div>
            <select className="px-3 py-2 border rounded-lg bg-background text-sm" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}>
              <option value="">All Status</option>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : pages.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground"><FileText className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No landing pages found</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Title</th>
                    <th className="text-left p-3 font-medium">Owner</th>
                    <th className="text-left p-3 font-medium">Type</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Views</th>
                    <th className="text-left p-3 font-medium">Leads</th>
                    <th className="text-left p-3 font-medium">Created</th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map((pg) => (
                    <tr key={pg.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="p-3">
                        <p className="font-medium">{pg.title}</p>
                        <p className="text-xs text-muted-foreground">/{pg.slug}</p>
                      </td>
                      <td className="p-3"><p className="text-xs font-medium">{pg.user.name}</p><p className="text-xs text-muted-foreground">{pg.user.email}</p></td>
                      <td className="p-3"><Badge variant="outline">{pg.pageType}</Badge></td>
                      <td className="p-3">
                        {pg.status === "PUBLISHED" ? (
                          <Badge className="bg-green-500/10 text-green-500 border-green-500/20"><CheckCircle2 className="w-3 h-3 mr-1" />Published</Badge>
                        ) : (
                          <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Draft</Badge>
                        )}
                      </td>
                      <td className="p-3"><span className="flex items-center gap-1"><Eye className="w-3 h-3" />{pg.views.toLocaleString()}</span></td>
                      <td className="p-3"><span className="flex items-center gap-1"><Inbox className="w-3 h-3" />{pg.submissionCount}</span></td>
                      <td className="p-3 text-xs text-muted-foreground">{new Date(pg.createdAt).toLocaleDateString()}</td>
                      <td className="p-3 text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(`/lp/${pg.slug}`, "_blank")} title="Preview">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight className="w-4 h-4" /></Button>
        </div>
      )}
    </div>
  );
}
