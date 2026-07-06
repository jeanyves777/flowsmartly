import type { PortfolioContent, PortfolioSection } from "@/lib/portfolio/portfolio-editor";
import { PortfolioDownload } from "./portfolio-download";

/**
 * Server-rendered public portfolio / résumé. Style-aware hero (cinematic /
 * spotlight / neon get a full-bleed image or VIDEO hero — the digital-ad feel),
 * generic accent-themed section renderers, and a gated Download action.
 */

const VIDEO_STYLES = new Set(["spotlight", "cinematic", "neon"]);

function asItems(data: Record<string, unknown>, key = "items"): Record<string, unknown>[] {
  const v = data[key];
  return Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Record<string, unknown>[]) : [];
}
function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
}

export function PortfolioPublic({
  p,
  slug,
  downloadGated,
}: {
  p: PortfolioContent;
  slug: string;
  downloadGated: boolean;
}) {
  const accent = p.theme.accent || "#6d5cff";
  const accent2 = p.theme.accent2 || accent;
  const dark = VIDEO_STYLES.has(p.theme.template);
  const bg = dark ? "#0b0f17" : "#ffffff";
  const ink = dark ? "#e7ebf3" : "#1b2330";
  const muted = dark ? "#9aa4b6" : "#5a636f";
  const cardBg = dark ? "#111725" : "#f7f8fb";
  const line = dark ? "#1f2637" : "#eceef2";

  const sectionHead = (label: string) => (
    <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: accent, marginBottom: 14 }}>{label}</div>
  );

  return (
    <div style={{ background: bg, color: ink, minHeight: "100vh", fontFamily: "Inter, -apple-system, Segoe UI, Roboto, Arial, sans-serif" }}>
      {p.status !== "PUBLISHED" && (
        <div style={{ background: "#f59e0b", color: "#3a2a00", textAlign: "center", fontSize: 12, fontWeight: 800, padding: "6px 10px" }}>
          Draft preview — not published yet
        </div>
      )}

      {/* ── HERO ─────────────────────────────────────────────── */}
      {renderHero(p, { accent, accent2, ink, muted })}

      {/* ── BODY ─────────────────────────────────────────────── */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 28px 8px" }}>
        {p.bio && p.theme.template !== "cinematic" && (
          <p style={{ fontSize: 16, lineHeight: 1.7, color: ink, margin: "0 0 28px", maxWidth: 640 }}>{p.bio}</p>
        )}

        {p.sections.filter((s) => s.visible).map((s) => (
          <section key={s.id} style={{ marginBottom: 34 }}>
            {renderSection(s, { accent, accent2, ink, muted, cardBg, line, sectionHead })}
          </section>
        ))}

        {/* Contact */}
        {(p.contact.email || p.contact.phone || (p.contact.links && p.contact.links.length > 0)) && (
          <section style={{ marginBottom: 34 }}>
            {sectionHead("Contact")}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              {p.contact.email && <a href={`mailto:${p.contact.email}`} style={pill(accent)}>✉ {p.contact.email}</a>}
              {p.contact.phone && <a href={`tel:${p.contact.phone}`} style={pill(accent)}>📞 {p.contact.phone}</a>}
              {p.contact.location && <span style={pill(accent)}>📍 {p.contact.location}</span>}
              {(p.contact.links || []).map((l, i) => (
                <a key={i} href={l.url} style={pill(accent)} target="_blank" rel="noreferrer">🔗 {l.label}</a>
              ))}
            </div>
          </section>
        )}

        {/* Download résumé */}
        {p.resumeFileUrl && (
          <section style={{ marginBottom: 34, maxWidth: 360 }}>
            <PortfolioDownload
              slug={slug}
              ownerName={p.name}
              accent={accent}
              gated={downloadGated}
              fileUrl={p.resumeFileUrl}
              label={p.kind === "personal" ? "Download PDF résumé" : "Download PDF"}
            />
          </section>
        )}
      </div>

      <footer style={{ textAlign: "center", padding: 22, fontSize: 12, color: muted, background: cardBg }}>
        Made with <b style={{ color: accent }}>FlowSmartly</b>
      </footer>
    </div>
  );
}

// ── Hero variants ──────────────────────────────────────────────
function renderHero(
  p: PortfolioContent,
  c: { accent: string; accent2: string; ink: string; muted: string },
) {
  const { accent, accent2, ink, muted } = c;
  const useMediaHero = VIDEO_STYLES.has(p.theme.template) && !!p.heroMedia.url;

  if (useMediaHero) {
    const isVideo = p.heroMedia.type === "video";
    return (
      <div style={{ position: "relative", color: "#fff", minHeight: 380, display: "flex", alignItems: "flex-end", overflow: "hidden" }}>
        {isVideo ? (
          <video
            src={p.heroMedia.url || undefined}
            poster={p.heroMedia.poster || undefined}
            autoPlay
            muted
            loop
            playsInline
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${p.heroMedia.url})`, backgroundSize: "cover", backgroundPosition: "center" }} />
        )}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(8,11,18,.35), rgba(8,11,18,.92))" }} />
        <div style={{ position: "relative", width: "100%", maxWidth: 900, margin: "0 auto", padding: "40px 28px" }}>
          {p.logoUrl ? (
            <img src={p.logoUrl} alt="" style={{ height: 44, borderRadius: 11, marginBottom: 12 }} />
          ) : (
            <div style={{ height: 40, width: 40, borderRadius: 11, background: `linear-gradient(135deg, ${accent}, ${accent2})`, display: "grid", placeItems: "center", fontWeight: 900, marginBottom: 12 }}>
              {initials(p.name)}
            </div>
          )}
          <h1 style={{ margin: 0, fontSize: 38, fontWeight: 900, letterSpacing: "-.02em" }}>{p.name}</h1>
          {p.headline && <div style={{ fontSize: 17, color: "#e6e2f5", marginTop: 6 }}>{p.headline}</div>}
        </div>
      </div>
    );
  }

  if (p.kind === "personal") {
    return (
      <div style={{ borderBottom: `3px solid ${accent}` }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 28px", display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          {p.avatarUrl && (
            <img src={p.avatarUrl} alt="" style={{ height: 92, width: 92, borderRadius: "50%", objectFit: "cover", boxShadow: `0 0 0 3px ${accent}22` }} />
          )}
          <div>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900, color: ink }}>{p.name}</h1>
            {p.headline && <div style={{ fontSize: 16, color: accent, fontWeight: 700, marginTop: 3 }}>{p.headline}</div>}
            {p.subheadline && <div style={{ fontSize: 13, color: muted, marginTop: 6 }}>{p.subheadline}</div>}
          </div>
        </div>
      </div>
    );
  }

  // business — bold text hero
  return (
    <div style={{ color: "#fff", background: `linear-gradient(135deg, ${accent}, ${accent2})` }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "56px 28px" }}>
        {p.logoUrl ? (
          <img src={p.logoUrl} alt="" style={{ height: 46, borderRadius: 11, marginBottom: 14 }} />
        ) : (
          <div style={{ height: 44, width: 44, borderRadius: 12, background: "#ffffff2a", display: "grid", placeItems: "center", fontWeight: 900, marginBottom: 14 }}>{initials(p.name)}</div>
        )}
        <h1 style={{ margin: 0, fontSize: 40, fontWeight: 900, letterSpacing: "-.02em" }}>{p.name}</h1>
        {p.headline && <div style={{ fontSize: 17, color: "#f2efff", marginTop: 8, maxWidth: 560 }}>{p.headline}</div>}
      </div>
    </div>
  );
}

// ── Section renderer ───────────────────────────────────────────
function renderSection(
  s: PortfolioSection,
  c: {
    accent: string; accent2: string; ink: string; muted: string; cardBg: string; line: string;
    sectionHead: (label: string) => React.ReactNode;
  },
) {
  const { accent, ink, muted, cardBg, line, sectionHead } = c;
  const head = sectionHead(s.title || s.type);

  switch (s.type) {
    case "about":
    case "custom":
      return <>{head}<p style={{ fontSize: 15, lineHeight: 1.7, color: ink, margin: 0, maxWidth: 640 }}>{str(s.data.body)}</p></>;

    case "experience":
      return (
        <>{head}
          <div>
            {asItems(s.data).map((it, i) => (
              <div key={i} style={{ position: "relative", paddingLeft: 18, marginBottom: 16 }}>
                <span style={{ position: "absolute", left: 0, top: 5, height: 9, width: 9, borderRadius: "50%", background: accent }} />
                <div style={{ fontSize: 14, fontWeight: 800, color: ink }}>{str(it.role) || str(it.title)}</div>
                <div style={{ fontSize: 12.5, color: accent, fontWeight: 700 }}>{str(it.company)}</div>
                <div style={{ fontSize: 11.5, color: muted }}>{str(it.dates)}</div>
                {str(it.summary) && <p style={{ margin: "5px 0 0", fontSize: 12.5, color: muted, lineHeight: 1.5 }}>{str(it.summary)}</p>}
              </div>
            ))}
          </div>
        </>
      );

    case "education":
      return (
        <>{head}
          {asItems(s.data).map((it, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: ink }}>{str(it.degree)}</div>
              <div style={{ fontSize: 12.5, color: accent, fontWeight: 700 }}>{str(it.school)}</div>
              <div style={{ fontSize: 11.5, color: muted }}>{str(it.dates)}</div>
            </div>
          ))}
        </>
      );

    case "skills":
      return (
        <>{head}
          <div style={{ maxWidth: 520 }}>
            {asItems(s.data).map((it, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 700, marginBottom: 4, color: ink }}>
                  <span>{str(it.label)}</span><span>{num(it.level)}%</span>
                </div>
                <div style={{ height: 7, borderRadius: 999, background: cardBg, overflow: "hidden" }}>
                  <span style={{ display: "block", height: "100%", width: `${num(it.level)}%`, borderRadius: 999, background: `linear-gradient(90deg, ${accent}, ${c.accent2})` }} />
                </div>
              </div>
            ))}
          </div>
        </>
      );

    case "projects":
    case "gallery":
      return (
        <>{head}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
            {asItems(s.data, s.type === "gallery" ? "images" : "items").map((it, i) => (
              <div key={i} style={{ background: cardBg, border: `1px solid ${line}`, borderRadius: 12, overflow: "hidden" }}>
                {str(it.imageUrl || it.url) && (
                  <div style={{ height: 120, backgroundImage: `url(${str(it.imageUrl || it.url)})`, backgroundSize: "cover", backgroundPosition: "center" }} />
                )}
                <div style={{ padding: "10px 12px" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: ink }}>{str(it.title) || str(it.caption)}</div>
                  {str(it.description) && <p style={{ margin: "3px 0 0", fontSize: 11.5, color: muted, lineHeight: 1.45 }}>{str(it.description)}</p>}
                </div>
              </div>
            ))}
          </div>
        </>
      );

    case "services":
      return (
        <>{head}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
            {asItems(s.data).map((it, i) => (
              <div key={i} style={{ background: cardBg, border: `1px solid ${line}`, borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: ink }}>{str(it.title)}</div>
                {str(it.description) && <p style={{ margin: "5px 0 0", fontSize: 12.5, color: muted, lineHeight: 1.5 }}>{str(it.description)}</p>}
              </div>
            ))}
          </div>
        </>
      );

    case "testimonials":
      return (
        <>{head}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
            {asItems(s.data).map((it, i) => (
              <div key={i} style={{ background: cardBg, border: `1px solid ${line}`, borderRadius: 12, padding: 16 }}>
                <p style={{ margin: 0, fontSize: 13, color: ink, lineHeight: 1.6 }}>“{str(it.quote)}”</p>
                <div style={{ marginTop: 10, fontSize: 12, fontWeight: 800, color: accent }}>{str(it.author)}</div>
                {str(it.role) && <div style={{ fontSize: 11, color: muted }}>{str(it.role)}</div>}
              </div>
            ))}
          </div>
        </>
      );

    case "stats":
      return (
        <>{head}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
            {asItems(s.data).map((it, i) => (
              <div key={i}>
                <div style={{ fontSize: 30, fontWeight: 900, color: accent }}>{str(it.value)}</div>
                <div style={{ fontSize: 12, color: muted }}>{str(it.label)}</div>
              </div>
            ))}
          </div>
        </>
      );

    default:
      return <>{head}<p style={{ fontSize: 13, color: muted }}>{str(s.data.body)}</p></>;
  }
}

// ── helpers ─────────────────────────────────────────────────────
function pill(accent: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12.5,
    fontWeight: 700,
    color: accent,
    background: `${accent}14`,
    borderRadius: 999,
    padding: "7px 13px",
    textDecoration: "none",
  };
}
function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "◆";
}
