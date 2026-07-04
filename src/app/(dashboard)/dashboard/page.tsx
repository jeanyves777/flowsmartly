import { redirect } from "next/navigation";

/**
 * Legacy dashboard home — RETIRED. The live product is the new agent-first
 * workspace at /home, so this route now just forwards there. Every remaining
 * "/dashboard" link (verify-email, the legacy flow-ai widget, agent/apply, etc.)
 * funnels through here into the new system. [[new-design-no-legacy]]
 */
export default function DashboardRedirect() {
  redirect("/home");
}
