"use client";

import { Mic, MicOff, Settings2, X } from "lucide-react";
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

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  0?: SpeechRecognitionAlternativeLike;
  isFinal?: boolean;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  error?: string;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives?: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onaudiostart: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onnomatch: (() => void) | null;
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

function recognitionError(error: string | undefined): string {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone permission is blocked.";
    case "audio-capture":
      return "FoodLink cannot access a microphone. Check that your microphone is connected and enabled.";
    case "no-speech":
      return "I did not hear any speech. Try again and speak a little closer to the microphone.";
    case "network":
      return "The browser speech service could not connect. Check your internet connection and try again.";
    case "aborted":
      return "";
    default:
      return "I could not convert that speech to text. Please try again.";
  }
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
  const [message, setMessage] = useState<string | null>(null);
  const [showPermissionHelp, setShowPermissionHelp] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const heardResultRef = useRef(false);

  useEffect(() => {
    setSupported(recognitionConstructor() !== null);
    return () => recognitionRef.current?.abort();
  }, []);

  async function requestMicrophone(): Promise<boolean> {
    if (!navigator.mediaDevices?.getUserMedia) return true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      for (const track of stream.getTracks()) track.stop();
      setShowPermissionHelp(false);
      return true;
    } catch {
      setMessage("Microphone permission is blocked.");
      setShowPermissionHelp(true);
      return false;
    }
  }

  async function toggle() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const Recognition = recognitionConstructor();
    if (!Recognition) {
      setSupported(false);
      setMessage(unavailableLabel);
      return;
    }

    setMessage(null);
    heardResultRef.current = false;

    const allowed = await requestMicrophone();
    if (!allowed) return;

    const recognition = new Recognition();
    recognition.lang = SPEECH_LOCALES[lang];
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
      setMessage(listeningLabel);
    };
    recognition.onaudiostart = () => {
      setMessage("Microphone connected — listening for your voice…");
    };
    recognition.onspeechstart = () => {
      setMessage("I can hear you — keep speaking…");
    };
    recognition.onspeechend = () => {
      setMessage("Converting your speech to text…");
    };
    recognition.onresult = (event) => {
      const pieces: string[] = [];
      for (let i = 0; i < event.results.length; i += 1) {
        const text = event.results[i]?.[0]?.transcript?.trim();
        if (text) pieces.push(text);
      }
      const transcript = pieces.join(" ").trim();
      if (transcript) {
        heardResultRef.current = true;
        onTranscript(transcript);
        setMessage("Voice added to the text box.");
      }
    };
    recognition.onnomatch = () => {
      setMessage("I heard audio but could not understand the words. Please try again.");
    };
    recognition.onerror = (event) => {
      const friendly = recognitionError(event.error);
      setListening(false);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setShowPermissionHelp(true);
      }
      if (friendly) setMessage(friendly);
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      if (!heardResultRef.current) {
        setMessage((current) =>
          current && current !== listeningLabel
            ? current
            : "No words were captured. Tap the microphone and try again.",
        );
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setListening(false);
      recognitionRef.current = null;
      setMessage("The microphone could not start. Please try again.");
    }
  }

  return (
    <span className="relative inline-flex shrink-0 items-center">
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={!supported}
        aria-pressed={listening}
        aria-label={!supported ? unavailableLabel : listening ? listeningLabel : label}
        title={!supported ? unavailableLabel : listening ? listeningLabel : label}
        className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-full transition ${
          listening
            ? "bg-danger text-white shadow-card"
            : supported
              ? "bg-mint text-forest hover:-translate-y-0.5 hover:shadow-card"
              : "text-muted opacity-45"
        }`}
      >
        {listening && <span className="absolute inset-0 animate-ping rounded-full bg-danger/25" aria-hidden />}
        {supported ? <Mic className="relative h-4 w-4" aria-hidden /> : <MicOff className="h-4 w-4" aria-hidden />}
      </button>

      {message && !showPermissionHelp && (
        <span
          role="status"
          className="absolute bottom-full end-0 z-30 mb-2 w-64 rounded-xl border border-line bg-paper px-3 py-2 text-xs leading-relaxed text-body shadow-card"
        >
          {message}
        </span>
      )}

      {showPermissionHelp && (
        <div
          role="dialog"
          aria-label="Enable microphone"
          className="absolute bottom-full end-0 z-40 mb-2 w-[min(330px,calc(100vw-2rem))] rounded-2xl border border-line bg-paper p-4 text-start shadow-xl"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-mint text-forest">
                <Settings2 className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <p className="font-display text-sm font-semibold text-ink">Enable microphone</p>
                <p className="text-[11px] text-muted">FoodLink needs browser permission to hear you.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowPermissionHelp(false)}
              aria-label="Close microphone help"
              className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-cream"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <div className="mt-3 rounded-xl bg-cream px-3 py-3 text-xs leading-relaxed text-body">
            <p className="font-bold text-ink">On Chrome or Edge:</p>
            <p className="mt-1">
              Click the site-controls or lock icon beside the address bar → Microphone → Allow. Then return to FoodLink and try again.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void toggle()}
            className="mt-3 min-h-10 w-full rounded-full bg-forest px-4 text-xs font-bold text-white transition hover:bg-forest-dark"
          >
            Try microphone again
          </button>
        </div>
      )}
    </span>
  );
}
