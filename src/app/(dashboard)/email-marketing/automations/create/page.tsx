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
  ImageIcon,
  Loader2,
  Mail,
  Sparkles,
  Star,
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
import { TemplateStep } from "@/components/email-marketing/steps/template-step";
import { EditorStep } from "@/components/email-marketing/steps/editor-step";
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
type WizardStep = "plan" | "design" | "activate";
type DesignMode = "templates" | "builder";
type LogoSize = "normal" | "large" | "big";

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
  withBirthdayAndValidEmail?: number;
  withBirthdayMissingValidEmail?: number;
  withBirthdayAndImage?: number;
  eligibleBirthdayContacts?: number;
  withoutBirthday: number;
}

interface BirthdayContactPreview {
  id: string;
  name: string;
  email: string | null;
  birthday: string;
  emailOptedIn: boolean;
  imageUrl: string | null;
}

const STEPS: Array<{ id: WizardStep; label: string; icon: typeof Zap }> = [
  { id: "plan", label: "Automation Plan", icon: Zap },
  { id: "design", label: "Template & AI", icon: Sparkles },
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
    description: "Automate birthday emails for a selected contact list.",
    icon: Cake,
  },
  {
    type: "HOLIDAY",
    label: "Calendar Events",
    description: "Select one or all calendar events and create automations.",
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

function formatBirthday(value: string) {
  const [month, day] = value.split("-");
  if (!month || !day) return value;
  const date = new Date(2024, Number(month) - 1, Number(day));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function hasUsableEmail(contact: { email?: string | null; emailOptedIn?: boolean }) {
  return contact.emailOptedIn === true && typeof contact.email === "string" && contact.email.includes("@");
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

export default function CreateEmailAutomationPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { state, dispatch, canProceedToSend } = useCampaignForm();

  const [step, setStep] = useState<WizardStep>("plan");
  const [designMode, setDesignMode] = useState<DesignMode>("templates");
  const [automationType, setAutomationType] = useState<AutomationType>("BIRTHDAY");
  const [automationName, setAutomationName] = useState(defaultAutomationName("BIRTHDAY"));
  const [aiBrief, setAiBrief] = useState("");
  const [creditCost, setCreditCost] = useState<number | null>(null);
  const [optimizationData, setOptimizationData] = useState<OptimizationData | null>(null);
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [birthdayStats, setBirthdayStats] = useState<BirthdayStats | null>(null);
  const [birthdayContacts, setBirthdayContacts] = useState<BirthdayContactPreview[]>([]);
  const [loadingBirthdayData, setLoadingBirthdayData] = useState(false);
  const [birthdayConfirmed, setBirthdayConfirmed] = useState(false);
  const [includeContactPhoto, setIncludeContactPhoto] = useState(false);
  const [calendarConfirmed, setCalendarConfirmed] = useState(false);
  const [selectedHolidayIds, setSelectedHolidayIds] = useState<string[]>(
    US_HOLIDAYS.map((holiday) => holiday.id)
  );
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
  const birthdayContactsWithImage = birthdayStats?.withBirthdayAndImage ?? 0;

  const canProceedFromPlan = useMemo(() => {
    if (!automationName.trim()) return false;
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
  ]);

  const canActivate = canProceedToSend && automationName.trim().length > 0 && canProceedFromPlan;

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
              limit: "200",
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
          setBirthdayContacts(
            contacts
              .filter((contact: { birthday?: string | null; email?: string | null; emailOptedIn?: boolean }) =>
                !!contact.birthday && hasUsableEmail(contact)
              )
              .slice(0, 12)
              .map((contact: {
                id: string;
                name?: string | null;
                firstName?: string | null;
                lastName?: string | null;
                email?: string | null;
                emailOptedIn?: boolean;
                imageUrl?: string | null;
                birthday: string;
              }) => ({
                id: contact.id,
                name:
                  contact.name ||
                  [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
                  contact.email ||
                  "Contact",
                email: contact.email || null,
                birthday: contact.birthday,
                emailOptedIn: contact.emailOptedIn === true,
                imageUrl: contact.imageUrl || null,
              }))
          );
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
  }, [automationType, state.selectedContactListId]);

  useEffect(() => {
    setBirthdayConfirmed(false);
  }, [state.selectedContactListId]);

  useEffect(() => {
    if (birthdayContactsWithImage === 0) {
      setIncludeContactPhoto(false);
    }
  }, [birthdayContactsWithImage]);

  const handleSelectType = (type: AutomationType) => {
    setAutomationType(type);
    setBirthdayConfirmed(false);
    setCalendarConfirmed(false);
    setDaysOffset(type === "HOLIDAY" ? -7 : 0);
    if (type === "HOLIDAY" && selectedHolidayIds.length === 0) {
      setSelectedHolidayIds(US_HOLIDAYS.map((holiday) => holiday.id));
    }
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

  const handleSelectTemplate = (
    templateId: string,
    name: string,
    sections: EmailSection[],
    subject?: string,
    preheader?: string
  ) => {
    dispatch({ type: "LOAD_TEMPLATE", templateId, templateName: name, sections, subject, preheader });
    if (!automationName.trim()) setAutomationName(defaultAutomationName(automationType));
    dispatch({ type: "SET_CAMPAIGN_NAME", value: automationName || defaultAutomationName(automationType) });
    setDesignMode("builder");
  };

  const buildAiPrompt = useCallback(
    (prompt: string) => {
      const listContext = selectedList
        ? `${selectedList.name} (${selectedList.activeCount || selectedList.totalCount} active contacts)`
        : "all active contacts";
      const selectedHolidayNames = selectedHolidays.map((holiday) => holiday.name).join(", ");

      const contextLines = [
        `Create a professional email automation for FlowSmartly's automation builder.`,
        `Automation type: ${automationType}.`,
        `Automation name: ${automationName || defaultAutomationName(automationType)}.`,
        `Audience: ${listContext}.`,
        `Use merge tags naturally, especially {{firstName}}.`,
      ];

      if (automationType === "BIRTHDAY") {
        contextLines.push(
          `Birthday email contacts available: ${eligibleBirthdayCount}.`,
          `Contacts with saved photos: ${birthdayContactsWithImage}.`,
          "The email should feel personal, warm, and automated without sounding generic. Include {{birthday}} only if it reads naturally."
        );
      }

      if (automationType === "HOLIDAY") {
        contextLines.push(
          `Calendar events selected: ${selectedHolidayNames || "selected US calendar events"}.`,
          "Make the email reusable across selected calendar events. Include {{holidayName}} and {{holidayDate}} where useful."
        );
      }

      if (automationType === "WELCOME") {
        contextLines.push("The email welcomes new contacts and introduces the brand clearly.");
      }

      if (automationType === "CUSTOM") {
        contextLines.push(`Custom schedule: ${customFrequency.toLowerCase()}.`);
      }

      if (prompt.trim()) contextLines.push(`User direction: ${prompt.trim()}`);
      return contextLines.join("\n");
    },
    [
      automationName,
      automationType,
      birthdayContactsWithImage,
      customFrequency,
      eligibleBirthdayCount,
      selectedHolidays,
      selectedList,
    ]
  );

  const handleGenerateAI = useCallback(
    async (prompt: string, mode: "content" | "template") => {
      dispatch({ type: "SET_GENERATING", value: true });
      try {
        const response = await fetch("/api/email-templates/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: buildAiPrompt(prompt),
            mode,
            category: categoryForType(automationType),
            tone: "professional",
          }),
        });
        const data = await response.json();
        if (!data.success) {
          throw new Error(apiErrorMessage(data, "Generation failed"));
        }

        dispatch({
          type: "LOAD_TEMPLATE",
          templateId: data.data.template.id,
          templateName: data.data.template.name,
          sections: data.data.sections,
          subject: data.data.subject,
          preheader: data.data.preheader,
        });
        dispatch({
          type: "SET_CAMPAIGN_NAME",
          value: automationName || defaultAutomationName(automationType),
        });
        setDesignMode("builder");
        setStep("design");
        toast({
          title: "Automation email generated",
          description: data.data.creditsUsed ? `Used ${data.data.creditsUsed} credits` : undefined,
        });
      } catch (error) {
        toast({
          title: error instanceof Error ? error.message : "Generation failed",
          variant: "destructive",
        });
      } finally {
        dispatch({ type: "SET_GENERATING", value: false });
      }
    },
    [automationName, automationType, buildAiPrompt, dispatch, toast]
  );

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

  const buildTrigger = () => {
    const base: Record<string, unknown> = {
      source: "automation_builder",
      aiAssisted: true,
      emailSections: state.sections,
      emailBrandOptions: {
        showLogo: state.showLogo,
        showBrandName: state.showBrandName,
        logoSize: state.logoSize,
      },
      preheader: state.preheader,
      audienceName: selectedList?.name || "All active contacts",
    };

    if (automationType === "BIRTHDAY") {
      return {
        ...base,
        birthdayListConfirmed: birthdayConfirmed,
        birthdayStats,
        eligibleBirthdayContacts: eligibleBirthdayCount,
        includeContactPhoto,
        contactPhotoEligibleCount: birthdayContactsWithImage,
        birthdayPreview: birthdayContacts.slice(0, 20),
      };
    }

    if (automationType === "HOLIDAY") {
      return {
        ...base,
        calendarScope: isEveryHolidaySelected ? "all_us_calendar" : "selected_calendar_events",
        holidayIds: selectedHolidayIds,
        selectedHolidayIds,
      };
    }

    if (automationType === "WELCOME") {
      return {
        ...base,
        event: "new_contact",
        lookbackDays: 30,
      };
    }

    return {
      ...base,
      frequency: customFrequency,
      ...(customFrequency === "ONCE" && customScheduledDate
        ? { scheduledAt: new Date(`${customScheduledDate}T${sendTime || "09:00"}`).toISOString() }
        : {}),
      ...(customFrequency === "WEEKLY" ? { dayOfWeek: Number(customDayOfWeek) } : {}),
      ...(customFrequency === "MONTHLY" ? { dayOfMonth: Number(customDayOfMonth) } : {}),
    };
  };

  const handleCreateAutomation = async () => {
    if (!canActivate) {
      toast({
        title: "Finish the automation setup",
        description: "Confirm the trigger, design the email, and add a subject before activating.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const contentHtml = renderEmailHtml(state.sections, state.brandKit || undefined, {
        showLogo: state.showLogo,
        showBrandName: state.showBrandName,
        logoSize: state.logoSize,
      });
      const plainContent = sectionsToPlainText(state.sections).trim() || state.subject || automationName;
      const response = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: automationName.trim(),
          type: automationType,
          trigger: buildTrigger(),
          campaignType: "EMAIL",
          templateId: state.selectedTemplateId || null,
          subject: state.subject,
          content: plainContent,
          contentHtml,
          sendTime,
          daysOffset,
          timezone,
          contactListId: state.selectedContactListId || null,
          imageSource: automationType === "BIRTHDAY" && includeContactPhoto ? "contact_photo" : null,
          imageUrl: null,
          imageOverlayText: null,
          enabled,
        }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(apiErrorMessage(data, "Failed to create automation"));

      const createdCount = data.data?.createdCount || data.data?.automations?.length || 1;
      toast({
        title: createdCount > 1 ? "Calendar automations created" : "Automation created",
        description:
          createdCount > 1
            ? `${createdCount} calendar event automations are ready.`
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
                Plan the trigger, design with the same professional email builder, then confirm the audience before activation.
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
            return (
              <div key={item.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (item.id === "plan") setStep("plan");
                    if (item.id === "design" && canProceedFromPlan) setStep("design");
                    if (item.id === "activate" && canProceedFromPlan && canProceedToSend) setStep("activate");
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

      {step === "plan" && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-brand-500" />
                  AI Automation Planner
                </CardTitle>
                <CardDescription>
                  Describe the outcome. FlowSmartly will use this context when generating the email.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
                    <Label>Audience List</Label>
                    {loadingLists ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Select
                        value={state.selectedContactListId || "all"}
                        onValueChange={(value) =>
                          dispatch({ type: "SET_CONTACT_LIST", id: value === "all" ? "" : value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose audience" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All active contacts</SelectItem>
                          {contactLists.map((list) => (
                            <SelectItem key={list.id} value={list.id}>
                              {list.name} ({list.activeCount || list.totalCount} active)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ai-brief">AI Direction</Label>
                  <Textarea
                    id="ai-brief"
                    value={aiBrief}
                    onChange={(event) => setAiBrief(event.target.value)}
                    rows={4}
                    placeholder="Example: create a warm birthday automation with a clean offer, friendly tone, and one clear call to action."
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    onClick={() => handleGenerateAI(aiBrief, "template")}
                    disabled={state.isGenerating || !canProceedFromPlan}
                    className="bg-brand-500 hover:bg-brand-600"
                  >
                    {state.isGenerating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Wand2 className="mr-2 h-4 w-4" />
                    )}
                    Generate Automation Email
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setStep("design")}
                    disabled={!canProceedFromPlan}
                  >
                    Choose Template Manually
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Automation Trigger</CardTitle>
                <CardDescription>
                  Choose the event that starts this automation.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
              </CardContent>
            </Card>

            {automationType === "HOLIDAY" && (
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <CalendarDays className="h-5 w-5 text-brand-500" />
                        Calendar Event Selection
                      </CardTitle>
                      <CardDescription>
                        Create one automation for every selected calendar event.
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
                          ? "FlowSmartly will create an automation for the full calendar."
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
                    Birthday Audience Confirmation
                  </CardTitle>
                  <CardDescription>
                    Confirm the contact group before enabling birthday automation.
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
                        <p className="mt-1 text-2xl font-bold text-blue-700">{eligibleBirthdayCount}</p>
                      </div>
                      <div className="rounded-lg border p-4">
                        <p className="text-xs text-muted-foreground">Birthday but no valid email</p>
                        <p className="mt-1 text-2xl font-bold">{birthdayStats?.withBirthdayMissingValidEmail || 0}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600">
                        <ImageIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Include contact image when available</p>
                        <p className="text-xs leading-5 text-muted-foreground">
                          {birthdayContactsWithImage} eligible birthday contact{birthdayContactsWithImage === 1 ? "" : "s"} have a saved image.
                          Contacts without an image still receive the email without the photo block.
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={includeContactPhoto}
                      onCheckedChange={setIncludeContactPhoto}
                      disabled={birthdayContactsWithImage === 0}
                    />
                  </div>

                  <div className="rounded-lg border">
                    <div className="flex items-center justify-between border-b px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold">Eligible Birthday Email Preview</p>
                        <p className="text-xs text-muted-foreground">
                          Showing contacts with birthday dates, valid email, and email opt-in.
                        </p>
                      </div>
                      <Badge variant="outline">{selectedList?.name || "All contacts"}</Badge>
                    </div>
                    <div className="divide-y">
                      {birthdayContacts.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                          No birthday contacts with valid email were found for this audience.
                        </div>
                      ) : (
                        birthdayContacts.map((contact) => (
                          <div key={contact.id} className="flex items-center justify-between gap-3 px-4 py-3">
                            <div className="flex min-w-0 items-center gap-3">
                              {contact.imageUrl ? (
                                <img
                                  src={contact.imageUrl}
                                  alt=""
                                  className="h-9 w-9 shrink-0 rounded-full border object-cover"
                                />
                              ) : (
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-muted text-xs font-semibold">
                                  {contact.name.slice(0, 1).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{contact.name}</p>
                                <p className="truncate text-xs text-muted-foreground">{contact.email}</p>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {contact.imageUrl && (
                                <Badge variant="outline" className="hidden gap-1 sm:flex">
                                  <ImageIcon className="h-3 w-3" />
                                  Photo
                                </Badge>
                              )}
                              <Badge variant="secondary">{formatBirthday(contact.birthday)}</Badge>
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
                        from {selectedList?.name || "all active contacts"}.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {automationType === "CUSTOM" && (
              <Card>
                <CardHeader>
                  <CardTitle>Custom Schedule</CardTitle>
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
                <CardTitle className="text-base">Plan Readiness</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Trigger</span>
                  <Badge variant="outline">{AUTOMATION_TYPES.find((item) => item.type === automationType)?.label}</Badge>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Audience</span>
                  <span className="text-right font-medium">{selectedList?.name || "All active contacts"}</span>
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
                  {canProceedFromPlan
                    ? "The trigger is confirmed. Continue to template selection or generate the email with AI."
                    : "Confirm the required trigger details to continue."}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {step === "design" && (
        <div className="space-y-6">
          <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                {designMode === "templates" ? "Choose Template or Generate with AI" : "Design Automation Email"}
              </h2>
              <p className="text-sm text-muted-foreground">
                HTML is rendered from reusable content blocks, matching the Create Campaign workflow.
              </p>
            </div>
            {designMode === "builder" && (
              <Button variant="outline" onClick={() => setDesignMode("templates")}>
                Change Template
              </Button>
            )}
          </div>

          {designMode === "templates" ? (
            <TemplateStep
              isGenerating={state.isGenerating}
              creditCost={creditCost}
              onSelectTemplate={handleSelectTemplate}
              onCreateBlank={(sections) => handleSelectTemplate("", "Blank Automation Email", sections)}
              onGenerateAI={handleGenerateAI}
            />
          ) : (
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
                  Send Timing
                </CardTitle>
                <CardDescription>
                  Configure when FlowSmartly sends the automated email.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Days Offset</Label>
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
                  <Label>Send Time</Label>
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
                <CardTitle>Audience Confirmation</CardTitle>
                <CardDescription>
                  Review the audience and trigger before enabling the automation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border p-4">
                    <p className="text-xs text-muted-foreground">Contact list</p>
                    <p className="mt-1 font-semibold">{selectedList?.name || "All active contacts"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {selectedList
                        ? `${selectedList.activeCount || selectedList.totalCount} active contacts`
                        : "Every active contact that matches the trigger."}
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
                      {automationType === "BIRTHDAY" && includeContactPhoto
                        ? `Contact photos enabled for ${birthdayContactsWithImage} contacts with images.`
                        : ""}
                      {automationType === "HOLIDAY" && selectedHolidays.slice(0, 3).map((holiday) => holiday.name).join(", ")}
                      {automationType === "HOLIDAY" && selectedHolidays.length > 3 ? `, +${selectedHolidays.length - 3} more` : ""}
                      {automationType !== "HOLIDAY" && !(automationType === "BIRTHDAY" && includeContactPhoto) ? "Confirmed from the planner step." : ""}
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
                Activation Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Name</span>
                  <span className="text-right font-medium">{automationName}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Subject</span>
                  <span className="max-w-[220px] truncate text-right font-medium">{state.subject}</span>
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
                  ? "FlowSmartly will create separate automations for the selected calendar events so each event can trigger reliably."
                  : "FlowSmartly will render the email from builder sections and send it when the trigger matches."}
              </div>
              <Button
                onClick={handleCreateAutomation}
                disabled={isCreating || !canActivate}
                className="w-full bg-brand-500 hover:bg-brand-600"
              >
                {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                {automationType === "HOLIDAY" && selectedHolidayIds.length > 1
                  ? `Create ${selectedHolidayIds.length} Automations`
                  : "Create Automation"}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex items-center justify-between border-t pt-4">
        <Button
          variant="ghost"
          onClick={() => {
            if (step === "plan") router.push("/email-marketing/automations");
            if (step === "design") setStep("plan");
            if (step === "activate") setStep("design");
          }}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        {step !== "activate" && (
          <Button
            onClick={() => {
              if (step === "plan") setStep("design");
              if (step === "design") setStep("activate");
            }}
            disabled={(step === "plan" && !canProceedFromPlan) || (step === "design" && !canProceedToSend)}
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
