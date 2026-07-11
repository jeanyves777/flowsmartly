import { cn } from "@/lib/utils/cn";

/**
 * HubThumb — full-bleed, 30-second, 3-step CSS animations used as the hub-card
 * thumbnails (replacing the static/cutout images). Every scene fills the card
 * window, loops through 3 states over 30s, and carries a call-to-action pill.
 * The card itself is a <button>, so the CTA rides the card's click (it opens the
 * studio) — no nested button. Video Studio keeps its real MP4 (see CreateThumb).
 * [[menu-restructure-create-hub]] [[no-internal-details-in-ui]]
 */

export type HubScene =
  | "poster" | "logo" | "voice" | "gallery"
  | "analytics" | "map" | "queue" | "website" | "list"
  | "reviews" | "flow" | "form" | "proposal" | "product" | "globe" | "calendar";

// Which calendar cells get a scheduled-post dot, and in which of the 3 steps.
const CAL_POSTS: Record<number, { step: string; color: string }> = {
  3: { step: "ht-s1", color: "#a78bfa" }, 9: { step: "ht-s1", color: "#3bb6f8" },
  12: { step: "ht-s2", color: "#f5b83d" }, 16: { step: "ht-s2", color: "#27c98a" },
  20: { step: "ht-s3", color: "#f4476b" }, 25: { step: "ht-s3", color: "#7c6bff" },
};

// A natural-looking waveform envelope (deterministic — no Math.random).
const WAVE = Array.from({ length: 40 }, (_, i) => {
  const env = Math.sin((i / 39) * Math.PI);
  const detail = 0.5 + 0.5 * Math.abs(Math.sin(i * 1.7)) * Math.abs(Math.cos(i * 0.6));
  return Math.max(10, Math.round(env * detail * 100));
});

export function HubThumb({ scene, cta }: { scene: HubScene; cta: string }) {
  return (
    <div className="ht-root">
      {scene === "poster" && (
        <div className="ht ht-design">
          <div className="ht-frame">
            <div className="ht-pad">
              <div className="ht-eye ht-s1">SUMMER · 2026</div>
              <div className="ht-head ht-s1">Big<br />Sale</div>
              <div className="ht-sub ht-s2" /><div className="ht-sub ht-s2" />
            </div>
            <div className="ht-photo ht-s2" />
            <div className="ht-badge ht-s3" />
            <div className="ht-handles ht-s3"><span style={{ left: "5%", top: "5%" }} /><span style={{ right: "5%", top: "5%" }} /><span style={{ left: "5%", bottom: "5%" }} /><span style={{ right: "5%", bottom: "5%" }} /></div>
          </div>
          <div className="ht-cursor">▲</div>
          <div className="ht-gloss" />
        </div>
      )}

      {scene === "logo" && (
        <div className="ht ht-logo">
          <div className="ht-markwrap"><div className="ht-mark ht-m1">F</div><div className="ht-mark ht-m2">F</div><div className="ht-mark ht-m3">F</div></div>
          <div className="ht-word"><div className="ht-wm ht-s2">FlowSmartly</div><div className="ht-tl ht-s2" /></div>
          <div className="ht-swatches">
            <i className="ht-s3" style={{ background: "linear-gradient(135deg,#8b7bff,#5a48d6)" }} />
            <i className="ht-s3" style={{ background: "linear-gradient(135deg,#f7c65a,#f4476b)" }} />
            <i className="ht-s3" style={{ background: "linear-gradient(135deg,#43e0a6,#0e9f6e)" }} />
            <i className="ht-s3" style={{ background: "linear-gradient(135deg,#3bb6f8,#6366f1)" }} />
          </div>
          <div className="ht-gloss" />
        </div>
      )}

      {scene === "voice" && (
        <div className="ht ht-voice">
          <div className="ht-lab">VOICEOVER · natural</div>
          <div className="ht-waveamp"><div className="ht-wave">{WAVE.map((h, i) => <i key={i} style={{ height: `${h}%`, animationDelay: `${(i % 7) * -0.35}s` }} />)}</div></div>
          <div className="ht-playhead" />
          <div className="ht-time">0:12 / 0:30</div>
        </div>
      )}

      {scene === "gallery" && (
        <div className="ht ht-gallery">
          <span className="ht-tile ht-t-sky ht-pic ht-s1" /><span className="ht-tile ht-t-amb ht-s1" />
          <span className="ht-tile ht-t-emr ht-play ht-s2" /><span className="ht-tile ht-t-vio ht-s2" />
          <span className="ht-tile ht-t-ros ht-s3" /><span className="ht-tile ht-t-cya ht-pic ht-s3" /><span className="ht-tile ht-t-lim ht-s3" /><span className="ht-tile ht-t-pur ht-play ht-s3" />
          <div className="ht-gloss" />
        </div>
      )}

      {scene === "analytics" && (
        <div className="ht ht-ad">
          <div className="ht-adh"><b>ROAS</b><span className="ht-roas">4.8×</span><span className="ht-up">▲ 62%</span></div>
          <div className="ht-chart">
            <div className="ht-grid" />
            <svg viewBox="0 0 100 42" preserveAspectRatio="none">
              <defs>
                <linearGradient id="htAdg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#3bb6f8" /><stop offset="1" stopColor="#a78bfa" /></linearGradient>
                <linearGradient id="htAda" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3bb6f8" stopOpacity=".45" /><stop offset="1" stopColor="#3bb6f8" stopOpacity="0" /></linearGradient>
              </defs>
              <path className="ht-area" d="M2,36 L20,30 L38,32 L56,20 L74,13 L98,4 L98,42 L2,42 Z" />
              <path className="ht-line" d="M2,36 L20,30 L38,32 L56,20 L74,13 L98,4" />
            </svg>
            <div className="ht-dot" />
          </div>
        </div>
      )}

      {scene === "map" && (
        <div className="ht ht-map">
          <div className="ht-search"><span className="ht-sdot" /><b>Near me</b></div>
          <div className="ht-mlist"><div className="ht-mr"><i style={{ background: "#a78bfa" }} /><span /></div><div className="ht-mr"><i style={{ background: "#3bb6f8" }} /><span style={{ width: "70%" }} /></div><div className="ht-mr"><i style={{ background: "#f5b83d" }} /><span style={{ width: "85%" }} /></div></div>
          {[["22%", "46%", "#a78bfa", "ht-pa"], ["40%", "36%", "#3bb6f8", "ht-pa"], ["32%", "64%", "#f5b83d", "ht-pc"], ["54%", "56%", "#27c98a", "ht-pc"], ["24%", "76%", "#f4476b", "ht-pb"], ["48%", "78%", "#7c6bff", "ht-pb"]].map(([l, t, c, cls], i) => (
            <div key={i} className="ht-pinwrap" style={{ left: l, top: t }}><div className="ht-pshadow" /><div className={cn("ht-pin", cls)} style={{ background: c }} /></div>
          ))}
        </div>
      )}

      {scene === "queue" && (
        <div className="ht ht-queue">
          <div className="ht-post ht-s1"><div className="ht-im ht-im-a" /><div className="ht-tx"><i style={{ width: "82%" }} /><i style={{ width: "60%" }} /></div><div className="ht-ck">✓ Mon 9:00</div></div>
          <div className="ht-post ht-s2"><div className="ht-im ht-im-b" /><div className="ht-tx"><i style={{ width: "74%" }} /><i style={{ width: "66%" }} /></div><div className="ht-ck">✓ Wed 12:00</div></div>
          <div className="ht-post ht-s3"><div className="ht-im ht-im-c" /><div className="ht-tx"><i style={{ width: "80%" }} /><i style={{ width: "54%" }} /></div><div className="ht-ck">✓ Fri 17:30</div></div>
        </div>
      )}

      {scene === "website" && (
        <div className="ht ht-website">
          <div className="ht-browser">
            <div className="ht-bbar"><span /><span /><span /><div className="ht-url ht-s1" /></div>
            <div className="ht-page">
              <div className="ht-wnav ht-s1"><i /><i /><i /></div>
              <div className="ht-whero ht-s2" />
              <div className="ht-wline ht-s2" style={{ width: "70%" }} />
              <div className="ht-wgrid ht-s3"><span /><span /><span /></div>
            </div>
          </div>
          <div className="ht-gloss" />
        </div>
      )}

      {scene === "list" && (
        <div className="ht ht-list">
          <div className="ht-lr ht-s1"><span className="ht-av" style={{ background: "linear-gradient(135deg,#8b7bff,#5a48d6)" }} /><div className="ht-lt"><i style={{ width: "70%" }} /><i style={{ width: "44%" }} /></div><span className="ht-lb" /></div>
          <div className="ht-lr ht-s2"><span className="ht-av" style={{ background: "linear-gradient(135deg,#3bb6f8,#6366f1)" }} /><div className="ht-lt"><i style={{ width: "80%" }} /><i style={{ width: "52%" }} /></div><span className="ht-lb" /></div>
          <div className="ht-lr ht-s3"><span className="ht-av" style={{ background: "linear-gradient(135deg,#27c98a,#0ea5e9)" }} /><div className="ht-lt"><i style={{ width: "64%" }} /><i style={{ width: "40%" }} /></div><span className="ht-lb" /></div>
        </div>
      )}

      {scene === "reviews" && (
        <div className="ht ht-reviews">
          <div className="ht-rating"><b>4.9</b><div className="ht-stars"><span className="ht-st ht-s1">★</span><span className="ht-st ht-s1">★</span><span className="ht-st ht-s2">★</span><span className="ht-st ht-s2">★</span><span className="ht-st ht-s3">★</span></div></div>
          <div className="ht-rev ht-s2"><span className="ht-rav" style={{ background: "linear-gradient(135deg,#8b7bff,#5a48d6)" }} /><div className="ht-rl"><i style={{ width: "72%" }} /><i style={{ width: "50%" }} /></div><span className="ht-rst">★★★★★</span></div>
          <div className="ht-rev ht-s3"><span className="ht-rav" style={{ background: "linear-gradient(135deg,#f5b93d,#f4476b)" }} /><div className="ht-rl"><i style={{ width: "82%" }} /><i style={{ width: "44%" }} /></div><span className="ht-rst">★★★★★</span></div>
        </div>
      )}

      {scene === "flow" && (
        <div className="ht ht-flow">
          <div className="ht-node ht-n1 ht-s1"><span className="ht-ndot" style={{ background: "#a78bfa" }} /><div className="ht-nl"><i /><i style={{ width: "60%" }} /></div></div>
          <div className="ht-conn ht-c1 ht-s2" />
          <div className="ht-node ht-n2 ht-s2"><span className="ht-ndot" style={{ background: "#3bb6f8" }} /><div className="ht-nl"><i /><i style={{ width: "60%" }} /></div></div>
          <div className="ht-conn ht-c2 ht-s3" />
          <div className="ht-node ht-n3 ht-s3"><span className="ht-ndot" style={{ background: "#27c98a" }} /><div className="ht-nl"><i /><i style={{ width: "60%" }} /></div></div>
        </div>
      )}

      {scene === "form" && (
        <div className="ht ht-form">
          <div className="ht-fcard">
            <div className="ht-flabel ht-s1" style={{ width: "34%" }} /><div className="ht-finput ht-s1"><span className="ht-caret" /></div>
            <div className="ht-flabel ht-s2" style={{ width: "44%" }} /><div className="ht-finput ht-s2" />
            <div className="ht-fsubmit ht-s3">Submit ✓</div>
          </div>
        </div>
      )}

      {scene === "proposal" && (
        <div className="ht ht-proposal">
          <div className="ht-doc">
            <div className="ht-dtitle ht-s1" /><div className="ht-dsub ht-s1" />
            <div className="ht-dring ht-s2"><b>92</b></div>
            <div className="ht-drow ht-s2"><i /><b /></div>
            <div className="ht-drow ht-s3"><i /><b /></div>
            <div className="ht-dtotal ht-s3">$12,400</div>
          </div>
        </div>
      )}

      {scene === "product" && (
        <div className="ht ht-product">
          <div className="ht-pcard">
            <div className="ht-pimg ht-s1" />
            <div className="ht-pttl ht-s2" /><div className="ht-pttl ht-s2" style={{ width: "54%" }} />
            <div className="ht-prow ht-s3"><span className="ht-price">$49</span><span className="ht-pcart">Add to cart</span></div>
          </div>
        </div>
      )}

      {scene === "globe" && (
        <div className="ht ht-globe">
          <div className="ht-sphere ht-s1" />
          <div className="ht-dpill ht-dp-a ht-s2">yourbrand.com</div>
          <div className="ht-dpill ht-dp-b ht-s3">.io</div>
          <div className="ht-dpill ht-dp-c ht-s3">.store</div>
        </div>
      )}

      {scene === "calendar" && (
        <div className="ht ht-calendar">
          <div className="ht-calhead"><b>November</b><span className="ht-calnav">‹ ›</span></div>
          <div className="ht-calgrid">
            {Array.from({ length: 28 }, (_, i) => {
              const p = CAL_POSTS[i];
              return <span key={i} className="ht-cell">{p && <i className={cn("ht-cdot", p.step)} style={{ background: p.color }} />}</span>;
            })}
          </div>
        </div>
      )}

      <div className="ht-cta"><span className="ht-btn">{cta} <span className="ht-arr">→</span></span></div>
      <div className="ht-grain" /><div className="ht-vig" />
    </div>
  );
}

// One <style> block for all scenes — rendered once inside the hub panel. Kept as
// a raw stylesheet (many keyframes / descendant selectors) rather than Tailwind.
export function HubThumbStyles() {
  return <style dangerouslySetInnerHTML={{ __html: HUB_THUMB_CSS }} />;
}

const HUB_THUMB_CSS = `
.ht-root{position:absolute;inset:0;--loop:30s}
.ht{position:absolute;inset:0}
.ht-grain{position:absolute;inset:0;pointer-events:none;opacity:.05;mix-blend-mode:overlay;z-index:6;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
.ht-vig{position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 55px rgba(0,0,0,.4);z-index:6}
.ht-cta{position:absolute;left:0;right:0;bottom:0;z-index:7;padding:11px 12px;display:flex;
  background:linear-gradient(0deg,rgba(4,6,12,.74),rgba(4,6,12,.2) 62%,transparent)}
.ht-btn{font:800 10.5px ui-sans-serif;color:#fff;background:linear-gradient(90deg,#7c6bff,#a78bfa);
  padding:7px 13px;border-radius:22px;display:inline-flex;gap:5px;align-items:center;position:relative;overflow:hidden;
  box-shadow:0 9px 20px -6px rgba(124,107,255,.85),inset 0 1px 0 rgba(255,255,255,.45)}
.ht-arr{font-size:11px}
@keyframes htShine{0%{left:-70%}22%,100%{left:130%}}
.ht-btn::after{content:"";position:absolute;top:0;left:-70%;width:45%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent);animation:htShine 7s ease-in-out infinite}
@keyframes htSweep{0%{transform:translateX(-160%) skewX(-18deg)}100%{transform:translateX(320%) skewX(-18deg)}}
.ht-gloss{position:absolute;top:-30%;left:0;width:45%;height:160%;pointer-events:none;z-index:5;background:linear-gradient(90deg,transparent,rgba(255,255,255,.14),transparent);animation:htSweep 9s ease-in-out infinite}
@keyframes htIn1{0%{opacity:0;transform:translateY(12px) scale(.97)}5%{opacity:1;transform:none}97%{opacity:1;transform:none}100%{opacity:0}}
@keyframes htIn2{0%,33%{opacity:0;transform:translateY(12px) scale(.97)}39%{opacity:1;transform:none}97%{opacity:1;transform:none}100%{opacity:0}}
@keyframes htIn3{0%,66%{opacity:0;transform:translateY(12px) scale(.97)}72%{opacity:1;transform:none}97%{opacity:1;transform:none}100%{opacity:0}}
.ht-s1{animation:htIn1 var(--loop) cubic-bezier(.16,1,.3,1) infinite}
.ht-s2{animation:htIn2 var(--loop) cubic-bezier(.16,1,.3,1) infinite}
.ht-s3{animation:htIn3 var(--loop) cubic-bezier(.16,1,.3,1) infinite}

/* DESIGN */
@keyframes htFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
.ht-design{background:linear-gradient(150deg,#0f1730,#1c1046)}
.ht-frame{position:absolute;inset:5%;border-radius:11px;overflow:hidden;animation:htFloat 9s ease-in-out infinite;background:linear-gradient(165deg,#6b57e6,#8b5cf6 58%,#b268ff);box-shadow:0 20px 38px -14px rgba(20,10,60,.85),inset 0 1px 0 rgba(255,255,255,.28)}
.ht-pad{position:absolute;inset:8% 9% 20%;display:flex;flex-direction:column}
.ht-eye{font:800 8px/1 ui-sans-serif;letter-spacing:.18em;color:rgba(255,255,255,.9)}
.ht-head{font:800 26px/.95 ui-sans-serif;letter-spacing:-.02em;color:#fff;margin-top:6px;text-shadow:0 3px 10px rgba(0,0,0,.28)}
.ht-photo{position:absolute;right:9%;top:42%;width:40%;height:34%;border-radius:8px;overflow:hidden;background:radial-gradient(60% 55% at 40% 32%,#ffe1ba,transparent),linear-gradient(150deg,#f6b93b,#f4476b);box-shadow:0 10px 18px rgba(0,0,0,.32)}
.ht-sub{width:60%;height:5px;border-radius:3px;background:rgba(255,255,255,.62);margin-top:auto}
.ht-sub+.ht-sub{margin-top:6px;width:46%}
.ht-badge{position:absolute;left:8%;bottom:13%;width:22px;height:22px;border-radius:7px;background:linear-gradient(145deg,#fff,#e7e0ff);box-shadow:0 5px 12px rgba(0,0,0,.3)}
.ht-handles span{position:absolute;width:7px;height:7px;border:1.6px solid #fff;border-radius:2px;background:#7c6bff;box-shadow:0 0 0 1px rgba(0,0,0,.25)}
@keyframes htCursor{0%,100%{transform:translate(8px,14px)}30%{transform:translate(0,0)}60%{transform:translate(-10px,30px)}}
.ht-cursor{position:absolute;right:20%;top:26%;z-index:3;font-size:14px;color:#fff;filter:drop-shadow(0 2px 3px rgba(0,0,0,.6));animation:htCursor var(--loop) ease-in-out infinite}

/* LOGO */
.ht-logo{background:radial-gradient(420px 240px at 34% 26%,rgba(124,107,255,.26),transparent 70%),linear-gradient(135deg,#0a1330,#10112c)}
.ht-logo::before{content:"GENERATING BRAND…";position:absolute;top:11px;left:12px;font:800 8px ui-sans-serif;letter-spacing:.16em;color:#67728a}
.ht-markwrap{position:absolute;left:9%;top:24%;width:34%;aspect-ratio:1;display:grid;place-items:center}
.ht-mark{position:absolute;inset:0;display:grid;place-items:center;font:800 34px ui-sans-serif;color:#fff}
.ht-mark::after{content:"";position:absolute;top:6%;left:10%;width:80%;height:36%;border-radius:16px 16px 46px 46px/14px;background:linear-gradient(180deg,rgba(255,255,255,.5),transparent);pointer-events:none}
@keyframes htMk1{0%{opacity:0;transform:scale(.7) rotate(-8deg)}3%{opacity:1;transform:none}30%{opacity:1}34%{opacity:0;transform:scale(1.06)}100%{opacity:0}}
@keyframes htMk2{0%,30%{opacity:0;transform:scale(.7) rotate(8deg)}36%{opacity:1;transform:none}63%{opacity:1}67%{opacity:0;transform:scale(1.06)}100%{opacity:0}}
@keyframes htMk3{0%,63%{opacity:0;transform:scale(.7) rotate(-8deg)}70%{opacity:1;transform:none}94%{opacity:1}100%{opacity:0;transform:scale(1.06)}}
.ht-m1{animation:htMk1 var(--loop) ease-in-out infinite;border-radius:22px;background:linear-gradient(145deg,#8b7bff,#5a48d6);box-shadow:0 16px 30px -10px rgba(90,72,214,.75),inset 0 1px 0 rgba(255,255,255,.5)}
.ht-m2{animation:htMk2 var(--loop) ease-in-out infinite;border-radius:999px;background:linear-gradient(145deg,#f7c65a,#f4476b);box-shadow:0 16px 30px -10px rgba(244,71,107,.6),inset 0 1px 0 rgba(255,255,255,.5)}
.ht-m3{animation:htMk3 var(--loop) ease-in-out infinite;border-radius:22px;background:linear-gradient(145deg,#43e0a6,#0e9f6e);box-shadow:0 16px 30px -10px rgba(14,159,110,.6),inset 0 1px 0 rgba(255,255,255,.5)}
.ht-word{position:absolute;left:50%;top:38%;right:8%}
.ht-wm{font:800 15px ui-sans-serif;letter-spacing:-.02em;color:#fff}
.ht-tl{margin-top:6px;width:70%;height:4px;border-radius:3px;background:rgba(255,255,255,.28)}
.ht-swatches{position:absolute;left:9%;right:9%;bottom:20%;display:flex;gap:7px}
.ht-swatches i{flex:1;height:16px;border-radius:5px;box-shadow:inset 0 1px 0 rgba(255,255,255,.25)}

/* VOICE */
.ht-voice{background:radial-gradient(420px 260px at 50% 46%,rgba(124,107,255,.22),transparent 70%),linear-gradient(135deg,#0a1230,#1b1040)}
.ht-lab{position:absolute;top:11px;left:12px;font:800 8px ui-sans-serif;letter-spacing:.06em;color:#93a0b6}
.ht-waveamp{position:absolute;left:6%;right:6%;top:26%;bottom:30%;transform-origin:center;animation:htPhase var(--loop) ease-in-out infinite}
@keyframes htPhase{0%,8%{transform:scaleY(.32)}25%,41%{transform:scaleY(1)}58%,74%{transform:scaleY(.62)}92%,100%{transform:scaleY(.32)}}
.ht-wave{position:absolute;inset:0;display:flex;align-items:center;gap:2px;filter:drop-shadow(0 0 6px rgba(124,107,255,.5))}
.ht-wave i{flex:1;border-radius:3px;background:linear-gradient(180deg,#a78bfa,#7c6bff);transform-origin:center;animation:htVb 2.6s ease-in-out infinite}
@keyframes htVb{0%,100%{transform:scaleY(.6)}50%{transform:scaleY(1)}}
@keyframes htHead{0%{left:6%}96%{left:94%}100%{left:94%}}
.ht-playhead{position:absolute;top:20%;bottom:30%;width:2px;background:linear-gradient(180deg,transparent,#fff,transparent);box-shadow:0 0 10px rgba(255,255,255,.85);z-index:3;animation:htHead var(--loop) linear infinite}
.ht-time{position:absolute;bottom:12px;right:12px;font:800 8px ui-sans-serif;letter-spacing:.05em;color:#93a0b6}

/* GALLERY */
.ht-gallery{background:#0a0e16;display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:1fr;gap:5px;padding:8px}
.ht-tile{position:relative;border-radius:6px;overflow:hidden;box-shadow:0 6px 12px -6px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.14)}
.ht-tile::after{content:"";position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.18),transparent 45%)}
.ht-t-sky{background:linear-gradient(135deg,#0ea5e9,#6366f1)}.ht-t-amb{background:linear-gradient(135deg,#f59e0b,#f4476b)}
.ht-t-emr{background:linear-gradient(135deg,#10b981,#047857)}.ht-t-vio{background:linear-gradient(135deg,#8b5cf6,#ec4899)}
.ht-t-ros{background:linear-gradient(135deg,#f4476b,#f59e0b)}.ht-t-cya{background:linear-gradient(135deg,#06b6d4,#3b82f6)}
.ht-t-lim{background:linear-gradient(135deg,#84cc16,#16a34a)}.ht-t-pur{background:linear-gradient(135deg,#a855f7,#6366f1)}
.ht-play::before{content:"▶";position:absolute;inset:0;display:grid;place-items:center;color:rgba(255,255,255,.92);font-size:12px;z-index:2}
.ht-pic::before{content:"";position:absolute;left:14%;bottom:16%;width:34%;height:34%;background:rgba(255,255,255,.85);clip-path:polygon(0 100%,42% 34%,68% 66%,100% 20%,100% 100%);z-index:2}

/* ANALYTICS */
.ht-ad{background:radial-gradient(420px 240px at 26% 0%,rgba(59,182,248,.2),transparent 70%),linear-gradient(150deg,#0c223f,#231049);padding:13px 13px 0}
.ht-adh{display:flex;align-items:baseline;gap:6px}
.ht-adh b{font:800 9px ui-sans-serif;color:#93a0b6}
.ht-roas{font:800 18px ui-sans-serif;letter-spacing:-.02em;color:#fff}
.ht-up{font:800 9px ui-sans-serif;color:#27c98a}
.ht-chart{position:absolute;left:0;right:0;bottom:0;top:40%}
.ht-grid{position:absolute;inset:0 0 14% 0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.06) 0 1px,transparent 1px 25%)}
.ht-chart svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
@keyframes htDraw{0%{stroke-dashoffset:230}16%{stroke-dashoffset:230}66%{stroke-dashoffset:0}97%{stroke-dashoffset:0}100%{stroke-dashoffset:230}}
.ht-line{fill:none;stroke:url(#htAdg);stroke-width:2.4;stroke-linecap:round;stroke-dasharray:230;filter:drop-shadow(0 3px 5px rgba(59,182,248,.5));animation:htDraw var(--loop) ease-in-out infinite}
@keyframes htArea{0%,18%{opacity:0}68%{opacity:1}97%{opacity:1}100%{opacity:0}}
.ht-area{fill:url(#htAda);opacity:0;animation:htArea var(--loop) ease-in-out infinite}
@keyframes htDdot{0%,62%{opacity:0;transform:scale(0)}70%{opacity:1;transform:scale(1)}97%{opacity:1}100%{opacity:0}}
.ht-dot{position:absolute;right:5%;top:2%;width:9px;height:9px;border-radius:999px;background:#fff;box-shadow:0 0 0 3px rgba(59,182,248,.5),0 0 12px rgba(59,182,248,.9);animation:htDdot var(--loop) ease-in-out infinite}

/* MAP */
.ht-map{overflow:hidden;background:linear-gradient(115deg,transparent 40%,rgba(59,182,248,.16) 41% 47%,transparent 48%),repeating-linear-gradient(90deg,rgba(255,255,255,.045) 0 1px,transparent 1px 30px),repeating-linear-gradient(0deg,rgba(255,255,255,.045) 0 1px,transparent 1px 30px),linear-gradient(135deg,#122238,#0d2e26)}
.ht-search{position:absolute;top:10px;left:10px;right:38%;height:21px;border-radius:8px;background:rgba(10,14,22,.72);border:1px solid rgba(255,255,255,.14);display:flex;align-items:center;gap:6px;padding:0 8px;backdrop-filter:blur(4px)}
.ht-sdot{width:7px;height:7px;border-radius:999px;background:#a78bfa}
.ht-search b{font:700 8px ui-sans-serif;color:#93a0b6}
.ht-mlist{position:absolute;top:10px;right:10px;width:34%;border-radius:8px;background:rgba(10,14,22,.6);border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(4px);padding:6px;display:flex;flex-direction:column;gap:5px}
.ht-mr{display:flex;align-items:center;gap:5px}
.ht-mr i{width:12px;height:12px;border-radius:3px;flex:none}
.ht-mr span{flex:1;height:4px;border-radius:3px;background:rgba(255,255,255,.28)}
@keyframes htDrop{0%{opacity:0;transform:translateY(-18px) scale(.5)}9%{opacity:1;transform:translateY(2px) scale(1.05)}12%{transform:translateY(0) scale(1)}97%{opacity:1}100%{opacity:0}}
.ht-pinwrap{position:absolute}
.ht-pin{position:absolute;left:-8px;top:-16px;width:16px;height:16px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 4px 7px rgba(0,0,0,.45)}
.ht-pin::after{content:"";position:absolute;inset:4px;border-radius:50%;background:rgba(255,255,255,.92)}
.ht-pshadow{position:absolute;left:-6px;top:1px;width:12px;height:4px;border-radius:50%;background:rgba(0,0,0,.35);filter:blur(1px)}
.ht-pa{animation:htDrop var(--loop) cubic-bezier(.3,1.5,.5,1) infinite}
.ht-pb{animation:htDrop var(--loop) cubic-bezier(.3,1.5,.5,1) infinite;animation-delay:-20s}
.ht-pc{animation:htDrop var(--loop) cubic-bezier(.3,1.5,.5,1) infinite;animation-delay:-10s}

/* QUEUE */
.ht-queue{background:linear-gradient(150deg,#0e2a4a,#1c1046);padding:9px 10px;display:flex;flex-direction:column;gap:7px}
.ht-post{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:9px;padding:7px;box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
.ht-im{width:34px;height:34px;border-radius:6px;flex:none;box-shadow:0 4px 10px rgba(0,0,0,.4)}
.ht-tx{flex:1;display:flex;flex-direction:column;gap:4px}
.ht-tx i{height:4px;border-radius:3px;background:rgba(255,255,255,.3)}
.ht-ck{font:800 6.5px ui-sans-serif;color:#052e1a;background:#27c98a;padding:3px 6px;border-radius:20px;white-space:nowrap}
.ht-im-a{background:radial-gradient(60% 60% at 40% 35%,#ffe0b8,transparent),linear-gradient(150deg,#8b5cf6,#3bb6f8)}
.ht-im-b{background:linear-gradient(150deg,#f5b93d,#f4476b)}
.ht-im-c{background:linear-gradient(150deg,#27c98a,#0ea5e9)}

/* WEBSITE */
.ht-website{background:linear-gradient(150deg,#0f1730,#1c1046);display:grid;place-items:center}
.ht-browser{position:absolute;inset:7%;border-radius:10px;overflow:hidden;background:#0c1119;border:1px solid #2b3446;box-shadow:0 18px 34px -14px rgba(0,0,0,.8),inset 0 1px 0 rgba(255,255,255,.08)}
.ht-bbar{height:22px;display:flex;align-items:center;gap:5px;padding:0 8px;background:#141b26;border-bottom:1px solid #222b3a}
.ht-bbar>span{width:6px;height:6px;border-radius:999px;background:#3a4759}
.ht-bbar>span:nth-child(1){background:#f4476b}.ht-bbar>span:nth-child(2){background:#f5b83d}.ht-bbar>span:nth-child(3){background:#27c98a}
.ht-url{margin-left:6px;flex:1;height:10px;border-radius:5px;background:rgba(255,255,255,.12)}
.ht-page{position:absolute;inset:22px 0 0;padding:10px 11px;display:flex;flex-direction:column;gap:8px}
.ht-wnav{display:flex;gap:6px}
.ht-wnav i{width:24px;height:5px;border-radius:3px;background:rgba(255,255,255,.3)}
.ht-whero{height:34%;border-radius:8px;background:radial-gradient(60% 60% at 35% 30%,rgba(167,139,250,.7),transparent),linear-gradient(150deg,#5a48d6,#3bb6f8);box-shadow:inset 0 1px 0 rgba(255,255,255,.2)}
.ht-wline{height:6px;border-radius:3px;background:rgba(255,255,255,.22)}
.ht-wgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:2px}
.ht-wgrid span{height:34px;border-radius:6px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.1)}

/* LIST */
.ht-list{background:linear-gradient(150deg,#101827,#1a1140);padding:10px;display:flex;flex-direction:column;gap:8px;justify-content:center}
.ht-lr{display:flex;align-items:center;gap:9px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:8px 9px;box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
.ht-av{width:26px;height:26px;border-radius:999px;flex:none;box-shadow:0 4px 10px rgba(0,0,0,.4)}
.ht-lt{flex:1;display:flex;flex-direction:column;gap:5px}
.ht-lt i{height:4px;border-radius:3px;background:rgba(255,255,255,.3)}
.ht-lb{width:26px;height:11px;border-radius:20px;background:rgba(39,201,138,.85);flex:none}

/* REVIEWS */
.ht-reviews{background:radial-gradient(420px 240px at 50% 20%,rgba(245,184,61,.18),transparent 70%),linear-gradient(150deg,#101827,#241512);padding:12px 12px 40px;display:flex;flex-direction:column;gap:8px;justify-content:center}
.ht-rating{display:flex;align-items:center;gap:9px}
.ht-rating b{font:800 28px ui-sans-serif;letter-spacing:-.02em;color:#fff}
.ht-stars{display:flex;gap:2px}
.ht-st{color:#f5b83d;font-size:17px;line-height:1;text-shadow:0 0 8px rgba(245,184,61,.6)}
.ht-rev{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:9px;padding:6px 8px;box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
.ht-rav{width:22px;height:22px;border-radius:999px;flex:none;box-shadow:0 3px 8px rgba(0,0,0,.4)}
.ht-rl{flex:1;display:flex;flex-direction:column;gap:4px}
.ht-rl i{height:4px;border-radius:3px;background:rgba(255,255,255,.3)}
.ht-rst{color:#f5b83d;font-size:8px;letter-spacing:1px}

/* FLOW */
.ht-flow{background:radial-gradient(420px 240px at 50% 40%,rgba(124,107,255,.2),transparent 70%),linear-gradient(150deg,#0e1730,#1c1046)}
.ht-node{position:absolute;left:26%;right:26%;display:flex;align-items:center;gap:7px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:9px;padding:7px 8px;box-shadow:0 6px 14px -6px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.1)}
.ht-n1{top:8%}.ht-n2{top:40%}.ht-n3{top:72%}
.ht-ndot{width:14px;height:14px;border-radius:6px;flex:none;box-shadow:0 0 10px currentColor}
.ht-nl{flex:1;display:flex;flex-direction:column;gap:4px}
.ht-nl i{height:4px;border-radius:3px;background:rgba(255,255,255,.32);width:100%}
.ht-conn{position:absolute;left:calc(50% - 1px);width:2px;border-radius:2px;background:linear-gradient(180deg,#a78bfa,#3bb6f8)}
.ht-c1{top:30%;height:12%}.ht-c2{top:62%;height:12%;background:linear-gradient(180deg,#3bb6f8,#27c98a)}

/* FORM */
.ht-form{background:linear-gradient(150deg,#0f1730,#1c1046);display:grid;place-items:center}
.ht-fcard{position:absolute;inset:12% 16% 22%;border-radius:11px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);box-shadow:inset 0 1px 0 rgba(255,255,255,.1);padding:12px 13px;display:flex;flex-direction:column;gap:7px}
.ht-flabel{height:5px;border-radius:3px;background:rgba(255,255,255,.4)}
.ht-finput{height:16px;border-radius:6px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);position:relative}
.ht-caret{position:absolute;left:7px;top:4px;width:1.5px;height:8px;background:#a78bfa;animation:htBlink 1.1s steps(1) infinite}
@keyframes htBlink{0%,50%{opacity:1}51%,100%{opacity:0}}
.ht-fsubmit{margin-top:auto;align-self:flex-start;font:800 8px ui-sans-serif;color:#fff;background:linear-gradient(90deg,#7c6bff,#a78bfa);padding:6px 11px;border-radius:20px;box-shadow:0 6px 14px -4px rgba(124,107,255,.7)}

/* PROPOSAL */
.ht-proposal{background:linear-gradient(150deg,#0f1730,#221049);display:grid;place-items:center}
.ht-doc{position:absolute;inset:9% 14%;border-radius:9px;background:linear-gradient(180deg,#f7f8fc,#e9ecf6);box-shadow:0 18px 34px -14px rgba(0,0,0,.7);padding:12px 13px;display:flex;flex-direction:column;gap:7px;overflow:hidden}
.ht-dtitle{height:8px;width:54%;border-radius:3px;background:#2a2350}
.ht-dsub{height:4px;width:38%;border-radius:3px;background:#9aa0c0}
.ht-dring{position:absolute;right:12px;top:12px;width:38px;height:38px;border-radius:999px;display:grid;place-items:center;background:conic-gradient(#7c6bff 0 82%,#dfe2ee 82% 100%)}
.ht-dring::after{content:"";position:absolute;inset:5px;border-radius:999px;background:#f7f8fc}
.ht-dring b{position:relative;font:800 12px ui-sans-serif;color:#2a2350}
.ht-drow{display:flex;align-items:center;gap:8px;margin-top:2px}
.ht-drow i{flex:1;height:5px;border-radius:3px;background:#c9cee0}
.ht-drow b{width:22%;height:6px;border-radius:3px;background:#7c6bff}
.ht-dtotal{margin-top:auto;align-self:flex-end;font:800 11px ui-sans-serif;color:#1a8f5e}

/* PRODUCT */
.ht-product{background:linear-gradient(150deg,#0e2140,#231049);display:grid;place-items:center}
.ht-pcard{position:absolute;inset:10% 22%;border-radius:11px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);box-shadow:0 16px 30px -14px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.12);padding:9px;display:flex;flex-direction:column;gap:6px}
.ht-pimg{height:46%;border-radius:8px;background:radial-gradient(60% 60% at 40% 32%,#ffe0b8,transparent),linear-gradient(150deg,#8b5cf6,#3bb6f8);box-shadow:inset 0 1px 0 rgba(255,255,255,.2)}
.ht-pttl{height:5px;border-radius:3px;background:rgba(255,255,255,.32);width:74%}
.ht-prow{margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:6px}
.ht-price{font:800 13px ui-sans-serif;color:#fff}
.ht-pcart{font:800 7.5px ui-sans-serif;color:#052e1a;background:#27c98a;padding:5px 8px;border-radius:20px}

/* GLOBE (domains) */
.ht-globe{background:radial-gradient(360px 220px at 50% 45%,rgba(59,182,248,.2),transparent 70%),linear-gradient(150deg,#0b1a3a,#141235);display:grid;place-items:center}
@keyframes htSpin{to{background-position:0 0,140px 0,0 0}}
.ht-sphere{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);width:44%;aspect-ratio:1;border-radius:999px;
  background:repeating-linear-gradient(90deg,transparent 0 13px,rgba(255,255,255,.16) 13px 14px),radial-gradient(circle at 38% 32%,rgba(59,182,248,.9),#1c62c9 60%,#123a86);
  box-shadow:inset -8px -8px 22px rgba(0,0,0,.5),inset 6px 6px 16px rgba(255,255,255,.22),0 12px 26px -8px rgba(0,0,0,.6);
  background-size:140px 100%,100% 100%;animation:htSpin 12s linear infinite}
.ht-sphere::after{content:"";position:absolute;inset:0;border-radius:999px;background:repeating-linear-gradient(0deg,transparent 0 22%,rgba(255,255,255,.12) 22% 22.6%)}
.ht-dpill{position:absolute;font:800 8px ui-sans-serif;color:#fff;background:rgba(10,18,40,.82);border:1px solid rgba(255,255,255,.2);padding:4px 8px;border-radius:20px;box-shadow:0 6px 14px rgba(0,0,0,.5);backdrop-filter:blur(4px)}
.ht-dp-a{left:12%;top:20%}.ht-dp-b{right:14%;top:30%}.ht-dp-c{right:20%;bottom:30%}

/* CALENDAR */
.ht-calendar{background:linear-gradient(150deg,#0e2a4a,#1c1046);padding:9px 11px 40px;display:flex;flex-direction:column;gap:7px}
.ht-calhead{display:flex;align-items:center;justify-content:space-between}
.ht-calhead b{font:800 10px ui-sans-serif;color:#fff}
.ht-calnav{font:800 10px ui-sans-serif;color:#93a0b6;letter-spacing:2px}
.ht-calgrid{flex:1;display:grid;grid-template-columns:repeat(7,1fr);grid-auto-rows:1fr;gap:4px}
.ht-cell{border-radius:4px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.07);position:relative;display:grid;place-items:center}
.ht-cdot{width:9px;height:9px;border-radius:3px;box-shadow:0 0 8px currentColor}

@media (prefers-reduced-motion: reduce){
  .ht-s1,.ht-s2,.ht-s3,.ht-mark,.ht-waveamp,.ht-gloss,.ht-line,.ht-area,.ht-dot,.ht-playhead,.ht-frame,.ht-pa,.ht-pb,.ht-pc,.ht-wave i,.ht-cursor,.ht-btn::after,.ht-caret{animation:none!important;opacity:1!important;transform:none!important}
  .ht-sphere{animation:none!important;opacity:1!important}
  .ht-m1,.ht-m2{opacity:0!important}.ht-line{stroke-dashoffset:0!important}
}
`;
