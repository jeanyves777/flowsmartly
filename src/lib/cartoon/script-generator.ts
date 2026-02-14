import { ai } from "@/lib/ai/client";

export interface CartoonCharacter {
  name: string;
  role: string; // e.g., "protagonist", "sidekick", "antagonist", "supporting"
  description: string; // Brief character description
  visualAppearance: string; // Detailed visual description for consistent image generation
  previewUrl?: string | null; // Generated character preview image URL
  voice?: string; // TTS voice ID (e.g., "nova", "onyx", "shimmer")
}

export interface DialogueLine {
  character: string; // Character name, or "narrator" for scene-setting
  line: string; // The spoken text
}

export interface CartoonScene {
  sceneNumber: number;
  dialogue: DialogueLine[]; // Character dialogue lines
  narration: string; // Combined text for subtitles/fallback
  visualDescription: string;
  durationSeconds: number;
  charactersInScene: string[]; // Names of characters appearing in this scene
}

export interface CartoonScript {
  title: string;
  characters: CartoonCharacter[];
  scenes: CartoonScene[];
  totalDuration: number;
}

const STYLE_HINTS: Record<string, string> = {
  anime: "Japanese anime style with vibrant colors, expressive characters, and dynamic scenes",
  pixar: "Pixar CGI animation style with colorful, friendly characters and detailed environments",
  comic: "Comic book style with bold outlines, dynamic poses, and vivid colors",
  watercolor: "Soft watercolor storybook illustration style with gentle colors and artistic brush strokes",
};

/**
 * Generate a cartoon script from a story prompt using Claude
 */
export async function generateCartoonScript(
  storyPrompt: string,
  style: string = "pixar",
  targetDuration: number = 60,
  existingCharacters?: CartoonCharacter[] // For series consistency
): Promise<CartoonScript> {
  // Scale scene count based on duration
  const sceneCount = targetDuration <= 10
    ? Math.max(1, Math.round(targetDuration / 5))
    : Math.max(3, Math.min(10, Math.round(targetDuration / 8)));
  const avgSceneDuration = Math.round(targetDuration / sceneCount);
  const styleHint = STYLE_HINTS[style] || STYLE_HINTS.pixar;

  // Include existing characters if provided (for series consistency)
  const characterContext = existingCharacters && existingCharacters.length > 0
    ? `\n\nEXISTING CHARACTERS (use these exact visual descriptions for consistency):\n${existingCharacters.map(c =>
        `- ${c.name} (${c.role}): ${c.visualAppearance}`
      ).join('\n')}\n`
    : '';

  const prompt = `You are a professional cartoon scriptwriter. Create a ${sceneCount}-scene animated cartoon script based on the following story prompt.

STORY PROMPT:
${storyPrompt}
${characterContext}
REQUIREMENTS:
1. First, identify ALL main characters in the story (2-5 characters typically)
2. For EACH character, provide a DETAILED visual appearance description that can be used for consistent image generation
3. Create exactly ${sceneCount} scenes that tell a complete story
4. Each scene should be approximately ${avgSceneDuration} seconds long
5. Total duration should be approximately ${targetDuration} seconds
6. IMPORTANT: Write DIALOGUE - characters must SPEAK to each other! NO narrator. The characters themselves tell the story through their conversations and reactions.
7. Each scene must have a "dialogue" array with lines spoken by actual characters (use character names from the characters list)
8. Write visual descriptions that can be converted to ${styleHint} images
9. In each scene's visual description, reference characters by name and include their key visual traits
10. The story should have a clear beginning, middle, and end
11. Keep each dialogue line short (5-15 words) - natural spoken language, suitable for text-to-speech
12. Visual descriptions should focus on a single clear moment/pose that captures the scene
13. A "narrator" character can be used sparingly for brief scene-setting (e.g., "Meanwhile, at the park...") but the MAJORITY should be character dialogue

CHARACTER VISUAL DESCRIPTION GUIDELINES:
- Species/type (human, animal, creature)
- Age appearance (child, adult, elderly)
- Body type and size
- Distinctive colors (fur, hair, skin, clothing)
- Clothing or accessories
- Unique features (big ears, glasses, spots, etc.)
- Expression style (friendly, mischievous, wise)

OUTPUT FORMAT (strict JSON):
{
  "title": "The story title",
  "characters": [
    {
      "name": "Character Name",
      "role": "protagonist|sidekick|antagonist|supporting",
      "description": "Brief character personality description (1 sentence)",
      "visualAppearance": "Detailed visual description for consistent image generation (40-60 words describing physical appearance, clothing, colors, distinctive features)"
    }
  ],
  "scenes": [
    {
      "sceneNumber": 1,
      "dialogue": [
        { "character": "Character Name", "line": "What they say (5-15 words)" },
        { "character": "Other Character", "line": "Their reply (5-15 words)" }
      ],
      "narration": "Combined dialogue as readable text for subtitles",
      "visualDescription": "Detailed visual description referencing characters by name with their visual traits (30-50 words)",
      "durationSeconds": ${avgSceneDuration},
      "charactersInScene": ["Character Name 1", "Character Name 2"]
    }
  ],
  "totalDuration": ${targetDuration}
}

Generate the script now:`;

  const script = await ai.generateJSON<CartoonScript>(prompt, {
    maxTokens: 3000,
    temperature: 0.7,
    systemPrompt: "You are an expert cartoon scriptwriter. Create engaging, family-friendly animated stories with consistent, well-described characters. Always respond with valid JSON only.",
  });

  if (!script || !script.scenes || script.scenes.length === 0) {
    throw new Error("Failed to generate cartoon script");
  }

  // Validate and normalize characters
  const normalizedCharacters = (script.characters || []).map((char) => ({
    name: char.name || "Unknown",
    role: char.role || "supporting",
    description: char.description || "",
    visualAppearance: char.visualAppearance || "",
  }));

  // Validate and normalize the scenes
  const normalizedScenes = script.scenes.map((scene, index) => {
    // Normalize dialogue lines
    const dialogue: DialogueLine[] = (scene.dialogue || []).map((d) => ({
      character: d.character || "narrator",
      line: d.line || "",
    })).filter((d) => d.line.length > 0);

    // Build narration from dialogue if not provided
    const narration = scene.narration ||
      dialogue.map((d) => `${d.character}: ${d.line}`).join(" ") ||
      "";

    return {
      sceneNumber: index + 1,
      dialogue,
      narration,
      visualDescription: scene.visualDescription || "",
      durationSeconds: scene.durationSeconds || avgSceneDuration,
      charactersInScene: scene.charactersInScene || [],
    };
  });

  return {
    title: script.title || "Untitled Cartoon",
    characters: normalizedCharacters,
    scenes: normalizedScenes,
    totalDuration: normalizedScenes.reduce((sum, s) => sum + s.durationSeconds, 0),
  };
}
