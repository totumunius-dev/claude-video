import { useEffect, useState } from "react";
import { BRAND } from "../data/seed";
import { useConversation } from "../state/conversationStore";
import { useUI, type View } from "../state/uiStore";
import { Icon } from "./ui";

export const VIEWS: { id: View; label: string; icon: string }[] = [
  { id: "world", label: "World", icon: "world" },
  { id: "brain", label: "Brain", icon: "brain" },
  { id: "companions", label: "Companions", icon: "companions" },
  { id: "integrations", label: "Integrations", icon: "integrations" },
  { id: "memory", label: "Memory", icon: "memory" },
];

export function Rail() {
  const view = useUI((s) => s.view);
  const setView = useUI((s) => s.setView);
  return (
    <nav className="rail" aria-label="Main">
      <div className="logo">{BRAND[0]}</div>
      {VIEWS.map((v) => (
        <button key={v.id} className={view === v.id ? "on" : ""} onClick={() => setView(v.id)} aria-label={v.label} title={v.label}>
          <Icon name={v.icon} />
        </button>
      ))}
      <div className="spacer" />
      <button aria-label="Help" title="Open demo commands from the + button in chat">
        <Icon name="help" />
      </button>
    </nav>
  );
}

export function Dock() {
  const view = useUI((s) => s.view);
  const setView = useUI((s) => s.setView);
  return (
    <nav className="dock" aria-label="Views">
      {VIEWS.map((v) => (
        <button key={v.id} className={view === v.id ? "on" : ""} onClick={() => setView(v.id)} aria-label={v.label}>
          <Icon name={v.icon} />
          <span>{v.label.toUpperCase()}</span>
        </button>
      ))}
    </nav>
  );
}

const VOICE_LABEL = {
  idle: "LISTENING",
  listening: "HEARING YOU",
  transcribing: "TRANSCRIBING",
  thinking: "THINKING",
  speaking: "SPEAKING",
} as const;

const MOODS = ["CALM", "FOCUSED", "HYPED", "CHILL"];

export function Header() {
  const voice = useConversation((s) => s.voice);
  const [now, setNow] = useState(() => new Date());
  const [mood, setMood] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <header className="top">
      <div className="brand">
        {BRAND}_OS<sup>™</sup>
      </div>
      <div className="hdr-center">
        <div className={`pill voice ${voice}`} aria-live="polite">
          <span className="dot" />
          {VOICE_LABEL[voice]}
        </div>
        <span className="pill preview" title="Mock data only. No real services are connected.">PREVIEW MODE</span>
      </div>
      <div className="hdr-right">
        <button className="pill mood" onClick={() => setMood((m) => m + 1)} title="Change mood">
          {MOODS[mood % MOODS.length]}
        </button>
        <div className="clock">{now.toLocaleTimeString("en-US")}</div>
      </div>
    </header>
  );
}
