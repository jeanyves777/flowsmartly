# Social Media OAuth Setup Guide

Complete setup instructions for all social media platform integrations in FlowSmartly.

---

## ✅ Implemented Platforms

1. **YouTube** (via Google OAuth)
2. **Twitter/X**
3. **LinkedIn**
4. **TikTok**
5. **Facebook Pages**
6. **Instagram Business** (via Facebook)

---

## 🔧 Environment Variables Required

Add these to your `.env` file:

```bash
# Google OAuth (for YouTube + Login)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Twitter/X OAuth 2.0
TWITTER_CLIENT_ID=your_twitter_client_id
TWITTER_CLIENT_SECRET=your_twitter_client_secret

# LinkedIn OAuth 2.0
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret

# TikTok OAuth 2.0
TIKTOK_CLIENT_KEY=your_tiktok_client_key
TIKTOK_CLIENT_SECRET=your_tiktok_client_secret

# Facebook OAuth (Already configured)
FACEBOOK_APP_ID=2014720428980289
FACEBOOK_APP_SECRET=e481af6c90bb69f0eaf21ca32a3310dd

# App URL
NEXT_PUBLIC_APP_URL=https://flowsmartly.com
```

---

## 📋 Platform-Specific Setup

### 1️⃣ **Google / YouTube**

**Create OAuth App:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Go to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Name: **FlowSmartly YouTube Integration**

**Authorized redirect URIs:**
```
https://flowsmartly.com/api/social/youtube/callback
http://localhost:3000/api/social/youtube/callback
https://flowsmartly.com/api/auth/google/callback (for login)
http://localhost:3000/api/auth/google/callback (for login)
```

**Enable APIs:**
- YouTube Data API v3
- Google+ API

**Scopes Requested:**
- `https://www.googleapis.com/auth/youtube`
- `https://www.googleapis.com/auth/youtube.upload`
- `https://www.googleapis.com/auth/youtube.readonly`

---

### 2️⃣ **Twitter / X**

**Create OAuth App:**
1. Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Create a new Project & App
3. Go to App settings → User authentication settings
4. Type of App: **Web App**
5. Enable OAuth 2.0

**App permissions:**
- ✅ Read
- ✅ Write

**Callback URLs:**
```
https://flowsmartly.com/api/social/twitter/callback
http://localhost:3000/api/social/twitter/callback
```

**Website URL:**
```
https://flowsmartly.com
```

**Scopes Requested:**
- `tweet.read`
- `tweet.write`
- `users.read`
- `offline.access`

**Note:** Twitter uses **PKCE** (Proof Key for Code Exchange) for security.

---

### 3️⃣ **LinkedIn**

**Create OAuth App:**
1. Go to [LinkedIn Developers](https://www.linkedin.com/developers/apps)
2. Click **Create app**
3. Fill in app details:
   - **App name:** FlowSmartly
   - **LinkedIn Page:** Your company page (or create one)
   - **App logo:** Upload FlowSmartly logo

**Products to request:**
- ✅ Sign In with LinkedIn using OpenID Connect
- ✅ Share on LinkedIn
- ✅ Marketing Developer Platform (for Company Pages)

**Authorized redirect URLs:**
```
https://flowsmartly.com/api/social/linkedin/callback
http://localhost:3000/api/social/linkedin/callback
```

**Scopes Requested:**
- `openid`
- `profile`
- `email`
- `w_member_social` (for posting)

---

### 4️⃣ **TikTok**

**Create OAuth App:**
1. Go to [TikTok for Developers](https://developers.tiktok.com/)
2. Register as a developer
3. Go to **Manage apps** → **Create an app**
4. Fill in app details:
   - **App name:** FlowSmartly
   - **Category:** Social Media Management

**Products to add:**
- ✅ Login Kit
- ✅ Video Kit
- ✅ Content Posting API

**Redirect URIs:**
```
https://flowsmartly.com/api/social/tiktok/callback
http://localhost:3000/api/social/tiktok/callback
```

**Scopes Requested:**
- `user.info.basic`
- `video.upload`
- `video.publish`

**Note:** TikTok approval can take 1-2 weeks. Apply early!

---

### 5️⃣ **Facebook Pages**

**Already configured!** Using existing Facebook App:
- App ID: `2014720428980289`
- App Secret: `e481af6c90bb69f0eaf21ca32a3310dd`

**Additional Redirect URI needed:**
```
https://flowsmartly.com/api/social/facebook/callback
http://localhost:3000/api/social/facebook/callback
```

**Scopes Requested:**
- `pages_show_list`
- `pages_manage_posts`
- `pages_read_engagement`
- `read_insights`

---

### 6️⃣ **Instagram Business**

**Uses Facebook OAuth** (same as Facebook Pages)

**Additional Redirect URI needed:**
```
https://flowsmartly.com/api/social/instagram/callback
http://localhost:3000/api/social/instagram/callback
```

**Scopes Requested:**
- `instagram_basic`
- `instagram_content_publish`
- `pages_show_list` (needed to get Instagram linked to Page)

**Requirements:**
- User must have a Facebook Page
- Instagram account must be connected to that Page as a Business account
- User must be admin of both the Page and Instagram account

---

## 🚀 Testing the OAuth Flows

### Test Locally:

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Connect each platform:**
   - YouTube: `http://localhost:3000/api/social/youtube/connect`
   - Twitter: `http://localhost:3000/api/social/twitter/connect`
   - LinkedIn: `http://localhost:3000/api/social/linkedin/connect`
   - TikTok: `http://localhost:3000/api/social/tiktok/connect`
   - Facebook: `http://localhost:3000/api/social/facebook/connect`
   - Instagram: `http://localhost:3000/api/social/instagram/connect`

3. **Check results:**
   - Success: Redirects to `/dashboard/social-accounts?success={platform}_connected`
   - Error: Redirects to `/dashboard/social-accounts?error={platform}_connect_failed`

4. **Verify in database:**
   ```sql
   SELECT * FROM SocialAccount ORDER BY connectedAt DESC;
   ```

---

## 🔐 Security Best Practices

### Production Recommendations:

1. **Encrypt tokens in database:**
   ```typescript
   import { encrypt, decrypt } from '@/lib/encryption';

   // Before saving
   accessToken: encrypt(tokenData.access_token)

   // Before using
   const token = decrypt(account.accessToken)
   ```

2. **Implement token refresh:**
   - Check `tokenExpiresAt` before using token
   - Use `refreshToken` to get new access token if expired
   - Update database with new tokens

3. **Rotate OAuth secrets regularly:**
   - Update credentials in `.env`
   - Regenerate secrets in developer portals

4. **Monitor for suspicious activity:**
   - Log all OAuth connections
   - Alert on rapid disconnects/reconnects
   - Track token usage patterns

5. **Revoke access on account deletion:**
   - Call platform revoke endpoints
   - Delete tokens from database

---

## 📊 Database Schema

The `SocialAccount` model stores all connected accounts:

```prisma
model SocialAccount {
  id                  String    @id @default(cuid())
  userId              String
  platform            String    // "youtube", "twitter", "linkedin", "tiktok", "facebook", "instagram"
  platformUserId      String?   // Platform-specific user ID
  platformUsername    String?   // @username or display name
  platformDisplayName String?   // Full name on platform
  platformAvatarUrl   String?   // Profile picture URL
  accessToken         String?   // OAuth access token (encrypted in production)
  refreshToken        String?   // OAuth refresh token (encrypted in production)
  tokenExpiresAt      DateTime? // When access token expires
  scopes              String    @default("[]") // JSON array of granted scopes
  isActive            Boolean   @default(true)
  connectedAt         DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  user                User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, platform])
  @@index([userId])
  @@index([platform])
}
```

---

## 🎯 Next Steps

1. ✅ Add environment variables to `.env`
2. ✅ Create OAuth apps for each platform
3. ✅ Add redirect URIs to each app
4. ✅ Test OAuth flows locally
5. ⏳ Request permissions/scopes (some need approval)
6. ⏳ Build posting UI in `/dashboard/social-accounts`
7. ⏳ Implement scheduling system
8. ⏳ Add analytics/insights fetching

---

## 🆘 Troubleshooting

### "Invalid redirect_uri" error:
- Double-check redirect URI matches exactly (https vs http)
- Ensure trailing slashes match
- Verify app is using correct OAuth app credentials

### "Insufficient permissions" error:
- Request missing scopes in developer portal
- Submit for app review if advanced permissions needed
- Check if user granted all requested permissions

### "Token expired" error:
- Implement token refresh logic
- Use `refreshToken` to get new `accessToken`
- Update database with new token and expiry

### "No {platform} account found" error:
- User doesn't have account on that platform
- For Instagram: User must have Business account linked to FB Page
- For LinkedIn: User must accept Company Page admin invite

---

**🎉 All social media OAuth integrations complete!**

Users can now connect:
- YouTube channels
- Twitter/X profiles
- LinkedIn profiles
- TikTok accounts
- Facebook Pages
- Instagram Business accounts

Ready to schedule and post content across all platforms! 🚀
