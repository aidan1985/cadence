export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <div className="flex flex-col items-center gap-6">
        <span className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium uppercase tracking-widest text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          Coming soon
        </span>

        <h1 className="bg-gradient-to-br from-zinc-900 to-zinc-500 bg-clip-text text-5xl font-semibold tracking-tight text-transparent dark:from-white dark:to-zinc-400 sm:text-6xl">
          Cadence
        </h1>

        <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          The AI changelog generator for software teams. Cadence turns your
          merged pull requests into a polished, ready-to-publish changelog —
          automatically.
        </p>

        <p className="text-sm text-zinc-400 dark:text-zinc-600">
          Phase 0 — foundation deployed. Building in the open.
        </p>
      </div>
    </main>
  );
}
