import type { RepoRef } from "../config";
import type { Commit, PullRequest, RawCommit, RawPullRequest } from "./types";

const GITHUB_API = "https://api.github.com";

// Safety cap so an un-bounded backfill against a huge repo can't run forever or
// exhaust the rate limit. One page is 100 items.
const DEFAULT_MAX_PAGES = 20;

export interface GitHubClientOptions {
  token?: string | null;
  /** Injectable fetch, primarily for tests. Defaults to global fetch. */
  fetch?: typeof fetch;
  baseUrl?: string;
  maxPages?: number;
}

export interface ListOptions {
  /** ISO-8601 lower bound. Only items at/after this point are returned. */
  since?: string | null;
}

export class GitHubClient {
  private readonly token: string | null;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly maxPages: number;

  constructor(options: GitHubClientOptions = {}) {
    this.token = options.token ?? null;
    this.fetchImpl = options.fetch ?? fetch;
    this.baseUrl = options.baseUrl ?? GITHUB_API;
    this.maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  }

  /**
   * List merged pull requests, newest-merge first, optionally bounded by
   * `since`. Closed-but-unmerged PRs are skipped. Because the API sorts by
   * `updated` descending and a PR's update time is always >= its merge time,
   * we can stop paginating once we pass a PR updated before `since`.
   */
  async listMergedPullRequests(
    repo: RepoRef,
    { since }: ListOptions = {},
  ): Promise<PullRequest[]> {
    const path = `/repos/${repo.owner}/${repo.repo}/pulls`;
    const params = new URLSearchParams({
      state: "closed",
      sort: "updated",
      direction: "desc",
      per_page: "100",
    });

    const out: PullRequest[] = [];
    for await (const raw of this.paginate<RawPullRequest>(
      `${path}?${params}`,
    )) {
      if (since && raw.updated_at < since) {
        break;
      }
      if (!raw.merged_at) {
        continue;
      }
      if (since && raw.merged_at < since) {
        continue;
      }
      out.push(normalizePullRequest(raw));
    }
    return out;
  }

  /**
   * List commits on the default branch, optionally bounded by `since` (which
   * the commits API filters server-side).
   */
  async listCommits(
    repo: RepoRef,
    { since }: ListOptions = {},
  ): Promise<Commit[]> {
    const path = `/repos/${repo.owner}/${repo.repo}/commits`;
    const params = new URLSearchParams({ per_page: "100" });
    if (since) {
      params.set("since", since);
    }

    const out: Commit[] = [];
    for await (const raw of this.paginate<RawCommit>(`${path}?${params}`)) {
      out.push(normalizeCommit(raw));
    }
    return out;
  }

  /** Walk Link-header pagination, yielding each item across all pages. */
  private async *paginate<T>(firstPath: string): AsyncGenerator<T> {
    let url: string | null = `${this.baseUrl}${firstPath}`;
    let page = 0;
    while (url && page < this.maxPages) {
      const res = await this.fetchImpl(url, { headers: this.headers() });
      if (!res.ok) {
        throw await toError(res);
      }
      const items = (await res.json()) as T[];
      for (const item of items) {
        yield item;
      }
      url = nextLink(res.headers.get("link"));
      page += 1;
    }
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "cadence-ingest",
    };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    return headers;
  }
}

export function normalizePullRequest(raw: RawPullRequest): PullRequest {
  return {
    number: raw.number,
    title: raw.title,
    body: raw.body ?? null,
    author: raw.user?.login ?? null,
    // Callers only pass us merged PRs; assert non-null for the stored shape.
    mergedAt: raw.merged_at as string,
    labels: raw.labels.map((label) => label.name),
    url: raw.html_url,
    updatedAt: raw.updated_at,
  };
}

export function normalizeCommit(raw: RawCommit): Commit {
  return {
    sha: raw.sha,
    message: raw.commit.message,
    author: raw.author?.login ?? raw.commit.author?.name ?? null,
    authoredAt: raw.commit.author?.date ?? "",
    url: raw.html_url,
  };
}

/** Extract the `rel="next"` URL from a GitHub Link header, if present. */
export function nextLink(linkHeader: string | null): string | null {
  if (!linkHeader) {
    return null;
  }
  for (const part of linkHeader.split(",")) {
    const match = /<([^>]+)>;\s*rel="next"/.exec(part.trim());
    if (match) {
      return match[1];
    }
  }
  return null;
}

async function toError(res: Response): Promise<Error> {
  const remaining = res.headers.get("x-ratelimit-remaining");
  if (res.status === 403 && remaining === "0") {
    return new Error(
      "GitHub API rate limit exceeded. Set GITHUB_TOKEN to raise the limit.",
    );
  }
  let detail = "";
  try {
    const body = (await res.json()) as { message?: string };
    detail = body.message ? `: ${body.message}` : "";
  } catch {
    // Non-JSON error body; status alone is enough context.
  }
  return new Error(`GitHub API request failed (${res.status})${detail}`);
}
