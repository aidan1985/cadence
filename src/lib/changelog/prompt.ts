import type { PullRequest } from "../github/types";
import { CHANGELOG_CATEGORIES, type DateRange } from "./types";

// Keep per-PR text bounded so token cost stays predictable regardless of how
// verbose a PR description is. ~500 chars ≈ a short paragraph.
const MAX_BODY_CHARS = 500;

export interface BuiltPrompt {
  system: string;
  user: string;
}

const SYSTEM = `You are a technical writer producing a customer-facing changelog from a list of merged pull requests.

Group every user-relevant change into exactly these categories: ${CHANGELOG_CATEGORIES.join(", ")}.
- Features: new capabilities a user can now do.
- Fixes: bugs that are now resolved.
- Improvements: enhancements to existing behavior (performance, UX, clarity).

Rules:
- Write for end users, not engineers. Lead with the benefit. No internal jargon, file names, or implementation detail.
- Omit purely internal changes that do not affect users (CI, build tooling, refactors, test-only changes, dependency bumps) unless they have a user-visible effect.
- Merge duplicate or closely related PRs into a single item and list all their PR numbers.
- Only include a category if it has at least one item; omit empty categories.
- Each item must reference the PR number(s) it came from.
- Keep summaries to one clear sentence. Use details only when a summary needs more context; otherwise leave details empty.`;

/** Truncate to a budget, marking elision so the model knows text was cut. */
function clip(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max)}…`;
}

/** Render one PR as a compact block for the model to read. */
function renderPr(pr: PullRequest): string {
  const lines = [`PR #${pr.number}: ${pr.title}`];
  if (pr.labels.length > 0) {
    lines.push(`Labels: ${pr.labels.join(", ")}`);
  }
  const body = pr.body ? clip(pr.body, MAX_BODY_CHARS) : "";
  if (body) {
    lines.push(`Description: ${body}`);
  }
  return lines.join("\n");
}

function rangeLabel(range: DateRange): string {
  const since = range.since ?? "the beginning";
  const until = range.until ?? "now";
  return `${since} to ${until}`;
}

/**
 * Build the system + user prompt for summarizing a set of merged PRs into a
 * grouped changelog. Pure and deterministic so it can be unit-tested and so
 * the prompt prefix stays cacheable across runs.
 */
export function buildPrompt(prs: PullRequest[], range: DateRange): BuiltPrompt {
  const body = prs.map(renderPr).join("\n\n");
  const user = `Here are the ${prs.length} pull request(s) merged in the period ${rangeLabel(
    range,
  )}. Produce the grouped changelog.\n\n${body}`;
  return { system: SYSTEM, user };
}
