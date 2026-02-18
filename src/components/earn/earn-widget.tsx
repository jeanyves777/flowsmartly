"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  DollarSign,
  X,
  TrendingUp,
  Eye,
  ArrowRight,
  Sparkles,
  Coins,
  Megaphone,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Opportunity {
  id: string;
  name: string;
  headline: string | null;
  mediaUrl: string | null;
  adType: string;
  estimatedEarnCents: number;
}

interface EarnData {
  balanceCents: number;
  earnedTodayCents: number;
  opportunities: Opportunity[];
  promotedPostCount: number;
  promotedEarnEstimateCents: number;
  totalOpportunities: number;
}

const LS_DISMISSED_AT = "earnWidgetDismissedAt";
const LS_LAST_COUNT = "earnWidgetLastOpportunityCount";
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

export function EarnWidget() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<EarnData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [shouldRender, setShouldRender] = useState(false);

  const fetchOpportunities = useCallback(async () => {
    try {
      const res = await fetch("/api/earn/opportunities");
      const json = await res.json();
      if (!json.success || !json.data) {
        // Agent impersonating or error — don't show
        setShouldRender(false);
        return;
      }

      const earnData: EarnData = json.data;
      setData(earnData);

      if (earnData.totalOpportunities === 0) {
        setShouldRender(false);
        return;
      }

      setShouldRender(true);

      // Decide whether to auto-open
      const dismissedAt = localStorage.getItem(LS_DISMISSED_AT);
      const lastCount = localStorage.getItem(LS_LAST_COUNT);

      if (!dismissedAt) {
        // First visit ever — auto-open
        setIsOpen(true);
      } else {
        const timeSinceDismiss = Date.now() - parseInt(dismissedAt, 10);
        const previousCount = lastCount ? parseInt(lastCount, 10) : 0;

        if (timeSinceDismiss >= TWENTY_FOUR_HOURS) {
          // 24h passed — auto-open
          setIsOpen(true);
        } else if (earnData.totalOpportunities > previousCount) {
          // New opportunities appeared — auto-open
          setIsOpen(true);
        }
        // Otherwise stay as tab only
      }
    } catch {
      setShouldRender(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  const handleDismiss = () => {
    setIsOpen(false);
    localStorage.setItem(LS_DISMISSED_AT, String(Date.now()));
    if (data) {
      localStorage.setItem(LS_LAST_COUNT, String(data.totalOpportunities));
    }
  };

  const handleGoToFeed = () => {
    handleDismiss();
    router.push("/feed");
  };

  if (isLoading || !shouldRender || !data) return null;

  const totalEstimatedCents = data.opportunities.reduce((s, o) => s + o.estimatedEarnCents, 0) + data.promotedEarnEstimateCents;

  return (
    <>
      {/* Expanded Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-4 right-4 md:right-6 z-50 w-[calc(100vw-32px)] md:w-[340px] max-h-[min(480px,calc(100vh-100px))] flex flex-col rounded-2xl overflow-hidden shadow-2xl border bg-card"
          >
            {/* Header */}
            <div className="relative bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white">
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                    <Coins className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">Earn Credits</h3>
                    <p className="text-[11px] text-white/80">Watch ads & earn money</p>
                  </div>
                </div>
                <button
                  onClick={handleDismiss}
                  className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Balance badge */}
              <div className="mt-3 flex items-center gap-3">
                <div className="flex-1 bg-white/15 rounded-lg px-3 py-1.5">
                  <p className="text-[10px] text-white/70 uppercase tracking-wide">Balance</p>
                  <p className="text-lg font-bold text-white">${(data.balanceCents / 100).toFixed(2)}</p>
                </div>
                <div className="flex-1 bg-white/15 rounded-lg px-3 py-1.5">
                  <p className="text-[10px] text-white/70 uppercase tracking-wide">Today</p>
                  <p className="text-lg font-bold text-white">
                    +${(data.earnedTodayCents / 100).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {/* Potential earnings callout */}
              {totalEstimatedCents > 0 && (
                <div className="mx-3 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0" />
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    <span className="font-semibold">${(totalEstimatedCents / 100).toFixed(2)}</span> available to earn right now
                  </p>
                </div>
              )}

              {/* Ad campaign opportunities */}
              {data.opportunities.length > 0 && (
                <div className="px-3 pt-3">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Ad Opportunities
                  </p>
                  <div className="space-y-2">
                    {data.opportunities.slice(0, 4).map((opp) => (
                      <button
                        key={opp.id}
                        onClick={handleGoToFeed}
                        className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-muted/70 transition-colors text-left group"
                      >
                        {/* Thumbnail */}
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted shrink-0">
                          {opp.mediaUrl ? (
                            <img src={opp.mediaUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Megaphone className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {opp.headline || opp.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Earn{" "}
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                              ${(opp.estimatedEarnCents / 100).toFixed(2)}
                            </span>
                          </p>
                        </div>
                        {/* Arrow */}
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground shrink-0 transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Promoted posts section */}
              {data.promotedPostCount > 0 && (
                <div className="px-3 pt-3">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Boosted Posts
                  </p>
                  <button
                    onClick={handleGoToFeed}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 hover:bg-amber-500/10 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                      <Eye className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {data.promotedPostCount} boosted post{data.promotedPostCount !== 1 ? "s" : ""} in your feed
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ~${(data.promotedEarnEstimateCents / 100).toFixed(2)} potential earnings
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-3 py-3 border-t">
              <Button
                onClick={handleGoToFeed}
                className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white gap-2"
                size="sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Go to Feed & Earn
              </Button>
              <button
                onClick={() => { handleDismiss(); router.push("/earnings"); }}
                className="w-full mt-1.5 text-[11px] text-muted-foreground hover:text-foreground text-center py-1 transition-colors"
              >
                View Earnings Dashboard
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsed Tab */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed right-0 bottom-44 z-50 flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5 rounded-l-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-lg transition-all group"
          title="Earning Opportunities"
        >
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 4, ease: "easeInOut" }}
          >
            <DollarSign className="w-4 h-4" />
          </motion.div>
          {data.totalOpportunities > 0 && (
            <span className="min-w-[18px] h-[18px] rounded-full bg-white/25 text-[10px] font-bold flex items-center justify-center px-1">
              {data.totalOpportunities}
            </span>
          )}
        </button>
      )}
    </>
  );
}
