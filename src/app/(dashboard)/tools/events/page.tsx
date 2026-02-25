"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  CalendarDays,
  Plus,
  Search,
  BarChart3,
  Copy,
  Trash2,
  ExternalLink,
  MoreVertical,
  Eye,
  ToggleLeft,
  ToggleRight,
  Send,
  MapPin,
  Globe,
  Users,
  DollarSign,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EVENT_STATUS_CONFIG, type EventData, type EventStatus } from "@/types/event";

export default function EventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 0 });
  const [toast, setToast] = useState("");
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "12", page: String(page) });
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      const res = await fetch(`/api/events?${params}`);
      const json = await res.json();
      if (json.success) {
        setEvents(json.data || []);
        if (json.pagination) setPagination(json.pagination);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, page]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleCopyLink = (slug: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/event/${slug}`);
    setToast("Link copied to clipboard!");
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "ACTIVE" ? "CLOSED" : "ACTIVE";
    try {
      const res = await fetch(`/api/events/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
        setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, status: newStatus as EventStatus } : e)));
        setToast(`Event ${newStatus === "ACTIVE" ? "activated" : "closed"}`);
      }
    } catch {
      setToast("Failed to update status");
    }
    setOpenMenu(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this event and all its registrations?")) return;
    try {
      const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        setEvents((prev) => prev.filter((e) => e.id !== id));
        setToast("Event deleted");
      }
    } catch {
      setToast("Failed to delete event");
    }
    setOpenMenu(null);
  };

  const totalEvents = pagination.total || events.length;
  const activeEvents = events.filter((e) => e.status === "ACTIVE").length;
  const totalRegistrations = events.reduce((sum, e) => sum + e.registrationCount, 0);
  const totalRevenue = events.reduce((sum, e) => sum + (e.totalRevenueCents || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Events</h1>
          <p className="text-muted-foreground text-sm">Create and manage events and registrations</p>
        </div>
        <Link href="/tools/events/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> New Event
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border border-border p-4 flex items-center gap-3">
          <CalendarDays className="h-5 w-5 text-emerald-500" />
          <div>
            <p className="text-xl font-bold">{totalEvents}</p>
            <p className="text-xs text-muted-foreground">Total Events</p>
          </div>
        </div>
        <div className="bg-card rounded-lg border border-border p-4 flex items-center gap-3">
          <div className="h-5 w-5 rounded-full bg-green-500/20 flex items-center justify-center">
            <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
          </div>
          <div>
            <p className="text-xl font-bold">{activeEvents}</p>
            <p className="text-xs text-muted-foreground">Active Events</p>
          </div>
        </div>
        <div className="bg-card rounded-lg border border-border p-4 flex items-center gap-3">
          <Users className="h-5 w-5 text-blue-500" />
          <div>
            <p className="text-xl font-bold">{totalRegistrations}</p>
            <p className="text-xs text-muted-foreground">Total Registrations</p>
          </div>
        </div>
        <div className="bg-card rounded-lg border border-border p-4 flex items-center gap-3">
          <DollarSign className="h-5 w-5 text-amber-500" />
          <div>
            <p className="text-xl font-bold">${(totalRevenue / 100).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Revenue</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1.5">
          {[
            { value: "", label: "All" },
            { value: "DRAFT", label: "Draft" },
            { value: "ACTIVE", label: "Active" },
            { value: "CLOSED", label: "Closed" },
            { value: "CANCELLED", label: "Cancelled" },
          ].map((s) => (
            <Button key={s.value} variant={statusFilter === s.value ? "default" : "outline"} size="sm" onClick={() => { setStatusFilter(s.value); setPage(1); }} className="text-xs">
              {s.label}
            </Button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="relative max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search events..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-8 h-9 text-sm" />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-lg p-5 animate-pulse">
              <div className="h-5 bg-muted rounded w-3/4 mb-3" />
              <div className="h-4 bg-muted rounded w-1/2 mb-4" />
              <div className="h-3 bg-muted rounded w-full" />
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <CalendarDays className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No events yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Create your first event to start managing registrations</p>
          <Link href="/tools/events/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Create Event
            </Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map((event) => {
              const statusCfg = EVENT_STATUS_CONFIG[event.status as EventStatus] || EVENT_STATUS_CONFIG.DRAFT;
              return (
                <div key={event.id} className="bg-card border border-border rounded-lg hover:shadow-md transition-shadow overflow-hidden">
                  {event.coverImageUrl && (
                    <Image src={event.coverImageUrl} alt="" width={400} height={200} className="w-full h-32 object-cover" />
                  )}
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <Link href={`/tools/events/${event.id}`} className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate hover:text-blue-600 transition-colors">{event.title}</h3>
                      </Link>
                      <div className="relative ml-2">
                        <button onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === event.id ? null : event.id); }} className="p-1 rounded-md hover:bg-muted">
                          <MoreVertical className="h-4 w-4 text-muted-foreground" />
                        </button>
                        {openMenu === event.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                            <div className="absolute right-0 top-8 z-20 bg-card border border-border rounded-lg shadow-lg py-1 w-44">
                              <button onClick={() => { router.push(`/tools/events/${event.id}`); setOpenMenu(null); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted">
                                <Eye className="h-3.5 w-3.5" /> View
                              </button>
                              <button onClick={() => handleCopyLink(event.slug)} className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted">
                                <Copy className="h-3.5 w-3.5" /> Copy Link
                              </button>
                              <button onClick={() => { window.open(`/event/${event.slug}`, "_blank"); setOpenMenu(null); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted">
                                <ExternalLink className="h-3.5 w-3.5" /> Open Public Page
                              </button>
                              <button onClick={() => handleToggleStatus(event.id, event.status)} className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted">
                                {event.status === "ACTIVE" ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                                {event.status === "ACTIVE" ? "Close" : "Activate"}
                              </button>
                              <button onClick={() => handleDelete(event.id)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20">
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-3 ${statusCfg.color}`}>
                      {statusCfg.label}
                    </span>

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(event.eventDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                      {event.isOnline ? (
                        <>
                          <Globe className="h-3 w-3" />
                          <span>Online</span>
                        </>
                      ) : (
                        <>
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{event.venueName || "Venue TBD"}</span>
                        </>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" /> {event.registrationCount} registrations
                      </span>
                      {event.ticketType === "paid" && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" /> ${((event.totalRevenueCents || 0) / 100).toFixed(2)}
                        </span>
                      )}
                      {event.sendCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Send className="h-3 w-3" /> Sent {event.sendCount}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-border px-5 py-3 flex items-center gap-2">
                    <Link href={`/tools/events/${event.id}`} className="text-xs text-blue-600 hover:underline flex-1">
                      View Details
                    </Link>
                    <button onClick={() => handleCopyLink(event.slug)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                      <Copy className="h-3 w-3" /> Copy Link
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {pagination.pages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= pagination.pages} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm animate-in fade-in slide-in-from-bottom-5">
          {toast}
        </div>
      )}
    </div>
  );
}
