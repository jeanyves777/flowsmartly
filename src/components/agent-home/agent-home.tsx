"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Sun, Moon, Plus, Mic, ArrowUp, Sparkles, X, CalendarDays, Palette, Video, ShoppingBag } from "lucide-react";
import { PageLoader } from "@/components/shared/page-loader";
import { AISpinner } from "@/components/shared/ai-generation-loader";
import { cn } from "@/lib/utils/cn";
import { usePreferredLanguage } from "@/hooks/use-preferred-language";
import { getHomeStrings } from "./home-i18n";
import { WORKSPACES } from "./workspaces";
import { BrandMark, BrandWordmark } from "./brand-mark";
import { LanguageSwitcher } from "./language-switcher";
import { EditableDesignCard } from "./cards/editable-design-card";
import { PipelineFlowCard } from "./cards/pipeline-flow-card";
import { PlanCard } from "./cards/plan-card";

interface SessionUser {
  name: string;
  aiCredits: number;
  avatarUrl: string | null;
}

const WS_DESC: Record<string, string> = {
  create: "Design studio, logos, video studio, cartoon maker, media library.",
  publish: "Social accounts, posts, content calendar and scheduling.",
  grow: "Content automation & strategy, email, SMS, WhatsApp, ad builder, story-ad campaigns.",
  sell: "Store builder, products, orders, customers, delivery, pricing, storefronts.",
  web: "Website builder, landing pages, and domains.",
  outreach: "Contacts & lists, reviews / local SEO, pitch board & proposals, follow-ups, forms, events.",
  business: "Brand kit, analytics, credits & billing, teams, referrals, settings, admin.",
};

interface Msg {
  id: number;
  role: "user" | "ai";
  text: string;
}

export function AgentHome() {
  const router = useRouter();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { language, setLanguage, dir } = usePreferredLanguage();
  const s = getHomeStrings(language);

  const [mounted, setMounted] = useState(false);
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [brandName, setBrandName] = useState("Your brand");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [activeWs, setActiveWs] = useState("home");
  const [panelKey, setPanelKey] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(0);

  useEffect(() => setMounted(true), []);

  // Boot: load session + brand, then lift the unified loader.
  useEffect(() => {
    let alive = true;
    const started = Date.now();
    (async () => {
      try {
        const [meRes, brandRes] = await Promise.all([
          fetch("/api/auth/me").then((r) => r.json()).catch(() => null),
          fetch("/api/brand").then((r) => r.json()).catch(() => null),
        ]);
        if (alive && meRes?.success && meRes.data?.user) {
          const u = meRes.data.user;
          setUser({ name: u.name || "there", aiCredits: u.aiCredits ?? 0, avatarUrl: u.avatarUrl ?? null });
        }
        if (alive && brandRes?.success && brandRes.data?.brandKit?.name) {
          setBrandName(brandRes.data.brandKit.name);
        }
      } finally {
        const wait = Math.max(0, 700 - (Date.now() - started));
        setTimeout(() => alive && setBooting(false), wait);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const showToast = useCallback((m: string) => {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  }, []);

  const send = useCallback((text: string) => {
    const t = text.trim();
    if (!t) return;
    setDraft("");
    if (taRef.current) taRef.current.style.height = "auto";
    setMessages((prev) => [
      ...prev,
      { id: ++idRef.current, role: "user", text: t },
      { id: ++idRef.current, role: "ai", text: t },
    ]);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const toggleTheme = () => setTheme((resolvedTheme ?? theme) === "dark" ? "light" : "dark");
  const initials = (user?.name ?? "JY").split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const isDark = (resolvedTheme ?? theme) === "dark";

  if (booting) {
    return (
      <div className="fixed inset-0 z-[100] grid place-items-center bg-background">
        <PageLoader tips={["Loading your workspace…", "Syncing your brand kit…", "Warming up the agent…"]} />
      </div>
    );
  }

  return (
    <div
      dir={dir}
      className="flex h-screen flex-col bg-background text-foreground"
      style={{
        backgroundImage:
          "radial-gradient(1100px 600px at 82% -10%, rgba(14,165,233,.10), transparent 60%), radial-gradient(900px 600px at -5% 110%, rgba(139,92,246,.09), transparent 55%)",
      }}
    >
      {/* ===== TOP BAR ===== */}
      <header className="flex h-14 items-center gap-3 border-b border-border bg-background/70 px-4 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <BrandMark size={36} />
          <BrandWordmark className="text-[16px]" />
        </div>
        <button className="ms-1.5 flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[12.5px] text-muted-foreground">
          ◑ <b className="text-foreground">{brandName}</b> ▾
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-1 rounded-full border border-border bg-gradient-to-r from-brand-500/15 to-violet-500/15 px-3 py-1.5 text-[12.5px]">
          ⚡{" "}
          <b className="bg-gradient-to-r from-brand-500 to-violet-500 bg-clip-text font-extrabold text-transparent">
            {(user?.aiCredits ?? 0).toLocaleString()}
          </b>{" "}
          <span className="text-muted-foreground">{s.credits}</span>
        </div>
        <LanguageSwitcher language={language} onChange={setLanguage} />
        <button
          onClick={toggleTheme}
          title="Toggle theme"
          aria-label="Toggle theme"
          className="grid h-9 w-9 place-items-center rounded-[10px] border border-border bg-card text-muted-foreground transition-colors hover:border-brand-500/60 hover:text-foreground"
        >
          {mounted && isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>
        <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-pink-500 to-violet-500 text-[12px] font-bold text-white">
          {initials}
        </div>
      </header>

      {/* ===== BODY: rail + main ===== */}
      <div className="flex min-h-0 flex-1">
        {/* workspace rail */}
        <nav className="flex w-[84px] shrink-0 flex-col items-center gap-1 border-e border-border bg-card/50 py-3">
          {WORKSPACES.map((w, i) => {
            const Icon = w.icon;
            const active = activeWs === w.key;
            return (
              <div key={w.key} className="contents">
                <button
                  onClick={() => {
                    setActiveWs(w.key);
                    if (w.key === "home") setPanelKey(null);
                    else setPanelKey(w.key);
                  }}
                  className={cn(
                    "relative flex w-[66px] flex-col items-center gap-1.5 rounded-[13px] py-2.5 text-[10px] transition-colors",
                    active
                      ? "bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {active && <span className="absolute inset-y-4 start-[-1px] w-[3px] rounded bg-gradient-to-b from-brand-500 to-violet-500" />}
                  <Icon className="h-[21px] w-[21px]" />
                  <span>{s.ws[w.key] ?? w.label}</span>
                </button>
                {(i === 0 || w.key === "outreach") && <div className="my-1.5 h-px w-11 bg-border" />}
              </div>
            );
          })}
        </nav>

        {/* main column */}
        <main className="relative flex min-w-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-[clamp(16px,6vw,110px)] pb-40 pt-7">
            {messages.length === 0 ? (
              <section className="mx-auto mt-[7vh] max-w-[780px]">
                <h1 className="text-[31px] font-extrabold leading-[1.12] tracking-tight">
                  {s.greet}{" "}
                  <span className="bg-gradient-to-r from-brand-500 to-violet-500 bg-clip-text text-transparent">{s.accent}</span>
                </h1>
                <p className="mb-6 mt-2 text-[15px] leading-relaxed text-muted-foreground">{s.sub}</p>
                <div className="flex flex-wrap gap-2.5">
                  {s.chips.map((c, i) => {
                    const Icon = [Palette, CalendarDays, Video, ShoppingBag][i];
                    return (
                      <button
                        key={i}
                        onClick={() => send(c)}
                        className="flex items-center gap-2 rounded-[11px] border border-border bg-card px-3.5 py-2.5 text-[13px] transition-all hover:-translate-y-px hover:border-brand-500/60"
                      >
                        <Icon className="h-[15px] w-[15px] text-brand-500" /> {c}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-7 grid grid-cols-[repeat(auto-fill,minmax(165px,1fr))] gap-2.5">
                  {[
                    [Palette, "Design something", "On-brand post, flyer, or ad — editable right in the chat."],
                    [CalendarDays, "Plan my week", "A full content calendar, scheduled across your channels."],
                    [Video, "Make a video", "Multi-scene ad with a flow you can tweak scene-by-scene."],
                    [ShoppingBag, "Build a store", "Domain, storefront, products — assembled end to end."],
                  ].map(([Icon, title, desc], i) => {
                    const I = Icon as typeof Palette;
                    return (
                      <button
                        key={i}
                        onClick={() => send(s.chips[i])}
                        className="rounded-[13px] border border-border bg-card p-3.5 text-start transition-all hover:-translate-y-0.5 hover:border-brand-500/60 hover:shadow-lg"
                      >
                        <span className="mb-2.5 grid h-[30px] w-[30px] place-items-center rounded-[9px] bg-gradient-to-br from-brand-500/20 to-violet-500/20 text-brand-500">
                          <I className="h-[15px] w-[15px]" />
                        </span>
                        <div className="text-[13px] font-semibold">{title as string}</div>
                        <div className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">{desc as string}</div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : (
              <div>
                {messages.map((m) =>
                  m.role === "user" ? (
                    <UserBubble key={m.id} text={m.text} initials={initials} />
                  ) : (
                    <AiReply key={m.id} onToast={showToast} />
                  ),
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* composer */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/90 to-transparent px-[clamp(16px,6vw,110px)] pb-5 pt-3.5">
            <div className="pointer-events-auto mx-auto max-w-[840px] rounded-2xl border border-border bg-card shadow-lg">
              <div className="px-3 pt-2.5">
                <span className="inline-flex cursor-default items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11.5px] text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-brand-500" /> <b className="text-foreground">Auto</b> · smart routing
                </span>
              </div>
              <div className="flex items-end gap-2.5 px-3 pb-3 pt-2">
                <button className="grid h-9 w-9 place-items-center rounded-[10px] border border-border text-muted-foreground hover:text-foreground" aria-label="Attach">
                  <Plus className="h-[18px] w-[18px]" />
                </button>
                <textarea
                  ref={taRef}
                  rows={1}
                  value={draft}
                  placeholder={s.placeholder}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(draft);
                    }
                  }}
                  className="max-h-[120px] flex-1 resize-none bg-transparent text-[14.5px] leading-relaxed outline-none"
                />
                <button className="grid h-9 w-9 place-items-center rounded-[10px] border border-border text-muted-foreground hover:text-foreground" aria-label="Voice">
                  <Mic className="h-[18px] w-[18px]" />
                </button>
                <button
                  onClick={() => send(draft)}
                  aria-label="Send"
                  className="grid h-[38px] w-[38px] place-items-center rounded-[11px] bg-gradient-to-r from-brand-500 to-violet-500 text-white"
                >
                  <ArrowUp className="h-[18px] w-[18px]" />
                </button>
              </div>
            </div>
            <p className="mx-auto mt-2 max-w-[840px] text-center text-[11px] text-muted-foreground">{s.hint}</p>
          </div>

          {/* slide-in workspace panel */}
          <aside
            className={cn(
              "absolute inset-y-0 right-0 z-20 flex w-[min(440px,46vw)] flex-col border-s border-border bg-card shadow-2xl transition-transform duration-300",
              panelKey ? "translate-x-0" : "translate-x-full",
            )}
          >
            {panelKey && <WorkspacePanel panelKey={panelKey} label={s.ws[panelKey] ?? panelKey} onClose={() => { setPanelKey(null); setActiveWs("home"); }} onToast={showToast} onAsk={(q) => { setPanelKey(null); setActiveWs("home"); send(q); }} onOpen={(route) => router.push(route)} />}
          </aside>
        </main>
      </div>

      {/* toast */}
      {toast && (
        <div className="fixed left-1/2 top-3.5 z-[120] -translate-x-1/2 rounded-[10px] border border-border bg-card px-3.5 py-2 text-[12.5px] shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function UserBubble({ text, initials }: { text: string; initials: string }) {
  return (
    <div className="mx-auto mb-5 flex max-w-[840px] flex-row-reverse gap-3">
      <div className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-gradient-to-br from-pink-500 to-violet-500 text-[12px] font-bold text-white">
        {initials}
      </div>
      <div className="rounded-[13px] border border-brand-500/25 bg-brand-500/10 px-3.5 py-2.5">{text}</div>
    </div>
  );
}

function AiReply({ onToast }: { onToast: (m: string) => void }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDone(true), 1100);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="mx-auto mb-5 flex max-w-[840px] gap-3">
      <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-white p-1">
        <BrandMark size={22} className="shadow-none" />
      </span>
      <div className="min-w-0 flex-1">
        {!done ? (
          <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
            <AISpinner className="h-3.5 w-3.5" /> Thinking — reading your brand kit &amp; choosing a layout…
          </div>
        ) : (
          <>
            <div className="mb-2.5 text-[12.5px] text-muted-foreground">
              💭 Thought for 2s · matched <b className="text-foreground">Acme Coffee Co.</b> brand kit
            </div>
            <div className="leading-relaxed">
              Here&apos;s a <b>World Cup 2026</b> promo on your brand. I kept the copy short so it renders clean. Edit any text or the
              accent on the right — it updates live. When you like it, I&apos;ll schedule it.
            </div>
            <EditableDesignCard onToast={onToast} />
            <PipelineFlowCard onToast={onToast} />
            <PlanCard onToast={onToast} />
          </>
        )}
      </div>
    </div>
  );
}

function WorkspacePanel({
  panelKey,
  label,
  onClose,
  onAsk,
  onOpen,
}: {
  panelKey: string;
  label: string;
  onClose: () => void;
  onToast: (m: string) => void;
  onAsk: (q: string) => void;
  onOpen: (route: string) => void;
}): ReactNode {
  const ws = WORKSPACES.find((w) => w.key === panelKey);
  if (!ws) return null;
  const Icon = ws.icon;
  return (
    <>
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
        <Icon className="h-5 w-5 text-brand-500" />
        <b className="text-[15px]">{label}</b>
        <button onClick={onClose} className="ms-auto text-muted-foreground hover:text-foreground" aria-label="Close">
          <X className="h-[18px] w-[18px]" />
        </button>
      </div>
      <div className="space-y-3 overflow-auto p-4 text-[13px] leading-relaxed text-muted-foreground">
        <p className="text-foreground">{WS_DESC[panelKey]}</p>
        <div className="flex flex-wrap gap-1.5">
          {ws.items.map((it) => (
            <button
              key={it.route + it.label}
              onClick={() => onOpen(it.route)}
              className="rounded-full border border-border px-2.5 py-1 text-[10.5px] hover:border-brand-500/60 hover:text-foreground"
            >
              {it.label}
            </button>
          ))}
        </div>
        <p>Everything here is also an agent tool — say what you want and it renders in the chat, or work in the focused view.</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={() => onAsk(`Open ${label} and help me get started`)}
            className="inline-flex items-center gap-2 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"
          >
            <Sparkles className="h-4 w-4" /> Ask the agent
          </button>
          <button onClick={() => onOpen(ws.route)} className="rounded-[10px] border border-border px-4 py-2 text-[13px] font-semibold text-muted-foreground hover:text-foreground">
            Open focused view
          </button>
        </div>
      </div>
    </>
  );
}
