import { prisma } from "@/lib/db/client";
import type { FlowAgentTool } from "../registry";

/**
 * Contact management tools — list_contacts (read-only) and add_contact
 * (single create, mutating). Bulk CSV import lives in a separate tool
 * (Phase 3) because it's long-running and goes through a background task.
 *
 * Per feedback-no-stuck-ai-chat: duplicate-email / duplicate-phone cases
 * return structured errors the agent can read and respond to ("looks like
 * Jean is already in your list — want to update them instead?"), not
 * generic 400s.
 */

export const listContacts: FlowAgentTool = {
  name: "list_contacts",
  description:
    "List the user's contacts (CRM-style). Read-only. Optional filters: search query (matches email/firstName/lastName/phone), status, opted-in channel. Returns up to `limit` rows (default 20, max 100). Use BEFORE add_contact to check for duplicates and BEFORE create_email_campaign / create_automation so you can suggest a contact-list size for the user.",
  input_schema: {
    type: "object",
    properties: {
      search: { type: "string", description: "Free-text query — matches email / name / phone substring." },
      limit: { type: "number", description: "Max rows (1-100, default 20)." },
      onlyOptedIn: { type: "string", description: "'email', 'sms', or omit. Filters to contacts opted in to that channel." },
    },
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: false,
  handler: async (input, ctx) => {
    try {
      const search = typeof input.search === "string" ? input.search.trim() : "";
      const limit =
        typeof input.limit === "number"
          ? Math.min(100, Math.max(1, Math.floor(input.limit)))
          : 20;
      const onlyOptedIn = typeof input.onlyOptedIn === "string" ? input.onlyOptedIn : null;

      const where: Record<string, unknown> = {
        userId: ctx.userId,
        status: "ACTIVE",
      };
      if (onlyOptedIn === "email") where.emailOptedIn = true;
      if (onlyOptedIn === "sms") where.smsOptedIn = true;
      if (search) {
        where.OR = [
          { email: { contains: search } },
          { phone: { contains: search } },
          { firstName: { contains: search } },
          { lastName: { contains: search } },
        ];
      }

      const [contacts, total] = await Promise.all([
        prisma.contact.findMany({
          where,
          orderBy: { updatedAt: "desc" },
          take: limit,
          select: {
            id: true,
            email: true,
            phone: true,
            firstName: true,
            lastName: true,
            birthday: true,
            emailOptedIn: true,
            smsOptedIn: true,
            tags: true,
          },
        }),
        prisma.contact.count({ where }),
      ]);

      return {
        ok: true,
        data: {
          totalMatching: total,
          returned: contacts.length,
          contacts: contacts.map((c) => ({
            id: c.id,
            email: c.email,
            phone: c.phone,
            name: [c.firstName, c.lastName].filter(Boolean).join(" ") || null,
            birthday: c.birthday,
            emailOptedIn: c.emailOptedIn,
            smsOptedIn: c.smsOptedIn,
            tags: safeArray(c.tags),
          })),
        },
      };
    } catch (e) {
      return {
        ok: false,
        error_code: "internal",
        message: e instanceof Error ? e.message : "Failed to list contacts",
      };
    }
  },
};

export const addContact: FlowAgentTool = {
  name: "add_contact",
  description:
    "Add a single contact to the user's CRM. At least one of email or phone is required. Mutating — pass `planId` from a confirmed propose_plan. Returns the contact id. If an existing contact has the same email or phone, returns a structured error with the existing contact id so you can suggest updating instead of creating.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — planId from a confirmed propose_plan." },
      email: { type: "string", description: "Contact email." },
      phone: { type: "string", description: "Contact phone in E.164 format (+15551234567)." },
      firstName: { type: "string" },
      lastName: { type: "string" },
      birthday: { type: "string", description: "Optional, MM-DD format ('06-15' = June 15) — drives birthday automations." },
      tags: { type: "array", items: { type: "string" }, description: "Free-form tags for segmentation." },
      emailOptedIn: { type: "boolean", description: "Default true if email is provided." },
      smsOptedIn: { type: "boolean", description: "Default true if phone is provided." },
    },
    required: ["planId"],
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: true,
  handler: async (input, ctx) => {
    try {
      const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
      const phone = typeof input.phone === "string" ? input.phone.trim() : "";
      if (!email && !phone) {
        return {
          ok: false,
          error_code: "missing_input",
          message: "Need at least an email or a phone. Ask the user which they have.",
        };
      }
      if (input.birthday !== undefined && input.birthday !== null && input.birthday !== "") {
        const bd = String(input.birthday);
        if (!/^\d{2}-\d{2}$/.test(bd)) {
          return {
            ok: false,
            error_code: "validation_failed",
            message: `birthday must be MM-DD format (e.g. "06-15" for June 15), got "${bd}".`,
          };
        }
      }

      if (email) {
        const dupe = await prisma.contact.findUnique({
          where: { userId_email: { userId: ctx.userId, email } },
          select: { id: true },
        });
        if (dupe) {
          return {
            ok: false,
            error_code: "validation_failed",
            message: `A contact with email "${email}" already exists (id: ${dupe.id}). Suggest updating that one instead.`,
            meta: { existingContactId: dupe.id, conflictField: "email" },
          };
        }
      }
      if (phone) {
        const dupe = await prisma.contact.findUnique({
          where: { userId_phone: { userId: ctx.userId, phone } },
          select: { id: true },
        });
        if (dupe) {
          return {
            ok: false,
            error_code: "validation_failed",
            message: `A contact with phone "${phone}" already exists (id: ${dupe.id}). Suggest updating that one instead.`,
            meta: { existingContactId: dupe.id, conflictField: "phone" },
          };
        }
      }

      const tags = Array.isArray(input.tags)
        ? input.tags.filter((t): t is string => typeof t === "string" && t.trim().length > 0)
        : [];

      const emailOptedIn = typeof input.emailOptedIn === "boolean" ? input.emailOptedIn : !!email;
      const smsOptedIn = typeof input.smsOptedIn === "boolean" ? input.smsOptedIn : !!phone;

      const contact = await prisma.contact.create({
        data: {
          userId: ctx.userId,
          email: email || null,
          phone: phone || null,
          firstName: typeof input.firstName === "string" ? input.firstName : null,
          lastName: typeof input.lastName === "string" ? input.lastName : null,
          birthday: typeof input.birthday === "string" ? input.birthday : null,
          tags: JSON.stringify(tags),
          emailOptedIn,
          emailOptedInAt: emailOptedIn ? new Date() : null,
          smsOptedIn,
          smsOptedInAt: smsOptedIn ? new Date() : null,
        },
        select: { id: true },
      });

      return {
        ok: true,
        data: {
          contactId: contact.id,
          name: [input.firstName, input.lastName].filter(Boolean).join(" ") || email || phone,
          summary: `Added contact: ${email || phone}`,
          link: `/contacts`,
        },
        resultRefType: "Contact",
        resultRefId: contact.id,
      };
    } catch (e) {
      return {
        ok: false,
        error_code: "internal",
        message: e instanceof Error ? e.message : "Failed to add contact",
      };
    }
  },
};

function safeArray(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}
