import { COMMUNITY_TEMPLATE } from "../data/seed";
import { useCompanions } from "../state/companionStore";
import { useUI } from "../state/uiStore";
import { Avatar, Status } from "./ui";

export function AgentRoster() {
  const companions = useCompanions((s) => s.companions);
  const drafts = useCompanions((s) => s.drafts);
  const thread = useUI((s) => s.activeThread);
  const setThread = useUI((s) => s.setThread);
  const openBuilder = useUI((s) => s.openBuilder);
  const busy = companions.filter((c) => c.status === "BUSY").length;
  const canAdd = !companions.some((c) => c.id === COMMUNITY_TEMPLATE.id);

  return (
    <section className="card roster" aria-label="Agent Roster">
      <div className="card-h">
        <span>Agent Roster</span>
        <span>
          <b>{companions.length}</b> companions · <b>{busy}</b> busy
        </span>
      </div>
      <ul>
        <li>
          <button className={thread === "core" ? "on" : ""} onClick={() => setThread("core")}>
            <Avatar id="core" />
            <span className="nm">
              <b>Core</b>
              <small>Conductor</small>
            </span>
            <Status value="IDLE" label="ONLINE" />
          </button>
        </li>
        {companions.map((c) => (
          <li key={c.id}>
            <button className={thread === c.id ? "on" : ""} onClick={() => setThread(c.id)}>
              <Avatar id={c.id} />
              <span className="nm">
                <b>{c.name}</b>
                <small title={c.currentTask ?? c.role}>{c.currentTask ?? c.role}</small>
              </span>
              <Status value={c.status} />
            </button>
          </li>
        ))}
        {drafts.map((c) => (
          <li key={c.id}>
            <button onClick={() => openBuilder(c.id)}>
              <Avatar id={c.id} />
              <span className="nm">
                <b>{c.name}</b>
                <small>Draft · click to finish</small>
              </span>
              <Status value="DRAFT" />
            </button>
          </li>
        ))}
        {canAdd && !drafts.length && (
          <li>
            <button onClick={() => openBuilder(COMMUNITY_TEMPLATE.id)} className="dim">
              <span className="av" style={{ border: "1px dashed var(--line)" }}>+</span>
              <span className="nm">
                <span>New companion</span>
                <small>Open the Companion Builder</small>
              </span>
              <span />
            </button>
          </li>
        )}
      </ul>
    </section>
  );
}
