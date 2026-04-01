"use client";

import { Type, Heading, MousePointerClick, Image, Minus, Star, Columns, Ticket, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateSectionId } from "@/lib/marketing/email-renderer";
import type { EmailSection, EmailSectionType } from "@/lib/marketing/email-renderer";

const SECTION_OPTIONS: { type: EmailSectionType; label: string; icon: React.ElementType; defaults: Partial<EmailSection> }[] = [
  { type: "heading", label: "Heading", icon: Heading, defaults: { content: "Your Heading", level: "h1" } },
  { type: "text", label: "Text", icon: Type, defaults: { content: "Write your content here..." } },
  { type: "button", label: "Button", icon: MousePointerClick, defaults: { content: "Click Here", href: "https://", align: "center" } },
  { type: "image", label: "Image", icon: Image, defaults: { imageUrl: "", imageAlt: "Image", align: "center" } },
  { type: "hero", label: "Hero Image", icon: ImageIcon, defaults: { imageUrl: "", overlayText: "" } },
  { type: "divider", label: "Divider", icon: Minus, defaults: { content: "" } },
  { type: "highlight", label: "Callout", icon: Star, defaults: { content: "Important message here..." } },
  { type: "columns", label: "Columns", icon: Columns, defaults: { content: "", columns: [[{ id: "", type: "text", content: "Column 1" }], [{ id: "", type: "text", content: "Column 2" }]] } },
  { type: "coupon", label: "Coupon", icon: Ticket, defaults: { content: "", couponCode: "SAVE20" } },
];

interface SectionToolbarProps {
  onAdd: (section: EmailSection) => void;
}

export function SectionToolbar({ onAdd }: SectionToolbarProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {SECTION_OPTIONS.map((opt) => (
        <Button
          key={opt.type}
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={() => {
            const section: EmailSection = {
              id: generateSectionId(),
              type: opt.type,
              content: "",
              ...opt.defaults,
            };
            // Fix column section IDs
            if (section.columns) {
              section.columns = section.columns.map((col) =>
                col.map((s) => ({ ...s, id: generateSectionId() }))
              );
            }
            onAdd(section);
          }}
        >
          <opt.icon className="w-3.5 h-3.5" />
          {opt.label}
        </Button>
      ))}
    </div>
  );
}
