"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  CheckCheck,
  CreditCard,
  ExternalLink,
  Globe,
  Heart,
  MessageSquare,
  Target,
  Trash2,
  User,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";
import {
  isExternalNotificationActionUrl,
  normalizeNotificationActionUrl,
} from "@/lib/navigation/notification-url";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  actionUrl?: string | null;
  read: boolean;
  createdAt: string;
};

function getNotificationIcon(type: string): LucideIcon {
  if (type.includes("LIKE")) return Heart;
  if (type.includes("COMMENT")) return MessageSquare;
  if (type.includes("FOLLOW")) return User;
  if (type.includes("CREDIT") || type.includes("PAYMENT") || type.includes("SUBSCRIPTION")) return CreditCard;
  if (type.includes("STRATEGY") || type.includes("MILESTONE")) return Target;
  if (type.includes("DOMAIN")) return Globe;
  if (type.includes("SMS") || type.includes("MESSAGE")) return MessageSquare;
  return Bell;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/notifications?limit=50");
      const data = await response.json();
      if (data.success) {
        setNotifications(data.data.notifications || []);
        setUnreadCount(data.data.unreadCount || 0);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (ids?: string[]) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ids ? { notificationIds: ids } : { markAll: true }),
    });
    if (ids) {
      setNotifications((current) => current.map((item) => ids.includes(item.id) ? { ...item, read: true } : item));
      setUnreadCount((current) => Math.max(0, current - ids.length));
    } else {
      setNotifications((current) => current.map((item) => ({ ...item, read: true })));
      setUnreadCount(0);
    }
  };

  const deleteNotification = async (id: string) => {
    await fetch(`/api/notifications?ids=${id}`, { method: "DELETE" });
    const deleted = notifications.find((item) => item.id === id);
    setNotifications((current) => current.filter((item) => item.id !== id));
    if (deleted && !deleted.read) setUnreadCount((current) => Math.max(0, current - 1));
  };

  const openNotification = async (notification: NotificationItem) => {
    if (!notification.read) await markAsRead([notification.id]);
    const targetUrl = normalizeNotificationActionUrl(notification.actionUrl);
    if (isExternalNotificationActionUrl(targetUrl)) {
      window.open(targetUrl, "_blank", "noopener,noreferrer");
    } else {
      router.push(targetUrl);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-col gap-3 rounded-lg border bg-background p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600">
            <Bell className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold">Notifications</h1>
            <p className="text-sm text-muted-foreground">
              {unreadCount ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}` : "Everything is read"}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => markAsRead()} disabled={unreadCount === 0}>
          <CheckCheck className="mr-2 h-4 w-4" />
          Mark all read
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border bg-background shadow-sm">
        {isLoading ? (
          <div className="space-y-3 p-4">
            {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-20 w-full" />)}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex min-h-64 items-center justify-center p-8 text-center text-muted-foreground">
            <div>
              <Bell className="mx-auto mb-3 h-10 w-10 opacity-50" />
              <p className="font-medium text-foreground">No notifications yet</p>
              <p className="text-sm">New activity and system updates will appear here.</p>
            </div>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((notification) => {
              const targetUrl = normalizeNotificationActionUrl(notification.actionUrl);
              const external = isExternalNotificationActionUrl(targetUrl);
              const NotificationIcon = getNotificationIcon(notification.type);
              return (
                <div
                  key={notification.id}
                  className={cn("flex gap-3 p-4 transition hover:bg-accent/70", !notification.read && "bg-brand-500/5")}
                >
                  <button
                    type="button"
                    onClick={() => openNotification(notification)}
                    className="flex min-w-0 flex-1 gap-3 text-left"
                  >
                    <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600">
                      <NotificationIcon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className={cn("font-medium", !notification.read && "font-bold")}>{notification.title}</span>
                        {!notification.read && <Badge variant="secondary">Unread</Badge>}
                        {external && <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />}
                      </span>
                      <span className="mt-1 block text-sm text-muted-foreground">{notification.message}</span>
                      <span className="mt-2 block text-xs text-muted-foreground/80">
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </span>
                    </span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteNotification(notification.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
