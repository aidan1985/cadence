import type { ChangelogDraft, ChangelogItem, DateRange } from "./types";

// Emoji prefixes give the rendered draft visual structure while staying plain
// markdown an editor can freely change before publish.
const CATEGORY_HEADINGS: Record<string, string> = {
  Features: "🚀 Features",
  Fixes: "🐛 Fixes",
  Improvements: "✨ Improvements",
};

function formatRange(range: DateRange): string {
  if (!range.since && !range.until) {
    return "All changes";
  }
  const since = range.since ?? "the beginning";
  const until = range.until ?? "now";
  return `${since} → ${until}`;
}

/** "(#12)", "(#12, #34)", or "" when an item has no PR references. */
function prRefs(item: ChangelogItem): string {
  if (item.prs.length === 0) {
    return "";
  }
  return ` (${item.prs.map((n) => `#${n}`).join(", ")})`;
}

/**
 * Render a draft to editable markdown. The output is the human-facing,
 * reviewable form of the changelog — PR references are included for
 * traceability and can be removed before publish.
 */
export function renderMarkdown(draft: ChangelogDraft): string {
  const out: string[] = [`# Changelog — ${formatRange(draft.range)}`];

  if (draft.sections.length === 0) {
    out.push("", "_No user-facing changes in this period._");
    return out.join("\n");
  }

  for (const section of draft.sections) {
    out.push(
      "",
      `## ${CATEGORY_HEADINGS[section.category] ?? section.category}`,
    );
    for (const item of section.items) {
      out.push(`- ${item.summary}${prRefs(item)}`);
      if (item.details.trim()) {
        out.push(`  ${item.details.trim()}`);
      }
    }
  }

  return out.join("\n");
}
