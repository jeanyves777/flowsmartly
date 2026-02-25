"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  Search,
  Plus,
  Shield,
  ShieldCheck,
  Star,
  Trash2,
  ExternalLink,
  RefreshCw,
  Loader2,
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
  Clock,
  Copy,
  Server,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils/cn";
import { DomainSearch } from "@/components/ecommerce/domain-search";

interface StoreDomain {
  id: string;
  domainName: string;
  tld: string;
  registrarStatus: string;
  sslStatus: string;
  isPrimary: boolean;
  isConnected: boolean;
  isFree: boolean;
  autoRenew: boolean;
  whoisPrivacy: boolean;
  nameservers: string;
  expiresAt: string | null;
  createdAt: string;
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
}

export function DomainsPageContent() {
  const { toast } = useToast();
  const [domains, setDomains] = useState<StoreDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<"list" | "search" | "connect">("list");
  const [selectedDomain, setSelectedDomain] = useState<DomainStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<string | null>(null);
  const [connectDomain, setConnectDomain] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [purchasing, setPurchasing] = useState(false);

  const loadDomains = useCallback(async () => {
    try {
      const res = await fetch("/api/domains");
      const data = await res.json();
      if (data.success) {
        setDomains(data.data?.domains || []);
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
    if (!confirm("Are you sure you want to disconnect this domain? This cannot be undone.")) return;
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
    setPurchasing(true);
    try {
      const res = await fetch("/api/domains/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domain.split(".")[0], tld, isFree: retailCents === 0 }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: `${domain} registered successfully!` });
        setActiveView("list");
        loadDomains();
      } else {
        toast({ title: data.error?.message || "Purchase failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Domain purchase failed", variant: "destructive" });
    } finally {
      setPurchasing(false);
    }
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
        toast({ title: "Domain connected! Update your nameservers." });
        setConnectDomain("");
        setActiveView("list");
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
      case "active_certificate":
        return "text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30";
      case "pending":
      case "pending_validation":
        return "text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30";
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
        return <CheckCircle2 className="h-3.5 w-3.5" />;
      case "pending":
      case "pending_validation":
        return <Clock className="h-3.5 w-3.5" />;
      default:
        return <AlertCircle className="h-3.5 w-3.5" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Domains</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Register, connect, and manage your custom domains
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={activeView === "search" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveView(activeView === "search" ? "list" : "search")}
          >
            <Search className="h-4 w-4 mr-1.5" />
            Register New
          </Button>
          <Button
            variant={activeView === "connect" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveView(activeView === "connect" ? "list" : "connect")}
          >
            <LinkIcon className="h-4 w-4 mr-1.5" />
            Connect Existing
          </Button>
        </div>
      </div>

      {/* Search Panel */}
      <AnimatePresence>
        {activeView === "search" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border bg-card p-6">
              <h2 className="text-lg font-semibold mb-1">Register a New Domain</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Search for available domains and register them instantly.
              </p>
              <DomainSearch
                onSelect={handlePurchase}
                isPro={false}
                freeDomainClaimed={false}
              />
              {purchasing && (
                <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Registering domain...
                </div>
              )}
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
            <div className="rounded-xl border bg-card p-6">
              <h2 className="text-lg font-semibold mb-1">Connect Your Domain</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Already own a domain? Connect it to your FlowSmartly store by updating your nameservers.
              </p>
              <div className="flex gap-3">
                <Input
                  value={connectDomain}
                  onChange={(e) => setConnectDomain(e.target.value)}
                  placeholder="Enter your domain (e.g. mybrand.com)"
                  onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                />
                <Button onClick={handleConnect} disabled={connecting || !connectDomain.trim()}>
                  {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Connect
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Domain List */}
      {domains.length === 0 && activeView === "list" ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border bg-card p-12 text-center"
        >
          <Globe className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
          <h2 className="text-xl font-bold mb-2">No Domains Yet</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Register a new domain or connect one you already own to your FlowSmartly store.
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => setActiveView("search")}>
              <Search className="h-4 w-4 mr-1.5" />
              Register New Domain
            </Button>
            <Button variant="outline" onClick={() => setActiveView("connect")}>
              <LinkIcon className="h-4 w-4 mr-1.5" />
              Connect Existing
            </Button>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {domains.map((domain) => (
            <motion.div
              key={domain.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border bg-card p-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-brand-100 dark:bg-brand-950/30 flex items-center justify-center">
                    <Globe className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{domain.domainName}</span>
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
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
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
                      {domain.expiresAt && (
                        <span>
                          Expires: {new Date(domain.expiresAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCheckStatus(domain.id)}
                    disabled={loadingStatus === domain.id}
                  >
                    {loadingStatus === domain.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                  {!domain.isPrimary && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSetPrimary(domain.id)}
                    >
                      <Star className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDisconnect(domain.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                  >
                    <a href={`https://${domain.domainName}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>

              {/* Expanded Status Panel */}
              {selectedDomain?.id === domain.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-4 pt-4 border-t space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase">Registrar</p>
                      <p className="text-sm font-semibold mt-1">{selectedDomain.registrarStatus}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase">Cloudflare</p>
                      <p className="text-sm font-semibold mt-1">{selectedDomain.cloudflareStatus || "N/A"}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase">SSL</p>
                      <p className="text-sm font-semibold mt-1">{selectedDomain.sslStatus}</p>
                    </div>
                  </div>
                  {selectedDomain.nameservers.length > 0 && (
                    <div className="rounded-lg bg-muted/50 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Server className="h-4 w-4 text-muted-foreground" />
                        <p className="text-[10px] font-medium text-muted-foreground uppercase">Nameservers</p>
                      </div>
                      <div className="space-y-1">
                        {selectedDomain.nameservers.map((ns, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <code className="text-xs font-mono">{ns}</code>
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
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
