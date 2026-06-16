// Configuration for GitHub ingest, resolved from environment variables so a
// single repo can be wired up without code changes. See `.env.example`.

export interface RepoRef {
  owner: string;
  repo: string;
}

export interface IngestConfig {
  repo: RepoRef;
  /** GitHub token for auth. Optional for public repos; raises rate limits. */
  token: string | null;
  /** Path to the SQLite data store. */
  dbPath: string;
}

export const DEFAULT_DB_PATH = "data/cadence.db";

/** Parse an "owner/repo" slug into its parts. Throws on malformed input. */
export function parseRepo(slug: string): RepoRef {
  const trimmed = slug.trim();
  const match = /^([^/\s]+)\/([^/\s]+)$/.exec(trimmed);
  if (!match) {
    throw new Error(
      `Invalid repo "${slug}". Expected "owner/repo" (e.g. "vercel/next.js").`,
    );
  }
  return { owner: match[1], repo: match[2] };
}

/** Resolve ingest config from a process-env-like object. */
export function loadConfig(
  env: Record<string, string | undefined> = process.env,
): IngestConfig {
  const slug = env.GITHUB_REPO;
  if (!slug) {
    throw new Error(
      'GITHUB_REPO is not set. Set it to "owner/repo" (see .env.example).',
    );
  }
  return {
    repo: parseRepo(slug),
    token: env.GITHUB_TOKEN ?? env.GH_TOKEN ?? null,
    dbPath: env.CADENCE_DB_PATH ?? DEFAULT_DB_PATH,
  };
}
