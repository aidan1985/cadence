import { describe, expect, it } from "vitest";

import type { PullRequest } from "../github/types";
import type { BuiltPrompt } from "./prompt";
import { summarizeChangelog, type ModelClient } from "./summarize";
import type { GroupedChangelog } from "./types";

function pr(number: number): PullRequest {
  return {
    number,
    title: `PR ${number}`,
    body: null,
    author: "alice",
    mergedAt: "2026-06-10T00:00:00Z",
    labels: [],
    url: `https://github.com/acme/app/pull/${number}`,
    updatedAt: "2026-06-10T00:00:00Z",
  };
}

/** A ModelClient that returns a fixed grouped result and records its calls. */
function fakeClient(result: GroupedChangelog): ModelClient & {
  calls: BuiltPrompt[];
} {
  const calls: BuiltPrompt[] = [];
  return {
    calls,
    async summarize(prompt) {
      calls.push(prompt);
      return result;
    },
  };
}

const RANGE = { since: "2026-06-01", until: "2026-06-16" };

describe("summarizeChangelog", () => {
  it("returns an empty draft without calling the model when there are no PRs", async () => {
    const client = fakeClient({ sections: [] });
    const draft = await summarizeChangelog([], RANGE, client, {
      now: "2026-06-16T12:00:00Z",
    });

    expect(client.calls).toHaveLength(0);
    expect(draft).toEqual({
      range: RANGE,
      sections: [],
      prCount: 0,
      generatedAt: "2026-06-16T12:00:00Z",
    });
  });

  it("assembles a draft from the model's grouped sections", async () => {
    const client = fakeClient({
      sections: [
        {
          category: "Features",
          items: [{ summary: "Dark mode", details: "", prs: [12] }],
        },
      ],
    });

    const draft = await summarizeChangelog([pr(12)], RANGE, client, {
      now: "2026-06-16T12:00:00Z",
    });

    expect(draft.prCount).toBe(1);
    expect(draft.generatedAt).toBe("2026-06-16T12:00:00Z");
    expect(draft.sections).toEqual([
      {
        category: "Features",
        items: [{ summary: "Dark mode", details: "", prs: [12] }],
      },
    ]);
    expect(client.calls).toHaveLength(1);
  });

  it("drops empty sections and orders Features → Fixes → Improvements", async () => {
    const client = fakeClient({
      sections: [
        {
          category: "Improvements",
          items: [{ summary: "Faster", details: "", prs: [3] }],
        },
        { category: "Fixes", items: [] },
        {
          category: "Features",
          items: [{ summary: "New thing", details: "", prs: [1] }],
        },
      ],
    });

    const draft = await summarizeChangelog([pr(1), pr(3)], RANGE, client);

    expect(draft.sections.map((s) => s.category)).toEqual([
      "Features",
      "Improvements",
    ]);
  });

  it("ignores unknown categories the model might invent", async () => {
    const client = fakeClient({
      sections: [
        // @ts-expect-error — deliberately invalid category
        { category: "Misc", items: [{ summary: "?", details: "", prs: [1] }] },
        {
          category: "Fixes",
          items: [{ summary: "Fixed", details: "", prs: [2] }],
        },
      ],
    });

    const draft = await summarizeChangelog([pr(1), pr(2)], RANGE, client);

    expect(draft.sections.map((s) => s.category)).toEqual(["Fixes"]);
  });

  it("defaults generatedAt to now when not injected", async () => {
    const client = fakeClient({ sections: [] });
    const before = Date.now();
    const draft = await summarizeChangelog([pr(1)], RANGE, client);
    expect(Date.parse(draft.generatedAt)).toBeGreaterThanOrEqual(before);
  });
});
