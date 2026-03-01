import { prisma } from "@/lib/db/client";

/**
 * Social Media Publisher
 * Publishes posts to all connected external platforms
 */

interface PostData {
  id: string;
  caption: string | null;
  mediaUrls: string[];
  mediaType: string | null;
  platforms: string[];
}

interface PublishResult {
  success: boolean;
  postId?: string;
  error?: string;
}

type PlatformResults = Record<string, PublishResult>;

type SocialAccount = {
  id: string;
  platform: string;
  platformUserId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
  platformDisplayName: string | null;
  platformUsername: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|avi|mkv)/i.test(url);
}

function hasVideo(post: PostData): boolean {
  return (
    post.mediaType === "video" || post.mediaUrls.some((u) => isVideoUrl(u))
  );
}

/** Refresh an OAuth token and update the DB. Returns new access token or null. */
async function refreshOAuthToken(
  account: SocialAccount,
  tokenUrl: string,
  params: Record<string, string>
): Promise<string | null> {
  if (!account.refreshToken) return null;

  try {
    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params),
    });

    const data = await res.json();
    const newToken = data.access_token;
    if (!newToken) return null;

    const expiresAt = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : null;

    await prisma.socialAccount.update({
      where: { id: account.id },
      data: { accessToken: newToken, tokenExpiresAt: expiresAt },
    });

    return newToken;
  } catch (err) {
    console.error(`[Publisher] Token refresh failed for ${account.platform}:`, err);
    return null;
  }
}

/** Get a valid access token, refreshing if needed. */
async function getValidToken(
  account: SocialAccount,
  platform: string
): Promise<string | null> {
  let token = account.accessToken;

  // Check if token is expired or about to expire (within 60s)
  const isExpired =
    account.tokenExpiresAt &&
    new Date(account.tokenExpiresAt).getTime() < Date.now() + 60000;

  if (isExpired && account.refreshToken) {
    let refreshed: string | null = null;

    if (platform === "youtube") {
      refreshed = await refreshOAuthToken(account, "https://oauth2.googleapis.com/token", {
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: account.refreshToken,
        grant_type: "refresh_token",
      });
    } else if (platform === "twitter") {
      refreshed = await refreshOAuthToken(account, "https://api.twitter.com/2/oauth2/token", {
        client_id: process.env.TWITTER_CLIENT_ID!,
        refresh_token: account.refreshToken,
        grant_type: "refresh_token",
      });
    } else if (platform === "linkedin") {
      refreshed = await refreshOAuthToken(account, "https://www.linkedin.com/oauth/v2/accessToken", {
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
        refresh_token: account.refreshToken,
        grant_type: "refresh_token",
      });
    } else if (platform === "tiktok") {
      refreshed = await refreshOAuthToken(account, "https://open.tiktokapis.com/v2/oauth/token/", {
        client_key: process.env.TIKTOK_CLIENT_KEY!,
        client_secret: process.env.TIKTOK_CLIENT_SECRET!,
        refresh_token: account.refreshToken,
        grant_type: "refresh_token",
      });
    }

    if (refreshed) {
      token = refreshed;
    } else {
      return null;
    }
  }

  return token;
}

// ─── Facebook Page Publishing ─────────────────────────────────────────

async function publishToFacebook(
  post: PostData,
  account: SocialAccount
): Promise<PublishResult> {
  const pageId = account.platformUserId;
  const token = account.accessToken;

  if (!pageId || !token) {
    return { success: false, error: "Missing page ID or access token" };
  }

  try {
    const hasMedia = post.mediaUrls.length > 0;
    const isVideo = hasVideo(post);

    if (!hasMedia) {
      // Text-only post
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${pageId}/feed`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: post.caption || "",
            access_token: token,
          }),
        }
      );
      const data = await res.json();
      if (data.error) return { success: false, error: data.error.message };
      return { success: true, postId: data.id };
    }

    if (isVideo) {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${pageId}/videos`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file_url: post.mediaUrls[0],
            description: post.caption || "",
            access_token: token,
          }),
        }
      );
      const data = await res.json();
      if (data.error) return { success: false, error: data.error.message };
      return { success: true, postId: data.id };
    }

    if (post.mediaUrls.length === 1) {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${pageId}/photos`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: post.mediaUrls[0],
            caption: post.caption || "",
            access_token: token,
          }),
        }
      );
      const data = await res.json();
      if (data.error) return { success: false, error: data.error.message };
      return { success: true, postId: data.id || data.post_id };
    }

    // Multiple photos — upload unpublished, then multi-photo post
    const photoIds: string[] = [];
    for (const url of post.mediaUrls) {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${pageId}/photos`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, published: false, access_token: token }),
        }
      );
      const data = await res.json();
      if (data.id) photoIds.push(data.id);
    }

    if (photoIds.length === 0) {
      return { success: false, error: "Failed to upload any photos" };
    }

    const feedRes = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}/feed`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: post.caption || "",
          attached_media: photoIds.map((id) => ({ media_fbid: id })),
          access_token: token,
        }),
      }
    );
    const feedData = await feedRes.json();
    if (feedData.error) return { success: false, error: feedData.error.message };
    return { success: true, postId: feedData.id };
  } catch (err: any) {
    return { success: false, error: err.message || "Facebook publish failed" };
  }
}

// ─── Instagram Publishing ─────────────────────────────────────────────

async function publishToInstagram(
  post: PostData,
  account: SocialAccount
): Promise<PublishResult> {
  const igUserId = account.platformUserId;
  const token = account.accessToken;

  if (!igUserId || !token) {
    return { success: false, error: "Missing Instagram user ID or access token" };
  }

  if (post.mediaUrls.length === 0) {
    return { success: false, error: "Instagram requires at least one image or video" };
  }

  try {
    const isVideo = hasVideo(post);

    if (post.mediaUrls.length === 1 && !isVideo) {
      // Single image
      const createRes = await fetch(
        `https://graph.facebook.com/v21.0/${igUserId}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_url: post.mediaUrls[0],
            caption: post.caption || "",
            access_token: token,
          }),
        }
      );
      const createData = await createRes.json();
      if (createData.error) return { success: false, error: createData.error.message };

      const publishRes = await fetch(
        `https://graph.facebook.com/v21.0/${igUserId}/media_publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ creation_id: createData.id, access_token: token }),
        }
      );
      const publishData = await publishRes.json();
      if (publishData.error) return { success: false, error: publishData.error.message };
      return { success: true, postId: publishData.id };
    }

    if (isVideo) {
      // Reel
      const createRes = await fetch(
        `https://graph.facebook.com/v21.0/${igUserId}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            video_url: post.mediaUrls[0],
            caption: post.caption || "",
            media_type: "REELS",
            access_token: token,
          }),
        }
      );
      const createData = await createRes.json();
      if (createData.error) return { success: false, error: createData.error.message };

      // Poll for processing (up to 60s)
      const containerId = createData.id;
      let status = "IN_PROGRESS";
      for (let i = 0; i < 12; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        const statusRes = await fetch(
          `https://graph.facebook.com/v21.0/${containerId}?fields=status_code&access_token=${token}`
        );
        const statusData = await statusRes.json();
        status = statusData.status_code;
        if (status === "FINISHED") break;
        if (status === "ERROR") return { success: false, error: "Instagram video processing failed" };
      }
      if (status !== "FINISHED") return { success: false, error: "Instagram video processing timed out" };

      const publishRes = await fetch(
        `https://graph.facebook.com/v21.0/${igUserId}/media_publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ creation_id: containerId, access_token: token }),
        }
      );
      const publishData = await publishRes.json();
      if (publishData.error) return { success: false, error: publishData.error.message };
      return { success: true, postId: publishData.id };
    }

    // Carousel (multiple images)
    const childIds: string[] = [];
    for (const url of post.mediaUrls.slice(0, 10)) {
      const childRes = await fetch(
        `https://graph.facebook.com/v21.0/${igUserId}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_url: url, is_carousel_item: true, access_token: token }),
        }
      );
      const childData = await childRes.json();
      if (childData.id) childIds.push(childData.id);
    }

    if (childIds.length === 0) return { success: false, error: "Failed to create carousel items" };

    const carouselRes = await fetch(
      `https://graph.facebook.com/v21.0/${igUserId}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_type: "CAROUSEL",
          children: childIds,
          caption: post.caption || "",
          access_token: token,
        }),
      }
    );
    const carouselData = await carouselRes.json();
    if (carouselData.error) return { success: false, error: carouselData.error.message };

    const publishRes = await fetch(
      `https://graph.facebook.com/v21.0/${igUserId}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creation_id: carouselData.id, access_token: token }),
      }
    );
    const publishData = await publishRes.json();
    if (publishData.error) return { success: false, error: publishData.error.message };
    return { success: true, postId: publishData.id };
  } catch (err: any) {
    return { success: false, error: err.message || "Instagram publish failed" };
  }
}

// ─── YouTube Publishing ───────────────────────────────────────────────

async function publishToYouTube(
  post: PostData,
  account: SocialAccount
): Promise<PublishResult> {
  if (post.mediaUrls.length === 0 || !hasVideo(post)) {
    return { success: false, error: "YouTube requires a video file" };
  }

  const token = await getValidToken(account, "youtube");
  if (!token) {
    return { success: false, error: "Missing or expired YouTube token. Please reconnect." };
  }

  try {
    const videoUrl = post.mediaUrls.find((u) => isVideoUrl(u))!;

    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) return { success: false, error: "Failed to download video file" };
    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

    const captionText = post.caption || "Untitled";
    const title = captionText.split("\n")[0].slice(0, 100) || "Untitled";

    // Initiate resumable upload
    const initRes = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Upload-Content-Type": "video/*",
          "X-Upload-Content-Length": videoBuffer.length.toString(),
        },
        body: JSON.stringify({
          snippet: { title, description: captionText, categoryId: "22" },
          status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
        }),
      }
    );

    if (!initRes.ok) {
      const errData = await initRes.json().catch(() => ({}));
      return { success: false, error: errData.error?.message || `YouTube upload init failed (${initRes.status})` };
    }

    const uploadUrl = initRes.headers.get("location");
    if (!uploadUrl) return { success: false, error: "YouTube did not return upload URL" };

    // Upload video data
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "video/*", "Content-Length": videoBuffer.length.toString() },
      body: videoBuffer,
    });

    if (!uploadRes.ok) {
      const errData = await uploadRes.json().catch(() => ({}));
      return { success: false, error: errData.error?.message || `YouTube upload failed (${uploadRes.status})` };
    }

    const uploadData = await uploadRes.json();
    return { success: true, postId: uploadData.id };
  } catch (err: any) {
    return { success: false, error: err.message || "YouTube publish failed" };
  }
}

// ─── Twitter/X Publishing ─────────────────────────────────────────────

async function publishToTwitter(
  post: PostData,
  account: SocialAccount
): Promise<PublishResult> {
  const token = await getValidToken(account, "twitter");
  if (!token) {
    return { success: false, error: "Missing or expired Twitter token. Please reconnect." };
  }

  try {
    const tweetBody: Record<string, any> = {
      text: post.caption || "",
    };

    // Upload media if present
    if (post.mediaUrls.length > 0) {
      const mediaIds: string[] = [];

      for (const url of post.mediaUrls.slice(0, 4)) {
        // Download media
        const mediaResponse = await fetch(url);
        if (!mediaResponse.ok) continue;
        const mediaBuffer = Buffer.from(await mediaResponse.arrayBuffer());
        const mimeType = isVideoUrl(url) ? "video/mp4" : "image/jpeg";

        // Twitter media upload (v1.1 supports OAuth2 Bearer tokens)
        // INIT
        const initRes = await fetch("https://upload.twitter.com/1.1/media/upload.json", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            command: "INIT",
            total_bytes: mediaBuffer.length.toString(),
            media_type: mimeType,
          }),
        });
        const initData = await initRes.json();
        if (!initData.media_id_string) continue;

        const mediaId = initData.media_id_string;

        // APPEND (send in chunks of 5MB)
        const chunkSize = 5 * 1024 * 1024;
        for (let i = 0; i < mediaBuffer.length; i += chunkSize) {
          const chunk = mediaBuffer.subarray(i, Math.min(i + chunkSize, mediaBuffer.length));
          const formData = new FormData();
          formData.append("command", "APPEND");
          formData.append("media_id", mediaId);
          formData.append("segment_index", String(Math.floor(i / chunkSize)));
          formData.append("media_data", chunk.toString("base64"));

          await fetch("https://upload.twitter.com/1.1/media/upload.json", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          });
        }

        // FINALIZE
        const finalRes = await fetch("https://upload.twitter.com/1.1/media/upload.json", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            command: "FINALIZE",
            media_id: mediaId,
          }),
        });
        const finalData = await finalRes.json();

        // If video, wait for processing
        if (finalData.processing_info) {
          let state = finalData.processing_info.state;
          while (state === "pending" || state === "in_progress") {
            const wait = (finalData.processing_info.check_after_secs || 5) * 1000;
            await new Promise((r) => setTimeout(r, wait));
            const statusRes = await fetch(
              `https://upload.twitter.com/1.1/media/upload.json?command=STATUS&media_id=${mediaId}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            const statusData = await statusRes.json();
            state = statusData.processing_info?.state || "succeeded";
          }
        }

        mediaIds.push(mediaId);
      }

      if (mediaIds.length > 0) {
        tweetBody.media = { media_ids: mediaIds };
      }
    }

    // Create tweet
    const res = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(tweetBody),
    });

    const data = await res.json();
    if (data.errors || data.detail) {
      return { success: false, error: data.errors?.[0]?.message || data.detail || "Tweet failed" };
    }
    return { success: true, postId: data.data?.id };
  } catch (err: any) {
    return { success: false, error: err.message || "Twitter publish failed" };
  }
}

// ─── LinkedIn Publishing ──────────────────────────────────────────────

async function publishToLinkedIn(
  post: PostData,
  account: SocialAccount
): Promise<PublishResult> {
  const token = await getValidToken(account, "linkedin");
  if (!token) {
    return { success: false, error: "Missing or expired LinkedIn token. Please reconnect." };
  }

  const personUrn = `urn:li:person:${account.platformUserId}`;

  try {
    const hasMedia = post.mediaUrls.length > 0;

    if (!hasMedia) {
      // Text-only post
      const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Restli-Protocol-Version": "2.0.0",
        },
        body: JSON.stringify({
          author: personUrn,
          lifecycleState: "PUBLISHED",
          specificContent: {
            "com.linkedin.ugc.ShareContent": {
              shareCommentary: { text: post.caption || "" },
              shareMediaCategory: "NONE",
            },
          },
          visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
        }),
      });
      const data = await res.json();
      if (data.status && data.status >= 400) {
        return { success: false, error: data.message || "LinkedIn post failed" };
      }
      return { success: true, postId: data.id };
    }

    // Post with media — register upload, upload binary, create post
    const isVideo = hasVideo(post);
    const mediaUrl = post.mediaUrls[0];

    // Step 1: Register upload
    const registerRes = await fetch(
      "https://api.linkedin.com/v2/assets?action=registerUpload",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          registerUploadRequest: {
            recipes: [
              isVideo
                ? "urn:li:digitalmediaRecipe:feedshare-video"
                : "urn:li:digitalmediaRecipe:feedshare-image",
            ],
            owner: personUrn,
            serviceRelationships: [
              {
                relationshipType: "OWNER",
                identifier: "urn:li:userGeneratedContent",
              },
            ],
          },
        }),
      }
    );
    const registerData = await registerRes.json();
    const asset = registerData.value?.asset;
    const uploadUrl =
      registerData.value?.uploadMechanism?.[
        "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
      ]?.uploadUrl;

    if (!asset || !uploadUrl) {
      return { success: false, error: "LinkedIn media registration failed" };
    }

    // Step 2: Upload binary
    const mediaResponse = await fetch(mediaUrl);
    if (!mediaResponse.ok) return { success: false, error: "Failed to download media" };
    const mediaBuffer = Buffer.from(await mediaResponse.arrayBuffer());

    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": isVideo ? "video/mp4" : "image/jpeg",
      },
      body: mediaBuffer,
    });

    if (!uploadRes.ok) {
      return { success: false, error: `LinkedIn media upload failed (${uploadRes.status})` };
    }

    // Step 3: Create post with media
    const shareRes = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        author: personUrn,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text: post.caption || "" },
            shareMediaCategory: isVideo ? "VIDEO" : "IMAGE",
            media: [
              {
                status: "READY",
                media: asset,
                ...(post.caption ? { description: { text: post.caption } } : {}),
              },
            ],
          },
        },
        visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
      }),
    });

    const shareData = await shareRes.json();
    if (shareData.status && shareData.status >= 400) {
      return { success: false, error: shareData.message || "LinkedIn post with media failed" };
    }
    return { success: true, postId: shareData.id };
  } catch (err: any) {
    return { success: false, error: err.message || "LinkedIn publish failed" };
  }
}

// ─── TikTok Publishing ───────────────────────────────────────────────

async function publishToTikTok(
  post: PostData,
  account: SocialAccount
): Promise<PublishResult> {
  const token = await getValidToken(account, "tiktok");
  if (!token) {
    return { success: false, error: "Missing or expired TikTok token. Please reconnect." };
  }

  if (!hasVideo(post)) {
    return { success: false, error: "TikTok requires a video file" };
  }

  try {
    const videoUrl = post.mediaUrls.find((u) => isVideoUrl(u))!;

    // TikTok Content Posting API: publish by URL
    const res = await fetch(
      "https://open.tiktokapis.com/v2/post/publish/video/init/",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          post_info: {
            title: (post.caption || "").slice(0, 150),
            privacy_level: "PUBLIC_TO_EVERYONE",
            disable_duet: false,
            disable_comment: false,
            disable_stitch: false,
          },
          source_info: {
            source: "PULL_FROM_URL",
            video_url: videoUrl,
          },
        }),
      }
    );

    const data = await res.json();
    if (data.error?.code !== "ok" && data.error?.code) {
      return { success: false, error: data.error.message || `TikTok error: ${data.error.code}` };
    }
    return { success: true, postId: data.data?.publish_id };
  } catch (err: any) {
    return { success: false, error: err.message || "TikTok publish failed" };
  }
}

// ─── Threads Publishing ───────────────────────────────────────────────

async function publishToThreads(
  post: PostData,
  account: SocialAccount
): Promise<PublishResult> {
  const token = account.accessToken;
  const threadsUserId = account.platformUserId;

  if (!token || !threadsUserId) {
    return { success: false, error: "Missing Threads credentials. Please reconnect." };
  }

  try {
    const hasMedia = post.mediaUrls.length > 0;
    const isVideo = hasVideo(post);

    // Step 1: Create media container
    const createBody: Record<string, any> = {
      text: post.caption || "",
      access_token: token,
    };

    if (hasMedia && isVideo) {
      createBody.media_type = "VIDEO";
      createBody.video_url = post.mediaUrls[0];
    } else if (hasMedia) {
      createBody.media_type = "IMAGE";
      createBody.image_url = post.mediaUrls[0];
    } else {
      createBody.media_type = "TEXT";
    }

    const createRes = await fetch(
      `https://graph.threads.net/v1.0/${threadsUserId}/threads`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createBody),
      }
    );
    const createData = await createRes.json();
    if (createData.error) return { success: false, error: createData.error.message };

    // Step 2: Publish
    const publishRes = await fetch(
      `https://graph.threads.net/v1.0/${threadsUserId}/threads_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: createData.id,
          access_token: token,
        }),
      }
    );
    const publishData = await publishRes.json();
    if (publishData.error) return { success: false, error: publishData.error.message };
    return { success: true, postId: publishData.id };
  } catch (err: any) {
    return { success: false, error: err.message || "Threads publish failed" };
  }
}

// ─── Pinterest Publishing ─────────────────────────────────────────────

async function publishToPinterest(
  post: PostData,
  account: SocialAccount
): Promise<PublishResult> {
  const token = account.accessToken;

  if (!token) {
    return { success: false, error: "Missing Pinterest token. Please reconnect." };
  }

  if (post.mediaUrls.length === 0) {
    return { success: false, error: "Pinterest requires an image" };
  }

  try {
    // Create a pin (image only — Pinterest doesn't support text-only pins)
    const res = await fetch("https://api.pinterest.com/v5/pins", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: (post.caption || "").split("\n")[0].slice(0, 100) || "Pin",
        description: post.caption || "",
        media_source: {
          source_type: "image_url",
          url: post.mediaUrls[0],
        },
      }),
    });

    const data = await res.json();
    if (data.code || data.message) {
      return { success: false, error: data.message || "Pinterest pin creation failed" };
    }
    return { success: true, postId: data.id };
  } catch (err: any) {
    return { success: false, error: err.message || "Pinterest publish failed" };
  }
}

// ─── Main Dispatcher ──────────────────────────────────────────────────

/**
 * Publish a post to all selected external platforms.
 * "feed" is internal (FlowSmartly's own feed) and always skipped.
 */
export async function publishToSocialPlatforms(
  postId: string,
  userId: string,
  onlyPlatforms?: string[]
): Promise<PlatformResults> {
  const results: PlatformResults = {};

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      caption: true,
      mediaUrl: true,
      mediaMeta: true,
      mediaType: true,
      platforms: true,
    },
  });

  if (!post) {
    return { _error: { success: false, error: "Post not found" } };
  }

  let platforms: string[] = [];
  try {
    platforms = JSON.parse(post.platforms || "[]");
  } catch {
    platforms = [];
  }

  let mediaUrls: string[] = [];
  try {
    mediaUrls = post.mediaMeta ? JSON.parse(post.mediaMeta) : [];
  } catch {
    mediaUrls = post.mediaUrl ? [post.mediaUrl] : [];
  }

  const postData: PostData = {
    id: post.id,
    caption: post.caption,
    mediaUrls,
    mediaType: post.mediaType,
    platforms,
  };

  // "feed" is internal — skip it; optionally filter to specific platforms (for retry)
  let externalPlatforms = platforms.filter((p) => p !== "feed");
  if (onlyPlatforms && onlyPlatforms.length > 0) {
    externalPlatforms = externalPlatforms.filter((p) => onlyPlatforms.includes(p));
  }

  if (externalPlatforms.length === 0) {
    console.log("[Publisher] No external platforms selected for post", postId);
    return results;
  }

  // Load user's connected accounts
  const accounts = await prisma.socialAccount.findMany({
    where: { userId, isActive: true },
  });

  for (const platform of externalPlatforms) {
    try {
      let account: SocialAccount | undefined;

      // Find matching account (facebook/instagram use prefixed platform names)
      if (platform === "facebook") {
        account = accounts.find((a) => a.platform.startsWith("facebook"));
      } else if (platform === "instagram") {
        account = accounts.find((a) => a.platform.startsWith("instagram"));
      } else {
        account = accounts.find((a) => a.platform === platform);
      }

      if (!account) {
        results[platform] = { success: false, error: `No ${platform} account connected` };
        continue;
      }

      console.log(`[Publisher] Publishing to ${platform}:`, account.platformDisplayName || account.platformUsername);

      switch (platform) {
        case "facebook":
          results.facebook = await publishToFacebook(postData, account);
          break;
        case "instagram":
          results.instagram = await publishToInstagram(postData, account);
          break;
        case "youtube":
          results.youtube = await publishToYouTube(postData, account);
          break;
        case "twitter":
          results.twitter = await publishToTwitter(postData, account);
          break;
        case "linkedin":
          results.linkedin = await publishToLinkedIn(postData, account);
          break;
        case "tiktok":
          results.tiktok = await publishToTikTok(postData, account);
          break;
        case "threads":
          results.threads = await publishToThreads(postData, account);
          break;
        case "pinterest":
          results.pinterest = await publishToPinterest(postData, account);
          break;
        default:
          results[platform] = { success: false, error: `Unsupported platform: ${platform}` };
      }
    } catch (err: any) {
      results[platform] = { success: false, error: err.message || "Unexpected error" };
    }
  }

  // Save results to DB (merge with existing results for retry)
  try {
    let mergedResults = results;
    if (onlyPlatforms) {
      const existing = await prisma.post.findUnique({ where: { id: postId }, select: { publishResults: true } });
      if (existing?.publishResults) {
        try {
          const prev = JSON.parse(existing.publishResults);
          mergedResults = { ...prev, ...results };
        } catch { /* ignore parse error */ }
      }
    }
    await prisma.post.update({
      where: { id: postId },
      data: { publishResults: JSON.stringify(mergedResults) },
    });
  } catch (err) {
    console.error("[Publisher] Failed to save publish results:", err);
  }

  console.log("[Publisher] Publish results for post", postId, ":", results);
  return results;
}
