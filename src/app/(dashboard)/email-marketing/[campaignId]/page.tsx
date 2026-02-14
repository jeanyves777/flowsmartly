"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft, Send, Trash2, Loader2, Mail, Eye, BarChart3, Users,
  CheckCircle2, XCircle, Edit2, AlertCircle,
  ChevronDown, Smartphone, MousePointerClick, UserMinus, Copy,
  TrendingUp, Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils/cn";

interface Campaign {
  id: string;
  name: string;
  type: string;
  status: string;
  subject: string | null;
  preheaderText: string | null;
  fromName: string | null;
  replyTo: string | null;
  content: string | null;
  contentHtml: string | null;
  contactList?: {
    id: string;
    name: string;
    totalCount: number;
    activeCount: number;
  } | null;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function EmailCampaignDetailPage() {
  const router = useRouter();
  const params = useParams();
  const campaignId = params.campaignId as string;
  const { toast } = useToast();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const fetchCampaign = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/campaigns/${campaignId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to fetch campaign");
      }

      setCampaign(data.data.campaign as Campaign);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load campaign";
      setError(message);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [campaignId, toast]);

  useEffect(() => {
    fetchCampaign();
  }, [fetchCampaign]);

  // Send campaign (for drafts)
  const handleSend = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to send this campaign now? This action cannot be undone."
    );
    if (!confirmed) return;

    setIsSending(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send" }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error?.message || "Failed to send campaign");
      }
      toast({ title: "Campaign sent successfully!" });
      fetchCampaign();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to send campaign",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this campaign? This action cannot be undone."
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, { method: "DELETE" });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error?.message || "Failed to delete campaign");
      }
      toast({ title: "Campaign deleted" });
      router.push("/email-marketing");
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete campaign",
        variant: "destructive",
      });
      setIsDeleting(false);
    }
  };

  // Helpers
  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });

  const formatDateTime = (dateString: string) => {
    const d = new Date(dateString);
    return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} at ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  };

  const calcRate = (numerator: number, denominator: number): number => {
    if (denominator === 0) return 0;
    return Math.round((numerator / denominator) * 1000) / 10;
  };

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    switch (s) {
      case "DRAFT":
        return <Badge variant="secondary">Draft</Badge>;
      case "SENT":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20" variant="outline">Sent</Badge>;
      case "SCHEDULED":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20" variant="outline">Scheduled</Badge>;
      case "SENDING":
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20" variant="outline">Sending</Badge>;
      case "ACTIVE":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20" variant="outline">Active</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Loading
  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col space-y-6 pb-8">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  // Error
  if (error && !campaign) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
          <h2 className="text-xl font-bold mb-2">Campaign Not Found</h2>
          <p className="text-muted-foreground mb-6">
            The campaign you are looking for does not exist or has been deleted.
          </p>
          <Button asChild>
            <Link href="/email-marketing">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Email Marketing
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!campaign) return null;

  const isDraft = campaign.status.toUpperCase() === "DRAFT";
  const isSentOrActive = ["SENT", "SCHEDULED", "ACTIVE", "SENDING"].includes(campaign.status.toUpperCase());

  const openRate = calcRate(campaign.opened, campaign.sent);
  const clickRate = calcRate(campaign.clicked, campaign.sent);
  const bounceRate = calcRate(campaign.bounced, campaign.sent);
  const deliveryRate = calcRate(campaign.delivered, campaign.sent);
  const unsubRate = calcRate(campaign.unsubscribed, campaign.sent);
  const clickToOpenRate = calcRate(campaign.clicked, campaign.opened);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 flex flex-col space-y-6 pb-8"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/email-marketing">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{campaign.name}</h1>
              {getStatusBadge(campaign.status)}
            </div>
            <p className="text-sm text-muted-foreground">
              Created {formatDate(campaign.createdAt)}
              {campaign.sentAt && ` · Sent ${formatDateTime(campaign.sentAt)}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isDraft && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/email-marketing/create?edit=${campaign.id}`)}
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Edit in Wizard
              </Button>
              <Button
                size="sm"
                onClick={handleSend}
                disabled={isSending || !campaign.subject || !campaign.content}
                className="bg-gradient-to-r from-brand-500 to-purple-500 hover:from-brand-600 hover:to-purple-600"
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                {isSending ? "Sending..." : "Send Now"}
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            disabled={isDeleting}
            className="text-destructive hover:text-destructive"
          >
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Analytics Cards - shown for sent/active campaigns */}
      {isSentOrActive && (
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Sent", value: campaign.sent, icon: Send, bg: "bg-blue-500/10", text: "text-blue-500" },
            { label: "Delivered", value: campaign.delivered, icon: CheckCircle2, bg: "bg-emerald-500/10", text: "text-emerald-500" },
            { label: "Opened", value: campaign.opened, icon: Eye, bg: "bg-green-500/10", text: "text-green-500", rate: openRate },
            { label: "Clicked", value: campaign.clicked, icon: MousePointerClick, bg: "bg-purple-500/10", text: "text-purple-500", rate: clickRate },
            { label: "Bounced", value: campaign.bounced, icon: XCircle, bg: "bg-red-500/10", text: "text-red-500", rate: bounceRate },
            { label: "Unsubscribed", value: campaign.unsubscribed, icon: UserMinus, bg: "bg-orange-500/10", text: "text-orange-500", rate: unsubRate },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn("w-7 h-7 rounded-md flex items-center justify-center", stat.bg)}>
                    <stat.icon className={cn("w-3.5 h-3.5", stat.text)} />
                  </div>
                  <span className="text-xs text-muted-foreground">{stat.label}</span>
                </div>
                <p className="text-xl font-bold">{stat.value.toLocaleString()}</p>
                {stat.rate !== undefined && (
                  <p className="text-xs text-muted-foreground mt-0.5">{stat.rate}% rate</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Main content grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Details + Performance */}
        <div className="lg:col-span-2 space-y-6">

          {/* Performance Breakdown (sent campaigns) */}
          {isSentOrActive && campaign.sent > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="w-4 h-4 text-brand-500" />
                  Performance Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "Delivery Rate", rate: deliveryRate, count: campaign.delivered, total: campaign.sent, color: "bg-emerald-500" },
                  { label: "Open Rate", rate: openRate, count: campaign.opened, total: campaign.sent, color: "bg-green-500" },
                  { label: "Click Rate", rate: clickRate, count: campaign.clicked, total: campaign.sent, color: "bg-purple-500" },
                  { label: "Click-to-Open Rate", rate: clickToOpenRate, count: campaign.clicked, total: campaign.opened, color: "bg-indigo-500" },
                  { label: "Bounce Rate", rate: bounceRate, count: campaign.bounced, total: campaign.sent, color: "bg-red-500" },
                  { label: "Unsubscribe Rate", rate: unsubRate, count: campaign.unsubscribed, total: campaign.sent, color: "bg-orange-500" },
                ].map((metric) => (
                  <div key={metric.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium">{metric.label}</span>
                      <span className="text-sm text-muted-foreground">
                        {metric.count.toLocaleString()} / {metric.total.toLocaleString()} ({metric.rate}%)
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", metric.color)}
                        style={{ width: `${Math.min(metric.rate, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Campaign Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="w-4 h-4 text-brand-500" />
                Campaign Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Campaign Name</p>
                  <p className="text-sm font-medium">{campaign.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Type</p>
                  <Badge variant="secondary">
                    <Mail className="w-3 h-3 mr-1" /> Email
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Subject Line</p>
                  <p className="text-sm font-medium">{campaign.subject || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Preheader Text</p>
                  <p className="text-sm">{campaign.preheaderText || "—"}</p>
                </div>
                {campaign.fromName && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">From Name</p>
                    <p className="text-sm">{campaign.fromName}</p>
                  </div>
                )}
                {campaign.replyTo && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Reply-To</p>
                    <p className="text-sm">{campaign.replyTo}</p>
                  </div>
                )}
                {campaign.contactList && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Audience</p>
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium">{campaign.contactList.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({campaign.contactList.activeCount.toLocaleString()} contacts)
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Plain text content (collapsible for sent, shown for drafts) */}
              {campaign.content && (
                <div className="mt-6 pt-4 border-t">
                  <p className="text-xs text-muted-foreground mb-2">Plain Text Content</p>
                  <div className="text-sm py-3 px-3 rounded-md border bg-muted/30 whitespace-pre-wrap max-h-[200px] overflow-y-auto font-mono text-xs">
                    {campaign.content}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Email Preview (collapsible) */}
          <Card>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="w-full"
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Eye className="w-4 h-4 text-brand-500" />
                  Email Preview
                  <ChevronDown className={cn(
                    "w-4 h-4 ml-auto text-muted-foreground transition-transform",
                    showPreview && "rotate-180"
                  )} />
                </CardTitle>
              </CardHeader>
            </button>
            {showPreview && (
              <CardContent className="pt-0">
                {campaign.contentHtml ? (
                  <div className="space-y-4">
                    <Tabs defaultValue="desktop">
                      <div className="flex items-center justify-between">
                        <TabsList className="grid w-[200px] grid-cols-2">
                          <TabsTrigger value="desktop">Desktop</TabsTrigger>
                          <TabsTrigger value="mobile">
                            <Smartphone className="w-3.5 h-3.5 mr-1" />
                            Mobile
                          </TabsTrigger>
                        </TabsList>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(campaign.contentHtml || "");
                            toast({ title: "HTML copied to clipboard" });
                          }}
                        >
                          <Copy className="w-3 h-3 mr-1" />
                          Copy HTML
                        </Button>
                      </div>
                      <TabsContent value="desktop" className="mt-4">
                        <div className="border rounded-lg overflow-hidden">
                          {/* Email header bar */}
                          <div className="bg-muted px-4 py-3 border-b">
                            <p className="text-sm font-medium">{campaign.subject || "No subject"}</p>
                            {campaign.preheaderText && (
                              <p className="text-xs text-muted-foreground mt-0.5">{campaign.preheaderText}</p>
                            )}
                          </div>
                          <iframe
                            srcDoc={campaign.contentHtml}
                            className="w-full h-[600px] border-0 bg-white"
                            title="Email preview"
                          />
                        </div>
                      </TabsContent>
                      <TabsContent value="mobile" className="mt-4">
                        <div className="flex justify-center">
                          <div className="w-[375px] border-[3px] border-foreground/20 rounded-[2.5rem] overflow-hidden shadow-lg bg-background">
                            {/* Phone notch */}
                            <div className="bg-foreground/10 h-7 flex items-center justify-center">
                              <div className="w-20 h-4 bg-foreground/20 rounded-full" />
                            </div>
                            {/* Email header */}
                            <div className="bg-muted px-3 py-2 border-b">
                              <p className="text-xs font-medium truncate">{campaign.subject || "No subject"}</p>
                              {campaign.preheaderText && (
                                <p className="text-[10px] text-muted-foreground truncate">{campaign.preheaderText}</p>
                              )}
                            </div>
                            {/* Email body */}
                            <iframe
                              srcDoc={`<meta name="viewport" content="width=375,initial-scale=1"><style>body{margin:0;overflow-x:hidden}table{max-width:100%!important;width:100%!important}td{word-break:break-word!important}img{max-width:100%!important;height:auto!important}h1{font-size:20px!important}p{font-size:14px!important}</style>${campaign.contentHtml}`}
                              className="w-full h-[500px] border-0 bg-white"
                              title="Email mobile preview"
                            />
                            {/* Phone bottom bar */}
                            <div className="bg-foreground/10 h-5 flex items-center justify-center">
                              <div className="w-28 h-1 bg-foreground/30 rounded-full" />
                            </div>
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Eye className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No HTML preview available for this campaign</p>
                    {isDraft && (
                      <p className="text-xs mt-1">
                        Use the{" "}
                        <button
                          onClick={() => router.push(`/email-marketing/create?edit=${campaign.id}`)}
                          className="underline text-brand-500"
                        >
                          campaign wizard
                        </button>{" "}
                        to create a formatted email
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        </div>

        {/* Right: Sidebar */}
        <div className="space-y-6">
          {/* Status & Timeline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="w-4 h-4 text-brand-500" />
                Status & Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              {/* Status */}
              <div className="flex items-center justify-between py-3 border-b">
                <span className="text-sm text-muted-foreground">Status</span>
                {getStatusBadge(campaign.status)}
              </div>

              {/* Timeline entries */}
              <div className="py-3 border-b">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                  <div className="flex-1">
                    <p className="text-sm">Created</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(campaign.createdAt)}</p>
                  </div>
                </div>
              </div>
              {campaign.updatedAt !== campaign.createdAt && (
                <div className="py-3 border-b">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <div className="flex-1">
                      <p className="text-sm">Last Updated</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(campaign.updatedAt)}</p>
                    </div>
                  </div>
                </div>
              )}
              {campaign.scheduledAt && (
                <div className="py-3 border-b">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <div className="flex-1">
                      <p className="text-sm">Scheduled</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(campaign.scheduledAt)}</p>
                    </div>
                  </div>
                </div>
              )}
              {campaign.sentAt && (
                <div className="py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <div className="flex-1">
                      <p className="text-sm">Sent</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(campaign.sentAt)}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Audience Info */}
          {campaign.contactList && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="w-4 h-4 text-brand-500" />
                  Audience
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-brand-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{campaign.contactList.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {campaign.contactList.activeCount.toLocaleString()} active of {campaign.contactList.totalCount.toLocaleString()} total
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Stats Summary (sent campaigns) */}
          {isSentOrActive && campaign.sent > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="w-4 h-4 text-brand-500" />
                  Quick Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-muted-foreground">Total Sent</span>
                  <span className="text-sm font-bold">{campaign.sent.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-muted-foreground">Delivered</span>
                  <span className="text-sm font-bold text-emerald-600">{campaign.delivered.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-muted-foreground">Opened</span>
                  <span className="text-sm font-bold text-green-600">{campaign.opened.toLocaleString()} ({openRate}%)</span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-muted-foreground">Clicked</span>
                  <span className="text-sm font-bold text-purple-600">{campaign.clicked.toLocaleString()} ({clickRate}%)</span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-muted-foreground">Bounced</span>
                  <span className="text-sm font-bold text-red-600">{campaign.bounced.toLocaleString()} ({bounceRate}%)</span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-muted-foreground">Unsubscribed</span>
                  <span className="text-sm font-bold text-orange-600">{campaign.unsubscribed.toLocaleString()} ({unsubRate}%)</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          {isDraft && (
            <Card>
              <CardContent className="pt-6 space-y-2">
                <Button
                  className="w-full"
                  onClick={() => router.push(`/email-marketing/create?edit=${campaign.id}`)}
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit Campaign
                </Button>
                <Button
                  className="w-full bg-gradient-to-r from-brand-500 to-purple-500 hover:from-brand-600 hover:to-purple-600"
                  onClick={handleSend}
                  disabled={isSending || !campaign.subject || !campaign.content}
                >
                  {isSending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  {isSending ? "Sending..." : "Send Now"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </motion.div>
  );
}
