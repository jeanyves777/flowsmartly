"use client";

import React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * RichText — a tiny, dependency-free, XSS-safe markdown renderer for
 * Flow-AI chat messages. The agent (Claude) emits markdown — **bold**,
 * bullet lists, `code`, numbered steps, links — and rendering it as raw
 * text showed literal `*` asterisks (the 2026-05-28 bug).
 *
 * We deliberately do NOT pull in react-markdown/remark (heavy + another
 * server install). This handles the subset Claude actually produces and
 * builds real React nodes (never dangerouslySetInnerHTML), so untrusted
 * model output can't inject HTML.
 *
 * Supported:
 *   - Paragraphs (blank-line separated)
 *   - Headings: #, ##, ### → bold sized text
 *   - Unordered lists: lines starting with -, *, •
 *   - Ordered lists: lines starting with "1." etc.
 *   - Inline: **bold**, *italic* / _italic_, `code`, [text](url)
 *   - Raw URLs auto-linked
 *   - Line breaks preserved
 */

export function RichText({ text, className }: { text: string; className?: string }) {
  if (!text) return null;
  const blocks = parseBlocks(text);
  return (
    <div className={cn("space-y-1.5 text-sm leading-relaxed break-words", className)}>
      {blocks.map((block, i) => renderBlock(block, i))}
    </div>
  );
}

type Block =
  | { type: "p"; lines: string[] }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "h"; level: number; text: string };

function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === "") {
      i++;
      continue;
    }

    // Heading
    const h = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      blocks.push({ type: "h", level: h[1].length, text: h[2] });
      i++;
      continue;
    }

    // Unordered list — bullet lines (blank lines BETWEEN items are tolerated
    // so spaced-out lists stay one list).
    if (/^[-*•]\s+/.test(trimmed)) {
      const r = collectListItems(lines, i, /^[-*•]\s+/);
      blocks.push({ type: "ul", items: r.items });
      i = r.next;
      continue;
    }

    // Ordered list — "N." lines. Models often put a blank line between items,
    // which previously split them into separate <ol>s that each restarted at
    // 1 (the "1. 1. 1." bug). Collect across blank lines so they number 1,2,3.
    if (/^\d+\.\s+/.test(trimmed)) {
      const r = collectListItems(lines, i, /^\d+\.\s+/);
      blocks.push({ type: "ol", items: r.items });
      i = r.next;
      continue;
    }

    // Paragraph — collect consecutive non-blank, non-special lines
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,3})\s+/.test(lines[i].trim()) &&
      !/^[-*•]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim())
    ) {
      para.push(lines[i].trim());
      i++;
    }
    blocks.push({ type: "p", lines: para });
  }
  return blocks;
}

/**
 * Collect consecutive list items of one kind, tolerating blank lines BETWEEN
 * items (models often double-space them). Returns the items + the next line
 * index to resume from. Keeps spaced lists as ONE list so an ordered list
 * numbers 1,2,3 instead of restarting at 1 each item.
 */
function collectListItems(
  lines: string[],
  start: number,
  marker: RegExp,
): { items: string[]; next: number } {
  const items: string[] = [];
  let i = start;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (marker.test(t)) {
      items.push(t.replace(marker, ""));
      i++;
    } else if (t === "") {
      // Peek past blank line(s): continue the list only if another item follows.
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === "") j++;
      if (j < lines.length && marker.test(lines[j].trim())) {
        i = j;
      } else {
        break;
      }
    } else {
      break;
    }
  }
  return { items, next: i };
}

function renderBlock(block: Block, key: number): React.ReactNode {
  switch (block.type) {
    case "h": {
      const sizeClass =
        block.level === 1 ? "text-base font-bold" : block.level === 2 ? "text-sm font-bold" : "text-sm font-semibold";
      return (
        <div key={key} className={cn(sizeClass, "text-foreground mt-1")}>
          {renderInline(block.text)}
        </div>
      );
    }
    case "ul":
      return (
        <ul key={key} className="list-disc pl-5 space-y-0.5">
          {block.items.map((it, j) => (
            <li key={j}>{renderInline(it)}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol key={key} className="list-decimal pl-5 space-y-0.5">
          {block.items.map((it, j) => (
            <li key={j}>{renderInline(it)}</li>
          ))}
        </ol>
      );
    case "p":
      return (
        <p key={key} className="whitespace-pre-wrap">
          {block.lines.map((ln, j) => (
            <React.Fragment key={j}>
              {renderInline(ln)}
              {j < block.lines.length - 1 ? <br /> : null}
            </React.Fragment>
          ))}
        </p>
      );
  }
}

/**
 * Inline tokenizer — handles bold, italic, inline code, markdown links,
 * and bare URLs. Returns an array of React nodes.
 */
function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Order matters: code first (so we don't format inside it), then links,
  // then bold, then italic, then bare urls.
  const pattern =
    /(`[^`]+`)|(\[[^\]]+\]\([^)]+\))|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(_[^_]+_)|(https?:\/\/[^\s)]+)/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > lastIndex) {
      nodes.push(text.slice(lastIndex, m.index));
    }
    const token = m[0];
    if (token.startsWith("`")) {
      nodes.push(
        <code key={k++} className="px-1 py-0.5 rounded bg-muted text-[0.85em] font-mono">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("[")) {
      const lm = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (lm) {
        nodes.push(
          <a key={k++} href={safeHref(lm[2])} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline underline-offset-2">
            {lm[1]}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={k++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      nodes.push(<em key={k++}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("_")) {
      nodes.push(<em key={k++}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("http")) {
      // If the model slipped a raw asset URL into its reply (it shouldn't —
      // finished media renders as a card), show it as an inline thumbnail
      // instead of a giant presigned-URL link wall.
      if (looksLikeImageUrl(token)) {
        nodes.push(
          <a key={k++} href={safeHref(token)} target="_blank" rel="noopener noreferrer" className="block my-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={token}
              alt="Generated media"
              referrerPolicy="no-referrer"
              className="max-h-72 w-auto rounded-lg border border-border object-contain"
            />
          </a>,
        );
      } else {
        nodes.push(
          <a key={k++} href={safeHref(token)} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline underline-offset-2 break-all">
            {token}
          </a>,
        );
      }
    }
    lastIndex = m.index + token.length;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

/** Does this URL point at an image we can render inline? */
function looksLikeImageUrl(url: string): boolean {
  const path = url.split("?")[0].toLowerCase();
  if (/\.(png|jpe?g|webp|gif|avif)$/.test(path)) return true;
  // Our own media buckets/paths serve images even when the extension is
  // hidden behind a presigned query string.
  return /flowsmartly-media|\/flow-ai\/|\/designs\//.test(url);
}

function safeHref(url: string): string {
  // Only allow http(s) + relative paths — block javascript:/data: schemes.
  if (/^https?:\/\//i.test(url) || url.startsWith("/")) return url;
  return "#";
}

/** Animated three-dot "typing" indicator shown while the agent works. */
export function TypingDots({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)} aria-label="Flow-AI is typing">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-blue-500/70 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.9s" }}
        />
      ))}
    </span>
  );
}
