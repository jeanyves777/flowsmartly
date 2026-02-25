import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ScriptGenerateOptions {
  topic: string;
  tone?: string;
  duration?: number;
  brandName?: string;
  brandDescription?: string;
}

export async function generateScript(options: ScriptGenerateOptions): Promise<{
  script: string;
  estimatedDuration: number;
  wordCount: number;
}> {
  const { topic, tone = "professional", duration = 30, brandName, brandDescription } = options;
  const targetWords = Math.round((duration / 60) * 150);

  const systemPrompt = `You are a professional voiceover scriptwriter. Write a script for a voiceover narration.

Rules:
- Write EXACTLY around ${targetWords} words (target: ${duration} seconds at natural speaking pace)
- Tone: ${tone}
- Do NOT include stage directions, speaker labels, or sound effects
- Write ONLY the spoken words — no brackets, parentheses, or annotations
- Make it natural, engaging, and suitable for audio delivery
- Use short sentences and natural pauses
${brandName ? `- Brand: ${brandName}` : ""}
${brandDescription ? `- Brand context: ${brandDescription}` : ""}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Write a voiceover script about: ${topic}` },
    ],
    temperature: 0.7,
    max_tokens: 1000,
  });

  const script = response.choices[0]?.message?.content?.trim() || "";
  const wordCount = script.split(/\s+/).filter(Boolean).length;
  const estimatedDuration = Math.round((wordCount / 150) * 60);

  return { script, estimatedDuration, wordCount };
}
