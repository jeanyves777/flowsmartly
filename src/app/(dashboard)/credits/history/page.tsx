"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  ChevronDown,
  Loader2,
  Receipt,
  TrendingUp,
  TrendingDown,
  Wallet,
  RefreshCw,
  FileText,
  CreditCard,
  Download,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ── Types ──

interface Transaction {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string | null;
  referenceType: string | null;
  createdAt: string;
}

interface Summary {
  currentBalance: number;
  totalEarned: number;
  totalSpent: number;
  transactionCount: number;
}

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  type: string;
  status: string;
  items: InvoiceItem[];
  subtotalCents: number;
  totalCents: number;
  paymentMethod: string | null;
  currency: string;
  createdAt: string;
}

// ── Constants ──

const TYPE_LABELS: Record<string, string> = {
  PURCHASE: "Purchase",
  USAGE: "Usage",
  BONUS: "Bonus",
  REFUND: "Refund",
  ADMIN_ADJUSTMENT: "Adjustment",
  SUBSCRIPTION: "Subscription",
  REFERRAL: "Referral",
  WELCOME: "Welcome",
};

const TYPE_COLORS: Record<string, string> = {
  PURCHASE: "bg-green-500/10 text-green-600 border-green-500/20",
  USAGE: "bg-red-500/10 text-red-600 border-red-500/20",
  BONUS: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  REFUND: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  ADMIN_ADJUSTMENT: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  SUBSCRIPTION: "bg-brand-500/10 text-brand-600 border-brand-500/20",
  REFERRAL: "bg-pink-500/10 text-pink-600 border-pink-500/20",
  WELCOME: "bg-teal-500/10 text-teal-600 border-teal-500/20",
};

const INVOICE_TYPE_LABELS: Record<string, string> = {
  credit_purchase: "Credit Purchase",
  subscription: "Subscription",
  sms_rental: "SMS Number Rental",
};

const FILTER_OPTIONS = [
  { value: "", label: "All Transactions" },
  { value: "PURCHASE", label: "Purchases" },
  { value: "USAGE", label: "Usage" },
  { value: "SUBSCRIPTION", label: "Subscription" },
  { value: "BONUS", label: "Bonuses" },
  { value: "REFUND", label: "Refunds" },
];

type Tab = "transactions" | "invoices";

// ── Page ──

export default function CreditHistoryPage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "invoices" ? "invoices" : "transactions";
  const [tab, setTab] = useState<Tab>(initialTab);

  // Transaction state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [txTotal, setTxTotal] = useState(0);
  const [txHasMore, setTxHasMore] = useState(false);
  const [txLoading, setTxLoading] = useState(true);
  const [txLoadingMore, setTxLoadingMore] = useState(false);
  const [filter, setFilter] = useState("");
  const [txOffset, setTxOffset] = useState(0);

  // Invoice state
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invTotal, setInvTotal] = useState(0);
  const [invLoading, setInvLoading] = useState(true);

  const LIMIT = 30;

  // ── Fetch transactions ──
  const fetchHistory = useCallback(async (reset = false) => {
    const currentOffset = reset ? 0 : txOffset;
    if (reset) setTxLoading(true);
    else setTxLoadingMore(true);

    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(currentOffset) });
      if (filter) params.set("type", filter);

      const res = await fetch(`/api/user/credits/history?${params}`);
      const data = await res.json();

      if (data.success) {
        if (reset) {
          setTransactions(data.data.transactions);
          setTxOffset(LIMIT);
        } else {
          setTransactions((prev) => [...prev, ...data.data.transactions]);
          setTxOffset((prev) => prev + LIMIT);
        }
        setTxTotal(data.data.total);
        setTxHasMore(data.data.hasMore);
        if (data.data.summary) setSummary(data.data.summary);
      }
    } catch { /* ignore */ } finally {
      setTxLoading(false);
      setTxLoadingMore(false);
    }
  }, [txOffset, filter]);

  // ── Fetch invoices ──
  const fetchInvoices = useCallback(async () => {
    setInvLoading(true);
    try {
      const res = await fetch("/api/user/invoices?limit=50");
      const data = await res.json();
      if (data.success) {
        setInvoices(data.data.invoices);
        setInvTotal(data.data.total);
      }
    } catch { /* ignore */ } finally {
      setInvLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(true); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter]);
  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  };

  const formatShortDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-4xl mx-auto"
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/settings?tab=billing">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-white" />
            </div>
            Credits & Billing
          </h1>
        </div>
        <Button size="sm" asChild>
          <Link href="/buy-credits">
            <Sparkles className="w-4 h-4 mr-2" />
            Buy Credits
          </Link>
        </Button>
      </div>

      {/* Summary Cards */}
      {summary ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="w-4 h-4 text-brand-500" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Balance</span>
              </div>
              <p className="text-2xl font-bold">{summary.currentBalance.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">credits available</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Earned</span>
              </div>
              <p className="text-2xl font-bold text-green-600">+{summary.totalEarned.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">all time</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-4 h-4 text-red-500" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Used</span>
              </div>
              <p className="text-2xl font-bold text-red-600">{summary.totalSpent.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">all time</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <Receipt className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Invoices</span>
              </div>
              <p className="text-2xl font-bold">{invTotal}</p>
              <p className="text-xs text-muted-foreground mt-1">total receipts</p>
            </CardContent>
          </Card>
        </div>
      ) : txLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[100px]" />)}
        </div>
      ) : null}

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 rounded-lg bg-muted/50 w-fit">
        <button
          onClick={() => setTab("transactions")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "transactions" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <RefreshCw className="w-4 h-4" />
          Transactions
          {txTotal > 0 && <Badge variant="secondary" className="text-xs px-1.5 py-0">{txTotal}</Badge>}
        </button>
        <button
          onClick={() => setTab("invoices")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "invoices" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="w-4 h-4" />
          Invoices
          {invTotal > 0 && <Badge variant="secondary" className="text-xs px-1.5 py-0">{invTotal}</Badge>}
        </button>
      </div>

      {/* ────────── Transactions Tab ────────── */}
      {tab === "transactions" && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-lg">Credit Transactions</CardTitle>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="w-3.5 h-3.5 mr-2" />
                  {filter ? TYPE_LABELS[filter] || filter : "All"}
                  <ChevronDown className="w-3.5 h-3.5 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {FILTER_OPTIONS.map((opt) => (
                  <DropdownMenuItem
                    key={opt.value}
                    onClick={() => setFilter(opt.value)}
                    className={filter === opt.value ? "bg-accent" : ""}
                  >
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </CardHeader>
          <CardContent>
            {txLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16" />)}
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-12">
                <Receipt className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <h3 className="font-semibold text-lg mb-1">No transactions yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {filter ? "No transactions match this filter." : "Purchase credits to get started."}
                </p>
                {!filter && (
                  <Button asChild>
                    <Link href="/buy-credits">
                      <Sparkles className="w-4 h-4 mr-2" />
                      Buy Credits
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {transactions.map((tx) => {
                  const isPositive = tx.amount > 0;
                  return (
                    <div key={tx.id} className="flex items-center gap-4 px-3 py-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isPositive ? "bg-green-500/10" : "bg-red-500/10"}`}>
                        {isPositive ? <ArrowDownRight className="w-4 h-4 text-green-500" /> : <ArrowUpRight className="w-4 h-4 text-red-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">
                            {tx.description || TYPE_LABELS[tx.type] || tx.type}
                          </p>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${TYPE_COLORS[tx.type] || ""}`}>
                            {TYPE_LABELS[tx.type] || tx.type}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatDate(tx.createdAt)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`font-semibold text-sm ${isPositive ? "text-green-600" : "text-red-600"}`}>
                          {isPositive ? "+" : ""}{tx.amount.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">bal: {tx.balanceAfter.toLocaleString()}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {txHasMore && !txLoading && (
              <div className="flex justify-center pt-4">
                <Button variant="outline" size="sm" onClick={() => fetchHistory(false)} disabled={txLoadingMore}>
                  {txLoadingMore ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Loading...</> : "Load More"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ────────── Invoices Tab ────────── */}
      {tab === "invoices" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Invoices & Receipts</CardTitle>
          </CardHeader>
          <CardContent>
            {invLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
              </div>
            ) : invoices.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <h3 className="font-semibold text-lg mb-1">No invoices yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Invoices are generated automatically when you make a purchase.
                </p>
                <Button asChild>
                  <Link href="/buy-credits">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Buy Credits
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {invoices.map((inv) => (
                  <div key={inv.id} className="flex items-center gap-4 p-4 rounded-xl border hover:bg-muted/30 transition-colors">
                    {/* Icon */}
                    <div className="w-11 h-11 rounded-lg bg-brand-500/10 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-brand-500" />
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-semibold text-sm">{inv.invoiceNumber}</p>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-500/10 text-green-600 border-green-500/20">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          {inv.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {INVOICE_TYPE_LABELS[inv.type] || inv.type}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{formatShortDate(inv.createdAt)}</span>
                        {inv.paymentMethod && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <CreditCard className="w-3 h-3" />
                              {inv.paymentMethod}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="text-right shrink-0">
                      <p className="font-bold text-lg">{formatCurrency(inv.totalCents)}</p>
                      <p className="text-xs text-muted-foreground">{inv.currency}</p>
                    </div>

                    {/* Actions */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      title="Download Invoice"
                      onClick={() => {
                        // Print-friendly view of this invoice
                        const items = inv.items.map((it: InvoiceItem) =>
                          `<tr><td style="padding:8px;border-bottom:1px solid #eee">${it.description}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${it.quantity}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">$${(it.unitPriceCents/100).toFixed(2)}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">$${(it.totalCents/100).toFixed(2)}</td></tr>`
                        ).join("");
                        const html = `<!DOCTYPE html><html><head><title>${inv.invoiceNumber}</title><style>body{font-family:system-ui,sans-serif;max-width:700px;margin:40px auto;padding:20px;color:#1a1a1a}h1{font-size:28px;margin-bottom:4px}table{width:100%;border-collapse:collapse;margin-top:24px}th{text-align:left;padding:8px;border-bottom:2px solid #333;font-size:13px;text-transform:uppercase;letter-spacing:0.5px}td{font-size:14px}.total-row td{border-top:2px solid #333;font-weight:bold;font-size:16px;padding-top:12px}.meta{color:#666;font-size:14px;line-height:1.8}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px}.badge{display:inline-block;background:#dcfce7;color:#16a34a;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600}</style></head><body><div class="header"><div><h1>Invoice</h1><p style="color:#666;margin:0">${inv.invoiceNumber}</p></div><div style="text-align:right"><h2 style="margin:0;font-size:20px">FlowSmartly</h2><p style="color:#666;margin:4px 0">flowsmartly.com</p></div></div><div class="meta"><p><strong>Date:</strong> ${formatShortDate(inv.createdAt)}</p><p><strong>Status:</strong> <span class="badge">${inv.status}</span></p>${inv.paymentMethod ? `<p><strong>Payment:</strong> ${inv.paymentMethod}</p>` : ""}</div><table><thead><tr><th>Description</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Total</th></tr></thead><tbody>${items}<tr class="total-row"><td colspan="3" style="text-align:right;padding:12px 8px">Total</td><td style="text-align:right;padding:12px 8px">$${(inv.totalCents/100).toFixed(2)} ${inv.currency}</td></tr></tbody></table><p style="margin-top:40px;color:#999;font-size:12px;text-align:center">Thank you for your purchase!</p></body></html>`;
                        const w = window.open("", "_blank");
                        if (w) { w.document.write(html); w.document.close(); w.print(); }
                      }}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
