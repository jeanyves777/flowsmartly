import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const systemTemplates = [
  // Social Post Templates
  {
    name: "Product Launch Announcement",
    description: "Create buzz around a new product or feature launch with an engaging announcement post",
    category: "social-post",
    promptTemplate: `Announcing our new [PRODUCT NAME] that helps [TARGET AUDIENCE] achieve [KEY BENEFIT].

Key features:
- [Feature 1 and its benefit]
- [Feature 2 and its benefit]
- [Feature 3 and its benefit]

Available now at [LINK/PRICE]. Early bird discount ends [DATE]!`,
    icon: "Sparkles",
    color: "#0ea5e9",
    platforms: JSON.stringify(["instagram", "twitter", "linkedin", "facebook"]),
    defaultSettings: JSON.stringify({
      tone: "inspirational",
      length: "medium",
      includeHashtags: true,
      includeEmojis: true,
      includeCTA: true,
    }),
    tags: JSON.stringify(["product", "launch", "announcement", "marketing"]),
    isSystem: true,
    isFeatured: true,
    usageCount: 0,
  },
  {
    name: "Behind the Scenes",
    description: "Share authentic behind-the-scenes content that humanizes your brand",
    category: "social-post",
    promptTemplate: `A peek behind the curtain at [YOUR COMPANY]!

Today we're [ACTIVITY - e.g., brainstorming new features, team meeting, office fun].

What most people don't know is [INTERESTING FACT OR STORY].

What would you like to see more of from us?`,
    icon: "FileText",
    color: "#8b5cf6",
    platforms: JSON.stringify(["instagram", "facebook"]),
    defaultSettings: JSON.stringify({
      tone: "casual",
      length: "medium",
      includeHashtags: true,
      includeEmojis: true,
      includeCTA: false,
    }),
    tags: JSON.stringify(["behind-scenes", "authentic", "culture", "team"]),
    isSystem: true,
    isFeatured: false,
    usageCount: 0,
  },
  {
    name: "Educational Value Post",
    description: "Share valuable tips, insights, or educational content with your audience",
    category: "social-post",
    promptTemplate: `[NUMBER] [TOPIC] tips that will change how you [BENEFIT]:

1. [Tip 1] - [Brief explanation]
2. [Tip 2] - [Brief explanation]
3. [Tip 3] - [Brief explanation]
4. [Tip 4] - [Brief explanation]
5. [Tip 5] - [Brief explanation]

Which tip are you trying first? Save this for later!`,
    icon: "Lightbulb",
    color: "#10b981",
    platforms: JSON.stringify(["linkedin", "twitter", "instagram"]),
    defaultSettings: JSON.stringify({
      tone: "educational",
      length: "long",
      includeHashtags: true,
      includeEmojis: false,
      includeCTA: true,
    }),
    tags: JSON.stringify(["educational", "tips", "howto", "learning"]),
    isSystem: true,
    isFeatured: true,
    usageCount: 0,
  },
  {
    name: "Engagement Question",
    description: "Spark conversations with thought-provoking questions",
    category: "social-post",
    promptTemplate: `[THOUGHT-PROVOKING QUESTION about your industry/niche]?

I'll go first: [YOUR ANSWER]

Drop your answer below!`,
    icon: "MessageSquare",
    color: "#f59e0b",
    platforms: JSON.stringify(["twitter", "linkedin", "instagram"]),
    defaultSettings: JSON.stringify({
      tone: "casual",
      length: "short",
      includeHashtags: false,
      includeEmojis: true,
      includeCTA: false,
    }),
    tags: JSON.stringify(["engagement", "question", "conversation", "community"]),
    isSystem: true,
    isFeatured: false,
    usageCount: 0,
  },

  // Caption Templates
  {
    name: "Product Showcase Caption",
    description: "Compelling caption for product photos that drives interest and action",
    category: "caption",
    promptTemplate: `[PRODUCT NAME] in [COLOR/STYLE/VERSION]

[Describe what makes this product special - texture, quality, feeling]

Perfect for [USE CASE/OCCASION]

[PRICE] | Link in bio to shop`,
    icon: "MessageSquare",
    color: "#ec4899",
    platforms: JSON.stringify(["instagram", "facebook"]),
    defaultSettings: JSON.stringify({
      tone: "professional",
      length: "medium",
      includeHashtags: true,
      includeEmojis: true,
    }),
    tags: JSON.stringify(["product", "caption", "showcase", "ecommerce"]),
    isSystem: true,
    isFeatured: true,
    usageCount: 0,
  },
  {
    name: "Lifestyle Shot Caption",
    description: "Engaging caption for lifestyle and mood photography",
    category: "caption",
    promptTemplate: `[MOOD/VIBE DESCRIPTION - e.g., Sunday morning energy, Golden hour magic]

[Short story or feeling this image evokes]

[LOCATION] | [CONTEXT]`,
    icon: "MessageSquare",
    color: "#6366f1",
    platforms: JSON.stringify(["instagram"]),
    defaultSettings: JSON.stringify({
      tone: "inspirational",
      length: "short",
      includeHashtags: true,
      includeEmojis: true,
    }),
    tags: JSON.stringify(["lifestyle", "mood", "aesthetic", "vibes"]),
    isSystem: true,
    isFeatured: false,
    usageCount: 0,
  },

  // Hashtag Templates
  {
    name: "Viral Reach Hashtags",
    description: "High-reach hashtags optimized for maximum visibility and discovery",
    category: "hashtags",
    promptTemplate: `[YOUR NICHE/INDUSTRY] content for [TARGET AUDIENCE]

Topics: [MAIN TOPIC], [SUBTOPIC 1], [SUBTOPIC 2]

Looking for mix of high-reach and niche hashtags`,
    icon: "Hash",
    color: "#f97316",
    platforms: JSON.stringify(["instagram"]),
    defaultSettings: JSON.stringify({
      count: 20,
      categories: ["trending", "niche", "community"],
    }),
    tags: JSON.stringify(["hashtags", "reach", "viral", "discovery"]),
    isSystem: true,
    isFeatured: true,
    usageCount: 0,
  },
  {
    name: "Niche Community Hashtags",
    description: "Targeted hashtags to reach specific communities and audiences",
    category: "hashtags",
    promptTemplate: `[SPECIFIC NICHE] community hashtags

Industry: [YOUR INDUSTRY]
Audience: [TARGET DEMOGRAPHIC]
Location: [CITY/REGION if relevant]

Focus on engaged micro-communities`,
    icon: "Hash",
    color: "#84cc16",
    platforms: JSON.stringify(["instagram", "twitter"]),
    defaultSettings: JSON.stringify({
      count: 15,
      categories: ["niche", "community"],
    }),
    tags: JSON.stringify(["hashtags", "niche", "community", "targeted"]),
    isSystem: true,
    isFeatured: false,
    usageCount: 0,
  },

  // Content Ideas Templates
  {
    name: "Weekly Content Calendar",
    description: "Generate a week's worth of content ideas for consistent posting",
    category: "ideas",
    promptTemplate: `Weekly content calendar for [YOUR BRAND/BUSINESS]

Industry: [YOUR INDUSTRY]
Target audience: [WHO YOU'RE TRYING TO REACH]
Goals: [AWARENESS/ENGAGEMENT/SALES]

Content pillars: educational, entertaining, promotional, behind-scenes`,
    icon: "Lightbulb",
    color: "#14b8a6",
    platforms: JSON.stringify(["instagram", "twitter", "linkedin", "facebook"]),
    defaultSettings: JSON.stringify({
      count: 7,
      contentPillars: ["educational", "entertaining", "inspiring", "promotional"],
    }),
    tags: JSON.stringify(["ideas", "calendar", "planning", "content-strategy"]),
    isSystem: true,
    isFeatured: true,
    usageCount: 0,
  },
  {
    name: "Trending Topic Ideas",
    description: "Content ideas based on current trends and viral potential",
    category: "ideas",
    promptTemplate: `Trending content ideas for [YOUR NICHE]

Brand voice: [PROFESSIONAL/CASUAL/PLAYFUL]
Audience interests: [WHAT YOUR AUDIENCE CARES ABOUT]
Current events/seasons: [ANY TIMELY ANGLES]

Focus on shareable, engaging formats`,
    icon: "Lightbulb",
    color: "#a855f7",
    platforms: JSON.stringify(["twitter", "instagram", "tiktok"]),
    defaultSettings: JSON.stringify({
      count: 5,
      contentPillars: ["entertaining", "user-generated"],
    }),
    tags: JSON.stringify(["ideas", "trending", "viral", "timely"]),
    isSystem: true,
    isFeatured: false,
    usageCount: 0,
  },

  // Thread Templates
  {
    name: "Educational Thread",
    description: "Multi-part thread that teaches something valuable to your audience",
    category: "thread",
    promptTemplate: `[NUMBER] things I learned about [TOPIC] that changed everything:

1/ [HOOK - Promise of value]

2/ [First insight with example]

3/ [Second insight with example]

[Continue with valuable points...]

[Final tweet: Summary + CTA to follow for more]`,
    icon: "ListTree",
    color: "#0ea5e9",
    platforms: JSON.stringify(["twitter"]),
    defaultSettings: JSON.stringify({
      tone: "educational",
      length: "long",
    }),
    tags: JSON.stringify(["thread", "educational", "howto", "twitter"]),
    isSystem: true,
    isFeatured: true,
    usageCount: 0,
  },
  {
    name: "Story Thread",
    description: "Narrative thread that tells a compelling story",
    category: "thread",
    promptTemplate: `[YEAR], [SITUATION that hooks attention]

This is the story of how [OUTCOME/TRANSFORMATION].

[Thread continues with:]
- The challenge I faced
- The turning point
- What I learned
- How it changed everything

The lesson: [KEY TAKEAWAY]`,
    icon: "ListTree",
    color: "#ef4444",
    platforms: JSON.stringify(["twitter"]),
    defaultSettings: JSON.stringify({
      tone: "casual",
      length: "long",
    }),
    tags: JSON.stringify(["thread", "story", "narrative", "twitter"]),
    isSystem: true,
    isFeatured: false,
    usageCount: 0,
  },
];

async function main() {
  console.log("Seeding content templates...");

  // Delete existing system templates
  await prisma.contentTemplate.deleteMany({
    where: { isSystem: true },
  });

  // Create new templates
  for (const template of systemTemplates) {
    await prisma.contentTemplate.create({
      data: template,
    });
    console.log(`Created template: ${template.name}`);
  }

  console.log(`\nSeeded ${systemTemplates.length} system templates successfully!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
