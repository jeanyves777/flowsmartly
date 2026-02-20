/**
 * Lightweight event system for updating the plan display across components.
 *
 * Usage:
 *   // After a successful plan upgrade:
 *   import { emitPlanUpdate } from "@/lib/utils/plan-event";
 *   emitPlanUpdate("PRO");
 *
 *   // Listen (used by dashboard layout):
 *   import { onPlanUpdate } from "@/lib/utils/plan-event";
 *   useEffect(() => onPlanUpdate(handler), []);
 */

const EVENT_NAME = "flowsmartly:plan-updated";

/** Emit a plan update event with the new plan ID. */
export function emitPlanUpdate(plan: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<{ plan: string }>(EVENT_NAME, { detail: { plan } })
  );
}

type PlanHandler = (plan: string) => void;

/** Subscribe to plan updates. Returns cleanup function. */
export function onPlanUpdate(handler: PlanHandler): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => {
    const detail = (e as CustomEvent<{ plan: string }>).detail;
    handler(detail.plan);
  };
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}
