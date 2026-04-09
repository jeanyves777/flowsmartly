"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface Address {
  id: string;
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

const EMPTY_ADDRESS: Omit<Address, "id"> = {
  name: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  zip: "",
  country: "",
};

export default function StoreAddressesPage() {
  const router = useRouter();
  const { slug } = useParams<{ slug: string }>();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<Address, "id">>(EMPTY_ADDRESS);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAddresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchAddresses() {
    try {
      const res = await fetch(`/api/store/${slug}/account/addresses`);
      if (res.status === 401) {
        router.push(`/store/${slug}/account/login`);
        return;
      }
      const data = await res.json();
      setAddresses(data.addresses || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  function startAdd() {
    setForm(EMPTY_ADDRESS);
    setEditingId(null);
    setShowForm(true);
    setError("");
  }

  function startEdit(addr: Address) {
    setForm({
      name: addr.name,
      line1: addr.line1,
      line2: addr.line2 || "",
      city: addr.city,
      state: addr.state,
      zip: addr.zip,
      country: addr.country,
    });
    setEditingId(addr.id);
    setShowForm(true);
    setError("");
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_ADDRESS);
    setError("");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.name || !form.line1 || !form.city || !form.state || !form.zip || !form.country) {
      setError("Please fill in all required fields.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/store/${slug}/account/addresses`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: editingId ? "update" : "add",
          addressId: editingId,
          address: form,
        }),
      });

      if (res.status === 401) {
        router.push(`/store/${slug}/account/login`);
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save address.");
        setSaving(false);
        return;
      }

      const data = await res.json();
      setAddresses(data.addresses || []);
      cancelForm();
    } catch {
      setError("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(addressId: string) {
    if (!confirm("Remove this address?")) return;

    try {
      const res = await fetch(`/api/store/${slug}/account/addresses`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", addressId }),
      });

      if (res.status === 401) {
        router.push(`/store/${slug}/account/login`);
        return;
      }

      const data = await res.json();
      setAddresses(data.addresses || []);
    } catch {
      // ignore
    }
  }

  const inputStyle = {
    borderColor: "color-mix(in srgb, var(--store-text) 15%, transparent)",
    backgroundColor: "var(--store-background)",
    "--tw-ring-color": "var(--store-primary)",
  } as React.CSSProperties;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            href={`/store/${slug}/account`}
            className="opacity-50 hover:opacity-80 transition-opacity"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: "var(--store-font-heading), sans-serif" }}
          >
            My Addresses
          </h1>
        </div>
        {!showForm && (
          <button
            onClick={startAdd}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--store-primary)" }}
          >
            Add Address
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent"
            style={{ color: "var(--store-primary)" }}
          />
        </div>
      ) : (
        <>
          {/* Address form */}
          {showForm && (
            <div
              className="rounded-lg border p-5 mb-6"
              style={{ borderColor: "color-mix(in srgb, var(--store-text) 10%, transparent)" }}
            >
              <h2 className="text-lg font-semibold mb-4">
                {editingId ? "Edit Address" : "New Address"}
              </h2>

              {error && (
                <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                  {error}
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Full Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
                    style={inputStyle}
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">Address Line 1 *</label>
                  <input
                    type="text"
                    value={form.line1}
                    onChange={(e) => setForm({ ...form, line1: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
                    style={inputStyle}
                    placeholder="123 Main St"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">Address Line 2</label>
                  <input
                    type="text"
                    value={form.line2}
                    onChange={(e) => setForm({ ...form, line2: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
                    style={inputStyle}
                    placeholder="Apt, suite, unit, etc."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">City *</label>
                    <input
                      type="text"
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">State/Province *</label>
                    <input
                      type="text"
                      value={form.state}
                      onChange={(e) => setForm({ ...form, state: e.target.value })}
                      className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">ZIP / Postal Code *</label>
                    <input
                      type="text"
                      value={form.zip}
                      onChange={(e) => setForm({ ...form, zip: e.target.value })}
                      className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Country *</label>
                    <input
                      type="text"
                      value={form.country}
                      onChange={(e) => setForm({ ...form, country: e.target.value })}
                      className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ backgroundColor: "var(--store-primary)" }}
                  >
                    {saving ? "Saving..." : editingId ? "Update Address" : "Save Address"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelForm}
                    className="rounded-lg px-5 py-2.5 text-sm font-medium opacity-60 hover:opacity-80 transition-opacity"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Address list */}
          {addresses.length === 0 && !showForm ? (
            <div
              className="rounded-lg border p-12 text-center"
              style={{ borderColor: "color-mix(in srgb, var(--store-text) 10%, transparent)" }}
            >
              <svg className="h-12 w-12 mx-auto opacity-20 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              <p className="text-lg font-medium opacity-60">No saved addresses</p>
              <p className="text-sm opacity-40 mt-1">Add an address for faster checkout</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {addresses.map((addr) => (
                <div
                  key={addr.id}
                  className="rounded-lg border p-5"
                  style={{ borderColor: "color-mix(in srgb, var(--store-text) 10%, transparent)" }}
                >
                  <p className="font-semibold text-sm">{addr.name}</p>
                  <div className="text-sm opacity-60 mt-1 space-y-0.5">
                    <p>{addr.line1}</p>
                    {addr.line2 && <p>{addr.line2}</p>}
                    <p>
                      {[addr.city, addr.state, addr.zip].filter(Boolean).join(", ")}
                    </p>
                    <p>{addr.country}</p>
                  </div>
                  <div className="flex items-center gap-3 mt-3 pt-3" style={{ borderTop: "1px solid color-mix(in srgb, var(--store-text) 8%, transparent)" }}>
                    <button
                      onClick={() => startEdit(addr)}
                      className="text-xs font-medium hover:underline"
                      style={{ color: "var(--store-primary)" }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(addr.id)}
                      className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
