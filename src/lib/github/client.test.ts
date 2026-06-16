import { describe, expect, it, vi } from "vitest";

import { GitHubClient, nextLink, normalizeCommit } from "./client";
import type { RawCommit, RawPullRequest } from "./types";

const REPO = { owner: "acme", repo: "widget" };

function jsonResponse(body: unknown, link?: string): Response {
  const headers = new Headers({ "content-type": "application/json" });
  if (link) {
    headers.set("link", link);
  }
  return new Response(JSON.stringify(body), { status: 200, headers });
}

function pr(overrides: Partial<RawPullRequest>): RawPullRequest {
  return {
    number: 1,
    title: "A change",
    body: "details",
    user: { login: "octocat" },
    merged_at: "2026-02-01T00:00:00Z",
    updated_at: "2026-02-01T00:00:00Z",
    labels: [{ name: "feature" }],
    html_url: "https://github.com/acme/widget/pull/1",
    ...overrides,
  };
}

describe("nextLink", () => {
  it("extracts the rel=next URL", () => {
    const header =
      '<https://api.github.com/x?page=2>; rel="next", ' +
      '<https://api.github.com/x?page=5>; rel="last"';
    expect(nextLink(header)).toBe("https://api.github.com/x?page=2");
  });

  it("returns null when there is no next page", () => {
    expect(
      nextLink('<https://api.github.com/x?page=5>; rel="last"'),
    ).toBeNull();
    expect(nextLink(null)).toBeNull();
  });
});

describe("GitHubClient.listMergedPullRequests", () => {
  it("returns only merged PRs and normalizes them", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse([
        pr({ number: 3, merged_at: "2026-03-01T00:00:00Z" }),
        pr({ number: 2, merged_at: null }), // closed, never merged -> skipped
        pr({ number: 1, merged_at: "2026-01-01T00:00:00Z", user: null }),
      ]),
    );
    const client = new GitHubClient({ fetch: fetchImpl });

    const prs = await client.listMergedPullRequests(REPO);

    expect(prs.map((p) => p.number)).toEqual([3, 1]);
    expect(prs[1].author).toBeNull();
    expect(prs[0]).toMatchObject({
      number: 3,
      title: "A change",
      labels: ["feature"],
      mergedAt: "2026-03-01T00:00:00Z",
    });
  });

  it("stops paginating once updated_at falls before `since`", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          [
            pr({
              number: 10,
              updated_at: "2026-05-01T00:00:00Z",
              merged_at: "2026-05-01T00:00:00Z",
            }),
          ],
          '<https://api.github.com/page2>; rel="next"',
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse([
          // Older than `since`: triggers the early stop.
          pr({
            number: 9,
            updated_at: "2026-01-01T00:00:00Z",
            merged_at: "2026-01-01T00:00:00Z",
          }),
        ]),
      );
    const client = new GitHubClient({ fetch: fetchImpl });

    const prs = await client.listMergedPullRequests(REPO, {
      since: "2026-04-01T00:00:00Z",
    });

    expect(prs.map((p) => p.number)).toEqual([10]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("skips merged PRs older than `since` without stopping", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse([
        // Re-opened then updated after `since`, but merged before it.
        pr({
          number: 5,
          updated_at: "2026-05-01T00:00:00Z",
          merged_at: "2026-01-01T00:00:00Z",
        }),
        pr({
          number: 6,
          updated_at: "2026-05-01T00:00:00Z",
          merged_at: "2026-05-02T00:00:00Z",
        }),
      ]),
    );
    const client = new GitHubClient({ fetch: fetchImpl });

    const prs = await client.listMergedPullRequests(REPO, {
      since: "2026-04-01T00:00:00Z",
    });

    expect(prs.map((p) => p.number)).toEqual([6]);
  });

  it("throws a clear error on rate limit", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response("{}", {
        status: 403,
        headers: new Headers({ "x-ratelimit-remaining": "0" }),
      }),
    );
    const client = new GitHubClient({ fetch: fetchImpl });

    await expect(client.listMergedPullRequests(REPO)).rejects.toThrow(
      /rate limit/i,
    );
  });
});

describe("normalizeCommit", () => {
  it("prefers the GitHub login, falling back to the commit author name", () => {
    const raw: RawCommit = {
      sha: "abc",
      html_url: "https://github.com/acme/widget/commit/abc",
      commit: {
        message: "fix",
        author: { name: "Ada", date: "2026-02-01T00:00:00Z" },
      },
      author: { login: "ada-login" },
    };
    expect(normalizeCommit(raw)).toEqual({
      sha: "abc",
      message: "fix",
      author: "ada-login",
      authoredAt: "2026-02-01T00:00:00Z",
      url: "https://github.com/acme/widget/commit/abc",
    });

    const noLogin = normalizeCommit({ ...raw, author: null });
    expect(noLogin.author).toBe("Ada");
  });
});
