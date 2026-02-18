"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  FolderOpen,
  Upload,
  Search,
  Grid3X3,
  List,
  Image,
  Video,
  FileText,
  File,
  FolderPlus,
  Trash2,
  Tag,
  Copy,
  Check,
  X,
  Loader2,
  MoreVertical,
  Pencil,
  FolderInput,
  ChevronRight,
  Sparkles,
  Star,
  Hash,
  Lightbulb,
  MessageSquare,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useToast } from "@/hooks/use-toast";
import { FileDropZone } from "@/components/shared/file-drop-zone";

interface MediaFile {
  id: string;
  filename: string;
  originalName: string;
  url: string;
  type: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  folderId: string | null;
  folder?: { id: string; name: string } | null;
  tags: string[];
  metadata?: { thumbnailUrl?: string; [key: string]: unknown };
  createdAt: string;
}

interface MediaFolder {
  id: string;
  name: string;
  parentId: string | null;
  fileCount: number;
  childCount: number;
  createdAt: string;
}

interface GeneratedContentItem {
  id: string;
  type: string;
  content: string;
  prompt: string;
  platforms: string;
  settings: string;
  isFavorite: boolean;
  isUsed: boolean;
  createdAt: string;
}

const contentTypeLabels: Record<string, string> = {
  post: "Post",
  caption: "Caption",
  hashtags: "Hashtags",
  ideas: "Ideas",
  auto_social_post: "Auto Post",
  auto_caption: "Auto Caption",
  auto_hashtags: "Auto Hashtags",
  auto_ideas: "Auto Ideas",
  auto_thread: "Auto Thread",
};

const contentTypeIcons: Record<string, React.ElementType> = {
  post: Type,
  caption: MessageSquare,
  hashtags: Hash,
  ideas: Lightbulb,
};

const typeIcons: Record<string, React.ElementType> = {
  image: Image,
  video: Video,
  document: FileText,
  svg: File,
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function MediaLibraryPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<"media" | "content">("media");

  const [files, setFiles] = useState<MediaFile[]>([]);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  // Generated Content state
  const [generatedContent, setGeneratedContent] = useState<GeneratedContentItem[]>([]);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentFilter, setContentFilter] = useState<string | null>(null);
  const [contentSearch, setContentSearch] = useState("");
  const [copiedContent, setCopiedContent] = useState<string | null>(null);

  // Dialogs
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Tag editing
  const [editingTags, setEditingTags] = useState(false);
  const [newTag, setNewTag] = useState("");

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (activeFolderId) params.set("folderId", activeFolderId);
      if (activeFilter) params.set("type", activeFilter);
      if (searchQuery) params.set("search", searchQuery);

      const [filesRes, foldersRes] = await Promise.all([
        fetch(`/api/media?${params}`),
        fetch("/api/media/folders"),
      ]);

      const filesData = await filesRes.json();
      const foldersData = await foldersRes.json();

      if (filesData.success) setFiles(filesData.data.files);
      if (foldersData.success) setFolders(foldersData.data.folders);
    } catch (error) {
      console.error("Failed to fetch media:", error);
    } finally {
      setIsLoading(false);
    }
  }, [activeFolderId, activeFilter, searchQuery]);

  const fetchGeneratedContent = useCallback(async () => {
    try {
      setContentLoading(true);
      const params = new URLSearchParams();
      if (contentFilter) params.set("type", contentFilter);
      if (contentSearch) params.set("search", contentSearch);

      const res = await fetch(`/api/content-library?${params}`);
      const data = await res.json();
      if (data.success) setGeneratedContent(data.data.items);
    } catch (error) {
      console.error("Failed to fetch generated content:", error);
    } finally {
      setContentLoading(false);
    }
  }, [contentFilter, contentSearch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (activeTab === "content") {
      fetchGeneratedContent();
    }
  }, [activeTab, fetchGeneratedContent]);

  const uploadMediaFile = useCallback(async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (activeFolderId) formData.append("folderId", activeFolderId);

      const res = await fetch("/api/media", { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) {
        toast({ title: "File uploaded!" });
        fetchData();
      }
    } catch {
      toast({ title: "Failed to upload file", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  }, [activeFolderId, fetchData, toast]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadFiles = e.target.files;
    if (!uploadFiles || uploadFiles.length === 0) return;

    setIsUploading(true);
    let successCount = 0;

    for (const file of Array.from(uploadFiles)) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        if (activeFolderId) formData.append("folderId", activeFolderId);

        const res = await fetch("/api/media", { method: "POST", body: formData });
        const data = await res.json();
        if (data.success) successCount++;
      } catch {
        // Continue with other files
      }
    }

    if (successCount > 0) {
      toast({ title: `${successCount} file${successCount > 1 ? "s" : ""} uploaded!` });
      fetchData();
    }
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const res = await fetch("/api/media/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFolderName, parentId: activeFolderId }),
      });
      const data = await res.json();
      if (data.success) {
        setFolders((prev) => [...prev, data.data.folder]);
        setNewFolderName("");
        setShowCreateFolder(false);
        toast({ title: "Folder created!" });
      }
    } catch {
      toast({ title: "Failed to create folder", variant: "destructive" });
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      const res = await fetch(`/api/media/${fileId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setFiles((prev) => prev.filter((f) => f.id !== fileId));
        setSelectedFile(null);
        toast({ title: "File deleted" });
      }
    } catch {
      toast({ title: "Failed to delete file", variant: "destructive" });
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    try {
      const res = await fetch(`/api/media/folders/${folderId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setFolders((prev) => prev.filter((f) => f.id !== folderId));
        if (activeFolderId === folderId) setActiveFolderId(null);
        toast({ title: "Folder deleted (files moved to root)" });
        fetchData();
      }
    } catch {
      toast({ title: "Failed to delete folder", variant: "destructive" });
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(window.location.origin + url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
    toast({ title: "URL copied!" });
  };

  const handleToggleFavorite = async (item: GeneratedContentItem) => {
    try {
      await fetch("/api/content-library", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, isFavorite: !item.isFavorite }),
      });
      setGeneratedContent((prev) =>
        prev.map((c) => c.id === item.id ? { ...c, isFavorite: !c.isFavorite } : c)
      );
    } catch {
      toast({ title: "Failed to update", variant: "destructive" });
    }
  };

  const handleDeleteContent = async (id: string) => {
    try {
      const res = await fetch(`/api/content-library?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setGeneratedContent((prev) => prev.filter((c) => c.id !== id));
        toast({ title: "Content deleted" });
      }
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const handleCopyContent = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedContent(id);
    setTimeout(() => setCopiedContent(null), 2000);
    toast({ title: "Content copied!" });
  };

  const handleUpdateTags = async (fileId: string, tags: string[]) => {
    try {
      await fetch(`/api/media/${fileId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags }),
      });
      setFiles((prev) => prev.map((f) => f.id === fileId ? { ...f, tags } : f));
      if (selectedFile?.id === fileId) setSelectedFile({ ...selectedFile, tags });
    } catch {
      toast({ title: "Failed to update tags", variant: "destructive" });
    }
  };

  const currentFolders = folders.filter((f) =>
    activeFolderId ? f.parentId === activeFolderId : !f.parentId
  );

  const typeFilters = [
    { id: null, label: "All Files", icon: FolderOpen },
    { id: "image", label: "Images", icon: Image },
    { id: "video", label: "Videos", icon: Video },
    { id: "svg", label: "SVG", icon: File },
    { id: "document", label: "Documents", icon: FileText },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <FolderOpen className="w-6 h-6 text-white" />
            </div>
            Media Library
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage all your uploaded files, images, and AI-generated content
          </p>
        </div>
        <FileDropZone
          onFileDrop={uploadMediaFile}
          accept="image/*,video/mp4,video/webm,video/quicktime,application/pdf"
          disabled={isUploading}
          dragLabel="Drop file to upload"
        >
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/mp4,video/webm,video/quicktime,application/pdf"
              className="hidden"
              onChange={handleUpload}
            />
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
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="bg-brand-500 hover:bg-brand-600"
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-1" />
              )}
              Upload Files
            </Button>
          </div>
        </FileDropZone>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab("media")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "media"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FolderOpen className="w-4 h-4 inline mr-2" />
          Media Files
        </button>
        <button
          onClick={() => setActiveTab("content")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "content"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles className="w-4 h-4 inline mr-2" />
          Generated Content
        </button>
      </div>

      {activeTab === "media" && (
      <div className="flex gap-6">
        {/* Left Sidebar - Folders & Filters */}
        <div className="w-56 shrink-0 space-y-4 hidden lg:block">
          {/* Type Filters */}
          <Card>
            <CardContent className="p-3 space-y-1">
              {typeFilters.map((filter) => {
                const Icon = filter.icon;
                return (
                  <button
                    key={filter.id || "all"}
                    onClick={() => { setActiveFilter(filter.id); setActiveFolderId(null); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      activeFilter === filter.id && !activeFolderId
                        ? "bg-brand-500/10 text-brand-600 font-medium"
                        : "hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {filter.label}
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* Folders */}
          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Folders
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-1">
              {folders.filter((f) => !f.parentId).map((folder) => (
                <div key={folder.id} className="group flex items-center">
                  <button
                    onClick={() => { setActiveFolderId(folder.id); setActiveFilter(null); }}
                    className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      activeFolderId === folder.id
                        ? "bg-brand-500/10 text-brand-600 font-medium"
                        : "hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <FolderOpen className="w-4 h-4" />
                    <span className="truncate">{folder.name}</span>
                    <span className="text-xs opacity-60 ml-auto">{folder.fileCount}</span>
                  </button>
                  <button
                    onClick={() => handleDeleteFolder(folder.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {folders.filter((f) => !f.parentId).length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">No folders yet</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="flex-1 space-y-4">
          {/* Search & View Toggle */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search files..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
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

          {/* Breadcrumb */}
          {activeFolderId && (
            <div className="flex items-center gap-1 text-sm">
              <button
                onClick={() => setActiveFolderId(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                All Files
              </button>
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
              <span className="font-medium">
                {folders.find((f) => f.id === activeFolderId)?.name || "Folder"}
              </span>
            </div>
          )}

          {/* Folder Grid */}
          {currentFolders.length > 0 && !searchQuery && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {currentFolders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => { setActiveFolderId(folder.id); setActiveFilter(null); }}
                  className="flex flex-col items-center gap-2 p-4 rounded-lg border hover:bg-muted transition-colors"
                >
                  <FolderOpen className="w-10 h-10 text-brand-500" />
                  <span className="text-sm font-medium truncate w-full text-center">{folder.name}</span>
                  <span className="text-xs text-muted-foreground">{folder.fileCount} files</span>
                </button>
              ))}
            </div>
          )}

          {/* Drop zone / Upload area when empty */}
          {!isLoading && files.length === 0 && currentFolders.length === 0 && (
            <Card
              className="border-2 border-dashed cursor-pointer hover:border-brand-500/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <CardContent className="p-12 text-center">
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="font-medium">No files yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Click to upload or drag and drop your files here
                </p>
              </CardContent>
            </Card>
          )}

          {/* Loading */}
          {isLoading && (
            <div className={viewMode === "grid"
              ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
              : "space-y-2"
            }>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className={viewMode === "grid" ? "aspect-square rounded-lg" : "h-14 rounded-lg"} />
              ))}
            </div>
          )}

          {/* File Grid View */}
          {!isLoading && files.length > 0 && viewMode === "grid" && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {files.map((file) => {
                const TypeIcon = typeIcons[file.type] || File;
                return (
                  <motion.div
                    key={file.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <Card
                      className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
                      onClick={() => setSelectedFile(file)}
                    >
                      <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                        {file.type === "image" || file.type === "svg" ? (
                          <img src={file.url} alt={file.originalName} className="w-full h-full object-cover" />
                        ) : file.type === "video" ? (
                          file.metadata?.thumbnailUrl ? (
                            <img src={file.metadata.thumbnailUrl} alt={file.originalName} className="w-full h-full object-cover" />
                          ) : (
                            <Video className="w-12 h-12 text-muted-foreground" />
                          )
                        ) : (
                          <TypeIcon className="w-12 h-12 text-muted-foreground" />
                        )}
                      </div>
                      <CardContent className="p-3">
                        <p className="text-xs font-medium truncate">{file.originalName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-[10px]">{file.type}</Badge>
                          <span className="text-[10px] text-muted-foreground">{formatFileSize(file.size)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* File List View */}
          {!isLoading && files.length > 0 && viewMode === "list" && (
            <div className="space-y-1">
              {files.map((file) => {
                const TypeIcon = typeIcons[file.type] || File;
                return (
                  <div
                    key={file.id}
                    onClick={() => setSelectedFile(file)}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 overflow-hidden">
                      {file.type === "image" || file.type === "svg" ? (
                        <img src={file.url} alt="" className="w-full h-full object-cover" />
                      ) : file.type === "video" && file.metadata?.thumbnailUrl ? (
                        <img src={file.metadata.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <TypeIcon className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.originalName}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs">{file.type}</Badge>
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      {new Date(file.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      )}

      {/* Generated Content Tab */}
      {activeTab === "content" && (
        <div className="space-y-4">
          {/* Content Filters & Search */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex gap-2 flex-wrap">
              {[
                { id: null, label: "All" },
                { id: "post", label: "Posts" },
                { id: "caption", label: "Captions" },
                { id: "hashtags", label: "Hashtags" },
                { id: "ideas", label: "Ideas" },
                { id: "auto", label: "Auto" },
              ].map((filter) => (
                <button
                  key={filter.id || "all"}
                  onClick={() => setContentFilter(filter.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    contentFilter === filter.id
                      ? "bg-brand-500 text-white"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <div className="relative flex-1 w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search generated content..."
                className="pl-9"
                value={contentSearch}
                onChange={(e) => setContentSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Loading */}
          {contentLoading && (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!contentLoading && generatedContent.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="p-12 text-center">
                <Sparkles className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="font-medium">No generated content yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Content you generate with AI will appear here automatically
                </p>
              </CardContent>
            </Card>
          )}

          {/* Content List */}
          {!contentLoading && generatedContent.length > 0 && (
            <div className="space-y-3">
              {generatedContent.map((item) => {
                const TypeIcon = contentTypeIcons[item.type.replace("auto_", "")] || Sparkles;
                const platforms = (() => { try { return JSON.parse(item.platforms); } catch { return []; } })();
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center shrink-0">
                            <TypeIcon className="w-5 h-5 text-brand-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="secondary" className="text-[10px]">
                                {contentTypeLabels[item.type] || item.type}
                              </Badge>
                              {platforms.map((p: string) => (
                                <Badge key={p} variant="outline" className="text-[10px]">
                                  {p}
                                </Badge>
                              ))}
                              <span className="text-[10px] text-muted-foreground ml-auto">
                                {new Date(item.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mb-1">
                              Prompt: {item.prompt.length > 80 ? item.prompt.substring(0, 80) + "..." : item.prompt}
                            </p>
                            <p className="text-sm whitespace-pre-wrap line-clamp-3">
                              {item.type === "ideas"
                                ? (() => { try { const ideas = JSON.parse(item.content); return ideas.map((i: { title: string }) => i.title).join(" | "); } catch { return item.content; } })()
                                : item.content}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleToggleFavorite(item)}
                          >
                            <Star className={`w-3.5 h-3.5 mr-1 ${item.isFavorite ? "fill-amber-400 text-amber-400" : ""}`} />
                            {item.isFavorite ? "Favorited" : "Favorite"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleCopyContent(item.content, item.id)}
                          >
                            {copiedContent === item.id ? (
                              <Check className="w-3.5 h-3.5 mr-1" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 mr-1" />
                            )}
                            {copiedContent === item.id ? "Copied!" : "Copy"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-destructive hover:text-destructive ml-auto"
                            onClick={() => handleDeleteContent(item.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Create Folder Dialog */}
      <Dialog open={showCreateFolder} onOpenChange={setShowCreateFolder}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Folder Name</Label>
              <Input
                placeholder="e.g., Brand Assets"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateFolder(false)}>Cancel</Button>
              <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* File Detail Dialog */}
      <Dialog open={!!selectedFile} onOpenChange={() => setSelectedFile(null)}>
        <DialogContent className="sm:max-w-lg">
          {selectedFile && (
            <>
              <DialogHeader>
                <DialogTitle className="truncate">{selectedFile.originalName}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Preview */}
                <div className="rounded-lg overflow-hidden border bg-muted/30 flex items-center justify-center max-h-64">
                  {selectedFile.type === "image" || selectedFile.type === "svg" ? (
                    <img src={selectedFile.url} alt={selectedFile.originalName} className="max-w-full max-h-64 object-contain" />
                  ) : selectedFile.type === "video" ? (
                    <video src={selectedFile.url} controls className="max-w-full max-h-64" />
                  ) : (
                    <div className="py-12">
                      <FileText className="w-16 h-16 mx-auto text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Type</p>
                    <p className="font-medium">{selectedFile.mimeType}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Size</p>
                    <p className="font-medium">{formatFileSize(selectedFile.size)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Uploaded</p>
                    <p className="font-medium">{new Date(selectedFile.createdAt).toLocaleDateString()}</p>
                  </div>
                  {selectedFile.folder && (
                    <div>
                      <p className="text-muted-foreground">Folder</p>
                      <p className="font-medium">{selectedFile.folder.name}</p>
                    </div>
                  )}
                </div>

                {/* Tags */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Tags</Label>
                    <button
                      onClick={() => setEditingTags(!editingTags)}
                      className="text-xs text-brand-500 hover:underline"
                    >
                      {editingTags ? "Done" : "Edit"}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedFile.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="pr-1">
                        {tag}
                        {editingTags && (
                          <button
                            onClick={() => handleUpdateTags(selectedFile.id, selectedFile.tags.filter((t) => t !== tag))}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </Badge>
                    ))}
                    {editingTags && (
                      <div className="flex items-center gap-1">
                        <Input
                          placeholder="Add tag..."
                          className="h-7 w-24 text-xs"
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && newTag.trim()) {
                              handleUpdateTags(selectedFile.id, [...selectedFile.tags, newTag.trim()]);
                              setNewTag("");
                            }
                          }}
                        />
                      </div>
                    )}
                    {selectedFile.tags.length === 0 && !editingTags && (
                      <span className="text-xs text-muted-foreground">No tags</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleCopyUrl(selectedFile.url)}
                  >
                    {copiedUrl ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                    {copiedUrl ? "Copied!" : "Copy URL"}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteFile(selectedFile.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
