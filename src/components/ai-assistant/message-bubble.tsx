"use client";

import { useState } from "react";
import { Check, Copy, Download, Rss, Loader2, X } from "lucide-react";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
  mediaType?: string | null;
  mediaUrl?: string | null;
  messageId?: string;
}

/**
 * Simple markdown-to-JSX renderer for assistant messages
 */
function renderMarkdown(text: string) {
  // Split into lines and process
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeContent: string[] = [];
  let listItems: string[] = [];
  let listType: "ul" | "ol" | null = null;

  const flushList = () => {
    if (listItems.length > 0 && listType) {
      const Tag = listType;
      elements.push(
        <Tag key={elements.length} className={listType === "ul" ? "list-disc ml-4 my-1 space-y-0.5" : "list-decimal ml-4 my-1 space-y-0.5"}>
          {listItems.map((item, i) => (
            <li key={i} className="text-sm">{formatInline(item)}</li>
          ))}
        </Tag>
      );
      listItems = [];
      listType = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <pre key={elements.length} className="bg-black/10 dark:bg-white/10 rounded-lg p-3 my-2 overflow-x-auto text-xs font-mono">
            <code>{codeContent.join("\n")}</code>
          </pre>
        );
        codeContent = [];
        inCodeBlock = false;
      } else {
        flushList();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent.push(line);
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const Tag = level === 1 ? "h3" : level === 2 ? "h4" : "h5";
      const cls = level === 1 ? "font-bold text-sm mt-3 mb-1" : level === 2 ? "font-semibold text-sm mt-2 mb-1" : "font-medium text-sm mt-2 mb-0.5";
      elements.push(<Tag key={elements.length} className={cls}>{formatInline(text)}</Tag>);
      continue;
    }

    // Unordered list
    const ulMatch = line.match(/^[\s]*[-*]\s+(.+)/);
    if (ulMatch) {
      if (listType === "ol") flushList();
      listType = "ul";
      listItems.push(ulMatch[1]);
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^[\s]*\d+\.\s+(.+)/);
    if (olMatch) {
      if (listType === "ul") flushList();
      listType = "ol";
      listItems.push(olMatch[1]);
      continue;
    }

    flushList();

    // Empty line
    if (!line.trim()) {
      continue;
    }

    // Paragraph
    elements.push(
      <p key={elements.length} className="text-sm my-1">{formatInline(line)}</p>
    );
  }

  flushList();

  return elements;
}

/** Format inline markdown: bold, italic, inline code */
function formatInline(text: string): React.ReactNode {
  // Split by inline code first
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i} className="bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
    }
    // Bold
    let formatted: React.ReactNode = part;
    const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
    if (boldParts.length > 1) {
      formatted = boldParts.map((bp, j) => {
        if (bp.startsWith("**") && bp.endsWith("**")) {
          return <strong key={j}>{bp.slice(2, -2)}</strong>;
        }
        return bp;
      });
    }
    return <span key={i}>{formatted}</span>;
  });
}

function MediaActions({
  mediaUrl,
  mediaType,
  messageId,
}: {
  mediaUrl: string;
  mediaType: string;
  messageId?: string;
}) {
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState(false);
  const [showCaption, setShowCaption] = useState(false);
  const [caption, setCaption] = useState("");

  const handleDownload = async () => {
    try {
      const res = await fetch(mediaUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `flowai-${mediaType === "video" ? "video.mp4" : "image.png"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: open in new tab
      window.open(mediaUrl, "_blank");
    }
  };

  const handlePostToFeed = async () => {
    if (!messageId) return;
    setPosting(true);
    try {
      const res = await fetch("/api/ai/assistant/post-to-feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, caption: caption || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setPosted(true);
        setShowCaption(false);
      }
    } catch {
      // Silently fail
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="mt-2">
      {showCaption && (
        <div className="flex items-center gap-2 mb-2">
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a caption..."
            className="flex-1 text-xs rounded-lg border border-border bg-background px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
            onKeyDown={(e) => {
              if (e.key === "Enter") handlePostToFeed();
            }}
          />
          <button
            onClick={handlePostToFeed}
            disabled={posting}
            className="text-xs px-3 py-1.5 rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {posting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Post"}
          </button>
          <button
            onClick={() => setShowCaption(false)}
            className="p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={handleDownload}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50"
        >
          <Download className="w-3.5 h-3.5" />
          Download
        </button>
        {messageId && !posted && (
          <button
            onClick={() => setShowCaption(!showCaption)}
            disabled={posting}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50"
          >
            <Rss className="w-3.5 h-3.5" />
            Post to Feed
          </button>
        )}
        {posted && (
          <span className="flex items-center gap-1.5 text-xs text-green-500 px-2 py-1">
            <Check className="w-3.5 h-3.5" />
            Posted!
          </span>
        )}
      </div>
    </div>
  );
}

function InlineMedia({
  mediaType,
  mediaUrl,
  messageId,
}: {
  mediaType: string;
  mediaUrl: string;
  messageId?: string;
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (mediaType === "image") {
    return (
      <div className="mt-2">
        <div className="relative rounded-xl overflow-hidden bg-muted/30 max-w-[320px]">
          {!imageLoaded && (
            <div className="w-full h-48 animate-pulse bg-muted/50 rounded-xl" />
          )}
          <img
            src={mediaUrl}
            alt="AI generated image"
            className={`w-full rounded-xl cursor-pointer hover:opacity-90 transition-opacity ${
              !imageLoaded ? "hidden" : ""
            }`}
            onLoad={() => setImageLoaded(true)}
            onClick={() => setExpanded(true)}
          />
        </div>
        <MediaActions mediaUrl={mediaUrl} mediaType={mediaType} messageId={messageId} />

        {/* Lightbox */}
        {expanded && (
          <div
            className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
            onClick={() => setExpanded(false)}
          >
            <button
              onClick={() => setExpanded(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={mediaUrl}
              alt="AI generated image"
              className="max-w-full max-h-[90vh] rounded-xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </div>
    );
  }

  if (mediaType === "video") {
    return (
      <div className="mt-2">
        <div className="rounded-xl overflow-hidden bg-black max-w-[360px]">
          <video
            src={mediaUrl}
            controls
            className="w-full rounded-xl"
            preload="metadata"
          />
        </div>
        <MediaActions mediaUrl={mediaUrl} mediaType={mediaType} messageId={messageId} />
      </div>
    );
  }

  return null;
}

export function MessageBubble({ role, content, createdAt, mediaType, mediaUrl, messageId }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = role === "user";

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex items-start gap-2 px-4 py-1.5 group ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center shrink-0 mt-1">
          <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
          </svg>
        </div>
      )}

      {/* Bubble */}
      <div className={`max-w-[85%] relative ${isUser ? "ml-auto" : ""}`}>
        <div
          className={`rounded-2xl px-4 py-2.5 ${
            isUser
              ? "bg-brand-500 text-white rounded-tr-sm"
              : "bg-muted/60 text-foreground rounded-tl-sm"
          }`}
        >
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap">{content}</p>
          ) : (
            <div className="prose-sm">{renderMarkdown(content)}</div>
          )}

          {/* Inline Media */}
          {!isUser && mediaType && mediaUrl && (
            <InlineMedia
              mediaType={mediaType}
              mediaUrl={mediaUrl}
              messageId={messageId}
            />
          )}
        </div>

        {/* Actions (assistant only) */}
        {!isUser && content && (
          <button
            onClick={handleCopy}
            className="absolute -bottom-5 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground p-1 rounded"
            title="Copy"
          >
            {copied ? (
              <Check className="w-3 h-3 text-green-500" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </button>
        )}

        {/* Timestamp */}
        {createdAt && (
          <span className="absolute -bottom-5 left-1 text-[10px] text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity">
            {new Date(createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>
    </div>
  );
}
