/**
 * Shared admin portal constants — status colors, badges, enums.
 * Import these instead of hardcoding colors per page.
 */

// ── Status badge colors ──────────────────────────────────────────────
export const STATUS_COLORS: Record<string, string> = {
  // Content / Campaign status
  published: "bg-green-500/20 text-green-500 border-green-500/30",
  active: "bg-green-500/20 text-green-500 border-green-500/30",
  ACTIVE: "bg-green-500/20 text-green-500 border-green-500/30",
  approved: "bg-green-500/20 text-green-500 border-green-500/30",
  completed: "bg-green-500/20 text-green-500 border-green-500/30",
  sent: "bg-green-500/20 text-green-500 border-green-500/30",

  draft: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
  DRAFT: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
  pending: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
  PENDING: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
  review: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",

  scheduled: "bg-blue-500/20 text-blue-500 border-blue-500/30",
  SCHEDULED: "bg-blue-500/20 text-blue-500 border-blue-500/30",
  sending: "bg-blue-500/20 text-blue-500 border-blue-500/30",

  archived: "bg-gray-500/20 text-gray-500 border-gray-500/30",
  paused: "bg-gray-500/20 text-gray-500 border-gray-500/30",
  PAUSED: "bg-gray-500/20 text-gray-500 border-gray-500/30",
  disabled: "bg-gray-500/20 text-gray-500 border-gray-500/30",

  rejected: "bg-red-500/20 text-red-500 border-red-500/30",
  REJECTED: "bg-red-500/20 text-red-500 border-red-500/30",
  failed: "bg-red-500/20 text-red-500 border-red-500/30",
  FAILED: "bg-red-500/20 text-red-500 border-red-500/30",
  suspended: "bg-red-500/20 text-red-500 border-red-500/30",
  banned: "bg-red-500/20 text-red-500 border-red-500/30",
};

// ── Plan badge colors ────────────────────────────────────────────────
export const PLAN_COLORS: Record<string, string> = {
  STARTER: "bg-gray-500/20 text-gray-400",
  FREE: "bg-gray-500/20 text-gray-400",
  BASIC: "bg-blue-500/20 text-blue-400",
  PRO: "bg-purple-500/20 text-purple-400",
  BUSINESS: "bg-orange-500/20 text-orange-400",
  ENTERPRISE: "bg-red-500/20 text-red-400",
};

// ── Content type colors ──────────────────────────────────────────────
export const CONTENT_TYPE_COLORS: Record<string, string> = {
  text: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  image: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  video: "bg-red-500/20 text-red-400 border-red-500/30",
  audio: "bg-green-500/20 text-green-400 border-green-500/30",
};

// ── Transaction type colors ──────────────────────────────────────────
export const TRANSACTION_TYPE_COLORS: Record<string, string> = {
  subscription: "bg-green-500/20 text-green-500",
  credit_purchase: "bg-blue-500/20 text-blue-500",
  refund: "bg-red-500/20 text-red-500",
  payout: "bg-purple-500/20 text-purple-500",
  adjustment: "bg-yellow-500/20 text-yellow-500",
};

// ── Severity colors (audit logs) ─────────────────────────────────────
export const SEVERITY_COLORS: Record<string, string> = {
  INFO: "bg-blue-500/20 text-blue-500",
  WARNING: "bg-yellow-500/20 text-yellow-500",
  ERROR: "bg-red-500/20 text-red-500",
  CRITICAL: "bg-red-600/20 text-red-600",
};

// ── Moderation reasons ───────────────────────────────────────────────
export const MODERATION_REASONS: Record<string, string> = {
  spam: "Spam",
  harassment: "Harassment",
  hate_speech: "Hate Speech",
  violence: "Violence",
  nudity: "Nudity / Sexual Content",
  misinformation: "Misinformation",
  copyright: "Copyright Violation",
  other: "Other",
};

// ── Ad type labels ───────────────────────────────────────────────────
export const AD_TYPE_LABELS: Record<string, string> = {
  banner: "Banner Ad",
  video: "Video Ad",
  native: "Native Ad",
  social: "Social Ad",
  display: "Display Ad",
};

// ── Credit pricing categories ────────────────────────────────────────
export const CREDIT_CATEGORIES: Record<string, { label: string; icon: string }> = {
  ai_text: { label: "AI Text Generation", icon: "MessageSquare" },
  ai_image: { label: "AI Image Generation", icon: "Image" },
  ai_video: { label: "AI Video Generation", icon: "Video" },
  ai_branding: { label: "AI Branding", icon: "Palette" },
  ai_chat: { label: "AI Chat", icon: "Bot" },
  marketing: { label: "Marketing", icon: "Megaphone" },
};

// ── CSV export utility ───────────────────────────────────────────────
export function exportCSV(data: Record<string, unknown>[], filename: string): void {
  if (!data.length) return;
  const headers = Object.keys(data[0]).join(",");
  const rows = data.map((row) =>
    Object.values(row)
      .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
      .join(",")
  );
  const csv = [headers, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Date formatting ──────────────────────────────────────────────────
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "Never";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTimeAgo(date: Date | string): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// ── Number formatting ────────────────────────────────────────────────
export function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

export function formatCurrency(num: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(num);
}
