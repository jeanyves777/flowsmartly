/**
 * Lightweight event system for updating the credit display across components.
 *
 * Usage:
 *   // After an AI API call returns creditsRemaining:
 *   import { emitCreditsUpdate } from "@/lib/utils/credits-event";
 *   emitCreditsUpdate(response.creditsRemaining);
 *
 *   // Or just trigger a refetch without a known value:
 *   emitCreditsUpdate();
 *
 *   // Listen (used by dashboard layout):
 *   import { onCreditsUpdate, offCreditsUpdate } from "@/lib/utils/credits-event";
 *   onCreditsUpdate(handler);
 */

const EVENT_NAME = "flowsmartly:credits-updated";

interface CreditsUpdateDetail {
  credits?: number; // If known, set directly; otherwise layout will refetch
}

/** Emit a credit update event. Pass the new balance if known. */
export function emitCreditsUpdate(credits?: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<CreditsUpdateDetail>(EVENT_NAME, {
      detail: { credits },
    })
  );
}

type CreditsHandler = (credits?: number) => void;

/** Subscribe to credit updates. Returns cleanup function. */
export function onCreditsUpdate(handler: CreditsHandler): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => {
    const detail = (e as CustomEvent<CreditsUpdateDetail>).detail;
    handler(detail?.credits);
  };
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}
