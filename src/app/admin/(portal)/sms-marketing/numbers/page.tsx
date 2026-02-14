"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Phone,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ArrowLeft,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Shield,
  PhoneCall,
  Signal,
  Ban,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NumberUser {
  id: string;
  name: string | null;
  email: string;
  username: string | null;
  avatarUrl: string | null;
}

interface NumberEntry {
  userId: string;
  user: NumberUser;
  smsEnabled: boolean;
  smsPhoneNumber: string | null;
  smsPhoneNumberSid: string | null;
  smsVerified: boolean;
  businessName: string | null;
  smsComplianceStatus: string;
  // A2P
  smsA2pBrandSid: string | null;
  smsA2pBrandStatus: string | null;
  smsA2pCampaignSid: string | null;
  smsA2pCampaignStatus: string | null;
  smsA2pMessagingServiceSid: string | null;
  smsA2pProfileSid: string | null;
  // Toll-free
  smsTollfreeVerifySid: string | null;
  smsTollfreeVerifyStatus: string | null;
  // Other
  smsEmergencyAddressSid: string | null;
  isTollFree: boolean;
  overallStatus: string;
  createdAt: string;
  updatedAt: string;
}

interface Stats {
  totalNumbers: number;
  localNumbers: number;
  tollFreeNumbers: number;
  a2pApproved: number;
  a2pPending: number;
  a2pFailed: number;
  noRegistration: number;
  tollfreeApproved: number;
  tollfreePending: number;
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

const overallStatusConfig: Record<
  string,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  APPROVED: {
    label: "Approved",
    color: "bg-green-500/20 text-green-500 border-green-500/30",
    icon: CheckCircle2,
  },
  PENDING: {
    label: "Pending",
    color: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
    icon: Clock,
  },
  FAILED: {
    label: "Failed",
    color: "bg-red-500/20 text-red-500 border-red-500/30",
    icon: XCircle,
  },
  NOT_REGISTERED: {
    label: "Not Registered",
    color: "bg-orange-500/20 text-orange-500 border-orange-500/30",
    icon: AlertTriangle,
  },
  NO_NUMBER: {
    label: "No Number",
    color: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    icon: Ban,
  },
};

function OverallStatusBadge({ status }: { status: string }) {
  const cfg = overallStatusConfig[status] || overallStatusConfig.NOT_REGISTERED;
  const Icon = cfg.icon;
  return (
    <Badge className={`${cfg.color} gap-1`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </Badge>
  );
}

function DetailStatusBadge({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  const colors: Record<string, string> = {
    APPROVED: "text-green-500",
    VERIFIED: "text-green-500",
    SUCCESSFUL: "text-green-500",
    TWILIO_APPROVED: "text-green-500",
    PENDING: "text-yellow-500",
    IN_PROGRESS: "text-yellow-500",
    IN_REVIEW: "text-yellow-500",
    PENDING_REVIEW: "text-yellow-500",
    FAILED: "text-red-500",
    TWILIO_REJECTED: "text-red-500",
  };
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">{label}:</span>
      <span className={`font-medium ${colors[value] || "text-muted-foreground"}`}>
        {value.replace(/_/g, " ")}
      </span>
    </div>
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

export default function SmsNumbersMonitoringPage() {
  const { toast } = useToast();

  const [numbers, setNumbers] = useState<NumberEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pagination, setPagination] = useState<PaginationData | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchNumbers = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.set("filter", filter);
      if (searchQuery) params.set("search", searchQuery);
      params.set("page", currentPage.toString());
      params.set("limit", "50");

      const response = await fetch(`/api/admin/sms/numbers?${params}`);
      const data = await response.json();

      if (data.success) {
        setNumbers(data.data.numbers);
        setStats(data.data.stats);
        setPagination(data.data.pagination);
        setError(null);
      } else {
        setError(data.error?.message || "Failed to fetch numbers");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load SMS numbers");
    } finally {
      setIsLoading(false);
    }
  }, [filter, searchQuery, currentPage]);

  useEffect(() => {
    fetchNumbers();
  }, [fetchNumbers]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchQuery]);

  const toggleRow = (userId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------

  if (error && numbers.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="mb-4">{error}</p>
          <Button onClick={fetchNumbers} variant="outline">
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
              <Phone className="w-6 h-6 text-brand-500" />
              <h1 className="text-2xl font-bold">SMS Number Compliance</h1>
            </div>
            <p className="mt-1 text-muted-foreground">
              Monitor A2P 10DLC and toll-free verification status for all users
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={fetchNumbers}
          disabled={isLoading}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {isLoading && !stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { label: "Total Numbers", value: stats.totalNumbers, icon: Phone, color: "blue" },
            { label: "A2P Approved", value: stats.a2pApproved, icon: CheckCircle2, color: "green" },
            { label: "A2P Pending", value: stats.a2pPending, icon: Clock, color: "yellow" },
            { label: "A2P Failed", value: stats.a2pFailed, icon: XCircle, color: "red" },
            { label: "No Registration", value: stats.noRegistration, icon: AlertTriangle, color: "orange" },
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
                        stat.color === "blue"
                          ? "bg-blue-500/20"
                          : stat.color === "green"
                            ? "bg-green-500/20"
                            : stat.color === "yellow"
                              ? "bg-yellow-500/20"
                              : stat.color === "red"
                                ? "bg-red-500/20"
                                : "bg-orange-500/20"
                      }`}
                    >
                      <stat.icon
                        className={`w-5 h-5 ${
                          stat.color === "blue"
                            ? "text-blue-500"
                            : stat.color === "green"
                              ? "text-green-500"
                              : stat.color === "yellow"
                                ? "text-yellow-500"
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
      ) : null}

      {/* Secondary stats row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Local Numbers", value: stats.localNumbers, icon: PhoneCall },
            { label: "Toll-Free Numbers", value: stats.tollFreeNumbers, icon: Signal },
            { label: "TF Approved", value: stats.tollfreeApproved, icon: CheckCircle2 },
            { label: "TF Pending", value: stats.tollfreePending, icon: Clock },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <stat.icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{stat.label}</span>
                  <span className="ml-auto font-semibold">{stat.value}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filter + Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by name, email, business, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1 flex-wrap">
              {[
                { key: "all", label: "All" },
                { key: "has_number", label: "Has Number" },
                { key: "a2p_pending", label: "A2P Pending" },
                { key: "a2p_approved", label: "A2P Approved" },
                { key: "a2p_failed", label: "A2P Failed" },
                { key: "no_registration", label: "No Reg" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`px-3 py-1.5 text-xs rounded-md transition-colors whitespace-nowrap ${
                    filter === tab.key
                      ? "bg-background text-foreground shadow-sm font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Numbers List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-1/3" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : numbers.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            <Phone className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-1">No numbers found</p>
            <p className="text-sm">
              {filter !== "all"
                ? "Try changing the filter to see more results."
                : "No users have purchased SMS numbers yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {numbers.map((entry, index) => (
            <motion.div
              key={entry.userId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.03 }}
            >
              <NumberCard
                entry={entry}
                isExpanded={expandedRows.has(entry.userId)}
                onToggle={() => toggleRow(entry.userId)}
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
            {pagination.total} numbers
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Number Card Component
// ---------------------------------------------------------------------------

function NumberCard({
  entry,
  isExpanded,
  onToggle,
}: {
  entry: NumberEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        {/* Main Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Phone icon */}
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                entry.isTollFree ? "bg-purple-500/20" : "bg-blue-500/20"
              }`}
            >
              <Phone
                className={`w-5 h-5 ${entry.isTollFree ? "text-purple-500" : "text-blue-500"}`}
              />
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold font-mono">
                  {entry.smsPhoneNumber || "No number"}
                </span>
                <OverallStatusBadge status={entry.overallStatus} />
                <Badge variant="outline" className="text-xs">
                  {entry.isTollFree ? "Toll-Free" : "Local"}
                </Badge>
                {!entry.smsEnabled && (
                  <Badge variant="outline" className="text-xs text-orange-500 border-orange-500/30">
                    Disabled
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 mt-1 flex-wrap">
                <span className="text-xs text-muted-foreground">
                  {entry.user.name || entry.user.email}
                </span>
                {entry.user.name && (
                  <span className="text-xs text-muted-foreground">{entry.user.email}</span>
                )}
                {entry.businessName && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    {entry.businessName}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick status columns */}
          <div className="hidden md:flex items-center gap-6 text-xs shrink-0">
            {!entry.isTollFree && (
              <>
                <div className="text-center min-w-[80px]">
                  <p className="text-muted-foreground">Brand</p>
                  <p className={`font-medium ${
                    entry.smsA2pBrandStatus === "APPROVED"
                      ? "text-green-500"
                      : entry.smsA2pBrandStatus === "FAILED"
                        ? "text-red-500"
                        : "text-yellow-500"
                  }`}>
                    {entry.smsA2pBrandStatus || "N/A"}
                  </p>
                </div>
                <div className="text-center min-w-[80px]">
                  <p className="text-muted-foreground">Campaign</p>
                  <p className={`font-medium ${
                    entry.smsA2pCampaignStatus === "VERIFIED" ||
                    entry.smsA2pCampaignStatus === "SUCCESSFUL"
                      ? "text-green-500"
                      : entry.smsA2pCampaignStatus === "FAILED"
                        ? "text-red-500"
                        : "text-yellow-500"
                  }`}>
                    {entry.smsA2pCampaignStatus || "N/A"}
                  </p>
                </div>
              </>
            )}
            {entry.isTollFree && (
              <div className="text-center min-w-[100px]">
                <p className="text-muted-foreground">TF Verification</p>
                <p className={`font-medium ${
                  entry.smsTollfreeVerifyStatus === "TWILIO_APPROVED"
                    ? "text-green-500"
                    : entry.smsTollfreeVerifyStatus === "TWILIO_REJECTED"
                      ? "text-red-500"
                      : "text-yellow-500"
                }`}>
                  {entry.smsTollfreeVerifyStatus?.replace("TWILIO_", "") || "N/A"}
                </p>
              </div>
            )}
          </div>

          {/* Expand button */}
          <Button variant="outline" size="sm" onClick={onToggle} className="gap-1 shrink-0">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            Details
          </Button>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              {/* Number Info */}
              <div className="space-y-2">
                <h4 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                  Number Details
                </h4>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Phone:</span>
                    <span className="font-mono font-medium">{entry.smsPhoneNumber || "N/A"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">SID:</span>
                    <span className="font-mono text-[10px]">{entry.smsPhoneNumberSid || "N/A"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Type:</span>
                    <span>{entry.isTollFree ? "Toll-Free" : "Local"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">SMS Enabled:</span>
                    <span className={entry.smsEnabled ? "text-green-500" : "text-red-500"}>
                      {entry.smsEnabled ? "Yes" : "No"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">E911 Address:</span>
                    <span>{entry.smsEmergencyAddressSid ? "Configured" : "None"}</span>
                  </div>
                </div>
              </div>

              {/* A2P Registration (for local numbers) */}
              {!entry.isTollFree && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                    A2P 10DLC Registration
                  </h4>
                  <div className="space-y-1">
                    <DetailStatusBadge label="Brand" value={entry.smsA2pBrandStatus} />
                    <DetailStatusBadge label="Campaign" value={entry.smsA2pCampaignStatus} />
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Brand SID:</span>
                      <span className="font-mono text-[10px]">{entry.smsA2pBrandSid || "N/A"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Campaign SID:</span>
                      <span className="font-mono text-[10px]">{entry.smsA2pCampaignSid || "N/A"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Messaging Service:</span>
                      <span className="font-mono text-[10px]">
                        {entry.smsA2pMessagingServiceSid || "N/A"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Profile SID:</span>
                      <span className="font-mono text-[10px]">{entry.smsA2pProfileSid || "N/A"}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Toll-Free Verification (for toll-free numbers) */}
              {entry.isTollFree && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                    Toll-Free Verification
                  </h4>
                  <div className="space-y-1">
                    <DetailStatusBadge label="Status" value={entry.smsTollfreeVerifyStatus} />
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Verification SID:</span>
                      <span className="font-mono text-[10px]">
                        {entry.smsTollfreeVerifySid || "N/A"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Compliance & User Info */}
              <div className="space-y-2">
                <h4 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                  User & Compliance
                </h4>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">User:</span>
                    <span className="font-medium">{entry.user.name || "N/A"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Email:</span>
                    <span>{entry.user.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Business:</span>
                    <span>{entry.businessName || "N/A"}</span>
                  </div>
                  <DetailStatusBadge label="Compliance" value={entry.smsComplianceStatus} />
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Updated:</span>
                    <span>{formatDate(entry.updatedAt)}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
