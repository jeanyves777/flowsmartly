import type { CreditCostKey } from "@/lib/credits/costs";
import type { ToolContext, ToolResult } from "./tool-context";
import type { PlanTier } from "./feature-catalog";

/**
 * Flow-AI tool definition.
 *
 * Each tool is a thin wrapper around an existing internal service or DB
 * query. The handler MUST:
 *  - never throw (catch and return `{ ok: false, error_code, message }`)
 *  - check credits + plan INSIDE the handler (so the LLM gets a chance to
 *    negotiate the failure), not as a pre-LLM gate
 *  - emit progress events via `ctx.emit` for anything that takes >1s
 *
 * See flow-ai-agent-sdk-roadmap memory.
 */
export interface FlowAgentTool {
  /** Tool name as exposed to Claude. snake_case. */
  name: string;
  /** Description Claude reads to decide when to call this tool. */
  description: string;
  /** JSON schema for the input — Claude validates against this. */
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  /** Minimum plan tier. null = available to everyone. */
  plans: PlanTier[] | null;
  /** Credit cost key — looked up in DEFAULT_CREDIT_COSTS / DB pricing. */
  costKey: CreditCostKey;
  /**
   * Mutating tools require a confirmed propose_plan before they can run.
   * Read-only tools (who_am_i, list_features) set this false.
   */
  mutating: boolean;
  /**
   * Handler — returns a ToolResult. Never throws. The agent loop charges
   * credits BEFORE invoking the handler (so a tool that depends on credit
   * deduction succeeds against the real balance).
   */
  handler: (input: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;
}

class ToolRegistry {
  private tools = new Map<string, FlowAgentTool>();

  register(tool: FlowAgentTool): void {
    if (this.tools.has(tool.name)) {
      console.warn(`[flow-agent] Tool already registered: ${tool.name} — overwriting`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): FlowAgentTool | undefined {
    return this.tools.get(name);
  }

  all(): FlowAgentTool[] {
    return Array.from(this.tools.values());
  }

  /** Tools available to build the per-request tool set. The platform moved from
   * plan-gating to full CREDIT-gating — every tool is available to everyone, and
   * access is enforced by credits inside each tool's handler (the `plans` field
   * is retained for metadata but no longer restricts availability). */
  forPlan(_plan: string): FlowAgentTool[] {
    return this.all();
  }
}

export const flowAgentTools = new ToolRegistry();

let initialized = false;

/**
 * Lazy-register all built-in tools. Imported by the API route on first
 * request. Idempotent — safe to call multiple times.
 *
 * New tools: add the import + register() call here.
 */
export async function ensureToolsRegistered(): Promise<void> {
  if (initialized) return;
  initialized = true;

  // Dynamic imports keep the tools tree-shakeable from non-agent contexts
  // and avoid circular-import issues with prisma + cred service.
  const { whoAmI } = await import("./tools/who-am-i");
  const { listMyFeatures } = await import("./tools/list-my-features");
  const { searchFeatures } = await import("./tools/search-features");
  const { getBrandIdentity } = await import("./tools/get-brand-identity");
  const { updateBrandIdentity } = await import("./tools/update-brand-identity");
  const { proposePlan } = await import("./tools/propose-plan");
  const { scheduleSocialPost } = await import("./tools/schedule-social-post");
  const { listScheduledPosts } = await import("./tools/list-scheduled-posts");
  const { cancelScheduledPost } = await import("./tools/cancel-scheduled-post");
  const { generateImage } = await import("./tools/generate-image");
  const { presentDesignTemplates } = await import("./tools/present-design-templates");
  const { askChoice } = await import("./tools/ask-choice");
  const { createBrandedDesign } = await import("./tools/create-branded-design");
  const { addCanvasObject } = await import("./tools/add-canvas-object");
  const { editImage } = await import("./tools/edit-image");
  const { exportImage } = await import("./tools/export-image");
  const { readImage } = await import("./tools/read-image");
  const { generateVideo } = await import("./tools/generate-video");
  const { startStoryAdCampaign } = await import("./tools/start-story-ad-campaign");
  const { listContacts, addContact, updateContact, deleteContact } = await import("./tools/contact-tools");
  const { createEmailCampaign } = await import("./tools/create-email-campaign");
  const { createAutomation } = await import("./tools/create-automation");
  const { listCampaigns, listAutomations } = await import("./tools/list-tools");
  const { sendEmailCampaign } = await import("./tools/send-email-campaign");
  const { updatePost } = await import("./tools/update-post");
  const { getCalendar } = await import("./tools/get-calendar");
  const { updateAutomation } = await import("./tools/update-automation");
  const { getCreditsHistory } = await import("./tools/get-credits-history");
  const { setPreferredLanguage } = await import("./tools/set-preferred-language");
  const { importContactsCsv } = await import("./tools/import-contacts-csv");
  const { deletePost } = await import("./tools/delete-post");
  const { sendTestEmailCampaign } = await import("./tools/send-test-email-campaign");
  const { analyzeUrl } = await import("./tools/analyze-url");
  const { createProposal } = await import("./tools/create-proposal");
  const { createPitch } = await import("./tools/create-pitch");
  const { listVoicesTool } = await import("./tools/list-voices");
  const { generateNarration } = await import("./tools/generate-narration");
  const { createDocument } = await import("./tools/create-document");
  const { buildWebsite } = await import("./tools/build-website");
  const { updateWebsite } = await import("./tools/update-website");
  const { buildStore } = await import("./tools/build-store");
  const { addProduct } = await import("./tools/add-product");
  const { updateProduct } = await import("./tools/update-product");
  const { deleteProduct } = await import("./tools/delete-product");
  const { fulfillOrder } = await import("./tools/fulfill-order");
  const { listConnectedSocials } = await import("./tools/list-connected-socials");
  const { setupLocalPresence } = await import("./tools/setup-local-presence");
  const { updateBusinessListing } = await import("./tools/update-business-listing");
  const { respondToReview } = await import("./tools/respond-to-review");
  const { remember } = await import("./tools/remember");
  const { recall } = await import("./tools/recall");
  const { updateCanvas } = await import("./tools/update-canvas");
  const { webFetch } = await import("./tools/web-fetch");
  // NOTE: web_search is now Anthropic's NATIVE server-side tool
  // (`web_search_20250305`) — registered in agent-loop.ts as a server tool
  // passed directly to the Messages API. Anthropic executes the search on
  // their infra and bakes citations into the assistant turn. The custom
  // Tavily/Brave/Serper handler in ./tools/web-search.ts is intentionally
  // left on disk as dead code in case we ever need a fallback.

  flowAgentTools.register(whoAmI);
  flowAgentTools.register(listMyFeatures);
  flowAgentTools.register(searchFeatures);
  flowAgentTools.register(getBrandIdentity);
  flowAgentTools.register(updateBrandIdentity);
  flowAgentTools.register(proposePlan);
  flowAgentTools.register(scheduleSocialPost);
  flowAgentTools.register(listScheduledPosts);
  flowAgentTools.register(cancelScheduledPost);
  flowAgentTools.register(generateImage);
  // NOTE: list_agent_design_templates (text-only lookup) is intentionally NOT
  // registered — the agent must use present_design_templates so the user gets
  // the clickable VISUAL picker instead of a plain text list.
  flowAgentTools.register(presentDesignTemplates);
  flowAgentTools.register(askChoice);
  flowAgentTools.register(createBrandedDesign);
  flowAgentTools.register(addCanvasObject);
  flowAgentTools.register(editImage);
  flowAgentTools.register(exportImage);
  flowAgentTools.register(readImage);
  flowAgentTools.register(generateVideo);
  flowAgentTools.register(startStoryAdCampaign);
  flowAgentTools.register(listContacts);
  flowAgentTools.register(addContact);
  flowAgentTools.register(updateContact);
  flowAgentTools.register(deleteContact);
  flowAgentTools.register(createEmailCampaign);
  flowAgentTools.register(createAutomation);
  flowAgentTools.register(listCampaigns);
  flowAgentTools.register(listAutomations);
  flowAgentTools.register(sendEmailCampaign);
  flowAgentTools.register(updatePost);
  flowAgentTools.register(getCalendar);
  flowAgentTools.register(updateAutomation);
  flowAgentTools.register(getCreditsHistory);
  flowAgentTools.register(setPreferredLanguage);
  flowAgentTools.register(importContactsCsv);
  flowAgentTools.register(deletePost);
  flowAgentTools.register(sendTestEmailCampaign);
  flowAgentTools.register(analyzeUrl);
  flowAgentTools.register(createProposal);
  flowAgentTools.register(createPitch);
  flowAgentTools.register(listVoicesTool);
  flowAgentTools.register(generateNarration);
  flowAgentTools.register(createDocument);
  flowAgentTools.register(buildWebsite);
  flowAgentTools.register(updateWebsite);
  flowAgentTools.register(buildStore);
  flowAgentTools.register(addProduct);
  flowAgentTools.register(updateProduct);
  flowAgentTools.register(deleteProduct);
  flowAgentTools.register(fulfillOrder);
  flowAgentTools.register(listConnectedSocials);
  flowAgentTools.register(setupLocalPresence);
  flowAgentTools.register(updateBusinessListing);
  flowAgentTools.register(respondToReview);
  flowAgentTools.register(remember);
  flowAgentTools.register(recall);
  flowAgentTools.register(updateCanvas);

  // Web browsing:
  //  - web_fetch    → client tool, always registered (no provider dep)
  //  - web_search   → Anthropic NATIVE server-side tool, joined at the
  //                   API call site in agent-loop.ts (no client handler)
  flowAgentTools.register(webFetch);
}
