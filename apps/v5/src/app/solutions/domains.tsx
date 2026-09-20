import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Ellipse } from 'react-native-svg';
import { Reveal } from '@/components/public/motion';
import { ROUTES } from '@/components/public/nav';
import { PageShell } from '@/components/public/page-shell';
import { breadcrumbJsonLd, faqJsonLd } from '@/components/public/seo';
import {
  ButtonRow,
  Heading,
  PrimaryButton,
  SecondaryButton,
  Band,
  OpenSection,
  SectionAside,
  SectionLabel,
  TextLink,
  useTypeScale,
  type TypeScale,
} from '@/components/public/ui';
import { contactHref, goToEarlyAccess } from '@/lib/destinations';
import { accentText, elevation, hexToRgba, softFill, type ThemeTokens } from '@/theme/tokens';
import { BP, cellBasis, useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';

/* ------------------------------------------------------------------ */
/* content                                                             */
/* ------------------------------------------------------------------ */

type Accent = 'brand' | 'violet' | 'orange' | 'green' | 'pink';

/* ------------------------------------------------------------------ */
/* the hero, as the approved mock draws it                             */
/* ------------------------------------------------------------------ */

/**
 * The extensions the chip row offers, in the order
 * `design/approved/public-domains-hero.png` draws them. `.com` is the one
 * that starts selected, which is the state the mock is drawn in.
 *
 * ⭐ **Every price beside a result is read from `TLD_ROWS` below**, the table
 * this page already publishes, rather than from a second list. Two price
 * lists on one page is how a first-year figure and its renewal come apart,
 * and the renewal column exists precisely to stop that.
 *
 * ⚠️ **`.net`, `.ai` and `.app` are in the mock and this page publishes no
 * price for them.** Writing three plausible numbers to fill the gap would be
 * the same failure as printing *Available* against a name no registrar was
 * asked about — a figure nobody checked, presented as one somebody did. So a
 * row for an extension the table does not carry says so, in words, and the
 * gap closes the day those three are published in `TLD_ROWS`.
 */
const HERO_TLDS: readonly string[] = ['com', 'net', 'org', 'co', 'ai', 'io', 'shop', 'app'];

/** What **More** reveals: the rest of what `TLD_ROWS` actually publishes. */
const HERO_TLDS_MORE: readonly string[] = ['dental', 'cafe'];

/** The price column when the page has not published a figure for an extension. */
const NO_PUBLISHED_PRICE = 'Price on request';

/**
 * This page's own published first-year price for one extension, or `null`.
 *
 * 🛑 `TLD_ROWS` is the only place a price may come from. The trade-name row
 * carries two extensions in one label (`.dental / .cafe`) at one price, so the
 * label is split rather than a second entry being invented for each.
 */
function publishedFirstYear(tld: string): string | null {
  for (const row of TLD_ROWS) {
    const named = row.tld.split('/').map((one) => one.trim().replace(/^\./, ''));
    if (named.includes(tld)) return row.first;
  }
  return null;
}

/** The five-item row under the search. Icon tiles are round and brand-tinted. */
const HERO_FEATURES: { key: string; icon: string; label: string }[] = [
  { key: 'privacy', icon: 'shield-halved', label: 'Privacy included' },
  { key: 'https', icon: 'lock', label: 'HTTPS included' },
  { key: 'dns', icon: 'globe', label: 'DNS management' },
  { key: 'email', icon: 'envelope', label: 'Email forwarding' },
  { key: 'renewal', icon: 'bolt', label: 'No renewal surprises' },
];

/**
 * 🛑 **The trust band, and the claim the owner struck out.**
 *
 * The approved mock reads *"Join thousands of businesses building with
 * FlowSmartly"* over the ticks *Trusted by businesses · Secure & reliable ·
 * All-in-one platform*. **That cannot ship.** This site is pre-launch — its
 * own primary call to action is *Join early access* — and there is no source
 * anywhere in this product for a customer count. An adoption number nobody
 * can check is a fabricated metric, and it fails for exactly the reason the
 * availability ruling in `DOMAIN-SEARCH-BACKEND-NOTE.md` exists: a page that
 * asserts something nobody verified has spent the only trust it had.
 *
 * ⭐ **The owner's ruling: keep the band and its three ticks exactly where the
 * mock puts them, and say things that are true.** Nothing about the layout,
 * the spacing or the tick treatment changed — only the claim. It now talks
 * about what the product includes, every word of which this page already
 * states and stands behind further down, instead of how many people use it.
 */
const TRUST_HEAD = 'Everything a domain needs, included in the price';
const TRUST_TICKS = ['Registered in your name', 'Secure & reliable', 'All-in-one platform'];

/** The strip that closes the hero. Four real destinations, not four labels. */
const HERO_STRIP: { key: string; icon: string; label: string; href: string }[] = [
  { key: 'site', icon: 'window-maximize', label: 'Build your site', href: ROUTES.websiteBuilder },
  { key: 'shop', icon: 'cart-shopping', label: 'Launch your shop', href: ROUTES.flowshop },
  { key: 'tools', icon: 'share-nodes', label: 'Connect your tools', href: ROUTES.integrations },
  { key: 'grow', icon: 'arrow-trend-up', label: 'Grow globally', href: ROUTES.social },
];

/**
 * The extension pills floating behind the hero, as percentages of the band.
 *
 * ⚠️ **The mock's photograph does not exist in this repository.** Behind the
 * wash it draws a laptop and a plant on a white desk; all 81 source-side
 * photos in `apps/v5/assets/images` were enumerated and the nearest,
 * `storefront-hero.webp`, is a shop — semantically wrong on a domains page,
 * and an unrelated photograph is worse than none. The mock's picture sits
 * under a heavy white scrim anyway, so the composition here is the wash, the
 * globe and these pills, and the photograph is an asset the owner supplies.
 *
 * Decoration only: `aria-hidden`, no hit target, and drawn at all only where
 * there is margin outside the content column to hold them. Below ~1200 there
 * is not, and they would land on the search bar.
 */
const HERO_PILLS: { key: string; label: string; side: 'left' | 'right'; x: number; y: number; big: boolean }[] = [
  { key: 'com', label: '.com', side: 'left', x: 4, y: 16, big: true },
  { key: 'shop', label: '.shop', side: 'left', x: 6, y: 31, big: true },
  { key: 'ai', label: '.ai', side: 'left', x: 3.5, y: 45, big: false },
  { key: 'net', label: '.net', side: 'right', x: 9, y: 17, big: false },
  { key: 'org', label: '.org', side: 'right', x: 3, y: 39, big: true },
  { key: 'io', label: '.io', side: 'right', x: 3.5, y: 55, big: false },
];

/**
 * What somebody typed, as a name a registrar would accept.
 *
 * ⚠️ Lower-cased, spaces and punctuation dropped, hyphens kept, and any
 * extension they typed themselves removed — somebody who types
 * *"Bright Smile Dental.com"* means `brightsmiledental`, and showing them
 * `brightsmiledental.com.com` would read as a bug in the first five seconds of
 * the product.
 */
function nameFrom(typed: string): string {
  const withoutTld = typed.trim().toLowerCase().replace(/\.[a-z]{2,}$/, '');
  return withoutTld.replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '');
}

/**
 * The hero search result BEFORE anybody has typed — the page at rest.
 *
 * Prices are illustrative first-year figures; the pricing table below is the one
 * that carries the renewal column, because a first-year price without its
 * renewal is the oldest trick in this industry.
 */
const SEARCH_RESULTS: { key: string; name: string; price: string; state: 'available' | 'taken' | 'premium' }[] = [
  { key: 'com', name: 'brightsmiledental.com', price: '$12.99', state: 'available' },
  { key: 'dental', name: 'brightsmile.dental', price: '$34.99', state: 'available' },
  { key: 'co', name: 'brightsmile.co', price: '$24.99', state: 'premium' },
  { key: 'net', name: 'brightsmile.net', price: '—', state: 'taken' },
];

/** Four, so the row divides at 1, 2 and 4 columns. */
const STEPS: { key: string; step: string; icon: string; title: string; body: string; accent: Accent }[] = [
  {
    key: 'search',
    step: '01',
    icon: 'magnifying-glass',
    title: 'Search',
    body: 'Type a name and see what is free across every extension, with the real price beside each one.',
    accent: 'brand',
  },
  {
    key: 'buy',
    step: '02',
    icon: 'credit-card',
    title: 'Register',
    body: 'Buy it on the card already on your account. Registration is in your name, not ours.',
    accent: 'violet',
  },
  {
    key: 'connect',
    step: '03',
    icon: 'plug',
    title: 'Connect',
    body: 'Point it at your FlowSmartly site, your store, or somewhere else entirely. DNS is written for you.',
    accent: 'orange',
  },
  {
    key: 'renew',
    step: '04',
    icon: 'arrows-rotate',
    title: 'Keep it',
    body: 'Auto-renew is on by default and we warn you before the charge, so a name never lapses by accident.',
    accent: 'green',
  },
];

/** Six, so the grid divides at 1, 2 and 3 columns. */
const INCLUDED: { key: string; icon: string; title: string; body: string; accent: Accent }[] = [
  {
    key: 'privacy',
    icon: 'user-shield',
    title: 'WHOIS privacy',
    body: 'Your name, address and phone number stay out of the public record. Included, not an upsell.',
    accent: 'brand',
  },
  {
    key: 'ssl',
    icon: 'lock',
    title: 'HTTPS certificate',
    body: 'A certificate is issued and renewed automatically for any site you point the domain at.',
    accent: 'green',
  },
  {
    key: 'dns',
    icon: 'sitemap',
    title: 'Full DNS control',
    body: 'A, AAAA, CNAME, MX, TXT and SRV records, editable — with a guided mode if you would rather not.',
    accent: 'violet',
  },
  {
    key: 'email',
    icon: 'envelope',
    title: 'Email forwarding',
    body: 'Send hello@yourbusiness.com to the inbox you already read, before you commit to a mailbox.',
    accent: 'orange',
  },
  {
    key: 'lock',
    icon: 'shield-halved',
    title: 'Transfer lock & 2FA',
    body: 'The name is locked against transfer by default and every change is protected by your account security.',
    accent: 'pink',
  },
  {
    key: 'renewal',
    icon: 'receipt',
    title: 'Honest renewals',
    body: 'The renewal price is shown before you buy and never quietly rises. One bill with everything else.',
    accent: 'brand',
  },
];

/** The DNS panel. Illustration only — every row is a View. */
const DNS_ROWS: { key: string; type: string; host: string; value: string }[] = [
  { key: 'a', type: 'A', host: '@', value: 'FlowSmartly site' },
  { key: 'www', type: 'CNAME', host: 'www', value: 'FlowSmartly site' },
  { key: 'mx', type: 'MX', host: '@', value: 'Google Workspace' },
  { key: 'txt', type: 'TXT', host: '@', value: 'Verification' },
];

/** Where a name can point. Three, so the row divides at 1 and 3. */
const TARGETS: { key: string; icon: string; title: string; body: string; href: string; accent: Accent }[] = [
  {
    key: 'site',
    icon: 'window-maximize',
    title: 'Your FlowSmartly site',
    body: 'One click. The records are written and the certificate is issued while you watch.',
    href: ROUTES.websiteBuilder,
    accent: 'brand',
  },
  {
    key: 'shop',
    icon: 'bag-shopping',
    title: 'Your storefront',
    body: 'Put the shop on the apex, or on shop.yourbusiness.com — both are a single choice.',
    href: ROUTES.flowshop,
    accent: 'violet',
  },
  {
    key: 'elsewhere',
    icon: 'arrow-up-right-from-square',
    title: 'Somewhere else',
    body: 'Keep hosting where it is. Buy the name here and point it wherever you like.',
    href: ROUTES.integrations,
    accent: 'orange',
  },
];

/**
 * Illustrative pricing. Six rows, and the renewal column exists on purpose —
 * see the note under the table.
 */
const TLD_ROWS: { key: string; tld: string; first: string; renew: string; note: string }[] = [
  { key: 'com', tld: '.com', first: '$12.99', renew: '$16.99', note: 'The default choice' },
  { key: 'co', tld: '.co', first: '$24.99', renew: '$32.99', note: 'Short and available' },
  { key: 'shop', tld: '.shop', first: '$4.99', renew: '$36.99', note: 'Retail and commerce' },
  { key: 'io', tld: '.io', first: '$39.99', renew: '$54.99', note: 'Software and tech' },
  { key: 'org', tld: '.org', first: '$13.99', renew: '$17.99', note: 'Non-profits and groups' },
  { key: 'local', tld: '.dental / .cafe', first: '$34.99', renew: '$38.99', note: 'Trade-specific names' },
];

/** Transfers in. Three steps, divides at 1 and 3. */
const TRANSFER: { key: string; icon: string; title: string; body: string }[] = [
  {
    key: 'unlock',
    icon: 'unlock',
    title: 'Unlock and get the code',
    body: 'At your current registrar, turn off the transfer lock and copy the authorisation code.',
  },
  {
    key: 'paste',
    icon: 'paste',
    title: 'Paste it here',
    body: 'We check the name, show you the transfer cost and the year it adds, and start it.',
  },
  {
    key: 'done',
    icon: 'circle-check',
    title: 'Nothing goes down',
    body: 'Your existing DNS is copied first, so the site and the email keep working throughout.',
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Who owns the domain I buy here?',
    a: 'You do. It is registered in your name with you as the legal registrant, and you can transfer it away whenever you want — we will not hold it hostage.',
  },
  {
    q: 'What does it cost to renew?',
    a: 'The renewal price is shown on the pricing table and again before you buy. It is the number you should compare, because a low first year with a high renewal costs more over any real timeframe.',
  },
  {
    q: 'Can I move a domain I already own?',
    a: 'Yes. Unlock it at your current registrar, paste the authorisation code, and we copy your existing DNS across before the transfer completes so nothing goes offline.',
  },
  {
    q: 'Do I have to host the site with FlowSmartly?',
    a: 'No. You can buy a name here and point it anywhere. The DNS editor is complete, and there is a guided mode for the common targets.',
  },
  {
    q: 'Is WHOIS privacy really free?',
    a: 'Yes, on every extension that permits it. Some country extensions have registry rules that require public details; we tell you before you buy which ones those are.',
  },
  {
    q: 'What happens if I forget to renew?',
    a: 'Auto-renew is on by default, and we email you before the charge. If a renewal fails there is a grace period during which the name can still be recovered.',
  },
];

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function DomainsPage() {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  const router = useRouter();
  const styles = useMemo(() => createStyles(t, l, type), [t, l, type]);

  const accentOf = (accent: Accent) =>
    accent === 'violet'
      ? t.violet
      : accent === 'green'
        ? t.green
        : accent === 'orange'
          ? t.orange
          : accent === 'pink'
            ? t.pink
            : t.brand;

  return (
    <PageShell
      title="Domains"
      description="Search, register and manage a domain inside FlowSmartly — WHOIS privacy, HTTPS and DNS included, with renewal prices shown before you buy."
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Solutions', path: ROUTES.solutions },
          { name: 'Domains', path: ROUTES.domains },
        ]),
        faqJsonLd(FAQ.map((item) => ({ question: item.q, answer: item.a }))),
      ]}>
      {/*
        ------------------------------------------------ hero

        ⭐ **A full-bleed, centre-stacked hero, built to
        `design/approved/public-domains-hero.png`.** It replaces the old
        two-column layout — headline on the left, a small search card tucked
        into the right — in which the search was the *smaller* of the two
        things on screen. The mock's argument is that on a domains page the
        search bar is the page: widest element, dead centre, nothing competing
        with it.

        The band is `tone="brand"`, which is the pale blue wash, bled to the
        viewport edges and clipped, so the globe and the floating pills can sit
        off the content column without a pixel of horizontal scroll.
      */}
      <Band tone="brand" art="none" style={styles.heroBand}>
        <HeroDecor styles={styles} t={t} l={l} />

        <View style={styles.heroInner}>
          <Reveal style={styles.heroHead} distance={16}>
            <View style={styles.heroEyebrow}>
              <SectionLabel>{"DOMAINS FOR WHAT'S NEXT"}</SectionLabel>
            </View>
            <Heading level={1} style={[type.display, styles.heroTitle]}>
              Find the perfect domain for{' '}
              <Text style={[type.display, styles.heroTitleAccent]}>your business</Text>
            </Heading>
            <Text style={[type.body, styles.heroLede]}>
              Search every extension, register in your name, and start building today. Privacy,
              HTTPS and DNS are included — no renewal surprises.
            </Text>
          </Reveal>

          {/*
           * ⭐ **A real search, and it used to be a picture of one.**
           *
           * This card was `Views` and `Texts` with the word *brightsmiledental*
           * typed into it — an illustration, labelled as one. The owner's brief
           * is that somebody should be able to check a name here freely, and
           * that checking is what brings them in: *"so people can freely check
           * domain names and that can get them to signup just for domain name
           * service."* A picture of a search box converts nobody.
           */}
          <Reveal style={styles.heroSearchWrap} distance={16} delay={80}>
            <DomainSearch styles={styles} t={t} l={l} />
          </Reveal>

          <Reveal style={styles.featureRow} distance={14} delay={140}>
            {HERO_FEATURES.map((item) => (
              <View key={item.key} style={styles.featureItem}>
                <View style={styles.featureIcon}>
                  <FontAwesome6 name={item.icon as never} size={16} color={t.brand} aria-hidden={true} />
                </View>
                <Text numberOfLines={2} style={styles.featureText}>
                  {item.label}
                </Text>
              </View>
            ))}
          </Reveal>

          {/* 🛑 The owner's ruling on the mock's adoption claim — see TRUST_HEAD. */}
          <Reveal style={styles.trustBand} distance={14} delay={180}>
            <Text style={styles.trustHead}>{TRUST_HEAD}</Text>
            <View style={styles.trustTicks}>
              {TRUST_TICKS.map((tick) => (
                <View key={tick} style={styles.trustTick}>
                  <View style={styles.trustTickDot}>
                    <FontAwesome6 name="check" size={9} color={t.textOnBrand} aria-hidden={true} />
                  </View>
                  <Text numberOfLines={1} style={styles.trustTickText}>
                    {tick}
                  </Text>
                </View>
              ))}
            </View>
          </Reveal>

          {/*
           * ⚠️ **Both hero controls survive the rebuild.** The mock draws
           * neither — it leans on the header's *Join early access* — but a
           * redesign is not a reason to lose the page's two standing calls to
           * action. They land after the proof, which is where a CTA belongs.
           */}
          <View style={styles.heroCtaRow}>
            <ButtonRow>
              <PrimaryButton
                label="Join early access"
                size="lg"
                full={l.isPhone}
                icon="arrow-right"
                iconRight
                trackId="domains.hero.find-domain"
                onPress={() => goToEarlyAccess()}
              />
              <SecondaryButton
                label="Transfer one in"
                size="lg"
                full={l.isPhone}
                trackId="domains.hero.transfer-in"
                onPress={() => router.push(contactHref('sales') as never)}
              />
            </ButtonRow>
          </View>
        </View>

        {/*
         * The strip that closes the hero. Its negative margins cancel the
         * band's own padding exactly, so it reaches the viewport edge and sits
         * flush on the band's bottom rule — the white shelf the mock draws.
         */}
        <View style={styles.heroStrip}>
          {HERO_STRIP.map((item, index) => (
            <Pressable
              key={item.key}
              accessibilityRole="link"
              accessibilityLabel={item.label}
              onPress={() => router.push(item.href as never)}
              style={[styles.stripItem, index > 0 && !l.isPhone ? styles.stripItemRuled : null]}>
              <FontAwesome6 name={item.icon as never} size={17} color={t.brand} aria-hidden={true} />
              <Text numberOfLines={1} style={styles.stripText}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Band>

      {/*
        ------------------------------------------------ how it works

        ⚠️ **`art="none"`, and it is the hero's doing.** This band used to hang
        a `tasks` separator up into the gap above itself. That gap is gone: the
        hero now ends flush on a full-bleed white shelf with its own rule, and
        the separator was measured crossing the four strip labels. `art`
        documents this exact case — pass `'none'` when the section above is too
        compact to give one room — and the shelf is already the boundary the
        seam existed to draw.
      */}
      <Band tone="surface" art="none">
        <View style={styles.headCentered}>
          <SectionLabel>HOW IT WORKS</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitleCentered]}>
            Bought, connected and renewed without a second account.
          </Heading>
        </View>

        <View style={styles.stepGrid}>
          {STEPS.map((step, index) => (
            <Reveal key={step.key} style={styles.stepCell} distance={14} delay={index * 70}>
              <View style={styles.stepCard}>
                <View style={styles.stepTop}>
                  <View style={[styles.stepIcon, { backgroundColor: softFill(accentOf(step.accent), t) }]}>
                    <FontAwesome6 name={step.icon as never} size={16} color={accentOf(step.accent)}  aria-hidden={true}/>
                  </View>
                  <Text numberOfLines={1} style={styles.stepNumber}>
                    {step.step}
                  </Text>
                </View>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepBody}>{step.body}</Text>
              </View>
            </Reveal>
          ))}
        </View>
      </Band>

      {/* ------------------------------------------------ included */}
      <Band tone="brand" art={{ variant: 'chart', color: t.brand, side: 'left' }}>
        <View style={styles.headCentered}>
          <SectionLabel>IN THE PRICE</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitleCentered]}>
            The things other registrars charge for.
          </Heading>
          <Text style={[type.body, styles.headBodyCentered]}>
            Privacy, a certificate and DNS are not premium features. They are what a domain needs to be
            usable and safe, so they are included.
          </Text>
        </View>

        <View style={styles.includeGrid}>
          {INCLUDED.map((item, index) => (
            <Reveal key={item.key} style={styles.includeCell} distance={14} delay={index * 50}>
              <View style={styles.includeCard}>
                <View style={[styles.includeIcon, { backgroundColor: softFill(accentOf(item.accent), t) }]}>
                  <FontAwesome6 name={item.icon as never} size={17} color={accentOf(item.accent)}  aria-hidden={true}/>
                </View>
                <Text style={styles.includeTitle}>{item.title}</Text>
                <Text style={styles.includeBody}>{item.body}</Text>
              </View>
            </Reveal>
          ))}
        </View>
      </Band>

      {/* ------------------------------------------------ connect */}
      <OpenSection>
        <View style={styles.splitRow}>
          <Reveal style={styles.splitCopy} distance={16}>
            <SectionLabel>POINTING IT SOMEWHERE</SectionLabel>
            <Heading level={2} style={[type.h2, styles.headTitle]}>
              DNS you can drive, or never have to look at.
            </Heading>
            <Text style={[type.body, styles.headBody]}>
              Choose where the name should go and the records are written for you. If you know what an
              MX record is, the full editor is one tab away and nothing is hidden from you.
            </Text>
            <TextLink
              label="Build a site to point it at"
              onPress={() => router.push(ROUTES.websiteBuilder as never)}
            />
          </Reveal>

          <Reveal style={styles.splitVisual} distance={16} delay={90}>
            <View style={styles.dnsCard}>
              <View style={styles.dnsHead}>
                <Text numberOfLines={1} style={styles.dnsTitle}>
                  DNS records
                </Text>
                <Text numberOfLines={1} style={styles.dnsPill}>
                  Managed
                </Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={!l.isPhone}
                contentContainerStyle={styles.dnsScroll}>
                <View style={styles.dnsTable}>
                  <View style={styles.dnsHeadRow}>
                    <Text numberOfLines={1} style={[styles.dnsHeadCell, styles.colType]}>
                      Type
                    </Text>
                    <Text numberOfLines={1} style={[styles.dnsHeadCell, styles.colHost]}>
                      Host
                    </Text>
                    <Text numberOfLines={1} style={[styles.dnsHeadCell, styles.colValue]}>
                      Points to
                    </Text>
                  </View>
                  {DNS_ROWS.map((row) => (
                    <View key={row.key} style={styles.dnsRow}>
                      <Text numberOfLines={1} style={[styles.dnsType, styles.colType]}>
                        {row.type}
                      </Text>
                      <Text numberOfLines={1} style={[styles.dnsCell, styles.colHost]}>
                        {row.host}
                      </Text>
                      <Text numberOfLines={1} style={[styles.dnsCellStrong, styles.colValue]}>
                        {row.value}
                      </Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          </Reveal>
        </View>

        <View style={styles.targetGrid}>
          {TARGETS.map((target, index) => (
            <Reveal key={target.key} style={styles.targetCell} distance={14} delay={index * 60}>
              <View style={styles.targetCard}>
                <View style={[styles.targetIcon, { backgroundColor: softFill(accentOf(target.accent), t) }]}>
                  <FontAwesome6 name={target.icon as never} size={16} color={accentOf(target.accent)}  aria-hidden={true}/>
                </View>
                <Text style={styles.targetTitle}>{target.title}</Text>
                <Text style={styles.targetBody}>{target.body}</Text>
                <View style={styles.targetSpacer} />
                <TextLink label="Learn more" onPress={() => router.push(target.href as never)} />
              </View>
            </Reveal>
          ))}
        </View>
      </OpenSection>

      {/* ------------------------------------------------ pricing */}
      <Band tone="surface" art={{ variant: 'analytics', color: t.brand, side: 'right' }}>
        <View style={styles.headCentered}>
          <SectionLabel>PRICING</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitleCentered]}>
            First year and renewal, side by side.
          </Heading>
          <Text style={[type.body, styles.headBodyCentered]}>
            The renewal column is the one that matters. We put it next to the headline price because
            most registrars do not.
          </Text>
        </View>

        <Reveal style={styles.priceWrap} distance={14}>
          <View style={styles.priceCard}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={!l.isPhone}
              contentContainerStyle={styles.priceScroll}>
              <View style={styles.priceTable}>
                <View style={styles.priceHeadRow}>
                  <Text numberOfLines={1} style={[styles.priceHeadCell, styles.colTld]}>
                    Extension
                  </Text>
                  <Text numberOfLines={1} style={[styles.priceHeadCell, styles.colNum]}>
                    First year
                  </Text>
                  <Text numberOfLines={1} style={[styles.priceHeadCell, styles.colNum]}>
                    Renews at
                  </Text>
                  <Text numberOfLines={1} style={[styles.priceHeadCell, styles.colNote]}>
                    Best for
                  </Text>
                </View>
                {TLD_ROWS.map((row) => (
                  <View key={row.key} style={styles.priceRow}>
                    <Text numberOfLines={1} style={[styles.priceTld, styles.colTld]}>
                      {row.tld}
                    </Text>
                    <Text numberOfLines={1} style={[styles.priceValue, styles.colNum]}>
                      {row.first}
                    </Text>
                    <Text numberOfLines={1} style={[styles.priceRenew, styles.colNum]}>
                      {row.renew}
                    </Text>
                    <Text numberOfLines={1} style={[styles.priceNote, styles.colNote]}>
                      {row.note}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
          <Text style={styles.priceFootnote}>
            Illustrative prices per year, shown before you buy. Registry fees and local taxes can
            change what a specific extension costs.
          </Text>
        </Reveal>
      </Band>

      {/* ------------------------------------------------ transfer */}
      <Band tone="brand" art={{ variant: 'shield', color: t.brand, side: 'left' }}>
        <View style={styles.headCentered}>
          <SectionLabel>MOVING ONE IN</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitleCentered]}>
            Transfer without the day of downtime.
          </Heading>
        </View>

        <View style={styles.transferGrid}>
          {TRANSFER.map((item, index) => (
            <Reveal key={item.key} style={styles.transferCell} distance={14} delay={index * 70}>
              <View style={styles.transferCard}>
                <View style={styles.transferIcon}>
                  <FontAwesome6 name={item.icon as never} size={16} color={t.brand}  aria-hidden={true}/>
                </View>
                <Text style={styles.transferTitle}>{item.title}</Text>
                <Text style={styles.transferBody}>{item.body}</Text>
              </View>
            </Reveal>
          ))}
        </View>
      </Band>

      {/* ------------------------------------------------ faq */}
      <OpenSection>
        <View style={styles.headCentered}>
          <SectionLabel>QUESTIONS</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitleCentered]}>
            The things worth checking before you buy a name.
          </Heading>
        </View>

        <View style={styles.faqGrid}>
          {FAQ.map((item, index) => (
            <Reveal key={item.q} style={styles.faqCell} distance={12} delay={index * 40}>
              <View style={styles.faqCard}>
                <Text style={styles.faqQ}>{item.q}</Text>
                <Text style={styles.faqA}>{item.a}</Text>
              </View>
            </Reveal>
          ))}
        </View>
      </OpenSection>
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/* styles                                                              */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* the example row's colours                                            */
/* ------------------------------------------------------------------ */

/**
 * ⚠️ **Module scope, and they used to be closures inside the page.** The hero
 * search is its own component now, and it draws the example rows before anybody
 * has typed — so both it and the page body need these. A second copy inside the
 * component is two places for *Premium* to stop being orange.
 *
 * They colour the EXAMPLE only. Nothing checks a real name's state; see
 * `DomainSearch` for why that word is never printed against a searched name.
 */
type ExampleState = 'available' | 'taken' | 'premium';

function stateColorOf(state: ExampleState, t: ThemeTokens): string {
  return state === 'available' ? t.green : state === 'premium' ? t.orange : t.textSubtle;
}

function stateLabelOf(state: ExampleState): string {
  return state === 'available' ? 'Available' : state === 'premium' ? 'Premium' : 'Taken';
}

/* ------------------------------------------------------------------ */
/* the hero decoration                                                  */
/* ------------------------------------------------------------------ */

/**
 * The globe motif and the floating extension pills the mock draws behind the
 * hero. Nothing here is content: the whole layer is `aria-hidden`, takes no
 * pointer events, and the hero reads identically with it removed.
 *
 * **Two deliberate gates.** The globe needs a viewport wide enough to have
 * margin outside the content column, and the pills need more of it still — at
 * 1120 the centred search bar leaves ~70px a side and a pill would land on it.
 * So the globe starts at the tablet breakpoint and the pills at 1200. On a
 * phone neither is drawn at all, which is the correct small-screen answer for
 * decoration: remove it rather than shrink it into the copy.
 *
 * ⚠️ **The photograph the mock composites this over is an asset gap** — see
 * the note on `HERO_PILLS`.
 */
function HeroDecor({
  styles,
  t,
  l,
}: {
  readonly styles: ReturnType<typeof createStyles>;
  readonly t: ThemeTokens;
  readonly l: Layout;
}) {
  if (l.width < BP.tablet) return null;

  const globe = Math.round(Math.min(l.width * 0.46, 660));
  const line = hexToRgba(t.brand, t.ground === 'light' ? 0.13 : 0.2);

  return (
    <View style={styles.decor} pointerEvents="none" aria-hidden={true}>
      <View
        style={[
          styles.globe,
          { width: globe, height: globe, right: -Math.round(globe * 0.22), top: -Math.round(globe * 0.16) },
        ]}>
        <Svg width={globe} height={globe} viewBox="0 0 200 200">
          <Circle cx={100} cy={100} r={99} fill="none" stroke={line} strokeWidth={0.9} />
          {[26, 56, 86].map((ry) => (
            <Ellipse key={`lat-${ry}`} cx={100} cy={100} rx={99} ry={ry} fill="none" stroke={line} strokeWidth={0.7} />
          ))}
          {[26, 56, 86].map((rx) => (
            <Ellipse key={`lon-${rx}`} cx={100} cy={100} rx={rx} ry={99} fill="none" stroke={line} strokeWidth={0.7} />
          ))}
        </Svg>
      </View>

      {l.width < 1200
        ? null
        : HERO_PILLS.map((pill) => (
            <View
              key={pill.key}
              style={[
                styles.pill,
                pill.big ? styles.pillBig : null,
                { top: `${pill.y}%` },
                pill.side === 'left' ? { left: `${pill.x}%` } : { right: `${pill.x}%` },
              ]}>
              <Text style={pill.big ? styles.pillTextBig : styles.pillText}>{pill.label}</Text>
            </View>
          ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* the hero search                                                      */
/* ------------------------------------------------------------------ */

/**
 * **Type a name, pick the extensions, see the price of each.**
 *
 * ## 🛑 What this says about availability, and what it refuses to say
 *
 * Nothing here reaches a registrar. There is no availability lookup in this
 * product yet — `DOMAIN-SEARCH-BACKEND-NOTE.md` beside this app says what one
 * would need — so this card **will not print the word _available_ against a
 * name it has not checked.** That is not caution for its own sake: a marketing
 * page that tells somebody a name is free, and then takes their card and finds
 * it is not, has spent the only trust it had.
 *
 * ⭐ **What it does instead is the half that is real, and it is the half that
 * converts.** The names are constructed from what they typed, instantly, with
 * this page's own published first-year price beside each one. The check itself
 * is the thing they sign up for, which is exactly the errand the brief names.
 * Nobody is asked for a card to find out what a `.com` costs.
 *
 * ## ⚠️ The resting state is the designed one
 *
 * Before anybody types, the card draws `SEARCH_RESULTS` — the example the page
 * shipped with — under a line saying it is an example. A hero that opens as an
 * empty box shows a visitor nothing, and this is the first screen of the page.
 * The example is the only place the word *Available* appears, and it is
 * labelled as an example immediately above itself, not in a footnote below.
 *
 * ## ⚠️ Why the results are here and not somewhere further down
 *
 * The approved mock draws no result rows at all — search bar, chips, then
 * straight into the feature row. Shipping that literally would undo the fix
 * this page already had once: a search with nowhere for answers to land is an
 * illustration of a search box. So the rows stay, and they sit **directly
 * under the chip row**, because the chips are what decides which extensions
 * the answers cover. Search → chips → answers is one downward glance, and it
 * keeps the bar itself the clean full-width centrepiece the mock designs.
 */
function DomainSearch({
  styles,
  t,
  l,
}: {
  readonly styles: ReturnType<typeof createStyles>;
  readonly t: ThemeTokens;
  readonly l: Layout;
}) {
  const [typed, setTyped] = useState('');
  const [picked, setPicked] = useState<readonly string[]>(['com']);
  const [expanded, setExpanded] = useState(false);
  const name = nameFrom(typed);

  const chips = useMemo(() => (expanded ? [...HERO_TLDS, ...HERO_TLDS_MORE] : [...HERO_TLDS]), [expanded]);

  /*
   * ⚠️ Derived, not stored. A `searched` flag would let the results and the
   * field disagree the moment somebody edits what they typed — they would be
   * reading rows for a name that is no longer in the box.
   *
   * The chip row's order is the result order, so the list reads in the order
   * it is picked from rather than in the order the chips were tapped.
   */
  const results = useMemo(() => {
    if (name === '') return [];
    return [...HERO_TLDS, ...HERO_TLDS_MORE]
      .filter((tld) => picked.includes(tld))
      .map((tld) => ({ key: tld, name: `${name}.${tld}`, price: publishedFirstYear(tld) }));
  }, [name, picked]);

  /**
   * Multi-select with a floor of one. Deselecting the last extension would
   * leave a search that can return nothing, so the last one cannot be turned
   * off — the control simply holds rather than producing an empty state
   * nobody asked for.
   */
  const toggle = (tld: string) => {
    setPicked((was) => {
      if (!was.includes(tld)) return [...was, tld];
      return was.length === 1 ? was : was.filter((one) => one !== tld);
    });
  };

  return (
    <View style={styles.searchWrap}>
      <View style={styles.searchBar}>
        <View style={styles.searchFieldRow}>
          <FontAwesome6
            name="magnifying-glass"
            size={l.isPhone ? 18 : 20}
            color={t.textSubtle}
            aria-hidden={true}
          />
          <TextInput
            value={typed}
            onChangeText={setTyped}
            placeholder="yourbusinessname"
            placeholderTextColor={t.textSubtle}
            accessibilityLabel="Search for a domain name"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.searchText}
          />
          {/* Appears only once there is something to clear, as the mock draws it. */}
          {typed === '' ? null : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear the domain search"
              onPress={() => setTyped('')}
              style={styles.searchClear}>
              <FontAwesome6 name="xmark" size={16} color={t.textSubtle} aria-hidden={true} />
            </Pressable>
          )}
        </View>
        {/*
         * ⚠️ The rows appear as somebody types, so this control has nothing
         * left to do — and a button that does nothing is worse than no button.
         * It carries the affordance and the focus target: pressing it dismisses
         * the keyboard on a phone, which is the one thing left to want.
         */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search domains"
          onPress={() => {
            setTyped((was) => was.trim());
          }}
          style={styles.searchGo}>
          <Text numberOfLines={1} style={styles.searchGoText}>
            Search
          </Text>
          <FontAwesome6 name="arrow-right" size={15} color={t.textOnBrand} aria-hidden={true} />
        </Pressable>
      </View>

      {/*
       * The chip row. Real controls, not decoration: each one carries its
       * pressed state to assistive technology and changes what the rows below
       * cover. It wraps rather than scrolling sideways — a scrolling row hides
       * `.app` off the edge of a phone with nothing saying it is there.
       */}
      <View style={styles.chipRow}>
        {chips.map((tld) => {
          const on = picked.includes(tld);
          return (
            <Pressable
              key={tld}
              accessibilityRole="button"
              accessibilityLabel={`.${tld} extension`}
              accessibilityState={{ selected: on }}
              aria-pressed={on}
              onPress={() => toggle(tld)}
              style={[styles.chip, on ? styles.chipOn : null]}>
              <Text numberOfLines={1} style={[styles.chipText, on ? styles.chipTextOn : null]}>
                {`.${tld}`}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Show fewer extensions' : 'Show more extensions'}
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((was) => !was)}
          style={[styles.chip, styles.chipMore]}>
          <Text numberOfLines={1} style={styles.chipText}>
            {expanded ? 'Fewer' : 'More'}
          </Text>
          <FontAwesome6
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={11}
            color={t.textMuted}
            aria-hidden={true}
          />
        </Pressable>
      </View>

      <View style={styles.resultsPanel}>
        <Text style={styles.resultsLead}>
          {results.length === 0
            ? 'An example — type a name above to see yours.'
            : 'Your name across the extensions you picked.'}
        </Text>

        {results.length === 0
          ? SEARCH_RESULTS.map((result, index) => (
              <View key={result.key} style={[styles.resultRow, index > 0 ? styles.resultRowRuled : null]}>
                <View
                  style={[styles.resultDot, { backgroundColor: softFill(stateColorOf(result.state, t), t) }]}>
                  <FontAwesome6
                    name={result.state === 'taken' ? 'xmark' : 'check'}
                    size={12}
                    color={stateColorOf(result.state, t)}
                    aria-hidden={true}
                  />
                </View>
                <Text numberOfLines={1} style={styles.resultName}>
                  {result.name}
                </Text>
                {/*
                 * ⚠️ The state and the price travel together. At 390 the row
                 * cannot hold a long name and both of them, and letting the
                 * two wrap independently stranded a bare `$12.99` on a line
                 * of its own under the name. Grouped, the row breaks into
                 * name / state + price, which is a layout rather than a
                 * leftover.
                 */}
                <View style={styles.resultMeta}>
                  <Text numberOfLines={1} style={[styles.resultState, { color: stateColorOf(result.state, t) }]}>
                    {stateLabelOf(result.state)}
                  </Text>
                  <Text numberOfLines={1} style={styles.resultPrice}>
                    {result.price}
                  </Text>
                </View>
              </View>
            ))
          : results.map((result, index) => (
              <View key={result.key} style={[styles.resultRow, index > 0 ? styles.resultRowRuled : null]}>
                <View style={[styles.resultDot, { backgroundColor: softFill(t.brand, t) }]}>
                  <FontAwesome6 name="globe" size={12} color={t.brand} aria-hidden={true} />
                </View>
                <Text numberOfLines={1} style={styles.resultName}>
                  {result.name}
                </Text>
                {/*
                 * 🛑 Price only. No badge, no state, no word about whether the
                 * name is free — nothing asked a registrar. And the figure is
                 * `TLD_ROWS` or it is the plain admission that this page has
                 * not published one; it is never a number invented here.
                 */}
                <View style={styles.resultMeta}>
                  <Text
                    numberOfLines={1}
                    style={[styles.resultPrice, result.price === null ? styles.resultPriceNone : null]}>
                    {result.price ?? NO_PUBLISHED_PRICE}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Check and claim ${result.name}`}
                    onPress={() => {
                      goToEarlyAccess();
                    }}
                    style={styles.claimGo}>
                    <Text numberOfLines={1} style={styles.claimGoText}>
                      Check &amp; claim
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}

        {/* 5, not 3: at 390 the typed note runs to four lines and was clipped mid-word. */}
        <Text numberOfLines={5} style={styles.searchNote}>
          {results.length === 0
            ? 'First-year prices; renewal is shown before you buy.'
            : 'First-year prices; renewal is shown before you buy. Whether a name is still free is confirmed at the registrar when you claim it. Tap an extension above to compare more.'}
        </Text>
      </View>
    </View>
  );
}

function createStyles(t: ThemeTokens, l: Layout, type: TypeScale) {
  const stacked = l.isStacked;
  const gap = l.isPhone ? 12 : 18;
  const half = gap / 2;

  const columns = (phone: number, tablet: number, laptop: number, desktop: number) =>
    l.isPhone ? phone : l.isTablet ? tablet : l.isDesktop ? desktop : laptop;

  // Each count divides its item count at every breakpoint.
  const stepColumns = columns(1, 2, 4, 4);
  const includeColumns = columns(1, 2, 3, 3);
  const targetColumns = l.isCompact ? 1 : 3;
  const transferColumns = l.isCompact ? 1 : 3;
  const faqColumns = l.isPhone ? 1 : 2;

  const gridBase: ViewStyle = {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    marginHorizontal: -half,
    marginTop: l.isPhone ? 20 : 28,
  };

  const cellBase = (count: number): ViewStyle => ({
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: cellBasis(count),
    minWidth: 0,
    padding: half,
  });

  const cardBase: ViewStyle = {
    flexGrow: 1,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 16,
    backgroundColor: t.surfaceRaised,
    padding: l.isPhone ? 15 : 17,
    gap: 9,
    ...(elevation(t, 1) as ViewStyle),
  };

  const panelBase: ViewStyle = {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 18,
    backgroundColor: t.surfaceMuted,
    padding: l.isPhone ? 14 : 18,
    gap: 10,
    ...(elevation(t, 2) as ViewStyle),
  };

  const iconBox = (size: number): ViewStyle => ({
    width: size,
    height: size,
    flexGrow: 0,
    flexShrink: 0,
    borderRadius: Math.round(size / 3),
    alignItems: 'center',
    justifyContent: 'center',
  });

  /**
   * How far the hero band's own padding pushes its content in from the
   * viewport edge. `Band` bleeds by `(width - maxContent) / 2` and re-pads by
   * that plus the page gutter; the strip closing the hero cancels exactly
   * this to reach the edge, so it is derived from the same two numbers rather
   * than from a constant somebody would have to keep in step.
   */
  const bandEdge = Math.max(0, Math.round((l.width - BP.maxContent) / 2)) + l.gutter;

  /**
   * The headline's measure, tied to its own size rather than to a constant.
   *
   * The mock breaks it *"Find the perfect domain / for your business"*, and a
   * fixed max-width only lands that break at one font size — `display` ramps
   * 34 → 52 across the four breakpoints, so a width tuned at 1440 let "for"
   * back onto the first line at 1280 and again at 768. Twelve times the
   * resolved size holds the break at every width it has room to matter at.
   */
  const titleMeasure = Math.round((type.display.fontSize ?? 34) * 12);

  const rowBase: ViewStyle = {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 11,
    backgroundColor: t.surfaceRaised,
    paddingHorizontal: 12,
    paddingVertical: 9,
  };

  return StyleSheet.create({
    /* -------------------------------------------------- hero */
    /*
     * 🛑 **The hero is a band, not an open section, and that is the whole
     * composition.** `Band` is the only thing on this site that reaches the
     * viewport edge at every width, which is what the approved mock needs: a
     * pale blue wash behind a single centred column, with a globe and a
     * scatter of extension pills living in the margin *outside* that column.
     *
     * `overflow: hidden` is the guarantee behind that. Every decorative piece
     * is absolutely positioned and several of them deliberately hang past the
     * right edge, so the band clips rather than letting the page grow a
     * horizontal scrollbar. Measured at 390, 768 and 1440: 0px of overflow.
     */
    heroBand: {
      overflow: 'hidden',
      borderTopWidth: 0,
      paddingTop: l.isPhone ? 30 : 46,
      /*
       * A shade bluer than `tone="brand"` paints on its own. The band tones
       * are sized to be *felt* behind a page's alternating sections; the mock
       * wants the first screen to read as a blue field, and at the stock 0.05
       * it photographed as grey beside it. Still one step on the same token —
       * `t.brand` through `hexToRgba` — not a colour introduced here.
       */
      backgroundColor: hexToRgba(t.brand, t.ground === 'light' ? 0.07 : 0.11),
    },

    decor: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
    globe: { position: 'absolute' },
    pill: {
      position: 'absolute',
      borderRadius: 999,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 16,
      paddingVertical: 9,
      ...(elevation(t, 2) as ViewStyle),
    },
    pillBig: { paddingHorizontal: 22, paddingVertical: 13 },
    pillText: { ...type.h4, color: t.textMuted, fontWeight: '800' },
    pillTextBig: { ...type.h3, color: t.text, fontWeight: '800' },

    // zIndex so the wash and the decoration stay behind the column. Both are
    // positioned elements in react-native-web, so DOM order alone is not a
    // contract worth relying on.
    heroInner: { width: '100%', maxWidth: 1040, alignSelf: 'center', alignItems: 'center', zIndex: 1 },
    heroHead: { width: '100%', alignItems: 'center' },
    heroEyebrow: { alignItems: 'center' },
    heroTitle: { marginTop: l.isPhone ? 14 : 18, width: '100%', maxWidth: titleMeasure, textAlign: 'center' },
    // The second half of the headline, in the brand blue, exactly as the mock.
    heroTitleAccent: { color: t.brand },
    heroLede: {
      marginTop: l.isPhone ? 12 : 16,
      width: '100%',
      maxWidth: 620,
      textAlign: 'center',
      color: t.textMuted,
    },

    heroSearchWrap: { width: '100%', marginTop: l.isPhone ? 24 : 34, alignItems: 'center' },
    searchWrap: { width: '100%', maxWidth: 980, alignSelf: 'center', gap: l.isPhone ? 14 : 16 },

    /*
     * 🛑 **The owner asked for a real search, and the mock made it the page.**
     *
     * The mechanics were already right — somebody types, the extensions they
     * picked resolve below with this page's own prices. What was wrong is that
     * it read as a caption-sized card tucked into the hero's right column: a
     * 14px input at 6px padding, with results in `micro`. A person scanning
     * the page saw an illustration of a search box rather than one to use.
     *
     * So the bar is now the widest single element on the first screen, dead
     * centre, at `h3` — one step above the `h4` it was raised to last time,
     * because the mock's is larger still. The results below sit on `bodySm`
     * and `caption`; nothing here uses `micro`, which the type scale marks
     * DEPRECATED.
     *
     * ⚠️ On a phone the Search button drops to its own full-width line rather
     * than squeezing the field: at 390 an inline button leaves ~120px for the
     * name somebody is typing, which is the control defeating itself.
     *
     * ⚠️ Nothing about what it CLAIMS changed. It still never prints
     * *Available* against a searched name, for the reason recorded in
     * DOMAIN-SEARCH-BACKEND-NOTE.md: nothing here reaches a registrar, and a
     * marketing page that tells somebody a name is free, takes their card and
     * then finds it is not has spent the only trust it had.
     */
    searchBar: {
      flexDirection: l.isPhone ? 'column' : 'row',
      alignItems: 'center',
      gap: l.isPhone ? 10 : 12,
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: l.isPhone ? 16 : 18,
      backgroundColor: t.surfaceRaised,
      padding: l.isPhone ? 10 : 8,
      ...(elevation(t, 3) as ViewStyle),
    },
    searchFieldRow: {
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
      width: l.isPhone ? '100%' : undefined,
      flexDirection: 'row',
      alignItems: 'center',
      gap: l.isPhone ? 10 : 14,
      paddingLeft: l.isPhone ? 6 : 14,
    },
    searchText: {
      ...type.h3,
      color: t.text,
      fontWeight: '700',
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
      paddingVertical: l.isPhone ? 10 : 12,
    },
    searchClear: { ...iconBox(36), borderRadius: 18 },
    searchGo: {
      flexShrink: 0,
      alignSelf: l.isPhone ? 'stretch' : 'auto',
      minHeight: l.isPhone ? 50 : 56,
      borderRadius: l.isPhone ? 12 : 13,
      backgroundColor: t.brand,
      paddingHorizontal: l.isPhone ? 20 : 30,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    searchGoText: { ...type.h4, color: t.textOnBrand, fontWeight: '800' },

    chipRow: {
      width: '100%',
      maxWidth: 860,
      alignSelf: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'center',
      rowGap: l.isPhone ? 7 : 9,
      columnGap: l.isPhone ? 7 : 9,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 38,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: l.isPhone ? 13 : 16,
      paddingVertical: 7,
    },
    chipOn: { backgroundColor: t.brand, borderColor: t.brand },
    chipMore: { gap: 7 },
    chipText: { ...type.caption, color: t.textMuted, fontWeight: '700' },
    chipTextOn: { color: t.textOnBrand },

    /*
     * ⚠️ **The mock draws no results and they are here anyway.** A search with
     * nowhere for answers to land is an illustration of a search box, which is
     * the exact defect this page was already fixed for once. They sit under
     * the chip row because the chips decide what the answers cover.
     */
    resultsPanel: {
      width: '100%',
      maxWidth: 980,
      alignSelf: 'center',
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: l.isPhone ? 12 : 16,
      paddingVertical: l.isPhone ? 10 : 12,
      ...(elevation(t, 1) as ViewStyle),
    },
    resultsLead: { ...type.caption, color: t.textSubtle, fontWeight: '700', paddingBottom: 4 },
    resultRow: {
      minHeight: 46,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 8,
    },
    resultRowRuled: { borderTopWidth: 1, borderColor: t.divider },
    resultDot: { ...iconBox(28), borderRadius: 14 },
    resultName: { ...type.bodySm, color: t.text, fontWeight: '700', flexGrow: 1, flexShrink: 1, minWidth: 110 },
    resultState: { ...type.caption, fontWeight: '800', flexShrink: 0 },
    resultPrice: { ...type.caption, color: t.textMuted, fontWeight: '700', flexShrink: 0, minWidth: 56, textAlign: 'right' },
    resultPriceNone: { color: t.textSubtle, fontWeight: '600', minWidth: 0 },
    resultMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 10,
      flexShrink: 0,
      marginLeft: 'auto',
    },
    claimGo: {
      flexShrink: 0,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: t.brand,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    claimGoText: { ...type.caption, color: t.brand, fontWeight: '800' },
    searchNote: { ...type.caption, color: t.textSubtle, paddingTop: 8 },

    /*
     * Five items, and the small-screen answer is a decided one: two columns on
     * a phone rather than a sideways scroller. A scrolling strip hides the
     * last two of five behind an edge with nothing announcing them, and these
     * five are the whole "what you get" argument of the hero.
     */
    featureRow: {
      width: '100%',
      maxWidth: 940,
      alignSelf: 'center',
      marginTop: l.isPhone ? 22 : 32,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'center',
      rowGap: l.isPhone ? 14 : 16,
      columnGap: l.isPhone ? 10 : 24,
    },
    featureItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minWidth: 0,
      flexGrow: 0,
      flexShrink: 1,
      flexBasis: l.isPhone ? '45%' : 'auto',
    },
    featureIcon: { ...iconBox(l.isPhone ? 34 : 38), borderRadius: 19, backgroundColor: softFill(t.brand, t) },
    featureText: { ...type.caption, color: t.text, fontWeight: '700', flexShrink: 1, minWidth: 0 },

    /* 🛑 The band whose claim the owner rewrote — see TRUST_HEAD above. */
    trustBand: { width: '100%', alignItems: 'center', marginTop: l.isPhone ? 24 : 32, gap: l.isPhone ? 12 : 14 },
    trustHead: { ...type.body, color: t.textMuted, fontWeight: '600', textAlign: 'center', maxWidth: 660 },
    trustTicks: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'center',
      rowGap: 10,
      columnGap: l.isPhone ? 14 : 26,
    },
    trustTick: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
    trustTickDot: { ...iconBox(18), borderRadius: 9, backgroundColor: t.green },
    trustTickText: { ...type.caption, color: t.text, fontWeight: '700', flexShrink: 1, minWidth: 0 },

    heroCtaRow: { marginTop: l.isPhone ? 22 : 30, alignSelf: l.isPhone ? 'stretch' : 'center' },

    /*
     * The white shelf that closes the hero. `bandEdge` is the exact inset
     * `Band` applies, so cancelling it reaches the viewport edge at every
     * width instead of at a guessed constant, and the negative bottom margin
     * eats the band's own bottom padding so the shelf sits on its rule.
     */
    heroStrip: {
      marginHorizontal: -bandEdge,
      marginTop: l.isPhone ? 30 : 44,
      marginBottom: -l.sectionSpace,
      paddingHorizontal: bandEdge,
      paddingVertical: l.isPhone ? 12 : 16,
      backgroundColor: t.surface,
      borderTopWidth: 1,
      borderColor: t.divider,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'center',
      rowGap: 4,
      zIndex: 1,
    },
    stripItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      minHeight: 44,
      minWidth: 0,
      flexGrow: 0,
      flexShrink: 1,
      flexBasis: l.isPhone ? '48%' : 'auto',
      paddingHorizontal: l.isPhone ? 6 : l.isDesktop ? 44 : 14,
    },
    stripItemRuled: { borderLeftWidth: 1, borderColor: t.divider },
    stripText: {
      ...(l.isDesktop ? type.bodySm : type.caption),
      color: t.text,
      fontWeight: '700',
      flexShrink: 1,
      minWidth: 0,
    },

    /* -------------------------------------------------- section heads */
    headCentered: { alignItems: 'center', gap: 12 },
    headTitleCentered: { textAlign: 'center', maxWidth: 720 },
    headBodyCentered: { textAlign: 'center', color: t.textMuted, maxWidth: 640 },
    headTitle: { marginTop: 12 },
    headBody: { marginTop: 12, color: t.textMuted, maxWidth: 560 },

    /* -------------------------------------------------- steps */
    stepGrid: gridBase,
    stepCell: cellBase(stepColumns),
    stepCard: cardBase,
    stepTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    stepIcon: iconBox(36),
    stepNumber: { ...type.micro, color: t.textSubtle, fontWeight: '800', letterSpacing: 1 },
    stepTitle: { ...type.caption, color: t.text, fontWeight: '800' },
    stepBody: { ...type.caption, color: t.textMuted },

    /* -------------------------------------------------- included */
    includeGrid: gridBase,
    includeCell: cellBase(includeColumns),
    includeCard: cardBase,
    includeIcon: iconBox(40),
    includeTitle: { ...type.caption, color: t.text, fontWeight: '800' },
    includeBody: { ...type.caption, color: t.textMuted },

    /* -------------------------------------------------- split */
    splitRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: stacked ? 'stretch' : 'center',
      gap: stacked ? 26 : 44,
    },
    splitCopy: stacked
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    splitVisual: stacked
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },

    /* -------------------------------------------------- dns mock */
    dnsCard: { ...panelBase, gap: 10 },
    dnsHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    dnsTitle: { ...type.caption, color: t.text, fontWeight: '800', flexGrow: 1, flexShrink: 1, minWidth: 0 },
    dnsPill: {
      ...type.micro,
      color: t.chipText,
      backgroundColor: t.chipBg,
      fontWeight: '700',
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 3,
      overflow: 'hidden',
    },
    dnsScroll: { minWidth: '100%' },
    // Scrolls below its minimum and grows above it, so the table never sits
    // narrow inside a wide card.
    dnsTable: { minWidth: 360, flexGrow: 1, flexShrink: 0, flexBasis: 'auto', gap: 6 },
    dnsHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingBottom: 2 },
    dnsHeadCell: {
      ...type.micro,
      color: t.textSubtle,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    dnsRow: rowBase,
    dnsType: { ...type.micro, color: accentText(t.brand, t), fontWeight: '800' },
    dnsCell: { ...type.micro, color: t.textMuted },
    dnsCellStrong: { ...type.micro, color: t.text, fontWeight: '700' },
    colType: { width: 62, flexGrow: 0, flexShrink: 0 },
    colHost: { width: 62, flexGrow: 0, flexShrink: 0 },
    colValue: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 120 },

    /* -------------------------------------------------- targets */
    targetGrid: gridBase,
    targetCell: cellBase(targetColumns),
    targetCard: cardBase,
    targetIcon: iconBox(38),
    targetTitle: { ...type.caption, color: t.text, fontWeight: '800' },
    targetBody: { ...type.caption, color: t.textMuted },
    targetSpacer: { flexGrow: 1, minHeight: 4 },

    /* -------------------------------------------------- pricing */
    priceWrap: { marginTop: l.isPhone ? 20 : 28, gap: 10 },
    priceCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 10 : 16,
      overflow: 'hidden',
      ...(elevation(t, 1) as ViewStyle),
    },
    priceScroll: { minWidth: '100%' },
    priceTable: { minWidth: 620, flexGrow: 1, flexShrink: 0, flexBasis: 'auto', gap: 6 },
    priceHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingBottom: 4 },
    priceHeadCell: {
      ...type.micro,
      color: t.textSubtle,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    priceRow: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 11,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    priceTld: { ...type.caption, color: t.text, fontWeight: '800' },
    priceValue: { ...type.caption, color: t.text, fontWeight: '700', textAlign: 'right' },
    priceRenew: { ...type.caption, color: t.textMuted, textAlign: 'right' },
    priceNote: { ...type.micro, color: t.textSubtle },
    colTld: { width: 132, flexGrow: 0, flexShrink: 0 },
    colNum: { width: 104, flexGrow: 0, flexShrink: 0 },
    colNote: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 150 },
    priceFootnote: { ...type.micro, color: t.textSubtle, textAlign: 'center', maxWidth: 620, alignSelf: 'center' },

    /* -------------------------------------------------- transfer */
    transferGrid: gridBase,
    transferCell: cellBase(transferColumns),
    transferCard: cardBase,
    transferIcon: { ...iconBox(38), backgroundColor: softFill(t.brand, t) },
    transferTitle: { ...type.caption, color: t.text, fontWeight: '800' },
    transferBody: { ...type.caption, color: t.textMuted },

    /* -------------------------------------------------- faq */
    faqGrid: gridBase,
    faqCell: cellBase(faqColumns),
    faqCard: { ...cardBase, gap: 8 },
    faqQ: { ...type.caption, color: t.text, fontWeight: '800' },
    faqA: { ...type.caption, color: t.textMuted },
  });
}
