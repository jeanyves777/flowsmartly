"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Megaphone,
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Image as ImageIcon,
  Video,
  Globe,
  ShoppingBag,
  FileText,
  Loader2,
  Eye,
  MousePointerClick,
  DollarSign,
  User,
  Calendar,
  AlertTriangle,
  ShieldCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface AdCampaign {
  id: string;
  name: string;
  objective: string;
  adType: string;
  status: string;
  approvalStatus: string;
  headline: string | null;
  description: string | null;
  destinationUrl: string | null;
  mediaUrl: string | null;
  videoUrl: string | null;
  ctaText: string | null;
  adCategory: string | null;
  contentRating: string;
  rejectionReason: string | null;
  budget: number;
  spent: number;
  impressions: number;
  clicks: number;
  startDate: string;
  endDate: string | null;
  reviewedAt: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
  post: { id: string; caption: string | null; mediaUrl: string | null } | null;
  adPage: { id: string; slug: string; views: number; clicks: number } | null;
  landingPage: { id: string; title: string; slug: string; thumbnailUrl: string | null } | null;
}

const AD_TYPE_CONFIG: Record<string, { label: string; icon: typeof ImageIcon; color: string }> = {
  POST: { label: "Post", icon: ImageIcon, color: "text-blue-500" },
  PRODUCT_LINK: { label: "Product", icon: ShoppingBag, color: "text-emerald-500" },
  LANDING_PAGE: { label: "Landing Page", icon: FileText, color: "text-purple-500" },
  EXTERNAL_URL: { label: "External URL", icon: ExternalLink, color: "text-orange-500" },
};

const FILTER_TABS = [
  { id: "PENDING", label: "Pending", icon: Clock, color: "text-amber-500" },
  { id: "APPROVED", label: "Approved", icon: CheckCircle2, color: "text-green-500" },
  { id: "REJECTED", label: "Rejected", icon: XCircle, color: "text-red-500" },
  { id: "all", label: "All", icon: Megaphone, color: "text-muted-foreground" },
];

export default function AdminAdsPage() {
  const { toast } = useToast();

  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("PENDING");
  const [stats, setStats] = useState({ pending: 0, approvedToday: 0, rejectedToday: 0 });

  // Review modal
  const [reviewCampaign, setReviewCampaign] = useState<AdCampaign | null>(null);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [refundCredits, setRefundCredits] = useState(true);
  const [isReviewing, setIsReviewing] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/ads?status=${filter}&limit=50`);
      const data = await res.json();
      if (data.success) {
        setCampaigns(data.data.campaigns);
        setStats(data.data.stats);
      }
    } catch {
      toast({ title: "Failed to load ads", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const handleReview = async () => {
    if (!reviewCampaign || !reviewAction) return;

    if (reviewAction === "reject" && !rejectionReason.trim()) {
      toast({ title: "Rejection reason is required", variant: "destructive" });
      return;
    }

    setIsReviewing(true);
    try {
      const res = await fetch(`/api/admin/ads/${reviewCampaign.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: reviewAction,
          reason: rejectionReason.trim() || undefined,
          refundCredits: reviewAction === "reject" ? refundCredits : undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || "Review failed");

      toast({
        title: reviewAction === "approve" ? "Ad Approved" : "Ad Rejected",
        description: data.data.message,
      });

      setReviewCampaign(null);
      setReviewAction(null);
      setRejectionReason("");
      fetchCampaigns();
    } catch (err) {
      toast({
        title: "Review failed",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsReviewing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          Ad Review
        </h1>
        <p className="text-muted-foreground mt-1">
          Review and approve ad campaigns before they go live
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Review</p>
                <p className="text-2xl font-bold text-amber-500">{stats.pending}</p>
              </div>
              <Clock className="w-8 h-8 text-amber-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved Today</p>
                <p className="text-2xl font-bold text-green-500">{stats.approvedToday}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Rejected Today</p>
                <p className="text-2xl font-bold text-red-500">{stats.rejectedToday}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {FILTER_TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = filter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                isActive
                  ? "bg-foreground text-background"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? "" : tab.color}`} />
              {tab.label}
              {tab.id === "PENDING" && stats.pending > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isActive ? "bg-background text-foreground" : "bg-amber-500 text-white"
                }`}>
                  {stats.pending}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Campaign List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Megaphone className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="font-medium text-muted-foreground">No ads to review</p>
            <p className="text-sm text-muted-foreground mt-1">
              {filter === "PENDING" ? "All caught up! No pending ads." : "No ads match this filter."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {campaigns.map(campaign => {
            const typeConfig = AD_TYPE_CONFIG[campaign.adType] || AD_TYPE_CONFIG.POST;
            const TypeIcon = typeConfig.icon;

            return (
              <motion.div
                key={campaign.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      {/* Media Preview */}
                      <div className="w-32 h-32 rounded-xl bg-muted overflow-hidden shrink-0">
                        {campaign.mediaUrl ? (
                          <img src={campaign.mediaUrl} alt="" className="w-full h-full object-cover" />
                        ) : campaign.post?.mediaUrl ? (
                          <img src={campaign.post.mediaUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <TypeIcon className={`w-8 h-8 ${typeConfig.color} opacity-40`} />
                          </div>
                        )}
                      </div>

                      {/* Campaign Info */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold line-clamp-1">{campaign.name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className={`text-[10px] ${typeConfig.color}`}>
                                <TypeIcon className="w-3 h-3 mr-1" />
                                {typeConfig.label}
                              </Badge>
                              {campaign.adCategory && (
                                <Badge variant="secondary" className="text-[10px]">
                                  {campaign.adCategory}
                                </Badge>
                              )}
                              <Badge
                                variant={
                                  campaign.approvalStatus === "APPROVED" ? "default" :
                                  campaign.approvalStatus === "REJECTED" ? "destructive" :
                                  "secondary"
                                }
                                className="text-[10px]"
                              >
                                {campaign.approvalStatus}
                              </Badge>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          {campaign.approvalStatus === "PENDING" && (
                            <div className="flex gap-2 shrink-0">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 border-green-500/30 hover:bg-green-500/10"
                                onClick={() => {
                                  setReviewCampaign(campaign);
                                  setReviewAction("approve");
                                }}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 border-red-500/30 hover:bg-red-500/10"
                                onClick={() => {
                                  setReviewCampaign(campaign);
                                  setReviewAction("reject");
                                }}
                              >
                                <XCircle className="w-3.5 h-3.5 mr-1" />
                                Reject
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Content Preview */}
                        {campaign.headline && (
                          <p className="text-sm font-medium line-clamp-1">{campaign.headline}</p>
                        )}
                        {campaign.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{campaign.description}</p>
                        )}
                        {campaign.destinationUrl && (
                          <a
                            href={campaign.destinationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-brand-500 hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            {campaign.destinationUrl}
                          </a>
                        )}

                        {/* Rejection reason */}
                        {campaign.rejectionReason && (
                          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-2 mt-2">
                            <p className="text-xs text-red-600 dark:text-red-400">
                              <strong>Rejected:</strong> {campaign.rejectionReason}
                            </p>
                          </div>
                        )}

                        {/* Meta Row */}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {campaign.user.name || campaign.user.email}
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            {campaign.budget} credits
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(campaign.createdAt).toLocaleDateString()}
                          </span>
                          {campaign.adPage && (
                            <a
                              href={`/ad/${campaign.adPage.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-brand-500 hover:underline"
                            >
                              <Globe className="w-3 h-3" />
                              Preview
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Review Modal */}
      <AnimatePresence>
        {reviewCampaign && reviewAction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => { setReviewCampaign(null); setReviewAction(null); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-background rounded-2xl shadow-xl border w-full max-w-lg p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  {reviewAction === "approve" ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                  {reviewAction === "approve" ? "Approve Ad" : "Reject Ad"}
                </h2>
                <button
                  onClick={() => { setReviewCampaign(null); setReviewAction(null); }}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">{reviewCampaign.name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>By: {reviewCampaign.user.name || reviewCampaign.user.email}</span>
                  <span>Budget: {reviewCampaign.budget} credits</span>
                </div>
                {reviewCampaign.mediaUrl && (
                  <div className="w-full h-32 rounded-xl overflow-hidden bg-muted">
                    <img src={reviewCampaign.mediaUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              {reviewAction === "reject" && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Rejection Reason *</Label>
                    <Textarea
                      placeholder="Explain why this ad is being rejected..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={refundCredits}
                      onChange={(e) => setRefundCredits(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-brand-500"
                    />
                    Refund {reviewCampaign.budget} credits to the user
                  </label>
                </div>
              )}

              {reviewAction === "approve" && (
                <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3">
                  <p className="text-sm text-green-700 dark:text-green-400">
                    This ad will be activated and shown to users in the feed.
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setReviewCampaign(null); setReviewAction(null); }}
                >
                  Cancel
                </Button>
                <Button
                  className={`flex-1 ${
                    reviewAction === "approve"
                      ? "bg-green-600 hover:bg-green-700 text-white"
                      : "bg-red-600 hover:bg-red-700 text-white"
                  }`}
                  onClick={handleReview}
                  disabled={isReviewing}
                >
                  {isReviewing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : reviewAction === "approve" ? (
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  ) : (
                    <XCircle className="w-4 h-4 mr-2" />
                  )}
                  {reviewAction === "approve" ? "Confirm Approve" : "Confirm Reject"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
