"use client";
/**
 * useTextPrompt — an in-app replacement for the native window.prompt.
 *
 * Studios call `ask(title, defaultValue, multiline?)` and await the result
 * (string, or null on cancel); render `promptNode` once in the component. Shared
 * so every playground uses the same on-brand modal instead of the browser dialog.
 */
import { useCallback, useState } from "react";

export function useTextPrompt() {
  const [st, setSt] = useState<{ title: string; value: string; multiline: boolean; resolve: (v: string | null) => void } | null>(null);
  const ask = useCallback((title: string, defaultValue = "", multiline = false) =>
    new Promise<string | null>((resolve) => setSt({ title, value: defaultValue, multiline, resolve })), []);
  const done = (v: string | null) => { setSt((s) => { s?.resolve(v); return null; }); };
  const promptNode = st ? (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/60 p-4" onMouseDown={() => done(null)}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-4 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <p className="mb-2.5 text-[13px] font-bold">{st.title}</p>
        {st.multiline ? (
          <textarea autoFocus value={st.value} onChange={(e) => setSt((s) => (s ? { ...s, value: e.target.value } : s))}
            className="min-h-[90px] w-full resize-y rounded-lg border border-border bg-muted/30 p-2.5 text-[12.5px] leading-relaxed outline-none focus:border-brand-500" />
        ) : (
          <input autoFocus value={st.value} onChange={(e) => setSt((s) => (s ? { ...s, value: e.target.value } : s))}
            onKeyDown={(e) => { if (e.key === "Enter") done((e.target as HTMLInputElement).value); }}
            className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-[12.5px] outline-none focus:border-brand-500" />
        )}
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={() => done(null)} className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold">Cancel</button>
          <button onClick={() => done(st.value)} className="rounded-lg bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-bold text-white">OK</button>
        </div>
      </div>
    </div>
  ) : null;
  return { ask, promptNode };
}
