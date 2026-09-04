import { useRouter } from 'expo-router';
import {
  AsideCard,
  AsideChecklist,
  LegalContactCard,
  LegalLayout,
  LegalSection,
  LegalText,
  type DocSection,
} from '@/components/public/legal-page';
import { PageShell } from '@/components/public/page-shell';
import { SecondaryButton } from '@/components/public/ui';
import { contactHref } from '@/lib/destinations';

/**
 * One authoritative postal address for the entity, printed identically on every
 * legal page. See the note in privacy.tsx.
 */
const REGISTERED_ADDRESS = '548 Market St, PMB 72224, San Francisco, CA 94104, USA';

const SECTIONS: DocSection[] = [
  { id: 'consent', title: 'Consent and Enrollment' },
  { id: 'frequency', title: 'Message Frequency' },
  { id: 'fees', title: 'Carrier Fees' },
  { id: 'stop', title: 'Opting Out with STOP' },
  { id: 'help', title: 'Getting Help with HELP' },
  { id: 'quiet', title: 'Quiet Hours' },
  { id: 'prohibited', title: 'Prohibited Content' },
  { id: 'responsibilities', title: 'Compliance Responsibilities' },
  { id: 'records', title: 'Records and Auditability' },
  { id: 'updates', title: 'Updates' },
  { id: 'contact', title: 'Contact' },
];

const CHECKLIST = [
  'Clear and documented consent',
  'Disclosure of message frequency',
  'Easy opt-out with STOP',
  'Help option with HELP',
  'Respect quiet hours',
  'Accurate message content',
  'Record retention (24+ months)',
  'Ongoing compliance monitoring',
];

/**
 * `cta={false}` matches privacy, terms and GDPR: a legal document ends on its
 * contact block, not on a growth pitch. This page was the only one of the four
 * still rendering the gradient CTA banner — and that banner carries the
 * signature swoosh, which parks 44px outside the banner (clipped) until its
 * reveal animation runs, which is what a viewport-overflow scan picks up here.
 */
export default function SmsTermsPage() {
  const router = useRouter();

  return (
    <PageShell
      title="SMS Messaging Terms"
      description="The terms that govern the use of FlowSmartly's SMS messaging services."
      cta={false}>
      <LegalLayout
        title="SMS Messaging Terms"
        updated="August 3, 2026"
        intro="These SMS Messaging Terms (“Terms”) govern the use of FlowSmartly's SMS messaging services. By using SMS through FlowSmartly, you agree to these Terms and all applicable laws and regulations."
        sections={SECTIONS}
        sidebarCard={
          <AsideCard icon="shield-halved" title="Built for compliance" linkLabel="Learn more">
            <LegalText>
              FlowSmartly helps partners meet carrier, TCPA, and CTIA requirements.
            </LegalText>
          </AsideCard>
        }
        aside={
          <>
            <AsideCard icon="comment-dots" title="Example opt-in disclosure">
              <LegalText>
                By signing up, you agree to receive recurring SMS messages from FlowSmartly at the
                phone number you provide. Msg &amp; data rates may apply. Msg frequency varies. Reply
                STOP to opt out. Reply HELP for help.
              </LegalText>
            </AsideCard>
            <AsideCard icon="clipboard-check" title="Compliance checklist" tone="violet" linkLabel="Download checklist">
              <LegalText>Use this checklist to stay aligned with carrier and legal requirements.</LegalText>
              <AsideChecklist items={CHECKLIST} />
            </AsideCard>
            <AsideCard icon="circle-check" title="Why it matters" tone="orange" linkLabel="Read best practices">
              <LegalText>
                Following these Terms helps protect your business, build trust with your customers,
                and ensure your messages reach the people who want to hear from you.
              </LegalText>
            </AsideCard>
          </>
        }>
        <LegalSection number={1} title="Consent and Enrollment">
          <LegalText>
            You must obtain clear, express, and informed consent from recipients before sending SMS
            messages. Consent must not be a condition of purchase. Recipients must know what they are
            agreeing to and how messages will be delivered. Consent must be documented and retained.
          </LegalText>
        </LegalSection>

        <LegalSection number={2} title="Message Frequency">
          <LegalText>
            Message frequency may vary. We recommend setting clear expectations during opt-in. You are
            responsible for honoring the frequency you disclose.
          </LegalText>
        </LegalSection>

        <LegalSection number={3} title="Carrier Fees">
          <LegalText>
            Message and data rates may apply. Recipients are responsible for any charges imposed by
            their mobile carrier.
          </LegalText>
        </LegalSection>

        <LegalSection number={4} title="Opting Out with STOP">
          <LegalText>
            Recipients can opt out at any time by replying STOP. You agree to honor opt-out requests
            promptly and not send further messages, except as required by law (e.g., transactional
            messages).
          </LegalText>
        </LegalSection>

        <LegalSection number={5} title="Getting Help with HELP">
          <LegalText>
            Recipients can reply HELP for assistance. You agree to respond with information on how to
            get help, including your business name and contact information.
          </LegalText>
        </LegalSection>

        <LegalSection number={6} title="Quiet Hours">
          <LegalText>
            You agree to respect quiet hours between 8:00 PM and 8:00 AM recipient local time.
            Transactional or critical messages may be sent outside these hours when necessary.
          </LegalText>
        </LegalSection>

        <LegalSection number={7} title="Prohibited Content">
          <LegalText>
            You will not send unlawful, deceptive, harassing, or abusive content. You will not send
            messages that violate any law, regulation, or carrier policy.
          </LegalText>
        </LegalSection>

        <LegalSection number={8} title="Compliance Responsibilities">
          <LegalText>
            You are solely responsible for your messaging content, obtaining and managing consent,
            honoring opt-outs, and complying with all applicable laws, including the TCPA and CTIA
            guidelines.
          </LegalText>
        </LegalSection>

        <LegalSection number={9} title="Records and Auditability">
          <LegalText>
            You agree to maintain accurate records of consent, message content, opt-outs, and related
            data for at least 24 months and make them available to FlowSmartly or regulators upon
            request.
          </LegalText>
        </LegalSection>

        <LegalSection number={10} title="Updates">
          <LegalText>
            We may update these Terms from time to time. Material changes will be communicated via
            email or through the platform. Continued use of SMS services after updates constitutes
            acceptance of the revised Terms.
          </LegalText>
        </LegalSection>

        <LegalSection number={11} title="Contact">
          <LegalText>
            If you received a message and want it to stop, reply STOP to that message. Reply HELP to
            it for the sender&apos;s name and contact details — the business that messaged you is
            responsible for its own campaign, and it can answer far faster than we can.
          </LegalText>
          <LegalText>
            For questions about these Terms, our SMS practices, or to report a message you believe
            breaks them, reach out to us. We have no inbound phone line for compliance: email and the
            contact form are the two channels we monitor, and both reach the same team.
          </LegalText>
          <LegalContactCard
            name="FlowSmartly Compliance Team"
            email="compliance@flowsmartly.com"
            detail={`FlowSmartly, Inc., ${REGISTERED_ADDRESS} — we reply within 2 business days.`}
          />
          <SecondaryButton
            label="Contact the compliance team"
            icon="arrow-right"
            iconRight
            size="sm"
            trackId="sms-terms.contact.compliance"
            onPress={() => router.push(contactHref('support') as never)}
          />
        </LegalSection>
      </LegalLayout>
    </PageShell>
  );
}
