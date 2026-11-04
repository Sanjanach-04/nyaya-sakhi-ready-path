import * as React from "react";
import { api } from "@/lib/api";

/**
 * Speech input (Web Speech API) and read-aloud output.
 *
 * Read-aloud order: backend TTS (/api/speech/tts) when configured, otherwise
 * the browser's built-in speechSynthesis. When neither works the caller gets a
 * clear setup message — never a silent failure.
 */

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeechRecognition(lang: string) {
  const [listening, setListening] = React.useState(false);
  const [transcript, setTranscript] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null);

  const supported = !!getRecognitionCtor();

  const stop = React.useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const start = React.useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognitionRef.current = recognition;
    recognition.lang = lang === "hi" ? "hi-IN" : lang === "kn" ? "kn-IN" : "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const parts: string[] = [];
      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (!result) continue;
        for (let j = 0; j < result.length; j += 1) {
          const alt = result[j];
          if (alt?.transcript) parts.push(alt.transcript);
        }
      }
      const text = parts.join(" ").trim();
      setTranscript(text);
    };
    recognition.onerror = () => {
      setError("Voice input failed. Please try again or type your question.");
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    setError(null);
    setTranscript("");
    setListening(true);
    try {
      recognition.start();
    } catch {
      setListening(false);
    }
  }, [lang]);

  React.useEffect(
    () => () => {
      recognitionRef.current?.stop();
    },
    [],
  );

  return { supported, listening, transcript, error, start, stop, clearError: () => setError(null) };
}

export type SpeakResult = "played" | "browser" | "unavailable";

export async function speakText(text: string, lang: string): Promise<SpeakResult> {
  // 1. Backend TTS when configured.
  try {
    const res = await api.speech.tts({ text, language: lang });
    const bytes = Uint8Array.from(atob(res.audio_base64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: res.media_type || "audio/mpeg" });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    await audio.play();
    return "played";
  } catch {
    // fall through to browser voice
  }

  // 2. Browser speechSynthesis.
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === "hi" ? "hi-IN" : lang === "kn" ? "kn-IN" : "en-IN";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    return "browser";
  }

  return "unavailable";
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  // Pause any playing <audio> produced by speakText is handled by navigation;
  // browsers stop audio when the element is garbage collected.
}
