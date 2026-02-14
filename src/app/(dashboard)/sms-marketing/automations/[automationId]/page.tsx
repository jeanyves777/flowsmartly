"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Trash2,
  Loader2,
  MessageSquare,
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
  ChevronDown,
  ChevronUp,
  Users,
  Edit3,
  BarChart3,
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

// SMS segment calculation
function getSmsSegments(text: string): number {
  if (text.length === 0) return 0;
  if (text.length <= 160) return 1;
  return Math.ceil(text.length / 153);
}

// Days offset human label
function getDaysOffsetLabel(offset: number): string {
  if (offset === 0) return "Same day";
  if (offset === 1) return "1 day after";
  if (offset === -1) return "1 day before";
  if (offset > 0) return `${offset} days after`;
  return `${Math.abs(offset)} days before`;
}

export default function SmsAutomationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const automationId = params.automationId as string;
  const { toast } = useToast();

  // State
  const [automation, setAutomation] = useState<Automation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [smsPreviewOpen, setSmsPreviewOpen] = useState(true);

  // Activity tab state
  const [activityFilter, setActivityFilter] = useState<
    "ALL" | "SENT" | "FAILED" | "SKIPPED"
  >("ALL");
  const [activityLogs, setActivityLogs] = useState<AutomationLog[]>([]);
  const [activityOffset, setActivityOffset] = useState(0);
  const [totalLogs, setTotalLogs] = useState(0);
  const [loadingMoreLogs, setLoadingMoreLogs] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [sendTime, setSendTime] = useState("09:00");
  const [daysOffset, setDaysOffset] = useState(0);
  const [timezone, setTimezone] = useState("UTC");
  const [contactListId, setContactListId] = useState("");
  const [enabled, setEnabled] = useState(false);

  // Derived character count
  const characterCount = content.length;
  const segmentCount = getSmsSegments(content);

  // Fetch automation
  const fetchAutomation = useCallback(
    async (logLimit = 50, logOffset = 0) => {
      try {
        setIsLoading(true);
        const response = await fetch(
          `/api/automations/${automationId}?logLimit=${logLimit}&logOffset=${logOffset}`
        );
        const data = await response.json();

        if (!data.success) {
          throw new Error(
            data.error?.message || "Failed to fetch automation"
          );
        }

        const auto = data.data.automation as Automation;
        setAutomation(auto);
        setActivityLogs(auto.logs);
        setTotalLogs(auto.totalLogs);
        setActivityOffset(auto.logs.length);

        // Populate form
        setName(auto.name);
        setContent(auto.content || "");
        setSendTime(auto.sendTime || "09:00");
        setDaysOffset(auto.daysOffset ?? 0);
        setTimezone(auto.timezone || "UTC");
        setContactListId(auto.contactListId || "");
        setEnabled(auto.enabled);
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
    },
    [automationId, toast]
  );

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

  // Load more logs
  const handleLoadMoreLogs = async () => {
    setLoadingMoreLogs(true);
    try {
      const response = await fetch(
        `/api/automations/${automationId}?logLimit=50&logOffset=${activityOffset}`
      );
      const data = await response.json();
      if (data.success) {
        const newLogs = data.data.automation.logs as AutomationLog[];
        setActivityLogs((prev) => [...prev, ...newLogs]);
        setActivityOffset((prev) => prev + newLogs.length);
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to load more logs",
        variant: "destructive",
      });
    } finally {
      setLoadingMoreLogs(false);
    }
  };

  // Save changes
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
          content,
          sendTime,
          daysOffset,
          timezone,
          contactListId: contactListId || null,
          enabled,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(
          data.error?.message || "Failed to update automation"
        );
      }

      toast({ title: "Automation updated successfully" });

      // Update local state with response
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

  // Toggle enabled
  const handleToggleEnabled = async (value: boolean) => {
    setEnabled(value);
    try {
      const response = await fetch(`/api/automations/${automationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: value }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(
          data.error?.message || "Failed to update automation"
        );
      }
      setAutomation((prev) =>
        prev ? { ...prev, enabled: value } : prev
      );
      toast({
        title: value ? "Automation enabled" : "Automation disabled",
      });
    } catch (err) {
      // Revert on failure
      setEnabled(!value);
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to toggle automation",
        variant: "destructive",
      });
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
        throw new Error(
          data.error?.message || "Failed to delete automation"
        );
      }

      toast({ title: "Automation deleted" });
      router.push("/sms-marketing/automations");
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

  // Format dates
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
    })} ${d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  };

  // Filter logs for activity tab
  const filteredLogs =
    activityFilter === "ALL"
      ? activityLogs
      : activityLogs.filter((log) => log.status === activityFilter);

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

        <Skeleton className="h-10 w-80" />

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-[500px] w-full rounded-xl" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
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
            <Link href="/sms-marketing/automations">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to SMS Automations
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const typeInfo = typeConfig[automation.type] || typeConfig.CUSTOM;
  const TypeIcon = typeInfo.icon;

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
            <Link href="/sms-marketing/automations">
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
                  "border-transparent"
                )}
                variant="outline"
              >
                <TypeIcon className="w-3 h-3" />
                {typeInfo.label}
              </Badge>
              <Badge
                className={cn(
                  "gap-1",
                  enabled
                    ? "bg-green-500/10 text-green-600 border-green-500/20"
                    : "bg-muted text-muted-foreground"
                )}
                variant="outline"
              >
                {enabled ? "Active" : "Disabled"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              SMS Automation - Created {formatDate(automation.createdAt)}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5">
            <BarChart3 className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="edit" className="gap-1.5">
            <Edit3 className="w-4 h-4" />
            Edit
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5">
            <Activity className="w-4 h-4" />
            Activity
          </TabsTrigger>
        </TabsList>

        {/* ============ TAB 1: OVERVIEW ============ */}
        <TabsContent value="overview">
          <div className="grid lg:grid-cols-3 gap-6 mt-4">
            {/* Left column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Analytics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="pt-4 pb-4 px-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 rounded-md bg-blue-500/10">
                        <Send className="w-4 h-4 text-blue-500" />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Total Sends
                      </span>
                    </div>
                    <p className="text-2xl font-bold">
                      {automation.stats.totalAttempted.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4 pb-4 px-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 rounded-md bg-green-500/10">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Successful
                      </span>
                    </div>
                    <p className="text-2xl font-bold">
                      {automation.stats.sent.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4 pb-4 px-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 rounded-md bg-red-500/10">
                        <XCircle className="w-4 h-4 text-red-500" />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Failed
                      </span>
                    </div>
                    <p className="text-2xl font-bold">
                      {automation.stats.failed.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4 pb-4 px-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 rounded-md bg-amber-500/10">
                        <AlertCircle className="w-4 h-4 text-amber-500" />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Skipped
                      </span>
                    </div>
                    <p className="text-2xl font-bold">
                      {automation.stats.skipped.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Performance Breakdown */}
              {automation.stats.totalAttempted > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Performance Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Success Rate */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Success Rate
                        </span>
                        <span className="font-medium text-green-600">
                          {automation.stats.successRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-green-500 transition-all duration-500"
                          style={{
                            width: `${automation.stats.successRate}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Failure Rate */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Failure Rate
                        </span>
                        <span className="font-medium text-red-600">
                          {automation.stats.failureRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-red-500 transition-all duration-500"
                          style={{
                            width: `${automation.stats.failureRate}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Skip Rate */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Skip Rate
                        </span>
                        <span className="font-medium text-amber-600">
                          {automation.stats.skipRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-amber-500 transition-all duration-500"
                          style={{
                            width: `${automation.stats.skipRate}%`,
                          }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Automation Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Automation Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">
                        Name
                      </p>
                      <p className="text-sm font-medium">
                        {automation.name}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">
                        Type
                      </p>
                      <Badge
                        className={cn(
                          "gap-1",
                          typeInfo.bgColor,
                          typeInfo.color,
                          "border-transparent"
                        )}
                        variant="outline"
                      >
                        <TypeIcon className="w-3 h-3" />
                        {typeInfo.label}
                      </Badge>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">
                        Campaign Type
                      </p>
                      <Badge
                        className="gap-1 bg-blue-500/10 text-blue-600 border-transparent"
                        variant="outline"
                      >
                        <MessageSquare className="w-3 h-3" />
                        SMS
                      </Badge>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">
                        Send Time
                      </p>
                      <p className="text-sm font-medium">
                        {automation.sendTime || "09:00"}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">
                        Days Offset
                      </p>
                      <p className="text-sm font-medium">
                        {getDaysOffsetLabel(automation.daysOffset)}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">
                        Timezone
                      </p>
                      <p className="text-sm font-medium">
                        {TIMEZONES.find(
                          (tz) => tz.value === automation.timezone
                        )?.label || automation.timezone}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">
                        Contact List
                      </p>
                      <p className="text-sm font-medium">
                        {automation.contactList
                          ? `${automation.contactList.name} (${automation.contactList.totalCount})`
                          : "All contacts"}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">
                        Created
                      </p>
                      <p className="text-sm font-medium">
                        {formatDate(automation.createdAt)}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">
                        Last Updated
                      </p>
                      <p className="text-sm font-medium">
                        {formatDate(automation.updatedAt)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* SMS Preview */}
              <Card>
                <CardHeader>
                  <button
                    onClick={() => setSmsPreviewOpen(!smsPreviewOpen)}
                    className="flex items-center justify-between w-full"
                  >
                    <CardTitle className="text-base flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-green-500" />
                      SMS Preview
                    </CardTitle>
                    {smsPreviewOpen ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                </CardHeader>
                {smsPreviewOpen && (
                  <CardContent>
                    <div className="flex justify-center">
                      {/* Phone Mockup */}
                      <div className="w-[280px] border-[3px] border-foreground/20 rounded-[2.5rem] bg-background overflow-hidden shadow-lg">
                        {/* Notch bar */}
                        <div className="flex items-center justify-center pt-3 pb-2 bg-muted/30">
                          <div className="w-20 h-5 rounded-full bg-foreground/10" />
                        </div>

                        {/* SMS Header */}
                        <div className="px-4 py-2 border-b bg-muted/20">
                          <p className="text-sm font-semibold text-center">
                            SMS Message
                          </p>
                        </div>

                        {/* Message area */}
                        <div className="px-4 py-4 min-h-[200px] bg-background">
                          {automation.content ? (
                            <div className="flex justify-start">
                              <div className="max-w-[85%] px-3 py-2 rounded-2xl rounded-tl-sm bg-green-500 text-white text-sm leading-relaxed whitespace-pre-wrap">
                                {automation.content}
                              </div>
                            </div>
                          ) : (
                            <p className="text-center text-sm text-muted-foreground italic">
                              No message content
                            </p>
                          )}
                        </div>

                        {/* Character count */}
                        <div className="px-4 py-2 border-t bg-muted/20 text-center">
                          <p className="text-xs text-muted-foreground">
                            {automation.content.length} characters
                            {" "}· {getSmsSegments(automation.content)}{" "}
                            segment
                            {getSmsSegments(automation.content) !== 1
                              ? "s"
                              : ""}
                          </p>
                        </div>

                        {/* Bottom bar */}
                        <div className="flex items-center justify-center py-2 bg-muted/30">
                          <div className="w-28 h-1 rounded-full bg-foreground/20" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            </div>

            {/* Right column */}
            <div className="space-y-6">
              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">
                        {enabled ? "Enabled" : "Disabled"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Toggle automation on/off
                      </p>
                    </div>
                    <Switch
                      checked={enabled}
                      onCheckedChange={handleToggleEnabled}
                    />
                  </div>
                  <div className="flex flex-col gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        const tabsTrigger = document.querySelector(
                          '[data-state][value="edit"]'
                        ) as HTMLButtonElement | null;
                        tabsTrigger?.click();
                      }}
                    >
                      <Edit3 className="w-4 h-4 mr-2" />
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
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-500" />
                    Status Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative space-y-4">
                    {/* Created */}
                    <div className="flex items-start gap-3">
                      <div className="mt-1 w-2 h-2 rounded-full bg-green-500 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Created</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(automation.createdAt)}
                        </p>
                      </div>
                    </div>

                    {/* Updated */}
                    <div className="flex items-start gap-3">
                      <div className="mt-1 w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Last Updated</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(automation.updatedAt)}
                        </p>
                      </div>
                    </div>

                    {/* Last Triggered */}
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "mt-1 w-2 h-2 rounded-full shrink-0",
                          automation.lastTriggered
                            ? "bg-purple-500"
                            : "bg-muted-foreground/30"
                        )}
                      />
                      <div>
                        <p className="text-sm font-medium">Last Triggered</p>
                        <p className="text-xs text-muted-foreground">
                          {automation.lastTriggered
                            ? formatDateTime(automation.lastTriggered)
                            : "Never"}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Audience */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-500" />
                    Audience
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {automation.contactList ? (
                    <div>
                      <p className="text-sm font-medium">
                        {automation.contactList.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {automation.contactList.totalCount.toLocaleString()}{" "}
                        contact
                        {automation.contactList.totalCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      All contacts
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Quick Stats Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="w-4 h-4 text-brand-500" />
                    Quick Stats
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between py-1.5 border-b">
                    <span className="text-sm text-muted-foreground">
                      Total Sent
                    </span>
                    <span className="text-sm font-bold">
                      {automation.totalSent.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b">
                    <span className="text-sm text-muted-foreground">
                      Success Rate
                    </span>
                    <span className="text-sm font-bold text-green-600">
                      {automation.stats.totalAttempted > 0
                        ? `${automation.stats.successRate.toFixed(1)}%`
                        : "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-muted-foreground">
                      Last Triggered
                    </span>
                    <span className="text-sm font-medium">
                      {automation.lastTriggered
                        ? formatDateTime(automation.lastTriggered)
                        : "Never"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ============ TAB 2: EDIT ============ */}
        <TabsContent value="edit">
          <div className="space-y-6 mt-4 max-w-3xl">
            {/* General Settings */}
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>
                  Configure the basic settings for this SMS automation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Automation Name</Label>
                  <Input
                    id="edit-name"
                    placeholder="e.g., Birthday SMS Greetings"
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

                {/* Message Body */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="edit-content">Message Body</Label>
                    <div className="text-sm">
                      <span
                        className={
                          characterCount > 160
                            ? "text-yellow-500"
                            : "text-muted-foreground"
                        }
                      >
                        {characterCount}
                      </span>
                      <span className="text-muted-foreground">
                        {" "}
                        characters
                      </span>
                      <span className="ml-1 text-muted-foreground">
                        ({segmentCount} segment
                        {segmentCount !== 1 ? "s" : ""})
                      </span>
                    </div>
                  </div>
                  <Textarea
                    id="edit-content"
                    placeholder="Enter SMS message..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="min-h-[150px]"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Schedule */}
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

            {/* Enable/Disable + Actions */}
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
                    checked={enabled}
                    onCheckedChange={setEnabled}
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

        {/* ============ TAB 3: ACTIVITY ============ */}
        <TabsContent value="activity">
          <div className="space-y-6 mt-4">
            {/* Status Filter */}
            <div className="flex items-center gap-2 flex-wrap">
              {(
                ["ALL", "SENT", "FAILED", "SKIPPED"] as const
              ).map((status) => (
                <Button
                  key={status}
                  variant={activityFilter === status ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActivityFilter(status)}
                  className={cn(
                    activityFilter === status && status === "SENT" &&
                      "bg-green-600 hover:bg-green-700",
                    activityFilter === status && status === "FAILED" &&
                      "bg-red-600 hover:bg-red-700",
                    activityFilter === status && status === "SKIPPED" &&
                      "bg-amber-600 hover:bg-amber-700"
                  )}
                >
                  {status === "ALL" && "All"}
                  {status === "SENT" && (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                      Sent
                    </>
                  )}
                  {status === "FAILED" && (
                    <>
                      <XCircle className="w-3.5 h-3.5 mr-1.5" />
                      Failed
                    </>
                  )}
                  {status === "SKIPPED" && (
                    <>
                      <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
                      Skipped
                    </>
                  )}
                </Button>
              ))}
            </div>

            {/* Log entries */}
            {filteredLogs.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <Clock className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
                    <p className="text-sm font-medium text-muted-foreground">
                      No activity yet
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {activityFilter === "ALL"
                        ? "Logs will appear here once the automation triggers."
                        : `No ${activityFilter.toLowerCase()} entries found.`}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredLogs.map((log) => (
                  <Card key={log.id}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-start gap-3">
                        {/* Status icon */}
                        <div className="mt-0.5">
                          {log.status === "SENT" && (
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                          )}
                          {log.status === "FAILED" && (
                            <XCircle className="w-5 h-5 text-red-500" />
                          )}
                          {log.status === "SKIPPED" && (
                            <AlertCircle className="w-5 h-5 text-yellow-500" />
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
                                  "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
                              )}
                            >
                              {log.status}
                            </Badge>
                            <span className="text-sm font-medium truncate">
                              {log.contactName || "Unknown"}
                            </span>
                          </div>

                          {log.contactPhone && (
                            <p className="text-xs text-muted-foreground">
                              {log.contactPhone}
                            </p>
                          )}

                          {log.error && (
                            <p className="text-xs text-red-500 mt-1 line-clamp-2">
                              {log.error}
                            </p>
                          )}

                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDateTime(log.sentAt)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* Load More button */}
                {activityFilter === "ALL" &&
                  activityOffset < totalLogs && (
                    <div className="flex justify-center pt-2">
                      <Button
                        variant="outline"
                        onClick={handleLoadMoreLogs}
                        disabled={loadingMoreLogs}
                      >
                        {loadingMoreLogs ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          <>Load More</>
                        )}
                      </Button>
                    </div>
                  )}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
