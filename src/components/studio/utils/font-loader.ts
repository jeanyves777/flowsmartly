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

export const POPULAR_FONTS = [
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Oswald",
  "Playfair Display",
  "Raleway",
  "Nunito",
  "Ubuntu",
  "Merriweather",
  "PT Sans",
  "Lora",
  "Quicksand",
  "Rubik",
  "Work Sans",
  "DM Sans",
  "Source Sans 3",
  "Barlow",
  "Bebas Neue",
  "Lobster",
  "Pacifico",
  "Dancing Script",
  "Permanent Marker",
  "Anton",
  "Righteous",
  "Alfa Slab One",
  "Bangers",
  "Bungee",
  "Caveat",
  "Comfortaa",
  "Crimson Text",
  "Fira Sans",
  "Josefin Sans",
  "Karla",
  "Noto Sans",
  "PT Serif",
  "Roboto Condensed",
  "Roboto Slab",
];

// Load default fonts on init
export function loadDefaultFonts() {
  const defaults = ["Inter", "Roboto", "Open Sans", "Montserrat", "Poppins"];
  defaults.forEach(loadGoogleFont);
}
