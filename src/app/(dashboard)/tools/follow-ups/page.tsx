"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Plus,
  ClipboardList,
  FileQuestion,
  Search,
  MoreVertical,
  Trash2,
  Edit,
  Archive,
  CheckCircle2,
  Clock,
  Users,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import type { FollowUpData } from "@/types/follow-up";

type FilterType = "ALL" | "TRACKER" | "SURVEY";

export default function FollowUpsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [followUps, setFollowUps] = useState<FollowUpData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("ALL");
  const [search, setSearch] = useState("");
  const [stats, setStats] = useState({ total: 0, active: 0, completed: 0, totalEntries: 0 });

  const fetchFollowUps = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (filter !== "ALL") params.set("type", filter);
      if (search) params.set("search", search);
      params.set("limit", "50");

      const res = await fetch(`/api/follow-ups?${params}`);
      const json = await res.json();

      if (!json.success) throw new Error(json.error?.message || "Failed to fetch");

      setFollowUps(json.data);

      // Calculate stats from data
      const all = json.data as FollowUpData[];
      setStats({
        total: json.pagination?.total || all.length,
        active: all.filter((f: FollowUpData) => f.status === "ACTIVE").length,
        completed: all.filter((f: FollowUpData) => f.status === "COMPLETED").length,
        totalEntries: all.reduce((s: number, f: FollowUpData) => s + f.totalEntries, 0),
      });
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [filter, search, toast]);

  useEffect(() => {
    fetchFollowUps();
  }, [fetchFollowUps]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This will remove all entries and survey data.`)) return;
    try {
      const res = await fetch(`/api/follow-ups/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      toast({ title: "Deleted", description: `"${name}" has been deleted` });
      fetchFollowUps();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/follow-ups/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      fetchFollowUps();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    }
  };

  const statCards = [
    { label: "Total", value: stats.total, icon: ClipboardList, color: "text-blue-500" },
    { label: "Active", value: stats.active, icon: Clock, color: "text-green-500" },
    { label: "Completed", value: stats.completed, icon: CheckCircle2, color: "text-emerald-500" },
    { label: "Total Entries", value: stats.totalEntries, icon: Users, color: "text-violet-500" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Follow-Ups</h1>
          <p className="text-muted-foreground mt-1">
            Track contacts, record interactions, and collect feedback
          </p>
        </div>
        <Button onClick={() => router.push("/tools/follow-ups/new")} className="gap-2">
          <Plus className="h-4 w-4" />
          New Follow-Up
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search follow-ups..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          {(["ALL", "TRACKER", "SURVEY"] as FilterType[]).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {f === "ALL" ? "All" : f === "TRACKER" ? "Trackers" : "Surveys"}
            </Button>
          ))}
        </div>
      </div>

      {/* Follow-Up List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-5 w-3/4 mb-3" />
                <Skeleton className="h-4 w-1/2 mb-4" />
                <Skeleton className="h-3 w-full mb-2" />
                <Skeleton className="h-3 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : followUps.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No follow-ups yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first follow-up to start tracking contacts and collecting feedback
            </p>
            <Button onClick={() => router.push("/tools/follow-ups/new")} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Follow-Up
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {followUps.map((fu, index) => {
            const progress = fu.totalEntries > 0
              ? Math.round((fu.completedEntries / fu.totalEntries) * 100)
              : 0;

            return (
              <motion.div
                key={fu.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <Card
                  className="h-full hover:shadow-md transition-shadow cursor-pointer group"
                  onClick={() => router.push(`/tools/follow-ups/${fu.id}`)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {fu.type === "TRACKER" ? (
                          <ClipboardList className="h-4 w-4 text-blue-500" />
                        ) : (
                          <FileQuestion className="h-4 w-4 text-violet-500" />
                        )}
                        <Badge variant="outline" className="text-[10px]">
                          {fu.type === "TRACKER" ? "Tracker" : "Survey"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge
                          variant={fu.status === "ACTIVE" ? "default" : "secondary"}
                          className={`text-[10px] ${fu.status === "ACTIVE" ? "bg-green-500" : fu.status === "COMPLETED" ? "bg-emerald-500" : ""}`}
                        >
                          {fu.status}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
                              <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onClick={() => router.push(`/tools/follow-ups/${fu.id}`)}>
                              <Edit className="h-4 w-4 mr-2" /> Open
                            </DropdownMenuItem>
                            {fu.status === "ACTIVE" && (
                              <DropdownMenuItem onClick={() => handleStatusChange(fu.id, "COMPLETED")}>
                                <CheckCircle2 className="h-4 w-4 mr-2" /> Mark Completed
                              </DropdownMenuItem>
                            )}
                            {fu.status !== "ARCHIVED" && (
                              <DropdownMenuItem onClick={() => handleStatusChange(fu.id, "ARCHIVED")}>
                                <Archive className="h-4 w-4 mr-2" /> Archive
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDelete(fu.id, fu.name)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    <h3 className="font-semibold text-base mb-1 truncate group-hover:text-brand-500 transition-colors">
                      {fu.name}
                    </h3>
                    {fu.description && (
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                        {fu.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {fu.totalEntries} entries
                      </span>
                      {fu.survey && (
                        <span className="flex items-center gap-1">
                          <BarChart3 className="h-3 w-3" />
                          {fu.survey.responseCount} responses
                        </span>
                      )}
                    </div>

                    {/* Progress bar */}
                    {fu.totalEntries > 0 && (
                      <div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                          <span>Progress</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <p className="text-[10px] text-muted-foreground mt-3">
                      Created {new Date(fu.createdAt).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
