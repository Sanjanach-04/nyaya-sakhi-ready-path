"""Structured logging setup."""
from __future__ import annotations

import logging
import sys

from app.core.config import settings


def configure_logging() -> None:
    level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)s [%(name)s] %(message)s")
    )
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level)
    # Quieten noisy libraries
    for name in ("httpx", "httpcore", "sqlalchemy.engine", "sentence_transformers", "urllib3"):
        logging.getLogger(name).setLevel(max(level, logging.WARNING))
