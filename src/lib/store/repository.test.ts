import type { DatabaseSync } from "node:sqlite";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Commit, PullRequest } from "../github/types";
import { openDatabase } from "./db";
import { Repository } from "./repository";

const SLUG = "acme/widget";

function makePr(overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    number: 1,
    title: "Add feature",
    body: "body",
    author: "octocat",
    mergedAt: "2026-02-01T00:00:00Z",
    labels: ["feature", "minor"],
    url: "https://github.com/acme/widget/pull/1",
    updatedAt: "2026-02-01T00:00:00Z",
    ...overrides,
  };
}

describe("Repository", () => {
  let db: DatabaseSync;
  let repo: Repository;

  beforeEach(() => {
    db = openDatabase(":memory:");
    repo = new Repository(db);
  });

  afterEach(() => {
    db.close();
  });

  it("round-trips merged PRs including labels", () => {
    repo.upsertPullRequests(SLUG, [makePr()]);
    const [stored] = repo.listPullRequests(SLUG);
    expect(stored).toEqual(makePr());
  });

  it("upserts on conflicting PR number rather than duplicating", () => {
    repo.upsertPullRequests(SLUG, [makePr({ title: "old" })]);
    repo.upsertPullRequests(SLUG, [makePr({ title: "new" })]);
    const prs = repo.listPullRequests(SLUG);
    expect(prs).toHaveLength(1);
    expect(prs[0].title).toBe("new");
  });

  it("lists newest merge first and filters by since/limit", () => {
    repo.upsertPullRequests(SLUG, [
      makePr({ number: 1, mergedAt: "2026-01-01T00:00:00Z" }),
      makePr({ number: 2, mergedAt: "2026-03-01T00:00:00Z" }),
      makePr({ number: 3, mergedAt: "2026-02-01T00:00:00Z" }),
    ]);

    expect(repo.listPullRequests(SLUG).map((p) => p.number)).toEqual([2, 3, 1]);
    expect(
      repo
        .listPullRequests(SLUG, { since: "2026-02-01T00:00:00Z" })
        .map((p) => p.number),
    ).toEqual([2, 3]);
    expect(
      repo.listPullRequests(SLUG, { limit: 1 }).map((p) => p.number),
    ).toEqual([2]);
  });

  it("scopes rows by repo slug", () => {
    repo.upsertPullRequests(SLUG, [makePr({ number: 1 })]);
    repo.upsertPullRequests("other/repo", [makePr({ number: 1 })]);
    expect(repo.listPullRequests(SLUG)).toHaveLength(1);
    expect(repo.listPullRequests("other/repo")).toHaveLength(1);
  });

  it("upserts commits and persists sync state", () => {
    const commits: Commit[] = [
      {
        sha: "abc",
        message: "fix",
        author: "octocat",
        authoredAt: "2026-02-01T00:00:00Z",
        url: "https://github.com/acme/widget/commit/abc",
      },
    ];
    expect(repo.upsertCommits(SLUG, commits)).toBe(1);
    repo.upsertCommits(SLUG, commits); // idempotent

    expect(repo.getSyncState(SLUG)).toBeNull();
    repo.setSyncState(SLUG, {
      lastSyncedAt: "2026-03-01T00:00:00Z",
      lastPrMergedAt: "2026-02-01T00:00:00Z",
    });
    expect(repo.getSyncState(SLUG)).toEqual({
      lastSyncedAt: "2026-03-01T00:00:00Z",
      lastPrMergedAt: "2026-02-01T00:00:00Z",
    });
  });
});
