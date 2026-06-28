"use client";

import { useCallback, useEffect, useState, type ElementType } from "react";
import Image from "next/image";
import { Users, UserPlus, Shield, Crown, Pencil, User as UserIcon, Mail, Clock, Check, X, Trash2 } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * Teams — a deep new-design collaboration surface (the Teams workspace canvas):
 * your team's members with their role + status, plus a real inline "Invite
 * member" form (email + role → POST /api/teams/[teamId]/members) and inline
 * remove / cancel-invite controls. A click means do-it-in-the-UI, not a chat
 * prompt; the agent stays in the chat on the left. No legacy links.
 * [[surface-buttons-are-ui-actions]]
 */

interface MemberUser { id: string; name?: string | null; email?: string | null; avatarUrl?: string | null }
interface Member { id: string; role: string; joinedAt?: string; user: MemberUser }
interface Invitation { id: string; email: string; role: string; status: string; inviterName?: string; expiresAt?: string; createdAt?: string }
interface TeamSummary { id: string; name: string; slug?: string; memberCount?: number; myRole?: string | null; ownerId?: string | null }
interface TeamDetail { id: string; name: string; slug?: string; ownerId?: string | null; memberCount?: number; members: Member[] }

const FIELD = "w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60";

// Roles a manager can assign through the invite form (OWNER is reserved for the owner).
const ASSIGNABLE_ROLES = ["ADMIN", "EDITOR", "MEMBER"] as const;
type AssignRole = (typeof ASSIGNABLE_ROLES)[number];

const ROLE_META: Record<string, { label: string; icon: ElementType; tone: string }> = {
  OWNER: { label: "Owner", icon: Crown, tone: "bg-amber-500/10 text-amber-500" },
  ADMIN: { label: "Admin", icon: Shield, tone: "bg-brand-500/10 text-brand-500" },
  EDITOR: { label: "Editor", icon: Pencil, tone: "bg-violet-500/10 text-violet-500" },
  MEMBER: { label: "Member", icon: UserIcon, tone: "bg-muted text-muted-foreground" },
};
const roleMeta = (r?: string) => ROLE_META[(r || "MEMBER").toUpperCase()] ?? ROLE_META.MEMBER;

function whenLabel(iso?: string): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); } catch { return ""; }
}

export function FocusedTeams({ refreshKey }: { refreshKey?: number }) {
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [hasTeam, setHasTeam] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AssignRole>("MEMBER");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Find the user's primary team, then load its members + pending invites.
    const tj = await fetch("/api/teams").then((r) => r.json()).catch(() => null);
    const list: TeamSummary[] = Array.isArray(tj?.data) ? tj.data : [];
    const primary = list[0] ?? null;
    if (!primary) { setHasTeam(false); setTeam(null); return; }
    setHasTeam(true);
    setMyRole(primary.myRole ?? null);

    const [dj, ij] = await Promise.all([
      fetch(`/api/teams/${primary.id}`).then((r) => r.json()).catch(() => null),
      fetch(`/api/teams/${primary.id}/invitations`).then((r) => r.json()).catch(() => null),
    ]);
    if (dj?.success && dj.data) {
      const d = dj.data as TeamDetail;
      setTeam({ ...d, members: Array.isArray(d.members) ? d.members : [] });
    }
    // Invitations endpoint 403s for non-managers — treat any non-success as "none".
    setInvites(ij?.success && Array.isArray(ij.data) ? ij.data : []);
  }, []);

  useEffect(() => {
    let alive = true;
    load().finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [load, refreshKey]);

  const canManage = (myRole || "").toUpperCase() === "OWNER" || (myRole || "").toUpperCase() === "ADMIN";
  const isOwnerMe = (myRole || "").toUpperCase() === "OWNER"; // only the owner can change roles

  const changeRole = async (m: Member, newRole: string) => {
    if (!team || newRole.toUpperCase() === m.role?.toUpperCase()) return;
    setBusyId(m.id);
    try {
      const r = await fetch(`/api/teams/${team.id}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: m.user.id, role: newRole }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.success) { await load(); }
      else { setNotice(j?.error?.message || "Could not change the role."); setTimeout(() => setNotice(""), 3000); }
    } catch { /* ignore */ } finally { setBusyId(null); }
  };

  const invite = async () => {
    const e = email.trim();
    if (!e) { setError("Enter an email to invite."); return; }
    if (!team) return;
    setSaving(true); setError("");
    try {
      const r = await fetch(`/api/teams/${team.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e, role }),
      });
      const j = await r.json();
      if (r.ok && j?.success) {
        setEmail(""); setRole("MEMBER"); setInviting(false);
        setNotice(`Invitation sent to ${e}.`);
        await load();
        setTimeout(() => setNotice(""), 2500);
      } else {
        setError(j?.error?.message || "Could not send the invitation.");
      }
    } catch {
      setError("Could not send the invitation.");
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async (m: Member) => {
    if (!team) return;
    setBusyId(m.id);
    try {
      const r = await fetch(`/api/teams/${team.id}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: m.user.id }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.success) { await load(); }
      else { setNotice(j?.error?.message || "Could not remove the member."); setTimeout(() => setNotice(""), 3000); }
    } catch { /* ignore */ } finally {
      setBusyId(null);
    }
  };

  const cancelInvite = async (inv: Invitation) => {
    if (!team) return;
    setBusyId(inv.id);
    try {
      const r = await fetch(`/api/teams/${team.id}/invitations`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId: inv.id }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.success) { await load(); }
    } catch { /* ignore */ } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading your team…" /></div>;
  }

  // No team yet — read-only empty state (team creation is plan-gated / agent-driven).
  if (!hasTeam || !team) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center p-8 text-center">
        <div className="max-w-md">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/20 text-brand-500"><Users className="h-8 w-8" /></span>
          <h2 className="mt-4 text-[20px] font-extrabold">No team yet</h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">Once you create a team you can invite teammates here, set their roles, and manage who has access — all in one place.</p>
        </div>
      </div>
    );
  }

  const members = team.members;
  const owners = members.filter((m) => m.role?.toUpperCase() === "OWNER").length;
  const admins = members.filter((m) => m.role?.toUpperCase() === "ADMIN").length;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-4">
        {/* team header */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><Users className="h-5 w-5" /></span>
            <div className="min-w-0">
              <h2 className="truncate text-[16px] font-bold">{team.name}</h2>
              <p className="truncate text-[12px] text-muted-foreground">{(team.memberCount ?? members.length).toLocaleString()} {(team.memberCount ?? members.length) === 1 ? "member" : "members"}{myRole ? ` · you're ${roleMeta(myRole).label.toLowerCase()}` : ""}</p>
            </div>
            {canManage && (
              <button onClick={() => { setInviting((v) => !v); setError(""); }} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-sm">
                <UserPlus className="h-3.5 w-3.5" /> Invite member
              </button>
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi icon={Users} label="Members" value={(team.memberCount ?? members.length).toLocaleString()} />
            <Kpi icon={Crown} label="Owners" value={owners.toLocaleString()} />
            <Kpi icon={Shield} label="Admins" value={admins.toLocaleString()} />
            <Kpi icon={Clock} label="Pending" value={invites.length.toLocaleString()} />
          </div>
        </section>

        {/* members + invite */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="text-[13px] font-bold">Members</h3>
            {notice && <span className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-500"><Check className="h-3.5 w-3.5" /> {notice}</span>}
            {canManage && (
              <button onClick={() => { setInviting((v) => !v); setError(""); }} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground">
                <UserPlus className="h-3.5 w-3.5" /> Invite
              </button>
            )}
          </div>

          {/* inline invite form — clicking "Invite" opens this, not a chat prompt */}
          {canManage && inviting && (
            <div className="mb-3 rounded-xl border border-brand-500/30 bg-brand-500/5 p-3.5">
              <p className="mb-2.5 text-[12.5px] font-semibold">Invite a teammate</p>
              <div className="grid gap-2.5 sm:grid-cols-[1fr_auto]">
                <label className="block"><span className="mb-1 block text-[11px] font-medium text-muted-foreground">Email *</span><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@email.com" type="email" className={FIELD} /></label>
                <label className="block"><span className="mb-1 block text-[11px] font-medium text-muted-foreground">Role</span>
                  <select value={role} onChange={(e) => setRole(e.target.value as AssignRole)} className={cn(FIELD, "sm:w-40")}>
                    {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{roleMeta(r).label}</option>)}
                  </select>
                </label>
              </div>
              {error && <p className="mt-2 text-[12px] text-rose-500">{error}</p>}
              <div className="mt-3 flex items-center gap-2">
                <button onClick={invite} disabled={saving} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60">
                  {saving ? <FlowLoader size={15} tone="white" /> : <Mail className="h-3.5 w-3.5" />} Send invite
                </button>
                <button onClick={() => { setInviting(false); setEmail(""); setError(""); }} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3.5 py-2 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /> Cancel</button>
              </div>
            </div>
          )}

          {members.length ? (
            <div className="space-y-2">
              {members.map((m) => {
                const rm = roleMeta(m.role);
                const isOwner = m.role?.toUpperCase() === "OWNER";
                const name = m.user.name || m.user.email || "Teammate";
                return (
                  <div key={m.id} className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
                    {m.user.avatarUrl ? (
                      <Image src={m.user.avatarUrl} alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-full object-cover" unoptimized />
                    ) : (
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500/30 to-violet-500/30 text-[12px] font-bold text-brand-500">{name.slice(0, 1).toUpperCase()}</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{name}</p>
                      <p className="truncate text-[11.5px] text-muted-foreground">{m.user.email || (m.joinedAt ? `Joined ${whenLabel(m.joinedAt)}` : "")}</p>
                    </div>
                    {isOwnerMe && !isOwner ? (
                      <select value={(m.role || "MEMBER").toUpperCase()} onChange={(e) => changeRole(m, e.target.value)} disabled={busyId === m.id} title="Change role" className="shrink-0 rounded-full border border-border bg-background px-2 py-1 text-[11px] font-semibold outline-none focus:border-brand-500/60 disabled:opacity-60">
                        {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{roleMeta(r).label}</option>)}
                      </select>
                    ) : (
                      <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold", rm.tone)}><rm.icon className="h-3 w-3" /> {rm.label}</span>
                    )}
                    {canManage && !isOwner && (
                      <button onClick={() => removeMember(m)} disabled={busyId === m.id} title="Remove member" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition hover:border-rose-500/60 hover:text-rose-500 disabled:opacity-60">
                        {busyId === m.id ? <FlowLoader size={13} /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
              <p className="text-[13px] font-medium">No members yet</p>
              <p className="mt-1 text-[12px] text-muted-foreground">{canManage ? "Invite a teammate by email to get started." : "Your team has no members listed yet."}</p>
              {canManage && (
                <button onClick={() => { setInviting(true); setError(""); }} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"><UserPlus className="h-4 w-4" /> Invite a member</button>
              )}
            </div>
          )}
        </section>

        {/* pending invitations (managers only) */}
        {canManage && invites.length > 0 && (
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <h3 className="mb-3 text-[13px] font-bold">Pending invitations</h3>
            <div className="space-y-2">
              {invites.map((inv) => {
                const rm = roleMeta(inv.role);
                return (
                  <div key={inv.id} className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-3 py-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-500/10 text-amber-500"><Mail className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{inv.email}</p>
                      <p className="truncate text-[11.5px] text-muted-foreground">{inv.inviterName ? `Invited by ${inv.inviterName}` : "Invited"}{inv.expiresAt ? ` · expires ${whenLabel(inv.expiresAt)}` : ""}</p>
                    </div>
                    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold", rm.tone)}><rm.icon className="h-3 w-3" /> {rm.label}</span>
                    <button onClick={() => cancelInvite(inv)} disabled={busyId === inv.id} title="Cancel invitation" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition hover:border-rose-500/60 hover:text-rose-500 disabled:opacity-60">
                      {busyId === inv.id ? <FlowLoader size={13} /> : <X className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground"><Icon className="h-3.5 w-3.5" /><span className="text-[11px] font-medium">{label}</span></div>
      <p className="mt-1 text-[18px] font-extrabold leading-none">{value}</p>
    </div>
  );
}
