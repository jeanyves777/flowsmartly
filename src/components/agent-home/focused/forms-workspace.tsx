"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ElementType } from "react";
import { ClipboardList, FileText, MessageSquareText, Sparkles, Send, Inbox, ExternalLink, ChevronDown, ChevronRight, Power, PowerOff, Mail, Phone, User, Star, Plus, Pencil, Trash2, Save, X, ArrowUp, ArrowDown, AlertTriangle, ListChecks, Search, Link2, QrCode, Code2, Copy, Check, Users, UserPlus, ArrowLeft, ArrowRight } from "lucide-react";
import QRCode from "qrcode";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * Forms & surveys — a deep new-design lead-capture surface (the Forms workspace
 * canvas): every data-collection form and survey with its submission + reach
 * counts, opened inline to read the actual submissions. The data actions are
 * REAL UI — Open/Close toggles a form's status (PUT /api/{data-forms|surveys}/[id]),
 * "View submissions" loads responses in place (GET …/submissions | …/responses).
 * EDIT renames + edits fields/questions/thank-you/reorder in place (PUT …),
 * SEND distributes to a contact list via email/SMS (POST …/send), SHARE exposes
 * a copy-link + branded QR (qrcode → data-url) + an embeddable <iframe> snippet,
 * and DELETE removes the form/survey and its submissions (DELETE …) — all with
 * inline confirms, no legacy links. The submissions panel searches + paginates
 * beyond the first page (GET …/submissions|…/responses?page=&search=), and forms
 * can SYNC their submissions into a contact list — new or existing — in place
 * (POST /api/data-forms/[id]/sync-contacts). The list itself is searchable +
 * status-filterable. Building a NEW form/survey is a REAL in-surface builder that
 * creates it directly (POST /api/{data-forms|surveys}) — design the fields/
 * questions inline; an optional "draft it with AI" hands the design off to the
 * agent. Only the live public page opens in a new tab. Full-width master/detail:
 * a sticky left menu (KPIs + kind/section nav + New + filters) and a right pane.
 * [[surface-buttons-are-ui-actions]] [[full-width-left-menu-layout]]
 */

// A form and a survey are different models but present identically here, so we
// normalize both into one shape with a `kind` discriminator.
type Kind = "form" | "survey";

// Forms and surveys share the same editable field shape (id/type/label/required/
// placeholder/options). Forms additionally support helpText + more field types.
interface EditField {
  id: string;
  type: string;
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
  helpText?: string;
}

interface Item {
  kind: Kind;
  id: string;
  title: string;
  description?: string | null;
  slug: string;
  status: string; // DRAFT | ACTIVE | CLOSED
  type?: string; // forms only: STANDARD | SMART_COLLECT | ATTENDANCE
  responseCount: number;
  sendCount: number;
  fieldCount: number;
  fields: EditField[];
  thankYouMessage: string;
  contactListId?: string | null;
  contactListName?: string | null;
  createdAt?: string;
}

// A normalized submission/response row (forms expose data{}, surveys answers{} + rating).
interface Entry {
  id: string;
  respondentName?: string | null;
  respondentEmail?: string | null;
  respondentPhone?: string | null;
  values: Record<string, unknown>;
  rating?: number | null;
  createdAt?: string;
}

interface RawForm {
  id: string; title: string; description?: string | null; slug: string; status?: string; type?: string;
  responseCount?: number; sendCount?: number; fields?: unknown[]; thankYouMessage?: string;
  contactListId?: string | null; contactListName?: string | null; createdAt?: string;
}
interface RawSurvey {
  id: string; title: string; description?: string | null; slug: string; status?: string; isActive?: boolean;
  responseCount?: number; sendCount?: number; questions?: unknown[]; thankYouMessage?: string;
  contactListId?: string | null; contactListName?: string | null; createdAt?: string;
}

interface ContactList { id: string; name: string; totalCount: number; smsEligibleCount: number }

// The editable field/question types per kind, mirroring the legacy builders.
const FORM_FIELD_TYPES: { value: string; label: string }[] = [
  { value: "text", label: "Short Text" },
  { value: "textarea", label: "Long Text" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Dropdown" },
  { value: "checkbox", label: "Checkboxes" },
  { value: "radio", label: "Radio Buttons" },
  { value: "url", label: "URL" },
  { value: "address", label: "Address" },
];
const SURVEY_FIELD_TYPES: { value: string; label: string }[] = [
  { value: "text", label: "Short Text" },
  { value: "textarea", label: "Long Text" },
  { value: "rating", label: "Star Rating" },
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "yes_no", label: "Yes / No" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
];
// Types that carry a user-defined option list.
const OPTION_TYPES = new Set(["select", "checkbox", "radio", "multiple_choice"]);

function fieldTypesFor(kind: Kind) { return kind === "form" ? FORM_FIELD_TYPES : SURVEY_FIELD_TYPES; }
function fieldTypeLabel(kind: Kind, type: string): string {
  return fieldTypesFor(kind).find((t) => t.value === type)?.label ?? type;
}

function parseFields(kind: Kind, raw: unknown[]): EditField[] {
  return raw.map((r, i) => {
    const f = (r ?? {}) as Record<string, unknown>;
    const type = typeof f.type === "string" ? f.type : "text";
    return {
      id: typeof f.id === "string" && f.id ? f.id : `f_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      label: typeof f.label === "string" ? f.label : "",
      required: f.required === true,
      placeholder: typeof f.placeholder === "string" ? f.placeholder : "",
      options: Array.isArray(f.options) ? (f.options as unknown[]).map((o) => String(o)) : undefined,
      helpText: typeof f.helpText === "string" ? f.helpText : undefined,
    };
  });
}

function liveUrl(it: Item): string {
  return it.kind === "form" ? `/form/${it.slug}` : `/survey/${it.slug}`;
}
// Absolute, shareable public URL (origin only resolves in the browser).
function publicUrl(it: Item): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${liveUrl(it)}`;
}
function embedCode(it: Item): string {
  return `<iframe src="${publicUrl(it)}" width="100%" height="600" frameborder="0"></iframe>`;
}
function apiBase(kind: Kind): string {
  return kind === "form" ? "/api/data-forms" : "/api/surveys";
}
const ENTRIES_PAGE_SIZE = 20;
// Submissions (forms) / responses (surveys) share the same page+search contract.
function entriesPath(it: Item, page: number, search: string): string {
  const sub = it.kind === "form" ? "submissions" : "responses";
  const params = new URLSearchParams({ page: String(page), limit: String(ENTRIES_PAGE_SIZE) });
  if (search.trim()) params.set("search", search.trim());
  return `${apiBase(it.kind)}/${it.id}/${sub}?${params.toString()}`;
}

function whenLabel(iso?: string): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); } catch { return ""; }
}

const STATUS_META: Record<string, { label: string; tone: string }> = {
  ACTIVE: { label: "Live", tone: "bg-emerald-500/10 text-emerald-500" },
  DRAFT: { label: "Draft", tone: "bg-muted text-muted-foreground" },
  CLOSED: { label: "Closed", tone: "bg-amber-500/10 text-amber-500" },
};

type Panel = "entries" | "edit" | "send" | "share" | "sync";

export function FocusedForms({ refreshKey, onAsk }: { refreshKey?: number; onAsk?: (prompt: string) => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Which item is expanded, and which panel within it (submissions / edit / send).
  const [openId, setOpenId] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>("entries");

  // Right pane shows the create builder instead of the list when set.
  const [creating, setCreating] = useState<Kind | null>(null);
  const [notice, setNotice] = useState("");

  const [entries, setEntries] = useState<Entry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [entriesPage, setEntriesPage] = useState(1);
  const [entriesPages, setEntriesPages] = useState(1);
  const [entriesTotal, setEntriesTotal] = useState(0);
  const [entriesSearch, setEntriesSearch] = useState("");
  const [busyToggle, setBusyToggle] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busyDelete, setBusyDelete] = useState<string | null>(null);

  // List-level search + status filter (name/status).
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "DRAFT" | "CLOSED">("ALL");
  const [kindFilter, setKindFilter] = useState<"ALL" | Kind>("ALL");

  // Marketing readiness + contact lists are shared across all send panels; fetch lazily once.
  const [emailReady, setEmailReady] = useState(false);
  const [smsReady, setSmsReady] = useState(false);
  const [lists, setLists] = useState<ContactList[] | null>(null);
  const sendDataReq = useRef(false);

  const load = useCallback(async () => {
    setLoadError(false);
    const [fr, sr] = await Promise.all([
      fetch(`${apiBase("form")}?limit=50`).then((r) => r.json()).catch(() => null),
      fetch(`${apiBase("survey")}?limit=50`).then((r) => r.json()).catch(() => null),
    ]);
    if (!fr?.success && !sr?.success) { setLoadError(true); return; }

    const out: Item[] = [];
    if (fr?.success && Array.isArray(fr.data)) {
      for (const f of fr.data as RawForm[]) {
        const fields = parseFields("form", Array.isArray(f.fields) ? f.fields : []);
        out.push({
          kind: "form", id: f.id, title: f.title, description: f.description, slug: f.slug,
          status: (f.status || "DRAFT").toUpperCase(), type: f.type,
          responseCount: f.responseCount ?? 0, sendCount: f.sendCount ?? 0,
          fieldCount: fields.length, fields,
          thankYouMessage: f.thankYouMessage || "",
          contactListId: f.contactListId ?? null, contactListName: f.contactListName, createdAt: f.createdAt,
        });
      }
    }
    if (sr?.success && Array.isArray(sr.data)) {
      for (const s of sr.data as RawSurvey[]) {
        const fields = parseFields("survey", Array.isArray(s.questions) ? s.questions : []);
        out.push({
          kind: "survey", id: s.id, title: s.title, description: s.description, slug: s.slug,
          status: (s.status || (s.isActive ? "ACTIVE" : "DRAFT")).toUpperCase(),
          responseCount: s.responseCount ?? 0, sendCount: s.sendCount ?? 0,
          fieldCount: fields.length, fields,
          thankYouMessage: s.thankYouMessage || "",
          contactListId: s.contactListId ?? null, contactListName: s.contactListName, createdAt: s.createdAt,
        });
      }
    }
    out.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    setItems(out);
  }, []);

  useEffect(() => {
    let alive = true;
    load().finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [load, refreshKey]);

  // Lazily load marketing readiness + contact lists the first time a Send panel opens.
  const ensureSendData = useCallback(async () => {
    if (sendDataReq.current) return;
    sendDataReq.current = true;
    try {
      const [cfg, cl] = await Promise.all([
        fetch("/api/marketing-config").then((r) => r.json()).catch(() => null),
        fetch("/api/contact-lists").then((r) => r.json()).catch(() => null),
      ]);
      const c = cfg?.success ? cfg.data?.config : null;
      if (c) {
        setEmailReady(!!(c.emailEnabled || c.emailVerified) && c.emailProvider !== "NONE");
        setSmsReady(!!(c.smsEnabled && c.smsPhoneNumber) && c.smsComplianceStatus === "APPROVED");
      }
      const rawLists: unknown[] = Array.isArray(cl?.data?.lists) ? cl.data.lists : Array.isArray(cl?.data) ? cl.data : [];
      setLists(rawLists.map((raw) => {
        const l = raw as Record<string, unknown>;
        return {
          id: String(l.id),
          name: String(l.name ?? "Untitled list"),
          totalCount: Number(l.totalCount ?? l.contactCount ?? 0),
          smsEligibleCount: Number(l.smsEligibleCount ?? 0),
        };
      }));
    } catch {
      setLists([]); // surface an empty/error state rather than spinning forever
    }
  }, []);

  const stats = useMemo(() => {
    let submissions = 0, sent = 0, live = 0;
    for (const it of items) { submissions += it.responseCount; sent += it.sendCount; if (it.status === "ACTIVE") live++; }
    return { total: items.length, submissions, sent, live };
  }, [items]);

  // Client-side search + status/kind filter over the loaded list (name/status).
  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (statusFilter !== "ALL" && it.status !== statusFilter) return false;
      if (kindFilter !== "ALL" && it.kind !== kindFilter) return false;
      if (!q) return true;
      return (it.title || "").toLowerCase().includes(q) || (it.description || "").toLowerCase().includes(q) || (it.contactListName || "").toLowerCase().includes(q);
    });
  }, [items, query, statusFilter, kindFilter]);

  const openPanel = useCallback((it: Item, next: Panel) => {
    setConfirmDelete(null);
    if (openId === it.id && panel === next) { setOpenId(null); return; }
    setOpenId(it.id);
    setPanel(next);
    if (next === "send" || next === "sync") void ensureSendData();
  }, [openId, panel, ensureSendData]);

  const loadEntries = useCallback(async (it: Item, page: number, search: string) => {
    setEntries([]); setEntriesLoading(true);
    try {
      const j = await fetch(entriesPath(it, page, search)).then((r) => r.json());
      const rows: unknown[] = Array.isArray(j?.data) ? j.data : [];
      const norm: Entry[] = rows.map((raw) => {
        const r = raw as Record<string, unknown>;
        return {
          id: String(r.id ?? Math.random()),
          respondentName: (r.respondentName as string) ?? null,
          respondentEmail: (r.respondentEmail as string) ?? null,
          respondentPhone: (r.respondentPhone as string) ?? null,
          values: (it.kind === "form" ? r.data : r.answers) as Record<string, unknown> || {},
          rating: (r.rating as number) ?? null,
          createdAt: r.createdAt as string,
        };
      });
      setEntries(norm);
      const pg = (j?.pagination ?? {}) as Record<string, unknown>;
      setEntriesTotal(Number(pg.total ?? norm.length));
      setEntriesPages(Math.max(1, Number(pg.pages ?? 1)));
      setEntriesPage(Number(pg.page ?? page));
    } catch { /* ignore — empty state covers it */ } finally {
      setEntriesLoading(false);
    }
  }, []);

  // When the submissions panel opens (or its page/search change), (re)load it.
  // Reset paging/search whenever the open item changes.
  useEffect(() => {
    setEntriesPage(1); setEntriesSearch(""); setEntriesTotal(0); setEntriesPages(1);
  }, [openId]);

  useEffect(() => {
    if (!openId || panel !== "entries") return;
    const it = items.find((x) => x.id === openId);
    if (!it) return;
    const t = setTimeout(() => void loadEntries(it, entriesPage, entriesSearch), entriesSearch ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, panel, entriesPage, entriesSearch]);

  const toggleStatus = useCallback(async (it: Item) => {
    const next = it.status === "ACTIVE" ? "CLOSED" : "ACTIVE";
    setBusyToggle(it.id);
    try {
      const body: Record<string, unknown> = { status: next };
      if (it.kind === "survey") body.isActive = next === "ACTIVE";
      const r = await fetch(`${apiBase(it.kind)}/${it.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, status: next } : x)));
      }
    } catch { /* ignore */ } finally {
      setBusyToggle(null);
    }
  }, []);

  const deleteItem = useCallback(async (it: Item) => {
    setBusyDelete(it.id);
    try {
      const r = await fetch(`${apiBase(it.kind)}/${it.id}`, { method: "DELETE" });
      if (r.ok) {
        setItems((prev) => prev.filter((x) => !(x.id === it.id && x.kind === it.kind)));
        if (openId === it.id) setOpenId(null);
        setConfirmDelete(null);
      }
    } catch { /* ignore */ } finally {
      setBusyDelete(null);
    }
  }, [openId]);

  // Persist an edit (title/description/fields/thankYou) and merge back into local state.
  const saveEdit = useCallback(async (it: Item, patch: { title: string; description: string; fields: EditField[]; thankYouMessage: string }) => {
    const body: Record<string, unknown> =
      it.kind === "form"
        ? { title: patch.title, description: patch.description || null, fields: patch.fields, thankYouMessage: patch.thankYouMessage }
        : { title: patch.title, description: patch.description || null, questions: patch.fields, thankYouMessage: patch.thankYouMessage };
    const r = await fetch(`${apiBase(it.kind)}/${it.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.success) {
      throw new Error(j?.error?.message || "Couldn't save changes");
    }
    setItems((prev) => prev.map((x) => (x.id === it.id && x.kind === it.kind
      ? { ...x, title: patch.title, description: patch.description || null, fields: patch.fields, fieldCount: patch.fields.length, thankYouMessage: patch.thankYouMessage }
      : x)));
  }, []);

  const sendItem = useCallback(async (it: Item, channel: "email" | "sms", contactListId: string): Promise<{ ok: boolean; message: string }> => {
    // Closed items can't be sent; surveys/forms must be ACTIVE. Flip to ACTIVE first.
    if (it.status !== "ACTIVE") {
      const body: Record<string, unknown> = { status: "ACTIVE" };
      if (it.kind === "survey") body.isActive = true;
      await fetch(`${apiBase(it.kind)}/${it.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      }).catch(() => null);
      setItems((prev) => prev.map((x) => (x.id === it.id && x.kind === it.kind ? { ...x, status: "ACTIVE" } : x)));
    }
    const r = await fetch(`${apiBase(it.kind)}/${it.id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, contactListId }),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.success) {
      return { ok: false, message: j?.error?.message || "Couldn't send" };
    }
    const queued = Number(j?.data?.queued ?? 0);
    setItems((prev) => prev.map((x) => (x.id === it.id && x.kind === it.kind ? { ...x, sendCount: x.sendCount + queued } : x)));
    return { ok: true, message: j?.data?.message || `Queued to ${queued} contact${queued === 1 ? "" : "s"}` };
  }, []);

  // Sync a form's submissions into a contact list — append to an existing list or
  // create a fresh one (forms only; surveys have no sync endpoint).
  const syncContacts = useCallback(async (
    it: Item,
    mode: "existing" | "new",
    value: string,
  ): Promise<{ ok: boolean; message: string }> => {
    const body: Record<string, unknown> = {};
    if (mode === "existing") body.listId = value;
    else { body.createNewList = true; body.newListName = value; }
    try {
      const r = await fetch(`${apiBase("form")}/${it.id}/sync-contacts`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.success) return { ok: false, message: j?.error?.message || "Couldn't sync contacts" };
      // A fresh list invalidates the cached contact-list options + may rename the linked list.
      sendDataReq.current = false; setLists(null);
      void load();
      return { ok: true, message: j?.data?.message || "Contacts synced" };
    } catch {
      return { ok: false, message: "Couldn't sync contacts" };
    }
  }, [load]);

  // "New form" is now a REAL in-surface builder (POST /api/{data-forms|surveys}),
  // not an agent prompt. The agent stays opt-in via the builder's "draft with AI".
  const openCreate = useCallback((kind: Kind) => {
    setCreating(kind);
    setNotice("");
    setOpenId(null);
    setConfirmDelete(null);
  }, []);
  // Optional generative assist — kept as the only onAsk, hands field design to
  // the agent (genuinely generative). Closes the builder so its task surfaces.
  const draftWithAi = useCallback((kind: Kind) => {
    setCreating(null);
    onAsk?.(kind === "form"
      ? "Create a new lead-capture form to collect contact details from my audience. Suggest the right fields and a thank-you message."
      : "Create a new survey to gather feedback from my audience. Suggest the right questions and a thank-you message.");
  }, [onAsk]);

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading your forms…" /></div>;
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start">
        {/* LEFT: sticky menu — KPIs + kind nav + New + filters */}
        <aside className="space-y-3 lg:sticky lg:top-0 lg:w-[280px] lg:shrink-0">
          <button
            onClick={() => openCreate(kindFilter === "survey" ? "survey" : "form")}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-[12px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"
          >
            <Plus className="h-4 w-4" /> New {kindFilter === "survey" ? "survey" : "form"}
          </button>

          <div className="rounded-2xl border border-border bg-card p-3">
            <div className="flex items-center gap-2 px-1 pb-2"><ClipboardList className="h-4 w-4 text-brand-500" /><span className="text-[12.5px] font-bold">Overview</span></div>
            <div className="space-y-1.5">
              <SummaryRow icon={ClipboardList} label="Forms & surveys" value={stats.total.toLocaleString()} />
              <SummaryRow icon={Inbox} label="Submissions" value={stats.submissions.toLocaleString()} />
              <SummaryRow icon={Send} label="Sent" value={stats.sent.toLocaleString()} />
              <SummaryRow icon={Power} label="Live now" value={stats.live.toLocaleString()} />
            </div>
          </div>

          {/* kind section nav (vertical) */}
          <nav className="rounded-2xl border border-border bg-card p-1.5">
            {(["ALL", "form", "survey"] as const).map((k) => {
              const active = kindFilter === k && !creating;
              const count = k === "ALL" ? items.length : items.filter((it) => it.kind === k).length;
              const Icon = k === "form" ? FileText : k === "survey" ? MessageSquareText : ClipboardList;
              return (
                <button
                  key={k}
                  onClick={() => { setCreating(null); setKindFilter(k); }}
                  className={cn("flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-colors", active ? "bg-brand-500/10 text-brand-500" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-start">{k === "ALL" ? "All" : k === "form" ? "Forms" : "Surveys"}</span>
                  {count > 0 && (
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums", active ? "bg-brand-500/15 text-brand-500" : "bg-muted text-muted-foreground")}>{count}</span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* filters: search + status */}
          {!loadError && items.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name…"
                  className="w-full rounded-[10px] border border-border bg-background py-1.5 pl-8 pr-7 text-[12px] outline-none focus:border-brand-500/60"
                />
                {query && (
                  <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                )}
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="mt-2 w-full rounded-[10px] border border-border bg-background px-2.5 py-1.5 text-[12px] outline-none focus:border-brand-500/60"
              >
                <option value="ALL">Any status</option>
                <option value="ACTIVE">Live</option>
                <option value="DRAFT">Draft</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
          )}
        </aside>

        {/* RIGHT: create builder OR the list — full width */}
        <div className="min-w-0 flex-1 space-y-4">
          {creating ? (
            <CreateForm
              kind={creating}
              onCancel={() => setCreating(null)}
              onCreated={(msg) => { setCreating(null); setNotice(msg); void load(); }}
              onDraftWithAi={onAsk ? () => draftWithAi(creating) : undefined}
            />
          ) : (
            <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h3 className="text-[13px] font-bold">Your forms & surveys</h3>
                {items.length > 0 && (
                  <button onClick={() => openCreate(kindFilter === "survey" ? "survey" : "form")} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground">
                    <Plus className="h-3.5 w-3.5" /> New {kindFilter === "survey" ? "survey" : "form"}
                  </button>
                )}
              </div>

              {notice && <p className="mb-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-[12px] text-emerald-600 dark:text-emerald-400">{notice}</p>}

          {loadError ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
              <p className="text-[13px] font-medium">Couldn&apos;t load your forms</p>
              <p className="mt-1 text-[12px] text-muted-foreground">Something went wrong fetching them. Try again in a moment.</p>
            </div>
          ) : items.length && !visibleItems.length ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
              <p className="text-[13px] font-medium">No matches</p>
              <p className="mt-1 text-[12px] text-muted-foreground">No forms or surveys match your search or filters.</p>
              <button onClick={() => { setQuery(""); setStatusFilter("ALL"); setKindFilter("ALL"); }} className="mt-3 inline-flex items-center gap-1.5 rounded-[9px] border border-border bg-background px-2.5 py-1 text-[11.5px] font-semibold hover:border-brand-500/60 hover:text-foreground">
                <X className="h-3.5 w-3.5" /> Clear filters
              </button>
            </div>
          ) : items.length ? (
            <div className="space-y-2.5">
              {visibleItems.map((it) => {
                const sm = STATUS_META[it.status] ?? STATUS_META.DRAFT;
                const isOpen = openId === it.id;
                const isDeleting = busyDelete === it.id;
                return (
                  <div key={`${it.kind}-${it.id}`} className="overflow-hidden rounded-xl border border-border bg-muted/30">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3">
                      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", it.kind === "form" ? "bg-brand-500/10 text-brand-500" : "bg-violet-500/10 text-violet-500")}>
                        {it.kind === "form" ? <FileText className="h-[18px] w-[18px]" /> : <MessageSquareText className="h-[18px] w-[18px]" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-[13.5px] font-semibold">{it.title || "Untitled"}</p>
                          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold", sm.tone)}>{sm.label}</span>
                        </div>
                        <p className="truncate text-[11.5px] text-muted-foreground">
                          {it.kind === "form" ? "Form" : "Survey"}
                          {it.fieldCount ? ` · ${it.fieldCount} field${it.fieldCount === 1 ? "" : "s"}` : ""}
                          {it.contactListName ? ` · ${it.contactListName}` : ""}
                          {it.createdAt ? ` · ${whenLabel(it.createdAt)}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3 text-[11.5px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1" title="Submissions"><Inbox className="h-3.5 w-3.5" /> <span className="font-semibold text-foreground">{it.responseCount}</span></span>
                        <span className="inline-flex items-center gap-1" title="Sent"><Send className="h-3.5 w-3.5" /> <span className="font-semibold text-foreground">{it.sendCount}</span></span>
                      </div>
                    </div>

                    {/* action row */}
                    <div className="flex flex-wrap items-center gap-1.5 border-t border-border px-3 py-2">
                      <ActionBtn active={isOpen && panel === "entries"} onClick={() => openPanel(it, "entries")}>
                        {isOpen && panel === "entries" ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        {isOpen && panel === "entries" ? "Hide submissions" : `Submissions${it.responseCount ? ` (${it.responseCount})` : ""}`}
                      </ActionBtn>
                      <ActionBtn active={isOpen && panel === "edit"} onClick={() => openPanel(it, "edit")}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </ActionBtn>
                      <ActionBtn active={isOpen && panel === "send"} onClick={() => openPanel(it, "send")}>
                        <Send className="h-3.5 w-3.5" /> Send
                      </ActionBtn>
                      <ActionBtn active={isOpen && panel === "share"} onClick={() => openPanel(it, "share")}>
                        <Link2 className="h-3.5 w-3.5" /> Share
                      </ActionBtn>
                      {it.kind === "form" && (
                        <ActionBtn active={isOpen && panel === "sync"} onClick={() => openPanel(it, "sync")}>
                          <Users className="h-3.5 w-3.5" /> Sync to list
                        </ActionBtn>
                      )}
                      <a href={liveUrl(it)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-[9px] border border-border bg-background px-2.5 py-1 text-[11.5px] font-semibold hover:border-brand-500/60 hover:text-foreground">
                        <ExternalLink className="h-3.5 w-3.5" /> Open live
                      </a>

                      <div className="ms-auto flex items-center gap-1.5">
                        {it.status !== "DRAFT" && (
                          <button onClick={() => toggleStatus(it)} disabled={busyToggle === it.id} className="inline-flex items-center gap-1.5 rounded-[9px] border border-border bg-background px-2.5 py-1 text-[11.5px] font-semibold hover:border-brand-500/60 hover:text-foreground disabled:opacity-60">
                            {busyToggle === it.id ? <FlowLoader size={13} /> : it.status === "ACTIVE" ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                            {it.status === "ACTIVE" ? "Close" : "Re-open"}
                          </button>
                        )}
                        {confirmDelete === it.id ? (
                          <span className="inline-flex items-center gap-1">
                            <button onClick={() => deleteItem(it)} disabled={isDeleting} className="inline-flex items-center gap-1.5 rounded-[9px] border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-[11.5px] font-semibold text-red-500 hover:bg-red-500/20 disabled:opacity-60">
                              {isDeleting ? <FlowLoader size={13} /> : <Trash2 className="h-3.5 w-3.5" />} Confirm
                            </button>
                            <button onClick={() => setConfirmDelete(null)} disabled={isDeleting} className="inline-flex items-center rounded-[9px] border border-border bg-background px-2 py-1 text-[11.5px] font-semibold hover:text-foreground">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        ) : (
                          <button onClick={() => { setConfirmDelete(it.id); }} title="Delete" className="inline-flex items-center gap-1.5 rounded-[9px] border border-border bg-background px-2.5 py-1 text-[11.5px] font-semibold text-muted-foreground hover:border-red-500/50 hover:text-red-500">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {confirmDelete === it.id && (
                      <div className="flex items-center gap-2 border-t border-red-500/20 bg-red-500/5 px-3 py-2 text-[11.5px] text-red-500">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        <span>Delete this {it.kind} and all {it.responseCount} submission{it.responseCount === 1 ? "" : "s"}? This can&apos;t be undone.</span>
                      </div>
                    )}

                    {/* inline panels */}
                    {isOpen && panel === "entries" && (
                      <EntriesPanel
                        item={it}
                        loading={entriesLoading}
                        entries={entries}
                        search={entriesSearch}
                        onSearch={(v) => { setEntriesSearch(v); setEntriesPage(1); }}
                        page={entriesPage}
                        pages={entriesPages}
                        total={entriesTotal}
                        onPage={(p) => setEntriesPage(p)}
                      />
                    )}
                    {isOpen && panel === "edit" && (
                      <EditPanel item={it} onSave={saveEdit} onClose={() => setOpenId(null)} />
                    )}
                    {isOpen && panel === "send" && (
                      <SendPanel item={it} lists={lists} emailReady={emailReady} smsReady={smsReady} onSend={sendItem} onAsk={onAsk} />
                    )}
                    {isOpen && panel === "share" && (
                      <SharePanel item={it} />
                    )}
                    {isOpen && panel === "sync" && (
                      <SyncPanel item={it} lists={lists} onSync={syncContacts} />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/20 text-brand-500"><ClipboardList className="h-7 w-7" /></span>
              <p className="mt-3 text-[14px] font-semibold">No forms or surveys yet</p>
              <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-muted-foreground">Build a lead-capture form or a quick survey, share the link, and collect submissions — design the fields yourself or let the agent draft them.</p>
              <button onClick={() => openCreate("form")} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30">
                <Plus className="h-4 w-4" /> Create a form
              </button>
            </div>
          )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[9px] border px-2.5 py-1 text-[11.5px] font-semibold",
        active
          ? "border-brand-500/60 bg-brand-500/10 text-brand-500"
          : "border-border bg-background hover:border-brand-500/60 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function EntriesPanel({ item, loading, entries, search, onSearch, page, pages, total, onPage }: {
  item: Item;
  loading: boolean;
  entries: Entry[];
  search: string;
  onSearch: (v: string) => void;
  page: number;
  pages: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const noun = item.kind === "form" ? "submission" : "response";
  const rangeFrom = total === 0 ? 0 : (page - 1) * ENTRIES_PAGE_SIZE + 1;
  const rangeTo = Math.min(page * ENTRIES_PAGE_SIZE, total);
  return (
    <div className="border-t border-border bg-background/50 px-3 py-3">
      {/* search across name / email / phone (server-side) */}
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[170px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={item.kind === "form" ? `Search ${noun}s by name, email or phone…` : `Search ${noun}s by name or email…`}
            className="w-full rounded-[10px] border border-border bg-card py-1.5 pl-8 pr-7 text-[12px] outline-none focus:border-brand-500/60"
          />
          {search && (
            <button onClick={() => onSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
          )}
        </div>
        {total > 0 && (
          <span className="text-[11px] text-muted-foreground">{rangeFrom}–{rangeTo} of {total}</span>
        )}
      </div>
      {loading ? (
        <div className="grid place-items-center py-6"><FlowLoader size={22} label={`Loading ${noun}s…`} /></div>
      ) : entries.length ? (
        <div className="space-y-2">
          {entries.map((e) => (
            <div key={e.id} className="rounded-lg border border-border bg-card px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold">
                  <User className="h-3.5 w-3.5 text-muted-foreground" /> {e.respondentName || "Anonymous"}
                </span>
                {e.respondentEmail && <span className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground"><Mail className="h-3 w-3" /> {e.respondentEmail}</span>}
                {e.respondentPhone && <span className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground"><Phone className="h-3 w-3" /> {e.respondentPhone}</span>}
                {typeof e.rating === "number" && (
                  <span className="inline-flex items-center gap-0.5 text-[11.5px] font-semibold text-amber-500"><Star className="h-3 w-3 fill-amber-500" /> {e.rating}</span>
                )}
                {e.createdAt && <span className="ms-auto text-[11px] text-muted-foreground">{whenLabel(e.createdAt)}</span>}
              </div>
              {(() => {
                const pairs = Object.entries(e.values || {}).filter(([, v]) => v != null && String(v).trim() !== "").slice(0, 6);
                if (!pairs.length) return null;
                return (
                  <dl className="mt-1.5 grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
                    {pairs.map(([k, v]) => (
                      <div key={k} className="flex gap-1.5 text-[11.5px]">
                        <dt className="shrink-0 font-medium text-muted-foreground">{k}:</dt>
                        <dd className="min-w-0 truncate">{fmtValue(v)}</dd>
                      </div>
                    ))}
                  </dl>
                );
              })()}
            </div>
          ))}
        </div>
      ) : search ? (
        <p className="py-4 text-center text-[12px] text-muted-foreground">No {noun}s match “{search}”.</p>
      ) : (
        <p className="py-4 text-center text-[12px] text-muted-foreground">No {noun}s yet — share the live link to start collecting.</p>
      )}

      {/* pagination beyond the first page */}
      {!loading && pages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2">
          <button
            onClick={() => onPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="inline-flex items-center gap-1 rounded-[9px] border border-border bg-card px-2.5 py-1 text-[11.5px] font-semibold hover:border-brand-500/60 disabled:opacity-40"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Prev
          </button>
          <span className="text-[11.5px] text-muted-foreground">Page {page} of {pages}</span>
          <button
            onClick={() => onPage(Math.min(pages, page + 1))}
            disabled={page >= pages}
            className="inline-flex items-center gap-1 rounded-[9px] border border-border bg-card px-2.5 py-1 text-[11.5px] font-semibold hover:border-brand-500/60 disabled:opacity-40"
          >
            Next <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// Inline copy-to-clipboard button with a transient "Copied" state.
function CopyButton({ value, label = "Copy", className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); } catch { return; }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button
      onClick={copy}
      className={cn("inline-flex items-center gap-1.5 rounded-[9px] border px-2.5 py-1 text-[11.5px] font-semibold transition-colors", copied ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600" : "border-border bg-card hover:border-brand-500/60 hover:text-foreground", className)}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : label}
    </button>
  );
}

// Share panel — copy the public link, scan/download a QR, or embed the iframe.
function SharePanel({ item }: { item: Item }) {
  const url = publicUrl(item);
  const embed = embedCode(item);
  const [qr, setQr] = useState<string | null>(null);
  const [tab, setTab] = useState<"link" | "qr" | "embed">("link");

  useEffect(() => {
    let alive = true;
    if (!url) return;
    QRCode.toDataURL(url, { width: 320, margin: 1, errorCorrectionLevel: "M" })
      .then((d) => { if (alive) setQr(d); })
      .catch(() => { if (alive) setQr(null); });
    return () => { alive = false; };
  }, [url]);

  const downloadQr = () => {
    if (!qr) return;
    const a = document.createElement("a");
    a.href = qr;
    a.download = `${(item.title || item.kind).toLowerCase().replace(/\s+/g, "-")}-qr.png`;
    a.click();
  };

  return (
    <div className="space-y-3 border-t border-border bg-background/50 px-3 py-3">
      <div className="flex items-center gap-1 rounded-[10px] border border-border bg-card p-0.5 w-fit">
        <ShareTab active={tab === "link"} onClick={() => setTab("link")} icon={Link2} label="Link" />
        <ShareTab active={tab === "qr"} onClick={() => setTab("qr")} icon={QrCode} label="QR code" />
        <ShareTab active={tab === "embed"} onClick={() => setTab("embed")} icon={Code2} label="Embed" />
      </div>

      {tab === "link" && (
        <div className="space-y-2">
          <span className="block text-[11px] font-medium text-muted-foreground">Public link</span>
          <div className="flex items-center gap-2">
            <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-[10px] border border-border bg-card px-2.5 py-1.5 text-[12px] outline-none" />
            <CopyButton value={url} label="Copy link" />
          </div>
          <p className="text-[11px] text-muted-foreground">Anyone with this link can open your {item.kind} and submit a response.</p>
        </div>
      )}

      {tab === "qr" && (
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
          <div className="grid h-[180px] w-[180px] shrink-0 place-items-center rounded-[12px] border border-border bg-white p-2">
            {qr ? <img src={qr} alt="QR code" className="h-full w-full object-contain" /> : <FlowLoader size={22} label="Generating…" />}
          </div>
          <div className="space-y-2">
            <p className="text-[12px] font-medium">Scan to open the {item.kind}</p>
            <p className="text-[11.5px] text-muted-foreground">Print it on a flyer, table tent, or receipt — scanning opens the live link.</p>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={downloadQr} disabled={!qr} className="inline-flex items-center gap-1.5 rounded-[9px] bg-gradient-to-r from-brand-500 to-violet-500 px-2.5 py-1 text-[11.5px] font-semibold text-white disabled:opacity-50">
                <QrCode className="h-3.5 w-3.5" /> Download PNG
              </button>
              <CopyButton value={url} label="Copy link" />
            </div>
          </div>
        </div>
      )}

      {tab === "embed" && (
        <div className="space-y-2">
          <span className="block text-[11px] font-medium text-muted-foreground">Embed on your website</span>
          <textarea readOnly value={embed} onFocus={(e) => e.currentTarget.select()} rows={3} className="w-full resize-none rounded-[10px] border border-border bg-card px-2.5 py-2 font-mono text-[11px] leading-relaxed outline-none" />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">Paste this into any HTML page to embed the live {item.kind}.</p>
            <CopyButton value={embed} label="Copy code" />
          </div>
        </div>
      )}
    </div>
  );
}

function ShareTab({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: ElementType; label: string }) {
  return (
    <button onClick={onClick} className={cn("inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-1 text-[11.5px] font-semibold", active ? "bg-brand-500/10 text-brand-500" : "text-muted-foreground hover:text-foreground")}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

// Sync panel (forms only) — push submission contacts into a new or existing list.
function SyncPanel({ item, lists, onSync }: {
  item: Item;
  lists: ContactList[] | null;
  onSync: (it: Item, mode: "existing" | "new", value: string) => Promise<{ ok: boolean; message: string }>;
}) {
  const [mode, setMode] = useState<"existing" | "new">("new");
  const [listId, setListId] = useState<string>(item.contactListId || "");
  const [newName, setNewName] = useState<string>(item.title || "");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const labelCls = "block text-[11px] font-medium text-muted-foreground mb-1";
  const inputCls = "w-full rounded-[10px] border border-border bg-card px-2.5 py-1.5 text-[12px] outline-none focus:border-brand-500/60";

  const canSync = item.responseCount > 0 && (mode === "existing" ? !!listId : newName.trim().length > 0);

  const doSync = async () => {
    setBusy(true);
    const r = await onSync(item, mode, mode === "existing" ? listId : newName.trim());
    setResult(r);
    setConfirming(false);
    setBusy(false);
  };

  // A successful sync invalidates the parent's cached lists (sets them to null);
  // keep rendering so the success message shows instead of snapping back to the
  // loader. Fall back to an empty list for any list-dependent reads below.
  if (lists === null && !result) {
    return <div className="border-t border-border bg-background/50 px-3 py-6"><div className="grid place-items-center"><FlowLoader size={20} label="Loading lists…" /></div></div>;
  }
  const safeLists = lists || [];

  return (
    <div className="space-y-3 border-t border-border bg-background/50 px-3 py-3">
      <p className="text-[11.5px] text-muted-foreground">
        Turn this form&apos;s submissions into contacts — any submission with an email or phone is added to your audience (duplicates are merged).
      </p>

      {item.responseCount === 0 ? (
        <div className="flex items-center gap-2 rounded-[10px] border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11.5px] text-amber-600">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>No submissions yet — collect at least one response before syncing.</span>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <button onClick={() => { setMode("new"); setResult(null); setConfirming(false); }} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-[10px] border px-3 py-2 text-[12px] font-semibold", mode === "new" ? "border-brand-500/60 bg-brand-500/10 text-brand-500" : "border-border bg-card hover:border-brand-500/50")}>
              <UserPlus className="h-3.5 w-3.5" /> New list
            </button>
            <button onClick={() => { setMode("existing"); setResult(null); setConfirming(false); }} disabled={safeLists.length === 0} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-[10px] border px-3 py-2 text-[12px] font-semibold disabled:opacity-50", mode === "existing" ? "border-brand-500/60 bg-brand-500/10 text-brand-500" : "border-border bg-card hover:border-brand-500/50")}>
              <ListChecks className="h-3.5 w-3.5" /> Existing list
            </button>
          </div>

          {mode === "new" ? (
            <div>
              <label className={labelCls}>New list name</label>
              <input value={newName} onChange={(e) => { setNewName(e.target.value); setResult(null); setConfirming(false); }} className={inputCls} placeholder="e.g. Website leads" />
            </div>
          ) : (
            <div>
              <label className={labelCls}>Add to list</label>
              {safeLists.length === 0 ? (
                <p className="rounded-[10px] border border-dashed border-border px-3 py-3 text-center text-[11.5px] text-muted-foreground">No contact lists yet — create a new one above.</p>
              ) : (
                <select value={listId} onChange={(e) => { setListId(e.target.value); setResult(null); setConfirming(false); }} className={inputCls}>
                  <option value="">Select a contact list…</option>
                  {safeLists.map((l) => (
                    <option key={l.id} value={l.id}>{l.name} ({l.totalCount} contact{l.totalCount === 1 ? "" : "s"})</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {result ? (
            <div className={cn("rounded-[10px] px-3 py-2 text-[11.5px] font-medium", result.ok ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-500")}>
              {result.message}
            </div>
          ) : confirming ? (
            <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-border bg-card px-3 py-2">
              <span className="text-[11.5px]">
                Sync {item.responseCount} submission{item.responseCount === 1 ? "" : "s"} {mode === "new" ? <>into a new list <span className="font-semibold">{newName.trim()}</span></> : <>into <span className="font-semibold">{safeLists.find((l) => l.id === listId)?.name}</span></>}?
              </span>
              <div className="ms-auto flex items-center gap-1.5">
                <button onClick={doSync} disabled={busy} className="inline-flex items-center gap-1.5 rounded-[9px] bg-gradient-to-r from-brand-500 to-violet-500 px-2.5 py-1 text-[11.5px] font-semibold text-white disabled:opacity-60">
                  {busy ? <FlowLoader size={13} tone="white" /> : <Users className="h-3.5 w-3.5" />} Confirm sync
                </button>
                <button onClick={() => setConfirming(false)} disabled={busy} className="inline-flex items-center rounded-[9px] border border-border bg-background px-2 py-1 text-[11.5px] font-semibold disabled:opacity-60"><X className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirming(true)} disabled={!canSync} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm disabled:opacity-50">
              <Users className="h-3.5 w-3.5" /> Sync contacts
            </button>
          )}
        </>
      )}
    </div>
  );
}

// Shared CSS for the form-builder inputs/labels, reused by the field editor,
// EditPanel and CreateForm.
const BUILDER_LABEL = "block text-[11px] font-medium text-muted-foreground mb-1";
const BUILDER_INPUT = "w-full rounded-[10px] border border-border bg-card px-2.5 py-1.5 text-[12px] outline-none focus:border-brand-500/60";

function makeFieldId() { return `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; }

// Normalize editable fields → the API payload shape (trimmed labels, pruned
// empty options). Shared by EditPanel (save) and CreateForm (create).
function serializeFields(fields: EditField[]): EditField[] {
  return fields.map((f) => ({
    id: f.id,
    type: f.type,
    label: f.label.trim(),
    required: f.required,
    ...(f.placeholder ? { placeholder: f.placeholder } : {}),
    ...(OPTION_TYPES.has(f.type) ? { options: (f.options || []).filter((o) => o.trim() !== "") } : {}),
    ...(f.helpText ? { helpText: f.helpText } : {}),
  }));
}

// The reorderable field/question builder — drives editing the fields list for
// both EditPanel and CreateForm.
function FieldsEditor({ kind, fields, onChange }: { kind: Kind; fields: EditField[]; onChange: (next: EditField[]) => void }) {
  const noun = kind === "form" ? "field" : "question";
  const types = fieldTypesFor(kind);
  const [showAdd, setShowAdd] = useState(false);

  const update = (id: string, patch: Partial<EditField>) =>
    onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const remove = (id: string) => onChange(fields.filter((f) => f.id !== id));
  const move = (index: number, dir: -1 | 1) => {
    const arr = [...fields];
    const j = index + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[index], arr[j]] = [arr[j], arr[index]];
    onChange(arr);
  };
  const add = (type: string) => {
    onChange([
      ...fields,
      { id: makeFieldId(), type, label: "", required: false, placeholder: "", ...(OPTION_TYPES.has(type) ? { options: ["Option 1", "Option 2"] } : {}) },
    ]);
    setShowAdd(false);
  };

  return (
    <div>
      <p className="mb-1.5 text-[11.5px] font-semibold">{kind === "form" ? "Fields" : "Questions"}</p>
      {fields.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-border px-3 py-4 text-center text-[11.5px] text-muted-foreground">No {noun}s yet — add one below.</p>
      ) : (
        <div className="space-y-2">
          {fields.map((f, i) => (
            <div key={f.id} className="rounded-[10px] border border-border bg-card p-2.5">
              <div className="flex items-start gap-2">
                <div className="flex flex-col gap-0.5 pt-0.5">
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button onClick={() => move(i, 1)} disabled={i === fields.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <input value={f.label} onChange={(e) => update(f.id, { label: e.target.value })} className={BUILDER_INPUT} placeholder={`${kind === "form" ? "Field" : "Question"} label`} />
                  <div className="flex flex-wrap items-center gap-2">
                    <select value={f.type} onChange={(e) => {
                      const type = e.target.value;
                      update(f.id, { type, options: OPTION_TYPES.has(type) ? (f.options && f.options.length ? f.options : ["Option 1", "Option 2"]) : undefined });
                    }} className="rounded-[9px] border border-border bg-card px-2 py-1 text-[11.5px] outline-none focus:border-brand-500/60">
                      {types.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11.5px]">
                      <input type="checkbox" checked={f.required} onChange={(e) => update(f.id, { required: e.target.checked })} className="rounded" />
                      Required
                    </label>
                  </div>
                  {OPTION_TYPES.has(f.type) && (
                    <div className="space-y-1.5">
                      <span className={BUILDER_LABEL}>Options</span>
                      {(f.options || []).map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-1.5">
                          <input value={opt} onChange={(e) => {
                            const next = [...(f.options || [])]; next[oi] = e.target.value; update(f.id, { options: next });
                          }} className={BUILDER_INPUT} placeholder={`Option ${oi + 1}`} />
                          <button onClick={() => update(f.id, { options: (f.options || []).filter((_, idx) => idx !== oi) })} className="text-muted-foreground hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      ))}
                      <button onClick={() => update(f.id, { options: [...(f.options || []), `Option ${(f.options?.length || 0) + 1}`] })} className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-500 hover:underline">
                        <Plus className="h-3 w-3" /> Add option
                      </button>
                    </div>
                  )}
                </div>
                <button onClick={() => remove(f.id)} title={`Remove ${noun}`} className="shrink-0 text-muted-foreground hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="relative mt-2">
        <button onClick={() => setShowAdd((s) => !s)} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-background px-2.5 py-1.5 text-[11.5px] font-semibold hover:border-brand-500/60">
          <Plus className="h-3.5 w-3.5" /> Add {noun}
        </button>
        {showAdd && (
          <div className="absolute left-0 top-full z-10 mt-1.5 w-64 rounded-[10px] border border-border bg-card p-2 shadow-lg">
            <div className="grid grid-cols-2 gap-1">
              {types.map((t) => (
                <button key={t.value} onClick={() => add(t.value)} className="rounded-[8px] px-2 py-1.5 text-left text-[11.5px] font-medium hover:bg-muted/60">{t.label}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EditPanel({ item, onSave, onClose }: { item: Item; onSave: (it: Item, patch: { title: string; description: string; fields: EditField[]; thankYouMessage: string }) => Promise<void>; onClose: () => void }) {
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description || "");
  const [thankYou, setThankYou] = useState(item.thankYouMessage || "");
  const [fields, setFields] = useState<EditField[]>(() => item.fields.map((f) => ({ ...f, options: f.options ? [...f.options] : undefined })));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    if (!title.trim()) { setErr("Title can't be empty"); return; }
    setSaving(true); setErr(null);
    try {
      await onSave(item, {
        title: title.trim(),
        description: description.trim(),
        thankYouMessage: thankYou.trim(),
        fields: serializeFields(fields),
      });
      onClose();
    } catch (e) {
      setErr((e as Error).message || "Couldn't save changes");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 border-t border-border bg-background/50 px-3 py-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={BUILDER_LABEL}>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={BUILDER_INPUT} placeholder={`${item.kind === "form" ? "Form" : "Survey"} title`} />
        </div>
        <div>
          <label className={BUILDER_LABEL}>Description (optional)</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={BUILDER_INPUT} placeholder="Shown to respondents" />
        </div>
      </div>

      <FieldsEditor kind={item.kind} fields={fields} onChange={setFields} />

      <div>
        <label className={BUILDER_LABEL}>Thank-you message</label>
        <input value={thankYou} onChange={(e) => setThankYou(e.target.value)} className={BUILDER_INPUT} placeholder="Shown after submitting" />
      </div>

      {err && <p className="text-[11.5px] font-medium text-red-500">{err}</p>}

      <div className="flex items-center gap-2">
        <button onClick={save} disabled={saving || !title.trim()} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm disabled:opacity-60">
          {saving ? <FlowLoader size={14} tone="white" /> : <Save className="h-3.5 w-3.5" />} Save changes
        </button>
        <button onClick={onClose} disabled={saving} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-background px-3 py-1.5 text-[12px] font-semibold hover:text-foreground disabled:opacity-60">
          Cancel
        </button>
      </div>
    </div>
  );
}

// New form/survey builder — a REAL in-surface create that designs the fields
// inline and POSTs to /api/{data-forms|surveys}. An optional "draft with AI"
// hands the (genuinely generative) field design off to the agent instead.
function CreateForm({ kind, onCancel, onCreated, onDraftWithAi }: {
  kind: Kind;
  onCancel: () => void;
  onCreated: (msg: string) => void;
  onDraftWithAi?: () => void;
}) {
  const [k, setK] = useState<Kind>(kind);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thankYou, setThankYou] = useState("");
  const [fields, setFields] = useState<EditField[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const create = async () => {
    if (!title.trim()) { setErr("Give your " + k + " a title."); return; }
    setSubmitting(true); setErr(null);
    const serialized = serializeFields(fields);
    const body: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim() || undefined,
      thankYouMessage: thankYou.trim() || undefined,
      ...(k === "form" ? { fields: serialized } : { questions: serialized }),
    };
    try {
      const r = await fetch(apiBase(k), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.success) {
        const live = serialized.length > 0;
        onCreated(`“${title.trim()}” created${live ? " and live" : " as a draft"} — ${serialized.length} ${k === "form" ? "field" : "question"}${serialized.length === 1 ? "" : "s"}.`);
      } else {
        setErr(j?.error?.message || `Couldn't create the ${k}. Try again.`);
        setSubmitting(false);
      }
    } catch {
      setErr(`Couldn't create the ${k}. Try again.`);
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <button onClick={onCancel} className="grid h-8 w-8 place-items-center rounded-[9px] border border-border text-muted-foreground hover:border-brand-500/60 hover:text-foreground" aria-label="Back"><ArrowLeft className="h-4 w-4" /></button>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-bold">New {k}</h3>
          <p className="text-[11.5px] text-muted-foreground">Design the {k === "form" ? "fields" : "questions"} — it goes live the moment you add at least one, otherwise it saves as a draft.</p>
        </div>
        {onDraftWithAi && (
          <button onClick={onDraftWithAi} className="inline-flex shrink-0 items-center gap-1.5 rounded-[10px] border border-border px-2.5 py-1.5 text-[11.5px] font-semibold hover:border-brand-500/60 hover:text-foreground" title="Let the agent design the fields for you">
            <Sparkles className="h-3.5 w-3.5" /> Draft with AI
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* kind toggle */}
        <div className="flex items-center gap-1 rounded-[10px] border border-border bg-background p-0.5 w-fit">
          {(["form", "survey"] as const).map((kk) => (
            <button key={kk} onClick={() => setK(kk)} className={cn("inline-flex items-center gap-1.5 rounded-[8px] px-3 py-1 text-[11.5px] font-semibold", k === kk ? "bg-brand-500/10 text-brand-500" : "text-muted-foreground hover:text-foreground")}>
              {kk === "form" ? <FileText className="h-3.5 w-3.5" /> : <MessageSquareText className="h-3.5 w-3.5" />}
              {kk === "form" ? "Form" : "Survey"}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={BUILDER_LABEL}>Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={BUILDER_INPUT} placeholder={k === "form" ? "e.g. Contact us" : "e.g. Customer feedback"} />
          </div>
          <div>
            <label className={BUILDER_LABEL}>Description (optional)</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className={BUILDER_INPUT} placeholder="Shown to respondents" />
          </div>
        </div>

        <FieldsEditor kind={k} fields={fields} onChange={setFields} />

        <div>
          <label className={BUILDER_LABEL}>Thank-you message (optional)</label>
          <input value={thankYou} onChange={(e) => setThankYou(e.target.value)} className={BUILDER_INPUT} placeholder="Shown after submitting" />
        </div>

        {err && <p className="rounded-xl border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-[12px] text-rose-500">{err}</p>}

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <button onClick={create} disabled={submitting || !title.trim()} className="inline-flex items-center gap-1.5 rounded-[11px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30 disabled:opacity-60">
            {submitting ? <FlowLoader size={15} tone="white" /> : <Save className="h-4 w-4" />} {submitting ? "Creating…" : `Create ${k}`}
          </button>
          <button onClick={onCancel} disabled={submitting} className="inline-flex items-center gap-1.5 rounded-[11px] px-3 py-2.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-60">Cancel</button>
        </div>
      </div>
    </section>
  );
}

function SendPanel({ item, lists, emailReady, smsReady, onSend, onAsk }: {
  item: Item;
  lists: ContactList[] | null;
  emailReady: boolean;
  smsReady: boolean;
  onSend: (it: Item, channel: "email" | "sms", contactListId: string) => Promise<{ ok: boolean; message: string }>;
  onAsk?: (prompt: string) => void;
}) {
  const [channel, setChannel] = useState<"email" | "sms">(emailReady ? "email" : smsReady ? "sms" : "email");
  const [listId, setListId] = useState<string>(item.contactListId || "");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Readiness resolves after this panel mounts (the loader shows while lists is
  // null), so the initial `channel` guess can land on a disabled channel — e.g.
  // an SMS-only account defaulting to "email" leaves Send stuck disabled. Once
  // readiness is known, snap to a usable channel if the current one isn't ready.
  useEffect(() => {
    if (channel === "email" && !emailReady && smsReady) setChannel("sms");
    else if (channel === "sms" && !smsReady && emailReady) setChannel("email");
  }, [channel, emailReady, smsReady]);

  const anyChannel = emailReady || smsReady;
  const selectedList = (lists || []).find((l) => l.id === listId);
  const eligible = selectedList ? (channel === "sms" ? selectedList.smsEligibleCount : selectedList.totalCount) : 0;
  const canSend = anyChannel && !!listId && ((channel === "email" && emailReady) || (channel === "sms" && smsReady)) && item.fieldCount > 0;

  const doSend = async () => {
    setSending(true);
    const r = await onSend(item, channel, listId);
    setResult(r);
    setConfirming(false);
    setSending(false);
  };

  const labelCls = "block text-[11px] font-medium text-muted-foreground mb-1";

  if (lists === null) {
    return <div className="border-t border-border bg-background/50 px-3 py-6"><div className="grid place-items-center"><FlowLoader size={20} label="Loading send options…" /></div></div>;
  }

  return (
    <div className="space-y-3 border-t border-border bg-background/50 px-3 py-3">
      {item.fieldCount === 0 && (
        <div className="flex items-center gap-2 rounded-[10px] border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11.5px] text-amber-600">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>Add at least one {item.kind === "form" ? "field" : "question"} before sending — open Edit.</span>
        </div>
      )}

      {!anyChannel ? (
        <div className="rounded-[10px] border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-[11.5px] text-amber-600">
          <p className="font-semibold">Neither email nor SMS is set up.</p>
          {onAsk && (
            <button onClick={() => onAsk("Help me set up email and SMS marketing so I can send my forms and surveys to my contacts.")} className="mt-1.5 inline-flex items-center gap-1.5 rounded-[9px] bg-gradient-to-r from-brand-500 to-violet-500 px-2.5 py-1 text-[11.5px] font-semibold text-white">
              <Sparkles className="h-3 w-3" /> Set up sending
            </button>
          )}
        </div>
      ) : (
        <>
          <div>
            <span className={labelCls}>Channel</span>
            <div className="flex gap-2">
              <ChannelBtn active={channel === "email"} disabled={!emailReady} onClick={() => setChannel("email")} icon={Mail} label="Email" hint={emailReady ? undefined : "Not configured"} />
              <ChannelBtn active={channel === "sms"} disabled={!smsReady} onClick={() => setChannel("sms")} icon={Phone} label="SMS" hint={smsReady ? undefined : "Not configured"} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Contact list</label>
            {lists.length === 0 ? (
              <p className="rounded-[10px] border border-dashed border-border px-3 py-3 text-center text-[11.5px] text-muted-foreground">No contact lists yet. Build one in Outreach first.</p>
            ) : (
              <select value={listId} onChange={(e) => { setListId(e.target.value); setResult(null); setConfirming(false); }} className="w-full rounded-[10px] border border-border bg-card px-2.5 py-1.5 text-[12px] outline-none focus:border-brand-500/60">
                <option value="">Select a contact list…</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>{l.name} ({channel === "sms" ? `${l.smsEligibleCount} SMS-ready` : `${l.totalCount} contacts`})</option>
                ))}
              </select>
            )}
          </div>

          {selectedList && (
            <p className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
              <ListChecks className="h-3.5 w-3.5" />
              {eligible} {channel === "sms" ? "SMS-eligible" : ""} contact{eligible === 1 ? "" : "s"} in <span className="font-medium text-foreground">{selectedList.name}</span>
            </p>
          )}

          {result ? (
            <div className={cn("rounded-[10px] px-3 py-2 text-[11.5px] font-medium", result.ok ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-500")}>
              {result.message}
            </div>
          ) : confirming ? (
            <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-border bg-card px-3 py-2">
              <span className="text-[11.5px]">Send <span className="font-semibold">{item.title || "this " + item.kind}</span> to {selectedList?.name} via {channel === "email" ? "email" : "SMS"}?</span>
              <div className="ms-auto flex items-center gap-1.5">
                <button onClick={doSend} disabled={sending} className="inline-flex items-center gap-1.5 rounded-[9px] bg-gradient-to-r from-brand-500 to-violet-500 px-2.5 py-1 text-[11.5px] font-semibold text-white disabled:opacity-60">
                  {sending ? <FlowLoader size={13} tone="white" /> : <Send className="h-3.5 w-3.5" />} Confirm send
                </button>
                <button onClick={() => setConfirming(false)} disabled={sending} className="inline-flex items-center rounded-[9px] border border-border bg-background px-2 py-1 text-[11.5px] font-semibold disabled:opacity-60"><X className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirming(true)} disabled={!canSend} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm disabled:opacity-50">
              <Send className="h-3.5 w-3.5" /> Send via {channel === "email" ? "email" : "SMS"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function ChannelBtn({ active, disabled, onClick, icon: Icon, label, hint }: { active: boolean; disabled?: boolean; onClick: () => void; icon: ElementType; label: string; hint?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex flex-1 flex-col items-center gap-1 rounded-[10px] border px-3 py-2.5 text-[12px] font-semibold transition-colors",
        disabled
          ? "cursor-not-allowed border-border bg-muted/30 text-muted-foreground opacity-60"
          : active
            ? "border-brand-500/60 bg-brand-500/10 text-brand-500"
            : "border-border bg-card hover:border-brand-500/50",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
      {hint && <span className="text-[10px] font-medium text-amber-600">{hint}</span>}
    </button>
  );
}

function fmtValue(v: unknown): string {
  if (Array.isArray(v)) return v.join(", ");
  if (v && typeof v === "object") { try { return JSON.stringify(v); } catch { return "—"; } }
  return String(v);
}

function SummaryRow({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-muted/40 px-3 py-2">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-muted-foreground">{label}</p>
      <span className="shrink-0 text-[15px] font-extrabold tabular-nums">{value}</span>
    </div>
  );
}
