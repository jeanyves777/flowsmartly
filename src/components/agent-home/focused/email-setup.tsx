"use client";

import { useState } from "react";
import { Mail, Check, ShieldCheck, Send, AlertTriangle, Server } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * EmailSetupCard — the configuration LANDING that gates the Email surface. A user
 * can't send a campaign until they've connected a sending provider and verified a
 * sender, so this shows FIRST (instead of the campaigns menu) when email isn't
 * set up. It saves the provider + sender in-surface (PATCH /api/marketing-config)
 * then verifies with a real test send (POST …/test-email, which flips
 * emailVerified). No legacy links. [[unprovisioned-feature-shows-cta]]
 */

type Provider = "RESEND" | "SENDGRID" | "MAILGUN" | "SMTP" | "AMAZON_SES";

const PROVIDERS: { v: Provider; label: string; hint: string; fields: { key: string; label: string; type?: string; placeholder?: string }[] }[] = [
  { v: "RESEND", label: "Resend", hint: "Simplest — one API key", fields: [{ key: "apiKey", label: "API key", type: "password", placeholder: "re_..." }] },
  { v: "SENDGRID", label: "SendGrid", hint: "One API key", fields: [{ key: "apiKey", label: "API key", type: "password", placeholder: "SG...." }] },
  { v: "MAILGUN", label: "Mailgun", hint: "API key + domain", fields: [{ key: "apiKey", label: "API key", type: "password" }, { key: "domain", label: "Sending domain", placeholder: "mg.yourdomain.com" }] },
  { v: "SMTP", label: "SMTP", hint: "Any SMTP server", fields: [{ key: "host", label: "Host", placeholder: "smtp.yourhost.com" }, { key: "port", label: "Port", placeholder: "587" }, { key: "user", label: "Username" }, { key: "password", label: "Password", type: "password" }] },
  { v: "AMAZON_SES", label: "Amazon SES", hint: "AWS keys", fields: [{ key: "accessKeyId", label: "Access key ID" }, { key: "secretAccessKey", label: "Secret access key", type: "password" }, { key: "region", label: "Region", placeholder: "us-east-1" }] },
];

const FIELD = "w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60";

export function EmailSetupCard({ onDone }: { onDone: () => void }) {
  const [provider, setProvider] = useState<Provider>("RESEND");
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);

  const def = PROVIDERS.find((p) => p.v === provider)!;
  const credsComplete = def.fields.every((f) => (creds[f.key] || "").trim());
  const canSave = credsComplete && !!fromEmail.trim() && !saving;
  const testTo = testEmail.trim() || fromEmail.trim();

  const pickProvider = (p: Provider) => { setProvider(p); setCreds({}); setSaved(false); setError(""); };

  const save = async () => {
    setSaving(true); setError("");
    try {
      const emailConfig: Record<string, string> = {};
      for (const f of def.fields) emailConfig[f.key] = (creds[f.key] || "").trim();
      const j = await fetch("/api/marketing-config", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailProvider: provider, emailConfig, defaultFromName: fromName.trim() || undefined, defaultFromEmail: fromEmail.trim(), defaultReplyTo: replyTo.trim() || undefined }),
      }).then((r) => r.json());
      if (j?.success) setSaved(true);
      else setError(j?.error?.message || "Couldn’t save your settings.");
    } catch { setError("Couldn’t save your settings."); }
    finally { setSaving(false); }
  };

  const sendTest = async () => {
    if (!testTo) return;
    setTesting(true); setError("");
    try {
      const j = await fetch("/api/marketing-config/test-email", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testEmail: testTo }),
      }).then((r) => r.json());
      if (j?.success) onDone();
      else setError(j?.error?.message || "Test send failed — double-check your credentials.");
    } catch { setError("Test send failed — double-check your credentials."); }
    finally { setTesting(false); }
  };

  return (
    <div className="mx-auto w-full max-w-5xl">
      {/* header */}
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-violet-500/20 text-brand-500"><Mail className="h-6 w-6" /></span>
        <div>
          <h2 className="text-[19px] font-extrabold leading-tight">Set up email sending</h2>
          <p className="text-[13px] text-muted-foreground">Connect a provider and verify a sender — then you can send campaigns.</p>
        </div>
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        {/* LEFT — provider + credentials */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">1 · Sending provider</p>
          <div className="space-y-1.5">
            {PROVIDERS.map((p) => (
              <button key={p.v} onClick={() => pickProvider(p.v)} className={cn("flex w-full items-center gap-3 rounded-[10px] border px-3 py-2.5 text-left transition", provider === p.v ? "border-brand-500 bg-brand-500/10" : "border-border hover:border-brand-500/40")}>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-500/10 text-brand-500"><Server className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold">{p.label}</span>
                  <span className="block text-[11px] text-muted-foreground">{p.hint}</span>
                </span>
                {provider === p.v && <Check className="h-4 w-4 shrink-0 text-brand-500" />}
              </button>
            ))}
          </div>
          <div className="mt-3.5 space-y-2.5 border-t border-border/70 pt-3.5">
            <p className="text-[11.5px] font-semibold text-muted-foreground">{def.label} credentials</p>
            {def.fields.map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-[11.5px] font-semibold">{f.label}</label>
                <input
                  type={f.type || "text"} value={creds[f.key] || ""} placeholder={f.placeholder}
                  onChange={(e) => setCreds((c) => ({ ...c, [f.key]: e.target.value }))}
                  className={FIELD} autoComplete="off"
                />
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — sender + actions */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">2 · Sender</p>
          <div className="space-y-2.5">
            <div>
              <label className="mb-1 block text-[11.5px] font-semibold">From name</label>
              <input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Your brand" className={FIELD} />
            </div>
            <div>
              <label className="mb-1 block text-[11.5px] font-semibold">From email <span className="text-rose-500">*</span></label>
              <input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="hello@yourdomain.com" className={FIELD} autoComplete="off" />
            </div>
            <div>
              <label className="mb-1 block text-[11.5px] font-semibold">Reply-to <span className="text-muted-foreground">(optional)</span></label>
              <input value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder="replies@yourdomain.com" className={FIELD} autoComplete="off" />
            </div>
          </div>

          {error && <p className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-rose-500"><AlertTriangle className="h-3.5 w-3.5" /> {error}</p>}

          {/* actions */}
          {!saved ? (
            <button onClick={save} disabled={!canSave} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[12px] bg-gradient-to-r from-brand-500 to-violet-500 px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-lg shadow-brand-500/30 disabled:opacity-50">
              {saving ? <FlowLoader size={16} tone="white" /> : <Server className="h-4 w-4" />} Save provider
            </button>
          ) : (
            <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5">
              <p className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-emerald-500"><Check className="h-4 w-4" /> Saved — now verify with a test send</p>
              <p className="mt-1 text-[11.5px] text-muted-foreground">We’ll send one test email through {def.label}. When it lands, email is verified and unlocked.</p>
              <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
                <input value={testEmail || fromEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="where to send the test" className={cn(FIELD, "flex-1")} />
                <button onClick={sendTest} disabled={testing || !testTo} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-[12px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-sm disabled:opacity-50">
                  {testing ? <FlowLoader size={15} tone="white" /> : <Send className="h-4 w-4" />} Send test & finish
                </button>
              </div>
            </div>
          )}

          <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> Keys are stored securely and never shown again.</p>
        </div>
      </div>
    </div>
  );
}
