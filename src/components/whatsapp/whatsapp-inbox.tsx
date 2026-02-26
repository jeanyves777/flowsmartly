"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  Send,
  Phone,
  User,
  MessageSquare,
  Image as ImageIcon,
  Video,
  FileText,
  Mic,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  Archive,
  Trash2,
  MoreVertical,
  ArrowLeft,
  Loader2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";
import type { WhatsAppAccount, Conversation, Message } from "./types";

interface WhatsAppInboxProps {
  account: WhatsAppAccount;
}

export function WhatsAppInbox({ account }: WhatsAppInboxProps) {
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState("");
  const [showContextMenu, setShowContextMenu] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch(`/api/whatsapp/conversations?socialAccountId=${account.id}`);
      const data = await res.json();
      if (data.success) {
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error("Error loading conversations:", error);
    } finally {
      setLoading(false);
    }
  }, [account.id]);

  // Load messages for selected conversation
  const loadMessages = useCallback(async (conversationId: string) => {
    setMessagesLoading(true);
    try {
      const res = await fetch(`/api/whatsapp/messages/${conversationId}`);
      const data = await res.json();
      if (data.success) {
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error("Error loading messages:", error);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Poll for new messages
  useEffect(() => {
    pollRef.current = setInterval(() => {
      loadConversations();
      if (selectedConversation) {
        loadMessages(selectedConversation.id);
      }
    }, 10000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadConversations, loadMessages, selectedConversation]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Select a conversation
  function handleSelectConversation(conv: Conversation) {
    setSelectedConversation(conv);
    loadMessages(conv.id);

    // Mark as read
    if (conv.unreadCount > 0) {
      fetch("/api/whatsapp/conversations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: conv.id, unreadCount: 0 }),
      });
      setConversations((prev) =>
        prev.map((c) => (c.id === conv.id ? { ...c, unreadCount: 0 } : c))
      );
    }
  }

  // Send message
  async function handleSend() {
    if (!messageInput.trim() || (!selectedConversation && !newChatPhone.trim())) return;

    setSending(true);
    try {
      const body: any = {
        socialAccountId: account.id,
        message: messageInput.trim(),
        messageType: "text",
      };

      if (selectedConversation) {
        body.conversationId = selectedConversation.id;
      } else {
        body.to = newChatPhone.trim();
      }

      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.success) {
        setMessageInput("");

        if (!selectedConversation) {
          // New conversation was created
          setShowNewChat(false);
          setNewChatPhone("");
          await loadConversations();
        } else {
          // Reload messages for existing conversation
          await loadMessages(selectedConversation.id);
          await loadConversations();
        }
      } else {
        toast({
          title: "Failed to send",
          description: data.error || "Could not send message",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Network error sending message",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  }

  // Archive/delete conversation
  async function handleArchiveConversation(convId: string) {
    try {
      await fetch("/api/whatsapp/conversations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: convId, status: "archived" }),
      });
      setShowContextMenu(null);
      if (selectedConversation?.id === convId) {
        setSelectedConversation(null);
        setMessages([]);
      }
      await loadConversations();
      toast({ title: "Conversation archived" });
    } catch {
      toast({ title: "Failed to archive", variant: "destructive" });
    }
  }

  async function handleDeleteConversation(convId: string) {
    try {
      await fetch(`/api/whatsapp/conversations?conversationId=${convId}`, {
        method: "DELETE",
      });
      setShowContextMenu(null);
      if (selectedConversation?.id === convId) {
        setSelectedConversation(null);
        setMessages([]);
      }
      await loadConversations();
      toast({ title: "Conversation deleted" });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  }

  // Filter conversations
  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      conv.customerName?.toLowerCase().includes(q) ||
      conv.customerPhone.toLowerCase().includes(q) ||
      conv.lastMessage?.content?.toLowerCase().includes(q)
    );
  });

  // Format timestamp for conversation list
  function formatConvTime(dateStr: string) {
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, "h:mm a");
    if (isYesterday(date)) return "Yesterday";
    return format(date, "MM/dd/yy");
  }

  // Message status icon
  function MessageStatus({ status }: { status: string }) {
    switch (status) {
      case "sent":
        return <Check className="w-3 h-3 text-muted-foreground" />;
      case "delivered":
        return <CheckCheck className="w-3 h-3 text-muted-foreground" />;
      case "read":
        return <CheckCheck className="w-3 h-3 text-blue-500" />;
      case "failed":
        return <AlertCircle className="w-3 h-3 text-red-500" />;
      default:
        return <Clock className="w-3 h-3 text-muted-foreground" />;
    }
  }

  // Message type icon for last message preview
  function getMessagePreview(msg: Conversation["lastMessage"]) {
    if (!msg) return "No messages yet";
    const prefix = msg.direction === "outbound" ? "You: " : "";
    switch (msg.messageType) {
      case "image":
        return `${prefix}📷 Photo`;
      case "video":
        return `${prefix}🎥 Video`;
      case "audio":
        return `${prefix}🎤 Audio`;
      case "document":
        return `${prefix}📄 Document`;
      default:
        return `${prefix}${msg.content}`;
    }
  }

  if (loading) {
    return (
      <Card className="flex items-center justify-center h-[500px]">
        <Loader2 className="w-8 h-8 animate-spin text-green-500" />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex h-[600px]">
        {/* Left Panel - Conversation List */}
        <div
          className={`w-full md:w-[360px] border-r flex flex-col ${
            selectedConversation ? "hidden md:flex" : "flex"
          }`}
        >
          {/* Search & New Chat */}
          <div className="p-3 border-b space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setShowNewChat(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Conversation
            </Button>
          </div>

          {/* New Chat Input */}
          {showNewChat && (
            <div className="p-3 border-b bg-green-500/5">
              <p className="text-xs font-medium mb-2">New Conversation</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Phone number (e.g. +1234567890)"
                  value={newChatPhone}
                  onChange={(e) => setNewChatPhone(e.target.value)}
                  className="h-8 text-sm"
                />
                <Button
                  size="sm"
                  className="h-8 bg-green-500 hover:bg-green-600"
                  onClick={() => {
                    if (newChatPhone.trim()) {
                      setSelectedConversation(null);
                      setMessages([]);
                    }
                  }}
                  disabled={!newChatPhone.trim()}
                >
                  Start
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8"
                  onClick={() => {
                    setShowNewChat(false);
                    setNewChatPhone("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <MessageSquare className="w-12 h-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? "No conversations match your search" : "No conversations yet"}
                </p>
                {!searchQuery && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Start a new conversation or wait for incoming messages
                  </p>
                )}
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b transition-colors relative group ${
                    selectedConversation?.id === conv.id
                      ? "bg-green-500/10"
                      : "hover:bg-muted/50"
                  }`}
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                    {conv.customerAvatarUrl ? (
                      <img
                        src={conv.customerAvatarUrl}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <User className="w-5 h-5 text-green-600" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate">
                        {conv.customerName || conv.customerPhone}
                      </p>
                      <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                        {conv.lastMessage
                          ? formatConvTime(conv.lastMessage.timestamp)
                          : formatConvTime(conv.lastMessageAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-muted-foreground truncate">
                        {getMessagePreview(conv.lastMessage)}
                      </p>
                      {conv.unreadCount > 0 && (
                        <Badge className="bg-green-500 text-white text-[10px] h-5 min-w-5 flex items-center justify-center rounded-full shrink-0 ml-2">
                          {conv.unreadCount}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Context Menu */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowContextMenu(showContextMenu === conv.id ? null : conv.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 absolute right-2 top-2 p-1 rounded hover:bg-muted"
                  >
                    <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>

                  {showContextMenu === conv.id && (
                    <div className="absolute right-2 top-8 bg-popover border rounded-lg shadow-lg z-10 py-1 min-w-[140px]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleArchiveConversation(conv.id);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        Archive
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteConversation(conv.id);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-muted"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Panel - Messages */}
        <div
          className={`flex-1 flex flex-col ${
            selectedConversation || (showNewChat && newChatPhone) ? "flex" : "hidden md:flex"
          }`}
        >
          {selectedConversation || (showNewChat && newChatPhone) ? (
            <>
              {/* Chat Header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b bg-card">
                <button
                  className="md:hidden"
                  onClick={() => {
                    setSelectedConversation(null);
                    setMessages([]);
                  }}
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-9 h-9 rounded-full bg-green-500/10 flex items-center justify-center">
                  <User className="w-4 h-4 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {selectedConversation?.customerName ||
                      selectedConversation?.customerPhone ||
                      newChatPhone}
                  </p>
                  {selectedConversation && (
                    <p className="text-[10px] text-muted-foreground">
                      {selectedConversation.customerPhone}
                    </p>
                  )}
                </div>
                {selectedConversation && (
                  <Badge
                    variant={selectedConversation.status === "open" ? "default" : "secondary"}
                    className="text-[10px]"
                  >
                    {selectedConversation.status}
                  </Badge>
                )}
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20">
                {messagesLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-6 h-6 animate-spin text-green-500" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-center">
                    <div>
                      <MessageSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No messages yet</p>
                      <p className="text-xs text-muted-foreground mt-1">Send the first message below</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((msg) => {
                      const isOutbound = msg.direction === "outbound";
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${
                              isOutbound
                                ? "bg-green-500 text-white rounded-br-md"
                                : "bg-card border rounded-bl-md"
                            }`}
                          >
                            {/* Media content */}
                            {msg.mediaUrl && (
                              <div className="mb-1.5">
                                {msg.messageType === "image" ? (
                                  <img
                                    src={msg.mediaUrl}
                                    alt=""
                                    className="rounded-lg max-w-full max-h-48 object-cover"
                                  />
                                ) : msg.messageType === "video" ? (
                                  <div className="flex items-center gap-2 text-xs opacity-80">
                                    <Video className="w-4 h-4" />
                                    <span>Video</span>
                                  </div>
                                ) : msg.messageType === "audio" ? (
                                  <div className="flex items-center gap-2 text-xs opacity-80">
                                    <Mic className="w-4 h-4" />
                                    <span>Audio message</span>
                                  </div>
                                ) : msg.messageType === "document" ? (
                                  <div className="flex items-center gap-2 text-xs opacity-80">
                                    <FileText className="w-4 h-4" />
                                    <span>{msg.fileName || "Document"}</span>
                                  </div>
                                ) : null}
                              </div>
                            )}

                            {/* Text content */}
                            {msg.content && (
                              <p className="text-sm whitespace-pre-wrap break-words">
                                {msg.content}
                              </p>
                            )}

                            {/* Caption */}
                            {msg.caption && msg.caption !== msg.content && (
                              <p className="text-xs mt-1 opacity-80">{msg.caption}</p>
                            )}

                            {/* Time & Status */}
                            <div
                              className={`flex items-center gap-1 mt-1 ${
                                isOutbound ? "justify-end" : "justify-start"
                              }`}
                            >
                              <span
                                className={`text-[10px] ${
                                  isOutbound ? "text-white/70" : "text-muted-foreground"
                                }`}
                              >
                                {format(new Date(msg.timestamp), "h:mm a")}
                              </span>
                              {isOutbound && <MessageStatus status={msg.status} />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Message Input */}
              <div className="p-3 border-t bg-card">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    disabled={sending}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!messageInput.trim() || sending}
                    className="bg-green-500 hover:bg-green-600"
                    size="icon"
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            /* Empty state - no conversation selected */
            <div className="flex-1 flex items-center justify-center bg-muted/10">
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="w-10 h-10 text-green-500/50" />
                </div>
                <h3 className="font-semibold text-lg mb-1">WhatsApp Inbox</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Select a conversation or start a new one to begin messaging
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
