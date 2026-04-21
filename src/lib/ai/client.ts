import Anthropic from "@anthropic-ai/sdk";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Initialize primary and backup Anthropic clients
const primaryClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const backupClient = process.env.ANTHROPIC_BACKUP_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_BACKUP_API_KEY })
  : null;

/**
 * Default Claude model. As of 2026-04-20 we use Opus 4.7 — the most capable
 * model — for everything. Per-call overrides are still supported via
 * `options.model`.
 */
export const DEFAULT_MODEL = "claude-opus-4-7";

/**
 * Models that require ADAPTIVE thinking (no `budget_tokens`) AND reject
 * sampling parameters (`temperature`, `top_p`, `top_k`). Sending those on
 * these models returns a 400 from the API.
 *
 * Keep this list narrow — only Opus 4.7+ has the strict surface today.
 */
const ADAPTIVE_THINKING_MODELS = new Set<string>([
  "claude-opus-4-7",
]);

/**
 * Models on which adaptive thinking is the recommended default but
 * `budget_tokens` is *deprecated* (still accepted, but warned). Sampling
 * parameters still work here.
 */
const ADAPTIVE_THINKING_PREFERRED = new Set<string>([
  "claude-opus-4-6",
  "claude-sonnet-4-6",
]);

function isStrictModel(model: string): boolean {
  return ADAPTIVE_THINKING_MODELS.has(model);
}

function prefersAdaptiveThinking(model: string): boolean {
  return ADAPTIVE_THINKING_MODELS.has(model) || ADAPTIVE_THINKING_PREFERRED.has(model);
}

export interface AIGenerationOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  model?: string;
}

/** A tool the agent loop can invoke. The handler runs server-side in our
 *  process — no tools are auto-executed by Anthropic. */
export interface AgentTool {
  name: string;
  description: string;
  // Anthropic JSON Schema — mirrors `Anthropic.Tool["input_schema"]`
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  /** Server-side handler. Returns whatever stringifies cleanly for Claude. */
  handler: (input: Record<string, unknown>) => Promise<unknown>;
}

export interface AgentRunResult<T = unknown> {
  /** Final text the agent returned (last text content block). */
  text: string;
  /** Parsed JSON if the final text block was valid JSON, else null. */
  json: T | null;
  /** How many model turns the loop executed. */
  iterations: number;
  /** Total input + output tokens charged across the loop. */
  usage: { inputTokens: number; outputTokens: number };
  /** Names of tools that were called, in order — useful for debugging. */
  toolsUsed: string[];
}

export interface AgentRunOptions extends AIGenerationOptions {
  /** Hard cap to prevent runaway loops. Default 8. */
  maxIterations?: number;
  /**
   * Extended thinking budget in tokens. Default 2000.
   * Set to 0 or false to disable thinking entirely.
   *
   * Notes:
   * - When thinking is on, temperature is forced to 1 (API requirement).
   * - `maxTokens` is auto-bumped to be > budgetTokens (min 4096).
   * - Thinking blocks in responses are preserved across loop iterations
   *   (they live in `response.content` which we already append).
   */
  thinkingBudget?: number | false;
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

    const model = modelOverride || DEFAULT_MODEL;
    const strict = isStrictModel(model);

    const maxRetries = 3;
    let lastError: unknown;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // On strict models (Opus 4.7+) the API rejects `temperature`,
        // `top_p`, and `top_k`. Drop them silently rather than 400'ing.
        const baseParams: Record<string, unknown> = {
          model: model as Parameters<typeof this.client.messages.create>[0]["model"],
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: [{ role: "user", content: prompt }],
        };
        if (!strict) baseParams.temperature = temperature;
        const response = (await this.client.messages.create(
          baseParams as unknown as Parameters<typeof this.client.messages.create>[0],
        )) as Anthropic.Message;

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
      model: modelOverride,
    } = options;

    const model = modelOverride || DEFAULT_MODEL;
    const strict = isStrictModel(model);

    try {
      const streamParams: Record<string, unknown> = {
        model: model as Parameters<typeof this.client.messages.stream>[0]["model"],
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }],
      };
      if (!strict) streamParams.temperature = temperature;
      const stream = this.client.messages.stream(
        streamParams as unknown as Parameters<typeof this.client.messages.stream>[0],
      );

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
      model: modelOverride,
    } = options;

    const model = modelOverride || DEFAULT_MODEL;
    const strict = isStrictModel(model);

    try {
      const streamParams: Record<string, unknown> = {
        model: model as Parameters<typeof this.client.messages.stream>[0]["model"],
        max_tokens: maxTokens,
        system: systemPrompt,
        messages,
      };
      if (!strict) streamParams.temperature = temperature;
      const stream = this.client.messages.stream(
        streamParams as unknown as Parameters<typeof this.client.messages.stream>[0],
      );

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

  /**
   * Manual agentic loop with tool use.
   *
   * The model can call any of the provided tools; we execute the handler
   * server-side and feed the result back, then loop until Claude stops
   * calling tools (`stop_reason === "end_turn"`) or we hit `maxIterations`.
   *
   * Designed for read-only tools that enrich the prompt with live data
   * (brand kit, recent designs, typography pairings) — keep handlers
   * idempotent and non-mutating so the loop is safe to retry.
   */
  async runWithTools<T = unknown>(
    prompt: string,
    tools: AgentTool[],
    options: AgentRunOptions = {},
  ): Promise<AgentRunResult<T>> {
    const {
      temperature = 0.5,
      systemPrompt = "You are a helpful assistant. Use the provided tools to gather context before answering.",
      model: modelOverride,
      maxIterations = 8,
      thinkingBudget = 2000,
    } = options;

    const model = modelOverride || DEFAULT_MODEL;
    const useAdaptiveThinking = prefersAdaptiveThinking(model);
    const strictParams = isStrictModel(model);

    // Thinking config — Opus 4.7 only accepts adaptive; older models accept
    // {type: "enabled", budget_tokens: N}. We pick the right shape per model
    // and only enable thinking when the caller asked for it.
    const thinkingRequested =
      typeof thinkingBudget === "number" && thinkingBudget >= 1024;
    const effectiveBudget = thinkingRequested ? Math.max(1024, thinkingBudget as number) : 0;
    const requestedMax = options.maxTokens ?? 2048;
    // Even with adaptive thinking, leave headroom for thinking + output
    const maxTokens = thinkingRequested
      ? Math.max(requestedMax, effectiveBudget + 2048)
      : requestedMax;
    // Strict models lock temperature; legacy thinking forces temperature=1
    const effectiveTemperature =
      strictParams ? undefined : thinkingRequested ? 1 : temperature;

    const toolDefs = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema as Anthropic.Tool["input_schema"],
    }));

    const handlerByName = new Map(tools.map((t) => [t.name, t.handler]));
    const messages: Array<{ role: "user" | "assistant"; content: unknown }> = [
      { role: "user", content: prompt },
    ];

    let totalIn = 0;
    let totalOut = 0;
    const toolsUsed: string[] = [];
    let lastText = "";

    for (let iter = 0; iter < maxIterations; iter++) {
      let response: Anthropic.Message;
      try {
        // Build params dynamically — Opus 4.7 rejects temperature, requires
        // adaptive thinking; older models want enabled+budget_tokens.
        const createParams: Record<string, unknown> = {
          model: model as Parameters<typeof this.client.messages.create>[0]["model"],
          max_tokens: maxTokens,
          system: systemPrompt,
          tools: toolDefs,
          messages: messages as Anthropic.MessageParam[],
        };
        if (effectiveTemperature !== undefined) {
          createParams.temperature = effectiveTemperature;
        }
        if (thinkingRequested) {
          createParams.thinking = useAdaptiveThinking
            ? { type: "adaptive" }
            : { type: "enabled", budget_tokens: effectiveBudget };
        }
        // SDK 0.32.x types don't yet include `thinking`; runtime accepts it.
        response = (await this.client.messages.create(
          createParams as unknown as Parameters<typeof this.client.messages.create>[0],
        )) as Anthropic.Message;
      } catch (error: unknown) {
        // Failover on auth error
        if (this.shouldFailover(error) && this.switchToBackup()) {
          iter--; // Retry this iteration on the backup
          continue;
        }
        throw error;
      }

      totalIn += response.usage?.input_tokens ?? 0;
      totalOut += response.usage?.output_tokens ?? 0;

      // Capture last text block (will be the final answer when no more tools called)
      const textBlock = response.content.find((b) => b.type === "text");
      if (textBlock?.type === "text") lastText = textBlock.text;

      // If the model is done, return
      if (response.stop_reason === "end_turn") {
        return this.buildAgentResult<T>(lastText, iter + 1, totalIn, totalOut, toolsUsed);
      }

      // Otherwise, gather tool_use blocks and execute their handlers
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );

      if (toolUseBlocks.length === 0) {
        // No tool calls and no end_turn — bail to avoid infinite loop
        return this.buildAgentResult<T>(lastText, iter + 1, totalIn, totalOut, toolsUsed);
      }

      messages.push({ role: "assistant", content: response.content });

      const toolResults: Array<{
        type: "tool_result";
        tool_use_id: string;
        content: string;
        is_error?: boolean;
      }> = [];

      for (const tu of toolUseBlocks) {
        toolsUsed.push(tu.name);
        const handler = handlerByName.get(tu.name);
        if (!handler) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: `Unknown tool: ${tu.name}`,
            is_error: true,
          });
          continue;
        }
        try {
          const result = await handler(tu.input as Record<string, unknown>);
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: typeof result === "string" ? result : JSON.stringify(result),
          });
        } catch (e) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: e instanceof Error ? e.message : "Tool execution failed",
            is_error: true,
          });
        }
      }

      messages.push({ role: "user", content: toolResults });
    }

    // Hit max iterations — return whatever the last text was
    return this.buildAgentResult<T>(lastText, maxIterations, totalIn, totalOut, toolsUsed);
  }

  private buildAgentResult<T>(
    text: string,
    iterations: number,
    inputTokens: number,
    outputTokens: number,
    toolsUsed: string[],
  ): AgentRunResult<T> {
    let json: T | null = null;
    if (text) {
      try {
        const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        json = match ? (JSON.parse(match[0]) as T) : (JSON.parse(text) as T);
      } catch {
        // Not JSON — fine, leave json=null
      }
    }
    return {
      text,
      json,
      iterations,
      usage: { inputTokens, outputTokens },
      toolsUsed,
    };
  }
}

// Export singleton instance
export const ai = ClaudeAI.getInstance();

// Export class for testing
export { ClaudeAI };
