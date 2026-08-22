"""
Vercel entry point for the Crew M engine.

The FastAPI app itself lives in backend/server.py and is unchanged: the same
code serves locally on port 8000 and here as a serverless function, so there is
no second implementation to drift.

Two things this wrapper handles.

1. Import path. Vercel bundles the function with the repo's backend/ directory
   (declared via includeFiles in vercel.json), so backend/ is put on sys.path
   before the app is imported.

2. Path normalisation. The function is served at /api/engine, so a client call
   to /api/engine/api/overview arrives with that full path while the app's
   routes are declared as /api/overview. The ASGI shim strips the mount prefix
   in whichever form it arrives, rather than assuming one. Without this every
   route 404s in production while working perfectly in development, which is
   the worst possible failure shape.
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
