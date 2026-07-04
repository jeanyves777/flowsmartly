> Totals: 94 high · 82 medium · 40 low

# New-design parity gaps (vs legacy)

Generated from the parity-gap audit. Each surface lists capabilities the legacy feature has that the /home surface is missing. Fix in-surface (never link to legacy).


## sms — **SHALLOW**

- [ ] **(high)** Open a blast detail view (message content, phone preview, full performance breakdown, timeline, audience) — `/api/campaigns/[campaignId]`
      - Make each blast row clickable to open an in-surface detail panel/drawer that fetches /api/campaigns/[id] and shows content, phone preview, delivery/failure/click breakdown, and timeline.
- [ ] **(high)** Send now / queue an existing draft blast — `/api/campaigns/[campaignId]/send`
      - Add a 'Send now' action on draft blasts (with a confirm dialog) that POSTs to /api/campaigns/[id]/send and refreshes the list.
- [ ] **(high)** Delete a blast (draft/scheduled/paused/failed) — `/api/campaigns/[campaignId] (DELETE)`
      - Add a per-row delete action (overflow menu + confirm dialog) that DELETEs /api/campaigns/[id] and removes it from the list.
- [ ] **(high)** SMS automations management (birthday/holiday/welcome/re-engagement, enable/disable toggle, view list & stats) — `/api/automations, /api/automations/[id] (PATCH enabled)`
      - Add an 'Automations' section listing SMS automations from /api/automations (filtered campaignType=SMS) with per-automation enable/disable switches PATCHing /api/automations/[id]; route creation through the agent.
- [ ] **(medium)** Pause / resume an active or paused blast — `/api/campaigns/[campaignId] (PATCH status)`
      - Add a pause/resume toggle on active/paused blasts that PATCHes /api/campaigns/[id] with the new status.
- [ ] **(medium)** Search blasts and filter by status — `/api/campaigns?type=sms&search=&status=`
      - Add a search box and a status filter dropdown above the blast list that pass search/status query params to the existing /api/campaigns fetch.
- [ ] **(medium)** Release / give up the rented SMS number — `/api/sms/numbers (DELETE)`
      - Add a 'Release number' action in the number/status hero (with confirm dialog) that DELETEs /api/sms/numbers and refreshes status.
- [ ] **(medium)** View number registration/compliance status detail (A2P/toll-free brand+campaign state, retry/refresh registration) — `/api/sms/compliance, /api/sms/numbers/verify, /api/sms/numbers/a2p-status`
      - Expand the verification badge into a setup-status panel fetching compliance + a2p-status/verify, surfacing brand/campaign state and a refresh action; keep submit/retry of registration agent-routed.
- [ ] **(low)** Search and buy a phone number directly (country/area-code/contains, number type, capabilities) — `/api/sms/numbers (GET search, POST purchase)`
      - Provisioning is heavy/compliance-gated so agent-routing setup is acceptable, but optionally add an in-surface number search/rent flow (GET/POST /api/sms/numbers) for users who want direct control.

## whatsapp — **SHALLOW**

- [ ] **(high)** Inbox: read conversations + reply / send messages — `/api/whatsapp/conversations (GET), /api/whatsapp/messages/[conversationId] (GET), /api/whatsapp/send (POST)`
      - Add an in-surface inbox panel (conversation list + message thread + composer) that fetches conversations/messages and POSTs to /api/whatsapp/send so the user can read and reply directly; the new surface only shows a conversation COUNT and never lets a user open or answer a chat.
- [ ] **(high)** Start a new outbound conversation by phone number — `/api/whatsapp/send (POST with `to`)`
      - Add a 'New conversation' input in the in-surface inbox that validates a phone number and sends the first message via /api/whatsapp/send.
- [ ] **(high)** Edit an existing automation (name/trigger/keywords/action/value) — `/api/whatsapp/automations (PATCH)`
      - Add an in-surface edit form/panel on each automation row that PATCHes the full automation fields; the surface currently only flips isActive and has no way to change a rule's reply text, keywords, or action.
- [ ] **(high)** Delete an automation — `/api/whatsapp/automations?automationId= (DELETE)`
      - Add a delete (trash) action with confirm on each automation row calling DELETE /api/whatsapp/automations.
- [ ] **(high)** Templates: create + submit for WhatsApp approval with category/language/header/body/footer — `/api/whatsapp/templates (POST)`
      - Add an in-surface template builder (name, category, language, header/body/footer, live preview) that POSTs to /api/whatsapp/templates; the surface only shows a template COUNT and never lets a user author one directly.
- [ ] **(high)** Templates: list, preview, filter by category/status, and delete — `/api/whatsapp/templates (GET with category/status), DELETE ?templateId=`
      - Render the actual template list with status (Approved/Pending/Rejected) and category badges, a preview panel, category/status filters, and a delete action — not just a numeric count.
- [ ] **(high)** AI Agent control center: enable + tune lead qualification, appointments, handoff, voice, tone, language, business goal, knowledge base, max replies — `/api/whatsapp/agent (GET, POST)`
      - Add an in-surface agent settings panel with toggles (enabled, leadQualification, appointmentBooking, handoffEnabled, voiceNotes) and tone/language/businessGoal/knowledge/maxReplyMessages fields that GET/POST /api/whatsapp/agent; this entire configuration surface is absent.
- [ ] **(medium)** Create an automation via a real form (trigger type, keywords, action, value) — `/api/whatsapp/automations (POST)`
      - Offer a direct in-surface 'New automation' form (keyword/new-conversation/missed-chat triggers + send_message/add_tag/webhook actions) in addition to the agent route, so power users can build a precise rule without conversational round-trips.
- [ ] **(medium)** WhatsApp Status: compose/upload media + caption and post now or schedule — `/api/whatsapp/status (POST), GET ?socialAccountId for queue`
      - Add a Status composer (media uploader, caption, post-now/schedule toggle) and a scheduled-status queue list backed by /api/whatsapp/status.
- [ ] **(medium)** Per-number token/expiry status and account selection when multiple numbers are connected — `/api/social-accounts?platform=whatsapp`
      - Show token expiry status (e.g. 'Expires in 7d' / 'Expired') per number and let the user select which connected number the inbox/automations/templates views are scoped to; the surface only shows connectedAt and a generic needsReconnect flag.
- [ ] **(low)** Archive / delete a conversation — `/api/whatsapp/conversations (PATCH status=archived), DELETE ?conversationId=`
      - Add archive and delete actions on each conversation row in the in-surface inbox (PATCH/DELETE /api/whatsapp/conversations).

## sell — **SHALLOW**

- [ ] **(high)** Product search / filter / sort (status, category, label, inventory) — `/api/ecommerce/products (search, status, categoryId, label, inventory, sort, page params)`
      - Add a search box + filter/sort controls above the product grid in the surface that pass query params to the existing GET /api/ecommerce/products and paginate results.
- [ ] **(high)** Delete a product — `DELETE /api/ecommerce/products/[id]`
      - Add a delete action (with a small confirm) on each product card / inside the edit form that calls DELETE /api/ecommerce/products/[id] then reloads.
- [ ] **(high)** Full order detail view (customer info, items, shipping address, summary, payment) — `GET /api/ecommerce/orders/[id]`
      - Make clicking a recent order open an in-surface order detail panel showing customer, line items, addresses, totals and payment, fetched from GET /api/ecommerce/orders/[id].
- [ ] **(high)** Edit order tracking number / shipping method (with carrier tracking link) — `PATCH /api/ecommerce/orders/[id] (trackingNumber, shippingMethod)`
      - In the in-surface order detail, add an editable tracking-number field that PATCHes the order so shipping/delivery emails carry tracking info.
- [ ] **(high)** Cancel order with a required reason (restores inventory) — `PATCH /api/ecommerce/orders/[id] (status=CANCELLED, cancelReason)`
      - Add a Cancel action in the order detail that prompts for a reason and PATCHes status CANCELLED with cancelReason.
- [ ] **(high)** Issue a Stripe refund for a paid order — `POST /api/ecommerce/orders/[id]/refund`
      - Add an 'Issue refund' button (shown only for card+paid orders) in the order detail that POSTs to the refund route with a confirm step.
- [ ] **(high)** Order list filtering (status, payment status, payment method, date range, search) — `/api/ecommerce/orders (status, paymentStatus, paymentMethod, dateFrom, dateTo, search params)`
      - Add a full orders view (or expand the orders section) with status/payment/method/date/search filters and pagination passing params to GET /api/ecommerce/orders.
- [ ] **(high)** Shipping methods management + free-shipping threshold — `GET/POST/PATCH/DELETE /api/ecommerce/shipping-methods[/id], /api/ecommerce/store/settings`
      - Add a store-settings panel in the surface to add/edit/delete shipping methods and set the free-shipping threshold.
- [ ] **(high)** Payment / payout setup (Stripe Connect) and per-method toggles — `/api/ecommerce/stripe-connect, /api/ecommerce/stripe-capabilities`
      - Add a Payments panel in the surface for Stripe Connect onboarding and toggling which checkout payment methods are offered.
- [ ] **(medium)** Mark order payment as paid (manual/COD) — `PATCH /api/ecommerce/orders/[id] (paymentStatus=paid)`
      - Add a 'Mark as paid' control in the order detail payment section for pending-payment orders.
- [ ] **(medium)** Add timestamped notes to an order — `PATCH /api/ecommerce/orders/[id] (notes)`
      - Add a notes textarea in the order detail that appends a timestamped note via PATCH notes.
- [ ] **(medium)** Assign a delivery driver to a COD/delivery order — `POST /api/ecommerce/delivery/[orderId] (+ GET /api/ecommerce/drivers)`
      - Add an 'Assign driver' picker in the order detail that lists drivers and POSTs the assignment.
- [ ] **(medium)** Toggle product 'featured' (home-page) status — `PATCH /api/ecommerce/products/[id] (labels)`
      - Add a star/feature toggle on active product cards that PATCHes the product's labels array.
- [ ] **(medium)** Product variants, compare-at price, and cost price — `POST/PATCH /api/ecommerce/products[/id] (variants, comparePriceCents, costCents)`
      - Extend the in-surface product form with optional variant rows and compare/cost price fields (the API already accepts them).
- [ ] **(medium)** Store branding (theme colors + fonts) and general settings (name, description, logo, banner, industry) — `PATCH /api/ecommerce/store/settings (theme, name, logoUrl, bannerUrl, industry)`
      - Add a settings panel for editing store name/logo/banner/industry and theme colors/fonts (distinct from the agent-driven generative store build).
- [ ] **(medium)** Custom domain: buy, connect (BYOD), set primary, disconnect — `/api/domains, /api/domains/search, /api/domains/purchase, /api/domains/connect, /api/domains/[id]`
      - Add a Domain panel in the surface to search/buy, connect own domain, and set/disconnect the primary domain.
- [ ] **(low)** Tracking pixels / marketing pixel configuration — `/api/ecommerce/pixels`
      - Surface a pixels settings panel (reuse the PixelSettings component) so the user can add tracking pixels without leaving the new design.
- [ ] **(low)** Product listing capacity display + unlock-more-listings — `POST /api/ecommerce/products/unlock-limit`
      - Show remaining listing capacity near 'Add product' and offer an unlock action that POSTs to unlock-limit when the limit is hit.

## web — **SHALLOW**

- [ ] **(high)** Edit website content (company info, hero/branding, services, team, reviews, FAQ, blog, gallery, contact, nav/footer links) — `GET /api/websites/[id]/site-data, POST /api/websites/[id]/update-data`
      - Add an in-surface detail/editor panel (opened by clicking a site) with the legacy tabbed forms to read site-data and save via update-data, so users can edit text/sections without the agent.
- [ ] **(high)** Rebuild website (sync + redeploy) with live build-status polling — `POST /api/websites/[id]/rebuild`
      - Add a 'Rebuild' action button on each site row that POSTs to the rebuild route and polls /api/websites to update the status badge in place.
- [ ] **(high)** Delete website — `DELETE /api/websites/[id]`
      - Add a Delete action (with confirm dialog) on each site row that calls DELETE /api/websites/[id] and refreshes the list.
- [ ] **(high)** Full visitor analytics (views over time, world map, top countries, devices, top pages, traffic sources, real-time, marketing insights, date-range) — `GET /api/websites/[id]/analytics?range=...`
      - Add an in-surface Analytics view (drill-in from a site) rendering the analytics payload — KPIs, daily-views chart, geo/device/referrer breakdowns and insights.
- [ ] **(high)** Manage custom domain / connect domain to the site — `GET /api/websites/[id] (domains), PATCH /api/websites/[id] (customDomain)`
      - Add a Domains panel in-surface showing current URL/custom-domain status and DNS setup steps, with an action to attach/manage a domain (PATCH customDomain), rather than only showing a 'Visit' link.
- [ ] **(medium)** AI section update (describe a design/content change and regenerate that section) — `POST /api/websites/[id]/update-section`
      - Either expose the SectionUpdater inside the surface detail view, or wire a targeted 'redesign this section' action that delegates to onAsk with the specific section context.
- [ ] **(medium)** Live preview of the built site (per-page iframe preview) — `/sites/[slug]/... (rendered site)`
      - Add a Preview action that opens an in-surface iframe of /sites/[slug] with the page-navigation pills, so users can preview without leaving the surface.
- [ ] **(medium)** View build-error details and report build error to admin — `POST /api/websites/[id]/report-error`
      - When buildStatus is 'error', show the error banner with the truncated lastBuildError and a 'Report to admin' button that POSTs to report-error.
- [ ] **(medium)** Upload / AI-generate / browse images for site sections (logo, hero, services, team, blog, gallery) — `POST /api/websites/[id]/upload-image, POST /api/websites/[id]/generate-image, media library`
      - Include the ImagePicker (browse media library, upload, AI-generate) inside the in-surface editor so users can replace site imagery directly.
- [ ] **(medium)** View website form submissions (contact/registration form leads) — `GET /api/websites/[id]/form-submissions`
      - Add a 'Form submissions' panel listing paginated submissions captured by the site's forms.
- [ ] **(medium)** SEO settings (title, description, social image, favicon) and per-site theme/navigation/settings editing — `PATCH /api/websites/[id]`
      - Add a Settings panel in the site detail view exposing SEO/title/favicon/theme fields that PATCH /api/websites/[id].
- [ ] **(low)** Upgrade legacy V2 static site to V3 SSR + view app/process status — `POST /api/websites/[id]/upgrade-v3`
      - Surface a non-intrusive 'Upgrade to V3 SSR' action/banner on V2 sites in the detail view that calls upgrade-v3 and polls status.

## outreach — **SHALLOW**

- [ ] **(high)** Search contacts by name/email/phone — `/api/contacts?search=`
      - Add a debounced search box above the contact list that re-fetches /api/contacts with ?search=.
- [ ] **(high)** Status filter (active / unsubscribed) — `/api/contacts?status=`
      - Add a status dropdown (All/Active/Unsubscribed) wired to a ?status= query param on the fetch.
- [ ] **(high)** Filter contacts by list/segment — `/api/contacts?listId=`
      - Add a list dropdown (fed by /api/contact-lists) that scopes the contact fetch with ?listId=.
- [ ] **(high)** Pagination beyond first 30 contacts — `/api/contacts?page=&limit=`
      - Replace the hardcoded limit=30 fetch with paged fetching plus prev/next controls reading data.pagination.
- [ ] **(high)** Edit an existing contact — `PATCH /api/contacts/[contactId] (GET for detail)`
      - Make each contact row open an in-surface edit form (reuse the add form, prefilled from GET /api/contacts/[id]) that PATCHes the contact.
- [ ] **(high)** Delete a contact — `DELETE /api/contacts/[contactId]`
      - Add a delete action (row menu + confirm) calling DELETE /api/contacts/[contactId] and refreshing the list.
- [ ] **(high)** Bulk select + bulk delete / add-to-list / move-to-list / status change — `POST /api/contacts/bulk (delete | addToList | removeFromList | updateStatus)`
      - Add row checkboxes and a bulk-actions bar that posts the chosen action to /api/contacts/bulk for the selected ids.
- [ ] **(high)** Contact lists / segments management (create, rename, delete, view counts, use as segment) — `/api/contact-lists (+ /api/contact-lists/[id])`
      - Add a Lists section/tab in the surface that lists segments with counts and supports create/rename/delete via /api/contact-lists.
- [ ] **(high)** CSV import wizard with column mapping, list assignment, and duplicate strategy choice — `POST /api/contacts/import (mappings, listId, duplicateStrategy)`
      - Upgrade the silent skip-only import to an in-surface multi-step modal: preview rows, auto-detect/edit column mappings, pick a target list, and choose skip vs update.
- [ ] **(medium)** Export (filtered) contacts to CSV — `GET /api/contacts/export`
      - Add an Export button that opens /api/contacts/export with the current search/status/list query params.
- [ ] **(medium)** Rich contact fields on add (company, birthday, city, state, address, photo, list membership, opt-in toggles) — `POST /api/contacts (accepts company, birthday, imageUrl, city, state, address, listIds, emailOptedIn, smsOptedIn)`
      - Expand the inline add form with optional company/birthday/city/state/address fields, a photo upload (/api/media), list checkboxes, and email/SMS opt-in switches.
- [ ] **(low)** Unsubscribed count KPI — `/api/contacts (stats.unsubscribed)`
      - Add an 'Unsubscribed' KPI tile using stats.unsubscribed already returned by /api/contacts.

## pitch — **SHALLOW**

- [ ] **(high)** Send pitch/proposal to a recipient by email (recipient email + name + personal message, with PDF attached) — `POST /api/pitch/[id]/send`
      - Add a 'Send' button in the inline pitch detail that opens an in-surface send form (recipient email/name + optional message) and POSTs to /api/pitch/[id]/send for READY/SENT pitches.
- [ ] **(high)** Delete a pitch or proposal — `DELETE /api/pitch/[id]`
      - Add a delete (trash) action on each pitch row / in the inline detail that calls DELETE /api/pitch/[id] with a confirm, then refreshes the list.
- [ ] **(high)** Download the generated proposal/pitch as a PDF — `POST /api/pitch/[id]/send {pdfOnly:true}`
      - Add a 'Download PDF' button in the inline detail that POSTs {pdfOnly:true} to /api/pitch/[id]/send and saves the returned blob.
- [ ] **(high)** Edit the pitch/proposal content (headline, findings, solution bullets, proposal sections) before sending — `PATCH /api/pitch/[id]`
      - Add an in-surface editor for the parsed pitchContent (reuse OutreachPitchEditor / proposal workspace) that PATCHes /api/pitch/[id]; at minimum allow editing the recipient and key copy fields.
- [ ] **(medium)** Full digital-presence audit / research view (digital health score, category breakdown, Google Business profile + reviews + hours, tech stack, pain points, growth opportunities, client-facing pitch preview) — `GET /api/pitch/[id] (returns research + full pitchContent)`
      - Expand the inline detail to render the research object (score, Google profile, reviews, pain points/opportunities, tech stack) and a client-facing pitch preview, not just title/subtitle/summary.
- [ ] **(medium)** Live status auto-refresh while a pitch is PENDING/RESEARCHING — `GET /api/pitch (and GET /api/pitch/[id])`
      - Poll /api/pitch every ~5s while any pitch has status PENDING/RESEARCHING (and the open detail) so in-progress pitches flip to Ready without a manual refresh.
- [ ] **(low)** Filter the pitch list by status (Ready / Sent / Failed / In-progress) — `GET /api/pitch?status=`
      - Add status filter chips next to the existing doc-type filter, passing ?status= to /api/pitch (or filtering the loaded list client-side).

## reviews — **SHALLOW**

- [ ] **(high)** Browsable directory/listings list (per-directory status, grouped by workflow state and tier) — `/api/listsmartly/listings`
      - Add an in-surface 'Listings' panel that fetches /api/listsmartly/listings and renders each directory with its status badge, last-checked time, and external View link grouped by status/tier.
- [ ] **(high)** Search + status filter + tier filter + pagination over listings — `/api/listsmartly/listings?search=&status=&tier=&page=&limit=`
      - Add a search input plus status and tier dropdowns above the listings panel wired to the same query params, with prev/next pagination controls.
- [ ] **(high)** Reviews filtering by platform, sentiment, and responded/unresponded status — `/api/listsmartly/reviews?platform=&sentiment=&responded=`
      - Add platform/sentiment/responded filter controls above the Recent reviews list that re-fetch /api/listsmartly/reviews with those params instead of the fixed limit=8 query.
- [ ] **(high)** Reply to a review in-surface: AI-draft a response and post it (also flag/archive) — `POST /api/listsmartly/ai/review-response (draft) and PUT /api/listsmartly/reviews/[id] (post/flag/archive)`
      - On each unresponded review add a 'Draft & reply' control that calls the AI-response API to fill an editable textarea, then PUT /api/listsmartly/reviews/[id] with responseStatus=posted to save; expose flag/archive too.
- [ ] **(medium)** Run a directory/review scan to refresh listing and review status — `POST /api/listsmartly/listings/scan`
      - Add a 'Scan now' button in the presence header that POSTs to /api/listsmartly/listings/scan and reloads analytics/reviews, rather than only offering the generative onAsk path.
- [ ] **(medium)** Per-tier coverage breakdown (live vs total per directory tier) — `/api/listsmartly/analytics (listingsByTier)`
      - Add a 'Coverage by tier' section that reads analytics.listingsByTier and renders a progress bar per tier showing live/total.
- [ ] **(medium)** Edit the business profile (NAP, hours, industry, description, social links) — `PUT /api/listsmartly/profile`
      - Add an 'Edit business info' form/drawer in the presence header that loads and PUTs /api/listsmartly/profile so users can correct NAP/hours/socials directly instead of read-only fields.

## media — **SHALLOW**

- [ ] **(high)** Delete a media file — `DELETE /api/media/[id]`
      - Add a Delete button in the lightbox footer (and a hover trash on each grid tile) that calls DELETE /api/media/[id] and removes the item from the grid.
- [ ] **(high)** Search files by name — `GET /api/media?search=`
      - Add a search input above the grid that passes ?search= to GET /api/media so users can find an asset by name in large libraries.
- [ ] **(high)** Folders: create, rename, delete, browse + breadcrumb — `GET/POST /api/media/folders, PUT/DELETE /api/media/folders/[id], GET /api/media?folderId=`
      - Add an in-surface folder rail/picker with create/rename/delete and a breadcrumb, filtering the grid via ?folderId= — the library is otherwise an undivided flat dump.
- [ ] **(high)** Move a file to a folder (single) — `PUT /api/media/[id] { folderId }`
      - Add a Move action in the lightbox that opens a folder picker and PUTs folderId to /api/media/[id].
- [ ] **(high)** Multi-select with bulk move and bulk delete — `PUT/DELETE /api/media/bulk { fileIds, folderId }`
      - Add a select mode (checkboxes on tiles) with a floating action bar offering bulk Move and bulk Delete via /api/media/bulk.
- [ ] **(medium)** Rename a file — `PUT /api/media/[id] { originalName }`
      - Make the filename in the lightbox editable (click-to-rename) and PUT originalName to /api/media/[id].
- [ ] **(medium)** Tags: view, add, remove, and filter by tag — `PUT /api/media/[id] { tags }, GET /api/media?tag=`
      - Show editable tag chips in the lightbox (PUT tags) and add tag-based filtering using GET /api/media?tag= so assets can be organized and found by tag.
- [ ] **(medium)** Download a file to disk — `client-side blob fetch of file.url`
      - Add a Download button in the lightbox (and on tile hover) that blob-fetches the URL and triggers a save with the original filename, instead of only 'Open original' in a new tab.
- [ ] **(medium)** Filter by SVG, document, and audio types — `GET /api/media?type=document|svg (audio supported server-side)`
      - Add Documents/SVG/Audio filter pills (the API and uploader already accept audio/pdf) so non-image/video assets are reachable — currently they upload but can't be filtered to.
- [ ] **(medium)** Generated Content library (saved AI text: posts/captions/hashtags/ideas) with search, type filter, favorite, copy, delete — `GET/PATCH/DELETE /api/content-library`
      - Add a 'Generated content' tab/section in the workspace that lists content-library items with filter/search and favorite/copy/delete actions, so saved AI text isn't orphaned from the new design.
- [ ] **(low)** Copy file URL to clipboard — `client-side navigator.clipboard`
      - Add a 'Copy URL' button beside 'Open original' in the lightbox footer that copies the absolute asset URL.
- [ ] **(low)** Lightbox prev/next navigation and image zoom — `n/a (client-side)`
      - Add left/right arrows to step through the filtered list and a zoom toggle for images inside the existing lightbox.

## video — **SHALLOW**

- [ ] **(high)** Open an existing campaign to view/edit it — `GET /api/ai/story-ad-campaign/[id]`
      - Make each render node open an in-surface campaign detail panel/drawer that fetches GET /api/ai/story-ad-campaign/[id] and exposes its stages, instead of only playing the final video.
- [ ] **(high)** Delete a campaign — `DELETE /api/ai/story-ad-campaign/[id]`
      - Add a delete action (with confirm) on each render node calling DELETE /api/ai/story-ad-campaign/[id], then refresh the canvas.
- [ ] **(high)** Per-clip review: approve / regenerate / edit script / reorder / add / remove — `POST /api/ai/story-ad-campaign/[id]/clips/manage and POST /api/ai/story-ad-campaign/[id]/clips/[clipId]/retry`
      - In the campaign detail panel render a clip grid with approve/regenerate/edit/reorder/add/remove controls wired to the clips/manage and clips/[clipId]/retry endpoints.
- [ ] **(high)** Retry a failed clip — `POST /api/ai/story-ad-campaign/[id]/clips/[clipId]/retry`
      - Surface failed clips inside the detail panel with a Retry button calling the clip retry endpoint; today a FAILED campaign is a dead node with no recovery.
- [ ] **(high)** Compose / finalize (and re-stitch) the final reel — `POST /api/ai/story-ad-campaign/[id]/finalize`
      - Add a 'Compose final reel'/'Re-stitch' button in the detail panel calling POST .../finalize so users can build the movie after editing clips rather than relying entirely on the agent.
- [ ] **(high)** Publish the finished reel to connected social destinations — `POST /api/ai/story-ad-campaign/[id]/publish`
      - Add a Deliver/Post panel with a destinations picker and caption box that POSTs to .../publish; the surface currently only offers Open/Download of the raw video.
- [ ] **(high)** Character management: regenerate preview, upload/swap reference image, AI-edit, approve — `POST /api/ai/story-ad-campaign/[id]/characters, .../characters/[characterId]/preview, .../characters/[characterId]/upload-image, .../characters/[characterId]`
      - Add a Characters step in the detail panel listing characters with regenerate-preview, upload-image, AI-suggest-edit, and approve actions wired to the characters endpoints.
- [ ] **(medium)** Write campaign caption + AI assist (draft/rewrite/shorten/hashtags/SEO) — `POST /api/ai/generate/post, /api/ai/generate/hashtags, /api/ai/generate/seo-keywords`
      - Include a caption editor with AI-assist buttons in the Deliver panel so users can prep the post copy before publishing.
- [ ] **(medium)** Scene grid + screenplay editing (plan/replan scenes, edit per-clip script, AI suggest) — `POST /api/ai/story-ad-campaign/[id]/scenes, .../suggest, PATCH /api/ai/story-ad-campaign/[id]`
      - Add a Scenes/Script step in the detail panel that plans/edits the scene grid and per-clip prompts via the scenes/suggest/PATCH endpoints.
- [ ] **(medium)** Narrator / voice preview and selection — `POST /api/ai/story-ad-campaign/[id]/voice-preview, GET /api/ai/elevenlabs/voices`
      - Add a narrator/voice picker with audio preview in the detail panel for narrated-style campaigns calling the voice-preview endpoint.
- [ ] **(medium)** Send-to-render batch action (deduct credits, render all clips) — `POST /api/ai/story-ad-campaign/[id]/batch-send`
      - Add a 'Send batch / Produce' button (with cost confirm) in the detail panel so a prepared campaign can be rendered directly rather than only via the agent.
- [ ] **(medium)** Render-tier / format controls (provider tier, clip length, batch-mode 50% off, full-animation, platforms, aspect, goal) — `POST /api/ai/story-ad-campaign + POST /api/ai/story-ad-campaign/estimate-cost-draft`
      - Expand the brief sheet to expose render quality tier, batch/50%-off mode, aspect ratio, distribution platforms and goal (the API already accepts them) so users aren't limited to style+length+9:16.
- [ ] **(low)** Per-campaign cost estimate before rendering — `GET /api/ai/story-ad-campaign/[id]/estimate-cost`
      - Show a live credit estimate for the open campaign (its actual clips) in the detail panel using the per-campaign estimate-cost route; the surface only estimates a brand-new draft today.
- [ ] **(low)** AI brief/goal suggestion in the create form — `POST /api/ai/story-ad-campaign/suggest-draft`
      - Add a 'Suggest' button on the brief textarea in the bottom sheet calling suggest-draft to help users write the brief.

## calendar — **SHALLOW**

- [ ] **(high)** Open a post's detail view (caption, media gallery, platforms, time, engagement) from the calendar — `GET /api/content/posts (data already loaded)`
      - Make clicking a post in the month grid / upcoming list open an in-surface detail drawer showing the caption, full media gallery, platforms, scheduled/published time and (for published posts) engagement, instead of opening the compose composer.
- [ ] **(high)** Reschedule a post (drag-and-drop or pick a new date/time) directly from the calendar — `PATCH /api/content/schedule (body: { postId, scheduledAt }) or PATCH /api/content/posts/[id]`
      - Add a 'Reschedule' control in the post detail drawer (and/or drag-and-drop on the month grid) that PATCHes /api/content/schedule with the new scheduledAt and refreshes the calendar.
- [ ] **(high)** Delete a scheduled/draft post from the calendar — `DELETE /api/content/posts/[id]`
      - Add a Delete action in the post detail drawer that calls DELETE /api/content/posts/[id] and removes the post from the calendar on success.
- [ ] **(high)** Edit an existing post's caption/media/platforms from the calendar — `PATCH /api/content/posts/[id] (caption, mediaUrls, platforms, scheduledAt, status)`
      - Add an 'Edit' button in the detail drawer that opens an in-surface edit form (or the compose view pre-loaded with the post) and PATCHes /api/content/posts/[id]; today the surface can only create new posts.
- [ ] **(high)** Show strategy/calendar notes and automation occurrences on the calendar (not just posts) — `GET /api/content/schedule?month=&start=&end=`
      - Switch the calendar's data source to GET /api/content/schedule so strategy tasks and upcoming campaign-automation occurrences appear alongside posts, giving a true content plan instead of only published/scheduled posts.
- [ ] **(high)** Create and edit calendar notes / strategy tasks (with date range, time, priority, category, templates) — `POST /api/content/schedule/notes and PATCH /api/content/schedule/notes/[id]`
      - Add an in-surface 'Add note' form (title, description, start/end date+time, priority, category) that POSTs/PATCHes /api/content/schedule/notes, so users can plan strategy work on the calendar, not just schedule posts.
- [ ] **(medium)** Week and Day calendar views (hour-by-hour timeline) — `GET /api/content/schedule (range-aware via start/end params)`
      - Add Week and Day view toggles to the existing Upcoming/Month switcher, rendering an hour-by-hour timeline for the visible range using the same data.
- [ ] **(medium)** Search the calendar and filter by status and by channel/platform — `GET /api/content/posts (client-side filter; or schedule endpoint)`
      - Add a search box plus status (scheduled/published/draft) and platform filters to the toolbar that filter the loaded posts before grouping them into the grid/list.
- [ ] **(medium)** View per-platform publish results and retry failed platforms — `POST /api/content/posts/[id]/retry (body: { platforms }) — note: requires publishResults from GET /api/content/schedule`
      - In the post detail drawer, surface the per-platform Posted/Failed results (from /api/content/schedule) and add a 'Retry' button that POSTs the failed platforms to /api/content/posts/[id]/retry.
- [ ] **(low)** Save a new post directly as a draft (status=DRAFT) from this surface — `POST /api/content/posts (status: "DRAFT")`
      - No standalone fix needed — the compose view already covers draft creation; this is listed only to confirm the create-as-draft path is reachable from the calendar's 'Schedule a post' entry.

## email — **PARTIAL**

- [ ] **(high)** Send / schedule a draft campaign — `POST /api/campaigns/[campaignId]/send`
      - Add a 'Send now' / 'Schedule' action button in the inline campaign detail for draft/scheduled campaigns that POSTs to /api/campaigns/[id]/send (with confirm + optional date-time picker) — this is a management action, not generative.
- [ ] **(high)** Delete a campaign — `DELETE /api/campaigns/[campaignId]`
      - Add a Delete control (with confirm dialog) on each non-active/non-sent campaign row or in its inline detail, calling DELETE /api/campaigns/[id] and removing it from the list.
- [ ] **(high)** Edit a draft campaign (name, subject, audience, sender, content) — `PATCH /api/campaigns/[campaignId]`
      - Add an in-surface edit panel for draft campaigns (inline form to change name/subject/audience list/sender) that PATCHes /api/campaigns/[id]; deep generative body rewrites can still route through onAsk.
- [ ] **(medium)** Search campaigns by name/subject — `GET /api/campaigns?search=`
      - Add a search input above the campaign list that re-fetches /api/campaigns?type=email&search=<q> so users can find campaigns by name or subject.
- [ ] **(medium)** Filter campaigns by status (drafts/scheduled/sent/failed) — `GET /api/campaigns?status=`
      - Add status filter chips (All/Drafts/Scheduled/Sent/Failed) that pass &status= to /api/campaigns so the list can be narrowed.
- [ ] **(medium)** Rendered HTML email preview (desktop + mobile, copy HTML) — `GET /api/campaigns/[campaignId] (contentHtml)`
      - In the inline detail, render detail.contentHtml in an iframe with a desktop/mobile toggle instead of only showing the plain-text body, so users can see what the email actually looks like.
- [ ] **(low)** Pause / resume a running campaign — `PATCH /api/campaigns/[campaignId] { status }`
      - Add a Pause/Resume toggle on active/paused campaign rows that PATCHes the campaign status.
- [ ] **(low)** Performance breakdown with computed rates (delivery, open, click, click-to-open, bounce, unsubscribe) and progress bars — `GET /api/campaigns/[campaignId] (counts)`
      - Extend the inline detail's stat block with computed rate rows/progress bars (delivery, click-to-open, bounce, unsubscribe) derived from the existing counts already returned.
- [ ] **(low)** Average click-rate KPI — `GET /api/campaigns (per-campaign clickRate)`
      - Add an 'Avg click rate' KPI tile alongside the existing Campaigns/Sent/Avg-open-rate rollups, averaging clickRate across campaigns.
- [ ] **(low)** Email automations (birthday / welcome / re-engagement triggered sends) — `GET/POST /api/marketing/automations`
      - If automations are in scope for this surface, add an in-surface automations section/tab to list and toggle triggered campaigns; otherwise track as a separate workspace.

## forms — **PARTIAL**

- [ ] **(high)** Delete a form/survey (and its submissions) — `DELETE /api/surveys/[id]  ·  DELETE /api/data-forms/[id]`
      - Add a Delete action on each row (with a confirm dialog) that calls DELETE /api/{data-forms|surveys}/[id] and removes the item from the list — the surface currently has no way to remove a form/survey.
- [ ] **(high)** Edit an existing form/survey (title, fields/questions, thank-you message, reorder) — `PUT /api/surveys/[id]  ·  PUT /api/data-forms/[id]`
      - Add an inline 'Edit' panel/drawer per item to rename, edit description/thank-you, and add/reorder/remove fields, saving via PUT — today the surface can only toggle status, so users can't fix a form after creation without the agent.
- [ ] **(high)** Send a form/survey to a contact list via email or SMS — `POST /api/surveys/[id]/send  ·  POST /api/data-forms/[id]/send`
      - Add a 'Send' action that opens an in-surface panel to pick a contact list (GET /api/contact-lists) and channel (email/SMS, gated on /api/marketing-config) and POSTs to the /send endpoint — distribution is core to the feature and is entirely absent.
- [ ] **(medium)** Share via copy-link, QR code, and embed code — `(client-only: navigator.clipboard / QRCodeDisplay component)`
      - Add a 'Share' action that copies the public link to clipboard and shows a QR code + embed-iframe snippet in a small in-surface popover; the surface only offers 'Open live' in a new tab.
- [ ] **(medium)** Search and filter the forms/surveys list (by name and by status) — `GET /api/surveys?search=&status=  ·  GET /api/data-forms?search=&status=`
      - Add a search box and status filter pills (All/Draft/Live/Closed) above the list that pass search/status query params (or filter the already-loaded items client-side) — useful once a user has many forms.
- [ ] **(medium)** Bulk-delete individual submissions/responses — `DELETE /api/surveys/[id]/responses (body {ids})  ·  DELETE /api/data-forms/[id]/submissions (body {ids})`
      - Add checkboxes + a 'Delete selected' button in the inline submissions panel that POSTs the chosen ids to the responses/submissions DELETE endpoint; the inline viewer is currently read-only.
- [ ] **(medium)** Search and paginate submissions/responses beyond the first 20 — `GET /api/surveys/[id]/responses?search=&page=&limit=  ·  GET /api/data-forms/[id]/submissions?search=&page=&limit=`
      - Add a search input and Prev/Next pagination to the inline submissions panel (the endpoints already return pagination meta); the surface hard-codes limit=20 with no way to see older entries.
- [ ] **(medium)** Sync form submissions into a contact list (create new or append) — `POST /api/data-forms/[id]/sync-contacts`
      - For forms, add a 'Save to contacts' action in the submissions panel that opens a small dialog to pick an existing list or name a new one and POSTs to /sync-contacts; this turns captured leads into CRM contacts and is missing.
- [ ] **(low)** Create a follow-up campaign from form submissions — `POST /api/data-forms/[id]/create-followup`
      - Add a 'Create follow-up' action on a form's submissions that POSTs to /create-followup and surfaces the new follow-up inside the new /home design (not the legacy /tools route).
- [ ] **(low)** Activate/re-open an item that is still in DRAFT — `PUT /api/surveys/[id]  ·  PUT /api/data-forms/[id]`
      - Show the status toggle for DRAFT items as well (the surface hides it when status === 'DRAFT'), so a freshly created draft can be set Live directly from the row.

## automations — **PARTIAL**

- [ ] **(high)** Open a detail view for one automation — `GET /api/automations/[automationId]`
      - Make each follow-up row clickable to open an in-surface detail panel/drawer that fetches GET /api/automations/[id] and shows its full config, stats, and logs.
- [ ] **(high)** Edit an automation's settings (name, subject, content, send time, days offset, timezone, audience list) — `PATCH /api/automations/[automationId]`
      - Add an in-surface edit form (in the detail drawer) with inputs for name/subject/content/sendTime/daysOffset/timezone and a contact-list selector, saving via PATCH — this is direct management, not generative.
- [ ] **(high)** Delete an automation — `DELETE /api/automations/[automationId]`
      - Add a Delete action (row overflow menu or detail-panel button) with a confirm dialog that calls DELETE and removes the row from the list.
- [ ] **(medium)** Per-automation delivery stats (sent/failed/skipped + success/failure/skip rates) — `GET /api/automations/[automationId] (data.automation.stats)`
      - In the detail panel, render the stats block returned by GET /api/automations/[id] (totalAttempted, sent, failed, skipped, rates).
- [ ] **(medium)** Recent delivery activity log (per-contact status, error, timestamp) — `GET /api/automations/[automationId] (data.automation.logs, logLimit/logOffset paging)`
      - In the detail panel, list the recent logs (contact name/email, SENT/FAILED/SKIPPED badge, error text, sentAt) with a load-more using logOffset.
- [ ] **(medium)** Reschedule/timing controls (send time, days offset, timezone) editable directly — `PATCH /api/automations/[automationId] (sendTime/daysOffset/timezone)`
      - Expose time/offset/timezone fields in the detail edit form so a user can retime a sequence without going through the agent.
- [ ] **(medium)** Change the audience (contact list) for an existing automation — `PATCH /api/automations/[automationId] (contactListId); lists from /api/contact-lists`
      - Add a contact-list <select> in the detail edit form, populated from /api/contact-lists, saving via PATCH contactListId.
- [ ] **(low)** Search / filter the automations list (by type, enabled, name/subject) — `GET /api/automations?type=&enabled=&search=`
      - Add a search box and type/active filter chips above the list that pass type/enabled/search query params to GET /api/automations.

## customers — **PARTIAL**

- [ ] **(high)** Search customers by name or email — `/api/ecommerce/customers?search= (route.ts:17, 23-28)`
      - Add an in-surface search input that sets a `search` query param on the existing fetch (the API already filters by name/email), debounced and resetting the page.
- [ ] **(high)** Pagination through the full customer list — `/api/ecommerce/customers?page=&limit= (route.ts:18-19, 67 returns totalPages)`
      - Replace the hardcoded ?limit=50 with page/limit state and add prev/next controls using the totalPages the API already returns, so users can reach customers beyond the first page.
- [ ] **(medium)** Bulk select + add many customers to contacts at once — `/api/ecommerce/customers/[customerId]/add-to-contacts (POST, looped per id)`
      - Add per-row checkboxes plus a select-all control and a 'Add N to contacts' bulk button that loops the existing add-to-contacts POST over the selected ids in-surface.
- [ ] **(medium)** Export customer list to CSV — `(client-side; uses already-loaded /api/ecommerce/customers data)`
      - Add an 'Export CSV' button that builds a CSV blob from the loaded customers (name, email, phone, orders, total spent, joined) and triggers a download, no backend needed.
- [ ] **(low)** Launch an email/SMS campaign to store customers — `(navigational in legacy; new design should route via agent/in-surface action)`
      - Add an in-surface 'Email these customers' / 'SMS these customers' action that hands the selected customers to the agent composer (onAsk) rather than linking to a legacy contacts page.

## delivery — **PARTIAL**

- [ ] **(high)** Edit an existing driver (name/phone/email/vehicle) — `PATCH /api/ecommerce/drivers/[id]`
      - Add an Edit action on each driver card in the Drivers section that opens the same inline form prefilled, PATCHing /api/ecommerce/drivers/[id].
- [ ] **(high)** Deactivate (soft-delete) a driver — `DELETE /api/ecommerce/drivers/[id]`
      - Add a Deactivate button (with confirm) on each active driver card that calls DELETE /api/ecommerce/drivers/[id] then reloads, so removed drivers stop receiving assignments.
- [ ] **(high)** Mark a delivery as failed / re-assign after failure — `PATCH /api/ecommerce/delivery/[orderId]/status`
      - Drive the action buttons off DELIVERY_STATUSES.allowedTransitions instead of the hard-coded happy-path map so the operator can also mark deliveries failed and re-assign them.
- [ ] **(medium)** Driver email field when creating a driver — `POST /api/ecommerce/drivers`
      - Add an optional Email input to the new-driver form and include it in the POST body (the API already accepts email).
- [ ] **(medium)** Copy driver tracking link (GPS reporting access token) — `GET/POST /api/ecommerce/drivers/[id]/location (token)`
      - Add a 'Copy tracking link' button per driver card that copies the /api/ecommerce/drivers/[id]/location?token=... URL so drivers can report live location.
- [ ] **(medium)** Driver live GPS location + last-update time — `GET /api/ecommerce/drivers (currentLatitude/Longitude/lastLocationUpdate) and /api/ecommerce/delivery/[orderId]`
      - Show the driver's last-known coordinates and update timestamp on the driver card and on assigned deliveries (data is already returned by the drivers list).
- [ ] **(medium)** ETA (estimated delivery time) on each delivery — `/api/ecommerce/orders (deliveryAssignment.estimatedDeliveryTime); POST /api/ecommerce/delivery/[orderId] accepts estimatedDeliveryTime`
      - Display estimatedDeliveryTime as an ETA line on each delivery row and optionally allow setting it during assignment (the assign API already accepts estimatedDeliveryTime).
- [ ] **(medium)** COD pending-collection visibility per delivery and as a KPI — `/api/ecommerce/orders (deliveryAssignment.codAmountCents/codCollected)`
      - Add a 'COD pending' KPI and show the COD amount + collected/pending badge on each delivery row (the surface already tags COD but never surfaces the collection state).
- [ ] **(low)** Delivered-today metric — `GET /api/ecommerce/orders?status=DELIVERED&dateFrom=<today>`
      - Add a 'Delivered today' KPI using a dated DELIVERED orders query instead of the all-time delivered count currently shown.
- [ ] **(low)** Driver fleet status breakdown (available/busy/offline counts) — `GET /api/ecommerce/drivers`
      - Add small available/busy/offline tallies above the Drivers list (derivable client-side from the already-fetched drivers array).

## leads — **PARTIAL**

- [ ] **(high)** Full pitch/proposal detail view (digital presence audit, score breakdown, Google profile, reviews, pain points, opportunities, client pitch preview) — `/api/pitch/[id]`
      - Add an in-surface document detail panel/drawer that fetches /api/pitch/[id] and renders the research audit (digital health score, category breakdown, Google Business profile + reviews, tech stack, pain points, opportunities) and the client-facing pitch preview, opened from a generated pitch/proposal row.
- [ ] **(high)** Download the pitch/proposal as a branded PDF — `/api/pitch/[id]/send (pdfOnly:true)`
      - Add a 'PDF' button on each generated pitch/proposal row that POSTs { pdfOnly: true } to /api/pitch/[id]/send and triggers a blob download, so users can grab the document without emailing it.
- [ ] **(medium)** Proposal builder/layout type selection (visual sales deck, professional services, process framework) — `/api/pitch/proposals (builderType)`
      - In the new-proposal form add a 3-option builderType selector and pass builderType in the /api/pitch/proposals body so the user controls the proposal/PDF layout.
- [ ] **(medium)** Structured offer inputs on proposal creation: pricing, original price, billing interval, goals, terms, service packages, custom additions — `/api/pitch/proposals (price, originalPrice, billingInterval, goals, terms, servicePackages, customAdditions)`
      - Expand the in-surface proposal form with optional fields for price/originalPrice/billing interval, goals, terms, selectable brand service packages and custom additions, passing them through to /api/pitch/proposals (the route already accepts them).
- [ ] **(medium)** Convert/import selected leads into the Contacts/CRM as a contact list — `/api/leads/to-contacts`
      - Add a 'Add to contacts' action on selected search results (or a saved list) that POSTs to /api/leads/to-contacts so prospects flow into the CRM, not just the SavedLead store.
- [ ] **(low)** Brand-identity readiness gating / prompt before generating — `/api/brand`
      - When pitch/proposal creation returns BRAND_IDENTITY_REQUIRED, surface an in-line notice in the surface guiding the user to set up their Brand Kit (without a legacy link) instead of silently swallowing the error.
- [ ] **(low)** Live status polling while a pitch/proposal is researching/building — `/api/pitch?savedLeadId=...`
      - Poll the lead's pitch list every few seconds while any item is PENDING/RESEARCHING so the status pill updates to READY/SENT/FAILED without a manual re-open.
- [ ] **(low)** Past lead-search history — `/api/leads/search (GET)`
      - Optionally show recent searches (GET /api/leads/search) as quick-rerun chips above the search box so users can revisit prior queries.

## publish — **PARTIAL**

- [ ] **(high)** Delete a post — `DELETE /api/content/posts/[id]`
      - Add a per-PostRow overflow/delete control that calls DELETE /api/content/posts/[id] and refetches the list, so users can remove drafts/scheduled/published posts directly from the Publish list.
- [ ] **(high)** Edit an existing post (caption, media, platforms, schedule, status) — `PATCH /api/content/posts/[id]`
      - Make PostRow open an in-surface edit drawer/panel (reusing the compose form) wired to PATCH /api/content/posts/[id] so users can fix a caption, swap media, change platforms, or change status from the list.
- [ ] **(high)** Reschedule / cancel a scheduled post — `PATCH /api/content/posts/[id]`
      - On SCHEDULED rows add a 'Reschedule' (datetime-local) and 'Unschedule → draft' action that PATCHes scheduledAt/status, since the only way to manage queued posts today is to recreate them.
- [ ] **(high)** Retry failed cross-posts to social platforms — `POST /api/content/posts/[id]/retry`
      - Surface per-platform publish status on published PostRows and a 'Retry failed' action that POSTs to /api/content/posts/[id]/retry, so users can recover from a partial cross-post failure without re-posting.
- [ ] **(medium)** Post detail view with per-platform publish results / errors — `GET /api/content/posts (publishResults) `
      - Let a PostRow expand into a detail panel showing each target platform's success/failure and error message (e.g. needs-reconnect), instead of only the flat 'views · likes' summary.
- [ ] **(medium)** Search / filter the posts list — `GET /api/content/posts?status=&limit=`
      - Add a caption/text search box (and optional platform filter) above the list; the GET route can be extended to accept a query, so users with many posts can find one.
- [ ] **(medium)** Pagination / load more (list capped at 30) — `GET /api/content/posts?page=&limit=`
      - Use the API's page/hasMore pagination with a 'Load more' button or infinite scroll instead of the hard-coded limit=30, so older posts remain reachable.
- [ ] **(low)** Duplicate / repost an existing post — `POST /api/content/posts`
      - Add a 'Duplicate' row action that prefills the compose view with the post's caption/media/platforms via POST /api/content/posts, making it easy to re-run a high-performing post.

## compose — **PARTIAL**

- [ ] **(high)** Per-account destinations (one selectable target per connected account, not just per platform) — `GET /api/social-accounts (returns data.platforms[].accounts[] with id/displayName/username/avatarUrl)`
      - In the 'Post to' chip list, expand each connected platform into one chip per account (using platforms[].accounts[]), labeling by account displayName/username so users with multiple pages/handles can target a specific one.
- [ ] **(high)** Per-platform media-compatibility validation (block/auto-deselect channels that can't take the attached media and show why) — `client-side via PLATFORM_REQUIREMENTS / publish results from POST /api/content/posts`
      - Compute a per-target compatibility reason from the attached media type (text-only / image / video) and disable or annotate incompatible chips inline (e.g. 'Requires video'), auto-removing them from the selection when media changes.
- [ ] **(high)** Publish results per platform (success/failure breakdown after posting) — `POST /api/content/posts returns data.publishResults keyed by platform`
      - After posting, read response.data.publishResults and render an in-surface results panel listing each external target with a success/fail status and the error message, instead of only a single generic 'Posted' confirmation.
- [ ] **(high)** Retry failed platforms after a partial publish — `POST /api/content/posts/[id]/retry { platforms }`
      - On the in-surface results panel, add a 'Retry failed' action that POSTs the failed platform ids to /api/content/posts/{postId}/retry and updates the per-platform statuses in place.
- [ ] **(high)** Reconnect awareness for stale/insufficient-scope accounts (warning + reconnect action) — `GET /api/social-accounts (accounts[].needsReconnect / missingScopes); failure errors from POST /api/content/posts`
      - Flag targets whose account.needsReconnect is true (badge on the chip) and, on a publish failure mentioning reconnect/scope, surface an in-surface 'Reconnect this account' link to the connections flow rather than silently failing.
- [ ] **(medium)** Per-platform live preview (channel-styled post card you can switch across selected channels) — `client-side render only (no API)`
      - Add an in-surface 'Preview' panel that renders the caption + attached media as a platform-styled card with tabs to switch between the selected targets, so users see how the post looks before publishing.
- [ ] **(medium)** Channel search to find a target quickly — `client-side filter over GET /api/social-accounts data`
      - Add a small search input above the 'Post to' chips that filters the target list by label/username for users with many connected accounts.
- [ ] **(medium)** Select-all / Clear channels controls — `client-side selection over GET /api/social-accounts data`
      - Add 'Select all' and 'Clear' buttons next to the target chips so a user can cross-post to every compatible connected account or reset to just the feed in one click.
- [ ] **(low)** Date+time scheduling with quick 'suggested time' presets — `none (presets); POST /api/content/posts { scheduledAt }`
      - Alongside the existing datetime-local input, offer a few one-tap suggested slots (e.g. tomorrow 9am/3pm) that fill the schedule time, since the surface already supports scheduledAt.
- [ ] **(low)** Larger media gallery for multi-image posts (legacy allows up to 50 attachments; surface caps at 4) — `POST /api/content/posts (accepts mediaUrls[] array of any length)`
      - Raise the MediaUploader maxFiles from 4 toward the legacy limit so users can attach full carousels/galleries the API already stores in mediaMeta.

## connections — **PARTIAL**

- [ ] **(high)** Connection-slot limit awareness (used / plan limit, at-limit warning) — `/api/social-accounts (returns data.connectionSlots.effectiveLimit, connectedCount)`
      - The surface already receives connectionSlots from /api/social-accounts but ignores it; render a 'X / limit connected' header badge and an at-limit notice so users know when they can no longer add accounts.
- [ ] **(high)** Unlock an extra connection slot with credits when the plan limit is reached — `/api/social-accounts/unlock (POST { platform, quantity })`
      - When a platform is at limit, show a 'Unlock slot (N credits)' button that opens an in-surface confirm sheet posting to /api/social-accounts/unlock, then reload — instead of silently letting 'Connect' fail.
- [ ] **(medium)** Per-account token expiry / health status (Expires in Nd, Expired) — `/api/social-accounts (tokenExpiresAt is returned per account)`
      - Add tokenExpiresAt to the Account type and render a small status line/badge (Expired / Expires in Nd) on each connected-account row so users know which logins need refreshing.
- [ ] **(medium)** Show which permission/scope is missing when an account needs reconnect — `/api/social-accounts (missingScopes array per account)`
      - Include missingScopes in the Account type and show a short explanatory line under the Reconnect button (e.g. 'Reconnect to enable media uploads') so the reason is clear.
- [ ] **(low)** Disconnect confirmation before removing an account — `/api/social-accounts/[id] (DELETE)`
      - Add a lightweight confirm step (inline confirm on the X button or a small sheet) before calling DELETE, warning that scheduled posts/automations will lose access.

## analytics — **PARTIAL**

- [ ] **(high)** Refresh live data from connected platforms (Facebook/Instagram/YouTube/WhatsApp) — `/api/social-accounts/analytics?refresh=true`
      - Add a 'Refresh live data' button in the surface header that calls /api/social-accounts/analytics?refresh=true, then re-fetches /api/analytics so the user can pull fresh platform metrics in-place.
- [ ] **(high)** Connected social account health (per-account followers/reach/engagement + token/sync status) — `/api/social-accounts/analytics`
      - Add a 'Connected accounts' section listing each account from /api/social-accounts/analytics with followers/reach/engagement and a status badge (synced/token expired/needs token/sync failed).
- [ ] **(medium)** Chart mode toggle (Views / Engagement / Boosted-vs-organic) — `/api/analytics?range= (chartData includes likes/comments/shares/clicks/boostedViews/organicViews)`
      - Add a small mode switch above the chart that re-renders the existing series for views, summed engagement, or boosted/organic split from the chartData fields already returned.
- [ ] **(medium)** Boosted vs organic distribution breakdown — `/api/analytics?range= (data.boostedVsOrganic)`
      - Add a 'Distribution' card rendering the boostedVsOrganic split (posts/views/likes/comments/shares as boosted vs organic bars), which the API already returns and the surface currently drops.
- [ ] **(medium)** Ad spend and earnings summary — `/api/analytics?range= (data.adStats: activeCampaigns/totalImpressions/totalSpent/totalEarned)`
      - Add an 'Ads & spend' card or KPIs showing active campaigns, impressions, spend, and earned from data.adStats, which the surface currently ignores.
- [ ] **(medium)** Internal clicks metric (KPI + per-platform + per-post) — `/api/analytics?range= (stats.clicks/clicksChange, platformStats.clicks, topPosts.clicks)`
      - Add a Clicks KPI (using stats.clicks/clicksChange) and surface per-post/per-platform clicks in the top content and by-platform cards, since the data is already returned but not displayed.
- [ ] **(low)** Per-platform publishing detail (posts count, clicks, last-post time) — `/api/analytics?range= (data.platformStats: posts/clicks/lastPostAt)`
      - Expand the existing 'By platform' card to also show posts count, clicks, and last-post time from platformStats instead of only views/likes.
- [ ] **(low)** Comments engagement metric — `/api/analytics?range= (stats.comments/commentsChange)`
      - Include comments in the engagement KPI helper or as a small stat, using stats.comments which the API already returns.
- [ ] **(low)** Error + retry state for the analytics fetch — `/api/analytics`
      - Render an inline error card with a Retry button when the /api/analytics fetch fails instead of silently swallowing the error.

## logo — **PARTIAL**

- [ ] **(high)** Set a generated logo as the brand logo (icon or full) — `POST /api/brand`
      - Add 'Set as full logo' / 'Set as icon' buttons on each gallery LogoCard (and on the current-brand section) that POST the chosen imageUrl to /api/brand, so users can promote a generated concept to their brand identity in-surface.
- [ ] **(low)** Download all generated logos at once — `none (client-side blob downloads of imageUrl)`
      - Add a 'Download all' button in the gallery header that iterates the loaded logos and triggers a download for each imageUrl.
- [ ] **(low)** Large preview modal with light + dark + transparency (checkered) backdrops — `none (renders existing imageUrl)`
      - Make each LogoCard open an in-surface modal showing the logo enlarged on light/checkered and dark backgrounds to verify transparency before download or setting as brand logo.

## brand — **PARTIAL**

- [ ] **(medium)** Full postal address capture (street address, state, ZIP, country) — `/api/brand (POST — address, state, zip, country fields)`
      - Add Street address, State, ZIP, and Country inputs to the Contact section of brand-workspace.tsx (state/zip aren't even in the Kit type yet) so the full business address that feeds AI designs, listings and local-search SEO can be edited in-surface.
- [ ] **(low)** Brand setup-complete status indicator — `/api/brand (GET returns data.hasSetup / brandKit.isComplete)`
      - Read hasSetup from the GET /api/brand response and show a small 'Setup complete' / 'Finish setup' pill in the toolbar so the user knows whether the kit meets the completeness bar (name + industry + audience + voice).

## teams — **PARTIAL**

- [ ] **(high)** Change a member's role — `PATCH /api/teams/[teamId]/members`
      - Add an inline role dropdown/menu on each member row (owner-only, since the API restricts PATCH to OWNER) that PATCHes /api/teams/[teamId]/members with { userId, role } and reloads.
- [ ] **(high)** Multi-team support / switch between teams — `GET /api/teams + GET /api/teams/[teamId]`
      - Replace the hardcoded list[0] selection with a team picker (tabs or dropdown) when GET /api/teams returns more than one team, so users in multiple teams aren't locked to the first one.
- [ ] **(medium)** Resend a pending invitation — `PATCH /api/teams/[teamId]/invitations`
      - Add a Resend control next to each pending invitation's Cancel button that PATCHes /api/teams/[teamId]/invitations with { invitationId }.
- [ ] **(medium)** Bulk-invite teammates from contact lists — `POST /api/teams/[teamId]/members (emails[] array)`
      - Add a 'from contacts' mode to the inline invite form that loads contact lists/contacts, multi-selects emails, and POSTs { emails, role } to /api/teams/[teamId]/members.
- [ ] **(medium)** Edit team name/description (team settings) — `PATCH /api/teams/[teamId]`
      - Add an inline editable team-name/description settings section (admin+) that PATCHes /api/teams/[teamId] with { name, description }.
- [ ] **(medium)** Delete the team (danger zone) — `DELETE /api/teams/[teamId]`
      - Add an owner-only delete-team action with a confirm step that DELETEs /api/teams/[teamId] and returns the surface to its empty state.
- [ ] **(low)** Search members — `client-side filter (no dedicated API)`
      - Add a client-side search box above the member list to filter by name/email for large teams.
- [ ] **(low)** Create a new team — `POST /api/teams`
      - Optional: surface a 'Create team' action from the empty state that POSTs /api/teams; acceptable to leave routed through the agent (onAsk) since creation is plan-gated/agent-driven per the surface's design.
- [ ] **(low)** Team projects & tasks management — `/api/teams/[teamId]/projects (+ tasks routes)`
      - Out of this surface's members/invites/roles scope; projects/tasks are a separate feature and would belong to a dedicated projects surface rather than the Teams members workspace.

## referrals — **PARTIAL**

- [ ] **(high)** Commission history table (per-payout records) — `/api/referrals (data.commissions)`
      - Add a 'Commission history' section below the referred-users list that renders data.commissions (already returned by GET /api/referrals) with date, from (referredName), amount, source type and PENDING/PAID status badges.
- [ ] **(high)** One-tap social share (Twitter/X, WhatsApp, Email) — `n/a (client-side share intents using the loaded link)`
      - Add 'Share via' buttons next to the Copy action in the hero that open pre-filled twitter.com/intent, wa.me, and mailto: URLs built from the existing link state.
- [ ] **(medium)** Pagination through all referrals (beyond first 30) — `/api/referrals?page=N&limit=20 (data.pagination)`
      - Read data.pagination and add Previous/Next (or 'Load more') controls that re-fetch with an incremented page param so users with many referrals can browse the full list.
- [ ] **(medium)** Referral type label (Client vs Agent referral) — `/api/referrals (referrals[].referralType)`
      - Render a small badge per referred person mapping referralType (USER_TO_CLIENT/AGENT_TO_CLIENT -> 'Client', AGENT_TO_AGENT -> 'Agent') using the field already present in the ReferredUser type.
- [ ] **(medium)** Per-referral commission rate and type (e.g. '5% recurring') — `/api/referrals (referrals[].commissionRate, commissionType)`
      - Show each referral's commissionRate (as a percentage) plus a recurring/one-time qualifier from commissionType in the referred-person row, since both fields are already fetched but unused.
- [ ] **(low)** Pending commissions as a first-class KPI — `/api/referrals (stats.pendingCommissionsCents)`
      - Promote pendingCommissionsCents from the conditional inline pill to a fourth KPI card alongside Referred/Converted/Earned so pending payout is always visible.
- [ ] **(low)** Retry action on load error — `/api/referrals (re-fetch)`
      - In the error state, add a 'Retry' button that re-invokes load() instead of only displaying the error text.
