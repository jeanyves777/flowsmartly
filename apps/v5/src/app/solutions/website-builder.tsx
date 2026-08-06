import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Linking, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Media } from '@/components/public/media';
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

const PROOF = ['Live in minutes', 'Edit without code', 'Your domain, your brand'];

/** The prompt shown in the hero, typed the way a real owner would type it. */
const PROMPT =
  'A family-run dental practice in Austin. Friendly, calm, not corporate. ' +
  'We do cleanings, whitening and implants, and we want people to book online.';

/** What the builder decided from that prompt — the answer, not the process. */
const DRAFT_PAGES: { key: string; label: string; note: string }[] = [
  { key: 'home', label: 'Home', note: 'Hero, services, reviews, booking' },
  { key: 'services', label: 'Services', note: 'Cleanings · Whitening · Implants' },
  { key: 'team', label: 'Our team', note: 'Three dentists, two hygienists' },
  { key: 'book', label: 'Book online', note: 'Form → Contacts → reminder' },
];

const STEPS: { key: string; step: string; icon: string; title: string; body: string; accent: Accent }[] = [
  {
    key: 'describe',
    step: '01',
    icon: 'comment-dots',
    title: 'Describe it',
    body: 'Say what the business does, who it is for, and how it should sound. Plain sentences, no brief template.',
    accent: 'brand',
  },
  {
    key: 'draft',
    step: '02',
    icon: 'wand-magic-sparkles',
    title: 'Get a draft',
    body: 'It chooses the pages, writes the copy and lays out every section with your details — not filler text.',
    accent: 'violet',
  },
  {
    key: 'refine',
    step: '03',
    icon: 'pen-ruler',
    title: 'Refine it',
    body: 'Ask for a change in a sentence, or open a block and edit it directly. Both edit the same site.',
    accent: 'orange',
  },
  {
    key: 'publish',
    step: '04',
    icon: 'rocket',
    title: 'Publish it',
    body: 'Connect a domain and go live. Hosting, HTTPS and daily backups are already on.',
    accent: 'green',
  },
];

/** Six, so the grid divides evenly at 1, 2 and 3 columns. */
const INCLUDED: { key: string; icon: string; title: string; body: string; accent: Accent }[] = [
  {
    key: 'pages',
    icon: 'table-cells-large',
    title: 'The pages this business needs',
    body: 'A dentist gets booking. A builder gets a project gallery. The page list comes from what you described.',
    accent: 'brand',
  },
  {
    key: 'copy',
    icon: 'pen-nib',
    title: 'Copy in your voice',
    body: 'Headlines and body text written from your description, with the claims you actually make.',
    accent: 'violet',
  },
  {
    key: 'mobile',
    icon: 'mobile-screen',
    title: 'Designed at phone width first',
    body: 'Every layout is laid out for a 390px screen before it is laid out for a desktop one.',
    accent: 'pink',
  },
  {
    key: 'forms',
    icon: 'inbox',
    title: 'Forms that reach you',
    body: 'An enquiry becomes a contact, and can start a follow-up sequence the moment it lands.',
    accent: 'orange',
  },
  {
    key: 'speed',
    icon: 'gauge-high',
    title: 'Fast, secure hosting',
    body: 'Global delivery, HTTPS, compressed images and daily backups from the first publish.',
    accent: 'green',
  },
  {
    key: 'found',
    icon: 'magnifying-glass',
    title: 'Legible to search and AI',
    body: 'Titles, descriptions, structured data, a sitemap and an answer-engine summary per page.',
    accent: 'brand',
  },
];

/** The block list in the editor mock. */
const BLOCKS: { key: string; icon: string; label: string; note: string; active?: boolean }[] = [
  { key: 'hero', icon: 'heading', label: 'Hero', note: 'Headline + booking button' },
  { key: 'services', icon: 'grip', label: 'Services', note: '3 cards', active: true },
  { key: 'reviews', icon: 'star', label: 'Reviews', note: 'Pulled from ListSmartly' },
  { key: 'team', icon: 'users', label: 'Team', note: '5 people' },
  { key: 'faq', icon: 'circle-question', label: 'FAQ', note: '6 questions' },
  { key: 'book', icon: 'calendar-check', label: 'Booking form', note: '→ Contacts' },
];

/** The two ways to make the same change. */
const EDIT_WAYS: { key: string; icon: string; title: string; body: string }[] = [
  {
    key: 'ask',
    icon: 'wand-magic-sparkles',
    title: 'Ask for it',
    body: '"Make the services section three columns and lead with whitening." It edits the blocks and shows you what changed.',
  },
  {
    key: 'edit',
    icon: 'arrow-pointer',
    title: 'Or edit it yourself',
    body: 'Click a block, change the words, swap the image, reorder it. No layout can break the grid.',
  },
];

/** What ships in the HTML, stated as outcomes rather than tags. */
const SEO_ROWS: { key: string; label: string; value: string }[] = [
  { key: 'title', label: 'Page title & description', value: 'Per page' },
  { key: 'schema', label: 'Structured data', value: 'LocalBusiness' },
  { key: 'sitemap', label: 'Sitemap & robots', value: 'Generated' },
  { key: 'og', label: 'Social preview card', value: 'Per page' },
  { key: 'speed', label: 'Core Web Vitals', value: 'Pass' },
  { key: 'llms', label: 'Answer-engine summary', value: 'Included' },
];

/** Four, so the row divides at 1, 2 and 4 columns. */
const CONNECTED: { key: string; icon: string; title: string; body: string; href: string; accent: Accent }[] = [
  {
    key: 'shop',
    icon: 'bag-shopping',
    title: 'Sell on it',
    body: 'Add FlowShop and the same site takes orders, with product data AI shopping agents can read.',
    href: ROUTES.flowshop,
    accent: 'brand',
  },
  {
    key: 'contacts',
    icon: 'address-book',
    title: 'Capture on it',
    body: 'Every form submission becomes a contact with the page and campaign that earned it.',
    href: ROUTES.emailSms,
    accent: 'violet',
  },
  {
    key: 'campaigns',
    icon: 'paper-plane',
    title: 'Follow up from it',
    body: 'A new enquiry can trigger an email, an SMS or a call-back without anyone remembering to.',
    href: ROUTES.emailSms,
    accent: 'orange',
  },
  {
    key: 'analytics',
    icon: 'chart-column',
    title: 'Measure it',
    body: 'See which page earned the revenue, not just which page got the traffic.',
    href: ROUTES.analytics,
    accent: 'green',
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Do I need to know how to code?',
    a: 'No. You describe the business in your own words and edit by clicking or by asking. There is no code to write, and nothing you can click will break the layout.',
  },
  {
    q: 'Can I use a domain I already own?',
    a: 'Yes. Connect a domain you own, or buy one inside FlowSmartly and it is attached and secured for you.',
  },
  {
    q: 'Can I change the design after it is built?',
    a: 'Any time. Colours, fonts, section order and copy are all editable after publishing, and every change is versioned so you can roll back.',
  },
  {
    q: 'Is hosting included?',
    a: 'Yes — global hosting, HTTPS, image optimisation and daily backups are part of the site. There is no separate host to buy or configure.',
  },
  {
    q: 'Will the site work on phones?',
    a: 'Every layout is designed at phone width first, then widened. The phone version is the real design, not a squeezed desktop one.',
  },
  {
    q: 'Can I sell products from it?',
    a: 'Yes. Adding FlowShop turns the same site into a storefront, sharing one product catalogue, one checkout and one set of analytics.',
  },
];

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function WebsiteBuilderPage() {
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
      title="Website Builder"
      description="Describe your business and get a complete, on-brand website — written, laid out, hosted and connected to the rest of FlowSmartly."
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Solutions', path: ROUTES.solutions },
          { name: 'Website Builder', path: ROUTES.websiteBuilder },
        ]),
        faqJsonLd(FAQ.map((item) => ({ question: item.q, answer: item.a }))),
      ]}>
      {/* ------------------------------------------------ hero */}
      <OpenSection>
        <View style={styles.heroRow}>
          <Reveal style={styles.heroCopy} distance={16}>
            <SectionLabel>WEBSITE BUILDER</SectionLabel>
            <Heading level={1} style={[type.display, styles.heroTitle]}>
              Describe your business. Get the website that sells it.
            </Heading>
            <Text style={[type.body, styles.heroBody]}>
              Write a few sentences about what you do. FlowSmartly writes the pages, lays out every
              section, connects the forms and puts it online — on your domain, in your voice.
            </Text>
            <View style={styles.heroButtons}>
              <ButtonRow>
                <PrimaryButton
                  label="Build my site free"
                  size="lg"
                  full={l.isPhone}
                  icon="arrow-right"
                  iconRight
                  trackId="website-builder.hero.build-free"
                  onPress={() => Linking.openURL(EXTERNAL.signup)}
                />
                <SecondaryButton
                  label="Talk to us first"
                  size="lg"
                  full={l.isPhone}
                  trackId="website-builder.hero.talk-first"
                  onPress={() => router.push(contactHref('demo') as never)}
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

          {/* Illustration only — every node here is a View or a Text, never a
              control, so nothing on the page looks clickable and isn't. */}
          <Reveal style={styles.heroVisual} distance={16} delay={90}>
            <View style={styles.promptCard}>
              <View style={styles.promptHead}>
                <FontAwesome6 name="wand-magic-sparkles" size={13} color={t.brand} />
                <Text numberOfLines={1} style={styles.promptHeadText}>
                  Describe your business
                </Text>
              </View>
              <View style={styles.promptBox}>
                <Text style={styles.promptText}>{PROMPT}</Text>
              </View>
              <View style={styles.promptFoot}>
                <View style={styles.promptCta}>
                  <Text numberOfLines={1} style={styles.promptCtaText}>
                    Build my site
                  </Text>
                </View>
                <Text numberOfLines={1} style={styles.promptFootNote}>
                  ~40 seconds
                </Text>
              </View>
            </View>

            <View style={styles.draftCard}>
              <View style={styles.draftHead}>
                <Text numberOfLines={1} style={styles.draftTitle}>
                  Draft site
                </Text>
                <Text numberOfLines={1} style={styles.draftPill}>
                  4 pages
                </Text>
              </View>
              {DRAFT_PAGES.map((page) => (
                <View key={page.key} style={styles.draftRow}>
                  <View style={styles.draftDot} />
                  <View style={styles.draftCopy}>
                    <Text numberOfLines={1} style={styles.draftLabel}>
                      {page.label}
                    </Text>
                    <Text numberOfLines={1} style={styles.draftNote}>
                      {page.note}
                    </Text>
                  </View>
                  <FontAwesome6 name="check" size={11} color={t.green} />
                </View>
              ))}
              <View style={styles.draftFoot}>
                <Text numberOfLines={1} style={styles.draftFootText}>
                  brightsmiledental.com · SSL active
                </Text>
              </View>
            </View>
          </Reveal>
        </View>
      </OpenSection>

      {/* ------------------------------------------------ how it works */}
      <Band tone="surface">
        <View style={styles.headCentered}>
          <SectionLabel>FROM PROMPT TO PUBLISHED</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitleCentered]}>
            Four steps, and none of them are &ldquo;pick a template&rdquo;.
          </Heading>
          <Text style={[type.body, styles.headBodyCentered]}>
            A template makes you fit the business to the design. This starts from the business.
          </Text>
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
      </Band>

      {/* ------------------------------------------------ what ships */}
      <Band tone="violet">
        <View style={styles.headCentered}>
          <SectionLabel>IN EVERY SITE</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitleCentered]}>
            The parts most site builders leave to you.
          </Heading>
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
      </Band>

      {/* ------------------------------------------------ editing */}
      <OpenSection>
        <View style={styles.splitRow}>
          <Reveal style={styles.splitCopy} distance={16}>
            <SectionLabel>EDITING</SectionLabel>
            <Heading level={2} style={[type.h2, styles.headTitle]}>
              Change it by asking, or by clicking.
            </Heading>
            <Text style={[type.body, styles.headBody]}>
              Both routes edit the same site, so you never have to choose one and lose the other.
            </Text>

            <View style={styles.wayList}>
              {EDIT_WAYS.map((way) => (
                <View key={way.key} style={styles.wayRow}>
                  <View style={styles.wayIcon}>
                    <FontAwesome6 name={way.icon as never} size={14} color={t.brand} />
                  </View>
                  <View style={styles.wayCopy}>
                    <Text style={styles.wayTitle}>{way.title}</Text>
                    <Text style={styles.wayBody}>{way.body}</Text>
                  </View>
                </View>
              ))}
            </View>

            <TextLink
              label="See the AI Studio behind it"
              onPress={() => router.push(ROUTES.aiStudio as never)}
            />
          </Reveal>

          <Reveal style={styles.splitVisual} distance={16} delay={90}>
            <View style={styles.editorCard}>
              <View style={styles.editorHead}>
                <Text numberOfLines={1} style={styles.editorTitle}>
                  Home
                </Text>
                <Text numberOfLines={1} style={styles.editorPill}>
                  Editing
                </Text>
              </View>
              {BLOCKS.map((block) => (
                <View
                  key={block.key}
                  style={[styles.blockRow, block.active ? styles.blockRowActive : null]}>
                  <FontAwesome6
                    name={block.icon as never}
                    size={12}
                    color={block.active ? t.brand : t.textSubtle}
                  />
                  <Text numberOfLines={1} style={styles.blockLabel}>
                    {block.label}
                  </Text>
                  <Text numberOfLines={1} style={styles.blockNote}>
                    {block.note}
                  </Text>
                </View>
              ))}
              <View style={styles.editorAsk}>
                <FontAwesome6 name="wand-magic-sparkles" size={12} color={t.brand} />
                <Text numberOfLines={1} style={styles.editorAskText}>
                  Make services three columns
                </Text>
              </View>
            </View>
          </Reveal>
        </View>
      </OpenSection>

      {/* ------------------------------------------------ found */}
      <Band tone="surface">
        <View style={styles.splitRowReverse}>
          <Reveal style={styles.splitVisual} distance={16}>
            <View style={styles.seoCard}>
              <View style={styles.seoHead}>
                <FontAwesome6 name="magnifying-glass" size={13} color={t.brand} />
                <Text numberOfLines={1} style={styles.seoHeadText}>
                  Generated for every page
                </Text>
              </View>
              {SEO_ROWS.map((row) => (
                <View key={row.key} style={styles.seoRow}>
                  <Text numberOfLines={1} style={styles.seoLabel}>
                    {row.label}
                  </Text>
                  <Text numberOfLines={1} style={styles.seoValue}>
                    {row.value}
                  </Text>
                </View>
              ))}
            </View>
          </Reveal>

          <Reveal style={styles.splitCopy} distance={16} delay={90}>
            <SectionLabel>BEING FOUND</SectionLabel>
            <Heading level={2} style={[type.h2, styles.headTitle]}>
              Written to be read by people, and by machines.
            </Heading>
            <Text style={[type.body, styles.headBody]}>
              A site that no one can find is a brochure. Every page ships with the titles, descriptions
              and structured data that search engines expect, plus the plain-language summary that
              answer engines read when someone asks about a business like yours.
            </Text>
            <TextLink
              label="See how local visibility works"
              onPress={() => router.push(ROUTES.listsmartly as never)}
            />
          </Reveal>
        </View>
      </Band>

      {/* ------------------------------------------------ connected */}
      <Band tone="violet">
        <View style={styles.headCentered}>
          <SectionLabel>CONNECTED</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitleCentered]}>
            A site that is part of the business, not beside it.
          </Heading>
          <Text style={[type.body, styles.headBodyCentered]}>
            The website most small businesses have is disconnected from everything that happens after
            someone visits it. This one is not.
          </Text>
        </View>

        <View style={styles.connectGrid}>
          {CONNECTED.map((item, index) => (
            <Reveal key={item.key} style={styles.connectCell} distance={14} delay={index * 60}>
              <View style={styles.connectCard}>
                <View style={[styles.connectIcon, { backgroundColor: softFill(accentOf(item.accent), t) }]}>
                  <FontAwesome6 name={item.icon as never} size={16} color={accentOf(item.accent)} />
                </View>
                <Text style={styles.connectTitle}>{item.title}</Text>
                <Text style={styles.connectBody}>{item.body}</Text>
                <View style={styles.connectSpacer} />
                <TextLink label="Learn more" onPress={() => router.push(item.href as never)} />
              </View>
            </Reveal>
          ))}
        </View>
      </Band>

      {/* ------------------------------------------------ domain */}
      <OpenSection>
        <Reveal style={styles.domainBand} distance={14}>
          <View style={styles.domainCopy}>
            <SectionLabel>YOUR ADDRESS</SectionLabel>
            <Heading level={2} style={[type.h3, styles.domainTitle]}>
              A site needs a name. Get that here too.
            </Heading>
            <Text style={[type.body, styles.domainBody]}>
              Search, buy and attach a domain without leaving FlowSmartly — DNS, HTTPS and renewals
              handled for you. Already own one? Connect it in a couple of minutes.
            </Text>
            <TextLink
              label="Domains and registration"
              onPress={() => router.push(ROUTES.domains as never)}
            />
          </View>
          <View style={styles.domainVisual}>
            <View style={styles.domainField}>
              <FontAwesome6 name="globe" size={13} color={t.textSubtle} />
              <Text numberOfLines={1} style={styles.domainFieldText}>
                brightsmiledental
              </Text>
            </View>
            <View style={styles.domainResultRow}>
              <Text numberOfLines={1} style={styles.domainResultName}>
                brightsmiledental.com
              </Text>
              <Text numberOfLines={1} style={styles.domainResultOk}>
                Available
              </Text>
            </View>
            <View style={styles.domainResultRow}>
              <Text numberOfLines={1} style={styles.domainResultName}>
                brightsmile.dental
              </Text>
              <Text numberOfLines={1} style={styles.domainResultOk}>
                Available
              </Text>
            </View>
          </View>
        </Reveal>
      </OpenSection>

      {/* ------------------------------------------------ faq */}
      <Band tone="surface">
        <View style={styles.headCentered}>
          <SectionLabel>QUESTIONS</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitleCentered]}>
            Before you start.
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
      </Band>

      {/* ------------------------------------------------ testimonial */}
      <Band tone="violet">
        <View style={styles.quoteRow}>
          <Media
            name="people/maya-chen"
            alt="Maya Chen, owner of Fern &amp; Vine"
            style={styles.quoteAvatar}
            radius={l.isPhone ? 34 : 44}
          />
          <View style={styles.quoteCopy}>
            <FontAwesome6 name="quote-left" size={18} color={t.brand} />
            <Text style={[type.h3, styles.quoteText]}>
              I had put off the website for two years because I did not know where to start. I wrote
              four sentences about the shop and had something I was proud of the same afternoon.
            </Text>
            <Text numberOfLines={2} style={styles.quoteAttribution}>
              Maya Chen • Owner, Fern &amp; Vine
            </Text>
          </View>
        </View>
      </Band>
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

  // Every count below divides its item count at every breakpoint, so no row
  // ever ends with a stretched orphan.
  const stepColumns = columns(1, 2, 4, 4);
  const includeColumns = columns(1, 2, 3, 3);
  const connectColumns = columns(1, 2, 4, 4);
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
    gap: 12,
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

    // Once the hero stacks, the visual owns the whole row — so it fills it
    // rather than keeping the width it needed beside the copy.
    heroVisual: stacked
      ? {
          width: '100%',
          minWidth: 0,
          flexDirection: l.isPhone ? 'column' : 'row',
          alignItems: l.isPhone ? 'stretch' : 'flex-start',
          gap: 14,
        }
      : {
          flexGrow: 1,
          flexShrink: 1,
          flexBasis: 420,
          minWidth: 0,
          gap: 14,
        },

    promptCard: {
      ...panelBase,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: stacked && !l.isPhone ? 0 : 'auto',
      minWidth: 0,
      gap: 10,
    },
    promptHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    promptHeadText: { ...type.caption, color: t.text, fontWeight: '800', flexShrink: 1, minWidth: 0 },
    promptBox: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      padding: 12,
    },
    promptText: { ...type.caption, color: t.textMuted, lineHeight: 21 },
    promptFoot: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    promptCta: {
      flexGrow: 0,
      flexShrink: 1,
      minWidth: 0,
      borderRadius: 10,
      backgroundColor: t.brand,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    promptCtaText: { ...type.micro, color: t.textOnBrand, fontWeight: '800' },
    promptFootNote: { ...type.micro, color: t.textSubtle, flexShrink: 1, minWidth: 0 },

    draftCard: {
      ...panelBase,
      backgroundColor: t.surface,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: stacked && !l.isPhone ? 0 : 'auto',
      minWidth: 0,
      gap: 8,
    },
    draftHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    draftTitle: { ...type.caption, color: t.text, fontWeight: '800', flexGrow: 1, flexShrink: 1, minWidth: 0 },
    draftPill: {
      ...type.micro,
      color: t.chipText,
      backgroundColor: t.chipBg,
      fontWeight: '700',
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 3,
      overflow: 'hidden',
    },
    draftRow: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 11,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 11,
      paddingVertical: 8,
    },
    draftDot: { ...iconBox(8), borderRadius: 4, backgroundColor: t.brand },
    draftCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    draftLabel: { ...type.micro, color: t.text, fontWeight: '700' },
    draftNote: { ...type.micro, color: t.textSubtle },
    draftFoot: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 2 },
    draftFootText: { ...type.micro, color: t.textSubtle, flexShrink: 1, minWidth: 0 },

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

    /* -------------------------------------------------- splits */
    splitRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: stacked ? 'stretch' : 'center',
      gap: stacked ? 26 : 44,
    },
    splitRowReverse: {
      flexDirection: stacked ? 'column-reverse' : 'row',
      alignItems: stacked ? 'stretch' : 'center',
      gap: stacked ? 26 : 44,
    },
    splitCopy: stacked
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    splitVisual: stacked
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },

    wayList: { marginTop: 22, gap: 14 },
    wayRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    wayIcon: { ...iconBox(32), backgroundColor: softFill(t.brand, t) },
    wayCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 4 },
    wayTitle: { ...type.caption, color: t.text, fontWeight: '800' },
    wayBody: { ...type.caption, color: t.textMuted },

    /* -------------------------------------------------- editor mock */
    editorCard: { ...panelBase, gap: 7 },
    editorHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
    editorTitle: { ...type.caption, color: t.text, fontWeight: '800', flexGrow: 1, flexShrink: 1, minWidth: 0 },
    editorPill: {
      ...type.micro,
      color: t.chipText,
      backgroundColor: t.chipBg,
      fontWeight: '700',
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 3,
      overflow: 'hidden',
    },
    blockRow: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 11,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 11,
      paddingVertical: 8,
    },
    blockRowActive: { borderColor: t.brand, backgroundColor: softFill(t.brand, t) },
    blockLabel: { ...type.micro, color: t.text, fontWeight: '700', flexGrow: 1, flexShrink: 1, minWidth: 0 },
    blockNote: { ...type.micro, color: t.textSubtle, flexShrink: 1, minWidth: 0 },
    editorAsk: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      marginTop: 4,
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 11,
      backgroundColor: t.surfaceInset,
      paddingHorizontal: 11,
      paddingVertical: 10,
    },
    editorAskText: { ...type.micro, color: t.textMuted, flexShrink: 1, minWidth: 0 },

    /* -------------------------------------------------- seo mock */
    seoCard: { ...panelBase, gap: 8 },
    seoHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
    seoHeadText: { ...type.caption, color: t.text, fontWeight: '800', flexShrink: 1, minWidth: 0 },
    seoRow: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 11,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    seoLabel: { ...type.micro, color: t.text, fontWeight: '600', flexGrow: 1, flexShrink: 1, minWidth: 0 },
    seoValue: { ...type.micro, color: t.green, fontWeight: '800', flexShrink: 0 },

    /* -------------------------------------------------- connected */
    connectGrid: gridBase,
    connectCell: cellBase(connectColumns),
    connectCard: cardBase,
    connectIcon: iconBox(38),
    connectTitle: { ...type.caption, color: t.text, fontWeight: '800' },
    connectBody: { ...type.caption, color: t.textMuted },
    // Pushes every card's link onto one baseline whatever the copy length.
    connectSpacer: { flexGrow: 1, minHeight: 4 },

    /* -------------------------------------------------- domain band */
    domainBand: {
      flexDirection: l.isPhone ? 'column' : 'row',
      alignItems: l.isPhone ? 'stretch' : 'center',
      gap: l.isPhone ? 18 : 32,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 20,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 18 : 26,
      ...(elevation(t, 1) as ViewStyle),
    },
    domainCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 10 },
    domainTitle: { marginTop: 4 },
    domainBody: { color: t.textMuted, maxWidth: 520 },
    domainVisual: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: l.isPhone ? 'auto' : 0,
      minWidth: 0,
      gap: 8,
    },
    domainField: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 13,
      paddingVertical: 12,
    },
    domainFieldText: { ...type.caption, color: t.text, fontWeight: '700', flexShrink: 1, minWidth: 0 },
    domainResultRow: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 11,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    domainResultName: { ...type.micro, color: t.text, fontWeight: '600', flexGrow: 1, flexShrink: 1, minWidth: 0 },
    domainResultOk: { ...type.micro, color: t.green, fontWeight: '800', flexShrink: 0 },

    /* -------------------------------------------------- faq */
    faqGrid: gridBase,
    faqCell: cellBase(faqColumns),
    faqCard: { ...cardBase, gap: 8 },
    faqQ: { ...type.caption, color: t.text, fontWeight: '800' },
    faqA: { ...type.caption, color: t.textMuted },

    /* -------------------------------------------------- quote */
    quoteRow: {
      flexDirection: l.isPhone ? 'column' : 'row',
      alignItems: l.isPhone ? 'flex-start' : 'center',
      gap: l.isPhone ? 16 : 26,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 20,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 18 : 28,
    },
    quoteAvatar: { width: l.isPhone ? 68 : 88, height: l.isPhone ? 68 : 88, flexGrow: 0, flexShrink: 0 },
    quoteCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 12 },
    quoteText: { color: t.text },
    quoteAttribution: { ...type.caption, color: t.textMuted, fontWeight: '600' },
  });
}
