"use client";

import { useState, useEffect, useCallback } from "react";
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
  FileQuestion,
  CheckCircle2,
  Clock,
  BarChart3,
  Link2,
  Copy,
  ExternalLink,
  Loader2,
  Star,
  Users,
  MessageSquare,
  X,
  Save,
  ChevronUp,
  ChevronDown,
  type LucideIcon,
  Type,
  AlignLeft,
  List,
  ToggleLeft,
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
  QUESTION_TYPES,
  type EntryData,
  type EntryStatus,
  type SurveyQuestion,
  type SurveyResponseData,
} from "@/types/follow-up";

const QUESTION_ICON_MAP: Record<string, LucideIcon> = {
  text: Type,
  textarea: AlignLeft,
  rating: Star,
  multiple_choice: List,
  yes_no: ToggleLeft,
  email: Mail,
  phone: Phone,
};

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
  survey: {
    id: string;
    title: string;
    slug: string;
    isActive: boolean;
    responseCount: number;
    questions: SurveyQuestion[];
  } | null;
  createdAt: string;
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

  // Delete dialog
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Survey state
  const [surveyTitle, setSurveyTitle] = useState("");
  const [surveyDesc, setSurveyDesc] = useState("");
  const [surveyThankYou, setSurveyThankYou] = useState("Thank you for your response!");
  const [surveyQuestions, setSurveyQuestions] = useState<SurveyQuestion[]>([]);
  const [surveySlug, setSurveySlug] = useState("");
  const [surveyActive, setSurveyActive] = useState(true);
  const [isSavingSurvey, setIsSavingSurvey] = useState(false);
  const [surveyResponses, setSurveyResponses] = useState<SurveyResponseData[]>([]);
  const [responsesLoading, setResponsesLoading] = useState(false);

  // Fetch follow-up details
  const fetchFollowUp = useCallback(async () => {
    try {
      const res = await fetch(`/api/follow-ups/${id}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      setFollowUp(json.data);

      // Populate survey form if exists
      if (json.data.survey) {
        setSurveyTitle(json.data.survey.title);
        setSurveyDesc(json.data.survey.description || "");
        setSurveyQuestions(json.data.survey.questions || []);
        setSurveySlug(json.data.survey.slug);
        setSurveyActive(json.data.survey.isActive);
      }
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
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setEntriesLoading(false);
    }
  }, [id, entryPage, entryStatusFilter, entryFilter, toast]);

  useEffect(() => { fetchFollowUp(); }, [fetchFollowUp]);
  useEffect(() => { if (followUp) fetchEntries(); }, [fetchEntries, followUp]);

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
    try {
      const res = await fetch(`/api/follow-ups/${id}/entries/${entryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      fetchEntries();
      fetchFollowUp();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
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

  // Survey
  const addQuestion = (type: string) => {
    const q: SurveyQuestion = {
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: type as SurveyQuestion["type"],
      label: "",
      required: false,
      ...(type === "multiple_choice" ? { options: ["Option 1", "Option 2"] } : {}),
    };
    setSurveyQuestions([...surveyQuestions, q]);
  };

  const updateQuestion = (index: number, updates: Partial<SurveyQuestion>) => {
    const q = [...surveyQuestions];
    q[index] = { ...q[index], ...updates };
    setSurveyQuestions(q);
  };

  const removeQuestion = (index: number) => {
    setSurveyQuestions(surveyQuestions.filter((_, i) => i !== index));
  };

  const moveQuestion = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= surveyQuestions.length) return;
    const q = [...surveyQuestions];
    [q[index], q[newIndex]] = [q[newIndex], q[index]];
    setSurveyQuestions(q);
  };

  const handleSaveSurvey = async () => {
    if (!surveyTitle.trim()) {
      toast({ title: "Error", description: "Survey title is required", variant: "destructive" });
      return;
    }
    if (surveyQuestions.length === 0) {
      toast({ title: "Error", description: "Add at least one question", variant: "destructive" });
      return;
    }
    // Validate all questions have labels
    const emptyLabel = surveyQuestions.find((q) => !q.label.trim());
    if (emptyLabel) {
      toast({ title: "Error", description: "All questions must have a label", variant: "destructive" });
      return;
    }

    setIsSavingSurvey(true);
    try {
      const res = await fetch(`/api/follow-ups/${id}/survey`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: surveyTitle.trim(),
          description: surveyDesc.trim() || null,
          thankYouMessage: surveyThankYou.trim(),
          questions: surveyQuestions,
          slug: surveySlug || undefined,
          isActive: surveyActive,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      toast({ title: "Saved!", description: "Survey saved successfully" });
      setSurveySlug(json.data.slug);
      fetchFollowUp();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsSavingSurvey(false);
    }
  };

  const fetchResponses = useCallback(async () => {
    if (!followUp?.survey) return;
    setResponsesLoading(true);
    try {
      const res = await fetch(`/api/follow-ups/${id}/survey/responses?limit=50`);
      const json = await res.json();
      if (json.success) setSurveyResponses(json.data || []);
    } catch { /* silent */ } finally {
      setResponsesLoading(false);
    }
  }, [id, followUp?.survey]);

  useEffect(() => {
    if (activeTab === "survey" && followUp?.survey) fetchResponses();
  }, [activeTab, fetchResponses, followUp?.survey]);

  const copyLink = () => {
    const url = `${window.location.origin}/survey/${surveySlug}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Copied!", description: "Survey link copied to clipboard" });
  };

  // Delete follow-up
  const handleDeleteFollowUp = async () => {
    if (!confirm(`Delete "${followUp?.name}"? This will remove all entries and survey data permanently.`)) return;
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
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
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
              <Badge variant="outline">
                {followUp.type === "TRACKER" ? "Tracker" : "Survey"}
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-xl font-bold">{followUp.survey?.responseCount || 0}</p>
              <p className="text-xs text-muted-foreground">Survey Responses</p>
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
          <TabsTrigger value="survey" className="gap-1.5">
            <FileQuestion className="h-3.5 w-3.5" /> Survey
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
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <Card className="hover:shadow-sm transition-shadow">
                        <CardContent className="p-3 sm:p-4">
                          <div className="flex items-center gap-3">
                            {/* Name & Contact */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-medium text-sm truncate">{displayName}</p>
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
                              {entry.notes && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-1 italic">
                                  {entry.notes}
                                </p>
                              )}
                            </div>

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

        {/* SURVEY TAB */}
        <TabsContent value="survey" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Survey Builder</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Survey Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Survey Title *</Label>
                  <Input
                    value={surveyTitle}
                    onChange={(e) => setSurveyTitle(e.target.value)}
                    placeholder="e.g. Customer Satisfaction Survey"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Thank You Message</Label>
                  <Input
                    value={surveyThankYou}
                    onChange={(e) => setSurveyThankYou(e.target.value)}
                    placeholder="Thank you for your response!"
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={surveyDesc}
                  onChange={(e) => setSurveyDesc(e.target.value)}
                  placeholder="Optional description shown to respondents..."
                  className="mt-1"
                  rows={2}
                />
              </div>

              {/* Questions */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-base">Questions ({surveyQuestions.length})</Label>
                </div>

                {surveyQuestions.length === 0 ? (
                  <div className="border-2 border-dashed rounded-lg p-6 text-center text-muted-foreground">
                    <FileQuestion className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No questions yet. Add your first question below.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {surveyQuestions.map((q, i) => {
                      const QIcon = QUESTION_ICON_MAP[q.type] || Type;
                      return (
                        <Card key={q.id} className="border">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="flex flex-col items-center gap-1 pt-1">
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveQuestion(i, -1)} disabled={i === 0}>
                                  <ChevronUp className="h-3 w-3" />
                                </Button>
                                <span className="text-xs text-muted-foreground font-mono">{i + 1}</span>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveQuestion(i, 1)} disabled={i === surveyQuestions.length - 1}>
                                  <ChevronDown className="h-3 w-3" />
                                </Button>
                              </div>

                              <div className="flex-1 space-y-3">
                                <div className="flex items-center gap-2">
                                  <QIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                                  <Badge variant="outline" className="text-[10px]">
                                    {QUESTION_TYPES.find((t) => t.value === q.type)?.label || q.type}
                                  </Badge>
                                  <div className="flex-1" />
                                  <div className="flex items-center gap-1.5">
                                    <Label htmlFor={`req-${q.id}`} className="text-xs text-muted-foreground">Required</Label>
                                    <Switch
                                      id={`req-${q.id}`}
                                      checked={q.required}
                                      onCheckedChange={(c) => updateQuestion(i, { required: c })}
                                    />
                                  </div>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeQuestion(i)}>
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </div>

                                <Input
                                  value={q.label}
                                  onChange={(e) => updateQuestion(i, { label: e.target.value })}
                                  placeholder="Enter your question..."
                                  className="text-sm"
                                />

                                {q.type === "multiple_choice" && q.options && (
                                  <div className="pl-4 space-y-2">
                                    {q.options.map((opt, oi) => (
                                      <div key={oi} className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full border-2 shrink-0" />
                                        <Input
                                          value={opt}
                                          onChange={(e) => {
                                            const opts = [...(q.options || [])];
                                            opts[oi] = e.target.value;
                                            updateQuestion(i, { options: opts });
                                          }}
                                          className="h-8 text-sm"
                                          placeholder={`Option ${oi + 1}`}
                                        />
                                        {(q.options?.length || 0) > 2 && (
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 shrink-0"
                                            onClick={() => {
                                              const opts = (q.options || []).filter((_, idx) => idx !== oi);
                                              updateQuestion(i, { options: opts });
                                            }}
                                          >
                                            <X className="h-3 w-3" />
                                          </Button>
                                        )}
                                      </div>
                                    ))}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-xs"
                                      onClick={() => {
                                        updateQuestion(i, { options: [...(q.options || []), `Option ${(q.options?.length || 0) + 1}`] });
                                      }}
                                    >
                                      <Plus className="h-3 w-3 mr-1" /> Add Option
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}

                {/* Add Question Buttons */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {QUESTION_TYPES.map((qt) => {
                    const QIcon = QUESTION_ICON_MAP[qt.value] || Type;
                    return (
                      <Button
                        key={qt.value}
                        variant="outline"
                        size="sm"
                        onClick={() => addQuestion(qt.value)}
                        className="gap-1.5 text-xs"
                      >
                        <QIcon className="h-3 w-3" />
                        {qt.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Public URL & Controls */}
              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label>Survey Active</Label>
                    <Switch checked={surveyActive} onCheckedChange={setSurveyActive} />
                  </div>
                </div>

                {surveySlug && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                    <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <code className="text-sm flex-1 truncate">
                      {typeof window !== "undefined" ? window.location.origin : ""}/survey/{surveySlug}
                    </code>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={copyLink}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => window.open(`/survey/${surveySlug}`, "_blank")}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}

                <Button onClick={handleSaveSurvey} disabled={isSavingSurvey} className="gap-2">
                  {isSavingSurvey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Survey
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Survey Responses */}
          {followUp.survey && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Responses ({followUp.survey.responseCount})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {responsesLoading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}
                  </div>
                ) : surveyResponses.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No responses yet. Share your survey link to start collecting feedback.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {surveyResponses.map((resp) => {
                      const answers = typeof resp.answers === "string" ? JSON.parse(resp.answers as string) : resp.answers;
                      return (
                        <Card key={resp.id} className="border">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2 text-sm">
                                {resp.respondentName && <span className="font-medium">{resp.respondentName}</span>}
                                {resp.respondentEmail && <span className="text-muted-foreground">{resp.respondentEmail}</span>}
                                {resp.respondentPhone && <span className="text-muted-foreground">{resp.respondentPhone}</span>}
                                {!resp.respondentName && !resp.respondentEmail && (
                                  <span className="text-muted-foreground italic">Anonymous</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {resp.rating && (
                                  <div className="flex items-center gap-0.5">
                                    {[...Array(5)].map((_, si) => (
                                      <Star
                                        key={si}
                                        className={`h-3 w-3 ${si < resp.rating! ? "fill-amber-400 text-amber-400" : "text-gray-300"}`}
                                      />
                                    ))}
                                  </div>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {new Date(resp.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                              {Object.entries(answers).map(([qId, answer]) => {
                                const question = followUp.survey?.questions.find((q) => q.id === qId);
                                return (
                                  <div key={qId} className="text-xs">
                                    <span className="text-muted-foreground">{question?.label || qId}:</span>{" "}
                                    <span className="font-medium">{String(answer)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
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
