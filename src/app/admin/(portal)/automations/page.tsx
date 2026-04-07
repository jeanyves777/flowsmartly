"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Zap,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Mail,
  MessageSquare,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface AutomationItem {
  id: string;
  name: string;
  type: string;
  campaignType: string;
  enabled: boolean;
  totalSent: number;
  lastTriggered: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string };
  logCount: number;
}

interface Stats { total: number; active: number; totalSent: number; totalLogs: number; }

export default function AdminAutomationsPage() {
  const [automations, setAutomations] = useState<AutomationItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({ page: currentPage.toString(), limit: "20" });
      if (searchQuery) params.set("search", searchQuery);
      if (typeFilter) params.set("type", typeFilter);

      const res = await fetch(`/api/admin/automations?${params}`);
      const data = await res.json();
      if (data.success) {
        setAutomations(data.data.automations);
        setStats(data.data.stats);
        setTotalPages(data.data.pagination.totalPages);
      }
    } catch (error) {
      console.error("Failed to fetch automations:", error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, typeFilter, currentPage]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Zap className="w-6 h-6" />Automations</h1>
          <p className="text-muted-foreground mt-1">View all user automations and their performance</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchData()}><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Automations</p><p className="text-2xl font-bold">{stats.total}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Active</p><p className="text-2xl font-bold text-green-500">{stats.active}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Messages Sent</p><p className="text-2xl font-bold text-blue-500">{stats.totalSent.toLocaleString()}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Logs</p><p className="text-2xl font-bold text-purple-500">{stats.totalLogs.toLocaleString()}</p></CardContent></Card>
        </div>
      )}

      <Card><CardContent className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search automations..." className="pl-10" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} /></div>
          <select className="px-3 py-2 border rounded-lg bg-background text-sm" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}>
            <option value="">All Types</option>
            <option value="BIRTHDAY">Birthday</option>
            <option value="HOLIDAY">Holiday</option>
            <option value="WELCOME">Welcome</option>
            <option value="RE_ENGAGEMENT">Re-engagement</option>
            <option value="CUSTOM">Custom</option>
          </select>
        </div>
      </CardContent></Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : automations.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground"><Zap className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No automations found</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Name</th>
                    <th className="text-left p-3 font-medium">Owner</th>
                    <th className="text-left p-3 font-medium">Type</th>
                    <th className="text-left p-3 font-medium">Channel</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Sent</th>
                    <th className="text-left p-3 font-medium">Last Triggered</th>
                    <th className="text-left p-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {automations.map((a) => (
                    <tr key={a.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-medium">{a.name}</td>
                      <td className="p-3"><p className="text-xs font-medium">{a.user.name}</p><p className="text-xs text-muted-foreground">{a.user.email}</p></td>
                      <td className="p-3"><Badge variant="outline">{a.type}</Badge></td>
                      <td className="p-3">
                        {a.campaignType === "EMAIL" ? (
                          <Badge className="bg-blue-500/10 text-blue-500"><Mail className="w-3 h-3 mr-1" />Email</Badge>
                        ) : (
                          <Badge className="bg-green-500/10 text-green-500"><MessageSquare className="w-3 h-3 mr-1" />SMS</Badge>
                        )}
                      </td>
                      <td className="p-3">
                        {a.enabled ? (
                          <Badge className="bg-green-500/10 text-green-500 border-green-500/20"><CheckCircle2 className="w-3 h-3 mr-1" />Active</Badge>
                        ) : (
                          <Badge variant="secondary"><XCircle className="w-3 h-3 mr-1" />Disabled</Badge>
                        )}
                      </td>
                      <td className="p-3"><span className="flex items-center gap-1"><Send className="w-3 h-3" />{a.totalSent.toLocaleString()}</span></td>
                      <td className="p-3 text-xs text-muted-foreground">{a.lastTriggered ? new Date(a.lastTriggered).toLocaleDateString() : "Never"}</td>
                      <td className="p-3 text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight className="w-4 h-4" /></Button>
        </div>
      )}
    </div>
  );
}
