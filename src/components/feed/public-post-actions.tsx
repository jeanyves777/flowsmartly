"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Heart, MessageCircle, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface PublicPostActionsProps {
  postId: string;
  postUrl: string;
  destinationUrl?: string | null;
  ctaText?: string | null;
}

export function PublicPostActions({
  postId,
  postUrl,
  destinationUrl,
  ctaText,
}: PublicPostActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [openingCta, setOpeningCta] = useState(false);

  const loginUrl = useMemo(
    () => `/login?redirect=${encodeURIComponent(`/post/${postId}`)}`,
    [postId]
  );

  const trackClick = async (
    clickType: "post" | "media" | "profile" | "cta" | "comment" | "share" | "bookmark" | "external",
    href?: string
  ) => {
    try {
      await fetch(`/api/posts/${postId}/analytics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "click",
          clickType,
          href,
          path: `/post/${postId}`,
          source: "public-post",
        }),
      });
    } catch {
      // Analytics should never block the visitor.
    }
  };

  const requireLogin = async (intent: "like" | "comment" | "share") => {
    await trackClick(intent === "like" ? "post" : intent);
    toast({
      title: "Log in to continue",
      description: "Anyone can view this shared post, but reactions and conversations need an account.",
    });
    router.push(`${loginUrl}&intent=${intent}`);
  };

  const handleCopyPublicLink = async () => {
    await trackClick("share", postUrl);
    router.push(`${loginUrl}&intent=share`);
  };

  const handleCta = async () => {
    if (!destinationUrl || openingCta) return;
    setOpeningCta(true);
    await trackClick("cta", destinationUrl);
    window.open(destinationUrl, "_blank", "noopener,noreferrer");
    setOpeningCta(false);
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <div className="grid grid-cols-3 gap-2 sm:flex">
        <Button type="button" variant="outline" onClick={() => requireLogin("like")} className="gap-2">
          <Heart className="h-4 w-4" />
          Like
        </Button>
        <Button type="button" variant="outline" onClick={() => requireLogin("comment")} className="gap-2">
          <MessageCircle className="h-4 w-4" />
          Comment
        </Button>
        <Button type="button" variant="outline" onClick={handleCopyPublicLink} className="gap-2">
          <Share2 className="h-4 w-4" />
          Share
        </Button>
      </div>
      {destinationUrl && (
        <Button type="button" onClick={handleCta} disabled={openingCta} className="gap-2 bg-brand-500 text-white hover:bg-brand-600">
          <ExternalLink className="h-4 w-4" />
          {ctaText || "Open link"}
        </Button>
      )}
    </div>
  );
}
