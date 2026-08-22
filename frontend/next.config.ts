import type { NextConfig } from "next";

/**
 * The Crew M engine (Python/FastAPI) is deployed as its own Vercel project,
 * because the two halves want different build shapes: this app builds natively
 * with Root Directory set to frontend/, while the engine is a Python function
 * that needs backend/ from the repo root in its bundle. Fighting one project
 * into serving both is what produced a silently 404ing deploy.
 *
 * The browser never learns that second origin. Requests go to /api/engine on
 * this host and are rewritten server-side, so there is no CORS surface and no
 * cross-origin fetch of Plum aggregates from the client.
 *
 * ENGINE_ORIGIN overrides the target (preview engines, local uvicorn). The
 * default is the production engine alias, which is a public hostname rather
 * than a credential, so it is safe in source.
 */
const ENGINE_ORIGIN =
  process.env.ENGINE_ORIGIN ?? "https://iw-crew-m-engine.vercel.app";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // /api/engine/api/health  ->  ENGINE_ORIGIN/api/health
      { source: "/api/engine/:path*", destination: `${ENGINE_ORIGIN}/:path*` },
    ];
  },
};

export default nextConfig;
