"use client";

import { useMemo, useState } from "react";
import { FloatingPanel } from "@/components/ui/floating-panel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AISpinner } from "@/components/shared/ai-generation-loader";
import { AILoaderOverlay } from "@/components/shared/ai-loader-overlay";
import { SlidersHorizontal, CheckCircle2, EyeOff, XCircle, RefreshCcw } from "lucide-react";

interface Automation {
  id: string;
  name: string;
  reviewStatus: string;
  status: string;
}

interface Props {
  campaignId: string;
  items: Automation[];
  onClose: () => void;
  onUpdated: () => void;
}

type Mode = "fields" | "action";

export default function BulkUpdateDialog({
  campaignId,
  items,
  onClose,
  onUpdated,
}: Props) {
  // Default-select all non-canceled items
  const eligible = useMemo(
    () => items.filter((i) => i.status !== "CANCELED" && i.status !== "COMPLETED"),
    [items],
  );
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(eligible.map((i) => i.id)),
  );
  const [mode, setMode] = useState<Mode>("fields");

  // Field updates
  const [tier, setTier] = useState<"standard" | "premium" | "">("");
  const [style, setStyle] = useState<"realistic" | "3d" | "">("");
  const [appliesTo, setAppliesTo] = useState<string>("");

  // Bulk action
  const [action, setAction] = useState<"approve" | "skip" | "unapprove" | "cancel" | "">("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectAll = () => setSelected(new Set(eligible.map((i) => i.id)));
  const clearAll = () => setSelected(new Set());

  const submit = async () => {
    if (selected.size === 0) {
      setError("Pick at least one item");
      return;
    }
    const body: Record<string, unknown> = { itemIds: [...selected] };
    if (mode === "action") {
      if (!action) {
        setError("Pick an action");
        return;
      }
      body.action = action;
    } else {
      if (!tier && !style && !appliesTo) {
        setError("Pick at least one field to update");
        return;
      }
      if (tier) body.tier = tier;
      if (style) body.style = style;
      if (appliesTo) body.appliesTo = appliesTo;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/content/campaigns/${campaignId}/automations/bulk-update`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const json = await res.json();
      if (!json?.success) {
        setError(json?.error?.message ?? "Bulk update failed");
        setSaving(false);
        return;
      }
      setSummary(
        `${json.data.affected} of ${json.data.total} item${json.data.total === 1 ? "" : "s"} updated`,
      );
      setTimeout(onUpdated, 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk update failed");
      setSaving(false);
    }
  };

  return (
    <>
      <AILoaderOverlay
        open={saving}
        zIndex={100}
        currentStep={
          mode === "action"
            ? `Applying ${action} to ${selected.size} item${selected.size === 1 ? "" : "s"}...`
            : `Updating ${selected.size} item${selected.size === 1 ? "" : "s"}...`
        }
        subtitle="Applying changes to selected items"
      />
      <FloatingPanel
        open
        onOpenChange={(next) => !next && !saving && onClose()}
        title="Bulk update items"
        description="Apply the same setting or action across multiple items in this campaign."
        icon={<SlidersHorizontal className="h-4 w-4" />}
        defaultSize={{ width: 760, height: 720 }}
        minSize={{ width: 380, height: 480 }}
      >
        <div className="space-y-4">
          {/* Item picker */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">
                Items to update ({selected.size} of {eligible.length})
              </Label>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={selectAll}>
                  Select all
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
                  Clear
                </Button>
              </div>
            </div>
            <div className="max-h-44 overflow-y-auto space-y-1 border rounded-md p-2 bg-zinc-50 dark:bg-zinc-900/40">
              {eligible.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No eligible items (canceled / completed items are excluded).
                </p>
              ) : (
                eligible.map((it) => {
                  const checked = selected.has(it.id);
                  return (
                    <label
                      key={it.id}
                      className={`flex items-center gap-3 px-2 py-1.5 rounded cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                        checked ? "bg-blue-50 dark:bg-blue-900/20" : ""
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggle(it.id)}
                      />
                      <span className="text-sm flex-1 truncate">{it.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {it.reviewStatus.replace("_", " ")}
                      </Badge>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* Mode switch */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode("fields")}
              className={`text-left px-3 py-2 rounded-md border text-sm ${
                mode === "fields"
                  ? "bg-blue-50 border-blue-500 dark:bg-blue-900/20"
                  : "bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-700"
              }`}
            >
              <div className="font-medium">Update settings</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Quality / Style / Apply-to scope on selected items
              </div>
            </button>
            <button
              type="button"
              onClick={() => setMode("action")}
              className={`text-left px-3 py-2 rounded-md border text-sm ${
                mode === "action"
                  ? "bg-blue-50 border-blue-500 dark:bg-blue-900/20"
                  : "bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-700"
              }`}
            >
              <div className="font-medium">Bulk action</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Approve / skip / unapprove / cancel all selected
              </div>
            </button>
          </div>

          {mode === "fields" && (
            <div className="space-y-3 rounded-md border bg-zinc-50 dark:bg-zinc-900/40 p-3">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Leave any field unset to keep its current value on each item.
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <Label className="text-xs w-20">Quality:</Label>
                {(["", "standard", "premium"] as const).map((t) => (
                  <button
                    key={t || "none"}
                    type="button"
                    onClick={() => setTier(t)}
                    className={`px-3 py-1.5 rounded text-xs font-medium border ${
                      tier === t
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700"
                    }`}
                  >
                    {t === "" ? "Don't change" : t === "standard" ? "Standard" : "Premium"}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Label className="text-xs w-20">Style:</Label>
                {(["", "realistic", "3d"] as const).map((s) => (
                  <button
                    key={s || "none"}
                    type="button"
                    onClick={() => setStyle(s)}
                    className={`px-3 py-1.5 rounded text-xs font-medium border ${
                      style === s
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700"
                    }`}
                  >
                    {s === "" ? "Don't change" : s === "realistic" ? "Realistic" : "3D"}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Label className="text-xs w-20">Apply to:</Label>
                <select
                  value={appliesTo}
                  onChange={(e) => setAppliesTo(e.target.value)}
                  className="text-xs border rounded px-2 py-1.5 bg-white dark:bg-zinc-950 dark:border-zinc-700"
                >
                  <option value="">Don&apos;t change</option>
                  <option value="all">All future years (reuse every year)</option>
                  <option value={String(new Date().getFullYear())}>
                    This year only ({new Date().getFullYear()})
                  </option>
                  <option value={String(new Date().getFullYear() + 1)}>
                    Next year only ({new Date().getFullYear() + 1})
                  </option>
                </select>
              </div>
            </div>
          )}

          {mode === "action" && (
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { v: "approve", label: "Approve all", icon: CheckCircle2 },
                  { v: "unapprove", label: "Unapprove all", icon: RefreshCcw },
                  { v: "skip", label: "Skip all", icon: EyeOff },
                  { v: "cancel", label: "Cancel all", icon: XCircle },
                ] as const
              ).map(({ v, label, icon: Icon }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAction(v)}
                  className={`text-left px-3 py-2 rounded-md border text-sm flex items-center gap-2 ${
                    action === v
                      ? v === "cancel"
                        ? "bg-rose-50 border-rose-500 text-rose-700 dark:bg-rose-900/20"
                        : "bg-blue-50 border-blue-500 dark:bg-blue-900/20"
                      : "bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-700"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          )}

          {summary && (
            <div className="text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded p-2">
              {summary}
            </div>
          )}
          {error && (
            <div className="text-sm text-rose-600 dark:text-rose-400">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t mt-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={submit} disabled={saving || selected.size === 0}>
              {saving && <AISpinner className="w-4 h-4 mr-2" />}
              {saving
                ? "Applying..."
                : mode === "action"
                ? `Apply to ${selected.size} item${selected.size === 1 ? "" : "s"}`
                : `Update ${selected.size} item${selected.size === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      </FloatingPanel>
    </>
  );
}
