// Common inappropriate words/slurs for content filtering
// Using word-boundary regex to avoid false positives
export const BANNED_WORDS: string[] = [
  "fuck", "shit", "ass hole", "bitch", "dick", "pussy", "cock", "cunt",
  "nigger", "nigga", "faggot", "retard", "whore", "slut",
];

export const SEVERE_WORDS: string[] = [
  "nigger", "faggot", "kill yourself", "kys",
];

export function checkBannedWords(content: string): {
  hasBannedWords: boolean;
  hasSevereWords: boolean;
  matchedWords: string[];
} {
  const lower = content.toLowerCase();
  const matchedBanned = BANNED_WORDS.filter(w => {
    const regex = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    return regex.test(lower);
  });
  const matchedSevere = SEVERE_WORDS.filter(w => {
    const regex = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    return regex.test(lower);
  });
  return {
    hasBannedWords: matchedBanned.length > 0 || matchedSevere.length > 0,
    hasSevereWords: matchedSevere.length > 0,
    matchedWords: [...new Set([...matchedBanned, ...matchedSevere])],
  };
}
