"""
Vercel entry point for the Crew M engine.

The FastAPI app itself lives in backend/server.py and is unchanged: the same
code serves locally on port 8000 and here as a serverless function, so there is
no second implementation to drift.

This file is the whole of the `iw-crew-m-engine` Vercel project, which is
separate from the Next.js project on purpose. See the deployment topology
section of BRIEF.md for why one project cannot host both.

Two things this wrapper handles.

1. Import path. The function is bundled with the repo's backend/ directory
   (declared via includeFiles in vercel.engine.json), so backend/ is put on
   sys.path before the app is imported. This is also why the engine project
   builds from the repo root rather than from frontend/: a project cannot bundle
   files that sit outside its own Root Directory.

2. Path normalisation. vercel.engine.json rewrites every path to this function,
   and a Vercel rewrite preserves the requested path, so a call to /api/overview
   arrives as /api/overview and matches the app's routes directly. The shim
   below strips a leading mount prefix anyway, for the case where the engine is
   ever mounted under one rather than given its own project. Without it every
   route would 404 in production while working perfectly in development, which
   is the worst possible failure shape.
"""

import os
import sys

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_BACKEND = os.path.join(_ROOT, "backend")
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

from server import app as _app  # noqa: E402

# Prefixes the platform may prepend before the app's own /api/... routes.
_PREFIXES = ("/api/engine", "/engine")


def _strip(path: str) -> str:
    for p in _PREFIXES:
        if path == p:
            return "/"
        if path.startswith(p + "/"):
            return path[len(p):] or "/"
    return path


async def app(scope, receive, send):
    """ASGI wrapper that normalises the request path, then delegates."""
    if scope.get("type") in ("http", "websocket"):
        scope = dict(scope)
        original = scope.get("path", "/")
        scope["path"] = _strip(original)
        raw = scope.get("raw_path")
        if raw:
            try:
                scope["raw_path"] = _strip(raw.decode()).encode()
            except Exception:
                # A non-UTF8 raw_path is not worth failing the request over.
                pass
    await _app(scope, receive, send)
