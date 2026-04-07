"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  ExternalLink,
  CheckCircle2,
  Clock,
  MapPin,
  Video,
  Users,
  DollarSign,
  Ticket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface EventItem {
  id: string;
  title: string;
  slug: string;
  status: string;
  eventDate: string;
  endDate: string | null;
  venueName: string | null;
  isOnline: boolean;
  ticketType: string;
  ticketPrice: number | null;
  capacity: number | null;
  registrationCount: number;
  totalRevenueCents: number;
  createdAt: string;
  user: { id: string; name: string; email: string };
  _count: { registrations: number; ticketOrders: number };
}

interface Stats { total: number; active: number; totalRegistrations: number; totalRevenueCents: number; paidEvents: number; }

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export default function AdminEventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({ page: currentPage.toString(), limit: "20" });
      if (searchQuery) params.set("search", searchQuery);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/admin/events?${params}`);
      const data = await res.json();
      if (data.success) {
        setEvents(data.data.events);
        setStats(data.data.stats);
        setTotalPages(data.data.pagination.totalPages);
      }
    } catch (error) {
      console.error("Failed to fetch events:", error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, statusFilter, currentPage]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getStatusBadge = (status: string) => {
    const map: Record<string, { cls: string; label: string }> = {
      ACTIVE: { cls: "bg-green-500/10 text-green-500 border-green-500/20", label: "Active" },
      DRAFT: { cls: "bg-gray-500/10 text-gray-500", label: "Draft" },
      CLOSED: { cls: "bg-yellow-500/10 text-yellow-500", label: "Closed" },
      CANCELLED: { cls: "bg-red-500/10 text-red-500", label: "Cancelled" },
    };
    const s = map[status] || { cls: "", label: status };
    return <Badge className={s.cls}>{s.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Calendar className="w-6 h-6" />Events Management</h1>
          <p className="text-muted-foreground mt-1">View all user events, registrations, and ticket sales</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchData()}><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Events</p><p className="text-2xl font-bold">{stats.total}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Active</p><p className="text-2xl font-bold text-green-500">{stats.active}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Registrations</p><p className="text-2xl font-bold text-blue-500">{stats.totalRegistrations.toLocaleString()}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Ticket Revenue</p><p className="text-2xl font-bold text-green-500">{formatCents(stats.totalRevenueCents)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Paid Events</p><p className="text-2xl font-bold text-purple-500">{stats.paidEvents}</p></CardContent></Card>
        </div>
      )}

      <Card><CardContent className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search events..." className="pl-10" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} /></div>
          <select className="px-3 py-2 border rounded-lg bg-background text-sm" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}>
            <option value="">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="CLOSED">Closed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </CardContent></Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : events.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground"><Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No events found</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Event</th>
                    <th className="text-left p-3 font-medium">Organizer</th>
                    <th className="text-left p-3 font-medium">Date</th>
                    <th className="text-left p-3 font-medium">Location</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Registrations</th>
                    <th className="text-left p-3 font-medium">Revenue</th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((evt) => (
                    <tr key={evt.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="p-3">
                        <p className="font-medium">{evt.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {evt.ticketType === "paid" && <Badge className="bg-green-500/10 text-green-500 text-xs"><Ticket className="w-3 h-3 mr-1" />{formatCents(evt.ticketPrice || 0)}</Badge>}
                          {evt.ticketType === "free" && <Badge variant="secondary" className="text-xs">Free</Badge>}
                        </div>
                      </td>
                      <td className="p-3"><p className="text-xs font-medium">{evt.user.name}</p><p className="text-xs text-muted-foreground">{evt.user.email}</p></td>
                      <td className="p-3 text-xs">{new Date(evt.eventDate).toLocaleDateString()}</td>
                      <td className="p-3 text-xs">
                        {evt.isOnline ? (
                          <span className="flex items-center gap-1 text-blue-500"><Video className="w-3 h-3" />Online</span>
                        ) : (
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{evt.venueName || "TBD"}</span>
                        )}
                      </td>
                      <td className="p-3">{getStatusBadge(evt.status)}</td>
                      <td className="p-3">
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{evt.registrationCount}{evt.capacity ? `/${evt.capacity}` : ""}</span>
                      </td>
                      <td className="p-3 font-medium">{evt.totalRevenueCents > 0 ? formatCents(evt.totalRevenueCents) : "-"}</td>
                      <td className="p-3 text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(`/e/${evt.slug}`, "_blank")} title="Preview">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </td>
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
