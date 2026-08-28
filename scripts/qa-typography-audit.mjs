/**
 * Typography, contrast and overflow audit from BROWSER-COMPUTED styles.
 *
 * Why this reads the rendered DOM rather than the source: a token declaration is
 * not evidence. `caption: 14` in the scale proves nothing if a component
 * overrode it, if react-native-web classed over it, or if the value never
 * reached a glyph. Only getComputedStyle settles what a visitor actually sees.
 *
 * THREE THINGS THIS GETS RIGHT THAT THE OBVIOUS VERSION GETS WRONG:
 *
 * 1. Icon glyphs are not text. @expo/vector-icons renders every icon as a Text
 *    node holding a private-use-area codepoint in a FontAwesome face. A naive
 *    walker counts those as 8px-11px "text" and reports dozens of font-size
 *    violations whose sample string prints as nothing at all. They are excluded
 *    both by face and by codepoint.
 *
 * 2. A gradient is not a background-color. Walking ancestors for the first
 *    non-transparent backgroundColor finds white behind a blue gradient button
 *    and reports white-on-white as 1.00:1 - a fabricated failure that hides the
 *    real ones. Gradient stops are parsed and the WORST stop is used, so a
 *    button legible at one end of its gradient and not the other is still caught.
 *
 * 3. There are no landmarks to key categories off. react-native-web renders
 *    everything as <div>; there is no <header> or <footer> to close over.
 *    Categories resolve from roots that actually exist - a fixed/sticky top bar,
 *    the fixed consent layer, the block holding the copyright - plus ARIA roles.
 *
 *   node scripts/qa-typography-audit.mjs [--base URL] [--width 390] [--shots DIR]
 *
 * Exit 1 if any category violates the floor, contrast, or overflow rules.
 */
import puppeteer from 'puppeteer';
import { writeFileSync, mkdirSync } from 'node:fs';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'http://127.0.0.1:8093');
const WIDTH = Number(arg('--width', '390'));
const HEIGHT = WIDTH <= 430 ? 844 : WIDTH <= 820 ? 1024 : 900;
const SHOTS = arg('--shots', '');
/*
 * Text over a photo is now SCORED, against a guaranteed bound.
 *
 * This rule has been wrong twice in opposite directions. First it invented a
 * number by scoring hero copy against the page behind the photo. Then it
 * refused to score at all and failed anything over an image - which was right
 * while the design put no text on photography, and useless the moment the
 * design deliberately does, because it can neither pass such a design nor
 * prove it unsafe.
 *
 * The bound settles it. The photo's pixels are unknowable, but every photo
 * lies between black and white, so compositing the MEASURED scrim over both
 * extremes brackets every possible ground. Scoring against the worse of the
 * two yields a guarantee: "whatever the photograph is, this text clears X:1".
 * A scrim can then be tuned against evidence rather than against how one
 * particular image happens to look.
 *
 * `unverified` therefore no longer fires for photographs, and --allow-media
 * is kept only for the case of a background nothing can be bracketed from.
 */
const NO_STRICT_MEDIA = process.argv.includes('--allow-media');

const FLOOR = 14;          // nothing on the public site sits below this
const LABEL_FLOOR = 12;    // except a short uppercase tracked signpost
const LABEL_MAX_CHARS = 28;

const ROUTES = arg("--routes", "") ? arg("--routes", "").split(",") : [
  '/', '/product', '/pricing', '/flowagent', '/login', '/early-access',
  '/solutions/custom-automation', '/platform/ads', '/resources/templates',
  '/company/about', '/legal/terms', '/education/ai-fluency',
];

const lum = (r, g, b) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => { const [x, y] = [lum(...a), lum(...b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage();
await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 2 });

const hx = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const findings = [];
const byCategory = new Map();
const pageStats = [];
const unverified = [];
let overPhotoScored = 0;

for (const route of ROUTES) {
  let res;
  try { res = await page.goto(BASE + route, { waitUntil: 'networkidle2', timeout: 45000 }); }
  catch (e) { findings.push({ route, kind: 'load', detail: String(e.message).slice(0, 90) }); continue; }
  if (!res || res.status() >= 400) { findings.push({ route, kind: 'load', detail: 'HTTP ' + (res ? res.status() : '?') }); continue; }
  await new Promise((r) => setTimeout(r, 800));

  const data = await page.evaluate(() => {
    const ICON_FACE = /FontAwesome|Ionicons|MaterialIcons|Feather|icomoon/i;
    const isGlyphOnly = (s) => {
      for (const ch of s) {
        const c = ch.codePointAt(0);
        if (!(c >= 0xe000 && c <= 0xf8ff) && !/\s/.test(ch)) return false;
      }
      return true;
    };

    /* ---- resolve the roots the categories hang off ------------------ */
    const all = [...document.querySelectorAll('*')];
    const outermost = (list) => list.find((e) => !list.some((o) => o !== e && o.contains(e))) || null;

    const navRoot = outermost(all.filter((e) => {
      const cs = getComputedStyle(e);
      const r = e.getBoundingClientRect();
      return /fixed|sticky/.test(cs.position) && r.top <= 8 && r.height > 24 && r.width > innerWidth * 0.6;
    }));

    /*
     * The banner is position:absolute, not fixed, so matching only `fixed` left
     * it uncategorised and its buttons scored as generic body content. Allowing
     * `absolute` alone is not enough either: a full-page absolute wrapper also
     * contains the banner's text, and taking the outermost match then labelled
     * the ENTIRE PAGE as cookie consent. The height cap is what makes the match
     * mean the banner - a consent layer that filled two thirds of the viewport
     * would be a defect in its own right.
     */
    const consentRoot = outermost(all.filter((e) => {
      const cs = getComputedStyle(e);
      const h = e.getBoundingClientRect().height;
      return /fixed|absolute/.test(cs.position)
        && /cookie|strictly necessary storage|privacy choices/i.test(e.textContent || '')
        && h > 40 && h <= innerHeight * 0.7;
    }));

    const realScroller = all.find((e) => {
      const cs = getComputedStyle(e);
      return /auto|scroll/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 4;
    }) || document.scrollingElement || document.body;

    let footRoot = null;
    const copyEls = all.filter((e) => /©|all rights reserved/i.test(e.textContent || ''));
    if (copyEls.length) {
      let n = copyEls[copyEls.length - 1];
      const docH = realScroller.scrollHeight;
      // climb while the ancestor still begins in the bottom of the document
      while (n && n.parentElement) {
        const p = n.parentElement;
        const absTop = p.getBoundingClientRect().top + realScroller.scrollTop;
        if (absTop < docH * 0.55) break;
        n = p;
      }
      footRoot = n;
    }

    /**
     * The page does NOT scroll the document. expo-reset sets body{overflow:hidden}
     * and the app scrolls inside a nested div, so documentElement.scrollHeight is
     * one viewport tall no matter how long the page is. Every root below, and the
     * overflow measurement, has to come off the real scroller or it measures
     * nothing and reports a pass.
     */
    const scroller = all.find((e) => {
      const cs = getComputedStyle(e);
      return /auto|scroll/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 4;
    }) || document.scrollingElement || document.body;
    const contentWrap = scroller.children[0] || scroller;
    const sections = [...contentWrap.children];
    const heroRoot = sections.find((e) => e !== navRoot && e.getBoundingClientRect().height > 120) || null;

    const category = (el) => {
      if (consentRoot && consentRoot.contains(el)) return 'cookie consent';
      if (navRoot && navRoot.contains(el)) return 'navigation';
      if (footRoot && footRoot.contains(el)) return 'footer';
      if (location.pathname.indexOf('/legal') === 0) return 'legal copy';
      if (el.closest('[role="button"], button')) return 'buttons';
      const cs = getComputedStyle(el);
      const txt = (el.textContent || '').trim();
      const r = parseFloat(cs.borderRadius) || 0;
      const par = el.parentElement ? getComputedStyle(el.parentElement) : null;
      const parR = par ? parseFloat(par.borderRadius) || 0 : 0;
      // a chip is a pill whose content is just its own label
      if ((r >= 999 || parR >= 999) && txt.length <= 32) return 'chips';
      if (el.closest('[data-card], [data-grid-columns] > *')) return 'cards';
      if (heroRoot && heroRoot.contains(el)) return 'hero';
      return 'body content';
    };

    /* ---- effective background, gradients included ------------------- */
    const parseRGB = (s) => {
      const m = String(s).match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = m[1].split(',').map((v) => parseFloat(v));
      return { rgb: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1 };
    };
    const gradientStopsA = (img) => {
      const out = [];
      const re = /rgba?\(([^)]+)\)/g;
      let m;
      while ((m = re.exec(img))) {
        const p = m[1].split(',').map((v) => parseFloat(v));
        if (p.length >= 3) out.push({ rgb: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1 });
      }
      return out;
    };
    const gradientStops = (img) => {
      const out = [];
      const re = /rgba?\(([^)]+)\)/g;
      let m;
      while ((m = re.exec(img))) {
        const p = m[1].split(',').map((v) => parseFloat(v));
        if (p.length >= 3) out.push([p[0], p[1], p[2]]);
      }
      return out;
    };
    /**
     * WHAT IS ACTUALLY PAINTED BEHIND THIS TEXT.
     *
     * Three wrong answers were tried before this one, and each was confidently
     * wrong in a different direction:
     *
     *   deepest box containing the point   picked unrelated nodes from elsewhere
     *                                      in the DOM and scored white-on-blue
     *                                      buttons at 1.00:1
     *   first opaque ancestor              missed the footer CTA's scrim, which
     *                                      is a SIBLING painted under the copy,
     *                                      and reported 3.44:1 on text the scrim
     *                                      had already been added to rescue
     *   ancestors only, composited         same blind spot; ancestry is not paint
     *                                      order
     *
     * Paint order is the actual rule, so use it. Within a stacking context an
     * element is painted over everything that precedes it in document order, and
     * over its own ancestors. So the ground under a text node is every layer that
     * contains its centre AND precedes it in document order - ancestors and
     * earlier siblings alike - composited from the topmost (latest) downward
     * until the accumulated alpha is opaque.
     *
     * Where a photo or url() background is reached before the stack turns opaque
     * the ground is genuinely unknowable from computed styles. That returns
     * `unverified` and is counted separately: never scored, never silently
     * passed. Inventing a number there is how an audit ends up asserting
     * something it never measured.
     */
    const order = new Map();
    all.forEach((e, i) => order.set(e, i));

    const paintLayers = [];
    for (const e of all) {
      const cs = getComputedStyle(e);
      const r = e.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const op = parseFloat(cs.opacity);
      if (op < 0.02) continue;
      const oi = order.get(e);

      const img = cs.backgroundImage && cs.backgroundImage !== 'none' ? cs.backgroundImage : '';
      const isMedia = /^(IMG|VIDEO|CANVAS|SVG)$/.test(e.tagName) || /url\(/.test(img);
      if (isMedia) { paintLayers.push({ r, oi, kind: 'image' }); continue; }
      if (img) {
        const stops = gradientStopsA(img);
        if (stops.length) { paintLayers.push({ r, oi, kind: 'gradient', stops, op }); continue; }
      }
      const bg = parseRGB(cs.backgroundColor);
      if (bg && bg.a > 0.01) paintLayers.push({ r, oi, kind: 'color', rgb: bg.rgb, a: bg.a * op });
    }
    paintLayers.sort((a, b) => a.oi - b.oi);

    const effBg = (el) => {
      const tr = el.getBoundingClientRect();
      const x = tr.left + tr.width / 2;
      const y = tr.top + tr.height / 2;
      const ti = order.get(el);

      const stack = [];
      for (const L of paintLayers) {
        if (L.oi > ti) break;                       // painted above the text
        if (x < L.r.left || x > L.r.right || y < L.r.top || y > L.r.bottom) continue;
        stack.push(L);
      }

      let branches = [{ c: [0, 0, 0], a: 0 }];
      for (let i = stack.length - 1; i >= 0; i--) {   // topmost first
        if (branches.every((br) => br.a >= 0.999)) break;
        const L = stack[i];
        if (L.kind === 'image') {
          /*
           * A photograph, reached before the stack turned opaque. The pixels
           * are unknowable from computed styles - but the ANSWER is not.
           *
           * Whatever the photo shows, it is somewhere between black and white,
           * so compositing the scrim we HAVE measured over each of those two
           * extremes brackets every possible ground. Score against both and
           * take the worse: the result is then a guarantee - "no matter what
           * the photograph is, this text clears X:1" - rather than an opinion
           * about one particular image.
           *
           * This replaces refusing to score. Refusing was right while the
           * design put no text on photography; it is useless for a design that
           * deliberately does, because it can neither pass it nor prove it
           * unsafe. A bound can do both, and it is what lets a scrim be tuned
           * against evidence instead of against how one photo happens to look.
           */
          const bracketed = [];
          for (const br of branches) {
            const w = 1 - br.a;
            for (const extreme of [0, 255]) {
              bracketed.push([br.c[0] + extreme * w, br.c[1] + extreme * w, br.c[2] + extreme * w]);
            }
          }
          return { unverified: false, overPhoto: true, grounds: bracketed };
        }
        const cols = L.kind === 'gradient'
          ? L.stops.slice(0, 3).map((s) => ({ rgb: s.rgb, a: s.a * (L.op === undefined ? 1 : L.op) }))
          : [{ rgb: L.rgb, a: L.a }];
        const next = [];
        for (const br of branches) {
          if (br.a >= 0.999) { next.push(br); continue; }
          for (const col of cols) {
            const w = col.a * (1 - br.a);
            next.push({
              c: [br.c[0] + col.rgb[0] * w, br.c[1] + col.rgb[1] * w, br.c[2] + col.rgb[2] * w],
              a: br.a + w,
            });
          }
        }
        branches = next.slice(0, 6);
      }

      const bodyBg = parseRGB(getComputedStyle(document.body).backgroundColor);
      const fill = bodyBg && bodyBg.a > 0.05 ? bodyBg.rgb : [255, 255, 255];
      const grounds = branches.map((br) => {
        const w = 1 - br.a;
        return [br.c[0] + fill[0] * w, br.c[1] + fill[1] * w, br.c[2] + fill[2] * w];
      });
      return { unverified: false, grounds };
    };

    const out = [];
    const seen = new Set();
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let node;
    while ((node = walk.nextNode())) {
      const direct = [...node.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim().length > 0);
      if (!direct) continue;
      const txt = (node.textContent || '').trim();
      if (!txt) continue;
      const cs = getComputedStyle(node);
      const family = cs.fontFamily.split(',')[0].replace(/["']/g, '');
      if (ICON_FACE.test(family) || isGlyphOnly(txt)) continue;   // icons are not text
      if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.15) continue;
      const rect = node.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      const key = txt.slice(0, 40) + '|' + cs.fontSize + '|' + cs.color;
      if (seen.has(key)) continue;
      seen.add(key);
      const bg = effBg(node);
      out.push({
        text: txt.slice(0, 46), size: parseFloat(cs.fontSize), weight: cs.fontWeight,
        color: cs.color, grounds: bg.grounds, unverified: bg.unverified, overPhoto: !!bg.overPhoto,
        transform: cs.textTransform, family, cat: category(node),
      });
    }
    return {
      nodes: out,
      // both, because either can be the one that actually overflows
      overflow: Math.max(scroller.scrollWidth - scroller.clientWidth,
                         document.documentElement.scrollWidth - window.innerWidth),
      scrollW: Math.max(scroller.scrollWidth, document.documentElement.scrollWidth),
      pageH: scroller.scrollHeight,
      footH: footRoot ? Math.round(footRoot.getBoundingClientRect().height) : 0,
      consentH: consentRoot ? Math.round(consentRoot.getBoundingClientRect().height) : 0,
      roots: { nav: !!navRoot, hero: !!heroRoot, foot: !!footRoot, consent: !!consentRoot },
    };
  });

  if (data.overflow > 1) {
    findings.push({ route, kind: 'overflow', detail: '+' + data.overflow + 'px (scrollWidth ' + data.scrollW + ' > ' + WIDTH + ')' });
  }

  for (const n of data.nodes) {
    const cat = byCategory.get(n.cat) || { min: Infinity, count: 0, families: new Set(), worst: Infinity, worstText: '' };
    cat.count++;
    cat.families.add(n.family);
    if (n.size < cat.min) cat.min = n.size;

    const isLabel = n.transform === 'uppercase' && n.text.length <= LABEL_MAX_CHARS;
    const floor = isLabel ? LABEL_FLOOR : FLOOR;
    if (n.size < floor) {
      findings.push({ route, kind: 'font', detail: n.size + 'px < ' + floor + ' [' + n.cat + '] "' + n.text + '"' });
    }

    const fgm = String(n.color).match(/rgba?\(([^)]+)\)/);
    if (fgm) {
      const p = fgm[1].split(',').map((v) => parseFloat(v));
      const transparent = p.length > 3 && p[3] <= 0.5;
      if (n.unverified) {
        cat.unverified = (cat.unverified || 0) + 1;
        unverified.push({ route, cat: n.cat, text: n.text, size: n.size });
        /*
         * A node here has a photo behind it that no opaque layer covers, so no
         * honest ratio exists for it. That used to be reported and not counted.
         *
         * It counts now, because the design rule changed: hero copy must sit on
         * a ground whose contrast is COMPUTABLE - a surface or an opaque
         * gradient - rather than on "the photo is dark enough just there". Dark
         * navy body copy over an office photograph was the case that settled it;
         * it crossed a bright window and then a face, and was unreadable for
         * most of its length. Leaving these merely "noted" is how an audit
         * reports a clean sweep over text nobody can read.
         */
        if (!NO_STRICT_MEDIA) {
          findings.push({
            route, kind: 'contrast',
            detail: 'text over a photo, ground not computable at ' + n.size + 'px [' + n.cat + '] "' + n.text + '"',
          });
        }
      } else if (!transparent && n.grounds && n.grounds.length) {
        const fg = [p[0], p[1], p[2]];
        /*
         * Report the ground that PRODUCED the worst ratio, not grounds[0].
         * Printing the first candidate showed "1.41:1 #ffffff on #000000" -
         * white on black, which is 21:1 - so the number and the colours told
         * different stories and the colours were the wrong one.
         */
        let worstGround = n.grounds[0];
        let cr = Infinity;
        for (const g of n.grounds) {
          const r = ratio(fg, g);
          if (r < cr) { cr = r; worstGround = g; }
        }
        if (cr < cat.worst) { cat.worst = cr; cat.worstText = n.text; }
        const large = n.size >= 24 || (n.size >= 18.66 && Number(n.weight) >= 700);
        const need = large ? 3.0 : 4.5;
        if (n.overPhoto) overPhotoScored++;
        if (cr < need) {
          findings.push({ route, kind: 'contrast', cr: +cr.toFixed(2), fg: hx(fg), bg: hx(worstGround), size: n.size, cat: n.cat, text: n.text, detail: cr.toFixed(2) + ':1 < ' + need + ' at ' + n.size + 'px [' + n.cat + '] ' + hx(fg) + ' on ' + hx(worstGround) + ' "' + n.text + '"' });
        }
      }
    }
    byCategory.set(n.cat, cat);
  }

  if (SHOTS) {
    mkdirSync(SHOTS, { recursive: true });
    const name = (route === '/' ? 'home' : route.slice(1).split('/').join('-')) + '-' + WIDTH + '.png';
    await page.screenshot({ path: SHOTS + '/' + name, fullPage: true });
  }
  pageStats.push({ route, pageH: data.pageH, footH: data.footH, consentH: data.consentH });
  process.stdout.write('  ' + route.padEnd(28) + String(data.nodes.length).padStart(4) + ' text  ovf ' +
    String(data.overflow).padStart(3) + 'px   page ' + String(data.pageH).padStart(6) + 'px = ' +
    String((data.pageH / HEIGHT).toFixed(1)).padStart(5) + ' screens   footer ' + String(data.footH).padStart(5) + 'px\n');
}
await browser.close();

console.log('\n=== computed styles at ' + WIDTH + 'px, by component category ===');
const order = ['navigation', 'hero', 'buttons', 'cards', 'chips', 'cookie consent', 'footer', 'legal copy', 'body content'];
for (const k of order) {
  const c = byCategory.get(k);
  if (!c) { console.log('  ' + k.padEnd(16) + '(not sampled)'); continue; }
  const fam = [...c.families].join('/').slice(0, 22);
  const uv = c.unverified ? '   ' + c.unverified + ' over media' : '';
  console.log('  ' + k.padEnd(16) + 'min ' + String(c.min).padStart(5) + 'px   worst ' +
    (c.worst === Infinity ? 'n/a' : c.worst.toFixed(2) + ':1').padStart(8) + '   ' +
    String(c.count).padStart(4) + ' nodes   ' + fam + uv);
}

const byKind = findings.reduce((a, f) => { (a[f.kind] = a[f.kind] || []).push(f); return a; }, {});
console.log('\n=== findings ===');
for (const kind of ['load', 'font', 'contrast', 'overflow']) {
  const list = byKind[kind] || [];
  console.log('  ' + kind.padEnd(9) + list.length);
  for (const f of list.slice(0, 14)) console.log('      ' + f.route + ' - ' + f.detail);
  if (list.length > 14) console.log('      ... ' + (list.length - 14) + ' more');
}
if (unverified.length) {
  console.log('');
  console.log('  NOT SCORED - over a photo/media layer, contrast unknowable from computed styles: ' + unverified.length);
  const byRoute = {};
  for (const u of unverified) byRoute[u.route] = (byRoute[u.route] || 0) + 1;
  for (const [rt, ct] of Object.entries(byRoute)) console.log('      ' + rt.padEnd(30) + ct + ' nodes - needs a visual check');
}
if (overPhotoScored) {
  console.log('');
  console.log('  ' + overPhotoScored + ' text node(s) sit over a photograph and were scored against a GUARANTEED bound:');
  console.log('  the measured scrim composited over both black and white, worse of the two reported.');
  console.log('  A pass here means legible whatever the photograph turns out to be.');
}
console.log('');
console.log('=== page length at ' + WIDTH + 'px (viewport ' + HEIGHT + 'px tall) ===');
for (const q of pageStats.slice().sort((a, b) => b.pageH - a.pageH).slice(0, 6)) {
  console.log('  ' + q.route.padEnd(30) + String(q.pageH).padStart(6) + 'px = ' + String((q.pageH / HEIGHT).toFixed(1)).padStart(5) + ' screens   footer ' + String(q.footH).padStart(5) + 'px   consent ' + q.consentH + 'px');
}
writeFileSync('qa-typography-' + WIDTH + '.json', JSON.stringify({ width: WIDTH, findings }, null, 2));
console.log('\nTOTAL FINDINGS: ' + findings.length);
process.exit(findings.length ? 1 : 0);
