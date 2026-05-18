"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ExternalLink,
  Pause,
  Play,
  RefreshCw,
  Rocket,
  Sparkles,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { AISpinner } from "@/components/shared/ai-generation-loader";

interface SpotlightCampaign {
  id: string;
  title: string;
  description: string;
  mediaUrl: string | null;
  videoUrl: string | null;
  destinationUrl: string | null;
  ctaText: string | null;
  status: string;
  isSystem: boolean;
  provider: string | null;
  impressions: number;
  clicks: number;
  createdAt: string;
  authorName: string;
  authorAvatar: string | null;
}

interface SpotlightResponse {
  campaigns: SpotlightCampaign[];
  systemCount: number;
  clientCount: number;
  xaiReady: boolean;
}

const samplePrompt = "Show a small business owner turning a rough idea into a polished video ad, social post, and campaign dashboard inside FlowSmartly. Modern, fast, premium, friendly.";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function PremierSpotlightAdminPage() {
  const { toast } = useToast();
  const [data, setData] = useState<SpotlightResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [title, setTitle] = useState("FlowSmartly turns ideas into campaign-ready marketing");
  const [description, setDescription] = useState("A premium FlowSmartly showcase for creators and business owners.");
  const [prompt, setPrompt] = useState(samplePrompt);
  const [manualVideoUrl, setManualVideoUrl] = useState("");

  const fetchSpotlight = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/premier-spotlight");
      const json = await response.json();
      if (!json.success) throw new Error(json.error?.message || "Failed to load spotlight");
      setData(json.data);
    } catch (error) {
      toast({
        title: "Spotlight could not load",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSpotlight();
  }, [fetchSpotlight]);

  const systemCampaigns = useMemo(
    () => (data?.campaigns || []).filter((campaign) => campaign.isSystem),
    [data]
  );
  const clientCampaigns = useMemo(
    () => (data?.campaigns || []).filter((campaign) => !campaign.isSystem),
    [data]
  );
  const liveCampaigns = useMemo(
    () => (data?.campaigns || []).filter((campaign) => campaign.status === "ACTIVE"),
    [data]
  );

  async function runAction(action: string, body: Record<string, unknown>, successTitle: string) {
    setActionLoading(action);
    try {
      const response = await fetch("/api/admin/premier-spotlight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      const json = await response.json();
      if (!json.success) throw new Error(json.error?.message || "Action failed");
      toast({ title: successTitle });
      await fetchSpotlight();
    } catch (error) {
      toast({
        title: "Action failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  }

  function generateVideo() {
    runAction(
      "generate",
      { title, description, prompt, duration: 8 },
      "Premier video generated"
    );
  }

  function publishManualVideo() {
    runAction(
      "publish_url",
      { title, description, videoUrl: manualVideoUrl },
      "Premier video published"
    );
  }

  function publishDefaults() {
    runAction("seed_defaults", {}, "FlowSmartly defaults published");
  }

  function toggleSystem(campaign: SpotlightCampaign) {
    runAction(
      "toggle",
      { campaignId: campaign.id, status: campaign.status === "ACTIVE" ? "PAUSED" : "ACTIVE" },
      campaign.status === "ACTIVE" ? "Spotlight paused" : "Spotlight activated"
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Video className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Premier Video Spotlight</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Control the dashboard spotlight and publish FlowSmartly system videos when no client video is live.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={fetchSpotlight} disabled={loading} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={publishDefaults} disabled={!!actionLoading} className="gap-2">
            {actionLoading === "seed_defaults" ? <AISpinner className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            Publish defaults
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{liveCampaigns.length} live</Badge>
        <Badge variant="outline">{data?.systemCount || 0} system</Badge>
        <Badge variant="outline">{data?.clientCount || 0} client</Badge>
        <Badge variant={data?.xaiReady ? "outline" : "secondary"}>
          {data?.xaiReady ? "xAI ready" : "xAI not configured"}
        </Badge>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card>
          <CardContent className="space-y-5 p-5">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h2 className="font-semibold">Generate system video</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                xAI creates the MP4 and this page publishes it into the spotlight rotation.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Video brief</Label>
              <Textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={6} />
            </div>

            <Button onClick={generateVideo} disabled={!!actionLoading || !data?.xaiReady} className="w-full gap-2">
              {actionLoading === "generate" ? <AISpinner className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate and publish
            </Button>

            <div className="border-t pt-4">
              <div className="space-y-2">
                <Label>Publish existing video URL</Label>
                <Input
                  value={manualVideoUrl}
                  onChange={(event) => setManualVideoUrl(event.target.value)}
                  placeholder="https://.../video.mp4"
                />
              </div>
              <Button
                variant="outline"
                onClick={publishManualVideo}
                disabled={!!actionLoading || !manualVideoUrl.trim()}
                className="mt-3 w-full gap-2"
              >
                {actionLoading === "publish_url" ? <AISpinner className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Publish URL
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <SpotlightList
            title="System spotlight videos"
            campaigns={systemCampaigns}
            loading={loading}
            onToggle={toggleSystem}
            actionLoading={actionLoading}
          />

          <SpotlightList
            title="Client spotlight queue"
            campaigns={clientCampaigns}
            loading={loading}
            actionLoading={actionLoading}
          />
        </div>
      </div>
    </div>
  );
}

function SpotlightList({
  title,
  campaigns,
  loading,
  onToggle,
  actionLoading,
}: {
  title: string;
  campaigns: SpotlightCampaign[];
  loading: boolean;
  onToggle?: (campaign: SpotlightCampaign) => void;
  actionLoading: string | null;
}) {
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{title}</h2>
          <Badge variant="outline">{campaigns.length}</Badge>
        </div>

        {loading ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {[1, 2].map((item) => <Skeleton key={item} className="h-56 rounded-lg" />)}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No spotlight videos yet.
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="overflow-hidden rounded-lg border bg-background">
                <div className="relative aspect-video bg-muted">
                  {campaign.videoUrl ? (
                    <video
                      src={campaign.videoUrl}
                      poster={campaign.mediaUrl || undefined}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                      controls
                      preload="metadata"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Video className="h-10 w-10 text-muted-foreground/50" />
                    </div>
                  )}
                  <Badge className="absolute left-3 top-3 bg-background/90 text-foreground" variant="outline">
                    {campaign.status}
                  </Badge>
                </div>
                <div className="space-y-3 p-4">
                  <div>
                    <h3 className="line-clamp-1 font-semibold">{campaign.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{campaign.description}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{campaign.authorName}</span>
                    <span>{formatDate(campaign.createdAt)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {onToggle && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onToggle(campaign)}
                        disabled={!!actionLoading}
                        className="gap-2"
                      >
                        {actionLoading === "toggle" ? (
                          <AISpinner className="h-4 w-4 animate-spin" />
                        ) : campaign.status === "ACTIVE" ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                        {campaign.status === "ACTIVE" ? "Pause" : "Activate"}
                      </Button>
                    )}
                    {campaign.destinationUrl && (
                      <Button size="sm" variant="ghost" asChild className="gap-2">
                        <Link href={campaign.destinationUrl}>
                          <ExternalLink className="h-4 w-4" />
                          Destination
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
