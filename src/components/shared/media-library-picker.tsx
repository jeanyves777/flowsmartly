"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Search,
  Loader2,
  Image as ImageIcon,
  Video,
  FolderOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Play,
  FileText,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface MediaFile {
  id: string;
  filename: string;
  originalName: string;
  url: string;
  type: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  folderId: string | null;
  folder?: { id: string; name: string } | null;
  metadata?: { thumbnailUrl?: string; [key: string]: unknown };
  createdAt: string;
}

interface MediaFolder {
  id: string;
  name: string;
  parentId: string | null;
  fileCount: number;
  childCount: number;
}

interface MediaLibraryPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string, file?: MediaFile) => void;
  onMultiSelect?: (urls: string[], files: MediaFile[]) => void;
  multiSelect?: boolean;
  maxSelection?: number;
  title?: string;
  filterTypes?: string[]; // e.g., ["image"], ["video"], ["image", "svg"]
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export function MediaLibraryPicker({
  open,
  onClose,
  onSelect,
  onMultiSelect,
  multiSelect = false,
  maxSelection,
  title,
  filterTypes = ["image"],
}: MediaLibraryPickerProps) {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<MediaFile[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<{ id: string; name: string }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const limit = 12;

  // Determine the media kind for labels
  const isVideoMode = filterTypes.some((t) => t === "video");
  const mediaLabel = isVideoMode ? "video" : "file";
  const displayTitle = title || (isVideoMode ? "Select Video" : "Select from Media Library");

  // Map filterTypes to API type param
  const getApiTypeParam = useCallback((): string => {
    const typeMap: Record<string, string> = {
      image: "image",
      video: "video",
      svg: "svg",
      document: "document",
      png: "image",
      jpg: "image",
      jpeg: "image",
      webp: "image",
    };
    const dbTypes = new Set<string>();
    for (const ft of filterTypes) {
      if (typeMap[ft]) dbTypes.add(typeMap[ft]);
    }
    return Array.from(dbTypes).join(",");
  }, [filterTypes]);

  // Fetch media files
  const fetchFiles = useCallback(async () => {
    if (!open) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      const apiType = getApiTypeParam();
      if (apiType) params.set("type", apiType);
      if (searchQuery) params.set("search", searchQuery);
      if (activeFolderId) params.set("folderId", activeFolderId);

      const res = await fetch(`/api/media?${params}`);
      const data = await res.json();

      if (data.success) {
        setFiles(data.data.files || []);
        setTotalPages(data.data.pagination?.totalPages || 1);
        setTotal(data.data.pagination?.total || 0);
      }
    } catch (error) {
      console.error("Failed to fetch media:", error);
    } finally {
      setIsLoading(false);
    }
  }, [open, page, searchQuery, activeFolderId, getApiTypeParam]);

  // Fetch folders
  const fetchFolders = useCallback(async () => {
    if (!open) return;
    try {
      const res = await fetch("/api/media/folders");
      const data = await res.json();
      if (data.success) {
        setFolders(data.data.folders || []);
      }
    } catch {
      // Silently fail
    }
  }, [open]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  useEffect(() => {
    if (open) fetchFolders();
  }, [open, fetchFolders]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedFile(null);
      setSelectedFiles([]);
      setSearchQuery("");
      setPage(1);
      setActiveFolderId(null);
      setFolderPath([]);
    }
  }, [open]);

  const handleSelect = () => {
    if (multiSelect) {
      if (selectedFiles.length > 0 && onMultiSelect) {
        onMultiSelect(
          selectedFiles.map((f) => f.url),
          selectedFiles
        );
        onClose();
      }
    } else if (selectedFile) {
      onSelect(selectedFile.url, selectedFile);
      onClose();
    }
  };

  const toggleFileSelection = (file: MediaFile) => {
    setSelectedFiles((prev) => {
      const exists = prev.some((f) => f.id === file.id);
      if (exists) return prev.filter((f) => f.id !== file.id);
      if (maxSelection && prev.length >= maxSelection) return prev;
      return [...prev, file];
    });
  };

  const isFileSelected = (file: MediaFile) =>
    multiSelect
      ? selectedFiles.some((f) => f.id === file.id)
      : selectedFile?.id === file.id;

  const navigateToFolder = (folderId: string, folderName: string) => {
    setActiveFolderId(folderId);
    setFolderPath((prev) => [...prev, { id: folderId, name: folderName }]);
    setPage(1);
    setSelectedFile(null);
  };

  const navigateBack = (toIndex: number) => {
    if (toIndex < 0) {
      setActiveFolderId(null);
      setFolderPath([]);
    } else {
      const target = folderPath[toIndex];
      setActiveFolderId(target.id);
      setFolderPath((prev) => prev.slice(0, toIndex + 1));
    }
    setPage(1);
    setSelectedFile(null);
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setIsUploading(true);
    try {
      const uploadedFiles: MediaFile[] = [];

      for (const file of Array.from(fileList)) {
        const formData = new FormData();
        formData.append("file", file);
        if (activeFolderId) {
          formData.append("folderId", activeFolderId);
        }

        const res = await fetch("/api/media", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (data.success && data.data?.file) {
          uploadedFiles.push(data.data.file);
        }
      }

      if (uploadedFiles.length > 0) {
        // Refresh the file list
        fetchFiles();
      }
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setIsUploading(false);
      // Reset input
      e.target.value = "";
    }
  };

  // Get visible folders for current location
  const currentFolders = folders.filter((f) =>
    activeFolderId ? f.parentId === activeFolderId : !f.parentId
  );

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-3xl max-h-[80vh] flex flex-col rounded-xl bg-card overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-brand-500/20 flex items-center justify-center">
                {isVideoMode ? (
                  <Video className="w-5 h-5 text-brand-500" />
                ) : (
                  <FolderOpen className="w-5 h-5 text-brand-500" />
                )}
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{displayTitle}</h3>
                <p className="text-xs text-muted-foreground">
                  {total} {mediaLabel}{total !== 1 ? "s" : ""} in your library
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search + Breadcrumbs */}
          <div className="px-4 pt-3 pb-2 border-b border-border space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder={`Search ${mediaLabel}s by filename...`}
                className="pl-10"
              />
            </div>
            {/* Breadcrumb navigation */}
            {folderPath.length > 0 && (
              <div className="flex items-center gap-1 text-sm overflow-x-auto">
                <button
                  onClick={() => navigateBack(-1)}
                  className="text-muted-foreground hover:text-foreground shrink-0"
                >
                  All Files
                </button>
                {folderPath.map((f, i) => (
                  <div key={f.id} className="flex items-center gap-1 shrink-0">
                    <ChevronRight className="w-3 h-3 text-muted-foreground" />
                    <button
                      onClick={() => navigateBack(i)}
                      className={i === folderPath.length - 1 ? "font-medium" : "text-muted-foreground hover:text-foreground"}
                    >
                      {f.name}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* File Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Folder grid */}
                {currentFolders.length > 0 && !searchQuery && (
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mb-4">
                    {currentFolders.map((folder) => (
                      <button
                        key={folder.id}
                        onClick={() => navigateToFolder(folder.id, folder.name)}
                        className="flex flex-col items-center gap-1.5 p-3 rounded-lg border hover:bg-muted transition-colors"
                      >
                        <FolderOpen className="w-8 h-8 text-brand-500" />
                        <span className="text-[11px] font-medium truncate w-full text-center">{folder.name}</span>
                        <span className="text-[10px] text-muted-foreground">{folder.fileCount}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Files */}
                {files.length === 0 && currentFolders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                    {isVideoMode ? (
                      <Video className="w-12 h-12 mb-3 opacity-50" />
                    ) : (
                      <ImageIcon className="w-12 h-12 mb-3 opacity-50" />
                    )}
                    <p className="text-sm">No {mediaLabel}s found</p>
                    <p className="text-xs mt-1">Upload {mediaLabel}s to your media library first</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {files.map((file) => {
                      const isVideo = file.type === "video";
                      const isImage = file.type === "image" || file.type === "svg";
                      const thumbUrl = file.metadata?.thumbnailUrl as string | undefined;

                      return (
                        <button
                          key={file.id}
                          onClick={() =>
                            multiSelect ? toggleFileSelection(file) : setSelectedFile(file)
                          }
                          className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all group ${
                            isFileSelected(file)
                              ? "border-brand-500 ring-2 ring-brand-500/30"
                              : "border-transparent hover:border-muted-foreground/30"
                          }`}
                        >
                          {/* Background */}
                          {isImage ? (
                            <>
                              <div
                                className="absolute inset-0"
                                style={{
                                  backgroundImage: `linear-gradient(45deg, #e5e7eb 25%, transparent 25%),
                                    linear-gradient(-45deg, #e5e7eb 25%, transparent 25%),
                                    linear-gradient(45deg, transparent 75%, #e5e7eb 75%),
                                    linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)`,
                                  backgroundSize: "10px 10px",
                                  backgroundPosition: "0 0, 0 5px, 5px -5px, -5px 0px",
                                }}
                              />
                              <img
                                src={file.url}
                                alt={file.originalName}
                                className="absolute inset-0 w-full h-full object-contain bg-white/50"
                              />
                            </>
                          ) : isVideo ? (
                            <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                              {thumbUrl ? (
                                <>
                                  <img
                                    src={thumbUrl}
                                    alt={file.originalName}
                                    className="absolute inset-0 w-full h-full object-cover"
                                  />
                                  <div className="absolute inset-0 bg-black/20" />
                                </>
                              ) : null}
                              <div className="relative z-10 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                <Play className="w-5 h-5 text-white ml-0.5" />
                              </div>
                              <span className="absolute top-1.5 left-1.5 text-[9px] font-bold bg-black/60 text-white rounded px-1 py-0.5">
                                VIDEO
                              </span>
                            </div>
                          ) : (
                            <div className="absolute inset-0 bg-muted flex items-center justify-center">
                              <FileText className="w-8 h-8 text-muted-foreground" />
                            </div>
                          )}

                          {/* Selection overlay */}
                          {isFileSelected(file) && (
                            <div className="absolute inset-0 bg-brand-500/20 flex items-center justify-center">
                              <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center">
                                {multiSelect ? (
                                  <span className="text-xs font-bold text-white">
                                    {selectedFiles.findIndex((f) => f.id === file.id) + 1}
                                  </span>
                                ) : (
                                  <Check className="w-5 h-5 text-white" />
                                )}
                              </div>
                            </div>
                          )}

                          {/* Filename + size tooltip on hover */}
                          <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-[10px] text-white truncate">{file.originalName}</p>
                            <p className="text-[9px] text-white/70">{formatSize(file.size)}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 p-3 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between p-4 border-t border-border bg-muted/30">
            <div className="flex items-center gap-3">
              <div className="text-sm text-muted-foreground">
                {multiSelect ? (
                  selectedFiles.length > 0 ? (
                    <span>
                      <strong>{selectedFiles.length}</strong> {mediaLabel}{selectedFiles.length !== 1 ? "s" : ""} selected
                      {maxSelection && (
                        <span className="ml-1 text-xs">(max {maxSelection})</span>
                      )}
                    </span>
                  ) : (
                    <span>Click {mediaLabel}s to select them{maxSelection ? ` (max ${maxSelection})` : ""}</span>
                  )
                ) : selectedFile ? (
                  <span>
                    Selected: <strong>{selectedFile.originalName}</strong>
                    {selectedFile.size > 0 && (
                      <span className="ml-2 text-xs">({formatSize(selectedFile.size)})</span>
                    )}
                  </span>
                ) : (
                  <span>Click a {mediaLabel} to select it</span>
                )}
              </div>
              {/* Upload Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => document.getElementById("library-upload-input")?.click()}
                disabled={isUploading}
                className="border-brand-200 text-brand-600 hover:bg-brand-50"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload
                  </>
                )}
              </Button>
              <input
                id="library-upload-input"
                type="file"
                multiple
                accept={filterTypes.includes("video") ? "video/*,image/*" : "image/*"}
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
            <div className="flex gap-2">
              {multiSelect && selectedFiles.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedFiles([])}>
                  Clear
                </Button>
              )}
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleSelect}
                disabled={multiSelect ? selectedFiles.length === 0 : !selectedFile}
                className="bg-brand-500 hover:bg-brand-600"
              >
                <Check className="w-4 h-4 mr-2" />
                {multiSelect
                  ? `Select ${selectedFiles.length || ""} ${isVideoMode ? "Video" : "File"}${selectedFiles.length !== 1 ? "s" : ""}`
                  : `Select ${isVideoMode ? "Video" : "File"}`}
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
