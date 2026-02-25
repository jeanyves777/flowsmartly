"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  CalendarDays,
  ArrowLeft,
  Eye,
  Plus,
  Trash2,
  MapPin,
  Globe,
  Users,
  DollarSign,
  Clock,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Ticket,
  Save,
  Send,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MediaUploader } from "@/components/shared/media-uploader";
import {
  FIELD_TYPES,
  type DataFormField,
  type DataFormFieldType,
} from "@/types/data-form";
import {
  REGISTRATION_TYPE_CONFIG,
  TICKET_STYLES,
  type RegistrationType,
  type TicketStyle,
} from "@/types/event";
import Link from "next/link";

// ── Timezone options ────────────────────────────────────────────────────────────

const TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "Eastern Time (US)" },
  { value: "America/Chicago", label: "Central Time (US)" },
  { value: "America/Denver", label: "Mountain Time (US)" },
  { value: "America/Los_Angeles", label: "Pacific Time (US)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
];

// ── Page component ──────────────────────────────────────────────────────────────

export default function NewEventPage() {
  const router = useRouter();

  // ── State ───────────────────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [eventDate, setEventDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [isOnline, setIsOnline] = useState(false);
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [onlineUrl, setOnlineUrl] = useState("");
  const [registrationType, setRegistrationType] =
    useState<RegistrationType>("rsvp");
  const [registrationFields, setRegistrationFields] = useState<
    DataFormField[]
  >([]);
  const [capacity, setCapacity] = useState<number | "">("");
  const [ticketType, setTicketType] = useState<"free" | "paid">("free");
  const [ticketPrice, setTicketPrice] = useState<number | "">("");
  const [ticketName, setTicketName] = useState("");
  const [thankYouMessage, setThankYouMessage] = useState(
    "Thank you for registering!"
  );
  const [showCapacity, setShowCapacity] = useState(false);
  const [ticketStyle, setTicketStyle] = useState<"classic" | "modern" | "elegant">("classic");
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Field builder state
  const [expandedField, setExpandedField] = useState<string | null>(null);
  const [showTypeSelector, setShowTypeSelector] = useState(false);

  // ── Field helpers ───────────────────────────────────────────────────────────

  const genId = () => Math.random().toString(36).slice(2, 9);

  const addField = (type: DataFormFieldType) => {
    const typeLabel =
      FIELD_TYPES.find((t) => t.value === type)?.label || type;
    const newField: DataFormField = {
      id: genId(),
      type,
      label: typeLabel,
      required: false,
      placeholder: "",
      options: ["select", "radio", "checkbox"].includes(type)
        ? ["Option 1", "Option 2"]
        : undefined,
    };
    setRegistrationFields((prev) => [...prev, newField]);
    setExpandedField(newField.id);
    setShowTypeSelector(false);
  };

  const updateField = (id: string, updates: Partial<DataFormField>) => {
    setRegistrationFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  const removeField = (id: string) => {
    setRegistrationFields((prev) => prev.filter((f) => f.id !== id));
  };

  const moveField = (index: number, direction: "up" | "down") => {
    const newFields = [...registrationFields];
    const swap = direction === "up" ? index - 1 : index + 1;
    if (swap < 0 || swap >= newFields.length) return;
    [newFields[index], newFields[swap]] = [newFields[swap], newFields[index]];
    setRegistrationFields(newFields);
  };

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async (status: "DRAFT" | "ACTIVE") => {
    if (!title.trim()) return alert("Title is required");
    if (!eventDate) return alert("Event date is required");

    setSaving(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          coverImageUrl: coverImageUrl || null,
          mediaUrls,
          eventDate: new Date(eventDate).toISOString(),
          endDate: endDate ? new Date(endDate).toISOString() : null,
          timezone,
          isOnline,
          venueName: isOnline ? null : venueName.trim() || null,
          venueAddress: isOnline ? null : venueAddress.trim() || null,
          onlineUrl: isOnline ? onlineUrl.trim() || null : null,
          registrationType,
          registrationFields:
            registrationType === "form" ? registrationFields : [],
          capacity:
            registrationType === "booking" && capacity
              ? Number(capacity)
              : null,
          ticketType: registrationType === "booking" ? ticketType : "free",
          ticketPrice:
            registrationType === "booking" &&
            ticketType === "paid" &&
            ticketPrice
              ? Math.round(Number(ticketPrice) * 100)
              : null,
          ticketName:
            registrationType === "booking" && ticketType === "paid"
              ? ticketName.trim() || null
              : null,
          ticketStyle,
          settings: { thankYouMessage, showCapacity, ticketStyle },
          status,
        }),
      });
      const json = await res.json();
      if (json.success) {
        router.push(`/tools/events/${json.data.id}`);
      } else {
        alert(json.error?.message || "Failed to create event");
      }
    } catch {
      alert("Failed to create event");
    } finally {
      setSaving(false);
    }
  };

  // ── Preview field renderer ──────────────────────────────────────────────────

  const renderFieldPreview = (field: DataFormField) => {
    const baseClasses =
      "w-full px-3 py-2 border border-border rounded-md bg-card text-foreground text-xs";

    switch (field.type) {
      case "text":
      case "email":
      case "phone":
      case "number":
      case "url":
        return (
          <input
            type={field.type === "phone" ? "tel" : field.type}
            placeholder={field.placeholder || field.label}
            className={baseClasses}
            disabled
          />
        );
      case "textarea":
        return (
          <textarea
            placeholder={field.placeholder || field.label}
            className={`${baseClasses} resize-none`}
            rows={2}
            disabled
          />
        );
      case "date":
        return <input type="date" className={baseClasses} disabled />;
      case "select":
        return (
          <select className={baseClasses} disabled>
            <option>{field.placeholder || "Select an option"}</option>
            {field.options?.map((opt, i) => (
              <option key={i}>{opt}</option>
            ))}
          </select>
        );
      case "radio":
        return (
          <div className="space-y-1">
            {field.options?.map((opt, i) => (
              <label key={i} className="flex items-center gap-2">
                <input type="radio" name={field.id} disabled />
                <span className="text-xs text-foreground">
                  {opt}
                </span>
              </label>
            ))}
          </div>
        );
      case "checkbox":
        return (
          <div className="space-y-1">
            {field.options?.map((opt, i) => (
              <label key={i} className="flex items-center gap-2">
                <input type="checkbox" disabled />
                <span className="text-xs text-foreground">
                  {opt}
                </span>
              </label>
            ))}
          </div>
        );
      case "address":
        return (
          <div className="space-y-1">
            <input
              placeholder="Street Address"
              className={baseClasses}
              disabled
            />
            <input placeholder="City" className={baseClasses} disabled />
            <div className="grid grid-cols-2 gap-1">
              <input placeholder="State" className={baseClasses} disabled />
              <input
                placeholder="ZIP Code"
                className={baseClasses}
                disabled
              />
            </div>
          </div>
        );
      default:
        return <input type="text" className={baseClasses} disabled />;
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/tools/events">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </Link>
              <h1 className="text-2xl font-bold text-foreground">
                Create Event
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
                className="lg:hidden gap-2"
              >
                <Eye className="h-4 w-4" />
                {showPreview ? "Hide Preview" : "Show Preview"}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleSubmit("DRAFT")}
                disabled={saving}
              >
                <Save className="h-4 w-4 mr-2" />
                Save Draft
              </Button>
              <Button
                onClick={() => handleSubmit("ACTIVE")}
                disabled={saving}
              >
                <Send className="h-4 w-4 mr-2" />
                Publish
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* ── Left Column: Builder ───────────────────────────────────────── */}
          <div
            className={`space-y-6 ${showPreview ? "hidden lg:block" : ""}`}
          >
            {/* Section 1: Basic Info */}
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-brand-500" />
                Basic Info
              </h2>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Title <span className="text-red-500">*</span>
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Summer Product Launch"
                  className="text-lg"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell people about your event..."
                  className="w-full px-3 py-2 border border-border rounded-md bg-card text-foreground resize-none"
                  rows={3}
                />
              </div>

              {/* Cover Image */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Cover Image
                </label>
                <MediaUploader
                  value={coverImageUrl ? [coverImageUrl] : []}
                  onChange={(urls) => setCoverImageUrl(urls[0] || "")}
                  variant="medium"
                  placeholder="Upload cover"
                />
              </div>

              {/* Gallery */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Gallery
                </label>
                <MediaUploader
                  value={mediaUrls}
                  onChange={(urls) => setMediaUrls(urls)}
                  multiple
                  maxFiles={10}
                  variant="small"
                  placeholder="Add photos"
                  description="Up to 10 photos"
                />
              </div>
            </div>

            {/* Section 2: Date & Location */}
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Clock className="h-5 w-5 text-brand-500" />
                Date & Location
              </h2>

              {/* Event Date */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Event Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  End Date{" "}
                  <span className="text-xs text-muted-foreground">
                    (optional)
                  </span>
                </label>
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              {/* Timezone */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Timezone
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Online Toggle */}
              <div className="flex items-center gap-3 pt-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isOnline}
                    onChange={(e) => setIsOnline(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-500"></div>
                </label>
                <span className="text-sm font-medium text-foreground">
                  Online Event
                </span>
              </div>

              {/* Conditional: Online URL or Venue */}
              {isOnline ? (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Online URL
                  </label>
                  <Input
                    value={onlineUrl}
                    onChange={(e) => setOnlineUrl(e.target.value)}
                    placeholder="https://zoom.us/j/..."
                    type="url"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Venue Name
                    </label>
                    <Input
                      value={venueName}
                      onChange={(e) => setVenueName(e.target.value)}
                      placeholder="e.g., Convention Center"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Venue Address
                    </label>
                    <Input
                      value={venueAddress}
                      onChange={(e) => setVenueAddress(e.target.value)}
                      placeholder="e.g., 123 Main St, City, State"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Section 3: Registration Type */}
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Users className="h-5 w-5 text-brand-500" />
                Registration
              </h2>

              {/* Type Selector Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(
                  Object.entries(REGISTRATION_TYPE_CONFIG) as [
                    RegistrationType,
                    { label: string; description: string },
                  ][]
                ).map(([type, config]) => (
                  <button
                    key={type}
                    onClick={() => setRegistrationType(type)}
                    className={`p-4 text-left border-2 rounded-lg transition-all ${
                      registrationType === type
                        ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                        : "border-border hover:border-border"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          registrationType === type
                            ? "border-brand-500"
                            : "border-border"
                        }`}
                      >
                        {registrationType === type && (
                          <div className="w-2 h-2 rounded-full bg-brand-500" />
                        )}
                      </div>
                      <span className="font-semibold text-sm text-foreground">
                        {config.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground ml-6">
                      {config.description}
                    </p>
                  </button>
                ))}
              </div>

              {/* Form: Custom Fields Builder */}
              {registrationType === "form" && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">
                      Registration Fields
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTypeSelector(!showTypeSelector)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Field
                    </Button>
                  </div>

                  {/* Field Type Selector */}
                  {showTypeSelector && (
                    <div className="p-4 border border-border rounded-lg bg-muted">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-foreground">
                          Select Field Type
                        </h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowTypeSelector(false)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {FIELD_TYPES.map((type) => (
                          <button
                            key={type.value}
                            onClick={() => addField(type.value)}
                            className="p-3 text-left border border-border rounded-lg hover:bg-card hover:shadow-sm transition-all"
                          >
                            <div className="text-sm font-medium text-foreground">
                              {type.label}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Field List */}
                  {registrationFields.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border-2 border-dashed border-border rounded-lg">
                      <p className="text-sm">No fields added yet.</p>
                      <p className="text-xs mt-1">
                        Click &quot;Add Field&quot; to get started.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {registrationFields.map((field, index) => (
                        <div
                          key={field.id}
                          className="border border-border rounded-lg bg-card"
                        >
                          <div
                            className="flex items-center gap-2 p-3 cursor-pointer hover:bg-muted transition-colors"
                            onClick={() =>
                              setExpandedField(
                                expandedField === field.id ? null : field.id
                              )
                            }
                          >
                            <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-xs font-medium text-muted-foreground uppercase">
                              {field.type}
                            </span>
                            <span className="font-medium flex-1 text-foreground truncate">
                              {field.label}
                            </span>
                            {field.required && (
                              <span className="text-xs text-red-500 font-medium">
                                Required
                              </span>
                            )}
                            <ChevronDown
                              className={`h-4 w-4 transition-transform flex-shrink-0 ${
                                expandedField === field.id ? "rotate-180" : ""
                              }`}
                            />
                          </div>

                          {expandedField === field.id && (
                            <div className="p-3 pt-0 space-y-3 border-t border-border">
                              <div>
                                <label className="block text-xs font-medium text-foreground mb-1">
                                  Label
                                </label>
                                <Input
                                  value={field.label}
                                  onChange={(e) =>
                                    updateField(field.id, {
                                      label: e.target.value,
                                    })
                                  }
                                  placeholder="Field label"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-foreground mb-1">
                                  Placeholder
                                </label>
                                <Input
                                  value={field.placeholder || ""}
                                  onChange={(e) =>
                                    updateField(field.id, {
                                      placeholder: e.target.value,
                                    })
                                  }
                                  placeholder="Placeholder text"
                                />
                              </div>

                              {/* Options for select/radio/checkbox */}
                              {field.options && (
                                <div className="space-y-2">
                                  <label className="block text-xs font-medium text-foreground">
                                    Options
                                  </label>
                                  {field.options.map((opt, i) => (
                                    <div key={i} className="flex gap-2">
                                      <Input
                                        value={opt}
                                        onChange={(e) => {
                                          const newOpts = [
                                            ...field.options!,
                                          ];
                                          newOpts[i] = e.target.value;
                                          updateField(field.id, {
                                            options: newOpts,
                                          });
                                        }}
                                      />
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          updateField(field.id, {
                                            options: field.options!.filter(
                                              (_, j) => j !== i
                                            ),
                                          })
                                        }
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ))}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      updateField(field.id, {
                                        options: [
                                          ...(field.options || []),
                                          `Option ${(field.options?.length || 0) + 1}`,
                                        ],
                                      })
                                    }
                                  >
                                    <Plus className="h-3 w-3 mr-1" /> Add
                                    Option
                                  </Button>
                                </div>
                              )}

                              <div className="flex items-center justify-between pt-2">
                                <label className="flex items-center gap-2 text-sm text-foreground">
                                  <input
                                    type="checkbox"
                                    checked={field.required}
                                    onChange={(e) =>
                                      updateField(field.id, {
                                        required: e.target.checked,
                                      })
                                    }
                                    className="rounded"
                                  />
                                  Required
                                </label>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => moveField(index, "up")}
                                    disabled={index === 0}
                                    title="Move up"
                                  >
                                    <ChevronUp className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => moveField(index, "down")}
                                    disabled={
                                      index ===
                                      registrationFields.length - 1
                                    }
                                    title="Move down"
                                  >
                                    <ChevronDown className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeField(field.id)}
                                    className="text-red-500 hover:text-red-700"
                                    title="Remove field"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Booking config */}
              {registrationType === "booking" && (
                <div className="mt-4 space-y-4">
                  {/* Capacity */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Capacity
                    </label>
                    <Input
                      type="number"
                      min={1}
                      value={capacity}
                      onChange={(e) =>
                        setCapacity(
                          e.target.value === "" ? "" : Number(e.target.value)
                        )
                      }
                      placeholder="Maximum number of attendees"
                    />
                  </div>

                  {/* Free / Paid Toggle */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Pricing
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setTicketType("free")}
                        className={`flex-1 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                          ticketType === "free"
                            ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300"
                            : "border-border text-foreground hover:border-border"
                        }`}
                      >
                        Free
                      </button>
                      <button
                        onClick={() => setTicketType("paid")}
                        className={`flex-1 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                          ticketType === "paid"
                            ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300"
                            : "border-border text-foreground hover:border-border"
                        }`}
                      >
                        <DollarSign className="h-4 w-4 inline mr-1" />
                        Paid
                      </button>
                    </div>
                  </div>

                  {/* Paid Ticket Details */}
                  {ticketType === "paid" && (
                    <div className="space-y-3 p-4 bg-muted rounded-lg border border-border">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Ticket Name
                        </label>
                        <Input
                          value={ticketName}
                          onChange={(e) => setTicketName(e.target.value)}
                          placeholder="e.g., General Admission"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Price
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                            $
                          </span>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={ticketPrice}
                            onChange={(e) =>
                              setTicketPrice(
                                e.target.value === ""
                                  ? ""
                                  : Number(e.target.value)
                              )
                            }
                            placeholder="0.00"
                            className="pl-7"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Section 4: Settings */}
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                Settings
              </h2>

              {/* Thank You Message */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Thank You Message
                </label>
                <textarea
                  value={thankYouMessage}
                  onChange={(e) => setThankYouMessage(e.target.value)}
                  placeholder="Message shown after registration"
                  className="w-full px-3 py-2 border border-border rounded-md bg-card text-foreground resize-none"
                  rows={2}
                />
              </div>

              {/* Show Capacity */}
              <label className="flex items-center gap-3 text-sm text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={showCapacity}
                  onChange={(e) => setShowCapacity(e.target.checked)}
                  className="rounded"
                />
                Show remaining spots publicly
              </label>

              {/* Ticket Style Selector */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  <Ticket className="h-4 w-4 inline mr-1.5" />
                  Digital Ticket Style
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {TICKET_STYLES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setTicketStyle(s.value)}
                      className={`relative p-3 rounded-xl border-2 text-left transition-all ${
                        ticketStyle === s.value
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/20"
                          : "border-border hover:border-border"
                      }`}
                    >
                      {/* Mini ticket preview */}
                      <div className={`h-16 rounded-lg mb-2 flex items-center justify-center text-xs font-bold ${
                        s.value === "classic" ? "bg-white border border-gray-200 text-gray-800" :
                        s.value === "modern" ? "bg-gradient-to-br from-indigo-500 to-purple-500 text-white" :
                        "bg-gray-900 text-amber-400 border border-gray-700"
                      }`}>
                        <Ticket className="h-5 w-5" />
                      </div>
                      <p className="text-xs font-semibold">{s.label}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">{s.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Action Buttons */}
            <div className="flex items-center gap-3 pb-8">
              <Button
                variant="outline"
                onClick={() => handleSubmit("DRAFT")}
                disabled={saving}
                className="flex-1 sm:flex-none"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save as Draft"}
              </Button>
              <Button
                onClick={() => handleSubmit("ACTIVE")}
                disabled={saving}
                className="flex-1 sm:flex-none"
              >
                <Send className="h-4 w-4 mr-2" />
                {saving ? "Publishing..." : "Publish"}
              </Button>
            </div>
          </div>

          {/* ── Right Column: Live Preview ─────────────────────────────────── */}
          <div
            className={`${!showPreview ? "hidden lg:block" : ""}`}
          >
            <div className="sticky top-24">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                Live Preview
              </h3>
              <div className="border-8 border-gray-800 dark:border-gray-600 rounded-[2.5rem] overflow-hidden shadow-2xl bg-card">
                <div className="h-[700px] overflow-y-auto">
                  {/* Cover Image */}
                  {coverImageUrl ? (
                    <div className="relative w-full h-40">
                      <Image
                        src={coverImageUrl}
                        alt="Cover"
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-40 bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                      <CalendarDays className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}

                  <div className="p-5 space-y-4">
                    {/* Date Badge + Title */}
                    <div className="flex items-start gap-3">
                      {eventDate ? (
                        <div className="inline-flex flex-col items-center bg-card rounded-lg shadow-md px-3 py-2 border flex-shrink-0">
                          <span className="text-xs font-bold text-red-500 uppercase">
                            {new Date(eventDate).toLocaleDateString("en-US", {
                              month: "short",
                            })}
                          </span>
                          <span className="text-2xl font-bold text-foreground">
                            {new Date(eventDate).getDate()}
                          </span>
                        </div>
                      ) : (
                        <div className="inline-flex flex-col items-center bg-card rounded-lg shadow-md px-3 py-2 border flex-shrink-0">
                          <span className="text-xs font-bold text-muted-foreground uppercase">
                            MON
                          </span>
                          <span className="text-2xl font-bold text-muted-foreground">
                            --
                          </span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="text-lg font-bold text-foreground leading-tight">
                          {title || (
                            <span className="text-muted-foreground">
                              Event Title
                            </span>
                          )}
                        </h3>
                        {eventDate && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(eventDate).toLocaleDateString("en-US", {
                              weekday: "long",
                              month: "long",
                              day: "numeric",
                              year: "numeric",
                            })}
                            {" at "}
                            {new Date(eventDate).toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                            {endDate && (
                              <>
                                {" - "}
                                {new Date(endDate).toLocaleTimeString(
                                  "en-US",
                                  { hour: "numeric", minute: "2-digit" }
                                )}
                              </>
                            )}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Location */}
                    {(isOnline || venueName || venueAddress) && (
                      <div className="flex items-start gap-2 text-sm text-muted-foreground">
                        {isOnline ? (
                          <>
                            <Globe className="h-4 w-4 mt-0.5 flex-shrink-0 text-brand-500" />
                            <span>
                              Online Event
                              {onlineUrl && (
                                <span className="block text-xs text-brand-500 truncate">
                                  {onlineUrl}
                                </span>
                              )}
                            </span>
                          </>
                        ) : (
                          <>
                            <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-brand-500" />
                            <span>
                              {venueName && (
                                <span className="block font-medium text-foreground">
                                  {venueName}
                                </span>
                              )}
                              {venueAddress && (
                                <span className="block text-xs">
                                  {venueAddress}
                                </span>
                              )}
                            </span>
                          </>
                        )}
                      </div>
                    )}

                    {/* Description */}
                    {description && (
                      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {description}
                      </p>
                    )}

                    {/* Gallery thumbnails */}
                    {mediaUrls.length > 0 && (
                      <div className="flex gap-1.5 overflow-x-auto pb-1">
                        {mediaUrls.slice(0, 4).map((url, i) => (
                          <div
                            key={i}
                            className="relative w-16 h-16 rounded-md overflow-hidden flex-shrink-0 border"
                          >
                            <Image
                              src={url}
                              alt={`Gallery ${i + 1}`}
                              fill
                              className="object-cover"
                            />
                          </div>
                        ))}
                        {mediaUrls.length > 4 && (
                          <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center flex-shrink-0 border text-xs text-muted-foreground font-medium">
                            +{mediaUrls.length - 4}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Divider */}
                    <div className="border-t border-border" />

                    {/* Registration Preview */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-foreground">
                        {registrationType === "rsvp"
                          ? "RSVP"
                          : registrationType === "form"
                            ? "Register"
                            : "Book a Spot"}
                      </h4>

                      {/* RSVP */}
                      {registrationType === "rsvp" && (
                        <div className="space-y-2">
                          <button
                            disabled
                            className="w-full py-2 px-3 bg-green-500 text-white rounded-md text-xs font-medium opacity-60 cursor-not-allowed"
                          >
                            Attending
                          </button>
                          <button
                            disabled
                            className="w-full py-2 px-3 bg-yellow-500 text-white rounded-md text-xs font-medium opacity-60 cursor-not-allowed"
                          >
                            Maybe
                          </button>
                          <button
                            disabled
                            className="w-full py-2 px-3 bg-gray-400 text-white rounded-md text-xs font-medium opacity-60 cursor-not-allowed"
                          >
                            Not Attending
                          </button>
                        </div>
                      )}

                      {/* Form */}
                      {registrationType === "form" && (
                        <div className="space-y-3">
                          {registrationFields.length > 0 ? (
                            registrationFields.map((field) => (
                              <div key={field.id}>
                                <label className="block text-xs font-medium text-foreground mb-1">
                                  {field.label}
                                  {field.required && (
                                    <span className="text-red-500 ml-1">
                                      *
                                    </span>
                                  )}
                                </label>
                                {renderFieldPreview(field)}
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-muted-foreground text-center py-4">
                              Add fields to see the form preview
                            </p>
                          )}
                          {registrationFields.length > 0 && (
                            <button
                              disabled
                              className="w-full py-2 px-4 bg-brand-500 text-white rounded-md text-xs font-medium opacity-60 cursor-not-allowed"
                            >
                              Register
                            </button>
                          )}
                        </div>
                      )}

                      {/* Booking */}
                      {registrationType === "booking" && (
                        <div className="space-y-3">
                          {/* Name / Email / Phone preview fields */}
                          <div>
                            <label className="block text-xs font-medium text-foreground mb-1">
                              Full Name{" "}
                              <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              placeholder="Your name"
                              className="w-full px-3 py-2 border border-border rounded-md bg-card text-foreground text-xs"
                              disabled
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-foreground mb-1">
                              Email{" "}
                              <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="email"
                              placeholder="your@email.com"
                              className="w-full px-3 py-2 border border-border rounded-md bg-card text-foreground text-xs"
                              disabled
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-foreground mb-1">
                              Phone
                            </label>
                            <input
                              type="tel"
                              placeholder="(555) 123-4567"
                              className="w-full px-3 py-2 border border-border rounded-md bg-card text-foreground text-xs"
                              disabled
                            />
                          </div>

                          {/* Capacity Bar */}
                          {capacity && showCapacity && (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  Spots Available
                                </span>
                                <span>
                                  {Number(capacity)} /{" "}
                                  {Number(capacity)}
                                </span>
                              </div>
                              <div className="w-full bg-muted rounded-full h-2">
                                <div
                                  className="bg-green-500 h-2 rounded-full"
                                  style={{ width: "100%" }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Price display */}
                          {ticketType === "paid" && ticketPrice ? (
                            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg border border-border">
                              <Ticket className="h-4 w-4 text-brand-500" />
                              <div className="flex-1">
                                <p className="text-xs font-medium text-foreground">
                                  {ticketName || "Ticket"}
                                </p>
                              </div>
                              <span className="text-sm font-bold text-foreground">
                                $
                                {Number(ticketPrice).toFixed(2)}
                              </span>
                            </div>
                          ) : null}

                          <button
                            disabled
                            className="w-full py-2 px-4 bg-brand-500 text-white rounded-md text-xs font-medium opacity-60 cursor-not-allowed"
                          >
                            {ticketType === "paid" && ticketPrice
                              ? `Buy Ticket ($${Number(ticketPrice).toFixed(2)})`
                              : "Register"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
