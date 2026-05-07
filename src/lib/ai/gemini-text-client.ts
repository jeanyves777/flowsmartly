import { GoogleGenAI } from "@google/genai";
import { ai as claudeFallback, type AIGenerationOptions } from "./client";

type ConversationMessage = { role: "user" | "assistant"; content: string };

const DEFAULT_GEMINI_TEXT_MODEL =
  process.env.GEMINI_TEXT_MODEL ||
  process.env.FLOWAI_TEXT_MODEL ||
  "gemini-2.5-flash";

const DEFAULT_MARKETING_SYSTEM_PROMPT =
  "You are FlowAI, a senior marketing strategist, social copywriter, SEO planner, and content operator. Produce complete, ready-to-use marketing work with concrete details, platform nuance, SEO/search terms, hashtags when relevant, and clear next actions. Do not mention model names or backend providers.";

class GeminiTextClient {
  private static instance: GeminiTextClient;
  private client: GoogleGenAI | null = null;

  private constructor() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (apiKey) {
      this.client = new GoogleGenAI({ apiKey });
    } else {
      console.warn("[GeminiText] No GEMINI_API_KEY found; text requests will use Claude fallback.");
    }
  }

  static getInstance(): GeminiTextClient {
    if (!GeminiTextClient.instance) {
      GeminiTextClient.instance = new GeminiTextClient();
    }
    return GeminiTextClient.instance;
  }

  isAvailable(): boolean {
    return !!this.client;
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private model(options: AIGenerationOptions = {}) {
    const requested = options.model || DEFAULT_GEMINI_TEXT_MODEL;
    return requested.startsWith("gemini-") ? requested : DEFAULT_GEMINI_TEXT_MODEL;
  }

  async generate(prompt: string, options: AIGenerationOptions = {}): Promise<string> {
    if (!this.client) return claudeFallback.generate(prompt, options);

    try {
      const response = await this.client.models.generateContent({
        model: this.model(options),
        contents: prompt,
        config: {
          systemInstruction:
            options.systemPrompt ||
            DEFAULT_MARKETING_SYSTEM_PROMPT,
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxTokens ?? 2048,
        },
      });
      return response.text || "";
    } catch (error) {
      console.warn("[GeminiText] generation failed; using Claude fallback:", error);
      return claudeFallback.generate(prompt, options);
    }
  }

  async generateJSON<T>(prompt: string, options: AIGenerationOptions = {}): Promise<T | null> {
    const response = await this.generate(
      `${prompt}\n\nRespond ONLY with valid JSON, no explanations or markdown.`,
      { ...options, temperature: options.temperature ?? 0.3 },
    );

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      return JSON.parse(jsonMatch ? jsonMatch[0] : response) as T;
    } catch {
      console.error("[GeminiText] Failed to parse response as JSON:", response);
      return null;
    }
  }

  async *streamConversation(
    messages: ConversationMessage[],
    options: AIGenerationOptions = {},
  ): AsyncGenerator<string, void, unknown> {
    if (!this.client) {
      yield* claudeFallback.streamConversation(messages, options);
      return;
    }

    const contents = messages.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));

    try {
      const stream = await this.client.models.generateContentStream({
        model: this.model(options),
        contents,
        config: {
          systemInstruction:
            options.systemPrompt ||
            DEFAULT_MARKETING_SYSTEM_PROMPT,
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxTokens ?? 2048,
        },
      });

      for await (const chunk of stream) {
        if (chunk.text) yield chunk.text;
      }
    } catch (error) {
      console.warn("[GeminiText] streaming failed; using Claude fallback:", error);
      yield* claudeFallback.streamConversation(messages, options);
    }
  }
}

export const geminiText = GeminiTextClient.getInstance();
export { GeminiTextClient };
