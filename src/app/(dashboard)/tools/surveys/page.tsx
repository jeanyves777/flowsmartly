"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  FileQuestion,
  Plus,
  Search,
  BarChart3,
  Users,
  Send,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SURVEY_STATUS_CONFIG, type SurveyData, type SurveyStatus } from "@/types/survey";

export default function SurveysPage() {
  const router = useRouter();
  const [surveys, setSurveys] = useState<SurveyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const fetchSurveys = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (search) params.set("search", search);
      const res = await fetch(`/api/surveys?${params}`);
      const json = await res.json();
      if (json.success) setSurveys(json.data || []);
    } catch { /* silent */ } finally {
      setIsLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => { fetchSurveys(); }, [fetchSurveys]);

  const totalSurveys = surveys.length;
  const activeSurveys = surveys.filter((s) => s.status === "ACTIVE").length;
  const draftSurveys = surveys.filter((s) => s.status === "DRAFT").length;
  const totalResponses = surveys.reduce((sum, s) => sum + s.responseCount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Surveys</h1>
          <p className="text-muted-foreground text-sm">Create and manage your surveys and feedback forms</p>
        </div>
        <Button onClick={() => router.push("/tools/surveys/new")} className="gap-2">
          <Plus className="h-4 w-4" /> New Survey
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <FileQuestion className="h-5 w-5 text-violet-500" />
            <div>
              <p className="text-xl font-bold">{totalSurveys}</p>
              <p className="text-xs text-muted-foreground">Total Surveys</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-5 w-5 rounded-full bg-green-500/20 flex items-center justify-center">
              <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
            </div>
            <div>
              <p className="text-xl font-bold">{activeSurveys}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-5 w-5 rounded-full bg-gray-500/20 flex items-center justify-center">
              <div className="h-2.5 w-2.5 rounded-full bg-gray-400" />
            </div>
            <div>
              <p className="text-xl font-bold">{draftSurveys}</p>
              <p className="text-xs text-muted-foreground">Drafts</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-xl font-bold">{totalResponses}</p>
              <p className="text-xs text-muted-foreground">Total Responses</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1.5">
          {["ALL", "DRAFT", "ACTIVE", "CLOSED"].map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(s)}
              className="text-xs"
            >
              {s === "ALL" ? "All" : (SURVEY_STATUS_CONFIG[s as SurveyStatus]?.label || s)}
            </Button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="relative max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search surveys..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
      </div>

      {/* Survey List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : surveys.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileQuestion className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="font-semibold text-lg mb-2">No surveys yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Create your first survey to start collecting feedback</p>
            <Button onClick={() => router.push("/tools/surveys/new")} className="gap-2">
              <Plus className="h-4 w-4" /> Create Survey
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {surveys.map((survey) => {
            const statusCfg = SURVEY_STATUS_CONFIG[survey.status as SurveyStatus] || SURVEY_STATUS_CONFIG.DRAFT;
            return (
              <motion.div
                key={survey.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => router.push(`/tools/surveys/${survey.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold truncate">{survey.title}</h3>
                          <Badge className={statusCfg.color}>{statusCfg.label}</Badge>
                        </div>
                        {survey.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1 mb-2">{survey.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <BarChart3 className="h-3 w-3" />
                            {survey.responseCount} responses
                          </span>
                          {survey.sendCount > 0 && (
                            <span className="flex items-center gap-1">
                              <Send className="h-3 w-3" />
                              Sent to {survey.sendCount}
                            </span>
                          )}
                          {survey.contactListName && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {survey.contactListName}
                            </span>
                          )}
                          <span>
                            {new Date(survey.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
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
