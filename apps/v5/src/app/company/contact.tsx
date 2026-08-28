import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { ROUTES } from '@/components/public/nav';
import { PageShell } from '@/components/public/page-shell';
import { Reveal } from '@/components/public/motion';
import { breadcrumbJsonLd, faqJsonLd } from '@/components/public/seo';
import { FONT_SANS,
  Heading,
  PrimaryButton,
  Band,
  OpenSection,
  SectionAside,
  SectionLabel,
  useTypeScale,
  type TypeScale,
} from '@/components/public/ui';
import { trackCta } from '@/lib/analytics';
import { CONTACT_TOPIC_LABEL, isContactTopic, type ContactTopic } from '@/lib/destinations';
import { accentText, elevation, softFill, type ThemeTokens } from '@/theme/tokens';
import { cellBasis, useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';

/**
 * Where the form actually goes.
 *
 * There is no form backend in this app, and a button that pretends to submit —
 * or silently does nothing — is worse than one that hands the message to the
 * visitor's own mail client with everything already filled in. One constant, so
 * pointing it at a real endpoint later is a single edit.
 */
const CONTACT_INBOX = 'hello@flowsmartly.com';

/* ------------------------------------------------------------------ */
/* content                                                             */
/* ------------------------------------------------------------------ */

const PROMISES = [
  'Real people, real answers',
  'Fast, friendly, and helpful',
  'No pressure, just solutions',
];

/**
 * What the message actually does once it leaves the form. The hero column was
 * three ticks tall next to a 700px form card, and "what happens next" is the
 * one thing a visitor wants to know before writing — response *windows* are a
 * different promise and stay in the closer section, so nothing is repeated.
 */
const NEXT_STEPS: { title: string; body: string }[] = [
  {
    title: 'It reaches a person',
    body: 'No ticket robot in the middle. Your message goes to the team that can actually answer it.',
  },
  {
    title: 'We read the context',
    body: 'Your company, your channels and what you want to improve shape the reply — it is not a template.',
  },
  {
    title: 'You get a next step',
    body: 'An answer, a walkthrough, or an introduction to the right person. Whatever the message needs.',
  },
];

/** Places that answer a question faster than we can. Real routes, no dead ends. */
const SELF_SERVE: { label: string; icon: string; href: string; track: string }[] = [
  { label: 'Help Center', icon: 'circle-question', href: ROUTES.helpCenter, track: 'contact.hero.help-center' },
  { label: 'Guides & resources', icon: 'book-open', href: ROUTES.resources, track: 'contact.hero.resources' },
  { label: 'System status', icon: 'signal', href: ROUTES.status, track: 'contact.hero.status' },
];

type Accent = 'brand' | 'violet' | 'orange';

const HELP_CARDS: {
  icon: string;
  title: string;
  body: string;
  action: string;
  accent: Accent;
  topic: ContactTopic;
}[] = [
  {
    icon: 'chart-simple',
    title: 'Talk to Sales',
    body: 'Explore how FlowSmartly can drive growth for your team. Get a personalized demo and pricing details.',
    action: 'Contact Sales',
    accent: 'brand',
    topic: 'sales',
  },
  {
    icon: 'headset',
    title: 'Customer Support',
    body: 'Need help with your account or have a technical question? Our support team is here for you.',
    action: 'Contact Support',
    accent: 'violet',
    topic: 'support',
  },
  {
    icon: 'handshake',
    title: 'Partnerships',
    body: "Interested in partnering with FlowSmartly? Let's build something great together.",
    action: 'Contact Partnerships',
    accent: 'orange',
    topic: 'partnership',
  },
];

const RESPONSE_TIMES: { icon: string; label: string; time: string; accent: Accent }[] = [
  { icon: 'chart-simple', label: 'Sales Inquiries', time: 'Within 1 business hour', accent: 'brand' },
  { icon: 'headset', label: 'Support Requests', time: 'Within 4 business hours', accent: 'violet' },
  {
    icon: 'handshake',
    label: 'Partnership Inquiries',
    time: 'Within 1–2 business days',
    accent: 'orange',
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: 'How quickly will I hear back?',
    a: 'Most inquiries are answered within 1 business hour for sales and within 4 business hours for support. Partnership requests usually take 1–2 business days because more people read them.',
  },
  {
    q: 'Do you offer 24/7 support?',
    a: 'Not yet. Live support runs Monday to Friday during business hours. Anything sent outside those hours is picked up first thing the next business day, in the order it arrived.',
  },
  {
    q: 'Can I request a product demo?',
    a: 'Yes. Tell us in your message that you would like a demo and we will set up a live walkthrough built around your channels, your team size and what you are trying to improve.',
  },
  {
    q: 'Do you offer onboarding and training?',
    a: 'Yes. Every account gets guided onboarding, and larger teams can add dedicated training sessions. Mention it in your message and we will include it in what we send back.',
  },
  {
    q: 'What information should I include in my message?',
    a: 'Your company, roughly how big your team is, the channels you run today, and the outcome you want. The more context you give, the more specific our first reply can be.',
  },
];

/* ------------------------------------------------------------------ */
/* pieces                                                              */
/* ------------------------------------------------------------------ */

type Styles = ReturnType<typeof createStyles>;

/**
 * `inRow` is load-bearing, not cosmetic: the two-up sizing (`flexBasis: 0`)
 * may only be applied when the parent is actually laid out as a *row*. As a
 * column child, `flexBasis: 0` sizes the field's **height** to zero, which is
 * what made the standalone fields collapse and overlap the consent row.
 */
function Field({
  label,
  placeholder,
  value,
  onChangeText,
  styles,
  t,
  multiline,
  inRow,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (next: string) => void;
  styles: Styles;
  t: ThemeTokens;
  multiline?: boolean;
  inRow?: boolean;
}) {
  return (
    <View style={[styles.field, inRow ? styles.fieldCell : null]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.textSubtle}
        accessibilityLabel={label}
        multiline={multiline}
        style={[styles.input, multiline ? styles.inputMultiline : null]}
      />
    </View>
  );
}

function AccentButton({
  label,
  color,
  styles,
  t,
  onPress,
}: {
  label: string;
  color: string;
  styles: Styles;
  t: ThemeTokens;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.accentButton, { backgroundColor: color, opacity: pressed ? 0.88 : 1 }]}>
      <Text style={[styles.accentButtonLabel, { color: t.textOnBrand }]} numberOfLines={1}>
        {label}
      </Text>
      <FontAwesome6 name="arrow-right" size={13} color={t.textOnBrand} />
    </Pressable>
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

export default function ContactPage() {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  const styles = useMemo(() => createStyles(t, l, type), [t, l, type]);

  /**
   * Contact is the destination for every CTA the site cannot yet deliver on —
   * a demo, a download, a newsletter signup. Reading the topic back out is what
   * makes those honest destinations rather than dead ends: the visitor lands
   * with the reason they clicked already written into the form.
   */
  const params = useLocalSearchParams<{ topic?: string; email?: string }>();
  const requestedTopic = Array.isArray(params.topic) ? params.topic[0] : params.topic;
  const requestedEmail = Array.isArray(params.email) ? params.email[0] : params.email;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [teamSize, setTeamSize] = useState('');
  const [topic, setTopic] = useState(
    isContactTopic(requestedTopic) ? CONTACT_TOPIC_LABEL[requestedTopic] : '',
  );
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [openFaq, setOpenFaq] = useState<string | null>(FAQ[0].q);
  const router = useRouter();

  // The initial state above covers the first render (including the static one);
  // this catches a client-side navigation that changes the query on the page
  // the visitor is already looking at.
  useEffect(() => {
    if (isContactTopic(requestedTopic)) setTopic(CONTACT_TOPIC_LABEL[requestedTopic]);
  }, [requestedTopic]);

  useEffect(() => {
    if (requestedEmail) setEmail(requestedEmail);
  }, [requestedEmail]);

  const accentOf = (accent: Accent) =>
    accent === 'violet' ? t.violet : accent === 'orange' ? t.orange : t.brand;

  /** Hands the finished message to the visitor's own mail client. */
  const sendMessage = () => {
    const subject = topic.trim() || 'Website enquiry';
    const body = [
      message.trim(),
      '',
      '—',
      name.trim() ? `Name: ${name.trim()}` : null,
      email.trim() ? `Email: ${email.trim()}` : null,
      company.trim() ? `Company: ${company.trim()}` : null,
      teamSize.trim() ? `Team size: ${teamSize.trim()}` : null,
      consent ? 'Happy to be contacted about this enquiry.' : null,
    ]
      .filter((line) => line !== null)
      .join('\n');
    Linking.openURL(
      `mailto:${CONTACT_INBOX}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    );
  };

  const focusForm = (nextTopic: ContactTopic) => {
    setTopic(CONTACT_TOPIC_LABEL[nextTopic]);
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.getElementById('contact-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <PageShell
      title="Contact"
      description="Talk to FlowSmartly about sales, support or partnerships — real people, real answers, published response times and no sales pressure."
      cta={false}
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Contact', path: ROUTES.contact },
        ]),
        faqJsonLd(FAQ.map((item) => ({ question: item.q, answer: item.a }))),
      ]}>
      {/* ------------------------------------------------ hero + form */}
      <OpenSection>
        <View style={styles.heroRow}>
          <Reveal style={styles.heroCopy} distance={16}>
            <SectionLabel>CONTACT US</SectionLabel>
            <Heading level={1} style={[type.display, styles.heroTitle]}>
              Let&apos;s talk about your growth.
            </Heading>
            <Text style={[type.body, styles.heroBody]}>
              Whether you have a question, need a demo, or want to explore how FlowSmartly can help
              your team scale—we&apos;re here and ready to help.
            </Text>
            <View style={styles.promises}>
              {PROMISES.map((promise) => (
                <View key={promise} style={styles.promiseRow}>
                  <View style={styles.promiseIcon}>
                    <FontAwesome6 name="check" size={11} color={t.brand} />
                  </View>
                  <Text style={styles.promiseText}>{promise}</Text>
                </View>
              ))}
            </View>

            <View style={styles.nextSteps}>
              <Text style={styles.nextStepsTitle}>What happens after you press send</Text>
              {NEXT_STEPS.map((step, index) => (
                <View key={step.title} style={styles.stepRow}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{index + 1}</Text>
                  </View>
                  <View style={styles.stepCopy}>
                    <Text style={styles.stepTitle}>{step.title}</Text>
                    <Text style={styles.stepBody}>{step.body}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.selfServe}>
              <Text style={styles.selfServeTitle}>Or look it up yourself</Text>
              <View style={styles.selfServeRow}>
                {SELF_SERVE.map((item) => (
                  <Pressable
                    key={item.label}
                    accessibilityRole="link"
                    accessibilityLabel={item.label}
                    onPress={() => {
                      trackCta(item.track, { variant: 'link', destination: item.href });
                      router.push(item.href as never);
                    }}
                    style={({ pressed }) => [styles.selfServeLink, pressed ? styles.pressed : null]}>
                    <FontAwesome6 name={item.icon as never} size={12} color={t.brand} />
                    <Text style={styles.selfServeLabel} numberOfLines={1}>
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </Reveal>

          <Reveal style={styles.formColumn} distance={16} delay={80}>
            <View nativeID="contact-form" style={styles.formCard}>
              <Heading level={2} style={[type.h3, styles.formTitle]}>
                Send us a message
              </Heading>
              <Text style={styles.formSub}>
                Tell us what you need and the right person will pick it up.
              </Text>

              <View style={styles.fieldRow}>
                <Field
                  label="Full name"
                  placeholder="Jane Doe"
                  value={name}
                  onChangeText={setName}
                  styles={styles}
                  t={t}
                  inRow
                />
                <Field
                  label="Work email"
                  placeholder="jane@company.com"
                  value={email}
                  onChangeText={setEmail}
                  styles={styles}
                  t={t}
                  inRow
                />
              </View>

              <View style={styles.fieldRow}>
                <Field
                  label="Company name"
                  placeholder="Company, Inc."
                  value={company}
                  onChangeText={setCompany}
                  styles={styles}
                  t={t}
                  inRow
                />
                <Field
                  label="Team size"
                  placeholder="1–10, 11–50, 50+"
                  value={teamSize}
                  onChangeText={setTeamSize}
                  styles={styles}
                  t={t}
                  inRow
                />
              </View>

              <Field
                label="What can we help you with?"
                placeholder="Sales, support, partnership, something else"
                value={topic}
                onChangeText={setTopic}
                styles={styles}
                t={t}
              />

              <Field
                label="Your message"
                placeholder="Tell us about your team, your channels and what you want to improve."
                value={message}
                onChangeText={setMessage}
                styles={styles}
                t={t}
                multiline
              />

              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: consent }}
                accessibilityLabel="I agree to be contacted about my inquiry"
                onPress={() => setConsent((prev) => !prev)}
                style={styles.consentRow}>
                <View style={[styles.checkbox, consent ? styles.checkboxOn : null]}>
                  {consent ? <FontAwesome6 name="check" size={11} color={t.textOnBrand} /> : null}
                </View>
                <Text style={styles.consentText}>
                  I agree to be contacted about my inquiry and understand I can opt out at any time.
                </Text>
              </Pressable>

              <PrimaryButton
                label="Send message"
                icon="arrow-right"
                iconRight
                full
                trackId="contact.form.send"
                onPress={sendMessage}
              />

              <Text style={styles.privacyNote}>
                Sending opens your email app with this message ready to go to {CONTACT_INBOX}. We only
                use what you send to answer your question — no lists, no resale.
              </Text>
            </View>
          </Reveal>
        </View>
      </OpenSection>

      {/* ------------------------------------------------ how can we help */}
      <Band tone="surface" art={{ variant: 'tasks', color: t.brand, side: 'right' }}>
        <View style={styles.helpHead}>
          <SectionLabel>WHERE TO START</SectionLabel>
          <Heading level={2} style={[type.h2, styles.helpTitle]}>
            How can we help?
          </Heading>
          <Text style={[type.body, styles.helpSub]}>
            Three ways in. Pick the one that matches your question and you will land with the right
            team first time.
          </Text>
        </View>

        <View style={styles.helpGrid}>
          {HELP_CARDS.map((card, index) => {
            const accent = accentOf(card.accent);
            return (
              <Reveal key={card.title} style={styles.helpCell} distance={16} delay={index * 90}>
                <View style={styles.helpCard}>
                  <View style={[styles.helpIcon, { backgroundColor: softFill(accent, t) }]}>
                    <FontAwesome6 name={card.icon as never} size={19} color={accent} />
                  </View>
                  <Heading level={3} style={[type.h4, styles.helpCardTitle]}>
                    {card.title}
                  </Heading>
                  <Text style={styles.helpCardBody}>{card.body}</Text>
                  <View style={styles.helpCardSpacer} />
                  <AccentButton
                    label={card.action}
                    color={accent}
                    styles={styles}
                    t={t}
                    onPress={() => focusForm(card.topic)}
                  />
                </View>
              </Reveal>
            );
          })}
        </View>
      </Band>

      {/* ------------------------------------------------ response times + faq */}
      <Band tone="orange" art={{ variant: 'support', color: t.orange, side: 'left' }}>
        <View style={styles.closerRow}>
          <Reveal style={styles.closerColumn} distance={16}>
            <Heading level={2} style={[type.h2, styles.closerTitle]}>
              We&apos;re here—and we respond fast.
            </Heading>
            <Text style={[type.body, styles.closerSub]}>
              Every message is read by a person. These are the windows we hold ourselves to on a
              normal business week.
            </Text>

            <View style={styles.timeList}>
              {RESPONSE_TIMES.map((row) => {
                const accent = accentOf(row.accent);
                return (
                  <View key={row.label} style={styles.timeRow}>
                    <View style={[styles.timeIcon, { backgroundColor: softFill(accent, t) }]}>
                      <FontAwesome6 name={row.icon as never} size={15} color={accent} />
                    </View>
                    <View style={styles.timeCopy}>
                      <Text style={styles.timeLabel}>{row.label}</Text>
                      <Text style={styles.timeValue}>{row.time}</Text>
                    </View>
                    <FontAwesome6 name="clock" size={14} color={t.textSubtle} />
                  </View>
                );
              })}
            </View>

            <View style={styles.trustCard}>
              <View style={styles.trustIcon}>
                <FontAwesome6 name="lock" size={14} color={t.brand} />
              </View>
              <View style={styles.trustCopy}>
                <Text style={styles.trustTitle}>Your trust matters</Text>
                <Text style={styles.trustBody}>
                  What you share stays between you and the team handling your request. We do not sell
                  it, and we do not add you to a mailing list you did not ask for.
                </Text>
              </View>
            </View>
          </Reveal>

          <Reveal style={styles.closerColumn} distance={16} delay={80}>
            <Heading level={2} style={[type.h2, styles.closerTitle]}>
              Quick answers to common questions.
            </Heading>
            <Text style={[type.body, styles.closerSub]}>
              The things people ask before they write in.
            </Text>
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
          </Reveal>
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
  /** half the grid gutter; cells carry it as padding so wrapped rows stay flush */
  const cellPad = l.isPhone ? 6 : 9;

  /**
   * 3 cards, so the column count must divide 3 — 1 or 3, never 2. A 2-column
   * pass at tablet would leave "Partnerships" alone on a ragged second row.
   * 3-up needs ~1024 before the widest CTA ("Contact Partnerships") stops
   * ellipsizing inside its card, so everything below that is a single column.
   */
  const helpColumns = l.isCompact ? 1 : 3;

  const twoUp: ViewStyle = { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 };
  const rowLabel: TextStyle = { ...type.caption, color: t.text, fontWeight: '700' };

  return StyleSheet.create({
    /* -------------------------------------------------- hero */
    heroRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: 'flex-start',
      gap: stacked ? 26 : 40,
    },
    heroCopy: stacked ? { width: '100%', minWidth: 0 } : { ...twoUp, paddingTop: 6 },
    heroTitle: { marginTop: 14 },
    heroBody: { marginTop: 14, maxWidth: 520 },
    promises: { marginTop: 22, gap: 12 },
    promiseRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
    promiseIcon: {
      width: 24,
      height: 24,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softFill(t.brand, t),
    },
    promiseText: { ...type.bodySm, color: t.text, fontWeight: '600', flexShrink: 1, minWidth: 0 },

    /* -------------------------------------------------- what happens next */
    nextSteps: {
      marginTop: 26,
      gap: 14,
      paddingTop: 20,
      borderTopWidth: 1,
      borderTopColor: t.divider,
      maxWidth: 520,
    },
    nextStepsTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 13 },
    stepNumber: {
      width: 26,
      height: 26,
      marginTop: 1,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softFill(t.brand, t),
    },
    stepNumberText: { ...type.micro, color: accentText(t.brand, t), fontWeight: '800' },
    stepCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 3 },
    stepTitle: { ...type.bodySm, color: t.text, fontWeight: '700' },
    stepBody: { ...type.caption, color: t.textMuted },

    /* -------------------------------------------------- self-serve links */
    selfServe: { marginTop: 22, gap: 11 },
    selfServeTitle: { ...type.caption, color: t.textSubtle, fontWeight: '700' },
    selfServeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
    selfServeLink: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceMuted,
    },
    selfServeLabel: { ...type.bodySm, color: t.text, fontWeight: '700', flexShrink: 1, minWidth: 0 },
    pressed: { opacity: 0.85 },

    /* -------------------------------------------------- form */
    formColumn: stacked ? { width: '100%', minWidth: 0 } : twoUp,
    formCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 16 : 24,
      gap: 14,
      ...(elevation(t, 1) as object),
    },
    formTitle: {},
    formSub: { ...type.bodySm, color: t.textMuted, marginTop: -6 },
    fieldRow: {
      flexDirection: l.isPhone ? 'column' : 'row',
      alignItems: 'stretch',
      gap: 14,
    },
    /** default: sized by its own content, in either axis */
    field: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', minWidth: 0, gap: 6 },
    /** two-up sizing — only meaningful while `fieldRow` really is a row */
    fieldCell: l.isPhone
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    fieldLabel: { ...type.caption, color: t.text, fontWeight: '700' },
    input: {
      minHeight: 46,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 10,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 13,
      paddingVertical: 11,
      color: t.text,
      fontSize: 14,
      fontFamily: FONT_SANS,
    },
    /** a web textarea needs a real height, not a floor — see AGENTS rule 11 */
    inputMultiline: { height: 130, textAlignVertical: 'top' },

    consentRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 11,
      minHeight: 44,
      paddingVertical: 4,
    },
    checkbox: {
      width: 20,
      height: 20,
      marginTop: 2,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: t.borderStrong,
      backgroundColor: t.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxOn: { backgroundColor: t.brand, borderColor: t.brand },
    consentText: { ...type.caption, color: t.textMuted, flexShrink: 1, minWidth: 0 },
    privacyNote: { ...type.micro, color: t.textSubtle },

    /* -------------------------------------------------- help cards */
    helpHead: { gap: 10, alignItems: l.isPhone ? 'flex-start' : 'center' },
    helpTitle: { textAlign: l.isPhone ? 'left' : 'center' },
    helpSub: { textAlign: l.isPhone ? 'left' : 'center', maxWidth: 640 },
    helpGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'stretch',
      marginHorizontal: -cellPad,
      marginTop: (l.isPhone ? 20 : 26) - cellPad,
    },
    helpCell: {
      flexGrow: 0,
      flexShrink: 0,
      flexBasis: cellBasis(helpColumns),
      minWidth: 0,
      alignItems: 'stretch',
      padding: cellPad,
    },
    /** grows to the tallest cell so all three CTAs share one baseline */
    helpCard: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceRaised,
      padding: l.isPhone ? 16 : 20,
      gap: 11,
      ...(elevation(t, 1) as object),
    },
    helpIcon: {
      width: 46,
      height: 46,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    helpCardTitle: {},
    helpCardBody: { ...type.bodySm, color: t.textMuted },
    helpCardSpacer: { flexGrow: 1, flexShrink: 0, flexBasis: 'auto' },
    accentButton: {
      minHeight: 44,
      borderRadius: 10,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 9,
      /* full width on phone; at 1-up on tablet a 660px-wide CTA looks broken */
      alignSelf: helpColumns === 1 && !l.isPhone ? 'flex-start' : 'stretch',
    },
    accentButtonLabel: { fontSize: 14, fontWeight: '700', flexShrink: 1, minWidth: 0 , fontFamily: FONT_SANS },

    /* -------------------------------------------------- closer */
    closerRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: 'flex-start',
      gap: stacked ? 28 : 40,
    },
    closerColumn: stacked ? { width: '100%', minWidth: 0 } : twoUp,
    closerTitle: {},
    closerSub: { marginTop: 12, maxWidth: 520 },

    timeList: { marginTop: 20, gap: 12 },
    timeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 13,
      minHeight: 64,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceMuted,
    },
    timeIcon: {
      width: 38,
      height: 38,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    timeCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    timeLabel: rowLabel,
    timeValue: { ...type.bodySm, color: t.textMuted },

    trustCard: {
      marginTop: 18,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 13,
      padding: 16,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.brandSoft,
    },
    trustIcon: {
      width: 34,
      height: 34,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceRaised,
    },
    trustCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 4 },
    trustTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    trustBody: { ...type.caption, color: t.textMuted },

    /* -------------------------------------------------- faq */
    faqList: { marginTop: 20, gap: 10 },
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
    faqBody: { paddingHorizontal: 16, paddingBottom: 15, paddingTop: 0 },
    faqAnswer: { ...type.bodySm, color: t.textMuted },
  });
}
