import { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
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
import { ConsentPreferencesButton, ConsentWithdrawButton } from '@/components/public/consent';
import { PageShell } from '@/components/public/page-shell';
import { useTypeScale, type TypeScale } from '@/components/public/ui';
import type { ThemeTokens } from '@/theme/tokens';
import { useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';

const SECTIONS: DocSection[] = [
  { id: 'what', title: 'What Cookies Are' },
  { id: 'how', title: 'How We Use Cookies' },
  { id: 'categories', title: 'Categories We Set' },
  { id: 'storage', title: 'What This Website Stores' },
  { id: 'third-party', title: 'Third-Party Cookies' },
  { id: 'duration', title: 'How Long Cookies Last' },
  { id: 'preferences', title: 'Managing Your Preferences' },
  { id: 'browser', title: 'Browser Controls' },
  { id: 'dnt', title: 'Do Not Track' },
  { id: 'changes', title: 'Changes to This Policy' },
  { id: 'contact', title: 'Contact' },
];

/**
 * Three categories, because the preferences panel offers exactly three. A
 * policy that lists a category the controls do not expose is a policy the
 * product does not implement.
 */
const CATEGORIES: readonly [string, string][] = [
  [
    'Strictly necessary —',
    'keeping you signed in, keeping your session secure, preventing fraud, remembering the appearance you chose and recording this very decision. These cannot be switched off, because the site does not work without them and none of them are used to profile you.',
  ],
  [
    'Analytics —',
    'aggregated, first-party measurement of which pages and features are used, so we know what to improve next. Off until you allow it.',
  ],
  [
    'Marketing —',
    'measuring which campaign brought you here and limiting how often you see the same advert. Off until you allow it.',
  ],
];

type Row = { category: string; purpose: string; retention: string };

const TABLE: Row[] = [
  {
    category: 'Strictly necessary',
    purpose: 'Authentication, session security, fraud prevention, appearance, and your cookie choice',
    retention: 'Session to 12 months',
  },
  {
    category: 'Analytics',
    purpose: 'Aggregated first-party measurement of page and feature use',
    retention: 'Up to 24 months',
  },
  {
    category: 'Marketing',
    purpose: 'Campaign attribution and advert frequency capping',
    retention: 'Up to 13 months',
  },
];

/**
 * The exact, checkable list for this marketing site — the thing a reader (or an
 * auditor) can verify in their own browser in ten seconds. It is deliberately
 * separate from the platform-wide table above, and it is the reason the two can
 * never quietly drift apart.
 */
type StoreRow = { key: string; category: string; purpose: string; life: string };

const SITE_STORAGE: StoreRow[] = [
  {
    key: 'fs.consent.v1',
    category: 'Strictly necessary',
    purpose: 'Remembers the choice you made here, so we do not ask on every page.',
    life: '12 months, then we ask again',
  },
  {
    key: 'fs.theme.v1',
    category: 'Strictly necessary',
    purpose: 'Remembers whether you chose the light, grey or dark appearance.',
    life: 'Until you clear your browser',
  },
  {
    key: 'fs.attribution.v1',
    category: 'Analytics',
    purpose:
      'The campaign, referrer and first page of your first visit, so we can tell which marketing actually works. First touch only — a later visit never overwrites it.',
    life: 'Until you clear your browser',
  },
];

/* ------------------------------------------------------------------ */
/* the category breakdown                                              */
/* ------------------------------------------------------------------ */

/**
 * Three columns of small facts have no room on a 390px phone, and a horizontal
 * scroller is not a layout — so the phone gets a designed stack of cards with
 * each value on its own labelled line, and everything wider gets the table.
 */
function CategoryTable() {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  const styles = useMemo(() => createStyles(t, l, type), [t, l, type]);

  if (l.isPhone) {
    return (
      <View style={styles.stack}>
        {TABLE.map((row) => (
          <View key={row.category} style={styles.stackCard}>
            <Text style={styles.stackTitle}>{row.category}</Text>
            <View style={styles.stackField}>
              <Text style={styles.stackLabel}>Purpose</Text>
              <Text style={styles.stackValue}>{row.purpose}</Text>
            </View>
            <View style={styles.stackField}>
              <Text style={styles.stackLabel}>Retention</Text>
              <Text style={styles.stackValue}>{row.retention}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.table}>
      <View style={styles.tableHead}>
        <Text style={[styles.headCell, styles.colCategory]}>Category</Text>
        <Text style={[styles.headCell, styles.colPurpose]}>Purpose</Text>
        <Text style={[styles.headCell, styles.colRetention]}>Retention</Text>
      </View>
      {TABLE.map((row, index) => (
        <View key={row.category} style={[styles.tableRow, index === 0 ? styles.tableRowFirst : null]}>
          <Text style={[styles.cellStrong, styles.colCategory]}>{row.category}</Text>
          <Text style={[styles.cell, styles.colPurpose]}>{row.purpose}</Text>
          <Text style={[styles.cell, styles.colRetention]}>{row.retention}</Text>
        </View>
      ))}
    </View>
  );
}

/** The same two shapes as CategoryTable — a scroller is not a phone layout. */
function SiteStorageTable() {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  const styles = useMemo(() => createStyles(t, l, type), [t, l, type]);

  if (l.isPhone) {
    return (
      <View style={styles.stack}>
        {SITE_STORAGE.map((row) => (
          <View key={row.key} style={styles.stackCard}>
            <Text style={styles.stackKey}>{row.key}</Text>
            <View style={styles.stackField}>
              <Text style={styles.stackLabel}>Category</Text>
              <Text style={styles.stackValue}>{row.category}</Text>
            </View>
            <View style={styles.stackField}>
              <Text style={styles.stackLabel}>Purpose</Text>
              <Text style={styles.stackValue}>{row.purpose}</Text>
            </View>
            <View style={styles.stackField}>
              <Text style={styles.stackLabel}>Lifetime</Text>
              <Text style={styles.stackValue}>{row.life}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.table}>
      <View style={styles.tableHead}>
        <Text style={[styles.headCell, styles.colKey]}>Name</Text>
        <Text style={[styles.headCell, styles.colCat]}>Category</Text>
        <Text style={[styles.headCell, styles.colWhy]}>Purpose</Text>
        <Text style={[styles.headCell, styles.colLife]}>Lifetime</Text>
      </View>
      {SITE_STORAGE.map((row, index) => (
        <View key={row.key} style={[styles.tableRow, index === 0 ? styles.tableRowFirst : null]}>
          <Text style={[styles.cellKey, styles.colKey]}>{row.key}</Text>
          <Text style={[styles.cell, styles.colCat]}>{row.category}</Text>
          <Text style={[styles.cell, styles.colWhy]}>{row.purpose}</Text>
          <Text style={[styles.cell, styles.colLife]}>{row.life}</Text>
        </View>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function CookiesPage() {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  const styles = useMemo(() => createStyles(t, l, type), [t, l, type]);

  return (
    <PageShell
      title="Cookie Policy"
      description="What cookies FlowSmartly sets, why we set them, how long they last, and how to change your preferences at any time."
      cta={false}>
      <LegalLayout
        title="Cookie Policy"
        updated="August 4, 2026"
        intro="Cookies are small files a site stores in your browser so it can recognise you the next time you visit. This policy explains exactly which ones FlowSmartly sets, what each of them is for, how long it lasts, and how to turn off everything that is not strictly necessary."
        sections={SECTIONS}
        aside={
          <AsideCard icon="sliders" title="Manage your preferences" linkLabel="Cookie settings">
            <LegalText>
              Open cookie settings from the footer of any page to see every category we set and switch
              the optional ones on or off. Your choice applies immediately, on this browser.
            </LegalText>
          </AsideCard>
        }>
        <LegalSection number={1} title="What Cookies Are">
          <LegalText>
            A cookie is a small text file that a website asks your browser to store, so the site can
            recognise the same browser the next time it is used. Related technologies — local storage,
            session storage, pixels and mobile SDKs — do the same job in a slightly different way.
            Wherever this policy says “cookies”, it means all of them.
          </LegalText>
          <LegalText>
            A cookie can only be read by the site that set it. It cannot run programs, read other files
            on your device, or see anything you have not given to the site itself.
          </LegalText>
        </LegalSection>

        <LegalSection number={2} title="How We Use Cookies">
          <LegalText>
            FlowSmartly uses cookies to keep you signed in, to keep your workspace secure, to remember
            how you like the product set up, to understand which parts of the platform are actually
            used, and to measure whether our own marketing reaches the right people.
          </LegalText>
          <LegalText>
            We do not sell what cookies collect, we do not use them to build profiles of people outside
            our own service, and we do not place optional cookies before you have allowed them.
          </LegalText>
          <LegalCallout>
            Everything that is not strictly necessary stays off until you say otherwise — and you can
            change your mind at any time without losing access to anything.
          </LegalCallout>
        </LegalSection>

        <LegalSection number={3} title="Categories We Set">
          <LegalText>
            Every cookie we set belongs to exactly one of three categories, and two of them are yours to
            switch on or off:
          </LegalText>
          <LegalBullets items={CATEGORIES} />
          <CategoryTable />
        </LegalSection>

        <LegalSection number={4} title="What This Website Stores">
          <LegalText>
            The table above covers the FlowSmartly platform. This public website is smaller and simpler,
            so here is the complete, exact list of what it puts in your browser. It sets no cookies at
            all — it uses local storage, which is not sent with any network request. You can check every
            row of this in your browser&apos;s developer tools.
          </LegalText>
          <SiteStorageTable />
          <LegalText>
            Until you make a choice, only the strictly necessary rows exist. Anything measured before
            that point is held in memory and discarded if you decline — it is never written down and
            never sent.
          </LegalText>
        </LegalSection>

        <LegalSection number={5} title="Third-Party Cookies">
          <LegalText>
            Some cookies are set by companies that deliver part of the service for us — payment
            processing, error reporting, embedded video, live chat and advertising measurement. Each of
            them can only read the cookies it set itself, each is contractually bound to process the
            data on our documented instructions, and each is named in our subprocessor register with
            what it does and where it operates.
          </LegalText>
          <LegalText>
            If you switch off the Analytics or Marketing categories, the third-party cookies in those
            categories are not set at all — they are not merely ignored.
          </LegalText>
        </LegalSection>

        <LegalSection number={6} title="How Long Cookies Last">
          <LegalText>
            Session cookies are deleted the moment you close your browser. Persistent cookies stay until
            they expire or you delete them; we set each one to the shortest life that still does its
            job, and no optional category exceeds 24 months. The table above lists the maximum life of
            each category.
          </LegalText>
          <LegalText>
            Deleting cookies in your browser removes ours immediately. You will be signed out, and any
            preference you had recorded — including a decision to refuse optional cookies — is cleared,
            so we will ask again on your next visit.
          </LegalText>
        </LegalSection>

        <LegalSection number={7} title="Managing Your Preferences">
          <LegalText>
            Open cookie settings from the footer of any page to see every category we set and switch the
            optional ones on or off. The change takes effect straight away — nothing needs to be
            reloaded or re-saved. You can also do both from here:
          </LegalText>
          <View style={styles.controls}>
            <ConsentPreferencesButton />
            <ConsentWithdrawButton />
          </View>
          <LegalText>
            Withdrawing is not harder than consenting: it clears the stored decision entirely, so the
            notice comes back and nothing optional is stored again until you say so.
          </LegalText>
          <LegalText>
            Your choice is recorded per browser and per device, so a decision made on your laptop does
            not follow you to your phone. We ask again after 12 months, or sooner if we introduce a
            category that did not exist when you chose.
          </LegalText>
        </LegalSection>

        <LegalSection number={8} title="Browser Controls">
          <LegalText>
            Every major browser can block cookies, delete them on exit, or clear them on demand — look
            for Privacy or Site settings in Chrome, Safari, Firefox or Edge. Private and incognito
            windows discard all cookies when the window closes.
          </LegalText>
          <LegalCallout icon="triangle-exclamation">
            Blocking strictly necessary cookies will sign you out of FlowSmartly and stop parts of the
            platform from working at all. Blocking only the optional categories has no effect on the
            product.
          </LegalCallout>
        </LegalSection>

        <LegalSection number={9} title="Do Not Track">
          <LegalText>
            There is still no agreed standard for how a website should answer a browser “Do Not Track”
            header, so we do not claim to honour it. We do honour the Global Privacy Control signal
            where the law requires it, by treating it as an opt-out of the Marketing category for that
            browser.
          </LegalText>
          <LegalText>
            Independently of any signal, we do not follow individuals across other companies&apos;
            websites.
          </LegalText>
        </LegalSection>

        <LegalSection number={10} title="Changes to This Policy">
          <LegalText>
            We update this policy whenever the cookies we set change. Material changes are announced in
            the product and by email before they take effect, and the date at the top of this page
            always reflects the version you are reading.
          </LegalText>
        </LegalSection>

        <LegalSection number={11} title="Contact">
          <LegalText>
            For questions about this policy or about anything we store in your browser, reach out to us:
          </LegalText>
          <LegalContactCard
            name="FlowSmartly Privacy Team"
            email="privacy@flowsmartly.com"
            detail="We typically respond within 2 business days."
          />
        </LegalSection>
      </LegalLayout>
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/* styles                                                              */
/* ------------------------------------------------------------------ */

function createStyles(t: ThemeTokens, l: Layout, type: TypeScale) {
  const cellPadV = l.isTablet ? 11 : 13;

  return StyleSheet.create({
    /* table (tablet and up) ---------------------------------------- */
    table: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceRaised,
      overflow: 'hidden',
      marginTop: 4,
    },
    tableHead: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      backgroundColor: t.surfaceInset,
      paddingHorizontal: 14,
      paddingVertical: 11,
    },
    tableRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: cellPadV,
      borderTopWidth: 1,
      borderTopColor: t.divider,
    },
    // the head already provides the separating edge above the first row
    tableRowFirst: { borderTopWidth: 0 },
    headCell: { ...type.micro, color: t.textSubtle, fontWeight: '800' },
    cell: { ...type.caption, color: t.textMuted },
    cellStrong: { ...type.caption, color: t.text, fontWeight: '800' },

    /* Percentage bases, never `flex: n` — a shorthand here would zero the
       basis and let the widest column swallow the row. */
    colCategory: { flexGrow: 0, flexShrink: 1, flexBasis: '26%', minWidth: 0 },
    colPurpose: { flexGrow: 0, flexShrink: 1, flexBasis: '46%', minWidth: 0 },
    colRetention: { flexGrow: 0, flexShrink: 1, flexBasis: '24%', minWidth: 0 },

    /* the exact site-storage table — four bases summing under 100% with the gaps */
    colKey: { flexGrow: 0, flexShrink: 1, flexBasis: '23%', minWidth: 0 },
    colCat: { flexGrow: 0, flexShrink: 1, flexBasis: '19%', minWidth: 0 },
    colWhy: { flexGrow: 0, flexShrink: 1, flexBasis: '38%', minWidth: 0 },
    colLife: { flexGrow: 0, flexShrink: 1, flexBasis: '20%', minWidth: 0 },
    cellKey: {
      ...type.micro,
      color: t.text,
      fontWeight: '800',
      fontFamily: Platform.OS === 'web' ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined,
    },

    /* the real controls in "Managing Your Preferences" */
    controls: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginVertical: 4 },

    /* stacked cards (phone) ---------------------------------------- */
    stack: { gap: 10, marginTop: 4 },
    stackCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceMuted,
      padding: 14,
      gap: 10,
    },
    stackTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    stackKey: {
      ...type.bodySm,
      color: t.text,
      fontWeight: '800',
      fontFamily: Platform.OS === 'web' ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined,
    },
    stackField: { gap: 2 },
    stackLabel: { ...type.micro, color: t.textSubtle, fontWeight: '800' },
    stackValue: { ...type.caption, color: t.textMuted },
  });
}
