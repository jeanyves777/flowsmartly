import { CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";
import type { ServiceProposalContent } from "@/lib/pitch/proposal-agent";
import type { ProposalDeckSlideRole } from "@/lib/pitch/proposal-deck-types";
import { cn } from "@/lib/utils/cn";

type ProposalTheme = {
  primary: string;
  secondary: string;
  accent: string;
  bg: string;
  ink: string;
};

interface ProposalDeckPreviewProps {
  proposal: ServiceProposalContent;
  brandName: string;
  businessUrl?: string;
  theme: ProposalTheme;
}

function text(value: unknown, fallback = ""): string {
  return String(value || fallback).replace(/\s+/g, " ").trim();
}

function shortText(value: unknown, max = 120): string {
  const clean = text(value);
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).replace(/\s+\S*$/, "")}...`;
}

function priceText(proposal: ServiceProposalContent): string {
  const amount = proposal.pricing?.amount;
  if (typeof amount !== "number") return "Custom";
  const interval = proposal.pricing?.interval || "project";
  return `$${amount.toLocaleString()}${interval === "project" ? "" : `/${interval}`}`;
}

function slideFor(proposal: ServiceProposalContent, role: ProposalDeckSlideRole) {
  return proposal.deckPlan?.slides?.find((slide) => slide.role === role);
}

function visualForKind(proposal: ServiceProposalContent, kind: "cover" | "about" | "impact") {
  return proposal.visualAssets?.images?.find((asset) => asset.kind === kind)?.url;
}

function slideVisuals(
  proposal: ServiceProposalContent,
  role: ProposalDeckSlideRole,
  fallbackKinds: Array<"cover" | "about" | "impact">,
) {
  const slide = slideFor(proposal, role);
  const planned = (slide?.visuals || []).map((visual) => visual.url).filter(Boolean);
  const fallback = fallbackKinds.map((kind) => visualForKind(proposal, kind)).filter(Boolean) as string[];
  const defaults: string[] = {
    cover: ["/proposal-assets/pregenerated/mobile-local-store-reviews.png"],
    about: ["/proposal-assets/pregenerated/dashboard-growth-consultant.png"],
    commitments: ["/proposal-assets/pregenerated/chart-growth-analytics.png"],
    benefits: ["/proposal-assets/pregenerated/strategy-dashboard-consultant.png", "/proposal-assets/pregenerated/local-store-price-growth.png"],
    proof: ["/proposal-assets/pregenerated/chart-growth-analytics.png"],
    terms: ["/proposal-assets/pregenerated/red-pricing-tag-blank.png"],
    closing: ["/proposal-assets/pregenerated/local-store-price-growth.png"],
  }[role];
  const wantsTwo = slide?.layout === "two-visuals" && (role === "about" || role === "benefits");
  return Array.from(new Set([...planned, ...fallback, ...defaults])).slice(0, wantsTwo ? 2 : 1);
}

function metricPoints(proposal: ServiceProposalContent) {
  const client = proposal.clientProfile?.insights || [];
  return [
    ...client,
    ...proposal.proofPoints.map((point) => ({ metric: point.metric, label: point.label, note: point.note })),
  ]
    .filter((point, index, all) => all.findIndex((item) => `${item.metric}:${item.label}` === `${point.metric}:${point.label}`) === index)
    .slice(0, 4);
}

function SlideShell({
  page,
  website,
  children,
  className,
}: {
  page: number;
  website: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className="overflow-x-auto pb-3">
      <div
        className={cn(
          "relative mx-auto aspect-[16/9] w-full min-w-[960px] max-w-[1180px] overflow-hidden bg-white text-slate-950 shadow-lg ring-1 ring-border",
          className,
        )}
      >
        <div className="absolute inset-0 bg-[linear-gradient(105deg,transparent_0_18%,rgba(226,232,240,0.55)_18.2%,transparent_18.6%,transparent_34%,rgba(226,232,240,0.55)_34.2%,transparent_34.6%,transparent_100%)]" />
        <div className="relative z-10 h-full p-12">{children}</div>
        {website && <div className="absolute bottom-8 left-12 z-20 text-sm font-medium text-slate-700">{website}</div>}
        <div className="absolute bottom-0 right-0 z-20 flex h-16 w-16 items-center justify-center bg-red-600 text-2xl font-black text-white">
          {String(page).padStart(2, "0")}
        </div>
      </div>
    </section>
  );
}

function LogoMark({ proposal, brandName }: { proposal: ServiceProposalContent; brandName: string }) {
  const snapshot = proposal.brandSnapshot || {};
  const logo = text(snapshot.logoUrl || snapshot.iconLogoUrl);
  if (logo) {
    return <img src={logo} alt={proposal.preparedBy || brandName} className="max-h-14 max-w-56 object-contain" />;
  }
  return <div className="text-2xl font-black text-slate-950">{proposal.preparedBy || brandName}</div>;
}

function MetricRing({ metric, label, color }: { metric: string; label: string; color: string }) {
  return (
    <div className="flex w-36 flex-col items-center text-center">
      <div className="flex h-28 w-28 items-center justify-center rounded-full border-[10px] bg-white" style={{ borderColor: color }}>
        <span className="max-w-20 break-words text-2xl font-black leading-none text-slate-950">{shortText(metric, 8)}</span>
      </div>
      <div className="mt-3 min-h-10 text-xs font-semibold leading-5 text-slate-700">{shortText(label, 44)}</div>
    </div>
  );
}

function VisualStack({ urls, className }: { urls: string[]; className?: string }) {
  if (!urls.length) return null;
  if (urls.length === 1) {
    return <img src={urls[0]} alt="" className={cn("h-full w-full object-contain", className)} />;
  }
  return (
    <div className={cn("grid h-full gap-5", className)}>
      {urls.map((url, index) => (
        <img key={`${url}-${index}`} src={url} alt="" className="min-h-0 w-full object-contain" />
      ))}
    </div>
  );
}

export function ProposalDeckPreview({ proposal, brandName, businessUrl, theme }: ProposalDeckPreviewProps) {
  const website = text(proposal.contact?.website || businessUrl || "www.flowsmartly.com");
  const preparedBy = proposal.preparedBy || brandName || "FlowSmartly";
  const cover = slideFor(proposal, "cover");
  const about = slideFor(proposal, "about");
  const commitments = slideFor(proposal, "commitments");
  const benefits = slideFor(proposal, "benefits");
  const proof = slideFor(proposal, "proof");
  const terms = slideFor(proposal, "terms");
  const closing = slideFor(proposal, "closing");
  const proofPoints = metricPoints(proposal);
  const colors = [theme.primary, theme.secondary, theme.accent, "#dc2626"];

  return (
    <div className="space-y-6">
      <SlideShell page={1} website={website}>
        <div className="grid h-full grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] gap-10">
          <div className="flex min-w-0 flex-col">
            <LogoMark proposal={proposal} brandName={brandName} />
            <p className="mt-8 text-sm font-medium text-slate-600">
              Prepared for {proposal.preparedFor} | {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
            <h2 className="mt-20 max-w-xl break-words text-5xl font-black leading-tight text-slate-950">
              {shortText(cover?.headline || proposal.title || "Business Development Proposal", 92)}
            </h2>
            <p className="mt-6 max-w-lg break-words text-2xl font-bold leading-snug text-slate-700">
              {shortText(cover?.subhead || proposal.serviceTitle, 90)}
            </p>
            <div className="mt-auto inline-flex w-fit rounded-full bg-red-600 px-8 py-4 text-xl font-black text-white">Visit Us</div>
          </div>
          <div className="relative flex items-center justify-center">
            <div className="absolute bottom-2 left-2 h-36 w-72 rounded-t-full border-[28px] border-blue-950 border-b-0" />
            <VisualStack urls={slideVisuals(proposal, "cover", ["cover"])} className="relative z-10 max-h-[520px]" />
          </div>
        </div>
      </SlideShell>

      <SlideShell page={2} website={website}>
        <div className="grid h-full grid-cols-[minmax(0,0.95fr)_minmax(0,0.75fr)] gap-12">
          <div className="min-w-0">
            <h2 className="max-w-xl break-words text-5xl font-black leading-tight text-slate-950">
              {shortText(about?.headline || "About Us", 78)}
            </h2>
            <div className="mt-8 rounded-2xl bg-red-600 px-8 py-5 text-2xl font-black leading-tight text-white">
              <span className="line-clamp-2 break-words">{shortText(about?.subhead || "Built to Grow Local Businesses", 120)}</span>
            </div>
            <p className="mt-8 line-clamp-4 break-words text-lg leading-8 text-slate-700">
              {about?.body || proposal.aboutBrand}
            </p>
            <h3 className="mt-10 text-2xl font-black text-slate-950">Client Need</h3>
            <p className="mt-4 line-clamp-3 break-words text-lg leading-8 text-slate-700">{proposal.clientNeed}</p>
          </div>
          <VisualStack urls={slideVisuals(proposal, "about", ["about", "impact"])} className="max-h-[570px]" />
        </div>
      </SlideShell>

      <SlideShell page={3} website={website}>
        <div className="grid h-full grid-cols-[minmax(0,0.92fr)_minmax(0,0.82fr)] gap-10">
          <div className="min-w-0">
            <h2 className="break-words text-5xl font-black leading-tight text-slate-950">{shortText(commitments?.headline || "Our Commitments", 78)}</h2>
            <p className="mt-6 text-2xl font-bold text-slate-700">Perks & Benefits of {preparedBy}</p>
            <div className="mt-10 space-y-6">
              {(commitments?.bullets?.length ? commitments.bullets : proposal.commitments).slice(0, 5).map((item, index) => (
                <div key={index} className="flex gap-4">
                  <span className="mt-1 h-4 w-4 shrink-0 rounded-full bg-red-600" />
                  <p className="line-clamp-2 break-words text-lg leading-7 text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex min-w-0 flex-col items-center justify-center gap-7">
            <VisualStack urls={slideVisuals(proposal, "commitments", ["impact"])} className="max-h-[300px]" />
            <div className="w-96 rounded-3xl bg-red-600 px-8 py-6 text-center text-2xl font-black leading-tight text-white">
              <span className="line-clamp-2 break-words">{commitments?.emphasis || "No Contract | No Automatic Billing"}</span>
            </div>
            <div className="w-80 rounded-3xl bg-blue-950 px-8 py-6 text-center text-white">
              <div className="text-xl font-bold">Pricing</div>
              <div className="mt-2 text-3xl font-black">{priceText(proposal)}</div>
            </div>
          </div>
        </div>
      </SlideShell>

      <SlideShell page={4} website={website}>
        <div className="grid h-full grid-cols-[minmax(0,0.95fr)_minmax(0,0.82fr)] gap-10">
          <div className="min-w-0">
            <h2 className="break-words text-5xl font-black leading-tight text-slate-950">
              {shortText(benefits?.headline || `Benefits of ${proposal.serviceTitle || "the Service"}`, 82)}
            </h2>
            <div className="mt-14 space-y-7">
              {(benefits?.bullets?.length ? benefits.bullets : proposal.deliverables.map((item) => item.title)).slice(0, 4).map((item, index) => (
                <div key={index} className="flex gap-4">
                  <span className="mt-1 h-4 w-4 shrink-0 rounded-full bg-red-600" />
                  <p className="line-clamp-2 break-words text-lg leading-7 text-slate-700">{item}</p>
                </div>
              ))}
            </div>
            <p className="mt-12 line-clamp-3 break-words text-lg leading-8 text-slate-700">
              {benefits?.body || proposal.deliverables.slice(0, 2).map((item) => item.description).join(" ")}
            </p>
          </div>
          <VisualStack urls={slideVisuals(proposal, "benefits", ["about", "impact"])} className="max-h-[570px]" />
        </div>
      </SlideShell>

      <SlideShell page={5} website={website}>
        <div className="grid h-full grid-cols-[minmax(0,0.98fr)_minmax(0,0.75fr)] gap-10">
          <div className="min-w-0">
            <h2 className="break-words text-5xl font-black leading-tight text-slate-950">{shortText(proof?.headline || "Expected Impact", 82)}</h2>
            <p className="mt-7 line-clamp-2 break-words text-lg leading-8 text-slate-700">
              {proof?.body || "Realistic outcome ranges, not guaranteed results. The goal is practical local growth the client can see."}
            </p>
            <div className="mt-12 flex flex-wrap gap-7">
              {proofPoints.map((point, index) => (
                <MetricRing key={`${point.metric}-${point.label}`} metric={point.metric} label={point.label} color={colors[index] || theme.primary} />
              ))}
            </div>
            <h3 className="mt-16 text-3xl font-black text-slate-950">Launch Timeline</h3>
            <div className="mt-5 grid grid-cols-4 gap-4">
              {proposal.timeline.slice(0, 4).map((step, index) => (
                <div key={index} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-black text-sky-600">{step.label}</div>
                  <div className="mt-2 line-clamp-2 break-words text-sm font-bold text-slate-950">{step.title}</div>
                </div>
              ))}
            </div>
          </div>
          <VisualStack urls={slideVisuals(proposal, "proof", ["impact"])} className="max-h-[390px] self-start pt-8" />
        </div>
      </SlideShell>

      <SlideShell page={6} website={website}>
        <div className="grid h-full grid-cols-[minmax(0,0.92fr)_minmax(0,0.72fr)] gap-12">
          <div className="min-w-0">
            <h2 className="break-words text-5xl font-black leading-tight text-slate-950">{shortText(terms?.headline || "Clear Expectations", 78)}</h2>
            <div className="mt-8 rounded-2xl px-8 py-5 text-2xl font-black leading-tight text-white" style={{ backgroundColor: theme.primary }}>
              <span className="line-clamp-2 break-words">{shortText(terms?.subhead || "What Happens Next", 96)}</span>
            </div>
            <div className="mt-10 space-y-6">
              {(terms?.bullets?.length ? terms.bullets : proposal.terms).slice(0, 4).map((item, index) => (
                <div key={index} className="flex gap-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                  <p className="line-clamp-2 break-words text-lg leading-7 text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="min-w-0 pt-28">
            <h3 className="text-3xl font-black text-slate-950">Next Steps</h3>
            <div className="mt-8 space-y-7">
              {proposal.nextSteps.slice(0, 4).map((step, index) => (
                <div key={index} className="flex gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black text-white" style={{ backgroundColor: theme.primary }}>{index + 1}</span>
                  <p className="line-clamp-3 break-words text-lg font-semibold leading-7 text-slate-700">{step}</p>
                </div>
              ))}
            </div>
            <VisualStack urls={slideVisuals(proposal, "terms", ["impact"])} className="mt-10 max-h-32" />
          </div>
        </div>
      </SlideShell>

      <SlideShell page={7} website={website}>
        <div className="grid h-full grid-cols-[minmax(0,0.95fr)_minmax(0,0.75fr)] gap-12">
          <div className="flex min-w-0 flex-col">
            <LogoMark proposal={proposal} brandName={brandName} />
            <h2 className="mt-24 break-words text-5xl font-black leading-tight text-slate-950">
              {shortText(closing?.headline || "Ready to get found, trusted, and chosen?", 86)}
            </h2>
            <p className="mt-8 line-clamp-5 break-words text-xl leading-9 text-slate-700">{closing?.body || proposal.executiveSummary}</p>
            <div className="mt-auto inline-flex w-fit rounded-full bg-red-600 px-8 py-4 text-xl font-black text-white">Get Started</div>
          </div>
          <div className="flex min-w-0 flex-col items-center justify-center gap-8">
            <VisualStack urls={slideVisuals(proposal, "closing", ["impact", "about"])} className="max-h-[370px]" />
            <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-7 py-5">
              <div className="text-xl font-black text-slate-950">{proposal.contact?.name || preparedBy}</div>
              <div className="mt-3 break-words text-base leading-7 text-slate-700">
                {[proposal.contact?.email, proposal.contact?.phone, proposal.contact?.website].filter(Boolean).join(" | ")}
              </div>
            </div>
          </div>
        </div>
      </SlideShell>
    </div>
  );
}
