# FLOWSMARTLY V2 - COMPLETE PROJECT PLAN

## Enterprise-Grade Social Media Content Platform
### Advanced UI | Modular Architecture | AI-Powered | Performance Optimized

---

# PART 1: EXECUTIVE SUMMARY & VISION

## 1.1 Project Overview

**FlowSmartly V2** is a next-generation social media content platform that combines AI-powered content creation, native social networking, and innovative monetization through a View-to-Earn model.

### The Problem

| Challenge | Traditional Approach | FlowSmartly Solution |
|-----------|---------------------|----------------------|
| API Permissions | Complex business verification for Meta, TikTok | Native FlowSocial + Share Hub |
| Token Management | OAuth refresh, expiration handling | Browser session persistence |
| Rate Limits | Platform restrictions block growth | Unlimited native posting |
| Content Creation | Multiple tools, fragmented workflow | Unified AI-powered studio |
| Monetization | Complex ad platform integration | Built-in View-to-Earn system |

### Core Value Proposition

```
CREATE (AI Studio) → POST (FlowSocial) → SHARE (Native Dialogs) → EARN (View-to-Earn)
```

## 1.2 Vision Statement

> Build the most intuitive, beautiful, and powerful content creation platform that democratizes professional marketing tools for creators, small businesses, and enterprises alike.

## 1.3 Key Differentiators

### 1. Zero API Dependency
- No Meta Business verification required
- No TikTok developer access needed
- No OAuth token management
- Works immediately after signup

### 2. AI-First Architecture
- Claude API powers ALL content generation
- Intelligent content optimization
- Predictive analytics
- Smart scheduling recommendations

### 3. Native Monetization
- Built-in ad marketplace
- View-to-Earn for users
- Transparent revenue sharing
- Instant payout system

### 4. Enterprise-Grade UI/UX
- Design system based on atomic design principles
- Micro-interactions and animations
- Dark/Light theme with custom theming
- Fully responsive with mobile-first approach
- Accessibility (WCAG 2.1 AA compliant)

## 1.4 Target Users

| Segment | Needs | FlowSmartly Features |
|---------|-------|---------------------|
| **Content Creators** | Easy content creation, monetization | AI Studio, View-to-Earn |
| **Small Businesses** | Marketing without complexity | Email/SMS campaigns, AI ads |
| **Marketing Agencies** | White-label, team collaboration | Multi-tenant, role-based access |
| **E-commerce** | Product promotion, conversions | Shoppable posts, analytics |
| **Enterprises** | Brand consistency, compliance | Brand kits, approval workflows |

## 1.5 Success Metrics

### Year 1 Goals
- **Users**: 50,000 registered users
- **MAU**: 15,000 monthly active users
- **Revenue**: $500K ARR
- **Ad Spend**: $1M processed through platform
- **Payouts**: $500K distributed to earners

### Platform KPIs
- **Performance**: < 100ms API response time
- **Uptime**: 99.9% availability
- **User Satisfaction**: > 4.5 app store rating
- **Engagement**: > 30% DAU/MAU ratio

## 1.6 Technology Philosophy

### Principles

1. **Modular by Design**
   - Feature-based architecture
   - Independent deployable modules
   - Plugin system for extensibility

2. **Performance Obsessed**
   - Edge-first deployment
   - Aggressive caching strategies
   - Optimistic UI updates
   - Code splitting & lazy loading

3. **Beautiful by Default**
   - Consistent design language
   - Smooth 60fps animations
   - Thoughtful micro-interactions
   - Delightful user experience

4. **Smart & Adaptive**
   - AI-powered suggestions everywhere
   - Learning from user behavior
   - Predictive UI elements
   - Context-aware interfaces

## 1.7 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FLOWSMARTLY V2                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Web App   │  │ Mobile PWA  │  │  Admin      │  │  API        │        │
│  │  (Next.js)  │  │  (React)    │  │  Dashboard  │  │  Consumers  │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                │                │
│         └────────────────┴────────────────┴────────────────┘                │
│                                   │                                          │
│                    ┌──────────────┴──────────────┐                          │
│                    │      API Gateway (Edge)      │                          │
│                    │   Rate Limiting | Auth | CDN │                          │
│                    └──────────────┬──────────────┘                          │
│                                   │                                          │
│  ┌────────────────────────────────┴────────────────────────────────┐        │
│  │                     MICROSERVICES LAYER                          │        │
│  ├──────────┬──────────┬──────────┬──────────┬──────────┬─────────┤        │
│  │   Auth   │  Content │  Social  │   Ads    │ Campaign │  Payout │        │
│  │ Service  │  Studio  │  Engine  │  Engine  │  Manager │ Service │        │
│  └──────────┴──────────┴──────────┴──────────┴──────────┴─────────┘        │
│                                   │                                          │
│  ┌────────────────────────────────┴────────────────────────────────┐        │
│  │                        DATA LAYER                                │        │
│  ├──────────────┬──────────────┬──────────────┬───────────────────┤        │
│  │  PostgreSQL  │    Redis     │  Cloudflare  │    ClickHouse     │        │
│  │   (Primary)  │   (Cache)    │   R2 (CDN)   │   (Analytics)     │        │
│  └──────────────┴──────────────┴──────────────┴───────────────────┘        │
│                                   │                                          │
│  ┌────────────────────────────────┴────────────────────────────────┐        │
│  │                     EXTERNAL SERVICES                            │        │
│  ├──────────┬──────────┬──────────┬──────────┬────────────────────┤        │
│  │  Claude  │  Stripe  │  Twilio  │ SendGrid │    Cloudflare      │        │
│  │   API    │ Payments │   SMS    │  Email   │    Workers         │        │
│  └──────────┴──────────┴──────────┴──────────┴────────────────────┘        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 1.8 Feature Matrix

| Feature | Starter | Pro | Business | Enterprise |
|---------|---------|-----|----------|------------|
| **AI Credits/mo** | 500 | 2,000 | 5,000 | Unlimited |
| **FlowSocial Posts** | 50/mo | Unlimited | Unlimited | Unlimited |
| **Email Sends/mo** | 5,000 | 25,000 | 100,000 | 500,000 |
| **SMS Credits** | 100 | 500 | 2,000 | 10,000 |
| **Team Members** | 1 | 3 | 10 | Unlimited |
| **Brand Kits** | 1 | 3 | 10 | Unlimited |
| **Custom Domain** | - | - | Yes | Yes |
| **White Label** | - | - | - | Yes |
| **API Access** | - | - | Yes | Yes |
| **Priority Support** | - | - | Yes | Yes |
| **SLA** | - | - | - | 99.9% |
| **Price** | $29/mo | $59/mo | $99/mo | Custom |

---

# PART 2: ADVANCED UI/UX DESIGN SYSTEM

## 2.1 Design Philosophy

### Core Principles

| Principle | Description | Implementation |
|-----------|-------------|----------------|
| **Clarity** | Every element has purpose | Remove visual noise, clear hierarchy |
| **Efficiency** | Minimize user effort | Smart defaults, keyboard shortcuts |
| **Delight** | Surprise and satisfy | Micro-animations, easter eggs |
| **Consistency** | Predictable patterns | Design tokens, component library |
| **Accessibility** | Inclusive by design | WCAG 2.1 AA, screen reader support |

### Design Influences
- **Vercel** - Clean, minimal, developer-friendly
- **Linear** - Smooth animations, keyboard-first
- **Stripe** - Professional, trustworthy, clear
- **Notion** - Flexible, content-focused
- **Figma** - Collaborative, real-time feedback

## 2.2 Design Token System

### Color Palette

```typescript
// Design Tokens - colors.ts
export const colors = {
  // Brand Colors
  brand: {
    50:  '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9',  // Primary
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
    950: '#082f49',
  },

  // Semantic Colors
  semantic: {
    success: {
      light: '#10b981',
      DEFAULT: '#059669',
      dark: '#047857',
    },
    warning: {
      light: '#f59e0b',
      DEFAULT: '#d97706',
      dark: '#b45309',
    },
    error: {
      light: '#ef4444',
      DEFAULT: '#dc2626',
      dark: '#b91c1c',
    },
    info: {
      light: '#3b82f6',
      DEFAULT: '#2563eb',
      dark: '#1d4ed8',
    },
  },

  // Neutral (Light Mode)
  neutral: {
    0:   '#ffffff',
    50:  '#fafafa',
    100: '#f4f4f5',
    200: '#e4e4e7',
    300: '#d4d4d8',
    400: '#a1a1aa',
    500: '#71717a',
    600: '#52525b',
    700: '#3f3f46',
    800: '#27272a',
    900: '#18181b',
    950: '#09090b',
  },

  // Accent Colors (for graphs, tags, avatars)
  accent: {
    purple: '#8b5cf6',
    pink:   '#ec4899',
    orange: '#f97316',
    teal:   '#14b8a6',
    indigo: '#6366f1',
    rose:   '#f43f5e',
  },
}
```

### Typography Scale

```typescript
// Design Tokens - typography.ts
export const typography = {
  fontFamily: {
    sans: ['Inter', 'system-ui', 'sans-serif'],
    mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
    display: ['Cal Sans', 'Inter', 'sans-serif'],
  },

  fontSize: {
    'xs':   ['0.75rem', { lineHeight: '1rem' }],      // 12px
    'sm':   ['0.875rem', { lineHeight: '1.25rem' }],  // 14px
    'base': ['1rem', { lineHeight: '1.5rem' }],       // 16px
    'lg':   ['1.125rem', { lineHeight: '1.75rem' }],  // 18px
    'xl':   ['1.25rem', { lineHeight: '1.75rem' }],   // 20px
    '2xl':  ['1.5rem', { lineHeight: '2rem' }],       // 24px
    '3xl':  ['1.875rem', { lineHeight: '2.25rem' }],  // 30px
    '4xl':  ['2.25rem', { lineHeight: '2.5rem' }],    // 36px
    '5xl':  ['3rem', { lineHeight: '1' }],            // 48px
    '6xl':  ['3.75rem', { lineHeight: '1' }],         // 60px
  },

  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
}
```

### Spacing & Layout

```typescript
// Design Tokens - spacing.ts
export const spacing = {
  px: '1px',
  0: '0',
  0.5: '0.125rem',  // 2px
  1: '0.25rem',     // 4px
  1.5: '0.375rem',  // 6px
  2: '0.5rem',      // 8px
  2.5: '0.625rem',  // 10px
  3: '0.75rem',     // 12px
  4: '1rem',        // 16px
  5: '1.25rem',     // 20px
  6: '1.5rem',      // 24px
  8: '2rem',        // 32px
  10: '2.5rem',     // 40px
  12: '3rem',       // 48px
  16: '4rem',       // 64px
  20: '5rem',       // 80px
  24: '6rem',       // 96px
}

export const borderRadius = {
  none: '0',
  sm: '0.25rem',    // 4px
  DEFAULT: '0.5rem', // 8px
  md: '0.625rem',   // 10px
  lg: '0.75rem',    // 12px
  xl: '1rem',       // 16px
  '2xl': '1.5rem',  // 24px
  full: '9999px',
}
```

### Shadows & Effects

```typescript
// Design Tokens - effects.ts
export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',

  // Colored shadows for cards/buttons
  glow: {
    brand: '0 0 20px -5px rgb(14 165 233 / 0.4)',
    success: '0 0 20px -5px rgb(5 150 105 / 0.4)',
    error: '0 0 20px -5px rgb(220 38 38 / 0.4)',
  },
}

export const blur = {
  none: '0',
  sm: '4px',
  DEFAULT: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  '2xl': '40px',
  '3xl': '64px',
}
```

## 2.3 Animation System

### Motion Principles

1. **Purposeful** - Animations guide attention and provide feedback
2. **Fast** - Never make users wait (max 300ms for UI, 500ms for page transitions)
3. **Natural** - Use spring physics for organic feel
4. **Consistent** - Same actions = same animations across the app

### Animation Tokens

```typescript
// Design Tokens - motion.ts
export const motion = {
  // Durations
  duration: {
    instant: '50ms',
    fast: '100ms',
    normal: '200ms',
    slow: '300ms',
    slower: '500ms',
  },

  // Easings
  easing: {
    linear: 'linear',
    easeIn: 'cubic-bezier(0.4, 0, 1, 0.2)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },

  // Framer Motion Presets
  springPresets: {
    gentle: { type: 'spring', stiffness: 120, damping: 14 },
    snappy: { type: 'spring', stiffness: 400, damping: 30 },
    bouncy: { type: 'spring', stiffness: 300, damping: 10 },
  },
}
```

### Micro-Interactions Library

```typescript
// animations/micro-interactions.ts
export const microInteractions = {
  // Button Press
  buttonPress: {
    whileTap: { scale: 0.98 },
    transition: { duration: 0.1 },
  },

  // Hover Lift
  hoverLift: {
    whileHover: { y: -2, boxShadow: shadows.lg },
    transition: { duration: 0.2 },
  },

  // Card Hover
  cardHover: {
    whileHover: {
      y: -4,
      boxShadow: shadows.xl,
      borderColor: colors.brand[500],
    },
    transition: { duration: 0.2 },
  },

  // Icon Spin (for loading)
  iconSpin: {
    animate: { rotate: 360 },
    transition: { duration: 1, repeat: Infinity, ease: 'linear' },
  },

  // Pulse (for notifications)
  pulse: {
    animate: { scale: [1, 1.05, 1] },
    transition: { duration: 2, repeat: Infinity },
  },

  // Shake (for errors)
  shake: {
    animate: { x: [0, -10, 10, -10, 10, 0] },
    transition: { duration: 0.5 },
  },

  // Success Check
  successCheck: {
    initial: { pathLength: 0 },
    animate: { pathLength: 1 },
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}
```

## 2.4 Dark Mode Implementation

### Theme Structure

```typescript
// themes/theme-tokens.ts
export const themes = {
  light: {
    // Backgrounds
    bg: {
      primary: colors.neutral[0],      // #ffffff
      secondary: colors.neutral[50],   // #fafafa
      tertiary: colors.neutral[100],   // #f4f4f5
      elevated: colors.neutral[0],     // Cards, modals
      inverse: colors.neutral[900],    // Tooltips
    },

    // Text
    text: {
      primary: colors.neutral[900],    // Main text
      secondary: colors.neutral[600],  // Muted text
      tertiary: colors.neutral[400],   // Placeholder
      inverse: colors.neutral[0],      // On dark bg
      brand: colors.brand[600],        // Links
    },

    // Borders
    border: {
      primary: colors.neutral[200],
      secondary: colors.neutral[100],
      focus: colors.brand[500],
    },
  },

  dark: {
    // Backgrounds
    bg: {
      primary: colors.neutral[950],    // #09090b
      secondary: colors.neutral[900],  // #18181b
      tertiary: colors.neutral[800],   // #27272a
      elevated: colors.neutral[800],   // Cards, modals
      inverse: colors.neutral[100],    // Tooltips
    },

    // Text
    text: {
      primary: colors.neutral[50],     // Main text
      secondary: colors.neutral[400],  // Muted text
      tertiary: colors.neutral[500],   // Placeholder
      inverse: colors.neutral[900],    // On light bg
      brand: colors.brand[400],        // Links
    },

    // Borders
    border: {
      primary: colors.neutral[700],
      secondary: colors.neutral[800],
      focus: colors.brand[500],
    },
  },
}
```

### CSS Variables Implementation

```css
/* globals.css */
:root {
  /* Light Mode (default) */
  --bg-primary: 255 255 255;
  --bg-secondary: 250 250 250;
  --bg-tertiary: 244 244 245;
  --bg-elevated: 255 255 255;

  --text-primary: 24 24 27;
  --text-secondary: 82 82 91;
  --text-tertiary: 161 161 170;

  --border-primary: 228 228 231;
  --border-focus: 14 165 233;

  --brand-500: 14 165 233;
}

.dark {
  --bg-primary: 9 9 11;
  --bg-secondary: 24 24 27;
  --bg-tertiary: 39 39 42;
  --bg-elevated: 39 39 42;

  --text-primary: 250 250 250;
  --text-secondary: 161 161 170;
  --text-tertiary: 113 113 122;

  --border-primary: 63 63 70;
  --border-focus: 14 165 233;
}
```

## 2.5 Responsive Design System

### Breakpoints

```typescript
// Design Tokens - breakpoints.ts
export const breakpoints = {
  xs: '375px',   // Small phones
  sm: '640px',   // Large phones
  md: '768px',   // Tablets
  lg: '1024px',  // Small laptops
  xl: '1280px',  // Desktops
  '2xl': '1536px', // Large desktops
}
```

### Container System

```typescript
// Layout containers
export const containers = {
  xs: '20rem',     // 320px - Mobile content
  sm: '24rem',     // 384px - Narrow content
  md: '28rem',     // 448px - Forms, modals
  lg: '32rem',     // 512px - Content cards
  xl: '36rem',     // 576px - Wide cards
  '2xl': '42rem',  // 672px - Articles
  '3xl': '48rem',  // 768px - Wide content
  '4xl': '56rem',  // 896px - Extra wide
  '5xl': '64rem',  // 1024px - Full content
  '6xl': '72rem',  // 1152px - Dashboards
  '7xl': '80rem',  // 1280px - Max width
  full: '100%',
}
```

### Grid System

```typescript
// 12-column grid with responsive gaps
export const grid = {
  columns: 12,
  gap: {
    mobile: spacing[4],   // 16px
    tablet: spacing[6],   // 24px
    desktop: spacing[8],  // 32px
  },
  margin: {
    mobile: spacing[4],   // 16px
    tablet: spacing[8],   // 32px
    desktop: spacing[16], // 64px
  },
}
```

## 2.6 Iconography

### Icon System

- **Library**: Lucide Icons (consistent, MIT licensed)
- **Size Scale**: 16px, 20px, 24px, 32px, 48px
- **Stroke Width**: 1.5px (default), 2px (bold)

```typescript
// Icon size tokens
export const iconSizes = {
  xs: 16,
  sm: 20,
  md: 24,  // Default
  lg: 32,
  xl: 48,
}
```

### Custom Icon Guidelines

1. Design on 24x24 grid
2. 2px padding from edges
3. 1.5px stroke width
4. Round line caps and joins
5. Consistent corner radius (2px)

## 2.7 Component Patterns

### Button Variants

| Variant | Use Case | Style |
|---------|----------|-------|
| **Primary** | Main actions | Solid brand color |
| **Secondary** | Alternative actions | Outlined, subtle fill |
| **Ghost** | Tertiary actions | No background |
| **Destructive** | Delete, cancel | Red color scheme |
| **Link** | Navigation | Text only, underline |

### Input States

| State | Visual Indicator |
|-------|-----------------|
| Default | Neutral border |
| Hover | Slightly darker border |
| Focus | Brand color ring + border |
| Disabled | Reduced opacity, no interaction |
| Error | Red border + error message |
| Success | Green checkmark |

### Card Elevation Levels

| Level | Shadow | Use Case |
|-------|--------|----------|
| 0 | None | Inline content |
| 1 | sm | Subtle cards |
| 2 | DEFAULT | Standard cards |
| 3 | md | Elevated cards |
| 4 | lg | Modals, popovers |
| 5 | xl | Dropdowns, tooltips |

## 2.8 Accessibility Guidelines

### Color Contrast

- **Large Text** (18px+): Minimum 3:1 ratio
- **Normal Text**: Minimum 4.5:1 ratio
- **UI Components**: Minimum 3:1 ratio

### Focus Management

```typescript
// Focus ring styles
export const focusRing = {
  outline: 'none',
  boxShadow: `0 0 0 2px var(--bg-primary), 0 0 0 4px var(--brand-500)`,
}
```

### Keyboard Navigation

| Key | Action |
|-----|--------|
| Tab | Move to next focusable element |
| Shift+Tab | Move to previous element |
| Enter/Space | Activate buttons/links |
| Escape | Close modals/dropdowns |
| Arrow keys | Navigate within components |

### Screen Reader Support

- All images have alt text
- Form inputs have labels
- Buttons have accessible names
- Live regions for dynamic content
- Proper heading hierarchy (h1 → h6)

---

# PART 3: MODULAR COMPONENT ARCHITECTURE

## 3.1 Project Structure

### Feature-Based Architecture

```
flowsmartly/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (auth)/                   # Auth group routes
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   └── forgot-password/
│   │   ├── (dashboard)/              # Protected dashboard routes
│   │   │   ├── layout.tsx            # Dashboard layout with sidebar
│   │   │   ├── page.tsx              # Dashboard home
│   │   │   ├── studio/               # AI Content Studio
│   │   │   ├── feed/                 # FlowSocial Feed
│   │   │   ├── campaigns/            # Email/SMS Campaigns
│   │   │   ├── ads/                  # Paid Ads Management
│   │   │   ├── analytics/            # Analytics Dashboard
│   │   │   ├── earnings/             # View-to-Earn Earnings
│   │   │   └── settings/             # User Settings
│   │   ├── (marketing)/              # Public marketing pages
│   │   │   ├── page.tsx              # Landing page
│   │   │   ├── pricing/
│   │   │   └── features/
│   │   ├── api/                      # API Routes
│   │   │   ├── auth/
│   │   │   ├── ai/
│   │   │   ├── posts/
│   │   │   ├── campaigns/
│   │   │   ├── ads/
│   │   │   └── webhooks/
│   │   ├── layout.tsx                # Root layout
│   │   └── globals.css               # Global styles
│   │
│   ├── components/                   # Shared components
│   │   ├── ui/                       # Atomic UI components
│   │   │   ├── button/
│   │   │   ├── input/
│   │   │   ├── card/
│   │   │   ├── modal/
│   │   │   ├── dropdown/
│   │   │   ├── toast/
│   │   │   ├── avatar/
│   │   │   ├── badge/
│   │   │   ├── skeleton/
│   │   │   └── index.ts              # Barrel export
│   │   ├── layout/                   # Layout components
│   │   │   ├── sidebar/
│   │   │   ├── header/
│   │   │   ├── footer/
│   │   │   └── mobile-nav/
│   │   ├── forms/                    # Form components
│   │   │   ├── form-field/
│   │   │   ├── rich-text-editor/
│   │   │   ├── image-upload/
│   │   │   └── tag-input/
│   │   └── shared/                   # Shared complex components
│   │       ├── post-card/
│   │       ├── user-avatar/
│   │       ├── share-hub/
│   │       └── analytics-chart/
│   │
│   ├── features/                     # Feature modules
│   │   ├── auth/                     # Authentication feature
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   ├── store/
│   │   │   └── types.ts
│   │   ├── studio/                   # AI Studio feature
│   │   │   ├── components/
│   │   │   │   ├── content-generator/
│   │   │   │   ├── image-editor/
│   │   │   │   ├── video-composer/
│   │   │   │   └── template-gallery/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   └── types.ts
│   │   ├── social/                   # FlowSocial feature
│   │   │   ├── components/
│   │   │   │   ├── feed/
│   │   │   │   ├── post-composer/
│   │   │   │   ├── comments/
│   │   │   │   └── reactions/
│   │   │   ├── hooks/
│   │   │   └── services/
│   │   ├── campaigns/                # Email/SMS Campaigns
│   │   │   ├── components/
│   │   │   │   ├── email-builder/
│   │   │   │   ├── sms-composer/
│   │   │   │   ├── contact-list/
│   │   │   │   └── automation-flow/
│   │   │   ├── hooks/
│   │   │   └── services/
│   │   ├── ads/                      # Paid Ads feature
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── services/
│   │   └── earnings/                 # View-to-Earn feature
│   │       ├── components/
│   │       ├── hooks/
│   │       └── services/
│   │
│   ├── lib/                          # Core utilities
│   │   ├── api/                      # API client
│   │   │   ├── client.ts             # Fetch wrapper
│   │   │   ├── endpoints.ts          # API endpoints
│   │   │   └── types.ts              # API types
│   │   ├── ai/                       # Claude AI integration
│   │   │   ├── client.ts
│   │   │   ├── prompts/
│   │   │   └── types.ts
│   │   ├── db/                       # Database (Prisma)
│   │   │   ├── client.ts
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── auth/                     # Auth utilities
│   │   │   ├── session.ts
│   │   │   └── middleware.ts
│   │   └── utils/                    # General utilities
│   │       ├── cn.ts                 # Class name merge
│   │       ├── format.ts             # Formatters
│   │       ├── validation.ts         # Validators
│   │       └── constants.ts
│   │
│   ├── hooks/                        # Global hooks
│   │   ├── use-media-query.ts
│   │   ├── use-debounce.ts
│   │   ├── use-local-storage.ts
│   │   ├── use-intersection.ts
│   │   └── use-keyboard-shortcut.ts
│   │
│   ├── stores/                       # Global state (Zustand)
│   │   ├── auth-store.ts
│   │   ├── theme-store.ts
│   │   ├── notification-store.ts
│   │   └── index.ts
│   │
│   ├── types/                        # Global TypeScript types
│   │   ├── api.ts
│   │   ├── database.ts
│   │   └── global.d.ts
│   │
│   └── config/                       # Configuration
│       ├── site.ts                   # Site metadata
│       ├── navigation.ts             # Nav structure
│       └── features.ts               # Feature flags
│
├── public/                           # Static assets
│   ├── images/
│   ├── icons/
│   └── fonts/
│
├── prisma/                           # Database schema
│   └── schema.prisma
│
├── tests/                            # Test files
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
└── config files...
    ├── tailwind.config.ts
    ├── next.config.js
    ├── tsconfig.json
    └── package.json
```

## 3.2 Atomic Design Components

### Atoms (Base UI Components)

```typescript
// components/ui/button/button.tsx
import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils/cn'
import { Loader2 } from 'lucide-react'

const buttonVariants = cva(
  // Base styles
  `inline-flex items-center justify-center gap-2 rounded-lg font-medium
   transition-all duration-200 focus-visible:outline-none focus-visible:ring-2
   focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50
   active:scale-[0.98]`,
  {
    variants: {
      variant: {
        primary: `bg-brand-500 text-white hover:bg-brand-600
                  focus-visible:ring-brand-500 shadow-sm hover:shadow-md`,
        secondary: `bg-neutral-100 text-neutral-900 hover:bg-neutral-200
                    dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700`,
        outline: `border-2 border-neutral-200 bg-transparent hover:bg-neutral-50
                  dark:border-neutral-700 dark:hover:bg-neutral-800`,
        ghost: `bg-transparent hover:bg-neutral-100
                dark:hover:bg-neutral-800`,
        destructive: `bg-red-500 text-white hover:bg-red-600
                      focus-visible:ring-red-500`,
        link: `text-brand-500 underline-offset-4 hover:underline`,
      },
      size: {
        xs: 'h-7 px-2 text-xs',
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        xl: 'h-14 px-8 text-lg',
        icon: 'h-10 w-10',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    className,
    variant,
    size,
    fullWidth,
    isLoading,
    leftIcon,
    rightIcon,
    children,
    disabled,
    ...props
  }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, fullWidth, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : leftIcon}
        {children}
        {!isLoading && rightIcon}
      </button>
    )
  }
)

Button.displayName = 'Button'
```

### Molecules (Composite Components)

```typescript
// components/ui/input/input-field.tsx
import { forwardRef } from 'react'
import { cn } from '@/lib/utils/cn'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

export interface InputFieldProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  success?: string
  hint?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(
  ({
    className,
    label,
    error,
    success,
    hint,
    leftIcon,
    rightIcon,
    id,
    ...props
  }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s/g, '-')
    const hasError = !!error
    const hasSuccess = !!success && !hasError

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-neutral-700 dark:text-neutral-300"
          >
            {label}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
              {leftIcon}
            </div>
          )}

          <input
            id={inputId}
            ref={ref}
            className={cn(
              `w-full rounded-lg border bg-white px-4 py-2.5 text-sm
               transition-all duration-200
               placeholder:text-neutral-400
               focus:outline-none focus:ring-2 focus:ring-offset-0
               disabled:cursor-not-allowed disabled:opacity-50
               dark:bg-neutral-900`,
              leftIcon && 'pl-10',
              (rightIcon || hasError || hasSuccess) && 'pr-10',
              hasError
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                : hasSuccess
                ? 'border-green-500 focus:border-green-500 focus:ring-green-500/20'
                : `border-neutral-200 focus:border-brand-500 focus:ring-brand-500/20
                   dark:border-neutral-700`,
              className
            )}
            {...props}
          />

          {(rightIcon || hasError || hasSuccess) && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {hasError ? (
                <AlertCircle className="h-5 w-5 text-red-500" />
              ) : hasSuccess ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                rightIcon
              )}
            </div>
          )}
        </div>

        {(error || success || hint) && (
          <p className={cn(
            'text-xs',
            hasError ? 'text-red-500' : hasSuccess ? 'text-green-600' : 'text-neutral-500'
          )}>
            {error || success || hint}
          </p>
        )}
      </div>
    )
  }
)

InputField.displayName = 'InputField'
```

### Organisms (Complex Components)

```typescript
// features/social/components/post-card/post-card.tsx
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import {
  Heart, MessageCircle, Share2, MoreHorizontal,
  Bookmark, Flag
} from 'lucide-react'
import { Button, Avatar, Badge, Card, Dropdown } from '@/components/ui'
import { ShareHub } from '@/components/shared/share-hub'
import { cn } from '@/lib/utils/cn'
import type { Post } from '@/types'

interface PostCardProps {
  post: Post
  onLike?: (postId: string) => void
  onComment?: (postId: string) => void
  onShare?: (postId: string, platform: string) => void
  onBookmark?: (postId: string) => void
}

export function PostCard({
  post,
  onLike,
  onComment,
  onShare,
  onBookmark
}: PostCardProps) {
  const [isLiked, setIsLiked] = useState(post.isLiked)
  const [likeCount, setLikeCount] = useState(post.likeCount)
  const [showShareHub, setShowShareHub] = useState(false)
  const [isBookmarked, setIsBookmarked] = useState(post.isBookmarked)

  const handleLike = () => {
    setIsLiked(!isLiked)
    setLikeCount(prev => isLiked ? prev - 1 : prev + 1)
    onLike?.(post.id)
  }

  return (
    <Card className="overflow-hidden">
      {/* Sponsored Badge */}
      {post.isPromoted && (
        <div className="bg-amber-50 dark:bg-amber-900/20 px-4 py-1.5 border-b border-amber-200 dark:border-amber-800">
          <Badge variant="warning" size="sm">Sponsored</Badge>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <Avatar
            src={post.author.avatar}
            alt={post.author.name}
            size="md"
          />
          <div>
            <p className="font-semibold text-neutral-900 dark:text-neutral-100">
              {post.author.name}
            </p>
            <p className="text-xs text-neutral-500">
              {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
            </p>
          </div>
        </div>

        <Dropdown
          trigger={
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          }
          items={[
            { label: 'Save post', icon: Bookmark, onClick: () => onBookmark?.(post.id) },
            { label: 'Report', icon: Flag, onClick: () => {} },
          ]}
        />
      </div>

      {/* Content */}
      <div className="px-4 pb-3">
        <p className="text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap">
          {post.caption}
        </p>

        {post.hashtags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {post.hashtags.map(tag => (
              <span
                key={tag}
                className="text-brand-500 hover:underline cursor-pointer text-sm"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Media */}
      {post.mediaUrl && (
        <div className="relative aspect-video bg-neutral-100 dark:bg-neutral-800">
          {post.mediaType === 'video' ? (
            <video
              src={post.mediaUrl}
              controls
              className="w-full h-full object-cover"
            />
          ) : (
            <img
              src={post.mediaUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-1">
          {/* Like Button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleLike}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors',
              isLiked
                ? 'text-red-500'
                : 'text-neutral-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
            )}
          >
            <motion.div
              animate={isLiked ? { scale: [1, 1.3, 1] } : {}}
              transition={{ duration: 0.3 }}
            >
              <Heart
                className={cn('h-5 w-5', isLiked && 'fill-current')}
              />
            </motion.div>
            <span className="text-sm font-medium">{likeCount}</span>
          </motion.button>

          {/* Comment Button */}
          <button
            onClick={() => onComment?.(post.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full
                       text-neutral-500 hover:text-brand-500 hover:bg-brand-50
                       dark:hover:bg-brand-900/20 transition-colors"
          >
            <MessageCircle className="h-5 w-5" />
            <span className="text-sm font-medium">{post.commentCount}</span>
          </button>

          {/* Share Button */}
          <button
            onClick={() => setShowShareHub(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full
                       text-neutral-500 hover:text-green-500 hover:bg-green-50
                       dark:hover:bg-green-900/20 transition-colors"
          >
            <Share2 className="h-5 w-5" />
            <span className="text-sm font-medium">Share</span>
          </button>
        </div>

        {/* Bookmark */}
        <button
          onClick={() => {
            setIsBookmarked(!isBookmarked)
            onBookmark?.(post.id)
          }}
          className={cn(
            'p-2 rounded-full transition-colors',
            isBookmarked
              ? 'text-brand-500'
              : 'text-neutral-400 hover:text-brand-500 hover:bg-brand-50'
          )}
        >
          <Bookmark className={cn('h-5 w-5', isBookmarked && 'fill-current')} />
        </button>
      </div>

      {/* Share Hub Modal */}
      <AnimatePresence>
        {showShareHub && (
          <ShareHub
            post={post}
            onShare={(platform) => {
              onShare?.(post.id, platform)
              setShowShareHub(false)
            }}
            onClose={() => setShowShareHub(false)}
          />
        )}
      </AnimatePresence>
    </Card>
  )
}
```

## 3.3 Component Documentation

### Storybook Structure

```typescript
// components/ui/button/button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react'
import { Button } from './button'
import { Mail, ArrowRight, Download } from 'lucide-react'

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'outline', 'ghost', 'destructive', 'link'],
    },
    size: {
      control: 'select',
      options: ['xs', 'sm', 'md', 'lg', 'xl', 'icon'],
    },
    isLoading: { control: 'boolean' },
    disabled: { control: 'boolean' },
    fullWidth: { control: 'boolean' },
  },
}

export default meta
type Story = StoryObj<typeof Button>

export const Primary: Story = {
  args: {
    children: 'Primary Button',
    variant: 'primary',
  },
}

export const WithIcons: Story = {
  args: {
    children: 'Send Email',
    leftIcon: <Mail className="h-4 w-4" />,
    rightIcon: <ArrowRight className="h-4 w-4" />,
  },
}

export const Loading: Story = {
  args: {
    children: 'Downloading...',
    isLoading: true,
    leftIcon: <Download className="h-4 w-4" />,
  },
}

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
}

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Button size="xs">Extra Small</Button>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
      <Button size="xl">Extra Large</Button>
    </div>
  ),
}
```

## 3.4 Reusable Hooks

### Data Fetching Hook

```typescript
// hooks/use-query.ts
import { useState, useEffect, useCallback } from 'react'

interface UseQueryOptions<T> {
  initialData?: T
  enabled?: boolean
  refetchInterval?: number
  onSuccess?: (data: T) => void
  onError?: (error: Error) => void
}

interface UseQueryResult<T> {
  data: T | undefined
  error: Error | null
  isLoading: boolean
  isError: boolean
  isSuccess: boolean
  refetch: () => Promise<void>
}

export function useQuery<T>(
  queryFn: () => Promise<T>,
  options: UseQueryOptions<T> = {}
): UseQueryResult<T> {
  const {
    initialData,
    enabled = true,
    refetchInterval,
    onSuccess,
    onError
  } = options

  const [data, setData] = useState<T | undefined>(initialData)
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const fetchData = useCallback(async () => {
    if (!enabled) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await queryFn()
      setData(result)
      onSuccess?.(result)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      onError?.(error)
    } finally {
      setIsLoading(false)
    }
  }, [queryFn, enabled, onSuccess, onError])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!refetchInterval || !enabled) return

    const interval = setInterval(fetchData, refetchInterval)
    return () => clearInterval(interval)
  }, [refetchInterval, enabled, fetchData])

  return {
    data,
    error,
    isLoading,
    isError: !!error,
    isSuccess: !!data && !error,
    refetch: fetchData,
  }
}
```

### Infinite Scroll Hook

```typescript
// hooks/use-infinite-scroll.ts
import { useState, useEffect, useCallback, useRef } from 'react'

interface UseInfiniteScrollOptions<T> {
  fetchFn: (page: number) => Promise<{ data: T[]; hasMore: boolean }>
  initialData?: T[]
}

export function useInfiniteScroll<T>({
  fetchFn,
  initialData = []
}: UseInfiniteScrollOptions<T>) {
  const [items, setItems] = useState<T[]>(initialData)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return

    setIsLoading(true)
    try {
      const result = await fetchFn(page)
      setItems(prev => [...prev, ...result.data])
      setHasMore(result.hasMore)
      setPage(prev => prev + 1)
    } finally {
      setIsLoading(false)
    }
  }, [fetchFn, page, isLoading, hasMore])

  useEffect(() => {
    if (!loadMoreRef.current) return

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          loadMore()
        }
      },
      { threshold: 0.1 }
    )

    observerRef.current.observe(loadMoreRef.current)

    return () => observerRef.current?.disconnect()
  }, [loadMore])

  return {
    items,
    isLoading,
    hasMore,
    loadMoreRef,
    refresh: () => {
      setItems([])
      setPage(1)
      setHasMore(true)
    },
  }
}
```

### Keyboard Shortcut Hook

```typescript
// hooks/use-keyboard-shortcut.ts
import { useEffect, useCallback } from 'react'

type KeyCombo = string // e.g., 'ctrl+k', 'cmd+shift+p'

interface ShortcutConfig {
  key: KeyCombo
  callback: () => void
  preventDefault?: boolean
}

export function useKeyboardShortcut(shortcuts: ShortcutConfig[]) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    for (const shortcut of shortcuts) {
      const keys = shortcut.key.toLowerCase().split('+')
      const modifiers = {
        ctrl: keys.includes('ctrl'),
        cmd: keys.includes('cmd') || keys.includes('meta'),
        shift: keys.includes('shift'),
        alt: keys.includes('alt'),
      }

      const mainKey = keys.find(k =>
        !['ctrl', 'cmd', 'meta', 'shift', 'alt'].includes(k)
      )

      const modifiersMatch =
        modifiers.ctrl === (event.ctrlKey || event.metaKey) &&
        modifiers.shift === event.shiftKey &&
        modifiers.alt === event.altKey

      if (modifiersMatch && event.key.toLowerCase() === mainKey) {
        if (shortcut.preventDefault !== false) {
          event.preventDefault()
        }
        shortcut.callback()
        break
      }
    }
  }, [shortcuts])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

// Usage example:
// useKeyboardShortcut([
//   { key: 'ctrl+k', callback: () => openSearchModal() },
//   { key: 'ctrl+/', callback: () => toggleSidebar() },
//   { key: 'escape', callback: () => closeModal() },
// ])
```

## 3.5 State Management

### Global Store (Zustand)

```typescript
// stores/auth-store.ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface User {
  id: string
  email: string
  name: string
  avatar: string
  plan: 'starter' | 'pro' | 'business' | 'enterprise'
  balance: number
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean

  // Actions
  setUser: (user: User | null) => void
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  updateBalance: (amount: number) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      setUser: (user) => set({ user, isAuthenticated: !!user }),

      login: async (email, password) => {
        set({ isLoading: true })
        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          })

          if (!response.ok) throw new Error('Login failed')

          const { user } = await response.json()
          set({ user, isAuthenticated: true, isLoading: false })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      logout: () => {
        set({ user: null, isAuthenticated: false })
        // Clear session
        fetch('/api/auth/logout', { method: 'POST' })
      },

      updateBalance: (amount) => {
        const { user } = get()
        if (user) {
          set({ user: { ...user, balance: user.balance + amount } })
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user }),
    }
  )
)
```

### Feature Store Example

```typescript
// features/social/store/feed-store.ts
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

interface Post {
  id: string
  content: string
  likeCount: number
  isLiked: boolean
}

interface FeedState {
  posts: Post[]
  isLoading: boolean
  hasMore: boolean

  // Actions
  setPosts: (posts: Post[]) => void
  addPosts: (posts: Post[]) => void
  toggleLike: (postId: string) => void
  addComment: (postId: string, comment: string) => void
}

export const useFeedStore = create<FeedState>()(
  immer((set) => ({
    posts: [],
    isLoading: false,
    hasMore: true,

    setPosts: (posts) => set((state) => {
      state.posts = posts
    }),

    addPosts: (posts) => set((state) => {
      state.posts.push(...posts)
    }),

    toggleLike: (postId) => set((state) => {
      const post = state.posts.find(p => p.id === postId)
      if (post) {
        post.isLiked = !post.isLiked
        post.likeCount += post.isLiked ? 1 : -1
      }
    }),

    addComment: (postId, comment) => set((state) => {
      // Add comment logic
    }),
  }))
)
```

## 3.6 API Client Architecture

```typescript
// lib/api/client.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api'

interface RequestOptions extends RequestInit {
  params?: Record<string, string>
}

class APIClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const { params, ...init } = options

    let url = `${this.baseUrl}${endpoint}`
    if (params) {
      const searchParams = new URLSearchParams(params)
      url += `?${searchParams}`
    }

    const response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init.headers,
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new APIError(response.status, error.message || 'Request failed')
    }

    return response.json()
  }

  get<T>(endpoint: string, options?: RequestOptions) {
    return this.request<T>(endpoint, { ...options, method: 'GET' })
  }

  post<T>(endpoint: string, data?: unknown, options?: RequestOptions) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  put<T>(endpoint: string, data?: unknown, options?: RequestOptions) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  delete<T>(endpoint: string, options?: RequestOptions) {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' })
  }
}

class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'APIError'
  }
}

export const api = new APIClient(API_BASE)

// Usage:
// const posts = await api.get<Post[]>('/posts', { params: { page: '1' } })
// const newPost = await api.post<Post>('/posts', { content: 'Hello!' })
```

---

# PART 4: SMART FEATURES & AI INTEGRATION

## 4.1 Claude AI Integration Architecture

### AI Service Layer

```typescript
// lib/ai/claude-client.ts
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface AIGenerationOptions {
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
}

export class ClaudeAI {
  private static instance: ClaudeAI
  private client: Anthropic

  private constructor() {
    this.client = anthropic
  }

  static getInstance(): ClaudeAI {
    if (!ClaudeAI.instance) {
      ClaudeAI.instance = new ClaudeAI()
    }
    return ClaudeAI.instance
  }

  async generate(
    prompt: string,
    options: AIGenerationOptions = {}
  ): Promise<string> {
    const {
      maxTokens = 1024,
      temperature = 0.7,
      systemPrompt = 'You are a helpful marketing and content creation assistant.'
    } = options

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    })

    return response.content[0].type === 'text'
      ? response.content[0].text
      : ''
  }

  async stream(
    prompt: string,
    options: AIGenerationOptions = {}
  ): AsyncGenerator<string> {
    const {
      maxTokens = 1024,
      temperature = 0.7,
      systemPrompt = 'You are a helpful marketing and content creation assistant.'
    } = options

    const stream = await this.client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text
      }
    }
  }
}

export const ai = ClaudeAI.getInstance()
```

## 4.2 AI-Powered Content Studio

### Content Generation Prompts

```typescript
// lib/ai/prompts/content-prompts.ts

export const ContentPrompts = {
  // Social Media Post Generation
  socialPost: (params: {
    platform: 'instagram' | 'twitter' | 'linkedin' | 'facebook' | 'tiktok'
    topic: string
    tone: 'professional' | 'casual' | 'humorous' | 'inspirational'
    includeHashtags: boolean
    includeEmojis: boolean
    length: 'short' | 'medium' | 'long'
  }) => `
    Create a ${params.platform} post about: ${params.topic}

    Requirements:
    - Tone: ${params.tone}
    - Length: ${params.length} (${
      params.length === 'short' ? '50-100 chars' :
      params.length === 'medium' ? '150-250 chars' : '300-500 chars'
    })
    ${params.includeHashtags ? '- Include 3-5 relevant hashtags' : '- No hashtags'}
    ${params.includeEmojis ? '- Include appropriate emojis' : '- No emojis'}

    Platform-specific guidelines:
    ${params.platform === 'twitter' ? '- Max 280 characters, punchy and shareable' : ''}
    ${params.platform === 'instagram' ? '- Visual-focused, lifestyle oriented' : ''}
    ${params.platform === 'linkedin' ? '- Professional, thought leadership focused' : ''}
    ${params.platform === 'facebook' ? '- Conversational, community-focused' : ''}
    ${params.platform === 'tiktok' ? '- Trendy, hook in first line, casual language' : ''}

    Return ONLY the post content, no explanations.
  `,

  // Ad Copy Generation
  adCopy: (params: {
    product: string
    targetAudience: string
    objective: 'awareness' | 'consideration' | 'conversion'
    format: 'single_image' | 'carousel' | 'video' | 'story'
  }) => `
    Create compelling ad copy for: ${params.product}

    Target Audience: ${params.targetAudience}
    Campaign Objective: ${params.objective}
    Ad Format: ${params.format}

    Generate:
    1. Primary Text (2-3 engaging sentences)
    2. Headline (max 40 characters, attention-grabbing)
    3. Description (max 30 characters, CTA focused)
    4. 3 A/B test variations of the headline

    Format your response as JSON:
    {
      "primaryText": "",
      "headline": "",
      "description": "",
      "headlineVariations": ["", "", ""]
    }
  `,

  // Email Subject Lines
  emailSubject: (params: {
    emailType: 'newsletter' | 'promotional' | 'transactional' | 'welcome'
    topic: string
    brandVoice: string
  }) => `
    Generate 5 compelling email subject lines for a ${params.emailType} email.

    Topic: ${params.topic}
    Brand Voice: ${params.brandVoice}

    Requirements:
    - Max 50 characters each
    - Create curiosity or urgency
    - Avoid spam trigger words
    - One should include personalization placeholder [Name]
    - One should be question-based
    - One should include a number/statistic

    Return as JSON array: ["subject1", "subject2", "subject3", "subject4", "subject5"]
  `,

  // Email Body Content
  emailBody: (params: {
    subject: string
    purpose: string
    cta: string
    tone: string
    sections: string[]
  }) => `
    Write an email body for the following:

    Subject Line: ${params.subject}
    Purpose: ${params.purpose}
    Call-to-Action: ${params.cta}
    Tone: ${params.tone}

    Required Sections: ${params.sections.join(', ')}

    Guidelines:
    - Keep paragraphs short (2-3 sentences max)
    - Use scannable formatting
    - Include one clear CTA
    - Write for mobile reading

    Format as HTML with inline styles for email compatibility.
  `,

  // SMS Message
  smsMessage: (params: {
    purpose: 'promotion' | 'reminder' | 'alert' | 'confirmation'
    content: string
    includeLink: boolean
  }) => `
    Create an SMS message for: ${params.purpose}

    Content/Offer: ${params.content}
    ${params.includeLink ? 'Include a placeholder for shortened link: [LINK]' : 'No link needed'}

    Requirements:
    - Max 160 characters (single SMS)
    - Clear and actionable
    - Include business name placeholder [BUSINESS]
    - Comply with TCPA (include opt-out for marketing)

    Return ONLY the message text.
  `,

  // Hashtag Generation
  hashtags: (params: {
    content: string
    platform: string
    count: number
  }) => `
    Generate ${params.count} relevant hashtags for this ${params.platform} post:

    "${params.content}"

    Requirements:
    - Mix of popular and niche hashtags
    - No banned or spam hashtags
    - Relevant to the content
    - Include 1-2 branded hashtag suggestions

    Return as JSON: { "popular": [], "niche": [], "branded": [] }
  `,

  // Content Improvement
  improveContent: (params: {
    content: string
    goal: 'engagement' | 'clarity' | 'conversion' | 'seo'
  }) => `
    Improve this content for better ${params.goal}:

    "${params.content}"

    Provide:
    1. Improved version
    2. 3 specific changes made and why
    3. Score improvement estimate (before/after)

    Format as JSON:
    {
      "improved": "",
      "changes": [{"change": "", "reason": ""}],
      "scoreBefore": 0,
      "scoreAfter": 0
    }
  `,

  // Video Script Generation
  videoScript: (params: {
    topic: string
    duration: '15s' | '30s' | '60s' | '3min'
    platform: 'tiktok' | 'reels' | 'youtube_shorts' | 'youtube'
    style: 'educational' | 'entertaining' | 'promotional'
  }) => `
    Write a video script for ${params.platform} (${params.duration}):

    Topic: ${params.topic}
    Style: ${params.style}

    Include:
    - Hook (first 3 seconds)
    - Main content with timestamps
    - Call-to-action
    - On-screen text suggestions
    - B-roll/visual suggestions

    Format as JSON:
    {
      "hook": "",
      "sections": [{"timestamp": "", "script": "", "visuals": "", "onScreenText": ""}],
      "cta": "",
      "estimatedDuration": ""
    }
  `,
}
```

### AI Content Generation Service

```typescript
// features/studio/services/content-service.ts
import { ai } from '@/lib/ai/claude-client'
import { ContentPrompts } from '@/lib/ai/prompts/content-prompts'

export class ContentGenerationService {
  // Generate Social Media Post
  async generateSocialPost(params: {
    platform: 'instagram' | 'twitter' | 'linkedin' | 'facebook' | 'tiktok'
    topic: string
    tone: 'professional' | 'casual' | 'humorous' | 'inspirational'
    includeHashtags?: boolean
    includeEmojis?: boolean
    length?: 'short' | 'medium' | 'long'
  }) {
    const prompt = ContentPrompts.socialPost({
      ...params,
      includeHashtags: params.includeHashtags ?? true,
      includeEmojis: params.includeEmojis ?? true,
      length: params.length ?? 'medium',
    })

    const content = await ai.generate(prompt, {
      temperature: 0.8,
      maxTokens: 500,
    })

    return {
      content,
      platform: params.platform,
      characterCount: content.length,
    }
  }

  // Generate Ad Copy with Variations
  async generateAdCopy(params: {
    product: string
    targetAudience: string
    objective: 'awareness' | 'consideration' | 'conversion'
    format: 'single_image' | 'carousel' | 'video' | 'story'
  }) {
    const prompt = ContentPrompts.adCopy(params)

    const response = await ai.generate(prompt, {
      temperature: 0.7,
      maxTokens: 800,
    })

    try {
      return JSON.parse(response)
    } catch {
      return { raw: response }
    }
  }

  // Generate Multiple Content Variations
  async generateVariations(
    baseContent: string,
    count: number = 3
  ) {
    const prompt = `
      Create ${count} variations of this content, each with a different approach:

      Original: "${baseContent}"

      Provide variations that are:
      1. More casual/conversational
      2. More professional/formal
      3. More action-oriented/urgent

      Return as JSON array: [{ "variation": "", "style": "" }]
    `

    const response = await ai.generate(prompt, {
      temperature: 0.9,
      maxTokens: 1000,
    })

    try {
      return JSON.parse(response)
    } catch {
      return []
    }
  }

  // Analyze Content Performance Prediction
  async analyzeContent(content: string, platform: string) {
    const prompt = `
      Analyze this ${platform} post and predict its performance:

      "${content}"

      Evaluate:
      1. Engagement potential (1-10)
      2. Clarity score (1-10)
      3. Call-to-action strength (1-10)
      4. Platform optimization (1-10)
      5. Specific improvement suggestions

      Return as JSON:
      {
        "scores": {
          "engagement": 0,
          "clarity": 0,
          "cta": 0,
          "platformFit": 0,
          "overall": 0
        },
        "strengths": [],
        "improvements": [],
        "predictedReach": "low|medium|high"
      }
    `

    const response = await ai.generate(prompt, {
      temperature: 0.3,
      maxTokens: 600,
    })

    try {
      return JSON.parse(response)
    } catch {
      return null
    }
  }
}

export const contentService = new ContentGenerationService()
```

## 4.3 Smart UI Features

### AI-Powered Search (Command Palette)

```typescript
// components/shared/command-palette/command-palette.tsx
import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Command } from 'cmdk'
import {
  Search, FileText, Users, BarChart2, Settings,
  Zap, Mail, MessageSquare, DollarSign, Sparkles
} from 'lucide-react'
import { useKeyboardShortcut } from '@/hooks/use-keyboard-shortcut'
import { ai } from '@/lib/ai/claude-client'

interface CommandItem {
  id: string
  label: string
  icon: React.ReactNode
  action: () => void
  keywords?: string[]
  category: 'navigation' | 'action' | 'ai' | 'recent'
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([])
  const [isLoadingAI, setIsLoadingAI] = useState(false)

  // Toggle with Cmd+K
  useKeyboardShortcut([
    { key: 'cmd+k', callback: () => setOpen(true) },
    { key: 'escape', callback: () => setOpen(false) },
  ])

  // Base commands
  const commands: CommandItem[] = useMemo(() => [
    // Navigation
    { id: 'dashboard', label: 'Go to Dashboard', icon: <BarChart2 />, action: () => {}, category: 'navigation' },
    { id: 'studio', label: 'Open AI Studio', icon: <Sparkles />, action: () => {}, category: 'navigation' },
    { id: 'feed', label: 'View Feed', icon: <FileText />, action: () => {}, category: 'navigation' },
    { id: 'campaigns', label: 'Manage Campaigns', icon: <Mail />, action: () => {}, category: 'navigation' },
    { id: 'earnings', label: 'View Earnings', icon: <DollarSign />, action: () => {}, category: 'navigation' },
    { id: 'settings', label: 'Settings', icon: <Settings />, action: () => {}, category: 'navigation' },

    // Quick Actions
    { id: 'new-post', label: 'Create New Post', icon: <Zap />, action: () => {}, category: 'action' },
    { id: 'new-campaign', label: 'Start Email Campaign', icon: <Mail />, action: () => {}, category: 'action' },
    { id: 'new-sms', label: 'Send SMS Campaign', icon: <MessageSquare />, action: () => {}, category: 'action' },

    // AI Actions
    { id: 'ai-generate', label: 'Generate Content with AI', icon: <Sparkles />, action: () => {}, category: 'ai' },
    { id: 'ai-improve', label: 'Improve Selected Text', icon: <Sparkles />, action: () => {}, category: 'ai' },
    { id: 'ai-hashtags', label: 'Generate Hashtags', icon: <Sparkles />, action: () => {}, category: 'ai' },
  ], [])

  // AI-powered search suggestions
  useEffect(() => {
    if (search.length < 3) {
      setAiSuggestions([])
      return
    }

    const debounce = setTimeout(async () => {
      setIsLoadingAI(true)
      try {
        const response = await ai.generate(`
          User is searching for: "${search}"
          Suggest 3 relevant actions they might want to take.
          Return as JSON array: ["action1", "action2", "action3"]
        `, { maxTokens: 100, temperature: 0.5 })

        const suggestions = JSON.parse(response)
        setAiSuggestions(suggestions)
      } catch {
        setAiSuggestions([])
      } finally {
        setIsLoadingAI(false)
      }
    }, 300)

    return () => clearTimeout(debounce)
  }, [search])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Command Dialog */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="relative w-full max-w-xl bg-white dark:bg-neutral-900 rounded-xl shadow-2xl overflow-hidden"
          >
            <Command>
              {/* Search Input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
                <Search className="h-5 w-5 text-neutral-400" />
                <Command.Input
                  value={search}
                  onValueChange={setSearch}
                  placeholder="Search commands, actions, or ask AI..."
                  className="flex-1 bg-transparent outline-none text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400"
                />
                <kbd className="px-2 py-1 text-xs bg-neutral-100 dark:bg-neutral-800 rounded">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <Command.List className="max-h-80 overflow-y-auto p-2">
                <Command.Empty className="py-6 text-center text-neutral-500">
                  No results found. Try asking AI for help.
                </Command.Empty>

                {/* AI Suggestions */}
                {aiSuggestions.length > 0 && (
                  <Command.Group heading="AI Suggestions">
                    {aiSuggestions.map((suggestion, i) => (
                      <Command.Item
                        key={`ai-${i}`}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      >
                        <Sparkles className="h-4 w-4 text-brand-500" />
                        <span>{suggestion}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {/* Navigation */}
                <Command.Group heading="Navigation">
                  {commands.filter(c => c.category === 'navigation').map(command => (
                    <Command.Item
                      key={command.id}
                      onSelect={command.action}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      <span className="text-neutral-400">{command.icon}</span>
                      <span>{command.label}</span>
                    </Command.Item>
                  ))}
                </Command.Group>

                {/* Actions */}
                <Command.Group heading="Quick Actions">
                  {commands.filter(c => c.category === 'action').map(command => (
                    <Command.Item
                      key={command.id}
                      onSelect={command.action}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      <span className="text-neutral-400">{command.icon}</span>
                      <span>{command.label}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              </Command.List>

              {/* Footer */}
              <div className="px-4 py-2 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-between text-xs text-neutral-500">
                <div className="flex items-center gap-4">
                  <span><kbd>↑↓</kbd> Navigate</span>
                  <span><kbd>↵</kbd> Select</span>
                </div>
                <div className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  <span>AI-powered</span>
                </div>
              </div>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

### Smart Scheduling Recommendations

```typescript
// features/studio/services/scheduling-service.ts
import { ai } from '@/lib/ai/claude-client'

interface ScheduleRecommendation {
  recommendedTime: Date
  reason: string
  confidence: number
  alternativeTimes: Date[]
}

export class SmartSchedulingService {
  async getOptimalPostTime(params: {
    platform: string
    targetAudience: string
    timezone: string
    contentType: 'image' | 'video' | 'text'
    historicalData?: {
      postTime: Date
      engagement: number
    }[]
  }): Promise<ScheduleRecommendation> {
    // Combine AI analysis with historical data
    const historicalInsight = this.analyzeHistoricalData(params.historicalData)

    const prompt = `
      Recommend the optimal posting time for:
      - Platform: ${params.platform}
      - Target Audience: ${params.targetAudience}
      - Timezone: ${params.timezone}
      - Content Type: ${params.contentType}
      ${historicalInsight ? `- Historical best times: ${historicalInsight}` : ''}

      Consider:
      - Platform-specific peak hours
      - Day of week patterns
      - Content type engagement patterns

      Return as JSON:
      {
        "recommendedTime": "ISO timestamp",
        "reason": "explanation",
        "confidence": 0.0-1.0,
        "alternativeTimes": ["ISO", "ISO", "ISO"]
      }
    `

    const response = await ai.generate(prompt, {
      temperature: 0.3,
      maxTokens: 300,
    })

    return JSON.parse(response)
  }

  private analyzeHistoricalData(data?: { postTime: Date; engagement: number }[]) {
    if (!data || data.length < 5) return null

    // Find top performing times
    const sorted = [...data].sort((a, b) => b.engagement - a.engagement)
    const topTimes = sorted.slice(0, 3).map(d => d.postTime.toISOString())

    return topTimes.join(', ')
  }
}
```

## 4.4 Intelligent Analytics

### AI-Powered Insights

```typescript
// features/analytics/services/insights-service.ts
import { ai } from '@/lib/ai/claude-client'

interface AnalyticsData {
  posts: { id: string; engagement: number; reach: number; date: Date }[]
  followers: { date: Date; count: number }[]
  topContent: { id: string; type: string; engagement: number }[]
}

export class AIInsightsService {
  async generateInsights(data: AnalyticsData) {
    const prompt = `
      Analyze this social media performance data and provide actionable insights:

      Posts Performance (last 30 days):
      - Total posts: ${data.posts.length}
      - Avg engagement: ${this.calculateAvg(data.posts, 'engagement')}
      - Avg reach: ${this.calculateAvg(data.posts, 'reach')}

      Follower Growth:
      - Start: ${data.followers[0]?.count || 0}
      - End: ${data.followers[data.followers.length - 1]?.count || 0}
      - Growth: ${this.calculateGrowth(data.followers)}%

      Top Content Types:
      ${data.topContent.map(c => `- ${c.type}: ${c.engagement} engagement`).join('\n')}

      Provide:
      1. Key performance summary (2-3 sentences)
      2. Top 3 actionable recommendations
      3. Content strategy suggestion for next week
      4. Potential growth opportunities

      Format as JSON:
      {
        "summary": "",
        "recommendations": [{"title": "", "description": "", "priority": "high|medium|low"}],
        "contentStrategy": "",
        "opportunities": []
      }
    `

    const response = await ai.generate(prompt, {
      temperature: 0.4,
      maxTokens: 800,
    })

    return JSON.parse(response)
  }

  async predictTrends(historicalData: any[]) {
    // AI-powered trend prediction
    const prompt = `
      Based on the historical engagement patterns, predict:
      1. Expected engagement for next 7 days
      2. Best content types to post
      3. Trending topics in the niche
      4. Potential viral opportunities

      Historical patterns: ${JSON.stringify(historicalData.slice(-30))}

      Return predictions as JSON.
    `

    const response = await ai.generate(prompt, {
      temperature: 0.5,
      maxTokens: 600,
    })

    return JSON.parse(response)
  }

  private calculateAvg(data: any[], field: string): number {
    if (!data.length) return 0
    return data.reduce((sum, item) => sum + item[field], 0) / data.length
  }

  private calculateGrowth(followers: { date: Date; count: number }[]): number {
    if (followers.length < 2) return 0
    const first = followers[0].count
    const last = followers[followers.length - 1].count
    return ((last - first) / first) * 100
  }
}
```

## 4.5 Smart Notifications System

```typescript
// features/notifications/smart-notifications.ts
import { ai } from '@/lib/ai/claude-client'

interface SmartNotification {
  id: string
  type: 'insight' | 'action' | 'milestone' | 'warning'
  title: string
  message: string
  priority: 'high' | 'medium' | 'low'
  actionUrl?: string
  actionLabel?: string
}

export class SmartNotificationService {
  async generateContextualNotifications(userData: {
    recentActivity: any[]
    goals: any[]
    performanceData: any
  }): Promise<SmartNotification[]> {
    const prompt = `
      Based on this user's activity and goals, generate helpful notifications:

      Recent Activity: ${JSON.stringify(userData.recentActivity.slice(-10))}
      User Goals: ${JSON.stringify(userData.goals)}
      Performance: ${JSON.stringify(userData.performanceData)}

      Generate 3-5 contextual notifications that are:
      1. Actionable and specific
      2. Timed appropriately (not too frequent)
      3. Relevant to their goals
      4. Celebrating achievements when appropriate

      Types: insight (data-driven tips), action (suggested tasks),
             milestone (achievements), warning (potential issues)

      Return as JSON array:
      [{
        "type": "",
        "title": "",
        "message": "",
        "priority": "",
        "actionUrl": "",
        "actionLabel": ""
      }]
    `

    const response = await ai.generate(prompt, {
      temperature: 0.6,
      maxTokens: 600,
    })

    const notifications = JSON.parse(response)
    return notifications.map((n: any, i: number) => ({
      ...n,
      id: `smart-${Date.now()}-${i}`,
    }))
  }
}
```

## 4.6 AI Usage & Cost Management

### Token Tracking System

```typescript
// lib/ai/usage-tracker.ts
import { prisma } from '@/lib/db/client'

interface TokenUsage {
  inputTokens: number
  outputTokens: number
  model: string
  feature: string
}

export class AIUsageTracker {
  async trackUsage(userId: string, usage: TokenUsage) {
    const cost = this.calculateCost(usage)

    await prisma.aiUsage.create({
      data: {
        userId,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        model: usage.model,
        feature: usage.feature,
        costCents: Math.round(cost * 100),
        createdAt: new Date(),
      },
    })

    // Deduct from user's AI credits
    await prisma.user.update({
      where: { id: userId },
      data: {
        aiCredits: { decrement: this.tokensToCredits(usage) },
      },
    })
  }

  async getUsageSummary(userId: string, period: 'day' | 'week' | 'month') {
    const startDate = this.getPeriodStart(period)

    const usage = await prisma.aiUsage.aggregate({
      where: {
        userId,
        createdAt: { gte: startDate },
      },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        costCents: true,
      },
      _count: true,
    })

    return {
      totalTokens: (usage._sum.inputTokens || 0) + (usage._sum.outputTokens || 0),
      totalCost: (usage._sum.costCents || 0) / 100,
      requestCount: usage._count,
      period,
    }
  }

  async checkQuota(userId: string): Promise<{ allowed: boolean; remaining: number }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { aiCredits: true, plan: true },
    })

    if (!user) return { allowed: false, remaining: 0 }

    return {
      allowed: user.aiCredits > 0,
      remaining: user.aiCredits,
    }
  }

  private calculateCost(usage: TokenUsage): number {
    // Claude Sonnet pricing (example)
    const inputCost = (usage.inputTokens / 1000) * 0.003
    const outputCost = (usage.outputTokens / 1000) * 0.015
    return inputCost + outputCost
  }

  private tokensToCredits(usage: TokenUsage): number {
    // 1 credit = ~100 tokens
    return Math.ceil((usage.inputTokens + usage.outputTokens) / 100)
  }

  private getPeriodStart(period: 'day' | 'week' | 'month'): Date {
    const now = new Date()
    switch (period) {
      case 'day':
        return new Date(now.setHours(0, 0, 0, 0))
      case 'week':
        return new Date(now.setDate(now.getDate() - 7))
      case 'month':
        return new Date(now.setMonth(now.getMonth() - 1))
    }
  }
}

export const aiUsageTracker = new AIUsageTracker()
```

---

# PART 5: DATABASE SCHEMA & API DESIGN

## 5.1 Database Architecture

### Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Primary DB** | PostgreSQL 15+ | Relational data, transactions |
| **ORM** | Prisma | Type-safe database access |
| **Cache** | Redis | Sessions, caching, rate limiting |
| **Analytics** | ClickHouse | Time-series analytics data |
| **Search** | Meilisearch | Full-text search |
| **File Storage** | Cloudflare R2 | Media files, CDN |

### Database Design Principles

1. **Normalization** - 3NF for transactional data
2. **Denormalization** - Strategic for read-heavy tables
3. **Indexing** - Composite indexes for common queries
4. **Partitioning** - Time-based for analytics tables
5. **Soft Deletes** - Preserve data integrity

## 5.2 Complete Prisma Schema

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// USER & AUTHENTICATION
// ============================================

model User {
  id                String    @id @default(cuid())
  email             String    @unique
  passwordHash      String
  name              String
  username          String    @unique
  avatarUrl         String?
  bio               String?
  website           String?
  emailVerified     Boolean   @default(false)
  emailVerifiedAt   DateTime?

  // Subscription & Billing
  plan              Plan      @default(STARTER)
  planExpiresAt     DateTime?
  stripeCustomerId  String?   @unique

  // Credits & Balance
  aiCredits         Int       @default(500)
  balanceCents      Int       @default(0)

  // Settings
  timezone          String    @default("UTC")
  language          String    @default("en")
  theme             Theme     @default(SYSTEM)
  notificationPrefs Json      @default("{}")

  // Metadata
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  lastLoginAt       DateTime?
  deletedAt         DateTime?

  // Relations
  posts             Post[]
  comments          Comment[]
  likes             Like[]
  bookmarks         Bookmark[]
  followers         Follow[]  @relation("Following")
  following         Follow[]  @relation("Followers")
  campaigns         Campaign[]
  adCampaigns       AdCampaign[]
  contacts          Contact[]
  earnings          Earning[]
  payouts           Payout[]
  aiUsage           AIUsage[]
  notifications     Notification[]
  sessions          Session[]
  brandKits         BrandKit[]
  teamMemberships   TeamMember[]

  @@index([email])
  @@index([username])
  @@index([stripeCustomerId])
  @@index([createdAt])
}

model Session {
  id           String   @id @default(cuid())
  userId       String
  token        String   @unique
  userAgent    String?
  ipAddress    String?
  expiresAt    DateTime
  createdAt    DateTime @default(now())

  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([token])
  @@index([expiresAt])
}

model PasswordReset {
  id        String   @id @default(cuid())
  email     String
  token     String   @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())

  @@index([email])
  @@index([token])
}

enum Plan {
  STARTER
  PRO
  BUSINESS
  ENTERPRISE
}

enum Theme {
  LIGHT
  DARK
  SYSTEM
}

// ============================================
// SOCIAL FEED (FLOWSOCIAL)
// ============================================

model Post {
  id           String     @id @default(cuid())
  userId       String

  // Content
  caption      String?    @db.Text
  hashtags     String[]
  mentions     String[]

  // Media
  mediaType    MediaType?
  mediaUrl     String?
  thumbnailUrl String?
  mediaMeta    Json?      // dimensions, duration, etc.

  // Promotion
  isPromoted   Boolean    @default(false)
  campaignId   String?

  // Stats (denormalized for performance)
  likeCount    Int        @default(0)
  commentCount Int        @default(0)
  shareCount   Int        @default(0)
  viewCount    Int        @default(0)

  // Status
  status       PostStatus @default(PUBLISHED)
  scheduledAt  DateTime?
  publishedAt  DateTime?

  // Metadata
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  deletedAt    DateTime?

  // Relations
  user         User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  adCampaign   AdCampaign? @relation(fields: [campaignId], references: [id])
  comments     Comment[]
  likes        Like[]
  bookmarks    Bookmark[]
  shares       Share[]
  postViews    PostView[]

  @@index([userId])
  @@index([status, scheduledAt])
  @@index([isPromoted, status])
  @@index([createdAt])
  @@index([hashtags], type: Gin)
}

model Comment {
  id        String   @id @default(cuid())
  postId    String
  userId    String
  parentId  String?  // For nested comments
  content   String   @db.Text

  likeCount Int      @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?

  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  parent    Comment? @relation("CommentReplies", fields: [parentId], references: [id])
  replies   Comment[] @relation("CommentReplies")
  likes     CommentLike[]

  @@index([postId])
  @@index([userId])
  @@index([parentId])
  @@index([createdAt])
}

model Like {
  id        String   @id @default(cuid())
  postId    String
  userId    String
  createdAt DateTime @default(now())

  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([postId, userId])
  @@index([postId])
  @@index([userId])
}

model CommentLike {
  id        String   @id @default(cuid())
  commentId String
  userId    String
  createdAt DateTime @default(now())

  comment   Comment  @relation(fields: [commentId], references: [id], onDelete: Cascade)

  @@unique([commentId, userId])
}

model Bookmark {
  id        String   @id @default(cuid())
  postId    String
  userId    String
  createdAt DateTime @default(now())

  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([postId, userId])
  @@index([userId, createdAt])
}

model Share {
  id        String   @id @default(cuid())
  postId    String
  platform  String   // facebook, twitter, linkedin, etc.
  createdAt DateTime @default(now())

  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)

  @@index([postId])
  @@index([platform])
}

model Follow {
  id          String   @id @default(cuid())
  followerId  String
  followingId String
  createdAt   DateTime @default(now())

  follower    User     @relation("Followers", fields: [followerId], references: [id], onDelete: Cascade)
  following   User     @relation("Following", fields: [followingId], references: [id], onDelete: Cascade)

  @@unique([followerId, followingId])
  @@index([followerId])
  @@index([followingId])
}

enum MediaType {
  IMAGE
  VIDEO
  CAROUSEL
}

enum PostStatus {
  DRAFT
  SCHEDULED
  PUBLISHED
  ARCHIVED
}

// ============================================
// PAID ADS & VIEW-TO-EARN
// ============================================

model AdCampaign {
  id              String          @id @default(cuid())
  userId          String

  // Campaign Details
  name            String
  objective       AdObjective

  // Budget
  budgetCents     Int
  spentCents      Int             @default(0)
  dailyBudgetCents Int?
  cpvCents        Int             // Cost per view

  // Targeting
  targeting       Json            // { age, location, interests, etc. }

  // Schedule
  startDate       DateTime
  endDate         DateTime?

  // Status
  status          CampaignStatus  @default(DRAFT)

  // Stats
  impressions     Int             @default(0)
  clicks          Int             @default(0)
  conversions     Int             @default(0)

  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  user            User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  posts           Post[]
  postViews       PostView[]

  @@index([userId])
  @@index([status, startDate, endDate])
}

model PostView {
  id           String      @id @default(cuid())
  postId       String
  viewerUserId String?
  campaignId   String?

  // Earnings (only for promoted posts)
  earnedCents  Int         @default(0)

  // View Details
  viewDuration Int         // seconds
  deviceType   String?

  createdAt    DateTime    @default(now())

  post         Post        @relation(fields: [postId], references: [id], onDelete: Cascade)
  campaign     AdCampaign? @relation(fields: [campaignId], references: [id])

  // Ensure one earning per post per user
  @@unique([postId, viewerUserId])
  @@index([postId])
  @@index([viewerUserId])
  @@index([campaignId])
  @@index([createdAt])
}

model Earning {
  id          String       @id @default(cuid())
  userId      String

  amountCents Int
  source      EarningSource
  sourceId    String?      // postView id, referral id, etc.

  createdAt   DateTime     @default(now())

  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([source])
  @@index([createdAt])
}

model Payout {
  id            String        @id @default(cuid())
  userId        String

  amountCents   Int
  method        PayoutMethod

  // Payout Details
  accountInfo   Json          // encrypted bank/paypal details
  transactionId String?       // external transaction id

  status        PayoutStatus  @default(PENDING)
  requestedAt   DateTime      @default(now())
  processedAt   DateTime?
  failedReason  String?

  user          User          @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([status])
}

enum AdObjective {
  AWARENESS
  ENGAGEMENT
  TRAFFIC
  CONVERSIONS
}

enum CampaignStatus {
  DRAFT
  PENDING_REVIEW
  ACTIVE
  PAUSED
  COMPLETED
  REJECTED
}

enum EarningSource {
  POST_VIEW
  REFERRAL
  BONUS
}

enum PayoutMethod {
  PAYPAL
  STRIPE
  BANK_TRANSFER
}

enum PayoutStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

// ============================================
// EMAIL & SMS CAMPAIGNS
// ============================================

model Campaign {
  id            String         @id @default(cuid())
  userId        String

  type          CampaignType
  name          String

  // Email specific
  subject       String?
  preheaderText String?
  fromName      String?
  replyTo       String?

  // Content
  content       String         @db.Text
  contentHtml   String?        @db.Text

  // Recipients
  contactListId String?
  segmentRules  Json?

  // Stats
  sentCount     Int            @default(0)
  deliveredCount Int           @default(0)
  openCount     Int            @default(0)
  clickCount    Int            @default(0)
  bounceCount   Int            @default(0)
  unsubCount    Int            @default(0)

  // Schedule
  status        CampaignRunStatus @default(DRAFT)
  scheduledAt   DateTime?
  sentAt        DateTime?

  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  user          User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  contactList   ContactList?   @relation(fields: [contactListId], references: [id])
  sends         CampaignSend[]

  @@index([userId])
  @@index([type, status])
}

model CampaignSend {
  id          String      @id @default(cuid())
  campaignId  String
  contactId   String

  status      SendStatus  @default(PENDING)
  sentAt      DateTime?
  deliveredAt DateTime?
  openedAt    DateTime?
  clickedAt   DateTime?
  bouncedAt   DateTime?

  // Tracking
  opens       Int         @default(0)
  clicks      Int         @default(0)

  campaign    Campaign    @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  contact     Contact     @relation(fields: [contactId], references: [id], onDelete: Cascade)

  @@unique([campaignId, contactId])
  @@index([campaignId])
  @@index([contactId])
  @@index([status])
}

model ContactList {
  id        String    @id @default(cuid())
  userId    String
  name      String

  // Stats
  totalCount Int      @default(0)
  activeCount Int     @default(0)

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  contacts  ContactListMember[]
  campaigns Campaign[]

  @@index([userId])
}

model Contact {
  id              String    @id @default(cuid())
  userId          String

  email           String?
  phone           String?
  firstName       String?
  lastName        String?

  // Custom fields
  customFields    Json      @default("{}")
  tags            String[]

  // Consent
  emailOptedIn    Boolean   @default(false)
  emailOptedInAt  DateTime?
  smsOptedIn      Boolean   @default(false)
  smsOptedInAt    DateTime?

  // Status
  status          ContactStatus @default(ACTIVE)
  unsubscribedAt  DateTime?

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  lists           ContactListMember[]
  sends           CampaignSend[]

  @@unique([userId, email])
  @@unique([userId, phone])
  @@index([userId])
  @@index([email])
  @@index([phone])
  @@index([tags], type: Gin)
}

model ContactListMember {
  id            String      @id @default(cuid())
  contactListId String
  contactId     String
  addedAt       DateTime    @default(now())

  contactList   ContactList @relation(fields: [contactListId], references: [id], onDelete: Cascade)
  contact       Contact     @relation(fields: [contactId], references: [id], onDelete: Cascade)

  @@unique([contactListId, contactId])
}

enum CampaignType {
  EMAIL
  SMS
}

enum CampaignRunStatus {
  DRAFT
  SCHEDULED
  SENDING
  SENT
  PAUSED
  CANCELLED
}

enum SendStatus {
  PENDING
  SENT
  DELIVERED
  OPENED
  CLICKED
  BOUNCED
  FAILED
}

enum ContactStatus {
  ACTIVE
  UNSUBSCRIBED
  BOUNCED
  COMPLAINED
}

// ============================================
// AI USAGE TRACKING
// ============================================

model AIUsage {
  id           String   @id @default(cuid())
  userId       String

  feature      String   // content-generation, ad-copy, etc.
  model        String   // claude-sonnet, etc.

  inputTokens  Int
  outputTokens Int
  costCents    Int

  // Request metadata
  prompt       String?  @db.Text
  response     String?  @db.Text
  latencyMs    Int?

  createdAt    DateTime @default(now())

  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([feature])
  @@index([createdAt])
}

// ============================================
// NOTIFICATIONS
// ============================================

model Notification {
  id        String           @id @default(cuid())
  userId    String

  type      NotificationType
  title     String
  message   String
  data      Json?            // Additional context

  actionUrl String?

  read      Boolean          @default(false)
  readAt    DateTime?

  createdAt DateTime         @default(now())

  user      User             @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, read])
  @@index([createdAt])
}

enum NotificationType {
  LIKE
  COMMENT
  FOLLOW
  MENTION
  CAMPAIGN_COMPLETE
  PAYOUT_PROCESSED
  AI_INSIGHT
  SYSTEM
}

// ============================================
// BRAND KITS & TEAMS
// ============================================

model BrandKit {
  id          String   @id @default(cuid())
  userId      String

  name        String
  logo        String?
  colors      Json     // { primary, secondary, accent }
  fonts       Json     // { heading, body }
  voiceTone   String?  @db.Text
  guidelines  String?  @db.Text

  isDefault   Boolean  @default(false)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model Team {
  id        String       @id @default(cuid())
  name      String
  slug      String       @unique
  avatarUrl String?

  plan      Plan         @default(BUSINESS)

  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  members   TeamMember[]

  @@index([slug])
}

model TeamMember {
  id        String     @id @default(cuid())
  teamId    String
  userId    String
  role      TeamRole   @default(MEMBER)

  invitedAt DateTime   @default(now())
  acceptedAt DateTime?

  team      Team       @relation(fields: [teamId], references: [id], onDelete: Cascade)
  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([teamId, userId])
  @@index([teamId])
  @@index([userId])
}

enum TeamRole {
  OWNER
  ADMIN
  MEMBER
  VIEWER
}
```

## 5.3 API Design

### RESTful API Structure

```
/api/v1
├── /auth
│   ├── POST   /register
│   ├── POST   /login
│   ├── POST   /logout
│   ├── POST   /refresh
│   ├── POST   /forgot-password
│   └── POST   /reset-password
│
├── /users
│   ├── GET    /me
│   ├── PATCH  /me
│   ├── GET    /:username
│   ├── POST   /:username/follow
│   └── DELETE /:username/follow
│
├── /posts
│   ├── GET    /                    # Feed
│   ├── POST   /                    # Create post
│   ├── GET    /:id
│   ├── PATCH  /:id
│   ├── DELETE /:id
│   ├── POST   /:id/like
│   ├── DELETE /:id/like
│   ├── GET    /:id/comments
│   ├── POST   /:id/comments
│   └── POST   /:id/share
│
├── /ai
│   ├── POST   /generate/post
│   ├── POST   /generate/ad-copy
│   ├── POST   /generate/email
│   ├── POST   /generate/sms
│   ├── POST   /generate/hashtags
│   ├── POST   /improve
│   ├── POST   /analyze
│   └── GET    /usage
│
├── /campaigns
│   ├── GET    /
│   ├── POST   /
│   ├── GET    /:id
│   ├── PATCH  /:id
│   ├── DELETE /:id
│   ├── POST   /:id/send
│   ├── POST   /:id/schedule
│   └── GET    /:id/stats
│
├── /ads
│   ├── GET    /campaigns
│   ├── POST   /campaigns
│   ├── GET    /campaigns/:id
│   ├── PATCH  /campaigns/:id
│   ├── POST   /campaigns/:id/pause
│   ├── POST   /campaigns/:id/resume
│   └── GET    /campaigns/:id/analytics
│
├── /contacts
│   ├── GET    /
│   ├── POST   /
│   ├── POST   /import
│   ├── GET    /:id
│   ├── PATCH  /:id
│   ├── DELETE /:id
│   └── GET    /lists
│
├── /earnings
│   ├── GET    /
│   ├── GET    /stats
│   └── POST   /payout
│
├── /analytics
│   ├── GET    /overview
│   ├── GET    /posts
│   ├── GET    /audience
│   ├── GET    /engagement
│   └── GET    /insights
│
└── /webhooks
    ├── POST   /stripe
    ├── POST   /twilio
    └── POST   /sendgrid
```

### API Response Format

```typescript
// Standard success response
interface APIResponse<T> {
  success: true
  data: T
  meta?: {
    page?: number
    limit?: number
    total?: number
    hasMore?: boolean
  }
}

// Standard error response
interface APIError {
  success: false
  error: {
    code: string
    message: string
    details?: Record<string, string[]>
  }
}

// Example responses
// GET /api/v1/posts
{
  "success": true,
  "data": [
    {
      "id": "clx...",
      "caption": "...",
      "mediaUrl": "...",
      "author": { "id": "...", "name": "...", "username": "..." },
      "likeCount": 42,
      "commentCount": 5,
      "isLiked": false,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "hasMore": true
  }
}

// POST /api/v1/ai/generate/post - Error
{
  "success": false,
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "You have exceeded your AI credits for this month",
    "details": {
      "remaining": 0,
      "limit": 500,
      "resetsAt": "2024-02-01T00:00:00Z"
    }
  }
}
```

### API Route Implementation

```typescript
// app/api/v1/posts/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/client'
import { getSession } from '@/lib/auth/session'
import { rateLimit } from '@/lib/rate-limit'

// Validation schema
const createPostSchema = z.object({
  caption: z.string().max(2000).optional(),
  mediaUrl: z.string().url().optional(),
  mediaType: z.enum(['IMAGE', 'VIDEO', 'CAROUSEL']).optional(),
  hashtags: z.array(z.string()).max(30).optional(),
  scheduledAt: z.string().datetime().optional(),
})

// GET /api/v1/posts - Get feed
export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in' } },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
    const type = searchParams.get('type') // 'following' | 'discover' | 'promoted'

    const skip = (page - 1) * limit

    // Build query based on feed type
    const where = type === 'following'
      ? {
          userId: {
            in: await prisma.follow
              .findMany({ where: { followerId: session.userId }, select: { followingId: true } })
              .then(f => f.map(x => x.followingId))
          },
          status: 'PUBLISHED' as const,
          deletedAt: null,
        }
      : {
          status: 'PUBLISHED' as const,
          deletedAt: null,
        }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, username: true, avatarUrl: true } },
          _count: { select: { comments: true, likes: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.post.count({ where }),
    ])

    // Check if user liked each post
    const likedPosts = await prisma.like.findMany({
      where: {
        userId: session.userId,
        postId: { in: posts.map(p => p.id) },
      },
      select: { postId: true },
    })
    const likedPostIds = new Set(likedPosts.map(l => l.postId))

    const formattedPosts = posts.map(post => ({
      id: post.id,
      caption: post.caption,
      hashtags: post.hashtags,
      mediaUrl: post.mediaUrl,
      mediaType: post.mediaType,
      isPromoted: post.isPromoted,
      author: post.user,
      likeCount: post._count.likes,
      commentCount: post._count.comments,
      isLiked: likedPostIds.has(post.id),
      createdAt: post.createdAt,
    }))

    return NextResponse.json({
      success: true,
      data: formattedPosts,
      meta: {
        page,
        limit,
        total,
        hasMore: skip + posts.length < total,
      },
    })
  } catch (error) {
    console.error('GET /posts error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } },
      { status: 500 }
    )
  }
}

// POST /api/v1/posts - Create post
export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(req, { limit: 30, window: '1m' })
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
        { status: 429 }
      )
    }

    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in' } },
        { status: 401 }
      )
    }

    const body = await req.json()
    const validation = createPostSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: validation.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    const { caption, mediaUrl, mediaType, hashtags, scheduledAt } = validation.data

    const post = await prisma.post.create({
      data: {
        userId: session.userId,
        caption,
        mediaUrl,
        mediaType,
        hashtags: hashtags || [],
        status: scheduledAt ? 'SCHEDULED' : 'PUBLISHED',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        publishedAt: scheduledAt ? null : new Date(),
      },
      include: {
        user: { select: { id: true, name: true, username: true, avatarUrl: true } },
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: post.id,
        caption: post.caption,
        mediaUrl: post.mediaUrl,
        author: post.user,
        createdAt: post.createdAt,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('POST /posts error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } },
      { status: 500 }
    )
  }
}
```

## 5.4 Real-time Updates (WebSocket)

```typescript
// lib/websocket/socket-server.ts
import { Server as SocketIOServer } from 'socket.io'
import { verifyToken } from '@/lib/auth/session'

export function initializeWebSocket(httpServer: any) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL,
      credentials: true,
    },
  })

  // Authentication middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token
    if (!token) {
      return next(new Error('Authentication required'))
    }

    try {
      const session = await verifyToken(token)
      socket.data.userId = session.userId
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', (socket) => {
    const userId = socket.data.userId

    // Join user's personal room
    socket.join(`user:${userId}`)

    // Join feed room for real-time updates
    socket.on('join:feed', () => {
      socket.join('feed:global')
    })

    // Join post room for live comments
    socket.on('join:post', (postId: string) => {
      socket.join(`post:${postId}`)
    })

    socket.on('leave:post', (postId: string) => {
      socket.leave(`post:${postId}`)
    })

    socket.on('disconnect', () => {
      console.log(`User ${userId} disconnected`)
    })
  })

  return io
}

// Event emitters
export const emitNewPost = (io: SocketIOServer, post: any) => {
  io.to('feed:global').emit('post:new', post)
}

export const emitNewComment = (io: SocketIOServer, postId: string, comment: any) => {
  io.to(`post:${postId}`).emit('comment:new', comment)
}

export const emitNotification = (io: SocketIOServer, userId: string, notification: any) => {
  io.to(`user:${userId}`).emit('notification:new', notification)
}
```

---

# PART 6: PERFORMANCE & OPTIMIZATION

## 6.1 Performance Goals & Metrics

### Core Web Vitals Targets

| Metric | Target | Description |
|--------|--------|-------------|
| **LCP** (Largest Contentful Paint) | < 2.5s | Main content visible |
| **FID** (First Input Delay) | < 100ms | Time to interactive |
| **CLS** (Cumulative Layout Shift) | < 0.1 | Visual stability |
| **TTFB** (Time to First Byte) | < 200ms | Server response time |
| **FCP** (First Contentful Paint) | < 1.8s | First render |

### Application Performance Targets

| Area | Target | Measurement |
|------|--------|-------------|
| **API Response** | < 100ms (p95) | Server processing time |
| **Page Load** | < 3s | Full page interactive |
| **Bundle Size** | < 200KB (initial) | Gzipped JavaScript |
| **Image Load** | < 500ms | Above-the-fold images |
| **Animation** | 60fps | Smooth interactions |

## 6.2 Frontend Optimization

### Code Splitting Strategy

```typescript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons', 'date-fns'],
  },

  // Bundle analyzer for optimization
  webpack: (config, { isServer }) => {
    if (process.env.ANALYZE === 'true') {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          reportFilename: isServer ? '../analyze/server.html' : './analyze/client.html',
        })
      )
    }
    return config
  },
}

module.exports = nextConfig
```

### Dynamic Imports

```typescript
// Lazy load heavy components
import dynamic from 'next/dynamic'

// Heavy editor component
const RichTextEditor = dynamic(
  () => import('@/components/forms/rich-text-editor'),
  {
    loading: () => <EditorSkeleton />,
    ssr: false, // Client-only for editor
  }
)

// Chart library
const AnalyticsChart = dynamic(
  () => import('@/components/shared/analytics-chart'),
  { loading: () => <ChartSkeleton /> }
)

// Video player
const VideoPlayer = dynamic(
  () => import('@/components/shared/video-player'),
  { ssr: false }
)

// Modal components (only load when needed)
const ShareHubModal = dynamic(
  () => import('@/components/shared/share-hub').then(mod => mod.ShareHub)
)
```

### Image Optimization

```typescript
// components/ui/optimized-image.tsx
import Image from 'next/image'
import { useState } from 'react'
import { cn } from '@/lib/utils/cn'

interface OptimizedImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  priority?: boolean
  className?: string
  fill?: boolean
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  priority = false,
  className,
  fill = false,
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true)

  // Use Cloudflare Image Resizing or similar
  const optimizedSrc = src.startsWith('http')
    ? `${process.env.NEXT_PUBLIC_CDN_URL}/cdn-cgi/image/format=auto,quality=80,width=${width || 800}/${src}`
    : src

  return (
    <div className={cn('relative overflow-hidden', className)}>
      <Image
        src={optimizedSrc}
        alt={alt}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        fill={fill}
        priority={priority}
        loading={priority ? 'eager' : 'lazy'}
        placeholder="blur"
        blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBEQCEAwEPwAB//9k="
        className={cn(
          'duration-700 ease-in-out',
          isLoading ? 'scale-105 blur-lg' : 'scale-100 blur-0'
        )}
        onLoad={() => setIsLoading(false)}
        sizes={fill ? '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw' : undefined}
      />
    </div>
  )
}
```

### Virtual List for Feed

```typescript
// features/social/components/feed/virtual-feed.tsx
import { useRef, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { PostCard } from './post-card'
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll'
import type { Post } from '@/types'

interface VirtualFeedProps {
  initialPosts: Post[]
  fetchMore: (page: number) => Promise<{ data: Post[]; hasMore: boolean }>
}

export function VirtualFeed({ initialPosts, fetchMore }: VirtualFeedProps) {
  const parentRef = useRef<HTMLDivElement>(null)

  const { items, isLoading, hasMore, loadMoreRef } = useInfiniteScroll({
    fetchFn: fetchMore,
    initialData: initialPosts,
  })

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => 500, []), // Estimated post height
    overscan: 5, // Render 5 items outside viewport
  })

  return (
    <div
      ref={parentRef}
      className="h-screen overflow-auto"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const post = items[virtualItem.index]
          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <PostCard post={post} />
            </div>
          )
        })}
      </div>

      {/* Load more trigger */}
      <div ref={loadMoreRef} className="h-20 flex items-center justify-center">
        {isLoading && <Spinner />}
        {!hasMore && <p className="text-neutral-500">No more posts</p>}
      </div>
    </div>
  )
}
```

### Optimistic Updates

```typescript
// features/social/hooks/use-like-post.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api/client'

export function useLikePost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ postId, isLiked }: { postId: string; isLiked: boolean }) => {
      if (isLiked) {
        return api.delete(`/posts/${postId}/like`)
      }
      return api.post(`/posts/${postId}/like`)
    },

    // Optimistic update
    onMutate: async ({ postId, isLiked }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['posts'] })

      // Snapshot previous value
      const previousPosts = queryClient.getQueryData(['posts'])

      // Optimistically update
      queryClient.setQueryData(['posts'], (old: any) => {
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: page.data.map((post: any) =>
              post.id === postId
                ? {
                    ...post,
                    isLiked: !isLiked,
                    likeCount: isLiked ? post.likeCount - 1 : post.likeCount + 1,
                  }
                : post
            ),
          })),
        }
      })

      return { previousPosts }
    },

    // Rollback on error
    onError: (err, variables, context) => {
      if (context?.previousPosts) {
        queryClient.setQueryData(['posts'], context.previousPosts)
      }
    },

    // Refetch after settle
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] })
    },
  })
}
```

## 6.3 Backend Optimization

### Database Query Optimization

```typescript
// lib/db/queries/optimized-queries.ts
import { prisma } from '@/lib/db/client'
import { Prisma } from '@prisma/client'

// Efficient feed query with cursor pagination
export async function getFeedPosts(params: {
  userId: string
  cursor?: string
  limit?: number
  type?: 'following' | 'discover'
}) {
  const { userId, cursor, limit = 20, type = 'discover' } = params

  // Get following IDs for 'following' feed
  const followingIds = type === 'following'
    ? await prisma.follow
        .findMany({
          where: { followerId: userId },
          select: { followingId: true },
        })
        .then(f => f.map(x => x.followingId))
    : undefined

  // Efficient cursor-based pagination
  const posts = await prisma.post.findMany({
    where: {
      status: 'PUBLISHED',
      deletedAt: null,
      ...(followingIds && { userId: { in: followingIds } }),
    },
    take: limit + 1, // Fetch one extra to check hasMore
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      caption: true,
      hashtags: true,
      mediaUrl: true,
      mediaType: true,
      isPromoted: true,
      likeCount: true,
      commentCount: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          avatarUrl: true,
        },
      },
    },
  })

  // Check if there are more posts
  const hasMore = posts.length > limit
  const data = hasMore ? posts.slice(0, -1) : posts
  const nextCursor = hasMore ? data[data.length - 1].id : null

  // Batch fetch like status
  const likedPostIds = await prisma.like
    .findMany({
      where: {
        userId,
        postId: { in: data.map(p => p.id) },
      },
      select: { postId: true },
    })
    .then(likes => new Set(likes.map(l => l.postId)))

  return {
    data: data.map(post => ({
      ...post,
      isLiked: likedPostIds.has(post.id),
    })),
    nextCursor,
    hasMore,
  }
}

// Use raw SQL for complex aggregations
export async function getAnalyticsSummary(userId: string, days: number = 30) {
  const result = await prisma.$queryRaw<any[]>`
    WITH date_series AS (
      SELECT generate_series(
        CURRENT_DATE - ${days}::integer,
        CURRENT_DATE,
        '1 day'::interval
      )::date AS date
    ),
    daily_stats AS (
      SELECT
        DATE(p."createdAt") as date,
        COUNT(DISTINCT p.id) as posts,
        SUM(p."likeCount") as likes,
        SUM(p."commentCount") as comments,
        SUM(p."viewCount") as views
      FROM "Post" p
      WHERE p."userId" = ${userId}
        AND p."createdAt" >= CURRENT_DATE - ${days}::integer
        AND p."deletedAt" IS NULL
      GROUP BY DATE(p."createdAt")
    )
    SELECT
      ds.date,
      COALESCE(stats.posts, 0) as posts,
      COALESCE(stats.likes, 0) as likes,
      COALESCE(stats.comments, 0) as comments,
      COALESCE(stats.views, 0) as views
    FROM date_series ds
    LEFT JOIN daily_stats stats ON ds.date = stats.date
    ORDER BY ds.date ASC
  `

  return result
}
```

### Redis Caching Layer

```typescript
// lib/cache/redis-cache.ts
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL!)

interface CacheOptions {
  ttl?: number // seconds
  tags?: string[]
}

export class CacheService {
  private prefix = 'flowsmartly:'

  private key(key: string): string {
    return `${this.prefix}${key}`
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await redis.get(this.key(key))
    if (!data) return null
    return JSON.parse(data) as T
  }

  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    const { ttl = 3600 } = options
    const serialized = JSON.stringify(value)

    if (ttl > 0) {
      await redis.setex(this.key(key), ttl, serialized)
    } else {
      await redis.set(this.key(key), serialized)
    }

    // Track tags for invalidation
    if (options.tags?.length) {
      for (const tag of options.tags) {
        await redis.sadd(this.key(`tag:${tag}`), this.key(key))
      }
    }
  }

  async delete(key: string): Promise<void> {
    await redis.del(this.key(key))
  }

  async invalidateTag(tag: string): Promise<void> {
    const keys = await redis.smembers(this.key(`tag:${tag}`))
    if (keys.length > 0) {
      await redis.del(...keys)
      await redis.del(this.key(`tag:${tag}`))
    }
  }

  // Cache-aside pattern
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = await this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    const fresh = await fetcher()
    await this.set(key, fresh, options)
    return fresh
  }
}

export const cache = new CacheService()

// Usage examples
// cache.getOrSet(`user:${userId}`, () => fetchUser(userId), { ttl: 300, tags: ['users'] })
// cache.invalidateTag('users')
```

### API Response Caching

```typescript
// lib/cache/api-cache.ts
import { NextRequest, NextResponse } from 'next/server'
import { cache } from './redis-cache'

interface CacheConfig {
  ttl: number
  staleWhileRevalidate?: number
  tags?: string[]
}

export function withCache(
  handler: (req: NextRequest) => Promise<NextResponse>,
  config: CacheConfig
) {
  return async (req: NextRequest) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return handler(req)
    }

    const cacheKey = `api:${req.url}`

    // Check cache
    const cached = await cache.get<{ data: any; timestamp: number }>(cacheKey)

    if (cached) {
      const age = (Date.now() - cached.timestamp) / 1000
      const isStale = age > config.ttl

      // Return cached response with cache headers
      const response = NextResponse.json(cached.data)
      response.headers.set('X-Cache', isStale ? 'STALE' : 'HIT')
      response.headers.set('Cache-Control', `max-age=${config.ttl}, stale-while-revalidate=${config.staleWhileRevalidate || 60}`)

      // Revalidate in background if stale
      if (isStale && config.staleWhileRevalidate) {
        revalidateInBackground(handler, req, cacheKey, config)
      }

      return response
    }

    // Cache miss - fetch fresh data
    const response = await handler(req)
    const data = await response.clone().json()

    // Store in cache
    await cache.set(
      cacheKey,
      { data, timestamp: Date.now() },
      { ttl: config.ttl + (config.staleWhileRevalidate || 0), tags: config.tags }
    )

    const newResponse = NextResponse.json(data)
    newResponse.headers.set('X-Cache', 'MISS')
    return newResponse
  }
}

async function revalidateInBackground(
  handler: (req: NextRequest) => Promise<NextResponse>,
  req: NextRequest,
  cacheKey: string,
  config: CacheConfig
) {
  try {
    const response = await handler(req)
    const data = await response.json()
    await cache.set(
      cacheKey,
      { data, timestamp: Date.now() },
      { ttl: config.ttl + (config.staleWhileRevalidate || 0), tags: config.tags }
    )
  } catch (error) {
    console.error('Background revalidation failed:', error)
  }
}
```

### Rate Limiting

```typescript
// lib/rate-limit/rate-limiter.ts
import { Redis } from 'ioredis'
import { NextRequest } from 'next/server'

const redis = new Redis(process.env.REDIS_URL!)

interface RateLimitConfig {
  limit: number
  window: string // '1m', '1h', '1d'
  keyPrefix?: string
}

interface RateLimitResult {
  success: boolean
  remaining: number
  reset: number
}

function parseWindow(window: string): number {
  const match = window.match(/^(\d+)([smhd])$/)
  if (!match) throw new Error('Invalid window format')

  const [, value, unit] = match
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  }

  return parseInt(value) * multipliers[unit]
}

export async function rateLimit(
  req: NextRequest,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const { limit, window, keyPrefix = 'ratelimit' } = config

  // Get identifier (IP or user ID)
  const identifier =
    req.headers.get('x-forwarded-for')?.split(',')[0] ||
    req.headers.get('x-real-ip') ||
    'anonymous'

  const windowSeconds = parseWindow(window)
  const key = `${keyPrefix}:${identifier}:${Math.floor(Date.now() / (windowSeconds * 1000))}`

  // Increment counter using Lua script for atomicity
  const script = `
    local current = redis.call('incr', KEYS[1])
    if current == 1 then
      redis.call('expire', KEYS[1], ARGV[1])
    end
    return current
  `

  const current = await redis.eval(script, 1, key, windowSeconds) as number

  const remaining = Math.max(0, limit - current)
  const reset = Math.ceil(Date.now() / 1000) + windowSeconds

  return {
    success: current <= limit,
    remaining,
    reset,
  }
}

// Middleware wrapper
export function withRateLimit(config: RateLimitConfig) {
  return async (req: NextRequest) => {
    const result = await rateLimit(req, config)

    if (!result.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests',
          },
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': config.limit.toString(),
            'X-RateLimit-Remaining': result.remaining.toString(),
            'X-RateLimit-Reset': result.reset.toString(),
            'Retry-After': ((result.reset - Date.now() / 1000)).toString(),
          },
        }
      )
    }

    return null // Continue to handler
  }
}
```

## 6.4 Edge & CDN Optimization

### Edge Functions Configuration

```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const config = {
  matcher: [
    // API routes
    '/api/:path*',
    // Static assets
    '/images/:path*',
    // Authenticated pages
    '/dashboard/:path*',
  ],
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

  // Cache static assets
  if (request.nextUrl.pathname.startsWith('/images/')) {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  }

  // Edge-level geo-targeting
  const country = request.geo?.country || 'US'
  response.headers.set('X-User-Country', country)

  return response
}
```

### CDN Asset Optimization

```typescript
// lib/cdn/asset-optimizer.ts
interface ImageTransformOptions {
  width?: number
  height?: number
  quality?: number
  format?: 'auto' | 'webp' | 'avif' | 'jpeg' | 'png'
  fit?: 'cover' | 'contain' | 'fill'
}

export function getOptimizedImageUrl(
  originalUrl: string,
  options: ImageTransformOptions = {}
): string {
  const {
    width = 800,
    height,
    quality = 80,
    format = 'auto',
    fit = 'cover',
  } = options

  // Cloudflare Image Resizing
  if (process.env.NEXT_PUBLIC_CDN_URL) {
    const params = [
      `width=${width}`,
      height && `height=${height}`,
      `quality=${quality}`,
      `format=${format}`,
      `fit=${fit}`,
    ].filter(Boolean).join(',')

    return `${process.env.NEXT_PUBLIC_CDN_URL}/cdn-cgi/image/${params}/${originalUrl}`
  }

  // Fallback to original URL
  return originalUrl
}

// Video thumbnail generation
export function getVideoThumbnailUrl(videoUrl: string, timestamp: number = 0): string {
  // Use Cloudflare Stream or similar for video thumbnails
  const videoId = extractVideoId(videoUrl)
  return `${process.env.NEXT_PUBLIC_CDN_URL}/stream/${videoId}/thumbnails/thumbnail.jpg?time=${timestamp}s`
}
```

## 6.5 Monitoring & Observability

### Performance Monitoring Setup

```typescript
// lib/monitoring/performance.ts
import { onCLS, onFID, onLCP, onFCP, onTTFB } from 'web-vitals'

interface PerformanceMetric {
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  delta: number
  id: string
}

function sendToAnalytics(metric: PerformanceMetric) {
  // Send to your analytics service
  fetch('/api/analytics/vitals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...metric,
      url: window.location.href,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
    }),
    keepalive: true, // Ensure it sends even on page unload
  })
}

export function initPerformanceMonitoring() {
  onCLS(sendToAnalytics)
  onFID(sendToAnalytics)
  onLCP(sendToAnalytics)
  onFCP(sendToAnalytics)
  onTTFB(sendToAnalytics)
}

// Component-level performance tracking
export function measureRender(componentName: string) {
  const startTime = performance.now()

  return () => {
    const duration = performance.now() - startTime
    if (duration > 16) { // More than one frame (16ms)
      console.warn(`Slow render: ${componentName} took ${duration.toFixed(2)}ms`)

      // Log slow renders
      fetch('/api/analytics/slow-render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          component: componentName,
          duration,
          timestamp: Date.now(),
        }),
        keepalive: true,
      })
    }
  }
}
```

### Error Tracking

```typescript
// lib/monitoring/error-tracking.ts

interface ErrorContext {
  userId?: string
  url?: string
  component?: string
  action?: string
  metadata?: Record<string, any>
}

class ErrorTracker {
  private queue: Array<{ error: Error; context: ErrorContext }> = []
  private isProcessing = false

  capture(error: Error, context: ErrorContext = {}) {
    // Add to queue
    this.queue.push({ error, context })

    // Process queue
    this.processQueue()
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return
    this.isProcessing = true

    const batch = this.queue.splice(0, 10)

    try {
      await fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          errors: batch.map(({ error, context }) => ({
            message: error.message,
            stack: error.stack,
            name: error.name,
            ...context,
            timestamp: Date.now(),
            url: typeof window !== 'undefined' ? window.location.href : '',
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          })),
        }),
      })
    } catch (e) {
      console.error('Failed to send error report:', e)
    }

    this.isProcessing = false

    // Process remaining items
    if (this.queue.length > 0) {
      setTimeout(() => this.processQueue(), 1000)
    }
  }
}

export const errorTracker = new ErrorTracker()

// Global error handler
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    errorTracker.capture(event.error, {
      action: 'unhandled_error',
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    errorTracker.capture(new Error(event.reason), {
      action: 'unhandled_promise_rejection',
    })
  })
}
```

## 6.6 Build & Deploy Optimization

### Production Build Configuration

```javascript
// next.config.js (extended)
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Production optimizations
  reactStrictMode: true,
  swcMinify: true,

  // Image optimization
  images: {
    domains: ['your-cdn.com', 'res.cloudinary.com'],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  },

  // Headers
  async headers() {
    return [
      {
        source: '/:all*(svg|jpg|png|webp|avif)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ]
  },

  // Compression
  compress: true,

  // Experimental features
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns', 'lodash'],
    serverComponentsExternalPackages: ['sharp'],
  },

  // Webpack optimizations
  webpack: (config, { isServer }) => {
    // Tree shaking for lodash
    config.resolve.alias = {
      ...config.resolve.alias,
      lodash: 'lodash-es',
    }

    return config
  },
}

module.exports = withBundleAnalyzer(nextConfig)
```

### Deployment Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run type check
        run: npm run type-check

      - name: Run tests
        run: npm run test

      - name: Build
        run: npm run build
        env:
          NEXT_PUBLIC_API_URL: ${{ secrets.API_URL }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

      - name: Analyze bundle
        run: npm run analyze
        if: github.event_name == 'pull_request'

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

---

# PART 7: SECURITY & COMPLIANCE

## 7.1 Security Architecture Overview

### Security Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                      SECURITY LAYERS                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Layer 1: Edge Security (Cloudflare)                     │   │
│  │  • DDoS Protection  • WAF  • Bot Management  • SSL/TLS   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              ↓                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Layer 2: Application Security                           │   │
│  │  • Input Validation  • CSRF Protection  • XSS Prevention │   │
│  │  • Rate Limiting  • Request Signing                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              ↓                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Layer 3: Authentication & Authorization                 │   │
│  │  • JWT Tokens  • Session Management  • RBAC  • MFA       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              ↓                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Layer 4: Data Security                                  │   │
│  │  • Encryption at Rest  • Encryption in Transit           │   │
│  │  • Key Management  • Data Masking                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              ↓                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Layer 5: Infrastructure Security                        │   │
│  │  • Network Isolation  • Secrets Management  • Audit Logs │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 7.2 Authentication System

### Secure Password Handling

```typescript
// lib/auth/password.ts
import { hash, verify } from '@node-rs/argon2'

// Argon2id configuration (OWASP recommended)
const ARGON2_CONFIG = {
  memoryCost: 65536,     // 64 MB
  timeCost: 3,           // 3 iterations
  parallelism: 4,        // 4 parallel threads
  outputLen: 32,         // 256-bit hash
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, {
    ...ARGON2_CONFIG,
    secret: Buffer.from(process.env.PASSWORD_PEPPER!),
  })
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  try {
    return await verify(hashedPassword, password, {
      secret: Buffer.from(process.env.PASSWORD_PEPPER!),
    })
  } catch {
    return false
  }
}

// Password strength validation
export function validatePasswordStrength(password: string): {
  valid: boolean
  score: number
  feedback: string[]
} {
  const feedback: string[] = []
  let score = 0

  // Length check
  if (password.length >= 12) score += 2
  else if (password.length >= 8) score += 1
  else feedback.push('Password should be at least 8 characters')

  // Character variety
  if (/[a-z]/.test(password)) score += 1
  else feedback.push('Include lowercase letters')

  if (/[A-Z]/.test(password)) score += 1
  else feedback.push('Include uppercase letters')

  if (/[0-9]/.test(password)) score += 1
  else feedback.push('Include numbers')

  if (/[^a-zA-Z0-9]/.test(password)) score += 1
  else feedback.push('Include special characters')

  // Common password check (simplified)
  const commonPasswords = ['password', '123456', 'qwerty']
  if (commonPasswords.some(p => password.toLowerCase().includes(p))) {
    score = 0
    feedback.push('Password is too common')
  }

  return {
    valid: score >= 4 && password.length >= 8,
    score,
    feedback,
  }
}
```

### JWT Token Management

```typescript
// lib/auth/tokens.ts
import { SignJWT, jwtVerify, JWTPayload } from 'jose'
import { nanoid } from 'nanoid'

const ACCESS_TOKEN_SECRET = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!)
const REFRESH_TOKEN_SECRET = new TextEncoder().encode(process.env.JWT_REFRESH_SECRET!)

interface TokenPayload extends JWTPayload {
  userId: string
  sessionId: string
  type: 'access' | 'refresh'
}

export async function generateAccessToken(userId: string, sessionId: string): Promise<string> {
  return new SignJWT({
    userId,
    sessionId,
    type: 'access',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m') // Short-lived
    .setJti(nanoid())
    .sign(ACCESS_TOKEN_SECRET)
}

export async function generateRefreshToken(userId: string, sessionId: string): Promise<string> {
  return new SignJWT({
    userId,
    sessionId,
    type: 'refresh',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d') // Longer-lived
    .setJti(nanoid())
    .sign(REFRESH_TOKEN_SECRET)
}

export async function verifyAccessToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, ACCESS_TOKEN_SECRET)
    return payload as TokenPayload
  } catch {
    return null
  }
}

export async function verifyRefreshToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, REFRESH_TOKEN_SECRET)
    return payload as TokenPayload
  } catch {
    return null
  }
}

// Token rotation on refresh
export async function rotateTokens(userId: string, oldSessionId: string): Promise<{
  accessToken: string
  refreshToken: string
  sessionId: string
}> {
  // Generate new session ID for rotation
  const sessionId = nanoid()

  const [accessToken, refreshToken] = await Promise.all([
    generateAccessToken(userId, sessionId),
    generateRefreshToken(userId, sessionId),
  ])

  return { accessToken, refreshToken, sessionId }
}
```

### Session Security

```typescript
// lib/auth/session.ts
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db/client'
import { cache } from '@/lib/cache/redis-cache'
import { verifyAccessToken, rotateTokens } from './tokens'
import { nanoid } from 'nanoid'

interface Session {
  userId: string
  sessionId: string
  user: {
    id: string
    email: string
    name: string
    plan: string
  }
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = cookies()
  const accessToken = cookieStore.get('access_token')?.value

  if (!accessToken) return null

  // Verify token
  const payload = await verifyAccessToken(accessToken)
  if (!payload) return null

  // Check session in cache first
  const cachedSession = await cache.get<Session>(`session:${payload.sessionId}`)
  if (cachedSession) {
    return cachedSession
  }

  // Verify session in database
  const dbSession = await prisma.session.findUnique({
    where: { id: payload.sessionId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          plan: true,
        },
      },
    },
  })

  if (!dbSession || dbSession.expiresAt < new Date()) {
    return null
  }

  // Cache session
  const session: Session = {
    userId: payload.userId,
    sessionId: payload.sessionId,
    user: dbSession.user,
  }

  await cache.set(`session:${payload.sessionId}`, session, { ttl: 300 })

  return session
}

export async function createSession(userId: string, userAgent: string, ipAddress: string) {
  const sessionId = nanoid()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  await prisma.session.create({
    data: {
      id: sessionId,
      userId,
      token: nanoid(64),
      userAgent,
      ipAddress,
      expiresAt,
    },
  })

  return sessionId
}

export async function invalidateSession(sessionId: string) {
  await Promise.all([
    prisma.session.delete({ where: { id: sessionId } }),
    cache.delete(`session:${sessionId}`),
  ])
}

// Invalidate all sessions for a user (e.g., password change)
export async function invalidateAllUserSessions(userId: string) {
  const sessions = await prisma.session.findMany({
    where: { userId },
    select: { id: true },
  })

  await Promise.all([
    prisma.session.deleteMany({ where: { userId } }),
    ...sessions.map(s => cache.delete(`session:${s.id}`)),
  ])
}
```

## 7.3 Input Validation & Sanitization

### Validation Schema Library

```typescript
// lib/validation/schemas.ts
import { z } from 'zod'
import DOMPurify from 'isomorphic-dompurify'

// Custom sanitization transform
const sanitizeHtml = (html: string) => DOMPurify.sanitize(html, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
})

// Reusable validation patterns
const patterns = {
  username: /^[a-zA-Z0-9_]{3,30}$/,
  slug: /^[a-z0-9-]{3,100}$/,
  phone: /^\+?[1-9]\d{1,14}$/,
}

// Common field validators
export const email = z.string()
  .email('Invalid email address')
  .max(255)
  .toLowerCase()
  .trim()

export const password = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long')
  .refine(
    (val) => /[a-z]/.test(val) && /[A-Z]/.test(val) && /[0-9]/.test(val),
    'Password must contain lowercase, uppercase, and numbers'
  )

export const username = z.string()
  .min(3)
  .max(30)
  .regex(patterns.username, 'Username can only contain letters, numbers, and underscores')
  .toLowerCase()

// API Request Schemas
export const registerSchema = z.object({
  email,
  password,
  name: z.string().min(2).max(100).trim(),
  username,
})

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional().default(false),
})

export const createPostSchema = z.object({
  caption: z.string()
    .max(2000)
    .optional()
    .transform(val => val ? sanitizeHtml(val) : val),
  hashtags: z.array(z.string().max(50)).max(30).optional(),
  mediaUrl: z.string().url().optional(),
  mediaType: z.enum(['IMAGE', 'VIDEO', 'CAROUSEL']).optional(),
  scheduledAt: z.string().datetime().optional(),
})

export const createCampaignSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['EMAIL', 'SMS']),
  subject: z.string().max(200).optional(),
  content: z.string()
    .max(50000)
    .transform(val => sanitizeHtml(val)),
  contactListId: z.string().cuid().optional(),
  scheduledAt: z.string().datetime().optional(),
})

// Request validation middleware
export function validateRequest<T extends z.ZodSchema>(schema: T) {
  return async (data: unknown): Promise<z.infer<T>> => {
    const result = schema.safeParse(data)

    if (!result.success) {
      const errors = result.error.flatten()
      throw new ValidationError('Validation failed', errors.fieldErrors)
    }

    return result.data
  }
}

class ValidationError extends Error {
  constructor(
    message: string,
    public details: Record<string, string[]>
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}
```

### SQL Injection Prevention

```typescript
// lib/db/safe-queries.ts
import { prisma } from './client'
import { Prisma } from '@prisma/client'

// Always use parameterized queries with Prisma
// NEVER use string interpolation for user input

// SAFE: Using Prisma's type-safe query builder
export async function searchPosts(query: string, userId: string) {
  return prisma.post.findMany({
    where: {
      AND: [
        {
          OR: [
            { caption: { contains: query, mode: 'insensitive' } },
            { hashtags: { has: query.toLowerCase() } },
          ],
        },
        { status: 'PUBLISHED' },
        { deletedAt: null },
      ],
    },
  })
}

// SAFE: Parameterized raw query when needed
export async function fullTextSearch(query: string) {
  // Prisma's $queryRaw with template literals is parameterized
  return prisma.$queryRaw<any[]>`
    SELECT id, caption, ts_rank(search_vector, plainto_tsquery('english', ${query})) as rank
    FROM "Post"
    WHERE search_vector @@ plainto_tsquery('english', ${query})
    ORDER BY rank DESC
    LIMIT 50
  `
}

// UNSAFE EXAMPLE - NEVER DO THIS:
// const unsafeQuery = `SELECT * FROM users WHERE name = '${userInput}'`

// For dynamic column names (rare cases), use allowlist
const ALLOWED_SORT_COLUMNS = ['createdAt', 'likeCount', 'commentCount'] as const
type SortColumn = typeof ALLOWED_SORT_COLUMNS[number]

export async function getSortedPosts(sortBy: string, order: 'asc' | 'desc') {
  // Validate against allowlist
  if (!ALLOWED_SORT_COLUMNS.includes(sortBy as SortColumn)) {
    throw new Error('Invalid sort column')
  }

  return prisma.post.findMany({
    orderBy: { [sortBy]: order },
  })
}
```

## 7.4 CSRF Protection

```typescript
// lib/security/csrf.ts
import { randomBytes, createHmac } from 'crypto'
import { cookies } from 'next/headers'

const CSRF_SECRET = process.env.CSRF_SECRET!
const CSRF_TOKEN_EXPIRY = 60 * 60 * 1000 // 1 hour

export function generateCSRFToken(): string {
  const timestamp = Date.now().toString()
  const randomPart = randomBytes(32).toString('hex')
  const data = `${timestamp}.${randomPart}`

  const signature = createHmac('sha256', CSRF_SECRET)
    .update(data)
    .digest('hex')

  return `${data}.${signature}`
}

export function validateCSRFToken(token: string): boolean {
  try {
    const [timestamp, randomPart, signature] = token.split('.')

    // Check expiry
    const tokenTime = parseInt(timestamp)
    if (Date.now() - tokenTime > CSRF_TOKEN_EXPIRY) {
      return false
    }

    // Verify signature
    const expectedSignature = createHmac('sha256', CSRF_SECRET)
      .update(`${timestamp}.${randomPart}`)
      .digest('hex')

    // Constant-time comparison to prevent timing attacks
    return timingSafeEqual(signature, expectedSignature)
  } catch {
    return false
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

// Middleware for CSRF validation
export async function csrfMiddleware(request: Request): Promise<Response | null> {
  // Skip for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return null
  }

  const cookieStore = cookies()
  const csrfCookie = cookieStore.get('csrf_token')?.value
  const csrfHeader = request.headers.get('X-CSRF-Token')

  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return new Response(
      JSON.stringify({ error: 'Invalid CSRF token' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (!validateCSRFToken(csrfHeader)) {
    return new Response(
      JSON.stringify({ error: 'CSRF token expired' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    )
  }

  return null // Continue to handler
}
```

## 7.5 Data Encryption

### Encryption Service

```typescript
// lib/security/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!
const ALGORITHM = 'aes-256-gcm'

// Derive key from master key
const derivedKey = scryptSync(ENCRYPTION_KEY, 'flowsmartly-salt', 32)

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12) // 96-bit IV for GCM
  const cipher = createCipheriv(ALGORITHM, derivedKey, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

export function decrypt(ciphertext: string): string {
  const [ivHex, authTagHex, encrypted] = ciphertext.split(':')

  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')

  const decipher = createDecipheriv(ALGORITHM, derivedKey, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

// For sensitive fields in database
export function encryptField(value: string): string {
  if (!value) return value
  return encrypt(value)
}

export function decryptField(encryptedValue: string): string {
  if (!encryptedValue) return encryptedValue
  try {
    return decrypt(encryptedValue)
  } catch {
    console.error('Failed to decrypt field')
    return ''
  }
}

// Hash sensitive data for lookup (e.g., finding by bank account)
export function hashForLookup(value: string): string {
  return scryptSync(value, ENCRYPTION_KEY, 32).toString('hex')
}
```

### Secure Storage for Sensitive Data

```typescript
// lib/security/sensitive-data.ts
import { encryptField, decryptField, hashForLookup } from './encryption'
import { prisma } from '@/lib/db/client'

interface BankAccount {
  accountNumber: string
  routingNumber: string
  accountHolderName: string
}

export async function storeBankAccount(userId: string, bankAccount: BankAccount) {
  // Encrypt sensitive fields
  const encryptedData = {
    accountNumberEncrypted: encryptField(bankAccount.accountNumber),
    routingNumberEncrypted: encryptField(bankAccount.routingNumber),
    accountHolderNameEncrypted: encryptField(bankAccount.accountHolderName),
    // Hash for lookup without revealing data
    accountNumberHash: hashForLookup(bankAccount.accountNumber),
    // Store last 4 digits for display
    accountNumberLast4: bankAccount.accountNumber.slice(-4),
  }

  await prisma.payoutMethod.upsert({
    where: { userId },
    update: encryptedData,
    create: {
      userId,
      method: 'BANK_TRANSFER',
      ...encryptedData,
    },
  })
}

export async function getBankAccount(userId: string): Promise<BankAccount | null> {
  const record = await prisma.payoutMethod.findUnique({
    where: { userId },
  })

  if (!record) return null

  // Decrypt for authorized access
  return {
    accountNumber: decryptField(record.accountNumberEncrypted),
    routingNumber: decryptField(record.routingNumberEncrypted),
    accountHolderName: decryptField(record.accountHolderNameEncrypted),
  }
}
```

## 7.6 Content Security Policy

```typescript
// middleware.ts (CSP headers)
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https: ",
    "media-src 'self' blob: https:",
    "connect-src 'self' https://api.anthropic.com wss:",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ')

  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

  // HSTS (only in production)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    )
  }

  return response
}
```

## 7.7 Compliance

### GDPR Compliance

```typescript
// lib/compliance/gdpr.ts
import { prisma } from '@/lib/db/client'
import { createHash } from 'crypto'

// User data export (GDPR Article 20 - Data Portability)
export async function exportUserData(userId: string) {
  const [user, posts, campaigns, earnings, contacts] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        name: true,
        username: true,
        bio: true,
        website: true,
        createdAt: true,
        plan: true,
      },
    }),
    prisma.post.findMany({
      where: { userId },
      select: {
        caption: true,
        hashtags: true,
        mediaUrl: true,
        createdAt: true,
        likeCount: true,
        commentCount: true,
      },
    }),
    prisma.campaign.findMany({
      where: { userId },
      select: {
        name: true,
        type: true,
        subject: true,
        sentCount: true,
        createdAt: true,
      },
    }),
    prisma.earning.findMany({
      where: { userId },
      select: {
        amountCents: true,
        source: true,
        createdAt: true,
      },
    }),
    prisma.contact.findMany({
      where: { userId },
      select: {
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        tags: true,
        createdAt: true,
      },
    }),
  ])

  return {
    exportedAt: new Date().toISOString(),
    user,
    posts,
    campaigns,
    earnings,
    contacts,
  }
}

// User data deletion (GDPR Article 17 - Right to Erasure)
export async function deleteUserData(userId: string, hardDelete: boolean = false) {
  if (hardDelete) {
    // Complete deletion - use with caution
    await prisma.$transaction([
      prisma.earning.deleteMany({ where: { userId } }),
      prisma.postView.deleteMany({ where: { viewerUserId: userId } }),
      prisma.campaignSend.deleteMany({ where: { contact: { userId } } }),
      prisma.contact.deleteMany({ where: { userId } }),
      prisma.campaign.deleteMany({ where: { userId } }),
      prisma.comment.deleteMany({ where: { userId } }),
      prisma.like.deleteMany({ where: { userId } }),
      prisma.bookmark.deleteMany({ where: { userId } }),
      prisma.follow.deleteMany({
        where: { OR: [{ followerId: userId }, { followingId: userId }] },
      }),
      prisma.post.deleteMany({ where: { userId } }),
      prisma.session.deleteMany({ where: { userId } }),
      prisma.notification.deleteMany({ where: { userId } }),
      prisma.user.delete({ where: { id: userId } }),
    ])
  } else {
    // Soft delete - anonymize data
    const anonymizedEmail = `deleted-${createHash('sha256').update(userId).digest('hex').slice(0, 8)}@deleted.local`

    await prisma.user.update({
      where: { id: userId },
      data: {
        email: anonymizedEmail,
        name: 'Deleted User',
        username: `deleted_${userId.slice(0, 8)}`,
        passwordHash: '',
        avatarUrl: null,
        bio: null,
        website: null,
        deletedAt: new Date(),
      },
    })
  }
}

// Consent management
export async function updateConsent(userId: string, consents: {
  marketing?: boolean
  analytics?: boolean
  thirdParty?: boolean
}) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      notificationPrefs: {
        ...consents,
        updatedAt: new Date().toISOString(),
      },
    },
  })

  // Log consent change for audit
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'CONSENT_UPDATED',
      metadata: consents,
    },
  })
}
```

### TCPA Compliance (SMS Marketing)

```typescript
// lib/compliance/tcpa.ts
import { prisma } from '@/lib/db/client'

// Verify opt-in before sending SMS
export async function verifySMSConsent(contactId: string): Promise<boolean> {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: {
      smsOptedIn: true,
      smsOptedInAt: true,
      phone: true,
      status: true,
    },
  })

  if (!contact) return false
  if (!contact.smsOptedIn) return false
  if (contact.status === 'UNSUBSCRIBED') return false
  if (!contact.phone) return false

  return true
}

// Add required opt-out text to SMS
export function addOptOutText(message: string, businessName: string): string {
  const optOutText = `\n\nReply STOP to unsubscribe. Msg&data rates may apply.`

  // Ensure total length doesn't exceed SMS limits
  const maxMessageLength = 160 - optOutText.length
  const truncatedMessage = message.length > maxMessageLength
    ? message.slice(0, maxMessageLength - 3) + '...'
    : message

  return truncatedMessage + optOutText
}

// Process opt-out requests
export async function processOptOut(phone: string) {
  await prisma.contact.updateMany({
    where: { phone },
    data: {
      smsOptedIn: false,
      status: 'UNSUBSCRIBED',
      unsubscribedAt: new Date(),
    },
  })
}

// Record consent with proper documentation
export async function recordSMSConsent(contactId: string, method: string) {
  await prisma.contact.update({
    where: { id: contactId },
    data: {
      smsOptedIn: true,
      smsOptedInAt: new Date(),
    },
  })

  // Audit log for compliance
  await prisma.auditLog.create({
    data: {
      action: 'SMS_CONSENT_RECORDED',
      metadata: {
        contactId,
        method, // 'web_form', 'keyword', 'verbal', etc.
        timestamp: new Date().toISOString(),
      },
    },
  })
}
```

## 7.8 Audit Logging

```typescript
// lib/security/audit.ts
import { prisma } from '@/lib/db/client'

type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'LOGIN_FAILED'
  | 'PASSWORD_CHANGED'
  | 'EMAIL_CHANGED'
  | 'ACCOUNT_DELETED'
  | 'PAYOUT_REQUESTED'
  | 'CAMPAIGN_SENT'
  | 'POST_CREATED'
  | 'POST_DELETED'
  | 'ADMIN_ACTION'

interface AuditLogEntry {
  userId?: string
  action: AuditAction
  resourceType?: string
  resourceId?: string
  metadata?: Record<string, any>
  ipAddress?: string
  userAgent?: string
}

export async function logAuditEvent(entry: AuditLogEntry) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        metadata: entry.metadata || {},
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        createdAt: new Date(),
      },
    })
  } catch (error) {
    // Don't fail the main operation if audit logging fails
    console.error('Audit log failed:', error)
  }
}

// Wrapper for API handlers with automatic audit logging
export function withAuditLog(action: AuditAction) {
  return (handler: Function) => {
    return async (req: Request, context: any) => {
      const startTime = Date.now()

      try {
        const result = await handler(req, context)

        // Log successful action
        await logAuditEvent({
          action,
          ipAddress: req.headers.get('x-forwarded-for') || undefined,
          userAgent: req.headers.get('user-agent') || undefined,
          metadata: {
            duration: Date.now() - startTime,
            status: 'success',
          },
        })

        return result
      } catch (error) {
        // Log failed action
        await logAuditEvent({
          action,
          ipAddress: req.headers.get('x-forwarded-for') || undefined,
          userAgent: req.headers.get('user-agent') || undefined,
          metadata: {
            duration: Date.now() - startTime,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        })

        throw error
      }
    }
  }
}
```

---

# PART 8: DEVELOPMENT PHASES & TIMELINE

## 8.1 Project Overview

### Development Approach

| Aspect | Strategy |
|--------|----------|
| **Methodology** | Agile Scrum with 2-week sprints |
| **Team Size** | 4-6 developers (scalable) |
| **Version Control** | Git with trunk-based development |
| **CI/CD** | GitHub Actions + Vercel |
| **Testing** | TDD for critical paths, E2E for flows |
| **Documentation** | Inline docs + Storybook + API docs |

### Technology Stack Summary

```
Frontend:      Next.js 14+ | React 18 | TypeScript | Tailwind CSS | shadcn/ui
State:         Zustand | React Query
Animation:     Framer Motion
Backend:       Next.js API Routes | Node.js
Database:      PostgreSQL | Prisma ORM | Redis
AI:            Claude API (Anthropic)
Email:         SendGrid
SMS:           Twilio
Payments:      Stripe
Storage:       Cloudflare R2
Hosting:       Vercel (Edge)
Monitoring:    Vercel Analytics | Sentry
```

## 8.2 Phase 1: Foundation (Weeks 1-4)

### Week 1: Project Setup & Core Infrastructure

#### Tasks
- [ ] Initialize Next.js project with TypeScript
- [ ] Set up Tailwind CSS with custom design tokens
- [ ] Configure ESLint, Prettier, Husky
- [ ] Set up PostgreSQL + Prisma
- [ ] Configure Redis for caching
- [ ] Set up Vercel project with environment variables
- [ ] Create CI/CD pipeline with GitHub Actions
- [ ] Set up error tracking (Sentry)

#### Deliverables
```
flowsmartly/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx (landing)
│   │   └── globals.css
│   ├── components/ui/ (basic components)
│   └── lib/
│       ├── db/client.ts
│       └── utils/cn.ts
├── prisma/schema.prisma (initial)
└── config files
```

### Week 2: Authentication System

#### Tasks
- [ ] Implement User model in Prisma
- [ ] Build registration flow with email verification
- [ ] Build login/logout with JWT tokens
- [ ] Implement password reset flow
- [ ] Add session management with Redis
- [ ] Create protected route middleware
- [ ] Build auth UI components (forms, modals)
- [ ] Add social login prep (OAuth structure)

#### Key Components
```typescript
// Components to build
- LoginForm
- RegisterForm
- ForgotPasswordForm
- ResetPasswordForm
- AuthProvider (context)
- ProtectedRoute (wrapper)
```

### Week 3: Design System & Core UI

#### Tasks
- [ ] Implement full design token system
- [ ] Build all atomic components (Button, Input, Card, etc.)
- [ ] Create layout components (Sidebar, Header, MobileNav)
- [ ] Implement dark/light theme with persistence
- [ ] Set up Storybook for component documentation
- [ ] Build responsive grid system
- [ ] Create loading skeletons
- [ ] Implement toast notification system

#### Component Checklist
| Component | Variants | States |
|-----------|----------|--------|
| Button | 6 variants, 5 sizes | loading, disabled |
| Input | text, email, password | error, success, disabled |
| Card | default, elevated, interactive | hover, active |
| Modal | sizes: sm, md, lg, full | animated transitions |
| Dropdown | single, multi-select | searchable |
| Avatar | sizes, fallback | loading |
| Badge | colors, sizes | - |
| Tabs | default, pills | - |
| Toast | success, error, warning, info | auto-dismiss |

### Week 4: Dashboard Layout & Navigation

#### Tasks
- [ ] Build dashboard shell layout
- [ ] Implement collapsible sidebar
- [ ] Create breadcrumb navigation
- [ ] Build command palette (Cmd+K)
- [ ] Add keyboard shortcuts system
- [ ] Implement user dropdown menu
- [ ] Create settings page structure
- [ ] Build notification center UI

#### Pages Structure
```
/dashboard
├── /page.tsx (overview)
├── /studio (content creation)
├── /feed (FlowSocial)
├── /campaigns (email/sms)
├── /ads (paid ads)
├── /analytics
├── /earnings
└── /settings
    ├── /profile
    ├── /billing
    ├── /team
    └── /notifications
```

---

## 8.3 Phase 2: Core Features (Weeks 5-8)

### Week 5: AI Integration & Content Studio

#### Tasks
- [ ] Set up Claude API client with error handling
- [ ] Implement AI usage tracking system
- [ ] Build content generation service
- [ ] Create prompt templates library
- [ ] Build Content Studio UI
  - [ ] Platform selector
  - [ ] Tone/style controls
  - [ ] Generated content preview
  - [ ] Edit & refine interface
- [ ] Add content history/drafts
- [ ] Implement AI credit system

#### AI Features
```typescript
// Content types to support
- Social posts (Instagram, Twitter, LinkedIn, Facebook, TikTok)
- Ad copy with variations
- Email subject lines & body
- SMS messages
- Hashtag generation
- Content improvement suggestions
```

### Week 6: FlowSocial Feed

#### Tasks
- [ ] Build Post model and relationships
- [ ] Implement post creation flow
- [ ] Create media upload pipeline (R2)
- [ ] Build feed with infinite scroll
- [ ] Implement virtual list for performance
- [ ] Add like/unlike with optimistic updates
- [ ] Build comment system (nested)
- [ ] Create post detail modal
- [ ] Implement share tracking

#### Feed Features
| Feature | Description |
|---------|-------------|
| Create Post | Text, image, video, carousel |
| Feed Types | Following, Discover, Trending |
| Interactions | Like, Comment, Share, Bookmark |
| Media | Image upload, video upload, thumbnails |

### Week 7: Share Hub Implementation

#### Tasks
- [ ] Research Web Share API capabilities
- [ ] Build Share Hub modal UI
- [ ] Implement platform-specific share dialogs
- [ ] Create deep links for mobile apps
- [ ] Add share tracking and analytics
- [ ] Build share preview generator
- [ ] Implement QR code generation
- [ ] Add copy link functionality

#### Supported Platforms
```
Priority 1: Facebook, Instagram, Twitter/X, LinkedIn
Priority 2: TikTok, Pinterest, WhatsApp, Telegram
Priority 3: Reddit, Discord, Snapchat
```

### Week 8: User Profiles & Social Graph

#### Tasks
- [ ] Build user profile page
- [ ] Implement follow/unfollow system
- [ ] Create followers/following lists
- [ ] Add profile editing
- [ ] Build user search functionality
- [ ] Implement @mentions in posts
- [ ] Create activity feed
- [ ] Add profile analytics preview

---

## 8.4 Phase 3: Marketing Tools (Weeks 9-12)

### Week 9: Contact Management

#### Tasks
- [ ] Build Contact model and list management
- [ ] Create contact import (CSV, copy-paste)
- [ ] Implement contact list CRUD
- [ ] Build segmentation rules engine
- [ ] Create tag management system
- [ ] Add contact search and filters
- [ ] Implement consent tracking
- [ ] Build contact detail view

#### Contact Features
| Feature | Details |
|---------|---------|
| Import | CSV, manual, API sync |
| Fields | Email, phone, name, custom fields |
| Lists | Multiple lists per contact |
| Segments | Rule-based dynamic segments |
| Tags | Unlimited custom tags |

### Week 10: Email Campaign Builder

#### Tasks
- [ ] Integrate SendGrid API
- [ ] Build email template system
- [ ] Create drag-and-drop email editor
- [ ] Implement AI email content generation
- [ ] Build campaign creation workflow
- [ ] Add scheduling system
- [ ] Implement send preview/test
- [ ] Create campaign analytics

#### Email Features
```
Templates: Newsletter, Promotional, Welcome, Transactional
Editor: Drag-and-drop blocks, mobile preview, code view
Personalization: {{first_name}}, {{custom_field}}
Analytics: Opens, clicks, bounces, unsubscribes
```

### Week 11: SMS Campaign System

#### Tasks
- [ ] Integrate Twilio API
- [ ] Build SMS composer with character count
- [ ] Implement MMS support
- [ ] Add TCPA compliance features
- [ ] Create opt-in/opt-out management
- [ ] Build SMS campaign workflow
- [ ] Implement delivery tracking
- [ ] Create SMS analytics

### Week 12: Campaign Automation

#### Tasks
- [ ] Design automation workflow engine
- [ ] Build visual automation builder
- [ ] Implement trigger system (signup, purchase, date)
- [ ] Create condition nodes (if/else)
- [ ] Add delay/wait nodes
- [ ] Implement action nodes (send email, SMS)
- [ ] Build automation analytics
- [ ] Create automation templates

---

## 8.5 Phase 4: Monetization (Weeks 13-16)

### Week 13: Paid Ads System

#### Tasks
- [ ] Build AdCampaign model
- [ ] Create ad creation workflow
- [ ] Implement targeting options
- [ ] Build budget management
- [ ] Create ad review/approval system
- [ ] Implement ad serving algorithm
- [ ] Add promoted post indicators
- [ ] Build advertiser dashboard

#### Ad Features
```
Objectives: Awareness, Engagement, Traffic, Conversions
Targeting: Demographics, Interests, Location, Behavior
Formats: Image, Video, Carousel
Pricing: CPV (Cost per View)
```

### Week 14: View-to-Earn System

#### Tasks
- [ ] Implement view tracking system
- [ ] Build unique view verification
- [ ] Create earning calculation engine
- [ ] Implement anti-fraud measures
- [ ] Build earnings dashboard
- [ ] Create balance management
- [ ] Add earnings history
- [ ] Implement daily earning limits

#### Fraud Prevention
| Measure | Implementation |
|---------|----------------|
| Unique Views | One earning per post per user |
| View Duration | Minimum 3 seconds |
| Rate Limiting | Max views per hour |
| Device Fingerprinting | Prevent multi-account abuse |
| Behavior Analysis | Detect bot patterns |

### Week 15: Payments & Payouts

#### Tasks
- [ ] Integrate Stripe for subscriptions
- [ ] Build subscription management UI
- [ ] Implement plan upgrade/downgrade
- [ ] Create payout request system
- [ ] Integrate payout providers (PayPal, Stripe)
- [ ] Build payout approval workflow
- [ ] Implement tax documentation
- [ ] Create billing history

#### Subscription Features
```
Plans: Starter ($29), Pro ($59), Business ($99), Enterprise (custom)
Billing: Monthly, Annual (20% discount)
Features: Credits, limits, team members
Upgrades: Pro-rated, immediate access
```

### Week 16: Analytics Dashboard

#### Tasks
- [ ] Build analytics data pipeline
- [ ] Create overview dashboard
- [ ] Implement post analytics
- [ ] Build audience insights
- [ ] Create engagement analytics
- [ ] Add campaign performance
- [ ] Implement AI-powered insights
- [ ] Build export functionality

---

## 8.6 Phase 5: Polish & Launch (Weeks 17-20)

### Week 17: Performance Optimization

#### Tasks
- [ ] Run Lighthouse audits
- [ ] Optimize bundle size
- [ ] Implement lazy loading
- [ ] Add image optimization
- [ ] Configure CDN caching
- [ ] Optimize database queries
- [ ] Implement Redis caching
- [ ] Add performance monitoring

#### Performance Targets
| Metric | Target |
|--------|--------|
| Lighthouse Score | > 90 |
| FCP | < 1.5s |
| LCP | < 2.5s |
| TTI | < 3.5s |
| Bundle Size | < 200KB (initial) |

### Week 18: Security Audit & Hardening

#### Tasks
- [ ] Conduct security code review
- [ ] Run automated security scans
- [ ] Penetration testing
- [ ] Fix identified vulnerabilities
- [ ] Implement rate limiting everywhere
- [ ] Add security headers
- [ ] Review authentication flows
- [ ] Audit third-party dependencies

### Week 19: Testing & QA

#### Tasks
- [ ] Write unit tests for core logic
- [ ] Create integration tests for APIs
- [ ] Build E2E tests for critical flows
- [ ] Perform cross-browser testing
- [ ] Mobile responsiveness testing
- [ ] Load testing
- [ ] User acceptance testing
- [ ] Fix bugs and edge cases

#### Test Coverage Goals
```
Unit Tests: > 80% coverage on business logic
Integration: All API endpoints
E2E: 10 critical user flows
```

### Week 20: Launch Preparation

#### Tasks
- [ ] Finalize documentation
- [ ] Create onboarding flow
- [ ] Build help center content
- [ ] Set up customer support
- [ ] Configure monitoring alerts
- [ ] Prepare launch marketing
- [ ] Beta testing with 50 users
- [ ] Final bug fixes
- [ ] Production deployment
- [ ] Launch! 🚀

---

## 8.7 Post-Launch Roadmap

### Month 2-3: Growth & Iteration
- Mobile app (React Native)
- Advanced analytics
- Team collaboration features
- API for developers
- Webhook integrations

### Month 4-6: Expansion
- White-label solution
- Agency dashboard
- Advanced automation
- AI content scheduling
- Multi-language support

### Month 6-12: Scale
- Enterprise features
- Custom integrations
- Advanced reporting
- SLA guarantees
- Dedicated support

---

## 8.8 Resource Requirements

### Team Structure

| Role | Count | Responsibilities |
|------|-------|------------------|
| **Full-Stack Developer** | 2-3 | Feature development, API, database |
| **Frontend Developer** | 1-2 | UI/UX implementation, animations |
| **DevOps Engineer** | 0.5 | Infrastructure, CI/CD, monitoring |
| **QA Engineer** | 0.5 | Testing, quality assurance |
| **Product Designer** | 0.5 | UI design, user research |

### Infrastructure Costs (Estimated Monthly)

| Service | Tier | Cost |
|---------|------|------|
| Vercel | Pro | $20-100 |
| PostgreSQL (Neon/Supabase) | Pro | $25-100 |
| Redis (Upstash) | Pay-as-you-go | $10-50 |
| Cloudflare R2 | Pay-as-you-go | $15-100 |
| SendGrid | Pro | $89-200 |
| Twilio | Pay-as-you-go | $50-500 |
| Claude API | Pay-as-you-go | $100-1000 |
| Stripe | 2.9% + $0.30 | Variable |
| Sentry | Team | $26 |
| **Total** | - | **$335-2000+** |

---

## 8.9 Risk Mitigation

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| API rate limits | Medium | High | Implement queuing, caching |
| Database scaling | Low | High | Use read replicas, connection pooling |
| AI cost overruns | Medium | Medium | Implement strict quotas, monitoring |
| Third-party outages | Low | High | Fallback providers, graceful degradation |

### Business Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Low user adoption | Medium | High | MVP validation, user feedback loops |
| Payment fraud | Low | High | Stripe Radar, verification |
| View-to-earn abuse | Medium | Medium | Anti-fraud systems, limits |
| Competition | Medium | Medium | Unique features, fast iteration |

---

## 8.10 Success Metrics

### Launch Goals (Month 1)
- [ ] 500 registered users
- [ ] 100 daily active users
- [ ] 10 paying subscribers
- [ ] < 3s average page load
- [ ] < 1% error rate

### Growth Goals (Month 3)
- [ ] 5,000 registered users
- [ ] 1,000 daily active users
- [ ] 200 paying subscribers
- [ ] $5,000 MRR

### Scale Goals (Month 6)
- [ ] 25,000 registered users
- [ ] 5,000 daily active users
- [ ] 1,000 paying subscribers
- [ ] $30,000 MRR
- [ ] $10,000 ad revenue

---

# APPENDIX

## A. Environment Variables

```bash
# .env.example

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# Authentication
JWT_ACCESS_SECRET=your-secret-here
JWT_REFRESH_SECRET=your-secret-here
PASSWORD_PEPPER=your-pepper-here
CSRF_SECRET=your-csrf-secret

# Encryption
ENCRYPTION_KEY=your-32-byte-key-here

# AI
ANTHROPIC_API_KEY=sk-ant-api03-...

# Email
SENDGRID_API_KEY=SG....
EMAIL_FROM=hello@flowsmartly.com

# SMS
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...

# Payments
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...

# Storage
CLOUDFLARE_R2_ACCESS_KEY=...
CLOUDFLARE_R2_SECRET_KEY=...
CLOUDFLARE_R2_BUCKET=flowsmartly
NEXT_PUBLIC_CDN_URL=https://cdn.flowsmartly.com

# Monitoring
SENTRY_DSN=https://...
```

## B. Recommended Extensions & Tools

### VS Code Extensions
- ESLint
- Prettier
- Tailwind CSS IntelliSense
- Prisma
- GitLens
- Thunder Client (API testing)

### Development Tools
- Postman / Insomnia (API testing)
- TablePlus (Database GUI)
- Redis Insight (Redis GUI)
- Figma (Design)
- Linear (Project management)

### Browser Extensions
- React Developer Tools
- Redux DevTools
- Lighthouse

---

## C. Quick Start Commands

```bash
# Clone and setup
git clone https://github.com/your-org/flowsmartly.git
cd flowsmartly
npm install

# Setup database
npx prisma generate
npx prisma db push

# Development
npm run dev

# Build & test
npm run build
npm run test
npm run lint

# Database
npx prisma studio        # Open database GUI
npx prisma migrate dev   # Run migrations

# Deploy
vercel --prod
```

---

**END OF FLOWSMARTLY V2 COMPLETE PROJECT PLAN**

*Document Version: 2.0*
*Last Updated: February 4, 2026*
*Prepared by: AI Architecture Assistant*

---

# DEVELOPMENT PROGRESS TRACKER

## Last Updated: February 4, 2026

---

## IMPLEMENTATION STATUS OVERVIEW

### Phase 1: Foundation - COMPLETE

| Feature | Status | Notes |
|---------|--------|-------|
| Project Setup (Next.js 15, TypeScript, Tailwind) | DONE | Next.js 15.5.11, Node.js v24.13.0 |
| Prisma ORM + SQLite Database | DONE | Full schema with all models |
| Authentication (Register/Login/Logout) | DONE | Cookie-based sessions, bcrypt passwords |
| Dashboard Layout + Sidebar Navigation | DONE | Collapsible sidebar, responsive, role-based sections |
| Design System (shadcn/ui components) | DONE | Button, Card, Dialog, Toast, Badge, Skeleton, etc. |
| Framer Motion Animations | DONE | Page transitions, micro-interactions |

### Phase 2: Core Features - COMPLETE

| Feature | Status | Notes |
|---------|--------|-------|
| AI Content Studio (Text Generation) | DONE | Claude-powered post, caption, hashtag, idea generation |
| Visual Design Studio | DONE | Dual-mode pipeline (gpt-image-1 direct + Claude SVG hybrid) |
| Brand Identity System | DONE | AI-powered brand setup, logo, colors, voice tone, contact info |
| Logo Generator | DONE | 3-step generation (concepts -> pick -> finalize), ZIP export |
| Social Feed (FlowSocial) | DONE | Post composer, comments, likes, bookmarks, sharing, trending |
| Media Library | DONE | Upload, folders, grid/list view, tagging, generated content tab |
| User Profiles + Social Graph | DONE | Follow/unfollow, profile pages, user search |

### Phase 3: Marketing Tools - COMPLETE

| Feature | Status | Notes |
|---------|--------|-------|
| Campaign Management | DONE | Email/SMS campaigns, scheduling, audience targeting |
| Email Marketing | DONE | Campaign creation, templates, delivery tracking |
| SMS Marketing | DONE | Message campaigns, scheduling, engagement tracking |
| Contact Lists | DONE | Contact CRUD, list management |

### Phase 4: Monetization - COMPLETE

| Feature | Status | Notes |
|---------|--------|-------|
| Ads System | DONE | Ad campaign management, budget tracking, performance metrics |
| Earnings Dashboard | DONE | Balance, payouts, earnings history, transaction tracking |
| Analytics Dashboard | DONE | Time range filters, stats, charts, top posts |

### Phase 5: Admin Portal - COMPLETE

| Feature | Status | Notes |
|---------|--------|-------|
| Admin Authentication | DONE | Separate admin login with role-based access |
| Admin Dashboard & Stats | DONE | Platform-wide analytics, visitor tracking |
| User Management | DONE | User list, ban/unban, credit management |
| Content Moderation | DONE | Content review, flagging |
| Admin Settings | DONE | Platform settings, configuration |
| Audit Logging | DONE | Admin action tracking |
| Marketing Management | DONE | Email/SMS stats, campaign oversight |

---

## VISUAL STUDIO - DETAILED PROGRESS

The Visual Studio is the most complex feature. Here is its detailed status:

### Architecture
- **Dual-mode pipeline**: gpt-image-1 direct mode (for standard aspect ratios) + Claude SVG hybrid (for extreme ratios)
- **Direct mode**: Single gpt-image-1 call for sizes with aspect ratio 0.5-2.0 and max dimension <= 2000px
- **Claude hybrid mode**: Claude analysis -> OpenAI image generation -> Claude SVG composition -> placeholder replacement
- **Post-processing**: Programmatic SVG fixes for hero image positioning and CTA button sizing

### Features Implemented
| Feature | Status | Notes |
|---------|--------|-------|
| Category Selection (6 categories) | DONE | Social Post, Ad, Flyer, Poster, Banner, Signboard |
| Size Presets (29 sizes) | DONE | Instagram, Facebook, Twitter, LinkedIn, YouTube, print sizes |
| Style Selection (10 styles) | DONE | Photorealistic, Illustration, Minimalist, Modern, Vintage, etc. |
| Hero Type Toggle | DONE | People, Product, Text-only |
| Text Mode Toggle | DONE | "AI Creative" (AI generates copy) vs "Use My Text" (exact text) |
| Brand Identity Integration | DONE | Auto-loads brand name, logo, colors from Brand Kit |
| Contact Info on Design | DONE | Checkbox toggles for email, phone, website, address |
| Wide Banner Layout | DONE | Special layout for extreme aspect ratios (covers, headers, leaderboards) |
| Font Scaling | DONE | Adaptive font sizes based on both width and height |
| Hero Image Post-processing | DONE | Forces correct positioning regardless of Claude output |
| CTA Button Post-processing | DONE | Ensures minimum button width on wide banners |
| SVG Download | DONE | For hybrid/svg-only pipeline results |
| PNG Download | DONE | Canvas-based SVG-to-PNG conversion, direct for gpt-image-1 results |
| Design History | DONE | Recent designs gallery with preview |
| Pipeline-aware UI | DONE | Shows/hides SVG download button based on pipeline type |

### Known Issues / Fine-tuning
- Claude sometimes ignores exact SVG attribute instructions -> mitigated by post-processing
- Very large print sizes (A3, A2) use Claude pipeline but image quality is lower when scaled
- Base64 image storage in SQLite causes large DB size (~500MB+)

---

## PAGES & NAVIGATION

### Sidebar Navigation (Current)
| Menu Item | Route | Page Exists | Status |
|-----------|-------|-------------|--------|
| Dashboard | /dashboard | Yes | WORKING |
| Visual Studio | /studio | Yes | WORKING |
| Brand Identity | /brand | Yes | WORKING |
| Logo Generator | /logo-generator | Yes | WORKING |
| Media Library | /media | Yes | WORKING |
| Feed | /feed | Yes | WORKING |
| Ads | /ads | Yes | WORKING |
| Analytics | /analytics | Yes | WORKING |
| Earnings | /earnings | Yes | WORKING |
| Campaigns (Premium) | /campaigns | Yes | WORKING |
| Email Marketing (Premium) | /email-marketing | Yes | WORKING |
| SMS Marketing (Premium) | /sms-marketing | Yes | WORKING |
| Settings | /settings | Yes | WORKING |
| Help | /help | NO | NEEDS PAGE |

### Removed from Navigation
| Menu Item | Route | Reason |
|-----------|-------|--------|
| Templates | /templates | Not using templates; page file still exists but unreachable |

---

## API ROUTES (61 Total)

### Auth (4 routes)
- POST /api/auth/register, /api/auth/login, /api/auth/logout, GET /api/auth/me

### AI & Content Generation (8 routes)
- POST /api/ai/visual, /api/ai/logo, /api/ai/studio
- POST /api/ai/generate/post, /caption, /hashtags, /ideas, /auto

### Brand (3 routes)
- GET/POST /api/brand, POST /api/brand/generate

### Designs (2 routes)
- GET/POST /api/designs

### Media (5 routes)
- GET/POST/PUT/DELETE /api/media/*, GET/POST /api/media/folders, POST /api/upload

### Social (10 routes)
- GET/POST /api/posts, /api/posts/[postId]/like, /comment, /bookmark, /share
- GET/POST /api/users/[userId]/follow, /api/users/search, /api/users/profile
- GET /api/feed/trending, /api/content-library

### Marketing (4 routes)
- GET/POST /api/campaigns, /api/contacts, /api/contact-lists, /api/templates

### Monetization (2 routes)
- GET/POST /api/earnings, /api/ads

### Analytics (2 routes)
- POST /api/analytics/collect, GET /api/analytics

### Admin (12+ routes)
- Admin auth, stats, visitors, users, settings, content, earnings, audit, setup, media, credits, marketing

---

## REMAINING WORK / KNOWN GAPS

### Must Fix
1. **Help Page Missing** - /help is in sidebar navigation but has no page.tsx implementation
2. **Templates Page Orphaned** - page.tsx exists at /templates but removed from navigation; consider deleting

### Should Improve
3. **Database Size** - SQLite DB is ~500MB due to base64 image storage; consider external file/blob storage
4. **TypeScript Errors** - 6 pre-existing TS errors (admin/users USER_BANNED/USER_UNBANNED, regex es2018 flags, contacts route type)
5. **Print Quality** - Large print sizes (A3, A2, Movie Poster) generate at 1536px max via gpt-image-1; may need higher-res solution
6. **Real-time Updates** - WebSocket layer planned but not implemented
7. **Dark Mode** - Design system supports it but implementation may be incomplete across all pages

### Future Enhancements (Post-Launch)
8. **Payment Integration** - Stripe/payment processing for earnings payouts
9. **Social Media API Integration** - Direct posting to Instagram, Facebook, Twitter (currently share-via-dialog only)
10. **Team Collaboration** - Multi-user workspaces, approval workflows
11. **A/B Testing** - Content variation testing
12. **Scheduled Posting** - Queue posts for future publishing
13. **White-Label** - Agency white-labeling support

---

*Progress tracking is maintained alongside development. Update this section after each significant milestone.*
