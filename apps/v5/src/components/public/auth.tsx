import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native';
import { elevation, hexToRgba, softFill, type ThemeTokens } from '@/theme/tokens';
import { useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';
import { trackCta } from '@/lib/analytics';
import { BrandLogo } from './brand-logo';
import { Connectors, ConnectorSurface, useConnectorField, type ConnectorField, type Link } from './connectors';
import { ImageAsset } from './media';
import { Heading, useTypeScale, type TypeScale } from './ui';

/**
 * The V5 account screens, built from `design/auth-v5.html`.
 *
 * Every screen is the same split — the form card, and a brand panel beside it
 * that disappears when the layout stacks. The card never changes shape, which
 * is the point: there is one form, laid out once, not a desktop form and a
 * separate phone form.
 *
 * **These screens have no backend.** There is no account service in this app,
 * so nothing here creates a session, mints a token, passes a human check or
 * completes an OAuth handshake. What they *do* implement is every state the
 * form can genuinely be in — empty, invalid, revealed, gated, refused —
 * because those are real and can be demonstrated honestly. A screen that faked
 * the rest would be worth less than one that says what it is.
 */

/* ------------------------------------------------------------------ */
/* the brand panel                                                     */
/* ------------------------------------------------------------------ */

type PanelTile = {
  key: string;
  /** brand key for `BrandLogo` — a real mark, never a drawn look-alike */
  brand?: string;
  /** FontAwesome6 glyph, for the channels that are not a third-party brand */
  icon?: string;
  label: string;
  /** how many things are waiting on this channel */
  badge?: number;
  /** already connected — the state the create-account panel is telling */
  connected?: boolean;
  /** the "and the rest" tile: dashed, and deliberately not a brand */
  more?: boolean;
};

type PanelGroup = { key: string; name: string; accent: 'brand' | 'orange'; tiles: PanelTile[] };

/**
 * The sign-in panel: every channel, each carrying what arrived while you were
 * away. The badges sum to the 53 the caption claims — 12 + 4 + 7 + 23 + 5 + 2 —
 * because a caption that disagrees with the picture beside it is a bug.
 */
const WAITING: PanelGroup[] = [
  {
    key: 'social',
    name: 'Social',
    accent: 'brand',
    tiles: [
      { key: 'instagram', brand: 'instagram', label: 'Instagram', badge: 12 },
      { key: 'facebook', brand: 'facebook', label: 'Facebook', badge: 4 },
      { key: 'tiktok', brand: 'tiktok', label: 'TikTok' },
    ],
  },
  {
    key: 'messaging',
    name: 'Messaging',
    accent: 'brand',
    tiles: [
      { key: 'whatsapp', brand: 'whatsapp', label: 'WhatsApp', badge: 7 },
      { key: 'email', icon: 'envelope', label: 'Email', badge: 23 },
      { key: 'sms', icon: 'comment-dots', label: 'SMS' },
    ],
  },
  {
    key: 'commerce',
    name: 'Commerce',
    accent: 'orange',
    tiles: [
      { key: 'stripe', brand: 'stripe', label: 'Stripe' },
      { key: 'shopify', brand: 'shopify', label: 'Shopify', badge: 5 },
    ],
  },
  {
    key: 'local',
    name: 'Local',
    accent: 'brand',
    tiles: [
      { key: 'gbp', brand: 'google', label: 'Google Business', badge: 2 },
      { key: 'applemaps', brand: 'apple', label: 'Apple Maps' },
    ],
  },
  {
    key: 'content',
    name: 'Content',
    accent: 'brand',
    tiles: [
      { key: 'youtube', brand: 'youtube', label: 'YouTube' },
      { key: 'wordpress', brand: 'wordpress', label: 'WordPress' },
      { key: 'mailchimp', brand: 'mailchimp', label: 'Mailchimp' },
    ],
  },
];

/**
 * The create-account panel: one tile per cluster, one of them already
 * connected. It tells the opposite story to the sign-in panel — start with
 * one, add the rest whenever you like — so a full grid here would contradict
 * the copy underneath it.
 */
const STARTING: PanelGroup[] = [
  {
    key: 'social',
    name: 'Social',
    accent: 'brand',
    tiles: [{ key: 'tiktok', brand: 'tiktok', label: 'TikTok', connected: true }],
  },
  { key: 'messaging', name: 'Messaging', accent: 'brand', tiles: [{ key: 'sms', icon: 'comment-dots', label: 'SMS' }] },
  { key: 'commerce', name: 'Commerce', accent: 'orange', tiles: [{ key: 'shopify', brand: 'shopify', label: 'Shopify' }] },
  { key: 'local', name: 'Local', accent: 'brand', tiles: [{ key: 'applemaps', brand: 'apple', label: 'Apple Maps' }] },
  { key: 'content', name: 'Content', accent: 'brand', tiles: [{ key: 'more', icon: 'ellipsis', label: '40+ more', more: true }] },
];

export type AuthPanelVariant = 'waiting' | 'starting';

type PanelCopy = { lead: string; body: string; features: { title: string; note: string }[] };

const PANEL_COPY: Record<AuthPanelVariant, PanelCopy> = {
  waiting: {
    lead: 'Everything kept running.',
    body: '53 things arrived while you were away, and FlowAgent prepared what it could.',
    features: [
      { title: '53 waiting', note: 'Across six channels' },
      { title: 'Nothing sent', note: 'Not without your approval' },
      { title: 'Synced 2 min ago', note: 'Every connection live' },
    ],
  },
  starting: {
    lead: 'Bring what you already use.',
    body: 'Connect a channel once and it stays connected. Start with one and add the rest whenever you like.',
    features: [
      { title: 'Connect in a click', note: 'Secure OAuth, no password shared' },
      { title: 'Start with one', note: 'Nothing else is required' },
      { title: 'Leave anytime', note: 'Disconnect, export, done' },
    ],
  },
};

/**
 * Which tiles the hub visibly wires up — the same rule the home page's channel
 * map uses. A wire is only drawn where it has a clear run, so a cluster beside
 * the hub wires its *near* tile and the bottom row is bracketed by its outer
 * two. A line to a far tile disappears behind its neighbour and leaves the end
 * dot stranded in the gap.
 */
function panelLinks(variant: AuthPanelVariant, t: ThemeTokens): Link[] {
  const blue = t.brand;
  if (variant === 'starting') {
    return [
      { from: 'hub', to: 'tiktok', color: blue },
      { from: 'hub', to: 'sms', color: blue },
      { from: 'hub', to: 'shopify', color: t.orange },
      { from: 'hub', to: 'applemaps', color: blue },
      { from: 'hub', to: 'more', color: blue },
    ];
  }
  return [
    { from: 'hub', to: 'instagram', color: blue },
    { from: 'hub', to: 'facebook', color: blue },
    { from: 'hub', to: 'tiktok', color: blue },
    { from: 'hub', to: 'whatsapp', color: blue },
    { from: 'hub', to: 'email', color: blue },
    { from: 'hub', to: 'sms', color: blue },
    { from: 'hub', to: 'shopify', color: t.orange },
    { from: 'hub', to: 'gbp', color: blue },
    { from: 'hub', to: 'youtube', color: blue },
    { from: 'hub', to: 'mailchimp', color: blue },
  ];
}

type Styles = ReturnType<typeof createStyles>;

function useAuthStyles(): Styles {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  return useMemo(() => createStyles(t, l, type), [t, l, type]);
}

function Tile({ tile, field, styles, t }: { tile: PanelTile; field: ConnectorField; styles: Styles; t: ThemeTokens }) {
  return (
    <View
      {...field.node(tile.key)}
      style={[styles.tile, tile.connected ? styles.tileConnected : null, tile.more ? styles.tileMore : null]}>
      {tile.badge !== undefined ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{tile.badge}</Text>
        </View>
      ) : null}
      {tile.connected ? (
        <View style={[styles.badge, styles.badgeConnected]}>
          <FontAwesome6 name="check" size={9} color={t.textOnBrand} />
        </View>
      ) : null}
      {tile.brand ? (
        <BrandLogo name={tile.brand} size={20} label={tile.label} />
      ) : (
        <FontAwesome6 name={(tile.icon ?? 'circle-nodes') as never} size={20} color={tile.more ? t.textSubtle : t.brand} />
      )}
      <Text numberOfLines={2} style={styles.tileLabel}>
        {tile.label}
      </Text>
    </View>
  );
}

function Group({ group, field, styles, t }: { group: PanelGroup; field: ConnectorField; styles: Styles; t: ThemeTokens }) {
  const accent = group.accent === 'orange' ? t.orange : t.chipText;
  const chipBg = group.accent === 'orange' ? softFill(t.orange, t) : t.chipBg;
  return (
    <View style={styles.group}>
      <View style={[styles.groupChip, { backgroundColor: chipBg }]}>
        <Text style={[styles.groupChipText, { color: accent }]}>{group.name}</Text>
      </View>
      <View style={styles.groupTiles}>
        {group.tiles.map((tile) => (
          <Tile key={tile.key} tile={tile} field={field} styles={styles} t={t} />
        ))}
      </View>
    </View>
  );
}

/**
 * The panel beside the form. It is a drawing plus a caption — never a heading,
 * so the card's title stays the page's only H1 and the split does not invent a
 * second document outline beside the one the form already has.
 */
function AuthPanel({ variant, styles, t }: { variant: AuthPanelVariant; styles: Styles; t: ThemeTokens }) {
  const field = useConnectorField();
  const links = useMemo(() => panelLinks(variant, t), [variant, t]);
  const groups = variant === 'starting' ? STARTING : WAITING;
  const [social, messaging, commerce, local, content] = groups;
  const copy = PANEL_COPY[variant];

  return (
    <View style={styles.panel}>
      <LinearGradient
        pointerEvents="none"
        colors={[t.brandSoft, hexToRgba(t.brandSoft, 0)]}
        start={{ x: 0.72, y: 0 }}
        end={{ x: 0.25, y: 0.7 }}
        style={StyleSheet.absoluteFill as ViewStyle}
      />
      {/* No transform between this surface and the tiles it measures: the
          overlay reads getBoundingClientRect, so a reveal or a scale here
          would leave every wire pointing at where a tile used to be. */}
      <ConnectorSurface field={field} style={styles.diagram}>
        <Connectors field={field} links={links} color={t.brand} circular={['hub']} strokeWidth={1.6} dash="0.5 6" flow />
        <View style={styles.diagramRow}>
          <Group group={social} field={field} styles={styles} t={t} />
          <Group group={messaging} field={field} styles={styles} t={t} />
        </View>
        <View style={styles.diagramRowMiddle}>
          <Group group={commerce} field={field} styles={styles} t={t} />
          <View {...field.node('hub')} style={styles.hub}>
            <ImageAsset
              source={require('../../../assets/images/v5/flowsmartly-mark.png')}
              style={styles.hubMark}
              contentFit="contain"
              alt="FlowSmartly"
            />
          </View>
          <Group group={local} field={field} styles={styles} t={t} />
        </View>
        <View style={styles.diagramRowBottom}>
          <Group group={content} field={field} styles={styles} t={t} />
        </View>
      </ConnectorSurface>

      <Text style={styles.panelCaption}>
        <Text style={styles.panelCaptionLead}>{copy.lead}</Text>
        {` ${copy.body}`}
      </Text>
      <View style={styles.panelFeatures}>
        {copy.features.map((feature) => (
          <View key={feature.title} style={styles.panelFeature}>
            <Text style={styles.panelFeatureTitle}>{feature.title}</Text>
            <Text style={styles.panelFeatureNote}>{feature.note}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* the split                                                           */
/* ------------------------------------------------------------------ */

/**
 * Card on the left, brand panel on the right — and below `BP.split` the panel
 * is not rendered at all. It is decoration: dropping it costs nothing, while
 * stacking it above the form would put 400px of illustration between a visitor
 * and the field they came for.
 */
export function AuthSplit({ panel, children }: { panel: AuthPanelVariant; children: React.ReactNode }) {
  const t = useTokens();
  const l = useLayout();
  const styles = useAuthStyles();

  return (
    <View style={styles.page}>
      <View style={styles.split}>
        <View style={styles.card}>
          <View style={styles.cardInner}>{children}</View>
        </View>
        {l.isStacked ? null : <AuthPanel variant={panel} styles={styles} t={t} />}
      </View>
    </View>
  );
}

/** Card title and its supporting line. The title is the page's only H1. */
export function AuthTitle({ title, lede }: { title: string; lede: string }) {
  const styles = useAuthStyles();
  return (
    <>
      <Heading level={1} style={styles.cardTitle}>
        {title}
      </Heading>
      <Text style={styles.cardLede}>{lede}</Text>
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
      <Heading level={1} style={styles.cardTitle}>
        {title}
      </Heading>
      <Text style={[styles.cardLede, styles.sentLede]}>{children}</Text>
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
      accessibilityState={{ disabled: !!disabled }}
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
export function AuthSecondary({
  label,
  onPress,
  trackId,
}: {
  label: string;
  onPress: () => void;
  trackId: string;
}) {
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
export function SocialRow({
  onUnavailable,
  context,
}: {
  onUnavailable: (provider: string) => void;
  context: string;
}) {
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

/** The line that closes a card — "New here? Create an account". */
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

/** A quiet framed aside under a card — the "verify first" note. */
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

function createStyles(t: ThemeTokens, l: Layout, type: TypeScale) {
  const tile = l.isDesktop ? 76 : 68;
  const hub = l.isDesktop ? 92 : 82;
  const cardPad = l.isPhone ? 20 : l.isTablet ? 28 : 40;

  return StyleSheet.create({
    page: { paddingHorizontal: l.gutter, paddingVertical: l.sectionSpace },
    split: {
      flexDirection: 'row',
      alignItems: 'stretch',
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: l.radius,
      overflow: 'hidden',
      backgroundColor: t.surface,
      ...(elevation(t, 1) as object),
    },
    pressed: { opacity: 0.78 },

    /* ---- card ---- */
    card: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: l.isStacked ? 'auto' : '46%',
      minWidth: 0,
      backgroundColor: t.surface,
      paddingHorizontal: cardPad,
      paddingVertical: l.isPhone ? 26 : cardPad,
      justifyContent: 'center',
    },
    cardInner: { width: '100%', maxWidth: 390, alignSelf: 'center' },
    cardTitle: { ...type.h3 },
    cardLede: { ...type.bodySm, color: t.textMuted, marginTop: 8 },

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

    /* ---- panel ---- */
    panel: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: '54%',
      minWidth: 0,
      borderLeftWidth: 1,
      borderLeftColor: t.border,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: 26,
      paddingTop: 30,
      paddingBottom: 24,
      justifyContent: 'space-between',
      gap: 14,
    },
    diagram: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      justifyContent: 'space-between',
      gap: 16,
      paddingBottom: 6,
    },
    diagramRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
    diagramRowMiddle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
    diagramRowBottom: { alignItems: 'center' },
    group: { alignItems: 'center', gap: 7, minWidth: 0 },
    groupChip: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
    groupChipText: { fontSize: 11, lineHeight: 15, fontWeight: '800', letterSpacing: 0.3 },
    groupTiles: { flexDirection: 'row', gap: 8, justifyContent: 'center', flexWrap: 'wrap' },
    tile: {
      position: 'relative',
      width: tile,
      paddingVertical: 10,
      paddingHorizontal: 5,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceRaised,
      alignItems: 'center',
      gap: 6,
    },
    tileConnected: { borderColor: t.green },
    tileMore: { borderStyle: 'dashed', borderColor: t.borderStrong, backgroundColor: t.surfaceMuted },
    tileLabel: { fontSize: 11, lineHeight: 14, fontWeight: '700', color: t.textMuted, textAlign: 'center' },
    badge: {
      position: 'absolute',
      top: -7,
      right: -7,
      zIndex: 2,
      minWidth: 19,
      height: 19,
      paddingHorizontal: 5,
      borderRadius: 999,
      backgroundColor: t.brand,
      borderWidth: 2,
      borderColor: t.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeConnected: { backgroundColor: t.green },
    badgeText: { fontSize: 11, lineHeight: 13, fontWeight: '800', color: t.textOnBrand },
    hub: {
      width: hub,
      height: hub,
      borderRadius: hub / 2,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
      ...(elevation(t, 2) as object),
    },
    hubMark: { width: Math.round(hub * 0.46), height: Math.round(hub * 0.46) },
    panelCaption: { ...type.caption, color: t.textSubtle, textAlign: 'center' },
    panelCaptionLead: { color: t.text, fontWeight: '800' },
    panelFeatures: {
      flexDirection: 'row',
      gap: 12,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: t.divider,
    },
    panelFeature: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    panelFeatureTitle: { fontSize: 12.5, lineHeight: 17, fontWeight: '800', color: t.text },
    panelFeatureNote: { fontSize: 11, lineHeight: 15, color: t.textSubtle, marginTop: 2 },

    /* ---- fields ---- */
    field: { marginTop: 18 },
    fieldLabel: { fontSize: 12.5, lineHeight: 17, fontWeight: '700', color: t.text, marginBottom: 6 },
    fieldRequirement: { color: t.textSubtle, fontWeight: '600' },
    inputWrap: { position: 'relative', justifyContent: 'center' },
    input: {
      minHeight: 48,
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 11,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: t.text,
      fontSize: 15,
    },
    inputWithReveal: { paddingRight: 66 },
    /* Six boxes that read as one field. `flexBasis: 0` shares the row evenly,
       so the group is the same width as every other input above it. */
    codeRow: { flexDirection: 'row', gap: l.isPhone ? 7 : 9 },
    codeBox: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minWidth: 0,
      minHeight: 54,
      paddingHorizontal: 0,
      textAlign: 'center',
      fontSize: 19,
      fontWeight: '800',
      letterSpacing: 1,
    },
    inputInvalid: { borderColor: t.pink },
    reveal: {
      position: 'absolute',
      right: 3,
      minWidth: 58,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 9,
    },
    revealLabel: { fontSize: 12.5, fontWeight: '700', color: t.textMuted },
    fieldError: { fontSize: 12.5, lineHeight: 18, color: t.pink, marginTop: 7 },
    fieldErrorGlyph: { fontWeight: '800' },
    fieldErrorAction: { color: t.pink, fontWeight: '800', textDecorationLine: 'underline' },
    fieldHint: { fontSize: 12.5, lineHeight: 18, color: t.textSubtle, marginTop: 7 },

    /* ---- password rules ---- */
    rules: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, rowGap: 7 },
    rule: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '50%', paddingRight: 6, minWidth: 0 },
    ruleBox: {
      width: 15,
      height: 15,
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
      marginTop: 20,
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
      backgroundColor: t.surfaceInset,
    },
    noticeCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 3 },
    noticeTitle: { fontSize: 12.5, lineHeight: 17, fontWeight: '800', color: t.text },
    noticeBody: { fontSize: 12, lineHeight: 17, color: t.textMuted },
    noticeAction: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 44, alignSelf: 'flex-start' },
    noticeActionLabel: { fontSize: 12.5, fontWeight: '800', color: t.brand },

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
    submit: { marginTop: 20, borderRadius: 12, overflow: 'hidden', ...(elevation(t, 1) as object) },
    submitDisabled: { opacity: 0.5 },
    submitFill: { minHeight: 50, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
    submitLabel: { fontSize: 15, fontWeight: '800', color: t.textOnBrand },
    ghost: {
      marginTop: 20,
      minHeight: 50,
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
    or: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 22 },
    orRule: { height: 1, flexGrow: 1, flexShrink: 1, flexBasis: 0, backgroundColor: t.divider },
    orLabel: { fontSize: 12, lineHeight: 16, color: t.textSubtle },
    socials: { flexDirection: l.isPhone ? 'column' : 'row', gap: 10, marginTop: 14 },
    social: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: l.isPhone ? 'auto' : 0,
      minWidth: 0,
      minHeight: 48,
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
