import type { DatabaseSync } from "node:sqlite";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RepoRef } from "./config";
import type { GitHubClient } from "./github/client";
import type { Commit, PullRequest } from "./github/types";
import { ingest } from "./ingest";
import { openDatabase } from "./store/db";
import { Repository } from "./store/repository";

const REPO: RepoRef = { owner: "acme", repo: "widget" };

function fakeClient(prs: PullRequest[], commits: Commit[]) {
  return {
    listMergedPullRequests: vi.fn().mockResolvedValue(prs),
    listCommits: vi.fn().mockResolvedValue(commits),
  } as unknown as GitHubClient;
}

function makePr(number: number, mergedAt: string): PullRequest {
  return {
    number,
    title: `PR ${number}`,
    body: null,
    author: "octocat",
    mergedAt,
    labels: [],
    url: `https://github.com/acme/widget/pull/${number}`,
    updatedAt: mergedAt,
  };
}

describe("ingest", () => {
  let db: DatabaseSync;
  let repository: Repository;

  beforeEach(() => {
    db = openDatabase(":memory:");
    repository = new Repository(db);
  });

  afterEach(() => {
    db.close();
  });

  it("stores fetched PRs/commits and records the newest merge as cursor", async () => {
    const client = fakeClient(
      [makePr(2, "2026-03-01T00:00:00Z"), makePr(1, "2026-02-01T00:00:00Z")],
      [
        {
          sha: "abc",
          message: "fix",
          author: "octocat",
          authoredAt: "2026-02-15T00:00:00Z",
          url: "https://github.com/acme/widget/commit/abc",
        },
      ],
    );

    const result = await ingest(client, repository, REPO, {
      now: "2026-03-02T00:00:00Z",
    });

    expect(result).toMatchObject({
      repo: "acme/widget",
      pullRequests: 2,
      commits: 1,
      lastPrMergedAt: "2026-03-01T00:00:00Z",
    });
    expect(repository.listPullRequests("acme/widget")).toHaveLength(2);
    expect(repository.getSyncState("acme/widget")).toEqual({
      lastSyncedAt: "2026-03-02T00:00:00Z",
      lastPrMergedAt: "2026-03-01T00:00:00Z",
    });
  });

  it("resumes from the stored cursor when `since` is omitted", async () => {
    repository.setSyncState("acme/widget", {
      lastSyncedAt: "2026-02-01T00:00:00Z",
      lastPrMergedAt: "2026-01-15T00:00:00Z",
    });
    const client = fakeClient([], []);

    await ingest(client, repository, REPO, { now: "2026-03-01T00:00:00Z" });

    expect(client.listMergedPullRequests).toHaveBeenCalledWith(REPO, {
      since: "2026-01-15T00:00:00Z",
    });
    expect(client.listCommits).toHaveBeenCalledWith(REPO, {
      since: "2026-01-15T00:00:00Z",
    });
  });

  it("keeps the previous cursor when no new PRs are merged", async () => {
    repository.setSyncState("acme/widget", {
      lastSyncedAt: "2026-02-01T00:00:00Z",
      lastPrMergedAt: "2026-01-15T00:00:00Z",
    });
    const client = fakeClient([], []);

    const result = await ingest(client, repository, REPO, {
      now: "2026-03-01T00:00:00Z",
    });

    expect(result.lastPrMergedAt).toBe("2026-01-15T00:00:00Z");
  });
});
