"use client";

import { useState } from "react";

/**
 * Visitor email-verification gate. Two variants:
 *  - variant="view": a full-screen block shown INSTEAD of the page content
 *    when the owner requires email verification to view.
 *  - variant="download": a modal opened on demand (from the Download button)
 *    when only downloads are gated.
 * On success it reloads so the server re-reads the fresh access cookie.
 */
export function PortfolioGate({
  slug,
  ownerName,
  accent,
  variant,
  open = true,
  onClose,
}: {
  slug: string;
  ownerName: string;
  accent: string;
  variant: "view" | "download";
  open?: boolean;
  onClose?: () => void;
}) {
  const [step, setStep] = useState<"email" | "code" | "done">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (variant === "download" && !open) return null;

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/pf/${slug}/request-code`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Could not send a code.");
      setStep("code");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/pf/${slug}/verify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Verification failed.");
      setStep("done");
      setTimeout(() => window.location.reload(), 650);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const grad = `linear-gradient(135deg, ${accent}, ${accent})`;
  const card = (
    <div
      style={{
        width: "100%",
        maxWidth: 430,
        background: "#fff",
        color: "#1b2330",
        borderRadius: 18,
        padding: 26,
        boxShadow: "0 30px 80px rgba(0,0,0,.35)",
        textAlign: "center",
      }}
    >
      {step === "email" && (
        <>
          <div style={{ height: 54, width: 54, borderRadius: 15, margin: "0 auto 14px", display: "grid", placeItems: "center", background: grad, color: "#fff", fontSize: 24 }}>✉</div>
          <div style={{ display: "inline-flex", gap: 6, fontSize: 11.5, fontWeight: 700, color: accent, background: `${accent}1a`, borderRadius: 999, padding: "5px 12px", marginBottom: 14 }}>
            🔒 Requested by <b>{ownerName}</b>
          </div>
          <h3 style={{ margin: "0 0 5px", fontSize: 20, fontWeight: 900 }}>
            {variant === "download" ? "Verify your email to download" : "Verify your email to continue"}
          </h3>
          <p style={{ margin: "0 0 15px", fontSize: 12.5, color: "#67707d", lineHeight: 1.55 }}>
            Enter your email and we'll send a 6-digit code — no account needed. Your email is shared with the owner as a contact.
          </p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            style={{ width: "100%", border: "1.5px solid #dfe3ea", borderRadius: 11, padding: "12px 13px", fontSize: 14, outline: "none", textAlign: "center" }}
          />
          {error && <p style={{ color: "#dc2626", fontSize: 12, margin: "10px 0 0" }}>{error}</p>}
          <button onClick={sendCode} disabled={busy} style={btn(grad, busy)}>
            {busy ? "Sending…" : "Send me a code →"}
          </button>
          <div style={{ marginTop: 14, fontSize: 11, color: "#9aa2af" }}>Protected by FlowSmartly · no spam, ever</div>
        </>
      )}

      {step === "code" && (
        <>
          <div style={{ height: 54, width: 54, borderRadius: 15, margin: "0 auto 14px", display: "grid", placeItems: "center", background: grad, color: "#fff", fontSize: 24 }}>🔑</div>
          <h3 style={{ margin: "0 0 5px", fontSize: 20, fontWeight: 900 }}>Enter your code</h3>
          <p style={{ margin: "0 0 15px", fontSize: 12.5, color: "#67707d", lineHeight: 1.55 }}>
            We sent a 6-digit code to <b>{email}</b>.
          </p>
          <input
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="••••••"
            style={{ width: "100%", border: "1.5px solid #dfe3ea", borderRadius: 11, padding: "12px 13px", fontSize: 22, letterSpacing: 8, fontWeight: 800, outline: "none", textAlign: "center" }}
          />
          {error && <p style={{ color: "#dc2626", fontSize: 12, margin: "10px 0 0" }}>{error}</p>}
          <button onClick={verify} disabled={busy || code.length !== 6} style={btn(grad, busy || code.length !== 6)}>
            {busy ? "Verifying…" : `Verify & ${variant === "download" ? "download" : "continue"} →`}
          </button>
          <div style={{ marginTop: 14, fontSize: 11, color: "#9aa2af" }}>
            <span onClick={() => { setStep("email"); setError(null); }} style={{ cursor: "pointer", textDecoration: "underline" }}>change email</span>
          </div>
        </>
      )}

      {step === "done" && (
        <>
          <div style={{ height: 54, width: 54, borderRadius: 15, margin: "0 auto 14px", display: "grid", placeItems: "center", background: "linear-gradient(135deg,#10b981,#059669)", color: "#fff", fontSize: 24 }}>✓</div>
          <h3 style={{ margin: "0 0 5px", fontSize: 20, fontWeight: 900 }}>You're verified</h3>
          <p style={{ margin: 0, fontSize: 12.5, color: "#67707d" }}>Unlocking…</p>
        </>
      )}
    </div>
  );

  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    display: "grid",
    placeItems: "center",
    background: "rgba(8,10,14,.62)",
    backdropFilter: "blur(7px)",
    zIndex: 60,
    padding: 22,
  };

  return (
    <div style={overlayStyle} onClick={variant === "download" ? onClose : undefined}>
      <div onClick={(e) => e.stopPropagation()}>{card}</div>
    </div>
  );
}

function btn(grad: string, disabled: boolean): React.CSSProperties {
  return {
    width: "100%",
    border: 0,
    borderRadius: 11,
    background: grad,
    color: "#fff",
    fontWeight: 800,
    fontSize: 14,
    padding: 12,
    marginTop: 11,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.7 : 1,
  };
}
