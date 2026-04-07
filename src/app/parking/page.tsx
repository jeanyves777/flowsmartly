import { headers } from "next/headers";

export default async function ParkingPage() {
  const headersList = await headers();
  const domain = headersList.get("x-custom-domain") || "this domain";

  return (
    <html lang="en">
      <head>
        <title>{domain} — Coming Soon</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ margin: 0, padding: 0, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
        <div style={{ textAlign: "center", padding: "40px 24px", maxWidth: 600 }}>
          {/* Animated construction icon */}
          <div style={{ fontSize: 64, marginBottom: 24 }}>
            🚧
          </div>

          {/* Domain name */}
          <h1 style={{ fontSize: 36, fontWeight: 800, margin: "0 0 8px", letterSpacing: "-0.5px" }}>
            {domain}
          </h1>

          {/* Status */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 24, padding: "6px 16px", margin: "16px 0 24px", fontSize: 14, color: "#93c5fd" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6", display: "inline-block", animation: "pulse 2s infinite" }} />
            Under Construction
          </div>

          <p style={{ fontSize: 18, color: "#94a3b8", lineHeight: 1.6, margin: "0 0 32px" }}>
            We&apos;re building something amazing. This website is being set up and will be live soon.
          </p>

          {/* Powered by */}
          <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            <p style={{ fontSize: 12, color: "#64748b" }}>
              Powered by{" "}
              <a href="https://flowsmartly.com" style={{ color: "#3b82f6", textDecoration: "none", fontWeight: 600 }}>
                FlowSmartly
              </a>
            </p>
          </div>
        </div>

        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}} />
      </body>
    </html>
  );
}
