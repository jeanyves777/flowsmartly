"use client";

import { useEffect, useState, type ElementType } from "react";
import Link from "next/link";
import { ArrowLeft, MessageSquare, ShieldCheck, Phone, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { NumbersPanel } from "./panels/numbers-panel";
import { CompliancePanel } from "./panels/compliance-panel";
import { CampaignsPanel } from "./panels/campaigns-panel";

/**
 * SMS — one central admin console (like the phone-agent console). Everything SMS
 * lives here under tabs instead of three separate nav links: Numbers & A2P (10DLC
 * + toll-free status), Compliance (review/approve submissions), and Campaigns
 * (delivery + click performance). The old /compliance and /numbers routes
 * redirect in with ?tab=. [[sms-studio-telnyx-redesign]]
 */

type Tab = "numbers" | "compliance" | "campaigns";
const TABS: { key: Tab; label: string; icon: ElementType }[] = [
  { key: "numbers", label: "Numbers & A2P", icon: Phone },
  { key: "compliance", label: "Compliance", icon: ShieldCheck },
  { key: "campaigns", label: "Campaigns", icon: Megaphone },
];

export default function SmsAdminConsolePage() {
  const [tab, setTab] = useState<Tab>("numbers");

  // Deep-link support (?tab=) so the old /compliance and /numbers routes can
  // redirect straight to their section. Read once on mount (no Suspense needed).
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "compliance" || t === "campaigns" || t === "numbers") setTab(t);
  }, []);

  return (
    <div className="space-y-6">
      {/* Console header */}
      <div className="flex items-center gap-3">
        <Link href="/admin" className="rounded-lg p-2 transition-colors hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-brand-500" />
            <h1 className="text-2xl font-bold">SMS</h1>
          </div>
          <p className="mt-1 text-muted-foreground">Numbers, A2P 10DLC, compliance &amp; campaigns — one console.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
                active ? "border-brand-500 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Active panel */}
      {tab === "numbers" ? <NumbersPanel /> : tab === "compliance" ? <CompliancePanel /> : <CampaignsPanel />}
    </div>
  );
}
