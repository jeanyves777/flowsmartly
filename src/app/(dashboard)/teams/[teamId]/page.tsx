"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  FolderKanban,
  Settings,
  Plus,
  Mail,
  Crown,
  Shield,
  Pencil,
  UserMinus,
  Loader2,
  ArrowLeft,
  Trash2,
  CheckCircle2,
  Clock,
  CalendarDays,
  MoreVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import Link from "next/link";

interface TeamMember {
  id: string;
  role: string;
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
}

interface ProjectData {
  id: string;
  name: string;
  description: string | null;
  status: string;
  deadline: string | null;
  totalTasks: number;
  completedTasks: number;
  createdAt: string;
  updatedAt: string;
}

interface InvitationData {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
}

interface TeamDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatarUrl: string | null;
  ownerId: string;
  memberCount: number;
  members: TeamMember[];
  createdAt: string;
  updatedAt: string;
}

const TABS = ["overview", "projects", "members", "settings"] as const;
type Tab = (typeof TABS)[number];

const roleColors: Record<string, string> = {
  OWNER: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  ADMIN: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  EDITOR: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  MEMBER: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
};

const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  COMPLETED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  ARCHIVED: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
};

export default function TeamDetailPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = use(params);
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [invitations, setInvitations] = useState<InvitationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRole, setMyRole] = useState<string | null>(null);

  // Invite dialog
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");

  // Project creation dialog
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProject, setNewProject] = useState({ name: "", description: "", deadline: "" });
  const [creatingProject, setCreatingProject] = useState(false);
  const [projectError, setProjectError] = useState("");

  // Settings
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [showDeleteTeam, setShowDeleteTeam] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Role change
  const [roleChange, setRoleChange] = useState<{ userId: string; role: string } | null>(null);

  // Remove member
  const [removeMember, setRemoveMember] = useState<{ userId: string; name: string } | null>(null);

  const fetchTeam = useCallback(async () => {
    try {
      const res = await fetch(`/api/teams/${teamId}`);
      const json = await res.json();
      if (json.success) {
        setTeam(json.data);
        setEditName(json.data.name);
        setEditDesc(json.data.description || "");
        // Find my role
        const me = json.data.members?.find(
          (m: TeamMember) => m.user.id === json.data.ownerId
        );
        // We need the current user's role — find from members
        // Use a separate approach: check all members
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  const fetchMyRole = useCallback(async () => {
    try {
      const res = await fetch("/api/teams");
      const json = await res.json();
      if (json.success) {
        const myTeam = json.data?.find((t: { id: string }) => t.id === teamId);
        if (myTeam) setMyRole(myTeam.myRole);
      }
    } catch {
      /* silent */
    }
  }, [teamId]);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch(`/api/teams/${teamId}/projects`);
      const json = await res.json();
      if (json.success) setProjects(json.data || []);
    } catch {
      /* silent */
    }
  }, [teamId]);

  const fetchInvitations = useCallback(async () => {
    try {
      const res = await fetch(`/api/teams/${teamId}/invitations`);
      const json = await res.json();
      if (json.success) setInvitations(json.data || []);
    } catch {
      /* silent */
    }
  }, [teamId]);

  useEffect(() => {
    fetchTeam();
    fetchMyRole();
    fetchProjects();
    fetchInvitations();
  }, [fetchTeam, fetchMyRole, fetchProjects, fetchInvitations]);

  const isAdmin = myRole === "OWNER" || myRole === "ADMIN";

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError("");
    try {
      const res = await fetch(`/api/teams/${teamId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const json = await res.json();
      if (json.success) {
        setShowInvite(false);
        setInviteEmail("");
        setInviteRole("MEMBER");
        fetchInvitations();
        fetchTeam();
      } else {
        setInviteError(json.error?.message || "Failed to invite");
      }
    } catch {
      setInviteError("Something went wrong");
    } finally {
      setInviting(false);
    }
  }

  async function handleCreateProject() {
    if (!newProject.name.trim()) return;
    setCreatingProject(true);
    setProjectError("");
    try {
      const res = await fetch(`/api/teams/${teamId}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProject.name.trim(),
          description: newProject.description.trim() || undefined,
          deadline: newProject.deadline || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowNewProject(false);
        setNewProject({ name: "", description: "", deadline: "" });
        fetchProjects();
      } else {
        setProjectError(json.error?.message || "Failed to create project");
      }
    } catch {
      setProjectError("Something went wrong");
    } finally {
      setCreatingProject(false);
    }
  }

  async function handleUpdateTeam() {
    setSaving(true);
    try {
      const res = await fetch(`/api/teams/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), description: editDesc.trim() || null }),
      });
      const json = await res.json();
      if (json.success) fetchTeam();
    } catch {
      /* silent */
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTeam() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/teams/${teamId}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) router.push("/teams");
    } catch {
      /* silent */
    } finally {
      setDeleting(false);
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    try {
      await fetch(`/api/teams/${teamId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });
      fetchTeam();
    } catch {
      /* silent */
    }
    setRoleChange(null);
  }

  async function handleRemoveMember(userId: string) {
    try {
      await fetch(`/api/teams/${teamId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      fetchTeam();
    } catch {
      /* silent */
    }
    setRemoveMember(null);
  }

  async function handleCancelInvitation(invitationId: string) {
    try {
      await fetch(`/api/teams/${teamId}/invitations`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId }),
      });
      fetchInvitations();
    } catch {
      /* silent */
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Team not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/teams")}>
          Back to Teams
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/teams")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 font-bold text-lg">
              {team.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{team.name}</h1>
              {team.description && (
                <p className="text-sm text-muted-foreground">{team.description}</p>
              )}
            </div>
          </div>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowInvite(true)} className="gap-2">
            <Mail className="h-4 w-4" /> Invite Member
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-orange-500 text-orange-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "overview" && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Team Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Members</span>
                <span className="font-medium">{team.memberCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Projects</span>
                <span className="font-medium">{projects.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Active Projects</span>
                <span className="font-medium">
                  {projects.filter((p) => p.status === "ACTIVE").length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Your Role</span>
                <Badge variant="secondary" className={roleColors[myRole || ""] || ""}>
                  {myRole || "N/A"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{new Date(team.createdAt).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Projects</CardTitle>
            </CardHeader>
            <CardContent>
              {projects.length === 0 ? (
                <p className="text-sm text-muted-foreground">No projects yet</p>
              ) : (
                <div className="space-y-3">
                  {projects.slice(0, 5).map((p) => (
                    <Link
                      key={p.id}
                      href={`/teams/${teamId}/projects/${p.id}`}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-accent transition-colors"
                    >
                      <div>
                        <p className="font-medium text-sm">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.completedTasks}/{p.totalTasks} tasks
                        </p>
                      </div>
                      <Badge variant="secondary" className={statusColors[p.status] || ""}>
                        {p.status}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Members</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {team.members.slice(0, 6).map((m) => (
                  <div key={m.id} className="flex items-center gap-3 p-2">
                    <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-sm font-medium">
                      {m.user.avatarUrl ? (
                        <img
                          src={m.user.avatarUrl}
                          alt={m.user.name}
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        m.user.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.user.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.user.email}</p>
                    </div>
                    <Badge variant="secondary" className={`text-xs ${roleColors[m.role] || ""}`}>
                      {m.role}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "projects" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Projects</h2>
            {isAdmin && (
              <Button onClick={() => setShowNewProject(true)} size="sm" className="gap-2">
                <Plus className="h-4 w-4" /> New Project
              </Button>
            )}
          </div>

          {projects.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <FolderKanban className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-1">No projects yet</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Create your first project to start managing tasks
                </p>
                {isAdmin && (
                  <Button onClick={() => setShowNewProject(true)} className="gap-2">
                    <Plus className="h-4 w-4" /> Create Project
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {projects.map((project) => {
                const progress =
                  project.totalTasks > 0
                    ? Math.round((project.completedTasks / project.totalTasks) * 100)
                    : 0;
                return (
                  <Card
                    key={project.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() =>
                      router.push(`/teams/${teamId}/projects/${project.id}`)
                    }
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold">{project.name}</h3>
                          {project.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                              {project.description}
                            </p>
                          )}
                        </div>
                        <Badge
                          variant="secondary"
                          className={statusColors[project.status] || ""}
                        >
                          {project.status}
                        </Badge>
                      </div>

                      {/* Progress bar */}
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>
                            {project.completedTasks}/{project.totalTasks} tasks
                          </span>
                          <span>{progress}%</span>
                        </div>
                        <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-orange-500 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {project.deadline && (
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {new Date(project.deadline).toLocaleDateString()}
                          </span>
                        )}
                        <span>
                          Updated{" "}
                          {new Date(project.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "members" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">
              Members ({team.memberCount})
            </h2>
            {isAdmin && (
              <Button onClick={() => setShowInvite(true)} size="sm" className="gap-2">
                <Mail className="h-4 w-4" /> Invite
              </Button>
            )}
          </div>

          {/* Member List */}
          <Card>
            <CardContent className="p-0 divide-y">
              {team.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-4 p-4"
                >
                  <div className="h-10 w-10 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-sm font-medium shrink-0">
                    {member.user.avatarUrl ? (
                      <img
                        src={member.user.avatarUrl}
                        alt={member.user.name}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      member.user.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{member.user.name}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {member.user.email}
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={roleColors[member.role] || ""}
                  >
                    {member.role === "OWNER" && <Crown className="h-3 w-3 mr-1" />}
                    {member.role === "ADMIN" && <Shield className="h-3 w-3 mr-1" />}
                    {member.role}
                  </Badge>
                  {myRole === "OWNER" && member.role !== "OWNER" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            setRoleChange({
                              userId: member.user.id,
                              role: member.role,
                            })
                          }
                        >
                          <Pencil className="h-4 w-4 mr-2" /> Change Role
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() =>
                            setRemoveMember({
                              userId: member.user.id,
                              name: member.user.name,
                            })
                          }
                        >
                          <UserMinus className="h-4 w-4 mr-2" /> Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Pending Invitations */}
          {isAdmin && invitations.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Pending Invitations
              </h3>
              <Card>
                <CardContent className="p-0 divide-y">
                  {invitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center gap-4 p-4"
                    >
                      <div className="h-10 w-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{inv.email}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Expires {new Date(inv.expiresAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant="secondary">{inv.role}</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600"
                        onClick={() => handleCancelInvitation(inv.id)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {tab === "settings" && (
        <div className="space-y-6 max-w-2xl">
          {isAdmin ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Team Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Team Name</Label>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <Button
                    onClick={handleUpdateTeam}
                    disabled={saving}
                    className="gap-2"
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save Changes
                  </Button>
                </CardContent>
              </Card>

              {myRole === "OWNER" && (
                <Card className="border-red-200 dark:border-red-900/50">
                  <CardHeader>
                    <CardTitle className="text-base text-red-600">
                      Danger Zone
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Deleting the team will remove all projects, tasks, and
                      member associations. This action cannot be undone.
                    </p>
                    <Button
                      variant="destructive"
                      onClick={() => setShowDeleteTeam(true)}
                      className="gap-2"
                    >
                      <Trash2 className="h-4 w-4" /> Delete Team
                    </Button>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Settings className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-muted-foreground">
                  Only team admins can modify settings
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Invite Dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MEMBER">Member - View and comment</SelectItem>
                  <SelectItem value="EDITOR">Editor - Create and edit tasks</SelectItem>
                  <SelectItem value="ADMIN">Admin - Full project management</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {inviteError && (
              <p className="text-sm text-red-500">{inviteError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvite(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleInvite}
              disabled={inviting || !inviteEmail.trim()}
              className="gap-2"
            >
              {inviting && <Loader2 className="h-4 w-4 animate-spin" />}
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Project Dialog */}
      <Dialog open={showNewProject} onOpenChange={setShowNewProject}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Project Name</Label>
              <Input
                placeholder="e.g., Q1 Campaign"
                value={newProject.name}
                onChange={(e) =>
                  setNewProject((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                placeholder="What is this project about?"
                value={newProject.description}
                onChange={(e) =>
                  setNewProject((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Deadline (optional)</Label>
              <Input
                type="date"
                value={newProject.deadline}
                onChange={(e) =>
                  setNewProject((prev) => ({
                    ...prev,
                    deadline: e.target.value,
                  }))
                }
              />
            </div>
            {projectError && (
              <p className="text-sm text-red-500">{projectError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNewProject(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateProject}
              disabled={creatingProject || !newProject.name.trim()}
              className="gap-2"
            >
              {creatingProject && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Change Dialog */}
      {roleChange && (
        <Dialog open onOpenChange={() => setRoleChange(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change Member Role</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Select
                value={roleChange.role}
                onValueChange={(val) =>
                  setRoleChange((prev) => prev && { ...prev, role: val })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MEMBER">Member</SelectItem>
                  <SelectItem value="EDITOR">Editor</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRoleChange(null)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  handleRoleChange(roleChange.userId, roleChange.role)
                }
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Remove Member Confirm */}
      <AlertDialog
        open={!!removeMember}
        onOpenChange={() => setRemoveMember(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {removeMember?.name} from the
              team? They will lose access to all team projects and tasks.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() =>
                removeMember && handleRemoveMember(removeMember.userId)
              }
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Team Confirm */}
      <AlertDialog
        open={showDeleteTeam}
        onOpenChange={setShowDeleteTeam}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{team.name}&quot; and all its
              projects, tasks, and data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDeleteTeam}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete Team"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
