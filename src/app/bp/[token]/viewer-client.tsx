"use client";

import dynamic from "next/dynamic";
import { FileText, Sparkles, Download } from "lucide-react";

const ChartRenderer = dynamic(
  () =>
    import("@/app/(dashboard)/tools/business-plan/[id]/chart-renderer").then(
      (m) => m.ChartRenderer,
    ),
  { ssr: false, loading: () => <div className="h-64 bg-slate-200/30 rounded-md animate-pulse" /> },
);

interface Chart {
  type: "bar" | "line" | "pie";
  title: string;
  yLabel?: string;
  data: Array<{ name: string; value: number; value2?: number; value2Name?: string }>;
}

interface Section {
  id: string;
  slug: string;
  title: string;
  summary?: string;
  body: string;
  charts?: Chart[];
}

interface SharedPlan {
  name: string;
  industry: string | null;
  stage: string | null;
  coverColor: string;
  generationCount: number;
  createdAt: string;
  updatedAt: string;
  sections: Section[];
}

/**
 * Public (unauthenticated) viewer. Read-only — no edit controls, no share,
 * no regenerate. A "Download PDF" button is still useful for recipients who
 * want to save the plan offline. Uses window.print() with the same print
 * CSS as the authenticated viewer.
 */
export function SharedPlanViewer({ plan }: { plan: SharedPlan }) {
  return (
    <div className="bp-shared-root min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Minimal top bar — branding + PDF export */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b print:hidden">
        <div className="max-w-4xl mx-auto flex items-center justify-between p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <Sparkles className="h-4 w-4 text-brand-500" />
            Shared Business Plan
          </div>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors"
          >
            <Download className="h-4 w-4" />
            PDF
          </button>
        </div>
      </header>

      <div className="bp-print-area max-w-4xl mx-auto p-4 md:p-8 space-y-10">
        {/* Cover */}
        <section
          className="rounded-xl p-10 md:p-14 text-white shadow-xl relative overflow-hidden print:shadow-none print:rounded-none"
          style={{
            background: `linear-gradient(135deg, ${plan.coverColor} 0%, ${darken(plan.coverColor, 0.3)} 100%)`,
          }}
        >
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-medium uppercase tracking-wider mb-6">
              <FileText className="h-3.5 w-3.5" />
              Business Plan
            </div>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">{decodeEntities(plan.name)}</h1>
            <div className="flex flex-wrap gap-3 text-sm text-white/90">
              {plan.industry && (
                <span className="px-3 py-1 rounded-full bg-white/15 capitalize">
                  {plan.industry.replace(/_/g, " ")}
                </span>
              )}
              {plan.stage && (
                <span className="px-3 py-1 rounded-full bg-white/15 capitalize">{plan.stage}</span>
              )}
              <span className="px-3 py-1 rounded-full bg-white/15">
                {new Date(plan.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
          <Sparkles className="absolute right-8 top-8 h-24 w-24 text-white/10" />
        </section>

        {/* Table of contents */}
        <nav className="print:hidden">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">
            Contents
          </h2>
          <ol className="grid gap-2 sm:grid-cols-2 text-sm">
            {plan.sections.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#section-${s.slug}`}
                  className="flex items-start gap-3 p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <span className="w-6 h-6 shrink-0 rounded-full bg-brand-500/10 text-brand-600 flex items-center justify-center text-xs font-semibold">
                    {i + 1}
                  </span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">{decodeEntities(s.title)}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {plan.sections.map((section, idx) => (
          <section
            key={section.id}
            id={`section-${section.slug}`}
            className="scroll-mt-20 print:break-before-page"
          >
            <div className="text-xs font-semibold text-brand-500 uppercase tracking-wider mb-1">
              Section {idx + 1}
            </div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {decodeEntities(section.title)}
            </h2>
            {section.summary && (
              <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm italic">{decodeEntities(section.summary)}</p>
            )}

            <div
              className="bp-body mt-4 text-slate-800 dark:text-slate-200"
              dangerouslySetInnerHTML={{ __html: section.body }}
            />

            {section.charts && section.charts.length > 0 && (
              <div className="grid gap-6 mt-6">
                {section.charts.map((c, ci) => (
                  <div
                    key={ci}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-6"
                  >
                    <div className="text-sm font-semibold mb-3 text-slate-900 dark:text-slate-100">
                      {c.title}
                    </div>
                    <ChartRenderer chart={c} primaryColor={plan.coverColor} />
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}

        <footer className="text-center text-xs text-slate-500 pt-6 border-t border-slate-200 dark:border-slate-800">
          Generated by FlowSmartly · v{plan.generationCount} · Updated{" "}
          {new Date(plan.updatedAt).toLocaleDateString()}
        </footer>
      </div>

      <style jsx global>{`
        .bp-body h2 { font-size: 1.25rem; font-weight: 700; margin-top: 1.5rem; margin-bottom: 0.5rem; }
        .bp-body h3 { font-size: 1.05rem; font-weight: 600; margin-top: 1rem; margin-bottom: 0.35rem; }
        .bp-body p { margin-bottom: 0.75rem; line-height: 1.7; }
        .bp-body ul, .bp-body ol { margin-bottom: 0.75rem; padding-left: 1.25rem; list-style: disc; }
        .bp-body ol { list-style: decimal; }
        .bp-body li { margin-bottom: 0.25rem; }
        .bp-body blockquote {
          border-left: 3px solid ${plan.coverColor};
          padding-left: 1rem;
          color: rgb(100 116 139);
          font-style: italic;
          margin: 1rem 0;
        }
        .bp-body table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.875rem; }
        .bp-body th, .bp-body td { border: 1px solid rgb(226 232 240); padding: 0.5rem 0.75rem; text-align: left; }
        .bp-body th { background: rgb(241 245 249); font-weight: 600; }
        .dark .bp-body th, .dark .bp-body td { border-color: rgb(51 65 85); }
        .dark .bp-body th { background: rgb(30 41 59); }

        @media print {
          .bp-shared-root { background: white; color: black; }
          .bp-print-area { max-width: none; padding: 0; }
          .print\\:hidden { display: none !important; }
          .print\\:break-before-page { break-before: page; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:rounded-none { border-radius: 0 !important; }
        }
      `}</style>
    </div>
  );
}

function decodeEntities(s: string): string {
  if (!s) return s;
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function darken(hex: string, amount: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = Math.max(0, Math.floor(parseInt(h.slice(0, 2), 16) * (1 - amount)));
  const g = Math.max(0, Math.floor(parseInt(h.slice(2, 4), 16) * (1 - amount)));
  const b = Math.max(0, Math.floor(parseInt(h.slice(4, 6), 16) * (1 - amount)));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
