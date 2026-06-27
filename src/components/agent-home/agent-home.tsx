"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ThemeMenu } from "@/components/shared/theme-menu";
import {
  Menu, Sparkles, X, ChevronDown, Check, Shield, LogOut, SquarePen, History, Trash2, MessageSquare,
  Building2, Palette, Megaphone, Video, ShoppingBag, CalendarDays, Globe, TrendingUp, type LucideIcon,
} from "lucide-react";
import { PageLoader } from "@/components/shared/page-loader";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";
import { usePreferredLanguage } from "@/hooks/use-preferred-language";
import { getHomeStrings, buildGreeting } from "./home-i18n";
import { WORKSPACES } from "./workspaces";
import { BrandMark, BrandWordmark } from "./brand-mark";
import { LanguageSwitcher } from "./language-switcher";
import { useHomeAgent, type ConversationSummary } from "./use-home-agent";
import { HomeMessageView } from "./home-message";
import { Composer } from "./composer";
import { FocusedView, FocusedComingSoon } from "./focused-view";
import { FocusedDesignStudio, DEFAULT_DESIGN, designCanvasContext, applyDesignPatch, type DesignDoc } from "./focused/design-studio";

interface SessionUser { name: string; aiCredits: number; avatarUrl: string | null }
interface AgentClient { id: string; name: string }
interface AiSuggestion { label: string; hint: string; icon: string; prompt: string }

const SUG_ICON: Record<string, LucideIcon> = {
  palette: Palette, megaphone: Megaphone, video: Video, bag: ShoppingBag,
  calendar: CalendarDays, globe: Globe, trending: TrendingUp, sparkles: Sparkles,
};
const FALLBACK_ICONS: LucideIcon[] = [Palette, CalendarDays, Video, ShoppingBag];

const WS_DESC: Record<string, string> = {
  create: "Design studio, logos, video studio, cartoon maker, media library.",
  publish: "Social accounts, posts, content calendar and scheduling.",
  grow: "Content automation & strategy, email, SMS, WhatsApp, ad builder, story-ad campaigns.",
  sell: "Store builder, products, orders, customers, delivery, pricing, storefronts.",
  web: "Website builder, landing pages, and domains.",
  outreach: "Contacts & lists, reviews / local SEO, pitch board & proposals, follow-ups, forms, events.",
  business: "Brand kit, analytics, credits & billing, teams, referrals, settings, admin.",
};

export function AgentHome() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language, setLanguage, dir } = usePreferredLanguage();
  const s = getHomeStrings(language);
  const { messages, sending, conversationId, conversations, send, handlePlanResponse, handlePickTemplate, handlePickOption, loadConversation, newConversation, refreshConversations, canvasUpdateRef } = useHomeAgent();

  const [mounted, setMounted] = useState(false);
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [brandName, setBrandName] = useState<string | null>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [agentName, setAgentName] = useState<string | null>(null);
  const [clients, setClients] = useState<AgentClient[]>([]);
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);

  const [accountOpen, setAccountOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [panelKey, setPanelKey] = useState<string | null>(null);
  const [activeWs, setActiveWs] = useState("home");
  const [toast, setToast] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [design, setDesign] = useState<DesignDoc>(DEFAULT_DESIGN);

  const bottomRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let alive = true;
    const started = Date.now();
    (async () => {
      try {
        const me = await fetch("/api/auth/me").then((r) => r.json()).catch(() => null);
        if (alive && me?.success && me.data?.user) {
          const u = me.data.user;
          setUser({ name: u.name || "there", aiCredits: u.aiCredits ?? 0, avatarUrl: u.avatarUrl ?? null });
          if (me.data.isImpersonating) {
            setIsImpersonating(true);
            setAgentName(me.data.agentInfo?.agentName ?? null);
          }
        }
        fetch("/api/brand").then((r) => r.json()).then((b) => { if (alive && b?.success && b.data?.brandKit?.name) setBrandName(b.data.brandKit.name); }).catch(() => {});
        // Agent profile → managed businesses for the switcher.
        fetch("/api/agent/profile").then((r) => r.json()).then(async (p) => {
          if (!alive || p?.data?.profile?.status !== "APPROVED") return;
          const cl = await fetch("/api/agent/clients").then((r) => r.json()).catch(() => null);
          const list = cl?.data?.clients;
          if (alive && Array.isArray(list)) {
            setClients(list.map((c: { id: string; clientUser?: { name?: string } }) => ({ id: c.id, name: c.clientUser?.name || "Client" })));
          }
        }).catch(() => {});
        // AI starter suggestions (personalized) — non-blocking. Mark loaded when
        // the request RESOLVES (success or failure) so the loader can't spin
        // forever; the localized fallback chips already render meanwhile.
        fetch("/api/flow-ai/suggestions")
          .then((r) => r.json())
          .then((d) => {
            if (alive && d?.success && Array.isArray(d.data?.suggestions) && d.data.suggestions.length) setSuggestions(d.data.suggestions);
          })
          .catch(() => {})
          .finally(() => { if (alive) setSuggestionsLoaded(true); });
      } finally {
        const wait = Math.max(0, 650 - (Date.now() - started));
        setTimeout(() => alive && setBooting(false), wait);
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!accountOpen) return;
    const h = (e: MouseEvent) => { if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [accountOpen]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  // Deep-link: load ?conversationId= on first mount, and keep the URL in sync
  // as the active conversation changes — so any chat is shareable / revisitable.
  useEffect(() => {
    const cid = searchParams.get("conversationId");
    if (cid) loadConversation(cid);
    refreshConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (conversationId) url.searchParams.set("conversationId", conversationId);
    else url.searchParams.delete("conversationId");
    window.history.replaceState({}, "", url.toString());
  }, [conversationId]);

  useEffect(() => { if (conversationId) refreshConversations(); }, [conversationId, refreshConversations]);

  // Apply agent-driven canvas edits (update_canvas → canvas_update event) live.
  useEffect(() => {
    canvasUpdateRef.current = (patch) => setDesign((d) => applyDesignPatch(d, patch));
  }, [canvasUpdateRef]);

  const showToast = useCallback((m: string) => {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  }, []);

  const switchToClient = useCallback(async (clientId: string) => {
    try {
      await fetch("/api/agent/impersonate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId }) });
      window.location.href = "/home";
    } catch { showToast("Could not switch business"); }
  }, [showToast]);

  const exitImpersonation = useCallback(async () => {
    try { await fetch("/api/agent/impersonate", { method: "DELETE" }); window.location.href = "/home"; } catch { showToast("Could not exit"); }
  }, [showToast]);

  const firstName = (user?.name?.trim().split(/\s+/)[0]) || "there";
  const initials = (user?.name ?? "you").split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const accountLabel = brandName || user?.name || "My account";
  const hour = mounted ? new Date().getHours() : 18;
  const greeting = buildGreeting(s, firstName, hour);
  const empty = messages.length === 0;
  const fws = focused ? WORKSPACES.find((w) => w.key === focused) : undefined;
  const fLabel = fws ? (s.ws[fws.key] ?? fws.label) : "Focused view";
  const FIcon = fws?.icon ?? Sparkles;

  const openWorkspace = (key: string) => { setActiveWs(key); setPanelKey(key === "home" ? null : key); setDrawerOpen(false); };
  const openFocused = (key: string) => { setPanelKey(null); setActiveWs(key); setFocused(key); setDrawerOpen(false); };

  const handleNewChat = () => { newConversation(); setFocused(null); setActiveWs("home"); setPanelKey(null); setHistoryOpen(false); setDrawerOpen(false); };
  const handleOpenConversation = (id: string) => { setFocused(null); setActiveWs("home"); setPanelKey(null); setHistoryOpen(false); setDrawerOpen(false); loadConversation(id); };
  const handleDeleteConversation = async (id: string) => {
    try { await fetch(`/api/ai/assistant/conversations/${id}`, { method: "DELETE" }); } catch { /* ignore */ }
    if (id === conversationId) newConversation();
    refreshConversations();
  };

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
      className="flex h-[100dvh] flex-col bg-background text-foreground"
      style={{ backgroundImage: "radial-gradient(1100px 600px at 82% -10%, rgba(14,165,233,.10), transparent 60%), radial-gradient(900px 600px at -5% 110%, rgba(139,92,246,.09), transparent 55%)" }}
    >
      {/* AGENT MODE BANNER */}
      {isImpersonating && (
        <div className="flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-brand-500 px-3 py-1.5 text-center text-xs font-medium text-white">
          <Shield className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Agent Mode — managing <b>{user?.name}</b>{agentName ? ` · ${agentName}` : ""}</span>
          <button onClick={exitImpersonation} className="ms-1 inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 hover:bg-white/30">
            <LogOut className="h-3 w-3" /> Exit
          </button>
        </div>
      )}

      {/* TOP BAR */}
      <header className="relative z-40 flex h-14 items-center gap-2 border-b border-border bg-background/70 px-3 backdrop-blur sm:gap-3 sm:px-4">
        <button onClick={() => setDrawerOpen(true)} className="grid h-9 w-9 place-items-center rounded-[10px] text-muted-foreground hover:text-foreground md:hidden" aria-label="Menu">
          <Menu className="h-5 w-5" />
        </button>
        <BrandMark size={34} />
        <BrandWordmark className="hidden text-[16px] sm:inline" />

        {/* account / business switcher (desktop) */}
        <div className="relative hidden md:block" ref={accountRef}>
          <button onClick={() => setAccountOpen((o) => !o)} className="ms-1.5 flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[12.5px]">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            <b className="max-w-[150px] truncate text-foreground">{accountLabel}</b>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          {accountOpen && (
            <div
              className="absolute left-0 z-50 mt-2 w-64 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-2xl"
              style={{ maxHeight: "20rem", overflowY: "auto", overscrollBehavior: "contain" }}
            >
              <AccountMenu accountLabel={accountLabel} clients={clients} isImpersonating={isImpersonating} onSwitch={switchToClient} onExit={exitImpersonation} onManage={() => router.push("/agent/clients")} />
            </div>
          )}
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-1 rounded-full border border-border bg-gradient-to-r from-brand-500/15 to-violet-500/15 px-2.5 py-1.5 text-[12.5px] sm:px-3">
          ⚡ <b className="bg-gradient-to-r from-brand-500 to-violet-500 bg-clip-text font-extrabold text-transparent">{(user?.aiCredits ?? 0).toLocaleString()}</b>
          <span className="hidden text-muted-foreground sm:inline">{s.credits}</span>
        </div>
        <button onClick={handleNewChat} title="New chat" aria-label="New chat" className="grid h-9 w-9 place-items-center rounded-[10px] border border-border bg-card text-muted-foreground transition-colors hover:border-brand-500/60 hover:text-foreground md:hidden"><SquarePen className="h-[18px] w-[18px]" /></button>
        <button onClick={() => setHistoryOpen(true)} title="History" aria-label="History" className="grid h-9 w-9 place-items-center rounded-[10px] border border-border bg-card text-muted-foreground transition-colors hover:border-brand-500/60 hover:text-foreground md:hidden"><History className="h-[18px] w-[18px]" /></button>
        <div className="hidden items-center gap-1 md:flex">
          <button onClick={handleNewChat} title="New chat" aria-label="New chat" className="grid h-9 w-9 place-items-center rounded-[10px] border border-border bg-card text-muted-foreground transition-colors hover:border-brand-500/60 hover:text-foreground"><SquarePen className="h-[18px] w-[18px]" /></button>
          <button onClick={() => setHistoryOpen(true)} title="History" aria-label="History" className="grid h-9 w-9 place-items-center rounded-[10px] border border-border bg-card text-muted-foreground transition-colors hover:border-brand-500/60 hover:text-foreground"><History className="h-[18px] w-[18px]" /></button>
          <LanguageSwitcher language={language} onChange={setLanguage} />
          <ThemeMenu />
        </div>
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-pink-500 to-violet-500 text-[12px] font-bold text-white">{initials}</div>
      </header>

      {/* BODY */}
      <div className="flex min-h-0 flex-1">
        {/* desktop workspace rail */}
        <nav className="hidden w-[84px] shrink-0 flex-col items-center gap-1 border-e border-border bg-card/50 py-3 md:flex">
          {WORKSPACES.map((w, i) => {
            const Icon = w.icon;
            const active = activeWs === w.key;
            return (
              <div key={w.key} className="contents">
                <button onClick={() => openWorkspace(w.key)} className={cn("relative flex w-[66px] flex-col items-center gap-1.5 rounded-[13px] py-2.5 text-[10px] transition-colors", active ? "bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                  {active && <span className="absolute inset-y-4 start-[-1px] w-[3px] rounded bg-gradient-to-b from-brand-500 to-violet-500" />}
                  <Icon className="h-[21px] w-[21px]" />
                  <span>{s.ws[w.key] ?? w.label}</span>
                </button>
                {(i === 0 || w.key === "outreach") && <div className="my-1.5 h-px w-11 bg-border" />}
              </div>
            );
          })}
        </nav>

        {/* main */}
        <main className="relative flex min-w-0 flex-1 flex-col">
          {focused ? (
            <FocusedView
              title={fLabel}
              subtitle={focused === "create" ? "Design canvas" : WS_DESC[focused]}
              icon={FIcon}
              onClose={() => { setFocused(null); setActiveWs("home"); }}
              chat={
                <>
                  <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
                    {messages.length === 0 ? (
                      <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">Ask the agent to create or change the canvas on the right — e.g. “make a summer sale graphic” or “use gold and a punchier headline”.</p>
                    ) : (
                      messages.map((m) => (
                        <HomeMessageView key={m.id} message={m} initials={initials} conversationId={conversationId} onPlanResponse={handlePlanResponse} onPickTemplate={handlePickTemplate} onPickOption={handlePickOption} />
                      ))
                    )}
                    <div ref={bottomRef} />
                  </div>
                  <div className="border-t border-border p-3">
                    <Composer onSend={(t, sm) => send(t, sm, focused === "create" ? designCanvasContext(design) : undefined)} sending={sending} placeholder={s.placeholder} autoFocus />
                  </div>
                </>
              }
              canvas={
                focused === "create" ? (
                  <FocusedDesignStudio value={design} onChange={setDesign} />
                ) : (
                  <FocusedComingSoon label={fLabel} description={WS_DESC[focused] ?? ""} items={fws?.items ?? []} onOpenRoute={(r) => router.push(r)} />
                )
              }
            />
          ) : (
            <>
          <div className="flex-1 overflow-y-auto px-4 pb-44 pt-6 sm:px-[clamp(16px,6vw,110px)] md:pb-40">
            {empty ? (
              <section className="mx-auto mt-[6vh] max-w-[780px]">
                <h1 className="text-[26px] font-extrabold leading-[1.12] tracking-tight sm:text-[31px]">
                  {greeting} <span className="bg-gradient-to-r from-brand-500 to-violet-500 bg-clip-text text-transparent">{s.accent}</span>
                </h1>
                <p className="mb-6 mt-2 text-[14px] leading-relaxed text-muted-foreground sm:text-[15px]">{s.sub}</p>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {(suggestions.length ? suggestions : s.fallbackChips.map((label, i) => ({ label, hint: "", icon: ["palette", "calendar", "video", "bag"][i], prompt: label }))).map((sug, i) => {
                    const Icon = SUG_ICON[sug.icon] ?? FALLBACK_ICONS[i] ?? Sparkles;
                    return (
                      <button key={i} onClick={() => send(sug.prompt)} className="flex items-start gap-3 rounded-[13px] border border-border bg-card p-3.5 text-start transition-all hover:-translate-y-0.5 hover:border-brand-500/60 hover:shadow-lg">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] bg-gradient-to-br from-brand-500/20 to-violet-500/20 text-brand-500"><Icon className="h-[18px] w-[18px]" /></span>
                        <span className="min-w-0">
                          <span className="block text-[13.5px] font-semibold">{sug.label}</span>
                          {sug.hint && <span className="mt-0.5 block text-[11.5px] leading-snug text-muted-foreground">{sug.hint}</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {!suggestionsLoaded && !suggestions.length && (
                  <div className="mt-3"><FlowLoader size={24} withMark label="Personalizing suggestions…" /></div>
                )}
              </section>
            ) : (
              <div>
                {messages.map((m) => (
                  <HomeMessageView key={m.id} message={m} initials={initials} conversationId={conversationId} onPlanResponse={handlePlanResponse} onPickTemplate={handlePickTemplate} onPickOption={handlePickOption} />
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* composer */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/90 to-transparent px-3 pb-4 pt-3 sm:px-[clamp(16px,6vw,110px)] sm:pb-5">
            <div className="pointer-events-auto mx-auto max-w-[840px]">
              <Composer onSend={send} sending={sending} placeholder={s.placeholder} />
            </div>
            <p className="mx-auto mt-2 hidden max-w-[840px] text-center text-[11px] text-muted-foreground sm:block">{s.hint}</p>
          </div>

          {/* workspace panel — full-screen on mobile, side panel on desktop */}
          <aside className={cn("fixed inset-0 z-30 flex flex-col bg-card transition-transform duration-300 md:absolute md:inset-y-0 md:left-auto md:right-0 md:w-[440px] md:border-s md:border-border md:shadow-2xl", panelKey ? "translate-x-0" : "translate-x-full")}>
            {panelKey && (
              <WorkspacePanel
                panelKey={panelKey}
                label={s.ws[panelKey] ?? panelKey}
                onClose={() => { setPanelKey(null); setActiveWs("home"); }}
                onAsk={(q) => { setPanelKey(null); setActiveWs("home"); send(q); }}
                onOpen={(route) => router.push(route)}
                onFocus={() => openFocused(panelKey)}
              />
            )}
          </aside>
            </>
          )}

          {/* history panel — available in home and focused view */}
          <aside className={cn("fixed inset-0 z-30 flex flex-col bg-card transition-transform duration-300 md:absolute md:inset-y-0 md:left-auto md:right-0 md:w-[360px] md:border-s md:border-border md:shadow-2xl", historyOpen ? "translate-x-0" : "translate-x-full")}>
            {historyOpen && (
              <HistoryPanel
                conversations={conversations}
                activeId={conversationId}
                onClose={() => setHistoryOpen(false)}
                onNew={handleNewChat}
                onOpen={handleOpenConversation}
                onDelete={handleDeleteConversation}
              />
            )}
          </aside>
        </main>
      </div>

      {/* MOBILE DRAWER */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 start-0 flex w-[82%] max-w-[320px] flex-col bg-card shadow-2xl">
            <div className="flex items-center gap-2.5 border-b border-border p-4">
              <BrandMark size={32} /><BrandWordmark className="text-[15px]" />
              <button onClick={() => setDrawerOpen(false)} className="ms-auto text-muted-foreground" aria-label="Close"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-auto p-2">
              {/* business switcher */}
              <div className="mb-2 rounded-xl border border-border p-1.5">
                <AccountMenu accountLabel={accountLabel} clients={clients} isImpersonating={isImpersonating} onSwitch={switchToClient} onExit={exitImpersonation} onManage={() => router.push("/agent/clients")} />
              </div>
              <button onClick={handleNewChat} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-muted"><SquarePen className="h-[18px] w-[18px]" /> New chat</button>
              <button onClick={() => { setHistoryOpen(true); setDrawerOpen(false); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-muted"><History className="h-[18px] w-[18px]" /> History</button>
              <div className="my-1.5 h-px w-full bg-border" />
              {/* workspaces */}
              {WORKSPACES.map((w) => {
                const Icon = w.icon;
                return (
                  <button key={w.key} onClick={() => openWorkspace(w.key)} className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm", activeWs === w.key ? "bg-brand-500/10 text-brand-500" : "text-foreground hover:bg-muted")}>
                    <Icon className="h-[18px] w-[18px]" /> {s.ws[w.key] ?? w.label}
                  </button>
                );
              })}
            </div>
            {/* language + theme */}
            <div className="flex items-center justify-between border-t border-border p-3">
              <LanguageSwitcher language={language} onChange={setLanguage} />
              <ThemeMenu up />
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed left-1/2 top-3.5 z-[120] -translate-x-1/2 rounded-[10px] border border-border bg-card px-3.5 py-2 text-[12.5px] shadow-lg">{toast}</div>
      )}
    </div>
  );
}

function AccountMenu({ accountLabel, clients, isImpersonating, onSwitch, onExit, onManage }: {
  accountLabel: string;
  clients: AgentClient[];
  isImpersonating: boolean;
  onSwitch: (clientId: string) => void;
  onExit: () => void;
  onManage: () => void;
}) {
  return (
    <div className="text-sm">
      <div className="flex items-center gap-2 rounded-lg bg-brand-500/10 px-2.5 py-2 text-brand-500">
        <Building2 className="h-4 w-4" /> <span className="flex-1 truncate font-medium">{accountLabel}</span> <Check className="h-4 w-4" />
      </div>
      {isImpersonating && (
        <button onClick={onExit} className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-muted">
          <LogOut className="h-4 w-4 text-muted-foreground" /> Back to my account
        </button>
      )}
      {clients.length > 0 && (
        <>
          <div className="px-2.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Businesses you manage</div>
          {clients.map((c) => (
            <button key={c.id} onClick={() => onSwitch(c.id)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-muted">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-muted text-[10px] font-bold">{c.name.slice(0, 2).toUpperCase()}</span>
              <span className="flex-1 truncate">{c.name}</span>
            </button>
          ))}
          <button onClick={onManage} className="mt-1 w-full rounded-lg px-2.5 py-2 text-left text-[12.5px] text-brand-500 hover:bg-muted">Manage all clients →</button>
        </>
      )}
    </div>
  );
}

function WorkspacePanel({ panelKey, label, onClose, onAsk, onOpen, onFocus }: {
  panelKey: string;
  label: string;
  onClose: () => void;
  onAsk: (q: string) => void;
  onOpen: (route: string) => void;
  onFocus: () => void;
}) {
  const ws = WORKSPACES.find((w) => w.key === panelKey);
  if (!ws) return null;
  const Icon = ws.icon;
  return (
    <>
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
        <Icon className="h-5 w-5 text-brand-500" />
        <b className="text-[15px]">{label}</b>
        <button onClick={onClose} className="ms-auto text-muted-foreground hover:text-foreground" aria-label="Close"><X className="h-[18px] w-[18px]" /></button>
      </div>
      <div className="space-y-3 overflow-auto p-4 text-[13px] leading-relaxed text-muted-foreground">
        <p className="text-foreground">{WS_DESC[panelKey]}</p>
        <div className="flex flex-wrap gap-1.5">
          {ws.items.map((it) => (
            <button key={it.route + it.label} onClick={() => onOpen(it.route)} className="rounded-full border border-border px-2.5 py-1 text-[10.5px] hover:border-brand-500/60 hover:text-foreground">{it.label}</button>
          ))}
        </div>
        <p>Everything here is also an agent tool — say what you want and it renders in the chat, or work in the focused view.</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <button onClick={() => onAsk(`Open ${label} and help me get started`)} className="inline-flex items-center gap-2 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"><Sparkles className="h-4 w-4" /> Ask the agent</button>
          <button onClick={onFocus} className="rounded-[10px] border border-border px-4 py-2 text-[13px] font-semibold text-muted-foreground hover:text-foreground">Open focused view</button>
        </div>
      </div>
    </>
  );
}

function HistoryPanel({ conversations, activeId, onClose, onNew, onOpen, onDelete }: {
  conversations: ConversationSummary[];
  activeId: string | null;
  onClose: () => void;
  onNew: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
        <History className="h-5 w-5 text-brand-500" />
        <b className="text-[15px]">History</b>
        <button onClick={onClose} className="ms-auto text-muted-foreground hover:text-foreground" aria-label="Close"><X className="h-[18px] w-[18px]" /></button>
      </div>
      <div className="p-3">
        <button onClick={onNew} className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30">
          <SquarePen className="h-4 w-4" /> New chat
        </button>
      </div>
      <div className="flex-1 overflow-auto px-2 pb-3">
        {conversations.length === 0 ? (
          <p className="px-3 py-6 text-center text-[12.5px] text-muted-foreground">No past conversations yet.</p>
        ) : (
          conversations.map((c) => (
            <div key={c.id} className={cn("group flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm", c.id === activeId ? "bg-brand-500/10 text-brand-500" : "hover:bg-muted")}>
              <button onClick={() => onOpen(c.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <MessageSquare className="h-4 w-4 shrink-0 opacity-70" />
                <span className="min-w-0 flex-1 truncate">{c.title}</span>
              </button>
              <button onClick={() => onDelete(c.id)} className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100" aria-label="Delete conversation"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))
        )}
      </div>
    </>
  );
}
