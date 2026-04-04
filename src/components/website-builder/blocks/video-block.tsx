"use client";

import type { WebsiteBlock, WebsiteTheme, VideoContent } from "@/types/website-builder";
import { Play } from "lucide-react";

interface Props { block: WebsiteBlock; theme: WebsiteTheme; isEditing?: boolean; }

function getEmbedUrl(url: string, type: string): string {
  if (type === "youtube") {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{11})/);
    return match ? `https://www.youtube.com/embed/${match[1]}` : url;
  }
  if (type === "vimeo") {
    const match = url.match(/vimeo\.com\/(\d+)/);
    return match ? `https://player.vimeo.com/video/${match[1]}` : url;
  }
  return url;
}

export function VideoBlock({ block }: Props) {
  const content = block.content as VideoContent;
  const isSplit = block.variant === "with-text";
  const isFullWidth = block.variant === "full-width";

  const videoElement = content.videoUrl ? (
    content.videoType === "upload" ? (
      <video
        src={content.videoUrl}
        poster={content.posterUrl}
        controls
        autoPlay={content.autoplay}
        loop={content.loop}
        muted={content.muted}
        playsInline
        className="w-full aspect-video rounded-xl bg-black"
      />
    ) : (
      <iframe
        src={getEmbedUrl(content.videoUrl, content.videoType)}
        className="w-full aspect-video rounded-xl"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    )
  ) : (
    <div className="w-full aspect-video rounded-xl bg-[var(--wb-surface)] border border-[var(--wb-border)] flex items-center justify-center">
      <Play className="w-16 h-16 text-[var(--wb-text-muted)]/30" />
    </div>
  );

  if (isSplit) {
    return (
      <div className="py-16 sm:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>{videoElement}</div>
          <div>
            {content.headline && <h2 className="text-3xl font-bold mb-4">{content.headline}</h2>}
            {content.description && <p className="text-lg text-[var(--wb-text-muted)]">{content.description}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`py-16 sm:py-24 ${isFullWidth ? "" : "max-w-4xl mx-auto"}`}>
      {content.headline && <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">{content.headline}</h2>}
      {content.description && <p className="text-lg text-[var(--wb-text-muted)] text-center mb-8 max-w-2xl mx-auto">{content.description}</p>}
      {videoElement}
    </div>
  );
}
