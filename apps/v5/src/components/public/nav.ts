/**
 * The site's information architecture, in one place.
 *
 * The header, the mobile menu and the footer all read from here, so a route
 * only ever has to be added once. Hrefs are plain strings rather than
 * expo-router's typed `Href` so this file does not have to be edited in
 * lockstep with the route files as pages land.
 */

export type NavLink = {
  label: string;
  href: string;
  /** shown under the label in the header dropdown */
  description?: string;
  /** FontAwesome6 name, used by the dropdown and the mobile menu */
  icon?: string;
};

export type NavGroup = {
  title: string;
  links: NavLink[];
};

export const ROUTES = {
  home: '/',
  product: '/product',
  pricing: '/pricing',
  flowAgent: '/flowagent',

  /**
   * The two access routes. Neither is authentication: V5 auth does not exist
   * yet, so `login` is a branded transition page that hands existing customers
   * to the legacy host, and `earlyAccess` is the lead funnel that replaces
   * registration until V5 accounts open.
   */
  login: '/login',
  earlyAccess: '/early-access',

  solutions: '/solutions',
  flowshop: '/solutions/flowshop',
  listsmartly: '/solutions/listsmartly',
  agentMarketplace: '/solutions/agent-marketplace',
  callAgent: '/solutions/call-agent',
  websiteBuilder: '/solutions/website-builder',
  domains: '/solutions/domains',
  videoStudio: '/solutions/video-studio',
  customAutomation: '/solutions/custom-automation',

  aiStudio: '/platform/ai-studio',
  social: '/platform/social',
  emailSms: '/platform/email-sms',
  ads: '/platform/ads',
  analytics: '/platform/analytics',

  aiFluency: '/education/ai-fluency',

  flowLearner: '/solutions/flowlearner',
  trainingStudio: '/solutions/flowlearner/training-studio',
  liveRoom: '/solutions/flowlearner/live-room',
  learningCenter: '/solutions/flowlearner/learning-center',
  trainingAnalytics: '/solutions/flowlearner/training-analytics',

  resources: '/resources',
  helpCenter: '/resources/help-center',
  blog: '/resources/blog',
  guides: '/resources/guides',
  apiDocs: '/resources/api-docs',

  about: '/company/about',
  customers: '/company/customers',
  careers: '/company/careers',
  press: '/company/press',
  security: '/company/security',
  status: '/company/status',
  integrations: '/platform/integrations',
  templates: '/resources/templates',
  changelog: '/resources/changelog',
  cookies: '/legal/cookies',
  contact: '/company/contact',
  partners: '/company/partners',

  privacy: '/legal/privacy',
  terms: '/legal/terms',
  gdpr: '/legal/gdpr',
  smsTerms: '/legal/sms-terms',
} as const;

/* ------------------------------------------------------------------ */
/* groups                                                              */
/* ------------------------------------------------------------------ */

export const PLATFORM_GROUP: NavGroup = {
  title: 'Platform',
  links: [
    { label: 'AI Studio', href: ROUTES.aiStudio, icon: 'wand-magic-sparkles', description: 'Create on-brand content in seconds' },
    { label: 'Social', href: ROUTES.social, icon: 'hashtag', description: 'Plan, publish and engage everywhere' },
    { label: 'Email + SMS', href: ROUTES.emailSms, icon: 'envelope', description: 'Campaigns and journeys that convert' },
    { label: 'Ads', href: ROUTES.ads, icon: 'bullhorn', description: 'Run cross-channel ads in one place' },
    { label: 'Analytics', href: ROUTES.analytics, icon: 'chart-column', description: 'See what worked and what to do next' },
    { label: 'Integrations', href: ROUTES.integrations, icon: 'plug', description: 'Connect the tools you already use' },
    { label: 'Security', href: ROUTES.security, icon: 'lock', description: 'How we protect your data' },
    { label: 'Status', href: ROUTES.status, icon: 'signal', description: 'Live platform status' },
  ],
};

export const SOLUTIONS_GROUP: NavGroup = {
  title: 'Solutions',
  links: [
    { label: 'FlowShop', href: ROUTES.flowshop, icon: 'bag-shopping', description: 'Sell wherever customers discover you' },
    { label: 'ListSmartly', href: ROUTES.listsmartly, icon: 'magnifying-glass', description: 'Local listings, reviews and AI visibility' },
    { label: 'FlowAgent', href: ROUTES.flowAgent, icon: 'wand-magic-sparkles', description: 'Your AI operating partner' },
    { label: 'Agent Marketplace', href: ROUTES.agentMarketplace, icon: 'store', description: 'Hire vetted experts inside your workspace' },
    { label: 'Call Agent', href: ROUTES.callAgent, icon: 'comment-dots', description: 'An AI voice agent that answers 24/7' },
    { label: 'Website Builder', href: ROUTES.websiteBuilder, icon: 'window-maximize', description: 'Describe your business, get the site' },
    { label: 'Domains', href: ROUTES.domains, icon: 'globe', description: 'Search, register and connect a name' },
    { label: 'Video & Voice Studio', href: ROUTES.videoStudio, icon: 'clapperboard', description: 'Films, UGC, product ads and voiceover' },
    { label: 'Custom AI Automation', href: ROUTES.customAutomation, icon: 'screwdriver-wrench', description: 'Built one-to-one around how you operate' },
  ],
};

export const RESOURCES_GROUP: NavGroup = {
  title: 'Resources',
  links: [
    { label: 'Help Center', href: ROUTES.helpCenter, icon: 'circle-question', description: 'Guides, tutorials and answers' },
    { label: 'Blog', href: ROUTES.blog, icon: 'newspaper', description: 'Ideas and insights for smarter growth' },
    { label: 'Guides', href: ROUTES.guides, icon: 'book-open', description: 'Playbooks for every growth stage' },
    { label: 'Templates', href: ROUTES.templates, icon: 'file-lines', description: 'Ready-made campaigns and lessons' },
    { label: 'API Docs', href: ROUTES.apiDocs, icon: 'code', description: 'Build on the FlowSmartly platform' },
    { label: 'Changelog', href: ROUTES.changelog, icon: 'code-branch', description: "What's new in FlowSmartly" },
  ],
};

/**
 * FlowLearner is the learning product: train your team, sell courses, engage
 * students — four connected areas inside FlowSmartly.
 */
export const FLOWLEARNER_GROUP: NavGroup = {
  title: 'FlowLearner',
  links: [
    { label: 'FlowLearner', href: ROUTES.flowLearner, icon: 'graduation-cap', description: 'Train your team, sell courses, engage students' },
    { label: 'Training Studio', href: ROUTES.trainingStudio, icon: 'pen-ruler', description: 'Build presentations, lessons, activities and quizzes' },
    { label: 'Live Room', href: ROUTES.liveRoom, icon: 'tower-broadcast', description: 'Teach live with video, whiteboard and Q&A' },
    { label: 'Learning Center', href: ROUTES.learningCenter, icon: 'book-open', description: 'Courses, progress, quizzes and certificates' },
    { label: 'Training Analytics', href: ROUTES.trainingAnalytics, icon: 'chart-column', description: 'Attendance, completion, engagement and revenue' },
  ],
};

/**
 * Education is a pillar of the product story, not a resources sub-item — so it
 * gets its own nav group and footer column.
 *
 * NOTE: only AI Fluency exists as a page today. The other labels are sections
 * of it and point there until they earn their own routes.
 */
export const EDUCATION_GROUP: NavGroup = {
  title: 'Education',
  links: [
    { label: 'AI Fluency', href: ROUTES.aiFluency, icon: 'graduation-cap', description: 'Build the judgment to use AI confidently' },
    { label: 'Learning paths', href: ROUTES.aiFluency, icon: 'route' },
    { label: 'AI readiness', href: ROUTES.aiFluency, icon: 'gauge-high' },
    { label: 'Workshops', href: ROUTES.aiFluency, icon: 'chalkboard-user' },
    { label: 'Certifications', href: ROUTES.aiFluency, icon: 'certificate' },
  ],
};

export const COMPANY_GROUP: NavGroup = {
  title: 'Company',
  links: [
    { label: 'About', href: ROUTES.about, icon: 'building' },
    { label: 'Customers', href: ROUTES.customers, icon: 'star' },
    { label: 'Careers', href: ROUTES.careers, icon: 'briefcase' },
    { label: 'Press', href: ROUTES.press, icon: 'newspaper' },
    { label: 'Partners', href: ROUTES.partners, icon: 'handshake' },
    { label: 'Contact', href: ROUTES.contact, icon: 'envelope' },
  ],
};

export const LEGAL_LINKS: NavLink[] = [
  { label: 'Privacy', href: ROUTES.privacy },
  { label: 'Terms', href: ROUTES.terms },
  { label: 'Cookies', href: ROUTES.cookies },
  { label: 'GDPR', href: ROUTES.gdpr },
  { label: 'SMS Terms', href: ROUTES.smsTerms },
];

/* ------------------------------------------------------------------ */
/* header                                                              */
/* ------------------------------------------------------------------ */

export type MainNavItem = {
  label: string;
  href: string;
  /**
   * Present → the item opens a mega menu: a floating card under the nav, split
   * into labelled columns, rather than a band across the whole page.
   *
   * Keep it to **three columns of roughly equal length**. Five columns pushed
   * the Solutions card to 973px — three quarters of a 1280 viewport — and a
   * one-link column left a 100px hole under a full-height divider.
   */
  columns?: NavGroup[];
  /**
   * The row that closes the card: the section landing page and any utility
   * links that do not belong in a column. Without it a short column ends in
   * dead space; with it the card has a bottom edge that looks deliberate.
   */
  overview?: NavLink[];
};

export const MAIN_NAV: MainNavItem[] = [
  {
    label: 'Product',
    href: ROUTES.product,
    columns: [
      { title: 'Create', links: [PLATFORM_GROUP.links[0], PLATFORM_GROUP.links[1]] },
      { title: 'Engage', links: [PLATFORM_GROUP.links[2], PLATFORM_GROUP.links[3]] },
      { title: 'Operate', links: [PLATFORM_GROUP.links[4], PLATFORM_GROUP.links[5]] },
    ],
    overview: [
      { label: 'The platform', href: ROUTES.product, icon: 'table-cells-large' },
      { label: 'Pricing', href: ROUTES.pricing, icon: 'tag' },
      { label: 'Security', href: ROUTES.security, icon: 'lock' },
    ],
  },
  {
    label: 'Solutions',
    href: ROUTES.solutions,
    columns: [
      { title: 'Build & sell', links: [SOLUTIONS_GROUP.links[5], SOLUTIONS_GROUP.links[6], SOLUTIONS_GROUP.links[0]] },
      { title: 'Create & reach', links: [SOLUTIONS_GROUP.links[7], SOLUTIONS_GROUP.links[1], SOLUTIONS_GROUP.links[4]] },
      { title: 'Learn & teach', links: [FLOWLEARNER_GROUP.links[0], FLOWLEARNER_GROUP.links[1], FLOWLEARNER_GROUP.links[2]] },
    ],
    overview: [
      { label: 'All solutions', href: ROUTES.solutions, icon: 'table-cells-large' },
      { label: 'FlowAgent', href: ROUTES.flowAgent, icon: 'wand-magic-sparkles' },
      { label: 'Agent Marketplace', href: ROUTES.agentMarketplace, icon: 'store' },
    ],
  },
  { label: 'FlowAgent', href: ROUTES.flowAgent },
  {
    label: 'Resources',
    href: ROUTES.resources,
    columns: [
      { title: 'Learn', links: [RESOURCES_GROUP.links[0], RESOURCES_GROUP.links[2], RESOURCES_GROUP.links[1]] },
      { title: 'Education', links: [EDUCATION_GROUP.links[0], EDUCATION_GROUP.links[1], EDUCATION_GROUP.links[3]] },
      { title: 'Company', links: [COMPANY_GROUP.links[0], COMPANY_GROUP.links[1], COMPANY_GROUP.links[2]] },
    ],
    overview: [
      { label: 'All resources', href: ROUTES.resources, icon: 'table-cells-large' },
      { label: 'API docs', href: ROUTES.apiDocs, icon: 'code' },
      { label: 'Templates', href: ROUTES.templates, icon: 'file-lines' },
      { label: 'Changelog', href: ROUTES.changelog, icon: 'code-branch' },
    ],
  },
  { label: 'Pricing', href: ROUTES.pricing },
];

/* ------------------------------------------------------------------ */
/* footer                                                              */
/* ------------------------------------------------------------------ */

/**
 * Six columns, which divide evenly 6 / 3 / 2 at every breakpoint — so no row
 * ever strands a single cell. (Five was the count that always orphaned one.)
 */
export const FOOTER_GROUPS: NavGroup[] = [
  PLATFORM_GROUP,
  SOLUTIONS_GROUP,
  FLOWLEARNER_GROUP,
  { title: 'Learn', links: [...RESOURCES_GROUP.links, EDUCATION_GROUP.links[0]] },
  COMPANY_GROUP,
  { title: 'Legal', links: LEGAL_LINKS },
];
