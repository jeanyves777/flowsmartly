/**
 * Agent-authored views — the declarative view-spec DSL.
 *
 * A "view" is a tree of typed UI BLOCKS the agent composes (never raw JS), so it
 * renders SAFELY (a switch over block types — no eval, no arbitrary DOM/network)
 * and can be PERSISTED + REUSED. Interactive blocks carry an `action` that the
 * renderer surfaces via onAction — the host translates it into an agent message
 * or a whitelisted tool call. This is what lets the agent build bespoke, safe,
 * reusable interactive UI right in the chat.
 */

/** Semantic tones (map to the app's brand/status colors). */
export type Tone = "default" | "brand" | "muted" | "success" | "warn" | "danger" | "info";

/** An interaction a block can fire. `event` is the semantic name; the host maps it
 *  to an agent message and/or a whitelisted tool call. `confirm` gates on approval. */
export interface ViewAction {
  event: string;
  /** Optional whitelisted tool the host may call directly (else it messages the agent). */
  tool?: string;
  /** Static payload merged with the block's live value. */
  payload?: Record<string, unknown>;
  /** If set, the host confirms with this text before firing (credits/publish). */
  confirm?: string;
  /** Optional deep-link the host can open (a focused studio view). */
  href?: string;
}

/** One table column. */
export interface ViewColumn { key: string; label: string; align?: "left" | "right" | "center"; kind?: "text" | "score" | "badge" | "thumb" }

/** The block union — a discriminated type on `type`. Keep additive + backward-compatible. */
export type ViewBlock =
  // layout
  | { type: "stack"; gap?: number; children: ViewBlock[] }
  | { type: "row"; gap?: number; align?: "start" | "center" | "between" | "end"; wrap?: boolean; children: ViewBlock[] }
  | { type: "grid"; cols?: number; gap?: number; children: ViewBlock[] }
  | { type: "card"; tone?: Tone; children: ViewBlock[] }
  | { type: "section"; title?: string; subtitle?: string; children: ViewBlock[] }
  | { type: "divider" }
  | { type: "spacer"; size?: number }
  // content
  | { type: "heading"; text: string; level?: 1 | 2 | 3 }
  | { type: "text"; text: string; tone?: Tone; size?: "xs" | "sm" | "md"; strong?: boolean }
  | { type: "badge"; text: string; tone?: Tone; icon?: string }
  | { type: "stat"; label: string; value: string; delta?: string; tone?: Tone }
  | { type: "kpis"; items: { label: string; value: string; tone?: Tone }[] }
  | { type: "progress"; value: number; label?: string; tone?: Tone }
  | { type: "status"; text: string; state?: "running" | "done" | "failed" | "pending"; progress?: number }
  | { type: "checklist"; items: { text: string; state: "done" | "active" | "pending"; sub?: string }[] }
  | { type: "timeline"; items: { text: string; time?: string; tone?: Tone }[] }
  | { type: "image"; url: string; alt?: string; aspect?: string; rounded?: boolean; action?: ViewAction }
  | { type: "video"; url: string; poster?: string | null }
  | { type: "mediaStrip"; items: { url?: string | null; label?: string; status?: "ready" | "busy" | "pending" }[]; aspect?: string; action?: ViewAction }
  | { type: "table"; columns: ViewColumn[]; rows: Record<string, unknown>[]; rowAction?: ViewAction; rowActionLabel?: string }
  | { type: "code"; code: string; lang?: string }
  | { type: "note"; text: string; tone?: Tone; icon?: string }
  // interactive
  | { type: "button"; label: string; variant?: "primary" | "default" | "ghost" | "danger"; icon?: string; disabled?: boolean; action: ViewAction }
  | { type: "buttonRow"; buttons: { label: string; variant?: "primary" | "default" | "ghost" | "danger"; icon?: string; action: ViewAction }[] }
  | { type: "chips"; name: string; options: { value: string; label: string; hint?: string }[]; value?: string; multi?: boolean; action?: ViewAction }
  | { type: "input"; name: string; placeholder?: string; value?: string; multiline?: boolean; submitLabel?: string; action?: ViewAction }
  | { type: "select"; name: string; options: { value: string; label: string }[]; value?: string; action?: ViewAction }
  | { type: "toggle"; name: string; label?: string; value?: boolean; action?: ViewAction }
  | { type: "rating"; name: string; value?: number; max?: number; action?: ViewAction }
  | { type: "slotGrid"; days: string[]; slots?: number; value?: string[]; action?: ViewAction };

/** A complete view: header + body blocks + optional footer, with provenance. */
export interface ViewSpec {
  /** Stable name for the library (e.g. "film-builder", "leads-table"). */
  name?: string;
  version?: number;
  title?: string;
  subtitle?: string;
  icon?: string;
  tone?: Tone;
  badge?: { text: string; tone?: Tone };
  /** How much horizontal room the card takes in the chat. Tables/dashboards want
   *  more; small forms less. Renders responsive (fills, capped by this). Default "lg". */
  width?: "sm" | "md" | "lg" | "full";
  body: ViewBlock[];
  footer?: ViewBlock[];
  /** How this view was produced (for the "from library" / "✨ generated" tag). */
  source?: "library" | "generated";
  /** Which skill emitted it + which project it belongs to (resolver + reuse). */
  skill?: string;
  projectRef?: { kind: string; id: string } | null;
}

/** The value a control emits back with its action (host merges into the payload). */
export type ViewValue = string | number | boolean | string[] | Record<string, unknown> | null;

/** A resolved event the host receives from a rendered view. */
export interface ViewEvent {
  action: ViewAction;
  value?: ViewValue;
  /** The control's `name`, when it has one (input/chips/toggle/etc.). */
  name?: string;
}

// --- lightweight runtime validation (untrusted specs from the model / storage) ---

const BLOCK_TYPES = new Set([
  "stack", "row", "grid", "card", "section", "divider", "spacer",
  "heading", "text", "badge", "stat", "kpis", "progress", "status", "checklist", "timeline",
  "image", "video", "mediaStrip", "table", "code", "note",
  "button", "buttonRow", "chips", "input", "select", "toggle", "rating", "slotGrid",
]);

/** True if a block looks like a supported block (shallow — the renderer is defensive). */
export function isViewBlock(b: unknown): b is ViewBlock {
  return !!b && typeof b === "object" && typeof (b as { type?: unknown }).type === "string" && BLOCK_TYPES.has((b as { type: string }).type);
}

/** Coerce an untrusted value into a safe ViewSpec (drops unknown blocks). */
export function normalizeViewSpec(raw: unknown): ViewSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<ViewSpec>;
  const clean = (arr: unknown): ViewBlock[] =>
    Array.isArray(arr) ? (arr.filter(isViewBlock) as ViewBlock[]) : [];
  const body = clean(r.body);
  if (body.length === 0 && !r.title) return null;
  return {
    name: typeof r.name === "string" ? r.name.slice(0, 60) : undefined,
    version: typeof r.version === "number" ? r.version : 1,
    title: typeof r.title === "string" ? r.title.slice(0, 160) : undefined,
    subtitle: typeof r.subtitle === "string" ? r.subtitle.slice(0, 240) : undefined,
    icon: typeof r.icon === "string" ? r.icon.slice(0, 40) : undefined,
    tone: r.tone,
    badge: r.badge && typeof r.badge.text === "string" ? { text: r.badge.text.slice(0, 40), tone: r.badge.tone } : undefined,
    width: r.width === "sm" || r.width === "md" || r.width === "full" ? r.width : "lg",
    body,
    footer: clean(r.footer),
    source: r.source === "generated" ? "generated" : "library",
    skill: typeof r.skill === "string" ? r.skill.slice(0, 60) : undefined,
    projectRef: r.projectRef && typeof r.projectRef === "object" ? r.projectRef : null,
  };
}
