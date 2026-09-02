import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import {
  getConsentPreferences,
  isGlobalPrivacyControlActive,
  onConsentChange,
  resetConsent,
  setConsentPreferences,
  track,
  type ConsentCategories,
} from '@/lib/analytics';
import { accentText, elevation, softFill, type ThemeTokens } from '@/theme/tokens';
import { useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';
import { ROUTES } from './nav';
import { FONT_SANS, buildTypeScale } from './ui';

/* ------------------------------------------------------------------ */
/* the categories, described the way the cookies policy describes them */
/* ------------------------------------------------------------------ */

type CategoryKey = 'necessary' | 'analytics' | 'marketing';

const CATEGORIES: {
  key: CategoryKey;
  icon: string;
  title: string;
  body: string;
  /** what is actually stored — naming it is the point of the panel */
  stored: string;
  locked?: boolean;
}[] = [
  {
    key: 'necessary',
    icon: 'lock',
    title: 'Strictly necessary',
    body: 'Needed for the site to work at all. It cannot be switched off, and it is never used to profile you.',
    // Only the decision itself. The appearance you pick is held in memory for
    // the visit and is not written down — so this must not claim otherwise.
    stored: 'The record of this decision, and nothing else.',
    locked: true,
  },
  {
    key: 'analytics',
    icon: 'chart-simple',
    title: 'Analytics',
    body: 'How pages are found and used, so we know which ones are worth improving. Aggregated, never sold.',
    stored:
      'Pages viewed, buttons clicked, and the channel your first visit came from — search, social, a link, or direct.',
  },
  {
    key: 'marketing',
    icon: 'bullhorn',
    title: 'Marketing',
    body: 'Lets us measure which campaign earned a signup and avoid showing you the same ad repeatedly.',
    stored:
      'Ad click identifiers (Google, Meta) and the campaign name on the link you arrived from. Off, and they are dropped rather than hidden.',
  },
];

/* ------------------------------------------------------------------ */
/* shared state                                                        */
/* ------------------------------------------------------------------ */

/**
 * The footer's "Cookie settings" link has to be able to open the panel from
 * anywhere on the page, and the banner has to close when it does. A module
 * level listener set is the smallest thing that does that without threading a
 * provider through every route.
 */
const openers = new Set<() => void>();

/** Opens the preferences panel from anywhere (the footer link uses this). */
export function openConsentPreferences() {
  openers.forEach((open) => open());
}

export function useConsentPreferences(): ConsentCategories | null {
  const [value, setValue] = useState<ConsentCategories | null>(null);
  useEffect(() => {
    setValue(getConsentPreferences());
    return onConsentChange(setValue);
  }, []);
  return value;
}

/* ------------------------------------------------------------------ */
/* the notice                                                          */
/* ------------------------------------------------------------------ */

/**
 * Consent notice and preferences panel.
 *
 * Rules this is built to:
 *  - Nothing non-essential is stored or sent until a choice is made. The
 *    analytics module holds pre-decision events in memory and writes the
 *    first-touch attribution only once analytics consent exists, so this is the
 *    control that decides which of those two things happens.
 *  - Rejecting is exactly as easy as accepting — same prominence, same number
 *    of clicks, no dark pattern. That includes the panel: the optional
 *    categories start off, so "Save choices" is never a disguised "Accept all".
 *  - The panel says what is stored, not just that "we value your privacy".
 *  - It renders nothing on the server, and nothing once a choice exists.
 */
export function ConsentNotice() {
  const t = useTokens();
  const l = useLayout();
  const router = useRouter();
  const styles = useMemo(() => createStyles(t, l), [t, l]);

  // Static export has no window: decide on the client only, so the server tree
  // and the first client render agree and hydration is not discarded.
  const [ready, setReady] = useState(false);
  const [decided, setDecided] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  // Off is the only honest starting point: an undecided visitor who presses
  // "Save choices" without touching a switch must not be counted as an accept.
  // A visitor who has already decided sees their real saved state, set below.
  const [draft, setDraft] = useState({ analytics: false, marketing: false });
  const [gpc, setGpc] = useState(false);

  useEffect(() => {
    const current = getConsentPreferences();
    setDecided(current !== null);
    if (current) setDraft({ analytics: current.analytics, marketing: current.marketing });
    setGpc(isGlobalPrivacyControlActive());
    setReady(true);
    return onConsentChange((value) => {
      setDecided(value !== null);
      if (value) setDraft({ analytics: value.analytics, marketing: value.marketing });
    });
  }, []);

  const openPanel = useCallback(() => {
    setDraft(() => {
      const current = getConsentPreferences();
      return current
        ? { analytics: current.analytics, marketing: current.marketing }
        : { analytics: false, marketing: false };
    });
    setPanelOpen(true);
  }, []);

  useEffect(() => {
    openers.add(openPanel);
    return () => {
      openers.delete(openPanel);
    };
  }, [openPanel]);

  // Escape closes the panel, which is the one keyboard affordance a dialog
  // genuinely owes the visitor.
  useEffect(() => {
    if (!panelOpen || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPanelOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [panelOpen]);

  const decide = (analytics: boolean, marketing: boolean, how: string) => {
    setConsentPreferences({ analytics, marketing });
    setPanelOpen(false);
    // Logged after the decision, so the decision governs it: on an acceptance
    // it is recorded, and on a refusal `track` drops it rather than holding it.
    track('consent_decision', { analytics, marketing, how });
  };

  if (!ready) return null;
  if (decided && !panelOpen) return null;

  return (
    <>
      {!decided && !panelOpen ? (
        <View
          // biome-ignore lint: role is meaningful for a consent notice
          role={'region' as never}
          aria-label="Cookie notice"
          style={styles.bannerWrap}>
          <View style={styles.banner}>
            {/* On a phone the 38px mark, the title line and the long paragraph
                are the whole difference between a 307px banner covering a third
                of the first screen and a ~128px one. The wide banner keeps all
                three; the phone banner is two lines and the actions. */}
            {l.isPhone ? null : (
              <View style={styles.bannerIcon}>
                <FontAwesome6 name="cookie-bite" size={16} color={t.brand}  aria-hidden={true}/>
              </View>
            )}
            <View style={styles.bannerCopy}>
              {l.isPhone ? null : <Text style={styles.bannerTitle}>Before we measure anything</Text>}
              <Text style={styles.bannerBody}>
                {l.isPhone
                  ? // Same three facts as the wide copy — necessary storage is
                    // in use, the two optional categories are named, and they
                    // are off — in two lines instead of four.
                    'Necessary storage only. Analytics and marketing stay off. '
                  : 'We use strictly necessary storage to make the site work. Analytics and marketing storage are optional and stay off until you say otherwise. '}
                <Text
                  accessibilityRole="link"
                  onPress={() => router.push(ROUTES.cookies as never)}
                  style={styles.bannerLink}>
                  {l.isPhone ? 'Cookie policy' : 'Read the cookie policy'}
                </Text>
                .
              </Text>
            </View>
            <View style={styles.bannerActions}>
              {/* Reject sits first and looks the same as accept — refusing must
                  not be the harder path. The phone labels are shortened so all
                  three fit one row at 390; the announced label is not. */}
              <ConsentButton
                label={l.isPhone ? 'Reject' : 'Reject optional'}
                a11yLabel="Reject optional cookies"
                onPress={() => decide(false, false, 'banner')}
              />
              <ConsentButton
                label="Accept all"
                a11yLabel="Accept all cookies"
                primary
                onPress={() => decide(true, true, 'banner')}
              />
              <ConsentButton
                label="Choose"
                a11yLabel="Choose which cookies to allow"
                quiet
                onPress={openPanel}
              />
            </View>
          </View>
        </View>
      ) : null}

      {panelOpen ? (
        <View style={styles.overlay}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close cookie preferences"
            onPress={() => setPanelOpen(false)}
            style={styles.scrim}
          />
          <View
            // biome-ignore lint: this really is a dialog
            role={'dialog' as never}
            aria-modal={true as never}
            aria-label="Cookie preferences"
            style={styles.panel}>
            <View style={styles.panelHead}>
              <Text style={styles.panelTitle}>Cookie preferences</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close cookie preferences"
                onPress={() => setPanelOpen(false)}
                style={({ pressed }) => [styles.panelClose, pressed ? styles.pressed : null]}>
                <FontAwesome6 name="xmark" size={15} color={t.textMuted}  aria-hidden={true}/>
              </Pressable>
            </View>

            <ScrollView style={styles.panelScroll} contentContainerStyle={styles.panelScrollInner}>
              <Text style={styles.panelIntro}>
                Each category is a separate choice, and you can change it at any time from the footer.
              </Text>

              {gpc ? (
                <View style={styles.gpcNote}>
                  <FontAwesome6 name="shield-halved" size={12} color={t.textMuted}  aria-hidden={true}/>
                  <Text style={styles.gpcNoteText}>
                    Your browser is sending a Global Privacy Control signal, so marketing storage stays
                    off on this browser whatever you choose here.
                  </Text>
                </View>
              ) : null}

              {CATEGORIES.map((category) => {
                const forcedOff = category.key === 'marketing' && gpc;
                const on = forcedOff
                  ? false
                  : category.key === 'necessary'
                    ? true
                    : category.key === 'analytics'
                      ? draft.analytics
                      : draft.marketing;
                return (
                  <View key={category.key} style={styles.category}>
                    <View style={styles.categoryTop}>
                      <View style={styles.categoryIcon}>
                        <FontAwesome6 name={category.icon as never} size={13} color={t.brand}  aria-hidden={true}/>
                      </View>
                      <Text style={styles.categoryTitle}>{category.title}</Text>
                      {category.locked ? (
                        <Text style={styles.categoryAlways}>Always on</Text>
                      ) : forcedOff ? (
                        <Text style={styles.categoryAlways}>Off (GPC)</Text>
                      ) : (
                        <Toggle
                          value={on}
                          label={category.title}
                          onChange={(next) =>
                            setDraft((current) =>
                              category.key === 'analytics'
                                ? { ...current, analytics: next }
                                : { ...current, marketing: next },
                            )
                          }
                        />
                      )}
                    </View>
                    <Text style={styles.categoryBody}>{category.body}</Text>
                    <View style={styles.categoryStored}>
                      <Text style={styles.categoryStoredLabel}>What this stores</Text>
                      <Text style={styles.categoryStoredValue}>{category.stored}</Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.panelFoot}>
              <ConsentButton label="Reject optional" onPress={() => decide(false, false, 'panel')} />
              <ConsentButton
                label="Save choices"
                primary
                onPress={() => decide(draft.analytics, draft.marketing, 'panel')}
              />
            </View>
          </View>
        </View>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* pieces                                                              */
/* ------------------------------------------------------------------ */

function ConsentButton({
  label,
  a11yLabel,
  onPress,
  primary,
  quiet,
}: {
  label: string;
  /** What the button is announced as when the visible label is abbreviated. */
  a11yLabel?: string;
  onPress: () => void;
  primary?: boolean;
  quiet?: boolean;
}) {
  const t = useTokens();
  const l = useLayout();
  const styles = useMemo(() => createStyles(t, l), [t, l]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.buttonPrimary : quiet ? styles.buttonQuiet : styles.buttonNeutral,
        pressed ? styles.pressed : null,
      ]}>
      <Text
        numberOfLines={1}
        style={[
          styles.buttonText,
          primary ? styles.buttonTextPrimary : quiet ? styles.buttonTextQuiet : null,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** A real switch: role, state and a 44px hit area. */
function Toggle({
  value,
  label,
  onChange,
}: {
  value: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  const t = useTokens();
  const l = useLayout();
  const styles = useMemo(() => createStyles(t, l), [t, l]);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      // Both: `accessibilityState` is the native path, and `aria-checked` is
      // the only one react-native-web maps to the DOM. Without the second, the
      // switch announces no state at all on the web — a visitor using a screen
      // reader could not tell whether the category was on or off, which is the
      // same defect as a misleading default, just less visible.
      accessibilityState={{ checked: value }}
      aria-checked={value}
      onPress={() => onChange(!value)}
      style={styles.toggleHit}>
      <View style={[styles.toggleTrack, value ? styles.toggleTrackOn : null]}>
        <View style={[styles.toggleKnob, value ? styles.toggleKnobOn : null]} />
      </View>
    </Pressable>
  );
}

/**
 * The footer entry point. Rendering the current state rather than a bare link
 * means a visitor can see what they chose without opening anything.
 */
export function ConsentFooterLink() {
  const t = useTokens();
  const l = useLayout();
  const styles = useMemo(() => createStyles(t, l), [t, l]);
  const consent = useConsentPreferences();
  const state = !consent
    ? 'Not set'
    : consent.analytics && consent.marketing
      ? 'All on'
      : consent.analytics || consent.marketing
        ? 'Custom'
        : 'Essential only';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open cookie settings"
      onPress={openConsentPreferences}
      style={({ pressed }) => [styles.footerLink, pressed ? styles.pressed : null]}>
      <FontAwesome6 name="sliders" size={11} color={t.textSubtle}  aria-hidden={true}/>
      <Text style={styles.footerLinkText}>Cookie settings</Text>
      <Text style={styles.footerLinkState}>{state}</Text>
    </Pressable>
  );
}

/** Opens the panel from inside page content — the cookies policy uses it. */
export function ConsentPreferencesButton() {
  const t = useTokens();
  const l = useLayout();
  const styles = useMemo(() => createStyles(t, l), [t, l]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open cookie settings"
      onPress={openConsentPreferences}
      style={({ pressed }) => [styles.withdraw, styles.withdrawPrimary, pressed ? styles.pressed : null]}>
      <FontAwesome6 name="sliders" size={12} color={t.textOnBrand}  aria-hidden={true}/>
      <Text style={[styles.withdrawText, styles.withdrawTextPrimary]}>Cookie settings</Text>
    </Pressable>
  );
}

/** Used by the cookies policy page so "withdraw consent" is a real control. */
export function ConsentWithdrawButton() {
  const t = useTokens();
  const l = useLayout();
  const styles = useMemo(() => createStyles(t, l), [t, l]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Withdraw consent and clear the stored choice"
      onPress={() => resetConsent()}
      style={({ pressed }) => [styles.withdraw, pressed ? styles.pressed : null]}>
      <FontAwesome6 name="rotate-left" size={12} color={t.text}  aria-hidden={true}/>
      <Text style={styles.withdrawText}>Withdraw consent</Text>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* styles                                                              */
/* ------------------------------------------------------------------ */

function createStyles(t: ThemeTokens, l: Layout) {
  const type = buildTypeScale(l, t);
  const shadow = elevation(t, 3) as ViewStyle;

  return StyleSheet.create({
    pressed: { opacity: 0.85 },

    /* -------------------------------------------------- banner */
    bannerWrap: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: l.gutter,
      paddingBottom: l.isPhone ? 8 : 18,
      zIndex: 90,
    },
    banner: {
      alignSelf: 'center',
      width: '100%',
      maxWidth: 1100,
      flexDirection: l.isCompact ? 'column' : 'row',
      alignItems: l.isCompact ? 'stretch' : 'center',
      gap: l.isPhone ? 8 : 18,
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: l.isPhone ? 14 : 18,
      backgroundColor: t.surfaceRaised,
      padding: l.isPhone ? 12 : 18,
      ...shadow,
    },
    bannerIcon: {
      width: 38,
      height: 38,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softFill(t.brand, t),
    },
    bannerCopy: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: l.isCompact ? 'auto' : 0,
      minWidth: 0,
      gap: l.isPhone ? 0 : 4,
    },
    bannerTitle: { color: t.text, fontSize: 15, fontWeight: '800' , fontFamily: FONT_SANS },
    bannerBody: { ...type.caption, color: t.textMuted },
    bannerLink: { color: accentText(t.brand, t), fontWeight: '700' },
    bannerActions: {
      flexGrow: 0,
      flexShrink: 0,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
    },

    /* -------------------------------------------------- buttons */
    button: {
      minHeight: 44,
      flexGrow: l.isPhone ? 1 : 0,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
      borderRadius: 11,
      // 12 on a phone so "Reject", "Accept all" and "Choose" clear 336px of
      // banner interior on one row; the 44px minimum height is untouched.
      paddingHorizontal: l.isPhone ? 12 : 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonNeutral: { borderWidth: 1, borderColor: t.borderStrong, backgroundColor: t.surface },
    buttonPrimary: { backgroundColor: t.brand },
    buttonQuiet: { backgroundColor: 'transparent' },
    buttonText: { ...type.caption, color: t.text, fontWeight: '700' },
    buttonTextPrimary: { color: t.textOnBrand },
    buttonTextQuiet: { color: t.textMuted },

    /* -------------------------------------------------- panel */
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: l.isPhone ? 'flex-end' : 'center',
      padding: l.isPhone ? 0 : l.gutter,
      zIndex: 100,
    },
    scrim: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: t.ground === 'light' ? 'rgba(7, 20, 73, 0.34)' : 'rgba(0, 0, 0, 0.58)',
    },
    panel: {
      width: '100%',
      maxWidth: 560,
      maxHeight: '86%',
      borderWidth: 1,
      borderColor: t.border,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderBottomLeftRadius: l.isPhone ? 0 : 20,
      borderBottomRightRadius: l.isPhone ? 0 : 20,
      backgroundColor: t.surfaceRaised,
      overflow: 'hidden',
      ...shadow,
    },
    panelHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: l.isPhone ? 16 : 22,
      paddingTop: 18,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: t.divider,
    },
    panelTitle: { color: t.text, fontSize: 17, fontWeight: '800', flexGrow: 1, flexShrink: 1, minWidth: 0 , fontFamily: FONT_SANS },
    panelClose: {
      width: 44,
      height: 44,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceMuted,
    },
    panelScroll: { flexGrow: 0, flexShrink: 1 },
    panelScrollInner: { paddingHorizontal: l.isPhone ? 16 : 22, paddingVertical: 16, gap: 12 },
    panelIntro: { ...type.caption, color: t.textMuted },
    gpcNote: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 9,
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 12,
      backgroundColor: t.surfaceInset,
      padding: 12,
    },
    gpcNoteText: { ...type.caption, color: t.textMuted, flexGrow: 1, flexShrink: 1, minWidth: 0 },

    category: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceMuted,
      padding: 14,
      gap: 9,
    },
    categoryTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    categoryIcon: {
      width: 28,
      height: 28,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softFill(t.brand, t),
    },
    categoryTitle: { color: t.text, fontSize: 14, fontWeight: '800', flexGrow: 1, flexShrink: 1, minWidth: 0 , fontFamily: FONT_SANS },
    categoryAlways: {
      ...type.caption,
      color: t.chipText,
      backgroundColor: t.chipBg,
      lineHeight: 18,
      fontWeight: '700',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      overflow: 'hidden',
    },
    categoryBody: { ...type.caption, color: t.textMuted },
    categoryStored: {
      borderTopWidth: 1,
      borderTopColor: t.divider,
      paddingTop: 9,
      gap: 3,
    },
    categoryStoredLabel: {
      color: t.textSubtle,
      // the sanctioned sub-14 exception: a short uppercase, letter-spaced signpost
      fontSize: 12,
      fontFamily: FONT_SANS,
      lineHeight: 18,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    categoryStoredValue: { ...type.caption, color: t.textMuted },

    panelFoot: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 10,
      paddingHorizontal: l.isPhone ? 16 : 22,
      paddingTop: 14,
      paddingBottom: l.isPhone ? 20 : 18,
      borderTopWidth: 1,
      borderTopColor: t.divider,
    },

    /* -------------------------------------------------- toggle */
    toggleHit: {
      width: 60,
      height: 44,
      flexGrow: 0,
      flexShrink: 0,
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    toggleTrack: {
      width: 46,
      height: 26,
      borderRadius: 13,
      backgroundColor: t.surfaceInset,
      borderWidth: 1,
      borderColor: t.borderStrong,
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    toggleTrackOn: { backgroundColor: t.brand, borderColor: t.brand },
    toggleKnob: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: t.surfaceRaised,
      alignSelf: 'flex-start',
    },
    toggleKnobOn: { alignSelf: 'flex-end', backgroundColor: t.textOnBrand },

    /* -------------------------------------------------- footer + policy */
    footerLink: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      alignSelf: 'flex-start',
    },
    footerLinkText: { ...type.caption, color: t.textSubtle, fontWeight: '600' },
    footerLinkState: {
      ...type.caption,
      color: t.textSubtle,
      backgroundColor: t.surfaceInset,
      lineHeight: 18,
      fontWeight: '700',
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      overflow: 'hidden',
    },
    withdraw: {
      minHeight: 44,
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 11,
      backgroundColor: t.surface,
      paddingHorizontal: 16,
    },
    withdrawPrimary: { borderColor: t.brand, backgroundColor: t.brand },
    withdrawText: { ...type.caption, color: t.text, fontWeight: '700' },
    withdrawTextPrimary: { color: t.textOnBrand },
  });
}
