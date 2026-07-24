"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useParams } from "next/navigation";

/**
 * Public, hosted SMS opt-in page for a business (/optin/<slug>). A visitor enters
 * their phone and checks an explicit, unchecked consent box → we record an
 * opted-in Contact. This is the documented opt-in flow carriers (A2P 10DLC)
 * require to see, and the real consent needed to send marketing SMS.
 */

interface Business {
  businessName: string;
  website: string | null;
  privacyPolicyUrl: string | null;
  termsOfServiceUrl: string | null;
  optOutMessage: string;
  logo: string | null;
  accent: string;
}

export default function OptInPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const [biz, setBiz] = useState<Business | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/optin/${slug}`)
      .then((r) => r.json())
      .then((j) => { if (j?.success) setBiz(j.data); else setNotFound(true); })
      .catch(() => setNotFound(true));
  }, [slug]);

  const submit = useCallback(async () => {
    setError("");
    if (!consent) { setError("Please check the box to agree to receive text messages."); return; }
    if (!phone.trim()) { setError("Enter your mobile phone number."); return; }
    setBusy(true);
    try {
      const j = await fetch(`/api/optin/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), firstName: firstName.trim() || undefined, consent: true }),
      }).then((r) => r.json());
      if (j?.success) setDone(true);
      else setError(j?.error?.message || "Something went wrong. Please try again.");
    } catch { setError("Something went wrong. Please try again."); }
    finally { setBusy(false); }
  }, [consent, phone, firstName, slug]);

  if (notFound) {
    return (
      <main style={S.page}>
        <div style={S.card}><p style={{ color: "#475569", textAlign: "center" }}>This opt-in page isn&apos;t available.</p></div>
      </main>
    );
  }
  if (!biz) {
    return <main style={S.page}><div style={S.card}><p style={{ color: "#94a3b8", textAlign: "center" }}>Loading…</p></div></main>;
  }

  const accent = biz.accent || "#2563eb";

  return (
    <main style={S.page}>
      <div style={S.card}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          {biz.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={biz.logo} alt={biz.businessName} style={{ height: 48, margin: "0 auto 10px", objectFit: "contain" }} />
          ) : (
            <div style={{ ...S.badge, background: accent }}>{biz.businessName.slice(0, 1).toUpperCase()}</div>
          )}
          <h1 style={S.title}>Get text updates from {biz.businessName}</h1>
          <p style={S.sub}>Sales, new arrivals, and account updates — straight to your phone.</p>
        </div>

        {done ? (
          <div style={{ textAlign: "center", padding: "18px 0" }}>
            <div style={{ ...S.badge, background: "#16a34a", margin: "0 auto 12px" }}>✓</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", margin: "0 0 6px" }}>You&apos;re signed up!</h2>
            <p style={{ color: "#475569", fontSize: 14 }}>You&apos;ll start receiving texts from {biz.businessName}. {biz.optOutMessage}</p>
          </div>
        ) : (
          <>
            <label style={S.label}>First name <span style={{ color: "#94a3b8", fontWeight: 400 }}>(optional)</span></label>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jordan" style={S.input} />

            <label style={S.label}>Mobile phone number</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="(555) 123-4567" style={S.input} />

            <label style={S.consent}>
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3, width: 18, height: 18, flex: "none", accentColor: accent }} />
              <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "#475569" }}>
                By checking this box, I agree to receive recurring automated marketing text messages (e.g. promotions and updates)
                from <b style={{ color: "#0f172a" }}>{biz.businessName}</b> at the phone number provided. Consent is not a condition of
                purchase. Message frequency varies. Msg &amp; data rates may apply. Reply <b>STOP</b> to unsubscribe or <b>HELP</b> for help.
                {(biz.privacyPolicyUrl || biz.termsOfServiceUrl) && (
                  <>{" "}See our{" "}
                    {biz.privacyPolicyUrl && <a href={biz.privacyPolicyUrl} target="_blank" rel="noreferrer" style={{ color: accent }}>Privacy Policy</a>}
                    {biz.privacyPolicyUrl && biz.termsOfServiceUrl && " & "}
                    {biz.termsOfServiceUrl && <a href={biz.termsOfServiceUrl} target="_blank" rel="noreferrer" style={{ color: accent }}>Terms</a>}.
                  </>
                )}
              </span>
            </label>

            {error && <p style={{ color: "#dc2626", fontSize: 13, margin: "0 0 10px" }}>{error}</p>}

            <button onClick={() => void submit()} disabled={busy} style={{ ...S.button, background: accent, opacity: busy ? 0.6 : 1 }}>
              {busy ? "Signing you up…" : "Sign me up for texts"}
            </button>
            <p style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", margin: "12px 0 0" }}>
              Msg &amp; data rates may apply. Reply STOP to opt out, HELP for help.
            </p>
          </>
        )}
      </div>
      <p style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", marginTop: 16 }}>
        {biz.website ? <a href={biz.website} target="_blank" rel="noreferrer" style={{ color: "#94a3b8" }}>{biz.website.replace(/^https?:\/\//, "")}</a> : biz.businessName}
      </p>
    </main>
  );
}

const S: Record<string, CSSProperties> = {
  page: { minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f1f5f9", padding: 20, fontFamily: "-apple-system, Segoe UI, Roboto, Arial, sans-serif" },
  card: { width: "100%", maxWidth: 420, background: "#fff", borderRadius: 18, boxShadow: "0 10px 40px rgba(15,23,42,.1)", padding: 26 },
  badge: { width: 48, height: 48, borderRadius: 12, display: "grid", placeItems: "center", color: "#fff", fontSize: 22, fontWeight: 800 },
  title: { fontSize: 20, fontWeight: 800, color: "#0f172a", margin: "0 0 4px" },
  sub: { fontSize: 13.5, color: "#64748b", margin: 0 },
  label: { display: "block", fontSize: 12, fontWeight: 700, color: "#334155", margin: "14px 0 5px" },
  input: { width: "100%", boxSizing: "border-box", borderRadius: 10, border: "1px solid #cbd5e1", padding: "11px 12px", fontSize: 15, outline: "none", color: "#0f172a" },
  consent: { display: "flex", gap: 9, alignItems: "flex-start", margin: "16px 0 14px", cursor: "pointer" },
  button: { width: "100%", border: "none", borderRadius: 11, padding: "13px", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" },
};
