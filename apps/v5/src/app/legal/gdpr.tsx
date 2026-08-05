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

/**
 * One authoritative postal address for the entity, printed identically on every
 * legal page. See the note in privacy.tsx.
 */
const REGISTERED_ADDRESS = '548 Market St, PMB 72224, San Francisco, CA 94104, USA';

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
  { id: 'complaints', title: 'Complaints and Supervisory Authorities' },
  { id: 'contact', title: 'Contact the Data Protection Team' },
];

/**
 * A basis per purpose. A bare list of the six bases tells a reader nothing they
 * could not read in the Regulation itself; the mapping is what Article 13 asks
 * for, and it is kept identical to the one in the Privacy Policy.
 */
const LAWFUL_BASES: readonly [string, string][] = [
  [
    'Providing and operating the platform —',
    'performance of our contract with you (Article 6(1)(b)).',
  ],
  [
    'Billing, tax records and anti-fraud checks —',
    'compliance with a legal obligation (Article 6(1)(c)).',
  ],
  [
    'Security, abuse prevention and product improvement —',
    'our legitimate interests (Article 6(1)(f)), weighed against your rights and open to objection at any time.',
  ],
  [
    'Analytics and marketing storage on our website —',
    'your consent (Article 6(1)(a)), withdrawable at any time from Cookie settings.',
  ],
  [
    'Processing carried out for a customer —',
    'the customer’s own lawful basis. We act on their documented instructions and never for purposes of our own.',
  ],
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
            Our role depends on whose data it is, and the difference decides who answers a request.
          </LegalText>
          <LegalText>
            For the personal data you bring to FlowSmartly — your contacts, leads, message recipients
            and the people your campaigns reach — you are the controller and we are your processor. We
            process it only on your documented instructions, under the Data Processing Agreement in
            section 4.
          </LegalText>
          <LegalText>
            For the data we collect in our own right — website visitors, prospects, event attendees,
            and the account, billing and support records of the people who administer a FlowSmartly
            workspace — we are the controller ourselves. That processing is described in our Privacy
            Policy, and we answer those requests directly.
          </LegalText>
          <LegalText>
            The controller in that second case is FlowSmartly, Inc., {REGISTERED_ADDRESS}. Data
            protection questions and requests go to privacy@flowsmartly.com.
          </LegalText>
        </LegalSection>

        <LegalSection number={2} title="Lawful Bases">
          <LegalText>
            Every purpose needs its own lawful basis, so here they are purpose by purpose rather than
            as a list of bases in the abstract:
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
          <LegalText>
            Where we are the controller — you visited our site, wrote to us, attended an event, or
            hold a FlowSmartly account — send your request to privacy@flowsmartly.com and we handle it
            ourselves. We acknowledge it, confirm who you are, and answer within one month. If the
            request is genuinely complex we may extend by up to two further months, and we will tell
            you why before the first month is up.
          </LegalText>
          <LegalText>
            Where your data reached us because one of our customers uploaded it, that customer is the
            controller and only they can decide the request. Send it to us anyway: we identify the
            customer, forward it to them within five business days, tell you who they are, and support
            them in answering it as required by the DPA. We never leave a request unanswered on the
            grounds that it arrived at the wrong party.
          </LegalText>
          <LegalCallout icon="circle-question">
            You can also withdraw consent at any time where we rely on it, which is no harder than
            giving it and does not affect processing that already happened. And whatever we decide,
            you keep the right to complain to a supervisory authority — see section 10.
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
            FlowSmartly is established in the United States and some subprocessors operate elsewhere,
            so personal data does leave the European Economic Area. For those transfers we rely on the
            European Commission&apos;s Standard Contractual Clauses (Implementing Decision (EU)
            2021/914), on the UK International Data Transfer Addendum for transfers from the United
            Kingdom, and on the Swiss addendum recognized by the Federal Data Protection and
            Information Commissioner.
          </LegalText>
          <LegalText>
            We carry out a transfer impact assessment where the destination country calls for one, and
            we apply supplementary measures — encryption in transit and at rest, strict access control,
            and a commitment to challenge overbroad government requests for data — where they are
            needed to keep the protection essentially equivalent. A copy of the clauses we use is
            available on request from privacy@flowsmartly.com.
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
            Where we are the controller, we keep personal data on the schedule published in our
            Privacy Policy: account data for the life of the account and then up to 90 days, billing
            and tax records for seven years, support conversations for 24 months, security logs for 12
            months, and website analytics for up to 24 months.
          </LegalText>
          <LegalText>
            Where we process for a customer, we keep the data for as long as their agreement runs. On
            termination we delete or return it within 30 days of their request, and it leaves our
            backups within a further 35 days as the rolling backup cycle overwrites them — unless a
            law requires us to keep a specific record for longer. When a period ends, data is securely
            deleted or irreversibly anonymized.
          </LegalText>
        </LegalSection>

        <LegalSection number={10} title="Complaints and Supervisory Authorities">
          <LegalText>
            If you think we have handled personal data badly, tell us first if you are willing —
            privacy@flowsmartly.com reaches the people who can actually investigate it. That is an
            invitation, not a condition: nothing about it limits your right to go straight to a
            regulator.
          </LegalText>
          <LegalText>
            You may lodge a complaint with the supervisory authority in the EEA country where you
            live, where you work, or where the alleged infringement took place. In the United Kingdom
            that is the Information Commissioner&apos;s Office; in Switzerland, the Federal Data
            Protection and Information Commissioner. Where one of our customers is the controller, the
            complaint is normally made against them, and we will help both sides establish the facts.
          </LegalText>
        </LegalSection>

        <LegalSection number={11} title="Contact the Data Protection Team">
          <LegalText>
            For questions about this policy, our processing activities, or to raise a data protection
            concern, contact us:
          </LegalText>
          <LegalContactCard
            name="Data Protection Team"
            email="privacy@flowsmartly.com"
            detail={`FlowSmartly, Inc., ${REGISTERED_ADDRESS} — we acknowledge within 2 business days and answer within one month.`}
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
