import {
  LEGAL_ENTITY,
  REGISTERED_ADDRESS,
  AsideCard,
  LegalBullets,
  LegalCallout,
  LegalContactCard,
  LegalLayout,
  LegalSection,
  LegalText,
  type DocSection,
} from '@/components/public/legal-page';
import { PageShell } from '@/components/public/page-shell';


const SECTIONS: DocSection[] = [
  { id: 'overview', title: 'Overview and Who We Are' },
  { id: 'information-we-collect', title: 'Information We Collect' },
  { id: 'how-we-use', title: 'How We Use Information' },
  { id: 'legal-bases', title: 'Legal Bases for Processing' },
  { id: 'how-we-share', title: 'How We Share Information' },
  { id: 'retention', title: 'Data Retention' },
  { id: 'rights', title: 'Your Privacy Rights' },
  { id: 'california', title: 'California Privacy Rights' },
  { id: 'security', title: 'Security' },
  { id: 'children', title: "Children's Privacy" },
  { id: 'transfers', title: 'International Transfers' },
  { id: 'changes', title: 'Changes' },
  { id: 'contact', title: 'Contact Us' },
];

const COLLECTED: readonly (string | [string, string])[] = [
  [
    'Information you provide:',
    'name, email address, company, job title, billing information, content of messages, and other information you choose to provide.',
  ],
  [
    'Automatically collected information:',
    'device and browser information, IP address, pages viewed, referral URLs, usage data, and cookies or similar technologies.',
  ],
  ['Information from third parties:', 'information from integrations, partners, and public sources.'],
];

const USES = [
  'Provide, operate, and improve our platform and services.',
  'Communicate with you about your account, services, and support.',
  'Personalize your experience and deliver relevant content.',
  'Analyze usage and trends to enhance performance and security.',
  'Comply with legal obligations and enforce our agreements.',
];

/**
 * A basis per purpose, not a list of bases in the abstract — the mapping is the
 * part GDPR Article 13 actually asks for, and the part a reader can check
 * against what the product does.
 */
const LEGAL_BASES: readonly [string, string][] = [
  [
    'Providing the platform and your account —',
    'performance of our contract with you (Article 6(1)(b)). Without this data there is no account to operate.',
  ],
  [
    'Billing, tax records and anti-fraud checks —',
    'compliance with a legal obligation (Article 6(1)(c)), and performance of the contract for the payment itself.',
  ],
  [
    'Keeping the service secure and improving it —',
    'our legitimate interests in a safe, working, improving product (Article 6(1)(f)). We weigh those interests against your rights, and you can object at any time.',
  ],
  [
    'Analytics and marketing storage on this website —',
    'your consent (Article 6(1)(a)), taken through the cookie notice and withdrawable at any time from Cookie settings, with no loss of access.',
  ],
  [
    'Marketing email to people who are not yet customers —',
    'consent, or our legitimate interest in business-to-business outreach where local law allows it. Every message carries a one-click unsubscribe.',
  ],
  [
    'Establishing, exercising or defending legal claims —',
    'our legitimate interests, and a legal obligation where a law requires the record to be kept.',
  ],
];

const SHARING = [
  'Service providers who help us operate our business, under confidentiality obligations and our documented instructions.',
  'Partners and integrations that enable features you use.',
  'Legal requirements, to protect rights, safety, and security, or in connection with a business transfer.',
  'With your consent or at your direction.',
];

/**
 * Real periods, not "as long as necessary". Each one is stated once here and
 * referenced from the GDPR page, so the two can never quote different numbers.
 */
const RETENTION: readonly [string, string][] = [
  [
    'Account and profile data —',
    'for as long as the account is open, then deleted or anonymized within 90 days of closure.',
  ],
  ['Content and files you upload —', 'until you delete them, or within 90 days of account closure.'],
  ['Billing, invoicing and tax records —', 'seven years, because tax law requires it.'],
  ['Support conversations —', '24 months from the last message in the thread.'],
  [
    'Marketing contact details —',
    'until you unsubscribe. We then keep a minimal suppression record indefinitely, so that we do not contact you again by mistake.',
  ],
  ['Security, access and audit logs —', '12 months.'],
  [
    'Website analytics and attribution —',
    'up to 24 months in our systems. The first-touch record held on your own device has no expiry date, and is erased the moment you withdraw consent or clear site data.',
  ],
  [
    'Backups —',
    'overwritten on a rolling 35-day cycle, so anything deleted from the live service leaves our backups within 35 days.',
  ],
];

/**
 * The CCPA/CPRA categories, in the statute's own vocabulary, each tied to why
 * we hold it. A notice that lists categories without purposes is half a notice.
 */
const CCPA_CATEGORIES: readonly [string, string][] = [
  [
    'Identifiers —',
    'name, email address, postal address, phone number, account identifier and IP address, to create and run your account and to answer you.',
  ],
  [
    'Commercial information —',
    'plan, credits purchased and transaction history, to bill you and support the account.',
  ],
  [
    'Internet and network activity —',
    'pages viewed, features used and the campaign you arrived from, to measure and improve the site and the product.',
  ],
  [
    'Approximate location —',
    'the region inferred from your IP address, for security, regional pricing and tax. We do not collect precise geolocation.',
  ],
  [
    'Professional information —',
    'company, job title and industry, to set the product up for the kind of business you run.',
  ],
  [
    'Audio and electronic information —',
    'recordings and transcripts of calls handled by Call Agent, which we hold on behalf of the customer who made them.',
  ],
  [
    'Inferences —',
    'simple segments drawn only from the categories above, such as which part of the product is likely to be useful to you.',
  ],
];

const CCPA_RIGHTS: readonly [string, string][] = [
  ['Know and access —', 'the categories and specific pieces of personal information we hold about you.'],
  ['Delete —', 'personal information we collected from you, subject to the exceptions in the statute.'],
  ['Correct —', 'inaccurate personal information.'],
  ['Opt out of sharing —', 'cross-context behavioral advertising, at any time and without giving a reason.'],
  [
    'Limit sensitive information —',
    'we do not use or disclose sensitive personal information for any purpose that gives rise to this right, so there is nothing to limit.',
  ],
  [
    'Non-discrimination —',
    'we will never deny you service, charge a different price, or give you a lower quality of service because you exercised a privacy right.',
  ],
];

export default function PrivacyPolicyPage() {
  return (
    <PageShell
      title="Privacy Policy"
      description="How FlowSmartly collects, uses, shares, and protects your information."
      cta={false}>
      <LegalLayout
        title="Privacy Policy"
        updated="August 4, 2026"
        intro="At FlowSmartly, your privacy is important to us. This Privacy Policy explains how we collect, use, share, and protect your information when you use our website, platform, and services."
        sections={SECTIONS}
        aside={
          <AsideCard icon="shield-halved" title="Privacy choices" linkLabel="Manage preferences">
            <LegalText>
              You&apos;re in control. Manage cookies and similar technologies or adjust your
              communication preferences.
            </LegalText>
          </AsideCard>
        }>
        <LegalSection number={1} title="Overview and Who We Are">
          <LegalText>
            The controller of the personal data described in this policy is {LEGAL_ENTITY}, the
            company that provides FlowSmartly, with its principal place of business at{' '}
            {REGISTERED_ADDRESS}. This policy covers FlowSmartly (&ldquo;FlowSmartly&rdquo;,
            &ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;), and describes how we handle
            information when you visit our website, use our platform, attend our events, or
            communicate with us.
          </LegalText>
          <LegalText>
            We are the controller for the data we collect in our own right: website visitors,
            prospects, event attendees, and the account, billing and support records of the people who
            administer a FlowSmartly workspace. Where a customer uploads their own contacts, leads or
            message recipients into the platform, that customer is the controller and we act as their
            processor — our GDPR &amp; Data Protection page explains how those requests are handled.
          </LegalText>
          <LegalText>
            Privacy questions and requests: privacy@flowsmartly.com, or write to us at the address
            above. There is one privacy team and it answers both.
          </LegalText>
        </LegalSection>

        <LegalSection number={2} title="Information We Collect">
          <LegalText>We collect information in three ways:</LegalText>
          <LegalBullets items={COLLECTED} />
        </LegalSection>

        <LegalSection number={3} title="How We Use Information">
          <LegalText>We use the information we collect to:</LegalText>
          <LegalBullets items={USES} />
        </LegalSection>

        <LegalSection number={4} title="Legal Bases for Processing">
          <LegalText>
            If you are in the European Economic Area, the United Kingdom or Switzerland, we must have
            a legal basis for every purpose we process your data for. These are ours, purpose by
            purpose:
          </LegalText>
          <LegalBullets items={LEGAL_BASES} />
          <LegalText>
            Where we rely on consent, you can withdraw it at any time and it is no harder to withdraw
            than it was to give. Withdrawing consent does not affect processing that already happened
            while the consent was valid.
          </LegalText>
        </LegalSection>

        <LegalSection number={5} title="How We Share Information">
          <LegalText>
            We do not sell personal information for money, and we have never done so. We share
            information in these limited circumstances:
          </LegalText>
          <LegalBullets items={SHARING} />
          <LegalText>
            One case deserves naming plainly: if you allow the Marketing category on this website,
            limited online identifiers reach advertising partners so that we can tell which campaign
            earned a signup. California law calls that &ldquo;sharing&rdquo;. It is off until you turn
            it on, and section 8 explains how to turn it back off.
          </LegalText>
        </LegalSection>

        <LegalSection number={6} title="Data Retention">
          <LegalText>
            We keep personal information only as long as it is needed for the purpose it was collected
            for. In practice that means:
          </LegalText>
          <LegalBullets items={RETENTION} />
          <LegalText>
            Where a legal hold, an investigation or an active dispute requires it, we keep the
            specific records involved until the matter closes. When a period ends, the data is
            securely deleted or irreversibly anonymized.
          </LegalText>
        </LegalSection>

        <LegalSection number={7} title="Your Privacy Rights">
          <LegalText>
            Depending on where you live, you may have the right to access, correct, delete, restrict,
            object to, or port your personal information, and to withdraw consent where we rely on it.
            California residents have the additional rights set out in section 8.
          </LegalText>
          <LegalText>
            To exercise a right, email privacy@flowsmartly.com or use the contact form on this site.
            We will confirm who you are — usually by asking you to reply from the address we already
            hold, or to confirm details of the account — and we only ask for what is needed to be sure
            we are not handing your data to someone else. You may also use an authorized agent,
            provided we can verify their permission to act for you.
          </LegalText>
          <LegalText>
            We answer within one month for GDPR requests and within 45 days for California requests.
            Where a request is genuinely complex we may extend once — by two further months under
            GDPR, or by a further 45 days in California — and we will tell you why before the original
            deadline passes. Requests are free unless they are manifestly unfounded or excessive.
          </LegalText>
          <LegalCallout icon="scale-balanced">
            You always have the right to lodge a complaint with a supervisory authority. In the EEA
            that is the authority where you live, where you work, or where the issue arose; in the
            United Kingdom it is the Information Commissioner&apos;s Office; in Switzerland it is the
            Federal Data Protection and Information Commissioner; in California you may complain to
            the California Privacy Protection Agency or the Attorney General. Telling us first is
            welcome, never required, and never a condition.
          </LegalCallout>
        </LegalSection>

        <LegalSection number={8} title="California Privacy Rights">
          <LegalText>
            This section is for California residents and describes our practices under the CCPA as
            amended by the CPRA. In the preceding twelve months we collected the following categories
            of personal information, from you, from your device as you use the site, from our
            customers, and from the partner and public sources described in section 2:
          </LegalText>
          <LegalBullets items={CCPA_CATEGORIES} />
          <LegalText>
            We disclose these categories to service providers and contractors for the business
            purposes described in section 5, and we retain them for the periods in section 6.
          </LegalText>
          <LegalCallout icon="ban">
            Do Not Sell or Share. We do not sell personal information for money and have not in the
            preceding twelve months. We do share limited online identifiers for cross-context
            behavioral advertising, but only while you have the Marketing category switched on — it is
            off by default. &ldquo;Cookie settings&rdquo;, in the footer of every page, is our
            &ldquo;Do Not Sell or Share My Personal Information&rdquo; control, and we honor the
            Global Privacy Control browser signal automatically as an opt-out. We do not sell or share
            the personal information of anyone we know to be under 16.
          </LegalCallout>
          <LegalText>Your rights, and what each one means here:</LegalText>
          <LegalBullets items={CCPA_RIGHTS} />
        </LegalSection>

        <LegalSection number={9} title="Security">
          <LegalText>
            We use administrative, technical, and physical safeguards to protect your information. While
            we strive to use commercially reasonable measures, no method of transmission or storage is
            100% secure.
          </LegalText>
        </LegalSection>

        <LegalSection number={10} title="Children's Privacy">
          <LegalText>
            Our services are not directed to children under 16, and we do not knowingly collect personal
            information from children under 16. If we learn that we have collected such information, we
            will delete it.
          </LegalText>
        </LegalSection>

        <LegalSection number={11} title="International Transfers">
          <LegalText>
            FlowSmartly is based in the United States, and some of the subprocessors that deliver parts
            of the service operate elsewhere. Personal data originating in the EEA, the United Kingdom
            or Switzerland is therefore transferred outside those regions.
          </LegalText>
          <LegalText>
            For those transfers we rely on the European Commission&apos;s Standard Contractual Clauses
            (Implementing Decision (EU) 2021/914), on the UK International Data Transfer Addendum for
            transfers from the United Kingdom, and on the Swiss addendum recognized by the Federal Data
            Protection and Information Commissioner. We assess the destination country where the
            transfer calls for it, and we apply supplementary measures — encryption in transit and at
            rest, strict access control, and a commitment to challenge overbroad government requests —
            where they are needed to keep the protection equivalent.
          </LegalText>
          <LegalText>
            A copy of the clauses we use is available on request from privacy@flowsmartly.com.
          </LegalText>
        </LegalSection>

        <LegalSection number={12} title="Changes">
          <LegalText>
            We may update this policy from time to time. We will post the updated policy and update the
            &ldquo;Last updated&rdquo; date above. Material changes will be communicated where required
            by law.
          </LegalText>
        </LegalSection>

        <LegalSection number={13} title="Contact Us">
          <LegalText>
            For questions about this Privacy Policy or our privacy practices, reach out to us:
          </LegalText>
          <LegalContactCard
            name={LEGAL_ENTITY}
            email="privacy@flowsmartly.com"
            detail={`${REGISTERED_ADDRESS} — we answer privacy requests within one month.`}
          />
        </LegalSection>
      </LegalLayout>
    </PageShell>
  );
}
