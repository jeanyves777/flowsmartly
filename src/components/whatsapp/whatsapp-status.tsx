"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bot,
  CalendarClock,
  CalendarDays,
  CheckCircle,
  Clock,
  ExternalLink,
  ImagePlus,
  RefreshCw,
  Send,
  Sparkles,
  WandSparkles,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { MediaUploader } from "@/components/shared/media-uploader";
import { AISpinner } from "@/components/shared/ai-generation-loader";
import { socialAccountDestinationId } from "@/lib/social/destinations";
import type { WhatsAppAccount } from "./types";

interface WhatsAppStatusProps {
  account: WhatsAppAccount;
}

type PublishMode = "now" | "schedule";

type EventItem = {
  id: string;
  title: string;
  description?: string | null;
  eventDate: string;
  endDate?: string | null;
  coverImageUrl?: string | null;
  status?: string;
};

type ScheduledStatusPost = {
  id: string;
  caption: string | null;
  mediaType: string | null;
  scheduledAt: string | null;
};

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toTimeInputValue(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getErrorMessage(data: any, fallback: string) {
  if (typeof data?.error?.message === "string") return data.error.message;
  if (typeof data?.error === "string") return data.error;
  if (typeof data?.message === "string") return data.message;
  return fallback;
}

export function WhatsAppStatus({ account }: WhatsAppStatusProps) {
  const { toast } = useToast();
  const defaultSchedule = useMemo(() => {
    const date = new Date();
    date.setHours(date.getHours() + 2, 0, 0, 0);
    return date;
  }, []);

  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [publishMode, setPublishMode] = useState<PublishMode>("now");
  const [scheduleDate, setScheduleDate] = useState(toDateInputValue(defaultSchedule));
  const [scheduleTime, setScheduleTime] = useState(toTimeInputValue(defaultSchedule));
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [generatingImage, setGeneratingImage] = useState(false);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledStatusPost[]>([]);
  const [loadingContext, setLoadingContext] = useState(false);
  const [savingAutomationId, setSavingAutomationId] = useState<string | null>(null);

  const destinationId = socialAccountDestinationId(account.id);
  const upcomingEvents = useMemo(
    () =>
      events
        .filter((event) => new Date(event.eventDate).getTime() >= Date.now() - 86400000)
        .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())
        .slice(0, 4),
    [events]
  );
  const nextEvent = upcomingEvents[0] || null;

  function getMediaType(): "image" | "video" {
    if (mediaUrls.length === 0) return "image";
    const url = mediaUrls[0].toLowerCase();
    if (/\.(mp4|webm|mov|avi)(?:$|\?)/.test(url) || url.includes("/video/")) return "video";
    return "image";
  }

  async function refreshContext() {
    setLoadingContext(true);
    try {
      const [eventsRes, statusRes] = await Promise.all([
        fetch("/api/events?status=ACTIVE&limit=12"),
        fetch(`/api/whatsapp/status?socialAccountId=${encodeURIComponent(account.id)}`),
      ]);

      const eventsData = await eventsRes.json().catch(() => ({}));
      if (eventsData.success && Array.isArray(eventsData.data)) {
        setEvents(eventsData.data);
      }

      const statusData = await statusRes.json().catch(() => ({}));
      if (statusData.success && Array.isArray(statusData.scheduledPosts)) {
        setScheduledPosts(statusData.scheduledPosts);
      }
    } finally {
      setLoadingContext(false);
    }
  }

  useEffect(() => {
    void refreshContext();
  }, [account.id]);

  async function handleGenerateImage(event?: EventItem) {
    const eventContext = event
      ? `Upcoming event: ${event.title}. Date: ${formatDateTime(event.eventDate)}. ${event.description || ""}`
      : nextEvent
        ? `Upcoming event: ${nextEvent.title}. Date: ${formatDateTime(nextEvent.eventDate)}. ${nextEvent.description || ""}`
        : "";
    const prompt =
      aiPrompt.trim() ||
      [
        `Create a polished vertical WhatsApp Status image for ${account.platformDisplayName}.`,
        caption.trim() ? `Caption context: ${caption.trim()}` : null,
        eventContext || null,
        "Use a clean social poster layout, readable headline space, brand-safe colors, and a mobile-first 9:16 composition.",
      ]
        .filter(Boolean)
        .join(" ");

    setGeneratingImage(true);
    try {
      const res = await fetch("/api/media/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(getErrorMessage(data, "Could not generate the image"));
      }

      const imageUrl = data.data?.url;
      if (!imageUrl) throw new Error("Image generation did not return a media URL");
      setMediaUrls([imageUrl]);
      toast({
        title: "Status image created",
        description: data.data?.creditCost ? `${data.data.creditCost} credits used.` : "The image is ready.",
      });
    } catch (error) {
      toast({
        title: "Image generation failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setGeneratingImage(false);
    }
  }

  async function handlePost() {
    if (mediaUrls.length === 0) {
      toast({ title: "Add status media", description: "WhatsApp Status needs an image or video.", variant: "destructive" });
      return;
    }

    const scheduleAt =
      publishMode === "schedule" && scheduleDate && scheduleTime
        ? new Date(`${scheduleDate}T${scheduleTime}`).toISOString()
        : undefined;

    if (publishMode === "schedule" && !scheduleAt) {
      toast({ title: "Schedule required", description: "Choose a date and time.", variant: "destructive" });
      return;
    }

    setPosting(true);
    try {
      const res = await fetch("/api/whatsapp/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          socialAccountId: account.id,
          mediaType: getMediaType(),
          mediaUrl: mediaUrls[0],
          caption: caption.trim() || undefined,
          scheduleAt,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(getErrorMessage(data, "Could not post to WhatsApp Status"));
      }

      setPosted(publishMode === "now");
      toast({
        title: publishMode === "schedule" ? "Status scheduled" : "Status posted",
        description:
          publishMode === "schedule"
            ? `Scheduled for ${formatDateTime(scheduleAt)}.`
            : "Your WhatsApp Status has been published.",
      });
      setMediaUrls([]);
      setCaption("");
      if (publishMode === "schedule") void refreshContext();
      setTimeout(() => setPosted(false), 2400);
    } catch (error) {
      toast({
        title: "Status failed",
        description: error instanceof Error ? error.message : "Network error posting status",
        variant: "destructive",
      });
    } finally {
      setPosting(false);
    }
  }

  async function handleCreateEventAutomation(event: EventItem) {
    const eventDate = new Date(event.eventDate);
    const startDate = new Date(eventDate);
    startDate.setDate(startDate.getDate() - 7);
    if (startDate < new Date()) startDate.setTime(Date.now() + 10 * 60 * 1000);

    const endDate = new Date(event.endDate || event.eventDate);
    endDate.setDate(endDate.getDate() + 1);

    setSavingAutomationId(event.id);
    try {
      const res = await fetch("/api/content/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `WhatsApp Status: ${event.title}`,
          type: "EVENT_BASED",
          enabled: true,
          schedule: {
            frequency: "DAILY",
            time: "09:00",
            eventId: event.id,
            eventDate: event.eventDate,
            destination: destinationId,
          },
          topic: event.title,
          aiPrompt: `Create a WhatsApp Status update for this upcoming event: ${event.title}. ${event.description || ""} Include urgency, a clear invitation, and event details. Keep it concise and status-friendly.`,
          aiTone: "professional",
          platforms: [destinationId],
          includeMedia: true,
          mediaType: "image",
          mediaStyle: "vertical WhatsApp Status event poster, 9:16, readable headline, branded, mobile-first",
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(getErrorMessage(data, "Could not create event automation"));
      }

      toast({
        title: "Event status automation enabled",
        description: `${event.title} will generate AI status media and schedule posts.`,
      });
    } catch (error) {
      toast({
        title: "Automation failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingAutomationId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-semibold">WhatsApp Status Studio</h3>
            <Badge variant="secondary" className="gap-1">
              <Zap className="h-3 w-3" />
              {account.platformDisplayName}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Create, schedule, and automate WhatsApp Status posts for this connected account.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/content/posts">
            <ExternalLink className="h-3.5 w-3.5" />
            Content Posts
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <Card className="border-border/60 shadow-sm">
          <CardContent className="space-y-5 p-5">
            {posted ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
                <h3 className="text-lg font-semibold">Status posted</h3>
                <p className="mt-1 text-sm text-muted-foreground">The update is now live for this WhatsApp account.</p>
              </div>
            ) : (
              <>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label className="font-semibold">Media</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleGenerateImage()}
                        disabled={generatingImage || posting}
                        className="border-emerald-500/30 bg-emerald-500/5 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
                      >
                        {generatingImage ? (
                          <AISpinner className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ImagePlus className="h-3.5 w-3.5" />
                        )}
                        Create image
                      </Button>
                    </div>
                    <MediaUploader
                      value={mediaUrls}
                      onChange={setMediaUrls}
                      multiple={false}
                      accept="image/png,image/jpeg,image/jpg,image/webp,video/mp4,video/webm"
                      filterTypes={["image", "video"]}
                      maxSize={16 * 1024 * 1024}
                      variant="large"
                      placeholder="Upload image or video"
                      disabled={posting || generatingImage}
                    />
                  </div>

                  <div className="space-y-3 rounded-xl border bg-muted/20 p-3">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <WandSparkles className="h-4 w-4 text-emerald-600" />
                      AI image brief
                    </div>
                    <Textarea
                      value={aiPrompt}
                      onChange={(event) => setAiPrompt(event.target.value)}
                      rows={7}
                      placeholder="Optional visual direction..."
                      disabled={posting || generatingImage}
                    />
                    {nextEvent && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-xs"
                        onClick={() => handleGenerateImage(nextEvent)}
                        disabled={posting || generatingImage}
                      >
                        <CalendarDays className="h-3.5 w-3.5" />
                        Use next event
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="font-semibold">Caption</Label>
                  <Textarea
                    placeholder="Write a caption for your status..."
                    value={caption}
                    onChange={(event) => setCaption(event.target.value)}
                    rows={4}
                    disabled={posting}
                    maxLength={700}
                  />
                  <p className="text-right text-[10px] text-muted-foreground">{caption.length}/700</p>
                </div>

                <div className="rounded-xl border bg-muted/20 p-3">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <Label className="font-semibold">Publish timing</Label>
                    <div className="grid grid-cols-2 rounded-lg bg-background p-1">
                      {(["now", "schedule"] as PublishMode[]).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setPublishMode(mode)}
                          className={`h-8 rounded-md px-3 text-xs font-semibold transition ${
                            publishMode === mode ? "bg-emerald-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {mode === "now" ? "Post now" : "Schedule"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {publishMode === "schedule" && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="whatsapp-status-date" className="text-xs text-muted-foreground">Date</Label>
                        <Input
                          id="whatsapp-status-date"
                          type="date"
                          value={scheduleDate}
                          onChange={(event) => setScheduleDate(event.target.value)}
                          disabled={posting}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="whatsapp-status-time" className="text-xs text-muted-foreground">Time</Label>
                        <Input
                          id="whatsapp-status-time"
                          type="time"
                          value={scheduleTime}
                          onChange={(event) => setScheduleTime(event.target.value)}
                          disabled={posting}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  className="h-12 w-full bg-emerald-500 text-base text-white hover:bg-emerald-600"
                  onClick={handlePost}
                  disabled={mediaUrls.length === 0 || posting || generatingImage}
                  size="lg"
                >
                  {posting ? (
                    <>
                      <AISpinner className="h-4 w-4 animate-spin" />
                      {publishMode === "schedule" ? "Scheduling..." : "Posting..."}
                    </>
                  ) : publishMode === "schedule" ? (
                    <>
                      <CalendarClock className="h-4 w-4" />
                      Schedule Status
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Post to Status
                    </>
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-border/60 shadow-sm">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-emerald-600" />
                  <Label className="font-semibold">Event autopilot</Label>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={refreshContext} disabled={loadingContext}>
                  <RefreshCw className={`h-4 w-4 ${loadingContext ? "animate-spin" : ""}`} />
                </Button>
              </div>

              {upcomingEvents.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No active upcoming events found.
                </div>
              ) : (
                <div className="space-y-2">
                  {upcomingEvents.map((event) => (
                    <div key={event.id} className="rounded-lg border bg-background p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{event.title}</p>
                          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarDays className="h-3 w-3" />
                            {formatDateTime(event.eventDate)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleCreateEventAutomation(event)}
                          disabled={savingAutomationId === event.id}
                        >
                          {savingAutomationId === event.id ? (
                            <AISpinner className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5" />
                          )}
                          Automate
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-emerald-600" />
                  <Label className="font-semibold">Status queue</Label>
                </div>
                <Badge variant="outline">{scheduledPosts.length}</Badge>
              </div>

              {scheduledPosts.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No WhatsApp Status posts scheduled.
                </div>
              ) : (
                <div className="space-y-2">
                  {scheduledPosts.slice(0, 5).map((post) => (
                    <div key={post.id} className="rounded-lg border bg-background p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-sm font-medium">
                            {post.caption || `${post.mediaType || "Media"} status`}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(post.scheduledAt)}</p>
                        </div>
                        <Badge variant="secondary">{post.mediaType || "media"}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
