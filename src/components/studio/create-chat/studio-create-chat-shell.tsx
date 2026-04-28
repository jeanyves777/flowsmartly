"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Send, Paperclip, X, Plus, MessageSquare, ChevronLeft, Loader2, Image as ImageIcon, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/hooks/use-toast";
import { ChatCard } from "./chat-card";
import type { CardSpec } from "@/lib/ai/studio-chat-agent";

/**
 * StudioCreateChatShell — full-page overlay chat for the studio create flow.
 *
 * Layout: optional left chat-history rail + main chat thread + bottom
 * input. Brand-neutral ("FlowAI"); never references the underlying model.
 *
 * State machine:
 *   - on mount: fetch chat history from /api/studio/chat/[chatId]
 *   - on send: POST /api/studio/chat/[chatId]/turn → append turns → render
 *   - dispatch envelopes returned by the agent kick off generation calls
 *     in parallel (Phase 1: stub responses; the actual /ai/visual /
 *     /ai/video-studio wiring lands as separate dispatch handlers).
 */

interface ChatTurnView {
  id: string;
  role: "user" | "agent" | "system";
  content: string;
  cards?: CardSpec[];
  attachments?: Array<{ kind: "upload" | "library"; url: string; mime?: string; templateId?: string }>;
  branchId?: string | null;
  createdAt: string;
  pending?: boolean;
}

interface ChatListItem {
  id: string;
  title: string;
  updatedAt: string;
  designCount: number;
  turnCount: number;
}

export function StudioCreateChatShell({
  chatId,
  initialTitle,
}: {
  chatId: string;
  initialTitle: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [turns, setTurns] = useState<ChatTurnView[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState(initialTitle);
  const [chatList, setChatList] = useState<ChatListItem[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [creatingNew, setCreatingNew] = useState(false);
  // Reference images the user has staged for the next turn (paperclip
  // upload OR library browse pick). Sent on the next send() call as
  // attachments and persisted on the user turn server-side.
  const [pendingAttachments, setPendingAttachments] = useState<
    Array<{ kind: "upload" | "library"; url: string; mime?: string; templateId?: string; uploading?: boolean }>
  >([]);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load chat history + sidebar list on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [historyRes, listRes] = await Promise.all([
          fetch(`/api/studio/chat/${chatId}`),
          fetch(`/api/studio/chat?limit=30`),
        ]);
        const historyData = await historyRes.json();
        const listData = await listRes.json();
        if (cancelled) return;
        if (historyData.success) {
          setTurns(historyData.turns || []);
          setTitle(historyData.chat?.title || initialTitle);
        }
        if (listData.success) {
          setChatList(listData.chats || []);
        }
      } catch (err) {
        console.error("Failed to load chat:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [chatId, initialTitle]);

  // Auto-scroll to the bottom on new turns.
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [turns]);

  // Upload a single file → /api/upload, then push the resulting URL
  // into pendingAttachments so the user sees a thumbnail above the
  // input and the URL ships with the next turn.
  const uploadFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast({ title: "Only image files for now", variant: "destructive" });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "File too large (5MB max)", variant: "destructive" });
        return;
      }
      // Optimistic: show a placeholder while uploading.
      const tmpId = `tmp-${Date.now()}`;
      setPendingAttachments((prev) => [
        ...prev,
        { kind: "upload", url: tmpId, mime: file.type, uploading: true },
      ]);
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("type", "general");
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data?.error?.message || "Upload failed");
        const finalUrl: string = data.data.url;
        setPendingAttachments((prev) =>
          prev.map((a) => (a.url === tmpId ? { kind: "upload", url: finalUrl, mime: file.type } : a)),
        );
      } catch (err) {
        setPendingAttachments((prev) => prev.filter((a) => a.url !== tmpId));
        toast({
          title: "Couldn't upload that image",
          description: err instanceof Error ? err.message : undefined,
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  const removeAttachment = useCallback((url: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.url !== url));
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      // Allow attachment-only sends (user dropped an image without typing).
      if (!trimmed && pendingAttachments.length === 0) return;
      if (sending) return;
      // Block if any attachment is still uploading.
      if (pendingAttachments.some((a) => a.uploading)) {
        toast({ title: "Wait for uploads to finish", variant: "destructive" });
        return;
      }
      setInput("");
      const attachmentsToSend = pendingAttachments.map(({ kind, url, mime, templateId }) => ({
        kind,
        url,
        mime,
        templateId,
      }));
      setPendingAttachments([]);
      setSending(true);

      // Optimistic user turn for snappy UI.
      const optimisticUser: ChatTurnView = {
        id: `tmp-${Date.now()}`,
        role: "user",
        content: trimmed,
        attachments: attachmentsToSend.length ? attachmentsToSend : undefined,
        createdAt: new Date().toISOString(),
      };
      const optimisticAgent: ChatTurnView = {
        id: `tmp-agent-${Date.now()}`,
        role: "agent",
        content: "",
        createdAt: new Date().toISOString(),
        pending: true,
      };
      setTurns((prev) => [...prev, optimisticUser, optimisticAgent]);

      try {
        const res = await fetch(`/api/studio/chat/${chatId}/turn`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: trimmed,
            attachments: attachmentsToSend.length ? attachmentsToSend : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data?.error?.message || "Turn failed");
        }
        // Replace optimistic placeholders with real turns.
        setTurns((prev) => {
          const withoutOptimistic = prev.filter((t) => t.id !== optimisticUser.id && t.id !== optimisticAgent.id);
          return [
            ...withoutOptimistic,
            { ...data.userTurn, role: "user" } as ChatTurnView,
            { ...data.agentTurn, role: "agent" } as ChatTurnView,
          ];
        });
        if (typeof data?.agentTurn?.content === "string" && title === "New chat") {
          setTitle(trimmed.slice(0, 80));
        }
      } catch (err) {
        // Roll back optimistic agent placeholder, mark error.
        setTurns((prev) => prev.filter((t) => t.id !== optimisticAgent.id));
        toast({
          title: "Couldn't get a response",
          description: err instanceof Error ? err.message : "Try again",
          variant: "destructive",
        });
      } finally {
        setSending(false);
      }
    },
    [chatId, sending, toast, title, pendingAttachments],
  );

  const handleNewChat = useCallback(async () => {
    if (creatingNew) return;
    setCreatingNew(true);
    try {
      const res = await fetch("/api/studio/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.error?.message || "Failed to create chat");
      router.push(`/studio/create/${data.chat.id}`);
    } catch (err) {
      toast({ title: "Couldn't start a new chat", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
    } finally {
      setCreatingNew(false);
    }
  }, [creatingNew, router, toast]);

  const handleClose = useCallback(() => {
    router.push("/studio");
  }, [router]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900"
    >
      {/* Left rail — chat history */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ x: -260 }}
            animate={{ x: 0 }}
            exit={{ x: -260 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="w-64 flex-shrink-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur border-r border-border flex flex-col"
          >
            <div className="p-3 border-b border-border flex items-center gap-2">
              <button
                type="button"
                onClick={handleNewChat}
                disabled={creatingNew}
                className="flex-1 flex items-center justify-center gap-2 h-9 rounded-md bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {creatingNew ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                New chat
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
              {chatList.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3">No chats yet</p>
              ) : (
                chatList.map((c) => (
                  <div
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(`/studio/create/${c.id}`)}
                    onKeyDown={(e) => { if (e.key === "Enter") router.push(`/studio/create/${c.id}`); }}
                    className={cn(
                      "group w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2 cursor-pointer",
                      c.id === chatId
                        ? "bg-brand-500/10 text-brand-700 dark:text-brand-300"
                        : "hover:bg-muted text-foreground",
                    )}
                  >
                    <MessageSquare className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
                    <span className="truncate flex-1">{c.title}</span>
                    {c.designCount > 0 && (
                      <span className="text-[10px] opacity-60">{c.designCount}</span>
                    )}
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm(`Delete chat "${c.title}"?`)) return;
                        try {
                          await fetch(`/api/studio/chat/${c.id}`, { method: "DELETE" });
                          setChatList((prev) => prev.filter((x) => x.id !== c.id));
                          if (c.id === chatId) {
                            // Just deleted the active chat — start a fresh one.
                            void handleNewChat();
                          }
                        } catch {
                          toast({ title: "Couldn't delete", variant: "destructive" });
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex-shrink-0"
                      aria-label={`Delete ${c.title}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center justify-between gap-3 px-4 h-12 border-b border-border bg-white/60 dark:bg-gray-900/60 backdrop-blur">
          <div className="flex items-center gap-2 min-w-0">
            {!sidebarOpen && (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="h-8 w-8 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center flex-shrink-0"
                aria-label="Show sidebar"
              >
                <MessageSquare className="h-4 w-4" />
              </button>
            )}
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold truncate">{title}</h1>
              <p className="text-[10px] text-muted-foreground">FlowAI design assistant</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="h-8 w-8 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
            aria-label="Close chat"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Thread */}
        <div ref={threadRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
          <div className="max-w-3xl mx-auto space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading…
              </div>
            ) : turns.length === 0 ? (
              <EmptyState onSuggest={(q) => send(q)} />
            ) : (
              turns.map((turn) => (
                <TurnView key={turn.id} turn={turn} onCardAction={(text) => send(text)} />
              ))
            )}
          </div>
        </div>

        {/* Input bar */}
        <div className="border-t border-border bg-white/60 dark:bg-gray-900/60 backdrop-blur px-4 sm:px-6 py-3">
          <div className="max-w-3xl mx-auto">
            {/* Pending attachments — thumbnails above the input */}
            {pendingAttachments.length > 0 && (
              <div className="flex gap-2 mb-2 flex-wrap">
                {pendingAttachments.map((att) => (
                  <div key={att.url} className="relative w-16 h-16 rounded-md overflow-hidden border border-border bg-muted">
                    {att.uploading ? (
                      <div className="w-full h-full flex items-center justify-center">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={att.url} alt="reference" className="w-full h-full object-cover" />
                    )}
                    <button
                      type="button"
                      onClick={() => removeAttachment(att.url)}
                      className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/70 hover:bg-black/90 text-white"
                      aria-label="Remove attachment"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = e.target.files;
                if (!files) return;
                Array.from(files).forEach((f) => void uploadFile(f));
                e.target.value = "";
              }}
            />
            <ChatInput
              value={input}
              onChange={setInput}
              onSend={() => send(input)}
              onAttach={() => fileInputRef.current?.click()}
              disabled={sending}
            />
            <p className="text-[10px] text-muted-foreground/70 mt-1.5 text-center">
              FlowAI may take a moment for complex designs · Click 📎 to drop a reference image
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function EmptyState({ onSuggest }: { onSuggest: (q: string) => void }) {
  const suggestions = [
    "Birthday flyer for a 50th party",
    "Instagram post for a coffee shop sale",
    "30-second TikTok ad for a sneaker drop",
    "Wedding save-the-date postcard",
  ];
  return (
    <div className="text-center py-12 sm:py-20">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center mb-4 shadow-lg shadow-brand-500/30">
        <Sparkles className="h-7 w-7 text-white" />
      </div>
      <h2 className="text-xl font-semibold mb-2">What are we creating today?</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Describe your design — image, flyer, ad, or short video — and FlowAI will take it from there.
      </p>
      <div className="grid sm:grid-cols-2 gap-2 max-w-xl mx-auto">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSuggest(s)}
            className="text-left text-sm px-3 py-2 rounded-md border border-border hover:border-brand-500 hover:bg-brand-500/5 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function TurnView({ turn, onCardAction }: { turn: ChatTurnView; onCardAction?: (text: string) => void }) {
  const isUser = turn.role === "user";
  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-1",
          isUser ? "bg-muted text-muted-foreground" : "bg-gradient-to-br from-brand-500 to-purple-500 text-white",
        )}
      >
        {isUser ? <span className="text-xs font-semibold">You</span> : <Sparkles className="h-4 w-4" />}
      </div>
      <div className={cn("flex-1 min-w-0 space-y-2", isUser ? "items-end text-right" : "items-start")}>
        {/* Attachments preview */}
        {turn.attachments?.length ? (
          <div className="flex gap-2 flex-wrap">
            {turn.attachments.map((att, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={att.url}
                alt="attachment"
                className="w-16 h-16 rounded-md object-cover border border-border"
              />
            ))}
          </div>
        ) : null}
        {/* Text bubble */}
        {turn.pending ? (
          <div
            className={cn(
              "inline-flex items-center gap-2 px-3 py-2 rounded-2xl text-sm",
              "bg-muted/60 text-muted-foreground",
            )}
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            FlowAI is thinking…
          </div>
        ) : turn.content ? (
          <div
            className={cn(
              "inline-block px-3.5 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words max-w-full",
              isUser
                ? "bg-brand-500 text-white"
                : "bg-white dark:bg-gray-800 border border-border text-foreground",
            )}
          >
            {turn.content}
          </div>
        ) : null}
        {/* Cards */}
        {turn.cards?.length ? (
          <div className="space-y-2 mt-1 max-w-full">
            {turn.cards.map((card, i) => (
              <ChatCard key={i} card={card} onAction={onCardAction} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ChatInput({
  value,
  onChange,
  onSend,
  onAttach,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onAttach?: () => void;
  disabled?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-grow textarea up to 6 lines.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [value]);

  return (
    <div className="flex items-end gap-2 rounded-2xl border border-border bg-white dark:bg-gray-900 shadow-sm focus-within:border-brand-500 focus-within:shadow-md transition-all px-2 py-1.5">
      <button
        type="button"
        onClick={onAttach}
        className="h-9 w-9 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center flex-shrink-0 disabled:opacity-40"
        aria-label="Attach reference image"
        title="Attach reference image"
        disabled={disabled || !onAttach}
      >
        <Paperclip className="h-4 w-4" />
      </button>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
        rows={1}
        placeholder="Describe what you want to create…"
        className="flex-1 bg-transparent border-0 outline-none focus:ring-0 resize-none py-2 px-1 text-sm leading-relaxed max-h-40"
        disabled={disabled}
      />
      <button
        type="button"
        onClick={onSend}
        disabled={disabled || !value.trim()}
        className="h-9 w-9 rounded-md bg-brand-500 hover:bg-brand-600 text-white transition-colors flex items-center justify-center flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label="Send"
      >
        {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </button>
    </div>
  );
}

// Used by ChatCard for image/result placeholders.
export const PlaceholderImage = ImageIcon;
