"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileQuestion,
  Plus,
  Search,
  BarChart3,
  Copy,
  Trash2,
  ExternalLink,
  MoreVertical,
  Eye,
  ToggleLeft,
  ToggleRight,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SURVEY_STATUS_CONFIG, type SurveyData, type SurveyStatus } from "@/types/survey";

export default function SurveysPage() {
  const router = useRouter();
  const [surveys, setSurveys] = useState<SurveyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 0 });
  const [toast, setToast] = useState("");
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const fetchSurveys = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "12", page: String(page) });
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      const res = await fetch(`/api/surveys?${params}`);
      const json = await res.json();
      if (json.success) {
        setSurveys(json.data || []);
        if (json.pagination) setPagination(json.pagination);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, page]);

  useEffect(() => {
    fetchSurveys();
  }, [fetchSurveys]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleCopyLink = (slug: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/survey/${slug}`);
    setToast("Link copied to clipboard!");
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "ACTIVE" ? "CLOSED" : "ACTIVE";
    try {
      const res = await fetch(`/api/surveys/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, isActive: newStatus === "ACTIVE" }),
      });
      const json = await res.json();
      if (json.success) {
        setSurveys((prev) => prev.map((s) => (s.id === id ? { ...s, status: newStatus as SurveyStatus, isActive: newStatus === "ACTIVE" } : s)));
        setToast(`Survey ${newStatus === "ACTIVE" ? "activated" : "closed"}`);
      }
    } catch {
      setToast("Failed to update status");
    }
    setOpenMenu(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this survey and all its responses?")) return;
    try {
      const res = await fetch(`/api/surveys/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        setSurveys((prev) => prev.filter((s) => s.id !== id));
        setToast("Survey deleted");
      }
    } catch {
      setToast("Failed to delete survey");
    }
    setOpenMenu(null);
  };

  const totalSurveys = pagination.total || surveys.length;
  const activeSurveys = surveys.filter((s) => s.status === "ACTIVE").length;
  const totalResponses = surveys.reduce((sum, s) => sum + s.responseCount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Surveys</h1>
          <p className="text-muted-foreground text-sm">Create and manage surveys and feedback forms</p>
        </div>
        <Link href="/tools/surveys/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> New Survey
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
          <FileQuestion className="h-5 w-5 text-violet-500" />
          <div>
            <p className="text-xl font-bold">{totalSurveys}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
          <div className="h-5 w-5 rounded-full bg-green-500/20 flex items-center justify-center">
            <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
          </div>
          <div>
            <p className="text-xl font-bold">{activeSurveys}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
          <BarChart3 className="h-5 w-5 text-amber-500" />
          <div>
            <p className="text-xl font-bold">{totalResponses}</p>
            <p className="text-xs text-muted-foreground">Responses</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1.5">
          {[
            { value: "", label: "All" },
            { value: "DRAFT", label: "Draft" },
            { value: "ACTIVE", label: "Active" },
            { value: "CLOSED", label: "Closed" },
          ].map((s) => (
            <Button key={s.value} variant={statusFilter === s.value ? "default" : "outline"} size="sm" onClick={() => { setStatusFilter(s.value); setPage(1); }} className="text-xs">
              {s.label}
            </Button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="relative max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search surveys..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-8 h-9 text-sm" />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 animate-pulse">
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
            </div>
          ))}
        </div>
      ) : surveys.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
          <FileQuestion className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No surveys yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Create your first survey to start collecting feedback</p>
          <Link href="/tools/surveys/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Create Survey
            </Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {surveys.map((survey) => {
              const statusCfg = SURVEY_STATUS_CONFIG[survey.status as SurveyStatus] || SURVEY_STATUS_CONFIG.DRAFT;
              return (
                <div key={survey.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow">
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <Link href={`/tools/surveys/${survey.id}`} className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate hover:text-blue-600 transition-colors">{survey.title}</h3>
                      </Link>
                      <div className="relative ml-2">
                        <button onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === survey.id ? null : survey.id); }} className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                          <MoreVertical className="h-4 w-4 text-gray-400" />
                        </button>
                        {openMenu === survey.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                            <div className="absolute right-0 top-8 z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 w-44">
                              <button onClick={() => { router.push(`/tools/surveys/${survey.id}`); setOpenMenu(null); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">
                                <Eye className="h-3.5 w-3.5" /> View
                              </button>
                              <button onClick={() => handleCopyLink(survey.slug)} className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">
                                <Copy className="h-3.5 w-3.5" /> Copy Link
                              </button>
                              <button onClick={() => { window.open(`/survey/${survey.slug}`, "_blank"); setOpenMenu(null); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">
                                <ExternalLink className="h-3.5 w-3.5" /> Open Public Page
                              </button>
                              <button onClick={() => handleToggleStatus(survey.id, survey.status)} className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">
                                {survey.status === "ACTIVE" ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                                {survey.status === "ACTIVE" ? "Close" : "Activate"}
                              </button>
                              <button onClick={() => handleDelete(survey.id)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20">
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-3 ${statusCfg.color}`}>
                      {statusCfg.label}
                    </span>

                    {survey.description && <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{survey.description}</p>}

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <BarChart3 className="h-3 w-3" /> {survey.responseCount} responses
                      </span>
                      {survey.sendCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Send className="h-3 w-3" /> Sent {survey.sendCount}
                        </span>
                      )}
                      <span>{new Date(survey.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 dark:border-gray-700 px-5 py-3 flex items-center gap-2">
                    <Link href={`/tools/surveys/${survey.id}`} className="text-xs text-blue-600 hover:underline flex-1">
                      View Details
                    </Link>
                    <button onClick={() => handleCopyLink(survey.slug)} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
                      <Copy className="h-3 w-3" /> Copy Link
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {pagination.pages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= pagination.pages} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm animate-in fade-in slide-in-from-bottom-5">
          {toast}
        </div>
      )}
    </div>
  );
}
