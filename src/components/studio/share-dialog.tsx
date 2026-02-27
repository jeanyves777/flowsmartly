"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Share2,
  Link2,
  Users,
  Clock,
  Copy,
  Check,
  Trash2,
  Plus,
  Loader2,
  Eye,
  Pencil,
  Files,
  X,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useCanvasStore } from "./hooks/use-canvas-store";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Types ────────────────────────────────────────────────────────

interface ShareLink {
  id: string;
  token: string;
  permission: string;
  label: string | null;
  expiresAt: string | null;
  maxUses: number | null;
  useCount: number;
  isActive: boolean;
  createdAt: string;
}

interface Collaborator {
  id: string;
  userId: string;
  role: string;
  status: string;
  acceptedAt: string | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string; avatarUrl: string | null };
}

interface Activity {
  id: string;
  action: string;
  details: Record<string, unknown>;
  createdAt: string;
  user: { id: string; name: string | null; avatarUrl: string | null };
}

const PERMISSION_ICONS: Record<string, typeof Eye> = {
  VIEW: Eye,
  EDIT: Pencil,
  COPY: Files,
};

const PERMISSION_LABELS: Record<string, string> = {
  VIEW: "View only",
  EDIT: "Can edit",
  COPY: "Get a copy",
};

// ─── Component ────────────────────────────────────────────────────

export function ShareDialog({ open, onOpenChange }: ShareDialogProps) {
  const designId = useCanvasStore((s) => s.designId);
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("link");

  // ─── Share Links State ──────────────────────────────────────────
  const [shares, setShares] = useState<ShareLink[]>([]);
  const [isLoadingShares, setIsLoadingShares] = useState(false);
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [newPermission, setNewPermission] = useState<string>("VIEW");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // ─── Collaborators State ────────────────────────────────────────
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isLoadingCollabs, setIsLoadingCollabs] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("VIEWER");
  const [isInviting, setIsInviting] = useState(false);

  // ─── Activity State ─────────────────────────────────────────────
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);

  // ─── Fetch Helpers ──────────────────────────────────────────────

  const fetchShares = useCallback(async () => {
    if (!designId) return;
    setIsLoadingShares(true);
    try {
      const res = await fetch(`/api/designs/${designId}/share`);
      const data = await res.json();
      if (data.success) setShares(data.data.shares);
    } catch { /* */ } finally {
      setIsLoadingShares(false);
    }
  }, [designId]);

  const fetchCollaborators = useCallback(async () => {
    if (!designId) return;
    setIsLoadingCollabs(true);
    try {
      const res = await fetch(`/api/designs/${designId}/collaborators`);
      const data = await res.json();
      if (data.success) setCollaborators(data.data.collaborators);
    } catch { /* */ } finally {
      setIsLoadingCollabs(false);
    }
  }, [designId]);

  const fetchActivity = useCallback(async () => {
    if (!designId) return;
    setIsLoadingActivity(true);
    try {
      const res = await fetch(`/api/designs/${designId}/activity?limit=30`);
      const data = await res.json();
      if (data.success) setActivities(data.data.activities);
    } catch { /* */ } finally {
      setIsLoadingActivity(false);
    }
  }, [designId]);

  // Load data when tab changes
  useEffect(() => {
    if (!open || !designId) return;
    if (activeTab === "link") fetchShares();
    else if (activeTab === "invite") fetchCollaborators();
    else if (activeTab === "activity") fetchActivity();
  }, [open, activeTab, designId, fetchShares, fetchCollaborators, fetchActivity]);

  // ─── Share Link Actions ─────────────────────────────────────────

  const createShareLink = async () => {
    if (!designId || isCreatingShare) return;
    setIsCreatingShare(true);
    try {
      const res = await fetch(`/api/designs/${designId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permission: newPermission }),
      });
      const data = await res.json();
      if (data.success) {
        setShares((prev) => [data.data.share, ...prev]);
        toast({ title: "Share link created" });
      } else {
        toast({ title: "Failed", description: data.error?.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error creating link", variant: "destructive" });
    } finally {
      setIsCreatingShare(false);
    }
  };

  const revokeShareLink = async (shareId: string) => {
    if (!designId) return;
    try {
      const res = await fetch(`/api/designs/${designId}/share?shareId=${shareId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setShares((prev) => prev.filter((s) => s.id !== shareId));
        toast({ title: "Link revoked" });
      }
    } catch { /* */ }
  };

  const copyShareUrl = (token: string) => {
    const url = `${window.location.origin}/design/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  // ─── Collaborator Actions ───────────────────────────────────────

  const inviteCollaborator = async () => {
    if (!designId || !inviteEmail.trim() || isInviting) return;
    setIsInviting(true);
    try {
      const res = await fetch(`/api/designs/${designId}/collaborators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json();
      if (data.success) {
        setInviteEmail("");
        fetchCollaborators();
        toast({ title: "Invitation sent" });
      } else {
        toast({ title: "Failed", description: data.error?.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error inviting", variant: "destructive" });
    } finally {
      setIsInviting(false);
    }
  };

  const removeCollaborator = async (collaboratorId: string) => {
    if (!designId) return;
    try {
      const res = await fetch(`/api/designs/${designId}/collaborators?collaboratorId=${collaboratorId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setCollaborators((prev) => prev.filter((c) => c.id !== collaboratorId));
        toast({ title: "Collaborator removed" });
      }
    } catch { /* */ }
  };

  // ─── Render ─────────────────────────────────────────────────────

  // Design must be saved first
  const needsSave = !designId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center">
              <Share2 className="w-4 h-4 text-white" />
            </div>
            Share Design
          </DialogTitle>
        </DialogHeader>

        {needsSave ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">Save your design first to enable sharing.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.dispatchEvent(new CustomEvent("studio:save"))}
            >
              Save Now
            </Button>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full">
              <TabsTrigger value="link" className="flex-1 gap-1.5 text-xs">
                <Link2 className="w-3.5 h-3.5" />
                Share Link
              </TabsTrigger>
              <TabsTrigger value="invite" className="flex-1 gap-1.5 text-xs">
                <Users className="w-3.5 h-3.5" />
                Invite
              </TabsTrigger>
              <TabsTrigger value="activity" className="flex-1 gap-1.5 text-xs">
                <Clock className="w-3.5 h-3.5" />
                Activity
              </TabsTrigger>
            </TabsList>

            {/* ─── Share Link Tab ─── */}
            <TabsContent value="link" className="space-y-4">
              {/* Create new link */}
              <div className="flex items-center gap-2">
                <Select value={newPermission} onValueChange={setNewPermission}>
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VIEW">View only</SelectItem>
                    <SelectItem value="EDIT">Can edit</SelectItem>
                    <SelectItem value="COPY">Get a copy</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={createShareLink}
                  disabled={isCreatingShare}
                  size="sm"
                  className="gap-1.5"
                >
                  {isCreatingShare ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  Create Link
                </Button>
              </div>

              {/* Links list */}
              {isLoadingShares ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : shares.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  No share links yet. Create one above.
                </p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {shares.map((share) => {
                    const PermIcon = PERMISSION_ICONS[share.permission] || Eye;
                    return (
                      <div
                        key={share.id}
                        className="flex items-center gap-2 p-2.5 rounded-lg border bg-muted/30 group"
                      >
                        <PermIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="secondary" className="text-[10px] px-1.5">
                              {PERMISSION_LABELS[share.permission]}
                            </Badge>
                            {share.label && (
                              <span className="text-xs text-muted-foreground truncate">{share.label}</span>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {share.useCount} view{share.useCount !== 1 ? "s" : ""}
                            {share.expiresAt && ` · Expires ${new Date(share.expiresAt).toLocaleDateString()}`}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => copyShareUrl(share.token)}
                        >
                          {copiedToken === share.token ? (
                            <Check className="w-3.5 h-3.5 text-green-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100"
                          onClick={() => revokeShareLink(share.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* ─── Invite Tab ─── */}
            <TabsContent value="invite" className="space-y-4">
              {/* Invite form */}
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  placeholder="Email address"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && inviteCollaborator()}
                  className="flex-1 h-9 px-3 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                />
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger className="w-[110px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VIEWER">Viewer</SelectItem>
                    <SelectItem value="EDITOR">Editor</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={inviteCollaborator}
                  disabled={isInviting || !inviteEmail.trim()}
                  size="sm"
                  className="gap-1.5"
                >
                  {isInviting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <UserPlus className="w-3.5 h-3.5" />
                  )}
                  Invite
                </Button>
              </div>

              {/* Collaborators list */}
              {isLoadingCollabs ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : collaborators.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  No collaborators yet. Invite someone above.
                </p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {collaborators.map((collab) => (
                    <div
                      key={collab.id}
                      className="flex items-center gap-2.5 p-2.5 rounded-lg border bg-muted/30 group"
                    >
                      {collab.user.avatarUrl ? (
                        <img
                          src={collab.user.avatarUrl}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-brand-500/10 flex items-center justify-center text-xs font-medium text-brand-600">
                          {(collab.user.name || collab.user.email)?.[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {collab.user.name || collab.user.email}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant={collab.role === "OWNER" ? "default" : "secondary"}
                            className="text-[10px] px-1.5"
                          >
                            {collab.role}
                          </Badge>
                          {collab.status === "PENDING" && (
                            <span className="text-[10px] text-amber-500">Pending</span>
                          )}
                        </div>
                      </div>
                      {collab.role !== "OWNER" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100"
                          onClick={() => removeCollaborator(collab.id)}
                        >
                          <X className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ─── Activity Tab ─── */}
            <TabsContent value="activity">
              {isLoadingActivity ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : activities.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  No activity yet.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-[350px] overflow-y-auto">
                  {activities.map((act) => (
                    <div key={act.id} className="flex items-start gap-2.5 py-2 border-b last:border-0">
                      {act.user.avatarUrl ? (
                        <img src={act.user.avatarUrl} alt="" className="w-6 h-6 rounded-full mt-0.5" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium mt-0.5">
                          {act.user.name?.[0]?.toUpperCase() || "?"}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs">
                          <span className="font-medium">{act.user.name || "Unknown"}</span>{" "}
                          <span className="text-muted-foreground">
                            {act.action === "VIEWED" && "viewed this design"}
                            {act.action === "EDITED" && "edited this design"}
                            {act.action === "SHARED" && "created a share link"}
                            {act.action === "DUPLICATED" && "duplicated this design"}
                            {act.action === "INVITED" && "invited a collaborator"}
                            {act.action === "JOINED" && "joined as collaborator"}
                          </span>
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(act.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
