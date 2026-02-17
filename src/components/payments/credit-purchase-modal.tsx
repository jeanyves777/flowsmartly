"use client";

import { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Coins,
  Sparkles,
  Zap,
  ArrowRight,
  Crown,
  X,
  Loader2,
  TrendingUp,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

// ── Store (global, like toast) ─────────────────────────────────────────────

interface ModalState {
  open: boolean;
  creditsNeeded: number;
  featureName: string;
  isFreeRestricted: boolean;
}

const defaultState: ModalState = {
  open: false,
  creditsNeeded: 0,
  featureName: "",
  isFreeRestricted: false,
};

let state: ModalState = { ...defaultState };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function getSnapshot() {
  return state;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function showCreditPurchaseModal(opts: {
  creditsNeeded?: number;
  featureName?: string;
  isFreeRestricted?: boolean;
}) {
  state = {
    open: true,
    creditsNeeded: opts.creditsNeeded || 0,
    featureName: opts.featureName || "",
    isFreeRestricted: opts.isFreeRestricted || false,
  };
  emit();
}

export function closeCreditPurchaseModal() {
  state = { ...defaultState };
  emit();
}

/**
 * Helper: checks an API error response and shows the credit modal if applicable.
 * Returns true if the modal was shown (caller should skip the normal toast).
 */
export function handleCreditError(error: {
  code?: string;
  message?: string;
}, featureName?: string): boolean {
  if (
    error.code === "FREE_CREDITS_RESTRICTED" ||
    error.code === "INSUFFICIENT_CREDITS"
  ) {
    // Try to extract credits needed from message like "This requires 125 credits..."
    const match = error.message?.match(/requires?\s+(\d+)\s+credits?/i);
    showCreditPurchaseModal({
      creditsNeeded: match ? parseInt(match[1], 10) : 0,
      featureName: featureName || "",
      isFreeRestricted: error.code === "FREE_CREDITS_RESTRICTED",
    });
    return true;
  }
  return false;
}

// ── Package type ───────────────────────────────────────────────────────────

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  bonus: number;
  priceCents: number;
  label: string;
  priceFormatted: string;
  isPopular: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────

export function CreditPurchaseModal() {
  const modalState = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const { open, creditsNeeded, featureName, isFreeRestricted } = modalState;

  const router = useRouter();
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState<string | null>(null);

  const fetchPackages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/payments/packages");
      const data = await res.json();
      if (data.success) {
        setPackages(data.data.creditPackages);
      }
    } catch {
      // Fail silently, user can still navigate to buy-credits
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && packages.length === 0) {
      fetchPackages();
    }
    if (open) {
      setSelectedPkg(null);
    }
  }, [open, fetchPackages, packages.length]);

  // Auto-suggest the best package based on credits needed
  const recommendedPkg = packages.find(
    (p) => p.credits + p.bonus >= creditsNeeded
  );

  const handleSelectPackage = (pkgId: string) => {
    setSelectedPkg(pkgId);
  };

  const handleBuyNow = () => {
    const pkg = selectedPkg || recommendedPkg?.id;
    closeCreditPurchaseModal();
    router.push(`/buy-credits${pkg ? `?package=${pkg}` : ""}`);
  };

  const handleUpgrade = () => {
    closeCreditPurchaseModal();
    router.push("/settings/upgrade");
  };

  const handleClose = () => {
    closeCreditPurchaseModal();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative z-10 w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden rounded-2xl bg-background border shadow-2xl"
          >
            {/* Gradient header */}
            <div className="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-500 to-purple-600 px-6 py-5 text-white">
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                {/* Decorative circles */}
                <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/10" />
                <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-white/5" />

                <div className="flex items-start justify-between relative">
                  <div className="flex items-center gap-3">
                    <motion.div
                      initial={{ rotate: -180, scale: 0 }}
                      animate={{ rotate: 0, scale: 1 }}
                      transition={{
                        type: "spring",
                        delay: 0.2,
                        damping: 12,
                      }}
                      className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm"
                    >
                      {isFreeRestricted ? (
                        <Lock className="w-5 h-5" />
                      ) : (
                        <Coins className="w-5 h-5" />
                      )}
                    </motion.div>
                    <div>
                      <h2 className="text-lg font-bold">
                        {isFreeRestricted
                          ? "Premium Feature"
                          : "Credits Needed"}
                      </h2>
                      <p className="text-sm text-white/80 mt-0.5">
                        {isFreeRestricted
                          ? "Free credits are for email & SMS only"
                          : `${creditsNeeded > 0 ? `${creditsNeeded} credits required` : "Not enough credits"}${featureName ? ` for ${featureName}` : ""}`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleClose}
                    className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            </div>

            {/* Body */}
            <div className="px-6 py-4 overflow-y-auto max-h-[55vh]">
              {isFreeRestricted && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 }}
                  className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20"
                >
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    <Sparkles className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                    Your signup bonus credits work for email & SMS campaigns.
                    Purchase a credit pack to unlock AI features.
                  </p>
                </motion.div>
              )}

              <p className="text-sm font-medium text-muted-foreground mb-3">
                Choose a credit pack
              </p>

              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-2.5">
                  {packages.map((pkg, i) => {
                    const isRecommended = recommendedPkg?.id === pkg.id;
                    const isSelected = selectedPkg === pkg.id;
                    const totalCredits = pkg.credits + pkg.bonus;
                    const perCredit = (
                      pkg.priceCents /
                      totalCredits /
                      100
                    ).toFixed(3);

                    return (
                      <motion.button
                        key={pkg.id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 + i * 0.05 }}
                        onClick={() => handleSelectPackage(pkg.id)}
                        className={cn(
                          "w-full text-left p-3.5 rounded-xl border-2 transition-all duration-200",
                          "hover:shadow-md hover:border-brand-300 dark:hover:border-brand-600",
                          isSelected || (isRecommended && !selectedPkg)
                            ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10 shadow-md ring-1 ring-brand-500/20"
                            : "border-border bg-card hover:bg-accent/50"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "p-2 rounded-lg",
                                isSelected || (isRecommended && !selectedPkg)
                                  ? "bg-brand-500 text-white"
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              <Zap className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm">
                                  {pkg.name}
                                </span>
                                {pkg.isPopular && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] px-1.5 py-0"
                                  >
                                    Popular
                                  </Badge>
                                )}
                                {isRecommended && !pkg.isPopular && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px] px-1.5 py-0"
                                  >
                                    Best fit
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-muted-foreground">
                                  {pkg.credits.toLocaleString()} credits
                                  {pkg.bonus > 0 && (
                                    <span className="text-green-600 font-medium">
                                      {" "}
                                      +{pkg.bonus} bonus
                                    </span>
                                  )}
                                </span>
                                <span className="text-[10px] text-muted-foreground/60">
                                  ${perCredit}/credit
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-base">
                              {pkg.priceFormatted}
                            </span>
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t bg-muted/30">
              <div className="flex gap-2.5">
                <Button
                  onClick={handleBuyNow}
                  className="flex-1 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white shadow-lg shadow-brand-500/25"
                  disabled={loading || packages.length === 0}
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Buy Credits
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button
                  onClick={handleUpgrade}
                  variant="outline"
                  className="gap-2"
                >
                  <Crown className="w-4 h-4" />
                  <span className="hidden sm:inline">Upgrade</span>
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground text-center mt-2.5 flex items-center justify-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Higher packs give better per-credit value
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
