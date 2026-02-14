"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ExternalLink,
  Globe,
  MessageSquare,
  ArrowLeft,
  Search,
  Loader2,
  Eye,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ComplianceUser {
  id: string;
  name: string | null;
  email: string;
  username: string | null;
  image: string | null;
}

interface ComplianceSubmission {
  id: string;
  userId: string;
  user: ComplianceUser;
  businessName: string | null;
  businessWebsite: string | null;
  privacyPolicyUrl: string | null;
  termsOfServiceUrl: string | null;
  smsUseCase: string | null;
  smsUseCaseDescription: string | null;
  smsMessageSamples: string[];
  smsComplianceStatus: string;
  optOutMessage: string;
  complianceSubmittedAt: string | null;
  complianceReviewedAt: string | null;
  complianceReviewedBy: string | null;
  complianceNotes: string | null;
  smsEnabled: boolean;
  smsPhoneNumber: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ComplianceStats {
  pending: number;
  approved: number;
  rejected: number;
  suspended: number;
  total: number;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const statusConfig: Record<
  string,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  PENDING_REVIEW: {
    label: "Pending Review",
    color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    icon: Clock,
  },
  APPROVED: {
    label: "Approved",
    color: "bg-green-500/20 text-green-400 border-green-500/30",
    icon: CheckCircle2,
  },
  REJECTED: {
    label: "Rejected",
    color: "bg-red-500/20 text-red-400 border-red-500/30",
    icon: XCircle,
  },
  SUSPENDED: {
    label: "Suspended",
    color: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    icon: AlertTriangle,
  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] || {
    label: status,
    color: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    icon: Clock,
  };
  const Icon = cfg.icon;
  return (
    <Badge className={`${cfg.color} gap-1`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </Badge>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "N/A";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function ComplianceReviewPage() {
  const { toast } = useToast();

  // Data state
  const [submissions, setSubmissions] = useState<ComplianceSubmission[]>([]);
  const [stats, setStats] = useState<ComplianceStats | null>(null);
  const [pagination, setPagination] = useState<PaginationData | null>(null);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Review dialog state
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] =
    useState<ComplianceSubmission | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Expanded rows for details
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchSubmissions = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (currentPage > 1) params.set("page", currentPage.toString());
      params.set("limit", "20");

      const response = await fetch(`/api/admin/sms/compliance?${params}`);
      const data = await response.json();

      if (data.success) {
        setSubmissions(data.data.submissions);
        setStats(data.data.stats);
        setPagination(data.data.pagination);
        setError(null);
      } else {
        setError(data.error?.message || "Failed to fetch submissions");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load compliance submissions"
      );
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus, currentPage]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus]);

  // ---------------------------------------------------------------------------
  // Review handler
  // ---------------------------------------------------------------------------

  const handleReview = async (action: "approve" | "reject") => {
    if (!selectedSubmission) return;

    // Require notes for rejection
    if (action === "reject" && !reviewNotes.trim()) {
      toast({
        title: "Notes required",
        description: "Please provide a reason for rejecting this submission.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmittingReview(true);
    try {
      const response = await fetch(
        `/api/admin/sms/compliance/${selectedSubmission.userId}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, notes: reviewNotes || undefined }),
        }
      );

      const data = await response.json();

      if (data.success) {
        toast({
          title: action === "approve" ? "Submission Approved" : "Submission Rejected",
          description: `Compliance for ${selectedSubmission.user.name || selectedSubmission.user.email} has been ${action === "approve" ? "approved" : "rejected"}.`,
        });
        setReviewDialogOpen(false);
        setSelectedSubmission(null);
        setReviewNotes("");
        // Refresh the list
        fetchSubmissions();
      } else {
        toast({
          title: "Error",
          description: data.error?.message || "Failed to process review",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // ---------------------------------------------------------------------------
  // UI helpers
  // ---------------------------------------------------------------------------

  const openReviewDialog = (submission: ComplianceSubmission) => {
    setSelectedSubmission(submission);
    setReviewNotes(submission.complianceNotes || "");
    setReviewDialogOpen(true);
  };

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filteredSubmissions = searchQuery
    ? submissions.filter(
        (s) =>
          (s.user.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (s.businessName || "").toLowerCase().includes(searchQuery.toLowerCase())
      )
    : submissions;

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------

  if (error && submissions.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="mb-4">{error}</p>
          <Button onClick={fetchSubmissions} variant="outline">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/sms-marketing"
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-brand-500" />
              <h1 className="text-2xl font-bold">SMS Compliance Review</h1>
            </div>
            <p className="mt-1 text-muted-foreground">
              Review and manage SMS compliance submissions from users
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={fetchSubmissions}
          disabled={isLoading}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {isLoading && !stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "Pending",
              value: stats?.pending || 0,
              icon: Clock,
              color: "yellow",
            },
            {
              label: "Approved",
              value: stats?.approved || 0,
              icon: CheckCircle2,
              color: "green",
            },
            {
              label: "Rejected",
              value: stats?.rejected || 0,
              icon: XCircle,
              color: "red",
            },
            {
              label: "Suspended",
              value: stats?.suspended || 0,
              icon: AlertTriangle,
              color: "orange",
            },
          ].map((stat) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        stat.color === "yellow"
                          ? "bg-yellow-500/20"
                          : stat.color === "green"
                            ? "bg-green-500/20"
                            : stat.color === "red"
                              ? "bg-red-500/20"
                              : "bg-orange-500/20"
                      }`}
                    >
                      <stat.icon
                        className={`w-5 h-5 ${
                          stat.color === "yellow"
                            ? "text-yellow-500"
                            : stat.color === "green"
                              ? "text-green-500"
                              : stat.color === "red"
                                ? "text-red-500"
                                : "text-orange-500"
                        }`}
                      />
                    </div>
                    <div>
                      <p className="text-xl font-bold">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Filter Tabs + Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by name, email, or business..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              {[
                { key: "all", label: "All" },
                { key: "PENDING_REVIEW", label: "Pending" },
                { key: "APPROVED", label: "Approved" },
                { key: "REJECTED", label: "Rejected" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilterStatus(tab.key)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    filterStatus === tab.key
                      ? "bg-background text-foreground shadow-sm font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                  {tab.key === "PENDING_REVIEW" && stats?.pending
                    ? ` (${stats.pending})`
                    : ""}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submissions List */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="space-y-3">
                  <Skeleton className="h-6 w-1/3" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-1">No compliance submissions found</p>
            <p className="text-sm">
              {filterStatus !== "all"
                ? "Try changing the filter to see more results."
                : "No users have submitted SMS compliance forms yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredSubmissions.map((submission, index) => (
            <motion.div
              key={submission.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
            >
              <SubmissionCard
                submission={submission}
                isExpanded={expandedRows.has(submission.id)}
                onToggle={() => toggleRow(submission.id)}
                onReview={() => openReviewDialog(submission)}
              />
            </motion.div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total} submissions
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              Page {pagination.page} of {pagination.pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= pagination.pages}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedSubmission && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Compliance Review
                </DialogTitle>
                <DialogDescription>
                  Review the SMS compliance submission for{" "}
                  <span className="font-medium text-foreground">
                    {selectedSubmission.user.name || selectedSubmission.user.email}
                  </span>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 py-2">
                {/* User Info */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    User Info
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Name:</span>{" "}
                      <span className="font-medium">
                        {selectedSubmission.user.name || "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Email:</span>{" "}
                      <span className="font-medium">
                        {selectedSubmission.user.email}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Business Info */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Business Info
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Business Name:</span>{" "}
                      <span className="font-medium">
                        {selectedSubmission.businessName || "N/A"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">Website:</span>{" "}
                      {selectedSubmission.businessWebsite ? (
                        <a
                          href={selectedSubmission.businessWebsite}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-500 hover:underline inline-flex items-center gap-1"
                        >
                          {selectedSubmission.businessWebsite}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="font-medium">N/A</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">Privacy Policy:</span>{" "}
                      {selectedSubmission.privacyPolicyUrl ? (
                        <a
                          href={selectedSubmission.privacyPolicyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-500 hover:underline inline-flex items-center gap-1"
                        >
                          {selectedSubmission.privacyPolicyUrl}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="font-medium">N/A</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">Terms of Service:</span>{" "}
                      {selectedSubmission.termsOfServiceUrl ? (
                        <a
                          href={selectedSubmission.termsOfServiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-500 hover:underline inline-flex items-center gap-1"
                        >
                          {selectedSubmission.termsOfServiceUrl}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="font-medium">N/A</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Use Case */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Use Case
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Type:</span>{" "}
                      <Badge variant="outline">
                        {selectedSubmission.smsUseCase || "N/A"}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Description:</span>
                      <p className="mt-1 p-3 bg-muted rounded-lg text-sm">
                        {selectedSubmission.smsUseCaseDescription || "No description provided"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sample Messages */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Sample Messages
                  </h3>
                  {selectedSubmission.smsMessageSamples.length > 0 ? (
                    <div className="space-y-2">
                      {selectedSubmission.smsMessageSamples.map((msg, i) => (
                        <div
                          key={i}
                          className="p-3 bg-muted rounded-lg text-sm flex items-start gap-2"
                        >
                          <MessageSquare className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                          <span>{msg}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No sample messages provided
                    </p>
                  )}
                </div>

                {/* Opt-Out Message */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Opt-Out Message
                  </h3>
                  <p className="p-3 bg-muted rounded-lg text-sm">
                    {selectedSubmission.optOutMessage}
                  </p>
                </div>

                {/* Status & Dates */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Status
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Current Status:</span>{" "}
                      <StatusBadge status={selectedSubmission.smsComplianceStatus} />
                    </div>
                    <div>
                      <span className="text-muted-foreground">Submitted:</span>{" "}
                      <span className="font-medium">
                        {formatDate(selectedSubmission.complianceSubmittedAt)}
                      </span>
                    </div>
                    {selectedSubmission.complianceReviewedAt && (
                      <>
                        <div>
                          <span className="text-muted-foreground">Reviewed:</span>{" "}
                          <span className="font-medium">
                            {formatDate(selectedSubmission.complianceReviewedAt)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Reviewed By:</span>{" "}
                          <span className="font-medium">
                            {selectedSubmission.complianceReviewedBy || "N/A"}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                  {selectedSubmission.complianceNotes && (
                    <div className="mt-2">
                      <span className="text-sm text-muted-foreground">
                        Previous Notes:
                      </span>
                      <p className="mt-1 p-3 bg-muted rounded-lg text-sm">
                        {selectedSubmission.complianceNotes}
                      </p>
                    </div>
                  )}
                </div>

                {/* Review Notes */}
                {selectedSubmission.smsComplianceStatus === "PENDING_REVIEW" && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Review Notes
                    </h3>
                    <Textarea
                      placeholder="Add notes about your review decision (required for rejection)..."
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      rows={3}
                    />
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                {selectedSubmission.smsComplianceStatus === "PENDING_REVIEW" ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setReviewDialogOpen(false)}
                      disabled={isSubmittingReview}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleReview("reject")}
                      disabled={isSubmittingReview}
                      className="gap-2"
                    >
                      {isSubmittingReview ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      Reject
                    </Button>
                    <Button
                      onClick={() => handleReview("approve")}
                      disabled={isSubmittingReview}
                      className="bg-green-600 hover:bg-green-700 text-white gap-2"
                    >
                      {isSubmittingReview ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      Approve
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setReviewDialogOpen(false)}
                  >
                    Close
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Submission Card Component
// ---------------------------------------------------------------------------

function SubmissionCard({
  submission,
  isExpanded,
  onToggle,
  onReview,
}: {
  submission: ComplianceSubmission;
  isExpanded: boolean;
  onToggle: () => void;
  onReview: () => void;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        {/* Main Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            {/* Icon */}
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-brand-500/20 shrink-0">
              <Shield className="w-5 h-5 text-brand-500" />
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="font-semibold truncate">
                  {submission.user.name || submission.user.email}
                </h3>
                <StatusBadge status={submission.smsComplianceStatus} />
              </div>
              <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                <span className="text-xs text-muted-foreground">
                  {submission.user.email}
                </span>
                {submission.businessName && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    {submission.businessName}
                  </span>
                )}
                {submission.smsUseCase && (
                  <Badge variant="outline" className="text-xs">
                    {submission.smsUseCase}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  Submitted: {formatDate(submission.complianceSubmittedAt)}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={onToggle} className="gap-1">
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
              Details
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onReview}
              className="gap-1"
            >
              <Eye className="w-4 h-4" />
              Review
            </Button>
            {submission.smsComplianceStatus === "PENDING_REVIEW" && (
              <>
                <Button
                  size="sm"
                  onClick={onReview}
                  className="bg-green-600 hover:bg-green-700 text-white gap-1"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Approve
                </Button>
                <Button size="sm" variant="destructive" onClick={onReview} className="gap-1">
                  <XCircle className="w-4 h-4" />
                  Reject
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-4 pt-4 border-t border-border"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {/* Business Details */}
              <div className="space-y-2">
                <h4 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                  Business Details
                </h4>
                <div className="space-y-1.5">
                  <div>
                    <span className="text-muted-foreground">Business Name:</span>{" "}
                    <span className="font-medium">
                      {submission.businessName || "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Website:</span>{" "}
                    {submission.businessWebsite ? (
                      <a
                        href={submission.businessWebsite}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-500 hover:underline inline-flex items-center gap-1"
                      >
                        {submission.businessWebsite}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      "N/A"
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Privacy Policy:</span>{" "}
                    {submission.privacyPolicyUrl ? (
                      <a
                        href={submission.privacyPolicyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-500 hover:underline inline-flex items-center gap-1"
                      >
                        View Policy
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      "N/A"
                    )}
                  </div>
                </div>
              </div>

              {/* Use Case */}
              <div className="space-y-2">
                <h4 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                  Use Case
                </h4>
                <div className="space-y-1.5">
                  <div>
                    <span className="text-muted-foreground">Type:</span>{" "}
                    <Badge variant="outline">{submission.smsUseCase || "N/A"}</Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Description:</span>
                    <p className="mt-1 p-2 bg-muted rounded text-xs">
                      {submission.smsUseCaseDescription || "No description provided"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Sample Messages */}
              <div className="space-y-2 md:col-span-2">
                <h4 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                  Sample Messages
                </h4>
                {submission.smsMessageSamples.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {submission.smsMessageSamples.map((msg, i) => (
                      <div
                        key={i}
                        className="p-2 bg-muted rounded text-xs flex items-start gap-2"
                      >
                        <MessageSquare className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
                        <span>{msg}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No sample messages provided
                  </p>
                )}
              </div>

              {/* Review Notes (if any) */}
              {submission.complianceNotes && (
                <div className="space-y-2 md:col-span-2">
                  <h4 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                    Review Notes
                  </h4>
                  <p className="p-2 bg-muted rounded text-xs">
                    {submission.complianceNotes}
                  </p>
                  {submission.complianceReviewedAt && (
                    <p className="text-xs text-muted-foreground">
                      Reviewed on {formatDate(submission.complianceReviewedAt)}
                    </p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
