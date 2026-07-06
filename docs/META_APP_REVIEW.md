# Meta App Review — FlowSmartly (App ID 2014720428980289)

Submission-ready notes for getting Facebook, Instagram, and WhatsApp permissions
approved so **all** FlowSmartly users (not just app admins/testers) can connect
their own Pages / IG accounts / WhatsApp numbers.

> **Why review is needed:** advanced permissions work in *Development* mode (and
> for app admins/testers in Live mode) without review, but to serve real
> customers on **Live** the permissions below must be **approved**. FlowSmartly
> already implements all of them — this is a review/justification exercise, not
> new code.

---

## 0. Pre-requisites (do these first)

1. **Business Verification** — Meta requires the business behind the app to be
   verified (App Dashboard → **App settings → Basic → Business Verification** /
   **App Review → Requirements**). Have business docs ready. This gates the
   whole review.
2. **Privacy Policy URL** and **Data Deletion** instructions/callback set in
   App settings → Basic. (Users' tokens are stored per `SocialAccount`; document
   deletion.)
3. **App is Live** (top toggle) — required for review.
4. **A test Page, test IG Business account, and a test WhatsApp number** the
   reviewer can use, plus **test user credentials** for FlowSmartly itself
   (email + password) so the reviewer can log in and reproduce each flow.
5. Each requested permission needs: a **written justification** (below) + a
   **screencast** demonstrating it end-to-end (script in §4).

---

## 1. Permissions to request — grouped by product

These are exactly what the code requests today (source of truth = the connect
routes). **Request all of them** — the app genuinely uses each one.

### Facebook (Pages) — `src/app/api/social/facebook/connect/route.ts`
| Permission | Used for |
|---|---|
| `pages_show_list` | List the user's Pages so they can choose which to connect. |
| `pages_manage_posts` | Publish text/photo/video posts to the selected Page (Compose → Post now). |
| `pages_read_engagement` | Read Page/post engagement to show performance in the dashboard. |
| `pages_manage_metadata` | Subscribe the app to the Page (webhooks) and manage the connection needed to post. |
| `read_insights` | Read Page/post insights for the analytics surface. |
| `business_management` | Resolve Pages owned via **Business Manager** when `/me/accounts` is empty (the callback falls back to `/me/businesses?fields=…owned_pages,client_pages`). |

### Instagram (Graph) — `src/app/api/social/instagram/connect/route.ts`
| Permission | Used for |
|---|---|
| `instagram_basic` | Read the connected IG Business account (username, avatar, id) to display it and target publishes. |
| `instagram_content_publish` | Publish image / Reel / carousel to the IG Business account (container → publish). |
| `pages_show_list` | Find the Page that the IG Business account is linked to (IG publishing runs through the parent Page token). |
| `pages_manage_metadata` | Manage the Page↔IG link required for publishing. |
| `business_management` | Same Business-Manager fallback as Facebook, to resolve the linked Page/IG. |

### WhatsApp (Cloud API) — `src/app/api/social/whatsapp/connect/route.ts` + Embedded Signup
| Permission | Used for |
|---|---|
| `whatsapp_business_management` | List the WABA's phone numbers, register them for Cloud API, and manage message templates. |
| `whatsapp_business_messaging` | Send and receive WhatsApp messages via the Cloud API — the shared inbox + the AI auto-reply agent. |

> **⚠️ Doc drift note:** the older `docs/FACEBOOK_GOOGLE_OAUTH_SETUP.md` tells you
> to *remove* `business_management`, `pages_manage_metadata`, and the WhatsApp
> scopes. **Ignore that** — the current code actively uses all of them, so
> dropping them would break Business-Manager page resolution and the entire
> WhatsApp product. Submit the full list above.

---

## 2. Per-permission justifications (paste into App Review)

Keep each to a few sentences; describe **what the user does**, **which
permission enables it**, and **why a narrower scope won't work**.

- **`pages_show_list`** — When a user connects Facebook, FlowSmartly shows a list
  of the Pages they manage so they can pick which one to publish from. Without
  it we cannot enumerate Pages and the user cannot select a destination.

- **`pages_manage_posts`** — The core value: from FlowSmartly's Compose screen a
  user writes a caption, attaches photos/video, and clicks "Post now" to publish
  to their selected Page. This permission performs the publish
  (`/{page-id}/feed`, `/photos`, `/videos`).

- **`pages_read_engagement`** — After publishing, users see reactions/comments/
  reach for their Page and posts in FlowSmartly's dashboard. This permission
  reads that engagement data.

- **`pages_manage_metadata`** — FlowSmartly subscribes to the Page to keep the
  connection healthy and enable posting. Needed to manage the app's Page
  subscription/settings.

- **`read_insights`** — FlowSmartly's analytics surface shows Page and post
  insights (impressions/reach). This permission reads those metrics.

- **`business_management`** — Many customers manage their Pages/IG accounts
  through Meta Business Manager. When `/me/accounts` returns nothing, FlowSmartly
  resolves owned/client Pages via `/me/businesses`. Without it, Business-Manager
  users cannot connect their Pages.

- **`instagram_basic`** — Reads the connected Instagram Business account's
  profile (username, avatar, id) to display the connection and target publishes.

- **`instagram_content_publish`** — Publishes the user's image/Reel/carousel to
  their Instagram Business account from Compose (create media container → poll →
  publish). This is the core Instagram feature.

- **`whatsapp_business_management`** — On connect, FlowSmartly lists the WABA's
  phone numbers, registers them for the Cloud API, and lets users create/manage
  message templates for customer messaging.

- **`whatsapp_business_messaging`** — Powers FlowSmartly's WhatsApp shared inbox
  and AI auto-reply agent: receiving inbound customer messages (webhook) and
  sending replies/templates via the Cloud API.

---

## 3. What to record — coverage matrix

Meta wants to *see* each permission used. One 3–5 min screencast per product,
logged in as a **test user**, is enough if it hits every permission:

| Screencast | Demonstrates |
|---|---|
| A. Facebook connect + post | `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`, `pages_manage_metadata`, `business_management`, `read_insights` |
| B. Instagram connect + post | `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_manage_metadata`, `business_management` |
| C. WhatsApp connect + inbox/agent | `whatsapp_business_management`, `whatsapp_business_messaging` |

---

## 4. Screencast script (record exactly this)

Record at 1080p, show the browser URL bar, and **narrate each step**. Start each
video by logging into FlowSmartly with the reviewer test account.

### A. Facebook — connect & publish
1. Log in to FlowSmartly → open **Connections**.
2. Click **Connect** on the Facebook card → the Facebook OAuth dialog appears.
   **Pause on the consent screen so the requested permissions are visible.**
3. Approve → choose the test Page from the list shown in FlowSmartly
   *(shows `pages_show_list` / `business_management`)*.
4. Go to **Compose**, write a caption, attach a photo, select the Facebook Page,
   click **Post now** → the publishing modal shows it go **Published**
   *(shows `pages_manage_posts`, `pages_manage_metadata`)*.
5. Open the Facebook Page in a new tab → show the post is live.
6. Back in FlowSmartly, open the analytics/performance view → show the Page/post
   engagement + insights *(shows `pages_read_engagement`, `read_insights`)*.

### B. Instagram — connect & publish
1. **Connections** → **Connect** on the Instagram card → OAuth dialog (pause on
   consent) → approve → the linked IG Business account appears
   *(shows `instagram_basic`, `pages_show_list`, `pages_manage_metadata`,
   `business_management`)*.
2. **Compose** → caption + image → select the IG account → **Post now** → modal
   shows **Published** *(shows `instagram_content_publish`)*.
3. Open Instagram → show the post live.

### C. WhatsApp — connect, inbox & agent
1. **Connections** (or WhatsApp studio) → **Connect WhatsApp** → complete
   Embedded Signup → the phone number registers *(shows
   `whatsapp_business_management`)*.
2. From a **personal phone**, send a message to the test WhatsApp number.
3. In FlowSmartly's WhatsApp inbox, show the inbound message arrive, then the
   **AI agent auto-reply** send back (or send a template) → the customer's phone
   receives it *(shows `whatsapp_business_messaging`)*.
4. Show creating/submitting a **message template** *(reinforces
   `whatsapp_business_management`)*.

---

## 5. Data handling / privacy (reviewers check this)

- **Tokens**: stored per-user in the `SocialAccount` table (Page tokens, WABA
  tokens, phone-number IDs). Document where and that they're used only to act on
  the connected account.
- **Deletion**: disconnecting an account in FlowSmartly deletes the
  `SocialAccount` row and revokes usage; document the Data Deletion callback/URL
  in App settings.
- **Scope minimization**: state that each permission maps to a concrete user
  action above and none are used for bulk data collection.

---

## 6. Submit checklist

- [ ] Business verified
- [ ] Privacy Policy + Data Deletion URLs set
- [ ] App is Live
- [ ] Test FlowSmartly login + test Page/IG/WhatsApp provided in review notes
- [ ] All permissions in §1 added to the review with the §2 justifications
- [ ] Screencasts A/B/C uploaded, each pausing on the OAuth consent screen
- [ ] Re-check that the live connect routes still request exactly the §1 scopes
