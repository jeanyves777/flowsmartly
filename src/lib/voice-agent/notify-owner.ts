/**
 * Emails the business owner what the phone agent captured on a call — a booking
 * request or a message. This is the safety net under every booking method: no
 * matter how the business books (share a link, a connected scheduler, or
 * auto-book), the owner always gets the full details in their inbox.
 *
 * The recipient is the agent's `bookingNotifyEmail` if set, otherwise the owner's
 * account email. Best-effort: it never throws into a live call — a failed send is
 * logged and the call continues (the outcome is still on the transcript).
 */

import { prisma } from "@/lib/db/client";
import { sendEmail } from "@/lib/email/core";

const esc = (v: string) =>
  v.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] || c);

export async function notifyOwner(opts: {
  userId: string;
  agentId?: string;
  agentName?: string;
  kind: "booking" | "message";
  /** [label, value] rows — empty values are dropped. */
  lines: Array<[string, string]>;
  note?: string;
}): Promise<{ ok: boolean; to?: string }> {
  try {
    const [user, agent] = await Promise.all([
      prisma.user.findUnique({ where: { id: opts.userId }, select: { email: true } }),
      opts.agentId
        ? prisma.voiceAgent.findUnique({ where: { id: opts.agentId }, select: { bookingNotifyEmail: true, name: true } })
        : Promise.resolve(null),
    ]);
    const to = (agent?.bookingNotifyEmail || user?.email || "").trim();
    if (!to) return { ok: false };

    const agentName = opts.agentName || agent?.name || "your phone agent";
    const title = opts.kind === "booking" ? "New appointment request" : "New phone message";
    const rows = opts.lines.filter(([, v]) => v && v.trim());
    const subjectTail = rows.length ? ` — ${rows[0][1]}` : "";

    const rowsHtml = rows
      .map(
        ([k, v]) =>
          `<tr><td style="padding:7px 16px 7px 0;color:#64748b;font-weight:600;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:7px 0;color:#0f172a">${esc(v).replace(/\n/g, "<br>")}</td></tr>`,
      )
      .join("");
    const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px">
      <h2 style="margin:0 0 4px;font-size:18px;color:#0f172a">${esc(title)}</h2>
      <p style="margin:0 0 18px;color:#64748b;font-size:13px">Captured by ${esc(agentName)} on a phone call.</p>
      <table style="border-collapse:collapse;font-size:14px;line-height:1.5">${rowsHtml}</table>
      ${opts.note ? `<p style="margin:18px 0 0;color:#334155;font-size:13px">${esc(opts.note)}</p>` : ""}
    </div>`;
    const text =
      `${title} (captured by ${agentName})\n\n` +
      rows.map(([k, v]) => `${k}: ${v}`).join("\n") +
      (opts.note ? `\n\n${opts.note}` : "");

    const res = await sendEmail({ to, subject: `${title}${subjectTail}`, html, text });
    return { ok: !!res.success, to };
  } catch (e) {
    console.error("[notify-owner] failed:", e);
    return { ok: false };
  }
}
