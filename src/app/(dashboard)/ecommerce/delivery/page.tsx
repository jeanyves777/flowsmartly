"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Truck,
  MapPin,
  Clock,
  DollarSign,
  User,
  Phone,
  CheckCircle,
  Navigation,
  Package,
  AlertTriangle,
} from "lucide-react";
import { DELIVERY_STATUSES, isValidDeliveryTransition } from "@/lib/constants/ecommerce";

interface DeliveryAssignment {
  id: string;
  orderId: string;
  status: string;
  pickupAddress: Record<string, string>;
  deliveryAddress: Record<string, string>;
  estimatedDeliveryTime: string | null;
  actualDeliveryTime: string | null;
  codAmountCents: number | null;
  codCollected: boolean;
  notes: string | null;
  order: {
    orderNumber: string;
    customerName: string;
    customerEmail: string;
    status: string;
  };
  driver: {
    id: string;
    name: string;
    phone: string;
    currentLatitude: number | null;
    currentLongitude: number | null;
    lastLocationUpdate: string | null;
  };
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function formatAddress(addr: Record<string, string>): string {
  const parts = [addr.line1, addr.line2, addr.city, addr.state, addr.zip, addr.country].filter(Boolean);
  return parts.join(", ") || "No address";
}

function DeliveryStatusBadge({ status }: { status: string }) {
  const config = DELIVERY_STATUSES[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config?.color || "bg-gray-100 text-gray-800"}`}>
      {config?.label || status}
    </span>
  );
}

export default function DeliveryPage() {
  const [assignments, setAssignments] = useState<DeliveryAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState("");

  const fetchDeliveries = useCallback(async () => {
    try {
      // We fetch all orders and filter for those with delivery assignments
      const res = await fetch("/api/ecommerce/orders?limit=100");
      const json = await res.json();

      if (json.success) {
        // Extract orders that have delivery assignments with active statuses
        const activeDeliveries: DeliveryAssignment[] = [];

        for (const order of json.data.orders) {
          if (
            order.deliveryAssignment &&
            order.deliveryAssignment.status !== "delivered" &&
            order.deliveryAssignment.status !== "failed"
          ) {
            activeDeliveries.push({
              ...order.deliveryAssignment,
              orderId: order.id,
              order: {
                orderNumber: order.orderNumber,
                customerName: order.customerName,
                customerEmail: order.customerEmail,
                status: order.status,
              },
            });
          }
        }

        setAssignments(activeDeliveries);
      }
    } catch (err) {
      console.error("Failed to fetch deliveries:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeliveries();
  }, [fetchDeliveries]);

  const handleStatusUpdate = async (assignment: DeliveryAssignment, newStatus: string) => {
    setUpdating(assignment.id);
    setError("");

    try {
      const body: Record<string, unknown> = { status: newStatus };

      // If delivered and COD, mark cod as collected
      if (newStatus === "delivered" && assignment.codAmountCents) {
        body.codCollected = true;
      }

      const res = await fetch(`/api/ecommerce/delivery/${assignment.orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (json.success) {
        fetchDeliveries();
      } else {
        setError(json.error?.message || "Failed to update status");
      }
    } catch (err) {
      console.error("Update status error:", err);
      setError("Failed to update delivery status");
    } finally {
      setUpdating(null);
    }
  };

  // Compute stats
  const activeCount = assignments.length;
  const codPending = assignments.filter((a) => a.codAmountCents && !a.codCollected).length;

  // Count delivered today from separate fetch - for now show from all orders
  const [deliveredToday, setDeliveredToday] = useState(0);
  useEffect(() => {
    (async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        const res = await fetch(`/api/ecommerce/orders?status=DELIVERED&dateFrom=${today}&limit=1`);
        const json = await res.json();
        if (json.success) {
          setDeliveredToday(json.data.total);
        }
      } catch {
        // Ignore
      }
    })();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Delivery Tracking</h1>
        <p className="mt-1 text-sm text-gray-500">Monitor active deliveries and driver locations</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Truck className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active Deliveries</p>
              <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-50 rounded-lg">
              <DollarSign className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">COD Pending Collection</p>
              <p className="text-2xl font-bold text-gray-900">{codPending}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Delivered Today</p>
              <p className="text-2xl font-bold text-gray-900">{deliveredToday}</p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Map Placeholder */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-5 h-5 text-gray-600" />
          <h2 className="text-sm font-semibold text-gray-900">Map View</h2>
        </div>
        <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
          <MapPin className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500 font-medium">Map view coming soon</p>
          <p className="text-xs text-gray-400 mt-1">Live map tracking will be available in a future update</p>

          {/* Show coordinates for active deliveries */}
          {assignments.length > 0 && (
            <div className="mt-4 space-y-2">
              {assignments.map((a) => (
                <div key={a.id} className="inline-flex items-center gap-2 bg-white rounded-lg px-3 py-1.5 text-xs text-gray-600 border border-gray-200 mr-2">
                  <Navigation className="w-3 h-3 text-blue-500" />
                  <span className="font-medium">{a.driver.name}:</span>
                  {a.driver.currentLatitude != null && a.driver.currentLongitude != null ? (
                    <span>
                      {a.driver.currentLatitude.toFixed(4)}, {a.driver.currentLongitude.toFixed(4)}
                    </span>
                  ) : (
                    <span className="text-gray-400">No location</span>
                  )}
                  <span className="text-gray-400">-&gt;</span>
                  <span className="truncate max-w-[150px]">{formatAddress(a.deliveryAddress)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Active Deliveries */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Active Deliveries</h2>

        {loading ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
            <p className="mt-3 text-sm text-gray-500">Loading deliveries...</p>
          </div>
        ) : assignments.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900">No active deliveries</h3>
            <p className="mt-1 text-sm text-gray-500">
              Active deliveries will appear here when drivers are assigned to orders.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {assignments.map((assignment) => {
              const nextStatuses = DELIVERY_STATUSES[assignment.status]?.allowedTransitions || [];

              return (
                <div key={assignment.id} className="bg-white rounded-lg border border-gray-200 p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{assignment.order.orderNumber}</p>
                      <p className="text-xs text-gray-500">{assignment.order.customerName}</p>
                    </div>
                    <DeliveryStatusBadge status={assignment.status} />
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-gray-700">{assignment.driver.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-gray-600">{assignment.driver.phone}</span>
                    </div>
                    {assignment.estimatedDeliveryTime && (
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-gray-600">
                          ETA: {new Date(assignment.estimatedDeliveryTime).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {assignment.driver.currentLatitude != null && assignment.driver.currentLongitude != null && (
                      <div className="flex items-center gap-2 text-sm">
                        <Navigation className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-gray-600">
                          {assignment.driver.currentLatitude.toFixed(6)},{" "}
                          {assignment.driver.currentLongitude.toFixed(6)}
                        </span>
                      </div>
                    )}
                    {assignment.codAmountCents != null && (
                      <div className="flex items-center gap-2 text-sm">
                        <DollarSign className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-gray-600">
                          COD: {formatCents(assignment.codAmountCents)}
                        </span>
                        {assignment.codCollected ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <span className="text-xs text-yellow-600 font-medium">Pending</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Status Action Buttons */}
                  {nextStatuses.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                      {nextStatuses.map((nextStatus) => {
                        const nextConfig = DELIVERY_STATUSES[nextStatus];
                        const isFailed = nextStatus === "failed";
                        return (
                          <button
                            key={nextStatus}
                            onClick={() => handleStatusUpdate(assignment, nextStatus)}
                            disabled={updating === assignment.id}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg disabled:opacity-50 ${
                              isFailed
                                ? "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                                : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                            }`}
                          >
                            {updating === assignment.id ? "..." : nextConfig?.label || nextStatus}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
