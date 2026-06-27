"use client";

import { useCallback, useEffect, useMemo, useState, type ElementType } from "react";
import { ClipboardList, FileText, MessageSquareText, Sparkles, Send, Inbox, ExternalLink, ChevronDown, ChevronRight, Power, PowerOff, Mail, Phone, User, Star, Plus } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * Forms & surveys — a deep new-design lead-capture surface (the Forms workspace
 * canvas): every data-collection form and survey with its submission + reach
 * counts, opened inline to read the actual submissions. The data actions are
 * REAL UI — Open/Close toggles a form's status (PUT /api/{data-forms|surveys}/[id]),
 * "View submissions" loads responses in place (GET …/submissions | …/responses).
 * Building a NEW form/survey is a generative job, so that one drives the agent.
 * No legacy links — only the live public page opens in a new tab.
 * [[surface-buttons-are-ui-actions]]
 */

// A form and a survey are different models but present identically here, so we
// normalize both into one shape with a `kind` discriminator.
type Kind = "form" | "survey";

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
  responseCount?: number; sendCount?: number; fields?: unknown[]; contactListName?: string | null; createdAt?: string;
}
interface RawSurvey {
  id: string; title: string; description?: string | null; slug: string; status?: string; isActive?: boolean;
  responseCount?: number; sendCount?: number; questions?: unknown[]; contactListName?: string | null; createdAt?: string;
}

function liveUrl(it: Item): string {
  return it.kind === "form" ? `/form/${it.slug}` : `/survey/${it.slug}`;
}
function apiBase(kind: Kind): string {
  return kind === "form" ? "/api/data-forms" : "/api/surveys";
}
function entriesPath(it: Item): string {
  return it.kind === "form" ? `${apiBase("form")}/${it.id}/submissions?limit=20` : `${apiBase("survey")}/${it.id}/responses?limit=20`;
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

export function FocusedForms({ refreshKey, onAsk }: { refreshKey?: number; onAsk?: (prompt: string) => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Inline "view submissions" state, keyed by item id.
  const [openId, setOpenId] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [busyToggle, setBusyToggle] = useState<string | null>(null);

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
        out.push({
          kind: "form", id: f.id, title: f.title, description: f.description, slug: f.slug,
          status: (f.status || "DRAFT").toUpperCase(), type: f.type,
          responseCount: f.responseCount ?? 0, sendCount: f.sendCount ?? 0,
          fieldCount: Array.isArray(f.fields) ? f.fields.length : 0,
          contactListName: f.contactListName, createdAt: f.createdAt,
        });
      }
    }
    if (sr?.success && Array.isArray(sr.data)) {
      for (const s of sr.data as RawSurvey[]) {
        out.push({
          kind: "survey", id: s.id, title: s.title, description: s.description, slug: s.slug,
          status: (s.status || (s.isActive ? "ACTIVE" : "DRAFT")).toUpperCase(),
          responseCount: s.responseCount ?? 0, sendCount: s.sendCount ?? 0,
          fieldCount: Array.isArray(s.questions) ? s.questions.length : 0,
          contactListName: s.contactListName, createdAt: s.createdAt,
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

  const stats = useMemo(() => {
    let submissions = 0, sent = 0, live = 0;
    for (const it of items) { submissions += it.responseCount; sent += it.sendCount; if (it.status === "ACTIVE") live++; }
    return { total: items.length, submissions, sent, live };
  }, [items]);

  const openEntries = useCallback(async (it: Item) => {
    if (openId === it.id) { setOpenId(null); return; }
    setOpenId(it.id); setEntries([]); setEntriesLoading(true);
    try {
      const j = await fetch(entriesPath(it)).then((r) => r.json());
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
    } catch { /* ignore — empty state covers it */ } finally {
      setEntriesLoading(false);
    }
  }, [openId]);

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

  const newForm = () => onAsk?.("Create a new lead-capture form to collect contact details from my audience. Suggest the right fields and a thank-you message.");

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading your forms…" /></div>;
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi icon={ClipboardList} label="Forms & surveys" value={stats.total.toLocaleString()} />
          <Kpi icon={Inbox} label="Submissions" value={stats.submissions.toLocaleString()} />
          <Kpi icon={Send} label="Sent" value={stats.sent.toLocaleString()} />
          <Kpi icon={Power} label="Live now" value={stats.live.toLocaleString()} />
        </div>

        {/* List */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="text-[13px] font-bold">Your forms & surveys</h3>
            {onAsk && (
              <button onClick={newForm} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm">
                <Sparkles className="h-3.5 w-3.5" /> New form
              </button>
            )}
          </div>

          {loadError ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
              <p className="text-[13px] font-medium">Couldn&apos;t load your forms</p>
              <p className="mt-1 text-[12px] text-muted-foreground">Something went wrong fetching them. Try again in a moment.</p>
            </div>
          ) : items.length ? (
            <div className="space-y-2.5">
              {items.map((it) => {
                const sm = STATUS_META[it.status] ?? STATUS_META.DRAFT;
                const isOpen = openId === it.id;
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
                      <button onClick={() => openEntries(it)} className="inline-flex items-center gap-1.5 rounded-[9px] border border-border bg-background px-2.5 py-1 text-[11.5px] font-semibold hover:border-brand-500/60 hover:text-foreground">
                        {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        {isOpen ? "Hide submissions" : `View submissions${it.responseCount ? ` (${it.responseCount})` : ""}`}
                      </button>
                      <a href={liveUrl(it)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-[9px] border border-border bg-background px-2.5 py-1 text-[11.5px] font-semibold hover:border-brand-500/60 hover:text-foreground">
                        <ExternalLink className="h-3.5 w-3.5" /> Open live
                      </a>
                      {it.status !== "DRAFT" && (
                        <button onClick={() => toggleStatus(it)} disabled={busyToggle === it.id} className="ms-auto inline-flex items-center gap-1.5 rounded-[9px] border border-border bg-background px-2.5 py-1 text-[11.5px] font-semibold hover:border-brand-500/60 hover:text-foreground disabled:opacity-60">
                          {busyToggle === it.id ? <FlowLoader size={13} /> : it.status === "ACTIVE" ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                          {it.status === "ACTIVE" ? "Close" : "Re-open"}
                        </button>
                      )}
                    </div>

                    {/* inline submissions */}
                    {isOpen && (
                      <div className="border-t border-border bg-background/50 px-3 py-3">
                        {entriesLoading ? (
                          <div className="grid place-items-center py-6"><FlowLoader size={22} label="Loading submissions…" /></div>
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
                        ) : (
                          <p className="py-4 text-center text-[12px] text-muted-foreground">No submissions yet — share the live link to start collecting.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/20 text-brand-500"><ClipboardList className="h-7 w-7" /></span>
              <p className="mt-3 text-[14px] font-semibold">No forms or surveys yet</p>
              <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-muted-foreground">Build a lead-capture form or a quick survey, share the link, and collect submissions — the agent designs the fields for you.</p>
              {onAsk && (
                <button onClick={newForm} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30">
                  <Plus className="h-4 w-4" /> Create a form
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function fmtValue(v: unknown): string {
  if (Array.isArray(v)) return v.join(", ");
  if (v && typeof v === "object") { try { return JSON.stringify(v); } catch { return "—"; } }
  return String(v);
}

function Kpi({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className="flex items-center gap-1.5 text-muted-foreground"><Icon className="h-4 w-4" /><span className="text-[11.5px] font-medium">{label}</span></div>
      <p className="mt-1.5 text-[22px] font-extrabold leading-none">{value}</p>
    </div>
  );
}
