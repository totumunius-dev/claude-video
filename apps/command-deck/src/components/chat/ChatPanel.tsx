import { useEffect, useRef, useState, type FormEvent } from "react";
import { handleUserMessage } from "../../core/conductor";
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
  const scroller = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  const tabs = ["core", ...CHAT_TABS.filter((id) => companions.some((c) => c.id === id)), ...companions.filter((c) => !CHAT_TABS.includes(c.id)).map((c) => c.id)];
  const current = companions.find((c) => c.id === thread);
  const list = messages.filter((m) => m.thread === thread);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [list.length, pending, thread]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const send = (value: string) => {
    const v = value.trim();
    if (!v) return;
    setText("");
    setMenu(false);
    void handleUserMessage(v, thread);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(text);
  };

  /** Mock voice: listen, "transcribe" the next demo command, then send it. */
  const toggleMic = () => {
    if (voice === "listening" || voice === "transcribing") {
      timers.current.forEach(clearTimeout);
      setVoice("idle");
      return;
    }
    setVoice("listening");
    const said = messages.filter((m) => m.author === "user" && m.thread === "core").length;
    const phrase = thread === "core" ? DEMO_COMMANDS[said % DEMO_COMMANDS.length] : "What should we focus on this week?";
    timers.current = [
      window.setTimeout(() => setVoice("transcribing"), 1600),
      window.setTimeout(() => {
        setVoice("idle");
        send(phrase);
      }, 2500),
    ];
  };

  const placeholder =
    voice === "listening" ? "Listening… (mock)" : voice === "transcribing" ? "Transcribing…" : `You're talking to ${current?.name ?? "Core"} through voice`;

  return (
    <section className="card chat" aria-label="Chat">
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
        <button type="button" className={`mic ${voice === "listening" || voice === "transcribing" ? "live" : ""}`} aria-label="Voice input (mock)" onClick={toggleMic}>
          <i />
        </button>
        <input id="chat-input" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label="Message" />
        <button className="send" aria-label="Send">↑</button>
      </form>
    </section>
  );
}
