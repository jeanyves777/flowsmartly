"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Send, X, Maximize2, Plus, Paperclip, MessageSquare, ChevronLeft, Mic, AudioLines } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  ToolCallChip,
  PlanProposalCard,
  TaskCard,
  CopyTextButton,
  SpeakButton,
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
import { RichText, TypingDots } from "./rich-text";
import { useSpeechRecognition } from "./use-speech-recognition";
import { useVoiceConversation } from "./use-voice-conversation";
import { VoiceWaveform } from "./voice-waveform";
import { useVoiceLang } from "./voice-lang";
import { VoiceLangPicker } from "./voice-lang-picker";
import { speakAloud } from "./use-tts";

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
  images?: string[]; // attachment previews (data URLs) on user messages
  toolCalls?: AgentToolCardData[];
  planProposals?: PlanProposalCardData[];
  agentTasks?: AgentTaskCardData[];
}

const STORAGE_KEY = "flow-ai-widget-conversation";
const SIZE_KEY = "flow-ai-widget-size";
const MIN_W = 340;
const MIN_H = 420;

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
  // Pending image attachments (base64 data URLs) shown as chips above the
  // composer until the next send. Restored from the old widget's upload.
  const [attachments, setAttachments] = useState<Array<{ dataUrl: string; name: string }>>([]);
  // Conversation history panel (toggle back to a previous conversation).
  const [historyOpen, setHistoryOpen] = useState(false);
  const [conversations, setConversations] = useState<Array<{ id: string; title: string | null; updatedAt: string; messageCount: number }>>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  // User-resizable panel size (drag the top-left grip). Persisted so it
  // sticks across opens. Clamped to the viewport on apply.
  const [panelSize, setPanelSize] = useState<{ width: number; height: number }>({ width: 420, height: 620 });

  const threadRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const taskStreamsRef = useRef<Map<string, AbortController>>(new Map());
  // Tracks plan proposals the user has resolved so the live stream's
  // flushMessage doesn't reset their status back to "pending".
  const resolvedPlansRef = useRef<Map<string, PlanProposalCardData["status"]>>(new Map());

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

  // Auto-grow the composer as the user types — just enough to read, capped
  // at ~4 lines (max-h-28 = 112px); beyond that it scrolls internally.
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
  }, [input]);

  // Restore conversation + saved panel size from session storage on mount.
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) setConversationId(stored);
      const savedSize = sessionStorage.getItem(SIZE_KEY);
      if (savedSize) {
        const parsed = JSON.parse(savedSize) as { width?: number; height?: number };
        if (typeof parsed.width === "number" && typeof parsed.height === "number") {
          setPanelSize({ width: parsed.width, height: parsed.height });
        }
      }
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
    async (text: string, viaVoice = false, onReplyComplete?: (replyText: string) => void) => {
      const trimmed = text.trim();
      const pendingAttachments = attachments;
      // Allow sending with only an image (no text).
      if ((!trimmed && pendingAttachments.length === 0) || sending) return;
      setInput("");
      setAttachments([]);
      setSending(true);

      const userMsg: WidgetMessage = {
        id: `tmp-u-${Date.now()}`,
        role: "user",
        content: trimmed,
        images: pendingAttachments.map((a) => a.dataUrl),
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
                  planProposals: Array.from(proposalsById.values()).map((p) =>
                    resolvedPlansRef.current.has(p.id)
                      ? { ...p, status: resolvedPlansRef.current.get(p.id)! }
                      : p,
                  ),
                  agentTasks: Array.from(tasksById.values()),
                }
              : m,
          ),
        );
      };

      try {
        const res = await send({
          message: trimmed,
          conversationId,
          attachments: pendingAttachments.map((a) => ({ dataUrl: a.dataUrl, name: a.name })),
        });
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
            // Always adopt the server's conversation id — it may differ
            // from ours if our cached id was stale (the server started a
            // fresh conversation instead of 404'ing).
            if (convId !== conversationId) setConversationId(convId);
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
            // Conversation mode drives speaking itself (to resume listening
            // after); one-shot voice mode just auto-plays the reply.
            if (onReplyComplete) onReplyComplete(assistantText);
            else if (viaVoice && assistantText.trim()) void speakAloud(assistantText);
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
    [conversationId, send, sending, attachments],
  );

  // Voice mode — browser speech-to-text. On a final transcript, send it as a
  // voice turn so the reply is read back automatically.
  const [voiceLang, setVoiceLang] = useVoiceLang();

  const voice = useSpeechRecognition({
    lang: voiceLang,
    onFinal: (transcript) => {
      void handleSend(transcript, true);
    },
  });

  // Hands-free conversation mode — continuous listen → send → speak → listen.
  const conversation = useVoiceConversation({
    lang: voiceLang,
    onUtterance: (text, onReply) => {
      void handleSend(text, false, onReply);
    },
  });

  // Read picked image files → base64 data URLs → attachment chips.
  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const slots = Math.max(0, 4 - attachments.length);
    const picked = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, slots);
    picked.forEach((file) => {
      if (file.size > 5 * 1024 * 1024) return; // 5 MB cap
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setAttachments((prev) =>
          prev.length >= 4 ? prev : [...prev, { dataUrl, name: file.name }],
        );
      };
      reader.readAsDataURL(file);
    });
  }, [attachments.length]);

  const handlePlanResponse = useCallback(
    async (planId: string, confirmed: boolean) => {
      if (!conversationId) return;
      // Remember the resolution so the live stream's flushMessage keeps it.
      resolvedPlansRef.current.set(planId, confirmed ? "confirmed" : "rejected");
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
    setHistoryOpen(false);
  };

  // Fetch the conversation list when the history panel opens.
  const openHistory = useCallback(async () => {
    setHistoryOpen(true);
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/ai/assistant/conversations?limit=30");
      const json = await res.json();
      const raw = json?.data?.conversations ?? json?.conversations ?? [];
      setConversations(
        raw.map((c: { id: string; title: string | null; updatedAt: string; messageCount?: number; _count?: { messages?: number } }) => ({
          id: c.id,
          title: c.title,
          updatedAt: c.updatedAt,
          messageCount: c.messageCount ?? c._count?.messages ?? 0,
        })),
      );
    } catch (err) {
      console.error("[FlowAIWidget] load history failed:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // Load a previous conversation's messages into the widget thread.
  // Parses each assistant message's metadata so tool/plan/task cards
  // (and the rehydration endpoints) reflect prior state.
  const loadConversation = useCallback(
    async (id: string) => {
      taskStreamsRef.current.forEach((c) => c.abort());
      taskStreamsRef.current.clear();
      setHistoryOpen(false);
      setConversationId(id);
      setMessages([]);
      try {
        const res = await fetch(`/api/ai/assistant/conversations/${id}`);
        const json = await res.json();
        const conv = json?.data ?? json;
        const rawMsgs: Array<{ id: string; role: string; content: string }> = conv?.messages ?? [];
        setMessages(
          rawMsgs
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
        );
        // Rehydrate plan proposals + tasks for this conversation so cards
        // render in their persisted state (same endpoints the shell uses).
        rehydrateConversation(id);
      } catch (err) {
        console.error("[FlowAIWidget] load conversation failed:", err);
      }
    },
    [],
  );

  // Pull persisted plan proposals + tasks and attach them to their
  // owning messages (multi-device / reopen parity with the full shell).
  const rehydrateConversation = useCallback(async (id: string) => {
    try {
      const [propRes, taskRes] = await Promise.all([
        fetch(`/api/flow-ai/agent/proposals?conversationId=${id}`),
        fetch(`/api/flow-ai/tasks?conversationId=${id}`),
      ]);
      const propJson = await propRes.json().catch(() => null);
      const taskJson = await taskRes.json().catch(() => null);
      const proposalsByMsg = new Map<string, PlanProposalCardData[]>();
      if (Array.isArray(propJson?.proposals)) {
        for (const p of propJson.proposals as Array<{ id: string; messageId: string; summary: string; steps: PlanProposalCardData["steps"]; totalCreditCost: number; status: PlanProposalCardData["status"] }>) {
          const list = proposalsByMsg.get(p.messageId) ?? [];
          list.push({ id: p.id, summary: p.summary, steps: p.steps ?? [], totalCreditCost: p.totalCreditCost ?? 0, status: p.status });
          proposalsByMsg.set(p.messageId, list);
        }
      }
      const tasksByMsg = new Map<string, AgentTaskCardData[]>();
      if (Array.isArray(taskJson?.tasks)) {
        for (const t of taskJson.tasks as Array<{ id: string; messageId: string | null; kind: string; status: AgentTaskCardData["status"]; output: { url?: string } | null; error: string | null; resultRefType: string | null; resultRefId: string | null }>) {
          if (!t.messageId) continue;
          const list = tasksByMsg.get(t.messageId) ?? [];
          list.push({ id: t.id, kind: t.kind, status: t.status, output: t.output, error: t.error, resultRefType: t.resultRefType, resultRefId: t.resultRefId });
          tasksByMsg.set(t.messageId, list);
        }
      }
      if (proposalsByMsg.size === 0 && tasksByMsg.size === 0) return;
      setMessages((prev) =>
        prev.map((m) => ({
          ...m,
          planProposals: proposalsByMsg.get(m.id) ?? m.planProposals,
          agentTasks: tasksByMsg.get(m.id) ?? m.agentTasks,
        })),
      );
    } catch (err) {
      console.error("[FlowAIWidget] rehydrate failed:", err);
    }
  }, []);

  const handleExpand = () => {
    setOpen(false);
    const url = conversationId
      ? `/flow-ai?conversationId=${encodeURIComponent(conversationId)}`
      : "/flow-ai";
    router.push(url);
  };

  // Drag the top-left grip to resize. Panel is anchored bottom-right, so
  // moving the grip up/left grows the panel. Persists the final size.
  const startResize = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = panelSize.width;
      const startH = panelSize.height;
      const maxW = typeof window !== "undefined" ? window.innerWidth - 24 : 900;
      const maxH = typeof window !== "undefined" ? window.innerHeight - 32 : 900;

      const onMove = (ev: PointerEvent) => {
        const nextW = Math.min(maxW, Math.max(MIN_W, startW + (startX - ev.clientX)));
        const nextH = Math.min(maxH, Math.max(MIN_H, startH + (startY - ev.clientY)));
        setPanelSize({ width: nextW, height: nextH });
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        setPanelSize((s) => {
          try {
            sessionStorage.setItem(SIZE_KEY, JSON.stringify(s));
          } catch {
            /* ignore */
          }
          return s;
        });
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [panelSize.width, panelSize.height],
  );

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
            className="fixed bottom-5 right-5 z-40 h-14 w-14 rounded-full bg-white dark:bg-gray-900 ring-1 ring-border shadow-lg shadow-blue-500/20 flex items-center justify-center hover:scale-105 transition-transform"
          >
            {/* Inner wrapper clips the icon to the circle; the badge lives
                OUTSIDE it so it isn't clipped (the bug: overflow-hidden on
                the button was hiding the badge). */}
            <span className="h-14 w-14 rounded-full overflow-hidden flex items-center justify-center">
              <Image src="/icon.png" alt="Flow-AI" width={36} height={36} className="h-9 w-9 object-contain" priority unoptimized />
            </span>
            {messages.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white dark:border-gray-900 shadow z-10">
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
            style={{
              width: `min(${panelSize.width}px, calc(100vw - 2rem))`,
              height: `min(${panelSize.height}px, calc(100vh - 3rem))`,
            }}
            className="fixed bottom-5 right-5 z-40 rounded-3xl bg-white dark:bg-gray-950 border border-border shadow-2xl shadow-blue-500/10 flex flex-col overflow-hidden"
          >
            {/* Resize grip (top-left) — drag to make the panel bigger/smaller */}
            <div
              onPointerDown={startResize}
              className="absolute top-0 left-0 z-20 h-6 w-6 cursor-nwse-resize group"
              title="Drag to resize"
              aria-label="Resize"
            >
              <span className="absolute top-1.5 left-1.5 h-2.5 w-2.5 border-l-2 border-t-2 border-muted-foreground/40 group-hover:border-blue-500 rounded-tl-sm transition-colors" />
            </div>

            {/* Header */}
            <div className="flex items-center gap-2 px-3.5 py-3 border-b border-border bg-gradient-to-r from-blue-500/10 to-cyan-500/10">
              <div className="h-8 w-8 rounded-lg bg-white dark:bg-gray-900 ring-1 ring-border flex items-center justify-center overflow-hidden">
                <Image src="/icon.png" alt="Flow-AI" width={24} height={24} className="h-6 w-6 object-contain" unoptimized />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground leading-tight">Flow-AI</p>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  {sending ? "Working…" : "Ask anything — I can act on your account"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => (historyOpen ? setHistoryOpen(false) : openHistory())}
                className={cn(
                  "h-8 w-8 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center",
                  historyOpen && "bg-muted text-foreground",
                )}
                aria-label="Conversation history"
                title="Conversation history"
              >
                <MessageSquare className="h-4 w-4" />
              </button>
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

            {/* Conversation history panel */}
            {historyOpen ? (
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => setHistoryOpen(false)}
                    className="h-6 w-6 rounded hover:bg-muted flex items-center justify-center"
                    aria-label="Back"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  Conversations
                </div>
                {loadingHistory ? (
                  <div className="px-3 py-4 text-xs text-muted-foreground">Loading…</div>
                ) : conversations.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-muted-foreground">No conversations yet.</div>
                ) : (
                  conversations.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => loadConversation(c.id)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2",
                        c.id === conversationId
                          ? "bg-blue-500/10 text-blue-700 dark:text-blue-300"
                          : "hover:bg-muted text-foreground",
                      )}
                    >
                      <MessageSquare className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
                      <span className="truncate flex-1">{c.title || "Untitled conversation"}</span>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">
                        {new Date(c.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    </button>
                  ))
                )}
              </div>
            ) : (
            /* Thread */
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
                  <TypingDots />
                </div>
              )}
            </div>
            )}

            {/* Input */}
            <div className="border-t border-border bg-white dark:bg-gray-950 p-2.5">
              {/* Attachment preview chips */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {attachments.map((a, i) => (
                    <div key={i} className="relative h-12 w-12 rounded-lg overflow-hidden border border-border group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.dataUrl} alt={a.name} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute top-0 right-0 h-4 w-4 bg-black/60 text-white flex items-center justify-center rounded-bl"
                        aria-label="Remove attachment"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {conversation.active && (
                <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-blue-500/40 bg-blue-50/60 dark:bg-blue-950/30 px-2.5 py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full flex-shrink-0 animate-pulse",
                        conversation.state === "listening"
                          ? "bg-emerald-500"
                          : conversation.state === "speaking"
                            ? "bg-blue-500"
                            : "bg-amber-500",
                      )}
                    />
                    <VoiceWaveform
                      analyser={conversation.analyser}
                      bars={4}
                      className={conversation.state === "listening" ? "text-emerald-500" : "text-blue-500"}
                    />
                    <span className="text-[11px] font-medium text-foreground truncate">
                      {conversation.state === "listening"
                        ? conversation.interim || "Listening…"
                        : conversation.state === "thinking"
                          ? "Thinking…"
                          : "Speaking…"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={conversation.stop}
                    className="text-[11px] font-medium px-2 h-6 rounded-full bg-foreground text-background hover:opacity-90 flex items-center gap-1 flex-shrink-0"
                  >
                    <X className="h-3 w-3" /> End
                  </button>
                </div>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend(input);
                }}
                className="flex items-end gap-2"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    handleFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending || attachments.length >= 4}
                  className="h-9 w-9 rounded-xl border border-border bg-white dark:bg-gray-900 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                  aria-label="Attach image"
                  title="Attach image"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <textarea
                  ref={composerRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(input);
                    }
                  }}
                  placeholder={voice.listening ? voice.interim || "Listening…" : "Ask Flow-AI…"}
                  rows={1}
                  disabled={sending}
                  className="flex-1 resize-none rounded-xl border border-border bg-white dark:bg-gray-900 px-3 py-2 text-sm leading-snug placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40 max-h-28 overflow-y-auto disabled:opacity-50"
                />
                {(voice.supported || conversation.supported) && (
                  <VoiceLangPicker value={voiceLang} onChange={setVoiceLang} className="max-w-[5rem] flex-shrink-0" />
                )}
                {voice.supported && (
                  <button
                    type="button"
                    onClick={voice.toggle}
                    disabled={sending}
                    className={cn(
                      "h-9 w-9 rounded-xl border flex items-center justify-center transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed",
                      voice.listening
                        ? "border-red-500 bg-red-500 text-white animate-pulse"
                        : "border-border bg-white dark:bg-gray-900 hover:bg-muted text-muted-foreground hover:text-foreground",
                    )}
                    aria-label={voice.listening ? "Stop listening" : "Speak"}
                    title={voice.listening ? "Listening… tap to stop" : "Dictate (push to talk)"}
                  >
                    <Mic className="h-4 w-4" />
                  </button>
                )}
                {conversation.supported && (
                  <button
                    type="button"
                    onClick={conversation.toggle}
                    disabled={sending}
                    className={cn(
                      "h-9 w-9 rounded-xl border flex items-center justify-center transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed",
                      conversation.active
                        ? "border-blue-500 bg-blue-500 text-white"
                        : "border-border bg-white dark:bg-gray-900 hover:bg-muted text-muted-foreground hover:text-foreground",
                    )}
                    aria-label={conversation.active ? "End voice conversation" : "Start voice conversation"}
                    title={conversation.active ? "End voice conversation" : "Voice conversation (hands-free)"}
                  >
                    <AudioLines className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="submit"
                  disabled={(!input.trim() && attachments.length === 0) || sending}
                  className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white flex items-center justify-center shadow-sm shadow-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
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
          "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 overflow-hidden",
          isUser
            ? "bg-muted text-muted-foreground"
            : "bg-white dark:bg-gray-900 ring-1 ring-border",
        )}
      >
        {isUser ? (
          <span className="text-[10px] font-semibold">You</span>
        ) : (
          <Image src="/icon.png" alt="Flow-AI" width={20} height={20} className="h-5 w-5 object-contain" unoptimized />
        )}
      </div>
      <div className={cn("flex-1 min-w-0 space-y-2", isUser ? "text-right" : "text-left")}>
        {message.images && message.images.length > 0 && (
          <div className={cn("flex flex-wrap gap-1.5", isUser ? "justify-end" : "justify-start")}>
            {message.images.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={src}
                alt="Attachment"
                className="h-24 w-24 object-cover rounded-xl border border-border"
              />
            ))}
          </div>
        )}
        {message.content ? (
          <div
            className={cn(
              "inline-block px-3 py-1.5 rounded-2xl text-sm leading-snug break-words max-w-full text-left",
              isUser
                ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white whitespace-pre-wrap"
                : "bg-white dark:bg-gray-900 border border-border text-foreground",
            )}
          >
            {isUser ? message.content : <RichText text={message.content} />}
          </div>
        ) : (
          !isUser &&
          // Assistant bubble still empty → show the typing indicator inside
          // a bubble so it reads as "the AI is composing a reply".
          (!message.toolCalls?.length && !message.planProposals?.length && !message.agentTasks?.length) && (
            <div className="inline-flex items-center px-3 py-2 rounded-2xl bg-white dark:bg-gray-900 border border-border">
              <TypingDots />
            </div>
          )
        )}
        {!isUser && message.content && (
          <div className="pl-1 flex items-center gap-3">
            <CopyTextButton text={message.content} />
            <SpeakButton text={message.content} />
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
      <div className="h-12 w-12 rounded-2xl bg-white dark:bg-gray-900 ring-1 ring-border flex items-center justify-center shadow-md shadow-blue-500/20 overflow-hidden">
        <Image src="/icon.png" alt="Flow-AI" width={32} height={32} className="h-8 w-8 object-contain" unoptimized />
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
