import { useContext } from "../state/contextStore";
import { useConversation } from "../state/conversationStore";

/** Strips markdown-ish symbols so the voice reads naturally. */
export function speakable(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/^\s*(?:[-•*]|\d+[.)])\s+/gm, "")
    .replace(/[*_`#>|]/g, "")
    .replace(/\s*\n+\s*/g, ". ")
    .replace(/\s+([.,!?])/g, "$1")
    .replace(/([.!?])\.(\s|$)/g, "$1$2")
    .trim();
}

const synth = (): SpeechSynthesis | null => (typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null);

let chosen: SpeechSynthesisVoice | null = null;
function pickVoice(): SpeechSynthesisVoice | null {
  const s = synth();
  if (!s) return null;
  if (chosen) return chosen;
  const voices = s.getVoices().filter((v) => v.lang.toLowerCase().startsWith("en"));
  const prefer = [/natural/i, /google us english/i, /samantha/i, /aria/i, /jenny/i, /zira/i];
  chosen = prefer.map((re) => voices.find((v) => re.test(v.name))).find(Boolean) ?? voices[0] ?? null;
  return chosen;
}
if (synth()) synth()!.onvoiceschanged = () => (chosen = null);

let pending = 0;
let afterSpeech: (() => void) | null = null;

/** Called once the queue of spoken replies finishes (used for hands-free listening). */
export function onSpeechDone(fn: (() => void) | null) {
  afterSpeech = fn;
}

export function canSpeak(): boolean {
  return !!synth() && typeof SpeechSynthesisUtterance !== "undefined";
}

/** Speak a reply if voice replies are on. Pitch varies a little per speaker. */
export function speak(text: string, speaker = "core"): void {
  const s = synth();
  if (!s || !canSpeak() || !useContext.getState().voiceReplies) return;
  const line = speakable(text);
  if (!line) return;
  const u = new SpeechSynthesisUtterance(line);
  const v = pickVoice();
  if (v) u.voice = v;
  u.rate = 1.04;
  u.pitch = { core: 1, builder: 0.85, marketer: 1.15, counsel: 0.9, scout: 1.05, community: 1.1 }[speaker] ?? 1;
  pending += 1;
  u.onstart = () => useConversation.getState().setVoice("speaking");
  const done = () => {
    pending = Math.max(0, pending - 1);
    if (pending === 0) {
      if (useConversation.getState().voice === "speaking") useConversation.getState().setVoice("idle");
      afterSpeech?.();
    }
  };
  u.onend = done;
  u.onerror = done;
  s.speak(u);
}

export function stopSpeaking(): void {
  const s = synth();
  pending = 0;
  s?.cancel();
}

export function isSpeaking(): boolean {
  return pending > 0;
}
