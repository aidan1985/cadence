import { describe, expect, it } from "vitest";

import type { PullRequest } from "../github/types";
import { buildPrompt } from "./prompt";

function pr(overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    number: 1,
    title: "Add dark mode",
    body: "Lets users switch themes.",
    author: "alice",
    mergedAt: "2026-06-10T00:00:00Z",
    labels: [],
    url: "https://github.com/acme/app/pull/1",
    updatedAt: "2026-06-10T00:00:00Z",
    ...overrides,
  };
}

describe("buildPrompt", () => {
  it("lists each PR by number, title, labels, and description", () => {
    const { user } = buildPrompt(
      [pr({ number: 12, title: "Add dark mode", labels: ["feature", "ui"] })],
      { since: null, until: null },
    );
    expect(user).toContain("PR #12: Add dark mode");
    expect(user).toContain("Labels: feature, ui");
    expect(user).toContain("Description: Lets users switch themes.");
  });

  it("names the three categories and the audience in the system prompt", () => {
    const { system } = buildPrompt([pr()], { since: null, until: null });
    expect(system).toContain("Features");
    expect(system).toContain("Fixes");
    expect(system).toContain("Improvements");
    expect(system).toMatch(/end users/i);
  });

  it("truncates long PR bodies to keep token cost bounded", () => {
    const longBody = "x".repeat(2000);
    const { user } = buildPrompt([pr({ body: longBody })], {
      since: null,
      until: null,
    });
    expect(user).toContain("…");
    expect(user).not.toContain("x".repeat(600));
  });

  it("omits the description line when a PR has no body", () => {
    const { user } = buildPrompt([pr({ body: null })], {
      since: null,
      until: null,
    });
    expect(user).not.toContain("Description:");
  });

  it("reports the PR count and date range to the model", () => {
    const { user } = buildPrompt([pr(), pr({ number: 2 })], {
      since: "2026-06-01",
      until: "2026-06-16",
    });
    expect(user).toContain("2 pull request(s)");
    expect(user).toContain("2026-06-01 to 2026-06-16");
  });
});
