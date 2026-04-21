"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Undo,
  Redo,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  className?: string;
  /** Min height of the editor content area (default: 240px). */
  minHeight?: number;
  /** Placeholder when empty. */
  placeholder?: string;
}

/**
 * Lightweight contenteditable rich-text editor. Uses document.execCommand —
 * deprecated but still universally supported and good enough for internal
 * content like business plan sections where we store a narrow HTML subset
 * (h2/h3/p/ul/ol/li/strong/em/blockquote/table).
 *
 * Deliberately does NOT use a heavy editor (Tiptap / Lexical / Slate) —
 * this ships without new dependencies and renders the existing sanitized
 * HTML directly. User sees rendered text, not tags.
 *
 * The editor controls the contenteditable's innerHTML via the `value` prop
 * only on MOUNT — subsequent re-renders from parent don't reset the DOM
 * (which would lose the caret and kill typing). If the parent needs to
 * force a reset, use a `key` prop.
 */
export function RichTextEditor({
  value,
  onChange,
  className,
  minHeight = 240,
  placeholder = "Start typing…",
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isEmpty, setIsEmpty] = useState(!value || value === "<p></p>");

  // Initialize innerHTML once. Subsequent `value` prop changes are ignored
  // to avoid clobbering the user's caret position. Force re-mount via `key`
  // if you need to reset.
  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.innerHTML === "") {
      editorRef.current.innerHTML = value || "";
      setIsEmpty(!editorRef.current.textContent?.trim());
    }
  }, [value]);

  const exec = (cmd: string, arg?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, arg);
    emitChange();
  };

  const emitChange = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    setIsEmpty(!editorRef.current.textContent?.trim());
    onChange(html);
  };

  const handleLink = () => {
    const url = window.prompt("Enter URL:");
    if (url) exec("createLink", url);
  };

  return (
    <div className={cn("rounded-md border border-border bg-background", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 p-1.5 border-b bg-muted/30 flex-wrap">
        <ToolbarButton onClick={() => exec("bold")} label="Bold" shortcut="⌘B">
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec("italic")} label="Italic" shortcut="⌘I">
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarButton onClick={() => exec("formatBlock", "<h2>")} label="Heading 2">
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec("formatBlock", "<h3>")} label="Heading 3">
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec("formatBlock", "<p>")} label="Paragraph">
          <span className="text-xs font-medium">¶</span>
        </ToolbarButton>
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarButton onClick={() => exec("insertUnorderedList")} label="Bullet list">
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec("insertOrderedList")} label="Numbered list">
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec("formatBlock", "<blockquote>")} label="Quote">
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarButton onClick={handleLink} label="Link">
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>
        <div className="ml-auto flex items-center gap-0.5">
          <ToolbarButton onClick={() => exec("undo")} label="Undo" shortcut="⌘Z">
            <Undo className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => exec("redo")} label="Redo" shortcut="⌘⇧Z">
            <Redo className="h-4 w-4" />
          </ToolbarButton>
        </div>
      </div>

      {/* Editor content */}
      <div className="relative">
        {isEmpty && (
          <div className="absolute top-3 left-3 text-muted-foreground text-sm pointer-events-none">
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={emitChange}
          onBlur={emitChange}
          className="rte-content px-3 py-3 focus:outline-none prose prose-sm dark:prose-invert max-w-none"
          style={{ minHeight }}
        />
      </div>

      {/* Minimal prose reset — matches the viewer's .bp-body styles so
          what-you-edit ≈ what-you-see. */}
      <style jsx global>{`
        .rte-content h2 { font-size: 1.25rem; font-weight: 700; margin-top: 1rem; margin-bottom: 0.5rem; }
        .rte-content h3 { font-size: 1.05rem; font-weight: 600; margin-top: 0.75rem; margin-bottom: 0.35rem; }
        .rte-content p { margin-bottom: 0.6rem; line-height: 1.6; }
        .rte-content ul, .rte-content ol { margin-bottom: 0.6rem; padding-left: 1.25rem; list-style: disc; }
        .rte-content ol { list-style: decimal; }
        .rte-content li { margin-bottom: 0.2rem; }
        .rte-content blockquote {
          border-left: 3px solid hsl(var(--primary));
          padding-left: 0.75rem;
          color: hsl(var(--muted-foreground));
          font-style: italic;
          margin: 0.75rem 0;
        }
        .rte-content table { width: 100%; border-collapse: collapse; margin: 0.75rem 0; font-size: 0.875rem; }
        .rte-content th, .rte-content td { border: 1px solid hsl(var(--border)); padding: 0.4rem 0.6rem; text-align: left; }
        .rte-content th { background: hsl(var(--muted)); font-weight: 600; }
      `}</style>
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  label,
  shortcut,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  shortcut?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-7 w-7"
      onClick={onClick}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-label={label}
    >
      {children}
    </Button>
  );
}
