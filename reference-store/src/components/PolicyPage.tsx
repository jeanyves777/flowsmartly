"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, Mail, Phone, MapPin, Printer, Sparkles, HelpCircle } from "lucide-react";
import { storeInfo } from "@/lib/data";

interface PolicyPageProps {
  title: string;
  icon?: React.ReactNode;
  content: string;            // HTML string (from @/lib/data policies)
  lastUpdated?: string;
  /** Optional plain-English "key points" shown as a summary callout. */
  summary?: string[];
  /** Other policies to cross-link at the bottom. */
  related?: { href: string; label: string }[];
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "section";
}

export default function PolicyPage({ title, icon, content, lastUpdated, summary, related }: PolicyPageProps) {
  const docRef = useRef<HTMLDivElement>(null);
  const [toc, setToc] = useState<{ id: string; label: string }[]>([]);
  const [active, setActive] = useState("");
  const [progress, setProgress] = useState(0);

  const readMins = useMemo(() => {
    const words = content.replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
  }, [content]);

  // Build the table of contents from the content's <h2>s, give them ids +
  // scroll-margin, and wire scroll-spy so the active section highlights.
  useEffect(() => {
    const el = docRef.current;
    if (!el) return;
    const heads = Array.from(el.querySelectorAll("h2")) as HTMLElement[];
    const used = new Set<string>();
    const items = heads.map((h) => {
      const label = (h.textContent || "").trim();
      let id = slugify(label);
      while (used.has(id)) id = `${id}-x`;
      used.add(id);
      h.id = id;
      h.style.scrollMarginTop = "96px";
      return { id, label };
    });
    setToc(items);
    if (items[0]) setActive(items[0].id);

    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setActive((e.target as HTMLElement).id); }),
      { rootMargin: "-40% 0px -55% 0px" }
    );
    heads.forEach((h) => io.observe(h));
    return () => io.disconnect();
  }, [content]);

  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      setProgress(h.scrollTop / ((h.scrollHeight - h.clientHeight) || 1));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="pb-20">
      {/* auto-numbered sections + note styling — scoped by the pp- prefix */}
      <style>{`
        .pp-doc{counter-reset:pp-sec}
        .pp-doc h2{counter-increment:pp-sec;display:flex;align-items:center;gap:.6rem;font-size:1.35rem;line-height:1.25;margin:0 0 .4rem}
        .pp-doc h2::before{content:counter(pp-sec);display:grid;place-items:center;width:1.7rem;height:1.7rem;flex:0 0 auto;border-radius:.55rem;font-size:.8rem;font-weight:800;background:var(--color-primary-50,#eef2ff);color:var(--color-primary-600,#2447d6)}
        .pp-doc h2:not(:first-child){padding-top:1.4rem;margin-top:1.5rem;border-top:1px solid var(--color-gray-200,#e7ebf2)}
        .dark .pp-doc h2:not(:first-child){border-top-color:rgba(255,255,255,.08)}
        .dark .pp-doc h2::before{background:var(--color-primary-900,#141d33);color:var(--color-primary-300,#93a7ff)}
        .pp-doc blockquote{border-left:3px solid var(--color-primary-500,#2f5cff);background:var(--color-primary-50,#eef2ff);border-radius:0 .6rem .6rem 0;padding:.75rem 1rem;margin:1rem 0;font-style:normal;quotes:none}
        .pp-doc blockquote p{margin:0}
        .dark .pp-doc blockquote{background:var(--color-primary-900,#141d33)}
        .pp-bar{transition:width .12s linear}
      `}</style>

      {/* reading progress */}
      <div className="fixed left-0 top-0 z-50 h-[3px] bg-primary-500 pp-bar" style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }} />

      {/* branded header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-gradient-to-b from-primary-50/70 to-transparent dark:from-primary-900/15">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-8">
          <nav className="flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500 mb-6">
            <Link href="/" className="hover:text-primary-600 transition-colors font-medium">Home</Link>
            <ChevronRight size={14} />
            <span className="text-gray-500 dark:text-gray-400">Legal</span>
            <ChevronRight size={14} />
            <span className="text-gray-800 dark:text-gray-200 font-semibold">{title}</span>
          </nav>
          <div className="flex items-start gap-4">
            {icon && (
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-400 text-white grid place-items-center shrink-0 shadow-lg shadow-primary-500/25">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white text-balance">{title}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1 font-semibold">Updated {lastUpdated || "April 2026"}</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1 font-semibold">~{readMins} min read</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1 font-semibold">{storeInfo.name}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* body */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8 items-start">
          {/* sticky TOC */}
          <aside className="hidden lg:block sticky top-[88px]">
            {toc.length > 1 && (
              <>
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">On this page</p>
                <ul className="border-l-2 border-gray-200 dark:border-gray-800 space-y-0.5">
                  {toc.map((t) => (
                    <li key={t.id}>
                      <a href={`#${t.id}`} className={`block -ml-0.5 border-l-2 pl-4 py-1.5 text-[13.5px] font-semibold transition-colors ${active === t.id ? "border-primary-500 text-primary-600 dark:text-primary-400" : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"}`}>
                        {t.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="mt-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 p-4">
              <div className="flex items-center gap-2 text-[13.5px] font-bold"><HelpCircle size={16} className="text-primary-600 dark:text-primary-400" /> Questions?</div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">We're happy to help with anything here.</p>
              {storeInfo.email && <a href={`mailto:${storeInfo.email}`} className="mt-2.5 flex items-center gap-2 text-[13px] font-semibold text-primary-600 dark:text-primary-400 hover:underline"><Mail size={14} /> {storeInfo.email}</a>}
              <button onClick={() => window.print()} className="mt-1.5 flex items-center gap-2 text-[13px] font-semibold text-gray-600 dark:text-gray-300 hover:text-primary-600 cursor-pointer"><Printer size={14} /> Print / save PDF</button>
            </div>
          </aside>

          {/* document */}
          <article className="min-w-0 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 p-6 sm:p-9 shadow-sm">
            {summary && summary.length > 0 && (
              <div className="mb-7 rounded-2xl border border-primary-200 dark:border-primary-900/50 bg-gradient-to-b from-primary-50 to-transparent dark:from-primary-900/20 p-4 sm:p-5">
                <div className="flex items-center gap-2 text-[13px] font-extrabold text-primary-600 dark:text-primary-400 mb-2"><Sparkles size={15} /> Key points</div>
                <ul className="space-y-1.5 pl-1">
                  {summary.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-[14.5px] text-gray-700 dark:text-gray-300">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary-500 shrink-0" /> <span dangerouslySetInnerHTML={{ __html: s }} />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div
              ref={docRef}
              className="pp-doc prose prose-lg dark:prose-invert max-w-none
                prose-headings:font-bold prose-headings:text-gray-900 dark:prose-headings:text-white
                prose-h3:text-base prose-h3:mt-6 prose-h3:mb-1
                prose-p:text-gray-600 dark:prose-p:text-gray-300 prose-p:leading-relaxed prose-p:text-[15.5px]
                prose-li:text-gray-600 dark:prose-li:text-gray-300 prose-li:text-[15.5px] prose-li:my-1
                prose-strong:text-gray-900 dark:prose-strong:text-white
                prose-a:text-primary-600 dark:prose-a:text-primary-400 prose-a:no-underline hover:prose-a:underline"
              dangerouslySetInnerHTML={{ __html: content }}
            />

            {/* contact */}
            <div className="mt-9 rounded-2xl border border-primary-200 dark:border-primary-900/50 bg-primary-50/60 dark:bg-primary-900/10 p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Questions about this policy?</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Reach the {storeInfo.name} team — we're happy to help.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {storeInfo.email && <a href={`mailto:${storeInfo.email}`} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 text-sm font-semibold transition-colors"><Mail size={15} /> Email us</a>}
                {storeInfo.phone && <a href={`tel:${storeInfo.phone}`} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200"><Phone size={15} /> Call</a>}
              </div>
            </div>

            {storeInfo.address && (
              <p className="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400"><MapPin size={14} className="text-primary-600 dark:text-primary-400" /> {storeInfo.address}</p>
            )}

            {/* related policies */}
            {related && related.length > 0 && (
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {related.map((r) => (
                  <Link key={r.href} href={r.href} className="group block rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 px-4 py-3 hover:border-primary-400 dark:hover:border-primary-700 transition-colors">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Legal</span>
                    <span className="mt-0.5 flex items-center justify-between text-sm font-bold text-gray-900 dark:text-white">{r.label} <ChevronRight size={16} className="text-gray-400 group-hover:text-primary-500 transition-colors" /></span>
                  </Link>
                ))}
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
              <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 transition-colors"><ArrowLeft size={16} /> Back to {storeInfo.name}</Link>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
