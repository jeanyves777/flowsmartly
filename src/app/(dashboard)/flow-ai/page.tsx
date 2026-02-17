"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { emitCreditsUpdate } from "@/lib/utils/credits-event";
import { useCreditCosts } from "@/hooks/use-credit-costs";
import {
  ArrowUp,
  Plus,
  Sparkles,
  Coins,
  Search,
  Trash2,
  MessageSquare,
  Image as ImageIcon,
  Video,
  Type,
  Wand2,
  PanelLeftClose,
  PanelLeftOpen,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { MessageBubble } from "@/components/ai-assistant/message-bubble";
import { AIGenerationLoader, AISpinner } from "@/components/shared/ai-generation-loader";
import { showCreditPurchaseModal } from "@/components/payments/credit-purchase-modal";

type GenerationMode = "auto" | "text" | "image" | "video";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
  mediaType?: string | null;
  mediaUrl?: string | null;
  creditError?: { code: string; required: number } | null;
}

interface Conversation {
  id: string;
  title: string | null;
  updatedAt: string;
  _count?: { messages: number };
  messageCount?: number;
}

const MODE_CONFIG: Record<
  GenerationMode,
  { label: string; icon: React.ElementType; color: string; description: string }
> = {
  auto: { label: "Auto", icon: Wand2, color: "bg-purple-500/10 text-purple-500 border-purple-500/30", description: "AI detects the best mode" },
  text: { label: "Text", icon: Type, color: "bg-blue-500/10 text-blue-500 border-blue-500/30", description: "Chat & content creation" },
  image: { label: "Image", icon: ImageIcon, color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30", description: "Generate images with AI" },
  video: { label: "Video", icon: Video, color: "bg-amber-500/10 text-amber-500 border-amber-500/30", description: "Create videos with Sora" },
};

const SUGGESTED_PROMPTS = [
  { text: "Generate an image of a sunset over the ocean", mode: "image" as GenerationMode },
  { text: "Write an engaging Instagram caption for my product launch", mode: "text" as GenerationMode },
  { text: "Create a 5-second video of flowing water", mode: "video" as GenerationMode },
  { text: "Help me plan my social media content for this week", mode: "text" as GenerationMode },
];

export default function FlowAIPage() {
  const searchParams = useSearchParams();
  const initialConvId = searchParams.get("conversationId");
  const { costs } = useCreditCosts("AI_CHAT_IMAGE", "AI_CHAT_VIDEO", "AI_CHAT_MESSAGE");

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(initialConvId);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [conversationTitle, setConversationTitle] = useState("New Chat");
  const [mode, setMode] = useState<GenerationMode>("auto");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [generatingMedia, setGeneratingMedia] = useState<string | null>(null); // "image" | "video" | null

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming, scrollToBottom]);

  // Fetch conversations list
  const fetchConversations = useCallback(async () => {
    setConversationsLoading(true);
    try {
      const res = await fetch("/api/ai/assistant/conversations");
      const data = await res.json();
      if (data.success) {
        setConversations(data.data.conversations);
      }
    } catch {
      // Silently fail
    } finally {
      setConversationsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Load initial conversation from URL
  useEffect(() => {
    if (initialConvId) {
      loadConversation(initialConvId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialConvId]);

  // Load a conversation
  const loadConversation = async (id: string) => {
    try {
      const res = await fetch(`/api/ai/assistant/conversations/${id}`);
      const data = await res.json();
      if (data.success) {
        setConversationId(id);
        setMessages(data.data.messages);
        setConversationTitle(data.data.title || "Untitled Chat");
      }
    } catch {
      // Silently fail
    }
  };

  const startNewConversation = () => {
    setConversationId(null);
    setMessages([]);
    setConversationTitle("New Chat");
    setInput("");
  };

  const deleteConversation = async (id: string) => {
    try {
      await fetch(`/api/ai/assistant/conversations/${id}`, { method: "DELETE" });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (conversationId === id) {
        startNewConversation();
      }
    } catch {
      // Silently fail
    }
  };

  // Send message via the generate endpoint
  const sendMessage = async (text?: string, overrideMode?: GenerationMode) => {
    const messageText = (text || input).trim();
    if (!messageText || isStreaming) return;

    const activeMode = overrideMode || mode;
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // Add user message
    const userMsg: Message = {
      id: `temp-user-${Date.now()}`,
      role: "user",
      content: messageText,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);

    // Prepare placeholder assistant message
    const assistantId = `temp-assistant-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "" },
    ]);

    // Determine if we expect media
    const expectsMedia = activeMode === "image" || activeMode === "video";
    if (expectsMedia) {
      setGeneratingMedia(activeMode);
    }

    try {
      abortRef.current = new AbortController();
      const res = await fetch("/api/ai/assistant/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          message: messageText,
          mode: activeMode,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json();
        if (err.code === "FREE_CREDITS_RESTRICTED" || err.code === "INSUFFICIENT_CREDITS") {
          const e = new Error(err.error || "Insufficient credits");
          (e as unknown as Record<string, unknown>).creditError = true;
          (e as unknown as Record<string, unknown>).creditCode = err.code;
          (e as unknown as Record<string, unknown>).creditsRequired = err.required;
          throw e;
        }
        throw new Error(err.error || "Failed to send message");
      }

      const contentType = res.headers.get("Content-Type") || "";

      // ─── JSON response (image generation) ───
      if (contentType.includes("application/json")) {
        const data = await res.json();
        if (data.type === "media") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    id: data.messageId || assistantId,
                    content: data.mediaType === "image"
                      ? "Here's the image I generated for you:"
                      : "Here's the video I generated for you:",
                    mediaType: data.mediaType,
                    mediaUrl: data.mediaUrl,
                  }
                : m
            )
          );
          if (data.conversationId) setConversationId(data.conversationId);
          if (data.creditsRemaining !== null && data.creditsRemaining !== undefined) {
            setCredits(data.creditsRemaining);
            emitCreditsUpdate(data.creditsRemaining);
          }
        } else if (data.error) {
          throw new Error(data.error);
        }
        setGeneratingMedia(null);
        fetchConversations();
        return;
      }

      // ─── SSE streaming (text or video) ───
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No response stream");

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === "start") {
              setConversationId(data.conversationId);
            } else if (data.type === "delta") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + data.text }
                    : m
                )
              );
            } else if (data.type === "status") {
              // Update placeholder with status
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: data.message }
                    : m
                )
              );
            } else if (data.type === "media") {
              // Video or media finished
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        id: data.messageId || assistantId,
                        content: data.mediaType === "video"
                          ? "Here's the video I generated for you:"
                          : "Here's the image I generated for you:",
                        mediaType: data.mediaType,
                        mediaUrl: data.mediaUrl,
                      }
                    : m
                )
              );
              if (data.creditsRemaining !== null && data.creditsRemaining !== undefined) {
                setCredits(data.creditsRemaining);
                emitCreditsUpdate(data.creditsRemaining);
              }
              setGeneratingMedia(null);
            } else if (data.type === "done") {
              setCredits(data.creditsRemaining);
              emitCreditsUpdate(data.creditsRemaining);
            } else if (data.type === "error") {
              throw new Error(data.message);
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }

      fetchConversations();
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") return;
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== assistantId);
        return filtered;
      });
      const errMsg = error instanceof Error ? error.message : "Something went wrong";
      const errAny = error as Record<string, unknown>;
      const isCreditErr = error instanceof Error && !!errAny.creditError;
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: isCreditErr
            ? errMsg
            : `Sorry, I encountered an error: ${errMsg}. Please try again.`,
          creditError: isCreditErr
            ? { code: String(errAny.creditCode), required: Number(errAny.creditsRequired) || 0 }
            : null,
        },
      ]);
    } finally {
      setIsStreaming(false);
      setGeneratingMedia(null);
      abortRef.current = null;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 160) + "px";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const filteredConversations = conversations.filter((c) =>
    !searchQuery ||
    (c.title || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-88px)] -m-4 md:-m-6">
      {/* ─── Left Sidebar: Conversations ─── */}
      <div
        className={`${
          sidebarOpen ? "w-72" : "w-0"
        } transition-all duration-200 flex-shrink-0 border-r border-border bg-card overflow-hidden`}
      >
        <div className="w-72 h-full flex flex-col">
          {/* New Chat Button */}
          <div className="p-3 border-b border-border">
            <button
              onClick={startNewConversation}
              className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Chat
            </button>
          </div>

          {/* Search */}
          <div className="px-3 pt-3 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-muted/30 placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
              />
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            {conversationsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">
                  {searchQuery ? "No conversations found" : "No conversations yet"}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredConversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                      conversationId === conv.id
                        ? "bg-brand-500/10 text-brand-500"
                        : "hover:bg-muted/50 text-foreground"
                    }`}
                    onClick={() => loadConversation(conv.id)}
                  >
                    <MessageSquare className="w-4 h-4 shrink-0 opacity-50" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {conv.title || "Untitled Chat"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(conv.updatedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(conv.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-all"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Main Chat Area ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground transition-colors"
            title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          >
            {sidebarOpen ? (
              <PanelLeftClose className="w-4 h-4" />
            ) : (
              <PanelLeftOpen className="w-4 h-4" />
            )}
          </button>
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-foreground leading-none">
                FlowAI
              </h1>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                {conversationTitle}
              </p>
            </div>
          </div>
          {credits !== null && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50">
              <Coins className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-medium">{credits}</span>
            </div>
          )}
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto py-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-6 text-center max-w-2xl mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500/20 to-purple-500/20 flex items-center justify-center mb-5">
                <Sparkles className="w-8 h-8 text-brand-500" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">
                Welcome to FlowAI
              </h2>
              <p className="text-sm text-muted-foreground mb-8 max-w-md">
                Your multi-modal AI assistant. Generate text, images, and videos — all in one place.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                {SUGGESTED_PROMPTS.map((prompt) => {
                  const modeInfo = MODE_CONFIG[prompt.mode];
                  const Icon = modeInfo.icon;
                  return (
                    <button
                      key={prompt.text}
                      onClick={() => sendMessage(prompt.text, prompt.mode)}
                      className="text-left px-4 py-3 rounded-xl border border-border hover:border-brand-500/30 hover:bg-muted/30 transition-all group"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-brand-500" />
                        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          {modeInfo.label}
                        </span>
                      </div>
                      <p className="text-sm text-foreground">
                        {prompt.text}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-2 max-w-3xl mx-auto">
              {messages.map((msg, idx) => {
                // Skip rendering empty streaming placeholder (the loader handles it)
                if (
                  isStreaming &&
                  idx === messages.length - 1 &&
                  msg.role === "assistant" &&
                  !msg.content
                ) {
                  return null;
                }
                return (
                  <div key={msg.id}>
                    <MessageBubble
                      role={msg.role}
                      content={msg.content}
                      createdAt={msg.createdAt}
                      mediaType={msg.mediaType}
                      mediaUrl={msg.mediaUrl}
                      messageId={msg.id}
                    />
                    {msg.creditError && (
                      <div className="flex items-start gap-2 px-4 py-1 mt-1">
                        <div className="w-7 shrink-0" />
                        <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl px-4 py-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Coins className="w-4 h-4 text-amber-500" />
                            <span className="text-sm font-semibold text-foreground">
                              Need more credits?
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mb-3">
                            {msg.creditError.code === "FREE_CREDITS_RESTRICTED"
                              ? "Your free credits are limited to email & SMS marketing. Purchase credits to unlock all AI features."
                              : `This requires ${msg.creditError.required} credits. Top up to continue using FlowAI.`}
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                showCreditPurchaseModal({
                                  creditsNeeded: msg.creditError!.required,
                                  featureName: "FlowAI",
                                  isFreeRestricted:
                                    msg.creditError!.code === "FREE_CREDITS_RESTRICTED",
                                })
                              }
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium transition-colors"
                            >
                              <Coins className="w-3.5 h-3.5" />
                              Buy Credits
                            </button>
                            <Link
                              href="/settings/upgrade"
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-500/30 text-brand-500 hover:bg-brand-500/10 text-xs font-medium transition-colors"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              Upgrade Plan
                            </Link>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {isStreaming &&
                messages[messages.length - 1]?.content === "" &&
                !generatingMedia && (
                <div className="px-4 py-1.5">
                  <div className="max-w-[400px]">
                    <AIGenerationLoader
                      compact
                      currentStep="Thinking..."
                      subtitle="Generating response"
                    />
                  </div>
                </div>
              )}
              {generatingMedia && (
                <div className="px-4 py-1.5">
                  <div className="max-w-[400px]">
                    <AIGenerationLoader
                      compact
                      currentStep={generatingMedia === "image" ? "Generating image..." : "Creating video..."}
                      subtitle={generatingMedia === "video" ? "This may take a few minutes" : "Almost there"}
                    />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="border-t border-border bg-card p-4">
          <div className="max-w-3xl mx-auto">
            {/* Mode Selector */}
            <div className="flex items-center gap-2 mb-3">
              {(Object.entries(MODE_CONFIG) as [GenerationMode, typeof MODE_CONFIG["auto"]][]).map(
                ([key, config]) => {
                  const Icon = config.icon;
                  const isActive = mode === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setMode(key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        isActive
                          ? config.color
                          : "border-transparent text-muted-foreground hover:bg-muted/50"
                      }`}
                      title={config.description}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {config.label}
                    </button>
                  );
                }
              )}
            </div>

            {/* Input */}
            <div className="flex items-end gap-3">
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    mode === "image"
                      ? "Describe the image you want to create..."
                      : mode === "video"
                      ? "Describe the video you want to create..."
                      : "Ask FlowAI anything..."
                  }
                  rows={1}
                  className="w-full resize-none rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50 max-h-[160px] pr-12"
                  disabled={isStreaming}
                />
              </div>
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isStreaming}
                className="shrink-0 w-11 h-11 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors"
              >
                {isStreaming ? (
                  <AISpinner className="w-5 h-5" />
                ) : (
                  <ArrowUp className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Credit cost hint */}
            <div className="flex items-center justify-between mt-2 px-1">
              <p className="text-[11px] text-muted-foreground">
                {mode === "image"
                  ? `${costs.AI_CHAT_IMAGE ?? 125} credits per image`
                  : mode === "video"
                  ? `${costs.AI_CHAT_VIDEO ?? 200} credits per video`
                  : `${costs.AI_CHAT_MESSAGE ?? 2} credits per message`}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Shift+Enter for new line
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
