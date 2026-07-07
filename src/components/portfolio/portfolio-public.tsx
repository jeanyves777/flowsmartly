import type { PortfolioContent, PortfolioSection, DiscoveryItem } from "@/lib/portfolio/portfolio-editor";
import type { BrandInfo } from "@/lib/brand/get-brand";
import { PortfolioDownload } from "./portfolio-download";

/**
 * Public portfolio / résumé renderer.
 *  - BUSINESS → a media-forward PORTFOLIO that lives INSIDE FlowSmartly: a
 *    system bar, a left "professional details" profile card (brand logo +
 *    colours + business details), a full-width Work grid (image + video), and
 *    a right "Discover portfolios" rail (cross-promo / ads).
 *  - PERSONAL → a clean, recruiter-facing digital résumé (standalone, no rail).
 * Brand logo + colours drive the owner's content (from the Brand Kit).
 */

// ── helpers ──────────────────────────────────────────────────────────────────
function visible(p: PortfolioContent, type: string) { return p.sections.filter((s) => s.visible && s.type === type); }
function firstOf(p: PortfolioContent, type: string) { return visible(p, type)[0]; }
function byTitle(p: PortfolioContent, kw: string) { return p.sections.find((s) => s.visible && (s.title || "").toLowerCase().includes(kw)); }
function itemsOf(sec?: PortfolioSection): Record<string, unknown>[] {
  const v = sec?.data?.items;
  return Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Record<string, unknown>[]) : [];
}
function str(v: unknown) { return typeof v === "string" ? v : v == null ? "" : String(v); }
function num(v: unknown) { const n = typeof v === "number" ? v : parseFloat(String(v)); return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0; }
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "◆"; }
function mediaOf(it: Record<string, unknown>) {
  const url = str(it.mediaUrl) || str(it.imageUrl) || str(it.videoUrl);
  const isVideo = it.mediaType === "video" || (!!str(it.videoUrl) && !str(it.imageUrl) && !str(it.mediaUrl));
  const poster = str(it.posterUrl) || (isVideo ? "" : url);
  return { url, isVideo, poster };
}

export function PortfolioPublic({
  p, brand, discovery, slug, downloadGated,
}: {
  p: PortfolioContent;
  brand: BrandInfo | null;
  discovery: DiscoveryItem[];
  slug: string;
  downloadGated: boolean;
}) {
  const accent = p.theme.accent || "#0ea5e9";
  const accent2 = p.theme.accent2 || "#6d5cff";
  const rootStyle = { "--brand": accent, "--brand2": accent2 } as React.CSSProperties;
  const draft = p.status !== "PUBLISHED";

  return (
    <div style={rootStyle}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {draft && <div className="pf-draft">Draft preview — not published yet</div>}
      {p.kind === "personal"
        ? <Resume p={p} slug={slug} downloadGated={downloadGated} />
        : <Business p={p} brand={brand} discovery={discovery} />}
    </div>
  );
}

// ── BUSINESS PORTFOLIO (3-column, in-system) ─────────────────────────────────
function Business({ p, brand, discovery }: { p: PortfolioContent; brand: BrandInfo | null; discovery: DiscoveryItem[] }) {
  const logo = brand?.iconLogo || brand?.logo || p.logoUrl || null;
  const projects = itemsOf(firstOf(p, "projects") || firstOf(p, "gallery"));
  const about = firstOf(p, "about");
  const services = itemsOf(firstOf(p, "services"));
  const stats = itemsOf(firstOf(p, "stats"));
  const links = p.contact.links || [];
  const heroVideo = p.heroMedia.type === "video" && p.heroMedia.url;

  return (
    <div className="pf pf-biz">
      {/* system bar — clearly a FlowSmartly portfolio */}
      <div className="sysbar"><div className="sysin">
        <span className="fs"><span className="fmark">◆</span><span className="fname"><b>Flow</b><span>Smartly</span></span><span className="kk">PORTFOLIOS</span></span>
        <nav className="sysnav"><a className="act">Discover</a><a>Creatives</a><a>Studios</a></nav>
        <span className="join">Create yours</span>
      </div></div>

      <div className="pbody">
        {/* LEFT — professional details */}
        <aside className="rail left">
          <div className="card prof">
            <div className="cover"><div className="plogo">{logo ? <img src={logo} alt="" /> : <b>{initials(p.name)}</b>}</div></div>
            <div className="pbd">
              <div className="pnm">{p.name} <span className="vf">✔</span></div>
              {(p.subheadline || p.headline) && <div className="ptl">{p.subheadline || p.headline}</div>}
              <div className="avail"><span className="dd" /> Available for projects</div>
              <div className="rows">
                {p.contact.location && <div className="r"><span className="i">📍</span> {p.contact.location}</div>}
                {p.contact.website && <div className="r"><span className="i">🌐</span> {p.contact.website.replace(/^https?:\/\//, "")}</div>}
                {p.contact.email && <div className="r"><span className="i">✉</span> {p.contact.email}</div>}
              </div>
              <div className="actions">
                {p.contact.email && <a className="btn pri" href={`mailto:${p.contact.email}`}>Start a project</a>}
                <div className="miniact">
                  {p.contact.email && <a className="btn ghost" href={`mailto:${p.contact.email}`}>✉ Email</a>}
                  {p.contact.phone && <a className="btn ghost" href={`tel:${p.contact.phone}`}>📞 Call</a>}
                </div>
              </div>
              {links.length > 0 && <div className="socials">{links.slice(0, 6).map((l, i) => <a key={i} href={l.url} target="_blank" rel="noreferrer" title={l.label}>{l.label.slice(0, 2)}</a>)}</div>}
            </div>
            {stats.length > 0 && (
              <div className="kpis">{stats.slice(0, 3).map((s, i) => <div className="kpi" key={i}><div className="n">{str(s.value)}</div><div className="l">{str(s.label)}</div></div>)}</div>
            )}
          </div>

          {services.length > 0 && (
            <div className="card">
              <div className="minititle">Services</div>
              <div className="svc">{services.slice(0, 6).map((s, i) => <div className="s" key={i}>{str(s.title)}{str(s.price) && <span>{str(s.price)}</span>}</div>)}</div>
            </div>
          )}
        </aside>

        {/* CENTER — fills the width */}
        <main className="center">
          <div className="cov2">
            {heroVideo
              ? <video className="m" src={p.heroMedia.url || undefined} poster={p.heroMedia.poster || undefined} autoPlay muted loop playsInline />
              : <div className="m" style={{ backgroundImage: `url(${p.heroMedia.url || "https://images.unsplash.com/photo-1626785774573-4b799315345d?w=1400&q=60"})`, backgroundSize: "cover", backgroundPosition: "center" }} />}
            <div className="sc" />
            {heroVideo && <span className="reelchip"><span className="dot" /> Showreel</span>}
            <div className="cw">
              {p.headline && <span className="chip">◆ {p.subheadline || "Portfolio"}</span>}
              <h1>{p.headline || p.name}</h1>
              {p.bio && <div className="sub">{p.bio}</div>}
              {p.contact.email && <div className="cta"><a className="btn pri" href={`mailto:${p.contact.email}`}>Start a project</a></div>}
            </div>
          </div>

          {projects.length > 0 && (
            <section className="sec">
              <div className="sechd"><div><div className="kick">Selected work</div><h2>The work speaks first.</h2></div></div>
              <div className="work">
                {projects.map((it, i) => {
                  const m = mediaOf(it);
                  return (
                    <div className={`proj${i === 0 ? " big" : ""}`} key={i}>
                      {m.isVideo && i === 0 && m.url
                        ? <video className="m" src={m.url} poster={m.poster || undefined} autoPlay muted loop playsInline />
                        : <div className="m" style={{ backgroundImage: `url(${m.poster || m.url})`, backgroundSize: "cover", backgroundPosition: "center" }} />}
                      {m.isVideo && <><span className="vtag">▶ Video</span><div className="vplay">▶</div></>}
                      <div className="shade" />
                      <div className="info">{str(it.category) && <div className="cat">{str(it.category)}</div>}<div className="ttl">{str(it.title)}</div></div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {(about || services.length > 0) && (
            <section className="sec about">
              <div className="kick">Studio</div>
              {about && <p dangerouslySetInnerHTML={{ __html: escapeHtml(str(about.data.body)) }} />}
              {services.length > 0 && <div className="tags">{services.slice(0, 8).map((s, i) => <span key={i}>{str(s.title)}</span>)}</div>}
            </section>
          )}

          {p.contact.email && (
            <section className="sec"><div className="contact"><h2>Let's build something.</h2><p>Tell us what you're making — we'll come back with a plan and a price.</p><a className="btn pri" href={`mailto:${p.contact.email}`}>{p.contact.email}</a></div></section>
          )}
        </main>

        {/* RIGHT — discovery / ads */}
        <aside className="rail right">
          <div className="card">
            <div className="railhd"><span>Discover portfolios</span></div>
            <div className="plist">
              {discovery.length === 0 && <div className="empty">More portfolios coming soon.</div>}
              {discovery.map((d) => (
                <a className="pl" href={`/pf/${d.slug}`} key={d.slug}>
                  {d.thumb ? <img className="th" src={d.thumb} alt="" /> : <span className="th th0">{initials(d.name)}</span>}
                  <span className="tx"><b>{d.name}</b><span>{d.headline || (d.kind === "personal" ? "Résumé" : "Portfolio")}</span></span>
                  <span className="go">↗</span>
                </a>
              ))}
            </div>
          </div>
          <div className="railcta"><b>Your work belongs here.</b><span>Build a portfolio like this in minutes.</span><a href="/home/portfolio">Create your portfolio</a></div>
        </aside>
      </div>

      <footer className="pf-ft"><span className="fs"><span className="fmark">◆</span><span className="fname"><b>Flow</b><span>Smartly</span></span></span><span className="fdim">{p.name} · a FlowSmartly portfolio</span><span className="made">Made with <b>FlowSmartly</b></span></footer>
    </div>
  );
}

// ── PERSONAL RÉSUMÉ (clean, improved) ────────────────────────────────────────
function Resume({ p, slug, downloadGated }: { p: PortfolioContent; slug: string; downloadGated: boolean }) {
  const experience = itemsOf(firstOf(p, "experience"));
  const skills = itemsOf(firstOf(p, "skills"));
  const education = itemsOf(firstOf(p, "education"));
  const projects = itemsOf(firstOf(p, "projects"));
  const languages = itemsOf(byTitle(p, "language"));
  const toolsSec = byTitle(p, "tool");
  const tools = itemsOf(toolsSec).map((t) => str(t.label) || str(t.title)).filter(Boolean);
  const reco = itemsOf(firstOf(p, "testimonials"))[0];
  const links = p.contact.links || [];

  return (
    <div className="pf pf-res">
      <div className="resume">
        <div className="rhead">
          {p.avatarUrl && <img className="av" src={p.avatarUrl} alt="" />}
          <div className="hx">
            <h1>{p.name}</h1>
            {p.headline && <div className="role">{p.headline}</div>}
            <div className="owt"><span className="dd" /> Open to opportunities</div>
            {p.bio && <div className="summ">{p.bio}</div>}
            <div className="rchips">
              {p.contact.email && <a href={`mailto:${p.contact.email}`}>✉ {p.contact.email}</a>}
              {p.contact.phone && <a href={`tel:${p.contact.phone}`}>📞 {p.contact.phone}</a>}
              {p.contact.location && <a>📍 {p.contact.location}</a>}
              {p.contact.website && <a href={p.contact.website}>🔗 {p.contact.website.replace(/^https?:\/\//, "")}</a>}
              {links.slice(0, 3).map((l, i) => <a key={i} href={l.url}>{l.label}</a>)}
            </div>
          </div>
          <div className="ract">
            {p.resumeFileUrl && <div className="dlwrap"><PortfolioDownload slug={slug} ownerName={p.name} accent={p.theme.accent} gated={downloadGated} fileUrl={p.resumeFileUrl} /></div>}
            {p.contact.email && <a className="b2" href={`mailto:${p.contact.email}`}>✉ Contact me</a>}
          </div>
        </div>

        <div className="rgrid">
          <div className="rside">
            {p.bio && <div className="blk2"><div className="rh">About</div><p>{p.bio}</p></div>}
            {skills.length > 0 && (
              <div className="blk2"><div className="rh">Skills</div>
                {skills.map((s, i) => <div className="rb" key={i}><div className="rbl"><span>{str(s.label)}</span><span>{num(s.level)}%</span></div><div className="rbar"><i style={{ width: `${num(s.level)}%` }} /></div></div>)}
              </div>
            )}
            {tools.length > 0 && <div className="blk2"><div className="rh">Tools</div><div className="chipset">{tools.slice(0, 10).map((t, i) => <span key={i}>{t}</span>)}</div></div>}
            {languages.length > 0 && (
              <div className="blk2"><div className="rh">Languages</div>
                {languages.map((l, i) => { const lvl = Math.round(num(l.level) / 20) || (str(l.level) ? 3 : 3); return (
                  <div className="lang" key={i}><span>{str(l.label) || str(l.name)}</span><span className="dots">{[0, 1, 2, 3, 4].map((d) => <i key={d} className={d < lvl ? "on" : ""} />)}</span></div>
                ); })}
              </div>
            )}
          </div>

          <div className="rmain">
            {experience.length > 0 && (
              <div className="rblk"><div className="rh">Experience</div>
                {experience.map((it, i) => { const bl = Array.isArray(it.bullets) ? (it.bullets as unknown[]).map(str).filter(Boolean) : []; return (
                  <div className="exp" key={i}><b>{str(it.role) || str(it.title)}</b>{str(it.company) && <> · <span className="co">{str(it.company)}</span></>}<div className="dt">{str(it.dates)}</div>
                    {bl.length > 0 ? <ul>{bl.map((b, j) => <li key={j}>{b}</li>)}</ul> : str(it.summary) && <ul><li>{str(it.summary)}</li></ul>}
                  </div>
                ); })}
              </div>
            )}
            {projects.length > 0 && (
              <div className="rblk"><div className="rh">Selected projects</div>
                <div className="projm">{projects.slice(0, 4).map((it, i) => { const m = mediaOf(it); return (
                  <div className="pm" key={i}>{(m.poster || m.url) && <div className="ph" style={{ backgroundImage: `url(${m.poster || m.url})` }} />}<div className="pb"><b>{str(it.title)}</b>{str(it.description) && <span>{str(it.description)}</span>}{str(it.url) && <a href={str(it.url)}>{m.isVideo ? "Watch demo" : "View"} ↗</a>}</div></div>
                ); })}</div>
              </div>
            )}
            {education.length > 0 && (
              <div className="rblk"><div className="rh">Education</div>
                {education.map((it, i) => <div className="exp" key={i}><b>{str(it.degree) || str(it.title)}</b>{str(it.school) && <> · <span className="co">{str(it.school)}</span></>}<div className="dt">{str(it.dates)}</div></div>)}
              </div>
            )}
            {reco && (
              <div className="rblk"><div className="rh">Recommendation</div>
                <div className="reco">"{str(reco.quote)}"<div className="by">— {str(reco.author)}{str(reco.role) && `, ${str(reco.role)}`}</div></div>
              </div>
            )}
          </div>
        </div>

        <div className="rcta"><b>Let's work together.</b><span className="sm">Open to new opportunities.</span>
          <div className="g">{p.contact.email && <a href={`mailto:${p.contact.email}`}>✉ Get in touch</a>}{p.resumeFileUrl && !downloadGated && <a className="o" href={p.resumeFileUrl} download>⬇ Résumé PDF</a>}</div>
        </div>
        <div className="rfoot">Made with <b>FlowSmartly</b></div>
      </div>
    </div>
  );
}

function escapeHtml(s: string) { return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c)); }

// ── styles (ported from the approved mockup) ─────────────────────────────────
const CSS = `
.pf{--paper:#0a0c12;--panel:#0f131d;--panel2:#131926;--line:#1b2230;--mut:#8b93a4;--tx:#eef2f8;font:15px/1.55 -apple-system,'Segoe UI',Roboto,Arial,sans-serif}
.pf-draft{background:#f59e0b;color:#3a2a00;text-align:center;font-size:12px;font-weight:800;padding:6px}
.pf a{color:inherit;text-decoration:none}
.pf img,.pf video{display:block;max-width:100%}
/* business */
.pf-biz{background:var(--paper);color:var(--tx);min-height:100vh}
.sysbar{position:sticky;top:0;z-index:30;background:#0a0c12ee;backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
.sysin{max-width:1640px;margin:0 auto;display:flex;align-items:center;gap:16px;padding:11px 24px}
.fs{display:flex;align-items:center;gap:9px;font-weight:900}
.fmark{height:26px;width:26px;border-radius:8px;background:linear-gradient(135deg,#6d5cff,#0ea5e9);display:grid;place-items:center;color:#fff;font-size:14px}
.fname b{color:#fff}.fname span{color:#6d5cff}
.kk{margin-left:6px;font-size:11px;font-weight:800;color:var(--mut);border-left:1px solid var(--line);padding-left:12px}
.sysnav{margin-left:12px;display:flex;gap:16px;font-size:13px;color:var(--mut);font-weight:600}.sysnav a.act{color:#fff}
.join{margin-left:auto;background:#fff;color:#0a0c12;font-weight:800;font-size:12.5px;padding:8px 14px;border-radius:10px;cursor:pointer}
.pbody{max-width:1640px;margin:0 auto;display:grid;grid-template-columns:308px minmax(0,1fr) 328px;gap:22px;padding:22px 24px 30px;align-items:start}
.rail{position:sticky;top:96px;align-self:start;display:flex;flex-direction:column;gap:16px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:18px;overflow:hidden}
.prof .cover{height:80px;background:linear-gradient(120deg,color-mix(in srgb,var(--brand) 90%,#000),var(--brand2));position:relative}
.plogo{position:absolute;left:18px;bottom:-26px;height:64px;width:64px;border-radius:18px;background:#0a0c12;border:3px solid var(--panel);display:grid;place-items:center;overflow:hidden}
.plogo img{height:100%;width:100%;object-fit:cover}
.plogo b{height:52px;width:52px;border-radius:13px;background:linear-gradient(135deg,var(--brand),var(--brand2));display:grid;place-items:center;color:#001018;font-weight:900;font-size:20px}
.pbd{padding:34px 18px 18px}
.pnm{display:flex;align-items:center;gap:7px;font-size:18px;font-weight:900}.vf{color:var(--brand);font-size:14px}
.ptl{color:#cdd4df;font-size:13px;margin-top:2px}
.avail{display:inline-flex;align-items:center;gap:7px;margin-top:12px;font-size:12px;font-weight:800;color:#34d399;background:#0e2019;border:1px solid #1f5b46;border-radius:999px;padding:5px 11px}
.avail .dd{height:7px;width:7px;border-radius:50%;background:#34d399;box-shadow:0 0 0 3px #34d39933}
.rows{margin-top:14px;display:flex;flex-direction:column;gap:9px;font-size:13px;color:#c3cad6}.rows .r{display:flex;align-items:center;gap:9px}.rows .i{width:16px;color:var(--mut)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;font-weight:800;font-size:13.5px;padding:11px 16px;border-radius:12px;cursor:pointer;border:0}
.btn.pri{background:var(--brand);color:#00131f;box-shadow:0 10px 26px color-mix(in srgb,var(--brand) 30%,transparent)}
.btn.ghost{background:#141b28;color:var(--tx);border:1px solid var(--line)}
.actions{margin-top:15px;display:flex;flex-direction:column;gap:9px}.miniact{display:flex;gap:8px}.miniact .btn{flex:1;padding:9px}
.socials{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}.socials a{height:34px;width:34px;border-radius:10px;background:#141b28;border:1px solid var(--line);display:grid;place-items:center;color:var(--mut);font-weight:800;font-size:11px;text-transform:capitalize}
.kpis{display:grid;grid-template-columns:1fr 1fr 1fr;border-top:1px solid var(--line)}
.kpi{padding:13px 6px;text-align:center;border-right:1px solid var(--line)}.kpi:last-child{border-right:0}.kpi .n{font-size:18px;font-weight:900;color:var(--brand)}.kpi .l{font-size:10.5px;color:var(--mut)}
.minititle{font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:var(--mut);padding:14px 16px 8px}
.svc{padding:0 12px 14px;display:flex;flex-direction:column;gap:2px}.svc .s{display:flex;align-items:center;justify-content:space-between;padding:9px 10px;border-radius:10px;font-size:13px}.svc .s span{color:var(--mut);font-size:12px}
.center{min-width:0}
.cov2{position:relative;border-radius:20px;overflow:hidden;min-height:300px;display:flex;align-items:flex-end;border:1px solid var(--line)}
.cov2 .m{position:absolute;inset:0;height:100%;width:100%;object-fit:cover}
.cov2 .sc{position:absolute;inset:0;background:linear-gradient(180deg,#0a0c1220,#0a0c12c9),radial-gradient(90% 80% at 15% 10%,color-mix(in srgb,var(--brand) 26%,transparent),transparent 55%)}
.cov2 .cw{position:relative;padding:26px 30px}
.chip{display:inline-flex;align-items:center;gap:7px;font-size:11.5px;font-weight:800;color:var(--brand);background:color-mix(in srgb,var(--brand) 16%,transparent);border:1px solid color-mix(in srgb,var(--brand) 42%,transparent);border-radius:999px;padding:5px 11px}
.cov2 h1{margin:12px 0 0;font-size:clamp(26px,3.4vw,44px);line-height:1.03;font-weight:900;letter-spacing:-.03em;max-width:18ch}
.cov2 .sub{margin-top:10px;font-size:16px;color:#d7dce6;max-width:58ch}
.cov2 .cta{margin-top:16px;display:flex;gap:10px}
.reelchip{position:absolute;top:16px;right:16px;display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:800;color:#fff;background:#0a0c1266;border:1px solid #ffffff33;border-radius:999px;padding:6px 12px;backdrop-filter:blur(6px)}
.reelchip .dot{height:8px;width:8px;border-radius:50%;background:#ff4d4d;box-shadow:0 0 0 4px #ff4d4d33}
.sec{margin-top:30px}.sechd{margin-bottom:16px}.kick{font-size:12px;font-weight:900;letter-spacing:.15em;text-transform:uppercase;color:var(--brand)}
.sec h2{font-size:clamp(20px,2.4vw,28px);font-weight:900;letter-spacing:-.02em;margin:4px 0 0}
.work{display:grid;grid-template-columns:repeat(3,1fr);gap:15px}
.proj{position:relative;border-radius:16px;overflow:hidden;background:var(--panel);border:1px solid var(--line);min-height:220px}
.proj.big{grid-column:span 2;grid-row:span 2;min-height:455px}
.proj .m{position:absolute;inset:0;height:100%;width:100%;object-fit:cover;transition:.5s}
.proj:hover .m{transform:scale(1.05)}
.proj .shade{position:absolute;inset:0;background:linear-gradient(180deg,transparent 45%,#05070c 100%)}
.proj .info{position:absolute;left:0;right:0;bottom:0;padding:16px 18px}
.proj .cat{font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--brand)}
.proj .ttl{font-size:17px;font-weight:800;margin-top:2px}
.vtag{position:absolute;top:12px;left:12px;display:inline-flex;align-items:center;gap:6px;font-size:10.5px;font-weight:800;color:#fff;background:#05070caa;border:1px solid #ffffff2a;border-radius:999px;padding:4px 9px}
.vplay{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);height:52px;width:52px;border-radius:50%;background:#ffffffe6;color:#0a0c12;display:grid;place-items:center;font-size:16px;box-shadow:0 10px 30px #0009}
.about{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:26px 28px}
.about p{font-size:clamp(16px,1.8vw,21px);line-height:1.5;font-weight:600;margin:10px 0 0;max-width:70ch}
.tags{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}.tags span{font-size:12px;font-weight:700;color:#cdd4df;background:var(--panel2);border:1px solid var(--line);border-radius:999px;padding:6px 12px}
.contact{border-radius:20px;padding:44px 30px;text-align:center;background:radial-gradient(120% 120% at 50% 0%,color-mix(in srgb,var(--brand) 22%,transparent),transparent 55%),var(--panel);border:1px solid var(--line)}
.contact h2{font-size:clamp(24px,3.4vw,40px);margin:0}.contact p{color:var(--mut);margin:10px auto 20px;max-width:40ch}
.railhd{display:flex;align-items:center;justify-content:space-between;padding:13px 15px;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--mut)}
.plist{padding:5px 8px 10px;display:flex;flex-direction:column;gap:3px}
.pl{display:flex;align-items:center;gap:11px;padding:8px;border-radius:12px}.pl:hover{background:var(--panel2)}
.pl .th{height:46px;width:46px;border-radius:11px;object-fit:cover;flex:0 0 auto;background:#141b28}
.pl .th0{display:grid;place-items:center;color:var(--brand);font-weight:900;font-size:14px}
.pl .tx{min-width:0;flex:1}.pl .tx b{font-size:13.5px;display:block;line-height:1.2}.pl .tx span{font-size:11.5px;color:var(--mut);display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pl .go{color:var(--mut);font-size:15px}
.empty{padding:12px 14px;font-size:12.5px;color:var(--mut)}
.railcta{background:linear-gradient(135deg,#6d5cff,#0ea5e9);border-radius:16px;padding:16px;text-align:center}
.railcta b{font-size:14px;display:block}.railcta span{font-size:12px;color:#e7ecff}.railcta a{display:block;margin-top:10px;background:#fff;color:#0a0c12;font-weight:800;font-size:12.5px;padding:9px 14px;border-radius:10px;cursor:pointer}
.pf-ft{max-width:1640px;margin:0 auto;display:flex;align-items:center;gap:12px;padding:24px;color:var(--mut);font-size:12.5px;border-top:1px solid var(--line)}
.pf-ft .made{margin-left:auto}.pf-ft .made b{color:var(--brand)}.pf-ft .fdim{color:var(--mut)}
@media(max-width:1180px){.pbody{grid-template-columns:1fr}.rail{position:static}.work{grid-template-columns:repeat(2,1fr)}.proj.big{grid-row:span 1;min-height:220px}}
/* résumé */
.pf-res{background:#0e1016;padding:1px 0;min-height:100vh}
.resume{max-width:988px;margin:26px auto 46px;background:#fff;color:#1b2330;border-radius:18px;overflow:hidden;box-shadow:0 34px 90px #000b}
.rhead{padding:30px 34px;display:flex;gap:24px;align-items:center;background:linear-gradient(120deg,color-mix(in srgb,var(--brand) 9%,#fff),#fff);border-bottom:1px solid #eef0f4;flex-wrap:wrap}
.rhead .av{height:108px;width:108px;border-radius:28px;object-fit:cover;box-shadow:0 0 0 4px color-mix(in srgb,var(--brand) 18%,transparent)}
.rhead .hx{flex:1;min-width:250px}.rhead h1{margin:0;font-size:33px;font-weight:900;letter-spacing:-.02em;color:#0b1220}
.rhead .role{color:var(--brand);font-weight:800;font-size:16px;margin-top:2px}
.owt{display:inline-flex;align-items:center;gap:7px;margin-top:9px;font-size:11.5px;font-weight:800;color:#0a7c53;background:#e7f8f0;border:1px solid #b7ead2;border-radius:999px;padding:4px 11px}
.owt .dd{height:7px;width:7px;border-radius:50%;background:#12b981;box-shadow:0 0 0 3px #12b98133}
.rhead .summ{margin-top:11px;font-size:13.5px;color:#4a5360;max-width:62ch;line-height:1.55}
.rchips{display:flex;flex-wrap:wrap;gap:8px;margin-top:13px}.rchips a{font-size:12px;font-weight:700;color:#3a4453;background:#f2f4f8;border:1px solid #e6e9ef;border-radius:999px;padding:6px 11px}
.ract{display:flex;flex-direction:column;gap:9px;min-width:174px}.ract .dlwrap{min-width:174px}
.ract .b2{background:#f2f4f8;color:#1b2330;border:1px solid #e6e9ef;font-weight:800;font-size:12.5px;padding:11px 14px;border-radius:12px;text-align:center}
.rgrid{display:grid;grid-template-columns:33% 1fr}
.rside{padding:26px 24px;background:#f7f8fb;border-right:1px solid #eef0f4}.rmain{padding:26px 30px}
.rh{font-size:11.5px;font-weight:900;letter-spacing:.13em;text-transform:uppercase;color:var(--brand);margin:0 0 13px}
.blk2{margin-bottom:24px}.rside p{font-size:12.5px;color:#5a636f;line-height:1.6;margin:0}
.rb{margin-bottom:11px}.rbl{display:flex;justify-content:space-between;font-size:12.5px;font-weight:700;margin-bottom:4px;color:#2a333f}
.rbar{height:7px;border-radius:999px;background:#e9ecf3;overflow:hidden}.rbar i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--brand),var(--brand2))}
.chipset{display:flex;flex-wrap:wrap;gap:7px}.chipset span{font-size:11.5px;font-weight:700;color:#4b3fb8;background:#efedff;border-radius:8px;padding:5px 9px}
.lang{display:flex;justify-content:space-between;align-items:center;font-size:12.5px;margin-bottom:9px;color:#2a333f}.lang .dots{display:flex;gap:3px}.lang .dots i{height:7px;width:7px;border-radius:50%;background:#dfe3ea}.lang .dots i.on{background:var(--brand)}
.rblk{margin-bottom:26px}
.exp{position:relative;padding-left:18px;margin-bottom:18px}
.exp:before{content:"";position:absolute;left:0;top:5px;height:10px;width:10px;border-radius:50%;background:var(--brand)}
.exp:after{content:"";position:absolute;left:4.5px;top:16px;bottom:-14px;width:1.5px;background:#e6e9ef}.exp:last-child:after{display:none}
.exp b{font-size:14px}.exp .co{color:var(--brand);font-weight:700;font-size:13px}.exp .dt{color:#8b93a4;font-size:11.5px}
.exp ul{margin:6px 0 0;padding-left:16px;color:#5a636f;font-size:12.5px}.exp li{margin-bottom:2px}
.projm{display:grid;grid-template-columns:1fr 1fr;gap:12px}.pm{border:1px solid #eceef2;border-radius:12px;overflow:hidden;background:#fff}
.pm .ph{height:84px;background-size:cover;background-position:center}.pm .pb{padding:9px 11px}.pm b{font-size:12.5px}.pm span{font-size:11px;color:#8b93a4;display:block;margin:1px 0 3px}.pm a{font-size:11px;color:var(--brand);font-weight:800}
.reco{background:#f7f8fb;border:1px solid #eef0f4;border-radius:12px;padding:14px 16px;font-size:13px;color:#3a4453;font-style:italic;line-height:1.55}.reco .by{margin-top:8px;font-style:normal;font-weight:700;font-size:12px;color:#1b2330}
.rcta{padding:22px 30px;background:linear-gradient(120deg,color-mix(in srgb,var(--brand) 11%,#fff),#fff);border-top:1px solid #eef0f4;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.rcta b{font-size:16px;color:#0b1220}.rcta .sm{color:#5a636f;font-size:13px}.rcta .g{margin-left:auto;display:flex;gap:9px}
.rcta .g a{background:var(--brand);color:#fff;font-weight:800;font-size:12.5px;padding:10px 15px;border-radius:11px}.rcta .g a.o{background:#fff;color:#1b2330;border:1px solid #e6e9ef}
.rfoot{text-align:center;padding:14px;font-size:11.5px;color:#9aa2af;background:#fff;border-top:1px solid #f0f2f5}.rfoot b{color:var(--brand)}
@media(max-width:760px){.rgrid{grid-template-columns:1fr}.rside{border-right:0;border-bottom:1px solid #eef0f4}}
`;
