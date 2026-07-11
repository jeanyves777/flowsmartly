import { cn } from "@/lib/utils/cn";

/**
 * HubThumb — the hub-card thumbnails: clean product-UI scenes (white/theme cards
 * on a soft wash, real labels + realistic controls) that step through 3 states.
 * Everything is driven off the app's THEME TOKENS (--card / --foreground /
 * --border / --primary …) so it adapts to the active theme and brand — no
 * hardcoded palette. Video Studio keeps its real MP4 (CreateThumb). Loop is
 * intentionally lively (~14s). [[menu-restructure-create-hub]] [[no-internal-details-in-ui]]
 */

export type HubScene =
  | "poster" | "logo" | "voice" | "gallery"
  | "analytics" | "map" | "queue" | "website" | "list"
  | "reviews" | "flow" | "form" | "proposal" | "product" | "globe" | "calendar";

const WAVE = Array.from({ length: 38 }, (_, i) => {
  const env = Math.sin((i / 37) * Math.PI);
  const detail = 0.5 + 0.5 * Math.abs(Math.sin(i * 1.7)) * Math.abs(Math.cos(i * 0.6));
  return Math.max(16, Math.round(env * detail * 100));
});
const CAL_POSTS: Record<number, { step: string; good?: boolean }> = {
  3: { step: "ht-s1" }, 9: { step: "ht-s1", good: true },
  12: { step: "ht-s2" }, 16: { step: "ht-s2", good: true },
  20: { step: "ht-s3" }, 25: { step: "ht-s3", good: true },
};

const Chip = ({ l, v }: { l: string; v: string }) => (
  <div className="ht-chip"><span className="ht-lbl">{l}</span><b className="ht-num">{v}</b></div>
);

export function HubThumb({ scene, cta }: { scene: HubScene; cta: string }) {
  return (
    <div className="ht-root">
      {scene === "analytics" && (
        <div className="ht ht-wash">
          <div className="ht-panel">
            <div className="ht-ph ht-s1"><b>Campaign performance</b><span className="ht-tag">LIVE</span></div>
            <div className="ht-chips ht-s1"><Chip l="Spend" v="$2,400" /><Chip l="Reach" v="88k" /><Chip l="CTR" v="3.1%" /></div>
            <div className="ht-bigrow ht-s2"><span className="ht-big ht-num">4.8×</span><span className="ht-lbl ht-good">ROAS · ▲ 62%</span></div>
            <div className="ht-svg ht-s2">
              <svg viewBox="0 0 100 30" preserveAspectRatio="none">
                <defs><linearGradient id="htGg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="hsl(var(--primary))" /><stop offset="1" stopColor="#22c55e" /></linearGradient></defs>
                <path className="ht-line" d="M2,25 L20,21 L40,23 L60,12 L80,7 L98,2" />
              </svg>
            </div>
            <div className="ht-seg ht-s3"><span className="ht-on">7 days</span><span>30 days</span></div>
          </div>
        </div>
      )}

      {scene === "voice" && (
        <div className="ht ht-wash ht-wash-v">
          <div className="ht-panel">
            <div className="ht-ph ht-s1"><b>Voiceover · Emma</b><span className="ht-tag">NATURAL</span></div>
            <div className="ht-voarea">
              <div className="ht-wave ht-s2">{WAVE.map((h, i) => <i key={i} style={{ height: `${h}%`, animationDelay: `${(i % 6) * -0.3}s` }} />)}</div>
              <div className="ht-head ht-s2" />
            </div>
            <div className="ht-vorow ht-s3">
              <span className="ht-play"><svg width="11" height="11" viewBox="0 0 24 24" fill="#fff" style={{ marginLeft: 1 }}><path d="M8 5v14l11-7z" /></svg></span>
              <span className="ht-chipm">1.0×</span><span className="ht-chipm ht-num">0:12 / 0:30</span>
            </div>
          </div>
        </div>
      )}

      {scene === "poster" && (
        <div className="ht ht-wash">
          <div className="ht-mini ht-s1"><span className="ht-me">SUMMER · 2026</span><span className="ht-mh">Big<br />Sale</span><span className="ht-mph" /><span className="ht-mc">Shop now →</span></div>
          <div className="ht-props ht-s2">
            <span className="ht-lbl">Accent</span>
            <div className="ht-swrow"><i style={{ background: "hsl(var(--primary))" }} /><i style={{ background: "#7c6bff" }} /><i style={{ background: "#f5b83d" }} /><i style={{ background: "#22c55e" }} /></div>
            <span className="ht-lbl" style={{ marginTop: 3 }}>Style</span>
            <div className="ht-seg"><span className="ht-on">Bold</span><span>Minimal</span></div>
            <div className="ht-gen ht-s3">✦ Generate</div>
          </div>
        </div>
      )}

      {scene === "logo" && (
        <div className="ht ht-wash">
          <div className="ht-panel ht-brandcard">
            <span className="ht-tag ht-s1" style={{ alignSelf: "flex-start" }}>BRAND KIT</span>
            <div className="ht-logorow">
              <div className="ht-markwrap ht-s1"><div className="ht-mk ht-mk1">F</div><div className="ht-mk ht-mk2">F</div><div className="ht-mk ht-mk3">F</div></div>
              <div className="ht-wm ht-s2"><b>FlowSmartly</b><i /></div>
            </div>
            <div className="ht-swrow ht-s3" style={{ marginTop: "auto" }}>
              <i style={{ background: "hsl(var(--primary))" }} /><i style={{ background: "#7c6bff" }} /><i style={{ background: "#22c55e" }} /><i style={{ background: "#f5b83d" }} /><i style={{ background: "#0f172a" }} />
            </div>
          </div>
        </div>
      )}

      {scene === "gallery" && (
        <div className="ht ht-wash">
          <div className="ht-panel ht-gallery">
            <div className="ht-ph ht-s1"><b>Media library</b><span className="ht-tag">128</span></div>
            <div className="ht-grid">
              <span className="ht-tile ht-g1 ht-pic ht-s1" /><span className="ht-tile ht-g2 ht-s1" /><span className="ht-tile ht-g3 ht-play ht-s2" /><span className="ht-tile ht-g4 ht-s2" />
              <span className="ht-tile ht-g5 ht-s3" /><span className="ht-tile ht-g6 ht-pic ht-s3" /><span className="ht-tile ht-g7 ht-s3" /><span className="ht-tile ht-g8 ht-play ht-s3" />
            </div>
          </div>
        </div>
      )}

      {scene === "map" && (
        <div className="ht ht-mapscene">
          <div className="ht-mapbg" />
          <div className="ht-searchpill ht-s1"><span className="ht-sdot" /><b>Cafés near me</b></div>
          {[["24%", "44%", "ht-pa"], ["46%", "34%", "ht-pa"], ["34%", "62%", "ht-pc"], ["58%", "54%", "ht-pc"], ["26%", "74%", "ht-pb"], ["50%", "72%", "ht-pb"]].map(([l, t, c], i) => (
            <div key={i} className="ht-pinwrap" style={{ left: l, top: t }}><div className="ht-pshadow" /><div className={cn("ht-pin", c)} /></div>
          ))}
          <div className="ht-reslist ht-s2">
            <div className="ht-resr"><span className="ht-avatar ht-s-a">A</span><div className="ht-lt"><i style={{ width: "72%" }} /><i style={{ width: "48%" }} /></div><span className="ht-star">★ 4.8</span></div>
            <div className="ht-resr"><span className="ht-avatar ht-s-b">B</span><div className="ht-lt"><i style={{ width: "60%" }} /><i style={{ width: "40%" }} /></div><span className="ht-star">★ 4.6</span></div>
          </div>
        </div>
      )}

      {scene === "queue" && (
        <div className="ht ht-wash ht-wash-g">
          <div className="ht-panel">
            <div className="ht-ph ht-s1"><b>Scheduled</b><span className="ht-tag">12 POSTS</span></div>
            <div className="ht-post ht-s1"><span className="ht-pim ht-im-a" /><div className="ht-lt"><i style={{ width: "82%" }} /><i style={{ width: "58%" }} /></div><span className="ht-when ht-num">Mon 9:00</span></div>
            <div className="ht-post ht-s2"><span className="ht-pim ht-im-b" /><div className="ht-lt"><i style={{ width: "74%" }} /><i style={{ width: "64%" }} /></div><span className="ht-when ht-num">Wed 12:00</span></div>
            <div className="ht-post ht-s3"><span className="ht-pim ht-im-c" /><div className="ht-lt"><i style={{ width: "80%" }} /><i style={{ width: "52%" }} /></div><span className="ht-badge">✓ Live</span></div>
          </div>
        </div>
      )}

      {scene === "website" && (
        <div className="ht ht-wash">
          <div className="ht-browser">
            <div className="ht-bbar"><span className="ht-dotr" /><span className="ht-doty" /><span className="ht-dotg" /><div className="ht-url ht-s1" /></div>
            <div className="ht-wpage">
              <div className="ht-wnav ht-s1"><i /><i /><i /></div>
              <div className="ht-whero ht-s2" />
              <div className="ht-wline ht-s2" style={{ width: "70%" }} />
              <div className="ht-wgrid ht-s3"><span /><span /><span /></div>
            </div>
          </div>
        </div>
      )}

      {scene === "list" && (
        <div className="ht ht-wash">
          <div className="ht-panel">
            <div className="ht-ph ht-s1"><b>Contacts</b><span className="ht-tag">2,480</span></div>
            <div className="ht-lr ht-s1"><span className="ht-avatar ht-s-a">JD</span><div className="ht-lt"><i style={{ width: "70%" }} /><i style={{ width: "46%" }} /></div><span className="ht-badge">New</span></div>
            <div className="ht-lr ht-s2"><span className="ht-avatar ht-s-b">MR</span><div className="ht-lt"><i style={{ width: "80%" }} /><i style={{ width: "54%" }} /></div><span className="ht-badge ht-mutedbadge">VIP</span></div>
            <div className="ht-lr ht-s3"><span className="ht-avatar ht-s-c">AK</span><div className="ht-lt"><i style={{ width: "64%" }} /><i style={{ width: "40%" }} /></div><span className="ht-badge ht-mutedbadge">Lead</span></div>
          </div>
        </div>
      )}

      {scene === "reviews" && (
        <div className="ht ht-wash">
          <div className="ht-panel">
            <div className="ht-ratingrow ht-s1"><span className="ht-rating ht-num">4.9</span><div><div className="ht-stars"><span className="ht-st ht-s1">★</span><span className="ht-st ht-s1">★</span><span className="ht-st ht-s2">★</span><span className="ht-st ht-s2">★</span><span className="ht-st ht-s3">★</span></div><span className="ht-lbl">312 reviews</span></div></div>
            <div className="ht-lr ht-s2"><span className="ht-avatar ht-s-a">S</span><div className="ht-lt"><i style={{ width: "74%" }} /><i style={{ width: "52%" }} /></div><span className="ht-star">★★★★★</span></div>
            <div className="ht-lr ht-s3"><span className="ht-avatar ht-s-b">M</span><div className="ht-lt"><i style={{ width: "82%" }} /><i style={{ width: "44%" }} /></div><span className="ht-star">★★★★★</span></div>
          </div>
        </div>
      )}

      {scene === "flow" && (
        <div className="ht ht-wash">
          <div className="ht-panel ht-flowcard">
            <div className="ht-node ht-s1"><span className="ht-ndot ht-nd1" /><div className="ht-lt"><i style={{ width: "60%" }} /></div><span className="ht-lbl">Trigger</span></div>
            <div className="ht-conn ht-s2" />
            <div className="ht-node ht-s2"><span className="ht-ndot ht-nd2" /><div className="ht-lt"><i style={{ width: "68%" }} /></div><span className="ht-lbl">Wait 1d</span></div>
            <div className="ht-conn ht-s3" />
            <div className="ht-node ht-s3"><span className="ht-ndot ht-nd3" /><div className="ht-lt"><i style={{ width: "56%" }} /></div><span className="ht-lbl ht-good">Send</span></div>
          </div>
        </div>
      )}

      {scene === "form" && (
        <div className="ht ht-wash">
          <div className="ht-panel ht-formcard">
            <div className="ht-ph ht-s1"><b>Contact form</b></div>
            <span className="ht-flabel ht-s1">Full name</span><div className="ht-finput ht-s1"><span className="ht-caret" /></div>
            <span className="ht-flabel ht-s2">Email</span><div className="ht-finput ht-s2" />
            <div className="ht-fsubmit ht-s3">Submit ✓</div>
          </div>
        </div>
      )}

      {scene === "proposal" && (
        <div className="ht ht-wash">
          <div className="ht-panel ht-doc">
            <div className="ht-drings ht-s2"><div className="ht-ring"><b className="ht-num">92</b></div></div>
            <div className="ht-ph ht-s1"><b>Proposal · Acme Co.</b></div>
            <span className="ht-flabel ht-s1" style={{ width: "40%" }}>Marketing retainer</span>
            <div className="ht-drow ht-s2"><i /><b className="ht-num">$4,800</b></div>
            <div className="ht-drow ht-s3"><i /><b className="ht-num">$7,600</b></div>
            <div className="ht-dtotal ht-s3"><span className="ht-lbl">Total</span><b className="ht-num ht-good">$12,400</b></div>
          </div>
        </div>
      )}

      {scene === "product" && (
        <div className="ht ht-wash">
          <div className="ht-panel ht-productcard">
            <div className="ht-pimg ht-s1"><span className="ht-badge ht-floatbadge">New</span></div>
            <div className="ht-ptitle ht-s2"><b>Aurora Diffuser</b><span className="ht-star ht-s2">★ 4.9</span></div>
            <div className="ht-prow ht-s3"><span className="ht-price ht-num">$49</span><span className="ht-cart">Add to cart</span></div>
          </div>
        </div>
      )}

      {scene === "globe" && (
        <div className="ht ht-wash ht-wash-v">
          <div className="ht-panel">
            <div className="ht-ph ht-s1"><b>Domains</b><span className="ht-globeic">◍</span></div>
            <div className="ht-lr ht-s1"><span className="ht-globedot" /><div className="ht-lt"><b className="ht-dname">yourbrand.com</b></div><span className="ht-badge">✓ Live</span></div>
            <div className="ht-lr ht-s2"><span className="ht-globedot ht-gd2" /><div className="ht-lt"><b className="ht-dname">yourbrand.io</b></div><span className="ht-badge ht-mutedbadge">DNS</span></div>
            <div className="ht-lr ht-s3"><span className="ht-globedot ht-gd3" /><div className="ht-lt"><b className="ht-dname">yourbrand.store</b></div><span className="ht-badge ht-mutedbadge">Setup</span></div>
          </div>
        </div>
      )}

      {scene === "calendar" && (
        <div className="ht ht-wash ht-wash-g">
          <div className="ht-panel ht-calcard">
            <div className="ht-ph ht-s1"><b>November</b><span className="ht-calnav">‹ ›</span></div>
            <div className="ht-calgrid">
              {Array.from({ length: 28 }, (_, i) => {
                const p = CAL_POSTS[i];
                return <span key={i} className="ht-cell">{p && <i className={cn("ht-cdot", p.step, p.good && "ht-cdot-g")} />}</span>;
              })}
            </div>
          </div>
        </div>
      )}

      <div className="ht-cta"><span className="ht-btn">{cta} <span className="ht-arr">→</span></span></div>
    </div>
  );
}

export function HubThumbStyles() {
  return <style dangerouslySetInnerHTML={{ __html: HUB_THUMB_CSS }} />;
}

const HUB_THUMB_CSS = `
.ht-root{position:absolute;inset:0;overflow:hidden;
  --loop:14s;--acc:hsl(var(--primary));--acc2:#7c6bff;--good:#16a34a;
  --grad:linear-gradient(120deg,hsl(var(--primary)),#7c6bff);
  --gradG:linear-gradient(90deg,hsl(var(--primary)),#22c55e);
  --card:hsl(var(--card));--ink:hsl(var(--card-foreground));--mut:hsl(var(--muted-foreground));
  --line:hsl(var(--border));--soft:hsl(var(--muted));--bg:hsl(var(--background));
  --sh:0 18px 38px -20px rgba(15,23,42,.32),0 1px 3px rgba(15,23,42,.08)}
.ht{position:absolute;inset:0}
.ht-wash{background:radial-gradient(130px 120px at 12% 10%,hsl(var(--primary)/.30),transparent 70%),radial-gradient(150px 140px at 90% 92%,#7c6bff2e,transparent 70%),linear-gradient(160deg,var(--soft),var(--bg))}
.ht-wash-v{background:radial-gradient(140px 130px at 12% 10%,#7c6bff33,transparent 70%),radial-gradient(150px 140px at 90% 92%,hsl(var(--primary)/.24),transparent 70%),linear-gradient(160deg,var(--soft),var(--bg))}
.ht-wash-g{background:radial-gradient(140px 130px at 88% 10%,#22c55e30,transparent 70%),radial-gradient(150px 140px at 10% 92%,hsl(var(--primary)/.24),transparent 70%),linear-gradient(160deg,var(--soft),var(--bg))}
.ht-panel{position:absolute;inset:9% 8% 12%;background:var(--card);border:1px solid var(--line);border-radius:14px;box-shadow:var(--sh);padding:11px 12px;color:var(--ink);overflow:hidden;display:flex;flex-direction:column;gap:7px}
.ht-num{font-variant-numeric:tabular-nums}
.ht-lbl{font-size:8px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:var(--mut)}
.ht-tag{font-size:8px;font-weight:800;letter-spacing:.08em;color:hsl(var(--primary));background:hsl(var(--primary)/.12);padding:2px 6px;border-radius:20px}
.ht-good{color:var(--good)!important}
.ht-ph{display:flex;align-items:center;justify-content:space-between}
.ht-ph b{font-size:11px;font-weight:800;letter-spacing:-.01em}

/* reveals + CTA */
@keyframes htR1{0%{opacity:0;transform:translateY(9px)}6%{opacity:1;transform:none}96%{opacity:1;transform:none}100%{opacity:0}}
@keyframes htR2{0%,32%{opacity:0;transform:translateY(9px)}40%{opacity:1;transform:none}96%{opacity:1;transform:none}100%{opacity:0}}
@keyframes htR3{0%,64%{opacity:0;transform:translateY(9px)}72%{opacity:1;transform:none}96%{opacity:1;transform:none}100%{opacity:0}}
.ht-s1{animation:htR1 var(--loop) cubic-bezier(.16,1,.3,1) infinite}
.ht-s2{animation:htR2 var(--loop) cubic-bezier(.16,1,.3,1) infinite}
.ht-s3{animation:htR3 var(--loop) cubic-bezier(.16,1,.3,1) infinite}
.ht-cta{position:absolute;left:0;right:0;bottom:0;z-index:7;padding:10px 11px;display:flex;background:linear-gradient(0deg,rgba(10,16,34,.26),transparent)}
.ht-btn{font:800 10px ui-sans-serif;color:#fff;background:var(--grad,linear-gradient(120deg,hsl(var(--primary)),#7c6bff));padding:6px 12px;border-radius:22px;display:inline-flex;gap:5px;align-items:center;position:relative;overflow:hidden;box-shadow:0 9px 20px -7px hsl(var(--primary)/.8),inset 0 1px 0 rgba(255,255,255,.4)}
.ht-arr{font-size:11px}
@keyframes htShine{0%{left:-70%}20%,100%{left:130%}}
.ht-btn::after{content:"";position:absolute;top:0;left:-70%;width:45%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.6),transparent);animation:htShine 6s ease-in-out infinite}

/* shared controls */
.ht-chips{display:flex;gap:5px}
.ht-chip{flex:1;border:1px solid var(--line);border-radius:8px;padding:4px 6px;background:var(--bg)}
.ht-chip .ht-lbl{font-size:7px}.ht-chip b{display:block;font-size:9.5px;font-weight:800;margin-top:1px;color:var(--ink)}
.ht-seg{display:inline-flex;align-self:flex-start;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--bg)}
.ht-seg span{font-size:8.5px;font-weight:800;padding:4px 8px;color:var(--mut)}
.ht-seg .ht-on{background:var(--grad);color:#fff}
.ht-avatar{width:22px;height:22px;border-radius:99px;color:#fff;display:grid;place-items:center;font:800 8px ui-sans-serif;flex:none;box-shadow:0 3px 8px rgba(15,23,42,.25)}
.ht-s-a{background:var(--grad)}.ht-s-b{background:linear-gradient(135deg,#f5b83d,#f4476b)}.ht-s-c{background:linear-gradient(135deg,#22c55e,#0ea5e9)}
.ht-lt{flex:1;display:flex;flex-direction:column;gap:4px;min-width:0}
.ht-lt i{height:4px;border-radius:3px;background:var(--soft)}
.ht-badge{font:800 7px ui-sans-serif;color:#fff;background:var(--good);padding:3px 6px;border-radius:20px;white-space:nowrap}
.ht-mutedbadge{background:var(--soft);color:var(--mut)}
.ht-star{font:800 8px ui-sans-serif;color:#f5b83d;white-space:nowrap}
.ht-when{font:800 8px ui-sans-serif;color:var(--mut);white-space:nowrap}

/* ANALYTICS */
.ht-bigrow{display:flex;align-items:baseline;justify-content:space-between;margin-top:1px}
.ht-big{font-size:23px;font-weight:800;letter-spacing:-.02em;background:var(--gradG);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.ht-svg{position:relative;height:26px}
.ht-svg svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
@keyframes htDraw{0%{stroke-dashoffset:200}16%{stroke-dashoffset:200}60%{stroke-dashoffset:0}96%{stroke-dashoffset:0}100%{stroke-dashoffset:200}}
.ht-line{fill:none;stroke:url(#htGg);stroke-width:2.4;stroke-linecap:round;stroke-dasharray:200;filter:drop-shadow(0 3px 4px rgba(34,197,94,.35));animation:htDraw var(--loop) ease-in-out infinite}

/* VOICE */
.ht-voarea{position:relative;flex:1;margin:2px 0}
.ht-wave{position:absolute;inset:0;display:flex;align-items:center;gap:2px}
.ht-wave i{flex:1;border-radius:3px;background:linear-gradient(180deg,#7c6bff,hsl(var(--primary)));transform-origin:center;animation:htVb 2.2s ease-in-out infinite}
@keyframes htVb{0%,100%{transform:scaleY(.55)}50%{transform:scaleY(1)}}
@keyframes htHead{0%{left:0}96%{left:100%}100%{left:100%}}
.ht-head{position:absolute;top:0;bottom:0;width:2px;background:hsl(var(--primary));box-shadow:0 0 8px hsl(var(--primary)/.7);animation:htHead var(--loop) linear infinite}
.ht-vorow{display:flex;align-items:center;gap:6px}
.ht-play{width:26px;height:26px;border-radius:99px;background:var(--grad);display:grid;place-items:center;flex:none;box-shadow:0 8px 16px -5px hsl(var(--primary)/.7)}
.ht-chipm{font:800 8px ui-sans-serif;color:var(--mut);border:1px solid var(--line);border-radius:7px;padding:3px 6px;background:var(--bg)}

/* DESIGN (poster + props) */
.ht-mini{position:absolute;left:8%;top:10%;bottom:12%;width:50%;border-radius:11px;overflow:hidden;background:linear-gradient(160deg,#6d5efc,#8b7bff 60%,#b06bff);box-shadow:0 14px 26px -12px rgba(60,40,140,.55)}
.ht-me{position:absolute;left:11px;top:12px;font:800 6px ui-sans-serif;letter-spacing:.16em;color:rgba(255,255,255,.85)}
.ht-mh{position:absolute;left:11px;top:24px;font:800 16px/.95 ui-sans-serif;color:#fff;letter-spacing:-.02em}
.ht-mph{position:absolute;right:9px;bottom:26px;width:42%;height:30%;border-radius:6px;background:radial-gradient(60% 55% at 40% 32%,#ffe1ba,transparent),linear-gradient(150deg,#f6b93b,#f4476b)}
.ht-mc{position:absolute;left:11px;bottom:12px;font:800 6px ui-sans-serif;color:#3a1d00;background:#ffd15c;padding:4px 8px;border-radius:16px}
.ht-props{position:absolute;right:8%;top:14%;width:32%;background:var(--card);border:1px solid var(--line);border-radius:11px;box-shadow:var(--sh);padding:8px;display:flex;flex-direction:column;gap:6px}
.ht-swrow{display:flex;gap:5px}
.ht-swrow i{flex:1;height:14px;border-radius:5px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.06)}
.ht-gen{margin-top:2px;font:800 7.5px ui-sans-serif;color:#fff;background:var(--grad);text-align:center;padding:5px;border-radius:8px}

/* LOGO */
.ht-brandcard{gap:0}
.ht-logorow{display:flex;align-items:center;gap:11px;flex:1}
.ht-markwrap{position:relative;width:46px;height:46px;flex:none}
.ht-mk{position:absolute;inset:0;display:grid;place-items:center;font:800 24px ui-sans-serif;color:#fff;border-radius:14px}
.ht-mk::after{content:"";position:absolute;top:6%;left:12%;width:76%;height:34%;border-radius:12px 12px 40px 40px/12px;background:linear-gradient(180deg,rgba(255,255,255,.5),transparent)}
@keyframes htMk1{0%{opacity:0;transform:scale(.7)}4%{opacity:1;transform:none}30%{opacity:1}34%{opacity:0}100%{opacity:0}}
@keyframes htMk2{0%,30%{opacity:0;transform:scale(.7)}36%{opacity:1;transform:none}63%{opacity:1}67%{opacity:0}100%{opacity:0}}
@keyframes htMk3{0%,63%{opacity:0;transform:scale(.7)}70%{opacity:1;transform:none}94%{opacity:1}100%{opacity:0}}
.ht-mk1{animation:htMk1 var(--loop) ease-in-out infinite;background:var(--grad);box-shadow:0 12px 22px -8px hsl(var(--primary)/.7)}
.ht-mk2{animation:htMk2 var(--loop) ease-in-out infinite;border-radius:99px!important;background:linear-gradient(145deg,#f7c65a,#f4476b);box-shadow:0 12px 22px -8px rgba(244,71,107,.55)}
.ht-mk3{animation:htMk3 var(--loop) ease-in-out infinite;background:linear-gradient(145deg,#22c55e,#0ea5e9);box-shadow:0 12px 22px -8px rgba(14,159,110,.5)}
.ht-wm b{font:800 14px ui-sans-serif;letter-spacing:-.02em;color:var(--ink)}
.ht-wm i{display:block;margin-top:5px;width:64%;height:4px;border-radius:3px;background:var(--soft)}

/* GALLERY */
.ht-gallery .ht-grid{flex:1;display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:1fr;gap:5px}
.ht-tile{position:relative;border-radius:6px;overflow:hidden;box-shadow:inset 0 1px 0 rgba(255,255,255,.18)}
.ht-tile::after{content:"";position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.16),transparent 45%)}
.ht-g1{background:linear-gradient(135deg,#0ea5e9,#6366f1)}.ht-g2{background:linear-gradient(135deg,#f59e0b,#f43f5e)}
.ht-g3{background:linear-gradient(135deg,#10b981,#047857)}.ht-g4{background:linear-gradient(135deg,#8b5cf6,#ec4899)}
.ht-g5{background:linear-gradient(135deg,#f43f5e,#f59e0b)}.ht-g6{background:linear-gradient(135deg,#06b6d4,#3b82f6)}
.ht-g7{background:linear-gradient(135deg,#84cc16,#16a34a)}.ht-g8{background:linear-gradient(135deg,#a855f7,#6366f1)}
.ht-play::before{content:"▶";position:absolute;inset:0;display:grid;place-items:center;color:rgba(255,255,255,.95);font-size:11px;z-index:2}
.ht-pic::before{content:"";position:absolute;left:16%;bottom:18%;width:32%;height:32%;background:rgba(255,255,255,.9);clip-path:polygon(0 100%,42% 34%,68% 66%,100% 20%,100% 100%);z-index:2}

/* MAP */
.ht-mapscene{position:absolute;inset:0}
.ht-mapbg{position:absolute;inset:0;background:linear-gradient(115deg,transparent 40%,hsl(var(--primary)/.18) 41% 47%,transparent 48%),repeating-linear-gradient(90deg,var(--line) 0 1px,transparent 1px 30px),repeating-linear-gradient(0deg,var(--line) 0 1px,transparent 1px 30px),linear-gradient(135deg,hsl(var(--primary)/.1),var(--soft))}
.ht-searchpill{position:absolute;top:9px;left:9px;right:40%;height:20px;border-radius:8px;background:var(--card);border:1px solid var(--line);display:flex;align-items:center;gap:6px;padding:0 8px;box-shadow:var(--sh)}
.ht-sdot{width:7px;height:7px;border-radius:99px;background:hsl(var(--primary))}
.ht-searchpill b{font:700 8px ui-sans-serif;color:var(--ink)}
.ht-reslist{position:absolute;top:9px;right:9px;width:36%;bottom:24%;border-radius:9px;background:var(--card);border:1px solid var(--line);box-shadow:var(--sh);padding:6px;display:flex;flex-direction:column;gap:5px;overflow:hidden}
.ht-resr{display:flex;align-items:center;gap:5px}.ht-resr .ht-avatar{width:16px;height:16px;font-size:6px;border-radius:5px}
.ht-resr .ht-star{font-size:6.5px}
@keyframes htDrop{0%{opacity:0;transform:translateY(-16px) scale(.5)}9%{opacity:1;transform:translateY(2px) scale(1.05)}12%{transform:none}96%{opacity:1}100%{opacity:0}}
.ht-pinwrap{position:absolute}
.ht-pin{position:absolute;left:-8px;top:-16px;width:15px;height:15px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:hsl(var(--primary));box-shadow:0 4px 7px rgba(0,0,0,.35)}
.ht-pin.ht-pb{background:#7c6bff}.ht-pin.ht-pc{background:#22c55e}
.ht-pin::after{content:"";position:absolute;inset:4px;border-radius:50%;background:#fff}
.ht-pshadow{position:absolute;left:-6px;top:1px;width:12px;height:4px;border-radius:50%;background:rgba(0,0,0,.28);filter:blur(1px)}
.ht-pa{animation:htDrop var(--loop) cubic-bezier(.3,1.5,.5,1) infinite}
.ht-pb{animation:htDrop var(--loop) cubic-bezier(.3,1.5,.5,1) infinite;animation-delay:-9.3s}
.ht-pc{animation:htDrop var(--loop) cubic-bezier(.3,1.5,.5,1) infinite;animation-delay:-4.6s}

/* QUEUE + list rows */
.ht-post,.ht-lr{display:flex;align-items:center;gap:8px;background:var(--bg);border:1px solid var(--line);border-radius:9px;padding:6px 7px}
.ht-pim{width:28px;height:28px;border-radius:6px;flex:none;box-shadow:0 3px 8px rgba(0,0,0,.2)}
.ht-im-a{background:radial-gradient(60% 60% at 40% 35%,#ffe0b8,transparent),linear-gradient(150deg,#8b5cf6,#3bb6f8)}
.ht-im-b{background:linear-gradient(150deg,#f5b93d,#f4476b)}.ht-im-c{background:linear-gradient(150deg,#22c55e,#0ea5e9)}
.ht-dname{font:800 9px ui-sans-serif;color:var(--ink)}

/* WEBSITE */
.ht-browser{position:absolute;inset:8%;border-radius:11px;overflow:hidden;background:var(--card);border:1px solid var(--line);box-shadow:var(--sh)}
.ht-bbar{height:22px;display:flex;align-items:center;gap:5px;padding:0 8px;background:var(--soft);border-bottom:1px solid var(--line)}
.ht-bbar>span{width:6px;height:6px;border-radius:99px}
.ht-dotr{background:#f4476b}.ht-doty{background:#f5b83d}.ht-dotg{background:#22c55e}
.ht-url{margin-left:6px;flex:1;height:10px;border-radius:5px;background:var(--soft)}
.ht-wpage{position:absolute;inset:22px 0 0;padding:9px 10px;display:flex;flex-direction:column;gap:8px}
.ht-wnav{display:flex;gap:6px}.ht-wnav i{width:22px;height:5px;border-radius:3px;background:var(--soft)}
.ht-whero{height:36%;border-radius:8px;background:radial-gradient(60% 60% at 35% 30%,#a78bfacc,transparent),linear-gradient(150deg,hsl(var(--primary)),#7c6bff)}
.ht-wline{height:6px;border-radius:3px;background:var(--soft)}
.ht-wgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:1px}
.ht-wgrid span{height:28px;border-radius:6px;background:var(--soft);border:1px solid var(--line)}

/* REVIEWS */
.ht-ratingrow{display:flex;align-items:center;gap:9px}
.ht-rating{font-size:26px;font-weight:800;letter-spacing:-.02em;color:var(--ink)}
.ht-stars{display:flex;gap:1px}.ht-st{color:#f5b83d;font-size:13px;line-height:1}

/* FLOW */
.ht-flowcard{justify-content:center}
.ht-node{display:flex;align-items:center;gap:7px;background:var(--bg);border:1px solid var(--line);border-radius:9px;padding:6px 8px;box-shadow:0 3px 8px -4px rgba(0,0,0,.3)}
.ht-node .ht-lbl{white-space:nowrap}
.ht-ndot{width:13px;height:13px;border-radius:5px;flex:none;box-shadow:0 0 8px currentColor}
.ht-nd1{background:hsl(var(--primary));color:hsl(var(--primary))}.ht-nd2{background:#7c6bff;color:#7c6bff}.ht-nd3{background:#22c55e;color:#22c55e}
.ht-conn{width:2px;height:9px;margin-left:14px;border-radius:2px;background:linear-gradient(180deg,hsl(var(--primary)),#7c6bff)}

/* FORM */
.ht-formcard{gap:5px}
.ht-flabel{font-size:8px;font-weight:700;color:var(--mut)}
.ht-finput{height:15px;border-radius:7px;background:var(--bg);border:1px solid var(--line);position:relative}
.ht-caret{position:absolute;left:7px;top:4px;width:1.5px;height:7px;background:hsl(var(--primary));animation:htBlink 1.1s steps(1) infinite}
@keyframes htBlink{0%,50%{opacity:1}51%,100%{opacity:0}}
.ht-fsubmit{margin-top:3px;align-self:flex-start;font:800 8px ui-sans-serif;color:#fff;background:var(--grad);padding:6px 12px;border-radius:20px;box-shadow:0 7px 15px -5px hsl(var(--primary)/.7)}

/* PROPOSAL */
.ht-doc{gap:6px}
.ht-drings{position:absolute;right:12px;top:11px}
.ht-ring{width:34px;height:34px;border-radius:99px;display:grid;place-items:center;background:conic-gradient(hsl(var(--primary)) 0 82%,var(--soft) 82% 100%)}
.ht-ring::after{content:"";position:absolute;inset:4px;border-radius:99px;background:var(--card)}
.ht-ring b{position:relative;font:800 12px ui-sans-serif;color:var(--ink)}
.ht-drow{display:flex;align-items:center;gap:8px}
.ht-drow i{flex:1;height:5px;border-radius:3px;background:var(--soft)}
.ht-drow b{font:800 9px ui-sans-serif;color:var(--ink)}
.ht-dtotal{display:flex;align-items:center;justify-content:space-between;margin-top:auto;border-top:1px solid var(--line);padding-top:6px}
.ht-dtotal b{font:800 12px ui-sans-serif}

/* PRODUCT */
.ht-productcard{gap:6px}
.ht-pimg{position:relative;height:48%;border-radius:9px;background:radial-gradient(60% 60% at 40% 32%,#ffe0b8,transparent),linear-gradient(150deg,#8b5cf6,hsl(var(--primary)));box-shadow:inset 0 1px 0 rgba(255,255,255,.25)}
.ht-floatbadge{position:absolute;top:6px;left:6px}
.ht-ptitle{display:flex;align-items:center;justify-content:space-between}
.ht-ptitle b{font:800 10px ui-sans-serif;color:var(--ink)}
.ht-prow{margin-top:auto;display:flex;align-items:center;justify-content:space-between}
.ht-price{font:800 14px ui-sans-serif;color:var(--ink)}
.ht-cart{font:800 8px ui-sans-serif;color:#fff;background:var(--grad);padding:6px 10px;border-radius:20px;box-shadow:0 7px 15px -5px hsl(var(--primary)/.7)}

/* GLOBE / domains */
.ht-globeic{font-size:13px;color:hsl(var(--primary))}
.ht-globedot{width:16px;height:16px;border-radius:99px;flex:none;background:radial-gradient(circle at 36% 30%,#7fd3ff,hsl(var(--primary)) 62%);box-shadow:inset -2px -2px 5px rgba(0,0,0,.35),0 2px 5px rgba(0,0,0,.25);position:relative;overflow:hidden}
.ht-globedot::after{content:"";position:absolute;inset:0;border-radius:99px;background:repeating-linear-gradient(0deg,transparent 0 3px,rgba(255,255,255,.25) 3px 3.6px),repeating-linear-gradient(90deg,transparent 0 4px,rgba(255,255,255,.2) 4px 4.5px)}
.ht-gd2{background:radial-gradient(circle at 36% 30%,#c4b5fd,#7c6bff 62%)}
.ht-gd3{background:radial-gradient(circle at 36% 30%,#86efac,#22c55e 62%)}

/* CALENDAR */
.ht-calcard{gap:6px}
.ht-calnav{font:800 10px ui-sans-serif;color:var(--mut);letter-spacing:2px}
.ht-calgrid{flex:1;display:grid;grid-template-columns:repeat(7,1fr);grid-auto-rows:1fr;gap:4px}
.ht-cell{border-radius:4px;background:var(--bg);border:1px solid var(--line);display:grid;place-items:center}
.ht-cdot{width:8px;height:8px;border-radius:3px;background:hsl(var(--primary));box-shadow:0 0 7px hsl(var(--primary)/.6)}
.ht-cdot-g{background:#22c55e;box-shadow:0 0 7px rgba(34,197,94,.55)}

@media (prefers-reduced-motion: reduce){
  .ht-s1,.ht-s2,.ht-s3,.ht-mk,.ht-line,.ht-head,.ht-pa,.ht-pb,.ht-pc,.ht-wave i,.ht-btn::after,.ht-caret{animation:none!important;opacity:1!important;transform:none!important}
  .ht-mk1,.ht-mk2{opacity:0!important}.ht-line{stroke-dashoffset:0!important}
}
`;
