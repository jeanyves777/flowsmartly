"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Upload,
  Film,
  Image as ImageIcon,
  Music,
  Search,
  Play,
  FolderOpen,
  ChevronRight,
  ChevronLeft,
  Plus,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVideoStore } from "../hooks/use-video-store";
import { AISpinner } from "@/components/shared/ai-generation-loader";
import { PageLoader } from "@/components/shared/page-loader";
import type { ClipType } from "@/lib/video-editor/types";

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

interface UploadItem {
  id: string;
  name: string;
  progress: number;
  status: "uploading" | "processing" | "done" | "error";
  error?: string;
}

type FilterTab = "all" | "video" | "image" | "audio";

function detectClipTypeFromDbType(type: string): ClipType {
  if (type === "video") return "video";
  if (type === "audio") return "audio";
  if (type === "image" || type === "svg") return "image";
  return "video";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

// ─── Lazy-loading thumbnail with intersection observer ───
function LazyThumbnail({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* Placeholder while loading */}
      {!loaded && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}
      <img
        ref={imgRef}
        src={inView ? src : undefined}
        alt={alt}
        className={className}
        onLoad={() => setLoaded(true)}
        loading="lazy"
      />
    </>
  );
}

/**
 * Find or create a dedicated track for a new clip.
 * Each media gets its own track so they don't overlap.
 */
function findOrCreateTrack(
  clipType: ClipType,
  tracks: ReturnType<typeof useVideoStore.getState>["tracks"],
  clips: ReturnType<typeof useVideoStore.getState>["clips"],
  addTrack: ReturnType<typeof useVideoStore.getState>["addTrack"]
): string {
  const trackType = clipType === "audio" ? "audio" : "video";

  // Find an empty track of the right type (no clips on it)
  const emptyTrack = tracks.find(
    (t) => t.type === trackType && t.clips.length === 0
  );
  if (emptyTrack) return emptyTrack.id;

  // No empty track — create a new one with a name matching the clip type
  const clipLabel = clipType.charAt(0).toUpperCase() + clipType.slice(1);
  const count = tracks.filter((t) => t.type === trackType).length + 1;
  return addTrack(trackType, `${clipLabel} ${count}`);
}

export function MediaPanel() {
  const addClip = useVideoStore((s) => s.addClip);
  const tracks = useVideoStore((s) => s.tracks);
  const clips = useVideoStore((s) => s.clips);
  const addTrack = useVideoStore((s) => s.addTrack);

  // Library state
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<{ id: string; name: string }[]>([]);
  const [addingFileId, setAddingFileId] = useState<string | null>(null);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const limit = 12;

  // Fetch media files
  const fetchFiles = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (filterTab !== "all") params.set("type", filterTab);
      if (searchQuery) params.set("search", searchQuery);
      if (activeFolderId) params.set("folderId", activeFolderId);

      const res = await fetch(`/api/media?${params}`);
      const data = await res.json();

      if (data.success) {
        setFiles(data.data.files || []);
        setTotalPages(data.data.pagination?.totalPages || 1);
        setTotal(data.data.pagination?.total || 0);
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, [page, searchQuery, filterTab, activeFolderId]);

  const fetchFolders = useCallback(async () => {
    try {
      const res = await fetch("/api/media/folders");
      const data = await res.json();
      if (data.success) {
        setFolders(data.data.folders || []);
      }
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  // ─── Upload with XHR progress + server-side compression ───
  const uploadFileWithProgress = useCallback(
    async (file: File): Promise<MediaFile | null> => {
      const uploadId = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const isVideo = file.type.startsWith("video/");

      setUploads((prev) => [
        ...prev,
        { id: uploadId, name: file.name, progress: 0, status: "uploading" },
      ]);

      try {
        const formData = new FormData();
        formData.append("file", file);

        // Use XHR for upload progress (fetch API doesn't support upload progress)
        const result = await new Promise<MediaFile>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
              // Upload phase = 0-70%, server processing (compression) = 70-100%
              const pct = Math.round((e.loaded / e.total) * 70);
              setUploads((prev) =>
                prev.map((u) =>
                  u.id === uploadId ? { ...u, progress: pct } : u
                )
              );
            }
          });

          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const data = JSON.parse(xhr.responseText);
                if (data.success && data.data?.file) {
                  resolve(data.data.file as MediaFile);
                } else {
                  reject(new Error(data.error?.message || "Upload failed"));
                }
              } catch {
                reject(new Error("Invalid response"));
              }
            } else {
              try {
                const err = JSON.parse(xhr.responseText);
                reject(new Error(err.error?.message || `Upload failed (${xhr.status})`));
              } catch {
                reject(new Error(`Upload failed (${xhr.status})`));
              }
            }
          });

          xhr.addEventListener("error", () => reject(new Error("Network error")));
          xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));

          xhr.open("POST", "/api/media");
          xhr.send(formData);

          // While waiting for server processing (compression), animate progress 70→95
          const processingInterval = setInterval(() => {
            setUploads((prev) =>
              prev.map((u) => {
                if (u.id === uploadId && u.status === "uploading" && u.progress >= 70 && u.progress < 95) {
                  return { ...u, progress: u.progress + 1, status: "processing" };
                }
                return u;
              })
            );
          }, isVideo ? 1000 : 300); // Slower ticks for video (compression takes longer)

          // Mark as processing once upload bytes are done
          xhr.upload.addEventListener("loadend", () => {
            setUploads((prev) =>
              prev.map((u) =>
                u.id === uploadId
                  ? { ...u, progress: 70, status: "processing" }
                  : u
              )
            );
          });

          // Cleanup interval when request completes
          xhr.addEventListener("loadend", () => clearInterval(processingInterval));
        });

        // Done
        setUploads((prev) =>
          prev.map((u) =>
            u.id === uploadId ? { ...u, progress: 100, status: "done" } : u
          )
        );

        setTimeout(() => {
          setUploads((prev) => prev.filter((u) => u.id !== uploadId));
        }, 3000);

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        setUploads((prev) =>
          prev.map((u) =>
            u.id === uploadId ? { ...u, status: "error", error: message } : u
          )
        );

        setTimeout(() => {
          setUploads((prev) => prev.filter((u) => u.id !== uploadId));
        }, 5000);

        return null;
      }
    },
    []
  );

  // Handle file selection from the input
  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files;
      if (!fileList?.length) return;

      const fileArray = Array.from(fileList);
      e.target.value = "";

      // Upload all files in parallel
      const results = await Promise.all(
        fileArray.map((file) => uploadFileWithProgress(file))
      );

      // Add successfully uploaded files to the timeline — each gets its own track
      for (let i = 0; i < results.length; i++) {
        const mediaFile = results[i];
        if (!mediaFile) continue;

        const clipType = detectClipTypeFromDbType(mediaFile.type);
        const store = useVideoStore.getState();
        const trackId = findOrCreateTrack(clipType, store.tracks, store.clips, store.addTrack);

        let duration = 5;
        if (clipType === "video" || clipType === "audio") {
          duration = await getMediaDuration(mediaFile.url);
        }

        addClip({
          type: clipType,
          trackId,
          startTime: 0,
          duration,
          trimStart: 0,
          trimEnd: 0,
          sourceUrl: mediaFile.url,
          sourceDuration: duration,
          name: mediaFile.originalName,
          volume: 1,
          muted: false,
        });
      }

      // Refresh library
      fetchFiles();
    },
    [uploadFileWithProgress, addClip, fetchFiles]
  );

  const handleAddFromLibrary = useCallback(
    async (file: MediaFile) => {
      setAddingFileId(file.id);
      try {
        const clipType = detectClipTypeFromDbType(file.type);
        const store = useVideoStore.getState();
        const trackId = findOrCreateTrack(clipType, store.tracks, store.clips, store.addTrack);

        let duration = 5;
        if (clipType === "video" || clipType === "audio") {
          duration = await getMediaDuration(file.url);
        }

        addClip({
          type: clipType,
          trackId,
          startTime: 0,
          duration,
          trimStart: 0,
          trimEnd: 0,
          sourceUrl: file.url,
          sourceDuration: duration,
          name: file.originalName,
          volume: 1,
          muted: false,
          width: file.width || undefined,
          height: file.height || undefined,
        });
      } finally {
        setAddingFileId(null);
      }
    },
    [addClip]
  );

  const navigateToFolder = (folderId: string, folderName: string) => {
    setActiveFolderId(folderId);
    setFolderPath((prev) => [...prev, { id: folderId, name: folderName }]);
    setPage(1);
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
  };

  const currentFolders = folders.filter((f) =>
    activeFolderId ? f.parentId === activeFolderId : !f.parentId
  );

  const FILTER_TABS: { id: FilterTab; label: string }[] = [
    { id: "all", label: "All" },
    { id: "video", label: "Video" },
    { id: "image", label: "Images" },
    { id: "audio", label: "Audio" },
  ];

  const hasActiveUploads = uploads.some((u) => u.status === "uploading" || u.status === "processing");

  return (
    <div className="flex flex-col h-full -mx-3 -mt-3">
      {/* Upload area */}
      <div className="px-3 pt-3 pb-2">
        <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed rounded-lg cursor-pointer hover:border-brand-500/50 hover:bg-brand-500/5 transition-colors">
          {hasActiveUploads ? (
            <AISpinner className="h-4 w-4" />
          ) : (
            <Upload className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-xs font-medium">
            {hasActiveUploads ? "Uploading..." : "Upload & Add to Timeline"}
          </span>
          <input
            type="file"
            className="hidden"
            accept="video/*,image/*,audio/*"
            multiple
            onChange={handleFileUpload}
            disabled={hasActiveUploads}
          />
        </label>
      </div>

      {/* Upload progress items */}
      {uploads.length > 0 && (
        <div className="px-3 pb-2 space-y-1">
          {uploads.map((upload) => (
            <div
              key={upload.id}
              className="flex items-center gap-2 p-2 rounded-md bg-muted/50 border text-xs"
            >
              {upload.status === "uploading" || upload.status === "processing" ? (
                <AISpinner className="h-3.5 w-3.5 shrink-0" />
              ) : upload.status === "done" ? (
                <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="truncate text-[11px]">{upload.name}</p>
                {upload.status === "processing" && (
                  <p className="text-[10px] text-brand-500 mt-0.5">Optimizing...</p>
                )}
                {(upload.status === "uploading" || upload.status === "processing") && (
                  <div className="mt-1 h-1 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${upload.progress}%`,
                        background: "linear-gradient(90deg, #3b82f6, #8b5cf6)",
                      }}
                    />
                  </div>
                )}
                {upload.error && (
                  <p className="text-[10px] text-red-500 mt-0.5">{upload.error}</p>
                )}
              </div>
              {(upload.status === "uploading" || upload.status === "processing") && (
                <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                  {upload.progress}%
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Divider + Library header */}
      <div className="px-3 pb-1.5">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Media Library
          {total > 0 && (
            <span className="ml-1 font-normal lowercase">({total})</span>
          )}
        </p>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search files..."
            className="w-full h-7 pl-7 pr-2 text-xs rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="px-3 pb-2 flex gap-1">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setFilterTab(tab.id);
              setPage(1);
            }}
            className={`text-[10px] px-2 py-1 rounded-md font-medium transition-colors ${
              filterTab === tab.id
                ? "bg-brand-500 text-white"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Breadcrumbs */}
      {folderPath.length > 0 && (
        <div className="px-3 pb-1.5 flex items-center gap-0.5 text-[10px] overflow-x-auto">
          <button
            onClick={() => navigateBack(-1)}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            All
          </button>
          {folderPath.map((f, i) => (
            <span key={f.id} className="flex items-center gap-0.5 shrink-0">
              <ChevronRight className="h-2.5 w-2.5 text-muted-foreground" />
              <button
                onClick={() => navigateBack(i)}
                className={
                  i === folderPath.length - 1
                    ? "font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }
              >
                {f.name}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {isLoading ? (
          <PageLoader className="min-h-[120px]" />
        ) : (
          <>
            {/* Folders */}
            {currentFolders.length > 0 && !searchQuery && (
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                {currentFolders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => navigateToFolder(folder.id, folder.name)}
                    className="flex flex-col items-center gap-1 p-2 rounded-md border hover:bg-muted transition-colors"
                  >
                    <FolderOpen className="h-5 w-5 text-brand-500" />
                    <span className="text-[10px] font-medium truncate w-full text-center">
                      {folder.name}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Files grid */}
            {files.length === 0 && currentFolders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <ImageIcon className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-xs">No files found</p>
                <p className="text-[10px] mt-0.5">Upload media or change filters</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {files.map((file) => {
                  const isVideo = file.type === "video";
                  const isImage = file.type === "image" || file.type === "svg";
                  const isAudio = file.type === "audio";
                  const thumbUrl = file.metadata?.thumbnailUrl as string | undefined;
                  const isAdding = addingFileId === file.id;

                  return (
                    <button
                      key={file.id}
                      onClick={() => handleAddFromLibrary(file)}
                      disabled={isAdding}
                      className="relative aspect-square rounded-md overflow-hidden border border-border hover:border-brand-500/50 transition-all group"
                      title={`${file.originalName} (${formatSize(file.size)})`}
                    >
                      {/* Thumbnail */}
                      {isImage ? (
                        <LazyThumbnail
                          src={file.url}
                          alt={file.originalName}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : isVideo ? (
                        <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                          {thumbUrl ? (
                            <LazyThumbnail
                              src={thumbUrl}
                              alt={file.originalName}
                              className="absolute inset-0 w-full h-full object-cover opacity-80"
                            />
                          ) : null}
                          <div className="relative z-10 w-7 h-7 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                            <Play className="w-3.5 h-3.5 text-white ml-0.5" />
                          </div>
                        </div>
                      ) : isAudio ? (
                        <div className="absolute inset-0 bg-gradient-to-br from-green-900/80 to-green-700/60 flex flex-col items-center justify-center gap-1">
                          <Music className="h-5 w-5 text-green-200" />
                          <span className="text-[8px] text-green-200/80 font-medium">AUDIO</span>
                        </div>
                      ) : (
                        <div className="absolute inset-0 bg-muted flex items-center justify-center">
                          <Film className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}

                      {/* Type badge */}
                      {isVideo && (
                        <span className="absolute top-1 left-1 text-[7px] font-bold bg-black/60 text-white rounded px-1 py-0.5">
                          VIDEO
                        </span>
                      )}

                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        {isAdding ? (
                          <AISpinner className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        ) : (
                          <Plus className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </div>

                      {/* Filename on hover */}
                      <div className="absolute bottom-0 left-0 right-0 p-1 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-[8px] text-white truncate">{file.originalName}</p>
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
        <div className="px-3 py-1.5 border-t flex items-center justify-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
          >
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <span className="text-[10px] text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages}
          >
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

function getMediaDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const el = document.createElement("video");
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      resolve(el.duration || 5);
      el.remove();
    };
    el.onerror = () => {
      const audio = document.createElement("audio");
      audio.preload = "metadata";
      audio.onloadedmetadata = () => {
        resolve(audio.duration || 5);
        audio.remove();
      };
      audio.onerror = () => resolve(5);
      audio.src = url;
    };
    el.src = url;
  });
}
