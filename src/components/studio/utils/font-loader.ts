const loadedFonts = new Set<string>();

export async function loadGoogleFont(fontFamily: string): Promise<void> {
  if (loadedFonts.has(fontFamily)) return;

  const link = document.createElement("link");
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@300;400;500;600;700;800;900&display=swap`;
  link.rel = "stylesheet";
  document.head.appendChild(link);

  try {
    await document.fonts.load(`16px "${fontFamily}"`);
    loadedFonts.add(fontFamily);
  } catch {
    // Font might still load later, mark as loaded to avoid retry
    loadedFonts.add(fontFamily);
  }
}

export function isFontLoaded(fontFamily: string): boolean {
  return loadedFonts.has(fontFamily);
}

// Fonts grouped by category so the picker can render headers + previews.
// All come from Google Fonts (free for commercial use).
export const FONT_CATEGORIES: Array<{ label: string; fonts: string[] }> = [
  {
    label: "Sans Serif",
    fonts: [
      "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins",
      "Raleway", "Nunito", "Ubuntu", "PT Sans", "Quicksand", "Rubik",
      "Work Sans", "DM Sans", "Source Sans 3", "Barlow", "Comfortaa",
      "Fira Sans", "Josefin Sans", "Karla", "Noto Sans", "Roboto Condensed",
    ],
  },
  {
    label: "Serif",
    fonts: [
      "Playfair Display", "Merriweather", "Lora", "Crimson Text",
      "PT Serif", "Roboto Slab", "Cormorant Garamond", "EB Garamond",
      "Libre Baskerville", "Cardo", "Spectral", "Bitter",
    ],
  },
  {
    label: "Display / Bold",
    fonts: [
      "Bebas Neue", "Anton", "Oswald", "Righteous", "Alfa Slab One",
      "Bangers", "Bungee", "Black Ops One", "Russo One", "Archivo Black",
      "Fjalla One", "Staatliches",
    ],
  },
  {
    label: "Script / Handwriting",
    fonts: [
      "Dancing Script", "Pacifico", "Lobster", "Caveat", "Permanent Marker",
      "Great Vibes", "Allura", "Sacramento", "Satisfy", "Kaushan Script",
      "Parisienne", "Cookie", "Yellowtail", "Tangerine", "Pinyon Script",
      "Alex Brush", "Engagement", "Marck Script", "Pacifico", "Homemade Apple",
    ],
  },
  {
    label: "Calligraphy",
    fonts: [
      "Great Vibes", "Pinyon Script", "Allura", "Tangerine", "Italianno",
      "Parisienne", "Cinzel", "Cinzel Decorative", "UnifrakturMaguntia",
      "Lavishly Yours", "Berkshire Swash",
    ],
  },
  {
    label: "Mono",
    fonts: [
      "JetBrains Mono", "Fira Code", "Source Code Pro", "Roboto Mono",
      "Space Mono", "IBM Plex Mono",
    ],
  },
];

export const POPULAR_FONTS: string[] = Array.from(
  new Set(FONT_CATEGORIES.flatMap((c) => c.fonts)),
);

/** Lookup: which category a font belongs to (first match wins). */
export function getFontCategory(font: string): string | null {
  for (const cat of FONT_CATEGORIES) {
    if (cat.fonts.includes(font)) return cat.label;
  }
  return null;
}

// Load default fonts on init
export function loadDefaultFonts() {
  const defaults = ["Inter", "Roboto", "Open Sans", "Montserrat", "Poppins"];
  defaults.forEach(loadGoogleFont);
}
