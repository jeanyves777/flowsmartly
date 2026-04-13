"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Search, UserPlus, Mail, MessageSquare, Download, Users, ChevronLeft, ChevronRight, Check, Loader2 } from "lucide-react";

interface StoreCustomer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  orderCount: number;
  totalSpentCents: number;
  lastOrderAt: string | null;
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<StoreCustomer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [bulkAdding, setBulkAdding] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  const fetchCustomers = useCallback(async (p: number, q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: "20" });
      if (q) params.set("search", q);
      const res = await fetch(`/api/ecommerce/customers?${params}`);
      const data = await res.json();
      if (data.success) {
        setCustomers(data.data.customers);
        setTotal(data.data.total);
        setTotalPages(data.data.totalPages);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchCustomers(page, search), search ? 400 : 0);
    return () => clearTimeout(t);
  }, [page, search, fetchCustomers]);

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  }

  async function addToContacts(customerId: string) {
    setAddingId(customerId);
    try {
      const res = await fetch(`/api/ecommerce/customers/${customerId}/add-to-contacts`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setAddedIds(prev => new Set(prev).add(customerId));
        showToast(data.data.isNew ? "Added to contacts!" : "Contact updated!");
      } else {
        showToast("Failed to add contact.");
      }
    } finally {
      setAddingId(null);
    }
  }

  async function bulkAddToContacts() {
    if (selected.size === 0) return;
    setBulkAdding(true);
    let added = 0;
    for (const id of selected) {
      try {
        await fetch(`/api/ecommerce/customers/${id}/add-to-contacts`, { method: "POST" });
        setAddedIds(prev => new Set(prev).add(id));
        added++;
      } catch { /* continue */ }
    }
    setBulkAdding(false);
    setSelected(new Set());
    showToast(`${added} customer${added !== 1 ? "s" : ""} added to contacts.`);
  }

  function exportCSV() {
    const rows = [["Name", "Email", "Phone", "Orders", "Total Spent", "Joined"]];
    customers.forEach(c => rows.push([
      c.name, c.email, c.phone || "",
      String(c.orderCount), formatMoney(c.totalSpentCents),
      new Date(c.createdAt).toLocaleDateString(),
    ]));
    const csv = rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "store-customers.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const allSelected = customers.length > 0 && customers.every(c => selected.has(c.id));
  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(customers.map(c => c.id)));
  }
  function toggleOne(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Customers</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{total} store customer{total !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/contacts?tab=lists" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <Mail size={15} /> Email Campaign
          </Link>
          <Link href="/contacts?tab=lists&type=sms" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <MessageSquare size={15} /> SMS Campaign
          </Link>
          <button onClick={exportCSV} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      {/* Search + Bulk actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
        {selected.size > 0 && (
          <button
            onClick={bulkAddToContacts}
            disabled={bulkAdding}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {bulkAdding ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
            Add {selected.size} to Contacts
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Users size={40} className="mb-3 opacity-30" />
            <p className="font-medium">No customers yet</p>
            <p className="text-sm mt-1">Customers appear here after they register or place an order</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                  <th className="px-4 py-3 text-left w-10">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded border-gray-300 dark:border-gray-600 cursor-pointer" />
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Customer</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Phone</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">Orders</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Total Spent</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Joined</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {customers.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleOne(c.id)} className="rounded border-gray-300 dark:border-gray-600 cursor-pointer" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-semibold text-xs flex-shrink-0">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{c.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{c.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{c.phone || "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-6 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-300">
                        {c.orderCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">
                      {formatMoney(c.totalSpentCents)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                      {new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => addToContacts(c.id)}
                        disabled={addingId === c.id || addedIds.has(c.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50"
                        title="Add to FlowSmartly Contacts"
                      >
                        {addingId === c.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : addedIds.has(c.id) ? (
                          <><Check size={12} className="text-green-500" /> Added</>
                        ) : (
                          <><UserPlus size={12} /> Add to Contacts</>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-5 py-3 rounded-full text-sm font-medium shadow-lg z-50">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
