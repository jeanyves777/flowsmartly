import {
  AsideCard,
  LegalBullets,
  LegalContactCard,
  LegalLayout,
  LegalSection,
  LegalText,
  type DocSection,
} from '@/components/public/legal-page';
import { PageShell } from '@/components/public/page-shell';

const SECTIONS: DocSection[] = [
  { id: 'overview', title: 'Overview' },
  { id: 'information-we-collect', title: 'Information We Collect' },
  { id: 'how-we-use', title: 'How We Use Information' },
  { id: 'how-we-share', title: 'How We Share Information' },
  { id: 'retention', title: 'Data Retention' },
  { id: 'rights', title: 'Your Privacy Rights' },
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

const SHARING = [
  'Service providers who help us operate our business, under confidentiality obligations.',
  'Partners and integrations that enable features you use.',
  'Legal requirements, to protect rights, safety, and security, or in connection with a business transfer.',
  'With your consent or at your direction.',
];

export default function PrivacyPolicyPage() {
  return (
    <PageShell
      title="Privacy Policy"
      description="How FlowSmartly collects, uses, shares, and protects your information."
      cta={false}>
      <LegalLayout
        title="Privacy Policy"
        updated="August 3, 2026"
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
        <LegalSection number={1} title="Overview">
          <LegalText>
            This Privacy Policy applies to FlowSmartly, Inc. and its affiliates (&ldquo;FlowSmartly&rdquo;,
            &ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;). It describes how we handle information
            when you visit our website, use our platform, attend our events, or communicate with us.
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

        <LegalSection number={4} title="How We Share Information">
          <LegalText>
            We do not sell your personal information. We share information in these limited
            circumstances:
          </LegalText>
          <LegalBullets items={SHARING} />
        </LegalSection>

        <LegalSection number={5} title="Data Retention">
          <LegalText>
            We retain personal information for as long as necessary to provide our services and fulfill
            the purposes outlined in this policy, unless a longer retention period is required or
            permitted by law. When information is no longer needed, we securely delete or anonymize it.
          </LegalText>
        </LegalSection>

        <LegalSection number={6} title="Your Privacy Rights">
          <LegalText>
            Depending on your location, you may have the right to access, correct, delete, restrict,
            object to, or port your personal information, and to withdraw consent where applicable. To
            exercise these rights, contact us using the details below.
          </LegalText>
        </LegalSection>

        <LegalSection number={7} title="Security">
          <LegalText>
            We use administrative, technical, and physical safeguards to protect your information. While
            we strive to use commercially reasonable measures, no method of transmission or storage is
            100% secure.
          </LegalText>
        </LegalSection>

        <LegalSection number={8} title="Children's Privacy">
          <LegalText>
            Our services are not directed to children under 16, and we do not knowingly collect personal
            information from children under 16. If we learn that we have collected such information, we
            will delete it.
          </LegalText>
        </LegalSection>

        <LegalSection number={9} title="International Transfers">
          <LegalText>
            We may transfer information to countries other than your own. Where required, we use
            appropriate safeguards for those transfers.
          </LegalText>
        </LegalSection>

        <LegalSection number={10} title="Changes">
          <LegalText>
            We may update this policy from time to time. We will post the updated policy and update the
            &ldquo;Last updated&rdquo; date above. Material changes will be communicated where required
            by law.
          </LegalText>
        </LegalSection>

        <LegalSection number={11} title="Contact Us">
          <LegalText>
            For questions about this Privacy Policy or our privacy practices, reach out to us:
          </LegalText>
          <LegalContactCard
            name="FlowSmartly, Inc."
            email="privacy@flowsmartly.com"
            detail="548 Market St, PMB 72224, San Francisco, CA 94104, USA"
          />
        </LegalSection>
      </LegalLayout>
    </PageShell>
  );
}
