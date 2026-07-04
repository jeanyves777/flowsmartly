import { prisma } from "@/lib/db/client";
import { HAIKU_MODEL } from "@/lib/ai/client";

/**
 * SystemSetting keys for the Flow-AI agent's Claude model. Admin-editable via
 * /api/admin/settings (category "ai") so models can change without a deploy:
 *  - ai.agentModel       → the default model for everyone (cheapest: Haiku)
 *  - ai.agentModelSuper  → the model used when the user opts into "Super mode"
 *                          (premium; they pay the AGENT_MESSAGE_SUPER surcharge)
 */
export const AGENT_MODEL_SETTING_KEY = "ai.agentModel";
export const AGENT_MODEL_SUPER_SETTING_KEY = "ai.agentModelSuper";

/** Default Super-mode model (admin can change it in the DB). */
const SUPER_MODEL_DEFAULT = "claude-opus-4-8";

/**
 * The Claude model the Flow-AI agent uses, pulled from the database. Standard
 * defaults to the CHEAPEST model (Haiku) — the standing rule is cheapest by
 * default, never Opus/Sonnet. `superMode` is an explicit, surcharged user opt-in
 * that uses the premium model. Never throws (falls back to the default).
 */
export async function getAgentModel(superMode = false): Promise<string> {
  const key = superMode ? AGENT_MODEL_SUPER_SETTING_KEY : AGENT_MODEL_SETTING_KEY;
  const fallback = superMode ? SUPER_MODEL_DEFAULT : HAIKU_MODEL;
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key }, select: { value: true } });
    const value = row?.value?.trim();
    return value && value.length > 0 ? value : fallback;
  } catch {
    return fallback;
  }
}
