"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Truck,
  User,
  Phone,
  MapPin,
  Clock,
  Plus,
  Copy,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { COD_REGIONS, regionSupportsCOD } from "@/lib/constants/ecommerce";

interface Driver {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  vehicleType: string;
  region: string | null;
  isActive: boolean;
  accessToken: string | null;
  currentLatitude: number | null;
  currentLongitude: number | null;
  lastLocationUpdate: string | null;
  status: string;
  activeAssignmentCount: number;
  createdAt: string;
}

interface Store {
  id: string;
  region: string | null;
}

const VEHICLE_TYPES = [
  { value: "bike", label: "Bike" },
  { value: "car", label: "Car" },
  { value: "truck", label: "Truck" },
];

function DriverStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    available: "bg-green-100 text-green-800",
    busy: "bg-yellow-100 text-yellow-800",
    offline: "bg-gray-100 text-gray-800",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || "bg-gray-100 text-gray-800"}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function DriversPage() {
  const [store, setStore] = useState<Store | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeLoading, setStoreLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Add/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formVehicleType, setFormVehicleType] = useState("bike");
  const [saving, setSaving] = useState(false);

  // Fetch store info
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/ecommerce/store");
        const json = await res.json();
        if (json.success && json.data.store) {
          setStore(json.data.store);
        }
      } catch (err) {
        console.error("Failed to fetch store:", err);
      } finally {
        setStoreLoading(false);
      }
    })();
  }, []);

  const fetchDrivers = useCallback(async () => {
    try {
      const res = await fetch("/api/ecommerce/drivers");
      const json = await res.json();
      if (json.success) {
        setDrivers(json.data.drivers);
      }
    } catch (err) {
      console.error("Failed to fetch drivers:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (store && regionSupportsCOD(store.region)) {
      fetchDrivers();
    } else {
      setLoading(false);
    }
  }, [store, fetchDrivers]);

  const openAddModal = () => {
    setEditingDriver(null);
    setFormName("");
    setFormPhone("");
    setFormEmail("");
    setFormVehicleType("bike");
    setShowModal(true);
    setError("");
  };

  const openEditModal = (driver: Driver) => {
    setEditingDriver(driver);
    setFormName(driver.name);
    setFormPhone(driver.phone);
    setFormEmail(driver.email || "");
    setFormVehicleType(driver.vehicleType);
    setShowModal(true);
    setError("");
  };

  const handleSave = async () => {
    if (!formName.trim() || !formPhone.trim()) {
      setError("Name and phone are required");
      return;
    }

    setSaving(true);
    setError("");

    try {
      if (editingDriver) {
        // Update
        const res = await fetch(`/api/ecommerce/drivers/${editingDriver.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            phone: formPhone.trim(),
            email: formEmail.trim() || null,
            vehicleType: formVehicleType,
          }),
        });
        const json = await res.json();
        if (!json.success) {
          setError(json.error?.message || "Failed to update driver");
          return;
        }
      } else {
        // Create
        const res = await fetch("/api/ecommerce/drivers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            phone: formPhone.trim(),
            email: formEmail.trim() || undefined,
            vehicleType: formVehicleType,
          }),
        });
        const json = await res.json();
        if (!json.success) {
          setError(json.error?.message || "Failed to create driver");
          return;
        }
      }

      setShowModal(false);
      fetchDrivers();
    } catch (err) {
      console.error("Save driver error:", err);
      setError("Failed to save driver");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (driver: Driver) => {
    if (!confirm(`Deactivate driver "${driver.name}"? They won't receive new assignments.`)) return;

    try {
      const res = await fetch(`/api/ecommerce/drivers/${driver.id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        fetchDrivers();
      } else {
        alert(json.error?.message || "Failed to deactivate driver");
      }
    } catch (err) {
      console.error("Deactivate driver error:", err);
    }
  };

  const copyTrackingLink = (driver: Driver) => {
    if (!driver.accessToken) return;
    const link = `${window.location.origin}/api/ecommerce/drivers/${driver.id}/location?token=${driver.accessToken}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(driver.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  if (storeLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="animate-pulse h-64 bg-gray-200 rounded-lg" />
      </div>
    );
  }

  if (!store || !regionSupportsCOD(store.region)) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="text-center py-16">
          <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-gray-900">Delivery Drivers Not Available</h2>
          <p className="mt-1 text-sm text-gray-500 max-w-md mx-auto">
            Delivery driver management is only available for stores in regions that support Cash on Delivery (COD).
            Your store&apos;s region ({store?.region || "not set"}) does not support this feature.
          </p>
          <p className="mt-3 text-xs text-gray-400">
            Supported regions: {COD_REGIONS.map((r) => r.replace(/_/g, " ")).join(", ")}
          </p>
        </div>
      </div>
    );
  }

  // Compute stats
  const totalDrivers = drivers.filter((d) => d.isActive).length;
  const availableDrivers = drivers.filter((d) => d.isActive && d.status === "available").length;
  const busyDrivers = drivers.filter((d) => d.isActive && d.status === "busy").length;
  const offlineDrivers = drivers.filter((d) => d.isActive && d.status === "offline").length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Delivery Drivers</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your delivery fleet</p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Driver
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-xs text-gray-500">Total Drivers</p>
              <p className="text-xl font-bold text-gray-900">{totalDrivers}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-xs text-gray-500">Available</p>
              <p className="text-xl font-bold text-gray-900">{availableDrivers}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-yellow-600" />
            <div>
              <p className="text-xs text-gray-500">Busy</p>
              <p className="text-xl font-bold text-gray-900">{busyDrivers}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-gray-500" />
            <div>
              <p className="text-xs text-gray-500">Offline</p>
              <p className="text-xl font-bold text-gray-900">{offlineDrivers}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Drivers Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
            <p className="mt-3 text-sm text-gray-500">Loading drivers...</p>
          </div>
        ) : drivers.length === 0 ? (
          <div className="p-12 text-center">
            <Truck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900">No drivers yet</h3>
            <p className="mt-1 text-sm text-gray-500">Add your first delivery driver to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Location</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assignments</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {drivers.map((driver) => (
                  <tr key={driver.id} className={`hover:bg-gray-50 ${!driver.isActive ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{driver.name}</div>
                      {driver.email && (
                        <div className="text-xs text-gray-500">{driver.email}</div>
                      )}
                      {!driver.isActive && (
                        <span className="text-xs text-red-500 font-medium">Deactivated</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {driver.phone}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 capitalize">
                      {driver.vehicleType}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <DriverStatusBadge status={driver.status} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {driver.lastLocationUpdate ? (
                        <div>
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            <span>
                              {driver.currentLatitude?.toFixed(4)}, {driver.currentLongitude?.toFixed(4)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Clock className="w-3 h-3" />
                            {new Date(driver.lastLocationUpdate).toLocaleTimeString()}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">No data</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {driver.activeAssignmentCount}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(driver)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Edit
                        </button>
                        {driver.isActive && (
                          <button
                            onClick={() => handleDeactivate(driver)}
                            className="text-xs text-red-600 hover:text-red-800 font-medium"
                          >
                            Deactivate
                          </button>
                        )}
                        {driver.accessToken && (
                          <button
                            onClick={() => copyTrackingLink(driver)}
                            className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800"
                            title="Copy tracking link for driver"
                          >
                            {copiedId === driver.id ? (
                              <>
                                <CheckCircle className="w-3 h-3 text-green-500" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                Tracking Link
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingDriver ? "Edit Driver" : "Add Driver"}
            </h3>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Driver name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="+1 234 567 890"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="driver@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Type</label>
                <select
                  value={formVehicleType}
                  onChange={(e) => setFormVehicleType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {VEHICLE_TYPES.map((v) => (
                    <option key={v.value} value={v.value}>{v.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : editingDriver ? "Update Driver" : "Add Driver"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
