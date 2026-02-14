import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "SMS Terms & Conditions",
  description:
    "FlowSmartly SMS Terms & Conditions - Terms governing SMS marketing services, consent requirements, and compliance obligations.",
};

const sections = [
  { id: "program-description", title: "Program Description" },
  { id: "consent", title: "Consent" },
  { id: "message-frequency", title: "Message Frequency" },
  { id: "opt-out", title: "Opt-Out Instructions" },
  { id: "help", title: "Help" },
  { id: "message-data-rates", title: "Message & Data Rates" },
  { id: "supported-carriers", title: "Supported Carriers" },
  { id: "privacy", title: "Privacy" },
  { id: "user-responsibilities", title: "User Responsibilities" },
  { id: "platform-rights", title: "Platform Rights" },
  { id: "contact", title: "Contact" },
];

export default function SmsTermsPage() {
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
                SMS Terms &amp; Conditions
              </h1>
              <p className="text-muted-foreground">
                Last updated: February 10, 2026
              </p>
              <p className="mt-4 text-base text-muted-foreground leading-relaxed">
                These SMS Terms and Conditions (&quot;SMS Terms&quot;) govern the
                use of SMS messaging services provided through the FlowSmartly
                platform. By using our SMS marketing features as a FlowSmartly
                user, or by opting in to receive SMS messages from a FlowSmartly
                user, you agree to these terms.
              </p>
            </div>

            {/* Sections */}
            <div className="space-y-12">
              {/* 1. Program Description */}
              <section id="program-description">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  1. Program Description
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  FlowSmartly is an AI-powered content creation and marketing
                  platform that enables businesses and individuals
                  (&quot;Users&quot;) to send SMS marketing messages to their
                  customers, subscribers, and contacts (&quot;Recipients&quot;).
                </p>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Our SMS services include:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-2">
                  <li>
                    Promotional SMS campaigns (sales, offers, product
                    announcements)
                  </li>
                  <li>
                    Transactional messages (order confirmations, appointment
                    reminders)
                  </li>
                  <li>Automated SMS sequences and drip campaigns</li>
                  <li>Two-way SMS communication</li>
                  <li>SMS marketing analytics and reporting</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  All SMS messages sent through FlowSmartly are transmitted via
                  our secure messaging infrastructure. FlowSmartly acts as
                  a technology platform facilitating communication between Users
                  and their Recipients.
                </p>
              </section>

              {/* 2. Consent */}
              <section id="consent">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  2. Consent
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Consent is the cornerstone of compliant SMS marketing. All
                  parties involved must adhere to the following consent
                  requirements:
                </p>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  For Recipients
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  By providing your phone number and opting in to receive SMS
                  messages from a FlowSmartly User, you expressly consent to
                  receive recurring marketing and/or informational text messages
                  from that User at the phone number you provided. Consent is not
                  a condition of purchase. You may revoke your consent at any
                  time by replying STOP.
                </p>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  For Users (Senders)
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  As a FlowSmartly User, you must obtain explicit prior written
                  consent from each Recipient before sending SMS messages. This
                  consent must be:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-2">
                  <li>
                    <span className="font-medium text-foreground">
                      Voluntary:
                    </span>{" "}
                    Consent must be freely given and not bundled with unrelated
                    agreements.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Informed:
                    </span>{" "}
                    Recipients must be clearly informed of the types of messages
                    they will receive, approximate frequency, and how to opt out.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Documented:
                    </span>{" "}
                    You must maintain records of when and how consent was
                    obtained for each Recipient.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Specific:
                    </span>{" "}
                    Consent must specifically cover SMS communications and not be
                    implied from other forms of consent.
                  </li>
                </ul>

                <div className="mt-6 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Important: Purchasing or importing phone number lists for SMS
                    marketing without prior consent from those individuals is
                    strictly prohibited and may violate the TCPA. Users who
                    engage in this practice are subject to immediate account
                    suspension.
                  </p>
                </div>
              </section>

              {/* 3. Message Frequency */}
              <section id="message-frequency">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  3. Message Frequency
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Message frequency varies depending on the User&apos;s campaign
                  configuration and the communication preferences set by the
                  Recipient. Typical message frequency may range from one-time
                  messages to multiple messages per week.
                </p>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Users are expected to:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-2">
                  <li>
                    Clearly disclose expected message frequency at the time of
                    opt-in.
                  </li>
                  <li>
                    Respect the frequency limits they communicate to their
                    Recipients.
                  </li>
                  <li>
                    Avoid excessive messaging that could be considered spam or
                    harassment.
                  </li>
                  <li>
                    Honor quiet hours and avoid sending messages during
                    unreasonable hours (before 8:00 AM or after 9:00 PM in the
                    Recipient&apos;s local time zone).
                  </li>
                </ul>
              </section>

              {/* 4. Opt-Out Instructions */}
              <section id="opt-out">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  4. Opt-Out Instructions
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Recipients may opt out of receiving SMS messages at any time
                  using any of the following methods:
                </p>

                <div className="space-y-4">
                  <div className="rounded-lg border border-border bg-card p-5">
                    <h3 className="font-semibold text-foreground mb-2">
                      Reply STOP
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Reply <span className="font-mono font-semibold">STOP</span>,{" "}
                      <span className="font-mono font-semibold">UNSUBSCRIBE</span>,{" "}
                      <span className="font-mono font-semibold">CANCEL</span>,{" "}
                      <span className="font-mono font-semibold">END</span>, or{" "}
                      <span className="font-mono font-semibold">QUIT</span> to
                      any message you receive. The opt-out is processed
                      immediately and you will receive a one-time confirmation
                      that you have been unsubscribed.
                    </p>
                  </div>

                  <div className="rounded-lg border border-border bg-card p-5">
                    <h3 className="font-semibold text-foreground mb-2">
                      Contact the Sender
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Contact the business or individual who sent you the message
                      directly and request removal from their messaging list.
                    </p>
                  </div>

                  <div className="rounded-lg border border-border bg-card p-5">
                    <h3 className="font-semibold text-foreground mb-2">
                      Contact FlowSmartly Support
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Email{" "}
                      <a
                        href="mailto:support@flowsmartly.com"
                        className="text-brand-600 hover:text-brand-700 underline"
                      >
                        support@flowsmartly.com
                      </a>{" "}
                      with the phone number you wish to unsubscribe. Include the
                      name of the sender if known.
                    </p>
                  </div>
                </div>

                <p className="text-muted-foreground leading-relaxed mt-4">
                  After opting out, you will not receive any further marketing
                  messages from that sender through our platform. If you wish to
                  re-subscribe, you must opt in again through the sender&apos;s
                  designated sign-up process. Opt-out requests are processed
                  within minutes in most cases.
                </p>
              </section>

              {/* 5. Help */}
              <section id="help">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  5. Help
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  If you need assistance with SMS messages you are receiving, you
                  can:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-2">
                  <li>
                    Reply{" "}
                    <span className="font-mono font-semibold text-foreground">
                      HELP
                    </span>{" "}
                    to any message to receive support information, including the
                    sender&apos;s name and opt-out instructions.
                  </li>
                  <li>
                    Contact FlowSmartly support at{" "}
                    <a
                      href="mailto:support@flowsmartly.com"
                      className="text-brand-600 hover:text-brand-700 underline"
                    >
                      support@flowsmartly.com
                    </a>{" "}
                    for assistance with any SMS-related issues.
                  </li>
                  <li>
                    Visit our website at{" "}
                    <a
                      href="https://flowsmartly.com"
                      className="text-brand-600 hover:text-brand-700 underline"
                    >
                      flowsmartly.com
                    </a>{" "}
                    for additional resources and documentation.
                  </li>
                </ul>
              </section>

              {/* 6. Message & Data Rates */}
              <section id="message-data-rates">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  6. Message &amp; Data Rates
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Standard message and data rates may apply to SMS messages sent
                  and received through our platform. These rates are determined
                  by your mobile carrier and are not charged by FlowSmartly.
                </p>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Please consult your mobile carrier&apos;s pricing plan for
                  details on text messaging charges. FlowSmartly is not
                  responsible for any charges incurred by Recipients as a result
                  of receiving SMS messages.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  For FlowSmartly Users (senders), SMS messaging costs are
                  determined by your subscription plan and per-message rates as
                  described in your account billing settings. Rates vary by
                  destination country and message type.
                </p>
              </section>

              {/* 7. Supported Carriers */}
              <section id="supported-carriers">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  7. Supported Carriers
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  SMS messages sent through FlowSmartly are supported on all
                  major US carriers, including but not limited to:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                  {[
                    "AT&T",
                    "Verizon Wireless",
                    "T-Mobile",
                    "Sprint",
                    "US Cellular",
                    "Boost Mobile",
                    "Cricket Wireless",
                    "Metro by T-Mobile",
                    "Virgin Mobile",
                    "Straight Talk",
                    "Google Fi",
                    "Mint Mobile",
                  ].map((carrier) => (
                    <div
                      key={carrier}
                      className="text-sm text-muted-foreground py-2 px-3 rounded-md bg-muted/50 border border-border"
                    >
                      {carrier}
                    </div>
                  ))}
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  Carriers are not liable for delayed or undelivered messages. We
                  also support international SMS delivery to many countries,
                  subject to local carrier support and regulations. Delivery
                  rates and reliability may vary by carrier and region.
                </p>
              </section>

              {/* 8. Privacy */}
              <section id="privacy">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  8. Privacy
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Your privacy is important to us. All personal information
                  collected in connection with our SMS services is handled in
                  accordance with our{" "}
                  <Link
                    href="/privacy"
                    className="text-brand-600 hover:text-brand-700 underline"
                  >
                    Privacy Policy
                  </Link>
                  .
                </p>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Key privacy commitments for our SMS services:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-2">
                  <li>
                    Phone numbers and message data are not sold or shared with
                    third parties for their marketing purposes.
                  </li>
                  <li>
                    SMS data is shared only with our messaging infrastructure
                    provider for the purpose of message delivery.
                  </li>
                  <li>
                    Opt-in and opt-out records are maintained securely for
                    compliance purposes.
                  </li>
                  <li>
                    Recipients can request deletion of their data by contacting{" "}
                    <a
                      href="mailto:support@flowsmartly.com"
                      className="text-brand-600 hover:text-brand-700 underline"
                    >
                      support@flowsmartly.com
                    </a>
                    .
                  </li>
                </ul>
              </section>

              {/* 9. User Responsibilities */}
              <section id="user-responsibilities">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  9. User Responsibilities
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  As a FlowSmartly User utilizing our SMS marketing features, you
                  agree to the following responsibilities and obligations:
                </p>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  TCPA Compliance
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  You must comply with the Telephone Consumer Protection Act
                  (TCPA) and all applicable federal, state, and local laws and
                  regulations governing SMS communications. This includes
                  obtaining prior express written consent before sending
                  marketing messages, honoring opt-out requests, and maintaining
                  proper consent records.
                </p>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  Consent Management
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  You are solely responsible for obtaining, documenting, and
                  maintaining valid consent from your Recipients. You must be
                  able to provide evidence of consent upon request from
                  FlowSmartly, regulatory authorities, or carriers.
                </p>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  Privacy Policy
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  You must maintain your own privacy policy that discloses your
                  SMS messaging practices, including the types of messages sent,
                  frequency, opt-out procedures, and how Recipient data is
                  handled.
                </p>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  Content Standards
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  You agree not to send messages that contain:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-2">
                  <li>
                    Deceptive, misleading, or fraudulent content
                  </li>
                  <li>
                    Content that promotes illegal activities or substances
                  </li>
                  <li>
                    Hate speech, harassment, or threats
                  </li>
                  <li>
                    Content that violates intellectual property rights
                  </li>
                  <li>
                    Phishing attempts or malicious links
                  </li>
                  <li>
                    Content prohibited by carrier policies or CTIA guidelines
                  </li>
                </ul>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  Opt-Out Handling
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  You must honor all opt-out requests promptly. When a Recipient
                  replies STOP or uses any other opt-out method, you must not
                  send further messages to that Recipient unless they
                  re-subscribe through a new, valid opt-in process.
                </p>
              </section>

              {/* 10. Platform Rights */}
              <section id="platform-rights">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  10. Platform Rights
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  FlowSmartly reserves the right to take the following actions to
                  maintain the integrity of our platform, protect Recipients, and
                  ensure compliance with applicable laws and carrier
                  requirements:
                </p>
                <ul className="list-disc list-inside space-y-3 text-muted-foreground leading-relaxed ml-2">
                  <li>
                    <span className="font-medium text-foreground">
                      Account Suspension:
                    </span>{" "}
                    Temporarily suspend SMS messaging capabilities for accounts
                    suspected of non-compliance, pending investigation.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Account Termination:
                    </span>{" "}
                    Permanently terminate accounts that engage in repeated or
                    egregious violations of these SMS Terms, the TCPA, or carrier
                    policies.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Content Review:
                    </span>{" "}
                    Review message content and campaigns to ensure compliance
                    with our policies, applicable laws, and carrier standards.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Rate Limiting:
                    </span>{" "}
                    Impose sending limits on accounts to prevent abuse, maintain
                    platform stability, and comply with carrier throughput
                    requirements.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Carrier Compliance:
                    </span>{" "}
                    Modify or reject messages that do not comply with carrier
                    filtering rules, 10DLC registration requirements, or
                    industry best practices.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Cooperation with Authorities:
                    </span>{" "}
                    Share account and messaging data with regulatory authorities,
                    law enforcement, or carriers as required by law or to
                    investigate reports of abuse.
                  </li>
                </ul>

                <div className="mt-6 p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                    FlowSmartly will issue a warning before account suspension
                    whenever practicable. However, we reserve the right to
                    suspend or terminate accounts immediately in cases of severe
                    violations, including sending messages without consent,
                    phishing, or fraud.
                  </p>
                </div>
              </section>

              {/* 11. Contact */}
              <section id="contact">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  11. Contact
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  For questions, concerns, or requests related to these SMS Terms
                  and Conditions, please contact us:
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
                  <div>
                    <span className="font-medium text-foreground">
                      SMS Help:
                    </span>{" "}
                    <span className="text-muted-foreground">
                      Reply HELP to any message received through our platform
                    </span>
                  </div>
                </div>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  We strive to respond to all inquiries within 2 business days.
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
                  href="/privacy"
                  className="inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
                >
                  Privacy Policy
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
