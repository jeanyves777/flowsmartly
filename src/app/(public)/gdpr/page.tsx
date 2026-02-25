import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "GDPR Compliance",
  description:
    "FlowSmartly GDPR Compliance - Your rights under the General Data Protection Regulation and how we protect your data.",
};

const sections = [
  { id: "introduction", title: "Introduction" },
  { id: "legal-basis", title: "Legal Basis for Processing" },
  { id: "data-we-collect", title: "Data We Collect" },
  { id: "social-media-data", title: "Social Media Data" },
  { id: "your-gdpr-rights", title: "Your GDPR Rights" },
  { id: "data-deletion", title: "Data Deletion Instructions" },
  { id: "third-party-sharing", title: "Third-Party Data Sharing" },
  { id: "data-retention", title: "Data Retention" },
  { id: "international-transfers", title: "International Data Transfers" },
  { id: "contact-dpo", title: "Contact Our Data Protection Officer" },
];

export default function GDPRPage() {
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
                GDPR Compliance
              </h1>
              <p className="text-muted-foreground">
                Last updated: February 25, 2026
              </p>
              <p className="mt-4 text-base text-muted-foreground leading-relaxed">
                FlowSmartly is committed to protecting your personal data and
                respecting your privacy rights under the General Data Protection
                Regulation (GDPR). This page explains how we comply with GDPR
                requirements, your rights as a data subject, and how to exercise
                those rights.
              </p>
            </div>

            {/* Sections */}
            <div className="space-y-12">
              {/* 1. Introduction */}
              <section id="introduction">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  1. Introduction
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  The General Data Protection Regulation (GDPR) is a comprehensive
                  data protection law that applies to the processing of personal
                  data of individuals in the European Union (EU) and European
                  Economic Area (EEA).
                </p>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  FlowSmartly processes personal data in accordance with GDPR
                  principles:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-2">
                  <li>
                    <span className="font-medium text-foreground">
                      Lawfulness, Fairness, and Transparency:
                    </span>{" "}
                    We process data lawfully and provide clear information about
                    our practices.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Purpose Limitation:
                    </span>{" "}
                    We collect data for specific, explicit purposes and do not
                    use it for incompatible purposes.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Data Minimization:
                    </span>{" "}
                    We collect only the data necessary to provide our services.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Accuracy:
                    </span>{" "}
                    We take steps to ensure personal data is accurate and up to
                    date.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Storage Limitation:
                    </span>{" "}
                    We retain personal data only as long as necessary.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Integrity and Confidentiality:
                    </span>{" "}
                    We implement appropriate security measures to protect your
                    data.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Accountability:
                    </span>{" "}
                    We take responsibility for GDPR compliance and can demonstrate
                    it.
                  </li>
                </ul>
              </section>

              {/* 2. Legal Basis for Processing */}
              <section id="legal-basis">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  2. Legal Basis for Processing
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  We process your personal data under the following legal bases:
                </p>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  Consent (Article 6(1)(a) GDPR)
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  When you create an account, connect social media accounts
                  (Facebook, Instagram, Google), or subscribe to marketing
                  communications, you provide explicit consent for us to process
                  your personal data for those specific purposes.
                </p>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  Contract Performance (Article 6(1)(b) GDPR)
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  Processing is necessary to perform our contract with you,
                  including providing access to our platform, delivering services
                  you purchase (AI content generation, social media scheduling,
                  SMS marketing), and processing payments.
                </p>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  Legitimate Interests (Article 6(1)(f) GDPR)
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  We may process data based on our legitimate interests, such as
                  fraud prevention, security monitoring, improving our services,
                  and analytics, provided these interests do not override your
                  fundamental rights and freedoms.
                </p>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  Legal Obligations (Article 6(1)(c) GDPR)
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  We process data when required to comply with legal obligations,
                  such as tax laws, anti-money laundering regulations, and court
                  orders.
                </p>
              </section>

              {/* 3. Data We Collect */}
              <section id="data-we-collect">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  3. Data We Collect
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  We collect and process the following categories of personal
                  data:
                </p>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  Account Information
                </h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground leading-relaxed ml-2">
                  <li>Name, email address, username</li>
                  <li>Password (stored in hashed form)</li>
                  <li>Profile picture, bio, social links</li>
                  <li>Country and region</li>
                  <li>Account creation date and last login</li>
                </ul>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  OAuth/Social Login Data
                </h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground leading-relaxed ml-2">
                  <li>OAuth provider ID (Google, Facebook)</li>
                  <li>Email address from OAuth provider</li>
                  <li>Profile name and picture from OAuth provider</li>
                  <li>OAuth access tokens (encrypted)</li>
                </ul>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  Payment Information
                </h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground leading-relaxed ml-2">
                  <li>Billing address</li>
                  <li>Transaction history</li>
                  <li>Subscription plan details</li>
                  <li>
                    Credit card information (processed by Stripe, not stored by
                    us)
                  </li>
                </ul>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  Usage Data
                </h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground leading-relaxed ml-2">
                  <li>IP address, browser type, device information</li>
                  <li>Pages visited, features used, time spent on platform</li>
                  <li>Referring URLs and search terms</li>
                  <li>Session logs and activity timestamps</li>
                </ul>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  Content You Create
                </h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground leading-relaxed ml-2">
                  <li>Social media posts, captions, images, videos</li>
                  <li>AI-generated content (text, images)</li>
                  <li>SMS campaign messages and contact lists</li>
                  <li>Scheduled posts and campaign data</li>
                </ul>
              </section>

              {/* 4. Social Media Data */}
              <section id="social-media-data">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  4. Social Media Data from Facebook & Instagram
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  When you connect your Facebook, Instagram, or Google accounts to
                  FlowSmartly, we access and process specific data from these
                  platforms to provide our services.
                </p>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  Facebook & Instagram Data We Access
                </h3>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-2">
                  <li>
                    <span className="font-medium text-foreground">
                      public_profile:
                    </span>{" "}
                    Your name and profile picture for login authentication
                  </li>
                  <li>
                    <span className="font-medium text-foreground">email:</span>{" "}
                    Your email address for account creation and communication
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      pages_show_list:
                    </span>{" "}
                    List of Facebook Pages you manage
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      pages_manage_posts:
                    </span>{" "}
                    Permission to create and publish posts on your behalf
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      pages_read_engagement:
                    </span>{" "}
                    Read likes, comments, and shares on your posts
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      instagram_basic:
                    </span>{" "}
                    Access to your Instagram Business account profile
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      instagram_content_publish:
                    </span>{" "}
                    Permission to create and publish content to Instagram
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      read_insights:
                    </span>{" "}
                    Access to page and post performance metrics
                  </li>
                </ul>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  How We Use This Data
                </h3>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-2">
                  <li>Authenticate your login via Facebook/Google OAuth</li>
                  <li>
                    Display your connected Pages and Instagram accounts in our
                    dashboard
                  </li>
                  <li>
                    Schedule and publish posts to your Facebook Pages and
                    Instagram
                  </li>
                  <li>Fetch engagement metrics (likes, comments, shares) for analytics</li>
                  <li>Display insights and performance data in your dashboard</li>
                </ul>

                <div className="mt-6 p-4 rounded-lg bg-brand-50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-800">
                  <p className="text-sm font-medium text-brand-800 dark:text-brand-200">
                    <strong>Important:</strong> We only access data you explicitly
                    grant permission for during OAuth login. We do not access your
                    personal Facebook feed, private messages, or friends list. We
                    only interact with Pages and Instagram accounts you manage.
                  </p>
                </div>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  Revoking Social Media Access
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  You can revoke FlowSmartly&apos;s access to your Facebook or
                  Instagram data at any time:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-2">
                  <li>
                    <span className="font-medium text-foreground">
                      Facebook:
                    </span>{" "}
                    Go to Settings → Apps and Websites → FlowSmartly → Remove
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Google:</span>{" "}
                    Go to Google Account → Security → Third-party apps →
                    FlowSmartly → Remove Access
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      FlowSmartly Dashboard:
                    </span>{" "}
                    Settings → Connected Accounts → Disconnect
                  </li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  After revoking access, we will no longer be able to post on your
                  behalf or fetch new data. Existing data will be retained
                  according to our data retention policy unless you request
                  deletion.
                </p>
              </section>

              {/* 5. Your GDPR Rights */}
              <section id="your-gdpr-rights">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  5. Your Rights Under GDPR
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  As a data subject under GDPR, you have the following rights:
                </p>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-semibold text-foreground mb-2">
                      Right of Access (Article 15)
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      You have the right to request a copy of all personal data we
                      hold about you, including account information, usage logs,
                      content you created, and data from connected social media
                      accounts.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-foreground mb-2">
                      Right to Rectification (Article 16)
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      You can request correction of inaccurate or incomplete
                      personal data. You can update most information directly in
                      your account settings.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-foreground mb-2">
                      Right to Erasure / &quot;Right to be Forgotten&quot;
                      (Article 17)
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      You can request deletion of your personal data. We will
                      comply unless we have a legal obligation to retain certain
                      data (e.g., tax records, fraud prevention logs).
                    </p>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-foreground mb-2">
                      Right to Restriction of Processing (Article 18)
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      You can request that we limit how we process your data in
                      certain situations, such as when you contest the accuracy of
                      data or object to processing.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-foreground mb-2">
                      Right to Data Portability (Article 20)
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      You can request a machine-readable copy of your personal
                      data to transfer to another service provider.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-foreground mb-2">
                      Right to Object (Article 21)
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      You can object to processing based on legitimate interests
                      or for direct marketing purposes.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-foreground mb-2">
                      Right to Withdraw Consent (Article 7(3))
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Where processing is based on consent, you can withdraw
                      consent at any time. This does not affect the lawfulness of
                      processing before withdrawal.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-foreground mb-2">
                      Right to Lodge a Complaint (Article 77)
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      You have the right to file a complaint with your local data
                      protection authority if you believe we have violated GDPR.
                    </p>
                  </div>
                </div>

                <div className="mt-6 p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">
                    To exercise any of these rights, contact us at{" "}
                    <a
                      href="mailto:info@flowsmartly.com"
                      className="underline hover:text-green-900 dark:hover:text-green-100"
                    >
                      info@flowsmartly.com
                    </a>
                    . We will respond within 30 days.
                  </p>
                </div>
              </section>

              {/* 6. Data Deletion Instructions */}
              <section id="data-deletion">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  6. Data Deletion Instructions
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  You can request deletion of your personal data at any time.
                  Here&apos;s how:
                </p>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  Method 1: Self-Service Account Deletion
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground leading-relaxed ml-2">
                  <li>Log in to your FlowSmartly account</li>
                  <li>Go to Settings → Account</li>
                  <li>Scroll to &quot;Delete Account&quot; section</li>
                  <li>Click &quot;Delete My Account&quot;</li>
                  <li>
                    Confirm deletion (this action cannot be undone)
                  </li>
                </ol>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  Method 2: Email Request
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  Send an email to{" "}
                  <a
                    href="mailto:info@flowsmartly.com"
                    className="text-brand-600 hover:text-brand-700 underline"
                  >
                    info@flowsmartly.com
                  </a>{" "}
                  with the subject line &quot;GDPR Data Deletion Request&quot;
                  and include:
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground leading-relaxed ml-2">
                  <li>Your full name</li>
                  <li>Email address associated with your account</li>
                  <li>Username (if known)</li>
                  <li>
                    A brief statement: &quot;I request deletion of all my
                    personal data under GDPR Article 17.&quot;
                  </li>
                </ul>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  What Gets Deleted
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  When you request account deletion, we will permanently delete:
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground leading-relaxed ml-2">
                  <li>Your account credentials (email, username, password)</li>
                  <li>Profile information (name, bio, avatar)</li>
                  <li>OAuth tokens for connected social media accounts</li>
                  <li>Content you created (posts, images, campaigns)</li>
                  <li>Contact lists and SMS campaign data</li>
                  <li>Session logs and usage analytics</li>
                </ul>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  Data We Retain (Legal Exceptions)
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  We may retain certain data for legal or legitimate business
                  reasons:
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground leading-relaxed ml-2">
                  <li>
                    Transaction records for tax and accounting purposes (7 years)
                  </li>
                  <li>Fraud prevention and security logs (2 years)</li>
                  <li>
                    Data required for ongoing legal disputes or investigations
                  </li>
                  <li>Aggregated, anonymized analytics data (no personal identifiers)</li>
                </ul>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  Processing Time
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Deletion requests are processed within <strong>30 days</strong>.
                  You will receive a confirmation email once your data has been
                  deleted. Backups may take up to <strong>90 days</strong> to be
                  fully purged from our systems.
                </p>
              </section>

              {/* 7. Third-Party Data Sharing */}
              <section id="third-party-sharing">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  7. Third-Party Data Sharing
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  We share personal data with the following third-party service
                  providers to deliver our services:
                </p>

                <div className="space-y-4">
                  <div className="rounded-lg border border-border p-4">
                    <h3 className="text-base font-semibold text-foreground mb-2">
                      Facebook / Meta Platforms
                    </h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      <strong>Purpose:</strong> OAuth login, posting to Facebook
                      Pages and Instagram, fetching engagement metrics
                    </p>
                    <p className="text-sm text-muted-foreground mb-2">
                      <strong>Data Shared:</strong> Access tokens, Page IDs,
                      Instagram account IDs, post content
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Privacy Policy:</strong>{" "}
                      <a
                        href="https://www.facebook.com/privacy/policy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-600 hover:text-brand-700 underline"
                      >
                        facebook.com/privacy/policy
                      </a>
                    </p>
                  </div>

                  <div className="rounded-lg border border-border p-4">
                    <h3 className="text-base font-semibold text-foreground mb-2">
                      Google LLC
                    </h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      <strong>Purpose:</strong> OAuth login, Google Ads campaign
                      management
                    </p>
                    <p className="text-sm text-muted-foreground mb-2">
                      <strong>Data Shared:</strong> Email, profile name, OAuth
                      tokens, ad campaign data
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Privacy Policy:</strong>{" "}
                      <a
                        href="https://policies.google.com/privacy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-600 hover:text-brand-700 underline"
                      >
                        policies.google.com/privacy
                      </a>
                    </p>
                  </div>

                  <div className="rounded-lg border border-border p-4">
                    <h3 className="text-base font-semibold text-foreground mb-2">
                      Stripe, Inc.
                    </h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      <strong>Purpose:</strong> Payment processing, subscription
                      management
                    </p>
                    <p className="text-sm text-muted-foreground mb-2">
                      <strong>Data Shared:</strong> Email, billing address,
                      payment card information
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Privacy Policy:</strong>{" "}
                      <a
                        href="https://stripe.com/privacy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-600 hover:text-brand-700 underline"
                      >
                        stripe.com/privacy
                      </a>
                    </p>
                  </div>

                  <div className="rounded-lg border border-border p-4">
                    <h3 className="text-base font-semibold text-foreground mb-2">
                      OpenAI, L.L.C.
                    </h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      <strong>Purpose:</strong> AI content generation, image
                      generation
                    </p>
                    <p className="text-sm text-muted-foreground mb-2">
                      <strong>Data Shared:</strong> Content prompts, generated
                      text and images
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Privacy Policy:</strong>{" "}
                      <a
                        href="https://openai.com/policies/privacy-policy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-600 hover:text-brand-700 underline"
                      >
                        openai.com/policies/privacy-policy
                      </a>
                    </p>
                  </div>

                  <div className="rounded-lg border border-border p-4">
                    <h3 className="text-base font-semibold text-foreground mb-2">
                      Twilio Inc.
                    </h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      <strong>Purpose:</strong> SMS message delivery
                    </p>
                    <p className="text-sm text-muted-foreground mb-2">
                      <strong>Data Shared:</strong> Phone numbers, message
                      content, delivery status
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Privacy Policy:</strong>{" "}
                      <a
                        href="https://www.twilio.com/legal/privacy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-600 hover:text-brand-700 underline"
                      >
                        twilio.com/legal/privacy
                      </a>
                    </p>
                  </div>
                </div>

                <p className="text-muted-foreground leading-relaxed mt-4">
                  All third-party processors are required to comply with GDPR and
                  implement appropriate data protection measures.
                </p>
              </section>

              {/* 8. Data Retention */}
              <section id="data-retention">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  8. Data Retention Periods
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  We retain personal data for the following periods:
                </p>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                          Data Type
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                          Retention Period
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                          Reason
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      <tr>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          Account data
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          Until account deletion
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          Service delivery
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          OAuth tokens
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          Until disconnected
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          Social media posting
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          Transaction records
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          7 years
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          Tax and legal compliance
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          SMS campaign logs
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          3 years
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          TCPA compliance
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          Session logs
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          90 days
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          Security monitoring
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          Analytics data
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          2 years (anonymized)
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          Service improvement
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          Fraud prevention logs
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          2 years
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          Security and fraud detection
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* 9. International Data Transfers */}
              <section id="international-transfers">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  9. International Data Transfers
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  FlowSmartly is operated from the United States. If you are
                  located in the EU/EEA, your personal data may be transferred to
                  and processed in the United States or other countries outside
                  the EU/EEA.
                </p>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  We ensure appropriate safeguards for international transfers:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed ml-2">
                  <li>
                    <span className="font-medium text-foreground">
                      Standard Contractual Clauses (SCCs):
                    </span>{" "}
                    We use EU-approved Standard Contractual Clauses with our
                    third-party processors.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Adequacy Decisions:
                    </span>{" "}
                    Where available, we rely on EU adequacy decisions for certain
                    countries.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">
                      Data Processing Agreements:
                    </span>{" "}
                    All processors sign GDPR-compliant Data Processing Agreements
                    (DPAs).
                  </li>
                </ul>
              </section>

              {/* 10. Contact DPO */}
              <section id="contact-dpo">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  10. Contact Our Data Protection Officer
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  For any questions about GDPR compliance, data processing, or to
                  exercise your rights, please contact our Data Protection
                  Officer:
                </p>
                <div className="rounded-lg border border-border bg-card p-6 space-y-3">
                  <div>
                    <span className="font-medium text-foreground">
                      Data Protection Officer
                    </span>
                  </div>
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
                      Subject Line:
                    </span>{" "}
                    GDPR Request - [Your Request Type]
                  </div>
                  <div>
                    <span className="font-medium text-foreground">
                      Response Time:
                    </span>{" "}
                    Within 30 days of receipt
                  </div>
                </div>

                <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
                  EU Data Protection Authorities
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  If you are not satisfied with our response to your GDPR request,
                  you have the right to lodge a complaint with your local
                  supervisory authority:
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  <a
                    href="https://edpb.europa.eu/about-edpb/about-edpb/members_en"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-600 hover:text-brand-700 underline"
                  >
                    List of EU Data Protection Authorities
                  </a>
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
                  href="/terms"
                  className="inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
                >
                  Terms of Service
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
