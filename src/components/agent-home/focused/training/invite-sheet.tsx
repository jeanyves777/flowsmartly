"use client";

/**
 * The invite flow, shared by the setup canvas and the live room.
 *
 * Every method is its OWN action — Public link (with an access setting, not just
 * a copy), Email invite, Calendar hold, Team chat — so the four rows never all
 * just "copy the link". [[training-studio]]
 */
import { useState } from "react";
import { Mail, Calendar, MessageSquare, Send, Link2, ChevronRight, Download } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { TrainingSessionDTO } from "@/lib/training/types";

/** A bottom sheet on a phone; a floating card, bottom-right, on a wider screen —
 *  so it never becomes an awkward full-width strip on desktop. Uses `fixed` so
 *  it works from any surface without depending on a positioned ancestor. */
export function Sheet({ title, sub, onClose, children }: { title: string; sub?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/50" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-[61] flex max-h-[86%] flex-col rounded-t-3xl border-t border-border bg-card shadow-2xl md:inset-x-auto md:bottom-4 md:right-4 md:max-h-[80vh] md:w-[400px] md:rounded-3xl md:border">
        <span className="mx-auto mt-2 h-1 w-9 rounded-full bg-border md:hidden" />
        <div className="flex items-start gap-2 px-4 pb-1 pt-2">
          <div className="flex-1">
            <h3 className="text-[15px] font-extrabold">{title}</h3>
            {sub ? <p className="mt-0.5 text-[12px] text-muted-foreground">{sub}</p> : null}
          </div>
          <button onClick={onClose} className="hidden rounded-lg px-2 py-1 text-[12px] font-bold text-muted-foreground hover:text-foreground md:block">Done</button>
        </div>
        <div className="overflow-auto px-3 pb-6 pt-1">{children}</div>
      </div>
    </>
  );
}

export function InviteSheet({ session, onClose, initialMethod = "link" }: { session: TrainingSessionDTO; onClose: () => void; initialMethod?: string }) {
  const link = session.invites.find((i) => i.isActive && !i.email);
  const url = link ? `${typeof window !== "undefined" ? window.location.origin : ""}/t/${link.token}` : "";
  const [open, setOpen] = useState<string | null>(initialMethod);
  const [copied, setCopied] = useState(false);
  const [emails, setEmails] = useState("");
  const [role, setRole] = useState<"TRAINEE" | "COHOST">("TRAINEE");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(0);
  const [access, setAccess] = useState(session.access);

  const copy = async () => { await navigator.clipboard?.writeText(url).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1600); };
  const send = async () => {
    const list = emails.split(/[\s,;]+/).map((e) => e.trim()).filter((e) => e.includes("@"));
    if (!list.length) return;
    setSending(true);
    try {
      const r = await fetch(`/api/ai/training/${session.id}/invites`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emails: list, role }) }).then((x) => x.json());
      if (r?.success) { setSent(list.length); setEmails(""); }
    } finally { setSending(false); }
  };
  const setJoinAccess = async (a: TrainingSessionDTO["access"]) => {
    setAccess(a);
    await fetch(`/api/ai/training/${session.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ access: a }) }).catch(() => {});
  };

  const Method = ({ id, Icon, name, meta, tone }: { id: string; Icon: typeof Mail; name: string; meta: string; tone: string }) => (
    <button onClick={() => setOpen((o) => (o === id ? null : id))} className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left hover:bg-muted">
      <span className={cn("grid h-[38px] w-[38px] shrink-0 place-items-center rounded-xl", tone)}><Icon className="h-4 w-4" /></span>
      <span className="flex-1"><span className="block text-[14px] font-bold">{name}</span><span className="block text-[11.5px] text-muted-foreground">{meta}</span></span>
      <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition", open === id && "rotate-90")} />
    </button>
  );
  const ACCESS: { id: TrainingSessionDTO["access"]; t: string; d: string }[] = [
    { id: "open", t: "Open link", d: "Straight into the waiting room" },
    { id: "link_email", t: "Collect email", d: "Name + email to join" },
    { id: "invite", t: "Invite only", d: "Turn the public link off" },
  ];

  return (
    <Sheet title="Invite people" sub="No account needed — guests enter their name to join the waiting room." onClose={onClose}>
      {/* Public link — with an access setting, not just a copy */}
      <Method id="link" Icon={Link2} name="Public link" meta={access === "invite" ? "Invite-only — public link off" : access === "link_email" ? "Name + email to join" : "Anyone with the link can join"} tone="bg-cyan-500/15 text-cyan-400" />
      {open === "link" ? (
        <div className="px-2 pb-2">
          <div className="mb-2 flex items-center gap-1.5 rounded-lg border border-border bg-muted px-2 py-2">
            <code className="flex-1 truncate font-mono text-[10.5px] text-muted-foreground">{url.replace(/^https?:\/\//, "") || "No public link"}</code>
            <button onClick={copy} className={cn("rounded px-2.5 py-1 text-[11px] font-bold", copied ? "bg-emerald-500/15 text-emerald-400" : "bg-brand-500/15 text-brand-400")}>{copied ? "Copied" : "Copy"}</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {ACCESS.map((a) => (
              <button key={a.id} onClick={() => void setJoinAccess(a.id)} className={cn("rounded-xl border p-2.5 text-left", access === a.id ? "border-brand-500 bg-brand-500/10" : "border-border")}>
                <span className={cn("block text-[12.5px] font-extrabold", access === a.id && "text-brand-400")}>{a.t}</span>
                <span className="block text-[10.5px] text-muted-foreground">{a.d}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Email invite */}
      <Method id="email" Icon={Mail} name="Email invite" meta="Send a branded invite with the join link" tone="bg-brand-500/15 text-brand-400" />
      {open === "email" ? (
        <div className="px-2 pb-2">
          <textarea value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="Email addresses — comma or space separated…" className="min-h-[56px] w-full resize-none rounded-xl border border-border bg-muted px-3 py-2.5 text-[13px] outline-none focus:border-brand-500" />
          <div className="mt-2 flex items-center gap-2">
            <button onClick={() => setRole("TRAINEE")} className={cn("rounded-full border px-3 py-1.5 text-[12px] font-bold", role === "TRAINEE" ? "border-brand-500 bg-brand-500/15 text-brand-400" : "border-border text-muted-foreground")}>Trainee</button>
            <button onClick={() => setRole("COHOST")} className={cn("rounded-full border px-3 py-1.5 text-[12px] font-bold", role === "COHOST" ? "border-brand-500 bg-brand-500/15 text-brand-400" : "border-border text-muted-foreground")}>Co-host</button>
            {sent ? <span className="ms-auto text-[11px] font-bold text-emerald-400">Invited {sent} ✓</span> : null}
            <button onClick={send} disabled={sending || !emails.trim()} className="ms-auto rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 px-4 py-2 text-[13px] font-extrabold text-white disabled:opacity-50">{sending ? "Sending…" : "Send invites"}</button>
          </div>
        </div>
      ) : null}

      {/* Calendar hold */}
      <Method id="cal" Icon={Calendar} name="Calendar hold" meta="Put it on their calendar with the link" tone="bg-emerald-500/15 text-emerald-400" />
      {open === "cal" ? (
        <div className="flex flex-wrap gap-2 px-3 pb-3">
          <a href={googleCalUrl(session, url)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-border bg-muted px-3.5 py-2.5 text-[13px] font-bold hover:border-brand-500"><Calendar className="h-4 w-4" /> Google</a>
          <a href={icsHref(session, url)} download="training.ics" className="inline-flex items-center gap-2 rounded-xl border border-border bg-muted px-3.5 py-2.5 text-[13px] font-bold hover:border-brand-500"><Download className="h-4 w-4" /> .ics file</a>
        </div>
      ) : null}

      {/* Team chat */}
      <Method id="chat" Icon={MessageSquare} name="Team chat" meta="Share to WhatsApp, Slack or your device" tone="bg-violet-500/15 text-violet-400" />
      {open === "chat" ? (
        <div className="flex flex-wrap gap-2 px-3 pb-3">
          <a href={`https://wa.me/?text=${encodeURIComponent(`Join my training room: ${url}`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-border bg-muted px-3.5 py-2.5 text-[13px] font-bold hover:border-brand-500"><MessageSquare className="h-4 w-4" /> WhatsApp</a>
          <button onClick={() => { const n = navigator as Navigator & { share?: (d: { title?: string; url?: string }) => Promise<void> }; n.share?.({ title: session.title, url }).catch(() => {}); }} className="inline-flex items-center gap-2 rounded-xl border border-border bg-muted px-3.5 py-2.5 text-[13px] font-bold hover:border-brand-500"><Send className="h-4 w-4" /> More…</button>
        </div>
      ) : null}
    </Sheet>
  );
}

function calTimes(session: TrainingSessionDTO) {
  const start = session.startsAt ? new Date(session.startsAt) : new Date();
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const z = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return { start: z(start), end: z(end) };
}
function googleCalUrl(session: TrainingSessionDTO, url: string) {
  const { start, end } = calTimes(session);
  const q = new URLSearchParams({ action: "TEMPLATE", text: session.title, dates: `${start}/${end}`, details: `Join the training room: ${url}` });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}
function icsHref(session: TrainingSessionDTO, url: string) {
  const { start, end } = calTimes(session);
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT", `SUMMARY:${session.title}`, `DTSTART:${start}`, `DTEND:${end}`, `DESCRIPTION:Join the training room: ${url}`, `URL:${url}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}
