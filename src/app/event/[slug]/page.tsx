"use client";

import { use, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import {
  Check,
  Loader2,
  AlertCircle,
  MapPin,
  Globe,
  Clock,
  Users,
  Ticket,
  Calendar,
  ExternalLink,
} from "lucide-react";
import type { DataFormField } from "@/types/data-form";
import type { RegistrationType, TicketType, EventSettings, RsvpResponse } from "@/types/event";

interface BrandInfo {
  name: string;
  logo: string | null;
  iconLogo: string | null;
  colors: { primary?: string; secondary?: string; accent?: string } | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
}

interface EventPageData {
  id: string;
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
  mediaUrls: string[];
  registrationType: RegistrationType;
  registrationFields: DataFormField[];
  capacity: number | null;
  registrationCount: number;
  ticketType: TicketType;
  ticketPrice: number | null;
  ticketName: string | null;
  settings: EventSettings;
  brand: BrandInfo | null;
}

function PublicEventClient({ slug }: { slug: string }) {
  const [eventData, setEventData] = useState<EventPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [ticketCode, setTicketCode] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [rsvpResponse, setRsvpResponse] = useState<RsvpResponse | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});

  // Check for ticket purchase success
  const [ticketSuccess, setTicketSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("ticket") === "success") {
      setTicketSuccess(true);
    }
  }, []);

  useEffect(() => {
    fetch(`/api/events/public/${slug}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setEventData(json.data);
        else setError(json.error?.message || "Event not found");
      })
      .catch(() => setError("Failed to load event"))
      .finally(() => setLoading(false));
  }, [slug]);

  const primaryColor = eventData?.brand?.colors?.primary || "#6366f1";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventData) return;

    if (!name.trim() || !email.trim()) {
      alert("Name and email are required");
      return;
    }

    // For paid booking, redirect to purchase
    if (eventData.registrationType === "booking" && eventData.ticketType === "paid") {
      setSubmitting(true);
      try {
        const res = await fetch(`/api/events/${eventData.id}/purchase`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), email: email.trim(), phone: phone.trim() || undefined }),
        });
        const json = await res.json();
        if (json.success && json.data?.checkoutUrl) {
          window.location.href = json.data.checkoutUrl;
        } else {
          alert(json.error?.message || "Failed to create checkout");
          setSubmitting(false);
        }
      } catch {
        alert("Failed to process payment");
        setSubmitting(false);
      }
      return;
    }

    // For RSVP, require response
    if (eventData.registrationType === "rsvp" && !rsvpResponse) {
      alert("Please select your RSVP response");
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
      };

      if (eventData.registrationType === "rsvp") {
        body.rsvpResponse = rsvpResponse;
      } else if (eventData.registrationType === "form") {
        body.formData = formData;
      }

      const res = await fetch(`/api/events/public/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        setSubmitted(true);
        setTicketCode(json.data?.ticketCode || null);
      } else {
        alert(json.error?.message || "Registration failed");
      }
    } catch {
      alert("Failed to register. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Event Unavailable</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!eventData) return null;

  const eventDate = new Date(eventData.eventDate);
  const spotsLeft = eventData.capacity ? eventData.capacity - eventData.registrationCount : null;
  const isSoldOut = eventData.capacity ? eventData.registrationCount >= eventData.capacity : false;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
      {/* Brand Header */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          {eventData.brand?.logo ? (
            <img src={eventData.brand.logo} alt={eventData.brand.name} className="h-8 object-contain" />
          ) : eventData.brand?.iconLogo ? (
            <img src={eventData.brand.iconLogo} alt={eventData.brand.name} className="h-8 w-8 rounded-lg object-cover" />
          ) : null}
          {eventData.brand?.name && (
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{eventData.brand.name}</span>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {ticketSuccess ? (
            <motion.div key="ticket-success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-16">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
                className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center"
                style={{ backgroundColor: primaryColor + "20" }}
              >
                <Ticket className="h-10 w-10" style={{ color: primaryColor }} />
              </motion.div>
              <h2 className="text-2xl font-bold mb-3">Payment Successful!</h2>
              <p className="text-gray-500 mb-4">Your ticket has been confirmed. Check your email for details.</p>
              <a
                href="/ticket"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold transition-all hover:opacity-90"
                style={{ backgroundColor: primaryColor }}
              >
                <Ticket className="h-5 w-5" /> View Your Digital Ticket
              </a>
            </motion.div>
          ) : submitted ? (
            <motion.div key="thanks" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-16">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
                className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center"
                style={{ backgroundColor: primaryColor + "20" }}
              >
                <Check className="h-10 w-10" style={{ color: primaryColor }} />
              </motion.div>
              <h2 className="text-2xl font-bold mb-3">You&apos;re Registered!</h2>
              <p className="text-gray-500 mb-4">
                {eventData.settings?.thankYouMessage || "Thank you for registering!"}
              </p>
              {ticketCode && (
                <div className="space-y-4 mt-2">
                  <div className="inline-block bg-gray-100 dark:bg-gray-800 rounded-xl px-6 py-4">
                    <p className="text-xs text-gray-500 mb-1">Your Ticket Code</p>
                    <p className="text-2xl font-mono font-bold tracking-wider">{ticketCode}</p>
                  </div>
                  <div>
                    <a
                      href={`/ticket?code=${ticketCode}`}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-medium text-sm transition-all hover:opacity-90"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <Ticket className="h-4 w-4" /> View Digital Ticket
                    </a>
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div key="event" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {/* Cover Image */}
              {eventData.coverImageUrl && (
                <div className="relative w-full h-48 sm:h-64 md:h-80 rounded-2xl overflow-hidden mb-6">
                  <Image
                    src={eventData.coverImageUrl}
                    alt={eventData.title}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                </div>
              )}

              {/* Date Badge + Title */}
              <div className="flex items-start gap-4 mb-6">
                <div className="flex-shrink-0 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 px-3 py-2 text-center min-w-[60px]">
                  <span className="text-xs font-bold text-red-500 uppercase block">
                    {eventDate.toLocaleDateString("en-US", { month: "short" })}
                  </span>
                  <span className="text-2xl font-bold block leading-tight">
                    {eventDate.getDate()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl sm:text-3xl font-bold mb-2">{eventData.title}</h1>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {formatDate(eventData.eventDate)} at {formatTime(eventData.eventDate)}
                    </span>
                    {eventData.endDate && (
                      <span>– {formatTime(eventData.endDate)}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Venue */}
              <div className="flex items-start gap-2 mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                {eventData.isOnline ? (
                  <>
                    <Globe className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Online Event</p>
                      {eventData.onlineUrl && (
                        <a
                          href={eventData.onlineUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-500 hover:underline flex items-center gap-1 mt-1"
                        >
                          Join Link <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <MapPin className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      {eventData.venueName && <p className="font-medium">{eventData.venueName}</p>}
                      {eventData.venueAddress && <p className="text-sm text-gray-500">{eventData.venueAddress}</p>}
                    </div>
                  </>
                )}
              </div>

              {/* Description */}
              {eventData.description && (
                <div className="mb-6">
                  <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{eventData.description}</p>
                </div>
              )}

              {/* Media Gallery */}
              {eventData.mediaUrls.length > 0 && (
                <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {eventData.mediaUrls.map((url, i) => (
                    <div key={i} className="relative aspect-video rounded-lg overflow-hidden">
                      {url.match(/\.(mp4|webm|mov)$/i) ? (
                        <video src={url} className="w-full h-full object-cover" controls />
                      ) : (
                        <Image src={url} alt="" fill className="object-cover" />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Capacity Bar */}
              {eventData.registrationType === "booking" && eventData.settings?.showCapacity && eventData.capacity && (
                <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                      <Users className="h-4 w-4" />
                      {eventData.registrationCount} registered
                    </span>
                    <span className="text-gray-500">{spotsLeft} spots left</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                    <div
                      className="h-2.5 rounded-full transition-all"
                      style={{
                        width: `${Math.min((eventData.registrationCount / eventData.capacity) * 100, 100)}%`,
                        backgroundColor: primaryColor,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Registration Form */}
              {isSoldOut ? (
                <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                  <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="font-semibold text-lg">Event is Sold Out</p>
                  <p className="text-sm text-gray-500">Registration is no longer available</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 space-y-4">
                    <h3 className="font-semibold text-lg mb-2">
                      {eventData.registrationType === "rsvp" ? "RSVP" :
                       eventData.registrationType === "booking" && eventData.ticketType === "paid" ? "Get Tickets" :
                       "Register"}
                    </h3>

                    {/* Name + Email (always shown) */}
                    <div>
                      <label className="block text-sm font-medium mb-1">Name <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name"
                        className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Email <span className="text-red-500">*</span></label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>

                    {/* Phone (for booking) */}
                    {eventData.registrationType === "booking" && (
                      <div>
                        <label className="block text-sm font-medium mb-1">Phone</label>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+1 (555) 000-0000"
                          className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    )}

                    {/* RSVP Buttons */}
                    {eventData.registrationType === "rsvp" && (
                      <div>
                        <label className="block text-sm font-medium mb-2">Your Response <span className="text-red-500">*</span></label>
                        <div className="grid grid-cols-3 gap-2">
                          {([
                            { value: "attending" as const, label: "Attending", color: "border-green-500 bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400" },
                            { value: "maybe" as const, label: "Maybe", color: "border-yellow-500 bg-yellow-50 text-yellow-700 dark:bg-yellow-950/20 dark:text-yellow-400" },
                            { value: "not_attending" as const, label: "Can\u2019t Go", color: "border-red-500 bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400" },
                          ]).map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setRsvpResponse(opt.value)}
                              className={`py-3 px-3 rounded-xl border-2 font-medium text-sm transition-all ${
                                rsvpResponse === opt.value ? opt.color : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Custom Form Fields */}
                    {eventData.registrationType === "form" && eventData.registrationFields.map((field) => (
                      <div key={field.id}>
                        <label className="block text-sm font-medium mb-1">
                          {field.label}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        {field.type === "textarea" ? (
                          <textarea
                            value={formData[field.id] || ""}
                            onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                            placeholder={field.placeholder}
                            rows={3}
                            className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            required={field.required}
                          />
                        ) : field.type === "select" ? (
                          <select
                            value={formData[field.id] || ""}
                            onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            required={field.required}
                          >
                            <option value="">Select...</option>
                            {field.options?.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : field.type === "checkbox" ? (
                          <div className="space-y-2">
                            {field.options?.map((opt) => (
                              <label key={opt} className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={(formData[field.id] || "").split(",").includes(opt)}
                                  onChange={(e) => {
                                    const current = (formData[field.id] || "").split(",").filter(Boolean);
                                    const updated = e.target.checked
                                      ? [...current, opt]
                                      : current.filter((v) => v !== opt);
                                    setFormData({ ...formData, [field.id]: updated.join(",") });
                                  }}
                                  className="rounded"
                                />
                                <span className="text-sm">{opt}</span>
                              </label>
                            ))}
                          </div>
                        ) : field.type === "radio" ? (
                          <div className="space-y-2">
                            {field.options?.map((opt) => (
                              <label key={opt} className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={field.id}
                                  value={opt}
                                  checked={formData[field.id] === opt}
                                  onChange={() => setFormData({ ...formData, [field.id]: opt })}
                                />
                                <span className="text-sm">{opt}</span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <input
                            type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "url" ? "url" : "text"}
                            value={formData[field.id] || ""}
                            onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                            placeholder={field.placeholder}
                            className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            required={field.required}
                          />
                        )}
                      </div>
                    ))}

                    {/* Price Display for Paid Booking */}
                    {eventData.registrationType === "booking" && eventData.ticketType === "paid" && eventData.ticketPrice && (
                      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                        <div>
                          <p className="font-medium">{eventData.ticketName || "Ticket"}</p>
                          <p className="text-sm text-gray-500">Per person</p>
                        </div>
                        <p className="text-2xl font-bold">${(eventData.ticketPrice / 100).toFixed(2)}</p>
                      </div>
                    )}

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-3.5 rounded-xl text-white font-semibold text-base transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {submitting ? (
                        <><Loader2 className="h-5 w-5 animate-spin" /> Processing...</>
                      ) : eventData.registrationType === "booking" && eventData.ticketType === "paid" ? (
                        <><Ticket className="h-5 w-5" /> Buy Ticket — ${((eventData.ticketPrice || 0) / 100).toFixed(2)}</>
                      ) : eventData.registrationType === "rsvp" ? (
                        <><Calendar className="h-5 w-5" /> Submit RSVP</>
                      ) : (
                        <><Check className="h-5 w-5" /> Register</>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 dark:border-gray-800 mt-16">
        {eventData.brand && (eventData.brand.email || eventData.brand.phone || eventData.brand.website || eventData.brand.address) && (
          <div className="max-w-3xl mx-auto px-4 py-6">
            <div className="flex flex-wrap gap-4 justify-center text-sm text-gray-500">
              {eventData.brand.email && (
                <a href={`mailto:${eventData.brand.email}`} className="hover:text-gray-700">{eventData.brand.email}</a>
              )}
              {eventData.brand.phone && (
                <a href={`tel:${eventData.brand.phone}`} className="hover:text-gray-700">{eventData.brand.phone}</a>
              )}
              {eventData.brand.website && (
                <a href={eventData.brand.website} target="_blank" rel="noopener noreferrer" className="hover:text-gray-700">{eventData.brand.website}</a>
              )}
              {eventData.brand.address && <span>{eventData.brand.address}</span>}
            </div>
          </div>
        )}
        <div className="text-center py-4 text-xs text-gray-400">
          Powered by{" "}
          <a href="https://flowsmartly.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">
            FlowSmartly
          </a>
        </div>
      </div>
    </div>
  );
}

export default function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return <PublicEventClient slug={slug} />;
}
