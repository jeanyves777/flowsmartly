/**
 * LEGACY ADVERTISING SHUTDOWN
 *
 * This backend is a disposable beta being replaced. Its advertising control
 * plane does not work: `pauseOnAllChannels` is defined and called from nowhere,
 * budget changes never reach the provider, and all three `syncStats` functions
 * only `console.log`. Reported ad state and provider ad state can diverge with
 * nothing to reconcile them.
 *
 * No ad provider credential is currently configured, so nothing can spend today
 * — the defects are latent. This guard exists so they stay latent: it makes the
 * legacy portal read-only for advertising, and adding a credential can no
 * longer quietly turn a broken control plane into real money.
 *
 * WHAT IS BLOCKED — anything that starts or increases spend:
 *   campaign creation · launch/activation · budget changes · auto-optimisation
 *
 * WHAT IS NOT BLOCKED — anything that stops spend:
 *   pause · deactivate · read
 *
 * That asymmetry is deliberate and is the whole safety property. A shutdown
 * that also disabled pausing would trap money in a system nobody can steer.
 */

/** Shutdown date, for the record. */
export const LEGACY_ADS_DISABLED_ON = "2026-08-05";

const MUTATIONS_ENABLED = () => process.env.LEGACY_ADS_MUTATIONS_ENABLED === "true";

export class LegacyAdsDisabledError extends Error {
  readonly code = "LEGACY_ADS_DISABLED";
  constructor(operation: string) {
    super(
      `Advertising changes are turned off on this workspace (${operation}). ` +
        `Existing campaigns can still be paused. Advertising returns in the new system, ` +
        `where a change is not recorded as done until the ad platform confirms it.`,
    );
    this.name = "LegacyAdsDisabledError";
  }
}

/**
 * Call at the top of any operation that starts or increases spend.
 * Throws rather than returning a flag: a spend-increasing call must not be able
 * to continue by ignoring a return value.
 */
export function assertAdMutationsAllowed(operation: string): void {
  if (MUTATIONS_ENABLED()) return;
  throw new LegacyAdsDisabledError(operation);
}

/** Non-throwing form, for UI that wants to disable a control rather than fail. */
export function adMutationsDisabled(): boolean {
  return !MUTATIONS_ENABLED();
}
