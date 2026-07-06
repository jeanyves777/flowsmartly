"use client";

import { useState } from "react";
import { PortfolioGate } from "./portfolio-gate";

/**
 * Download action for a public portfolio. When downloads are gated behind email
 * verification (and the visitor isn't verified yet), clicking opens the gate;
 * after verifying, the page reloads and this renders a real download link.
 */
export function PortfolioDownload({
  slug,
  ownerName,
  accent,
  gated,
  fileUrl,
  label = "Download PDF résumé",
}: {
  slug: string;
  ownerName: string;
  accent: string;
  gated: boolean;
  fileUrl: string | null;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!fileUrl) return null;

  const style: React.CSSProperties = {
    display: "inline-block",
    width: "100%",
    textAlign: "center",
    fontSize: 13.5,
    fontWeight: 800,
    padding: "12px 16px",
    borderRadius: 11,
    background: accent,
    color: "#fff",
    textDecoration: "none",
    border: 0,
    cursor: "pointer",
  };

  if (gated) {
    return (
      <>
        <button style={style} onClick={() => setOpen(true)}>🔒 Verify email to download</button>
        <div style={{ textAlign: "center", fontSize: 11, color: "#8b93a4", marginTop: 7 }}>
          Owner requires a verified email for downloads
        </div>
        {open && (
          <PortfolioGate slug={slug} ownerName={ownerName} accent={accent} variant="download" open={open} onClose={() => setOpen(false)} />
        )}
      </>
    );
  }

  return (
    <a href={fileUrl} download style={style}>
      ⬇ {label}
    </a>
  );
}
