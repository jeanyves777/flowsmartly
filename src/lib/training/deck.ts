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
import { generateImageXaiFirst } from "@/lib/ai/image-router";
import { uploadToS3 } from "@/lib/utils/s3-client";
import type { BoardItem, DeckSlide, DeckVisual, TrainingDeck } from "./types";

const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 9)}`;

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
}

/** Turn a visual style + subject into a rich image prompt (photoreal / 3D / flat). */
function imgPrompt(style: RawSlide["visualStyle"], subject: string): string {
  const s = subject.slice(0, 300);
  if (style === "3d")
    return `${s}. A modern 3D render, isometric, glossy tactile materials, soft studio lighting, subtle depth of field, clean gradient background, high detail, no text, no watermark.`;
  if (style === "illustration")
    return `${s}. A clean modern vector illustration, tasteful brand colours, soft shapes, no text, no watermark.`;
  // default: photoreal
  return `${s}. Hyper-realistic professional photography, natural lighting, shallow depth of field, high detail, shot on a full-frame camera, no text, no watermark.`;
}

export function parseDeck(raw: string | null | undefined): TrainingDeck {
  if (!raw) return { v: 1, slides: [] };
  try {
    const d = JSON.parse(raw) as Partial<TrainingDeck>;
    return { v: 1, slides: Array.isArray(d.slides) ? d.slides : [] };
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

/** Lay out a small diagram as rounded-rectangle node cards + connecting arrows, in
 *  fractional (0..1) coords. A `flow` marches left→right across an ENDLESS horizontal
 *  canvas (the view pans across it during presentation); a `tree` puts a root over a
 *  wide row of children; a `cycle` sits on a ring sized so the cards never touch.
 *  Every node is sized to its label so text never overflows. Returns how many 16:9
 *  frames wide the canvas is (`wide`); x is normalised by the full width, y by one
 *  frame's height. */
export function diagramToBoard(d: RawSlide["diagram"], perElement = false): { items: BoardItem[]; wide: number } {
  const labels = (d?.nodes ?? []).slice(0, 6).map((s) => String(s).slice(0, 44));
  if (!labels.length) return { items: [], wide: 1 };
  const shape = d?.shape ?? "flow";
  const ink = "#1e293b";
  const box = labels.map(measure);

  // centres in SVG px (x may exceed FRAME_W for a wide diagram; y within a frame).
  const centers: { x: number; y: number }[] = [];
  let CW = FRAME_W;

  if (shape === "tree" && labels.length > 1) {
    // root on top, the rest as a wide row beneath it
    let cur = MARGIN;
    const kidX = box.slice(1).map((b) => { const cx = cur + b.w / 2; cur += b.w + NODE_GAP; return cx; });
    CW = Math.max(FRAME_W, cur - NODE_GAP + MARGIN);
    centers.push({ x: (kidX[0] + kidX[kidX.length - 1]) / 2, y: FRAME_H * 0.24 });
    kidX.forEach((x) => centers.push({ x, y: FRAME_H * 0.66 }));
  } else if (shape === "cycle" && labels.length > 2) {
    const maxW = Math.max(...box.map((b) => b.w)), n = labels.length;
    const rx = Math.max(FRAME_W * 0.3, (maxW + NODE_GAP) / (2 * Math.sin(Math.PI / n)));
    const ry = Math.min(FRAME_H * 0.34, rx * 0.6);
    CW = Math.max(FRAME_W, 2 * rx + maxW + 2 * MARGIN);
    const cx = CW / 2, cy = FRAME_H / 2;
    labels.forEach((_, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      centers.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
    });
  } else {
    // flow — one wide left→right row
    let cur = MARGIN;
    box.forEach((b) => { centers.push({ x: cur + b.w / 2, y: FRAME_H * 0.5 }); cur += b.w + NODE_GAP; });
    CW = Math.max(FRAME_W, cur - NODE_GAP + MARGIN);
  }

  const wide = CW / FRAME_W;
  const nx = (px: number) => px / CW;       // svg px → 0..1 of the wide canvas
  const ny = (py: number) => py / FRAME_H;  // svg px → 0..1 of one frame's height

  const edges: [number, number][] = (d?.edges?.map((e) => [e[0], e[1]] as [number, number])) ?? (
    shape === "cycle" ? labels.map((_, i) => [i, (i + 1) % labels.length] as [number, number])
    : shape === "tree" ? labels.slice(1).map((_, i) => [0, i + 1] as [number, number])
    : labels.slice(1).map((_, i) => [i, i + 1] as [number, number]));

  const node = (i: number, step: number): BoardItem => {
    const c = centers[i], b = box[i];
    return { id: uid("n"), t: "shape", by: "", shape: "rect", color: ink, size: 0.003, from: { x: nx(c.x - b.w / 2), y: ny(c.y - b.h / 2) }, to: { x: nx(c.x + b.w / 2), y: ny(c.y + b.h / 2) }, step };
  };
  const lab = (i: number, step: number): BoardItem => {
    const c = centers[i];
    return { id: uid("t"), t: "text", by: "", at: { x: nx(c.x), y: ny(c.y) }, text: box[i].label, color: ink, size: box[i].fs / FRAME_H, step };
  };
  const arr = (a: number, b: number, step: number): BoardItem => {
    const s = boxEdge(centers[a], box[a], centers[b]), e = boxEdge(centers[b], box[b], centers[a]);
    return { id: uid("e"), t: "shape", by: "", shape: "arrow", color: ink, size: 0.0026, from: { x: nx(s.x), y: ny(s.y) }, to: { x: nx(e.x), y: ny(e.y) }, step };
  };

  const items: BoardItem[] = [];
  if (perElement) {
    // Live Draw — every element is its own step in natural drawing order (card,
    // label, then any edge whose endpoints are both already on the board).
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
  return { items, wide };
}

/** How many reveal steps a set of stepped items has. */
export function stepCount(items: BoardItem[]): number {
  let max = -1;
  for (const it of items) if ("step" in it && typeof it.step === "number") max = Math.max(max, it.step);
  return max + 1;
}

/** The clamped slide count a deck will have — the single source of truth shared by
 *  the generator and the credit estimate (client + server). */
export function deckSlideCount(slideCount?: number): number {
  return Math.min(12, Math.max(3, slideCount ?? 6));
}

/** How many generated illustrations a built deck actually carries (what we charge) —
 *  doc-slide visuals plus any 3D assets dropped on whiteboard/livedraw boards. */
export function deckImageCount(deck: TrainingDeck): number {
  return deck.slides.reduce(
    (n, s) => n + (s.visual?.kind === "image" ? 1 : 0) + (s.board?.filter((i) => i.t === "image").length ?? 0),
    0,
  );
}

/** Turn a brief into a deck. Returns null only if the model gives nothing usable. */
export async function generateDeck(opts: {
  brief: string;
  sessionId: string;
  wantDoc?: boolean;
  wantWhiteboard?: boolean;
  wantVisuals?: boolean;
  slideCount?: number;
}): Promise<TrainingDeck | null> {
  const n = deckSlideCount(opts.slideCount);
  const faces = [opts.wantDoc !== false ? "document" : "", opts.wantWhiteboard ? "whiteboard" : ""].filter(Boolean).join(" and ");

  const prompt = `You are an expert instructional designer building a COMPLETE VISUAL TEACHING EXPERIENCE (not plain bullet slides) from this brief:

"""${opts.brief.slice(0, 2000)}"""

Produce EXACTLY ${n} slides as ${faces || "document"} slides. Teach it like a great presenter: mix photorealistic imagery, 3D explainers, and step-by-step whiteboard sections.
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
  "diagram": { "shape": "cycle"|"flow"|"tree", "nodes": [3-6 short labels], "edges": [[fromIndex,toIndex]] }, // "whiteboard" and "livedraw" slides
  "annotations": [1-2 very short sticky-note callouts — a key insight, tip or watch-out], // "whiteboard"/"livedraw" slides
  "assetPrompt": a vivid subject for a 3D asset that illustrates this concept (an object/system/scene, no text, no watermark) // "whiteboard"/"livedraw" slides
}
Rules:
- ${opts.wantWhiteboard ? "Use whiteboard/livedraw slides GENEROUSLY for concepts, processes and frameworks — aim for at least a third of the deck. Use \"livedraw\" for the SINGLE most important concept that lands best when sketched stroke-by-stroke while talking; use \"whiteboard\" for the rest. Rich multi-step diagrams (4-6 nodes)." : "Do NOT use whiteboard or livedraw slides."}
- For EVERY whiteboard/livedraw slide, ALWAYS add 1-2 short \`annotations\` (sticky-note callouts) and an \`assetPrompt\` describing a 3D asset that makes the concept concrete.
- Choose visualStyle deliberately: real photography for real-world/people scenes, 3D for abstract or systemic concepts, illustration for the rest.
- Open with a title/agenda slide and close with a summary or call-to-action. Every line tight and presentable.`;

  const raw = (await ai.generateJSON<{ title?: string; slides?: RawSlide[] }>(prompt, { temperature: 0.5, maxTokens: 3500 }))
    ?? (await ai.generateJSON<{ title?: string; slides?: RawSlide[] }>(prompt, { temperature: 0.25, maxTokens: 3500 }));
  if (!raw?.slides?.length) return null;

  const slides: DeckSlide[] = raw.slides.slice(0, n).map((s): DeckSlide => {
    const board2 = (s.type === "whiteboard" || s.type === "livedraw") && opts.wantWhiteboard;
    const type: DeckSlide["type"] = board2 ? (s.type as "whiteboard" | "livedraw") : "doc";
    if (type === "whiteboard" || type === "livedraw") {
      const { items: board, wide } = diagramToBoard(s.diagram, type === "livedraw");
      // sticky-note callouts along the BOTTOM band (title sits top-left, the 3D asset
      // top-right, the diagram in the middle), revealed after the diagram is drawn.
      const anns = (s.annotations ?? []).map((t) => String(t).slice(0, 100).trim()).filter(Boolean).slice(0, 2);
      const dMax = stepCount(board);
      anns.forEach((text, i) => {
        const atx = anns.length === 1 ? 0.3 : 0.12 + i * 0.44;
        board.push({ id: uid("note"), t: "text", by: "", at: { x: atx, y: 0.74 }, text, color: "#4a3c07", size: 0.03, note: "#fde68a", step: dMax + i });
      });
      const steps = Math.max(1, stepCount(board));
      return {
        id: uid("s"), type,
        title: (s.title || "Concept").slice(0, 120),
        subtitle: s.subtitle?.slice(0, 160),
        notes: s.notes?.slice(0, 400),
        board, steps, wide,
        assetPrompt: s.assetPrompt?.slice(0, 200),
      };
    }
    const style = s.visualStyle === "3d" ? "3d" : s.visualStyle === "illustration" ? "illustration" : "photo";
    const bullets = (s.bullets ?? []).slice(0, 5).map((b) => String(b).slice(0, 200));
    const visual: DeckVisual = {
      kind: "emoji", style, emoji: s.emoji || "🎯", prompt: s.imagePrompt?.slice(0, 300),
      tag: style === "3d" ? "3D visual" : style === "photo" ? "Photo" : "Illustration", layout: "right",
    };
    return {
      id: uid("s"), type: "doc",
      title: (s.title || "Slide").slice(0, 120),
      subtitle: s.subtitle?.slice(0, 160),
      bullets,
      notes: s.notes?.slice(0, 400),
      visual, steps: bullets.length,
    };
  });

  // Photoreal / 3D visuals for doc slides (best-effort, small concurrency; emoji fallback).
  if (opts.wantVisuals) {
    const docs = slides.filter((s) => s.type === "doc" && s.visual?.prompt);
    const LIMIT = 3;
    for (let i = 0; i < docs.length; i += LIMIT) {
      await Promise.all(docs.slice(i, i + LIMIT).map(async (s) => {
        try {
          const r = await generateImageXaiFirst(imgPrompt(s.visual!.style, s.visual!.prompt!), 1280, 720, { quality: "high" });
          if (r.base64) {
            const url = await uploadToS3(`training/${opts.sessionId}/deck/${s.id}.png`, Buffer.from(r.base64, "base64"), "image/png");
            s.visual = { ...s.visual!, kind: "image", url };
          }
        } catch { /* keep the emoji */ }
      }));
    }

    // A generated 3D asset for each whiteboard/livedraw slide, dropped top-right of
    // the board so the concept has something concrete beside the diagram.
    const boards = slides.filter((s) => (s.type === "whiteboard" || s.type === "livedraw") && s.assetPrompt);
    for (const s of boards) {
      try {
        const r = await generateImageXaiFirst(imgPrompt("3d", s.assetPrompt!), 1024, 768, { quality: "high" });
        if (r.base64) {
          const url = await uploadToS3(`training/${opts.sessionId}/deck/${s.id}-asset.png`, Buffer.from(r.base64, "base64"), "image/png");
          const CW = 1000 * (s.wide ?? 1), AW = 250, AH = 188, ax = 1000 - 44 - AW, ay = 44;
          s.board = [...(s.board ?? []), { id: uid("img"), t: "image", by: "", at: { x: ax / CW, y: ay / 562 }, w: AW / CW, h: AH / 562, url }];
          s.steps = Math.max(1, stepCount(s.board));
        }
      } catch { /* skip the asset — the diagram stands on its own */ }
    }
  }

  return { v: 1, slides };
}
