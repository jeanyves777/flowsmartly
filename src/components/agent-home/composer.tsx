"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Mic, ArrowUp, Sparkles, ChevronDown, Check, Upload, FolderOpen, ImageUp, X } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { MediaLibraryPicker } from "@/components/shared/media-library-picker";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils/cn";

/** An image attached to the next agent message — a device upload (base64
 *  `dataUrl`) or a hosted media-library pick (`url`). */
export type ComposerAttachment = { dataUrl?: string; url?: string; name: string };

const MAX_ATTACHMENTS = 4;

// Composer modes — extensible: add an entry to surface a new mode in the drop-up.
export const COMPOSER_MODES = [
  { key: "standard", label: "Standard", hint: "fast & cheap", desc: "Cheapest model — best for everyday tasks.", superMode: false },
  { key: "super", label: "Super", hint: "premium · +15 cr", desc: "Premium model for complex tasks (+15 credits/turn).", superMode: true },
];

/**
 * The shared agent composer (mode drop-up + attach + textarea + send). Owns its
 * own draft, mode and image attachments so it can be dropped into both the
 * centered home and the focused view's chat column without prop threading.
 * `onSend(text, superMode, attachments?)`. Images can be added via the + menu
 * (device upload / media library) or dragged straight onto the composer.
 */
export function Composer({
  onSend,
  sending,
  placeholder,
  autoFocus = false,
}: {
  onSend: (text: string, superMode: boolean, attachments?: ComposerAttachment[]) => void;
  sending: boolean;
  placeholder: string;
  autoFocus?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [modeKey, setModeKey] = useState("standard");
  const [modeOpen, setModeOpen] = useState(false);
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [attachOpen, setAttachOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const modeRef = useRef<HTMLDivElement>(null);
  const attachRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  // Grow the textarea with its content up to a cap (then it scrolls), and snap
  // it back to one row when empty. Called on input and after send so the box
  // returns to its initial size instead of staying expanded.
  const autosize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  useEffect(() => {
    if (!modeOpen) return;
    const h = (e: MouseEvent) => { if (modeRef.current && !modeRef.current.contains(e.target as Node)) setModeOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [modeOpen]);

  useEffect(() => {
    if (!attachOpen) return;
    const h = (e: MouseEvent) => { if (attachRef.current && !attachRef.current.contains(e.target as Node)) setAttachOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [attachOpen]);

  // Device files → base64 data URLs the agent reads as vision input. Images
  // only, 5 MB each, up to 4 total.
  const addFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const slots = Math.max(0, MAX_ATTACHMENTS - attachments.length);
    const picked = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, slots);
    if (picked.length === 0) {
      if (attachments.length >= MAX_ATTACHMENTS) toast({ variant: "destructive", title: "Limit reached", description: `Up to ${MAX_ATTACHMENTS} images.` });
      else toast({ title: "Images only", description: "Attach PNG/JPG/WebP images as reference." });
      return;
    }
    picked.forEach((file) => {
      if (file.size > 5 * 1024 * 1024) { toast({ variant: "destructive", title: "File too large", description: "Max 5 MB per image." }); return; }
      const reader = new FileReader();
      reader.onload = () => { const dataUrl = reader.result as string; setAttachments((prev) => (prev.length >= MAX_ATTACHMENTS ? prev : [...prev, { dataUrl, name: file.name }])); };
      reader.readAsDataURL(file);
    });
  }, [attachments.length, toast]);

  // A hosted image from the user's own media library — keep the URL (the server
  // fetches it for vision on send).
  const pickFromLibrary = useCallback((url: string) => {
    setAttachments((prev) => (prev.length >= MAX_ATTACHMENTS || prev.some((a) => a.url === url) ? prev : [...prev, { url, name: url.split("/").pop() || "library image" }]));
    setLibraryOpen(false);
    setAttachOpen(false);
  }, []);

  const mode = COMPOSER_MODES.find((m) => m.key === modeKey) ?? COMPOSER_MODES[0];
  const superMode = mode.superMode;
  const canSend = draft.trim().length > 0 || attachments.length > 0;
  const atLimit = attachments.length >= MAX_ATTACHMENTS;

  const submit = () => {
    if (!canSend || sending) return;
    onSend(draft.trim(), superMode, attachments.length ? attachments : undefined);
    setDraft("");
    setAttachments([]);
    // Reset the box to its initial one-row height — without this the textarea
    // keeps the expanded inline height from the message just sent.
    if (taRef.current) taRef.current.style.height = "auto";
  };

  return (
    <div
      className={cn("relative rounded-3xl border bg-card shadow-lg transition-colors", dragOver ? "border-brand-500 ring-2 ring-brand-500/30" : "border-border")}
      onDragOver={(e) => { if (e.dataTransfer?.types?.includes("Files")) { e.preventDefault(); setDragOver(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false); }}
      onDrop={(e) => { if (e.dataTransfer?.types?.includes("Files")) { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); } }}
    >
      {dragOver && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center rounded-3xl bg-brand-500/10 text-[13px] font-semibold text-brand-500">
          <ImageUp className="me-1.5 h-4 w-4" /> Drop images to attach
        </div>
      )}

      <div className="relative px-3 pt-2.5" ref={modeRef}>
        <button
          type="button"
          onClick={() => setModeOpen((o) => !o)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] transition-colors",
            superMode ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          <Sparkles className="h-3.5 w-3.5 text-brand-500" /> <b className="text-foreground">{mode.label}</b> · {mode.hint}
          <ChevronDown className="h-3 w-3" />
        </button>
        {modeOpen && (
          <div
            className="absolute bottom-full left-3 z-50 mb-2 w-60 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-2xl"
            style={{ maxHeight: "20rem", overflowY: "auto", overscrollBehavior: "contain" }}
          >
            <div className="px-2.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Mode</div>
            {COMPOSER_MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => { setModeKey(m.key); setModeOpen(false); }}
                className={cn("flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted", m.key === modeKey && "bg-brand-500/10")}
              >
                <Sparkles className={cn("mt-0.5 h-4 w-4 shrink-0", m.key === modeKey ? "text-brand-500" : "text-muted-foreground")} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[13px] font-medium">
                    {m.label}
                    {m.key === modeKey && <Check className="h-3.5 w-3.5 text-brand-500" />}
                  </span>
                  <span className="block text-[11px] leading-snug text-muted-foreground">{m.desc}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Attachment preview chips (above the input row) */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 pt-2.5">
          {attachments.map((a, i) => (
            <div key={i} className="group relative h-14 w-14 overflow-hidden rounded-lg border border-border bg-muted/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.dataUrl || a.url} alt={a.name} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Remove attachment"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 px-3 pb-3 pt-2 sm:gap-2.5">
        {/* Attach: a + that opens a drop-up (device upload / media library) so
            both files AND the user's own library are reachable, plus drag-drop. */}
        <div className="relative shrink-0" ref={attachRef}>
          {attachOpen && (
            <div className="absolute bottom-full left-0 z-50 mb-2 w-52 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl">
              <button
                type="button"
                onClick={() => { setAttachOpen(false); fileInputRef.current?.click(); }}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-[13px] transition-colors hover:bg-muted"
              >
                <Upload className="h-4 w-4 text-muted-foreground" /> Upload from device
              </button>
              <button
                type="button"
                onClick={() => { setAttachOpen(false); setLibraryOpen(true); }}
                className="flex w-full items-center gap-2.5 border-t border-border px-3 py-2.5 text-[13px] transition-colors hover:bg-muted"
              >
                <FolderOpen className="h-4 w-4 text-muted-foreground" /> Media library
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setAttachOpen((o) => !o)}
            disabled={sending || atLimit}
            title={atLimit ? `Up to ${MAX_ATTACHMENTS} images` : "Attach images"}
            aria-label="Attach images"
            className={cn(
              "grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40",
              attachOpen && "border-brand-500/60 text-brand-500",
            )}
          >
            <Plus className="h-[18px] w-[18px]" />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={(e) => { addFiles(e.target.files); if (e.target) e.target.value = ""; }}
        />

        <textarea
          ref={taRef}
          rows={1}
          value={draft}
          placeholder={placeholder}
          disabled={sending}
          autoFocus={autoFocus}
          onChange={(e) => { setDraft(e.target.value); autosize(e.target); }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          className="max-h-[120px] flex-1 resize-none overflow-y-auto rounded-2xl bg-transparent px-1 py-1.5 text-[15px] leading-relaxed outline-none disabled:opacity-60"
        />
        {/* One button: Mic when there's nothing to send, Send otherwise. */}
        <button
          onClick={() => { if (canSend) submit(); }}
          disabled={sending}
          aria-label={canSend ? "Send" : "Voice input"}
          className={cn(
            "grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full transition-colors disabled:opacity-60",
            canSend ? "bg-gradient-to-r from-brand-500 to-violet-500 text-white shadow-sm shadow-brand-500/30" : "border border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {sending ? <FlowLoader size={18} tone="white" /> : canSend ? <ArrowUp className="h-[18px] w-[18px]" /> : <Mic className="h-[18px] w-[18px]" />}
        </button>
      </div>

      <MediaLibraryPicker open={libraryOpen} onClose={() => setLibraryOpen(false)} onSelect={(url) => pickFromLibrary(url)} />
    </div>
  );
}
