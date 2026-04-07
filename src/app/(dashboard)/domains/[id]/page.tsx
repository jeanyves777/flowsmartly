"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Globe,
  ArrowLeft,
  Shield,
  ShieldCheck,
  Server,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  Copy,
  CheckCircle2,
  AlertCircle,
  Clock,
  Settings,
  Layers,
  Link as LinkIcon,
  Unlink,
  ToggleLeft,
  ToggleRight,
  ExternalLink,
  ShoppingBag,
  CreditCard,
  DollarSign,
  Calendar,
  Receipt,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils/cn";

// ── Types ──

interface DomainDetail {
  id: string;
  domainName: string;
  tld: string;
  registrarStatus: string;
  cloudflareStatus: string | null;
  sslStatus: string;
  nameservers: string[];
  isPrimary: boolean;
  isConnected: boolean;
  expiresAt: string | null;
}

interface DomainSettings {
  autoRenew: boolean;
  whoisPrivacy: boolean;
  storeId: string | null;
  isFree: boolean;
  purchasePriceCents: number;
  renewalPriceCents: number;
  createdAt: string;
}

interface DnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
  ttl: number;
}

interface LinkedWebsite {
  id: string;
  name: string;
  slug: string;
  customDomain: string | null;
}

interface DomainInvoice {
  id: string;
  invoiceNumber: string;
  type: string;
  totalCents: number;
  createdAt: string;
  items: any[];
}

type Tab = "overview" | "dns" | "billing" | "settings";

// ── Main Page ──

export default function DomainDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>("overview");
  const [domain, setDomain] = useState<DomainDetail | null>(null);
  const [settings, setSettings] = useState<DomainSettings | null>(null);
  const [dnsRecords, setDnsRecords] = useState<DnsRecord[]>([]);
  const [websites, setWebsites] = useState<LinkedWebsite[]>([]);
  const [invoices, setInvoices] = useState<DomainInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDomain = useCallback(async () => {
    try {
      const res = await fetch(`/api/domains/${id}`);
      const data = await res.json();
      if (data.success) {
        setDomain(data.data?.domain);
      } else {
        toast({ title: "Domain not found", variant: "destructive" });
        router.push("/domains");
      }
    } catch {
      toast({ title: "Failed to load domain", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [id, router, toast]);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch(`/api/domains`);
      const data = await res.json();
      if (data.success) {
        const d = (data.data?.domains || []).find((dom: { id: string }) => dom.id === id);
        if (d) {
          setSettings({
            autoRenew: d.autoRenew,
            whoisPrivacy: d.whoisPrivacy,
            storeId: d.storeId || null,
            isFree: d.isFree,
            purchasePriceCents: d.purchasePriceCents || 0,
            renewalPriceCents: d.renewalPriceCents || 0,
            createdAt: d.createdAt,
          });
        }
      }
    } catch { /* non-critical */ }
  }, [id]);

  const loadDns = useCallback(async () => {
    try {
      const res = await fetch(`/api/domains/${id}/dns`);
      const data = await res.json();
      if (data.success) {
        setDnsRecords(data.data?.records || []);
      }
    } catch { /* non-critical */ }
  }, [id]);

  const loadInvoices = useCallback(async (domainName?: string) => {
    try {
      const res = await fetch("/api/user/invoices?limit=50");
      const data = await res.json();
      if (data.success) {
        const all = data.data?.invoices || [];
        setInvoices(
          all.filter((inv: any) => {
            if (inv.type !== "domain_purchase" && inv.type !== "domain_renewal") return false;
            try {
              const items = typeof inv.items === "string" ? JSON.parse(inv.items) : inv.items;
              return !domainName || items.some((item: any) => item.description?.includes(domainName));
            } catch { return false; }
          })
        );
      }
    } catch { /* non-critical */ }
  }, []);

  const loadWebsites = useCallback(async () => {
    try {
      const res = await fetch("/api/websites");
      const data = await res.json();
      const list = data.websites || data.data?.websites || [];
      setWebsites(
        list.map((w: any) => ({
          id: w.id,
          name: w.name || w.slug,
          slug: w.slug,
          customDomain: w.customDomain,
        }))
      );
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => {
    loadDomain().then(() => {
      // Load invoices after domain loads so we have the name
    });
    loadSettings();
    loadDns();
    loadWebsites();
    loadInvoices();
  }, [loadDomain, loadSettings, loadDns, loadWebsites, loadInvoices]);

  // Reload invoices when domain name is known
  useEffect(() => {
    if (domain?.domainName) loadInvoices(domain.domainName);
  }, [domain?.domainName, loadInvoices]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadDomain(), loadDns()]);
    setRefreshing(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!domain) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/domains")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <Globe className="h-6 w-6 text-brand-600" />
            <h1 className="text-2xl font-bold">{domain.domainName}</h1>
            {domain.isPrimary && (
              <span className="px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 dark:bg-brand-950/30 dark:text-brand-400 text-xs font-medium">
                Primary
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={`https://${domain.domainName}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              Visit
            </a>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {([
          { key: "overview", label: "Overview", icon: Globe },
          { key: "dns", label: "DNS Records", icon: Layers },
          { key: "billing", label: "Billing", icon: CreditCard },
          { key: "settings", label: "Settings", icon: Settings },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-[1px]",
              tab === key
                ? "border-brand-600 text-brand-700 dark:text-brand-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "overview" && (
        <OverviewTab
          domain={domain}
          copyToClipboard={copyToClipboard}
        />
      )}
      {tab === "dns" && (
        <DnsTab
          domainId={id}
          records={dnsRecords}
          domainName={domain.domainName}
          hasZone={!!domain.cloudflareStatus}
          onRefresh={loadDns}
        />
      )}
      {tab === "billing" && settings && (
        <BillingTab
          domain={domain}
          settings={settings}
          invoices={invoices}
        />
      )}
      {tab === "settings" && settings && (
        <SettingsTab
          domainId={id}
          domainName={domain.domainName}
          settings={settings}
          websites={websites}
          onUpdate={() => { loadSettings(); loadDomain(); }}
        />
      )}
    </div>
  );
}

// ── Overview Tab ──

function OverviewTab({
  domain,
  copyToClipboard,
}: {
  domain: DomainDetail;
  copyToClipboard: (text: string) => void;
}) {
  const getStatusBadge = (status: string) => {
    const isActive = status === "active" || status === "active_certificate";
    const isPending = status === "pending" || status === "pending_validation" || status === "pending_registration";
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
          isActive && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
          isPending && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
          !isActive && !isPending && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
        )}
      >
        {isActive ? <CheckCircle2 className="h-3 w-3" /> : isPending ? <Clock className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
        {status}
      </span>
    );
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-[10px] font-medium text-muted-foreground uppercase mb-2">Registrar Status</p>
          {getStatusBadge(domain.registrarStatus)}
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-[10px] font-medium text-muted-foreground uppercase mb-2">Cloudflare</p>
          {getStatusBadge(domain.cloudflareStatus || "not configured")}
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-[10px] font-medium text-muted-foreground uppercase mb-2">SSL Certificate</p>
          <div className="flex items-center gap-2">
            {domain.sslStatus === "active" || domain.sslStatus === "active_certificate" ? (
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            ) : (
              <Shield className="h-4 w-4 text-amber-600" />
            )}
            {getStatusBadge(domain.sslStatus)}
          </div>
        </div>
      </div>

      {/* Domain info */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Domain</p>
            <p className="font-medium">{domain.domainName}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Type</p>
            <p className="font-medium">{domain.isConnected ? "Connected (BYOD)" : "Registered"}</p>
          </div>
          {domain.expiresAt && (
            <div>
              <p className="text-xs text-muted-foreground">Expires</p>
              <p className="font-medium">{new Date(domain.expiresAt).toLocaleDateString()}</p>
            </div>
          )}
        </div>
      </div>

      {/* Nameservers */}
      {domain.nameservers.length > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Server className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Nameservers</h3>
          </div>
          <div className="space-y-2">
            {domain.nameservers.map((ns, i) => (
              <div key={i} className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-2.5">
                <code className="text-sm font-mono">{ns}</code>
                <button onClick={() => copyToClipboard(ns)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status banners */}
      {!domain.isConnected && (domain.cloudflareStatus === "pending" || (domain.sslStatus !== "active_certificate" && domain.sslStatus !== "active")) && domain.registrarStatus === "active" && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 p-4">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-800 dark:text-blue-300">
              <p className="font-semibold mb-1">Domain setup in progress</p>
              <p>Your domain is registered and DNS is being configured automatically. SSL certificate will be provisioned once Cloudflare activates your zone. This typically takes a few minutes to a couple of hours — no action needed from you. Click Refresh to check the latest status.</p>
            </div>
          </div>
        </div>
      )}

      {domain.isConnected && domain.sslStatus !== "active_certificate" && domain.sslStatus !== "active" && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-800 dark:text-amber-300">
              <p className="font-semibold mb-1">Setup not complete</p>
              <p>Update your nameservers at your domain registrar to the ones shown above. SSL will be provisioned automatically once nameservers are active (24-48 hours).</p>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── Billing Tab ──

function BillingTab({
  domain,
  settings,
  invoices,
}: {
  domain: DomainDetail;
  settings: DomainSettings;
  invoices: DomainInvoice[];
}) {
  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const daysLeft = domain.expiresAt
    ? Math.ceil((new Date(domain.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const getExpiryColor = (days: number) => {
    if (days <= 7) return "text-red-600";
    if (days <= 30) return "text-amber-600";
    return "text-emerald-600";
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Pricing cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <p className="text-[10px] font-medium text-muted-foreground uppercase">Purchase Price</p>
          </div>
          <p className="text-xl font-bold">
            {settings.isFree ? "Free" : domain.isConnected ? "N/A" : formatCurrency(settings.purchasePriceCents)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {settings.isFree ? "Pro plan perk" : domain.isConnected ? "External domain" : "one-time"}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            <p className="text-[10px] font-medium text-muted-foreground uppercase">Renewal Price</p>
          </div>
          <p className="text-xl font-bold">
            {domain.isConnected ? "N/A" : formatCurrency(settings.renewalPriceCents)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {domain.isConnected ? "No renewal needed" : "per year"}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <p className="text-[10px] font-medium text-muted-foreground uppercase">Expires</p>
          </div>
          <p className="text-xl font-bold">
            {domain.expiresAt
              ? new Date(domain.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : "N/A"}
          </p>
          {daysLeft !== null && (
            <p className={cn("text-xs font-medium mt-1", getExpiryColor(daysLeft))}>
              {daysLeft <= 0 ? "EXPIRED" : `${daysLeft} days remaining`}
            </p>
          )}
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <p className="text-[10px] font-medium text-muted-foreground uppercase">Registered</p>
          </div>
          <p className="text-xl font-bold">
            {settings.createdAt
              ? new Date(settings.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : "N/A"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">purchase date</p>
        </div>
      </div>

      {/* Auto-renew status */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Auto-Renewal Status</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {settings.autoRenew
                ? `Enabled — domain will auto-renew at ${formatCurrency(settings.renewalPriceCents)}/yr before expiry`
                : "Disabled — domain will expire unless manually renewed"}
            </p>
          </div>
          <span className={cn(
            "px-2.5 py-1 rounded-full text-xs font-medium",
            settings.autoRenew
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          )}>
            {settings.autoRenew ? "Enabled" : "Disabled"}
          </span>
        </div>
      </div>

      {/* Payment History */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Payment History
          </h3>
        </div>
        {invoices.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No payment records found for this domain.</p>
          </div>
        ) : (
          <div>
            {/* Table header */}
            <div className="grid grid-cols-[1fr_120px_100px_80px] gap-3 px-5 py-2.5 bg-muted/50 text-[10px] font-medium text-muted-foreground uppercase">
              <span>Invoice</span>
              <span>Date</span>
              <span className="text-right">Amount</span>
              <span className="text-right">Status</span>
            </div>
            {invoices.map((inv) => (
              <div key={inv.id} className="grid grid-cols-[1fr_120px_100px_80px] gap-3 px-5 py-3 border-t items-center text-sm">
                <div>
                  <p className="font-medium">{inv.invoiceNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {inv.type === "domain_purchase" ? "Domain Purchase" : "Domain Renewal"}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(inv.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
                <span className="text-right font-semibold">{formatCurrency(inv.totalCents)}</span>
                <span className="text-right">
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="h-3 w-3" />
                    Paid
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── DNS Tab ──

function DnsTab({
  domainId,
  records,
  domainName,
  hasZone,
  onRefresh,
}: {
  domainId: string;
  records: DnsRecord[];
  domainName: string;
  hasZone: boolean;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // New record form
  const [newType, setNewType] = useState("A");
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newProxied, setNewProxied] = useState(true);

  const handleAdd = async () => {
    if (!newName || !newContent) {
      toast({ title: "Name and content are required", variant: "destructive" });
      return;
    }
    setAdding(true);
    try {
      const res = await fetch(`/api/domains/${domainId}/dns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: newType,
          name: newName.includes(".") ? newName : `${newName}.${domainName}`,
          content: newContent,
          proxied: newProxied,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "DNS record created" });
        setShowAdd(false);
        setNewName("");
        setNewContent("");
        onRefresh();
      } else {
        toast({ title: data.error?.message || "Failed to create record", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to create DNS record", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (recordId: string) => {
    if (!confirm("Delete this DNS record?")) return;
    setDeleting(recordId);
    try {
      const res = await fetch(`/api/domains/${domainId}/dns`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "DNS record deleted" });
        onRefresh();
      } else {
        toast({ title: data.error?.message || "Failed to delete", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to delete DNS record", variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  const typeColors: Record<string, string> = {
    A: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    AAAA: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
    CNAME: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
    MX: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    TXT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    NS: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
    SRV: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
    CAA: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  };

  if (!hasZone) {
    return (
      <div className="rounded-xl border bg-card p-12 text-center">
        <Layers className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
        <h3 className="font-semibold mb-1">No Cloudflare Zone</h3>
        <p className="text-sm text-muted-foreground">DNS management requires an active Cloudflare zone. This will be configured automatically.</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{records.length} record{records.length !== 1 ? "s" : ""}</p>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="h-4 w-4" />
          Add Record
        </Button>
      </div>

      {/* Add record form */}
      {showAdd && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="rounded-xl border bg-card p-5 space-y-3"
        >
          <h3 className="text-sm font-semibold">New DNS Record</h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="w-full mt-1 rounded-md border bg-background px-3 py-2 text-sm"
              >
                {["A", "AAAA", "CNAME", "MX", "TXT", "SRV", "CAA", "NS"].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Name</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={`@ or subdomain`}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Content</label>
              <Input
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder={newType === "A" ? "IP address" : newType === "CNAME" ? "target.com" : "value"}
                className="mt-1"
              />
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <button
                  type="button"
                  onClick={() => setNewProxied(!newProxied)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {newProxied ? (
                    <ToggleRight className="h-5 w-5 text-brand-600" />
                  ) : (
                    <ToggleLeft className="h-5 w-5" />
                  )}
                </button>
                <span className="text-xs">Proxied</span>
              </label>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAdd} disabled={adding}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add
            </Button>
          </div>
        </motion.div>
      )}

      {/* Records list */}
      {records.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No DNS records found. Add your first record above.</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[80px_1fr_1fr_80px_60px] gap-3 px-4 py-2.5 bg-muted/50 text-[10px] font-medium text-muted-foreground uppercase">
            <span>Type</span>
            <span>Name</span>
            <span>Content</span>
            <span>Proxy</span>
            <span></span>
          </div>
          {records.map((record) => (
            <div
              key={record.id}
              className="grid grid-cols-[80px_1fr_1fr_80px_60px] gap-3 px-4 py-3 border-t items-center text-sm"
            >
              <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold text-center", typeColors[record.type] || "bg-muted text-muted-foreground")}>
                {record.type}
              </span>
              <span className="font-mono text-xs truncate">{record.name}</span>
              <span className="font-mono text-xs truncate text-muted-foreground">{record.content}</span>
              <span>
                {record.proxied ? (
                  <span className="text-[10px] text-amber-600 font-medium">Proxied</span>
                ) : (
                  <span className="text-[10px] text-muted-foreground">DNS only</span>
                )}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                onClick={() => handleDelete(record.id)}
                disabled={deleting === record.id}
              >
                {deleting === record.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </Button>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ── Settings Tab ──

function SettingsTab({
  domainId,
  domainName,
  settings,
  websites,
  onUpdate,
}: {
  domainId: string;
  domainName: string;
  settings: DomainSettings;
  websites: LinkedWebsite[];
  onUpdate: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const updateSetting = async (data: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/domains/${domainId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: "Settings updated" });
        onUpdate();
      } else {
        toast({ title: result.error?.message || "Update failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to update settings", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const linkedWebsite = websites.find((w) => w.customDomain === domainName);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Auto-renew */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Auto-Renew</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Automatically renew this domain before it expires</p>
          </div>
          <button
            onClick={() => updateSetting({ autoRenew: !settings.autoRenew })}
            disabled={saving}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {settings.autoRenew ? (
              <ToggleRight className="h-8 w-8 text-brand-600" />
            ) : (
              <ToggleLeft className="h-8 w-8" />
            )}
          </button>
        </div>
      </div>

      {/* WHOIS Privacy */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">WHOIS Privacy</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Hide your personal info from public WHOIS lookups</p>
          </div>
          <button
            onClick={() => updateSetting({ whoisPrivacy: !settings.whoisPrivacy })}
            disabled={saving}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {settings.whoisPrivacy ? (
              <ToggleRight className="h-8 w-8 text-brand-600" />
            ) : (
              <ToggleLeft className="h-8 w-8" />
            )}
          </button>
        </div>
      </div>

      {/* Domain Assignment — main domain points to ONE target */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Domain Assignment</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your main domain (<span className="font-mono">{domainName}</span>) can point to one destination.
            Use a <span className="font-mono">shop.</span> subdomain for your store if you want both.
          </p>
        </div>

        {/* Main domain target */}
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase">{domainName} points to:</p>

          {linkedWebsite ? (
            <div className="flex items-center justify-between bg-background rounded-lg px-4 py-3 border">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-brand-600" />
                <span className="text-sm font-medium">{linkedWebsite.name}</span>
                <span className="text-xs text-muted-foreground">(Website)</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateSetting({ linkToWebsite: null })}
                disabled={saving}
              >
                <Unlink className="h-4 w-4" />
                Unlink
              </Button>
            </div>
          ) : settings.storeId ? (
            <div className="flex items-center justify-between bg-background rounded-lg px-4 py-3 border">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-brand-600" />
                <span className="text-sm font-medium">FlowShop Store</span>
                <span className="text-xs text-muted-foreground">(Store)</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateSetting({ linkToStore: false })}
                disabled={saving}
              >
                <Unlink className="h-4 w-4" />
                Unlink
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Not linked to anything yet. Choose a destination:</p>
              <div className="flex flex-wrap gap-2">
                {websites.filter((w) => !w.customDomain).map((website) => (
                  <Button
                    key={website.id}
                    size="sm"
                    variant="outline"
                    onClick={() => updateSetting({ linkToWebsite: website.id })}
                    disabled={saving}
                  >
                    <Globe className="h-3.5 w-3.5" />
                    {website.name}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateSetting({ linkToStore: true })}
                  disabled={saving}
                >
                  <LinkIcon className="h-3.5 w-3.5" />
                  FlowShop Store
                </Button>
              </div>
              {websites.length === 0 && (
                <p className="text-[11px] text-muted-foreground">No websites yet. You can link to your FlowShop store, or create a website first.</p>
              )}
            </div>
          )}
        </div>

        {/* Shop subdomain for store */}
        <ShopSubdomainSection
          domainId={domainId}
          domainName={domainName}
          hasStoreOnMain={!!settings.storeId && !linkedWebsite}
          saving={saving}
          onUpdate={onUpdate}
        />
      </div>
    </motion.div>
  );
}

// ── Shop Subdomain Section ──

function ShopSubdomainSection({
  domainId,
  domainName,
  hasStoreOnMain,
  saving: parentSaving,
  onUpdate,
}: {
  domainId: string;
  domainName: string;
  hasStoreOnMain: boolean;
  saving: boolean;
  onUpdate: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [shopSubdomain, setShopSubdomain] = useState<boolean | null>(null);
  const [hasStore, setHasStore] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const [toggling, setToggling] = useState(false);

  const shopHost = `shop.${domainName}`;

  // Check if shop subdomain CNAME already exists AND if user has a store
  useEffect(() => {
    (async () => {
      try {
        const [dnsRes, storeRes] = await Promise.all([
          fetch(`/api/domains/${domainId}/dns`),
          fetch("/api/ecommerce/store"),
        ]);
        const dnsData = await dnsRes.json();
        if (dnsData.success) {
          const records = dnsData.data?.records || [];
          setShopSubdomain(records.some(
            (r: DnsRecord) => r.type === "CNAME" && r.name === shopHost
          ));
        }
        const storeData = await storeRes.json();
        setHasStore(!!(storeData.store || storeData.data?.store));
      } catch { /* ignore */ }
      setChecking(false);
    })();
  }, [domainId, shopHost]);

  const toggleShopSubdomain = async () => {
    // Check store exists before enabling
    if (!shopSubdomain && !hasStore) {
      toast({
        title: "No FlowShop store found",
        description: "Create a FlowShop store first before enabling a shop subdomain.",
        variant: "destructive",
      });
      router.push("/ecommerce");
      return;
    }

    setToggling(true);
    try {
      if (shopSubdomain) {
        // Remove shop subdomain — find and delete the CNAME record
        const res = await fetch(`/api/domains/${domainId}/dns`);
        const data = await res.json();
        const records = data.data?.records || [];
        const shopRecord = records.find(
          (r: DnsRecord) => r.type === "CNAME" && r.name === shopHost
        );
        if (shopRecord) {
          await fetch(`/api/domains/${domainId}/dns`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ recordId: shopRecord.id }),
          });
        }
        // Unlink store from this domain
        await fetch(`/api/domains/${domainId}/settings`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ linkToStore: false }),
        });
        setShopSubdomain(false);
        toast({ title: `${shopHost} subdomain removed` });
      } else {
        // Create shop subdomain CNAME pointing to main domain
        const res = await fetch(`/api/domains/${domainId}/dns`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "CNAME",
            name: shopHost,
            content: domainName,
            proxied: true,
          }),
        });
        const data = await res.json();
        if (data.success) {
          // Auto-link store to this domain
          await fetch(`/api/domains/${domainId}/settings`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ linkToStore: true }),
          });
          setShopSubdomain(true);
          toast({ title: `${shopHost} is live! Your store is now accessible at shop.${domainName}` });
        } else {
          toast({ title: data.error?.message || "Failed to create subdomain", variant: "destructive" });
        }
      }
      onUpdate();
    } catch {
      toast({ title: "Failed to update shop subdomain", variant: "destructive" });
    } finally {
      setToggling(false);
    }
  };

  if (checking) return null;

  // Don't show if store is already on the main domain
  if (hasStoreOnMain) return null;

  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-violet-100 dark:bg-violet-950/30 flex items-center justify-center">
            <ShoppingBag className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-semibold">Shop Subdomain</p>
            <p className="text-xs text-muted-foreground">
              {shopSubdomain ? (
                <><span className="font-mono text-brand-600">{shopHost}</span> is active for your store</>
              ) : !hasStore ? (
                <>You need a FlowShop store to enable <span className="font-mono">{shopHost}</span></>
              ) : (
                <>Create <span className="font-mono">{shopHost}</span> for your FlowShop store while your main domain serves your website</>
              )}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant={shopSubdomain ? "outline" : !hasStore ? "outline" : "default"}
          onClick={toggleShopSubdomain}
          disabled={toggling || parentSaving}
        >
          {toggling ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : shopSubdomain ? (
            <>
              <Unlink className="h-3.5 w-3.5" />
              Remove
            </>
          ) : !hasStore ? (
            <>
              <ShoppingBag className="h-3.5 w-3.5" />
              Create Store
            </>
          ) : (
            <>
              <Plus className="h-3.5 w-3.5" />
              Enable
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
