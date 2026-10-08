/** Real speech-to-text through the browser's Web Speech API, when the page is allowed a microphone. */

interface RecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type RecognitionCtor = new () => Recognition;

const ctor = (): RecognitionCtor | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

let blocked = false;

/** False once the browser or the page's frame has refused the microphone. */
export function canListen(): boolean {
  return !blocked && !!ctor();
}

export interface ListenHandlers {
  onInterim(text: string): void;
  onFinal(text: string): void;
  /** `blocked` = the microphone is unavailable here; fall back to demo voice. */
  onError(kind: "blocked" | "no-speech" | "other"): void;
  onEnd(): void;
}

/** Starts one utterance of listening. Returns a function that stops it. */
export function listen(h: ListenHandlers): () => void {
  const C = ctor();
  if (!C) {
    h.onError("blocked");
    return () => {};
  }
  const r = new C();
  r.lang = navigator.language || "en-US";
  r.interimResults = true;
  r.continuous = false;
  let finalText = "";
  r.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      if (res.isFinal) finalText += res[0].transcript;
      else interim += res[0].transcript;
    }
    h.onInterim((finalText + interim).trim());
  };
  r.onerror = (e) => {
    if (["not-allowed", "service-not-allowed", "audio-capture"].includes(e.error)) {
      blocked = true;
      h.onError("blocked");
    } else if (e.error === "no-speech") h.onError("no-speech");
    else if (e.error !== "aborted") h.onError("other");
  };
  r.onend = () => {
    if (finalText.trim()) h.onFinal(finalText.trim());
    h.onEnd();
  };
  try {
    r.start();
  } catch {
    blocked = true;
    h.onError("blocked");
  }
  return () => r.stop();
}
