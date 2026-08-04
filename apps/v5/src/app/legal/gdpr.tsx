import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  AsideCard,
  LegalBullets,
  LegalCallout,
  LegalContactCard,
  LegalLayout,
  LegalSection,
  LegalText,
  type DocSection,
} from '@/components/public/legal-page';
import { ROUTES } from '@/components/public/nav';
import { PageShell } from '@/components/public/page-shell';
import { breadcrumbJsonLd } from '@/components/public/seo';
import { PrimaryButton, SecondaryButton, useTypeScale, type TypeScale } from '@/components/public/ui';
import { contactHref } from '@/lib/destinations';
import { softFill, type ThemeTokens } from '@/theme/tokens';
import { BP, useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';

const SECTIONS: DocSection[] = [
  { id: 'role', title: 'Our Role' },
  { id: 'lawful-bases', title: 'Lawful Bases' },
  { id: 'rights', title: 'Data Subject Rights' },
  { id: 'dpa', title: 'Data Processing Agreement' },
  { id: 'subprocessors', title: 'Subprocessors' },
  { id: 'transfers', title: 'International Transfers' },
  { id: 'security', title: 'Security Measures' },
  { id: 'breach', title: 'Breach Response' },
  { id: 'retention', title: 'Retention and Deletion' },
  { id: 'contact', title: 'Contact the Data Protection Team' },
];

const LAWFUL_BASES: readonly [string, string][] = [
  ['Performance of a contract —', 'to provide and operate our services.'],
  ['Compliance with legal obligations —', 'to meet applicable laws and regulations.'],
  ['Legitimate interests —', 'to maintain service security, prevent fraud, and improve our platform.'],
  ['Consent —', 'where required, such as for marketing communications.'],
];

const RIGHTS: { icon: string; label: string }[] = [
  { icon: 'user-check', label: 'Right of access' },
  { icon: 'pen', label: 'Right to rectification' },
  { icon: 'trash', label: 'Right to erasure' },
  { icon: 'circle-pause', label: 'Right to restriction' },
  { icon: 'download', label: 'Right to data portability' },
  { icon: 'ban', label: 'Right to object' },
];

/**
 * The six GDPR rights as a wrapped grid of small bordered tiles.
 *
 * Column count comes from `useLayout()` only: `gridColumns(6)` already caps at
 * three below 1440, and the two narrow bands are named rather than derived so
 * six items always divide evenly and no row is left with a stretched orphan.
 */
function RightsGrid() {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  const styles = useMemo(() => createStyles(t, l, type), [t, l, type]);

  return (
    <View style={styles.grid}>
      {RIGHTS.map((right) => (
        <View key={right.label} style={styles.rightCard}>
          <View style={styles.rightIcon}>
            <FontAwesome6 name={right.icon as never} size={16} color={t.brand} />
          </View>
          <Text style={styles.rightLabel}>{right.label}</Text>
        </View>
      ))}
    </View>
  );
}

export default function GdprPage() {
  const router = useRouter();

  return (
    <PageShell
      title="GDPR & Data Protection"
      description="How FlowSmartly protects personal data, the lawful bases we rely on, and how we support our customers' GDPR compliance."
      cta={false}
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'GDPR & Data Protection', path: ROUTES.gdpr },
        ]),
      ]}>
      <LegalLayout
        title="GDPR & Data Protection"
        updated="August 3, 2026"
        intro="FlowSmartly is committed to protecting personal data and helping our customers comply with the General Data Protection Regulation (EU) 2016/679 (GDPR) and other applicable data protection laws."
        sections={SECTIONS}
        sidebarCard={
          <AsideCard icon="shield-halved" title="Your privacy, built in">
            <LegalText>
              We design our platform and processes to protect personal data and earn your trust every
              day.
            </LegalText>
          </AsideCard>
        }>
        <LegalSection number={1} title="Our Role">
          <LegalText>
            You are the data controller for the personal data you bring to FlowSmartly, and we act as
            a data processor on your behalf. We process personal data only to provide, secure, and
            improve our services, in accordance with your instructions and this policy.
          </LegalText>
        </LegalSection>

        <LegalSection number={2} title="Lawful Bases">
          <LegalText>
            We rely on the following lawful bases when processing personal data through FlowSmartly:
          </LegalText>
          <LegalBullets items={LAWFUL_BASES} />
          <LegalCallout>
            We only process special categories of personal data or data about criminal convictions
            when strictly necessary and permitted by law, and with appropriate safeguards in place.
          </LegalCallout>
        </LegalSection>

        <LegalSection number={3} title="Data Subject Rights">
          <LegalText>
            Data subjects whose personal data is processed through FlowSmartly have the following
            rights under GDPR:
          </LegalText>
          <RightsGrid />
          <LegalCallout icon="circle-question">
            To exercise your rights, contact your organization&apos;s data protection team. They will
            handle your request in accordance with GDPR.
          </LegalCallout>
        </LegalSection>

        <LegalSection number={4} title="Data Processing Agreement">
          <LegalText>
            We maintain a Data Processing Agreement (DPA) with our customers governing the processing
            of personal data in accordance with GDPR. It sets out our responsibilities as a
            processor, your obligations as a controller, data security requirements, the use of
            subprocessors, and international transfer mechanisms.
          </LegalText>
          <PrimaryButton
            label="Download DPA"
            icon="download"
            size="sm"
            trackId="gdpr.dpa.download"
            onPress={() => router.push(contactHref('dpa') as never)}
          />
        </LegalSection>

        <LegalSection number={5} title="Subprocessors">
          <LegalText>
            We use a small number of carefully selected subprocessors to deliver our services. Each
            one is contractually bound to protect personal data and to process it only on our behalf
            and on our documented instructions.
          </LegalText>
          {/* The subprocessor list is published with the DPA rather than as its
              own page, so both requests route to the same place. */}
          <SecondaryButton
            label="View subprocessors"
            icon="arrow-right"
            iconRight
            size="sm"
            trackId="gdpr.subprocessors.request"
            onPress={() => router.push(contactHref('dpa') as never)}
          />
        </LegalSection>

        <LegalSection number={6} title="International Transfers">
          <LegalText>
            Where personal data is transferred outside the European Economic Area, we rely on
            approved transfer mechanisms such as the European Commission&apos;s Standard Contractual
            Clauses (SCCs), and we implement additional technical and organizational measures where
            they are needed to protect the data.
          </LegalText>
        </LegalSection>

        <LegalSection number={7} title="Security Measures">
          <LegalText>
            We protect personal data with encryption in transit and at rest, role-based access
            controls, regular security testing, and continuous monitoring of our infrastructure and
            applications.
          </LegalText>
        </LegalSection>

        <LegalSection number={8} title="Breach Response">
          <LegalText>
            If a personal data breach occurs, we notify affected customers without undue delay and,
            where required, the relevant supervisory authority within 72 hours of becoming aware of
            the breach.
          </LegalText>
        </LegalSection>

        <LegalSection number={9} title="Retention and Deletion">
          <LegalText>
            Personal data is retained only as long as necessary for the purposes it was collected
            for, in line with the DPA and applicable law. When it is no longer needed, it is securely
            deleted or anonymized.
          </LegalText>
        </LegalSection>

        <LegalSection number={10} title="Contact the Data Protection Team">
          <LegalText>
            For questions about this policy, our processing activities, or to raise a data protection
            concern, contact us:
          </LegalText>
          <LegalContactCard
            name="Data Protection Team"
            email="privacy@flowsmartly.com"
            detail="We typically respond within 2 business days."
          />
        </LegalSection>
      </LegalLayout>
    </PageShell>
  );
}

function createStyles(t: ThemeTokens, l: Layout, type: TypeScale) {
  const gap = l.isPhone ? 10 : 12;
  const columns = l.isPhone ? 2 : l.isTablet ? 3 : l.gridColumns(6);

  /**
   * Percentage basis for one cell, with the px gaps discounted against the real
   * container width. A basis of `100 / columns` would overflow the row the
   * moment a gap is added and drop the last tile onto a line of its own.
   */
  const container = Math.max(
    260,
    Math.min(l.width, BP.maxContent) - l.gutter * 2 - l.sectionPad * 2 - (l.isStacked ? 0 : 258) - 38,
  );
  const gapPct = ((gap * (columns - 1)) / container) * 100;
  const basis = `${Math.max(
    12,
    Math.floor(((100 - gapPct - 0.5) / columns) * 100) / 100,
  )}%` as `${number}%`;

  return StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap, marginTop: 2 },
    rightCard: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: basis,
      minWidth: 0,
      minHeight: 96,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 9,
      paddingVertical: 14,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 13,
      backgroundColor: t.surfaceMuted,
    },
    rightIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softFill(t.brand, t),
    },
    rightLabel: {
      ...type.caption,
      color: t.text,
      fontWeight: '700',
      textAlign: 'center',
    },
  });
}
