"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Trash2,
  Loader2,
  Mail,
  Cake,
  Calendar,
  UserPlus,
  RefreshCw,
  Star,
  Clock,
  Send,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Activity,
  Eye,
  ChevronDown,
  Smartphone,
  Copy,
  Users,
  Edit2,
  BarChart3,
  TrendingUp,
  Power,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils/cn";

// Types
type AutomationType =
  | "BIRTHDAY"
  | "HOLIDAY"
  | "WELCOME"
  | "RE_ENGAGEMENT"
  | "CUSTOM";

interface ContactList {
  id: string;
  name: string;
  totalCount: number;
  activeCount: number;
}

interface AutomationLog {
  id: string;
  contactId: string;
  status: "SENT" | "FAILED" | "SKIPPED";
  error: string | null;
  sentAt: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
}

interface AutomationStats {
  totalAttempted: number;
  sent: number;
  failed: number;
  skipped: number;
  successRate: number;
  failureRate: number;
  skipRate: number;
}

interface AutomationContactList {
  id: string;
  name: string;
  totalCount: number;
}

interface Automation {
  id: string;
  name: string;
  type: AutomationType;
  trigger: Record<string, unknown>;
  enabled: boolean;
  campaignType: string;
  subject: string | null;
  content: string;
  contentHtml: string | null;
  sendTime: string;
  daysOffset: number;
  timezone: string;
  contactListId: string | null;
  contactList: AutomationContactList | null;
  totalSent: number;
  lastTriggered: string | null;
  stats: AutomationStats;
  logs: AutomationLog[];
  totalLogs: number;
  createdAt: string;
  updatedAt: string;
}

// Type config
const typeConfig: Record<
  AutomationType,
  { label: string; icon: React.ElementType; color: string; bgColor: string }
> = {
  BIRTHDAY: {
    label: "Birthday",
    icon: Cake,
    color: "text-pink-500",
    bgColor: "bg-pink-500/10",
  },
  HOLIDAY: {
    label: "Holiday",
    icon: Calendar,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
  },
  WELCOME: {
    label: "Welcome",
    icon: UserPlus,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  RE_ENGAGEMENT: {
    label: "Re-engagement",
    icon: RefreshCw,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
  },
  CUSTOM: {
    label: "Custom",
    icon: Star,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
};

// Common timezones
const TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Paris (CET/CEST)" },
  { value: "Europe/Berlin", label: "Berlin (CET/CEST)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Shanghai", label: "Shanghai (CST)" },
  { value: "Asia/Kolkata", label: "Mumbai (IST)" },
  { value: "Asia/Dubai", label: "Dubai (GST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
  { value: "Africa/Lagos", label: "Lagos (WAT)" },
  { value: "Africa/Johannesburg", label: "Johannesburg (SAST)" },
  { value: "America/Sao_Paulo", label: "Sao Paulo (BRT)" },
];

// Days offset label
function getDaysOffsetLabel(offset: number): string {
  if (offset === 0) return "Same day";
  if (offset === 1) return "1 day after";
  if (offset === -1) return "1 day before";
  if (offset > 1) return `${offset} days after`;
  return `${Math.abs(offset)} days before`;
}

export default function EmailAutomationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const automationId = params.automationId as string;
  const { toast } = useToast();

  // State
  const [automation, setAutomation] = useState<Automation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingEnabled, setIsTogglingEnabled] = useState(false);
  const [isLoadingMoreLogs, setIsLoadingMoreLogs] = useState(false);
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [showPreview, setShowPreview] = useState(false);
  const [activityFilter, setActivityFilter] = useState<string>("ALL");

  // Form state
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [sendTime, setSendTime] = useState("09:00");
  const [daysOffset, setDaysOffset] = useState(0);
  const [timezone, setTimezone] = useState("UTC");
  const [contactListId, setContactListId] = useState("");
  const [formEnabled, setFormEnabled] = useState(false);

  // Ref to track if form has been populated
  const formPopulated = useRef(false);

  // Fetch automation
  const fetchAutomation = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/automations/${automationId}?logLimit=50&logOffset=0`
      );
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to fetch automation");
      }

      const auto = data.data.automation as Automation;
      setAutomation(auto);

      // Populate form only on initial load
      if (!formPopulated.current) {
        setName(auto.name);
        setSubject(auto.subject || "");
        setContent(auto.content || "");
        setSendTime(auto.sendTime || "09:00");
        setDaysOffset(auto.daysOffset ?? 0);
        setTimezone(auto.timezone || "UTC");
        setContactListId(auto.contactListId || "");
        setFormEnabled(auto.enabled);
        formPopulated.current = true;
      }
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to load automation",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [automationId, toast]);

  // Fetch contact lists
  const fetchContactLists = useCallback(async () => {
    try {
      setLoadingLists(true);
      const response = await fetch("/api/contact-lists");
      const data = await response.json();
      if (data.success) {
        setContactLists(data.data.lists);
      }
    } catch (error) {
      console.error("Failed to fetch contact lists:", error);
    } finally {
      setLoadingLists(false);
    }
  }, []);

  useEffect(() => {
    fetchAutomation();
    fetchContactLists();
  }, [fetchAutomation, fetchContactLists]);

  // Toggle enabled (immediate PATCH from Overview)
  const handleToggleEnabled = async (newValue: boolean) => {
    setIsTogglingEnabled(true);
    try {
      const response = await fetch(`/api/automations/${automationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: newValue }),
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to update automation");
      }

      setAutomation((prev) =>
        prev ? { ...prev, enabled: newValue, ...data.data.automation, logs: prev.logs } : prev
      );
      setFormEnabled(newValue);
      toast({
        title: newValue ? "Automation enabled" : "Automation disabled",
      });
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to toggle automation",
        variant: "destructive",
      });
    } finally {
      setIsTogglingEnabled(false);
    }
  };

  // Save changes (Edit tab)
  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/automations/${automationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          subject: subject || null,
          content,
          sendTime,
          daysOffset,
          timezone,
          contactListId: contactListId || null,
          enabled: formEnabled,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to update automation");
      }

      toast({ title: "Automation updated successfully" });

      // Update local state with response, keeping logs
      setAutomation((prev) =>
        prev
          ? {
              ...prev,
              ...data.data.automation,
              logs: prev.logs,
              stats: prev.stats,
              totalLogs: prev.totalLogs,
            }
          : prev
      );
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to save changes",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete automation
  const handleDelete = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this automation? This action cannot be undone."
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/automations/${automationId}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to delete automation");
      }

      toast({ title: "Automation deleted" });
      router.push("/email-marketing/automations");
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to delete automation",
        variant: "destructive",
      });
      setIsDeleting(false);
    }
  };

  // Load more logs
  const handleLoadMoreLogs = async () => {
    if (!automation) return;

    setIsLoadingMoreLogs(true);
    try {
      const currentOffset = automation.logs.length;
      const response = await fetch(
        `/api/automations/${automationId}?logLimit=50&logOffset=${currentOffset}`
      );
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to load more logs");
      }

      const newLogs = data.data.automation.logs as AutomationLog[];
      setAutomation((prev) =>
        prev
          ? {
              ...prev,
              logs: [...prev.logs, ...newLogs],
            }
          : prev
      );
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to load more logs",
        variant: "destructive",
      });
    } finally {
      setIsLoadingMoreLogs(false);
    }
  };

  // Format helpers
  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDateTime = (dateString: string) => {
    const d = new Date(dateString);
    return `${d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })} at ${d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  };

  const formatRelativeTime = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffSec < 60) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDateTime(dateString);
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col space-y-6 pb-8">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <Skeleton className="h-10 w-[300px] rounded-md" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-[200px] w-full rounded-xl" />
            <Skeleton className="h-[300px] w-full rounded-xl" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // Not found
  if (!automation) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
          <h2 className="text-xl font-bold mb-2">Automation Not Found</h2>
          <p className="text-muted-foreground mb-6">
            The automation you are looking for does not exist or has been
            deleted.
          </p>
          <Button asChild>
            <Link href="/email-marketing/automations">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Email Automations
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const typeInfo = typeConfig[automation.type] || typeConfig.CUSTOM;
  const TypeIcon = typeInfo.icon;
  const { stats } = automation;

  // Filtered logs for Activity tab
  const filteredLogs =
    activityFilter === "ALL"
      ? automation.logs
      : automation.logs.filter((log) => log.status === activityFilter);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 flex flex-col space-y-6 pb-8"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/email-marketing/automations">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{automation.name}</h1>
              <Badge
                className={cn(
                  "gap-1",
                  typeInfo.bgColor,
                  typeInfo.color,
                  "border-0"
                )}
                variant="outline"
              >
                <TypeIcon className="w-3 h-3" />
                {typeInfo.label}
              </Badge>
              <Badge
                className={cn(
                  "gap-1",
                  automation.enabled
                    ? "bg-green-500/10 text-green-600 border-green-500/20"
                    : "bg-muted text-muted-foreground"
                )}
                variant="outline"
              >
                {automation.enabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Created {formatDate(automation.createdAt)}
              {automation.lastTriggered &&
                ` \u00B7 Last triggered ${formatRelativeTime(automation.lastTriggered)}`}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-[400px] grid-cols-3">
          <TabsTrigger value="overview" className="gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="edit" className="gap-1.5">
            <Edit2 className="w-3.5 h-3.5" />
            Edit
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5">
            <Activity className="w-3.5 h-3.5" />
            Activity
          </TabsTrigger>
        </TabsList>

        {/* ====================== OVERVIEW TAB ====================== */}
        <TabsContent value="overview" className="mt-6">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left column (col-span-2) */}
            <div className="lg:col-span-2 space-y-6">
              {/* Analytics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  {
                    label: "Total Sends",
                    value: stats.totalAttempted,
                    icon: Send,
                    bg: "bg-blue-500/10",
                    text: "text-blue-500",
                    rate: null,
                  },
                  {
                    label: "Successful",
                    value: stats.sent,
                    icon: CheckCircle2,
                    bg: "bg-green-500/10",
                    text: "text-green-500",
                    rate: stats.successRate,
                  },
                  {
                    label: "Failed",
                    value: stats.failed,
                    icon: XCircle,
                    bg: "bg-red-500/10",
                    text: "text-red-500",
                    rate: stats.failureRate,
                  },
                  {
                    label: "Skipped",
                    value: stats.skipped,
                    icon: AlertCircle,
                    bg: "bg-amber-500/10",
                    text: "text-amber-500",
                    rate: stats.skipRate,
                  },
                ].map((stat) => (
                  <Card key={stat.label}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className={cn(
                            "w-8 h-8 rounded-md flex items-center justify-center",
                            stat.bg
                          )}
                        >
                          <stat.icon className={cn("w-4 h-4", stat.text)} />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {stat.label}
                        </span>
                      </div>
                      <p className="text-2xl font-bold">
                        {stat.value.toLocaleString()}
                      </p>
                      {stat.rate !== null && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {stat.rate}% rate
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Performance Breakdown */}
              {stats.totalAttempted > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <TrendingUp className="w-4 h-4 text-brand-500" />
                      Performance Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      {
                        label: "Success Rate",
                        rate: stats.successRate,
                        count: stats.sent,
                        total: stats.totalAttempted,
                        color: "bg-green-500",
                      },
                      {
                        label: "Failure Rate",
                        rate: stats.failureRate,
                        count: stats.failed,
                        total: stats.totalAttempted,
                        color: "bg-red-500",
                      },
                      {
                        label: "Skip Rate",
                        rate: stats.skipRate,
                        count: stats.skipped,
                        total: stats.totalAttempted,
                        color: "bg-amber-500",
                      },
                    ].map((metric) => (
                      <div key={metric.label}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium">
                            {metric.label}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {metric.count.toLocaleString()} /{" "}
                            {metric.total.toLocaleString()} ({metric.rate}%)
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              metric.color
                            )}
                            style={{
                              width: `${Math.min(metric.rate, 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Automation Details */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Settings className="w-4 h-4 text-brand-500" />
                    Automation Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Automation Name
                      </p>
                      <p className="text-sm font-medium">{automation.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Type
                      </p>
                      <Badge
                        className={cn(
                          "gap-1",
                          typeInfo.bgColor,
                          typeInfo.color,
                          "border-0"
                        )}
                        variant="outline"
                      >
                        <TypeIcon className="w-3 h-3" />
                        {typeInfo.label}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Campaign Type
                      </p>
                      <Badge variant="secondary">
                        <Mail className="w-3 h-3 mr-1" />{" "}
                        {automation.campaignType || "Email"}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Subject Line
                      </p>
                      <p className="text-sm font-medium">
                        {automation.subject || "\u2014"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Send Time
                      </p>
                      <p className="text-sm font-medium">
                        {automation.sendTime || "\u2014"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Days Offset
                      </p>
                      <p className="text-sm font-medium">
                        {getDaysOffsetLabel(automation.daysOffset)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Timezone
                      </p>
                      <p className="text-sm font-medium">
                        {TIMEZONES.find((tz) => tz.value === automation.timezone)
                          ?.label || automation.timezone}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Contact List
                      </p>
                      {automation.contactList ? (
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {automation.contactList.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({automation.contactList.totalCount.toLocaleString()}{" "}
                            contacts)
                          </span>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          All contacts
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Created
                      </p>
                      <p className="text-sm font-medium">
                        {formatDate(automation.createdAt)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Last Updated
                      </p>
                      <p className="text-sm font-medium">
                        {formatDate(automation.updatedAt)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Email Preview (collapsible) */}
              <Card>
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="w-full"
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Eye className="w-4 h-4 text-brand-500" />
                      Email Preview
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 ml-auto text-muted-foreground transition-transform",
                          showPreview && "rotate-180"
                        )}
                      />
                    </CardTitle>
                  </CardHeader>
                </button>
                {showPreview && (
                  <CardContent className="pt-0">
                    {automation.contentHtml ? (
                      <div className="space-y-4">
                        <Tabs defaultValue="desktop">
                          <div className="flex items-center justify-between">
                            <TabsList className="grid w-[200px] grid-cols-2">
                              <TabsTrigger value="desktop">Desktop</TabsTrigger>
                              <TabsTrigger value="mobile">
                                <Smartphone className="w-3.5 h-3.5 mr-1" />
                                Mobile
                              </TabsTrigger>
                            </TabsList>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(
                                  automation.contentHtml || ""
                                );
                                toast({ title: "HTML copied to clipboard" });
                              }}
                            >
                              <Copy className="w-3 h-3 mr-1" />
                              Copy HTML
                            </Button>
                          </div>
                          <TabsContent value="desktop" className="mt-4">
                            <div className="border rounded-lg overflow-hidden">
                              <div className="bg-muted px-4 py-3 border-b">
                                <p className="text-sm font-medium">
                                  {automation.subject || "No subject"}
                                </p>
                              </div>
                              <iframe
                                srcDoc={automation.contentHtml}
                                className="w-full h-[600px] border-0 bg-white"
                                title="Email preview"
                              />
                            </div>
                          </TabsContent>
                          <TabsContent value="mobile" className="mt-4">
                            <div className="flex justify-center">
                              <div className="w-[375px] border-[3px] border-foreground/20 rounded-[2.5rem] overflow-hidden shadow-lg bg-background">
                                {/* Phone notch */}
                                <div className="bg-foreground/10 h-7 flex items-center justify-center">
                                  <div className="w-20 h-4 bg-foreground/20 rounded-full" />
                                </div>
                                {/* Email header */}
                                <div className="bg-muted px-3 py-2 border-b">
                                  <p className="text-xs font-medium truncate">
                                    {automation.subject || "No subject"}
                                  </p>
                                </div>
                                {/* Email body */}
                                <iframe
                                  srcDoc={`<meta name="viewport" content="width=375,initial-scale=1"><style>body{margin:0;overflow-x:hidden}table{max-width:100%!important;width:100%!important}td{word-break:break-word!important}img{max-width:100%!important;height:auto!important}h1{font-size:20px!important}p{font-size:14px!important}</style>${automation.contentHtml}`}
                                  className="w-full h-[500px] border-0 bg-white"
                                  title="Email mobile preview"
                                />
                                {/* Phone bottom bar */}
                                <div className="bg-foreground/10 h-5 flex items-center justify-center">
                                  <div className="w-28 h-1 bg-foreground/30 rounded-full" />
                                </div>
                              </div>
                            </div>
                          </TabsContent>
                        </Tabs>
                      </div>
                    ) : automation.content ? (
                      <div className="mt-2">
                        <p className="text-xs text-muted-foreground mb-2">
                          Plain Text Content
                        </p>
                        <div className="text-sm py-3 px-3 rounded-md border bg-muted/30 whitespace-pre-wrap max-h-[300px] overflow-y-auto font-mono text-xs">
                          {automation.content}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <Eye className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">
                          No email preview available for this automation
                        </p>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            </div>

            {/* Right column */}
            <div className="space-y-6">
              {/* Quick Actions */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Power className="w-4 h-4 text-brand-500" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Enable/Disable toggle */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label
                        htmlFor="overview-enabled"
                        className="text-sm font-medium"
                      >
                        {automation.enabled
                          ? "Automation Active"
                          : "Automation Disabled"}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {automation.enabled
                          ? "Triggers are running on schedule"
                          : "No triggers will fire until enabled"}
                      </p>
                    </div>
                    <Switch
                      id="overview-enabled"
                      checked={automation.enabled}
                      onCheckedChange={handleToggleEnabled}
                      disabled={isTogglingEnabled}
                    />
                  </div>

                  <div className="pt-2 border-t space-y-2">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => setActiveTab("edit")}
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      Edit Automation
                    </Button>
                    <Button
                      variant="destructive"
                      className="w-full justify-start"
                      onClick={handleDelete}
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Automation
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Status Timeline */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="w-4 h-4 text-brand-500" />
                    Status Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                  {/* Created */}
                  <div className="py-3 border-b">
                    <div className="flex items-center gap-3">
                      <div className="relative flex flex-col items-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40" />
                        <div className="w-px h-full bg-border absolute top-3" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Created</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(automation.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Last Updated */}
                  <div className="py-3 border-b">
                    <div className="flex items-center gap-3">
                      <div className="relative flex flex-col items-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                        <div className="w-px h-full bg-border absolute top-3" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Last Updated</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(automation.updatedAt)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Last Triggered */}
                  <div className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Last Triggered</p>
                        {automation.lastTriggered ? (
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(automation.lastTriggered)}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">
                            Never triggered
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Audience */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="w-4 h-4 text-brand-500" />
                    Audience
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {automation.contactList ? (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center">
                        <Users className="w-5 h-5 text-brand-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">
                          {automation.contactList.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {automation.contactList.totalCount.toLocaleString()}{" "}
                          contacts
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                        <Users className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">All contacts</p>
                        <p className="text-xs text-muted-foreground">
                          No specific list assigned
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Stats Summary */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BarChart3 className="w-4 h-4 text-brand-500" />
                    Quick Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-muted-foreground">
                      Total Sent
                    </span>
                    <span className="text-sm font-bold">
                      {stats.totalAttempted.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-muted-foreground">
                      Successful
                    </span>
                    <span className="text-sm font-bold text-green-600">
                      {stats.sent.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-muted-foreground">
                      Failed
                    </span>
                    <span className="text-sm font-bold text-red-600">
                      {stats.failed.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-muted-foreground">
                      Skipped
                    </span>
                    <span className="text-sm font-bold text-amber-600">
                      {stats.skipped.toLocaleString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ====================== EDIT TAB ====================== */}
        <TabsContent value="edit" className="mt-6">
          <div className="max-w-3xl space-y-6">
            {/* General Settings */}
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>
                  Configure the basic settings for this email automation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Automation Name</Label>
                  <Input
                    id="edit-name"
                    placeholder="e.g., Birthday Greetings"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                {/* Type (non-editable) */}
                <div className="space-y-2">
                  <Label>Automation Type</Label>
                  <div className="flex items-center gap-2 h-10 px-3 rounded-md border bg-muted/50">
                    <TypeIcon className={cn("w-4 h-4", typeInfo.color)} />
                    <span className="text-sm font-medium">
                      {typeInfo.label}
                    </span>
                  </div>
                </div>

                {/* Subject Line */}
                <div className="space-y-2">
                  <Label htmlFor="edit-subject">Subject Line</Label>
                  <Input
                    id="edit-subject"
                    placeholder="Enter email subject..."
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>

                {/* Email Body */}
                <div className="space-y-2">
                  <Label htmlFor="edit-content">Email Body</Label>
                  <Textarea
                    id="edit-content"
                    placeholder="Enter email content..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="min-h-[150px]"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Schedule Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-500" />
                  Schedule
                </CardTitle>
                <CardDescription>
                  When should this automation trigger?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid sm:grid-cols-3 gap-4">
                  {/* Send time */}
                  <div className="space-y-2">
                    <Label htmlFor="edit-sendTime">Send Time</Label>
                    <Input
                      id="edit-sendTime"
                      type="time"
                      value={sendTime}
                      onChange={(e) => setSendTime(e.target.value)}
                    />
                  </div>

                  {/* Days offset */}
                  <div className="space-y-2">
                    <Label htmlFor="edit-daysOffset">Days Offset</Label>
                    <Input
                      id="edit-daysOffset"
                      type="number"
                      min={-30}
                      max={30}
                      value={daysOffset}
                      onChange={(e) =>
                        setDaysOffset(parseInt(e.target.value, 10) || 0)
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Negative = before, positive = after the trigger date
                    </p>
                  </div>

                  {/* Timezone */}
                  <div className="space-y-2">
                    <Label>Timezone</Label>
                    <Select value={timezone} onValueChange={setTimezone}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEZONES.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>
                            {tz.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Audience */}
            <Card>
              <CardHeader>
                <CardTitle>Audience</CardTitle>
                <CardDescription>
                  Which contact list should receive this automation?
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingLists ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Select
                    value={contactListId}
                    onValueChange={setContactListId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a contact list" />
                    </SelectTrigger>
                    <SelectContent>
                      {contactLists.map((list) => (
                        <SelectItem key={list.id} value={list.id}>
                          {list.name} ({list.activeCount} active)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="space-y-1">
                    <Label
                      htmlFor="edit-enabled"
                      className="text-base font-medium"
                    >
                      Enable Automation
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      When enabled, this automation will trigger automatically
                      based on its schedule.
                    </p>
                  </div>
                  <Switch
                    id="edit-enabled"
                    checked={formEnabled}
                    onCheckedChange={setFormEnabled}
                  />
                </div>

                <div className="flex items-center gap-3 pt-4 border-t">
                  <Button
                    onClick={handleSave}
                    disabled={isSaving || !name.trim()}
                    className="flex-1 sm:flex-none"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>

                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="flex-1 sm:flex-none"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Automation
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ====================== ACTIVITY TAB ====================== */}
        <TabsContent value="activity" className="mt-6">
          <div className="max-w-3xl space-y-4">
            {/* Filter */}
            <div className="flex items-center gap-3">
              <Label className="text-sm font-medium whitespace-nowrap">
                Filter by status:
              </Label>
              <Select value={activityFilter} onValueChange={setActivityFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="SENT">Sent</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                  <SelectItem value="SKIPPED">Skipped</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Log entries */}
            {filteredLogs.length === 0 ? (
              <div className="text-center py-16">
                <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">
                  No activity logs found
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {activityFilter !== "ALL"
                    ? `No ${activityFilter.toLowerCase()} logs. Try a different filter.`
                    : "Logs will appear here once the automation triggers."}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-4 rounded-lg bg-muted/50"
                  >
                    {/* Status icon */}
                    <div className="mt-0.5">
                      {log.status === "SENT" && (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      )}
                      {log.status === "FAILED" && (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                      {log.status === "SKIPPED" && (
                        <AlertCircle className="w-5 h-5 text-amber-500" />
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            log.status === "SENT" &&
                              "bg-green-500/10 text-green-600 border-green-500/20",
                            log.status === "FAILED" &&
                              "bg-red-500/10 text-red-600 border-red-500/20",
                            log.status === "SKIPPED" &&
                              "bg-amber-500/10 text-amber-600 border-amber-500/20"
                          )}
                        >
                          {log.status}
                        </Badge>
                        <span className="text-sm font-medium truncate">
                          {log.contactName || "Unknown contact"}
                        </span>
                      </div>

                      {log.contactEmail && (
                        <p className="text-xs text-muted-foreground truncate">
                          {log.contactEmail}
                        </p>
                      )}

                      {log.error && (
                        <p className="text-xs text-red-500 mt-1 line-clamp-2">
                          {log.error}
                        </p>
                      )}

                      <p className="text-xs text-muted-foreground mt-1.5">
                        {formatRelativeTime(log.sentAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Load More button */}
            {automation.logs.length < automation.totalLogs && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  onClick={handleLoadMoreLogs}
                  disabled={isLoadingMoreLogs}
                >
                  {isLoadingMoreLogs ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      Load More ({automation.totalLogs - automation.logs.length}{" "}
                      remaining)
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
