"use client";

import { useCallback, useEffect, useState, type ElementType } from "react";
import Image from "next/image";
import { Users, UserPlus, Shield, Crown, Pencil, User as UserIcon, Mail, Clock, Check, X, Trash2, RefreshCw, Settings2, AlertTriangle, ListChecks, ChevronDown } from "lucide-react";
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
interface TeamDetail { id: string; name: string; slug?: string; description?: string | null; ownerId?: string | null; memberCount?: number; members: Member[] }
interface ContactList { id: string; name: string; contactCount?: number; activeCount?: number }
interface ListContact { id: string; email?: string | null }

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
  const [section, setSection] = useState<"members" | "invites">("members");

  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AssignRole>("MEMBER");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  // Edit team name/description (PATCH /api/teams/[id])
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [savingTeam, setSavingTeam] = useState(false);
  const [teamError, setTeamError] = useState("");

  // Danger zone — delete team (DELETE /api/teams/[id]), inline two-step confirm
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dangerOpen, setDangerOpen] = useState(false);

  // Bulk invite from a contact list
  const [bulkOpen, setBulkOpen] = useState(false);
  const [lists, setLists] = useState<ContactList[]>([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [selectedListId, setSelectedListId] = useState("");
  const [bulkRole, setBulkRole] = useState<AssignRole>("MEMBER");
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkError, setBulkError] = useState("");

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

  const resendInvite = async (inv: Invitation) => {
    if (!team) return;
    setBusyId(inv.id);
    try {
      const r = await fetch(`/api/teams/${team.id}/invitations`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId: inv.id }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.success) { setNotice(`Invitation re-sent to ${inv.email}.`); await load(); setTimeout(() => setNotice(""), 2500); }
      else { setNotice(j?.error?.message || "Could not resend the invitation."); setTimeout(() => setNotice(""), 3000); }
    } catch { /* ignore */ } finally { setBusyId(null); }
  };

  const openEdit = () => {
    if (!team) return;
    setEditName(team.name || "");
    setEditDesc(team.description || "");
    setTeamError("");
    setEditing(true);
  };

  const saveTeam = async () => {
    if (!team) return;
    const n = editName.trim();
    if (!n) { setTeamError("Team name can't be empty."); return; }
    setSavingTeam(true); setTeamError("");
    try {
      const r = await fetch(`/api/teams/${team.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n, description: editDesc.trim() }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.success) {
        setEditing(false);
        setNotice("Team details saved.");
        await load();
        setTimeout(() => setNotice(""), 2500);
      } else {
        setTeamError(j?.error?.message || "Could not save the team.");
      }
    } catch {
      setTeamError("Could not save the team.");
    } finally {
      setSavingTeam(false);
    }
  };

  const deleteTeam = async () => {
    if (!team) return;
    setDeleting(true);
    try {
      const r = await fetch(`/api/teams/${team.id}`, { method: "DELETE" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.success) {
        setConfirmDelete(false);
        setDangerOpen(false);
        setTeam(null);
        setHasTeam(false);
      } else {
        setNotice(j?.error?.message || "Could not delete the team.");
        setConfirmDelete(false);
        setTimeout(() => setNotice(""), 3000);
      }
    } catch {
      setNotice("Could not delete the team.");
      setConfirmDelete(false);
      setTimeout(() => setNotice(""), 3000);
    } finally {
      setDeleting(false);
    }
  };

  const openBulk = async () => {
    setBulkOpen((v) => !v);
    setBulkError("");
    if (lists.length || listsLoading) return;
    setListsLoading(true);
    try {
      const j = await fetch("/api/contact-lists").then((r) => r.json()).catch(() => null);
      const ls: ContactList[] = Array.isArray(j?.data?.lists) ? j.data.lists : [];
      setLists(ls);
    } catch { /* ignore */ } finally {
      setListsLoading(false);
    }
  };

  // Pull every contact email from the chosen list (paginated, 100/page) and bulk-invite.
  const bulkInvite = async () => {
    if (!team || !selectedListId) { setBulkError("Pick a contact list first."); return; }
    setBulkRunning(true); setBulkError("");
    try {
      const emails: string[] = [];
      let page = 1;
      let pages = 1;
      do {
        const j = await fetch(`/api/contact-lists/${selectedListId}?page=${page}&limit=100`).then((r) => r.json()).catch(() => null);
        const contacts: ListContact[] = Array.isArray(j?.data?.contacts) ? j.data.contacts : [];
        for (const c of contacts) { const e = (c.email || "").trim(); if (e) emails.push(e); }
        pages = Number(j?.data?.pagination?.pages) || 1;
        page += 1;
      } while (page <= pages && page <= 20); // safety cap: up to 2,000 contacts
      const unique = [...new Set(emails.map((e) => e.toLowerCase()))];
      if (unique.length === 0) { setBulkError("That list has no contacts with an email address."); setBulkRunning(false); return; }

      const r = await fetch(`/api/teams/${team.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: unique, role: bulkRole }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.success) {
        const sent = Number(j?.data?.sent) || 0;
        const skipped = Number(j?.data?.skipped) || 0;
        setBulkOpen(false);
        setSelectedListId("");
        setBulkRole("MEMBER");
        setNotice(`Invited ${sent} teammate${sent === 1 ? "" : "s"}${skipped ? ` · ${skipped} skipped` : ""}.`);
        await load();
        setTimeout(() => setNotice(""), 3500);
      } else {
        setBulkError(j?.error?.message || "Could not send the invitations.");
      }
    } catch {
      setBulkError("Could not send the invitations.");
    } finally {
      setBulkRunning(false);
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
  const memberTotal = team.memberCount ?? members.length;

  const sectionsWithInvites = canManage && invites.length > 0;
  const activeSection = sectionsWithInvites ? section : "members";

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start">
        {/* LEFT: sticky team identity + summary + section nav + primary action */}
        <aside className="space-y-3 lg:sticky lg:top-0 lg:w-[280px] lg:shrink-0">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start gap-2.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><Users className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[15px] font-bold">{team.name}</h2>
                <p className="truncate text-[11.5px] text-muted-foreground">{myRole ? `You're ${roleMeta(myRole).label.toLowerCase()}` : "Team"}</p>
              </div>
              {isOwnerMe && (
                <button onClick={() => { editing ? setEditing(false) : openEdit(); }} title="Edit team" className={cn("inline-flex shrink-0 items-center gap-1 rounded-[9px] border px-2 py-1 text-[11px] font-semibold transition-colors", editing ? "border-brand-500/60 text-brand-500" : "border-border text-muted-foreground hover:border-brand-500/60 hover:text-foreground")}>
                  <Settings2 className="h-3 w-3" /> {editing ? "Close" : "Edit"}
                </button>
              )}
            </div>

            {team.description && (
              <p className="mt-2.5 line-clamp-3 text-[11.5px] leading-relaxed text-muted-foreground">{team.description}</p>
            )}

            <div className="mt-3 space-y-1.5">
              <SummaryStat icon={Users} label="Members" value={memberTotal.toLocaleString()} />
              <SummaryStat icon={Clock} label="Pending invites" value={invites.length.toLocaleString()} />
              <SummaryStat icon={Shield} label="Seats used" value={memberTotal.toLocaleString()} />
            </div>
          </div>

          {/* inline edit team form (owner only) */}
          {isOwnerMe && editing && (
            <div className="rounded-2xl border border-brand-500/30 bg-brand-500/5 p-3.5">
              <p className="mb-2.5 text-[12.5px] font-semibold">Team details</p>
              <div className="space-y-2.5">
                <label className="block"><span className="mb-1 block text-[11px] font-medium text-muted-foreground">Name *</span><input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Team name" className={FIELD} /></label>
                <label className="block"><span className="mb-1 block text-[11px] font-medium text-muted-foreground">Description</span><textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="What does this team work on?" rows={2} className={cn(FIELD, "resize-none")} /></label>
              </div>
              {teamError && <p className="mt-2 text-[12px] text-rose-500">{teamError}</p>}
              <div className="mt-3 flex items-center gap-2">
                <button onClick={saveTeam} disabled={savingTeam} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60">
                  {savingTeam ? <FlowLoader size={15} tone="white" /> : <Check className="h-3.5 w-3.5" />} Save
                </button>
                <button onClick={() => { setEditing(false); setTeamError(""); }} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3.5 py-2 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /> Cancel</button>
              </div>
            </div>
          )}

          {/* section nav (only when there are pending invites to switch to) */}
          {sectionsWithInvites && (
            <nav className="rounded-2xl border border-border bg-card p-1.5">
              {([
                { id: "members" as const, label: "Members", icon: Users, count: members.length },
                { id: "invites" as const, label: "Pending invites", icon: Mail, count: invites.length },
              ]).map((n) => {
                const active = activeSection === n.id;
                return (
                  <button
                    key={n.id}
                    onClick={() => setSection(n.id)}
                    className={cn("flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-colors", active ? "bg-brand-500/10 text-brand-500" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")}
                  >
                    <n.icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-start">{n.label}</span>
                    {n.count > 0 && (
                      <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums", active ? "bg-brand-500/15 text-brand-500" : "bg-muted text-muted-foreground")}>{n.count}</span>
                    )}
                  </button>
                );
              })}
            </nav>
          )}

          {/* primary action */}
          {canManage && (
            <div className="space-y-2">
              <button onClick={() => { setInviting(true); setSection("members"); setError(""); }} className="inline-flex w-full items-center justify-center gap-1.5 rounded-[12px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30">
                <UserPlus className="h-4 w-4" /> Invite member
              </button>
              <button onClick={() => { openBulk(); setSection("members"); }} className="inline-flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-border px-3 py-2 text-[12.5px] font-semibold hover:border-brand-500/60 hover:text-foreground">
                <ListChecks className="h-3.5 w-3.5" /> Invite from list
              </button>
            </div>
          )}
        </aside>

        {/* RIGHT: members / invites lists, full width */}
        <div className="min-w-0 flex-1 space-y-4">
          {notice && (
            <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3.5 py-2 text-[12px] font-medium text-emerald-600 dark:text-emerald-400">
              <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5" /> {notice}</span>
            </p>
          )}

          {activeSection === "members" ? (
            <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h3 className="text-[13px] font-bold">Members</h3>
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{members.length}</span>
                {canManage && (
                  <button onClick={() => { setInviting((v) => !v); setError(""); }} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground">
                    <UserPlus className="h-3.5 w-3.5" /> Invite
                  </button>
                )}
              </div>

              {/* bulk invite from a contact list */}
              {canManage && bulkOpen && (
                <div className="mb-3 rounded-xl border border-brand-500/30 bg-brand-500/5 p-3.5">
                  <p className="mb-1 text-[12.5px] font-semibold">Invite everyone in a contact list</p>
                  <p className="mb-2.5 text-[11.5px] text-muted-foreground">We&apos;ll email an invite to every contact with an address. Existing members and people already invited are skipped automatically.</p>
                  {listsLoading ? (
                    <div className="flex items-center gap-2 py-2 text-[12px] text-muted-foreground"><FlowLoader size={15} /> Loading your contact lists…</div>
                  ) : lists.length === 0 ? (
                    <p className="py-2 text-[12px] text-muted-foreground">No contact lists found yet. Create a list of contacts first, then come back to bulk-invite them.</p>
                  ) : (
                    <>
                      <div className="grid gap-2.5 sm:grid-cols-[1fr_auto]">
                        <label className="block"><span className="mb-1 block text-[11px] font-medium text-muted-foreground">Contact list *</span>
                          <div className="relative">
                            <select value={selectedListId} onChange={(e) => setSelectedListId(e.target.value)} className={cn(FIELD, "appearance-none pr-8")}>
                              <option value="">Choose a list…</option>
                              {lists.map((l) => <option key={l.id} value={l.id}>{l.name}{typeof l.contactCount === "number" ? ` (${l.contactCount})` : ""}</option>)}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                          </div>
                        </label>
                        <label className="block"><span className="mb-1 block text-[11px] font-medium text-muted-foreground">Role</span>
                          <select value={bulkRole} onChange={(e) => setBulkRole(e.target.value as AssignRole)} className={cn(FIELD, "sm:w-40")}>
                            {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{roleMeta(r).label}</option>)}
                          </select>
                        </label>
                      </div>
                      {bulkError && <p className="mt-2 text-[12px] text-rose-500">{bulkError}</p>}
                      <div className="mt-3 flex items-center gap-2">
                        <button onClick={bulkInvite} disabled={bulkRunning || !selectedListId} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60">
                          {bulkRunning ? <FlowLoader size={15} tone="white" /> : <Mail className="h-3.5 w-3.5" />} Invite the list
                        </button>
                        <button onClick={() => { setBulkOpen(false); setBulkError(""); }} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3.5 py-2 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /> Cancel</button>
                      </div>
                    </>
                  )}
                </div>
              )}

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
          ) : (
            /* pending invitations (managers only) */
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
                      <button onClick={() => resendInvite(inv)} disabled={busyId === inv.id} title="Resend invitation" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition hover:border-brand-500/60 hover:text-brand-500 disabled:opacity-60">
                        {busyId === inv.id ? <FlowLoader size={13} /> : <RefreshCw className="h-3.5 w-3.5" />}
                      </button>
                      <button onClick={() => cancelInvite(inv)} disabled={busyId === inv.id} title="Cancel invitation" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition hover:border-rose-500/60 hover:text-rose-500 disabled:opacity-60">
                        {busyId === inv.id ? <FlowLoader size={13} /> : <X className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* danger zone — owner only */}
          {isOwnerMe && (
            <section className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 sm:p-5">
              <button onClick={() => { setDangerOpen((v) => !v); setConfirmDelete(false); }} className="flex w-full items-center gap-2 text-left">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-rose-500/10 text-rose-500"><AlertTriangle className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold text-rose-500">Danger zone</span>
                  <span className="block truncate text-[11.5px] text-muted-foreground">Permanently delete this team and remove every member.</span>
                </span>
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition", dangerOpen && "rotate-180")} />
              </button>
              {dangerOpen && (
                <div className="mt-3 rounded-xl border border-rose-500/30 bg-card p-3.5">
                  <p className="text-[12.5px] font-semibold">Delete {team.name}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">This can&apos;t be undone. All members lose access to this team and its shared work. Pending invitations are voided.</p>
                  {!confirmDelete ? (
                    <button onClick={() => setConfirmDelete(true)} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] border border-rose-500/40 px-3.5 py-2 text-[12.5px] font-semibold text-rose-500 transition hover:bg-rose-500/10">
                      <Trash2 className="h-3.5 w-3.5" /> Delete this team
                    </button>
                  ) : (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="text-[12px] font-medium text-rose-500">Are you sure? This is permanent.</span>
                      <button onClick={deleteTeam} disabled={deleting} className="inline-flex items-center gap-1.5 rounded-[10px] bg-rose-500 px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60">
                        {deleting ? <FlowLoader size={15} tone="white" /> : <Trash2 className="h-3.5 w-3.5" />} Yes, delete
                      </button>
                      <button onClick={() => setConfirmDelete(false)} disabled={deleting} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3.5 py-2 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-60"><X className="h-3.5 w-3.5" /> Cancel</button>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryStat({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-muted/40 px-3 py-2">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-muted-foreground">{label}</span>
      <span className="shrink-0 text-[15px] font-extrabold tabular-nums">{value}</span>
    </div>
  );
}
