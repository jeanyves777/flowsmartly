import { prisma } from "@/lib/db/client";
import { SUPPORTED_LANGUAGES, getLanguageLabel } from "@/lib/ai/user-language";
import type { FlowAgentTool } from "../registry";

/**
 * set_preferred_language — change the user's `BrandKit.preferredLanguage`.
 * Every downstream AI surface (the agent itself on the next turn, post
 * generators, caption writer, image/video prompts, business plan, etc.)
 * picks the new language up via getUserPreferredLanguage().
 *
 * Mutating but credit-free — language preference is a setting, not work.
 * Still requires propose_plan because it changes a brand-level setting
 * the user expects to confirm explicitly.
 *
 * If no BrandKit exists yet, this tool creates a minimal one so the
 * preference has somewhere to live (the user can fill out the rest
 * later in /brand). Without this, asking the agent to change language
 * before brand setup would silently fail.
 */
export const setPreferredLanguage: FlowAgentTool = {
  name: "set_preferred_language",
  description:
    "Change the user's preferred AI output language. Persists to BrandKit.preferredLanguage; every AI generation across the platform (captions, posts, images, videos, voice, automations, this agent) starts producing content in the new language from the very next call. Pass `language` as a BCP-47 tag — see meta.supported in this tool's input_schema for the list. Pass `planId` from a confirmed propose_plan.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — planId from a confirmed propose_plan." },
      language: {
        type: "string",
        description:
          "BCP-47 tag. Supported: en, fr, es, pt, pt-BR, de, it, nl, pl, ru, tr, ar, he, zh, zh-TW, ja, ko, hi, bn, id, vi, th.",
      },
    },
    required: ["planId", "language"],
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: true,
  handler: async (input, ctx) => {
    try {
      const language = typeof input.language === "string" ? input.language.trim() : "";
      if (!language) {
        return {
          ok: false,
          error_code: "missing_input",
          message: "language is required (BCP-47 tag like 'fr' or 'pt-BR').",
        };
      }
      const supported = SUPPORTED_LANGUAGES.find((l) => l.tag === language);
      if (!supported) {
        return {
          ok: false,
          error_code: "validation_failed",
          message: `Unsupported language "${language}". Supported tags: ${SUPPORTED_LANGUAGES.map((l) => l.tag).join(", ")}.`,
        };
      }

      // Find the default BrandKit, or fall back to the most recent.
      let kit = await prisma.brandKit.findFirst({
        where: { userId: ctx.userId },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
        select: { id: true, name: true },
      });

      // If the user has no brand kit yet, create a minimal one so the
      // preference has somewhere to live. They can fill out the rest in
      // /brand later — the language setting alone is useful.
      if (!kit) {
        const created = await prisma.brandKit.create({
          data: {
            userId: ctx.userId,
            name: "My Brand",
            isDefault: true,
            preferredLanguage: language,
          },
          select: { id: true, name: true },
        });
        kit = created;
      } else {
        await prisma.brandKit.update({
          where: { id: kit.id },
          data: { preferredLanguage: language },
        });
      }

      return {
        ok: true,
        data: {
          language,
          label: getLanguageLabel(language),
          summary: `Switched output language to ${supported.nativeLabel} (${language}). All future generations will use it. Your next reply from me will be in ${supported.nativeLabel}.`,
          link: "/home/brand",
        },
        resultRefType: "BrandKit",
        resultRefId: kit.id,
      };
    } catch (e) {
      return {
        ok: false,
        error_code: "internal",
        message: e instanceof Error ? e.message : "Failed to set language",
      };
    }
  },
};
