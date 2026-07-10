/**
 * Video Director — CAST.
 *
 * Restores the story-ad cast step for the unified film pipeline: the director
 * casts real characters from the brief, each gets a clean portrait + a
 * multi-angle turnaround sheet (identity-preserving image-to-image), the user
 * APPROVES them, and the approved sheets are fed into every AI shot as reference
 * images so the same person appears across shots. Persists on the film JSON —
 * no DB migration. [[video-director-studio]]
 */

import { ai } from "@/lib/ai/client";
import { prisma } from "@/lib/db/client";
import { getFilm, saveFilm } from "./store";
import { normalizeCharacter, type FilmCharacter, type FilmProject } from "./types";
import { generateImageXaiFirst, editImagesXaiFirst } from "@/lib/ai/image-router";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { sanitizeUserError } from "@/lib/ai/user-error";

function rid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

async function brandName(userId: string): Promise<string> {
  const kit = await prisma.brandKit.findFirst({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    select: { name: true, industry: true },
  }).catch(() => null);
  return [kit?.name, kit?.industry].filter(Boolean).join(" · ") || "the brand";
}

const is3d = (style?: string | null) => style === "3d";

function styleLook(style?: string | null): string {
  return is3d(style)
    ? "Premium Pixar/Disney-grade 3D ANIMATION render: expressive stylized character, soft global illumination, subsurface scattering, polished CGI surfaces, cinematic 3D lighting."
    : "PHOTOREAL live-action still, shot on a professional cinema camera (ARRI Alexa, 85mm, shallow depth of field): a REAL human PHOTOGRAPH with real skin texture (visible pores, fine detail), real hair and real fabric, natural film lighting and colour. This is a photograph of a real person — a live-action film still.";
}

/** For cinematic/live-action, hard-negative the model's default drift to CGI. */
function antiStyleNegative(style?: string | null): string {
  return is3d(style)
    ? "- Must read as polished 3D animation — NOT a live-action photo."
    : "- PHOTOREAL ONLY: this MUST look like a real photograph of a real human. It must NOT be a 3D render, CGI, Pixar/Disney-style animation, video-game character, illustration, cartoon, anime, painting, or any stylized art. No plastic/rendered skin.";
}

function portraitPrompt(c: FilmCharacter, style: string | null | undefined, brand: string): string {
  return `Single clean CHARACTER PORTRAIT for a ${is3d(style) ? "3D-animated" : "live-action cinematic"} film — the anchor used to lock this person's identity across every shot.

CHARACTER
- Name: ${c.name}
- Role: ${c.role}
- Description: ${c.description}

STYLE (critical — hold this exactly)
${styleLook(style)}

FRAMING
- One person only, head-and-shoulders to three-quarter body, front/three-quarter angle, neutral confident expression, plain seamless studio backdrop, even flattering lighting.

HARD RULES
${antiStyleNegative(style)}
- No text, labels, captions, watermark, UI, logo. No other people, no props beyond wardrobe.
- Tonal brand context only (do NOT draw a logo): ${brand}.`;
}

function sheetPrompt(c: FilmCharacter, style: string | null | undefined, brand: string): string {
  return `Character TURNAROUND SHEET — recreate the EXACT person in the provided image (identical face, skin tone, hair, build, wardrobe). This is a turnaround of THAT person, do not invent a new face.

CHARACTER (the SAME person in every pose)
- Name: ${c.name} — Role: ${c.role}
- ${c.description}

STYLE (critical — hold this exactly, matching the reference image)
${styleLook(style)}

LAYOUT (ONE landscape image showing the SAME person MULTIPLE times)
- Three SEPARATE full-body standing poses of the identical person, side by side left-to-right: (1) FRONT view, (2) THREE-QUARTER view, (3) SIDE PROFILE view — three distinct figures of the same person, evenly spaced, consistent scale.
- PLUS one head-and-shoulders face CLOSE-UP in the top corner.
- This is a model turnaround: clearly THREE full-body poses + a close-up in one frame — NOT a single figure. Even flat studio lighting, plain seamless light-grey backdrop, identical wardrobe/hair/proportions in every pose.

HARD RULES
${antiStyleNegative(style)}
- No text, labels, captions, measurement lines, grid, watermark, UI, logo. No other different people (all poses are the SAME person).
- Tonal brand context only (do NOT draw a logo): ${brand}.`;
}

/**
 * Plan the cast from the film's brief + style (free). Saves 2–6 characters onto
 * the film and returns it. Idempotent-ish: re-planning replaces the cast only if
 * none have been previewed/approved yet.
 */
export async function planFilmCast(filmId: string, userId: string): Promise<FilmProject | null> {
  const film = await getFilm(filmId, userId);
  if (!film) return null;
  const brief = film.brief.trim();
  if (!brief) return film;

  // Don't wipe a cast the user has already worked on.
  if ((film.characters || []).some((c) => c.previewStatus === "ready" || c.approved)) return film;

  const brand = await brandName(userId);
  let planned: { name?: string; role?: string; description?: string }[] = [];
  try {
    const json = await ai.generateJSON<{ characters: { name: string; role: string; description: string }[] }>(
      `You are a casting director for a ${film.targetSeconds}s ${film.style || "cinematic"} film. Brief: "${brief}".\n` +
      `Cast 2-6 REAL HUMAN characters that dramatize this brief (the people actually on screen). Give each an ORIGINAL first+last name (never the brand name), a short ROLE (who they are in the story), and a vivid one-line VISUAL DESCRIPTION (age range, look, wardrobe, vibe) detailed enough to render the same person every shot. Brand for tone only: ${brand}.\n` +
      `Return JSON: {"characters":[{"name":"...","role":"...","description":"..."}, ...]}.`,
      { maxTokens: 1200, temperature: 0.7 },
    );
    planned = Array.isArray(json?.characters) ? json.characters.slice(0, 6) : [];
  } catch {
    planned = [];
  }
  if (planned.length === 0) {
    planned = [{ name: "Alex Rivera", role: "Lead", description: "A relatable 30s professional, warm and grounded, smart-casual wardrobe." }];
  }

  const characters: FilmCharacter[] = planned.map((p, i) =>
    normalizeCharacter({ id: rid("ch"), name: p.name, role: p.role, description: p.description, previewStatus: "idle", approved: false }, i),
  );
  film.characters = characters;
  await saveFilm(filmId, userId, film);
  return film;
}

/** Fetch a URL into a Buffer (for deriving a sheet from an uploaded portrait). */
async function toBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function uploadCastImage(base64: string, format: string, filmId: string, c: FilmCharacter, suffix: string): Promise<string> {
  const buffer = Buffer.from(base64, "base64");
  const ext = format === "jpeg" ? "jpg" : format;
  const safe = c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30) || "character";
  const key = `director/${filmId}/cast/${safe}-${suffix}-${rid("i")}.${ext}`;
  return uploadToS3(key, buffer, format === "jpeg" ? "image/jpeg" : `image/${format}`);
}

/**
 * Generate a character's portrait + turnaround sheet (charged by the caller).
 * When `baseImageUrl` is given (the user uploaded/picked a photo) the portrait IS
 * that image and only the sheet is derived from it. Saves onto the film. Never
 * throws — marks the character failed with a sanitized message instead.
 */
export async function generateFilmCharacterPreview(
  filmId: string,
  userId: string,
  characterId: string,
  opts: { baseImageUrl?: string | null } = {},
): Promise<FilmProject | null> {
  const film = await getFilm(filmId, userId);
  if (!film) return null;
  const idx = (film.characters || []).findIndex((c) => c.id === characterId);
  if (idx < 0) return film;

  const setChar = async (patch: Partial<FilmCharacter>) => {
    const f = await getFilm(filmId, userId);
    if (!f) return;
    const i = (f.characters || []).findIndex((c) => c.id === characterId);
    if (i < 0) return;
    f.characters![i] = normalizeCharacter({ ...f.characters![i], ...patch }, i);
    await saveFilm(filmId, userId, f);
  };

  await setChar({ previewStatus: "generating", previewError: null });
  const c = film.characters![idx];
  const brand = await brandName(userId);

  try {
    // 1) Portrait = anchor (uploaded image, else generated).
    let portraitUrl: string;
    let portraitBuffer: Buffer;
    if (opts.baseImageUrl) {
      portraitBuffer = await toBuffer(opts.baseImageUrl);
      portraitUrl = opts.baseImageUrl;
    } else {
      // Fast + cheap path (Nano Banana / Grok) — the strong photoreal prompt keeps
      // cinematic characters realistic without the slow, pricey gpt-image route.
      const res = await generateImageXaiFirst(portraitPrompt(c, film.style, brand), 1024, 1280, {
        quality: "high",
        transparent: false,
      });
      if (!res.base64) throw new Error("no image returned");
      portraitBuffer = Buffer.from(res.base64, "base64");
      portraitUrl = await uploadCastImage(res.base64, res.format, filmId, c, "portrait");
    }

    // 2) Turnaround sheet derived from the portrait (identity-preserving). Best-effort.
    let sheetUrl: string | null = null;
    try {
      const sheet = await editImagesXaiFirst(sheetPrompt(c, film.style, brand), [portraitBuffer], 1536, 1024, {
        intent: "identity",
        quality: "high",
      });
      if (sheet.base64) sheetUrl = await uploadCastImage(sheet.base64, sheet.format, filmId, c, "sheet");
    } catch (err) {
      console.warn("[video-director] character sheet failed; portrait-only anchor:", err);
    }

    await setChar({ referenceImageUrl: portraitUrl, characterSheetUrl: sheetUrl, previewStatus: "ready", previewError: null, approved: false });
  } catch (err) {
    console.error("[video-director] character preview failed:", err);
    await setChar({ previewStatus: "failed", previewError: sanitizeUserError(err, "image") });
  }
  return getFilm(filmId, userId);
}

/** Patch a character (approve / rename / attach an uploaded image). Free. */
export async function patchFilmCharacter(
  filmId: string,
  userId: string,
  characterId: string,
  patch: Partial<FilmCharacter>,
): Promise<FilmProject | null> {
  const film = await getFilm(filmId, userId);
  if (!film) return null;
  const i = (film.characters || []).findIndex((c) => c.id === characterId);
  if (i < 0) return film;
  // Any content edit revokes approval — the user must re-approve what they see.
  const revokes = ("name" in patch || "role" in patch || "description" in patch || "referenceImageUrl" in patch || "characterSheetUrl" in patch) && !("approved" in patch);
  film.characters![i] = normalizeCharacter({ ...film.characters![i], ...patch, ...(revokes ? { approved: false } : {}) }, i);
  await saveFilm(filmId, userId, film);
  return film;
}

/** The approved cast's reference images (sheet preferred, else portrait) — fed
 *  into AI shots so the same people appear across the film. Up to 3. */
export function approvedCastReferences(film: FilmProject): string[] {
  return (film.characters || [])
    .filter((c) => c.approved)
    .map((c) => c.characterSheetUrl || c.referenceImageUrl)
    .filter((u): u is string => !!u)
    .slice(0, 3);
}
