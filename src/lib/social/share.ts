/**
 * Social Media Sharing Utility
 * Uses Web Share API when available, falls back to platform-specific URLs
 */

export interface ShareContent {
  title: string;
  text: string;
  url: string;
  imageUrl?: string;
}

export type SharePlatform = "twitter" | "facebook" | "linkedin" | "whatsapp" | "telegram" | "email" | "native";

/**
 * Check if Web Share API is available
 */
export function canUseNativeShare(): boolean {
  return typeof navigator !== "undefined" && !!navigator.share;
}

/**
 * Share using the native Web Share API
 */
export async function nativeShare(content: ShareContent): Promise<boolean> {
  if (!canUseNativeShare()) return false;
  try {
    await navigator.share({
      title: content.title,
      text: content.text,
      url: content.url,
    });
    return true;
  } catch {
    // User cancelled or error
    return false;
  }
}

/**
 * Get the share URL for a specific platform
 */
export function getShareUrl(platform: SharePlatform, content: ShareContent): string {
  const encodedUrl = encodeURIComponent(content.url);
  const encodedText = encodeURIComponent(content.text);
  const encodedTitle = encodeURIComponent(content.title);

  switch (platform) {
    case "twitter":
      return `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
    case "linkedin":
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
    case "whatsapp":
      return `https://wa.me/?text=${encodedText}%20${encodedUrl}`;
    case "telegram":
      return `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
    case "email":
      return `mailto:?subject=${encodedTitle}&body=${encodedText}%0A%0A${encodedUrl}`;
    default:
      return content.url;
  }
}

/**
 * Open a share dialog for the specified platform
 */
export function shareTo(platform: SharePlatform, content: ShareContent): void {
  if (platform === "native") {
    nativeShare(content);
    return;
  }

  const url = getShareUrl(platform, content);

  if (platform === "email") {
    window.location.href = url;
    return;
  }

  // Open in a centered popup window
  const width = 600;
  const height = 400;
  const left = window.screenX + (window.innerWidth - width) / 2;
  const top = window.screenY + (window.innerHeight - height) / 2;

  window.open(
    url,
    "share-dialog",
    `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`
  );
}

/**
 * Copy a link to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }
}
