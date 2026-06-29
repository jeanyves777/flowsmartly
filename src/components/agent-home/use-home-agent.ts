"use client";

import { useCallback, useRef, useState } from "react";
import type {
  AgentToolCardData,
  AgentTaskCardData,
  PlanProposalCardData,
  MessageBlock,
} from "@/components/flow-ai/agent-cards";
import {
  consumeAgentStreamWithReplay,
  useAgentSender,
  respondToPlanProposal,
  subscribeToTaskStream,
  blockAppendText,
  blockPushCard,
  fetchConversationCards,
  parseMessageBlocks,
} from "@/components/flow-ai/use-agent-stream";

/**
 * Real Flow-AI conversation for the agent home. A third consumer of the
 * shared `/api/flow-ai/agent` SSE pipeline (alongside FlowAIShell and
 * FlowAIWidget) — same streaming, tool chips, plan cards, and background-task
 * cards. Trimmed to the core loop (send → stream → render); voice / attachments
 * / history live in the global widget and can be layered on later.
 */

// Invisible marker (U+2063, a format char that survives .trim()) prepended to
// button-driven internal instructions so the transcript loader can drop them —
// they're sent to the agent but must never surface as a user bubble.
const HIDDEN_PREFIX = "⁣";

export interface HomeMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  blocks?: MessageBlock[];
  toolCalls?: AgentToolCardData[];
  planProposals?: PlanProposalCardData[];
  agentTasks?: AgentTaskCardData[];
}

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

export function useHomeAgent() {
  const send = useAgentSender();
  const [messages, setMessages] = useState<HomeMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loadingConversation, setLoadingConversation] = useState(false);
  // Bumps after any agent turn that ran a tool — focused surfaces refetch on it.
  const [actionCount, setActionCount] = useState(0);
  // The focused view assigns this — applied when the agent emits a canvas_update.
  const canvasUpdateRef = useRef<((patch: Record<string, unknown>) => void) | null>(null);

  const taskStreamsRef = useRef<Map<string, AbortController>>(new Map());
  const resolvedPlansRef = useRef<Map<string, PlanProposalCardData["status"]>>(new Map());

  const appendCompletionMessage = useCallback((msg: { id: string; content: string }) => {
    setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, { id: msg.id, role: "assistant", content: msg.content }]));
  }, []);

  const handleSend = useCallback(
    async (text: string, superMode = false, canvasContext?: string, surfaceContext?: string, opts?: { hidden?: boolean }) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;
      setSending(true);

      // `hidden` = a button-driven internal instruction to the agent (not something
      // the user typed). We send it to the agent but DON'T render it as a user
      // bubble — the user just sees the agent start working (the thinking
      // animation on the pending assistant turn), then its response.
      const userMsg: HomeMessage = { id: `tmp-u-${Date.now()}`, role: "user", content: trimmed };
      const pendingMsg: HomeMessage = { id: `tmp-a-${Date.now()}`, role: "assistant", content: "" };
      setMessages((prev) => (opts?.hidden ? [...prev, pendingMsg] : [...prev, userMsg, pendingMsg]));
      // Hidden instructions are persisted server-side; tag them so a later reload
      // drops them instead of re-rendering the raw internal prompt as a user bubble.
      const wire = opts?.hidden ? HIDDEN_PREFIX + trimmed : trimmed;

      const toolCallsById = new Map<string, AgentToolCardData>();
      const proposalsById = new Map<string, PlanProposalCardData>();
      const tasksById = new Map<string, AgentTaskCardData>();
      const blocks: MessageBlock[] = [];
      let assistantText = "";
      let turnHadTool = false;

      const flushMessage = () => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingMsg.id
              ? {
                  ...m,
                  content: assistantText,
                  blocks: [...blocks],
                  toolCalls: Array.from(toolCallsById.values()),
                  planProposals: Array.from(proposalsById.values()).map((p) =>
                    resolvedPlansRef.current.has(p.id) ? { ...p, status: resolvedPlansRef.current.get(p.id)! } : p,
                  ),
                  agentTasks: Array.from(tasksById.values()),
                }
              : m,
          ),
        );
      };

      try {
        const res = await send({ message: wire, conversationId, superMode, canvasContext, surfaceContext });
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
            if (convId !== conversationId) setConversationId(convId);
          },
          onCanvasUpdate: (patch) => canvasUpdateRef.current?.(patch),
          onText: (delta) => {
            assistantText += delta;
            blockAppendText(blocks, delta);
            flushMessage();
          },
          onToolCallStart: (call) => {
            turnHadTool = true;
            blockPushCard(blocks, "tool", call.id);
            toolCallsById.set(call.id, call);
            flushMessage();
          },
          onToolCallResult: (call) => {
            toolCallsById.set(call.id, call);
            flushMessage();
          },
          onPlanProposal: (proposal) => {
            blockPushCard(blocks, "proposal", proposal.id);
            proposalsById.set(proposal.id, proposal);
            flushMessage();
          },
          onTaskStarted: (task) => {
            blockPushCard(blocks, "task", task.id);
            tasksById.set(task.id, task);
            flushMessage();
            // A branded-design task → the open design canvas shows a live rendering state.
            if (task.kind === "create_branded_design") canvasUpdateRef.current?.({ generating: true });
            startTaskSubscription(task.id, tasksById, flushMessage, taskStreamsRef.current, appendCompletionMessage, (patch) => canvasUpdateRef.current?.(patch));
          },
          onTaskProgress: (taskId, progress, message) => {
            const existing = tasksById.get(taskId);
            if (existing) {
              tasksById.set(taskId, { ...existing, progress: progress ?? existing.progress, progressMessage: message ?? existing.progressMessage });
              flushMessage();
            }
          },
          onTaskCompleted: (task) => {
            const existing = tasksById.get(task.id);
            const merged = { ...(existing ?? task), ...task };
            tasksById.set(task.id, merged);
            flushMessage();
            // Apply the result to the open canvas here too — the live stream may
            // deliver completion before/instead of the per-task subscription
            // (and aborting the subscription below would otherwise drop it).
            // addImageLayer is de-duped by url so this can't double-insert.
            if (merged.kind === "create_branded_design") {
              const url = (merged.output as { url?: string } | null | undefined)?.url;
              canvasUpdateRef.current?.(url ? { generating: false, imageUrl: url } : { generating: false });
            } else if (merged.kind === "canvas_object") {
              const out = merged.output as { url?: string; objectType?: string } | null | undefined;
              if (out?.url) canvasUpdateRef.current?.(out.objectType === "background" ? { bgImageUrl: out.url } : { addImageLayer: { url: out.url } });
            }
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
          onTemplateOptions: (requestId, templates) => {
            if (!blocks.some((b) => b.type === "templates" && b.requestId === requestId)) blocks.push({ type: "templates", requestId, templates });
            flushMessage();
          },
          onQuestionOptions: (requestId, question, options, allowOther) => {
            if (!blocks.some((b) => b.type === "question" && b.requestId === requestId)) blocks.push({ type: "question", requestId, question, options, allowOther });
            flushMessage();
          },
          onError: (message) => {
            assistantText = assistantText ? `${assistantText}\n\n⚠️ ${message}` : `⚠️ ${message}`;
            flushMessage();
          },
          onDone: () => { if (turnHadTool) setActionCount((c) => c + 1); flushMessage(); },
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Something went wrong";
        setMessages((prev) => prev.map((m) => (m.id === pendingMsg.id ? { ...m, content: `⚠️ ${errMsg}` } : m)));
      } finally {
        setSending(false);
      }
    },
    [conversationId, send, sending, appendCompletionMessage],
  );

  const handlePlanResponse = useCallback(
    async (planId: string, confirmed: boolean) => {
      if (!conversationId) return;
      const status: PlanProposalCardData["status"] = confirmed ? "confirmed" : "rejected";
      resolvedPlansRef.current.set(planId, status);
      setMessages((prev) =>
        prev.map((m) =>
          m.planProposals
            ? { ...m, planProposals: m.planProposals.map((p) => (p.id === planId ? { ...p, status } : p)) }
            : m,
        ),
      );
      const result = await respondToPlanProposal(conversationId, planId, confirmed);
      if (result.status && result.status !== status) {
        resolvedPlansRef.current.set(planId, result.status);
        setMessages((prev) =>
          prev.map((m) =>
            m.planProposals
              ? { ...m, planProposals: m.planProposals.map((p) => (p.id === planId ? { ...p, status: result.status! } : p)) }
              : m,
          ),
        );
      }
    },
    [conversationId],
  );

  const handlePickTemplate = useCallback(
    (choice: { id: string; name: string } | null) => {
      void handleSend(choice ? `Use the "${choice.name}" template for the design (templateId: ${choice.id}).` : "Design from my prompt only — no template.");
    },
    [handleSend],
  );

  const handlePickOption = useCallback((text: string) => void handleSend(text), [handleSend]);

  // ── Conversation history (deep-linkable, ChatGPT/Claude-style) ──
  const refreshConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/assistant/conversations?limit=40");
      const json = await res.json();
      const raw: Array<{ id: string; title?: string | null; updatedAt: string; messageCount?: number }> = json?.data?.conversations ?? [];
      setConversations(raw.map((c) => ({ id: c.id, title: c.title || "New conversation", updatedAt: c.updatedAt, messageCount: c.messageCount ?? 0 })));
    } catch {
      /* ignore */
    }
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    // Set the id first so the URL stays stable while the transcript loads.
    setConversationId(id);
    setLoadingConversation(true);
    try {
      const res = await fetch(`/api/ai/assistant/conversations/${id}`);
      const json = await res.json();
      if (json?.success) {
        const conv = json.data ?? json;
        const rawMsgs: Array<{ id: string; role: string; content: string; metadata?: string | null }> = conv?.messages ?? [];
        const cards = await fetchConversationCards(id);
        setMessages(
          rawMsgs
            .filter((m) => m.role === "user" || m.role === "assistant")
            // Drop button-driven internal instructions (tagged with HIDDEN_PREFIX)
            // so we never re-surface a raw agent prompt as a user bubble.
            .filter((m) => !(m.role === "user" && m.content.startsWith(HIDDEN_PREFIX)))
            .map((m) => ({
              id: m.id,
              role: m.role === "assistant" ? "assistant" : "user",
              content: m.content,
              blocks: parseMessageBlocks(m.metadata),
              toolCalls: cards.toolCallsByMsg.get(m.id),
              planProposals: cards.proposalsByMsg.get(m.id),
              agentTasks: cards.tasksByMsg.get(m.id),
            })),
        );
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingConversation(false);
    }
  }, []);

  const newConversation = useCallback(() => {
    setMessages([]);
    setConversationId(null);
  }, []);

  return {
    messages,
    sending,
    conversationId,
    conversations,
    loadingConversation,
    send: handleSend,
    handlePlanResponse,
    handlePickTemplate,
    handlePickOption,
    loadConversation,
    newConversation,
    refreshConversations,
    canvasUpdateRef,
    actionCount,
  };
}

function startTaskSubscription(
  taskId: string,
  tasksById: Map<string, AgentTaskCardData>,
  flush: () => void,
  registry: Map<string, AbortController>,
  appendAssistantMessage?: (msg: { id: string; content: string }) => void,
  onCanvasImage?: (patch: Record<string, unknown>) => void,
) {
  if (registry.has(taskId)) return;
  const controller = subscribeToTaskStream(taskId, (event) => {
    if ((event.type === "completed" || event.type === "failed") && event.assistantMessage) {
      appendAssistantMessage?.({ id: event.assistantMessageId || `task-done-${taskId}`, content: event.assistantMessage });
    }
    const current = tasksById.get(taskId);
    if (!current) return;
    let next: AgentTaskCardData = current;
    // Apply a finished task's result to the OPEN canvas. A branded design renders
    // as the full image; an element drops on as a new draggable layer; a
    // background sits behind the design (addImageLayer is de-duped by url, so a
    // snapshot+completed double-fire can never add it twice).
    const applyCanvasResult = (kind: string, output: unknown) => {
      if (kind === "create_branded_design") {
        const url = (output as { url?: string } | null | undefined)?.url;
        onCanvasImage?.(url ? { generating: false, imageUrl: url } : { generating: false });
      } else if (kind === "canvas_object") {
        const out = output as { url?: string; objectType?: string } | null | undefined;
        if (out?.url) onCanvasImage?.(out.objectType === "background" ? { bgImageUrl: out.url } : { addImageLayer: { url: out.url } });
      }
    };
    if (event.type === "snapshot") {
      next = { ...current, status: event.status, output: event.output ?? current.output, error: event.error ?? current.error, resultRefType: event.resultRefType ?? current.resultRefType, resultRefId: event.resultRefId ?? current.resultRefId };
      // The task may already be DONE when we connect — the stream sends a
      // *completed snapshot* (not a separate completed event) and closes, so we
      // must apply the canvas result here too or it's silently dropped.
      if (event.status === "completed") applyCanvasResult(current.kind, next.output);
    } else if (event.type === "progress") {
      next = { ...current, progress: event.progress ?? current.progress, progressMessage: event.message ?? current.progressMessage };
    } else if (event.type === "completed") {
      next = { ...current, status: "completed", output: event.output ?? current.output, resultRefType: event.resultRefType ?? current.resultRefType, resultRefId: event.resultRefId ?? current.resultRefId };
      applyCanvasResult(current.kind, next.output);
      registry.get(taskId)?.abort();
      registry.delete(taskId);
    } else if (event.type === "failed") {
      next = { ...current, status: "failed", error: event.error ?? current.error };
      if (current.kind === "create_branded_design") onCanvasImage?.({ generating: false });
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
