import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Link, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Reveal } from '@/components/public/motion';
import { ROUTES } from '@/components/public/nav';
import { PageShell } from '@/components/public/page-shell';
import { breadcrumbJsonLd } from '@/components/public/seo';
import {
  ButtonRow,
  Card,
  Heading,
  PrimaryButton,
  SecondaryButton,
  Band,
  OpenSection,
  SectionAside,
  SectionLabel,
  useTypeScale,
  type TypeScale,
} from '@/components/public/ui';
import { trackCta } from '@/lib/analytics';
import { contactHref, EXTERNAL } from '@/lib/destinations';
import { elevation, palettes, softFill, type ThemeTokens } from '@/theme/tokens';
import { cellBasis, useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';

/* ------------------------------------------------------------------ */
/* tone helper                                                         */
/* ------------------------------------------------------------------ */

type Tone = 'brand' | 'violet' | 'orange' | 'green';

function accent(t: ThemeTokens, tone: Tone): string {
  return tone === 'violet' ? t.violet : tone === 'orange' ? t.orange : tone === 'green' ? t.green : t.brand;
}

/**
 * Code is monospace on every platform. `Platform.select` rather than a bare
 * string so the native builds fall back to their own mono face instead of
 * silently rendering the web stack name.
 */
const MONO = Platform.select({
  web: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  default: 'monospace',
}) as string;

/* ------------------------------------------------------------------ */
/* the code panel's own palette                                        */
/* ------------------------------------------------------------------ */

/**
 * A code block reads as an editor, so it stays dark in all three themes — the
 * one surface on the page that does not follow the light palette. The colours
 * are still tokens: on light they are borrowed wholesale from the dark palette,
 * on grey/dark they are the theme's own raised surfaces.
 */
type Ink = {
  bg: string;
  panel: string;
  border: string;
  text: string;
  muted: string;
  kw: string;
  str: string;
  fn: string;
  flag: string;
};

function inkFor(t: ThemeTokens): Ink {
  const d = palettes.dark;
  const borrowed = t.mode === 'light';
  return {
    bg: borrowed ? d.surface : t.surfaceRaised,
    panel: borrowed ? d.surfaceRaised : t.surfaceInset,
    border: borrowed ? d.border : t.border,
    text: borrowed ? d.text : t.text,
    muted: borrowed ? d.textSubtle : t.textSubtle,
    kw: borrowed ? d.violet : t.violet,
    str: borrowed ? d.green : t.green,
    fn: borrowed ? d.brandStrong : t.brandStrong,
    flag: borrowed ? d.orange : t.orange,
  };
}

function useInk(): Ink {
  const t = useTokens();
  return useMemo(() => inkFor(t), [t]);
}

/* ------------------------------------------------------------------ */
/* the world's smallest highlighter                                    */
/* ------------------------------------------------------------------ */

type SpanTone = 'str' | 'com' | 'kw' | 'fn' | 'flag';
type Span = { text: string; tone?: SpanTone };

/**
 * Strings come first in the alternation so a `#` or `//` inside quotes is never
 * mistaken for a comment. Everything is matched per line, which is why an
 * unterminated quote (the `-d '{` of the cURL sample) simply falls through as
 * plain text instead of swallowing the rest of the block.
 */
const HIGHLIGHT =
  /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(#.*$|\/\/.*$)|\b(import|from|const|new|await|async|def|return|print|export)\b|(\s-[A-Za-z]\b)|(\bcurl\b|https?:\/\/[^\s"',]+)/;

function highlight(line: string): Span[] {
  const re = new RegExp(HIGHLIGHT.source, 'g');
  const spans: Span[] = [];
  let last = 0;
  let match = re.exec(line);
  while (match) {
    if (match.index > last) spans.push({ text: line.slice(last, match.index) });
    const tone: SpanTone = match[1]
      ? 'str'
      : match[2]
        ? 'com'
        : match[3]
          ? 'kw'
          : match[4]
            ? 'flag'
            : 'fn';
    spans.push({ text: match[0], tone });
    last = match.index + match[0].length;
    match = re.exec(line);
  }
  if (last < line.length) spans.push({ text: line.slice(last) });
  return spans.length ? spans : [{ text: line }];
}

/* ------------------------------------------------------------------ */
/* content                                                             */
/* ------------------------------------------------------------------ */

type Feature = { icon: string; title: string; body: string; tone: Tone };

const HERO_FEATURES: Feature[] = [
  { icon: 'bolt', title: 'RESTful APIs', body: 'Clean, predictable, and resource-oriented.', tone: 'brand' },
  {
    icon: 'shield-halved',
    title: 'Secure by default',
    body: 'OAuth 2.0, role scopes, and encryption.',
    tone: 'violet',
  },
  { icon: 'clock', title: '99.9% uptime', body: 'Built for reliability and scale.', tone: 'green' },
  {
    icon: 'download',
    title: 'Developer-first',
    body: 'Comprehensive docs, SDKs, and examples.',
    tone: 'orange',
  },
];

type Snippet = { id: string; label: string; lines: string[] };

const SNIPPETS: Snippet[] = [
  {
    id: 'curl',
    label: 'cURL',
    lines: [
      'curl -X POST https://api.flowsmartly.com/v1/campaigns \\',
      '  -H "Authorization: Bearer $FLOWSMARTLY_API_KEY" \\',
      '  -H "Content-Type: application/json" \\',
      "  -d '{",
      '    "name": "Spring Reactivation",',
      '    "channels": ["voice", "sms"],',
      '    "audience": { "segment_id": "seg_8f21c4" },',
      '    "schedule": {',
      '      "start_at": "2026-04-02T09:00:00Z",',
      '      "timezone": "America/New_York"',
      '    }',
      "  }'",
    ],
  },
  {
    id: 'js',
    label: 'JavaScript',
    lines: [
      "import { FlowSmartly } from '@flowsmartly/sdk';",
      '',
      'const flow = new FlowSmartly(process.env.FLOWSMARTLY_API_KEY);',
      '',
      'const campaign = await flow.campaigns.create({',
      "  name: 'Spring Reactivation',",
      "  channels: ['voice', 'sms'],",
      "  audience: { segment_id: 'seg_8f21c4' },",
      '  schedule: {',
      "    start_at: '2026-04-02T09:00:00Z',",
      "    timezone: 'America/New_York',",
      '  },',
      '});',
      '',
      'console.log(campaign.id);',
    ],
  },
  {
    id: 'py',
    label: 'Python',
    lines: [
      'import os',
      'from flowsmartly import FlowSmartly',
      '',
      'flow = FlowSmartly(api_key=os.environ["FLOWSMARTLY_API_KEY"])',
      '',
      'campaign = flow.campaigns.create(',
      '    name="Spring Reactivation",',
      '    channels=["voice", "sms"],',
      '    audience={"segment_id": "seg_8f21c4"},',
      '    schedule={',
      '        "start_at": "2026-04-02T09:00:00Z",',
      '        "timezone": "America/New_York",',
      '    },',
      ')',
      '',
      'print(campaign.id)',
    ],
  },
];

/**
 * Each quickstart opens the surface it talks to. Per-endpoint reference pages
 * do not exist in this app, so linking to the product page is the honest
 * destination — `href: null` would leave a link that goes nowhere.
 */
type Quickstart = { icon: string; title: string; body: string; tone: Tone; href: string; external?: boolean };

const QUICKSTARTS: Quickstart[] = [
  {
    icon: 'lock',
    title: 'Authentication',
    body: 'Create a key and sign your first request.',
    tone: 'brand',
    href: EXTERNAL.signup,
    external: true,
  },
  {
    icon: 'bullhorn',
    title: 'Campaigns',
    body: 'Create, schedule and monitor multi-channel sends.',
    tone: 'violet',
    href: ROUTES.emailSms,
  },
  {
    icon: 'user',
    title: 'Contacts',
    body: 'Sync contacts, segments and consent state.',
    tone: 'green',
    href: ROUTES.analytics,
  },
  {
    icon: 'cart-shopping',
    title: 'Commerce',
    body: 'Products, orders and checkout events in FlowShop.',
    tone: 'orange',
    href: ROUTES.flowshop,
  },
  {
    icon: 'tag',
    title: 'Listings',
    body: 'Manage locations, hours and review replies.',
    tone: 'brand',
    href: ROUTES.listsmartly,
  },
  {
    icon: 'phone',
    title: 'Call Agent',
    body: 'Place calls and read transcripts and outcomes.',
    tone: 'violet',
    href: ROUTES.callAgent,
  },
];

type Sdk = { monogram: string; title: string; install: string; tone: Tone; bullets: string[] };

const SDKS: Sdk[] = [
  {
    monogram: 'JS',
    title: 'JavaScript / TypeScript',
    install: 'npm i @flowsmartly/sdk',
    tone: 'brand',
    bullets: [
      'Fully typed client for every resource',
      'Promise-based with automatic retries',
      'Runs in Node, Bun and edge runtimes',
    ],
  },
  {
    monogram: 'Py',
    title: 'Python',
    install: 'pip install flowsmartly',
    tone: 'violet',
    bullets: [
      'Typed models and readable errors',
      'Synchronous and async clients',
      'Pagination handled for you',
    ],
  },
];

const SAMPLE_RECORDS = [
  '{ "id": "con_18fa2", "name": "Marcus Lee" }',
  '{ "id": "con_18fb7", "name": "Dana Ruiz" }',
];

/**
 * The sample response is built from whatever the explorer's parameters say, so
 * the two panels cannot disagree. It is a shape illustration — it does not call
 * the API — and it stays honest by echoing the request rather than inventing a
 * result count.
 */
function responseSample(limit: string, page: string): string[] {
  const toInt = (value: string, fallback: number) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };
  const take = Math.min(toInt(limit, 0), SAMPLE_RECORDS.length);
  const shown = SAMPLE_RECORDS.slice(0, take);
  return [
    '{',
    shown.length === 0 ? '  "data": [],' : '  "data": [',
    ...shown.map((record, index) => `    ${record}${index < shown.length - 1 ? ',' : ''}`),
    ...(shown.length === 0 ? [] : ['  ],']),
    `  "page": ${toInt(page, 1)},`,
    `  "limit": ${toInt(limit, 0)},`,
    '  "has_more": true',
    '}',
  ];
}

type Webhook = { event: string; body: string; tone: Tone };

const WEBHOOKS: Webhook[] = [
  { event: 'campaign.started', body: 'A campaign begins sending on its schedule.', tone: 'brand' },
  { event: 'call.completed', body: 'A call ends, with outcome and transcript attached.', tone: 'violet' },
  { event: 'order.created', body: 'A checkout completes in FlowShop.', tone: 'green' },
  { event: 'contact.updated', body: 'A contact detail or consent state changes.', tone: 'orange' },
];

const SECURITY = [
  'OAuth 2.0 for secure authentication',
  'Fine-grained scopes and roles',
  'Data encrypted in transit and at rest',
  'IP allowlisting available',
];

const RATE_LIMITS = [
  'Default limit of 100 requests per second',
  'Short bursts above the steady rate are supported',
  'Every response returns limit and reset information',
];

const RATE_HEADERS = ['X-RateLimit-Limit: 100', 'X-RateLimit-Remaining: 96', 'X-RateLimit-Reset: 1743600000'];

/* ------------------------------------------------------------------ */
/* shared style hook                                                   */
/* ------------------------------------------------------------------ */

type Styles = ReturnType<typeof createStyles>;

function useStyles(): Styles {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  return useMemo(() => createStyles(t, l, type), [t, l, type]);
}

/* ------------------------------------------------------------------ */
/* small pieces                                                        */
/* ------------------------------------------------------------------ */

function IconTile({ icon, tone, size = 44 }: { icon: string; tone: Tone; size?: number }) {
  const t = useTokens();
  const color = accent(t, tone);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        flexGrow: 0,
        flexShrink: 0,
        backgroundColor: softFill(color, t),
      }}>
      <FontAwesome6 name={icon as never} size={Math.round(size * 0.42)} color={color} />
    </View>
  );
}

function SectionHead({ label, title, body }: { label: string; title: string; body?: string }) {
  const styles = useStyles();
  return (
    <Reveal style={styles.head} distance={14}>
      <SectionLabel>{label}</SectionLabel>
      <Heading level={2} style={styles.headTitle}>
        {title}
      </Heading>
      {body ? <Text style={styles.headBody}>{body}</Text> : null}
    </Reveal>
  );
}

function Bullet({ children, tone = 'brand' }: { children: string; tone?: Tone }) {
  const styles = useStyles();
  const t = useTokens();
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletIcon}>
        <FontAwesome6 name="circle-check" size={13} color={accent(t, tone)} />
      </View>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

function LinkRow({
  label,
  tone = 'brand',
  href,
  external,
  trackId,
}: {
  label: string;
  tone?: Tone;
  href: string;
  /** the destination lives outside this app */
  external?: boolean;
  trackId: string;
}) {
  const styles = useStyles();
  const t = useTokens();
  const color = accent(t, tone);
  const body = (
    <>
      <Text style={[styles.linkText, { color }]}>{label}</Text>
      <FontAwesome6 name="arrow-right" size={12} color={color} />
    </>
  );

  if (external) {
    return (
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={label}
        onPress={() => {
          trackCta(trackId, { variant: 'link', destination: href });
          Linking.openURL(href).catch(() => undefined);
        }}
        style={({ pressed }) => [styles.linkRow, pressed ? styles.pressed : null]}>
        {body}
      </Pressable>
    );
  }

  return (
    <Link
      href={href as never}
      accessibilityRole="link"
      accessibilityLabel={label}
      style={styles.linkRowAnchor as never}>
      {body}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* code block                                                          */
/* ------------------------------------------------------------------ */

function CodeLines({ lines, numbered }: { lines: string[]; numbered?: boolean }) {
  const styles = useStyles();
  const ink = useInk();
  const spans = useMemo(() => lines.map(highlight), [lines]);
  const toneColor: Record<SpanTone, string> = {
    str: ink.str,
    com: ink.muted,
    kw: ink.kw,
    fn: ink.fn,
    flag: ink.flag,
  };

  /**
   * Code must not re-wrap — a broken line reads as a different program, and a
   * 53-character Python call is wider than a 390px phone. So the block scrolls
   * inside itself rather than pushing the page sideways.
   *
   * A naive "any rect wider than the viewport" scan therefore reports every
   * line of the widest snippet as an overflow at 390 (the cURL sample measures
   * 382px inside a 298px scroller). That is the mechanism working, not a bug:
   * this ScrollView is `overflow-x: auto` and `codeCard` clips it, so
   * `documentElement.scrollWidth` stays at the viewport width. Do not "fix" it
   * by wrapping the code or by shrinking the type.
   */
  return (
    <ScrollView horizontal contentContainerStyle={styles.codeBody}>
      {spans.map((line, index) => (
        <View key={index} style={styles.codeLine}>
          {numbered ? (
            <Text style={[styles.codeGutter, { color: ink.muted }]} selectable={false}>
              {index + 1}
            </Text>
          ) : null}
          <Text style={[styles.codeText, { color: ink.text }]}>
            {line.map((span, spanIndex) => (
              <Text
                key={spanIndex}
                style={span.tone ? { color: toneColor[span.tone] } : undefined}>
                {span.text}
              </Text>
            ))}
            {/* a blank line still needs a glyph box or the row collapses */}
            {lines[index] === '' ? ' ' : null}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

function CodeSample() {
  const styles = useStyles();
  const ink = useInk();
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const snippet = SNIPPETS[active];

  const onCopy = useCallback(() => {
    const text = SNIPPETS[active].lines.join('\n');
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => undefined);
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
  }, [active]);

  return (
    <View style={styles.codeCard}>
      <View style={styles.codeHeader}>
        <View style={styles.codeTabs}>
          {SNIPPETS.map((item, index) => (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: index === active }}
              onPress={() => setActive(index)}
              style={[
                styles.codeTab,
                index === active ? { backgroundColor: ink.panel, borderColor: ink.border } : null,
              ]}>
              <Text style={[styles.codeTabText, { color: index === active ? ink.text : ink.muted }]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable accessibilityRole="button" onPress={onCopy} style={styles.copyButton}>
          <FontAwesome6 name={copied ? 'check' : 'copy'} size={13} color={copied ? ink.str : ink.muted} />
          <Text style={[styles.copyText, { color: copied ? ink.str : ink.muted }]}>
            {copied ? 'Copied' : 'Copy'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.codeMethodRow}>
        <View style={styles.methodChip}>
          <Text style={styles.methodChipText}>POST</Text>
        </View>
        <Text style={[styles.codePath, { color: ink.muted }]} numberOfLines={1}>
          /v1/campaigns
        </Text>
      </View>

      <CodeLines lines={snippet.lines} numbered />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* sections                                                            */
/* ------------------------------------------------------------------ */

function Hero() {
  const t = useTokens();
  const styles = useStyles();
  const l = useLayout();

  return (
    <OpenSection style={[styles.heroSection, l.isStacked ? styles.stackColumn : styles.rowSection]}>
      <Reveal style={l.isStacked ? styles.fullColumn : styles.heroCopy} distance={16}>
        <SectionLabel>API DOCS</SectionLabel>
        <Heading level={1} style={styles.heroTitle}>
          Build on the FlowSmartly platform.
        </Heading>
        <Text style={styles.heroBody}>
          Power conversations, campaigns, and commerce with our reliable, secure, and developer-friendly
          APIs.
        </Text>
        <ButtonRow>
          <PrimaryButton
            label="Start building"
            icon="arrow-right"
            iconRight
            full={l.isPhone}
            trackId="api.hero.start-building"
            onPress={() => {
              Linking.openURL(EXTERNAL.signup).catch(() => undefined);
            }}
          />
          {/* The SDKs are the reference that actually exists today. */}
          <SecondaryButton
            label="Request SDK access"
            icon="code"
            full={l.isPhone}
            trackId="api.hero.github"
            onPress={() => {
              Linking.openURL(EXTERNAL.github).catch(() => undefined);
            }}
          />
        </ButtonRow>

        <View style={styles.featureGrid}>
          {HERO_FEATURES.map((feature, index) => (
            <Reveal
              key={feature.title}
              delay={120 + index * 80}
              distance={12}
              style={[styles.cell, { flexBasis: cellBasis(l.isPhone ? 1 : 2) }]}>
              <View style={styles.featureTile}>
                <IconTile icon={feature.icon} tone={feature.tone} size={38} />
                <View style={styles.featureCopy}>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureBody}>{feature.body}</Text>
                </View>
              </View>
            </Reveal>
          ))}
        </View>
      </Reveal>

      <Reveal style={l.isStacked ? styles.fullColumn : styles.heroCode} delay={120} distance={20}>
        <CodeSample />
      </Reveal>
    </OpenSection>
  );
}

function Quickstarts() {
  const t = useTokens();
  const styles = useStyles();
  const l = useLayout();
  const columns = l.isPhone ? 1 : l.isTablet ? 2 : 3;

  return (
    <Band tone="surface" art={{ variant: 'tasks', color: t.brand, side: 'right' }}>
      <SectionHead
        label="QUICKSTARTS"
        title="Start where your product does."
        body="Every surface of FlowSmartly has an endpoint. Pick one and make your first authenticated call."
      />
      <View style={styles.grid}>
        {QUICKSTARTS.map((item, index) => (
          <Reveal
            key={item.title}
            delay={60 + index * 70}
            distance={14}
            style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
            <Card style={styles.quickCard}>
              <IconTile icon={item.icon} tone={item.tone} />
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardBody}>{item.body}</Text>
              <View style={styles.cardSpacer} />
              <LinkRow
                label="Get started"
                tone={item.tone}
                href={item.href}
                external={item.external}
                trackId={`api.quickstart.${item.title.toLowerCase().replace(/\s+/g, '-')}`}
              />
            </Card>
          </Reveal>
        ))}
      </View>
    </Band>
  );
}

function Sdks() {
  const styles = useStyles();
  const l = useLayout();
  const t = useTokens();
  const columns = l.isStacked ? 1 : 2;

  return (
    <Band tone="brand" art={{ variant: 'shield', color: t.brand, side: 'left' }}>
      <SectionHead
        label="SDKS"
        title="Official SDKs"
        body="Idiomatic clients that handle auth, retries and pagination so you can stay on your own code."
      />
      <View style={styles.grid}>
        {SDKS.map((sdk, index) => (
          <Reveal
            key={sdk.monogram}
            delay={60 + index * 90}
            distance={14}
            style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
            <Card style={styles.sdkCard}>
              <View style={styles.sdkHead}>
                <View style={[styles.monogram, { backgroundColor: softFill(accent(t, sdk.tone), t) }]}>
                  <Text style={[styles.monogramText, { color: accent(t, sdk.tone) }]}>{sdk.monogram}</Text>
                </View>
                <View style={styles.sdkHeadCopy}>
                  <Text style={styles.cardTitle}>{sdk.title}</Text>
                  <Text style={styles.installText} numberOfLines={1}>
                    {sdk.install}
                  </Text>
                </View>
              </View>
              <View style={styles.bullets}>
                {sdk.bullets.map((bullet) => (
                  <Bullet key={bullet} tone={sdk.tone}>
                    {bullet}
                  </Bullet>
                ))}
              </View>
              <View style={styles.cardSpacer} />
              <LinkRow
                label="Request SDK access"
                tone={sdk.tone}
                href={EXTERNAL.github}
                external
                trackId={`api.sdk.${sdk.monogram.toLowerCase()}`}
              />
            </Card>
          </Reveal>
        ))}
      </View>
    </Band>
  );
}

function ExplorerPanel() {
  const styles = useStyles();
  const ink = useInk();
  const t = useTokens();
  const [tab, setTab] = useState<'params' | 'response'>('params');
  const [limit, setLimit] = useState('25');
  const [page, setPage] = useState('1');

  return (
    <Card style={styles.panelCard}>
      <View style={styles.panelHead}>
        <IconTile icon="play" tone="brand" size={38} />
        <View style={styles.panelHeadCopy}>
          <Text style={styles.cardTitle}>API Explorer</Text>
          <Text style={styles.cardBody}>Shape a request and see the response it returns.</Text>
        </View>
      </View>

      <View style={styles.requestRow}>
        <View style={[styles.methodChip, styles.methodChipGet]}>
          <Text style={styles.methodChipText}>GET</Text>
        </View>
        <Text style={styles.requestPath} numberOfLines={1}>
          /v1/contacts
        </Text>
        {/* Illustration, not a control: nothing here calls the API, so this is
            a View. A button that looks live and silently does nothing is worse
            than a static mock. */}
        <View style={styles.tryButton}>
          <Text style={styles.tryButtonText}>Try it</Text>
        </View>
      </View>

      <View style={styles.tabRow}>
        {(['params', 'response'] as const).map((key) => (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
            onPress={() => setTab(key)}
            style={[styles.tab, tab === key ? styles.tabActive : null]}>
            <Text style={[styles.tabText, tab === key ? styles.tabTextActive : null]}>
              {key === 'params' ? 'Parameters' : 'Response'}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'params' ? (
        <View style={styles.paramList}>
          {[
            { name: 'limit', hint: 'Records per page, up to 100', value: limit, set: setLimit },
            { name: 'page', hint: 'Page of results to return', value: page, set: setPage },
          ].map((param) => (
            <View key={param.name} style={styles.paramRow}>
              <View style={styles.paramCopy}>
                <Text style={styles.paramName}>{param.name}</Text>
                <Text style={styles.paramHint}>{param.hint}</Text>
              </View>
              <TextInput
                value={param.value}
                onChangeText={param.set}
                inputMode="numeric"
                accessibilityLabel={`${param.name} parameter`}
                placeholderTextColor={t.textSubtle}
                style={styles.paramInput}
              />
            </View>
          ))}
        </View>
      ) : (
        <View style={[styles.responseBlock, { backgroundColor: ink.bg, borderColor: ink.border }]}>
          <CodeLines lines={responseSample(limit, page)} />
        </View>
      )}
    </Card>
  );
}

function WebhooksPanel() {
  const styles = useStyles();
  const t = useTokens();

  return (
    <Card style={styles.panelCard}>
      <View style={styles.panelHead}>
        <IconTile icon="bolt" tone="violet" size={38} />
        <View style={styles.panelHeadCopy}>
          <Text style={styles.cardTitle}>Webhooks</Text>
          <Text style={styles.cardBody}>Subscribe once and receive every event as it happens.</Text>
        </View>
      </View>

      <View style={styles.eventList}>
        {WEBHOOKS.map((hook) => (
          <View key={hook.event} style={styles.eventRow}>
            <View style={[styles.eventDot, { backgroundColor: accent(t, hook.tone) }]} />
            <View style={styles.eventCopy}>
              <Text style={styles.eventName}>{hook.event}</Text>
              <Text style={styles.eventBody}>{hook.body}</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.footnote}>Signed with HMAC · Retried for 24 hours · Delivery log in the dashboard</Text>
    </Card>
  );
}

function ExplorerAndWebhooks() {
  const styles = useStyles();
  const l = useLayout();
  const columns = l.isStacked ? 1 : 2;

  return (
    <OpenSection>
      <SectionHead
        label="TRY IT"
        title="Explore the API, then let it call you back."
        body="Read data on demand, and subscribe to the moments that matter instead of polling for them."
      />
      <View style={styles.grid}>
        <Reveal delay={60} distance={14} style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
          <ExplorerPanel />
        </Reveal>
        <Reveal delay={140} distance={14} style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
          <WebhooksPanel />
        </Reveal>
      </View>
    </OpenSection>
  );
}

function SecurityAndLimits() {
  const t = useTokens();
  const styles = useStyles();
  const ink = useInk();
  const l = useLayout();
  const columns = l.isStacked ? 1 : 2;

  return (
    <Band tone="surface" art={{ variant: 'analytics', color: t.brand, side: 'right' }}>
      <SectionHead
        label="OPERATING RULES"
        title="Secure by design, predictable under load."
        body="The two things every integration needs to know before it goes to production."
      />
      <View style={styles.grid}>
        <Reveal delay={60} distance={14} style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
          <Card style={styles.panelCard}>
            <View style={styles.panelHead}>
              <IconTile icon="shield-halved" tone="green" size={38} />
              <View style={styles.panelHeadCopy}>
                <Text style={styles.cardTitle}>Security</Text>
                <Text style={styles.cardBody}>Every request is authenticated, scoped and encrypted.</Text>
              </View>
            </View>
            <View style={styles.bullets}>
              {SECURITY.map((item) => (
                <Bullet key={item} tone="green">
                  {item}
                </Bullet>
              ))}
            </View>
          </Card>
        </Reveal>

        <Reveal delay={140} distance={14} style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
          <Card style={styles.panelCard}>
            <View style={styles.panelHead}>
              <IconTile icon="gauge-high" tone="orange" size={38} />
              <View style={styles.panelHeadCopy}>
                <Text style={styles.cardTitle}>Rate limits</Text>
                <Text style={styles.cardBody}>Generous by default, with headroom for bursts.</Text>
              </View>
            </View>
            <View style={styles.bullets}>
              {RATE_LIMITS.map((item) => (
                <Bullet key={item} tone="orange">
                  {item}
                </Bullet>
              ))}
            </View>
            <View style={[styles.responseBlock, { backgroundColor: ink.bg, borderColor: ink.border }]}>
              <CodeLines lines={RATE_HEADERS} />
            </View>
          </Card>
        </Reveal>
      </View>
    </Band>
  );
}

function Closing() {
  const styles = useStyles();
  const l = useLayout();
  const router = useRouter();

  return (
    <Band tone="brand" style={styles.closing}>
      <Reveal style={styles.closingInner} distance={14}>
        {/* SectionLabel pins itself to flex-start, so a shrink-to-fit wrapper is
            what actually centres it */}
        <View style={styles.centerSelf}>
          <SectionLabel>GET STARTED</SectionLabel>
        </View>
        <Heading level={2} style={styles.closingTitle}>
          Ready to build?
        </Heading>
        <Text style={styles.closingBody}>
          Create a key, send your first request, and ship the integration your customers have been asking
          for.
        </Text>
        <ButtonRow>
          <PrimaryButton
            label="Start building"
            icon="arrow-right"
            iconRight
            size="lg"
            full={l.isPhone}
            trackId="api.closing.start-building"
            onPress={() => {
              Linking.openURL(EXTERNAL.signup).catch(() => undefined);
            }}
          />
          <SecondaryButton
            label="Talk to our team"
            icon="headset"
            size="lg"
            full={l.isPhone}
            trackId="api.closing.support"
            onPress={() => router.push(contactHref('support', { about: 'api' }) as never)}
          />
        </ButtonRow>
      </Reveal>
    </Band>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function ApiDocsPage() {
  return (
    <PageShell
      title="API Docs"
      description="Build on the FlowSmartly platform — REST APIs, SDKs and webhooks for conversations, campaigns and commerce."
      cta={false}
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Resources', path: ROUTES.resources },
          { name: 'API Docs', path: ROUTES.apiDocs },
        ]),
      ]}>
      <Hero />
      <Quickstarts />
      <Sdks />
      <ExplorerAndWebhooks />
      <SecurityAndLimits />
      <Closing />
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/* styles                                                              */
/* ------------------------------------------------------------------ */

function createStyles(t: ThemeTokens, l: Layout, type: TypeScale) {
  const ink = inkFor(t);
  /** half the grid gutter; cells carry it as padding so wrapped rows stay flush */
  const cellPad = l.isPhone ? 5 : 7;
  const codeSize = l.isPhone ? 11.5 : 12.5;
  /** stacked children need an explicit basis or RNW collapses them to 0% */
  const stackFull = { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', minWidth: 0 } as const;
  const mono: TextStyle = { fontFamily: MONO };

  return StyleSheet.create({
    /* shells ------------------------------------------------------ */
    rowSection: { flexDirection: 'row', alignItems: 'flex-start', gap: 30 },
    stackColumn: { flexDirection: 'column', alignItems: 'stretch', gap: 26 },
    heroSection: { paddingTop: l.isPhone ? 24 : 36 },
    fullColumn: { ...stackFull, gap: 18 },
    heroCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 18 },
    heroCode: { flexGrow: 1.15, flexShrink: 1, flexBasis: 0, minWidth: 0 },

    heroTitle: type.display,
    heroBody: { ...type.body, maxWidth: 560 },

    /* section heads ------------------------------------------------ */
    head: { gap: 12, maxWidth: 720 },
    headTitle: type.h2,
    headBody: type.body,

    /* grid --------------------------------------------------------- */
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'stretch',
      marginHorizontal: -cellPad,
      marginTop: 20 - cellPad,
    },
    cell: { flexGrow: 0, flexShrink: 0, minWidth: 0, padding: cellPad },

    /* hero feature strip ------------------------------------------- */
    featureGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'stretch',
      marginHorizontal: -cellPad,
      marginTop: 6 - cellPad,
    },
    featureTile: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      padding: 13,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceMuted,
    },
    featureCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 3 },
    featureTitle: { ...type.bodySm, color: t.text, fontWeight: '700' },
    featureBody: { ...type.micro, color: t.textMuted },

    /* code card ---------------------------------------------------- */
    codeCard: {
      borderWidth: 1,
      borderColor: ink.border,
      borderRadius: 16,
      backgroundColor: ink.bg,
      padding: l.isPhone ? 12 : 16,
      gap: 12,
      overflow: 'hidden',
      ...(elevation(t, 2) as ViewStyle),
    },
    codeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 8,
    },
    codeTabs: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
    codeTab: {
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    codeTabText: { ...type.caption, fontWeight: '700' },
    copyButton: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: ink.border,
      backgroundColor: ink.panel,
    },
    copyText: { ...type.caption, fontWeight: '700' },

    codeMethodRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    codePath: { ...type.caption, ...mono, flexGrow: 1, flexShrink: 1, minWidth: 0 },

    /** the scroll content: a column of unwrapped lines, sized by the widest one */
    codeBody: { flexDirection: 'column', alignItems: 'flex-start', gap: 2, paddingBottom: 2 },
    codeLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    codeGutter: {
      ...mono,
      fontSize: codeSize,
      lineHeight: Math.round(codeSize * 1.7),
      width: 22,
      textAlign: 'right',
      flexGrow: 0,
      flexShrink: 0,
    },
    codeText: {
      ...mono,
      fontSize: codeSize,
      lineHeight: Math.round(codeSize * 1.7),
      // sized by its own content — the horizontal scroller provides the room
      flexGrow: 0,
      flexShrink: 0,
    },

    methodChip: {
      minHeight: 26,
      justifyContent: 'center',
      paddingHorizontal: 10,
      borderRadius: 7,
      backgroundColor: t.brand,
      flexGrow: 0,
      flexShrink: 0,
    },
    methodChipGet: { backgroundColor: t.green },
    methodChipText: { ...mono, fontSize: 11, fontWeight: '800', color: t.textOnBrand },

    /* generic cards ------------------------------------------------ */
    quickCard: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      padding: 18,
      borderRadius: 16,
      gap: 10,
    },
    cardTitle: { ...type.h4, color: t.text },
    cardBody: { ...type.bodySm, color: t.textMuted },
    cardSpacer: { flexGrow: 1, flexShrink: 0, flexBasis: 'auto', minHeight: 4 },

    linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 26 },
    /** the same row as an anchor — RNW anchors are inline unless told otherwise */
    linkRowAnchor: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 26,
      textDecorationLine: 'none',
    },
    linkText: { ...type.bodySm, fontWeight: '700' },
    pressed: { opacity: 0.86 },

    bullets: { gap: 9 },
    bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    bulletIcon: { paddingTop: 3, flexGrow: 0, flexShrink: 0 },
    bulletText: {
      ...type.bodySm,
      color: t.textMuted,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
    },

    /* sdk ---------------------------------------------------------- */
    sdkCard: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      padding: 18,
      borderRadius: 16,
      gap: 16,
    },
    sdkHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    sdkHeadCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 4 },
    monogram: {
      width: 52,
      height: 52,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      flexGrow: 0,
      flexShrink: 0,
    },
    monogramText: { ...mono, fontSize: 17, fontWeight: '800' },
    installText: { ...type.micro, ...mono, color: t.textSubtle },

    /* panels ------------------------------------------------------- */
    panelCard: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      padding: 18,
      borderRadius: 16,
      gap: 14,
    },
    panelHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 13 },
    panelHeadCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 4 },

    requestRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 10,
      padding: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceMuted,
    },
    requestPath: {
      ...type.bodySm,
      ...mono,
      color: t.text,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
    },
    tryButton: {
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: 18,
      borderRadius: 10,
      backgroundColor: t.brand,
      flexGrow: 0,
      flexShrink: 0,
    },
    tryButtonText: { ...type.caption, color: t.textOnBrand, fontWeight: '800' },

    tabRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    tab: {
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    tabActive: { borderColor: t.border, backgroundColor: t.surfaceMuted },
    tabText: { ...type.caption, color: t.textMuted, fontWeight: '700' },
    tabTextActive: { color: t.text },

    paramList: { gap: 10 },
    paramRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    paramCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    paramName: { ...type.bodySm, ...mono, color: t.text, fontWeight: '700' },
    paramHint: { ...type.micro, color: t.textSubtle },
    paramInput: {
      ...type.bodySm,
      ...mono,
      color: t.text,
      minHeight: 44,
      width: 92,
      flexGrow: 0,
      flexShrink: 0,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: t.borderStrong,
      backgroundColor: t.surfaceMuted,
    },

    responseBlock: {
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
    },

    eventList: { gap: 4 },
    eventRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      minHeight: 44,
      paddingVertical: 9,
    },
    eventDot: { width: 9, height: 9, borderRadius: 5, marginTop: 6, flexGrow: 0, flexShrink: 0 },
    eventCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    eventName: { ...type.bodySm, ...mono, color: t.text, fontWeight: '700' },
    eventBody: { ...type.micro, color: t.textMuted },
    footnote: { ...type.micro, color: t.textSubtle },

    /* closing ------------------------------------------------------ */
    closing: { alignItems: 'center' },
    centerSelf: { alignSelf: 'center' },
    closingInner: { alignItems: 'center', gap: 16, maxWidth: 640, paddingVertical: l.isPhone ? 6 : 18 },
    closingTitle: { ...type.h1, textAlign: 'center' },
    closingBody: { ...type.body, textAlign: 'center' },
  });
}
