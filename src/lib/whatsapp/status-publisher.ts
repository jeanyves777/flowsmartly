export type WhatsAppStatusAccount = {
  id: string;
  platformUserId: string | null;
  accessToken: string | null;
  platformDisplayName?: string | null;
  platformUsername?: string | null;
};

export type WhatsAppStatusPublishInput = {
  mediaUrl: string | null | undefined;
  mediaType?: string | null;
  caption?: string | null;
};

export type WhatsAppStatusPublishResult = {
  success: boolean;
  postId?: string;
  error?: string;
  details?: unknown;
};

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|avi|mkv)(?:$|\?)/i.test(url) || url.includes("/video/");
}

function inferFileName(mediaUrl: string, mediaType: "image" | "video"): string {
  try {
    const pathname = new URL(mediaUrl).pathname;
    const last = pathname.split("/").filter(Boolean).pop();
    if (last && /\.[a-z0-9]{2,5}$/i.test(last)) return last;
  } catch {
    // Non-URL storage keys are fine; use a generated file name below.
  }
  return mediaType === "video" ? "whatsapp-status.mp4" : "whatsapp-status.jpg";
}

function mimeTypeFor(mediaType: "image" | "video", contentType: string | null): string {
  if (contentType && contentType !== "application/octet-stream") return contentType;
  return mediaType === "video" ? "video/mp4" : "image/jpeg";
}

async function readJson(response: Response): Promise<Record<string, any>> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export function inferWhatsAppStatusMediaType(
  mediaUrl: string | null | undefined,
  mediaType?: string | null
): "image" | "video" {
  const normalized = String(mediaType || "").toLowerCase();
  if (normalized === "video") return "video";
  if (normalized === "image") return "image";
  return mediaUrl && isVideoUrl(mediaUrl) ? "video" : "image";
}

export async function publishWhatsAppStatus(
  account: WhatsAppStatusAccount,
  input: WhatsAppStatusPublishInput
): Promise<WhatsAppStatusPublishResult> {
  const mediaUrl = input.mediaUrl?.trim();
  if (!account.accessToken || !account.platformUserId) {
    return { success: false, error: "Missing WhatsApp credentials. Please reconnect the account." };
  }

  if (!mediaUrl) {
    return { success: false, error: "WhatsApp Status requires an image or video." };
  }

  const mediaType = inferWhatsAppStatusMediaType(mediaUrl, input.mediaType);

  try {
    const mediaResponse = await fetch(mediaUrl);
    if (!mediaResponse.ok) {
      return {
        success: false,
        error: `Could not download status media (${mediaResponse.status}).`,
      };
    }

    const mediaBuffer = await mediaResponse.arrayBuffer();
    const contentType = mimeTypeFor(mediaType, mediaResponse.headers.get("content-type"));
    const mediaBlob = new Blob([mediaBuffer], { type: contentType });
    const formData = new FormData();
    formData.append("file", mediaBlob, inferFileName(mediaUrl, mediaType));
    formData.append("messaging_product", "whatsapp");
    formData.append("type", contentType);

    const uploadResponse = await fetch(
      `https://graph.facebook.com/v21.0/${account.platformUserId}/media`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${account.accessToken}`,
        },
        body: formData,
      }
    );

    const uploadedMedia = await readJson(uploadResponse);
    if (!uploadResponse.ok || !uploadedMedia.id) {
      return {
        success: false,
        error: uploadedMedia.error?.message || "Failed to upload media to WhatsApp.",
        details: uploadedMedia,
      };
    }

    const mediaBody: Record<string, string> = { id: uploadedMedia.id };
    if (input.caption?.trim()) {
      mediaBody.caption = input.caption.trim();
    }

    const statusResponse = await fetch(
      `https://graph.facebook.com/v21.0/${account.platformUserId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${account.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          type: mediaType,
          [mediaType]: mediaBody,
        }),
      }
    );

    const statusData = await readJson(statusResponse);
    const messageId = statusData.messages?.[0]?.id;
    if (!statusResponse.ok || !messageId) {
      return {
        success: false,
        error: statusData.error?.message || "Failed to post to WhatsApp Status.",
        details: statusData,
      };
    }

    return { success: true, postId: messageId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "WhatsApp Status publish failed.",
    };
  }
}
