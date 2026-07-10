"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ThemeMenu } from "@/components/shared/theme-menu";
import {
  Menu, Sparkles, X, ChevronDown, ChevronRight, Check, Shield, LogOut, SquarePen, History, Trash2, MessageSquare, User, Settings, Link2,
  Building2, Palette, Megaphone, Video, ShoppingBag, CalendarDays, Globe, TrendingUp, CreditCard,
  FileText, ClipboardList, Workflow, Users, Star, Search, Mail, MessageCircle, Gift, Images, Clapperboard, Truck, LayoutTemplate, Printer, PanelRight, Mic, UserSquare2, Monitor, type LucideIcon,
} from "lucide-react";
import { PageLoader } from "@/components/shared/page-loader";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";
import { usePreferredLanguage } from "@/hooks/use-preferred-language";
import { getHomeStrings, buildGreeting } from "./home-i18n";
import { WORKSPACES } from "./workspaces";
import { BrandMark, BrandWordmark } from "./brand-mark";
import { LanguageSwitcher } from "./language-switcher";
import { useHomeAgent, type ConversationSummary } from "./use-home-agent";
import { AgentNavContext } from "@/components/flow-ai/agent-nav-context";
import { HomeMessageView } from "./home-message";
import { MediaLibraryPicker } from "@/components/shared/media-library-picker";
import type { ViewEvent } from "@/lib/agent-views/spec";
import { SetupBanners } from "./setup-banners";
import { Composer } from "./composer";
import { FocusedView, FocusedComingSoon } from "./focused-view";
import { FocusedDesignStudio, DEFAULT_DESIGN, DESIGN_DRAFT_KEY, designCanvasContext, applyDesignPatch, type DesignDoc, type BrandContact } from "./focused/design-studio";
import { FocusedPrintStudio } from "./focused/print-studio";

// The Print Studio canvas autosaves under its own key, fully separate from the
// Create design draft (DESIGN_DRAFT_KEY) so the two never bleed into each other.
const PRINT_DRAFT_KEY = "fs-print-draft";
import { SettingsWorkspace } from "@/components/settings/settings-workspace";
import { FocusedBrand } from "./focused/brand-workspace";
import { FocusedAnalytics } from "./focused/analytics-workspace";
import { FocusedBilling } from "./focused/billing-workspace";
import { FocusedCredits } from "./focused/credits-workspace";
import { FocusedPlans } from "./focused/plans-workspace";
import { FocusedDomains } from "./focused/domains-workspace";
import { FocusedPitch } from "./focused/pitch-workspace";
import { FocusedForms } from "./focused/forms-workspace";
import { FocusedAutomations } from "./focused/automations-workspace";
import { FocusedCustomers } from "./focused/customers-workspace";
import { FocusedReviews } from "./focused/reviews-workspace";
import { FocusedLeads } from "./focused/leads-workspace";
import { FocusedPitchStudio } from "./focused/pitch-studio";
import { FocusedCampaignStudio } from "./focused/campaign-studio";
import { FocusedCompose } from "./focused/compose-workspace";
import { FocusedEmail } from "./focused/email-workspace";
import { FocusedSms } from "./focused/sms-workspace";
import { FocusedWhatsApp } from "./focused/whatsapp-workspace";
import { FocusedTeams } from "./focused/teams-workspace";
import { FocusedReferrals } from "./focused/referrals-workspace";
import { FocusedMedia } from "./focused/media-workspace";
import { FocusedLogo } from "./focused/logo-workspace";
import { FocusedVoice } from "./focused/voice-workspace";
import { FocusedVideo } from "./focused/video-workspace";
import { FocusedAvatar } from "./focused/avatar-workspace";
import { FocusedDelivery } from "./focused/delivery-workspace";
import { FocusedAdBuilder } from "./focused/adbuilder-workspace";
import { AdBuilderCanvas } from "@/components/ad-builder/ad-builder-canvas";
import { FocusedCalendar } from "./focused/calendar-workspace";
import { FocusedPublish } from "./focused/publish-workspace";
import { FocusedConnections } from "./focused/connections-workspace";
import { FocusedSell } from "./focused/sell-workspace";
import { StoreCallToAction } from "./focused/store-cta";
import { FocusedWeb, FocusedLanding } from "./focused/web-workspace";
import { FocusedPortfolio } from "./focused/portfolio-workspace";
import { FocusedReel } from "./focused/reel-workspace";
import { FocusedDirector } from "./focused/director-workspace";
import { FocusedOutreach } from "./focused/outreach-workspace";
import { useIsMobile } from "@/hooks/use-is-mobile";

interface SessionUser { name: string; aiCredits: number; avatarUrl: string | null; username: string | null; email: string | null }
interface AgentClient { id: string; name: string }
interface AiSuggestion { label: string; hint: string; icon: string; prompt: string }

const SUG_ICON: Record<string, LucideIcon> = {
  palette: Palette, megaphone: Megaphone, video: Video, bag: ShoppingBag,
  calendar: CalendarDays, globe: Globe, trending: TrendingUp, sparkles: Sparkles,
};
const FALLBACK_ICONS: LucideIcon[] = [Palette, CalendarDays, Video, ShoppingBag];

const WS_DESC: Record<string, string> = {
  create: "Design studio, logos, video studio, media library.",
  publish: "Social accounts, posts, content calendar and scheduling.",
  grow: "Content automation & strategy, email, SMS, WhatsApp, ad builder, story-ad campaigns.",
  sell: "Store builder, products, orders, customers, delivery, pricing, storefronts.",
  web: "Website builder, landing pages, and domains.",
  outreach: "Contacts & lists, reviews / local SEO, pitch board & proposals, follow-ups, forms, events.",
  business: "Brand kit, analytics, credits & billing, teams, referrals, settings, admin.",
};

// What to tell the user the agent can do in EACH focused surface — the chat
// empty-state hint must match the canvas the agent is actually wired to, not
// always the design canvas.
const FOCUS_CHAT_HINT: Record<string, string> = {
  create: "Ask the agent to create or change the design on the right — e.g. “make a summer sale graphic” or “use gold and a punchier headline”.",
  print: "Ask the agent to design something to print — e.g. “make a flyer for my grand opening” or “design double-sided business cards”. Pick a format on the right or let the agent choose.",
  brand: "Ask the agent to set up or refine your brand — e.g. “set up my brand from this: …”, “make the voice playful”, or “add these keywords”. It fills the kit and you confirm.",
  analytics: "Ask the agent about your performance — e.g. “how did last week’s posts do?” or “what should I post more of?”.",
  billing: "Ask the agent about credits & billing — e.g. “how many credits do I have left?”, “what did I spend on this week?”, or “which plan fits me?”.",
  credits: "Ask the agent how many credits you have or what they’re spent on — or just pick a pack to top up.",
  plans: "Ask the agent which plan fits you, or what each plan includes — then upgrade right here.",
  landing: "Ask the agent to create a landing page — e.g. “a page for my summer offer with a signup form”.",
  domains: "Ask the agent to help connect a domain, fix verification, or set up DNS.",
  pitch: "Ask the agent to draft a proposal for a client or research a prospect.",
  forms: "Ask the agent to build a new lead-capture form or survey.",
  automations: "Ask the agent to set up a follow-up sequence — a welcome email, a birthday note, or an abandoned-cart nudge.",
  customers: "Ask the agent to find your top spenders or re-engage repeat customers.",
  reviews: "Ask the agent to request more reviews, fix a listing, or improve your local SEO score.",
  leads: "Ask the agent to find leads — e.g. “find dentists in Austin” — then pitch them or write a proposal.",
  compose: "Ask the agent to write or schedule a post — e.g. “write a post about my new product for Instagram, schedule it for Friday 4pm”.",
  email: "Ask the agent to draft an email campaign or check how the last one performed.",
  sms: "Ask the agent to send an SMS blast or check delivery.",
  whatsapp: "Ask the agent to set up a WhatsApp broadcast or automation.",
  teams: "Ask the agent to invite a teammate or change someone’s role.",
  referrals: "Ask the agent how your referrals are doing or how best to share your link.",
  media: "Ask the agent to find or generate media — e.g. “make me a product image”.",
  logo: "Ask the agent to generate a logo for your brand.",
  video: "Ask the agent to create a video — an ad, promo, or reel.",
  reel: "Ask the agent to turn a video into reels — paste a link and it finds the best moments, reframes to 9:16 and captions them.",
  avatar: "Ask the agent to make an avatar video — e.g. “a 30s intro of my avatar for our launch”.",
  delivery: "Ask the agent about deliveries — e.g. “which orders are out for delivery?”.",
  adbuilder: "Ask the agent to build & launch an ad — e.g. “run an ad for my new product, $10/day, target Austin”.",
  storyad: "Ask the agent to make a Story-Ad movie — a cinematic AI video ad for a product or offer.",
  calendar: "Ask the agent to plan your content calendar — e.g. “schedule 3 posts this week” or “what’s going out Friday?”.",
  publish: "Ask the agent to schedule or manage posts — e.g. “schedule a post for Friday at 4pm” or “what’s on my calendar?”.",
  connections: "Ask the agent which accounts to connect — e.g. “connect my Instagram” — or use the panel on the right.",
  sell: "Ask the agent to run your store — e.g. “add a product called Blue Mug for $20”, “make the Blue Mug $15”, or “ship order #1023”.",
  web: "Ask the agent to build or edit your site — e.g. “change my homepage headline” or “add an About section”.",
  outreach: "Ask the agent to manage contacts & outreach — e.g. “add Sarah, sarah@co.com” or “draft a follow-up to my leads”.",
  account: "Ask the agent about your account — e.g. “change my notification settings” or “update my language”.",
  profile: "Ask the agent to update your public profile.",
};
const DEFAULT_CHAT_HINT = "Ask the agent to help with this surface — it can act on your account and confirm before anything costs credits.";

// Header label / subtitle / icon for the sub-surfaces that aren't top-level rail
// workspaces (built as their own /home/<view> focused views).
const FOCUS_META: Record<string, { label: string; subtitle: string; icon: LucideIcon }> = {
  print: { label: "Print studio", subtitle: "Flyers, posters, cards & brochures — print-ready, on the canvas", icon: Printer },
  landing: { label: "Landing pages", subtitle: "High-converting pages for campaigns & offers", icon: LayoutTemplate },
  domains: { label: "Domains", subtitle: "Connect & manage your custom domains", icon: Globe },
  pitch: { label: "Pitch board", subtitle: "Your sales proposals & outreach pitches", icon: FileText },
  forms: { label: "Forms & surveys", subtitle: "Lead-capture forms & surveys", icon: ClipboardList },
  automations: { label: "Follow-ups", subtitle: "Automated follow-up sequences", icon: Workflow },
  customers: { label: "Customers", subtitle: "Your store buyers — orders, spend, last purchase", icon: Users },
  reviews: { label: "Reviews", subtitle: "Reviews & local SEO presence", icon: Star },
  leads: { label: "Lead Studio", subtitle: "Find → automate → close", icon: Search },
  pitchstudio: { label: "Pitch Studio", subtitle: "Branded proposal — edit & attach", icon: FileText },
  campaign: { label: "Campaign Studio", subtitle: "Plan, generate & schedule content", icon: CalendarDays },
  compose: { label: "Compose", subtitle: "Write, schedule & publish a post", icon: SquarePen },
  email: { label: "Email", subtitle: "Email campaigns & performance", icon: Mail },
  sms: { label: "SMS", subtitle: "SMS campaigns & delivery", icon: MessageSquare },
  whatsapp: { label: "WhatsApp", subtitle: "WhatsApp broadcasts & automations", icon: MessageCircle },
  teams: { label: "Teams", subtitle: "Members & invites", icon: Users },
  referrals: { label: "Referrals", subtitle: "Your referral link & earnings", icon: Gift },
  media: { label: "Media library", subtitle: "Your images & videos", icon: Images },
  logo: { label: "Logo studio", subtitle: "Your generated logos", icon: Palette },
  video: { label: "Video studio", subtitle: "Brief → estimate → build, right on the canvas", icon: Clapperboard },
  reel: { label: "Reel studio", subtitle: "Link → find moments → clips, right on the canvas", icon: Clapperboard },
  voice: { label: "Voice studio", subtitle: "Voiceovers, narration & voice cloning", icon: Mic },
  avatar: { label: "Avatar Studio", subtitle: "Talking-avatar videos from your clone", icon: UserSquare2 },
  director: { label: "Video Studio", subtitle: "Direct AI, avatar & reel into one film", icon: Clapperboard },
  delivery: { label: "Delivery", subtitle: "Order delivery & drivers", icon: Truck },
  credits: { label: "Buy credits", subtitle: "Top up your credit balance", icon: CreditCard },
  plans: { label: "Plans", subtitle: "Compare & upgrade your plan", icon: Sparkles },
  adbuilder: { label: "Ad builder", subtitle: "Your ad campaigns — spend, reach & ROAS", icon: Megaphone },
  storyad: { label: "Video studio", subtitle: "Brief → estimate → build, right on the canvas", icon: Clapperboard },
  calendar: { label: "Content calendar", subtitle: "See what’s going out, and when", icon: CalendarDays },
};

// Tell the agent WHICH surface the user is on so it acts in-context instead of
// replying with a generic menu. Sent as `surfaceContext` (separate from the
// design-only `canvasContext`). `create` returns undefined — its design canvas
// already feeds the agent via designCanvasContext.
function focusedSurfaceContext(focused: string, brandName?: string | null, openResource?: { kind: string; id: string; name?: string } | null): string | undefined {
  switch (focused) {
    case "brand":
      return `The user has the **Brand identity** workspace open and is editing their Brand Kit (it powers ALL AI output across the app).${brandName ? ` Current brand name on file: "${brandName}".` : " The kit looks empty or barely started."} Treat ANYTHING they share here — a business description, value proposition, tagline, products, audience, or voice — as them SETTING UP or REFINING THEIR BRAND. Call get_brand_identity to see what exists, INFER every field you can from their message, propose_plan ("Set up your brand kit", free), then call update_brand_identity. Do NOT reply with a generic capabilities menu or ask "what would you like to do?" — they are clearly here to build their brand.`;
    case "sell":
      return `The user has the **Sell** workspace open — their store, products, orders, AND the full **Store Studio** design editor. OPERATE the store for them. For PRODUCTS/ORDERS: add_product, update_product, delete_product, fulfill_order (a product name + price is enough to add one). To BUILD a store they don't have: build_store. To EDIT the STOREFRONT DESIGN/CONTENT (store name/tagline/description, CTA, hero headline/subheadline/style/slideshow, categories, nav/footer links, FAQ, or a section's layout): FIRST call get_store_content (see the current content + editable sections), then use edit_store — mode:'content' for text/data (send a PARTIAL patch; LISTS like navLinks/footerLinks/faq/categories are replaced wholesale so include existing items) or mode:'redesign' with a section + instructions for a layout/design change. Either way the store rebuilds and you're notified when live. Don't tell them to open the editor manually.`;
    case "publish":
      return `The user has the **Publish** workspace open (posts, scheduling, content calendar). Default their intent to creating, scheduling, or managing posts.`;
    case "portfolio":
      return `The user has the **Portfolio Studio** open — their Portfolio / Digital Résumé site (a shareable public page, distinct from the Website Studio). OPERATE it for them; don't tell them to open menus. To BUILD one they don't have: build_portfolio — ask business vs personal; for a personal résumé, have them upload their CV and READ it to extract experience/skills/education; pull business content from the Brand Kit. To EDIT: call get_portfolio_content first (current header, sections, style, hero media, access), then edit_portfolio — send a PARTIAL patch; the \`sections\` array is replaced wholesale so include existing items you keep. Pick a STYLE that reads like a portfolio/digital-ad piece (spotlight/cinematic/showcase/editorial/neon/card); spotlight/cinematic/neon support a full-bleed VIDEO hero. To gate access, set access.view or access.download to 'email' (visitors verify a 6-digit code and are saved to Contacts). To go live set status:'PUBLISHED'. For a CUSTOM DOMAIN, do it end-to-end: find_domain (search options + prices from their name/brand), then buy_portfolio_domain to purchase + AUTO-ATTACH the one they pick (charges their saved card on Confirm, registers it, publishes + wires DNS/SSL automatically — they never touch DNS), or connect_portfolio_domain if they already own one. Don't just describe steps — do the work.`;
    case "reel":
      return `The user has the **Reel Studio** OPEN — a playground that turns a long video into scored 9:16 clips. OPERATE it; don't narrate. To BUILD reels: build_reels — pass the source \`transcript\` (transcribe the video's audio, or use provided captions), a title, and optional settings (clipLength/aspect/count). Clips appear on the canvas sorted by virality score and render to 9:16 after. To EDIT a clip, call get_reel_content first (for clip ids) then edit_clip. To POST/SCHEDULE, use publish_reels with clip ids + channels (tiktok/instagram/youtube/facebook/linkedin/x); omit scheduleAt to post now. Everything stays under the campaign to repost or delete. Don't reply with a generic menu.`;
    case "web":
      return `The user has the **Web** workspace open — their website + the full **Website Studio** editor. OPERATE the site for them; don't tell them to open menus. To BUILD a new site use build_website. To EDIT the existing one, FIRST call get_website_content (see the current content + which sections are editable), then use edit_website: mode:'content' for text/data (company info, tagline, phone/email/address, the CTA button, services, team, FAQ, testimonials + layout, stats, nav/footer links, contact info + Google map, Google Reviews) — send a PARTIAL patch, but LISTS (services/faq/testimonials/links) are replaced wholesale so include the existing items too; or mode:'redesign' with a section + instructions for a layout/design change or a new section. Either way the site rebuilds and you're notified when it's live. For publish/unpublish/rename/SEO use update_website. Landing pages are generative — gather the goal/offer/audience, then generate.`;
    case "outreach":
      return `The user has the **Outreach** workspace open (contacts, lists, follow-ups, pitches). Default their intent to contact and outreach actions.`;
    case "analytics":
      return `The user has the **Analytics** workspace open (performance, usage, activity). Default their intent to reporting and insights about their own account.`;
    case "landing":
      return `The user is on the **Landing pages** surface (campaign/offer pages). Creating a landing page is generative — gather the goal, offer, and audience, then generate it.`;
    case "domains":
      return `The user is on the **Domains** surface, managing custom domains (registrar, SSL, verification, primary). Help them connect a domain, fix DNS/verification, or set a primary.`;
    case "pitch":
      return `The user is on their **Pitch board** (sales proposals & outreach pitches). Drafting a new proposal/pitch is generative — use create_proposal / create_pitch when they ask.`;
    case "forms":
      return `The user is on the **Forms & surveys** surface (lead-capture forms/surveys + submissions). Help them build a new form/survey or read submissions when asked.`;
    case "automations":
      return `The user has the **Follow-ups flow playground** OPEN — a live canvas for building automated, PERSONALIZED sequences. When they ask you to build/create a flow, build it end to end into this canvas: pick the AUDIENCE (a single contact, multiple selected contacts, or a segment/list), draft the ordered message STEPS with timing/waits, and personalize each message per contact (use their real first name, company, history). Ask any genuinely-missing detail as ONE quick follow-up (audience? channel? the offer?), then propose_plan with the exact credit cost and, on confirm, create & schedule the sequence — it appears in their campaign Library here and the canvas reflects it. Don't reply with a generic menu; they're here to build a follow-up flow.`;
    case "adbuilder":
      return `The user has the **Ad builder flow playground** OPEN — a live canvas for building & launching ad campaigns. When they ask you to build/create/run an ad, build it end to end: what they're advertising (a STORE PRODUCT, a product/page LINK, or a described offer — if a product, generate the creative FROM it; if a link, read it), the ad CREATIVE (a scroll-stopping image + punchy headline & description + a strong CTA), the GOAL, the PLACEMENTS (only their ENABLED providers — FlowSmartly Feed / Meta / Google / TikTok / Spotlight), and the BUDGET + schedule. Ask any missing detail as ONE quick follow-up, then propose_plan with the exact credit cost; on confirm, create & launch it (it goes to review → live and appears in their campaign Library here). Don't reply with a generic menu; they're here to build an ad campaign.`;
    case "customers":
      return `The user is on the **Customers** surface (their store's buyers — orders, spend, last purchase). Help them segment, find top spenders, or re-engage repeat customers.`;
    case "reviews":
      return `The user is on the **Reviews & local SEO** surface (ListSmartly). Help them request more reviews, claim/fix listings, or improve their local SEO/citation score.`;
    case "leads":
      return `The user is in **Lead Studio** (find → automate → close) — a hands-on surface with a Find screen, a saved-lead table, an automation flow, and ROI. OPERATE THE SURFACE, don't narrate in chat. Key rules:
• FIND: for LOCAL / brick-and-mortar targets (a business type + a city) use find_local_leads (Google Places — verified phone/website/rating, up to 60/search); for specific PEOPLE or national/online companies use web_search + find_leads. Hit the requested count, topping up find_local_leads (≤60) with web_search when asked for more. Results save into a lead list and appear in the table automatically.
• READ FIRST: to answer "how many leads need enrichment in <list>?" or to enrich a whole list, call list_leads (listName as the user says it, status:"unenriched") — it returns the EXACT counts + each lead's id and what's missing. NEVER ask the user to count leads or read their table for you; you have list_leads.
• ENRICH: results MUST land in the lead's ROW via enrich_lead — NEVER write the found email/phone/title as a message or a table in the chat (that's the wrong place and the exact thing to avoid). The Enrich button gives you the exact leadId in the instruction — call enrich_lead with that leadId. Otherwise get the ids from list_leads (or pass leadName + listId and it resolves the row). For a whole list: list_leads(status:"unenriched") → propose_plan (one AI_WEB_SEARCH per lead) so the user approves the cost → loop enrich_lead per lead id. For DEEPER details (full address, more contacts, firmographics, hours, reviews) use deep_enrich_lead.
• COST: never quote 0 for a paid lead action — a local search = AI_WEB_SEARCH; each enrichment = AI_WEB_SEARCH per lead. Pass those in propose_plan's costKeys.
A "pitch" is a cold-outreach email (create_pitch); a "proposal" is a branded service deck (create_proposal) — pick the right one when asked.`;
    case "compose":
      return `The user is on the **Post composer** (write a caption, pick platforms, attach media, schedule). Help them write and schedule a post — schedule_social_post / create posts via the right tool.`;
    case "email":
      return `The user is on the **Email** surface (email campaigns + stats). Help them draft, schedule, or review an email campaign (create_email_campaign / send_email_campaign).`;
    case "sms":
      return `The user is on the **SMS** surface (SMS campaigns/blasts). Help them create or send an SMS blast and check delivery.`;
    case "whatsapp":
      return `The user is on the **WhatsApp** surface. When they describe what their WhatsApp AI assistant should do (its goal, tone, what it knows, whether it qualifies leads, books appointments, or hands off to a human) or say "turn it on/off", use configure_whatsapp_agent to set it up on their behalf — infer the fields from their words, don't hand them a checklist.`;
    case "teams":
      return `The user is on the **Teams** surface (members + invites). Help them invite or manage teammates and roles.`;
    case "referrals":
      return `The user is on the **Referrals** surface (referral link + earnings). Help them share their link or understand their referral earnings.`;
    case "media":
      return `The user is on the **Media library** (their images & videos). Help them find/organize media or generate new media (generate_image / generate_video).`;
    case "logo":
      return `The user is on the **Logo studio** (their generated logos + brand logo). Generating a logo is a generative task — use the logo tool when they ask.`;
    case "video":
      return `The user is on the **Video studio** (their AI-generated videos). Help them create a video (generate_video / story-ad).`;
    case "director":
      return `The user is on the **Video Studio — Director**: one canvas that fuses AI cinematic shots, talking-avatar clones, and reel clips into a single film. A film is a pipeline of scene nodes, each rendered by its own engine, then stitched into one video. Help them brief the film, add/edit/reorder scenes, pick the right engine per beat, generate scenes, and stitch the final cut.`;
    case "voice":
      return `The user is on the **Voice Studio** (AI voiceovers, narration & voice cloning). Making a voiceover is a generative task — help them write a punchy script for their goal, then they set the voice (gender/accent/style/speed) and click Generate; the audio lands in the studio and their Media library. They can also clone a voice from a sample.`;
    case "avatar":
      return `The user is on the **Avatar Studio**. Never name or hint at any third-party provider to the user — this is FlowSmartly's own studio. INTERVIEW first (goal, tone, length), then use create_avatar_video — it renders into the studio canvas live and saves to the Library. It has modes: 'talking' (write a script → talking-avatar video; recommend Standard for social/outreach or Avatar IV for photoreal hero/ad), 'translate' (dub one of their FINISHED videos into another language — set targetLanguage), and 'batch' (many videos at once — pass a list of scripts). For a multi-scene PRESENTATION (a presenter avatar plus product/reference images or B-roll in one stitched video), use create_presentation — it plans the scenes for free onto the canvas as a Presentation node; the user opens the storyboard to attach per-scene visuals and render (only autoRender if they explicitly ask). Costs are in credits (priced from the DB/admin — never quote dollars). For 'photo → video' the user uploads a photo in the studio UI. To make a reusable avatar or cloned voice, use clone_avatar (consent-gated).`;
    case "print":
      return `The user is in the **Print Studio** designing something to PRINT (flyer, poster, business card, table tent, bi-fold/tri-fold brochure, or postcard). If no print canvas is open yet, FIRST call start_print_project with the right format to open the editable print canvas, then design it with update_canvas (copy, accent, print size) and add_design_page for multi-page/panel pieces (card front/back, brochure panels) — exactly like the design canvas, but keep content inside the safe area and mind the fold lines. Pick a fitting print size for the format (the canvas shows bleed/safe/fold guides). Confirm in one short sentence when it's ready.`;
    case "delivery":
      return `The user is on the **Delivery** surface (order delivery + drivers). Help them with delivery status, assignments, and fulfillment.`;
    case "storyad":
      return `The user is on the **Story-Ad** surface (cinematic AI ad movies + render status). Making a new story-ad is a generative video build — use the story-ad tool when they ask.`;
    case "calendar":
      return `The user is on the **Content calendar** (scheduled + published posts by date). Help them plan, schedule, or rearrange posts across the week — schedule_social_post / compose posts via the right tool.`;
    case "billing":
      return `The user has the **Billing & credits** workspace open (balance, plan, usage, transactions). Default their intent to credits/billing questions — use get_credits_history and list_my_features (for action costs). If they want to buy credits or change plans, explain the options; the actual purchase happens in the secure checkout.`;
    case "credits":
      return `The user is on the **Buy credits** surface (credit top-up packages). Help them choose a pack or explain pricing — the purchase itself is a secure Stripe checkout right in the surface.`;
    case "plans":
      return `The user is on the **Plans** surface (subscription plans + upgrade). Help them compare plans or pick the right one — upgrading is a secure Stripe checkout right in the surface.`;
    case "connections":
      return `The user has the **Connections** workspace open (linking social accounts). Help them connect or manage their accounts.`;
    case "account":
    case "profile":
      return `The user is in their ${focused === "profile" ? "Profile" : "Account & settings"}. Help with account, profile, or settings changes.`;
    case "pitchstudio": {
      const open = openResource?.kind === "pitch"
        ? `RIGHT NOW the user is VIEWING the proposal${openResource.name ? ` for "${openResource.name}"` : ""} (pitchId: ${openResource.id}) — THIS exact proposal is the one they mean. For ANY free-text change ("make it short and direct", "punch it up", "trim the text", "add pricing", "rewrite the intro"…) operate ONLY on pitchId="${openResource.id}": (1) call get_pitch(pitchId="${openResource.id}") FIRST to read EVERY section it currently has (title/summary/aboutBrand/clientNeed, and the structured ones: deliverables, timeline, proofPoints, customSections, pricing, benefits, nextSteps, terms). (2) When the request applies to the WHOLE proposal — "shorter/more direct/less text/tighten/rework/rewrite it" — you MUST rework the ENTIRE document, section by section, in ONE update_pitch(pitchId="${openResource.id}", content:{…}) call: include EVERY section that has text to trim (especially the long deliverables descriptions), not just one or two — leaving the rest untouched is a failure. Use edit_pitch_field only for a single named field. The studio re-renders in place; then confirm in ONE short line. If the user says "all of it / all the pages / everything", that reinforces: cover every section in one pass. NEVER open, "pull up", or edit a DIFFERENT or "most-recent" proposal (even if another client name surfaces in your memory), never ask which one it is, and never paste the proposal in chat. `
        : `There's no proposal open yet. `;
      return `The user is in **Pitch Studio** — a branded proposal playground for ONE lead. ${open}Use create_proposal ONLY to draft a brand-NEW proposal for a lead that has none (pass the lead's savedLeadId, draw services + value from their Brand Kit) — NEVER to shorten or rewrite an existing one. Results open IN the studio, never as a chat dump.`;
    }
    case "campaign":
      return `The user is in **Campaign Studio** — a content-campaign playground. To build a campaign, use create_content_campaign (name, brief/goal, platforms, days, postsPerWeek, tone, imageMode) — it generates a batch of concrete scheduled posts (captions + on-brand images) that open IN the studio for review, NEVER as a chat dump. To fix one post, use update_post (caption/schedule/platforms) or regenerate_post_image (a fresh on-brand image) — the change lands on that post's card. Approving in the UI schedules them to auto-publish; you don't publish them yourself.`;
    default:
      return undefined;
  }
}

// Focused surfaces that get their own traceable path (/home/<view>).
// "grow" and "business" are category CONTAINERS (they open a nav panel, not a
// real surface) — deliberately excluded so /home/grow and /home/business deep-
// link cleanly to Home instead of a "coming soon" placeholder.
const FOCUS_VIEWS = new Set(["create", "print", "brand", "analytics", "billing", "connections", "account", "profile", "publish", "sell", "web", "portfolio", "landing", "outreach", "domains", "pitch", "forms", "automations", "customers", "reviews", "leads", "pitchstudio", "campaign", "compose", "email", "sms", "whatsapp", "teams", "referrals", "media", "logo", "voice", "video", "reel", "avatar", "delivery", "adbuilder", "storyad", "calendar", "credits", "plans"]);


/**
 * Update the address bar WITHOUT going through Next's router. The App Router
 * instruments `window.history.replaceState`, and that patch can turn an in-page
 * URL tweak (e.g. adding ?conversationId after the first message) into a soft
 * navigation that occasionally falls back to a FULL PAGE RELOAD. The instance
 * method is patched; `History.prototype.replaceState` is the untouched native
 * one — call it directly so the URL stays in sync for deep-links/bookmarks with
 * zero navigation.
 */
function silentReplaceUrl(url: string) {
  try {
    History.prototype.replaceState.call(window.history, window.history.state, "", url);
  } catch {
    try { window.history.replaceState(window.history.state, "", url); } catch { /* noop */ }
  }
}

export function AgentHome() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language, setLanguage, dir } = usePreferredLanguage();
  const s = getHomeStrings(language);
  const { messages, sending, conversationId, conversations, send: agentSend, handlePlanResponse, handlePickTemplate, handlePickOption, loadConversation: agentLoadConversation, newConversation: agentNewConversation, refreshConversations, canvasUpdateRef, actionCount, beginPublishNarration, updatePublishNarration, endPublishNarration } = useHomeAgent();
  // Bridge the Compose publish stream into the agent chat (keeps the agent involved).
  const publishNarrate = { begin: beginPublishNarration, update: updatePublishNarration, end: endPublishNarration };

  const [mounted, setMounted] = useState(false);
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [brandName, setBrandName] = useState<string | null>(null);
  const [hasStore, setHasStore] = useState<boolean | null>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [agentName, setAgentName] = useState<string | null>(null);
  const [clients, setClients] = useState<AgentClient[]>([]);
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);

  const [accountOpen, setAccountOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<string | undefined>(undefined);
  // The lead / pitch whose Pitch Studio is open (carried into the focused surface).
  const [pitchTarget, setPitchTarget] = useState<{ leadId?: string; leadName?: string; pitchId?: string } | null>(null);
  // The content campaign whose Campaign Studio is open (empty object = new).
  const [campaignTarget, setCampaignTarget] = useState<{ campaignId?: string; brief?: string } | null>(null);
  // The document/resource the user currently has OPEN in a studio (e.g. the pitch
  // on screen), reported up by that studio. Threaded into surfaceContext so a
  // free-form agent request acts on THIS doc, not a guessed/most-recent one.
  const [openResource, setOpenResource] = useState<{ kind: string; id: string; name?: string } | null>(null);
  const [campaignInitialView, setCampaignInitialView] = useState("new");
  const [leaveAction, setLeaveAction] = useState<{ run: () => void } | null>(null);
  const [panelKey, setPanelKey] = useState<string | null>(null);
  // Rail category to restore when a browse panel is closed WITHOUT navigating —
  // so opening a menu over a focused view and closing it returns you to that view.
  const panelReturnWs = useRef("home");
  const [activeWs, setActiveWs] = useState("home");
  const [toast, setToast] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [leadsMenuOpen, setLeadsMenuOpen] = useState(true); // Lead Studio section menu (toggled from the surface header)
  const [leadsInitialScreen, setLeadsInitialScreen] = useState("find");
  // Deep-link a specific saved list open in the Lead Studio (from an in-chat card).
  const [leadsInitialListId, setLeadsInitialListId] = useState<string | null>(null);
  const [design, setDesign] = useState<DesignDoc>(DEFAULT_DESIGN);
  // The Print Studio canvas is a SEPARATE document from the Create design — they
  // must not share state or a draft key, or opening a print format would pollute
  // Create (and vice-versa). Its own state + storage keeps them fully isolated.
  const [printDesign, setPrintDesign] = useState<DesignDoc>(DEFAULT_DESIGN);
  const [printInitialFormat, setPrintInitialFormat] = useState<string | null>(null);
  const [brandColors, setBrandColors] = useState<string[]>([]);
  const [brandContact, setBrandContact] = useState<BrandContact | null>(null);
  const [brandLogo, setBrandLogo] = useState<string | null>(null);
  // The profile icon shows the brand mark once the kit is set up: prefer the
  // square iconLogo (made for avatars/feeds), fall back to the full logo.
  const [brandIcon, setBrandIcon] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const forceNextScrollRef = useRef(true);
  const accountRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const dirtyRef = useRef(false);
  const saverRef = useRef<null | (() => void | Promise<void>)>(null);
  const savedDesignRef = useRef<DesignDoc>(DEFAULT_DESIGN);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const requestChatAutoscroll = useCallback(() => {
    pinnedRef.current = true;
    forceNextScrollRef.current = true;
    const snap = () => bottomRef.current?.scrollIntoView({ block: "end" });
    requestAnimationFrame(snap);
    setTimeout(snap, 80);
    setTimeout(snap, 260);
  }, []);

  const send = useCallback(
    (...args: Parameters<typeof agentSend>) => {
      requestChatAutoscroll();
      return agentSend(...args);
    },
    [agentSend, requestChatAutoscroll],
  );

  const loadConversation = useCallback(
    (id: string) => {
      requestChatAutoscroll();
      return agentLoadConversation(id);
    },
    [agentLoadConversation, requestChatAutoscroll],
  );

  const newConversation = useCallback(() => {
    requestChatAutoscroll();
    return agentNewConversation();
  }, [agentNewConversation, requestChatAutoscroll]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let alive = true;
    const started = Date.now();
    (async () => {
      try {
        const me = await fetch("/api/auth/me").then((r) => r.json()).catch(() => null);
        if (alive && me?.success && me.data?.user) {
          const u = me.data.user;
          setUser({ name: u.name || "there", aiCredits: u.aiCredits ?? 0, avatarUrl: u.avatarUrl ?? null, username: u.username ?? null, email: u.email ?? null });
          if (me.data.isImpersonating) {
            setIsImpersonating(true);
            setAgentName(me.data.agentInfo?.agentName ?? null);
          }
        }
        fetch("/api/brand").then((r) => r.json()).then((b) => {
          if (!alive || !b?.success) return;
          const bk = b.data?.brandKit;
          if (bk?.name) setBrandName(bk.name);
          const fullLogo = typeof bk?.logo === "string" && bk.logo ? bk.logo : null;
          const iconLogo = typeof bk?.iconLogo === "string" && bk.iconLogo ? bk.iconLogo : null;
          setBrandLogo(fullLogo);
          setBrandIcon(iconLogo || fullLogo); // profile icon: square icon logo first, else full logo
          // Contact details + social handles → the canvas "Contact" tab.
          const addr = [bk?.city, bk?.state].filter(Boolean).join(", ") || bk?.address || undefined;
          const h = (bk?.handles && typeof bk.handles === "object") ? bk.handles : {};
          setBrandContact(bk ? { email: bk.email || undefined, phone: bk.phone || undefined, website: bk.website || undefined, address: addr, handles: { instagram: h.instagram || undefined, twitter: h.twitter || undefined, linkedin: h.linkedin || undefined, facebook: h.facebook || undefined, youtube: h.youtube || undefined, tiktok: h.tiktok || undefined } } : null);
          // Seed the canvas with the user's brand colors: swatches lead with them
          // and the default accent becomes the brand's primary (only while the
          // design is still untouched, so we never clobber the user's edits).
          const sw = [bk?.colors?.primary, bk?.colors?.secondary, bk?.colors?.accent].filter((c): c is string => typeof c === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c));
          if (sw.length) {
            setBrandColors(sw);
            setDesign((d) => {
              if (d !== DEFAULT_DESIGN) return d;
              const seeded = { ...d, accent: sw[0] };
              savedDesignRef.current = seeded;
              return seeded;
            });
          }
        }).catch(() => {});
        // Agent profile → managed businesses for the switcher.
        fetch("/api/agent/profile").then((r) => r.json()).then(async (p) => {
          if (!alive || p?.data?.profile?.status !== "APPROVED") return;
          const cl = await fetch("/api/agent/clients").then((r) => r.json()).catch(() => null);
          const list = cl?.data?.clients;
          if (alive && Array.isArray(list)) {
            setClients(list.map((c: { id: string; clientUser?: { name?: string } }) => ({ id: c.id, name: c.clientUser?.name || "Client" })));
          }
        }).catch(() => {});
        // AI starter suggestions (personalized) — non-blocking. Mark loaded when
        // the request RESOLVES (success or failure) so the loader can't spin
        // forever; the localized fallback chips already render meanwhile.
        fetch("/api/flow-ai/suggestions")
          .then((r) => r.json())
          .then((d) => {
            if (alive && d?.success && Array.isArray(d.data?.suggestions) && d.data.suggestions.length) setSuggestions(d.data.suggestions);
          })
          .catch(() => {})
          .finally(() => { if (alive) setSuggestionsLoaded(true); });
      } finally {
        const wait = Math.max(0, 650 - (Date.now() - started));
        setTimeout(() => alive && setBooting(false), wait);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Store status gates the Sell workspace: no store → show the build CTA, not an
  // empty Products/Orders menu. Re-checks after agent actions (a build flips it).
  useEffect(() => {
    let alive = true;
    fetch("/api/ecommerce/store")
      .then((r) => r.json())
      .then((j) => { if (alive) setHasStore(!!j?.data?.hasStore && !!j?.data?.store); })
      .catch(() => { if (alive) setHasStore(null); });
    return () => { alive = false; };
  }, [actionCount]);

  useEffect(() => {
    if (!accountOpen) return;
    const h = (e: MouseEvent) => { if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [accountOpen]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const h = (e: MouseEvent) => { if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [userMenuOpen]);

  // Keep the chat pinned to the newest content while the agent streams — the
  // message COUNT doesn't change as a single reply/plan/task card grows, so a
  // ResizeObserver on the list drives the scroll. We only auto-follow when the
  // user is already near the bottom. New sends / opened threads opt into one
  // forced bottom snap through requestChatAutoscroll(); background cards should
  // not yank the user away from older content they are reading.
  useEffect(() => {
    const anchor = bottomRef.current;
    const content = anchor?.parentElement;
    if (!anchor || !content) return;
    let sc: HTMLElement | null = content;
    while (sc && !/(auto|scroll)/.test(getComputedStyle(sc).overflowY)) sc = sc.parentElement;
    const toBottom = () => {
      if (sc) sc.scrollTop = sc.scrollHeight;
      anchor.scrollIntoView({ block: "end" });
    };
    const scheduleBottom = () => {
      if (!pinnedRef.current && !forceNextScrollRef.current) return;
      requestAnimationFrame(() => {
        toBottom();
        setTimeout(toBottom, 80);
        setTimeout(toBottom, 240);
      });
      forceNextScrollRef.current = false;
    };
    const onScroll = () => { if (sc) pinnedRef.current = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 150; };
    sc?.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(() => {
      scheduleBottom();
    });
    ro.observe(content);
    const mo = new MutationObserver(() => scheduleBottom());
    mo.observe(content, { childList: true, subtree: true, characterData: true });
    if (pinnedRef.current || forceNextScrollRef.current) {
      scheduleBottom();
    }
    return () => { sc?.removeEventListener("scroll", onScroll); ro.disconnect(); mo.disconnect(); };
  }, [messages.length === 0, conversationId, focused]);
  // Follow STREAMING growth too: the agent streams tokens / plan cards INTO an
  // existing message (message count unchanged), and the ResizeObserver above
  // misses it because the scroll container's own box size is fixed (flex-1) — only
  // its scrollHeight grows. Re-scroll on every message-content change while pinned.
  useEffect(() => {
    if (!pinnedRef.current && !forceNextScrollRef.current) return;
    const snap = () => bottomRef.current?.scrollIntoView({ block: "end" });
    requestAnimationFrame(snap);
    setTimeout(snap, 80);
    setTimeout(snap, 240);
    forceNextScrollRef.current = false;
  }, [messages, sending]);

  // Deep-link: load ?conversationId= on first mount, and keep the URL in sync
  // as the active conversation changes — so any chat is shareable / revisitable.
  useEffect(() => {
    const cid = searchParams.get("conversationId");
    if (cid) loadConversation(cid);
    refreshConversations();
    // Open the focused surface named in the path (/home/<view>) on deep-link.
    const seg = window.location.pathname.replace(/^\/home\/?/, "").split("/")[0];
    if (seg && FOCUS_VIEWS.has(seg)) setFocused(seg);
    // ?pitch=<id> — open Pitch Studio on a specific proposal (from a task card /
    // notification's "Open", new-design only — never the legacy pitch board).
    const openPitchId = searchParams.get("pitch");
    if (openPitchId) { setPitchTarget({ pitchId: openPitchId }); setFocused("pitchstudio"); }
    // ?campaign=<id> — open Campaign Studio on a specific content campaign (from
    // the create_content_campaign task card / notification's "Open").
    const openCampaignId = searchParams.get("campaign");
    if (openCampaignId) { setCampaignTarget({ campaignId: openCampaignId }); setFocused("campaign"); }
    // ?design=<id> — load a produced design into the Create canvas so "Open in
    // studio" from a task card continues editing it (chat carries over via cid).
    const designId = searchParams.get("design");
    if (designId) {
      fetch(`/api/designs/${designId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          const doc = j?.data?.design?.doc as DesignDoc | undefined;
          if (!doc) return;
          const d = { ...doc, generating: false, building: false };
          setDesign(d);
          savedDesignRef.current = d;
          setActiveWs("create");
          setFocused("create");
        })
        .catch(() => { /* ignore */ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the URL (path = focused surface, ?conversationId = active chat) in sync
  // in ONE guarded replaceState — only when it actually changes — to avoid
  // redundant history churn that can occasionally trip a soft→hard navigation.
  useEffect(() => {
    const url = new URL(window.location.href);
    url.pathname = focused ? `/home/${focused}` : "/home";
    if (conversationId) url.searchParams.set("conversationId", conversationId);
    else url.searchParams.delete("conversationId");
    if (url.toString() !== window.location.href) silentReplaceUrl(url.toString());
  }, [focused, conversationId]);

  // Autosave the in-progress design so a reload/remount restores unsaved edits.
  // Restore once on mount…
  useEffect(() => {
    try { const s = sessionStorage.getItem(DESIGN_DRAFT_KEY); if (s) { const parsed = JSON.parse(s) as DesignDoc; const d = { ...parsed, generating: false, building: false }; setDesign(d); savedDesignRef.current = d; } } catch { /* ignore */ }
  }, []);
  // …and persist every real change. We SKIP the pristine initial doc (it is
  // reference-equal to DEFAULT_DESIGN) so the first render — which runs before
  // the restore's setDesign commits, and twice under StrictMode — can never
  // clobber an already-saved draft back to default.
  useEffect(() => {
    if (design === DEFAULT_DESIGN) return;
    try { sessionStorage.setItem(DESIGN_DRAFT_KEY, JSON.stringify(design)); } catch { /* ignore */ }
  }, [design]);
  // Same restore/persist for the Print Studio canvas, under its OWN key.
  useEffect(() => {
    try { const s = sessionStorage.getItem(PRINT_DRAFT_KEY); if (s) { setPrintDesign({ ...(JSON.parse(s) as DesignDoc), generating: false, building: false }); } } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    if (printDesign === DEFAULT_DESIGN) return;
    try { sessionStorage.setItem(PRINT_DRAFT_KEY, JSON.stringify(printDesign)); } catch { /* ignore */ }
  }, [printDesign]);

  useEffect(() => { if (conversationId) refreshConversations(); }, [conversationId, refreshConversations]);

  // Page controls the design studio exposes so the AGENT can build multi-page /
  // multi-slide designs (add_design_page routes here via the canvas_update event).
  const pageOpsRef = useRef<{ addPage: () => void; goToPage: (i: number) => void } | null>(null);
  // Print Studio controls — the agent's start_print_project opens a print format
  // here (via the canvas_update `__print` marker), same mechanism as pages.
  const printOpsRef = useRef<{ selectFormat: (key: string) => void } | null>(null);
  // Compose bridge — the agent's write_compose_post routes the drafted caption
  // (+ optional platform pre-select) here via the canvas_update `__compose`
  // marker, so it lands in the caption box instead of the chat.
  const composeOpsRef = useRef<{ apply: (patch: Record<string, unknown>) => void } | null>(null);
  // Product-print mockup controls — the agent's place_design_on_product routes
  // here (via the canvas_update `__product` marker).
  const productOpsRef = useRef<{ setProduct: (patch: Record<string, unknown>) => void } | null>(null);
  // Live-fill bridges for the Ad builder + Follow-ups canvases: the focused
  // component populates getContext (the [ADBUILDER]/[FOLLOWUP]-tagged state we
  // send the agent) + applyPatch (the agent's update_ad_canvas / update_followup_
  // canvas fields, routed here via the `__ad` / `__followup` markers).
  const adOpsRef = useRef<{ getContext: () => string; applyPatch: (patch: Record<string, unknown>) => void } | null>(null);
  // Video Studio (/home/video) bridge: getContext feeds the [STORYAD] canvas
  // context to the agent; loadCampaign lets the agent's draft appear on the canvas.
  const videoOpsRef = useRef<{ getContext: () => string; loadCampaign: (id: string) => void } | null>(null);
  // Reel Studio (/home/reel) bridge — same shape: getContext feeds the canvas
  // context; loadCampaign lets the agent's fresh reel campaign appear on the canvas.
  const reelOpsRef = useRef<{ getContext: () => string; loadCampaign: (id: string) => void } | null>(null);
  const followupOpsRef = useRef<{ getContext: () => string; applyPatch: (patch: Record<string, unknown>) => void } | null>(null);
  // Which canvas is live, for routing agent patches to the right document.
  const focusedRef = useRef(focused);
  focusedRef.current = focused;
  // Apply agent-driven canvas edits (update_canvas → canvas_update event) live.
  useEffect(() => {
    canvasUpdateRef.current = (patch) => {
      const productCmd = (patch as { __product?: unknown }).__product;
      if (productCmd && typeof productCmd === "object") {
        productOpsRef.current?.setProduct(productCmd as Record<string, unknown>);
        return;
      }
      const printCmd = (patch as { __print?: unknown }).__print;
      if (printCmd && typeof printCmd === "object") {
        const fmt = (printCmd as { format?: unknown }).format;
        if (typeof fmt === "string") {
          // If the Print mode is live, open the format directly; otherwise flip the
          // Design Studio into Print mode and let it open the format on mount.
          if (printOpsRef.current) printOpsRef.current.selectFormat(fmt);
          else { setPrintInitialFormat(fmt); setActiveWs("create"); setFocused("print"); }
        }
        return;
      }
      const composeCmd = (patch as { __compose?: unknown }).__compose;
      if (composeCmd && typeof composeCmd === "object") {
        composeOpsRef.current?.apply(composeCmd as Record<string, unknown>);
        return;
      }
      const pageCmd = (patch as { __page?: unknown }).__page;
      if (pageCmd !== undefined) {
        if (pageCmd === "add") pageOpsRef.current?.addPage();
        else if (typeof pageCmd === "number") pageOpsRef.current?.goToPage(pageCmd);
        return;
      }
      const adCmd = (patch as { __ad?: unknown }).__ad;
      if (adCmd && typeof adCmd === "object") { adOpsRef.current?.applyPatch(adCmd as Record<string, unknown>); return; }
      const followupCmd = (patch as { __followup?: unknown }).__followup;
      if (followupCmd && typeof followupCmd === "object") { followupOpsRef.current?.applyPatch(followupCmd as Record<string, unknown>); return; }
      // Video Studio: the agent drafted a story-ad campaign — load it onto the canvas.
      const storyadCmd = (patch as { __storyad?: { campaignId?: string } }).__storyad;
      if (storyadCmd && typeof storyadCmd === "object" && storyadCmd.campaignId) { videoOpsRef.current?.loadCampaign(storyadCmd.campaignId); return; }
      // Reel Studio: the agent built a reel campaign — load it onto the canvas.
      const reelCmd = (patch as { __reel?: { campaignId?: string } }).__reel;
      if (reelCmd && typeof reelCmd === "object" && reelCmd.campaignId) { reelOpsRef.current?.loadCampaign(reelCmd.campaignId); return; }
      // Route the edit to whichever canvas is open (Print has its own document).
      const apply = (d: DesignDoc) => applyDesignPatch(d, patch);
      if (focusedRef.current === "print") setPrintDesign(apply); else setDesign(apply);
    };
  }, [canvasUpdateRef]);

  // Track unsaved changes in the active focused view so navigation can guard.
  useEffect(() => {
    if (focused === "create") {
      dirtyRef.current = JSON.stringify(design) !== JSON.stringify(savedDesignRef.current);
      saverRef.current = () => { savedDesignRef.current = design; dirtyRef.current = false; };
    } else if (focused === "account" || focused === "profile") {
      dirtyRef.current = settingsDirty;
      saverRef.current = null;
    } else if (focused === "brand") {
      // FocusedBrand manages dirtyRef + saverRef itself.
    } else {
      dirtyRef.current = false;
      saverRef.current = null;
    }
  }, [focused, design, settingsDirty]);

  const showToast = useCallback((m: string) => {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  }, []);

  // Persist an uploaded logo to the brand kit (preserving the rest of the kit).
  const handleSaveBrandLogo = useCallback(async (url: string): Promise<boolean> => {
    try {
      const cur = await fetch("/api/brand").then((r) => r.json()).catch(() => null);
      const bk = cur?.data?.brandKit;
      const payload = bk ? { ...bk, logo: url } : { name: brandName || "My Brand", logo: url };
      const res = await fetch("/api/brand", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { showToast("Couldn't save the logo to your brand"); return false; }
      setBrandLogo(url);
      showToast("Saved to your brand kit");
      return true;
    } catch { showToast("Couldn't save the logo to your brand"); return false; }
  }, [brandName, showToast]);

  const switchToClient = useCallback(async (clientId: string) => {
    try {
      await fetch("/api/agent/impersonate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId }) });
      window.location.href = "/home";
    } catch { showToast("Could not switch business"); }
  }, [showToast]);

  const exitImpersonation = useCallback(async () => {
    try { await fetch("/api/agent/impersonate", { method: "DELETE" }); window.location.href = "/home"; } catch { showToast("Could not exit"); }
  }, [showToast]);

  const firstName = (user?.name?.trim().split(/\s+/)[0]) || "there";
  const initials = (user?.name ?? "you").split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const accountLabel = brandName || user?.name || "My account";
  const hour = mounted ? new Date().getHours() : 18;
  const greeting = buildGreeting(s, firstName, hour);
  const empty = messages.length === 0;
  const isAccountFocus = focused === "account";
  const isProfileFocus = focused === "profile";
  const isBrandFocus = focused === "brand";
  const isAnalyticsFocus = focused === "analytics";
  const isBillingFocus = focused === "billing";
  const isConnectionsFocus = focused === "connections";
  const fws = focused && !isAccountFocus && !isProfileFocus && !isBrandFocus && !isAnalyticsFocus && !isBillingFocus && !isConnectionsFocus ? WORKSPACES.find((w) => w.key === focused) : undefined;
  const fMeta = focused ? FOCUS_META[focused] : undefined;
  // Design Studio & Print are ONE surface (screen vs print MODE) — same identity,
  // same rail highlight; a Screen⇄Print toggle in the header switches modes while
  // keeping the two documents (design / printDesign) isolated. [[print-studio-reuses-canvas]]
  const isDesignSurface = focused === "create" || focused === "print";
  const fLabel = isDesignSurface ? "Design Studio" : isProfileFocus ? "Profile" : isAccountFocus ? "Account & settings" : isBrandFocus ? "Brand identity" : isAnalyticsFocus ? "Analytics" : isBillingFocus ? "Billing & credits" : isConnectionsFocus ? "Connections" : fMeta ? fMeta.label : fws ? (s.ws[fws.key] ?? fws.label) : "Focused view";
  const FIcon = isDesignSurface ? Palette : isProfileFocus ? User : isAccountFocus ? Settings : isBrandFocus ? Palette : isAnalyticsFocus ? TrendingUp : isBillingFocus ? CreditCard : isConnectionsFocus ? Link2 : fMeta ? fMeta.icon : fws?.icon ?? Sparkles;
  // Consolidated rail: Print → Create, Campaign → Publish, Leads → Outreach.
  const primaryWorkspaces = WORKSPACES.filter((w) => !["business", "print", "campaign", "leads"].includes(w.key));
  const businessWorkspace = WORKSPACES.find((w) => w.key === "business");

  const openWorkspace = (key: string) => {
    // Home returns to the fresh, empty initial state (greeting + suggestions) —
    // clears the conversation, exits the focused view, closes panels. This LEAVES
    // the current view, so it's guarded for unsaved changes.
    if (key === "home") {
      guardNav(() => {
        newConversation();
        setFocused(null);
        setActiveWs("home");
        setPanelKey(null);
        setHistoryOpen(false);
        setDrawerOpen(false);
      });
      return;
    }
    // Browsing a category just opens its menu panel on the RIGHT — it does NOT
    // leave the current focused view (the view stays mounted behind the panel).
    // Only picking an item (onOpenView) or Home actually navigates away, so
    // there's no guard here. Remember where to return if the panel is closed.
    if (!panelKey) panelReturnWs.current = focused ? activeWs : "home";
    setActiveWs(key);
    setPanelKey(key);
    setDrawerOpen(false);
  };
  const openFocused = (key: string) => { const target = key === "business" ? "brand" : key === "grow" ? "analytics" : key; setPanelKey(null); setActiveWs(key); setFocused(target); setDrawerOpen(false); if (target === "create") savedDesignRef.current = design; };
  const openBrand = () => { setHistoryOpen(false); setPanelKey(null); setActiveWs("business"); setFocused("brand"); setDrawerOpen(false); };
  const openAccount = () => { setUserMenuOpen(false); setHistoryOpen(false); setPanelKey(null); setSettingsDirty(false); setSettingsInitialTab(undefined); setActiveWs("business"); setFocused("account"); };
  const openConnections = () => { setHistoryOpen(false); setPanelKey(null); setActiveWs("connections"); setFocused("connections"); setDrawerOpen(false); };
  const openBilling = () => { setHistoryOpen(false); setPanelKey(null); setActiveWs("business"); setFocused("billing"); setDrawerOpen(false); };
  // Open a sub-surface (domains, pitch, customers, …) from within its parent
  // workspace — keeps the current rail selection. New-design only, never legacy.
  const openView = (key: string, hint?: string) => {
    if (key === "campaign") { setCampaignTarget({}); setCampaignInitialView(hint === "library" ? "library" : "new"); }
    if (key === "leads" && hint) setLeadsInitialScreen(hint);
    if (key === "print") setPrintInitialFormat(hint ?? null);
    setHistoryOpen(false);
    setPanelKey(null);
    setFocused(key);
    setDrawerOpen(false);
  };
  // Flip the Design Studio between Screen (create) and Print modes — same surface,
  // so it's NOT guarded like leaving a view (each mode autosaves its own document).
  const switchDesignMode = (mode: "create" | "print") => {
    if (focused === mode) return;
    setHistoryOpen(false);
    setPanelKey(null);
    setDrawerOpen(false);
    setActiveWs("create");
    if (mode === "create") savedDesignRef.current = design;
    setFocused(mode);
  };
  // Open Pitch Studio for a lead — set the target BEFORE switching surfaces so the
  // child mounts with it. Keeps the current rail (Leads).
  const openPitchStudio = (t: { leadId?: string; leadName?: string; pitchId?: string }) => { setPitchTarget(t); setHistoryOpen(false); setPanelKey(null); setFocused("pitchstudio"); setDrawerOpen(false); };
  // Open Campaign Studio (empty target = start a new campaign).
  const openCampaignStudio = (t?: { campaignId?: string; brief?: string }) => { setCampaignTarget(t ?? {}); setCampaignInitialView(t?.campaignId ? "library" : "new"); setHistoryOpen(false); setPanelKey(null); setFocused("campaign"); setDrawerOpen(false); };
  // Load a produced design into the Create canvas (shared by ?design= deep-link
  // and the task-card "Open in studio" client-side nav).
  const openDesignById = (designId: string) => {
    fetch(`/api/designs/${designId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const doc = j?.data?.design?.doc as DesignDoc | undefined;
        if (!doc) return;
        const d = { ...doc, generating: false, building: false };
        setDesign(d); savedDesignRef.current = d; setActiveWs("create"); setFocused("create");
      })
      .catch(() => { /* ignore */ });
  };
  // Client-side "Open" from an agent task card / notification: switch the
  // focused surface IN PLACE instead of a full-page reload. Returns true when it
  // handled the link (the card's OpenLink then preventDefaults); false lets the
  // browser follow the href. [[agent-writes-into-ui-element-not-chat]]
  const navigateInApp = (href: string): boolean => {
    try {
      const url = new URL(href, window.location.origin);
      if (!url.pathname.startsWith("/home")) return false;
      const pitchId = url.searchParams.get("pitch");
      if (pitchId) { guardNav(() => openPitchStudio({ pitchId })); return true; }
      const campaignId = url.searchParams.get("campaign");
      if (campaignId) { guardNav(() => openCampaignStudio({ campaignId })); return true; }
      const designId = url.searchParams.get("design");
      if (designId) { guardNav(() => openDesignById(designId)); return true; }
      const leadListId = url.searchParams.get("leadList");
      if (leadListId) { guardNav(() => { setLeadsInitialListId(leadListId); openView("leads", "contacts"); }); return true; }
      const seg = url.pathname.replace(/^\/home\/?/, "").split("/")[0];
      if (seg && FOCUS_VIEWS.has(seg)) { guardNav(() => openView(seg)); return true; }
      if (!seg) { guardNav(() => setFocused(null)); return true; }
      return false;
    } catch { return false; }
  };
  // A button-driven agent action: the instruction is INTERNAL (not shown as a
  // user message) — the user just sees the agent work + respond. Carries the
  // current surface context so the agent acts in place.
  // Carry the design canvas context on the design AND print surfaces, so the
  // agent's canvas tools (update_canvas / add_design_page / start_print_project)
  // stay exposed when a button-driven action fires from the Print Studio hero.
  // The live-fill surfaces (Ad builder / Follow-ups) supply their own tagged
  // canvasContext via their ref bridge so the agent can write into them.
  const canvasCtxFor = (): string | undefined =>
    focused === "print" ? designCanvasContext(printDesign)
      : focused === "create" ? designCanvasContext(design)
        : focused === "adbuilder" ? (adOpsRef.current?.getContext() || undefined)
          : focused === "automations" ? (followupOpsRef.current?.getContext() || undefined)
            : focused === "video" ? (videoOpsRef.current?.getContext() || undefined)
              : focused === "reel" ? (reelOpsRef.current?.getContext() || undefined)
                : undefined;
  const sendAction = (p: string) => send(p, false, canvasCtxFor(), focused ? focusedSurfaceContext(focused, brandName, openResource) : undefined, { hidden: true });
  const sendActionFiles = (p: string, atts: { dataUrl?: string; url?: string; name: string; mediaType?: "image" | "video" }[]) => send(p, false, canvasCtxFor(), focused ? focusedSurfaceContext(focused, brandName, openResource) : undefined, { hidden: true, attachments: atts });
  const isMobile = useIsMobile();
  const [composerSeed, setComposerSeed] = useState<{ text: string; nonce: number } | null>(null);
  // Which campaign post (if any) is picking media from the library modal. The
  // modal supports BOTH selecting existing assets AND uploading new ones, so it
  // is the single "Library"/"attach" entry point — no separate upload prompt.
  const [mediaPicker, setMediaPicker] = useState<{ postId: string; campaignId: string } | null>(null);
  const [revealChat, setRevealChat] = useState(0);
  const seedComposer = useCallback((text: string) => {
    setComposerSeed((s) => ({ text, nonce: (s?.nonce ?? 0) + 1 }));
    setRevealChat((n) => n + 1);
  }, []);
  // A user interaction with an agent-authored view rendered inline in the chat.
  // A pure deep-link (open a studio/surface) navigates in place; every other
  // interaction (tap/input/rate/pick) is relayed to the agent as a hidden
  // instruction so it continues the flow without the user leaving the chat.
  const handleViewEvent = (e: ViewEvent) => {
    const href = e.action.href;
    if (href && navigateInApp(href)) return;
    if (href && /^\/api\/pitch\/[^/]+\/pdf(?:\?|$)/.test(href)) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    // "Library" button OR an empty media slot's "click to attach": open the
    // media-library modal (it lists existing assets AND has its own Upload
    // button), then attach whatever the user picks. One entry point for both
    // "choose from library" and "upload new" — no separate Upload prompt.
    if (e.action.event === "pick_campaign_post_media" || e.action.event === "upload_campaign_post_media") {
      const payload = e.action.payload || {};
      const postId = typeof payload.postId === "string" ? payload.postId : "";
      const campaignId = typeof payload.campaignId === "string" ? payload.campaignId : "";
      if (postId) { setMediaPicker({ postId, campaignId }); return; }
    }
    // "Add media" / "Redo media": ONE button for both image and video — hand off
    // to the agent, which asks which type then generates it (regenerate_post_image
    // / regenerate_post_video). Generation only; attaching an existing file is the
    // Library button above.
    if (e.action.event === "post_media") {
      const payload = e.action.payload || {};
      const postId = typeof payload.postId === "string" ? payload.postId : "";
      const campaignId = typeof payload.campaignId === "string" ? payload.campaignId : "";
      const hasMedia = payload.hasMedia === true;
      sendAction([
        `The user wants to ${hasMedia ? "replace the media on" : "add media to"} a campaign post.`,
        postId ? `Post id: "${postId}".` : "",
        campaignId ? `Campaign id: "${campaignId}".` : "",
        "First ask ONE short question — image or video? — unless they've already said which.",
        "Then generate it: regenerate_post_image for an image, regenerate_post_video for a video (pass that postId and campaignId, tier \"standard\").",
        "Do NOT offer file upload here — that is the separate Library button.",
      ].filter(Boolean).join(" "));
      return;
    }
    const parts: string[] = [`The user interacted with the "${e.action.event}" control in a view you rendered.`];
    if (e.name) parts.push(`Field: ${e.name}.`);
    if (e.value !== undefined && e.value !== null && e.value !== "") {
      const v = typeof e.value === "string" ? e.value : JSON.stringify(e.value);
      parts.push(`Value: ${v.slice(0, 600)}.`);
    }
    if (e.action.payload && Object.keys(e.action.payload).length) parts.push(`Context: ${JSON.stringify(e.action.payload).slice(0, 600)}.`);
    if (e.action.tool) parts.push(`The intended tool is ${e.action.tool}.`);
    if (href) parts.push(`Related link: ${href}.`);
    parts.push("Act on it and confirm — do not re-ask what the view already captured.");
    sendAction(parts.join(" "));
  };
  // A photo SLOT's "Generate" button — drive the agent to generate a contextual
  // photo and drop it into that exact slot (it may ask one clarifying question).
  const sendFillSlot = (layer: { id: string; label?: string; genHint?: string }, doc: DesignDoc) => send(
    [
      `Fill the photo SLOT on my open design. Slot id: "${layer.id}"${layer.label ? ` (a "${layer.label}")` : ""}.`,
      layer.genHint ? `It should show: ${layer.genHint}.` : "",
      `Generate a fitting, on-brand PHOTO with add_canvas_object type "photo", passing slotId "${layer.id}" — it drops into that exact slot. Base it on the design (headline/offer/style/accent). If it's genuinely unclear what the photo should depict, ask me ONE short question first; otherwise propose_plan (the image cost) then generate.`,
    ].filter(Boolean).join(" "),
    false, designCanvasContext(doc), undefined, { hidden: true },
  );
  const openProfile = () => { setUserMenuOpen(false); setHistoryOpen(false); setPanelKey(null); setSettingsDirty(false); setActiveWs("business"); setFocused("profile"); };

  const handleNewChat = () => { newConversation(); setFocused(null); setActiveWs("home"); setPanelKey(null); setHistoryOpen(false); setDrawerOpen(false); };
  const handleOpenConversation = (id: string) => { setFocused(null); setActiveWs("home"); setPanelKey(null); setHistoryOpen(false); setDrawerOpen(false); loadConversation(id); };
  const handleDeleteConversation = async (id: string) => {
    try { await fetch(`/api/ai/assistant/conversations/${id}`, { method: "DELETE" }); } catch { /* ignore */ }
    if (id === conversationId) newConversation();
    refreshConversations();
  };
  const handleLogout = async () => {
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch { /* ignore */ }
    window.location.href = "/login";
  };
  // Intercept navigation away from a focused view that has unsaved changes.
  const guardNav = (proceed: () => void) => {
    if (focused && dirtyRef.current) setLeaveAction({ run: proceed });
    else proceed();
  };

  if (booting) {
    return (
      <div className="fixed inset-0 z-[100] grid place-items-center bg-background">
        <PageLoader tips={["Loading your workspace…", "Syncing your brand kit…", "Warming up the agent…"]} />
      </div>
    );
  }

  return (
    <AgentNavContext.Provider value={navigateInApp}>
    <div
      dir={dir}
      className="flex h-[100dvh] flex-col bg-background text-foreground"
      style={{ backgroundImage: "radial-gradient(1100px 600px at 82% -10%, rgba(14,165,233,.10), transparent 60%), radial-gradient(900px 600px at -5% 110%, rgba(139,92,246,.09), transparent 55%)" }}
    >
      {/* AGENT MODE BANNER */}
      {isImpersonating && (
        <div className="flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-brand-500 px-3 py-1.5 text-center text-xs font-medium text-white">
          <Shield className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Agent Mode — managing <b>{user?.name}</b>{agentName ? ` · ${agentName}` : ""}</span>
          <button onClick={exitImpersonation} className="ms-1 inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 hover:bg-white/30">
            <LogOut className="h-3 w-3" /> Exit
          </button>
        </div>
      )}

      {/* TOP BAR */}
      <header className="relative z-40 flex h-14 items-center gap-2 border-b border-border bg-background/70 px-3 backdrop-blur sm:gap-3 sm:px-4">
        <button onClick={() => setDrawerOpen(true)} className="grid h-9 w-9 place-items-center rounded-[10px] text-muted-foreground hover:text-foreground md:hidden" aria-label="Menu">
          <Menu className="h-5 w-5" />
        </button>
        <BrandMark size={34} />
        <BrandWordmark className="hidden text-[16px] sm:inline" />

        {/* account / business switcher (desktop) */}
        <div className="relative hidden md:block" ref={accountRef}>
          <button onClick={() => setAccountOpen((o) => !o)} className="ms-1.5 flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[12.5px]">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            <b className="max-w-[150px] truncate text-foreground">{accountLabel}</b>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          {accountOpen && (
            <div
              className="absolute left-0 z-50 mt-2 w-64 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-2xl"
              style={{ maxHeight: "20rem", overflowY: "auto", overscrollBehavior: "contain" }}
            >
              <AccountMenu accountLabel={accountLabel} clients={clients} isImpersonating={isImpersonating} onSwitch={switchToClient} onExit={exitImpersonation} onManage={() => router.push("/agent/clients")} />
            </div>
          )}
        </div>

        {/* Quick access to the Brand Kit (identity that powers all AI) — not just
            via the setup banner. */}
        <button
          onClick={() => guardNav(openBrand)}
          title="Brand Kit — your identity (logo, colors, voice) that powers all AI"
          className={cn(
            "ms-1.5 hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] transition md:flex",
            isBrandFocus ? "border-brand-500/60 bg-brand-500/10 text-brand-500" : "border-border bg-card hover:border-brand-500/60 hover:text-foreground",
          )}
        >
          <Palette className="h-3.5 w-3.5 text-brand-500" />
          <span className="font-medium">Brand Kit</span>
        </button>

        {/* Escape hatch to the classic (legacy) dashboard — a small pill until it's retired. */}
        <a
          href="/dashboard"
          title="Open the classic dashboard (legacy)"
          className="ms-1.5 hidden items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[12.5px] transition hover:border-brand-500/60 hover:text-foreground lg:flex"
        >
          <LayoutTemplate className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium">Classic</span>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">legacy</span>
        </a>

        <div className="flex-1" />

        <button onClick={() => guardNav(openBilling)} title="Billing & credits" className="flex items-center gap-1 rounded-full border border-border bg-gradient-to-r from-brand-500/15 to-violet-500/15 px-2.5 py-1.5 text-[12.5px] transition hover:border-brand-500/60 sm:px-3">
          ⚡ <b className="bg-gradient-to-r from-brand-500 to-violet-500 bg-clip-text font-extrabold text-transparent">{(user?.aiCredits ?? 0).toLocaleString()}</b>
          <span className="hidden text-muted-foreground sm:inline">{s.credits}</span>
        </button>
        <button onClick={() => guardNav(handleNewChat)} title="New chat" aria-label="New chat" className="grid h-9 w-9 place-items-center rounded-[10px] border border-border bg-card text-muted-foreground transition-colors hover:border-brand-500/60 hover:text-foreground md:hidden"><SquarePen className="h-[18px] w-[18px]" /></button>
        <button onClick={() => setHistoryOpen(true)} title="History" aria-label="History" className="grid h-9 w-9 place-items-center rounded-[10px] border border-border bg-card text-muted-foreground transition-colors hover:border-brand-500/60 hover:text-foreground md:hidden"><History className="h-[18px] w-[18px]" /></button>
        <div className="md:hidden"><ThemeMenu /></div>
        <div className="hidden items-center gap-1 md:flex">
          <button onClick={() => guardNav(handleNewChat)} title="New chat" aria-label="New chat" className="grid h-9 w-9 place-items-center rounded-[10px] border border-border bg-card text-muted-foreground transition-colors hover:border-brand-500/60 hover:text-foreground"><SquarePen className="h-[18px] w-[18px]" /></button>
          <button onClick={() => setHistoryOpen(true)} title="History" aria-label="History" className="grid h-9 w-9 place-items-center rounded-[10px] border border-border bg-card text-muted-foreground transition-colors hover:border-brand-500/60 hover:text-foreground"><History className="h-[18px] w-[18px]" /></button>
          <LanguageSwitcher language={language} onChange={setLanguage} />
          <ThemeMenu />
        </div>
        <div className="relative shrink-0" ref={userMenuRef}>
          <button onClick={() => setUserMenuOpen((o) => !o)} className="relative grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-pink-500 to-violet-500 text-[12px] font-bold text-white ring-offset-2 ring-offset-background transition hover:ring-2 hover:ring-brand-500/50" aria-label="Account menu" title={brandName || user?.name || "Account menu"}>
            {brandIcon ? (
              // Brand mark from the kit (square icon logo, else full logo). White
              // backing so a transparent logo still reads on the dark header.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brandIcon} alt="" className="absolute inset-0 h-full w-full bg-white object-cover" />
            ) : (
              initials
            )}
          </button>
          {userMenuOpen && (
            <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-2xl">
              <div className="border-b border-border px-2.5 pb-2 pt-1">
                <p className="truncate text-[13px] font-semibold">{user?.name ?? "You"}</p>
                {user?.email && <p className="truncate text-[11.5px] text-muted-foreground">{user.email}</p>}
              </div>
              <button onClick={() => guardNav(openProfile)} className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-muted">
                <User className="h-4 w-4 text-muted-foreground" /> Profile
              </button>
              <button onClick={() => { setUserMenuOpen(false); guardNav(openBrand); }} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-muted">
                <Palette className="h-4 w-4 text-muted-foreground" /> Brand Kit
              </button>
              <button onClick={() => guardNav(openAccount)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-muted">
                <Settings className="h-4 w-4 text-muted-foreground" /> Account &amp; settings
              </button>
              <button onClick={() => { setUserMenuOpen(false); guardNav(() => openView("teams")); }} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-muted">
                <Users className="h-4 w-4 text-muted-foreground" /> Teams
              </button>
              <button onClick={() => { setUserMenuOpen(false); guardNav(() => openView("referrals")); }} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-muted">
                <Gift className="h-4 w-4 text-muted-foreground" /> Referrals
              </button>
              <button onClick={() => { setUserMenuOpen(false); guardNav(openBilling); }} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-muted">
                <CreditCard className="h-4 w-4 text-muted-foreground" /> Billing &amp; credits
              </button>
              <div className="my-1 h-px bg-border" />
              {/* Escape hatch to the previous (classic) dashboard while we finish
                  retiring it. Full navigation — leaves the agent shell. */}
              <a href="/dashboard" onClick={() => setUserMenuOpen(false)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-muted">
                <LayoutTemplate className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="whitespace-nowrap">Classic dashboard</span>
                <span className="ms-auto shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">legacy</span>
              </a>
              <div className="my-1 h-px bg-border" />
              <button onClick={handleLogout} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-destructive hover:bg-destructive/10">
                <LogOut className="h-4 w-4" /> Log out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* BODY */}
      <div className="flex min-h-0 flex-1">
        {/* desktop workspace rail */}
        <nav className="hidden w-[84px] shrink-0 flex-col items-center gap-1 overflow-y-auto overscroll-contain border-e border-border bg-card/50 py-3 md:flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {primaryWorkspaces.map((w, i) => {
            const Icon = w.icon;
            const active = activeWs === w.key;
            return (
              <div key={w.key} className="contents">
                <button onClick={() => openWorkspace(w.key)} className={cn("relative flex w-[66px] flex-col items-center gap-1.5 rounded-[13px] py-2.5 text-[10px] transition-colors", active ? "bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                  {active && <span className="absolute inset-y-4 start-[-1px] w-[3px] rounded bg-gradient-to-b from-brand-500 to-violet-500" />}
                  <Icon className="h-[21px] w-[21px]" />
                  <span>{s.ws[w.key] ?? w.label}</span>
                </button>
                {(i === 0 || w.key === "leads") && <div className="my-1.5 h-px w-11 bg-border" />}
              </div>
            );
          })}
          <div className="mt-auto h-px w-11 bg-border" />
          <button onClick={() => guardNav(openConnections)} className={cn("relative flex w-[66px] flex-col items-center gap-1.5 rounded-[13px] py-2.5 text-[10px] transition-colors", activeWs === "connections" ? "bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
            {activeWs === "connections" && <span className="absolute inset-y-4 start-[-1px] w-[3px] rounded bg-gradient-to-b from-brand-500 to-violet-500" />}
            <Link2 className="h-[21px] w-[21px]" />
            <span>Social</span>
          </button>
          {businessWorkspace && (() => {
            const Icon = businessWorkspace.icon;
            const active = activeWs === businessWorkspace.key;
            return (
              <button onClick={() => openWorkspace(businessWorkspace.key)} className={cn("relative flex w-[66px] flex-col items-center gap-1.5 rounded-[13px] py-2.5 text-[10px] transition-colors", active ? "bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                {active && <span className="absolute inset-y-4 start-[-1px] w-[3px] rounded bg-gradient-to-b from-brand-500 to-violet-500" />}
                <Icon className="h-[21px] w-[21px]" />
                <span>{s.ws[businessWorkspace.key] ?? businessWorkspace.label}</span>
              </button>
            );
          })()}
        </nav>

        {/* main */}
        <main className="relative flex min-w-0 flex-1 flex-col overflow-x-clip">
          {/* setup prompts live in the main column so the rail stays full-height; CTAs drive the agent, never legacy links */}
          <SetupBanners onPrompt={(t) => { setFocused(null); setActiveWs("home"); send(t, false, undefined, undefined, { hidden: true }); }} onOpenBrand={openBrand} refreshKey={actionCount} />
          {focused ? (
            <FocusedView
              title={fLabel}
              subtitle={isDesignSurface ? "Graphics, ads & print — one canvas" : focused === "profile" ? "Your public profile" : focused === "account" ? "Notifications · security · billing" : focused === "brand" ? "Your brand kit — powers all AI" : focused === "analytics" ? "Performance · usage · activity" : focused === "billing" ? "Credits · plan · usage · transactions" : focused === "connections" ? "Connect your social accounts" : fMeta ? fMeta.subtitle : WS_DESC[focused]}
              icon={FIcon}
              agentBusy={sending}
              onClose={() => guardNav(() => { setFocused(null); setActiveWs("home"); })}
              headerActions={isDesignSurface ? (
                // Screen ⇄ Print mode switch — the deep Print↔Design merge. Both modes
                // are the same "Design Studio" surface; each keeps its own document.
                <div className="inline-flex overflow-hidden rounded-[10px] border border-border" role="tablist" aria-label="Design mode">
                  <button onClick={() => switchDesignMode("create")} role="tab" aria-selected={focused === "create"} title="Design for screen — posts, ads & graphics" className={cn("inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-semibold transition", focused === "create" ? "bg-brand-500/10 text-brand-500" : "text-muted-foreground hover:text-foreground")}>
                    <Monitor className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Screen</span>
                  </button>
                  <button onClick={() => switchDesignMode("print")} role="tab" aria-selected={focused === "print"} title="Print-ready formats — flyers, cards, brochures & product prints" className={cn("inline-flex items-center gap-1.5 border-s border-border px-2.5 py-1.5 text-[12px] font-semibold transition", focused === "print" ? "bg-brand-500/10 text-brand-500" : "text-muted-foreground hover:text-foreground")}>
                    <Printer className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Print</span>
                  </button>
                </div>
              ) : focused === "leads" ? (
                <button onClick={() => setLeadsMenuOpen((v) => !v)} title="Show / hide menu" className="grid h-8 w-8 place-items-center rounded-[10px] border border-border text-muted-foreground hover:text-foreground">
                  <PanelRight className="h-[18px] w-[18px]" />
                </button>
              ) : undefined}
              chat={
                <>
                  <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
                    {messages.length === 0 ? (
                      <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{(focused && FOCUS_CHAT_HINT[focused]) || DEFAULT_CHAT_HINT}</p>
                    ) : (
                      messages.map((m) => (
                        <HomeMessageView key={m.id} message={m} initials={initials} conversationId={conversationId} onPlanResponse={handlePlanResponse} onPickTemplate={handlePickTemplate} onPickOption={handlePickOption} onViewEvent={handleViewEvent} />
                      ))
                    )}
                    <div ref={bottomRef} />
                  </div>
                  <div className="border-t border-border p-3">
                    <Composer onSend={(t, sm, atts) => send(t, sm, canvasCtxFor(), focused ? focusedSurfaceContext(focused, brandName, openResource) : undefined, { attachments: atts })} sending={sending} placeholder={s.placeholder} autoFocus seed={composerSeed} />
                  </div>
                </>
              }
              canvas={
                focused === "create" ? (
                  <FocusedDesignStudio
                    value={design}
                    onChange={setDesign}
                    pageOpsRef={pageOpsRef}
                    brandColors={brandColors}
                    brandContact={brandContact ?? undefined}
                    brandLogo={brandLogo}
                    onSaveBrandLogo={handleSaveBrandLogo}
                    working={sending}
                    onSave={() => { savedDesignRef.current = design; dirtyRef.current = false; }}
                    onPlaceholderGenerate={(layer) => sendFillSlot(layer, design)}
                    onElementAssist={(el) => {
                      const label = el === "headline" ? "headline" : el === "sub" ? "subtext" : el === "eyebrow" ? "eyebrow / tagline" : "call-to-action button text";
                      // Propose a few options as a clickable card instead of silently
                      // applying one — the user picks, THEN we apply only that field.
                      send(
                        `Suggest 3 distinct, genuinely punchier on-brand options for the ${label} of the open design — short and high-impact, NOT just re-capitalized or trivially reworded. Use the ask_choice tool to show them as a clickable card: each option's label = the exact new ${label} text, the sublabel = the angle in 2-4 words. Do NOT change the canvas yet. When I tap one, apply ONLY the "${el}" field via update_canvas and keep the eyebrow, headline, subtext, button, accent, style and size you're NOT changing EXACTLY as they are, then confirm in one short sentence.`,
                        false, designCanvasContext(design), undefined, { hidden: true },
                      );
                    }}
                    onRegenerate={(details) => {
                      const refs = (design.images ?? []).filter((i) => !i.local && i.url).map((i) => `${i.kind}: ${i.url}`);
                      send(
                        [
                          `Create a branded design image for the open canvas, using my CURRENT design as the layout inspiration (keep this structure):`,
                          `- eyebrow: ${JSON.stringify(design.eyebrow)}`,
                          `- headline: ${JSON.stringify(design.headline)}`,
                          `- subtext: ${JSON.stringify(design.sub)}`,
                          `- button (CTA): ${JSON.stringify(design.cta)}`,
                          `- accent: ${design.accent}; style: ${design.style || "modern"}; size: ${design.size}`,
                          refs.length ? `- USE MY images and PRESERVE them — pass these in referenceImageUrls: ${refs.join("; ")}` : "",
                          details.trim() ? `- extra direction from me: ${details.trim()}` : "",
                          `Ask me the tier (standard or premium) if I haven't said, then generate it — it renders right on this canvas.`,
                        ].filter(Boolean).join("\n"),
                        false, designCanvasContext(design), undefined, { hidden: true },
                      );
                    }}
                    onBuildEditable={async (details) => {
                      // Editable mode: drop any flat render so the editable elements
                      // show, flip on the "Redesigning…" loader, then drive the agent to
                      // rebuild a BETTER editable design (update_canvas keeps everything
                      // drag-to-edit; no baked image). The loader clears when the turn ends.
                      const base = { ...design, imageUrl: undefined };
                      setDesign({ ...base, building: true });
                      const refs = (base.images ?? []).filter((i) => !i.local && i.url).map((i) => `${i.kind}: ${i.url}`);
                      const brandList = brandColors.length ? brandColors.join(", ") : "(none set — use get_brand_identity)";
                      try {
                        await send(
                          [
                            `Rebuild the OPEN canvas as a better, FULLY EDITABLE design — you are the art director of a live editable canvas, so do a REAL coordinated redesign, not a one-line tweak. Use update_canvas (and add_canvas_object for a background), NOT create_branded_design, and do NOT bake a flat image.`,
                            `Do ALL of this in ONE update_canvas patch so it visibly looks redesigned:`,
                            `1. Rewrite the eyebrow, headline, subtext and CTA punchier and on-brand (don't leave the old copy).`,
                            `2. Set the accent to one of my REAL brand colors: ${brandList}.`,
                            `3. Pick the best \`style\` key from the STYLE LIBRARY in the canvas context (NOT just "modern") — choose one whose vibe + background fits my brand & message (e.g. luxury, editorial, bold, mesh, retro…).`,
                            `4. Use pos + styles to balance the layout and give each text element an on-brand, HIGH-CONTRAST color/size that reads cleanly on the background — colors, type and spacing must all MATCH as one cohesive look.`,
                            `Keep my image objects on the canvas.`,
                            details.trim() ? `Extra direction from me: ${details.trim()}` : "",
                            `Current design to improve on:`,
                            `- eyebrow: ${JSON.stringify(design.eyebrow)}`,
                            `- headline: ${JSON.stringify(design.headline)}`,
                            `- subtext: ${JSON.stringify(design.sub)}`,
                            `- button (CTA): ${JSON.stringify(design.cta)}`,
                            `- accent: ${design.accent}; style: ${design.style || "modern"}; size: ${design.size}`,
                            refs.length ? `- my image objects (keep them on the canvas): ${refs.join("; ")}` : "",
                            `Then, if a backdrop would lift it, add ONE on-brand background with add_canvas_object type "background" — pass the canvas size AND accent "${design.accent}" so it uses my brand palette (never plain white); the text stays editable on top. Confirm in one short sentence when done.`,
                          ].filter(Boolean).join("\n"),
                          false, designCanvasContext(base), undefined, { hidden: true },
                        );
                      } finally {
                        setDesign((d) => (d.building ? { ...d, building: false } : d));
                      }
                    }}
                  />
                ) : focused === "print" ? (
                  // Print Studio reuses the design canvas (via FocusedPrintStudio) but on
                  // its OWN document (printDesign) + draft key, so it never bleeds into the
                  // Create design. The agent drives it with the same canvas tools, routed
                  // to printDesign by focusedRef. [[new-design-no-legacy]]
                  <FocusedPrintStudio
                    value={printDesign}
                    onChange={setPrintDesign}
                    draftKey="print"
                    initialFormat={printInitialFormat}
                    pageOpsRef={pageOpsRef}
                    printOpsRef={printOpsRef}
                    productOpsRef={productOpsRef}
                    onAsk={sendAction}
                    brandColors={brandColors}
                    brandContact={brandContact ?? undefined}
                    brandLogo={brandLogo}
                    onSaveBrandLogo={handleSaveBrandLogo}
                    working={sending}
                    onPlaceholderGenerate={(layer) => sendFillSlot(layer, printDesign)}
                    onElementAssist={(el) => {
                      const label = el === "headline" ? "headline" : el === "sub" ? "subtext / details" : el === "eyebrow" ? "eyebrow / tagline" : "call-to-action";
                      send(
                        `Suggest 3 distinct, genuinely punchier on-brand options for the ${label} of my open PRINT design — short and high-impact. Use ask_choice to show them as a clickable card (label = the exact new text, sublabel = the angle in 2-4 words). Do NOT change the canvas yet. When I tap one, apply ONLY the "${el}" field via update_canvas and keep everything else EXACTLY as is, then confirm in one short sentence.`,
                        false, designCanvasContext(printDesign), undefined, { hidden: true },
                      );
                    }}
                    onRegenerate={(details) => {
                      const refs = (printDesign.images ?? []).filter((i) => !i.local && i.url).map((i) => `${i.kind}: ${i.url}`);
                      send(
                        [
                          `Render my open PRINT design as a finished, print-ready image, using the CURRENT layout/copy as the inspiration (keep the structure):`,
                          `- headline: ${JSON.stringify(printDesign.headline)}; subtext: ${JSON.stringify(printDesign.sub)}; cta: ${JSON.stringify(printDesign.cta)}`,
                          `- accent: ${printDesign.accent}; style: ${printDesign.style || "modern"}; size: ${printDesign.size}`,
                          refs.length ? `- USE MY images and PRESERVE them — pass these in referenceImageUrls: ${refs.join("; ")}` : "",
                          details.trim() ? `- extra direction from me: ${details.trim()}` : "",
                          `Keep important content inside the safe margins. Ask the tier (standard or premium) if I haven't said, then generate — it renders on this canvas.`,
                        ].filter(Boolean).join("\n"),
                        false, designCanvasContext(printDesign), undefined, { hidden: true },
                      );
                    }}
                    onBuildEditable={(details) => {
                      const base = { ...printDesign, imageUrl: undefined };
                      setPrintDesign(base);
                      const refs = (base.images ?? []).filter((i) => !i.local && i.url).map((i) => `${i.kind}: ${i.url}`);
                      send(
                        [
                          `Rebuild my OPEN print canvas as a better, FULLY EDITABLE print design — use update_canvas (and add_canvas_object for a background), NOT create_branded_design, and do NOT bake a flat image.`,
                          `Rewrite the copy punchier and on-brand, pick the best accent from my brand colors + a fitting style, and balance the layout with pos/styles so it reads cleanly — keeping important content inside the safe area (mind the fold lines on folded formats).`,
                          details.trim() ? `Extra direction from me: ${details.trim()}` : "",
                          `Current design — headline: ${JSON.stringify(printDesign.headline)}; subtext: ${JSON.stringify(printDesign.sub)}; cta: ${JSON.stringify(printDesign.cta)}; accent: ${printDesign.accent}; style: ${printDesign.style || "modern"}; size: ${printDesign.size}`,
                          refs.length ? `- keep my image objects: ${refs.join("; ")}` : "",
                          `Confirm in one short sentence when done.`,
                        ].filter(Boolean).join("\n"),
                        false, designCanvasContext(base), undefined, { hidden: true },
                      );
                    }}
                  />
                ) : focused === "account" ? (
                  <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8" onInput={() => { if (!settingsDirty) setSettingsDirty(true); }}>
                    <SettingsWorkspace embedded section="settings" initialTab={settingsInitialTab} />
                  </div>
                ) : focused === "profile" ? (
                  <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8" onInput={() => { if (!settingsDirty) setSettingsDirty(true); }}>
                    <SettingsWorkspace embedded section="profile" />
                  </div>
                ) : focused === "brand" ? (
                  <FocusedBrand dirtyRef={dirtyRef} saverRef={saverRef} refreshKey={actionCount} />
                ) : focused === "analytics" ? (
                  <FocusedAnalytics onOpenView={openView} refreshKey={actionCount} />
                ) : focused === "billing" ? (
                  <FocusedBilling onOpenView={openView} refreshKey={actionCount} />
                ) : focused === "credits" ? (
                  <FocusedCredits onBack={() => openView("billing")} refreshKey={actionCount} />
                ) : focused === "plans" ? (
                  <FocusedPlans onBack={() => openView("billing")} refreshKey={actionCount} />
                ) : focused === "publish" ? (
                  <FocusedPublish onConnect={openConnections} onOpenView={openView} onNewCampaign={() => openCampaignStudio()} refreshKey={actionCount} />
                ) : focused === "connections" ? (
                  <FocusedConnections refreshKey={actionCount} />
                ) : focused === "sell" ? (
                  <FocusedSell onAsk={sendAction} onOpenView={openView} refreshKey={actionCount} working={sending} />
                ) : focused === "web" ? (
                  <FocusedWeb onAsk={sendAction} onOpenView={openView} refreshKey={actionCount} working={sending} />
                ) : focused === "portfolio" ? (
                  <FocusedPortfolio onAsk={sendAction} onAskFiles={sendActionFiles} onOpenView={openView} refreshKey={actionCount} working={sending} />
                ) : focused === "reel" ? (
                  <FocusedReel onAsk={sendAction} onOpenView={openView} refreshKey={actionCount} working={sending} canvasRef={reelOpsRef} />
                ) : focused === "landing" ? (
                  <FocusedLanding onAsk={sendAction} refreshKey={actionCount} working={sending} />
                ) : focused === "outreach" ? (
                  <FocusedOutreach onOpenView={openView} refreshKey={actionCount} />
                ) : focused === "domains" ? (
                  <FocusedDomains refreshKey={actionCount} />
                ) : focused === "pitch" ? (
                  <FocusedPitch onAsk={sendAction} refreshKey={actionCount} onOpenStudio={(pitchId) => guardNav(() => openPitchStudio(pitchId ? { pitchId } : {}))} />
                ) : focused === "forms" ? (
                  <FocusedForms onAsk={sendAction} refreshKey={actionCount} working={sending} />
                ) : focused === "automations" ? (
                  <FocusedAutomations onAsk={sendAction} refreshKey={actionCount} agentBusy={sending} canvasRef={followupOpsRef} />
                ) : focused === "customers" ? (
                  <FocusedCustomers refreshKey={actionCount} />
                ) : focused === "reviews" ? (
                  <FocusedReviews onAsk={sendAction} refreshKey={actionCount} />
                ) : focused === "leads" ? (
                  <FocusedLeads initialScreen={leadsInitialScreen} initialListId={leadsInitialListId} onAsk={sendAction} refreshKey={actionCount} menuOpen={leadsMenuOpen} agentBusy={sending} onPitchLead={(l) => guardNav(() => openPitchStudio({ leadId: l.id, leadName: l.name }))} onOpenPitch={(pitchId) => guardNav(() => openPitchStudio({ pitchId }))} />
                ) : focused === "pitchstudio" ? (
                  <FocusedPitchStudio target={pitchTarget} onAsk={sendAction} refreshKey={actionCount} onOpenView={openView} onOpenResource={setOpenResource} onUseInAutomation={() => guardNav(() => openView("leads", "pipeline"))} />
                ) : focused === "campaign" ? (
                  <FocusedCampaignStudio initialView={campaignInitialView} target={campaignTarget} onAsk={sendAction} refreshKey={actionCount} onOpenView={openView} />
                ) : focused === "compose" ? (
                  <FocusedCompose onAsk={sendAction} refreshKey={actionCount} composeOpsRef={composeOpsRef} working={sending} narrate={publishNarrate} />
                ) : focused === "email" ? (
                  <FocusedEmail onAsk={sendAction} refreshKey={actionCount} working={sending} />
                ) : focused === "sms" ? (
                  <FocusedSms onAsk={sendAction} refreshKey={actionCount} working={sending} />
                ) : focused === "whatsapp" ? (
                  <FocusedWhatsApp onAsk={sendAction} refreshKey={actionCount} working={sending} />
                ) : focused === "teams" ? (
                  <FocusedTeams refreshKey={actionCount} />
                ) : focused === "referrals" ? (
                  <FocusedReferrals refreshKey={actionCount} />
                ) : focused === "media" ? (
                  <FocusedMedia onAsk={sendAction} refreshKey={actionCount} working={sending} />
                ) : focused === "logo" ? (
                  <FocusedLogo onAsk={sendAction} refreshKey={actionCount} working={sending} />
                ) : focused === "voice" ? (
                  <FocusedVoice onAsk={sendAction} onOpenView={openView} refreshKey={actionCount} working={sending} />
                ) : focused === "video" ? (
                  <AdBuilderCanvas embedded refreshKey={actionCount} canvasRef={videoOpsRef} />
                ) : focused === "director" ? (
                  <FocusedDirector onAsk={sendAction} refreshKey={actionCount} />
                ) : focused === "avatar" ? (
                  <FocusedAvatar onAsk={sendAction} refreshKey={actionCount} />
                ) : focused === "delivery" ? (
                  <FocusedDelivery onAsk={sendAction} refreshKey={actionCount} working={sending} />
                ) : focused === "adbuilder" ? (
                  <FocusedAdBuilder onAsk={sendAction} onOpenView={openView} refreshKey={actionCount} agentBusy={sending} canvasRef={adOpsRef} />
                ) : focused === "storyad" ? (
                  <FocusedVideo onAsk={sendAction} refreshKey={actionCount} />
                ) : focused === "calendar" ? (
                  <FocusedCalendar onAsk={sendAction} onOpenView={openView} refreshKey={actionCount} working={sending} />
                ) : (
                  <FocusedComingSoon label={fLabel} description={WS_DESC[focused] ?? ""} items={fws?.items ?? []} onAsk={(label) => { setFocused(null); setActiveWs("home"); send(`Open ${label} and help me get started.`, false, undefined, undefined, { hidden: true }); }} />
                )
              }
            />
          ) : (
            <>
          <div className="flex-1 overflow-y-auto px-4 pb-44 pt-6 sm:px-[clamp(16px,4vw,64px)] md:pb-40">
            {empty ? (
              <section className="mx-auto mt-[6vh] max-w-[1040px]">
                <h1 className="text-[26px] font-extrabold leading-[1.12] tracking-tight sm:text-[31px]">
                  {greeting} <span className="bg-gradient-to-r from-brand-500 to-violet-500 bg-clip-text text-transparent">{s.accent}</span>
                </h1>
                <p className="mb-6 mt-2 text-[14px] leading-relaxed text-muted-foreground sm:text-[15px]">{s.sub}</p>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {(suggestions.length ? suggestions : s.fallbackChips.map((label, i) => ({ label, hint: "", icon: ["palette", "calendar", "video", "bag"][i], prompt: label }))).map((sug, i) => {
                    const Icon = SUG_ICON[sug.icon] ?? FALLBACK_ICONS[i] ?? Sparkles;
                    return (
                      <button key={i} onClick={() => send(sug.prompt)} className="flex items-start gap-3 rounded-[13px] border border-border bg-card p-3.5 text-start transition-all hover:-translate-y-0.5 hover:border-brand-500/60 hover:shadow-lg">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] bg-gradient-to-br from-brand-500/20 to-violet-500/20 text-brand-500"><Icon className="h-[18px] w-[18px]" /></span>
                        <span className="min-w-0">
                          <span className="block text-[13.5px] font-semibold">{sug.label}</span>
                          {sug.hint && <span className="mt-0.5 block text-[11.5px] leading-snug text-muted-foreground">{sug.hint}</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {!suggestionsLoaded && !suggestions.length && (
                  <div className="mt-3"><FlowLoader size={24} withMark label="Personalizing suggestions…" /></div>
                )}
              </section>
            ) : (
              <div>
                {messages.map((m) => (
                  <HomeMessageView key={m.id} message={m} initials={initials} conversationId={conversationId} onPlanResponse={handlePlanResponse} onPickTemplate={handlePickTemplate} onPickOption={handlePickOption} onViewEvent={handleViewEvent} />
                ))}
                <div ref={bottomRef} className="h-36 sm:h-40" />
              </div>
            )}
          </div>

          {/* composer */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/90 to-transparent px-3 pb-4 pt-3 sm:px-[clamp(16px,4vw,64px)] sm:pb-5">
            <div className="pointer-events-auto mx-auto max-w-[1040px]">
              <Composer onSend={(t, sm, atts) => send(t, sm, undefined, undefined, { attachments: atts })} sending={sending} placeholder={s.placeholder} />
            </div>
            <p className="mx-auto mt-2 hidden max-w-[1040px] text-center text-[11px] text-muted-foreground sm:block">{s.hint}</p>
          </div>

            </>
          )}

          {/* workspace panel — slides over the CURRENT view (home or any focused
              surface). Browsing it never resets the open view; closing returns to
              it. Only picking an item navigates (guarded for unsaved changes). */}
          <aside className={cn("fixed inset-0 z-50 flex flex-col bg-card transition-transform duration-300 md:absolute md:inset-y-0 md:left-0 md:right-auto md:border-e md:border-border md:shadow-2xl", panelKey && HUB_SECTIONS.has(panelKey) ? "md:right-0 md:w-auto" : "md:w-[440px]", panelKey ? "translate-x-0" : "translate-x-full md:-translate-x-full")}>
            {panelKey && (
              <WorkspacePanel
                panelKey={panelKey}
                label={s.ws[panelKey] ?? panelKey}
                hasStore={hasStore}
                onClose={() => { setPanelKey(null); setActiveWs(panelReturnWs.current); }}
                onAsk={(q) => { setPanelKey(null); setActiveWs(panelReturnWs.current); send(q, false, undefined, focused ? focusedSurfaceContext(focused, brandName, openResource) : undefined, { hidden: true }); }}
                onOpenView={(k, hint) => guardNav(() => openView(k, hint))}
              />
            )}
          </aside>

          {/* history panel — available in home and focused view */}
          <aside className={cn("fixed inset-0 z-50 flex flex-col bg-card transition-transform duration-300 md:absolute md:inset-y-0 md:left-auto md:right-0 md:w-[360px] md:border-s md:border-border md:shadow-2xl", historyOpen ? "translate-x-0" : "translate-x-full")}>
            {historyOpen && (
              <HistoryPanel
                conversations={conversations}
                activeId={conversationId}
                onClose={() => setHistoryOpen(false)}
                onNew={handleNewChat}
                onOpen={handleOpenConversation}
                onDelete={handleDeleteConversation}
              />
            )}
          </aside>
        </main>
      </div>

      {/* MOBILE DRAWER */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 start-0 flex w-[82%] max-w-[320px] flex-col bg-card shadow-2xl">
            <div className="flex items-center gap-2.5 border-b border-border p-4">
              <BrandMark size={32} /><BrandWordmark className="text-[15px]" />
              <button onClick={() => setDrawerOpen(false)} className="ms-auto text-muted-foreground" aria-label="Close"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-auto p-2">
              {/* business switcher */}
              <div className="mb-2 rounded-xl border border-border p-1.5">
                <AccountMenu accountLabel={accountLabel} clients={clients} isImpersonating={isImpersonating} onSwitch={switchToClient} onExit={exitImpersonation} onManage={() => router.push("/agent/clients")} />
              </div>
              <button onClick={() => guardNav(handleNewChat)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-muted"><SquarePen className="h-[18px] w-[18px]" /> New chat</button>
              <button onClick={() => { setHistoryOpen(true); setDrawerOpen(false); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-muted"><History className="h-[18px] w-[18px]" /> History</button>
              <div className="my-1.5 h-px w-full bg-border" />
              {/* workspaces */}
              {primaryWorkspaces.map((w) => {
                const Icon = w.icon;
                return (
                  <button key={w.key} onClick={() => openWorkspace(w.key)} className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm", activeWs === w.key ? "bg-brand-500/10 text-brand-500" : "text-foreground hover:bg-muted")}>
                    <Icon className="h-[18px] w-[18px]" /> {s.ws[w.key] ?? w.label}
                  </button>
                );
              })}
              <div className="my-1.5 h-px w-full bg-border" />
              <button onClick={() => guardNav(openConnections)} className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm", activeWs === "connections" ? "bg-brand-500/10 text-brand-500" : "text-foreground hover:bg-muted")}>
                <Link2 className="h-[18px] w-[18px]" /> Social
              </button>
              {businessWorkspace && (() => {
                const Icon = businessWorkspace.icon;
                return (
                  <button key={businessWorkspace.key} onClick={() => openWorkspace(businessWorkspace.key)} className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm", activeWs === businessWorkspace.key ? "bg-brand-500/10 text-brand-500" : "text-foreground hover:bg-muted")}>
                    <Icon className="h-[18px] w-[18px]" /> {s.ws[businessWorkspace.key] ?? businessWorkspace.label}
                  </button>
                );
              })()}
            </div>
            {/* language + theme */}
            <div className="flex items-center justify-between border-t border-border p-3">
              <LanguageSwitcher language={language} onChange={setLanguage} />
              <ThemeMenu up />
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed left-1/2 top-3.5 z-[120] -translate-x-1/2 rounded-[10px] border border-border bg-card px-3.5 py-2 text-[12.5px] shadow-lg">{toast}</div>
      )}

      {/* unsaved-changes guard */}
      {leaveAction && (
        <div className="fixed inset-0 z-[130] grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <h3 className="text-[15px] font-bold">Unsaved changes</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">You have changes that haven’t been saved. Save them before you leave?</p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button onClick={() => setLeaveAction(null)} className="rounded-[10px] border border-border px-3.5 py-2 text-[13px] font-semibold text-muted-foreground hover:text-foreground">Stay</button>
              <button onClick={() => { const a = leaveAction; dirtyRef.current = false; setSettingsDirty(false); setLeaveAction(null); a?.run(); }} className="rounded-[10px] border border-border px-3.5 py-2 text-[13px] font-semibold text-destructive hover:bg-destructive/10">Discard &amp; leave</button>
              {saverRef.current && (
                <button onClick={async () => { const a = leaveAction; try { await saverRef.current?.(); } catch { /* ignore */ } setSettingsDirty(false); setLeaveAction(null); a?.run(); }} className="rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-2 text-[13px] font-semibold text-white">Save &amp; leave</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Campaign-post media picker — select an existing asset OR upload a new one
          (the picker has its own Upload button), then attach it to the post. */}
      {mediaPicker && (
        <MediaLibraryPicker
          open
          title="Attach media to post"
          filterTypes={["image", "video"]}
          onClose={() => setMediaPicker(null)}
          onSelect={(url, file) => {
            const { postId, campaignId } = mediaPicker;
            setMediaPicker(null);
            const ref = file?.id ? `mediaId "${file.id}"` : `mediaUrl "${url}"`;
            sendAction([
              "Attach this media to the campaign post — the user picked it from the media library.",
              `Post id: "${postId}".`,
              campaignId ? `Campaign id: "${campaignId}".` : "",
              `Use attach_media_to_post with ${ref}${campaignId ? ` and campaignId "${campaignId}"` : ""}. Do not re-ask — just attach and confirm.`,
            ].filter(Boolean).join(" "));
          }}
        />
      )}
    </div>
    </AgentNavContext.Provider>
  );
}

function AccountMenu({ accountLabel, clients, isImpersonating, onSwitch, onExit, onManage }: {
  accountLabel: string;
  clients: AgentClient[];
  isImpersonating: boolean;
  onSwitch: (clientId: string) => void;
  onExit: () => void;
  onManage: () => void;
}) {
  return (
    <div className="text-sm">
      <div className="flex items-center gap-2 rounded-lg bg-brand-500/10 px-2.5 py-2 text-brand-500">
        <Building2 className="h-4 w-4" /> <span className="flex-1 truncate font-medium">{accountLabel}</span> <Check className="h-4 w-4" />
      </div>
      {isImpersonating && (
        <button onClick={onExit} className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-muted">
          <LogOut className="h-4 w-4 text-muted-foreground" /> Back to my account
        </button>
      )}
      {clients.length > 0 && (
        <>
          <div className="px-2.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Businesses you manage</div>
          {clients.map((c) => (
            <button key={c.id} onClick={() => onSwitch(c.id)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-muted">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-muted text-[10px] font-bold">{c.name.slice(0, 2).toUpperCase()}</span>
              <span className="flex-1 truncate">{c.name}</span>
            </button>
          ))}
          <button onClick={onManage} className="mt-1 w-full rounded-lg px-2.5 py-2 text-left text-[12.5px] text-brand-500 hover:bg-muted">Manage all clients →</button>
        </>
      )}
    </div>
  );
}

// Rail sections that render as a full-screen media-card HUB (vs the compact list).
const HUB_SECTIONS = new Set(["create", "publish", "grow", "sell", "web", "outreach"]);
// On-brand gradient backdrops for hub cards that don't have bespoke art.
const HUB_GRADS = [
  "linear-gradient(150deg,#0e2a4a,#3a1250)",
  "linear-gradient(135deg,#12224a,#1e1150)",
  "linear-gradient(135deg,#0b1a3a,#241243)",
  "linear-gradient(135deg,#0c1a2e,#2a1440)",
  "linear-gradient(135deg,#12143a,#241243)",
  "linear-gradient(150deg,#1a2a12,#123a2a)",
];

// Curated (brand-neutral) thumbnail art for the Create hub cards — no external
// assets; each studio gets a distinctive on-brand placeholder we control.
const CREATE_STILL_THUMBS = {
  design: "/create-hub-thumbs/design-studio-curated.png",
  logo: "/create-hub-thumbs/logo-generator-curated.png",
  media: "/create-hub-thumbs/media-library-curated.png",
  voice: "/create-hub-thumbs/voice-studio-curated.png",
} as const;

function CreateThumb({ kind }: { kind?: "design" | "logo" | "video" | "media" | "voice" }) {
  const stillSrc = kind ? CREATE_STILL_THUMBS[kind as keyof typeof CREATE_STILL_THUMBS] : undefined;
  if (stillSrc) return <img src={stillSrc} alt="" className={cn("absolute inset-0 h-full w-full bg-[#050914]", kind === "design" ? "object-contain" : "object-cover")} draggable={false} />;

  if (kind === "design") return (
    <div className="absolute inset-0 bg-gradient-to-br from-[#12224a] to-[#3a1259]">
      <div className="absolute inset-[16%_30%] flex flex-col justify-center gap-1.5 rounded-lg bg-gradient-to-b from-brand-500 to-violet-500 p-3 shadow-xl">
        <span className="h-2 w-[70%] rounded bg-white/95" /><span className="h-1.5 w-[45%] rounded bg-white/60" /><span className="mt-1 h-3.5 w-[38%] rounded-md bg-amber-400" />
      </div>
    </div>
  );
  if (kind === "logo") return (
    <div className="absolute inset-0 flex items-center justify-center gap-3.5 bg-gradient-to-br from-[#0b1a3a] to-[#12143a]">
      <span className="h-9 w-9 rounded-[10px] bg-gradient-to-br from-brand-500 to-violet-500" />
      <span className="h-9 w-9 rounded-full bg-gradient-to-br from-amber-500 to-rose-500" />
      <span className="h-9 w-9 bg-gradient-to-br from-emerald-500 to-green-600" style={{ clipPath: "polygon(50% 0,100% 100%,0 100%)" }} />
    </div>
  );
  if (kind === "video") return (
    <div className="absolute inset-0 grid grid-cols-2 gap-px bg-black">
      <video
        className="pointer-events-none h-full w-full object-cover"
        src="/create-hub-video-thumbs/video-studio-spy-chase.mp4"
        poster="/create-hub-video-thumbs/video-studio-spy-chase-poster.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      />
      <video
        className="pointer-events-none h-full w-full object-cover"
        src="/create-hub-video-thumbs/video-studio-forest-warrior.mp4"
        poster="/create-hub-video-thumbs/video-studio-forest-warrior-poster.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" />
    </div>
  );
  if (kind === "media") return (
    <div className="absolute inset-0 grid grid-cols-4 gap-1 bg-[#0c1220] p-2.5">
      {["from-sky-500 to-indigo-500", "from-amber-500 to-rose-500", "from-emerald-500 to-emerald-700", "from-violet-500 to-pink-500", "from-rose-500 to-amber-500", "from-cyan-500 to-blue-500", "from-lime-500 to-green-500", "from-purple-500 to-indigo-500"].map((g, i) => <span key={i} className={cn("rounded bg-gradient-to-br", g)} />)}
    </div>
  );
  if (kind === "voice") return (
    <div className="absolute inset-0 flex items-center justify-center gap-1 bg-gradient-to-br from-[#0b1630] to-[#241243]">
      {[16, 30, 44, 26, 38, 22, 34].map((h, i) => <span key={i} className="w-1 rounded bg-gradient-to-b from-brand-500 to-violet-500" style={{ height: h }} />)}
    </div>
  );
  return <div className="absolute inset-0 bg-gradient-to-br from-brand-500/20 to-violet-500/20" />;
}

function WorkspacePanel({ panelKey, label, hasStore, onClose, onAsk, onOpenView }: {
  panelKey: string;
  label: string;
  hasStore: boolean | null;
  onClose: () => void;
  onAsk: (q: string) => void;
  onOpenView: (key: string, hint?: string) => void;
}) {
  const ws = WORKSPACES.find((w) => w.key === panelKey);
  if (!ws) return null;
  const Icon = ws.icon;
  // Sell with no store yet: don't show empty Products/Orders/Customers menus —
  // show what they get + what it costs, and one button to build it.
  const sellNoStore = panelKey === "sell" && hasStore === false;
  return (
    <>
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><Icon className="h-[18px] w-[18px]" /></span>
        <b className="text-[15px]">{label}</b>
        <button onClick={onClose} className="ms-auto text-muted-foreground hover:text-foreground" aria-label="Close"><X className="h-[18px] w-[18px]" /></button>
      </div>
      {HUB_SECTIONS.has(panelKey) ? (
        <div className="min-h-0 flex-1 overflow-auto px-5 py-5 md:px-8 md:py-7">
          <div className="mx-auto max-w-[1120px]">
            <p className="mb-5 text-[13px] text-muted-foreground">{WS_DESC[panelKey]}</p>
            {/* Bento grid: the hero spans 2 columns AND 2 rows, so the right column
                stacks two cards to fill its height — no dead space beside the hero.
                Cards stretch (no self-start) so their bottoms line up per row. */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ws.items.map((it, idx) => {
                const HubIcon = it.icon || (it.viewKey && FOCUS_META[it.viewKey]?.icon) || Icon;
                return (
                <button
                  key={it.label}
                  onClick={() => (it.viewKey ? onOpenView(it.viewKey, it.viewHint) : onAsk(`Open ${it.label} and help me get started.`))}
                  className={cn("group flex flex-col overflow-hidden rounded-2xl border border-border bg-card text-left transition hover:-translate-y-0.5 hover:border-brand-500/50 hover:shadow-2xl", it.hero && "sm:col-span-2 lg:row-span-2")}
                >
                  <div className={cn("relative w-full", it.hero ? "min-h-[200px] flex-1" : "aspect-[16/10]")}>
                    {it.thumb
                      ? <CreateThumb kind={it.thumb} />
                      : <div className="absolute inset-0 grid place-items-center" style={{ background: HUB_GRADS[idx % HUB_GRADS.length] }}><HubIcon className="h-9 w-9 text-white/85" /></div>}
                    {it.thumb === "video" && <span className="absolute inset-0 grid place-items-center"><span className="grid h-11 w-11 place-items-center rounded-full bg-white/90 text-[15px] text-brand-600 shadow-lg">▶</span></span>}
                  </div>
                  <div className={cn("flex flex-col gap-1.5 p-4", !it.hero && "flex-1")}>
                    <div className="flex items-center gap-2"><span className="text-[15px] font-bold text-foreground">{it.label}</span><ChevronRight className="ms-auto h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-brand-500" /></div>
                    <p className="text-[12px] leading-relaxed text-muted-foreground">{it.desc}</p>
                    {it.includes && it.includes.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {it.includes.map((t) => <span key={t} className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{t}</span>)}
                      </div>
                    )}
                    {it.viewKey === "create" && (
                      <span onClick={(e) => { e.stopPropagation(); onOpenView("print"); }} className="mt-1 self-start text-[11px] font-semibold text-brand-500 hover:underline">Print formats →</span>
                    )}
                  </div>
                </button>
                );
              })}
            </div>
            <div className="mt-6 flex justify-center">
              <button onClick={() => onAsk(`Help me with ${label}.`)} className="inline-flex items-center gap-2 rounded-[12px] bg-gradient-to-r from-brand-500 to-violet-500 px-5 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"><Sparkles className="h-4 w-4" /> Ask the agent</button>
            </div>
          </div>
        </div>
      ) : sellNoStore ? (
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <StoreCallToAction compact onBuild={(p) => onAsk(p)} onTopUp={() => onOpenView("credits")} />
        </div>
      ) : (
      <div className="flex min-h-0 flex-1 flex-col overflow-auto p-3">
        <p className="px-1 pb-2.5 text-[12.5px] leading-relaxed text-muted-foreground">{WS_DESC[panelKey]}</p>
        {/* Each item is an info card that opens its OWN focused view (new design). */}
        <div className="space-y-2">
          {ws.items.map((it) => {
            const ItemIcon = it.icon || (it.viewKey && FOCUS_META[it.viewKey]?.icon) || Icon;
            return (
              <button
                key={(it.viewKey ?? "") + it.label}
                onClick={() => (it.viewKey ? onOpenView(it.viewKey, it.viewHint) : onAsk(`Open ${it.label} and help me get started.`))}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-left transition hover:border-brand-500/50 hover:bg-muted/50"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-500/10 text-brand-500"><ItemIcon className="h-[18px] w-[18px]" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-foreground">{it.label}</span>
                  {it.desc && <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">{it.desc}</span>}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            );
          })}
        </div>
        {/* One AI entry point below the menu. */}
        <div className="mt-auto pt-3">
          <button onClick={() => onAsk(`Help me with ${label}.`)} className="flex w-full items-center justify-center gap-2 rounded-[12px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30">
            <Sparkles className="h-4 w-4" /> Ask the agent
          </button>
        </div>
      </div>
      )}
    </>
  );
}

function HistoryPanel({ conversations, activeId, onClose, onNew, onOpen, onDelete }: {
  conversations: ConversationSummary[];
  activeId: string | null;
  onClose: () => void;
  onNew: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
        <History className="h-5 w-5 text-brand-500" />
        <b className="text-[15px]">History</b>
        <button onClick={onClose} className="ms-auto text-muted-foreground hover:text-foreground" aria-label="Close"><X className="h-[18px] w-[18px]" /></button>
      </div>
      <div className="p-3">
        <button onClick={onNew} className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30">
          <SquarePen className="h-4 w-4" /> New chat
        </button>
      </div>
      <div className="flex-1 overflow-auto px-2 pb-3">
        {conversations.length === 0 ? (
          <p className="px-3 py-6 text-center text-[12.5px] text-muted-foreground">No past conversations yet.</p>
        ) : (
          conversations.map((c) => (
            <div key={c.id} className={cn("group flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm", c.id === activeId ? "bg-brand-500/10 text-brand-500" : "hover:bg-muted")}>
              <button onClick={() => onOpen(c.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <MessageSquare className="h-4 w-4 shrink-0 opacity-70" />
                <span className="min-w-0 flex-1 truncate">{c.title}</span>
              </button>
              <button onClick={() => onDelete(c.id)} className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100" aria-label="Delete conversation"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))
        )}
      </div>
    </>
  );
}
