"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Cake,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Eye,
  Gift,
  ImageIcon,
  Mail,
  Sparkles,
  Star,
  Upload,
  UserCircle2,
  Users,
  UserPlus,
  Wand2,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EditorStep } from "@/components/email-marketing/steps/editor-step";
import { AISpinner } from "@/components/shared/ai-generation-loader";
import type { OptimizationData } from "@/components/email-marketing/builder/optimization-panel";
import { useCampaignForm } from "@/hooks/use-campaign-form";
import { useToast } from "@/hooks/use-toast";
import {
  renderEmailHtml,
  sectionsToPlainText,
  type EmailBrand,
  type EmailSection,
} from "@/lib/marketing/email-renderer";
import { getHolidayDate, US_HOLIDAYS } from "@/lib/marketing/holidays";
import { cn } from "@/lib/utils/cn";

type AutomationType = "BIRTHDAY" | "HOLIDAY" | "WELCOME" | "CUSTOM";
type WizardStep = "event" | "content" | "preview" | "activate";
type LogoSize = "normal" | "large" | "big";
type Tone = "professional" | "warm" | "playful" | "bold";
type ImageStrategy = "none" | "ai_per_event" | "contact_photo" | "ai_per_contact";

interface ContactList {
  id: string;
  name: string;
  totalCount: number;
  activeCount: number;
  contactCount?: number;
}

interface BirthdayStats {
  total: number;
  withBirthday: number;
  validEmailOptedIn?: number;
  withBirthdayAndValidEmail?: number;
  withBirthdayMissingValidEmail?: number;
  withBirthdayAndImage?: number;
  eligibleBirthdayContacts?: number;
  missingValidEmailOrOptIn?: number;
  withoutBirthday: number;
}

interface BirthdayContactPreview {
  id: string;
  name: string;
  email: string | null;
  birthday: string | null;
  emailOptedIn: boolean;
  imageUrl: string | null;
}

interface EventEmail {
  /** stable key — holidayId for HOLIDAY, otherwise the constant SINGLE_KEY */
  key: string;
  label: string;
  /** date label for badge rendering on HOLIDAY tabs */
  dateLabel?: string;
  subject: string;
  preheader: string;
  sections: EmailSection[];
  contentHtml: string;
  isGenerated: boolean;
  isGenerating: boolean;
  /** when this event was last generated, for cache busting */
  generatedAt?: number;
}

const SINGLE_KEY = "single";

const STEPS: Array<{ id: WizardStep; label: string; icon: typeof Zap }> = [
  { id: "event", label: "Select Event", icon: Zap },
  { id: "content", label: "Content Setup", icon: Sparkles },
  { id: "preview", label: "Preview Samples", icon: Eye },
  { id: "activate", label: "Audience & Activate", icon: Users },
];

const AUTOMATION_TYPES: Array<{
  type: AutomationType;
  label: string;
  description: string;
  icon: typeof Cake;
}> = [
  {
    type: "BIRTHDAY",
    label: "Birthday",
    description: "Send a personalised email on each contact's birthday.",
    icon: Cake,
  },
  {
    type: "HOLIDAY",
    label: "Calendar Event",
    description: "Pick one or many calendar events — each gets its own unique email.",
    icon: CalendarDays,
  },
  {
    type: "WELCOME",
    label: "Welcome",
    description: "Greet new contacts after they join your audience.",
    icon: UserPlus,
  },
  {
    type: "CUSTOM",
    label: "Custom",
    description: "Build a recurring or one-time email automation.",
    icon: Star,
  },
];

const TONE_OPTIONS: Array<{ value: Tone; label: string; description: string }> = [
  { value: "professional", label: "Professional", description: "Clear, polished, brand-friendly." },
  { value: "warm", label: "Warm", description: "Personal and friendly. Best for birthdays & welcome." },
  { value: "playful", label: "Playful", description: "Fun, energetic, on-brand for casual audiences." },
  { value: "bold", label: "Bold", description: "Confident and direct with a strong CTA." },
];

const TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Paris (CET/CEST)" },
  { value: "Africa/Lagos", label: "Lagos (WAT)" },
  { value: "Africa/Johannesburg", label: "Johannesburg (SAST)" },
];

const DAYS_OFFSET_OPTIONS = [
  { value: "-14", label: "14 days before" },
  { value: "-7", label: "7 days before" },
  { value: "-3", label: "3 days before" },
  { value: "-1", label: "1 day before" },
  { value: "0", label: "Same day" },
  { value: "1", label: "1 day after" },
  { value: "3", label: "3 days after" },
  { value: "7", label: "7 days after" },
];

const WEEKDAYS = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

function apiErrorMessage(data: unknown, fallback: string) {
  if (!data || typeof data !== "object") return fallback;
  const error = (data as { error?: unknown }).error;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return fallback;
}

function parseJsonObject(value: unknown) {
  if (!value) return undefined;
  if (typeof value === "object") return value as Record<string, unknown>;
  if (typeof value !== "string") return undefined;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : undefined;
  } catch {
    return undefined;
  }
}

function buildBrand(bk: Record<string, unknown>): EmailBrand {
  const colors = parseJsonObject(bk.colors);
  const fonts = parseJsonObject(bk.fonts);
  const socials = parseJsonObject(bk.handles);

  return {
    name: typeof bk.name === "string" ? bk.name : undefined,
    logo: typeof bk.logo === "string" ? bk.logo : undefined,
    iconLogo: typeof bk.iconLogo === "string" ? bk.iconLogo : undefined,
    colors: colors?.primary
      ? colors as EmailBrand["colors"]
      : { primary: "#6366f1", secondary: "#f3f4f6", accent: "#f59e0b" },
    fonts: fonts?.heading
      ? fonts as EmailBrand["fonts"]
      : {
          heading: "Georgia, serif",
          body: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        },
    website: typeof bk.website === "string" ? bk.website : undefined,
    email: typeof bk.email === "string" ? bk.email : undefined,
    phone: typeof bk.phone === "string" ? bk.phone : undefined,
    address: typeof bk.address === "string" ? bk.address : undefined,
    socials: socials as Record<string, string> | undefined,
  };
}

function holidayDateLabel(holidayId: string) {
  const holiday = US_HOLIDAYS.find((item) => item.id === holidayId);
  if (!holiday) return "";
  const year = new Date().getFullYear();
  const date = getHolidayDate(holiday, year);
  return new Date(year, date.month - 1, date.day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatBirthday(value: string | null) {
  if (!value) return "";
  const [month, day] = value.split("-");
  if (!month || !day) return value;
  const date = new Date(2024, Number(month) - 1, Number(day));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function hasUsableEmail(contact: { email?: string | null; emailOptedIn?: boolean }) {
  return contact.emailOptedIn === true && typeof contact.email === "string" && contact.email.includes("@");
}

function normalizeBirthdayDraft(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

function isValidBirthday(value: string) {
  if (!/^\d{2}-\d{2}$/.test(value)) return false;
  const [monthValue, dayValue] = value.split("-").map((part) => Number(part));
  return monthValue >= 1 && monthValue <= 12 && dayValue >= 1 && dayValue <= 31;
}

function defaultAutomationName(type: AutomationType) {
  switch (type) {
    case "BIRTHDAY":
      return "Birthday Email Automation";
    case "HOLIDAY":
      return "Calendar Event Email Automation";
    case "WELCOME":
      return "Welcome Email Automation";
    default:
      return "Custom Email Automation";
  }
}

function categoryForType(type: AutomationType) {
  if (type === "BIRTHDAY") return "birthday";
  if (type === "HOLIDAY") return "holiday";
  if (type === "WELCOME") return "lifecycle";
  return "custom";
}

/**
 * Replace merge tags with a sample contact's values, for preview rendering.
 * Keeps unknown tags as plain text so we never leak `{{tag}}` to the user.
 */
function previewMergeReplace(
  html: string,
  contact: BirthdayContactPreview | null,
  fallbackName: string,
  extra?: Record<string, string>
) {
  const name = contact?.name || fallbackName;
  const [firstName, ...rest] = name.split(" ");
  const lastName = rest.join(" ");
  const replacements: Record<string, string> = {
    firstName: firstName || name,
    lastName: lastName || "",
    fullName: name,
    name,
    email: contact?.email || "friend@example.com",
    birthday: contact?.birthday ? formatBirthday(contact.birthday) : "",
    ...(extra || {}),
  };
  return html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    return replacements[key] ?? "";
  });
}

export default function CreateEmailAutomationPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { state, dispatch } = useCampaignForm();

  const [step, setStep] = useState<WizardStep>("event");
  const [automationType, setAutomationType] = useState<AutomationType>("BIRTHDAY");
  const [automationName, setAutomationName] = useState(defaultAutomationName("BIRTHDAY"));
  const [aiBrief, setAiBrief] = useState("");
  const [tone, setTone] = useState<Tone>("warm");
  const [imageStrategy, setImageStrategy] = useState<ImageStrategy>("ai_per_event");
  const [ctaText, setCtaText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [creditCost, setCreditCost] = useState<number | null>(null);
  const [optimizationData, setOptimizationData] = useState<OptimizationData | null>(null);
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [birthdayStats, setBirthdayStats] = useState<BirthdayStats | null>(null);
  const [birthdayContacts, setBirthdayContacts] = useState<BirthdayContactPreview[]>([]);
  const [birthdayDrafts, setBirthdayDrafts] = useState<Record<string, string>>({});
  const [birthdayDataVersion, setBirthdayDataVersion] = useState(0);
  const [updatingBirthdayContactIds, setUpdatingBirthdayContactIds] = useState<Record<string, string>>({});
  const [loadingBirthdayData, setLoadingBirthdayData] = useState(false);
  const [birthdayConfirmed, setBirthdayConfirmed] = useState(false);
  const [calendarConfirmed, setCalendarConfirmed] = useState(false);
  const [selectedHolidayIds, setSelectedHolidayIds] = useState<string[]>([]);
  const [sampleContactId, setSampleContactId] = useState<string>("");
  const [eventEmails, setEventEmails] = useState<Record<string, EventEmail>>({});
  const [activeEventKey, setActiveEventKey] = useState<string>(SINGLE_KEY);
  const [editingEventKey, setEditingEventKey] = useState<string | null>(null);
  const [sendTime, setSendTime] = useState("09:00");
  const [daysOffset, setDaysOffset] = useState(0);
  const [timezone, setTimezone] = useState("America/New_York");
  const [enabled, setEnabled] = useState(true);
  const [customFrequency, setCustomFrequency] = useState("ONCE");
  const [customScheduledDate, setCustomScheduledDate] = useState("");
  const [customDayOfWeek, setCustomDayOfWeek] = useState("1");
  const [customDayOfMonth, setCustomDayOfMonth] = useState("1");
  const [isCreating, setIsCreating] = useState(false);

  const selectedList = useMemo(
    () => contactLists.find((list) => list.id === state.selectedContactListId) || null,
    [contactLists, state.selectedContactListId]
  );

  const selectedHolidays = useMemo(
    () => US_HOLIDAYS.filter((holiday) => selectedHolidayIds.includes(holiday.id)),
    [selectedHolidayIds]
  );

  const isEveryHolidaySelected = selectedHolidayIds.length === US_HOLIDAYS.length;

  const currentStepIndex = STEPS.findIndex((item) => item.id === step);
  const eligibleBirthdayCount =
    birthdayStats?.eligibleBirthdayContacts ?? birthdayStats?.withBirthdayAndValidEmail ?? 0;
  const emailReadyCount = birthdayStats?.validEmailOptedIn ?? 0;
  const birthdayContactsWithImage = birthdayStats?.withBirthdayAndImage ?? 0;
  const eligibleBirthdayContacts = useMemo(
    () => birthdayContacts.filter((contact) => !!contact.birthday && hasUsableEmail(contact)),
    [birthdayContacts]
  );

  // Tabs that drive the per-event preview & generation in step 3.
  const eventTabs = useMemo(() => {
    if (automationType === "HOLIDAY") {
      return selectedHolidays.map((holiday) => ({
        key: holiday.id,
        label: holiday.name,
        icon: holiday.icon,
        dateLabel: holidayDateLabel(holiday.id),
      }));
    }
    return [
      {
        key: SINGLE_KEY,
        label:
          automationType === "BIRTHDAY"
            ? "Birthday Email"
            : automationType === "WELCOME"
              ? "Welcome Email"
              : "Custom Email",
        icon: "",
        dateLabel: undefined as string | undefined,
      },
    ];
  }, [automationType, selectedHolidays]);

  const allEventsGenerated = useMemo(
    () => eventTabs.length > 0 && eventTabs.every((tab) => eventEmails[tab.key]?.isGenerated),
    [eventEmails, eventTabs]
  );

  const anyEventGenerating = useMemo(
    () => Object.values(eventEmails).some((entry) => entry.isGenerating),
    [eventEmails]
  );

  const canProceedFromEvent = useMemo(() => {
    if (!automationName.trim()) return false;
    if (!state.selectedContactListId) return false;
    if (automationType === "HOLIDAY") {
      return selectedHolidayIds.length > 0 && calendarConfirmed;
    }
    if (automationType === "BIRTHDAY") {
      return eligibleBirthdayCount > 0 && birthdayConfirmed;
    }
    return true;
  }, [
    automationName,
    automationType,
    birthdayConfirmed,
    eligibleBirthdayCount,
    calendarConfirmed,
    selectedHolidayIds.length,
    state.selectedContactListId,
  ]);

  const canProceedFromContent = canProceedFromEvent;
  const canProceedFromPreview = canProceedFromEvent && allEventsGenerated;
  const canActivate = canProceedFromPreview && automationName.trim().length > 0;

  useEffect(() => {
    fetch("/api/brand")
      .then((response) => response.json())
      .then((data) => {
        if (data.success && data.data) {
          dispatch({ type: "SET_BRAND_KIT", brandKit: buildBrand(data.data) });
        }
      })
      .catch(() => {});
  }, [dispatch]);

  useEffect(() => {
    fetch("/api/credits/costs")
      .then((response) => response.json())
      .then((data) => {
        if (data.success) setCreditCost(data.data?.AI_POST || null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchLists() {
      setLoadingLists(true);
      try {
        const response = await fetch("/api/contact-lists");
        const data = await response.json();
        if (!cancelled && data.success) {
          setContactLists(data.data?.lists || []);
        }
      } catch {
        if (!cancelled) setContactLists([]);
      } finally {
        if (!cancelled) setLoadingLists(false);
      }
    }
    fetchLists();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (automationType !== "BIRTHDAY") return;
    if (!state.selectedContactListId) {
      setBirthdayStats(null);
      setBirthdayContacts([]);
      setBirthdayDrafts({});
      setLoadingBirthdayData(false);
      return;
    }

    let cancelled = false;
    async function fetchBirthdayData() {
      setLoadingBirthdayData(true);
      try {
        const params = new URLSearchParams();
        if (state.selectedContactListId) params.set("listId", state.selectedContactListId);

        const [statsResponse, contactsResponse] = await Promise.all([
          fetch(`/api/contacts/birthday-stats${params.toString() ? `?${params}` : ""}`),
          fetch(
            `/api/contacts?${new URLSearchParams({
              ...(state.selectedContactListId ? { listId: state.selectedContactListId } : {}),
              status: "active",
              limit: "500",
              sort: "firstName",
              order: "asc",
            })}`
          ),
        ]);

        const statsJson = await statsResponse.json();
        const contactsJson = await contactsResponse.json();

        if (cancelled) return;

        if (statsJson.success) {
          setBirthdayStats(statsJson.data);
        }

        if (contactsJson.success) {
          const contacts = contactsJson.data?.contacts || [];
          const formattedContacts: BirthdayContactPreview[] = contacts
            .map((contact: {
                id: string;
                name?: string | null;
                firstName?: string | null;
                lastName?: string | null;
                email?: string | null;
                emailOptedIn?: boolean;
                imageUrl?: string | null;
                birthday?: string | null;
              }) => ({
                id: contact.id,
                name:
                  contact.name ||
                  [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
                  contact.email ||
                  "Contact",
                email: contact.email || null,
                birthday: contact.birthday || null,
                emailOptedIn: contact.emailOptedIn === true,
                imageUrl: contact.imageUrl || null,
              }));
          setBirthdayContacts(formattedContacts);
          setBirthdayDrafts((current) => {
            const next: Record<string, string> = {};
            for (const contact of formattedContacts) {
              next[contact.id] = current[contact.id] ?? contact.birthday ?? "";
            }
            return next;
          });
          // Seed sample contact for preview if none chosen yet.
          setSampleContactId((current) => {
            if (current && formattedContacts.some((contact: BirthdayContactPreview) => contact.id === current)) {
              return current;
            }
            const firstEligible = formattedContacts.find(
              (contact: BirthdayContactPreview) => !!contact.birthday && hasUsableEmail(contact)
            );
            return firstEligible?.id || formattedContacts[0]?.id || "";
          });
        }
      } catch {
        if (!cancelled) {
          setBirthdayStats(null);
          setBirthdayContacts([]);
        }
      } finally {
        if (!cancelled) setLoadingBirthdayData(false);
      }
    }

    fetchBirthdayData();
    return () => {
      cancelled = true;
    };
  }, [automationType, birthdayDataVersion, state.selectedContactListId]);

  useEffect(() => {
    setBirthdayConfirmed(false);
  }, [state.selectedContactListId]);

  // When type or selected events change, invalidate any previously generated
  // emails so the preview step always regenerates from current context.
  useEffect(() => {
    setEventEmails({});
    setEditingEventKey(null);
    if (automationType === "HOLIDAY") {
      const first = selectedHolidayIds[0];
      setActiveEventKey(first || SINGLE_KEY);
    } else {
      setActiveEventKey(SINGLE_KEY);
    }
  }, [automationType, selectedHolidayIds]);

  // Birthday photo strategy only makes sense when the list has photos.
  useEffect(() => {
    if (automationType !== "BIRTHDAY") return;
    if (
      birthdayContactsWithImage === 0 &&
      (imageStrategy === "contact_photo" || imageStrategy === "ai_per_contact")
    ) {
      setImageStrategy("ai_per_event");
    }
  }, [automationType, birthdayContactsWithImage, imageStrategy]);

  // Default sensible image strategy per type.
  useEffect(() => {
    if (automationType === "BIRTHDAY") {
      setImageStrategy((current) =>
        current === "contact_photo" || current === "ai_per_contact" || current === "ai_per_event" || current === "none"
          ? current
          : "ai_per_event"
      );
    } else {
      setImageStrategy((current) =>
        current === "contact_photo" || current === "ai_per_contact" ? "ai_per_event" : current
      );
    }
  }, [automationType]);

  const setContactUpdating = (contactId: string, action: string | null) => {
    setUpdatingBirthdayContactIds((current) => {
      const next = { ...current };
      if (action) next[contactId] = action;
      else delete next[contactId];
      return next;
    });
  };

  const applyUpdatedContact = (updated: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    birthday?: string | null;
    emailOptedIn?: boolean;
    imageUrl?: string | null;
  }) => {
    const updatedName =
      [updated.firstName, updated.lastName].filter(Boolean).join(" ") ||
      updated.email ||
      "Contact";

    setBirthdayContacts((current) =>
      current.map((contact) =>
        contact.id === updated.id
          ? {
              ...contact,
              name: updatedName,
              email: updated.email || null,
              birthday: updated.birthday || null,
              emailOptedIn: updated.emailOptedIn === true,
              imageUrl: updated.imageUrl || null,
            }
          : contact
      )
    );
    setBirthdayDrafts((current) => ({
      ...current,
      [updated.id]: updated.birthday || "",
    }));
    setBirthdayConfirmed(false);
    setBirthdayDataVersion((version) => version + 1);
  };

  const patchBirthdayContact = async (
    contactId: string,
    payload: Record<string, unknown>
  ) => {
    const response = await fetch(`/api/contacts/${contactId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      throw new Error(apiErrorMessage(data, "Failed to update contact"));
    }
    applyUpdatedContact(data.data.contact);
    return data.data.contact;
  };

  const handleBirthdayDraftChange = (contactId: string, value: string) => {
    setBirthdayDrafts((current) => ({
      ...current,
      [contactId]: normalizeBirthdayDraft(value),
    }));
  };

  const handleSaveContactBirthday = async (contact: BirthdayContactPreview) => {
    const birthday = (birthdayDrafts[contact.id] || "").trim();
    const currentBirthday = contact.birthday || "";
    if (birthday === currentBirthday) return;
    if (birthday && !isValidBirthday(birthday)) {
      toast({
        title: "Birthday must use MM-DD",
        description: "Use a month and day like 04-16.",
        variant: "destructive",
      });
      return;
    }

    setContactUpdating(contact.id, "birthday");
    try {
      await patchBirthdayContact(contact.id, { birthday: birthday || null });
      toast({ title: birthday ? "Birthday saved" : "Birthday removed" });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Failed to save birthday",
        variant: "destructive",
      });
    } finally {
      setContactUpdating(contact.id, null);
    }
  };

  const handleUploadContactImage = async (contact: BirthdayContactPreview, file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Choose an image file", variant: "destructive" });
      return;
    }

    setContactUpdating(contact.id, "image");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("tags", JSON.stringify(["contact-photo", "birthday-automation"]));

      const uploadResponse = await fetch("/api/media", { method: "POST", body: formData });
      const uploadData = await uploadResponse.json().catch(() => ({}));
      if (!uploadResponse.ok || !uploadData.success) {
        throw new Error(apiErrorMessage(uploadData, "Image upload failed"));
      }

      const imageUrl = uploadData.data?.file?.url || uploadData.data?.url;
      if (!imageUrl) throw new Error("Image uploaded but no URL was returned");

      await patchBirthdayContact(contact.id, { imageUrl });
      toast({ title: "Contact image saved" });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Failed to upload image",
        variant: "destructive",
      });
    } finally {
      setContactUpdating(contact.id, null);
    }
  };

  const handleGenerateContactBirthdayImage = async (contact: BirthdayContactPreview) => {
    if (!contact.imageUrl) {
      toast({
        title: "Add a contact image first",
        description: "FlowCreative needs the person's image as the reference.",
        variant: "destructive",
      });
      return;
    }

    setContactUpdating(contact.id, "ai");
    try {
      const prompt = [
        `Create a polished square birthday greeting image for ${contact.name}.`,
        "Use the reference photo as the real person source and keep the person recognizable.",
        "Make it warm, celebratory, professional, and suitable for a personalized birthday email.",
        "Use tasteful birthday decor, soft lighting, clean composition, and avoid changing the person's identity.",
        "Do not include unreadable text or fake logos.",
      ].join(" ");

      const response = await fetch("/api/ai/visual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          category: "birthday",
          size: "1024x1024",
          style: "professional celebratory",
          provider: "xai",
          strictProvider: true,
          promptMode: "raw_brand",
          heroType: "people",
          textMode: "minimal",
          referenceImageUrl: contact.imageUrl,
          referenceImageUrls: [contact.imageUrl],
          compositeReferenceSubject: true,
          qualityCheckEnabled: false,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(apiErrorMessage(data, "FlowCreative image generation failed"));
      }

      const imageUrl = data.data?.design?.imageUrl;
      if (!imageUrl) throw new Error("FlowCreative generated the image but no URL was returned");

      await patchBirthdayContact(contact.id, { imageUrl });
      toast({
        title: "AI birthday image saved",
        description: "The contact image was updated and will be used by the automation.",
      });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Failed to generate birthday image",
        variant: "destructive",
      });
    } finally {
      setContactUpdating(contact.id, null);
    }
  };

  const handleSelectType = (type: AutomationType) => {
    setAutomationType(type);
    setBirthdayConfirmed(false);
    setCalendarConfirmed(false);
    setSelectedHolidayIds([]);
    setDaysOffset(type === "HOLIDAY" ? -7 : 0);
    if (type === "BIRTHDAY" || type === "WELCOME") setTone("warm");
    if (type === "HOLIDAY") setTone("warm");
    if (type === "CUSTOM") setTone("professional");
    if (
      !automationName.trim() ||
      AUTOMATION_TYPES.some((item) => defaultAutomationName(item.type) === automationName)
    ) {
      setAutomationName(defaultAutomationName(type));
      dispatch({ type: "SET_CAMPAIGN_NAME", value: defaultAutomationName(type) });
    }
  };

  const toggleHoliday = (holidayId: string) => {
    setCalendarConfirmed(false);
    setSelectedHolidayIds((current) =>
      current.includes(holidayId)
        ? current.filter((id) => id !== holidayId)
        : [...current, holidayId]
    );
  };

  /**
   * Build the AI prompt for a single event. For HOLIDAY this embeds the
   * holiday's specific name, date, and category so the agent generates a
   * uniquely tailored email instead of a generic template.
   */
  const buildAiPromptForEvent = useCallback(
    (eventKey: string) => {
      const listContext = selectedList
        ? `${selectedList.name} (${selectedList.activeCount || selectedList.totalCount} active contacts)`
        : "no contact list selected";
      const lines: string[] = [
        `Create a professional email automation for FlowSmartly's automation builder.`,
        `Automation type: ${automationType}.`,
        `Automation name: ${automationName || defaultAutomationName(automationType)}.`,
        `Audience: ${listContext}.`,
        `Desired tone: ${tone}.`,
        `Use merge tags naturally — at minimum {{firstName}}.`,
      ];

      if (automationType === "BIRTHDAY") {
        lines.push(
          `This email celebrates the contact's birthday.`,
          `Eligible birthday contacts in the list: ${eligibleBirthdayCount}.`,
          `Contacts with saved photos: ${birthdayContactsWithImage}.`,
          imageStrategy === "contact_photo"
            ? "An image of the contact will be embedded automatically — write copy that complements a personal photo."
            : imageStrategy === "ai_per_contact"
              ? "An AI-personalised birthday image of the contact will be embedded — write copy that flows around a personal photo."
              : imageStrategy === "ai_per_event"
                ? "A celebratory AI-generated birthday image will be embedded — write copy that flows around it."
                : "No image will be embedded. Make the copy itself feel warm and celebratory.",
          "Include {{birthday}} only if it reads naturally; never invent ages."
        );
      }

      if (automationType === "HOLIDAY") {
        const holiday = US_HOLIDAYS.find((item) => item.id === eventKey);
        if (holiday) {
          const date = holidayDateLabel(holiday.id);
          lines.push(
            `This automation is for the calendar event "${holiday.name}" (${holiday.category}, ${date}).`,
            `Hint: ${holiday.promptHint}`,
            `Default suggested subject line: ${holiday.defaultSubject}.`,
            "Write copy specifically for THIS event — do not produce a generic 'happy holidays' template that could be reused for any other event."
          );
        }
      }

      if (automationType === "WELCOME") {
        lines.push(
          "This email welcomes brand-new contacts and introduces the brand clearly.",
          "Suggest one helpful next step (a product page, a guide, or a reply) as the primary CTA."
        );
      }

      if (automationType === "CUSTOM") {
        lines.push(`Custom schedule: ${customFrequency.toLowerCase()}.`);
      }

      if (ctaText.trim()) {
        lines.push(`Primary CTA text: "${ctaText.trim()}".`);
      }
      if (ctaUrl.trim()) {
        lines.push(`Primary CTA link target: ${ctaUrl.trim()}.`);
      }

      if (aiBrief.trim()) lines.push(`User direction: ${aiBrief.trim()}`);
      return lines.join("\n");
    },
    [
      aiBrief,
      automationName,
      automationType,
      birthdayContactsWithImage,
      ctaText,
      ctaUrl,
      customFrequency,
      eligibleBirthdayCount,
      imageStrategy,
      selectedList,
      tone,
    ]
  );

  const handleGenerateEventEmail = useCallback(
    async (eventKey: string) => {
      const tab = eventTabs.find((item) => item.key === eventKey);
      if (!tab) return;

      setEventEmails((current) => ({
        ...current,
        [eventKey]: {
          ...(current[eventKey] || {
            key: eventKey,
            label: tab.label,
            dateLabel: tab.dateLabel,
            subject: "",
            preheader: "",
            sections: [],
            contentHtml: "",
            isGenerated: false,
            isGenerating: false,
          }),
          isGenerating: true,
          label: tab.label,
          dateLabel: tab.dateLabel,
        },
      }));

      try {
        const response = await fetch("/api/email-templates/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: buildAiPromptForEvent(eventKey),
            mode: "template",
            category: categoryForType(automationType),
            tone,
          }),
        });
        const data = await response.json();
        if (!data.success) {
          throw new Error(apiErrorMessage(data, "Generation failed"));
        }

        const sections: EmailSection[] = data.data.sections || [];
        const contentHtml: string =
          data.data.contentHtml ||
          renderEmailHtml(sections, state.brandKit || undefined, {
            showLogo: state.showLogo,
            showBrandName: state.showBrandName,
            logoSize: state.logoSize,
          });

        setEventEmails((current) => ({
          ...current,
          [eventKey]: {
            key: eventKey,
            label: tab.label,
            dateLabel: tab.dateLabel,
            subject: data.data.subject || "",
            preheader: data.data.preheader || "",
            sections,
            contentHtml,
            isGenerated: true,
            isGenerating: false,
            generatedAt: Date.now(),
          },
        }));

        toast({
          title:
            automationType === "HOLIDAY"
              ? `Generated email for ${tab.label}`
              : "Automation email generated",
          description: data.data.creditsUsed ? `Used ${data.data.creditsUsed} credits` : undefined,
        });
      } catch (error) {
        setEventEmails((current) => ({
          ...current,
          [eventKey]: {
            ...(current[eventKey] || {
              key: eventKey,
              label: tab.label,
              dateLabel: tab.dateLabel,
              subject: "",
              preheader: "",
              sections: [],
              contentHtml: "",
              isGenerated: false,
              isGenerating: false,
            }),
            isGenerating: false,
          },
        }));
        toast({
          title: error instanceof Error ? error.message : "Generation failed",
          variant: "destructive",
        });
      }
    },
    [
      automationType,
      buildAiPromptForEvent,
      eventTabs,
      state.brandKit,
      state.logoSize,
      state.showBrandName,
      state.showLogo,
      toast,
      tone,
    ]
  );

  const handleGenerateAllPending = useCallback(async () => {
    for (const tab of eventTabs) {
      const existing = eventEmails[tab.key];
      if (!existing || !existing.isGenerated) {
        await handleGenerateEventEmail(tab.key);
      }
    }
  }, [eventEmails, eventTabs, handleGenerateEventEmail]);

  // Sync the active event's draft into the campaign-form state so the
  // existing EditorStep can act on it. Triggered when the user opens the
  // builder for a specific event.
  const openEditorForEvent = useCallback(
    (eventKey: string) => {
      const entry = eventEmails[eventKey];
      if (!entry) return;
      dispatch({
        type: "LOAD_TEMPLATE",
        templateId: "",
        templateName: entry.label,
        sections: entry.sections,
        subject: entry.subject,
        preheader: entry.preheader,
      });
      dispatch({ type: "SET_CAMPAIGN_NAME", value: automationName || defaultAutomationName(automationType) });
      setEditingEventKey(eventKey);
    },
    [automationName, automationType, dispatch, eventEmails]
  );

  // Persist the edited content back into the per-event record and close
  // the editor.
  const closeEditor = useCallback(() => {
    if (!editingEventKey) return;
    const contentHtml = renderEmailHtml(state.sections, state.brandKit || undefined, {
      showLogo: state.showLogo,
      showBrandName: state.showBrandName,
      logoSize: state.logoSize,
    });
    setEventEmails((current) => {
      const existing = current[editingEventKey];
      if (!existing) return current;
      return {
        ...current,
        [editingEventKey]: {
          ...existing,
          sections: state.sections,
          subject: state.subject,
          preheader: state.preheader,
          contentHtml,
          isGenerated: true,
        },
      };
    });
    setEditingEventKey(null);
  }, [
    editingEventKey,
    state.brandKit,
    state.logoSize,
    state.preheader,
    state.sections,
    state.showBrandName,
    state.showLogo,
    state.subject,
  ]);

  const handleOptimize = useCallback(async () => {
    dispatch({ type: "SET_GENERATING", value: true });
    try {
      const response = await fetch("/api/email-templates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "optimize",
          subject: state.subject,
          sections: state.sections,
        }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(apiErrorMessage(data, "Optimization failed"));
      setOptimizationData(data.data);
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Optimization failed",
        variant: "destructive",
      });
    } finally {
      dispatch({ type: "SET_GENERATING", value: false });
    }
  }, [dispatch, state.sections, state.subject, toast]);

  const handleSaveAsTemplate = useCallback(async () => {
    try {
      const response = await fetch("/api/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: state.campaignName || automationName || state.subject || "Automation Template",
          category: categoryForType(automationType),
          subject: state.subject,
          preheader: state.preheader,
          sections: state.sections,
          source: "manual",
        }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(apiErrorMessage(data, "Failed to save template"));
      dispatch({ type: "LOAD_CAMPAIGN", state: { selectedTemplateId: data.data.id } });
      toast({ title: "Template saved" });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Failed to save template",
        variant: "destructive",
      });
    }
  }, [
    automationName,
    automationType,
    dispatch,
    state.campaignName,
    state.preheader,
    state.sections,
    state.subject,
    toast,
  ]);

  const handleOverwriteTemplate = useCallback(async () => {
    if (!state.selectedTemplateId) return;
    try {
      const response = await fetch(`/api/email-templates/${state.selectedTemplateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sections: state.sections,
          subject: state.subject,
          preheader: state.preheader,
        }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(apiErrorMessage(data, "Failed to update template"));
      toast({ title: "Template updated" });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Failed to update template",
        variant: "destructive",
      });
    }
  }, [state.preheader, state.sections, state.selectedTemplateId, state.subject, toast]);

  const buildTriggerBase = () => {
    const base: Record<string, unknown> = {
      source: "automation_builder",
      aiAssisted: true,
      contentSetup: {
        tone,
        imageStrategy,
        ctaText: ctaText.trim() || undefined,
        ctaUrl: ctaUrl.trim() || undefined,
      },
      audienceName: selectedList?.name || "No contact list selected",
    };

    if (automationType === "BIRTHDAY") {
      base.birthdayListConfirmed = birthdayConfirmed;
      base.birthdayStats = birthdayStats;
      base.eligibleBirthdayContacts = eligibleBirthdayCount;
      base.includeContactPhoto = imageStrategy === "contact_photo" || imageStrategy === "ai_per_contact";
      base.contactPhotoEligibleCount = birthdayContactsWithImage;
      base.birthdayPreview = eligibleBirthdayContacts.slice(0, 20);
    } else if (automationType === "HOLIDAY") {
      base.calendarScope = isEveryHolidaySelected ? "all_us_calendar" : "selected_calendar_events";
      base.holidayIds = selectedHolidayIds;
      base.selectedHolidayIds = selectedHolidayIds;
    } else if (automationType === "WELCOME") {
      base.event = "new_contact";
      base.lookbackDays = 30;
    } else {
      base.frequency = customFrequency;
      if (customFrequency === "ONCE" && customScheduledDate) {
        base.scheduledAt = new Date(`${customScheduledDate}T${sendTime || "09:00"}`).toISOString();
      }
      if (customFrequency === "WEEKLY") {
        base.dayOfWeek = Number(customDayOfWeek);
      }
      if (customFrequency === "MONTHLY") {
        base.dayOfMonth = Number(customDayOfMonth);
      }
    }

    return base;
  };

  const handleCreateAutomation = async () => {
    if (!canActivate) {
      toast({
        title: "Finish the automation setup",
        description: "Generate a unique email for every selected event before activating.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      if (!state.selectedContactListId) {
        throw new Error("Select a contact list before creating this automation");
      }

      // Use the first generated email as the top-level fallback the backend
      // assigns to any automation without its own override.
      const firstKey = eventTabs[0]?.key;
      const fallback = firstKey ? eventEmails[firstKey] : undefined;
      if (!fallback || !fallback.isGenerated) {
        throw new Error("Generate every event email before activating.");
      }

      const emails = eventTabs
        .map((tab) => {
          const entry = eventEmails[tab.key];
          if (!entry) return null;
          const content = sectionsToPlainText(entry.sections).trim() || entry.subject || automationName;
          return {
            holidayId: automationType === "HOLIDAY" ? tab.key : undefined,
            subject: entry.subject,
            content,
            contentHtml: entry.contentHtml,
          };
        })
        .filter((entry): entry is { holidayId: string | undefined; subject: string; content: string; contentHtml: string } => !!entry);

      const fallbackContent =
        sectionsToPlainText(fallback.sections).trim() || fallback.subject || automationName;

      const trigger = buildTriggerBase();

      const response = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: automationName.trim(),
          type: automationType,
          trigger,
          campaignType: "EMAIL",
          templateId: null,
          subject: fallback.subject,
          content: fallbackContent,
          contentHtml: fallback.contentHtml,
          sendTime,
          daysOffset,
          timezone,
          contactListId: state.selectedContactListId || null,
          imageSource: automationType === "BIRTHDAY" && (imageStrategy === "contact_photo" || imageStrategy === "ai_per_contact")
            ? "contact_photo"
            : null,
          imageUrl: null,
          imageOverlayText: null,
          enabled,
          emails,
        }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(apiErrorMessage(data, "Failed to create automation"));

      const createdCount = data.data?.createdCount || data.data?.automations?.length || 1;
      toast({
        title: createdCount > 1 ? "Calendar automations created" : "Automation created",
        description:
          createdCount > 1
            ? `${createdCount} calendar event automations are ready — each with its own email.`
            : enabled
              ? "Your automation is enabled and ready."
              : "Your automation was saved as disabled.",
      });
      router.push("/email-marketing/automations");
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Failed to create automation",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const sampleContact = useMemo(
    () => birthdayContacts.find((contact) => contact.id === sampleContactId) || null,
    [birthdayContacts, sampleContactId]
  );

  const activeEventEmail = eventEmails[activeEventKey];

  const renderPreviewHtml = (entry: EventEmail | undefined) => {
    if (!entry || !entry.contentHtml) return "";
    if (automationType === "BIRTHDAY") {
      return previewMergeReplace(entry.contentHtml, sampleContact, "Friend");
    }
    if (automationType === "HOLIDAY") {
      const holiday = US_HOLIDAYS.find((item) => item.id === entry.key);
      const extra: Record<string, string> = {};
      if (holiday) {
        extra.holidayName = holiday.name;
        extra.eventName = holiday.name;
        extra.holidayDate = holidayDateLabel(holiday.id);
        extra.eventDate = holidayDateLabel(holiday.id);
      }
      return previewMergeReplace(entry.contentHtml, null, "Friend", extra);
    }
    return previewMergeReplace(entry.contentHtml, null, "Friend");
  };

  return (
    <div className="flex-1 space-y-6 pb-8">
      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/email-marketing/automations">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1 border-brand-200 bg-brand-50 text-brand-700">
                  <Mail className="h-3.5 w-3.5" />
                  Email Automation
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Bot className="h-3.5 w-3.5" />
                  AI assisted
                </Badge>
              </div>
              <h1 className="mt-2 text-2xl font-bold">Create Email Automation</h1>
              <p className="text-sm text-muted-foreground">
                Pick the event, choose how the content should look, then preview a unique email per event before activating.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/email-marketing/campaigns/create">
                <Mail className="mr-2 h-4 w-4" />
                Create Campaign
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-3">
        <div className="flex items-center justify-between gap-2 overflow-x-auto">
          {STEPS.map((item, index) => {
            const Icon = item.icon;
            const isActive = item.id === step;
            const isComplete = index < currentStepIndex;
            const canJump =
              item.id === "event" ||
              (item.id === "content" && canProceedFromEvent) ||
              (item.id === "preview" && canProceedFromContent) ||
              (item.id === "activate" && canProceedFromPreview);
            return (
              <div key={item.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (canJump) setStep(item.id);
                  }}
                  className={cn(
                    "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-xs font-medium transition-colors",
                    isActive
                      ? "bg-brand-500 text-white"
                      : isComplete
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {isComplete ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                  {item.label}
                </button>
                {index < STEPS.length - 1 && <div className="hidden h-px w-12 bg-border sm:block" />}
              </div>
            );
          })}
        </div>
      </div>

      {step === "event" && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Step 1 — Select the event</CardTitle>
                <CardDescription>
                  Choose what triggers the email. For calendar events you can pick several — each one will get its own
                  uniquely generated email in step 3.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {AUTOMATION_TYPES.map((item) => {
                    const Icon = item.icon;
                    const selected = automationType === item.type;
                    return (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => handleSelectType(item.type)}
                        className={cn(
                          "flex min-h-[150px] flex-col items-start rounded-lg border p-4 text-left transition-colors",
                          selected
                            ? "border-brand-500 bg-brand-50 text-brand-950 shadow-sm"
                            : "bg-card hover:border-brand-300 hover:bg-muted/50"
                        )}
                      >
                        <span
                          className={cn(
                            "mb-3 flex h-10 w-10 items-center justify-center rounded-lg",
                            selected ? "bg-brand-500 text-white" : "bg-muted text-muted-foreground"
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="font-semibold">{item.label}</span>
                        <span className="mt-1 text-xs leading-5 text-muted-foreground">
                          {item.description}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-2">
                    <Label htmlFor="automation-name">Automation Name *</Label>
                    <Input
                      id="automation-name"
                      value={automationName}
                      onChange={(event) => {
                        setAutomationName(event.target.value);
                        dispatch({ type: "SET_CAMPAIGN_NAME", value: event.target.value });
                      }}
                      placeholder="e.g., Birthday VIP Offer"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact List *</Label>
                    {loadingLists ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Select
                        value={state.selectedContactListId || undefined}
                        onValueChange={(value) =>
                          dispatch({ type: "SET_CONTACT_LIST", id: value })
                        }
                        disabled={contactLists.length === 0}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a contact list" />
                        </SelectTrigger>
                        <SelectContent>
                          {contactLists.map((list) => (
                            <SelectItem key={list.id} value={list.id}>
                              {list.name} ({list.activeCount || list.totalCount} active)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {contactLists.length === 0 && !loadingLists
                        ? "Create a contact list first, then return to automate it."
                        : "Select the saved contact list this automation should use."}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {automationType === "HOLIDAY" && (
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <CalendarDays className="h-5 w-5 text-brand-500" />
                        Pick the calendar events
                      </CardTitle>
                      <CardDescription>
                        Each event gets its own automation AND its own uniquely generated email.
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedHolidayIds(US_HOLIDAYS.map((holiday) => holiday.id));
                          setCalendarConfirmed(false);
                        }}
                      >
                        Select All
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedHolidayIds([]);
                          setCalendarConfirmed(false);
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {US_HOLIDAYS.map((holiday) => {
                      const checked = selectedHolidayIds.includes(holiday.id);
                      return (
                        <button
                          key={holiday.id}
                          type="button"
                          onClick={() => toggleHoliday(holiday.id)}
                          className={cn(
                            "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                            checked ? "border-brand-400 bg-brand-50" : "hover:bg-muted/50"
                          )}
                        >
                          <Checkbox
                            checked={checked}
                            onClick={(event) => event.stopPropagation()}
                            onCheckedChange={() => toggleHoliday(holiday.id)}
                          />
                          <span className="text-lg leading-none">{holiday.icon}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{holiday.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {holidayDateLabel(holiday.id)} - {holiday.category}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-semibold">
                        {selectedHolidayIds.length} of {US_HOLIDAYS.length} calendar events selected
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isEveryHolidaySelected
                          ? "FlowSmartly will create an automation per event for the full calendar."
                          : "Only the selected calendar events will be automated."}
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <Checkbox
                        checked={calendarConfirmed}
                        onCheckedChange={(checked) => setCalendarConfirmed(checked === true)}
                        disabled={selectedHolidayIds.length === 0}
                      />
                      Confirm selected events
                    </label>
                  </div>
                </CardContent>
              </Card>
            )}

            {automationType === "BIRTHDAY" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Cake className="h-5 w-5 text-pink-500" />
                    Birthday audience readiness
                  </CardTitle>
                  <CardDescription>
                    Birthday automations send one personalised email per contact on their birthday.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {loadingBirthdayData ? (
                    <div className="grid gap-3 md:grid-cols-4">
                      <Skeleton className="h-24 rounded-lg" />
                      <Skeleton className="h-24 rounded-lg" />
                      <Skeleton className="h-24 rounded-lg" />
                      <Skeleton className="h-24 rounded-lg" />
                    </div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-4">
                      <div className="rounded-lg border p-4">
                        <p className="text-xs text-muted-foreground">Contacts in scope</p>
                        <p className="mt-1 text-2xl font-bold">{birthdayStats?.total || 0}</p>
                      </div>
                      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                        <p className="text-xs text-green-700">With birthday dates</p>
                        <p className="mt-1 text-2xl font-bold text-green-700">
                          {birthdayStats?.withBirthday || 0}
                        </p>
                      </div>
                      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                        <p className="text-xs text-blue-700">Valid email + opted in</p>
                        <p className="mt-1 text-2xl font-bold text-blue-700">{emailReadyCount}</p>
                      </div>
                      <div className="rounded-lg border p-4">
                        <p className="text-xs text-muted-foreground">Eligible to automate</p>
                        <p className="mt-1 text-2xl font-bold">{eligibleBirthdayCount}</p>
                      </div>
                    </div>
                  )}

                  <div className="rounded-lg border">
                    <div className="flex items-center justify-between border-b px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold">Birthday contact readiness</p>
                        <p className="text-xs text-muted-foreground">
                          Add missing birthdays and contact photos before activation. AI image generation per contact
                          happens here so each contact gets a personalised image.
                        </p>
                      </div>
                      <Badge variant="outline">{selectedList?.name || "Select a list"}</Badge>
                    </div>
                    <div className="max-h-[560px] divide-y overflow-auto">
                      {birthdayContacts.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                          No active contacts were found for this list.
                        </div>
                      ) : (
                        birthdayContacts.map((contact) => (
                          <div
                            key={contact.id}
                            className="grid gap-3 px-4 py-3 xl:grid-cols-[minmax(220px,1.25fr)_minmax(180px,1fr)_160px_minmax(260px,1.25fr)_120px] xl:items-center"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="relative">
                                {contact.imageUrl ? (
                                  <img
                                    src={contact.imageUrl}
                                    alt=""
                                    className="h-11 w-11 shrink-0 rounded-full border object-cover"
                                  />
                                ) : (
                                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border bg-muted text-xs font-semibold">
                                    {contact.name.slice(0, 1).toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{contact.name}</p>
                                <p className="truncate text-xs text-muted-foreground">{contact.email || "No email"}</p>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={hasUsableEmail(contact) ? "secondary" : "outline"}>
                                {hasUsableEmail(contact) ? "Email ready" : "Email not ready"}
                              </Badge>
                              {contact.imageUrl ? (
                                <Badge variant="outline" className="gap-1">
                                  <ImageIcon className="h-3 w-3" />
                                  Image
                                </Badge>
                              ) : (
                                <Badge variant="outline">No image</Badge>
                              )}
                              {contact.birthday && (
                                <Badge variant="secondary">{formatBirthday(contact.birthday)}</Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <Input
                                value={birthdayDrafts[contact.id] ?? ""}
                                onChange={(event) => handleBirthdayDraftChange(contact.id, event.target.value)}
                                onBlur={() => handleSaveContactBirthday(contact)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    handleSaveContactBirthday(contact);
                                  }
                                }}
                                placeholder="MM-DD"
                                inputMode="numeric"
                                maxLength={5}
                                disabled={!!updatingBirthdayContactIds[contact.id]}
                                className="h-9"
                              />
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                onClick={() => handleSaveContactBirthday(contact)}
                                disabled={updatingBirthdayContactIds[contact.id] === "birthday"}
                                className="h-9 w-9 shrink-0"
                              >
                                {updatingBirthdayContactIds[contact.id] === "birthday" ? (
                                  <AISpinner size={16} />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                              </Button>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                id={`birthday-photo-${contact.id}`}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(event) => {
                                  const file = event.target.files?.[0];
                                  handleUploadContactImage(contact, file);
                                  event.target.value = "";
                                }}
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => document.getElementById(`birthday-photo-${contact.id}`)?.click()}
                                disabled={!!updatingBirthdayContactIds[contact.id]}
                              >
                                {updatingBirthdayContactIds[contact.id] === "image" ? (
                                  <AISpinner size={14} className="mr-2" />
                                ) : (
                                  <Upload className="mr-2 h-3.5 w-3.5" />
                                )}
                                Upload
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleGenerateContactBirthdayImage(contact)}
                                disabled={!contact.imageUrl || !!updatingBirthdayContactIds[contact.id]}
                              >
                                {updatingBirthdayContactIds[contact.id] === "ai" ? (
                                  <AISpinner size={14} className="mr-2" />
                                ) : (
                                  <Gift className="mr-2 h-3.5 w-3.5" />
                                )}
                                AI image
                              </Button>
                            </div>

                            <div className="flex xl:justify-end">
                              {!!contact.birthday && hasUsableEmail(contact) ? (
                                <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                                  Eligible
                                </Badge>
                              ) : !hasUsableEmail(contact) ? (
                                <Badge variant="outline">Email blocked</Badge>
                              ) : (
                                <Badge variant="outline">
                                  Add birthday
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4">
                    <Checkbox
                      checked={birthdayConfirmed}
                      onCheckedChange={(checked) => setBirthdayConfirmed(checked === true)}
                      disabled={eligibleBirthdayCount === 0}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-semibold">Confirm birthday automation audience</p>
                      <p className="text-xs leading-5 text-muted-foreground">
                        I confirm this automation will target{" "}
                        <span className="font-medium text-foreground">
                          {eligibleBirthdayCount} contacts with birthday dates, valid email, and email opt-in
                        </span>{" "}
                        from {selectedList?.name || "the selected contact list"}. {emailReadyCount} contact
                        {emailReadyCount === 1 ? " is" : "s are"} email-ready in this list.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {automationType === "CUSTOM" && (
              <Card>
                <CardHeader>
                  <CardTitle>Custom schedule</CardTitle>
                  <CardDescription>Choose when the custom automation should run.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Select value={customFrequency} onValueChange={setCustomFrequency}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ONCE">One time</SelectItem>
                        <SelectItem value="DAILY">Daily</SelectItem>
                        <SelectItem value="WEEKLY">Weekly</SelectItem>
                        <SelectItem value="MONTHLY">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {customFrequency === "ONCE" && (
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={customScheduledDate}
                        onChange={(event) => setCustomScheduledDate(event.target.value)}
                      />
                    </div>
                  )}
                  {customFrequency === "WEEKLY" && (
                    <div className="space-y-2">
                      <Label>Day of week</Label>
                      <Select value={customDayOfWeek} onValueChange={setCustomDayOfWeek}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {WEEKDAYS.map((day) => (
                            <SelectItem key={day.value} value={day.value}>{day.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {customFrequency === "MONTHLY" && (
                    <div className="space-y-2">
                      <Label>Day of month</Label>
                      <Input
                        type="number"
                        min={1}
                        max={28}
                        value={customDayOfMonth}
                        onChange={(event) => setCustomDayOfMonth(event.target.value)}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Step 1 readiness</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Trigger</span>
                  <Badge variant="outline">{AUTOMATION_TYPES.find((item) => item.type === automationType)?.label}</Badge>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Audience</span>
                  <span className="text-right font-medium">{selectedList?.name || "No list selected"}</span>
                </div>
                {automationType === "HOLIDAY" && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Events</span>
                    <span className="font-medium">{selectedHolidayIds.length}</span>
                  </div>
                )}
                {automationType === "BIRTHDAY" && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Eligible birthday emails</span>
                    <span className="font-medium">{eligibleBirthdayCount}</span>
                  </div>
                )}
                <div className="rounded-lg bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
                  {canProceedFromEvent
                    ? "Event confirmed. Continue to content setup."
                    : "Confirm the required event details to continue."}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {step === "content" && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Step 2 — Content setup</CardTitle>
                <CardDescription>
                  Choose how the AI should write and illustrate the email. These settings apply to every event email
                  generated in the next step.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Tone</Label>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {TONE_OPTIONS.map((option) => {
                      const selected = tone === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setTone(option.value)}
                          className={cn(
                            "rounded-lg border p-3 text-left transition-colors",
                            selected ? "border-brand-500 bg-brand-50" : "hover:bg-muted/50"
                          )}
                        >
                          <p className="text-sm font-semibold">{option.label}</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">{option.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Image strategy</Label>
                  <div className="grid gap-3 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setImageStrategy("none")}
                      className={cn(
                        "rounded-lg border p-3 text-left transition-colors",
                        imageStrategy === "none" ? "border-brand-500 bg-brand-50" : "hover:bg-muted/50"
                      )}
                    >
                      <p className="text-sm font-semibold">No image</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Text-only email. Fastest to send.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageStrategy("ai_per_event")}
                      className={cn(
                        "rounded-lg border p-3 text-left transition-colors",
                        imageStrategy === "ai_per_event" ? "border-brand-500 bg-brand-50" : "hover:bg-muted/50"
                      )}
                    >
                      <p className="text-sm font-semibold">AI image per event</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Each event gets its own AI-generated header image, themed to the occasion.
                      </p>
                    </button>
                    {automationType === "BIRTHDAY" && (
                      <button
                        type="button"
                        onClick={() => setImageStrategy("contact_photo")}
                        disabled={birthdayContactsWithImage === 0}
                        className={cn(
                          "rounded-lg border p-3 text-left transition-colors",
                          imageStrategy === "contact_photo" ? "border-brand-500 bg-brand-50" : "hover:bg-muted/50",
                          birthdayContactsWithImage === 0 ? "cursor-not-allowed opacity-60" : ""
                        )}
                      >
                        <p className="flex items-center gap-2 text-sm font-semibold">
                          <UserCircle2 className="h-4 w-4" />
                          Use contact's photo
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {birthdayContactsWithImage > 0
                            ? `Embeds the contact's own image (${birthdayContactsWithImage} ready).`
                            : "Add contact photos first in Step 1 to enable this."}
                        </p>
                      </button>
                    )}
                    {automationType === "BIRTHDAY" && (
                      <button
                        type="button"
                        onClick={() => setImageStrategy("ai_per_contact")}
                        disabled={birthdayContactsWithImage === 0}
                        className={cn(
                          "rounded-lg border p-3 text-left transition-colors",
                          imageStrategy === "ai_per_contact" ? "border-brand-500 bg-brand-50" : "hover:bg-muted/50",
                          birthdayContactsWithImage === 0 ? "cursor-not-allowed opacity-60" : ""
                        )}
                      >
                        <p className="flex items-center gap-2 text-sm font-semibold">
                          <Sparkles className="h-4 w-4" />
                          AI birthday image per contact
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          Generate or refresh per-contact AI birthday images from Step 1 — used here automatically.
                        </p>
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="cta-text">CTA text (optional)</Label>
                    <Input
                      id="cta-text"
                      value={ctaText}
                      onChange={(event) => setCtaText(event.target.value)}
                      placeholder="e.g., Claim your birthday gift"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cta-url">CTA link (optional)</Label>
                    <Input
                      id="cta-url"
                      value={ctaUrl}
                      onChange={(event) => setCtaUrl(event.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ai-brief">AI direction (optional)</Label>
                  <Textarea
                    id="ai-brief"
                    value={aiBrief}
                    onChange={(event) => setAiBrief(event.target.value)}
                    rows={4}
                    placeholder="Example: keep it concise, mention our loyalty program, and include a soft offer."
                  />
                  <p className="text-xs text-muted-foreground">
                    Used as extra direction when generating each event's email. Holiday-specific context is added
                    automatically per event so each email stays unique.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">What gets generated next</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Events to generate</span>
                  <Badge variant="outline">{eventTabs.length}</Badge>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Tone</span>
                  <Badge variant="secondary">{tone}</Badge>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Image strategy</span>
                  <Badge variant="secondary">{imageStrategy.replace(/_/g, " ")}</Badge>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
                  In step 3 you'll see a uniquely generated email per event — preview, regenerate, or edit any one in
                  the builder.
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-6">
          {editingEventKey ? (
            <div className="space-y-3">
              <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    Editing email — {eventEmails[editingEventKey]?.label}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Changes here apply to this event only. Click "Done editing" to save and return to the preview.
                  </p>
                </div>
                <Button variant="outline" onClick={closeEditor}>
                  Done editing
                </Button>
              </div>
              <EditorStep
                sections={state.sections}
                subject={state.subject}
                preheader={state.preheader}
                brand={state.brandKit}
                showLogo={state.showLogo}
                showBrandName={state.showBrandName}
                logoSize={state.logoSize as LogoSize}
                campaignName={state.campaignName || automationName}
                isGenerating={state.isGenerating}
                optimizationData={optimizationData}
                selectedTemplateId={state.selectedTemplateId || null}
                selectedTemplateName={state.templateName || undefined}
                onSubjectChange={(value) => dispatch({ type: "SET_SUBJECT", value })}
                onPreheaderChange={(value) => dispatch({ type: "SET_PREHEADER", value })}
                onCampaignNameChange={(value) => {
                  dispatch({ type: "SET_CAMPAIGN_NAME", value });
                  setAutomationName(value);
                }}
                onAddSection={(section) => dispatch({ type: "ADD_SECTION", section })}
                onUpdateSection={(id, updates) => dispatch({ type: "UPDATE_SECTION", id, updates })}
                onDeleteSection={(id) => dispatch({ type: "DELETE_SECTION", id })}
                onDuplicateSection={(id) => dispatch({ type: "DUPLICATE_SECTION", id })}
                onReorderSections={(activeId, overId) =>
                  dispatch({ type: "REORDER_SECTIONS", activeId, overId })
                }
                onToggleLogo={(value) => dispatch({ type: "SET_BRAND_OPTIONS", showLogo: value })}
                onToggleBrandName={(value) => dispatch({ type: "SET_BRAND_OPTIONS", showBrandName: value })}
                onLogoSize={(value) => dispatch({ type: "SET_BRAND_OPTIONS", logoSize: value })}
                onOptimize={handleOptimize}
                onClearOptimization={() => setOptimizationData(null)}
                onSaveAsTemplate={handleSaveAsTemplate}
                onOverwriteTemplate={handleOverwriteTemplate}
              />
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Step 3 — Preview samples</h2>
                  <p className="text-sm text-muted-foreground">
                    Each event below is generated independently using the holiday/event context — never a shared
                    template with swapped titles.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {automationType === "BIRTHDAY" && birthdayContacts.length > 0 && (
                    <Select value={sampleContactId} onValueChange={setSampleContactId}>
                      <SelectTrigger className="w-[260px]">
                        <SelectValue placeholder="Preview as contact" />
                      </SelectTrigger>
                      <SelectContent>
                        {birthdayContacts.map((contact) => (
                          <SelectItem key={contact.id} value={contact.id}>
                            {contact.name}
                            {contact.birthday ? ` • ${formatBirthday(contact.birthday)}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button
                    variant="outline"
                    onClick={handleGenerateAllPending}
                    disabled={anyEventGenerating || allEventsGenerated}
                  >
                    {anyEventGenerating ? (
                      <AISpinner size={16} className="mr-2" />
                    ) : (
                      <Wand2 className="mr-2 h-4 w-4" />
                    )}
                    {allEventsGenerated ? "All generated" : "Generate all pending"}
                  </Button>
                </div>
              </div>

              {eventTabs.length > 1 && (
                <div className="flex flex-wrap gap-2 rounded-lg border bg-muted/40 p-2">
                  {eventTabs.map((tab) => {
                    const entry = eventEmails[tab.key];
                    const isActive = tab.key === activeEventKey;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveEventKey(tab.key)}
                        className={cn(
                          "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-xs font-medium transition-colors",
                          isActive
                            ? "bg-brand-500 text-white"
                            : entry?.isGenerated
                              ? "bg-green-100 text-green-700"
                              : "bg-card text-muted-foreground hover:bg-muted/60"
                        )}
                      >
                        {tab.icon ? <span className="text-base">{tab.icon}</span> : null}
                        <span>{tab.label}</span>
                        {tab.dateLabel ? <span className="opacity-70">· {tab.dateLabel}</span> : null}
                        {entry?.isGenerating ? <AISpinner size={12} /> : null}
                        {entry?.isGenerated ? <Check className="h-3 w-3" /> : null}
                      </button>
                    );
                  })}
                </div>
              )}

              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Eye className="h-5 w-5 text-brand-500" />
                        {eventTabs.find((tab) => tab.key === activeEventKey)?.label || "Preview"}
                      </CardTitle>
                      <CardDescription>
                        {automationType === "BIRTHDAY"
                          ? sampleContact
                            ? `Showing how this email will render for ${sampleContact.name}${
                                sampleContact.birthday ? ` (birthday ${formatBirthday(sampleContact.birthday)})` : ""
                              }. Each contact gets a personalised version on their birthday.`
                            : "Pick a sample contact above to preview personalised content."
                          : automationType === "HOLIDAY"
                            ? "This preview is generated specifically for this event — not a shared template."
                            : "Preview rendered with sample placeholders for missing merge tags."}
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleGenerateEventEmail(activeEventKey)}
                        disabled={activeEventEmail?.isGenerating || anyEventGenerating}
                      >
                        {activeEventEmail?.isGenerating ? (
                          <AISpinner size={16} className="mr-2" />
                        ) : (
                          <Wand2 className="mr-2 h-4 w-4" />
                        )}
                        {activeEventEmail?.isGenerated ? "Regenerate" : "Generate"}
                      </Button>
                      {activeEventEmail?.isGenerated && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditorForEvent(activeEventKey)}
                        >
                          Edit in builder
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {!activeEventEmail || !activeEventEmail.isGenerated ? (
                    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/40 px-6 py-16 text-center">
                      <Sparkles className="h-8 w-8 text-brand-500" />
                      <div>
                        <p className="text-sm font-semibold">No preview yet</p>
                        <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
                          {automationType === "HOLIDAY"
                            ? "Generate a unique email specifically for this event. The AI will use the event name, date, and category as context."
                            : "Generate the email to see a personalised preview."}
                        </p>
                      </div>
                      <Button
                        onClick={() => handleGenerateEventEmail(activeEventKey)}
                        disabled={activeEventEmail?.isGenerating}
                        className="bg-brand-500 hover:bg-brand-600"
                      >
                        {activeEventEmail?.isGenerating ? (
                          <AISpinner size={16} className="mr-2" />
                        ) : (
                          <Wand2 className="mr-2 h-4 w-4" />
                        )}
                        Generate this email
                        {creditCost ? ` (${creditCost} credits)` : ""}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-lg border bg-muted/40 p-4 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold">Subject</p>
                          <Badge variant="outline">{automationType}</Badge>
                        </div>
                        <p className="mt-1">{previewMergeReplace(activeEventEmail.subject, sampleContact, "Friend")}</p>
                        {activeEventEmail.preheader && (
                          <>
                            <p className="mt-3 font-semibold">Preheader</p>
                            <p className="mt-1 text-muted-foreground">
                              {previewMergeReplace(activeEventEmail.preheader, sampleContact, "Friend")}
                            </p>
                          </>
                        )}
                      </div>
                      <div className="overflow-hidden rounded-lg border">
                        <iframe
                          title="Email preview"
                          srcDoc={renderPreviewHtml(activeEventEmail)}
                          className="h-[640px] w-full bg-white"
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {step === "activate" && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-brand-500" />
                  Send timing
                </CardTitle>
                <CardDescription>
                  Configure when FlowSmartly sends the automated email.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Days offset</Label>
                  <Select value={String(daysOffset)} onValueChange={(value) => setDaysOffset(Number(value))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS_OFFSET_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Send time</Label>
                  <Input type="time" value={sendTime} onChange={(event) => setSendTime(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Audience confirmation</CardTitle>
                <CardDescription>
                  Review the audience and trigger before enabling the automation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border p-4">
                    <p className="text-xs text-muted-foreground">Contact list</p>
                    <p className="mt-1 font-semibold">{selectedList?.name || "No list selected"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {selectedList
                        ? `${selectedList.activeCount || selectedList.totalCount} active contacts`
                        : "Choose a contact list in Step 1 before activating."}
                    </p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-xs text-muted-foreground">Trigger scope</p>
                    <p className="mt-1 font-semibold">
                      {automationType === "HOLIDAY"
                        ? `${selectedHolidayIds.length} calendar event${selectedHolidayIds.length === 1 ? "" : "s"}`
                        : automationType === "BIRTHDAY"
                          ? `${eligibleBirthdayCount} birthday email contacts`
                          : AUTOMATION_TYPES.find((item) => item.type === automationType)?.label}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {automationType === "HOLIDAY" && selectedHolidays.slice(0, 3).map((holiday) => holiday.name).join(", ")}
                      {automationType === "HOLIDAY" && selectedHolidays.length > 3 ? `, +${selectedHolidays.length - 3} more` : ""}
                      {automationType === "BIRTHDAY" && (imageStrategy === "contact_photo" || imageStrategy === "ai_per_contact")
                        ? `Contact photos enabled for ${birthdayContactsWithImage} contacts with images.`
                        : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-4">
                  <div>
                    <p className="font-medium">Enable immediately</p>
                    <p className="text-xs text-muted-foreground">
                      Turn this off if you want to finish setup but keep the automation paused.
                    </p>
                  </div>
                  <Switch checked={enabled} onCheckedChange={setEnabled} />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Activation summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Name</span>
                  <span className="text-right font-medium">{automationName}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Events generated</span>
                  <span className="font-medium">
                    {eventTabs.filter((tab) => eventEmails[tab.key]?.isGenerated).length} / {eventTabs.length}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Send time</span>
                  <span className="font-medium">{sendTime}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={enabled ? "default" : "secondary"}>{enabled ? "Enabled" : "Paused"}</Badge>
                </div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
                {automationType === "HOLIDAY"
                  ? "FlowSmartly will create one automation per event, each with its own unique generated email."
                  : "FlowSmartly will personalise this email per contact at send time using merge tags."}
              </div>
              <Button
                onClick={handleCreateAutomation}
                disabled={isCreating || !canActivate}
                className="w-full bg-brand-500 hover:bg-brand-600"
              >
                {isCreating ? <AISpinner size={16} className="mr-2" /> : <Zap className="mr-2 h-4 w-4" />}
                {automationType === "HOLIDAY" && selectedHolidayIds.length > 1
                  ? `Create ${selectedHolidayIds.length} automations`
                  : "Create automation"}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex items-center justify-between border-t pt-4">
        <Button
          variant="ghost"
          onClick={() => {
            if (step === "event") router.push("/email-marketing/automations");
            if (step === "content") setStep("event");
            if (step === "preview") {
              if (editingEventKey) {
                closeEditor();
              } else {
                setStep("content");
              }
            }
            if (step === "activate") setStep("preview");
          }}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        {step !== "activate" && !editingEventKey && (
          <Button
            onClick={() => {
              if (step === "event") setStep("content");
              if (step === "content") setStep("preview");
              if (step === "preview") setStep("activate");
            }}
            disabled={
              (step === "event" && !canProceedFromEvent) ||
              (step === "content" && !canProceedFromContent) ||
              (step === "preview" && !canProceedFromPreview)
            }
            className="bg-brand-500 hover:bg-brand-600"
          >
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
