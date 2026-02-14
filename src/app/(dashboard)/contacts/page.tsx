"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Users,
  UserCheck,
  UserX,
  Mail,
  MessageSquare,
  Search,
  Plus,
  Upload,
  Download,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
  Loader2,
  FileUp,
  ChevronLeft,
  ChevronRight,
  ListPlus,
  AlertCircle,
  Camera,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils/cn";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Contact {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  name: string;
  status: string;
  emailOptedIn: boolean;
  smsOptedIn: boolean;
  birthday: string | null;
  imageUrl: string | null;
  tags: string[];
  lists: { id: string; name: string }[];
  createdAt: string;
  company?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
}

interface ContactList {
  id: string;
  name: string;
  totalCount: number;
  activeCount: number;
  contactCount: number;
  campaignCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface Stats {
  total: number;
  active: number;
  unsubscribed: number;
  emailOptedIn: number;
  smsOptedIn: number;
}

interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
  total: number;
  errors: string[];
}

type DeleteTarget =
  | { type: "single"; id: string }
  | { type: "bulk"; ids: string[] }
  | null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  let row: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        row.push(current.trim());
        current = "";
      } else if (char === "\n" || (char === "\r" && next === "\n")) {
        row.push(current.trim());
        if (row.some((c) => c !== "")) rows.push(row);
        row = [];
        current = "";
        if (char === "\r") i++;
      } else {
        current += char;
      }
    }
  }
  row.push(current.trim());
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

const FIELD_HINTS: Record<string, string[]> = {
  firstName: ["first name", "firstname", "first", "given name"],
  lastName: ["last name", "lastname", "last", "surname", "family name"],
  email: ["email", "e-mail", "email address"],
  phone: ["phone", "telephone", "tel", "mobile", "cell"],
  company: ["company", "organization", "org", "business"],
  birthday: ["birthday", "birth date", "dob", "date of birth"],
  city: ["city", "town"],
  state: ["state", "province", "region"],
  address: ["address", "street", "street address"],
  tags: ["tags", "labels", "categories"],
};

const IMPORT_FIELDS = [
  { value: "skip", label: "Skip" },
  { value: "firstName", label: "First Name" },
  { value: "lastName", label: "Last Name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "company", label: "Company" },
  { value: "birthday", label: "Birthday" },
  { value: "city", label: "City" },
  { value: "state", label: "State" },
  { value: "address", label: "Address" },
  { value: "tags", label: "Tags" },
] as const;

function autoDetectMapping(header: string): string {
  const lower = header.toLowerCase().trim();
  for (const [field, hints] of Object.entries(FIELD_HINTS)) {
    if (hints.some((h) => lower.includes(h))) {
      return field;
    }
  }
  return "skip";
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function ContactsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Tab
  const activeTab = searchParams.get("tab") || "contacts";

  // Contacts state
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 25,
    total: 0,
    pages: 0,
  });
  const [stats, setStats] = useState<Stats>({
    total: 0,
    active: 0,
    unsubscribed: 0,
    emailOptedIn: 0,
    smsOptedIn: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [listFilter, setListFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Lists state
  const [lists, setLists] = useState<ContactList[]>([]);
  const [listsLoading, setListsLoading] = useState(true);

  // Contact dialog
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contactForm, setContactForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    company: "",
    birthday: "",
    city: "",
    state: "",
    address: "",
    imageUrl: "",
    tags: "",
    listIds: [] as string[],
    emailOptedIn: true,
    smsOptedIn: true,
  });
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSavingContact, setIsSavingContact] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // List dialog
  const [showListDialog, setShowListDialog] = useState(false);
  const [editingList, setEditingList] = useState<ContactList | null>(null);
  const [listName, setListName] = useState("");
  const [isSavingList, setIsSavingList] = useState(false);

  // Delete list dialog
  const [deletingList, setDeletingList] = useState<ContactList | null>(null);
  const [isDeletingList, setIsDeletingList] = useState(false);

  // Bulk add to list dialog
  const [showBulkAddDialog, setShowBulkAddDialog] = useState(false);
  const [bulkAddListId, setBulkAddListId] = useState("");
  const [isBulkAdding, setIsBulkAdding] = useState(false);

  // CSV Import dialog
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importStep, setImportStep] = useState(1);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [columnMappings, setColumnMappings] = useState<Record<number, string>>(
    {}
  );
  const [importListId, setImportListId] = useState("");
  const [duplicateStrategy, setDuplicateStrategy] = useState<"skip" | "update">(
    "skip"
  );
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------------------
  // URL-driven list filter
  // -------------------------------------------------------------------------
  const urlListId = searchParams.get("listId");
  useEffect(() => {
    if (urlListId) setListFilter(urlListId);
  }, [urlListId]);

  // -------------------------------------------------------------------------
  // Debounced search
  // -------------------------------------------------------------------------
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, listFilter]);

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------
  const fetchContacts = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (listFilter !== "all") params.set("listId", listFilter);
      params.set("page", page.toString());
      params.set("limit", "25");
      const res = await fetch(`/api/contacts?${params}`);
      const data = await res.json();
      if (data.success) {
        setContacts(data.data.contacts);
        setPagination(data.data.pagination);
        setStats(data.data.stats);
      }
    } catch {
      toast({ title: "Failed to load contacts", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, statusFilter, listFilter, page, toast]);

  const fetchLists = useCallback(async () => {
    setListsLoading(true);
    try {
      const res = await fetch("/api/contact-lists");
      const data = await res.json();
      if (data.success) setLists(data.data.lists);
    } catch {
      toast({ title: "Failed to load lists", variant: "destructive" });
    } finally {
      setListsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  // -------------------------------------------------------------------------
  // Tab change
  // -------------------------------------------------------------------------
  function handleTabChange(value: string) {
    router.replace(`/contacts?tab=${value}`, { scroll: false });
  }

  // -------------------------------------------------------------------------
  // Selection helpers
  // -------------------------------------------------------------------------
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === contacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(contacts.map((c) => c.id)));
    }
  }

  // -------------------------------------------------------------------------
  // Contact CRUD
  // -------------------------------------------------------------------------
  function openAddContact() {
    setEditingContact(null);
    setContactForm({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      company: "",
      birthday: "",
      city: "",
      state: "",
      address: "",
      imageUrl: "",
      tags: "",
      listIds: [],
      emailOptedIn: true,
      smsOptedIn: true,
    });
    setShowContactDialog(true);
  }

  async function openEditContact(contact: Contact) {
    // Fetch full contact details for editing
    try {
      const res = await fetch(`/api/contacts/${contact.id}`);
      const data = await res.json();
      if (data.success) {
        const c = data.data.contact;
        setEditingContact(contact);
        setContactForm({
          firstName: c.firstName || "",
          lastName: c.lastName || "",
          email: c.email || "",
          phone: c.phone || "",
          company: c.company || "",
          birthday: c.birthday || "",
          city: c.city || "",
          state: c.state || "",
          address: c.address || "",
          imageUrl: c.imageUrl || "",
          tags: (c.tags || []).join(", "),
          listIds: (c.lists || []).map((l: { id: string }) => l.id),
          emailOptedIn: c.emailOptedIn,
          smsOptedIn: c.smsOptedIn,
        });
        setShowContactDialog(true);
      }
    } catch {
      toast({ title: "Failed to load contact details", variant: "destructive" });
    }
  }

  async function handleSaveContact() {
    if (!contactForm.email && !contactForm.phone) {
      toast({
        title: "Email or phone is required",
        variant: "destructive",
      });
      return;
    }

    setIsSavingContact(true);
    try {
      const tags = contactForm.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const body = {
        firstName: contactForm.firstName || null,
        lastName: contactForm.lastName || null,
        email: contactForm.email || null,
        phone: contactForm.phone || null,
        company: contactForm.company || null,
        birthday: contactForm.birthday || null,
        imageUrl: contactForm.imageUrl || null,
        city: contactForm.city || null,
        state: contactForm.state || null,
        address: contactForm.address || null,
        tags,
        listIds: contactForm.listIds,
        emailOptedIn: contactForm.emailOptedIn,
        smsOptedIn: contactForm.smsOptedIn,
      };

      let res: Response;
      if (editingContact) {
        res = await fetch(`/api/contacts/${editingContact.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch("/api/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error?.message || "Failed to save contact");
      }

      toast({
        title: editingContact
          ? "Contact updated successfully"
          : "Contact created successfully",
      });
      setShowContactDialog(false);
      fetchContacts();
      fetchLists();
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to save contact",
        variant: "destructive",
      });
    } finally {
      setIsSavingContact(false);
    }
  }

  // -------------------------------------------------------------------------
  // Delete contacts
  // -------------------------------------------------------------------------
  async function handleDeleteConfirm() {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      if (deleteTarget.type === "single") {
        const res = await fetch(`/api/contacts/${deleteTarget.id}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (!data.success)
          throw new Error(data.error?.message || "Failed to delete contact");
        toast({ title: "Contact deleted successfully" });
      } else {
        const res = await fetch("/api/contacts/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "delete",
            contactIds: deleteTarget.ids,
          }),
        });
        const data = await res.json();
        if (!data.success)
          throw new Error(data.error?.message || "Failed to delete contacts");
        toast({
          title: `${data.data.affected} contact(s) deleted successfully`,
        });
        setSelectedIds(new Set());
      }
      setDeleteTarget(null);
      fetchContacts();
      fetchLists();
    } catch (err) {
      toast({
        title:
          err instanceof Error ? err.message : "Failed to delete contact(s)",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  // -------------------------------------------------------------------------
  // List CRUD
  // -------------------------------------------------------------------------
  function openCreateList() {
    setEditingList(null);
    setListName("");
    setShowListDialog(true);
  }

  function openRenameList(list: ContactList) {
    setEditingList(list);
    setListName(list.name);
    setShowListDialog(true);
  }

  async function handleSaveList() {
    if (!listName.trim()) {
      toast({ title: "List name is required", variant: "destructive" });
      return;
    }

    setIsSavingList(true);
    try {
      let res: Response;
      if (editingList) {
        res = await fetch(`/api/contact-lists/${editingList.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: listName }),
        });
      } else {
        res = await fetch("/api/contact-lists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: listName }),
        });
      }

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error?.message || "Failed to save list");
      }

      toast({
        title: editingList
          ? "List renamed successfully"
          : "List created successfully",
      });
      setShowListDialog(false);
      fetchLists();
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to save list",
        variant: "destructive",
      });
    } finally {
      setIsSavingList(false);
    }
  }

  async function handleDeleteList() {
    if (!deletingList) return;

    setIsDeletingList(true);
    try {
      const res = await fetch(`/api/contact-lists/${deletingList.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error?.message || "Failed to delete list");
      }
      toast({ title: "List deleted successfully" });
      setDeletingList(null);
      fetchLists();
      // Reset list filter if the deleted list was active
      if (listFilter === deletingList.id) {
        setListFilter("all");
      }
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to delete list",
        variant: "destructive",
      });
    } finally {
      setIsDeletingList(false);
    }
  }

  // -------------------------------------------------------------------------
  // Bulk add to list
  // -------------------------------------------------------------------------
  async function handleBulkAddToList() {
    if (!bulkAddListId) {
      toast({ title: "Please select a list", variant: "destructive" });
      return;
    }

    setIsBulkAdding(true);
    try {
      const res = await fetch("/api/contacts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "addToList",
          contactIds: [...selectedIds],
          listId: bulkAddListId,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(
          data.error?.message || "Failed to add contacts to list"
        );
      }
      toast({
        title: `${data.data.affected} contact(s) added to list`,
      });
      setShowBulkAddDialog(false);
      setBulkAddListId("");
      setSelectedIds(new Set());
      fetchContacts();
      fetchLists();
    } catch (err) {
      toast({
        title:
          err instanceof Error
            ? err.message
            : "Failed to add contacts to list",
        variant: "destructive",
      });
    } finally {
      setIsBulkAdding(false);
    }
  }

  // -------------------------------------------------------------------------
  // CSV Import
  // -------------------------------------------------------------------------
  function openImportDialog() {
    setImportStep(1);
    setImportFile(null);
    setCsvRows([]);
    setColumnMappings({});
    setImportListId("");
    setDuplicateStrategy("skip");
    setImportResult(null);
    setShowImportDialog(true);
  }

  function handleFileSelected(file: File) {
    setImportFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || "";
      const cleaned = text.replace(/^\uFEFF/, "");
      const rows = parseCSV(cleaned);
      setCsvRows(rows.slice(0, 6)); // header + first 5 data rows for preview

      // Auto-detect mappings
      if (rows.length > 0) {
        const headers = rows[0];
        const detected: Record<number, string> = {};
        headers.forEach((h, i) => {
          detected[i] = autoDetectMapping(h);
        });
        setColumnMappings(detected);
      }

      setImportStep(2);
    };
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".csv") || file.type === "text/csv")) {
      handleFileSelected(file);
    } else {
      toast({ title: "Please drop a CSV file", variant: "destructive" });
    }
  }

  async function handleImportSubmit() {
    if (!importFile) return;

    setIsImporting(true);
    setImportStep(4);

    try {
      const formData = new FormData();
      formData.append("file", importFile);

      // Build mappings (filter out "skip")
      const mappings: Record<string, string> = {};
      for (const [colIdx, field] of Object.entries(columnMappings)) {
        if (field !== "skip") {
          mappings[colIdx] = field;
        }
      }
      formData.append("mappings", JSON.stringify(mappings));

      if (importListId && importListId !== "none") {
        formData.append("listId", importListId);
      }
      formData.append("duplicateStrategy", duplicateStrategy);

      const res = await fetch("/api/contacts/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to import contacts");
      }

      setImportResult(data.data);
    } catch (err) {
      toast({
        title:
          err instanceof Error ? err.message : "Failed to import contacts",
        variant: "destructive",
      });
      setImportStep(3);
    } finally {
      setIsImporting(false);
    }
  }

  function handleImportDone() {
    setShowImportDialog(false);
    fetchContacts();
    fetchLists();
  }

  // -------------------------------------------------------------------------
  // Export
  // -------------------------------------------------------------------------
  function handleExport() {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (listFilter !== "all") params.set("listId", listFilter);
    window.open(`/api/contacts/export?${params}`, "_blank");
  }

  // -------------------------------------------------------------------------
  // Stats cards config
  // -------------------------------------------------------------------------
  const statCards = [
    {
      label: "Total Contacts",
      value: stats.total,
      icon: Users,
      color: "blue",
    },
    {
      label: "Active",
      value: stats.active,
      icon: UserCheck,
      color: "green",
    },
    {
      label: "Unsubscribed",
      value: stats.unsubscribed,
      icon: UserX,
      color: "red",
    },
    {
      label: "Email Opted-In",
      value: stats.emailOptedIn,
      icon: Mail,
      color: "purple",
    },
    {
      label: "SMS Opted-In",
      value: stats.smsOptedIn,
      icon: MessageSquare,
      color: "orange",
    },
  ] as const;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 flex flex-col space-y-6 p-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            Contacts
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage your contacts and lists
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={openImportDialog}>
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button
            className="bg-brand-500 hover:bg-brand-600"
            onClick={openAddContact}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Contact
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="contacts">All Contacts</TabsTrigger>
          <TabsTrigger value="lists">Lists</TabsTrigger>
        </TabsList>

        {/* ================= CONTACTS TAB ================= */}
        <TabsContent value="contacts" className="space-y-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {statCards.map((stat) => (
              <Card key={stat.label}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "p-2 rounded-lg",
                        stat.color === "blue" && "bg-blue-500/10",
                        stat.color === "green" && "bg-green-500/10",
                        stat.color === "red" && "bg-red-500/10",
                        stat.color === "purple" && "bg-purple-500/10",
                        stat.color === "orange" && "bg-orange-500/10"
                      )}
                    >
                      <stat.icon
                        className={cn(
                          "h-5 w-5",
                          stat.color === "blue" && "text-blue-500",
                          stat.color === "green" && "text-green-500",
                          stat.color === "red" && "text-red-500",
                          stat.color === "purple" && "text-purple-500",
                          stat.color === "orange" && "text-orange-500"
                        )}
                      />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">
                        {stat.label}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Search & Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search contacts..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v)}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={listFilter}
                  onValueChange={(v) => setListFilter(v)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="List" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Lists</SelectItem>
                    {lists.map((list) => (
                      <SelectItem key={list.id} value={list.id}>
                        {list.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Bulk Actions Bar */}
          {selectedIds.size > 0 && (
            <Card className="bg-brand-500/10 border-brand-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="text-sm font-medium">
                    {selectedIds.size} contact{selectedIds.size > 1 ? "s" : ""}{" "}
                    selected
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setBulkAddListId("");
                      setShowBulkAddDialog(true);
                    }}
                  >
                    <ListPlus className="h-4 w-4 mr-2" />
                    Add to List
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() =>
                      setDeleteTarget({
                        type: "bulk",
                        ids: [...selectedIds],
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Selected
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedIds(new Set())}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Contacts Table */}
          <Card>
            {isLoading ? (
              <CardContent className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                ))}
              </CardContent>
            ) : contacts.length === 0 ? (
              <CardContent className="p-8 text-center text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No contacts yet</p>
                <p className="text-sm mt-1">
                  Add your first contact to get started
                </p>
                <Button
                  className="mt-4 bg-brand-500 hover:bg-brand-600"
                  onClick={openAddContact}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Contact
                </Button>
              </CardContent>
            ) : (
              <>
                {/* Table Header */}
                <div className="hidden md:grid md:grid-cols-[40px_1fr_1fr_120px_120px_100px_120px_60px] gap-2 px-4 py-2 text-xs font-medium text-muted-foreground border-b">
                  <div>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                      checked={
                        selectedIds.size === contacts.length &&
                        contacts.length > 0
                      }
                      onChange={toggleSelectAll}
                    />
                  </div>
                  <div>Name</div>
                  <div>Email / Phone</div>
                  <div>Status</div>
                  <div>Lists</div>
                  <div>Opted In</div>
                  <div>Created</div>
                  <div></div>
                </div>

                {/* Table Rows */}
                {contacts.map((contact, index) => (
                  <motion.div
                    key={contact.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-[40px_1fr_1fr_120px_120px_100px_120px_60px] gap-2 items-center px-4 py-3 border-b hover:bg-muted/50 transition-colors">
                      {/* Checkbox */}
                      <div>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                          checked={selectedIds.has(contact.id)}
                          onChange={() => toggleSelect(contact.id)}
                        />
                      </div>

                      {/* Name + Avatar */}
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          {contact.imageUrl && (
                            <AvatarImage src={contact.imageUrl} alt={contact.name} />
                          )}
                          <AvatarFallback className="text-xs bg-brand-500/10 text-brand-500">
                            {getInitials(contact.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{contact.name}</p>
                          <p className="text-xs text-muted-foreground md:hidden">
                            {contact.email}
                          </p>
                        </div>
                      </div>

                      {/* Email / Phone */}
                      <div className="hidden md:block">
                        <p className="text-sm">{contact.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {contact.phone}
                        </p>
                      </div>

                      {/* Status */}
                      <div>
                        <Badge
                          variant={
                            contact.status === "active"
                              ? "success"
                              : "destructive"
                          }
                          className="text-[10px]"
                        >
                          {contact.status}
                        </Badge>
                      </div>

                      {/* Lists */}
                      <div className="hidden md:flex gap-1 flex-wrap">
                        {contact.lists.map((list) => (
                          <Badge
                            key={list.id}
                            variant="secondary"
                            className="text-[10px]"
                          >
                            {list.name}
                          </Badge>
                        ))}
                      </div>

                      {/* Opted In */}
                      <div className="hidden md:flex gap-1">
                        {contact.emailOptedIn && (
                          <Badge variant="outline" className="text-[10px]">
                            Email
                          </Badge>
                        )}
                        {contact.smsOptedIn && (
                          <Badge variant="outline" className="text-[10px]">
                            SMS
                          </Badge>
                        )}
                      </div>

                      {/* Created */}
                      <div className="hidden md:block text-xs text-muted-foreground">
                        {formatDate(contact.createdAt)}
                      </div>

                      {/* Actions */}
                      <div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => openEditContact(contact)}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                setDeleteTarget({
                                  type: "single",
                                  id: contact.id,
                                })
                              }
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </motion.div>
                ))}

                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    Showing{" "}
                    {Math.min(
                      (pagination.page - 1) * pagination.limit + 1,
                      pagination.total
                    )}
                    -
                    {Math.min(
                      pagination.page * pagination.limit,
                      pagination.total
                    )}{" "}
                    of {pagination.total}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= pagination.pages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </Card>
        </TabsContent>

        {/* ================= LISTS TAB ================= */}
        <TabsContent value="lists" className="space-y-4">
          <div className="flex justify-end">
            <Button
              className="bg-brand-500 hover:bg-brand-600"
              onClick={openCreateList}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create List
            </Button>
          </div>

          {listsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4 space-y-3">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : lists.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No lists yet</p>
                <p className="text-sm mt-1">
                  Create your first list to organize your contacts
                </p>
                <Button
                  className="mt-4 bg-brand-500 hover:bg-brand-600"
                  onClick={openCreateList}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First List
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {lists.map((list, index) => (
                <motion.div
                  key={list.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card
                    className="cursor-pointer hover:border-brand-500/50 transition-colors"
                    onClick={() => {
                      setListFilter(list.id);
                      router.replace(
                        `/contacts?tab=contacts&listId=${list.id}`,
                        { scroll: false }
                      );
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{list.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {list.totalCount} contacts &middot;{" "}
                            {list.activeCount} active
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Created {formatDate(list.createdAt)}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                openRenameList(list);
                              }}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingList(list);
                              }}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ================= DIALOGS ================= */}

      {/* Add/Edit Contact Dialog */}
      <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingContact ? "Edit Contact" : "Add Contact"}
            </DialogTitle>
            <DialogDescription>
              {editingContact
                ? "Update the contact details below."
                : "Fill in the details to add a new contact."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4">
            {/* Contact Photo */}
            <div className="col-span-2 flex items-center gap-4">
              <div className="relative group">
                <Avatar className="h-16 w-16">
                  {contactForm.imageUrl && (
                    <AvatarImage src={contactForm.imageUrl} alt="Contact photo" />
                  )}
                  <AvatarFallback className="text-lg bg-brand-500/10 text-brand-500">
                    {contactForm.firstName || contactForm.lastName
                      ? getInitials(
                          [contactForm.firstName, contactForm.lastName]
                            .filter(Boolean)
                            .join(" ")
                        )
                      : <Camera className="w-5 h-5 text-muted-foreground" />}
                  </AvatarFallback>
                </Avatar>
                <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Camera className="w-5 h-5 text-white" />
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) {
                        toast({ title: "Image must be under 5MB", variant: "destructive" });
                        return;
                      }
                      setIsUploadingPhoto(true);
                      try {
                        const formData = new FormData();
                        formData.append("file", file);
                        const res = await fetch("/api/media", { method: "POST", body: formData });
                        const data = await res.json();
                        if (data.success && data.data?.file?.url) {
                          setContactForm((f) => ({ ...f, imageUrl: data.data.file.url }));
                        } else {
                          throw new Error(data.error?.message || "Upload failed");
                        }
                      } catch (err) {
                        toast({ title: err instanceof Error ? err.message : "Upload failed", variant: "destructive" });
                      } finally {
                        setIsUploadingPhoto(false);
                      }
                    }}
                  />
                </label>
                {isUploadingPhoto && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full">
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  </div>
                )}
              </div>
              <div className="text-sm">
                <p className="font-medium">Contact Photo</p>
                <p className="text-xs text-muted-foreground">Click to upload (PNG, JPG, WebP, max 5MB)</p>
                {contactForm.imageUrl && (
                  <button
                    type="button"
                    className="text-xs text-red-500 hover:underline mt-1"
                    onClick={() => setContactForm((f) => ({ ...f, imageUrl: "" }))}
                  >
                    Remove photo
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={contactForm.firstName}
                onChange={(e) =>
                  setContactForm((f) => ({ ...f, firstName: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={contactForm.lastName}
                onChange={(e) =>
                  setContactForm((f) => ({ ...f, lastName: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={contactForm.email}
                onChange={(e) =>
                  setContactForm((f) => ({ ...f, email: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={contactForm.phone}
                onChange={(e) =>
                  setContactForm((f) => ({ ...f, phone: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={contactForm.company}
                onChange={(e) =>
                  setContactForm((f) => ({ ...f, company: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="birthday">Birthday</Label>
              <Input
                id="birthday"
                placeholder="MM-DD"
                value={contactForm.birthday}
                onChange={(e) =>
                  setContactForm((f) => ({ ...f, birthday: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={contactForm.city}
                onChange={(e) =>
                  setContactForm((f) => ({ ...f, city: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={contactForm.state}
                onChange={(e) =>
                  setContactForm((f) => ({ ...f, state: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={contactForm.address}
                onChange={(e) =>
                  setContactForm((f) => ({ ...f, address: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                placeholder="Separate with commas"
                value={contactForm.tags}
                onChange={(e) =>
                  setContactForm((f) => ({ ...f, tags: e.target.value }))
                }
              />
            </div>

            {/* Lists checkboxes */}
            {lists.length > 0 && (
              <div className="space-y-2 col-span-2">
                <Label>Lists</Label>
                <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-2">
                  {lists.map((list) => (
                    <label
                      key={list.id}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                        checked={contactForm.listIds.includes(list.id)}
                        onChange={(e) => {
                          setContactForm((f) => ({
                            ...f,
                            listIds: e.target.checked
                              ? [...f.listIds, list.id]
                              : f.listIds.filter((id) => id !== list.id),
                          }));
                        }}
                      />
                      {list.name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Opt-in switches */}
            <div className="flex items-center justify-between col-span-2">
              <Label htmlFor="emailOptIn">Email Opt-in</Label>
              <Switch
                id="emailOptIn"
                checked={contactForm.emailOptedIn}
                onCheckedChange={(v) =>
                  setContactForm((f) => ({ ...f, emailOptedIn: v }))
                }
              />
            </div>
            <div className="flex items-center justify-between col-span-2">
              <Label htmlFor="smsOptIn">SMS Opt-in</Label>
              <Switch
                id="smsOptIn"
                checked={contactForm.smsOptedIn}
                onCheckedChange={(v) =>
                  setContactForm((f) => ({ ...f, smsOptedIn: v }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowContactDialog(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-brand-500 hover:bg-brand-600"
              onClick={handleSaveContact}
              disabled={isSavingContact}
            >
              {isSavingContact && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingContact ? "Save Changes" : "Add Contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Contact AlertDialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.type === "bulk"
                ? `Delete ${deleteTarget.ids.length} Contacts`
                : "Delete Contact"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The contact
              {deleteTarget?.type === "bulk" ? "s" : ""} will be permanently
              removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create/Rename List Dialog */}
      <Dialog open={showListDialog} onOpenChange={setShowListDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {editingList ? "Rename List" : "Create List"}
            </DialogTitle>
            <DialogDescription>
              {editingList
                ? "Enter a new name for this list."
                : "Enter a name for your new contact list."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="listName">Name</Label>
            <Input
              id="listName"
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              placeholder="e.g. Newsletter Subscribers"
              className="mt-2"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveList();
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowListDialog(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-brand-500 hover:bg-brand-600"
              onClick={handleSaveList}
              disabled={isSavingList}
            >
              {isSavingList && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingList ? "Rename" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete List AlertDialog */}
      <AlertDialog
        open={!!deletingList}
        onOpenChange={(open) => {
          if (!open) setDeletingList(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete List</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingList?.name}&quot;?
              Contacts won&apos;t be deleted, only removed from this list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingList}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteList}
              disabled={isDeletingList}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeletingList && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Add to List Dialog */}
      <Dialog open={showBulkAddDialog} onOpenChange={setShowBulkAddDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add to List</DialogTitle>
            <DialogDescription>
              Select a list to add {selectedIds.size} contact
              {selectedIds.size > 1 ? "s" : ""} to.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={bulkAddListId} onValueChange={setBulkAddListId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a list" />
              </SelectTrigger>
              <SelectContent>
                {lists.map((list) => (
                  <SelectItem key={list.id} value={list.id}>
                    {list.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBulkAddDialog(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-brand-500 hover:bg-brand-600"
              onClick={handleBulkAddToList}
              disabled={isBulkAdding || !bulkAddListId}
            >
              {isBulkAdding && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Add to List
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <Dialog
        open={showImportDialog}
        onOpenChange={(open) => {
          if (!open && !isImporting) setShowImportDialog(false);
        }}
      >
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Contacts</DialogTitle>
            <DialogDescription>
              {importStep === 1 && "Upload a CSV file to import contacts."}
              {importStep === 2 && "Map CSV columns to contact fields."}
              {importStep === 3 && "Review import options before proceeding."}
              {importStep === 4 &&
                (isImporting
                  ? "Importing contacts..."
                  : "Import complete.")}
            </DialogDescription>
          </DialogHeader>

          {/* Step 1: Upload */}
          {importStep === 1 && (
            <div className="py-4">
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center hover:border-brand-500/50 transition-colors cursor-pointer"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <FileUp className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-medium">
                  Drag and drop your CSV file here
                </p>
                <p className="text-xs text-muted-foreground mt-1">or</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  Browse Files
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelected(file);
                  }}
                />
              </div>
            </div>
          )}

          {/* Step 2: Column Mapping */}
          {importStep === 2 && csvRows.length > 0 && (
            <div className="py-4 space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      {csvRows[0].map((header, i) => (
                        <th
                          key={i}
                          className="text-left p-2 font-medium text-muted-foreground"
                        >
                          <div className="space-y-1">
                            <p className="text-xs truncate max-w-[120px]">
                              {header}
                            </p>
                            <Select
                              value={columnMappings[i] || "skip"}
                              onValueChange={(v) =>
                                setColumnMappings((prev) => ({
                                  ...prev,
                                  [i]: v,
                                }))
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {IMPORT_FIELDS.map((field) => (
                                  <SelectItem
                                    key={field.value}
                                    value={field.value}
                                  >
                                    {field.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.slice(1, 6).map((row, rowIdx) => (
                      <tr key={rowIdx} className="border-b">
                        {row.map((cell, cellIdx) => (
                          <td
                            key={cellIdx}
                            className="p-2 text-xs truncate max-w-[120px]"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => setImportStep(1)}
                >
                  Back
                </Button>
                <Button
                  className="bg-brand-500 hover:bg-brand-600"
                  onClick={() => setImportStep(3)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Options */}
          {importStep === 3 && (
            <div className="py-4 space-y-6">
              {/* Target list */}
              <div className="space-y-2">
                <Label>Add to List (optional)</Label>
                <Select
                  value={importListId}
                  onValueChange={setImportListId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {lists.map((list) => (
                      <SelectItem key={list.id} value={list.id}>
                        {list.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Duplicate handling */}
              <div className="space-y-2">
                <Label>Duplicate Handling</Label>
                <div className="flex gap-2">
                  <Button
                    variant={
                      duplicateStrategy === "skip" ? "default" : "outline"
                    }
                    size="sm"
                    className={
                      duplicateStrategy === "skip"
                        ? "bg-brand-500 hover:bg-brand-600"
                        : ""
                    }
                    onClick={() => setDuplicateStrategy("skip")}
                  >
                    Skip duplicates
                  </Button>
                  <Button
                    variant={
                      duplicateStrategy === "update" ? "default" : "outline"
                    }
                    size="sm"
                    className={
                      duplicateStrategy === "update"
                        ? "bg-brand-500 hover:bg-brand-600"
                        : ""
                    }
                    onClick={() => setDuplicateStrategy("update")}
                  >
                    Update existing
                  </Button>
                </div>
              </div>

              {/* Summary */}
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm font-medium">
                    Ready to import{" "}
                    {csvRows.length > 1 ? csvRows.length - 1 : 0} contacts
                  </p>
                  {importFile && (
                    <p className="text-xs text-muted-foreground mt-1">
                      File: {importFile.name}
                    </p>
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => setImportStep(2)}
                >
                  Back
                </Button>
                <Button
                  className="bg-brand-500 hover:bg-brand-600"
                  onClick={handleImportSubmit}
                >
                  Import
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Progress & Results */}
          {importStep === 4 && (
            <div className="py-4 space-y-4">
              {isImporting ? (
                <div className="flex flex-col items-center gap-4 py-8">
                  <Loader2 className="h-10 w-10 animate-spin text-brand-500" />
                  <p className="text-sm text-muted-foreground">
                    Importing contacts, please wait...
                  </p>
                </div>
              ) : importResult ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Card>
                      <CardContent className="p-3 text-center">
                        <p className="text-2xl font-bold text-green-600">
                          {importResult.imported}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Imported
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-3 text-center">
                        <p className="text-2xl font-bold text-blue-600">
                          {importResult.updated}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Updated
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-3 text-center">
                        <p className="text-2xl font-bold text-orange-600">
                          {importResult.skipped}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Skipped
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-3 text-center">
                        <p className="text-2xl font-bold">
                          {importResult.total}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Total Rows
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {importResult.errors.length > 0 && (
                    <Card className="border-orange-500/50">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="h-4 w-4 text-orange-500" />
                          <p className="text-sm font-medium">
                            {importResult.errors.length} error
                            {importResult.errors.length > 1 ? "s" : ""}
                          </p>
                        </div>
                        <div className="max-h-32 overflow-y-auto text-xs text-muted-foreground space-y-1">
                          {importResult.errors.map((err, i) => (
                            <p key={i}>{err}</p>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <div className="flex justify-end">
                    <Button
                      className="bg-brand-500 hover:bg-brand-600"
                      onClick={handleImportDone}
                    >
                      Done
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
