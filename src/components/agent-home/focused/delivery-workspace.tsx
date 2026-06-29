"use client";

import { useCallback, useEffect, useState, type ElementType } from "react";
import {
  Truck,
  Sparkles,
  Package,
  Clock,
  CheckCircle2,
  MapPin,
  Phone,
  Mail,
  User,
  Bike,
  Car,
  Plus,
  X,
  Check,
  ArrowRight,
  CircleDot,
  Navigation,
  Banknote,
  Link2,
  ListChecks,
} from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * Delivery — a new-design fulfilment surface (the Delivery workspace canvas):
 * orders that need delivery with their delivery status + driver assignment, plus
 * the store's delivery drivers. Full-width master/detail — a sticky left card
 * (summary stats + a vertical status nav + driver count) and a right pane that
 * shows the deliveries list (filtered by the selected status) above the drivers.
 * The data actions are REAL UI — assign a driver
 * (POST /api/ecommerce/delivery/[orderId]), advance the delivery status
 * (PATCH /api/ecommerce/delivery/[orderId]/status), add a driver
 * (POST /api/ecommerce/drivers). A click means do-it-in-the-UI, not a chat
 * prompt. Store creation stays agent-driven (a heavy generative build). No
 * legacy links. [[surface-buttons-are-ui-actions]] [[full-width-left-menu-layout]]
 */

interface DriverRef { id: string; name?: string; phone?: string | null; }
interface DeliveryAssignment {
  id: string;
  status: string; // assigned | picked_up | in_transit | delivered | failed
  driverId?: string;
  driver?: DriverRef | null;
  estimatedDeliveryTime?: string | null;
  codAmountCents?: number | null;
  codCollected?: boolean;
}
// A delivery that still owes a cash collection (COD assigned, not yet collected).
function isCodPending(a?: DeliveryAssignment | null): boolean {
  return !!a && a.codAmountCents != null && a.codAmountCents > 0 && !a.codCollected;
}
interface ShippingAddress { name?: string; line1?: string; city?: string; state?: string; country?: string; }
interface Order {
  id: string;
  orderNumber?: string;
  customerName?: string;
  customerPhone?: string | null;
  totalCents?: number;
  currency?: string;
  status?: string; // order status
  paymentMethod?: string | null;
  shippingAddress?: ShippingAddress;
  estimatedDelivery?: string | null;
  createdAt?: string;
  deliveryAssignment?: DeliveryAssignment | null;
}
interface Driver {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  vehicleType?: string; // bike | car | truck
  region?: string | null;
  status?: string; // available | busy | offline
  isActive?: boolean;
  activeAssignmentCount?: number;
  accessToken?: string | null;
  currentLatitude?: number | null;
  currentLongitude?: number | null;
  lastLocationUpdate?: string | null;
}
interface StoreData { id: string; name: string; currency?: string; }

const FIELD = "w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60";

// Order statuses that represent something to fulfil/deliver (vs draft/cancelled).
const FULFILMENT_STATUSES = new Set(["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"]);

// Delivery (assignment) state machine — what the operator can advance to next.
const NEXT_DELIVERY: Record<string, { label: string; to: string }> = {
  assigned: { label: "Mark picked up", to: "picked_up" },
  picked_up: { label: "Start transit", to: "in_transit" },
  in_transit: { label: "Mark delivered", to: "delivered" },
};

const DELIVERY_LABEL: Record<string, string> = {
  assigned: "Assigned",
  picked_up: "Picked up",
  in_transit: "In transit",
  delivered: "Delivered",
  failed: "Failed",
};

// Which left-nav bucket an order falls into, by its delivery state. Drives the
// status filter on the deliveries list.
type DeliveryFilter = "all" | "pending" | "transit" | "delivered" | "cod";
const IN_TRANSIT_STATUSES = new Set(["assigned", "picked_up", "in_transit"]);
function orderBucket(o: Order): Exclude<DeliveryFilter, "all" | "cod"> {
  const ds = o.deliveryAssignment?.status;
  const od = (o.status || "").toUpperCase();
  if (od === "DELIVERED" || ds === "delivered") return "delivered";
  if (ds && IN_TRANSIT_STATUSES.has(ds)) return "transit";
  return "pending";
}

function deliveryTone(status?: string): string {
  switch (status) {
    case "delivered": return "bg-emerald-500/10 text-emerald-500";
    case "failed": return "bg-rose-500/10 text-rose-500";
    case "in_transit":
    case "picked_up": return "bg-violet-500/10 text-violet-500";
    case "assigned": return "bg-brand-500/10 text-brand-500";
    default: return "bg-muted text-muted-foreground";
  }
}

function driverTone(status?: string): string {
  switch (status) {
    case "available": return "bg-emerald-500/10 text-emerald-500";
    case "busy": return "bg-amber-500/10 text-amber-500";
    default: return "bg-muted text-muted-foreground";
  }
}

function vehicleIcon(type?: string): ElementType {
  if (type === "car") return Car;
  if (type === "truck") return Truck;
  return Bike;
}

function money(cents?: number | null, currency = "USD"): string {
  try { return ((cents ?? 0) / 100).toLocaleString(undefined, { style: "currency", currency, maximumFractionDigits: 0 }); } catch { return `${((cents ?? 0) / 100).toFixed(0)}`; }
}

function shortAddress(a?: ShippingAddress): string {
  if (!a) return "";
  return [a.city, a.state, a.country].filter(Boolean).join(", ");
}

// Human ETA, e.g. "Today 14:30" or a short date — defensive against bad strings.
function formatEta(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return d.toISOString(); }
}

// "just now" / "5m ago" / "2h ago" relative time for the last GPS ping.
function relativeTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  if (diff < 0) return "just now";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function gpsCoords(lat?: number | null, lng?: number | null): string {
  if (lat == null || lng == null) return "";
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function FocusedDelivery({ refreshKey, onAsk }: { refreshKey?: number; onAsk?: (prompt: string) => void }) {
  const [store, setStore] = useState<StoreData | null>(null);
  const [hasStore, setHasStore] = useState<boolean | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  // Inline driver picker per-order (orderId) and busy tracking.
  const [assigning, setAssigning] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string>("");

  // Add-driver form.
  const [addingDriver, setAddingDriver] = useState(false);
  const [driverForm, setDriverForm] = useState({ name: "", phone: "", email: "", vehicleType: "bike", region: "" });
  const [savingDriver, setSavingDriver] = useState(false);
  const [driverError, setDriverError] = useState("");

  // Which driver's tracking link was just copied (for the transient "Copied" state).
  const [copiedDriverId, setCopiedDriverId] = useState<string | null>(null);

  // Left-nav status filter for the deliveries list.
  const [statusFilter, setStatusFilter] = useState<DeliveryFilter>("all");

  const loadData = useCallback(async () => {
    const sj = await fetch("/api/ecommerce/store").then((r) => r.json()).catch(() => null);
    const has = !!sj?.data?.hasStore && !!sj?.data?.store;
    setHasStore(has);
    if (has) {
      setStore(sj.data.store);
      const [or, dr] = await Promise.all([
        fetch("/api/ecommerce/orders?limit=50").then((r) => r.json()).catch(() => null),
        fetch("/api/ecommerce/drivers").then((r) => r.json()).catch(() => null),
      ]);
      const allOrders: Order[] = Array.isArray(or?.data?.orders) ? or.data.orders : [];
      // Deliveries = orders that need fulfilment (confirmed → delivered).
      setOrders(allOrders.filter((o) => FULFILMENT_STATUSES.has((o.status || "").toUpperCase())));
      setDrivers(Array.isArray(dr?.data?.drivers) ? dr.data.drivers : []);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    loadData().finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [loadData, refreshKey]);

  const assignDriver = async (orderId: string, driverId: string) => {
    setBusy(orderId); setRowError("");
    try {
      const r = await fetch(`/api/ecommerce/delivery/${orderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.success !== false) {
        setAssigning(null);
        await loadData();
      } else {
        setRowError(j?.error?.message || "Could not assign the driver.");
      }
    } catch {
      setRowError("Could not assign the driver.");
    } finally {
      setBusy(null);
    }
  };

  const advanceDelivery = async (o: Order) => {
    const current = o.deliveryAssignment?.status || "assigned";
    const next = NEXT_DELIVERY[current];
    if (!next) return;
    setBusy(o.id); setRowError("");
    try {
      const body: Record<string, unknown> = { status: next.to };
      // COD orders: mark cash collected on delivery so payment reconciles.
      if (next.to === "delivered" && o.paymentMethod === "cod") body.codCollected = true;
      const r = await fetch(`/api/ecommerce/delivery/${o.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.success !== false) {
        await loadData();
      } else {
        setRowError(j?.error?.message || "Could not update delivery status.");
      }
    } catch {
      setRowError("Could not update delivery status.");
    } finally {
      setBusy(null);
    }
  };

  const saveDriver = async () => {
    const name = driverForm.name.trim();
    const phone = driverForm.phone.trim();
    const email = driverForm.email.trim();
    if (!name) { setDriverError("Give the driver a name."); return; }
    if (!phone) { setDriverError("Add a phone number."); return; }
    // Light client-side email check; the API also validates.
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setDriverError("That email doesn't look right."); return; }
    setSavingDriver(true); setDriverError("");
    try {
      const r = await fetch("/api/ecommerce/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          email: email || undefined,
          vehicleType: driverForm.vehicleType,
          region: driverForm.region.trim() || undefined,
        }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.success !== false) {
        setAddingDriver(false);
        setDriverForm({ name: "", phone: "", email: "", vehicleType: "bike", region: "" });
        await loadData();
      } else {
        setDriverError(j?.error?.message || "Could not add the driver.");
      }
    } catch {
      setDriverError("Could not add the driver.");
    } finally {
      setSavingDriver(false);
    }
  };

  // The driver's GPS tracking link — they open it to share live location via
  // their accessToken (POST /api/ecommerce/drivers/[id]/location?token=…).
  const copyTrackingLink = async (d: Driver) => {
    if (!d.accessToken) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const link = `${origin}/api/ecommerce/drivers/${d.id}/location?token=${d.accessToken}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedDriverId(d.id);
      window.setTimeout(() => setCopiedDriverId((cur) => (cur === d.id ? null : cur)), 2000);
    } catch {
      // Clipboard blocked (insecure context / permissions) — surface inline.
      setDriverError("Couldn't copy — copy it manually from the address bar.");
    }
  };

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading deliveries…" /></div>;
  }

  // No store yet → store creation is a heavy generative build, so the agent runs it.
  if (!hasStore) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center p-8 text-center">
        <div className="max-w-md">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/20 text-brand-500"><Truck className="h-8 w-8" /></span>
          <h2 className="mt-4 text-[20px] font-extrabold">No store to deliver for yet</h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">Set up your online store first — then orders, drivers, and delivery tracking all live here.</p>
          {onAsk && (
            <button onClick={() => onAsk("Help me build my online store — ask me what I sell, my products and prices, then create the store.")} className="mt-4 inline-flex items-center gap-2 rounded-[12px] bg-gradient-to-r from-brand-500 to-violet-500 px-5 py-2.5 text-[14px] font-semibold text-white shadow-lg shadow-brand-500/30">
              <Sparkles className="h-4 w-4" /> Create my store
            </button>
          )}
        </div>
      </div>
    );
  }

  const cur = store?.currency || "USD";
  const availableDrivers = drivers.filter((d) => d.isActive !== false && d.status !== "offline");
  // The orders list returns only { id, name } for an assignment's driver, so we
  // join against the full drivers list to surface phone + live GPS in each row.
  const driverById = new Map(drivers.map((d) => [d.id, d]));

  // KPIs across fulfilment-relevant orders.
  const delivered = orders.filter((o) => orderBucket(o) === "delivered").length;
  const inTransit = orders.filter((o) => orderBucket(o) === "transit").length;
  const pending = orders.filter((o) => orderBucket(o) === "pending").length;
  // Cash-on-delivery still owed to the store (assigned, not yet collected).
  const codPendingOrders = orders.filter((o) => isCodPending(o.deliveryAssignment));
  const codPendingCount = codPendingOrders.length;
  const codPendingCents = codPendingOrders.reduce((sum, o) => sum + (o.deliveryAssignment?.codAmountCents || 0), 0);

  // The deliveries shown in the right pane, narrowed by the left-nav filter.
  const visibleOrders = orders.filter((o) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "cod") return isCodPending(o.deliveryAssignment);
    return orderBucket(o) === statusFilter;
  });

  const statusNav: { id: DeliveryFilter; label: string; icon: ElementType; count: number; tone?: "amber" }[] = [
    { id: "all", label: "All deliveries", icon: ListChecks, count: orders.length },
    { id: "pending", label: "Pending", icon: Clock, count: pending },
    { id: "transit", label: "In transit", icon: Truck, count: inTransit },
    { id: "delivered", label: "Delivered", icon: CheckCircle2, count: delivered },
    { id: "cod", label: "COD to collect", icon: Banknote, count: codPendingCount, tone: "amber" },
  ];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start">
        {/* LEFT: sticky summary + status nav */}
        <aside className="space-y-3 lg:sticky lg:top-0 lg:w-[280px] lg:shrink-0">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start gap-2.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><Truck className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[15px] font-bold">Delivery</h2>
                <p className="truncate text-[11.5px] text-muted-foreground">Fulfilment for {store?.name}</p>
              </div>
            </div>
            {codPendingCount > 0 && (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-amber-600 dark:text-amber-400">
                <Banknote className="h-3.5 w-3.5 shrink-0" />
                <span className="text-[11.5px] font-semibold">{money(codPendingCents, cur)} cash to collect</span>
              </div>
            )}
          </div>

          {/* status nav */}
          <nav className="rounded-2xl border border-border bg-card p-1.5">
            {statusNav.map((n) => {
              const active = statusFilter === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => setStatusFilter(n.id)}
                  className={cn("flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-colors", active ? "bg-brand-500/10 text-brand-500" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")}
                >
                  <n.icon className={cn("h-4 w-4 shrink-0", !active && n.tone === "amber" && "text-amber-500")} />
                  <span className="flex-1 text-start">{n.label}</span>
                  {n.count > 0 && (
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums", active ? "bg-brand-500/15 text-brand-500" : n.tone === "amber" ? "bg-amber-500/15 text-amber-500" : "bg-muted text-muted-foreground")}>{n.count}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* RIGHT: deliveries + drivers, full width */}
        <div className="min-w-0 flex-1 space-y-4">
        {/* deliveries */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-[13px] font-bold">Deliveries</h3>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{visibleOrders.length}</span>
          </div>

          {rowError && <p className="mb-2 text-[12px] text-rose-500">{rowError}</p>}

          {visibleOrders.length ? (
            <div className="space-y-2.5">
              {visibleOrders.map((o) => {
                const a = o.deliveryAssignment;
                const next = a ? NEXT_DELIVERY[a.status] : null;
                const isBusy = busy === o.id;
                const addr = shortAddress(o.shippingAddress);
                // Full driver record (phone + live GPS) for the assigned driver.
                const fullDriver = a?.driver?.id ? driverById.get(a.driver.id) : a?.driverId ? driverById.get(a.driverId) : undefined;
                const driverPhone = a?.driver?.phone || fullDriver?.phone;
                const hasGps = fullDriver?.currentLatitude != null && fullDriver?.currentLongitude != null;
                const eta = formatEta(a?.estimatedDeliveryTime) || formatEta(o.estimatedDelivery);
                const codPending = isCodPending(a);
                return (
                  <div key={o.id} className="rounded-xl border border-border bg-muted/30 p-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-background text-muted-foreground"><Package className="h-4 w-4" /></span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[12.5px] font-semibold">{o.orderNumber || o.id.slice(0, 8)}</span>
                          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold", deliveryTone(a?.status))}>
                            <CircleDot className="h-2.5 w-2.5" />{a ? (DELIVERY_LABEL[a.status] || a.status) : "Unassigned"}
                          </span>
                        </div>
                        <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                          <span className="truncate">{o.customerName || "Customer"}</span>
                          {addr && <><span className="text-border">·</span><span className="inline-flex items-center gap-0.5 truncate"><MapPin className="h-3 w-3" />{addr}</span></>}
                        </p>
                      </div>
                      <span className="ms-auto text-[13px] font-bold">{money(o.totalCents, o.currency || cur)}{o.paymentMethod === "cod" ? <span className="ms-1 text-[10.5px] font-semibold text-amber-500">COD</span> : null}</span>
                    </div>

                    {/* assigned driver line */}
                    {a?.driver && (
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5"><User className="h-3.5 w-3.5" /><span className="font-medium text-foreground">{a.driver.name || "Driver"}</span></span>
                        {driverPhone && <><span className="text-border">·</span><span className="inline-flex items-center gap-0.5"><Phone className="h-3 w-3" />{driverPhone}</span></>}
                      </div>
                    )}

                    {/* ETA + live GPS + COD pending — only when there's an assignment */}
                    {a && (eta || hasGps || codPending) && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {eta && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
                            <Clock className="h-3 w-3" /> ETA {eta}
                          </span>
                        )}
                        {hasGps && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10.5px] font-medium text-emerald-500">
                            <Navigation className="h-3 w-3" /> {gpsCoords(fullDriver?.currentLatitude, fullDriver?.currentLongitude)}
                            {fullDriver?.lastLocationUpdate && <span className="font-normal opacity-80">· {relativeTime(fullDriver.lastLocationUpdate)}</span>}
                          </span>
                        )}
                        {codPending && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-amber-500">
                            <Banknote className="h-3 w-3" /> Collect {money(a?.codAmountCents, o.currency || cur)}
                          </span>
                        )}
                      </div>
                    )}

                    {/* actions row */}
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      {!a ? (
                        assigning === o.id ? (
                          availableDrivers.length ? (
                            <>
                              {availableDrivers.map((d) => {
                                const VIcon = vehicleIcon(d.vehicleType);
                                return (
                                  <button key={d.id} onClick={() => assignDriver(o.id, d.id)} disabled={isBusy} className="inline-flex items-center gap-1.5 rounded-[9px] border border-border bg-background px-2.5 py-1 text-[11.5px] font-semibold hover:border-brand-500/60 hover:text-foreground disabled:opacity-60">
                                    {isBusy ? <FlowLoader size={13} /> : <VIcon className="h-3.5 w-3.5" />} {d.name}
                                  </button>
                                );
                              })}
                              <button onClick={() => setAssigning(null)} className="inline-flex items-center gap-1 rounded-[9px] px-2 py-1 text-[11.5px] font-semibold text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                            </>
                          ) : (
                            <span className="text-[11.5px] text-muted-foreground">No active drivers — add one below to assign.</span>
                          )
                        ) : (
                          <button onClick={() => { setAssigning(o.id); setRowError(""); }} className="inline-flex items-center gap-1.5 rounded-[9px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[11.5px] font-semibold text-white shadow-sm">
                            <User className="h-3.5 w-3.5" /> Assign driver
                          </button>
                        )
                      ) : next ? (
                        <button onClick={() => advanceDelivery(o)} disabled={isBusy} className="inline-flex items-center gap-1.5 rounded-[9px] border border-border bg-background px-3 py-1.5 text-[11.5px] font-semibold hover:border-brand-500/60 hover:text-foreground disabled:opacity-60">
                          {isBusy ? <FlowLoader size={13} /> : <ArrowRight className="h-3.5 w-3.5" />} {next.label}
                        </button>
                      ) : a.status === "delivered" ? (
                        <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-emerald-500"><CheckCircle2 className="h-3.5 w-3.5" /> Delivered</span>
                      ) : a.status === "failed" ? (
                        <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-rose-500"><X className="h-3.5 w-3.5" /> Delivery failed</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : statusFilter !== "all" && orders.length ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
              <p className="text-[13px] font-medium">No deliveries in this status</p>
              <p className="mt-1 text-[12px] text-muted-foreground">Pick another status on the left to see the rest.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
              <p className="text-[13px] font-medium">Nothing to deliver right now</p>
              <p className="mt-1 text-[12px] text-muted-foreground">Confirmed orders that need fulfilment show up here, ready to assign to a driver.</p>
            </div>
          )}
        </section>

        {/* drivers */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-[13px] font-bold">Drivers</h3>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{drivers.length}</span>
            <button onClick={() => { setAddingDriver((v) => !v); setDriverError(""); }} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm">
              <Plus className="h-3.5 w-3.5" /> Add driver
            </button>
          </div>

          {addingDriver && (
            <div className="mb-3 rounded-xl border border-brand-500/30 bg-brand-500/5 p-3.5">
              <p className="mb-2.5 text-[12.5px] font-semibold">New driver</p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <label className="block"><span className="mb-1 block text-[11px] font-medium text-muted-foreground">Name *</span><input value={driverForm.name} onChange={(e) => setDriverForm((f) => ({ ...f, name: e.target.value }))} placeholder="Kofi A." className={FIELD} /></label>
                <label className="block"><span className="mb-1 block text-[11px] font-medium text-muted-foreground">Phone *</span><input value={driverForm.phone} onChange={(e) => setDriverForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+233 …" inputMode="tel" className={FIELD} /></label>
              </div>
              <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
                <label className="block"><span className="mb-1 block text-[11px] font-medium text-muted-foreground">Email</span><input value={driverForm.email} onChange={(e) => setDriverForm((f) => ({ ...f, email: e.target.value }))} placeholder="(optional)" type="email" inputMode="email" autoCapitalize="off" autoCorrect="off" className={FIELD} /></label>
                <label className="block"><span className="mb-1 block text-[11px] font-medium text-muted-foreground">Vehicle</span>
                  <select value={driverForm.vehicleType} onChange={(e) => setDriverForm((f) => ({ ...f, vehicleType: e.target.value }))} className={FIELD}><option value="bike">Bike</option><option value="car">Car</option><option value="truck">Truck</option></select>
                </label>
                <label className="block"><span className="mb-1 block text-[11px] font-medium text-muted-foreground">Region</span><input value={driverForm.region} onChange={(e) => setDriverForm((f) => ({ ...f, region: e.target.value }))} placeholder="(optional)" className={FIELD} /></label>
              </div>
              {driverError && <p className="mt-2 text-[12px] text-rose-500">{driverError}</p>}
              <div className="mt-3 flex items-center gap-2">
                <button onClick={saveDriver} disabled={savingDriver} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60">
                  {savingDriver ? <FlowLoader size={15} tone="white" /> : <Check className="h-3.5 w-3.5" />} Add driver
                </button>
                <button onClick={() => { setAddingDriver(false); setDriverError(""); }} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3.5 py-2 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /> Cancel</button>
              </div>
            </div>
          )}

          {drivers.length ? (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {drivers.map((d) => {
                const VIcon = vehicleIcon(d.vehicleType);
                const offline = d.isActive === false || d.status === "offline";
                const dHasGps = d.currentLatitude != null && d.currentLongitude != null;
                const copied = copiedDriverId === d.id;
                return (
                  <div key={d.id} className={cn("rounded-xl border border-border bg-muted/30 px-3 py-2.5", offline && "opacity-60")}>
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-background text-brand-500"><VIcon className="h-4 w-4" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-semibold">{d.name}</p>
                        <p className="flex items-center gap-1 truncate text-[12px] text-muted-foreground"><Phone className="h-3 w-3 shrink-0" />{d.phone}{d.region ? ` · ${d.region}` : ""}</p>
                        {d.email && <p className="flex items-center gap-1 truncate text-[11.5px] text-muted-foreground"><Mail className="h-3 w-3 shrink-0" />{d.email}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold capitalize", offline ? "bg-muted text-muted-foreground" : driverTone(d.status))}>{offline ? "Offline" : (d.status || "available")}</span>
                        {(d.activeAssignmentCount ?? 0) > 0 && <span className="text-[10.5px] font-medium text-muted-foreground">{d.activeAssignmentCount} active</span>}
                      </div>
                    </div>
                    {/* live location + tracking-link share */}
                    {(dHasGps || d.accessToken) && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
                        {dHasGps ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Navigation className="h-3 w-3 text-emerald-500" />
                            <span className="font-medium text-foreground">{gpsCoords(d.currentLatitude, d.currentLongitude)}</span>
                            {d.lastLocationUpdate && <span className="opacity-80">· {relativeTime(d.lastLocationUpdate)}</span>}
                          </span>
                        ) : d.accessToken ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Navigation className="h-3 w-3" /> No location yet</span>
                        ) : null}
                        {d.accessToken && (
                          <button onClick={() => copyTrackingLink(d)} className={cn("ms-auto inline-flex items-center gap-1 rounded-[8px] border px-2 py-1 text-[11px] font-semibold transition-colors", copied ? "border-emerald-500/40 text-emerald-500" : "border-border text-muted-foreground hover:border-brand-500/60 hover:text-foreground")}>
                            {copied ? <><Check className="h-3 w-3" /> Copied</> : <><Link2 className="h-3 w-3" /> Tracking link</>}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : !addingDriver ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
              <p className="text-[13px] font-medium">No drivers yet</p>
              <p className="mt-1 text-[12px] text-muted-foreground">Add a driver to start assigning deliveries.</p>
              <button onClick={() => { setAddingDriver(true); setDriverError(""); }} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"><Plus className="h-4 w-4" /> Add a driver</button>
            </div>
          ) : null}
        </section>
        </div>
      </div>
    </div>
  );
}
