"use client";

import { useCallback, useEffect, useMemo, useState, type ElementType } from "react";
import Image from "next/image";
import {
  ImagePlay, Image as ImageIcon, Film, Play, ExternalLink, X, FileText, Music, LayoutGrid, Sparkles,
  Search, Folder, FolderPlus, FolderInput, Trash2, Pencil, Check, ChevronRight, CheckSquare, Square,
  Home, CornerUpLeft, AlertTriangle, FileCode, Download, Tag, Plus,
} from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { MediaUploader } from "@/components/shared/media-uploader";
import { cn } from "@/lib/utils/cn";

/**
 * Media library — a deep new-design surface (the Media workspace canvas): the
 * user's uploaded images & videos as a filterable grid with type + date, opened
 * in an in-surface lightbox (GET /api/media). KPIs roll up total assets, images,
 * and videos. "Upload" is a real in-UI action (MediaUploader → POST /api/media);
 * "Create with the agent" is the one genuinely generative action and drives the
 * chat. No legacy links — assets open in a lightbox or their live URL.
 *
 * Full library management lives in-surface: search by name (?search=), filter by
 * type (image/video/svg/audio/document pills) or by tag (?tag=), a folder rail
 * with create/rename/delete + breadcrumb browse (?folderId=), move a single file
 * (PUT /api/media/[id]) or many (select mode + /api/media/bulk), and delete one
 * (DELETE /api/media/[id]) or many — every destructive action uses an inline
 * two-step confirm, never window.confirm. Each file can be renamed, tagged
 * (PUT /api/media/[id] { originalName | tags }), and downloaded to disk (fetch the
 * url as a blob → anchor download).
 * [[surface-buttons-are-ui-actions]] [[new-design-no-legacy]]
 */

interface MediaItem {
  id: string;
  originalName?: string | null;
  filename?: string | null;
  url: string;
  type: string;
  mimeType?: string | null;
  size?: number | null;
  width?: number | null;
  height?: number | null;
  folderId?: string | null;
  tags?: string[] | null;
  createdAt: string;
  metadata?: { thumbnailUrl?: string; thumbnailUrlMd?: string; thumbnailUrlSm?: string } | null;
}

interface MediaFolder {
  id: string;
  name: string;
  parentId: string | null;
  fileCount: number;
  childCount: number;
  createdAt: string;
}

type FilterKey = "all" | "image" | "video" | "svg" | "audio" | "document";

// Each pill filters the loaded library client-side via `match`; only pills whose
// type is actually present in the current view are shown.
const FILTERS: { key: FilterKey; label: string; match: (t: string) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "image", label: "Images", match: (t) => t === "image" },
  { key: "video", label: "Videos", match: (t) => t === "video" },
  { key: "svg", label: "SVG", match: (t) => t === "svg" },
  { key: "audio", label: "Audio", match: (t) => t === "audio" },
  { key: "document", label: "Docs", match: (t) => t === "document" },
];

// "root" sentinel = the top-level (un-foldered) view; a string id = inside a folder.
type FolderScope = "root" | string;

function isImageLike(t: string): boolean {
  return t === "image" || t === "svg";
}

// Best thumbnail for a grid tile: images get the medium WebP variant; videos get
// their extracted first-frame JPEG; everything else falls back to the raw url.
function thumbOf(m: MediaItem): string {
  if (m.type === "video") return m.metadata?.thumbnailUrl || "";
  if (isImageLike(m.type)) return m.metadata?.thumbnailUrlMd || m.url;
  return "";
}

function whenLabel(iso: string): string {
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); } catch { return ""; }
}

function fileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function typeIcon(t: string): ElementType {
  if (t === "video") return Film;
  if (t === "audio") return Music;
  if (t === "document") return FileText;
  if (t === "svg") return FileCode;
  return ImageIcon;
}

const BULK_MAX = 50; // server caps /api/media/bulk at 50 ids per request

export function FocusedMedia({ refreshKey, onAsk }: { refreshKey?: number; onAsk?: (prompt: string) => void }) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [lightbox, setLightbox] = useState<MediaItem | null>(null);

  // folder browse + search
  const [scope, setScope] = useState<FolderScope>("root");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [fetching, setFetching] = useState(false);

  // folder mutations
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteFolder, setConfirmDeleteFolder] = useState<string | null>(null);
  const [folderBusy, setFolderBusy] = useState(false);

  // selection (multi-select bulk)
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkConfirmDelete, setBulkConfirmDelete] = useState(false);
  const [movePickerFor, setMovePickerFor] = useState<"bulk" | string | null>(null); // "bulk" or a fileId

  // single-file delete confirm (in lightbox)
  const [confirmDeleteFile, setConfirmDeleteFile] = useState<string | null>(null);
  const [fileBusy, setFileBusy] = useState(false);

  // rename a file (in lightbox)
  const [renamingFile, setRenamingFile] = useState(false);
  const [fileRenameValue, setFileRenameValue] = useState("");

  // tag editing (in lightbox) + tag filter (library)
  const [tagInput, setTagInput] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  // download progress (per file id)
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // debounce the search box
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadFolders = useCallback(async () => {
    try {
      const j = await fetch("/api/media/folders").then((r) => r.json());
      if (j?.success && Array.isArray(j.data?.folders)) setFolders(j.data.folders as MediaFolder[]);
    } catch { /* folders are non-fatal; the grid still works */ }
  }, []);

  const load = useCallback(async () => {
    setError("");
    setFetching(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      // Searching spans the whole library; otherwise scope to the open folder.
      if (debouncedSearch) params.set("search", debouncedSearch);
      else params.set("folderId", scope);
      // Tag filter is a global, server-side match (?tag=) across the library.
      if (tagFilter) {
        params.set("tag", tagFilter);
        params.delete("folderId");
      }
      const j = await fetch(`/api/media?${params.toString()}`).then((r) => r.json());
      if (j?.success && Array.isArray(j.data?.files)) {
        setItems(j.data.files as MediaItem[]);
      } else {
        setError(j?.error?.message || "Could not load your media.");
      }
    } catch {
      setError("Could not load your media.");
    } finally {
      setFetching(false);
    }
  }, [scope, debouncedSearch, tagFilter]);

  useEffect(() => {
    let alive = true;
    Promise.all([load(), loadFolders()]).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [load, loadFolders, refreshKey]);

  // Drop any stale selection when the visible set changes (folder/search/filter/tag).
  useEffect(() => { setSelected(new Set()); setBulkConfirmDelete(false); }, [scope, debouncedSearch, filter, tagFilter]);

  // Reset lightbox-local editors (rename / tag input) whenever a new file opens.
  useEffect(() => { setRenamingFile(false); setFileRenameValue(""); setTagInput(""); setConfirmDeleteFile(null); }, [lightbox?.id]);

  const counts = useMemo(() => {
    const by: Record<string, number> = {};
    let images = 0;
    let videos = 0;
    for (const m of items) {
      by[m.type] = (by[m.type] || 0) + 1;
      if (isImageLike(m.type)) images++;
      else if (m.type === "video") videos++;
    }
    return { total: items.length, images, videos, by };
  }, [items]);

  // Show a pill only when "all" or that type actually appears in the loaded view,
  // so SVG/Audio/Docs pills surface lazily as those assets exist.
  const activeFilters = useMemo(
    () => FILTERS.filter((f) => f.key === "all" || f.key === "image" || f.key === "video" || (counts.by[f.key] ?? 0) > 0),
    [counts]
  );

  const visible = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter) ?? FILTERS[0];
    if (filter === "all") return items;
    return items.filter((m) => f.match(m.type));
  }, [items, filter]);

  // If the active filter's type vanishes from the view (folder switch, deletes),
  // fall back to "All" so the grid never looks empty for a stale pill.
  useEffect(() => {
    if (filter !== "all" && !activeFilters.some((f) => f.key === filter)) setFilter("all");
  }, [activeFilters, filter]);

  // Folder helpers — the API returns a flat list with parentId; derive children
  // of the current scope and the breadcrumb chain from it.
  const folderById = useMemo(() => {
    const map = new Map<string, MediaFolder>();
    for (const f of folders) map.set(f.id, f);
    return map;
  }, [folders]);

  const childFolders = useMemo(() => {
    const parent = scope === "root" ? null : scope;
    return folders.filter((f) => (f.parentId ?? null) === parent);
  }, [folders, scope]);

  const breadcrumb = useMemo(() => {
    if (scope === "root") return [] as MediaFolder[];
    const chain: MediaFolder[] = [];
    let cur: string | null = scope;
    const seen = new Set<string>();
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      const f = folderById.get(cur);
      if (!f) break;
      chain.unshift(f);
      cur = f.parentId;
    }
    return chain;
  }, [scope, folderById]);

  const currentFolder = scope === "root" ? null : folderById.get(scope) || null;

  // After an upload finishes, MediaUploader hands back the URL — refresh the grid
  // so the new asset shows up (it has its own record + thumbnails server-side).
  const onUploaded = useCallback((urls: string[]) => {
    if (urls.length) { setUploadOpen(false); load(); loadFolders(); }
  }, [load, loadFolders]);

  // ── Folder mutations ──────────────────────────────────────────────────────
  const createFolder = useCallback(async () => {
    const name = newFolderName.trim();
    if (!name) return;
    setFolderBusy(true);
    try {
      const j = await fetch("/api/media/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentId: scope === "root" ? null : scope }),
      }).then((r) => r.json());
      if (j?.success) {
        setNewFolderOpen(false);
        setNewFolderName("");
        await loadFolders();
      } else {
        setError(j?.error?.message || "Could not create the folder.");
      }
    } catch {
      setError("Could not create the folder.");
    } finally {
      setFolderBusy(false);
    }
  }, [newFolderName, scope, loadFolders]);

  const renameFolder = useCallback(async (id: string) => {
    const name = renameValue.trim();
    if (!name) return;
    setFolderBusy(true);
    try {
      const j = await fetch(`/api/media/folders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }).then((r) => r.json());
      if (j?.success) {
        setRenamingId(null);
        setRenameValue("");
        await loadFolders();
      } else {
        setError(j?.error?.message || "Could not rename the folder.");
      }
    } catch {
      setError("Could not rename the folder.");
    } finally {
      setFolderBusy(false);
    }
  }, [renameValue, loadFolders]);

  const deleteFolder = useCallback(async (id: string) => {
    setFolderBusy(true);
    try {
      const j = await fetch(`/api/media/folders/${id}`, { method: "DELETE" }).then((r) => r.json());
      if (j?.success) {
        setConfirmDeleteFolder(null);
        // If we were viewing the deleted folder, hop back up to its parent.
        if (scope === id) setScope(folderById.get(id)?.parentId ?? "root");
        await Promise.all([loadFolders(), load()]);
      } else {
        setError(j?.error?.message || "Could not delete the folder.");
      }
    } catch {
      setError("Could not delete the folder.");
    } finally {
      setFolderBusy(false);
    }
  }, [scope, folderById, loadFolders, load]);

  // ── Single-file mutations ─────────────────────────────────────────────────
  const deleteFile = useCallback(async (id: string) => {
    setFileBusy(true);
    try {
      const j = await fetch(`/api/media/${id}`, { method: "DELETE" }).then((r) => r.json());
      if (j?.success) {
        setItems((prev) => prev.filter((m) => m.id !== id));
        setConfirmDeleteFile(null);
        if (lightbox?.id === id) setLightbox(null);
        loadFolders();
      } else {
        setError(j?.error?.message || "Could not delete the file.");
      }
    } catch {
      setError("Could not delete the file.");
    } finally {
      setFileBusy(false);
    }
  }, [lightbox, loadFolders]);

  const moveFile = useCallback(async (id: string, folderId: string | null) => {
    setFileBusy(true);
    try {
      const j = await fetch(`/api/media/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId }),
      }).then((r) => r.json());
      if (j?.success) {
        setMovePickerFor(null);
        // If the file moved out of the current scope, drop it from the grid. A
        // global view (search OR an active tag filter) spans every folder, so a
        // folder-move never changes membership there — keep the file in view.
        const stillHere = (debouncedSearch || tagFilter) ? true : (folderId ?? null) === (scope === "root" ? null : scope);
        if (!stillHere) {
          setItems((prev) => prev.filter((m) => m.id !== id));
          if (lightbox?.id === id) setLightbox(null);
        } else {
          setItems((prev) => prev.map((m) => (m.id === id ? { ...m, folderId } : m)));
        }
        loadFolders();
      } else {
        setError(j?.error?.message || "Could not move the file.");
      }
    } catch {
      setError("Could not move the file.");
    } finally {
      setFileBusy(false);
    }
  }, [scope, debouncedSearch, tagFilter, lightbox, loadFolders]);

  // Rename a file — PUT /api/media/[id] { originalName }. Patches the grid + the
  // open lightbox in place so the new name shows without a full re-fetch.
  const renameFile = useCallback(async (id: string) => {
    const name = fileRenameValue.trim();
    if (!name) return;
    setFileBusy(true);
    try {
      const j = await fetch(`/api/media/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originalName: name }),
      }).then((r) => r.json());
      if (j?.success) {
        setItems((prev) => prev.map((m) => (m.id === id ? { ...m, originalName: name } : m)));
        setLightbox((lb) => (lb && lb.id === id ? { ...lb, originalName: name } : lb));
        setRenamingFile(false);
      } else {
        setError(j?.error?.message || "Could not rename the file.");
      }
    } catch {
      setError("Could not rename the file.");
    } finally {
      setFileBusy(false);
    }
  }, [fileRenameValue]);

  // Set the full tag list — PUT /api/media/[id] { tags }. Used by both add + remove
  // (we always send the next array). Echoes the server's normalized tags back.
  const setFileTags = useCallback(async (id: string, nextTags: string[]) => {
    setFileBusy(true);
    try {
      const j = await fetch(`/api/media/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: nextTags }),
      }).then((r) => r.json());
      if (j?.success) {
        const saved: string[] = Array.isArray(j.data?.file?.tags) ? j.data.file.tags : nextTags;
        setItems((prev) => prev.map((m) => (m.id === id ? { ...m, tags: saved } : m)));
        setLightbox((lb) => (lb && lb.id === id ? { ...lb, tags: saved } : lb));
      } else {
        setError(j?.error?.message || "Could not update tags.");
      }
    } catch {
      setError("Could not update tags.");
    } finally {
      setFileBusy(false);
    }
  }, []);

  const addTag = useCallback((id: string, current: string[]) => {
    const t = tagInput.trim();
    if (!t) return;
    if (current.some((x) => x.toLowerCase() === t.toLowerCase())) { setTagInput(""); return; }
    setTagInput("");
    void setFileTags(id, [...current, t]);
  }, [tagInput, setFileTags]);

  const removeTag = useCallback((id: string, current: string[], t: string) => {
    void setFileTags(id, current.filter((x) => x !== t));
  }, [setFileTags]);

  // Download a file to disk — fetch the (presigned) url as a blob, then click a
  // synthetic anchor with `download`. Falls back to opening the url on failure.
  const downloadFile = useCallback(async (m: MediaItem) => {
    setDownloadingId(m.id);
    try {
      const res = await fetch(m.url);
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = m.originalName || m.filename || "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch {
      // Cross-origin/network hiccup — open the asset so the user can save it.
      window.open(m.url, "_blank", "noopener,noreferrer");
    } finally {
      setDownloadingId(null);
    }
  }, []);

  // ── Bulk mutations ────────────────────────────────────────────────────────
  const bulkDelete = useCallback(async () => {
    const ids = Array.from(selected).slice(0, BULK_MAX);
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      const j = await fetch("/api/media/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileIds: ids }),
      }).then((r) => r.json());
      if (j?.success) {
        const removed = new Set(ids);
        setItems((prev) => prev.filter((m) => !removed.has(m.id)));
        setSelected(new Set());
        setBulkConfirmDelete(false);
        setSelectMode(false);
        loadFolders();
      } else {
        setError(j?.error?.message || "Could not delete the files.");
      }
    } catch {
      setError("Could not delete the files.");
    } finally {
      setBulkBusy(false);
    }
  }, [selected, loadFolders]);

  const bulkMove = useCallback(async (folderId: string | null) => {
    const ids = Array.from(selected).slice(0, BULK_MAX);
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      const j = await fetch("/api/media/bulk", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileIds: ids, folderId }),
      }).then((r) => r.json());
      if (j?.success) {
        const moved = new Set(ids);
        // A global view (search OR tag filter) spans every folder — a folder move
        // doesn't change tag/name membership, so keep the moved files in view.
        const stayHere = (debouncedSearch || tagFilter) ? true : (folderId ?? null) === (scope === "root" ? null : scope);
        if (!stayHere) setItems((prev) => prev.filter((m) => !moved.has(m.id)));
        else setItems((prev) => prev.map((m) => (moved.has(m.id) ? { ...m, folderId } : m)));
        setSelected(new Set());
        setMovePickerFor(null);
        setSelectMode(false);
        loadFolders();
      } else {
        setError(j?.error?.message || "Could not move the files.");
      }
    } catch {
      setError("Could not move the files.");
    } finally {
      setBulkBusy(false);
    }
  }, [selected, scope, debouncedSearch, tagFilter, loadFolders]);

  const toggleSelected = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading your media…" /></div>;
  }

  const searching = debouncedSearch.length > 0;
  // A "global" view (search or an active tag filter) spans the whole library, so
  // folder navigation is hidden — the scope no longer drives the result set.
  const globalView = searching || !!tagFilter;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start">
        {/* LEFT: sticky summary + type nav + actions + folder navigation */}
        <aside className="space-y-3 lg:sticky lg:top-0 lg:w-[280px] lg:shrink-0">
          {/* summary card */}
          <div className="rounded-2xl border border-border bg-card p-3">
            <div className="flex items-center gap-2 px-1 pb-2"><LayoutGrid className="h-4 w-4 text-brand-500" /><span className="text-[12.5px] font-bold">Media library</span></div>
            <div className="grid grid-cols-3 gap-2">
              <SummaryStat label="Total" value={counts.total.toLocaleString()} />
              <SummaryStat label="Images" value={counts.images.toLocaleString()} />
              <SummaryStat label="Videos" value={counts.videos.toLocaleString()} />
            </div>
          </div>

          {/* primary actions — Upload (real input) + Select (multi-select) */}
          <div className="space-y-2">
            <button onClick={() => setUploadOpen((v) => !v)} className="inline-flex w-full items-center justify-center gap-1.5 rounded-[12px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30">
              <ImagePlay className="h-4 w-4" /> Upload
            </button>
            <button
              onClick={() => { setSelectMode((v) => !v); setSelected(new Set()); setBulkConfirmDelete(false); }}
              className={cn(
                "inline-flex w-full items-center justify-center gap-1.5 rounded-[12px] border px-3.5 py-2 text-[12.5px] font-semibold transition",
                selectMode ? "border-brand-500/60 bg-brand-500/10 text-brand-500" : "border-border text-muted-foreground hover:border-brand-500/60 hover:text-foreground"
              )}
            >
              <CheckSquare className="h-3.5 w-3.5" /> {selectMode ? "Done selecting" : "Select files"}
            </button>
          </div>

          {/* search */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search files…"
              className="w-full rounded-[10px] border border-border bg-background py-1.5 pl-9 pr-9 text-[13px] outline-none transition focus:border-brand-500/60"
            />
            {search ? (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Clear search">
                <X className="h-3.5 w-3.5" />
              </button>
            ) : fetching ? (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2"><FlowLoader size={16} /></span>
            ) : null}
          </div>

          {/* type filter nav — vertical, one row per type */}
          <nav className="rounded-2xl border border-border bg-card p-1.5">
            {activeFilters.map((f) => {
              const n = f.key === "all" ? counts.total : (counts.by[f.key] ?? 0);
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-semibold transition-colors",
                    active ? "bg-brand-500/10 text-brand-500" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  <span className="flex-1 text-start">{f.label}</span>
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums", active ? "bg-brand-500/15 text-brand-500" : "bg-muted text-muted-foreground")}>{n}</span>
                </button>
              );
            })}
          </nav>

          {/* folder navigation — breadcrumb + new-folder (hidden in a global view) */}
          {!globalView && (
            <div className="rounded-2xl border border-border bg-card p-3">
              <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
                <button
                  onClick={() => setScope("root")}
                  className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-1 font-semibold transition", scope === "root" ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  <Home className="h-3.5 w-3.5" /> Library
                </button>
                {breadcrumb.map((f) => (
                  <span key={f.id} className="inline-flex min-w-0 items-center gap-1">
                    <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <button
                      onClick={() => setScope(f.id)}
                      className={cn("min-w-0 truncate rounded-md px-1.5 py-1 font-semibold transition", scope === f.id ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
                    >
                      {f.name}
                    </button>
                  </span>
                ))}
              </div>
              <button
                onClick={() => { setNewFolderOpen((v) => !v); setNewFolderName(""); }}
                className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-border px-2.5 py-1.5 text-[11.5px] font-semibold text-muted-foreground transition hover:border-brand-500/60 hover:text-foreground"
              >
                <FolderPlus className="h-3.5 w-3.5" /> New folder
              </button>
              {/* new folder inline form */}
              {newFolderOpen && (
                <div className="mt-2 flex items-center gap-1.5 rounded-xl border border-brand-500/30 bg-brand-500/5 p-2">
                  <FolderPlus className="h-4 w-4 shrink-0 text-brand-500" />
                  <input
                    autoFocus
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") createFolder(); if (e.key === "Escape") setNewFolderOpen(false); }}
                    placeholder={currentFolder ? `In ${currentFolder.name}` : "Folder name"}
                    className="min-w-0 flex-1 rounded-[10px] border border-border bg-background px-2 py-1.5 text-[12.5px] outline-none transition focus:border-brand-500/60"
                  />
                  <button
                    onClick={createFolder}
                    disabled={folderBusy || !newFolderName.trim()}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 text-white shadow-sm disabled:opacity-50"
                    aria-label="Create folder"
                  >
                    {folderBusy ? <FlowLoader size={14} tone="white" /> : <Check className="h-3.5 w-3.5" />}
                  </button>
                </div>
              )}
            </div>
          )}
        </aside>

        {/* RIGHT: folders + gallery grid — full width */}
        <div className="min-w-0 flex-1 space-y-4">
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          {/* folder rail — subfolders of the current scope */}
          {!globalView && childFolders.length > 0 && (
            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {childFolders.map((f) => (
                <div key={f.id} className="group/folder relative rounded-xl border border-border bg-muted/30 transition hover:border-brand-500/60">
                  {renamingId === f.id ? (
                    <div className="flex items-center gap-1.5 p-2.5">
                      <Folder className="h-4 w-4 shrink-0 text-brand-500" />
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") renameFolder(f.id); if (e.key === "Escape") setRenamingId(null); }}
                        className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-[12.5px] outline-none focus:border-brand-500/60"
                      />
                      <button onClick={() => renameFolder(f.id)} disabled={folderBusy} className="text-brand-500 disabled:opacity-50" aria-label="Save name">
                        {folderBusy ? <FlowLoader size={14} /> : <Check className="h-4 w-4" />}
                      </button>
                      <button onClick={() => setRenamingId(null)} className="text-muted-foreground hover:text-foreground" aria-label="Cancel rename"><X className="h-4 w-4" /></button>
                    </div>
                  ) : confirmDeleteFolder === f.id ? (
                    <div className="flex flex-col gap-1.5 p-2.5">
                      <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-rose-500"><AlertTriangle className="h-3.5 w-3.5" /> Delete folder?</p>
                      <p className="text-[11px] text-muted-foreground">Files move to the library; subfolders move up.</p>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => deleteFolder(f.id)} disabled={folderBusy} className="inline-flex items-center gap-1 rounded-md bg-rose-500 px-2.5 py-1 text-[11.5px] font-semibold text-white disabled:opacity-50">
                          {folderBusy ? <FlowLoader size={12} tone="white" /> : <Trash2 className="h-3 w-3" />} Delete
                        </button>
                        <button onClick={() => setConfirmDeleteFolder(null)} className="rounded-md border border-border px-2.5 py-1 text-[11.5px] font-semibold text-muted-foreground hover:text-foreground">Keep</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-2.5">
                      <button onClick={() => setScope(f.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-500/10 text-brand-500"><Folder className="h-4.5 w-4.5" /></span>
                        <span className="min-w-0">
                          <span className="block truncate text-[12.5px] font-semibold">{f.name}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">{f.fileCount} {f.fileCount === 1 ? "file" : "files"}{f.childCount ? ` · ${f.childCount} folder${f.childCount === 1 ? "" : "s"}` : ""}</span>
                        </span>
                      </button>
                      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover/folder:opacity-100">
                        <button onClick={() => { setRenamingId(f.id); setRenameValue(f.name); }} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground" aria-label="Rename folder"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => setConfirmDeleteFolder(f.id)} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500" aria-label="Delete folder"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* active tag filter banner (set from a file's tag chip) */}
          {tagFilter && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-brand-500/30 bg-brand-500/5 px-3 py-2">
              <Tag className="h-3.5 w-3.5 shrink-0 text-brand-500" />
              <span className="text-[12.5px]">
                Filtering by tag <span className="font-semibold text-brand-500">#{tagFilter}</span>
                <span className="ms-1.5 text-muted-foreground">· {visible.length} {visible.length === 1 ? "file" : "files"}</span>
              </span>
              <button
                onClick={() => setTagFilter(null)}
                className="ms-auto inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11.5px] font-semibold text-muted-foreground transition hover:text-foreground"
              >
                <X className="h-3 w-3" /> Clear tag
              </button>
            </div>
          )}

          {/* inline uploader — clicking "Upload" opens this real input, not a chat prompt */}
          {uploadOpen && (
            <div className="mb-3 rounded-xl border border-brand-500/30 bg-brand-500/5 p-3.5">
              <p className="mb-2.5 text-[12.5px] font-semibold">Upload images or videos</p>
              <MediaUploader
                value={[]}
                onChange={onUploaded}
                multiple
                accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,image/gif,video/mp4,video/webm,video/quicktime"
                maxSize={500 * 1024 * 1024}
                filterTypes={["image", "video"]}
                variant="large"
                placeholder="Upload"
                showButtons
              />
              <p className="mt-2 text-[11px] text-muted-foreground">Uploaded files are added to your library{currentFolder ? " — move them into this folder after upload" : ""}.</p>
            </div>
          )}

          {error ? (
            <div className="rounded-xl border border-dashed border-rose-500/40 bg-rose-500/5 px-4 py-8 text-center">
              <p className="text-[13px] font-medium text-rose-500">{error}</p>
              <button onClick={() => { setLoading(true); Promise.all([load(), loadFolders()]).finally(() => setLoading(false)); }} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] border border-border px-4 py-2 text-[13px] font-semibold hover:border-brand-500/60 hover:text-foreground">Try again</button>
            </div>
          ) : visible.length ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {visible.map((m) => {
                const thumb = thumbOf(m);
                const isVideo = m.type === "video";
                const Icon = typeIcon(m.type);
                const isSelected = selected.has(m.id);
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "group relative overflow-hidden rounded-xl border bg-muted/30 text-left transition",
                      isSelected ? "border-brand-500 ring-2 ring-brand-500/40" : "border-border hover:border-brand-500/60"
                    )}
                  >
                    <button
                      onClick={() => { if (selectMode) toggleSelected(m.id); else setLightbox(m); }}
                      className="block w-full"
                    >
                      <div className="relative grid aspect-square place-items-center bg-background">
                        {thumb ? (
                          <Image src={thumb} alt={m.originalName || ""} width={240} height={240} className="h-full w-full object-cover" unoptimized />
                        ) : (
                          <Icon className="h-6 w-6 text-muted-foreground" />
                        )}
                        {isVideo && (
                          <span className="absolute inset-0 grid place-items-center bg-black/15">
                            <span className="grid h-9 w-9 place-items-center rounded-full bg-black/55 text-white shadow-lg"><Play className="h-4 w-4 fill-white/30" /></span>
                          </span>
                        )}
                        <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-md bg-background/85 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
                          <Icon className="h-2.5 w-2.5" /> {m.type}
                        </span>
                        {/* selection checkbox (visible in select mode or on hover) */}
                        <span
                          onClick={(e) => { e.stopPropagation(); if (!selectMode) setSelectMode(true); toggleSelected(m.id); }}
                          className={cn(
                            "absolute right-1.5 top-1.5 grid h-7 w-7 cursor-pointer place-items-center rounded-md bg-background/85 backdrop-blur-sm transition",
                            selectMode || isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                            isSelected ? "text-brand-500" : "text-muted-foreground"
                          )}
                          role="checkbox"
                          aria-checked={isSelected}
                        >
                          {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                        </span>
                        {/* quick download (hidden in select mode to avoid mis-taps) */}
                        {!selectMode && (
                          <span
                            onClick={(e) => { e.stopPropagation(); if (downloadingId !== m.id) downloadFile(m); }}
                            className="absolute bottom-1.5 right-1.5 grid h-7 w-7 cursor-pointer place-items-center rounded-md bg-background/85 text-muted-foreground opacity-0 backdrop-blur-sm transition hover:text-foreground group-hover:opacity-100"
                            role="button"
                            aria-label="Download file"
                          >
                            {downloadingId === m.id ? <FlowLoader size={14} /> : <Download className="h-4 w-4" />}
                          </span>
                        )}
                      </div>
                      <div className="p-2.5">
                        <p className="truncate text-[12.5px] font-medium">{m.originalName || m.filename || "Untitled"}</p>
                        <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{[whenLabel(m.createdAt), fileSize(m.size)].filter(Boolean).join(" · ")}</p>
                        {!!m.tags?.length && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {m.tags.slice(0, 3).map((t) => (
                              <span
                                key={t}
                                onClick={(e) => { e.stopPropagation(); setTagFilter(t); setFilter("all"); }}
                                className={cn(
                                  "inline-flex max-w-full cursor-pointer items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold transition",
                                  tagFilter === t ? "border-brand-500/60 bg-brand-500/10 text-brand-500" : "border-border bg-muted/40 text-muted-foreground hover:text-foreground"
                                )}
                                role="button"
                              >
                                <Tag className="h-2.5 w-2.5 shrink-0" /> <span className="truncate">{t}</span>
                              </span>
                            ))}
                            {m.tags.length > 3 && <span className="text-[10px] font-medium text-muted-foreground">+{m.tags.length - 3}</span>}
                          </div>
                        )}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><ImagePlay className="h-7 w-7" /></span>
              <p className="mt-3 text-[13px] font-medium">
                {searching ? `No files match “${debouncedSearch}”`
                  : tagFilter ? `No files tagged #${tagFilter}`
                  : items.length ? `No ${(FILTERS.find((f) => f.key === filter)?.label || "files").toLowerCase()} ${currentFolder ? `in ${currentFolder.name}` : "here"}`
                  : currentFolder ? `${currentFolder.name} is empty`
                  : "Your media library is empty"}
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                {searching ? "Try a different name, or clear the search."
                  : tagFilter ? "Clear the tag filter, or tag more files to see them here."
                  : items.length ? "Switch filters or upload more to see them here."
                  : "Upload images and videos, or have the agent create some for you."}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <button onClick={() => setUploadOpen(true)} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"><ImagePlay className="h-4 w-4" /> Upload media</button>
                {onAsk && !globalView && (
                  <button onClick={() => onAsk("Create some images for my brand — ask me what I need (product shots, social posts, a logo), then generate them and save them to my media library.")} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-4 py-2 text-[13px] font-semibold hover:border-brand-500/60 hover:text-foreground"><Sparkles className="h-4 w-4" /> Create with the agent</button>
                )}
              </div>
            </div>
          )}
          </section>
        </div>
      </div>

      {/* floating bulk action bar — appears when files are selected */}
      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-5 z-[110] flex justify-center px-4">
          <div className="flex max-w-full flex-wrap items-center gap-2 rounded-2xl border border-border bg-card/95 px-3 py-2.5 shadow-2xl backdrop-blur-sm">
            <span className="px-1 text-[12.5px] font-semibold">{selected.size} selected</span>
            {selected.size > BULK_MAX && (
              <span className="text-[11px] font-medium text-amber-500">Only first {BULK_MAX} apply</span>
            )}
            <div className="mx-1 h-5 w-px bg-border" />
            <button
              onClick={() => setMovePickerFor("bulk")}
              disabled={bulkBusy}
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12.5px] font-semibold transition hover:border-brand-500/60 hover:text-foreground disabled:opacity-50"
            >
              <FolderInput className="h-3.5 w-3.5" /> Move
            </button>
            {bulkConfirmDelete ? (
              <span className="inline-flex items-center gap-1.5">
                <button onClick={bulkDelete} disabled={bulkBusy} className="inline-flex items-center gap-1.5 rounded-[10px] bg-rose-500 px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50">
                  {bulkBusy ? <FlowLoader size={14} tone="white" /> : <Trash2 className="h-3.5 w-3.5" />} Confirm delete
                </button>
                <button onClick={() => setBulkConfirmDelete(false)} className="rounded-[10px] border border-border px-3 py-1.5 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground">Cancel</button>
              </span>
            ) : (
              <button
                onClick={() => setBulkConfirmDelete(true)}
                disabled={bulkBusy}
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-rose-500/40 px-3 py-1.5 text-[12.5px] font-semibold text-rose-500 transition hover:bg-rose-500/10 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            )}
            <button onClick={() => { setSelected(new Set()); setBulkConfirmDelete(false); }} className="grid h-8 w-8 place-items-center rounded-[10px] text-muted-foreground hover:text-foreground" aria-label="Clear selection"><X className="h-4 w-4" /></button>
          </div>
        </div>
      )}

      {/* folder picker — shared by single move (movePickerFor = fileId) and bulk (="bulk") */}
      {movePickerFor && (
        <FolderPicker
          folders={folders}
          // For a single file, "current" is that file's own folder (it may differ
          // from the browse scope in a search/tag view); bulk uses the open scope.
          currentFolderId={
            movePickerFor === "bulk"
              ? (currentFolder?.id ?? null)
              : (items.find((m) => m.id === movePickerFor)?.folderId ?? null)
          }
          busy={movePickerFor === "bulk" ? bulkBusy : fileBusy}
          title={movePickerFor === "bulk" ? `Move ${Math.min(selected.size, BULK_MAX)} file${Math.min(selected.size, BULK_MAX) === 1 ? "" : "s"} to…` : "Move file to…"}
          onClose={() => setMovePickerFor(null)}
          onPick={(folderId) => {
            if (movePickerFor === "bulk") bulkMove(folderId);
            else moveFile(movePickerFor, folderId);
          }}
        />
      )}

      {/* lightbox — opens the asset in-surface; "Open original" links to the live URL */}
      {lightbox && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-white/75 p-4 backdrop-blur-sm dark:bg-background/75" onClick={() => { setLightbox(null); setConfirmDeleteFile(null); }}>
          <button onClick={() => { setLightbox(null); setConfirmDeleteFile(null); }} className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full border border-border bg-background/95 text-foreground shadow-lg transition hover:bg-background">
            <X className="h-5 w-5" /><span className="sr-only">Close</span>
          </button>
          <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="grid min-h-0 flex-1 place-items-center bg-black/90">
              {lightbox.type === "video" ? (
                <video src={lightbox.url} controls autoPlay playsInline preload="metadata" className="max-h-[78vh] w-full bg-black object-contain" />
              ) : isImageLike(lightbox.type) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={lightbox.url} alt={lightbox.originalName || ""} className="max-h-[78vh] w-full bg-background object-contain" />
              ) : (
                <div className="grid place-items-center px-6 py-16 text-center">
                  <span className="grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground"><FileText className="h-7 w-7" /></span>
                  <p className="mt-3 text-[13px] font-medium text-white">{lightbox.originalName || "File"}</p>
                </div>
              )}
            </div>
            <div className="border-t border-border bg-card px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <div className="min-w-0 flex-1">
                  {renamingFile ? (
                    <div className="flex items-center gap-1.5">
                      <Pencil className="h-3.5 w-3.5 shrink-0 text-brand-500" />
                      <input
                        autoFocus
                        value={fileRenameValue}
                        onChange={(e) => setFileRenameValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") renameFile(lightbox.id); if (e.key === "Escape") setRenamingFile(false); }}
                        className="min-w-0 flex-1 rounded-[10px] border border-border bg-background px-2.5 py-1.5 text-[13px] outline-none transition focus:border-brand-500/60"
                      />
                      <button onClick={() => renameFile(lightbox.id)} disabled={fileBusy || !fileRenameValue.trim()} className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-brand-500 to-violet-500 px-2.5 py-1.5 text-[11.5px] font-semibold text-white disabled:opacity-50" aria-label="Save name">
                        {fileBusy ? <FlowLoader size={12} tone="white" /> : <Check className="h-3.5 w-3.5" />}
                      </button>
                      <button onClick={() => setRenamingFile(false)} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:text-foreground" aria-label="Cancel rename"><X className="h-4 w-4" /></button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setRenamingFile(true); setFileRenameValue(lightbox.originalName || lightbox.filename || ""); }}
                      className="group/name flex max-w-full items-center gap-1.5 text-left"
                      aria-label="Rename file"
                    >
                      <span className="truncate text-[13px] font-semibold">{lightbox.originalName || lightbox.filename || "Untitled"}</span>
                      <Pencil className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition group-hover/name:opacity-100" />
                    </button>
                  )}
                  <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{[lightbox.type, whenLabel(lightbox.createdAt), fileSize(lightbox.size), lightbox.width && lightbox.height ? `${lightbox.width}×${lightbox.height}` : ""].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="ms-auto flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => { if (downloadingId !== lightbox.id) downloadFile(lightbox); }}
                    disabled={downloadingId === lightbox.id}
                    className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12.5px] font-semibold hover:border-brand-500/60 hover:text-foreground disabled:opacity-50"
                  >
                    {downloadingId === lightbox.id ? <FlowLoader size={14} /> : <Download className="h-3.5 w-3.5" />} Download
                  </button>
                  <button
                    onClick={() => setMovePickerFor(lightbox.id)}
                    disabled={fileBusy}
                    className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12.5px] font-semibold hover:border-brand-500/60 hover:text-foreground disabled:opacity-50"
                  >
                    <FolderInput className="h-3.5 w-3.5" /> Move
                  </button>
                  <a href={lightbox.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12.5px] font-semibold hover:border-brand-500/60 hover:text-foreground">
                    <ExternalLink className="h-3.5 w-3.5" /> Open original
                  </a>
                  {confirmDeleteFile === lightbox.id ? (
                    <span className="inline-flex items-center gap-1.5 rounded-[10px] border border-rose-500/40 bg-rose-500/5 px-1.5 py-1">
                      <span className="px-1 text-[11.5px] font-semibold text-rose-500">Delete?</span>
                      <button onClick={() => deleteFile(lightbox.id)} disabled={fileBusy} className="inline-flex items-center gap-1 rounded-md bg-rose-500 px-2.5 py-1 text-[11.5px] font-semibold text-white disabled:opacity-50">
                        {fileBusy ? <FlowLoader size={12} tone="white" /> : <Trash2 className="h-3 w-3" />} Yes
                      </button>
                      <button onClick={() => setConfirmDeleteFile(null)} className="rounded-md px-2 py-1 text-[11.5px] font-semibold text-muted-foreground hover:text-foreground">No</button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteFile(lightbox.id)}
                      className="inline-flex items-center gap-1.5 rounded-[10px] border border-rose-500/40 px-3 py-1.5 text-[12.5px] font-semibold text-rose-500 transition hover:bg-rose-500/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  )}
                </div>
              </div>

              {/* tags — view, remove (×), add, and jump to a tag filter */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
                <Tag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                {(lightbox.tags ?? []).map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 py-0.5 pl-2 pr-1 text-[11.5px] font-semibold">
                    <button
                      onClick={() => { setTagFilter(t); setFilter("all"); setLightbox(null); }}
                      className="text-muted-foreground transition hover:text-brand-500"
                      aria-label={`Filter by ${t}`}
                    >
                      {t}
                    </button>
                    <button
                      onClick={() => removeTag(lightbox.id, lightbox.tags ?? [], t)}
                      disabled={fileBusy}
                      className="grid h-4 w-4 place-items-center rounded text-muted-foreground transition hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-50"
                      aria-label={`Remove tag ${t}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {!(lightbox.tags ?? []).length && <span className="text-[11.5px] text-muted-foreground">No tags yet</span>}
                <span className="ms-auto inline-flex items-center gap-1.5">
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(lightbox.id, lightbox.tags ?? []); } }}
                    placeholder="Add a tag…"
                    className="w-32 rounded-[10px] border border-border bg-background px-2.5 py-1 text-[12px] outline-none transition focus:border-brand-500/60"
                  />
                  <button
                    onClick={() => addTag(lightbox.id, lightbox.tags ?? [])}
                    disabled={fileBusy || !tagInput.trim()}
                    className="inline-flex items-center gap-1 rounded-[10px] border border-border px-2.5 py-1 text-[12px] font-semibold text-muted-foreground transition hover:border-brand-500/60 hover:text-foreground disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * FolderPicker — a small modal listing every folder (indented by depth) plus a
 * "Library (root)" option, used for both single and bulk moves.
 */
function FolderPicker({
  folders, currentFolderId, busy, title, onClose, onPick,
}: {
  folders: MediaFolder[];
  currentFolderId: string | null;
  busy: boolean;
  title: string;
  onClose: () => void;
  onPick: (folderId: string | null) => void;
}) {
  // Build an indented, parent-first ordering from the flat list.
  const ordered = useMemo(() => {
    const byParent = new Map<string | null, MediaFolder[]>();
    for (const f of folders) {
      const key = f.parentId ?? null;
      const arr = byParent.get(key) || [];
      arr.push(f);
      byParent.set(key, arr);
    }
    const out: { folder: MediaFolder; depth: number }[] = [];
    const walk = (parent: string | null, depth: number) => {
      const kids = (byParent.get(parent) || []).slice().sort((a, b) => a.name.localeCompare(b.name));
      for (const k of kids) {
        out.push({ folder: k, depth });
        walk(k.id, depth + 1);
      }
    };
    walk(null, 0);
    return out;
  }, [folders]);

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-white/75 p-4 backdrop-blur-sm dark:bg-background/75" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h4 className="text-[13px] font-bold">{title}</h4>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-[10px] text-muted-foreground hover:text-foreground" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <button
            onClick={() => onPick(null)}
            disabled={busy || currentFolderId === null}
            className={cn(
              "flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-[13px] font-semibold transition",
              currentFolderId === null ? "cursor-default text-muted-foreground" : "hover:bg-muted/60"
            )}
          >
            <CornerUpLeft className="h-4 w-4 text-muted-foreground" /> Library (no folder)
            {currentFolderId === null && <span className="ms-auto text-[11px] font-medium text-muted-foreground">Current</span>}
          </button>
          {ordered.length === 0 ? (
            <p className="px-2.5 py-6 text-center text-[12px] text-muted-foreground">No folders yet. Create one from the library first.</p>
          ) : (
            ordered.map(({ folder, depth }) => (
              <button
                key={folder.id}
                onClick={() => onPick(folder.id)}
                disabled={busy || currentFolderId === folder.id}
                style={{ paddingLeft: 10 + depth * 16 }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-[10px] py-2 pr-2.5 text-left text-[13px] transition",
                  currentFolderId === folder.id ? "cursor-default text-muted-foreground" : "hover:bg-muted/60"
                )}
              >
                <Folder className="h-4 w-4 shrink-0 text-brand-500" />
                <span className="min-w-0 flex-1 truncate font-medium">{folder.name}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{folder.fileCount}</span>
                {currentFolderId === folder.id && <span className="shrink-0 text-[11px] font-medium text-muted-foreground">Current</span>}
              </button>
            ))
          )}
        </div>
        {busy && (
          <div className="flex items-center justify-center gap-2 border-t border-border px-4 py-3 text-[12px] text-muted-foreground">
            <FlowLoader size={16} /> Moving…
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-1.5 py-2 text-center">
      <p className="text-[16px] font-extrabold leading-none">{value}</p>
      <p className="mt-1 text-[10px] font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
