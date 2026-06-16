/**
 * Cadence GitHub ingest CLI.
 *
 *   npm run ingest                          # ingest configured repo (env)
 *   npm run ingest -- --since 2026-01-01    # ingest merged since a date
 *   npm run ingest -- --repo owner/name     # override the configured repo
 *   npm run ingest -- --list                # list stored merged PRs
 *
 * Configuration comes from environment variables (see .env.example):
 *   GITHUB_REPO=owner/repo   GITHUB_TOKEN=...   CADENCE_DB_PATH=data/cadence.db
 */
import { loadConfig, parseRepo, type RepoRef } from "../src/lib/config";
import { GitHubClient } from "../src/lib/github/client";
import { ingest, repoSlug } from "../src/lib/ingest";
import { openDatabase } from "../src/lib/store/db";
import { Repository } from "../src/lib/store/repository";

interface Args {
  since: string | null;
  repo: string | null;
  list: boolean;
  limit: number | undefined;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { since: null, repo: null, list: false, limit: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "--since":
        args.since = argv[(i += 1)] ?? null;
        break;
      case "--repo":
        args.repo = argv[(i += 1)] ?? null;
        break;
      case "--limit":
        args.limit = Number(argv[(i += 1)]);
        break;
      case "--list":
        args.list = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig();
  const repo: RepoRef = args.repo ? parseRepo(args.repo) : config.repo;
  const slug = repoSlug(repo);

  const db = openDatabase(config.dbPath);
  const repository = new Repository(db);

  try {
    if (args.list) {
      const prs = repository.listPullRequests(slug, { limit: args.limit });
      console.log(`Stored merged PRs for ${slug}: ${prs.length}`);
      for (const pr of prs) {
        const labels = pr.labels.length ? ` [${pr.labels.join(", ")}]` : "";
        console.log(
          `  #${pr.number} ${pr.title} — @${pr.author ?? "unknown"} merged ${pr.mergedAt}${labels}`,
        );
      }
      return;
    }

    const client = new GitHubClient({ token: config.token });
    console.log(
      `Ingesting ${slug}${args.since ? ` since ${args.since}` : ""}...`,
    );
    const result = await ingest(client, repository, repo, {
      since: args.since,
    });
    console.log(
      `Done. Stored ${result.pullRequests} merged PR(s) and ${result.commits} commit(s).` +
        (result.lastPrMergedAt
          ? ` Latest merge: ${result.lastPrMergedAt}.`
          : ""),
    );
  } finally {
    db.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
