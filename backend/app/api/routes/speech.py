"""Speech routes: STT/TTS. Return 501 with a setup message when unconfigured."""
from __future__ import annotations

import base64

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import JSONResponse

from app.core.security import CurrentUser
from app.services import speech
from app.services.speech import SpeechNotConfigured

router = APIRouter(prefix="/api/speech", tags=["speech"])


def _not_configured(exc: SpeechNotConfigured) -> JSONResponse:
    return JSONResponse(
        status_code=501,
        content={"detail": str(exc)},
        headers={"X-Setup-Required": exc.which},
    )


@router.post("/stt", response_model=None)
async def stt(
    user: CurrentUser,
    file: UploadFile = File(...),
    language: str = Form(default="en"),
) -> JSONResponse | dict:
    try:
        audio = await file.read()
        text = speech.speech_to_text_base64(audio, language)
    except SpeechNotConfigured as exc:
        return _not_configured(exc)
    return {"text": text}


@router.post("/tts", response_model=None)
def tts(payload: dict, user: CurrentUser) -> JSONResponse | dict:
    text = str(payload.get("text", "") or "")
    language = str(payload.get("language", "en") or "en")
    if not text.strip():
        return JSONResponse(status_code=422, content={"detail": "text is required"})
    try:
        audio, mime = speech.text_to_speech(text, language)
    except SpeechNotConfigured as exc:
        return _not_configured(exc)
    return {"audio_base64": base64.b64encode(audio).decode("ascii"), "media_type": mime}
