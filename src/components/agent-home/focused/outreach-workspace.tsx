"use client";

import { useCallback, useEffect, useRef, useState, type ElementType } from "react";
import Image from "next/image";
import {
  Users, UserPlus, Upload, Mail, MessageSquare, Star, FileText, CalendarDays,
  Search, X, Check, ChevronLeft, ChevronRight, Trash2, Pencil, ListFilter,
  Layers, Plus, Tag, ArrowRight, AlertTriangle,
} from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * Outreach — a deep new-design CRM surface (the Outreach workspace canvas):
 * contacts + audience stats with full in-surface management — search, status &
 * list filters, pagination, edit/delete, bulk actions, list/segment management,
 * and a guided CSV import (file → column mapping → list & duplicate strategy).
 * Every action is real UI (POST/PATCH/DELETE /api/contacts(+lists,bulk,import))
 * — a click means do-it-in-the-UI, not a chat prompt. The agent stays in the
 * chat on the left for help, and the generative "More outreach" tasks (proposals,
 * follow-ups) still drive it. No legacy links. [[surface-buttons-are-ui-actions]]
 */

interface ContactList { id: string; name: string }
interface Contact {
  id: string; name?: string; email?: string | null; phone?: string | null;
  firstName?: string | null; lastName?: string | null; status?: string;
  emailOptedIn?: boolean; smsOptedIn?: boolean; company?: string | null;
  imageUrl?: string | null; tags?: string[]; lists?: ContactList[];
}
interface ContactDetail extends Contact {
  birthday?: string | null; city?: string | null; state?: string | null; address?: string | null;
}
interface Stats { total?: number; active?: number; unsubscribed?: number; emailOptedIn?: number; smsOptedIn?: number }
interface Pagination { page: number; limit: number; total: number; pages: number }
interface ListSummary {
  id: string; name: string; totalCount: number; activeCount: number;
  smsEligibleCount?: number; contactCount?: number; campaignCount?: number;
}

type StatusFilter = "all" | "active" | "unsubscribed";

const FIELD = "w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60";
const EMPTY_FORM = { firstName: "", lastName: "", email: "", phone: "", company: "", city: "", state: "", tags: "" };
const PAGE_SIZE = 25;

const IMPORT_FIELDS = [
  { value: "", label: "— Ignore —" },
  { value: "firstName", label: "First name" },
  { value: "lastName", label: "Last name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "company", label: "Company" },
  { value: "birthday", label: "Birthday (MM-DD)" },
  { value: "city", label: "City" },
  { value: "state", label: "State" },
  { value: "address", label: "Address" },
  { value: "tags", label: "Tags (; separated)" },
] as const;

// Best-effort auto-detect of a column's field from its header text.
function guessField(header: string): string {
  const h = header.trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (/^(firstname|first|fname|givenname)$/.test(h)) return "firstName";
  if (/^(lastname|last|lname|surname|familyname)$/.test(h)) return "lastName";
  if (h === "name" || h === "fullname") return "firstName";
  if (/email|mail/.test(h)) return "email";
  if (/phone|mobile|cell|tel/.test(h)) return "phone";
  if (/company|org|business/.test(h)) return "company";
  if (/birthday|bday|dob/.test(h)) return "birthday";
  if (h === "city" || h === "town") return "city";
  if (h === "state" || h === "province" || h === "region") return "state";
  if (/address|street/.test(h)) return "address";
  if (/tag|label|segment/.test(h)) return "tags";
  return "";
}

export function FocusedOutreach({ refreshKey, onOpenView }: { refreshKey?: number; onOpenView: (key: string) => void }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: PAGE_SIZE, total: 0, pages: 1 });
  const [lists, setLists] = useState<ListSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [notice, setNotice] = useState("");

  // Add form
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Search / filter / page
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [listId, setListId] = useState<string>("");
  const [page, setPage] = useState(1);

  // Row-level edit / delete / bulk
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ContactDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editStatus, setEditStatus] = useState<"active" | "unsubscribed">("active");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkConfirmDelete, setBulkConfirmDelete] = useState(false);
  const [bulkListId, setBulkListId] = useState("");

  // Lists panel
  const [listsOpen, setListsOpen] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  // Import wizard
  const [importStep, setImportStep] = useState<0 | 1>(0);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importPreview, setImportPreview] = useState<string[][]>([]);
  const [importMappings, setImportMappings] = useState<Record<number, string>>({});
  const [importListId, setImportListId] = useState("");
  const [importDup, setImportDup] = useState<"skip" | "update">("skip");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");

  const flash = useCallback((msg: string, ms = 2200) => {
    setNotice(msg);
    setTimeout(() => setNotice((n) => (n === msg ? "" : n)), ms);
  }, []);

  // Debounce raw input → applied search, resetting to page 1.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch((prev) => {
        const next = searchInput.trim();
        if (prev !== next) setPage(1);
        return next;
      });
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const loadLists = useCallback(async () => {
    try {
      const j = await fetch("/api/contact-lists").then((r) => r.json());
      if (j?.success && Array.isArray(j.data?.lists)) setLists(j.data.lists as ListSummary[]);
    } catch { /* ignore */ }
  }, []);

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (search) qs.set("search", search);
      if (status !== "all") qs.set("status", status);
      if (listId) qs.set("listId", listId);
      const j = await fetch(`/api/contacts?${qs.toString()}`).then((r) => r.json());
      if (j?.success && j.data) {
        setContacts(Array.isArray(j.data.contacts) ? (j.data.contacts as Contact[]) : []);
        if (j.data.stats) setStats(j.data.stats as Stats);
        if (j.data.pagination) setPagination(j.data.pagination as Pagination);
      }
    } catch { /* ignore */ }
  }, [page, search, status, listId]);

  const didInitial = useRef(false);
  useEffect(() => {
    let alive = true;
    const initial = !didInitial.current;
    if (initial) setLoading(true); else setFetching(true);
    Promise.all([load(), initial ? loadLists() : Promise.resolve()]).finally(() => {
      if (!alive) return;
      didInitial.current = true;
      setLoading(false);
      setFetching(false);
    });
    return () => { alive = false; };
  }, [load, loadLists, refreshKey]);

  // Drop selection of rows that fall out of the current view.
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const visible = new Set(contacts.map((c) => c.id));
      const next = new Set<string>();
      prev.forEach((id) => { if (visible.has(id)) next.add(id); });
      return next.size === prev.size ? prev : next;
    });
  }, [contacts]);

  const refresh = useCallback(async () => {
    setFetching(true);
    await Promise.all([load(), loadLists()]);
    setFetching(false);
  }, [load, loadLists]);

  const set = (k: keyof typeof EMPTY_FORM, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    const email = form.email.trim();
    const phone = form.phone.trim();
    if (!email && !phone) { setError("Add at least an email or a phone."); return; }
    setSaving(true); setError("");
    try {
      const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
      const r = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName.trim() || undefined,
          lastName: form.lastName.trim() || undefined,
          email: email || undefined,
          phone: phone || undefined,
          company: form.company.trim() || undefined,
          city: form.city.trim() || undefined,
          state: form.state.trim() || undefined,
          tags,
        }),
      });
      const j = await r.json();
      if (r.ok && j?.success) {
        setAdding(false); setForm(EMPTY_FORM); flash("Contact added.");
        await refresh();
      } else {
        setError(j?.error?.message || "Could not add the contact.");
      }
    } catch {
      setError("Could not add the contact.");
    } finally {
      setSaving(false);
    }
  };

  // ── Row edit ────────────────────────────────────────────────────────────────
  const openRow = async (c: Contact) => {
    if (expandedId === c.id) { setExpandedId(null); return; }
    setExpandedId(c.id);
    setConfirmDeleteId(null);
    setDetail(null); setEditError("");
    setDetailLoading(true);
    try {
      const j = await fetch(`/api/contacts/${c.id}`).then((r) => r.json());
      if (j?.success && j.data?.contact) {
        const d = j.data.contact as ContactDetail;
        setDetail(d);
        setEditForm({
          firstName: d.firstName || "",
          lastName: d.lastName || "",
          email: d.email || "",
          phone: d.phone || "",
          company: d.company || "",
          city: d.city || "",
          state: d.state || "",
          tags: (d.tags || []).join(", "),
        });
        setEditStatus(d.status === "unsubscribed" ? "unsubscribed" : "active");
      } else {
        setEditError("Could not load this contact.");
      }
    } catch {
      setEditError("Could not load this contact.");
    } finally {
      setDetailLoading(false);
    }
  };

  const setEdit = (k: keyof typeof EMPTY_FORM, v: string) => setEditForm((f) => ({ ...f, [k]: v }));

  const saveEdit = async (id: string) => {
    const email = editForm.email.trim();
    const phone = editForm.phone.trim();
    if (!email && !phone) { setEditError("Keep at least an email or a phone."); return; }
    setEditSaving(true); setEditError("");
    try {
      const tags = editForm.tags.split(",").map((t) => t.trim()).filter(Boolean);
      const r = await fetch(`/api/contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: editForm.firstName.trim(),
          lastName: editForm.lastName.trim(),
          email: email || null,
          phone: phone || null,
          company: editForm.company.trim(),
          city: editForm.city.trim(),
          state: editForm.state.trim(),
          tags,
          status: editStatus,
        }),
      });
      const j = await r.json();
      if (r.ok && j?.success) {
        setExpandedId(null); flash("Contact updated.");
        await refresh();
      } else {
        setEditError(j?.error?.message || "Could not update the contact.");
      }
    } catch {
      setEditError("Could not update the contact.");
    } finally {
      setEditSaving(false);
    }
  };

  const deleteContact = async (id: string) => {
    setRowBusy(id);
    try {
      const r = await fetch(`/api/contacts/${id}`, { method: "DELETE" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.success) {
        setConfirmDeleteId(null);
        if (expandedId === id) setExpandedId(null);
        flash("Contact deleted.");
        await refresh();
      } else {
        flash(j?.error?.message || "Could not delete the contact.", 3500);
      }
    } catch {
      flash("Could not delete the contact.", 3500);
    } finally {
      setRowBusy(null);
    }
  };

  // ── Bulk ─────────────────────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const allSelected = contacts.length > 0 && selected.size === contacts.length;
  const toggleSelectAll = () => {
    setSelected((prev) => (prev.size === contacts.length ? new Set() : new Set(contacts.map((c) => c.id))));
  };

  const runBulk = async (body: Record<string, unknown>, successMsg: string) => {
    setBulkBusy(true);
    try {
      const r = await fetch("/api/contacts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, contactIds: Array.from(selected) }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.success) {
        const n = j.data?.affected ?? selected.size;
        setSelected(new Set());
        setBulkConfirmDelete(false);
        setBulkListId("");
        flash(`${successMsg} (${n}).`);
        await refresh();
      } else {
        flash(j?.error?.message || "Bulk action failed.", 3500);
      }
    } catch {
      flash("Bulk action failed.", 3500);
    } finally {
      setBulkBusy(false);
    }
  };

  // ── CSV import ─────────────────────────────────────────────────────────────────
  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setImportError("");
    let text = "";
    try {
      text = await f.text();
    } catch {
      setImportError("Could not read that file.");
      return;
    }
    const clean = text.replace(/^﻿/, "");
    const lines = clean.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0).slice(0, 6);
    if (lines.length < 2) {
      setImportError("That CSV needs a header row and at least one data row.");
      return;
    }
    // Lightweight client preview parser (comma split with basic quote handling).
    const parseLine = (line: string): string[] => {
      const out: string[] = [];
      let cur = ""; let q = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (q) {
          if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
          else if (ch === '"') q = false;
          else cur += ch;
        } else if (ch === '"') q = true;
        else if (ch === ",") { out.push(cur.trim()); cur = ""; }
        else cur += ch;
      }
      out.push(cur.trim());
      return out;
    };
    const parsed = lines.map(parseLine);
    const headers = parsed[0];
    const preview = parsed.slice(1);
    const mappings: Record<number, string> = {};
    headers.forEach((h, i) => { mappings[i] = guessField(h); });
    setImportFile(f);
    setImportHeaders(headers);
    setImportPreview(preview);
    setImportMappings(mappings);
    setImportListId("");
    setImportDup("skip");
    setImportStep(1);
  };

  const resetImport = () => {
    setImportStep(0); setImportFile(null); setImportHeaders([]); setImportPreview([]);
    setImportMappings({}); setImportError(""); setImportListId(""); setImportDup("skip");
  };

  const runImport = async () => {
    if (!importFile) return;
    const mapped = Object.values(importMappings).filter(Boolean);
    if (!mapped.includes("email") && !mapped.includes("phone")) {
      setImportError("Map at least one column to Email or Phone.");
      return;
    }
    setImporting(true); setImportError("");
    try {
      const fd = new FormData();
      fd.append("file", importFile);
      fd.append("duplicateStrategy", importDup);
      if (importListId) fd.append("listId", importListId);
      const mappings: Record<string, string> = {};
      Object.entries(importMappings).forEach(([idx, field]) => { if (field) mappings[idx] = field; });
      fd.append("mappings", JSON.stringify(mappings));
      const j = await fetch("/api/contacts/import", { method: "POST", body: fd }).then((r) => r.json());
      if (j?.success && j.data) {
        const d = j.data as { imported?: number; updated?: number; skipped?: number };
        const parts = [
          `imported ${d.imported ?? 0}`,
          d.updated ? `updated ${d.updated}` : "",
          d.skipped ? `skipped ${d.skipped}` : "",
        ].filter(Boolean);
        flash(`Import done — ${parts.join(", ")}.`, 4500);
        resetImport();
        setPage(1);
        await refresh();
      } else {
        setImportError(j?.error?.message || "Import failed — check the column mapping.");
      }
    } catch {
      setImportError("Import failed.");
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading your audience…" /></div>;
  }

  const totalContacts = pagination.total || stats.total || contacts.length;
  const activeListName = listId ? lists.find((l) => l.id === listId)?.name : null;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onPickFile} className="hidden" />
      <div className="mx-auto max-w-4xl space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi icon={Users} label="Contacts" value={(stats.total ?? totalContacts).toLocaleString()} />
          <Kpi icon={Check} label="Active" value={(stats.active ?? 0).toLocaleString()} />
          <Kpi icon={Mail} label="Email opt-in" value={(stats.emailOptedIn ?? 0).toLocaleString()} />
          <Kpi icon={MessageSquare} label="SMS opt-in" value={(stats.smsOptedIn ?? 0).toLocaleString()} />
        </div>

        {/* Lists / segments management */}
        <ListsPanel
          open={listsOpen}
          onToggle={() => setListsOpen((v) => !v)}
          lists={lists}
          activeListId={listId}
          onFilterByList={(id) => { setListId(id); setPage(1); }}
          onChanged={refresh}
          flash={flash}
        />

        {/* Contacts */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="flex items-center gap-2 text-[13px] font-bold">
              Contacts
              {fetching && <FlowLoader size={14} />}
            </h3>
            {notice && <span className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-500"><Check className="h-3.5 w-3.5" /> {notice}</span>}
            <div className="ms-auto flex items-center gap-1.5">
              <button onClick={() => fileRef.current?.click()} disabled={importing} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground disabled:opacity-60">
                <Upload className="h-3.5 w-3.5" /> Import
              </button>
              <button onClick={() => { setAdding((v) => !v); setError(""); }} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm"><UserPlus className="h-3.5 w-3.5" /> Add contact</button>
            </div>
          </div>

          {/* Import wizard (inline, multi-step) */}
          {importStep === 1 && (
            <ImportWizard
              fileName={importFile?.name || "contacts.csv"}
              headers={importHeaders}
              preview={importPreview}
              mappings={importMappings}
              onMap={(idx, field) => setImportMappings((m) => ({ ...m, [idx]: field }))}
              lists={lists}
              listId={importListId}
              onListId={setImportListId}
              dup={importDup}
              onDup={setImportDup}
              importing={importing}
              error={importError}
              onCancel={resetImport}
              onRun={runImport}
            />
          )}

          {/* Search + filters */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search name, email, phone…"
                aria-label="Search contacts"
                className="w-full rounded-[10px] border border-border bg-muted/30 py-1.5 pl-8 pr-7 text-[12px] outline-none transition placeholder:text-muted-foreground focus:border-brand-500/60"
              />
              {searchInput && (
                <button type="button" onClick={() => setSearchInput("")} aria-label="Clear search" className="absolute right-1.5 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="relative">
              <ListFilter className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <select
                value={status}
                onChange={(e) => { setStatus(e.target.value as StatusFilter); setPage(1); }}
                aria-label="Filter by status"
                className="appearance-none rounded-[10px] border border-border bg-muted/30 py-1.5 pl-7 pr-7 text-[12px] font-medium outline-none transition focus:border-brand-500/60"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="unsubscribed">Unsubscribed</option>
              </select>
            </div>
            <div className="relative">
              <Layers className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <select
                value={listId}
                onChange={(e) => { setListId(e.target.value); setPage(1); }}
                aria-label="Filter by list"
                className="appearance-none rounded-[10px] border border-border bg-muted/30 py-1.5 pl-7 pr-7 text-[12px] font-medium outline-none transition focus:border-brand-500/60"
              >
                <option value="">All lists</option>
                {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            {(search || status !== "all" || listId) && (
              <button
                type="button"
                onClick={() => { setSearchInput(""); setSearch(""); setStatus("all"); setListId(""); setPage(1); }}
                className="inline-flex items-center gap-1 rounded-[10px] border border-border px-2.5 py-1.5 text-[11.5px] font-semibold text-muted-foreground transition hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            )}
          </div>

          {/* inline add form */}
          {adding && (
            <div className="mb-3 rounded-xl border border-brand-500/30 bg-brand-500/5 p-3.5">
              <div className="grid gap-2.5 sm:grid-cols-2">
                <input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} placeholder="First name" className={FIELD} />
                <input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} placeholder="Last name" className={FIELD} />
                <input value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="Email" type="email" className={FIELD} />
                <input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="Phone (+15551234567)" className={FIELD} />
                <input value={form.company} onChange={(e) => set("company", e.target.value)} placeholder="Company" className={FIELD} />
                <div className="grid grid-cols-2 gap-2.5">
                  <input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="City" className={FIELD} />
                  <input value={form.state} onChange={(e) => set("state", e.target.value)} placeholder="State" className={FIELD} />
                </div>
              </div>
              <input value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="Tags (comma-separated, e.g. VIP, lead)" className={cn(FIELD, "mt-2.5")} />
              {error && <p className="mt-2 text-[12px] text-rose-500">{error}</p>}
              <div className="mt-3 flex items-center gap-2">
                <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60">
                  {saving ? <FlowLoader size={15} tone="white" /> : <Check className="h-3.5 w-3.5" />} Save contact
                </button>
                <button onClick={() => { setAdding(false); setForm(EMPTY_FORM); setError(""); }} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3.5 py-2 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /> Cancel</button>
              </div>
            </div>
          )}

          {/* Bulk action bar */}
          {selected.size > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-brand-500/30 bg-brand-500/5 px-3 py-2.5">
              <span className="text-[12px] font-semibold text-brand-500">{selected.size} selected</span>
              <div className="ms-auto flex flex-wrap items-center gap-1.5">
                {/* add to list */}
                <select
                  value={bulkListId}
                  onChange={(e) => setBulkListId(e.target.value)}
                  disabled={bulkBusy || lists.length === 0}
                  aria-label="Add selected to list"
                  className="appearance-none rounded-[10px] border border-border bg-background py-1.5 pl-2.5 pr-7 text-[11.5px] font-medium outline-none focus:border-brand-500/60 disabled:opacity-60"
                >
                  <option value="">Add to list…</option>
                  {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                <button
                  onClick={() => bulkListId && runBulk({ action: "addToList", listId: bulkListId }, "Added to list")}
                  disabled={bulkBusy || !bulkListId}
                  className="inline-flex items-center gap-1 rounded-[10px] border border-border bg-background px-2.5 py-1.5 text-[11.5px] font-semibold hover:border-brand-500/60 hover:text-foreground disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
                <button onClick={() => runBulk({ action: "updateStatus", status: "active" }, "Marked active")} disabled={bulkBusy} className="inline-flex items-center gap-1 rounded-[10px] border border-border bg-background px-2.5 py-1.5 text-[11.5px] font-semibold hover:border-brand-500/60 hover:text-foreground disabled:opacity-50">Set active</button>
                <button onClick={() => runBulk({ action: "updateStatus", status: "unsubscribed" }, "Unsubscribed")} disabled={bulkBusy} className="inline-flex items-center gap-1 rounded-[10px] border border-border bg-background px-2.5 py-1.5 text-[11.5px] font-semibold hover:border-brand-500/60 hover:text-foreground disabled:opacity-50">Unsubscribe</button>
                {bulkConfirmDelete ? (
                  <span className="inline-flex items-center gap-1">
                    <button onClick={() => runBulk({ action: "delete" }, "Deleted")} disabled={bulkBusy} className="inline-flex items-center gap-1 rounded-[10px] bg-rose-500 px-2.5 py-1.5 text-[11.5px] font-semibold text-white disabled:opacity-60">
                      {bulkBusy ? <FlowLoader size={13} tone="white" /> : <Trash2 className="h-3.5 w-3.5" />} Confirm delete
                    </button>
                    <button onClick={() => setBulkConfirmDelete(false)} disabled={bulkBusy} className="inline-flex items-center rounded-[10px] border border-border bg-background px-2 py-1.5 text-[11.5px] font-semibold text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                  </span>
                ) : (
                  <button onClick={() => setBulkConfirmDelete(true)} disabled={bulkBusy} className="inline-flex items-center gap-1 rounded-[10px] border border-rose-500/40 bg-background px-2.5 py-1.5 text-[11.5px] font-semibold text-rose-500 hover:bg-rose-500/10 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                )}
                <button onClick={() => { setSelected(new Set()); setBulkConfirmDelete(false); }} disabled={bulkBusy} className="inline-flex items-center rounded-[10px] px-1.5 py-1.5 text-[11.5px] font-semibold text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          )}

          {contacts.length ? (
            <>
              {/* select-all header */}
              <div className="mb-2 flex items-center gap-2 px-1">
                <Checkbox checked={allSelected} indeterminate={selected.size > 0 && !allSelected} onChange={toggleSelectAll} ariaLabel="Select all on page" />
                <span className="text-[11.5px] text-muted-foreground">
                  {allSelected ? "All on this page selected" : "Select all"}
                  {activeListName && <span> · in <span className="font-semibold text-foreground">{activeListName}</span></span>}
                </span>
              </div>

              <div className="space-y-2">
                {contacts.map((c) => {
                  const isOpen = expandedId === c.id;
                  const isSel = selected.has(c.id);
                  return (
                    <div key={c.id} className={cn("rounded-xl border bg-muted/30 transition", isOpen ? "border-brand-500/40" : "border-border")}>
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <Checkbox checked={isSel} onChange={() => toggleSelect(c.id)} ariaLabel={`Select ${c.name || c.email || "contact"}`} />
                        <button onClick={() => openRow(c)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                          {c.imageUrl ? (
                            <Image src={c.imageUrl} alt="" width={32} height={32} className="h-8 w-8 shrink-0 rounded-full object-cover" unoptimized />
                          ) : (
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500/30 to-violet-500/30 text-[11px] font-bold text-brand-500">{(c.name || c.email || "?").slice(0, 1).toUpperCase()}</span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium">{c.name || c.email || c.phone || "Contact"}</span>
                            <span className="block truncate text-[11.5px] text-muted-foreground">{[c.email, c.company].filter(Boolean).join(" · ") || c.phone || "—"}</span>
                          </span>
                        </button>
                        {c.lists && c.lists.length > 0 && (
                          <span className="hidden shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground sm:inline-flex" title={c.lists.map((l) => l.name).join(", ")}>
                            <Layers className="h-3 w-3" /> {c.lists.length}
                          </span>
                        )}
                        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold capitalize", (c.status || "active") === "active" ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground")}>{c.status || "active"}</span>
                        <button onClick={() => openRow(c)} aria-label="Edit contact" className="shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* expanded edit */}
                      {isOpen && (
                        <div className="border-t border-border px-3 py-3">
                          {detailLoading ? (
                            <div className="grid place-items-center py-6"><FlowLoader size={20} label="Loading…" /></div>
                          ) : (
                            <>
                              <div className="grid gap-2.5 sm:grid-cols-2">
                                <input value={editForm.firstName} onChange={(e) => setEdit("firstName", e.target.value)} placeholder="First name" className={FIELD} />
                                <input value={editForm.lastName} onChange={(e) => setEdit("lastName", e.target.value)} placeholder="Last name" className={FIELD} />
                                <input value={editForm.email} onChange={(e) => setEdit("email", e.target.value)} placeholder="Email" type="email" className={FIELD} />
                                <input value={editForm.phone} onChange={(e) => setEdit("phone", e.target.value)} placeholder="Phone (+15551234567)" className={FIELD} />
                                <input value={editForm.company} onChange={(e) => setEdit("company", e.target.value)} placeholder="Company" className={FIELD} />
                                <div className="grid grid-cols-2 gap-2.5">
                                  <input value={editForm.city} onChange={(e) => setEdit("city", e.target.value)} placeholder="City" className={FIELD} />
                                  <input value={editForm.state} onChange={(e) => setEdit("state", e.target.value)} placeholder="State" className={FIELD} />
                                </div>
                              </div>
                              <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                                <input value={editForm.tags} onChange={(e) => setEdit("tags", e.target.value)} placeholder="Tags (comma-separated)" className={cn(FIELD, "min-w-0 flex-1")} />
                                <select
                                  value={editStatus}
                                  onChange={(e) => setEditStatus(e.target.value as "active" | "unsubscribed")}
                                  aria-label="Contact status"
                                  className="appearance-none rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] font-medium outline-none focus:border-brand-500/60"
                                >
                                  <option value="active">Active</option>
                                  <option value="unsubscribed">Unsubscribed</option>
                                </select>
                              </div>
                              {detail?.lists && detail.lists.length > 0 && (
                                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                                  <span className="text-[11.5px] text-muted-foreground">Lists:</span>
                                  {detail.lists.map((l) => (
                                    <span key={l.id} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground"><Tag className="h-2.5 w-2.5" /> {l.name}</span>
                                  ))}
                                </div>
                              )}
                              {editError && <p className="mt-2 text-[12px] text-rose-500">{editError}</p>}
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <button onClick={() => saveEdit(c.id)} disabled={editSaving} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60">
                                  {editSaving ? <FlowLoader size={15} tone="white" /> : <Check className="h-3.5 w-3.5" />} Save changes
                                </button>
                                <button onClick={() => setExpandedId(null)} disabled={editSaving} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3.5 py-2 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /> Cancel</button>
                                <span className="ms-auto">
                                  {confirmDeleteId === c.id ? (
                                    <span className="inline-flex items-center gap-1.5">
                                      <span className="text-[11.5px] text-muted-foreground">Delete?</span>
                                      <button onClick={() => deleteContact(c.id)} disabled={rowBusy === c.id} className="inline-flex items-center gap-1 rounded-[10px] bg-rose-500 px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-60">
                                        {rowBusy === c.id ? <FlowLoader size={14} tone="white" /> : <Trash2 className="h-3.5 w-3.5" />} Yes, delete
                                      </button>
                                      <button onClick={() => setConfirmDeleteId(null)} disabled={rowBusy === c.id} className="inline-flex items-center rounded-[10px] border border-border px-2.5 py-2 text-[12px] font-semibold text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                                    </span>
                                  ) : (
                                    <button onClick={() => setConfirmDeleteId(c.id)} className="inline-flex items-center gap-1.5 rounded-[10px] border border-rose-500/40 px-3 py-2 text-[12px] font-semibold text-rose-500 transition hover:bg-rose-500/10"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                                  )}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
                  <p className="text-[11.5px] text-muted-foreground">
                    Page <span className="font-semibold text-foreground">{pagination.page}</span> of {pagination.pages}
                    <span className="hidden sm:inline"> · {totalContacts.toLocaleString()} contacts</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pagination.page <= 1 || fetching} className="inline-flex items-center gap-1 rounded-[10px] border border-border px-2.5 py-1.5 text-[11.5px] font-semibold transition hover:border-brand-500/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50">
                      <ChevronLeft className="h-3.5 w-3.5" /> Prev
                    </button>
                    <button type="button" onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))} disabled={pagination.page >= pagination.pages || fetching} className="inline-flex items-center gap-1 rounded-[10px] border border-border px-2.5 py-1.5 text-[11.5px] font-semibold transition hover:border-brand-500/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50">
                      Next <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (search || status !== "all" || listId) ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
              <p className="text-[13px] font-medium">No matches</p>
              <p className="mt-1 text-[12px] text-muted-foreground">No contacts match the current search or filters. Try clearing them.</p>
            </div>
          ) : !adding && importStep === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
              <p className="text-[13px] font-medium">No contacts yet</p>
              <p className="mt-1 text-[12px] text-muted-foreground">Add your first contact or import a CSV — then the agent can help you reach them.</p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <button onClick={() => { setAdding(true); setError(""); }} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"><UserPlus className="h-4 w-4" /> Add a contact</button>
                <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-4 py-2 text-[13px] font-semibold hover:border-brand-500/60 hover:text-foreground"><Upload className="h-4 w-4" /> Import CSV</button>
              </div>
            </div>
          ) : null}
        </section>

        {/* Other outreach — each card opens its actual feature, not a chat prompt */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <h3 className="mb-3 text-[13px] font-bold">More outreach</h3>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Quick icon={Search} title="Find leads" desc="Find local businesses to pitch or propose to." onClick={() => onOpenView("leads")} />
            <Quick icon={Star} title="Reviews & local SEO" desc="Get more reviews and fix your listings." onClick={() => onOpenView("reviews")} />
            <Quick icon={FileText} title="Pitch & proposals" desc="Draft a winning proposal for a client." onClick={() => onOpenView("pitch")} />
            <Quick icon={Mail} title="Follow-ups" desc="Set up automated follow-up sequences." onClick={() => onOpenView("automations")} />
            <Quick icon={CalendarDays} title="Forms & events" desc="Collect leads with a form or event page." onClick={() => onOpenView("forms")} />
          </div>
        </section>
      </div>
    </div>
  );
}

// ── Lists / segments panel ──────────────────────────────────────────────────────
function ListsPanel({
  open, onToggle, lists, activeListId, onFilterByList, onChanged, flash,
}: {
  open: boolean;
  onToggle: () => void;
  lists: ListSummary[];
  activeListId: string;
  onFilterByList: (id: string) => void;
  onChanged: () => Promise<void>;
  flash: (msg: string, ms?: number) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  const createList = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const r = await fetch("/api/contact-lists", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.success) { setNewName(""); setCreating(false); flash("List created."); await onChanged(); }
      else flash(j?.error?.message || "Could not create list.", 3000);
    } catch { flash("Could not create list.", 3000); } finally { setBusy(false); }
  };

  const renameList = async (id: string) => {
    const name = renameVal.trim();
    if (!name) return;
    setRowBusy(id);
    try {
      const r = await fetch(`/api/contact-lists/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.success) { setRenamingId(null); flash("List renamed."); await onChanged(); }
      else flash(j?.error?.message || "Could not rename list.", 3000);
    } catch { flash("Could not rename list.", 3000); } finally { setRowBusy(null); }
  };

  const deleteList = async (id: string) => {
    setRowBusy(id);
    try {
      const r = await fetch(`/api/contact-lists/${id}`, { method: "DELETE" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.success) {
        setConfirmDeleteId(null);
        if (activeListId === id) onFilterByList("");
        flash("List deleted.");
        await onChanged();
      } else flash(j?.error?.message || "Could not delete list.", 3000);
    } catch { flash("Could not delete list.", 3000); } finally { setRowBusy(null); }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={onToggle} className="flex items-center gap-2 text-[13px] font-bold">
          <Layers className="h-4 w-4 text-brand-500" /> Lists & segments
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">{lists.length}</span>
          <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition", open && "rotate-90")} />
        </button>
        <div className="ms-auto">
          <button onClick={() => { setCreating((v) => !v); setNewName(""); }} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground">
            <Plus className="h-3.5 w-3.5" /> New list
          </button>
        </div>
      </div>

      {creating && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") createList(); }}
            placeholder="List name (e.g. VIP customers)"
            autoFocus
            className={cn(FIELD, "min-w-0 flex-1 sm:max-w-xs")}
          />
          <button onClick={createList} disabled={busy || !newName.trim()} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60">
            {busy ? <FlowLoader size={14} tone="white" /> : <Check className="h-3.5 w-3.5" />} Create
          </button>
          <button onClick={() => { setCreating(false); setNewName(""); }} className="inline-flex items-center rounded-[10px] border border-border px-3 py-2 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {open && (
        <div className="mt-3">
          {lists.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center">
              <p className="text-[12.5px] font-medium">No lists yet</p>
              <p className="mt-1 text-[11.5px] text-muted-foreground">Create a list to segment your audience and filter contacts.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {lists.map((l) => {
                const isActive = activeListId === l.id;
                return (
                  <div key={l.id} className={cn("flex flex-wrap items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2.5", isActive ? "border-brand-500/40" : "border-border")}>
                    {renamingId === l.id ? (
                      <>
                        <input
                          value={renameVal}
                          onChange={(e) => setRenameVal(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") renameList(l.id); }}
                          autoFocus
                          className={cn(FIELD, "min-w-0 flex-1 sm:max-w-xs")}
                        />
                        <button onClick={() => renameList(l.id)} disabled={rowBusy === l.id} className="inline-flex items-center gap-1 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[11.5px] font-semibold text-white disabled:opacity-60">
                          {rowBusy === l.id ? <FlowLoader size={13} tone="white" /> : <Check className="h-3.5 w-3.5" />} Save
                        </button>
                        <button onClick={() => setRenamingId(null)} className="inline-flex items-center rounded-[10px] border border-border px-2 py-1.5 text-[11.5px] text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => onFilterByList(isActive ? "" : l.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-500/10 text-brand-500"><Layers className="h-4 w-4" /></span>
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-semibold">{l.name}</span>
                            <span className="block text-[11.5px] text-muted-foreground">{(l.totalCount ?? 0).toLocaleString()} contacts · {(l.activeCount ?? 0).toLocaleString()} active</span>
                          </span>
                        </button>
                        <button
                          onClick={() => onFilterByList(isActive ? "" : l.id)}
                          className={cn("inline-flex items-center gap-1 rounded-[10px] border px-2.5 py-1.5 text-[11.5px] font-semibold transition", isActive ? "border-brand-500/50 bg-brand-500/10 text-brand-500" : "border-border hover:border-brand-500/60 hover:text-foreground")}
                        >
                          {isActive ? "Filtering" : "View"} <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => { setRenamingId(l.id); setRenameVal(l.name); }} aria-label="Rename list" className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                        {confirmDeleteId === l.id ? (
                          <span className="inline-flex items-center gap-1">
                            <button onClick={() => deleteList(l.id)} disabled={rowBusy === l.id} className="inline-flex items-center gap-1 rounded-[10px] bg-rose-500 px-2.5 py-1.5 text-[11.5px] font-semibold text-white disabled:opacity-60">
                              {rowBusy === l.id ? <FlowLoader size={13} tone="white" /> : <Trash2 className="h-3.5 w-3.5" />} Delete
                            </button>
                            <button onClick={() => setConfirmDeleteId(null)} className="inline-flex items-center rounded-[10px] border border-border px-2 py-1.5 text-[11.5px] text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                          </span>
                        ) : (
                          <button onClick={() => setConfirmDeleteId(l.id)} aria-label="Delete list" className="rounded-md p-1.5 text-rose-500 transition hover:bg-rose-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ── CSV import wizard (inline) ──────────────────────────────────────────────────
function ImportWizard({
  fileName, headers, preview, mappings, onMap, lists, listId, onListId, dup, onDup,
  importing, error, onCancel, onRun,
}: {
  fileName: string;
  headers: string[];
  preview: string[][];
  mappings: Record<number, string>;
  onMap: (idx: number, field: string) => void;
  lists: ListSummary[];
  listId: string;
  onListId: (id: string) => void;
  dup: "skip" | "update";
  onDup: (d: "skip" | "update") => void;
  importing: boolean;
  error: string;
  onCancel: () => void;
  onRun: () => void;
}) {
  return (
    <div className="mb-3 rounded-xl border border-brand-500/30 bg-brand-500/5 p-3.5">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-500/10 text-brand-500"><Upload className="h-4 w-4" /></span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-bold">Import contacts</p>
          <p className="truncate text-[11.5px] text-muted-foreground">{fileName} · map your columns below</p>
        </div>
        <button onClick={onCancel} disabled={importing} className="ms-auto inline-flex items-center rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>

      {/* Column mapping with preview */}
      <div className="mt-3 overflow-x-auto rounded-[10px] border border-border bg-background">
        <table className="w-full border-collapse text-[11.5px]">
          <thead>
            <tr className="border-b border-border">
              {headers.map((h, i) => (
                <th key={i} className="min-w-[140px] px-2 py-2 text-left align-top">
                  <span className="block truncate font-semibold text-foreground" title={h}>{h || `Column ${i + 1}`}</span>
                  <select
                    value={mappings[i] ?? ""}
                    onChange={(e) => onMap(i, e.target.value)}
                    aria-label={`Map column ${h || i + 1}`}
                    className="mt-1 w-full appearance-none rounded-md border border-input bg-background px-2 py-1 text-[11px] font-medium outline-none focus:border-brand-500/60"
                  >
                    {IMPORT_FIELDS.map((f) => <option key={f.value || "ignore"} value={f.value}>{f.label}</option>)}
                  </select>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.map((row, r) => (
              <tr key={r} className="border-b border-border/60 last:border-0">
                {headers.map((_, i) => (
                  <td key={i} className="max-w-[200px] truncate px-2 py-1.5 text-muted-foreground" title={row[i] || ""}>{row[i] || <span className="opacity-40">—</span>}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground"><AlertTriangle className="h-3 w-3" /> Showing first {preview.length} row{preview.length === 1 ? "" : "s"} for preview. Map at least Email or Phone.</p>

      {/* List assignment + duplicate strategy */}
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">Add imported to list (optional)</span>
          <select value={listId} onChange={(e) => onListId(e.target.value)} className="w-full appearance-none rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] font-medium outline-none focus:border-brand-500/60">
            <option value="">No list</option>
            {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">If a contact already exists</span>
          <select value={dup} onChange={(e) => onDup(e.target.value as "skip" | "update")} className="w-full appearance-none rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] font-medium outline-none focus:border-brand-500/60">
            <option value="skip">Skip duplicates</option>
            <option value="update">Update with new values</option>
          </select>
        </label>
      </div>

      {error && <p className="mt-2 text-[12px] text-rose-500">{error}</p>}
      <div className="mt-3 flex items-center gap-2">
        <button onClick={onRun} disabled={importing} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60">
          {importing ? <FlowLoader size={15} tone="white" /> : <Upload className="h-3.5 w-3.5" />} {importing ? "Importing…" : "Import contacts"}
        </button>
        <button onClick={onCancel} disabled={importing} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3.5 py-2 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /> Cancel</button>
      </div>
    </div>
  );
}

function Checkbox({ checked, indeterminate, onChange, ariaLabel }: { checked: boolean; indeterminate?: boolean; onChange: () => void; ariaLabel: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={ariaLabel}
      onClick={onChange}
      className={cn(
        "grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border transition",
        checked || indeterminate ? "border-brand-500 bg-brand-500 text-white" : "border-border bg-background hover:border-brand-500/60",
      )}
    >
      {indeterminate ? <span className="h-0.5 w-2.5 rounded-full bg-white" /> : checked ? <Check className="h-3 w-3" /> : null}
    </button>
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

function Quick({ icon: Icon, title, desc, onClick }: { icon: ElementType; title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-3 text-left transition hover:border-brand-500/60">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-500/10 text-brand-500"><Icon className="h-[18px] w-[18px]" /></span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold">{title}</span>
        <span className="block text-[11.5px] leading-snug text-muted-foreground">{desc}</span>
      </span>
    </button>
  );
}
