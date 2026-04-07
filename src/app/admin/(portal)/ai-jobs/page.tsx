"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sparkles,
  Search,
  RefreshCw,
  Eye,
  ChevronLeft,
  ChevronRight,
  Video,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Coins,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface AIJob {
  id: string;
  type: string;
  storyPrompt: string;
  style: string;
  animationType: string;
  status: string;
  progress: number;
  currentStep: string | null;
  errorMessage: string | null;
  creditsCost: number;
  videoUrl: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string };
  project: { id: string; name: string } | null;
}

interface Stats {
  total: number;
  completed: number;
  processing: number;
  failed: number;
  totalCreditsUsed: number;
}

export default function AdminAIJobsPage() {
  const [jobs, setJobs] = useState<AIJob[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [viewingJob, setViewingJob] = useState<AIJob | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({ page: currentPage.toString(), limit: "20" });
      if (searchQuery) params.set("search", searchQuery);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/admin/ai-jobs?${params}`);
      const data = await res.json();
      if (data.success) {
        setJobs(data.data.jobs);
        setStats(data.data.stats);
        setTotalPages(data.data.pagination.totalPages);
      }
    } catch (error) {
      console.error("Failed to fetch AI jobs:", error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, statusFilter, currentPage]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getStatusBadge = (status: string) => {
    const map: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
      COMPLETED: { color: "bg-green-500/10 text-green-500 border-green-500/20", icon: <CheckCircle2 className="w-3 h-3 mr-1" />, label: "Completed" },
      PROCESSING: { color: "bg-blue-500/10 text-blue-500 border-blue-500/20", icon: <Loader2 className="w-3 h-3 mr-1 animate-spin" />, label: "Processing" },
      FAILED: { color: "bg-red-500/10 text-red-500 border-red-500/20", icon: <XCircle className="w-3 h-3 mr-1" />, label: "Failed" },
      PENDING: { color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20", icon: <Clock className="w-3 h-3 mr-1" />, label: "Pending" },
    };
    const s = map[status] || { color: "", icon: null, label: status };
    return <Badge className={s.color}>{s.icon}{s.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6" />
            AI Jobs Monitor
          </h1>
          <p className="text-muted-foreground mt-1">Track all AI generation jobs (cartoons, videos, voice)</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchData()}>
          <RefreshCw className="w-4 h-4 mr-2" />Refresh
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Jobs</p><p className="text-2xl font-bold">{stats.total}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Completed</p><p className="text-2xl font-bold text-green-500">{stats.completed}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Processing</p><p className="text-2xl font-bold text-blue-500">{stats.processing}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Failed</p><p className="text-2xl font-bold text-red-500">{stats.failed}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Credits Used</p><p className="text-2xl font-bold text-orange-500">{stats.totalCreditsUsed.toLocaleString()}</p></CardContent></Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search by prompt..." className="pl-10" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} />
            </div>
            <select className="px-3 py-2 border rounded-lg bg-background text-sm" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}>
              <option value="">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="PROCESSING">Processing</option>
              <option value="COMPLETED">Completed</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : jobs.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Video className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No AI jobs found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Prompt</th>
                    <th className="text-left p-3 font-medium">User</th>
                    <th className="text-left p-3 font-medium">Style</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Progress</th>
                    <th className="text-left p-3 font-medium">Credits</th>
                    <th className="text-left p-3 font-medium">Created</th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="p-3 max-w-[250px]">
                        <p className="truncate font-medium">{job.storyPrompt}</p>
                        {job.project && <p className="text-xs text-muted-foreground">Project: {job.project.name}</p>}
                      </td>
                      <td className="p-3">
                        <p className="text-xs font-medium">{job.user.name}</p>
                        <p className="text-xs text-muted-foreground">{job.user.email}</p>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline">{job.style}</Badge>
                        <p className="text-xs text-muted-foreground mt-1">{job.animationType}</p>
                      </td>
                      <td className="p-3">
                        {getStatusBadge(job.status)}
                        {job.currentStep && <p className="text-xs text-muted-foreground mt-1">{job.currentStep}</p>}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${job.progress}%` }} />
                          </div>
                          <span className="text-xs">{job.progress}%</span>
                        </div>
                      </td>
                      <td className="p-3"><span className="flex items-center gap-1"><Coins className="w-3 h-3" />{job.creditsCost}</span></td>
                      <td className="p-3 text-xs text-muted-foreground">{new Date(job.createdAt).toLocaleDateString()}</td>
                      <td className="p-3 text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewingJob(job)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        {job.videoUrl && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(job.videoUrl!, "_blank")}>
                            <Video className="w-4 h-4" />
                          </Button>
                        )}
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
          <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight className="w-4 h-4" /></Button>
        </div>
      )}

      {/* Detail Modal */}
      {viewingJob && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setViewingJob(null)}>
          <div className="bg-card border rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">AI Job Details</h2>
              <Button variant="ghost" size="sm" onClick={() => setViewingJob(null)}>Close</Button>
            </div>
            <div className="space-y-3 text-sm">
              <div><span className="text-muted-foreground">Prompt:</span><p className="mt-1">{viewingJob.storyPrompt}</p></div>
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Style:</span> <span className="font-medium">{viewingJob.style}</span></div>
                <div><span className="text-muted-foreground">Animation:</span> <span className="font-medium">{viewingJob.animationType}</span></div>
                <div><span className="text-muted-foreground">Status:</span> {getStatusBadge(viewingJob.status)}</div>
                <div><span className="text-muted-foreground">Credits:</span> <span className="font-medium">{viewingJob.creditsCost}</span></div>
                <div className="col-span-2"><span className="text-muted-foreground">User:</span> <span className="font-medium">{viewingJob.user.name} ({viewingJob.user.email})</span></div>
              </div>
              {viewingJob.errorMessage && (
                <div><span className="text-muted-foreground">Error:</span><p className="text-red-400 text-xs mt-1 bg-red-500/5 p-2 rounded">{viewingJob.errorMessage}</p></div>
              )}
              {viewingJob.currentStep && (
                <div><span className="text-muted-foreground">Current Step:</span> <span className="font-medium">{viewingJob.currentStep}</span></div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
