"""Small in-memory sliding-window rate limiter (per backend process).

Used to protect the LLM key from anonymous abuse of /api/chat/ask. It is not
shared between processes or restarts; for multi-instance deployments put a
shared limiter (e.g. Redis or the platform's edge rate limiting) in front.
"""
from __future__ import annotations

import threading
import time
from collections import deque

from fastapi import HTTPException, Request

from app.core.config import settings


class SlidingWindowLimiter:
    def __init__(self, limit: int, window_seconds: float) -> None:
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def hit(self, key: str, now: float | None = None) -> tuple[bool, int]:
        """Record one request. Returns (allowed, retry_after_seconds)."""
        now = time.monotonic() if now is None else now
        with self._lock:
            q = self._hits.setdefault(key, deque())
            while q and q[0] <= now - self.window:
                q.popleft()
            if len(q) >= self.limit:
                retry = int(q[0] + self.window - now) + 1
                return False, max(retry, 1)
            q.append(now)
            # Opportunistic cleanup so the map does not grow forever.
            if len(self._hits) > 10_000:
                for k in [k for k, v in self._hits.items() if not v]:
                    self._hits.pop(k, None)
            return True, 0

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


guest_chat_limiter = SlidingWindowLimiter(settings.GUEST_CHAT_LIMIT_PER_HOUR, 3600)


def client_ip(request: Request) -> str:
    if settings.TRUST_PROXY_HEADERS:
        fwd = request.headers.get("x-forwarded-for", "")
        if fwd:
            return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def enforce_guest_chat_limit(request: Request) -> None:
    allowed, retry_after = guest_chat_limiter.hit(client_ip(request))
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=(
                "Too many questions from this network. Guests can ask "
                f"{guest_chat_limiter.limit} questions per hour — please wait a while, "
                "or sign in to continue."
            ),
            headers={"Retry-After": str(retry_after)},
        )
