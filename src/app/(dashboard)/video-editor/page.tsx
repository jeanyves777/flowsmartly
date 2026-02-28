"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useVideoStore } from "@/components/video-studio/hooks/use-video-store";
import { resetHistory } from "@/components/video-studio/hooks/use-video-history";
import { PageLoader } from "@/components/shared/page-loader";
import type { SerializedVideoProject } from "@/lib/video-editor/types";

// Dynamic import to avoid SSR with Fabric.js
const VideoStudioLayout = dynamic(
  () =>
    import("@/components/video-studio/video-studio-layout").then(
      (m) => m.VideoStudioLayout
    ),
  {
    ssr: false,
    loading: () => (
      <PageLoader
        tips={[
          "Loading video editor...",
          "Preparing timeline...",
          "Setting up canvas...",
        ]}
      />
    ),
  }
);

export default function VideoEditorPage() {
  const searchParams = useSearchParams();
  const projectIdParam = searchParams.get("id");
  const presetParam = searchParams.get("preset");

  const {
    isDirty,
    setDirty,
    projectId,
    setProjectId,
    setProject,
    hydrate,
    reset,
  } = useVideoStore();

  const [isLoaded, setIsLoaded] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const periodicSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Load existing project ─────────────────────────────────

  useEffect(() => {
    async function loadProject() {
      if (projectIdParam) {
        try {
          const res = await fetch(`/api/designs/${projectIdParam}`);
          if (res.ok) {
            const data = await res.json();
            const design = data.data?.design || data.design;
            if (design?.canvasData) {
              const parsed = JSON.parse(design.canvasData) as SerializedVideoProject;
              if (parsed._videoProject) {
                hydrate({
                  project: { ...parsed.project, id: design.id },
                  tracks: parsed.tracks,
                  clips: parsed.clips,
                  captionSettings: parsed.captionSettings,
                });
                setProjectId(design.id);
                setProject({ name: design.name || "Untitled Video" });
              }
            }
          }
        } catch (err) {
          console.error("[VideoEditor] Failed to load project:", err);
        }
      } else {
        // New project — apply preset if given (e.g., "1920x1080")
        reset();
        if (presetParam) {
          const [w, h] = presetParam.split("x").map(Number);
          if (w && h) {
            const ratio =
              w > h ? "16:9" : w < h ? "9:16" : "1:1";
            setProject({ width: w, height: h, aspectRatio: ratio });
          }
        }
      }
      resetHistory();
      setIsLoaded(true);
    }

    loadProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectIdParam]);

  // ─── Save handler ──────────────────────────────────────────

  const handleSave = useCallback(async () => {
    const store = useVideoStore.getState();
    if (!store.isDirty) return;

    const serialized: SerializedVideoProject = {
      _videoProject: true,
      project: store.project,
      tracks: store.tracks,
      clips: store.clips,
      captionSettings: store.captionSettings,
    };

    const body = {
      name: store.project.name,
      category: "video",
      size: `${store.project.width}x${store.project.height}`,
      canvasData: JSON.stringify(serialized),
      type: "video_project",
    };

    try {
      let res: Response;
      if (store.projectId) {
        res = await fetch(`/api/designs/${store.projectId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch("/api/designs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, prompt: "Video project" }),
        });
      }

      if (res.ok) {
        const data = await res.json();
        const newId = data.data?.design?.id || data.design?.id || store.projectId;
        if (newId && !store.projectId) {
          setProjectId(newId);
          // Update URL without navigation
          window.history.replaceState(null, "", `/video-editor?id=${newId}`);
        }
        setDirty(false);
      }
    } catch (err) {
      console.error("[VideoEditor] Save failed:", err);
    }
  }, [setDirty, setProjectId]);

  // ─── Auto-save: 30s debounce + 2-min periodic ─────────────

  useEffect(() => {
    if (!isLoaded) return;

    // Debounced save on dirty
    if (isDirty) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(handleSave, 30_000);
    }

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [isDirty, handleSave, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;

    // Periodic safety-net save every 2 minutes
    periodicSaveRef.current = setInterval(() => {
      if (useVideoStore.getState().isDirty) {
        handleSave();
      }
    }, 120_000);

    return () => {
      if (periodicSaveRef.current) clearInterval(periodicSaveRef.current);
    };
  }, [handleSave, isLoaded]);

  // ─── Save on custom event ──────────────────────────────────

  useEffect(() => {
    const onSave = () => handleSave();
    window.addEventListener("video-studio:save", onSave);
    return () => window.removeEventListener("video-studio:save", onSave);
  }, [handleSave]);

  // ─── Unsaved changes warning ───────────────────────────────

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (useVideoStore.getState().isDirty) {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  if (!isLoaded) {
    return (
      <PageLoader
        tips={[
          "Loading video editor...",
          "Preparing timeline...",
          "Setting up canvas...",
        ]}
      />
    );
  }

  return <VideoStudioLayout onSave={handleSave} />;
}
