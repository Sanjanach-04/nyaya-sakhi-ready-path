"""Translation service (optional). Translates ONLY the explanation text;
Act and Section references stay in their original form.

Providers: libretranslate | llm | none (unconfigured → returns original).
"""
from __future__ import annotations

import httpx

from app.core.config import settings

LANGUAGE_NAMES = {"en": "English", "hi": "Hindi", "kn": "Kannada"}


class TranslationNotConfigured(Exception):
    pass


def _protect_references(text: str) -> tuple[str, dict[str, str]]:
    """Replace Act/Section references with placeholders so they survive MT."""
    import re

    tokens: dict[str, str] = {}

    def sub(pattern: str, repl_prefix: str) -> str:
        def _repl(m: re.Match) -> str:
            key = f"§REF{len(tokens)}§"
            tokens[key] = m.group(0)
            return key

        return re.sub(pattern, _repl, text)

    text = sub(r"[A-Z][A-Za-z ,&-]{3,80}?(?:Act|Code|Rules|Amendment),?\s*\d{0,4}", "act")
    text = sub(r"[Ss]ection[s]?\s+\d{1,3}[A-Z]?(?:\.\d+)?", "sec")
    return text, tokens


def _restore_references(text: str, tokens: dict[str, str]) -> str:
    for key, value in tokens.items():
        text = text.replace(key, value)
    return text


def translate_text(text: str, target_language: str) -> tuple[str, bool]:
    """Return (translated_text, was_translated). Never translates legal references."""
    if target_language == "en" or not text:
        return text, False
    if settings.TRANSLATION_PROVIDER == "libretranslate" and settings.LIBRETRANSLATE_URL:
        protected, tokens = _protect_references(text)
        with httpx.Client(timeout=60) as client:
            res = client.post(
                f"{settings.LIBRETRANSLATE_URL.rstrip('/')}/translate",
                json={"q": protected, "source": "en", "target": target_language, "format": "text"},
            )
            res.raise_for_status()
            out = res.json().get("translatedText", "")
        return _restore_references(out, tokens), True
    if settings.TRANSLATION_PROVIDER == "llm" and settings.llm_configured:
        from app.services import llm_generation

        with httpx.Client(timeout=90) as client:
            res = client.post(
                f"{settings.LLM_BASE_URL.rstrip('/')}/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.LLM_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.LLM_MODEL,
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "Translate the user's explanation to "
                                f"{LANGUAGE_NAMES.get(target_language, target_language)}. "
                                "Keep any Act names and Section numbers EXACTLY as written "
                                "(they must remain in English legal form). Output only the translation."
                            ),
                        },
                        {"role": "user", "content": text},
                    ],
                    "temperature": 0.1,
                },
            )
            res.raise_for_status()
            out = res.json()["choices"][0]["message"]["content"]
        return out.strip(), True
    # Not configured: return the original text, flagged as untranslated.
    return text, False
