export interface LogoPreset {
  name: string;
  width: number;
  height: number;
  description: string;
}

export interface LogoStyle {
  id: string;
  label: string;
  description: string;
}

export const LOGO_PRESETS: LogoPreset[] = [
  { name: "Primary Logo", width: 500, height: 500, description: "Main brand logo" },
  { name: "Wide Logo", width: 800, height: 300, description: "Horizontal layout" },
  { name: "Favicon 16", width: 16, height: 16, description: "Browser tab icon" },
  { name: "Favicon 32", width: 32, height: 32, description: "Standard favicon" },
  { name: "Favicon 48", width: 48, height: 48, description: "Large favicon" },
  { name: "App Icon", width: 512, height: 512, description: "Mobile app icon" },
  { name: "Social Profile", width: 400, height: 400, description: "Social media avatar" },
  { name: "Email Signature", width: 200, height: 80, description: "Email footer logo" },
  { name: "Watermark", width: 300, height: 100, description: "Content watermark" },
  { name: "OG Image Logo", width: 1200, height: 630, description: "Link preview / Open Graph" },
];

export const LOGO_STYLES: LogoStyle[] = [
  { id: "wordmark", label: "Wordmark", description: "Text-based logo (Google, Coca-Cola)" },
  { id: "lettermark", label: "Lettermark", description: "Initials-based (IBM, HBO)" },
  { id: "icon", label: "Icon / Symbol", description: "Standalone symbol (Apple, Twitter)" },
  { id: "combination", label: "Combination", description: "Icon + text (Adidas, Burger King)" },
  { id: "emblem", label: "Emblem", description: "Text inside symbol (Starbucks, Harley)" },
  { id: "abstract", label: "Abstract", description: "Abstract geometric mark (Pepsi, Chase)" },
  { id: "mascot", label: "Mascot", description: "Character-based (KFC, Mailchimp)" },
];

// Maps each style to an alternative for concept variation
export const ALTERNATIVE_STYLES: Record<string, string> = {
  combination: "icon",
  wordmark: "lettermark",
  lettermark: "wordmark",
  icon: "abstract",
  emblem: "combination",
  abstract: "icon",
  mascot: "combination",
};
