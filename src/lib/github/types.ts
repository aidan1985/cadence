// Normalized records we persist in our own data store. These intentionally
// expose only the fields Cadence needs for changelog generation, decoupling
// the rest of the app from GitHub's wire format.

export interface PullRequest {
  /** PR number, unique within a repo. */
  number: number;
  title: string;
  body: string | null;
  /** GitHub login of the PR author, or null if the account was deleted. */
  author: string | null;
  /** ISO-8601 timestamp the PR was merged. Only merged PRs are stored. */
  mergedAt: string;
  /** Label names attached to the PR. */
  labels: string[];
  /** html_url to the PR on github.com. */
  url: string;
  /** ISO-8601 timestamp of the PR's last update (used as a sync cursor). */
  updatedAt: string;
}

export interface Commit {
  sha: string;
  message: string;
  /** Author name or login, or null when unattributed. */
  author: string | null;
  /** ISO-8601 author date. */
  authoredAt: string;
  url: string;
}

// Minimal shapes of the GitHub REST responses we read. Fields we don't use are
// omitted; `unknown` extras are tolerated.

export interface RawPullRequest {
  number: number;
  title: string;
  body: string | null;
  user: { login: string } | null;
  merged_at: string | null;
  updated_at: string;
  labels: Array<{ name: string }>;
  html_url: string;
}

export interface RawCommit {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: { name?: string; date?: string } | null;
  };
  author: { login: string } | null;
}
