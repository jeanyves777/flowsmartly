import { legacyPlainText, screenRecord } from 'file:///C:/fs/wt/media-r4/packages/policy/src/media-plaintext.ts';
import { mediaCensus, mediaCensusValue } from 'file:///C:/fs/wt/media-r4/packages/policy/src/media-census.ts';
const tests: [string, string][] = [
  ['prose', 'The quick brown fox jumps over the lazy dog. Meet us at 10:30!'],
  ['names', 'Zoë Ångström-Nguyễn, José Müller and Chloé Dubois'],
  ['link', 'See https://www.example.org/about-us?ref=newsletter for more.'],
  ['address', '12 Rue de la Paix\r\n75002 Paris, France'],
  ['phone', 'Call +1 (555) 123-4567 or +44 20 7946 0958'],
  ['orderref', 'Order ORD-2026-09-28-ABCDEFGH-1234567890-XYZ12 shipped'],
  ['html', '<p>Hello <b>world</b></p><p>Second&nbsp;para &amp; more</p><img src="abc123"><script>new Image().src="x"</script>'],
  ['textarea', '<textarea><a title="</textarea><img src=abc123>"></textarea>'],
  ['entity-tag', '&lt;img src=abc123&gt; tail'],
  ['fullwidth', '＜img src=abc123＞ keep'],
  ['css-text', 'a{background-image:image-set(/*)*/"abc123" 1x)}'],
  ['md', '![x](abc123) and text'],
  ['srcdoc', '<iframe srcdoc="&lt;img src=abc123&gt;"></iframe>after'],
  ['data', 'Before <img alt="a" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="> after words stay.'],
  ['heart', 'I love you <3 and a < b'],
  ['cjk', '東京は日本の首都であり、世界で最も人口の多い都市圏の一つです。東京には多くの観光名所があり、毎年数百万人の観光客が訪れます。'],
  ['uuids', 'ids 3f2a5b6c-1d2e-4f50-8a9b-0c1d2e3f4a5b and 9b1c2d3e-4f50-4a6b-8c7d-0e1f2a3b4c5d'],
  ['data-prose', 'Customer data: the name and the email, phone'],
];
for (const [id, v] of tests) {
  const r = legacyPlainText(v);
  console.log(id.padEnd(12), JSON.stringify(r.text).slice(0, 140), '| same=', r.text === v, '| census', mediaCensus(r.text).count, '| removed', JSON.stringify(r.removed).slice(0, 200));
}
