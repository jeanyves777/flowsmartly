"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  MessageSquare,
  CheckCircle2,
  Users,
  Zap,
  ArrowRight,
  Shield,
  Send,
  Phone,
  Lock,
  Sparkles,
  BarChart3,
  Clock,
  Mail,
  MailCheck,
  MousePointerClick,
  Palette,
  FileText,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Animated Phone SVG ─────────────────────────────────────────────
function PhoneMockup({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <svg
        viewBox="0 0 280 560"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-2xl"
      >
        <rect x="4" y="4" width="272" height="552" rx="36" className="fill-gray-900 stroke-gray-700" strokeWidth="2" />
        <rect x="16" y="52" width="248" height="468" rx="4" className="fill-white dark:fill-gray-800" />
        <rect x="96" y="16" width="88" height="24" rx="12" className="fill-gray-800" />
        <circle cx="150" cy="28" r="5" className="fill-gray-700" />
        <rect x="104" y="534" width="72" height="4" rx="2" className="fill-gray-600" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="overflow-hidden" style={{ width: "88.5%", height: "83.5%", marginTop: "1.5%", borderRadius: "4px" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SMS SCREENS
// ═══════════════════════════════════════════════════════════════════
function SmsComposeScreen() {
  return (
    <div className="h-full bg-white dark:bg-gray-800 p-3 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center">
          <Send className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="text-[9px] font-bold text-gray-800 dark:text-gray-200">SMS Blaster</div>
          <div className="text-[6px] text-gray-500">New Campaign</div>
        </div>
      </div>
      <div className="space-y-2 flex-1">
        <div>
          <div className="text-[6.5px] text-gray-500 mb-0.5">Audience</div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded px-2 py-1.5 flex items-center gap-1">
            <Users className="w-3 h-3 text-brand-500" />
            <span className="text-[8px] text-gray-800 dark:text-gray-200">All Subscribers (2,847)</span>
          </div>
        </div>
        <div>
          <div className="text-[6.5px] text-gray-500 mb-0.5">Message</div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded px-2 py-1.5">
            <div className="text-[7px] text-gray-800 dark:text-gray-200 leading-relaxed">
              Hey {"{name}"}! Flash sale today only - 40% off everything with code FLASH40. Shop now: {"{link}"}
            </div>
            <div className="text-[6px] text-gray-400 mt-1">Reply STOP to unsubscribe</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-violet-500" />
          <span className="text-[6.5px] text-violet-500 font-medium">AI-generated message</span>
        </div>
      </div>
      <div className="bg-brand-500 text-white text-[7px] font-medium text-center py-1.5 rounded-md flex items-center justify-center gap-1">
        <Send className="w-3 h-3" />
        Send to 2,847 contacts
      </div>
    </div>
  );
}

function SmsSendingScreen() {
  return (
    <div className="h-full bg-white dark:bg-gray-800 p-3 flex flex-col items-center justify-center gap-3">
      <div className="relative">
        <div className="w-16 h-16 rounded-full border-4 border-brand-200 dark:border-brand-800 flex items-center justify-center">
          <Send className="w-8 h-8 text-brand-500" />
        </div>
        <svg className="absolute inset-0 w-16 h-16 animate-spin" style={{ animationDuration: "2s" }}>
          <circle cx="32" cy="32" r="28" fill="none" className="stroke-brand-500" strokeWidth="4" strokeDasharray="40 136" strokeLinecap="round" />
        </svg>
      </div>
      <div className="text-[10px] font-bold text-brand-600 dark:text-brand-400">Sending Messages...</div>
      <div className="w-full max-w-[160px] space-y-1.5">
        {[
          { label: "Personalized", done: true },
          { label: "Compliance checked", done: true },
          { label: "Delivering...", done: false },
        ].map((step) => (
          <div key={step.label} className="flex items-center gap-1.5">
            {step.done ? (
              <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
            ) : (
              <div className="w-3 h-3 rounded-full border-2 border-brand-300 animate-pulse shrink-0" />
            )}
            <span className={`text-[6.5px] ${step.done ? "text-gray-600 dark:text-gray-400" : "text-brand-500 font-medium"}`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
      <div className="w-full max-w-[160px] bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden mt-1">
        <div className="h-full bg-gradient-to-r from-brand-400 to-brand-600 rounded-full animate-pulse" style={{ width: "67%" }} />
      </div>
      <div className="text-[7px] text-gray-500">1,908 / 2,847 sent</div>
    </div>
  );
}

function SmsDeliveredScreen() {
  return (
    <div className="h-full bg-gray-100 dark:bg-gray-900 p-2 flex flex-col">
      <div className="flex items-center gap-1.5 mb-2">
        <MessageSquare className="w-3.5 h-3.5 text-brand-500" />
        <div className="text-[8px] font-medium text-gray-800 dark:text-gray-200">Messages</div>
      </div>
      <div className="flex flex-col gap-1.5 flex-1">
        <div className="self-start max-w-[85%]">
          <div className="bg-white dark:bg-gray-700 rounded-2xl rounded-tl-sm p-2 shadow-sm">
            <div className="text-[7px] text-gray-800 dark:text-gray-200 leading-relaxed">
              <span className="font-bold">FlowSmartly:</span> Hey Sarah! Flash sale today only - 40% off everything with code FLASH40.
            </div>
          </div>
          <div className="text-[5.5px] text-gray-400 mt-0.5 ml-1">2:00 PM</div>
        </div>
        <div className="self-end max-w-[70%] animate-[slideUp_0.3s_ease-out_0.3s_both]">
          <div className="bg-brand-500 rounded-2xl rounded-tr-sm p-2 shadow-sm">
            <div className="text-[7px] text-white">Omg yes! Just ordered 3 items</div>
          </div>
          <div className="text-[5.5px] text-gray-400 mt-0.5 text-right mr-1">2:03 PM</div>
        </div>
        <div className="self-start max-w-[85%] animate-[slideUp_0.3s_ease-out_0.6s_both]">
          <div className="bg-white dark:bg-gray-700 rounded-2xl rounded-tl-sm p-2 shadow-sm">
            <div className="text-[7px] text-gray-800 dark:text-gray-200">Glad you like it! Your order is confirmed.</div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 mt-2">
        <div className="flex-1 bg-white dark:bg-gray-700 rounded-full px-2 py-1 text-[7px] text-gray-400">Text Message</div>
        <div className="w-5 h-5 bg-brand-500 rounded-full flex items-center justify-center">
          <ArrowRight className="w-3 h-3 text-white" />
        </div>
      </div>
    </div>
  );
}

function SmsAnalyticsScreen() {
  return (
    <div className="h-full bg-white dark:bg-gray-800 p-3 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-4 h-4 text-brand-500" />
        <div className="text-[9px] font-bold text-gray-800 dark:text-gray-200">Campaign Results</div>
      </div>
      <div className="grid grid-cols-2 gap-1.5 mb-3">
        {[
          { label: "Delivered", value: "2,847", color: "text-green-500" },
          { label: "Opened", value: "89%", color: "text-blue-500" },
          { label: "Clicked", value: "34%", color: "text-violet-500" },
          { label: "Revenue", value: "$4,230", color: "text-emerald-500" },
        ].map((stat) => (
          <div key={stat.label} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-1.5 text-center">
            <div className={`text-[10px] font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-[6px] text-gray-500">{stat.label}</div>
          </div>
        ))}
      </div>
      <div className="flex-1 flex items-end gap-1 px-1">
        {[40, 65, 85, 70, 90, 75, 95, 60, 80, 88, 72, 92].map((h, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
            <div
              className="w-full bg-gradient-to-t from-brand-500 to-brand-400 rounded-t-sm animate-[growUp_0.5s_ease-out_both]"
              style={{ height: `${h * 0.6}%`, animationDelay: `${i * 0.05}s` }}
            />
            <span className="text-[4px] text-gray-400">{i + 1}</span>
          </div>
        ))}
      </div>
      <div className="text-[6px] text-center text-gray-400 mt-1">Hourly delivery distribution</div>
    </div>
  );
}

function SmsCompliantScreen() {
  return (
    <div className="h-full bg-gradient-to-b from-green-50 to-white dark:from-green-950 dark:to-gray-800 p-3 flex flex-col items-center justify-center gap-2">
      <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center animate-[scaleIn_0.5s_ease-out]">
        <Shield className="w-8 h-8 text-green-500" />
      </div>
      <div className="text-[10px] font-bold text-green-700 dark:text-green-400">100% Compliant</div>
      <div className="text-[7px] text-gray-500 text-center px-2">Every SMS campaign is TCPA-compliant with built-in consent management</div>
      <div className="w-full space-y-1 mt-2">
        {["Opt-in consent verified", "STOP keyword active", "Frequency limits enforced", "Suppression list synced", "Audit trail recorded"].map((item) => (
          <div key={item} className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
            <span className="text-[6.5px] text-gray-600 dark:text-gray-400">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// EMAIL SCREENS
// ═══════════════════════════════════════════════════════════════════
function EmailDesignScreen() {
  return (
    <div className="h-full bg-white dark:bg-gray-800 p-3 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center">
          <Palette className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="text-[9px] font-bold text-gray-800 dark:text-gray-200">Email Builder</div>
          <div className="text-[6px] text-gray-500">Drag & Drop</div>
        </div>
      </div>
      {/* Mini email preview */}
      <div className="flex-1 bg-gray-50 dark:bg-gray-700 rounded-lg p-2 space-y-1.5 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-brand-500 rounded-md h-10 flex items-center justify-center">
          <span className="text-[8px] font-bold text-white">Summer Collection</span>
        </div>
        <div className="bg-white dark:bg-gray-600 rounded p-1.5">
          <div className="text-[7px] font-medium text-gray-800 dark:text-gray-200">Hi {"{first_name}"},</div>
          <div className="text-[6px] text-gray-500 leading-relaxed mt-0.5">
            Our biggest sale of the year is here! Explore new arrivals and save up to 50%...
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1">
          <div className="bg-gray-200 dark:bg-gray-600 rounded h-8" />
          <div className="bg-gray-200 dark:bg-gray-600 rounded h-8" />
        </div>
        <div className="bg-blue-500 text-white text-[6px] font-medium text-center py-1 rounded">
          Shop Now
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-2">
        <Sparkles className="w-3 h-3 text-violet-500" />
        <span className="text-[6.5px] text-violet-500 font-medium">AI-generated copy & layout</span>
      </div>
    </div>
  );
}

function EmailAudienceScreen() {
  return (
    <div className="h-full bg-white dark:bg-gray-800 p-3 flex flex-col">
      <div className="text-[9px] font-bold text-gray-800 dark:text-gray-200 mb-2">Select Audience</div>
      <div className="space-y-1.5 flex-1">
        {[
          { name: "All Subscribers", count: "12,450", selected: false },
          { name: "Active Buyers", count: "4,230", selected: true },
          { name: "New Signups (30d)", count: "890", selected: false },
          { name: "VIP Customers", count: "1,120", selected: true },
        ].map((seg) => (
          <div key={seg.name} className={`flex items-center gap-1.5 p-1.5 rounded-md border ${seg.selected ? "border-blue-500 bg-blue-50 dark:bg-blue-950" : "border-gray-200 dark:border-gray-700"}`}>
            <div className={`w-3.5 h-3.5 rounded border-2 shrink-0 flex items-center justify-center ${seg.selected ? "border-blue-500 bg-blue-500" : "border-gray-300 dark:border-gray-600"}`}>
              {seg.selected && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
            </div>
            <div className="flex-1">
              <div className="text-[7px] font-medium text-gray-800 dark:text-gray-200">{seg.name}</div>
            </div>
            <span className="text-[6px] text-gray-500">{seg.count}</span>
          </div>
        ))}
      </div>
      <div className="bg-blue-500 text-white text-[7px] font-medium text-center py-1.5 rounded-md flex items-center justify-center gap-1">
        <Users className="w-3 h-3" />
        5,350 recipients selected
      </div>
    </div>
  );
}

function EmailSendingScreen() {
  return (
    <div className="h-full bg-gray-100 dark:bg-gray-900 p-2 flex flex-col">
      <div className="flex items-center gap-1.5 mb-2">
        <Mail className="w-3.5 h-3.5 text-blue-500" />
        <div className="text-[8px] font-medium text-gray-800 dark:text-gray-200">Inbox</div>
        <div className="ml-auto bg-red-500 text-white text-[5px] w-3 h-3 rounded-full flex items-center justify-center">1</div>
      </div>
      <div className="bg-white dark:bg-gray-700 rounded-lg p-2 shadow-sm border-l-2 border-blue-500 animate-[slideUp_0.3s_ease-out]">
        <div className="flex items-center gap-1 mb-1">
          <div className="w-4 h-4 rounded-full bg-gradient-to-r from-blue-500 to-brand-500 flex items-center justify-center">
            <Sparkles className="w-2.5 h-2.5 text-white" />
          </div>
          <div className="text-[7px] font-bold text-gray-800 dark:text-gray-200">Summer Collection - 50% Off!</div>
        </div>
        <div className="text-[6.5px] text-gray-600 dark:text-gray-400 leading-relaxed mb-2">
          Hi Sarah! Our biggest sale of the year is here. Explore new arrivals and save up to 50% on everything...
        </div>
        <div className="bg-blue-500 text-white text-[7px] font-medium text-center py-1 rounded animate-pulse">
          Shop the Sale
        </div>
      </div>
      <div className="mt-2 bg-white dark:bg-gray-700 rounded-lg p-2 shadow-sm opacity-50">
        <div className="text-[7px] text-gray-500">Weekly Newsletter - New tips...</div>
      </div>
      <div className="mt-1 bg-white dark:bg-gray-700 rounded-lg p-2 shadow-sm opacity-30">
        <div className="text-[7px] text-gray-500">Product Update - v2.0 launch...</div>
      </div>
    </div>
  );
}

function EmailAnalyticsScreen() {
  return (
    <div className="h-full bg-white dark:bg-gray-800 p-3 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-4 h-4 text-blue-500" />
        <div className="text-[9px] font-bold text-gray-800 dark:text-gray-200">Email Analytics</div>
      </div>
      <div className="grid grid-cols-2 gap-1.5 mb-3">
        {[
          { label: "Delivered", value: "5,342", color: "text-green-500" },
          { label: "Open Rate", value: "42%", color: "text-blue-500" },
          { label: "Click Rate", value: "18%", color: "text-violet-500" },
          { label: "Conversions", value: "156", color: "text-emerald-500" },
        ].map((stat) => (
          <div key={stat.label} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-1.5 text-center">
            <div className={`text-[10px] font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-[6px] text-gray-500">{stat.label}</div>
          </div>
        ))}
      </div>
      {/* Funnel visualization */}
      <div className="flex-1 flex flex-col justify-center gap-1 px-2">
        {[
          { label: "Sent", value: "5,350", width: "100%", color: "bg-gray-300 dark:bg-gray-600" },
          { label: "Delivered", value: "5,342", width: "99%", color: "bg-blue-300" },
          { label: "Opened", value: "2,244", width: "42%", color: "bg-blue-400" },
          { label: "Clicked", value: "963", width: "18%", color: "bg-blue-500" },
          { label: "Converted", value: "156", width: "3%", color: "bg-emerald-500" },
        ].map((row) => (
          <div key={row.label} className="flex items-center gap-1.5">
            <span className="text-[5.5px] text-gray-500 w-12 text-right">{row.label}</span>
            <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
              <div className={`h-full ${row.color} rounded-full`} style={{ width: row.width }} />
            </div>
            <span className="text-[5.5px] text-gray-500 w-8">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmailCompliantScreen() {
  return (
    <div className="h-full bg-gradient-to-b from-blue-50 to-white dark:from-blue-950 dark:to-gray-800 p-3 flex flex-col items-center justify-center gap-2">
      <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center animate-[scaleIn_0.5s_ease-out]">
        <MailCheck className="w-8 h-8 text-blue-500" />
      </div>
      <div className="text-[10px] font-bold text-blue-700 dark:text-blue-400">CAN-SPAM Compliant</div>
      <div className="text-[7px] text-gray-500 text-center px-2">Every email includes required compliance elements</div>
      <div className="w-full space-y-1 mt-2">
        {["Unsubscribe in every email", "Physical address included", "Sender clearly identified", "Double opt-in support", "Instant unsubscribe"].map((item) => (
          <div key={item} className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-blue-500 shrink-0" />
            <span className="text-[6.5px] text-gray-600 dark:text-gray-400">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// FLOW STEP DEFINITIONS
// ═══════════════════════════════════════════════════════════════════
const smsSteps = [
  { id: 1, title: "Compose Campaign", description: "Write your message or let AI generate it. Personalize with merge tags for each contact.", screen: "sms-compose", icon: Send },
  { id: 2, title: "Smart Delivery", description: "Messages are personalized, compliance-checked, and sent at optimal times.", screen: "sms-sending", icon: Zap },
  { id: 3, title: "Instant Engagement", description: "Recipients receive your message in seconds. Two-way conversations happen naturally.", screen: "sms-delivered", icon: MessageSquare },
  { id: 4, title: "Real-Time Analytics", description: "Track delivery rates, opens, clicks, and revenue attribution in real time.", screen: "sms-analytics", icon: BarChart3 },
  { id: 5, title: "Built-In Compliance", description: "TCPA-compliant by default. Consent management, opt-out handling, and audit trails.", screen: "sms-compliant", icon: Shield },
];

const emailSteps = [
  { id: 1, title: "Design Beautiful Emails", description: "Drag-and-drop builder with AI-generated copy and responsive templates.", screen: "email-design", icon: Palette },
  { id: 2, title: "Smart Segmentation", description: "Target the right audience with dynamic segments based on behavior and preferences.", screen: "email-audience", icon: Users },
  { id: 3, title: "Personalized Delivery", description: "Each email is personalized with merge fields, sent at optimal open times.", screen: "email-sending", icon: Mail },
  { id: 4, title: "Deep Analytics", description: "Track opens, clicks, conversions, and revenue with visual funnel analytics.", screen: "email-analytics", icon: BarChart3 },
  { id: 5, title: "CAN-SPAM Compliant", description: "Automatic unsubscribe links, physical address, and sender identification in every email.", screen: "email-compliant", icon: MailCheck },
];

function renderScreen(screen: string) {
  switch (screen) {
    case "sms-compose": return <SmsComposeScreen />;
    case "sms-sending": return <SmsSendingScreen />;
    case "sms-delivered": return <SmsDeliveredScreen />;
    case "sms-analytics": return <SmsAnalyticsScreen />;
    case "sms-compliant": return <SmsCompliantScreen />;
    case "email-design": return <EmailDesignScreen />;
    case "email-audience": return <EmailAudienceScreen />;
    case "email-sending": return <EmailSendingScreen />;
    case "email-analytics": return <EmailAnalyticsScreen />;
    case "email-compliant": return <EmailCompliantScreen />;
    default: return null;
  }
}

// ═══════════════════════════════════════════════════════════════════
// TAB CONFIG
// ═══════════════════════════════════════════════════════════════════
const tabs = [
  {
    id: "sms",
    label: "SMS Marketing",
    icon: MessageSquare,
    steps: smsSteps,
    gradient: "bg-gradient-to-br from-emerald-600 via-teal-700 to-cyan-800",
    accentColor: "text-emerald-500",
    activeColor: "bg-emerald-500",
    stats: [
      { icon: Clock, label: "Avg Delivery", value: "< 3 sec", color: "text-emerald-500" },
      { icon: Phone, label: "Open Rate", value: "98%", color: "text-blue-500" },
      { icon: Shield, label: "Compliance", value: "TCPA Ready", color: "text-green-500" },
      { icon: Sparkles, label: "AI Copywriting", value: "Built-In", color: "text-violet-500" },
    ],
  },
  {
    id: "email",
    label: "Email Marketing",
    icon: Mail,
    steps: emailSteps,
    gradient: "bg-gradient-to-br from-blue-600 via-indigo-700 to-violet-800",
    accentColor: "text-blue-500",
    activeColor: "bg-blue-500",
    stats: [
      { icon: Eye, label: "Open Rate", value: "42%", color: "text-blue-500" },
      { icon: MousePointerClick, label: "Click Rate", value: "18%", color: "text-violet-500" },
      { icon: FileText, label: "Templates", value: "50+", color: "text-emerald-500" },
      { icon: Sparkles, label: "AI Content", value: "Built-In", color: "text-amber-500" },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════
// MAIN SECTION
// ═══════════════════════════════════════════════════════════════════
export function SmsBlasterSection() {
  const [activeTab, setActiveTab] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [isClicking, setIsClicking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true });

  const currentTab = tabs[activeTab];
  const currentSteps = currentTab.steps;

  const advanceStep = useCallback(() => {
    if (isPaused) return;
    setIsClicking(true);
    setTimeout(() => {
      setIsClicking(false);
      setActiveStep((prev) => (prev + 1) % currentSteps.length);
    }, 300);
  }, [isPaused, currentSteps.length]);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(advanceStep, 3500);
    return () => clearInterval(interval);
  }, [isPaused, advanceStep]);

  // Reset step when switching tabs
  const handleTabChange = (index: number) => {
    setActiveTab(index);
    setActiveStep(0);
    setIsPaused(false);
  };

  return (
    <section ref={sectionRef} className="py-20 px-4 sm:px-6 lg:px-8">
      <style jsx global>{`
        @keyframes scaleIn {
          from { transform: scale(0); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes growUp {
          from { transform: scaleY(0); transform-origin: bottom; }
          to { transform: scaleY(1); transform-origin: bottom; }
        }
      `}</style>

      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Powerful Marketing Channels
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Reach your audience through SMS and email with AI-powered campaigns,
            built-in compliance, and real-time analytics.
          </p>
        </motion.div>

        {/* Tab switcher */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex justify-center mb-8"
        >
          <div className="inline-flex items-center p-1 rounded-xl bg-muted/50 border gap-1">
            {tabs.map((tab, index) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(index)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                  activeTab === index
                    ? `${tab.activeColor} text-white shadow-lg`
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Interactive flow */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentTab.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className={`relative overflow-hidden rounded-3xl ${currentTab.gradient} p-6 sm:p-10`}
          >
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

            <div className="relative z-10">
              <div className="grid lg:grid-cols-2 gap-8">
                {/* Phone mockup */}
                <div className="flex justify-center">
                  <div
                    className="relative cursor-pointer"
                    onClick={() => {
                      if (!isPaused) {
                        setIsPaused(true);
                      } else {
                        advanceStep();
                        setIsPaused(false);
                      }
                    }}
                  >
                    <div className="w-52 sm:w-60">
                      <PhoneMockup>
                        {renderScreen(currentSteps[activeStep].screen)}
                      </PhoneMockup>
                    </div>
                    {/* Hand cursor */}
                    <div className="absolute -bottom-2 -right-4 sm:-right-6 transition-all duration-500 opacity-100 scale-100">
                      <svg
                        width="40"
                        height="48"
                        viewBox="0 0 40 48"
                        fill="none"
                        className={`drop-shadow-lg transition-transform duration-150 ${isClicking ? "scale-90" : "scale-100"}`}
                      >
                        <path
                          d="M12 18C12 18 12 8 18 8C24 8 24 16 24 16V14C24 14 24 10 28 10C32 10 32 16 32 16V22C32 22 36 22 36 28C36 38 28 44 20 44C12 44 8 38 8 32V26C8 26 8 22 12 22V18Z"
                          className="fill-amber-100 stroke-amber-300"
                          strokeWidth="1.5"
                        />
                        <path d="M18 8C18 4 18 2 18 2" className="stroke-amber-200" strokeWidth="3" strokeLinecap="round" />
                        {isClicking && (
                          <>
                            <circle cx="18" cy="2" r="6" className="fill-brand-500/30 animate-ping" />
                            <circle cx="18" cy="2" r="3" className="fill-brand-500/50" />
                          </>
                        )}
                      </svg>
                    </div>
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] text-white/50">
                      {isPaused ? "Tap phone to resume" : "Tap phone to pause"}
                    </div>
                  </div>
                </div>

                {/* Steps */}
                <div className="flex flex-col gap-3 justify-center">
                  {currentSteps.map((step, index) => (
                    <button
                      key={step.id}
                      onClick={() => {
                        setActiveStep(index);
                        setIsPaused(true);
                      }}
                      className={`flex items-start gap-3 p-3 rounded-xl transition-all duration-500 text-left ${
                        index === activeStep
                          ? "bg-white/20 backdrop-blur-sm shadow-lg scale-[1.02]"
                          : index < activeStep
                            ? "bg-white/10 opacity-70"
                            : "bg-white/5 opacity-50"
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-500 ${
                          index === activeStep
                            ? "bg-white text-gray-900 shadow-lg"
                            : index < activeStep
                              ? "bg-white/30 text-white"
                              : "bg-white/10 text-white/50"
                        }`}
                      >
                        {index < activeStep ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <step.icon className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className={`text-sm font-semibold transition-colors ${index === activeStep ? "text-white" : "text-white/70"}`}>
                          {step.title}
                        </div>
                        <div className={`text-xs mt-0.5 transition-colors leading-relaxed ${index === activeStep ? "text-white/80" : "text-white/50"}`}>
                          {step.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8"
        >
          {currentTab.stats.map((stat) => (
            <div key={stat.label} className="p-4 rounded-xl bg-card border text-center hover:shadow-lg transition-shadow">
              <stat.icon className={`w-5 h-5 ${stat.color} mx-auto mb-2`} />
              <div className="text-lg font-bold">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="text-center mt-10"
        >
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" asChild>
              <Link href="/register">
                Get Started Free
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/marketing-compliance">
                <Lock className="mr-2 w-4 h-4" />
                View Compliance Details
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
