"use client";

import { useState } from "react";
import {
  Image as ImageIcon,
  Send,
  Loader2,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { MediaUploader } from "@/components/shared/media-uploader";
import type { WhatsAppAccount } from "./types";

interface WhatsAppStatusProps {
  account: WhatsAppAccount;
}

export function WhatsAppStatus({ account }: WhatsAppStatusProps) {
  const { toast } = useToast();
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState(false);

  function getMediaType(): "image" | "video" {
    if (mediaUrls.length === 0) return "image";
    const url = mediaUrls[0].toLowerCase();
    if (/\.(mp4|webm|mov|avi)/.test(url) || url.includes("/video/")) return "video";
    return "image";
  }

  async function handlePost() {
    if (mediaUrls.length === 0) {
      toast({ title: "Please upload an image or video", variant: "destructive" });
      return;
    }

    setPosting(true);
    try {
      const res = await fetch("/api/whatsapp/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          socialAccountId: account.id,
          mediaType: getMediaType(),
          mediaUrl: mediaUrls[0],
          caption: caption.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setPosted(true);
        toast({ title: "Status posted!", description: "Your WhatsApp Status has been published." });
        // Reset after a moment
        setTimeout(() => {
          setMediaUrls([]);
          setCaption("");
          setPosted(false);
        }, 3000);
      } else {
        toast({
          title: "Failed to post",
          description: data.error || "Could not post to WhatsApp Status",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Error", description: "Network error posting status", variant: "destructive" });
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div>
        <h3 className="font-semibold">Post to WhatsApp Status</h3>
        <p className="text-xs text-muted-foreground">
          Share images or videos to your WhatsApp Status for{" "}
          <span className="font-medium">{account.platformDisplayName}</span>
        </p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-5">
          {posted ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="font-semibold text-lg mb-1">Status Posted!</h3>
              <p className="text-sm text-muted-foreground">
                Your status is now visible to your contacts.
              </p>
            </div>
          ) : (
            <>
              {/* Media Upload */}
              <div>
                <label className="text-sm font-medium mb-2 block">Media</label>
                <MediaUploader
                  value={mediaUrls}
                  onChange={setMediaUrls}
                  multiple={false}
                  accept="image/png,image/jpeg,image/jpg,image/webp,video/mp4,video/webm"
                  filterTypes={["image", "video"]}
                  maxSize={16 * 1024 * 1024}
                  variant="large"
                  placeholder="Upload image or video"
                  disabled={posting}
                />
              </div>

              {/* Caption */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Caption (optional)</label>
                <Textarea
                  placeholder="Write a caption for your status..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={3}
                  disabled={posting}
                  maxLength={700}
                />
                <p className="text-[10px] text-muted-foreground mt-1 text-right">
                  {caption.length}/700
                </p>
              </div>

              {/* Post Button */}
              <Button
                className="w-full bg-green-500 hover:bg-green-600"
                onClick={handlePost}
                disabled={mediaUrls.length === 0 || posting}
                size="lg"
              >
                {posting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Posting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Post to Status
                  </>
                )}
              </Button>

              <p className="text-[10px] text-muted-foreground text-center">
                Status updates are visible for 24 hours and are end-to-end encrypted
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
