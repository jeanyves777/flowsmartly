"use client";

import { useEffect, useMemo, useState } from "react";
import { Users, RefreshCw, Sparkles, ImageIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useCanvasStore } from "../hooks/use-canvas-store";
import { addImageToCanvas } from "../utils/canvas-helpers";
import { AISpinner } from "@/components/shared/ai-generation-loader";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils/cn";

/**
 * Avatars panel — real human portraits + (optional) cartoon avatars +
 * 3D emoji stickers. Tab-style sub-navigation since the user clarified
 * "when we say avatar we are talking about real human avatars".
 *
 * Sources (all free, no key required):
 *  - PEOPLE: Pexels portrait photos via /api/pexels/search (default tab).
 *    Real human photos — backgrounds vary; user can crop/cut on canvas.
 *  - CARTOON: DiceBear (api.dicebear.com) — cartoon avatars in many
 *    styles. Returns transparent PNG by default.
 *  - STICKERS: Microsoft Fluent 3D Emoji — 3D emoji as transparent PNGs
 *    hosted on the official microsoft/fluentui-emoji GitHub repo.
 */

type Tab = "people" | "cartoon" | "stickers";

interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  alt: string;
  photographer: string;
  thumbUrl: string;
  previewUrl: string;
}

interface DiceBearStyle {
  id: string;
  label: string;
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

interface FluentEmoji {
  name: string; display: string; file: string;
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
const fluentUrl = (e: FluentEmoji) => `${FLUENT_BASE}/${e.display}/3D/${e.file}_3d.png`;
const dicebearUrl = (style: string, seed: string, size = 256) =>
  `https://api.dicebear.com/9.x/${encodeURIComponent(style)}/png?seed=${encodeURIComponent(seed)}&size=${size}`;

const makeSeeds = (count = 8): string[] => {
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(Math.random().toString(36).slice(2, 10));
  return out;
};

// Pre-baked search suggestions for People tab — clicking applies the
// keyword + portrait orientation so the user sees relevant headshots
// immediately on first open.
const PEOPLE_SUGGESTIONS = [
  "professional portrait",
  "smiling person",
  "business headshot",
  "diverse people",
  "happy woman",
  "happy man",
  "elder portrait",
  "child portrait",
];

export function AvatarsPanel() {
  const canvas = useCanvasStore((s) => s.canvas);
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("people");

  // People (Pexels) state
  const [peopleQuery, setPeopleQuery] = useState("professional portrait");
  const [peopleDebounced, setPeopleDebounced] = useState(peopleQuery);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [peoplePhotos, setPeoplePhotos] = useState<PexelsPhoto[]>([]);

  // Cartoon (DiceBear) state
  const [activeStyle, setActiveStyle] = useState("adventurer");
  const [seeds, setSeeds] = useState<string[]>(() => makeSeeds());
  const [stylesQuery, setStylesQuery] = useState("");

  // Common state
  const [addingUrl, setAddingUrl] = useState<string | null>(null);

  // ─── People tab: debounced Pexels search (portrait orientation) ───
  useEffect(() => {
    const t = setTimeout(() => setPeopleDebounced(peopleQuery), 350);
    return () => clearTimeout(t);
  }, [peopleQuery]);

  useEffect(() => {
    if (tab !== "people") return;
    let cancelled = false;
    setPeopleLoading(true);
    const params = new URLSearchParams({
      q: peopleDebounced,
      per_page: "24",
      orientation: "portrait",
    });
    fetch(`/api/pexels/search?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setPeoplePhotos(data.success ? (data.photos || []) : []);
      })
      .catch(() => { if (!cancelled) setPeoplePhotos([]); })
      .finally(() => { if (!cancelled) setPeopleLoading(false); });
    return () => { cancelled = true; };
  }, [peopleDebounced, tab]);

  // ─── Cartoon tab: filter visible styles by query ───
  const visibleStyles = useMemo(() => {
    if (!stylesQuery.trim()) return AVATAR_STYLES;
    const q = stylesQuery.toLowerCase();
    return AVATAR_STYLES.filter((s) => s.label.toLowerCase().includes(q) || s.id.includes(q));
  }, [stylesQuery]);

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
    <div className="p-3 space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-1.5">
        <Users className="h-4 w-4 text-brand-500" />
        Avatars
      </h3>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-lg bg-muted">
        {([
          { id: "people", label: "Real People", icon: Users },
          { id: "cartoon", label: "Cartoon", icon: ImageIcon },
          { id: "stickers", label: "3D", icon: Sparkles },
        ] as const).map((t) => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[11px] font-medium transition-colors",
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3 w-3" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* PEOPLE TAB — Pexels portrait photos */}
      {tab === "people" && (
        <div className="space-y-3">
          <Input
            value={peopleQuery}
            onChange={(e) => setPeopleQuery(e.target.value)}
            placeholder="Search portraits…"
            className="h-8 text-xs"
            aria-label="Search real people portraits"
          />

          {/* Suggestion chips */}
          <div className="flex flex-wrap gap-1">
            {PEOPLE_SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setPeopleQuery(s)}
                className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors",
                  peopleQuery === s
                    ? "bg-brand-500 text-white border-brand-500"
                    : "border-border text-muted-foreground hover:border-brand-400 hover:text-foreground",
                )}
              >
                {s}
              </button>
            ))}
          </div>

          {peopleLoading ? (
            <div className="flex items-center justify-center py-6">
              <AISpinner className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : peoplePhotos.length === 0 ? (
            <div className="text-center py-6 text-xs text-muted-foreground">
              No results — try another search
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {peoplePhotos.map((p) => {
                const url = p.previewUrl;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addToCanvas(url)}
                    disabled={addingUrl === url}
                    title={`${p.alt} — by ${p.photographer}`}
                    className="relative aspect-[3/4] rounded-md border border-border hover:border-brand-500 hover:scale-[1.03] transition-all bg-gray-50 dark:bg-gray-800 group overflow-hidden"
                    aria-label={`Add portrait by ${p.photographer}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.thumbUrl}
                      alt={p.alt}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    {addingUrl === url && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-md">
                        <AISpinner className="h-4 w-4 animate-spin text-white" />
                      </div>
                    )}
                    {/* Photographer credit on hover (Pexels attribution) */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1 translate-y-full group-hover:translate-y-0 transition-transform pointer-events-none">
                      <p className="text-white text-[8px] font-medium truncate">© {p.photographer}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground/70 pt-1 text-center">
            Free portraits from{" "}
            <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
              Pexels
            </a>
          </p>
        </div>
      )}

      {/* CARTOON TAB — DiceBear styles */}
      {tab === "cartoon" && (
        <div className="space-y-3">
          <Input
            value={stylesQuery}
            onChange={(e) => setStylesQuery(e.target.value)}
            placeholder="Search styles…"
            className="h-8 text-xs"
            aria-label="Search cartoon avatar styles"
          />

          {/* Style chips */}
          <div className="flex flex-wrap gap-1">
            {visibleStyles.map((s) => {
              const isActive = activeStyle === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveStyle(s.id)}
                  title={s.description}
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors",
                    isActive
                      ? "bg-brand-500 text-white border-brand-500"
                      : "border-border text-muted-foreground hover:border-brand-400 hover:text-foreground",
                  )}
                >
                  {s.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-end -mt-1">
            <button
              type="button"
              onClick={() => setSeeds(makeSeeds())}
              className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              title="Generate fresh avatars"
            >
              <RefreshCw className="h-3 w-3" />
              Shuffle
            </button>
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
                  className="relative aspect-square rounded-md border border-border hover:border-brand-500 hover:scale-[1.04] transition-all bg-gray-50 dark:bg-gray-800"
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
        </div>
      )}

      {/* STICKERS TAB — Microsoft Fluent 3D Emoji */}
      {tab === "stickers" && (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-1.5">
            {FLUENT_EMOJI.map((e) => {
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
          <p className="text-[10px] text-muted-foreground/70 pt-1 text-center">
            3D emoji from Microsoft Fluent · MIT
          </p>
        </div>
      )}
    </div>
  );
}
