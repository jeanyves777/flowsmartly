/**
 * Voice Studio — DRAFT.
 *
 * One pass turns the brief into the WHOLE flow: the narration script, the cast of
 * recurring subjects, and a written visual prompt for every shot. Drafting it all
 * together (rather than prompting each shot as it renders) is what makes the visuals
 * consistent by construction — the model can see the whole story when it decides who
 * appears where and what each frame looks like.
 *
 * Fire-and-forget: sets draftStatus and returns; the canvas polls. [[voice-studio]]
 */
import { ai } from "@/lib/ai/client";
import { getNarration, saveNarration } from "./store";
import { holdForLine, normalizeShot, type NarrationProject, type NarrationShot, type ShotKind, type ExplainerGraphic } from "./types";
import { normalizeCharacter, type FilmCharacter } from "@/lib/video-director/types";
import { sanitizeUserError } from "@/lib/ai/user-error";

function rid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

const STYLE_VOICE: Record<string, string> = {
  documentary: "measured, cinematic and authoritative — a considered documentary voice that trusts the story",
  explainer: "clear, warm and direct — teaches quickly without talking down",
  commercial: "punchy and warm — it sells without shouting",
  audiobook: "intimate and unhurried — story first, close to the ear",
  news: "crisp and neutral — on the beat, no editorialising",
  meditation: "soft, slow and spacious — lots of air between thoughts",
};

interface DraftShape {
  title?: string;
  script?: string;
  cast?: { name: string; role: string; description: string }[];
  shots?: { line: string; kind?: string; prompt: string; cast?: string[]; move?: string }[];
}

/**
 * Draft script + cast + every shot prompt. Runs in the background; never throws.
 */
export async function draftNarration(id: string, userId: string): Promise<void> {
  try {
    const p = await getNarration(id, userId);
    if (!p) return;
    // Stamp the start so a draft orphaned by a deploy/crash can be detected as stale
    // and re-run, instead of spinning on "Writing the script…" forever.
    await patchDraft(id, userId, { draftStatus: "drafting", draftStartedAt: Date.now() });
    const brief = (p.brief || p.title || "").trim();
    if (!brief) {
      await patchDraft(id, userId, { draftStatus: "failed", draftError: "Tell the studio what to narrate first." });
      return;
    }

    // On-camera explainer drafts differently: no depicted film cast (the host is the
    // Avatar IV presenter), and each beat carries a DESIGNED graphic or a b-roll prompt.
    if (p.mode === "oncam") { await draftOnCam(id, userId, p, brief); return; }

    const wantsVideo = p.treatment === "mixed";
    const targetSec = Math.max(20, Math.min(240, p.shots.length ? p.shots.reduce((n, s) => n + s.holdSec, 0) : 45));
    const approxShots = Math.max(3, Math.min(18, Math.round(targetSec / 6)));

    const prompt =
      `You are a documentary director + narration writer. Brief: "${brief}".\n\n` +
      `Write a NARRATED ${wantsVideo ? "video" : "image story"} of about ${targetSec} seconds — roughly ${approxShots} shots.\n\n` +
      `THE VOICE\n` +
      `- ONE narrator carries the WHOLE story: ${STYLE_VOICE[p.narrationStyle] || STYLE_VOICE.documentary}.\n` +
      `- The narrator is NEVER on screen and NEVER a character. Nobody in the picture speaks — no dialogue, no quotes attributed to a person talking to camera.\n` +
      `- Write it to be HEARD, not read: short sentences, concrete nouns, no bullet points, no headings, no stage directions in the script.\n\n` +
      `THE SCRIPT\n` +
      `- "script" is the full narration, start to finish, as flowing prose.\n` +
      `- Then split that SAME text across the shots: each shot's "line" is the exact slice of narration heard over it. Concatenating every line in order MUST reproduce the script verbatim — do not paraphrase, add, or drop words.\n` +
      `- A line is one or two sentences (about 6-30 words). That is one beat of picture.\n\n` +
      `THE CAST (recurring subjects)\n` +
      `- If the story keeps returning to the same person, cast them: 0-4 people, only those who appear in MORE THAN ONE shot. A story about a place or an idea may need NO cast — return an empty list rather than inventing someone.\n` +
      `- Each gets an ORIGINAL first+last name, a short ROLE, and a vivid one-line VISUAL description (age, face, hair, build, story-appropriate clothing). Make them look CLEARLY different from each other.\n` +
      `- They are DEPICTED, never speaking. Do not write dialogue for them.\n` +
      `- Do NOT mention props, phones, held objects, aprons/uniforms, brands or logos.\n\n` +
      `THE SHOTS\n` +
      `- "kind": ${wantsVideo
        ? `"image" for a still that holds a beat, "video" for a moment that NEEDS motion (hands working, walking, weather, machinery). Prefer "image" — use "video" for about a third of the shots, on the moments that earn it.`
        : `always "image".`}\n` +
      `- "prompt": a full visual description of THAT frame — subject, action, framing/lens, light, mood. Cinematic and specific. This is the only thing the image/video model sees, so it must stand alone.\n` +
      `- "cast": the names of any cast in the shot (exactly as spelled in "cast"), else [].\n` +
      `- When a cast member is in the shot, NAME them in the prompt (e.g. "AMA lifts a crate…") so they can be anchored.\n` +
      `- "move": camera drift for stills — "in", "out", "left" or "right". Vary it.\n` +
      `- Hold ONE consistent visual world across every prompt: the same place, palette, era and light. Consecutive shots must feel like one film, not a gallery.\n\n` +
      `Return JSON ONLY:\n` +
      `{"title":"short title","script":"the full narration","cast":[{"name":"...","role":"...","description":"..."}],` +
      `"shots":[{"line":"exact slice of the script","kind":"image|video","prompt":"...","cast":["Name"],"move":"in"}]}`;

    let json: DraftShape | null = null;
    try {
      json = await ai.generateJSON<DraftShape>(prompt, { maxTokens: 6000, temperature: 0.7 });
    } catch {
      json = null;
    }
    const shots = Array.isArray(json?.shots) ? json!.shots.filter((s) => s?.line?.trim() && s?.prompt?.trim()) : [];
    if (shots.length === 0) {
      await patchDraft(id, userId, { draftStatus: "failed", draftError: "The studio couldn't storyboard that. Try a more specific brief." });
      return;
    }

    // Cast first: shots reference these by name, so they must exist before we map.
    const planned = Array.isArray(json?.cast) ? json!.cast.filter((c) => c?.name?.trim()).slice(0, 4) : [];
    const characters: FilmCharacter[] = planned.map((c, i) =>
      normalizeCharacter({
        id: rid("ch"), name: c.name, role: c.role || "Subject", description: c.description || "",
        renderStyle: "cinematic", previewStatus: "idle", approved: false,
      }, i),
    );
    const byName = new Map(characters.map((c) => [c.name.toLowerCase(), c.id]));

    const built: NarrationShot[] = shots.slice(0, 24).map((s, i) => {
      const kind: ShotKind = wantsVideo && s.kind === "video" ? "video" : "image";
      const line = String(s.line).trim();
      return normalizeShot({
        id: rid("shot"), order: i, kind, line, prompt: String(s.prompt).trim(),
        // Drop names the model invented that we didn't actually cast — an unanchored
        // name would silently render as a different person each time.
        cast: (Array.isArray(s.cast) ? s.cast : []).map((n) => byName.get(String(n).toLowerCase())).filter((x): x is string => !!x),
        move: (["in", "out", "left", "right"] as const).includes(s.move as never) ? (s.move as NarrationShot["move"]) : (i % 2 ? "out" : "in"),
        holdSec: holdForLine(line),
        source: "ai", status: "idle",
      }, i);
    });

    const fresh = await getNarration(id, userId);
    if (!fresh) return;
    fresh.title = (json?.title || fresh.title || "Narration").slice(0, 160);
    fresh.script = String(json?.script || built.map((s) => s.line).join(" ")).trim();
    // Keep a cast the user already previewed/approved rather than wiping their work.
    if (!fresh.characters.some((c) => c.previewStatus === "ready" || c.approved)) fresh.characters = characters;
    fresh.shots = built;
    fresh.draftStatus = "ready";
    fresh.draftError = null;
    await saveNarration(id, userId, fresh);
  } catch (err) {
    console.error("[voice-studio] draft failed:", err);
    await patchDraft(id, userId, { draftStatus: "failed", draftError: sanitizeUserError(err, "generic") });
  }
}

// ─────────────────────────────── on-camera explainer draft

interface OnCamBeat {
  line?: string;
  bottom?: "graphic" | "broll";
  graphic?: {
    kind?: string; headline?: string; caption?: string; subject?: string;
    items?: { label?: string; icon?: string; sub?: string }[];
    stat?: { value?: string; label?: string };
  };
  prompt?: string;
  motion?: string;
}
interface OnCamDraftShape { title?: string; script?: string; beats?: OnCamBeat[]; }

const GRAPHIC_KINDS = ["title", "iconflow", "keypoints", "stat", "quote", "diagram"];
const ICON_KEYS = ["goal", "plan", "tools", "action", "idea", "data", "time", "money", "chat", "rocket", "check", "gear", "target", "brain", "shield", "chart", "user", "bolt"];

/**
 * Draft an ON-CAMERA EXPLAINER: the host's spoken script split into beats, each with
 * EITHER a designed on-screen graphic (the teachable beats — steps/points/number/
 * definition) OR an atmospheric b-roll prompt. The host is the Avatar IV presenter,
 * so there is no depicted film cast. [[voice-oncam-explainer-feature]]
 */
async function draftOnCam(id: string, userId: string, p: NarrationProject, brief: string): Promise<void> {
  // The user picks the length (1-5 min) in the brief; fall back to 2 min. ~8s a beat.
  const targetSec = Math.max(30, Math.min(300, p.targetSec || (p.shots.length ? p.shots.reduce((n, s) => n + s.holdSec, 0) : 120)));
  const approxBeats = Math.max(3, Math.min(40, Math.round(targetSec / 8)));

  const prompt =
    `You are an expert explainer scriptwriter + motion designer. Brief: "${brief}".\n\n` +
    `Write a SHORT-FORM ON-CAMERA EXPLAINER (~${targetSec}s, ~${approxBeats} beats) for a 9:16 vertical video: a single on-camera HOST speaks the whole thing to camera while DESIGNED GRAPHICS appear below them.\n\n` +
    `THE HOST + SCRIPT\n` +
    `- ONE host (the viewer, on camera) narrates start to finish: ${STYLE_VOICE[p.narrationStyle] || STYLE_VOICE.explainer}.\n` +
    `- "script" = the full spoken narration as flowing prose, written to be HEARD (short sentences, concrete words, no bullets or headings).\n` +
    `- Split it into beats: each beat's "line" is the EXACT slice of the script heard during it. Concatenating every line in order MUST reproduce the script verbatim — do not paraphrase, add or drop words.\n` +
    `- A line is 1-2 sentences (~6-30 words).\n\n` +
    `EACH BEAT'S BOTTOM VISUAL — DEFAULT TO A DESIGNED GRAPHIC. This is a designed explainer, NOT a stock slideshow:\n` +
    `- Make ALMOST EVERY beat a "graphic". Even a real-world EXAMPLE becomes a DIAGRAM, never a photo — e.g. a thermostat is an iconflow "SENSES → DECIDES → ACTS", not a picture of a thermostat. Turn the idea into steps/points/a number. Fill "graphic":\n` +
    `   • "kind": "iconflow" (2-4 SEQUENTIAL steps/stages) | "keypoints" (2-5 PARALLEL points) | "stat" (one big number) | "quote" (a punchy line) | "title" (a section-title card) | "diagram".\n` +
    `   • "headline": a SHORT all-caps on-screen title (e.g. "WHAT IS AGENTIC AI?"). Use on the opening beat and when the section changes; omit otherwise.\n` +
    `   • "subject": EXACTLY ONE emoji that ILLUSTRATES what THIS beat is about — the concrete thing being discussed (🏠 house, 🤖 robot/AI, 📞 calls, 📈 growth, 💬 chat, 🧠 decisions, 🛒 store, 👥 customers, 📅 bookings, ⚙️ how-it-works…). Pick the most literal object for the beat; it becomes the animated hero. ALWAYS include it.\n` +
    `   • "caption": the ONE-LINE takeaway burned at the bottom — short and punchy.\n` +
    `   • "items" (iconflow/keypoints): 2-5 of {"label":"SHORT CAPS WORD","icon":ONE OF [${ICON_KEYS.join(", ")}],"sub":"optional 2-4 word detail"}. Labels MUST be the REAL steps/points of the content — never generic filler.\n` +
    `   • "stat" (stat kind): {"value":"40%","label":"short label"}.\n` +
    `- "broll" is the RARE EXCEPTION — AT MOST ONE beat in the whole video, and only for a purely emotional/atmospheric moment a diagram genuinely can't carry. If in doubt, use a graphic. Fill "prompt" (a full cinematic visual description) and "motion":"image" or "video".\n` +
    `- So: of ~${approxBeats} beats, at least ${Math.max(1, approxBeats - 1)} MUST be "graphic".\n\n` +
    `Return JSON ONLY:\n` +
    `{"title":"short title","script":"the full narration","beats":[` +
    `{"line":"exact slice","bottom":"graphic","graphic":{"kind":"iconflow","headline":"WHAT IS AGENTIC AI?","subject":"🤖","caption":"It doesn't just respond — it takes action.","items":[{"label":"GOAL","icon":"goal"},{"label":"PLAN","icon":"plan"},{"label":"TOOLS","icon":"tools"},{"label":"ACTION","icon":"action"}]}},` +
    `{"line":"exact slice","bottom":"broll","prompt":"...","motion":"image"}]}`;

  let json: OnCamDraftShape | null = null;
  try {
    json = await ai.generateJSON<OnCamDraftShape>(prompt, { maxTokens: 6000, temperature: 0.7 });
  } catch {
    json = null;
  }
  const beats = Array.isArray(json?.beats) ? json!.beats.filter((b) => b?.line?.trim()) : [];
  if (beats.length === 0) {
    await patchDraft(id, userId, { draftStatus: "failed", draftError: "The studio couldn't storyboard that. Try a more specific brief." });
    return;
  }

  const built: NarrationShot[] = beats.slice(0, 40).map((b, i) => {
    const line = String(b.line).trim();
    const isGraphic = b.bottom !== "broll" && (b.bottom === "graphic" || !!b.graphic);
    if (isGraphic && b.graphic) {
      const g = b.graphic;
      const kind = (GRAPHIC_KINDS.includes(String(g.kind)) ? g.kind : "keypoints") as ExplainerGraphic["kind"];
      const items = Array.isArray(g.items)
        ? g.items.filter((it) => it?.label?.trim()).slice(0, 5).map((it) => ({
            label: String(it.label).trim().slice(0, 40),
            icon: it.icon && ICON_KEYS.includes(String(it.icon).toLowerCase()) ? String(it.icon).toLowerCase() : undefined,
            sub: it.sub ? String(it.sub).trim().slice(0, 60) : undefined,
          }))
        : undefined;
      const graphic: ExplainerGraphic = {
        kind,
        headline: g.headline ? String(g.headline).trim().slice(0, 60) : undefined,
        subject: g.subject ? String(g.subject).trim().slice(0, 8) : undefined, // one emoji (ZWJ-safe cap)
        caption: g.caption ? String(g.caption).trim().slice(0, 140) : line.slice(0, 140),
        items,
        stat: g.stat?.value ? { value: String(g.stat.value).slice(0, 12), label: g.stat.label ? String(g.stat.label).slice(0, 40) : undefined } : undefined,
      };
      return normalizeShot({ id: rid("shot"), order: i, kind: "image", line, prompt: "", graphic, source: "ai", status: "idle", holdSec: holdForLine(line) }, i);
    }
    // b-roll beat — reuses the existing AI image/video shot engine.
    const motion: ShotKind = b.motion === "video" ? "video" : "image";
    return normalizeShot({ id: rid("shot"), order: i, kind: motion, line, prompt: String(b.prompt || "").trim() || line, graphic: null, source: "ai", status: "idle", holdSec: holdForLine(line) }, i);
  });

  const fresh = await getNarration(id, userId);
  if (!fresh) return;
  fresh.title = (json?.title || fresh.title || "On-camera explainer").slice(0, 160);
  fresh.script = String(json?.script || built.map((s) => s.line).join(" ")).trim();
  fresh.characters = []; // the host is the Avatar IV presenter, not depicted film cast
  fresh.shots = built;
  fresh.draftStatus = "ready";
  fresh.draftError = null;
  await saveNarration(id, userId, fresh);
}

async function patchDraft(id: string, userId: string, patch: Partial<NarrationProject>): Promise<void> {
  const p = await getNarration(id, userId);
  if (!p) return;
  Object.assign(p, patch);
  await saveNarration(id, userId, p).catch(() => {});
}

/** Re-write ONE shot's narration line (and re-time it) without touching the rest. */
export async function rewriteShotLine(
  id: string, userId: string, shotId: string, instruction: string,
): Promise<NarrationProject | null> {
  const p = await getNarration(id, userId);
  if (!p) return null;
  const shot = p.shots.find((s) => s.id === shotId);
  if (!shot) return p;
  try {
    const json = await ai.generateJSON<{ line: string }>(
      `A narrator reads this beat of a ${p.narrationStyle} narration: "${shot.line}".\n` +
      `The surrounding story: "${(p.script || p.brief).slice(0, 900)}".\n` +
      `Rewrite ONLY this beat: ${instruction}.\n` +
      `Keep it spoken-word (one or two short sentences, 6-30 words), same voice, same place in the story. Return JSON: {"line":"..."}`,
      { maxTokens: 400, temperature: 0.7 },
    );
    const line = String(json?.line || "").trim();
    if (!line) return p;
    shot.line = line.slice(0, 1200);
    shot.holdSec = holdForLine(line);
    // The read changed, so the old audio is stale — it re-narrates on next render.
    shot.audioUrl = null;
    shot.audioMs = null;
    p.script = p.shots.map((s) => s.line).join(" ");
    await saveNarration(id, userId, p);
  } catch (err) {
    console.error("[voice-studio] line rewrite failed:", err);
  }
  return getNarration(id, userId);
}
