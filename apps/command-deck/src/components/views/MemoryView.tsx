import { useState } from "react";
import { exportBrain } from "../../core/exportBrain";
import { notify } from "../../core/events";
import { useCompanions } from "../../state/companionStore";
import { useContext } from "../../state/contextStore";
import { resetPreviewData } from "../../state/resetAll";
import { useUI } from "../../state/uiStore";
import type { MemoryItem } from "../../types/models";

function MemoryRow({ m }: { m: MemoryItem }) {
  const edit = useContext((s) => s.editMemory);
  const forget = useContext((s) => s.forgetMemory);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(m.text);
  return (
    <div className="mem-item">
      <span className="st">{m.kind}</span>
      {editing ? (
        <input className="inp" aria-label="Edit memory" value={text} onChange={(e) => setText(e.target.value)} autoFocus />
      ) : (
        <span>{m.text}</span>
      )}
      <span style={{ display: "flex", gap: 6 }}>
        {editing ? (
          <>
            <button className="btn sm primary" onClick={() => { edit(m.id, text.trim() || m.text); setEditing(false); }}>Save</button>
            <button className="btn sm ghost" onClick={() => { setText(m.text); setEditing(false); }}>Cancel</button>
          </>
        ) : (
          <>
            <button className="btn sm" onClick={() => setEditing(true)}>Edit</button>
            {m.kind !== "goal" && <button className="btn sm danger" onClick={() => forget(m.id)}>Forget</button>}
          </>
        )}
      </span>
    </div>
  );
}

export function MemoryView() {
  const memory = useContext((s) => s.memory);
  const companions = useCompanions((s) => s.companions);
  const setThread = useUI((s) => s.setThread);
  const setView = useUI((s) => s.setView);
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="view-scroll">
      <div className="view-head">
        <h1>Memory</h1>
        <div className="tools">
          <button className="btn" onClick={exportBrain}>Export Brain</button>
          <button className="btn danger" onClick={() => setConfirmReset(true)}>Reset Preview Data</button>
        </div>
      </div>
      {confirmReset && (
        <div className="confirm" style={{ marginBottom: 16 }}>
          <div>Reset everything to the Preview starting point? This clears the conversation, delegations, new companions, Brain entries, integrations, and approvals saved in this browser.</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn danger"
              onClick={() => {
                resetPreviewData();
                setThread("core");
                setView("world");
                setConfirmReset(false);
                notify("Preview data reset");
              }}
            >
              Yes, reset
            </button>
            <button className="btn ghost" onClick={() => setConfirmReset(false)}>Keep my data</button>
          </div>
        </div>
      )}
      <div className="card section">
        <h2>What Core remembers</h2>
        <div className="small dim">Saved in this browser. Say "Remember that …" in chat to add more.</div>
        <div>{memory.map((m) => <MemoryRow key={m.id} m={m} />)}</div>
      </div>
      <div className="card section" style={{ marginTop: 16 }}>
        <h2>Companion responsibilities</h2>
        {companions.map((c) => (
          <div key={c.id} className="mem-item">
            <span className="st">{c.name}</span>
            <span>{c.purpose} <span className="dim">({c.role})</span></span>
            <span />
          </div>
        ))}
      </div>
    </div>
  );
}
