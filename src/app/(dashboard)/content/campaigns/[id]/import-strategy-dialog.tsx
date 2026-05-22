"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface Strategy {
  id: string;
  name: string;
  totalTasks: number;
  completedTasks: number;
}

interface Task {
  id: string;
  title: string;
  category: string | null;
  status: string;
  dueDate: string | null;
  automationStatus: string;
}

interface Props {
  campaignId: string;
  onClose: () => void;
  onImported: () => void;
}

export default function ImportStrategyDialog({
  campaignId,
  onClose,
  onImported,
}: Props) {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/content/strategy/plans")
      .then((r) => r.json())
      .then((json) => {
        if (json?.success) {
          setStrategies(json.data.strategies);
          if (json.data.strategies[0]) {
            setSelectedStrategy(json.data.strategies[0].id);
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedStrategy) return;
    setTasksLoading(true);
    fetch(`/api/content/strategy/${selectedStrategy}`)
      .then((r) => r.json())
      .then((json) => {
        if (json?.success) {
          setTasks(json.data.strategy.tasks ?? []);
        }
        setTasksLoading(false);
      })
      .catch(() => setTasksLoading(false));
  }, [selectedStrategy]);

  const toggleTask = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    if (!selectedStrategy || selected.size === 0) {
      setError("Pick a strategy and at least one task");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch(
      `/api/content/campaigns/${campaignId}/import-strategy`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategyId: selectedStrategy,
          taskIds: [...selected],
        }),
      },
    );
    const json = await res.json();
    setSaving(false);
    if (!json?.success) {
      setError(json?.error?.message ?? "Import failed");
      return;
    }
    const skipped: { taskId: string; reason: string }[] = json.data.skipped ?? [];
    if (skipped.length > 0) {
      setSummary(
        `Imported ${json.data.created.length} item(s). ${skipped.length} skipped (not suited for social content).`,
      );
      setTimeout(onImported, 1500);
    } else {
      onImported();
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import from a marketing strategy</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-10 text-center text-sm text-zinc-500">
            Loading...
          </div>
        ) : strategies.length === 0 ? (
          <div className="py-6 text-center text-sm text-zinc-500">
            You don&apos;t have any strategies yet.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Strategy</Label>
              <select
                value={selectedStrategy ?? ""}
                onChange={(e) => {
                  setSelectedStrategy(e.target.value);
                  setSelected(new Set());
                }}
                className="w-full border rounded px-3 py-2 text-sm bg-white dark:bg-zinc-900 dark:border-zinc-700"
              >
                {strategies.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.completedTasks}/{s.totalTasks} done)
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Tasks to import</Label>
              {tasksLoading ? (
                <div className="text-sm text-zinc-500">Loading tasks...</div>
              ) : tasks.length === 0 ? (
                <div className="text-sm text-zinc-500">No tasks in this strategy.</div>
              ) : (
                <div className="max-h-72 overflow-y-auto space-y-1 border rounded-md p-2 bg-zinc-50 dark:bg-zinc-900/40">
                  {tasks.map((t) => {
                    const isSelected = selected.has(t.id);
                    const isAutomated = t.automationStatus === "AUTOMATED";
                    return (
                      <label
                        key={t.id}
                        className={`flex items-center gap-3 px-2 py-1.5 rounded cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                          isSelected ? "bg-blue-50 dark:bg-blue-900/20" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleTask(t.id)}
                          disabled={isAutomated}
                        />
                        <span className="text-sm flex-1 truncate">{t.title}</span>
                        {t.category && (
                          <Badge variant="outline" className="text-xs">
                            {t.category}
                          </Badge>
                        )}
                        {isAutomated && (
                          <Badge variant="outline" className="text-xs text-zinc-400">
                            already automated
                          </Badge>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {summary && (
              <div className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-md p-2">
                {summary}
              </div>
            )}
            {error && (
              <div className="text-sm text-rose-600 dark:text-rose-400">
                {error}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={saving || selected.size === 0 || !selectedStrategy}
          >
            {saving ? "Importing..." : `Import ${selected.size} task(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
