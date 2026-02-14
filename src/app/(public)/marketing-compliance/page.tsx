"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Shield,
  CheckCircle2,
  MessageSquare,
  Mail,
  Phone,
  Lock,
  UserCheck,
  Ban,
  ArrowRight,
  Sparkles,
  Eye,
  Bell,
  ShieldCheck,
  MailCheck,
  PhoneOff,
} from "lucide-react";
import Link from "next/link";

// ─── Animated Phone SVG Component ────────────────────────────────────
function PhoneMockup({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      {/* Phone frame */}
      <svg
        viewBox="0 0 280 560"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-2xl"
      >
        {/* Phone body */}
        <rect
          x="4"
          y="4"
          width="272"
          height="552"
          rx="36"
          className="fill-gray-900 stroke-gray-700"
          strokeWidth="2"
        />
        {/* Screen area */}
        <rect
          x="16"
          y="52"
          width="248"
          height="468"
          rx="4"
          className="fill-white dark:fill-gray-800"
        />
        {/* Notch */}
        <rect
          x="96"
          y="16"
          width="88"
          height="24"
          rx="12"
          className="fill-gray-800"
        />
        {/* Camera dot */}
        <circle cx="150" cy="28" r="5" className="fill-gray-700" />
        {/* Home indicator */}
        <rect
          x="104"
          y="534"
          width="72"
          height="4"
          rx="2"
          className="fill-gray-600"
        />
      </svg>
      {/* Screen content overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="overflow-hidden"
          style={{
            width: "88.5%",
            height: "83.5%",
            marginTop: "1.5%",
            borderRadius: "4px",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Animated Hand Cursor ────────────────────────────────────────────
function HandCursor({
  active,
  clicking,
  className = "",
}: {
  active: boolean;
  clicking: boolean;
  className?: string;
}) {
  return (
    <div
      className={`transition-all duration-500 ${active ? "opacity-100 scale-100" : "opacity-0 scale-75"} ${className}`}
    >
      <svg
        width="40"
        height="48"
        viewBox="0 0 40 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`drop-shadow-lg transition-transform duration-150 ${clicking ? "scale-90" : "scale-100"}`}
      >
        {/* Hand pointing */}
        <path
          d="M12 18C12 18 12 8 18 8C24 8 24 16 24 16V14C24 14 24 10 28 10C32 10 32 16 32 16V22C32 22 36 22 36 28C36 38 28 44 20 44C12 44 8 38 8 32V26C8 26 8 22 12 22V18Z"
          className="fill-amber-100 stroke-amber-300"
          strokeWidth="1.5"
        />
        {/* Index finger */}
        <path
          d="M18 8C18 4 18 2 18 2"
          className="stroke-amber-200"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* Tap ripple */}
        {clicking && (
          <>
            <circle
              cx="18"
              cy="2"
              r="6"
              className="fill-brand-500/30 animate-ping"
            />
            <circle cx="18" cy="2" r="3" className="fill-brand-500/50" />
          </>
        )}
      </svg>
    </div>
  );
}

// ─── SMS Opt-In Flow Steps ───────────────────────────────────────────
const smsOptInSteps = [
  {
    id: 1,
    title: "Visit Website",
    description: "Customer visits your business website or landing page",
    screen: "website",
  },
  {
    id: 2,
    title: "Consent Checkbox",
    description:
      'Customer checks "I agree to receive SMS marketing messages" with clear disclosure',
    screen: "consent",
  },
  {
    id: 3,
    title: "Phone Number Entry",
    description:
      "Customer provides their phone number with explicit opt-in language",
    screen: "phone",
  },
  {
    id: 4,
    title: "Confirmation SMS",
    description:
      "System sends a welcome message with opt-out instructions (Reply STOP to unsubscribe)",
    screen: "confirmation",
  },
  {
    id: 5,
    title: "Compliant & Protected",
    description:
      "Contact is verified, consent is logged, and all messages include opt-out options",
    screen: "complete",
  },
];

// ─── Email Opt-In Flow Steps ─────────────────────────────────────────
const emailOptInSteps = [
  {
    id: 1,
    title: "Signup Form",
    description: "Customer fills out a signup or subscription form",
    screen: "signup",
  },
  {
    id: 2,
    title: "Email Consent",
    description:
      "Clear opt-in language explains what emails they will receive and how often",
    screen: "emailConsent",
  },
  {
    id: 3,
    title: "Confirmation Email",
    description:
      "Double opt-in: verification email sent to confirm the subscription",
    screen: "verify",
  },
  {
    id: 4,
    title: "Preferences Center",
    description:
      "Subscribers can manage frequency, topics, and communication preferences",
    screen: "preferences",
  },
  {
    id: 5,
    title: "Every Email Compliant",
    description:
      "All emails include unsubscribe link, physical address, and sender identification",
    screen: "emailComplete",
  },
];

// ─── Opt-Out Flow Steps ──────────────────────────────────────────────
const optOutSteps = [
  {
    id: 1,
    title: "User Replies STOP",
    description:
      'Customer sends "STOP" to any marketing SMS or clicks unsubscribe in email',
    screen: "stop",
  },
  {
    id: 2,
    title: "Instant Processing",
    description:
      "System immediately processes the opt-out request — no delays, no friction",
    screen: "processing",
  },
  {
    id: 3,
    title: "Confirmation Sent",
    description:
      'A final message confirms: "You have been unsubscribed. No further messages will be sent."',
    screen: "confirm",
  },
  {
    id: 4,
    title: "Suppression List",
    description:
      "Number/email is permanently added to the suppression list across all campaigns",
    screen: "suppressed",
  },
];

// ─── Phone Screen Content Components ─────────────────────────────────
function WebsiteScreen() {
  return (
    <div className="h-full bg-gradient-to-b from-brand-50 to-white dark:from-brand-950 dark:to-gray-800 p-3 flex flex-col">
      <div className="flex items-center gap-1.5 mb-3">
        <div className="w-2 h-2 rounded-full bg-red-400" />
        <div className="w-2 h-2 rounded-full bg-yellow-400" />
        <div className="w-2 h-2 rounded-full bg-green-400" />
        <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-4 mx-2 flex items-center px-2">
          <Lock className="w-2.5 h-2.5 text-green-500 mr-1" />
          <span className="text-[6px] text-gray-500">yourbusiness.com</span>
        </div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-2">
        <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div className="text-[9px] font-bold text-gray-800 dark:text-gray-200">
          Welcome to Our Store
        </div>
        <div className="text-[7px] text-gray-500 text-center px-2">
          Get exclusive deals and updates delivered to your phone
        </div>
        <div className="w-full max-w-[140px] bg-brand-500 text-white text-[7px] font-medium text-center py-1.5 rounded-md animate-pulse">
          Subscribe Now
        </div>
      </div>
    </div>
  );
}

function ConsentScreen() {
  return (
    <div className="h-full bg-white dark:bg-gray-800 p-3 flex flex-col">
      <div className="text-[9px] font-bold text-gray-800 dark:text-gray-200 mb-2">
        SMS Subscription
      </div>
      <div className="space-y-2 flex-1">
        <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-2">
          <div className="text-[7px] text-gray-500 mb-1">Your Phone Number</div>
          <div className="text-[8px] text-gray-800 dark:text-gray-200">
            +1 (555) 123-4567
          </div>
        </div>
        <div className="flex items-start gap-1.5">
          <div className="w-3.5 h-3.5 mt-0.5 rounded border-2 border-brand-500 bg-brand-500 flex items-center justify-center shrink-0 animate-[scaleIn_0.3s_ease-out]">
            <CheckCircle2 className="w-2.5 h-2.5 text-white" />
          </div>
          <div className="text-[6.5px] text-gray-600 dark:text-gray-400 leading-relaxed">
            I agree to receive recurring marketing text messages from
            FlowSmartly at the number provided. Consent is not a condition of
            purchase. Msg & data rates may apply. Reply STOP to unsubscribe.
          </div>
        </div>
        <div className="flex items-start gap-1.5">
          <div className="w-3.5 h-3.5 mt-0.5 rounded border-2 border-brand-500 bg-brand-500 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-2.5 h-2.5 text-white" />
          </div>
          <div className="text-[6.5px] text-gray-600 dark:text-gray-400 leading-relaxed">
            I have read and agree to the{" "}
            <span className="text-brand-500 underline">Privacy Policy</span> and{" "}
            <span className="text-brand-500 underline">SMS Terms</span>.
          </div>
        </div>
      </div>
      <div className="bg-brand-500 text-white text-[7px] font-medium text-center py-1.5 rounded-md">
        Subscribe to SMS Updates
      </div>
    </div>
  );
}

function PhoneEntryScreen() {
  return (
    <div className="h-full bg-white dark:bg-gray-800 p-3 flex flex-col">
      <div className="text-[9px] font-bold text-gray-800 dark:text-gray-200 mb-1">
        Verify Your Number
      </div>
      <div className="text-[7px] text-gray-500 mb-3">
        We&apos;ll send a confirmation code
      </div>
      <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-2 mb-2">
        <div className="text-[7px] text-gray-500 mb-1">Phone Number</div>
        <div className="flex items-center gap-1">
          <span className="text-[8px]">🇺🇸</span>
          <div className="text-[9px] font-mono text-gray-800 dark:text-gray-200 tracking-wider">
            +1 (555) 123-4567
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 mb-3">
        <Shield className="w-3 h-3 text-green-500" />
        <div className="text-[6.5px] text-green-600 dark:text-green-400">
          Your number is encrypted and never shared
        </div>
      </div>
      <div className="bg-brand-500 text-white text-[7px] font-medium text-center py-1.5 rounded-md flex items-center justify-center gap-1">
        <Phone className="w-3 h-3" />
        Send Verification Code
      </div>
      {/* Numeric keyboard hint */}
      <div className="mt-auto grid grid-cols-3 gap-1 pt-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, "*", 0, "#"].map((n) => (
          <div
            key={n}
            className="bg-gray-100 dark:bg-gray-700 rounded text-center py-1 text-[8px] text-gray-600 dark:text-gray-400"
          >
            {n}
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfirmationScreen() {
  return (
    <div className="h-full bg-gray-100 dark:bg-gray-900 p-2 flex flex-col">
      <div className="flex items-center gap-1.5 mb-2">
        <MessageSquare className="w-3.5 h-3.5 text-brand-500" />
        <div className="text-[8px] font-medium text-gray-800 dark:text-gray-200">
          Messages
        </div>
      </div>
      {/* Incoming message */}
      <div className="flex flex-col gap-1.5 flex-1">
        <div className="self-start max-w-[85%]">
          <div className="bg-white dark:bg-gray-700 rounded-2xl rounded-tl-sm p-2 shadow-sm">
            <div className="text-[7px] text-gray-800 dark:text-gray-200 leading-relaxed">
              <span className="font-bold">FlowSmartly:</span> Welcome! You&apos;re
              now subscribed to marketing updates.
            </div>
            <div className="text-[6px] text-gray-500 mt-1 leading-relaxed">
              Msg frequency varies. Msg & data rates may apply. Reply HELP for
              help, STOP to cancel.
            </div>
          </div>
          <div className="text-[5.5px] text-gray-400 mt-0.5 ml-1">
            Just now
          </div>
        </div>
        <div className="self-start max-w-[85%] animate-[slideUp_0.5s_ease-out_0.5s_both]">
          <div className="bg-white dark:bg-gray-700 rounded-2xl rounded-tl-sm p-2 shadow-sm">
            <div className="text-[7px] text-gray-800 dark:text-gray-200 leading-relaxed">
              🎉 Thanks for joining! Your first exclusive deal: Use code{" "}
              <span className="font-bold text-brand-500">WELCOME20</span> for
              20% off your next order!
            </div>
          </div>
        </div>
      </div>
      {/* Message input */}
      <div className="flex items-center gap-1 mt-2">
        <div className="flex-1 bg-white dark:bg-gray-700 rounded-full px-2 py-1 text-[7px] text-gray-400">
          Text Message
        </div>
        <div className="w-5 h-5 bg-brand-500 rounded-full flex items-center justify-center">
          <ArrowRight className="w-3 h-3 text-white" />
        </div>
      </div>
    </div>
  );
}

function CompleteScreen() {
  return (
    <div className="h-full bg-gradient-to-b from-green-50 to-white dark:from-green-950 dark:to-gray-800 p-3 flex flex-col items-center justify-center gap-2">
      <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center animate-[scaleIn_0.5s_ease-out]">
        <ShieldCheck className="w-8 h-8 text-green-500" />
      </div>
      <div className="text-[10px] font-bold text-green-700 dark:text-green-400">
        Fully Compliant
      </div>
      <div className="text-[7px] text-gray-500 text-center px-2">
        Consent recorded, opt-out available, TCPA & CAN-SPAM compliant
      </div>
      <div className="w-full space-y-1 mt-2">
        {[
          "Explicit consent logged",
          "Opt-out in every message",
          "Frequency disclosed",
          "Privacy policy linked",
          "Suppression list active",
        ].map((item) => (
          <div key={item} className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
            <span className="text-[6.5px] text-gray-600 dark:text-gray-400">
              {item}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SignupScreen() {
  return (
    <div className="h-full bg-white dark:bg-gray-800 p-3 flex flex-col">
      <div className="text-[9px] font-bold text-gray-800 dark:text-gray-200 mb-2">
        Join Our Newsletter
      </div>
      <div className="space-y-1.5 flex-1">
        <div>
          <div className="text-[6.5px] text-gray-500 mb-0.5">Full Name</div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded px-2 py-1 text-[8px] text-gray-800 dark:text-gray-200">
            Jane Smith
          </div>
        </div>
        <div>
          <div className="text-[6.5px] text-gray-500 mb-0.5">Email Address</div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded px-2 py-1 text-[8px] text-gray-800 dark:text-gray-200">
            jane@example.com
          </div>
        </div>
        <div>
          <div className="text-[6.5px] text-gray-500 mb-0.5">Interests</div>
          <div className="flex flex-wrap gap-1">
            {["Deals", "News", "Tips"].map((tag) => (
              <span
                key={tag}
                className="bg-brand-100 dark:bg-brand-900 text-brand-600 dark:text-brand-400 text-[6px] px-1.5 py-0.5 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="bg-brand-500 text-white text-[7px] font-medium text-center py-1.5 rounded-md">
        Subscribe
      </div>
    </div>
  );
}

function EmailConsentScreen() {
  return (
    <div className="h-full bg-white dark:bg-gray-800 p-3 flex flex-col">
      <div className="text-[9px] font-bold text-gray-800 dark:text-gray-200 mb-2">
        Communication Preferences
      </div>
      <div className="space-y-2 flex-1">
        {[
          {
            label: "Weekly Newsletter",
            desc: "Product updates and tips",
            checked: true,
          },
          {
            label: "Promotional Offers",
            desc: "Sales and exclusive deals",
            checked: true,
          },
          {
            label: "Product Announcements",
            desc: "New features and releases",
            checked: false,
          },
        ].map((pref) => (
          <div
            key={pref.label}
            className="flex items-start gap-1.5 bg-gray-50 dark:bg-gray-700 rounded-md p-1.5"
          >
            <div
              className={`w-3.5 h-3.5 mt-0.5 rounded border-2 shrink-0 flex items-center justify-center ${
                pref.checked
                  ? "border-brand-500 bg-brand-500"
                  : "border-gray-300 dark:border-gray-600"
              }`}
            >
              {pref.checked && (
                <CheckCircle2 className="w-2.5 h-2.5 text-white" />
              )}
            </div>
            <div>
              <div className="text-[7px] font-medium text-gray-800 dark:text-gray-200">
                {pref.label}
              </div>
              <div className="text-[6px] text-gray-500">{pref.desc}</div>
            </div>
          </div>
        ))}
        <div className="text-[6px] text-gray-400 leading-relaxed px-1">
          You can update your preferences or unsubscribe at any time. We send a
          maximum of 4 emails per month.
        </div>
      </div>
      <div className="bg-brand-500 text-white text-[7px] font-medium text-center py-1.5 rounded-md">
        Save Preferences & Subscribe
      </div>
    </div>
  );
}

function VerifyScreen() {
  return (
    <div className="h-full bg-gray-100 dark:bg-gray-900 p-2 flex flex-col">
      <div className="flex items-center gap-1.5 mb-2">
        <Mail className="w-3.5 h-3.5 text-brand-500" />
        <div className="text-[8px] font-medium text-gray-800 dark:text-gray-200">
          Inbox
        </div>
        <div className="ml-auto bg-red-500 text-white text-[5px] w-3 h-3 rounded-full flex items-center justify-center">
          1
        </div>
      </div>
      <div className="bg-white dark:bg-gray-700 rounded-lg p-2 shadow-sm border-l-2 border-brand-500 animate-[slideUp_0.3s_ease-out]">
        <div className="flex items-center gap-1 mb-1">
          <div className="w-4 h-4 rounded-full bg-brand-500 flex items-center justify-center">
            <MailCheck className="w-2.5 h-2.5 text-white" />
          </div>
          <div className="text-[7px] font-bold text-gray-800 dark:text-gray-200">
            Confirm Your Email
          </div>
        </div>
        <div className="text-[6.5px] text-gray-600 dark:text-gray-400 leading-relaxed mb-2">
          Hi Jane! Please confirm your email address to complete your
          subscription. Click the button below:
        </div>
        <div className="bg-brand-500 text-white text-[7px] font-medium text-center py-1 rounded animate-pulse">
          Confirm Subscription
        </div>
        <div className="text-[5.5px] text-gray-400 mt-1.5 leading-relaxed">
          If you did not request this, you can safely ignore this email.
        </div>
      </div>
      <div className="mt-2 bg-white dark:bg-gray-700 rounded-lg p-2 shadow-sm opacity-50">
        <div className="text-[7px] text-gray-500">Other emails...</div>
      </div>
    </div>
  );
}

function PreferencesScreen() {
  return (
    <div className="h-full bg-white dark:bg-gray-800 p-3 flex flex-col">
      <div className="text-[9px] font-bold text-gray-800 dark:text-gray-200 mb-1">
        Subscription Center
      </div>
      <div className="text-[6.5px] text-gray-500 mb-2">
        Manage what you receive
      </div>
      <div className="space-y-1.5 flex-1">
        {[
          { label: "Weekly Digest", on: true },
          { label: "Flash Sales", on: true },
          { label: "Product Tips", on: false },
          { label: "Event Invites", on: true },
        ].map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded px-2 py-1.5"
          >
            <span className="text-[7px] text-gray-700 dark:text-gray-300">
              {item.label}
            </span>
            <div
              className={`w-6 h-3.5 rounded-full relative transition-colors ${
                item.on
                  ? "bg-brand-500"
                  : "bg-gray-300 dark:bg-gray-600"
              }`}
            >
              <div
                className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white shadow-sm transition-transform ${
                  item.on ? "left-3" : "left-0.5"
                }`}
              />
            </div>
          </div>
        ))}
        <div className="flex items-center gap-1 mt-1">
          <Bell className="w-3 h-3 text-gray-400" />
          <span className="text-[6px] text-gray-400">
            Frequency: Max 4 emails/month
          </span>
        </div>
      </div>
      <div className="text-[6px] text-center text-red-400 underline cursor-pointer">
        Unsubscribe from all emails
      </div>
    </div>
  );
}

function EmailCompleteScreen() {
  return (
    <div className="h-full bg-gradient-to-b from-blue-50 to-white dark:from-blue-950 dark:to-gray-800 p-3 flex flex-col items-center justify-center gap-2">
      <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center animate-[scaleIn_0.5s_ease-out]">
        <MailCheck className="w-8 h-8 text-blue-500" />
      </div>
      <div className="text-[10px] font-bold text-blue-700 dark:text-blue-400">
        CAN-SPAM Compliant
      </div>
      <div className="text-[7px] text-gray-500 text-center px-2">
        Double opt-in verified, preferences managed, instant unsubscribe
      </div>
      <div className="w-full space-y-1 mt-2">
        {[
          "Double opt-in confirmed",
          "Unsubscribe in every email",
          "Physical address included",
          "Sender clearly identified",
          "Preferences center active",
        ].map((item) => (
          <div key={item} className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-blue-500 shrink-0" />
            <span className="text-[6.5px] text-gray-600 dark:text-gray-400">
              {item}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StopScreen() {
  return (
    <div className="h-full bg-gray-100 dark:bg-gray-900 p-2 flex flex-col">
      <div className="flex items-center gap-1.5 mb-2">
        <MessageSquare className="w-3.5 h-3.5 text-gray-500" />
        <div className="text-[8px] font-medium text-gray-800 dark:text-gray-200">
          Messages
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-end gap-1.5">
        {/* Previous marketing message */}
        <div className="self-start max-w-[85%]">
          <div className="bg-white dark:bg-gray-700 rounded-2xl rounded-tl-sm p-2 shadow-sm">
            <div className="text-[7px] text-gray-800 dark:text-gray-200">
              🛍️ New arrivals just dropped! Check out our spring collection...
            </div>
          </div>
        </div>
        {/* User reply STOP */}
        <div className="self-end max-w-[70%] animate-[slideUp_0.3s_ease-out]">
          <div className="bg-brand-500 rounded-2xl rounded-tr-sm p-2 shadow-sm">
            <div className="text-[9px] font-bold text-white tracking-wider text-center">
              STOP
            </div>
          </div>
          <div className="text-[5.5px] text-gray-400 mt-0.5 text-right mr-1">
            Just now
          </div>
        </div>
      </div>
      {/* Message input */}
      <div className="flex items-center gap-1 mt-2">
        <div className="flex-1 bg-white dark:bg-gray-700 rounded-full px-2 py-1 text-[7px] text-gray-400">
          Text Message
        </div>
        <div className="w-5 h-5 bg-brand-500 rounded-full flex items-center justify-center">
          <ArrowRight className="w-3 h-3 text-white" />
        </div>
      </div>
    </div>
  );
}

function ProcessingScreen() {
  return (
    <div className="h-full bg-white dark:bg-gray-800 p-3 flex flex-col items-center justify-center gap-3">
      <div className="relative">
        <div className="w-16 h-16 rounded-full border-4 border-orange-200 dark:border-orange-800 flex items-center justify-center">
          <PhoneOff className="w-8 h-8 text-orange-500" />
        </div>
        {/* Spinning ring */}
        <svg
          className="absolute inset-0 w-16 h-16 animate-spin"
          style={{ animationDuration: "2s" }}
        >
          <circle
            cx="32"
            cy="32"
            r="28"
            fill="none"
            className="stroke-orange-500"
            strokeWidth="4"
            strokeDasharray="40 136"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className="text-[9px] font-bold text-orange-600 dark:text-orange-400">
        Processing Opt-Out...
      </div>
      <div className="space-y-1 w-full max-w-[160px]">
        {[
          { label: "Request received", done: true },
          { label: "Updating contact record", done: true },
          { label: "Adding to suppression list", done: false },
        ].map((step) => (
          <div key={step.label} className="flex items-center gap-1.5">
            {step.done ? (
              <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
            ) : (
              <div className="w-3 h-3 rounded-full border-2 border-orange-300 animate-pulse shrink-0" />
            )}
            <span
              className={`text-[6.5px] ${step.done ? "text-gray-600 dark:text-gray-400" : "text-orange-500 font-medium"}`}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfirmOptOutScreen() {
  return (
    <div className="h-full bg-gray-100 dark:bg-gray-900 p-2 flex flex-col">
      <div className="flex items-center gap-1.5 mb-2">
        <MessageSquare className="w-3.5 h-3.5 text-gray-500" />
        <div className="text-[8px] font-medium text-gray-800 dark:text-gray-200">
          Messages
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-end gap-1.5">
        <div className="self-end max-w-[70%]">
          <div className="bg-brand-500 rounded-2xl rounded-tr-sm p-2 shadow-sm">
            <div className="text-[8px] font-bold text-white text-center">
              STOP
            </div>
          </div>
        </div>
        <div className="self-start max-w-[85%] animate-[slideUp_0.5s_ease-out]">
          <div className="bg-white dark:bg-gray-700 rounded-2xl rounded-tl-sm p-2 shadow-sm border-l-2 border-green-500">
            <div className="text-[7px] text-gray-800 dark:text-gray-200 leading-relaxed">
              <span className="font-bold">FlowSmartly:</span> You have been
              successfully unsubscribed. You will not receive any more marketing
              messages from this number.
            </div>
            <div className="text-[6px] text-gray-500 mt-1">
              Reply START to re-subscribe. Need help? Reply HELP.
            </div>
          </div>
          <div className="text-[5.5px] text-gray-400 mt-0.5 ml-1">
            Just now
          </div>
        </div>
      </div>
    </div>
  );
}

function SuppressedScreen() {
  return (
    <div className="h-full bg-gradient-to-b from-red-50 to-white dark:from-red-950 dark:to-gray-800 p-3 flex flex-col items-center justify-center gap-2">
      <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center animate-[scaleIn_0.5s_ease-out]">
        <Ban className="w-8 h-8 text-red-500" />
      </div>
      <div className="text-[10px] font-bold text-red-700 dark:text-red-400">
        Permanently Suppressed
      </div>
      <div className="text-[7px] text-gray-500 text-center px-2">
        This contact will never receive marketing messages again unless they
        re-subscribe
      </div>
      <div className="w-full space-y-1 mt-2">
        {[
          "All campaigns blocked",
          "All automations skipped",
          "Cross-channel suppressed",
          "Audit trail recorded",
          "Re-subscribe option available",
        ].map((item) => (
          <div key={item} className="flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-red-500 shrink-0" />
            <span className="text-[6.5px] text-gray-600 dark:text-gray-400">
              {item}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Screen Renderer ─────────────────────────────────────────────────
function renderScreen(screen: string) {
  switch (screen) {
    case "website":
      return <WebsiteScreen />;
    case "consent":
      return <ConsentScreen />;
    case "phone":
      return <PhoneEntryScreen />;
    case "confirmation":
      return <ConfirmationScreen />;
    case "complete":
      return <CompleteScreen />;
    case "signup":
      return <SignupScreen />;
    case "emailConsent":
      return <EmailConsentScreen />;
    case "verify":
      return <VerifyScreen />;
    case "preferences":
      return <PreferencesScreen />;
    case "emailComplete":
      return <EmailCompleteScreen />;
    case "stop":
      return <StopScreen />;
    case "processing":
      return <ProcessingScreen />;
    case "confirm":
      return <ConfirmOptOutScreen />;
    case "suppressed":
      return <SuppressedScreen />;
    default:
      return null;
  }
}

// ─── Interactive Flow Section ────────────────────────────────────────
function FlowSection({
  title,
  subtitle,
  icon: Icon,
  iconColor,
  bgGradient,
  steps,
  autoPlay = true,
}: {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  iconColor: string;
  bgGradient: string;
  steps: typeof smsOptInSteps;
  autoPlay?: boolean;
}) {
  const [activeStep, setActiveStep] = useState(0);
  const [isClicking, setIsClicking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const advanceStep = useCallback(() => {
    if (isPaused) return;
    setIsClicking(true);
    setTimeout(() => {
      setIsClicking(false);
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 300);
  }, [isPaused, steps.length]);

  // Auto-advance
  useEffect(() => {
    if (!autoPlay || isPaused) return;
    const interval = setInterval(advanceStep, 3000);
    return () => clearInterval(interval);
  }, [autoPlay, isPaused, advanceStep]);

  return (
    <div className={`relative overflow-hidden rounded-3xl ${bgGradient} p-6 sm:p-10`}>
      {/* Floating decorative elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

      <div className="relative z-10">
        {/* Section header */}
        <div className="flex items-center gap-3 mb-2">
          <div
            className={`w-10 h-10 rounded-xl ${iconColor} flex items-center justify-center`}
          >
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">{title}</h2>
            <p className="text-sm text-white/70">{subtitle}</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 mt-8">
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
                <PhoneMockup>{renderScreen(steps[activeStep].screen)}</PhoneMockup>
              </div>
              {/* Hand cursor */}
              <HandCursor
                active={true}
                clicking={isClicking}
                className="absolute -bottom-2 -right-4 sm:-right-6"
              />
              {/* Tap to pause hint */}
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] text-white/50">
                {isPaused ? "Tap phone to resume" : "Tap phone to pause"}
              </div>
            </div>
          </div>

          {/* Steps list */}
          <div className="flex flex-col gap-3 justify-center">
            {steps.map((step, index) => (
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
                {/* Step number */}
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
                    <span className="text-sm font-bold">{step.id}</span>
                  )}
                </div>
                <div>
                  <div
                    className={`text-sm font-semibold transition-colors ${
                      index === activeStep ? "text-white" : "text-white/70"
                    }`}
                  >
                    {step.title}
                  </div>
                  <div
                    className={`text-xs mt-0.5 transition-colors leading-relaxed ${
                      index === activeStep
                        ? "text-white/80"
                        : "text-white/50"
                    }`}
                  >
                    {step.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Compliance Feature Card ─────────────────────────────────────────
function FeatureCard({
  icon: Icon,
  title,
  description,
  color,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
}) {
  return (
    <div className="group relative bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
      <div
        className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
      >
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
        {title}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
        {description}
      </p>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────
export default function MarketingCompliancePage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen">
      {/* Custom CSS animations */}
      <style jsx global>{`
        @keyframes scaleIn {
          from {
            transform: scale(0);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes slideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        @keyframes pulseGlow {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4);
          }
          50% {
            box-shadow: 0 0 20px 10px rgba(59, 130, 246, 0.1);
          }
        }
        @keyframes gradientShift {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
      `}</style>

      {/* Hero Section */}
      <section
        className={`relative overflow-hidden bg-gradient-to-br from-gray-900 via-brand-950 to-gray-900 py-20 sm:py-28 transition-opacity duration-1000 ${
          mounted ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Animated background grid */}
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%">
            <defs>
              <pattern
                id="grid"
                width="40"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 40 0 L 0 0 0 40"
                  fill="none"
                  stroke="white"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>
        {/* Floating orbs */}
        <div
          className="absolute top-20 left-[15%] w-32 h-32 bg-brand-500/20 rounded-full blur-3xl"
          style={{ animation: "float 6s ease-in-out infinite" }}
        />
        <div
          className="absolute bottom-20 right-[20%] w-40 h-40 bg-blue-500/20 rounded-full blur-3xl"
          style={{ animation: "float 8s ease-in-out infinite 2s" }}
        />
        <div
          className="absolute top-40 right-[10%] w-24 h-24 bg-green-500/20 rounded-full blur-3xl"
          style={{ animation: "float 5s ease-in-out infinite 1s" }}
        />

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <div
            className={`inline-flex items-center gap-2 bg-brand-500/20 text-brand-300 text-sm font-medium px-4 py-2 rounded-full mb-6 border border-brand-500/30 transition-all duration-700 delay-200 ${
              mounted
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            TCPA & CAN-SPAM Compliant
          </div>
          <h1
            className={`text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6 transition-all duration-700 delay-300 ${
              mounted
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            }`}
          >
            Marketing Compliance{" "}
            <span className="bg-gradient-to-r from-brand-400 to-blue-400 bg-clip-text text-transparent">
              Built In
            </span>
          </h1>
          <p
            className={`text-lg sm:text-xl text-gray-300 max-w-3xl mx-auto mb-10 leading-relaxed transition-all duration-700 delay-500 ${
              mounted
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            }`}
          >
            FlowSmartly enforces proper opt-in and opt-out flows for every SMS
            and email campaign. See exactly how we protect your business and your
            customers.
          </p>

          {/* Trust indicators */}
          <div
            className={`flex flex-wrap justify-center gap-6 sm:gap-10 transition-all duration-700 delay-700 ${
              mounted
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            }`}
          >
            {[
              { icon: Shield, label: "TCPA Compliant" },
              { icon: Mail, label: "CAN-SPAM Ready" },
              { icon: Eye, label: "Full Audit Trail" },
              { icon: UserCheck, label: "Consent Management" },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-2 text-gray-400"
              >
                <item.icon className="w-5 h-5 text-brand-400" />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SMS Opt-In Flow */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <FlowSection
          title="SMS Opt-In Flow"
          subtitle="How customers subscribe to your SMS marketing"
          icon={MessageSquare}
          iconColor="bg-green-500"
          bgGradient="bg-gradient-to-br from-green-600 via-green-700 to-emerald-800"
          steps={smsOptInSteps}
        />
      </section>

      {/* Email Opt-In Flow */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16 sm:pb-20">
        <FlowSection
          title="Email Opt-In Flow"
          subtitle="Double opt-in email subscription process"
          icon={Mail}
          iconColor="bg-blue-500"
          bgGradient="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800"
          steps={emailOptInSteps}
        />
      </section>

      {/* Opt-Out Flow */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16 sm:pb-20">
        <FlowSection
          title="Opt-Out Flow"
          subtitle="Instant, frictionless unsubscribe process"
          icon={Ban}
          iconColor="bg-red-500"
          bgGradient="bg-gradient-to-br from-red-600 via-red-700 to-rose-800"
          steps={optOutSteps}
        />
      </section>

      {/* Compliance Features Grid */}
      <section className="bg-gray-50 dark:bg-gray-900/50 py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Compliance Features
            </h2>
            <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
              Every tool and safeguard your business needs to stay compliant
              with SMS and email marketing regulations.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={UserCheck}
              title="Explicit Consent Collection"
              description="Every subscriber must provide clear, affirmative consent before receiving any marketing messages. No pre-checked boxes."
              color="bg-green-500"
            />
            <FeatureCard
              icon={Shield}
              title="Consent Audit Trail"
              description="Every opt-in is timestamped and logged with the exact consent language shown. Full audit trail for regulatory review."
              color="bg-blue-500"
            />
            <FeatureCard
              icon={Ban}
              title="Instant Opt-Out"
              description="Reply STOP to any SMS or click Unsubscribe in any email. Processing is immediate — zero delay, zero friction."
              color="bg-red-500"
            />
            <FeatureCard
              icon={Lock}
              title="Global Suppression List"
              description="Opted-out contacts are blocked across ALL campaigns, automations, and future sends. No way to accidentally message them."
              color="bg-purple-500"
            />
            <FeatureCard
              icon={Eye}
              title="Privacy Policy Verification"
              description="We verify your privacy policy URL is accessible and contains required disclosures before activating SMS marketing."
              color="bg-orange-500"
            />
            <FeatureCard
              icon={Bell}
              title="Rate Limiting & Quiet Hours"
              description="Built-in safeguards prevent excessive messaging. Respect quiet hours and frequency caps for every subscriber."
              color="bg-teal-500"
            />
          </div>
        </div>
      </section>

      {/* Regulations Banner */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 dark:from-gray-800 dark:to-gray-700 rounded-3xl p-8 sm:p-12">
          <div className="grid sm:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-brand-400 mb-2">TCPA</div>
              <div className="text-sm text-gray-300 font-medium mb-1">
                Telephone Consumer Protection Act
              </div>
              <div className="text-xs text-gray-500 leading-relaxed">
                Prior express written consent for all marketing SMS. Clear
                disclosure of message frequency and data rates.
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-400 mb-2">
                CAN-SPAM
              </div>
              <div className="text-sm text-gray-300 font-medium mb-1">
                Controlling the Assault of Non-Solicited Pornography And
                Marketing Act
              </div>
              <div className="text-xs text-gray-500 leading-relaxed">
                Accurate sender info, clear subject lines, physical address,
                and instant unsubscribe in every email.
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-400 mb-2">
                CTIA
              </div>
              <div className="text-sm text-gray-300 font-medium mb-1">
                Cellular Telecommunications Industry Association
              </div>
              <div className="text-xs text-gray-500 leading-relaxed">
                Industry best practices for SMS marketing including opt-in
                confirmation, HELP/STOP keywords, and message content
                guidelines.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-brand-500 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to Send Compliant Marketing?
          </h2>
          <p className="text-lg text-brand-100 mb-8 max-w-2xl mx-auto">
            FlowSmartly handles the compliance so you can focus on growing your
            business. Every message, every campaign, fully protected.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="bg-white text-brand-600 font-semibold px-8 py-3 rounded-xl hover:bg-brand-50 transition-colors shadow-lg"
            >
              Get Started Free
            </Link>
            <Link
              href="/privacy"
              className="text-white font-medium px-8 py-3 rounded-xl border border-white/30 hover:bg-white/10 transition-colors"
            >
              Read Our Privacy Policy
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
