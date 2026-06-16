import type { NextConfig } from "next";

// On GitHub Pages the site is served from a project subpath
// (https://<user>.github.io/cadence/). CI sets PAGES_BASE_PATH=/cadence so
// asset and route URLs are prefixed correctly. Locally it is unset, so the
// app runs at the root for `next dev`.
const basePath = process.env.PAGES_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // Emit a fully static site into `out/` so it can be hosted on GitHub Pages.
  output: "export",
  basePath,
  // Static hosts resolve directory-style URLs (`/route/` -> `/route/index.html`).
  trailingSlash: true,
  // next/image optimization needs a server; disable it for the static export.
  images: { unoptimized: true },
};

export default nextConfig;
