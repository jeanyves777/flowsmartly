"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  FolderOpen,
  Search,
  Grid3X3,
  List,
  Plus,
  FolderPlus,
  Trash2,
  Check,
  X,
  Loader2,
  MoreVertical,
  Pencil,
  FolderInput,
  ChevronRight,
  CheckSquare,
  Square,
  Palette,
  Image,
  FileText,
  Megaphone,
  PanelTop,
  Signpost,
  Presentation,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { DESIGN_CATEGORIES, type CategoryConfig } from "@/lib/constants/design-presets";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Design {
  id: string;
  name: string;
  prompt: string;
  category: string;
  size: string;
  style: string | null;
  imageUrl: string | null;
  status: string;
  folderId?: string | null;
  createdAt: string;
}

interface DesignFolder {
  id: string;
  name: string;
  parentId: string | null;
  designCount: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const categoryIcons: Record<string, React.ElementType> = {
  social_post: Image,
  ad: Megaphone,
  flyer: FileText,
  poster: Presentation,
  banner: PanelTop,
  signboard: Signpost,
};

const categoryGradients: Record<string, string> = {
  social_post: "from-pink-500 to-rose-500",
  ad: "from-amber-500 to-orange-500",
  flyer: "from-blue-500 to-indigo-500",
  poster: "from-purple-500 to-violet-500",
  banner: "from-emerald-500 to-teal-500",
  signboard: "from-slate-500 to-zinc-500",
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatSize(size: string): string {
  const [w, h] = size.split("x");
  if (w && h) return `${w} x ${h}`;
  return size;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function DesignsPage() {
  const router = useRouter();
  const { toast } = useToast();

  // Data
  const [designs, setDesigns] = useState<Design[]>([]);
  const [folders, setFolders] = useState<DesignFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // View
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  // Folder path for breadcrumbs
  const [folderPath, setFolderPath] = useState<DesignFolder[]>([]);

  // Pagination
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // New Design dialog
  const [showNewDesign, setShowNewDesign] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryConfig | null>(null);

  // Create folder
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // Folder rename
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [folderRenameValue, setFolderRenameValue] = useState("");

  // Multi-select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);

  // Bulk actions
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [moveTargetFolderId, setMoveTargetFolderId] = useState<string | null>(null);
  const [isBulkOperating, setIsBulkOperating] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // ─── Data Fetching ──────────────────────────────────────────────────────

  const fetchDesigns = useCallback(
    async (cursor?: string | null) => {
      try {
        if (!cursor) setIsLoading(true);
        else setIsLoadingMore(true);

        const params = new URLSearchParams();
        if (activeFolderId) params.set("folderId", activeFolderId);
        if (searchQuery) params.set("search", searchQuery);
        if (categoryFilter) params.set("category", categoryFilter);
        params.set("limit", "20");
        if (cursor) params.set("cursor", cursor);

        const res = await fetch(`/api/designs?${params}`);
        const data = await res.json();

        if (data.success) {
          if (cursor) {
            setDesigns((prev) => [...prev, ...data.data.designs]);
          } else {
            setDesigns(data.data.designs);
          }
          setHasMore(data.data.hasMore);
          setNextCursor(data.data.nextCursor);
        }
      } catch (error) {
        console.error("Failed to fetch designs:", error);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [activeFolderId, searchQuery, categoryFilter]
  );

  const fetchFolders = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (activeFolderId) params.set("parentId", activeFolderId);

      const res = await fetch(`/api/designs/folders?${params}`);
      const data = await res.json();

      if (data.success) {
        setFolders(data.data?.folders || []);
      }
    } catch (error) {
      console.error("Failed to fetch folders:", error);
    }
  }, [activeFolderId]);

  useEffect(() => {
    fetchDesigns();
    fetchFolders();
  }, [fetchDesigns, fetchFolders]);

  // Build breadcrumb path when folder changes
  useEffect(() => {
    if (!activeFolderId) {
      setFolderPath([]);
      return;
    }
    // Add current folder to path if not already there
    setFolderPath((prev) => {
      const existingIndex = prev.findIndex((f) => f.id === activeFolderId);
      if (existingIndex >= 0) {
        // Navigating back in the breadcrumb — truncate
        return prev.slice(0, existingIndex + 1);
      }
      // Find folder in current folders list
      const folder = folders.find((f) => f.id === activeFolderId);
      if (folder) {
        return [...prev, folder];
      }
      return prev;
    });
  }, [activeFolderId, folders]);

  // Exit select mode on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isSelectMode) {
        setIsSelectMode(false);
        setSelectedIds(new Set());
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSelectMode]);

  // Reset select mode when changing folder/filter
  useEffect(() => {
    setIsSelectMode(false);
    setSelectedIds(new Set());
  }, [activeFolderId, categoryFilter]);

  // ─── Folder Handlers ────────────────────────────────────────────────────

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const res = await fetch("/api/designs/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFolderName, parentId: activeFolderId }),
      });
      const data = await res.json();
      if (data.success) {
        setNewFolderName("");
        setShowCreateFolder(false);
        toast({ title: "Folder created!" });
        fetchFolders();
      }
    } catch {
      toast({ title: "Failed to create folder", variant: "destructive" });
    }
  };

  const handleRenameFolder = async (folderId: string) => {
    if (!folderRenameValue.trim()) {
      setRenamingFolderId(null);
      return;
    }
    try {
      await fetch(`/api/designs/folders/${folderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: folderRenameValue.trim() }),
      });
      setFolders((prev) =>
        prev.map((f) => (f.id === folderId ? { ...f, name: folderRenameValue.trim() } : f))
      );
      setRenamingFolderId(null);
      toast({ title: "Folder renamed" });
    } catch {
      toast({ title: "Failed to rename folder", variant: "destructive" });
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    try {
      const res = await fetch(`/api/designs/folders/${folderId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        if (activeFolderId === folderId) {
          setActiveFolderId(null);
          setFolderPath([]);
        }
        toast({ title: "Folder deleted" });
        fetchFolders();
        fetchDesigns();
      }
    } catch {
      toast({ title: "Failed to delete folder", variant: "destructive" });
    }
  };

  // ─── Design Handlers ────────────────────────────────────────────────────

  const handleDeleteDesign = async (designId: string) => {
    try {
      const res = await fetch(`/api/designs/${designId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setDesigns((prev) => prev.filter((d) => d.id !== designId));
        toast({ title: "Design deleted" });
      }
    } catch {
      toast({ title: "Failed to delete design", variant: "destructive" });
    }
  };

  // ─── Multi-select Handlers ──────────────────────────────────────────────

  const toggleSelect = (designId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(designId)) next.delete(designId);
      else next.add(designId);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === designs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(designs.map((d) => d.id)));
    }
  };

  const handleDesignClick = (design: Design) => {
    if (isSelectMode) {
      toggleSelect(design.id);
    } else {
      router.push(`/studio?id=${design.id}`);
    }
  };

  // ─── Bulk Operations ────────────────────────────────────────────────────

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkOperating(true);
    try {
      const res = await fetch("/api/designs/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", designIds: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: `${selectedIds.size} design${selectedIds.size > 1 ? "s" : ""} deleted`,
        });
        setSelectedIds(new Set());
        setIsSelectMode(false);
        setShowBulkDeleteConfirm(false);
        fetchDesigns();
      }
    } catch {
      toast({ title: "Failed to delete designs", variant: "destructive" });
    } finally {
      setIsBulkOperating(false);
    }
  };

  const handleBulkMove = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkOperating(true);
    try {
      const res = await fetch("/api/designs/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "move",
          designIds: Array.from(selectedIds),
          folderId: moveTargetFolderId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: `${selectedIds.size} design${selectedIds.size > 1 ? "s" : ""} moved`,
        });
        setSelectedIds(new Set());
        setIsSelectMode(false);
        setShowMoveDialog(false);
        fetchDesigns();
        fetchFolders();
      }
    } catch {
      toast({ title: "Failed to move designs", variant: "destructive" });
    } finally {
      setIsBulkOperating(false);
    }
  };

  // ─── Navigate into folder ───────────────────────────────────────────────

  const navigateToFolder = (folder: DesignFolder) => {
    setActiveFolderId(folder.id);
    setCategoryFilter(null);
  };

  const navigateToRoot = () => {
    setActiveFolderId(null);
    setFolderPath([]);
  };

  const navigateBreadcrumb = (folder: DesignFolder) => {
    setActiveFolderId(folder.id);
  };

  // ─── Derived data ───────────────────────────────────────────────────────

  const allFoldersList = folders; // already filtered by parentId from API

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* ─── Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Palette className="w-4 h-4 text-white" />
            </div>
            My Designs
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreateFolder(true)}
          >
            <FolderPlus className="w-4 h-4 mr-1" />
            New Folder
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setShowNewDesign(true);
              setSelectedCategory(null);
            }}
            className="bg-brand-500 hover:bg-brand-600"
          >
            <Plus className="w-4 h-4 mr-1" />
            New Design
          </Button>
        </div>
      </div>

      {/* ─── Search, Filters, View Toggle ──────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search designs..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          {isSelectMode && designs.length > 0 && (
            <Button variant="outline" size="sm" onClick={selectAll} className="shrink-0">
              {selectedIds.size === designs.length ? (
                <>
                  <CheckSquare className="w-4 h-4 mr-1" /> Deselect All
                </>
              ) : (
                <>
                  <Square className="w-4 h-4 mr-1" /> Select All
                </>
              )}
            </Button>
          )}
          <Button
            variant={isSelectMode ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setIsSelectMode(!isSelectMode);
              if (isSelectMode) setSelectedIds(new Set());
            }}
            className={`shrink-0 ${isSelectMode ? "bg-brand-500 hover:bg-brand-600" : ""}`}
          >
            <CheckSquare className="w-4 h-4 mr-1" />
            {isSelectMode ? "Cancel" : "Select"}
          </Button>
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode("grid")}
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode("list")}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Category Filter Badges ────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setCategoryFilter(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            categoryFilter === null
              ? "bg-brand-500 text-white"
              : "bg-muted hover:bg-muted/80 text-muted-foreground"
          }`}
        >
          All
        </button>
        {DESIGN_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategoryFilter(categoryFilter === cat.id ? null : cat.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              categoryFilter === cat.id
                ? "bg-brand-500 text-white"
                : "bg-muted hover:bg-muted/80 text-muted-foreground"
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* ─── Breadcrumbs ───────────────────────────────────────────────── */}
      {activeFolderId && (
        <div className="flex items-center gap-1 text-sm">
          <button
            onClick={navigateToRoot}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            All Designs
          </button>
          {folderPath.map((folder) => (
            <div key={folder.id} className="flex items-center gap-1">
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
              {folder.id === activeFolderId ? (
                <span className="font-medium">{folder.name}</span>
              ) : (
                <button
                  onClick={() => navigateBreadcrumb(folder)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {folder.name}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── Folder Cards ──────────────────────────────────────────────── */}
      {allFoldersList.length > 0 && !searchQuery && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {allFoldersList.map((folder) => (
            <div key={folder.id} className="group relative">
              <button
                onClick={() => navigateToFolder(folder)}
                className="w-full flex flex-col items-center gap-2 p-4 rounded-lg border hover:bg-muted transition-colors"
              >
                <FolderOpen className="w-10 h-10 text-brand-500" />
                {renamingFolderId === folder.id ? (
                  <Input
                    className="h-7 text-sm text-center"
                    value={folderRenameValue}
                    onChange={(e) => setFolderRenameValue(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") handleRenameFolder(folder.id);
                      if (e.key === "Escape") setRenamingFolderId(null);
                    }}
                    onBlur={() => handleRenameFolder(folder.id)}
                    autoFocus
                  />
                ) : (
                  <span className="text-sm font-medium truncate w-full text-center">
                    {folder.name}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {folder.designCount} design{folder.designCount !== 1 ? "s" : ""}
                </span>
              </button>
              {renamingFolderId !== folder.id && (
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 bg-background/80 rounded hover:bg-background transition-colors"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenamingFolderId(folder.id);
                          setFolderRenameValue(folder.name);
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5 mr-2" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFolder(folder.id);
                        }}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── Loading Skeletons ─────────────────────────────────────────── */}
      {isLoading && (
        <div
          className={
            viewMode === "grid"
              ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
              : "space-y-2"
          }
        >
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton
              key={i}
              className={viewMode === "grid" ? "aspect-[4/3] rounded-lg" : "h-16 rounded-lg"}
            />
          ))}
        </div>
      )}

      {/* ─── Empty State ───────────────────────────────────────────────── */}
      {!isLoading && designs.length === 0 && allFoldersList.length === 0 && (
        <Card className="border-2 border-dashed">
          <CardContent className="p-12 text-center">
            <Palette className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="font-medium">No designs yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              {searchQuery || categoryFilter
                ? "No designs match your current filters. Try adjusting your search or category."
                : "Create your first design to get started."}
            </p>
            {!searchQuery && !categoryFilter && (
              <Button
                className="mt-4 bg-brand-500 hover:bg-brand-600"
                onClick={() => {
                  setShowNewDesign(true);
                  setSelectedCategory(null);
                }}
              >
                <Plus className="w-4 h-4 mr-1" />
                Create Design
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Design Grid View ──────────────────────────────────────────── */}
      {!isLoading && designs.length > 0 && viewMode === "grid" && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {designs.map((design) => {
            const isSelected = selectedIds.has(design.id);
            const CatIcon = categoryIcons[design.category] || Palette;
            const gradient = categoryGradients[design.category] || "from-gray-500 to-slate-500";

            return (
              <motion.div
                key={design.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <Card
                  className={`overflow-hidden hover:shadow-lg transition-all cursor-pointer group relative ${
                    isSelected ? "ring-2 ring-brand-500 shadow-md" : ""
                  }`}
                  onClick={() => handleDesignClick(design)}
                >
                  {/* Selection checkbox */}
                  {(isSelectMode || isSelected) && (
                    <div
                      className="absolute top-2 left-2 z-10"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(design.id);
                      }}
                    >
                      <div
                        className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
                          isSelected
                            ? "bg-brand-500 border-brand-500"
                            : "bg-background/80 border-muted-foreground/30"
                        }`}
                      >
                        {isSelected && <Check className="w-4 h-4 text-white" />}
                      </div>
                    </div>
                  )}
                  {/* Hover checkbox (not in select mode) */}
                  {!isSelectMode && !isSelected && (
                    <div
                      className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsSelectMode(true);
                        toggleSelect(design.id);
                      }}
                    >
                      <div className="w-6 h-6 rounded-md border-2 bg-background/80 border-muted-foreground/30 flex items-center justify-center" />
                    </div>
                  )}
                  {/* Context menu */}
                  <div
                    className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="w-7 h-7 rounded-md bg-background/80 flex items-center justify-center hover:bg-background transition-colors">
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => router.push(`/studio?id=${design.id}`)}
                        >
                          <Pencil className="w-3.5 h-3.5 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteDesign(design.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {/* Thumbnail */}
                  <div className="aspect-[4/3] bg-muted flex items-center justify-center overflow-hidden">
                    {design.imageUrl ? (
                      <img
                        src={design.imageUrl}
                        alt={design.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div
                        className={`w-full h-full bg-gradient-to-br ${gradient} flex flex-col items-center justify-center gap-2 p-4`}
                      >
                        <CatIcon className="w-10 h-10 text-white/80" />
                        <p className="text-xs text-white/70 font-medium text-center truncate w-full px-2">
                          {design.name}
                        </p>
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <CardContent className="p-3 space-y-1.5">
                    <p className="text-xs font-medium truncate">{design.name}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {DESIGN_CATEGORIES.find((c) => c.id === design.category)?.name ||
                          design.category}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {formatSize(design.size)}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {relativeTime(design.createdAt)}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ─── Design List View ──────────────────────────────────────────── */}
      {!isLoading && designs.length > 0 && viewMode === "list" && (
        <div className="space-y-1">
          {/* Header row */}
          <div className="hidden sm:flex items-center gap-3 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <div className="w-5" />
            <div className="w-10" />
            <div className="flex-1">Name</div>
            <div className="w-28">Category</div>
            <div className="w-24">Size</div>
            <div className="w-20 text-right">Created</div>
            <div className="w-8" />
          </div>
          {designs.map((design) => {
            const isSelected = selectedIds.has(design.id);
            const CatIcon = categoryIcons[design.category] || Palette;
            const gradient = categoryGradients[design.category] || "from-gray-500 to-slate-500";

            return (
              <div
                key={design.id}
                onClick={() => handleDesignClick(design)}
                className={`flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors cursor-pointer group ${
                  isSelected ? "bg-brand-500/5 ring-1 ring-brand-500/30" : ""
                }`}
              >
                {/* Checkbox */}
                {(isSelectMode || isSelected) && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelect(design.id);
                    }}
                    className="shrink-0"
                  >
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        isSelected
                          ? "bg-brand-500 border-brand-500"
                          : "border-muted-foreground/30"
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </div>
                )}
                {!isSelectMode && !isSelected && (
                  <div
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsSelectMode(true);
                      toggleSelect(design.id);
                    }}
                  >
                    <div className="w-5 h-5 rounded border-2 border-muted-foreground/30 flex items-center justify-center" />
                  </div>
                )}
                {/* Thumbnail */}
                <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 overflow-hidden">
                  {design.imageUrl ? (
                    <img
                      src={design.imageUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}
                    >
                      <CatIcon className="w-5 h-5 text-white/80" />
                    </div>
                  )}
                </div>
                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{design.name}</p>
                  <p className="text-xs text-muted-foreground sm:hidden">
                    {DESIGN_CATEGORIES.find((c) => c.id === design.category)?.name ||
                      design.category}
                  </p>
                </div>
                {/* Category */}
                <div className="hidden sm:block w-28">
                  <Badge variant="secondary" className="text-xs">
                    {DESIGN_CATEGORIES.find((c) => c.id === design.category)?.name ||
                      design.category}
                  </Badge>
                </div>
                {/* Size */}
                <span className="hidden sm:block w-24 text-xs text-muted-foreground">
                  {formatSize(design.size)}
                </span>
                {/* Timestamp */}
                <span className="hidden sm:block w-20 text-xs text-muted-foreground text-right">
                  {relativeTime(design.createdAt)}
                </span>
                {/* Actions */}
                <div
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1 hover:bg-muted rounded transition-colors">
                        <MoreVertical className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => router.push(`/studio?id=${design.id}`)}
                      >
                        <Pencil className="w-3.5 h-3.5 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDeleteDesign(design.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Load More ─────────────────────────────────────────────────── */}
      {hasMore && !isLoading && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={() => fetchDesigns(nextCursor)}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            {isLoadingMore ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}

      {/* ─── Floating Bulk Action Bar ──────────────────────────────────── */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="flex items-center gap-3 px-5 py-3 bg-background border rounded-xl shadow-xl">
              <span className="text-sm font-medium whitespace-nowrap">
                {selectedIds.size} selected
              </span>
              <div className="w-px h-6 bg-border" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMoveTargetFolderId(null);
                  setShowMoveDialog(true);
                }}
              >
                <FolderInput className="w-4 h-4 mr-1" />
                Move
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowBulkDeleteConfirm(true)}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
              <div className="w-px h-6 bg-border" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedIds(new Set());
                  setIsSelectMode(false);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── New Design Dialog ─────────────────────────────────────────── */}
      <Dialog open={showNewDesign} onOpenChange={setShowNewDesign}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedCategory ? (
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="flex items-center gap-2 hover:text-brand-500 transition-colors"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                  {selectedCategory.name}
                </button>
              ) : (
                "Create New Design"
              )}
            </DialogTitle>
          </DialogHeader>

          {/* Category Selection */}
          {!selectedCategory && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              {DESIGN_CATEGORIES.map((cat) => {
                const CatIcon = categoryIcons[cat.id] || Palette;
                const gradient = categoryGradients[cat.id] || "from-gray-500 to-slate-500";
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat)}
                    className="flex flex-col items-center gap-3 p-5 rounded-xl border hover:border-brand-500/50 hover:bg-muted/50 transition-all group"
                  >
                    <div
                      className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center group-hover:scale-110 transition-transform`}
                    >
                      <CatIcon className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium">{cat.name}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {cat.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Size Presets */}
          {selectedCategory && (
            <div className="space-y-3 pt-2">
              <p className="text-sm text-muted-foreground">
                Choose a size preset to start designing:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {selectedCategory.presets.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => {
                      setShowNewDesign(false);
                      router.push(
                        `/studio?preset=${preset.width}x${preset.height}&category=${selectedCategory.id}`
                      );
                    }}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:border-brand-500/50 hover:bg-muted/50 transition-all text-left"
                  >
                    {/* Size preview thumbnail */}
                    <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                      <div
                        className="bg-brand-500/20 border border-brand-500/30 rounded-sm"
                        style={{
                          width: `${Math.min(
                            (preset.width / Math.max(preset.width, preset.height)) * 28,
                            28
                          )}px`,
                          height: `${Math.min(
                            (preset.height / Math.max(preset.width, preset.height)) * 28,
                            28
                          )}px`,
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{preset.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {preset.width} x {preset.height} px
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Create Folder Dialog ──────────────────────────────────────── */}
      <Dialog open={showCreateFolder} onOpenChange={setShowCreateFolder}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Folder Name</Label>
              <Input
                placeholder="e.g., Q1 Campaigns"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateFolder(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Move to Folder Dialog ─────────────────────────────────────── */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move to Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            <button
              onClick={() => setMoveTargetFolderId(null)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                moveTargetFolderId === null
                  ? "bg-brand-500/10 text-brand-600 font-medium"
                  : "hover:bg-muted text-muted-foreground"
              }`}
            >
              <FolderOpen className="w-4 h-4" />
              Root (No folder)
            </button>
            {allFoldersList.map((folder) => (
              <button
                key={folder.id}
                onClick={() => setMoveTargetFolderId(folder.id)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  moveTargetFolderId === folder.id
                    ? "bg-brand-500/10 text-brand-600 font-medium"
                    : "hover:bg-muted text-muted-foreground"
                }`}
              >
                <FolderOpen className="w-4 h-4" />
                {folder.name}
                <span className="text-xs opacity-60 ml-auto">
                  {folder.designCount}
                </span>
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowMoveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkMove} disabled={isBulkOperating}>
              {isBulkOperating ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <FolderInput className="w-4 h-4 mr-1" />
              )}
              Move {selectedIds.size} design{selectedIds.size > 1 ? "s" : ""}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Bulk Delete Confirmation ──────────────────────────────────── */}
      <Dialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Delete {selectedIds.size} design{selectedIds.size > 1 ? "s" : ""}?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This action cannot be undone. The selected designs will be permanently deleted.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowBulkDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={isBulkOperating}>
              {isBulkOperating ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-1" />
              )}
              Delete {selectedIds.size} design{selectedIds.size > 1 ? "s" : ""}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
