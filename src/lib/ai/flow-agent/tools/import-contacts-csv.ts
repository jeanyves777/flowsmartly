import { prisma } from "@/lib/db/client";
import { buildImportedContactData } from "@/lib/contacts/contact-intake";
import type { FlowAgentTool } from "../registry";
import { spawnBackgroundTask, publishTaskEvent } from "../job-state";
import { notifyAgentTaskComplete } from "../notify-task-complete";

/**
 * import_contacts_csv — bulk-add contacts from a CSV string. Runs as a
 * background task because parses + inserts of 10k rows take real time.
 *
 * Two ways to pass the data:
 *   - `csvText`: the raw CSV content as a string (preferred for small
 *     pastes the user dropped into chat)
 *   - `csvUrl`: a fetchable URL — agent uploads + provides the link
 *
 * The CSV format is permissive — first row is the header. We auto-map
 * common header variations (email/e-mail/Email, phone/mobile/cell,
 * first_name/firstname/First Name, etc.). Unknown columns become
 * customFields keys.
 *
 * Dedupe: rows that match an existing contact by email OR phone are
 * SKIPPED (not updated). The summary tells the user the skip count so
 * they can re-import explicitly if they want to overwrite.
 *
 * Mutating, requires confirmed propose_plan. Cost: 1 credit per imported
 * row (not per attempted row — skipped duplicates don't charge).
 */
export const importContactsCsv: FlowAgentTool = {
  name: "import_contacts_csv",
  description:
    "Bulk import contacts from a CSV string. First row must be a header. Recognized columns: email, phone, firstName, lastName, birthday (MM-DD), company, city, state, address, tags (comma-separated inside the cell). Unknown columns become customFields. Runs as a background task — returns a taskId immediately and notifies on completion. Duplicates (by email OR phone) are SKIPPED, not overwritten. Pass `planId` from a confirmed propose_plan. Cost: 1 credit per imported row.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — planId from a confirmed propose_plan." },
      csvText: {
        type: "string",
        description: "CSV content as a string. Up to 1 MB. First row = header. Use this when the user pasted CSV into chat.",
      },
      csvUrl: {
        type: "string",
        description: "Alternative to csvText: a fetchable URL that returns CSV. Up to 1 MB once downloaded.",
      },
      tagAll: {
        type: "string",
        description: "Optional — apply this tag to every imported contact (e.g. 'newsletter-signup-2026'). Stacks with any tags in the CSV row.",
      },
    },
    required: ["planId"],
  },
  plans: null,
  // 1 cr / imported row charged inside the worker (not the registry flat fee).
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: true,
  handler: async (input, ctx) => {
    try {
      const csvText = typeof input.csvText === "string" ? input.csvText : "";
      const csvUrl = typeof input.csvUrl === "string" ? input.csvUrl.trim() : "";
      if (!csvText && !csvUrl) {
        return {
          ok: false,
          error_code: "missing_input",
          message: "Either csvText or csvUrl is required.",
        };
      }
      const tagAll =
        typeof input.tagAll === "string" && input.tagAll.trim() ? input.tagAll.trim() : null;

      const taskId = await spawnBackgroundTask({
        userId: ctx.userId,
        conversationId: ctx.conversationId,
        messageId: ctx.messageId,
        kind: "import_contacts_csv",
        input: { tagAll, source: csvUrl ? "url" : "inline" },
        worker: async (taskId) => {
          publishTaskEvent({ type: "progress", taskId, progress: 5, message: "Loading CSV…" });

          let raw = csvText;
          if (!raw && csvUrl) {
            const fetchRes = await fetch(csvUrl, { redirect: "follow" });
            if (!fetchRes.ok) {
              throw new Error(`Failed to download CSV: ${fetchRes.status} ${fetchRes.statusText}`);
            }
            raw = await fetchRes.text();
          }
          if (raw.length > 1_000_000) {
            throw new Error(`CSV is ${raw.length} bytes — keep under 1 MB.`);
          }

          publishTaskEvent({ type: "progress", taskId, progress: 15, message: "Parsing rows…" });
          const { headers, rows } = parseCsv(raw);
          if (headers.length === 0) {
            throw new Error("CSV header row is empty.");
          }
          if (rows.length === 0) {
            throw new Error("CSV has no data rows.");
          }

          const headerMap = mapHeaders(headers);

          let imported = 0;
          let skipped = 0;
          let invalid = 0;
          const errors: string[] = [];

          const TOTAL = rows.length;
          for (let i = 0; i < TOTAL; i++) {
            const row = rows[i];
            const parsed = parseRow(row, headerMap);
            if (!parsed.email && !parsed.phone) {
              invalid++;
              continue;
            }

            // Dedupe by email/phone — skip if either matches an existing.
            const where: Array<Record<string, unknown>> = [];
            if (parsed.email) where.push({ email: parsed.email });
            if (parsed.phone) where.push({ phone: parsed.phone });
            const existing = await prisma.contact.findFirst({
              where: { userId: ctx.userId, OR: where },
              select: { id: true },
            });
            if (existing) {
              skipped++;
              continue;
            }

            const tags = parsed.tags ? [...parsed.tags] : [];
            if (tagAll && !tags.includes(tagAll)) tags.push(tagAll);

            try {
              // Identical to the HTTP import route: a CSV containing a
              // channel is not the recipient's agreement to be written to.
              await prisma.contact.create({
                data: {
                  ...buildImportedContactData({
                    userId: ctx.userId,
                    email: parsed.email,
                    phone: parsed.phone,
                    firstName: parsed.firstName,
                    lastName: parsed.lastName,
                    birthday: parsed.birthday,
                    company: parsed.company,
                    city: parsed.city,
                    state: parsed.state,
                    address: parsed.address,
                    tags,
                  }),
                  customFields: parsed.customFields ? JSON.stringify(parsed.customFields) : "{}",
                },
              });
              imported++;
            } catch (err) {
              invalid++;
              if (errors.length < 10) {
                errors.push(
                  `Row ${i + 2}: ${err instanceof Error ? err.message : "insert failed"}`,
                );
              }
            }

            // Throttle progress events — every 25 rows or 5%, whichever larger.
            if (i % Math.max(25, Math.floor(TOTAL / 20)) === 0) {
              publishTaskEvent({
                type: "progress",
                taskId,
                progress: Math.min(95, Math.round(20 + (75 * i) / TOTAL)),
                message: `Importing ${i + 1} / ${TOTAL}…`,
              });
            }
          }

          publishTaskEvent({ type: "progress", taskId, progress: 98, message: "Finalizing…" });

          await notifyAgentTaskComplete({
            userId: ctx.userId,
            taskId,
            kind: "import_contacts_csv",
            ok: imported > 0,
            summary: `Contact import done — added ${imported}, skipped ${skipped}, invalid ${invalid}. Imported contacts are NOT opted in to email or SMS; consent has to be collected from them.`,
            detail: errors.length > 0 ? `First few errors: ${errors.slice(0, 3).join("; ")}` : undefined,
            deepLink: `/home/outreach`,
          });

          return {
            output: {
              imported,
              skipped,
              invalid,
              totalRows: TOTAL,
              sampleErrors: errors.slice(0, 10),
            },
            resultRefType: "ContactImport",
            resultRefId: taskId,
          };
        },
      });

      ctx.emit({
        type: "task_started",
        taskId,
        kind: "import_contacts_csv",
        summary: `Importing contacts in the background. I'll notify you when it's done.`,
      });

      return {
        ok: true,
        data: {
          taskId,
          userMessage: `Started CSV import in the background. The user can leave the chat — I'll notify them with how many contacts were added vs skipped vs invalid.`,
        },
      };
    } catch (e) {
      return {
        ok: false,
        error_code: "internal",
        message: e instanceof Error ? e.message : "Failed to start contact import",
      };
    }
  },
};

// ─── CSV parser ─────────────────────────────────────────────────────
// Minimal RFC 4180-ish parser: handles quoted fields, escaped quotes
// (""), commas inside quotes, and \r\n + \n line endings. Doesn't try
// to do dialect detection — we expect comma-delimited.

function parseCsv(input: string): { headers: string[]; rows: string[][] } {
  const rows: string[][] = [];
  let current: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        current.push(cell);
        cell = "";
      } else if (ch === "\n") {
        current.push(cell);
        cell = "";
        rows.push(current);
        current = [];
      } else if (ch === "\r") {
        // skip — handled by \n
      } else {
        cell += ch;
      }
    }
  }
  if (cell !== "" || current.length > 0) {
    current.push(cell);
    rows.push(current);
  }
  const headers = rows.shift() ?? [];
  return { headers: headers.map((h) => h.trim()), rows };
}

function mapHeaders(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((header, i) => {
    const k = normalizeHeader(header);
    if (!k) return;
    if (k === "email" || k === "emailaddress" || k === "e-mail") map.email = i;
    else if (k === "phone" || k === "mobile" || k === "cell" || k === "phonenumber") map.phone = i;
    else if (k === "firstname" || k === "first" || k === "given" || k === "givenname") map.firstName = i;
    else if (k === "lastname" || k === "last" || k === "family" || k === "surname") map.lastName = i;
    else if (k === "name" || k === "fullname") map.fullName = i;
    else if (k === "birthday" || k === "birth" || k === "dob") map.birthday = i;
    else if (k === "company" || k === "organization" || k === "org" || k === "business") map.company = i;
    else if (k === "city") map.city = i;
    else if (k === "state" || k === "province" || k === "region") map.state = i;
    else if (k === "address" || k === "street") map.address = i;
    else if (k === "tags" || k === "tag" || k === "labels") map.tags = i;
    else map[`custom:${header}`] = i;
  });
  return map;
}

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/[\s_\-.]/g, "")
    .trim();
}

interface ParsedRow {
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  birthday: string | null;
  company: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  tags: string[] | null;
  customFields: Record<string, string> | null;
}

function parseRow(row: string[], map: Record<string, number>): ParsedRow {
  const cell = (i: number | undefined): string | null => {
    if (i === undefined) return null;
    const v = row[i];
    if (v === undefined || v === null) return null;
    const trimmed = String(v).trim();
    return trimmed.length > 0 ? trimmed : null;
  };
  const email = cell(map.email)?.toLowerCase() ?? null;
  const phone = cell(map.phone);
  let firstName = cell(map.firstName);
  let lastName = cell(map.lastName);
  const fullName = cell(map.fullName);
  if (!firstName && !lastName && fullName) {
    const parts = fullName.split(/\s+/);
    firstName = parts[0] ?? null;
    lastName = parts.length > 1 ? parts.slice(1).join(" ") : null;
  }
  const birthdayRaw = cell(map.birthday);
  // Accept MM-DD, MM/DD, or YYYY-MM-DD (strip year)
  let birthday: string | null = null;
  if (birthdayRaw) {
    const m = birthdayRaw.match(/(?:\d{4}[\-/])?(\d{1,2})[\-/](\d{1,2})/);
    if (m) {
      const mm = String(parseInt(m[1], 10)).padStart(2, "0");
      const dd = String(parseInt(m[2], 10)).padStart(2, "0");
      if (parseInt(mm, 10) >= 1 && parseInt(mm, 10) <= 12 && parseInt(dd, 10) >= 1 && parseInt(dd, 10) <= 31) {
        birthday = `${mm}-${dd}`;
      }
    }
  }
  const tagsRaw = cell(map.tags);
  const tags = tagsRaw
    ? tagsRaw
        .split(/[,;|]/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
    : null;
  const customFields: Record<string, string> = {};
  for (const [k, i] of Object.entries(map)) {
    if (k.startsWith("custom:")) {
      const v = cell(i);
      if (v) customFields[k.slice("custom:".length)] = v;
    }
  }
  return {
    email,
    phone,
    firstName,
    lastName,
    birthday,
    company: cell(map.company),
    city: cell(map.city),
    state: cell(map.state),
    address: cell(map.address),
    tags,
    customFields: Object.keys(customFields).length > 0 ? customFields : null,
  };
}
