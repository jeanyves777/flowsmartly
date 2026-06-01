import { getNiche } from "./niches";

/**
 * Zero-cost, combinatorial text generators for synthetic personas. NO LLM / API
 * calls — comments and captions are assembled from large template banks so the
 * cost of 750 bots commenting daily is exactly zero, while the combinatorics
 * (thousands of permutations × niche nouns × emoji) keep output from looking
 * templated. Language-aware: English + French banks, English fallback.
 */

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function maybe(p: number): boolean {
  return Math.random() < p;
}

const EMOJI = ["🔥", "👏", "❤️", "💯", "🙌", "✨", "😍", "👀", "🚀", "👌", "🤩", "💪"];

type Lang = "en" | "fr";

function normLang(language: string | undefined): Lang {
  return (language || "en").toLowerCase().startsWith("fr") ? "fr" : "en";
}

// ── Comment banks ──────────────────────────────────────────────────────────

const COMMENTS: Record<Lang, { reactions: string[]; questions: string[]; cheers: string[] }> = {
  en: {
    reactions: [
      "Love this {noun}!",
      "This is so good 🙌",
      "Absolutely needed to see this today",
      "Okay this {noun} is everything",
      "The quality here is unreal",
      "Saving this one for later",
      "You always deliver, honestly",
      "This made my whole feed better",
      "Such a clean {noun}, well done",
      "Obsessed with this 😍",
      "This hits different",
      "Big fan of your {noun}",
      "No notes, this is perfect",
      "The attention to detail here 👏",
      "Instant bookmark",
      "This is exactly my vibe",
      "Wow, the {noun} though",
      "Criminally underrated post",
      "Stop it, this is too good",
      "Came for the {noun}, stayed for everything",
      "You make this look effortless",
      "This deserves to go viral",
      "Genuinely impressed",
      "Okay you have my full attention",
    ],
    questions: [
      "How long did this take you?",
      "Do you ship internationally?",
      "Where do you find the time?!",
      "What inspired this one?",
      "Any tips for someone just starting out?",
      "Is there a waitlist I can join?",
      "Can you do a tutorial on this?",
      "What's your go-to for this kind of {noun}?",
      "How do you stay this consistent?",
      "Are you taking new clients right now?",
      "What camera/setup do you use?",
      "Is this available to order?",
      "How did you learn to do this?",
      "Can I feature this (with credit)?",
      "What's the story behind this {noun}?",
      "Do you have more like this?",
      "How long have you been doing this?",
      "Any chance of a part two?",
    ],
    cheers: [
      "Keep it up! 🔥",
      "Rooting for you 🙌",
      "This deserves way more love",
      "You're killing it lately",
      "Proud to be following along",
      "Sharing this with a friend",
      "Day made, thank you for this",
      "More of this please 🙏",
      "Following for more 🙌",
      "Cannot wait to see what's next",
      "You earned a new fan today",
      "This account is a gem",
      "Keep that energy 🔥",
      "So glad this showed up on my feed",
    ],
  },
  fr: {
    reactions: [
      "J'adore ce {noun} !",
      "Vraiment trop bien 🙌",
      "Pile ce qu'il me fallait aujourd'hui",
      "Ce {noun} est juste parfait",
      "La qualité est incroyable",
      "Je garde ça de côté",
      "Tu assures à chaque fois",
      "Ça illumine mon fil 😍",
      "Tellement propre, bravo",
      "Complètement fan de ton {noun}",
    ],
    questions: [
      "Ça t'a pris combien de temps ?",
      "Tu livres à l'international ?",
      "Comment tu trouves le temps ?!",
      "Qu'est-ce qui t'a inspiré ?",
      "Des conseils pour débuter ?",
      "Il y a une liste d'attente ?",
      "Tu ferais un tuto là-dessus ?",
      "Tu prends de nouveaux clients en ce moment ?",
    ],
    cheers: [
      "Continue comme ça ! 🔥",
      "On est avec toi 🙌",
      "Ça mérite bien plus de vues",
      "Tu gères vraiment en ce moment",
      "Content de suivre ça",
      "Je partage à un ami",
      "Encore plus de ça svp 🙏",
    ],
  },
};

/** Build a single believable comment for a persona reacting to a post. */
export function generateComment(opts: { niche: string; language?: string }): string {
  const lang = normLang(opts.language);
  const bank = COMMENTS[lang];
  const noun = pick(getNiche(opts.niche).nouns);
  const kind = Math.random();
  let base: string;
  if (kind < 0.55) base = pick(bank.reactions);
  else if (kind < 0.8) base = pick(bank.questions);
  else base = pick(bank.cheers);
  let text = base.replace("{noun}", noun);
  if (maybe(0.45)) text += ` ${pick(EMOJI)}`;
  return text;
}

// ── Caption banks (for synthetic posts) ──────────────────────────────────────

const CAPTION_FLOURISH: Record<Lang, string[]> = {
  en: [
    "Drop a 🙌 if you agree.",
    "What do you think?",
    "Tag someone who needs this.",
    "Here for the journey, not just the highlights.",
    "Little by little, then all at once.",
    "Comment below 👇",
    "Grateful for this community.",
    "",
    "",
  ],
  fr: [
    "Mets un 🙌 si tu es d'accord.",
    "Vous en pensez quoi ?",
    "Identifie quelqu'un qui a besoin de voir ça.",
    "Petit à petit, puis d'un coup.",
    "Dis-moi en commentaire 👇",
    "Reconnaissant pour cette communauté.",
    "",
    "",
  ],
};

/** Build a caption for a synthetic post in the given niche. */
export function generateCaption(opts: { niche: string; language?: string }): {
  caption: string;
  hashtags: string[];
} {
  const lang = normLang(opts.language);
  const niche = getNiche(opts.niche);
  const topic = pick(niche.topics);
  const flourish = pick(CAPTION_FLOURISH[lang]);
  const caption = flourish ? `${topic}\n\n${flourish}` : topic;
  // 2–4 niche hashtags
  const count = 2 + Math.floor(Math.random() * 3);
  const tags = [...niche.hashtags].sort(() => Math.random() - 0.5).slice(0, count);
  return { caption, hashtags: tags };
}
