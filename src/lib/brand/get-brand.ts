import { prisma } from "@/lib/db/client";
import { presignAllUrls } from "@/lib/utils/s3-client";

export interface BrandInfo {
  name: string;
  logo: string | null;
  iconLogo: string | null;
  colors: { primary?: string; secondary?: string; accent?: string } | null;
  fonts: { heading?: string; body?: string } | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  handles: Record<string, string> | null;
}

/**
 * Fetch the user's BrandKit and return a presigned brand info object.
 * Finds default kit first, falls back to any kit.
 */
export async function getUserBrand(userId: string): Promise<BrandInfo | null> {
  let brandKit = await prisma.brandKit.findFirst({
    where: { userId, isDefault: true },
  });

  if (!brandKit) {
    brandKit = await prisma.brandKit.findFirst({
      where: { userId },
    });
  }

  if (!brandKit) return null;

  let brand: BrandInfo = {
    name: brandKit.name,
    logo: brandKit.logo,
    iconLogo: brandKit.iconLogo,
    colors: brandKit.colors ? JSON.parse(brandKit.colors) : null,
    fonts: brandKit.fonts ? JSON.parse(brandKit.fonts) : null,
    email: brandKit.email,
    phone: brandKit.phone,
    website: brandKit.website,
    address: brandKit.address,
    handles: brandKit.handles ? JSON.parse(brandKit.handles) : null,
  };

  brand = await presignAllUrls(brand);
  return brand;
}
