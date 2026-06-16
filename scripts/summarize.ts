/**
 * Cadence changelog summarization CLI (Phase 2).
 *
 *   npm run summarize -- --since 2026-06-01            # draft for merges since a date
 *   npm run summarize -- --since 2026-06-01 --until 2026-06-16
 *   npm run summarize -- --since 2026-06-01 --out draft.md --json
 *   npm run summarize -- --since 2026-06-01 --dry-run  # print the prompt, no API call
 *
 * Reads merged PRs ingested in Phase 1 (see `npm run ingest`) and turns them
 * into a grouped, editable changelog draft via the Anthropic API.
 *
 * Config (see .env.example):
 *   GITHUB_REPO=owner/repo      which repo's PRs to summarize (or --repo)
 *   ANTHROPIC_API_KEY=sk-ant-…  required unless --dry-run
 *   ANTHROPIC_MODEL=…           optional model override (default: Sonnet 4.6)
 *   CADENCE_DB_PATH=data/cadence.db
 */
import { writeFileSync } from "node:fs";

import { loadConfig, parseRepo, type RepoRef } from "../src/lib/config";
import { AnthropicModelClient } from "../src/lib/changelog/anthropic";
import { buildPrompt } from "../src/lib/changelog/prompt";
import { renderMarkdown } from "../src/lib/changelog/render";
import { summarizeChangelog } from "../src/lib/changelog/summarize";
import type { DateRange } from "../src/lib/changelog/types";
import { repoSlug } from "../src/lib/ingest";
import { openDatabase } from "../src/lib/store/db";
import { Repository } from "../src/lib/store/repository";

interface Args {
  since: string | null;
  until: string | null;
  repo: string | null;
  out: string | null;
  json: boolean;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    since: null,
    until: null,
    repo: null,
    out: null,
    json: false,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "--since":
        args.since = argv[(i += 1)] ?? null;
        break;
      case "--until":
        args.until = argv[(i += 1)] ?? null;
        break;
      case "--repo":
        args.repo = argv[(i += 1)] ?? null;
        break;
      case "--out":
        args.out = argv[(i += 1)] ?? null;
        break;
      case "--json":
        args.json = true;
        break;
      case "--dry-run":
        args.dryRun = true;
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
  const range: DateRange = { since: args.since, until: args.until };

  const db = openDatabase(config.dbPath);
  const repository = new Repository(db);

  try {
    let prs = repository.listPullRequests(slug, { since: args.since });
    if (args.until) {
      prs = prs.filter((pr) => pr.mergedAt < args.until!);
    }
    console.error(`Found ${prs.length} merged PR(s) for ${slug} in range.`);

    if (args.dryRun) {
      const { system, user } = buildPrompt(prs, range);
      console.log(`--- SYSTEM ---\n${system}\n\n--- USER ---\n${user}`);
      return;
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Set it (see .env.example) or use --dry-run.",
      );
    }

    const client = new AnthropicModelClient({
      apiKey,
      model: process.env.ANTHROPIC_MODEL,
    });
    const draft = await summarizeChangelog(prs, range, client);
    const markdown = renderMarkdown(draft);

    if (args.out) {
      writeFileSync(args.out, `${markdown}\n`);
      console.error(`Wrote ${args.out}`);
      if (args.json) {
        const jsonPath = args.out.replace(/\.md$/, "") + ".json";
        writeFileSync(jsonPath, `${JSON.stringify(draft, null, 2)}\n`);
        console.error(`Wrote ${jsonPath}`);
      }
    } else {
      console.log(markdown);
    }
  } finally {
    db.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
