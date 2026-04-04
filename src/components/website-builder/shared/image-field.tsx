"use client";

import { useState } from "react";
import { ImageIcon, Upload, X, Search } from "lucide-react";
import { MediaLibraryPicker } from "@/components/shared/media-library-picker";

interface ImageFieldProps {
  label?: string;
  value: string;
  onChange: (url: string) => void;
  aspectRatio?: string;
  className?: string;
}

export function ImageField({ label, value, onChange, aspectRatio = "16/9", className }: ImageFieldProps) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div className={className}>
      {label && <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>}

      {value ? (
        <div className="relative group rounded-lg overflow-hidden border border-border" style={{ aspectRatio }}>
          <img src={value} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              onClick={() => setShowPicker(true)}
              className="p-2 bg-white/20 backdrop-blur-sm rounded-lg text-white hover:bg-white/30 transition-colors"
              title="Change image"
            >
              <Upload className="w-4 h-4" />
            </button>
            <button
              onClick={() => onChange("")}
              className="p-2 bg-white/20 backdrop-blur-sm rounded-lg text-white hover:bg-red-500/50 transition-colors"
              title="Remove image"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowPicker(true)}
          className="w-full rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors bg-muted/20 hover:bg-muted/40 flex flex-col items-center justify-center gap-2 py-6 px-4"
          style={{ aspectRatio: value ? undefined : aspectRatio }}
        >
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <ImageIcon className="w-5 h-5 text-primary" />
          </div>
          <span className="text-xs text-muted-foreground">Click to add image</span>
          <span className="text-[10px] text-muted-foreground/60">From media library or upload</span>
        </button>
      )}

      {showPicker && (
        <MediaLibraryPicker
          isOpen={showPicker}
          onClose={() => setShowPicker(false)}
          onSelect={(files) => {
            if (files.length > 0) {
              onChange(files[0].url);
            }
            setShowPicker(false);
          }}
          accept="image"
          maxSelect={1}
        />
      )}
    </div>
  );
}
