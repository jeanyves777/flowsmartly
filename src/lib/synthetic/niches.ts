/**
 * Business niches for synthetic personas. Each persona is assigned one niche so
 * their bio, posts and comments read on-brand for a believable small-business
 * owner / creator in that vertical.
 *
 * `mediaKeywords` drive the free image pool (Unsplash Source / Picsum seeds).
 * `topics` / `hashtags` feed the combinatorial caption + comment generators.
 */

export interface NicheDef {
  key: string;
  label: string;
  /** Search keywords for the free media pool (license-free stock). */
  mediaKeywords: string[];
  /** Short post-topic fragments used to build captions. */
  topics: string[];
  hashtags: string[];
  /** Words that flavour generated comments ("love this {noun}"). */
  nouns: string[];
}

export const NICHES: NicheDef[] = [
  {
    key: "fitness",
    label: "Fitness & Coaching",
    mediaKeywords: ["fitness", "gym", "workout", "running", "yoga"],
    topics: [
      "Morning workout done — small wins add up",
      "New 6-week strength program is live",
      "Recovery days matter as much as training days",
      "Form check Friday — quality over reps every time",
      "Fueling right is half the battle",
    ],
    hashtags: ["fitfam", "training", "wellness", "nopainnogain", "coaching"],
    nouns: ["routine", "progress", "energy", "transformation", "mindset"],
  },
  {
    key: "food",
    label: "Food & Restaurant",
    mediaKeywords: ["food", "restaurant", "coffee", "cooking", "dessert"],
    topics: [
      "Fresh batch out of the oven this morning",
      "New seasonal menu drops this weekend",
      "Behind the scenes in the kitchen today",
      "Comfort food never goes out of style",
      "Sourcing local makes all the difference",
    ],
    hashtags: ["foodie", "homemade", "freshdaily", "eatlocal", "yum"],
    nouns: ["dish", "flavor", "recipe", "menu", "plate"],
  },
  {
    key: "realestate",
    label: "Real Estate",
    mediaKeywords: ["house", "interior", "architecture", "apartment", "home"],
    topics: [
      "Just listed — this one won't last long",
      "Open house this Saturday, come say hi",
      "Market update: what buyers should know this month",
      "Staging tip: light and space sell homes",
      "Closed another happy family's first home today",
    ],
    hashtags: ["realestate", "justlisted", "dreamhome", "property", "forsale"],
    nouns: ["listing", "home", "space", "neighborhood", "deal"],
  },
  {
    key: "beauty",
    label: "Beauty & Skincare",
    mediaKeywords: ["beauty", "skincare", "cosmetics", "makeup", "spa"],
    topics: [
      "Glow-up starts with consistency, not products",
      "New shade range just landed",
      "Self-care Sunday — your skin will thank you",
      "Quick everyday look in under 5 minutes",
      "Ingredients that actually work, explained",
    ],
    hashtags: ["skincare", "beauty", "glowup", "selfcare", "makeup"],
    nouns: ["glow", "routine", "look", "shade", "skin"],
  },
  {
    key: "ecommerce",
    label: "E-commerce & Retail",
    mediaKeywords: ["product", "shopping", "fashion", "packaging", "store"],
    topics: [
      "Restock alert — your favorites are back",
      "New drop is live, link in profile",
      "Packing orders with love today",
      "One small shop, big dreams — thanks for the support",
      "Bestseller for a reason, here's why",
    ],
    hashtags: ["smallbusiness", "shopsmall", "newdrop", "handmade", "support"],
    nouns: ["drop", "piece", "order", "collection", "bestseller"],
  },
  {
    key: "tech",
    label: "Tech & SaaS",
    mediaKeywords: ["technology", "laptop", "office", "startup", "coding"],
    topics: [
      "Shipped a feature our users have been asking for",
      "Automation should save you hours, not add steps",
      "Small teams can move incredibly fast",
      "Building in public: this week's progress",
      "The best tool is the one you actually use",
    ],
    hashtags: ["saas", "startup", "buildinpublic", "automation", "productivity"],
    nouns: ["feature", "workflow", "tool", "update", "launch"],
  },
  {
    key: "travel",
    label: "Travel & Hospitality",
    mediaKeywords: ["travel", "beach", "mountains", "city", "hotel"],
    topics: [
      "Sunrise like this never gets old",
      "Adding this hidden gem to your bucket list",
      "Packing light, traveling far",
      "Local food is the real souvenir",
      "Slow travel hits different",
    ],
    hashtags: ["travel", "wanderlust", "explore", "adventure", "bucketlist"],
    nouns: ["view", "trip", "spot", "journey", "escape"],
  },
  {
    key: "coaching",
    label: "Business Coaching",
    mediaKeywords: ["business", "meeting", "workspace", "notebook", "planning"],
    topics: [
      "Clarity beats hustle every single time",
      "Your first client is closer than you think",
      "Systems give you freedom, not less of it",
      "What got you here won't get you there",
      "Consistency compounds — show up daily",
    ],
    hashtags: ["entrepreneur", "mindset", "growth", "businesstips", "hustle"],
    nouns: ["strategy", "goal", "habit", "system", "win"],
  },
  {
    key: "homedecor",
    label: "Home & Interior",
    mediaKeywords: ["interior", "furniture", "plants", "decor", "minimalist"],
    topics: [
      "Small changes, big difference at home",
      "Cozy corners are a whole mood",
      "Plants instantly make a room feel alive",
      "Less stuff, more space, more calm",
      "Natural light is the best decor there is",
    ],
    hashtags: ["homedecor", "interiordesign", "cozyhome", "minimal", "styling"],
    nouns: ["space", "corner", "piece", "vibe", "room"],
  },
  {
    key: "pets",
    label: "Pets & Animals",
    mediaKeywords: ["dog", "cat", "puppy", "pets", "animal"],
    topics: [
      "Someone's ready for their walk",
      "Adoption changed our whole world",
      "Tips for a calmer, happier pup",
      "The best coworkers have four legs",
      "Treats earned, naps incoming",
    ],
    hashtags: ["pets", "dogsofinstagram", "adopt", "petlife", "goodboy"],
    nouns: ["pup", "buddy", "companion", "rescue", "floof"],
  },
  {
    key: "events",
    label: "Events & Weddings",
    mediaKeywords: ["wedding", "party", "flowers", "celebration", "decor"],
    topics: [
      "Last weekend's celebration was pure magic",
      "Booking dates for next season now",
      "It's all in the details",
      "Behind every event: a very calm checklist",
      "Love stories deserve a beautiful backdrop",
    ],
    hashtags: ["weddings", "events", "celebrate", "eventplanner", "bigday"],
    nouns: ["celebration", "moment", "setup", "detail", "day"],
  },
  {
    key: "creator",
    label: "Content Creator",
    mediaKeywords: ["camera", "studio", "creative", "photography", "art"],
    topics: [
      "New video is up — three months in the making",
      "Consistency over virality, always",
      "Behind the scenes is my favorite part",
      "Made this just because it felt right",
      "Your support means everything, truly",
    ],
    hashtags: ["creator", "contentcreator", "behindthescenes", "art", "create"],
    nouns: ["video", "project", "piece", "shot", "edit"],
  },
];

export const NICHE_KEYS = NICHES.map((n) => n.key);

export function getNiche(key: string): NicheDef {
  return NICHES.find((n) => n.key === key) ?? NICHES[0];
}
