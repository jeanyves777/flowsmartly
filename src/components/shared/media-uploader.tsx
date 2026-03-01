"use client";

import { useState, useRef, useCallback } from "react";
import {
  Upload,
  FolderOpen,
  X,
  Plus,
  Loader2,
  Image as ImageIcon,
  Video,
  Play,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileDropZone } from "@/components/shared/file-drop-zone";
import { MediaLibraryPicker } from "@/components/shared/media-library-picker";
import { useToast } from "@/hooks/use-toast";

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
  variant?: "small" | "medium" | "large";
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
  libraryTitle,
  showButtons = true,
  className = "",
}: MediaUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [showLibrary, setShowLibrary] = useState(false);
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
        accept={accept}
        maxSize={maxSize}
        disabled={disabled || isUploading}
        dragLabel={multiple ? "Drop files here" : "Drop file here"}
      >
        <div>
          {/* Thumbnail grid / empty state */}
          {hasMedia ? (
            <div className="flex flex-wrap gap-2 mb-2">
              {value.map((url, idx) => {
                const type = getMediaType(url);
                return (
                  <div
                    key={`${url}-${idx}`}
                    className={`relative ${sizeClass} rounded-lg border overflow-hidden group bg-muted/30`}
                  >
                    {type === "video" ? (
                      <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                        <Play className="w-5 h-5 text-white/70" />
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
                        className="w-full h-full object-cover"
                      />
                    )}

                    {/* Remove button */}
                    {!disabled && (
                      <button
                        onClick={() => handleRemove(url)}
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Add more button (inline in grid) */}
              {multiple && canAddMore && !disabled && (
                <button
                  onClick={() => !isUploading && fileInputRef.current?.click()}
                  className={`${sizeClass} rounded-lg border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center hover:border-brand-500/50 hover:bg-muted/50 transition-colors`}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-0.5">
                      <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
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
            <div
              onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
              className={`${sizeClass} rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center cursor-pointer hover:border-brand-500/50 hover:bg-muted/50 transition-colors mb-2`}
            >
              {isUploading ? (
                <div className="flex flex-col items-center gap-0.5">
                  <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
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
            </div>
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
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
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
    </div>
  );
}
