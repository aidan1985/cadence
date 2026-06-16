import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";

import { AnthropicModelClient, DEFAULT_MODEL } from "./anthropic";
import type { BuiltPrompt } from "./prompt";

const PROMPT: BuiltPrompt = { system: "sys", user: "usr" };

/** Build a fake Anthropic SDK whose messages.create returns canned content. */
function fakeAnthropic(text: string) {
  const create = vi.fn().mockResolvedValue({
    content: [{ type: "text", text }],
  });
  // Only the slice of the SDK surface our client uses.
  const client = { messages: { create } } as unknown as Anthropic;
  return { client, create };
}

describe("AnthropicModelClient", () => {
  it("parses structured output into grouped sections", async () => {
    const payload = {
      sections: [
        {
          category: "Features",
          items: [{ summary: "X", details: "", prs: [1] }],
        },
      ],
    };
    const { client } = fakeAnthropic(JSON.stringify(payload));
    const model = new AnthropicModelClient({ apiKey: "test", client });

    const result = await model.summarize(PROMPT);
    expect(result).toEqual(payload);
  });

  it("sends the prompt with the default model and a json_schema format", async () => {
    const { client, create } = fakeAnthropic('{"sections":[]}');
    const model = new AnthropicModelClient({ apiKey: "test", client });

    await model.summarize(PROMPT);

    expect(create).toHaveBeenCalledTimes(1);
    const args = create.mock.calls[0][0];
    expect(args.model).toBe(DEFAULT_MODEL);
    expect(args.system).toBe("sys");
    expect(args.messages).toEqual([{ role: "user", content: "usr" }]);
    expect(args.output_config.format.type).toBe("json_schema");
    expect(args.output_config.format.schema.required).toContain("sections");
  });

  it("honors an overridden model id", async () => {
    const { client, create } = fakeAnthropic('{"sections":[]}');
    const model = new AnthropicModelClient({
      apiKey: "test",
      model: "claude-opus-4-8",
      client,
    });

    await model.summarize(PROMPT);
    expect(create.mock.calls[0][0].model).toBe("claude-opus-4-8");
  });

  it("throws when the model returns no text", async () => {
    const { client } = fakeAnthropic("   ");
    const model = new AnthropicModelClient({ apiKey: "test", client });
    await expect(model.summarize(PROMPT)).rejects.toThrow(/no text/i);
  });

  it("throws when the output is not the expected shape", async () => {
    const { client } = fakeAnthropic('{"unexpected":true}');
    const model = new AnthropicModelClient({ apiKey: "test", client });
    await expect(model.summarize(PROMPT)).rejects.toThrow(
      /expected changelog shape/i,
    );
  });
});
