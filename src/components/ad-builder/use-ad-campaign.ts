"use client";

import { useCallback, useState } from "react";
import type {
  CampaignAspectRatio,
  CampaignProvider,
  CampaignState,
  CampaignStyle,
} from "@/lib/story-ad-campaign/types";

// ---------------------------------------------------------------------------
// Phase 1 data layer for the node-canvas Ad Builder. Talks to the SAME
// story-ad-campaign endpoints the working wizard uses, so the canvas drives the
// real pipeline (incl. the multi-angle character turnaround-sheet consistency).
// UI components (Phase 2+) consume this hook; no generation logic lives here.
// ---------------------------------------------------------------------------

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { message?: string; code?: string; required?: number; available?: number };
}

export interface CreateCampaignInput {
  brief: string;
  style?: CampaignStyle;
  aspectRatio?: CampaignAspectRatio;
  provider?: CampaignProvider;
  goal?: string;
  destinationUrl?: string;
}

async function postJson<T>(url: string, body?: unknown, timeoutMs?: number): Promise<ApiEnvelope<T>> {
  const ctrl = timeoutMs ? new AbortController() : undefined;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : undefined;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl?.signal,
    });
    return (await res.json().catch(() => ({ success: false }))) as ApiEnvelope<T>;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function isAbort(e: unknown): boolean {
  return e instanceof DOMException ? e.name === "AbortError" : e instanceof Error && e.name === "AbortError";
}

function errMessage(e: ApiEnvelope<unknown> | unknown, fallback: string): string {
  if (isAbort(e)) return "Timed out — the image service didn't respond. Try again.";
  if (e && typeof e === "object" && "error" in e) {
    const er = (e as ApiEnvelope<unknown>).error;
    if (er?.code === "INSUFFICIENT_CREDITS") {
      return er.message || "Not enough credits.";
    }
    if (er?.message) return er.message;
  }
  if (e instanceof Error) return e.message;
  return fallback;
}

export function useAdCampaign() {
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [state, setState] = useState<CampaignState | null>(null);
  /** human-readable label of the in-flight op, or null when idle */
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (id: string): Promise<CampaignState | null> => {
    const res = await fetch(`/api/ai/story-ad-campaign/${id}`);
    const json = (await res.json().catch(() => ({ success: false }))) as ApiEnvelope<{
      state: CampaignState;
    }>;
    if (json.success && json.data?.state) {
      setState(json.data.state);
      setCampaignId(id);
      return json.data.state;
    }
    return null;
  }, []);

  const create = useCallback(
    async (input: CreateCampaignInput): Promise<string | null> => {
      setBusy("Creating campaign…");
      setError(null);
      try {
        const json = await postJson<{ campaignId: string }>("/api/ai/story-ad-campaign", {
          brief: input.brief,
          style: input.style ?? "cinematic",
          aspectRatio: input.aspectRatio ?? "9:16",
          provider: input.provider ?? "veo3",
          goal: input.goal,
          destinationUrl: input.destinationUrl,
        });
        if (!json.success || !json.data?.campaignId) {
          throw new Error(errMessage(json, "Failed to create campaign"));
        }
        await load(json.data.campaignId);
        return json.data.campaignId;
      } catch (e) {
        setError(errMessage(e, "Failed to create campaign"));
        return null;
      } finally {
        setBusy(null);
      }
    },
    [load],
  );

  /** Save edits to the brief / top-level campaign fields. */
  const patchState = useCallback(
    async (patch: Partial<CampaignState>): Promise<void> => {
      if (!campaignId) return;
      // optimistic
      setState((s) => (s ? { ...s, ...patch } : s));
      const json = await postJsonPatch(`/api/ai/story-ad-campaign/${campaignId}`, { state: patch });
      if (json.success && json.data?.state) setState(json.data.state);
    },
    [campaignId],
  );

  const planCast = useCallback(
    async (count = 4, id = campaignId): Promise<CampaignState | null> => {
      if (!id) return null;
      setBusy("Planning the cast…");
      setError(null);
      try {
        const json = await postJson<{ state: CampaignState }>(
          `/api/ai/story-ad-campaign/${id}/characters`,
          { count },
        );
        if (!json.success || !json.data?.state) throw new Error(errMessage(json, "Failed to plan cast"));
        setState(json.data.state);
        return json.data.state;
      } catch (e) {
        setError(errMessage(e, "Failed to plan cast"));
        return null;
      } finally {
        setBusy(null);
      }
    },
    [campaignId],
  );

  /** Generate a character's turnaround sheet (the consistency anchor). */
  const generateCharacter = useCallback(
    async (characterId: string, id = campaignId): Promise<void> => {
      if (!id) return;
      setError(null);
      // optimistic status so the node spins immediately
      setState((s) =>
        s
          ? {
              ...s,
              characters: s.characters.map((c) =>
                c.id === characterId ? { ...c, previewStatus: "generating", previewError: null } : c,
              ),
            }
          : s,
      );
      try {
        const json = await postJson<{ state: CampaignState }>(
          `/api/ai/story-ad-campaign/${id}/characters/${characterId}/preview`,
          undefined,
          150_000, // image gen should take ~30s; bail at 150s so it can't spin forever
        );
        if (!json.success || !json.data?.state) throw new Error(errMessage(json, "Character generation failed"));
        setState(json.data.state);
      } catch (e) {
        setError(errMessage(e, "Character generation failed"));
        setState((s) =>
          s
            ? {
                ...s,
                characters: s.characters.map((c) =>
                  c.id === characterId ? { ...c, previewStatus: "failed" } : c,
                ),
              }
            : s,
        );
      }
    },
    [campaignId],
  );

  /** Set a character's reference from an uploaded/library image URL. The server
   *  re-hosts it and derives the turnaround sheet from it (best-effort). */
  const setCharacterImage = useCallback(
    async (characterId: string, url: string, id = campaignId): Promise<void> => {
      if (!id) return;
      setError(null);
      setState((s) =>
        s
          ? { ...s, characters: s.characters.map((c) => (c.id === characterId ? { ...c, previewStatus: "generating", previewError: null } : c)) }
          : s,
      );
      try {
        const json = await postJson<{ state: CampaignState }>(
          `/api/ai/story-ad-campaign/${id}/characters/${characterId}/upload-image`,
          { url },
          150_000,
        );
        if (!json.success || !json.data?.state) throw new Error(errMessage(json, "Couldn't set the image"));
        setState(json.data.state);
      } catch (e) {
        setError(errMessage(e, "Couldn't set the image"));
        setState((s) =>
          s ? { ...s, characters: s.characters.map((c) => (c.id === characterId ? { ...c, previewStatus: "failed" } : c)) } : s,
        );
      }
    },
    [campaignId],
  );

  const planScenes = useCallback(
    async (id = campaignId): Promise<CampaignState | null> => {
      if (!id) return null;
      setBusy("Planning scenes…");
      setError(null);
      try {
        const json = await postJson<{ state: CampaignState }>(
          `/api/ai/story-ad-campaign/${id}/scenes`,
        );
        if (!json.success || !json.data?.state) throw new Error(errMessage(json, "Failed to plan scenes"));
        setState(json.data.state);
        return json.data.state;
      } catch (e) {
        setError(errMessage(e, "Failed to plan scenes"));
        return null;
      } finally {
        setBusy(null);
      }
    },
    [campaignId],
  );

  /** Render (or re-render) a single scene clip. Reloads state afterward since the
   *  retry endpoint returns just the clip result, not the whole campaign. */
  const renderClip = useCallback(
    async (clipId: string, id = campaignId): Promise<void> => {
      if (!id) return;
      setError(null);
      setState((s) =>
        s
          ? { ...s, clips: s.clips.map((c) => (c.id === clipId ? { ...c, status: "RENDERING", error: null } : c)) }
          : s,
      );
      try {
        const json = await postJson<{ result: unknown }>(
          `/api/ai/story-ad-campaign/${id}/clips/${clipId}/retry`,
        );
        if (!json.success) throw new Error(errMessage(json, "Scene render failed"));
        await load(id);
      } catch (e) {
        setError(errMessage(e, "Scene render failed"));
        setState((s) =>
          s ? { ...s, clips: s.clips.map((c) => (c.id === clipId ? { ...c, status: "FAILED" } : c)) } : s,
        );
      }
    },
    [campaignId, load],
  );

  /** Edit a scene's action/prompt, persist, and rebuild the render prompt from it. */
  const updateClip = useCallback(
    async (clipId: string, patch: { sceneAction?: string }): Promise<void> => {
      if (!campaignId) return;
      let nextClips: CampaignState["clips"] | null = null;
      setState((s) => {
        if (!s) return s;
        nextClips = s.clips.map((c) => (c.id === clipId ? { ...c, ...patch } : c));
        return { ...s, clips: nextClips };
      });
      if (!nextClips) return;
      const json = await postJsonPatch(`/api/ai/story-ad-campaign/${campaignId}`, {
        state: { clips: nextClips },
        rebuildPrompts: true,
      });
      if (json.success && json.data?.state) setState(json.data.state);
    },
    [campaignId],
  );

  /** Remove a scene clip (free state edit). */
  const removeClip = useCallback(
    async (clipId: string): Promise<void> => {
      if (!campaignId) return;
      const json = await postJson<{ state: CampaignState }>(
        `/api/ai/story-ad-campaign/${campaignId}/clips/manage`,
        { action: "remove", clipId },
      );
      if (json.success && json.data?.state) setState(json.data.state);
    },
    [campaignId],
  );

  /** Render every planned scene, in order. */
  const renderAllScenes = useCallback(
    async (id = campaignId): Promise<void> => {
      if (!id) return;
      const clips = state?.clips ?? [];
      for (const cl of clips) {
        await renderClip(cl.id, id);
      }
    },
    [campaignId, state, renderClip],
  );

  return {
    campaignId,
    state,
    busy,
    error,
    create,
    load,
    patchState,
    planCast,
    generateCharacter,
    setCharacterImage,
    planScenes,
    renderClip,
    updateClip,
    removeClip,
    renderAllScenes,
    clearError: useCallback(() => setError(null), []),
  };
}

async function postJsonPatch(
  url: string,
  body: unknown,
): Promise<ApiEnvelope<{ state: CampaignState }>> {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json().catch(() => ({ success: false }))) as ApiEnvelope<{ state: CampaignState }>;
}
