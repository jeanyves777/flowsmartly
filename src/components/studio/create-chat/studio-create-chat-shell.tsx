"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Send, Paperclip, X, Plus, MessageSquare, ChevronLeft, Loader2, Image as ImageIcon } from "lucide-react";
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
  const threadRef = useRef<HTMLDivElement | null>(null);

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

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;
      setInput("");
      setSending(true);

      // Optimistic user turn for snappy UI.
      const optimisticUser: ChatTurnView = {
        id: `tmp-${Date.now()}`,
        role: "user",
        content: trimmed,
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
          body: JSON.stringify({ content: trimmed }),
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
    [chatId, sending, toast, title],
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
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => router.push(`/studio/create/${c.id}`)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2",
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
                  </button>
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
              turns.map((turn) => <TurnView key={turn.id} turn={turn} />)
            )}
          </div>
        </div>

        {/* Input bar */}
        <div className="border-t border-border bg-white/60 dark:bg-gray-900/60 backdrop-blur px-4 sm:px-6 py-3">
          <div className="max-w-3xl mx-auto">
            <ChatInput
              value={input}
              onChange={setInput}
              onSend={() => send(input)}
              disabled={sending}
            />
            <p className="text-[10px] text-muted-foreground/70 mt-1.5 text-center">
              FlowAI may take a moment for complex designs · Drop an image to use as reference
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

function TurnView({ turn }: { turn: ChatTurnView }) {
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
              <ChatCard key={i} card={card} />
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
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
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
        className="h-9 w-9 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center flex-shrink-0"
        aria-label="Attach image"
        title="Attach reference image (coming soon)"
        disabled
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
