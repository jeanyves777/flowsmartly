/**
 * Default content for each block type — used when adding a new block in the editor.
 */

import type {
  WebsiteBlockType,
  WebsiteBlock,
  HeroContent,
  FeaturesContent,
  PricingContent,
  TestimonialsContent,
  GalleryContent,
  ContactContent,
  TextContent,
  TeamContent,
  FAQContent,
  StatsContent,
  CTAContent,
  HeaderContent,
  FooterContent,
  CustomHtmlContent,
  BlogContent,
  PortfolioContent,
  LogoCloudContent,
  VideoContent,
  DividerContent,
  SpacerContent,
  ColumnsContent,
  ImageContent,
  BlockContent,
  BlockStyle,
  BlockAnimation,
  BlockResponsive,
  BlockVisibility,
} from "@/types/website-builder";

function id(): string {
  return Math.random().toString(36).substring(2, 11);
}

const defaultStyle: BlockStyle = {};
const defaultAnimation: BlockAnimation = { entrance: "none", scroll: "none", hover: "none" };
const defaultResponsive: BlockResponsive = {};
const defaultVisibility: BlockVisibility = { enabled: true };

// --- Default Content Per Block Type ---

const heroDefault: HeroContent = {
  headline: "Build Something Amazing",
  subheadline: "The modern platform for creating stunning digital experiences",
  description: "Get started today and transform your ideas into reality with our powerful tools and intuitive interface.",
  primaryCta: { text: "Get Started", href: "#", style: "solid" },
  secondaryCta: { text: "Learn More", href: "#about", style: "outline" },
  mediaPosition: "right",
};

const featuresDefault: FeaturesContent = {
  headline: "Why Choose Us",
  subheadline: "Everything you need to succeed",
  items: [
    { icon: "Zap", title: "Lightning Fast", description: "Optimized for speed and performance at every level." },
    { icon: "Shield", title: "Secure & Reliable", description: "Enterprise-grade security to protect your data." },
    { icon: "Sparkles", title: "AI-Powered", description: "Smart features that learn and adapt to your needs." },
    { icon: "Users", title: "Team Collaboration", description: "Work together seamlessly with your entire team." },
    { icon: "BarChart3", title: "Analytics", description: "Deep insights to help you make better decisions." },
    { icon: "HeadphonesIcon", title: "24/7 Support", description: "Our team is always here to help you succeed." },
  ],
  columns: 3,
  layout: "grid",
};

const pricingDefault: PricingContent = {
  headline: "Simple, Transparent Pricing",
  subheadline: "Choose the plan that fits your needs",
  billingToggle: true,
  plans: [
    {
      name: "Starter",
      price: "$9",
      period: "/month",
      yearlyPrice: "$7",
      description: "Perfect for getting started",
      features: ["Up to 1,000 visitors", "5 pages", "Basic analytics", "Email support"],
      cta: { text: "Start Free", href: "#" },
    },
    {
      name: "Pro",
      price: "$29",
      period: "/month",
      yearlyPrice: "$24",
      description: "For growing businesses",
      features: ["Unlimited visitors", "Unlimited pages", "Advanced analytics", "Priority support", "Custom domain", "Member login"],
      cta: { text: "Get Pro", href: "#" },
      highlighted: true,
      badge: "Popular",
    },
    {
      name: "Enterprise",
      price: "$99",
      period: "/month",
      yearlyPrice: "$79",
      description: "For large organizations",
      features: ["Everything in Pro", "White-label", "API access", "Dedicated support", "SLA guarantee", "Custom integrations"],
      cta: { text: "Contact Sales", href: "#" },
    },
  ],
};

const testimonialsDefault: TestimonialsContent = {
  headline: "What Our Customers Say",
  subheadline: "Trusted by thousands of happy customers",
  items: [
    { quote: "This platform completely transformed our online presence. The results speak for themselves.", author: "Sarah Johnson", role: "CEO", company: "TechCorp", rating: 5 },
    { quote: "The best investment we've made for our business. Simple to use, powerful results.", author: "Michael Chen", role: "Marketing Director", company: "GrowthLab", rating: 5 },
    { quote: "Outstanding support team and an incredible product. We couldn't be happier.", author: "Emily Davis", role: "Founder", company: "StartupXYZ", rating: 5 },
  ],
  layout: "grid",
};

const galleryDefault: GalleryContent = {
  headline: "Our Gallery",
  subheadline: "A showcase of our best work",
  items: [
    { imageUrl: "", caption: "Project Alpha" },
    { imageUrl: "", caption: "Project Beta" },
    { imageUrl: "", caption: "Project Gamma" },
    { imageUrl: "", caption: "Project Delta" },
    { imageUrl: "", caption: "Project Epsilon" },
    { imageUrl: "", caption: "Project Zeta" },
  ],
  columns: 3,
  layout: "grid",
  lightbox: true,
};

const contactDefault: ContactContent = {
  headline: "Get in Touch",
  description: "Have a question or want to work together? We'd love to hear from you.",
  fields: [
    { name: "name", label: "Full Name", type: "text", required: true, placeholder: "John Doe" },
    { name: "email", label: "Email Address", type: "email", required: true, placeholder: "john@example.com" },
    { name: "phone", label: "Phone Number", type: "phone", placeholder: "+1 (555) 123-4567" },
    { name: "message", label: "Message", type: "textarea", required: true, placeholder: "Tell us about your project..." },
  ],
  submitText: "Send Message",
  successMessage: "Thank you! We'll get back to you within 24 hours.",
  showInfo: true,
  email: "hello@example.com",
  phone: "+1 (555) 123-4567",
  address: "123 Main Street, New York, NY 10001",
};

const textDefault: TextContent = {
  heading: "Our Story",
  headingLevel: "h2",
  body: "We started with a simple mission: to make the web accessible to everyone. Today, we're proud to serve thousands of customers worldwide who trust us to power their digital presence.\n\nOur team of passionate designers and engineers works tirelessly to create tools that are not just powerful, but also a joy to use.",
  alignment: "left",
  columns: 1,
};

const teamDefault: TeamContent = {
  headline: "Meet Our Team",
  subheadline: "The people behind the magic",
  members: [
    { name: "Alex Rivera", role: "CEO & Founder", bio: "Visionary leader with 15+ years in tech." },
    { name: "Jordan Lee", role: "CTO", bio: "Full-stack architect passionate about scalable systems." },
    { name: "Sam Taylor", role: "Head of Design", bio: "Award-winning designer with an eye for detail." },
    { name: "Casey Morgan", role: "Head of Marketing", bio: "Growth expert driving our brand forward." },
  ],
  columns: 4,
  layout: "grid",
  showBio: true,
};

const faqDefault: FAQContent = {
  headline: "Frequently Asked Questions",
  subheadline: "Everything you need to know",
  items: [
    { question: "How do I get started?", answer: "Simply sign up for a free account and follow our step-by-step setup wizard. You'll be up and running in minutes." },
    { question: "Can I use my own domain?", answer: "Yes! You can connect your existing domain or purchase a new one directly through our platform." },
    { question: "Is there a free trial?", answer: "Absolutely. We offer a 14-day free trial with full access to all features, no credit card required." },
    { question: "What kind of support do you offer?", answer: "We provide 24/7 email support, live chat during business hours, and comprehensive documentation." },
    { question: "Can I cancel anytime?", answer: "Yes, you can cancel your subscription at any time with no cancellation fees." },
  ],
  layout: "accordion",
};

const statsDefault: StatsContent = {
  headline: "By the Numbers",
  items: [
    { value: "10,000", label: "Happy Customers", suffix: "+" },
    { value: "99.9", label: "Uptime", suffix: "%" },
    { value: "50", label: "Countries", suffix: "+" },
    { value: "4.9", label: "Average Rating", prefix: "", suffix: "/5" },
  ],
  columns: 4,
  animated: true,
};

const ctaDefault: CTAContent = {
  headline: "Ready to Get Started?",
  description: "Join thousands of satisfied customers and take your business to the next level today.",
  primaryCta: { text: "Start Free Trial", href: "#", style: "solid" },
  secondaryCta: { text: "Schedule a Demo", href: "#", style: "outline" },
  bgStyle: "gradient",
};

const headerDefault: HeaderContent = {
  logoText: "YourBrand",
  logoPosition: "left",
  items: [
    { label: "Home", href: "/" },
    { label: "About", href: "/about" },
    { label: "Services", href: "/services" },
    { label: "Pricing", href: "/pricing" },
    { label: "Contact", href: "/contact" },
  ],
  cta: { text: "Get Started", href: "#", style: "solid" },
  sticky: true,
  transparent: false,
};

const footerDefault: FooterContent = {
  logoText: "YourBrand",
  description: "Building the future of the web, one site at a time.",
  columns: [
    { title: "Product", links: [{ label: "Features", href: "/features" }, { label: "Pricing", href: "/pricing" }, { label: "Templates", href: "/templates" }] },
    { title: "Company", links: [{ label: "About", href: "/about" }, { label: "Blog", href: "/blog" }, { label: "Careers", href: "/careers" }] },
    { title: "Support", links: [{ label: "Help Center", href: "/help" }, { label: "Contact", href: "/contact" }, { label: "Status", href: "/status" }] },
  ],
  copyright: " 2026 YourBrand. All rights reserved.",
  socials: [
    { platform: "twitter", url: "#" },
    { platform: "instagram", url: "#" },
    { platform: "linkedin", url: "#" },
  ],
  newsletter: false,
};

const customHtmlDefault: CustomHtmlContent = {
  html: '<div style="text-align:center;padding:40px 20px;">\n  <h2>Custom HTML Block</h2>\n  <p>Add your own HTML, CSS, and JavaScript here.</p>\n</div>',
  css: "",
  js: "",
};

const blogDefault: BlogContent = {
  headline: "Latest from Our Blog",
  subheadline: "Insights, tips, and stories",
  posts: [
    { title: "Getting Started with Web Design", excerpt: "Learn the fundamentals of creating beautiful websites from scratch.", date: "2026-03-15", author: "Alex Rivera", category: "Design" },
    { title: "10 Tips for Better SEO", excerpt: "Boost your search rankings with these proven strategies.", date: "2026-03-10", author: "Jordan Lee", category: "Marketing" },
    { title: "The Future of AI in Web Development", excerpt: "How artificial intelligence is transforming the way we build websites.", date: "2026-03-05", author: "Sam Taylor", category: "Technology" },
  ],
  columns: 3,
  layout: "grid",
  showDate: true,
  showAuthor: true,
};

const portfolioDefault: PortfolioContent = {
  headline: "Our Portfolio",
  subheadline: "Selected projects we're proud of",
  projects: [
    { title: "E-Commerce Redesign", description: "Complete overhaul of an online store", imageUrl: "", category: "Web Design", tags: ["UI/UX", "E-commerce"] },
    { title: "Brand Identity", description: "Full brand package for a tech startup", imageUrl: "", category: "Branding", tags: ["Logo", "Identity"] },
    { title: "Mobile App", description: "Cross-platform fitness application", imageUrl: "", category: "App Design", tags: ["Mobile", "UI"] },
  ],
  columns: 3,
  layout: "grid",
  filterable: true,
};

const logoCloudDefault: LogoCloudContent = {
  headline: "Trusted by Leading Companies",
  logos: [
    { imageUrl: "", alt: "Company 1" },
    { imageUrl: "", alt: "Company 2" },
    { imageUrl: "", alt: "Company 3" },
    { imageUrl: "", alt: "Company 4" },
    { imageUrl: "", alt: "Company 5" },
    { imageUrl: "", alt: "Company 6" },
  ],
  layout: "row",
  grayscale: true,
};

const videoDefault: VideoContent = {
  headline: "See It in Action",
  description: "Watch how our platform can transform your workflow",
  videoUrl: "",
  videoType: "youtube",
  autoplay: false,
  loop: false,
  muted: false,
};

const dividerDefault: DividerContent = {
  style: "line",
  height: 1,
};

const spacerDefault: SpacerContent = {
  height: 60,
  mobileHeight: 30,
};

const columnsDefault: ColumnsContent = {
  columns: [
    { width: "50%", blocks: [] },
    { width: "50%", blocks: [] },
  ],
  gap: 24,
  layout: "equal",
};

const imageDefault: ImageContent = {
  imageUrl: "",
  alt: "Image",
  objectFit: "cover",
  aspectRatio: "16:9",
  rounded: true,
};

// --- Default Content Map ---

export const BLOCK_DEFAULT_CONTENT: Record<WebsiteBlockType, BlockContent> = {
  hero: heroDefault,
  features: featuresDefault,
  pricing: pricingDefault,
  testimonials: testimonialsDefault,
  gallery: galleryDefault,
  contact: contactDefault,
  text: textDefault,
  team: teamDefault,
  faq: faqDefault,
  stats: statsDefault,
  cta: ctaDefault,
  header: headerDefault,
  footer: footerDefault,
  "custom-html": customHtmlDefault,
  blog: blogDefault,
  portfolio: portfolioDefault,
  "logo-cloud": logoCloudDefault,
  video: videoDefault,
  divider: dividerDefault,
  spacer: spacerDefault,
  columns: columnsDefault,
  image: imageDefault,
};

// --- Default Variant Per Block Type ---

export const BLOCK_DEFAULT_VARIANT: Record<WebsiteBlockType, string> = {
  hero: "centered",
  features: "grid-icons",
  pricing: "three-column",
  testimonials: "grid-cards",
  gallery: "grid",
  contact: "split",
  text: "simple",
  team: "grid-cards",
  faq: "accordion",
  stats: "row",
  cta: "centered",
  header: "standard",
  footer: "columns",
  "custom-html": "default",
  blog: "grid-cards",
  portfolio: "grid",
  "logo-cloud": "row",
  video: "centered",
  divider: "line",
  spacer: "default",
  columns: "equal",
  image: "full-width",
};

// --- Create New Block ---

export function createBlock(type: WebsiteBlockType, sortOrder: number = 0, variant?: string): WebsiteBlock {
  return {
    id: id(),
    type,
    variant: variant || BLOCK_DEFAULT_VARIANT[type],
    content: JSON.parse(JSON.stringify(BLOCK_DEFAULT_CONTENT[type])),
    style: { ...defaultStyle },
    animation: { ...defaultAnimation },
    responsive: { ...defaultResponsive },
    visibility: { ...defaultVisibility },
    sortOrder,
  };
}

// --- Block Categories for Editor Panel ---

export const BLOCK_CATEGORIES = [
  {
    name: "Layout",
    icon: "LayoutGrid",
    blocks: [
      { type: "header" as const, label: "Header", icon: "PanelTop", description: "Site navigation bar" },
      { type: "footer" as const, label: "Footer", icon: "PanelBottom", description: "Site footer with links" },
      { type: "columns" as const, label: "Columns", icon: "Columns3", description: "Multi-column layout" },
      { type: "divider" as const, label: "Divider", icon: "Minus", description: "Decorative section divider" },
      { type: "spacer" as const, label: "Spacer", icon: "Space", description: "Vertical spacing" },
    ],
  },
  {
    name: "Content",
    icon: "Type",
    blocks: [
      { type: "hero" as const, label: "Hero", icon: "Star", description: "Large hero section with CTA" },
      { type: "text" as const, label: "Text", icon: "AlignLeft", description: "Rich text content" },
      { type: "features" as const, label: "Features", icon: "Grid3x3", description: "Feature grid with icons" },
      { type: "faq" as const, label: "FAQ", icon: "HelpCircle", description: "Frequently asked questions" },
      { type: "stats" as const, label: "Stats", icon: "BarChart3", description: "Number statistics" },
      { type: "cta" as const, label: "CTA", icon: "MousePointerClick", description: "Call-to-action banner" },
    ],
  },
  {
    name: "Media",
    icon: "Image",
    blocks: [
      { type: "image" as const, label: "Image", icon: "ImageIcon", description: "Single image with caption" },
      { type: "gallery" as const, label: "Gallery", icon: "Images", description: "Image/video gallery" },
      { type: "video" as const, label: "Video", icon: "Play", description: "Embedded video player" },
      { type: "logo-cloud" as const, label: "Logo Cloud", icon: "Building", description: "Partner/client logos" },
    ],
  },
  {
    name: "Social Proof",
    icon: "MessageSquare",
    blocks: [
      { type: "testimonials" as const, label: "Testimonials", icon: "Quote", description: "Customer reviews" },
      { type: "team" as const, label: "Team", icon: "Users", description: "Team member cards" },
    ],
  },
  {
    name: "Commerce",
    icon: "ShoppingCart",
    blocks: [
      { type: "pricing" as const, label: "Pricing", icon: "DollarSign", description: "Pricing table" },
      { type: "contact" as const, label: "Contact", icon: "Mail", description: "Contact form" },
    ],
  },
  {
    name: "Advanced",
    icon: "Code",
    blocks: [
      { type: "blog" as const, label: "Blog", icon: "FileText", description: "Blog post grid" },
      { type: "portfolio" as const, label: "Portfolio", icon: "Briefcase", description: "Project showcase" },
      { type: "custom-html" as const, label: "Custom HTML", icon: "Code", description: "Raw HTML/CSS/JS" },
    ],
  },
];
