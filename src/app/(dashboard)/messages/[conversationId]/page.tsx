"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatDistanceToNow, format } from "date-fns";
import {
  ArrowLeft, Send, Paperclip, ClipboardCheck, Settings, Image as ImageIcon,
  FileText, Video, X, Check, XCircle, Calendar, Loader2, ChevronUp,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Participant {
  id: string;
  name: string;
  avatarUrl: string | null;
}

interface ApprovalRequest {
  id: string;
  postContent: string | null;
  mediaUrls: string[];
  platforms: string[];
  scheduledAt: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewComment: string | null;
  reviewedAt: string | null;
}

interface Message {
  id: string;
  senderUserId: string;
  type: "TEXT" | "APPROVAL_REQUEST";
  text: string | null;
  attachments: Attachment[];
  readAt: string | null;
  createdAt: string;
  approvalRequest: ApprovalRequest | null;
}

interface Attachment {
  url: string;
  type: "image" | "video" | "document";
  name?: string;
  size?: number;
  mimeType?: string;
}

interface Conversation {
  id: string;
  agentClientId: string;
  agentUserId: string;
  clientUserId: string;
  agentClient: { status: string };
}

interface ApprovalSettings {
  agentClientId: string;
  requireApproval: "ALL" | "MEDIA_ONLY" | "PLATFORM_SPECIFIC" | "NONE";
  platformsRequiringApproval: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 3000;

const PLATFORM_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "twitter", label: "Twitter/X" },
  { value: "facebook", label: "Facebook" },
  { value: "feed", label: "Feed" },
  { value: "linkedin", label: "LinkedIn" },
];

function getStatusColor(status: string) {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-500/10 text-emerald-600 border-emerald-200";
    case "PAUSED":
      return "bg-amber-500/10 text-amber-600 border-amber-200";
    case "TERMINATED":
      return "bg-red-500/10 text-red-600 border-red-200";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getApprovalStatusBadge(status: string) {
  switch (status) {
    case "PENDING":
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-200">
          Pending
        </Badge>
      );
    case "APPROVED":
      return (
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-200">
          Approved
        </Badge>
      );
    case "REJECTED":
      return (
        <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200">
          Rejected
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getPlatformLabel(platform: string) {
  const found = PLATFORM_OPTIONS.find((p) => p.value === platform);
  return found?.label || platform;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function isImageUrl(url: string) {
  return /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url);
}

function isVideoUrl(url: string) {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url);
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function ConversationChatPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const router = useRouter();
  const { toast } = useToast();

  // Core state
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [otherParticipant, setOtherParticipant] = useState<Participant | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Composer state
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Approval request dialog
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalPostContent, setApprovalPostContent] = useState("");
  const [approvalMediaUrls, setApprovalMediaUrls] = useState<string[]>([]);
  const [approvalPlatforms, setApprovalPlatforms] = useState<string[]>([]);
  const [approvalScheduledAt, setApprovalScheduledAt] = useState("");
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const [isUploadingApprovalMedia, setIsUploadingApprovalMedia] = useState(false);

  // Approval reject dialog
  const [rejectingApprovalId, setRejectingApprovalId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [isReviewingApproval, setIsReviewingApproval] = useState(false);

  // Approval settings dialog (client only)
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [approvalSettings, setApprovalSettings] = useState<ApprovalSettings | null>(null);
  const [settingsMode, setSettingsMode] = useState<string>("ALL");
  const [settingsPlatforms, setSettingsPlatforms] = useState<string[]>([]);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const approvalMediaInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const shouldAutoScroll = useRef(true);

  // Derived
  const isAgent = conversation
    ? currentUserId === conversation.agentUserId
    : false;
  const isClient = conversation
    ? currentUserId === conversation.clientUserId
    : false;
  const isTerminated = conversation?.agentClient.status === "TERMINATED";
  const isActive = conversation?.agentClient.status === "ACTIVE";

  // -------------------------------------------------------------------------
  // Fetch current user
  // -------------------------------------------------------------------------

  useEffect(() => {
    async function fetchMe() {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (data.success && data.data?.user) {
          setCurrentUserId(data.data.user.id);
        }
      } catch {
        // silent
      }
    }
    fetchMe();
  }, []);

  // -------------------------------------------------------------------------
  // Fetch messages (initial + polling)
  // -------------------------------------------------------------------------

  const fetchMessages = useCallback(
    async (beforeId?: string) => {
      try {
        const url = new URL(`/api/messages/${conversationId}`, window.location.origin);
        url.searchParams.set("limit", "30");
        if (beforeId) url.searchParams.set("before", beforeId);

        const res = await fetch(url.toString());
        const json = await res.json();

        if (!json.success) return null;
        return json.data as {
          messages: Message[];
          conversation: Conversation & { otherParticipant: Participant | null };
          hasMore: boolean;
        };
      } catch {
        return null;
      }
    },
    [conversationId]
  );

  // Initial load
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      const data = await fetchMessages();
      if (cancelled || !data) {
        setIsLoading(false);
        return;
      }

      // Messages come newest-first from API; reverse so oldest is at top
      const sorted = [...data.messages].reverse();
      setMessages(sorted);
      setConversation({
        id: data.conversation.id,
        agentClientId: data.conversation.agentClientId,
        agentUserId: data.conversation.agentUserId,
        clientUserId: data.conversation.clientUserId,
        agentClient: data.conversation.agentClient,
      });
      setOtherParticipant(data.conversation.otherParticipant);
      setHasMore(data.hasMore);
      setIsLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [fetchMessages]);

  // Auto-scroll on initial load or new messages
  useEffect(() => {
    if (shouldAutoScroll.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Mark messages as read
  const markAsRead = useCallback(async () => {
    try {
      await fetch(`/api/messages/${conversationId}/read`, { method: "PATCH" });
    } catch {
      // silent
    }
  }, [conversationId]);

  // Polling
  useEffect(() => {
    if (isLoading) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    async function poll() {
      if (document.visibilityState !== "visible") {
        timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
        return;
      }

      const data = await fetchMessages();
      if (data) {
        const sorted = [...data.messages].reverse();

        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const newMsgs = sorted.filter((m) => !existingIds.has(m.id));

          if (newMsgs.length > 0) {
            // Also update any existing messages that might have changed (e.g., readAt or approval status)
            const updatedMap = new Map(sorted.map((m) => [m.id, m]));
            const updated = prev.map((m) => updatedMap.get(m.id) || m);
            shouldAutoScroll.current = true;
            return [...updated, ...newMsgs];
          }

          // Still update existing messages for status changes (readAt, approval status)
          const updatedMap = new Map(sorted.map((m) => [m.id, m]));
          let changed = false;
          const updated = prev.map((m) => {
            const newer = updatedMap.get(m.id);
            if (newer && JSON.stringify(newer) !== JSON.stringify(m)) {
              changed = true;
              return newer;
            }
            return m;
          });
          return changed ? updated : prev;
        });

        // Update conversation status in case it changed
        if (data.conversation.agentClient.status !== conversation?.agentClient.status) {
          setConversation((prev) =>
            prev
              ? { ...prev, agentClient: data.conversation.agentClient }
              : prev
          );
        }
      }

      // Mark messages as read on each poll
      await markAsRead();

      timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
    }

    // Also mark as read on initial load complete
    markAsRead();

    timeoutId = setTimeout(poll, POLL_INTERVAL_MS);

    // Pause/resume on visibility change
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        markAsRead();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isLoading, fetchMessages, markAsRead, conversation?.agentClient.status]);

  // -------------------------------------------------------------------------
  // Load older messages
  // -------------------------------------------------------------------------

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore || messages.length === 0) return;
    setIsLoadingMore(true);
    shouldAutoScroll.current = false;

    const container = messagesContainerRef.current;
    const scrollHeightBefore = container?.scrollHeight || 0;

    const oldestId = messages[0].id;
    const data = await fetchMessages(oldestId);

    if (data) {
      const older = [...data.messages].reverse();
      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const unique = older.filter((m) => !existingIds.has(m.id));
        return [...unique, ...prev];
      });
      setHasMore(data.hasMore);

      // Maintain scroll position after prepending
      requestAnimationFrame(() => {
        if (container) {
          const scrollHeightAfter = container.scrollHeight;
          container.scrollTop += scrollHeightAfter - scrollHeightBefore;
        }
      });
    }

    setIsLoadingMore(false);
  }, [hasMore, isLoadingMore, messages, fetchMessages]);

  // -------------------------------------------------------------------------
  // Send message
  // -------------------------------------------------------------------------

  const sendMessage = useCallback(async () => {
    const trimmed = messageText.trim();
    if (!trimmed && pendingAttachments.length === 0) return;
    if (isSending) return;

    setIsSending(true);
    shouldAutoScroll.current = true;

    try {
      const res = await fetch(`/api/messages/${conversationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmed || null,
          attachments: pendingAttachments.length > 0 ? pendingAttachments : undefined,
        }),
      });
      const json = await res.json();

      if (json.success) {
        const newMsg: Message = {
          ...json.data,
          attachments: json.data.attachments || [],
          approvalRequest: json.data.approvalRequest || null,
        };
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        setMessageText("");
        setPendingAttachments([]);
        // Reset textarea height
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
        }
      } else {
        toast({
          title: "Failed to send",
          description: json.error?.message || "Could not send message",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  }, [messageText, pendingAttachments, isSending, conversationId, toast]);

  // -------------------------------------------------------------------------
  // File upload
  // -------------------------------------------------------------------------

  const uploadFile = useCallback(
    async (file: File): Promise<Attachment | null> => {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/media", { method: "POST", body: formData });
        const json = await res.json();
        if (json.success && json.data?.file) {
          const f = json.data.file;
          return {
            url: f.url,
            type: f.type === "video" ? "video" : f.type === "image" || f.type === "svg" ? "image" : "document",
            name: f.originalName,
            size: f.size,
            mimeType: f.mimeType,
          };
        }
      } catch {
        // fall through
      }
      return null;
    },
    []
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      setIsUploading(true);
      const results: Attachment[] = [];
      for (const file of Array.from(files)) {
        const att = await uploadFile(file);
        if (att) results.push(att);
      }
      setPendingAttachments((prev) => [...prev, ...results]);
      setIsUploading(false);

      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [uploadFile]
  );

  const removeAttachment = useCallback((index: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // -------------------------------------------------------------------------
  // Approval request creation (agent only)
  // -------------------------------------------------------------------------

  const handleApprovalMediaSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      setIsUploadingApprovalMedia(true);
      for (const file of Array.from(files)) {
        const att = await uploadFile(file);
        if (att) {
          setApprovalMediaUrls((prev) => [...prev, att.url]);
        }
      }
      setIsUploadingApprovalMedia(false);
      if (approvalMediaInputRef.current) approvalMediaInputRef.current.value = "";
    },
    [uploadFile]
  );

  const submitApprovalRequest = useCallback(async () => {
    if (approvalPlatforms.length === 0) {
      toast({
        title: "Select platforms",
        description: "Please select at least one platform.",
        variant: "destructive",
      });
      return;
    }
    setIsSubmittingApproval(true);
    shouldAutoScroll.current = true;

    try {
      const res = await fetch(`/api/messages/${conversationId}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postContent: approvalPostContent || null,
          mediaUrls: approvalMediaUrls.length > 0 ? approvalMediaUrls : undefined,
          platforms: approvalPlatforms,
          scheduledAt: approvalScheduledAt || undefined,
        }),
      });
      const json = await res.json();

      if (json.success && json.data?.message) {
        const msg = json.data.message;
        const newMsg: Message = {
          id: msg.id,
          senderUserId: msg.senderUserId,
          type: msg.type,
          text: msg.text,
          attachments: msg.attachments ? (typeof msg.attachments === "string" ? JSON.parse(msg.attachments) : msg.attachments) : [],
          readAt: msg.readAt,
          createdAt: msg.createdAt,
          approvalRequest: msg.approvalRequest || null,
        };
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        // Reset form
        setShowApprovalDialog(false);
        setApprovalPostContent("");
        setApprovalMediaUrls([]);
        setApprovalPlatforms([]);
        setApprovalScheduledAt("");
        toast({ title: "Approval request sent" });
      } else {
        toast({
          title: "Failed",
          description: json.error?.message || "Could not send approval request",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to send approval request.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingApproval(false);
    }
  }, [
    conversationId,
    approvalPostContent,
    approvalMediaUrls,
    approvalPlatforms,
    approvalScheduledAt,
    toast,
  ]);

  // -------------------------------------------------------------------------
  // Approve / reject approval (client only)
  // -------------------------------------------------------------------------

  const handleApproveApproval = useCallback(
    async (approvalId: string) => {
      setIsReviewingApproval(true);
      try {
        const res = await fetch(
          `/api/messages/${conversationId}/approval/${approvalId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "approve" }),
          }
        );
        const json = await res.json();
        if (json.success) {
          // Update the approval in messages
          setMessages((prev) =>
            prev.map((m) =>
              m.approvalRequest?.id === approvalId
                ? {
                    ...m,
                    approvalRequest: {
                      ...m.approvalRequest!,
                      status: "APPROVED" as const,
                      reviewedAt: new Date().toISOString(),
                    },
                  }
                : m
            )
          );
          toast({ title: "Content approved" });
        } else {
          toast({
            title: "Failed",
            description: json.error?.message || "Could not approve",
            variant: "destructive",
          });
        }
      } catch {
        toast({ title: "Error", description: "Failed to approve.", variant: "destructive" });
      } finally {
        setIsReviewingApproval(false);
      }
    },
    [conversationId, toast]
  );

  const handleRejectApproval = useCallback(
    async (approvalId: string) => {
      setIsReviewingApproval(true);
      try {
        const res = await fetch(
          `/api/messages/${conversationId}/approval/${approvalId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "reject",
              comment: rejectComment || undefined,
            }),
          }
        );
        const json = await res.json();
        if (json.success) {
          setMessages((prev) =>
            prev.map((m) =>
              m.approvalRequest?.id === approvalId
                ? {
                    ...m,
                    approvalRequest: {
                      ...m.approvalRequest!,
                      status: "REJECTED" as const,
                      reviewComment: rejectComment || null,
                      reviewedAt: new Date().toISOString(),
                    },
                  }
                : m
            )
          );
          setRejectingApprovalId(null);
          setRejectComment("");
          toast({ title: "Content rejected" });
        } else {
          toast({
            title: "Failed",
            description: json.error?.message || "Could not reject",
            variant: "destructive",
          });
        }
      } catch {
        toast({ title: "Error", description: "Failed to reject.", variant: "destructive" });
      } finally {
        setIsReviewingApproval(false);
      }
    },
    [conversationId, rejectComment, toast]
  );

  // -------------------------------------------------------------------------
  // Approval settings (client only)
  // -------------------------------------------------------------------------

  const openSettings = useCallback(async () => {
    if (!conversation) return;
    setShowSettingsDialog(true);

    try {
      const res = await fetch(
        `/api/agent-client/${conversation.agentClientId}/approval-settings`
      );
      const json = await res.json();
      if (json.success && json.data?.settings) {
        const s = json.data.settings;
        setApprovalSettings(s);
        setSettingsMode(s.requireApproval);
        setSettingsPlatforms(s.platformsRequiringApproval || []);
      }
    } catch {
      // use defaults
      setSettingsMode("ALL");
      setSettingsPlatforms([]);
    }
  }, [conversation]);

  const saveSettings = useCallback(async () => {
    if (!conversation) return;
    setIsSavingSettings(true);

    try {
      const res = await fetch(
        `/api/agent-client/${conversation.agentClientId}/approval-settings`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requireApproval: settingsMode,
            platformsRequiringApproval:
              settingsMode === "PLATFORM_SPECIFIC" ? settingsPlatforms : [],
          }),
        }
      );
      const json = await res.json();
      if (json.success) {
        toast({ title: "Settings saved" });
        setShowSettingsDialog(false);
      } else {
        toast({
          title: "Failed",
          description: json.error?.message || "Could not save settings",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to save settings.",
        variant: "destructive",
      });
    } finally {
      setIsSavingSettings(false);
    }
  }, [conversation, settingsMode, settingsPlatforms, toast]);

  // -------------------------------------------------------------------------
  // Keyboard handling
  // -------------------------------------------------------------------------

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  // Auto-resize textarea
  const handleTextareaInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setMessageText(e.target.value);
      const el = e.target;
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 120) + "px";
    },
    []
  );

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  const renderAttachment = (att: Attachment, index: number) => {
    if (att.type === "image" || isImageUrl(att.url)) {
      return (
        <img
          key={index}
          src={att.url}
          alt={att.name || "Image"}
          className="max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => window.open(att.url, "_blank")}
        />
      );
    }

    if (att.type === "video" || isVideoUrl(att.url)) {
      return (
        <div
          key={index}
          className="relative max-w-xs rounded-lg overflow-hidden cursor-pointer group"
          onClick={() => window.open(att.url, "_blank")}
        >
          <video src={att.url} className="rounded-lg" preload="metadata" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
            <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
              <Video className="h-5 w-5 text-gray-800 ml-0.5" />
            </div>
          </div>
        </div>
      );
    }

    // Document
    return (
      <a
        key={index}
        href={att.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background/50 hover:bg-background/80 transition-colors border max-w-xs"
      >
        <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{att.name || "Document"}</p>
          {att.size && (
            <p className="text-xs text-muted-foreground">{formatFileSize(att.size)}</p>
          )}
        </div>
      </a>
    );
  };

  const renderApprovalCard = (msg: Message) => {
    const approval = msg.approvalRequest!;
    const isMine = msg.senderUserId === currentUserId;

    return (
      <div className={`flex ${isMine ? "justify-end" : "justify-start"} mb-4`}>
        <Card className="max-w-md w-full border-amber-200/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-amber-600" />
              Content Approval Request
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Post content */}
            {approval.postContent && (
              <p className="text-sm whitespace-pre-wrap">{approval.postContent}</p>
            )}

            {/* Media thumbnails */}
            {approval.mediaUrls && approval.mediaUrls.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {approval.mediaUrls.map((url, i) =>
                  isImageUrl(url) ? (
                    <img
                      key={i}
                      src={url}
                      alt={`Media ${i + 1}`}
                      className="rounded-lg object-cover w-full h-24 cursor-pointer hover:opacity-90"
                      onClick={() => window.open(url, "_blank")}
                    />
                  ) : isVideoUrl(url) ? (
                    <div
                      key={i}
                      className="relative rounded-lg overflow-hidden h-24 cursor-pointer"
                      onClick={() => window.open(url, "_blank")}
                    >
                      <video src={url} className="w-full h-full object-cover" preload="metadata" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <Video className="h-5 w-5 text-white" />
                      </div>
                    </div>
                  ) : (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center rounded-lg bg-muted h-24 hover:bg-muted/80"
                    >
                      <FileText className="h-6 w-6 text-muted-foreground" />
                    </a>
                  )
                )}
              </div>
            )}

            {/* Platform badges */}
            <div className="flex flex-wrap gap-1.5">
              {approval.platforms.map((p) => (
                <Badge key={p} variant="secondary" className="text-xs">
                  {getPlatformLabel(p)}
                </Badge>
              ))}
            </div>

            {/* Scheduled time */}
            {approval.scheduledAt && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                Scheduled: {format(new Date(approval.scheduledAt), "MMM d, yyyy 'at' h:mm a")}
              </div>
            )}

            {/* Status */}
            <div className="flex items-center justify-between">
              {getApprovalStatusBadge(approval.status)}

              {/* Timestamp */}
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
              </span>
            </div>

            {/* Review comment */}
            {approval.reviewComment && (approval.status === "APPROVED" || approval.status === "REJECTED") && (
              <div className="p-2 rounded-lg bg-muted text-sm">
                <span className="font-medium text-xs text-muted-foreground">Review comment:</span>
                <p className="mt-0.5">{approval.reviewComment}</p>
              </div>
            )}

            {/* Actions (client only, pending only) */}
            {isClient && approval.status === "PENDING" && (
              <div className="flex gap-2 pt-1">
                {rejectingApprovalId === approval.id ? (
                  <div className="w-full space-y-2">
                    <Textarea
                      placeholder="Reason for rejection (optional)..."
                      value={rejectComment}
                      onChange={(e) => setRejectComment(e.target.value)}
                      className="text-sm min-h-[60px]"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={isReviewingApproval}
                        onClick={() => handleRejectApproval(approval.id)}
                        className="flex-1"
                      >
                        {isReviewingApproval ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            Confirm Reject
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setRejectingApprovalId(null);
                          setRejectComment("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <Button
                      size="sm"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                      disabled={isReviewingApproval}
                      onClick={() => handleApproveApproval(approval.id)}
                    >
                      {isReviewingApproval ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <Check className="h-3.5 w-3.5 mr-1" />
                          Approve
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      disabled={isReviewingApproval}
                      onClick={() => setRejectingApprovalId(approval.id)}
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1" />
                      Reject
                    </Button>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderMessage = (msg: Message, index: number) => {
    // Approval request cards have special rendering
    if (msg.type === "APPROVAL_REQUEST" && msg.approvalRequest) {
      return <div key={msg.id}>{renderApprovalCard(msg)}</div>;
    }

    const isMine = msg.senderUserId === currentUserId;
    const isLastOfMine =
      isMine &&
      (index === messages.length - 1 ||
        messages[index + 1]?.senderUserId !== currentUserId);

    return (
      <div
        key={msg.id}
        className={`flex ${isMine ? "justify-end" : "justify-start"} mb-3`}
      >
        <div className={`max-w-[75%] ${isMine ? "items-end" : "items-start"} flex flex-col`}>
          {/* Message bubble */}
          <div
            className={`px-4 py-2.5 ${
              isMine
                ? "bg-brand-500 text-white rounded-2xl rounded-br-md"
                : "bg-muted rounded-2xl rounded-bl-md"
            }`}
          >
            {msg.text && (
              <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
            )}
          </div>

          {/* Attachments */}
          {msg.attachments && msg.attachments.length > 0 && (
            <div className={`mt-1.5 space-y-1.5 ${isMine ? "items-end" : "items-start"} flex flex-col`}>
              {msg.attachments.map((att, i) => renderAttachment(att, i))}
            </div>
          )}

          {/* Timestamp and read receipt */}
          <div
            className={`flex items-center gap-1.5 mt-1 ${
              isMine ? "justify-end" : "justify-start"
            }`}
          >
            <span className="text-[11px] text-muted-foreground">
              {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
            </span>
            {isMine && isLastOfMine && msg.readAt && (
              <span className="text-[11px] text-brand-500 font-medium">Read</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Loading skeleton
  // -------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header skeleton */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-4 w-32 bg-muted animate-pulse rounded" />
            <div className="h-3 w-20 bg-muted animate-pulse rounded" />
          </div>
        </div>
        {/* Messages skeleton */}
        <div className="flex-1 p-4 space-y-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`h-10 rounded-2xl bg-muted animate-pulse ${
                  i % 3 === 0 ? "w-48" : i % 3 === 1 ? "w-64" : "w-36"
                }`}
              />
            </div>
          ))}
        </div>
        {/* Composer skeleton */}
        <div className="px-4 py-3 border-t">
          <div className="h-10 bg-muted animate-pulse rounded-lg" />
        </div>
      </div>
    );
  }

  if (!conversation || !otherParticipant) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <p className="text-muted-foreground mb-3">Conversation not found</p>
          <Button variant="outline" onClick={() => router.push("/messages")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Messages
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* ----------------------------------------------------------------- */}
      {/* Header Bar */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-background shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => router.push("/messages")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <Avatar className="h-9 w-9">
          <AvatarImage src={otherParticipant.avatarUrl || undefined} />
          <AvatarFallback className="bg-brand-500/10 text-brand-600 font-semibold text-sm">
            {otherParticipant.name?.charAt(0)?.toUpperCase() || "?"}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold truncate">
              {otherParticipant.name}
            </h1>
            <Badge
              variant="outline"
              className={`text-[10px] ${getStatusColor(conversation.agentClient.status)}`}
            >
              {conversation.agentClient.status}
            </Badge>
          </div>
        </div>

        {/* Settings gear (client only) */}
        {isClient && (
          <Button variant="ghost" size="icon" onClick={openSettings}>
            <Settings className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Terminated Banner */}
      {/* ----------------------------------------------------------------- */}
      {isTerminated && (
        <div className="px-4 py-2.5 bg-amber-500/10 border-b border-amber-200 text-amber-700 text-sm text-center shrink-0">
          This relationship has been terminated. Messages are read-only.
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Message Area */}
      {/* ----------------------------------------------------------------- */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        {/* Load more button */}
        {hasMore && (
          <div className="flex justify-center mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={loadMore}
              disabled={isLoadingMore}
              className="text-muted-foreground"
            >
              {isLoadingMore ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <ChevronUp className="h-4 w-4 mr-1.5" />
              )}
              Load older messages
            </Button>
          </div>
        )}

        {/* Messages */}
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            No messages yet. Start the conversation!
          </div>
        )}
        {messages.map((msg, i) => renderMessage(msg, i))}

        <div ref={messagesEndRef} />
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Message Composer */}
      {/* ----------------------------------------------------------------- */}
      {isActive && (
        <div className="border-t bg-background px-4 py-3 shrink-0">
          {/* Pending attachment previews */}
          {(pendingAttachments.length > 0 || isUploading) && (
            <div className="flex flex-wrap gap-2 mb-2">
              {pendingAttachments.map((att, i) => (
                <div key={i} className="relative group">
                  {att.type === "image" ? (
                    <img
                      src={att.url}
                      alt={att.name || "Attachment"}
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                  ) : att.type === "video" ? (
                    <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center">
                      <Video className="h-6 w-6 text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center">
                      <FileText className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeAttachment(i)}
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {isUploading && (
                <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          )}

          <div className="flex items-end gap-2">
            {/* Attachment button */}
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 mb-0.5"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <Paperclip className="h-5 w-5" />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,video/*,.pdf"
              multiple
              onChange={handleFileSelect}
            />

            {/* Request Approval button (agent only) */}
            {isAgent && (
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 mb-0.5"
                onClick={() => setShowApprovalDialog(true)}
                title="Request content approval"
              >
                <ClipboardCheck className="h-5 w-5" />
              </Button>
            )}

            {/* Textarea */}
            <Textarea
              ref={textareaRef}
              value={messageText}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="flex-1 resize-none min-h-[40px] max-h-[120px] text-sm py-2.5"
              rows={1}
            />

            {/* Send button */}
            <Button
              size="icon"
              className="shrink-0 mb-0.5 bg-brand-500 hover:bg-brand-600 text-white"
              onClick={sendMessage}
              disabled={
                isSending ||
                (messageText.trim() === "" && pendingAttachments.length === 0)
              }
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Approval Request Dialog (Agent) */}
      {/* ----------------------------------------------------------------- */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-brand-500" />
              Request Content Approval
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Post content */}
            <div className="space-y-1.5">
              <Label>Post Content</Label>
              <Textarea
                value={approvalPostContent}
                onChange={(e) => setApprovalPostContent(e.target.value)}
                placeholder="Write the post content for your client to review..."
                className="min-h-[100px]"
              />
            </div>

            {/* Media upload */}
            <div className="space-y-1.5">
              <Label>Media (optional)</Label>
              <div className="flex flex-wrap gap-2">
                {approvalMediaUrls.map((url, i) => (
                  <div key={i} className="relative group">
                    {isImageUrl(url) ? (
                      <img
                        src={url}
                        alt={`Media ${i + 1}`}
                        className="h-20 w-20 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="h-20 w-20 rounded-lg bg-muted flex items-center justify-center">
                        <Video className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setApprovalMediaUrls((prev) =>
                          prev.filter((_, idx) => idx !== i)
                        )
                      }
                      className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => approvalMediaInputRef.current?.click()}
                  disabled={isUploadingApprovalMedia}
                  className="h-20 w-20 rounded-lg border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center text-muted-foreground hover:border-brand-500/50 hover:text-brand-500 transition-colors"
                >
                  {isUploadingApprovalMedia ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <ImageIcon className="h-5 w-5" />
                      <span className="text-[10px] mt-1">Add</span>
                    </>
                  )}
                </button>
              </div>
              <input
                ref={approvalMediaInputRef}
                type="file"
                className="hidden"
                accept="image/*,video/*"
                multiple
                onChange={handleApprovalMediaSelect}
              />
            </div>

            {/* Platforms */}
            <div className="space-y-1.5">
              <Label>Platforms</Label>
              <div className="flex flex-wrap gap-3">
                {PLATFORM_OPTIONS.map((p) => (
                  <label
                    key={p.value}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Checkbox
                      checked={approvalPlatforms.includes(p.value)}
                      onCheckedChange={(checked) => {
                        setApprovalPlatforms((prev) =>
                          checked
                            ? [...prev, p.value]
                            : prev.filter((v) => v !== p.value)
                        );
                      }}
                    />
                    <span className="text-sm">{p.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Scheduled date/time */}
            <div className="space-y-1.5">
              <Label>Schedule (optional)</Label>
              <Input
                type="datetime-local"
                value={approvalScheduledAt}
                onChange={(e) => setApprovalScheduledAt(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowApprovalDialog(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-brand-500 hover:bg-brand-600 text-white"
              onClick={submitApprovalRequest}
              disabled={isSubmittingApproval || approvalPlatforms.length === 0}
            >
              {isSubmittingApproval ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send for Approval
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ----------------------------------------------------------------- */}
      {/* Approval Settings Dialog (Client) */}
      {/* ----------------------------------------------------------------- */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Approval Settings</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {(
              [
                { value: "ALL", label: "All posts require approval" },
                { value: "MEDIA_ONLY", label: "Only posts with media" },
                { value: "PLATFORM_SPECIFIC", label: "Specific platforms only" },
                { value: "NONE", label: "No approval needed" },
              ] as const
            ).map((option) => (
              <label
                key={option.value}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  settingsMode === option.value
                    ? "border-brand-500 bg-brand-500/5"
                    : "border-border hover:border-brand-500/30"
                }`}
              >
                <input
                  type="radio"
                  name="approvalMode"
                  value={option.value}
                  checked={settingsMode === option.value}
                  onChange={() => setSettingsMode(option.value)}
                  className="accent-brand-500"
                />
                <span className="text-sm font-medium">{option.label}</span>
              </label>
            ))}

            {/* Platform checkboxes when PLATFORM_SPECIFIC is selected */}
            {settingsMode === "PLATFORM_SPECIFIC" && (
              <div className="pl-6 space-y-2 pt-1">
                {PLATFORM_OPTIONS.map((p) => (
                  <label
                    key={p.value}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Checkbox
                      checked={settingsPlatforms.includes(p.value)}
                      onCheckedChange={(checked) => {
                        setSettingsPlatforms((prev) =>
                          checked
                            ? [...prev, p.value]
                            : prev.filter((v) => v !== p.value)
                        );
                      }}
                    />
                    <span className="text-sm">{p.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSettingsDialog(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-brand-500 hover:bg-brand-600 text-white"
              onClick={saveSettings}
              disabled={isSavingSettings}
            >
              {isSavingSettings ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Settings"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
