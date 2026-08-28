import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Reveal } from '@/components/public/motion';
import { ROUTES } from '@/components/public/nav';
import { PageShell } from '@/components/public/page-shell';
import { breadcrumbJsonLd, faqJsonLd } from '@/components/public/seo';
import { FONT_SANS,
  Band,
  ButtonRow,
  Card,
  Heading,
  OpenSection,
  PrimaryButton,
  SecondaryButton,
  SectionLabel,
  useTypeScale,
  type TypeScale,
} from '@/components/public/ui';
import { trackCta } from '@/lib/analytics';
import { submitLead } from '@/lib/api';
import { accentText, softFill, type ThemeTokens } from '@/theme/tokens';
import { cellBasis, useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';

/**
 * `/early-access` — the funnel that replaces registration until V5 accounts open.
 *
 * This is the first form on the site with a real backend behind it, so it is
 * also the first place where a submission can *fail*. Every outcome below is a
 * rendered state rather than a thrown error: a visitor who typed their details
 * and got nothing back is a lead lost silently, which is the one failure this
 * page exists to prevent.
 *
 * It posts the V5-native contract to `/api/v1/leads` (see `lib/api.ts`). What
 * currently answers that path is infrastructure and is deliberately not
 * knowable from here.
 */

const PROMISES: { icon: string; title: string; body: string }[] = [
  {
    icon: 'bolt',
    title: 'First in line',
    body: 'Places open in batches. Joining now puts you in the next one rather than at the back.',
  },
  {
    icon: 'comments',
    title: 'Shape what ships',
    body: 'Early members tell us what to build next, and that feedback genuinely moves the roadmap.',
  },
  {
    icon: 'lock',
    title: 'No spam, ever',
    body: 'We email you about your access and nothing else. One click unsubscribes you for good.',
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Can I still sign up for FlowSmartly today?',
    a: 'New accounts are paused while we roll V5 out. Joining early access is how you get in, and we are opening places continuously rather than on a single launch date.',
  },
  {
    q: 'I am already a customer — do I need this?',
    a: 'No. Your workspace keeps running exactly as it does now, and we will contact you when your V5 upgrade is ready. You can reach your current workspace from the sign-in page.',
  },
  {
    q: 'What happens after I join?',
    a: 'You get a confirmation email. When your place opens we send you an invitation with everything you need to get started — there is nothing to do in the meantime.',
  },
  {
    q: 'What do you do with my details?',
    a: 'We use them to contact you about your access and to understand what to prioritise. We do not sell them and we do not add you to unrelated marketing.',
  },
];

/* ------------------------------------------------------------------ */
/* form state                                                          */
/* ------------------------------------------------------------------ */

/**
 * `validating` is not a spinner — it is the moment after a failed client check,
 * when every field shows its own message. Keeping it distinct from `error`
 * means a typo never renders the same banner as a server outage.
 */
type FormState =
  | { kind: 'idle' }
  | { kind: 'validating' }
  | { kind: 'submitting' }
  | { kind: 'success' }
  | { kind: 'duplicate'; message: string }
  | { kind: 'error'; message: string; retryable: boolean };

type Fields = {
  name: string;
  email: string;
  company: string;
  phone: string;
  message: string;
};

const EMPTY: Fields = { name: '', email: '', company: '', phone: '', message: '' };

/**
 * Deliberately permissive: it rejects what is certainly not an address and
 * leaves everything else to the server. A stricter pattern in the browser only
 * ever turns real addresses away.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validate(fields: Fields): Record<string, string> {
  const errors: Record<string, string> = {};
  if (fields.name.trim().length < 2) errors.name = 'Tell us what to call you.';
  if (!EMAIL_RE.test(fields.email.trim())) errors.email = 'Enter an email address we can reach you on.';
  return errors;
}

export default function EarlyAccessScreen() {
  const t = useTokens();
  const l = useLayout();
  const ts = useTypeScale();
  const styles = useMemo(() => createStyles(t, l, ts), [t, l, ts]);

  const [fields, setFields] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<FormState>({ kind: 'idle' });

  const set = (key: keyof Fields) => (value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
    // Clear a field's error as soon as the visitor edits it — leaving it up
    // while they fix it reads as though the fix did not register.
    setErrors((prev) => (prev[key] ? { ...prev, [key]: '' } : prev));
  };

  const submitting = state.kind === 'submitting';

  const onSubmit = async () => {
    if (submitting) return;

    const clientErrors = validate(fields);
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      setState({ kind: 'validating' });
      return;
    }

    setErrors({});
    setState({ kind: 'submitting' });
    trackCta('early-access.submit', { variant: 'primary' });

    const result = await submitLead({
      kind: 'early-access',
      name: fields.name.trim(),
      email: fields.email.trim(),
      company: fields.company.trim(),
      phone: fields.phone.trim(),
      message: fields.message.trim(),
      source: 'v5-early-access',
    });

    if (result.ok) {
      setState({ kind: 'success' });
      return;
    }

    if (result.code === 'duplicate') {
      setState({ kind: 'duplicate', message: result.message });
      return;
    }

    if (result.code === 'invalid_request' && result.fields) {
      setErrors(result.fields);
      setState({ kind: 'validating' });
      return;
    }

    setState({
      kind: 'error',
      message: result.message,
      // A rejected payload will be rejected again unchanged; everything else is
      // worth another attempt.
      retryable: result.code !== 'invalid_request',
    });
  };

  /**
   * PHONE RECOMPOSITION — THE ASK COMES BEFORE THE ARGUMENT.
   * =======================================================
   *
   * At 1440 this page is a horizontal media/copy composition and a good one:
   * the pitch reads down the left column while the form sits at eye level on
   * the right, so the argument and the ask are seen at the same moment.
   *
   * Turned into one column at 390 that simultaneity is exactly what is lost.
   * The pitch measures ~825px on its own — a 34px h1 over three paragraphs of
   * 17px copy over three promise rows — so the form's own heading landed
   * ~853px down. On a 390x844 viewport that is a full screen of prose before
   * the page shows the visitor the one thing it exists to collect, and this is
   * a conversion page: every one of those pixels is a chance to leave.
   *
   * So the column is not the desktop column turned sideways. It is:
   *
   *   label -> h1 -> the one paragraph that says what V5 is -> THE FORM
   *   -> the rest of the argument -> the three promises
   *
   * The promises in particular read *better* underneath: "No spam, ever" is a
   * reassurance, and a reassurance belongs next to the button it is reassuring
   * you about, not four screens above it.
   *
   * Nothing is dropped and nothing is truncated — the same nodes render at
   * both breakpoints, in the order each breakpoint can actually read. And the
   * form keeps index 1 among the split's children at every width, so crossing
   * the 640px boundary (a phone rotating to landscape mid-typing) reorders the
   * prose around it without remounting the inputs.
   */
  const pitchDetail = (
    <>
      <Text style={styles.lede}>
        From business growth and customer engagement to operations, analytics and agentic
        engineering, V5 is being built to move AI beyond assistance.{' '}
        <Text style={styles.ledeLead}>Into action.</Text>
      </Text>
      <Text style={styles.lede}>
        We are opening it in batches so every new workspace lands properly.
      </Text>
      <View style={styles.promises}>
        {PROMISES.map((item) => (
          <View key={item.title} style={styles.promise}>
            {/* A glyph echoing the title beside it. It carries nothing the
                heading does not already say, and an icon font renders as a
                private-use character, so it is taken out of the accessibility
                tree rather than left to be guessed at. */}
            <View
              aria-hidden
              style={[styles.promiseIcon, { backgroundColor: softFill(t.brand, t) }]}>
              <FontAwesome6 name={item.icon as never} size={14} color={accentText(t.brand, t)}  aria-hidden={true}/>
            </View>
            <View style={styles.promiseCopy}>
              {/* Level 2, not 3, at BOTH breakpoints. Wide, these sit directly
                  under the page h1 with no section heading between them, so a
                  3 skipped a level. On a phone they follow the form's own h2
                  instead — still level 2, still no skip, which is why the
                  reorder can move them without touching the outline.
                  `Heading` takes all of its appearance from `style`, so the
                  rank is fixed and the type is not: `promiseTitle` sets the
                  size. */}
              <Heading level={2} style={styles.promiseTitle}>
                {item.title}
              </Heading>
              <Text style={styles.promiseBody}>{item.body}</Text>
            </View>
          </View>
        ))}
      </View>
    </>
  );

  return (
    <PageShell
      title="Early access"
      description="FlowSmartly V5 is a new agentic business operating system, opening in stages. Join early access and we will tell you the moment your place is ready."
      cta={false}
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Early access', path: ROUTES.earlyAccess },
        ]),
        faqJsonLd(FAQ.map((item) => ({ question: item.q, answer: item.a }))),
      ]}>
      {/* ------------------------------------------------ hero + form */}
      <OpenSection art="none">
        <View style={styles.split}>
          <Reveal style={styles.pitch}>
            <SectionLabel>Early access</SectionLabel>
            <Heading level={1} style={styles.h1}>
              FlowSmartly V5 is coming.
            </Heading>
            <Text style={styles.lede}>
              A new agentic business operating system designed to understand your goals, coordinate
              tools and specialized agents, execute work, learn from feedback, and grow with the way
              your organization operates.
            </Text>
            {/* Wide: the argument finishes the left column, beside the form.
                Phone: it moves below the form — see `pitchDetail`. */}
            {l.isPhone ? null : pitchDetail}
          </Reveal>

          {/* The form is an interactive object, so it keeps its box (rule 15). */}
          <Reveal delay={80} style={styles.formColumn}>
            <Card style={styles.form} level={2}>
              {state.kind === 'success' ? (
                <Outcome
                  tone="good"
                  icon="circle-check"
                  title="You are on the list"
                  body="Check your inbox for a confirmation. We will email you the moment your place opens — there is nothing else to do."
                  styles={styles}
                  t={t}>
                  <ButtonRow>
                    <SecondaryButton
                      label="Explore FlowSmartly"
                      icon="arrow-right"
                      iconRight
                      onPress={() => router.push(ROUTES.product)}
                      trackId="early-access.success.explore"
                    />
                  </ButtonRow>
                </Outcome>
              ) : state.kind === 'duplicate' ? (
                <Outcome
                  tone="good"
                  icon="circle-check"
                  title="You are already on the list"
                  body={state.message}
                  styles={styles}
                  t={t}>
                  <ButtonRow>
                    <SecondaryButton
                      label="Explore FlowSmartly"
                      icon="arrow-right"
                      iconRight
                      onPress={() => router.push(ROUTES.product)}
                      trackId="early-access.duplicate.explore"
                    />
                  </ButtonRow>
                </Outcome>
              ) : (
                <>
                  <Heading level={2} style={styles.formTitle}>
                    Join early access
                  </Heading>
                  <Text style={styles.formIntro}>
                    Two required fields. The rest helps us prioritise who we open next.
                  </Text>

                  {state.kind === 'error' ? (
                    <View
                      accessibilityRole="alert"
                      style={[styles.banner, { backgroundColor: softFill(t.orange, t) }]}>
                      <FontAwesome6
                        name="triangle-exclamation"
                        size={14}
                        color={accentText(t.orange, t)}
                       aria-hidden={true}/>
                      <Text style={styles.bannerText}>{state.message}</Text>
                    </View>
                  ) : null}

                  <View style={styles.row}>
                    <Field
                      label="Your name"
                      placeholder="Alex Rivera"
                      value={fields.name}
                      onChangeText={set('name')}
                      error={errors.name}
                      required
                      inRow
                      styles={styles}
                      t={t}
                    />
                    <Field
                      label="Work email"
                      placeholder="alex@yourbusiness.com"
                      value={fields.email}
                      onChangeText={set('email')}
                      error={errors.email}
                      required
                      inRow
                      keyboardType="email-address"
                      styles={styles}
                      t={t}
                    />
                  </View>

                  <View style={styles.row}>
                    <Field
                      label="Business"
                      placeholder="Rivera Studio"
                      value={fields.company}
                      onChangeText={set('company')}
                      error={errors.company}
                      inRow
                      styles={styles}
                      t={t}
                    />
                    <Field
                      label="Phone"
                      placeholder="Optional"
                      value={fields.phone}
                      onChangeText={set('phone')}
                      error={errors.phone}
                      inRow
                      keyboardType="phone-pad"
                      styles={styles}
                      t={t}
                    />
                  </View>

                  <Field
                    label="What would you want FlowSmartly to take off your plate?"
                    placeholder="Optional — a sentence is plenty."
                    value={fields.message}
                    onChangeText={set('message')}
                    error={errors.message}
                    multiline
                    styles={styles}
                    t={t}
                  />

                  <PrimaryButton
                    label={submitting ? 'Sending…' : 'Join V5 early access'}
                    icon={submitting ? 'spinner' : 'arrow-right'}
                    iconRight
                    full
                    onPress={onSubmit}
                    accessibilityLabel="Join V5 early access"
                    trackId="early-access.submit"
                  />

                  <Text style={styles.legal}>
                    We use your details to contact you about access and to prioritise who we open
                    next. Nothing else.
                  </Text>
                </>
              )}
            </Card>
          </Reveal>

          {/* Third child, phone only — and deliberately third rather than a
              `column-reverse` on the parent: reversing would put the form's h2
              ahead of the page h1 in the reading order that assistive
              technology follows, which is a worse defect than the one being
              fixed. This is a real DOM order, so the outline stays h1 -> h2. */}
          {l.isPhone ? (
            <Reveal delay={140} style={styles.pitchDetail}>
              {pitchDetail}
            </Reveal>
          ) : null}
        </View>
      </OpenSection>

      {/* ------------------------------------------------ existing customers */}
      <Band tone="surface">
        <Reveal>
          <View style={styles.head}>
            <SectionLabel>Already with us</SectionLabel>
            <Heading level={2} style={styles.h2}>
              Existing customer? You do not need early access
            </Heading>
            <Text style={styles.body}>
              Your workspace is running as normal and your V5 upgrade comes to you. Sign in from the
              access page whenever you need it.
            </Text>
          </View>
        </Reveal>
        <Reveal delay={80}>
          <ButtonRow>
            <SecondaryButton
              label="Go to sign in"
              icon="arrow-right"
              iconRight
              onPress={() => router.push(ROUTES.login)}
              trackId="early-access.existing.sign-in"
            />
          </ButtonRow>
        </Reveal>
      </Band>

      {/* ------------------------------------------------ faq */}
      <OpenSection>
        <Reveal>
          <View style={styles.head}>
            <SectionLabel>Questions</SectionLabel>
            <Heading level={2} style={styles.h2}>
              What to expect
            </Heading>
          </View>
        </Reveal>
        <Reveal delay={80}>
          <View style={styles.faq}>
            {FAQ.map((item) => (
              <View key={item.q} style={styles.faqCell}>
                <Heading level={3} style={styles.faqQ}>
                  {item.q}
                </Heading>
                <Text style={styles.faqA}>{item.a}</Text>
              </View>
            ))}
          </View>
        </Reveal>
      </OpenSection>
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/* pieces                                                              */
/* ------------------------------------------------------------------ */

/**
 * `inRow` is load-bearing, not cosmetic: the two-up sizing (`flexBasis`) may
 * only be applied when the parent is actually laid out as a row. As a column
 * child it would size the field's *height* instead of its width.
 */
function Field({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  required,
  multiline,
  inRow,
  keyboardType,
  styles,
  t,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (next: string) => void;
  error?: string;
  required?: boolean;
  multiline?: boolean;
  inRow?: boolean;
  keyboardType?: 'email-address' | 'phone-pad';
  styles: Styles;
  t: ThemeTokens;
}) {
  const invalid = Boolean(error);
  return (
    <View style={[styles.field, inRow ? styles.fieldCell : null]}>
      <Text style={styles.fieldLabel}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.textSubtle}
        accessibilityLabel={label}
        aria-invalid={invalid}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
        style={[
          styles.input,
          multiline ? styles.inputMultiline : null,
          invalid ? { borderColor: t.orange } : null,
        ]}
      />
      {error ? (
        <Text accessibilityRole="alert" style={styles.fieldError}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** The form replaced by its result — success and duplicate both land here. */
function Outcome({
  tone,
  icon,
  title,
  body,
  styles,
  t,
  children,
}: {
  tone: 'good';
  icon: string;
  title: string;
  body: string;
  styles: Styles;
  t: ThemeTokens;
  children?: React.ReactNode;
}) {
  const color = tone === 'good' ? t.green : t.orange;
  return (
    <View accessibilityRole="alert" style={styles.outcome}>
      {/* Decoration on an alert: the tick repeats the headline that follows it,
          and this whole view is announced, so the glyph must not be. */}
      <View aria-hidden style={[styles.outcomeIcon, { backgroundColor: softFill(color, t) }]}>
        <FontAwesome6 name={icon as never} size={20} color={accentText(color, t)}  aria-hidden={true}/>
      </View>
      <Heading level={2} style={styles.outcomeTitle}>
        {title}
      </Heading>
      <Text style={styles.outcomeBody}>{body}</Text>
      {children}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* styles                                                              */
/* ------------------------------------------------------------------ */

type Styles = ReturnType<typeof createStyles>;

function createStyles(t: ThemeTokens, l: Layout, ts: TypeScale) {
  const faqColumns = l.isPhone ? 1 : 2;

  return StyleSheet.create({
    split: {
      flexDirection: l.isStacked ? 'column' : 'row',
      gap: l.isPhone ? 28 : 40,
      alignItems: 'flex-start',
    },
    pitch: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: l.isStacked ? 'auto' : '44%',
      minWidth: 0,
      gap: 14,
    },
    formColumn: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: l.isStacked ? 'auto' : '52%',
      minWidth: 0,
      alignSelf: 'stretch',
    },
    /**
     * The phone-only third child. `split` sets `alignItems: 'flex-start'`, so a
     * column child sizes to its content on the cross axis unless it says
     * otherwise — `formColumn` already stretches for the same reason. Same gap
     * rhythm as `pitch` so the paragraphs below the form sit on the same
     * vertical grid as the one above it.
     */
    pitchDetail: { alignSelf: 'stretch', minWidth: 0, gap: 14 },

    h1: { ...ts.h1, color: t.text },
    h2: { ...ts.h2, color: t.text },
    lede: { ...ts.body, color: t.textMuted },
    // "Into action." is the sentence the paragraph is built to reach, so it
    // carries the copy colour rather than the muted one around it.
    ledeLead: { color: t.text, fontWeight: '700' },
    body: { ...ts.body, color: t.textMuted },
    head: { gap: 12, maxWidth: 720, marginBottom: l.isPhone ? 20 : 28 },

    promises: { gap: 16, marginTop: 8 },
    promise: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    promiseIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    promiseCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 3 },
    promiseTitle: { ...ts.h4, color: t.text },
    promiseBody: { ...ts.bodySm, color: t.textMuted },

    form: { padding: l.isPhone ? 18 : 24, gap: 14 },
    formTitle: { ...ts.h3, color: t.text },
    formIntro: { ...ts.bodySm, color: t.textMuted },

    banner: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'flex-start',
      padding: 12,
      borderRadius: 10,
    },
    bannerText: {
      ...ts.bodySm,
      color: t.text,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
    },

    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    field: { gap: 6 },
    fieldCell: {
      flexGrow: 1,
      flexShrink: 1,
      // Just under half so the two fields still fit once the gap is counted.
      flexBasis: l.isPhone ? '100%' : cellBasis(2),
      minWidth: 0,
    },
    fieldLabel: { ...ts.bodySm, color: t.text, fontWeight: '600' },
    required: { color: t.orangeText },
    input: {
      minHeight: 44,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 10,
      backgroundColor: t.surface,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: t.text,
      fontSize: 15,
      fontFamily: FONT_SANS,
    },
    inputMultiline: {
      // An explicit height, not just minHeight: on web a multiline input
      // otherwise collapses toward one line and the fields below overlap it.
      height: 108,
      textAlignVertical: 'top',
      paddingTop: 10,
    },
    fieldError: { ...ts.caption, color: t.orangeText },
    legal: { ...ts.caption, color: t.textSubtle },

    outcome: { gap: 12, alignItems: 'flex-start', paddingVertical: 8 },
    outcomeIcon: {
      width: 52,
      height: 52,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    outcomeTitle: { ...ts.h3, color: t.text },
    outcomeBody: { ...ts.body, color: t.textMuted },

    faq: { flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
    faqCell: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: faqColumns === 1 ? '100%' : cellBasis(2),
      minWidth: 0,
      gap: 6,
    },
    faqQ: { ...ts.h4, color: t.text },
    faqA: { ...ts.bodySm, color: t.textMuted },
  });
}
