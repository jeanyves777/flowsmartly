"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Search, Copy, Trash2, ExternalLink, MoreVertical, FileText, Eye, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FORM_STATUS_CONFIG, type DataFormData, type DataFormStatus } from "@/types/data-form";

export default function DataCollectionPage() {
  const router = useRouter();
  const [forms, setForms] = useState<DataFormData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DataFormStatus | "">("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 0 });
  const [toast, setToast] = useState("");

  const fetchForms = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "12" });
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      const res = await fetch(`/api/data-forms?${params}`);
      const json = await res.json();
      if (json.success) {
        setForms(json.data);
        setPagination(json.pagination);
      }
    } catch (error) {
      console.error("Failed to fetch forms:", error);
      setToast("Failed to load forms");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => {
    fetchForms();
  }, [fetchForms]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleCopyLink = (slug: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/form/${slug}`);
    setToast("Link copied to clipboard!");
  };

  const handleToggleStatus = async (id: string, currentStatus: DataFormStatus) => {
    const newStatus: DataFormStatus = currentStatus === "ACTIVE" ? "CLOSED" : "ACTIVE";
    try {
      const res = await fetch(`/api/data-forms/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
        fetchForms();
        setToast(`Form ${newStatus === "ACTIVE" ? "activated" : "closed"}`);
      } else {
        setToast("Failed to update status");
      }
    } catch (error) {
      console.error("Failed to toggle status:", error);
      setToast("Failed to update status");
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/data-forms/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        fetchForms();
        setToast("Form deleted successfully");
      } else {
        setToast("Failed to delete form");
      }
    } catch (error) {
      console.error("Failed to delete form:", error);
      setToast("Failed to delete form");
    }
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value as DataFormStatus | "");
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-muted/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Data Collection</h1>
            <p className="text-sm text-muted-foreground mt-1">Create and manage custom forms to collect data from your audience</p>
          </div>
          <Link href="/tools/data-collection/new">
            <Button className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Create Form
            </Button>
          </Link>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search forms..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilter(e.target.value)}
            className="px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-card rounded-xl border border-border p-4 sm:p-5 animate-pulse">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="h-5 bg-muted rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-muted rounded w-full"></div>
                  </div>
                  <div className="h-5 w-16 bg-muted rounded-full ml-2"></div>
                </div>
                <div className="flex gap-4 mb-3">
                  <div className="h-4 bg-muted rounded w-24"></div>
                  <div className="h-4 bg-muted rounded w-20"></div>
                </div>
                <div className="flex gap-2 border-t border-border pt-3">
                  <div className="h-8 bg-muted rounded flex-1"></div>
                  <div className="h-8 bg-muted rounded flex-1"></div>
                  <div className="h-8 bg-muted rounded w-8"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && forms.length === 0 && (
          <div className="text-center py-12 sm:py-16 bg-card rounded-xl border border-border">
            <FileText className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2">
              {search || statusFilter ? "No forms found" : "No forms yet"}
            </h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto px-4">
              {search || statusFilter
                ? "Try adjusting your search or filters"
                : "Create your first data collection form to start gathering information from your audience"}
            </p>
            {!search && !statusFilter && (
              <Link href="/tools/data-collection/new">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Form
                </Button>
              </Link>
            )}
          </div>
        )}

        {/* Forms Grid */}
        {!loading && forms.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {forms.map((form) => {
                const statusConfig = FORM_STATUS_CONFIG[form.status];
                return (
                  <div
                    key={form.id}
                    className="bg-card rounded-xl border border-border p-4 sm:p-5 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/tools/data-collection/${form.id}`}
                          className="font-semibold text-base hover:text-blue-600 transition-colors line-clamp-1 block"
                        >
                          {form.title}
                        </Link>
                        {form.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{form.description}</p>
                        )}
                      </div>
                      <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${statusConfig.color}`}>
                        {statusConfig.label}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{form.responseCount || 0} responses</span>
                      <span>{new Date(form.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                      <Link href={`/tools/data-collection/${form.id}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full">
                          <Eye className="w-3.5 h-3.5 mr-1.5" />
                          View
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyLink(form.slug)}
                        className="flex-1"
                      >
                        <Copy className="w-3.5 h-3.5 mr-1.5" />
                        Copy Link
                      </Button>
                      <div className="relative group">
                        <Button variant="outline" size="sm" className="px-2">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                        <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                          <button
                            onClick={() => handleToggleStatus(form.id, form.status)}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-muted flex items-center gap-2 first:rounded-t-lg"
                          >
                            {form.status === "ACTIVE" ? (
                              <>
                                <ToggleLeft className="w-4 h-4" />
                                Close Form
                              </>
                            ) : (
                              <>
                                <ToggleRight className="w-4 h-4" />
                                Activate Form
                              </>
                            )}
                          </button>
                          <a
                            href={`/form/${form.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full text-left px-4 py-2 text-sm hover:bg-muted flex items-center gap-2"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Open Public Form
                          </a>
                          <button
                            onClick={() => handleDelete(form.id, form.title)}
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 last:rounded-b-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground px-4">
                  Page {page} of {pagination.pages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.min(pagination.pages, page + 1))}
                  disabled={page === pagination.pages}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-6 py-3 rounded-lg shadow-lg z-50 animate-in fade-in slide-in-from-bottom-2">
          {toast}
        </div>
      )}
    </div>
  );
}
