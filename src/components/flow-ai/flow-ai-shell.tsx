"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Send,
  X,
  Plus,
  MessageSquare,
  ChevronLeft,
  Trash2,
  Image as ImageIcon,
  Film,
  Crown,
  Zap,
  Download,
  Paperclip,
  Link as LinkIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/hooks/use-toast";
import { confirmDialog } from "@/components/shared/confirm-dialog";
import { AISpinner, AIGenerationLoader } from "@/components/shared/ai-generation-loader";

/**
 * FlowAI Shell — multi-modal conversational assistant, fullscreen overlay.
 *
 * Modes (mode selector pills above the input):
 *   • Text  — streaming chat for writing, ideas, copy, strategy
 *   • Image — single image generation (Standard / Premium tier toggle)
 *   • Video — short video clip (Standard / Premium tier toggle)
 *
 * Provider tier rule (see feedback-media-provider-labels memory):
 *   Premium / Standard ONLY. Never expose openai/xai/google/grok/veo names
 *   in user-facing copy.
 *
 * Backed by /api/ai/assistant/generate which streams SSE for every mode
 * (text deltas, image/video status + final media frame).
 */

type Mode = "text" | "image" | "video";
type Tier = "standard" | "premium";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  mediaType?: "image" | "video" | null;
  mediaUrl?: string | null;
  createdAt?: string;
}

interface ConversationListItem {
  id: string;
  title: string | null;
  updatedAt: string;
  messageCount?: number;
}

const COST_BY_MODE: Record<Mode, number> = {
  text: 2,
  image: 15,
  video: 60,
};

const MODE_LABEL: Record<Mode, string> = {
  text: "Text",
  image: "Image",
  video: "Video",
};

const MODE_PLACEHOLDER: Record<Mode, string> = {
  text: "Ask FlowAI to write, brainstorm, plan…",
  image: "Describe the image you want — subject, mood, style…",
  video: "Describe the video clip — scene, action, vibe…",
};

export function FlowAIShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const initialConversationId = searchParams.get("conversationId");

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId);
  const [conversationTitle, setConversationTitle] = useState("New conversation");
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mode, setMode] = useState<Mode>("text");
  const [tier, setTier] = useState<Tier>("standard");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const threadRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Media analysis (upload an image OR paste a URL → Claude Haiku vision)
  const [analyzing, setAnalyzing] = useState(false);
  const [urlInputOpen, setUrlInputOpen] = useState(false);
  const [urlInput, setUrlInput] = useState("");

  // Load conversations + (if any) the active conversation history.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const listRes = await fetch("/api/ai/assistant/conversations");
        const listJson = await listRes.json();
        if (!cancelled && listJson?.success) {
          const raw = listJson.data?.conversations ?? listJson.conversations ?? [];
          setConversations(
            raw.map((c: { id: string; title: string | null; updatedAt: string; messageCount?: number; _count?: { messages?: number } }) => ({
              id: c.id,
              title: c.title,
              updatedAt: c.updatedAt,
              messageCount: c.messageCount ?? c._count?.messages ?? 0,
            })),
          );
        }
        if (initialConversationId) {
          const histRes = await fetch(`/api/ai/assistant/conversations/${initialConversationId}`);
          const histJson = await histRes.json();
          if (!cancelled && histJson?.success) {
            const conv = histJson.data ?? histJson.conversation ?? histJson;
            const rawMsgs = conv?.messages ?? histJson.messages ?? [];
            setMessages(
              rawMsgs.map((m: { id: string; role: "user" | "assistant"; content: string; mediaType?: string | null; mediaUrl?: string | null; createdAt?: string }) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                mediaType: (m.mediaType === "image" || m.mediaType === "video") ? m.mediaType : null,
                mediaUrl: m.mediaUrl ?? null,
                createdAt: m.createdAt,
              })),
            );
            setConversationTitle(conv?.title || "Conversation");
          }
        }
      } catch (err) {
        console.error("[FlowAI] failed to load:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [initialConversationId]);

  // Auto-scroll on new messages or status update.
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, sending, statusMessage]);

  // Auto-grow input.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [input]);

  const refreshConversations = useCallback(async (activeId: string | null) => {
    try {
      const res = await fetch("/api/ai/assistant/conversations");
      const json = await res.json();
      if (json?.success) {
        const raw = json.data?.conversations ?? json.conversations ?? [];
        const items: ConversationListItem[] = raw.map(
          (c: { id: string; title: string | null; updatedAt: string; messageCount?: number; _count?: { messages?: number } }) => ({
            id: c.id,
            title: c.title,
            updatedAt: c.updatedAt,
            messageCount: c.messageCount ?? c._count?.messages ?? 0,
          }),
        );
        setConversations(items);
        const updated = items.find((c) => c.id === activeId);
        if (updated?.title) setConversationTitle(updated.title);
      }
    } catch {
      /* non-critical */
    }
  }, []);

  // Convert a File to base64 (without the data: prefix) for the analyze endpoint.
  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const comma = result.indexOf(",");
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });

  // Run media analysis (upload OR URL) → append assistant message with the
  // structured result + a row of action buttons. Doesn't open a separate
  // panel — it lives inline in chat like any other AI turn.
  const analyzeMedia = useCallback(
    async (payload: { mediaUrl?: string; base64?: string; previewUrl?: string; userNote?: string }) => {
      if (analyzing) return;
      setAnalyzing(true);
      const userMsg: Message = {
        id: `u-${Date.now()}`,
        role: "user",
        content: payload.userNote
          ? `Analyze this image — ${payload.userNote}`
          : "Analyze this image",
        mediaType: "image",
        mediaUrl: payload.previewUrl || payload.mediaUrl || null,
      };
      const pendingMsg: Message = {
        id: `p-${Date.now()}`,
        role: "assistant",
        content: "Analyzing image with vision model…",
      };
      setMessages((prev) => [...prev, userMsg, pendingMsg]);

      try {
        const res = await fetch("/api/flow-ai/analyze-media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mediaUrl: payload.mediaUrl,
            base64: payload.base64,
            userNote: payload.userNote,
          }),
        });
        const json = await res.json();
        if (!json?.success) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === pendingMsg.id
                ? { ...m, content: `Analysis failed: ${json?.error?.message || "unknown error"}` }
                : m,
            ),
          );
          return;
        }
        const a = json.data.analysis as {
          description: string;
          subject: string;
          mood: string;
          dominantColors: string[];
          textVisible: string | null;
          brandFitNotes: string | null;
          suggestedUses: string[];
        };
        const lines = [
          `**${a.subject}** — ${a.mood}`,
          a.description,
          a.brandFitNotes ? `Brand fit: ${a.brandFitNotes}` : "",
          a.textVisible ? `Visible text: "${a.textVisible}"` : "",
          a.dominantColors?.length ? `Colors: ${a.dominantColors.join(", ")}` : "",
          a.suggestedUses?.length
            ? `\nSuggested uses:\n${a.suggestedUses.map((s) => `• ${s}`).join("\n")}`
            : "",
          `\nWhat would you like to do with this image?`,
        ]
          .filter(Boolean)
          .join("\n\n");
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingMsg.id
              ? { ...m, content: lines, mediaType: "image", mediaUrl: payload.previewUrl || payload.mediaUrl || null }
              : m,
          ),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Analysis failed";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingMsg.id ? { ...m, content: `Analysis failed: ${message}` } : m,
          ),
        );
      } finally {
        setAnalyzing(false);
      }
    },
    [analyzing],
  );

  const handleFilePick = useCallback(
    async (file: File | null) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        toast({ variant: "destructive", title: "Image required", description: "Only image files supported." });
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        toast({ variant: "destructive", title: "File too large", description: "Max 8 MB." });
        return;
      }
      const base64 = await fileToBase64(file);
      const previewUrl = `data:${file.type};base64,${base64}`;
      analyzeMedia({ base64, previewUrl, userNote: input.trim() || undefined });
      setInput("");
    },
    [analyzeMedia, input, toast],
  );

  const handleUrlSubmit = useCallback(() => {
    const url = urlInput.trim();
    if (!url) return;
    if (!/^https?:\/\//.test(url) && !url.startsWith("data:")) {
      toast({ variant: "destructive", title: "Invalid URL", description: "Must be http(s) or data:" });
      return;
    }
    analyzeMedia({ mediaUrl: url, previewUrl: url, userNote: input.trim() || undefined });
    setUrlInput("");
    setUrlInputOpen(false);
    setInput("");
  }, [analyzeMedia, input, urlInput, toast]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;
      setInput("");
      setSending(true);
      setStatusMessage(mode === "text" ? null : "Preparing…");

      const userMsg: Message = {
        id: `tmp-u-${Date.now()}`,
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      };
      const pendingMsg: Message = {
        id: `tmp-a-${Date.now()}`,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg, pendingMsg]);

      try {
        const res = await fetch("/api/ai/assistant/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed, conversationId, mode, tier }),
        });

        if (!res.ok || !res.body) {
          let errMsg = "Generation failed";
          try {
            const data = await res.json();
            errMsg = data?.error || data?.message || errMsg;
          } catch { /* not json */ }
          throw new Error(errMsg);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let assistantContent = "";
        let newConvId: string | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";
          for (const evt of events) {
            const line = evt.split("\n").find((l) => l.startsWith("data: "));
            if (!line) continue;
            const payload = line.slice(6);
            let data: {
              type: string;
              conversationId?: string;
              text?: string;
              message?: string;
              mediaType?: "image" | "video";
              mediaUrl?: string;
              content?: string;
            };
            try {
              data = JSON.parse(payload);
            } catch {
              continue;
            }
            if (data.type === "start" && data.conversationId) {
              newConvId = data.conversationId;
            } else if (data.type === "status" && typeof data.message === "string") {
              setStatusMessage(data.message);
            } else if (data.type === "delta" && typeof data.text === "string") {
              assistantContent += data.text;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === pendingMsg.id ? { ...m, content: assistantContent } : m,
                ),
              );
            } else if (data.type === "media" && data.mediaType && data.mediaUrl) {
              const finalContent = data.content || assistantContent || "Generated.";
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === pendingMsg.id
                    ? {
                        ...m,
                        content: finalContent,
                        mediaType: data.mediaType ?? null,
                        mediaUrl: data.mediaUrl ?? null,
                      }
                    : m,
                ),
              );
            } else if (data.type === "done") {
              setStatusMessage(null);
            } else if (data.type === "error") {
              throw new Error(data.message || "Stream error");
            }
          }
        }

        if (newConvId && !conversationId) {
          setConversationId(newConvId);
          const url = new URL(window.location.href);
          url.searchParams.set("conversationId", newConvId);
          window.history.replaceState({}, "", url.toString());
        }
        refreshConversations(newConvId || conversationId).catch(() => {});
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== pendingMsg.id));
        toast({
          title: "Couldn't generate",
          description: err instanceof Error ? err.message : "Try again",
          variant: "destructive",
        });
      } finally {
        setSending(false);
        setStatusMessage(null);
      }
    },
    [conversationId, sending, mode, tier, refreshConversations, toast],
  );

  const handleNewConversation = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    setConversationTitle("New conversation");
    const url = new URL(window.location.href);
    url.searchParams.delete("conversationId");
    window.history.replaceState({}, "", url.toString());
    textareaRef.current?.focus();
  }, []);

  const handleOpenConversation = useCallback(
    async (id: string) => {
      if (id === conversationId) return;
      setLoading(true);
      setConversationId(id);
      const url = new URL(window.location.href);
      url.searchParams.set("conversationId", id);
      window.history.replaceState({}, "", url.toString());
      try {
        const res = await fetch(`/api/ai/assistant/conversations/${id}`);
        const json = await res.json();
        if (json?.success) {
          const conv = json.data ?? json.conversation ?? json;
          const rawMsgs = conv?.messages ?? json.messages ?? [];
          setMessages(
            rawMsgs.map((m: { id: string; role: "user" | "assistant"; content: string; mediaType?: string | null; mediaUrl?: string | null; createdAt?: string }) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              mediaType: (m.mediaType === "image" || m.mediaType === "video") ? m.mediaType : null,
              mediaUrl: m.mediaUrl ?? null,
              createdAt: m.createdAt,
            })),
          );
          setConversationTitle(conv?.title || "Conversation");
        }
      } catch {
        toast({ title: "Couldn't load conversation", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    },
    [conversationId, toast],
  );

  const handleDeleteConversation = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const ok = await confirmDialog({
        title: "Delete this conversation?",
        description: "This permanently removes the conversation and its messages.",
        confirmText: "Delete",
        variant: "destructive",
      });
      if (!ok) return;
      try {
        await fetch(`/api/ai/assistant/conversations/${id}`, { method: "DELETE" });
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (id === conversationId) handleNewConversation();
      } catch {
        toast({ title: "Couldn't delete", variant: "destructive" });
      }
    },
    [conversationId, handleNewConversation, toast],
  );

  const handleClose = useCallback(() => {
    router.push("/dashboard");
  }, [router]);

  const currentCost = COST_BY_MODE[mode];
  const tierAvailable = mode !== "text";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex bg-gradient-to-br from-slate-50 via-blue-50/40 to-cyan-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950/30"
    >
      {/* Left rail */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="w-72 flex-shrink-0 bg-white/85 dark:bg-gray-900/85 backdrop-blur-xl border-r border-border flex flex-col"
          >
            <div className="p-3 border-b border-border flex items-center gap-2">
              <button
                type="button"
                onClick={handleNewConversation}
                className="flex-1 flex items-center justify-center gap-2 h-9 rounded-md bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white text-sm font-medium transition-colors shadow-sm shadow-blue-500/20"
              >
                <Plus className="h-4 w-4" />
                New conversation
              </button>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="h-9 w-9 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
                aria-label="Hide sidebar"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {conversations.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3">No conversations yet</p>
              ) : (
                conversations.map((c) => (
                  <div
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleOpenConversation(c.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleOpenConversation(c.id);
                    }}
                    className={cn(
                      "group w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2 cursor-pointer",
                      c.id === conversationId
                        ? "bg-blue-500/10 text-blue-700 dark:text-blue-300"
                        : "hover:bg-muted text-foreground",
                    )}
                  >
                    <MessageSquare className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
                    <span className="truncate flex-1">{c.title || "Untitled"}</span>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteConversation(c.id, e)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      aria-label="Delete conversation"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="p-3 border-t border-border text-[10px] text-muted-foreground/80 leading-snug">
              FlowAI · text, image, and video<br />
              Premium &amp; Standard tiers for media
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between gap-3 px-4 h-14 border-b border-border bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl">
          <div className="flex items-center gap-2 min-w-0">
            {!sidebarOpen && (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="h-9 w-9 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center flex-shrink-0"
                aria-label="Show sidebar"
              >
                <MessageSquare className="h-4 w-4" />
              </button>
            )}
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/30">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold truncate">{conversationTitle}</h1>
              <p className="text-[10px] text-muted-foreground">FlowAI · text · image · video</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="h-9 w-9 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div ref={threadRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
          <div className="max-w-3xl mx-auto space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
                <AISpinner size={16} />
                Loading…
              </div>
            ) : messages.length === 0 ? (
              <FlowAIEmptyState mode={mode} onSuggest={(q) => send(q)} />
            ) : (
              messages.map((m) => <MessageView key={m.id} message={m} />)
            )}
            {sending && messages.length > 0 && messages[messages.length - 1]?.role === "user" && (
              <PendingAssistant mode={mode} tier={tier} status={statusMessage} />
            )}
          </div>
        </div>

        <div className="border-t border-border bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl px-4 sm:px-6 py-3">
          <div className="max-w-3xl mx-auto">
            <ModeToolbar
              mode={mode}
              setMode={setMode}
              tier={tier}
              setTier={setTier}
              showTier={tierAvailable}
              disabled={sending}
            />

            {urlInputOpen && (
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-blue-50/40 dark:bg-blue-950/20 px-2 py-1.5">
                <LinkIcon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 ml-1" />
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleUrlSubmit();
                    } else if (e.key === "Escape") {
                      setUrlInputOpen(false);
                      setUrlInput("");
                    }
                  }}
                  placeholder="Paste an image URL — https://..."
                  className="flex-1 bg-transparent border-0 outline-none focus:ring-0 text-sm py-1"
                  autoFocus
                  disabled={analyzing}
                />
                <button
                  type="button"
                  onClick={handleUrlSubmit}
                  disabled={analyzing || !urlInput.trim()}
                  className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-40 px-1"
                >
                  Analyze
                </button>
                <button
                  type="button"
                  onClick={() => { setUrlInputOpen(false); setUrlInput(""); }}
                  className="text-xs text-muted-foreground hover:text-foreground px-1"
                >
                  Cancel
                </button>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                handleFilePick(file);
                if (e.target) e.target.value = "";
              }}
            />

            <div className="mt-2 flex items-end gap-2 rounded-2xl border border-border bg-white dark:bg-gray-900 shadow-sm focus-within:border-blue-500 focus-within:shadow-md transition-all px-2 py-1.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending || analyzing}
                className="h-9 w-9 rounded-md text-muted-foreground hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors flex items-center justify-center flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Upload image"
                title="Upload an image to analyze"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setUrlInputOpen((v) => !v)}
                disabled={sending || analyzing}
                className={cn(
                  "h-9 w-9 rounded-md transition-colors flex items-center justify-center flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed",
                  urlInputOpen
                    ? "text-blue-600 bg-blue-50 dark:bg-blue-950/30"
                    : "text-muted-foreground hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30",
                )}
                aria-label="Analyze image from URL"
                title="Paste an image URL to analyze"
              >
                <LinkIcon className="h-4 w-4" />
              </button>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={1}
                placeholder={
                  analyzing
                    ? "Analyzing image…"
                    : urlInputOpen
                    ? "Optional context for the image above…"
                    : MODE_PLACEHOLDER[mode]
                }
                className="flex-1 bg-transparent border-0 outline-none focus:ring-0 resize-none py-2 px-2 text-sm leading-relaxed max-h-40"
                disabled={sending || analyzing}
              />
              <button
                type="button"
                onClick={() => send(input)}
                disabled={sending || analyzing || !input.trim()}
                className="h-9 w-9 rounded-md bg-gradient-to-br from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white transition-colors flex items-center justify-center flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-blue-500/20"
                aria-label="Send"
              >
                {sending || analyzing ? <AISpinner size={16} /> : <Send className="h-4 w-4" />}
              </button>
            </div>

            <p className="text-[10px] text-muted-foreground/80 mt-1.5 text-center">
              {MODE_LABEL[mode]}
              {tierAvailable ? ` · ${tier === "premium" ? "Premium" : "Standard"}` : ""}
              {" · "}~{currentCost} credit{currentCost === 1 ? "" : "s"} per generation
              {" · "}Shift+Enter for newline
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Mode toolbar ─────────────────────────────────────────────────────────

function ModeToolbar({
  mode,
  setMode,
  tier,
  setTier,
  showTier,
  disabled,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
  tier: Tier;
  setTier: (t: Tier) => void;
  showTier: boolean;
  disabled: boolean;
}) {
  const modes: Array<{ key: Mode; label: string; icon: typeof MessageSquare }> = [
    { key: "text", label: "Text", icon: MessageSquare },
    { key: "image", label: "Image", icon: ImageIcon },
    { key: "video", label: "Video", icon: Film },
  ];
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <div className="inline-flex p-0.5 rounded-lg bg-muted/60 border border-border">
        {modes.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            disabled={disabled}
            className={cn(
              "h-8 px-3 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-all",
              mode === key
                ? "bg-white dark:bg-gray-900 text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {showTier && (
        <div className="inline-flex p-0.5 rounded-lg bg-muted/60 border border-border">
          <button
            type="button"
            onClick={() => setTier("standard")}
            disabled={disabled}
            className={cn(
              "h-8 px-3 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-all",
              tier === "standard"
                ? "bg-white dark:bg-gray-900 text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            title="Faster, lower cost"
          >
            <Zap className="h-3.5 w-3.5" />
            Standard
          </button>
          <button
            type="button"
            onClick={() => setTier("premium")}
            disabled={disabled}
            className={cn(
              "h-8 px-3 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-all",
              tier === "premium"
                ? "bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            title="Highest quality"
          >
            <Crown className="h-3.5 w-3.5" />
            Premium
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────

function FlowAIEmptyState({ mode, onSuggest }: { mode: Mode; onSuggest: (q: string) => void }) {
  const suggestionsByMode: Record<Mode, string[]> = {
    text: [
      "Brainstorm 5 content ideas for my brand this week",
      "Write a 280-character tweet announcing a sale",
      "Draft an Instagram caption for my product launch",
      "Outline a 60-second sales pitch for my service",
    ],
    image: [
      "Minimalist product hero on a soft pastel gradient, studio lighting",
      "Cozy autumn flat-lay with coffee, leaves, and a notebook",
      "Bold geometric social post background, brand colors blue and cyan",
      "Photorealistic lifestyle shot of a smiling customer using my product",
    ],
    video: [
      "8-second cinematic shot of a product spinning on a marble surface",
      "Quick montage of a happy team celebrating a launch",
      "Aerial drone clip of a coastal city at golden hour",
      "Macro close-up of fresh coffee being poured into a cup",
    ],
  };
  const headlineByMode: Record<Mode, string> = {
    text: "How can I help?",
    image: "Generate a stunning image",
    video: "Generate a short video clip",
  };
  const subByMode: Record<Mode, string> = {
    text: "Ask FlowAI anything — copy, ideas, strategy, brainstorms.",
    image: "Describe what you want. Pick Standard for speed, Premium for top quality.",
    video: "Describe the scene. Pick Standard for speed, Premium for top quality.",
  };
  const suggestions = suggestionsByMode[mode];
  return (
    <div className="text-center py-12 sm:py-20">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30">
        <Sparkles className="h-7 w-7 text-white" />
      </div>
      <h2 className="text-xl font-semibold mb-2">{headlineByMode[mode]}</h2>
      <p className="text-sm text-muted-foreground mb-6">{subByMode[mode]}</p>
      <div className="grid sm:grid-cols-2 gap-2 max-w-xl mx-auto">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSuggest(s)}
            className="text-left text-sm px-3 py-2 rounded-md border border-border hover:border-blue-500 hover:bg-blue-500/5 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Pending assistant placeholder ────────────────────────────────────────

function PendingAssistant({ mode, tier, status }: { mode: Mode; tier: Tier; status: string | null }) {
  const label =
    mode === "image"
      ? `Generating ${tier === "premium" ? "Premium" : "Standard"} image…`
      : mode === "video"
      ? `Rendering ${tier === "premium" ? "Premium" : "Standard"} video…`
      : "FlowAI is thinking…";

  if (mode === "text") {
    return (
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 text-white flex items-center justify-center flex-shrink-0">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl text-sm bg-muted/60 text-muted-foreground">
          <AISpinner size={14} />
          {label}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 text-white flex items-center justify-center flex-shrink-0">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="inline-block max-w-full">
          <div className="rounded-2xl border border-border bg-white dark:bg-gray-800 p-4">
            <AIGenerationLoader
              compact
              currentStep={label}
              subtitle={status || (mode === "video" ? "Videos can take 30–90 seconds." : "Just a few seconds…")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Message renderer ─────────────────────────────────────────────────────

function MessageView({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-1",
          isUser
            ? "bg-muted text-muted-foreground"
            : "bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-sm shadow-blue-500/20",
        )}
      >
        {isUser ? <span className="text-xs font-semibold">You</span> : <Sparkles className="h-4 w-4" />}
      </div>
      <div className={cn("flex-1 min-w-0", isUser ? "text-right" : "text-left")}>
        {message.content && (
          <div
            className={cn(
              "inline-block px-3.5 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words max-w-full",
              isUser
                ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
                : "bg-white dark:bg-gray-800 border border-border text-foreground",
            )}
          >
            {message.content}
          </div>
        )}
        {message.mediaType === "image" && message.mediaUrl && (
          <MediaCard kind="image" url={message.mediaUrl} alignRight={isUser} />
        )}
        {message.mediaType === "video" && message.mediaUrl && (
          <MediaCard kind="video" url={message.mediaUrl} alignRight={isUser} />
        )}
      </div>
    </div>
  );
}

function MediaCard({
  kind,
  url,
  alignRight,
}: {
  kind: "image" | "video";
  url: string;
  alignRight: boolean;
}) {
  return (
    <div className={cn("mt-2 inline-block max-w-full", alignRight ? "text-right" : "text-left")}>
      <div className="rounded-xl overflow-hidden border border-border bg-white dark:bg-gray-800 shadow-sm relative inline-block max-w-full">
        {kind === "image" ? (
          <Image
            src={url}
            alt="Generated"
            width={512}
            height={512}
            unoptimized
            className="block max-w-full h-auto max-h-[70vh] w-auto"
          />
        ) : (
          <video
            src={url}
            controls
            className="block max-w-full max-h-[70vh] w-auto bg-black"
          />
        )}
      </div>
      <div className={cn("mt-1.5 flex gap-2", alignRight ? "justify-end" : "justify-start")}>
        <a
          href={url}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <Download className="h-3 w-3" />
          Download
        </a>
      </div>
    </div>
  );
}
