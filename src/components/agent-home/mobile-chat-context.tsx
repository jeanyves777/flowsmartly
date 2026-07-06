"use client";

import { createContext, useContext } from "react";

/**
 * Mobile "collect via chat" bridge. On DESKTOP the studios fill data in the UI
 * (brief modals / settings) → call the agent → render live. On MOBILE there is
 * NO UI data-fill: tapping a create/plan/improve action instead SEEDS the chat
 * composer with an editable starter (the user edits + sends) and the agent
 * collects the inputs conversationally. See memory desktop-ui-fill-mobile-chat.
 *
 * Any focused surface consumes `useMobileChat()`: if `isMobile`, call
 * `seedComposer(starter)` instead of opening its modal.
 */
export interface MobileChatValue {
  /** True below the `md` breakpoint (phones). */
  isMobile: boolean;
  /** Pre-fill the focused chat composer with `text` and reveal it (mobile). */
  seedComposer: (text: string) => void;
}

const MobileChatContext = createContext<MobileChatValue | null>(null);

export const MobileChatProvider = MobileChatContext.Provider;

/** Safe default (no-op) so surfaces used OUTSIDE the shell (e.g. the standalone
 *  /ad-builder route) never crash — there, it simply behaves as desktop. */
export function useMobileChat(): MobileChatValue {
  return useContext(MobileChatContext) ?? { isMobile: false, seedComposer: () => {} };
}
