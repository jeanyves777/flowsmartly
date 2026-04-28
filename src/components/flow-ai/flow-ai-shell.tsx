"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Send, X, Plus, MessageSquare, ChevronLeft, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/hooks/use-toast";

/**
 * FlowAI Shell — text-only conversational assistant, fullscreen overlay.
 *
 * Mirrors the Studio Create Chat shell pattern: collapsible chat-history
 * sidebar + main thread + bottom input. Image / video are intentionally
 * absent — those flows live in the Studio Create Chat now (/studio/create).
 * FlowAI is the writing/thinking partner, Studio AI is the visual maker.
 *
 * Backed by /api/ai/assistant/generate with the legacy text-only path.
 */

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
}

interface ConversationListItem {
  id: string;
  title: string | null;
  updatedAt: string;
  messageCount?: number;
}

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

  const threadRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Load conversations + (if any) the active conversation history.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const listRes = await fetch("/api/ai/assistant/conversations");
        const listData = await listRes.json();
        if (!cancelled && listData.success) {
          const items: ConversationListItem[] = (listData.conversations || []).map((c: { id: string; title: string | null; updatedAt: string; messageCount?: number; _count?: { messages?: number } }) => ({
            id: c.id,
            title: c.title,
            updatedAt: c.updatedAt,
            messageCount: c.messageCount ?? c._count?.messages ?? 0,
          }));
          setConversations(items);
        }
        if (initialConversationId) {
          const histRes = await fetch(`/api/ai/assistant/conversations/${initialConversationId}`);
          const histData = await histRes.json();
          if (!cancelled && histData.success) {
            setMessages(
              (histData.messages || []).map((m: { id: string; role: "user" | "assistant"; content: string; createdAt?: string }) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                createdAt: m.createdAt,
              })),
            );
            setConversationTitle(histData.conversation?.title || "Conversation");
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

  // Auto-scroll on new messages.
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, sending]);

  // Auto-grow input.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [input]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;
      setInput("");
      setSending(true);

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
          body: JSON.stringify({
            message: trimmed,
            conversationId,
            mode: "text", // FlowAI is text-only — image/video moved to Studio AI
          }),
        });

        if (!res.ok || !res.body) {
          let errMsg = "Generation failed";
          try {
            const data = await res.json();
            errMsg = data?.error || data?.message || errMsg;
          } catch { /* not json */ }
          throw new Error(errMsg);
        }

        // Stream SSE deltas — append to the pending assistant message
        // as they arrive so text appears token-by-token. Perceived
        // latency drops to "first byte" rather than "full response".
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let assistantContent = "";
        let newConvId: string | null = null;

        // Replace the optimistic empty placeholder with a streaming one.
        // This element is keyed by the pendingMsg.id so we keep updating it
        // as deltas arrive.
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          // SSE events are separated by blank lines.
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";
          for (const evt of events) {
            const line = evt.split("\n").find((l) => l.startsWith("data: "));
            if (!line) continue;
            const payload = line.slice(6);
            try {
              const data = JSON.parse(payload);
              if (data.type === "start" && data.conversationId) {
                newConvId = data.conversationId;
              } else if (data.type === "delta" && typeof data.text === "string") {
                assistantContent += data.text;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === pendingMsg.id ? { ...m, content: assistantContent } : m,
                  ),
                );
              } else if (data.type === "done") {
                // Final stream event — nothing more to do until cleanup.
              } else if (data.type === "error") {
                throw new Error(data.message || "Stream error");
              }
            } catch (parseErr) {
              if (parseErr instanceof Error && parseErr.message !== "Stream error") {
                console.warn("[FlowAI] failed to parse SSE event:", parseErr);
              } else {
                throw parseErr;
              }
            }
          }
        }

        // First-message → conv id was minted server-side, capture it.
        if (newConvId && !conversationId) {
          setConversationId(newConvId);
          const url = new URL(window.location.href);
          url.searchParams.set("conversationId", newConvId);
          window.history.replaceState({}, "", url.toString());
        }
        // Refresh the sidebar so the new conversation shows up + title gets updated.
        fetch("/api/ai/assistant/conversations")
          .then((r) => r.json())
          .then((d) => {
            if (d.success) {
              setConversations(
                (d.conversations || []).map((c: { id: string; title: string | null; updatedAt: string; messageCount?: number; _count?: { messages?: number } }) => ({
                  id: c.id,
                  title: c.title,
                  updatedAt: c.updatedAt,
                  messageCount: c.messageCount ?? c._count?.messages ?? 0,
                })),
              );
              const updated = (d.conversations || []).find((c: { id: string; title: string | null }) => c.id === (newConvId || conversationId));
              if (updated?.title) setConversationTitle(updated.title);
            }
          })
          .catch(() => {});
      } catch (err) {
        // Roll back optimistic placeholder.
        setMessages((prev) => prev.filter((m) => m.id !== pendingMsg.id));
        toast({
          title: "Couldn't get a response",
          description: err instanceof Error ? err.message : "Try again",
          variant: "destructive",
        });
      } finally {
        setSending(false);
      }
    },
    [conversationId, sending, toast],
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
        const data = await res.json();
        if (data.success) {
          setMessages(
            (data.messages || []).map((m: { id: string; role: "user" | "assistant"; content: string; createdAt?: string }) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              createdAt: m.createdAt,
            })),
          );
          setConversationTitle(data.conversation?.title || "Conversation");
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
      if (!confirm("Delete this conversation?")) return;
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900"
    >
      {/* Left rail */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="w-72 flex-shrink-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur border-r border-border flex flex-col"
          >
            <div className="p-3 border-b border-border flex items-center gap-2">
              <button
                type="button"
                onClick={handleNewConversation}
                className="flex-1 flex items-center justify-center gap-2 h-9 rounded-md bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors"
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
                        ? "bg-brand-500/10 text-brand-700 dark:text-brand-300"
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
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
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
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold truncate">{conversationTitle}</h1>
              <p className="text-[10px] text-muted-foreground">FlowAI · text assistant</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="h-8 w-8 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div ref={threadRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
          <div className="max-w-3xl mx-auto space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading…
              </div>
            ) : messages.length === 0 ? (
              <FlowAIEmptyState onSuggest={(q) => send(q)} />
            ) : (
              messages.map((m) => <MessageView key={m.id} message={m} />)
            )}
            {sending && messages.length > 0 && messages[messages.length - 1]?.role === "user" && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 text-white flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl text-sm bg-muted/60 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  FlowAI is thinking…
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border bg-white/60 dark:bg-gray-900/60 backdrop-blur px-4 sm:px-6 py-3">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-2 rounded-2xl border border-border bg-white dark:bg-gray-900 shadow-sm focus-within:border-brand-500 focus-within:shadow-md transition-all px-2 py-1.5">
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
                placeholder="Message FlowAI…"
                className="flex-1 bg-transparent border-0 outline-none focus:ring-0 resize-none py-2 px-2 text-sm leading-relaxed max-h-40"
                disabled={sending}
              />
              <button
                type="button"
                onClick={() => send(input)}
                disabled={sending || !input.trim()}
                className="h-9 w-9 rounded-md bg-brand-500 hover:bg-brand-600 text-white transition-colors flex items-center justify-center flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Send"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground/70 mt-1.5 text-center">
              FlowAI is your text assistant · For images and videos, use Studio AI
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function FlowAIEmptyState({ onSuggest }: { onSuggest: (q: string) => void }) {
  const suggestions = [
    "Help me brainstorm content ideas for my brand this week",
    "Write a 280-character tweet announcing a sale",
    "Draft an Instagram caption for my product launch",
    "Outline a 60-second sales pitch for my service",
  ];
  return (
    <div className="text-center py-12 sm:py-20">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30">
        <Sparkles className="h-7 w-7 text-white" />
      </div>
      <h2 className="text-xl font-semibold mb-2">How can I help?</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Ask FlowAI anything — content ideas, copy drafts, strategy, brainstorms.
        For visual designs, head to Studio AI.
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

function MessageView({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-1",
          isUser
            ? "bg-muted text-muted-foreground"
            : "bg-gradient-to-br from-blue-500 to-cyan-500 text-white",
        )}
      >
        {isUser ? <span className="text-xs font-semibold">You</span> : <Sparkles className="h-4 w-4" />}
      </div>
      <div className={cn("flex-1 min-w-0", isUser ? "text-right" : "text-left")}>
        <div
          className={cn(
            "inline-block px-3.5 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words max-w-full",
            isUser
              ? "bg-brand-500 text-white"
              : "bg-white dark:bg-gray-800 border border-border text-foreground",
          )}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
}
