import type { RepoRef } from "./config";
import { GitHubClient } from "./github/client";
import type { Repository } from "./store/repository";

export function repoSlug(repo: RepoRef): string {
  return `${repo.owner}/${repo.repo}`;
}

export interface IngestOptions {
  /**
   * ISO-8601 lower bound. When omitted, resumes from the last stored sync
   * cursor; if there is none, performs a (capped) full backfill.
   */
  since?: string | null;
  /** Injectable timestamp for the sync cursor; defaults to now. */
  now?: string;
}

export interface IngestResult {
  repo: string;
  since: string | null;
  pullRequests: number;
  commits: number;
  /** Newest merge timestamp seen this run, persisted as the next cursor. */
  lastPrMergedAt: string | null;
}

/**
 * Fetch merged PRs and commits for a repo since a given point and persist them.
 * Idempotent: re-running upserts the same rows and advances the sync cursor.
 */
export async function ingest(
  client: GitHubClient,
  repository: Repository,
  repo: RepoRef,
  options: IngestOptions = {},
): Promise<IngestResult> {
  const slug = repoSlug(repo);
  const previous = repository.getSyncState(slug);
  const since =
    options.since ?? previous?.lastPrMergedAt ?? previous?.lastSyncedAt ?? null;
  const now = options.now ?? new Date().toISOString();

  const [pullRequests, commits] = await Promise.all([
    client.listMergedPullRequests(repo, { since }),
    client.listCommits(repo, { since }),
  ]);

  repository.upsertPullRequests(slug, pullRequests);
  repository.upsertCommits(slug, commits);

  const newestMerge = pullRequests.reduce<string | null>(
    (latest, pr) =>
      latest === null || pr.mergedAt > latest ? pr.mergedAt : latest,
    previous?.lastPrMergedAt ?? null,
  );
  repository.setSyncState(slug, {
    lastSyncedAt: now,
    lastPrMergedAt: newestMerge,
  });

  return {
    repo: slug,
    since,
    pullRequests: pullRequests.length,
    commits: commits.length,
    lastPrMergedAt: newestMerge,
  };
}
