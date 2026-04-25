"use client";

import { useEffect, useMemo, useState } from "react";
import { Users, RefreshCw, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useCanvasStore } from "../hooks/use-canvas-store";
import { addImageToCanvas } from "../utils/canvas-helpers";
import { AISpinner } from "@/components/shared/ai-generation-loader";
import { useToast } from "@/hooks/use-toast";

/**
 * Avatars + 3D Stickers panel — drop free, transparent-bg avatars and
 * emoji-style stickers onto the canvas without leaving the studio.
 *
 * Sources (no API key required):
 *  - DiceBear (api.dicebear.com) — cartoon/3D avatars in many styles.
 *    Returns SVG/PNG via URL, transparent bg by default. We hit the PNG
 *    endpoint so Fabric.js can rasterize cleanly.
 *  - Microsoft Fluent Emoji 3D — high-quality 3D emoji as transparent
 *    PNGs hosted on the official microsoft/fluentui-emoji GitHub repo.
 *
 * No server proxy needed — DiceBear + GitHub raw are CORS-friendly.
 */

interface DiceBearStyle {
  /** Style id used in the DiceBear URL path. */
  id: string;
  /** Display label. */
  label: string;
  /** Short description for the section header. */
  description: string;
}

const AVATAR_STYLES: DiceBearStyle[] = [
  { id: "adventurer", label: "Adventurer", description: "Friendly cartoon faces" },
  { id: "lorelei", label: "Lorelei", description: "Modern illustrated portraits" },
  { id: "notionists", label: "Notionists", description: "Notion-style minimal" },
  { id: "open-peeps", label: "Open Peeps", description: "Hand-drawn diverse" },
  { id: "personas", label: "Personas", description: "Flat illustrated humans" },
  { id: "micah", label: "Micah", description: "Editorial illustrated" },
  { id: "miniavs", label: "Miniavs", description: "Minimal mini avatars" },
  { id: "big-smile", label: "Big Smile", description: "Cheerful cartoon" },
  { id: "fun-emoji", label: "Fun Emoji", description: "Emoji-like faces" },
  { id: "bottts", label: "Bottts", description: "3D-style robots" },
  { id: "pixel-art", label: "Pixel Art", description: "8-bit pixel characters" },
  { id: "avataaars", label: "Avataaars", description: "Sketch-style avatars" },
];

// Curated set of common Microsoft Fluent 3D emoji — the GitHub repo path
// pattern is: assets/{Display Name}/3D/{name}_3d.png. Names use _ underscores.
// We pre-encode the display-name path component since some have spaces.
interface FluentEmoji {
  name: string;       // human label
  display: string;    // path segment (matches asset folder name)
  file: string;       // file slug
}

const FLUENT_EMOJI: FluentEmoji[] = [
  { name: "Heart", display: "Red%20heart", file: "red_heart" },
  { name: "Star", display: "Star", file: "star" },
  { name: "Fire", display: "Fire", file: "fire" },
  { name: "Party Popper", display: "Party%20popper", file: "party_popper" },
  { name: "Confetti", display: "Confetti%20ball", file: "confetti_ball" },
  { name: "Sparkles", display: "Sparkles", file: "sparkles" },
  { name: "Crown", display: "Crown", file: "crown" },
  { name: "Trophy", display: "Trophy", file: "trophy" },
  { name: "Gift", display: "Wrapped%20gift", file: "wrapped_gift" },
  { name: "Birthday Cake", display: "Birthday%20cake", file: "birthday_cake" },
  { name: "Balloon", display: "Balloon", file: "balloon" },
  { name: "Light Bulb", display: "Light%20bulb", file: "light_bulb" },
  { name: "Rocket", display: "Rocket", file: "rocket" },
  { name: "Money Bag", display: "Money%20bag", file: "money_bag" },
  { name: "Briefcase", display: "Briefcase", file: "briefcase" },
  { name: "Megaphone", display: "Megaphone", file: "megaphone" },
  { name: "Bell", display: "Bell", file: "bell" },
  { name: "Check Mark", display: "Check%20mark", file: "check_mark" },
  { name: "100", display: "Hundred%20points", file: "hundred_points" },
  { name: "Thumbs Up", display: "Thumbs%20up", file: "thumbs_up" },
  { name: "Clapping Hands", display: "Clapping%20hands", file: "clapping_hands" },
  { name: "Pray", display: "Folded%20hands", file: "folded_hands" },
  { name: "Camera", display: "Camera", file: "camera" },
  { name: "Microphone", display: "Microphone", file: "microphone" },
];

const FLUENT_BASE = "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets";

function fluentUrl(e: FluentEmoji): string {
  return `${FLUENT_BASE}/${e.display}/3D/${e.file}_3d.png`;
}

function dicebearUrl(style: string, seed: string, size = 256): string {
  // PNG variant — Fabric handles raster well. backgroundType=solid would
  // give a colored bg; we explicitly want transparent for compositing.
  return `https://api.dicebear.com/9.x/${encodeURIComponent(style)}/png?seed=${encodeURIComponent(seed)}&size=${size}&backgroundType=transparent`;
}

// Generate a small grid of randomized seeds — refresh button cycles them.
function makeSeeds(count = 8): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(Math.random().toString(36).slice(2, 10));
  }
  return out;
}

export function AvatarsPanel() {
  const canvas = useCanvasStore((s) => s.canvas);
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [activeStyle, setActiveStyle] = useState<string>("adventurer");
  const [seeds, setSeeds] = useState<string[]>(() => makeSeeds());
  const [addingUrl, setAddingUrl] = useState<string | null>(null);

  // Re-seed when user clicks Refresh.
  const refreshSeeds = () => setSeeds(makeSeeds());

  // Filter visible styles by the search box.
  const visibleStyles = useMemo(() => {
    if (!search.trim()) return AVATAR_STYLES;
    const q = search.toLowerCase();
    return AVATAR_STYLES.filter((s) => s.label.toLowerCase().includes(q) || s.id.includes(q));
  }, [search]);

  const visibleEmoji = useMemo(() => {
    if (!search.trim()) return FLUENT_EMOJI;
    const q = search.toLowerCase();
    return FLUENT_EMOJI.filter((e) => e.name.toLowerCase().includes(q));
  }, [search]);

  // Reset to first matching style when search narrows the list down.
  useEffect(() => {
    if (visibleStyles.length === 0) return;
    if (!visibleStyles.some((s) => s.id === activeStyle)) {
      setActiveStyle(visibleStyles[0].id);
    }
  }, [visibleStyles, activeStyle]);

  const addToCanvas = async (url: string) => {
    if (!canvas) return;
    setAddingUrl(url);
    try {
      const fabric = await import("fabric");
      await addImageToCanvas(canvas, url, fabric);
    } catch (err) {
      console.error("[AvatarsPanel] add failed:", err);
      toast({
        title: "Couldn't add avatar",
        description: "The image source may be unreachable.",
        variant: "destructive",
      });
    } finally {
      setAddingUrl(null);
    }
  };

  return (
    <div className="p-3 space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-1.5">
        <Users className="h-4 w-4 text-brand-500" />
        Avatars &amp; Stickers
      </h3>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search styles or stickers…"
        className="h-8 text-xs"
        aria-label="Search avatars and stickers"
      />

      {/* DiceBear avatars — pick a style, browse randomized seeds */}
      {visibleStyles.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Cartoon Avatars
            </h4>
            <button
              type="button"
              onClick={refreshSeeds}
              className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              title="Generate fresh avatars"
            >
              <RefreshCw className="h-3 w-3" />
              Shuffle
            </button>
          </div>

          {/* Style chips */}
          <div className="flex flex-wrap gap-1 mb-2.5">
            {visibleStyles.map((s) => {
              const isActive = activeStyle === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveStyle(s.id)}
                  title={s.description}
                  className={
                    "px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors " +
                    (isActive
                      ? "bg-brand-500 text-white border-brand-500"
                      : "border-border text-muted-foreground hover:border-brand-400 hover:text-foreground")
                  }
                >
                  {s.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {seeds.map((seed) => {
              const url = dicebearUrl(activeStyle, seed);
              return (
                <button
                  key={`${activeStyle}-${seed}`}
                  type="button"
                  onClick={() => addToCanvas(url)}
                  disabled={addingUrl === url}
                  className="relative aspect-square rounded-md border border-border hover:border-brand-500 hover:scale-[1.04] transition-all bg-gray-50 dark:bg-gray-800 group"
                  aria-label={`Add ${activeStyle} avatar`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`${activeStyle} avatar`}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-contain p-1"
                  />
                  {addingUrl === url && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-md">
                      <AISpinner className="h-4 w-4 animate-spin text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Microsoft Fluent 3D Emoji — colorful 3D stickers */}
      {visibleEmoji.length > 0 && (
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            3D Stickers
          </h4>
          <div className="grid grid-cols-4 gap-1.5">
            {visibleEmoji.map((e) => {
              const url = fluentUrl(e);
              return (
                <button
                  key={e.file}
                  type="button"
                  onClick={() => addToCanvas(url)}
                  disabled={addingUrl === url}
                  className="relative aspect-square rounded-md border border-border hover:border-brand-500 hover:scale-[1.05] transition-all bg-gray-50 dark:bg-gray-800"
                  aria-label={`Add ${e.name} sticker`}
                  title={e.name}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={e.name}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-contain p-1.5"
                  />
                  {addingUrl === url && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-md">
                      <AISpinner className="h-4 w-4 animate-spin text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground/70 mt-2">
            3D emoji from Microsoft Fluent · free to use under MIT license.
          </p>
        </section>
      )}

      {visibleStyles.length === 0 && visibleEmoji.length === 0 && (
        <div className="text-center py-8 text-xs text-muted-foreground">
          No matches for &ldquo;{search}&rdquo;
        </div>
      )}
    </div>
  );
}
