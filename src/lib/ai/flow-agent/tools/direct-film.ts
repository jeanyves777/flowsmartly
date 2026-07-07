import type { FlowAgentTool } from "../registry";
import { createFilm } from "@/lib/video-director/store";
import { draftFilmPipeline } from "@/lib/video-director/draft";
import { generateSceneRender } from "@/lib/video-director/engines";
import { FILM_ASPECTS, FILM_TYPES, type FilmAspect, type FilmType } from "@/lib/video-director/types";

/**
 * direct_film — the agent skill behind the Video Studio (Director). It creates a
 * film from a brief and STORYBOARDS a pipeline of scenes, choosing the best
 * engine per beat (cinematic AI shot, the user's talking-avatar clone, a branded
 * still), which appear as nodes on the studio canvas. Optionally auto-generates
 * each drafted scene (charged per scene on its own engine).
 *
 * Interview the user first (goal, product, tone, length). Drafting is free;
 * generating scenes + stitching are charged in credits. Mutating — propose a
 * plan first. [[agent-writes-into-ui-element-not-chat]]
 */
export const directFilm: FlowAgentTool = {
  name: "direct_film",
  description:
    "Direct a multi-engine video in the Video Studio (Director): create a film from a BRIEF and storyboard a pipeline of scenes, each rendered by the best engine — 'ai' (cinematic AI shot), 'avatar' (the user's talking-avatar clone), or 'design' (a branded still/CTA). The scenes appear as nodes on the studio canvas for the user to edit/reorder/render, then stitch into one film. Write a rich brief for the user. Set `autoGenerate: true` to render the drafted scenes immediately (charges credits per scene on its engine); otherwise the user generates each beat in the studio. `filmType` product_ad/ai_film/reel/testimonial/explainer, `aspect` 9:16/1:1/16:9, `targetSeconds` e.g. 15/30/60/90. Costs are metered in credits; never quote a dollar figure. After calling, tell the user to open Video Studio.",
  input_schema: {
    type: "object",
    properties: {
      brief: { type: "string", description: "What the film is — story/goal/product/tone. Write this richly for the user." },
      filmType: { type: "string", enum: FILM_TYPES, description: "product_ad | ai_film | reel | testimonial | explainer." },
      aspect: { type: "string", enum: FILM_ASPECTS, description: "Output aspect ratio. Default 9:16." },
      targetSeconds: { type: "number", description: "Target length in seconds (e.g. 15/30/60/90). Default 30." },
      title: { type: "string", description: "Short film title (optional)." },
      autoGenerate: { type: "boolean", description: "If true, render each drafted scene now (charges credits per scene). Default false — the user renders in the studio." },
    },
    required: ["brief"],
  },
  plans: null,
  costKey: "AGENT_PROPOSE_PLAN", // 0 — per-scene render/stitch cost is charged inside the engines.
  mutating: true,
  handler: async (input, ctx) => {
    const brief = String(input.brief || "").trim();
    if (!brief) return { ok: false, error_code: "missing_input", message: "Ask the user what the film should be about." };
    const aspect: FilmAspect = FILM_ASPECTS.includes(input.aspect as FilmAspect) ? (input.aspect as FilmAspect) : "9:16";
    const filmType: FilmType = FILM_TYPES.includes(input.filmType as FilmType) ? (input.filmType as FilmType) : "product_ad";
    const targetSeconds = typeof input.targetSeconds === "number" ? input.targetSeconds : 30;

    const created = await createFilm(ctx.userId, {
      brief,
      filmType,
      aspect,
      targetSeconds,
      title: String(input.title || "").slice(0, 120) || brief.slice(0, 60),
    });
    const film = (await draftFilmPipeline(created.id, ctx.userId)) || created;

    let generated = 0;
    if (input.autoGenerate) {
      for (const s of film.scenes) {
        const r = await generateSceneRender(film.id, ctx.userId, s.id).catch(() => null);
        if (r?.ok) generated++;
      }
    }

    const breakdown = film.scenes.map((s, i) => `${i + 1}. [${s.engine}] ${s.title}`).join("; ");
    return {
      ok: true,
      data: {
        id: film.id,
        scenes: film.scenes.length,
        generated,
        userMessage:
          `Directed a ${film.scenes.length}-scene ${filmType.replace("_", " ")} in the Video Studio (${breakdown}). ` +
          (input.autoGenerate ? `Rendering ${generated} scene(s) now.` : "Open Video Studio to tweak each beat and render.") +
          " Say so in ONE short sentence and tell them to open Video Studio.",
      },
      resultRefType: "Design",
      resultRefId: film.id,
    };
  },
};
