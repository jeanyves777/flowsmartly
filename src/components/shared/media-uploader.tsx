"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, FolderOpen, X, Plus, Image as ImageIcon, Video, Play, FileText, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileDropZone } from "@/components/shared/file-drop-zone";
import { MediaLibraryPicker } from "@/components/shared/media-library-picker";
import { useToast } from "@/hooks/use-toast";
import { AISpinner } from "@/components/shared/ai-generation-loader";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface UploadedMedia {
  url: string;
  type: "image" | "video" | "svg" | "document";
  name?: string;
}

export interface MediaUploaderProps {
  /** Current media URLs */
  value: string[];
  /** Called when media list changes */
  onChange: (urls: string[]) => void;
  /** Single file or multi-file mode */
  multiple?: boolean;
  /** Max number of files (multi mode only, 0 = unlimited) */
  maxFiles?: number;
  /** Accepted MIME types */
  accept?: string;
  /** Max file size in bytes (default 10MB) */
  maxSize?: number;
  /** Filter types for MediaLibraryPicker */
  filterTypes?: string[];
  /** Upload endpoint (default "/api/media") */
  uploadEndpoint?: string;
  /** Disable all interactions */
  disabled?: boolean;
  /** Label text */
  label?: string;
  /** Sublabel/description text */
  description?: string;
  /** Placeholder when empty */
  placeholder?: string;
  /** Thumbnail size variant */
  variant?: "small" | "medium" | "large" | "gallery";
  /** How the preview fits its box — "contain" shows the WHOLE image (use for
   * logos so a wide wordmark isn't cropped); defaults to cover (gallery=contain). */
  fit?: "cover" | "contain";
  /** Media library picker title */
  libraryTitle?: string;
  /** Show Upload and Library buttons */
  showButtons?: boolean;
  /** Additional className for wrapper */
  className?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getMediaType(url: string): "image" | "video" | "svg" | "document" {
  const lower = url.toLowerCase();
  if (lower.endsWith(".svg")) return "svg";
  if (/\.(mp4|webm|mov|avi)/.test(lower)) return "video";
  if (/\.(png|jpg|jpeg|webp|gif|bmp|avif)/.test(lower)) return "image";
  // If URL contains /video/ path segment, treat as video
  if (lower.includes("/video/")) return "video";
  return "image"; // default assumption
}

const SIZE_CLASSES = {
  small: "w-16 h-16",
  medium: "w-20 h-20",
  large: "w-28 h-28",
  gallery: "h-48 w-full",
} as const;

// ── Component ──────────────────────────────────────────────────────────────────

export function MediaUploader({
  value,
  onChange,
  multiple = false,
  maxFiles = 0,
  accept = "image/png,image/jpeg,image/jpg,image/webp,image/svg+xml",
  maxSize = 10 * 1024 * 1024,
  filterTypes = ["image"],
  uploadEndpoint = "/api/media",
  disabled = false,
  label,
  description,
  placeholder,
  variant = "medium",
  fit,
  libraryTitle,
  showButtons = true,
  className = "",
}: MediaUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [showLibrary, setShowLibrary] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const effectiveMax = multiple ? maxFiles : 1;
  const canAddMore = effectiveMax === 0 || value.length < effectiveMax;
  const sizeClass = SIZE_CLASSES[variant];

  // Upload a single file to the server
  const uploadFile = useCallback(
    async (file: File): Promise<string | null> => {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(uploadEndpoint, { method: "POST", body: formData });
        const data = await res.json();

        if (!res.ok || !data.success) {
          toast({
            title: "Upload failed",
            description: data.error?.message || data.error || "Failed to upload file",
            variant: "destructive",
          });
          return null;
        }

        return data.data?.file?.url || data.data?.url || null;
      } catch {
        toast({
          title: "Upload error",
          description: "Network error uploading file",
          variant: "destructive",
        });
        return null;
      }
    },
    [uploadEndpoint, toast]
  );

  // Handle file(s) from input or drop
  const handleFiles = useCallback(
    async (files: File[]) => {
      if (disabled || files.length === 0) return;

      // Limit to how many we can still add
      const remaining = effectiveMax === 0 ? files.length : effectiveMax - value.length;
      if (remaining <= 0) {
        toast({
          title: "Limit reached",
          description: `Maximum ${effectiveMax} file${effectiveMax !== 1 ? "s" : ""} allowed`,
        });
        return;
      }
      const toUpload = files.slice(0, remaining);

      setIsUploading(true);
      setUploadProgress({ current: 0, total: toUpload.length });
      const uploaded: string[] = [];

      for (let i = 0; i < toUpload.length; i++) {
        setUploadProgress({ current: i + 1, total: toUpload.length });
        const url = await uploadFile(toUpload[i]);
        if (url) uploaded.push(url);
      }

      setIsUploading(false);
      setUploadProgress({ current: 0, total: 0 });

      if (uploaded.length > 0) {
        if (multiple) {
          onChange([...value, ...uploaded]);
        } else {
          onChange([uploaded[0]]);
        }
      }
    },
    [disabled, effectiveMax, value, multiple, onChange, uploadFile, toast]
  );

  // FileDropZone handler (single file at a time from drop)
  const handleFileDrop = useCallback(
    (file: File) => handleFiles([file]),
    [handleFiles]
  );

  // File input change handler
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files;
      if (!fileList) return;
      handleFiles(Array.from(fileList));
      // Reset input so same file can be re-selected
      e.target.value = "";
    },
    [handleFiles]
  );

  // Library selection (single mode)
  const handleLibrarySelect = useCallback(
    (url: string) => {
      if (multiple) {
        if (!value.includes(url)) {
          onChange([...value, url]);
        }
      } else {
        onChange([url]);
      }
    },
    [multiple, value, onChange]
  );

  // Library multi-select
  const handleLibraryMultiSelect = useCallback(
    (urls: string[]) => {
      const newUrls = urls.filter((u) => !value.includes(u));
      onChange([...value, ...newUrls]);
    },
    [value, onChange]
  );

  // Remove a single URL
  const handleRemove = useCallback(
    (url: string) => {
      onChange(value.filter((v) => v !== url));
    },
    [value, onChange]
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  const hasMedia = value.length > 0;
  const isGallery = variant === "gallery";
  const fitClass = fit ? (fit === "contain" ? "object-contain" : "object-cover") : isGallery ? "object-contain" : "object-cover";
  const mediaListClass = isGallery
    ? "grid grid-cols-1 gap-3 mb-2 sm:grid-cols-2 xl:grid-cols-3"
    : "flex flex-wrap gap-2 mb-2";
  const addButtonClass = isGallery
    ? "h-40 w-full rounded-xl"
    : `${sizeClass} rounded-lg`;

  return (
    <div className={className}>
      {label && (
        <p className="text-sm font-medium mb-1">{label}</p>
      )}
      {description && (
        <p className="text-xs text-muted-foreground mb-2">{description}</p>
      )}

      <FileDropZone
        onFileDrop={handleFileDrop}
        onFilesDrop={handleFiles}
        multiple={multiple}
        accept={accept}
        maxSize={maxSize}
        disabled={disabled || isUploading}
        dragLabel={multiple ? "Drop files here" : "Drop file here"}
      >
        <div>
          {/* Thumbnail grid / empty state */}
          {hasMedia ? (
            <div className={mediaListClass}>
              {value.map((url, idx) => {
                const type = getMediaType(url);
                return (
                  <button
                    type="button"
                    key={`${url}-${idx}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setPreviewUrl(url);
                    }}
                    className={`relative ${sizeClass} ${isGallery ? "rounded-xl" : "rounded-lg"} border overflow-hidden group bg-muted/30 text-left`}
                  >
                    {type === "video" ? (
                      <div className="absolute inset-0 bg-gray-900">
                        <video
                          src={url}
                          muted
                          playsInline
                          preload="metadata"
                          className={`h-full w-full ${fitClass}`}
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white shadow-lg">
                            <Play className="w-5 h-5 fill-white/30" />
                          </span>
                        </div>
                        <span className="absolute top-1 left-1 text-[8px] font-bold bg-black/60 text-white rounded px-1">
                          VIDEO
                        </span>
                      </div>
                    ) : type === "document" ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <FileText className="w-6 h-6 text-muted-foreground" />
                      </div>
                    ) : (
                      <img
                        src={url}
                        alt={`Media ${idx + 1}`}
                        className={`w-full h-full ${fitClass}`}
                      />
                    )}
                    <span className="absolute right-1.5 bottom-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100">
                      <ZoomIn className="h-3.5 w-3.5" />
                    </span>

                    {/* Remove button */}
                    {!disabled && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleRemove(url);
                        }}
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </button>
                );
              })}

              {/* Add more button (inline in grid) */}
              {multiple && canAddMore && !disabled && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!isUploading) fileInputRef.current?.click();
                  }}
                  className={`${addButtonClass} border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center hover:border-brand-500/50 hover:bg-muted/50 transition-colors`}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-0.5">
                      <AISpinner className="w-4 h-4 animate-spin text-brand-500" />
                      <span className="text-[9px] font-medium text-brand-500">
                        {uploadProgress.current}/{uploadProgress.total}
                      </span>
                    </div>
                  ) : (
                    <Plus className="w-5 h-5 text-muted-foreground" />
                  )}
                </button>
              )}
            </div>
          ) : (
            /* Empty state */
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                if (!disabled && !isUploading) fileInputRef.current?.click();
              }}
              className={`${addButtonClass} border-2 border-dashed border-muted-foreground/25 flex items-center justify-center cursor-pointer hover:border-brand-500/50 hover:bg-muted/50 transition-colors mb-2`}
            >
              {isUploading ? (
                <div className="flex flex-col items-center gap-0.5">
                  <AISpinner className="w-5 h-5 animate-spin text-brand-500" />
                  {uploadProgress.total > 1 && (
                    <span className="text-[9px] font-medium text-brand-500">
                      {uploadProgress.current}/{uploadProgress.total}
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                  {filterTypes.includes("video") ? (
                    <Video className="w-5 h-5" />
                  ) : (
                    <ImageIcon className="w-5 h-5" />
                  )}
                  <span className="text-[10px]">
                    {placeholder || "Upload"}
                  </span>
                </div>
              )}
            </button>
          )}

          {/* Action buttons */}
          {showButtons && !disabled && (
            <div className="flex flex-wrap gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || !canAddMore}
              >
                {isUploading ? (
                  <AISpinner className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <Upload className="w-3 h-3 mr-1" />
                )}
                {isUploading && uploadProgress.total > 1
                  ? `Uploading ${uploadProgress.current}/${uploadProgress.total}`
                  : "Upload"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setShowLibrary(true)}
                disabled={isUploading || !canAddMore}
              >
                <FolderOpen className="w-3 h-3 mr-1" />
                Library
              </Button>
            </div>
          )}
        </div>
      </FileDropZone>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={handleInputChange}
        disabled={disabled || isUploading}
      />

      {/* Media Library Picker */}
      <MediaLibraryPicker
        open={showLibrary}
        onClose={() => setShowLibrary(false)}
        onSelect={handleLibrarySelect}
        onMultiSelect={handleLibraryMultiSelect}
        multiSelect={multiple}
        maxSelection={effectiveMax > 0 ? effectiveMax - value.length : undefined}
        title={libraryTitle}
        filterTypes={filterTypes}
      />

      {previewUrl && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-white/75 p-4 backdrop-blur-sm dark:bg-background/75"
          onClick={() => setPreviewUrl(null)}
        >
          <button
            type="button"
            onClick={() => setPreviewUrl(null)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border bg-background/95 text-foreground shadow-lg transition hover:bg-background"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close media preview</span>
          </button>
          <div
            className="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-2xl border bg-background shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            {getMediaType(previewUrl) === "video" ? (
              <video
                src={previewUrl}
                controls
                autoPlay
                playsInline
                preload="metadata"
                className="max-h-[88vh] w-full bg-black object-contain"
              />
            ) : (
              <img
                src={previewUrl}
                alt="Media preview"
                className="max-h-[88vh] w-full bg-background object-contain"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
