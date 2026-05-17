"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, Search, Plus, Shield, ShieldCheck, Star, Trash2, ExternalLink, RefreshCw, Link as LinkIcon, CheckCircle2, AlertCircle, Clock, Copy, Server, CreditCard, ArrowRight, ChevronRight, Calendar, DollarSign, Receipt, FileText, Download, RotateCcw, Eye, EyeOff, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils/cn";
import { Switch } from "@/components/ui/switch";
import { DomainSearch } from "@/components/ecommerce/domain-search";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { AISpinner } from "@/components/shared/ai-generation-loader";
import { confirmDialog } from "@/components/shared/confirm-dialog";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "");

interface StoreDomain {
  id: string;
  domainName: string;
  tld: string;
  registrarStatus: string;
  registrarVerificationStatus?: string | null;
  registrarVerificationDeadline?: string | null;
  registrarVerificationDaysToSuspend?: number | null;
  registrarVerificationEmailBounced?: boolean | null;
  registrarVerificationLastCheckedAt?: string | null;
  registrarVerificationLastSentAt?: string | null;
  registrarVerificationError?: string | null;
  sslStatus: string;
  isPrimary: boolean;
  isConnected: boolean;
  isFree: boolean;
  autoRenew: boolean;
  whoisPrivacy: boolean;
  nameservers: string;
  verificationStatus?: "pending" | "verified" | "failed";
  verifiedAt?: string | null;
  verificationError?: string | null;
  purchasePriceCents: number;
  renewalPriceCents: number;
  expiresAt: string | null;
  createdAt: string;
  nameserverList?: string[];
  daysUntilExpiry?: number | null;
  nextAction?: DomainAction;
}

interface DomainStatus {
  id: string;
  domainName: string;
  registrarStatus: string;
  cloudflareStatus: string | null;
  sslStatus: string;
  nameservers: string[];
  isPrimary: boolean;
  isConnected: boolean;
  expiresAt: string | null;
  verification: {
    status: "pending" | "verified" | "failed";
    token: string | null;
    record: { type: "TXT"; name: string; value: string } | null;
    verifiedAt: string | null;
    lastCheckedAt: string | null;
    error: string | null;
  } | null;
}

interface DomainAction {
  type: string;
  label: string;
  description: string;
  priority: number;
}

interface DomainSummary {
  total: number;
  registered: number;
  connected: number;
  primary: string | null;
  verified: number;
  sslReady: number;
  needsAction: number;
  expiringSoon: number;
}

interface DomainSetupStep {
  id: string;
  label: string;
  description: string;
  completed: boolean;
}

export function DomainsPageContent() {
  const router = useRouter();
  const { toast } = useToast();
  const [domains, setDomains] = useState<StoreDomain[]>([]);
  const [summary, setSummary] = useState<DomainSummary | null>(null);
  const [setupSteps, setSetupSteps] = useState<DomainSetupStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<"list" | "search" | "connect">("list");
  const [selectedDomain, setSelectedDomain] = useState<DomainStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<string | null>(null);
  const [connectDomain, setConnectDomain] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [busyDomain, setBusyDomain] = useState<string | null>(null);
  const [connectionResult, setConnectionResult] = useState<{
    domainId: string;
    domainName: string;
    nameservers: string[];
    verification: {
      status: "pending" | "verified" | "failed";
      record: { type: "TXT"; name: string; value: string };
    };
  } | null>(null);
  const [paymentPending, setPaymentPending] = useState<{
    clientSecret: string;
    domainName: string;
  } | null>(null);
  const [storeInfo, setStoreInfo] = useState<{ isPro: boolean; freeDomainClaimed: boolean }>({
    isPro: false,
    freeDomainClaimed: false,
  });
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);
  const [togglingAutoRenew, setTogglingAutoRenew] = useState<string | null>(null);
  const [togglingWhois, setTogglingWhois] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [verifyingDomain, setVerifyingDomain] = useState<string | null>(null);
  const [domainInvoices, setDomainInvoices] = useState<any[]>([]);

  const loadDomains = useCallback(async () => {
    try {
      const res = await fetch("/api/domains");
      const data = await res.json();
      if (data.success) {
        setDomains(data.data?.domains || []);
        setSummary(data.data?.summary || null);
        setSetupSteps(data.data?.setupSteps || []);
        if (data.data?.isPro !== undefined) {
          setStoreInfo({
            isPro: data.data.isPro,
            freeDomainClaimed: data.data.freeDomainClaimed ?? false,
          });
        }
      }
    } catch {
      toast({ title: "Failed to load domains", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadDomains();
  }, [loadDomains]);

  const handleCheckStatus = async (domainId: string) => {
    setLoadingStatus(domainId);
    try {
      const res = await fetch(`/api/domains/${domainId}`);
      const data = await res.json();
      if (data.success) {
        setSelectedDomain(data.data?.domain || data.data?.status || data.data);
      } else {
        toast({ title: data.error?.message || "Failed to check status", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to check domain status", variant: "destructive" });
    } finally {
      setLoadingStatus(null);
    }
  };

  const handleSetPrimary = async (domainId: string) => {
    try {
      const res = await fetch(`/api/domains/${domainId}/set-primary`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Domain set as primary" });
        loadDomains();
      } else {
        toast({ title: data.error?.message || "Failed to set primary", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to set primary domain", variant: "destructive" });
    }
  };

  const handleDisconnect = async (domainId: string) => {
    const ok = await confirmDialog({
      title: "Disconnect domain?",
      description: "This cannot be undone.",
      confirmText: "Disconnect",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/domains/${domainId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Domain disconnected" });
        setSelectedDomain(null);
        loadDomains();
      } else {
        toast({ title: data.error?.message || "Failed to disconnect", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to disconnect domain", variant: "destructive" });
    }
  };

  const handlePurchase = async (domain: string, tld: string, retailCents: number) => {
    if (purchasing) return; // Prevent double-click / multi-submit
    setPurchasing(true);
    setBusyDomain(`${domain.split(".")[0]}.${tld}`);
    try {
      const res = await fetch("/api/domains/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domain.split(".")[0], tld, isFree: retailCents === 0 }),
      });
      const data = await res.json();
      if (!data.success && data.error?.code === "INCOMPLETE_BRAND_IDENTITY") {
        // Redirect to brand identity page to complete profile
        toast({
          title: "Complete Your Brand Identity",
          description: data.error.message,
          variant: "destructive",
        });
        router.push("/brand");
        setPurchasing(false);
        return;
      }

      if (data.success) {
        if (data.data?.clientSecret) {
          // Paid domain: show payment form
          setPaymentPending({
            clientSecret: data.data.clientSecret,
            domainName: data.data.domainName,
          });
        } else {
          // Free domain: registered immediately
          toast({ title: `${domain} registered successfully!` });
          setActiveView("list");
          loadDomains();
        }
      } else {
        toast({ title: data.error?.message || "Purchase failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Domain purchase failed", variant: "destructive" });
    } finally {
      setPurchasing(false);
      setBusyDomain(null);
    }
  };

  const handlePaymentComplete = () => {
    const domainName = paymentPending?.domainName;
    setPaymentPending(null);
    setActiveView("list");
    toast({ title: "Payment confirmed! Registering your domain..." });

    // Poll for the domain to appear (webhook processes in background)
    let attempts = 0;
    const maxAttempts = 15;
    const pollInterval = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch("/api/domains");
        const data = await res.json();
        const domainList = data.data?.domains || [];
        const found = domainList.find((d: { domainName: string }) => d.domainName === domainName);
        if (found || attempts >= maxAttempts) {
          clearInterval(pollInterval);
          setDomains(domainList);
          setSummary(data.data?.summary || null);
          setSetupSteps(data.data?.setupSteps || []);
          if (data.data?.isPro !== undefined) {
            setStoreInfo({ isPro: data.data.isPro, freeDomainClaimed: data.data.freeDomainClaimed ?? false });
          }
          if (found) {
            toast({ title: `${domainName} registered successfully!` });
          } else {
            toast({ title: "Domain registration is still processing. It should appear shortly.", variant: "destructive" });
          }
        }
      } catch {
        if (attempts >= maxAttempts) clearInterval(pollInterval);
      }
    }, 3000);
  };

  const handleConnect = async () => {
    const domain = connectDomain.trim().toLowerCase();
    if (!domain || !domain.includes(".")) {
      toast({ title: "Enter a valid domain (e.g. mybrand.com)", variant: "destructive" });
      return;
    }
    setConnecting(true);
    try {
      const res = await fetch("/api/domains/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const data = await res.json();
      if (data.success) {
        const verification = data.data?.verification || {
          status: "pending",
          record: { type: "TXT", name: `_flowsmartly.${domain}`, value: "" },
        };
        setConnectDomain("");
        setConnectionResult({
          domainId: data.data?.domainId || "",
          domainName: domain,
          nameservers: data.data?.nameservers || [],
          verification,
        });
        loadDomains();
      } else {
        toast({ title: data.error?.message || "Connection failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to connect domain", variant: "destructive" });
    } finally {
      setConnecting(false);
    }
  };

  const handleVerifyDomain = async (domainId: string) => {
    setVerifyingDomain(domainId);
    try {
      const res = await fetch(`/api/domains/${domainId}/verify`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({ title: "Domain ownership verified" });
        if (connectionResult?.domainId === domainId) {
          setConnectionResult({
            ...connectionResult,
            verification: {
              ...connectionResult.verification,
              status: "verified",
            },
          });
        }
        loadDomains();
      } else {
        toast({
          title: data.error?.message || "Verification failed",
          description: "Add the TXT record first, then try again after DNS updates.",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Failed to verify domain", variant: "destructive" });
    } finally {
      setVerifyingDomain(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const handleExpand = (domainId: string) => {
    if (expandedDomain === domainId) {
      setExpandedDomain(null);
      return;
    }
    setExpandedDomain(domainId);
    // Auto-load technical status when expanding
    if (!selectedDomain || selectedDomain.id !== domainId) {
      handleCheckStatus(domainId);
    }
  };

  const handleToggleWhois = async (domainId: string, currentValue: boolean) => {
    setTogglingWhois(domainId);
    try {
      const res = await fetch(`/api/domains/${domainId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whoisPrivacy: !currentValue }),
      });
      const data = await res.json();
      if (data.success) {
        setDomains((prev) => prev.map((d) => d.id === domainId ? { ...d, whoisPrivacy: !currentValue } : d));
        toast({ title: `WHOIS privacy ${!currentValue ? "enabled" : "disabled"}` });
      } else {
        toast({ title: data.error?.message || "Failed to update", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to update WHOIS privacy", variant: "destructive" });
    } finally {
      setTogglingWhois(null);
    }
  };

  const handleToggleAutoRenew = async (domainId: string, currentValue: boolean) => {
    setTogglingAutoRenew(domainId);
    try {
      const res = await fetch(`/api/domains/${domainId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoRenew: !currentValue }),
      });
      const data = await res.json();
      if (data.success) {
        setDomains((prev) => prev.map((d) => d.id === domainId ? { ...d, autoRenew: !currentValue } : d));
        toast({ title: `Auto-renewal ${!currentValue ? "enabled" : "disabled"}` });
      } else {
        toast({ title: data.error?.message || "Failed to update", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to update auto-renewal", variant: "destructive" });
    } finally {
      setTogglingAutoRenew(null);
    }
  };

  const handleRetryRegistration = async (domainId: string) => {
    setRetrying(domainId);
    try {
      const res = await fetch(`/api/domains/${domainId}/retry`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({ title: "Domain registered successfully!" });
        loadDomains();
      } else {
        toast({ title: data.error || "Retry failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Retry failed", variant: "destructive" });
    } finally {
      setRetrying(null);
    }
  };

  const loadDomainInvoices = async () => {
    try {
      const res = await fetch("/api/user/invoices?limit=50");
      const data = await res.json();
      if (data.success) {
        // Filter to domain-related invoices only
        const all = data.data?.invoices || [];
        setDomainInvoices(all.filter((inv: any) => inv.type === "domain_purchase" || inv.type === "domain_renewal"));
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    loadDomainInvoices();
  }, []);

  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const getDaysUntilExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const getExpiryColor = (days: number | null) => {
    if (days === null) return "";
    if (days <= 7) return "text-red-600 dark:text-red-400";
    if (days <= 30) return "text-amber-600 dark:text-amber-400";
    return "text-emerald-600 dark:text-emerald-400";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
      case "active_certificate":
      case "verified":
        return "text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30";
      case "pending":
      case "pending_validation":
      case "pending_verification":
      case "verifying":
      case "admin_reviewing":
        return "text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30";
      case "failed":
      case "suspended":
        return "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30";
      case "external":
        return "text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30";
      default:
        return "text-muted-foreground bg-muted";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
      case "active_certificate":
      case "verified":
        return <CheckCircle2 className="h-3.5 w-3.5" />;
      case "pending":
      case "pending_validation":
      case "pending_verification":
      case "verifying":
      case "admin_reviewing":
        return <Clock className="h-3.5 w-3.5" />;
      default:
        return <AlertCircle className="h-3.5 w-3.5" />;
    }
  };

  const displayedSetupSteps = setupSteps.length > 0 ? setupSteps : [
    {
      id: "choose",
      label: "Choose domain",
      description: "Register a new domain or connect one you already own.",
      completed: domains.length > 0,
    },
    {
      id: "verify",
      label: "Verify ownership",
      description: "Confirm the TXT record or registrant email before routing.",
      completed: domains.length > 0 && (summary?.needsAction ?? 0) === 0,
    },
    {
      id: "route",
      label: "Route traffic",
      description: "Point DNS to FlowSmartly and wait for SSL to activate.",
      completed: (summary?.sslReady ?? 0) > 0,
    },
    {
      id: "protect",
      label: "Protect renewal",
      description: "Keep privacy and auto-renew ready for production domains.",
      completed: domains.length > 0 && domains.every((domain) => domain.autoRenew || domain.isConnected),
    },
  ];
  const actionDomains = [...domains]
    .filter((domain) => (domain.nextAction?.priority ?? 3) <= 2)
    .sort((a, b) => (a.nextAction?.priority ?? 3) - (b.nextAction?.priority ?? 3))
    .slice(0, 4);
  const primaryDomain = summary?.primary || domains.find((domain) => domain.isPrimary)?.domainName || "Not selected";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <AISpinner className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="max-w-3xl">
          <div className="mb-1.5 hidden items-center gap-2 rounded-full border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground xl:inline-flex">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            Domain operations
          </div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Domains</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={activeView === "search" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveView(activeView === "search" ? "list" : "search")}
            className="gap-1.5"
          >
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Register</span>
          </Button>
          <Button
            variant={activeView === "connect" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveView(activeView === "connect" ? "list" : "connect")}
            className="gap-1.5"
          >
            <LinkIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Connect</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {displayedSetupSteps.map((step, index) => (
          <SetupStepTile key={step.id} step={step} index={index} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
      {/* Search Panel */}
      <AnimatePresence>
        {activeView === "search" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-lg border bg-card p-4">
              <h2 className="mb-2 text-base font-semibold">Register domain</h2>
              <DomainSearch
                onSelect={handlePurchase}
                isPro={storeInfo.isPro}
                freeDomainClaimed={storeInfo.freeDomainClaimed}
                busy={purchasing}
                busyDomain={busyDomain}
              />
              {purchasing && (
                <div className="mt-3 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 dark:border-blue-800 dark:bg-blue-900/20">
                  <AISpinner className="h-4 w-4 shrink-0 animate-spin text-blue-600 dark:text-blue-400" />
                  <div className="text-sm">
                    <div className="font-medium text-blue-900 dark:text-blue-100">
                      Processing {busyDomain || "domain"}…
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Domain Payment Modal */}
      <AnimatePresence>
        {paymentPending && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <CreditCard className="h-5 w-5 text-brand-600" />
                <h2 className="text-lg font-semibold">Complete Payment</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Pay for <span className="font-medium">{paymentPending.domainName}</span> to complete registration.
              </p>
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret: paymentPending.clientSecret,
                  appearance: {
                    theme: "stripe",
                    variables: { colorPrimary: "#6366f1", borderRadius: "8px" },
                  },
                }}
              >
                <DomainPaymentForm
                  domainName={paymentPending.domainName}
                  onSuccess={handlePaymentComplete}
                  onCancel={() => setPaymentPending(null)}
                />
              </Elements>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connect Panel */}
      <AnimatePresence>
        {activeView === "connect" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-4 rounded-lg border bg-card p-4">
              <div>
                <h2 className="text-base font-semibold">Connect domain</h2>
              </div>

              {/* Step-by-step guide */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center h-6 w-6 rounded-full bg-brand-100 dark:bg-brand-950/30 text-brand-700 dark:text-brand-400 text-xs font-bold">1</span>
                    <h3 className="text-sm font-semibold">Enter Domain</h3>
                  </div>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center h-6 w-6 rounded-full bg-brand-100 dark:bg-brand-950/30 text-brand-700 dark:text-brand-400 text-xs font-bold">2</span>
                    <h3 className="text-sm font-semibold">Add TXT Record</h3>
                  </div>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center h-6 w-6 rounded-full bg-brand-100 dark:bg-brand-950/30 text-brand-700 dark:text-brand-400 text-xs font-bold">3</span>
                    <h3 className="text-sm font-semibold">Verify & Route</h3>
                  </div>
                </div>
              </div>

              {/* Connection form */}
              {!connectionResult ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={connectDomain}
                    onChange={(e) => setConnectDomain(e.target.value)}
                    placeholder="mybrand.com"
                    onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                  />
                  <Button onClick={handleConnect} disabled={connecting || !connectDomain.trim()}>
                    {connecting ? <AISpinner className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    Connect
                  </Button>
                </div>
              ) : (
                /* Post-connection: Verification and nameserver instructions */
                <div className="space-y-4">
                  <div className={cn(
                    "rounded-lg border p-4",
                    connectionResult.verification.status === "verified"
                      ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20"
                      : "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20"
                  )}>
                    <div className="flex items-center gap-2 mb-2">
                      {connectionResult.verification.status === "verified" ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      )}
                      <h3 className={cn(
                        "font-semibold",
                        connectionResult.verification.status === "verified"
                          ? "text-emerald-800 dark:text-emerald-300"
                          : "text-amber-800 dark:text-amber-300"
                      )}>
                        {connectionResult.domainName} {connectionResult.verification.status === "verified" ? "verified" : "needs verification"}
                      </h3>
                    </div>
                    <p className={cn(
                      "text-sm mb-3",
                      connectionResult.verification.status === "verified"
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-amber-800 dark:text-amber-300"
                    )}>
                      Add this TXT record at the DNS provider that currently manages your domain, then click Verify.
                    </p>

                    <div className="rounded-md bg-white dark:bg-zinc-900 border p-3 space-y-2">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                        Required ownership TXT record:
                      </p>
                      {[
                        ["Type", connectionResult.verification.record.type],
                        ["Name", connectionResult.verification.record.name],
                        ["Value", connectionResult.verification.record.value],
                      ].map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2 gap-3">
                          <span className="text-xs text-muted-foreground w-12 shrink-0">{label}</span>
                          <code className="text-xs sm:text-sm font-mono font-medium truncate">{value}</code>
                          <button onClick={() => copyToClipboard(value)} className="text-muted-foreground hover:text-foreground transition-colors">
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3">
                      <Button
                        size="sm"
                        onClick={() => handleVerifyDomain(connectionResult.domainId)}
                        disabled={verifyingDomain === connectionResult.domainId || connectionResult.verification.status === "verified"}
                      >
                        {verifyingDomain === connectionResult.domainId ? (
                          <AISpinner className="h-4 w-4 animate-spin" />
                        ) : (
                          <ShieldCheck className="h-4 w-4" />
                        )}
                        Verify domain
                      </Button>
                    </div>
                  </div>

                  {connectionResult.nameservers.length > 0 && (
                    <div className="rounded-lg border bg-card p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Server className="h-4 w-4 text-muted-foreground" />
                        <h3 className="text-sm font-semibold">FlowSmartly nameservers</h3>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        Copy to your registrar if needed.
                      </p>
                      <div className="rounded-md bg-muted/30 border p-3 space-y-2">
                        {connectionResult.nameservers.map((ns, i) => (
                          <div key={i} className="flex items-center justify-between bg-background rounded-md px-3 py-2">
                            <code className="text-sm font-mono font-medium">{ns}</code>
                            <button
                              onClick={() => copyToClipboard(ns)}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setConnectionResult(null);
                        setActiveView("list");
                      }}
                    >
                      Done
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConnectionResult(null)}
                    >
                      Connect another domain
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Domain List */}
      {domains.length === 0 && activeView === "list" ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border bg-card p-8 text-center"
        >
          <Globe className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
          <h2 className="text-lg font-bold">No domains yet</h2>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button onClick={() => setActiveView("search")}>
              <Search className="h-4 w-4" />
              Register
            </Button>
            <Button variant="outline" onClick={() => setActiveView("connect")}>
              <LinkIcon className="h-4 w-4" />
              Connect
            </Button>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {domains.map((domain) => {
            const daysLeft = domain.daysUntilExpiry ?? getDaysUntilExpiry(domain.expiresAt);
            const isRetryable = domain.registrarStatus === "registration_failed" || domain.registrarStatus === "pending_registration";
            const nextAction = domain.nextAction;

            return (
              <motion.div
                key={domain.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="cursor-pointer rounded-lg border bg-card p-4 transition-colors hover:border-primary/50"
                onClick={() => router.push(`/domains/${domain.id}`)}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-950/30">
                      <Globe className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="break-all font-semibold">{domain.domainName}</span>
                        {domain.isPrimary && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 dark:bg-brand-950/30 dark:text-brand-400 text-[10px] font-medium">
                            <Star className="h-3 w-3" />
                            Primary
                          </span>
                        )}
                        {domain.isConnected && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 text-[10px] font-medium">
                            <LinkIcon className="h-3 w-3" />
                            BYOD
                          </span>
                        )}
                        {domain.isFree && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400 text-[10px] font-medium">
                            Free
                          </span>
                        )}
                      </div>
                      {nextAction && nextAction.priority <= 2 && (
                        <div className={cn(
                          "mt-3 inline-flex rounded-full border px-2.5 py-1 text-xs font-medium",
                          nextAction.priority === 1
                            ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-300"
                            : "bg-muted/40 text-muted-foreground"
                        )}>
                          {nextAction.label}
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded", getStatusColor(domain.registrarStatus))}>
                          {getStatusIcon(domain.registrarStatus)}
                          {domain.registrarStatus}
                        </span>
                        <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded", getStatusColor(domain.sslStatus))}>
                          {domain.sslStatus === "active" || domain.sslStatus === "active_certificate" ? (
                            <ShieldCheck className="h-3 w-3" />
                          ) : (
                            <Shield className="h-3 w-3" />
                          )}
                          SSL: {domain.sslStatus}
                        </span>
                        {domain.isConnected && (
                          <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded", getStatusColor(domain.verificationStatus || "pending"))}>
                            {getStatusIcon(domain.verificationStatus || "pending")}
                            Verify: {domain.verificationStatus || "pending"}
                          </span>
                        )}
                        {!domain.isConnected && domain.registrarVerificationStatus && domain.registrarVerificationStatus !== "verified" && (
                          <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded", getStatusColor(domain.registrarVerificationStatus))}>
                            {getStatusIcon(domain.registrarVerificationStatus)}
                            Registrant: {domain.registrarVerificationStatus}
                          </span>
                        )}
                        {!domain.isConnected && domain.purchasePriceCents > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            {formatCurrency(domain.purchasePriceCents)}/yr
                          </span>
                        )}
                        {domain.expiresAt && daysLeft !== null && (
                          <span className={cn("inline-flex items-center gap-1 font-medium", getExpiryColor(daysLeft))}>
                            <Calendar className="h-3 w-3" />
                            {daysLeft <= 0 ? "Expired" : `${daysLeft} days left`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {isRetryable && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-amber-600 border-amber-300 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-700 dark:hover:bg-amber-900/20"
                        disabled={retrying === domain.id}
                        onClick={() => handleRetryRegistration(domain.id)}
                      >
                        {retrying === domain.id ? (
                          <AISpinner className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <RotateCcw className="h-4 w-4 mr-1" />
                        )}
                        Retry
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/domains/${domain.id}`)}
                      className="gap-1"
                    >
                      <span className="hidden sm:inline">Manage</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
        </div>

        <aside className="space-y-3">
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-start gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-semibold">Attention queue</h2>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {actionDomains.length === 0 ? (
                <div className="rounded-lg border bg-muted/30 p-2.5 text-sm text-muted-foreground">
                  Nothing urgent.
                </div>
              ) : (
                actionDomains.map((domain) => (
                  <button
                    key={domain.id}
                    type="button"
                    onClick={() => router.push(`/domains/${domain.id}`)}
                    className="w-full rounded-lg border bg-background p-2.5 text-left transition-colors hover:border-primary/50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-medium">{domain.domainName}</span>
                      <span className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                        domain.nextAction?.priority === 1
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                          : "bg-muted text-muted-foreground"
                      )}>
                        {domain.nextAction?.label || "Review"}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h2 className="font-semibold">Production readiness</h2>
            <div className="mt-3 space-y-2">
              <ReadinessRow label="Primary domain selected" complete={primaryDomain !== "Not selected"} />
              <ReadinessRow label="Ownership verified" complete={(summary?.verified ?? 0) > 0} />
              <ReadinessRow label="SSL active" complete={(summary?.sslReady ?? 0) > 0} />
              <ReadinessRow label="No urgent action" complete={(summary?.needsAction ?? 0) === 0} />
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h2 className="font-semibold">Best next step</h2>
            <div className="mt-3 flex flex-col gap-2">
              <Button variant="outline" className="justify-between" onClick={() => setActiveView("search")}>
                Register new
                <Search className="h-4 w-4" />
              </Button>
              <Button variant="outline" className="justify-between" onClick={() => setActiveView("connect")}>
                Connect existing
                <LinkIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ── Stripe Payment Form for Domain Purchase ──

function SetupStepTile({ step, index }: { step: DomainSetupStep; index: number }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2.5">
        <div className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          step.completed ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-muted text-muted-foreground"
        )}>
          {step.completed ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
        </div>
        <p className="truncate text-sm font-semibold">{step.label}</p>
      </div>
    </div>
  );
}

function ReadinessRow({ label, complete }: { label: string; complete: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        complete
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
          : "bg-muted text-muted-foreground"
      )}>
        {complete ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
        {complete ? "Ready" : "Open"}
      </span>
    </div>
  );
}

function DomainPaymentForm({
  domainName,
  onSuccess,
  onCancel,
}: {
  domainName: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message || "Payment validation failed");
      setProcessing(false);
      return;
    }

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/domains`,
      },
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message || "Payment failed");
      setProcessing(false);
    } else {
      toast({ title: `Payment for ${domainName} confirmed!` });
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={processing}>
          Cancel
        </Button>
        <Button type="submit" disabled={!stripe || processing}>
          {processing ? (
            <>
              <AISpinner className="h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4" />
              Pay & Register
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
