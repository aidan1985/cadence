import { describe, expect, it } from "vitest";

import { renderMarkdown } from "./render";
import type { ChangelogDraft } from "./types";

const BASE: ChangelogDraft = {
  range: { since: "2026-06-01", until: "2026-06-16" },
  sections: [],
  prCount: 0,
  generatedAt: "2026-06-16T12:00:00Z",
};

describe("renderMarkdown", () => {
  it("renders a heading with the date range", () => {
    const md = renderMarkdown(BASE);
    expect(md).toContain("# Changelog — 2026-06-01 → 2026-06-16");
  });

  it("renders a placeholder when there are no sections", () => {
    expect(renderMarkdown(BASE)).toContain("_No user-facing changes");
  });

  it("renders sections, items, PR references, and details", () => {
    const md = renderMarkdown({
      ...BASE,
      prCount: 2,
      sections: [
        {
          category: "Features",
          items: [
            {
              summary: "Dark mode is here",
              details: "Toggle it in settings.",
              prs: [12, 13],
            },
          ],
        },
        {
          category: "Fixes",
          items: [{ summary: "Login no longer fails", details: "", prs: [20] }],
        },
      ],
    });

    expect(md).toContain("## 🚀 Features");
    expect(md).toContain("- Dark mode is here (#12, #13)");
    expect(md).toContain("  Toggle it in settings.");
    expect(md).toContain("## 🐛 Fixes");
    expect(md).toContain("- Login no longer fails (#20)");
  });

  it("omits PR references when an item has no PRs", () => {
    const md = renderMarkdown({
      ...BASE,
      sections: [
        {
          category: "Improvements",
          items: [{ summary: "Polished the UI", details: "", prs: [] }],
        },
      ],
    });
    expect(md).toContain("- Polished the UI");
    expect(md).not.toContain("()");
    expect(md).not.toContain("(#");
  });

  it("labels an open-ended range as all changes", () => {
    const md = renderMarkdown({ ...BASE, range: { since: null, until: null } });
    expect(md).toContain("# Changelog — All changes");
  });
});
