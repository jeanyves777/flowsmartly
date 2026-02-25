"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Package,
  Truck,
  MapPin,
  Clock,
  DollarSign,
  User,
  Phone,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  Navigation,
} from "lucide-react";
import { ORDER_STATUSES } from "@/lib/constants/ecommerce";

interface OrderItem {
  productId?: string;
  name: string;
  quantity: number;
  priceCents: number;
  imageUrl?: string;
  variantId?: string;
}

interface Address {
  name?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

interface Driver {
  id: string;
  name: string;
  phone: string;
  email?: string;
  currentLatitude?: number | null;
  currentLongitude?: number | null;
  lastLocationUpdate?: string | null;
  vehicleType?: string;
  status?: string;
  activeAssignmentCount?: number;
}

interface DeliveryAssignment {
  id: string;
  status: string;
  pickupAddress: Address;
  deliveryAddress: Address;
  estimatedDeliveryTime: string | null;
  actualDeliveryTime: string | null;
  proofOfDelivery: Record<string, unknown>;
  codAmountCents: number | null;
  codCollected: boolean;
  notes: string | null;
  driver: Driver;
}

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  items: OrderItem[];
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  status: string;
  paymentMethod: string | null;
  paymentStatus: string;
  paymentId: string | null;
  shippingAddress: Address;
  shippingMethod: string | null;
  trackingNumber: string | null;
  estimatedDelivery: string | null;
  notes: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  deliveryAssignment: DeliveryAssignment | null;
}

function formatCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function formatAddress(addr: Address): string {
  const parts = [addr.line1, addr.line2, addr.city, addr.state, addr.zip, addr.country].filter(Boolean);
  return parts.join(", ") || "No address provided";
}

// Status timeline: all statuses in order
const STATUS_TIMELINE = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"];

function StatusTimeline({ currentStatus }: { currentStatus: string }) {
  const currentIdx = STATUS_TIMELINE.indexOf(currentStatus);
  const isCancelled = currentStatus === "CANCELLED";
  const isRefunded = currentStatus === "REFUNDED";

  return (
    <div className="space-y-3">
      {STATUS_TIMELINE.map((s, idx) => {
        const config = ORDER_STATUSES[s];
        const isCompleted = !isCancelled && !isRefunded && idx <= currentIdx;
        const isCurrent = s === currentStatus;

        return (
          <div key={s} className="flex items-center gap-3">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                isCompleted
                  ? "bg-green-500 text-white"
                  : isCurrent
                  ? "bg-blue-500 text-white"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {isCompleted ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <span className="text-xs font-medium">{idx + 1}</span>
              )}
            </div>
            <span
              className={`text-sm ${
                isCompleted
                  ? "text-green-700 font-medium"
                  : isCurrent
                  ? "text-blue-700 font-medium"
                  : "text-muted-foreground"
              }`}
            >
              {config?.label || s}
            </span>
          </div>
        );
      })}
      {isCancelled && (
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-full flex items-center justify-center bg-red-500 text-white flex-shrink-0">
            <XCircle className="w-4 h-4" />
          </div>
          <span className="text-sm text-red-700 font-medium">Cancelled</span>
        </div>
      )}
      {isRefunded && (
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-full flex items-center justify-center bg-muted-foreground text-white flex-shrink-0">
            <DollarSign className="w-4 h-4" />
          </div>
          <span className="text-sm text-foreground font-medium">Refunded</span>
        </div>
      )}
    </div>
  );
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const [newNote, setNewNote] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Assign driver modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [loadingDrivers, setLoadingDrivers] = useState(false);

  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/ecommerce/orders/${orderId}`);
      const json = await res.json();
      if (json.success) {
        setOrder(json.data.order);
      } else {
        setError(json.error?.message || "Failed to load order");
      }
    } catch (err) {
      console.error("Failed to fetch order:", err);
      setError("Failed to load order");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const updateOrder = async (data: Record<string, unknown>) => {
    setUpdating(true);
    setError("");
    try {
      const res = await fetch(`/api/ecommerce/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success) {
        setOrder(json.data.order);
        setShowCancelModal(false);
        setCancelReason("");
      } else {
        setError(json.error?.message || "Failed to update order");
      }
    } catch (err) {
      console.error("Update order error:", err);
      setError("Failed to update order");
    } finally {
      setUpdating(false);
    }
  };

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === "CANCELLED") {
      setShowCancelModal(true);
      return;
    }
    updateOrder({ status: newStatus });
  };

  const handleCancel = () => {
    if (!cancelReason.trim()) return;
    updateOrder({ status: "CANCELLED", cancelReason: cancelReason.trim() });
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    const existingNotes = order?.notes || "";
    const timestamp = new Date().toLocaleString();
    const combined = existingNotes
      ? `${existingNotes}\n\n[${timestamp}] ${newNote.trim()}`
      : `[${timestamp}] ${newNote.trim()}`;
    updateOrder({ notes: combined });
    setNewNote("");
  };

  const fetchDrivers = async () => {
    setLoadingDrivers(true);
    try {
      const res = await fetch("/api/ecommerce/drivers");
      const json = await res.json();
      if (json.success) {
        setDrivers(json.data.drivers.filter((d: Driver) => d.status !== "offline"));
      }
    } catch (err) {
      console.error("Failed to fetch drivers:", err);
    } finally {
      setLoadingDrivers(false);
    }
  };

  const handleAssignDriver = async () => {
    if (!selectedDriverId) return;
    setUpdating(true);
    setError("");
    try {
      const res = await fetch(`/api/ecommerce/delivery/${orderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId: selectedDriverId }),
      });
      const json = await res.json();
      if (json.success) {
        setShowAssignModal(false);
        setSelectedDriverId("");
        fetchOrder(); // Refresh order to show assignment
      } else {
        setError(json.error?.message || "Failed to assign driver");
      }
    } catch (err) {
      console.error("Assign driver error:", err);
      setError("Failed to assign driver");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 text-center">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-foreground">Order not found</h2>
        <p className="text-sm text-muted-foreground mt-1">{error || "The order could not be loaded."}</p>
        <Link href="/ecommerce/orders" className="mt-4 inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to Orders
        </Link>
      </div>
    );
  }

  const statusConfig = ORDER_STATUSES[order.status];
  const allowedTransitions = statusConfig?.allowedTransitions || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/ecommerce/orders" className="p-2 hover:bg-muted rounded-lg">
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{order.orderNumber}</h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig?.color || "bg-muted text-foreground"}`}>
              {statusConfig?.label || order.status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Placed on {new Date(order.createdAt).toLocaleDateString()} at {new Date(order.createdAt).toLocaleTimeString()}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Info */}
          <div className="bg-card rounded-lg border border-border p-5">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">Customer</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">{order.customerName}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="w-4 h-4 text-muted-foreground text-center">@</span>
                <span className="text-muted-foreground">{order.customerEmail}</span>
              </div>
              {order.customerPhone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{order.customerPhone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Items List */}
          <div className="bg-card rounded-lg border border-border p-5">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">Items</h2>
            <div className="divide-y divide-border">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="w-12 h-12 rounded-lg object-cover border border-border" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                      <Package className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {formatCents(item.priceCents * item.quantity, order.currency)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Shipping Address */}
          <div className="bg-card rounded-lg border border-border p-5">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">Shipping Address</h2>
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="text-sm text-muted-foreground">
                {order.shippingAddress.name && <p className="font-medium text-foreground">{order.shippingAddress.name}</p>}
                <p>{formatAddress(order.shippingAddress)}</p>
              </div>
            </div>
            {order.trackingNumber && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground">Tracking Number</p>
                <p className="text-sm font-mono text-foreground">{order.trackingNumber}</p>
              </div>
            )}
            {order.shippingMethod && (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground">Shipping Method</p>
                <p className="text-sm text-foreground">{order.shippingMethod}</p>
              </div>
            )}
          </div>

          {/* Delivery Section */}
          {order.deliveryAssignment ? (
            <div className="bg-card rounded-lg border border-border p-5">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">Delivery</h2>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Truck className="w-4 h-4 text-muted-foreground" />
                  <span className="text-foreground font-medium">{order.deliveryAssignment.driver.name}</span>
                  <span className="text-muted-foreground">|</span>
                  <span className="text-muted-foreground">{order.deliveryAssignment.driver.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="font-medium text-foreground capitalize">
                    {order.deliveryAssignment.status.replace(/_/g, " ")}
                  </span>
                </div>
                {order.deliveryAssignment.driver.currentLatitude != null &&
                  order.deliveryAssignment.driver.currentLongitude != null && (
                    <div className="flex items-center gap-2 text-sm">
                      <Navigation className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {order.deliveryAssignment.driver.currentLatitude.toFixed(6)},{" "}
                        {order.deliveryAssignment.driver.currentLongitude.toFixed(6)}
                      </span>
                      {order.deliveryAssignment.driver.lastLocationUpdate && (
                        <span className="text-xs text-muted-foreground">
                          ({new Date(order.deliveryAssignment.driver.lastLocationUpdate).toLocaleTimeString()})
                        </span>
                      )}
                    </div>
                  )}
                {order.deliveryAssignment.codAmountCents != null && (
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      COD: {formatCents(order.deliveryAssignment.codAmountCents, order.currency)}
                    </span>
                    <span className={`text-xs font-medium ${order.deliveryAssignment.codCollected ? "text-green-600" : "text-yellow-600"}`}>
                      {order.deliveryAssignment.codCollected ? "Collected" : "Pending collection"}
                    </span>
                  </div>
                )}
                {order.deliveryAssignment.estimatedDeliveryTime && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      ETA: {new Date(order.deliveryAssignment.estimatedDeliveryTime).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : order.paymentMethod === "cod" ? (
            <div className="bg-card rounded-lg border border-border p-5">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">Delivery</h2>
              <p className="text-sm text-muted-foreground mb-3">No driver assigned yet. This is a COD order.</p>
              <button
                onClick={() => {
                  setShowAssignModal(true);
                  fetchDrivers();
                }}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
              >
                <Truck className="w-4 h-4 inline mr-1.5" />
                Assign Driver
              </button>
            </div>
          ) : null}

          {/* Notes Section */}
          <div className="bg-card rounded-lg border border-border p-5">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">Notes</h2>
            {order.notes ? (
              <pre className="text-sm text-foreground whitespace-pre-wrap font-sans mb-4 bg-muted/50 rounded-lg p-3">
                {order.notes}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground mb-4">No notes yet</p>
            )}
            {order.cancelReason && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs text-red-500 font-medium mb-1">Cancel Reason</p>
                <p className="text-sm text-red-700">{order.cancelReason}</p>
              </div>
            )}
            <div className="flex gap-2">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note..."
                rows={2}
                className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              />
              <button
                onClick={handleAddNote}
                disabled={!newNote.trim() || updating}
                className="px-4 py-2 bg-card text-foreground text-sm font-medium rounded-lg hover:bg-muted border border-border disabled:opacity-50 self-end"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Order Summary */}
          <div className="bg-card rounded-lg border border-border p-5">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">Summary</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="text-foreground">{formatCents(order.subtotalCents, order.currency)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Shipping</span>
                <span className="text-foreground">{formatCents(order.shippingCents, order.currency)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax</span>
                <span className="text-foreground">{formatCents(order.taxCents, order.currency)}</span>
              </div>
              <div className="pt-2 border-t border-border flex justify-between text-sm font-semibold">
                <span className="text-foreground">Total</span>
                <span className="text-foreground">{formatCents(order.totalCents, order.currency)}</span>
              </div>
            </div>
          </div>

          {/* Payment Info */}
          <div className="bg-card rounded-lg border border-border p-5">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">Payment</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Method</span>
                <span className="text-foreground capitalize">
                  {order.paymentMethod?.replace(/_/g, " ") || "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className={`font-medium capitalize ${
                  order.paymentStatus === "paid"
                    ? "text-green-600"
                    : order.paymentStatus === "failed"
                    ? "text-red-600"
                    : "text-yellow-600"
                }`}>
                  {order.paymentStatus}
                </span>
              </div>
              {order.paymentId && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ID</span>
                  <span className="text-muted-foreground font-mono text-xs truncate max-w-[160px]">{order.paymentId}</span>
                </div>
              )}
            </div>
            {order.paymentStatus === "pending" && (
              <button
                onClick={() => updateOrder({ paymentStatus: "paid" })}
                disabled={updating}
                className="mt-3 w-full px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                <DollarSign className="w-4 h-4 inline mr-1.5" />
                {updating ? "Updating..." : "Mark as Paid"}
              </button>
            )}
          </div>

          {/* Status Timeline */}
          <div className="bg-card rounded-lg border border-border p-5">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">Status Timeline</h2>
            <StatusTimeline currentStatus={order.status} />
          </div>

          {/* Actions */}
          {allowedTransitions.length > 0 && (
            <div className="bg-card rounded-lg border border-border p-5">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">Actions</h2>
              <div className="space-y-2">
                {allowedTransitions.map((nextStatus) => {
                  const nextConfig = ORDER_STATUSES[nextStatus];
                  const isCancel = nextStatus === "CANCELLED";
                  return (
                    <button
                      key={nextStatus}
                      onClick={() => handleStatusChange(nextStatus)}
                      disabled={updating}
                      className={`w-full px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50 ${
                        isCancel
                          ? "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                          : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                      }`}
                    >
                      {isCancel ? (
                        <>
                          <XCircle className="w-4 h-4 inline mr-1.5" />
                          Cancel Order
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 inline mr-1.5" />
                          Mark as {nextConfig?.label || nextStatus}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-foreground mb-2">Cancel Order</h3>
            <p className="text-sm text-muted-foreground mb-4">Please provide a reason for cancellation.</p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Reason for cancellation..."
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelReason("");
                }}
                className="px-4 py-2 text-sm text-foreground hover:bg-muted rounded-lg"
              >
                Keep Order
              </button>
              <button
                onClick={handleCancel}
                disabled={!cancelReason.trim() || updating}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {updating ? "Cancelling..." : "Cancel Order"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Driver Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-foreground mb-2">Assign Delivery Driver</h3>
            <p className="text-sm text-muted-foreground mb-4">Select a driver to handle this delivery.</p>
            {loadingDrivers ? (
              <div className="py-8 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" />
                <p className="mt-2 text-sm text-muted-foreground">Loading drivers...</p>
              </div>
            ) : drivers.length === 0 ? (
              <div className="py-8 text-center">
                <Truck className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No available drivers. Add drivers in the Drivers page.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
                {drivers.map((driver) => (
                  <label
                    key={driver.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedDriverId === driver.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-border hover:border-muted-foreground/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="driver"
                      value={driver.id}
                      checked={selectedDriverId === driver.id}
                      onChange={() => setSelectedDriverId(driver.id)}
                      className="text-blue-600"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{driver.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {driver.phone} {driver.vehicleType && `| ${driver.vehicleType}`}
                      </p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      driver.status === "available"
                        ? "bg-green-100 text-green-700"
                        : driver.status === "busy"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {driver.status}
                    </span>
                  </label>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedDriverId("");
                }}
                className="px-4 py-2 text-sm text-foreground hover:bg-muted rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignDriver}
                disabled={!selectedDriverId || updating}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {updating ? "Assigning..." : "Assign Driver"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
