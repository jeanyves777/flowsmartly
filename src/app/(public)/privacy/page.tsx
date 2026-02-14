import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "FlowSmartly Privacy Policy - Learn how we collect, use, and protect your personal information.",
};

const sections = [
  { id: "information-we-collect", title: "Information We Collect" },
  { id: "how-we-use-information", title: "How We Use Your Information" },
  { id: "sms-data-handling", title: "SMS Data Handling" },
  { id: "data-sharing", title: "Data Sharing" },
  { id: "data-security", title: "Data Security" },
  { id: "your-rights", title: "Your Rights" },
  { id: "sms-opt-out", title: "SMS Opt-Out" },
  { id: "cookies", title: "Cookies" },
  { id: "childrens-privacy", title: "Children's Privacy" },
  { id: "changes-to-policy", title: "Changes to This Policy" },
  { id: "contact-us", title: "Contact Us" },
];

export default function PrivacyPolicyPage() {
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
                Privacy Policy
              </h1>
              <p className="text-muted-foreground">
                Last updated: February 10, 2026
              </p>
              <p className="mt-4 text-base text-muted-foreground leading-relaxed">
                At FlowSmartly, we take your privacy seriously. This Privacy
                Policy explains how we collect, use, disclose, and safeguard
                your information when you use our platform, including our
                website, applications, and SMS marketing services. Please read
                this policy carefully. By using FlowSmartly, you consent to the
                practices described in this policy.
              </p>
            </div>

            {/* Sections */}
            <div className="space-y-12">
              {/* 1. Information We Collect */}
              <section id="information-we-collect">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  1. Information We Collect
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  We collect information that you provide directly, information
                  collected automatically, and information from third-party
                  sources to deliver and improve our services.
                </p>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  Account Data
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  When you create an account, we collect your name, email
                  address, username, password (stored in hashed form), and
                  optional profile information such as your avatar, bio, and
                  social media links.
                </p>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  Contact Data
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  If you use our SMS marketing or email marketing features, we
                  collect and store the contact information you upload or enter,
                  including names, phone numbers, email addresses, and any custom
                  fields or tags you associate with your contacts. You are
                  responsible for ensuring you have proper consent to store and
                  message these contacts.
                </p>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  Usage Data
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  We automatically collect information about how you interact
                  with our platform, including pages visited, features used, time
                  spent on pages, browser type, device information, IP address,
                  and referring URLs.
                </p>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  Payment Data
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  When you make purchases or subscribe to a plan, our payment
                  processor (Stripe) collects your payment card details, billing
                  address, and transaction history. FlowSmartly does not directly
                  store your full credit card numbers. We retain records of
                  transactions, subscription plans, and credit balances.
                </p>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  SMS & Communication Data
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  When you use our SMS marketing features, we collect and process
                  phone numbers, message content, opt-in and opt-out records,
                  delivery status reports, and timestamps. This data is necessary
                  to deliver messages, maintain compliance records, and provide
                  campaign analytics.
                </p>
              </section>

              {/* 2. How We Use Your Information */}
              <section id="how-we-use-information">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  2. How We Use Your Information
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  We use the information we collect for the following purposes:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-2">
                  <li>
                    <span className="font-medium text-foreground">
                      Service Delivery:
                    </span>{" "}
                    To provide, maintain, and improve our platform, including
                    content creation tools, social media scheduling, AI-powered
                    features, and marketing campaigns.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Communication:
                    </span>{" "}
                    To send you service-related notifications, updates, security
                    alerts, and support messages. We may also send promotional
                    communications with your consent.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      SMS Marketing on Your Behalf:
                    </span>{" "}
                    To send SMS messages to your contacts as directed by you
                    through our campaign tools. FlowSmartly acts as a service
                    provider facilitating SMS communication between you and your
                    audience.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Analytics:
                    </span>{" "}
                    To analyze usage patterns, measure the effectiveness of
                    campaigns, generate reports, and improve our features and
                    user experience.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Security & Fraud Prevention:
                    </span>{" "}
                    To detect, prevent, and address security issues, abuse, and
                    fraudulent activity on our platform.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Legal Compliance:
                    </span>{" "}
                    To comply with applicable laws, regulations, and legal
                    processes, including the Telephone Consumer Protection Act
                    (TCPA), CAN-SPAM Act, and GDPR where applicable.
                  </li>
                </ul>
              </section>

              {/* 3. SMS Data Handling */}
              <section id="sms-data-handling">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  3. SMS Data Handling
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  FlowSmartly provides SMS marketing tools that enable our users
                  (businesses and individuals) to communicate with their
                  audiences via text message. All SMS communications are
                  processed through our secure messaging infrastructure. The
                  following describes how we handle SMS-related
                  data:
                </p>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  Phone Numbers
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  Phone numbers are collected by our users from their own
                  customers and contacts with appropriate consent. These numbers
                  are stored securely in our database and transmitted to our
                  messaging provider solely for the purpose of delivering SMS
                  messages. We do not
                  sell, rent, or share phone numbers with third parties for
                  marketing purposes.
                </p>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  Message Content
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  Message content is created by our users and stored in our
                  system for campaign management, scheduling, and analytics. We
                  do not modify message content. Message logs may be retained for
                  compliance, support, and analytics purposes.
                </p>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  Opt-In Records
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  Our users are required to obtain proper consent from their
                  contacts before sending SMS messages. We maintain records of
                  opt-in status, including the date, time, and method of consent,
                  to support compliance with the TCPA and carrier requirements.
                </p>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  Delivery Status
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  We receive delivery status information from our messaging provider (delivered,
                  failed, undelivered, etc.) to provide campaign analytics and
                  troubleshoot delivery issues. This data is associated with
                  individual messages and retained as part of campaign records.
                </p>
              </section>

              {/* 4. Data Sharing */}
              <section id="data-sharing">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  4. Data Sharing
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  We share your information only in the following limited
                  circumstances:
                </p>
                <ul className="list-disc list-inside space-y-3 text-muted-foreground leading-relaxed ml-2">
                  <li>
                    <span className="font-medium text-foreground">
                      SMS Infrastructure Provider:
                    </span>{" "}
                    Phone numbers and message content are shared with our
                    messaging provider to deliver SMS messages. Our provider
                    processes this data in accordance with their own privacy
                    policy.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Stripe (Payment Processor):
                    </span>{" "}
                    Payment information is shared with Stripe to process
                    transactions. Stripe handles payment data in accordance with
                    PCI DSS standards and their{" "}
                    <a
                      href="https://stripe.com/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-600 hover:text-brand-700 underline"
                    >
                      Privacy Policy
                    </a>
                    .
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      OpenAI (AI Services):
                    </span>{" "}
                    Content you submit to our AI-powered features (such as
                    content generation and image creation) may be sent to OpenAI
                    for processing. OpenAI processes this data in accordance with
                    their{" "}
                    <a
                      href="https://openai.com/policies/privacy-policy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-600 hover:text-brand-700 underline"
                    >
                      Privacy Policy
                    </a>
                    .
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Legal Requirements:
                    </span>{" "}
                    We may disclose information if required by law, subpoena,
                    court order, or governmental regulation, or when we believe
                    disclosure is necessary to protect our rights, your safety,
                    or the safety of others.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Business Transfers:
                    </span>{" "}
                    In the event of a merger, acquisition, or sale of assets,
                    your information may be transferred as part of that
                    transaction. We will notify you of any such change.
                  </li>
                </ul>
                <div className="mt-6 p-4 rounded-lg bg-brand-50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-800">
                  <p className="text-sm font-medium text-brand-800 dark:text-brand-200">
                    We do not sell, rent, or trade your personal information to
                    third parties for their marketing purposes. Ever.
                  </p>
                </div>
              </section>

              {/* 5. Data Security */}
              <section id="data-security">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  5. Data Security
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  We implement industry-standard security measures to protect
                  your information from unauthorized access, alteration,
                  disclosure, or destruction. These measures include:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-2">
                  <li>
                    <span className="font-medium text-foreground">
                      Encryption in Transit:
                    </span>{" "}
                    All data transmitted between your browser and our servers is
                    encrypted using TLS (Transport Layer Security).
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Encryption at Rest:
                    </span>{" "}
                    Sensitive data, including passwords and API keys, is
                    encrypted at rest using strong cryptographic algorithms.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Access Controls:
                    </span>{" "}
                    Access to personal data is restricted to authorized personnel
                    who require it for legitimate business purposes. We employ
                    role-based access controls and audit logging.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Secure Infrastructure:
                    </span>{" "}
                    Our platform is hosted on secure infrastructure with regular
                    security updates, vulnerability monitoring, and automated
                    backups.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Password Security:
                    </span>{" "}
                    User passwords are hashed using bcrypt and are never stored
                    in plain text.
                  </li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  While we strive to protect your information, no method of
                  electronic transmission or storage is 100% secure. We cannot
                  guarantee absolute security, but we are committed to promptly
                  addressing any security incidents and notifying affected users
                  as required by law.
                </p>
              </section>

              {/* 6. Your Rights */}
              <section id="your-rights">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  6. Your Rights
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Depending on your location and applicable laws, you may have
                  the following rights regarding your personal data:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-2">
                  <li>
                    <span className="font-medium text-foreground">
                      Right of Access:
                    </span>{" "}
                    You may request a copy of the personal information we hold
                    about you.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Right of Correction:
                    </span>{" "}
                    You may request that we correct any inaccurate or incomplete
                    personal information. You can also update most of your
                    information directly through your account settings.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Right of Deletion:
                    </span>{" "}
                    You may request that we delete your personal information,
                    subject to certain legal exceptions (such as data we are
                    required to retain for compliance purposes).
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Right to Opt Out:
                    </span>{" "}
                    You may opt out of promotional communications by following
                    the unsubscribe instructions in our emails or by contacting
                    us directly.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Right to Data Portability:
                    </span>{" "}
                    Where applicable, you may request a machine-readable copy of
                    your data.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Right to Restrict Processing:
                    </span>{" "}
                    You may request that we limit the processing of your personal
                    data under certain circumstances.
                  </li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  To exercise any of these rights, please contact us at{" "}
                  <a
                    href="mailto:info@flowsmartly.com"
                    className="text-brand-600 hover:text-brand-700 underline"
                  >
                    info@flowsmartly.com
                  </a>
                  . We will respond to your request within 30 days.
                </p>
              </section>

              {/* 7. SMS Opt-Out */}
              <section id="sms-opt-out">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  7. SMS Opt-Out
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  If you are a recipient of SMS messages sent through
                  FlowSmartly, you have the right to opt out at any time.
                </p>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  How to Opt Out
                </h3>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-2">
                  <li>
                    <span className="font-medium text-foreground">
                      Reply STOP:
                    </span>{" "}
                    Reply &quot;STOP&quot; to any SMS message you receive through
                    our platform. Your opt-out will be processed immediately and
                    you will receive a confirmation message.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Contact the Sender:
                    </span>{" "}
                    Reach out directly to the business or individual who sent you
                    the message and request to be removed from their contact
                    list.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Contact FlowSmartly:
                    </span>{" "}
                    Email{" "}
                    <a
                      href="mailto:info@flowsmartly.com"
                      className="text-brand-600 hover:text-brand-700 underline"
                    >
                      info@flowsmartly.com
                    </a>{" "}
                    with the phone number you wish to unsubscribe and we will
                    process your request.
                  </li>
                </ul>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  After Opt-Out
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  Once you opt out, your phone number will be added to a
                  suppression list and no further marketing messages will be sent
                  to you from that sender through our platform. Your opt-out
                  record is retained to ensure compliance. Please note that
                  opting out of messages from one sender does not automatically
                  opt you out of messages from other senders using our platform.
                </p>
              </section>

              {/* 8. Cookies */}
              <section id="cookies">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  8. Cookies
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  FlowSmartly uses cookies and similar tracking technologies to
                  enhance your experience on our platform.
                </p>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  Types of Cookies We Use
                </h3>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-2">
                  <li>
                    <span className="font-medium text-foreground">
                      Essential Cookies:
                    </span>{" "}
                    Required for the platform to function properly, including
                    authentication tokens and session management. These cannot be
                    disabled.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Functional Cookies:
                    </span>{" "}
                    Used to remember your preferences, such as theme settings
                    (light/dark mode) and language preferences.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Analytics Cookies:
                    </span>{" "}
                    Help us understand how users interact with our platform so we
                    can improve the user experience. These cookies collect
                    aggregated, anonymous data.
                  </li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  You can manage cookie preferences through your browser
                  settings. Disabling certain cookies may limit the functionality
                  of our platform.
                </p>
              </section>

              {/* 9. Children's Privacy */}
              <section id="childrens-privacy">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  9. Children&apos;s Privacy
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  FlowSmartly is not intended for use by children under the age
                  of 16 (or 13 in jurisdictions where a lower age of consent
                  applies). We do not knowingly collect personal information from
                  children under these ages.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  If we become aware that we have inadvertently collected
                  personal information from a child under the applicable age, we
                  will take steps to delete that information as promptly as
                  possible. If you believe we may have collected information from
                  a child, please contact us at{" "}
                  <a
                    href="mailto:info@flowsmartly.com"
                    className="text-brand-600 hover:text-brand-700 underline"
                  >
                    info@flowsmartly.com
                  </a>
                  .
                </p>
              </section>

              {/* 10. Changes to This Policy */}
              <section id="changes-to-policy">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  10. Changes to This Policy
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  We may update this Privacy Policy from time to time to reflect
                  changes in our practices, technology, legal requirements, or
                  other factors. When we make material changes, we will:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-2">
                  <li>
                    Update the &quot;Last updated&quot; date at the top of this
                    page.
                  </li>
                  <li>
                    Post a prominent notice on our platform or send you a
                    notification via email.
                  </li>
                  <li>
                    Where required by law, obtain your consent before applying
                    the changes to your existing data.
                  </li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  We encourage you to review this Privacy Policy periodically to
                  stay informed about how we protect your information.
                </p>
              </section>

              {/* 11. Contact Us */}
              <section id="contact-us">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  11. Contact Us
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  If you have any questions, concerns, or requests regarding this
                  Privacy Policy or how we handle your personal information,
                  please contact us:
                </p>
                <div className="rounded-lg border border-border bg-card p-6 space-y-3">
                  <div>
                    <span className="font-medium text-foreground">Email:</span>{" "}
                    <a
                      href="mailto:info@flowsmartly.com"
                      className="text-brand-600 hover:text-brand-700 underline"
                    >
                      info@flowsmartly.com
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
                  We will make every effort to respond to your inquiry within 30
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
                  href="/terms"
                  className="inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
                >
                  Terms of Service
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
