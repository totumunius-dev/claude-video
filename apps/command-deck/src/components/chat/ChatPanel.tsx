import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { handleUserMessage } from "../../core/conductor";
import { notify } from "../../core/events";
import { useContext } from "../../state/contextStore";
import { canListen, listen } from "../../voice/listen";
import { canSpeak, onSpeechDone, stopSpeaking } from "../../voice/speech";
import { DEMO_COMMANDS } from "../../core/intents";
import { useCompanions } from "../../state/companionStore";
import { useConversation } from "../../state/conversationStore";
import { useUI } from "../../state/uiStore";
import type { ChatMessage } from "../../types/models";
import { Avatar, fmtTime } from "../ui";
import { CardView } from "./Cards";
import { CompanionProfile } from "./CompanionProfile";

const CHAT_TABS = ["builder", "marketer", "community", "counsel", "scout"];

function Message({ m }: { m: ChatMessage }) {
  if (m.author === "user") {
    return (
      <div className="msg me">
        {m.text}
        <time>{fmtTime(m.at)}</time>
      </div>
    );
  }
  return (
    <div className="row-bot">
      <Avatar id={m.author} />
      <div className="body">
        <div className="msg bot">
          {m.text}
          <time>{fmtTime(m.at)}</time>
        </div>
        {m.card && <CardView card={m.card} />}
      </div>
    </div>
  );
}

export function ChatPanel() {
  const thread = useUI((s) => s.activeThread);
  const setThread = useUI((s) => s.setThread);
  const companions = useCompanions((s) => s.companions);
  const messages = useConversation((s) => s.messages);
  const pending = useConversation((s) => !!s.pending[thread]);
  const voice = useConversation((s) => s.voice);
  const setVoice = useConversation((s) => s.setVoice);
  const [text, setText] = useState("");
  const [menu, setMenu] = useState(false);
  const voiceReplies = useContext((s) => s.voiceReplies);
  const handsFree = useContext((s) => s.handsFree);
  const setVoicePrefs = useContext((s) => s.setVoicePrefs);
  const scroller = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const stopListening = useRef<(() => void) | null>(null);
  const threadRef = useRef(thread);
  threadRef.current = thread;

  const tabs = ["core", ...CHAT_TABS.filter((id) => companions.some((c) => c.id === id)), ...companions.filter((c) => !CHAT_TABS.includes(c.id)).map((c) => c.id)];
  const current = companions.find((c) => c.id === thread);
  const list = messages.filter((m) => m.thread === thread);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [list.length, pending, thread]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const send = useCallback((value: string) => {
    const v = value.trim();
    if (!v) return;
    setText("");
    setMenu(false);
    void handleUserMessage(v, threadRef.current);
  }, []);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(text);
  };

  /** Demo voice for places without a microphone: "hears" the next demo command. */
  const mockListen = useCallback(() => {
    setVoice("listening");
    const said = useConversation.getState().messages.filter((m) => m.author === "user" && m.thread === "core").length;
    const phrase = threadRef.current === "core" ? DEMO_COMMANDS[said % DEMO_COMMANDS.length] : "What should we focus on this week?";
    timers.current = [
      window.setTimeout(() => setVoice("transcribing"), 1600),
      window.setTimeout(() => {
        timers.current = [];
        setVoice("idle");
        send(phrase);
      }, 2500),
    ];
  }, [send, setVoice]);

  const startListening = useCallback(() => {
    stopSpeaking();
    if (!canListen()) return mockListen();
    setVoice("listening");
    stopListening.current = listen({
      onInterim: (t) => {
        setText(t);
        if (t) setVoice("transcribing");
      },
      onFinal: (t) => {
        setVoice("idle");
        send(t);
      },
      onError: (kind) => {
        if (kind === "blocked") {
          notify("The microphone isn't available here, so I'm using demo voice. Run the app on your computer in Chrome to talk for real.", "warn");
          mockListen();
        } else if (kind === "no-speech") notify("I didn't hear anything. Tap the mic and try again.", "warn");
      },
      onEnd: () => {
        stopListening.current = null;
        const v = useConversation.getState().voice;
        if (!timers.current.length && (v === "listening" || v === "transcribing")) setVoice("idle");
      },
    });
  }, [mockListen, send, setVoice]);

  const toggleMic = () => {
    if (voice === "listening" || voice === "transcribing") {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      stopListening.current?.();
      setVoice("idle");
      return;
    }
    startListening();
  };

  // Hands-free: listen again as soon as a spoken reply finishes.
  useEffect(() => {
    onSpeechDone(handsFree && canListen() ? () => window.setTimeout(startListening, 300) : null);
    return () => onSpeechDone(null);
  }, [handsFree, startListening]);

  const placeholder =
    voice === "listening" ? "Listening… (mock)" : voice === "transcribing" ? "Transcribing…" : `You're talking to ${current?.name ?? "Core"} through voice`;

  return (
    <section className="card chat" aria-label="Chat">
      <div className="chat-head">
        <div className="tabs" role="tablist">
          {tabs.map((id) => {
            const c = companions.find((x) => x.id === id);
            return (
              <button key={id} role="tab" aria-selected={thread === id} className={thread === id ? "on" : ""} onClick={() => setThread(id)}>
                {id === "core" ? "CORE" : c?.name.toUpperCase()}
                {c?.status === "BUSY" && <span className="busy" aria-label="busy" />}
              </button>
            );
          })}
        </div>
        <span className="voice-tools">
          {canSpeak() && (
            <button
              className={voiceReplies ? "on" : ""}
              aria-pressed={voiceReplies}
              title={voiceReplies ? "Voice replies on" : "Voice replies off"}
              onClick={() => {
                if (voiceReplies) stopSpeaking();
                setVoicePrefs({ voiceReplies: !voiceReplies });
              }}
            >
              {voiceReplies ? "🔊" : "🔇"}
            </button>
          )}
          {canListen() && (
            <button
              className={handsFree ? "on" : ""}
              aria-pressed={handsFree}
              title="Hands-free: listen again after each reply"
              onClick={() => setVoicePrefs({ handsFree: !handsFree })}
            >
              HANDS-FREE
            </button>
          )}
        </span>
        <span className="rec" />
      </div>
      {current && <CompanionProfile id={current.id} />}
      <div className="msgs" ref={scroller} aria-live="polite">
        {list.length === 0 && (
          <div className="row-bot">
            <Avatar id={thread} />
            <div className="body">
              <div className="msg bot">
                {current
                  ? `${current.persona.greeting} Ask me anything directly, or have Core send me a delegation.`
                  : `I'm Core, your conductor. I run your companions, keep the Brain up to date, and ask before anything leaves the building. Tap + for things to try.`}
              </div>
            </div>
          </div>
        )}
        {list.map((m) => <Message key={m.id} m={m} />)}
        {pending && (
          <div className="row-bot">
            <Avatar id={thread} />
            <div className="msg bot typing">…</div>
          </div>
        )}
      </div>
      <form className="compose" onSubmit={onSubmit}>
        {menu && (
          <div className="card suggest" role="menu">
            {(thread === "core" ? DEMO_COMMANDS : ["What are you working on?", "What do you know about the launch?"]).map((c) => (
              <button type="button" role="menuitem" key={c} onClick={() => send(c)}>{c}</button>
            ))}
          </div>
        )}
        <button type="button" className="plus" aria-label="Suggested commands" aria-expanded={menu} onClick={() => setMenu(!menu)}>+</button>
        <button type="button" className={`mic ${voice === "listening" || voice === "transcribing" ? "live" : ""}`} aria-label={canListen() ? "Talk" : "Voice input (demo)"} onClick={toggleMic}>
          <i />
        </button>
        <input id="chat-input" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label="Message" />
        <button className="send" aria-label="Send">↑</button>
      </form>
    </section>
  );
}
