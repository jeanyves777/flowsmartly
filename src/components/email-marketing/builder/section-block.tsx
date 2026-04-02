"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Copy, Trash2, Type, Heading, MousePointerClick, Image, Minus, Star, Columns, Ticket, ImageIcon, ChevronUp, ChevronDown, Palette, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";
import { MediaUploader } from "@/components/shared/media-uploader";
import type { EmailSection } from "@/lib/marketing/email-renderer";

const TYPE_ICONS: Record<string, React.ElementType> = {
  heading: Heading, text: Type, button: MousePointerClick, image: Image,
  hero: ImageIcon, divider: Minus, highlight: Star, columns: Columns,
  coupon: Ticket, header: ImageIcon,
};

const TYPE_LABELS: Record<string, string> = {
  heading: "Heading", text: "Text", button: "Button", image: "Image",
  hero: "Hero Image", divider: "Divider", highlight: "Callout",
  columns: "Columns", coupon: "Coupon", social: "Social", footer: "Footer",
  header: "Logo & Brand",
};

// Color presets for quick selection
const COLOR_PRESETS = ["#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#1f2937", "#ffffff", "#f3f4f6"];

function ColorPicker({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-1">
        <input type="color" value={value || "#000000"} onChange={(e) => onChange(e.target.value)} className="w-6 h-6 rounded border cursor-pointer" />
        <div className="flex gap-0.5">
          {COLOR_PRESETS.slice(0, 6).map((c) => (
            <button key={c} onClick={() => onChange(c)} className={cn("w-4 h-4 rounded-full border", value === c && "ring-2 ring-brand-500")} style={{ backgroundColor: c }} />
          ))}
        </div>
        {value && <button onClick={() => onChange("")} className="text-[9px] text-muted-foreground hover:text-foreground ml-1">Clear</button>}
      </div>
    </div>
  );
}

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
  const [showStyle, setShowStyle] = useState(false);
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
          {!["divider", "social"].includes(section.type) && (
            <Button variant={showStyle ? "default" : "ghost"} size="icon" className="h-6 w-6" onClick={() => setShowStyle(!showStyle)} title="Style">
              <Palette className="w-3.5 h-3.5" />
            </Button>
          )}
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

      {/* Style controls */}
      {showStyle && (
        <div className="px-3 py-2 border-b bg-muted/10 space-y-2">
          <div className="flex flex-wrap gap-3">
            {section.type === "button" && (
              <ColorPicker label="Button Color" value={section.buttonColor} onChange={(v) => onUpdate({ buttonColor: v })} />
            )}
            {["heading", "text", "highlight", "footer"].includes(section.type) && (
              <ColorPicker label="Text Color" value={section.textColor} onChange={(v) => onUpdate({ textColor: v })} />
            )}
            {!["divider", "social", "header"].includes(section.type) && (
              <ColorPicker label="Background" value={section.bgColor} onChange={(v) => onUpdate({ bgColor: v })} />
            )}
            {section.type === "highlight" && (
              <ColorPicker label="Border Color" value={section.shapeColor} onChange={(v) => onUpdate({ shapeColor: v })} />
            )}
            {section.type === "footer" && (
              <>
                <ColorPicker label="Contact Color" value={section.contactColor} onChange={(v) => onUpdate({ contactColor: v })} />
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Style</Label>
                  <div className="flex gap-1">
                    {(["minimal", "card", "banner"] as const).map((s) => (
                      <Button key={s} variant={section.contactStyle === s ? "default" : "outline"} size="sm" className="h-5 text-[9px] capitalize px-2" onClick={() => onUpdate({ contactStyle: s })}>
                        {s}
                      </Button>
                    ))}
                  </div>
                </div>
              </>
            )}
            {section.type === "text" && (
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Shape</Label>
                <div className="flex gap-1">
                  <Button variant={!section.shape ? "default" : "outline"} size="sm" className="h-5 text-[9px] px-2" onClick={() => onUpdate({ shape: undefined })}>None</Button>
                  {(["rounded", "pill", "banner"] as const).map((s) => (
                    <Button key={s} variant={section.shape === s ? "default" : "outline"} size="sm" className="h-5 text-[9px] capitalize px-2" onClick={() => onUpdate({ shape: s })}>
                      {s}
                    </Button>
                  ))}
                </div>
                {section.shape && (
                  <ColorPicker label="Shape Color" value={section.shapeColor} onChange={(v) => onUpdate({ shapeColor: v })} />
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content area */}
      <div className="p-3 cursor-pointer" onClick={() => !isEditing && setIsEditing(true)}>
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
    case "header":
      return (
        <div className={`text-${section.logoPosition || "center"} space-y-1`}>
          {section.imageUrl ? (
            <img src={section.imageUrl} alt="Logo" className="max-h-12 inline-block" />
          ) : (
            <span className="text-xs text-muted-foreground">Logo (uses brand logo)</span>
          )}
        </div>
      );
    case "heading":
      return <p className="font-bold text-lg" style={{ color: section.textColor || undefined }}>{section.content || "Heading..."}</p>;
    case "text":
      return section.shape ? (
        <div className="text-center">
          <span className={cn("inline-block px-4 py-2 text-sm", section.shape === "pill" ? "rounded-full" : section.shape === "banner" ? "rounded-none w-full" : "rounded-xl")}
            style={{ backgroundColor: section.shapeColor || "#f3f4f6", color: section.textColor || undefined }}>
            {section.content || "Shaped text..."}
          </span>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground line-clamp-3" style={{ color: section.textColor || undefined }}>{section.content || "Click to edit text..."}</p>
      );
    case "button":
      return (
        <div className={`text-${section.align || "center"}`}>
          <span className="inline-block px-4 py-2 text-white text-sm rounded-lg font-medium" style={{ backgroundColor: section.buttonColor || "#6366f1" }}>{section.content || "Button"}</span>
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
      return <div className="border-l-4 p-2 text-sm rounded-r" style={{ borderColor: section.shapeColor || "#f59e0b", backgroundColor: section.bgColor || "#fffbeb", color: section.textColor || undefined }}>{section.content || "Callout..."}</div>;
    case "coupon":
      return <div className="text-center p-2 border-2 border-dashed border-brand-300 rounded-lg"><span className="font-mono font-bold text-lg">{section.couponCode || "CODE"}</span></div>;
    case "columns":
      return <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">{(section.columns || []).map((col, i) => <div key={i} className="bg-muted p-2 rounded">Column {i + 1}</div>)}</div>;
    case "footer":
      return (
        <div className="text-center text-xs text-muted-foreground space-y-0.5">
          <p>Footer — {section.contactStyle || "minimal"} style</p>
          {section.contactColor && <div className="flex justify-center"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: section.contactColor }} /></div>}
        </div>
      );
    default:
      return <p className="text-xs text-muted-foreground italic">{section.type} section</p>;
  }
}

function SectionEditor({ section, onUpdate, onDone }: { section: EmailSection; onUpdate: (u: Partial<EmailSection>) => void; onDone: () => void }) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onDone();
  };

  switch (section.type) {
    case "header":
      return (
        <div className="space-y-3">
          <Label className="text-xs font-medium">Logo Image</Label>
          <MediaUploader
            value={section.imageUrl ? [section.imageUrl] : []}
            onChange={(urls) => onUpdate({ imageUrl: urls[0] || "" })}
            accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
            maxSize={5 * 1024 * 1024}
            filterTypes={["image"]}
            variant="small"
            placeholder="Upload logo (or uses brand logo)"
            libraryTitle="Select Logo"
          />
          <div className="flex gap-3">
            <div className="space-y-1">
              <Label className="text-[10px]">Position</Label>
              <div className="flex gap-1">
                {(["left", "center", "right"] as const).map((p) => (
                  <Button key={p} variant={section.logoPosition === p ? "default" : "outline"} size="sm" className="h-6 text-[10px] capitalize px-2" onClick={() => onUpdate({ logoPosition: p })}>
                    {p}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Size ({section.logoSize || 48}px)</Label>
              <input
                type="range"
                min={24}
                max={120}
                value={section.logoSize || 48}
                onChange={(e) => onUpdate({ logoSize: parseInt(e.target.value) })}
                className="w-32"
              />
            </div>
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onDone}>Done</Button>
        </div>
      );

    case "heading":
      return (
        <div className="space-y-2" onKeyDown={handleKeyDown}>
          <Input
            autoFocus
            value={section.content}
            onChange={(e) => onUpdate({ content: e.target.value })}
            placeholder="Heading text..."
            className="text-lg font-bold"
          />
          {/* Size & Level */}
          <div className="flex flex-wrap gap-2">
            <div className="flex gap-1">
              {(["h1", "h2"] as const).map((lvl) => (
                <Button key={lvl} variant={section.level === lvl ? "default" : "outline"} size="sm" className="h-6 text-[10px]" onClick={() => onUpdate({ level: lvl })}>
                  {lvl.toUpperCase()}
                </Button>
              ))}
            </div>
            <div className="flex gap-1">
              {(["left", "center", "right"] as const).map((a) => (
                <Button key={a} variant={section.align === a ? "default" : "outline"} size="sm" className="h-6 text-[10px] capitalize" onClick={() => onUpdate({ align: a })}>
                  {a}
                </Button>
              ))}
            </div>
            <div className="flex gap-1">
              <Button variant={section.fontWeight === "bold" || !section.fontWeight ? "default" : "outline"} size="sm" className="h-6 text-[10px] font-bold px-2" onClick={() => onUpdate({ fontWeight: section.fontWeight === "bold" || !section.fontWeight ? "normal" : "bold" })}>B</Button>
              <Button variant={section.fontStyle === "italic" ? "default" : "outline"} size="sm" className="h-6 text-[10px] italic px-2" onClick={() => onUpdate({ fontStyle: section.fontStyle === "italic" ? "normal" : "italic" })}>I</Button>
            </div>
          </div>
          {/* Font size slider */}
          <div className="flex items-center gap-2">
            <Label className="text-[10px] text-muted-foreground shrink-0">Size {section.fontSize || (section.level === "h2" ? 20 : 24)}px</Label>
            <input type="range" min={14} max={48} value={section.fontSize || (section.level === "h2" ? 20 : 24)} onChange={(e) => onUpdate({ fontSize: parseInt(e.target.value) })} className="flex-1" />
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onDone}>Done</Button>
        </div>
      );

    case "text":
      return (
        <div className="space-y-2" onKeyDown={handleKeyDown}>
          <Textarea
            autoFocus
            value={section.content}
            onChange={(e) => onUpdate({ content: e.target.value })}
            placeholder="Write your content... Use {{firstName}} for personalization"
            className="min-h-[80px] text-sm"
          />
          {/* Alignment + Style */}
          <div className="flex flex-wrap gap-2">
            <div className="flex gap-1">
              {(["left", "center", "right"] as const).map((a) => (
                <Button key={a} variant={section.align === a ? "default" : "outline"} size="sm" className="h-6 text-[10px] capitalize" onClick={() => onUpdate({ align: a })}>
                  {a}
                </Button>
              ))}
            </div>
            <div className="flex gap-1">
              <Button variant={section.fontWeight === "bold" ? "default" : "outline"} size="sm" className="h-6 text-[10px] font-bold px-2" onClick={() => onUpdate({ fontWeight: section.fontWeight === "bold" ? "normal" : "bold" })}>B</Button>
              <Button variant={section.fontStyle === "italic" ? "default" : "outline"} size="sm" className="h-6 text-[10px] italic px-2" onClick={() => onUpdate({ fontStyle: section.fontStyle === "italic" ? "normal" : "italic" })}>I</Button>
            </div>
          </div>
          {/* Font size */}
          <div className="flex items-center gap-2">
            <Label className="text-[10px] text-muted-foreground shrink-0">Size {section.fontSize || 16}px</Label>
            <input type="range" min={10} max={36} value={section.fontSize || 16} onChange={(e) => onUpdate({ fontSize: parseInt(e.target.value) })} className="flex-1" />
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onDone}>Done</Button>
        </div>
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

    case "highlight":
      return (
        <div className="space-y-2" onKeyDown={handleKeyDown}>
          <Textarea
            autoFocus
            value={section.content}
            onChange={(e) => onUpdate({ content: e.target.value })}
            placeholder="Callout message..."
            className="min-h-[60px] text-sm"
          />
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onDone}>Done</Button>
        </div>
      );

    case "coupon":
      return (
        <div className="space-y-2" onKeyDown={handleKeyDown}>
          <Input autoFocus value={section.couponCode || ""} onChange={(e) => onUpdate({ couponCode: e.target.value })} placeholder="Coupon code" className="h-8 text-center font-mono font-bold" />
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onDone}>Done</Button>
        </div>
      );

    case "footer":
      return (
        <div className="space-y-2" onKeyDown={handleKeyDown}>
          <Textarea
            autoFocus
            value={section.content}
            onChange={(e) => onUpdate({ content: e.target.value })}
            placeholder="Unsubscribe text... e.g. You received this email because {{unsubscribeLink}}"
            className="min-h-[40px] text-xs"
          />
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onDone}>Done</Button>
        </div>
      );

    default:
      return <Button variant="outline" size="sm" onClick={onDone}>Done</Button>;
  }
}
