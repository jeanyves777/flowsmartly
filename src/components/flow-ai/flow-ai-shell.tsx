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
  FolderOpen,
  Mic,
  AudioLines,
  Upload,
} from "lucide-react";
import { MediaLibraryPicker } from "@/components/shared/media-library-picker";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/hooks/use-toast";
import { confirmDialog } from "@/components/shared/confirm-dialog";
import { AISpinner, AIGenerationLoader } from "@/components/shared/ai-generation-loader";
import {
  ToolCallChip,
  PlanProposalCard,
  TaskCard,
  CopyTextButton,
  SpeakButton,
  mediaDownloadHref,
  type AgentToolCardData,
  type PlanProposalCardData,
  type PlanStepData,
  type AgentTaskCardData,
} from "./agent-cards";
import {
  subscribeToTaskStream,
  consumeAgentStreamWithReplay,
  useAgentSender,
  type TaskStreamEvent,
} from "./use-agent-stream";
import { RichText, TypingDots } from "./rich-text";
import { useSpeechRecognition } from "./use-speech-recognition";
import { useVoiceConversation } from "./use-voice-conversation";
import { VoiceWaveform } from "./voice-waveform";
import { speakAloud } from "./use-tts";

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
  // Agent-mode extras — only populated when the message came from the
  // tool-using agent endpoint (text mode). See feature: Flow-AI Agent SDK.
  toolCalls?: AgentToolCardData[];
  planProposals?: PlanProposalCardData[];
  agentTasks?: AgentTaskCardData[];
}

// Agent card types (AgentTaskCardData, AgentToolCardData, PlanStepData,
// PlanProposalCardData) are imported from `./agent-cards` so the shell
// and the floating widget share one definition.

interface ConversationListItem {
  id: string;
  title: string | null;
  updatedAt: string;
  messageCount?: number;
}

// `subscribeToTaskStream` + `TaskStreamEvent` moved to ./use-agent-stream
// so the widget and the shell share the same SSE plumbing.

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
  // Mode pills removed 2026-05-28 — everything routes through the agent,
  // which picks the right tool (text/image/video/story-ad) from the
  // request. `mode` is pinned to "text" so send() always hits the agent.
  const mode: Mode = "text";
  const tier: Tier = "standard";
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  // Image attachments for the next agent message. `dataUrl` = a device
  // upload (base64); `url` = a pick from the user's own media library.
  const [attachments, setAttachments] = useState<Array<{ dataUrl?: string; url?: string; name: string }>>([]);
  // Attach drop-up menu (Upload a file / Your media library) + library modal.
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const threadRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Resolved plan proposals — keep their status through stream re-renders.
  const resolvedPlansRef = useRef<Map<string, PlanProposalCardData["status"]>>(new Map());

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

  // Image upload → base64 data URL → attachment chip. The agent receives
  // these as vision input on the next send (it decides what to do with
  // them — analyze, base a design on them, etc.). 5 MB / 4-image cap.
  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const slots = Math.max(0, 4 - attachments.length);
      const picked = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, slots);
      picked.forEach((file) => {
        if (file.size > 5 * 1024 * 1024) {
          toast({ variant: "destructive", title: "File too large", description: "Max 5 MB per image." });
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          setAttachments((prev) => (prev.length >= 4 ? prev : [...prev, { dataUrl, name: file.name }]));
        };
        reader.readAsDataURL(file);
      });
    },
    [attachments.length, toast],
  );

  // Add an image the user picked from their OWN media library (already
  // hosted — keep the URL; the server fetches it for vision on send).
  const handleLibraryPick = useCallback((url: string) => {
    setAttachments((prev) =>
      prev.length >= 4 || prev.some((a) => a.url === url)
        ? prev
        : [...prev, { url, name: url.split("/").pop() || "library image" }],
    );
    setLibraryOpen(false);
    setAttachMenuOpen(false);
  }, []);

  // ─── Agent-mode (text) ────────────────────────────────────────────
  // Text-mode chat goes through the new tool-using agent endpoint via
  // the shared resumable consumer — same parser + auto-replay-on-drop
  // as the floating FlowAIWidget. Image/video modes stay on the legacy
  // generate route for now (Phase 8 will migrate those to tools).
  const sendAgent = useAgentSender();
  const sendToAgent = useCallback(
    async (
      trimmed: string,
      _userMsg: Message,
      pendingMsg: Message,
      atts?: Array<{ dataUrl?: string; url?: string; name: string }>,
      viaVoice = false,
      onReplyComplete?: (replyText: string) => void,
    ) => {
      const res = await sendAgent({
        message: trimmed,
        conversationId,
        attachments: atts?.map((a) => ({ dataUrl: a.dataUrl, url: a.url, name: a.name })),
      });
      if (!res.ok || !res.body) {
        let errMsg = "Agent failed to start";
        try {
          const data = await res.json();
          errMsg = data?.error || errMsg;
        } catch {
          /* not json */
        }
        throw new Error(errMsg);
      }

      let assistantText = "";
      let newConvId: string | null = null;
      const toolCallsById = new Map<string, AgentToolCardData>();
      const proposalsById = new Map<string, PlanProposalCardData>();
      const tasksById = new Map<string, AgentTaskCardData>();

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

      await consumeAgentStreamWithReplay(res.body, conversationId ?? "", {
        onStart: (convId) => {
          newConvId = convId;
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
        },
        onTaskFailed: (taskId, error) => {
          const existing = tasksById.get(taskId);
          if (existing) {
            tasksById.set(taskId, { ...existing, status: "failed", error: error ?? null });
            flushMessage();
          }
        },
        onError: (message) => {
          assistantText = assistantText
            ? `${assistantText}\n\n_⚠️ ${message}_`
            : `⚠️ ${message}`;
          flushMessage();
        },
        onDone: () => {
          flushMessage();
          // Conversation mode drives speaking itself (so it can resume
          // listening after); one-shot voice mode just auto-plays.
          if (onReplyComplete) onReplyComplete(assistantText);
          else if (viaVoice && assistantText.trim()) void speakAloud(assistantText);
        },
      });

      return newConvId;
    },
    [conversationId, sendAgent],
  );

  const send = useCallback(
    async (text: string, viaVoice = false, onReplyComplete?: (replyText: string) => void) => {
      const trimmed = text.trim();
      const pendingAttachments = attachments;
      if ((!trimmed && pendingAttachments.length === 0) || sending) return;
      setInput("");
      setAttachments([]);
      setSending(true);
      setStatusMessage(null);

      const userMsg: Message = {
        id: `tmp-u-${Date.now()}`,
        role: "user",
        content:
          trimmed ||
          `[${pendingAttachments.length} image${pendingAttachments.length > 1 ? "s" : ""} attached]`,
        mediaType: pendingAttachments.length > 0 ? "image" : undefined,
        mediaUrl: pendingAttachments[0]?.dataUrl ?? pendingAttachments[0]?.url ?? undefined,
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
        // Everything routes through the tool-using agent now (no modes).
        {
          const newConvId = await sendToAgent(trimmed, userMsg, pendingMsg, pendingAttachments, viaVoice, onReplyComplete);
          // Adopt the server's conversation id whenever it differs — covers
          // both first-message (was null) and stale-id reassignment (the
          // server started fresh instead of 404'ing).
          if (newConvId && newConvId !== conversationId) {
            setConversationId(newConvId);
            const url = new URL(window.location.href);
            url.searchParams.set("conversationId", newConvId);
            window.history.replaceState({}, "", url.toString());
          }
          refreshConversations(newConvId || conversationId).catch(() => {});
        }
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
    [conversationId, sending, attachments, refreshConversations, toast, sendToAgent],
  );

  // Voice mode — browser speech-to-text; final transcript sends as a voice
  // turn so the reply is read back aloud via the self-hosted TTS.
  const voice = useSpeechRecognition({
    onFinal: (transcript) => {
      void send(transcript, true);
    },
  });

  // Hands-free conversation mode — continuous listen → send → speak → listen.
  const conversation = useVoiceConversation({
    onUtterance: (text, onReply) => {
      void send(text, false, onReply);
    },
  });

  // Confirm or reject a plan proposal — POSTs to /confirm, then optimistically
  // flips the local card's status. The agent loop, paused on awaitConfirmation,
  // wakes up server-side; its next text_delta arrives on the same SSE stream
  // if the stream is still open, otherwise the user will see results when they
  // come back via the persisted tool-call audit + AgentTask rehydration.
  const respondToPlan = useCallback(
    async (planId: string, confirmed: boolean) => {
      if (!conversationId) return;
      // Remember the resolution so the live stream's flushMessage keeps it.
      resolvedPlansRef.current.set(planId, confirmed ? "confirmed" : "rejected");
      // Optimistic local update.
      setMessages((prev) =>
        prev.map((m) => {
          if (!m.planProposals) return m;
          const updated = m.planProposals.map((p) =>
            p.id === planId
              ? { ...p, status: (confirmed ? "confirmed" : "rejected") as PlanProposalCardData["status"] }
              : p,
          );
          return { ...m, planProposals: updated };
        }),
      );
      try {
        const res = await fetch("/api/flow-ai/agent/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId, planId, confirmed }),
        });
        const json = await res.json();
        // If the server says the proposal was already resolved (e.g. via
        // another device or it expired), reconcile to that state.
        if (json?.status && json.status !== (confirmed ? "confirmed" : "rejected")) {
          setMessages((prev) =>
            prev.map((m) => {
              if (!m.planProposals) return m;
              const updated = m.planProposals.map((p) =>
                p.id === planId ? { ...p, status: json.status as PlanProposalCardData["status"] } : p,
              );
              return { ...m, planProposals: updated };
            }),
          );
        }
      } catch (err) {
        console.error("[FlowAI] confirm failed:", err);
        toast({
          title: "Couldn't send your response",
          description: "Check your connection — try again.",
          variant: "destructive",
        });
      }
    },
    [conversationId, toast],
  );

  // Rehydrate plan proposals + task state whenever we land on a saved
  // conversation. Phone-came-back-from-sleep flow: any plan that the
  // server already marked confirmed/rejected/expired shows in its real
  // state instead of a zombie "pending" card.
  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;
    (async () => {
      try {
        const [propRes, taskRes] = await Promise.all([
          fetch(`/api/flow-ai/agent/proposals?conversationId=${conversationId}`),
          fetch(`/api/flow-ai/tasks?conversationId=${conversationId}`),
        ]);
        const propJson = await propRes.json().catch(() => null);
        const taskJson = await taskRes.json().catch(() => null);
        if (cancelled) return;
        const proposals: PlanProposalCardData[] = Array.isArray(propJson?.proposals)
          ? propJson.proposals.map((p: { id: string; messageId: string; summary: string; steps: PlanStepData[]; totalCreditCost: number; status: PlanProposalCardData["status"] }) => ({
              id: p.id,
              summary: p.summary,
              steps: p.steps ?? [],
              totalCreditCost: p.totalCreditCost ?? 0,
              status: p.status,
            }))
          : [];
        const tasksByMsg = new Map<string, AgentTaskCardData[]>();
        const liveTaskIds: string[] = [];
        if (Array.isArray(taskJson?.tasks)) {
          for (const t of taskJson.tasks as Array<{
            id: string;
            messageId: string | null;
            kind: string;
            status: AgentTaskCardData["status"];
            output: { url?: string; tier?: string } | null;
            error: string | null;
            resultRefType: string | null;
            resultRefId: string | null;
          }>) {
            if (!t.messageId) continue;
            const card: AgentTaskCardData = {
              id: t.id,
              kind: t.kind,
              status: t.status,
              output: t.output,
              error: t.error,
              resultRefType: t.resultRefType,
              resultRefId: t.resultRefId,
            };
            const list = tasksByMsg.get(t.messageId) ?? [];
            list.push(card);
            tasksByMsg.set(t.messageId, list);
            if (t.status === "pending" || t.status === "running") {
              liveTaskIds.push(t.id);
            }
          }
        }
        if (proposals.length === 0 && tasksByMsg.size === 0) return;
        const proposalsByMsg = new Map<string, PlanProposalCardData[]>();
        if (Array.isArray(propJson?.proposals)) {
          for (const p of propJson.proposals as Array<{ id: string; messageId: string }>) {
            const list = proposalsByMsg.get(p.messageId) ?? [];
            const card = proposals.find((x) => x.id === p.id);
            if (card) list.push(card);
            proposalsByMsg.set(p.messageId, list);
          }
        }
        setMessages((prev) =>
          prev.map((m) => {
            const planCards = proposalsByMsg.get(m.id);
            const taskList = tasksByMsg.get(m.id);
            if (!planCards && !taskList) return m;
            return {
              ...m,
              planProposals: planCards ?? m.planProposals,
              agentTasks: taskList ?? m.agentTasks,
            };
          }),
        );

        // For any task that's still running, open the per-task SSE so the
        // card updates live (phone-back-from-sleep + multi-device flow).
        for (const taskId of liveTaskIds) {
          if (cancelled) break;
          subscribeToTaskStream(taskId, (event) => {
            setMessages((prev) =>
              prev.map((m) => {
                if (!m.agentTasks) return m;
                const idx = m.agentTasks.findIndex((t) => t.id === taskId);
                if (idx === -1) return m;
                const current = m.agentTasks[idx];
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
                } else if (event.type === "failed") {
                  next = { ...current, status: "failed", error: event.error ?? current.error };
                } else {
                  return m;
                }
                const updated = [...m.agentTasks];
                updated[idx] = next;
                return { ...m, agentTasks: updated };
              }),
            );
          });
        }
      } catch (err) {
        console.error("[FlowAI] rehydrate failed:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

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
  // Drives the state-based trailing control: something to send → Send;
  // otherwise → mic + voice (mobile/ChatGPT pattern, saves composer space).
  const canSend = input.trim().length > 0 || attachments.length > 0;

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
            <div className="w-8 h-8 rounded-xl bg-white dark:bg-gray-900 ring-1 ring-border flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden">
              <Image src="/icon.png" alt="Flow-AI" width={24} height={24} unoptimized className="h-6 w-6 object-contain" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold truncate">{conversationTitle}</h1>
              <p className="text-[10px] text-muted-foreground">Flow-AI · text · image · video</p>
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
              messages.map((m) => (
                <MessageView key={m.id} message={m} onPlanResponse={respondToPlan} />
              ))
            )}
            {sending && messages.length > 0 && messages[messages.length - 1]?.role === "user" && (
              <PendingAssistant mode={mode} tier={tier} status={statusMessage} />
            )}
          </div>
        </div>

        <div className="border-t border-border bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl px-4 sm:px-6 py-3">
          <div className="max-w-3xl mx-auto">
            {/* Mode pills removed 2026-05-28 — the agent picks the right
                tool (text / image / video / story-ad) from the request.
                Upload stays. */}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                handleFiles(e.target.files);
                if (e.target) e.target.value = "";
              }}
            />

            {/* Attachment preview chips */}
            {attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {attachments.map((a, i) => (
                  <div key={i} className="relative h-14 w-14 rounded-lg overflow-hidden border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.dataUrl || a.url} alt={a.name} className="h-full w-full object-cover" />
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
              <div className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-blue-500/40 bg-blue-50/60 dark:bg-blue-950/30 px-3 py-2">
                <div className="flex items-center gap-2.5 min-w-0">
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
                    className={conversation.state === "listening" ? "text-emerald-500" : "text-blue-500"}
                  />
                  <span className="text-xs font-medium text-foreground truncate">
                    {conversation.state === "listening"
                      ? conversation.interim || "Listening…"
                      : conversation.state === "thinking"
                        ? "Thinking…"
                        : conversation.state === "speaking"
                          ? "Speaking…"
                          : ""}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={conversation.stop}
                  className="text-xs font-medium px-3 h-7 rounded-full bg-foreground text-background hover:opacity-90 flex items-center gap-1.5 flex-shrink-0"
                >
                  <X className="h-3 w-3" /> End
                </button>
              </div>
            )}

            <div className="flex items-end gap-2 rounded-2xl border border-border bg-white dark:bg-gray-900 shadow-sm focus-within:border-blue-500 focus-within:shadow-md transition-all px-2 py-1.5">
              {/* Attach: one + that opens a drop-up (Upload / Your library) so
                  both device files AND the user's own media library are
                  reachable without cluttering the composer. */}
              <div className="relative flex-shrink-0">
                {attachMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setAttachMenuOpen(false)} />
                    <div className="absolute bottom-11 left-0 z-20 w-48 rounded-xl border border-border bg-white dark:bg-gray-900 shadow-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => { setAttachMenuOpen(false); fileInputRef.current?.click(); }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                      >
                        <Upload className="h-4 w-4 text-muted-foreground" /> Upload a file
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAttachMenuOpen(false); setLibraryOpen(true); }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors border-t border-border"
                      >
                        <FolderOpen className="h-4 w-4 text-muted-foreground" /> Your media library
                      </button>
                    </div>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setAttachMenuOpen((o) => !o)}
                  disabled={sending || attachments.length >= 4}
                  className={cn(
                    "h-9 w-9 rounded-md text-muted-foreground hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed",
                    attachMenuOpen && "text-blue-600 bg-blue-50 dark:bg-blue-950/30",
                  )}
                  aria-label="Attach a file or media"
                  title="Attach a file or media"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
              </div>
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
                placeholder={voice.listening ? voice.interim || "Listening…" : "Ask Flow-AI to write, design, schedule, generate — anything…"}
                className="flex-1 bg-transparent border-0 outline-none focus:ring-0 resize-none py-2 px-2 text-sm leading-relaxed max-h-40"
                disabled={sending}
              />
              {/* State-driven trailing control (mobile/ChatGPT pattern):
                  nothing to send → mic + voice-orb; text or an attachment →
                  a single Send. Never all three — saves space. */}
              {canSend ? (
                <button
                  type="button"
                  onClick={() => send(input)}
                  disabled={sending}
                  className="h-9 w-9 rounded-md bg-gradient-to-br from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white transition-colors flex items-center justify-center flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-blue-500/20"
                  aria-label="Send"
                >
                  {sending ? <AISpinner size={16} /> : <Send className="h-4 w-4" />}
                </button>
              ) : (
                <>
                  {voice.supported && (
                    <button
                      type="button"
                      onClick={voice.toggle}
                      disabled={sending}
                      className={cn(
                        "h-9 w-9 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                        voice.listening
                          ? "border-red-500 bg-red-500 text-white animate-pulse"
                          : "border-border bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground",
                      )}
                      aria-label={voice.listening ? "Stop listening" : "Talk to Flow-AI"}
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
                        "h-9 w-9 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                        conversation.active
                          ? "border-blue-500 bg-blue-500 text-white"
                          : "border-border bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground",
                      )}
                      aria-label={conversation.active ? "End voice conversation" : "Start voice conversation"}
                      title={conversation.active ? "End voice conversation" : "Voice conversation (hands-free)"}
                    >
                      <AudioLines className="h-4 w-4" />
                    </button>
                  )}
                  {/* No mic/voice support → keep a Send so the user can still
                      submit (e.g. after attaching from the library). */}
                  {!voice.supported && !conversation.supported && (
                    <button
                      type="button"
                      onClick={() => send(input)}
                      disabled={sending}
                      className="h-9 w-9 rounded-md bg-gradient-to-br from-blue-500 to-cyan-500 text-white flex items-center justify-center flex-shrink-0 disabled:opacity-40 shadow-sm shadow-blue-500/20"
                      aria-label="Send"
                    >
                      {sending ? <AISpinner size={16} /> : <Send className="h-4 w-4" />}
                    </button>
                  )}
                </>
              )}
            </div>

            <p className="text-[10px] text-muted-foreground/80 mt-1.5 text-center">
              Flow-AI can act on your account · charges credits when you confirm · Shift+Enter for newline
            </p>
          </div>
        </div>
      </div>

      {/* The user's own media library — picking an image attaches its URL. */}
      <MediaLibraryPicker
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onSelect={(url) => handleLibraryPick(url)}
        filterTypes={["image"]}
        title="Attach from your library"
      />
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
      <div className="w-14 h-14 mx-auto rounded-2xl bg-white dark:bg-gray-900 ring-1 ring-border flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20 overflow-hidden">
        <Image src="/icon.png" alt="Flow-AI" width={40} height={40} unoptimized className="h-10 w-10 object-contain" />
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
        <div className="w-8 h-8 rounded-lg bg-white dark:bg-gray-800 ring-1 ring-border flex items-center justify-center flex-shrink-0 overflow-hidden">
          <Image src="/icon.png" alt="Flow-AI" width={22} height={22} unoptimized className="h-[22px] w-[22px] object-contain" />
        </div>
        <div className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-white dark:bg-gray-800 border border-border">
          <TypingDots />
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-lg bg-white dark:bg-gray-800 ring-1 ring-border flex items-center justify-center flex-shrink-0 overflow-hidden">
        <Image src="/icon.png" alt="Flow-AI" width={22} height={22} unoptimized className="h-[22px] w-[22px] object-contain" />
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

function MessageView({
  message,
  onPlanResponse,
}: {
  message: Message;
  onPlanResponse?: (planId: string, confirmed: boolean) => void;
}) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-1 overflow-hidden",
          isUser
            ? "bg-muted text-muted-foreground"
            : "bg-white dark:bg-gray-800 ring-1 ring-border",
        )}
      >
        {isUser ? (
          <span className="text-xs font-semibold">You</span>
        ) : (
          <Image src="/icon.png" alt="Flow-AI" width={22} height={22} unoptimized className="h-[22px] w-[22px] object-contain" />
        )}
      </div>
      <div className={cn("flex-1 min-w-0", isUser ? "text-right" : "text-left")}>
        {message.content && (
          <div
            className={cn(
              "inline-block px-3.5 py-2 rounded-2xl text-sm leading-relaxed break-words max-w-full text-left",
              isUser
                ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white whitespace-pre-wrap"
                : "bg-white dark:bg-gray-800 border border-border text-foreground",
            )}
          >
            {isUser ? message.content : <RichText text={message.content} />}
          </div>
        )}
        {!isUser && message.content && (
          <div className="mt-1 pl-1 flex items-center gap-3">
            <CopyTextButton text={message.content} />
            <SpeakButton text={message.content} />
          </div>
        )}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className={cn("mt-2 flex flex-wrap gap-1.5", isUser ? "justify-end" : "justify-start")}>
            {message.toolCalls.map((tc) => (
              <ToolCallChip key={tc.id} call={tc} />
            ))}
          </div>
        )}
        {message.planProposals && message.planProposals.length > 0 && (
          <div className={cn("mt-2 flex flex-col gap-2", isUser ? "items-end" : "items-start")}>
            {message.planProposals.map((p) => (
              <PlanProposalCard
                key={p.id}
                proposal={p}
                onResponse={onPlanResponse}
              />
            ))}
          </div>
        )}
        {message.agentTasks && message.agentTasks.length > 0 && (
          <div className={cn("mt-2 flex flex-col gap-2", isUser ? "items-end" : "items-start")}>
            {message.agentTasks.map((t) => (
              <TaskCard key={t.id} task={t} />
            ))}
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

// ToolCallChip, PlanProposalCard, TaskCard moved to ./agent-cards
// (shared with the floating FlowAIWidget). Local helpers retained below.

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
          href={mediaDownloadHref(url)}
          download
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <Download className="h-3 w-3" />
          Download
        </a>
      </div>
    </div>
  );
}
