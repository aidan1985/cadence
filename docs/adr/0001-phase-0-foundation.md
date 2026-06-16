# ADR 0001 — Phase 0 foundation: stack, hosting, and spend boundaries

- **Status:** Accepted
- **Phase:** P0 — Foundation (CON-2)

## Context

Cadence ingests merged GitHub pull requests and uses the Claude API to draft
human-quality changelog entries. Phase 0 only needs a working repo, green CI,
and a live public skeleton — but the foundational calls made here constrain
every later phase, so they are worth recording.

The guiding product principles are: ship the smallest end-to-end thing first,
keep infrastructure cheap (free tier), and keep paid API spend bounded and
opt-in.

## Decisions

### 1. Next.js (App Router) + TypeScript

A single TypeScript codebase covers both the marketing/app frontend and, later,
the server routes that will drive ingest and AI generation. This avoids a
front/back split before we need one. React 19 + Tailwind v4 are the current
defaults from the scaffold.

### 2. Host on GitHub Pages via static export (`output: "export"`)

GitHub Pages is genuinely free, needs no third-party account or credential, and
deploys entirely from a GitHub Actions workflow we already control. For a
hello-world skeleton this is the fastest path to a live, public URL:
<https://aidan1985.github.io/cadence/>.

**Trade-off:** a static export has no server runtime, so the future ingest and
AI-generation features cannot run on Pages. When Phase 1+ needs server
execution we will migrate hosting to a server-capable free tier (e.g. a small
container/serverless host) and drop `output: "export"`. Until then we pay
nothing and keep a live URL.

Because Pages serves the project from a subpath (`/cadence/`), the deploy
workflow sets `PAGES_BASE_PATH=/cadence` and `next.config.ts` reads it into
`basePath`. Locally the variable is unset, so `next dev` runs at the root.
`trailingSlash: true` and `images.unoptimized` make directory-style URLs and
images resolve correctly on a static host.

### 3. Pin Node 24 in CI and deploy

The data layer (Phase 1) uses the built-in `node:sqlite` module, which is only
available unflagged on Node >= 23.4. Pinning Node 24 in both workflows keeps
local, CI, and deploy environments consistent and avoids a separate SQLite
dependency.

### 4. CI gates: lint + typecheck + format check + test + build

`.github/workflows/ci.yml` runs all five on every push to `main` and every PR.
Keeping the build in CI catches static-export breakage before it reaches the
deploy workflow. Tests run on Vitest (Node environment) with no real network or
API calls.

### 5. Injectable model client + `--dry-run`; live spend is board-gated

Live Claude API calls cost money and require CEO/board approval. The
summarization pipeline depends on a `ModelClient` interface, and the
`AnthropicModelClient` implementation is only constructed for live runs. A
`--dry-run` mode exercises the entire pipeline (prompt building, schema, render)
with a fake client, so the whole product is buildable and testable with **zero**
API spend. The first live run waits on an approved budget.

No secrets are committed; configuration is read from environment variables with
a committed `.env.example` documenting the keys.

## Consequences

- A live, free, public skeleton exists today with green CI and zero recurring
  cost.
- Migrating off static export is a known, bounded follow-up once server-side
  features land — tracked when Phase 1 ingest needs a runtime.
- All AI spend stays behind an interface and an approval gate, so CI and local
  development never incur cost.
