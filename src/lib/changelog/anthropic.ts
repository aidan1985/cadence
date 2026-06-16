import Anthropic from "@anthropic-ai/sdk";

import type { BuiltPrompt } from "./prompt";
import type { ModelClient } from "./summarize";
import { CHANGELOG_CATEGORIES, type GroupedChangelog } from "./types";

// Default to Sonnet 4.6: the cost basis the board approved for this MVP
// ($3/$15 per MTok). Override with ANTHROPIC_MODEL to upgrade (e.g. opus).
export const DEFAULT_MODEL = "claude-sonnet-4-6";

// The changelog output is small (grouped bullet lists); 4096 is ample and well
// under the non-streaming HTTP-timeout threshold.
const MAX_TOKENS = 4096;

// JSON Schema for structured outputs. Every object sets additionalProperties:
// false and lists all properties as required, per the structured-output
// constraints, so the model is forced to return exactly this shape.
const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          category: { type: "string", enum: [...CHANGELOG_CATEGORIES] },
          items: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                summary: { type: "string" },
                details: { type: "string" },
                prs: { type: "array", items: { type: "integer" } },
              },
              required: ["summary", "details", "prs"],
            },
          },
        },
        required: ["category", "items"],
      },
    },
  },
  required: ["sections"],
} as const;

export interface AnthropicClientOptions {
  apiKey: string;
  /** Model id; defaults to Sonnet 4.6 (the approved cost basis). */
  model?: string;
  /** Injectable client, primarily for tests. */
  client?: Anthropic;
}

/** Extract and JSON-parse the structured changelog from a message response. */
function parseResponse(content: Anthropic.ContentBlock[]): GroupedChangelog {
  const text = content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
  if (!text.trim()) {
    throw new Error("Model returned no text content.");
  }
  const parsed = JSON.parse(text) as GroupedChangelog;
  if (!parsed || !Array.isArray(parsed.sections)) {
    throw new Error("Model output did not match the expected changelog shape.");
  }
  return parsed;
}

/**
 * The production `ModelClient`: calls Claude with structured outputs so the
 * response is guaranteed to match the changelog schema. This is the only place
 * that spends money; everything upstream is testable without it.
 */
export class AnthropicModelClient implements ModelClient {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(options: AnthropicClientOptions) {
    this.client = options.client ?? new Anthropic({ apiKey: options.apiKey });
    this.model = options.model ?? DEFAULT_MODEL;
  }

  async summarize(prompt: BuiltPrompt): Promise<GroupedChangelog> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: MAX_TOKENS,
      system: prompt.system,
      messages: [{ role: "user", content: prompt.user }],
      output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    });
    return parseResponse(response.content);
  }
}
