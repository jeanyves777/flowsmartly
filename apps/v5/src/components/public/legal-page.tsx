import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useMemo } from 'react';
import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { accentText, elevation, type ThemeTokens } from '@/theme/tokens';
import { useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';
import { Reveal } from './motion';
import { Heading, SectionLabel, useOpenSection, useTypeScale, type TypeScale } from './ui';

/**
 * The company behind FlowSmartly.
 *
 * FlowSmartly is the product; General Computing Solutions is the entity that
 * provides it. The distinction surfaces only where it legally has to — the
 * contracting party, the data controller, the address on a contact card.
 * Everywhere else on the site the product is what a visitor is dealing with,
 * and naming the parent in the interface would be noise rather than clarity.
 *
 * One definition, imported by all five legal pages. It used to be the same
 * string copied into five route files, which is precisely how they were free to
 * drift apart from each other — and did.
 */
export const LEGAL_ENTITY = 'General Computing Solutions';
export const REGISTERED_ADDRESS = '132 Lincoln St, Pittsfield, MA 01201, USA';

export type DocSection = { id: string; title: string };

/* ------------------------------------------------------------------ */
/* layout                                                              */
/* ------------------------------------------------------------------ */

export function LegalLayout({
  title,
  updated,
  intro,
  sections,
  sidebarCard,
  aside,
  children,
}: {
  title: string;
  updated: string;
  intro: string;
  /** drives the "On this page" rail; keep in the same order as the body */
  sections: DocSection[];
  /** optional promo card under the table of contents */
  sidebarCard?: React.ReactNode;
  /** optional right-hand rail of cards */
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  const styles = useDocStyles();
  const type = useTypeScale();
  const l = useLayout();
  const open = useOpenSection();

  return (
    <View style={[open, styles.shell]}>
      <View style={styles.frame}>
        {!l.isStacked ? (
          <View style={styles.rail}>
            <View style={styles.railInner}>
              <Text style={styles.railHeading}>On this page</Text>
              {sections.map((section, index) => (
                <View key={section.id} style={styles.railRow}>
                  <Text style={[styles.railLink, index === 0 && styles.railLinkActive]} numberOfLines={2}>
                    {index + 1}. {section.title}
                  </Text>
                </View>
              ))}
              {sidebarCard ? <View style={styles.railCard}>{sidebarCard}</View> : null}
            </View>
          </View>
        ) : null}

        <View style={styles.body}>
          <SectionLabel>LEGAL</SectionLabel>
          <Heading level={1} style={[type.display, styles.title]}>
            {title}
          </Heading>
          <Text style={[type.caption, styles.updated]}>Last updated {updated}</Text>
          <Text style={[type.body, styles.intro]}>{intro}</Text>
          <View style={styles.divider} />
          <View style={styles.sections}>{children}</View>
        </View>

        {aside && !l.isCompact ? <View style={styles.aside}>{aside}</View> : null}
      </View>

      {/* On narrow widths the rail cards drop below the body rather than vanish */}
      {aside && l.isCompact ? <View style={styles.asideStacked}>{aside}</View> : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* pieces                                                              */
/* ------------------------------------------------------------------ */

export function LegalSection({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  const styles = useDocStyles();
  const type = useTypeScale();
  return (
    <Reveal style={styles.section} distance={14}>
      <View style={styles.sectionHead}>
        <View style={styles.sectionNumber}>
          <Text style={styles.sectionNumberText}>{number}</Text>
        </View>
        <Heading level={2} style={[type.h3, styles.sectionTitle]}>
          {title}
        </Heading>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </Reveal>
  );
}

export function LegalText({ children }: { children: React.ReactNode }) {
  const styles = useDocStyles();
  const type = useTypeScale();
  return <Text style={[type.bodySm, styles.paragraph]}>{children}</Text>;
}

export function LegalBullets({ items }: { items: readonly (string | [string, string])[] }) {
  const styles = useDocStyles();
  const type = useTypeScale();
  const t = useTokens();
  return (
    <View style={styles.bullets}>
      {items.map((item) => {
        const [lead, rest] = Array.isArray(item) ? item : [null, item];
        const key = Array.isArray(item) ? item[0] : item;
        return (
          <View key={key} style={styles.bulletRow}>
            <View style={styles.bulletDot}>
              <FontAwesome6 name="circle-check" size={13} color={t.brand}  aria-hidden={true}/>
            </View>
            <Text style={[type.bodySm, styles.paragraph, styles.bulletText]}>
              {lead ? <Text style={styles.bulletLead}>{lead} </Text> : null}
              {rest}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function LegalCallout({ children, icon = 'circle-info' }: { children: React.ReactNode; icon?: string }) {
  const styles = useDocStyles();
  const type = useTypeScale();
  const t = useTokens();
  return (
    <View style={styles.callout}>
      <FontAwesome6 name={icon as never} size={15} color={t.brand}  aria-hidden={true}/>
      <Text style={[type.bodySm, styles.calloutText]}>{children}</Text>
    </View>
  );
}

export function LegalContactCard({
  name,
  email,
  detail,
}: {
  name: string;
  email: string;
  detail?: string;
}) {
  const styles = useDocStyles();
  const type = useTypeScale();
  const t = useTokens();
  return (
    <View style={styles.contactCard}>
      <View style={styles.contactIcon}>
        <FontAwesome6 name="envelope" size={17} color={t.brand}  aria-hidden={true}/>
      </View>
      <View style={styles.contactCopy}>
        <Text style={[type.h4, styles.contactName]}>{name}</Text>
        <Text style={[type.bodySm, styles.contactEmail]}>{email}</Text>
        {detail ? <Text style={[type.bodySm, styles.paragraph]}>{detail}</Text> : null}
      </View>
    </View>
  );
}

export function AsideCard({
  icon,
  title,
  children,
  linkLabel,
  tone = 'brand',
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
  linkLabel?: string;
  tone?: 'brand' | 'violet' | 'orange';
}) {
  const styles = useDocStyles();
  const type = useTypeScale();
  const t = useTokens();
  const accent = tone === 'violet' ? t.violet : tone === 'orange' ? t.orange : t.brand;
  return (
    <View style={styles.asideCard}>
      <View style={[styles.asideIcon, { backgroundColor: t.brandSoft }]}>
        <FontAwesome6 name={icon as never} size={17} color={accent}  aria-hidden={true}/>
      </View>
      <Text style={[type.h4, styles.asideTitle]}>{title}</Text>
      <View style={styles.asideBody}>{children}</View>
      {linkLabel ? <Text style={[type.bodySm, { color: accentText(accent, t), fontWeight: '700' }]}>{linkLabel} →</Text> : null}
    </View>
  );
}

export function AsideChecklist({ items }: { items: readonly string[] }) {
  const styles = useDocStyles();
  const type = useTypeScale();
  const t = useTokens();
  return (
    <View style={styles.checklist}>
      {items.map((item) => (
        <View key={item} style={styles.checkRow}>
          <FontAwesome6 name="circle-check" size={14} color={t.brand}  aria-hidden={true}/>
          <Text style={[type.bodySm, styles.checkText]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* styles                                                              */
/* ------------------------------------------------------------------ */

function useDocStyles() {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  return useMemo(() => createStyles(t, l, type), [t, l, type]);
}

function createStyles(t: ThemeTokens, l: Layout, type: TypeScale) {
  const sticky = Platform.OS === 'web' ? ({ position: 'sticky', top: 92 } as unknown as ViewStyle) : {};
  return StyleSheet.create({
    shell: { paddingTop: l.isPhone ? 22 : 34 },
    frame: {
      flexDirection: l.isStacked ? 'column' : 'row',
      alignItems: 'flex-start',
      gap: l.isStacked ? 24 : 34,
    },

    rail: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: 224 },
    railInner: { ...sticky, gap: 2 },
    railHeading: { ...type.bodySm, color: t.text, fontWeight: '800', marginBottom: 8 },
    railRow: { minHeight: 34, justifyContent: 'center' },
    railLink: { ...type.caption, color: t.textMuted },
    railLinkActive: { color: accentText(t.brand, t), fontWeight: '700' },
    // The card passed in brings its own border and surface — a second frame
    // here would double-box it.
    railCard: { marginTop: 22 },

    body: l.isStacked
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    title: { marginTop: 10 },
    updated: { marginTop: 8, color: t.textSubtle },
    intro: { marginTop: 16, maxWidth: 680 },
    divider: { height: 1, backgroundColor: t.border, marginTop: 26 },
    sections: { marginTop: 26, gap: l.isPhone ? 26 : 30 },

    section: { gap: 10 },
    sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    sectionNumber: {
      width: 26,
      height: 26,
      flexShrink: 0,
      borderRadius: 13,
      backgroundColor: t.brand,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionNumberText: { ...type.caption, color: t.textOnBrand, lineHeight: 18, fontWeight: '800' },
    sectionTitle: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
    sectionBody: { paddingLeft: 38, gap: 12 },
    paragraph: { color: t.textMuted, maxWidth: 700 },

    bullets: { gap: 9 },
    bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    bulletDot: { paddingTop: 3, flexShrink: 0 },
    bulletText: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0 },
    bulletLead: { color: t.text, fontWeight: '700' },

    callout: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 11,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceMuted,
    },
    calloutText: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, color: t.textMuted },

    contactCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 16,
      borderRadius: 14,
      backgroundColor: t.surfaceMuted,
      borderWidth: 1,
      borderColor: t.border,
    },
    contactIcon: {
      width: 46,
      height: 46,
      flexShrink: 0,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
    },
    contactCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    contactName: {},
    contactEmail: { color: accentText(t.brand, t), fontWeight: '700' },

    aside: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: 268, gap: 16 },
    asideStacked: { marginTop: 26, gap: 16 },
    asideCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceRaised,
      padding: 18,
      gap: 10,
      ...(elevation(t, 1) as object),
    },
    asideIcon: {
      width: 42,
      height: 42,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    asideTitle: {},
    asideBody: { gap: 8 },

    checklist: { gap: 9 },
    checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
    checkText: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, color: t.textMuted },
  });
}
