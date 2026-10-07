// Thin wrapper around the language model.
//
// FoodLink only ever asks the model to fill in a fixed JSON form (a "tool"
// with a strict schema). The model has no tools that read or write data, so a
// malicious request or listing cannot make it do anything: the worst case is
// a wrong form, which is validated and then shown to a person to correct.

import Anthropic from "@anthropic-ai/sdk";

export interface ToolSpec {
  name: string;
  description: string;
  /** JSON Schema for the form the model must fill in */
  schema: Record<string, unknown>;
}

export interface LlmClient {
  /** Returns the raw (unvalidated) form the model filled in. Throws on any failure. */
  fillForm(args: { system: string; user: string; tool: ToolSpec }): Promise<unknown>;
}

export const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const TIMEOUT_MS = 2500;

let cached: LlmClient | null | undefined;

/** Returns null when no API key is configured, which switches FoodLink to rules-only mode. */
export function getLlmClient(): LlmClient | null {
  if (cached !== undefined) return cached;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || process.env.FOODLINK_AI_MODE === "rules") {
    cached = null;
    return cached;
  }
  const client = new Anthropic({ apiKey, timeout: TIMEOUT_MS, maxRetries: 0 });
  const model = process.env.FOODLINK_AI_MODEL || DEFAULT_MODEL;

  cached = {
    async fillForm({ system, user, tool }) {
      const response = await client.messages.create({
        model,
        max_tokens: 250,
        system,
        messages: [{ role: "user", content: user }],
        tools: [
          {
            name: tool.name,
            description: tool.description,
            input_schema: tool.schema as Anthropic.Tool.InputSchema,
          },
        ],
        tool_choice: { type: "tool", name: tool.name },
      });
      const block = response.content.find((b) => b.type === "tool_use");
      if (!block || block.type !== "tool_use") throw new Error("Model returned no structured output");
      return block.input;
    },
  };
  return cached;
}

/** Test hook: swap in a fake model, or pass undefined to re-read the environment. */
export function setLlmClientForTests(client: LlmClient | null | undefined): void {
  cached = client;
}
