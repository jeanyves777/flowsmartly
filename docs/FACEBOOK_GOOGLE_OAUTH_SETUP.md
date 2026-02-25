# Facebook & Google OAuth + Social Media Integration Setup Guide

## ✅ COMPLETED IMPLEMENTATION

### 1. Database Schema
- ✅ Updated `User` model with OAuth fields:
  - `passwordHash` (now optional for OAuth users)
  - `oauthProvider` ("google", "facebook", or null)
  - `oauthId` (Google/Facebook user ID)
  - `oauthAvatarUrl` (profile picture from OAuth provider)

### 2. OAuth Routes Created
- ✅ `/api/auth/facebook` - Facebook login initiation
- ✅ `/api/auth/facebook/callback` - Facebook OAuth callback
- ✅ `/api/auth/google` - Google login initiation
- ✅ `/api/auth/google/callback` - Google OAuth callback

### 3. UI Updates
- ✅ Login page: Added "Continue with Google" and "Continue with Facebook" buttons
- ✅ Register page: Added OAuth buttons
- ✅ Updated login API to detect OAuth users and provide helpful error messages

### 4. Utilities
- ✅ Created `generateUsername()` utility for auto-generating unique usernames from OAuth profiles

---

## 📋 FACEBOOK APP REVIEW - FINAL PERMISSION LIST

Submit App Review with **ONLY these 9 permissions:**

### Already Approved (Renew)
1. ✅ `public_profile` - User's basic info (name, profile picture)
2. ✅ `email` - User's email address
3. ✅ `Page Public Content Access` - Read public page content
4. ✅ `pages_show_list` - List user's Facebook pages

### NEW - Request These
5. ✅ `pages_manage_posts` - **CRITICAL** - Publish posts to Facebook pages
6. ✅ `pages_read_engagement` - Read likes, comments, shares (for analytics)
7. ✅ `instagram_basic` - Access Instagram Business accounts
8. ✅ `instagram_content_publish` - **CRITICAL** - Publish to Instagram
9. ✅ `read_insights` - Read page/post insights (for analytics dashboard)

### ❌ REMOVE These (Don't Submit)
- ❌ Ads Management Standard Access
- ❌ ads_read, ads_management, business_management
- ❌ Business Asset User Profile Access
- ❌ Page Mentions, pages_manage_engagement, pages_read_user_content
- ❌ pages_user_timezone, pages_manage_metadata
- ❌ Instagram Public Content Access, instagram_manage_messages
- ❌ whatsapp_business_management, whatsapp_business_messaging

---

## 🔧 FACEBOOK APP SETUP

### Step 1: Create Facebook App
1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Click "My Apps" → "Create App"
3. Choose "Consumer" type
4. App name: "FlowSmartly"
5. Contact email: Your email
6. Click "Create App"

### Step 2: Configure OAuth Settings
1. In dashboard → Settings → Basic
2. Add App Domains: `flowsmartly.com` (and `localhost` for testing)
3. Privacy Policy URL: `https://flowsmartly.com/privacy`
4. Terms of Service URL: `https://flowsmartly.com/terms`

### Step 3: Facebook Login Setup
1. In dashboard → Add Product → "Facebook Login"
2. Settings → Valid OAuth Redirect URIs:
   ```
   http://localhost:3000/api/auth/facebook/callback
   https://flowsmartly.com/api/auth/facebook/callback
   ```
3. Save changes

### Step 4: Get Credentials
1. Settings → Basic
2. Copy **App ID** → `.env` as `FACEBOOK_APP_ID`
3. Click "Show" on **App Secret** → `.env` as `FACEBOOK_APP_SECRET`

### Step 5: Switch to Live Mode
1. App Mode toggle (top right) → Switch to "Live"
2. Complete App Review for each permission

---

## 🔧 GOOGLE OAUTH SETUP

### Step 1: Create Google Cloud Project
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create new project: "FlowSmartly"
3. Enable "Google+ API"

### Step 2: Create OAuth Credentials
1. APIs & Services → Credentials → "Create Credentials" → "OAuth client ID"
2. Application type: "Web application"
3. Name: "FlowSmartly Web"
4. Authorized redirect URIs:
   ```
   http://localhost:3000/api/auth/google/callback
   https://flowsmartly.com/api/auth/google/callback
   ```
5. Click "Create"

### Step 3: Get Credentials
1. Copy **Client ID** → `.env` as `GOOGLE_CLIENT_ID`
2. Copy **Client secret** → `.env` as `GOOGLE_CLIENT_SECRET`

### Step 4: Configure OAuth Consent Screen
1. OAuth consent screen → "External"
2. App name: "FlowSmartly"
3. User support email: Your email
4. Developer contact: Your email
5. Scopes: `email`, `profile`, `openid`
6. Save and continue

---

## 🔐 ENVIRONMENT VARIABLES

Add to `.env`:

```bash
# Facebook OAuth
FACEBOOK_APP_ID=your_facebook_app_id_here
FACEBOOK_APP_SECRET=your_facebook_app_secret_here

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id_here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# App URL (for OAuth callbacks)
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Development
# NEXT_PUBLIC_APP_URL=https://flowsmartly.com  # Production
```

---

## 🧪 TESTING

### Test Facebook Login
1. Start dev server: `npm run dev`
2. Go to `http://localhost:3000/login`
3. Click "Facebook" button
4. Should redirect to Facebook → permissions dialog
5. Click "Continue" → Should redirect back to FlowSmartly logged in
6. Check database: User should have `oauthProvider = "facebook"` and `passwordHash = null`

### Test Google Login
1. Go to `http://localhost:3000/login`
2. Click "Google" button
3. Should redirect to Google → account selection
4. Select account → Should redirect back to FlowSmartly logged in
5. Check database: User should have `oauthProvider = "google"` and `passwordHash = null`

### Test OAuth User Can't Use Password Login
1. Create account with Google
2. Log out
3. Try to log in with email/password
4. Should show error: "This account uses social login. Please sign in with Google or Facebook."

---

## 📹 SCREENCAST FOR FACEBOOK APP REVIEW

### Recording Requirements
- Language: English
- UI: English
- Duration: 2-3 minutes
- Add captions/annotations
- Show full flow end-to-end

### Script for Screencast

**Part 1: Facebook OAuth Login (30 seconds)**
1. Open FlowSmartly login page
2. Click "Continue with Facebook"
3. **SHOW:** Facebook permission dialog appears
4. **SHOW:** Permissions requested:
   - Public profile
   - Email address
   - Manage your Pages
   - Publish as Pages you manage
   - Access Page insights
   - Access Instagram account
   - Publish to Instagram
5. Click "Continue"
6. **SHOW:** Select Facebook Pages to connect
7. Click "OK"
8. **SHOW:** Redirected back to FlowSmartly dashboard
9. **CAPTION:** "User successfully logged in with Facebook"

**Part 2: Connect Facebook Page (30 seconds)**
10. Navigate to Settings → Social Accounts
11. **SHOW:** "Facebook Page: [Page Name]" appears as connected ✓
12. **CAPTION:** "Facebook Page connected successfully"

**Part 3: Publish Post to Facebook (60 seconds)**
13. Navigate to Content Studio → Create Post
14. Type post content: "Hello from FlowSmartly! 👋 Testing our social media publishing feature."
15. Upload an image (optional)
16. **SHOW:** Platform selector with Facebook and Instagram checkboxes
17. Check: ☑ Facebook ☑ Instagram
18. Click "Publish Now"
19. **SHOW:** Success message: "Posted to 2 platforms"
20. **CAPTION:** "Publishing to Facebook and Instagram"

**Part 4: Verify Posts Published (60 seconds)**
21. Open new tab → Facebook
22. Navigate to the connected Facebook Page
23. **SHOW:** The post appears in the page timeline
24. **CAPTION:** "Post successfully published to Facebook Page"
25. Open Instagram on phone or desktop
26. Navigate to Instagram Business account
27. **SHOW:** The same post appears in Instagram feed
28. **CAPTION:** "Post successfully published to Instagram"
29. Return to FlowSmartly
30. Navigate to Analytics
31. **SHOW:** Post analytics (impressions, likes, comments)
32. **CAPTION:** "Analytics pulled from Facebook & Instagram using read_insights permission"

---

## 🚀 DEPLOYMENT

### Production Checklist
- [ ] Add production URLs to Facebook App settings
- [ ] Add production URLs to Google OAuth settings
- [ ] Update `.env` with production URLs
- [ ] Run database migration: `npx prisma db push` (on production server)
- [ ] Test OAuth flows on production domain
- [ ] Submit Facebook App Review with screencast
- [ ] Wait for approval (usually 3-7 days)

---

## 🔄 NEXT STEPS: SOCIAL MEDIA POSTING

Once Facebook approves your permissions, implement:

### 1. Social Account Connection (Beyond Login)
- Users can connect multiple Facebook Pages
- Store page tokens in `SocialAccount` table
- List all connected pages in Settings

### 2. Post Publishing API
- Create `/api/social/publish` endpoint
- Accept: content, platforms[], mediaUrls[]
- For each selected platform:
  - Facebook: `POST /{page_id}/feed` with `pages_manage_posts` permission
  - Instagram: `POST /{ig_user_id}/media` → `POST /{ig_user_id}/media_publish`
- Return: published post IDs for tracking

### 3. Analytics Dashboard
- Use `read_insights` permission
- Fetch: impressions, reach, engagement, clicks
- Display in charts/graphs

---

## 📊 PERMISSION USAGE SUMMARY

| Permission | Used For | Required? |
|------------|----------|-----------|
| public_profile | User login (name, profile pic) | ✅ Yes |
| email | User login (email address) | ✅ Yes |
| pages_show_list | List user's Facebook pages | ✅ Yes |
| pages_manage_posts | Publish posts to pages | ✅ Yes |
| pages_read_engagement | Read post likes/comments/shares | ✅ Yes |
| instagram_basic | Access Instagram accounts | ✅ Yes |
| instagram_content_publish | Publish to Instagram | ✅ Yes |
| read_insights | Read page/post analytics | ✅ Yes |

---

## ⚠️ COMMON ISSUES

### Issue: Facebook callback error "Invalid OAuth redirect URI"
**Solution:** Make sure the redirect URI in Facebook App settings exactly matches your callback URL (including http/https).

### Issue: Google login shows "Error 400: redirect_uri_mismatch"
**Solution:** Add the redirect URI to Google Cloud Console → Credentials → OAuth client → Authorized redirect URIs.

### Issue: User created but no avatar/name
**Solution:** Check that Facebook/Google is returning profile data. Log the profile response in callback routes.

### Issue: "This account uses social login" error
**Solution:** This is correct behavior! OAuth users don't have passwords. They must use the OAuth button.

---

## 📞 SUPPORT

If Facebook rejects your App Review:
1. Read the rejection reason carefully
2. Re-record screencast showing the exact flow they requested
3. Add detailed submission notes explaining each permission usage
4. Resubmit

**Common rejection reasons:**
- Screencast doesn't show full OAuth flow
- Permissions not clearly demonstrated
- Missing end-to-end workflow
- No clear benefit to users

---

**✅ YOU'RE ALL SET!**

Once you:
1. Add environment variables
2. Test locally
3. Submit Facebook App Review with screencast
4. Get approved

Your users will be able to:
- ✅ Sign up/login with Facebook or Google
- ✅ Connect Facebook Pages & Instagram accounts
- ✅ Publish posts from FlowSmartly to Facebook & Instagram
- ✅ View analytics from both platforms
