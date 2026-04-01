"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Copy, Trash2, Type, Heading, MousePointerClick, Image, Minus, Star, Columns, Ticket, ImageIcon, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils/cn";
import { MediaUploader } from "@/components/shared/media-uploader";
import type { EmailSection } from "@/lib/marketing/email-renderer";

const TYPE_ICONS: Record<string, React.ElementType> = {
  heading: Heading, text: Type, button: MousePointerClick, image: Image,
  hero: ImageIcon, divider: Minus, highlight: Star, columns: Columns,
  coupon: Ticket,
};

const TYPE_LABELS: Record<string, string> = {
  heading: "Heading", text: "Text", button: "Button", image: "Image",
  hero: "Hero Image", divider: "Divider", highlight: "Callout",
  columns: "Columns", coupon: "Coupon", social: "Social", footer: "Footer",
};

interface SectionBlockProps {
  section: EmailSection;
  onUpdate: (updates: Partial<EmailSection>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

export function SectionBlock({ section, onUpdate, onDelete, onDuplicate, onMoveUp, onMoveDown, isFirst, isLast }: SectionBlockProps) {
  const [isEditing, setIsEditing] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Icon = TYPE_ICONS[section.type] || Type;
  const label = TYPE_LABELS[section.type] || section.type;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group border rounded-lg bg-card transition-all",
        isDragging ? "opacity-50 shadow-lg ring-2 ring-brand-500" : "hover:border-brand-300",
        isEditing && "ring-2 ring-brand-500/50"
      )}
    >
      {/* Header bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
          <GripVertical className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Icon className="w-3.5 h-3.5" />
          {label}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isFirst && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveUp}>
              <ChevronUp className="w-3.5 h-3.5" />
            </Button>
          )}
          {!isLast && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveDown}>
              <ChevronDown className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDuplicate}>
            <Copy className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Content area */}
      <div className="p-3 cursor-pointer" onClick={() => setIsEditing(true)}>
        {isEditing ? (
          <SectionEditor section={section} onUpdate={onUpdate} onDone={() => setIsEditing(false)} />
        ) : (
          <SectionPreview section={section} />
        )}
      </div>
    </div>
  );
}

function SectionPreview({ section }: { section: EmailSection }) {
  switch (section.type) {
    case "heading":
      return <p className="font-bold text-lg">{section.content || "Heading..."}</p>;
    case "text":
      return <p className="text-sm text-muted-foreground line-clamp-3">{section.content || "Click to edit text..."}</p>;
    case "button":
      return (
        <div className={`text-${section.align || "center"}`}>
          <span className="inline-block px-4 py-2 bg-brand-500 text-white text-sm rounded-lg font-medium">{section.content || "Button"}</span>
        </div>
      );
    case "image":
    case "hero":
      return section.imageUrl ? (
        <img src={section.imageUrl} alt={section.imageAlt || ""} className="w-full max-h-32 object-cover rounded" />
      ) : (
        <div className="h-20 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
          <Image className="w-4 h-4 mr-1" /> Click to add image
        </div>
      );
    case "divider":
      return <hr className="border-t border-border" />;
    case "highlight":
      return <div className="border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-950/20 p-2 text-sm rounded-r">{section.content || "Callout..."}</div>;
    case "coupon":
      return <div className="text-center p-2 border-2 border-dashed border-brand-300 rounded-lg"><span className="font-mono font-bold text-lg">{section.couponCode || "CODE"}</span></div>;
    case "columns":
      return <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">{(section.columns || []).map((col, i) => <div key={i} className="bg-muted p-2 rounded">Column {i + 1}</div>)}</div>;
    default:
      return <p className="text-xs text-muted-foreground italic">{section.type} section</p>;
  }
}

function SectionEditor({ section, onUpdate, onDone }: { section: EmailSection; onUpdate: (u: Partial<EmailSection>) => void; onDone: () => void }) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onDone();
  };

  switch (section.type) {
    case "heading":
      return (
        <div className="space-y-2" onKeyDown={handleKeyDown}>
          <Input
            autoFocus
            value={section.content}
            onChange={(e) => onUpdate({ content: e.target.value })}
            onBlur={onDone}
            placeholder="Heading text..."
            className="text-lg font-bold"
          />
          <div className="flex gap-1">
            {(["h1", "h2"] as const).map((lvl) => (
              <Button key={lvl} variant={section.level === lvl ? "default" : "outline"} size="sm" className="h-6 text-[10px]" onClick={() => onUpdate({ level: lvl })}>
                {lvl.toUpperCase()}
              </Button>
            ))}
          </div>
        </div>
      );

    case "text":
      return (
        <Textarea
          autoFocus
          value={section.content}
          onChange={(e) => onUpdate({ content: e.target.value })}
          onBlur={onDone}
          onKeyDown={handleKeyDown}
          placeholder="Write your content... Use {{firstName}} for personalization"
          className="min-h-[80px] text-sm"
        />
      );

    case "button":
      return (
        <div className="space-y-2" onKeyDown={handleKeyDown}>
          <Input autoFocus value={section.content} onChange={(e) => onUpdate({ content: e.target.value })} placeholder="Button text" className="h-8 text-sm" />
          <Input value={section.href || ""} onChange={(e) => onUpdate({ href: e.target.value })} placeholder="https://link-url.com" className="h-8 text-xs" />
          <div className="flex gap-1">
            {(["left", "center", "right"] as const).map((a) => (
              <Button key={a} variant={section.align === a ? "default" : "outline"} size="sm" className="h-6 text-[10px] capitalize" onClick={() => onUpdate({ align: a })}>
                {a}
              </Button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onDone}>Done</Button>
        </div>
      );

    case "image":
    case "hero":
      return (
        <div className="space-y-2">
          <MediaUploader
            value={section.imageUrl ? [section.imageUrl] : []}
            onChange={(urls) => onUpdate({ imageUrl: urls[0] || "" })}
            accept="image/png,image/jpeg,image/jpg,image/webp"
            maxSize={10 * 1024 * 1024}
            filterTypes={["image"]}
            variant="medium"
            placeholder="Upload or select image"
            libraryTitle="Select Image"
          />
          <Input value={section.imageAlt || ""} onChange={(e) => onUpdate({ imageAlt: e.target.value })} placeholder="Alt text" className="h-8 text-xs" />
          {section.type === "hero" && (
            <Input value={section.overlayText || ""} onChange={(e) => onUpdate({ overlayText: e.target.value })} placeholder="Overlay text (optional)" className="h-8 text-xs" />
          )}
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onDone}>Done</Button>
        </div>
      );

    case "highlight":
      return (
        <Textarea
          autoFocus
          value={section.content}
          onChange={(e) => onUpdate({ content: e.target.value })}
          onBlur={onDone}
          onKeyDown={handleKeyDown}
          placeholder="Callout message..."
          className="min-h-[60px] text-sm"
        />
      );

    case "coupon":
      return (
        <div className="space-y-2" onKeyDown={handleKeyDown}>
          <Input autoFocus value={section.couponCode || ""} onChange={(e) => onUpdate({ couponCode: e.target.value })} placeholder="Coupon code" className="h-8 text-center font-mono font-bold" />
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onDone}>Done</Button>
        </div>
      );

    default:
      return <Button variant="outline" size="sm" onClick={onDone}>Done</Button>;
  }
}
