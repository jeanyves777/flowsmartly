import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Pressable,
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
import {
  ButtonRow,
  PrimaryButton,
  SecondaryButton,
  Section,
  SectionLabel,
  useTypeScale,
  type TypeScale,
} from '@/components/public/ui';
import { elevation, softFill, type ThemeTokens } from '@/theme/tokens';
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

type Value = { title: string; body: string; icon: string; tone: Tone };

const VALUES: Value[] = [
  {
    title: 'Own the outcome',
    body: 'You are accountable for the result a customer can see, not for the ticket you closed.',
    icon: 'flag-checkered',
    tone: 'brand',
  },
  {
    title: 'Ship and learn',
    body: 'Small releases, in front of real people, early enough that the feedback still changes things.',
    icon: 'bolt',
    tone: 'orange',
  },
  {
    title: 'Customers in the room',
    body: 'Everyone talks to customers. Support threads and calls are read by the people who build it.',
    icon: 'comments',
    tone: 'violet',
  },
  {
    title: 'Clarity over cleverness',
    body: 'Plain writing, obvious interfaces and code the next person can pick up without a tour.',
    icon: 'feather',
    tone: 'green',
  },
  {
    title: 'Sustainable pace',
    body: 'This is a long game. We plan for the quarter after next, not for the weekend.',
    icon: 'seedling',
    tone: 'pink',
  },
];

type Culture = { media: string; alt: string; caption: string };

const CULTURE: Culture[] = [
  {
    media: 'scenes/careers-culture-1',
    alt: 'Two engineers pairing on a feature at a shared desk',
    caption: 'Pairing week — every new hire ships something to production in their first five days.',
  },
  {
    media: 'scenes/careers-culture-2',
    alt: 'A small team on a video call reviewing customer feedback together',
    caption: 'Customer Friday — the whole team listens to real calls and picks what to fix next.',
  },
  {
    media: 'scenes/careers-culture-3',
    alt: 'The team together at an offsite, working around one long table',
    caption: 'Team week — once a year we are in one room, planning the next twelve months.',
  },
];

type Benefit = { title: string; body: string; icon: string; tone: Tone };

const BENEFITS: Benefit[] = [
  {
    title: 'Competitive salary & equity',
    body: 'One transparent band per level, reviewed twice a year, with meaningful ownership.',
    icon: 'sack-dollar',
    tone: 'brand',
  },
  {
    title: 'Remote-first',
    body: 'Work from wherever you do your best thinking. No return-to-office asterisk.',
    icon: 'earth-americas',
    tone: 'violet',
  },
  {
    title: 'Four-day focus Fridays',
    body: 'No meetings, no standups. A full day a week for deep work that needs a run-up.',
    icon: 'calendar-check',
    tone: 'orange',
  },
  {
    title: 'Health cover',
    body: 'Medical, dental and vision for you and your family, wherever you are based.',
    icon: 'heart-pulse',
    tone: 'pink',
  },
  {
    title: 'Learning budget',
    body: '$2,000 a year for courses, conferences and books — no approval theatre.',
    icon: 'graduation-cap',
    tone: 'green',
  },
  {
    title: 'Home-office budget',
    body: 'A proper desk, chair and screen on day one, refreshed every three years.',
    icon: 'chair',
    tone: 'brand',
  },
  {
    title: 'Paid sabbatical',
    body: 'Four paid weeks on top of your holiday after four years with the team.',
    icon: 'umbrella-beach',
    tone: 'violet',
  },
  {
    title: 'Parental leave',
    body: 'Sixteen weeks fully paid for every parent, plus a gentle four-week return.',
    icon: 'baby-carriage',
    tone: 'orange',
  },
  {
    title: 'Annual team week',
    body: 'Flights, rooms and food covered so the whole company gets a week face to face.',
    icon: 'plane-departure',
    tone: 'green',
  },
];

const DEPARTMENTS = ['All', 'Engineering', 'Design', 'Product', 'Growth', 'Customer'] as const;
type Department = (typeof DEPARTMENTS)[number];

type Role = {
  title: string;
  department: Exclude<Department, 'All'>;
  location: string;
  type: string;
};

const ROLES: Role[] = [
  { title: 'Senior Product Engineer', department: 'Engineering', location: 'Remote — US / EU', type: 'Full-time' },
  { title: 'Staff Frontend Engineer', department: 'Engineering', location: 'Remote — EU', type: 'Full-time' },
  { title: 'Infrastructure Engineer', department: 'Engineering', location: 'Remote — Global', type: 'Full-time' },
  { title: 'Product Designer', department: 'Design', location: 'Remote — US / EU', type: 'Full-time' },
  { title: 'Brand Designer', department: 'Design', location: 'Remote — Global', type: 'Contract' },
  { title: 'Product Manager, Flow.AI', department: 'Product', location: 'Remote — US', type: 'Full-time' },
  { title: 'Product Manager, Commerce', department: 'Product', location: 'Remote — EU', type: 'Full-time' },
  { title: 'Lifecycle Marketing Lead', department: 'Growth', location: 'Remote — US / EU', type: 'Full-time' },
  { title: 'Growth Analyst', department: 'Growth', location: 'Remote — Global', type: 'Full-time' },
  { title: 'Customer Success Manager', department: 'Customer', location: 'Remote — US', type: 'Full-time' },
  { title: 'Support Engineer', department: 'Customer', location: 'Remote — EU', type: 'Part-time' },
];

type Step = { title: string; body: string; icon: string; tone: Tone };

const HIRING: Step[] = [
  {
    title: 'Intro call',
    body: '30 minutes with the hiring manager. What you want next, and what the role really is.',
    icon: 'phone',
    tone: 'brand',
  },
  {
    title: 'Craft interview',
    body: 'A working conversation about something you have built and the calls you made.',
    icon: 'screwdriver-wrench',
    tone: 'violet',
  },
  {
    title: 'Practical exercise',
    body: 'A real, small problem from our backlog — paid, and time-boxed to four hours.',
    icon: 'pen-ruler',
    tone: 'orange',
  },
  {
    title: 'Team conversation',
    body: 'Meet the people you would work with every day, and ask them anything.',
    icon: 'people-group',
    tone: 'green',
  },
  {
    title: 'Offer',
    body: 'Decision and written offer within two working days of the last conversation.',
    icon: 'envelope-open-text',
    tone: 'pink',
  },
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

function IconTile({ icon, tone, size = 44 }: { icon: string; tone: Tone; size?: number }) {
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
      <Text style={styles.headTitle}>{title}</Text>
      {body ? <Text style={styles.headBody}>{body}</Text> : null}
    </Reveal>
  );
}

/* ------------------------------------------------------------------ */
/* sections                                                            */
/* ------------------------------------------------------------------ */

function Hero() {
  const styles = useStyles();
  const l = useLayout();

  return (
    <Section style={styles.heroSection}>
      <Reveal style={styles.heroCopy} distance={16}>
        <SectionLabel>CAREERS AT FLOWSMARTLY</SectionLabel>
        <Text style={styles.heroTitle}>Build the growth system small businesses deserve.</Text>
        <Text style={styles.heroBody}>
          We&apos;re a small, senior team building software that thousands of businesses run on every
          day. If you like ownership, craft, and customers who talk back — you&apos;ll like it here.
        </Text>
        <ButtonRow>
          <PrimaryButton label="See open roles" size="lg" icon="arrow-down" full={l.isPhone} />
          <SecondaryButton label="How we hire" size="lg" icon="route" full={l.isPhone} />
        </ButtonRow>
      </Reveal>

      <Reveal style={styles.heroPanel} distance={18} delay={90}>
        <Media
          name="scenes/careers-team"
          alt="The FlowSmartly team working together"
          style={styles.heroImage}
          radius={18}
        />
      </Reveal>
    </Section>
  );
}

function Values() {
  const styles = useStyles();
  const l = useLayout();
  // Five is prime: only one or five columns divide it, so the row form is used
  // wide and a designed icon-left list takes over below 1024.
  const columns = l.isCompact ? 1 : 5;

  return (
    <Section>
      <SectionHead
        label="WHAT WE VALUE"
        title="Five things we actually hire for."
        body="Not posters on a wall — these are the questions we ask in interviews and the reasons we promote people."
      />

      <View style={styles.grid}>
        {VALUES.map((value, index) => (
          <Reveal
            key={value.title}
            delay={50 + index * 60}
            distance={12}
            style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
            <View style={styles.valueCard}>
              <IconTile icon={value.icon} tone={value.tone} />
              <View style={styles.valueCopy}>
                <Text style={styles.cardTitle}>{value.title}</Text>
                <Text style={styles.cardBody}>{value.body}</Text>
              </View>
            </View>
          </Reveal>
        ))}
      </View>
    </Section>
  );
}

function Life() {
  const styles = useStyles();
  const l = useLayout();
  const columns = l.isPhone ? 1 : 3;

  return (
    <Section>
      <SectionHead
        label="LIFE AT FLOWSMARTLY"
        title="Remote, but not distant."
        body="Three moments that say more about the week here than a benefits list does."
      />

      <View style={styles.grid}>
        {CULTURE.map((item, index) => (
          <Reveal
            key={item.media}
            delay={60 + index * 80}
            distance={14}
            style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
            <View style={styles.cultureCard}>
              <Media name={item.media} alt={item.alt} style={styles.cultureImage} radius={0} />
              <View style={styles.cultureBody}>
                <Text style={styles.cultureCaption}>{item.caption}</Text>
              </View>
            </View>
          </Reveal>
        ))}
      </View>
    </Section>
  );
}

function Benefits() {
  const styles = useStyles();
  const l = useLayout();
  const columns = l.isPhone ? 1 : 3;

  return (
    <Section>
      <SectionHead
        label="BENEFITS"
        title="Benefits that actually help."
        body="The list is short because everything on it is real, funded and used."
      />

      <View style={styles.grid}>
        {BENEFITS.map((benefit, index) => (
          <Reveal
            key={benefit.title}
            delay={40 + index * 45}
            distance={12}
            style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
            <View style={styles.benefitCard}>
              <IconTile icon={benefit.icon} tone={benefit.tone} size={42} />
              <Text style={styles.cardTitle}>{benefit.title}</Text>
              <Text style={styles.cardBody}>{benefit.body}</Text>
            </View>
          </Reveal>
        ))}
      </View>
    </Section>
  );
}

/** Wide: one row of facts. Compact: a stacked card — never a squeezed table row. */
function RoleItem({ role }: { role: Role }) {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();

  if (l.isCompact) {
    return (
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${role.title} — ${role.department}, ${role.location}, ${role.type}`}
        style={({ pressed }) => [styles.roleCard, pressed ? styles.pressed : null]}>
        <Text style={styles.roleTitle}>{role.title}</Text>
        <View style={styles.rolePills}>
          <View style={styles.rolePill}>
            <Text style={styles.rolePillText}>{role.department}</Text>
          </View>
          <View style={styles.roleFact}>
            <FontAwesome6 name="location-dot" size={11} color={t.textSubtle} />
            <Text style={styles.roleFactText}>{role.location}</Text>
          </View>
          <View style={styles.roleFact}>
            <FontAwesome6 name="clock" size={11} color={t.textSubtle} />
            <Text style={styles.roleFactText}>{role.type}</Text>
          </View>
        </View>
        <View style={styles.roleLink}>
          <Text style={styles.roleLinkText}>View role</Text>
          <FontAwesome6 name="chevron-right" size={12} color={t.brand} />
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${role.title} — ${role.department}, ${role.location}, ${role.type}`}
      style={({ pressed }) => [styles.roleRow, pressed ? styles.pressed : null]}>
      <View style={styles.roleRowTitle}>
        <Text numberOfLines={2} style={styles.roleTitle}>
          {role.title}
        </Text>
      </View>
      <View style={styles.roleRowDept}>
        <View style={styles.rolePill}>
          <Text numberOfLines={1} style={styles.rolePillText}>
            {role.department}
          </Text>
        </View>
      </View>
      <View style={styles.roleRowMeta}>
        <FontAwesome6 name="location-dot" size={11} color={t.textSubtle} />
        <Text numberOfLines={1} style={styles.roleFactText}>
          {role.location}
        </Text>
      </View>
      <View style={styles.roleRowType}>
        <FontAwesome6 name="clock" size={11} color={t.textSubtle} />
        <Text numberOfLines={1} style={styles.roleFactText}>
          {role.type}
        </Text>
      </View>
      <FontAwesome6 name="chevron-right" size={13} color={t.textSubtle} />
    </Pressable>
  );
}

function OpenRoles() {
  const styles = useStyles();
  const [department, setDepartment] = useState<Department>('All');

  const visible = useMemo(
    () => (department === 'All' ? ROLES : ROLES.filter((role) => role.department === department)),
    [department],
  );

  return (
    <Section>
      <SectionHead
        label="OPEN ROLES"
        title="Where we need people right now."
        body="Every role is remote-first and open to the countries listed. If the timezone is the only problem, say so anyway."
      />

      <View style={styles.chipRow} accessibilityRole="tablist">
        {DEPARTMENTS.map((item) => {
          const active = item === department;
          const count = item === 'All' ? ROLES.length : ROLES.filter((r) => r.department === item).length;
          return (
            <Pressable
              key={item}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Show ${item} roles`}
              onPress={() => setDepartment(item)}
              style={[styles.filterChip, active ? styles.filterChipActive : null]}>
              <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>
                {`${item} · ${count}`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.roleCount}>
        {`${visible.length} ${visible.length === 1 ? 'open role' : 'open roles'}${
          department === 'All' ? ' across the company' : ` in ${department}`
        }.`}
      </Text>

      <View style={styles.roleList}>
        {visible.map((role, index) => (
          <Reveal key={role.title} delay={30 + index * 35} distance={10}>
            <RoleItem role={role} />
          </Reveal>
        ))}
      </View>
    </Section>
  );
}

function HowWeHire() {
  const styles = useStyles();
  const t = useTokens();

  return (
    <Section>
      <SectionHead
        label="HOW WE HIRE"
        title="Five steps, about two weeks."
        body="No surprise panels, no take-home that eats your weekend, and a written answer at every stage."
      />

      <View style={styles.flow}>
        <View style={styles.flowRail} />
        <View style={styles.flowTrack}>
          {HIRING.map((step, index) => {
            const color = accent(t, step.tone);
            return (
              <View key={step.title} style={styles.flowItem}>
                <View style={[styles.flowDot, { borderColor: color }]}>
                  <FontAwesome6 name={step.icon as never} size={15} color={color} />
                </View>
                <View style={styles.flowCopy}>
                  <Text style={[styles.flowStep, { color }]}>{`Step ${index + 1}`}</Text>
                  <Text style={styles.flowTitle}>{step.title}</Text>
                  <Text style={styles.flowBody}>{step.body}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.note}>
        <View style={[styles.noteIcon, { backgroundColor: softFill(t.green, t) }]}>
          <FontAwesome6 name="circle-check" size={15} color={t.green} />
        </View>
        <Text style={styles.noteText}>
          The practical exercise is paid at your day rate and time-boxed to four hours. If it takes
          longer than that, the exercise was wrong — not you.
        </Text>
      </View>
    </Section>
  );
}

function NoRole() {
  const styles = useStyles();
  const l = useLayout();
  const router = useRouter();

  return (
    <Section>
      <Reveal style={styles.closePanel} distance={14}>
        <IconTile icon="paper-plane" tone="brand" size={54} />
        <Text style={styles.closeTitle}>Don&apos;t see your role?</Text>
        <Text style={styles.closeBody}>
          We open roles as fast as the work arrives, and some of the best people here wrote to us
          before there was a posting. Tell us what you would want to own and we will tell you honestly
          whether it exists yet.
        </Text>
        <PrimaryButton
          label="Get in touch"
          icon="arrow-right"
          iconRight
          full={l.isPhone}
          onPress={() => router.push(ROUTES.contact as never)}
        />
      </Reveal>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function CareersPage() {
  return (
    <PageShell
      title="Careers"
      description="Join a small, senior team building the growth system thousands of businesses run on every day. Remote-first roles in engineering, design, product, growth and customer.">
      <Hero />
      <Values />
      <Life />
      <Benefits />
      <OpenRoles />
      <HowWeHire />
      <NoRole />
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
  const heroImage: ImageStyle = { width: '100%', height: l.isPhone ? 230 : stacked ? 320 : 400 };
  const cultureImage: ImageStyle = {
    width: '100%',
    height: l.isPhone ? 210 : l.isTablet ? 150 : l.isDesktop ? 230 : 190,
  };

  /** the vertical rail is drawn behind the dots; horizontally it stops half a
   *  step in from each end so it never runs past the first and last marker */
  const dot = 46;
  const verticalFlow = stacked;
  const railInset = `${Math.floor((100 / HIRING.length / 2) * 100) / 100}%` as DimensionValue;

  const cardBase: ViewStyle = {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 16,
    backgroundColor: t.surfaceRaised,
    padding: l.isPhone ? 16 : 18,
    ...(elevation(t, 1) as ViewStyle),
  };

  const sheet = StyleSheet.create({
    /* hero --------------------------------------------------------- */
    heroSection: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: stacked ? 'stretch' : 'center',
      gap: stacked ? 26 : 40,
      paddingTop: l.isPhone ? 24 : 36,
    },
    heroCopy: stacked
      ? { width: '100%', minWidth: 0, gap: 16 }
      : { flexGrow: 1.1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 16 },
    heroPanel: stacked
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    heroTitle: type.display,
    heroBody: { ...type.body, maxWidth: 600 },

    /* section head ------------------------------------------------- */
    head: { gap: 11, maxWidth: 760 },
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
    pressed: { opacity: 0.86 },

    cardTitle: { ...type.h4, color: t.text },
    cardBody: { ...type.bodySm, color: t.textMuted },

    /* values ------------------------------------------------------- */
    valueCard: {
      ...cardBase,
      gap: l.isCompact ? 14 : 12,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      flexDirection: l.isCompact ? 'row' : 'column',
      alignItems: l.isCompact ? 'flex-start' : 'stretch',
    },
    valueCopy: l.isCompact
      ? { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 6 }
      : { width: '100%', minWidth: 0, gap: 6 },

    /* life --------------------------------------------------------- */
    cultureCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceRaised,
      overflow: 'hidden',
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      ...(elevation(t, 1) as ViewStyle),
    },
    cultureBody: {
      padding: l.isPhone ? 15 : 16,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
    },
    cultureCaption: { ...type.bodySm, color: t.textMuted },

    /* benefits ----------------------------------------------------- */
    benefitCard: {
      ...cardBase,
      gap: 10,
      backgroundColor: t.surfaceMuted,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
    },

    /* open roles --------------------------------------------------- */
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
      marginTop: l.isPhone ? 18 : 24,
    },
    filterChip: {
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: 16,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceMuted,
    },
    filterChipActive: { borderColor: t.brand, backgroundColor: t.brandSoft },
    filterChipText: { ...type.bodySm, color: t.textMuted, fontWeight: '700' },
    filterChipTextActive: { color: t.brand },
    roleCount: { ...type.caption, color: t.textSubtle, fontWeight: '700', marginTop: 16 },
    roleList: { gap: 10, marginTop: 12 },

    /* one role — wide row */
    roleRow: {
      minHeight: 68,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceMuted,
    },
    roleRowTitle: { flexGrow: 1.7, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    roleRowDept: { flexGrow: 0.9, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    roleRowMeta: {
      flexGrow: 1.1,
      flexShrink: 1,
      flexBasis: 0,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    roleRowType: {
      flexGrow: 0.7,
      flexShrink: 1,
      flexBasis: 0,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },

    /* one role — stacked card */
    roleCard: {
      gap: 11,
      paddingHorizontal: 16,
      paddingVertical: 15,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceMuted,
    },
    rolePills: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
    roleTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    rolePill: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      paddingHorizontal: 11,
      paddingVertical: 5,
      backgroundColor: t.chipBg,
    },
    rolePillText: { ...type.micro, color: t.chipText, fontWeight: '800' },
    roleFact: { flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0 },
    roleFactText: { ...type.micro, color: t.textMuted, flexShrink: 1, minWidth: 0 },
    roleLink: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 34 },
    roleLinkText: { ...type.bodySm, color: t.brand, fontWeight: '800' },

    /* how we hire -------------------------------------------------- */
    flow: { position: 'relative', marginTop: l.isPhone ? 22 : 32 },
    flowRail: verticalFlow
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
    flowTrack: {
      flexDirection: verticalFlow ? 'column' : 'row',
      alignItems: 'stretch',
      gap: verticalFlow ? 22 : 0,
    },
    flowItem: verticalFlow
      ? { flexDirection: 'row', alignItems: 'flex-start', gap: 16 }
      : {
          flexGrow: 1,
          flexShrink: 1,
          flexBasis: 0,
          minWidth: 0,
          alignItems: 'center',
          paddingHorizontal: 10,
          gap: 10,
        },
    flowDot: {
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
    flowCopy: verticalFlow
      ? { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 4, paddingTop: 3 }
      : { alignSelf: 'stretch', alignItems: 'center', gap: 4 },
    flowStep: { ...type.micro, fontWeight: '800', textAlign: verticalFlow ? 'left' : 'center' },
    flowTitle: {
      ...type.bodySm,
      color: t.text,
      fontWeight: '800',
      textAlign: verticalFlow ? 'left' : 'center',
    },
    flowBody: { ...type.micro, color: t.textMuted, textAlign: verticalFlow ? 'left' : 'center' },

    note: {
      flexDirection: l.isPhone ? 'column' : 'row',
      alignItems: l.isPhone ? 'flex-start' : 'center',
      gap: 13,
      marginTop: l.isPhone ? 22 : 30,
      padding: l.isPhone ? 15 : 17,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceMuted,
    },
    noteIcon: {
      width: 38,
      height: 38,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    noteText: l.isPhone
      ? { ...type.bodySm, color: t.textMuted, width: '100%', minWidth: 0 }
      : { ...type.bodySm, color: t.textMuted, flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0 },

    /* closing ------------------------------------------------------ */
    closePanel: {
      alignItems: l.isPhone ? 'flex-start' : 'center',
      gap: 14,
      maxWidth: 720,
      width: '100%',
      alignSelf: 'center',
      paddingVertical: l.isPhone ? 4 : 16,
    },
    closeTitle: { ...type.h2, textAlign: l.isPhone ? 'left' : 'center' },
    closeBody: { ...type.body, textAlign: l.isPhone ? 'left' : 'center', maxWidth: 620 },
  });

  return { ...sheet, heroImage, cultureImage };
}
