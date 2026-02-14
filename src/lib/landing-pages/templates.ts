export interface TemplateVariant {
  id: string;
  name: string;
  /** Short layout description */
  style: string;
  /** Only used for preview card swatches — NOT applied to the AI output (brand colors are used instead) */
  colorScheme: { primary: string; secondary: string; bg: string };
  previewSections: string[];
  /** Layout type hint for the preview generator */
  layout: "standard" | "video" | "minimal" | "split" | "dark" | "interactive";
  detailedPrompt: string;
}

export interface PageTemplate {
  name: string;
  icon: string; // Lucide icon name
  description: string;
  sections: string[];
  promptEnhancement: string;
  variants: TemplateVariant[];
}

export const PAGE_TYPE_TEMPLATES: Record<string, PageTemplate> = {
  product: {
    name: "Product Launch",
    icon: "Rocket",
    description: "Showcase a new product with features and pricing",
    sections: ["hero", "features", "how-it-works", "testimonials", "pricing", "cta", "footer"],
    promptEnhancement: "Design a stunning product launch page. The hero should be bold and eye-catching with a large headline, subtitle, and prominent CTA button. Include a features grid with icons, a 'how it works' section with 3 steps, customer testimonials with avatars, a pricing section if relevant, and a final call-to-action. Use a modern, clean aesthetic with plenty of whitespace.",
    variants: [
      {
        id: "product-full",
        name: "Full Showcase",
        style: "Complete layout with features, pricing, and testimonials",
        colorScheme: { primary: "#6366f1", secondary: "#818cf8", bg: "#ffffff" },
        previewSections: ["Hero + CTA", "Logo bar", "Feature grid (6)", "How it works (3 steps)", "Pricing table (3 tiers)", "Testimonials", "Final CTA"],
        layout: "standard",
        detailedPrompt: "Design a comprehensive product launch landing page. Start with a hero section with a large headline, subtitle, two CTA buttons ('Get Started Free' and 'Watch Demo'), and a product screenshot/mockup placeholder on the right side. Below, add a 'Trusted by' logo bar with 5 grayscale company logos. Then a 6-card feature grid (3x2) with icons. Add a 'How It Works' section with 3 numbered steps connected by lines. Include a pricing section with 3 tiers (Free, Pro highlighted as popular, Enterprise) with feature checklists. Add 3 testimonial cards with star ratings. End with a gradient CTA banner and footer. This is a full, comprehensive layout with every section.",
      },
      {
        id: "product-video",
        name: "Video Showcase",
        style: "Large video hero with product description and CTA",
        colorScheme: { primary: "#6366f1", secondary: "#818cf8", bg: "#ffffff" },
        previewSections: ["Video hero (full-width)", "Product description", "CTA button"],
        layout: "video",
        detailedPrompt: "Design a clean, video-centric product landing page. The hero should be full-width with a large embedded video placeholder (16:9 aspect ratio with a play button overlay) taking up most of the viewport. Below the video, add a centered product description section with a large headline (the product name), a 2-3 sentence description, and a single prominent CTA button. Keep it extremely minimal — the video is the star. No features grid, no pricing, no testimonials. Just: video → description → CTA → small footer. If a video URL is provided, embed it. If not, show a styled placeholder with a play icon.",
      },
      {
        id: "product-minimal",
        name: "Minimal Landing",
        style: "Hero + 3 key features + CTA — clean and focused",
        colorScheme: { primary: "#6366f1", secondary: "#818cf8", bg: "#ffffff" },
        previewSections: ["Centered hero", "3 feature highlights", "Single CTA banner"],
        layout: "minimal",
        detailedPrompt: "Design a minimal product landing page with maximum whitespace. The hero should be vertically centered with a large bold headline (max 6 words), a one-line subtitle, and a single CTA button. Below, show exactly 3 feature highlights in a row — each is just an icon, a bold title, and one line of text. End with a simple CTA banner with the headline 'Ready to get started?' and a button. No pricing, no testimonials, no how-it-works — just the essentials. The page should feel premium and uncluttered.",
      },
      {
        id: "product-interactive",
        name: "Interactive Showcase",
        style: "Animated particle canvas, 3D product tilt on mouse, scroll reveals",
        colorScheme: { primary: "#6366f1", secondary: "#a78bfa", bg: "#0f0f23" },
        previewSections: ["Particle canvas hero", "3D mouse-tilt product", "Scroll-reveal features", "Animated stats counter", "Gradient CTA"],
        layout: "interactive",
        detailedPrompt: `Design an ultra-modern interactive product landing page with advanced coded effects. This page must showcase cutting-edge web development:

HERO SECTION:
- Full-viewport dark hero with an animated particle/constellation canvas background (use <canvas> with JavaScript — floating dots connected by lines, gently drifting)
- Large bold headline with a gradient text effect (CSS background-clip: text)
- Subtitle with a typing/typewriter CSS animation
- CTA button with a glowing pulse animation on hover

3D PRODUCT SHOWCASE:
- A product card/image that follows the mouse cursor with a subtle 3D perspective tilt effect (CSS perspective + transform: rotateX/rotateY driven by mousemove JS)
- The card should have a glossy reflection effect and box-shadow that shifts with the tilt
- Wrap this in a section with a radial gradient spotlight that follows the mouse

FEATURES SECTION:
- Feature cards that animate in from the sides as the user scrolls (use IntersectionObserver + CSS transforms)
- Each card has an animated SVG icon (use CSS animation on SVG paths — stroke-dasharray/stroke-dashoffset for a drawing effect)
- Cards should have a subtle floating animation (CSS keyframes translateY)

STATS SECTION:
- Animated number counters that count up when scrolled into view (IntersectionObserver + JS counter)
- Large numbers with a gradient color

CTA SECTION:
- Animated gradient background (CSS background-size animation)
- Button with a ripple click effect

TECHNICAL REQUIREMENTS:
- All CSS in a single <style> tag
- All JavaScript in a single <script> tag at the end of body
- Use requestAnimationFrame for canvas animation
- Use IntersectionObserver for scroll-triggered animations
- Must be fully responsive
- Keep the code clean and performant`,
      },
    ],
  },
  "lead-capture": {
    name: "Lead Capture",
    icon: "UserPlus",
    description: "Collect emails and generate leads",
    sections: ["hero", "benefits", "social-proof", "form", "faq", "footer"],
    promptEnhancement: "Design a high-converting lead capture page. The hero should focus on the main value proposition with a prominent email signup form (input + button, styled beautifully). Include a benefits section with 3-4 bullet points with checkmark icons, social proof (numbers or logos), a larger form section with name and email fields, and a brief FAQ section. Keep the design focused and distraction-free to maximize conversions.",
    variants: [
      {
        id: "lead-split",
        name: "Split Form",
        style: "Hero split 50/50 — benefits left, form right",
        colorScheme: { primary: "#2563eb", secondary: "#3b82f6", bg: "#ffffff" },
        previewSections: ["Split hero (text + form)", "Benefit checkmarks", "Trust logos", "FAQ section"],
        layout: "split",
        detailedPrompt: "Design a high-converting lead capture page with a split hero. The hero should be 50/50 — left side has a large value proposition headline, 4 bullet benefit points with checkmark icons, and trust text ('Join 5,000+ subscribers'). Right side has a prominent form card with shadow containing the lead form fields and a large CTA button. Below the hero, add a social proof bar with company logo placeholders. Include a benefits section with 4 icon cards in a 2x2 grid. Add a short FAQ section with 4 expandable questions. Keep it focused on conversion — no distracting navigation links.",
      },
      {
        id: "lead-video",
        name: "Video + Form",
        style: "Explainer video above, signup form below",
        colorScheme: { primary: "#2563eb", secondary: "#3b82f6", bg: "#ffffff" },
        previewSections: ["Video embed (full-width)", "Form below video", "Social proof"],
        layout: "video",
        detailedPrompt: "Design a video-driven lead capture page. The top section should be a full-width video embed placeholder (16:9) with a play button overlay and a short headline above it like 'See How It Works'. Directly below the video, place the lead capture form in a centered card with fields and a CTA button. Under the form, add a single line of social proof ('Trusted by 10,000+ businesses'). That's it — video, form, social proof. No features grid, no FAQ. The video does the selling, the form captures the lead. Ultra-focused layout.",
      },
      {
        id: "lead-squeeze",
        name: "Squeeze Page",
        style: "Ultra-minimal — headline, email input, done",
        colorScheme: { primary: "#2563eb", secondary: "#3b82f6", bg: "#ffffff" },
        previewSections: ["Centered headline", "Email input + CTA", "Social proof line"],
        layout: "minimal",
        detailedPrompt: "Design an ultra-minimal squeeze page. Center everything vertically on the page. Show only: a large bold headline (the value proposition), a one-line subtitle, a single email input field with a submit button inline (horizontal layout), and a small social proof line below ('Join 5,000+ others'). Nothing else. No navigation, no images, no features, no FAQ. The entire page is just the headline and the form, centered on screen. This is a pure conversion-focused squeeze page. Add a tiny 'Built with FlowSmartly' footer.",
      },
    ],
  },
  event: {
    name: "Event",
    icon: "Calendar",
    description: "Promote an event with details and registration",
    sections: ["hero", "details", "speakers", "schedule", "registration", "venue", "footer"],
    promptEnhancement: "Design an exciting event landing page. The hero should feature the event name, date, and location prominently with a countdown-style display. Include an event details section, a speakers/presenters grid with photos and bios, a schedule/agenda timeline, a registration form or CTA button, and venue information with a map placeholder. Use dynamic, energetic design elements.",
    variants: [
      {
        id: "event-full",
        name: "Conference",
        style: "Full event page with speakers, schedule, and registration",
        colorScheme: { primary: "#7c3aed", secondary: "#a78bfa", bg: "#ffffff" },
        previewSections: ["Hero + countdown", "Speaker grid", "Schedule timeline", "Registration form", "Venue info"],
        layout: "standard",
        detailedPrompt: "Design a complete conference landing page. The hero should have a gradient background with the event name in large bold text, date, location, and a visual countdown display (Days:Hours:Min:Sec as styled boxes). Include a 'Register Now' button. Below, show event highlights in 3 icon cards. Add a speakers section as a 2x3 grid with circular photo placeholders, names, titles. Create a schedule section as a vertical timeline with time slots. Include a registration form section with fields. Add a venue section with a map placeholder. End with a CTA banner. This is a comprehensive event page with all sections.",
      },
      {
        id: "event-video",
        name: "Video Promo",
        style: "Event promo video with date and register button",
        colorScheme: { primary: "#7c3aed", secondary: "#a78bfa", bg: "#ffffff" },
        previewSections: ["Video hero", "Event date + location", "Register CTA"],
        layout: "video",
        detailedPrompt: "Design a video-focused event promo page. The hero is a full-width video placeholder (the event promo video) with the event name overlaid as a semi-transparent text on top. Below the video, show a centered section with the event date in large text, location, and a brief 2-sentence description. Add a single large 'Register Now' CTA button. Optionally include a countdown timer below the button. No speakers grid, no schedule, no venue info — just the video promo and the essential details. The video sells the event.",
      },
      {
        id: "event-simple",
        name: "Simple RSVP",
        style: "Clean date/time display with registration form",
        colorScheme: { primary: "#7c3aed", secondary: "#a78bfa", bg: "#ffffff" },
        previewSections: ["Event name + date hero", "3 key details", "RSVP form"],
        layout: "minimal",
        detailedPrompt: "Design a simple, clean event RSVP page. The hero should be centered with the event name as a large headline, the date and time in a styled badge/card, and the location below. Include a 3-column section with key details (What to Expect, Who Should Attend, What to Bring). Then a centered registration/RSVP form with name, email, and a submit button. No speakers, no schedule timeline, no venue map — just the essentials for a small event or meetup. Keep it clean and focused on getting RSVPs.",
      },
    ],
  },
  "coming-soon": {
    name: "Coming Soon",
    icon: "Clock",
    description: "Build anticipation with a teaser page",
    sections: ["hero", "teaser", "countdown", "email-signup", "footer"],
    promptEnhancement: "Design a sleek coming soon page. Center the content vertically with a large, impactful headline and a brief teaser description. Include a visual countdown timer display (use static styled numbers, no JS needed), an email signup form to join the waitlist, and subtle background animation using CSS. Keep it minimal and mysterious to build anticipation. Use dark mode or a bold color scheme.",
    variants: [
      {
        id: "coming-soon-countdown",
        name: "Countdown Focus",
        style: "Large countdown timer, email signup, minimal",
        colorScheme: { primary: "#8b5cf6", secondary: "#c084fc", bg: "#0a0a0a" },
        previewSections: ["Centered headline", "Large countdown boxes", "Email signup", "Social links"],
        layout: "dark",
        detailedPrompt: "Design a dark, mysterious coming soon page. Use a near-black background with centered layout. The headline should be large white text. Show a teaser line in muted gray. Display a countdown with 4 large number boxes (Days, Hours, Min, Sec) with a subtle glow border. Include an email signup form (single input + button). Add social media icon links in the footer. The overall feel should be mysterious and premium. Center everything vertically.",
      },
      {
        id: "coming-soon-video",
        name: "Video Teaser",
        style: "Teaser video background with waitlist signup",
        colorScheme: { primary: "#ec4899", secondary: "#8b5cf6", bg: "#0a0a0a" },
        previewSections: ["Video background hero", "Coming soon text", "Email waitlist"],
        layout: "video",
        detailedPrompt: "Design a coming soon page with a video teaser. The hero should have a full-width video placeholder (showing a teaser/preview of what's coming) with a dark overlay. Over the video, show the product/brand name in large white text, 'Coming Soon' as a subtitle, and an email waitlist signup form (input + button). Below the video, optionally add 3 small teaser feature icons with labels. Keep it dramatic — the video is the hook. No countdown timer needed.",
      },
    ],
  },
  portfolio: {
    name: "Portfolio",
    icon: "Briefcase",
    description: "Showcase work and projects",
    sections: ["hero", "about", "projects", "skills", "testimonials", "contact", "footer"],
    promptEnhancement: "Design a professional portfolio page. The hero should introduce the person/brand with a photo placeholder and tagline. Include an about section with a brief bio, a projects grid showing 4-6 work samples with image placeholders and descriptions, a skills/expertise section, client testimonials, and a contact form. Use an elegant, creative design that showcases quality.",
    variants: [
      {
        id: "portfolio-grid",
        name: "Project Grid",
        style: "Photo hero, 6-project grid, about section, contact",
        colorScheme: { primary: "#f97316", secondary: "#fb923c", bg: "#ffffff" },
        previewSections: ["Name + photo hero", "6-project image grid", "Skills tags", "Testimonials", "Contact form"],
        layout: "standard",
        detailedPrompt: "Design a complete portfolio page. The hero should feature the person's name in large bold text with a tagline and a circular photo placeholder. Include an about section with a brief bio. The main showcase is a 3x2 project grid with large image placeholders, project titles, and category tags. Add a skills section with visual tags or pills. Include 2-3 client testimonial quotes. End with a contact form (name, email, message). This is a comprehensive portfolio with all sections.",
      },
      {
        id: "portfolio-video",
        name: "Video Reel",
        style: "Showreel video hero with project list below",
        colorScheme: { primary: "#f97316", secondary: "#fb923c", bg: "#ffffff" },
        previewSections: ["Video reel hero", "Brief intro", "Project list"],
        layout: "video",
        detailedPrompt: "Design a video-first portfolio page. The hero should be a full-width video embed placeholder (the showreel/demo reel) taking up most of the viewport with a play button overlay. Below the video, show the person's name, title, and a 2-sentence bio. Then list 4-6 projects as simple text entries with project name, client, and a one-line description — no images, keeping focus on the video. End with contact info (email, social links). The video reel is the entire portfolio showcase.",
      },
      {
        id: "portfolio-case",
        name: "Case Studies",
        style: "Detailed project showcases with results and metrics",
        colorScheme: { primary: "#f97316", secondary: "#fb923c", bg: "#ffffff" },
        previewSections: ["Minimal name hero", "3 case study cards with results", "Client logos", "Contact CTA"],
        layout: "split",
        detailedPrompt: "Design a results-focused portfolio page. The hero should be minimal — just a name, title, and one-sentence tagline. Below, show 3 detailed case study cards. Each card takes full width and has a split layout: left side has the project image placeholder, right side has the project name, client, brief description, and 2-3 result metrics (e.g., '+200% traffic', '3x ROI', '$500K revenue'). Below the case studies, add a logo bar of past clients. End with a 'Let's Work Together' CTA section with a contact form. Focus on results and outcomes, not just pretty images.",
      },
      {
        id: "portfolio-interactive",
        name: "Creative Portfolio",
        style: "Cursor-reactive gallery, smooth scroll animations, 3D card tilts",
        colorScheme: { primary: "#f97316", secondary: "#ec4899", bg: "#0c0a09" },
        previewSections: ["Animated name reveal hero", "3D tilt project cards", "Skill bars with scroll fill", "Mouse-reactive contact section"],
        layout: "interactive",
        detailedPrompt: `Design a visually stunning interactive portfolio page that demonstrates creative web development skills:

HERO:
- Dark background with a subtle animated noise/grain texture (CSS background with small repeating SVG pattern + animation)
- Name appears with a staggered reveal animation — each letter slides up from below with a slight delay
- Title/tagline fades in after the name animation completes
- A custom animated cursor trail effect (small fading dots that follow the mouse)

PROJECT GALLERY:
- 2x2 or 3-column grid of project cards
- Each card has a 3D tilt effect on hover (CSS perspective + transform: rotateX/rotateY driven by mousemove)
- Cards have a holographic/iridescent border effect on hover (animated gradient border using background: conic-gradient)
- On hover, the card image zooms slightly and a frosted glass overlay slides up with project details
- Staggered scroll-in animation for the grid items

SKILLS SECTION:
- Horizontal skill bars that fill from 0% to their target width when scrolled into view
- Each bar uses an animated gradient fill
- Skills: HTML/CSS (95%), JavaScript (90%), React (88%), Design (85%), Animation (92%)

CONTACT SECTION:
- A section with a mouse-reactive gradient background (radial gradient center follows cursor)
- "Let's Work Together" headline with animated text gradient
- Email link and social icons with hover scale + rotate animation

All inline. requestAnimationFrame for cursor trail, IntersectionObserver for scroll triggers, mousemove for 3D tilt + gradient follow. Responsive.`,
      },
    ],
  },
  restaurant: {
    name: "Restaurant",
    icon: "UtensilsCrossed",
    description: "Restaurant with menu and reservations",
    sections: ["hero", "about", "menu", "gallery", "hours", "reservation", "footer"],
    promptEnhancement: "Design a warm, inviting restaurant landing page. The hero should feature a full-width food image placeholder with the restaurant name overlaid. Include an about/story section, a menu section organized by category (appetizers, mains, desserts) with prices, a photo gallery grid, hours of operation, and a reservation CTA. Use warm colors, elegant typography, and food-inspired design elements.",
    variants: [
      {
        id: "restaurant-full",
        name: "Full Restaurant",
        style: "Complete with menu, gallery, hours, and reservation",
        colorScheme: { primary: "#b45309", secondary: "#d97706", bg: "#1c1917" },
        previewSections: ["Hero with restaurant name", "Our Story", "Full menu by category", "Photo gallery", "Hours + Reservation"],
        layout: "dark",
        detailedPrompt: "Design a complete restaurant landing page. The hero should be full-width with a food image placeholder, dark overlay, and the restaurant name in elegant serif typography. Include an 'Our Story' section with a photo and text. The menu should be organized by course (Appetizers, Main Course, Desserts) with item names, descriptions, and prices. Add a photo gallery in a 2x3 grid. Show hours of operation in a decorative card. End with a 'Reserve a Table' section with a form. Use serif typography for headings, dark backgrounds, and warm accent colors. This is a full restaurant page.",
      },
      {
        id: "restaurant-video",
        name: "Video Ambiance",
        style: "Ambiance video hero with menu link and reservation",
        colorScheme: { primary: "#b45309", secondary: "#d97706", bg: "#1c1917" },
        previewSections: ["Video hero (restaurant ambiance)", "Brief description", "Reserve button", "Hours"],
        layout: "video",
        detailedPrompt: "Design a video-focused restaurant page. The hero is a full-width video placeholder showing the restaurant ambiance (cooking, dining room, plating). Over the video with a dark overlay, show the restaurant name in elegant text and a tagline. Below, add a brief description (2-3 sentences about the dining experience), opening hours, and two buttons: 'Reserve a Table' and 'View Menu'. That's it. No full menu on the page, no gallery grid. The video conveys the ambiance and the page drives reservations. Elegant and minimal.",
      },
    ],
  },
  saas: {
    name: "SaaS Product",
    icon: "Layers",
    description: "Software product with features and pricing",
    sections: ["hero", "logos", "features", "demo", "pricing", "testimonials", "faq", "cta", "footer"],
    promptEnhancement: "Design a modern SaaS landing page. The hero should have a compelling headline, subtitle, CTA button, and a product screenshot/mockup placeholder. Include a trusted-by logos bar, a features section with icons and descriptions in a grid, a demo/screenshot section, a 3-tier pricing table (Free, Pro, Enterprise), customer testimonials, an FAQ accordion-style section, and a final CTA. Use a tech-forward design with gradients and clean lines.",
    variants: [
      {
        id: "saas-full",
        name: "Complete SaaS",
        style: "Full page with features, pricing, FAQ, and testimonials",
        colorScheme: { primary: "#6366f1", secondary: "#818cf8", bg: "#ffffff" },
        previewSections: ["Hero + product mockup", "Logo bar", "Feature grid", "Product demo screenshot", "3-tier pricing", "Testimonials", "FAQ", "CTA banner"],
        layout: "standard",
        detailedPrompt: "Design a comprehensive SaaS landing page. The hero has a headline and subtitle with 'Start Free Trial' and 'Watch Demo' buttons, and a product screenshot mockup on the right. Include a 'Trusted by' logo bar. Features section as a 3x2 grid of cards with icons. Add a large product screenshot in a browser mockup frame. Show a 3-tier pricing table (Free, Pro highlighted, Enterprise) with feature checklists. Include testimonial cards with photos. Add an FAQ section. End with a gradient CTA banner. This covers every section a SaaS page needs.",
      },
      {
        id: "saas-video",
        name: "Demo Video",
        style: "Product demo video hero with features and CTA",
        colorScheme: { primary: "#6366f1", secondary: "#818cf8", bg: "#ffffff" },
        previewSections: ["Demo video hero", "3 key features", "CTA + free trial"],
        layout: "video",
        detailedPrompt: "Design a video-driven SaaS landing page. The hero should feature a large product demo video embed placeholder (16:9) with a 'See It In Action' headline above it. Below the video, show 3 key feature highlights in a row (icon + title + one line). End with a CTA section: 'Start Your Free Trial' button with a note 'No credit card required'. No pricing table, no FAQ, no testimonials — the demo video does the selling. Keep it focused: video → key features → CTA. Perfect for products where seeing is believing.",
      },
      {
        id: "saas-comparison",
        name: "Feature Comparison",
        style: "Detailed features with comparison table and social proof",
        colorScheme: { primary: "#6366f1", secondary: "#818cf8", bg: "#ffffff" },
        previewSections: ["Split hero", "Stats bar", "Detailed feature sections", "Comparison table", "Testimonials", "CTA"],
        layout: "split",
        detailedPrompt: "Design a feature-focused SaaS landing page for buyers who need details. The hero should be split — headline and description on the left, product screenshot on the right, with 'Book a Demo' and 'Contact Sales' buttons. Include a stats bar (users, uptime, rating). Instead of a feature grid, show 3-4 detailed feature sections — each takes full width with an image on one side and detailed description on the other, alternating left/right. Add a feature comparison table (your product vs competitors) with checkmarks and X marks. Include enterprise testimonials with company logos. End with a 'Talk to Sales' CTA. This is for B2B / enterprise buyers who need convincing details.",
      },
      {
        id: "saas-interactive",
        name: "Interactive Demo",
        style: "Animated mesh gradient, parallax scrolling, live dashboard mockup",
        colorScheme: { primary: "#8b5cf6", secondary: "#06b6d4", bg: "#020617" },
        previewSections: ["Mesh gradient hero", "Parallax feature sections", "Live dashboard mockup", "Scroll counter stats", "Animated CTA"],
        layout: "interactive",
        detailedPrompt: `Design an interactive SaaS landing page that showcases the product with impressive coded effects:

HERO:
- Dark background with an animated mesh/blob gradient (use CSS @keyframes to animate background-position of a large multi-color radial gradient, or use an animated SVG blob with morphing paths using <animate> tags)
- Headline with gradient text (CSS background-clip: text) and a subtle glow
- Two CTA buttons with hover glow effects

PARALLAX FEATURE SECTIONS:
- 3 alternating feature sections where the image and text parallax at different scroll speeds (use CSS transform: translateY driven by scroll position via JS)
- Each section has a product screenshot/mockup that slides in from the side when scrolled into view

LIVE DASHBOARD MOCKUP:
- A section showing a "live" dashboard preview — an animated SVG chart where bars or line segments animate upward using CSS transitions triggered by IntersectionObserver
- Animated data numbers that count up
- Subtle pulse dots on the chart to simulate live data

STATS:
- Counter numbers that animate from 0 to target when in viewport
- Animated progress bars that fill on scroll

CTA:
- Background with slowly moving gradient
- Button with magnetic hover effect (button subtly moves toward cursor using mousemove JS)

All CSS in <style>, all JS in a single <script> at end of body. Use IntersectionObserver, requestAnimationFrame. Fully responsive.`,
      },
    ],
  },
  agency: {
    name: "Agency",
    icon: "Building2",
    description: "Creative or digital agency showcase",
    sections: ["hero", "services", "work", "process", "team", "testimonials", "contact", "footer"],
    promptEnhancement: "Design a bold, creative agency landing page. The hero should be impactful with a large headline about delivering results. Include a services section with 4-6 service cards, a portfolio/work showcase grid, a process section showing how the agency works (4 steps), a team grid with photo placeholders, client testimonials, and a contact section. Use bold typography, creative layouts, and a professional color scheme.",
    variants: [
      {
        id: "agency-full",
        name: "Full Agency",
        style: "Services, portfolio, team, process, testimonials, contact",
        colorScheme: { primary: "#e11d48", secondary: "#fb7185", bg: "#ffffff" },
        previewSections: ["Bold text hero", "Service cards", "Portfolio grid", "4-step process", "Team photos", "Testimonials", "Contact form"],
        layout: "standard",
        detailedPrompt: "Design a complete creative agency page. The hero should have an oversized headline ('We Create Digital Experiences') with a subtitle and 'Start a Project' button. The services section shows 4-6 service cards with icons. Include a portfolio section with a 3-column image grid. Add a 4-step process section (Discovery, Strategy, Design, Launch) with numbered circles and connecting lines. Show the team as circular photos with names and roles. Include testimonials with client quotes. End with a contact form. This is a comprehensive agency page with every section.",
      },
      {
        id: "agency-video",
        name: "Video Showreel",
        style: "Agency showreel video with services list and contact",
        colorScheme: { primary: "#e11d48", secondary: "#fb7185", bg: "#ffffff" },
        previewSections: ["Video showreel hero", "Brief about", "Service list", "Contact CTA"],
        layout: "video",
        detailedPrompt: "Design a video-first agency page. The hero is a full-width video showreel placeholder showing the agency's best work, with the agency name overlaid in bold white text and a tagline. Below, add a brief 2-sentence about paragraph. Then list services as a simple vertical list with service names and one-line descriptions (no cards, no icons — just clean text). End with a large 'Let's Talk' CTA section with email/phone and a contact form. No portfolio grid, no team photos, no process steps — the showreel video is the portfolio. Clean and confident.",
      },
      {
        id: "agency-results",
        name: "Results-Driven",
        style: "Stats, case studies with metrics, client logos",
        colorScheme: { primary: "#e11d48", secondary: "#fb7185", bg: "#ffffff" },
        previewSections: ["Hero with stats", "3 case studies with metrics", "Client logos", "Contact form"],
        layout: "split",
        detailedPrompt: "Design a results-focused agency page for data-driven clients. The hero should have a headline about driving measurable results, a subtitle with a key stat ('We've driven $50M+ in revenue for our clients'), and a 'Get a Quote' button. Below, show a stats bar with 4 large numbers (Projects Completed, Revenue Generated, Client Retention, Years Experience). The main section shows 3 case study cards — each with a project image, client name, service provided, and 2-3 result metrics ('+340% organic traffic', '5x ROAS', '$2M revenue increase'). Add a client logo bar. End with a contact form. No generic service cards — everything is backed by numbers.",
      },
      {
        id: "agency-interactive",
        name: "Creative Showcase",
        style: "Mouse-follow spotlight, animated SVG work grid, scroll morphing",
        colorScheme: { primary: "#f43f5e", secondary: "#8b5cf6", bg: "#09090b" },
        previewSections: ["Spotlight hero with mouse follow", "Animated work grid with hover reveals", "SVG morphing section dividers", "Animated counter stats", "Magnetic contact CTA"],
        layout: "interactive",
        detailedPrompt: `Design an award-winning interactive agency page that demonstrates creative coding expertise:

HERO:
- Dark background with a mouse-following spotlight effect (a radial gradient that follows the cursor, implemented via mousemove + CSS custom properties/variables)
- Large headline with staggered letter-by-letter fade-in animation on page load
- Subtitle fades in after headline completes
- CTA button with magnetic hover effect (moves toward cursor)

WORK/PORTFOLIO GRID:
- 2x3 project grid where each cell has a hover-reveal effect: the project image starts grayscale and transitions to full color with a sliding overlay revealing the project name and category
- Cards have subtle float animation at different speeds (CSS keyframes with animation-delay)
- The entire grid uses staggered scroll-in animation (IntersectionObserver + transition-delay on each child)

SVG SECTION DIVIDERS:
- Between sections, use animated SVG wave or morphing blob dividers (SVG <path> with CSS animation or SMIL <animate> to smoothly morph between two path shapes)

STATS SECTION:
- Counter numbers that animate from 0 to final value when scrolled into view
- Circular SVG progress rings that fill up with stroke-dashoffset animation
- Stats: "150+ Projects", "98% Client Retention", "$50M+ Revenue Generated", "12 Years"

CONTACT CTA:
- Full-width section with animated gradient background (CSS background-size: 200% + animation)
- The CTA button has a glowing border animation (CSS box-shadow + keyframes)
- Form fields have animated underline focus effects

All inline CSS and JS only. Use IntersectionObserver for scroll triggers, requestAnimationFrame for mouse-follow. Fully responsive.`,
      },
    ],
  },
};

/**
 * Find a template variant by its ID across all page types
 */
export function findTemplateVariant(templateId: string): { pageType: string; variant: TemplateVariant } | null {
  for (const [pageType, template] of Object.entries(PAGE_TYPE_TEMPLATES)) {
    const variant = template.variants.find((v) => v.id === templateId);
    if (variant) return { pageType, variant };
  }
  return null;
}
