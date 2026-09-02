import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { accentText, brandColor, elevation, softFill, type ThemeTokens } from '@/theme/tokens';
import { useTokens } from '@/theme/v5-theme-provider';
import { useLayout, type Layout } from '@/theme/use-responsive';
import { Connectors, ConnectorSurface, useConnectorField, type ConnectorField, type Link } from './connectors';
import { ImageAsset } from './media';
import { Reveal } from './motion';
import { ROUTES } from './nav';
import { CardGrid } from './responsive-grid';
import {
  ButtonRow,
  Heading,
  PrimaryButton,
  SecondaryButton,
  SectionLabel,
  Band,
  buildTypeScale,
  useTypeScale,
} from './ui';

type Channel = { key: string; icon: string; label: string; color: string };
type Group = { key: string; name: string; accent: 'brand' | 'orange'; items: Channel[] };

const GROUPS: Group[] = [
  {
    key: 'social',
    name: 'Social',
    accent: 'brand',
    items: [
      { key: 'instagram', icon: 'instagram', label: 'Instagram', color: '#e1306c' },
      { key: 'facebook', icon: 'facebook-f', label: 'Facebook', color: '#1877f2' },
      { key: 'tiktok', icon: 'tiktok', label: 'TikTok', color: '#111111' },
    ],
  },
  {
    key: 'messaging',
    name: 'Messaging',
    accent: 'brand',
    items: [
      { key: 'whatsapp', icon: 'whatsapp', label: 'WhatsApp', color: '#16b857' },
      { key: 'email', icon: 'envelope', label: 'Email', color: '#0878f9' },
      { key: 'sms', icon: 'comment-dots', label: 'SMS', color: '#12b858' },
    ],
  },
  {
    key: 'commerce',
    name: 'Commerce',
    accent: 'orange',
    items: [
      { key: 'stripe', icon: 'stripe', label: 'Stripe', color: '#635bff' },
      { key: 'shopify', icon: 'shopify', label: 'Shopify', color: '#72a942' },
    ],
  },
  {
    key: 'local',
    name: 'Local',
    accent: 'brand',
    items: [
      { key: 'gbp', icon: 'google', label: 'Google Business Profile', color: '#4285f4' },
      { key: 'applemaps', icon: 'apple', label: 'Apple Maps', color: '#111111' },
    ],
  },
  {
    key: 'analytics',
    name: 'Analytics',
    accent: 'brand',
    items: [
      { key: 'linkedin', icon: 'linkedin-in', label: 'LinkedIn', color: '#0a66c2' },
      { key: 'youtube', icon: 'youtube', label: 'YouTube', color: '#ff0000' },
      { key: 'google', icon: 'google', label: 'Google', color: '#4285f4' },
      { key: 'wordpress', icon: 'wordpress', label: 'WordPress', color: '#21759b' },
    ],
  },
];

const [social, messaging, commerce, local, analytics] = GROUPS;

/**
 * Which tiles the hub visibly wires up.
 *
 * A wire is only drawn where it has a clear run. The Social and Messaging
 * clusters sit above the hub, so all six fan out cleanly. Commerce and Local
 * sit *beside* it in a row, so only the near card is wired — a line to the far
 * one would disappear behind its neighbour and leave the end dot stranded in
 * the gap. The Analytics row is bracketed by its two outer tiles for the same
 * reason.
 */
function buildLinks(t: ThemeTokens): Link[] {
  const blue = t.brand;
  return [
    { from: 'hub', to: 'instagram', color: blue },
    { from: 'hub', to: 'facebook', color: blue },
    { from: 'hub', to: 'tiktok', color: blue },
    { from: 'hub', to: 'whatsapp', color: blue },
    { from: 'hub', to: 'email', color: blue },
    { from: 'hub', to: 'sms', color: blue },
    { from: 'hub', to: 'shopify', color: t.orange },
    { from: 'hub', to: 'gbp', color: blue },
    { from: 'hub', to: 'linkedin', color: blue },
    { from: 'hub', to: 'wordpress', color: blue },
  ];
}

/**
 * What each cluster in the diagram actually carries. The copy column ran 167px
 * shorter than the map beside it, and the map can only show logos — this says
 * what arrives once a logo is connected. It is the legend for the diagram, not
 * a restatement of the security strip below it.
 */
const CARRIES: [string, string][] = [
  ['Social', 'comments, DMs and how each post performed'],
  ['Messaging', 'every thread on one contact, whichever app it came from'],
  ['Commerce', 'orders, carts and refunds against the customer who made them'],
  ['Local', 'listings, reviews and the questions people ask about you'],
  ['Analytics', 'what each channel actually returned, side by side'],
];

/**
 * The phone forms of the same five lines.
 *
 * A half-width card gives its body a 136px column — about eighteen 14px
 * characters a line. "orders, carts and refunds against the customer who made
 * them" is 3.2 lines in that column, so a three-line clamp would cut it mid
 * clause. These are written to the measure instead, and the clamp is a guard.
 */
const CARRIES_PHONE: [string, string][] = [
  ['Social', 'comments, DMs and post performance'],
  ['Messaging', 'every thread on one contact'],
  ['Commerce', 'orders, carts and refunds'],
  ['Local', 'listings, reviews and questions'],
  ['Analytics', 'what each channel actually returned, side by side'],
];

function carriesFor(name: string, phone = false): string {
  const hit = (phone ? CARRIES_PHONE : CARRIES).find(([group]) => group === name);
  return hit ? hit[1] : '';
}

const securityItems = [
  ['shield-halved', 'Secure OAuth', 'Enterprise-grade authorization'],
  ['rotate', 'Real-time sync', 'Always up-to-date, everywhere'],
  ['user-shield', 'Permission controls', 'Granular access, total control'],
  ['wave-square', 'Connection monitoring', 'Proactive alerts, 24/7'],
] as const;

/**
 * The phone form of the same four assurances.
 *
 * Four icon+title+note rows are 264px of reassurance on a 390px screen, which
 * is more room than a trust strip has earned. As chips the four titles fit two
 * rows, and the notes go — "Enterprise-grade authorization" adds nothing to
 * "Secure OAuth" that a visitor on a phone is going to stop and read.
 * "Connection monitoring / Proactive alerts, 24/7" collapses to one chip.
 */
const PHONE_ASSURANCES = [
  ['shield-halved', 'Secure OAuth'],
  ['rotate', 'Real-time sync'],
  ['user-shield', 'Permission controls'],
  ['wave-square', 'Monitored 24/7'],
] as const;

type Styles = ReturnType<typeof createStyles>;

/**
 * Icon and label live inside the same card, and the card is the measured node —
 * so a wire lands on the card's edge instead of stopping at the icon and
 * running through the label underneath it.
 */
function ChannelTile({ item, field, styles, t }: { item: Channel; field: ConnectorField; styles: Styles; t: ThemeTokens }) {
  return (
    <View {...field.node(item.key)} style={styles.tile}>
      <FontAwesome6 name={item.icon as never} size={styles.tileGlyphSize} color={brandColor(item.color, t)}  aria-hidden={true}/>
      <Text numberOfLines={3} style={styles.tileLabel}>
        {item.label}
      </Text>
    </View>
  );
}

function ChannelGroup({ group, field, styles, t }: { group: Group; field: ConnectorField; styles: Styles; t: ThemeTokens }) {
  const accent = group.accent === 'orange' ? t.orange : t.chipText;
  const chipBg = group.accent === 'orange' ? softFill(t.orange, t) : t.chipBg;
  return (
    <View style={styles.group}>
      <View style={[styles.groupChip, { backgroundColor: chipBg }]}>
        <Text style={[styles.groupChipText, { color: accentText(accent, t) }]}>{group.name}</Text>
      </View>
      <View style={styles.groupTiles}>
        {group.items.map((item) => (
          <ChannelTile key={item.key} item={item} field={field} styles={styles} t={t} />
        ))}
      </View>
    </View>
  );
}

/**
 * The phone cell.
 *
 * On a phone the radial diagram has no wires — `radial` is false — so the map
 * degrades to five labelled clusters of logo tiles, ~700px of grid, and the
 * legend that explains them ("What comes across") is a *separate* 330px list
 * further up the column. They are the same five groups said twice.
 *
 * Here they are one object: the group's logos, its name, and the one sentence
 * that says what connecting it actually brings back. The tiles lose their text
 * labels — a 30px logo in a 164px cell is recognised, not read — so each keeps
 * an `accessibilityLabel` and the group name carries the reading.
 */
function GroupCard({
  group,
  full,
  styles,
  t,
}: {
  group: Group;
  full: boolean;
  styles: Styles;
  t: ThemeTokens;
}) {
  return (
    <View style={[styles.gcard, full ? styles.gcardFull : styles.gcardHalf]}>
      <View style={styles.gcardLogos}>
        {group.items.map((item) => (
          <View key={item.key} style={styles.gcardLogo} accessible accessibilityRole="image" accessibilityLabel={item.label}>
            <FontAwesome6 name={item.icon as never} size={16} color={brandColor(item.color, t)}  aria-hidden={true}/>
          </View>
        ))}
      </View>
      <Text style={styles.gcardTitle} numberOfLines={1}>
        {group.name}
      </Text>
      <Text style={styles.gcardBody} numberOfLines={2}>
        {carriesFor(group.name, true)}
      </Text>
    </View>
  );
}

/**
 * PHONE — six representative marks, one per cluster, wired to the hub.
 *
 * The full radial map cannot draw a wire in a 354px column: two three-icon
 * clusters do not fit either side of a 84px hub, so every line would be a stub.
 * Six single tiles do fit — 46px each side of the hub with the whole middle of
 * the column left for the run — and one is taken from each group so the picture
 * still says "everything you already use", not "our favourite six".
 *
 * The hub therefore comes back on the phone WIRED, which is the condition rule
 * 7 actually cares about: the mark is naming a centre node in a diagram, not
 * decorating a content section.
 */
const PHONE_LEFT: Channel[] = [social.items[0], messaging.items[0], commerce.items[1]];
const PHONE_RIGHT: Channel[] = [local.items[0], analytics.items[0], analytics.items[3]];

/** The hub breathes a slow ring outward, so the diagram reads as live. */
function Hub({ field, styles, t }: { field: ConnectorField; styles: Styles; t: ThemeTokens }) {
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(withTiming(1, { duration: 2800, easing: Easing.out(Easing.quad) }), -1, false);
  }, [reduced, pulse]);

  const ring = useAnimatedStyle(() => ({
    opacity: 0.4 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 0.4 }],
  }));

  return (
    <View {...field.node('hub')} style={styles.hub}>
      <Animated.View pointerEvents="none" style={[styles.hubPulse, { borderColor: t.brand }, ring]} />
      {/* The mark is the only thing naming the centre node — every other node in
          this diagram carries a visible text label, so this one cannot be silent. */}
      <ImageAsset
        source={require('../../../assets/images/v5/flowsmartly-mark.png')}
        style={styles.hubMark}
        contentFit="contain"
        alt="FlowSmartly"
      />
    </View>
  );
}

/**
 * One mark in the phone map. Logo only — a 46px tile has no room for a label,
 * and the group cards below already name every network in words — so the tile
 * carries its name for assistive technology instead of drawing it.
 */
function PhoneMapTile({ item, field, styles, t }: { item: Channel; field: ConnectorField; styles: Styles; t: ThemeTokens }) {
  return (
    <View {...field.node(item.key)} style={styles.phoneMapTile} accessible accessibilityRole="image" accessibilityLabel={item.label}>
      <FontAwesome6 name={item.icon as never} size={18} color={brandColor(item.color, t)} aria-hidden={true} />
    </View>
  );
}

/**
 * The phone diagram: three marks, the hub, three marks.
 *
 * A column each side rather than a ring, so every wire travels outward across
 * the open middle of the column and nothing crosses a neighbour. There is no
 * text inside this block at all, so there is nothing here that could end up
 * being read against artwork.
 */
function PhoneMap({ field, styles, t }: { field: ConnectorField; styles: Styles; t: ThemeTokens }) {
  const links = useMemo<Link[]>(
    () => [...PHONE_LEFT, ...PHONE_RIGHT].map((item) => ({ from: 'hub', to: item.key, color: t.brand })),
    [t],
  );
  return (
    <ConnectorSurface field={field} style={styles.phoneMap}>
      <Connectors
        field={field}
        links={links}
        color={t.brand}
        circular={['hub']}
        strokeWidth={1.6}
        dash="0.5 5"
        flow
      />
      <View style={styles.phoneMapRow}>
        <View style={styles.phoneMapColumn}>
          {PHONE_LEFT.map((item) => (
            <PhoneMapTile key={item.key} item={item} field={field} styles={styles} t={t} />
          ))}
        </View>
        <Hub field={field} styles={styles} t={t} />
        <View style={styles.phoneMapColumn}>
          {PHONE_RIGHT.map((item) => (
            <PhoneMapTile key={item.key} item={item} field={field} styles={styles} t={t} />
          ))}
        </View>
      </View>
    </ConnectorSurface>
  );
}

export function ConnectedChannelsSection() {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  const field = useConnectorField();
  const router = useRouter();
  const styles = useMemo(() => createStyles(t, l), [t, l]);
  const links = useMemo(() => buildLinks(t), [t]);

  const cta = (
    <ButtonRow>
      <PrimaryButton
        label="View integrations"
        full={l.isPhone}
        trackId="home.channels.view-integrations"
        onPress={() => router.push(ROUTES.integrations as never)}
      />
      <SecondaryButton
        label="Explore API"
        full={l.isPhone}
        trackId="home.channels.explore-api"
        onPress={() => router.push(ROUTES.apiDocs as never)}
      />
    </ButtonRow>
  );

  /**
   * PHONE — a different composition, not the same one turned sideways.
   *
   * The wide section is copy beside a wired radial map, with a legend under the
   * copy and a four-across assurance strip beneath both. None of that survives a
   * 390px column: the map cannot draw a single wire, the legend repeats the map,
   * and the strip becomes four full-width rows.
   *
   * So the phone gets: head → a compact wired hub → a two-column grid of
   * channel-group cards, each holding its own logos and its own one-line
   * promise → a two-row trust strip.
   *
   * The hub was briefly dropped here, on the reasoning that a hub with nothing
   * wired to it is a logo in a content section. The reasoning held; the
   * conclusion did not. The fix was to give it something to wire to — see
   * `PhoneMap` — not to take the centre of the diagram out of the phone.
   */
  if (l.isPhone) {
    return (
      <Band tone="surface" art={{ variant: 'docs', color: t.brand, side: 'right' }}>
        <Reveal distance={22}>
          <View style={styles.phoneHead}>
            <SectionLabel>CONNECTED BY DESIGN</SectionLabel>
            <Heading level={2} style={[type.h1, styles.title]}>
              Connect the channels you already use.
            </Heading>
            <Text style={[type.body, styles.body]} numberOfLines={2}>
              Your customer data stays connected. Your workflow stays in one intelligent place.
            </Text>
            {cta}
          </View>

          {/* The section's one picture. The `Reveal` around the whole branch is
              translate-only, so the wires still land — rule 9. */}
          <PhoneMap field={field} styles={styles} t={t} />

          <CardGrid style={styles.phoneCards}>
            {GROUPS.map((group, i) => (
              <GroupCard key={group.key} group={group} full={i === GROUPS.length - 1} styles={styles} t={t} />
            ))}
          </CardGrid>

          <View style={styles.trustStrip}>
            {PHONE_ASSURANCES.map(([icon, label]) => (
              <View key={label} style={styles.trustChip}>
                <FontAwesome6 name={icon as never} size={14} color={t.brand}  aria-hidden={true}/>
                <Text style={styles.trustChipText} numberOfLines={1}>
                  {label}
                </Text>
              </View>
            ))}
          </View>
        </Reveal>
      </Band>
    );
  }

  return (
    // A band: the diagram is the page's one large visual canvas, so it gets its
    // own ground rather than a card around it. The Band supplies the padding
    // the section shell used to.
    //
    // One reveal for the whole thing, and translate-only. The connector overlay
    // measures the hub and the tiles against the field with getBoundingClientRect,
    // which includes transforms — so every measured node has to sit inside the
    // *same* transform. A per-tile stagger, or a scale here, would leave the
    // wires pointing at where the tiles used to be.
    <Band tone="surface" art={{ variant: 'docs', color: t.brand, side: 'right' }}>
    <Reveal distance={22}>
      <View style={styles.main}>
        <View style={styles.copy}>
          <SectionLabel>CONNECTED BY DESIGN</SectionLabel>
          <Heading level={2} style={[type.h1, styles.title]}>
            Connect the channels you already use.
          </Heading>
          <Text style={[type.body, styles.body]}>
            Your customer data stays connected. Your workflow stays in one intelligent place.
          </Text>
          {cta}

          <View style={styles.carries}>
            <Text style={[type.caption, styles.carriesTitle]}>What comes across</Text>
            {CARRIES.map(([group, detail]) => (
              <View key={group} style={styles.carriesRow}>
                <View style={styles.carriesDot} />
                <Text style={[type.bodySm, styles.carriesText]}>
                  <Text style={styles.carriesGroup}>{group}</Text>
                  {` — ${detail}`}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* The radial arrangement needs room for two three-icon clusters side
            by side, which every width that reaches this branch has — the phone
            composition returns above and never draws a wire. */}
        <ConnectorSurface field={field} style={styles.map}>
          <Connectors
            field={field}
            links={links}
            color={t.brand}
            circular={['hub']}
            strokeWidth={2}
            dash="0.5 6"
            flow
          />
          <View style={styles.mapRowTop}>
            <ChannelGroup group={social} field={field} styles={styles} t={t} />
            <ChannelGroup group={messaging} field={field} styles={styles} t={t} />
          </View>
          <View style={styles.mapRowMiddle}>
            <ChannelGroup group={commerce} field={field} styles={styles} t={t} />
            <Hub field={field} styles={styles} t={t} />
            <ChannelGroup group={local} field={field} styles={styles} t={t} />
          </View>
          <View style={styles.mapRowBottom}>
            <ChannelGroup group={analytics} field={field} styles={styles} t={t} />
          </View>
        </ConnectorSurface>
      </View>

      <View style={styles.security}>
        {securityItems.map(([icon, title, note], index) => (
          <View key={title} style={[styles.securityItem, index > 0 ? styles.securityItemDivided : null]}>
            <View style={styles.securityIcon}>
              <FontAwesome6 name={icon as never} size={l.isPhone ? 18 : 20} color={t.brand}  aria-hidden={true}/>
            </View>
            <View style={styles.securityCopy}>
              <Text numberOfLines={1} style={[type.h4, styles.securityTitle]}>
                {title}
              </Text>
              <Text numberOfLines={2} style={[type.caption, styles.securityNote]}>
                {note}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </Reveal>
    </Band>
  );
}

function createStyles(t: ThemeTokens, l: Layout) {
  const type = buildTypeScale(l, t);
  // Card width, sized so two three-icon clusters still fit side by side at the
  // narrowest width that keeps the radial arrangement.
  const tile = l.isPhone ? 76 : l.isTablet ? 78 : l.isDesktop ? 92 : 84;
  const hub = l.isPhone ? 84 : l.isTablet ? 100 : 124;
  // Four security items only fit on one line once the section is side-by-side;
  // below that they truncate ("Permission co…"), so they go 2-up.
  const oneRowSecurity = !l.isStacked;

  const sheet = StyleSheet.create({
    main: {
      flexDirection: l.isStacked ? 'column' : 'row',
      alignItems: l.isStacked ? 'stretch' : 'center',
      gap: l.isStacked ? 28 : 40,
    },
    copy: l.isStacked
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', gap: 18 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 380, minWidth: 300, gap: 20 },
    title: { marginTop: 4 },
    body: { maxWidth: 480 },

    /* phone ------------------------------------------------------- */
    phoneHead: { gap: 16 },

    /*
     * The compact map. `space-between` puts a column hard against each edge and
     * the hub in the middle, which is what gives each wire a run long enough to
     * read as a wire rather than as a stub against a tile.
     */
    phoneMap: { marginTop: 24, alignItems: 'center', paddingVertical: 4 },
    phoneMapRow: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    phoneMapColumn: { alignItems: 'center', gap: 12 },
    phoneMapTile: {
      width: 46,
      height: 46,
      flexGrow: 0,
      flexShrink: 0,
      flexBasis: 'auto',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
      ...(elevation(t, 1) as object),
    },

    phoneCards: { marginTop: 22 },
    gcard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      padding: 14,
      gap: 8,
      ...(elevation(t, 1) as object),
    },
    /** two up, and the fifth spans so the row never leaves a stretched orphan */
    gcardHalf: { flexGrow: 1, flexShrink: 1, flexBasis: '46%', minWidth: 0 },
    gcardFull: { flexGrow: 1, flexShrink: 1, flexBasis: '100%', minWidth: 0 },
    gcardLogos: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    gcardLogo: {
      width: 30,
      height: 30,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    gcardTitle: { ...type.h4, color: t.text, fontWeight: '700' },
    gcardBody: { ...type.caption, color: t.textMuted },
    trustStrip: {
      marginTop: 22,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: t.border,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    trustChip: {
      minHeight: 36,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
      flexGrow: 0,
      flexShrink: 1,
      minWidth: 0,
    },
    trustChipText: { ...type.caption, color: t.text, fontWeight: '600' },

    /** the diagram's legend — what each cluster brings back once connected */
    carries: {
      marginTop: 4,
      paddingTop: 18,
      borderTopWidth: 1,
      borderTopColor: t.divider,
      gap: 10,
      maxWidth: 520,
    },
    carriesTitle: { color: t.textSubtle, fontWeight: '700' },
    carriesRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
    carriesDot: {
      width: 6,
      height: 6,
      marginTop: 9,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 3,
      backgroundColor: t.brand,
    },
    carriesText: {
      color: t.textMuted,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
    },
    carriesGroup: { color: t.text, fontWeight: '800' },
    map: l.isStacked
      ? {
          flexGrow: 0,
          flexShrink: 0,
          flexBasis: 'auto',
          width: '100%',
          // Capped and centred, otherwise the clusters drift to the far edges
          // of a full-width column and the two top groups read as one row.
          maxWidth: 760,
          alignSelf: 'center',
          alignItems: 'center',
          gap: l.isPhone ? 20 : 26,
          paddingVertical: 8,
        }
      : { flexGrow: 1.45, flexShrink: 1, flexBasis: 560, minWidth: 0, gap: 26, paddingVertical: 6 },

    // Rows span the field so the clusters separate and the curves have somewhere
    // to bend, at every width.
    mapRowTop: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 28,
      paddingHorizontal: l.isDesktop ? 12 : 0,
    },
    mapRowMiddle: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
    },
    mapRowBottom: { alignItems: 'center' },

    group: { alignItems: 'center', gap: 10, minWidth: 0 },
    groupChip: { alignSelf: 'center', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
    groupChipText: { ...type.caption, lineHeight: 18, fontWeight: '700' },
    groupTiles: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },

    tile: {
      width: tile,
      minHeight: tile,
      paddingVertical: 12,
      paddingHorizontal: 6,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      ...(elevation(t, 1) as object),
    },
    tileLabel: { ...type.caption, color: t.textMuted, lineHeight: 17, textAlign: 'center' },

    hub: {
      width: hub,
      height: hub,
      flexShrink: 0,
      borderRadius: hub / 2,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
      ...(elevation(t, 3) as object),
    },
    hubMark: { width: hub * 0.52, height: hub * 0.52 },
    hubPulse: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: hub / 2,
      borderWidth: 2,
    },

    // A ruled strip, not an inset box. On the band's own ground a bordered,
    // tinted rectangle would be a card inside a card again — the rule above it
    // separates it from the diagram just as well.
    security: {
      marginTop: l.isStacked ? 28 : 36,
      paddingTop: l.isPhone ? 18 : 24,
      borderTopWidth: 1,
      borderTopColor: t.border,
      flexDirection: 'row',
      flexWrap: oneRowSecurity ? 'nowrap' : 'wrap',
      alignItems: 'stretch',
      gap: l.isPhone ? 14 : 0,
    },
    securityItem: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: l.isPhone ? '100%' : oneRowSecurity ? 0 : '46%',
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: l.isPhone ? 0 : 16,
      paddingVertical: l.isPhone ? 0 : 6,
    },
    securityItemDivided: { borderLeftWidth: l.isPhone ? 0 : 1, borderLeftColor: t.border },
    securityIcon: {
      width: 44,
      height: 44,
      flexShrink: 0,
      borderRadius: 12,
      backgroundColor: t.brandSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    securityCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0 },
    securityTitle: { marginBottom: 2 },
    securityNote: { color: t.textSubtle },
  });

  return { ...sheet, tileGlyphSize: Math.round(tile * 0.44) };
}
