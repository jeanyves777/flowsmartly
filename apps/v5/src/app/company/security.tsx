import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
  Linking,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
  type ImageStyle,
  type ViewStyle,
} from 'react-native';
import { Media } from '@/components/public/media';
import { Reveal } from '@/components/public/motion';
import { ROUTES } from '@/components/public/nav';
import { PageShell } from '@/components/public/page-shell';
import { breadcrumbJsonLd } from '@/components/public/seo';
import {
  ButtonRow,
  Heading,
  PrimaryButton,
  SecondaryButton,
  Band,
  OpenSection,
  SectionLabel,
  useTypeScale,
  type TypeScale,
} from '@/components/public/ui';
import { contactHref } from '@/lib/destinations';
import { accentText, elevation, softFill, type ThemeTokens } from '@/theme/tokens';
import { cellBasis, useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';

/* ------------------------------------------------------------------ */
/* tones                                                               */
/* ------------------------------------------------------------------ */

type Tone = 'brand' | 'violet' | 'orange' | 'green' | 'pink';

function accent(t: ThemeTokens, tone: Tone): string {
  return tone === 'violet'
    ? t.violet
    : tone === 'orange'
      ? t.orange
      : tone === 'green'
        ? t.green
        : tone === 'pink'
          ? t.pink
          : t.brand;
}

/* ------------------------------------------------------------------ */
/* content                                                             */
/* ------------------------------------------------------------------ */

/**
 * Compliance marks are drawn as token-styled badges rather than logo images:
 * an auditor's mark is licensed artwork, and a redrawn look-alike is exactly
 * the kind of fake the brand rules forbid.
 */
type Badge = { name: string; note: string; icon: string; tone: Tone };

const BADGES: Badge[] = [
  { name: 'SOC 2 Type II', note: 'Audited annually', icon: 'file-shield', tone: 'brand' },
  { name: 'GDPR', note: 'DPA and SCCs', icon: 'earth-europe', tone: 'violet' },
  { name: 'CCPA', note: 'Opt-out honored', icon: 'scale-balanced', tone: 'orange' },
  { name: 'ISO 27001', note: 'ISMS certified', icon: 'certificate', tone: 'green' },
  { name: 'HIPAA-ready', note: 'BAA available', icon: 'briefcase-medical', tone: 'pink' },
];

type Protection = { title: string; body: string; icon: string; tone: Tone };

const PROTECTIONS: Protection[] = [
  {
    title: 'Encryption in transit and at rest',
    body: 'TLS 1.2 or better on every connection, AES-256 for stored data, and the same treatment for every backup and export.',
    icon: 'lock',
    tone: 'brand',
  },
  {
    title: 'Least-privilege access',
    body: 'Staff access is granted by role, scoped to the task, reviewed every quarter, and removed automatically when someone changes team.',
    icon: 'user-lock',
    tone: 'violet',
  },
  {
    title: 'Continuous monitoring',
    body: 'Infrastructure, application and audit events stream into a detection pipeline that pages an on-call engineer around the clock.',
    icon: 'gauge-high',
    tone: 'orange',
  },
  {
    title: 'Secure development lifecycle',
    body: 'Peer review, dependency scanning, secret detection and automated security tests gate every change before it can deploy.',
    icon: 'code-branch',
    tone: 'green',
  },
  {
    title: 'Vendor due diligence',
    body: 'Every subprocessor is security-reviewed before it touches customer data, bound by contract, and re-reviewed each year.',
    icon: 'clipboard-check',
    tone: 'pink',
  },
  {
    title: 'Business continuity',
    body: 'Encrypted backups, multi-zone failover and a documented recovery plan that we rehearse twice a year against real targets.',
    icon: 'server',
    tone: 'brand',
  },
];

type Control = { title: string; body: string; icon: string; tone: Tone };

const CONTROLS: Control[] = [
  {
    title: 'Role-based permissions',
    body: 'Give each teammate exactly the access their job needs — down to a single channel, campaign or store.',
    icon: 'users-gear',
    tone: 'brand',
  },
  {
    title: 'SSO & SAML',
    body: 'Bring your own identity provider, enforce your MFA and password rules, and de-provision people in one place.',
    icon: 'key',
    tone: 'violet',
  },
  {
    title: 'Audit logs',
    body: 'Every sign-in, permission change, export and send is recorded with who did it, what changed and when.',
    icon: 'list-check',
    tone: 'orange',
  },
  {
    title: 'Data export',
    body: 'Take contacts, content and reporting out on demand, in open formats, without asking anyone for permission.',
    icon: 'download',
    tone: 'green',
  },
  {
    title: 'Data deletion',
    body: 'Delete a contact, a workspace or everything, with a documented deletion window and written confirmation when it is done.',
    icon: 'trash',
    tone: 'pink',
  },
];

type Test = { title: string; cadence: string; body: string; icon: string; tone: Tone };

const TESTING: Test[] = [
  {
    title: 'Penetration testing',
    cadence: 'Twice a year',
    body: 'An independent firm tests the platform, the API and the infrastructure every six months, and again before any major architectural change. Summary reports are available under NDA.',
    icon: 'user-secret',
    tone: 'brand',
  },
  {
    title: 'Bug bounty',
    cadence: 'Always open',
    body: 'A researcher programme with published scope, defined reward tiers and safe-harbour terms, so good-faith testing is welcome rather than risky.',
    icon: 'bug',
    tone: 'orange',
  },
  {
    title: 'Third-party audits',
    cadence: 'Annual',
    body: 'SOC 2 Type II and ISO 27001 assessments are carried out each year by accredited external auditors, covering security, availability and confidentiality.',
    icon: 'file-circle-check',
    tone: 'green',
  },
];

type Step = { key: string; label: string; body: string; icon: string; tone: Tone };

const STEPS: Step[] = [
  {
    key: 'detect',
    label: 'Detect',
    body: 'Automated alerting and 24/7 on-call put a named responder on the incident within minutes of the first signal.',
    icon: 'satellite-dish',
    tone: 'brand',
  },
  {
    key: 'contain',
    label: 'Contain',
    body: 'An incident commander isolates the affected systems, rotates credentials and stops the blast radius from growing.',
    icon: 'shield-halved',
    tone: 'violet',
  },
  {
    key: 'notify',
    label: 'Notify',
    body: 'Affected customers hear from us without undue delay, and supervisory authorities within 72 hours where the law requires it.',
    icon: 'bell',
    tone: 'orange',
  },
  {
    key: 'learn',
    label: 'Learn',
    body: 'A blameless post-mortem, a written summary for customers, and tracked fixes with an owner and a date on each one.',
    icon: 'magnifying-glass-chart',
    tone: 'green',
  },
];

const REGIONS: { region: string; location: string; icon: string }[] = [
  { region: 'United States', location: 'Primary region, with multi-zone replication', icon: 'flag-usa' },
  { region: 'European Union', location: 'Frankfurt, for customers who elect EU residency', icon: 'earth-europe' },
  { region: 'United Kingdom', location: 'London, available on request', icon: 'city' },
  { region: 'Australia', location: 'Sydney, available on request', icon: 'earth-oceania' },
];

/** The one address on this page, used by every "email security" affordance. */
const SECURITY_INBOX = 'security@flowsmartly.com';

/**
 * What is actually inside the document the hero's primary CTA asks for. The
 * copy column was 213px shorter than the art beside it, and a reviewer deciding
 * whether to request the overview is exactly the person who wants its contents
 * listed. It describes the document, so it does not restate the sections below.
 */
const OVERVIEW_CONTENTS: string[] = [
  'Architecture, data flow, and where each system runs',
  'The control matrix, mapped framework by framework',
  'Our subprocessor list and the residency options',
  'A completed security questionnaire your reviewers can lift from',
];

const DISCLOSURE: string[] = [
  'Write to security@flowsmartly.com with the steps to reproduce and any proof-of-concept you have.',
  'We acknowledge every report within one business day and give you a triage decision within five.',
  'Good-faith research is covered by safe harbour — we will not pursue legal action for it.',
  'Please hold public disclosure for 90 days, and never access, modify or keep data that is not yours.',
];

/* ------------------------------------------------------------------ */
/* shared style hook                                                   */
/* ------------------------------------------------------------------ */

type Styles = ReturnType<typeof createStyles>;

function useStyles(): Styles {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  return useMemo(() => createStyles(t, l, type), [t, l, type]);
}

/* ------------------------------------------------------------------ */
/* pieces                                                              */
/* ------------------------------------------------------------------ */

function IconTile({ icon, tone, size = 46 }: { icon: string; tone: Tone; size?: number }) {
  const t = useTokens();
  const color = accent(t, tone);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
        flexGrow: 0,
        flexShrink: 0,
        backgroundColor: softFill(color, t),
      }}>
      <FontAwesome6 name={icon as never} size={Math.round(size * 0.42)} color={color} />
    </View>
  );
}

function SectionHead({ label, title, body }: { label?: string; title: string; body?: string }) {
  const styles = useStyles();
  return (
    <Reveal style={styles.head} distance={14}>
      {label ? <SectionLabel>{label}</SectionLabel> : null}
      <Heading level={2} style={styles.headTitle}>
        {title}
      </Heading>
      {body ? <Text style={styles.headBody}>{body}</Text> : null}
    </Reveal>
  );
}

/* ------------------------------------------------------------------ */
/* sections                                                            */
/* ------------------------------------------------------------------ */

function Hero() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const router = useRouter();

  return (
    <OpenSection style={styles.heroSection}>
      <Reveal style={styles.heroCopy} distance={16}>
        <SectionLabel>TRUST &amp; SECURITY</SectionLabel>
        <Heading level={1} style={styles.heroTitle}>
          Security you can hand to your compliance team.
        </Heading>
        <Text style={styles.heroBody}>
          FlowSmartly protects customer data with encryption, least-privilege access, continuous
          monitoring, and independent audits.
        </Text>
        <ButtonRow>
          <PrimaryButton
            label="Download security overview"
            size="lg"
            icon="download"
            full={l.isPhone}
            trackId="security.hero.download-overview"
            onPress={() => router.push(contactHref('security-overview') as never)}
          />
          <SecondaryButton
            label="Contact security"
            size="lg"
            icon="envelope"
            full={l.isPhone}
            trackId="security.hero.contact"
            onPress={() => Linking.openURL(`mailto:${SECURITY_INBOX}`)}
          />
        </ButtonRow>

        <View style={styles.overview}>
          <Text style={styles.overviewTitle}>In the security overview</Text>
          {OVERVIEW_CONTENTS.map((line) => (
            <View key={line} style={styles.overviewRow}>
              <View style={styles.overviewDot}>
                <FontAwesome6 name="check" size={9} color={t.green} />
              </View>
              <Text style={styles.overviewText}>{line}</Text>
            </View>
          ))}
        </View>
      </Reveal>

      <Reveal style={styles.heroPanel} distance={18} delay={90}>
        <View style={styles.heroArtFrame}>
          <Media
            name="editorial/security-shield"
            alt="An illustration of the FlowSmartly platform protected by layered security controls"
            style={styles.heroArt}
            radius={14}
          />
        </View>
      </Reveal>
    </OpenSection>
  );
}

function Compliance() {
  const t = useTokens();
  const styles = useStyles();
  const l = useLayout();
  // Five badges: one column on a phone, five across everywhere else. Anything
  // in between (two, three) leaves a stretched orphan on the last row.
  const columns = l.isPhone ? 1 : 5;

  return (
    <Band tone="surface" art={{ variant: 'tasks', color: t.brand, side: 'right' }}>
      <SectionHead
        label="COMPLIANCE"
        title="The frameworks we are held to."
        body="Independently assessed, contractually backed, and re-tested every year — not a self-declaration."
      />

      <View style={styles.grid}>
        {BADGES.map((badge, index) => (
          <Reveal
            key={badge.name}
            delay={40 + index * 60}
            distance={12}
            style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
            <View style={[styles.badgeCard, l.isPhone ? styles.badgeCardRow : null]}>
              <IconTile icon={badge.icon} tone={badge.tone} size={l.isPhone ? 44 : 46} />
              <View style={l.isPhone ? styles.badgeCopyRow : styles.badgeCopy}>
                <Text style={[styles.badgeName, l.isPhone ? styles.alignLeft : null]}>{badge.name}</Text>
                <Text style={[styles.badgeNote, l.isPhone ? styles.alignLeft : null]}>{badge.note}</Text>
              </View>
            </View>
          </Reveal>
        ))}
      </View>
    </Band>
  );
}

function Protections() {
  const t = useTokens();
  const styles = useStyles();
  const l = useLayout();
  const columns = l.isPhone ? 1 : l.isTablet ? 2 : 3;

  return (
    <Band tone="brand" art={{ variant: 'shield', color: t.brand, side: 'left' }}>
      <SectionHead
        label="HOW WE PROTECT YOUR DATA"
        title="Six controls that run whether or not anyone is watching."
        body="They are engineering defaults rather than policies in a binder — every one of them is enforced in the platform itself."
      />

      <View style={styles.grid}>
        {PROTECTIONS.map((item, index) => (
          <Reveal
            key={item.title}
            delay={50 + index * 60}
            distance={12}
            style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
            <View style={styles.protectionCard}>
              <IconTile icon={item.icon} tone={item.tone} />
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardBody}>{item.body}</Text>
            </View>
          </Reveal>
        ))}
      </View>
    </Band>
  );
}

function Controls() {
  const styles = useStyles();
  const l = useLayout();

  return (
    <OpenSection>
      <SectionHead
        label="YOUR CONTROLS"
        title="What you can enforce yourself."
        body="Security is not something we do to your workspace on your behalf. These are switches your admins own."
      />

      <View style={styles.controlList}>
        {CONTROLS.map((control, index) => (
          <Reveal key={control.title} delay={40 + index * 55} distance={10}>
            <View style={[styles.controlRow, l.isPhone ? styles.controlRowPhone : null]}>
              <IconTile icon={control.icon} tone={control.tone} size={44} />
              <View style={styles.controlCopy}>
                <Text style={styles.controlTitle}>{control.title}</Text>
                <Text style={styles.cardBody}>{control.body}</Text>
              </View>
            </View>
          </Reveal>
        ))}
      </View>
    </OpenSection>
  );
}

function Testing() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const columns = l.isCompact ? 1 : 3;

  return (
    <Band tone="surface" art={{ variant: 'analytics', color: t.brand, side: 'right' }}>
      <SectionHead
        label="INDEPENDENT TESTING"
        title="We do not grade our own homework."
        body="Outside researchers and accredited auditors test the same platform your team uses, on a published cadence."
      />

      <View style={styles.grid}>
        {TESTING.map((item, index) => (
          <Reveal
            key={item.title}
            delay={50 + index * 70}
            distance={12}
            style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
            <View style={styles.testCard}>
              <IconTile icon={item.icon} tone={item.tone} />
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardBody}>{item.body}</Text>
              <View style={styles.cardSpacer} />
              <View style={[styles.chip, { backgroundColor: softFill(accent(t, item.tone), t) }]}>
                <Text style={[styles.chipText, { color: accentText(accent(t, item.tone), t) }]}>{item.cadence}</Text>
              </View>
            </View>
          </Reveal>
        ))}
      </View>
    </Band>
  );
}

function IncidentResponse() {
  const styles = useStyles();
  const t = useTokens();

  return (
    <Band tone="brand" art={{ variant: 'api', color: t.brand, side: 'left' }}>
      <SectionHead
        label="INCIDENT RESPONSE"
        title="What happens in the first hour, and the first week."
        body="One rehearsed runbook, the same every time, with a written commitment on when you hear from us."
      />

      {/*
        A single rail drawn behind the markers, rather than a border per card, so
        it stays attached when the row reflows into a vertical column.
      */}
      <View style={styles.timeline}>
        <View style={styles.timelineRail} />
        <View style={styles.timelineTrack}>
          {STEPS.map((step) => {
            const color = accent(t, step.tone);
            return (
              <View key={step.key} style={styles.timelineItem}>
                <View style={[styles.timelineDot, { borderColor: color }]}>
                  <FontAwesome6 name={step.icon as never} size={15} color={color} />
                </View>
                <View style={styles.timelineCopy}>
                  <Text style={[styles.timelineLabel, { color }]}>{step.label}</Text>
                  <Text style={styles.timelineBody}>{step.body}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      <Reveal style={styles.commitment} distance={12}>
        <IconTile icon="clock" tone="orange" size={48} />
        <View style={styles.commitmentCopy}>
          <Text style={styles.commitmentTitle}>The 72-hour notification commitment</Text>
          <Text style={styles.cardBody}>
            If a personal data breach affects your workspace, we notify you without undue delay and, where
            the law requires it, the relevant supervisory authority within 72 hours of becoming aware —
            with what happened, what data was involved, and what we have already done about it.
          </Text>
        </View>
      </Reveal>
    </Band>
  );
}

function Residency() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const router = useRouter();

  return (
    <OpenSection>
      <SectionHead
        label="SUBPROCESSORS AND DATA RESIDENCY"
        title="Where your data lives, and who else can see it."
        body="A short, published list of subprocessors, and a region you choose rather than one you inherit."
      />

      <View style={styles.splitRow}>
        <Reveal style={styles.splitCell} distance={14}>
          <View style={styles.splitCard}>
            <IconTile icon="handshake-angle" tone="brand" />
            <Text style={styles.cardTitle}>Subprocessors</Text>
            <Text style={styles.cardBody}>
              We use a deliberately small number of subprocessors for infrastructure, delivery and
              support. Each one is security-reviewed before it is engaged, bound to process data only on
              our documented instructions, and listed publicly with what it does and where it operates.
            </Text>
            <Text style={styles.cardBody}>
              Customers on a data processing agreement are notified before a new subprocessor is added,
              with time to object.
            </Text>
            <View style={styles.cardSpacer} />
            <SecondaryButton
              label="Read GDPR and data protection"
              icon="arrow-right"
              iconRight
              size="sm"
              full={l.isPhone}
              trackId="security.subprocessors.gdpr"
              onPress={() => router.push(ROUTES.gdpr as never)}
            />
          </View>
        </Reveal>

        <Reveal style={styles.splitCell} distance={14} delay={80}>
          <View style={styles.splitCard}>
            <IconTile icon="globe" tone="violet" />
            <Text style={styles.cardTitle}>Data residency</Text>
            <Text style={styles.cardBody}>
              Choose the region your workspace data is stored and processed in. Transfers outside it rely
              on approved mechanisms such as Standard Contractual Clauses, with the additional safeguards
              those clauses require.
            </Text>
            <View style={styles.regionList}>
              {REGIONS.map((item) => (
                <View key={item.region} style={styles.regionRow}>
                  <View style={styles.regionIcon}>
                    <FontAwesome6 name={item.icon as never} size={14} color={t.brand} />
                  </View>
                  <View style={styles.regionCopy}>
                    <Text style={styles.regionName}>{item.region}</Text>
                    <Text style={styles.regionNote}>{item.location}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </Reveal>
      </View>
    </OpenSection>
  );
}

function Vulnerability() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();

  return (
    <Band tone="surface" art={{ variant: 'network', color: t.brand, side: 'right' }}>
      <Reveal style={styles.reportCard} distance={14}>
        <View style={styles.reportHead}>
          <IconTile icon="shield-virus" tone="pink" size={54} />
          <View style={styles.reportHeadCopy}>
            <Heading level={2} style={styles.reportTitle}>
              Report a vulnerability
            </Heading>
            <Text style={styles.cardBody}>
              Found something? Tell us before you tell anyone else, and we will treat it as the favour it
              is. Reports go straight to the security team, not to a shared inbox.
            </Text>
          </View>
        </View>

        <View style={styles.addressRow}>
          <View style={styles.addressIcon}>
            <FontAwesome6 name="envelope" size={16} color={t.brand} />
          </View>
          <View style={styles.addressCopy}>
            <Text style={styles.addressLabel}>Dedicated address</Text>
            <Text style={styles.addressValue}>{SECURITY_INBOX}</Text>
          </View>
          <View style={styles.addressCopy}>
            <Text style={styles.addressLabel}>PGP key</Text>
            <Text style={styles.addressValue}>flowsmartly.com/.well-known/security.txt</Text>
          </View>
        </View>

        <Text style={styles.disclosureHeading}>Coordinated disclosure, in four lines</Text>
        <View style={styles.disclosureList}>
          {DISCLOSURE.map((line) => (
            <View key={line} style={styles.disclosureRow}>
              <View style={styles.disclosureDot}>
                <FontAwesome6 name="circle-check" size={13} color={t.green} />
              </View>
              <Text style={styles.disclosureText}>{line}</Text>
            </View>
          ))}
        </View>

        <View style={styles.reportButtons}>
          <PrimaryButton
            label="Email the security team"
            icon="paper-plane"
            full={l.isPhone}
            trackId="security.report.email-team"
            onPress={() =>
              Linking.openURL(
                `mailto:${SECURITY_INBOX}?subject=${encodeURIComponent('Vulnerability report')}`,
              )
            }
          />
        </View>
      </Reveal>
    </Band>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function SecurityPage() {
  return (
    <PageShell
      title="Security"
      description="FlowSmartly protects customer data with encryption, least-privilege access, continuous monitoring, and independent audits."
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Security', path: ROUTES.security },
        ]),
      ]}>
      <Hero />
      <Compliance />
      <Protections />
      <Controls />
      <Testing />
      <IncidentResponse />
      <Residency />
      <Vulnerability />
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/* styles                                                              */
/* ------------------------------------------------------------------ */

function createStyles(t: ThemeTokens, l: Layout, type: TypeScale) {
  const stacked = l.isStacked;
  /** half the grid gutter; cells carry it as padding so wrapped rows stay flush */
  const cellPad = l.isPhone ? 5 : 7;

  /** Image styles sit outside the sheet: StyleSheet.create widens `'100%'` to
   *  `string`, which no longer satisfies `ImageStyle`. */
  const heroArt: ImageStyle = { width: '100%', aspectRatio: l.isPhone ? 1.2 : 1.04 };

  const cardBase: ViewStyle = {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 16,
    backgroundColor: t.surfaceRaised,
    padding: l.isPhone ? 16 : 18,
    gap: 10,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 'auto',
    ...(elevation(t, 1) as ViewStyle),
  };

  // Four steps: the rail stops half a cell in from each end so it starts and
  // ends under a marker rather than in mid-air.
  const dot = 46;
  const verticalTimeline = stacked;
  const railInset = `${Math.floor((100 / STEPS.length / 2) * 100) / 100}%` as DimensionValue;

  const sheet = StyleSheet.create({
    /* hero --------------------------------------------------------- */
    heroSection: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: stacked ? 'stretch' : 'center',
      gap: stacked ? 26 : 42,
      paddingTop: l.isPhone ? 24 : 36,
    },
    heroCopy: stacked
      ? { width: '100%', minWidth: 0, gap: 16 }
      : { flexGrow: 1.15, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 16 },
    heroPanel: stacked
      ? { width: '100%', minWidth: 0, alignSelf: 'center', maxWidth: 560 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    heroTitle: type.display,
    heroBody: { ...type.body, maxWidth: 600 },
    /** what the "Download security overview" CTA actually delivers */
    overview: {
      marginTop: 6,
      paddingTop: 18,
      borderTopWidth: 1,
      borderTopColor: t.divider,
      gap: 11,
      maxWidth: 560,
    },
    overviewTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    overviewRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
    overviewDot: {
      width: 18,
      height: 18,
      marginTop: 2,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softFill(t.green, t),
    },
    overviewText: {
      ...type.bodySm,
      color: t.textMuted,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
    },

    heroArtFrame: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 20,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 10 : 14,
      ...(elevation(t, 2) as ViewStyle),
    },

    /* section head ------------------------------------------------- */
    head: { gap: 11, maxWidth: 720 },
    headTitle: type.h2,
    headBody: type.body,

    /* grid --------------------------------------------------------- */
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'stretch',
      marginHorizontal: -cellPad,
      marginTop: 20 - cellPad,
    },
    cell: { flexGrow: 0, flexShrink: 0, minWidth: 0, padding: cellPad },

    /* generic card copy -------------------------------------------- */
    cardTitle: { ...type.h4, color: t.text },
    cardBody: { ...type.bodySm, color: t.textMuted },
    cardSpacer: { flexGrow: 1, flexShrink: 0, flexBasis: 'auto', minHeight: 4 },
    chip: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
    chipText: { ...type.micro, fontWeight: '800' },
    alignLeft: { textAlign: 'left' },

    /* compliance badges -------------------------------------------- */
    badgeCard: {
      ...cardBase,
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: l.isPhone ? 16 : 12,
    },
    badgeCardRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    // stretched rather than shrink-wrapped, so a long mark wraps into the full
    // card width instead of against an arbitrary intrinsic one
    badgeCopy: { alignSelf: 'stretch', alignItems: 'center', gap: 3, minWidth: 0 },
    badgeCopyRow: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 3 },
    badgeName: { ...type.bodySm, color: t.text, fontWeight: '800', textAlign: 'center' },
    badgeNote: { ...type.micro, color: t.textSubtle, textAlign: 'center' },

    /* protections -------------------------------------------------- */
    protectionCard: { ...cardBase, gap: 11 },

    /* controls ----------------------------------------------------- */
    controlList: { marginTop: 20, gap: l.isPhone ? 10 : 12 },
    controlRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 14,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 14 : 17,
    },
    controlRowPhone: { gap: 12, padding: 14 },
    controlCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 4 },
    controlTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },

    /* independent testing ------------------------------------------ */
    testCard: { ...cardBase, gap: 11 },

    /* incident response -------------------------------------------- */
    timeline: { position: 'relative', marginTop: l.isPhone ? 22 : 32 },
    timelineRail: verticalTimeline
      ? {
          position: 'absolute',
          left: dot / 2 - 1,
          top: dot / 2,
          bottom: dot / 2,
          width: 2,
          backgroundColor: t.divider,
        }
      : {
          position: 'absolute',
          left: railInset,
          right: railInset,
          top: dot / 2 - 1,
          height: 2,
          backgroundColor: t.divider,
        },
    timelineTrack: {
      flexDirection: verticalTimeline ? 'column' : 'row',
      alignItems: 'stretch',
      gap: verticalTimeline ? 22 : 0,
    },
    timelineItem: verticalTimeline
      ? { flexDirection: 'row', alignItems: 'flex-start', gap: 16 }
      : {
          flexGrow: 1,
          flexShrink: 1,
          flexBasis: 0,
          minWidth: 0,
          alignItems: 'center',
          paddingHorizontal: 10,
          gap: 12,
        },
    timelineDot: {
      width: dot,
      height: dot,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: dot / 2,
      borderWidth: 2,
      backgroundColor: t.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
      ...(elevation(t, 1) as ViewStyle),
    },
    timelineCopy: verticalTimeline
      ? { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 4, paddingTop: 3 }
      : { alignItems: 'center', gap: 5, alignSelf: 'stretch' },
    timelineLabel: {
      ...type.bodySm,
      fontWeight: '800',
      textAlign: verticalTimeline ? 'left' : 'center',
    },
    timelineBody: {
      ...type.caption,
      color: t.textMuted,
      textAlign: verticalTimeline ? 'left' : 'center',
    },
    commitment: {
      flexDirection: l.isPhone ? 'column' : 'row',
      alignItems: 'flex-start',
      gap: 16,
      marginTop: l.isPhone ? 22 : 30,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 16 : 20,
    },
    commitmentCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 6 },
    commitmentTitle: { ...type.h4, color: t.text },

    /* subprocessors + residency ------------------------------------ */
    splitRow: {
      flexDirection: l.isCompact ? 'column' : 'row',
      alignItems: 'stretch',
      gap: l.isPhone ? 12 : 16,
      marginTop: 20,
    },
    splitCell: l.isCompact
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    splitCard: { ...cardBase, gap: 12, borderRadius: 18 },
    regionList: { gap: 10, marginTop: 2 },
    regionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
    regionIcon: {
      width: 36,
      height: 36,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceMuted,
    },
    regionCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    regionName: { ...type.bodySm, color: t.text, fontWeight: '800' },
    regionNote: { ...type.micro, color: t.textMuted },

    /* report a vulnerability --------------------------------------- */
    reportCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surfaceRaised,
      padding: l.isPhone ? 18 : 26,
      gap: 16,
      ...(elevation(t, 2) as ViewStyle),
    },
    reportHead: {
      flexDirection: l.isPhone ? 'column' : 'row',
      alignItems: 'flex-start',
      gap: 16,
    },
    reportHeadCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 7 },
    reportTitle: { ...type.h3, color: t.text },
    addressRow: {
      flexDirection: l.isCompact ? 'column' : 'row',
      alignItems: l.isCompact ? 'flex-start' : 'center',
      gap: l.isCompact ? 12 : 20,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 14 : 16,
    },
    addressIcon: {
      width: 44,
      height: 44,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softFill(t.brand, t),
    },
    addressCopy: l.isCompact
      ? { width: '100%', minWidth: 0, gap: 2 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 2 },
    addressLabel: { ...type.micro, color: t.textSubtle, fontWeight: '700' },
    addressValue: { ...type.bodySm, color: accentText(t.brand, t), fontWeight: '800' },
    disclosureHeading: { ...type.h4, color: t.text },
    disclosureList: { gap: 10 },
    disclosureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
    disclosureDot: { paddingTop: 4, flexGrow: 0, flexShrink: 0 },
    disclosureText: {
      ...type.bodySm,
      color: t.textMuted,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
    },
    reportButtons: { marginTop: 2 },
  });

  return { ...sheet, heroArt };
}
