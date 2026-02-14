import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "FlowSmartly Terms of Service - Terms governing the use of our AI-powered marketing platform and services.",
};

const sections = [
  { id: "acceptance", title: "Acceptance of Terms" },
  { id: "services", title: "Services We Provide" },
  { id: "accounts", title: "Account Registration" },
  { id: "subscriptions", title: "Subscriptions & Billing" },
  { id: "credits", title: "Credits System" },
  { id: "acceptable-use", title: "Acceptable Use" },
  { id: "intellectual-property", title: "Intellectual Property" },
  { id: "user-content", title: "User Content" },
  { id: "third-party-services", title: "Third-Party Services" },
  { id: "sms-services", title: "SMS Marketing Services" },
  { id: "disclaimers", title: "Disclaimers" },
  { id: "limitation-of-liability", title: "Limitation of Liability" },
  { id: "termination", title: "Termination" },
  { id: "changes", title: "Changes to Terms" },
  { id: "governing-law", title: "Governing Law" },
  { id: "contact", title: "Contact" },
];

export default function TermsOfServicePage() {
  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-12">
          {/* Desktop Table of Contents Sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <h3 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider">
                Table of Contents
              </h3>
              <nav className="space-y-1">
                {sections.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="block text-sm text-muted-foreground hover:text-brand-600 transition-colors py-1.5 border-l-2 border-transparent hover:border-brand-500 pl-3"
                  >
                    {section.title}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Main Content */}
          <div className="max-w-4xl">
            {/* Header */}
            <div className="mb-10">
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
                Terms of Service
              </h1>
              <p className="text-muted-foreground">
                Last updated: February 12, 2026
              </p>
              <p className="mt-4 text-base text-muted-foreground leading-relaxed">
                Welcome to FlowSmartly. These Terms of Service
                (&quot;Terms&quot;) govern your access to and use of the
                FlowSmartly platform, including our website, applications, APIs,
                and all related services (collectively, the
                &quot;Services&quot;). By creating an account or using our
                Services, you agree to be bound by these Terms. If you are using
                FlowSmartly on behalf of a business or organization, you
                represent that you have the authority to bind that entity to
                these Terms.
              </p>
            </div>

            {/* Sections */}
            <div className="space-y-12">
              {/* 1. Acceptance of Terms */}
              <section id="acceptance">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  1. Acceptance of Terms
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  By accessing or using FlowSmartly, you acknowledge that you
                  have read, understood, and agree to be bound by these Terms,
                  our{" "}
                  <Link
                    href="/privacy"
                    className="text-brand-600 hover:text-brand-700 underline"
                  >
                    Privacy Policy
                  </Link>
                  , and our{" "}
                  <Link
                    href="/sms-terms"
                    className="text-brand-600 hover:text-brand-700 underline"
                  >
                    SMS Terms &amp; Conditions
                  </Link>{" "}
                  (if applicable). If you do not agree to these Terms, you may
                  not use our Services.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  You must be at least 18 years of age, or the age of legal
                  majority in your jurisdiction, to create an account and use our
                  Services. By using FlowSmartly, you represent and warrant that
                  you meet this requirement.
                </p>
              </section>

              {/* 2. Services We Provide */}
              <section id="services">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  2. Services We Provide
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  FlowSmartly is an AI-powered content creation and marketing
                  platform designed for businesses, agencies, entrepreneurs, and
                  individuals. We provide the following services to help you grow
                  and manage your marketing:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-2">
                  <li>
                    <span className="font-medium text-foreground">
                      AI Content Generation:
                    </span>{" "}
                    Create social media posts, captions, hashtags, and marketing
                    copy using artificial intelligence.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      AI Image &amp; Video Creation:
                    </span>{" "}
                    Generate images, logos, animated cartoons, and video content
                    for marketing campaigns.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Social Media Management:
                    </span>{" "}
                    Schedule and publish posts across multiple social media
                    platforms, including Instagram, Facebook, Twitter/X, TikTok,
                    and LinkedIn.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Email Marketing:
                    </span>{" "}
                    Create, send, and track email marketing campaigns to your
                    subscriber lists.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      SMS Marketing:
                    </span>{" "}
                    Send SMS and MMS marketing messages to opted-in contacts via
                    dedicated phone numbers, subject to our{" "}
                    <Link
                      href="/sms-terms"
                      className="text-brand-600 hover:text-brand-700 underline"
                    >
                      SMS Terms
                    </Link>
                    .
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Marketing Strategy:
                    </span>{" "}
                    AI-generated marketing strategies, task planning, scoring,
                    and progress tracking.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Marketing Automations:
                    </span>{" "}
                    Automated workflows for content generation, drip campaigns,
                    and triggered messaging.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Brand Identity Management:
                    </span>{" "}
                    Build and maintain your brand identity including logos,
                    colors, voice, and guidelines.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Analytics &amp; Reporting:
                    </span>{" "}
                    Track campaign performance, engagement metrics, and
                    marketing ROI across channels.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Contact Management:
                    </span>{" "}
                    Import, organize, tag, and manage your marketing contacts and
                    subscriber lists.
                  </li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  We continually develop and improve our Services. We may add,
                  modify, or discontinue features at any time with reasonable
                  notice to users where practicable.
                </p>
              </section>

              {/* 3. Account Registration */}
              <section id="accounts">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  3. Account Registration
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  To use FlowSmartly, you must create an account by providing
                  accurate and complete information. You are responsible for:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-2">
                  <li>
                    Maintaining the confidentiality of your account credentials
                    (email, password, API keys).
                  </li>
                  <li>
                    All activities that occur under your account, whether
                    authorized by you or not.
                  </li>
                  <li>
                    Keeping your account information up to date, including your
                    email address and billing details.
                  </li>
                  <li>
                    Notifying us immediately at{" "}
                    <a
                      href="mailto:support@flowsmartly.com"
                      className="text-brand-600 hover:text-brand-700 underline"
                    >
                      support@flowsmartly.com
                    </a>{" "}
                    if you suspect unauthorized access to your account.
                  </li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  You may not share your account credentials with third parties,
                  create multiple accounts for the purpose of circumventing
                  limits, or use another user&apos;s account without permission.
                </p>
              </section>

              {/* 4. Subscriptions & Billing */}
              <section id="subscriptions">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  4. Subscriptions &amp; Billing
                </h2>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  Plans
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  FlowSmartly offers multiple subscription plans (Free, Starter,
                  Pro, Business) with varying features, limits, and pricing. Plan
                  details and current pricing are available on our pricing page
                  within the application.
                </p>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  Payment
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  Paid subscriptions are billed monthly or annually in advance
                  through Stripe, our payment processor. By subscribing to a
                  paid plan, you authorize us to charge your payment method on a
                  recurring basis until you cancel. All fees are stated in US
                  dollars unless otherwise indicated.
                </p>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  Cancellation
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  You may cancel your subscription at any time from your account
                  settings. Cancellation takes effect at the end of the current
                  billing period. You will retain access to paid features until
                  the end of your billing cycle. We do not provide prorated
                  refunds for partial billing periods.
                </p>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  Price Changes
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  We reserve the right to modify pricing with at least 30
                  days&apos; notice. Price changes will apply at the start of
                  your next billing cycle after the notice period. If you do not
                  agree with the new pricing, you may cancel before the change
                  takes effect.
                </p>
              </section>

              {/* 5. Credits System */}
              <section id="credits">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  5. Credits System
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  FlowSmartly uses a credits-based system for certain services,
                  including AI content generation, image creation, SMS messaging,
                  and phone number rental. Credits are included with your
                  subscription plan and can also be purchased separately.
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-2">
                  <li>
                    <span className="font-medium text-foreground">
                      Credit Value:
                    </span>{" "}
                    1 credit = $0.05 USD. Credit costs for specific actions are
                    displayed in the application before you confirm.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Monthly Allocation:
                    </span>{" "}
                    Each subscription plan includes a monthly credit allocation.
                    Unused credits do not roll over to the next billing period.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Purchased Credits:
                    </span>{" "}
                    Additional credits purchased separately remain in your
                    account until used and do not expire.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Non-Refundable:
                    </span>{" "}
                    Credits that have been used are non-refundable. In the case
                    of a system failure where a service was not delivered,
                    credits will be refunded to your account automatically.
                  </li>
                </ul>
              </section>

              {/* 6. Acceptable Use */}
              <section id="acceptable-use">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  6. Acceptable Use
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  You agree to use FlowSmartly only for lawful purposes and in
                  accordance with these Terms. You agree not to:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-2">
                  <li>
                    Use the Services to send unsolicited messages (spam),
                    including bulk SMS or email without proper consent.
                  </li>
                  <li>
                    Generate, upload, or distribute content that is illegal,
                    harmful, threatening, abusive, harassing, defamatory,
                    obscene, or otherwise objectionable.
                  </li>
                  <li>
                    Impersonate any person or entity, or misrepresent your
                    affiliation with any person or entity.
                  </li>
                  <li>
                    Attempt to gain unauthorized access to our systems, other
                    users&apos; accounts, or third-party services connected
                    through our platform.
                  </li>
                  <li>
                    Use automated tools (bots, scrapers, crawlers) to access the
                    Services, except through our official APIs.
                  </li>
                  <li>
                    Reverse engineer, decompile, or disassemble any part of the
                    Services.
                  </li>
                  <li>
                    Resell, sublicense, or provide the Services to third parties
                    without our written consent.
                  </li>
                  <li>
                    Circumvent or manipulate usage limits, credit systems, or
                    other technical measures we implement.
                  </li>
                  <li>
                    Use the Services in a way that could damage, disable, or
                    impair our servers or interfere with other users&apos;
                    experience.
                  </li>
                  <li>
                    Violate any applicable local, state, national, or
                    international law or regulation, including the TCPA,
                    CAN-SPAM Act, GDPR, and CCPA.
                  </li>
                </ul>
                <div className="mt-6 p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                    Violations of this Acceptable Use policy may result in
                    immediate suspension or termination of your account without
                    prior notice or refund.
                  </p>
                </div>
              </section>

              {/* 7. Intellectual Property */}
              <section id="intellectual-property">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  7. Intellectual Property
                </h2>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  Our Property
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  The FlowSmartly platform, including its design, code,
                  features, branding, documentation, and all related
                  intellectual property, is owned by FlowSmartly and protected by
                  copyright, trademark, and other intellectual property laws. You
                  are granted a limited, non-exclusive, non-transferable license
                  to use the Services for their intended purpose during the term
                  of your subscription.
                </p>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  AI-Generated Content
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  Content generated by our AI tools (text, images, videos) is
                  provided for your use. You retain the rights to use, modify,
                  and distribute AI-generated content created through your
                  account for your business purposes. However, AI-generated
                  content may not be unique, and we do not guarantee exclusivity.
                  Similar content may be generated for other users.
                </p>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  Feedback
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  If you provide feedback, suggestions, or ideas about our
                  Services, you grant us a perpetual, irrevocable, royalty-free
                  license to use that feedback for any purpose, including
                  improving our platform.
                </p>
              </section>

              {/* 8. User Content */}
              <section id="user-content">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  8. User Content
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  You retain ownership of all content you upload, create, or
                  transmit through our Services (&quot;User Content&quot;),
                  including images, text, contact lists, campaign data, and brand
                  assets.
                </p>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  By using our Services, you grant FlowSmartly a limited,
                  non-exclusive license to store, process, display, and transmit
                  your User Content solely for the purpose of providing the
                  Services to you. This license terminates when you delete your
                  content or close your account, except for backups retained per
                  our data retention policies.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  You are solely responsible for your User Content. You
                  represent and warrant that you have all necessary rights and
                  permissions to upload and use any content through our
                  platform, and that your content does not infringe upon the
                  intellectual property rights, privacy rights, or any other
                  rights of any third party.
                </p>
              </section>

              {/* 9. Third-Party Services */}
              <section id="third-party-services">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  9. Third-Party Services
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  FlowSmartly integrates with third-party services to deliver
                  our platform. By using our Services, you acknowledge that your
                  data may be processed by these providers in accordance with
                  their respective terms and privacy policies:
                </p>
                <ul className="list-disc list-inside space-y-3 text-muted-foreground leading-relaxed ml-2">
                  <li>
                    <span className="font-medium text-foreground">
                      OpenAI:
                    </span>{" "}
                    Powers our AI content generation, image creation, and video
                    features. Content submitted to AI features is processed by
                    OpenAI per their{" "}
                    <a
                      href="https://openai.com/policies/terms-of-use"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-600 hover:text-brand-700 underline"
                    >
                      Terms of Use
                    </a>
                    .
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      SMS Infrastructure Provider:
                    </span>{" "}
                    We use a third-party provider for SMS and MMS messaging
                    infrastructure. Phone numbers and message content are
                    transmitted to our provider for delivery.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Stripe:
                    </span>{" "}
                    Processes all payments and manages subscriptions. Your
                    payment information is handled by Stripe per{" "}
                    <a
                      href="https://stripe.com/legal"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-600 hover:text-brand-700 underline"
                    >
                      Stripe&apos;s Terms
                    </a>
                    .
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Social Media Platforms:
                    </span>{" "}
                    When you connect your social media accounts (Instagram,
                    Facebook, Twitter/X, TikTok, LinkedIn), your data is shared
                    with those platforms in accordance with their own terms and
                    policies. You are responsible for complying with each
                    platform&apos;s terms of service.
                  </li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  FlowSmartly is not responsible for the practices, content, or
                  availability of third-party services. Your use of third-party
                  services through our platform is at your own risk and subject
                  to those services&apos; respective terms.
                </p>
              </section>

              {/* 10. SMS Marketing Services */}
              <section id="sms-services">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  10. SMS Marketing Services
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  If you use our SMS marketing features, the following
                  additional terms apply in addition to our{" "}
                  <Link
                    href="/sms-terms"
                    className="text-brand-600 hover:text-brand-700 underline"
                  >
                    SMS Terms &amp; Conditions
                  </Link>
                  :
                </p>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  Compliance Verification
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  Before renting a phone number or sending SMS messages, you must
                  complete our SMS compliance verification process. This includes
                  providing your business information, privacy policy URL, use
                  case description, sample messages, and proof of SMS opt-in
                  (screenshot of your opt-in form). Your application will be
                  reviewed before approval.
                </p>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  Phone Number Rental
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  Phone numbers are rented on a monthly basis and charged to your
                  credit balance. Toll-free numbers require additional
                  carrier verification before SMS messages can be sent.
                  You may release your number at any time, but rental fees are
                  non-refundable for the current billing period.
                </p>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  Your Obligations
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  As a business using our SMS services, you are responsible for:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-2">
                  <li>
                    Obtaining explicit prior written consent from recipients
                    before sending marketing SMS messages.
                  </li>
                  <li>
                    Maintaining a publicly accessible privacy policy that
                    discloses how you collect phone numbers, how SMS data is
                    used, third-party data sharing, and opt-out instructions.
                  </li>
                  <li>
                    Honoring all opt-out requests immediately and maintaining
                    accurate suppression lists.
                  </li>
                  <li>
                    Complying with all applicable laws, including the TCPA,
                    CTIA guidelines, and carrier policies.
                  </li>
                  <li>
                    Including clear identification and opt-out instructions in
                    every message you send.
                  </li>
                </ul>
              </section>

              {/* 11. Disclaimers */}
              <section id="disclaimers">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  11. Disclaimers
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  THE SERVICES ARE PROVIDED &quot;AS IS&quot; AND &quot;AS
                  AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS
                  OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF
                  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
                  NON-INFRINGEMENT.
                </p>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Without limiting the foregoing, FlowSmartly does not warrant
                  that:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-2">
                  <li>
                    The Services will be uninterrupted, error-free, or secure.
                  </li>
                  <li>
                    AI-generated content will be accurate, original, or suitable
                    for any particular purpose.
                  </li>
                  <li>
                    SMS or email messages will be delivered to all recipients
                    without delay or failure.
                  </li>
                  <li>
                    The results obtained from using the Services will meet your
                    specific requirements.
                  </li>
                  <li>
                    Third-party services integrated with our platform will
                    perform as expected.
                  </li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  You acknowledge that AI-generated content should be reviewed
                  by a human before publishing or sending, and you are solely
                  responsible for verifying the accuracy and appropriateness of
                  all content.
                </p>
              </section>

              {/* 12. Limitation of Liability */}
              <section id="limitation-of-liability">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  12. Limitation of Liability
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, FLOWSMARTLY
                  AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT
                  BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
                  CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED
                  TO LOSS OF PROFITS, DATA, BUSINESS OPPORTUNITIES, GOODWILL, OR
                  REVENUE, ARISING FROM OR RELATED TO YOUR USE OF THE SERVICES.
                </p>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  IN NO EVENT SHALL OUR TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS
                  ARISING FROM OR RELATED TO THE SERVICES EXCEED THE GREATER OF
                  (A) THE AMOUNT YOU PAID TO FLOWSMARTLY IN THE TWELVE (12)
                  MONTHS PRECEDING THE EVENT GIVING RISE TO THE CLAIM, OR (B)
                  ONE HUNDRED DOLLARS ($100 USD).
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  This limitation of liability applies regardless of the legal
                  theory on which the claim is based, including breach of
                  contract, tort (including negligence), strict liability, or any
                  other theory, even if FlowSmartly has been advised of the
                  possibility of such damages.
                </p>
              </section>

              {/* 13. Termination */}
              <section id="termination">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  13. Termination
                </h2>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  Termination by You
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  You may terminate your account at any time by contacting us at{" "}
                  <a
                    href="mailto:support@flowsmartly.com"
                    className="text-brand-600 hover:text-brand-700 underline"
                  >
                    support@flowsmartly.com
                  </a>
                  . Upon termination, your access to the Services will be
                  revoked. Any active phone number rentals will be released. We
                  may retain certain data as required by law or for legitimate
                  business purposes (such as compliance records for SMS messaging).
                </p>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  Termination by FlowSmartly
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  We may suspend or terminate your account at any time if you
                  violate these Terms, engage in prohibited activities, fail to
                  pay fees when due, or if we are required to do so by law. We
                  will make reasonable efforts to notify you before termination
                  except in cases of severe violations.
                </p>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  Effect of Termination
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  Upon termination, your right to use the Services ceases
                  immediately. Sections that by their nature should survive
                  termination will remain in effect, including Intellectual
                  Property, Disclaimers, Limitation of Liability, and Governing
                  Law. We may delete your data after a reasonable retention
                  period following termination.
                </p>
              </section>

              {/* 14. Changes to Terms */}
              <section id="changes">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  14. Changes to Terms
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  We reserve the right to modify these Terms at any time. When we
                  make material changes, we will:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-2">
                  <li>
                    Update the &quot;Last updated&quot; date at the top of this
                    page.
                  </li>
                  <li>
                    Notify you via email or through a prominent notice in the
                    application at least 30 days before the changes take effect.
                  </li>
                  <li>
                    Provide you with the opportunity to review the updated Terms
                    before they become effective.
                  </li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  Your continued use of the Services after the updated Terms take
                  effect constitutes your acceptance of the changes. If you do
                  not agree with the updated Terms, you must stop using the
                  Services and close your account.
                </p>
              </section>

              {/* 15. Governing Law */}
              <section id="governing-law">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  15. Governing Law
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  These Terms shall be governed by and construed in accordance
                  with the laws of the United States and the State of Delaware,
                  without regard to conflict of law principles. Any disputes
                  arising under or in connection with these Terms shall be
                  subject to the exclusive jurisdiction of the state and federal
                  courts located in Delaware.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  If any provision of these Terms is found to be unenforceable
                  or invalid, that provision shall be limited or eliminated to
                  the minimum extent necessary so that these Terms shall
                  otherwise remain in full force and effect.
                </p>
              </section>

              {/* 16. Contact */}
              <section id="contact">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  16. Contact
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  If you have any questions or concerns about these Terms of
                  Service, please contact us:
                </p>
                <div className="rounded-lg border border-border bg-card p-6 space-y-3">
                  <div>
                    <span className="font-medium text-foreground">Email:</span>{" "}
                    <a
                      href="mailto:support@flowsmartly.com"
                      className="text-brand-600 hover:text-brand-700 underline"
                    >
                      support@flowsmartly.com
                    </a>
                  </div>
                  <div>
                    <span className="font-medium text-foreground">
                      Website:
                    </span>{" "}
                    <a
                      href="https://flowsmartly.com"
                      className="text-brand-600 hover:text-brand-700 underline"
                    >
                      flowsmartly.com
                    </a>
                  </div>
                </div>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  We will make every effort to respond to your inquiry within 5
                  business days.
                </p>
              </section>
            </div>

            {/* Related Links */}
            <div className="mt-16 pt-8 border-t border-border">
              <h3 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider">
                Related Policies
              </h3>
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/privacy"
                  className="inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
                >
                  Privacy Policy
                  <span aria-hidden="true">&rarr;</span>
                </Link>
                <Link
                  href="/sms-terms"
                  className="inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
                >
                  SMS Terms &amp; Conditions
                  <span aria-hidden="true">&rarr;</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
