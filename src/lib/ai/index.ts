/**
 * AI Module Index
 *
 * Central exports for all AI functionality in FlowSmartly.
 *
 * Usage:
 *   import { aiHub } from "@/lib/ai";
 *   const result = await aiHub.generatePost({ ... });
 *
 * Architecture:
 *   @/lib/ai/
 *   ├── index.ts      - This file (main exports)
 *   ├── hub.ts        - Central AI controller
 *   ├── client.ts     - Low-level Anthropic client
 *   ├── types.ts      - Type definitions
 *   ├── prompts/      - Prompt templates
 *   └── generators/   - Individual generators
 */

// Main hub export - use this for all AI operations
export { aiHub, AIHub } from "./hub";

// Low-level clients - use only when needed
export { ai, ClaudeAI } from "./client";
export { openaiClient, OpenAIClient } from "./openai-client";
export { soraClient, SoraClient } from "./sora-client";

// Types
export * from "./types";

// Prompts (for advanced usage)
export * from "./prompts";

// Individual generators (for direct access if needed)
export * from "./generators";
