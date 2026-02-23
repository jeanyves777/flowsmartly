import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "E-Commerce Terms & Conditions",
  description:
    "FlowShop E-Commerce Terms & Conditions - Merchant agreement, customer data privacy, payment processing, and seller guidelines.",
};

const sections = [
  { id: "overview", title: "Overview" },
  { id: "merchant-agreement", title: "Merchant Agreement" },
  { id: "customer-data", title: "Customer Data & Privacy" },
  { id: "payment-processing", title: "Payment Processing" },
  { id: "product-listings", title: "Product Listings" },
  { id: "order-fulfillment", title: "Order Fulfillment" },
  { id: "returns-refunds", title: "Returns & Refunds" },
  { id: "intellectual-property", title: "Intellectual Property" },
  { id: "fees-billing", title: "Fees & Billing" },
  { id: "liability", title: "Liability & Disputes" },
  { id: "termination", title: "Store Suspension & Termination" },
  { id: "data-security", title: "Data Security" },
  { id: "changes-to-terms", title: "Changes to Terms" },
];

export default function EcommerceTermsPage() {
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
                E-Commerce Terms & Conditions
              </h1>
              <p className="text-muted-foreground">
                Last updated: February 23, 2026
              </p>
              <p className="mt-4 text-base text-muted-foreground leading-relaxed">
                These E-Commerce Terms & Conditions (&ldquo;E-Commerce Terms&rdquo;) govern
                your use of FlowShop, the e-commerce platform provided by FlowSmartly.
                By activating a FlowShop store, you agree to be bound by these terms in
                addition to our general{" "}
                <Link href="/terms" className="text-brand-600 hover:underline">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-brand-600 hover:underline">
                  Privacy Policy
                </Link>
                . Please read these terms carefully before creating your online store.
              </p>
            </div>

            {/* Sections */}
            <div className="space-y-12">
              {/* 1. Overview */}
              <section id="overview">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  1. Overview
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  FlowShop is an e-commerce platform within FlowSmartly that enables registered
                  users (&ldquo;Merchants&rdquo;) to create, operate, and manage online stores. FlowSmartly
                  acts solely as the platform provider and technology facilitator &mdash; not as a
                  merchant of record, retailer, or party to any transaction between Merchants and
                  their customers.
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed mb-4">
                  <li>Merchants are independent sellers responsible for their products, pricing, fulfillment, and customer service.</li>
                  <li>FlowSmartly provides the storefront technology, hosting, payment integration, and AI-powered tools.</li>
                  <li>Each store operates under the Merchant&apos;s own brand with a unique storefront URL.</li>
                  <li>FlowSmartly does not take ownership, custody, or title of any products sold through FlowShop stores.</li>
                </ul>
              </section>

              {/* 2. Merchant Agreement */}
              <section id="merchant-agreement">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  2. Merchant Agreement
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  By creating a FlowShop store, you agree to the following obligations and responsibilities:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed mb-4">
                  <li><strong>Eligibility:</strong> You must be at least 18 years of age (or the age of majority in your jurisdiction) and have the legal capacity to enter into a binding agreement.</li>
                  <li><strong>Accurate Information:</strong> You must provide accurate and complete business information during store setup, including your legal name, contact details, and business address.</li>
                  <li><strong>Legal Compliance:</strong> You are solely responsible for complying with all applicable local, state, national, and international laws and regulations governing your store&apos;s operations, including consumer protection, tax collection, and product safety standards.</li>
                  <li><strong>Product Responsibility:</strong> You are fully responsible for the quality, safety, legality, and accurate representation of all products and services offered in your store.</li>
                  <li><strong>Customer Service:</strong> You must respond to customer inquiries within 48 hours and handle all pre-sale and post-sale customer communications in a professional manner.</li>
                  <li><strong>Return & Refund Policy:</strong> You must establish and clearly display a return and refund policy in your store that complies with applicable consumer protection laws.</li>
                  <li><strong>Tax Obligations:</strong> You are responsible for determining, collecting, and remitting any applicable sales taxes, VAT, or other taxes related to your transactions.</li>
                </ul>
              </section>

              {/* 3. Customer Data & Privacy */}
              <section id="customer-data">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  3. Customer Data & Privacy
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  FlowShop stores collect customer information necessary for order fulfillment and
                  store operations. Both FlowSmartly and Merchants have obligations regarding this data:
                </p>
                <h3 className="text-lg font-medium text-foreground mb-3">Data Collected</h3>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed mb-4">
                  <li>Customer name, email address, phone number, and shipping/billing address for order processing.</li>
                  <li>Order history, product preferences, and browsing behavior for store analytics.</li>
                  <li>Payment information is processed exclusively by Stripe &mdash; neither FlowSmartly nor Merchants have access to full credit card numbers.</li>
                </ul>
                <h3 className="text-lg font-medium text-foreground mb-3">Merchant Obligations</h3>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed mb-4">
                  <li>Merchants <strong>must not</strong> share, sell, rent, or distribute customer personal data to any third party for marketing or any other purpose unrelated to order fulfillment.</li>
                  <li>Customer data may only be used for: processing orders, providing customer support, sending order-related communications, and improving store operations.</li>
                  <li>Merchants must comply with the General Data Protection Regulation (GDPR) for EU customers and the California Consumer Privacy Act (CCPA) for California residents.</li>
                  <li>Upon customer request, Merchants must facilitate data access, correction, and deletion requests in accordance with applicable privacy laws.</li>
                </ul>
                <h3 className="text-lg font-medium text-foreground mb-3">FlowSmartly&apos;s Role</h3>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed mb-4">
                  <li>FlowSmartly stores customer data securely on encrypted servers and provides data export and deletion capabilities.</li>
                  <li>FlowSmartly acts as a data processor on behalf of Merchants (who are the data controllers) for store-related customer data.</li>
                  <li>FlowSmartly will not access or use customer data for purposes unrelated to providing the FlowShop service.</li>
                </ul>
              </section>

              {/* 4. Payment Processing */}
              <section id="payment-processing">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  4. Payment Processing
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  All payment processing for FlowShop stores is handled through Stripe, a PCI DSS
                  Level 1 certified payment processor:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed mb-4">
                  <li><strong>Payment Processor:</strong> Stripe handles all payment card processing, ensuring PCI DSS compliance. FlowSmartly does not store, process, or transmit cardholder data directly.</li>
                  <li><strong>Merchant Payouts:</strong> Merchants receive payouts according to Stripe&apos;s standard payout schedule. Payout timing may vary by region and account history.</li>
                  <li><strong>Subscription Fee:</strong> FlowShop charges a flat subscription fee of $5.00 USD per month for store access, billed monthly. A 14-day free trial is provided for new stores &mdash; a valid payment method (card on file) is required but will not be charged during the trial period.</li>
                  <li><strong>Processing Fees:</strong> Standard Stripe processing fees (currently 2.9% + $0.30 per transaction) apply to all customer payments. These fees are passed through at Stripe&apos;s published rates and are deducted from each transaction before payout.</li>
                  <li><strong>Refunds:</strong> Refunds are processed through the FlowShop platform and returned to the customer&apos;s original payment method. Stripe processing fees on refunded transactions are not returned by Stripe.</li>
                  <li><strong>Chargebacks:</strong> Merchants are responsible for any chargebacks and associated fees. Excessive chargebacks (exceeding 1% of transactions) may result in store suspension.</li>
                  <li><strong>Supported Payment Methods:</strong> Credit cards, debit cards, and other payment methods supported by Stripe in the Merchant&apos;s region. Cash on delivery and mobile money options are available in supported markets.</li>
                </ul>
              </section>

              {/* 5. Product Listings */}
              <section id="product-listings">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  5. Product Listings
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  All product listings must meet the following standards:
                </p>
                <h3 className="text-lg font-medium text-foreground mb-3">Listing Requirements</h3>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed mb-4">
                  <li>Product descriptions must be accurate, truthful, and not misleading.</li>
                  <li>Product images must represent the actual items being sold.</li>
                  <li>Pricing must be clearly displayed in the store&apos;s selected currency, including any additional fees (shipping, taxes).</li>
                  <li>Inventory levels must be kept up to date to prevent overselling.</li>
                </ul>
                <h3 className="text-lg font-medium text-foreground mb-3">Prohibited Items</h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  The following products and services are strictly prohibited on FlowShop:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed mb-4">
                  <li>Illegal goods or services in any applicable jurisdiction</li>
                  <li>Weapons, firearms, ammunition, or explosives</li>
                  <li>Controlled substances, drugs, drug paraphernalia, or unlicensed pharmaceuticals</li>
                  <li>Counterfeit, replica, or knockoff products</li>
                  <li>Stolen or misappropriated goods</li>
                  <li>Adult or sexually explicit content</li>
                  <li>Hazardous materials without proper licensing and handling certifications</li>
                  <li>Products that infringe on intellectual property rights (trademarks, copyrights, patents)</li>
                  <li>Financial instruments, securities, or cryptocurrency without proper licensing</li>
                  <li>Any product or service that violates Stripe&apos;s Restricted Businesses list</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed">
                  FlowSmartly reserves the right to remove any product listing that violates these
                  terms without prior notice. Repeated violations may result in store suspension
                  or termination.
                </p>
              </section>

              {/* 6. Order Fulfillment */}
              <section id="order-fulfillment">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  6. Order Fulfillment
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Merchants are fully responsible for order fulfillment and logistics:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed mb-4">
                  <li><strong>Shipping Timeframes:</strong> Products must be shipped within the timeframes advertised in the store. If no specific timeframe is stated, orders must be shipped within 5 business days.</li>
                  <li><strong>Tracking Information:</strong> Merchants must provide order tracking information to customers when available. Tracking updates are displayed on the customer&apos;s order status page.</li>
                  <li><strong>Delay Notifications:</strong> Customers must be notified promptly of any shipping delays beyond the estimated delivery date.</li>
                  <li><strong>Delivery Estimates:</strong> Estimated delivery times are provided in good faith and are not guaranteed by FlowSmartly. Actual delivery times depend on carrier performance and external factors.</li>
                  <li><strong>Shipping Costs & Logistics:</strong> Merchants handle all shipping logistics, carrier selection, packaging, and associated costs. Shipping fees may be passed on to customers as configured in the store settings.</li>
                  <li><strong>International Shipping:</strong> Merchants offering international shipping are responsible for customs declarations, import duties, and compliance with destination country regulations.</li>
                </ul>
              </section>

              {/* 7. Returns & Refunds */}
              <section id="returns-refunds">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  7. Returns & Refunds
                </h2>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed mb-4">
                  <li>Merchants must establish and clearly display a return and refund policy in their store.</li>
                  <li>A minimum 14-day return window is required for all physical goods, unless local law mandates a longer period.</li>
                  <li>Refunds must be processed within 5&ndash;7 business days of receiving a return or approving a refund request.</li>
                  <li>Refunds are returned to the customer&apos;s original payment method through the FlowShop platform.</li>
                  <li>Merchants may charge reasonable restocking fees only if clearly disclosed in their return policy before purchase.</li>
                  <li>FlowSmartly may mediate disputes between Merchants and customers but is not liable for the outcome of merchant-customer disagreements.</li>
                  <li>Customers may contact FlowSmartly support if a Merchant fails to honor their stated return policy.</li>
                </ul>
              </section>

              {/* 8. Intellectual Property */}
              <section id="intellectual-property">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  8. Intellectual Property
                </h2>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed mb-4">
                  <li><strong>Merchant Ownership:</strong> Merchants retain full ownership of their products, brand assets, product descriptions, images, and other original content uploaded to their store.</li>
                  <li><strong>Platform License:</strong> By listing content on FlowShop, Merchants grant FlowSmartly a non-exclusive, worldwide, royalty-free license to display, distribute, and promote their store content on the FlowSmartly platform and associated marketing channels.</li>
                  <li><strong>Third-Party Rights:</strong> Merchants must not upload or sell products that infringe on third-party intellectual property rights, including trademarks, copyrights, and patents.</li>
                  <li><strong>DMCA Compliance:</strong> FlowSmartly will respond to valid Digital Millennium Copyright Act (DMCA) takedown requests. Merchants whose content is the subject of a valid DMCA notice will be notified and given the opportunity to file a counter-notice.</li>
                  <li><strong>AI-Generated Content:</strong> Content generated using FlowShop&apos;s AI tools (product descriptions, enhanced images) is owned by the Merchant who generated it, subject to any third-party model provider terms.</li>
                </ul>
              </section>

              {/* 9. Fees & Billing */}
              <section id="fees-billing">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  9. Fees & Billing
                </h2>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed mb-4">
                  <li><strong>Subscription Fee:</strong> FlowShop is available for $5.00 USD per month, providing access to all store features, themes, and AI tools.</li>
                  <li><strong>Free Trial:</strong> New stores receive a 14-day free trial. A valid payment method (credit or debit card) must be on file, but will not be charged until the trial period ends.</li>
                  <li><strong>Billing Cycle:</strong> Subscriptions are billed monthly on the anniversary of your activation date. Payment is automatically charged to your card on file.</li>
                  <li><strong>Cancellation:</strong> You may cancel your FlowShop subscription at any time. Your store will remain active through the end of your current billing period. No partial refunds are provided for unused portions of a billing cycle.</li>
                  <li><strong>Transaction Fees:</strong> Stripe payment processing fees (currently 2.9% + $0.30 per transaction) are deducted by Stripe from each customer payment before payout to the Merchant.</li>
                  <li><strong>No Hidden Charges:</strong> There are no setup fees, listing fees, commission on sales, or hidden charges beyond the monthly subscription and standard Stripe processing fees.</li>
                  <li><strong>Failed Payments:</strong> If a subscription payment fails, FlowSmartly will attempt to charge your card up to 3 times over 7 days. If all attempts fail, your store may be temporarily deactivated until payment is resolved.</li>
                </ul>
              </section>

              {/* 10. Liability & Disputes */}
              <section id="liability">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  10. Liability & Disputes
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  FlowSmartly provides the FlowShop platform on an &ldquo;as-is&rdquo; and
                  &ldquo;as-available&rdquo; basis:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed mb-4">
                  <li>FlowSmartly is <strong>not liable</strong> for disputes between Merchants and their customers, including but not limited to product quality, shipping issues, refund disputes, or loss of revenue.</li>
                  <li>FlowSmartly is not responsible for any direct, indirect, incidental, special, or consequential damages arising from the use of FlowShop.</li>
                  <li>Merchants agree to <strong>indemnify and hold harmless</strong> FlowSmartly, its officers, directors, employees, and agents from any claims, damages, losses, or expenses arising from their store operations, products sold, or violation of these terms.</li>
                  <li>FlowSmartly&apos;s total liability shall not exceed the amount paid by the Merchant for FlowShop services in the 12 months preceding the claim.</li>
                </ul>
                <h3 className="text-lg font-medium text-foreground mb-3">Dispute Resolution</h3>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed mb-4">
                  <li><strong>Step 1:</strong> Merchants and customers should attempt to resolve disputes directly.</li>
                  <li><strong>Step 2:</strong> If unresolved, either party may contact FlowSmartly support for mediation assistance.</li>
                  <li><strong>Step 3:</strong> If mediation fails, disputes shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association, conducted in the jurisdiction of FlowSmartly&apos;s principal place of business.</li>
                  <li>Both parties waive the right to participate in class action lawsuits or class-wide arbitration related to FlowShop.</li>
                </ul>
              </section>

              {/* 11. Store Suspension & Termination */}
              <section id="termination">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  11. Store Suspension & Termination
                </h2>
                <h3 className="text-lg font-medium text-foreground mb-3">Grounds for Suspension</h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  FlowSmartly may suspend or terminate a store without notice for:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed mb-4">
                  <li>Violation of these E-Commerce Terms or FlowSmartly&apos;s general Terms of Service</li>
                  <li>Fraudulent activity or suspected fraud</li>
                  <li>Excessive chargebacks exceeding 1% of total transactions</li>
                  <li>Repeated customer complaints about product quality, fulfillment, or customer service</li>
                  <li>Sale of prohibited items</li>
                  <li>Legal or regulatory compliance requirements</li>
                  <li>Non-payment of subscription fees</li>
                </ul>
                <h3 className="text-lg font-medium text-foreground mb-3">Voluntary Closure</h3>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed mb-4">
                  <li>Merchants may close their store at any time through their dashboard settings.</li>
                  <li>All active orders must be fulfilled or refunded before store closure.</li>
                  <li>Store data (products, orders, customer information) will be available for export for 30 days after closure.</li>
                  <li>The subscription will be cancelled at the end of the current billing period.</li>
                  <li>After the 30-day export window, store data will be permanently deleted in accordance with our data retention policies.</li>
                </ul>
              </section>

              {/* 12. Data Security */}
              <section id="data-security">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  12. Data Security
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  FlowSmartly implements industry-standard security measures to protect store and
                  customer data:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed mb-4">
                  <li><strong>SSL/TLS Encryption:</strong> All FlowShop stores are served exclusively over HTTPS with modern TLS encryption.</li>
                  <li><strong>Secure Checkout:</strong> Payment processing is handled by Stripe, a PCI DSS Level 1 certified processor. No card data touches FlowSmartly servers.</li>
                  <li><strong>Data Encryption:</strong> All stored data is encrypted at rest using AES-256 encryption.</li>
                  <li><strong>Password Security:</strong> Customer and Merchant passwords are hashed using bcrypt with appropriate salt rounds.</li>
                  <li><strong>Access Controls:</strong> Strict role-based access controls ensure that store data is only accessible to authorized Merchants and FlowSmartly system administrators.</li>
                  <li><strong>Fraud Detection:</strong> Automated fraud detection systems monitor orders for suspicious activity, including velocity checks and address verification.</li>
                  <li><strong>Regular Audits:</strong> FlowSmartly conducts regular security audits and vulnerability assessments of its infrastructure.</li>
                  <li><strong>Incident Response:</strong> In the event of a security breach, affected Merchants and customers will be notified within 72 hours in accordance with applicable breach notification laws.</li>
                </ul>
              </section>

              {/* 13. Changes to Terms */}
              <section id="changes-to-terms">
                <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  13. Changes to Terms
                </h2>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed mb-4">
                  <li>FlowSmartly may update these E-Commerce Terms from time to time. Merchants will be notified of material changes at least 30 days in advance via email and in-dashboard notification.</li>
                  <li>Continued use of FlowShop after changes take effect constitutes acceptance of the updated terms.</li>
                  <li>Material changes that significantly affect Merchant rights or obligations will require explicit acknowledgment before taking effect.</li>
                  <li>Previous versions of these terms are archived and available upon request.</li>
                  <li>If you do not agree to updated terms, you may close your store and cancel your subscription before the changes take effect.</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed">
                  For questions about these terms or to request archived versions, contact us at{" "}
                  <a href="mailto:info@flowsmartly.com" className="text-brand-600 hover:underline">
                    info@flowsmartly.com
                  </a>
                  .
                </p>
              </section>
            </div>

            {/* Related Policies */}
            <div className="mt-12 pt-6 border-t border-border">
              <h3 className="text-lg font-semibold text-foreground mb-3">
                Related Policies
              </h3>
              <div className="flex flex-wrap gap-4">
                <Link href="/privacy" className="text-brand-600 hover:underline">
                  Privacy Policy
                </Link>
                <Link href="/terms" className="text-brand-600 hover:underline">
                  Terms of Service
                </Link>
                <Link href="/sms-terms" className="text-brand-600 hover:underline">
                  SMS Terms
                </Link>
                <Link
                  href="/marketing-compliance"
                  className="text-brand-600 hover:underline"
                >
                  Marketing Compliance
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
