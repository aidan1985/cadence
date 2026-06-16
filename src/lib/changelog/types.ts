// Shapes for the changelog summarization pipeline. A "draft" is the editable
// artifact Phase 2 produces from merged PRs; Phase 3 (publish) consumes it.

/** The three customer-facing buckets we group changes into. */
export const CHANGELOG_CATEGORIES = [
  "Features",
  "Fixes",
  "Improvements",
] as const;

export type ChangelogCategory = (typeof CHANGELOG_CATEGORIES)[number];

/** A half-open date range [since, until) in ISO-8601. `until` may be null (open). */
export interface DateRange {
  since: string | null;
  until: string | null;
}

/** One customer-facing changelog line, traceable back to the PRs behind it. */
export interface ChangelogItem {
  /** One-line, benefit-oriented summary in plain language. */
  summary: string;
  /** Optional longer description; empty string when none. */
  details: string;
  /** PR numbers backing this item, for editor traceability. */
  prs: number[];
}

/** A category heading and the items under it. */
export interface ChangelogSection {
  category: ChangelogCategory;
  items: ChangelogItem[];
}

/**
 * The model's raw structured output: just the grouped sections. Everything
 * else on a draft (range, counts, timestamp) is assembled deterministically.
 */
export interface GroupedChangelog {
  sections: ChangelogSection[];
}

/** The full editable draft for a date range. */
export interface ChangelogDraft {
  range: DateRange;
  sections: ChangelogSection[];
  /** How many merged PRs went into this draft. */
  prCount: number;
  /** ISO-8601 timestamp the draft was generated. */
  generatedAt: string;
}
