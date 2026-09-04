import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { blend, elevation, type ThemeTokens, type V5ThemeMode } from '@/theme/tokens';
import { BP, useLayout, useViewportHeight, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';
import { trackCta } from '@/lib/analytics';
import { BrandLogo } from './brand-logo';
import { ChannelMap } from './channel-map';
import { FirstRunPath } from './first-run-path';
import { HEADER_MIN_HEIGHT } from './site-header';
import { Heading, SectionLabel, useTypeScale, type TypeScale } from './ui';

/**
 * The V5 account screens, built from `design/auth-v5.html`.
 *
 * **The window is cut once, down the middle.** Every account screen is the
 * same shape: two halves of exactly equal width, each running to the edge of
 * the viewport and down the full height of the window. There is no gutter
 * between them, no inset around them and no maximum width on the split itself
 * — the seam is at 50% and nothing else decides where it falls.
 *
 * The version this replaces was *a capped column beside a flexible one*: the
 * form asked for 420 and the illustration took whatever was left, which is
 * 40/60 at 1440 and a different ratio at every other width. It looked like a
 * split from one seat. `flexBasis: 0` on both halves is the whole mechanism,
 * and it has to be written out: react-native-web's `View` base style ships
 * `flexBasis: 'auto'` and `flexShrink: 0`, so a half that only says
 * `flexGrow: 1` still sizes itself to its own contents.
 *
 * **The two halves are different surfaces**, because two equal halves painted
 * the same colour do not read as a divided page — they read as a wide page
 * with a picture in it. The form stands on the page's own ground; the
 * illustration stands on a brand wash, blue to violet along the diagonal. See
 * `asideWash` for why its strength is a per-theme number rather than one
 * constant.
 *
 * **The page is still the page.** No card, no border and no elevation around
 * either half. A form is a column of controls on the canvas: the hierarchy
 * comes from type, spacing and rhythm, and the only things that keep an edge
 * are the objects a visitor actually operates — the inputs, the buttons, the
 * framed asides. The measure survives as a cap on the content *inside* the
 * left half rather than as the width of a column, so the half stays 50% and
 * the form inside it stays readable.
 *
 * Beside it sits an illustration, and **which** illustration is the argument
 * of the screen rather than a decoration. Sign-in and its two-factor step get
 * the channel map, shared with the home page and carrying live counts: a
 * business that kept running while you were away. Create-account and the
 * verify-your-email step that follows it get a path: a business about to
 * begin. Below `BP.tablet` there is no second half at all — one column, form
 * only. 400px of illustration is not worth putting between a visitor on a
 * narrow window and the field they came for.
 *
 * **These screens have no backend.** There is no account service in this app,
 * so nothing here creates a session, mints a token, passes a human check or
 * completes an OAuth handshake. What they *do* implement is every state the
 * form can genuinely be in — empty, invalid, revealed, gated, refused —
 * because those are real and can be demonstrated honestly.
 */

/** The readable measure of a form, whatever the half around it is doing. */
const FORM_MEASURE = 460;

/**
 * The measure of the illustration column. Wider than the form's, because a
 * diagram is not read line by line — but still capped, so the channel map's
 * two clusters stay a pair rather than drifting to opposite edges of a half
 * that is 720px wide at desktop.
 */
const ASIDE_MEASURE = 560;

/* ------------------------------------------------------------------ */
/* the aside                                                           */
/* ------------------------------------------------------------------ */

/**
 * What is waiting on each channel while you were away.
 *
 * These sum to the 53 the caption claims — 12 + 4 + 7 + 23 + 5 + 2 — because a
 * caption that disagrees with the picture beside it is a bug. They are a prop
 * of the shared `ChannelMap`, not a second copy of it: the home page draws the
 * same diagram plain, because there it is about what *connects* rather than
 * about what happens to be waiting.
 */
const WAITING_COUNTS: Readonly<Record<string, number>> = {
  instagram: 12,
  facebook: 4,
  whatsapp: 7,
  email: 23,
  shopify: 5,
  gbp: 2,
};

export type AuthAside = 'waiting' | 'starting';

type AsideCopy = { label: string; lead: string; body: string; facts: { title: string; note: string }[] };

const ASIDE_COPY: Record<AuthAside, AsideCopy> = {
  waiting: {
    label: 'WHILE YOU WERE AWAY',
    lead: 'Everything kept running.',
    body: '53 things arrived while you were away, and FlowAgent prepared what it could.',
    facts: [
      { title: '53 waiting', note: 'Across six channels' },
      { title: 'Nothing sent', note: 'Not without your approval' },
      { title: 'Synced 2 min ago', note: 'Every connection live' },
    ],
  },
  starting: {
    label: 'YOUR FIRST TEN MINUTES',
    lead: 'Bring what you already use.',
    body: 'Connect a channel once and it stays connected. Start with one and add the rest whenever you like.',
    facts: [
      { title: 'Connect in a click', note: 'Secure OAuth, no password shared' },
      { title: 'Start with one', note: 'Nothing else is required' },
      { title: 'Leave anytime', note: 'Disconnect, export, done' },
    ],
  },
};

/**
 * How hard the illustration half's wash is painted, per theme — and why it is
 * not one number.
 *
 * Every value below is the strongest wash that keeps two things true at once,
 * measured on the real palettes:
 *
 *  - **the quietest ink on it still clears AA.** `textSubtle` is the floor, and
 *    in *light* it is the binding constraint: 4.61:1 at 0.11, 4.46:1 at 0.14.
 *    So light cannot go past about 0.12 whatever it would look like.
 *  - **a card on it still reads as a card.** `surfaceRaised` is barely above
 *    `background` in the two dark palettes, so a middling wash lands exactly on
 *    the channel tiles and flattens them (1.03:1 at 0.10). Pushing *past* them
 *    restores the separation with the sign reversed — dark cards on a lit panel,
 *    1.15:1 at 0.20 — which is also what the wash is for.
 *
 * The seam that results is stronger than the step this site already trusts
 * between the page and the header bar (1.08–1.10:1) in every theme: 1.17:1 in
 * light, 1.39:1 in grey, 1.33:1 in dark.
 */
const ASIDE_WASH: Record<V5ThemeMode, number> = { light: 0.11, grey: 0.2, dark: 0.2 };

/**
 * The illustration half's ground, blue to violet — the brand arc, in the
 * direction the live sign-in screen runs it.
 *
 * Opaque rather than translucent, so the half can *declare* the colour it is
 * painted: a translucent stop leaves the half's own `backgroundColor` reading
 * as the page, which is exactly the thing the split must not be.
 */
function asideWash(t: ThemeTokens): readonly [string, string] {
  const alpha = ASIDE_WASH[t.mode];
  return [blend(t.brand, t.background, alpha), blend(t.violet, t.background, alpha)];
}

type Styles = ReturnType<typeof createStyles>;

function useAuthStyles(): Styles {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  const viewport = useViewportHeight();
  return useMemo(() => createStyles(t, l, type, viewport), [t, l, type, viewport]);
}

/**
 * The half beside the form: an eyebrow chip, the drawing, a caption and three
 * facts — the same rhythm a home-page section has, so the two read as one
 * site. It carries no heading, so the form's title stays the page's only H1
 * and the split does not invent a second document outline.
 *
 * The seam is drawn as an absolutely-positioned hairline rather than a
 * `borderLeftWidth`. A border participates in flex sizing: with `flexBasis: 0`
 * and border-box sizing it makes this half exactly one pixel narrower than its
 * neighbour, which is a real defect in the one property the split exists to
 * guarantee.
 */
function AuthAsideColumn({ variant }: { variant: AuthAside }) {
  const t = useTokens();
  const styles = useAuthStyles();
  const copy = ASIDE_COPY[variant];
  const wash = useMemo(() => asideWash(t), [t]);
  return (
    <View nativeID="auth-split-aside" style={[styles.half, styles.halfAside]}>
      <LinearGradient
        colors={wash}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View pointerEvents="none" style={styles.seam} />
      <View style={styles.asideColumn}>
        <SectionLabel tone="raised">{copy.label}</SectionLabel>
        {variant === 'waiting' ? <ChannelMap counts={WAITING_COUNTS} density="aside" /> : <FirstRunPath />}
        <Text style={styles.asideCaption}>
          <Text style={styles.asideCaptionLead}>{copy.lead}</Text>
          {` ${copy.body}`}
        </Text>
        <View style={styles.asideFacts}>
          {copy.facts.map((fact) => (
            <View key={fact.title} style={styles.asideFact}>
              <Text style={styles.asideFactTitle}>{fact.title}</Text>
              <Text style={styles.asideFactNote}>{fact.note}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/**
 * The skeleton every account screen is built from — and the *only* one.
 * `/login`, `/login/code`, `/register` and `/check-email` all take this shape,
 * and so will the reset flow when it exists; a screen that arranged its own
 * would be the same defect as the two channel diagrams were, alike on the day
 * it is written and drifted on every day after. What a screen chooses is which
 * illustration the second half carries and what the copy says, never the
 * geometry.
 */
export function AuthSplit({ aside, children }: { aside: AuthAside; children: React.ReactNode }) {
  const l = useLayout();
  const styles = useAuthStyles();

  // Below `BP.tablet` a half is under 512px, which is not enough for a form
  // and a diagram to both be worth looking at. One column, form only.
  if (l.isCompact) {
    return (
      <View style={styles.stack}>
        <View style={styles.formColumn}>{children}</View>
      </View>
    );
  }

  return (
    <View nativeID="auth-split" style={styles.split}>
      <View nativeID="auth-split-form" style={styles.half}>
        <View style={styles.formColumn}>{children}</View>
      </View>
      <AuthAsideColumn variant={aside} />
    </View>
  );
}

/** The form's title and its supporting line. The title is the page's only H1. */
export function AuthTitle({ title, lede }: { title: string; lede: string }) {
  const styles = useAuthStyles();
  return (
    <>
      <Heading level={1} style={styles.formTitle}>
        {title}
      </Heading>
      <Text style={styles.formLede}>{lede}</Text>
    </>
  );
}

/** The centred icon + title + lede used by the "check your email" state. */
export function AuthSentHead({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  const t = useTokens();
  const styles = useAuthStyles();
  return (
    <View style={styles.sentHead}>
      <View style={styles.sentIcon}>
        <FontAwesome6 name={icon as never} size={22} color={t.brand} />
      </View>
      <Heading level={1} style={styles.formTitle}>
        {title}
      </Heading>
      <Text style={[styles.formLede, styles.sentLede]}>{children}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* fields                                                              */
/* ------------------------------------------------------------------ */

/**
 * `aria-describedby` and `aria-invalid` are real DOM attributes that
 * react-native-web forwards, and React Native's own prop types declare
 * neither. Building them in one place keeps the untyped surface to two lines
 * rather than an `any` at every field.
 *
 * The singular `aria-*` props are also the only ones that reach the DOM at
 * all: `accessibilityState` is in neither RNW 0.21's `forwardedProps` nor its
 * `createDOMProps`, so a control that announces its state through that object
 * announces nothing.
 */
function describedBy(ids: (string | null | undefined)[]): object {
  const list = ids.filter(Boolean).join(' ');
  return list ? { 'aria-describedby': list } : {};
}
function invalid(is: boolean): object {
  return is ? { 'aria-invalid': true } : {};
}

export type AuthFieldProps = {
  /** stable id — the error and hint ids are derived from it */
  id: string;
  label: string;
  /** the quiet requirement after the label, e.g. "— at least 8 characters" */
  requirement?: string;
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  autoComplete?: 'email' | 'current-password' | 'new-password';
  secure?: boolean;
  /**
   * The composed error. It sits against the field, it stays put, and it can
   * carry the action that fixes it — which is the whole reason this is not a
   * toast.
   */
  error?: string | null;
  errorAction?: { label: string; onPress: () => void };
  hint?: string;
  /** extra element under the field (the password rules) */
  children?: React.ReactNode;
  /** id of that element, so the input is described by it too */
  childrenId?: string;
  onSubmitEditing?: () => void;
};

export function AuthField({
  id,
  label,
  requirement,
  value,
  onChangeText,
  placeholder,
  autoComplete,
  secure,
  error,
  errorAction,
  hint,
  children,
  childrenId,
  onSubmitEditing,
}: AuthFieldProps) {
  const t = useTokens();
  const styles = useAuthStyles();
  const [revealed, setRevealed] = useState(false);
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <View style={styles.field}>
      <Text nativeID={`${id}-label`} style={styles.fieldLabel}>
        {label}
        {requirement ? <Text style={styles.fieldRequirement}>{` ${requirement}`}</Text> : null}
      </Text>
      <View style={styles.inputWrap}>
        <TextInput
          id={id}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={t.textSubtle}
          aria-label={label}
          autoCapitalize="none"
          autoCorrect={false}
          inputMode={autoComplete === 'email' ? 'email' : undefined}
          autoComplete={autoComplete}
          secureTextEntry={secure && !revealed}
          onSubmitEditing={onSubmitEditing}
          returnKeyType="go"
          style={[styles.input, secure ? styles.inputWithReveal : null, error ? styles.inputInvalid : null]}
          {...describedBy([error ? errorId : null, hint ? hintId : null, children ? childrenId : null])}
          {...invalid(!!error)}
        />
        {secure ? (
          <Pressable
            onPress={() => setRevealed((on) => !on)}
            accessibilityRole="button"
            /* The label names the state the press will produce — "Show" while
               the password is hidden — not the state the field is in. */
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            style={({ pressed }) => [styles.reveal, pressed ? styles.pressed : null]}>
            <Text style={styles.revealLabel}>{revealed ? 'Hide' : 'Show'}</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text nativeID={errorId} role="alert" style={styles.fieldError}>
          <Text style={styles.fieldErrorGlyph}>{'⚠ '}</Text>
          {error}
          {errorAction ? (
            <Text
              accessibilityRole="link"
              onPress={() => {
                trackCta(`auth.field.${id}.error-action`, { variant: 'text-link' });
                errorAction.onPress();
              }}
              style={styles.fieldErrorAction}>
              {` ${errorAction.label}`}
            </Text>
          ) : null}
        </Text>
      ) : null}
      {hint ? (
        <Text nativeID={hintId} style={styles.fieldHint}>
          {hint}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* the one-time code                                                   */
/* ------------------------------------------------------------------ */

export const CODE_LENGTH = 6;

/**
 * Six boxes that behave like one field.
 *
 * `maxLength={1}` is deliberately **not** set: it would truncate a pasted code
 * to its first digit, and "paste the whole code and it will fill every box" is
 * the promise the hint under this makes. Each box therefore takes whatever
 * arrives, keeps its own digit and spills the rest into the boxes after it.
 */
export function AuthCodeRow({
  id,
  label,
  digits,
  onChange,
  hint,
  error,
}: {
  id: string;
  label: string;
  digits: string[];
  onChange: (next: string[]) => void;
  hint?: string;
  error?: string | null;
}) {
  const t = useTokens();
  const styles = useAuthStyles();
  const boxes = useRef<(TextInput | null)[]>([]);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const spill = (index: number, raw: string) => {
    const typed = raw.replace(/[^0-9]/g, '');
    const next = [...digits];
    if (!typed) {
      next[index] = '';
      onChange(next);
      return;
    }
    for (let i = 0; i < typed.length && index + i < CODE_LENGTH; i += 1) {
      next[index + i] = typed[i];
    }
    onChange(next);
    const landed = Math.min(index + typed.length, CODE_LENGTH - 1);
    boxes.current[landed]?.focus();
  };

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View
        style={styles.codeRow}
        role="group"
        aria-label={`${label}, ${CODE_LENGTH} digits`}
        {...describedBy([error ? errorId : null, hint ? hintId : null])}>
        {digits.map((digit, index) => (
          <TextInput
            // The boxes are positional and never reordered, so the index is
            // the stable identity here.
            key={index}
            ref={(node) => {
              boxes.current[index] = node;
            }}
            id={index === 0 ? id : `${id}-${index + 1}`}
            value={digit}
            onChangeText={(raw) => spill(index, raw)}
            onKeyPress={({ nativeEvent }) => {
              if (nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
                boxes.current[index - 1]?.focus();
              }
            }}
            aria-label={`Digit ${index + 1} of ${CODE_LENGTH}`}
            inputMode="numeric"
            keyboardType="number-pad"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            selectTextOnFocus
            placeholderTextColor={t.textSubtle}
            style={[styles.input, styles.codeBox, error ? styles.inputInvalid : null]}
            {...invalid(!!error)}
          />
        ))}
      </View>
      {error ? (
        <Text nativeID={errorId} role="alert" style={styles.fieldError}>
          <Text style={styles.fieldErrorGlyph}>{'⚠ '}</Text>
          {error}
        </Text>
      ) : null}
      {hint ? (
        <Text nativeID={hintId} style={styles.fieldHint}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* password rules                                                      */
/* ------------------------------------------------------------------ */

export type PasswordRule = { label: string; ok: boolean };

/**
 * The four rules the create-account button is actually gated on — rendered
 * *and* enforced. Ticks on screen that nothing consults are the legacy defect
 * this replaces.
 */
export function passwordRules(value: string): PasswordRule[] {
  return [
    { label: '8 characters or more', ok: value.length >= 8 },
    { label: 'A lowercase letter', ok: /[a-z]/.test(value) },
    { label: 'An uppercase letter', ok: /[A-Z]/.test(value) },
    { label: 'A number', ok: /[0-9]/.test(value) },
  ];
}

export function PasswordRules({ id, rules }: { id: string; rules: PasswordRule[] }) {
  const t = useTokens();
  const styles = useAuthStyles();
  const met = rules.filter((rule) => rule.ok).length;
  return (
    <View
      nativeID={id}
      style={styles.rules}
      aria-live="polite"
      aria-label={`Password requirements: ${met} of ${rules.length} met`}>
      {rules.map((rule) => (
        <View key={rule.label} style={styles.rule}>
          <View style={[styles.ruleBox, rule.ok ? styles.ruleBoxOk : null]}>
            {rule.ok ? <FontAwesome6 name="check" size={8} color={t.successText} /> : null}
          </View>
          <Text numberOfLines={1} style={[styles.ruleLabel, rule.ok ? styles.ruleLabelOk : null]}>
            {rule.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* the human check                                                     */
/* ------------------------------------------------------------------ */

/**
 * Where the human check goes.
 *
 * The design puts a challenge widget here and gates the submit on it. There is
 * no challenge in this app, and a green tick reading "verified you are human"
 * over nothing is a lie about a security control — so the slot says what it is
 * instead, and the button stays live so the rest of the form can still be
 * exercised. Wiring a real provider replaces this component; it does not
 * decorate it.
 */
export function HumanCheckSlot() {
  const t = useTokens();
  const styles = useAuthStyles();
  return (
    <View style={styles.check}>
      <FontAwesome6 name="shield-halved" size={16} color={t.textSubtle} />
      <View style={styles.checkCopy}>
        <Text style={styles.checkTitle}>Human check</Text>
        <Text style={styles.checkNote}>
          A challenge runs here and holds the button until it passes. Nothing is connected on this site, so nothing has
          been verified.
        </Text>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* the form-level answer                                               */
/* ------------------------------------------------------------------ */

export type AuthNotice = { title: string; body: string; action?: { label: string; onPress: () => void } };

/**
 * The form-level answer, composed the same way the field error is: it stays on
 * screen, it is announced, and it carries an action that goes somewhere real.
 * A toast that disappears and is tied to nothing is what this replaces.
 */
export function AuthNoticeBox({ notice, id }: { notice: AuthNotice; id: string }) {
  const t = useTokens();
  const styles = useAuthStyles();
  const action = notice.action;
  return (
    <View nativeID={id} role="alert" style={styles.notice}>
      <FontAwesome6 name="circle-info" size={15} color={t.textMuted} />
      <View style={styles.noticeCopy}>
        <Text style={styles.noticeTitle}>{notice.title}</Text>
        <Text style={styles.noticeBody}>{notice.body}</Text>
        {action ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={action.label}
            onPress={() => {
              trackCta(`auth.notice.${id}`, { variant: 'text-link' });
              action.onPress();
            }}
            style={({ pressed }) => [styles.noticeAction, pressed ? styles.pressed : null]}>
            <Text style={styles.noticeActionLabel}>{action.label}</Text>
            <FontAwesome6 name="arrow-right" size={11} color={t.brand} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* submit, divider, socials, footers                                   */
/* ------------------------------------------------------------------ */

export function AuthSubmit({
  label,
  onPress,
  disabled,
  trackId,
  describedByIds,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  trackId: string;
  /** ids of anything explaining why the button is in the state it is in */
  describedByIds?: (string | null | undefined)[];
}) {
  const t = useTokens();
  const styles = useAuthStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      // Singular `aria-disabled`, with no `accessibilityState` beside it:
      // RNW 0.21 carries that object in neither `forwardedProps` nor
      // `createDOMProps`, so a state announced only through it is announced to
      // nobody.
      aria-disabled={!!disabled}
      disabled={disabled}
      onPress={() => {
        trackCta(trackId, { variant: 'primary' });
        onPress();
      }}
      {...describedBy(describedByIds ?? [])}
      style={({ pressed }) => [
        styles.submit,
        disabled ? styles.submitDisabled : null,
        pressed && !disabled ? styles.pressed : null,
      ]}>
      <LinearGradient
        colors={[t.gradient[0], t.gradient[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.submitFill}>
        <Text style={styles.submitLabel}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

/** The quiet button — "Resend the link". Never the page's main action. */
export function AuthSecondary({ label, onPress, trackId }: { label: string; onPress: () => void; trackId: string }) {
  const styles = useAuthStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        trackCta(trackId, { variant: 'secondary' });
        onPress();
      }}
      style={({ pressed }) => [styles.ghost, pressed ? styles.pressed : null]}>
      <Text style={styles.ghostLabel}>{label}</Text>
    </Pressable>
  );
}

export function OrDivider() {
  const styles = useAuthStyles();
  return (
    <View style={styles.or} aria-hidden>
      <View style={styles.orRule} />
      <Text style={styles.orLabel}>or</Text>
      <View style={styles.orRule} />
    </View>
  );
}

/**
 * Google and Facebook — the two providers the design shows, and presentation
 * only. Pressing one cannot start a handshake that nothing in this app can
 * finish, so it says so rather than opening a window at a provider.
 */
export function SocialRow({ onUnavailable, context }: { onUnavailable: (provider: string) => void; context: string }) {
  const l = useLayout();
  const styles = useAuthStyles();
  const stacked = l.isPhone;
  const providers = [
    { key: 'Google', brand: 'google' },
    { key: 'Facebook', brand: 'facebook' },
  ];
  return (
    <View style={styles.socials}>
      {providers.map((provider) => (
        <Pressable
          key={provider.key}
          accessibilityRole="button"
          accessibilityLabel={`Continue with ${provider.key}`}
          onPress={() => {
            trackCta(`${context}.social.${provider.key.toLowerCase()}`, { variant: 'secondary' });
            onUnavailable(provider.key);
          }}
          style={({ pressed }) => [styles.social, pressed ? styles.pressed : null]}>
          <BrandLogo name={provider.brand} size={17} label={provider.key} />
          <Text numberOfLines={1} style={styles.socialLabel}>
            {stacked ? `Continue with ${provider.key}` : provider.key}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** The line that closes a form — "New here? Create an account". */
export function AuthFoot({
  question,
  label,
  onPress,
  trackId,
}: {
  question: string;
  label: string;
  onPress: () => void;
  trackId: string;
}) {
  const styles = useAuthStyles();
  return (
    <Text style={styles.foot}>
      {`${question} `}
      <Text
        accessibilityRole="link"
        onPress={() => {
          trackCta(trackId, { variant: 'text-link' });
          onPress();
        }}
        style={styles.footLink}>
        {label}
      </Text>
    </Text>
  );
}

export function AuthBackLink({ label, onPress, trackId }: { label: string; onPress: () => void; trackId: string }) {
  const t = useTokens();
  const styles = useAuthStyles();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => {
        trackCta(trackId, { variant: 'text-link' });
        onPress();
      }}
      style={({ pressed }) => [styles.backLink, pressed ? styles.pressed : null]}>
      <FontAwesome6 name="arrow-left" size={12} color={t.textMuted} />
      <Text style={styles.backLinkLabel}>{label}</Text>
    </Pressable>
  );
}

/** The legal line under create-account. Both routes exist. */
export function AuthLegal({ onTerms, onPrivacy }: { onTerms: () => void; onPrivacy: () => void }) {
  const styles = useAuthStyles();
  return (
    <Text style={styles.legal}>
      {'By creating an account you agree to the '}
      <Text accessibilityRole="link" onPress={onTerms} style={styles.legalLink}>
        Terms
      </Text>
      {' and the '}
      <Text accessibilityRole="link" onPress={onPrivacy} style={styles.legalLink}>
        Privacy Policy
      </Text>
      .
    </Text>
  );
}

/** A quiet framed aside under a form — the "verify first" note. */
export function AuthCallout({ icon, children }: { icon: string; children: React.ReactNode }) {
  const t = useTokens();
  const styles = useAuthStyles();
  return (
    <View style={styles.callout}>
      <FontAwesome6 name={icon as never} size={14} color={t.textMuted} />
      <Text style={styles.calloutText}>{children}</Text>
    </View>
  );
}

export function AuthCalloutLead({ children }: { children: React.ReactNode }) {
  const styles = useAuthStyles();
  return <Text style={styles.calloutLead}>{children}</Text>;
}

/* ------------------------------------------------------------------ */
/* validation                                                          */
/* ------------------------------------------------------------------ */

/** Deliberately permissive: it rejects only what is definitely not an address. */
export function emailError(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return 'Enter the email address for your account.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) return 'That does not look like an email address.';
  return null;
}

/* ------------------------------------------------------------------ */
/* styles                                                              */
/* ------------------------------------------------------------------ */

function createStyles(t: ThemeTokens, l: Layout, type: TypeScale, viewport: number) {
  /**
   * How far the split has to escape the page column to reach the viewport
   * edge. `PageShell` caps its content at `BP.maxContent` and centres it, so
   * above that width a split that simply filled its parent would stop at 1536
   * and the two halves would be a very wide card — and the seam would no
   * longer be at the middle of the *window*, which is the thing being built.
   * Below it the column already is the viewport and the answer is zero.
   */
  const bleed = Math.max(0, Math.round((l.width - BP.maxContent) / 2));

  /**
   * The seam runs the full window, so the shortest screen — `/check-email`,
   * which is an icon, two lines and a button — divides the page exactly as the
   * longest one does. Anything taller than the window simply grows.
   */
  const fill = Math.max(0, viewport - HEADER_MIN_HEIGHT);

  return StyleSheet.create({
    /**
     * The cut. No `maxWidth`, no horizontal padding and no gap: the gutter each
     * half needs is padding *inside* that half, where it does not move the
     * seam.
     */
    split: {
      flexDirection: 'row',
      alignItems: 'stretch',
      marginHorizontal: -bleed,
      minHeight: fill,
    },
    /**
     * One half.
     *
     * `flexBasis: 0` is the load-bearing line, and it is written out on
     * purpose: react-native-web's `View` base style ships `flexBasis: 'auto'`
     * and `flexShrink: 0`, so a half that only grows is still sized by its own
     * contents first — which silently produces 40/60 with every other property
     * here correct.
     */
    half: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minWidth: 0,
      justifyContent: 'center',
      paddingHorizontal: l.gutter,
      paddingVertical: l.sectionSpace,
      // Declared rather than inherited: this half's ground is the page, and
      // the half beside it is not, so both say which one they are.
      backgroundColor: t.background,
    },
    /** The illustration half's declared ground — see `asideWash`. */
    halfAside: { position: 'relative', backgroundColor: asideWash(t)[0], overflow: 'hidden' },
    seam: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 1, backgroundColor: t.border },

    /** Below `BP.tablet`: one column, the same rhythm every open section has. */
    stack: { paddingHorizontal: l.gutter, paddingVertical: l.sectionSpace },

    /**
     * Capped rather than stretched, and centred in its half. A 700px-wide text
     * input is not a better input than a 460px one — the measure is what keeps
     * the form reading as a column of controls rather than a band. It is a cap
     * on the *content* now, not the width of the column it sits in: the column
     * is half the window.
     */
    formColumn: { width: '100%', maxWidth: FORM_MEASURE, alignSelf: 'center' },

    /**
     * Stretched, not centred, *within* its own measure. Centring made every
     * child hug its own content, so the drawing measured ~520px while the
     * facts rule under it spanned the full column — two different left edges
     * in one column. Everything now shares the eyebrow chip's edge, which is
     * the rhythm a home-page section has.
     */
    asideColumn: { width: '100%', maxWidth: ASIDE_MEASURE, alignSelf: 'center', alignItems: 'stretch', gap: 22 },
    asideCaption: { ...type.bodySm, color: t.textSubtle },
    asideCaptionLead: { color: t.text, fontWeight: '800' },
    asideFacts: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      gap: 14,
      paddingTop: 18,
      borderTopWidth: 1,
      /**
       * `divider` is a tint of the page and vanishes on the wash — 1.02:1 in
       * dark. `borderStrong` is the rule that survives its own background.
       */
      borderTopColor: t.borderStrong,
    },
    asideFact: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    asideFactTitle: { fontSize: 13, lineHeight: 18, fontWeight: '800', color: t.text },
    asideFactNote: { fontSize: 11.5, lineHeight: 16, color: t.textSubtle, marginTop: 2 },

    pressed: { opacity: 0.78 },

    formTitle: { ...type.h2 },
    formLede: { ...type.body, color: t.textMuted, marginTop: 10 },

    sentHead: { alignItems: 'center' },
    sentLede: { textAlign: 'center' },
    sentIcon: {
      width: 56,
      height: 56,
      borderRadius: 18,
      backgroundColor: t.brandSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },

    /* ---- fields ---- */
    field: { marginTop: 20 },
    fieldLabel: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: t.text, marginBottom: 7 },
    fieldRequirement: { color: t.textSubtle, fontWeight: '600' },
    inputWrap: { position: 'relative', justifyContent: 'center' },
    input: {
      minHeight: 50,
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 11,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 14,
      paddingVertical: 13,
      color: t.text,
      fontSize: 15,
    },
    inputWithReveal: { paddingRight: 66 },
    inputInvalid: { borderColor: t.pink },
    /* Six boxes that read as one field. `flexBasis: 0` shares the row evenly,
       so the group is the same width as every other input above it. */
    codeRow: { flexDirection: 'row', gap: l.isPhone ? 7 : 9 },
    codeBox: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minWidth: 0,
      minHeight: 56,
      paddingHorizontal: 0,
      textAlign: 'center',
      fontSize: 19,
      fontWeight: '800',
      letterSpacing: 1,
    },
    reveal: {
      position: 'absolute',
      right: 3,
      minWidth: 58,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 9,
    },
    revealLabel: { fontSize: 12.5, lineHeight: 17, fontWeight: '700', color: t.textMuted },
    fieldError: { fontSize: 12.5, lineHeight: 18, color: t.pink, marginTop: 7 },
    fieldErrorGlyph: { fontWeight: '800' },
    fieldErrorAction: { color: t.pink, fontWeight: '800', textDecorationLine: 'underline' },
    fieldHint: { fontSize: 12.5, lineHeight: 18, color: t.textSubtle, marginTop: 7 },

    /* ---- password rules ---- */
    rules: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, rowGap: 8 },
    rule: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '50%', paddingRight: 6, minWidth: 0 },
    ruleBox: {
      width: 16,
      height: 16,
      borderRadius: 5,
      borderWidth: 1,
      borderColor: t.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
      flexGrow: 0,
      flexShrink: 0,
      flexBasis: 'auto',
    },
    ruleBoxOk: { backgroundColor: t.successBg, borderColor: t.successText },
    ruleLabel: {
      fontSize: 12,
      lineHeight: 16,
      color: t.textSubtle,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
    },
    ruleLabelOk: { color: t.successText },

    /* ---- human check ---- */
    check: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 11,
      marginTop: 22,
      paddingHorizontal: 13,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 11,
      backgroundColor: t.surfaceMuted,
    },
    checkCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 3 },
    checkTitle: { fontSize: 12.5, lineHeight: 17, fontWeight: '800', color: t.text },
    checkNote: { fontSize: 11.5, lineHeight: 16, color: t.textSubtle },

    /* ---- notice ---- */
    notice: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 11,
      marginTop: 18,
      paddingHorizontal: 13,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceMuted,
    },
    noticeCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 3 },
    noticeTitle: { fontSize: 12.5, lineHeight: 17, fontWeight: '800', color: t.text },
    noticeBody: { fontSize: 12, lineHeight: 17, color: t.textMuted },
    noticeAction: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 44, alignSelf: 'flex-start' },
    noticeActionLabel: { fontSize: 12.5, lineHeight: 17, fontWeight: '800', color: t.brand },

    /* ---- callout ---- */
    callout: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      marginTop: 18,
      paddingHorizontal: 13,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceMuted,
    },
    calloutText: {
      fontSize: 12,
      lineHeight: 17,
      color: t.textMuted,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
    },
    calloutLead: { color: t.text, fontWeight: '800' },

    /* ---- submit ---- */
    submit: { marginTop: 22, borderRadius: 12, overflow: 'hidden', ...(elevation(t, 1) as object) },
    submitDisabled: { opacity: 0.5 },
    submitFill: { minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
    submitLabel: { fontSize: 15, lineHeight: 20, fontWeight: '800', color: t.textOnBrand },
    ghost: {
      marginTop: 22,
      minHeight: 52,
      maxWidth: 290,
      width: '100%',
      alignSelf: 'center',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 18,
    },
    ghostLabel: { fontSize: 15, lineHeight: 20, fontWeight: '800', color: t.text },

    /* ---- divider + socials ---- */
    or: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 24 },
    orRule: { height: 1, flexGrow: 1, flexShrink: 1, flexBasis: 0, backgroundColor: t.divider },
    orLabel: { fontSize: 12, lineHeight: 16, color: t.textSubtle },
    socials: { flexDirection: l.isPhone ? 'column' : 'row', gap: 10, marginTop: 14 },
    social: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: l.isPhone ? 'auto' : 0,
      minWidth: 0,
      minHeight: 50,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 9,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 11,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
    },
    socialLabel: { fontSize: 13.5, lineHeight: 18, fontWeight: '700', color: t.text },

    /* ---- footers ---- */
    foot: { fontSize: 13, lineHeight: 20, color: t.textMuted, marginTop: 22, textAlign: 'center' },
    footLink: { color: t.brand, fontWeight: '800' },
    backLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 44,
      alignSelf: 'flex-start',
      marginBottom: 4,
    },
    backLinkLabel: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: t.textMuted },
    legal: { fontSize: 11.5, lineHeight: 17, color: t.textSubtle, marginTop: 16 },
    legalLink: { color: t.textMuted, fontWeight: '700', textDecorationLine: 'underline' },
  });
}
