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
  type?: "doc" | "whiteboard";
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
 *  analog of hand-sketching the "objection → reframe → close" flow. */
export function diagramToBoard(d: RawSlide["diagram"]): BoardItem[] {
  const nodes = (d?.nodes ?? []).slice(0, 6).map((s) => String(s).slice(0, 40));
  if (!nodes.length) return [];
  const shape = d?.shape ?? "flow";
  const ink = "#1e293b";
  const NW = 0.2, NH = 0.16; // node box size (fraction)
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
    // flow — a left→right row (wraps to 2 rows past 3 nodes)
    const perRow = nodes.length > 3 ? Math.ceil(nodes.length / 2) : nodes.length;
    nodes.forEach((_, i) => {
      const row = Math.floor(i / perRow), col = i % perRow;
      const count = row === 0 ? Math.min(perRow, nodes.length) : nodes.length - perRow;
      const x = count === 1 ? 0.5 : 0.14 + (col / (count - 1)) * 0.72;
      const y = nodes.length > 3 ? (row === 0 ? 0.34 : 0.66) : 0.5;
      centers.push({ x, y });
    });
  }

  const items: BoardItem[] = [];
  // Each mark carries a reveal `step` so the diagram builds up node-by-node as the
  // presenter talks (node i at step i; an edge appears with its later node).
  const edges = d?.edges ?? (shape === "cycle"
    ? nodes.map((_, i) => [i, (i + 1) % nodes.length] as [number, number])
    : nodes.slice(1).map((_, i) => [i, i + 1] as [number, number]));
  for (const [a, b] of edges) {
    if (!centers[a] || !centers[b]) continue;
    items.push({ id: uid("e"), t: "shape", by: "", shape: "arrow", color: ink, size: 0.003, from: centers[a], to: centers[b], step: Math.max(a, b) });
  }
  nodes.forEach((label, i) => {
    const c = centers[i];
    items.push({ id: uid("n"), t: "shape", by: "", shape: "ellipse", color: ink, size: 0.0035, from: { x: c.x - NW / 2, y: c.y - NH / 2 }, to: { x: c.x + NW / 2, y: c.y + NH / 2 }, step: i });
    items.push({ id: uid("t"), t: "text", by: "", at: { x: c.x - NW / 2 + 0.02, y: c.y - 0.02 }, text: label, color: ink, size: 0.03, step: i });
  });
  return items;
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
  "type": "doc" | "whiteboard",
  "title": short slide title,
  "subtitle": one short supporting line,
  "bullets": [3-4 concise talking points],       // "doc" slides
  "notes": 1-2 sentence speaker note,
  "emoji": one relevant emoji,                   // "doc" slides
  "visualStyle": "photo" | "3d" | "illustration",// "doc" slides — photo for real-world scenes/people, 3d for abstract concepts/systems, illustration otherwise
  "imagePrompt": a vivid prompt for the visual (no text in the image, no watermark), // "doc" slides
  "diagram": { "shape": "cycle"|"flow"|"tree", "nodes": [3-6 short labels], "edges": [[fromIndex,toIndex]] } // "whiteboard" slides
}
Rules:
- ${opts.wantWhiteboard ? "Use whiteboard slides GENEROUSLY for concepts, processes and frameworks — aim for at least a third of the deck as whiteboard explainers with rich multi-step diagrams (4-6 nodes)." : "Do NOT use whiteboard slides."}
- Choose visualStyle deliberately: real photography for real-world/people scenes, 3D for abstract or systemic concepts, illustration for the rest.
- Open with a title/agenda slide and close with a summary or call-to-action. Every line tight and presentable.`;

  const raw = (await ai.generateJSON<{ title?: string; slides?: RawSlide[] }>(prompt, { temperature: 0.5, maxTokens: 3500 }))
    ?? (await ai.generateJSON<{ title?: string; slides?: RawSlide[] }>(prompt, { temperature: 0.25, maxTokens: 3500 }));
  if (!raw?.slides?.length) return null;

  const slides: DeckSlide[] = raw.slides.slice(0, n).map((s): DeckSlide => {
    const type: DeckSlide["type"] = s.type === "whiteboard" && opts.wantWhiteboard ? "whiteboard" : "doc";
    if (type === "whiteboard") {
      const board = diagramToBoard(s.diagram);
      const steps = Math.max(1, (s.diagram?.nodes ?? []).slice(0, 6).length);
      return {
        id: uid("s"), type: "whiteboard",
        title: (s.title || "Concept").slice(0, 120),
        subtitle: s.subtitle?.slice(0, 160),
        notes: s.notes?.slice(0, 400),
        board, steps,
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
