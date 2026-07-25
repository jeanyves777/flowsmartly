"use client";

/**
 * InfographicView — renders an agent-authored illustration spec (a hub of facets, a process flow,
 * a grid, or a two-side comparison) as themed HTML/CSS + SVG icons & connectors, revealed
 * element-by-element in step with the narration (`reveal`). The on-subject, programmatic
 * alternative to a generated video. [[training-studio]]
 */
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils/cn";
import type { SlideInfographic, InfographicCard } from "@/lib/training/types";
import {
  Calculator, Database, Globe, Search, Workflow, Link2, Bot, Cpu, Cloud, Zap, Brain, Code2,
  BarChart3, MessageSquare, Shield, Settings, FileText, Folder, Mail, Phone, Users, Target, Rocket,
  Lightbulb, Wrench, Layers, GitBranch, Network, Server, Key, Lock, Eye, BookOpen, DollarSign, Clock,
  Check, AlertTriangle, Gauge, Sparkles, Filter, RefreshCw, Send, Download, Upload, Play, MapPin,
  Calendar, Star, Heart, TrendingUp, Package, ShoppingCart, CreditCard, Bell, Flag, Tag, Image as ImageIcon,
  Video, Mic, Wifi, Hammer, Pen, Palette, Grid3x3, List, LayoutGrid, GraduationCap, Circle, type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  calculator: Calculator, database: Database, globe: Globe, search: Search, workflow: Workflow,
  link: Link2, bot: Bot, cpu: Cpu, cloud: Cloud, zap: Zap, brain: Brain, code: Code2, chart: BarChart3,
  message: MessageSquare, shield: Shield, settings: Settings, file: FileText, folder: Folder, mail: Mail,
  phone: Phone, users: Users, target: Target, rocket: Rocket, lightbulb: Lightbulb, wrench: Wrench,
  layers: Layers, "git-branch": GitBranch, network: Network, server: Server, key: Key, lock: Lock,
  eye: Eye, book: BookOpen, graduation: GraduationCap, dollar: DollarSign, clock: Clock, check: Check,
  alert: AlertTriangle, gauge: Gauge, sparkles: Sparkles, filter: Filter, refresh: RefreshCw, send: Send,
  download: Download, upload: Upload, play: Play, "map-pin": MapPin, calendar: Calendar, star: Star,
  heart: Heart, "trending-up": TrendingUp, package: Package, "shopping-cart": ShoppingCart,
  "credit-card": CreditCard, bell: Bell, flag: Flag, tag: Tag, image: ImageIcon, video: Video, mic: Mic,
  wifi: Wifi, hammer: Hammer, pen: Pen, palette: Palette, grid: Grid3x3, list: List, layout: LayoutGrid,
};
const Ic = ({ name, className, style }: { name?: string; className?: string; style?: CSSProperties }) => {
  const I = (name && ICONS[name]) || Circle;
  return <I className={className} style={style} />;
};

const PALETTE = ["#38bdf8", "#34d399", "#a78bfa", "#fb923c", "#f472b6", "#facc15"];
const cardColor = (c: InfographicCard, i: number) => c.color || PALETTE[i % PALETTE.length];

// hub anchor points (fractions of the diagram box) per card count; center sits at 0.5/0.5
const HUB: Record<number, [number, number][]> = {
  1: [[0.82, 0.5]],
  2: [[0.18, 0.5], [0.82, 0.5]],
  3: [[0.18, 0.34], [0.82, 0.34], [0.5, 0.86]],
  4: [[0.19, 0.3], [0.81, 0.3], [0.19, 0.74], [0.81, 0.74]],
  5: [[0.17, 0.28], [0.83, 0.28], [0.14, 0.66], [0.86, 0.66], [0.5, 0.88]],
  6: [[0.17, 0.27], [0.83, 0.27], [0.13, 0.53], [0.87, 0.53], [0.32, 0.86], [0.68, 0.86]],
};

function Card({ c, i, on }: { c: InfographicCard; i: number; on: boolean }) {
  const col = cardColor(c, i);
  return (
    <div className={cn("flex items-start gap-[1.5cqw] rounded-[1.4cqw] border-2 px-[2cqw] py-[1.6cqw] backdrop-blur-sm transition-all duration-500", on ? "opacity-100 blur-0" : "translate-y-[1cqw] opacity-0 blur-[2px]")}
      style={{ borderColor: col, background: `linear-gradient(135deg, ${col}18, ${col}05)` } as CSSProperties}>
      <span className="grid h-[3.6cqw] w-[3.6cqw] shrink-0 place-items-center rounded-[1cqw]" style={{ background: `${col}22` }}><Ic name={c.icon} className="h-[2.4cqw] w-[2.4cqw]" style={{ color: col }} /></span>
      <span className="min-w-0">
        <b className="block text-[clamp(6px,2cqw,18px)] font-extrabold leading-tight" style={{ color: col }}>{c.title}</b>
        {c.desc ? <span className="mt-[.3cqw] block text-[clamp(5px,1.5cqw,14px)] leading-snug text-[rgb(var(--sfg)/.82)]">{c.desc}</span> : null}
      </span>
    </div>
  );
}

export function InfographicView({ spec, reveal, className, title, subtitle, beside }: { spec: SlideInfographic; reveal?: number; className?: string; title?: string; subtitle?: string; beside?: boolean }) {
  const cards = spec.cards.slice(0, 6);
  // reveal order: center/first (0), then each card. `on(i)` = card i is visible.
  const on = (i: number) => reveal === undefined || reveal >= i + 1;
  const centerOn = reveal === undefined || reveal >= 0;

  const caption = spec.caption || subtitle;
  // `beside` = the diagram shares the stage with a co-host video, so it lives in a NARROW, tall
  // column. cqw (container-width) sizing shrinks a hub/grid to nothing there, so we bump the type
  // and stack big cards vertically to fill the height (see the beside branch below).
  const head = (title || caption) ? (
    <div className={cn("shrink-0 text-center", beside ? "px-[6%] pt-[4cqw]" : "px-[5%] pt-[3.5cqw]")}>
      {title ? <h1 className={cn("font-extrabold leading-tight tracking-tight", beside ? "text-[clamp(13px,5cqw,30px)]" : "text-[clamp(11px,3.4cqw,32px)]")} style={{ textWrap: "balance" } as CSSProperties}>{title}</h1> : null}
      {caption ? <p className={cn("mx-auto font-semibold text-[color:var(--sat)]", beside ? "mt-[1cqw] max-w-[92%] text-[clamp(8px,2.8cqw,18px)]" : "mt-[.8cqw] max-w-[84%] text-[clamp(6px,1.9cqw,17px)]")}>{caption}</p> : null}
    </div>
  ) : null;
  const foot = spec.footer ? <div className={cn("shrink-0 px-[5%] pb-[3cqw] pt-[1.5cqw] text-center font-semibold text-[rgb(var(--sfg)/.7)]", beside ? "text-[clamp(7px,2.4cqw,16px)]" : "text-[clamp(5px,1.7cqw,15px)]")}>{spec.footer}</div> : null;
  const wrap = (inner: React.ReactNode) => (
    <div className={cn("relative flex h-full w-full flex-col overflow-hidden bg-gradient-to-br from-[var(--sbg1)] to-[var(--sbg2)] text-[rgb(var(--sfg))] [container-type:inline-size]", className)}>
      <span className="absolute inset-y-0 left-0 z-[2] w-2 bg-gradient-to-b from-[var(--sa)] to-[var(--sa2)]" />
      {head}{inner}{foot}
    </div>
  );

  // ---- BESIDE A CO-HOST: a narrow, tall column. Any radial/grid/flow arrangement collapses to a
  //      tiny cluster here, so ignore the arrangement and render BIG cards stacked to fill the height,
  //      sized to the co-host column so they read clearly. [[training-presenter-talking-video]] ----
  if (beside) {
    return wrap(
      <div className={cn("flex min-h-0 flex-1 flex-col px-[6%] py-[2.5cqw]", cards.length >= 5 ? "justify-between gap-[1.8cqw]" : "justify-center gap-[2.6cqw]")}>
        {cards.map((c, i) => {
          const col = cardColor(c, i);
          return (
            <div key={i} className={cn("flex items-center gap-[3cqw] rounded-[2cqw] border-2 px-[3.4cqw] py-[2.8cqw] backdrop-blur-sm transition-all duration-500", on(i) ? "opacity-100 blur-0" : "translate-y-[1.5cqw] opacity-0 blur-[2px]")}
              style={{ borderColor: col, background: `linear-gradient(135deg, ${col}20, ${col}06)` } as CSSProperties}>
              <span className="grid h-[8cqw] w-[8cqw] shrink-0 place-items-center rounded-[1.8cqw]" style={{ background: `${col}26` }}><Ic name={c.icon} className="h-[5cqw] w-[5cqw]" style={{ color: col }} /></span>
              <span className="min-w-0">
                <b className="block text-[clamp(10px,4cqw,26px)] font-extrabold leading-tight" style={{ color: col }}>{c.title}</b>
                {c.desc ? <span className="mt-[.6cqw] block text-[clamp(8px,2.7cqw,18px)] leading-snug text-[rgb(var(--sfg)/.85)]">{c.desc}</span> : null}
              </span>
            </div>
          );
        })}
      </div>,
    );
  }

  // ---- HUB: a centre node with facets around it, connectors drawn out to each ----
  if (spec.layout === "hub") {
    const rawAnchors = HUB[Math.min(6, Math.max(1, cards.length))] || HUB[4];
    // Cards are ~28cqw wide and centred on their anchor, so an anchor too near an edge pushes
    // the card off the board. Clamp every anchor (used by BOTH the card AND its connector, so they
    // stay attached) to keep the whole card inside, clear of the left accent bar. [[training-studio]]
    const EDGE = 0.05, HALFW = 0.16, TOPH = 0.14, BOTH = 0.15;
    const anchors: [number, number][] = rawAnchors.map(([x, y]) => [
      Math.min(1 - EDGE - HALFW, Math.max(EDGE + HALFW, x)),
      Math.min(1 - BOTH, Math.max(TOPH, y)),
    ]);
    const CX = 800, CY = 450; // viewBox 1600x900
    return wrap(
      <div className="relative min-h-0 flex-1">
        <svg viewBox="0 0 1600 900" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
          {cards.map((c, i) => {
            const [ax, ay] = anchors[i]; const x2 = ax * 1600, y2 = ay * 900;
            const dx = x2 - CX, dy = y2 - CY, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
            const sx = CX + ux * 110, sy = CY + uy * 110, ex = x2 - ux * 150, ey = y2 - uy * 95;
            const col = cardColor(c, i), a = Math.atan2(ey - sy, ex - sx), h = 26;
            return (
              <g key={i} style={{ opacity: on(i) ? 1 : 0, transition: "opacity .45s ease" } as CSSProperties}>
                <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={col} strokeWidth={5} strokeLinecap="round" pathLength={1} style={{ strokeDasharray: 1, strokeDashoffset: on(i) ? 0 : 1, transition: "stroke-dashoffset .6s ease" } as CSSProperties} />
                <polyline points={`${ex - h * Math.cos(a - 0.5)},${ey - h * Math.sin(a - 0.5)} ${ex},${ey} ${ex - h * Math.cos(a + 0.5)},${ey - h * Math.sin(a + 0.5)}`} fill="none" stroke={col} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
              </g>
            );
          })}
        </svg>
        {/* centre node */}
        <div className={cn("absolute left-1/2 top-1/2 z-[3] -translate-x-1/2 -translate-y-1/2 transition-all duration-500", centerOn ? "scale-100 opacity-100" : "scale-90 opacity-0")}>
          <div className="grid h-[13cqw] w-[13cqw] place-items-center rounded-full bg-gradient-to-br from-[var(--sa)] to-[var(--sa2)] shadow-2xl ring-4 ring-[rgb(var(--sfg)/.12)]"><Ic name={spec.center?.icon || "bot"} className="h-[7cqw] w-[7cqw] text-white" /></div>
          {spec.center?.label ? <div className="mt-[1cqw] text-center text-[clamp(5px,1.6cqw,14px)] font-extrabold text-[color:var(--sat)]">{spec.center.label}</div> : null}
        </div>
        {/* cards */}
        {cards.map((c, i) => {
          const [ax, ay] = anchors[i];
          return <div key={i} className="absolute z-[4] w-[26cqw] max-w-[30%]" style={{ left: `${ax * 100}%`, top: `${ay * 100}%`, transform: "translate(-50%,-50%)" }}><Card c={c} i={i} on={on(i)} /></div>;
        })}
      </div>,
    );
  }

  // ---- FLOW: a left→right process, arrows between steps ----
  if (spec.layout === "flow") {
    return wrap(
      <div className="flex min-h-0 flex-1 items-center justify-center gap-[1.5cqw] px-[5%]">
        {cards.map((c, i) => {
          const col = cardColor(c, i);
          return (
            <div key={i} className="flex items-center gap-[1.5cqw]">
              <div className={cn("flex w-[20cqw] flex-col items-center gap-[1cqw] rounded-[1.4cqw] border-2 px-[1.6cqw] py-[2cqw] text-center transition-all duration-500", on(i) ? "opacity-100" : "translate-y-[1cqw] opacity-0")} style={{ borderColor: col, background: `linear-gradient(135deg,${col}18,${col}05)` } as CSSProperties}>
                <span className="grid h-[5cqw] w-[5cqw] place-items-center rounded-full" style={{ background: `${col}22` }}><Ic name={c.icon} className="h-[3cqw] w-[3cqw]" style={{ color: col }} /></span>
                <b className="text-[clamp(6px,1.9cqw,17px)] font-extrabold leading-tight" style={{ color: col }}>{c.title}</b>
                {c.desc ? <span className="text-[clamp(5px,1.4cqw,13px)] leading-snug text-[rgb(var(--sfg)/.8)]">{c.desc}</span> : null}
              </div>
              {i < cards.length - 1 ? <span className={cn("text-[3cqw] text-[color:var(--sat)] transition-opacity duration-500", on(i + 1) ? "opacity-100" : "opacity-0")}>→</span> : null}
            </div>
          );
        })}
      </div>,
    );
  }

  // ---- COMPARE: two sides ----
  if (spec.layout === "compare") {
    const half = Math.ceil(cards.length / 2);
    const cols = [cards.slice(0, half), cards.slice(half)];
    return wrap(
      <div className="grid min-h-0 flex-1 grid-cols-2 items-center gap-[3cqw] px-[5%]">
        {cols.map((col, ci) => (
          <div key={ci} className="flex flex-col gap-[1.4cqw]">
            {col.map((c, k) => { const i = ci * half + k; return <Card key={i} c={c} i={i} on={on(i)} />; })}
          </div>
        ))}
      </div>,
    );
  }

  // ---- GRID (default): 2 (or 3) columns of cards ----
  const gcols = cards.length > 4 ? "grid-cols-3" : "grid-cols-2";
  return wrap(
    <div className={cn("grid min-h-0 flex-1 content-center gap-[1.8cqw] px-[5%]", gcols)}>
      {cards.map((c, i) => <Card key={i} c={c} i={i} on={on(i)} />)}
    </div>,
  );
}
