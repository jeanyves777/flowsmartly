import {
  AsideCard,
  LegalContactCard,
  LegalLayout,
  LegalSection,
  LegalText,
  type DocSection,
} from '@/components/public/legal-page';
import { PageShell } from '@/components/public/page-shell';

/**
 * One authoritative postal address for the entity, printed identically on every
 * legal page. Delaware is where FlowSmartly, Inc. is incorporated — which is why
 * section 12 chooses Delaware law — but the company's address is the one below;
 * printing a registered-agent address here read as a second company.
 */
const REGISTERED_ADDRESS = '548 Market St, PMB 72224, San Francisco, CA 94104, USA';

const SECTIONS: DocSection[] = [
  { id: 'agreement', title: 'Agreement' },
  { id: 'accounts', title: 'Accounts' },
  { id: 'subscriptions', title: 'Subscriptions and Credits' },
  { id: 'acceptable-use', title: 'Acceptable Use' },
  { id: 'ai-content', title: 'AI-Generated Content' },
  { id: 'commerce', title: 'Commerce and Call Agent Services' },
  { id: 'third-party', title: 'Third-Party Services' },
  { id: 'ip', title: 'Intellectual Property' },
  { id: 'termination', title: 'Termination' },
  { id: 'disclaimers', title: 'Disclaimers' },
  { id: 'liability', title: 'Limitation of Liability' },
  { id: 'disputes', title: 'Disputes' },
  { id: 'contact', title: 'Contact' },
];

export default function TermsOfServicePage() {
  return (
    <PageShell
      title="Terms of Service"
      description="The terms that govern your access to and use of FlowSmartly's platform and services."
      cta={false}>
      <LegalLayout
        title="Terms of Service"
        updated="August 3, 2026"
        intro="These Terms of Service (“Terms”) govern your access to and use of FlowSmartly's website, platform, software, and services (collectively, the “Services”). By creating an account or using the Services, you agree to these Terms."
        sections={SECTIONS}
        aside={
          <AsideCard icon="file-lines" title="Plain-language summary" linkLabel="Read the summary">
            <LegalText>
              We&apos;ve created a summary to help you understand the key points. It&apos;s not a
              substitute for these Terms.
            </LegalText>
          </AsideCard>
        }>
        <LegalSection number={1} title="Agreement">
          <LegalText>
            These Terms form a binding agreement between you and FlowSmartly, Inc., a Delaware
            corporation with its principal place of business at {REGISTERED_ADDRESS}. If you use the
            Services on behalf of a company, you confirm that you have the authority to bind that
            company, and &ldquo;you&rdquo; refers to that company. If you do not agree to these Terms,
            do not use the Services.
          </LegalText>
          <LegalText>
            How we handle personal data is governed by our Privacy Policy, and — where we process
            personal data on your behalf — by the Data Processing Agreement referenced on our GDPR
            &amp; Data Protection page.
          </LegalText>
        </LegalSection>

        <LegalSection number={2} title="Accounts">
          <LegalText>
            You must provide accurate account information and keep it current. You are responsible for
            everything that happens under your account, including the activity of team members you
            invite, and for keeping your credentials confidential. Tell us promptly if you suspect
            unauthorized access.
          </LegalText>
        </LegalSection>

        <LegalSection number={3} title="Subscriptions and Credits">
          <LegalText>
            Paid plans renew automatically until cancelled, and usage-based features are billed in
            credits at the rates shown in your account. Credits have no cash value, are not redeemable
            for cash, and may expire. Payments are non-refundable except where a refund is required by
            law. We may change prices or credit rates with notice before your next billing period.
          </LegalText>
        </LegalSection>

        <LegalSection number={4} title="Acceptable Use">
          <LegalText>
            You will not use the Services to send unlawful, deceptive, harassing, or infringing content,
            to send messages without the consent required by law, or to impersonate another person or
            business. You will not attempt to breach, overload, reverse engineer, or resell the
            Services. We may suspend activity that puts our platform, our providers, or other customers
            at risk.
          </LegalText>
        </LegalSection>

        <LegalSection number={5} title="AI-Generated Content">
          <LegalText>
            The Services use AI to generate text, images, audio, video, and recommendations. AI output
            may be inaccurate, incomplete, or unsuitable for your situation, and similar output may be
            generated for other customers. You are responsible for reviewing, editing, and approving any
            AI output before you publish, send, or otherwise rely on it, and for ensuring it complies
            with applicable law and platform policies.
          </LegalText>
        </LegalSection>

        <LegalSection number={6} title="Commerce and Call Agent Services">
          <LegalText>
            If you sell through FlowSmartly, you are the merchant of record for your orders and are
            responsible for your products, pricing, taxes, fulfillment, refunds, and customer support.
            If you use Call Agent, you are responsible for obtaining consent to call and record where
            required, for disclosing the use of an automated agent where required, and for the content
            of the calls. Telephony and payment providers may apply their own terms and fees.
          </LegalText>
        </LegalSection>

        <LegalSection number={7} title="Third-Party Services">
          <LegalText>
            The Services connect to third-party platforms such as social networks, ad networks,
            marketplaces, payment processors, and carriers. Your use of those platforms is governed by
            their own terms, and they may change or discontinue their APIs at any time. We are not
            responsible for third-party services or for content you publish through them.
          </LegalText>
        </LegalSection>

        <LegalSection number={8} title="Intellectual Property">
          <LegalText>
            We own the Services, including our software, models, designs, and trademarks; these Terms
            grant you a limited, non-exclusive, non-transferable right to use them during your
            subscription. You keep ownership of the content you upload and, as between you and us, of
            the output you generate with the Services. You grant us the rights needed to host, process,
            and display that content in order to operate the Services.
          </LegalText>
        </LegalSection>

        <LegalSection number={9} title="Termination">
          <LegalText>
            You may stop using the Services and cancel your subscription at any time from your account.
            We may suspend or terminate access if you breach these Terms, if your payment fails, or if
            required by law or a provider. On termination, your right to use the Services ends and we
            delete your data on the schedule published in our Privacy Policy — account data within 90
            days of closure, with the exceptions listed there for billing, tax and legal-hold records.
          </LegalText>
        </LegalSection>

        <LegalSection number={10} title="Disclaimers">
          <LegalText>
            The Services are provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without
            warranties of any kind, whether express, implied, or statutory, including merchantability,
            fitness for a particular purpose, and non-infringement. We do not warrant that the Services
            will be uninterrupted or error-free, or that they will produce any particular business
            result.
          </LegalText>
        </LegalSection>

        <LegalSection number={11} title="Limitation of Liability">
          <LegalText>
            To the maximum extent permitted by law, neither party is liable for indirect, incidental,
            special, consequential, or punitive damages, or for lost profits, revenue, data, or
            goodwill. Our total liability arising out of or relating to the Services is capped at the
            amounts you paid us in the twelve months preceding the event giving rise to the claim.
          </LegalText>
        </LegalSection>

        <LegalSection number={12} title="Disputes">
          <LegalText>
            These Terms are governed by the laws of the State of Delaware, without regard to its
            conflict-of-laws rules. Any dispute will be brought exclusively in the state or federal
            courts located in New Castle County, Delaware, and both parties consent to that
            jurisdiction. Please contact us first — most issues are resolved faster that way.
          </LegalText>
        </LegalSection>

        <LegalSection number={13} title="Contact">
          <LegalText>For questions about these Terms, reach out to us:</LegalText>
          <LegalContactCard
            name="FlowSmartly, Inc."
            email="legal@flowsmartly.com"
            detail={REGISTERED_ADDRESS}
          />
        </LegalSection>
      </LegalLayout>
    </PageShell>
  );
}
