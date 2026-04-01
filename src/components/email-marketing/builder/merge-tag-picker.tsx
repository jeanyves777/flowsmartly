"use client";

import { useState } from "react";
import { Tag, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

const MERGE_TAGS = [
  { category: "Contact", tags: [
    { tag: "{{firstName}}", label: "First Name" },
    { tag: "{{lastName}}", label: "Last Name" },
    { tag: "{{email}}", label: "Email" },
    { tag: "{{phone}}", label: "Phone" },
    { tag: "{{company}}", label: "Company" },
    { tag: "{{city}}", label: "City" },
    { tag: "{{state}}", label: "State" },
  ]},
  { category: "Dates", tags: [
    { tag: "{{birthday}}", label: "Birthday" },
    { tag: "{{signupDate}}", label: "Signup Date" },
    { tag: "{{daysAsClient}}", label: "Days as Client" },
    { tag: "{{lastLogin}}", label: "Last Login" },
  ]},
  { category: "Business", tags: [
    { tag: "{{planName}}", label: "Plan Name" },
    { tag: "{{couponCode}}", label: "Coupon Code" },
  ]},
  { category: "Links", tags: [
    { tag: "{{referralLink}}", label: "Referral Link" },
    { tag: "{{unsubscribeLink}}", label: "Unsubscribe" },
  ]},
];

interface MergeTagPickerProps {
  onInsert: (tag: string) => void;
}

export function MergeTagPicker({ onInsert }: MergeTagPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setOpen(!open)}>
        <Tag className="w-3 h-3 mr-1" />
        Merge Tags
        <ChevronDown className="w-3 h-3 ml-1" />
      </Button>
      {open && (
        <div className="absolute right-0 top-8 z-50 bg-popover border rounded-lg shadow-lg p-1 min-w-[220px] max-h-[320px] overflow-y-auto">
          {MERGE_TAGS.map((group) => (
            <div key={group.category}>
              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase">{group.category}</div>
              {group.tags.map((tag) => (
                <button
                  key={tag.tag}
                  type="button"
                  onClick={() => { onInsert(tag.tag); setOpen(false); }}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted rounded"
                >
                  {tag.label} <span className="text-muted-foreground">{tag.tag}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
