"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FolderOpen,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ChevronRight,
  X,
  Check,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── Types ──

interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  parentId: string | null;
  sortOrder: number;
  productCount: number;
  children: CategoryNode[];
}

// ── Component ──

export default function CategoriesPage() {
  const { toast } = useToast();

  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(true);

  // Create/Edit modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formParentId, setFormParentId] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Collapsed state for tree
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // ── Fetch ──

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/ecommerce/categories");
      const json = await res.json();
      if (json.success) {
        setCategories(json.data.categories);
      }
    } catch {
      toast({ title: "Failed to load categories", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // ── Flatten for parent dropdown (exclude self and descendants) ──

  const flatCategories: { id: string; name: string; depth: number }[] = [];
  function flattenCats(cats: CategoryNode[], depth = 0, excludeId?: string) {
    for (const cat of cats) {
      if (cat.id === excludeId) continue;
      flatCategories.push({ id: cat.id, name: cat.name, depth });
      if (cat.children) flattenCats(cat.children, depth + 1, excludeId);
    }
  }
  flattenCats(categories, 0, editingId || undefined);

  // ── Find category by ID in tree ──

  function findCategory(cats: CategoryNode[], id: string): CategoryNode | null {
    for (const cat of cats) {
      if (cat.id === id) return cat;
      if (cat.children) {
        const found = findCategory(cat.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  // ── Modal Actions ──

  const openCreate = (parentId?: string) => {
    setEditingId(null);
    setFormName("");
    setFormDescription("");
    setFormParentId(parentId || "");
    setShowModal(true);
  };

  const openEdit = (id: string) => {
    const cat = findCategory(categories, id);
    if (!cat) return;
    setEditingId(id);
    setFormName(cat.name);
    setFormDescription(cat.description || "");
    setFormParentId(cat.parentId || "");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormName("");
    setFormDescription("");
    setFormParentId("");
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast({ title: "Category name is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: formName.trim(),
        description: formDescription || undefined,
        parentId: formParentId || undefined,
      };

      if (editingId) {
        // Update
        const res = await fetch(`/api/ecommerce/categories/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!json.success) {
          toast({ title: json.error?.message || "Failed to update category", variant: "destructive" });
          return;
        }
        toast({ title: "Category updated" });
      } else {
        // Create
        const res = await fetch("/api/ecommerce/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!json.success) {
          toast({ title: json.error?.message || "Failed to create category", variant: "destructive" });
          return;
        }
        toast({ title: "Category created" });
      }

      closeModal();
      fetchCategories();
    } catch {
      toast({ title: "Failed to save category", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──

  const openDelete = (id: string, name: string) => {
    setDeleteId(id);
    setDeleteName(name);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/ecommerce/categories/${deleteId}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Category deleted" });
        setDeleteId(null);
        fetchCategories();
      } else {
        toast({ title: json.error?.message || "Failed to delete", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to delete category", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  // ── Toggle collapse ──

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Render Tree Row ──

  function renderCategoryRow(cat: CategoryNode, depth: number) {
    const hasChildren = cat.children && cat.children.length > 0;
    const isCollapsed = collapsed.has(cat.id);

    return (
      <div key={cat.id}>
        <div className="flex items-center gap-2 py-2.5 px-4 hover:bg-gray-50 transition-colors border-b border-gray-100">
          {/* Indent + expand */}
          <div style={{ width: `${depth * 24}px` }} className="flex-shrink-0" />

          {hasChildren ? (
            <button
              onClick={() => toggleCollapse(cat.id)}
              className="p-0.5 hover:bg-gray-200 rounded transition-colors"
            >
              <ChevronRight
                className={`w-4 h-4 text-gray-400 transition-transform ${
                  !isCollapsed ? "rotate-90" : ""
                }`}
              />
            </button>
          ) : (
            <span className="w-5" />
          )}

          {/* Icon */}
          <FolderOpen className="w-4 h-4 text-gray-400 flex-shrink-0" />

          {/* Name */}
          <span className="text-sm font-medium text-gray-900 flex-1 min-w-0 truncate">
            {cat.name}
          </span>

          {/* Product count */}
          <span className="text-xs text-gray-400 flex-shrink-0">
            {cat.productCount} product{cat.productCount !== 1 ? "s" : ""}
          </span>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => openEdit(cat.id)}
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="Edit"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => openDelete(cat.id, cat.name)}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Children */}
        {hasChildren && !isCollapsed && (
          <div>
            {cat.children.map((child) => renderCategoryRow(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
          <p className="text-sm text-gray-500 mt-1">Organize your products into categories</p>
        </div>
        <button
          onClick={() => openCreate()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Category
        </button>
      </div>

      {/* Category Tree */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-500">Loading categories...</span>
          </div>
        ) : categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <FolderOpen className="w-12 h-12 text-gray-300 mb-3" />
            <h3 className="text-lg font-medium text-gray-900">No categories yet</h3>
            <p className="text-sm text-gray-500 mt-1">Create categories to organize your products.</p>
            <button
              onClick={() => openCreate()}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Category
            </button>
          </div>
        ) : (
          <div>
            {/* Header row */}
            <div className="flex items-center gap-2 py-2 px-4 bg-gray-50 border-b border-gray-200">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider flex-1">Category</span>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider w-24 text-right">Products</span>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider w-20 text-right">Actions</span>
            </div>
            {categories.map((cat) => renderCategoryRow(cat, 0))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingId ? "Edit Category" : "New Category"}
              </h3>
              <button onClick={closeModal} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Electronics"
                  autoFocus
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Optional description..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parent Category</label>
                <select
                  value={formParentId}
                  onChange={(e) => setFormParentId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">None (top-level)</option>
                  {flatCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {"  ".repeat(cat.depth)}{cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={closeModal}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {editingId ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Delete Category</h3>
            <p className="text-sm text-gray-500 mt-2">
              Are you sure you want to delete <strong>{deleteName}</strong>? Products in this category will become uncategorized.
            </p>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setDeleteId(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
