/**
 * AI Presentation Builder for the Training Room.
 *
 * A plain-words brief becomes an ordered deck of training slides: document slides
 * (title + talking points + a visual) and whiteboard slides (a pre-sketched
 * diagram the host can draw right on top of). The outline comes from the text AI as
 * JSON; whiteboard diagrams are laid out deterministically in code (the model never
 * touches coordinates); per-slide illustrations are generated and stored in S3.
 * [[training-studio]]
 */
import { ai } from "@/lib/ai/client";
import { generateImageXaiFirst, generateImageWithProvider } from "@/lib/ai/image-router";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { SLIDE_LAYOUTS } from "./types";
import type { BoardItem, DeckSlide, DeckVisual, TrainingDeck, QuizQuestion, SlideLayout, RevealMode, VisualType } from "./types";

const REVEAL_MODES = ["all_at_once", "progressive", "stroke_by_stroke", "word_by_word", "build_diagram"];
const asLayout = (v?: string): SlideLayout | undefined => (v && (SLIDE_LAYOUTS as readonly string[]).includes(v)) ? (v as SlideLayout) : undefined;
const asReveal = (v?: string): RevealMode | undefined => (v && REVEAL_MODES.includes(v)) ? (v as RevealMode) : undefined;
const ANNOTATES = ["circle", "underline", "highlight", "point", "box", "strike", "check", "arrow", "bracket"] as const;
const asAnnotate = (v?: string): DeckSlide["annotate"] | undefined => (v && (ANNOTATES as readonly string[]).includes(v)) ? (v as DeckSlide["annotate"]) : undefined;
/** Keep the highlight ONLY if it appears verbatim in the slide's text (so the hand circles real words). */
const hlPhrase = (hl: string | undefined, texts: (string | undefined)[]): string | undefined => {
  const p = stripMd(hl || "").trim().slice(0, 48);
  if (p.length < 3) return undefined;
  const low = p.toLowerCase();
  return texts.some((t) => stripMd(t || "").toLowerCase().includes(low)) ? p : undefined;
};

const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 9)}`;

/** The slide renderer shows plain text, not markdown — strip the model's `**bold**`,
 *  `_italics_`, backticks and leading list markers so they don't appear literally. */
function stripMd(s: string | undefined | null): string {
  return (s ?? "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/(^|\s)\*(\S.*?\S|\S)\*(?=\s|$)/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[-*•]\s+/, "")
    .replace(/#+\s*/g, "")
    .trim();
}

interface RawSlide {
  type?: "doc" | "whiteboard" | "livedraw";
  title?: string;
  subtitle?: string;
  bullets?: string[];
  notes?: string;
  emoji?: string;
  imagePrompt?: string;
  visualStyle?: "photo" | "3d" | "illustration";
  diagram?: { shape?: "cycle" | "flow" | "tree"; nodes?: string[]; edges?: [number, number, string?][] };
  /** whiteboard/livedraw — short sticky-note callouts (a key insight / watch-out) */
  annotations?: string[];
  /** whiteboard/livedraw — a subject to render as a 3D asset dropped on the board */
  assetPrompt?: string;
  /** content-aware model (independent axes) — the agent picks these per teaching moment. */
  layout?: string;
  revealMode?: string;
  /** AT MOST 1-2 per deck — a short generated demonstration video best teaches this concept. */
  videoDemo?: boolean;
  videoPrompt?: string;
  /** the single key 2-4 word phrase to circle/highlight (must appear verbatim in a bullet/subtitle). */
  highlight?: string;
  /** how the hand marks that phrase — chosen by intent (circle/box/underline/strike/check/point/highlight). */
  annotate?: string;
}

/** Turn a visual style + subject into a rich image prompt (photoreal / 3D / flat). */
function imgPrompt(style: RawSlide["visualStyle"], subject: string): string {
  const s = subject.slice(0, 300);
  if (style === "3d")
    return `${s}. A premium high-end 3D render, Pixar / Octane quality, glossy and metallic materials with realistic reflections, glowing accent lights, cinematic soft studio lighting, sharp fine detail, physically-based shading, gentle depth of field, on a clean dark studio gradient background. Ultra high resolution, product-quality, no text, no watermark.`;
  if (style === "illustration")
    return `${s}. A polished modern editorial illustration, crisp clean vector shapes, tasteful brand colours, subtle gradients and depth, professional and detailed, no text, no watermark.`;
  // default: photoreal
  return `${s}. Hyper-realistic professional photography, natural lighting, shallow depth of field, high detail, shot on a full-frame camera, no text, no watermark.`;
}

/** A 3D asset that drops onto a whiteboard as a CLEAN TRANSPARENT CUTOUT — a single
 *  object floating in the design, not a photo in a box. Rendered by gpt-image, which
 *  understands "isolated on transparent background" far better. */
function assetPrompt3D(subject: string): string {
  return `${subject.slice(0, 240)}. A single 3D isometric object icon, glossy tactile materials, vibrant colours, soft studio lighting, centered. ISOLATED as a clean cutout on a FULLY TRANSPARENT background — absolutely no ground, no shadow, no floor, no backdrop, no card, no scene, no border, no frame. Just the object. High detail, crisp edges, no text, no watermark.`;
}

export function parseDeck(raw: string | null | undefined): TrainingDeck {
  if (!raw) return { v: 1, slides: [] };
  try {
    const d = JSON.parse(raw) as Partial<TrainingDeck>;
    // Preserve the presenter wiring — dropping it here made routes think there's no presenter
    // (e.g. iv-moment said "add an AI presenter first" for a deck that HAD one).
    return {
      v: 1,
      slides: Array.isArray(d.slides) ? d.slides : [],
      presenterId: d.presenterId ?? null,
      presenterActive: d.presenterActive,
      presenterVideoUrl: d.presenterVideoUrl ?? null,
      introVideoUrl: d.introVideoUrl ?? null,
      outroVideoUrl: d.outroVideoUrl ?? null,
      voiceKey: d.voiceKey ?? null,
      visualStyle: d.visualStyle,
      handStyle: d.handStyle,
    };
  } catch {
    return { v: 1, slides: [] };
  }
}

// A frame is 1000×562 SVG px. Node boxes are sized in px from their label so the
// text always fits, then laid out with real spacing (no overlap) and normalised to
// 0..1 of the possibly-wider canvas.
const FRAME_W = 1000, FRAME_H = 562;
const NODE_H = 66, NODE_GAP = 54, MARGIN = 44, PAD_X = 30, MAX_INNER = 300, BASE_FS = 15;

interface NodeBox { label: string; w: number; h: number; fs: number }
/** Size a node to its label (shrinking the font only for very long labels). */
function measure(label: string): NodeBox {
  let fs = BASE_FS;
  let inner = label.length * 0.55 * fs;
  if (inner > MAX_INNER) { fs = Math.max(9, MAX_INNER / (label.length * 0.55)); inner = MAX_INNER; }
  return { label, w: Math.max(120, Math.round(inner + PAD_X)), h: NODE_H, fs };
}
/** Where a straight line from a box centre toward `to` crosses the box edge. */
function boxEdge(c: { x: number; y: number }, b: NodeBox, to: { x: number; y: number }): { x: number; y: number } {
  const dx = to.x - c.x, dy = to.y - c.y;
  if (!dx && !dy) return { x: c.x, y: c.y };
  const t = Math.min(dx ? b.w / 2 / Math.abs(dx) : Infinity, dy ? b.h / 2 / Math.abs(dy) : Infinity);
  return { x: c.x + dx * t, y: c.y + dy * t };
}

export interface AssetBox { x: number; y: number; w: number; h: number }

/** Lay out a small diagram as rounded-rectangle node cards + connecting arrows, in
 *  fractional (0..1) coords that ALL FIT INSIDE ONE 16:9 frame — the whole diagram is
 *  uniformly scaled into a middle band so nothing is ever hidden or panned off-screen.
 *  A `flow` is one row, a `tree` a root over a child row, a `cycle` a ring. The title
 *  sits above the band and sticky notes sit in a reserved lane below it. `assetBox` is
 *  where a 3D cutout should sit with reason: the empty centre of a cycle, else a clear
 *  top-right corner. Every node is sized to its label so text never overflows. */
export function diagramToBoard(d: RawSlide["diagram"], perElement = false): { items: BoardItem[]; wide: number; assetBox: AssetBox | null } {
  const labels = (d?.nodes ?? []).slice(0, 5).map((s) => stripMd(String(s)).slice(0, 30).replace(/[:'"].*$/, "").trim() || stripMd(String(s)).slice(0, 24));
  if (!labels.length) return { items: [], wide: 1, assetBox: null };
  const shape = d?.shape ?? "flow";
  const ink = "#1e293b";
  const box = labels.map(measure);

  // ---- 1. natural layout (px, un-fitted, origin arbitrary) ----
  const raw: { x: number; y: number }[] = [];
  let cycleCenter: { x: number; y: number } | null = null;
  if (shape === "tree" && labels.length > 1) {
    let cur = 0;
    const kidX = box.slice(1).map((b) => { const cx = cur + b.w / 2; cur += b.w + NODE_GAP; return cx; });
    raw.push({ x: (kidX[0] + kidX[kidX.length - 1]) / 2, y: 0 });
    kidX.forEach((x) => raw.push({ x, y: 250 }));
  } else if (shape === "cycle" && labels.length > 2) {
    const maxW = Math.max(...box.map((b) => b.w)), n = labels.length;
    const rx = Math.max(300, (maxW + NODE_GAP) / (2 * Math.sin(Math.PI / n)));
    const ry = rx * 0.62;
    labels.forEach((_, i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; raw.push({ x: rx * Math.cos(a), y: ry * Math.sin(a) }); });
    cycleCenter = { x: 0, y: 0 };
  } else {
    let cur = 0;
    box.forEach((b) => { raw.push({ x: cur + b.w / 2, y: 0 }); cur += b.w + NODE_GAP; });
  }

  // ---- 2. uniformly fit the bounding box into the middle band of one frame ----
  const half = (i: number) => ({ hw: box[i].w / 2, hh: box[i].h / 2 });
  const minX = Math.min(...raw.map((c, i) => c.x - half(i).hw)), maxX = Math.max(...raw.map((c, i) => c.x + half(i).hw));
  const minY = Math.min(...raw.map((c, i) => c.y - half(i).hh)), maxY = Math.max(...raw.map((c, i) => c.y + half(i).hh));
  const bw = Math.max(1, maxX - minX), bh = Math.max(1, maxY - minY);
  const REGION_X = FRAME_W - 2 * MARGIN;               // usable width
  const REGION_TOP = FRAME_H * 0.17, REGION_BOT = FRAME_H * 0.70; // band (title above, notes below)
  const s = Math.min(1, REGION_X / bw, (REGION_BOT - REGION_TOP) / bh);
  const cx0 = (minX + maxX) / 2, cy0 = (minY + maxY) / 2;
  const tCx = FRAME_W / 2, tCy = (REGION_TOP + REGION_BOT) / 2;
  const fx = (x: number) => tCx + (x - cx0) * s;   // fitted px
  const fy = (y: number) => tCy + (y - cy0) * s;
  const centers = raw.map((c) => ({ x: fx(c.x), y: fy(c.y) }));
  const bs = box.map((b) => ({ w: b.w * s, h: b.h * s, fs: b.fs * s, label: b.label }));

  const nx = (px: number) => px / FRAME_W, ny = (py: number) => py / FRAME_H;
  const edges: [number, number][] = (d?.edges?.map((e) => [e[0], e[1]] as [number, number])) ?? (
    shape === "cycle" ? labels.map((_, i) => [i, (i + 1) % labels.length] as [number, number])
    : shape === "tree" ? labels.slice(1).map((_, i) => [0, i + 1] as [number, number])
    : labels.slice(1).map((_, i) => [i, i + 1] as [number, number]));

  const node = (i: number, step: number): BoardItem => {
    const c = centers[i], b = bs[i];
    return { id: uid("n"), t: "shape", by: "", shape: "rect", color: ink, size: 0.003, from: { x: nx(c.x - b.w / 2), y: ny(c.y - b.h / 2) }, to: { x: nx(c.x + b.w / 2), y: ny(c.y + b.h / 2) }, step };
  };
  const lab = (i: number, step: number): BoardItem => {
    const c = centers[i];
    return { id: uid("t"), t: "text", by: "", at: { x: nx(c.x), y: ny(c.y) }, text: bs[i].label, color: ink, size: bs[i].fs / FRAME_H, step };
  };
  const arr = (a: number, b: number, step: number): BoardItem => {
    const s0 = boxEdge(centers[a], bs[a], centers[b]), e0 = boxEdge(centers[b], bs[b], centers[a]);
    return { id: uid("e"), t: "shape", by: "", shape: "arrow", color: ink, size: 0.0026, from: { x: nx(s0.x), y: ny(s0.y) }, to: { x: nx(e0.x), y: ny(e0.y) }, step };
  };

  const items: BoardItem[] = [];
  if (perElement) {
    let step = 0;
    const drawn = new Set<number>(), edgeDone = new Set<string>();
    labels.forEach((_, i) => {
      items.push(node(i, step++));
      items.push(lab(i, step++));
      drawn.add(i);
      for (const [a, b] of edges) {
        const key = `${a}-${b}`;
        if (!edgeDone.has(key) && centers[a] && centers[b] && drawn.has(a) && drawn.has(b)) { items.push(arr(a, b, step++)); edgeDone.add(key); }
      }
    });
  } else {
    for (const [a, b] of edges) { if (centers[a] && centers[b]) items.push(arr(a, b, Math.max(a, b))); }
    labels.forEach((_, i) => { items.push(node(i, i)); items.push(lab(i, i)); });
  }

  // ---- 3. where a 3D cutout belongs: the empty centre of a cycle, else top-right ----
  let assetBox: AssetBox | null;
  if (cycleCenter) {
    const cw = 0.19, ch = 0.3;
    assetBox = { x: nx(fx(cycleCenter.x)) - cw / 2, y: ny(fy(cycleCenter.y)) - ch / 2, w: cw, h: ch };
  } else {
    assetBox = { x: 0.74, y: 0.035, w: 0.225, h: 0.28 };
  }

  return { items, wide: 1, assetBox };
}

/** How many reveal steps a set of stepped items has. */
export function stepCount(items: BoardItem[]): number {
  let max = -1;
  for (const it of items) if ("step" in it && typeof it.step === "number") max = Math.max(max, it.step);
  return max + 1;
}

/** The clamped slide count a deck will have — the single source of truth shared by
 *  the generator and the credit estimate (client + server). */
export function deckSlideCount(slideCount?: number, minutes?: number): number {
  // Honour an explicit request (capped at 30 so we never blow the token budget); otherwise
  // derive from the session length at ~2 narrated minutes per slide.
  if (typeof slideCount === "number" && slideCount > 0) return Math.min(30, Math.max(3, Math.round(slideCount)));
  const fromMinutes = minutes ? Math.round(minutes / 2) : 6;
  return Math.min(30, Math.max(4, fromMinutes));
}

/** How many generated illustrations a built deck actually carries (what we charge) —
 *  doc-slide visuals plus any 3D assets dropped on whiteboard/livedraw boards. */
export function deckImageCount(deck: TrainingDeck): number {
  return deck.slides.reduce(
    (n, s) => n + (s.visual?.kind === "image" ? 1 : 0) + (s.board?.filter((i) => i.t === "image").length ?? 0),
    0,
  );
}

/** The reveal UNITS of a slide, in order — each appears on its own step: infographic cards, else
 *  bullets. Null when the slide has no per-step content (a single-reveal slide). */
export function slideRevealUnits(slide: Pick<DeckSlide, "infographic" | "bullets">): string[] | null {
  const cards = slide.infographic?.cards;
  if (cards && cards.length >= 2) return cards.map((c) => `${c.title || ""} ${c.desc || ""}`);
  if (slide.bullets && slide.bullets.length >= 2) return slide.bullets;
  return null;
}

/** Content-aware reveal timing: the FRACTION of the narration at which each unit should appear,
 *  spread in proportion to each unit's text length so a bullet the narrator dwells on stays up
 *  longer than a short one (vs an even 1/steps split that drifts out of sync). All reveals land in
 *  the first ~90% of the clip, leaving a closing beat. `frac[0] = 0` (first unit shows as the
 *  narration opens). Returns null for a single-reveal slide → the caller falls back to the even
 *  split. [[training-presentation-animation]] */
export function revealFractions(units: string[] | null | undefined, steps: number): number[] | null {
  if (!units) return null;
  const n = Math.min(units.length, Math.max(1, steps || units.length));
  if (n < 2) return null;
  const OUTRO = 0.1; // leave the last tenth of the clip as a closing breath
  const weights = units.slice(0, n).map((u) => Math.max(10, String(u).trim().length));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const fracs: number[] = [];
  let cum = 0;
  for (let k = 0; k < n; k++) { fracs.push((cum / total) * (1 - OUTRO)); cum += weights[k]; }
  return fracs;
}

/** How many reveal steps the narration has passed at fraction `frac` (0..1) of its playback, given
 *  per-step marks from `revealFractions`. Clamped to [1, cap]. */
export function revealStepAt(frac: number, fracs: number[], cap: number): number {
  let n = 0;
  for (const f of fracs) { if (frac >= f) n++; else break; }
  return Math.min(cap, Math.max(1, n));
}

/** Turn a brief into a deck. Returns null only if the model gives nothing usable. */
export async function generateDeck(opts: {
  brief: string;
  sessionId: string;
  wantDoc?: boolean;
  wantWhiteboard?: boolean;
  wantVisuals?: boolean;
  slideCount?: number;
  minutes?: number;
  /** regeneration: force a distinctly DIFFERENT take (higher temperature + a fresh creative seed). */
  variation?: boolean;
}): Promise<TrainingDeck | null> {
  const n = deckSlideCount(opts.slideCount, opts.minutes);
  const faces = [opts.wantDoc !== false ? "document" : "", opts.wantWhiteboard ? "whiteboard" : ""].filter(Boolean).join(" and ");
  // On regenerate, the model otherwise re-emits a near-identical slide (the brief anchors on the
  // current text). Push it to genuinely diverge, and vary the sample with a per-call seed.
  const varyNote = opts.variation
    ? `\n- REGENERATION: produce a DISTINCTLY DIFFERENT, fresh take — a new structure, angle, layout, examples and wording than any previous version. Keep the topic and teaching point, but do NOT reproduce the current phrasing or arrangement. Creative seed: ${Math.random().toString(36).slice(2, 9)}.`
    : "";

  const prompt = `You are an expert instructional designer building a COMPLETE VISUAL TEACHING EXPERIENCE (not plain bullet slides) from this brief:

"""${opts.brief.slice(0, 2000)}"""

Produce EXACTLY ${n} slides as ${faces || "document"} slides${opts.minutes ? ` for a ${opts.minutes}-minute session` : ""}. This is a FULL training, not a teaser: cover the topic in real depth, progressing logically from fundamentals to application. Teach it like a great presenter: mix photorealistic imagery, 3D explainers, and step-by-step whiteboard sections.
Return JSON: { "title": string, "slides": Slide[] } where Slide is:
{
  "type": "doc" | "whiteboard" | "livedraw",
  "title": short slide title,
  "subtitle": one short supporting line,
  "bullets": [3-4 concise talking points],       // "doc" slides
  "notes": 1-2 sentence speaker note,
  "emoji": one relevant emoji,                   // "doc" slides
  "visualStyle": "photo" | "3d" | "illustration",// "doc" slides — photo for real-world scenes/people, 3d for abstract concepts/systems, illustration otherwise
  "imagePrompt": a vivid prompt for the visual (no text in the image, no watermark), // "doc" slides
  "videoDemo": true,  // set on ONLY 1-2 doc slides in the whole deck — the concept(s) that teach best as a short MOVING demonstration
  "videoPrompt": a vivid ~15-second demonstration/illustration to animate (a moving 3D or photoreal scene of the concept in action, no text, no watermark), // only when videoDemo is true
  "highlight": the single most important 2-4 WORD phrase on this slide — the presenter marks it by hand as they speak. It MUST appear VERBATIM inside one of the bullets or the subtitle, // "doc" slides
  "annotate": how the hand marks that phrase, chosen by INTENT — one of: "circle" (emphasise a key term, the default), "box" (a definition or important label), "underline" (a fact/detail worth noting), "strike" (a myth / wrong / "not this" — great on myth_reality & the con side of pros_cons/comparison), "check" (an approval / the right choice / "do this"), "arrow" (point an arrow at it), "bracket" (frame the phrase in brackets), "point" (draw the eye to it), "highlight" (a marker sweep). Vary it across the deck to fit each moment, // "doc" slides
  "diagram": { "shape": "cycle"|"flow"|"tree", "nodes": [3-5 VERY short node labels — 2-4 WORDS each, ~18 chars max, NO sentences, quotes or colons], "edges": [[fromIndex,toIndex]] }, // whiteboard/livedraw — put the detail in annotations/notes, NOT the node labels
  "annotations": [1-2 very short sticky-note callouts — a key insight, tip or watch-out], // "whiteboard"/"livedraw" slides
  "assetPrompt": a vivid subject for a 3D asset that illustrates this concept (an object/system/scene, no text, no watermark), // "whiteboard"/"livedraw" slides
  "layout": the content layout that best fits THIS teaching moment — one of: hero_statement, big_idea, image_explanation, full_visual, concept_3d_callouts, step_process, timeline, before_after, problem_solution_result, question_answer, myth_reality, comparison_table, pros_cons, data_spotlight, case_study, real_world_scenario, customer_journey, system_architecture, workflow_diagram, concept_map, layered_explanation, zoom_in, live_draw, annotated_photo, key_takeaways, quote, section_divider, action_plan, closing,
  "revealMode": how it reveals while narrated — one of: all_at_once, progressive, stroke_by_stroke, word_by_word, build_diagram
}
Rules:
- Choose the "layout" by the PURPOSE of each moment (a comparison → comparison_table/pros_cons; a stat → data_spotlight; a process → step_process/workflow_diagram; a story → real_world_scenario/case_study; a strong claim → hero_statement/quote). Do NOT use the same layout on consecutive slides. One main idea per slide.
- Set "revealMode": progressive for bulleted teaching, build_diagram for whiteboard, stroke_by_stroke for livedraw, all_at_once only for a hero/quote/section divider.
- ${opts.wantWhiteboard ? "Use whiteboard/livedraw slides GENEROUSLY for concepts, processes and frameworks — aim for at least a third of the deck. Use \"livedraw\" for the SINGLE most important concept that lands best when sketched stroke-by-stroke while talking; use \"whiteboard\" for the rest. Rich multi-step diagrams (4-6 nodes)." : "Do NOT use whiteboard or livedraw slides."}
- For EVERY whiteboard/livedraw slide, ALWAYS add 1-2 short \`annotations\` (sticky-note callouts) and an \`assetPrompt\` describing a 3D asset that makes the concept concrete.
- VARY the visualStyle deliberately across the deck — alternate real photography (real-world/people scenes), 3D (abstract or systemic concepts) and illustration (the rest) so consecutive slides don't look the same. Aim for a healthy mix, not one style repeated.
- Go DEEP: give each slide substantive, specific teaching content (concrete bullets, real examples, numbers/steps where relevant) — not generic filler. The notes should be a real talking point the presenter can expand on.
- Open with a title/agenda slide and close with a summary or call-to-action. Every line tight and presentable.${varyNote}`;

  // Bigger decks need more output room or the JSON truncates (dropping slides).
  const maxTokens = Math.min(16000, 2000 + n * 450);
  const t1 = opts.variation ? 0.9 : 0.5, t2 = opts.variation ? 0.7 : 0.25;
  const raw = (await ai.generateJSON<{ title?: string; slides?: RawSlide[] }>(prompt, { temperature: t1, maxTokens }))
    ?? (await ai.generateJSON<{ title?: string; slides?: RawSlide[] }>(prompt, { temperature: t2, maxTokens }));
  if (!raw?.slides?.length) return null;

  const assetBoxes: Record<string, AssetBox> = {}; // slide id → where its 3D cutout sits
  let videoCount = 0; // at most 2 generated demonstration videos per deck
  const slides: DeckSlide[] = raw.slides.slice(0, n).map((s): DeckSlide => {
    const board2 = (s.type === "whiteboard" || s.type === "livedraw") && opts.wantWhiteboard;
    const type: DeckSlide["type"] = board2 ? (s.type as "whiteboard" | "livedraw") : "doc";
    if (type === "whiteboard" || type === "livedraw") {
      const id = uid("s");
      const { items: board, wide, assetBox } = diagramToBoard(s.diagram, type === "livedraw");
      if (assetBox) assetBoxes[id] = assetBox;
      // sticky-note callouts in the RESERVED BOTTOM LANE — the diagram is fitted into
      // the band above, so notes never overlap a node. Revealed after the diagram.
      const anns = (s.annotations ?? []).map((t) => stripMd(String(t)).slice(0, 100).trim()).filter(Boolean).slice(0, 2);
      const dMax = stepCount(board);
      anns.forEach((text, i) => {
        const atx = anns.length === 1 ? 0.3 : 0.1 + i * 0.44;
        board.push({ id: uid("note"), t: "text", by: "", at: { x: atx, y: 0.82 }, text, color: "#4a3c07", size: 0.028, note: "#fde68a", step: dMax + i });
      });
      const steps = Math.max(1, stepCount(board));
      return {
        id, type,
        title: stripMd(s.title || "Concept").slice(0, 120),
        subtitle: stripMd(s.subtitle).slice(0, 160) || undefined,
        notes: stripMd(s.notes).slice(0, 400) || undefined,
        board, steps, wide,
        assetPrompt: s.assetPrompt?.slice(0, 200),
        layout: asLayout(s.layout) ?? "live_draw",
        visualType: "diagram" as VisualType,
        revealMode: asReveal(s.revealMode) ?? (type === "livedraw" ? "stroke_by_stroke" : "build_diagram"),
      };
    }
    const style = s.visualStyle === "3d" ? "3d" : s.visualStyle === "illustration" ? "illustration" : "photo";
    const bullets = (s.bullets ?? []).slice(0, 5).map((b) => stripMd(String(b)).slice(0, 200)).filter(Boolean);
    // A demonstration video — at most 2 per deck, on the concepts that teach best in motion.
    const wantsVideo = !!(s.videoDemo && (s.videoPrompt || s.imagePrompt)) && videoCount < 2;
    const videoPrompt = wantsVideo ? (s.videoPrompt || s.imagePrompt || "").slice(0, 320) : undefined;
    if (wantsVideo) videoCount += 1;
    const visual: DeckVisual = {
      kind: "emoji", style, emoji: s.emoji || "🎯", prompt: s.imagePrompt?.slice(0, 300),
      tag: style === "3d" ? "3D visual" : style === "photo" ? "Photo" : "Illustration", layout: "right",
    };
    const highlight = hlPhrase(s.highlight, [s.subtitle, ...bullets]);
    return {
      id: uid("s"), type: "doc",
      title: stripMd(s.title || "Slide").slice(0, 120),
      subtitle: stripMd(s.subtitle).slice(0, 160) || undefined,
      bullets,
      notes: stripMd(s.notes).slice(0, 400) || undefined,
      visual, steps: bullets.length,
      layout: asLayout(s.layout),
      visualType: (videoPrompt ? "video" : style === "3d" ? "3d" : style === "illustration" ? "illustration" : "photo") as VisualType,
      revealMode: asReveal(s.revealMode) ?? "progressive",
      videoPrompt,
      ...(highlight ? { highlight, annotate: asAnnotate(s.annotate) ?? "circle" } : {}),
    };
  });

  // Photoreal / 3D visuals for doc slides (best-effort, small concurrency; emoji fallback).
  // ONLY for layouts whose renderer actually shows the image — text/card layouts (comparison,
  // steps, takeaways, big-stat, Q&A, …) never display it, so generating one there is a wasted
  // image-gen call. Video-demo slides use a clip, not an image. Unknown/default layouts still
  // generate (the classic doc layout has a side visual).
  const NO_IMAGE_LAYOUTS = new Set<string>([
    "comparison_table", "pros_cons", "myth_reality", "before_after", "step_process", "customer_journey",
    "timeline", "vertical_journey", "workflow_diagram", "key_takeaways", "action_plan", "recap_map",
    "concept_map", "data_spotlight", "dashboard_insight", "problem_solution_result", "question_answer",
    "interactive_question", "layered_explanation", "system_architecture", "workshop", "section_divider", "quote",
  ]);
  const slideUsesImage = (s: DeckSlide) => !s.videoPrompt && !(s.layout && NO_IMAGE_LAYOUTS.has(s.layout));
  if (opts.wantVisuals) {
    const docs = slides.filter((s) => s.type === "doc" && s.visual?.prompt && slideUsesImage(s));
    const LIMIT = 3;
    for (let i = 0; i < docs.length; i += LIMIT) {
      await Promise.all(docs.slice(i, i + LIMIT).map(async (s) => {
        try {
          const r = await generateImageXaiFirst(imgPrompt(s.visual!.style, s.visual!.prompt!), 1280, 720, { quality: "high" });
          if (r.base64) {
            // Unique key per generation — objects are cached immutably for a year, so reusing a
            // fixed key would keep showing the OLD image after regenerating a slide's visual.
            const url = await uploadToS3(`training/${opts.sessionId}/deck/${s.id}-${uid("v")}.png`, Buffer.from(r.base64, "base64"), "image/png");
            s.visual = { ...s.visual!, kind: "image", url };
          }
        } catch { /* keep the emoji */ }
      }));
    }

    // A generated 3D asset per whiteboard/livedraw slide — a TRANSPARENT cutout from
    // gpt-image (better at "isolated on transparent background"), dropped into the
    // clear zone the layout reserved for it (a cycle's empty centre, else a corner).
    const boards = slides.filter((s) => (s.type === "whiteboard" || s.type === "livedraw") && s.assetPrompt);
    for (const s of boards) {
      const abx = assetBoxes[s.id];
      if (!abx) continue;
      try {
        // MUST pin gpt-image-1 here: `background: "transparent"` is only honoured on
        // gpt-image-1 / 1.5 and is silently dropped on the default gpt-image-2 — which
        // is why the cutouts were coming back with an opaque background.
        const r = await generateImageWithProvider("openai", assetPrompt3D(s.assetPrompt!), 1024, 1024, { transparent: true, quality: "high", model: "gpt-image-1" });
        if (r.base64) {
          const url = await uploadToS3(`training/${opts.sessionId}/deck/${s.id}-asset-${uid("v")}.png`, Buffer.from(r.base64, "base64"), "image/png");
          s.board = [...(s.board ?? []), { id: uid("img"), t: "image", by: "", at: { x: abx.x, y: abx.y }, w: abx.w, h: abx.h, url }];
          s.steps = Math.max(1, stepCount(s.board));
        }
      } catch { /* skip the asset — the diagram stands on its own */ }
    }
  }

  // Interactive on-screen quiz questions from the content (best-effort; skipped on error).
  let quizzes: QuizQuestion[] = [];
  if (opts.wantVisuals !== false) { try { quizzes = await writeQuiz(slides); } catch { quizzes = []; } }

  return { v: 1, slides: withInteractions(slides, quizzes) };
}

/** Write a couple of multiple-choice checks from the deck's teaching content. */
async function writeQuiz(slides: DeckSlide[]): Promise<QuizQuestion[]> {
  const content = slides
    .map((s, i) => `${i + 1}. ${s.title}: ${[s.subtitle, ...(s.bullets ?? []), s.notes].filter(Boolean).join("; ")}`)
    .join("\n").slice(0, 4000);
  if (content.length < 40) return [];
  const prompt = `From this training content, write TWO short multiple-choice quiz questions that check understanding of the KEY points. Each: a clear question, exactly 4 concise options, the 0-based index of the correct option, and a one-sentence explanation. Base them ONLY on the content.

CONTENT:
${content}

Return JSON: { "quiz": [ { "question": string, "options": string[], "answerIndex": number, "explanation": string } ] }`;
  const raw = await ai.generateJSON<{ quiz?: QuizQuestion[] }>(prompt, { temperature: 0.5, maxTokens: 900 });
  return (raw?.quiz ?? [])
    .filter((q) => q?.question && Array.isArray(q.options) && q.options.length >= 2 && typeof q.answerIndex === "number" && q.answerIndex >= 0 && q.answerIndex < q.options.length)
    .map((q) => ({ question: String(q.question).slice(0, 220), options: q.options.slice(0, 4).map((o) => String(o).slice(0, 120)), answerIndex: q.answerIndex, explanation: q.explanation ? String(q.explanation).slice(0, 240) : undefined }))
    .slice(0, 2);
}

function qaSlide(kind: "checkpoint" | "final"): DeckSlide {
  return {
    id: uid("qa"),
    type: "doc",
    qa: true,
    qaKind: kind,
    title: kind === "final" ? "Questions & Discussion" : "Any questions so far?",
    subtitle: kind === "final" ? "Let's open the floor before we wrap up" : "Let's pause and take your questions",
    steps: 1,
  };
}

function quizSlide(q: QuizQuestion): DeckSlide {
  return { id: uid("quiz"), type: "doc", quiz: q, title: "Quick check", subtitle: q.question, steps: 2 };
}

function introSlide(): DeckSlide {
  return { id: uid("intro"), type: "doc", intro: true, title: "Welcome", subtitle: "Your AI co-host is getting started…", steps: 1 };
}

function presenterMomentSlide(): DeckSlide {
  return { id: uid("pm"), type: "doc", presenterMoment: true, title: "Your co-host", subtitle: "A quick word before we continue…", steps: 1 };
}

/** Weave interactive moments into a deck — an opening AI-co-host intro, a couple of
 *  "talking AI" bridge moments where the co-host appears full-screen, spaced quiz checks +
 *  a Q&A checkpoint, and a wrap-up Q&A right before the conclusion. */
function withInteractions(slides: DeckSlide[], quizzes: QuizQuestion[]): DeckSlide[] {
  const n = slides.length;
  if (n < 4) return [introSlide(), ...slides];
  const checkpointAt = Math.max(1, Math.floor(n * 0.62));
  const quizAt = [Math.max(1, Math.floor(n * 0.4)), Math.max(2, n - 2)];
  // A few full-screen "talking AI" bridges between slides (not on the first/last slide).
  const momentAt = [Math.max(1, Math.floor(n * 0.3)), Math.max(2, Math.floor(n * 0.78))];
  const out: DeckSlide[] = [introSlide()]; // the AI co-host opens the session
  let qi = 0;
  slides.forEach((s, i) => {
    if (i === n - 1) out.push(qaSlide("final")); // wrap-up Q&A just before the conclusion
    out.push(s);
    if (momentAt.includes(i) && i !== n - 1) out.push(presenterMomentSlide());
    if (quizAt.includes(i) && qi < quizzes.length) out.push(quizSlide(quizzes[qi++]));
    if (i === checkpointAt) out.push(qaSlide("checkpoint"));
  });
  return out;
}

