"""Speech (STT/TTS) integration points.

When the corresponding provider is not configured, callers get a 501 with a
setup message pointing at backend/.env.example.
"""
from __future__ import annotations

import base64
import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class SpeechNotConfigured(Exception):
    """Raised when STT/TTS is not configured. Handled as HTTP 501."""

    def __init__(self, which: str) -> None:
        self.which = which
        super().__init__(
            f"{which} is not configured. Set {which.split('_')[0]}_PROVIDER, "
            f"{which.split('_')[0]}_BASE_URL and {which.split('_')[0]}_API_KEY in backend/.env "
            "(see backend/.env.example) and restart the backend."
        )


def speech_to_text_base64(audio: bytes, language: str) -> str:
    if not settings.stt_configured:
        raise SpeechNotConfigured("STT")
    url = f"{settings.STT_BASE_URL.rstrip('/')}/transcriptions"
    with httpx.Client(timeout=120) as client:
        res = client.post(
            url,
            headers={"Authorization": f"Bearer {settings.STT_API_KEY}"},
            files={"file": ("audio.webm", audio, "audio/webm")},
            data={"model": settings.STT_PROVIDER, "language": {"en": "en", "hi": "hi", "kn": "kn"}.get(language, language)},
        )
    if res.status_code >= 400:
        logger.warning("STT provider error: %s %s", res.status_code, res.text[:300])
        raise ValueError(f"Speech-to-text provider error {res.status_code}")
    return res.json().get("text", "")


def text_to_speech(text: str, language: str) -> tuple[bytes, str]:
    if not settings.tts_configured:
        raise SpeechNotConfigured("TTS")
    url = f"{settings.TTS_BASE_URL.rstrip('/')}/speech"
    with httpx.Client(timeout=120) as client:
        res = client.post(
            url,
            headers={"Authorization": f"Bearer {settings.TTS_API_KEY}", "Content-Type": "application/json"},
            json={"input": text, "voice": settings.TTS_PROVIDER, "language": language, "response_format": "mp3"},
        )
    if res.status_code >= 400:
        logger.warning("TTS provider error: %s %s", res.status_code, res.text[:300])
        raise ValueError(f"Text-to-speech provider error {res.status_code}")
    return res.content, "audio/mpeg"
