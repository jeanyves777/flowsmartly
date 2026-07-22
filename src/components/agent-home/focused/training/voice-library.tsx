"use client";

/**
 * Voice Library browser — search + filter the full ElevenLabs shared-voice library (language,
 * accent, gender, age, use case), preview any voice, and pick one for the AI co-host. The picked
 * voice is used by its id directly (no slot consumed), so the whole library is available.
 * [[training-presenter-talking-video]] [[voice-studio]]
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { X, Search, Play, Pause, Loader2, Volume2, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { VOICE_LANGUAGES, VOICE_ACCENTS, VOICE_AGES, VOICE_USE_CASES, type LibraryVoice } from "@/lib/training/studio-voices";

const cap = (s?: string) => (s ? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "");

export function VoiceLibrary({ open, onClose, onPick, assigning }: {
  open: boolean;
  onClose: () => void;
  onPick: (v: LibraryVoice) => void;
  assigning?: string | null; // voiceId currently being assigned by the parent
}) {
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("en");
  const [accent, setAccent] = useState("any");
  const [gender, setGender] = useState("any");
  const [age, setAge] = useState("any");
  const [useCase, setUseCase] = useState("any");
  const [showFilters, setShowFilters] = useState(true);
  const [voices, setVoices] = useState<LibraryVoice[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fetchPage = useCallback(async (page: number, replace: boolean) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (search.trim()) params.set("search", search.trim());
      const filters: [string, string][] = [["language", language], ["accent", accent], ["gender", gender], ["age", age], ["useCase", useCase]];
      for (const [k, v] of filters) if (v && v !== "any") params.set(k, v);
      const j = await fetch(`/api/ai/training/presenter/voice-library?${params.toString()}`).then((r) => r.json());
      if (j?.success) {
        setVoices((prev) => (replace ? j.data.voices : [...prev, ...j.data.voices]));
        setHasMore(!!j.data.hasMore);
      }
    } finally { setLoading(false); }
  }, [search, language, accent, gender, age, useCase]);

  // (Re)load page 0 whenever a filter changes (search is debounced).
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => void fetchPage(0, true), 300);
    return () => clearTimeout(t);
  }, [open, fetchPage]);

  // Stop audio when the browser closes.
  useEffect(() => { if (!open) { audioRef.current?.pause(); setPlaying(null); } }, [open]);

  const preview = (v: LibraryVoice) => {
    const a = audioRef.current;
    if (!a || !v.previewUrl) return;
    if (playing === v.voiceId) { a.pause(); setPlaying(null); return; }
    a.src = v.previewUrl;
    a.play().then(() => setPlaying(v.voiceId)).catch(() => setPlaying(null));
  };

  if (!open) return null;
  const selCls = "rounded-lg border border-border bg-muted px-2 py-1.5 text-[11.5px] font-semibold outline-none focus:border-brand-500";
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* header + search */}
        <div className="border-b border-border p-4">
          <div className="mb-3 flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white"><Volume2 className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1"><b className="block text-[15px]">Voice library</b><span className="text-[11.5px] text-muted-foreground">Thousands of studio voices — filter by language, accent, gender, age and style.</span></div>
            <button onClick={() => setShowFilters((s) => !s)} className={cn("inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-bold", showFilters ? "border-brand-500 text-brand-300" : "border-border hover:border-brand-500")}><SlidersHorizontal className="h-3.5 w-3.5" /> Filters</button>
            <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:border-brand-500"><X className="h-4 w-4" /></button>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search voices (name, style, tone)…" className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none" />
          </div>
          {showFilters ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className={selCls}>
                {VOICE_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
              <select value={accent} onChange={(e) => setAccent(e.target.value)} className={selCls}>
                <option value="any">Any accent</option>
                {VOICE_ACCENTS.map((a) => <option key={a} value={a}>{cap(a)}</option>)}
              </select>
              <select value={gender} onChange={(e) => setGender(e.target.value)} className={selCls}>
                <option value="any">Any gender</option><option value="male">Male</option><option value="female">Female</option><option value="neutral">Neutral</option>
              </select>
              <select value={age} onChange={(e) => setAge(e.target.value)} className={selCls}>
                <option value="any">Any age</option>
                {VOICE_AGES.map((a) => <option key={a.v} value={a.v}>{a.label}</option>)}
              </select>
              <select value={useCase} onChange={(e) => setUseCase(e.target.value)} className={selCls}>
                <option value="any">Any style</option>
                {VOICE_USE_CASES.map((u) => <option key={u.v} value={u.v}>{u.label}</option>)}
              </select>
              {(accent !== "any" || gender !== "any" || age !== "any" || useCase !== "any" || search) ? (
                <button onClick={() => { setAccent("any"); setGender("any"); setAge("any"); setUseCase("any"); setSearch(""); }} className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-bold text-muted-foreground hover:border-rose-500 hover:text-rose-400">Clear</button>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* list */}
        <div className="min-h-0 flex-1 overflow-auto p-3">
          {voices.length === 0 && loading ? (
            <div className="grid place-items-center py-16 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : voices.length === 0 ? (
            <div className="grid place-items-center py-16 text-[12.5px] text-muted-foreground">No voices match these filters — try widening them.</div>
          ) : (
            <div className="space-y-2">
              {voices.map((v) => {
                const isAssigning = assigning === v.voiceId;
                return (
                  <div key={v.voiceId} className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-2.5">
                    <button onClick={() => preview(v)} disabled={!v.previewUrl} title="Preview" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-500/15 text-brand-300 hover:bg-brand-500/25 disabled:opacity-40">{playing === v.voiceId ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
                    <div className="min-w-0 flex-1">
                      <b className="block truncate text-[12.5px]">{v.name}</b>
                      <span className="block truncate text-[10.5px] text-muted-foreground">{[cap(v.accent), cap(v.age), cap(v.useCase)].filter(Boolean).join(" · ") || v.description || "Studio voice"}</span>
                    </div>
                    <button onClick={() => onPick(v)} disabled={!!assigning} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-brand-500/50 px-3 py-1.5 text-[11.5px] font-bold text-brand-300 hover:bg-brand-500/10 disabled:opacity-40">{isAssigning ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Using…</> : "Use voice"}</button>
                  </div>
                );
              })}
              {hasMore ? (
                <button onClick={() => void fetchPage(Math.ceil(voices.length / 24), false)} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-[12px] font-bold hover:border-brand-500 disabled:opacity-50">{loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Loading…</> : "Show more voices"}</button>
              ) : null}
            </div>
          )}
        </div>
      </div>
      <audio ref={audioRef} onEnded={() => setPlaying(null)} className="hidden" />
    </div>
  );
}
