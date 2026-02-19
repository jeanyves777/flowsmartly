"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { MessageCircle, Mail, ClipboardCheck, Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OtherParticipant {
  id: string;
  name: string;
  avatarUrl: string | null;
}

interface Conversation {
  id: string;
  agentClientId: string;
  lastMessageAt: string;
  lastMessageText: string;
  unreadCount: number;
  otherParticipant: OtherParticipant;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "...";
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function MessagesPage() {
  const router = useRouter();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/messages");
      const data = await res.json();
      if (data.success) {
        setConversations(data.data);
      }
    } catch {
      // Silently fail on polling errors
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Poll every 5 seconds
  useEffect(() => {
    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  // -------------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------------

  // Sort by lastMessageAt desc, then apply search filter
  const sortedConversations = [...conversations].sort(
    (a, b) =>
      new Date(b.lastMessageAt).getTime() -
      new Date(a.lastMessageAt).getTime()
  );

  const filteredConversations = sortedConversations.filter((conv) =>
    conv.otherParticipant.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  const totalConversations = conversations.length;
  const totalUnread = conversations.reduce(
    (sum, conv) => sum + conv.unreadCount,
    0
  );
  const pendingApprovals = 0; // Placeholder — computed from separate source if needed

  // -------------------------------------------------------------------------
  // Stats cards config
  // -------------------------------------------------------------------------

  const statCards = [
    {
      label: "Total Conversations",
      value: totalConversations,
      icon: MessageCircle,
      color: "blue",
    },
    {
      label: "Unread Messages",
      value: totalUnread,
      icon: Mail,
      color: "amber",
    },
    {
      label: "Pending Approvals",
      value: pendingApprovals,
      icon: ClipboardCheck,
      color: "purple",
    },
  ] as const;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="flex-1 flex flex-col space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-white" />
          </div>
          Messages
        </h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "p-2 rounded-lg",
                    stat.color === "blue" && "bg-blue-500/10",
                    stat.color === "amber" && "bg-amber-500/10",
                    stat.color === "purple" && "bg-purple-500/10"
                  )}
                >
                  <stat.icon
                    className={cn(
                      "h-5 w-5",
                      stat.color === "blue" && "text-blue-500",
                      stat.color === "amber" && "text-amber-500",
                      stat.color === "purple" && "text-purple-500"
                    )}
                  />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Conversation List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                  <Skeleton className="h-3 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredConversations.length === 0 && conversations.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <MessageCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="font-medium text-lg">No conversations yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Conversations will appear here when you hire an agent or get hired
              as one
            </p>
          </CardContent>
        </Card>
      ) : filteredConversations.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Search className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No conversations match your search</p>
            <p className="text-sm mt-1">
              Try a different name or clear the search filter
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredConversations.map((conv) => (
            <Card
              key={conv.id}
              className={cn(
                "cursor-pointer hover:border-brand-500/50 hover:shadow-sm transition-all",
                conv.unreadCount > 0 && "bg-brand-50/5 border-brand-500/20"
              )}
              onClick={() => router.push(`/messages/${conv.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <Avatar className="h-10 w-10 shrink-0">
                    {conv.otherParticipant.avatarUrl && (
                      <AvatarImage
                        src={conv.otherParticipant.avatarUrl}
                        alt={conv.otherParticipant.name}
                      />
                    )}
                    <AvatarFallback className="text-xs bg-brand-500/10 text-brand-500">
                      {getInitials(conv.otherParticipant.name)}
                    </AvatarFallback>
                  </Avatar>

                  {/* Name + Last message */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p
                        className={cn(
                          "text-sm truncate",
                          conv.unreadCount > 0
                            ? "font-semibold"
                            : "font-medium"
                        )}
                      >
                        {conv.otherParticipant.name}
                      </p>
                      {conv.unreadCount > 0 && (
                        <Badge className="bg-blue-500 hover:bg-blue-600 text-white text-[10px] px-1.5 py-0 h-5 min-w-[20px] flex items-center justify-center rounded-full">
                          {conv.unreadCount}
                        </Badge>
                      )}
                    </div>
                    <p
                      className={cn(
                        "text-sm mt-0.5 truncate",
                        conv.unreadCount > 0
                          ? "text-foreground/80"
                          : "text-muted-foreground"
                      )}
                    >
                      {truncateText(conv.lastMessageText, 80)}
                    </p>
                  </div>

                  {/* Timestamp */}
                  <p className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                    {formatDistanceToNow(new Date(conv.lastMessageAt), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
