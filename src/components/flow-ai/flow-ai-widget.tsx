"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, Send, X, Maximize2, Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { AISpinner } from "@/components/shared/ai-generation-loader";
import {
  ToolCallChip,
  PlanProposalCard,
  TaskCard,
  type AgentToolCardData,
  type AgentTaskCardData,
  type PlanProposalCardData,
} from "./agent-cards";
import {
  consumeAgentStreamWithReplay,
  useAgentSender,
  respondToPlanProposal,
  subscribeToTaskStream,
} from "./use-agent-stream";
import { useWebPushAutoSubscribe, requestPushPermission } from "./use-web-push";

/**
 * Floating Flow-AI widget — compact agent chat that lives in the
 * bottom-right corner of every dashboard page. Reuses the same SSE
 * agent endpoint as the full-screen `/flow-ai` page; conversations are
 * shared (the user can open one in the widget, then expand to full
 * screen via the "Open in full" button without losing context).
 *
 * Hides on the full-screen `/flow-ai` route to avoid double-mounting
 * the same surface. Persists conversationId to sessionStorage so
 * route changes don't reset the thread.
 *
 * Renders the same `ToolCallChip` / `PlanProposalCard` / `TaskCard`
 * components as the full-screen shell — visual + behavioral parity.
 */

interface WidgetMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: AgentToolCardData[];
  planProposals?: PlanProposalCardData[];
  agentTasks?: AgentTaskCardData[];
}

const STORAGE_KEY = "flow-ai-widget-conversation";

const HIDE_ON_PATH_PREFIXES = [
  "/flow-ai", // full-screen shell already covers this
  "/login",
  "/register",
  "/onboarding",
];

export function FlowAIWidget() {
  const router = useRouter();
  const pathname = usePathname();
  const send = useAgentSender();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<WidgetMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>("default");

  const threadRef = useRef<HTMLDivElement | null>(null);
  const taskStreamsRef = useRef<Map<string, AbortController>>(new Map());

  // Silently re-register an existing push subscription on every mount
  // so a fresh session keeps the device on file. No prompt — that's
  // gated behind the user's explicit click below.
  useWebPushAutoSubscribe(true);

  // Track current Notification.permission so the CTA can disappear once
  // the user opts in (or hide entirely if they've blocked it).
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setPushPermission(Notification.permission);
  }, []);

  // Restore conversation from session storage on mount.
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) setConversationId(stored);
    } catch {
      /* sessionStorage unavailable */
    }
    return () => {
      // Abort any in-flight task streams on unmount.
      taskStreamsRef.current.forEach((c) => c.abort());
      taskStreamsRef.current.clear();
    };
  }, []);

  // Persist conversation id so route changes don't lose the thread.
  useEffect(() => {
    try {
      if (conversationId) sessionStorage.setItem(STORAGE_KEY, conversationId);
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, [conversationId]);

  // Auto-scroll on new content.
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, sending]);

  // Hide widget on the routes where it doesn't make sense.
  if (pathname && HIDE_ON_PATH_PREFIXES.some((p) => pathname.startsWith(p))) {
    return null;
  }

  const handleSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;
      setInput("");
      setSending(true);

      const userMsg: WidgetMessage = {
        id: `tmp-u-${Date.now()}`,
        role: "user",
        content: trimmed,
      };
      const pendingMsg: WidgetMessage = {
        id: `tmp-a-${Date.now()}`,
        role: "assistant",
        content: "",
      };
      setMessages((prev) => [...prev, userMsg, pendingMsg]);

      const toolCallsById = new Map<string, AgentToolCardData>();
      const proposalsById = new Map<string, PlanProposalCardData>();
      const tasksById = new Map<string, AgentTaskCardData>();
      let assistantText = "";
      let resolvedConversationId: string | null = conversationId;

      const flushMessage = () => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingMsg.id
              ? {
                  ...m,
                  content: assistantText,
                  toolCalls: Array.from(toolCallsById.values()),
                  planProposals: Array.from(proposalsById.values()),
                  agentTasks: Array.from(tasksById.values()),
                }
              : m,
          ),
        );
      };

      try {
        const res = await send({ message: trimmed, conversationId });
        if (!res.ok || !res.body) {
          let errMsg = "Agent failed to start";
          try {
            const data = await res.json();
            errMsg = data?.error || errMsg;
          } catch {
            /* ignore */
          }
          throw new Error(errMsg);
        }

        await consumeAgentStreamWithReplay(res.body, conversationId ?? "", {
          onStart: (convId) => {
            resolvedConversationId = convId;
            if (!conversationId) setConversationId(convId);
          },
          onText: (delta) => {
            assistantText += delta;
            setMessages((prev) =>
              prev.map((m) => (m.id === pendingMsg.id ? { ...m, content: assistantText } : m)),
            );
          },
          onToolCallStart: (call) => {
            toolCallsById.set(call.id, call);
            flushMessage();
          },
          onToolCallResult: (call) => {
            toolCallsById.set(call.id, call);
            flushMessage();
          },
          onPlanProposal: (proposal) => {
            proposalsById.set(proposal.id, proposal);
            flushMessage();
          },
          onTaskStarted: (task) => {
            tasksById.set(task.id, task);
            flushMessage();
            // Subscribe to live progress in case the agent turn ends
            // before the task does (likely — that's the whole point of
            // background tasks).
            startTaskSubscription(task.id, tasksById, flushMessage, taskStreamsRef.current);
          },
          onTaskProgress: (taskId, progress, message) => {
            const existing = tasksById.get(taskId);
            if (existing) {
              tasksById.set(taskId, {
                ...existing,
                progress: progress ?? existing.progress,
                progressMessage: message ?? existing.progressMessage,
              });
              flushMessage();
            }
          },
          onTaskCompleted: (task) => {
            const existing = tasksById.get(task.id);
            tasksById.set(task.id, { ...(existing ?? task), ...task });
            flushMessage();
            taskStreamsRef.current.get(task.id)?.abort();
            taskStreamsRef.current.delete(task.id);
          },
          onTaskFailed: (taskId, error) => {
            const existing = tasksById.get(taskId);
            if (existing) {
              tasksById.set(taskId, { ...existing, status: "failed", error: error ?? null });
              flushMessage();
            }
            taskStreamsRef.current.get(taskId)?.abort();
            taskStreamsRef.current.delete(taskId);
          },
          onError: (message) => {
            assistantText = assistantText
              ? `${assistantText}\n\n⚠️ ${message}`
              : `⚠️ ${message}`;
            flushMessage();
          },
          onDone: () => {
            flushMessage();
          },
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Something went wrong";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingMsg.id ? { ...m, content: `⚠️ ${errMsg}` } : m,
          ),
        );
      } finally {
        setSending(false);
      }
      void resolvedConversationId; // referenced for clarity, used via setConversationId
    },
    [conversationId, send, sending],
  );

  const handlePlanResponse = useCallback(
    async (planId: string, confirmed: boolean) => {
      if (!conversationId) return;
      // Optimistic local flip.
      setMessages((prev) =>
        prev.map((m) => {
          if (!m.planProposals) return m;
          return {
            ...m,
            planProposals: m.planProposals.map((p) =>
              p.id === planId
                ? { ...p, status: (confirmed ? "confirmed" : "rejected") as PlanProposalCardData["status"] }
                : p,
            ),
          };
        }),
      );
      const result = await respondToPlanProposal(conversationId, planId, confirmed);
      // Reconcile if server said the proposal was already in a different state.
      if (result.status && result.status !== (confirmed ? "confirmed" : "rejected")) {
        setMessages((prev) =>
          prev.map((m) => {
            if (!m.planProposals) return m;
            return {
              ...m,
              planProposals: m.planProposals.map((p) =>
                p.id === planId ? { ...p, status: result.status! } : p,
              ),
            };
          }),
        );
      }
    },
    [conversationId],
  );

  const handleNewConversation = () => {
    // Abort all live task subscriptions for the current conversation.
    taskStreamsRef.current.forEach((c) => c.abort());
    taskStreamsRef.current.clear();
    setMessages([]);
    setConversationId(null);
  };

  const handleExpand = () => {
    setOpen(false);
    const url = conversationId
      ? `/flow-ai?conversationId=${encodeURIComponent(conversationId)}`
      : "/flow-ai";
    router.push(url);
  };

  return (
    <>
      {/* Bubble */}
      <AnimatePresence>
        {!open && (
          <motion.button
            type="button"
            key="bubble"
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 20 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={() => setOpen(true)}
            aria-label="Open Flow-AI"
            className="fixed bottom-5 right-5 z-40 h-14 w-14 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/30 flex items-center justify-center hover:scale-105 transition-transform"
          >
            <Sparkles className="h-6 w-6" />
            {messages.length > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-rose-500 text-[10px] font-bold flex items-center justify-center border-2 border-white">
                {Math.min(9, messages.filter((m) => m.role === "assistant").length)}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-5 right-5 z-40 w-[min(420px,calc(100vw-2rem))] h-[min(620px,calc(100vh-3rem))] rounded-3xl bg-white dark:bg-gray-950 border border-border shadow-2xl shadow-blue-500/10 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center gap-2 px-3.5 py-3 border-b border-border bg-gradient-to-r from-blue-500/10 to-cyan-500/10">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 text-white flex items-center justify-center shadow-sm shadow-blue-500/30">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground leading-tight">Flow-AI</p>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  {sending ? "Working…" : "Ask anything — I can act on your account"}
                </p>
              </div>
              <button
                type="button"
                onClick={handleNewConversation}
                className="h-8 w-8 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
                aria-label="New conversation"
                title="New conversation"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleExpand}
                className="h-8 w-8 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
                aria-label="Open full screen"
                title="Open full screen"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-8 w-8 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
                aria-label="Minimize"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Thread */}
            <div
              ref={threadRef}
              className="flex-1 overflow-y-auto px-3.5 py-4 space-y-3 bg-gradient-to-b from-transparent to-muted/20"
            >
              {messages.length === 0 ? (
                <EmptyState
                  onSuggest={handleSend}
                  pushPermission={pushPermission}
                  onEnablePush={async () => {
                    const next = await requestPushPermission();
                    setPushPermission(next);
                  }}
                />
              ) : (
                messages.map((m) => (
                  <WidgetMessageView
                    key={m.id}
                    message={m}
                    onPlanResponse={handlePlanResponse}
                  />
                ))
              )}
              {sending && messages.length > 0 && messages[messages.length - 1]?.role === "user" && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground pl-10">
                  <AISpinner size={12} />
                  Thinking…
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-border bg-white dark:bg-gray-950 p-2.5">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend(input);
                }}
                className="flex items-end gap-2"
              >
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(input);
                    }
                  }}
                  placeholder="Ask Flow-AI…"
                  rows={1}
                  disabled={sending}
                  className="flex-1 resize-none rounded-xl border border-border bg-white dark:bg-gray-900 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40 max-h-24 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || sending}
                  className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white flex items-center justify-center shadow-sm shadow-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Send"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
              <p className="mt-1.5 text-[10px] text-muted-foreground/70 text-center">
                Powered by Flow-AI · Charges credits when you confirm actions
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────

function startTaskSubscription(
  taskId: string,
  tasksById: Map<string, AgentTaskCardData>,
  flush: () => void,
  registry: Map<string, AbortController>,
) {
  // Don't double-subscribe.
  if (registry.has(taskId)) return;
  const controller = subscribeToTaskStream(taskId, (event) => {
    const current = tasksById.get(taskId);
    if (!current) return;
    let next: AgentTaskCardData = current;
    if (event.type === "snapshot") {
      next = {
        ...current,
        status: event.status,
        output: event.output ?? current.output,
        error: event.error ?? current.error,
        resultRefType: event.resultRefType ?? current.resultRefType,
        resultRefId: event.resultRefId ?? current.resultRefId,
      };
    } else if (event.type === "progress") {
      next = {
        ...current,
        progress: event.progress ?? current.progress,
        progressMessage: event.message ?? current.progressMessage,
      };
    } else if (event.type === "completed") {
      next = {
        ...current,
        status: "completed",
        output: event.output ?? current.output,
        resultRefType: event.resultRefType ?? current.resultRefType,
        resultRefId: event.resultRefId ?? current.resultRefId,
      };
      registry.get(taskId)?.abort();
      registry.delete(taskId);
    } else if (event.type === "failed") {
      next = { ...current, status: "failed", error: event.error ?? current.error };
      registry.get(taskId)?.abort();
      registry.delete(taskId);
    } else {
      return;
    }
    tasksById.set(taskId, next);
    flush();
  });
  registry.set(taskId, controller);
}

function WidgetMessageView({
  message,
  onPlanResponse,
}: {
  message: WidgetMessage;
  onPlanResponse: (planId: string, confirmed: boolean) => void;
}) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-2.5", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5",
          isUser
            ? "bg-muted text-muted-foreground"
            : "bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-sm shadow-blue-500/20",
        )}
      >
        {isUser ? <span className="text-[10px] font-semibold">You</span> : <Sparkles className="h-3.5 w-3.5" />}
      </div>
      <div className={cn("flex-1 min-w-0 space-y-2", isUser ? "text-right" : "text-left")}>
        {message.content && (
          <div
            className={cn(
              "inline-block px-3 py-1.5 rounded-2xl text-sm leading-snug whitespace-pre-wrap break-words max-w-full",
              isUser
                ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
                : "bg-white dark:bg-gray-900 border border-border text-foreground",
            )}
          >
            {message.content}
          </div>
        )}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className={cn("flex flex-wrap gap-1.5", isUser ? "justify-end" : "justify-start")}>
            {message.toolCalls.map((tc) => (
              <ToolCallChip key={tc.id} call={tc} />
            ))}
          </div>
        )}
        {message.planProposals && message.planProposals.length > 0 && (
          <div className={cn("flex flex-col gap-2", isUser ? "items-end" : "items-start")}>
            {message.planProposals.map((p) => (
              <PlanProposalCard key={p.id} proposal={p} onResponse={onPlanResponse} />
            ))}
          </div>
        )}
        {message.agentTasks && message.agentTasks.length > 0 && (
          <div className={cn("flex flex-col gap-2", isUser ? "items-end" : "items-start")}>
            {message.agentTasks.map((t) => (
              <TaskCard key={t.id} task={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  onSuggest,
  pushPermission,
  onEnablePush,
}: {
  onSuggest: (text: string) => void;
  pushPermission: NotificationPermission;
  onEnablePush: () => void;
}) {
  const suggestions = [
    "Schedule a post for Monday at 4 PM about Father's Day",
    "What can you do for me?",
    "Generate a quick image for my next post",
    "Show me my scheduled posts",
  ];
  return (
    <div className="flex flex-col items-center justify-center text-center px-4 py-6 space-y-4">
      <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white flex items-center justify-center shadow-md shadow-blue-500/30">
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">Hey, I&apos;m Flow-AI</p>
        <p className="text-xs text-muted-foreground max-w-xs">
          I can schedule posts, generate images and videos, build automations, manage contacts, and more — all from this chat.
        </p>
      </div>
      <div className="w-full max-w-xs space-y-1.5">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSuggest(s)}
            className="w-full text-left text-xs px-3 py-2 rounded-lg border border-border hover:border-blue-500/40 hover:bg-blue-500/5 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
      {pushPermission === "default" && (
        <button
          type="button"
          onClick={onEnablePush}
          className="w-full max-w-xs text-[11px] px-3 py-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/15 text-blue-700 dark:text-blue-300 transition-colors"
        >
          🔔 Turn on notifications so I can ping you when long tasks finish
        </button>
      )}
    </div>
  );
}
