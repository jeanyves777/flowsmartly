"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft, ExternalLink, Send, Users, Search,
  Trash2, Copy, CalendarDays, MapPin, Globe, Clock,
  DollarSign, RefreshCw, BarChart3, Ticket, QrCode,
  Mail, MessageSquare, ToggleLeft, ToggleRight, AlertCircle,
  Eye, ChevronDown, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QRCodeDisplay } from "@/components/data-forms/qr-code-display";
import {
  EVENT_STATUS_CONFIG,
  REGISTRATION_STATUS_CONFIG,
  RSVP_CONFIG,
  TICKET_ORDER_STATUS_CONFIG,
  type EventData,
  type EventStatus,
  type EventRegistrationData,
  type TicketOrderData,
} from "@/types/event";

interface ContactList {
  id: string;
  name: string;
  totalCount: number;
}

interface SalesData {
  summary: {
    totalOrders: number;
    totalRevenueCents: number;
    platformFeeCents: number;
    organizerAmountCents: number;
    totalRefundedCents: number;
  };
  orders: TicketOrderData[];
  dailySales: { date: string; count: number; amountCents: number }[];
  pagination: { total: number; pages: number };
}

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "registrations" | "sales" | "share" | "send">("overview");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  // Registrations state
  const [registrations, setRegistrations] = useState<EventRegistrationData[]>([]);
  const [regLoading, setRegLoading] = useState(false);
  const [regPage, setRegPage] = useState(1);
  const [regPagination, setRegPagination] = useState<{ total: number; pages: number }>({ total: 0, pages: 0 });
  const [regSearch, setRegSearch] = useState("");
  const [selectedRegs, setSelectedRegs] = useState<Set<string>>(new Set());

  // Sales state
  const [salesData, setSalesData] = useState<SalesData | null>(null);
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesPage, setSalesPage] = useState(1);
  const [refundingId, setRefundingId] = useState<string | null>(null);

  // Send state
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [sendListId, setSendListId] = useState("");
  const [sendChannel, setSendChannel] = useState<"email" | "sms">("email");
  const [isSending, setIsSending] = useState(false);
  const [emailReady, setEmailReady] = useState(false);
  const [smsReady, setSmsReady] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);

  // Landing page state
  const [creatingLP, setCreatingLP] = useState(false);

  // Brand state
  const [brand, setBrand] = useState<{
    name: string;
    logo: string | null;
    iconLogo: string | null;
    colors: { primary?: string; secondary?: string; accent?: string } | null;
  } | null>(null);

  // Fetch brand
  useEffect(() => {
    fetch("/api/brand")
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data?.brandKit) {
          const bk = json.data.brandKit;
          setBrand({
            name: bk.name,
            logo: bk.logo,
            iconLogo: bk.iconLogo,
            colors: bk.colors || null,
          });
        }
      })
      .catch(() => {});
  }, []);

  // Toast helper
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  // Fetch event
  const fetchEvent = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${id}`);
      const json = await res.json();
      if (json.success) {
        setEvent(json.data);
        if (json.data.contactListId) setSendListId(json.data.contactListId);
      } else {
        router.push("/tools/events");
      }
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  // Fetch registrations
  const fetchRegistrations = useCallback(async () => {
    setRegLoading(true);
    try {
      const p = new URLSearchParams({ page: String(regPage), limit: "25" });
      if (regSearch) p.set("search", regSearch);
      const res = await fetch(`/api/events/${id}/registrations?${p}`);
      const json = await res.json();
      if (json.success && json.data) {
        setRegistrations(json.data);
        setRegPagination(json.pagination || { total: 0, pages: 0 });
      }
    } finally {
      setRegLoading(false);
    }
  }, [id, regPage, regSearch]);

  useEffect(() => {
    if (activeTab === "registrations") fetchRegistrations();
  }, [activeTab, fetchRegistrations]);

  // Fetch sales
  const fetchSales = useCallback(async () => {
    setSalesLoading(true);
    try {
      const p = new URLSearchParams({ page: String(salesPage), limit: "25" });
      const res = await fetch(`/api/events/${id}/sales?${p}`);
      const json = await res.json();
      if (json.success) {
        setSalesData(json.data);
      }
    } finally {
      setSalesLoading(false);
    }
  }, [id, salesPage]);

  useEffect(() => {
    if (activeTab === "sales" && event?.ticketType === "paid") fetchSales();
  }, [activeTab, event?.ticketType, fetchSales]);

  // Fetch contact lists for Send tab
  useEffect(() => {
    if (activeTab === "send" && contactLists.length === 0) {
      fetch("/api/contact-lists?limit=100")
        .then((r) => r.json())
        .then((json) => {
          if (json.success) setContactLists(json.data?.lists || json.data || []);
        })
        .catch(() => {});
    }
  }, [activeTab, contactLists.length]);

  // Fetch marketing config when Send tab becomes active
  useEffect(() => {
    if (activeTab === "send" && !configLoading) {
      setConfigLoading(true);
      fetch("/api/marketing-config")
        .then((r) => r.json())
        .then((json) => {
          if (json.success && json.data?.config) {
            const c = json.data.config;
            setEmailReady(!!(c.emailEnabled || c.emailVerified) && c.emailProvider !== "NONE");
            setSmsReady(!!(c.smsEnabled && c.smsPhoneNumber));
          }
        })
        .catch(() => {})
        .finally(() => setConfigLoading(false));
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-switch channel when selected channel is not ready
  useEffect(() => {
    if (sendChannel === "email" && !emailReady && smsReady) {
      setSendChannel("sms");
    } else if (sendChannel === "sms" && !smsReady && emailReady) {
      setSendChannel("email");
    }
  }, [emailReady, smsReady, sendChannel]);

  // Toggle event status (ACTIVE <-> CLOSED)
  const handleToggleStatus = async () => {
    if (!event) return;
    const newStatus: EventStatus = event.status === "ACTIVE" ? "CLOSED" : "ACTIVE";
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
        setEvent(json.data);
        showToast(`Event ${newStatus === "ACTIVE" ? "activated" : "closed"}`);
      }
    } finally {
      setSaving(false);
    }
  };

  // Bulk delete registrations
  const handleBulkDeleteRegs = async () => {
    if (!confirm(`Delete ${selectedRegs.size} registration(s)?`)) return;
    const res = await fetch(`/api/events/${id}/registrations`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selectedRegs) }),
    });
    const json = await res.json();
    if (json.success) {
      setSelectedRegs(new Set());
      fetchRegistrations();
      fetchEvent();
      showToast(`${json.data?.deleted || selectedRegs.size} registration(s) deleted`);
    }
  };

  // Refund order
  const handleRefund = async (ticketOrderId: string) => {
    if (!confirm("Are you sure you want to refund this order? This action cannot be undone.")) return;
    setRefundingId(ticketOrderId);
    try {
      const res = await fetch(`/api/events/${id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketOrderId }),
      });
      const json = await res.json();
      if (json.success) {
        showToast("Refund processed successfully");
        fetchSales();
        fetchEvent();
      } else {
        showToast(json.error || "Refund failed");
      }
    } finally {
      setRefundingId(null);
    }
  };

  // Create landing page
  const handleCreateLandingPage = async () => {
    setCreatingLP(true);
    try {
      const res = await fetch(`/api/events/${id}/create-landing-page`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        showToast("Landing page created!");
        fetchEvent();
      } else {
        showToast(json.error || "Failed to create landing page");
      }
    } finally {
      setCreatingLP(false);
    }
  };

  // Send event
  const handleSend = async () => {
    if (!sendListId || sendListId === "none") {
      showToast("Select a contact list");
      return;
    }

    setIsSending(true);
    try {
      // Ensure event is active before sending
      if (event?.status !== "ACTIVE") {
        await fetch(`/api/events/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "ACTIVE", contactListId: sendListId }),
        });
      }

      const res = await fetch(`/api/events/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: sendChannel, contactListId: sendListId }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.data?.message || "Event invitation sent!");
        fetchEvent();
      } else {
        showToast(json.error || "Failed to send");
      }
    } finally {
      setIsSending(false);
    }
  };

  // Public event URL
  const eventUrl = event?.slug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/event/${event.slug}`
    : "";

  // Tab configuration
  const tabs = [
    { key: "overview" as const, label: "Overview", icon: Eye },
    { key: "registrations" as const, label: `Registrations (${event?.registrationCount || 0})`, icon: Users },
    ...(event?.ticketType === "paid"
      ? [{ key: "sales" as const, label: "Sales", icon: DollarSign }]
      : []),
    { key: "share" as const, label: "Share", icon: ExternalLink },
    { key: "send" as const, label: "Send", icon: Send },
  ];

  // Format currency helper
  const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  // Loading state
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  // Not found state
  if (!event) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="text-center py-20">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Event not found</h2>
          <p className="text-muted-foreground mb-4">This event may have been deleted or you don&apos;t have access.</p>
          <Link href="/tools/events">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Events
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/tools/events">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">{event.title}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(event.eventDate).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        <span
          className={`text-xs font-medium px-2.5 py-1 rounded-full ${
            EVENT_STATUS_CONFIG[event.status]?.color || EVENT_STATUS_CONFIG.DRAFT.color
          }`}
        >
          {EVENT_STATUS_CONFIG[event.status]?.label || "Draft"}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-border mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {/* ============ OVERVIEW TAB ============ */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Status Toggle */}
            <div className="flex items-center justify-between p-4 bg-card border border-border rounded-xl">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Event Status</span>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    EVENT_STATUS_CONFIG[event.status]?.color || EVENT_STATUS_CONFIG.DRAFT.color
                  }`}
                >
                  {EVENT_STATUS_CONFIG[event.status]?.label || "Draft"}
                </span>
              </div>
              {(event.status === "ACTIVE" || event.status === "CLOSED" || event.status === "DRAFT") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleStatus}
                  disabled={saving}
                >
                  {event.status === "ACTIVE" ? (
                    <>
                      <ToggleRight className="h-4 w-4 mr-1.5" />
                      Close Event
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="h-4 w-4 mr-1.5" />
                      Activate Event
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Stats Grid */}
            <div className={`grid gap-4 ${event.ticketType === "paid" ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2"}`}>
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-blue-500" />
                  <span className="text-xs text-muted-foreground font-medium">Registrations</span>
                </div>
                <p className="text-2xl font-bold">{event.registrationCount}</p>
                {event.capacity && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    of {event.capacity} capacity
                  </p>
                )}
              </div>

              {event.ticketType === "paid" && (
                <>
                  <div className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="h-4 w-4 text-green-500" />
                      <span className="text-xs text-muted-foreground font-medium">Revenue</span>
                    </div>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCents(event.totalRevenueCents)}
                    </p>
                  </div>

                  <div className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <RefreshCw className="h-4 w-4 text-red-500" />
                      <span className="text-xs text-muted-foreground font-medium">Refunded</span>
                    </div>
                    <p className="text-2xl font-bold text-red-600">
                      {formatCents(event.totalRefundedCents)}
                    </p>
                  </div>
                </>
              )}

              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Send className="h-4 w-4 text-purple-500" />
                  <span className="text-xs text-muted-foreground font-medium">Invitations Sent</span>
                </div>
                <p className="text-2xl font-bold">{event.sendCount}</p>
              </div>
            </div>

            {/* Event Info */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                <h3 className="font-semibold text-sm">Event Details</h3>
                <Link href={`/tools/events/${id}/edit`}>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Eye className="h-3.5 w-3.5" />
                    Edit Event
                  </Button>
                </Link>
              </div>

              <div className="p-5 space-y-5">
                {/* Cover Image */}
                {event.coverImageUrl && (
                  <div className="relative w-full h-48 sm:h-64 rounded-lg overflow-hidden bg-muted">
                    <Image
                      src={event.coverImageUrl}
                      alt={event.title}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}

                {/* Title & Description */}
                <div>
                  <h4 className="text-lg font-semibold">{event.title}</h4>
                  {event.description && (
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                      {event.description}
                    </p>
                  )}
                </div>

                {/* Date & Time */}
                <div className="flex items-start gap-3">
                  <CalendarDays className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">
                      {new Date(event.eventDate).toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(event.eventDate).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      {event.endDate && (
                        <>
                          {" "}
                          &mdash;{" "}
                          {new Date(event.endDate).toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </>
                      )}
                    </p>
                    {event.timezone && (
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {event.timezone}
                      </p>
                    )}
                  </div>
                </div>

                {/* Location */}
                <div className="flex items-start gap-3">
                  {event.isOnline ? (
                    <>
                      <Globe className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Online Event</p>
                        {event.onlineUrl && (
                          <a
                            href={event.onlineUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                          >
                            {event.onlineUrl}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div>
                        {event.venueName && (
                          <p className="text-sm font-medium">{event.venueName}</p>
                        )}
                        {event.venueAddress && (
                          <p className="text-sm text-muted-foreground">{event.venueAddress}</p>
                        )}
                        {!event.venueName && !event.venueAddress && (
                          <p className="text-sm text-muted-foreground italic">No venue specified</p>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Registration Type */}
                <div className="flex items-center gap-3">
                  <Ticket className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium capitalize">{event.registrationType}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {event.ticketType === "paid" ? "Paid" : "Free"}
                    </span>
                  </div>
                </div>

                {/* Ticket Info (paid events) */}
                {event.ticketType === "paid" && event.ticketPrice != null && (
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium">
                        {event.ticketName || "General Admission"} &mdash; ${event.ticketPrice.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Platform fee: {event.platformFeePercent}%
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============ REGISTRATIONS TAB ============ */}
        {activeTab === "registrations" && (
          <div className="space-y-4">
            {/* Actions Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div className="flex gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={regSearch}
                    onChange={(e) => {
                      setRegSearch(e.target.value);
                      setRegPage(1);
                    }}
                    placeholder="Search by name or email..."
                    className="pl-9 w-full sm:w-64"
                  />
                </div>
                {selectedRegs.size > 0 && (
                  <Button variant="destructive" size="sm" onClick={handleBulkDeleteRegs}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete ({selectedRegs.size})
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {regPagination.total} total registration{regPagination.total !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Registrations Table */}
            {regLoading ? (
              <div className="text-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : registrations.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground font-medium">No registrations yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Share your event link to start getting registrations.
                </p>
              </div>
            ) : (
              <>
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="px-4 py-3 text-left">
                            <input
                              type="checkbox"
                              checked={selectedRegs.size === registrations.length && registrations.length > 0}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedRegs(new Set(registrations.map((r) => r.id)));
                                } else {
                                  setSelectedRegs(new Set());
                                }
                              }}
                              className="rounded"
                            />
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                          {event.registrationType === "rsvp" && (
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">RSVP</th>
                          )}
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ticket Code</th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {registrations.map((reg) => (
                          <tr key={reg.id} className="hover:bg-muted/50">
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={selectedRegs.has(reg.id)}
                                onChange={(e) => {
                                  const newSet = new Set(selectedRegs);
                                  if (e.target.checked) {
                                    newSet.add(reg.id);
                                  } else {
                                    newSet.delete(reg.id);
                                  }
                                  setSelectedRegs(newSet);
                                }}
                                className="rounded"
                              />
                            </td>
                            <td className="px-4 py-3 font-medium">
                              {reg.name || <span className="text-muted-foreground italic">Anonymous</span>}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {reg.email || <span className="text-muted-foreground">--</span>}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                  REGISTRATION_STATUS_CONFIG[reg.status]?.color || ""
                                }`}
                              >
                                {REGISTRATION_STATUS_CONFIG[reg.status]?.label || reg.status}
                              </span>
                            </td>
                            {event.registrationType === "rsvp" && (
                              <td className="px-4 py-3">
                                {reg.rsvpResponse ? (
                                  <span
                                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                      RSVP_CONFIG[reg.rsvpResponse]?.color || ""
                                    }`}
                                  >
                                    {RSVP_CONFIG[reg.rsvpResponse]?.label || reg.rsvpResponse}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">--</span>
                                )}
                              </td>
                            )}
                            <td className="px-4 py-3">
                              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                {reg.ticketCode}
                              </code>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">
                              {new Date(reg.createdAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pagination */}
                {regPagination.pages > 1 && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Showing {registrations.length} of {regPagination.total} registrations
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRegPage((p) => Math.max(1, p - 1))}
                        disabled={regPage === 1}
                      >
                        Previous
                      </Button>
                      <span className="px-3 py-1.5 text-sm">
                        Page {regPage} of {regPagination.pages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRegPage((p) => Math.min(regPagination.pages, p + 1))}
                        disabled={regPage === regPagination.pages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ============ SALES TAB ============ */}
        {activeTab === "sales" && event.ticketType === "paid" && (
          <div className="space-y-6">
            {salesLoading && !salesData ? (
              <div className="text-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : salesData ? (
              <>
                {/* Revenue Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="h-4 w-4 text-green-500" />
                      <span className="text-xs text-muted-foreground font-medium">Total Sales</span>
                    </div>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCents(salesData.summary.totalRevenueCents)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {salesData.summary.totalOrders} order{salesData.summary.totalOrders !== 1 ? "s" : ""}
                    </p>
                  </div>

                  <div className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground font-medium">Platform Fee</span>
                    </div>
                    <p className="text-2xl font-bold">
                      {formatCents(salesData.summary.platformFeeCents)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{event.platformFeePercent}%</p>
                  </div>

                  <div className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Ticket className="h-4 w-4 text-blue-500" />
                      <span className="text-xs text-muted-foreground font-medium">Net to You</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-600">
                      {formatCents(salesData.summary.organizerAmountCents)}
                    </p>
                  </div>

                  <div className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <RefreshCw className="h-4 w-4 text-red-500" />
                      <span className="text-xs text-muted-foreground font-medium">Refunded</span>
                    </div>
                    <p className="text-2xl font-bold text-red-600">
                      {formatCents(salesData.summary.totalRefundedCents)}
                    </p>
                  </div>
                </div>

                {/* Payout Button */}
                <div className="flex justify-end">
                  <Link href="/earnings">
                    <Button variant="outline" className="gap-2">
                      <DollarSign className="h-4 w-4" />
                      Request Payout
                    </Button>
                  </Link>
                </div>

                {/* Orders Table */}
                {salesData.orders.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
                    <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground font-medium">No orders yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Orders will appear here when attendees purchase tickets.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="bg-card border border-border rounded-xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border bg-muted/50">
                              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Buyer</th>
                              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Amount</th>
                              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {salesData.orders.map((order) => (
                              <tr key={order.id} className="hover:bg-muted/50">
                                <td className="px-4 py-3 font-medium">{order.buyerName}</td>
                                <td className="px-4 py-3 text-muted-foreground">{order.buyerEmail}</td>
                                <td className="px-4 py-3 font-medium">{formatCents(order.amountCents)}</td>
                                <td className="px-4 py-3">
                                  <span
                                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                      TICKET_ORDER_STATUS_CONFIG[order.status]?.color || ""
                                    }`}
                                  >
                                    {TICKET_ORDER_STATUS_CONFIG[order.status]?.label || order.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-muted-foreground text-xs">
                                  {new Date(order.createdAt).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </td>
                                <td className="px-4 py-3">
                                  {order.status === "COMPLETED" && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleRefund(order.id)}
                                      disabled={refundingId === order.id}
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                                    >
                                      {refundingId === order.id ? (
                                        <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" />
                                      ) : (
                                        <RefreshCw className="h-3.5 w-3.5 mr-1" />
                                      )}
                                      Refund
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Sales Pagination */}
                    {salesData.pagination.pages > 1 && (
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          Showing {salesData.orders.length} of {salesData.pagination.total} orders
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSalesPage((p) => Math.max(1, p - 1))}
                            disabled={salesPage === 1}
                          >
                            Previous
                          </Button>
                          <span className="px-3 py-1.5 text-sm">
                            Page {salesPage} of {salesData.pagination.pages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSalesPage((p) => Math.min(salesData.pagination.pages, p + 1))}
                            disabled={salesPage === salesData.pagination.pages}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
                <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No sales data available</p>
              </div>
            )}
          </div>
        )}

        {/* ============ SHARE TAB ============ */}
        {activeTab === "share" && (
          <div className="max-w-lg mx-auto space-y-8">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Share Your Event</h3>
              <p className="text-sm text-muted-foreground">
                Share this link or QR code to get registrations
              </p>
            </div>

            {/* Public URL */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Public Event URL</label>
              <div className="flex items-center gap-2 bg-muted rounded-lg p-2 border border-border">
                <input
                  readOnly
                  value={eventUrl}
                  className="flex-1 bg-transparent text-sm truncate outline-none px-2"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(eventUrl);
                    showToast("Link copied!");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* QR Code */}
            {eventUrl && (
              <QRCodeDisplay
                url={eventUrl}
                title={event?.title}
                callToAction="SCAN TO REGISTER"
                brand={brand || undefined}
              />
            )}

            {/* Embed Code */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Embed Code</label>
              <textarea
                readOnly
                rows={3}
                className="w-full text-xs font-mono bg-muted border border-border rounded-lg p-3"
                value={`<iframe src="${eventUrl}" width="100%" height="800" frameborder="0"></iframe>`}
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              />
            </div>

            {/* Landing Page */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Landing Page</label>
              {event.landingPageId ? (
                <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">
                      Landing page created
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                      Your event has a dedicated landing page.
                    </p>
                  </div>
                  <Link href={`/tools/landing-pages`}>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <ExternalLink className="h-3.5 w-3.5" />
                      View
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="p-4 bg-muted border border-border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-3">
                    Create a dedicated landing page for your event to maximize registrations.
                  </p>
                  <Button
                    onClick={handleCreateLandingPage}
                    disabled={creatingLP}
                    variant="outline"
                    className="gap-2"
                  >
                    {creatingLP ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <QrCode className="h-4 w-4" />
                    )}
                    {creatingLP ? "Creating..." : "Create Landing Page"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============ SEND TAB ============ */}
        {activeTab === "send" && (
          <div className="max-w-lg space-y-6">
            {/* Contact List Selector */}
            <div>
              <label className="block text-sm font-medium mb-1.5">Contact List</label>
              <select
                value={sendListId}
                onChange={(e) => setSendListId(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              >
                <option value="">Select a contact list...</option>
                {contactLists.map((cl) => (
                  <option key={cl.id} value={cl.id}>
                    {cl.name} ({cl.totalCount} contacts)
                  </option>
                ))}
              </select>
            </div>

            {/* Channel Toggle */}
            <div>
              <label className="block text-sm font-medium mb-2">Channel</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <button
                    onClick={() => {
                      if (emailReady) setSendChannel("email");
                    }}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all w-full ${
                      !emailReady
                        ? "opacity-50 cursor-not-allowed border-border"
                        : sendChannel === "email"
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                          : "border-border hover:border-blue-200"
                    }`}
                  >
                    <Mail
                      className={`h-6 w-6 ${
                        sendChannel === "email" && emailReady ? "text-blue-500" : "text-muted-foreground"
                      }`}
                    />
                    <span className="text-sm font-medium">Email</span>
                    <span className="text-xs text-muted-foreground">Send via email marketing</span>
                  </button>
                  {!emailReady && !configLoading && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">
                      Email not configured.{" "}
                      <Link
                        href="/settings/marketing"
                        className="underline font-medium hover:text-amber-700 dark:hover:text-amber-300"
                      >
                        Go to Settings &gt; Marketing
                      </Link>{" "}
                      to set up.
                    </p>
                  )}
                </div>
                <div>
                  <button
                    onClick={() => {
                      if (smsReady) setSendChannel("sms");
                    }}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all w-full ${
                      !smsReady
                        ? "opacity-50 cursor-not-allowed border-border"
                        : sendChannel === "sms"
                          ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                          : "border-border hover:border-green-200"
                    }`}
                  >
                    <MessageSquare
                      className={`h-6 w-6 ${
                        sendChannel === "sms" && smsReady ? "text-green-500" : "text-muted-foreground"
                      }`}
                    />
                    <span className="text-sm font-medium">SMS</span>
                    <span className="text-xs text-muted-foreground">Send via text message</span>
                  </button>
                  {!smsReady && !configLoading && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">
                      SMS not configured.{" "}
                      <Link
                        href="/settings"
                        className="underline font-medium hover:text-amber-700 dark:hover:text-amber-300"
                      >
                        Go to Settings &gt; SMS
                      </Link>{" "}
                      to set up.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Event Link Preview */}
            {event.slug && (
              <div className="p-3 rounded-lg bg-muted border border-border">
                <p className="text-xs text-muted-foreground mb-1">Event link that will be sent:</p>
                <code className="text-xs break-all">{eventUrl}</code>
              </div>
            )}

            {/* Send Count + Last Sent */}
            {(event.sendCount > 0 || event.lastSentAt) && (
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {event.sendCount > 0 && <span>Total sent: {event.sendCount}</span>}
                {event.lastSentAt && (
                  <span>Last sent: {new Date(event.lastSentAt).toLocaleString()}</span>
                )}
              </div>
            )}

            {/* Send Button */}
            <Button
              onClick={handleSend}
              disabled={
                isSending ||
                !sendListId ||
                (sendChannel === "email" && !emailReady) ||
                (sendChannel === "sms" && !smsReady)
              }
              className="w-full"
            >
              {isSending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {isSending ? "Sending..." : `Send via ${sendChannel === "email" ? "Email" : "SMS"}`}
            </Button>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
