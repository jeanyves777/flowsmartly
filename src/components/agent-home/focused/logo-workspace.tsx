"use client";

import { useCallback, useEffect, useState, type ElementType } from "react";
import Image from "next/image";
import { Sparkles, ImageIcon, ExternalLink, Download, Star, Palette, LayoutGrid, BadgeCheck } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * Logo studio — a deep new-design surface (the Logo workspace canvas): a gallery
 * of the user's AI-generated logos (GET /api/designs?category=logo) plus their
 * current brand logo (GET /api/brand). Generating a fresh logo is a heavy
 * generative task, so that one action drives the agent in the chat (onAsk) —
 * everything else is real, read-it-in-the-UI data: a clickable gallery, KPIs,
 * download/open on the live asset. No legacy links. [[new-design-no-legacy]]
 */

interface LogoMeta { brandName?: string; label?: string; logoType?: string; agentScore?: number; transparent?: boolean }
interface Logo {
  id: string;
  imageUrl: string | null;
  prompt?: string;
  style?: string | null;
  name?: string | null;
  status?: string;
  createdAt?: string;
  meta: LogoMeta;
}
interface BrandLogo { name: string; logo: string | null; iconLogo: string | null }

const GENERATE_PROMPT =
  "Design me a new logo. Ask me my brand name, what I do, the style I want (modern, playful, classic, minimal), and any colors — then generate logo concepts.";

function parseMeta(raw: unknown): LogoMeta {
  if (typeof raw !== "string") return {};
  try {
    const m = JSON.parse(raw) as Record<string, unknown>;
    return {
      brandName: typeof m.brandName === "string" ? m.brandName : undefined,
      label: typeof m.label === "string" ? m.label : undefined,
      logoType: typeof m.logoType === "string" ? m.logoType : undefined,
      agentScore: typeof m.agentScore === "number" ? m.agentScore : undefined,
      transparent: typeof m.transparent === "boolean" ? m.transparent : undefined,
    };
  } catch {
    return {};
  }
}

function whenLabel(iso?: string): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); } catch { return ""; }
}

export function FocusedLogo({ refreshKey, onAsk }: { refreshKey?: number; onAsk?: (prompt: string) => void }) {
  const [logos, setLogos] = useState<Logo[]>([]);
  const [brand, setBrand] = useState<BrandLogo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    const [dj, bj] = await Promise.all([
      fetch("/api/designs?category=logo&limit=48").then((r) => r.json()).catch(() => null),
      fetch("/api/brand").then((r) => r.json()).catch(() => null),
    ]);

    if (dj?.success && Array.isArray(dj.data?.designs)) {
      const list: Logo[] = (dj.data.designs as Record<string, unknown>[])
        .map((d) => ({
          id: String(d.id ?? ""),
          imageUrl: typeof d.imageUrl === "string" && d.imageUrl ? d.imageUrl : null,
          prompt: typeof d.prompt === "string" ? d.prompt : undefined,
          style: typeof d.style === "string" ? d.style : null,
          name: typeof d.name === "string" ? d.name : null,
          status: typeof d.status === "string" ? d.status : undefined,
          createdAt: typeof d.createdAt === "string" ? d.createdAt : undefined,
          meta: parseMeta(d.metadata),
        }))
        .filter((l) => l.id && l.imageUrl);
      setLogos(list);
    } else if (dj && dj.success === false) {
      setError(true);
    }

    if (bj?.success && bj.data?.brandKit) {
      const k = bj.data.brandKit as Record<string, unknown>;
      setBrand({
        name: typeof k.name === "string" ? k.name : "Your brand",
        logo: typeof k.logo === "string" && k.logo ? k.logo : null,
        iconLogo: typeof k.iconLogo === "string" && k.iconLogo ? k.iconLogo : null,
      });
    } else {
      setBrand(null);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    load().finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [load, refreshKey]);

  const generate = () => onAsk?.(GENERATE_PROMPT);

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading your logos…" /></div>;
  }

  const brandMark = brand?.logo || brand?.iconLogo || null;
  const scored = logos.filter((l) => typeof l.meta.agentScore === "number");
  const bestScore = scored.length ? Math.max(...scored.map((l) => l.meta.agentScore ?? 0)) : null;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-4">
        {/* hero */}
        <section className="rounded-2xl border border-brand-500/30 bg-gradient-to-br from-brand-500/10 via-violet-500/5 to-transparent p-5">
          <div className="flex flex-wrap items-center gap-4">
            {brandMark ? (
              <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-background">
                <Image src={brandMark} alt="" width={56} height={56} className="h-full w-full object-contain p-1.5" unoptimized />
              </span>
            ) : (
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/25 to-violet-500/20 text-brand-500"><Palette className="h-7 w-7" /></span>
            )}
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-muted-foreground">Logo studio</p>
              <h2 className="truncate text-[20px] font-extrabold leading-tight">{brand?.name ? `${brand.name}'s logos` : "Your logos"}</h2>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">{logos.length ? `${logos.length} generated concept${logos.length === 1 ? "" : "s"}` : "No generated logos yet"}</p>
            </div>
            <button onClick={generate} className="ms-auto inline-flex items-center gap-2 rounded-[12px] bg-gradient-to-r from-brand-500 to-violet-500 px-5 py-2.5 text-[14px] font-semibold text-white shadow-lg shadow-brand-500/30">
              <Sparkles className="h-4 w-4" /> Generate a logo
            </button>
          </div>
        </section>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Kpi icon={LayoutGrid} label="Logos generated" value={logos.length.toLocaleString()} />
          <Kpi icon={BadgeCheck} label="Brand logo" value={brandMark ? "Set" : "Not set"} />
          <Kpi icon={Star} label="Best score" value={bestScore != null ? `${bestScore}/10` : "—"} />
        </div>

        {/* current brand logo */}
        {brandMark && (
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <h3 className="mb-3 text-[13px] font-bold">Current brand logo</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {brand?.logo && <BrandTile label="Full logo" url={brand.logo} />}
              {brand?.iconLogo && <BrandTile label="Icon / mark" url={brand.iconLogo} />}
            </div>
          </section>
        )}

        {/* gallery */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-[13px] font-bold">Generated logos</h3>
            {logos.length > 0 && (
              <button onClick={generate} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground">
                <Sparkles className="h-3.5 w-3.5" /> New logo
              </button>
            )}
          </div>

          {error ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
              <p className="text-[13px] font-medium">Couldn&apos;t load your logos</p>
              <p className="mt-1 text-[12px] text-muted-foreground">Something went wrong fetching your logo history. Please try again.</p>
            </div>
          ) : logos.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {logos.map((l) => (
                <LogoCard key={l.id} logo={l} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><ImageIcon className="h-7 w-7" /></span>
              <p className="mt-3 text-[14px] font-semibold">No logos yet</p>
              <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-muted-foreground">Generate professional logo concepts for your brand — tell the agent your name and style and it produces a set to choose from.</p>
              <button onClick={generate} className="mt-3 inline-flex items-center gap-2 rounded-[12px] bg-gradient-to-r from-brand-500 to-violet-500 px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-lg shadow-brand-500/30">
                <Sparkles className="h-4 w-4" /> Generate a logo
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function LogoCard({ logo }: { logo: Logo }) {
  const title = logo.meta.brandName || logo.name || "Logo";
  const sub = [logo.meta.label || logo.style, whenLabel(logo.createdAt)].filter(Boolean).join(" · ");
  return (
    <div className="group overflow-hidden rounded-xl border border-border bg-muted/30 transition hover:border-brand-500/60">
      <div className="relative grid aspect-square place-items-center bg-background">
        {logo.imageUrl ? (
          <Image src={logo.imageUrl} alt={title} width={256} height={256} className="h-full w-full object-contain p-3" unoptimized />
        ) : (
          <ImageIcon className="h-6 w-6 text-muted-foreground" />
        )}
        {typeof logo.meta.agentScore === "number" && (
          <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-md bg-background/85 px-1.5 py-0.5 text-[10px] font-bold text-brand-500"><Star className="h-2.5 w-2.5 fill-current" />{logo.meta.agentScore}</span>
        )}
        {logo.imageUrl && (
          <div className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-end gap-1 opacity-0 transition group-hover:opacity-100">
            <a href={logo.imageUrl} target="_blank" rel="noreferrer" title="Open" className="grid h-7 w-7 place-items-center rounded-md bg-background/90 text-muted-foreground hover:text-foreground"><ExternalLink className="h-3.5 w-3.5" /></a>
            <a href={logo.imageUrl} download title="Download" className="grid h-7 w-7 place-items-center rounded-md bg-background/90 text-muted-foreground hover:text-foreground"><Download className="h-3.5 w-3.5" /></a>
          </div>
        )}
      </div>
      <div className="p-2.5">
        <p className="truncate text-[12.5px] font-medium">{title}</p>
        {sub && <p className="mt-0.5 truncate text-[11px] capitalize text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

function BrandTile({ label, url }: { label: string; url: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-xl border border-border bg-muted/30 transition hover:border-brand-500/60">
      <div className="grid aspect-square place-items-center bg-background">
        <Image src={url} alt={label} width={160} height={160} className="h-full w-full object-contain p-3" unoptimized />
      </div>
      <p className="truncate px-2.5 py-2 text-[11.5px] font-medium text-muted-foreground">{label}</p>
    </a>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className="flex items-center gap-1.5 text-muted-foreground"><Icon className="h-4 w-4" /><span className="text-[11.5px] font-medium">{label}</span></div>
      <p className="mt-1.5 text-[22px] font-extrabold leading-none">{value}</p>
    </div>
  );
}
