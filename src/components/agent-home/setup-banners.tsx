"use client";

import { useCallback, useEffect, useState, type ElementType, type ReactNode } from "react";
import Link from "next/link";
import { Mail, Palette, Target, Zap, X, CheckCircle2 } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

interface OnboardingState {
  emailVerified: boolean;
  brandSetup: boolean;
  hasStrategy: boolean;
  strategyId: string | null;
  hasAutomation: boolean;
  dismissedBanners: string[];
}

interface BannerConfig {
  id: string;
  icon: ElementType;
  title: string;
  description: string;
  cta: string;
  href: string;
  wash: string;
  iconColor: string;
}

/**
 * Setup prompts for the agent home, in the NEW design — verify email + the
 * progressive onboarding nudges (brand → strategy → automation). Same data
 * sources as the legacy dashboard banners (`/api/user/onboarding-state`,
 * `/api/auth/send-verification`, `/api/user/dismiss-banner`), reskinned to the
 * agent-home aesthetic. Shows one banner at a time; dismissible.
 */
export function SetupBanners() {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/user/onboarding-state")
      .then((r) => r.json())
      .then((j) => {
        if (alive && j?.success && j.data) {
          setState(j.data);
          setDismissed(j.data.dismissedBanners ?? []);
        }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const dismiss = useCallback(async (id: string) => {
    setHiddenIds((p) => [...p, id]);
    setDismissed((p) => [...p, id]);
    try {
      await fetch("/api/user/dismiss-banner", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bannerId: id }) });
    } catch {
      /* ignore */
    }
  }, []);

  const sendVerification = async () => {
    setSending(true);
    try {
      const r = await fetch("/api/auth/send-verification", { method: "POST" });
      const d = await r.json();
      if (d.success) setSent(true);
    } catch {
      /* ignore */
    } finally {
      setSending(false);
    }
  };

  if (!state) return null;

  // Email verification takes priority over the onboarding nudges.
  if (!state.emailVerified) {
    if (hiddenIds.includes("verify-email")) return null;
    return (
      <div className="px-3 pt-3 sm:px-4">
        <BannerShell
          wash="from-amber-500/12 via-orange-500/10 to-amber-500/12"
          icon={Mail}
          iconColor="text-amber-500"
          title={sent ? "Check your inbox" : "Verify your email"}
          description={sent ? "A verification link is on its way — confirm to unlock everything." : "Confirm your email to unlock content generation, scheduling, and more."}
          onDismiss={() => dismiss("verify-email")}
          action={
            sent ? (
              <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-emerald-500"><CheckCircle2 className="h-4 w-4" /> Sent</span>
            ) : (
              <button
                onClick={sendVerification}
                disabled={sending}
                className="inline-flex items-center gap-1.5 rounded-[10px] bg-foreground px-3.5 py-1.5 text-[12.5px] font-semibold text-background transition hover:bg-foreground/90 disabled:opacity-60"
              >
                {sending && <FlowLoader size={15} />} {sending ? "Sending…" : "Send link"}
              </button>
            )
          }
        />
      </div>
    );
  }

  const banners: BannerConfig[] = [];
  if (!state.brandSetup) {
    banners.push({ id: "setup-brand", icon: Palette, title: "Set up your brand identity", description: "Tell the agent about your brand to unlock on-brand content, strategy, and more.", cta: "Set up brand", href: "/brand", wash: "from-violet-500/12 via-fuchsia-500/10 to-violet-500/12", iconColor: "text-violet-500" });
  }
  if (state.brandSetup && !state.hasStrategy) {
    banners.push({ id: "create-strategy", icon: Target, title: "Create your marketing strategy", description: "Generate an AI strategy with tasks, timelines, and progress tracking.", cta: "Create strategy", href: "/content/strategy/generate", wash: "from-brand-500/12 via-cyan-500/10 to-brand-500/12", iconColor: "text-brand-500" });
  }
  if (state.hasStrategy && !state.hasAutomation) {
    banners.push({ id: "automate-strategy", icon: Zap, title: "Put your strategy on autopilot", description: "AI generates posts on your schedule, tracks progress, and scores performance.", cta: "Automate now", href: state.strategyId ? `/content/strategy?view=automations&strategy=${state.strategyId}` : "/content/strategy?view=automations", wash: "from-amber-500/12 via-orange-500/10 to-amber-500/12", iconColor: "text-amber-500" });
  }

  const active = banners.find((b) => !dismissed.includes(b.id) && !hiddenIds.includes(b.id));
  if (!active) return null;

  return (
    <div className="px-3 pt-3 sm:px-4">
      <BannerShell
        wash={active.wash}
        icon={active.icon}
        iconColor={active.iconColor}
        title={active.title}
        description={active.description}
        onDismiss={() => dismiss(active.id)}
        action={
          <Link href={active.href} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-1.5 text-[12.5px] font-semibold text-white shadow-sm transition hover:opacity-95">
            {active.cta}
          </Link>
        }
      />
    </div>
  );
}

function BannerShell({ wash, icon: Icon, iconColor, title, description, action, onDismiss }: {
  wash: string;
  icon: ElementType;
  iconColor: string;
  title: string;
  description: string;
  action: ReactNode;
  onDismiss: () => void;
}) {
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl border border-border bg-gradient-to-r px-3.5 py-2.5 sm:px-4", wash)}>
      <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border bg-background/70", iconColor)}>
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-semibold text-foreground">{title}</p>
        <p className="truncate text-[12px] text-muted-foreground">{description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {action}
        <button onClick={onDismiss} className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-background/60 hover:text-foreground" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
