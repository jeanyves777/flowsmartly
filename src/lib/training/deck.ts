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

/** Lay out a small diagram as BoardItems in fractional (0..1) coords — the code
 *  analog of hand-sketching the "objection → reframe → close" flow.
 *
 *  A `flow` becomes an ENDLESS HORIZONTAL canvas: the steps march left→right and the
 *  board grows wider than one frame, so during presentation the view pans across it
 *  as the reveal advances. `cycle`/`tree` stay inside a single frame. The returned
 *  `wide` is how many 16:9 frames the canvas spans; board coords are 0..1 of that
 *  wide canvas (x is normalised by `wide`, y stays 0..1 of the frame height). */
export function diagramToBoard(d: RawSlide["diagram"], perElement = false): { items: BoardItem[]; wide: number } {
  const nodes = (d?.nodes ?? []).slice(0, 6).map((s) => String(s).slice(0, 40));
  if (!nodes.length) return { items: [], wide: 1 };
  const shape = d?.shape ?? "flow";
  const ink = "#1e293b";
  const NW = 0.2, NH = 0.16; // node box size (fraction of ONE frame)
  // centres in FRAME units — x MAY exceed 1.0 for a wide flow; y stays 0..1.
  const centers: { x: number; y: number }[] = [];

  if (shape === "cycle") {
    const cx = 0.5, cy = 0.5, r = 0.3;
    nodes.forEach((_, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / nodes.length;
      centers.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) * 0.82 });
    });
  } else if (shape === "tree") {
    centers.push({ x: 0.5, y: 0.24 }); // root
    const kids = nodes.length - 1;
    for (let i = 1; i < nodes.length; i++) {
      const x = kids === 1 ? 0.5 : 0.16 + ((i - 1) / (kids - 1)) * 0.68;
      centers.push({ x, y: 0.66 });
    }
  } else {
    // flow — an ENDLESS left→right row. Each step sits a fixed distance further
    // right, so the canvas extends horizontally instead of wrapping.
    const GAP = 0.34; // frame-widths between node centres
    nodes.forEach((_, i) => centers.push({ x: 0.18 + i * GAP, y: 0.5 }));
  }

  // Canvas width in frames: rightmost node edge + a small margin (never < 1).
  const maxX = Math.max(...centers.map((c) => c.x));
  const wide = Math.max(1, maxX + NW / 2 + 0.06);
  const nx = (x: number) => x / wide; // frame-unit x → 0..1 of the wide canvas

  const edges = d?.edges ?? (shape === "cycle"
    ? nodes.map((_, i) => [i, (i + 1) % nodes.length] as [number, number])
    : nodes.slice(1).map((_, i) => [i, i + 1] as [number, number]));

  const ell = (i: number, step: number): BoardItem => {
    const c = centers[i];
    return { id: uid("n"), t: "shape", by: "", shape: "ellipse", color: ink, size: 0.0035, from: { x: nx(c.x - NW / 2), y: c.y - NH / 2 }, to: { x: nx(c.x + NW / 2), y: c.y + NH / 2 }, step };
  };
  const lab = (i: number, label: string, step: number): BoardItem => {
    const c = centers[i];
    return { id: uid("t"), t: "text", by: "", at: { x: nx(c.x - NW / 2 + 0.02), y: c.y - 0.02 }, text: label, color: ink, size: 0.03, step };
  };
  // Arrows connect node EDGE→node EDGE (not centre→centre), so the arrowhead lands
  // just outside the next node instead of buried inside it. Worked in the render's
  // SVG space (x×1000, y×562) because that scale is non-uniform, then normalised back.
  const rxS = (NW / 2) * 1000, ryS = (NH / 2) * 562;
  const ellR = (t: number) => (rxS * ryS) / Math.sqrt((ryS * Math.cos(t)) ** 2 + (rxS * Math.sin(t)) ** 2);
  const arr = (a: number, b: number, step: number): BoardItem => {
    const ax = centers[a].x * 1000, ay = centers[a].y * 562, bx = centers[b].x * 1000, by = centers[b].y * 562;
    const al = Math.atan2(by - ay, bx - ax), r = ellR(al), CWl = 1000 * wide;
    const sx = ax + r * Math.cos(al), sy = ay + r * Math.sin(al), ex = bx - r * Math.cos(al), ey = by - r * Math.sin(al);
    return { id: uid("e"), t: "shape", by: "", shape: "arrow", color: ink, size: 0.003, from: { x: sx / CWl, y: sy / 562 }, to: { x: ex / CWl, y: ey / 562 }, step };
  };

  const items: BoardItem[] = [];
  if (perElement) {
    // Live Draw — EVERY element is its own step, in natural drawing order (node,
    // label, then any edge whose endpoints are both on the board), so it draws one
    // stroke at a time as the presenter narrates.
    let step = 0;
    const drawn = new Set<number>(), edgeDone = new Set<string>();
    nodes.forEach((label, i) => {
      items.push(ell(i, step++));
      items.push(lab(i, label, step++));
      drawn.add(i);
      for (const [a, b] of edges) {
        const key = `${a}-${b}`;
        if (!edgeDone.has(key) && centers[a] && centers[b] && drawn.has(a) && drawn.has(b)) {
          items.push(arr(a, b, step++)); edgeDone.add(key);
        }
      }
    });
  } else {
    // node i at step i; an edge appears with its later node
    for (const [a, b] of edges) { if (centers[a] && centers[b]) items.push(arr(a, b, Math.max(a, b))); }
    nodes.forEach((label, i) => { items.push(ell(i, i)); items.push(lab(i, label, i)); });
  }
  return { items, wide };
}

/** How many reveal steps a set of stepped items has. */
export function stepCount(items: BoardItem[]): number {
  let max = -1;
  for (const it of items) if ("step" in it && typeof it.step === "number") max = Math.max(max, it.step);
  return max + 1;
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
  const n = Math.min(12, Math.max(3, opts.slideCount ?? 6));
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
  "diagram": { "shape": "cycle"|"flow"|"tree", "nodes": [3-6 short labels], "edges": [[fromIndex,toIndex]] } // "whiteboard" and "livedraw" slides
}
Rules:
- ${opts.wantWhiteboard ? "Use whiteboard/livedraw slides GENEROUSLY for concepts, processes and frameworks — aim for at least a third of the deck. Use \"livedraw\" for the SINGLE most important concept that lands best when sketched stroke-by-stroke while talking; use \"whiteboard\" for the rest. Rich multi-step diagrams (4-6 nodes)." : "Do NOT use whiteboard or livedraw slides."}
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
      const steps = Math.max(1, stepCount(board));
      return {
        id: uid("s"), type,
        title: (s.title || "Concept").slice(0, 120),
        subtitle: s.subtitle?.slice(0, 160),
        notes: s.notes?.slice(0, 400),
        board, steps, wide,
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
  }

  return { v: 1, slides };
}
