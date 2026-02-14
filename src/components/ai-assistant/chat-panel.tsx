"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowUp, List, X, Sparkles, Coins, Maximize2 } from "lucide-react";
import { MessageBubble } from "./message-bubble";
import { TypingIndicator } from "./typing-indicator";
import { ConversationList } from "./conversation-list";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
  mediaType?: string | null;
  mediaUrl?: string | null;
}

interface Conversation {
  id: string;
  title: string;
  messageCount: number;
  updatedAt: string;
}

interface ChatPanelProps {
  onClose: () => void;
}

const SUGGESTED_PROMPTS = [
  "Help me write an Instagram post",
  "Generate content ideas for this week",
  "Review my brand messaging",
  "Create email subject lines",
];

export function ChatPanel({ onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [conversationTitle, setConversationTitle] = useState("New Chat");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll to bottom
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

  // Fetch on mount
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Load a conversation
  const loadConversation = async (id: string) => {
    try {
      const res = await fetch(`/api/ai/assistant/conversations/${id}`);
      const data = await res.json();
      if (data.success) {
        setConversationId(id);
        setMessages(data.data.messages);
        setConversationTitle(data.data.title);
        setShowHistory(false);
      }
    } catch {
      // Silently fail
    }
  };

  // Start new conversation
  const startNewConversation = () => {
    setConversationId(null);
    setMessages([]);
    setConversationTitle("New Chat");
    setShowHistory(false);
  };

  // Delete conversation
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

  // Send message
  const sendMessage = async (text?: string) => {
    const messageText = (text || input).trim();
    if (!messageText || isStreaming) return;

    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // Add user message to UI
    const userMsg: Message = {
      id: `temp-user-${Date.now()}`,
      role: "user",
      content: messageText,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);

    // Prepare streaming assistant message
    const assistantId = `temp-assistant-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "" },
    ]);

    try {
      abortRef.current = new AbortController();
      const res = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: messageText }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to send message");
      }

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
            } else if (data.type === "done") {
              setCredits(data.creditsRemaining);
            } else if (data.type === "error") {
              throw new Error(data.message);
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }

      // Refresh conversations after a new message
      fetchConversations();
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") return;
      // Remove the empty assistant message on error
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== assistantId);
        return filtered;
      });
      // Show error as a temporary system message
      const errMsg = error instanceof Error ? error.message : "Something went wrong";
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: `Sorry, I encountered an error: ${errMsg}. Please try again.`,
        },
      ]);
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  // Handle textarea auto-resize
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
  };

  // Handle enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-card rounded-2xl overflow-hidden border border-border shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-brand-500/5 to-purple-500/5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground leading-none">
              FlowAI
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[180px]">
              {showHistory ? "Conversations" : conversationTitle}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`p-2 rounded-lg transition-colors ${
              showHistory
                ? "bg-brand-500/10 text-brand-500"
                : "hover:bg-muted/50 text-muted-foreground"
            }`}
            title="Conversation history"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              const url = conversationId
                ? `/flow-ai?conversationId=${conversationId}`
                : "/flow-ai";
              window.location.href = url;
            }}
            className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground"
            title="Open full page"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {showHistory ? (
        <ConversationList
          conversations={conversations}
          activeId={conversationId}
          onSelect={loadConversation}
          onNew={startNewConversation}
          onDelete={deleteConversation}
          isLoading={conversationsLoading}
        />
      ) : (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto py-3">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full px-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500/20 to-purple-500/20 flex items-center justify-center mb-4">
                  <Sparkles className="w-7 h-7 text-brand-500" />
                </div>
                <h4 className="font-semibold text-foreground mb-1">
                  Hi! I&apos;m FlowAI
                </h4>
                <p className="text-sm text-muted-foreground mb-5">
                  Your brand-aware marketing assistant. How can I help?
                </p>
                <div className="grid grid-cols-1 gap-2 w-full max-w-[280px]">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => sendMessage(prompt)}
                      className="text-left px-3 py-2.5 rounded-xl border border-border text-sm hover:bg-muted/50 hover:border-brand-500/30 transition-colors text-muted-foreground hover:text-foreground"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    role={msg.role}
                    content={msg.content}
                    createdAt={msg.createdAt}
                    mediaType={msg.mediaType}
                    mediaUrl={msg.mediaUrl}
                    messageId={msg.id}
                  />
                ))}
                {isStreaming &&
                  messages[messages.length - 1]?.content === "" && (
                    <TypingIndicator />
                  )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input Bar */}
          <div className="border-t border-border p-3">
            {credits !== null && (
              <div className="flex items-center gap-1 mb-2 px-1">
                <Coins className="w-3 h-3 text-amber-500" />
                <span className="text-[11px] text-muted-foreground">
                  {credits} credits remaining
                </span>
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask FlowAI anything..."
                rows={1}
                className="flex-1 resize-none rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50 max-h-[120px]"
                disabled={isStreaming}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isStreaming}
                className="shrink-0 w-10 h-10 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors"
              >
                <ArrowUp className="w-5 h-5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
