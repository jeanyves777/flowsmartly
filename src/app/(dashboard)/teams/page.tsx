"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Plus,
  Search,
  FolderKanban,
  Crown,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface TeamData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatarUrl: string | null;
  ownerId: string;
  memberCount: number;
  myRole: string | null;
  createdAt: string;
}

export default function TeamsPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: "", description: "" });
  const [error, setError] = useState("");

  const fetchTeams = useCallback(async () => {
    try {
      const res = await fetch("/api/teams");
      const json = await res.json();
      if (json.success) setTeams(json.data || []);
    } catch {
      /* silent */
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  async function handleCreate() {
    if (!newTeam.name.trim()) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTeam),
      });
      const json = await res.json();
      if (json.success) {
        setShowCreate(false);
        setNewTeam({ name: "", description: "" });
        fetchTeams();
      } else {
        setError(json.error?.message || "Failed to create team");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setCreating(false);
    }
  }

  const filtered = teams.filter(
    (t) =>
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description?.toLowerCase().includes(search.toLowerCase())
  );

  const roleColors: Record<string, string> = {
    OWNER: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    ADMIN: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    EDITOR: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    MEMBER: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Teams</h1>
          <p className="text-muted-foreground text-sm">
            Collaborate with your team on projects and tasks
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" /> New Team
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-5 w-5 text-orange-500" />
            <div>
              <p className="text-xl font-bold">{teams.length}</p>
              <p className="text-xs text-muted-foreground">Total Teams</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Crown className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-xl font-bold">
                {teams.filter((t) => t.myRole === "OWNER").length}
              </p>
              <p className="text-xs text-muted-foreground">Owned by You</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <FolderKanban className="h-5 w-5 text-violet-500" />
            <div>
              <p className="text-xl font-bold">
                {teams.reduce((sum, t) => sum + t.memberCount, 0)}
              </p>
              <p className="text-xs text-muted-foreground">Total Members</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search teams..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Team List */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-full mb-4" />
                <Skeleton className="h-4 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-1">
              {search ? "No teams found" : "No teams yet"}
            </h3>
            <p className="text-muted-foreground text-sm mb-4">
              {search
                ? "Try a different search term"
                : "Create your first team to start collaborating"}
            </p>
            {!search && (
              <Button onClick={() => setShowCreate(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Create Team
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((team) => (
            <Card
              key={team.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push(`/teams/${team.id}`)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 font-bold text-lg">
                      {team.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold">{team.name}</h3>
                      {team.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {team.description}
                        </p>
                      )}
                    </div>
                  </div>
                  {team.myRole && (
                    <Badge
                      variant="secondary"
                      className={roleColors[team.myRole] || ""}
                    >
                      {team.myRole}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {team.memberCount} member{team.memberCount !== 1 ? "s" : ""}
                  </span>
                  <span>
                    Created{" "}
                    {new Date(team.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Team Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Team</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="team-name">Team Name</Label>
              <Input
                id="team-name"
                placeholder="e.g., Marketing Team"
                value={newTeam.name}
                onChange={(e) =>
                  setNewTeam((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="team-desc">Description (optional)</Label>
              <Textarea
                id="team-desc"
                placeholder="What is this team about?"
                value={newTeam.description}
                onChange={(e) =>
                  setNewTeam((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                rows={3}
              />
            </div>
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreate(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !newTeam.name.trim()}
              className="gap-2"
            >
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
