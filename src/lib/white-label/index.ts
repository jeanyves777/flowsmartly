/**
 * White-Label Configuration Helper
 * Resolves white-label settings based on the current domain
 */

import { prisma } from "@/lib/db/client";

export interface WhiteLabelSettings {
  appName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  customCss: string | null;
  footerText: string | null;
  supportEmail: string | null;
}

const DEFAULT_SETTINGS: WhiteLabelSettings = {
  appName: "FlowSmartly",
  logoUrl: null,
  faviconUrl: null,
  primaryColor: "#f97316",
  secondaryColor: "#0ea5e9",
  accentColor: "#8b5cf6",
  customCss: null,
  footerText: null,
  supportEmail: null,
};

/**
 * Get white-label settings for a given domain
 * Returns default FlowSmartly branding if no white-label config exists
 */
export async function getWhiteLabelSettings(domain?: string): Promise<WhiteLabelSettings> {
  if (!domain) return DEFAULT_SETTINGS;

  try {
    const config = await prisma.whiteLabelConfig.findFirst({
      where: {
        domain,
        isActive: true,
      },
    });

    if (!config) return DEFAULT_SETTINGS;

    return {
      appName: config.appName,
      logoUrl: config.logoUrl,
      faviconUrl: config.faviconUrl,
      primaryColor: config.primaryColor,
      secondaryColor: config.secondaryColor,
      accentColor: config.accentColor,
      customCss: config.customCss,
      footerText: config.footerText,
      supportEmail: config.supportEmail,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
