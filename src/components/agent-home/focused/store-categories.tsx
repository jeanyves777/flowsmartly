"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Plus, Pencil, Trash2, X, Check, Image as ImageIcon, FolderTree } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { MediaLibraryPicker } from "@/components/shared/media-library-picker";
import { cn } from "@/lib/utils/cn";
import { FIELD, LABEL, SectionCard, EmptyState } from "./store-ui";

/**
 * Store categories — real catalog CRUD (name, description, image, parent, order)
 * on /api/ecommerce/categories. Products link to these; the storefront renders
 * them. Every action is real UI — add/edit inline forms, two-step delete. A
 * category with children can't be deleted (server-enforced). [[surface-buttons-are-ui-actions]]
 */

interface Category { id: string; name: string; slug?: string; description?: string | null; imageUrl?: string | null; parentId?: string | null; sortOrder?: number; productCount?: number; children?: Category[]; }
type Draft = { name: string; description: string; imageUrl: string; parentId: string };
const EMPTY: Draft = { name: "", description: "", imageUrl: "", parentId: "" };

// Flatten the category tree into rows tagged with depth for indentation.
function flatten(cats: Category[], depth = 0): Array<Category & { depth: number }> {
  return cats.flatMap((c) => [{ ...c, depth }, ...flatten(c.children || [], depth + 1)]);
}

export function StoreCategories() {
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<"new" | string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = useCallback(async () => {
    const j = await fetch("/api/ecommerce/categories").then((r) => r.json()).catch(() => null);
    setCats(Array.isArray(j?.data?.categories) ? j.data.categories : []);
  }, []);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  const rows = flatten(cats);
  const openAdd = () => { setDraft(EMPTY); setError(""); setEditing("new"); };
  const openEdit = (c: Category) => { setDraft({ name: c.name, description: c.description || "", imageUrl: c.imageUrl || "", parentId: c.parentId || "" }); setError(""); setEditing(c.id); setConfirmDelete(null); };

  const save = async () => {
    if (!draft.name.trim()) { setError("Give the category a name."); return; }
    setSaving(true); setError("");
    try {
      const isEdit = editing && editing !== "new";
      const body: Record<string, unknown> = {
        name: draft.name.trim(),
        description: draft.description.trim() || undefined,
        imageUrl: draft.imageUrl || undefined,
        parentId: draft.parentId || (isEdit ? null : undefined),
      };
      const r = await fetch(isEdit ? `/api/ecommerce/categories/${editing}` : "/api/ecommerce/categories", {
        method: isEdit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.success !== false) { setEditing(null); await load(); }
      else setError(j?.error?.message || j?.error || "Couldn't save the category.");
    } catch { setError("Couldn't save the category."); }
    finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    setDeletingId(id); setError("");
    try {
      const r = await fetch(`/api/ecommerce/categories/${id}`, { method: "DELETE" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.success !== false) { setConfirmDelete(null); if (editing === id) setEditing(null); await load(); }
      else setError(j?.error?.code === "HAS_CHILDREN" ? "Remove or re-parent the sub-categories first." : (j?.error?.message || "Couldn't delete the category."));
    } catch { setError("Couldn't delete the category."); }
    finally { setDeletingId(null); }
  };

  if (loading) return <SectionCard><div className="grid place-items-center py-10"><FlowLoader size={24} label="Loading categories…" /></div></SectionCard>;

  return (
    <SectionCard icon={FolderTree} title={`Categories (${rows.length})`} hint="Real catalog categories — image, description, order, and hierarchy. Products link to these." right={<button onClick={openAdd} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm"><Plus className="h-3.5 w-3.5" /> Add category</button>}>
      {editing && (
        <div className="mb-3 rounded-xl border border-brand-500/30 bg-brand-500/5 p-3.5">
          <p className="mb-2.5 text-[12.5px] font-semibold">{editing === "new" ? "New category" : "Edit category"}</p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <label className="block"><span className={LABEL}>Name *</span><input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Beans" className={FIELD} /></label>
            <label className="block"><span className={LABEL}>Parent category</span>
              <select value={draft.parentId} onChange={(e) => setDraft((d) => ({ ...d, parentId: e.target.value }))} className={FIELD}>
                <option value="">None (top level)</option>
                {rows.filter((c) => c.id !== editing).map((c) => <option key={c.id} value={c.id}>{"— ".repeat(c.depth)}{c.name}</option>)}
              </select>
            </label>
          </div>
          <label className="mt-2.5 block"><span className={LABEL}>Description</span><input value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} placeholder="Single-origin & blends" className={FIELD} /></label>
          <div className="mt-2.5">
            <span className={LABEL}>Image</span>
            <button onClick={() => setPickerOpen(true)} className="flex items-center gap-3 rounded-lg border border-border bg-background p-2 text-left hover:border-brand-500/60">
              <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-md bg-muted/40">{draft.imageUrl ? <Image src={draft.imageUrl} alt="" width={48} height={48} className="h-full w-full object-cover" unoptimized /> : <ImageIcon className="h-5 w-5 text-muted-foreground" />}</span>
              <span className="text-[12px] font-semibold text-muted-foreground">{draft.imageUrl ? "Change image" : "Choose image"}</span>
            </button>
          </div>
          {error && <p className="mt-2 text-[12px] text-rose-500">{error}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60">{saving ? <FlowLoader size={14} tone="white" /> : <Check className="h-3.5 w-3.5" />} {editing === "new" ? "Add category" : "Save"}</button>
            <button onClick={() => setEditing(null)} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3.5 py-2 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /> Cancel</button>
          </div>
        </div>
      )}

      {rows.length === 0 && !editing ? (
        <EmptyState title="No categories yet" sub="Group your products so the storefront can show category pages." action={<button onClick={openAdd} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"><Plus className="h-4 w-4" /> Add a category</button>} />
      ) : (
        <div className="space-y-2">
          {rows.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5" style={{ marginInlineStart: c.depth * 20 }}>
              <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-background">{c.imageUrl ? <Image src={c.imageUrl} alt="" width={40} height={40} className="h-full w-full object-cover" unoptimized /> : <ImageIcon className="h-4 w-4 text-muted-foreground" />}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold">{c.name}</p>
                {c.description && <p className="truncate text-[11.5px] text-muted-foreground">{c.description}</p>}
              </div>
              <span className="text-[11.5px] text-muted-foreground tabular-nums">{c.productCount ?? 0} product{(c.productCount ?? 0) === 1 ? "" : "s"}</span>
              <button onClick={() => openEdit(c)} className="grid h-8 w-8 place-items-center rounded-[9px] border border-border text-muted-foreground hover:border-brand-500/60 hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
              {confirmDelete === c.id ? (
                <div className="inline-flex items-center gap-1.5">
                  <button onClick={() => remove(c.id)} disabled={deletingId === c.id} className="inline-flex items-center gap-1 rounded-[8px] bg-rose-500 px-2.5 py-1.5 text-[11.5px] font-semibold text-white disabled:opacity-60">{deletingId === c.id ? <FlowLoader size={12} tone="white" /> : <Trash2 className="h-3 w-3" />} Delete</button>
                  <button onClick={() => setConfirmDelete(null)} className="text-[11.5px] font-semibold text-muted-foreground hover:text-foreground">Keep</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(c.id)} className="grid h-8 w-8 place-items-center rounded-[9px] border border-border text-muted-foreground hover:border-rose-500/60 hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>
              )}
            </div>
          ))}
          {error && !editing && <p className="text-[12px] text-rose-500">{error}</p>}
        </div>
      )}

      {pickerOpen && <MediaLibraryPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={(url) => { setDraft((d) => ({ ...d, imageUrl: url })); setPickerOpen(false); }} filterTypes={["image"]} />}
    </SectionCard>
  );
}
