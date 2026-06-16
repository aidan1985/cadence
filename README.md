# Cadence

The AI changelog generator for software teams. Cadence turns merged pull
requests into a polished, ready-to-publish changelog — automatically.

This repository is the Cadence web app. Phase 0 stands up the foundation: the
base app, linting/formatting, CI, and a deployable static skeleton.

## Stack

- **[Next.js 16](https://nextjs.org)** (App Router) + **React 19** + **TypeScript**
- **[Tailwind CSS v4](https://tailwindcss.com)** for styling
- **ESLint** + **Prettier** for linting/formatting
- **GitHub Actions** for CI and deployment
- **GitHub Pages** for hosting (static export)

> The app is currently a static export so it can be hosted free on GitHub Pages.
> Server-side features (GitHub ingest, AI generation) arrive in later phases and
> will move the app to a server-capable host at that point.

## Local development

```bash
npm install
npm run dev      # http://localhost:3000
```

## Scripts

| Script                 | What it does                        |
| ---------------------- | ----------------------------------- |
| `npm run dev`          | Start the dev server                |
| `npm run build`        | Build the static export into `out/` |
| `npm run lint`         | Run ESLint                          |
| `npm run typecheck`    | Type-check with `tsc --noEmit`      |
| `npm run format`       | Format the codebase with Prettier   |
| `npm run format:check` | Verify formatting (used in CI)      |

## CI / Deployment

- **CI** (`.github/workflows/ci.yml`) runs lint, typecheck, format check, and
  build on every push to `main` and on every pull request.
- **Deploy** (`.github/workflows/deploy.yml`) builds the static export and
  publishes it to GitHub Pages on every push to `main`. The production build
  sets `PAGES_BASE_PATH=/cadence` so assets resolve under the project subpath.
