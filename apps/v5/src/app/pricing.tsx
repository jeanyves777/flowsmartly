import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { trackCta } from '@/lib/analytics';
import { Reveal } from '@/components/public/motion';
import { ROUTES } from '@/components/public/nav';
import { PageShell } from '@/components/public/page-shell';
import { breadcrumbJsonLd, faqJsonLd } from '@/components/public/seo';
import {
  Heading,
  PrimaryButton,
  Band,
  OpenSection,
  SectionAside,
  SectionLabel,
  useTypeScale,
  type TypeScale,
} from '@/components/public/ui';
import { contactHref, goToEarlyAccess } from '@/lib/destinations';
import { elevation, hexToRgba, softFill, type ThemeTokens } from '@/theme/tokens';
import { BP, useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';
import PRICING_FAQ from '@/content/pricing-faq.json';

/* ------------------------------------------------------------------ */
/* content                                                             */
/* ------------------------------------------------------------------ */

type Accent = 'brand' | 'violet' | 'orange' | 'green';

type Plan = {
  id: string;
  name: string;
  icon: string;
  accent: Accent;
  /** monthly list price in whole dollars; 0 = free */
  price: number;
  credits: string;
  blurb: string;
  features: string[];
  badge?: string;
  featured?: boolean;
};

const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    icon: 'rocket',
    accent: 'brand',
    price: 0,
    credits: '500 credits monthly',
    blurb: 'Everything you need to publish consistently and see what is working.',
    features: [
      'AI Studio essentials',
      '2 social channels',
      '500 emails a month',
      'Essential analytics',
      'Community support',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    icon: 'bolt',
    accent: 'violet',
    price: 20,
    credits: '1,500 credits monthly',
    blurb: 'For teams running real campaigns across more than one channel.',
    features: [
      'Everything in Starter',
      'Advanced AI Studio',
      '8 social channels with scheduling',
      '10,000 emails a month',
      'Ads, FlowShop and SMS unlocked',
      'Email support',
    ],
    badge: 'Most popular',
    featured: true,
  },
  {
    id: 'business',
    name: 'Business',
    icon: 'building',
    accent: 'orange',
    price: 50,
    credits: '4,000 credits monthly',
    blurb: 'For multi-location businesses that need seats, scale and priority help.',
    features: [
      'Everything in Pro',
      'Unlimited social channels',
      '50,000 emails a month',
      'ListSmartly for 25 locations',
      '10 seats with team permissions',
      'Priority support',
    ],
  },
];

type CellValue = string | boolean;

const COMPARE: { label: string; values: [CellValue, CellValue, CellValue] }[] = [
  { label: 'AI Studio', values: ['Essentials', 'Advanced', 'Advanced'] },
  { label: 'Social', values: ['2 channels', '8 channels', 'Unlimited'] },
  { label: 'Email', values: ['500 / mo', '10,000 / mo', '50,000 / mo'] },
  { label: 'SMS/MMS', values: [false, true, true] },
  { label: 'Ads', values: [false, true, true] },
  { label: 'Analytics', values: ['Essential', 'Full', 'Full + exports'] },
  { label: 'FlowShop', values: [false, true, true] },
  { label: 'ListSmartly', values: [false, '5 locations', '25 locations'] },
  { label: 'Call Agent', values: [false, 'Usage-based', 'Usage-based'] },
  { label: 'Team permissions', values: ['1 seat', '3 seats', '10 seats'] },
  { label: 'Support', values: ['Community', 'Email', 'Priority'] },
  { label: 'Credits monthly', values: ['500', '1,500', '4,000'] },
];

const USAGE: { icon: string; title: string; rate: string; note: string; accent: Accent }[] = [
  {
    icon: 'phone-volume',
    title: 'Call Agent',
    rate: '15¢/min',
    note: 'Charged per connected minute — never for a call that does not answer.',
    accent: 'brand',
  },
  {
    icon: 'image',
    title: 'Image generation',
    rate: '2¢/image',
    note: 'Every render counts once, including the variations you keep.',
    accent: 'violet',
  },
  {
    icon: 'film',
    title: 'Video generation',
    rate: '8¢/sec',
    note: 'Billed on the finished duration, not on drafts you discard.',
    accent: 'orange',
  },
  {
    icon: 'comment-dots',
    title: 'SMS/MMS delivery',
    rate: '1.0¢/msg',
    note: 'Carrier pass-through per segment, shown before you send.',
    accent: 'green',
  },
];

const BALANCE: { label: string; icon: string; used: number; accent: Accent }[] = [
  { label: 'AI Studio', icon: 'wand-magic-sparkles', used: 120, accent: 'brand' },
  { label: 'Email', icon: 'envelope', used: 80, accent: 'violet' },
  { label: 'SMS', icon: 'comment-dots', used: 50, accent: 'orange' },
];

/**
 * One source for the pricing questions.
 *
 * They are also marked up as `FAQPage` structured data, and Google requires
 * that markup to match what a visitor actually reads — so the questions live
 * in a JSON file the page renders and the build script reads, rather than in
 * two copies that drift apart. (The markup cannot be emitted from here:
 * expo-router's <Head> drops <script> children, so it is injected after the
 * export, in scripts/agent-assets.js.)
 */
const FAQ: { q: string; a: string }[] = PRICING_FAQ;

const REASSURANCE: { icon: string; label: string }[] = [
  { icon: 'circle-xmark', label: 'Cancel anytime' },
  { icon: 'arrow-up-right-dots', label: 'Upgrade anytime' },
  { icon: 'tag', label: 'No hidden platform fee' },
  { icon: 'lock', label: 'Secure payments' },
];

/* ------------------------------------------------------------------ */
/* pieces                                                              */
/* ------------------------------------------------------------------ */

type Styles = ReturnType<typeof createStyles>;

function CompareCell({
  value,
  styles,
  t,
}: {
  value: CellValue;
  styles: Styles;
  t: ThemeTokens;
}) {
  if (value === true) {
    return (
      <View style={styles.compareCell}>
        <View style={styles.compareTick}>
          <FontAwesome6 name="check" size={11} color={t.successText} />
        </View>
      </View>
    );
  }
  if (value === false) {
    return (
      <View style={styles.compareCell}>
        <View style={styles.compareDash} />
      </View>
    );
  }
  return (
    <View style={styles.compareCell}>
      <Text numberOfLines={2} style={styles.compareValue}>
        {value}
      </Text>
    </View>
  );
}

function FaqRow({
  item,
  open,
  onToggle,
  styles,
  t,
}: {
  item: { q: string; a: string };
  open: boolean;
  onToggle: () => void;
  styles: Styles;
  t: ThemeTokens;
}) {
  return (
    <View style={styles.faqItem}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.q}
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        style={({ pressed }) => [styles.faqHead, pressed ? styles.faqHeadPressed : null]}>
        <Text style={styles.faqQuestion}>{item.q}</Text>
        <View style={styles.faqChevron}>
          <FontAwesome6
            name={open ? 'chevron-up' : 'chevron-down'}
            size={12}
            color={open ? t.brand : t.textSubtle}
          />
        </View>
      </Pressable>
      {open ? (
        <View style={styles.faqBody}>
          <Text style={styles.faqAnswer}>{item.a}</Text>
        </View>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function PricingPage() {
  const router = useRouter();
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  const styles = useMemo(() => createStyles(t, l, type), [t, l, type]);

  const [annual, setAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState<string | null>(FAQ[0].q);

  const accentOf = (accent: Accent) =>
    accent === 'violet'
      ? t.violet
      : accent === 'orange'
        ? t.orange
        : accent === 'green'
          ? t.green
          : t.brand;

  const maxUsed = Math.max(...BALANCE.map((row) => row.used));

  return (
    <PageShell
      title="Pricing"
      description="One agentic system, one credit balance. Simple plans and usage-based pricing you can see before you spend — you pay for work done, not for seats."
      // Only the six questions the accordion actually shows, with the answer
      // text as written — a rich result must never promise copy the page does
      // not contain.
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Pricing', path: ROUTES.pricing },
        ]),
        faqJsonLd(FAQ.map((item) => ({ question: item.q, answer: item.a }))),
      ]}>
      {/* ------------------------------------------------ hero + toggle */}
      <OpenSection>
        <Reveal style={styles.hero} distance={16}>
          <SectionLabel>SIMPLE, FLEXIBLE PRICING</SectionLabel>
          <Heading level={1} style={[type.display, styles.heroTitle]}>
            Start lean. Scale when growth demands it.
          </Heading>
          <Text style={[type.body, styles.heroBody]}>
            One plan covers the whole system — every capability group, the agents that operate them,
            and the governance around both. You pay for the work that gets done and for the usage it
            consumes, never for the platform thinking about it.
          </Text>

          <View style={styles.toggleWrap}>
            <View style={styles.toggle}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: !annual }}
                accessibilityLabel="Monthly billing"
                onPress={() => setAnnual(false)}
                style={[styles.toggleOption, annual ? null : styles.toggleOptionOn]}>
                <Text style={[styles.toggleLabel, annual ? null : styles.toggleLabelOn]}>Monthly</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: annual }}
                accessibilityLabel="Annual billing, save 20 percent"
                onPress={() => setAnnual(true)}
                style={[styles.toggleOption, annual ? styles.toggleOptionOn : null]}>
                <Text style={[styles.toggleLabel, annual ? styles.toggleLabelOn : null]}>Annual</Text>
                <View style={styles.saveChip}>
                  <Text style={styles.saveChipText}>Save 20%</Text>
                </View>
              </Pressable>
            </View>
          </View>
        </Reveal>

        {/* ------------------------------------------------ plans */}
        <View style={styles.planGrid}>
          {PLANS.map((plan, index) => {
            const accent = accentOf(plan.accent);
            const monthly = annual ? Math.round(plan.price * 0.8) : plan.price;
            const saving = plan.price === 0 ? 0 : plan.price * 12 - Math.round(plan.price * 0.8) * 12;
            return (
              <Reveal key={plan.id} style={styles.planCell} distance={16} delay={index * 80}>
                <View style={[styles.planCard, plan.featured ? styles.planCardFeatured : null]}>
                  {plan.badge ? (
                    <View style={[styles.planBadge, { backgroundColor: accent }]}>
                      <Text style={styles.planBadgeText}>{plan.badge}</Text>
                    </View>
                  ) : null}

                  <View style={[styles.planIcon, { backgroundColor: softFill(accent, t) }]}>
                    <FontAwesome6 name={plan.icon as never} size={19} color={accent} />
                  </View>

                  <Text style={[type.h3, styles.planName]}>{plan.name}</Text>
                  <Text style={styles.planBlurb}>{plan.blurb}</Text>

                  <View style={styles.priceRow}>
                    <Text style={[type.display, styles.priceValue]}>
                      {plan.price === 0 ? 'Free' : `$${monthly}`}
                    </Text>
                    {plan.price === 0 ? null : <Text style={styles.pricePeriod}>/mo</Text>}
                  </View>
                  <Text style={styles.priceNote}>
                    {plan.price === 0
                      ? 'Free forever — no card required'
                      : annual
                        ? `Billed annually — you keep $${saving} a year`
                        : 'Billed monthly — cancel anytime'}
                  </Text>

                  <View style={[styles.creditsLine, { borderColor: hexToRgba(accent, 0.35) }]}>
                    <FontAwesome6 name="coins" size={12} color={accent} />
                    <Text style={[styles.creditsText, { color: accent }]}>{plan.credits}</Text>
                  </View>

                  <View style={styles.featureList}>
                    {plan.features.map((feature) => (
                      <View key={feature} style={styles.featureRow}>
                        <View style={[styles.featureTick, { backgroundColor: softFill(accent, t) }]}>
                          <FontAwesome6 name="check" size={9} color={accent} />
                        </View>
                        <Text style={styles.featureText}>{feature}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.planSpacer} />

                  {/* No plan can be bought yet: every one of these lands on
                      the early-access form, so every one says so. The plan is
                      still named by the card it sits in. */}
                  {plan.featured ? (
                    <PrimaryButton
                      label="Join early access"
                      full
                      trackId={`pricing.plan.${plan.id}`}
                      onPress={() => goToEarlyAccess()}
                    />
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Join early access"
                      onPress={() => {
                        trackCta(`pricing.plan.${plan.id}`, { variant: 'plan' });
                        goToEarlyAccess();
                      }}
                      style={({ pressed }) => [
                        styles.planButton,
                        pressed ? styles.planButtonPressed : null,
                      ]}>
                      <Text style={styles.planButtonLabel}>Join early access</Text>
                    </Pressable>
                  )}
                </View>
              </Reveal>
            );
          })}
        </View>
      </OpenSection>

      {/* ------------------------------------- custom automation
          A fourth way to buy, deliberately not a fourth plan card: it is not
          self-serve, it has no monthly price, and putting it in the grid would
          invite a comparison of features against a project scope. */}
      <OpenSection art="none">
        <Reveal distance={14}>
          <View style={styles.customCard}>
            <View style={styles.customCopy}>
              <Text style={styles.customEyebrow}>CUSTOM AI AUTOMATION</Text>
              <Heading level={2} style={styles.customTitle}>
                Need something built around your business?
              </Heading>
              <Text style={styles.customBody}>
                Custom automation projects are scoped around your workflows, integrations and
                implementation needs. We work with you one-to-one to design and build FlowAgent
                skills specifically for your operation.
              </Text>
            </View>

            <View style={styles.customAside}>
              <Text style={styles.customPrice}>Custom</Text>
              <Text style={styles.customPriceNote}>Scoped per project, not per month</Text>
              <View style={styles.customButtons}>
                <PrimaryButton
                  label="Request a custom demo"
                  full
                  trackId="pricing.custom.demo"
                  onPress={() => router.push(contactHref('custom-automation') as never)}
                />
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel="How custom automation works"
                  onPress={() => {
                    trackCta('pricing.custom.learn', { variant: 'plan' });
                    router.push(ROUTES.customAutomation as never);
                  }}
                  style={({ pressed }) => [
                    styles.planButton,
                    pressed ? styles.planButtonPressed : null,
                  ]}>
                  <Text style={styles.planButtonLabel}>How it works</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Reveal>
      </OpenSection>

      {/* ------------------------------------------------ credits */}
      <OpenSection aside={{ variant: 'chart', color: t.brand, side: 'left', at: 'bottom', height: 220 }}>
        <View style={styles.creditsRow}>
          <Reveal style={styles.creditsPanel} distance={16}>
            <View style={styles.balanceCard}>
              <View style={styles.balanceHead}>
                <Text style={styles.balanceTitle}>This month</Text>
                <Text style={styles.balanceSub}>Credits used by surface</Text>
              </View>
              <View style={styles.balanceList}>
                {BALANCE.map((row) => {
                  const accent = accentOf(row.accent);
                  const width: DimensionValue = `${Math.round((row.used / maxUsed) * 100)}%`;
                  return (
                    <View key={row.label} style={styles.balanceRow}>
                      <View style={[styles.balanceIcon, { backgroundColor: softFill(accent, t) }]}>
                        <FontAwesome6 name={row.icon as never} size={12} color={accent} />
                      </View>
                      <View style={styles.balanceCopy}>
                        <View style={styles.balanceLabelRow}>
                          <Text style={styles.balanceLabel}>{row.label}</Text>
                          <Text style={styles.balanceValue}>{row.used}</Text>
                        </View>
                        <View style={styles.balanceTrack}>
                          <View
                            style={[styles.balanceFill, { width, backgroundColor: accent }]}
                          />
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
              <View style={styles.balanceTotal}>
                <Text style={styles.balanceTotalLabel}>Your balance</Text>
                <Text style={styles.balanceTotalValue}>1,500 credits</Text>
              </View>
            </View>
          </Reveal>

          <Reveal style={styles.creditsCopy} distance={16} delay={80}>
            <SectionLabel>HOW CREDITS WORK</SectionLabel>
            <Heading level={2} style={[type.h2, styles.creditsTitle]}>
              One balance across your creative workspace.
            </Heading>
            <Text style={[type.body, styles.creditsBody]}>
              There is no separate wallet for images, another for video and a third for messaging.
              Your plan tops up one balance each month, every surface draws from it, and each action
              shows what it will cost before it runs.
            </Text>
            <Text style={[type.body, styles.creditsBody]}>
              Run out mid-month? Top up in seconds and keep the same balance. Bought credits never
              expire, and they are only spent once your monthly allowance is gone.
            </Text>

            {/* The part of the model that is easy to get wrong and expensive to
                discover later, so it is stated rather than left to the FAQ. */}
            <View style={styles.notBilled}>
              <View style={styles.notBilledIcon}>
                <FontAwesome6 name="circle-check" size={14} color={t.green} />
              </View>
              <View style={styles.notBilledCopy}>
                <Text style={styles.notBilledTitle}>What you are not billed for</Text>
                <Text style={styles.notBilledBody}>
                  FlowAgent thinking. Reading your data, planning the work, checking whether it
                  actually succeeded and retrying when it did not are part of the platform. You pay
                  for the work that ships and the usage it genuinely consumes — not for every step
                  the agent took to get there.
                </Text>
              </View>
            </View>
          </Reveal>
        </View>
      </OpenSection>

      {/* ------------------------------------------------ compare */}
      <Band tone="brand" art={{ variant: 'network', color: t.brand, side: 'right' }}>
        <Reveal style={styles.head} distance={16}>
          <SectionLabel>INCLUDED CAPABILITIES</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitle]}>
            What each plan includes.
          </Heading>
          <Text style={[type.body, styles.headSub]}>
            Every capability of the platform, and exactly where each plan draws the line.
          </Text>
        </Reveal>

        {/*
          A four-column table cannot compress below roughly 650px without the
          values truncating. From tablet up it scrolls inside its own clipped
          container; on a phone even that is wrong — the table still renders
          600px wide inside a 390px page — so the feature label moves onto its
          own line and the three plan values share the full card width beneath
          it. The plan header stays a single row, so the columns still line up
          and the comparison survives.
        */}
        <View style={styles.tableShell}>
          {l.isPhone ? (
            <View style={styles.stackTable}>
              <View style={styles.stackHeadRow}>
                {PLANS.map((plan) => (
                  <View key={plan.id} style={styles.stackHeadCell}>
                    <Text numberOfLines={1} style={styles.tableHeadPlan}>
                      {plan.name}
                    </Text>
                    <Text numberOfLines={1} style={styles.tableHeadPrice}>
                      {plan.price === 0
                        ? 'Free'
                        : `$${annual ? Math.round(plan.price * 0.8) : plan.price}/mo`}
                    </Text>
                  </View>
                ))}
              </View>
              {COMPARE.map((row, index) => (
                <View
                  key={row.label}
                  style={[styles.stackRow, index % 2 === 1 ? styles.stackRowAlt : null]}>
                  <Text style={styles.stackLabel}>{row.label}</Text>
                  <View style={styles.stackValues}>
                    {row.values.map((value, cell) => (
                      <CompareCell key={`${row.label}-${cell}`} value={value} styles={styles} t={t} />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator
            contentContainerStyle={styles.tableScroll}>
            <View style={styles.table}>
              <View style={styles.tableHeadRow}>
                <View style={styles.compareLabelCell}>
                  <Text style={styles.tableHeadFeature}>Feature</Text>
                </View>
                {PLANS.map((plan) => (
                  <View key={plan.id} style={styles.compareCell}>
                    <Text style={styles.tableHeadPlan}>{plan.name}</Text>
                    <Text style={styles.tableHeadPrice}>
                      {plan.price === 0 ? 'Free' : `$${annual ? Math.round(plan.price * 0.8) : plan.price}/mo`}
                    </Text>
                  </View>
                ))}
              </View>

              {COMPARE.map((row, index) => (
                <View
                  key={row.label}
                  style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : null]}>
                  <View style={styles.compareLabelCell}>
                    <Text numberOfLines={2} style={styles.compareLabel}>
                      {row.label}
                    </Text>
                  </View>
                  {row.values.map((value, cell) => (
                    <CompareCell key={`${row.label}-${cell}`} value={value} styles={styles} t={t} />
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
          )}
        </View>
      </Band>

      {/* ------------------------------------------------ usage-based */}
      <OpenSection>
        <Reveal style={styles.head} distance={16}>
          <SectionLabel>PAY FOR WHAT YOU RUN</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitle]}>
            Usage-based pricing.
          </Heading>
          <Text style={[type.body, styles.headSub]}>
            A handful of things cost real money to produce. Those are priced at what they cost, shown
            up front, and never bundled into a bigger plan you did not need.
          </Text>
        </Reveal>

        <View style={styles.usageGrid}>
          {USAGE.map((item, index) => {
            const accent = accentOf(item.accent);
            return (
              <Reveal key={item.title} style={styles.usageCell} distance={16} delay={index * 70}>
                <View style={styles.usageCard}>
                  <View style={styles.usageTop}>
                    <View style={[styles.usageIcon, { backgroundColor: softFill(accent, t) }]}>
                      <FontAwesome6 name={item.icon as never} size={17} color={accent} />
                    </View>
                    <View style={styles.usageChip}>
                      <Text style={styles.usageChipText}>Usage-based</Text>
                    </View>
                  </View>
                  <Text style={[type.h4, styles.usageTitle]}>{item.title}</Text>
                  <Text style={[type.h3, styles.usageRate, { color: accent }]}>{item.rate}</Text>
                  <Text style={styles.usageNote}>{item.note}</Text>
                </View>
              </Reveal>
            );
          })}
        </View>
      </OpenSection>

      {/* ------------------------------------------------ faq + reassurance */}
      <OpenSection>
        <Reveal style={styles.head} distance={16}>
          <SectionLabel>BEFORE YOU DECIDE</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitle]}>
            Pricing questions, answered.
          </Heading>
        </Reveal>

        <View style={styles.faqList}>
          {FAQ.map((item) => (
            <FaqRow
              key={item.q}
              item={item}
              open={openFaq === item.q}
              onToggle={() => setOpenFaq((prev) => (prev === item.q ? null : item.q))}
              styles={styles}
              t={t}
            />
          ))}
        </View>

        <View style={styles.reassurance}>
          {REASSURANCE.map((item, index) => (
            <View
              key={item.label}
              style={[styles.reassureItem, index > 0 ? styles.reassureItemDivided : null]}>
              <View style={styles.reassureIcon}>
                <FontAwesome6 name={item.icon as never} size={15} color={t.brand} />
              </View>
              <Text numberOfLines={2} style={styles.reassureLabel}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      </OpenSection>
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/* styles                                                              */
/* ------------------------------------------------------------------ */

function createStyles(t: ThemeTokens, l: Layout, type: TypeScale) {
  const gridGap = l.isPhone ? 12 : 18;

  const contentWidth = Math.max(
    280,
    Math.min(l.width, BP.maxContent) - l.gutter * 2 - l.sectionPad * 2,
  );

  const cellPct = (columns: number): DimensionValue => {
    if (columns <= 1) return '100%';
    const gapPct = ((gridGap * (columns - 1)) / contentWidth) * 100;
    return `${Math.max(20, Math.floor(((100 - gapPct - 0.5) / columns) * 100) / 100)}%` as DimensionValue;
  };

  // Three plans divide 3 / 1 cleanly; below tablet a third of the width is
  // narrower than the longest feature line, so they go full width instead.
  const planColumns = l.isCompact ? 1 : 3;
  // Four usage cards divide 4 / 2 / 1.
  const usageColumns = l.isPhone ? 1 : l.isDesktop ? 4 : 2;

  // The scrolling table only renders from tablet up; the phone gets the stacked
  // variant below, so this width never has to squeeze into 390.
  const featureColW = 200;
  const tableMin = featureColW + 3 * 150;
  const tableWidth = Math.max(contentWidth, tableMin);

  const twoUp: ViewStyle = { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 };
  const stacked = l.isStacked;
  const cellText: TextStyle = { ...type.caption, color: t.text, textAlign: 'center' };

  return StyleSheet.create({
    /* custom automation ------------------------------------------- */
    /** stacks below the split breakpoint: price beside copy needs real width */
    customCard: {
      flexDirection: l.isStacked ? 'column' : 'row',
      alignItems: l.isStacked ? 'stretch' : 'center',
      gap: l.isStacked ? 20 : 32,
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 18,
      backgroundColor: t.surfaceRaised,
      padding: l.isPhone ? 20 : 28,
      ...(elevation(t, 1) as ViewStyle),
    },
    customCopy: l.isStacked
      ? { width: '100%', minWidth: 0, gap: 10 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 10 },
    customEyebrow: { ...type.micro, color: t.violet, fontWeight: '800', letterSpacing: 1.2 },
    customTitle: type.h3,
    customBody: { ...type.bodySm, color: t.textMuted, maxWidth: 620 },
    customAside: l.isStacked
      ? { width: '100%', minWidth: 0, gap: 6 }
      : { flexGrow: 0, flexShrink: 0, flexBasis: 260, minWidth: 0, gap: 6 },
    customPrice: { ...type.h2, color: t.text },
    customPriceNote: { ...type.micro, color: t.textSubtle },
    customButtons: { gap: 10, marginTop: 10 },

    /* -------------------------------------------------- hero */
    hero: { alignItems: 'center' },
    heroTitle: { marginTop: 16, textAlign: 'center', maxWidth: 900 },
    heroBody: { marginTop: 16, textAlign: 'center', maxWidth: 720 },

    toggleWrap: { marginTop: 28, alignItems: 'center' },
    toggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      padding: 6,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 999,
      backgroundColor: t.surfaceMuted,
    },
    toggleOption: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: l.isPhone ? 14 : 20,
      borderRadius: 999,
    },
    toggleOptionOn: { backgroundColor: t.surfaceRaised, ...(elevation(t, 1) as object) },
    toggleLabel: { fontSize: 14, fontWeight: '700', color: t.textMuted },
    toggleLabelOn: { color: t.text },
    saveChip: {
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 4,
      backgroundColor: t.successBg,
    },
    saveChipText: { fontSize: 11, fontWeight: '800', color: t.successText },

    /* -------------------------------------------------- plans */
    planGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'stretch',
      gap: gridGap,
      marginTop: l.isPhone ? 24 : 34,
    },
    planCell: {
      flexGrow: 0,
      flexShrink: 1,
      flexBasis: cellPct(planColumns),
      minWidth: 0,
    },
    planCard: {
      height: '100%',
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surfaceRaised,
      padding: l.isPhone ? 18 : 24,
      gap: 10,
      ...(elevation(t, 1) as object),
    },
    planCardFeatured: {
      borderColor: t.violet,
      borderWidth: 2,
      backgroundColor: t.surfaceMuted,
      ...(elevation(t, 3) as object),
    },
    planBadge: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 5,
      marginBottom: 2,
    },
    planBadgeText: { fontSize: 11, fontWeight: '800', color: t.textOnBrand, letterSpacing: 0.4 },
    planIcon: {
      width: 48,
      height: 48,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    planName: { marginTop: 4 },
    planBlurb: { ...type.bodySm, color: t.textMuted },

    priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 8 },
    priceValue: { color: t.text },
    pricePeriod: { ...type.bodySm, color: t.textMuted, paddingBottom: 8 },
    priceNote: { ...type.caption, color: t.textSubtle },

    creditsLine: {
      marginTop: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    creditsText: { fontSize: 12.5, fontWeight: '800' },

    featureList: { marginTop: 12, gap: 10 },
    featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    featureTick: {
      width: 20,
      height: 20,
      marginTop: 1,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    featureText: { ...type.bodySm, color: t.text, flexShrink: 1, minWidth: 0 },
    planSpacer: { flexGrow: 1, flexShrink: 0, flexBasis: 12 },
    planButton: {
      minHeight: 48,
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 10,
      backgroundColor: t.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 18,
    },
    planButtonPressed: { backgroundColor: t.surfaceInset },
    planButtonLabel: { fontSize: 15, fontWeight: '700', color: t.text },

    /* -------------------------------------------------- shared heads */
    head: { gap: 10, alignItems: l.isPhone ? 'flex-start' : 'center' },
    headTitle: { textAlign: l.isPhone ? 'left' : 'center' },
    headSub: { textAlign: l.isPhone ? 'left' : 'center', maxWidth: 680 },

    /* -------------------------------------------------- compare table */
    tableShell: {
      marginTop: l.isPhone ? 20 : 28,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 10 : 0,
      overflow: 'hidden',
    },
    tableScroll: { flexGrow: 0, flexShrink: 0 },
    table: { width: tableWidth, flexGrow: 0, flexShrink: 0 },
    tableHeadRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      borderBottomWidth: 1,
      borderBottomColor: t.border,
      backgroundColor: t.surfaceRaised,
      paddingVertical: 14,
    },
    tableHeadFeature: {
      ...type.micro,
      color: t.textSubtle,
      fontWeight: '800',
      letterSpacing: 0.7,
      textTransform: 'uppercase',
    },
    tableHeadPlan: { ...type.bodySm, color: t.text, fontWeight: '800', textAlign: 'center' },
    tableHeadPrice: { ...type.micro, color: t.textSubtle, textAlign: 'center' },
    tableRow: { flexDirection: 'row', alignItems: 'center', minHeight: 52 },
    tableRowAlt: { backgroundColor: t.surfaceInset },
    compareLabelCell: {
      width: featureColW,
      flexGrow: 0,
      flexShrink: 0,
      paddingHorizontal: 16,
      justifyContent: 'center',
    },
    compareLabel: { ...type.caption, color: t.text, fontWeight: '700' },
    compareCell: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minWidth: 0,
      // a third of a 390 phone is ~98px; 10px of padding either side would push
      // "Usage-based" onto a second line for no reason
      paddingHorizontal: l.isPhone ? 4 : 10,
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    compareValue: cellText,
    compareTick: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.successBg,
    },
    compareDash: { width: 12, height: 2, borderRadius: 1, backgroundColor: t.borderStrong },

    /* ------------------------------------- compare table, phone (stacked) */
    stackTable: { gap: 8 },
    stackHeadRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingVertical: 10,
      paddingHorizontal: 4,
    },
    stackHeadCell: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minWidth: 0,
      paddingHorizontal: 4,
      alignItems: 'center',
      gap: 2,
    },
    stackRow: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingVertical: 8,
      paddingHorizontal: 4,
      gap: 2,
    },
    stackRowAlt: { backgroundColor: t.surfaceInset },
    stackLabel: { ...type.caption, color: t.text, fontWeight: '800', paddingHorizontal: 8 },
    stackValues: { flexDirection: 'row', alignItems: 'stretch' },

    /* -------------------------------------------------- usage */
    usageGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: gridGap,
      marginTop: l.isPhone ? 20 : 28,
    },
    usageCell: {
      flexGrow: 0,
      flexShrink: 1,
      flexBasis: cellPct(usageColumns),
      minWidth: 0,
    },
    usageCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceRaised,
      padding: l.isPhone ? 16 : 20,
      gap: 8,
      ...(elevation(t, 1) as object),
    },
    usageTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    usageIcon: {
      width: 44,
      height: 44,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    usageChip: {
      flexGrow: 0,
      flexShrink: 1,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
      backgroundColor: t.chipBg,
    },
    usageChipText: { fontSize: 11, fontWeight: '800', color: t.chipText },
    usageTitle: { marginTop: 4 },
    usageRate: {},
    usageNote: { ...type.caption, color: t.textMuted },

    /* -------------------------------------------------- credits panel */
    creditsRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: 'flex-start',
      gap: stacked ? 26 : 44,
    },
    creditsPanel: stacked ? { width: '100%', minWidth: 0 } : twoUp,
    balanceCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 16 : 22,
      gap: 16,
      ...(elevation(t, 2) as object),
    },
    balanceHead: { gap: 2 },
    balanceTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    balanceSub: { ...type.micro, color: t.textMuted },
    balanceList: { gap: 13 },
    balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    balanceIcon: {
      width: 32,
      height: 32,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    balanceCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 6 },
    balanceLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    balanceLabel: { ...type.caption, color: t.textMuted, flexShrink: 1, minWidth: 0 },
    balanceValue: { ...type.caption, color: t.text, fontWeight: '800' },
    balanceTrack: { height: 6, borderRadius: 3, backgroundColor: t.surfaceInset, overflow: 'hidden' },
    balanceFill: { height: 6, borderRadius: 3 },
    balanceTotal: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      minHeight: 54,
      borderWidth: 1,
      borderColor: hexToRgba(t.brand, 0.35),
      borderRadius: 13,
      backgroundColor: t.brandSoft,
      paddingHorizontal: 15,
      paddingVertical: 12,
    },
    balanceTotalLabel: { ...type.bodySm, color: t.text, fontWeight: '700' },
    balanceTotalValue: { ...type.h4, color: t.brand },

    creditsCopy: stacked ? { width: '100%', minWidth: 0 } : { ...twoUp, paddingTop: 4 },
    creditsTitle: { marginTop: 14 },
    creditsBody: { marginTop: 14, maxWidth: 560 },
    // A callout, not a card: an inset strip with a rule down its leading edge,
    // so it reads as emphasis inside the copy rather than a separate object.
    notBilled: {
      marginTop: 20,
      maxWidth: 560,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      paddingLeft: 16,
      paddingVertical: 4,
      borderLeftWidth: 3,
      borderLeftColor: t.green,
    },
    notBilledIcon: {
      width: 28,
      height: 28,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 9,
      backgroundColor: t.successBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notBilledCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 5 },
    notBilledTitle: { ...type.h4, color: t.text },
    notBilledBody: { ...type.bodySm, color: t.textMuted },

    /* -------------------------------------------------- faq */
    faqList: { marginTop: l.isPhone ? 20 : 26, gap: 10 },
    faqItem: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceMuted,
      overflow: 'hidden',
    },
    faqHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 56,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    faqHeadPressed: { backgroundColor: t.surfaceInset },
    faqQuestion: {
      ...type.bodySm,
      color: t.text,
      fontWeight: '700',
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
    },
    faqChevron: {
      width: 26,
      height: 26,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceRaised,
    },
    faqBody: { paddingHorizontal: 16, paddingBottom: 15 },
    faqAnswer: { ...type.bodySm, color: t.textMuted },

    /* -------------------------------------------------- reassurance */
    reassurance: {
      marginTop: l.isPhone ? 18 : 26,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 12 : 16,
      flexDirection: 'row',
      flexWrap: l.isStacked ? 'wrap' : 'nowrap',
      alignItems: 'stretch',
      gap: l.isPhone ? 12 : 0,
    },
    reassureItem: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: l.isPhone ? '100%' : l.isStacked ? '46%' : 0,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 44,
      paddingHorizontal: l.isPhone ? 0 : 16,
      paddingVertical: l.isPhone ? 0 : 6,
    },
    reassureItemDivided: { borderLeftWidth: l.isPhone ? 0 : 1, borderLeftColor: t.border },
    reassureIcon: {
      width: 40,
      height: 40,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    reassureLabel: { ...type.bodySm, color: t.text, fontWeight: '700', flexShrink: 1, minWidth: 0 },
  });
}
