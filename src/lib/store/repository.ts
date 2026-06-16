import type { DatabaseSync } from "node:sqlite";

import type { Commit, PullRequest } from "../github/types";

/** Read-back filters for stored pull requests. */
export interface ListPullRequestsOptions {
  /** ISO-8601 lower bound on merge date. */
  since?: string | null;
  limit?: number;
}

export interface SyncState {
  lastSyncedAt: string;
  lastPrMergedAt: string | null;
}

/** Persists ingested GitHub data, keyed by repo slug ("owner/repo"). */
export class Repository {
  constructor(private readonly db: DatabaseSync) {}

  /** Insert or update merged PRs. Returns the count written. */
  upsertPullRequests(repoSlug: string, prs: PullRequest[]): number {
    const stmt = this.db.prepare(`
      INSERT INTO pull_requests
        (repo, number, title, body, author, merged_at, labels, url, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(repo, number) DO UPDATE SET
        title = excluded.title,
        body = excluded.body,
        author = excluded.author,
        merged_at = excluded.merged_at,
        labels = excluded.labels,
        url = excluded.url,
        updated_at = excluded.updated_at
    `);
    for (const pr of prs) {
      stmt.run(
        repoSlug,
        pr.number,
        pr.title,
        pr.body,
        pr.author,
        pr.mergedAt,
        JSON.stringify(pr.labels),
        pr.url,
        pr.updatedAt,
      );
    }
    return prs.length;
  }

  /** Insert or update commits. Returns the count written. */
  upsertCommits(repoSlug: string, commits: Commit[]): number {
    const stmt = this.db.prepare(`
      INSERT INTO commits (repo, sha, message, author, authored_at, url)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(repo, sha) DO UPDATE SET
        message = excluded.message,
        author = excluded.author,
        authored_at = excluded.authored_at,
        url = excluded.url
    `);
    for (const commit of commits) {
      stmt.run(
        repoSlug,
        commit.sha,
        commit.message,
        commit.author,
        commit.authoredAt,
        commit.url,
      );
    }
    return commits.length;
  }

  /** Read stored merged PRs, newest merge first. */
  listPullRequests(
    repoSlug: string,
    { since, limit }: ListPullRequestsOptions = {},
  ): PullRequest[] {
    let sql =
      "SELECT number, title, body, author, merged_at, labels, url, updated_at" +
      " FROM pull_requests WHERE repo = ?";
    const params: Array<string | number> = [repoSlug];
    if (since) {
      sql += " AND merged_at >= ?";
      params.push(since);
    }
    sql += " ORDER BY merged_at DESC";
    if (limit !== undefined) {
      sql += " LIMIT ?";
      params.push(limit);
    }
    const rows = this.db
      .prepare(sql)
      .all(...params) as unknown as PullRequestRow[];
    return rows.map(rowToPullRequest);
  }

  getSyncState(repoSlug: string): SyncState | null {
    const row = this.db
      .prepare(
        "SELECT last_synced_at, last_pr_merged_at FROM sync_state WHERE repo = ?",
      )
      .get(repoSlug) as
      | { last_synced_at: string; last_pr_merged_at: string | null }
      | undefined;
    if (!row) {
      return null;
    }
    return {
      lastSyncedAt: row.last_synced_at,
      lastPrMergedAt: row.last_pr_merged_at,
    };
  }

  setSyncState(repoSlug: string, state: SyncState): void {
    this.db
      .prepare(
        `INSERT INTO sync_state (repo, last_synced_at, last_pr_merged_at)
         VALUES (?, ?, ?)
         ON CONFLICT(repo) DO UPDATE SET
           last_synced_at = excluded.last_synced_at,
           last_pr_merged_at = excluded.last_pr_merged_at`,
      )
      .run(repoSlug, state.lastSyncedAt, state.lastPrMergedAt);
  }
}

interface PullRequestRow {
  number: number;
  title: string;
  body: string | null;
  author: string | null;
  merged_at: string;
  labels: string;
  url: string;
  updated_at: string;
}

function rowToPullRequest(row: PullRequestRow): PullRequest {
  return {
    number: row.number,
    title: row.title,
    body: row.body,
    author: row.author,
    mergedAt: row.merged_at,
    labels: JSON.parse(row.labels) as string[],
    url: row.url,
    updatedAt: row.updated_at,
  };
}
