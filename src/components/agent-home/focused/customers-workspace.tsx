"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ElementType } from "react";
import { Users, Repeat, Coins, UserPlus, Check, ShoppingBag, Clock, Mail, Phone, Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

const PAGE_SIZE = 20;

/**
 * Customers — a deep new-design ecommerce surface (the Customers workspace
 * canvas): your store's buyers with order count + total spent + last order, plus
 * KPIs (total, repeat, revenue). The data action is REAL UI — "Add to contacts"
 * per customer POSTs and refreshes, it's not a chat prompt. No store yet → a calm
 * empty state (no legacy link). [[surface-buttons-are-ui-actions]]
 */

interface Customer {
  id: string;
  name?: string | null;
  email: string;
  phone?: string | null;
  createdAt?: string;
  orderCount?: number;
  totalSpentCents?: number;
  lastOrderAt?: string | null;
}

function money(cents?: number, currency = "USD"): string {
  try {
    return ((cents ?? 0) / 100).toLocaleString(undefined, { style: "currency", currency, maximumFractionDigits: 0 });
  } catch {
    return `${((cents ?? 0) / 100).toFixed(0)}`;
  }
}

function whenLabel(iso?: string | null): string {
  if (!iso) return "No orders";
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

function initials(c: Customer): string {
  const base = (c.name || c.email || "?").trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 1).toUpperCase();
}

export function FocusedCustomers({ refreshKey }: { refreshKey?: number }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [hasStore, setHasStore] = useState<boolean | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  // `fetching` is the lightweight in-place spinner for search/page changes — it
  // never blanks the whole surface the way the first-load `loading` does.
  const [fetching, setFetching] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [added, setAdded] = useState<Record<string, boolean>>({});

  // Search (debounced) + pagination.
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Debounce the raw input into the applied `search`, resetting to page 1.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch((prev) => {
        if (prev !== searchInput.trim()) setPage(1);
        return searchInput.trim();
      });
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (search) qs.set("search", search);
      const r = await fetch(`/api/ecommerce/customers?${qs.toString()}`);
      // No store → the route answers 404; treat that as "no store yet".
      if (r.status === 404) {
        setHasStore(false);
        return;
      }
      const j = await r.json().catch(() => null);
      if (j?.success && j.data) {
        setHasStore(true);
        setCustomers(Array.isArray(j.data.customers) ? (j.data.customers as Customer[]) : []);
        if (typeof j.data.total === "number") setTotal(j.data.total);
        setTotalPages(typeof j.data.totalPages === "number" && j.data.totalPages > 0 ? j.data.totalPages : 1);
      } else {
        // Unauthorized or unexpected — show as no store rather than a broken view.
        setHasStore(false);
      }
    } catch {
      setHasStore(false);
    }
  }, [page, search]);

  // First mount / refreshKey → full-surface loader. Search & page changes only
  // toggle the in-place `fetching` spinner so the list stays put. A ref tracks
  // whether we've completed the very first load.
  const didInitialLoad = useRef(false);
  useEffect(() => {
    let alive = true;
    const initial = !didInitialLoad.current;
    if (initial) setLoading(true); else setFetching(true);
    load().finally(() => {
      if (!alive) return;
      didInitialLoad.current = true;
      setLoading(false);
      setFetching(false);
    });
    return () => { alive = false; };
  }, [load, refreshKey]);

  const addToContacts = async (c: Customer) => {
    setBusy(c.id);
    try {
      const r = await fetch(`/api/ecommerce/customers/${c.id}/add-to-contacts`, { method: "POST" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.success) {
        setAdded((m) => ({ ...m, [c.id]: true }));
        await load();
      }
    } catch {
      /* ignore */
    } finally {
      setBusy(null);
    }
  };

  // KPIs over the loaded page: repeat buyers and revenue from real order stats.
  const { repeat, revenueCents } = useMemo(() => {
    let repeat = 0;
    let revenueCents = 0;
    for (const c of customers) {
      if ((c.orderCount ?? 0) >= 2) repeat += 1;
      revenueCents += c.totalSpentCents ?? 0;
    }
    return { repeat, revenueCents };
  }, [customers]);

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading your customers…" /></div>;
  }

  // No store yet → store creation is a heavy generative build, owned by the agent.
  if (!hasStore) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center p-8 text-center">
        <div className="max-w-md">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/20 text-brand-500"><Users className="h-8 w-8" /></span>
          <h2 className="mt-4 text-[20px] font-extrabold">No customers yet</h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">Your store&apos;s buyers will show up here once you launch a store and start taking orders — with their order count, total spent, and last order.</p>
        </div>
      </div>
    );
  }

  const totalCount = total || customers.length;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <Kpi icon={Users} label="Customers" value={totalCount.toLocaleString()} />
          <Kpi icon={Repeat} label="Repeat buyers" value={repeat.toLocaleString()} />
          <Kpi icon={Coins} label="Revenue" value={money(revenueCents)} />
        </div>

        {/* Customers list */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <h3 className="flex items-center gap-2 text-[13px] font-bold">
              Your customers
              {fetching && <FlowLoader size={14} />}
            </h3>
            {/* Search by name / email — debounced, drives the `search` query param. */}
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by name or email…"
                aria-label="Search customers"
                className="w-full rounded-[10px] border border-border bg-muted/30 py-1.5 pl-8 pr-7 text-[12px] outline-none transition placeholder:text-muted-foreground focus:border-brand-500/60"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput("")}
                  aria-label="Clear search"
                  className="absolute right-1.5 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          {customers.length ? (
            <div className="space-y-2">
              {customers.map((c) => {
                const isAdded = added[c.id];
                return (
                  <div key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500/30 to-violet-500/30 text-[12px] font-bold text-brand-500">{initials(c)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{c.name || c.email || "Customer"}</p>
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-muted-foreground">
                        {c.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {c.email}</span>}
                        {c.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {c.phone}</span>}
                      </p>
                    </div>

                    {/* per-customer stats */}
                    <div className="flex items-center gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1" title="Paid orders"><ShoppingBag className="h-3.5 w-3.5" /> {(c.orderCount ?? 0).toLocaleString()}</span>
                      <span className="inline-flex items-center gap-1" title="Last order"><Clock className="h-3.5 w-3.5" /> {whenLabel(c.lastOrderAt)}</span>
                    </div>
                    <span className="shrink-0 text-[13px] font-bold tabular-nums">{money(c.totalSpentCents)}</span>

                    <button
                      onClick={() => addToContacts(c)}
                      disabled={busy === c.id || isAdded}
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1.5 rounded-[10px] border px-2.5 py-1.5 text-[11.5px] font-semibold transition disabled:opacity-70",
                        isAdded ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500" : "border-border hover:border-brand-500/60 hover:text-foreground",
                      )}
                    >
                      {busy === c.id ? <FlowLoader size={13} /> : isAdded ? <Check className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
                      {isAdded ? "In contacts" : "Add to contacts"}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : search ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
              <p className="text-[13px] font-medium">No matches</p>
              <p className="mt-1 text-[12px] text-muted-foreground">No customers match &ldquo;{search}&rdquo;. Try a different name or email.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
              <p className="text-[13px] font-medium">No customers yet</p>
              <p className="mt-1 text-[12px] text-muted-foreground">Share your storefront — once people buy, they&apos;ll appear here with their orders and spend.</p>
            </div>
          )}

          {/* Pagination — uses the totalPages the API returns. */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
              <p className="text-[11.5px] text-muted-foreground">
                Page <span className="font-semibold text-foreground">{page}</span> of {totalPages}
                <span className="hidden sm:inline"> · {totalCount.toLocaleString()} customers</span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || fetching}
                  className="inline-flex items-center gap-1 rounded-[10px] border border-border px-2.5 py-1.5 text-[11.5px] font-semibold transition hover:border-brand-500/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || fetching}
                  className="inline-flex items-center gap-1 rounded-[10px] border border-border px-2.5 py-1.5 text-[11.5px] font-semibold transition hover:border-brand-500/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className="flex items-center gap-1.5 text-muted-foreground"><Icon className="h-4 w-4" /><span className="text-[11.5px] font-medium">{label}</span></div>
      <p className="mt-1.5 text-[22px] font-extrabold leading-none">{value}</p>
    </div>
  );
}
