"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, ImageIcon, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AISpinner } from "@/components/shared/ai-generation-loader";
import { cn } from "@/lib/utils/cn";

export interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  alt: string;
  photographer: string;
  photographerUrl: string;
  sourceUrl: string;
  thumbUrl: string;
  previewUrl: string;
  fullUrl: string;
}

interface PexelsPickerProps {
  /** Called when the user clicks a photo. Pass the photo object. */
  onSelect: (photo: PexelsPhoto) => void | Promise<void>;
  /** Optional initial query (e.g. brand keyword). */
  initialQuery?: string;
  /** Optional orientation filter. */
  orientation?: "landscape" | "portrait" | "square";
  /** Customize header label (default: "Stock Photos"). */
  label?: string;
  /** Number of columns in the grid (default: 2). */
  cols?: 2 | 3;
  className?: string;
}

/**
 * Reusable Pexels stock-photo picker. Talks to the server proxy at
 * /api/pexels/search (which keeps the API key server-side). Used in:
 * - Studio Backgrounds panel — set as canvas background
 * - Studio Uploads panel — drop into the design as an image layer
 * - Future: website builder hero/section image pickers
 *
 * Hits the curated feed when query is empty so first-load shows pretty
 * thumbnails instead of an empty state.
 */
export function PexelsPicker({
  onSelect,
  initialQuery = "",
  orientation,
  label = "Stock Photos",
  cols = 2,
  className,
}: PexelsPickerProps) {
  const [query, setQuery] = useState(initialQuery);
  const [debounced, setDebounced] = useState(initialQuery);
  const [photos, setPhotos] = useState<PexelsPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectingId, setSelectingId] = useState<number | null>(null);

  // Debounce the search input so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  const search = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: debounced, per_page: "24" });
      if (orientation) params.set("orientation", orientation);
      const res = await fetch(`/api/pexels/search?${params}`);
      const data = await res.json();
      if (data.success) setPhotos(data.photos || []);
      else setPhotos([]);
    } catch {
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  }, [debounced, orientation]);

  useEffect(() => {
    search();
  }, [search]);

  const handleClick = async (photo: PexelsPhoto) => {
    setSelectingId(photo.id);
    try {
      await onSelect(photo);
    } finally {
      setSelectingId(null);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <ImageIcon className="h-3.5 w-3.5" />
          {label}
        </h4>
        <a
          href="https://www.pexels.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-0.5"
        >
          Pexels
          <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </div>

      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search photos..."
          className="h-8 pl-7 text-xs"
          aria-label="Search Pexels stock photos"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <AISpinner className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : photos.length === 0 ? (
        <div className="text-center py-6 text-xs text-muted-foreground">
          No results — try a different keyword
        </div>
      ) : (
        <div className={cn("grid gap-1.5", cols === 3 ? "grid-cols-3" : "grid-cols-2")}>
          {photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => handleClick(photo)}
              disabled={selectingId === photo.id}
              className="relative aspect-square rounded-md overflow-hidden border border-border hover:border-brand-500 hover:scale-[1.02] transition-all group bg-gray-100 dark:bg-gray-800"
              title={`${photo.alt} — by ${photo.photographer}`}
              aria-label={`Use photo: ${photo.alt}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.thumbUrl}
                alt={photo.alt}
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover"
              />
              {selectingId === photo.id && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <AISpinner className="h-4 w-4 animate-spin text-white" />
                </div>
              )}
              {/* Photographer credit on hover (Pexels attribution) */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1 translate-y-full group-hover:translate-y-0 transition-transform pointer-events-none">
                <p className="text-white text-[8px] font-medium truncate">
                  © {photo.photographer}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Tiny attribution footer per Pexels guidelines */}
      {photos.length > 0 && (
        <p className="text-[9px] text-muted-foreground/70 pt-1 text-center">
          Free stock photos from{" "}
          <a
            href="https://www.pexels.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Pexels
          </a>
        </p>
      )}
    </div>
  );
}
