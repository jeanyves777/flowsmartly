"use client";

import { createContext, useContext } from "react";

/**
 * Client-side navigation bridge for agent cards. When the agent chat renders
 * inside the agent-home shell, "Open" buttons on task cards should switch the
 * focused surface IN PLACE (no full-page reload) instead of doing an `<a href>`
 * hard navigation that remounts the whole SPA. agent-home provides a handler
 * that parses an in-app href (e.g. `/home/campaign?campaign=<id>`) and opens the
 * matching surface; it returns true when it handled the link so the caller can
 * `preventDefault`. Elsewhere (widget/shell) the context is null and the plain
 * link is followed as before. [[agent-writes-into-ui-element-not-chat]]
 */
export type AgentNav = (href: string) => boolean;

export const AgentNavContext = createContext<AgentNav | null>(null);

export function useAgentNav(): AgentNav | null {
  return useContext(AgentNavContext);
}
