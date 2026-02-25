"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  Search,
  Filter,
  ChevronDown,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
  Sparkles,
  Megaphone,
} from "lucide-react";
import { AIProductGeneratorModal } from "@/components/ecommerce/ai-product-generator-modal";
import { PromoteProductModal } from "@/components/ecommerce/promote-product-modal";
import { PageLoader } from "@/components/shared/page-loader";
import { useToast } from "@/hooks/use-toast";

// ── Types ──

interface ProductImage {
  url: string;
  alt: string;
  position: number;
}

interface ProductItem {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  comparePriceCents: number | null;
  status: string;
  images: ProductImage[];
  trackInventory: boolean;
  quantity: number;
  lowStockThreshold: number;
  variantCount: number;
  categoryName: string | null;
  category: string | null;
  createdAt: string;
}

interface CategoryOption {
  id: string;
  name: string;
  children: CategoryOption[];
}

// ── Helpers ──

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-800",
    DRAFT: "bg-yellow-100 text-yellow-800",
    ARCHIVED: "bg-gray-100 text-gray-600",
  };
  return map[status] || "bg-gray-100 text-gray-600";
}

// ── Component ──

export default function ProductsListPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sortBy, setSortBy] = useState("createdAt_desc");
  const [showFilters, setShowFilters] = useState(false);

  // Stats
  const [stats, setStats] = useState({ total: 0, active: 0, draft: 0, archived: 0 });

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // AI Product Generator
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [promoteProductId, setPromoteProductId] = useState<string | null>(null);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const [allRes, activeRes, draftRes, archivedRes] = await Promise.all([
        fetch("/api/ecommerce/products?limit=1"),
        fetch("/api/ecommerce/products?limit=1&status=ACTIVE"),
        fetch("/api/ecommerce/products?limit=1&status=DRAFT"),
        fetch("/api/ecommerce/products?limit=1&status=ARCHIVED"),
      ]);
      const [all, active, draft, archived] = await Promise.all([
        allRes.json(),
        activeRes.json(),
        draftRes.json(),
        archivedRes.json(),
      ]);
      setStats({
        total: all.data?.total || 0,
        active: active.data?.total || 0,
        draft: draft.data?.total || 0,
        archived: archived.data?.total || 0,
      });
    } catch {
      // Stats are non-critical
    }
  }, []);

  // Fetch products
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "20");
      params.set("sort", sortBy);
      if (statusFilter) params.set("status", statusFilter);
      if (categoryFilter) params.set("categoryId", categoryFilter);
      if (search) params.set("search", search);

      const res = await fetch(`/api/ecommerce/products?${params.toString()}`);
      const json = await res.json();

      if (json.success) {
        setProducts(json.data.products);
        setTotal(json.data.total);
        setTotalPages(json.data.totalPages);
      } else {
        toast({ title: json.error?.message || "Failed to load products", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to load products", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, categoryFilter, search, sortBy, toast]);

  // Fetch categories for filter dropdown
  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/ecommerce/categories");
      const json = await res.json();
      if (json.success) {
        setCategories(json.data.categories);
      }
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    fetchStats();
    fetchCategories();
  }, [fetchStats, fetchCategories]);

  // Search with debounce via enter key
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      setSearch(searchInput);
      setPage(1);
    }
  };

  // Delete product
  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/ecommerce/products/${deleteId}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Product deleted" });
        setDeleteId(null);
        fetchProducts();
        fetchStats();
      } else {
        toast({ title: json.error?.message || "Failed to delete", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to delete product", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  // Flatten categories for dropdown
  const flatCategories: { id: string; name: string; depth: number }[] = [];
  function flattenCats(cats: CategoryOption[], depth = 0) {
    for (const cat of cats) {
      flatCategories.push({ id: cat.id, name: cat.name, depth });
      if (cat.children) flattenCats(cat.children, depth + 1);
    }
  }
  flattenCats(categories);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your store products</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAIGenerator(true)}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            AI Generate Products
          </button>
          <button
            onClick={() => router.push("/ecommerce/products/new")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Product
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Products", value: stats.total, color: "bg-blue-50 text-blue-700" },
          { label: "Active", value: stats.active, color: "bg-green-50 text-green-700" },
          { label: "Draft", value: stats.draft, color: "bg-yellow-50 text-yellow-700" },
          { label: "Archived", value: stats.archived, color: "bg-gray-50 text-gray-600" },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-lg p-4 ${stat.color}`}>
            <p className="text-sm font-medium opacity-80">{stat.label}</p>
            <p className="text-2xl font-bold mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search products... (press Enter)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Toggle filters */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
          >
            <Filter className="w-4 h-4" />
            Filters
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? "rotate-180" : ""}`} />
          </button>
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-gray-100">
            {/* Status */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="DRAFT">Draft</option>
              <option value="ARCHIVED">Archived</option>
            </select>

            {/* Category */}
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">All Categories</option>
              {flatCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {"  ".repeat(cat.depth)}{cat.name}
                </option>
              ))}
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="createdAt_desc">Newest First</option>
              <option value="name_asc">Name A-Z</option>
              <option value="priceCents_asc">Price: Low to High</option>
              <option value="priceCents_desc">Price: High to Low</option>
            </select>
          </div>
        )}
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <PageLoader tips={["Loading products..."]} />
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <Package className="w-12 h-12 text-gray-300 mb-3" />
            <h3 className="text-lg font-medium text-gray-900">No products yet</h3>
            <p className="text-sm text-gray-500 mt-1">Create your first product!</p>
            <button
              onClick={() => router.push("/ecommerce/products/new")}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Product
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Inventory</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                      {/* Product */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                            {product.images.length > 0 ? (
                              <img
                                src={product.images[0].url}
                                alt={product.images[0].alt || product.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <ImageIcon className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                            {product.categoryName && (
                              <p className="text-xs text-gray-500">{product.categoryName}</p>
                            )}
                            {product.variantCount > 0 && (
                              <p className="text-xs text-gray-400">{product.variantCount} variant{product.variantCount !== 1 ? "s" : ""}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Price */}
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">{formatPrice(product.priceCents)}</p>
                        {product.comparePriceCents && (
                          <p className="text-xs text-gray-400 line-through">{formatPrice(product.comparePriceCents)}</p>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(product.status)}`}>
                          {product.status}
                        </span>
                      </td>

                      {/* Inventory */}
                      <td className="px-4 py-3">
                        {product.trackInventory ? (
                          <div>
                            <p className={`text-sm font-medium ${product.quantity <= product.lowStockThreshold ? "text-red-600" : "text-gray-900"}`}>
                              {product.quantity} in stock
                            </p>
                            {product.quantity <= product.lowStockThreshold && (
                              <p className="text-xs text-red-500 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> Low stock
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">Not tracked</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {product.status === "ACTIVE" && (
                            <button
                              onClick={() => setPromoteProductId(product.id)}
                              className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                              title="Promote"
                            >
                              <Megaphone className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => router.push(`/ecommerce/products/${product.id}`)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteId(product.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                <p className="text-sm text-gray-500">
                  Showing {(page - 1) * 20 + 1}-{Math.min(page * 20, total)} of {total}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-1.5 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-gray-700">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="p-1.5 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Delete Product</h3>
            <p className="text-sm text-gray-500 mt-2">
              Are you sure you want to delete this product? This action cannot be undone.
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

      {/* AI Product Generator Modal */}
      <AIProductGeneratorModal
        isOpen={showAIGenerator}
        onClose={() => setShowAIGenerator(false)}
        onComplete={() => {
          setShowAIGenerator(false);
          fetchProducts();
          fetchStats();
        }}
        storeCurrency="USD"
      />

      {/* Promote Product Modal */}
      <PromoteProductModal
        productId={promoteProductId}
        isOpen={!!promoteProductId}
        onClose={() => setPromoteProductId(null)}
      />
    </div>
  );
}
