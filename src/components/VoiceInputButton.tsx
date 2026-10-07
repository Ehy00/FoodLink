"use client";

import { Mic, MicOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Lang } from "@/lib/types";

const SPEECH_LOCALES: Record<Lang, string> = {
  en: "en-US",
  es: "es-US",
  fr: "fr-FR",
  pt: "pt-BR",
  ar: "ar-SA",
  zh: "zh-CN",
  hi: "hi-IN",
  bn: "bn-BD",
  ru: "ru-RU",
  sw: "sw-KE",
};

interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface SpeechRecognitionErrorEventLike {
  error?: string;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function recognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function VoiceInputButton({
  lang,
  onTranscript,
  label,
  listeningLabel,
  unavailableLabel,
}: {
  lang: Lang;
  onTranscript: (text: string) => void;
  label: string;
  listeningLabel: string;
  unavailableLabel: string;
}) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSupported(recognitionConstructor() !== null);
    return () => recognitionRef.current?.abort();
  }, []);

  function toggle() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const Recognition = recognitionConstructor();
    if (!Recognition) {
      setSupported(false);
      return;
    }

    const recognition = new Recognition();
    recognition.lang = SPEECH_LOCALES[lang];
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (transcript) onTranscript(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  if (!supported) {
    return (
      <button
        type="button"
        disabled
        title={unavailableLabel}
        aria-label={unavailableLabel}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted opacity-45"
      >
        <MicOff className="h-4.5 w-4.5" aria-hidden />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={listening}
      aria-label={listening ? listeningLabel : label}
      title={listening ? listeningLabel : label}
      className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-full transition ${
        listening ? "bg-danger text-white shadow-card" : "bg-mint text-forest hover:-translate-y-0.5 hover:shadow-card"
      }`}
    >
      {listening && <span className="absolute inset-0 animate-ping rounded-full bg-danger/25" aria-hidden />}
      <Mic className="relative h-4.5 w-4.5" aria-hidden />
    </button>
  );
}
