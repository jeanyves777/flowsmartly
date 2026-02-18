"use client";

import React, { useState, useCallback, useRef } from "react";
import { Upload } from "lucide-react";

interface FileDropZoneProps {
  /** Called when a valid file is dropped */
  onFileDrop: (file: File) => void;
  /** Accepted MIME types (e.g. "image/png,image/jpeg") */
  accept?: string;
  /** Max file size in bytes */
  maxSize?: number;
  /** Whether the drop zone is disabled */
  disabled?: boolean;
  /** Custom label shown during drag */
  dragLabel?: string;
  /** Wrap children — the drop zone overlays on top */
  children: React.ReactNode;
  /** Additional className for the wrapper */
  className?: string;
}

export function FileDropZone({
  onFileDrop,
  accept,
  maxSize,
  disabled = false,
  dragLabel = "Drop file here",
  children,
  className = "",
}: FileDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);

  const acceptedTypes = accept
    ? accept.split(",").map((t) => t.trim().toLowerCase())
    : null;

  const isValidFile = useCallback(
    (file: File): boolean => {
      if (acceptedTypes) {
        const mime = file.type.toLowerCase();
        // Check exact MIME match or wildcard (e.g. "image/*")
        const ok = acceptedTypes.some((t) => {
          if (t.endsWith("/*")) return mime.startsWith(t.replace("/*", "/"));
          return mime === t;
        });
        if (!ok) return false;
      }
      if (maxSize && file.size > maxSize) return false;
      return true;
    },
    [acceptedTypes, maxSize]
  );

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      dragCounter.current++;
      if (e.dataTransfer.items?.length) {
        setIsDragOver(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) e.dataTransfer.dropEffect = "copy";
    },
    [disabled]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragOver(false);
      if (disabled) return;

      const file = e.dataTransfer.files?.[0];
      if (!file) return;

      if (!isValidFile(file)) return;

      onFileDrop(file);
    },
    [disabled, isValidFile, onFileDrop]
  );

  return (
    <div
      className={`relative ${className}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}
      {isDragOver && !disabled && (
        <div className="absolute inset-0 z-50 flex items-center justify-center rounded-lg border-2 border-dashed border-brand-500 bg-brand-500/10 backdrop-blur-[2px] pointer-events-none">
          <div className="flex flex-col items-center gap-2 text-brand-500">
            <Upload className="w-8 h-8" />
            <span className="text-sm font-medium">{dragLabel}</span>
          </div>
        </div>
      )}
    </div>
  );
}
