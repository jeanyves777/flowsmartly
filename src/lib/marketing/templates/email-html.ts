// ---------------------------------------------------------------------------
// Email HTML Template Builder
// Generates responsive HTML emails with inline styles
// ---------------------------------------------------------------------------

interface EmailSection {
  type: "text" | "heading" | "button" | "divider" | "highlight";
  content: string;
  href?: string;
  align?: "left" | "center" | "right";
}

export interface EmailBrandInfo {
  name?: string;
  logo?: string;
  website?: string;
  email?: string;
  phone?: string;
  address?: string;
  socials?: {
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    facebook?: string;
    youtube?: string;
    tiktok?: string;
  };
}

/**
 * Build a full responsive HTML email from sections.
 * All styles are inline for maximum email client compatibility.
 */
export function buildEmailHtml(
  sections: EmailSection[],
  options?: {
    brandColor?: string;
    footerText?: string;
    brand?: EmailBrandInfo;
  }
): string {
  const brandColor = options?.brandColor || "#6366f1";
  const brand = options?.brand;
  const footerText =
    options?.footerText ||
    "You received this email because you are a valued customer. {{unsubscribeLink}}";

  const sectionHtml = sections
    .map((s) => {
      switch (s.type) {
        case "heading":
          return `<h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 700; color: #111827; line-height: 1.3;">${s.content}</h1>`;
        case "text":
          return `<p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #374151;">${s.content}</p>`;
        case "button":
          return `<table role="presentation" style="margin: 24px 0; border-collapse: collapse;"><tr><td style="border-radius: 8px; background-color: ${brandColor};"><a href="${s.href || "#"}" style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">${s.content}</a></td></tr></table>`;
        case "divider":
          return `<hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;">`;
        case "highlight":
          return `<div style="margin: 16px 0; padding: 16px 20px; background-color: #f3f4f6; border-radius: 8px; border-left: 4px solid ${brandColor};"><p style="margin: 0; font-size: 15px; line-height: 1.5; color: #374151;">${s.content}</p></div>`;
        default:
          return "";
      }
    })
    .join("\n              ");

  // Brand header (logo + name)
  let headerHtml = "";
  if (brand?.name || brand?.logo) {
    const logoHtml = brand.logo
      ? `<img src="${brand.logo}" alt="${brand.name || ""}" style="max-height: 48px; max-width: 200px; display: block; margin: 0 auto 8px;" />`
      : "";
    const nameHtml = brand.name
      ? `<p style="margin: 0; font-size: 18px; font-weight: 700; color: ${brandColor}; text-align: center;">${brand.name}</p>`
      : "";
    headerHtml = `
          <tr>
            <td style="padding: 24px 40px 0; text-align: center;">
              ${logoHtml}
              ${nameHtml}
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 40px 0;">
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0;" />
            </td>
          </tr>`;
  }

  // Social links
  let socialHtml = "";
  if (brand?.socials) {
    const links: string[] = [];
    const s = brand.socials;
    if (s.instagram) links.push(`<a href="https://instagram.com/${s.instagram}" style="color: ${brandColor}; text-decoration: none; margin: 0 6px;">Instagram</a>`);
    if (s.twitter) links.push(`<a href="https://twitter.com/${s.twitter}" style="color: ${brandColor}; text-decoration: none; margin: 0 6px;">Twitter</a>`);
    if (s.facebook) links.push(`<a href="https://facebook.com/${s.facebook}" style="color: ${brandColor}; text-decoration: none; margin: 0 6px;">Facebook</a>`);
    if (s.linkedin) links.push(`<a href="https://linkedin.com/in/${s.linkedin}" style="color: ${brandColor}; text-decoration: none; margin: 0 6px;">LinkedIn</a>`);
    if (s.youtube) links.push(`<a href="https://youtube.com/${s.youtube}" style="color: ${brandColor}; text-decoration: none; margin: 0 6px;">YouTube</a>`);
    if (s.tiktok) links.push(`<a href="https://tiktok.com/@${s.tiktok}" style="color: ${brandColor}; text-decoration: none; margin: 0 6px;">TikTok</a>`);
    if (links.length > 0) {
      socialHtml = `<p style="margin: 0 0 8px; font-size: 12px; text-align: center;">${links.join(" &middot; ")}</p>`;
    }
  }

  // Contact info line
  let contactHtml = "";
  if (brand) {
    const parts: string[] = [];
    if (brand.website) parts.push(`<a href="${brand.website}" style="color: ${brandColor}; text-decoration: none;">${brand.website.replace(/^https?:\/\//, "")}</a>`);
    if (brand.email) parts.push(brand.email);
    if (brand.phone) parts.push(brand.phone);
    if (parts.length > 0) {
      contactHtml = `<p style="margin: 0 0 8px; font-size: 11px; line-height: 1.5; color: #9ca3af; text-align: center;">${parts.join(" &middot; ")}</p>`;
    }
  }

  // Address
  const addressHtml = brand?.address
    ? `<p style="margin: 0 0 8px; font-size: 11px; color: #9ca3af; text-align: center;">${brand.address}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">${headerHtml}
          <tr>
            <td style="padding: 40px;">
              ${sectionHtml}
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px; background-color: #f9fafb; border-radius: 0 0 12px 12px;">
              ${socialHtml}
              ${contactHtml}
              ${addressHtml}
              <p style="margin: 0; font-size: 11px; line-height: 1.5; color: #9ca3af; text-align: center;">${footerText}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
