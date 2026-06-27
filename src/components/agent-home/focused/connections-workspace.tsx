"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Plus, X, RefreshCw } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * Connections — a REAL new-design surface to connect/disconnect social accounts
 * inline. No redirect-to-legacy: "Connect" navigates to the platform's official
 * OAuth (/api/social/<platform>/connect) and returns here; "Disconnect" hits
 * DELETE /api/social-accounts/[id]. [[new-design-no-legacy]]
 */

interface Account {
  id: string;
  platform: string;
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  needsReconnect?: boolean;
}
interface Platform {
  platform: string;
  name?: string;
  connected?: boolean;
  connectedCount?: number;
  accounts?: Account[];
}

const CONNECTABLE = ["instagram", "facebook", "twitter", "linkedin", "tiktok", "youtube", "pinterest"];
const COLORS: Record<string, string> = {
  instagram: "#E4405F", facebook: "#1877F2", twitter: "#1d9bf0", linkedin: "#0A66C2",
  tiktok: "#111827", youtube: "#FF0000", pinterest: "#E60023",
};
const NAMES: Record<string, string> = {
  instagram: "Instagram", facebook: "Facebook", twitter: "X / Twitter", linkedin: "LinkedIn",
  tiktok: "TikTok", youtube: "YouTube", pinterest: "Pinterest",
};

export function FocusedConnections({ refreshKey }: { refreshKey?: number }) {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/social-accounts")
      .then((r) => r.json())
      .then((j) => { if (j?.success && Array.isArray(j.data?.platforms)) setPlatforms(j.data.platforms); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);

  const connect = (platform: string) => { window.location.href = `/api/social/${platform}/connect`; };
  const disconnect = async (id: string) => {
    setBusy(id);
    try { await fetch(`/api/social-accounts/${id}`, { method: "DELETE" }); load(); } catch { /* ignore */ } finally { setBusy(null); }
  };

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Loading connections…" /></div>;
  }

  const byKey = new Map(platforms.map((p) => [p.platform, p]));
  const list = CONNECTABLE.map((key) => byKey.get(key) ?? { platform: key, accounts: [] as Account[] });

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <p className="text-[13px] text-muted-foreground">Connect your accounts to publish and cross-post. We use each platform’s official login — you’ll come right back here after authorizing.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((p) => {
            const accounts = p.accounts ?? [];
            const color = COLORS[p.platform] ?? "#0ea5e9";
            return (
              <div key={p.platform} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                  <h3 className="text-[14px] font-bold">{p.name || NAMES[p.platform] || p.platform}</h3>
                  {accounts.length > 0 && <span className="ms-auto text-[11.5px] font-medium text-emerald-500">{accounts.length} connected</span>}
                </div>

                {accounts.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {accounts.map((a) => (
                      <div key={a.id} className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/30 px-3 py-2">
                        {a.avatarUrl ? (
                          <Image src={a.avatarUrl} alt="" width={28} height={28} className="h-7 w-7 shrink-0 rounded-full object-cover" unoptimized />
                        ) : (
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: color }}>{(a.displayName || a.username || "?").slice(0, 1).toUpperCase()}</span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12.5px] font-medium">{a.displayName || a.username || "Account"}</p>
                          {a.username && <p className="truncate text-[11px] text-muted-foreground">@{a.username}</p>}
                        </div>
                        {a.needsReconnect && (
                          <button onClick={() => connect(p.platform)} className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-amber-500 hover:text-amber-400"><RefreshCw className="h-3 w-3" /> Reconnect</button>
                        )}
                        <button onClick={() => disconnect(a.id)} disabled={busy === a.id} aria-label="Disconnect" className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50">
                          {busy === a.id ? <FlowLoader size={12} /> : <X className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button onClick={() => connect(p.platform)} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12.5px] font-semibold transition hover:border-brand-500/60 hover:text-foreground">
                  <Plus className="h-3.5 w-3.5" /> {accounts.length > 0 ? "Add another" : "Connect"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
