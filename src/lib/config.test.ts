import { describe, expect, it } from "vitest";

import { DEFAULT_DB_PATH, loadConfig, parseRepo } from "./config";

describe("parseRepo", () => {
  it("splits owner/repo", () => {
    expect(parseRepo("vercel/next.js")).toEqual({
      owner: "vercel",
      repo: "next.js",
    });
  });

  it("rejects malformed slugs", () => {
    expect(() => parseRepo("noslash")).toThrow(/owner\/repo/);
    expect(() => parseRepo("too/many/parts")).toThrow();
    expect(() => parseRepo("")).toThrow();
  });
});

describe("loadConfig", () => {
  it("reads repo, token, and db path from env", () => {
    const config = loadConfig({
      GITHUB_REPO: "acme/widget",
      GITHUB_TOKEN: "secret",
      CADENCE_DB_PATH: "/tmp/x.db",
    });
    expect(config).toEqual({
      repo: { owner: "acme", repo: "widget" },
      token: "secret",
      dbPath: "/tmp/x.db",
    });
  });

  it("defaults token to null and uses the default db path", () => {
    const config = loadConfig({ GITHUB_REPO: "acme/widget" });
    expect(config.token).toBeNull();
    expect(config.dbPath).toBe(DEFAULT_DB_PATH);
  });

  it("throws when GITHUB_REPO is missing", () => {
    expect(() => loadConfig({})).toThrow(/GITHUB_REPO/);
  });
});
