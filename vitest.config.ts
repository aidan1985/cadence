import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Backend ingest code runs under Node, not jsdom.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
