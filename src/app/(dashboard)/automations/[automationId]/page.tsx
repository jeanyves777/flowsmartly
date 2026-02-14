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
  Mail,
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
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils/cn";

// Types
type AutomationType =
  | "BIRTHDAY"
  | "HOLIDAY"
  | "WELCOME"
  | "RE_ENGAGEMENT"
  | "CUSTOM";
type CampaignType = "EMAIL" | "SMS";

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
  campaignType: CampaignType;
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
  logs: AutomationLog[];
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

export default function AutomationDetailPage() {
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

  // Form state
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [sendTime, setSendTime] = useState("09:00");
  const [daysOffset, setDaysOffset] = useState(0);
  const [timezone, setTimezone] = useState("UTC");
  const [contactListId, setContactListId] = useState("");
  const [enabled, setEnabled] = useState(false);

  // Fetch automation
  const fetchAutomation = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/automations/${automationId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to fetch automation");
      }

      const auto = data.data.automation as Automation;
      setAutomation(auto);

      // Populate form
      setName(auto.name);
      setSubject(auto.subject || "");
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
          subject: subject || null,
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
        throw new Error(data.error?.message || "Failed to update automation");
      }

      toast({ title: "Automation updated successfully" });

      // Update local state with response
      setAutomation((prev) =>
        prev
          ? {
              ...prev,
              ...data.data.automation,
              logs: prev.logs,
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
      router.push("/automations");
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
            <Link href="/automations">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Automations
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
            <Link href="/automations">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{automation.name}</h1>
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
            <p className="text-muted-foreground">
              Created {formatDate(automation.createdAt)}
            </p>
          </div>
        </div>
      </div>

      {/* Main content: two columns */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column: Edit form (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          {/* General settings */}
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>
                Configure the basic settings for this automation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Automation Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Birthday Greetings"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {/* Type and Campaign type (non-editable) */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Automation Type</Label>
                  <div className="flex items-center gap-2 h-10 px-3 rounded-md border bg-muted/50">
                    <TypeIcon className={cn("w-4 h-4", typeInfo.color)} />
                    <span className="text-sm font-medium">
                      {typeInfo.label}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Campaign Type</Label>
                  <div className="flex items-center gap-2 h-10 px-3 rounded-md border bg-muted/50">
                    {automation.campaignType === "EMAIL" ? (
                      <Mail className="w-4 h-4 text-blue-500" />
                    ) : (
                      <MessageSquare className="w-4 h-4 text-green-500" />
                    )}
                    <span className="text-sm font-medium">
                      {automation.campaignType}
                    </span>
                  </div>
                </div>
              </div>

              {/* Subject (for EMAIL) */}
              {automation.campaignType === "EMAIL" && (
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject Line</Label>
                  <Input
                    id="subject"
                    placeholder="Enter email subject..."
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>
              )}

              {/* Content */}
              <div className="space-y-2">
                <Label htmlFor="content">
                  {automation.campaignType === "EMAIL"
                    ? "Email Body"
                    : "Message Content"}
                </Label>
                <Textarea
                  id="content"
                  placeholder={
                    automation.campaignType === "EMAIL"
                      ? "Enter email content..."
                      : "Enter SMS message..."
                  }
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[150px]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Schedule settings */}
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
                  <Label htmlFor="sendTime">Send Time</Label>
                  <Input
                    id="sendTime"
                    type="time"
                    value={sendTime}
                    onChange={(e) => setSendTime(e.target.value)}
                  />
                </div>

                {/* Days offset */}
                <div className="space-y-2">
                  <Label htmlFor="daysOffset">Days Offset</Label>
                  <Input
                    id="daysOffset"
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
                  <Label htmlFor="enabled" className="text-base font-medium">
                    Enable Automation
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    When enabled, this automation will trigger automatically
                    based on its schedule.
                  </p>
                </div>
                <Switch
                  id="enabled"
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

        {/* Right column: Activity (1/3 width) */}
        <div className="space-y-6">
          {/* Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-brand-500" />
                Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm text-muted-foreground">
                  Total Sent
                </span>
                <span className="text-lg font-bold">
                  {automation.totalSent.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
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

          {/* Recent logs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="w-5 h-5 text-blue-500" />
                Recent Activity
              </CardTitle>
              <CardDescription>
                Last {automation.logs.length} delivery log
                {automation.logs.length !== 1 ? "s" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {automation.logs.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
                  <p className="text-sm font-medium text-muted-foreground">
                    No activity yet
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Logs will appear here once the automation triggers.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {automation.logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                    >
                      {/* Status icon */}
                      <div className="mt-0.5">
                        {log.status === "SENT" && (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        )}
                        {log.status === "FAILED" && (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                        {log.status === "SKIPPED" && (
                          <AlertCircle className="w-4 h-4 text-yellow-500" />
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
                          <span
                            className="text-xs text-muted-foreground truncate"
                            title={log.contactId}
                          >
                            {log.contactId.slice(0, 8)}...
                          </span>
                        </div>

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
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
