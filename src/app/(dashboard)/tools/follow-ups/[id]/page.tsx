"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Plus,
  Search,
  Upload,
  Download,
  Trash2,
  Edit,
  Phone,
  Mail,
  MapPin,
  UserPlus,
  MoreVertical,
  ClipboardList,
  CheckCircle2,
  Clock,
  BarChart3,
  Link2,
  Loader2,
  Users,
  X,
  MessageSquare,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  ENTRY_STATUS_CONFIG,
  type EntryData,
  type EntryStatus,
} from "@/types/follow-up";

interface FollowUpDetail {
  id: string;
  name: string;
  description: string | null;
  type: string;
  status: string;
  contactListId: string | null;
  contactListName: string | null;
  totalEntries: number;
  completedEntries: number;
  settings: Record<string, unknown>;
  statusBreakdown: Record<string, number>;
  createdAt: string;
  isOwner: boolean;
}

interface ContactList {
  id: string;
  name: string;
  totalCount: number;
}

export default function FollowUpDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const [followUp, setFollowUp] = useState<FollowUpDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("entries");

  // Entries state
  const [entries, setEntries] = useState<EntryData[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [entryFilter, setEntryFilter] = useState("");
  const [entryStatusFilter, setEntryStatusFilter] = useState<string>("ALL");
  const [entryPage, setEntryPage] = useState(1);
  const [entryTotal, setEntryTotal] = useState(0);

  // Entry dialog
  const [showEntryDialog, setShowEntryDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState<EntryData | null>(null);
  const [entryForm, setEntryForm] = useState({
    name: "", phone: "", email: "", address: "", referralSource: "", notes: "", status: "PENDING", nextFollowUp: "",
  });
  const [isSavingEntry, setIsSavingEntry] = useState(false);

  // Import dialog
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importListId, setImportListId] = useState("");
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  // Export to contacts dialog
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportListId, setExportListId] = useState("");
  const [exportCreateList, setExportCreateList] = useState(false);
  const [exportNewListName, setExportNewListName] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  // Inline note editing
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteValue, setEditingNoteValue] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Delete dialog
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Team members for assignee
  interface TeamMemberOption { id: string; name: string; avatarUrl: string | null; }
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([]);

  // Current user ID (from entries API meta)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Fetch follow-up details
  const fetchFollowUp = useCallback(async () => {
    try {
      const res = await fetch(`/api/follow-ups/${id}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      setFollowUp(json.data);
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [id, toast]);

  // Fetch entries
  const fetchEntries = useCallback(async () => {
    setEntriesLoading(true);
    try {
      const params = new URLSearchParams({ page: String(entryPage), limit: "25" });
      if (entryStatusFilter !== "ALL") params.set("status", entryStatusFilter);
      if (entryFilter) params.set("search", entryFilter);

      const res = await fetch(`/api/follow-ups/${id}/entries?${params}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      setEntries(json.data);
      setEntryTotal(json.pagination?.total || 0);
      if (json.meta?.currentUserId) setCurrentUserId(json.meta.currentUserId);
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setEntriesLoading(false);
    }
  }, [id, entryPage, entryStatusFilter, entryFilter, toast]);

  useEffect(() => { fetchFollowUp(); }, [fetchFollowUp]);
  useEffect(() => { if (followUp) fetchEntries(); }, [fetchEntries, followUp]);

  // Fetch team members for assignee dropdown
  useEffect(() => {
    fetch("/api/teams")
      .then((r) => r.json())
      .then(async (json) => {
        if (!json.success || !json.data?.length) return;
        const allMembers: TeamMemberOption[] = [];
        const seen = new Set<string>();
        for (const team of json.data) {
          try {
            const res = await fetch(`/api/teams/${team.id}`);
            const tj = await res.json();
            if (tj.success) {
              for (const m of tj.data.members || []) {
                if (!seen.has(m.user.id)) {
                  seen.add(m.user.id);
                  allMembers.push({ id: m.user.id, name: m.user.name, avatarUrl: m.user.avatarUrl });
                }
              }
            }
          } catch { /* silent */ }
        }
        setTeamMembers(allMembers);
      })
      .catch(() => {});
  }, []);

  // Fetch contact lists for import/export
  useEffect(() => {
    if ((showImportDialog || showExportDialog) && contactLists.length === 0) {
      fetch("/api/contact-lists?limit=100")
        .then((r) => r.json())
        .then((json) => { if (json.success) setContactLists(json.data?.lists || json.data || []); })
        .catch(() => {});
    }
  }, [showImportDialog, showExportDialog, contactLists.length]);

  // Entry CRUD
  const openAddEntry = () => {
    setEditingEntry(null);
    setEntryForm({ name: "", phone: "", email: "", address: "", referralSource: "", notes: "", status: "PENDING", nextFollowUp: "" });
    setShowEntryDialog(true);
  };

  const openEditEntry = (entry: EntryData) => {
    setEditingEntry(entry);
    setEntryForm({
      name: entry.name || (entry.contact ? `${entry.contact.firstName || ""} ${entry.contact.lastName || ""}`.trim() : ""),
      phone: entry.phone || entry.contact?.phone || "",
      email: entry.email || entry.contact?.email || "",
      address: entry.address || "",
      referralSource: entry.referralSource || "",
      notes: entry.notes || "",
      status: entry.status,
      nextFollowUp: entry.nextFollowUp ? new Date(entry.nextFollowUp).toISOString().slice(0, 16) : "",
    });
    setShowEntryDialog(true);
  };

  const handleSaveEntry = async () => {
    setIsSavingEntry(true);
    try {
      const payload = {
        ...entryForm,
        nextFollowUp: entryForm.nextFollowUp || null,
      };

      if (editingEntry) {
        const res = await fetch(`/api/follow-ups/${id}/entries/${editingEntry.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error?.message);
        toast({ title: "Updated", description: "Entry updated successfully" });
      } else {
        const res = await fetch(`/api/follow-ups/${id}/entries`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error?.message);
        toast({ title: "Added", description: "Entry added successfully" });
      }

      setShowEntryDialog(false);
      fetchEntries();
      fetchFollowUp();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsSavingEntry(false);
    }
  };

  const handleDeleteEntry = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/follow-ups/${id}/entries/${deleteId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      toast({ title: "Deleted", description: "Entry removed" });
      setDeleteId(null);
      fetchEntries();
      fetchFollowUp();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handleQuickStatusChange = async (entryId: string, newStatus: string) => {
    // Optimistically update locally to prevent list re-render/shaking
    setEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, status: newStatus as EntryData["status"] } : e))
    );
    try {
      const res = await fetch(`/api/follow-ups/${id}/entries/${entryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (!json.success) {
        // Revert on failure
        fetchEntries();
        throw new Error(json.error?.message);
      }
      // Only refresh the header stats, not the entry list
      fetchFollowUp();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handleQuickAssigneeChange = async (entryId: string, assigneeId: string | null) => {
    const assignee = assigneeId ? teamMembers.find((m) => m.id === assigneeId) : null;
    setEntries((prev) =>
      prev.map((e) => (e.id === entryId ? {
        ...e,
        assigneeId,
        assignee: assignee ? { id: assignee.id, name: assignee.name, avatarUrl: assignee.avatarUrl } : null,
      } : e))
    );
    try {
      const res = await fetch(`/api/follow-ups/${id}/entries/${entryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeId: assigneeId || null }),
      });
      const json = await res.json();
      if (!json.success) {
        fetchEntries();
        throw new Error(json.error?.message);
      }
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    }
  };

  // Inline note editing
  const startEditingNote = (entry: EntryData) => {
    setEditingNoteId(entry.id);
    setEditingNoteValue(entry.notes || "");
    setTimeout(() => noteTextareaRef.current?.focus(), 0);
  };

  const cancelEditingNote = () => {
    setEditingNoteId(null);
    setEditingNoteValue("");
  };

  const saveInlineNote = async (entryId: string) => {
    const trimmed = editingNoteValue.trim();
    const entry = entries.find((e) => e.id === entryId);
    // Skip save if unchanged
    if (trimmed === (entry?.notes || "")) {
      cancelEditingNote();
      return;
    }
    setIsSavingNote(true);
    try {
      const res = await fetch(`/api/follow-ups/${id}/entries/${entryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: trimmed || null }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      // Update locally without full refetch
      setEntries((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, notes: trimmed || null } : e))
      );
      cancelEditingNote();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsSavingNote(false);
    }
  };

  // Import
  const handleImport = async () => {
    if (!importListId) return;
    setIsImporting(true);
    try {
      const res = await fetch(`/api/follow-ups/${id}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactListId: importListId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      toast({ title: "Imported!", description: json.data.message });
      setShowImportDialog(false);
      setImportListId("");
      fetchEntries();
      fetchFollowUp();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  // Export to contacts
  const handleExportToContacts = async () => {
    setIsExporting(true);
    try {
      let targetListId = exportListId || undefined;

      // Create new list if requested
      if (exportCreateList && exportNewListName.trim()) {
        const listRes = await fetch("/api/contact-lists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: exportNewListName.trim() }),
        });
        const listJson = await listRes.json();
        if (!listJson.success) throw new Error(listJson.error?.message || "Failed to create list");
        targetListId = listJson.data.list.id;
        // Refresh contact lists cache
        setContactLists([]);
      }

      const res = await fetch(`/api/follow-ups/${id}/export-contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listId: targetListId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      toast({ title: "Exported!", description: json.data.message });
      setShowExportDialog(false);
      setExportListId("");
      setExportCreateList(false);
      setExportNewListName("");
      fetchEntries();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  // Delete follow-up
  const handleDeleteFollowUp = async () => {
    if (!confirm(`Delete "${followUp?.name}"? This will remove all entries permanently.`)) return;
    try {
      const res = await fetch(`/api/follow-ups/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      toast({ title: "Deleted", description: "Follow-up deleted" });
      router.push("/tools/follow-ups");
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!followUp) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Follow-up not found</p>
        <Button variant="outline" onClick={() => router.push("/tools/follow-ups")} className="mt-4">
          Back to Follow-Ups
        </Button>
      </div>
    );
  }

  const progress = followUp.totalEntries > 0
    ? Math.round((followUp.completedEntries / followUp.totalEntries) * 100)
    : 0;
  const entryPages = Math.ceil(entryTotal / 25);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/tools/follow-ups")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{followUp.name}</h1>
              <Badge variant={followUp.status === "ACTIVE" ? "default" : "secondary"} className={followUp.status === "ACTIVE" ? "bg-green-500" : ""}>
                {followUp.status}
              </Badge>
            </div>
            {followUp.description && (
              <p className="text-sm text-muted-foreground mt-1">{followUp.description}</p>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {followUp.status === "ACTIVE" && (
              <DropdownMenuItem onClick={() => {
                fetch(`/api/follow-ups/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "COMPLETED" }) })
                  .then(() => fetchFollowUp());
              }}>
                <CheckCircle2 className="h-4 w-4 mr-2" /> Mark Completed
              </DropdownMenuItem>
            )}
            {followUp.status !== "ACTIVE" && (
              <DropdownMenuItem onClick={() => {
                fetch(`/api/follow-ups/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "ACTIVE" }) })
                  .then(() => fetchFollowUp());
              }}>
                <Clock className="h-4 w-4 mr-2" /> Reactivate
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className="text-destructive" onClick={handleDeleteFollowUp}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-xl font-bold">{followUp.totalEntries}</p>
              <p className="text-xs text-muted-foreground">Total Entries</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-xl font-bold">{followUp.completedEntries}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-violet-500" />
            <div>
              <p className="text-xl font-bold">{progress}%</p>
              <p className="text-xs text-muted-foreground">Progress</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="entries" className="gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" /> Entries
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> Analytics
          </TabsTrigger>
        </TabsList>

        {/* ENTRIES TAB */}
        <TabsContent value="entries" className="space-y-4">
          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={openAddEntry} size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add Entry
            </Button>
            <Button onClick={() => setShowImportDialog(true)} variant="outline" size="sm" className="gap-1.5">
              <Upload className="h-3.5 w-3.5" /> Import from List
            </Button>
            {followUp.totalEntries > 0 && (
              <Button onClick={() => setShowExportDialog(true)} variant="outline" size="sm" className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> Push to Contacts
              </Button>
            )}
            <div className="flex-1" />
            <div className="relative max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={entryFilter}
                onChange={(e) => { setEntryFilter(e.target.value); setEntryPage(1); }}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <Select value={entryStatusFilter} onValueChange={(v) => { setEntryStatusFilter(v); setEntryPage(1); }}>
              <SelectTrigger className="w-[140px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                {Object.entries(ENTRY_STATUS_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Owner visibility control: restrict team members to only see their assigned entries */}
          {followUp.isOwner && teamMembers.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/50 border text-sm">
              <Switch
                checked={followUp.settings?.restrictToAssigned === true}
                onCheckedChange={async (checked) => {
                  const newSettings = { ...followUp.settings, restrictToAssigned: checked };
                  setFollowUp((prev) => prev ? { ...prev, settings: newSettings } : prev);
                  try {
                    await fetch(`/api/follow-ups/${id}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ settings: newSettings }),
                    });
                  } catch { /* silent */ }
                }}
              />
              <span className="text-muted-foreground">Members only see assigned entries</span>
            </div>
          )}

          {/* Entry List */}
          {entriesLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : entries.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <UserPlus className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="font-medium mb-1">No entries yet</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Add contacts manually or import from an existing contact list
                </p>
                <div className="flex justify-center gap-2">
                  <Button size="sm" onClick={openAddEntry} className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Add Entry
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowImportDialog(true)} className="gap-1.5">
                    <Upload className="h-3.5 w-3.5" /> Import
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="space-y-2">
                {entries.map((entry) => {
                  const displayName = entry.name || (entry.contact ? `${entry.contact.firstName || ""} ${entry.contact.lastName || ""}`.trim() : "Unknown");
                  const statusConfig = ENTRY_STATUS_CONFIG[entry.status as EntryStatus] || ENTRY_STATUS_CONFIG.PENDING;

                  return (
                    <motion.div
                      key={entry.id}
                      layout
                    >
                      <Card className="hover:shadow-sm transition-shadow">
                        <CardContent className="p-3 sm:p-4">
                          <div className="flex items-center gap-3">
                            {/* Name & Contact */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-medium text-sm truncate">{displayName}</p>
                                {currentUserId && entry.assigneeId === currentUserId && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                                    Assigned to you
                                  </Badge>
                                )}
                                {entry.attempts > 0 && (
                                  <span className="text-[10px] text-muted-foreground">({entry.attempts} attempts)</span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                {(entry.phone || entry.contact?.phone) && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {entry.phone || entry.contact?.phone}
                                  </span>
                                )}
                                {(entry.email || entry.contact?.email) && (
                                  <span className="flex items-center gap-1">
                                    <Mail className="h-3 w-3" />
                                    {entry.email || entry.contact?.email}
                                  </span>
                                )}
                                {entry.address && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {entry.address}
                                  </span>
                                )}
                                {entry.referralSource && (
                                  <span className="flex items-center gap-1">
                                    <Link2 className="h-3 w-3" />
                                    {entry.referralSource}
                                  </span>
                                )}
                              </div>
                              {/* Inline Notes */}
                              {editingNoteId === entry.id ? (
                                <div className="mt-1.5 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                                  <Textarea
                                    ref={noteTextareaRef}
                                    value={editingNoteValue}
                                    onChange={(e) => setEditingNoteValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        saveInlineNote(entry.id);
                                      }
                                      if (e.key === "Escape") cancelEditingNote();
                                    }}
                                    placeholder="Add a note..."
                                    className="text-xs min-h-[60px] resize-none flex-1"
                                    rows={2}
                                    disabled={isSavingNote}
                                  />
                                  <div className="flex flex-col gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-50"
                                      onClick={() => saveInlineNote(entry.id)}
                                      disabled={isSavingNote}
                                    >
                                      {isSavingNote ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                      onClick={cancelEditingNote}
                                      disabled={isSavingNote}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              ) : entry.notes ? (
                                <p
                                  className="text-xs text-muted-foreground mt-1 line-clamp-1 italic cursor-pointer hover:text-foreground transition-colors"
                                  onClick={() => startEditingNote(entry)}
                                  title="Click to edit note"
                                >
                                  {entry.notes}
                                </p>
                              ) : (
                                <button
                                  className="flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-muted-foreground mt-1 transition-colors"
                                  onClick={() => startEditingNote(entry)}
                                >
                                  <MessageSquare className="h-3 w-3" />
                                  Add note
                                </button>
                              )}
                            </div>

                            {/* Assignee */}
                            {teamMembers.length > 0 && (
                              <Select
                                value={entry.assigneeId || "none"}
                                onValueChange={(v) => handleQuickAssigneeChange(entry.id, v === "none" ? null : v)}
                              >
                                <SelectTrigger className="w-[120px] h-8 text-xs">
                                  {entry.assignee ? (
                                    <div className="flex items-center gap-1.5">
                                      <div className="h-5 w-5 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-[9px] font-medium shrink-0">
                                        {entry.assignee.avatarUrl ? (
                                          <img src={entry.assignee.avatarUrl} alt={entry.assignee.name} className="h-5 w-5 rounded-full object-cover" />
                                        ) : (
                                          entry.assignee.name.charAt(0).toUpperCase()
                                        )}
                                      </div>
                                      <span className="truncate">{entry.assignee.name.split(" ")[0]}</span>
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">Assign</span>
                                  )}
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Unassigned</SelectItem>
                                  {teamMembers.map((tm) => (
                                    <SelectItem key={tm.id} value={tm.id}>
                                      <span className="flex items-center gap-1.5">
                                        <span className="h-4 w-4 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-[8px] font-medium shrink-0">
                                          {tm.avatarUrl ? (
                                            <img src={tm.avatarUrl} alt={tm.name} className="h-4 w-4 rounded-full object-cover" />
                                          ) : (
                                            tm.name.charAt(0).toUpperCase()
                                          )}
                                        </span>
                                        {tm.name}
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}

                            {/* Status Dropdown */}
                            <Select
                              value={entry.status}
                              onValueChange={(v) => handleQuickStatusChange(entry.id, v)}
                            >
                              <SelectTrigger className="w-[130px] h-8 text-xs">
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-2 h-2 rounded-full ${statusConfig.color.split(" ")[0]}`} />
                                  <SelectValue />
                                </div>
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(ENTRY_STATUS_CONFIG).map(([key, cfg]) => (
                                  <SelectItem key={key} value={key}>
                                    <span className="flex items-center gap-1.5">
                                      <span className={`w-2 h-2 rounded-full ${cfg.color.split(" ")[0]}`} />
                                      {cfg.label}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {/* Actions */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                  <MoreVertical className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditEntry(entry)}>
                                  <Edit className="h-4 w-4 mr-2" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(entry.id)}>
                                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>

              {/* Pagination */}
              {entryPages > 1 && (
                <div className="flex justify-center gap-2 pt-2">
                  <Button variant="outline" size="sm" disabled={entryPage <= 1} onClick={() => setEntryPage(entryPage - 1)}>
                    Previous
                  </Button>
                  <span className="flex items-center text-sm text-muted-foreground px-2">
                    Page {entryPage} of {entryPages}
                  </span>
                  <Button variant="outline" size="sm" disabled={entryPage >= entryPages} onClick={() => setEntryPage(entryPage + 1)}>
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ANALYTICS TAB */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Status Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Status Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                {followUp.totalEntries === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No entries to analyze</p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(ENTRY_STATUS_CONFIG).map(([key, cfg]) => {
                      const count = followUp.statusBreakdown[key] || 0;
                      const pct = followUp.totalEntries > 0 ? Math.round((count / followUp.totalEntries) * 100) : 0;
                      if (count === 0) return null;
                      return (
                        <div key={key}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="flex items-center gap-2">
                              <Badge className={`${cfg.color} text-[10px]`}>{cfg.label}</Badge>
                            </span>
                            <span className="text-muted-foreground">{count} ({pct}%)</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${cfg.color.split(" ")[0]}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Completion Progress */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Completion</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-6">
                <div className="relative w-32 h-32">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      className="stroke-muted"
                      strokeWidth="3"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      className="stroke-green-500"
                      strokeWidth="3"
                      strokeDasharray={`${progress}, 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold">{progress}%</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-3">
                  {followUp.completedEntries} of {followUp.totalEntries} entries completed
                </p>
              </CardContent>
            </Card>

            {/* Top Referral Sources */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Top Referral Sources</CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const sources: Record<string, number> = {};
                  entries.forEach((e) => {
                    if (e.referralSource) {
                      sources[e.referralSource] = (sources[e.referralSource] || 0) + 1;
                    }
                  });
                  const sorted = Object.entries(sources).sort((a, b) => b[1] - a[1]);
                  if (sorted.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">No referral sources recorded</p>;
                  return (
                    <div className="space-y-2">
                      {sorted.slice(0, 10).map(([source, count]) => (
                        <div key={source} className="flex items-center justify-between text-sm">
                          <span>{source}</span>
                          <Badge variant="secondary">{count}</Badge>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Entry Dialog */}
      <Dialog open={showEntryDialog} onOpenChange={setShowEntryDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingEntry ? "Edit Entry" : "Add Entry"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Name</Label>
                <Input value={entryForm.name} onChange={(e) => setEntryForm({ ...entryForm, name: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={entryForm.phone} onChange={(e) => setEntryForm({ ...entryForm, phone: e.target.value })} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Email</Label>
              <Input value={entryForm.email} onChange={(e) => setEntryForm({ ...entryForm, email: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Address</Label>
              <Input value={entryForm.address} onChange={(e) => setEntryForm({ ...entryForm, address: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Referral Source</Label>
              <Input
                value={entryForm.referralSource}
                onChange={(e) => setEntryForm({ ...entryForm, referralSource: e.target.value })}
                placeholder="Who referred them?"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={entryForm.status} onValueChange={(v) => setEntryForm({ ...entryForm, status: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ENTRY_STATUS_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Next Follow-Up</Label>
              <Input
                type="datetime-local"
                value={entryForm.nextFollowUp}
                onChange={(e) => setEntryForm({ ...entryForm, nextFollowUp: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={entryForm.notes}
                onChange={(e) => setEntryForm({ ...entryForm, notes: e.target.value })}
                placeholder="Add notes about this contact..."
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEntryDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveEntry} disabled={isSavingEntry}>
              {isSavingEntry ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingEntry ? "Update" : "Add Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import from Contact List</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Import contacts from an existing contact list. Duplicates will be skipped.
            </p>
            <Select value={importListId} onValueChange={setImportListId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a contact list..." />
              </SelectTrigger>
              <SelectContent>
                {contactLists.map((cl) => (
                  <SelectItem key={cl.id} value={cl.id}>
                    {cl.name} ({cl.totalCount} contacts)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>Cancel</Button>
            <Button onClick={handleImport} disabled={!importListId || isImporting}>
              {isImporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export to Contacts Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Push to Contacts</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Export all {followUp.totalEntries} entries as contacts. Existing contacts (matched by email/phone) will be linked, new ones will be created. Entries without email or phone will be skipped.
            </p>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Add to a contact list (optional)</Label>

              <div className="flex items-center gap-2">
                <Switch
                  checked={exportCreateList}
                  onCheckedChange={(checked) => {
                    setExportCreateList(checked);
                    if (checked) setExportListId("");
                  }}
                />
                <Label className="text-sm">Create a new list</Label>
              </div>

              {exportCreateList ? (
                <Input
                  placeholder="New list name..."
                  value={exportNewListName}
                  onChange={(e) => setExportNewListName(e.target.value)}
                />
              ) : (
                <Select value={exportListId} onValueChange={setExportListId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a list (optional)..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No list</SelectItem>
                    {contactLists.map((cl) => (
                      <SelectItem key={cl.id} value={cl.id}>
                        {cl.name} ({cl.totalCount} contacts)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportDialog(false)}>Cancel</Button>
            <Button
              onClick={handleExportToContacts}
              disabled={isExporting || (exportCreateList && !exportNewListName.trim())}
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              Push to Contacts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this entry? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEntry} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
