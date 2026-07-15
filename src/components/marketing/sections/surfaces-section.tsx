"use client";

import { type PointerEvent } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal, RevealGroup, RevealItem } from "@/components/marketing/motion";
import { ProductMedia } from "@/components/marketing/product-media";
import { SURFACES, type Surface } from "@/components/marketing/surfaces";
import { cn } from "@/lib/utils/cn";

/** A single surface card with pointer spotlight, hover lift, and video on hover. */
function SurfaceCard({ surface }: { surface: Surface }) {
  const Icon = surface.icon;
  const onMove = (e: PointerEvent<HTMLAnchorElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  return (
    <Link
      href={`/surfaces/${surface.key}`}
      onPointerMove={onMove}
      className="group relative block overflow-hidden rounded-3xl border border-border bg-card/60 shadow-sm backdrop-blur transition-all duration-300 hover:-translate-y-1.5 hover:border-brand-500/40 hover:shadow-xl"
    >
      <ProductMedia
        src={surface.video}
        poster={surface.image}
        alt={`${surface.label} surface`}
        autoPlay
        className="aspect-[16/10] transition-transform duration-500 group-hover:scale-[1.03]"
        caption={surface.video ? `${surface.label} · agent output` : undefined}
        sizes="(min-width:1024px) 30vw, 90vw"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: "radial-gradient(340px circle at var(--mx) var(--my), hsl(var(--foreground)/0.06), transparent 60%)" }}
      />
      <div className="relative p-6">
        <span className={cn("-mt-11 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-lg ring-4 ring-card", surface.accent)}>
          <Icon className="h-6 w-6" />
        </span>
        <h3 className="mt-4 text-lg font-bold text-foreground">{surface.label}</h3>
        <p className="mt-1 text-sm font-medium text-brand-400">{surface.tagline}</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{surface.blurb}</p>
        <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-400 opacity-0 transition-opacity group-hover:opacity-100">
          Explore <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}

export function SurfacesSection() {
  return (
    <section id="surfaces" className="relative px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <Reveal>
            <p className="text-sm font-bold uppercase tracking-[3px] text-brand-500">One workspace</p>
          </Reveal>
          <Reveal delay={0.06}>
            <h2 className="mt-3 text-balance font-display text-3xl font-extrabold leading-tight sm:text-5xl">
              Every surface the agent operates.
            </h2>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="mt-4 text-lg text-muted-foreground">
              No more ten logins and ten subscriptions. The agent works — and lets you edit — across all of it, and credits only spend on what it makes.
            </p>
          </Reveal>
        </div>

        <RevealGroup className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" stagger={0.06}>
          {SURFACES.map((s) => (
            <RevealItem key={s.key}>
              <SurfaceCard surface={s} />
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
