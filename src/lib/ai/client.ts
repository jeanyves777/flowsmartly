import Anthropic from "@anthropic-ai/sdk";

// Initialize primary and backup Anthropic clients
const primaryClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const backupClient = process.env.ANTHROPIC_BACKUP_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_BACKUP_API_KEY })
  : null;

export interface AIGenerationOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  model?: string;
}

export interface AIStreamOptions extends AIGenerationOptions {
  onToken?: (token: string) => void;
}

/**
 * Claude AI Client for FlowSmartly
 * Singleton pattern with automatic failover to backup API key
 */
class ClaudeAI {
  private static instance: ClaudeAI;
  private client: Anthropic;
  private backup: Anthropic | null;
  private usingBackup = false;

  private constructor() {
    this.client = primaryClient;
    this.backup = backupClient;
  }

  /** Switch to backup client if available, returns true if switched */
  private switchToBackup(): boolean {
    if (this.backup && !this.usingBackup) {
      console.warn("Anthropic primary API failed — switching to backup key");
      this.client = this.backup;
      this.usingBackup = true;
      return true;
    }
    return false;
  }

  /** Check if error warrants failover to backup key */
  private shouldFailover(error: unknown): boolean {
    const status = (error as { status?: number }).status;
    // Failover on auth errors, overloaded, rate limits, server errors
    return status === 401 || status === 403 || status === 429 || status === 500 || status === 503 || status === 529;
  }

  static getInstance(): ClaudeAI {
    if (!ClaudeAI.instance) {
      ClaudeAI.instance = new ClaudeAI();
    }
    return ClaudeAI.instance;
  }

  /**
   * Generate content using Claude (with automatic retry on transient errors)
   */
  async generate(
    prompt: string,
    options: AIGenerationOptions = {}
  ): Promise<string> {
    const {
      maxTokens = 1024,
      temperature = 0.7,
      systemPrompt = "You are a helpful marketing and content creation assistant. Be concise, creative, and professional.",
      model: modelOverride,
    } = options;

    const maxRetries = 3;
    let lastError: unknown;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await this.client.messages.create({
          model: (modelOverride || "claude-sonnet-4-20250514") as Parameters<typeof this.client.messages.create>[0]["model"],
          max_tokens: maxTokens,
          temperature,
          system: systemPrompt,
          messages: [{ role: "user", content: prompt }],
        });

        const textBlock = response.content.find((block) => block.type === "text");
        return textBlock?.type === "text" ? textBlock.text : "";
      } catch (error: unknown) {
        lastError = error;
        const status = (error as { status?: number }).status;
        const isRetryable = status === 429 || status === 529 || status === 500 || status === 503;

        // For auth errors, failover immediately
        if ((status === 401 || status === 403) && this.switchToBackup()) {
          continue;
        }

        if (isRetryable && attempt < maxRetries - 1) {
          const delay = Math.min(1000 * 2 ** attempt, 8000);
          console.warn(`AI request failed (${status}), retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
      }
    }

    // All retries exhausted — try backup before giving up
    if (lastError && this.shouldFailover(lastError) && this.switchToBackup()) {
      console.warn("All retries exhausted on primary key — retrying with backup key");
      return this.generate(prompt, options);
    }

    throw lastError;
  }

  /**
   * Stream content generation
   */
  async *stream(
    prompt: string,
    options: AIGenerationOptions = {}
  ): AsyncGenerator<string, void, unknown> {
    const {
      maxTokens = 1024,
      temperature = 0.7,
      systemPrompt = "You are a helpful marketing and content creation assistant. Be concise, creative, and professional.",
    } = options;

    try {
      const stream = this.client.messages.stream({
        model: "claude-sonnet-4-20250514",
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }],
      });

      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          yield event.delta.text;
        }
      }
    } catch (error: unknown) {
      if (this.shouldFailover(error) && this.switchToBackup()) {
        yield* this.stream(prompt, options);
      } else {
        throw error;
      }
    }
  }

  /**
   * Stream a multi-turn conversation
   */
  async *streamConversation(
    messages: { role: "user" | "assistant"; content: string }[],
    options: AIGenerationOptions = {}
  ): AsyncGenerator<string, void, unknown> {
    const {
      maxTokens = 1024,
      temperature = 0.7,
      systemPrompt = "You are a helpful marketing and content creation assistant. Be concise, creative, and professional.",
    } = options;

    try {
      const stream = this.client.messages.stream({
        model: "claude-sonnet-4-20250514",
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages,
      });

      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          yield event.delta.text;
        }
      }
    } catch (error: unknown) {
      if (this.shouldFailover(error) && this.switchToBackup()) {
        yield* this.streamConversation(messages, options);
      } else {
        throw error;
      }
    }
  }

  /**
   * Generate with JSON output
   */
  async generateJSON<T>(
    prompt: string,
    options: AIGenerationOptions = {}
  ): Promise<T | null> {
    const response = await this.generate(
      `${prompt}\n\nRespond ONLY with valid JSON, no explanations or markdown.`,
      {
        ...options,
        temperature: options.temperature ?? 0.3, // Lower temperature for JSON
      }
    );

    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as T;
      }
      return JSON.parse(response) as T;
    } catch {
      console.error("Failed to parse AI response as JSON:", response);
      return null;
    }
  }

  /**
   * Get token count estimate (rough approximation)
   */
  estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}

// Export singleton instance
export const ai = ClaudeAI.getInstance();

// Export class for testing
export { ClaudeAI };
