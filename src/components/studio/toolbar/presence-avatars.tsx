"use client";

import { useState } from "react";
import { Users, Eye, Pencil, Crown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import type { CollabUser } from "../hooks/use-collaboration";

interface PresenceAvatarsProps {
  users: CollabUser[];
  isConnected: boolean;
}

const ROLE_COLORS: Record<string, string> = {
  OWNER: "ring-amber-500",
  EDITOR: "ring-green-500",
  VIEWER: "ring-blue-500",
};

const ROLE_ICONS: Record<string, typeof Eye> = {
  OWNER: Crown,
  EDITOR: Pencil,
  VIEWER: Eye,
};

const MAX_VISIBLE = 4;

export function PresenceAvatars({ users, isConnected }: PresenceAvatarsProps) {
  const [open, setOpen] = useState(false);

  if (users.length <= 1) return null; // Only show when 2+ users

  const visible = users.slice(0, MAX_VISIBLE);
  const overflow = users.length - MAX_VISIBLE;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center -space-x-2 hover:opacity-90 transition-opacity">
          {visible.map((user) => (
            <div
              key={user.userId}
              className={`relative w-7 h-7 rounded-full ring-2 ${ROLE_COLORS[user.role] || "ring-gray-400"} bg-muted flex items-center justify-center overflow-hidden`}
              title={`${user.userName} (${user.role.toLowerCase()})`}
            >
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.userName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-[10px] font-semibold text-muted-foreground">
                  {user.userName?.[0]?.toUpperCase() || "?"}
                </span>
              )}
            </div>
          ))}

          {overflow > 0 && (
            <div className="w-7 h-7 rounded-full ring-2 ring-border bg-muted flex items-center justify-center">
              <span className="text-[10px] font-semibold text-muted-foreground">
                +{overflow}
              </span>
            </div>
          )}

          {/* Connection indicator */}
          <div
            className={`w-2 h-2 rounded-full ml-1.5 ${
              isConnected ? "bg-green-500" : "bg-red-500"
            }`}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-64 p-2" align="center">
        <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            {users.length} online
          </span>
        </div>

        <div className="space-y-0.5">
          {users.map((user) => {
            const RoleIcon = ROLE_ICONS[user.role] || Eye;
            return (
              <div
                key={user.userId}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted/50"
              >
                <div
                  className={`w-7 h-7 rounded-full ring-2 ${ROLE_COLORS[user.role] || "ring-gray-400"} bg-muted flex items-center justify-center overflow-hidden shrink-0`}
                >
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      {user.userName?.[0]?.toUpperCase() || "?"}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{user.userName}</p>
                </div>
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 gap-0.5">
                  <RoleIcon className="w-2.5 h-2.5" />
                  {user.role.toLowerCase()}
                </Badge>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
