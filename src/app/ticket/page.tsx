"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  Ticket,
  Search,
  Loader2,
  AlertCircle,
  MapPin,
  Globe,
  Clock,
  Calendar,
  Download,
  QrCode,
  User,
  Mail,
  Check,
  ExternalLink,
} from "lucide-react";
import type { TicketStyle } from "@/types/event";

interface TicketData {
  ticket: {
    code: string;
    name: string | null;
    email: string | null;
    status: string;
    rsvpResponse: string | null;
    createdAt: string;
  };
  event: {
    title: string;
    description: string | null;
    eventDate: string;
    endDate: string | null;
    timezone: string;
    venueName: string | null;
    venueAddress: string | null;
    isOnline: boolean;
    onlineUrl: string | null;
    coverImageUrl: string | null;
    ticketType: string;
    ticketPrice: number | null;
    ticketName: string | null;
    ticketStyle: TicketStyle;
    slug: string;
  };
  brand: {
    name: string;
    logo: string | null;
    iconLogo: string | null;
    colors: { primary?: string; secondary?: string; accent?: string } | null;
  } | null;
}

function TicketLookupContent() {
  const searchParams = useSearchParams();
  const initialCode = searchParams.get("code") || "";

  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticketData, setTicketData] = useState<TicketData | null>(null);
  const ticketRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialCode) {
      lookupTicket(initialCode);
    }
  }, [initialCode]);

  const lookupTicket = async (ticketCode: string) => {
    if (!ticketCode.trim()) return;
    setLoading(true);
    setError(null);
    setTicketData(null);

    try {
      const res = await fetch(`/api/events/ticket/${encodeURIComponent(ticketCode.trim().toUpperCase())}`);
      const json = await res.json();
      if (json.success) {
        setTicketData(json.data);
      } else {
        setError(json.error?.message || "Ticket not found");
      }
    } catch {
      setError("Failed to look up ticket. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    lookupTicket(code);
  };

  const handleDownload = async () => {
    if (!ticketRef.current) return;
    // Use html2canvas dynamically
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(ticketRef.current, {
        scale: 2,
        backgroundColor: null,
        useCORS: true,
      });
      const link = document.createElement("a");
      link.download = `ticket-${ticketData?.ticket.code || "download"}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      // Fallback: print
      window.print();
    }
  };

  const primaryColor = ticketData?.brand?.colors?.primary || "#6366f1";
  const style = ticketData?.event.ticketStyle || "classic";

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  // QR Code URL (self-referencing ticket page)
  const qrUrl = ticketData ? `${window.location.origin}/ticket?code=${ticketData.ticket.code}` : "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-2xl mx-auto px-4 py-6 text-center">
          <Ticket className="h-8 w-8 mx-auto mb-2 text-indigo-500" />
          <h1 className="text-xl font-bold">View Your Ticket</h1>
          <p className="text-sm text-gray-500">Enter your ticket code to view and download</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Search Form */}
        {!ticketData && (
          <form onSubmit={handleSubmit} className="mb-8">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Enter ticket code (e.g. ABC12345)"
                  className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-lg font-mono tracking-wider focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  maxLength={8}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !code.trim()}
                className="px-6 py-3.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Look Up"}
              </button>
            </div>
          </form>
        )}

        {/* Error */}
        {error && (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="font-semibold text-lg mb-1">Ticket Not Found</p>
            <p className="text-gray-500 text-sm mb-4">{error}</p>
            <button
              onClick={() => { setError(null); setCode(""); }}
              className="text-indigo-600 hover:underline text-sm"
            >
              Try another code
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mx-auto mb-3" />
            <p className="text-gray-500">Looking up your ticket...</p>
          </div>
        )}

        {/* Ticket Display */}
        {ticketData && (
          <div className="space-y-4">
            {/* Download + Back buttons */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => { setTicketData(null); setCode(""); setError(null); }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                &larr; Look up another ticket
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                <Download className="h-4 w-4" /> Download Ticket
              </button>
            </div>

            {/* The Ticket Card */}
            <div ref={ticketRef}>
              {style === "classic" && (
                <ClassicTicket data={ticketData} primaryColor={primaryColor} qrUrl={qrUrl} formatDate={formatDate} formatTime={formatTime} />
              )}
              {style === "modern" && (
                <ModernTicket data={ticketData} primaryColor={primaryColor} qrUrl={qrUrl} formatDate={formatDate} formatTime={formatTime} />
              )}
              {style === "elegant" && (
                <ElegantTicket data={ticketData} primaryColor={primaryColor} qrUrl={qrUrl} formatDate={formatDate} formatTime={formatTime} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center py-6 text-xs text-gray-400">
        Powered by{" "}
        <a href="https://flowsmartly.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">
          FlowSmartly
        </a>
      </div>
    </div>
  );
}

// ─── CLASSIC STYLE ───────────────────────────────────────────
function ClassicTicket({ data, primaryColor, qrUrl, formatDate, formatTime }: {
  data: TicketData; primaryColor: string; qrUrl: string;
  formatDate: (s: string) => string; formatTime: (s: string) => string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
      {/* Header with brand color */}
      <div className="px-6 py-5" style={{ backgroundColor: primaryColor }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {data.brand?.logo ? (
              <img src={data.brand.logo} alt="" className="h-8 object-contain brightness-0 invert" />
            ) : data.brand?.iconLogo ? (
              <img src={data.brand.iconLogo} alt="" className="h-8 w-8 rounded-lg object-cover" />
            ) : null}
            <span className="text-white/90 font-medium text-sm">{data.brand?.name || "Event"}</span>
          </div>
          <div className="flex items-center gap-1.5 text-white/80 text-xs">
            <Ticket className="h-4 w-4" />
            ADMISSION
          </div>
        </div>
      </div>

      {/* Cover image */}
      {data.event.coverImageUrl && (
        <div className="relative h-40 w-full">
          <Image src={data.event.coverImageUrl} alt="" fill className="object-cover" />
        </div>
      )}

      {/* Content */}
      <div className="p-6 space-y-4">
        <h2 className="text-2xl font-bold">{data.event.title}</h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-start gap-2">
            <Calendar className="h-4 w-4 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium">{formatDate(data.event.eventDate)}</p>
              <p className="text-xs text-gray-500">{formatTime(data.event.eventDate)}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            {data.event.isOnline ? (
              <Globe className="h-4 w-4 text-blue-500 mt-0.5" />
            ) : (
              <MapPin className="h-4 w-4 text-red-500 mt-0.5" />
            )}
            <div>
              <p className="text-sm font-medium">{data.event.isOnline ? "Online Event" : data.event.venueName || "TBA"}</p>
              {data.event.venueAddress && <p className="text-xs text-gray-500">{data.event.venueAddress}</p>}
            </div>
          </div>
        </div>

        {/* Divider with tear effect */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t-2 border-dashed border-gray-200" />
          </div>
          <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-gray-50 rounded-full" />
          <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-gray-50 rounded-full" />
        </div>

        {/* Ticket info */}
        <div className="flex items-center justify-between pt-2">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-gray-400" />
              <span className="font-medium">{data.ticket.name || "Guest"}</span>
            </div>
            {data.ticket.email && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Mail className="h-4 w-4 text-gray-400" />
                <span>{data.ticket.email}</span>
              </div>
            )}
            {data.event.ticketType === "paid" && data.event.ticketPrice && (
              <p className="text-sm font-medium" style={{ color: primaryColor }}>
                {data.event.ticketName || "Ticket"} — ${(data.event.ticketPrice / 100).toFixed(2)}
              </p>
            )}
          </div>

          {/* QR Code */}
          <div className="text-center">
            <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center p-1">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`}
                alt="QR Code"
                className="w-full h-full"
              />
            </div>
          </div>
        </div>

        {/* Ticket Code */}
        <div className="text-center pt-2">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Ticket Code</p>
          <p className="text-3xl font-mono font-bold tracking-[0.3em]" style={{ color: primaryColor }}>
            {data.ticket.code}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── MODERN STYLE ────────────────────────────────────────────
function ModernTicket({ data, primaryColor, qrUrl, formatDate, formatTime }: {
  data: TicketData; primaryColor: string; qrUrl: string;
  formatDate: (s: string) => string; formatTime: (s: string) => string;
}) {
  const gradientEnd = data.brand?.colors?.secondary || "#8b5cf6";

  return (
    <div className="rounded-2xl shadow-xl overflow-hidden" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${gradientEnd})` }}>
      {/* Top section */}
      <div className="p-6 text-white">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            {data.brand?.logo ? (
              <img src={data.brand.logo} alt="" className="h-7 object-contain brightness-0 invert" />
            ) : null}
            <span className="font-medium text-sm opacity-90">{data.brand?.name}</span>
          </div>
          <span className="text-xs bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full font-medium">
            {data.event.ticketType === "paid" ? `$${((data.event.ticketPrice || 0) / 100).toFixed(2)}` : "FREE"}
          </span>
        </div>

        {data.event.coverImageUrl && (
          <div className="relative h-36 w-full rounded-xl overflow-hidden mb-4">
            <Image src={data.event.coverImageUrl} alt="" fill className="object-cover" />
            <div className="absolute inset-0 bg-black/20" />
          </div>
        )}

        <h2 className="text-2xl font-bold mb-3">{data.event.title}</h2>

        <div className="flex flex-wrap gap-4 text-sm opacity-90">
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            {formatDate(data.event.eventDate)} at {formatTime(data.event.eventDate)}
          </span>
          <span className="flex items-center gap-1.5">
            {data.event.isOnline ? <Globe className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
            {data.event.isOnline ? "Online" : data.event.venueName || "TBA"}
          </span>
        </div>
      </div>

      {/* Tear separator */}
      <div className="relative h-4">
        <div className="absolute inset-0 flex items-center px-6">
          <div className="w-full border-t-2 border-dashed border-white/30" />
        </div>
        <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-gray-50 dark:bg-gray-950 rounded-full" />
        <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-gray-50 dark:bg-gray-950 rounded-full" />
      </div>

      {/* Bottom section */}
      <div className="p-6 bg-white dark:bg-gray-900 flex items-center gap-4">
        <div className="flex-1 space-y-1.5">
          <p className="font-semibold text-lg">{data.ticket.name || "Guest"}</p>
          {data.ticket.email && <p className="text-sm text-gray-500">{data.ticket.email}</p>}
          <p className="text-xs text-gray-400 uppercase tracking-wider mt-3">Ticket Code</p>
          <p className="text-2xl font-mono font-bold tracking-[0.2em]" style={{ color: primaryColor }}>
            {data.ticket.code}
          </p>
        </div>
        <div className="w-28 h-28 rounded-xl overflow-hidden shadow-lg">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}&color=${primaryColor.replace('#', '')}`}
            alt="QR Code"
            className="w-full h-full"
          />
        </div>
      </div>
    </div>
  );
}

// ─── ELEGANT STYLE ───────────────────────────────────────────
function ElegantTicket({ data, primaryColor, qrUrl, formatDate, formatTime }: {
  data: TicketData; primaryColor: string; qrUrl: string;
  formatDate: (s: string) => string; formatTime: (s: string) => string;
}) {
  return (
    <div className="bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-700">
      {/* Gold accent line */}
      <div className="h-1.5 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400" />

      {/* Header */}
      <div className="px-6 pt-6 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {data.brand?.logo ? (
            <img src={data.brand.logo} alt="" className="h-7 object-contain brightness-0 invert" />
          ) : data.brand?.iconLogo ? (
            <img src={data.brand.iconLogo} alt="" className="h-7 w-7 rounded-lg object-cover" />
          ) : null}
          <span className="text-gray-400 font-medium text-sm">{data.brand?.name}</span>
        </div>
        <div className="flex items-center gap-1.5 text-amber-400 text-xs font-medium tracking-wider uppercase">
          <Ticket className="h-4 w-4" />
          VIP Pass
        </div>
      </div>

      {/* Cover */}
      {data.event.coverImageUrl && (
        <div className="px-6">
          <div className="relative h-40 w-full rounded-xl overflow-hidden">
            <Image src={data.event.coverImageUrl} alt="" fill className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 to-transparent" />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-6 space-y-5">
        <h2 className="text-2xl font-bold text-white">{data.event.title}</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-amber-400/80 uppercase tracking-wider mb-1">Date & Time</p>
            <p className="text-sm text-gray-200">{formatDate(data.event.eventDate)}</p>
            <p className="text-sm text-gray-400">{formatTime(data.event.eventDate)}</p>
          </div>
          <div>
            <p className="text-xs text-amber-400/80 uppercase tracking-wider mb-1">Venue</p>
            <p className="text-sm text-gray-200">{data.event.isOnline ? "Online Event" : data.event.venueName || "TBA"}</p>
            {data.event.venueAddress && <p className="text-sm text-gray-400">{data.event.venueAddress}</p>}
          </div>
        </div>

        {/* Separator */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-700" />
          </div>
          <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-gray-50 dark:bg-gray-950 rounded-full" style={{ background: "var(--background, #030712)" }} />
          <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-gray-50 dark:bg-gray-950 rounded-full" style={{ background: "var(--background, #030712)" }} />
        </div>

        {/* Attendee + QR */}
        <div className="flex items-end justify-between pt-2">
          <div className="space-y-3">
            <div>
              <p className="text-xs text-amber-400/80 uppercase tracking-wider mb-1">Attendee</p>
              <p className="text-lg font-semibold text-white">{data.ticket.name || "Guest"}</p>
              {data.ticket.email && <p className="text-sm text-gray-400">{data.ticket.email}</p>}
            </div>
            {data.event.ticketType === "paid" && data.event.ticketPrice && (
              <div>
                <p className="text-xs text-amber-400/80 uppercase tracking-wider mb-1">Price</p>
                <p className="text-lg font-bold text-amber-400">${(data.event.ticketPrice / 100).toFixed(2)}</p>
              </div>
            )}
          </div>
          <div className="text-center">
            <div className="w-24 h-24 bg-white rounded-lg p-1">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`}
                alt="QR Code"
                className="w-full h-full"
              />
            </div>
          </div>
        </div>

        {/* Ticket Code */}
        <div className="text-center pt-2 pb-1">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Ticket Code</p>
          <p className="text-3xl font-mono font-bold tracking-[0.3em] text-amber-400">
            {data.ticket.code}
          </p>
        </div>
      </div>

      {/* Bottom gold accent */}
      <div className="h-1.5 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400" />
    </div>
  );
}

export default function TicketPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    }>
      <TicketLookupContent />
    </Suspense>
  );
}
