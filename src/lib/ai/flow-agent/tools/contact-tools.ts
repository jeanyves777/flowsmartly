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

      // Absence is not agreement: an unspecified flag means false, never
      // "they have an address, so they must have agreed". Whether the explicit
      // boolean should count as consent is a separate, open question.
      const emailOptedIn = input.emailOptedIn === true;
      const smsOptedIn = input.smsOptedIn === true;

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
          link: `/home/outreach`,
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

// ── update_contact / delete_contact ──────────────────────────────────────────

interface ContactLite { id: string; firstName: string | null; lastName: string | null; email: string | null; phone: string | null; }
type Resolved = { ok: true; contact: ContactLite } | { ok: false; message: string };

const trimStr = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const hasKey = (input: Record<string, unknown>, k: string) => Object.prototype.hasOwnProperty.call(input, k);
const fullName = (c: ContactLite) => [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email || c.phone || "contact";

/** Find a contact by id, else by an email/phone/name `match` string. */
async function resolveContact(userId: string, input: Record<string, unknown>): Promise<Resolved> {
  const select = { id: true, firstName: true, lastName: true, email: true, phone: true } as const;
  const contactId = trimStr(input.contactId);
  if (contactId) {
    const c = await prisma.contact.findFirst({ where: { id: contactId, userId }, select });
    return c ? { ok: true, contact: c } : { ok: false, message: `No contact with id ${contactId}.` };
  }
  const match = trimStr(input.match);
  if (!match) return { ok: false, message: "Provide contactId or a `match` (email, phone, or name) to identify the contact." };

  if (match.includes("@")) {
    const c = await prisma.contact.findUnique({ where: { userId_email: { userId, email: match.toLowerCase() } }, select });
    if (c) return { ok: true, contact: c };
  }
  if (/^\+?[\d\s().-]{6,}$/.test(match)) {
    const c = await prisma.contact.findUnique({ where: { userId_phone: { userId, phone: match } }, select });
    if (c) return { ok: true, contact: c };
  }
  // Name (or unmatched email/phone) → scan and match in JS (DB-agnostic).
  const all = await prisma.contact.findMany({ where: { userId }, select, take: 500, orderBy: { updatedAt: "desc" } });
  const q = match.toLowerCase();
  const hit = (c: ContactLite) =>
    fullName(c).toLowerCase() === q || (c.email && c.email.toLowerCase() === q) || (c.phone && c.phone === match);
  const exact = all.filter(hit);
  const contains = exact.length ? exact : all.filter((c) => fullName(c).toLowerCase().includes(q) || (c.email && c.email.toLowerCase().includes(q)) || (c.phone && c.phone.includes(match)));
  if (contains.length === 0) return { ok: false, message: `No contact matching "${match}".` };
  if (contains.length > 1) return { ok: false, message: `Multiple contacts match "${match}": ${contains.slice(0, 10).map(fullName).join(", ")}. Ask the user which one (or pass contactId).` };
  return { ok: true, contact: contains[0] };
}

async function recountContactList(listId: string): Promise<void> {
  const [total, active] = await Promise.all([
    prisma.contactListMember.count({ where: { contactListId: listId } }),
    prisma.contactListMember.count({ where: { contactListId: listId, contact: { status: "ACTIVE" } } }),
  ]);
  await prisma.contactList.update({ where: { id: listId }, data: { totalCount: total, activeCount: active } }).catch(() => {});
}

export const updateContact: FlowAgentTool = {
  name: "update_contact",
  description:
    "Update an existing contact in the user's CRM — name, email, phone, company, location, birthday, tags, opt-in, or status. Identify the contact by `contactId` or `match` (an email, phone, or name to find them). Pass ONLY the fields that change. To unsubscribe someone set status 'UNSUBSCRIBED'; to re-activate set 'ACTIVE'. Pass `planId` from a confirmed propose_plan. Free.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — planId from a confirmed propose_plan." },
      contactId: { type: "string", description: "Contact id, if known." },
      match: { type: "string", description: "Email, phone, or name to locate the contact when contactId isn't known." },
      email: { type: "string", description: "New email." },
      phone: { type: "string", description: "New phone (E.164, +15551234567)." },
      firstName: { type: "string" },
      lastName: { type: "string" },
      company: { type: "string" },
      city: { type: "string" },
      state: { type: "string" },
      address: { type: "string" },
      birthday: { type: "string", description: "MM-DD (e.g. '06-15')." },
      tags: { type: "array", items: { type: "string" }, description: "Replaces the contact's tags." },
      emailOptedIn: { type: "boolean" },
      smsOptedIn: { type: "boolean" },
      status: { type: "string", description: "'ACTIVE' or 'UNSUBSCRIBED'." },
    },
    required: ["planId"],
  },
  plans: null,
  costKey: "AGENT_UPDATE_CONTACT",
  mutating: true,
  handler: async (input, ctx) => {
    try {
      const resolved = await resolveContact(ctx.userId, input);
      if (!resolved.ok) return { ok: false, error_code: "validation_failed", message: resolved.message };
      const c = resolved.contact;

      const data: Record<string, unknown> = {};
      const changed: string[] = [];

      if (hasKey(input, "email")) {
        const email = trimStr(input.email).toLowerCase();
        if (email && email !== c.email) {
          const dupe = await prisma.contact.findFirst({ where: { userId: ctx.userId, email, id: { not: c.id } }, select: { id: true } });
          if (dupe) return { ok: false, error_code: "validation_failed", message: `Another contact already has email "${email}".` };
        }
        data.email = email || null; changed.push("email");
      }
      if (hasKey(input, "phone")) {
        const phone = trimStr(input.phone);
        if (phone && phone !== c.phone) {
          const dupe = await prisma.contact.findFirst({ where: { userId: ctx.userId, phone, id: { not: c.id } }, select: { id: true } });
          if (dupe) return { ok: false, error_code: "validation_failed", message: `Another contact already has phone "${phone}".` };
        }
        data.phone = phone || null; changed.push("phone");
      }
      if (hasKey(input, "birthday")) {
        const bd = trimStr(input.birthday);
        if (bd && !/^\d{2}-\d{2}$/.test(bd)) return { ok: false, error_code: "validation_failed", message: `birthday must be MM-DD (e.g. "06-15"), got "${bd}".` };
        data.birthday = bd || null; changed.push("birthday");
      }
      for (const f of ["firstName", "lastName", "company", "city", "state", "address"]) {
        if (hasKey(input, f)) { data[f] = trimStr(input[f]) || null; changed.push(f); }
      }
      if (hasKey(input, "tags") && Array.isArray(input.tags)) {
        data.tags = JSON.stringify(input.tags.filter((t): t is string => typeof t === "string" && t.trim().length > 0)); changed.push("tags");
      }
      if (hasKey(input, "emailOptedIn") && typeof input.emailOptedIn === "boolean") { data.emailOptedIn = input.emailOptedIn; changed.push("email opt-in"); }
      if (hasKey(input, "smsOptedIn") && typeof input.smsOptedIn === "boolean") { data.smsOptedIn = input.smsOptedIn; changed.push("SMS opt-in"); }
      if (hasKey(input, "status")) {
        const s = trimStr(input.status).toUpperCase();
        if (!["ACTIVE", "UNSUBSCRIBED"].includes(s)) return { ok: false, error_code: "validation_failed", message: "status must be ACTIVE or UNSUBSCRIBED." };
        data.status = s;
        data.unsubscribedAt = s === "UNSUBSCRIBED" ? new Date() : null;
        changed.push("status");
      }

      if (Object.keys(data).length === 0) {
        return { ok: false, error_code: "missing_input", message: "No fields to change. Provide at least one of: email, phone, name, tags, status, etc." };
      }

      await prisma.contact.update({ where: { id: c.id }, data });
      return {
        ok: true,
        data: { contactId: c.id, updatedFields: changed, summary: `Updated ${fullName({ ...c, ...(data.firstName !== undefined || data.lastName !== undefined ? { firstName: (data.firstName as string) ?? c.firstName, lastName: (data.lastName as string) ?? c.lastName } : {}) })} (${changed.join(", ")}). Confirm to the user in ONE short sentence.`, link: "/home/outreach" },
        resultRefType: "Contact",
        resultRefId: c.id,
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to update contact" };
    }
  },
};

export const deleteContact: FlowAgentTool = {
  name: "delete_contact",
  description:
    "Permanently remove a contact from the user's CRM. Identify by `contactId` or `match` (email, phone, or name). Use this only when the user wants the contact GONE — to merely stop emailing/texting them, prefer update_contact with status 'UNSUBSCRIBED'. Pass `planId` from a confirmed propose_plan. Free.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — planId from a confirmed propose_plan." },
      contactId: { type: "string", description: "Contact id, if known." },
      match: { type: "string", description: "Email, phone, or name to locate the contact when contactId isn't known." },
    },
    required: ["planId"],
  },
  plans: null,
  costKey: "AGENT_DELETE_CONTACT",
  mutating: true,
  handler: async (input, ctx) => {
    try {
      const resolved = await resolveContact(ctx.userId, input);
      if (!resolved.ok) return { ok: false, error_code: "validation_failed", message: resolved.message };
      const c = resolved.contact;

      const memberships = await prisma.contactListMember.findMany({ where: { contactId: c.id }, select: { contactListId: true } });
      await prisma.contact.delete({ where: { id: c.id } });
      await Promise.all([...new Set(memberships.map((m) => m.contactListId))].map((id) => recountContactList(id)));

      return {
        ok: true,
        data: { contactId: c.id, summary: `Removed ${fullName(c)} from your contacts. Confirm to the user in ONE short sentence.`, link: "/home/outreach" },
        resultRefType: "Contact",
        resultRefId: c.id,
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to delete contact" };
    }
  },
};
