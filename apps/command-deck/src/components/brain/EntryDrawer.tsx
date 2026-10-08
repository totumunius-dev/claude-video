import { neighbours } from "../../core/knowledge";
import { useKnowledge } from "../../state/knowledgeStore";
import { useUI } from "../../state/uiStore";
import { Icon, Name, fmtDate } from "../ui";

export function EntryDrawer() {
  const id = useUI((s) => s.selectedEntry);
  const entries = useKnowledge((s) => s.entries);
  const open = useUI((s) => s.openEntry);
  const view = useUI((s) => s.view);
  const mode = useUI((s) => s.brainMode);
  const setView = useUI((s) => s.setView);
  const setMode = useUI((s) => s.setBrainMode);
  const e = entries.find((x) => x.id === id);
  if (!e) return null;
  const linked = neighbours(entries, e.id);
  const inGraph = view === "brain" && mode === "graph";

  return (
    <aside className="drawer" aria-label="Knowledge entry">
      <div className="modal-h" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
        <span className="st">{e.folder}</span>
        <button onClick={() => open(null)} aria-label="Close entry"><Icon name="close" /></button>
      </div>
      <div className="db">
        <h2 style={{ margin: 0, fontSize: 17 }}>{e.title}</h2>
        <p className="muted" style={{ margin: 0 }}>{e.summary}</p>
        <ul>{e.content.map((c) => <li key={c}>{c}</li>)}</ul>
        <div className="small muted">
          Created by <Name id={e.createdBy} /> · {fmtDate(e.createdAt)} · updated {fmtDate(e.updatedAt)}
          <br />Source: {e.source}
        </div>
        <div>{e.tags.map((t) => <span key={t} className="tag">#{t}</span>)}</div>
        {e.relatedCompanions.length > 0 && (
          <div className="small">Related companions: {e.relatedCompanions.map((c, i) => <span key={c}>{i ? ", " : ""}<Name id={c} /></span>)}</div>
        )}
        <div>
          <div className="card-h" style={{ padding: "8px 0" }}>Linked entries ({linked.length})</div>
          {linked.length ? (
            <div style={{ display: "grid", gap: 6 }}>
              {linked.map((l) => (
                <button key={l.id} className="link" onClick={() => open(l.id)}>
                  {e.linkedEntries.includes(l.id) ? "→" : "←"} {l.title} <span className="dim">· {l.folder}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="dim">No links yet.</div>
          )}
        </div>
        {!inGraph && (
          <button className="btn" onClick={() => { setView("brain"); setMode("graph"); }}>Show in graph</button>
        )}
      </div>
    </aside>
  );
}
