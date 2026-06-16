import type { PullRequest } from "../github/types";
import { buildPrompt, type BuiltPrompt } from "./prompt";
import {
  CHANGELOG_CATEGORIES,
  type ChangelogCategory,
  type ChangelogDraft,
  type ChangelogSection,
  type DateRange,
  type GroupedChangelog,
} from "./types";

/**
 * The one capability the pipeline needs from "the LLM": turn a built prompt
 * into grouped sections. Implemented for real by the Anthropic client and
 * faked in tests, so the pipeline can be verified end-to-end without spend.
 */
export interface ModelClient {
  summarize(prompt: BuiltPrompt): Promise<GroupedChangelog>;
}

export interface SummarizeOptions {
  /** Injectable timestamp for the draft; defaults to now. */
  now?: string;
}

const CATEGORY_ORDER = new Map<ChangelogCategory, number>(
  CHANGELOG_CATEGORIES.map((category, index) => [category, index]),
);

/** Drop empty sections and put them in a stable Features → Fixes → Improvements order. */
function normalizeSections(sections: ChangelogSection[]): ChangelogSection[] {
  return sections
    .filter(
      (section) =>
        CATEGORY_ORDER.has(section.category) && section.items.length > 0,
    )
    .sort(
      (a, b) =>
        CATEGORY_ORDER.get(a.category)! - CATEGORY_ORDER.get(b.category)!,
    );
}

/**
 * Turn merged PRs into an editable, grouped changelog draft for a date range.
 * Empty input short-circuits without calling the model (no spend, no draft of
 * hallucinated content).
 */
export async function summarizeChangelog(
  prs: PullRequest[],
  range: DateRange,
  client: ModelClient,
  options: SummarizeOptions = {},
): Promise<ChangelogDraft> {
  const generatedAt = options.now ?? new Date().toISOString();
  if (prs.length === 0) {
    return { range, sections: [], prCount: 0, generatedAt };
  }

  const grouped = await client.summarize(buildPrompt(prs, range));
  return {
    range,
    sections: normalizeSections(grouped.sections),
    prCount: prs.length,
    generatedAt,
  };
}
