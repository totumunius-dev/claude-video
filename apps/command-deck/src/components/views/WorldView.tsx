import { CORE_HUE } from "../../data/seed";
import { useCompanions } from "../../state/companionStore";
import { useConversation } from "../../state/conversationStore";
import { useUI } from "../../state/uiStore";
import { Orb } from "../Orb";
import { rgb } from "../ui";

export function WorldView() {
  const companions = useCompanions((s) => s.companions);
  const thread = useUI((s) => s.activeThread);
  const setThread = useUI((s) => s.setThread);
  const setView = useUI((s) => s.setView);
  const voice = useConversation((s) => s.voice);
  const ring = ["core", ...companions.map((c) => c.id)];
  const idx = Math.max(0, ring.indexOf(thread));
  const c = companions.find((x) => x.id === thread);
  const hue = c?.hue ?? CORE_HUE;
  const go = (n: number) => setThread(ring[(idx + n + ring.length) % ring.length]);
  const live = voice !== "idle" || companions.some((x) => x.status === "BUSY");

  return (
    <div className="world">
      <Orb hue={hue} />
      <button className="kview" onClick={() => setView("brain")}>KNOWLEDGE VIEW</button>
      <div className="who">
        <button className="arrow" onClick={() => go(-1)} aria-label="Previous companion">‹</button>
        <div className="center">
          <div className={`bars ${live ? "live" : ""}`} aria-hidden="true">
            <i /><i /><i /><i /><i />
          </div>
          <div key={thread} className="name" style={{ color: rgb(hue), textShadow: `0 0 14px ${rgb(hue, 0.6)}` }}>
            {c ? c.name.toUpperCase() : "CORE"}
          </div>
          <div className="dots">
            {ring.map((id, i) => <i key={id} className={i === idx ? "on" : ""} />)}
          </div>
        </div>
        <button className="arrow" onClick={() => go(1)} aria-label="Next companion">›</button>
      </div>
      <div className="world-task">{c ? (c.currentTask ? `Working on: ${c.currentTask}` : c.role) : "Conductor · delegates to your companions"}</div>
    </div>
  );
}
