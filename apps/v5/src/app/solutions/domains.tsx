import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Reveal } from '@/components/public/motion';
import { ROUTES } from '@/components/public/nav';
import { PageShell } from '@/components/public/page-shell';
import { breadcrumbJsonLd, faqJsonLd } from '@/components/public/seo';
import {
  ButtonRow,
  Heading,
  PrimaryButton,
  SecondaryButton,
  Section,
  SectionLabel,
  TextLink,
  useTypeScale,
  type TypeScale,
} from '@/components/public/ui';
import { contactHref, EXTERNAL } from '@/lib/destinations';
import { elevation, softFill, type ThemeTokens } from '@/theme/tokens';
import { cellBasis, useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';

/* ------------------------------------------------------------------ */
/* content                                                             */
/* ------------------------------------------------------------------ */

type Accent = 'brand' | 'violet' | 'orange' | 'green' | 'pink';

const PROOF = ['Privacy included', 'HTTPS included', 'No renewal surprises'];

/**
 * The hero search result. Prices are illustrative first-year figures — the
 * pricing table below is the one that carries the renewal column, because a
 * first-year price without its renewal is the oldest trick in this industry.
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

  const stateColor = (state: 'available' | 'taken' | 'premium') =>
    state === 'available' ? t.green : state === 'premium' ? t.orange : t.textSubtle;

  const stateLabel = (state: 'available' | 'taken' | 'premium') =>
    state === 'available' ? 'Available' : state === 'premium' ? 'Premium' : 'Taken';

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
      {/* ------------------------------------------------ hero */}
      <Section>
        <View style={styles.heroRow}>
          <Reveal style={styles.heroCopy} distance={16}>
            <SectionLabel>DOMAINS</SectionLabel>
            <Heading level={1} style={[type.display, styles.heroTitle]}>
              Get the name, and keep the whole thing in one place.
            </Heading>
            <Text style={[type.body, styles.heroBody]}>
              Search every extension, register in your own name, and point it at your site, your shop
              or anywhere else. Privacy, HTTPS and DNS are part of the price, not the upsell after it.
            </Text>
            <View style={styles.heroButtons}>
              <ButtonRow>
                <PrimaryButton
                  label="Find my domain"
                  size="lg"
                  full={l.isPhone}
                  icon="arrow-right"
                  iconRight
                  trackId="domains.hero.find-domain"
                  onPress={() => Linking.openURL(EXTERNAL.signup)}
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
            <View style={styles.proofRow}>
              {PROOF.map((item) => (
                <View key={item} style={styles.proofItem}>
                  <View style={styles.proofTick}>
                    <FontAwesome6 name="check" size={9} color={t.green} />
                  </View>
                  <Text numberOfLines={1} style={styles.proofText}>
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          </Reveal>

          {/* Illustration only — Views and Texts, never a control. */}
          <Reveal style={styles.heroVisual} distance={16} delay={90}>
            <View style={styles.searchCard}>
              <View style={styles.searchField}>
                <FontAwesome6 name="magnifying-glass" size={13} color={t.textSubtle} />
                <Text numberOfLines={1} style={styles.searchText}>
                  brightsmiledental
                </Text>
                <View style={styles.searchGo}>
                  <Text numberOfLines={1} style={styles.searchGoText}>
                    Search
                  </Text>
                </View>
              </View>
              {SEARCH_RESULTS.map((result) => (
                <View key={result.key} style={styles.resultRow}>
                  <View
                    style={[styles.resultDot, { backgroundColor: softFill(stateColor(result.state), t) }]}>
                    <FontAwesome6
                      name={result.state === 'taken' ? 'xmark' : 'check'}
                      size={9}
                      color={stateColor(result.state)}
                    />
                  </View>
                  <Text numberOfLines={1} style={styles.resultName}>
                    {result.name}
                  </Text>
                  <Text numberOfLines={1} style={[styles.resultState, { color: stateColor(result.state) }]}>
                    {stateLabel(result.state)}
                  </Text>
                  <Text numberOfLines={1} style={styles.resultPrice}>
                    {result.price}
                  </Text>
                </View>
              ))}
              <Text numberOfLines={2} style={styles.searchNote}>
                First-year prices. Renewal is shown before you buy.
              </Text>
            </View>

            <View style={styles.includedStrip}>
              {['WHOIS privacy', 'HTTPS', 'DNS', 'Email forwarding'].map((item) => (
                <View key={item} style={styles.includedChip}>
                  <FontAwesome6 name="check" size={9} color={t.green} />
                  <Text numberOfLines={1} style={styles.includedChipText}>
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          </Reveal>
        </View>
      </Section>

      {/* ------------------------------------------------ how it works */}
      <Section>
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
                    <FontAwesome6 name={step.icon as never} size={16} color={accentOf(step.accent)} />
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
      </Section>

      {/* ------------------------------------------------ included */}
      <Section>
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
                  <FontAwesome6 name={item.icon as never} size={17} color={accentOf(item.accent)} />
                </View>
                <Text style={styles.includeTitle}>{item.title}</Text>
                <Text style={styles.includeBody}>{item.body}</Text>
              </View>
            </Reveal>
          ))}
        </View>
      </Section>

      {/* ------------------------------------------------ connect */}
      <Section>
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
                  <FontAwesome6 name={target.icon as never} size={16} color={accentOf(target.accent)} />
                </View>
                <Text style={styles.targetTitle}>{target.title}</Text>
                <Text style={styles.targetBody}>{target.body}</Text>
                <View style={styles.targetSpacer} />
                <TextLink label="Learn more" onPress={() => router.push(target.href as never)} />
              </View>
            </Reveal>
          ))}
        </View>
      </Section>

      {/* ------------------------------------------------ pricing */}
      <Section>
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
      </Section>

      {/* ------------------------------------------------ transfer */}
      <Section>
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
                  <FontAwesome6 name={item.icon as never} size={16} color={t.brand} />
                </View>
                <Text style={styles.transferTitle}>{item.title}</Text>
                <Text style={styles.transferBody}>{item.body}</Text>
              </View>
            </Reveal>
          ))}
        </View>
      </Section>

      {/* ------------------------------------------------ faq */}
      <Section>
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
      </Section>
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/* styles                                                              */
/* ------------------------------------------------------------------ */

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
    heroRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: stacked ? 'stretch' : 'center',
      gap: stacked ? 26 : 40,
    },
    heroCopy: stacked
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 460, minWidth: 0 },
    heroTitle: { marginTop: 14 },
    heroBody: { marginTop: 14, maxWidth: 560 },
    heroButtons: { marginTop: 24 },
    proofRow: { marginTop: 22, flexDirection: 'row', flexWrap: 'wrap', gap: l.isPhone ? 10 : 18 },
    proofItem: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
    proofTick: { ...iconBox(20), borderRadius: 10, backgroundColor: softFill(t.green, t) },
    proofText: { ...type.caption, color: t.textMuted, fontWeight: '600', flexShrink: 1, minWidth: 0 },

    // Stacked, the visual has the whole row, so it takes it.
    heroVisual: stacked
      ? { width: '100%', minWidth: 0, gap: 12 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 440, minWidth: 0, gap: 12 },

    searchCard: { ...panelBase, gap: 8 },
    searchField: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingLeft: 13,
      paddingRight: 6,
      paddingVertical: 6,
      marginBottom: 2,
    },
    searchText: { ...type.caption, color: t.text, fontWeight: '700', flexGrow: 1, flexShrink: 1, minWidth: 0 },
    searchGo: { flexShrink: 0, borderRadius: 9, backgroundColor: t.brand, paddingHorizontal: 13, paddingVertical: 8 },
    searchGoText: { ...type.micro, color: t.textOnBrand, fontWeight: '800' },
    resultRow: rowBase,
    resultDot: { ...iconBox(22), borderRadius: 11 },
    resultName: { ...type.micro, color: t.text, fontWeight: '700', flexGrow: 1, flexShrink: 1, minWidth: 0 },
    resultState: { ...type.micro, fontWeight: '800', flexShrink: 0 },
    resultPrice: { ...type.micro, color: t.textMuted, fontWeight: '700', flexShrink: 0, minWidth: 46, textAlign: 'right' },
    searchNote: { ...type.micro, color: t.textSubtle, paddingTop: 2 },

    includedStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    includedChip: {
      flexGrow: 0,
      flexShrink: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 999,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 11,
      paddingVertical: 7,
    },
    includedChipText: { ...type.micro, color: t.textMuted, fontWeight: '600', flexShrink: 1, minWidth: 0 },

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
    dnsType: { ...type.micro, color: t.brand, fontWeight: '800' },
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
