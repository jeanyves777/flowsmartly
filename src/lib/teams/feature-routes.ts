/**
 * Maps feature permission keys to sidebar routes.
 * Used by delegation mode to filter which menu items a team member can see.
 */
export const FEATURE_TO_ROUTES: Record<string, string[]> = {
  EMAIL_SEND: ["/email-marketing"],
  SMS_SEND: ["/sms-marketing"],
  MMS_SEND: ["/sms-marketing"],
  AI_POST: ["/content/posts", "/content/schedule", "/content/automation", "/content/strategy"],
  AI_CAPTION: ["/content/posts"],
  AI_HASHTAGS: ["/content/posts"],
  AI_IDEAS: ["/content/posts"],
  AI_AUTO: ["/content/automation"],
  AI_BRAND_KIT: ["/settings"],
  AI_VISUAL_DESIGN: ["/studio"],
  AI_MARKETING_IMAGE: ["/studio"],
  AI_LOGO_GENERATION: ["/logo-generator"],
  AI_BG_REMOVE: ["/tools/background-remover"],
  AI_CARTOON_VIDEO: ["/video-studio"],
  AI_CARTOON_CHARACTER_REGEN: ["/video-studio"],
  AI_VIDEO_STUDIO: ["/video-studio"],
  AI_VIDEO_SLIDESHOW: ["/video-studio"],
  AI_CHAT_MESSAGE: ["/flow-ai"],
  AI_CHAT_IMAGE: ["/flow-ai"],
  AI_CHAT_VIDEO: ["/flow-ai"],
  AI_LANDING_PAGE: ["/landing-pages"],
};

export function getAllowedRoutes(permissions: { featureKey: string }[]): string[] {
  const routes = new Set<string>();
  for (const perm of permissions) {
    const featureRoutes = FEATURE_TO_ROUTES[perm.featureKey];
    if (featureRoutes) {
      featureRoutes.forEach((r) => routes.add(r));
    }
  }
  return [...routes];
}
