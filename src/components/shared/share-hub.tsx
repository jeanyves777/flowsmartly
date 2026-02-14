"use client";

import { useState } from "react";
import {
  Facebook,
  Twitter,
  Linkedin,
  MessageCircle,
  Link2,
  Check,
  Share2,
  Send,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface ShareHubProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  postContent?: string;
  onShareComplete?: (platform: string, newShareCount: number) => void;
}

const PLATFORMS = [
  {
    id: "facebook",
    name: "Facebook",
    icon: Facebook,
    color: "bg-blue-600 hover:bg-blue-700",
    getUrl: (url: string) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    id: "twitter",
    name: "X (Twitter)",
    icon: Twitter,
    color: "bg-black hover:bg-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700",
    getUrl: (url: string, text: string) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: Linkedin,
    color: "bg-blue-700 hover:bg-blue-800",
    getUrl: (url: string) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    icon: MessageCircle,
    color: "bg-green-500 hover:bg-green-600",
    getUrl: (url: string, text: string) =>
      `https://wa.me/?text=${encodeURIComponent(text + " " + url)}`,
  },
  {
    id: "telegram",
    name: "Telegram",
    icon: Send,
    color: "bg-sky-500 hover:bg-sky-600",
    getUrl: (url: string, text: string) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
];

export function ShareHub({
  open,
  onOpenChange,
  postId,
  postContent = "",
  onShareComplete,
}: ShareHubProps) {
  const { toast } = useToast();
  const [copiedLink, setCopiedLink] = useState(false);
  const [sharingPlatform, setSharingPlatform] = useState<string | null>(null);

  const postUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/post/${postId}`;
  const shareText = postContent.length > 100
    ? postContent.substring(0, 97) + "..."
    : postContent;

  const recordShare = async (platform: string) => {
    try {
      const response = await fetch(`/api/posts/${postId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      const data = await response.json();

      if (data.success && onShareComplete) {
        onShareComplete(platform, data.data.shareCount);
      }
    } catch {
      // Silently fail - sharing still happened externally
    }
  };

  const handlePlatformShare = async (platform: typeof PLATFORMS[number]) => {
    setSharingPlatform(platform.id);

    // Try Web Share API on mobile first
    if (platform.id === "native" && navigator.share) {
      try {
        await navigator.share({
          title: "Check out this post",
          text: shareText,
          url: postUrl,
        });
        await recordShare("native");
        toast({ title: "Shared successfully!" });
        onOpenChange(false);
        return;
      } catch {
        // User cancelled or Web Share API not supported
      }
    }

    // Open platform share URL in a new window
    const shareUrl = platform.getUrl(postUrl, shareText);
    window.open(shareUrl, "_blank", "width=600,height=400,noopener,noreferrer");

    await recordShare(platform.id);
    toast({ title: `Shared to ${platform.name}!` });
    setSharingPlatform(null);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(postUrl);
      setCopiedLink(true);
      await recordShare("copy_link");
      toast({ title: "Link copied to clipboard!" });
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast({ title: "Failed to copy link", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-brand-500" />
            Share Post
          </DialogTitle>
          <DialogDescription>
            Share this post to your social media platforms
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-4">
          {PLATFORMS.map((platform) => {
            const Icon = platform.icon;
            return (
              <Button
                key={platform.id}
                variant="outline"
                className="h-auto py-4 flex flex-col items-center gap-2"
                onClick={() => handlePlatformShare(platform)}
                disabled={sharingPlatform === platform.id}
              >
                <div
                  className={`w-10 h-10 rounded-full ${platform.color} flex items-center justify-center`}
                >
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs font-medium">{platform.name}</span>
              </Button>
            );
          })}

          {/* Copy Link */}
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col items-center gap-2"
            onClick={handleCopyLink}
          >
            <div className="w-10 h-10 rounded-full bg-gray-500 hover:bg-gray-600 flex items-center justify-center">
              {copiedLink ? (
                <Check className="w-5 h-5 text-white" />
              ) : (
                <Link2 className="w-5 h-5 text-white" />
              )}
            </div>
            <span className="text-xs font-medium">
              {copiedLink ? "Copied!" : "Copy Link"}
            </span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
