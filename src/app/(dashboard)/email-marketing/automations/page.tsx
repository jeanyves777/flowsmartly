"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Zap,
  Plus,
  Cake,
  Calendar,
  UserPlus,
  Clock,
  BarChart3,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Settings,
  Star,
  Gift,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils/cn";

type AutomationType = "BIRTHDAY" | "HOLIDAY" | "WELCOME" | "RE_ENGAGEMENT" | "CUSTOM";

interface ContactList {
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
  campaignType: "EMAIL" | "SMS";
  subject?: string;
  content?: string;
  sendTime?: string;
  daysOffset?: number;
  timezone?: string;
  contactListId?: string;
  contactList?: ContactList;
  totalSent: number;
  lastTriggered?: string;
  logsCount: number;
  createdAt: string;
  updatedAt: string;
}

interface AutomationStats {
  total: number;
  active: number;
  totalSent: number;
}

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

export default function EmailAutomationsPage() {
  const { toast } = useToast();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [stats, setStats] = useState<AutomationStats>({
    total: 0,
    active: 0,
    totalSent: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  const fetchAutomations = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/automations");
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to fetch automations");
      }

      // Filter to EMAIL automations only
      const allAutomations: Automation[] = data.data.automations;
      const emailAutomations = allAutomations.filter(a => a.campaignType === "EMAIL");

      setAutomations(emailAutomations);

      // Recalculate stats from filtered list
      setStats({
        total: emailAutomations.length,
        active: emailAutomations.filter(a => a.enabled).length,
        totalSent: emailAutomations.reduce((sum, a) => sum + a.totalSent, 0),
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load automations",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAutomations();
  }, [fetchAutomations]);

  const handleToggleEnabled = async (automationId: string, currentEnabled: boolean) => {
    const newEnabled = !currentEnabled;

    // Optimistic update
    setAutomations((prev) =>
      prev.map((a) => (a.id === automationId ? { ...a, enabled: newEnabled } : a))
    );
    setStats((prev) => ({
      ...prev,
      active: newEnabled ? prev.active + 1 : prev.active - 1,
    }));
    setTogglingIds((prev) => new Set(prev).add(automationId));

    try {
      const response = await fetch(`/api/automations/${automationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: newEnabled }),
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to update automation");
      }

      toast({
        title: `Automation ${newEnabled ? "enabled" : "disabled"}`,
      });
    } catch (err) {
      // Revert on failure
      setAutomations((prev) =>
        prev.map((a) => (a.id === automationId ? { ...a, enabled: currentEnabled } : a))
      );
      setStats((prev) => ({
        ...prev,
        active: currentEnabled ? prev.active + 1 : prev.active - 1,
      }));
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update automation",
        variant: "destructive",
      });
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(automationId);
        return next;
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return new Intl.NumberFormat().format(num);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 flex flex-col space-y-6 p-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/email-marketing">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              Email Automations
            </h1>
            <p className="text-muted-foreground mt-2">
              Set up automated email messages that send at the right time
            </p>
          </div>
        </div>
        <Button size="lg" asChild>
          <Link href="/email-marketing/automations/create">
            <Plus className="w-4 h-4 mr-2" />
            Create Automation
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center">
                  <Settings className="w-5 h-5 text-brand-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Automations</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.active}</p>
                  <p className="text-xs text-muted-foreground">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatNumber(stats.totalSent)}</p>
                  <p className="text-xs text-muted-foreground">Total Sent</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Automations Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="h-5 w-9 rounded-full" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <div className="flex gap-4 pt-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : automations.length === 0 ? (
        /* Empty State */
        <Card>
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
              <Zap className="w-8 h-8 text-brand-500 opacity-50" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No email automations yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Automations let you send birthday wishes, holiday greetings, welcome messages, and
              more -- all on autopilot via email.
            </p>
            <Button asChild>
              <Link href="/email-marketing/automations/create">
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Automation
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {automations.map((automation, index) => {
            const config = typeConfig[automation.type] || typeConfig.CUSTOM;
            const TypeIcon = config.icon;
            const isToggling = togglingIds.has(automation.id);

            return (
              <motion.div
                key={automation.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card
                  className={cn(
                    "relative group cursor-pointer transition-all hover:shadow-lg",
                    !automation.enabled && "opacity-75"
                  )}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                            config.bgColor
                          )}
                        >
                          <TypeIcon className={cn("w-5 h-5", config.color)} />
                        </div>
                        <div className="min-w-0">
                          <Link href={`/email-marketing/automations/${automation.id}`}>
                            <CardTitle className="text-base truncate hover:text-brand-500 transition-colors">
                              {automation.name}
                            </CardTitle>
                          </Link>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={cn(config.bgColor, config.color, "border-0")}>
                              {config.label}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div
                        className="shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isToggling ? (
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        ) : (
                          <Switch
                            checked={automation.enabled}
                            onCheckedChange={() =>
                              handleToggleEnabled(automation.id, automation.enabled)
                            }
                          />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2 text-sm text-muted-foreground">
                      {/* Send Time and Days Offset */}
                      {(automation.sendTime || automation.daysOffset !== undefined) && (
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">
                            {automation.sendTime && `Sends at ${automation.sendTime}`}
                            {automation.sendTime &&
                              automation.daysOffset !== undefined &&
                              automation.daysOffset !== 0 &&
                              " | "}
                            {automation.daysOffset !== undefined &&
                              automation.daysOffset !== 0 &&
                              `${automation.daysOffset > 0 ? "+" : ""}${automation.daysOffset} day${Math.abs(automation.daysOffset) !== 1 ? "s" : ""}`}
                          </span>
                        </div>
                      )}

                      {/* Contact List */}
                      {automation.contactList && (
                        <div className="flex items-center gap-2">
                          <Gift className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">
                            {automation.contactList.name}{" "}
                            ({formatNumber(automation.contactList.totalCount)} contacts)
                          </span>
                        </div>
                      )}

                      {/* Stats Row */}
                      <div className="flex items-center gap-4 pt-2 border-t mt-3">
                        <div className="flex items-center gap-1.5">
                          <BarChart3 className="w-3.5 h-3.5" />
                          <span className="font-medium text-foreground">
                            {formatNumber(automation.totalSent)}
                          </span>
                          <span>sent</span>
                        </div>
                        {automation.lastTriggered && (
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Last: {formatDate(automation.lastTriggered)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* View Details Link */}
                    <Link
                      href={`/email-marketing/automations/${automation.id}`}
                      className="flex items-center gap-1 text-sm text-brand-500 hover:text-brand-600 font-medium mt-3 transition-colors"
                    >
                      View Details
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
